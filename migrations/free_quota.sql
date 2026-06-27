-- 切换为订阅制：免费额度 + 会员状态
-- 保留 credits 字段（其他工具仍扣积分），新增 free_messages_used 统计免费陪伴对话次数

alter table public.profiles
  add column if not exists free_messages_used integer not null default 0;

-- 给 companion 用过的免费消息计数单独存一份（避免和其他工具的 credits 混淆）
-- 复用 free_messages_used 即可，前端在 companion 工具内每发一句 +1
