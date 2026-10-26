"use client";

import { useCallback } from "react";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import type { Transaction } from "@stellar/stellar-sdk";
import type { TransactionSigner } from "@neko-tokenization/stellar";
import { useAccount } from "@/features/dashboard";

function hexToBase64(hex: string): string {
  const clean = hex.replace(/^0x/, "");
  let binary = "";
  for (let i = 0; i < clean.length; i += 2) {
    binary += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  return btoa(binary);
}

/**
 * Signs Stellar transactions with the issuer's Privy embedded wallet. Privy
 * signs the 32-byte transaction hash on the ed25519 curve; the signature is
 * then attached as a classic envelope signature. The wallet is the source of
 * every transaction it signs, so that one signature also covers the
 * `require_auth` of the vault or tracker call inside.
 */
export function useIssuerSigner(): {
  address: string;
  sign: TransactionSigner;
} {
  const { wallet } = useAccount();
  const { signRawHash } = useSignRawHash();

  const sign = useCallback<TransactionSigner>(
    async (tx: Transaction) => {
      const hash = `0x${tx.hash().toString("hex")}` as const;
      const { signature } = await signRawHash({
        address: wallet.address,
        chainType: "stellar",
        hash,
      });
      tx.addSignature(wallet.address, hexToBase64(signature));
      return tx;
    },
    [signRawHash, wallet.address]
  );

  return { address: wallet.address, sign };
}
