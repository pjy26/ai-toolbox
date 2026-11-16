"use client";

import { useCompanionSpace } from "@/components/companion-space";
import { useLocale } from "@/components/locale-provider";
import { normalizeCompanionGender } from "@/lib/companions";

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
  const { locale } = useLocale();
  const copy = labels[locale];
  const { profiles: data, switchTo, switchFailed } = useCompanionSpace();
  if (!data) return null;
  const activeGender = normalizeCompanionGender(data.companions.find((companion) => companion.id === data.activeCompanionId)?.gender);

  return (
    <div className={compact ? "text-center" : ""}>
      <div role="group" aria-label={copy.group} className="inline-flex rounded-full border border-[#d8cfc2] bg-[#fffdf8] p-1">
        {(["female", "male"] as const).map((gender) => (
          <button
            key={gender}
            type="button"
            aria-pressed={activeGender === gender}
            onClick={() => void switchTo(gender)}
            className={`min-h-11 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34f3d] ${activeGender === gender ? "bg-[#a34f3d] text-white" : "text-[#6e685f] hover:bg-[#f1ece4] hover:text-[#282621]"}`}
          >
            {copy[gender]}
          </button>
        ))}
      </div>
      {switchFailed && <p role="alert" className="mt-2 max-w-64 text-xs leading-5 text-[#9e4837]">{copy.error}</p>}
    </div>
  );
}
