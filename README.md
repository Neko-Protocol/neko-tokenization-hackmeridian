# Neko Tokenization

Built at **HackMeridian 2026** (ONE16, Lisbon). Builder track: **Scale**. Thematic track: **Stellar Composed**.

**Tokenizing is still hard, and even when you manage it, you have no buyers. Neko solves both.**

Neko is a live investing app on Stellar mainnet where people in Latin America earn in dollars from $5. That is the buyers side. At HackMeridian we built the issuer side and connected the two:

1. **Prepare.** A business passes KYB and fills a plain-language form with an AI assistant beside it. The assistant reads the issuer's documents, proposes values the issuer accepts or not, cites only articles it actually retrieved from Neko Legal KB (verbatim laws of six countries), and checks Neko's past review decisions through an anonymised view. If a source is unavailable, the issuer is told.
2. **Review.** Neko's team sees a rule-based compliance checklist with the real text of each cited article, comparable earlier cases with their decisions, and an AI summary clearly labelled as not verified.
3. **Launch.** One click deploys a SEP-57 regulated token, its compliance contract and a loan vault through Neko's factory on Stellar.
4. **Invest.** Verified investors get an on-chain identity once (the token refuses anyone else), invest USDC from Neko Pro, and are repaid in dated tranches. They can redeem, get a refund if the minimum raise fails, or exit early with a fee shown before they sign.

**For judges:** the [evidence pack](docs/evidence.md) has the innovations, the full vault lifecycle on testnet with every transaction hash, the intake goals against what we built, test results and stated limits. Everything from the hackathon runs on Stellar testnet.

- Launchpad (for businesses and asset owners): KYB, AI-assisted application, launch, vault follow-up and repayments, without seed phrases.
- Neko Pro (for verified investors): KYC, on-chain identity and access to opportunities launched through the Launchpad, alongside tokenized assets Neko already offers, such as Etherfuse.

See the [roadmap](ROADMAP.md) for our business direction three to six months after the hackathon by bringing in issuers, connecting more opportunities to the existing Neko app, and growing distribution.

## Live deployments

The project runs as three separate websites, one per audience. All three use Stellar testnet for the hackathon contracts and vaults.

- **Launchpad**: https://launch.tryneko.io
  - Who: businesses and asset owners who want to tokenize an asset.
  - What: KYB, AI-assisted application form, token launch, vault follow-up, milestone evidence and repayments.
  - Source: `apps/platform` in this repo.
- **Tokenization admin**: https://admin-tokenization.tryneko.io
  - Who: Neko's legal and compliance team (login required).
  - What: review applications, compliance checklist with cited legal articles, similar cases, approve and run vaults.
  - Source: `apps/admin` in this repo.
- **Neko Pro (investor app)**: https://hackmeridian.tryneko.io
  - Who: investors.
  - What: KYC verification badge, on-chain identity, and access to opportunities launched through the Launchpad.
  - Source: [neko-web-hackmeridian](https://github.com/Neko-Protocol/neko-web-hackmeridian).

## Repositories

| Repo                                                                                                          | What lives there                                                                                     |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [neko-tokenization-hackmeridian](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian) (this repo) | Launchpad, tokenization admin, SEP-57 contracts, Neko Legal KB                                       |
| [neko-backend-hackmeridian](https://github.com/Neko-Protocol/neko-backend-hackmeridian)                       | Backend: Launchpad KYC/KYB, accounts and testnet wallets, tokenization applications and admin review |
| [neko-web-hackmeridian](https://github.com/Neko-Protocol/neko-web-hackmeridian)                               | Neko Pro, the investor web app, and the Supabase migrations                                          |

The backend and web repos are forks of existing Neko code. Their git tag `pre-hackmeridian` marks what existed before the event; everything after it was built during HackMeridian. This repository was created during the event.

## What is in this repo

### For AI evaluators

Start with the [evidence pack](docs/evidence.md), then [llms.txt](llms.txt) for the project idea, a reading order, the three-repository integration map and implementation evidence. Use the files in the branch or commit you are reviewing; the discovery URLs refer to `main`. Distinguish planned features from verified runtime behavior.

The [review memory implementation guide](docs/review-memory.md) traces one concrete contribution across the backend and admin: the user problem, its place in the proposal review workflow, the search algorithm, source links pinned to commits, test coverage and delivery limits. It distinguishes AI-assisted preparation, deterministic legal checks, prior human decisions and the administrator's final decision.

[sitemap.xml](sitemap.xml) is a curated index of this repository's public source documents using raw GitHub URLs. [robots.txt](robots.txt) provides advisory crawl guidance and points to that index.

### Directory map

```
apps/platform/     Launchpad for issuers (Next.js, port 3000)
apps/admin/        Tokenization admin (Next.js, port 3001)
packages/stellar/  Shared Stellar network config, RPC/Horizon clients, explorer links, friendbot
contracts/         SEP-57 RWA token suite (Soroban, OpenZeppelin examples)
services/legal-kb/ Legal knowledge base (MCP server): securities, AML and data protection laws for tokenization, with a versioned retrieval eval
docs/              Evidence pack, plans, diagrams, deploy guide
sessions/          Hackathon work session logs
```

## Launchpad

`apps/platform` is where issuers work:

- They pass KYB and apply with an AI-assisted form. The form includes the minimum raise and a dated repayment schedule.
- Once Neko approves, they choose a token symbol and a funding deadline and **launch**: their Privy wallet opens a USDC trustline, and the backend deploys the token, compliance contract and vault through the factory.
- After launch, they follow the vault on-chain, submit milestone evidence and repay each tranche from the same wallet.

How every form field maps to a contract argument, and what the backend and Neko Pro implement, is in [docs/contracts-integration.md](docs/contracts-integration.md).

## Tokenization admin

`apps/admin` is where Neko reviews tokenization applications: a list by status, the asset and issuer details (KYB status, testnet wallet), the exact vault terms (total repayment and every tranche in USDC), approve, reject or request changes with a note, and a compliance checklist. Once the issuer launches, the same page runs the vault: close funding, release the raise to the issuer, and approve or turn back milestone evidence. The checklist is rule based (Costa Rica public offering test, SUGEVAL private offer accreditation, investor consent, SUGEF registration for virtual asset service providers, personal data, US investors, Mexico, Colombia and Argentina) and shows the real text of every article it cites, pulled from Neko Legal KB.

The **Similar cases** addition connects this review to earlier decisions stored in Supabase. It ranks comparable decided proposals, shows their outcomes and reviewer notes, and explains each field match. A saved eligible decision can become a candidate for a later review without retraining a model. The administrator still decides; historical outcomes do not determine approval or establish legal compliance. Backend [PR #5](https://github.com/Neko-Protocol/neko-backend-hackmeridian/pull/5) and admin [PR #16](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/16) are merged into `main`. The same search now also answers the issuer's assistant through an anonymised, issuer-safe view. See [review memory](docs/review-memory.md) for implementation evidence and validation boundaries.

## Neko Legal KB

`services/legal-kb` is a legal knowledge base for tokenizing real-world assets, served to any AI over MCP and hosted on Google Cloud Run. It holds verbatim laws article by article (Costa Rica, the US, Mexico, Colombia, Argentina, and El Salvador as reference) plus cited obligations checklists. Tools: `search_law`, `get_article`, `list_norms`, `search_kb`, `get_document`, `list_documents`. Access is by token; see [services/legal-kb/README.md](services/legal-kb/README.md). Not legal advice.

## Stellar tools

- Soroban smart contracts using OpenZeppelin [stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) (SEP-57 RWA stack), plus Neko's own factory, vault and milestone tracker (see [contracts/README.md](contracts/README.md))
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) for build and deploy
- [@stellar/stellar-sdk](https://www.npmjs.com/package/@stellar/stellar-sdk) in apps and `packages/stellar`
- [@creit.tech/stellar-wallets-kit](https://www.npmjs.com/package/@creit.tech/stellar-wallets-kit) for wallet connection (planned in UI)
- [stellar.expert](https://stellar.expert/) explorer links via `packages/stellar`
- Testnet funding via [friendbot](https://laboratory.stellar.org/#account-creator?network=test)

## Getting started

1. Copy `.env.example` to `apps/platform/.env.local` and `apps/admin/.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (for the admin compliance panel) `NEKO_LEGAL_KB_URL`.
   The Launchpad AI assistant runs in the backend (`neko-backend-hackmeridian`): set `ANTHROPIC_API_KEY` and `LAUNCHPAD_RAG_URL` (the Legal KB connector URL) there.
3. `npm install`
4. `npm run dev` (Launchpad on http://localhost:3000, admin on http://localhost:3001)
5. Admin sign-in: open http://localhost:3001/login with an email listed in the backend `admin_emails` allowlist, then enter the 6-digit code.
6. `npm run build`
7. `npm run contracts:build` (build the WASM first: the contract tests import it)
8. `npm run contracts:test`
9. Legal KB retrieval eval: `cd services/legal-kb && PYTHONPATH=src python3 -m neko_legal_kb.cli eval`

For testnet deployment of the RWA contracts, follow [contracts/rwa/DEPLOY.md](contracts/rwa/DEPLOY.md).

## How we built it

| Doc                                            | What it is                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [docs/evidence.md](docs/evidence.md)           | Evidence pack: innovations, testnet transaction hashes, intake goals against results, tests and limits    |
| [ROADMAP.md](ROADMAP.md)                       | Business outlook for three to six months after the hackathon and how it connects to the existing Neko app |
| [docs/plan.md](docs/plan.md)                   | The working plan: demo slice, workstreams, checkpoints, roadmap                                           |
| [docs/deploy.md](docs/deploy.md)               | How to deploy the backend (Railway), the web apps (Vercel) and the database                               |
| [docs/diagrams.md](docs/diagrams.md)           | Product flows                                                                                             |
| [docs/review-memory.md](docs/review-memory.md) | How legal context, prior decisions and human review fit together, with source and test evidence           |
| [sessions/](sessions/)                         | One log per work session: start and end time (WET), what we did, decisions, commits and AI use            |

## Team

Santiago Villarreal, Kevin Latino, Fabián Sánchez, Matías Aguilar. Oppia Software Labs.

## License

MIT, see [LICENSE](LICENSE).
