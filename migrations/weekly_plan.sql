-- 给 orders 表加 membership_weeks 列，并把 profiles.membership_type 的 check 放开为 weekly
-- 幂等

alter table public.orders
  add column if not exists membership_weeks integer;

-- 放开 membership_type 取值，允许 'weekly'
drop policy if exists "_dummy" on public.profiles;
do $$
begin
  -- 重新创建带 weekly 的 check 约束（如果旧约束不允许 weekly，先删再建）
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%membership_type in (''free'', ''monthly'', ''yearly'')%'
  ) then
    alter table public.profiles drop constraint profiles_membership_type_check;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%membership_type in (''free'', ''weekly'', ''monthly'', ''yearly'')%'
  ) then
    alter table public.profiles
      add constraint profiles_membership_type_check
      check (membership_type in ('free', 'weekly', 'monthly', 'yearly'));
  end if;
end$$;
