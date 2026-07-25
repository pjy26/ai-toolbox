# Amara (ai-toolbox) — Claude Code 协作备忘

> 本文档记录 Claude 在此仓库中必须遵守的规则。
> **每次完成代码改动后，必须同步更新本文档，使其始终反映最新状态。**

## 架构说明
- `app/` — Next.js 14 App Router 页面与 API 路由
- `components/` — React 组件
- `lib/` — 工具库（supabase、alipay、deepseek、orders）
- `lib/deepseek.ts` — 人设系统提示词定义（Amara 设定）
- `supabase/schema.sql` — 数据库结构

## 构建约束（硬性规则）

### 1. 使用 `useSearchParams()` 的组件必须包 Suspense
Next.js 14 静态导出时 `useSearchParams()` 会导致构建崩溃。凡是用了它的页面/组件，必须用 `<Suspense>` 包裹，且页面加 `export const dynamic = "force-dynamic"`。参考写法：
```tsx
"use client";
import { useSearchParams } from "next/navigation";
export default function ClientForm() { ... }
```

### 2. 支付宝 SDK 必须懒加载，禁止在模块顶层初始化
`lib/alipay.ts` 通过 `getSdk()` 懒加载 AlipaySdk。Next.js 构建期（collect page data）会 import 路由模块，此时环境变量未必就绪，模块顶层 `new AlipaySdk(...)` 会导致构建崩溃（Error: config.appId is required）。**不要把初始化挪回模块顶层**。

## 需要的环境变量（Vercel 后台已配置）
- ALIPAY_APP_ID
- ALIPAY_PRIVATE_KEY
- ALIPAY_PUBLIC_KEY
- ALIPAY_NOTIFY_URL
- ALIPAY_RETURN_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL

## 本次改动记录
- 2026-07-25 懒加载支付宝 SDK 修复 redeploy 构建崩溃（config.appId is required）
