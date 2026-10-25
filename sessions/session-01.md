# Session 01: Problem, stakeholders and flows

- **Started:** 2026-10-25 10:53 WET
- **Ended:** 2026-10-25 13:15 WET (approximate)
- **People:** Santiago Villarreal, Kevin Latino, Fabián Sánchez, Matías Aguilar
- **Goal:** agree on the problem, who it is for and what we build, before writing any code.

## What we did

1. Defined the problem and the stakeholders (meeting notes).
2. Defined the scope of the product.
3. Brainstormed on the whiteboard: two kinds of issuers, the issuer flow (Launchpad) and the investor flow (Neko Pro). See [diagrams.md](../docs/diagrams.md).
4. Agreed to work in short iterations and to log every session.

## Problem

There is a technology gap to tokenize real-world assets. A business that wants to tokenize needs smart contracts, a front end, a back end, a legal structure and a way to explain it without jargon. A business that already tokenized still has the second half of the problem: finding buyers.

Working statement: _tokenizing is still hard, and even when you manage it, you have no buyers. Neko solves both._

## Stakeholders

- **Issuers:** businesses that already tokenize, want to tokenize, or would benefit from it.
- **Investors:** retail, large investors and businesses.
- **Neko Factory:** the Neko entity that offers tokenization.
- **Trustless Work:** technology partner (milestone escrow).

## Two kinds of issuers

1. **Already tokenizes assets** and looks for distribution (examples: RedSwan, Etherfuse). The issuer comes to Neko and Neko sells to investors. Revenue: B2B commission of 0.4% plus a one-time listing fee; a B2C fee per sale on the investor side.
2. **Wants to tokenize assets** and looks for infrastructure (smart contracts, front, back), legal structure and no jargon. They go through the Launchpad.

## Flows

**Launchpad (issuer):** KYB/KYC, AI-assisted form, approval by Neko (legal and compliance), create wallet, tokenization, launch, dashboard.

**Neko Pro (investor):** KYC/KYB, access to opportunities with filters, dashboard.

## Scope agreed

- A platform to tokenize an asset from zero, including legal considerations and due diligence on who tokenizes and why. The issuer decides whether the token is public or private.
- Neko Pro: investors enter each opportunity from a minimum amount. Only investors with KYC or KYB can invest, enforced in the contracts.
- Investors can audit the asset and see how payments are made.
- Include a roadmap.

## Decisions

- Work in iterations; one log per session.
- Everything we present is in English.
- Repositories: this monorepo is the main repo (tokenization platform and admin); the backend and Neko Pro live in forks tagged `pre-hackmeridian`. See [plan.md](../docs/plan.md#repositories).
- No co-authored commits; each commit carries its real author.

## Open questions

- Product names: Neko Factory, Launchpad or Neko Launch for the issuer side; Neko Pro or another name for the investor side.
- Public vs private token: SEP-57 already limits holders to verified investors; confidential tokens could also hide amounts.
- Exit before maturity: a DEX conflicts with KYC-gated transfers unless trading is only between verified investors.
- Liquidity reserve: raising extra (for example 10.5M for a 10M deal) as a reserve for late payments or exits. Needs research.
- Which slice of the full flow we demo in 28 hours.

## Next session

Lock the pitch basics and the demo slice, split the work, and start building. See [plan.md](../docs/plan.md).

## AI use

Claude (Anthropic) helped draft the meeting agenda, turned the whiteboard into diagrams and drafted this log and the plan. The team ran the meeting, made the decisions and reviewed the text.
