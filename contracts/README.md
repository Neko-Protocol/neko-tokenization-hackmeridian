# Contracts

These Soroban smart contracts implement a [SEP-57](https://github.com/stellar/stellar-protocol/blob/master/core/sep-0057.md) style regulated token stack: only accounts with verified identity claims can hold and transfer the RWA token.

## RWA suite (`rwa/`)

| Directory                   | Role                                                                   |
| --------------------------- | ---------------------------------------------------------------------- |
| `claim-topics-and-issuers/` | Registry of required claim topics (KYC, AML, etc.) and trusted issuers |
| `claim-issuer/`             | Validates Ed25519-signed identity claims                               |
| `identity/`                 | Per-user contract storing signed identity claims                       |
| `identity-registry/`        | Maps wallet addresses to identity contracts and country data           |
| `identity-verifier/`        | Orchestrates verification across the identity stack                    |
| `compliance/`               | Hook-based compliance framework with pluggable modules                 |
| `token/`                    | RWA security token with freezing, recovery, and compliance hooks       |

## Tools

| Path                | Role                                                         |
| ------------------- | ------------------------------------------------------------ |
| `tools/sign-claim/` | CLI that signs identity claims for test and deployment flows |

## Requirements

- Rust with the `wasm32v1-none` target (see `rust-toolchain.toml`)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) >= 25.2.0

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

See [rwa/DEPLOY.md](rwa/DEPLOY.md) for a step-by-step testnet deployment guide.

## Attribution

Adapted from OpenZeppelin [stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) v0.8.0 RWA examples (MIT). See [rwa/LICENSE-OPENZEPPELIN](rwa/LICENSE-OPENZEPPELIN).
