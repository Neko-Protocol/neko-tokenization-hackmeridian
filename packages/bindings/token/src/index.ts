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

export const PausableError = {
  /**
   * The operation failed because the contract is paused.
   */
  1000: { message: "EnforcedPause" },
  /**
   * The operation failed because the contract is not paused.
   */
  1001: { message: "ExpectedPause" },
};

export const RWAError = {
  /**
   * Indicates an error related to insufficient balance for the operation.
   */
  300: { message: "InsufficientBalance" },
  /**
   * Indicates an error when an input must be >= 0.
   */
  301: { message: "LessThanZero" },
  /**
   * Indicates the address is frozen and cannot perform operations.
   */
  302: { message: "AddressFrozen" },
  /**
   * Indicates insufficient free tokens (due to partial freezing).
   */
  303: { message: "InsufficientFreeTokens" },
  /**
   * Indicates an identity cannot be verified.
   */
  304: { message: "IdentityVerificationFailed" },
  /**
   * Indicates the compliance contract is not set.
   */
  307: { message: "ComplianceNotSet" },
  /**
   * Indicates the onchain ID is not set.
   */
  308: { message: "OnchainIdNotSet" },
  /**
   * Indicates the version is not set.
   */
  309: { message: "VersionNotSet" },
  /**
   * Indicates the claim topics and issuers contract is not set.
   */
  310: { message: "ClaimTopicsAndIssuersNotSet" },
  /**
   * Indicates the identity registry storage contract is not set.
   */
  311: { message: "IdentityRegistryStorageNotSet" },
  /**
   * Indicates the identity verifier contract is not set.
   */
  312: { message: "IdentityVerifierNotSet" },
  /**
   * Indicates the old account and new account have different identities.
   */
  313: { message: "IdentityMismatch" },
  /**
   * Indicates the parallel arrays of a batch call have different lengths.
   */
  314: { message: "BatchSizeMismatch" },
};

export const FungibleTokenError = {
  /**
   * Indicates an error related to the current balance of account from which
   * tokens are expected to be transferred.
   */
  100: { message: "InsufficientBalance" },
  /**
   * Indicates a failure with the allowance mechanism when a given spender
   * doesn't have enough allowance.
   */
  101: { message: "InsufficientAllowance" },
  /**
   * Indicates an invalid value for `live_until_ledger` when setting an
   * allowance.
   */
  102: { message: "InvalidLiveUntilLedger" },
  /**
   * Indicates an error when an input that must be >= 0
   */
  103: { message: "LessThanZero" },
  /**
   * Indicates an overflow or underflow in an arithmetic operation
   */
  104: { message: "MathOverflow" },
  /**
   * Indicates access to uninitialized metadata
   */
  105: { message: "UnsetMetadata" },
  /**
   * Indicates that the operation would have caused `total_supply` to exceed
   * the `cap`.
   */
  106: { message: "ExceededCap" },
  /**
   * Indicates the supplied `cap` is not a valid cap value.
   */
  107: { message: "InvalidCap" },
  /**
   * Indicates the Cap was not set.
   */
  108: { message: "CapNotSet" },
  /**
   * Indicates the SAC address was not set.
   */
  109: { message: "SACNotSet" },
  /**
   * Indicates a SAC address different than expected.
   */
  110: { message: "SACAddressMismatch" },
  /**
   * Indicates a missing function parameter in the SAC contract context.
   */
  111: { message: "SACMissingFnParam" },
  /**
   * Indicates an invalid function parameter in the SAC contract context.
   */
  112: { message: "SACInvalidFnParam" },
  /**
   * The user is not allowed to perform this operation
   */
  113: { message: "UserNotAllowed" },
  /**
   * The user is blocked and cannot perform this operation
   */
  114: { message: "UserBlocked" },
};

export interface Client {
  /**
   * Construct and simulate a burn transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  burn: (
    {
      user_address,
      amount,
      operator,
    }: { user_address: string; amount: i128; operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mint: (
    { to, amount, operator }: { to: string; amount: i128; operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the name for this token.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   */
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: (
    { caller }: { caller: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns true if the contract is paused, and false otherwise.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   */
  paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the symbol for this token.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   */
  symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the amount of tokens a `spender` is allowed to spend on behalf of
   * an `owner`. Overrides any existing allowance set between `spender` and
   * `owner`.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `owner` - The address holding the tokens.
   * * `spender` - The address authorized to spend the tokens.
   * * `amount` - The amount of tokens made available to `spender`.
   * * `live_until_ledger` - The ledger number at which the allowance
   * expires.
   *
   * # Errors
   *
   * * [`FungibleTokenError::InvalidLiveUntilLedger`] - Occurs when
   * attempting to set `live_until_ledger` that is less than the current
   * ledger number and greater than `0`.
   * * [`FungibleTokenError::LessThanZero`] - Occurs when `amount < 0`.
   *
   * # Events
   *
   * * topics - `["approve", owner: Address, spender: Address]`
   * * data - `[amount: i128, live_until_ledger: u32]`
   */
  approve: (
    {
      owner,
      spender,
      amount,
      live_until_ledger,
    }: { owner: string; spender: string; amount: i128; live_until_ledger: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the amount of tokens held by `account`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `account` - The address for which the balance is being queried.
   */
  balance: (
    { account }: { account: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  unpause: (
    { caller }: { caller: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the version of the token (T-REX version).
   *
   * # Errors
   *
   * * [`RWAError::VersionNotSet`] - When the token version is not set.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a decimals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the number of decimals used to represent amounts of this token.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   */
  decimals: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;

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
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Showcase: how to opt out of custodial (muxed) destinations.
   *
   * **SHOWCASE ONLY**: this override exists purely to illustrate how the
   * opt-out is written. It is neither a recommendation nor part of the
   * library's behavior, and it is not required for a conforming RWA token.
   * Whether to accept custodial destinations is entirely the implementor's
   * decision, and both answers are legitimate.
   *
   * Background: [`RWA`] accepts a muxed destination. Identity verification
   * and compliance run against the base address, and the muxed ID is
   * recorded in the transfer event so a custodian can attribute the
   * transfer to one of its off-chain sub-accounts. A verified holder may
   * therefore be a custodian holding on behalf of beneficiaries who have no
   * on-chain identity of their own, and the ID itself carries no on-chain
   * verification. That is the intended arrangement for omnibus custody, and
   * it is what the library does by default.
   *
   * An issuer that instead requires beneficial owners on the on-chain
   * register can refuse muxed destinations, which is wh
   */
  transfer: (
    { from, to, amount }: { from: string; to: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a allowance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the amount of tokens a `spender` is allowed to spend on behalf
   * of an `owner`.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `owner` - The address holding the tokens.
   * * `spender` - The address authorized to spend the tokens.
   */
  allowance: (
    { owner, spender }: { owner: string; spender: string },
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
   * Construct and simulate a is_frozen transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the freezing status of a wallet.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `user_address` - The address of the wallet to check.
   */
  is_frozen: (
    { user_address }: { user_address: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<boolean>>;

  /**
   * Construct and simulate a batch_burn transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  batch_burn: (
    {
      user_addresses,
      amounts,
      operator,
    }: {
      user_addresses: Array<string>;
      amounts: Array<i128>;
      operator: string;
    },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a batch_mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  batch_mint: (
    {
      to_list,
      amounts,
      operator,
    }: { to_list: Array<string>; amounts: Array<i128>; operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a compliance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the Compliance contract linked to the token.
   *
   * # Errors
   *
   * * [`RWAError::ComplianceNotSet`] - When the compliance contract is not
   * set.
   */
  compliance: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<string>>;

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
   * Construct and simulate a onchain_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the address of the onchain ID of the token.
   *
   * # Errors
   *
   * * [`RWAError::OnchainIdNotSet`] - When the onchain ID is not set.
   */
  onchain_id: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<string>>;

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
   * Construct and simulate a total_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the total amount of tokens in circulation.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   */
  total_supply: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

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
   * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfers `amount` of tokens from `from` to `to` using the
   * allowance mechanism. `amount` is then deducted from `spender`
   * allowance.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `spender` - The address authorizing the transfer, and having its
   * allowance consumed during the transfer.
   * * `from` - The address holding the tokens which will be transferred.
   * * `to` - The address receiving the transferred tokens.
   * * `amount` - The amount of tokens to be transferred.
   *
   * # Errors
   *
   * * [`FungibleTokenError::InsufficientBalance`] - When attempting to
   * transfer more tokens than `from` current balance.
   * * [`FungibleTokenError::LessThanZero`] - When `amount < 0`.
   * * [`FungibleTokenError::InsufficientAllowance`] - When attempting to
   * transfer more tokens than `spender` current allowance.
   *
   * # Events
   *
   * * topics - `["transfer", from: Address, to: Address]`
   * * data - `[amount: i128]`
   */
  transfer_from: (
    {
      spender,
      from,
      to,
      amount,
    }: { spender: string; from: string; to: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a batch_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfers tokens to several recipients in a single call, moving
   * `amounts[i]` to `recipients[i]`. The batched form of
   * [`FungibleToken::transfer`], authorized once by `from`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `from` - The address of the sender.
   * * `recipients` - The addresses of the receivers.
   * * `amounts` - The number of tokens to transfer to each recipient.
   *
   * # Errors
   *
   * * refer to [`RWA::batch_transfer`] errors.
   *
   * # Events
   *
   * For each recipient:
   * * topics - `["transfer", from: Address, to: Address]`
   * * data - `[amount: i128]`
   *
   * # Notes
   *
   * The sender's identity is verified once for the whole batch instead of
   * once per recipient, which is where the saving over repeated single
   * transfers comes from. Refer to [`RWA::batch_transfer`] for the mechanics
   * and the assumption that rests on, and to the batch operations section of
   * the [module documentation](crate::rwa) for how to size a batch.
   */
  batch_transfer: (
    {
      from,
      recipients,
      amounts,
    }: { from: string; recipients: Array<string>; amounts: Array<i128> },
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
   * Construct and simulate a set_compliance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_compliance: (
    { compliance, operator }: { compliance: string; operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_onchain_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Point the token at the issuer's on-chain identity.
   *
   * Added by Neko; the rest of this file is OpenZeppelin's RWA example
   * verbatim. SEP-57 lists `onchain_id` as token metadata, but the example
   * exposes only the getter, so `onchain_id()` panics with
   * `OnchainIdNotSet` on a freshly deployed token and nothing can ever set
   * it. The library has the setter; this publishes it behind the same
   * `manager` role as the token's other privileged calls.
   *
   * It is a setter rather than a constructor argument because the issuer's
   * identity contract does not necessarily exist when the token is
   * deployed, and because the factory's `create_vault` would otherwise need
   * to know about it.
   *
   * `version()` has the same gap and no fix: `stellar-tokens` v0.8.0 ships
   * no `set_version` at all, so that one stays broken until OpenZeppelin
   * adds one.
   */
  set_onchain_id: (
    { onchain_id, operator }: { onchain_id: string; operator: string },
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
   * Construct and simulate a forced_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  forced_transfer: (
    {
      from,
      to,
      amount,
      operator,
    }: { from: string; to: string; amount: i128; operator: string },
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
   * Construct and simulate a recover_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  recover_balance: (
    {
      old_account,
      new_account,
      operator,
    }: { old_account: string; new_account: string; operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<boolean>>;

  /**
   * Construct and simulate a get_frozen_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the amount of tokens that are partially frozen on a wallet.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `user_address` - The address of the wallet to check.
   */
  get_frozen_tokens: (
    { user_address }: { user_address: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a identity_verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the Identity Verifier contract linked to the token.
   *
   * # Errors
   *
   * * [`RWAError::IdentityVerifierNotSet`] - When the identity verifier
   * contract is not set.
   */
  identity_verifier: (
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
   * Construct and simulate a set_address_frozen transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_address_frozen: (
    {
      user_address,
      freeze,
      operator,
    }: { user_address: string; freeze: boolean; operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

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
   * Construct and simulate a batch_forced_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  batch_forced_transfer: (
    {
      from_list,
      to_list,
      amounts,
      operator,
    }: {
      from_list: Array<string>;
      to_list: Array<string>;
      amounts: Array<i128>;
      operator: string;
    },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a freeze_partial_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  freeze_partial_tokens: (
    {
      user_address,
      amount,
      operator,
    }: { user_address: string; amount: i128; operator: string },
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

  /**
   * Construct and simulate a set_identity_verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_identity_verifier: (
    {
      identity_verifier,
      operator,
    }: { identity_verifier: string; operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a unfreeze_partial_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  unfreeze_partial_tokens: (
    {
      user_address,
      amount,
      operator,
    }: { user_address: string; amount: i128; operator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a batch_set_address_frozen transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  batch_set_address_frozen: (
    {
      user_addresses,
      freeze_list,
      operator,
    }: {
      user_addresses: Array<string>;
      freeze_list: Array<boolean>;
      operator: string;
    },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a batch_freeze_partial_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  batch_freeze_partial_tokens: (
    {
      user_addresses,
      amounts,
      operator,
    }: {
      user_addresses: Array<string>;
      amounts: Array<i128>;
      operator: string;
    },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a batch_unfreeze_partial_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  batch_unfreeze_partial_tokens: (
    {
      user_addresses,
      amounts,
      operator,
    }: {
      user_addresses: Array<string>;
      amounts: Array<i128>;
      operator: string;
    },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    {
      name,
      symbol,
      admin,
      manager,
      compliance,
      identity_verifier,
    }: {
      name: string;
      symbol: string;
      admin: string;
      manager: string;
      compliance: string;
      identity_verifier: string;
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
      { name, symbol, admin, manager, compliance, identity_verifier },
      options
    );
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAAAAAAAAAAAEYnVybgAAAAMAAAAAAAAADHVzZXJfYWRkcmVzcwAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAEbWludAAAAAMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAFVSZXR1cm5zIHRoZSBuYW1lIGZvciB0aGlzIHRva2VuLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAAABG5hbWUAAAAAAAAAAQAAABA=",
        "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAHFSZXR1cm5zIHRydWUgaWYgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZCwgYW5kIGZhbHNlIG90aGVyd2lzZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgAAAAAAAAZwYXVzZWQAAAAAAAAAAAABAAAAAQ==",
        "AAAAAAAAAFdSZXR1cm5zIHRoZSBzeW1ib2wgZm9yIHRoaXMgdG9rZW4uCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4AAAAABnN5bWJvbAAAAAAAAAAAAAEAAAAQ",
        "AAAAAAAAAydTZXRzIHRoZSBhbW91bnQgb2YgdG9rZW5zIGEgYHNwZW5kZXJgIGlzIGFsbG93ZWQgdG8gc3BlbmQgb24gYmVoYWxmIG9mCmFuIGBvd25lcmAuIE92ZXJyaWRlcyBhbnkgZXhpc3RpbmcgYWxsb3dhbmNlIHNldCBiZXR3ZWVuIGBzcGVuZGVyYCBhbmQKYG93bmVyYC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBvd25lcmAgLSBUaGUgYWRkcmVzcyBob2xkaW5nIHRoZSB0b2tlbnMuCiogYHNwZW5kZXJgIC0gVGhlIGFkZHJlc3MgYXV0aG9yaXplZCB0byBzcGVuZCB0aGUgdG9rZW5zLgoqIGBhbW91bnRgIC0gVGhlIGFtb3VudCBvZiB0b2tlbnMgbWFkZSBhdmFpbGFibGUgdG8gYHNwZW5kZXJgLgoqIGBsaXZlX3VudGlsX2xlZGdlcmAgLSBUaGUgbGVkZ2VyIG51bWJlciBhdCB3aGljaCB0aGUgYWxsb3dhbmNlCmV4cGlyZXMuCgojIEVycm9ycwoKKiBbYEZ1bmdpYmxlVG9rZW5FcnJvcjo6SW52YWxpZExpdmVVbnRpbExlZGdlcmBdIC0gT2NjdXJzIHdoZW4KYXR0ZW1wdGluZyB0byBzZXQgYGxpdmVfdW50aWxfbGVkZ2VyYCB0aGF0IGlzIGxlc3MgdGhhbiB0aGUgY3VycmVudApsZWRnZXIgbnVtYmVyIGFuZCBncmVhdGVyIHRoYW4gYDBgLgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpMZXNzVGhhblplcm9gXSAtIE9jY3VycyB3aGVuIGBhbW91bnQgPCAwYC4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbImFwcHJvdmUiLCBvd25lcjogQWRkcmVzcywgc3BlbmRlcjogQWRkcmVzc11gCiogZGF0YSAtIGBbYW1vdW50OiBpMTI4LCBsaXZlX3VudGlsX2xlZGdlcjogdTMyXWAAAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAA==",
        "AAAAAAAAAKpSZXR1cm5zIHRoZSBhbW91bnQgb2YgdG9rZW5zIGhlbGQgYnkgYGFjY291bnRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBhY2NvdW50YCAtIFRoZSBhZGRyZXNzIGZvciB3aGljaCB0aGUgYmFsYW5jZSBpcyBiZWluZyBxdWVyaWVkLgAAAAAAB2JhbGFuY2UAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAH9SZXR1cm5zIHRoZSB2ZXJzaW9uIG9mIHRoZSB0b2tlbiAoVC1SRVggdmVyc2lvbikuCgojIEVycm9ycwoKKiBbYFJXQUVycm9yOjpWZXJzaW9uTm90U2V0YF0gLSBXaGVuIHRoZSB0b2tlbiB2ZXJzaW9uIGlzIG5vdCBzZXQuAAAAAAd2ZXJzaW9uAAAAAAAAAAABAAAAEA==",
        "AAAAAAAAAHxSZXR1cm5zIHRoZSBudW1iZXIgb2YgZGVjaW1hbHMgdXNlZCB0byByZXByZXNlbnQgYW1vdW50cyBvZiB0aGlzIHRva2VuLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAACGRlY2ltYWxzAAAAAAAAAAEAAAAE",
        "AAAAAAAAAXJSZXR1cm5zIGBTb21lKGluZGV4KWAgaWYgdGhlIGFjY291bnQgaGFzIHRoZSBzcGVjaWZpZWQgcm9sZSwKd2hlcmUgYGluZGV4YCBpcyB0aGUgcG9zaXRpb24gb2YgdGhlIGFjY291bnQgZm9yIHRoYXQgcm9sZSwKYW5kIGNhbiBiZSB1c2VkIHRvIHF1ZXJ5IFtgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyKClgXS4KUmV0dXJucyBgTm9uZWAgaWYgdGhlIGFjY291bnQgZG9lcyBub3QgaGF2ZSB0aGUgc3BlY2lmaWVkIHJvbGUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBjaGVjay4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBjaGVjayBmb3IuAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAABHJvbGUAAAARAAAAAQAAA+gAAAAE",
        "AAAAAAAABABTaG93Y2FzZTogaG93IHRvIG9wdCBvdXQgb2YgY3VzdG9kaWFsIChtdXhlZCkgZGVzdGluYXRpb25zLgoKKipTSE9XQ0FTRSBPTkxZKio6IHRoaXMgb3ZlcnJpZGUgZXhpc3RzIHB1cmVseSB0byBpbGx1c3RyYXRlIGhvdyB0aGUKb3B0LW91dCBpcyB3cml0dGVuLiBJdCBpcyBuZWl0aGVyIGEgcmVjb21tZW5kYXRpb24gbm9yIHBhcnQgb2YgdGhlCmxpYnJhcnkncyBiZWhhdmlvciwgYW5kIGl0IGlzIG5vdCByZXF1aXJlZCBmb3IgYSBjb25mb3JtaW5nIFJXQSB0b2tlbi4KV2hldGhlciB0byBhY2NlcHQgY3VzdG9kaWFsIGRlc3RpbmF0aW9ucyBpcyBlbnRpcmVseSB0aGUgaW1wbGVtZW50b3IncwpkZWNpc2lvbiwgYW5kIGJvdGggYW5zd2VycyBhcmUgbGVnaXRpbWF0ZS4KCkJhY2tncm91bmQ6IFtgUldBYF0gYWNjZXB0cyBhIG11eGVkIGRlc3RpbmF0aW9uLiBJZGVudGl0eSB2ZXJpZmljYXRpb24KYW5kIGNvbXBsaWFuY2UgcnVuIGFnYWluc3QgdGhlIGJhc2UgYWRkcmVzcywgYW5kIHRoZSBtdXhlZCBJRCBpcwpyZWNvcmRlZCBpbiB0aGUgdHJhbnNmZXIgZXZlbnQgc28gYSBjdXN0b2RpYW4gY2FuIGF0dHJpYnV0ZSB0aGUKdHJhbnNmZXIgdG8gb25lIG9mIGl0cyBvZmYtY2hhaW4gc3ViLWFjY291bnRzLiBBIHZlcmlmaWVkIGhvbGRlciBtYXkKdGhlcmVmb3JlIGJlIGEgY3VzdG9kaWFuIGhvbGRpbmcgb24gYmVoYWxmIG9mIGJlbmVmaWNpYXJpZXMgd2hvIGhhdmUgbm8Kb24tY2hhaW4gaWRlbnRpdHkgb2YgdGhlaXIgb3duLCBhbmQgdGhlIElEIGl0c2VsZiBjYXJyaWVzIG5vIG9uLWNoYWluCnZlcmlmaWNhdGlvbi4gVGhhdCBpcyB0aGUgaW50ZW5kZWQgYXJyYW5nZW1lbnQgZm9yIG9tbmlidXMgY3VzdG9keSwgYW5kCml0IGlzIHdoYXQgdGhlIGxpYnJhcnkgZG9lcyBieSBkZWZhdWx0LgoKQW4gaXNzdWVyIHRoYXQgaW5zdGVhZCByZXF1aXJlcyBiZW5lZmljaWFsIG93bmVycyBvbiB0aGUgb24tY2hhaW4KcmVnaXN0ZXIgY2FuIHJlZnVzZSBtdXhlZCBkZXN0aW5hdGlvbnMsIHdoaWNoIGlzIHdoAAAACHRyYW5zZmVyAAAAAwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAAUAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAPBSZXR1cm5zIHRoZSBhbW91bnQgb2YgdG9rZW5zIGEgYHNwZW5kZXJgIGlzIGFsbG93ZWQgdG8gc3BlbmQgb24gYmVoYWxmCm9mIGFuIGBvd25lcmAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgb3duZXJgIC0gVGhlIGFkZHJlc3MgaG9sZGluZyB0aGUgdG9rZW5zLgoqIGBzcGVuZGVyYCAtIFRoZSBhZGRyZXNzIGF1dGhvcml6ZWQgdG8gc3BlbmQgdGhlIHRva2Vucy4AAAAJYWxsb3dhbmNlAAAAAAAAAgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdzcGVuZGVyAAAAABMAAAABAAAACw==",
        "AAAAAAAAAE9SZXR1cm5zIHRoZSBhZG1pbiBhY2NvdW50LgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAlnZXRfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAJhSZXR1cm5zIHRoZSBmcmVlemluZyBzdGF0dXMgb2YgYSB3YWxsZXQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHVzZXJfYWRkcmVzc2AgLSBUaGUgYWRkcmVzcyBvZiB0aGUgd2FsbGV0IHRvIGNoZWNrLgAAAAlpc19mcm96ZW4AAAAAAAABAAAAAAAAAAx1c2VyX2FkZHJlc3MAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAKYmF0Y2hfYnVybgAAAAAAAwAAAAAAAAAOdXNlcl9hZGRyZXNzZXMAAAAAA+oAAAATAAAAAAAAAAdhbW91bnRzAAAAA+oAAAALAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAA",
        "AAAAAAAAAAAAAAAKYmF0Y2hfbWludAAAAAAAAwAAAAAAAAAHdG9fbGlzdAAAAAPqAAAAEwAAAAAAAAAHYW1vdW50cwAAAAPqAAAACwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAA==",
        "AAAAAAAAAItSZXR1cm5zIHRoZSBDb21wbGlhbmNlIGNvbnRyYWN0IGxpbmtlZCB0byB0aGUgdG9rZW4uCgojIEVycm9ycwoKKiBbYFJXQUVycm9yOjpDb21wbGlhbmNlTm90U2V0YF0gLSBXaGVuIHRoZSBjb21wbGlhbmNlIGNvbnRyYWN0IGlzIG5vdApzZXQuAAAAAApjb21wbGlhbmNlAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAj5HcmFudHMgYSByb2xlIHRvIGFuIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBncmFudCB0aGUgcm9sZSB0by4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBncmFudC4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFkbWluIG9yIGhhdmUgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGNhbGxlciBkb2VzIG5vdCBoYXZlCmVub3VnaCBwcml2aWxlZ2VzLgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpNYXhSb2xlc0V4Y2VlZGVkYF0gLSBJZiBhZGRpbmcgYSBuZXcgcm9sZSB3b3VsZApleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCBudW1iZXIgb2Ygcm9sZXMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2dyYW50ZWQiLCByb2xlOiBTeW1ib2wsIGFjY291bnQ6IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2NhbGxlcjogQWRkcmVzc11gAAAAAAAKZ3JhbnRfcm9sZQAAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAIBSZXR1cm5zIHRoZSBhZGRyZXNzIG9mIHRoZSBvbmNoYWluIElEIG9mIHRoZSB0b2tlbi4KCiMgRXJyb3JzCgoqIFtgUldBRXJyb3I6Ok9uY2hhaW5JZE5vdFNldGBdIC0gV2hlbiB0aGUgb25jaGFpbiBJRCBpcyBub3Qgc2V0LgAAAApvbmNoYWluX2lkAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAArdSZXZva2VzIGEgcm9sZSBmcm9tIGFuIGFjY291bnQuClRvIHJldm9rZSB0aGUgY2FsbGVyJ3Mgb3duIHJvbGUsIHVzZQpbYEFjY2Vzc0NvbnRyb2w6OnJlbm91bmNlX3JvbGUoKWBdIGluc3RlYWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byByZXZva2UgdGhlIHJvbGUgZnJvbS4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZXZva2UuCiogYGNhbGxlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgY2FsbGVyLCBtdXN0IGJlIHRoZSBhZG1pbiBvciBoYXMgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGBjYWxsZXJgIGRvZXMgbm90IGhhdmUKZW5vdWdoIHByaXZpbGVnZXMuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVOb3RIZWxkYF0gLSBJZiB0aGUgYGFjY291bnRgIGRvZXNuJ3QgaGF2ZQp0aGUgcm9sZS4KKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZUlzRW1wdHlgXSAtIElmIHRoZSByb2xlIGhhcyBubyBtZW1iZXJzLgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsicm9sZV9yZXZva2VkIiwgcm9sZTogU3ltYm9sLCBhY2NvdW50OiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtjYWxsZXI6IEFkZHJlc3NdYAAAAAALcmV2b2tlX3JvbGUAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAGtSZXR1cm5zIHRoZSB0b3RhbCBhbW91bnQgb2YgdG9rZW5zIGluIGNpcmN1bGF0aW9uLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgAAAAAMdG90YWxfc3VwcGx5AAAAAAAAAAEAAAAL",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAYAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAZzeW1ib2wAAAAAABAAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAHbWFuYWdlcgAAAAATAAAAAAAAAApjb21wbGlhbmNlAAAAAAATAAAAAAAAABFpZGVudGl0eV92ZXJpZmllcgAAAAAAABMAAAAA",
        "AAAAAAAAAhZBbGxvd3MgYW4gYWNjb3VudCB0byByZW5vdW5jZSBhIHJvbGUgYXNzaWduZWQgdG8gaXRzZWxmLgpVc2VycyBjYW4gb25seSByZW5vdW5jZSByb2xlcyBmb3IgdGhlaXIgb3duIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZW5vdW5jZS4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFjY291bnQgdGhhdCBoYXMgdGhlCnJvbGUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZU5vdEhlbGRgXSAtIElmIHRoZSBgY2FsbGVyYCBkb2Vzbid0IGhhdmUgdGhlCnJvbGUuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVJc0VtcHR5YF0gLSBJZiB0aGUgcm9sZSBoYXMgbm8gbWVtYmVycy4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInJvbGVfcmV2b2tlZCIsIHJvbGU6IFN5bWJvbCwgYWNjb3VudDogQWRkcmVzc11gCiogZGF0YSAtIGBbY2FsbGVyOiBBZGRyZXNzXWAAAAAAAA1yZW5vdW5jZV9yb2xlAAAAAAAAAgAAAAAAAAAEcm9sZQAAABEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAA2dUcmFuc2ZlcnMgYGFtb3VudGAgb2YgdG9rZW5zIGZyb20gYGZyb21gIHRvIGB0b2AgdXNpbmcgdGhlCmFsbG93YW5jZSBtZWNoYW5pc20uIGBhbW91bnRgIGlzIHRoZW4gZGVkdWN0ZWQgZnJvbSBgc3BlbmRlcmAKYWxsb3dhbmNlLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHNwZW5kZXJgIC0gVGhlIGFkZHJlc3MgYXV0aG9yaXppbmcgdGhlIHRyYW5zZmVyLCBhbmQgaGF2aW5nIGl0cwphbGxvd2FuY2UgY29uc3VtZWQgZHVyaW5nIHRoZSB0cmFuc2Zlci4KKiBgZnJvbWAgLSBUaGUgYWRkcmVzcyBob2xkaW5nIHRoZSB0b2tlbnMgd2hpY2ggd2lsbCBiZSB0cmFuc2ZlcnJlZC4KKiBgdG9gIC0gVGhlIGFkZHJlc3MgcmVjZWl2aW5nIHRoZSB0cmFuc2ZlcnJlZCB0b2tlbnMuCiogYGFtb3VudGAgLSBUaGUgYW1vdW50IG9mIHRva2VucyB0byBiZSB0cmFuc2ZlcnJlZC4KCiMgRXJyb3JzCgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpJbnN1ZmZpY2llbnRCYWxhbmNlYF0gLSBXaGVuIGF0dGVtcHRpbmcgdG8KdHJhbnNmZXIgbW9yZSB0b2tlbnMgdGhhbiBgZnJvbWAgY3VycmVudCBiYWxhbmNlLgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpMZXNzVGhhblplcm9gXSAtIFdoZW4gYGFtb3VudCA8IDBgLgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpJbnN1ZmZpY2llbnRBbGxvd2FuY2VgXSAtIFdoZW4gYXR0ZW1wdGluZyB0bwp0cmFuc2ZlciBtb3JlIHRva2VucyB0aGFuIGBzcGVuZGVyYCBjdXJyZW50IGFsbG93YW5jZS4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInRyYW5zZmVyIiwgZnJvbTogQWRkcmVzcywgdG86IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2Ftb3VudDogaTEyOF1gAAAAAA10cmFuc2Zlcl9mcm9tAAAAAAAABAAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAA4hUcmFuc2ZlcnMgdG9rZW5zIHRvIHNldmVyYWwgcmVjaXBpZW50cyBpbiBhIHNpbmdsZSBjYWxsLCBtb3ZpbmcKYGFtb3VudHNbaV1gIHRvIGByZWNpcGllbnRzW2ldYC4gVGhlIGJhdGNoZWQgZm9ybSBvZgpbYEZ1bmdpYmxlVG9rZW46OnRyYW5zZmVyYF0sIGF1dGhvcml6ZWQgb25jZSBieSBgZnJvbWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYGZyb21gIC0gVGhlIGFkZHJlc3Mgb2YgdGhlIHNlbmRlci4KKiBgcmVjaXBpZW50c2AgLSBUaGUgYWRkcmVzc2VzIG9mIHRoZSByZWNlaXZlcnMuCiogYGFtb3VudHNgIC0gVGhlIG51bWJlciBvZiB0b2tlbnMgdG8gdHJhbnNmZXIgdG8gZWFjaCByZWNpcGllbnQuCgojIEVycm9ycwoKKiByZWZlciB0byBbYFJXQTo6YmF0Y2hfdHJhbnNmZXJgXSBlcnJvcnMuCgojIEV2ZW50cwoKRm9yIGVhY2ggcmVjaXBpZW50OgoqIHRvcGljcyAtIGBbInRyYW5zZmVyIiwgZnJvbTogQWRkcmVzcywgdG86IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2Ftb3VudDogaTEyOF1gCgojIE5vdGVzCgpUaGUgc2VuZGVyJ3MgaWRlbnRpdHkgaXMgdmVyaWZpZWQgb25jZSBmb3IgdGhlIHdob2xlIGJhdGNoIGluc3RlYWQgb2YKb25jZSBwZXIgcmVjaXBpZW50LCB3aGljaCBpcyB3aGVyZSB0aGUgc2F2aW5nIG92ZXIgcmVwZWF0ZWQgc2luZ2xlCnRyYW5zZmVycyBjb21lcyBmcm9tLiBSZWZlciB0byBbYFJXQTo6YmF0Y2hfdHJhbnNmZXJgXSBmb3IgdGhlIG1lY2hhbmljcwphbmQgdGhlIGFzc3VtcHRpb24gdGhhdCByZXN0cyBvbiwgYW5kIHRvIHRoZSBiYXRjaCBvcGVyYXRpb25zIHNlY3Rpb24gb2YKdGhlIFttb2R1bGUgZG9jdW1lbnRhdGlvbl0oY3JhdGU6OnJ3YSkgZm9yIGhvdyB0byBzaXplIGEgYmF0Y2guAAAADmJhdGNoX3RyYW5zZmVyAAAAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAKcmVjaXBpZW50cwAAAAAD6gAAABMAAAAAAAAAB2Ftb3VudHMAAAAD6gAAAAsAAAAA",
        "AAAAAAAAAMVSZXR1cm5zIHRoZSBhZG1pbiByb2xlIGZvciBhIHNwZWNpZmljIHJvbGUuCklmIG5vIGFkbWluIHJvbGUgaXMgZXhwbGljaXRseSBzZXQsIHJldHVybnMgYE5vbmVgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHJvbGVgIC0gVGhlIHJvbGUgdG8gcXVlcnkgdGhlIGFkbWluIHJvbGUgZm9yLgAAAAAAAA5nZXRfcm9sZV9hZG1pbgAAAAAAAQAAAAAAAAAEcm9sZQAAABEAAAABAAAD6AAAABE=",
        "AAAAAAAAAfZBbGxvd3MgdGhlIGN1cnJlbnQgYWRtaW4gdG8gcmVub3VuY2UgdGhlaXIgcm9sZSwgbWFraW5nIHRoZSBjb250cmFjdApwZXJtYW5lbnRseSBhZG1pbi1sZXNzLiBUaGlzIGlzIHVzZWZ1bCBmb3IgZGVjZW50cmFsaXphdGlvbiBwdXJwb3NlcwpvciB3aGVuIHRoZSBhZG1pbiByb2xlIGlzIG5vIGxvbmdlciBuZWVkZWQuIE9uY2UgdGhlIGFkbWluIGlzCnJlbm91bmNlZCwgaXQgY2Fubm90IGJlIHJlaW5zdGF0ZWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgRXJyb3JzCgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgbm8gYWRtaW4gYWNjb3VudCBpcyBzZXQuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhZG1pbl9yZW5vdW5jZWQiLCBhZG1pbjogQWRkcmVzc11gCiogZGF0YSAtIGBbXWAKCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAOcmVub3VuY2VfYWRtaW4AAAAAAAAAAAAA",
        "AAAAAAAAAAAAAAAOc2V0X2NvbXBsaWFuY2UAAAAAAAIAAAAAAAAACmNvbXBsaWFuY2UAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAytQb2ludCB0aGUgdG9rZW4gYXQgdGhlIGlzc3VlcidzIG9uLWNoYWluIGlkZW50aXR5LgoKQWRkZWQgYnkgTmVrbzsgdGhlIHJlc3Qgb2YgdGhpcyBmaWxlIGlzIE9wZW5aZXBwZWxpbidzIFJXQSBleGFtcGxlCnZlcmJhdGltLiBTRVAtNTcgbGlzdHMgYG9uY2hhaW5faWRgIGFzIHRva2VuIG1ldGFkYXRhLCBidXQgdGhlIGV4YW1wbGUKZXhwb3NlcyBvbmx5IHRoZSBnZXR0ZXIsIHNvIGBvbmNoYWluX2lkKClgIHBhbmljcyB3aXRoCmBPbmNoYWluSWROb3RTZXRgIG9uIGEgZnJlc2hseSBkZXBsb3llZCB0b2tlbiBhbmQgbm90aGluZyBjYW4gZXZlciBzZXQKaXQuIFRoZSBsaWJyYXJ5IGhhcyB0aGUgc2V0dGVyOyB0aGlzIHB1Ymxpc2hlcyBpdCBiZWhpbmQgdGhlIHNhbWUKYG1hbmFnZXJgIHJvbGUgYXMgdGhlIHRva2VuJ3Mgb3RoZXIgcHJpdmlsZWdlZCBjYWxscy4KCkl0IGlzIGEgc2V0dGVyIHJhdGhlciB0aGFuIGEgY29uc3RydWN0b3IgYXJndW1lbnQgYmVjYXVzZSB0aGUgaXNzdWVyJ3MKaWRlbnRpdHkgY29udHJhY3QgZG9lcyBub3QgbmVjZXNzYXJpbHkgZXhpc3Qgd2hlbiB0aGUgdG9rZW4gaXMKZGVwbG95ZWQsIGFuZCBiZWNhdXNlIHRoZSBmYWN0b3J5J3MgYGNyZWF0ZV92YXVsdGAgd291bGQgb3RoZXJ3aXNlIG5lZWQKdG8ga25vdyBhYm91dCBpdC4KCmB2ZXJzaW9uKClgIGhhcyB0aGUgc2FtZSBnYXAgYW5kIG5vIGZpeDogYHN0ZWxsYXItdG9rZW5zYCB2MC44LjAgc2hpcHMKbm8gYHNldF92ZXJzaW9uYCBhdCBhbGwsIHNvIHRoYXQgb25lIHN0YXlzIGJyb2tlbiB1bnRpbCBPcGVuWmVwcGVsaW4KYWRkcyBvbmUuAAAAAA5zZXRfb25jaGFpbl9pZAAAAAAAAgAAAAAAAAAKb25jaGFpbl9pZAAAAAAAEwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAA==",
        "AAAAAAAAAb1TZXRzIGBhZG1pbl9yb2xlYCBhcyB0aGUgYWRtaW4gcm9sZSBvZiBgcm9sZWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBzZXQgdGhlIGFkbWluIGZvci4KKiBgYWRtaW5fcm9sZWAgLSBUaGUgbmV3IGFkbWluIHJvbGUuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2FkbWluX2NoYW5nZWQiLCByb2xlOiBTeW1ib2xdYAoqIGRhdGEgLSBgW3ByZXZpb3VzX2FkbWluX3JvbGU6IFN5bWJvbCwgbmV3X2FkbWluX3JvbGU6IFN5bWJvbF1gCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6QWRtaW5Ob3RTZXRgXSAtIElmIGFkbWluIGFjY291bnQgaXMgbm90IHNldC4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAADnNldF9yb2xlX2FkbWluAAAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAKYWRtaW5fcm9sZQAAAAAAEQAAAAA=",
        "AAAAAAAAAAAAAAAPZm9yY2VkX3RyYW5zZmVyAAAAAAQAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAA",
        "AAAAAAAAAllSZXR1cm5zIHRoZSBhY2NvdW50IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggZm9yIGEgZ2l2ZW4gcm9sZS4KCkEgZnVuY3Rpb24gdG8gZ2V0IGFsbCBtZW1iZXJzIG9mIGEgcm9sZSBpcyBub3QgcHJvdmlkZWQgYmVjYXVzZSB0aGF0CndvdWxkIGJlIHVuYm91bmRlZC4gVG8gZW51bWVyYXRlIGFsbCBtZW1iZXJzIG9mIGEgcm9sZSwgdXNlCltgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyX2NvdW50KClgXSB0byBnZXQgdGhlIHRvdGFsIG51bWJlciBvZgptZW1iZXJzIGFuZCB0aGVuIHVzZSBbYEFjY2Vzc0NvbnRyb2w6OmdldF9yb2xlX21lbWJlcigpYF0gdG8gcmV0cmlldmUKZWFjaCBtZW1iZXIgb25lIGJ5IG9uZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIHF1ZXJ5LgoqIGBpbmRleGAgLSBUaGUgaW5kZXggb2YgdGhlIGFjY291bnQgdG8gcmV0cmlldmUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6SW5kZXhPdXRPZkJvdW5kc2BdIC0gSWYgdGhlIGluZGV4IGlzIG91dCBvZgpib3VuZHMgZm9yIHRoZSByb2xlJ3MgbWVtYmVyIGxpc3QuAAAAAAAAD2dldF9yb2xlX21lbWJlcgAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAPcmVjb3Zlcl9iYWxhbmNlAAAAAAMAAAAAAAAAC29sZF9hY2NvdW50AAAAABMAAAAAAAAAC25ld19hY2NvdW50AAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAB",
        "AAAAAAAAALNSZXR1cm5zIHRoZSBhbW91bnQgb2YgdG9rZW5zIHRoYXQgYXJlIHBhcnRpYWxseSBmcm96ZW4gb24gYSB3YWxsZXQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHVzZXJfYWRkcmVzc2AgLSBUaGUgYWRkcmVzcyBvZiB0aGUgd2FsbGV0IHRvIGNoZWNrLgAAAAARZ2V0X2Zyb3plbl90b2tlbnMAAAAAAAABAAAAAAAAAAx1c2VyX2FkZHJlc3MAAAATAAAAAQAAAAs=",
        "AAAAAAAAAJ9SZXR1cm5zIHRoZSBJZGVudGl0eSBWZXJpZmllciBjb250cmFjdCBsaW5rZWQgdG8gdGhlIHRva2VuLgoKIyBFcnJvcnMKCiogW2BSV0FFcnJvcjo6SWRlbnRpdHlWZXJpZmllck5vdFNldGBdIC0gV2hlbiB0aGUgaWRlbnRpdHkgdmVyaWZpZXIKY29udHJhY3QgaXMgbm90IHNldC4AAAAAEWlkZW50aXR5X3ZlcmlmaWVyAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAARxSZXR1cm5zIGEgdmVjdG9yIGNvbnRhaW5pbmcgYWxsIGV4aXN0aW5nIHJvbGVzLgpEZWZhdWx0cyB0byBlbXB0eSB2ZWN0b3IgaWYgbm8gcm9sZXMgZXhpc3QuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgTm90ZXMKClRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbGwgcm9sZXMgdGhhdCBjdXJyZW50bHkgaGF2ZSBhdCBsZWFzdCBvbmUgbWVtYmVyLgpUaGUgbWF4aW11bSBudW1iZXIgb2Ygcm9sZXMgaXMgbGltaXRlZCBieSBbYE1BWF9ST0xFU2BdLgAAABJnZXRfZXhpc3Rpbmdfcm9sZXMAAAAAAAAAAAABAAAD6gAAABE=",
        "AAAAAAAAAAAAAAASc2V0X2FkZHJlc3NfZnJvemVuAAAAAAADAAAAAAAAAAx1c2VyX2FkZHJlc3MAAAATAAAAAAAAAAZmcmVlemUAAAAAAAEAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAABABJbml0aWF0ZXMgdGhlIGFkbWluIHJvbGUgdHJhbnNmZXIuCkFkbWluIHByaXZpbGVnZXMgZm9yIHRoZSBjdXJyZW50IGFkbWluIGFyZSBub3QgcmV2b2tlZCB1bnRpbCB0aGUKcmVjaXBpZW50IGFjY2VwdHMgdGhlIHRyYW5zZmVyLgpPdmVycmlkZXMgdGhlIHByZXZpb3VzIHBlbmRpbmcgdHJhbnNmZXIgaWYgdGhlcmUgaXMgb25lLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYG5ld19hZG1pbmAgLSBUaGUgYWNjb3VudCB0byB0cmFuc2ZlciB0aGUgYWRtaW4gcHJpdmlsZWdlcyB0by4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIHBlbmRpbmcgdHJhbnNmZXIKZXhwaXJlcy4gSWYgYGxpdmVfdW50aWxfbGVkZ2VyYCBpcyBgMGAsIHRoZSBwZW5kaW5nIHRyYW5zZmVyIGlzCmNhbmNlbGxlZC4gYGxpdmVfdW50aWxfbGVkZ2VyYCBhcmd1bWVudCBpcyBpbXBsaWNpdGx5IGJvdW5kZWQgYnkgdGhlCm1heGltdW0gYWxsb3dlZCBUVEwgZXh0ZW5zaW9uIGZvciBhIHRlbXBvcmFyeSBzdG9yYWdlIGVudHJ5IGFuZApzcGVjaWZ5aW5nIGEgaGlnaGVyIHZhbHVlIHdpbGwgY2F1c2UgdGhlIGNvZGUgdG8gcGFuaWMuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRyeWluZyB0byBjYW5jZWwgYSB0cmFuc2ZlciB0aGF0IGRvZXNuJ3QgZXhpc3QuCiogW2BjcmF0ZTo6cm9sZV90cmFuc2Zlcjo6Um9sZVRyYW5zZmVyRXJyb3I6OkludmFsaWRMaXZlVW50aWxMZWRnZXJgXSAtCklmIHRoZSBzcGVjaWZpZWQgbGVkZ2VyIGlzIGluIHRoZSBwYXN0LgoqIFtgY3JhdGU6OnJvbGVfdHJhbnNmZXI6OlJvbGVUcmFuc2ZlckVycm9yOjpJbnZhbGlkUGVuZGluZ0FjY291bnRgXSAtCklmIHRoZSBzcGVjaWZpZWQgcGVuZGluZyBhY2NvdW50IGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgcHJvdmlkZWQgYG5ld2AKYWRkcmVzcy4KAAAAE3RyYW5zZmVyX2FkbWluX3JvbGUAAAAAAgAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAA==",
        "AAAAAAAAAYVDb21wbGV0ZXMgdGhlIDItc3RlcCBhZG1pbiB0cmFuc2Zlci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsiYWRtaW5fdHJhbnNmZXJfY29tcGxldGVkIiwgbmV3X2FkbWluOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtwcmV2aW91c19hZG1pbjogQWRkcmVzc11gCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRoZXJlIGlzIG5vIHBlbmRpbmcgdHJhbnNmZXIgdG8gYWNjZXB0LgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgYWRtaW4gYWNjb3VudCBpcyBub3Qgc2V0LgAAAAAAABVhY2NlcHRfYWRtaW5fdHJhbnNmZXIAAAAAAAAAAAAAAA==",
        "AAAAAAAAAAAAAAAVYmF0Y2hfZm9yY2VkX3RyYW5zZmVyAAAAAAAABAAAAAAAAAAJZnJvbV9saXN0AAAAAAAD6gAAABMAAAAAAAAAB3RvX2xpc3QAAAAD6gAAABMAAAAAAAAAB2Ftb3VudHMAAAAD6gAAAAsAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAVZnJlZXplX3BhcnRpYWxfdG9rZW5zAAAAAAAAAwAAAAAAAAAMdXNlcl9hZGRyZXNzAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAA",
        "AAAAAAAAAMhSZXR1cm5zIHRoZSB0b3RhbCBudW1iZXIgb2YgYWNjb3VudHMgdGhhdCBoYXZlIHRoZSBzcGVjaWZpZWQgcm9sZS4KSWYgdGhlIHJvbGUgZG9lcyBub3QgZXhpc3QsIHJldHVybnMgMC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIGdldCB0aGUgY291bnQgZm9yLgAAABVnZXRfcm9sZV9tZW1iZXJfY291bnQAAAAAAAABAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAE",
        "AAAAAAAAAAAAAAAVc2V0X2lkZW50aXR5X3ZlcmlmaWVyAAAAAAAAAgAAAAAAAAARaWRlbnRpdHlfdmVyaWZpZXIAAAAAAAATAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAA",
        "AAAAAAAAAAAAAAAXdW5mcmVlemVfcGFydGlhbF90b2tlbnMAAAAAAwAAAAAAAAAMdXNlcl9hZGRyZXNzAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAA",
        "AAAAAAAAAAAAAAAYYmF0Y2hfc2V0X2FkZHJlc3NfZnJvemVuAAAAAwAAAAAAAAAOdXNlcl9hZGRyZXNzZXMAAAAAA+oAAAATAAAAAAAAAAtmcmVlemVfbGlzdAAAAAPqAAAAAQAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAbYmF0Y2hfZnJlZXplX3BhcnRpYWxfdG9rZW5zAAAAAAMAAAAAAAAADnVzZXJfYWRkcmVzc2VzAAAAAAPqAAAAEwAAAAAAAAAHYW1vdW50cwAAAAPqAAAACwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAdYmF0Y2hfdW5mcmVlemVfcGFydGlhbF90b2tlbnMAAAAAAAADAAAAAAAAAA51c2VyX2FkZHJlc3NlcwAAAAAD6gAAABMAAAAAAAAAB2Ftb3VudHMAAAAD6gAAAAsAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAABAAAAAAAAAAAAAAAEVJvbGVUcmFuc2ZlckVycm9yAAAAAAAABAAAAAAAAAARTm9QZW5kaW5nVHJhbnNmZXIAAAAAAAiYAAAAAAAAABZJbnZhbGlkTGl2ZVVudGlsTGVkZ2VyAAAAAAiZAAAAAAAAABVJbnZhbGlkUGVuZGluZ0FjY291bnQAAAAAAAiaAAAAAAAAAA9UcmFuc2ZlckV4cGlyZWQAAAAImw==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGlzIGdyYW50ZWQuAAAAAAAAAAAAAAtSb2xlR3JhbnRlZAAAAAABAAAADHJvbGVfZ3JhbnRlZAAAAAMAAAAAAAAABHJvbGUAAAARAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGlzIHJldm9rZWQuAAAAAAAAAAAAAAtSb2xlUmV2b2tlZAAAAAABAAAADHJvbGVfcmV2b2tlZAAAAAMAAAAAAAAABHJvbGUAAAARAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAC9FdmVudCBlbWl0dGVkIHdoZW4gdGhlIGFkbWluIHJvbGUgaXMgcmVub3VuY2VkLgAAAAAAAAAADkFkbWluUmVub3VuY2VkAAAAAAABAAAAD2FkbWluX3Jlbm91bmNlZAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAg==",
        "AAAABQAAACtFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGFkbWluIGlzIGNoYW5nZWQuAAAAAAAAAAAQUm9sZUFkbWluQ2hhbmdlZAAAAAEAAAAScm9sZV9hZG1pbl9jaGFuZ2VkAAAAAAADAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAAAAAAE3ByZXZpb3VzX2FkbWluX3JvbGUAAAAAEQAAAAAAAAAAAAAADm5ld19hZG1pbl9yb2xlAAAAAAARAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAAEkFjY2Vzc0NvbnRyb2xFcnJvcgAAAAAACwAAAAAAAAAMVW5hdXRob3JpemVkAAAH0AAAAAAAAAALQWRtaW5Ob3RTZXQAAAAH0QAAAAAAAAAQSW5kZXhPdXRPZkJvdW5kcwAAB9IAAAAAAAAAEUFkbWluUm9sZU5vdEZvdW5kAAAAAAAH0wAAAAAAAAASUm9sZUNvdW50SXNOb3RaZXJvAAAAAAfUAAAAAAAAAAxSb2xlTm90Rm91bmQAAAfVAAAAAAAAAA9BZG1pbkFscmVhZHlTZXQAAAAH1gAAAAAAAAALUm9sZU5vdEhlbGQAAAAH1wAAAAAAAAALUm9sZUlzRW1wdHkAAAAH2AAAAAAAAAASVHJhbnNmZXJJblByb2dyZXNzAAAAAAfZAAAAAAAAABBNYXhSb2xlc0V4Y2VlZGVkAAAH2g==",
        "AAAABQAAADJFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWRtaW4gdHJhbnNmZXIgaXMgY29tcGxldGVkLgAAAAAAAAAAABZBZG1pblRyYW5zZmVyQ29tcGxldGVkAAAAAAABAAAAGGFkbWluX3RyYW5zZmVyX2NvbXBsZXRlZAAAAAIAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAABAAAAAAAAAA5wcmV2aW91c19hZG1pbgAAAAAAEwAAAAAAAAAC",
        "AAAABQAAADJFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWRtaW4gdHJhbnNmZXIgaXMgaW5pdGlhdGVkLgAAAAAAAAAAABZBZG1pblRyYW5zZmVySW5pdGlhdGVkAAAAAAABAAAAGGFkbWluX3RyYW5zZmVyX2luaXRpYXRlZAAAAAMAAAAAAAAADWN1cnJlbnRfYWRtaW4AAAAAAAATAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAAAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAAAAAAC",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAAAAAAAAAAGUGF1c2VkAAAAAAABAAAABnBhdXNlZAAAAAAAAAAAAAI=",
        "AAAABQAAACxFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHVucGF1c2VkLgAAAAAAAAAIVW5wYXVzZWQAAAABAAAACHVucGF1c2VkAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAADVBhdXNhYmxlRXJyb3IAAAAAAAACAAAANFRoZSBvcGVyYXRpb24gZmFpbGVkIGJlY2F1c2UgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAANRW5mb3JjZWRQYXVzZQAAAAAAA+gAAAA4VGhlIG9wZXJhdGlvbiBmYWlsZWQgYmVjYXVzZSB0aGUgY29udHJhY3QgaXMgbm90IHBhdXNlZC4AAAANRXhwZWN0ZWRQYXVzZQAAAAAAA+k=",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSBidXJuZWQuAAAAAAAAAAAAAARCdXJuAAAAAQAAAARidXJuAAAAAgAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSBtaW50ZWQuAAAAAAAAAAAAAARNaW50AAAAAQAAAARtaW50AAAAAgAAAAAAAAACdG8AAAAAABMAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==",
        "AAAABAAAAAAAAAAAAAAACFJXQUVycm9yAAAADQAAAEVJbmRpY2F0ZXMgYW4gZXJyb3IgcmVsYXRlZCB0byBpbnN1ZmZpY2llbnQgYmFsYW5jZSBmb3IgdGhlIG9wZXJhdGlvbi4AAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAAEsAAAALkluZGljYXRlcyBhbiBlcnJvciB3aGVuIGFuIGlucHV0IG11c3QgYmUgPj0gMC4AAAAAAAxMZXNzVGhhblplcm8AAAEtAAAAPkluZGljYXRlcyB0aGUgYWRkcmVzcyBpcyBmcm96ZW4gYW5kIGNhbm5vdCBwZXJmb3JtIG9wZXJhdGlvbnMuAAAAAAANQWRkcmVzc0Zyb3plbgAAAAAAAS4AAAA9SW5kaWNhdGVzIGluc3VmZmljaWVudCBmcmVlIHRva2VucyAoZHVlIHRvIHBhcnRpYWwgZnJlZXppbmcpLgAAAAAAABZJbnN1ZmZpY2llbnRGcmVlVG9rZW5zAAAAAAEvAAAAKUluZGljYXRlcyBhbiBpZGVudGl0eSBjYW5ub3QgYmUgdmVyaWZpZWQuAAAAAAAAGklkZW50aXR5VmVyaWZpY2F0aW9uRmFpbGVkAAAAAAEwAAAALUluZGljYXRlcyB0aGUgY29tcGxpYW5jZSBjb250cmFjdCBpcyBub3Qgc2V0LgAAAAAAABBDb21wbGlhbmNlTm90U2V0AAABMwAAACRJbmRpY2F0ZXMgdGhlIG9uY2hhaW4gSUQgaXMgbm90IHNldC4AAAAPT25jaGFpbklkTm90U2V0AAAAATQAAAAhSW5kaWNhdGVzIHRoZSB2ZXJzaW9uIGlzIG5vdCBzZXQuAAAAAAAADVZlcnNpb25Ob3RTZXQAAAAAAAE1AAAAO0luZGljYXRlcyB0aGUgY2xhaW0gdG9waWNzIGFuZCBpc3N1ZXJzIGNvbnRyYWN0IGlzIG5vdCBzZXQuAAAAABtDbGFpbVRvcGljc0FuZElzc3VlcnNOb3RTZXQAAAABNgAAADxJbmRpY2F0ZXMgdGhlIGlkZW50aXR5IHJlZ2lzdHJ5IHN0b3JhZ2UgY29udHJhY3QgaXMgbm90IHNldC4AAAAdSWRlbnRpdHlSZWdpc3RyeVN0b3JhZ2VOb3RTZXQAAAAAAAE3AAAANEluZGljYXRlcyB0aGUgaWRlbnRpdHkgdmVyaWZpZXIgY29udHJhY3QgaXMgbm90IHNldC4AAAAWSWRlbnRpdHlWZXJpZmllck5vdFNldAAAAAABOAAAAERJbmRpY2F0ZXMgdGhlIG9sZCBhY2NvdW50IGFuZCBuZXcgYWNjb3VudCBoYXZlIGRpZmZlcmVudCBpZGVudGl0aWVzLgAAABBJZGVudGl0eU1pc21hdGNoAAABOQAAAEVJbmRpY2F0ZXMgdGhlIHBhcmFsbGVsIGFycmF5cyBvZiBhIGJhdGNoIGNhbGwgaGF2ZSBkaWZmZXJlbnQgbGVuZ3Rocy4AAAAAAAARQmF0Y2hTaXplTWlzbWF0Y2gAAAAAAAE6",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSBmcm96ZW4uAAAAAAAAAAAAAAxUb2tlbnNGcm96ZW4AAAABAAAADXRva2Vuc19mcm96ZW4AAAAAAAACAAAAAAAAAAx1c2VyX2FkZHJlc3MAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAADRFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWRkcmVzcyBpcyBmcm96ZW4gb3IgdW5mcm96ZW4uAAAAAAAAAA1BZGRyZXNzRnJvemVuAAAAAAAAAQAAAA5hZGRyZXNzX2Zyb3plbgAAAAAAAgAAAAAAAAAMdXNlcl9hZGRyZXNzAAAAEwAAAAEAAAAAAAAACWlzX2Zyb3plbgAAAAAAAAEAAAABAAAAAg==",
        "AAAABQAAAC5FdmVudCBlbWl0dGVkIHdoZW4gY29tcGxpYW5jZSBjb250cmFjdCBpcyBzZXQuAAAAAAAAAAAADUNvbXBsaWFuY2VTZXQAAAAAAAABAAAADmNvbXBsaWFuY2Vfc2V0AAAAAAABAAAAAAAAAApjb21wbGlhbmNlAAAAAAATAAAAAQAAAAI=",
        "AAAABQAAACdFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSB1bmZyb3plbi4AAAAAAAAAAA5Ub2tlbnNVbmZyb3plbgAAAAAAAQAAAA90b2tlbnNfdW5mcm96ZW4AAAAAAgAAAAAAAAAMdXNlcl9hZGRyZXNzAAAAEwAAAAEAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAACxFdmVudCBlbWl0dGVkIHdoZW4gYSByZWNvdmVyeSBpcyBzdWNjZXNzZnVsLgAAAAAAAAAPUmVjb3ZlcnlTdWNjZXNzAAAAAAEAAAAQcmVjb3Zlcnlfc3VjY2VzcwAAAAIAAAAAAAAAC29sZF9hY2NvdW50AAAAABMAAAABAAAAAAAAAAtuZXdfYWNjb3VudAAAAAATAAAAAQAAAAI=",
        "AAAABQAAADVFdmVudCBlbWl0dGVkIHdoZW4gaWRlbnRpdHkgdmVyaWZpZXIgY29udHJhY3QgaXMgc2V0LgAAAAAAAAAAAAATSWRlbnRpdHlWZXJpZmllclNldAAAAAABAAAAFWlkZW50aXR5X3ZlcmlmaWVyX3NldAAAAAAAAAEAAAAAAAAAEWlkZW50aXR5X3ZlcmlmaWVyAAAAAAAAEwAAAAEAAAAC",
        "AAAABQAAAC9FdmVudCBlbWl0dGVkIHdoZW4gdG9rZW4gb25jaGFpbiBJRCBpcyB1cGRhdGVkLgAAAAAAAAAAFVRva2VuT25jaGFpbklkVXBkYXRlZAAAAAAAAAEAAAAYdG9rZW5fb25jaGFpbl9pZF91cGRhdGVkAAAAAQAAAAAAAAAKb25jaGFpbl9pZAAAAAAAEwAAAAEAAAAC",
        "AAAABQAAACxFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWxsb3dhbmNlIGlzIGFwcHJvdmVkLgAAAAAAAAAHQXBwcm92ZQAAAAABAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAAAAAAI=",
        "AAAABQAAASFFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSB0cmFuc2ZlcnJlZCBiZXR3ZWVuIGFkZHJlc3NlcyB3aXRob3V0IGEKbXV4ZWQgZGVzdGluYXRpb24uCgpQZXIgU0VQLTQxLCB0aGUgZXZlbnQgZGF0YSBpcyBhIGJhcmUgYGkxMjhgIHdoZW4gbm8gbXV4ZWQgYWRkcmVzcyBpcwppbnZvbHZlZC4gVGhlIGBkYXRhX2Zvcm1hdCA9ICJzaW5nbGUtdmFsdWUiYCBhdHRyaWJ1dGUgZW5zdXJlcyB0aGUKYGFtb3VudGAgZmllbGQgaXMgc2VyaWFsaXplZCBhcyBhIGJhcmUgdmFsdWUgcmF0aGVyIHRoYW4gYSBtYXAuAAAAAAAAAAAAAAhUcmFuc2ZlcgAAAAEAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAA=",
        "AAAABQAAAZdFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSB0cmFuc2ZlcnJlZCB0byBhIG11eGVkIGFkZHJlc3MuCgpQZXIgU0VQLTQxLCB3aGVuIHRoZSBkZXN0aW5hdGlvbiBpcyBhIFtgTXV4ZWRBZGRyZXNzYF0gdGhlIGV2ZW50IGRhdGEKY2FycmllcyBib3RoIHRoZSBhbW91bnQgYW5kIHRoZSBtdXhlZCBpZGVudGlmaWVyIHNvIHRoYXQgb2ZmLWNoYWluCmNvbnN1bWVycyBjYW4gYXR0cmlidXRlIHRoZSB0cmFuc2ZlciB0byB0aGUgY29ycmVjdCBzdWItYWNjb3VudC4KClVzZXMgYHRvcGljcyA9IFsidHJhbnNmZXIiXWAgc28gdGhhdCBib3RoIFtgVHJhbnNmZXJgXSBhbmQKW2BNdXhlZFRyYW5zZmVyYF0gc2hhcmUgdGhlIHNhbWUgYCJ0cmFuc2ZlciJgIGV2ZW50IHN5bWJvbCwgYXMgcmVxdWlyZWQKYnkgU0VQLTQxLgAAAAAAAAAADU11eGVkVHJhbnNmZXIAAAAAAAABAAAACHRyYW5zZmVyAAAABAAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAAC3RvX211eGVkX2lkAAAAA+gAAAAGAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAAEkZ1bmdpYmxlVG9rZW5FcnJvcgAAAAAADwAAAG5JbmRpY2F0ZXMgYW4gZXJyb3IgcmVsYXRlZCB0byB0aGUgY3VycmVudCBiYWxhbmNlIG9mIGFjY291bnQgZnJvbSB3aGljaAp0b2tlbnMgYXJlIGV4cGVjdGVkIHRvIGJlIHRyYW5zZmVycmVkLgAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAAAZAAAAGRJbmRpY2F0ZXMgYSBmYWlsdXJlIHdpdGggdGhlIGFsbG93YW5jZSBtZWNoYW5pc20gd2hlbiBhIGdpdmVuIHNwZW5kZXIKZG9lc24ndCBoYXZlIGVub3VnaCBhbGxvd2FuY2UuAAAAFUluc3VmZmljaWVudEFsbG93YW5jZQAAAAAAAGUAAABNSW5kaWNhdGVzIGFuIGludmFsaWQgdmFsdWUgZm9yIGBsaXZlX3VudGlsX2xlZGdlcmAgd2hlbiBzZXR0aW5nIGFuCmFsbG93YW5jZS4AAAAAAAAWSW52YWxpZExpdmVVbnRpbExlZGdlcgAAAAAAZgAAADJJbmRpY2F0ZXMgYW4gZXJyb3Igd2hlbiBhbiBpbnB1dCB0aGF0IG11c3QgYmUgPj0gMAAAAAAADExlc3NUaGFuWmVybwAAAGcAAAA9SW5kaWNhdGVzIGFuIG92ZXJmbG93IG9yIHVuZGVyZmxvdyBpbiBhbiBhcml0aG1ldGljIG9wZXJhdGlvbgAAAAAAAAxNYXRoT3ZlcmZsb3cAAABoAAAAKkluZGljYXRlcyBhY2Nlc3MgdG8gdW5pbml0aWFsaXplZCBtZXRhZGF0YQAAAAAADVVuc2V0TWV0YWRhdGEAAAAAAABpAAAAUkluZGljYXRlcyB0aGF0IHRoZSBvcGVyYXRpb24gd291bGQgaGF2ZSBjYXVzZWQgYHRvdGFsX3N1cHBseWAgdG8gZXhjZWVkCnRoZSBgY2FwYC4AAAAAAAtFeGNlZWRlZENhcAAAAABqAAAANkluZGljYXRlcyB0aGUgc3VwcGxpZWQgYGNhcGAgaXMgbm90IGEgdmFsaWQgY2FwIHZhbHVlLgAAAAAACkludmFsaWRDYXAAAAAAAGsAAAAeSW5kaWNhdGVzIHRoZSBDYXAgd2FzIG5vdCBzZXQuAAAAAAAJQ2FwTm90U2V0AAAAAAAAbAAAACZJbmRpY2F0ZXMgdGhlIFNBQyBhZGRyZXNzIHdhcyBub3Qgc2V0LgAAAAAACVNBQ05vdFNldAAAAAAAAG0AAAAwSW5kaWNhdGVzIGEgU0FDIGFkZHJlc3MgZGlmZmVyZW50IHRoYW4gZXhwZWN0ZWQuAAAAElNBQ0FkZHJlc3NNaXNtYXRjaAAAAAAAbgAAAENJbmRpY2F0ZXMgYSBtaXNzaW5nIGZ1bmN0aW9uIHBhcmFtZXRlciBpbiB0aGUgU0FDIGNvbnRyYWN0IGNvbnRleHQuAAAAABFTQUNNaXNzaW5nRm5QYXJhbQAAAAAAAG8AAABESW5kaWNhdGVzIGFuIGludmFsaWQgZnVuY3Rpb24gcGFyYW1ldGVyIGluIHRoZSBTQUMgY29udHJhY3QgY29udGV4dC4AAAARU0FDSW52YWxpZEZuUGFyYW0AAAAAAABwAAAAMVRoZSB1c2VyIGlzIG5vdCBhbGxvd2VkIHRvIHBlcmZvcm0gdGhpcyBvcGVyYXRpb24AAAAAAAAOVXNlck5vdEFsbG93ZWQAAAAAAHEAAAA1VGhlIHVzZXIgaXMgYmxvY2tlZCBhbmQgY2Fubm90IHBlcmZvcm0gdGhpcyBvcGVyYXRpb24AAAAAAAALVXNlckJsb2NrZWQAAAAAcg==",
      ]),
      options
    );
  }
  public readonly fromJSON = {
    burn: this.txFromJSON<null>,
    mint: this.txFromJSON<null>,
    name: this.txFromJSON<string>,
    pause: this.txFromJSON<null>,
    paused: this.txFromJSON<boolean>,
    symbol: this.txFromJSON<string>,
    approve: this.txFromJSON<null>,
    balance: this.txFromJSON<i128>,
    unpause: this.txFromJSON<null>,
    version: this.txFromJSON<string>,
    decimals: this.txFromJSON<u32>,
    has_role: this.txFromJSON<Option<u32>>,
    transfer: this.txFromJSON<null>,
    allowance: this.txFromJSON<i128>,
    get_admin: this.txFromJSON<Option<string>>,
    is_frozen: this.txFromJSON<boolean>,
    batch_burn: this.txFromJSON<null>,
    batch_mint: this.txFromJSON<null>,
    compliance: this.txFromJSON<string>,
    grant_role: this.txFromJSON<null>,
    onchain_id: this.txFromJSON<string>,
    revoke_role: this.txFromJSON<null>,
    total_supply: this.txFromJSON<i128>,
    renounce_role: this.txFromJSON<null>,
    transfer_from: this.txFromJSON<null>,
    batch_transfer: this.txFromJSON<null>,
    get_role_admin: this.txFromJSON<Option<string>>,
    renounce_admin: this.txFromJSON<null>,
    set_compliance: this.txFromJSON<null>,
    set_onchain_id: this.txFromJSON<null>,
    set_role_admin: this.txFromJSON<null>,
    forced_transfer: this.txFromJSON<null>,
    get_role_member: this.txFromJSON<string>,
    recover_balance: this.txFromJSON<boolean>,
    get_frozen_tokens: this.txFromJSON<i128>,
    identity_verifier: this.txFromJSON<string>,
    get_existing_roles: this.txFromJSON<Array<string>>,
    set_address_frozen: this.txFromJSON<null>,
    transfer_admin_role: this.txFromJSON<null>,
    accept_admin_transfer: this.txFromJSON<null>,
    batch_forced_transfer: this.txFromJSON<null>,
    freeze_partial_tokens: this.txFromJSON<null>,
    get_role_member_count: this.txFromJSON<u32>,
    set_identity_verifier: this.txFromJSON<null>,
    unfreeze_partial_tokens: this.txFromJSON<null>,
    batch_set_address_frozen: this.txFromJSON<null>,
    batch_freeze_partial_tokens: this.txFromJSON<null>,
    batch_unfreeze_partial_tokens: this.txFromJSON<null>,
  };
}
