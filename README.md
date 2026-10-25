# Neko Tokenization

Built at **HackMeridian 2026** (ONE16, Lisbon). Builder track: **Scale**. Thematic track: **Stellar Composed**.

Neko is a live investing app on Stellar mainnet where people in Latin America earn in dollars from $5. At HackMeridian we are building the tokenization side:

- Launchpad (for businesses and asset owners): A platform for businesses that want to tokenize and launch their assets. They complete KYB verification, fill out an AI-assisted form, and go through Neko’s legal and compliance review before their token is issued and made available to investors, all through a simple, jargon-free process.

- Neko Pro (for verified investors): A verification badge and investor tier for users who complete KYC and gain access to investment opportunities launched through Neko Launchpad. Neko Pro identifies verified investors who are eligible to participate in these opportunities, as well as other tokenized investment opportunities available through Neko, such as those from existing issuers like Etherfuse.

Tokenizing is still hard, and even when you manage it, you have no buyers. Neko solves both.

## Repositories

| Repo                                                                                                          | What lives there                             |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [neko-tokenization-hackmeridian](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian) (this repo) | Tokenization platform and tokenization admin |
| [neko-backend-hackmeridian](https://github.com/Neko-Protocol/neko-backend-hackmeridian)                       | Backend                                      |
| [neko-web-hackmeridian](https://github.com/Neko-Protocol/neko-web-hackmeridian)                               | Neko Pro, the investor web app               |

The backend and web repos are forks of existing Neko code. Their git tag `pre-hackmeridian` marks what existed before the event; everything after it was built during HackMeridian. This repository was created during the event.

## What is in this repo

```
apps/platform/     Launchpad for issuers (Next.js, port 3000)
apps/admin/        Tokenization admin (Next.js, port 3001)
packages/stellar/  Shared Stellar network config, RPC/Horizon clients, explorer links, friendbot
contracts/         SEP-57 RWA token suite (Soroban, OpenZeppelin examples)
docs/              Plans and diagrams
sessions/          Hackathon work session logs
```

## Stellar tools

- Soroban smart contracts using OpenZeppelin [stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) (SEP-57 RWA stack)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) for build and deploy
- [@stellar/stellar-sdk](https://www.npmjs.com/package/@stellar/stellar-sdk) in apps and `packages/stellar`
- [@creit.tech/stellar-wallets-kit](https://www.npmjs.com/package/@creit.tech/stellar-wallets-kit) for wallet connection (planned in UI)
- [Trustless Work](https://trustless.work/) milestone escrow (planned integration)
- [stellar.expert](https://stellar.expert/) explorer links via `packages/stellar`
- Testnet funding via [friendbot](https://laboratory.stellar.org/#account-creator?network=test)

## Getting started

1. Copy `.env.example` to `apps/platform/.env.local` and `apps/admin/.env.local`.
2. `npm install`
3. `npm run dev` (Launchpad on http://localhost:3000, admin on http://localhost:3001)
4. `npm run build`
5. `npm run contracts:test`
6. `npm run contracts:build`

For testnet deployment of the RWA contracts, follow [contracts/rwa/DEPLOY.md](contracts/rwa/DEPLOY.md).

## How we built it

| Doc                                  | What it is                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| [docs/plan.md](docs/plan.md)         | The working plan: demo slice, workstreams, checkpoints, roadmap                                |
| [docs/diagrams.md](docs/diagrams.md) | Product flows                                                                                  |
| [sessions/](sessions/)               | One log per work session: start and end time (WET), what we did, decisions, commits and AI use |

## Team

Santiago Villarreal, Kevin Latino, Fabián Sánchez, Matías Aguilar. Oppia Software Labs.
