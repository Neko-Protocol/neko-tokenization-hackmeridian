import deployments from "../../../deployments/testnet.json";

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

/**
 * The addresses recorded by the deploy scripts. Environment variables win, so a
 * deployment can point the apps elsewhere without touching this file.
 */
const testnet = deployments.shared;

/**
 * Circle's USDC on testnet, the asset vaults raise in. Neko can't mint it:
 * people get test funds from Circle's faucet.
 */
export const CIRCLE_TESTNET_USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  contract: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  faucetUrl: "https://faucet.circle.com",
} as const;

// Each variable is read by its literal name: Next.js only inlines
// `NEXT_PUBLIC_*` values it can see written out in full, so a dynamic
// `process.env[name]` comes back empty in the browser.
export function getSharedContracts(): SharedContracts {
  return {
    usdc:
      process.env.NEXT_PUBLIC_STELLAR_USDC_CONTRACT_ID ||
      CIRCLE_TESTNET_USDC.contract,
    claimTopicsAndIssuers:
      process.env.NEXT_PUBLIC_CLAIM_TOPICS_CONTRACT_ID ||
      testnet.claim_topics_and_issuers,
    claimIssuer:
      process.env.NEXT_PUBLIC_CLAIM_ISSUER_CONTRACT_ID || testnet.claim_issuer,
    identityRegistry:
      process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_CONTRACT_ID ||
      testnet.identity_registry,
    identityVerifier:
      process.env.NEXT_PUBLIC_IDENTITY_VERIFIER_CONTRACT_ID ||
      testnet.identity_verifier,
    factory: process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ID || testnet.factory,
    milestoneTracker:
      process.env.NEXT_PUBLIC_MILESTONE_TRACKER_CONTRACT_ID ||
      testnet.milestone_tracker,
  };
}

/**
 * The classic asset behind the USDC contract, for trustlines. Must match the
 * backend's NEKO_USDC_ASSET.
 */
export function getUsdcAsset(): { code: string; issuer: string } {
  return {
    code: process.env.NEXT_PUBLIC_STELLAR_USDC_CODE || CIRCLE_TESTNET_USDC.code,
    issuer:
      process.env.NEXT_PUBLIC_STELLAR_USDC_ISSUER || CIRCLE_TESTNET_USDC.issuer,
  };
}

/**
 * Where to get test USDC when Neko can't mint it (Circle's), or null when the
 * backend faucet pays a Neko-issued test asset.
 */
export function getUsdcFaucetUrl(): string | null {
  return getUsdcAsset().issuer === CIRCLE_TESTNET_USDC.issuer
    ? CIRCLE_TESTNET_USDC.faucetUrl
    : null;
}

/** The platform accounts that hold the admin and manager roles. */
export const PLATFORM_ACCOUNTS = deployments.accounts;

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
