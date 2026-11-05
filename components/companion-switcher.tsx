"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useLocale } from "@/components/locale-provider";
import { normalizeCompanionGender, type CompanionGender } from "@/lib/companions";
import { trackProductEvent } from "@/lib/product-events";

type Companion = { id: string; gender: string | null; relationship_type: "friend" | "lover" };
type ListResponse = { companions: Companion[]; activeCompanionId: string | null };

const labels = {
  en: {
    group: "Switch companion. Each profile has separate conversations and memories.",
    female: "Amara · Woman",
    male: "Amara · Man",
    busy: "Opening profile…",
    error: "Couldn’t switch profiles. Please try again.",
  },
  zh: {
    group: "切换陪伴档案。两个档案的对话与记忆完全独立。",
    female: "Amara · 女性",
    male: "Amara · 男性",
    busy: "正在打开档案…",
    error: "暂时无法切换档案，请重试。",
  },
} as const;

export function CompanionSwitcher({ compact = false }: { compact?: boolean }) {
  const { session } = useSessionContext();
  const { locale } = useLocale();
  const copy = labels[locale];
  const [data, setData] = useState<ListResponse | null>(null);
  const [busy, setBusy] = useState<CompanionGender | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const response = await fetch("/api/companion/list?lightweight=1", { cache: "no-store" });
      if (!response.ok) return;
      setData(await response.json());
    } catch { /* Chat and console remain usable if the optional switcher cannot load. */ }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  async function switchTo(gender: CompanionGender) {
    if (!data || busy) return;
    const current = data.companions.find((companion) => companion.id === data.activeCompanionId);
    const target = data.companions.find((companion) => normalizeCompanionGender(companion.gender) === gender);
    if (target && target.id === data.activeCompanionId) return;
    setBusy(gender);
    setError("");
    try {
      let companionId = target?.id;
      if (!companionId) {
        const response = await fetch("/api/companion/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relationship_type: current?.relationship_type || "lover", gender }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "create_failed");
        companionId = result.companion?.id;
      } else {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active_companion_id: companionId }),
        });
        if (!response.ok) throw new Error("activate_failed");
      }
      if (!companionId) throw new Error("missing_companion");
      await trackProductEvent("companion_switched", { companionId, locale, details: { profile: gender } });
      // A clean reload prevents the previous profile's messages, red dots, or
      // asynchronously returning requests from flashing inside the new profile.
      window.location.reload();
    } catch {
      setError(copy.error);
      setBusy(null);
    }
  }

  if (!session || !data) return null;
  const activeGender = normalizeCompanionGender(data.companions.find((companion) => companion.id === data.activeCompanionId)?.gender);

  return (
    <div className={compact ? "text-center" : ""}>
      <div role="group" aria-label={copy.group} className={`inline-flex rounded-full border border-[#d8cfc2] bg-[#fffdf8] p-1 ${busy ? "opacity-60" : ""}`}>
        {(["female", "male"] as const).map((gender) => (
          <button
            key={gender}
            type="button"
            disabled={Boolean(busy)}
            aria-pressed={activeGender === gender}
            onClick={() => void switchTo(gender)}
            className={`min-h-11 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f3d] ${activeGender === gender ? "bg-[#a34f3d] text-white" : "text-[#6e685f] hover:bg-[#f1ece4] hover:text-[#282621]"}`}
          >
            {busy === gender ? copy.busy : copy[gender]}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 max-w-64 text-xs leading-5 text-[#9e4837]">{error}</p>}
    </div>
  );
}
