-- Upgrade after launch_security.sql. Existing summaries remain readable.
begin;
-- New writes must keep the session in the same account as its companion.
create unique index if not exists companions_id_owner on public.companions(id,user_id);
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.chat_sessions'::regclass and conname='session_companion_owner') then
    alter table public.chat_sessions add constraint session_companion_owner foreign key(companion_id,user_id)
      references public.companions(id,user_id) on delete cascade not valid;
  end if;
end $$;
alter table public.profiles add column if not exists gender text;
alter table public.companions add column if not exists live_state jsonb default '{}';
grant update(gender) on public.profiles to authenticated;

create table if not exists public.chat_turns (
  id uuid primary key, user_id uuid not null references auth.users on delete cascade,
  companion_id uuid not null references public.companions on delete cascade,
  session_id uuid not null references public.chat_sessions on delete cascade,
  user_message_id uuid unique not null references public.chat_messages on delete cascade,
  assistant_message_id uuid unique references public.chat_messages on delete cascade,
  request_lease uuid not null, request_until timestamptz not null,
  locale text not null check(locale in ('en','zh')), created_at timestamptz not null default clock_timestamp(),
  job_state text not null default 'none' check(job_state in ('none','pending','running','done','failed')),
  job_lease uuid, next_attempt_at timestamptz, attempts integer not null default 0,
  allow_memory boolean not null default true,
  excluded boolean not null default false
);
create index if not exists chat_turn_jobs on public.chat_turns(next_attempt_at) where job_state in ('pending','running');
create index if not exists chat_turns_companion on public.chat_turns(companion_id,created_at);
-- memory_summaries contains only current text. Version history never enters recall.
alter table public.memory_summaries add column if not exists memory_key text,
  add column if not exists source_message_id uuid references public.chat_messages(id) on delete set null,
  add column if not exists revision integer not null default 1,
  add column if not exists provenance text not null default 'legacy',
  add column if not exists effective_at timestamptz not null default now();
create unique index if not exists active_fact_key on public.memory_summaries(companion_id,memory_key) where memory_key is not null;
create table if not exists public.memory_versions (
  id bigint generated always as identity primary key,
  companion_id uuid not null references public.companions on delete cascade,
  memory_id uuid not null, memory_key text, revision integer not null, summary text,
  source_message_id uuid references public.chat_messages on delete set null,
  status text not null check(status in ('superseded','deleted')), created_at timestamptz not null default now(),
  unique(memory_id,revision)
);
create table if not exists public.memory_evidence (
  memory_id uuid not null, revision integer not null, message_id uuid not null references public.chat_messages on delete cascade,
  companion_id uuid not null references public.companions on delete cascade, primary key(memory_id,revision,message_id)
);
alter table public.memory_evidence enable row level security;
revoke all on public.memory_evidence from public,anon,authenticated;
grant select,insert,delete on public.memory_evidence to service_role;
create index if not exists memory_versions_deleted_key on public.memory_versions(companion_id,memory_key,created_at) where status='deleted';
alter table public.chat_turns enable row level security;
alter table public.memory_versions enable row level security;
revoke all on public.chat_turns,public.memory_versions from public,anon,authenticated;
grant all on public.chat_turns,public.memory_versions to service_role;
grant usage,select on sequence public.memory_versions_id_seq to service_role;
-- Sources and projections are immutable to browser SDK clients.
revoke insert,update,delete,truncate on public.memory_summaries from public,anon,authenticated;
revoke update,delete,truncate on public.chat_messages from public,anon,authenticated;

create or replace function public.begin_companion_turn(p_id uuid,p_user uuid,p_companion uuid,p_session uuid,p_text text,p_locale text,p_lease uuid)
returns jsonb language plpgsql set search_path=public,extensions,pg_temp as $$
declare t chat_turns; sid uuid := p_session; mid uuid; saved text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  if not exists(select 1 from companions where id=p_companion and user_id=p_user) then return '{"state":"missing"}'; end if;
  select * into t from chat_turns where id=p_id for update;
  if found then
    if t.user_id<>p_user or t.companion_id<>p_companion or (sid is not null and sid<>t.session_id)
      or not exists(select 1 from chat_messages where id=t.user_message_id and content=p_text)
      then return '{"state":"conflict"}'; end if;
    if t.assistant_message_id is not null then
      select content into strict saved from chat_messages where id=t.assistant_message_id;
      return jsonb_build_object('state','complete','session_id',t.session_id,'message_id',t.user_message_id,'reply_id',t.assistant_message_id,'reply',saved);
    end if;
    if t.request_until>now() then return '{"state":"busy"}'; end if;
    update chat_turns set request_lease=p_lease,request_until=now()+interval '90 seconds' where id=p_id;
    return jsonb_build_object('state','claimed','session_id',t.session_id,'message_id',t.user_message_id);
  end if;
  if sid is null then
    insert into chat_sessions(user_id,companion_id,title) values(p_user,p_companion,left(p_text,30)) returning id into sid;
  elsif not exists(select 1 from chat_sessions where id=sid and user_id=p_user and companion_id=p_companion) then
    return '{"state":"missing"}';
  end if;
  insert into chat_messages(session_id,role,content) values(sid,'user',p_text) returning id into mid;
  insert into chat_turns(id,user_id,companion_id,session_id,user_message_id,request_lease,request_until,locale,allow_memory)
    values(p_id,p_user,p_companion,sid,mid,p_lease,now()+interval '90 seconds',p_locale,coalesce((select memory_enabled from user_settings where user_id=p_user),true));
  return jsonb_build_object('state','claimed','session_id',sid,'message_id',mid);
end $$;

create or replace function public.finish_companion_turn(p_id uuid,p_lease uuid,p_reply text)
returns void language plpgsql set search_path=public,extensions,pg_temp as $$
declare t chat_turns; mid uuid;
begin
  select * into strict t from chat_turns where id=p_id and request_lease=p_lease and assistant_message_id is null for update;
  insert into chat_messages(session_id,role,content) values(t.session_id,'assistant',p_reply) returning id into mid;
  update chat_turns set assistant_message_id=mid,job_state=case when t.allow_memory and coalesce((select memory_enabled from user_settings where user_id=t.user_id),true) then 'pending' else 'done' end,
    next_attempt_at=now() where id=p_id;
  update chat_sessions set updated_at=now() where id=t.session_id;
end $$;

create or replace function public.claim_memory_turn(p_id uuid default null)
returns setof public.chat_turns language plpgsql set search_path=public,extensions,pg_temp as $$
begin
  update chat_turns set job_state='failed', job_lease=null where job_state='running' and attempts>=5 and next_attempt_at<=now();
  return query update chat_turns set job_state='running',job_lease=gen_random_uuid(),attempts=attempts+1,next_attempt_at=now()+interval '90 seconds'
  where id=(select t.id from chat_turns t where (p_id is null or t.id=p_id)
    and t.job_state in ('pending','running') and t.next_attempt_at<=now()
    and not exists(select 1 from chat_turns prev where prev.companion_id=t.companion_id and prev.job_state in ('pending','running')
      and (prev.created_at,prev.id)<(t.created_at,t.id))
    order by t.created_at,t.id limit 1 for update skip locked) returning *;
end $$;

create or replace function public.turn_history(p_turn uuid,p_user uuid)
returns table(role text,content text,created_at timestamptz) language sql stable set search_path=public,extensions,pg_temp as $$
  select m.role,m.content,m.created_at from chat_turns t join chat_messages source on source.id=t.user_message_id
  join chat_messages m on m.session_id=t.session_id and m.created_at<=source.created_at and m.id<>source.id
  where t.id=p_turn and t.user_id=p_user and not exists(select 1 from chat_turns x where x.session_id=t.session_id and x.excluded
    and m.id in (x.user_message_id,x.assistant_message_id))
  order by m.created_at desc,m.id desc limit 30;
$$;
alter table public.relationship_events add column if not exists source_message_id uuid references public.chat_messages on delete set null;
create or replace function public.apply_turn_memory(p_id uuid,p_lease uuid,p_result jsonb)
returns void language plpgsql set search_path=public,extensions,pg_temp as $$
declare t chat_turns; original text; fact jsonb; prior memory_summaries; k text; q text; person jsonb; people jsonb;
  paid boolean; event jsonb; state jsonb;
begin
  select * into strict t from chat_turns where id=p_id and job_lease=p_lease and job_state='running' for update;
  -- Serialize memory edits with writes for this companion, including absent fact keys.
  perform 1 from companions where id=t.companion_id for update;
  if not t.excluded and coalesce((select memory_enabled from user_settings where user_id=t.user_id),true) then
    select m.content into strict original from chat_messages m join chat_sessions s on s.id=m.session_id
      where m.id=t.user_message_id and m.role='user' and s.id=t.session_id and s.companion_id=t.companion_id and s.user_id=t.user_id;
    for fact in select * from jsonb_array_elements(p_result->'facts') loop
      k:=fact->>'key'; q:=trim(fact->>'quote');
      if k is null or k !~ '^[a-z][a-z0-9_.]{0,79}$' or q is null or length(q) not between 2 and 1000 or strpos(original,q)=0 then continue; end if;
      if exists(select 1 from memory_versions where companion_id=t.companion_id and memory_key=md5(k) and status='deleted' and created_at>=t.created_at) then continue; end if;
      select * into prior from memory_summaries where companion_id=t.companion_id and memory_key=k for update;
      if found then
        if prior.summary=q then
          insert into memory_evidence values(prior.id,prior.revision,t.user_message_id,t.companion_id) on conflict do nothing;
          continue;
        end if;
        if prior.effective_at>=t.created_at then continue; end if;
        update chat_turns set excluded=true where companion_id=t.companion_id and (user_message_id=prior.source_message_id or user_message_id in
          (select message_id from memory_evidence where memory_id=prior.id and revision=prior.revision));
        insert into memory_versions(companion_id,memory_id,memory_key,revision,summary,source_message_id,status)
          values(t.companion_id,prior.id,prior.memory_key,prior.revision,prior.summary,prior.source_message_id,'superseded');
        update memory_summaries set summary=q,revision=revision+1,provenance='message',source_message_id=t.user_message_id,
          source_session_id=t.session_id,embedding=(fact->>'embedding')::vector,effective_at=t.created_at where id=prior.id;
      else
        insert into memory_summaries(companion_id,memory_key,summary,source_message_id,source_session_id,provenance,embedding,effective_at)
          values(t.companion_id,k,q,t.user_message_id,t.session_id,'message',(fact->>'embedding')::vector,t.created_at);
      end if;
      insert into memory_evidence(memory_id,revision,message_id,companion_id)
        select id,revision,t.user_message_id,t.companion_id from memory_summaries where companion_id=t.companion_id and memory_key=k on conflict do nothing;
    end loop;
    select coalesce((membership_type<>'free' and membership_expires_at>now()) or
      (manual_membership_type is not null and manual_membership_expires_at>now()),false) into paid from profiles where id=t.user_id;
    for person in select * from jsonb_array_elements(p_result->'people') loop
      if length(trim(person->>'name'))>0 and strpos(original,person->>'name')>0 and strpos(original,person->>'quote')>0 then
        select coalesce(profile->'important_people','[]'::jsonb) into people from user_profiles where companion_id=t.companion_id for update;
        if people is null or jsonb_typeof(people)<>'array' then people:='[]'; end if;
        if (paid or jsonb_array_length(people)=0) and not exists(select 1 from jsonb_array_elements(people) p where p->>'name'=person->>'name' or p=person->'name') then
          insert into user_profiles(companion_id,profile) values(t.companion_id,jsonb_build_object('important_people',people||jsonb_build_array(jsonb_build_object('name',person->>'name','notes',person->>'quote','source_message_id',t.user_message_id))))
            on conflict(companion_id) do update set profile=coalesce(user_profiles.profile,'{}')||excluded.profile;
        end if;
      end if;
    end loop;
    event:=p_result->'event';
    if paid and length(event->>'description') between 3 and 1000 and length(event->>'quote')>1 and strpos(original,event->>'quote')>0
       and not exists(select 1 from relationship_events where companion_id=t.companion_id and description=event->>'description') then
      insert into relationship_events(companion_id,description,event_type,source_message_id,embedding) values(t.companion_id,event->>'description',event->>'type',t.user_message_id,(event->>'embedding')::vector);
    end if;
    state:=p_result->'emotion';
    if jsonb_typeof(state)='object' then
      update companions set emotion_state=state||jsonb_build_object('updated_at',t.created_at) where id=t.companion_id
        and coalesce((emotion_state->>'updated_at')::timestamptz,'-infinity')<=t.created_at;
    end if;
    if jsonb_typeof(p_result->'scene')='object' then
      update companions set live_state=(p_result->'scene')||jsonb_build_object('updated_at',t.created_at) where id=t.companion_id
        and coalesce((live_state->>'updated_at')::timestamptz,'-infinity')<=t.created_at;
    end if;
  end if;
  update chat_turns set job_state='done',job_lease=null,next_attempt_at=null where id=t.id;
end $$;

-- Null replacement means forget. The live projection is changed in the same
-- transaction as its history and source exclusion.
create or replace function public.edit_trusted_memory(p_user uuid,p_memory uuid,p_revision int,p_text text)
returns text language plpgsql set search_path=public,extensions,pg_temp as $$
declare m memory_summaries; cid uuid;
begin
  select s.companion_id into cid from memory_summaries s join companions c on c.id=s.companion_id where s.id=p_memory and c.user_id=p_user;
  if cid is null then return 'missing'; end if;
  perform 1 from companions where id=cid for update;
  select * into m from memory_summaries where id=p_memory for update;
  if not found then return 'missing'; end if;
  if p_revision is not null and p_revision<>m.revision then return 'conflict'; end if;
  if p_text is not null and length(trim(p_text)) not between 1 and 1000 then return 'invalid'; end if;
  insert into memory_versions(companion_id,memory_id,memory_key,revision,summary,source_message_id,status)
    values(cid,m.id,m.memory_key,m.revision,m.summary,m.source_message_id,case when p_text is null then 'deleted' else 'superseded' end);
  update chat_turns set excluded=true where companion_id=cid and user_message_id in
    (select source_message_id from memory_versions where memory_id=m.id union select message_id from memory_evidence where memory_id=m.id);
  if p_text is null then
    update memory_versions set summary=null,memory_key=md5(m.memory_key) where memory_id=m.id;
    delete from memory_summaries where id=m.id;
  else
    update memory_summaries set summary=trim(p_text),revision=revision+1,provenance='user_edit',embedding=null,effective_at=clock_timestamp() where id=m.id;
  end if;
  return 'ok';
end $$;

create or replace function public.edit_profile_fact(p_user uuid,p_companion uuid,p_path text[],p_at timestamptz,p_text text,p_expected jsonb)
returns text language plpgsql set search_path=public,pg_temp as $$
declare rec user_profiles; old_value jsonb; mid uuid:=gen_random_uuid();
begin
  if not ((cardinality(p_path)=2 and p_path[1] in ('basic_info','preferences','key_facts','ongoing_matters')) or p_path=array['personality_notes']) then return 'invalid'; end if;
  perform 1 from companions where id=p_companion and user_id=p_user for update;
  if not found then return 'missing'; end if;
  select * into rec from user_profiles where companion_id=p_companion for update;
  if not found then return 'missing'; end if;
  if p_at is not null and rec.updated_at is distinct from p_at then return 'conflict'; end if;
  old_value:=rec.profile #> p_path;
  if p_expected is not null and p_expected is distinct from old_value then
    if p_path[1] in ('key_facts','ongoing_matters') then
      select array[p_path[1],(min(n)-1)::text] into p_path from jsonb_array_elements(rec.profile->p_path[1]) with ordinality a(v,n) where v=p_expected having count(*)=1;
      if p_path is null then return 'conflict'; end if;
      old_value:=rec.profile #> p_path;
    else return 'conflict'; end if;
  end if;
  if old_value is null then return 'missing'; end if;
  if p_text is not null and length(trim(p_text)) not between 1 and 1000 then return 'invalid'; end if;
  update user_profiles set profile=profile #- p_path where companion_id=p_companion;
  if p_text is not null then
    insert into memory_summaries(id,companion_id,summary,revision,provenance) values(mid,p_companion,trim(p_text),2,'user_edit');
  end if;
  insert into memory_versions(companion_id,memory_id,revision,summary,status) values(p_companion,mid,1,
    case when p_text is null then null else old_value #>> '{}' end,case when p_text is null then 'deleted' else 'superseded' end);
  return 'ok';
end $$;
create or replace view public.memory_eligible_messages as
select m.* from public.chat_messages m where not exists
  (select 1 from public.chat_turns t where t.session_id=m.session_id and t.excluded and m.id in(t.user_message_id,t.assistant_message_id));
revoke all on public.memory_eligible_messages from public,authenticated,anon;
grant select on public.memory_eligible_messages to service_role;

do $$ declare fn regprocedure;
begin
  for fn in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in
    ('begin_companion_turn','finish_companion_turn','claim_memory_turn','turn_history','apply_turn_memory','edit_trusted_memory','edit_profile_fact') loop
    execute format('revoke all on function %s from public, anon, authenticated',fn);
    execute format('grant execute on function %s to service_role',fn);
  end loop;
end $$;
-- A switch to "memory off" also cancels work accepted before the change.
create or replace function public.stop_pending_memory() returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
  if not new.memory_enabled then
    update chat_turns set allow_memory=false,job_state=case when job_state='none' then 'none' else 'done' end,job_lease=null,next_attempt_at=null
      where user_id=new.user_id and (assistant_message_id is null or job_state in ('pending','running','failed'));
  end if;
  return new;
end $$;
revoke all on function public.stop_pending_memory() from public,anon,authenticated;
drop trigger if exists stop_pending_memory on public.user_settings;
create trigger stop_pending_memory after insert or update of memory_enabled on public.user_settings for each row execute function public.stop_pending_memory();

-- Auxiliary content sourced from an excluded turn must also leave future context.
create or replace function public.exclude_turn_derivatives() returns trigger language plpgsql
set search_path=public,pg_temp as $$
begin
  update companions set live_state='{}' where id=new.companion_id and live_state->>'updated_at'=to_jsonb(new.created_at)#>>'{}';
  update companions set emotion_state='{}' where id=new.companion_id and emotion_state->>'updated_at'=to_jsonb(new.created_at)#>>'{}';
  delete from relationship_events where companion_id=new.companion_id and source_message_id=new.user_message_id;
  update user_profiles u set profile=jsonb_set(profile,'{important_people}',coalesce((
    select jsonb_agg(person order by ord) from jsonb_array_elements(u.profile->'important_people') with ordinality a(person,ord)
    where (person->>'source_message_id') is distinct from new.user_message_id::text
  ),'[]'::jsonb))
  where companion_id=new.companion_id and (profile->'important_people') @> jsonb_build_array(jsonb_build_object('source_message_id',new.user_message_id));
  return new;
end $$;
drop trigger if exists exclude_turn_derivatives on public.chat_turns;
create trigger exclude_turn_derivatives after update of excluded on public.chat_turns for each row
  when (new.excluded and not old.excluded) execute function public.exclude_turn_derivatives();

create table if not exists public.amara_schema_versions(version text primary key, applied_at timestamptz not null default now());
alter table public.amara_schema_versions enable row level security;
revoke all on public.amara_schema_versions from public, anon, authenticated;
insert into public.amara_schema_versions(version) values('trusted_memory_v1') on conflict do nothing;
commit;
