-- 用户昵称字段 + 触发器更新
-- profiles.username 已存在，复用为昵称字段；这里只补一个更新触发器，让用户改 username 时也能用

-- 已经有 username 列，无需新增
-- 提供一个 RPC 让前端安全更新自己的 username
create or replace function public.update_my_nickname(p_nickname text)
returns void as $$
begin
  update public.profiles
  set username = p_nickname
  where id = auth.uid();
end;
$$ language plpgsql security definer;

-- 让前端能 select 自己的 username（已有 RLS，跳过）
