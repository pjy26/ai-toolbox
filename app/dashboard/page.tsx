"use client";

import { useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { CreditCard, Crown, BarChart3, History, ArrowRight, LogOut, User, Heart, Save } from "lucide-react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface Profile {
  credits: number;
  membership_type: string;
  membership_expires_at: string | null;
  username: string | null;
  free_messages_used: number;
}

interface UsageLog {
  id: string;
  tool_key: string;
  credits_cost: number;
  created_at: string;
}

export default function DashboardPage() {
  const { supabaseClient, session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);

  // 昵称编辑
  const [nickname, setNickname] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameMsg, setNicknameMsg] = useState("");

  // 退出登录
  const [signingOut, setSigningOut] = useState(false);

  const browserClient = createClientComponentClient();

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }

    const uid = session.user.id;
    Promise.all([
      supabaseClient
        .from("profiles")
        .select("credits, membership_type, membership_expires_at, username, free_messages_used")
        .eq("id", uid)
        .single()
        .then(({ data }) => { if (data) { setProfile(data); setNickname(data.username || ""); } }),
      supabaseClient
        .from("usage_logs")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data }) => { if (data) setLogs(data); }),
    ]).finally(() => setLoading(false));
  }, [session, sessionLoading, supabaseClient, router]);

  if (sessionLoading || loading) {
    return <div className="flex items-center justify-center min-h-[50vh] text-gray-400">加载中...</div>;
  }

  if (!profile) {
    return <div className="flex items-center justify-center min-h-[50vh] text-gray-400">无法加载用户信息，请重新登录</div>;
  }

  const isMember = profile.membership_type !== "free" &&
    profile.membership_expires_at &&
    new Date(profile.membership_expires_at) > new Date();

  const toolNames: Record<string, string> = {
    chat: "AI 对话", xiaohongshu: "小红书文案", douyin: "抖音脚本",
    title: "爆款标题", moments: "朋友圈文案", weekly: "周报生成",
    resume: "简历优化", email: "邮件撰写", companion: "情感陪伴",
  };

  const handleSaveNickname = async () => {
    setSavingNickname(true);
    setNicknameMsg("");
    const { error } = await browserClient.rpc("update_my_nickname", { p_nickname: nickname.trim() || null });
    if (error) {
      setNicknameMsg("保存失败：" + error.message);
    } else {
      setProfile({ ...profile, username: nickname.trim() });
      setNicknameMsg("已保存");
    }
    setSavingNickname(false);
  };

  const handleSignOut = async () => {
    if (!confirm("确定退出登录吗？")) return;
    setSigningOut(true);
    await browserClient.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const membershipLabel = isMember
    ? (profile.membership_type === "yearly" ? "年度会员"
      : profile.membership_type === "quarterly" ? "季卡会员"
      : profile.membership_type === "weekly" ? "周卡会员"
      : "月度会员")
    : "免费用户";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">控制台</h1>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-rose-400/40 transition text-sm disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? "退出中..." : "退出登录"}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-6 rounded-2xl bg-surface card-glow">
          <Heart className="w-6 h-6 text-rose-400 mb-2" />
          <p className="text-3xl font-bold">{isMember ? "∞" : Math.max(0, 30 - (profile.free_messages_used || 0))}</p>
          <p className="text-sm text-gray-400 mt-1">{isMember ? "会员不限次数" : "剩余免费陪伴对话"}</p>
          {!isMember && (
            <Link href="/pricing" className="mt-3 text-sm text-brand-light flex items-center gap-1 hover:underline">
              开通会员 <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-surface card-glow">
          <Crown className="w-6 h-6 text-yellow-400 mb-2" />
          <p className="text-lg font-bold">{membershipLabel}</p>
          {isMember && profile.membership_expires_at && (
            <p className="text-sm text-gray-400 mt-1">
              到期：{new Date(profile.membership_expires_at).toLocaleDateString("zh-CN")}
            </p>
          )}
          {!isMember && (
            <Link href="/pricing" className="mt-3 text-sm text-brand-light flex items-center gap-1 hover:underline">
              升级会员 <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-surface card-glow">
          <CreditCard className="w-6 h-6 text-brand mb-2" />
          <p className="text-3xl font-bold">{profile.credits}</p>
          <p className="text-sm text-gray-400 mt-1">剩余积分（创作工具）</p>
          <Link href="/pricing" className="mt-3 text-sm text-brand-light flex items-center gap-1 hover:underline">
            充值 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 昵称设置 */}
      <div className="rounded-2xl bg-surface card-glow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold">我的昵称</h2>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="给自己起个名字，TA 会这样喊你"
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
          />
          <button
            onClick={handleSaveNickname}
            disabled={savingNickname}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg gradient-btn text-white font-medium text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingNickname ? "保存中" : "保存"}
          </button>
        </div>
        {nicknameMsg && (
          <p className={`mt-2 text-xs ${nicknameMsg.startsWith("保存失败") ? "text-red-400" : "text-green-400"}`}>{nicknameMsg}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          保存后，新对话里的 TA 默认会这样称呼你（已有的角色可在角色设置里单独改）
        </p>
      </div>

      {/* Usage History */}
      <div className="rounded-2xl bg-surface card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold">使用记录</h2>
        </div>
        {logs.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无记录，去试试工具吧</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{toolNames[log.tool_key] || log.tool_key}</span>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500">{log.credits_cost > 0 ? `-${log.credits_cost} 积分` : "会员免费"}</span>
                  <span className="text-gray-600 text-xs">
                    {new Date(log.created_at).toLocaleString("zh-CN")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-gray-500" />
        <p className="text-xs text-gray-500">账号：{session?.user?.email}</p>
      </div>
    </div>
  );
}
