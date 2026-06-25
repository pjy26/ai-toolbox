-- AI Toolbox 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行

-- 1. profiles 表
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  avatar_url text,
  credits integer default 50,
  membership_type text default 'free' check (membership_type in ('free', 'monthly', 'yearly')),
  membership_expires_at timestamptz,
  created_at timestamptz default now()
);

-- 2. orders 表
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  order_no text unique not null,
  type text not null check (type in ('membership', 'credits')),
  amount numeric not null,
  credits_amount integer,
  membership_months integer,
  status text default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz default now(),
  paid_at timestamptz
);

-- 3. usage_logs 表
create table public.usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  tool_key text not null,
  credits_cost integer default 0,
  created_at timestamptz default now()
);

-- 4. chat_sessions 表
create table public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  title text not null default '新对话',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. chat_messages 表
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.chat_sessions on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- 6. 注册自动创建 profile 触发器
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, credits)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', new.email), 50);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. 原子扣积分函数
create or replace function public.deduct_credits(p_user_id uuid, p_amount integer)
returns void as $$
begin
  update public.profiles
  set credits = credits - p_amount
  where id = p_user_id and credits >= p_amount;
  if not found then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;
end;
$$ language plpgsql security definer;

-- 8. RLS
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.usage_logs enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can view own orders" on public.orders for select using (auth.uid() = user_id);
create policy "Users can insert own orders" on public.orders for insert with check (auth.uid() = user_id);
create policy "Users can view own usage" on public.usage_logs for select using (auth.uid() = user_id);
create policy "Users can insert own usage" on public.usage_logs for insert with check (auth.uid() = user_id);
create policy "Users manage own sessions" on public.chat_sessions for all using (auth.uid() = user_id);
create policy "Users manage own messages" on public.chat_messages for all
  using (auth.uid() in (select user_id from public.chat_sessions where id = chat_messages.session_id));
