import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

/**
 * Everything about the vault that is fixed when it is created.
 */
export interface Config {
  borrower: string;
  /**
   * Principal plus interest, in USDC units. The rate itself lives off-chain.
   */
  expected_repayment: i128;
  fee_recipient: string;
  funding_deadline: u64;
  /**
   * The ceiling the exit fee can never pass. Deliberately has no setter: it
   * is what an investor is shown before committing.
   */
  max_exit_fee_bps: u32;
  min_target: i128;
  target: i128;
  token: string;
  usdc: string;
}

/**
 * One scheduled repayment from the borrower.
 */
export interface Tranche {
  due_date: u64;
  evidence_uri: string;
  expected_amount: i128;
  index: u32;
  /**
   * Still `0` while the tranche is unpaid; `repay` rejects amounts of zero,
   * so this doubles as the "already paid" flag.
   */
  paid_amount: i128;
  /**
   * Ledger timestamp of the payment.
   */
  paid_at: u64;
}

export const VaultError = {
  /**
   * The call is not valid in the vault's current state.
   */
  1: { message: "InvalidState" },
  /**
   * Amount must be greater than zero.
   */
  2: { message: "InvalidAmount" },
  /**
   * The vault would raise more than its target.
   */
  3: { message: "TargetExceeded" },
  /**
   * The funding deadline has passed.
   */
  4: { message: "FundingClosed" },
  /**
   * The caller holds no tokens in this vault.
   */
  5: { message: "NothingToRedeem" },
  /**
   * The vault does not hold enough USDC to settle this early exit.
   */
  6: { message: "InsufficientLiquidity" },
  /**
   * The requested exit fee is above the vault's immutable cap.
   */
  7: { message: "FeeAboveCap" },
  /**
   * No tranche with that index.
   */
  8: { message: "UnknownTranche" },
  /**
   * That tranche was already paid.
   */
  9: { message: "TranchePaid" },
  /**
   * The constructor arguments do not describe a workable vault.
   */
  10: { message: "InvalidConfig" },
  /**
   * Tokens are still outstanding.
   */
  11: { message: "SupplyOutstanding" },
};

export type VaultState =
  | { tag: "Funding"; values: void }
  | { tag: "Funded"; values: void }
  | { tag: "Active"; values: void }
  | { tag: "Settled"; values: void }
  | { tag: "Failed"; values: void };

/**
 * A tranche as given to the constructor, before anything is paid.
 */
export interface TrancheInit {
  due_date: u64;
  expected_amount: i128;
}

export const RoleTransferError = {
  2200: { message: "NoPendingTransfer" },
  2201: { message: "InvalidLiveUntilLedger" },
  2202: { message: "InvalidPendingAccount" },
  2203: { message: "TransferExpired" },
};

export const AccessControlError = {
  2000: { message: "Unauthorized" },
  2001: { message: "AdminNotSet" },
  2002: { message: "IndexOutOfBounds" },
  2003: { message: "AdminRoleNotFound" },
  2004: { message: "RoleCountIsNotZero" },
  2005: { message: "RoleNotFound" },
  2006: { message: "AdminAlreadySet" },
  2007: { message: "RoleNotHeld" },
  2008: { message: "RoleIsEmpty" },
  2009: { message: "TransferInProgress" },
  2010: { message: "MaxRolesExceeded" },
};

export interface Client {
  /**
   * Construct and simulate a repay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pay one tranche. The vault settles once the total reaches
   * `expected_repayment`, freezing the supply the payout is divided over.
   */
  repay: (
    {
      tranche_index,
      amount,
      evidence_uri,
    }: { tranche_index: u32; amount: i128; evidence_uri: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a invest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit `amount` of USDC and receive the same number of vault tokens.
   *
   * The mint runs the token's identity check on `investor`, so a wallet
   * without verified KYC claims cannot invest.
   */
  invest: (
    { investor, amount }: { investor: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a raised transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  raised: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Collect principal plus the share of interest earned by the tokens held.
   */
  redeem: (
    { investor }: { investor: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Take back a deposit at par after a round that failed to fill.
   */
  refund: (
    { investor }: { investor: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a repaid transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  repaid: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a release transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Send the raise to the borrower and start the repayment period.
   */
  release: (
    { operator }: { operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a exit_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  exit_fee: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a has_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns `Some(index)` if the account has the specified role,
   * where `index` is the position of the account for that role,
   * and can be used to query [`AccessControl::get_role_member()`].
   * Returns `None` if the account does not have the specified role.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `account` - The account to check.
   * * `role` - The role to check for.
   */
  has_role: (
    { account, role }: { account: string; role: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Option<u32>>>;

  /**
   * Construct and simulate a claimable transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * What `investor` would collect from `redeem`, or `0` before settlement.
   */
  claimable: (
    { investor }: { investor: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the admin account.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   */
  get_admin: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Option<string>>>;

  /**
   * Construct and simulate a get_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_state: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<VaultState>>;

  /**
   * Construct and simulate a early_exit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Leave before maturity: capital back minus the exit fee, no interest.
   *
   * Paid out of whatever the borrower has repaid so far, so a large holder
   * may have to wait for a few tranches before there is enough to buy them
   * out. Reverting rather than part-paying is also what keeps
   * `early_exit_paid` from ever passing `repaid`, which is what makes the
   * redemption pool safe from going short.
   */
  early_exit: (
    { investor }: { investor: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a exit_value transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * What `investor` would collect from `early_exit` right now.
   */
  exit_value: (
    { investor }: { investor: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Config>>;

  /**
   * Construct and simulate a grant_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Grants a role to an account.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `account` - The account to grant the role to.
   * * `role` - The role to grant.
   * * `caller` - The address of the caller, must be the admin or have the
   * `RoleAdmin` for the `role`.
   *
   * # Errors
   *
   * * [`AccessControlError::Unauthorized`] - If the caller does not have
   * enough privileges.
   * * [`AccessControlError::MaxRolesExceeded`] - If adding a new role would
   * exceed the maximum allowed number of roles.
   *
   * # Events
   *
   * * topics - `["role_granted", role: Symbol, account: Address]`
   * * data - `[caller: Address]`
   */
  grant_role: (
    {
      account,
      role,
      caller,
    }: { account: string; role: string; caller: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a sweep_dust transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Send the rounding dust left after every investor has redeemed.
   */
  sweep_dust: (
    { operator }: { operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_tranche transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_tranche: (
    { index }: { index: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Tranche>>;

  /**
   * Construct and simulate a revoke_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Revokes a role from an account.
   * To revoke the caller's own role, use
   * [`AccessControl::renounce_role()`] instead.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `account` - The account to revoke the role from.
   * * `role` - The role to revoke.
   * * `caller` - The address of the caller, must be the admin or has the
   * `RoleAdmin` for the `role`.
   *
   * # Errors
   *
   * * [`AccessControlError::Unauthorized`] - If the `caller` does not have
   * enough privileges.
   * * [`AccessControlError::RoleNotHeld`] - If the `account` doesn't have
   * the role.
   * * [`AccessControlError::RoleIsEmpty`] - If the role has no members.
   *
   * # Events
   *
   * * topics - `["role_revoked", role: Symbol, account: Address]`
   * * data - `[caller: Address]`
   */
  revoke_role: (
    {
      account,
      role,
      caller,
    }: { account: string; role: string; caller: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_exit_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Change the exit fee, never above the cap fixed when the vault was created.
   */
  set_exit_fee: (
    { bps, operator }: { bps: u32; operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a close_funding transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Close the round: `Funded` if it reached its minimum, `Failed` if not.
   */
  close_funding: (
    { operator }: { operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a list_tranches transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_tranches: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Array<Tranche>>>;

  /**
   * Construct and simulate a renounce_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Allows an account to renounce a role assigned to itself.
   * Users can only renounce roles for their own account.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `role` - The role to renounce.
   * * `caller` - The address of the caller, must be the account that has the
   * role.
   *
   * # Errors
   *
   * * [`AccessControlError::RoleNotHeld`] - If the `caller` doesn't have the
   * role.
   * * [`AccessControlError::RoleIsEmpty`] - If the role has no members.
   *
   * # Events
   *
   * * topics - `["role_revoked", role: Symbol, account: Address]`
   * * data - `[caller: Address]`
   */
  renounce_role: (
    { role, caller }: { role: string; caller: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_role_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the admin role for a specific role.
   * If no admin role is explicitly set, returns `None`.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `role` - The role to query the admin role for.
   */
  get_role_admin: (
    { role }: { role: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Option<string>>>;

  /**
   * Construct and simulate a renounce_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Allows the current admin to renounce their role, making the contract
   * permanently admin-less. This is useful for decentralization purposes
   * or when the admin role is no longer needed. Once the admin is
   * renounced, it cannot be reinstated.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   *
   * # Errors
   *
   * * [`AccessControlError::AdminNotSet`] - If no admin account is set.
   *
   * # Events
   *
   * * topics - `["admin_renounced", admin: Address]`
   * * data - `[]`
   *
   * # Notes
   *
   * * Authorization for the current admin is required.
   */
  renounce_admin: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_role_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets `admin_role` as the admin role of `role`.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `role` - The role to set the admin for.
   * * `admin_role` - The new admin role.
   *
   * # Events
   *
   * * topics - `["role_admin_changed", role: Symbol]`
   * * data - `[previous_admin_role: Symbol, new_admin_role: Symbol]`
   *
   * # Errors
   *
   * * [`AccessControlError::AdminNotSet`] - If admin account is not set.
   *
   * # Notes
   *
   * * Authorization for the current admin is required.
   */
  set_role_admin: (
    { role, admin_role }: { role: string; admin_role: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a early_exit_paid transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  early_exit_paid: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_role_member transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the account at the specified index for a given role.
   *
   * A function to get all members of a role is not provided because that
   * would be unbounded. To enumerate all members of a role, use
   * [`AccessControl::get_role_member_count()`] to get the total number of
   * members and then use [`AccessControl::get_role_member()`] to retrieve
   * each member one by one.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `role` - The role to query.
   * * `index` - The index of the account to retrieve.
   *
   * # Errors
   *
   * * [`AccessControlError::IndexOutOfBounds`] - If the index is out of
   * bounds for the role's member list.
   */
  get_role_member: (
    { role, index }: { role: string; index: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a get_existing_roles transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns a vector containing all existing roles.
   * Defaults to empty vector if no roles exist.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   *
   * # Notes
   *
   * This function returns all roles that currently have at least one member.
   * The maximum number of roles is limited by [`MAX_ROLES`].
   */
  get_existing_roles: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Array<string>>>;

  /**
   * Construct and simulate a transfer_admin_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initiates the admin role transfer.
   * Admin privileges for the current admin are not revoked until the
   * recipient accepts the transfer.
   * Overrides the previous pending transfer if there is one.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `new_admin` - The account to transfer the admin privileges to.
   * * `live_until_ledger` - The ledger number at which the pending transfer
   * expires. If `live_until_ledger` is `0`, the pending transfer is
   * cancelled. `live_until_ledger` argument is implicitly bounded by the
   * maximum allowed TTL extension for a temporary storage entry and
   * specifying a higher value will cause the code to panic.
   *
   * # Errors
   *
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * trying to cancel a transfer that doesn't exist.
   * * [`crate::role_transfer::RoleTransferError::InvalidLiveUntilLedger`] -
   * If the specified ledger is in the past.
   * * [`crate::role_transfer::RoleTransferError::InvalidPendingAccount`] -
   * If the specified pending account is not the same as the provided `new`
   * address.
   *
   */
  transfer_admin_role: (
    {
      new_admin,
      live_until_ledger,
    }: { new_admin: string; live_until_ledger: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a accept_admin_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Completes the 2-step admin transfer.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   *
   * # Events
   *
   * * topics - `["admin_transfer_completed", new_admin: Address]`
   * * data - `[previous_admin: Address]`
   *
   * # Errors
   *
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * there is no pending transfer to accept.
   * * [`AccessControlError::AdminNotSet`] - If admin account is not set.
   */
  accept_admin_transfer: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_role_member_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the total number of accounts that have the specified role.
   * If the role does not exist, returns 0.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `role` - The role to get the count for.
   */
  get_role_member_count: (
    { role }: { role: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<u32>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    {
      admin,
      manager,
      config,
      exit_fee_bps,
      tranches,
    }: {
      admin: string;
      manager: string;
      config: Config;
      exit_fee_bps: u32;
      tranches: Array<TrancheInit>;
    },
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(
      { admin, manager, config, exit_fee_bps, tranches },
      options
    );
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAQAAADxFdmVyeXRoaW5nIGFib3V0IHRoZSB2YXVsdCB0aGF0IGlzIGZpeGVkIHdoZW4gaXQgaXMgY3JlYXRlZC4AAAAAAAAABkNvbmZpZwAAAAAACQAAAAAAAAAIYm9ycm93ZXIAAAATAAAASFByaW5jaXBhbCBwbHVzIGludGVyZXN0LCBpbiBVU0RDIHVuaXRzLiBUaGUgcmF0ZSBpdHNlbGYgbGl2ZXMgb2ZmLWNoYWluLgAAABJleHBlY3RlZF9yZXBheW1lbnQAAAAAAAsAAAAAAAAADWZlZV9yZWNpcGllbnQAAAAAAAATAAAAAAAAABBmdW5kaW5nX2RlYWRsaW5lAAAABgAAAHdUaGUgY2VpbGluZyB0aGUgZXhpdCBmZWUgY2FuIG5ldmVyIHBhc3MuIERlbGliZXJhdGVseSBoYXMgbm8gc2V0dGVyOiBpdAppcyB3aGF0IGFuIGludmVzdG9yIGlzIHNob3duIGJlZm9yZSBjb21taXR0aW5nLgAAAAAQbWF4X2V4aXRfZmVlX2JwcwAAAAQAAAAAAAAACm1pbl90YXJnZXQAAAAAAAsAAAAAAAAABnRhcmdldAAAAAAACwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAR1c2RjAAAAEw==",
        "AAAAAQAAACpPbmUgc2NoZWR1bGVkIHJlcGF5bWVudCBmcm9tIHRoZSBib3Jyb3dlci4AAAAAAAAAAAAHVHJhbmNoZQAAAAAGAAAAAAAAAAhkdWVfZGF0ZQAAAAYAAAAAAAAADGV2aWRlbmNlX3VyaQAAABAAAAAAAAAAD2V4cGVjdGVkX2Ftb3VudAAAAAALAAAAAAAAAAVpbmRleAAAAAAAAAQAAABzU3RpbGwgYDBgIHdoaWxlIHRoZSB0cmFuY2hlIGlzIHVucGFpZDsgYHJlcGF5YCByZWplY3RzIGFtb3VudHMgb2YgemVybywKc28gdGhpcyBkb3VibGVzIGFzIHRoZSAiYWxyZWFkeSBwYWlkIiBmbGFnLgAAAAALcGFpZF9hbW91bnQAAAAACwAAACBMZWRnZXIgdGltZXN0YW1wIG9mIHRoZSBwYXltZW50LgAAAAdwYWlkX2F0AAAAAAY=",
        "AAAABQAAAAAAAAAAAAAAB1NldHRsZWQAAAAAAQAAAAdzZXR0bGVkAAAAAAIAAAAAAAAADHRvdGFsX3JlcGFpZAAAAAsAAAAAAAAAAAAAAAZzdXBwbHkAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAACEludmVzdGVkAAAAAQAAAAhpbnZlc3RlZAAAAAIAAAAAAAAACGludmVzdG9yAAAAEwAAAAEAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAACFJlZGVlbWVkAAAAAQAAAAhyZWRlZW1lZAAAAAMAAAAAAAAACGludmVzdG9yAAAAEwAAAAEAAAAAAAAABnRva2VucwAAAAAACwAAAAAAAAAAAAAABnBheW91dAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAACFJlZnVuZGVkAAAAAQAAAAhyZWZ1bmRlZAAAAAIAAAAAAAAACGludmVzdG9yAAAAEwAAAAEAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAACFJlbGVhc2VkAAAAAQAAAAhyZWxlYXNlZAAAAAIAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAEAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAACUR1c3RTd2VwdAAAAAAAAAEAAAAKZHVzdF9zd2VwdAAAAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAAClZhdWx0RXJyb3IAAAAAAAsAAAAzVGhlIGNhbGwgaXMgbm90IHZhbGlkIGluIHRoZSB2YXVsdCdzIGN1cnJlbnQgc3RhdGUuAAAAAAxJbnZhbGlkU3RhdGUAAAABAAAAIUFtb3VudCBtdXN0IGJlIGdyZWF0ZXIgdGhhbiB6ZXJvLgAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAAAgAAACtUaGUgdmF1bHQgd291bGQgcmFpc2UgbW9yZSB0aGFuIGl0cyB0YXJnZXQuAAAAAA5UYXJnZXRFeGNlZWRlZAAAAAAAAwAAACBUaGUgZnVuZGluZyBkZWFkbGluZSBoYXMgcGFzc2VkLgAAAA1GdW5kaW5nQ2xvc2VkAAAAAAAABAAAAClUaGUgY2FsbGVyIGhvbGRzIG5vIHRva2VucyBpbiB0aGlzIHZhdWx0LgAAAAAAAA9Ob3RoaW5nVG9SZWRlZW0AAAAABQAAAD5UaGUgdmF1bHQgZG9lcyBub3QgaG9sZCBlbm91Z2ggVVNEQyB0byBzZXR0bGUgdGhpcyBlYXJseSBleGl0LgAAAAAAFUluc3VmZmljaWVudExpcXVpZGl0eQAAAAAAAAYAAAA6VGhlIHJlcXVlc3RlZCBleGl0IGZlZSBpcyBhYm92ZSB0aGUgdmF1bHQncyBpbW11dGFibGUgY2FwLgAAAAAAC0ZlZUFib3ZlQ2FwAAAAAAcAAAAbTm8gdHJhbmNoZSB3aXRoIHRoYXQgaW5kZXguAAAAAA5Vbmtub3duVHJhbmNoZQAAAAAACAAAAB5UaGF0IHRyYW5jaGUgd2FzIGFscmVhZHkgcGFpZC4AAAAAAAtUcmFuY2hlUGFpZAAAAAAJAAAAO1RoZSBjb25zdHJ1Y3RvciBhcmd1bWVudHMgZG8gbm90IGRlc2NyaWJlIGEgd29ya2FibGUgdmF1bHQuAAAAAA1JbnZhbGlkQ29uZmlnAAAAAAAACgAAAB1Ub2tlbnMgYXJlIHN0aWxsIG91dHN0YW5kaW5nLgAAAAAAABFTdXBwbHlPdXRzdGFuZGluZwAAAAAAAAs=",
        "AAAAAgAAAAAAAAAAAAAAClZhdWx0U3RhdGUAAAAAAAUAAAAAAAAAEFRha2luZyBkZXBvc2l0cy4AAAAHRnVuZGluZwAAAAAAAAAARVRoZSByb3VuZCBjbG9zZWQgYXQgb3IgYWJvdmUgaXRzIG1pbmltdW07IHRoZSByYWlzZSBoYXMgbm90IGxlZnQgeWV0LgAAAAAAAAZGdW5kZWQAAAAAAAAAAAA6VGhlIHJhaXNlIGlzIHdpdGggdGhlIGJvcnJvd2VyIGFuZCByZXBheW1lbnQgaXMgdW5kZXIgd2F5LgAAAAAABkFjdGl2ZQAAAAAAAAAAAEFUaGUgYm9ycm93ZXIgcGFpZCB0aGUgZnVsbCBleHBlY3RlZCBhbW91bnQ7IGludmVzdG9ycyBjYW4gcmVkZWVtLgAAAAAAAAdTZXR0bGVkAAAAAAAAAABAVGhlIHJvdW5kIGNsb3NlZCBiZWxvdyBpdHMgbWluaW11bTsgaW52ZXN0b3JzIGNhbiByZWZ1bmQgYXQgcGFyLgAAAAZGYWlsZWQAAA==",
        "AAAAAQAAAD9BIHRyYW5jaGUgYXMgZ2l2ZW4gdG8gdGhlIGNvbnN0cnVjdG9yLCBiZWZvcmUgYW55dGhpbmcgaXMgcGFpZC4AAAAAAAAAAAtUcmFuY2hlSW5pdAAAAAACAAAAAAAAAAhkdWVfZGF0ZQAAAAYAAAAAAAAAD2V4cGVjdGVkX2Ftb3VudAAAAAAL",
        "AAAABQAAAAAAAAAAAAAAC0Vhcmx5RXhpdGVkAAAAAAEAAAAMZWFybHlfZXhpdGVkAAAABAAAAAAAAAAIaW52ZXN0b3IAAAATAAAAAQAAAAAAAAAJcHJpbmNpcGFsAAAAAAAACwAAAAAAAAAAAAAABnBheW91dAAAAAAACwAAAAAAAAAAAAAAA2ZlZQAAAAALAAAAAAAAAAI=",
        "AAAAAAAAAH9QYXkgb25lIHRyYW5jaGUuIFRoZSB2YXVsdCBzZXR0bGVzIG9uY2UgdGhlIHRvdGFsIHJlYWNoZXMKYGV4cGVjdGVkX3JlcGF5bWVudGAsIGZyZWV6aW5nIHRoZSBzdXBwbHkgdGhlIHBheW91dCBpcyBkaXZpZGVkIG92ZXIuAAAAAAVyZXBheQAAAAAAAAMAAAAAAAAADXRyYW5jaGVfaW5kZXgAAAAAAAAEAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAADGV2aWRlbmNlX3VyaQAAABAAAAAA",
        "AAAAAAAAALVEZXBvc2l0IGBhbW91bnRgIG9mIFVTREMgYW5kIHJlY2VpdmUgdGhlIHNhbWUgbnVtYmVyIG9mIHZhdWx0IHRva2Vucy4KClRoZSBtaW50IHJ1bnMgdGhlIHRva2VuJ3MgaWRlbnRpdHkgY2hlY2sgb24gYGludmVzdG9yYCwgc28gYSB3YWxsZXQKd2l0aG91dCB2ZXJpZmllZCBLWUMgY2xhaW1zIGNhbm5vdCBpbnZlc3QuAAAAAAAABmludmVzdAAAAAAAAgAAAAAAAAAIaW52ZXN0b3IAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAGcmFpc2VkAAAAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAEdDb2xsZWN0IHByaW5jaXBhbCBwbHVzIHRoZSBzaGFyZSBvZiBpbnRlcmVzdCBlYXJuZWQgYnkgdGhlIHRva2VucyBoZWxkLgAAAAAGcmVkZWVtAAAAAAABAAAAAAAAAAhpbnZlc3RvcgAAABMAAAAA",
        "AAAAAAAAAD1UYWtlIGJhY2sgYSBkZXBvc2l0IGF0IHBhciBhZnRlciBhIHJvdW5kIHRoYXQgZmFpbGVkIHRvIGZpbGwuAAAAAAAABnJlZnVuZAAAAAAAAQAAAAAAAAAIaW52ZXN0b3IAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAGcmVwYWlkAAAAAAAAAAAAAQAAAAs=",
        "AAAABQAAAAAAAAAAAAAADUZ1bmRpbmdDbG9zZWQAAAAAAAABAAAADmZ1bmRpbmdfY2xvc2VkAAAAAAACAAAAAAAAAAVzdGF0ZQAAAAAAB9AAAAAKVmF1bHRTdGF0ZQAAAAAAAQAAAAAAAAAGcmFpc2VkAAAAAAALAAAAAAAAAAI=",
        "AAAAAAAAAD5TZW5kIHRoZSByYWlzZSB0byB0aGUgYm9ycm93ZXIgYW5kIHN0YXJ0IHRoZSByZXBheW1lbnQgcGVyaW9kLgAAAAAAB3JlbGVhc2UAAAAAAQAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAA==",
        "AAAABQAAAAAAAAAAAAAADkV4aXRGZWVDaGFuZ2VkAAAAAAABAAAAEGV4aXRfZmVlX2NoYW5nZWQAAAABAAAAAAAAAANicHMAAAAABAAAAAAAAAAC",
        "AAAAAAAAAAAAAAAIZXhpdF9mZWUAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAXJSZXR1cm5zIGBTb21lKGluZGV4KWAgaWYgdGhlIGFjY291bnQgaGFzIHRoZSBzcGVjaWZpZWQgcm9sZSwKd2hlcmUgYGluZGV4YCBpcyB0aGUgcG9zaXRpb24gb2YgdGhlIGFjY291bnQgZm9yIHRoYXQgcm9sZSwKYW5kIGNhbiBiZSB1c2VkIHRvIHF1ZXJ5IFtgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyKClgXS4KUmV0dXJucyBgTm9uZWAgaWYgdGhlIGFjY291bnQgZG9lcyBub3QgaGF2ZSB0aGUgc3BlY2lmaWVkIHJvbGUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBjaGVjay4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBjaGVjayBmb3IuAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAABHJvbGUAAAARAAAAAQAAA+gAAAAE",
        "AAAAAAAAAEZXaGF0IGBpbnZlc3RvcmAgd291bGQgY29sbGVjdCBmcm9tIGByZWRlZW1gLCBvciBgMGAgYmVmb3JlIHNldHRsZW1lbnQuAAAAAAAJY2xhaW1hYmxlAAAAAAAAAQAAAAAAAAAIaW52ZXN0b3IAAAATAAAAAQAAAAs=",
        "AAAAAAAAAE9SZXR1cm5zIHRoZSBhZG1pbiBhY2NvdW50LgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAlnZXRfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAAJZ2V0X3N0YXRlAAAAAAAAAAAAAAEAAAfQAAAAClZhdWx0U3RhdGUAAA==",
        "AAAABQAAAAAAAAAAAAAAEFRyYW5jaGVQYWlkRXZlbnQAAAABAAAAEnRyYW5jaGVfcGFpZF9ldmVudAAAAAAAAwAAAAAAAAAHdHJhbmNoZQAAAAAEAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAMdG90YWxfcmVwYWlkAAAACwAAAAAAAAAC",
        "AAAAAAAAAXpMZWF2ZSBiZWZvcmUgbWF0dXJpdHk6IGNhcGl0YWwgYmFjayBtaW51cyB0aGUgZXhpdCBmZWUsIG5vIGludGVyZXN0LgoKUGFpZCBvdXQgb2Ygd2hhdGV2ZXIgdGhlIGJvcnJvd2VyIGhhcyByZXBhaWQgc28gZmFyLCBzbyBhIGxhcmdlIGhvbGRlcgptYXkgaGF2ZSB0byB3YWl0IGZvciBhIGZldyB0cmFuY2hlcyBiZWZvcmUgdGhlcmUgaXMgZW5vdWdoIHRvIGJ1eSB0aGVtCm91dC4gUmV2ZXJ0aW5nIHJhdGhlciB0aGFuIHBhcnQtcGF5aW5nIGlzIGFsc28gd2hhdCBrZWVwcwpgZWFybHlfZXhpdF9wYWlkYCBmcm9tIGV2ZXIgcGFzc2luZyBgcmVwYWlkYCwgd2hpY2ggaXMgd2hhdCBtYWtlcyB0aGUKcmVkZW1wdGlvbiBwb29sIHNhZmUgZnJvbSBnb2luZyBzaG9ydC4AAAAAAAplYXJseV9leGl0AAAAAAABAAAAAAAAAAhpbnZlc3RvcgAAABMAAAAA",
        "AAAAAAAAADpXaGF0IGBpbnZlc3RvcmAgd291bGQgY29sbGVjdCBmcm9tIGBlYXJseV9leGl0YCByaWdodCBub3cuAAAAAAAKZXhpdF92YWx1ZQAAAAAAAQAAAAAAAAAIaW52ZXN0b3IAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAABkNvbmZpZwAA",
        "AAAAAAAAAj5HcmFudHMgYSByb2xlIHRvIGFuIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBncmFudCB0aGUgcm9sZSB0by4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBncmFudC4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFkbWluIG9yIGhhdmUgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGNhbGxlciBkb2VzIG5vdCBoYXZlCmVub3VnaCBwcml2aWxlZ2VzLgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpNYXhSb2xlc0V4Y2VlZGVkYF0gLSBJZiBhZGRpbmcgYSBuZXcgcm9sZSB3b3VsZApleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCBudW1iZXIgb2Ygcm9sZXMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2dyYW50ZWQiLCByb2xlOiBTeW1ib2wsIGFjY291bnQ6IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2NhbGxlcjogQWRkcmVzc11gAAAAAAAKZ3JhbnRfcm9sZQAAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAD5TZW5kIHRoZSByb3VuZGluZyBkdXN0IGxlZnQgYWZ0ZXIgZXZlcnkgaW52ZXN0b3IgaGFzIHJlZGVlbWVkLgAAAAAACnN3ZWVwX2R1c3QAAAAAAAEAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAALZ2V0X3RyYW5jaGUAAAAAAQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAB9AAAAAHVHJhbmNoZQA=",
        "AAAAAAAAArdSZXZva2VzIGEgcm9sZSBmcm9tIGFuIGFjY291bnQuClRvIHJldm9rZSB0aGUgY2FsbGVyJ3Mgb3duIHJvbGUsIHVzZQpbYEFjY2Vzc0NvbnRyb2w6OnJlbm91bmNlX3JvbGUoKWBdIGluc3RlYWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byByZXZva2UgdGhlIHJvbGUgZnJvbS4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZXZva2UuCiogYGNhbGxlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgY2FsbGVyLCBtdXN0IGJlIHRoZSBhZG1pbiBvciBoYXMgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGBjYWxsZXJgIGRvZXMgbm90IGhhdmUKZW5vdWdoIHByaXZpbGVnZXMuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVOb3RIZWxkYF0gLSBJZiB0aGUgYGFjY291bnRgIGRvZXNuJ3QgaGF2ZQp0aGUgcm9sZS4KKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZUlzRW1wdHlgXSAtIElmIHRoZSByb2xlIGhhcyBubyBtZW1iZXJzLgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsicm9sZV9yZXZva2VkIiwgcm9sZTogU3ltYm9sLCBhY2NvdW50OiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtjYWxsZXI6IEFkZHJlc3NdYAAAAAALcmV2b2tlX3JvbGUAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAEpDaGFuZ2UgdGhlIGV4aXQgZmVlLCBuZXZlciBhYm92ZSB0aGUgY2FwIGZpeGVkIHdoZW4gdGhlIHZhdWx0IHdhcyBjcmVhdGVkLgAAAAAADHNldF9leGl0X2ZlZQAAAAIAAAAAAAAAA2JwcwAAAAAEAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAA",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAUAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAHbWFuYWdlcgAAAAATAAAAAAAAAAZjb25maWcAAAAAB9AAAAAGQ29uZmlnAAAAAAAAAAAADGV4aXRfZmVlX2JwcwAAAAQAAAAAAAAACHRyYW5jaGVzAAAD6gAAB9AAAAALVHJhbmNoZUluaXQAAAAAAA==",
        "AAAAAAAAAEVDbG9zZSB0aGUgcm91bmQ6IGBGdW5kZWRgIGlmIGl0IHJlYWNoZWQgaXRzIG1pbmltdW0sIGBGYWlsZWRgIGlmIG5vdC4AAAAAAAANY2xvc2VfZnVuZGluZwAAAAAAAAEAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAANbGlzdF90cmFuY2hlcwAAAAAAAAAAAAABAAAD6gAAB9AAAAAHVHJhbmNoZQA=",
        "AAAAAAAAAhZBbGxvd3MgYW4gYWNjb3VudCB0byByZW5vdW5jZSBhIHJvbGUgYXNzaWduZWQgdG8gaXRzZWxmLgpVc2VycyBjYW4gb25seSByZW5vdW5jZSByb2xlcyBmb3IgdGhlaXIgb3duIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZW5vdW5jZS4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFjY291bnQgdGhhdCBoYXMgdGhlCnJvbGUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZU5vdEhlbGRgXSAtIElmIHRoZSBgY2FsbGVyYCBkb2Vzbid0IGhhdmUgdGhlCnJvbGUuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVJc0VtcHR5YF0gLSBJZiB0aGUgcm9sZSBoYXMgbm8gbWVtYmVycy4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInJvbGVfcmV2b2tlZCIsIHJvbGU6IFN5bWJvbCwgYWNjb3VudDogQWRkcmVzc11gCiogZGF0YSAtIGBbY2FsbGVyOiBBZGRyZXNzXWAAAAAAAA1yZW5vdW5jZV9yb2xlAAAAAAAAAgAAAAAAAAAEcm9sZQAAABEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAMVSZXR1cm5zIHRoZSBhZG1pbiByb2xlIGZvciBhIHNwZWNpZmljIHJvbGUuCklmIG5vIGFkbWluIHJvbGUgaXMgZXhwbGljaXRseSBzZXQsIHJldHVybnMgYE5vbmVgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHJvbGVgIC0gVGhlIHJvbGUgdG8gcXVlcnkgdGhlIGFkbWluIHJvbGUgZm9yLgAAAAAAAA5nZXRfcm9sZV9hZG1pbgAAAAAAAQAAAAAAAAAEcm9sZQAAABEAAAABAAAD6AAAABE=",
        "AAAAAAAAAfZBbGxvd3MgdGhlIGN1cnJlbnQgYWRtaW4gdG8gcmVub3VuY2UgdGhlaXIgcm9sZSwgbWFraW5nIHRoZSBjb250cmFjdApwZXJtYW5lbnRseSBhZG1pbi1sZXNzLiBUaGlzIGlzIHVzZWZ1bCBmb3IgZGVjZW50cmFsaXphdGlvbiBwdXJwb3NlcwpvciB3aGVuIHRoZSBhZG1pbiByb2xlIGlzIG5vIGxvbmdlciBuZWVkZWQuIE9uY2UgdGhlIGFkbWluIGlzCnJlbm91bmNlZCwgaXQgY2Fubm90IGJlIHJlaW5zdGF0ZWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgRXJyb3JzCgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgbm8gYWRtaW4gYWNjb3VudCBpcyBzZXQuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhZG1pbl9yZW5vdW5jZWQiLCBhZG1pbjogQWRkcmVzc11gCiogZGF0YSAtIGBbXWAKCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAOcmVub3VuY2VfYWRtaW4AAAAAAAAAAAAA",
        "AAAAAAAAAb1TZXRzIGBhZG1pbl9yb2xlYCBhcyB0aGUgYWRtaW4gcm9sZSBvZiBgcm9sZWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBzZXQgdGhlIGFkbWluIGZvci4KKiBgYWRtaW5fcm9sZWAgLSBUaGUgbmV3IGFkbWluIHJvbGUuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2FkbWluX2NoYW5nZWQiLCByb2xlOiBTeW1ib2xdYAoqIGRhdGEgLSBgW3ByZXZpb3VzX2FkbWluX3JvbGU6IFN5bWJvbCwgbmV3X2FkbWluX3JvbGU6IFN5bWJvbF1gCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6QWRtaW5Ob3RTZXRgXSAtIElmIGFkbWluIGFjY291bnQgaXMgbm90IHNldC4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAADnNldF9yb2xlX2FkbWluAAAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAKYWRtaW5fcm9sZQAAAAAAEQAAAAA=",
        "AAAAAAAAAAAAAAAPZWFybHlfZXhpdF9wYWlkAAAAAAAAAAABAAAACw==",
        "AAAAAAAAAllSZXR1cm5zIHRoZSBhY2NvdW50IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggZm9yIGEgZ2l2ZW4gcm9sZS4KCkEgZnVuY3Rpb24gdG8gZ2V0IGFsbCBtZW1iZXJzIG9mIGEgcm9sZSBpcyBub3QgcHJvdmlkZWQgYmVjYXVzZSB0aGF0CndvdWxkIGJlIHVuYm91bmRlZC4gVG8gZW51bWVyYXRlIGFsbCBtZW1iZXJzIG9mIGEgcm9sZSwgdXNlCltgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyX2NvdW50KClgXSB0byBnZXQgdGhlIHRvdGFsIG51bWJlciBvZgptZW1iZXJzIGFuZCB0aGVuIHVzZSBbYEFjY2Vzc0NvbnRyb2w6OmdldF9yb2xlX21lbWJlcigpYF0gdG8gcmV0cmlldmUKZWFjaCBtZW1iZXIgb25lIGJ5IG9uZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIHF1ZXJ5LgoqIGBpbmRleGAgLSBUaGUgaW5kZXggb2YgdGhlIGFjY291bnQgdG8gcmV0cmlldmUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6SW5kZXhPdXRPZkJvdW5kc2BdIC0gSWYgdGhlIGluZGV4IGlzIG91dCBvZgpib3VuZHMgZm9yIHRoZSByb2xlJ3MgbWVtYmVyIGxpc3QuAAAAAAAAD2dldF9yb2xlX21lbWJlcgAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAABM=",
        "AAAAAAAAARxSZXR1cm5zIGEgdmVjdG9yIGNvbnRhaW5pbmcgYWxsIGV4aXN0aW5nIHJvbGVzLgpEZWZhdWx0cyB0byBlbXB0eSB2ZWN0b3IgaWYgbm8gcm9sZXMgZXhpc3QuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgTm90ZXMKClRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbGwgcm9sZXMgdGhhdCBjdXJyZW50bHkgaGF2ZSBhdCBsZWFzdCBvbmUgbWVtYmVyLgpUaGUgbWF4aW11bSBudW1iZXIgb2Ygcm9sZXMgaXMgbGltaXRlZCBieSBbYE1BWF9ST0xFU2BdLgAAABJnZXRfZXhpc3Rpbmdfcm9sZXMAAAAAAAAAAAABAAAD6gAAABE=",
        "AAAAAAAABABJbml0aWF0ZXMgdGhlIGFkbWluIHJvbGUgdHJhbnNmZXIuCkFkbWluIHByaXZpbGVnZXMgZm9yIHRoZSBjdXJyZW50IGFkbWluIGFyZSBub3QgcmV2b2tlZCB1bnRpbCB0aGUKcmVjaXBpZW50IGFjY2VwdHMgdGhlIHRyYW5zZmVyLgpPdmVycmlkZXMgdGhlIHByZXZpb3VzIHBlbmRpbmcgdHJhbnNmZXIgaWYgdGhlcmUgaXMgb25lLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYG5ld19hZG1pbmAgLSBUaGUgYWNjb3VudCB0byB0cmFuc2ZlciB0aGUgYWRtaW4gcHJpdmlsZWdlcyB0by4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIHBlbmRpbmcgdHJhbnNmZXIKZXhwaXJlcy4gSWYgYGxpdmVfdW50aWxfbGVkZ2VyYCBpcyBgMGAsIHRoZSBwZW5kaW5nIHRyYW5zZmVyIGlzCmNhbmNlbGxlZC4gYGxpdmVfdW50aWxfbGVkZ2VyYCBhcmd1bWVudCBpcyBpbXBsaWNpdGx5IGJvdW5kZWQgYnkgdGhlCm1heGltdW0gYWxsb3dlZCBUVEwgZXh0ZW5zaW9uIGZvciBhIHRlbXBvcmFyeSBzdG9yYWdlIGVudHJ5IGFuZApzcGVjaWZ5aW5nIGEgaGlnaGVyIHZhbHVlIHdpbGwgY2F1c2UgdGhlIGNvZGUgdG8gcGFuaWMuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRyeWluZyB0byBjYW5jZWwgYSB0cmFuc2ZlciB0aGF0IGRvZXNuJ3QgZXhpc3QuCiogW2BjcmF0ZTo6cm9sZV90cmFuc2Zlcjo6Um9sZVRyYW5zZmVyRXJyb3I6OkludmFsaWRMaXZlVW50aWxMZWRnZXJgXSAtCklmIHRoZSBzcGVjaWZpZWQgbGVkZ2VyIGlzIGluIHRoZSBwYXN0LgoqIFtgY3JhdGU6OnJvbGVfdHJhbnNmZXI6OlJvbGVUcmFuc2ZlckVycm9yOjpJbnZhbGlkUGVuZGluZ0FjY291bnRgXSAtCklmIHRoZSBzcGVjaWZpZWQgcGVuZGluZyBhY2NvdW50IGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgcHJvdmlkZWQgYG5ld2AKYWRkcmVzcy4KAAAAE3RyYW5zZmVyX2FkbWluX3JvbGUAAAAAAgAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAA==",
        "AAAAAAAAAYVDb21wbGV0ZXMgdGhlIDItc3RlcCBhZG1pbiB0cmFuc2Zlci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsiYWRtaW5fdHJhbnNmZXJfY29tcGxldGVkIiwgbmV3X2FkbWluOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtwcmV2aW91c19hZG1pbjogQWRkcmVzc11gCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRoZXJlIGlzIG5vIHBlbmRpbmcgdHJhbnNmZXIgdG8gYWNjZXB0LgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgYWRtaW4gYWNjb3VudCBpcyBub3Qgc2V0LgAAAAAAABVhY2NlcHRfYWRtaW5fdHJhbnNmZXIAAAAAAAAAAAAAAA==",
        "AAAAAAAAAMhSZXR1cm5zIHRoZSB0b3RhbCBudW1iZXIgb2YgYWNjb3VudHMgdGhhdCBoYXZlIHRoZSBzcGVjaWZpZWQgcm9sZS4KSWYgdGhlIHJvbGUgZG9lcyBub3QgZXhpc3QsIHJldHVybnMgMC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIGdldCB0aGUgY291bnQgZm9yLgAAABVnZXRfcm9sZV9tZW1iZXJfY291bnQAAAAAAAABAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAE",
        "AAAABAAAAAAAAAAAAAAAEVJvbGVUcmFuc2ZlckVycm9yAAAAAAAABAAAAAAAAAARTm9QZW5kaW5nVHJhbnNmZXIAAAAAAAiYAAAAAAAAABZJbnZhbGlkTGl2ZVVudGlsTGVkZ2VyAAAAAAiZAAAAAAAAABVJbnZhbGlkUGVuZGluZ0FjY291bnQAAAAAAAiaAAAAAAAAAA9UcmFuc2ZlckV4cGlyZWQAAAAImw==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGlzIGdyYW50ZWQuAAAAAAAAAAAAAAtSb2xlR3JhbnRlZAAAAAABAAAADHJvbGVfZ3JhbnRlZAAAAAMAAAAAAAAABHJvbGUAAAARAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGlzIHJldm9rZWQuAAAAAAAAAAAAAAtSb2xlUmV2b2tlZAAAAAABAAAADHJvbGVfcmV2b2tlZAAAAAMAAAAAAAAABHJvbGUAAAARAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAC9FdmVudCBlbWl0dGVkIHdoZW4gdGhlIGFkbWluIHJvbGUgaXMgcmVub3VuY2VkLgAAAAAAAAAADkFkbWluUmVub3VuY2VkAAAAAAABAAAAD2FkbWluX3Jlbm91bmNlZAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAg==",
        "AAAABQAAACtFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGFkbWluIGlzIGNoYW5nZWQuAAAAAAAAAAAQUm9sZUFkbWluQ2hhbmdlZAAAAAEAAAAScm9sZV9hZG1pbl9jaGFuZ2VkAAAAAAADAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAAAAAAE3ByZXZpb3VzX2FkbWluX3JvbGUAAAAAEQAAAAAAAAAAAAAADm5ld19hZG1pbl9yb2xlAAAAAAARAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAAEkFjY2Vzc0NvbnRyb2xFcnJvcgAAAAAACwAAAAAAAAAMVW5hdXRob3JpemVkAAAH0AAAAAAAAAALQWRtaW5Ob3RTZXQAAAAH0QAAAAAAAAAQSW5kZXhPdXRPZkJvdW5kcwAAB9IAAAAAAAAAEUFkbWluUm9sZU5vdEZvdW5kAAAAAAAH0wAAAAAAAAASUm9sZUNvdW50SXNOb3RaZXJvAAAAAAfUAAAAAAAAAAxSb2xlTm90Rm91bmQAAAfVAAAAAAAAAA9BZG1pbkFscmVhZHlTZXQAAAAH1gAAAAAAAAALUm9sZU5vdEhlbGQAAAAH1wAAAAAAAAALUm9sZUlzRW1wdHkAAAAH2AAAAAAAAAASVHJhbnNmZXJJblByb2dyZXNzAAAAAAfZAAAAAAAAABBNYXhSb2xlc0V4Y2VlZGVkAAAH2g==",
        "AAAABQAAADJFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWRtaW4gdHJhbnNmZXIgaXMgY29tcGxldGVkLgAAAAAAAAAAABZBZG1pblRyYW5zZmVyQ29tcGxldGVkAAAAAAABAAAAGGFkbWluX3RyYW5zZmVyX2NvbXBsZXRlZAAAAAIAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAABAAAAAAAAAA5wcmV2aW91c19hZG1pbgAAAAAAEwAAAAAAAAAC",
        "AAAABQAAADJFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWRtaW4gdHJhbnNmZXIgaXMgaW5pdGlhdGVkLgAAAAAAAAAAABZBZG1pblRyYW5zZmVySW5pdGlhdGVkAAAAAAABAAAAGGFkbWluX3RyYW5zZmVyX2luaXRpYXRlZAAAAAMAAAAAAAAADWN1cnJlbnRfYWRtaW4AAAAAAAATAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAAAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAAAAAAC",
      ]),
      options
    );
  }
  public readonly fromJSON = {
    repay: this.txFromJSON<null>,
    invest: this.txFromJSON<null>,
    raised: this.txFromJSON<i128>,
    redeem: this.txFromJSON<null>,
    refund: this.txFromJSON<null>,
    repaid: this.txFromJSON<i128>,
    release: this.txFromJSON<null>,
    exit_fee: this.txFromJSON<u32>,
    has_role: this.txFromJSON<Option<u32>>,
    claimable: this.txFromJSON<i128>,
    get_admin: this.txFromJSON<Option<string>>,
    get_state: this.txFromJSON<VaultState>,
    early_exit: this.txFromJSON<null>,
    exit_value: this.txFromJSON<i128>,
    get_config: this.txFromJSON<Config>,
    grant_role: this.txFromJSON<null>,
    sweep_dust: this.txFromJSON<null>,
    get_tranche: this.txFromJSON<Tranche>,
    revoke_role: this.txFromJSON<null>,
    set_exit_fee: this.txFromJSON<null>,
    close_funding: this.txFromJSON<null>,
    list_tranches: this.txFromJSON<Array<Tranche>>,
    renounce_role: this.txFromJSON<null>,
    get_role_admin: this.txFromJSON<Option<string>>,
    renounce_admin: this.txFromJSON<null>,
    set_role_admin: this.txFromJSON<null>,
    early_exit_paid: this.txFromJSON<i128>,
    get_role_member: this.txFromJSON<string>,
    get_existing_roles: this.txFromJSON<Array<string>>,
    transfer_admin_role: this.txFromJSON<null>,
    accept_admin_transfer: this.txFromJSON<null>,
    get_role_member_count: this.txFromJSON<u32>,
  };
}
