-- Amara 情绪状态字段（Step 0：占位；Step 1 由 extract 路由动态写入）
-- 幂等执行

alter table public.companions
  add column if not exists emotion_state jsonb not null default '{}'::jsonb;

comment on column public.companions.emotion_state is
  '情绪状态 JSONB。Step 0 占位为空对象，prompt 由 persona+时间推导基线；Step 1 接入动态情绪抽取后写入。结构示例：{"joy":0.6,"affection":0.7,"calm":0.5}';
