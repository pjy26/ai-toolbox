-- Amara relationship membership tiers.
-- Existing weekly/monthly/yearly values remain valid as legacy Plus access.

alter table if exists public.profiles drop constraint if exists profiles_membership_type_check;
alter table if exists public.profiles drop constraint if exists profiles_manual_membership_type_check;
alter table if exists public.orders drop constraint if exists orders_plan_id_check;

alter table if exists public.profiles
  add constraint profiles_membership_type_check check (
    membership_type in (
      'free', 'weekly', 'monthly', 'yearly',
      'plus_trial', 'plus_monthly', 'plus_yearly',
      'premium_monthly', 'premium_yearly'
    )
  );

alter table if exists public.profiles
  add constraint profiles_manual_membership_type_check check (
    manual_membership_type is null or manual_membership_type in (
      'weekly', 'monthly', 'yearly',
      'plus_trial', 'plus_monthly', 'plus_yearly',
      'premium_monthly', 'premium_yearly'
    )
  );

alter table if exists public.orders
  add constraint orders_plan_id_check check (
    plan_id is null or plan_id in (
      'weekly', 'monthly', 'yearly',
      'plus_trial', 'plus_monthly', 'plus_yearly',
      'premium_monthly', 'premium_yearly'
    )
  );
