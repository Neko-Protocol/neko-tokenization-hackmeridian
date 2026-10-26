"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import {
  launchpadApi,
  type CreateApplicationInput,
} from "@/lib/services/launchpad.api";
import { applicationKeys } from "./applicationKeys";

export function useMyApplications() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  return useQuery({
    queryKey: applicationKeys.mine(user?.id ?? null),
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No Privy access token");
      return launchpadApi.myApplications(token);
    },
    enabled: ready && authenticated && Boolean(user),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateApplication() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateApplicationInput) => {
      const token = await getAccessToken();
      if (!token) throw new Error("No Privy access token");
      return launchpadApi.createApplication(token, input);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
  });
}

export function useSkipReview() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error("No Privy access token");
      return launchpadApi.skipReview(token, id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
  });
}
