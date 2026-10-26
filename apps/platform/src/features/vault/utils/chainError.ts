import { ContractCallError } from "@neko-tokenization/stellar";
import { BackendError } from "@/lib/services/backend-client";

/** The vault's error codes, from `contracts/vault/src/contract.rs`. */
const VAULT_ERRORS: Record<number, string> = {
  1: "The vault isn't in the right stage for that yet.",
  2: "Enter an amount above 0.",
  3: "That would take the raise past its target.",
  4: "The funding deadline has passed.",
  5: "This wallet holds no tokens in the vault.",
  6: "The vault doesn't hold enough USDC for that yet.",
  7: "That fee is above the vault's cap.",
  8: "There's no repayment with that number.",
  9: "That repayment was already made.",
  10: "The vault's terms don't add up.",
  11: "Tokens are still outstanding.",
};

/** The milestone tracker's error codes. */
const TRACKER_ERRORS: Record<number, string> = {
  2: "This vault has no milestones on record.",
  3: "There's no milestone with that number.",
  4: "That milestone can't be submitted in its current status.",
};

export function chainErrorMessage(
  err: unknown,
  source: "vault" | "tracker" = "vault"
): string {
  if (err instanceof BackendError) {
    switch (err.code) {
      case "TRUSTLINE_MISSING":
        return "Your wallet can't receive USDC yet. Open the USDC trustline first.";
      case "CHAIN_NOT_CONFIGURED":
        return "Neko's testnet keys aren't set up on the backend yet.";
      case "LAUNCH_IN_PROGRESS":
        return "This launch is already running. Give it a minute.";
      case "BACKEND_UNREACHABLE":
        return "The Neko backend is not reachable.";
      default:
        return err.message;
    }
  }
  if (err instanceof ContractCallError) {
    const table = source === "vault" ? VAULT_ERRORS : TRACKER_ERRORS;
    if (err.code !== null && table[err.code]) return table[err.code];
    if (/insufficient|underfunded|balance/i.test(err.message))
      return "Your wallet doesn't hold enough USDC for that.";
    return err.message;
  }
  if (err instanceof Error) {
    if (/reject|denied|cancel/i.test(err.message))
      return "You cancelled the signature.";
    return err.message;
  }
  return "Something went wrong. Try again.";
}
