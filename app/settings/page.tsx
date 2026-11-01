"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { BookOpen, Check, ChevronRight, Loader2, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest, ErrorState, PageLoader } from "@/components/amara-ui";
import { useLocale } from "@/components/locale-provider";

type Settings = {
  locale: string;
  timezone: string;
  dream_enabled: boolean;
  proactive_enabled: boolean;
  memory_enabled: boolean;
};

type SettingsResponse = { settings: Settings };

const fallbackTimezones = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney"];

export default function SettingsPage() {
  const { session } = useSessionContext();
  const { setLocale } = useLocale();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState("");

  const detectedTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const timezones = useMemo(() => {
    let zones = fallbackTimezones;
    if (typeof Intl.supportedValuesOf === "function") {
      try {
        zones = Intl.supportedValuesOf("timeZone");
      } catch {
        // Keep the concise fallback list on older browsers.
      }
    }
    return Array.from(new Set([detectedTimezone, settings?.timezone, ...zones].filter((zone): zone is string => Boolean(zone))));
  }, [detectedTimezone, settings?.timezone]);

  const load = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<SettingsResponse>("/api/settings");
      setSettings(result.settings);
      setLocale(result.settings.locale.toLowerCase().startsWith("zh") ? "zh" : "en");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [session, setLocale]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateSettings(patch: Partial<Settings>) {
    if (!settings || saving) return;
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setSaving(true);
    setSaved(false);
    setActionError("");
    try {
      const result = await apiRequest<SettingsResponse>("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setLocale(result.settings.locale.toLowerCase().startsWith("zh") ? "zh" : "en");
      setSaved(true);
    } catch (cause) {
      setSettings(previous);
      setActionError(cause instanceof Error ? cause.message : "Your change couldn’t be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <header className="max-w-3xl border-b border-[#ded7cc] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34f3d]">Make this space yours</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Settings</h1>
        <p className="mt-4 text-sm leading-7 text-[#6e685f]">Choose how Amara stays in touch, what can be remembered, and how your time and language are handled.</p>
      </header>

      {actionError && <div className="mt-6 border-l-2 border-[#b75c47] bg-[#f6eae4] px-4 py-3 text-sm text-[#813d30]" role="alert">{actionError} Your previous setting has been restored.</div>}
      {saved && !saving && <p className="mt-5 flex items-center gap-2 text-sm text-[#53634b]" role="status"><Check className="h-4 w-4" />Settings saved.</p>}

      {loading ? <PageLoader label="Opening your settings…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : settings ? (
        <div className="max-w-4xl">
          <section className="border-b border-[#ded7cc] py-8" aria-labelledby="preferences-title">
            <h2 id="preferences-title" className="font-serif text-2xl">Language & time</h2>
            <p className="mt-2 text-sm text-[#6e685f]">Used to make future conversations and nightly moments feel local to you.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#49453e]">
                Preferred language
                <select
                  value={settings.locale}
                  onChange={(event) => void updateSettings({ locale: event.target.value })}
                  disabled={saving}
                  className="mt-2 min-h-12 w-full border border-[#cfc5b7] bg-[#fffdf8] px-3 text-base outline-none focus:border-[#a34f3d] focus:ring-2 focus:ring-[#a34f3d]/15 disabled:opacity-60"
                >
                  <option value="en">English</option>
                  <option value="zh-CN">简体中文</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-[#49453e]">
                Your time zone
                <select
                  value={settings.timezone}
                  onChange={(event) => void updateSettings({ timezone: event.target.value })}
                  disabled={saving}
                  className="mt-2 min-h-12 w-full border border-[#cfc5b7] bg-[#fffdf8] px-3 text-base outline-none focus:border-[#a34f3d] focus:ring-2 focus:ring-[#a34f3d]/15 disabled:opacity-60"
                >
                  {timezones.map((zone) => <option key={zone} value={zone}>{zone}{zone === detectedTimezone ? " (this device)" : ""}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="border-b border-[#ded7cc] py-8" aria-labelledby="continuity-title">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="continuity-title" className="font-serif text-2xl">Continuity</h2>
                <p className="mt-2 text-sm text-[#6e685f]">Changes save immediately and apply to future activity.</p>
              </div>
              {saving && <Loader2 className="h-5 w-5 animate-spin text-[#a34f3d]" aria-label="Saving settings" />}
            </div>
            <div className="mt-4 divide-y divide-[#e4ddd3]">
              <SettingToggle
                title="Memories"
                description="Allow meaningful details to be saved for future conversations. You can review every saved memory."
                checked={settings.memory_enabled}
                disabled={saving}
                onChange={(value) => void updateSettings({ memory_enabled: value })}
              />
              <SettingToggle
                title="Dreams"
                description="Allow Amara to create clearly labeled imaginative reflections after meaningful days."
                checked={settings.dream_enabled}
                disabled={saving}
                onChange={(value) => void updateSettings({ dream_enabled: value })}
              />
            </div>
          </section>

          <section className="py-8" aria-labelledby="control-title">
            <h2 id="control-title" className="font-serif text-2xl">Membership & your data</h2>
            <div className="mt-4 divide-y divide-[#ded7cc] border-y border-[#ded7cc]">
              <Link href="/memories" className="flex min-h-16 items-center justify-between gap-4 py-4 text-sm font-medium hover:text-[#923f30]">
                <span className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-[#a34f3d]" strokeWidth={1.6} />View, correct, or delete memories</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Link>
              <Link href="/cancellation" className="flex min-h-16 items-center justify-between gap-4 py-4 text-sm font-medium hover:text-[#923f30]">
                <span className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-[#a34f3d]" strokeWidth={1.6} />Cancel or manage a membership</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Link>
            </div>
            <p className="mt-6 text-xs leading-6 text-[#817a70]">
              Waffo memberships renew automatically until canceled. Use the customer portal to stop future charges; access continues through the current paid period. Read the <Link href="/privacy" className="font-semibold text-[#6e685f] underline underline-offset-4">privacy policy</Link>.
            </p>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function SettingToggle({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 py-6">
      <div className="max-w-xl">
        <h3 className="text-sm font-semibold text-[#413d36]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[#6e685f]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-11 w-14 shrink-0 disabled:cursor-wait disabled:opacity-60"
      >
        <span className={`absolute left-0 top-1.5 h-8 w-14 rounded-full border transition-colors ${checked ? "border-[#9e4837] bg-[#9e4837]" : "border-[#bdb3a5] bg-[#ddd5ca]"}`} aria-hidden="true" />
        <span className={`absolute top-[11px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-[27px]" : "translate-x-1"}`} aria-hidden="true" />
      </button>
    </div>
  );
}
