# Evidence pack

Everything a judge or an AI reviewer needs to check Neko's HackMeridian work without asking us: what is new, what runs, the transactions that prove it, how it compares with what we set out to do, and what is still missing. Every hackathon contract and vault is on Stellar testnet.

## The story in one paragraph

Tokenizing a real-world asset is hard, and even when a business manages it there are no buyers. Neko already has the buyers side: a live investing app on Stellar mainnet for people in Latin America. At HackMeridian we built the issuer side and connected the two. A business prepares its offering with an AI assistant that cites the actual law and Neko's past review decisions, Neko's team reviews it, one click deploys a regulated SEP-57 token and a loan vault on Stellar, and verified investors put USDC in, get repaid in tranches and redeem, with every step on chain.

## What is new

| Innovation                                      | Why it matters                                                                                                                                                                                                                                                                                                          | Where                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| An assistant that can only cite what it read    | The Launchpad assistant answers next to the form, reads the issuer's documents, proposes field values the issuer accepts or not, and cites only articles it retrieved from Neko Legal KB (verbatim laws of six countries over MCP). If the KB is down, the issuer sees it.                                              | backend `src/domains/launchpad/assistant/`, `services/legal-kb`       |
| Past decisions, with permissions                | One precedent search serves two readers: the reviewer sees full earlier cases with notes; the issuer's assistant sees only anonymised cases (decision, month, matching and differing criteria) and never another issuer's name, notes or documents.                                                                     | backend `precedents.service.ts`, admin Similar cases panel            |
| A vault built for many lenders and one borrower | Investors deposit USDC and get vault tokens one for one; the raise is released only if the minimum is met (otherwise refunds); the borrower repays dated tranches; holders redeem pro rata or exit early with a fee that stays with the holders who remain. An escrow cannot express this, which is why we replaced it. | `contracts/vault`, `contracts/factory`, `contracts/milestone-tracker` |
| Eligibility enforced by the contract            | A KYC approval becomes an on-chain identity with signed KYC and AML claims in a shared registry. The token refuses any wallet without it, so investors pass KYC once and can join any vault. The investor signs nothing for this step.                                                                                  | backend `chain/onchain-identity.service.ts`, `contracts/rwa`          |
| One click from approval to chain                | The backend deploys token, compliance contract and vault through the factory and records them, so Neko Pro lists the opportunity straight from chain data.                                                                                                                                                              | backend `chain/launch.service.ts`, web `src/features/shared/pro`      |

## The experience

- **Issuer:** a ten-step form in plain language with the assistant beside it. Suggested values arrive with an Apply button, never written silently. The issuer sees the exact vault terms (total repayment and every tranche in USDC) before launching, then follows the vault, submits milestone evidence and repays from the same Privy wallet. No seed phrases.
- **Reviewer:** one screen with the application, a rule-based compliance checklist that shows the real text of every cited article, Similar cases with match reasons, an AI-generated summary clearly labelled as not verified, and the vault controls after launch.
- **Investor:** KYC, then opportunities read live from the contracts. Invest, refund, early exit or redeem appear only when the vault state allows them, the exit fee is shown before signing, contract errors become plain messages, and every action links to stellar.expert. English and Spanish.

## Proof on testnet

### Contracts

From [deployments/testnet.json](../deployments/testnet.json):

| Contract            | ID                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Factory             | [CC2PULZW…F45PC](https://stellar.expert/explorer/testnet/contract/CC2PULZW3YW3ZRE2Z43RJ5HQDO6L4KAJTDDI5CFMV65662VFAR7F45PC)  |
| Identity registry   | [CASQETGM…E5XFY](https://stellar.expert/explorer/testnet/contract/CASQETGMSXSJR6V5FAUITYU36HVNA7EI5O2H2ZEWDXEIMXVLV2LE5XFY)  |
| Milestone tracker   | [CCXYSLXV…E4EC2S](https://stellar.expert/explorer/testnet/contract/CCXYSLXVY3SIKTIKLP2FB5BHLGMKCV6YHQAWMZZUN5HKJA5OSFE4EC2S) |
| Vault torre-cartago | [CDSJN67B…NTUDG](https://stellar.expert/explorer/testnet/contract/CDSJN67BXE3YA4QSO5S4XMZ4X5INMLRP2VBKYX2LFK37ALFQEKLNTUDG)  |

### A full vault lifecycle, transaction by transaction

The `torre-cartago` vault (target 100,000 test USDT0, repayment 113,000) ran its whole life on 26 October 2026 between 00:35 and 00:38 UTC, driven by `contracts/scripts/run-demo.sh` with two onboarded investors. All transactions succeeded; we read them back from Horizon testnet at 09:20 UTC the same day.

| Step                                    | Signed by    | Transaction                                                                                                              |
| --------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Investor A invests                      | investor A   | [b0eb69fd…](https://stellar.expert/explorer/testnet/tx/b0eb69fd7a998b5c37d6556960f422bcb780d9eb4955ad884d0d2d41589628c5) |
| Investor B invests                      | investor B   | [0b5ae512…](https://stellar.expert/explorer/testnet/tx/0b5ae512268a554323c4ad69cf221b75751ac6b67b437ed1e344853f8fb1dc42) |
| Funding closes                          | Neko manager | [982513de…](https://stellar.expert/explorer/testnet/tx/982513de37ebc6cef90189eca87120c8ce5dc3a4975bbf66369ff1084055553e) |
| Raise released to the borrower          | Neko manager | [a68cd086…](https://stellar.expert/explorer/testnet/tx/a68cd0860d29c93b3b2f0b097d7e7a55160e7068e7c66a940c4cd2efc12578dd) |
| Tranche 1 repaid                        | borrower     | [f91b1d16…](https://stellar.expert/explorer/testnet/tx/f91b1d16f7ca4656f38c926d1cd77288dfb1f6a84bb1a86a6b23593888f6693e) |
| Tranche 2 repaid                        | borrower     | [79717513…](https://stellar.expert/explorer/testnet/tx/79717513cd3b40d87d4ea5d341763d71bbcb7b9c60f666baaaf322a775f23d45) |
| Investor B exits early (with fee)       | investor B   | [574e98f5…](https://stellar.expert/explorer/testnet/tx/574e98f555c8a31ca37685e8ce636649e4963333052d241abe3206a4b3495bb8) |
| Tranche 3 repaid                        | borrower     | [3a5eb217…](https://stellar.expert/explorer/testnet/tx/3a5eb2174586250f2bc0c77bf8d34894a3e54b9da6a99a4dddef5f038990a9bb) |
| Investor A redeems principal + interest | investor A   | [fae8363d…](https://stellar.expert/explorer/testnet/tx/fae8363dc83a0ab16f209977e4021fe19c2d8bb500d62d16096059a84390f96a) |

The same script also tries an invest from a wallet with no on-chain identity and expects the contract to refuse it; the contract tests cover the same rule (`cargo test`, see below).

Before the investments, investor A's identity received its KYC and AML claims in [e8070547…](https://stellar.expert/explorer/testnet/tx/e80705479f299d0dd6ae80db66446be54c57d650abdcfaf11efe839506fe5482) and [78117a24…](https://stellar.expert/explorer/testnet/tx/78117a24872f9a1383af8a6f2451cd1c264fa3228e47f9ef4cdd7e0eed562d60).

### The same journey through the three apps

The lifecycle above was driven by script, so it proves the contracts, not the apps. The app journey (application, review, launch from the Launchpad, invest from Neko Pro) is the [smoke test in the deploy guide](deploy.md#5-smoke-test). Record its values here when it runs:

| Value                                  | Recorded |
| -------------------------------------- | -------- |
| Application ID                         | not yet  |
| Decision (admin, or demo skip)         | not yet  |
| Vault contract launched by the factory | not yet  |
| Neko Pro invest transaction            | not yet  |
| Vault token balance after investing    | not yet  |

The factory has launched further vaults since the script runs (latest `create_vault` [4b6c087c…](https://stellar.expert/explorer/testnet/tx/4b6c087c9d17e4e9fca28620144d5a281c89a7634dd27ce5282e1927c3bd4702) at 02:33 UTC); we have not tied it to an application ID in this record. For judging, issuers can approve their own application with the demo-only skip (`REVIEW_SKIP_ENABLED`), which is a declared shortcut, not the production review.

## What we set out to do, and where we landed

From our HackMeridian intake: "one complete path working live on Stellar testnet: a project owner creates a deal with 3 milestones, Neko approves it and creates the token and an escrow that holds the money, an investor buys $5 in USDC from the Neko app, and when the first milestone is approved, exactly that part of the money is released to the owner. Every step can be checked on a block explorer, and the full demo takes 3 minutes or less."

| Intake goal                          | Before the event                                                            | Built at the event                                                                                      | Evidence                                                     | Still open                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Project owner creates a deal         | Nothing for issuers                                                         | KYB, Privy wallet, AI-assisted form with minimum raise and dated repayment tranches                     | backend `launchpad/`, `apps/platform`                        | Measured issuer time and quality, with real issuers                              |
| Neko approves it                     | Nothing                                                                     | Admin review with cited checklist, Similar cases, AI summary labelled as unverified                     | `apps/admin`, backend `applications.service.ts`              | Compliance modules (holder caps, country rules) on chain                         |
| Token and money holder               | Nothing                                                                     | SEP-57 token plus Neko vault (design changed from escrow, see [plan](plan.md)), launched by the factory | contracts, lifecycle table above                             | Audit before mainnet; OpenZeppelin marks the RWA module as unaudited             |
| Investor buys from the Neko app      | Neko app live on mainnet with dollar vaults and RWAs (pre-hackmeridian tag) | Neko Pro: KYC, on-chain identity, live vaults, invest, refund, early exit, redeem                       | web `src/features/shared/pro`, investor A and B transactions | App-driven investment hash in the table above                                    |
| Money released by milestone          | Nothing                                                                     | Raise released when funding closes; repayments and milestone evidence tracked per tranche               | release and repay transactions                               | Releasing the raise itself in parts by milestone (today it is released at close) |
| Every step on an explorer, 3 minutes | Nothing                                                                     | Vault actions link to stellar.expert                                                                    | this page                                                    | Final recorded demo video                                                        |

The existing Neko app's users and deposits are background. They are not adoption of this new Launchpad, which has no real issuers yet.

## Test results

Run on 26 October 2026 against the branches of this change.

| Check                                                                        | Result                                                                                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Backend Launchpad tests (`npx jest src/domains/launchpad`)                   | 7 suites, 121 tests passing                                                                                                            |
| Tokenization lint (`npm run lint`)                                           | passing (Launchpad and admin)                                                                                                          |
| Tokenization typecheck (`turbo run typecheck`)                               | passing (5 packages)                                                                                                                   |
| Legal KB unit tests                                                          | 43 passing, 1 skipped                                                                                                                  |
| Legal KB retrieval eval ([eval/README](../services/legal-kb/eval/README.md)) | Law articles: 6/20 top-1, 9/20 top-3, 14/20 top-5. Guides: 4/4. Misses are listed, not hidden                                          |
| Contracts (`npm run contracts:test`, builds WASM first)                      | 90 passing in an external review run on 26 October 2026 after building the WASM; not rerun here (this change touches no contract code) |

Older test debt in the forks, not introduced at the event: in the backend, suites for CORS text, mailing, vault APY (Blend types) and pool rates fail or do not load, and the fork has no ESLint config; in the investor web app, lint reports errors in pre-event code. None of the repositories has a CI workflow yet.

## Limits we state up front

- Testnet only, with test USDC and USDT0.
- No compliance modules are registered yet: identity is enforced, holder counts and country rules are not ([contracts README](../contracts/README.md#known-limitations)).
- The precedent search uses fixed weights over seven fields. It does not learn, predict approval or replace the reviewer, and the issuer's assistant sees anonymised cases only.
- Retrieval quality of the legal KB is measured above and is not yet good enough for unfiltered cross-country questions.
- The assistant gives orientation, not legal advice; Neko's legal team decides.
