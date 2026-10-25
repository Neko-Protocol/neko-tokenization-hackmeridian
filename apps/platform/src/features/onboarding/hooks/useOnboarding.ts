"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  launchpadApi,
  type LaunchpadAccount,
  type StartedVerification,
  type VerificationKind,
  type VerificationStatus,
} from "@/lib/services/launchpad.api";
import {
  loadSession,
  saveSession,
  type OnboardingSession,
} from "../utils/onboardingSession";
import { isDeadSession, onboardingErrorMessage } from "../utils/errorMessage";
import { verificationKeys } from "./verificationKeys";

export type OnboardingStep = "choose" | "verify" | "email" | "done";

const POLL_MS = 4_000;
const FINAL: ReadonlySet<VerificationStatus> = new Set([
  "approved",
  "declined",
  "expired",
]);

export function useOnboarding() {
  const queryClient = useQueryClient();
  // Rendered client-side only (Home waits for Privy), so reading storage here is safe.
  const [session, setSession] = useState<OnboardingSession | null>(loadSession);
  const [account, setAccount] = useState<LaunchpadAccount | null>(null);

  const verification = useQuery({
    queryKey: verificationKeys.detail(session?.verificationId ?? null),
    queryFn: () =>
      launchpadApi.getVerification(
        session!.verificationId,
        session!.claimToken
      ),
    enabled: Boolean(session) && !account,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data && FINAL.has(query.state.data.status) ? false : POLL_MS,
    retry: (count, err) => !isDeadSession(err) && count < 2,
  });

  useEffect(() => {
    if (!session) return;
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        (event.data as { type?: string })?.type === "didit:complete"
      ) {
        void queryClient.invalidateQueries({
          queryKey: verificationKeys.detail(session.verificationId),
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [session, queryClient]);

  const adopt = useCallback(
    (kind: VerificationKind, started: StartedVerification) => {
      const next: OnboardingSession = {
        kind,
        verificationId: started.verification.id,
        claimToken: started.claim_token,
        sessionUrl: started.session_url,
      };
      saveSession(next);
      queryClient.setQueryData(
        verificationKeys.detail(next.verificationId),
        started.verification
      );
      setSession(next);
    },
    [queryClient]
  );

  const start = useMutation({
    mutationFn: (kind: VerificationKind) =>
      launchpadApi.startVerification(kind),
    onSuccess: (started, kind) => adopt(kind, started),
  });

  const startMock = useMutation({
    mutationFn: ({ kind, name }: { kind: VerificationKind; name: string }) =>
      launchpadApi.startMockVerification(kind, name),
    onSuccess: (started, { kind }) => adopt(kind, started),
  });

  const createAccount = useMutation({
    mutationFn: (email: string) =>
      launchpadApi.createAccount(
        session!.verificationId,
        session!.claimToken,
        email
      ),
    onSuccess: (created) => {
      saveSession(null);
      setAccount(created);
    },
  });

  const deadSession = isDeadSession(verification.error);
  const current = account?.verification ?? verification.data ?? null;

  let step: OnboardingStep;
  if (account) step = "done";
  else if (!session || deadSession) step = "choose";
  else if (current?.status === "approved") step = "email";
  else step = "verify";

  const error =
    start.error ??
    startMock.error ??
    createAccount.error ??
    (verification.error && !deadSession ? verification.error : null);

  const reset = useCallback(() => {
    saveSession(null);
    setSession(null);
    setAccount(null);
    start.reset();
    startMock.reset();
    createAccount.reset();
  }, [start, startMock, createAccount]);

  return {
    step,
    session,
    verification: current,
    account,
    busy: start.isPending || startMock.isPending || createAccount.isPending,
    error: error ? onboardingErrorMessage(error) : null,
    start: (kind: VerificationKind) => start.mutate(kind),
    startMock: (kind: VerificationKind, name: string) =>
      startMock.mutate({ kind, name }),
    createAccount: (email: string) => createAccount.mutate(email),
    checkNow: () => void verification.refetch(),
    reset,
  };
}
