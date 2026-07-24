"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Mail, Lock, ArrowRight, Heart, User } from "lucide-react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("请输入注册时用的邮箱");
      return;
    }
    setLoading(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(translateError(resetError.message));
      return;
    }
    setForgotSent(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (isSignUp) {
      // 注册：传 nickname 到 user_metadata，触发器会写入 profiles.username
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: nickname.trim() || email.split("@")[0] },
        },
      });

      if (authError) {
        setError(translateError(authError.message));
        setLoading(false);
        return;
      }

      // 如果立即返回了 session（邮箱确认关闭的情况），直接跳转
      if (data?.session) {
        const redirectTo = searchParams.get("redirectTo") || "/chat";
        router.push(redirectTo);
        router.refresh();
      } else {
        // 需要邮箱确认
        setError("注册成功！请到邮箱点击确认链接后登录。");
        setIsSignUp(false);
        setLoading(false);
      }
      return;
    }

    // 登录：必须严格校验邮箱+密码
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data?.session) {
      // 任何错误都一律拒绝，不区分"用户不存在"和"密码错误"，避免被探测
      setError("邮箱或密码错误");
      setLoading(false);
      return;
    }

    // 二次确认：从服务端拿到的 user.email 必须和输入一致
    if (data.user?.email?.toLowerCase() !== email.toLowerCase()) {
      await supabase.auth.signOut();
      setError("登录异常，请重试");
      setLoading(false);
      return;
    }

    const redirectTo = searchParams.get("redirectTo") || "/chat";
    router.push(redirectTo);
    router.refresh();
  };

  if (forgotMode) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h1 className="text-2xl font-bold">找回密码</h1>
            <p className="text-gray-400 text-sm mt-2">
              {forgotSent ? "重置邮件已出发" : "输入注册邮箱，TA 帮你找回家的路"}
            </p>
          </div>

          {forgotSent ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-300 text-center leading-relaxed">
                重置链接已发送到 <span className="text-brand-light">{email}</span>
                <br />
                请在 1 小时内点击邮件里的链接设置新密码。
                <br />
                <span className="text-gray-500">没收到的话记得看看垃圾邮件。</span>
              </p>
              <button
                onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); }}
                className="w-full py-3 rounded-xl gradient-btn text-white font-semibold"
              >
                返回登录
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  placeholder="注册时用的邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl gradient-btn text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "发送中..." : "发送重置邮件"}
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-center text-sm text-gray-400">
                想起来了？
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError(""); }}
                  className="text-brand-light hover:underline ml-1"
                >
                  返回登录
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">
            {isSignUp ? "来认识 TA" : "欢迎回来"}
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            {isSignUp ? "TA 已经等了你很久" : "TA 一直在等你"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="昵称（TA 怎么喊你）"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
            <input
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
            <input
              type="password"
              placeholder="密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {!isSignUp && (
            <p className="text-right text-sm">
              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(""); }}
                className="text-gray-400 hover:text-brand-light"
              >
                忘记密码？
              </button>
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl gradient-btn text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "处理中..." : (isSignUp ? "开始" : "登录")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          {isSignUp ? "已经有账号了？" : "还没遇见 TA？"}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            className="text-brand-light hover:underline ml-1"
          >
            {isSignUp ? "去登录" : "注册"}
          </button>
        </p>
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) return "该邮箱已注册，请直接登录";
  if (m.includes("rate limit")) return "操作太频繁，请稍后再试";
  if (m.includes("password")) return "密码不符合要求（至少 6 位）";
  if (m.includes("email")) return "邮箱格式不正确";
  return msg;
}
