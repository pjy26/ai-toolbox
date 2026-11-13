-- Apply after the existing membership and Waffo migrations, before deployment.
begin;

-- Row ownership is not column protection. Remove all browser write grants,
-- including any old column grants, then expose only editable profile fields.
revoke all on public.profiles from public, anon, authenticated;
revoke all on public.orders from public, anon, authenticated;
do $$
declare col record;
begin
  for col in
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name in ('profiles', 'orders')
  loop
    execute format('revoke insert (%I), update (%I) on public.%I from public, anon, authenticated',
      col.column_name, col.column_name, col.table_name);
  end loop;
  for col in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name in ('username', 'gender', 'avatar_url')
  loop
    execute format('grant update (%I) on public.profiles to authenticated', col.column_name);
  end loop;
end $$;
grant select on public.profiles, public.orders to authenticated;
grant all on public.profiles, public.orders to service_role;

-- Legacy SECURITY DEFINER credit mutation must not be callable by browsers.
revoke all on function public.deduct_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.deduct_credits(uuid, integer) to service_role;

-- Shared across serverless instances; no process-local counters.
create table if not exists public.generation_guards (
  bucket text primary key,
  window_start timestamptz not null default date_trunc('minute', now()),
  used integer not null default 0,
  leases jsonb not null default '{}'::jsonb
);
alter table public.generation_guards enable row level security;
revoke all on public.generation_guards from public, anon, authenticated;
grant all on public.generation_guards to service_role;

create or replace function public.acquire_generation_slot(
  p_user_id uuid, p_token uuid,
  p_user_limit integer default 12, p_global_limit integer default 240,
  p_concurrency integer default 2
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t timestamptz := clock_timestamp();
  minute_start timestamptz := date_trunc('minute', t);
  user_bucket text := 'user:' || p_user_id::text;
  u public.generation_guards%rowtype;
  g public.generation_guards%rowtype;
  live_leases jsonb;
begin
  if p_user_id is null or p_token is null or p_user_limit is null or p_global_limit is null
    or p_concurrency is null or p_user_limit < 1 or p_global_limit < 1 or p_concurrency < 1 then
    raise exception 'Invalid generation guard parameters';
  end if;
  insert into public.generation_guards(bucket) values (user_bucket), ('global')
    on conflict do nothing;
  select * into u from public.generation_guards where bucket = user_bucket for update;
  select * into g from public.generation_guards where bucket = 'global' for update;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into live_leases
    from jsonb_each(u.leases) where (value #>> '{}')::timestamptz > t;
  if u.window_start <> minute_start then u.used := 0; end if;
  if g.window_start <> minute_start then g.used := 0; end if;
  if u.used >= p_user_limit or g.used >= p_global_limit
    or (select count(*) from jsonb_object_keys(live_leases)) >= p_concurrency then
    return jsonb_build_object('allowed', false, 'retryAfter', 60);
  end if;
  update public.generation_guards
    set window_start = minute_start, used = u.used + 1,
      leases = live_leases || jsonb_build_object(p_token::text, t + interval '90 seconds')
    where bucket = user_bucket;
  update public.generation_guards set window_start = minute_start, used = g.used + 1
    where bucket = 'global';
  return jsonb_build_object('allowed', true, 'retryAfter', 0);
end $$;

create or replace function public.release_generation_slot(p_user_id uuid, p_token uuid)
returns void language sql security definer set search_path = '' as $$
  update public.generation_guards set leases = leases - p_token::text
    where bucket = 'user:' || p_user_id::text;
$$;
revoke all on function public.acquire_generation_slot(uuid, uuid, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.release_generation_slot(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.acquire_generation_slot(uuid, uuid, integer, integer, integer)
  to service_role;
grant execute on function public.release_generation_slot(uuid, uuid) to service_role;
commit;
