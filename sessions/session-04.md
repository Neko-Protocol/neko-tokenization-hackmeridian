# Session 04: Contracts, QA and pitch

- **Started:** 2026-10-25 20:13 WET (approximate)
- **Ended:** 2026-10-25 23:30 WET (approximate)
- **People:** Santiago Villarreal, Kevin Latino, Fabián Sánchez, Matías Aguilar
- **Goal:** close the build, deploy, and start the pitch.

## What we did

**Fabián**

1. Everything done except KYB and KYC in Neko Pro, including the tokenization proposal form with its assistant.
2. Next: deploy everything and make it work end to end.

**Santiago**

1. All code done. Quality review: builds, lint and tests across the three repos; two hardening fixes in the admin (compliance checks require an admin session, the Launchpad proxy blocks admin routes); deploy guide.
2. Next: QA, then the pitch deck, narrative and video script.

**Matías**

1. All contracts done: vault, factory and milestone tracker, plus typed bindings for the front end.

**Kevin**

1. Next: integrate Matías's contracts into the frontend.

## Decisions

- The pitch work moves to its own thread.
- Deploy targets: backend on Railway, Launchpad, admin and Neko Pro on Vercel, Neko Legal KB stays on Google Cloud Run.
- The applications migration lives with the other Supabase migrations in neko-web-hackmeridian (`0030_launchpad_applications.sql`).

## Built (commits and PRs)

- [#7](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/7): AI form owner, session 03 log, README update (Santiago)
- [#8](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/8): admin hardening and deploy guide (Santiago)
- [#9](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/9): vault, factory and milestone tracker contracts (Matías)
- [#10](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/10) and [#12](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/12): tokenization proposal form with an AI assistant and RAG (Fabián)
- [#11](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/11): admin restyled with the Neko dashboard look (Santiago)
- [#13](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/13): typed contract bindings for the front end (Matías)
- [#14](https://github.com/Neko-Protocol/neko-tokenization-hackmeridian/pull/14): one route per Launchpad screen and page banner (Kevin)
- [neko-web-hackmeridian#3](https://github.com/Neko-Protocol/neko-web-hackmeridian/pull/3): applications table migration

## Open questions

- KYB and KYC in Neko Pro.
- Backend deploy on Railway, then connect the three Vercel apps to it.

## Next session

Deploy, integrate the contracts in the frontend, run the full path on testnet, record the video, close the deck and submit before 12:00 WET.

## AI use

Claude (Anthropic) ran the quality review, wrote the hardening fixes, the deploy guide and these logs, and helped draft the pitch structure. The team made the decisions and reviewed the pull requests.
