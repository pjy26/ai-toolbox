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

### 2. 禁止在模块顶层初始化支付宝 SDK 而不检查环境变量
`lib/alipay.ts` 在模块顶层 `new AlipaySdk(...)`，如果缺少 `ALIPAY_APP_ID` 环境变量会导致构建崩溃。**不要修改这个文件的初始化方式**，确保环境变量已配置。

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

## 修改代码后验证
修改完推送前，建议本地跑一次 `npm run build` 确认无报错。
