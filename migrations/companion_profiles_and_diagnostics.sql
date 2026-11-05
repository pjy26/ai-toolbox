-- Two independent companion profiles per account, plus content-free diagnostics.
-- Run after dream_phase2.sql and letters.sql.

alter table public.companions
  add column if not exists profile_key text;

update public.companions
set profile_key = case
  when lower(coalesce(gender, '')) in ('male', 'man', '男') then 'male'
  else 'female'
end
where profile_key is null;

alter table public.companions
  alter column profile_key set default 'female',
  alter column profile_key set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companions_profile_key_valid'
      and conrelid = 'public.companions'::regclass
  ) then
    alter table public.companions
      add constraint companions_profile_key_valid check (profile_key in ('female', 'male'));
  end if;
end $$;

create unique index if not exists companions_one_profile_per_gender
  on public.companions(user_id, profile_key);

alter table public.user_settings
  add column if not exists active_companion_id uuid references public.companions(id) on delete set null;

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  companion_id uuid references public.companions(id) on delete cascade,
  event_name text not null,
  locale text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint product_events_name_length check (char_length(event_name) between 1 and 60),
  constraint product_events_locale_length check (locale is null or char_length(locale) between 2 and 35),
  constraint product_events_metadata_size check (pg_column_size(metadata) <= 4096)
);

create index if not exists product_events_user_created
  on public.product_events(user_id, created_at desc);
create index if not exists product_events_name_created
  on public.product_events(event_name, created_at desc);

alter table public.product_events enable row level security;

drop policy if exists "product_events_select_own" on public.product_events;
drop policy if exists "product_events_insert_own" on public.product_events;
create policy "product_events_select_own" on public.product_events
  for select using (auth.uid() = user_id);
create policy "product_events_insert_own" on public.product_events
  for insert with check (
    auth.uid() = user_id
    and user_id is not null
    and event_name in ('companion_switched', 'chat_opened', 'paywall_viewed', 'checkout_started', 'checkout_failed')
  );
-- Server-only completion, failure, and quota events use the service role and bypass RLS.
-- This prevents browsers from fabricating the operational metrics shown in /admin.

revoke update, delete on table public.product_events from anon, authenticated;

comment on table public.product_events is
  'Operational feature events and error codes only. Never store message, memory, Dream, or letter content in this table.';
comment on column public.user_settings.active_companion_id is
  'The currently selected independent companion profile. All console reads default to this companion.';
