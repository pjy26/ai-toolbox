"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Mail, Lock, ArrowRight, Heart, User } from "lucide-react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

const DEFAULT_DESTINATION = "/app";

function getSafeRedirect(value: string | null): string {
  if (!value) return DEFAULT_DESTINATION;

  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return DEFAULT_DESTINATION;
  }

  try {
    const url = new URL(candidate, "https://amara.local");
    if (url.origin !== "https://amara.local") return DEFAULT_DESTINATION;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_DESTINATION;
  }
}

const isLegacyPhone = (value: string) => /^1[3-9]\d{9}$/.test(value.trim());

// Compatibility only: legacy mainland China accounts used a phone-derived
// email identifier for Supabase password auth. New accounts use real emails.
const toLegacyAuthEmail = (value: string) => {
  const trimmed = value.trim();
  return isLegacyPhone(trimmed) ? `${trimmed}@phone.pjytoolbox.xyz` : trimmed;
};

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClientComponentClient());
  const { t } = useLocale();

  const translateError = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.includes("already registered") || normalized.includes("already been registered")) {
      return t.login.alreadyRegistered;
    }
    if (normalized.includes("rate limit")) return t.login.rateLimited;
    if (normalized.includes("password")) return t.login.passwordRequirements;
    if (normalized.includes("email")) return t.login.invalidEmail;
    return message;
  };

  const goToDestination = () => {
    router.replace(getSafeRedirect(searchParams.get("redirectTo") || searchParams.get("redirect")));
    router.refresh();
  };

  const handleForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setError(t.login.resetEmailRequired);
      return;
    }
    if (isLegacyPhone(email)) {
      setError(t.login.legacyPhoneReset);
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (isSignUp) {
      const authEmail = email.trim();
      const { data, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: {
          data: { username: nickname.trim() || authEmail.split("@")[0] },
        },
      });

      if (authError) {
        setError(translateError(authError.message));
        setLoading(false);
        return;
      }

      if (data.session) {
        goToDestination();
      } else {
        setAccountCreated(true);
        setLoading(false);
      }
      return;
    }

    const authEmail = toLegacyAuthEmail(email);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (authError || !data.session) {
      setError(t.login.invalidCredentials);
      setLoading(false);
      return;
    }

    if (data.user.email?.toLowerCase() !== authEmail.toLowerCase()) {
      await supabase.auth.signOut();
      setError(t.login.loginError);
      setLoading(false);
      return;
    }

    goToDestination();
  };

  const returnToSignIn = () => {
    setForgotMode(false);
    setForgotSent(false);
    setAccountCreated(false);
    setIsSignUp(false);
    setError("");
    setPassword("");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f8f5ef] px-5 py-24 text-[#282621]">
      <Link href="/" className="absolute left-5 top-6 font-serif text-[27px] tracking-[-0.04em] text-[#282621] sm:left-8" aria-label="Amara home">Amara</Link>
      <LocaleToggle className="absolute right-5 top-4 !min-h-11 !px-2 !text-xs !font-medium !text-[#6e685f] hover:!text-[#a34f3d] sm:right-8" />
      <div className="w-full max-w-md border border-[#d8cfc2] bg-[#fffdf8] p-6 shadow-[10px_10px_0_#e9e1d6] sm:p-8">
        {accountCreated ? (
          <div className="text-center">
            <Mail className="mx-auto mb-4 h-10 w-10 text-[#a34f3d]" strokeWidth={1.5} />
            <h1 className="font-serif text-3xl font-semibold">{t.login.confirmationTitle}</h1>
            <p className="mt-4 text-sm leading-7 text-[#6e685f]">{t.login.confirmationMessage}</p>
            <p className="mt-3 break-all text-sm font-medium text-[#923f30]">{email}</p>
            <button
              type="button"
              onClick={returnToSignIn}
              className="mt-6 min-h-12 w-full bg-[#a34f3d] px-4 py-3 font-semibold text-white hover:bg-[#893f31]"
            >
              {t.login.backToSignIn}
            </button>
          </div>
        ) : forgotMode ? (
          <>
            <div className="mb-8 text-center">
              <Heart className="mx-auto mb-4 h-10 w-10 text-[#a34f3d]" strokeWidth={1.5} />
              <h1 className="font-serif text-3xl font-semibold">{forgotSent ? t.login.resetSentTitle : t.login.resetTitle}</h1>
              {!forgotSent && <p className="mt-3 text-sm leading-6 text-[#6e685f]">{t.login.resetSubtitle}</p>}
            </div>

            {forgotSent ? (
              <div className="space-y-4">
                <p className="text-center text-sm leading-7 text-[#6e685f]">
                  {t.login.resetSent} <span className="break-all font-medium text-[#923f30]">{email}</span>.
                  <br />
                  {t.login.resetExpiry}
                </p>
                <button
                  type="button"
                  onClick={returnToSignIn}
                  className="min-h-12 w-full bg-[#a34f3d] px-4 py-3 font-semibold text-white hover:bg-[#893f31]"
                >
                  {t.login.backToSignIn}
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-4 h-4 w-4 text-[#817a70]" />
                  <input
                    type="text"
                    aria-label={t.login.email}
                    placeholder={t.login.email}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="min-h-12 w-full border border-[#cfc5b7] bg-[#f8f5ef] py-3 pl-10 pr-4 text-[#282621] placeholder-[#817a70] focus:border-[#a34f3d] focus:outline-none focus:ring-2 focus:ring-[#a34f3d]/15"
                  />
                </div>

                {error && <p role="alert" className="text-sm text-[#923f30]">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-12 w-full items-center justify-center gap-2 bg-[#a34f3d] px-4 py-3 font-semibold text-white hover:bg-[#893f31] disabled:opacity-50"
                >
                  {loading ? t.login.sending : t.login.sendReset}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <p className="text-center text-sm text-[#6e685f]">
                  {t.login.rememberedPassword}
                  <button type="button" onClick={returnToSignIn} className="ml-1 font-medium text-[#923f30] hover:underline">
                    {t.login.backToSignIn}
                  </button>
                </p>
              </form>
            )}
          </>
        ) : (
          <>
            <div className="mb-8 text-center">
              <Heart className="mx-auto mb-4 h-10 w-10 text-[#a34f3d]" strokeWidth={1.5} />
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">{t.login.companionTagline}</p>
              <h1 className="font-serif text-3xl font-semibold tracking-[-0.02em]">{isSignUp ? t.login.createAccount : t.login.welcomeBack}</h1>
              <p className="mt-3 text-sm leading-6 text-[#6e685f]">
                {isSignUp ? t.login.signUpSubtitle : t.login.signInSubtitle}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="relative">
                  <User className="absolute left-3 top-4 h-4 w-4 text-[#817a70]" />
                  <input
                    type="text"
                    aria-label={t.login.nickname}
                    placeholder={t.login.nickname}
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    maxLength={20}
                    autoComplete="nickname"
                    className="min-h-12 w-full border border-[#cfc5b7] bg-[#f8f5ef] py-3 pl-10 pr-4 text-[#282621] placeholder-[#817a70] focus:border-[#a34f3d] focus:outline-none focus:ring-2 focus:ring-[#a34f3d]/15"
                  />
                </div>
              )}
              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-4 h-4 w-4 text-[#817a70]" />
                  <input
                    type={isSignUp ? "email" : "text"}
                    aria-label={t.login.email}
                    placeholder={isSignUp ? t.login.email : t.login.emailOrLegacyPhone}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="username"
                    className="min-h-12 w-full border border-[#cfc5b7] bg-[#f8f5ef] py-3 pl-10 pr-4 text-[#282621] placeholder-[#817a70] focus:border-[#a34f3d] focus:outline-none focus:ring-2 focus:ring-[#a34f3d]/15"
                  />
                </div>
                {!isSignUp && <p className="mt-2 text-xs leading-5 text-[#817a70]">{t.login.legacyPhoneHint}</p>}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-4 h-4 w-4 text-[#817a70]" />
                <input
                  type="password"
                  aria-label={t.login.password}
                  placeholder={t.login.password}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="min-h-12 w-full border border-[#cfc5b7] bg-[#f8f5ef] py-3 pl-10 pr-4 text-[#282621] placeholder-[#817a70] focus:border-[#a34f3d] focus:outline-none focus:ring-2 focus:ring-[#a34f3d]/15"
                />
              </div>

              {error && <p role="alert" className="text-sm text-[#923f30]">{error}</p>}

              {!isSignUp && (
                <p className="text-right text-sm">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError(""); }}
                    className="min-h-11 text-[#6e685f] hover:text-[#923f30]"
                  >
                    {t.login.forgotPassword}
                  </button>
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-12 w-full items-center justify-center gap-2 bg-[#a34f3d] px-4 py-3 font-semibold text-white hover:bg-[#893f31] disabled:opacity-50"
              >
                {loading
                  ? (isSignUp ? t.login.creatingAccount : t.login.signingIn)
                  : (isSignUp ? t.login.createAccountButton : t.login.signIn)}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#6e685f]">
              {isSignUp ? t.login.alreadyHaveAccount : t.login.newHere}
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                className="ml-1 min-h-11 font-medium text-[#923f30] hover:underline"
              >
                {isSignUp ? t.login.signIn : t.login.signUp}
              </button>
            </p>

            {isSignUp && (
              <p className="mt-5 text-center text-xs leading-6 text-[#817a70]">
                {t.login.ageAndTerms}{" "}
                <Link href="/terms" className="text-[#923f30] underline underline-offset-4">{t.login.terms}</Link>
                {" "}{t.login.and}{" "}
                <Link href="/content-policy" className="text-[#923f30] underline underline-offset-4">{t.login.contentPolicy}</Link>.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
