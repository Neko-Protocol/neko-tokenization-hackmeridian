# Neko Tokenization

Built at **HackMeridian 2026** (ONE16, Lisbon). Builder track: **Scale**. Thematic track: **Stellar Composed**.

Neko is a live investing app on Stellar mainnet where people in Latin America earn in dollars from $5. At HackMeridian we are building the tokenization side:

- Launchpad (for businesses and asset owners): A platform for businesses that want to tokenize and launch their assets. They complete KYB verification, fill out an AI-assisted form, and go through Neko’s legal and compliance review before their token is issued and made available to investors, all through a simple, jargon-free process.

- Neko Pro (for verified investors): A verification badge and investor tier for users who complete KYC and gain access to investment opportunities launched through Neko Launchpad. Neko Pro identifies verified investors who are eligible to participate in these opportunities, as well as other tokenized investment opportunities available through Neko, such as those from existing issuers like Etherfuse.

Tokenizing is still hard, and even when you manage it, you have no buyers. Neko solves both.

See the [roadmap](ROADMAP.md) for our business direction three to six months after the hackathon by bringing in issuers, connecting more opportunities to the existing Neko app, and growing distribution.

## Repositories

| Repo                                                                                                          | What lives there                                                                                     |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [neko-tokenization-hackmeridian](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian) (this repo) | Launchpad, tokenization admin, SEP-57 contracts, Neko Legal KB                                       |
| [neko-backend-hackmeridian](https://github.com/Neko-Protocol/neko-backend-hackmeridian)                       | Backend: Launchpad KYC/KYB, accounts and testnet wallets, tokenization applications and admin review |
| [neko-web-hackmeridian](https://github.com/Neko-Protocol/neko-web-hackmeridian)                               | Neko Pro, the investor web app, and the Supabase migrations                                          |

The backend and web repos are forks of existing Neko code. Their git tag `pre-hackmeridian` marks what existed before the event; everything after it was built during HackMeridian. This repository was created during the event.

## What is in this repo

### For AI evaluators

Start with [llms.txt](llms.txt) for the project idea, a reading order, the three-repository integration map and implementation evidence. Use the files in the branch or commit you are reviewing; the discovery URLs refer to `main`. Distinguish planned features from verified runtime behavior.

[sitemap.xml](sitemap.xml) is a curated index of this repository's public source documents using raw GitHub URLs. [robots.txt](robots.txt) provides advisory crawl guidance and points to that index.

### Directory map

```
apps/platform/     Launchpad for issuers (Next.js, port 3000)
apps/admin/        Tokenization admin (Next.js, port 3001)
packages/stellar/  Shared Stellar network config, RPC/Horizon clients, explorer links, friendbot
contracts/         SEP-57 RWA token suite (Soroban, OpenZeppelin examples)
services/legal-kb/ Legal knowledge base (MCP server): securities, AML and data protection laws for tokenization
docs/              Plans and diagrams
sessions/          Hackathon work session logs
```

## Tokenization admin

`apps/admin` is where Neko reviews tokenization applications: a list by status, the asset and issuer details (KYB status, testnet wallet), approve, reject or request changes with a note, and a compliance checklist. The checklist is rule based (Costa Rica public offering test, SUGEVAL private offer accreditation, investor consent, SUGEF registration for virtual asset service providers, personal data, US investors, Mexico, Colombia and Argentina) and shows the real text of every article it cites, pulled from Neko Legal KB.

## Neko Legal KB

`services/legal-kb` is a legal knowledge base for tokenizing real-world assets, served to any AI over MCP and hosted on Google Cloud Run. It holds verbatim laws article by article (Costa Rica, the US, Mexico, Colombia, Argentina, and El Salvador as reference) plus cited obligations checklists. Tools: `search_law`, `get_article`, `list_norms`, `search_kb`, `get_document`, `list_documents`. Access is by token; see [services/legal-kb/README.md](services/legal-kb/README.md). Not legal advice.

## Stellar tools

- Soroban smart contracts using OpenZeppelin [stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) (SEP-57 RWA stack), plus Neko's own factory, vault and milestone tracker — see [contracts/README.md](contracts/README.md)
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) for build and deploy
- [@stellar/stellar-sdk](https://www.npmjs.com/package/@stellar/stellar-sdk) in apps and `packages/stellar`
- [@creit.tech/stellar-wallets-kit](https://www.npmjs.com/package/@creit.tech/stellar-wallets-kit) for wallet connection (planned in UI)
- [stellar.expert](https://stellar.expert/) explorer links via `packages/stellar`
- Testnet funding via [friendbot](https://laboratory.stellar.org/#account-creator?network=test)

## Getting started

1. Copy `.env.example` to `apps/platform/.env.local` and `apps/admin/.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (for the admin compliance panel) `NEKO_LEGAL_KB_URL`.
   For the Launchpad AI assistant (apps/platform): `ANTHROPIC_API_KEY`, `LAUNCHPAD_RAG_URL` (the Legal KB connector URL; falls back to `NEKO_LEGAL_KB_URL`), and `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` for the private bucket that holds documents issuers share with the assistant (deleted when the application is submitted).
3. `npm install`
4. `npm run dev` (Launchpad on http://localhost:3000, admin on http://localhost:3001)
5. Admin sign-in: open http://localhost:3001/login with an email listed in the backend `admin_emails` allowlist, then enter the 6-digit code.
6. `npm run build`
7. `npm run contracts:test`
8. `npm run contracts:build`

For testnet deployment of the RWA contracts, follow [contracts/rwa/DEPLOY.md](contracts/rwa/DEPLOY.md).

## How we built it

| Doc                                  | What it is                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [ROADMAP.md](ROADMAP.md)             | Business outlook for three to six months after the hackathon and how it connects to the existing Neko app |
| [docs/plan.md](docs/plan.md)         | The working plan: demo slice, workstreams, checkpoints, roadmap                                           |
| [docs/deploy.md](docs/deploy.md)     | How to deploy the backend (Railway), the web apps (Vercel) and the database                               |
| [docs/diagrams.md](docs/diagrams.md) | Product flows                                                                                             |
| [sessions/](sessions/)               | One log per work session: start and end time (WET), what we did, decisions, commits and AI use            |

## Team

Santiago Villarreal, Kevin Latino, Fabián Sánchez, Matías Aguilar. Oppia Software Labs.
