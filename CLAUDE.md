# ai-toolbox 项目构建规则

## 技术栈
- Next.js 15.5.29（App Router）+ React 18 + TypeScript
- Tailwind CSS
- Supabase（Auth + Postgres + pgvector）
- DeepSeek API（OpenAI 兼容接口，`deepseek-v4-pro`）
- Waffo Pancake 订阅支付（Plus / Premium）
- Vercel 部署

## 构建与测试命令
```bash
npm run build   # Vercel 用的生产构建；语法/类型/导入错误会直接导致部署失败
npm test        # node:test + tsx，纯离线单元测试（当前 40 个）
```
- 本地 Node 20.9+（本机在 Node 22 验证）。
- 没有 `.env.local` 时 `npm run build` 会在预渲染阶段报 `supabaseUrl and supabaseKey are required`。至少需要 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`；占位值只能让构建通过，不代表登录、聊天、支付可用。

## 严禁事项

### 1. 禁止在页面组件顶层使用客户端 Hook
`useSearchParams()`、`usePathname()`、`useRouter()` 等 Next.js 客户端 Hook **必须**放在标记了 `"use client"` 的组件中，且包含 `useSearchParams()` 的组件必须用 `<Suspense>` 包裹。

正确写法：
```tsx
// page.tsx（服务端组件）
import { Suspense } from "react";
import ClientForm from "./ClientForm";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientForm />
    </Suspense>
  );
}

// ClientForm.tsx（客户端组件）
"use client";
import { useSearchParams } from "next/navigation";
export default function ClientForm() { ... }
```

### 2. 支付已经是 Waffo，不要再按支付宝改
- 代码里没有 `lib/alipay.ts`，也没有任何 `ALIPAY_*` 变量。历史文档里的"支付宝沙箱"已过期，支付走 **Waffo Pancake**。
- `lib/waffo.ts` 只在服务端读取密钥，支持 `WAFFO_PRIVATE_KEY`（多行 PEM）或 `WAFFO_PRIVATE_KEY_BASE64`；商品 ID 按 `WAFFO_PRODUCT_<PLAN_ID>` 动态读取，缺失会直接抛错，不要硬编码。
- `app/api/pay/waffo/webhook/route.ts` 必须用**原始请求体**验签，验签失败返回 401；随后校验 `storeId` 与 `environment`，并按 `waffo_webhook_events` 做幂等。
- 只有事件订单等于 `profiles.membership_provider_order_id` 时才允许改写会员权益，避免旧订阅的回调覆盖新订阅。
- `plus_trial` 是 $0.99 一次性体验（不自动续费）；`order.completed` 与 `subscription.payment_succeeded` 两种事件都要按试用支付处理。

### 3. DeepSeek v4 是推理模型：思考 token 计入 max_tokens，上限给足
v4-pro/v4-flash 的思考（reasoning）token 与正文共享 `max_tokens` 额度：实测 `max_tokens=200` 时额度可被思考全部吃光，正文返回空（用户看到"没有回应"）。**不要关掉 thinking**（思考是 Amara 情绪细腻的核心）。当前 `lib/companion-model.ts` 主调用 `max_tokens: 1600`，空正文的非思考回退 `1000`；greeting 复用同一函数。任何调低 `max_tokens` 的改动都要先想清楚这条。

### 4. Embedding 走独立环境变量，失败必须静默降级；模型在代码里锁死
语义检索用 `lib/embedding.ts`（OpenAI 兼容端点，默认硅基流动 SiliconFlow 的 BAAI/bge-large-zh-v1.5，官方无条件免费、1024 维），环境变量是 `EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL`，**不要复用 `OPENAI_BASE_URL`**（那个指向 DeepSeek，没有 embedding 能力）。**embedding 模型不写进环境变量，在代码里锁死**（`DEFAULT_MODEL`，不读 `EMBEDDING_MODEL`）：不同模型的向量空间不同，混进同一列检索就报废，换模型必须连数据库 vector 维度一起换并全量回填。embedding 失败/超时一律返回 null 走降级路径（importance 排序），不能让记忆检索拖垮聊天。

### 5. Companion harness 的统一时间预算
- 每次生成共享一个 22s deadline（`COMPANION_MODEL_DEADLINE_MS`）、流空闲 10s 看门狗（`COMPANION_STREAM_IDLE_TIMEOUT_MS`）；SDK 设 `maxRetries: 0`、`timeout: 20s`。
- **不要在路由里再叠加重试或恢复 SDK 默认重试**：路由 `maxDuration = 30`，叠加重试只会放大平台超时、重复计费和诊断困难。
- 空正文（或只有 reasoning）只允许一次 `thinking: disabled` 回退，且与主调用共享同一 deadline；`finish_reason` 为 `length` / `content_filter` / 缺失时不能当正常回答展示或落库。
- `reasoning_content` 永远不展示、不落库。

### 6. 会员等级是服务端权限边界
- Free：不限次数对话、基础记忆、Today / About You / 一位重要的人；Plus：Dreams、Letters、Moments、多维记忆分析。对话次数不是付费边界，功能才是。
- 判断统一走 `activeMembershipTier()`（`lib/admin-membership.ts`），服务端必须校验，不能只靠前端隐藏入口。
- 夜间 Dream 任务对 Free 账号直接跳过（`lib/dream-nightly.ts` 会读 `profiles` 会员字段），改夜间逻辑时别绕过这层。

### 7. 关系阶段推进有质量门槛和每日限速，两个参数是拍的初始值
阶段不再"聊了就涨"。`computeStageAdvance`（lib/amara-persona.ts）要求当日 `emotion_state.arousal >= STAGE_AROUSAL_THRESHOLD`（0.5，说明有实质情感卷入）才 +1，且每自然日（上海时区）最多 `STAGE_DAILY_CAP`（2）分，依赖 companions 表的 stage_date / stage_day_count 两列（migrations/stage_pacing.sql）。**这两个参数是没有数据支撑拍的初始值**，上线后根据用户反馈调：嫌升得太慢就抬 DAILY_CAP，嫌"随便聊聊也涨"就抬 THRESHOLD。免费账号对话不限次数，可用基础记忆、今天、关于你和一位重要的人；瞬间、梦境、信件和多维记忆分析属于 Plus。extract 同样写入 arousal，并按会员等级限制重要人物和共同瞬间。

## 需要的环境变量（Vercel 后台已配置，本地放 `.env.local`）
- 应用：`NEXT_PUBLIC_SITE_URL`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 服务端：`SUPABASE_SERVICE_ROLE_KEY`（仅服务端 admin 客户端使用，绝不能进入客户端 bundle）
- 管理后台：`ADMIN_EMAILS`、`ADMIN_USER_IDS`（逗号分隔的 /admin 白名单）
- 模型：`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`
- 语义检索：`EMBEDDING_API_KEY`、`EMBEDDING_BASE_URL`（模型锁死在代码里，不读 `EMBEDDING_MODEL`）
- 支付：`WAFFO_MERCHANT_ID`、`WAFFO_STORE_ID`、`WAFFO_ENVIRONMENT`、`WAFFO_PRIVATE_KEY` 或 `WAFFO_PRIVATE_KEY_BASE64`、`WAFFO_PRODUCT_PLUS_TRIAL` / `WAFFO_PRODUCT_PLUS_MONTHLY` / `WAFFO_PRODUCT_PLUS_YEARLY` / `WAFFO_PRODUCT_PREMIUM_MONTHLY` / `WAFFO_PRODUCT_PREMIUM_YEARLY`
- 定时任务：`CRON_SECRET`（GitHub Actions 调用 `/api/jobs/nightly`）、`NIGHTLY_JOB_TOKEN`（备用令牌）、`LETTER_GENERATION_TOKEN`、`LETTER_AUTO_GENERATE`

## 修改代码后验证
1. `npm test` —— 离线单元测试必须全绿。
2. `npm run build` —— 模拟 Vercel 构建，确认没有类型/导入/预渲染错误。
3. `git status` —— 确认没有把 `.env.local`、`.next` 等本地文件带进提交；推送前先 `git fetch` 看与 `origin/main` 的关系。

## 本机环境（2026-11 配置）
- Git：便携版 `C:\Users\21569\AppData\Local\Programs\MinGit\cmd\git.exe`（已加入用户 PATH）。
- Node：便携版 `C:\Users\21569\AppData\Local\Programs\node`（Node 22 + npm 10，已加入用户 PATH）。
- `.env.local` 目前是占位值，只保证构建/测试能跑；联调前替换成 Vercel 的真实值。
### 5. 关系阶段推进有质量门槛和每日限速，两个参数是拍的初始值
阶段不再"聊了就涨"。`computeStageAdvance`（lib/amara-persona.ts）要求当日 `emotion_state.arousal >= STAGE_AROUSAL_THRESHOLD`（0.5，说明有实质情感卷入）才 +1，且每自然日（上海时区）最多 `STAGE_DAILY_CAP`（2）分，依赖 companions 表的 stage_date / stage_day_count 两列（migrations/stage_pacing.sql）。**这两个参数是没有数据支撑拍的初始值**，上线后根据用户反馈调：嫌升得太慢就抬 DAILY_CAP，嫌"随便聊聊也涨"就抬 THRESHOLD。免费账号不限对话次数，使用基础记忆、今天、关于你和一位重要的人；瞬间、梦境、信件和多维记忆分析属于 Plus。extract 同样写入 arousal，并按会员等级限制重要人物和共同瞬间。
