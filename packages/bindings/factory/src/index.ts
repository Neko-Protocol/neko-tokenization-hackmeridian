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
 * The templates and shared contracts every vault is built from.
 */
export interface Templates {
  compliance_wasm_hash: Buffer;
  /**
   * Published so a front end can find the shared registry from the factory.
   * The factory itself never calls it; see the note at the top of the file.
   */
  identity_registry: string;
  identity_verifier: string;
  /**
   * Who ends up owning each vault's contracts. The factory is never a
   * lasting owner of anything it deploys: it holds the token's admin role
   * only long enough to empower the vault, then hands it over.
   */
  platform_admin: string;
  platform_manager: string;
  token_wasm_hash: Buffer;
  vault_wasm_hash: Buffer;
}

/**
 * One launched vault and the three contracts that make it up.
 */
export interface Deployment {
  compliance: string;
  created_at: u64;
  issuer: string;
  /**
   * Hash of the off-chain form and prospectus, so the paperwork behind the
   * vault can be proven unchanged without putting any of it on the ledger.
   */
  metadata_hash: Buffer;
  metadata_uri: string;
  token: string;
  vault: string;
  vault_id: Buffer;
  wired: boolean;
}

/**
 * The commercial terms of a vault.
 *
 * There is no `token` here on purpose: the token does not exist when the
 * caller builds this, and the factory fills it in with the one it deploys.
 * Letting a caller name the token would make it possible to point a vault at
 * the wrong one.
 */
export interface VaultTerms {
  borrower: string;
  exit_fee_bps: u32;
  /**
   * Principal plus interest. The rate is applied off-chain, once.
   */
  expected_repayment: i128;
  fee_recipient: string;
  funding_deadline: u64;
  max_exit_fee_bps: u32;
  min_target: i128;
  target: i128;
  usdc: string;
}

/**
 * One scheduled repayment, as the vault's constructor takes it.
 */
export interface TrancheInit {
  due_date: u64;
  expected_amount: i128;
}

export const FactoryError = {
  /**
   * A vault with that id already exists.
   */
  1: { message: "VaultExists" },
  /**
   * No vault with that id.
   */
  2: { message: "UnknownVault" },
  /**
   * The vault's contracts have already been wired.
   */
  3: { message: "AlreadyWired" },
};

/**
 * What a caller has to supply to launch a vault. Grouped into a struct because
 * a flat argument list would be long enough to be easy to misorder.
 */
export interface VaultRequest {
  issuer: string;
  metadata_hash: Buffer;
  metadata_uri: string;
  name: string;
  symbol: string;
  vault_id: Buffer;
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
   * Construct and simulate a wire_vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Grant the vault the `manager` role on the token, so it can mint on
   * `invest` and burn on `redeem`, then offer the token's admin role to the
   * platform.
   *
   * The handover is the two-step one `stellar_access` provides: the platform
   * admin has to call `accept_admin_transfer` on the token to complete it.
   * Until they do, the factory still holds the role, so a wrong address
   * cannot strand the token.
   *
   * Separate from `create_vault` to keep both calls inside the per-transaction
   * resource budget.
   */
  wire_vault: (
    { vault_id, operator }: { vault_id: Buffer; operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

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
   * Construct and simulate a create_vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deploy a vault's token, compliance contract and vault, and record it.
   *
   * The three addresses are derived from `vault_id`, so the backend can work
   * out where each contract will live before the transaction is sent.
   */
  create_vault: (
    {
      request,
      terms,
      tranches,
      operator,
    }: {
      request: VaultRequest;
      terms: VaultTerms;
      tranches: Array<TrancheInit>;
      operator: string;
    },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Deployment>>;

  /**
   * Construct and simulate a get_templates transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_templates: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Templates>>;

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
   * Construct and simulate a set_templates transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Point new vaults at different contract templates, without having to
   * redeploy the factory or lose the registry.
   */
  set_templates: (
    { templates, caller }: { templates: Templates; caller: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_deployment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_deployment: (
    { vault_id }: { vault_id: Buffer },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Deployment>>;

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
   * Construct and simulate a deployment_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  deployment_count: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a list_deployments transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * A page of the registry, so a front end can list every vault without an
   * indexer standing between it and the ledger.
   */
  list_deployments: (
    { start, limit }: { start: u32; limit: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Array<Deployment>>>;

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
      templates,
    }: { admin: string; manager: string; templates: Templates },
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
    return ContractClient.deploy({ admin, manager, templates }, options);
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAQAAAD1UaGUgdGVtcGxhdGVzIGFuZCBzaGFyZWQgY29udHJhY3RzIGV2ZXJ5IHZhdWx0IGlzIGJ1aWx0IGZyb20uAAAAAAAAAAAAAAlUZW1wbGF0ZXMAAAAAAAAHAAAAAAAAABRjb21wbGlhbmNlX3dhc21faGFzaAAAA+4AAAAgAAAAj1B1Ymxpc2hlZCBzbyBhIGZyb250IGVuZCBjYW4gZmluZCB0aGUgc2hhcmVkIHJlZ2lzdHJ5IGZyb20gdGhlIGZhY3RvcnkuClRoZSBmYWN0b3J5IGl0c2VsZiBuZXZlciBjYWxscyBpdDsgc2VlIHRoZSBub3RlIGF0IHRoZSB0b3Agb2YgdGhlIGZpbGUuAAAAABFpZGVudGl0eV9yZWdpc3RyeQAAAAAAABMAAAAAAAAAEWlkZW50aXR5X3ZlcmlmaWVyAAAAAAAAEwAAAMJXaG8gZW5kcyB1cCBvd25pbmcgZWFjaCB2YXVsdCdzIGNvbnRyYWN0cy4gVGhlIGZhY3RvcnkgaXMgbmV2ZXIgYQpsYXN0aW5nIG93bmVyIG9mIGFueXRoaW5nIGl0IGRlcGxveXM6IGl0IGhvbGRzIHRoZSB0b2tlbidzIGFkbWluIHJvbGUKb25seSBsb25nIGVub3VnaCB0byBlbXBvd2VyIHRoZSB2YXVsdCwgdGhlbiBoYW5kcyBpdCBvdmVyLgAAAAAADnBsYXRmb3JtX2FkbWluAAAAAAATAAAAAAAAABBwbGF0Zm9ybV9tYW5hZ2VyAAAAEwAAAAAAAAAPdG9rZW5fd2FzbV9oYXNoAAAAA+4AAAAgAAAAAAAAAA92YXVsdF93YXNtX2hhc2gAAAAD7gAAACA=",
        "AAAAAQAAADtPbmUgbGF1bmNoZWQgdmF1bHQgYW5kIHRoZSB0aHJlZSBjb250cmFjdHMgdGhhdCBtYWtlIGl0IHVwLgAAAAAAAAAACkRlcGxveW1lbnQAAAAAAAkAAAAAAAAACmNvbXBsaWFuY2UAAAAAABMAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAABmlzc3VlcgAAAAAAEwAAAI1IYXNoIG9mIHRoZSBvZmYtY2hhaW4gZm9ybSBhbmQgcHJvc3BlY3R1cywgc28gdGhlIHBhcGVyd29yayBiZWhpbmQgdGhlCnZhdWx0IGNhbiBiZSBwcm92ZW4gdW5jaGFuZ2VkIHdpdGhvdXQgcHV0dGluZyBhbnkgb2YgaXQgb24gdGhlIGxlZGdlci4AAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAxtZXRhZGF0YV91cmkAAAAQAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAABXZhdWx0AAAAAAAAEwAAAAAAAAAIdmF1bHRfaWQAAAPuAAAAIAAAAAAAAAAFd2lyZWQAAAAAAAAB",
        "AAAAAQAAAQtUaGUgY29tbWVyY2lhbCB0ZXJtcyBvZiBhIHZhdWx0LgoKVGhlcmUgaXMgbm8gYHRva2VuYCBoZXJlIG9uIHB1cnBvc2U6IHRoZSB0b2tlbiBkb2VzIG5vdCBleGlzdCB3aGVuIHRoZQpjYWxsZXIgYnVpbGRzIHRoaXMsIGFuZCB0aGUgZmFjdG9yeSBmaWxscyBpdCBpbiB3aXRoIHRoZSBvbmUgaXQgZGVwbG95cy4KTGV0dGluZyBhIGNhbGxlciBuYW1lIHRoZSB0b2tlbiB3b3VsZCBtYWtlIGl0IHBvc3NpYmxlIHRvIHBvaW50IGEgdmF1bHQgYXQKdGhlIHdyb25nIG9uZS4AAAAAAAAAAApWYXVsdFRlcm1zAAAAAAAJAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAADGV4aXRfZmVlX2JwcwAAAAQAAAA9UHJpbmNpcGFsIHBsdXMgaW50ZXJlc3QuIFRoZSByYXRlIGlzIGFwcGxpZWQgb2ZmLWNoYWluLCBvbmNlLgAAAAAAABJleHBlY3RlZF9yZXBheW1lbnQAAAAAAAsAAAAAAAAADWZlZV9yZWNpcGllbnQAAAAAAAATAAAAAAAAABBmdW5kaW5nX2RlYWRsaW5lAAAABgAAAAAAAAAQbWF4X2V4aXRfZmVlX2JwcwAAAAQAAAAAAAAACm1pbl90YXJnZXQAAAAAAAsAAAAAAAAABnRhcmdldAAAAAAACwAAAAAAAAAEdXNkYwAAABM=",
        "AAAABQAAAAAAAAAAAAAAClZhdWx0V2lyZWQAAAAAAAEAAAALdmF1bHRfd2lyZWQAAAAAAgAAAAAAAAAIdmF1bHRfaWQAAAPuAAAAIAAAAAEAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAC",
        "AAAAAQAAAD1PbmUgc2NoZWR1bGVkIHJlcGF5bWVudCwgYXMgdGhlIHZhdWx0J3MgY29uc3RydWN0b3IgdGFrZXMgaXQuAAAAAAAAAAAAAAtUcmFuY2hlSW5pdAAAAAACAAAAAAAAAAhkdWVfZGF0ZQAAAAYAAAAAAAAAD2V4cGVjdGVkX2Ftb3VudAAAAAAL",
        "AAAABAAAAAAAAAAAAAAADEZhY3RvcnlFcnJvcgAAAAMAAAAkQSB2YXVsdCB3aXRoIHRoYXQgaWQgYWxyZWFkeSBleGlzdHMuAAAAC1ZhdWx0RXhpc3RzAAAAAAEAAAAWTm8gdmF1bHQgd2l0aCB0aGF0IGlkLgAAAAAADFVua25vd25WYXVsdAAAAAIAAAAuVGhlIHZhdWx0J3MgY29udHJhY3RzIGhhdmUgYWxyZWFkeSBiZWVuIHdpcmVkLgAAAAAADEFscmVhZHlXaXJlZAAAAAM=",
        "AAAAAQAAAI5XaGF0IGEgY2FsbGVyIGhhcyB0byBzdXBwbHkgdG8gbGF1bmNoIGEgdmF1bHQuIEdyb3VwZWQgaW50byBhIHN0cnVjdCBiZWNhdXNlCmEgZmxhdCBhcmd1bWVudCBsaXN0IHdvdWxkIGJlIGxvbmcgZW5vdWdoIHRvIGJlIGVhc3kgdG8gbWlzb3JkZXIuAAAAAAAAAAAADFZhdWx0UmVxdWVzdAAAAAYAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAxtZXRhZGF0YV91cmkAAAAQAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3ltYm9sAAAAAAAQAAAAAAAAAAh2YXVsdF9pZAAAA+4AAAAg",
        "AAAABQAAAAAAAAAAAAAADFZhdWx0Q3JlYXRlZAAAAAEAAAANdmF1bHRfY3JlYXRlZAAAAAAAAAUAAAAAAAAACHZhdWx0X2lkAAAD7gAAACAAAAABAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAAAAAAAApjb21wbGlhbmNlAAAAAAATAAAAAAAAAAAAAAAFdmF1bHQAAAAAAAATAAAAAAAAAAI=",
        "AAAAAAAAAXJSZXR1cm5zIGBTb21lKGluZGV4KWAgaWYgdGhlIGFjY291bnQgaGFzIHRoZSBzcGVjaWZpZWQgcm9sZSwKd2hlcmUgYGluZGV4YCBpcyB0aGUgcG9zaXRpb24gb2YgdGhlIGFjY291bnQgZm9yIHRoYXQgcm9sZSwKYW5kIGNhbiBiZSB1c2VkIHRvIHF1ZXJ5IFtgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyKClgXS4KUmV0dXJucyBgTm9uZWAgaWYgdGhlIGFjY291bnQgZG9lcyBub3QgaGF2ZSB0aGUgc3BlY2lmaWVkIHJvbGUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBjaGVjay4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBjaGVjayBmb3IuAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAABHJvbGUAAAARAAAAAQAAA+gAAAAE",
        "AAAABQAAAAAAAAAAAAAAEFRlbXBsYXRlc0NoYW5nZWQAAAABAAAAEXRlbXBsYXRlc19jaGFuZ2VkAAAAAAAAAwAAAAAAAAAPdG9rZW5fd2FzbV9oYXNoAAAAA+4AAAAgAAAAAAAAAAAAAAAUY29tcGxpYW5jZV93YXNtX2hhc2gAAAPuAAAAIAAAAAAAAAAAAAAAD3ZhdWx0X3dhc21faGFzaAAAAAPuAAAAIAAAAAAAAAAC",
        "AAAAAAAAAE9SZXR1cm5zIHRoZSBhZG1pbiBhY2NvdW50LgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAlnZXRfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAj5HcmFudHMgYSByb2xlIHRvIGFuIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBncmFudCB0aGUgcm9sZSB0by4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBncmFudC4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFkbWluIG9yIGhhdmUgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGNhbGxlciBkb2VzIG5vdCBoYXZlCmVub3VnaCBwcml2aWxlZ2VzLgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpNYXhSb2xlc0V4Y2VlZGVkYF0gLSBJZiBhZGRpbmcgYSBuZXcgcm9sZSB3b3VsZApleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCBudW1iZXIgb2Ygcm9sZXMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2dyYW50ZWQiLCByb2xlOiBTeW1ib2wsIGFjY291bnQ6IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2NhbGxlcjogQWRkcmVzc11gAAAAAAAKZ3JhbnRfcm9sZQAAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAd9HcmFudCB0aGUgdmF1bHQgdGhlIGBtYW5hZ2VyYCByb2xlIG9uIHRoZSB0b2tlbiwgc28gaXQgY2FuIG1pbnQgb24KYGludmVzdGAgYW5kIGJ1cm4gb24gYHJlZGVlbWAsIHRoZW4gb2ZmZXIgdGhlIHRva2VuJ3MgYWRtaW4gcm9sZSB0byB0aGUKcGxhdGZvcm0uCgpUaGUgaGFuZG92ZXIgaXMgdGhlIHR3by1zdGVwIG9uZSBgc3RlbGxhcl9hY2Nlc3NgIHByb3ZpZGVzOiB0aGUgcGxhdGZvcm0KYWRtaW4gaGFzIHRvIGNhbGwgYGFjY2VwdF9hZG1pbl90cmFuc2ZlcmAgb24gdGhlIHRva2VuIHRvIGNvbXBsZXRlIGl0LgpVbnRpbCB0aGV5IGRvLCB0aGUgZmFjdG9yeSBzdGlsbCBob2xkcyB0aGUgcm9sZSwgc28gYSB3cm9uZyBhZGRyZXNzCmNhbm5vdCBzdHJhbmQgdGhlIHRva2VuLgoKU2VwYXJhdGUgZnJvbSBgY3JlYXRlX3ZhdWx0YCB0byBrZWVwIGJvdGggY2FsbHMgaW5zaWRlIHRoZSBwZXItdHJhbnNhY3Rpb24KcmVzb3VyY2UgYnVkZ2V0LgAAAAAKd2lyZV92YXVsdAAAAAAAAgAAAAAAAAAIdmF1bHRfaWQAAAPuAAAAIAAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAA==",
        "AAAAAAAAArdSZXZva2VzIGEgcm9sZSBmcm9tIGFuIGFjY291bnQuClRvIHJldm9rZSB0aGUgY2FsbGVyJ3Mgb3duIHJvbGUsIHVzZQpbYEFjY2Vzc0NvbnRyb2w6OnJlbm91bmNlX3JvbGUoKWBdIGluc3RlYWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byByZXZva2UgdGhlIHJvbGUgZnJvbS4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZXZva2UuCiogYGNhbGxlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgY2FsbGVyLCBtdXN0IGJlIHRoZSBhZG1pbiBvciBoYXMgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGBjYWxsZXJgIGRvZXMgbm90IGhhdmUKZW5vdWdoIHByaXZpbGVnZXMuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVOb3RIZWxkYF0gLSBJZiB0aGUgYGFjY291bnRgIGRvZXNuJ3QgaGF2ZQp0aGUgcm9sZS4KKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZUlzRW1wdHlgXSAtIElmIHRoZSByb2xlIGhhcyBubyBtZW1iZXJzLgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsicm9sZV9yZXZva2VkIiwgcm9sZTogU3ltYm9sLCBhY2NvdW50OiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtjYWxsZXI6IEFkZHJlc3NdYAAAAAALcmV2b2tlX3JvbGUAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAANFEZXBsb3kgYSB2YXVsdCdzIHRva2VuLCBjb21wbGlhbmNlIGNvbnRyYWN0IGFuZCB2YXVsdCwgYW5kIHJlY29yZCBpdC4KClRoZSB0aHJlZSBhZGRyZXNzZXMgYXJlIGRlcml2ZWQgZnJvbSBgdmF1bHRfaWRgLCBzbyB0aGUgYmFja2VuZCBjYW4gd29yawpvdXQgd2hlcmUgZWFjaCBjb250cmFjdCB3aWxsIGxpdmUgYmVmb3JlIHRoZSB0cmFuc2FjdGlvbiBpcyBzZW50LgAAAAAAAAxjcmVhdGVfdmF1bHQAAAAEAAAAAAAAAAdyZXF1ZXN0AAAAB9AAAAAMVmF1bHRSZXF1ZXN0AAAAAAAAAAV0ZXJtcwAAAAAAB9AAAAAKVmF1bHRUZXJtcwAAAAAAAAAAAAh0cmFuY2hlcwAAA+oAAAfQAAAAC1RyYW5jaGVJbml0AAAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAQAAB9AAAAAKRGVwbG95bWVudAAA",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAHbWFuYWdlcgAAAAATAAAAAAAAAAl0ZW1wbGF0ZXMAAAAAAAfQAAAACVRlbXBsYXRlcwAAAAAAAAA=",
        "AAAAAAAAAAAAAAANZ2V0X3RlbXBsYXRlcwAAAAAAAAAAAAABAAAH0AAAAAlUZW1wbGF0ZXMAAAA=",
        "AAAAAAAAAhZBbGxvd3MgYW4gYWNjb3VudCB0byByZW5vdW5jZSBhIHJvbGUgYXNzaWduZWQgdG8gaXRzZWxmLgpVc2VycyBjYW4gb25seSByZW5vdW5jZSByb2xlcyBmb3IgdGhlaXIgb3duIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZW5vdW5jZS4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFjY291bnQgdGhhdCBoYXMgdGhlCnJvbGUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZU5vdEhlbGRgXSAtIElmIHRoZSBgY2FsbGVyYCBkb2Vzbid0IGhhdmUgdGhlCnJvbGUuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVJc0VtcHR5YF0gLSBJZiB0aGUgcm9sZSBoYXMgbm8gbWVtYmVycy4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInJvbGVfcmV2b2tlZCIsIHJvbGU6IFN5bWJvbCwgYWNjb3VudDogQWRkcmVzc11gCiogZGF0YSAtIGBbY2FsbGVyOiBBZGRyZXNzXWAAAAAAAA1yZW5vdW5jZV9yb2xlAAAAAAAAAgAAAAAAAAAEcm9sZQAAABEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAG5Qb2ludCBuZXcgdmF1bHRzIGF0IGRpZmZlcmVudCBjb250cmFjdCB0ZW1wbGF0ZXMsIHdpdGhvdXQgaGF2aW5nIHRvCnJlZGVwbG95IHRoZSBmYWN0b3J5IG9yIGxvc2UgdGhlIHJlZ2lzdHJ5LgAAAAAADXNldF90ZW1wbGF0ZXMAAAAAAAACAAAAAAAAAAl0ZW1wbGF0ZXMAAAAAAAfQAAAACVRlbXBsYXRlcwAAAAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAOZ2V0X2RlcGxveW1lbnQAAAAAAAEAAAAAAAAACHZhdWx0X2lkAAAD7gAAACAAAAABAAAH0AAAAApEZXBsb3ltZW50AAA=",
        "AAAAAAAAAMVSZXR1cm5zIHRoZSBhZG1pbiByb2xlIGZvciBhIHNwZWNpZmljIHJvbGUuCklmIG5vIGFkbWluIHJvbGUgaXMgZXhwbGljaXRseSBzZXQsIHJldHVybnMgYE5vbmVgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHJvbGVgIC0gVGhlIHJvbGUgdG8gcXVlcnkgdGhlIGFkbWluIHJvbGUgZm9yLgAAAAAAAA5nZXRfcm9sZV9hZG1pbgAAAAAAAQAAAAAAAAAEcm9sZQAAABEAAAABAAAD6AAAABE=",
        "AAAAAAAAAfZBbGxvd3MgdGhlIGN1cnJlbnQgYWRtaW4gdG8gcmVub3VuY2UgdGhlaXIgcm9sZSwgbWFraW5nIHRoZSBjb250cmFjdApwZXJtYW5lbnRseSBhZG1pbi1sZXNzLiBUaGlzIGlzIHVzZWZ1bCBmb3IgZGVjZW50cmFsaXphdGlvbiBwdXJwb3NlcwpvciB3aGVuIHRoZSBhZG1pbiByb2xlIGlzIG5vIGxvbmdlciBuZWVkZWQuIE9uY2UgdGhlIGFkbWluIGlzCnJlbm91bmNlZCwgaXQgY2Fubm90IGJlIHJlaW5zdGF0ZWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgRXJyb3JzCgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgbm8gYWRtaW4gYWNjb3VudCBpcyBzZXQuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhZG1pbl9yZW5vdW5jZWQiLCBhZG1pbjogQWRkcmVzc11gCiogZGF0YSAtIGBbXWAKCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAOcmVub3VuY2VfYWRtaW4AAAAAAAAAAAAA",
        "AAAAAAAAAb1TZXRzIGBhZG1pbl9yb2xlYCBhcyB0aGUgYWRtaW4gcm9sZSBvZiBgcm9sZWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBzZXQgdGhlIGFkbWluIGZvci4KKiBgYWRtaW5fcm9sZWAgLSBUaGUgbmV3IGFkbWluIHJvbGUuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2FkbWluX2NoYW5nZWQiLCByb2xlOiBTeW1ib2xdYAoqIGRhdGEgLSBgW3ByZXZpb3VzX2FkbWluX3JvbGU6IFN5bWJvbCwgbmV3X2FkbWluX3JvbGU6IFN5bWJvbF1gCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6QWRtaW5Ob3RTZXRgXSAtIElmIGFkbWluIGFjY291bnQgaXMgbm90IHNldC4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAADnNldF9yb2xlX2FkbWluAAAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAKYWRtaW5fcm9sZQAAAAAAEQAAAAA=",
        "AAAAAAAAAllSZXR1cm5zIHRoZSBhY2NvdW50IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggZm9yIGEgZ2l2ZW4gcm9sZS4KCkEgZnVuY3Rpb24gdG8gZ2V0IGFsbCBtZW1iZXJzIG9mIGEgcm9sZSBpcyBub3QgcHJvdmlkZWQgYmVjYXVzZSB0aGF0CndvdWxkIGJlIHVuYm91bmRlZC4gVG8gZW51bWVyYXRlIGFsbCBtZW1iZXJzIG9mIGEgcm9sZSwgdXNlCltgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyX2NvdW50KClgXSB0byBnZXQgdGhlIHRvdGFsIG51bWJlciBvZgptZW1iZXJzIGFuZCB0aGVuIHVzZSBbYEFjY2Vzc0NvbnRyb2w6OmdldF9yb2xlX21lbWJlcigpYF0gdG8gcmV0cmlldmUKZWFjaCBtZW1iZXIgb25lIGJ5IG9uZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIHF1ZXJ5LgoqIGBpbmRleGAgLSBUaGUgaW5kZXggb2YgdGhlIGFjY291bnQgdG8gcmV0cmlldmUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6SW5kZXhPdXRPZkJvdW5kc2BdIC0gSWYgdGhlIGluZGV4IGlzIG91dCBvZgpib3VuZHMgZm9yIHRoZSByb2xlJ3MgbWVtYmVyIGxpc3QuAAAAAAAAD2dldF9yb2xlX21lbWJlcgAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAQZGVwbG95bWVudF9jb3VudAAAAAAAAAABAAAABA==",
        "AAAAAAAAAHJBIHBhZ2Ugb2YgdGhlIHJlZ2lzdHJ5LCBzbyBhIGZyb250IGVuZCBjYW4gbGlzdCBldmVyeSB2YXVsdCB3aXRob3V0IGFuCmluZGV4ZXIgc3RhbmRpbmcgYmV0d2VlbiBpdCBhbmQgdGhlIGxlZGdlci4AAAAAABBsaXN0X2RlcGxveW1lbnRzAAAAAgAAAAAAAAAFc3RhcnQAAAAAAAAEAAAAAAAAAAVsaW1pdAAAAAAAAAQAAAABAAAD6gAAB9AAAAAKRGVwbG95bWVudAAA",
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
    has_role: this.txFromJSON<Option<u32>>,
    get_admin: this.txFromJSON<Option<string>>,
    grant_role: this.txFromJSON<null>,
    wire_vault: this.txFromJSON<null>,
    revoke_role: this.txFromJSON<null>,
    create_vault: this.txFromJSON<Deployment>,
    get_templates: this.txFromJSON<Templates>,
    renounce_role: this.txFromJSON<null>,
    set_templates: this.txFromJSON<null>,
    get_deployment: this.txFromJSON<Deployment>,
    get_role_admin: this.txFromJSON<Option<string>>,
    renounce_admin: this.txFromJSON<null>,
    set_role_admin: this.txFromJSON<null>,
    get_role_member: this.txFromJSON<string>,
    deployment_count: this.txFromJSON<u32>,
    list_deployments: this.txFromJSON<Array<Deployment>>,
    get_existing_roles: this.txFromJSON<Array<string>>,
    transfer_admin_role: this.txFromJSON<null>,
    accept_admin_transfer: this.txFromJSON<null>,
    get_role_member_count: this.txFromJSON<u32>,
  };
}
