"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { BackendError } from "@/lib/services/backend-client";
import { launchpadApi } from "@/lib/services/launchpad.api";
import { accountKeys } from "./accountKeys";

export function useLaunchpadAccount() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();

  return useQuery({
    queryKey: accountKeys.me(user?.id ?? null),
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No Privy access token");
      try {
        return await launchpadApi.me(token);
      } catch (err) {
        if (err instanceof BackendError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: ready && authenticated && Boolean(user),
    staleTime: 60_000,
    retry: 1,
  });
}
