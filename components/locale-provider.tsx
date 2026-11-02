"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getDictionary,
  isLocale,
  localeFromSetting,
  type Locale,
} from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  isReady: boolean;
  setLocale: (locale: Locale, persistAccount?: boolean) => void;
  t: ReturnType<typeof getDictionary>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSessionContext();
  const userId = session?.user.id || null;
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [storageReady, setStorageReady] = useState(false);
  const [hasDeviceChoice, setHasDeviceChoice] = useState(false);
  const [accountResolvedUserId, setAccountResolvedUserId] = useState<string | null>(null);
  const hasDeviceChoiceRef = useRef(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(saved)) {
        hasDeviceChoiceRef.current = true;
        setHasDeviceChoice(true);
        setLocaleState(saved);
      }
    } catch {
      // Storage can be unavailable in strict privacy modes; English remains usable.
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    if (!userId) return;
    let deviceChoice = hasDeviceChoiceRef.current;
    try {
      deviceChoice ||= isLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    } catch {
      // Fall back to the account preference when storage is unavailable.
    }
    // An explicit choice on this device always wins. Never replace it with a
    // stale account value while the settings request is in flight.
    if (deviceChoice) return;

    let cancelled = false;
    void fetch("/api/settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ settings?: { locale?: unknown } }>;
      })
      .then((result) => {
        if (cancelled || hasDeviceChoiceRef.current) return;
        const accountLocale = localeFromSetting(result?.settings?.locale);
        if (accountLocale) setLocaleState(accountLocale);
      })
      .catch(() => {
        // English remains the safe default when account settings are unavailable.
      })
      .finally(() => {
        if (!cancelled) setAccountResolvedUserId(userId);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const setLocale = useCallback((nextLocale: Locale, persistAccount = true) => {
    hasDeviceChoiceRef.current = true;
    setHasDeviceChoice(true);
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // The in-memory selection still works when storage is unavailable.
    }
    if (!userId || !persistAccount) return;
    // Update the interface immediately; account persistence must never leave
    // the public UI and Chat waiting on different language states.
    void fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    }).then((response) => {
      if (!response.ok) console.warn("Account language preference could not be saved.");
    }).catch(() => {
      console.warn("Account language preference could not be saved.");
    });
  }, [userId]);

  const isReady = storageReady && (!userId || hasDeviceChoice || accountResolvedUserId === userId);
  const value = useMemo(
    () => ({ locale, isReady, setLocale, t: getDictionary(locale) }),
    [locale, isReady, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}

export function LocaleToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  const options: { value: Locale; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "zh", label: "中文" },
  ];

  return (
    <div
      role="group"
      aria-label={t.common.language}
      className={`inline-flex shrink-0 items-center rounded-full border border-[#d8cfc2] bg-[#f1ece4] p-0.5 ${className}`}
    >
      {options.map((option) => {
        const selected = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option.value === "en" ? "Use English everywhere" : "全站使用中文"}
            onClick={() => { if (!selected) setLocale(option.value); }}
            className={`flex min-h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f3d] ${selected ? "bg-[#fffdf8] text-[#923f30] shadow-sm" : "text-[#756f66] hover:text-[#282621]"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${selected ? "bg-[#a34f3d]" : "bg-transparent"}`} aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
