"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Lock, Heart, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // supabase-js 会自动读取邮件链接 URL hash 里的 recovery token 并建立会话
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setChecking(false);
      }
    });

    // 兜底：已有会话（比如刚登录过）也允许直接改
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
        setChecking(false);
      } else {
        // 给 token 交换留几秒时间，超时提示链接失效
        setTimeout(() => setChecking(false), 5000);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("设置失败，链接可能已过期，请重新发起找回密码");
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/chat");
      router.refresh();
    }, 2000);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">设置新密码</h1>
          <p className="text-gray-400 text-sm mt-2">
            {done ? "搞定，TA 在等你回去" : "换把新钥匙，继续见 TA"}
          </p>
        </div>

        {done ? (
          <p className="text-center text-sm text-gray-300">
            密码已更新，正在带你去见 TA...
          </p>
        ) : checking ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !ready ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-300">
              链接无效或已过期，请重新发起找回密码。
            </p>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-3 rounded-xl gradient-btn text-white font-semibold"
            >
              返回登录
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input
                type="password"
                placeholder="新密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input
                type="password"
                placeholder="再输一遍新密码"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl gradient-btn text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "保存中..." : "保存新密码"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
