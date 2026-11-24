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
    <div className="relative flex min-h-screen items-center justify-center bg-[#f8f5ef] px-5 py-24 text-[#282621]">
      <button type="button" onClick={() => router.push("/")} className="absolute left-5 top-6 font-serif text-[27px] tracking-[-0.04em] sm:left-8" aria-label="Amara home">Amara</button>
      <LocaleToggle className="absolute right-5 top-4 !min-h-11 !px-2 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d] sm:right-8" />
      <div className="w-full max-w-md border border-[#d8cfc2] bg-[#fffdf8] p-6 shadow-[10px_10px_0_#e9e1d6] sm:p-8">
        <div className="mb-8 text-center">
          <Heart className="mx-auto mb-4 h-10 w-10 text-[#a34f3d]" strokeWidth={1.5} />
          <h1 className="font-serif text-3xl font-semibold tracking-[-0.02em]">{t.reset.title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#6e685f]">{done ? t.reset.doneSubtitle : t.reset.subtitle}</p>
        </div>

        {done ? (
          <p className="text-center text-sm leading-7 text-[#53634b]" role="status">{t.reset.done}</p>
        ) : checking ? (
          <div className="flex justify-center py-6" aria-label={t.reset.title}>
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#a34f3d] border-t-transparent" />
          </div>
        ) : !ready ? (
          <div className="space-y-4 text-center">
            <p className="text-sm leading-7 text-[#6e685f]">{t.reset.expired}</p>
            <p className="text-sm leading-7 text-[#6e685f]">{t.reset.tryAgain}</p>
            <button type="button" onClick={() => router.push("/login")} className="min-h-12 w-full bg-[#a34f3d] px-4 py-3 font-semibold text-white hover:bg-[#893f31]">
              {t.reset.backToLogin}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-4 h-4 w-4 text-[#817a70]" />
              <input
                type="password"
                aria-label={t.reset.newPassword}
                placeholder={t.reset.newPassword}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="min-h-12 w-full border border-[#cfc5b7] bg-[#f8f5ef] py-3 pl-10 pr-4 text-[#282621] placeholder-[#817a70] focus:border-[#a34f3d] focus:outline-none focus:ring-2 focus:ring-[#a34f3d]/15"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-4 h-4 w-4 text-[#817a70]" />
              <input
                type="password"
                aria-label={t.reset.confirmPassword}
                placeholder={t.reset.confirmPassword}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="min-h-12 w-full border border-[#cfc5b7] bg-[#f8f5ef] py-3 pl-10 pr-4 text-[#282621] placeholder-[#817a70] focus:border-[#a34f3d] focus:outline-none focus:ring-2 focus:ring-[#a34f3d]/15"
              />
            </div>

            {error && <p role="alert" className="text-sm text-[#923f30]">{error}</p>}

            <button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 bg-[#a34f3d] px-4 py-3 font-semibold text-white hover:bg-[#893f31] disabled:opacity-50">
              {loading ? t.reset.saving : t.reset.save}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
