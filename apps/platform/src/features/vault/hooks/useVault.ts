"use client";

import { useQuery } from "@tanstack/react-query";
import {
  readMilestones,
  readUsdcAccount,
  readVault,
} from "@neko-tokenization/stellar";
import { vaultKeys } from "./vaultKeys";

/** A vault's state, terms and tranches, read straight from the ledger. */
export function useVaultSnapshot(vault: string | null | undefined) {
  return useQuery({
    queryKey: vaultKeys.snapshot(vault ?? ""),
    queryFn: () => readVault(vault!),
    enabled: Boolean(vault),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** The milestones the issuer committed to, from the on-chain tracker. */
export function useMilestones(vaultId: string | null | undefined) {
  return useQuery({
    queryKey: vaultKeys.milestones(vaultId ?? ""),
    queryFn: () => readMilestones(vaultId!),
    enabled: Boolean(vaultId),
    staleTime: 15_000,
  });
}

/** Whether `address` can hold USDC and its balance. */
export function useUsdcAccount(address: string | null | undefined) {
  return useQuery({
    queryKey: vaultKeys.usdc(address ?? ""),
    queryFn: () => readUsdcAccount(address!),
    enabled: Boolean(address),
    staleTime: 10_000,
  });
}
