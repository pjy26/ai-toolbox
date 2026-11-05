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

const planNames: Record<string, string> = { weekly: "Legacy Plus Weekly", monthly: "Legacy Plus Monthly", yearly: "Legacy Plus Yearly", plus_trial: "Plus Trial", plus_monthly: "Plus Monthly", plus_yearly: "Plus Yearly", premium_monthly: "Premium Monthly", premium_yearly: "Premium Yearly" };
const planDays: Record<PlanId, number> = { plus_trial: 7, plus_monthly: 30, plus_yearly: 365, premium_monthly: 30, premium_yearly: 365 };
const grantPlans = Object.keys(planDays) as PlanId[];

function activeUntil(value: string | null | undefined) {
  return !!value && Date.parse(value) > Date.now();
}

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
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
        throw new Error(result.error || "Could not load the admin dashboard");
      }
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the admin dashboard");
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
      if (!response.ok) throw new Error(result.error || "Administrator sign-in failed");
      setPassword("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Administrator sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Sign out failed");
      setData(null);
      setSelectedId("");
      setNotice("");
      setError("");
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  async function changeMembership(action: "grant" | "revoke") {
    if (!selected) return;
    if (action === "revoke" && !window.confirm("Revoke only this user’s complimentary membership? Their Waffo-paid subscription will not be changed.")) return;
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
      if (!response.ok) throw new Error(result.error || "Membership update failed");
      setNotice(action === "grant"
        ? `${planNames[planId]} complimentary membership is active until ${formatDate(result.expiresAt, true)}.`
        : "Complimentary membership revoked. Waffo-paid entitlement was not changed.");
      setReason("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Membership update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] text-sm text-[#716a60]">Loading administration…</main>;
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-6 py-12 text-[#37332d]">
        <div className="w-full max-w-md border border-[#ded7cc] bg-white p-8">
          <ShieldCheck className="h-8 w-8 text-[#9e4837]" />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#94513f]">Amara administration</p>
          <h1 className="mt-2 font-serif text-3xl">Administrator sign in</h1>
          <p className="mt-3 text-sm leading-6 text-[#716a60]">This login is separate from your Amara chat account. Signing in or out here will not change your chat session.</p>
          {error && <div role="alert" className="mt-5 border border-[#e1b7ae] bg-[#fff4f1] px-4 py-3 text-sm text-[#8c392c]">{error}</div>}
          <form onSubmit={(event) => void signIn(event)} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#716a60]">
              Administrator email
              <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-12 w-full border border-[#d8cfc2] bg-[#fbf9f5] px-3 text-sm normal-case tracking-normal outline-none focus:border-[#9e4837]" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#716a60]">
              Password
              <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-12 w-full border border-[#d8cfc2] bg-[#fbf9f5] px-3 text-sm normal-case tracking-normal outline-none focus:border-[#9e4837]" />
            </label>
            <button disabled={signingIn} className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#9e4837] px-5 text-sm font-semibold text-white disabled:opacity-50"><LogIn className="h-4 w-4" />{signingIn ? "Signing in…" : "Sign in to administration"}</button>
          </form>
          <Link href="/app" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#745f52]"><ArrowLeft className="h-4 w-4" /> Back to user app</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#37332d]">
      <header className="border-b border-[#ded7cc] bg-[#fbf9f5]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94513f]">Amara administration</p>
            <h1 className="mt-1 font-serif text-3xl">Members & product health</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 border border-[#d8cfc2] bg-white px-4 text-sm font-semibold hover:bg-[#f4eee6]">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <Link href="/app" className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-[#745f52]"><ArrowLeft className="h-4 w-4" /> User app</Link>
            <button disabled={signingOut} onClick={() => void signOut()} className="inline-flex min-h-11 items-center gap-2 border border-[#d8cfc2] bg-white px-4 text-sm font-semibold text-[#8d3f30] hover:bg-[#f4eee6] disabled:opacity-50"><LogOut className="h-4 w-4" />{signingOut ? "Signing out…" : "Sign out"}</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {error && <div className="mb-5 border border-[#e1b7ae] bg-[#fff4f1] px-4 py-3 text-sm text-[#8c392c]">{error}</div>}
        {notice && <div className="mb-5 border border-[#b8cfb2] bg-[#f2f8ef] px-4 py-3 text-sm text-[#3e6937]">{notice}</div>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Membership overview">
          <Stat icon={<Users className="h-5 w-5" />} label="Total users" value={data?.stats.totalUsers || 0} />
          <Stat icon={<Crown className="h-5 w-5" />} label="Active paid members" value={data?.stats.paidMembers || 0} />
          <Stat icon={<Gift className="h-5 w-5" />} label="Active complimentary" value={data?.stats.manualMembers || 0} />
          <Stat icon={<WalletCards className="h-5 w-5" />} label="Waffo paid orders" value={data?.stats.waffoPaidOrders || 0} />
        </section>
        <section className="mt-4 grid gap-4 sm:grid-cols-3" aria-label="Product health for latest accounts">
          <Stat icon={<MessageCircle className="h-5 w-5" />} label="Chatting on 2+ days" value={data?.stats.returningChatters || 0} />
          <Stat icon={<Activity className="h-5 w-5" />} label="Memory successfully saved" value={data?.stats.usersWithMemory || 0} />
          <Stat icon={<AlertCircle className="h-5 w-5" />} label="Errors in the last 7 days" value={data?.stats.recentErrorUsers || 0} />
        </section>
        {!data?.diagnosticsAvailable && <div role="status" className="mt-4 border border-[#e1b7ae] bg-[#fff4f1] px-4 py-3 text-sm text-[#8c392c]">Product diagnostics are unavailable until the database migration is installed. Membership tools still work.</div>}
        {data?.diagnosticsTruncated && <p className="mt-4 text-xs text-[#817a70]">Signals are calculated from the latest 2,000 events across these 50 accounts.</p>}

        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="border border-[#ded7cc] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e0d6] px-5 py-4">
              <div>
                <h2 className="font-serif text-2xl">Users</h2>
                <p className="mt-1 text-xs text-[#817a70]">Latest {data?.users.length || 0} accounts · chat content is not exposed here</p>
              </div>
              <label className="flex min-h-10 min-w-56 items-center gap-2 border border-[#d8cfc2] bg-[#fbf9f5] px-3 text-sm">
                <Search className="h-4 w-4 text-[#817a70]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email, name, or user ID" className="w-full bg-transparent outline-none" />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-[#f8f5ef] text-xs uppercase tracking-wide text-[#817a70]">
                  <tr><th className="px-5 py-3">User</th><th className="px-4 py-3">Supabase paid</th><th className="px-4 py-3">Waffo</th><th className="px-4 py-3">Complimentary</th><th className="px-4 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-[#eee8df]">
                  {users.map((user) => {
                    const profile = user.profile;
                    const paidActive = activeUntil(profile?.membership_expires_at) && profile?.membership_type !== "free";
                    const manualActive = activeUntil(profile?.manual_membership_expires_at);
                    return (
                      <tr key={user.id} className={selectedId === user.id ? "bg-[#fbf2e9]" : "hover:bg-[#fcfaf7]"}>
                        <td className="px-5 py-4"><p className="font-medium">{user.profile?.username || user.email || "Unnamed user"}</p><p className="mt-1 text-xs text-[#817a70]">{user.email || user.id}</p></td>
                        <td className="px-4 py-4"><Status active={paidActive} label={paidActive ? `${profile?.membership_type} · until ${formatDate(profile?.membership_expires_at)}` : "No active paid plan"} /></td>
                        <td className="px-4 py-4"><p>{user.waffo?.subscription_status || "—"}</p><p className="mt-1 text-xs text-[#817a70]">{user.waffo ? `${user.waffo.auto_renew ? "Auto-renew" : "No renewal"} · ${user.waffo.plan_id || "unknown"}` : "No Waffo order"}</p></td>
                        <td className="px-4 py-4"><Status active={manualActive} label={manualActive ? `${planNames[profile?.manual_membership_type || "plus_monthly"]} · until ${formatDate(profile?.manual_membership_expires_at)}` : "None"} /></td>
                        <td className="px-4 py-4 text-right"><button onClick={() => setSelectedId(user.id)} className="min-h-9 border border-[#d8cfc2] px-3 text-xs font-semibold hover:border-[#9e4837] hover:text-[#9e4837]">Manage</button></td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-[#817a70]">No matching users.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="border border-[#ded7cc] bg-white p-5 xl:sticky xl:top-6">
            <div className="flex items-center gap-3"><Gift className="h-5 w-5 text-[#9e4837]" /><h2 className="font-serif text-2xl">Complimentary access</h2></div>
            {selected ? (
              <>
                <div className="mt-5 border-y border-[#e7e0d6] py-4"><p className="font-medium">{selected.profile?.username || selected.email}</p><p className="mt-1 break-all text-xs text-[#817a70]">{selected.email || selected.id}</p></div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Signal label="Replies" value={selected.signals.chatReplies} />
                  <Signal label="Chat days" value={selected.signals.chatDays} />
                  <Signal label="Memory saves" value={selected.signals.memoryExtracts} />
                  <Signal label="Paywall views" value={selected.signals.paywallViews} />
                  <Signal label="Quota stops" value={selected.signals.quotaExhausted} />
                  <div><p className="text-xs text-[#817a70]">Last active</p><p className="mt-1 text-xs font-medium">{formatDate(selected.signals.lastActiveAt, true)}</p></div>
                </div>
                {selected.signals.lastError && <div className="mt-4 border border-[#e1b7ae] bg-[#fff4f1] p-3 text-xs text-[#8c392c]"><p className="font-semibold">Latest error: {selected.signals.lastError.code}</p><p className="mt-1">{formatDate(selected.signals.lastError.at, true)}</p></div>}
                <p className="mt-3 text-xs leading-5 text-[#817a70]">Operational signals only. No conversation or memory text is available in this dashboard.</p>
                <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-[#716a60]">Add duration</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {grantPlans.map((id) => <button key={id} onClick={() => setPlanId(id)} className={`min-h-11 border text-sm font-semibold ${planId === id ? "border-[#9e4837] bg-[#f9ece4] text-[#8d3f30]" : "border-[#d8cfc2]"}`}>{planDays[id]} days</button>)}
                </div>
                <label htmlFor="reason" className="mt-5 block text-xs font-semibold uppercase tracking-wide text-[#716a60]">Internal reason</label>
                <textarea id="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} placeholder="Support, tester, promotion…" className="mt-2 w-full border border-[#d8cfc2] bg-[#fbf9f5] p-3 text-sm outline-none focus:border-[#9e4837]" />
                <button disabled={saving} onClick={() => void changeMembership("grant")} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-[#9e4837] px-4 text-sm font-semibold text-white disabled:opacity-50"><Gift className="h-4 w-4" />{saving ? "Saving…" : `Add ${planDays[planId]} days now`}</button>
                <button disabled={saving || !activeUntil(selected.profile?.manual_membership_expires_at)} onClick={() => void changeMembership("revoke")} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-[#d8cfc2] px-4 text-sm font-semibold disabled:opacity-40"><XCircle className="h-4 w-4" />Revoke complimentary access</button>
                <p className="mt-4 text-xs leading-5 text-[#817a70]">Additional grants extend the current complimentary expiry. These actions never create, cancel, or modify a Waffo subscription.</p>
              </>
            ) : <p className="mt-5 text-sm leading-6 text-[#817a70]">Select “Manage” next to a user to grant or revoke complimentary membership.</p>}
          </aside>
        </div>

        <section className="mt-8 border border-[#ded7cc] bg-white p-5">
          <h2 className="font-serif text-2xl">Recent product events</h2>
          <p className="mt-1 text-xs text-[#817a70]">Feature usage and error codes only — never message, memory, Dream, or letter content.</p>
          <div className="mt-4 divide-y divide-[#eee8df]">
            {data?.recentEvents.map((event) => {
              const actor = data.users.find((user) => user.id === event.user_id);
              const detail = event.metadata.reason || event.metadata.status || event.metadata.planId || null;
              return <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><p className="font-medium">{event.event_name.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[#817a70]">{actor?.email || event.user_id}{event.locale ? ` · ${event.locale}` : ""}{event.companion_id ? " · independent profile" : ""}</p></div><div className="text-right text-xs text-[#817a70]">{detail && <p className="font-semibold text-[#8c392c]">{detail}</p>}<p className="mt-1">{formatDate(event.created_at, true)}</p></div></div>;
            })}
            {!data?.recentEvents.length && <p className="py-5 text-sm text-[#817a70]">No product events yet. New activity will appear here after the diagnostics migration is installed.</p>}
          </div>
        </section>

        <section className="mt-8 border border-[#ded7cc] bg-white p-5">
          <h2 className="font-serif text-2xl">Recent admin actions</h2>
          <div className="mt-4 divide-y divide-[#eee8df]">
            {data?.recentActions.map((action) => {
              const target = data.users.find((user) => user.id === action.target_user_id);
              return <div key={action.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><span className={`font-semibold ${action.action === "grant" ? "text-[#3e6937]" : "text-[#9e4837]"}`}>{action.action === "grant" ? "Granted" : "Revoked"}</span><span className="ml-2">{target?.email || action.target_user_id}</span>{action.reason && <p className="mt-1 text-xs text-[#817a70]">{action.reason}</p>}</div><div className="text-right text-xs text-[#817a70]"><p>{action.plan_id ? `${planNames[action.plan_id]} · until ${formatDate(action.expires_at)}` : "Complimentary only"}</p><p className="mt-1">{formatDate(action.created_at, true)}</p></div></div>;
            })}
            {!data?.recentActions.length && <p className="py-5 text-sm text-[#817a70]">No manual membership actions yet.</p>}
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
