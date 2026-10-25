# Contracts

The on-chain side of Neko: a [SEP-57](https://github.com/stellar/stellar-protocol/blob/master/core/sep-0057.md) regulated token stack, plus the three contracts that turn it into a product — a factory that launches vaults, a vault that holds the money, and a tracker that records how far along an issuer is.

## What a vault is

An issuer borrows against a real-world asset. Investors deposit USDC and receive vault tokens one for one; the raise goes to the borrower; the borrower repays in tranches; and once the full amount with interest is in, each investor redeems their share.

The vault never computes interest. `expected_repayment` is fixed when the vault is created as `target × (1 + rate)`, and a vault settles when the borrower has paid at least that much. Each investor's payout then falls out of their token balance over the supply frozen at settlement, which keeps amortisation and accrual out of the contract entirely.

## Neko contracts (`vault/`, `factory/`, `milestone-tracker/`)

| Directory            | Contract                   | Role                                                                                                                          |
| -------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `vault/`             | `VaultContract`            | The money: deposits, the release to the borrower, tranche repayments, early exit with a fee, and final redemption             |
| `factory/`           | `FactoryContract`          | Deploys a vault's token, compliance contract and the vault itself, wires them, and keeps the on-chain registry of every vault |
| `milestone-tracker/` | `MilestoneTrackerContract` | The issuer's progress: evidence submitted, Neko's review, append-only                                                         |

The vault holds USDC and never the token it issues — it only needs the `manager` role on that token to mint and burn, which keeps it out of the identity registry. The tracker answers "did they do the work?"; whether they _paid_ is the vault's business, so the two are kept apart.

## RWA suite (`rwa/`)

Adapted from OpenZeppelin [stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) v0.8.0 (MIT, see [rwa/LICENSE-OPENZEPPELIN](rwa/LICENSE-OPENZEPPELIN)).

| Directory                   | Role                                                             | Deployed     |
| --------------------------- | ---------------------------------------------------------------- | ------------ |
| `token/`                    | The SEP-57 security token: freezing, forced transfers, recovery  | per vault    |
| `compliance/`               | Hook dispatcher for pluggable compliance modules                 | per vault    |
| `identity-verifier/`        | Orchestrates verification across the identity stack              | once         |
| `identity-registry/`        | Maps wallet addresses to identity contracts and country data     | once         |
| `claim-topics-and-issuers/` | Which claim topics are required (KYC, AML) and who may sign them | once         |
| `claim-issuer/`             | Validates Ed25519-signed identity claims                         | once         |
| `identity/`                 | A single holder's signed claims                                  | per investor |

Only four of these are platform-wide, which is the point: an investor passes KYC once and can then take part in any vault.

## Tools

| Path                | Role                                                         |
| ------------------- | ------------------------------------------------------------ |
| `tools/sign-claim/` | CLI that signs identity claims for test and deployment flows |

## Requirements

- Rust with the `wasm32v1-none` target (see `rust-toolchain.toml`)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) >= 25.2.0
- `jq` and `openssl`, used by the deploy scripts

## Commands

From the repository root:

```bash
npm run contracts:test
npm run contracts:build
```

Or from `contracts/`:

```bash
cargo test
stellar contract build
```

## Deployment

```bash
./scripts/deploy-shared.sh              # the platform stack, once per network
./scripts/onboard-investor.sh alice     # give a wallet a verified identity
./scripts/onboard-investor.sh bob
./scripts/deploy-vault.sh casa-escazu    # launch one vault
./scripts/run-demo.sh casa-escazu       # walk the whole money path
```

Addresses land in `deployments/<network>.json`. `./scripts/print-env.sh` turns that file into the environment block the apps read.

[rwa/DEPLOY.md](rwa/DEPLOY.md) documents the same steps by hand, which is worth reading once to see what the scripts automate.

## Known limitations

- **`version()` always panics** with `VersionNotSet`. SEP-57 lists it as token metadata, but `stellar-tokens` v0.8.0 ships no `set_version` anywhere — the only write to that key is inside OpenZeppelin's own tests — so nothing outside the crate can set it. `onchain_id()` had the same gap and we fixed it: the library has `RWA::set_onchain_id`, the example just never exposed it, so the token now publishes a `manager`-gated setter. Call it once the issuer has an on-chain identity; until then that getter panics too.
- **No compliance modules are registered.** `rwa/compliance/` is only the dispatcher, and with no modules on its hooks it allows every operation. The legal corpus in [`services/legal-kb`](../services/legal-kb) identifies three that a real launch needs: a cap of 50 investors in a Costa Rican private offering (`ley-7732:art-6` inciso d), under 100 in Mexico (`mx-lmv:art-8`), and blocking US persons under Reg S. The vault caps the raise, so a vault cannot over-issue, but nothing enforces the holder count or the country rules yet.
- **OpenZeppelin publishes the v0.8.0 RWA module as unaudited** and not ready for production. Fine for testnet; not for mainnet without an audit.
- `identity-registry` hardcodes `IdentityType::Individual`, so an issuer that is a company cannot yet hold an on-chain identity of its own.
- The identity registry does not implement `AccessControl`, so the manager role it is deployed with can never be transferred. The factory is deliberately not made that manager; the deploy script binds tokens into the registry instead.

## Attribution

The RWA suite and `tools/sign-claim/` are adapted from OpenZeppelin [stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) v0.8.0 (MIT). See [rwa/LICENSE-OPENZEPPELIN](rwa/LICENSE-OPENZEPPELIN).

Only two of those files differ from upstream: `rwa/token/src/contract.rs` gains a `set_onchain_id` so that SEP-57's `onchain_id` metadata can actually be set, and `tools/sign-claim/` prints the public key so a deploy script can authorise its own signing key. Everything else is verbatim.
