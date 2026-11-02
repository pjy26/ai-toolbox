-- Occasional, relationship-based letters. This migration is additive and does
-- not alter chat, Dreams, nightly jobs, companion, memory, or settings tables.

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.companions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  locale text not null,
  relationship_stage integer not null,
  milestone_key text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'deleted')),
  read_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  source_message_ids uuid[] not null default '{}'::uuid[],
  source_memory_ids uuid[] not null default '{}'::uuid[],
  source_event_ids uuid[] not null default '{}'::uuid[],
  model text,
  prompt_version text,
  constraint letters_locale_length check (char_length(locale) between 2 and 35),
  constraint letters_title_length check (char_length(title) between 1 and 120),
  constraint letters_content_length check (char_length(content) between 1 and 6000),
  constraint letters_milestone_length check (char_length(milestone_key) between 1 and 100),
  constraint letters_relationship_stage_range check (relationship_stage between 0 and 100),
  constraint letters_published_generated_at check (status <> 'published' or generated_at is not null)
);

-- A milestone is consumed even after soft deletion: deleting a letter must not
-- make a later scheduler run regenerate and resurface the same milestone.
create unique index if not exists letters_one_per_companion_milestone
  on public.letters(companion_id, milestone_key);
create index if not exists letters_owner_status_created
  on public.letters(user_id, status, created_at desc);
create index if not exists letters_owner_unread_created
  on public.letters(user_id, created_at desc)
  where status = 'published' and read_at is null;

alter table public.letters enable row level security;

-- Owners can read delivered/deleted letters and change only read/delete state.
-- Drafts, inserts, hard deletes, and every generated/content field are server-only.
drop policy if exists "letters_select_own" on public.letters;
drop policy if exists "letters_update_own_read_delete" on public.letters;
create policy "letters_select_own" on public.letters
  for select using (auth.uid() = user_id and status in ('published', 'deleted'));
create policy "letters_update_own_read_delete" on public.letters
  for update using (auth.uid() = user_id and status = 'published')
  with check (auth.uid() = user_id and status in ('published', 'deleted'));

revoke all on table public.letters from anon, authenticated;
grant select on table public.letters to authenticated;
grant update (read_at, status) on table public.letters to authenticated;

comment on table public.letters is
  'Server-generated occasional letters grounded in real relationship material. Owners may only read and update read/soft-delete state.';
comment on column public.letters.milestone_key is
  'Stable internal milestone identifier. Unique per companion across all statuses to prevent regeneration after deletion.';
