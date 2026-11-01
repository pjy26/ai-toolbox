-- Phase 2: isolated Dreams, idempotent nightly jobs, and per-user settings.
-- This migration is intentionally limited to new tables; it does not alter the
-- existing chat, memory_summaries, user_profiles, or relationship_events paths.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  dream_enabled boolean not null default true,
  proactive_enabled boolean not null default true,
  memory_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_locale_length check (char_length(locale) between 2 and 35),
  constraint user_settings_timezone_length check (char_length(timezone) between 1 and 64)
);

create table if not exists public.dream_entries (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.companions(id) on delete cascade,
  local_date date not null,
  timezone text not null,
  title text,
  content text not null,
  emotional_theme text,
  next_day_hook text,
  source_message_ids uuid[] not null default '{}'::uuid[],
  source_memory_ids uuid[] not null default '{}'::uuid[],
  source_event_ids uuid[] not null default '{}'::uuid[],
  model text,
  prompt_version text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'deleted', 'failed')),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dream_entries_timezone_length check (char_length(timezone) between 1 and 64),
  constraint dream_entries_title_length check (title is null or char_length(title) <= 120),
  constraint dream_entries_content_length check (char_length(content) between 1 and 6000)
);

-- Deleted/failed attempts do not block a later valid Dream. Draft and published
-- rows both hold the daily slot, preventing concurrent duplicate generation.
create unique index if not exists dream_entries_one_active_per_day
  on public.dream_entries(companion_id, local_date)
  where status in ('draft', 'published');
create index if not exists dream_entries_companion_created
  on public.dream_entries(companion_id, created_at desc);
create index if not exists dream_entries_companion_status_date
  on public.dream_entries(companion_id, status, local_date desc);

create table if not exists public.nightly_jobs (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.companions(id) on delete cascade,
  job_type text not null default 'all' check (job_type in ('consolidate', 'dream', 'all')),
  local_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  range_start timestamptz,
  range_end timestamptz,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (companion_id, job_type, local_date)
);
create index if not exists nightly_jobs_status_created
  on public.nightly_jobs(status, created_at);
create index if not exists nightly_jobs_companion_date
  on public.nightly_jobs(companion_id, local_date desc);

-- Keep settings timestamps correct for both API updates and trusted SQL updates.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;
alter table public.dream_entries enable row level security;
alter table public.nightly_jobs enable row level security;

-- Settings are private to their owner. The service role bypasses RLS for the
-- protected nightly scheduler; no browser credentials are accepted by it.
drop policy if exists "user_settings_select_own" on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Dreams are readable and soft-deletable only through their owned companion.
-- Creation is reserved for the trusted server-side generator.
drop policy if exists "dream_entries_select_own" on public.dream_entries;
drop policy if exists "dream_entries_update_own" on public.dream_entries;
create policy "dream_entries_select_own" on public.dream_entries
  for select using (
    exists (
      select 1 from public.companions c
      where c.id = dream_entries.companion_id and c.user_id = auth.uid()
    )
  );
create policy "dream_entries_update_own" on public.dream_entries
  for update using (
    exists (
      select 1 from public.companions c
      where c.id = dream_entries.companion_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.companions c
      where c.id = dream_entries.companion_id and c.user_id = auth.uid()
    )
  );

-- Job diagnostics may contain operational details, so users can only read jobs
-- attached to their own companions and cannot alter scheduler state directly.
drop policy if exists "nightly_jobs_select_own" on public.nightly_jobs;
create policy "nightly_jobs_select_own" on public.nightly_jobs
  for select using (
    exists (
      select 1 from public.companions c
      where c.id = nightly_jobs.companion_id and c.user_id = auth.uid()
    )
  );

comment on table public.dream_entries is
  'Imaginative Dream records only. Never a source of user facts or memory_summaries writes.';
comment on table public.nightly_jobs is
  'Idempotent nightly execution records. Unique per companion, job type, and user-local date.';
comment on table public.user_settings is
  'Per-user locale, IANA timezone, Dream, proactive message, and memory preferences.';
