"use client";

import useSWR from "swr";
import { ApiError, apiRequest } from "@/components/amara-ui";
import { useCompanionSpace } from "@/components/companion-space";
import { useMembership } from "@/components/membership-provider";

export function useConsoleKey(path: string) {
  const { profiles } = useCompanionSpace();
  const { tier } = useMembership();
  if (!profiles) return null;
  const id = profiles.activeCompanionId;
  const url = id ? path + (path.includes("?") ? "&" : "?") + "companion_id=" + encodeURIComponent(id) : path;
  return [url, tier] as const;
}

export function useConsoleQuery<T>(path: string) {
  const key = useConsoleKey(path);
  const query = useSWR<T>(key, ([url]: readonly [string, string]) => apiRequest<T>(url));
  const denied = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status);
  const data = denied ? undefined : query.data;
  return { ...query, data, loading: !data && query.isLoading, errorMessage: !data && query.error ? query.error.message : "" };
}
