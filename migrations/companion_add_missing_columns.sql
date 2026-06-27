-- =====================================================================
-- 补丁：companions 表缺失列
-- 在 Supabase SQL Editor 中执行
-- =====================================================================

-- 1. last_active_at —— 最后活跃时间
alter table public.companions 
  add column if not exists last_active_at timestamptz default now();

-- 2. persona —— 人设关键词（gentle / playful / dominant 等）
alter table public.companions 
  add column if not exists persona text default 'gentle';

-- 3. persona_locked_at —— 人设锁定时间
alter table public.companions 
  add column if not exists persona_locked_at timestamptz;
