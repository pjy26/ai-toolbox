"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import type { MembershipTier } from "@/lib/membership-plans";

export type MembershipSnapshot = {
  tier: MembershipTier;
  isMember: boolean;
  membershipType: string | null;
  expiresAt: string | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const MembershipContext = createContext<MembershipSnapshot | null>(null);

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const userId = session?.user.id || null;
  const [state, setState] = useState<Omit<MembershipSnapshot, "refresh">>({
    tier: "free",
    isMember: false,
    membershipType: null,
    expiresAt: null,
    loading: true,
    error: "",
  });

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({ tier: "free", isMember: false, membershipType: null, expiresAt: null, loading: sessionLoading, error: "" });
      return;
    }
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch("/api/companion/quota", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Membership unavailable");
      const tier: MembershipTier = data.tier === "premium" || data.tier === "plus" ? data.tier : "free";
      setState({
        tier,
        isMember: tier !== "free",
        membershipType: typeof data.membershipType === "string" ? data.membershipType : null,
        expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null,
        loading: false,
        error: "",
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Membership unavailable" }));
    }
  }, [sessionLoading, userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<MembershipSnapshot>(() => ({ ...state, refresh }), [state, refresh]);
  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMembership() {
  const value = useContext(MembershipContext);
  if (!value) throw new Error("useMembership must be used inside MembershipProvider");
  return value;
}
