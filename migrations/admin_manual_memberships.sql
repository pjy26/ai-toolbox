-- Administrator-granted complimentary memberships.
-- These fields are intentionally separate from Waffo-paid entitlements.
alter table public.profiles
  add column if not exists manual_membership_type text
    check (manual_membership_type is null or manual_membership_type in ('weekly', 'monthly', 'yearly')),
  add column if not exists manual_membership_expires_at timestamptz,
  add column if not exists manual_membership_granted_by uuid,
  add column if not exists manual_membership_granted_at timestamptz,
  add column if not exists manual_membership_reason text;

create index if not exists profiles_manual_membership_active_idx
  on public.profiles(manual_membership_expires_at)
  where manual_membership_expires_at is not null;

create table if not exists public.admin_membership_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  target_user_id uuid not null,
  action text not null check (action in ('grant', 'revoke')),
  plan_id text check (plan_id is null or plan_id in ('weekly', 'monthly', 'yearly')),
  expires_at timestamptz,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists admin_membership_actions_target_idx
  on public.admin_membership_actions(target_user_id, created_at desc);
create index if not exists admin_membership_actions_created_idx
  on public.admin_membership_actions(created_at desc);

alter table public.admin_membership_actions enable row level security;
revoke all on public.admin_membership_actions from anon, authenticated;
