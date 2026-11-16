"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import useSWR, { SWRConfig } from "swr";
import { ApiError, apiRequest, ErrorState, PageLoader } from "./amara-ui";
import { useLocale } from "./locale-provider";
import { normalizeCompanionGender, type CompanionGender } from "@/lib/companions";
import { trackProductEvent } from "@/lib/product-events";

type Profile = {
  id: string;
  gender: string;
  relationship_type: "friend" | "lover";
  companion_name: string | null;
  user_nickname: string | null;
  persona?: string;
};
type Profiles = { companions: Profile[]; activeCompanionId: string | null };
type Space = {
  profiles?: Profiles;
  reloadProfiles: () => Promise<Profiles | undefined>;
  switchFailed: boolean;
  switchTo: (gender: CompanionGender) => Promise<void>;
};
const SpaceContext = createContext<Space | null>(null);
const cacheConfig = { provider: () => new Map(), shouldRetryOnError: false };
const listUrl = "/api/companion/list?lightweight=1";

export function CompanionSpace({ children }: { children: React.ReactNode }) {
  const { session } = useSessionContext();
  const userId = session?.user.id;
  return <SWRConfig key={userId || "guest"} value={cacheConfig}>
    <AccountSpace userId={userId}>{children}</AccountSpace>
  </SWRConfig>;
}

function AccountSpace({ userId, children }: { userId?: string; children: React.ReactNode }) {
  const { locale } = useLocale();
  const { data: profiles, error, mutate } = useSWR<Profiles>(userId ? listUrl : null, apiRequest);
  const reloadProfiles = useCallback(() => mutate(), [mutate]);
  const switching = useRef(false);
  const [busy, setBusy] = useState<CompanionGender | null>(null);
  const [switchFailed, setSwitchFailed] = useState(false);

  async function switchTo(gender: CompanionGender) {
    if (!profiles || switching.current) return;
    const target = profiles.companions.find((item) => normalizeCompanionGender(item.gender) === gender);
    if (target && target.id === profiles.activeCompanionId) return;
    switching.current = true;
    setBusy(gender);
    setSwitchFailed(false);
    try {
      let next: Profiles;
      if (target) {
        await apiRequest("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active_companion_id: target.id }) });
        next = { ...profiles, activeCompanionId: target.id };
      } else {
        const { companion } = await apiRequest<{ companion: Profile }>("/api/companion/list", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relationship_type: "lover", gender }),
        });
        next = { companions: [...profiles.companions, companion], activeCompanionId: companion.id };
      }
      await mutate(next, { revalidate: false });
      void trackProductEvent("companion_switched", { companionId: next.activeCompanionId, locale, details: { profile: gender } });
    } catch {
      await reloadProfiles();
      setSwitchFailed(true);
    } finally {
      switching.current = false;
      setBusy(null);
    }
  }

  if (userId && error && (!profiles || (error instanceof ApiError && [401, 403].includes(error.status)))) return <ErrorState message={error.message} onRetry={() => void reloadProfiles()} />;
  if ((userId && !profiles) || busy) return <PageLoader label={locale === "zh" ? "正在打开陪伴档案…" : "Opening profile…"} />;
  return <SpaceContext.Provider value={{ profiles, reloadProfiles, switchFailed, switchTo }}>
    <SWRConfig key={profiles?.activeCompanionId || "empty"} value={cacheConfig}>{children}</SWRConfig>
  </SpaceContext.Provider>;
}

export function useCompanionSpace() {
  const space = useContext(SpaceContext);
  if (!space) throw new Error("Missing companion space");
  return space;
}
