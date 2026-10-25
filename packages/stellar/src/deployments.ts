import { getNetworkConfig, type StellarNetwork } from "./network";

/**
 * The contracts the platform shares across every vault. Deployed once by
 * `contracts/scripts/deploy-shared.sh`, which writes the addresses to
 * `deployments/<network>.json`; `scripts/print-env.sh` turns that file into the
 * variables read here.
 */
export interface SharedContracts {
  usdc: string;
  claimTopicsAndIssuers: string;
  claimIssuer: string;
  identityRegistry: string;
  identityVerifier: string;
  factory: string;
  milestoneTracker: string;
}

/** The three contracts the factory deploys for one vault. */
export interface VaultContracts {
  vaultId: string;
  token: string;
  compliance: string;
  vault: string;
}

function read(name: string): string {
  return process.env[name] ?? "";
}

export function getSharedContracts(): SharedContracts {
  return {
    usdc: read("NEXT_PUBLIC_STELLAR_USDC_CONTRACT_ID"),
    claimTopicsAndIssuers: read("NEXT_PUBLIC_CLAIM_TOPICS_CONTRACT_ID"),
    claimIssuer: read("NEXT_PUBLIC_CLAIM_ISSUER_CONTRACT_ID"),
    identityRegistry: read("NEXT_PUBLIC_IDENTITY_REGISTRY_CONTRACT_ID"),
    identityVerifier: read("NEXT_PUBLIC_IDENTITY_VERIFIER_CONTRACT_ID"),
    factory: read("NEXT_PUBLIC_FACTORY_CONTRACT_ID"),
    milestoneTracker: read("NEXT_PUBLIC_MILESTONE_TRACKER_CONTRACT_ID"),
  };
}

/**
 * Names the shared contracts that have no address configured, so a page can
 * say what is missing instead of failing on an empty contract id.
 */
export function missingSharedContracts(
  contracts: SharedContracts = getSharedContracts()
): string[] {
  return Object.entries(contracts)
    .filter(([, address]) => address === "")
    .map(([name]) => name);
}

/** Claim topics every holder of a Neko vault token must satisfy. */
export const CLAIM_TOPIC = { KYC: 1, AML: 2 } as const;

/**
 * Basis points, as the vault counts them: 10_000 is 100%. A vault's rate and
 * its exit fee are both expressed this way.
 */
export const BPS_DENOMINATOR = 10_000;

/** What a vault of `target` at `rateBps` has to repay in total. */
export function expectedRepayment(target: bigint, rateBps: number): bigint {
  return target + (target * BigInt(rateBps)) / BigInt(BPS_DENOMINATOR);
}

/**
 * An investor's share of a settled vault: their tokens over the supply frozen
 * at settlement, applied to everything left to distribute.
 */
export function payoutFor(
  distributable: bigint,
  balance: bigint,
  supplyAtSettlement: bigint
): bigint {
  if (supplyAtSettlement <= 0n) {
    return 0n;
  }
  return (distributable * balance) / supplyAtSettlement;
}

export function networkOf(network?: StellarNetwork): StellarNetwork {
  return network ?? getNetworkConfig().network;
}
