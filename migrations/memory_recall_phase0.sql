-- Phase 0：语义召回最低相关度门槛
-- 初始阈值 0.55，仅作为上线前的保守起点，后续必须用真实回归集校准。
-- 保持原函数签名与返回结构，替换函数体即可；不改变现有记忆数据。

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
    + p_w_cosine * (1 - (m.embedding <=> p_query_embedding))
    + p_w_recency * power(0.5, extract(epoch from (now() - m.updated_at)) / 86400.0 / p_half_life_days)
    as score
  from public.memory_summaries m
  where m.companion_id = p_companion_id
    and p_query_embedding is not null
    and m.embedding is not null
    and 1 - (m.embedding <=> p_query_embedding) >= 0.55
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
    + p_w_cosine * (1 - (e.embedding <=> p_query_embedding))
    + p_w_recency * power(0.5, extract(epoch from (now() - e.occurred_at)) / 86400.0 / p_half_life_days)
    as score
  from public.relationship_events e
  where e.companion_id = p_companion_id
    and p_query_embedding is not null
    and e.embedding is not null
    and 1 - (e.embedding <=> p_query_embedding) >= 0.55
  order by score desc
  limit p_limit;
$$;
