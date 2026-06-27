-- 恋人版 Amara 人格系统：扩展 companions 表
-- 幂等：所有操作用 if not exists / do $$

-- 1. persona 类型（性格锁定）
alter table public.companions
  add column if not exists persona text default 'gentle'
  check (persona in ('gentle','playful','quiet','clingy'));

-- 2. relationship_stage 阶段评分（0-100，由后端按对话轮次/天数推进）
alter table public.companions
  add column if not exists relationship_stage integer not null default 5;
-- 5 = 刚开始（暧昧期初段）；满 100 = 依恋期

-- 3. persona_locked_at：锁定后不变
alter table public.companions
  add column if not exists persona_locked_at timestamptz;

-- 4. last_active_at：用于"久别重逢"判断
alter table public.companions
  add column if not exists last_active_at timestamptz default now();

-- 5. relationship_events：你们之间发生过的事（角色侧记忆，jsonb 数组）
--    结构示例：[{ "ts": "2026-06-20T...", "event": "你给我讲了你怕黑", "importance": 3 }]
alter table public.companions
  add column if not exists relationship_events jsonb not null default '[]'::jsonb;

-- 6. 索引
create index if not exists idx_companions_user_active on public.companions(user_id, last_active_at);

comment on column public.companions.persona is '性格类型：gentle/playful/quiet/clingy';
comment on column public.companions.relationship_stage is '关系阶段评分 0-100，5初始 / 30 热恋 / 60 磨合 / 85 依恋';
comment on column public.companions.relationship_events is '角色侧记忆：你们之间发生过的事，jsonb 数组';
