# 可靠聊天与可信记忆

## 安装和升级

在已配置 Supabase Auth、Postgres 和 pgvector 的环境使用下列入口。脚本只输出 SQL。先在独立 Supabase 项目验证，再把生成的 SQL 作为完整脚本在目标项目的 SQL Editor 执行。

- 空库运行 `node scripts/schema-plan.mjs fresh`。安装清单在 `migrations/install-order.json`，包括初始化、历史迁移以及可信记忆迁移。已存在业务表时使用升级路径。
- 已运行 `launch_security.sql` 并具备当前版本所有既有迁移的环境运行 `node scripts/schema-plan.mjs upgrade`。升级保留历史摘要、角色档案与聊天记录。历史摘要初始标为 legacy，不回放旧聊天，也不补造来源。
- 两条路径都包在一个事务中。成功后可查询 `select * from public.amara_schema_versions`，应有 `trusted_memory_v1`。权限、外键或前置迁移错误会使整个事务回滚。

## 发布顺序

1. 在预览环境验证 `npm ci`、`npm test`、`npm run build`。离线数据库测试使用 PGlite + pgvector，并模拟 Supabase 提供的角色与 auth.users。
2. 备份正式库，记录旧应用部署版本。在同一维护窗口先执行升级，再发布匹配的应用。新权限把摘要写入交给服务端，旧应用的抽取器不能与新版本并行写入。
3. Vercel 与 GitHub Actions 的 CRON_SECRET 必须一致。回复提交后先尝试处理当前轮，memory.yml 每五分钟请求一次受保护的补跑接口，实际触发时间受调度平台影响。
4. 用测试账号在桌面和手机完成下列验收。核对 Supabase 回调域名、邮箱注册和重置、Waffo 支付回调等已有上线项见 launch-readiness.md。数据库回归不能替代真实模型和线上服务验收。
5. 若发布中断，停止写入并优先恢复到匹配当前数据库的应用版本。若必须回到升级前状态，需要协调数据库恢复点和旧应用部署；恢复备份会丢失该时间点后的写入，应先核对增量并确认。不要在生产库重跑 fresh。

## 验收场景

- 首次发送、中途断网、恢复后重发同一内容。相同 client_turn_id 在同一用户与角色下只提交一对消息；成功回复刷新后可见。另发相同文案使用新的 ID。
- 说“我住在上海。”，待抽取完成后打开「记忆 → 查看来源」。新事实可定位到这一轮的用户原文。再说“我搬到杭州了。”，检查归入同一事实键后旧值不再参与召回。用中英文分别验收真实模型的选键效果。
- 手动纠正、并行编辑、删除，验证新版覆盖旧版、冲突返回 409、过期页面不会删错。删除后该记忆文本从活动摘要和版本记录移除，已识别的来源轮次不再用于聊天上下文和新梦境/信件的对话材料。原始聊天记录、已经发布的梦境和信件可以继续在各自页面查看。历史数据没有逐条来源，无法据此排除旧聊天。
- 回复完成后关页，确认待处理任务仍可恢复。用 Free 和 Plus 两种账号验证会员权限，切换角色核对隔离。关闭记忆时不能新建任务，已领取但尚未提交的任务不能写回。
- 模型、Embedding 或数据库短暂不可用时，检查请求与任务状态。Embedding 失败可保存无向量的逐字事实。模型重复或不确定的语义判断仍可能漏记，应以来源和用户纠正为准。

## 运维

`chat_turns` 同时是发送收据和逐轮任务记录，每条任务绑定一对确定的消息 ID。回复和待抽取任务在同一事务中提交。运行租约 90 秒；正常失败按退避间隔重试，达到上限的任务保留以便检查。抽取只处理已提交的新轮次。后台接口不接收浏览器提供的消息或角色身份。

仅在可信数据库管理环境查看状态。以下查询不读取对话或记忆正文。

```sql
select job_state, count(*), min(created_at) as oldest
from public.chat_turns group by job_state;

select id, attempts, next_attempt_at
from public.chat_turns where job_state='failed' order by created_at limit 50;
```

修复上游服务后，可对核对过的单个失败任务重新入队，再运行 GitHub Actions 的 Recover pending memory jobs。清理来源、记忆开关与提交租约仍会在入库时校验。

```sql
update public.chat_turns set job_state='pending', attempts=0,
  next_attempt_at=now(), job_lease=null
where id='<已核对的任务 UUID>' and job_state='failed' and allow_memory and not excluded;
```
