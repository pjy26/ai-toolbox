-- =====================================================================
-- 语义记忆升级：pgvector embedding + relationship_events 独立表
-- 2026-07-28
-- 数据量小（几十条），不建 HNSW/IVFFlat 索引，暴力扫描更准更简单
-- =====================================================================

-- 1. 启用 pgvector
create extension if not exists vector;

-- 2. memory_summaries 增加 embedding 列（允许 NULL，回填遗漏时检索 SQL 优雅降级）
alter table public.memory_summaries
  add column if not exists embedding vector(1024);

-- 3. relationship_events 从 companions 的 jsonb 占位升级为独立表
--    （companions 上的旧 jsonb 字段全行为空、代码无引用，已在本次升级中删除）
create table if not exists public.relationship_events (
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.companions(id) on delete cascade,
  description text not null,
  event_type text,
  occurred_at timestamptz not null default now(),
  importance smallint not null default 3,
  embedding vector(1024),
  created_at timestamptz not null default now()
);

-- 4. RLS —— 与 memory_summaries 一致：通过 companion_id → companions.user_id 归属
alter table public.relationship_events enable row level security;

drop policy if exists "relationship_events_select_own" on public.relationship_events;
drop policy if exists "relationship_events_insert_own" on public.relationship_events;
drop policy if exists "relationship_events_update_own" on public.relationship_events;
drop policy if exists "relationship_events_delete_own" on public.relationship_events;

create policy "relationship_events_select_own" on public.relationship_events
  for select using (
    exists (select 1 from public.companions c where c.id = relationship_events.companion_id and c.user_id = auth.uid())
  );
create policy "relationship_events_insert_own" on public.relationship_events
  for insert with check (
    exists (select 1 from public.companions c where c.id = relationship_events.companion_id and c.user_id = auth.uid())
  );
create policy "relationship_events_update_own" on public.relationship_events
  for update using (
    exists (select 1 from public.companions c where c.id = relationship_events.companion_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.companions c where c.id = relationship_events.companion_id and c.user_id = auth.uid())
  );
create policy "relationship_events_delete_own" on public.relationship_events
  for delete using (
    exists (select 1 from public.companions c where c.id = relationship_events.companion_id and c.user_id = auth.uid())
  );

-- =====================================================================
-- 5. 混合排序检索函数：w1·importance + w2·cosine + w3·recency
--    NULL embedding 保护：该行 cosine 项记 0，只按 importance+recency 排
--    p_query_embedding 传 NULL 时整体退化为 importance+recency（降级路径）
--    security invoker（默认）：RLS 对调用者生效，不会越权读到别人的记忆
-- =====================================================================
create or replace function public.match_memory_summaries(
  p_companion_id uuid,
  p_query_embedding vector(1024) default null,
  p_limit int default 6,
  p_w_importance float default 0.3,
  p_w_cosine float default 0.5,
  p_w_recency float default 0.2,
  p_half_life_days float default 30
)
returns table (id uuid, summary text, importance smallint, updated_at timestamptz, score float)
language sql stable as $$
  select
    m.id,
    m.summary,
    m.importance,
    m.updated_at,
    p_w_importance * (m.importance::float / 5.0)
    + p_w_cosine * case
        when p_query_embedding is not null and m.embedding is not null
        then 1 - (m.embedding <=> p_query_embedding)
        else 0
      end
    + p_w_recency * power(0.5, extract(epoch from (now() - m.updated_at)) / 86400.0 / p_half_life_days)
    as score
  from public.memory_summaries m
  where m.companion_id = p_companion_id
  order by score desc
  limit p_limit;
$$;

create or replace function public.match_relationship_events(
  p_companion_id uuid,
  p_query_embedding vector(1024) default null,
  p_limit int default 3,
  p_w_importance float default 0.3,
  p_w_cosine float default 0.5,
  p_w_recency float default 0.2,
  p_half_life_days float default 30
)
returns table (id uuid, description text, event_type text, importance smallint, occurred_at timestamptz, score float)
language sql stable as $$
  select
    e.id,
    e.description,
    e.event_type,
    e.importance,
    e.occurred_at,
    p_w_importance * (e.importance::float / 5.0)
    + p_w_cosine * case
        when p_query_embedding is not null and e.embedding is not null
        then 1 - (e.embedding <=> p_query_embedding)
        else 0
      end
    + p_w_recency * power(0.5, extract(epoch from (now() - e.occurred_at)) / 86400.0 / p_half_life_days)
    as score
  from public.relationship_events e
  where e.companion_id = p_companion_id
  order by score desc
  limit p_limit;
$$;

-- =====================================================================
-- 6. 去重函数：返回与目标 embedding 的最高 cosine 相似度
--    extract 每轮都跑，> 0.9 视为重复跳过写入
-- =====================================================================
create or replace function public.memory_max_similarity(
  p_companion_id uuid,
  p_embedding vector(1024)
)
returns float
language sql stable as $$
  select coalesce(max(1 - (m.embedding <=> p_embedding)), 0)
  from public.memory_summaries m
  where m.companion_id = p_companion_id and m.embedding is not null;
$$;

create or replace function public.event_max_similarity(
  p_companion_id uuid,
  p_embedding vector(1024)
)
returns float
language sql stable as $$
  select coalesce(max(1 - (e.embedding <=> p_embedding)), 0)
  from public.relationship_events e
  where e.companion_id = p_companion_id and e.embedding is not null;
$$;
