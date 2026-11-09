"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, ArrowLeft, Crown, Gift, LogIn, LogOut, MessageCircle, RefreshCw, Search, ShieldCheck, Users, WalletCards, XCircle } from "lucide-react";
import type { CheckoutPlanId } from "@/lib/membership-plans";

type PlanId = CheckoutPlanId;

type UserSignals = {
  chatReplies: number;
  memoryExtracts: number;
  chatDays: number;
  lastActiveAt: string | null;
  lastError: { code: string; at: string } | null;
  paywallViews: number;
  quotaExhausted: number;
};

type ProductEvent = {
  id: string;
  user_id: string;
  companion_id: string | null;
  event_name: string;
  locale: string | null;
  metadata: Record<string, string | number>;
  created_at: string;
};

type AdminUser = {
  id: string;
  email: string | null;
  lastSignInAt: string | null;
  signals: UserSignals;
  profile: {
    id: string;
    username: string | null;
    membership_type: string | null;
    membership_expires_at: string | null;
    membership_provider_order_id: string | null;
    membership_auto_renew: boolean;
    manual_membership_type: PlanId | null;
    manual_membership_expires_at: string | null;
    manual_membership_granted_at: string | null;
    manual_membership_reason: string | null;
    created_at: string | null;
    free_messages_used: number | null;
  } | null;
  waffo: {
    provider_order_id: string | null;
    plan_id: PlanId | null;
    subscription_status: string | null;
    current_period_end: string | null;
    auto_renew: boolean;
    status: string;
  } | null;
};

type Overview = {
  stats: {
    totalUsers: number;
    paidMembers: number;
    manualMembers: number;
    waffoPaidOrders: number;
    returningChatters: number;
    usersWithMemory: number;
    recentErrorUsers: number;
  };
  diagnosticsAvailable: boolean;
  diagnosticsError: string | null;
  diagnosticsTruncated: boolean;
  users: AdminUser[];
  recentActions: Array<{
    id: string;
    admin_user_id: string;
    target_user_id: string;
    action: "grant" | "revoke";
    plan_id: PlanId | null;
    expires_at: string | null;
    reason: string;
    created_at: string;
  }>;
  recentEvents: ProductEvent[];
};

const planNames: Record<string, string> = { weekly: "旧版 Plus 周卡", monthly: "旧版 Plus 月卡", yearly: "旧版 Plus 年卡", plus_trial: "Plus 7 天体验", plus_monthly: "Plus 月卡", plus_yearly: "Plus 年卡", premium_monthly: "Premium 月卡", premium_yearly: "Premium 年卡" };
const subscriptionStatusNames: Record<string, string> = { active: "已生效", pending: "待支付", paid: "已支付", trialing: "试用中", past_due: "逾期未付款", unpaid: "未支付", incomplete: "未完成", canceled: "已取消", cancelled: "已取消", expired: "已过期", paused: "已暂停" };
const productEventNames: Record<string, string> = { companion_created: "创建陪伴档案", companion_switched: "切换陪伴档案", chat_opened: "打开对话", chat_reply_completed: "对话回复成功", chat_reply_failed: "对话回复失败", memory_extract_completed: "记忆保存成功", memory_extract_failed: "记忆保存失败", paywall_viewed: "查看会员页", checkout_started: "开始结账", checkout_failed: "结账失败", quota_exhausted: "额度已用尽" };
const adminErrorMessages: Record<string, string> = {
  "Invalid administrator email or password": "管理员邮箱或密码不正确。",
  "Email and password are required": "请输入邮箱和密码。",
  "Invalid JSON body": "请求格式不正确。",
  "A valid action and userId are required": "操作或用户信息无效。",
  "A valid planId is required": "请选择有效的会员套餐。",
  "User not found": "未找到该用户。",
  "Membership changed, but the audit record could not be saved": "会员信息已修改，但操作记录保存失败。",
};
const planDays: Record<PlanId, number> = { plus_trial: 7, plus_monthly: 30, plus_yearly: 365, premium_monthly: 30, premium_yearly: 365 };
const grantPlans = Object.keys(planDays) as PlanId[];

function activeUntil(value: string | null | undefined) {
  return !!value && Date.parse(value) > Date.now();
}

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

function planName(value: string | null | undefined) {
  if (!value) return "未知套餐";
  return planNames[value] || value;
}

function subscriptionStatusName(value: string | null | undefined) {
  if (!value) return "—";
  return subscriptionStatusNames[value] || value;
}

function productEventName(value: string) {
  return productEventNames[value] || value.replaceAll("_", " ");
}

function localeName(value: string) {
  if (value === "zh") return "中文";
  if (value === "en") return "英文";
  return value;
}

function adminErrorMessage(cause: unknown, fallback: string) {
  const message = cause instanceof Error ? cause.message : "";
  return adminErrorMessages[message] || fallback;
}

function productEventDetail(event: ProductEvent) {
  if (event.metadata.reason) {
    if (event.metadata.reason === "checkout_request_failed") return "结账请求失败";
    return String(event.metadata.reason);
  }
  if (event.metadata.status) return String(event.metadata.status);
  if (event.metadata.planId) return planName(String(event.metadata.planId));
  return null;
}

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [planId, setPlanId] = useState<PlanId>("plus_monthly");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setData(null);
        throw new Error(result.error || "无法加载管理后台。");
      }
      setData(result);
    } catch (cause) {
      setError(adminErrorMessage(cause, "无法加载管理后台，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const users = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.users || [];
    return (data?.users || []).filter((user) =>
      [user.email, user.profile?.username, user.id].some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [data, query]);
  const selected = data?.users.find((user) => user.id === selectedId) || null;

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "管理员登录失败。");
      setPassword("");
      await load();
    } catch (cause) {
      setError(adminErrorMessage(cause, "管理员登录失败，请稍后重试。"));
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE" });
      if (!response.ok) throw new Error("退出登录失败。");
      setData(null);
      setSelectedId("");
      setNotice("");
      setError("");
    } catch {
      setError("退出登录失败，请稍后重试。");
    } finally {
      setSigningOut(false);
    }
  }

  async function changeMembership(action: "grant" | "revoke") {
    if (!selected) return;
    if (action === "revoke" && !window.confirm("确定仅撤销该用户的赠送会员吗？其 Waffo 付费订阅不会受到影响。")) return;
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId: selected.id, planId, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "会员信息更新失败。");
      setNotice(action === "grant"
        ? `${planName(planId)}赠送会员已生效，有效期至 ${formatDate(result.expiresAt, true)}。`
        : "赠送会员已撤销，Waffo 付费权益未发生变化。");
      setReason("");
      await load();
    } catch (cause) {
      setError(adminErrorMessage(cause, "会员信息更新失败，请稍后重试。"));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return <main lang="zh-CN" className="flex min-h-screen items-center justify-center bg-[#f7f4ee] text-sm text-[#716a60]">正在加载管理后台…</main>;
  }

  if (!data) {
    return (
      <main lang="zh-CN" className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-6 py-12 text-[#37332d]">
        <div className="w-full max-w-md border border-[#ded7cc] bg-white p-8">
          <ShieldCheck className="h-8 w-8 text-[#9e4837]" />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#94513f]">Amara 管理后台</p>
          <h1 className="mt-2 font-serif text-3xl">管理员登录</h1>
          <p className="mt-3 text-sm leading-6 text-[#716a60]">此登录与 Amara 对话账号相互独立。在此处登录或退出，不会改变对话账号的登录状态。</p>
          {error && <div role="alert" className="mt-5 border border-[#e1b7ae] bg-[#fff4f1] px-4 py-3 text-sm text-[#8c392c]">{error}</div>}
          <form onSubmit={(event) => void signIn(event)} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#716a60]">
              管理员邮箱
              <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-12 w-full border border-[#d8cfc2] bg-[#fbf9f5] px-3 text-sm normal-case tracking-normal outline-none focus:border-[#9e4837]" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#716a60]">
              密码
              <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-12 w-full border border-[#d8cfc2] bg-[#fbf9f5] px-3 text-sm normal-case tracking-normal outline-none focus:border-[#9e4837]" />
            </label>
            <button disabled={signingIn} className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#9e4837] px-5 text-sm font-semibold text-white disabled:opacity-50"><LogIn className="h-4 w-4" />{signingIn ? "正在登录…" : "登录管理后台"}</button>
          </form>
          <Link href="/app" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#745f52]"><ArrowLeft className="h-4 w-4" /> 返回用户应用</Link>
        </div>
      </main>
    );
  }

  return (
    <main lang="zh-CN" className="min-h-screen bg-[#f7f4ee] text-[#37332d]">
      <header className="border-b border-[#ded7cc] bg-[#fbf9f5]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94513f]">Amara 管理后台</p>
            <h1 className="mt-1 font-serif text-3xl">会员与产品运行状况</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 border border-[#d8cfc2] bg-white px-4 text-sm font-semibold hover:bg-[#f4eee6]">
              <RefreshCw className="h-4 w-4" /> 刷新
            </button>
            <Link href="/app" className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-[#745f52]"><ArrowLeft className="h-4 w-4" /> 用户应用</Link>
            <button disabled={signingOut} onClick={() => void signOut()} className="inline-flex min-h-11 items-center gap-2 border border-[#d8cfc2] bg-white px-4 text-sm font-semibold text-[#8d3f30] hover:bg-[#f4eee6] disabled:opacity-50"><LogOut className="h-4 w-4" />{signingOut ? "正在退出…" : "退出登录"}</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {error && <div className="mb-5 border border-[#e1b7ae] bg-[#fff4f1] px-4 py-3 text-sm text-[#8c392c]">{error}</div>}
        {notice && <div className="mb-5 border border-[#b8cfb2] bg-[#f2f8ef] px-4 py-3 text-sm text-[#3e6937]">{notice}</div>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="会员概览">
          <Stat icon={<Users className="h-5 w-5" />} label="用户总数" value={data?.stats.totalUsers || 0} />
          <Stat icon={<Crown className="h-5 w-5" />} label="有效付费会员" value={data?.stats.paidMembers || 0} />
          <Stat icon={<Gift className="h-5 w-5" />} label="有效赠送会员" value={data?.stats.manualMembers || 0} />
          <Stat icon={<WalletCards className="h-5 w-5" />} label="Waffo 付费订单" value={data?.stats.waffoPaidOrders || 0} />
        </section>
        <section className="mt-4 grid gap-4 sm:grid-cols-3" aria-label="最近账号的产品运行状况">
          <Stat icon={<MessageCircle className="h-5 w-5" />} label="对话达 2 天及以上" value={data?.stats.returningChatters || 0} />
          <Stat icon={<Activity className="h-5 w-5" />} label="成功保存记忆的用户" value={data?.stats.usersWithMemory || 0} />
          <Stat icon={<AlertCircle className="h-5 w-5" />} label="近 7 天出现错误的用户" value={data?.stats.recentErrorUsers || 0} />
        </section>
        {!data?.diagnosticsAvailable && <div role="status" className="mt-4 border border-[#e1b7ae] bg-[#fff4f1] px-4 py-3 text-sm text-[#8c392c]">数据库迁移完成后才能使用产品诊断，会员管理工具不受影响。</div>}
        {data?.diagnosticsTruncated && <p className="mt-4 text-xs text-[#817a70]">指标根据这 50 个账号最近的 2,000 条事件计算。</p>}

        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="border border-[#ded7cc] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e0d6] px-5 py-4">
              <div>
                <h2 className="font-serif text-2xl">用户</h2>
                <p className="mt-1 text-xs text-[#817a70]">最近 {data?.users.length || 0} 个账号 · 此处不显示聊天内容</p>
              </div>
              <label className="flex min-h-10 min-w-56 items-center gap-2 border border-[#d8cfc2] bg-[#fbf9f5] px-3 text-sm">
                <Search className="h-4 w-4 text-[#817a70]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="邮箱、名称或用户 ID" className="w-full bg-transparent outline-none" />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-[#f8f5ef] text-xs uppercase tracking-wide text-[#817a70]">
                  <tr><th className="px-5 py-3">用户</th><th className="px-4 py-3">Supabase 会员</th><th className="px-4 py-3">Waffo</th><th className="px-4 py-3">赠送会员</th><th className="px-4 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-[#eee8df]">
                  {users.map((user) => {
                    const profile = user.profile;
                    const paidActive = activeUntil(profile?.membership_expires_at) && profile?.membership_type !== "free";
                    const manualActive = activeUntil(profile?.manual_membership_expires_at);
                    return (
                      <tr key={user.id} className={selectedId === user.id ? "bg-[#fbf2e9]" : "hover:bg-[#fcfaf7]"}>
                        <td className="px-5 py-4"><p className="font-medium">{user.profile?.username || user.email || "未命名用户"}</p><p className="mt-1 text-xs text-[#817a70]">{user.email || user.id}</p></td>
                        <td className="px-4 py-4"><Status active={paidActive} label={paidActive ? `${planName(profile?.membership_type)} · 有效期至 ${formatDate(profile?.membership_expires_at)}` : "暂无有效付费会员"} /></td>
                        <td className="px-4 py-4"><p>{subscriptionStatusName(user.waffo?.subscription_status)}</p><p className="mt-1 text-xs text-[#817a70]">{user.waffo ? `${user.waffo.auto_renew ? "自动续费" : "不自动续费"} · ${planName(user.waffo.plan_id)}` : "暂无 Waffo 订单"}</p></td>
                        <td className="px-4 py-4"><Status active={manualActive} label={manualActive ? `${planName(profile?.manual_membership_type || "plus_monthly")} · 有效期至 ${formatDate(profile?.manual_membership_expires_at)}` : "无"} /></td>
                        <td className="px-4 py-4 text-right"><button onClick={() => setSelectedId(user.id)} className="min-h-9 border border-[#d8cfc2] px-3 text-xs font-semibold hover:border-[#9e4837] hover:text-[#9e4837]">管理</button></td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-[#817a70]">没有匹配的用户。</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="border border-[#ded7cc] bg-white p-5 xl:sticky xl:top-6">
            <div className="flex items-center gap-3"><Gift className="h-5 w-5 text-[#9e4837]" /><h2 className="font-serif text-2xl">赠送会员</h2></div>
            {selected ? (
              <>
                <div className="mt-5 border-y border-[#e7e0d6] py-4"><p className="font-medium">{selected.profile?.username || selected.email}</p><p className="mt-1 break-all text-xs text-[#817a70]">{selected.email || selected.id}</p></div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Signal label="回复次数" value={selected.signals.chatReplies} />
                  <Signal label="对话天数" value={selected.signals.chatDays} />
                  <Signal label="记忆保存次数" value={selected.signals.memoryExtracts} />
                  <Signal label="会员页浏览次数" value={selected.signals.paywallViews} />
                  <Signal label="额度耗尽次数" value={selected.signals.quotaExhausted} />
                  <div><p className="text-xs text-[#817a70]">最近活跃</p><p className="mt-1 text-xs font-medium">{formatDate(selected.signals.lastActiveAt, true)}</p></div>
                </div>
                {selected.signals.lastError && <div className="mt-4 border border-[#e1b7ae] bg-[#fff4f1] p-3 text-xs text-[#8c392c]"><p className="font-semibold">最近错误：{selected.signals.lastError.code}</p><p className="mt-1">{formatDate(selected.signals.lastError.at, true)}</p></div>}
                <p className="mt-3 text-xs leading-5 text-[#817a70]">仅展示运行指标，此后台不提供任何对话或记忆正文。</p>
                <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-[#716a60]">赠送时长</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {grantPlans.map((id) => <button key={id} onClick={() => setPlanId(id)} className={`min-h-11 border text-sm font-semibold ${planId === id ? "border-[#9e4837] bg-[#f9ece4] text-[#8d3f30]" : "border-[#d8cfc2]"}`}>{planDays[id]} 天</button>)}
                </div>
                <label htmlFor="reason" className="mt-5 block text-xs font-semibold uppercase tracking-wide text-[#716a60]">内部原因</label>
                <textarea id="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} placeholder="客服补偿、测试、活动推广…" className="mt-2 w-full border border-[#d8cfc2] bg-[#fbf9f5] p-3 text-sm outline-none focus:border-[#9e4837]" />
                <button disabled={saving} onClick={() => void changeMembership("grant")} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-[#9e4837] px-4 text-sm font-semibold text-white disabled:opacity-50"><Gift className="h-4 w-4" />{saving ? "正在保存…" : `立即赠送 ${planDays[planId]} 天`}</button>
                <button disabled={saving || !activeUntil(selected.profile?.manual_membership_expires_at)} onClick={() => void changeMembership("revoke")} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-[#d8cfc2] px-4 text-sm font-semibold disabled:opacity-40"><XCircle className="h-4 w-4" />撤销赠送会员</button>
                <p className="mt-4 text-xs leading-5 text-[#817a70]">再次赠送将延长当前赠送会员的有效期。这些操作不会创建、取消或修改 Waffo 订阅。</p>
              </>
            ) : <p className="mt-5 text-sm leading-6 text-[#817a70]">选择用户旁边的“管理”，即可赠送或撤销赠送会员。</p>}
          </aside>
        </div>

        <section className="mt-8 border border-[#ded7cc] bg-white p-5">
          <h2 className="font-serif text-2xl">最近产品事件</h2>
          <p className="mt-1 text-xs text-[#817a70]">仅显示功能使用情况和错误代码，不显示消息、记忆、梦境或信件内容。</p>
          <div className="mt-4 divide-y divide-[#eee8df]">
            {data?.recentEvents.map((event) => {
              const actor = data.users.find((user) => user.id === event.user_id);
              const detail = productEventDetail(event);
              return <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><p className="font-medium">{productEventName(event.event_name)}</p><p className="mt-1 text-xs text-[#817a70]">{actor?.email || event.user_id}{event.locale ? ` · ${localeName(event.locale)}` : ""}{event.companion_id ? " · 独立档案" : ""}</p></div><div className="text-right text-xs text-[#817a70]">{detail && <p className="font-semibold text-[#8c392c]">{detail}</p>}<p className="mt-1">{formatDate(event.created_at, true)}</p></div></div>;
            })}
            {!data?.recentEvents.length && <p className="py-5 text-sm text-[#817a70]">暂无产品事件。诊断迁移完成后，新活动将显示在这里。</p>}
          </div>
        </section>

        <section className="mt-8 border border-[#ded7cc] bg-white p-5">
          <h2 className="font-serif text-2xl">最近管理操作</h2>
          <div className="mt-4 divide-y divide-[#eee8df]">
            {data?.recentActions.map((action) => {
              const target = data.users.find((user) => user.id === action.target_user_id);
              return <div key={action.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><span className={`font-semibold ${action.action === "grant" ? "text-[#3e6937]" : "text-[#9e4837]"}`}>{action.action === "grant" ? "已赠送" : "已撤销"}</span><span className="ml-2">{target?.email || action.target_user_id}</span>{action.reason && <p className="mt-1 text-xs text-[#817a70]">{action.reason}</p>}</div><div className="text-right text-xs text-[#817a70]"><p>{action.plan_id ? `${planName(action.plan_id)} · 有效期至 ${formatDate(action.expires_at)}` : "仅赠送会员"}</p><p className="mt-1">{formatDate(action.created_at, true)}</p></div></div>;
            })}
            {!data?.recentActions.length && <p className="py-5 text-sm text-[#817a70]">暂无人工会员操作。</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="border border-[#ded7cc] bg-white p-5"><div className="flex items-center justify-between text-[#94513f]">{icon}<span className="text-3xl font-semibold text-[#37332d]">{value}</span></div><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#817a70]">{label}</p></div>;
}

function Signal({ label, value }: { label: string; value: number }) {
  return <div><p className="text-xs text-[#817a70]">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function Status({ active, label }: { active: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-2 text-xs ${active ? "text-[#3e6937]" : "text-[#817a70]"}`}><span className={`h-2 w-2 rounded-full ${active ? "bg-[#65945b]" : "bg-[#c8c0b5]"}`} />{label}</span>;
}
