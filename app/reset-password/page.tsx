"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Lock, Heart, ArrowRight } from "lucide-react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

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
  const [supabase] = useState(() => createClientComponentClient());
  const { t } = useLocale();

  useEffect(() => {
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setChecking(false);
      }
    });

    // Supabase exchanges the recovery token from the emailed URL. An existing
    // signed-in session is also allowed to choose a new password.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
        setChecking(false);
      } else {
        expiryTimer = setTimeout(() => setChecking(false), 5000);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, [supabase]);

  useEffect(() => {
    if (!done) return;
    const redirectTimer = setTimeout(() => {
      router.replace("/app");
      router.refresh();
    }, 2000);
    return () => clearTimeout(redirectTimer);
  }, [done, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError(t.reset.tooShort);
      return;
    }
    if (password !== confirm) {
      setError(t.reset.mismatch);
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(t.reset.failed);
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] relative flex items-center justify-center px-4 py-16">
      <LocaleToggle className="absolute top-5 right-5" />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">{t.reset.title}</h1>
          <p className="text-gray-400 text-sm mt-2">
            {done ? t.reset.doneSubtitle : t.reset.subtitle}
          </p>
        </div>

        {done ? (
          <p className="text-center text-sm text-gray-300">{t.reset.done}</p>
        ) : checking ? (
          <div className="flex justify-center py-6" aria-label={t.reset.title}>
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !ready ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-300 leading-relaxed">{t.reset.expired}</p>
            <p className="text-sm text-gray-400 leading-relaxed">{t.reset.tryAgain}</p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="w-full py-3 rounded-xl gradient-btn text-white font-semibold"
            >
              {t.reset.backToLogin}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input
                type="password"
                aria-label={t.reset.newPassword}
                placeholder={t.reset.newPassword}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
                aria-label={t.reset.confirmPassword}
                placeholder={t.reset.confirmPassword}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
              />
            </div>

            {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl gradient-btn text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? t.reset.saving : t.reset.save}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
