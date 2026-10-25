# Plan

**Result we want:** one complete path that judges can try alone on testnet. A business tokenizes an asset through the Launchpad, a verified investor buys it in Neko Pro, the money is released by milestones, and every step can be checked on stellar.expert.

**Deadline:** submission closes 26 Oct 2026, 12:00 WET.

## Do now (session 02)

1. ~~Create the git tag `pre-hackmeridian`~~ Done: both forks are tagged at their state before the event.
2. Lock the pitch basics in one sentence each: problem, who it is for, solution, product names.
3. Lock the demo slice below and agree on what is real and what is simulated.
4. Write the demo case: one fictional asset with amount, rate, minimum ticket and 3 milestones.
5. ~~Assign an owner to each workstream and start building~~ Done: see [Who does what](#who-does-what).

## Repositories

| Repo                                                                                                                | What lives there                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [neko-tokenization-hackmeridian](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian) (this repo, main) | Tokenization platform (Launchpad) and tokenization admin, plan, diagrams and session logs |
| [neko-backend-hackmeridian](https://github.com/Neko-Protocol/neko-backend-hackmeridian)                             | Backend (fork of neko-backend), tagged `pre-hackmeridian`                                 |
| [neko-web-hackmeridian](https://github.com/Neko-Protocol/neko-web-hackmeridian)                                     | Neko Pro, the investor web app (fork of neko-web), tagged `pre-hackmeridian`              |

## Who does what

| Repo                             | Task                                                                            | Owner         |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------- |
| Launchpad (this repo)            | Base setup                                                                      | Santiago      |
| Launchpad                        | KYC/KYB                                                                         | Fabián        |
| Launchpad                        | Create account: Privy wallet for the user, linked to KYC (research C-addresses) | Fabián        |
| Launchpad                        | AI-assisted form                                                                | Fabián        |
| Launchpad                        | Tokenization process: factory, token, escrow                                    | Matías        |
| Launchpad                        | Launch and display on Neko Pro                                                  | Kevin         |
| Launchpad                        | Issuer dashboard with the user's tokenized assets                               | Kevin         |
| Neko Pro (web and backend forks) | KYC/KYB                                                                         | Fabián        |
| Neko Pro                         | Assets showcase and asset detail                                                | Kevin         |
| Neko Pro                         | Asset buy and sell                                                              | Matías, Kevin |
| Tokenization admin (apps/admin)  | Approve or reject tokenization proposals                                        | Santiago      |
| Tokenization admin               | Legal compliance                                                                | Santiago      |
| Submission                       | Pitch deck                                                                      | Kevin         |
| Submission                       | Roadmap                                                                         | Fabián        |
| Submission                       | Video                                                                           | Everyone      |
| Submission                       | llms.txt, robots.txt and sitemap.xml for the main repo                          | Fabián        |

## The demo slice

What we build and show, end to end, on testnet:

1. **Issuer, Launchpad:** KYB (test data), AI-assisted form, approval in the tokenization admin, wallet created, SEP-57 token issued, opportunity launched, issuer dashboard.
2. **Investor, Neko Pro:** KYC (test data), opportunities with filters, buy from a minimum amount, funds held in Trustless Work escrow, dashboard showing the investment and each payment or milestone release.
3. **Issuer that already tokenizes:** shown as a listing in Neko Pro. Neko already reads Etherfuse data in production, so an Etherfuse asset is the natural example.

Only KYC/KYB-verified wallets can hold the token. SEP-57 enforces this in the contract through its identity registry.

## Workstreams

| Workstream           | What it delivers                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On-chain             | SEP-57 token (OpenZeppelin) with identity registry; Trustless Work milestone escrow; testnet accounts with "neko" in the name; transaction links                             |
| Launchpad (issuer)   | KYB step, AI-assisted form, approval view in admin, wallet creation, launch, issuer dashboard                                                                                |
| Neko Pro (investor)  | KYC step, opportunities with filters, buy flow, investor dashboard with auditable payments                                                                                   |
| Story and submission | Problem with a real quote, deck on the official template, 2 to 4 minute video, README, AGENTS.md, llms.txt, robots.txt, sitemap.xml, stellar.toml, portal form, session logs |

## Checkpoints

1. Tag created and work split.
2. Token and escrow working on testnet.
3. First internal demo on a real phone: only what works is discussed.
4. Full path working end to end.
5. Feature freeze. From here on only fixes, polish and submission material.
6. Video recorded, deck closed, draft saved in the portal.
7. Fresh run of the full path with new accounts, repo checked as a judge would, final submission before the deadline.

## Roadmap, not in the demo

- Real legal process and due diligence for each issuer.
- Exit before maturity: secondary market between verified investors only.
- Liquidity reserve (raise a little more than needed to cover late payments or exits).
- Confidential token amounts with OpenZeppelin confidential tokens: shown only if the testnet probe works; total privacy is not yet guaranteed in production.
- Neko Pro inside the mobile app; more countries, starting with Costa Rica.

## Rules for the event

- Small, frequent commits, each with its real author.
- Every session gets a log in [sessions/](../sessions/).
- README, deck, video and portal use the same names and numbers.
- Declare prior work and AI use honestly.
