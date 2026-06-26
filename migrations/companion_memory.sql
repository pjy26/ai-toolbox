-- =====================================================================
-- AI Toolbox · 三层记忆系统 migration (companion)
-- 幂等执行：可重复运行
-- 三层记忆架构：
--   1) chat_sessions / chat_messages  —— 短期记忆（最近对话）
--   2) memory_summaries              —— 中期记忆（跨会话摘要）
--   3) user_profiles                 —— 全量长期记忆（结构化档案）
-- =====================================================================

-- =====================================================================
-- 0. 通用工具：updated_at 自动更新触发器
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- 1. companions —— 陪伴角色配置
--    一个用户可以拥有多个陪伴角色（朋友 / 恋人）
-- =====================================================================
create table if not exists public.companions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('friend', 'lover')),
  gender text,
  companion_name text,
  user_nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists companions_set_updated_at on public.companions;
create trigger companions_set_updated_at
  before update on public.companions
  for each row execute function public.set_updated_at();

create index if not exists idx_companions_user_id on public.companions(user_id);

-- =====================================================================
-- 2. chat_sessions —— 增补 companion_id 外键（如果列不存在则添加）
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chat_sessions' and column_name = 'companion_id'
  ) then
    alter table public.chat_sessions
      add column companion_id uuid references public.companions(id) on delete cascade;
  end if;
end$$;

create index if not exists idx_chat_sessions_companion_id on public.chat_sessions(companion_id);

drop trigger if exists chat_sessions_set_updated_at on public.chat_sessions;
create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 3. user_profiles —— 全量长期记忆（每个 companion 一份 jsonb 档案）
-- =====================================================================
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.companions(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (companion_id)
);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

create index if not exists idx_user_profiles_companion_id on public.user_profiles(companion_id);

-- =====================================================================
-- 4. memory_summaries —— 中期记忆（跨会话摘要）
-- =====================================================================
create table if not exists public.memory_summaries (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.companions(id) on delete cascade,
  summary text not null,
  importance smallint not null default 1 check (importance between 1 and 5),
  source_session_id uuid references public.chat_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists memory_summaries_set_updated_at on public.memory_summaries;
create trigger memory_summaries_set_updated_at
  before update on public.memory_summaries
  for each row execute function public.set_updated_at();

create index if not exists idx_memory_summaries_companion_id on public.memory_summaries(companion_id);
create index if not exists idx_memory_summaries_companion_importance
  on public.memory_summaries(companion_id, importance desc);

-- =====================================================================
-- 5. chat_messages —— 创建索引（取最近对话）
-- =====================================================================
create index if not exists idx_chat_messages_session_created
  on public.chat_messages(session_id, created_at);

-- =====================================================================
-- 6. RLS —— 全部启用 + 全部重建策略
-- =====================================================================
alter table public.companions        enable row level security;
alter table public.user_profiles     enable row level security;
alter table public.memory_summaries  enable row level security;
alter table public.chat_sessions     enable row level security;
alter table public.chat_messages     enable row level security;

-- ---------- companions ----------
drop policy if exists "companions_select_own" on public.companions;
drop policy if exists "companions_insert_own" on public.companions;
drop policy if exists "companions_update_own" on public.companions;
drop policy if exists "companions_delete_own" on public.companions;

create policy "companions_select_own" on public.companions
  for select using (auth.uid() = user_id);
create policy "companions_insert_own" on public.companions
  for insert with check (auth.uid() = user_id);
create policy "companions_update_own" on public.companions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "companions_delete_own" on public.companions
  for delete using (auth.uid() = user_id);

-- ---------- user_profiles（通过 companion 间接归属） ----------
drop policy if exists "user_profiles_select_own" on public.user_profiles;
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;
drop policy if exists "user_profiles_delete_own" on public.user_profiles;

create policy "user_profiles_select_own" on public.user_profiles
  for select using (
    exists (select 1 from public.companions c where c.id = user_profiles.companion_id and c.user_id = auth.uid())
  );
create policy "user_profiles_insert_own" on public.user_profiles
  for insert with check (
    exists (select 1 from public.companions c where c.id = user_profiles.companion_id and c.user_id = auth.uid())
  );
create policy "user_profiles_update_own" on public.user_profiles
  for update using (
    exists (select 1 from public.companions c where c.id = user_profiles.companion_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.companions c where c.id = user_profiles.companion_id and c.user_id = auth.uid())
  );
create policy "user_profiles_delete_own" on public.user_profiles
  for delete using (
    exists (select 1 from public.companions c where c.id = user_profiles.companion_id and c.user_id = auth.uid())
  );

-- ---------- memory_summaries（通过 companion 间接归属） ----------
drop policy if exists "memory_summaries_select_own" on public.memory_summaries;
drop policy if exists "memory_summaries_insert_own" on public.memory_summaries;
drop policy if exists "memory_summaries_update_own" on public.memory_summaries;
drop policy if exists "memory_summaries_delete_own" on public.memory_summaries;

create policy "memory_summaries_select_own" on public.memory_summaries
  for select using (
    exists (select 1 from public.companions c where c.id = memory_summaries.companion_id and c.user_id = auth.uid())
  );
create policy "memory_summaries_insert_own" on public.memory_summaries
  for insert with check (
    exists (select 1 from public.companions c where c.id = memory_summaries.companion_id and c.user_id = auth.uid())
  );
create policy "memory_summaries_update_own" on public.memory_summaries
  for update using (
    exists (select 1 from public.companions c where c.id = memory_summaries.companion_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.companions c where c.id = memory_summaries.companion_id and c.user_id = auth.uid())
  );
create policy "memory_summaries_delete_own" on public.memory_summaries
  for delete using (
    exists (select 1 from public.companions c where c.id = memory_summaries.companion_id and c.user_id = auth.uid())
  );

-- ---------- chat_sessions ----------
-- 重置既有策略以保持幂等
drop policy if exists "Users manage own sessions" on public.chat_sessions;
drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
drop policy if exists "chat_sessions_update_own" on public.chat_sessions;
drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;

create policy "chat_sessions_select_own" on public.chat_sessions
  for select using (auth.uid() = user_id);
create policy "chat_sessions_insert_own" on public.chat_sessions
  for insert with check (auth.uid() = user_id);
create policy "chat_sessions_update_own" on public.chat_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chat_sessions_delete_own" on public.chat_sessions
  for delete using (auth.uid() = user_id);

-- ---------- chat_messages ----------
drop policy if exists "Users manage own messages" on public.chat_messages;
drop policy if exists "chat_messages_select_own" on public.chat_messages;
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
drop policy if exists "chat_messages_update_own" on public.chat_messages;
drop policy if exists "chat_messages_delete_own" on public.chat_messages;

create policy "chat_messages_select_own" on public.chat_messages
  for select using (
    exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.user_id = auth.uid())
  );
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (
    exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.user_id = auth.uid())
  );
create policy "chat_messages_update_own" on public.chat_messages
  for update using (
    exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.user_id = auth.uid())
  );
create policy "chat_messages_delete_own" on public.chat_messages
  for delete using (
    exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.user_id = auth.uid())
  );

-- =====================================================================
-- 7. 表用途与三层记忆架构对照（注释）
-- =====================================================================
comment on table public.companions is
  '陪伴角色配置表。一个用户可创建多个角色（friend/lover）。所有记忆都挂在 companion_id 下。';
comment on table public.user_profiles is
  '【长期记忆 · 第3层】全量结构化档案（jsonb）。每个 companion 一份，存基本资料/偏好/重要的人/进行中的事/性格笔记等。';
comment on table public.memory_summaries is
  '【中期记忆 · 第2层】跨会话摘要。记录值得长期带着的事件与情绪节点，按 importance 1-5 排序淘汰。';
comment on table public.chat_sessions is
  '【短期记忆 · 第1层】会话容器。归属到某个 companion，承载一次连续对话。';
comment on table public.chat_messages is
  '【短期记忆 · 第1层】对话消息。role+content，按 session 聚合，作为最近上下文喂给模型。';
