"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import {
  buildUsdcTrustline,
  readUsdcAccount,
  signAndSubmit,
} from "@neko-tokenization/stellar";
import { applicationKeys } from "@/features/application";
import { useIssuerSigner } from "@/features/vault/hooks/useIssuerSigner";
import {
  launchpadApi,
  type Application,
  type LaunchInput,
} from "@/lib/services/launchpad.api";

export type LaunchPhase = "idle" | "trustline" | "deploy" | "done";

/**
 * Launch an approved application in two moves:
 *
 * 1. The issuer's wallet opens a USDC trustline, signed with Privy. The vault
 *    pays the raise out to that wallet, and a classic account cannot receive
 *    an asset it does not trust.
 * 2. The backend deploys and wires the token, compliance contract and vault
 *    with the platform keys, which the issuer never holds.
 *
 * Both moves are safe to repeat, so retrying after a failure resumes.
 */
export function useLaunch(app: Application) {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const { address, sign } = useIssuerSigner();
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [trustlineTx, setTrustlineTx] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: LaunchInput) => {
      setPhase("trustline");
      const usdc = await readUsdcAccount(address);
      if (!usdc.exists)
        throw new Error(
          "Your wallet isn't funded on testnet yet. Try again in a minute."
        );
      if (!usdc.trustline) {
        setTrustlineTx(
          await signAndSubmit(() => buildUsdcTrustline(address), sign)
        );
      }

      setPhase("deploy");
      const token = await getAccessToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const launched = await launchpadApi.launchApplication(
        token,
        app.id,
        input
      );
      if (launched.deployment?.status === "failed") {
        const error = launched.deployment.error;
        throw new Error(
          error
            ? `Launch stopped at ${error.step.replace(/_/g, " ")}: ${error.message}`
            : "Launch failed."
        );
      }
      setPhase("done");
      return launched;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
  });

  return { ...mutation, phase, trustlineTx, address };
}
