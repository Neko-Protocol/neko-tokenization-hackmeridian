import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  type xdr,
} from "@stellar/stellar-sdk";

import { getHorizonServer, getRpcServer } from "./clients";
import {
  getSharedContracts,
  getUsdcAsset,
  PLATFORM_ACCOUNTS,
} from "./deployments";
import { getNetworkConfig, type NetworkConfig } from "./network";

/**
 * Read-only views of the Neko contracts. Every call here is a simulation: it
 * costs nothing, needs no signature and reads straight off the ledger, so a
 * page never has to trust the backend for a vault's state.
 */

// ------------------------------------------------------------------ Arguments

/** Soroban argument encoders, for the types the Neko contracts take. */
export const arg = {
  address: (value: string): xdr.ScVal => Address.fromString(value).toScVal(),
  u32: (value: number): xdr.ScVal => nativeToScVal(value, { type: "u32" }),
  u64: (value: number | bigint): xdr.ScVal =>
    nativeToScVal(BigInt(value), { type: "u64" }),
  i128: (value: bigint): xdr.ScVal => nativeToScVal(value, { type: "i128" }),
  bool: (value: boolean): xdr.ScVal => nativeToScVal(value),
  string: (value: string): xdr.ScVal =>
    nativeToScVal(value, { type: "string" }),
  /** A `BytesN<32>` given as 64 hex characters. */
  bytes32: (hex: string): xdr.ScVal =>
    nativeToScVal(hexToBytes(hex), { type: "bytes" }),
};

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 of a file or text, as the 64 hex characters a `BytesN<32>` takes. */
export async function sha256Hex(data: BufferSource | string): Promise<string> {
  const input =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToHex(new Uint8Array(digest));
}

// ---------------------------------------------------------------- Simulation

export class ContractCallError extends Error {
  constructor(
    message: string,
    /** The contract's own error code, when the failure was a contract panic. */
    readonly code: number | null
  ) {
    super(message);
    this.name = "ContractCallError";
  }
}

/** Pull `Error(Contract, #n)` out of a simulation or submission failure. */
export function contractErrorCode(message: string): number | null {
  const match = /Error\(Contract, #(\d+)\)/.exec(message);
  return match ? Number(match[1]) : null;
}

/** Simulate a view call and decode its result to plain JavaScript. */
export async function readContract<T>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
  config: NetworkConfig = getNetworkConfig()
): Promise<T> {
  // A simulation is never submitted, so any well-formed source will do and no
  // account has to be loaded first.
  const source = new Account(PLATFORM_ACCOUNTS.admin, "0");
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await getRpcServer(config).simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new ContractCallError(sim.error, contractErrorCode(sim.error));
  }
  if (!sim.result) {
    throw new ContractCallError(`${method} returned nothing`, null);
  }
  return scValToNative(sim.result.retval) as T;
}

/** A unit enum variant comes back as `["Funding"]`; take the name. */
function variant(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0]);
  }
  return String(value);
}

// --------------------------------------------------------------------- Vault

export type VaultState = "Funding" | "Funded" | "Active" | "Settled" | "Failed";

export interface VaultConfig {
  token: string;
  usdc: string;
  borrower: string;
  target: bigint;
  min_target: bigint;
  expected_repayment: bigint;
  /** Unix seconds. */
  funding_deadline: bigint;
  max_exit_fee_bps: number;
  fee_recipient: string;
}

export interface VaultTranche {
  index: number;
  expected_amount: bigint;
  /** Unix seconds. */
  due_date: bigint;
  /** `0` while unpaid. */
  paid_amount: bigint;
  paid_at: bigint;
  evidence_uri: string;
}

export interface VaultSnapshot {
  state: VaultState;
  config: VaultConfig;
  raised: bigint;
  repaid: bigint;
  earlyExitPaid: bigint;
  exitFeeBps: number;
  tranches: VaultTranche[];
}

export async function readVault(vault: string): Promise<VaultSnapshot> {
  const [state, config, raised, repaid, earlyExitPaid, exitFeeBps, tranches] =
    await Promise.all([
      readContract<unknown>(vault, "get_state"),
      readContract<VaultConfig>(vault, "get_config"),
      readContract<bigint>(vault, "raised"),
      readContract<bigint>(vault, "repaid"),
      readContract<bigint>(vault, "early_exit_paid"),
      readContract<number>(vault, "exit_fee"),
      readContract<VaultTranche[]>(vault, "list_tranches"),
    ]);
  return {
    state: variant(state) as VaultState,
    config,
    raised,
    repaid,
    earlyExitPaid,
    exitFeeBps,
    tranches,
  };
}

/** What a holder would collect from `redeem` now (0 before settlement). */
export function readClaimable(vault: string, investor: string) {
  return readContract<bigint>(vault, "claimable", [arg.address(investor)]);
}

/** What a holder would collect from `early_exit` now. */
export function readExitValue(vault: string, investor: string) {
  return readContract<bigint>(vault, "exit_value", [arg.address(investor)]);
}

/** A holder's vault token balance. The RWA token names the argument `account`. */
export function readTokenBalance(token: string, account: string) {
  return readContract<bigint>(token, "balance", [arg.address(account)]);
}

// ------------------------------------------------------------------- Factory

export interface FactoryDeployment {
  vault_id: Uint8Array;
  issuer: string;
  token: string;
  compliance: string;
  vault: string;
  metadata_hash: Uint8Array;
  metadata_uri: string;
  created_at: bigint;
  wired: boolean;
}

export function readDeployment(vaultIdHex: string) {
  return readContract<FactoryDeployment>(
    getSharedContracts().factory,
    "get_deployment",
    [arg.bytes32(vaultIdHex)]
  );
}

// ----------------------------------------------------------- Milestone tracker

export type MilestoneStatus = "Pending" | "Submitted" | "Approved" | "Rejected";

export interface Milestone {
  index: number;
  title: string;
  evidence_hash: string;
  evidence_uri: string;
  status: MilestoneStatus;
  updated_at: bigint;
  updated_by: string;
}

interface RawMilestone extends Omit<Milestone, "status" | "evidence_hash"> {
  status: unknown;
  evidence_hash: Uint8Array;
}

export async function readMilestones(vaultIdHex: string): Promise<Milestone[]> {
  const raw = await readContract<RawMilestone[]>(
    getSharedContracts().milestoneTracker,
    "list_milestones",
    [arg.bytes32(vaultIdHex)]
  );
  return raw.map((m) => ({
    ...m,
    status: variant(m.status) as MilestoneStatus,
    evidence_hash: bytesToHex(m.evidence_hash),
  }));
}

// ---------------------------------------------------------------- Accounts

export interface UsdcAccount {
  /** The account exists on the ledger. */
  exists: boolean;
  /** It can receive USDC: a trustline to the test USDC issuer is open. */
  trustline: boolean;
  /** USDC balance in base units. */
  balance: bigint;
}

/**
 * Whether an account can hold USDC and how much it has. Classic accounts need
 * a trustline before the vault can pay them, so the launch and invest flows
 * check this first.
 */
export async function readUsdcAccount(address: string): Promise<UsdcAccount> {
  const { code, issuer } = getUsdcAsset();
  try {
    const account = await getHorizonServer().loadAccount(address);
    const line = account.balances.find(
      (b) =>
        "asset_code" in b && b.asset_code === code && b.asset_issuer === issuer
    );
    return {
      exists: true,
      trustline: Boolean(line),
      balance: line ? toBaseUnits(line.balance) : 0n,
    };
  } catch (error) {
    if (
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return { exists: false, trustline: false, balance: 0n };
    }
    throw error;
  }
}

/** Horizon balances are 7-decimal strings already; read them without floats. */
function toBaseUnits(balance: string): bigint {
  const [whole, fraction = ""] = balance.split(".");
  return (
    BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0").slice(0, 7))
  );
}
