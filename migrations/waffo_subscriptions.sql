-- Waffo recurring memberships. Run once in the Supabase SQL editor before checkout.
alter table public.orders
  add column if not exists provider text not null default 'alipay',
  add column if not exists provider_order_id text,
  add column if not exists provider_session_id text,
  add column if not exists provider_payment_id text,
  add column if not exists plan_id text,
  add column if not exists currency text not null default 'CNY',
  add column if not exists subscription_status text,
  add column if not exists current_period_end timestamptz,
  add column if not exists auto_renew boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists last_webhook_at timestamptz;

create unique index if not exists orders_waffo_provider_order_id_idx
  on public.orders(provider_order_id)
  where provider = 'waffo' and provider_order_id is not null;
create index if not exists orders_waffo_user_status_idx
  on public.orders(user_id, subscription_status)
  where provider = 'waffo';

alter table public.profiles
  add column if not exists membership_provider_order_id text,
  add column if not exists membership_auto_renew boolean not null default false;

create table if not exists public.waffo_webhook_events (
  id text primary key,
  event_type text not null,
  mode text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

-- Webhook deliveries are written only by the server with the service role.
alter table public.waffo_webhook_events enable row level security;
revoke all on public.waffo_webhook_events from anon, authenticated;
