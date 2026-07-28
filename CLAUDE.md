# ai-toolbox 项目构建规则

## 技术栈
- Next.js 14 (App Router)
- Vercel 部署
- Supabase 认证
- Tailwind CSS
- 支付宝沙箱支付

## 构建命令
```
npm run build
```
Vercel 构建时执行此命令，任何语法/类型/导入错误都会导致部署失败。

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

### 2. 支付宝 SDK 必须懒加载，禁止在模块顶层初始化
`lib/alipay.ts` 通过 `getSdk()` 懒加载 AlipaySdk。Next.js 构建期（collect page data）会 import 路由模块，此时环境变量未必就绪，模块顶层 `new AlipaySdk(...)` 会导致构建崩溃（Error: config.appId is required）。**不要把初始化挪回模块顶层**。

### 3. DeepSeek v4 是推理模型：思考 token 计入 max_tokens，上限给足
v4-pro/v4-flash 的思考（reasoning）token 与正文共享 max_tokens 额度：实测 max_tokens=200 时额度可被思考全部吃光，正文返回空（用户看到"没有回应"）。**不要关掉 thinking**（思考是 Amara 情绪细腻的核心），正确做法是给足 max_tokens——companion 和 greeting 目前都是 1000。任何调低 max_tokens 的改动都要先想清楚这条。

### 4. Embedding 走独立环境变量，失败必须静默降级
语义检索用 `lib/embedding.ts`（OpenAI 兼容端点，默认硅基流动 SiliconFlow 的 Qwen/Qwen3-Embedding-0.6B，免费、1024 维），环境变量是 EMBEDDING_API_KEY / EMBEDDING_BASE_URL / EMBEDDING_MODEL，**不要复用 OPENAI_BASE_URL**（那个指向 DeepSeek，没有 embedding 能力）。embedding 失败/超时一律返回 null 走降级路径（importance 排序），不能让记忆检索拖垮聊天。注意：向量维度 1024 与数据库 vector(1024) 绑定，换模型时必须同步改维度。

## 需要的环境变量（Vercel 后台已配置）
- ALIPAY_APP_ID
- ALIPAY_PRIVATE_KEY
- ALIPAY_PUBLIC_KEY
- ALIPAY_NOTIFY_URL
- ALIPAY_RETURN_URL
- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- OPENAI_BASE_URL
- OPENAI_MODEL
- EMBEDDING_API_KEY / EMBEDDING_BASE_URL / EMBEDDING_MODEL（语义记忆检索）
- BACKFILL_TOKEN（一次性 embedding 回填脚本的调用凭证）

## 修改代码后验证
修改完推送前，建议本地跑一次 `npm run build` 确认无报错。
