"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Crown, Gift, RefreshCw, Search, ShieldCheck, Users, WalletCards, XCircle } from "lucide-react";

type PlanId = "weekly" | "monthly" | "yearly";

type AdminUser = {
  id: string;
  email: string | null;
  lastSignInAt: string | null;
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
  stats: { totalUsers: number; paidMembers: number; manualMembers: number; waffoPaidOrders: number };
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
};

const planNames: Record<PlanId, string> = { weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };
const planDays: Record<PlanId, number> = { weekly: 7, monthly: 30, yearly: 365 };

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
  const [errorStatus, setErrorStatus] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [planId, setPlanId] = useState<PlanId>("monthly");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        setErrorStatus(response.status);
        throw new Error(result.error || "Could not load the admin dashboard");
      }
      setData(result);
      setErrorStatus(0);
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

  if (error && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-6 text-[#37332d]">
        <div className="w-full max-w-md border border-[#ded7cc] bg-white p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-[#9e4837]" />
          <h1 className="mt-5 font-serif text-3xl">Administrator access</h1>
          <p className="mt-3 text-sm leading-6 text-[#716a60]">{error}</p>
          {errorStatus === 401 && <Link href="/login?redirectTo=%2Fadmin" className="mt-6 inline-flex min-h-11 items-center bg-[#9e4837] px-5 text-sm font-semibold text-white">Sign in</Link>}
          <button onClick={() => void load()} className="ml-3 mt-6 min-h-11 border border-[#d8cfc2] px-5 text-sm font-semibold">Retry</button>
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
            <h1 className="mt-1 font-serif text-3xl">Members & subscriptions</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 border border-[#d8cfc2] bg-white px-4 text-sm font-semibold hover:bg-[#f4eee6]">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <Link href="/app" className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-[#745f52]"><ArrowLeft className="h-4 w-4" /> User app</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {error && <div className="mb-5 border border-[#e1b7ae] bg-[#fff4f1] px-4 py-3 text-sm text-[#8c392c]">{error}</div>}
        {notice && <div className="mb-5 border border-[#b8cfb2] bg-[#f2f8ef] px-4 py-3 text-sm text-[#3e6937]">{notice}</div>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Overview">
          <Stat icon={<Users className="h-5 w-5" />} label="Total users" value={data?.stats.totalUsers || 0} />
          <Stat icon={<Crown className="h-5 w-5" />} label="Active paid members" value={data?.stats.paidMembers || 0} />
          <Stat icon={<Gift className="h-5 w-5" />} label="Active complimentary" value={data?.stats.manualMembers || 0} />
          <Stat icon={<WalletCards className="h-5 w-5" />} label="Waffo paid orders" value={data?.stats.waffoPaidOrders || 0} />
        </section>

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
                        <td className="px-4 py-4"><Status active={manualActive} label={manualActive ? `${planNames[profile?.manual_membership_type || "monthly"]} · until ${formatDate(profile?.manual_membership_expires_at)}` : "None"} /></td>
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
                <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-[#716a60]">Add duration</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(Object.keys(planNames) as PlanId[]).map((id) => <button key={id} onClick={() => setPlanId(id)} className={`min-h-11 border text-sm font-semibold ${planId === id ? "border-[#9e4837] bg-[#f9ece4] text-[#8d3f30]" : "border-[#d8cfc2]"}`}>{planDays[id]} days</button>)}
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

function Status({ active, label }: { active: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-2 text-xs ${active ? "text-[#3e6937]" : "text-[#817a70]"}`}><span className={`h-2 w-2 rounded-full ${active ? "bg-[#65945b]" : "bg-[#c8c0b5]"}`} />{label}</span>;
}
