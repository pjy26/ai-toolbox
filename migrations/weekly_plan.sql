-- 给 orders 表加 membership_weeks 列，并把 profiles.membership_type 的 check 放开为 weekly
-- 幂等

alter table public.orders
  add column if not exists membership_weeks integer;

alter table public.profiles drop constraint if exists profiles_membership_type_check;
alter table public.profiles add constraint profiles_membership_type_check
  check (membership_type in ('free', 'weekly', 'monthly', 'yearly'));
