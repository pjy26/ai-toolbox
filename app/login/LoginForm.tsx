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
    <div className="min-h-[calc(100vh-4rem)] relative flex items-center justify-center px-4 py-16">
      <LocaleToggle className="absolute top-5 right-5" />
      <div className="w-full max-w-sm">
        {accountCreated ? (
          <div className="text-center">
            <Mail className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h1 className="text-2xl font-bold">{t.login.confirmationTitle}</h1>
            <p className="text-gray-300 text-sm mt-4 leading-relaxed">{t.login.confirmationMessage}</p>
            <p className="text-brand-light text-sm mt-3 break-all">{email}</p>
            <button
              type="button"
              onClick={returnToSignIn}
              className="mt-6 w-full py-3 rounded-xl gradient-btn text-white font-semibold"
            >
              {t.login.backToSignIn}
            </button>
          </div>
        ) : forgotMode ? (
          <>
            <div className="text-center mb-8">
              <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
              <h1 className="text-2xl font-bold">{forgotSent ? t.login.resetSentTitle : t.login.resetTitle}</h1>
              {!forgotSent && <p className="text-gray-400 text-sm mt-2">{t.login.resetSubtitle}</p>}
            </div>

            {forgotSent ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-300 text-center leading-relaxed">
                  {t.login.resetSent} <span className="text-brand-light break-all">{email}</span>.
                  <br />
                  {t.login.resetExpiry}
                </p>
                <button
                  type="button"
                  onClick={returnToSignIn}
                  className="w-full py-3 rounded-xl gradient-btn text-white font-semibold"
                >
                  {t.login.backToSignIn}
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    aria-label={t.login.email}
                    placeholder={t.login.email}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
                  />
                </div>

                {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl gradient-btn text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? t.login.sending : t.login.sendReset}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-center text-sm text-gray-400">
                  {t.login.rememberedPassword}
                  <button type="button" onClick={returnToSignIn} className="text-brand-light hover:underline ml-1">
                    {t.login.backToSignIn}
                  </button>
                </p>
              </form>
            )}
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
              <h1 className="text-2xl font-bold">{isSignUp ? t.login.createAccount : t.login.welcomeBack}</h1>
              <p className="text-gray-400 text-sm mt-2">
                {isSignUp ? t.login.signUpSubtitle : t.login.signInSubtitle}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    aria-label={t.login.nickname}
                    placeholder={t.login.nickname}
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    maxLength={20}
                    autoComplete="nickname"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
                  />
                </div>
              )}
              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type={isSignUp ? "email" : "text"}
                    aria-label={t.login.email}
                    placeholder={isSignUp ? t.login.email : t.login.emailOrLegacyPhone}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
                  />
                </div>
                {!isSignUp && <p className="mt-2 text-xs leading-relaxed text-gray-500">{t.login.legacyPhoneHint}</p>}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  aria-label={t.login.password}
                  placeholder={t.login.password}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-white/10 text-white placeholder-gray-500 focus:border-brand focus:outline-none"
                />
              </div>

              {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

              {!isSignUp && (
                <p className="text-right text-sm">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError(""); }}
                    className="text-gray-400 hover:text-brand-light"
                  >
                    {t.login.forgotPassword}
                  </button>
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl gradient-btn text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading
                  ? (isSignUp ? t.login.creatingAccount : t.login.signingIn)
                  : (isSignUp ? t.login.createAccountButton : t.login.signIn)}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              {isSignUp ? t.login.alreadyHaveAccount : t.login.newHere}
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                className="text-brand-light hover:underline ml-1"
              >
                {isSignUp ? t.login.signIn : t.login.signUp}
              </button>
            </p>

            {isSignUp && (
              <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">
                {t.login.ageAndTerms}{" "}
                <Link href="/terms" className="text-brand-light hover:underline">{t.login.terms}</Link>
                {" "}{t.login.and}{" "}
                <Link href="/content-policy" className="text-brand-light hover:underline">{t.login.contentPolicy}</Link>.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
