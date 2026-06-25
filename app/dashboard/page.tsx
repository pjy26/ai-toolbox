"use client";

import { useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { CreditCard, Crown, BarChart3, History, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Profile {
  credits: number;
  membership_type: string;
  membership_expires_at: string | null;
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
        .select("credits, membership_type, membership_expires_at")
        .eq("id", uid)
        .single()
        .then(({ data }) => { if (data) setProfile(data); }),
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
    resume: "简历优化", email: "邮件撰写",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">控制台</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="p-6 rounded-2xl bg-surface card-glow">
          <CreditCard className="w-6 h-6 text-brand mb-2" />
          <p className="text-3xl font-bold">{profile.credits}</p>
          <p className="text-sm text-gray-400 mt-1">剩余积分</p>
          <Link href="/pricing" className="mt-3 text-sm text-brand-light flex items-center gap-1 hover:underline">
            充值 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="p-6 rounded-2xl bg-surface card-glow">
          <Crown className="w-6 h-6 text-yellow-400 mb-2" />
          <p className="text-lg font-bold">
            {isMember ? (profile.membership_type === "yearly" ? "年度会员" : "月度会员") : "免费用户"}
          </p>
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
          <BarChart3 className="w-6 h-6 text-green-400 mb-2" />
          <p className="text-3xl font-bold">{logs.length}</p>
          <p className="text-sm text-gray-400 mt-1">近期使用次数</p>
        </div>
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
                  <span className="text-gray-500">-{log.credits_cost} 积分</span>
                  <span className="text-gray-600 text-xs">
                    {new Date(log.created_at).toLocaleString("zh-CN")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
