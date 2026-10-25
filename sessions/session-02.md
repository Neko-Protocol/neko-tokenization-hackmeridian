# Session 02: Repositories, monorepo and work split

- **Started:** 2026-10-25 13:15 WET
- **Ended:** 2026-10-25 15:19 WET
- **People:** Santiago Villarreal, Kevin Latino, Fabián Sánchez, Matías Aguilar
- **Goal:** set up the repositories and the monorepo, and split the work.

## What we did

1. Chose the repositories: this monorepo is the main repo for the Launchpad and the tokenization admin; the forks neko-backend-hackmeridian and neko-web-hackmeridian hold Neko Pro.
2. Tagged both forks `pre-hackmeridian` at their state before the event.
3. Set up the monorepo: Turborepo, Next.js platform and admin apps, a shared Stellar package and the OpenZeppelin SEP-57 RWA contracts (PR #1).
4. Split the work. See [Who does what](../docs/plan.md#who-does-what).

## Decisions

- Everything is in English.
- Commits are signed by their real author; no co-authored commits.
- We work through branches and pull requests.

## Built (commits and PRs)

- [PR #1](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/1): monorepo setup. Build, lint, 52 contract tests and `stellar contract build` passing.

## Open questions

- C-addresses for Privy wallets.
- Product names: Launchpad or Neko Factory for the issuer side; Neko Pro for the investor side.

## Next session

Each owner starts their task.

## AI use

Claude helped scaffold the monorepo and wrote these docs. The team chose the structure and the work split and reviewed the result.
