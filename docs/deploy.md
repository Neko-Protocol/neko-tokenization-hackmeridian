# Deploy

Five services for the demo, all on testnet:

| Service            | Repo                           | Host                    | Root                |
| ------------------ | ------------------------------ | ----------------------- | ------------------- |
| Backend (NestJS)   | neko-backend-hackmeridian      | Railway                 | repo root           |
| Launchpad          | neko-tokenization-hackmeridian | Vercel                  | `apps/platform`     |
| Tokenization admin | neko-tokenization-hackmeridian | Vercel                  | `apps/admin`        |
| Neko Pro           | neko-web-hackmeridian          | Vercel                  | repo root           |
| Neko Legal KB      | neko-tokenization-hackmeridian | Google Cloud Run (live) | `services/legal-kb` |

Order: database, backend, then the three web apps (they need the backend URL).

## 1. Database (Supabase)

Run every migration in `neko-web-hackmeridian/supabase/migrations`, in order, up to `0033_launchpad_deployments.sql`. The Launchpad needs `0029` (KYC/KYB) and `0030` (applications), Neko Pro needs `0031_launchpad_investors.sql`, and launches need `0032` (minimum raise) and `0033` (deployments). Add each admin email to `admin_emails` (`is_active = true`).

## 2. Backend on Railway

1. New project > Deploy from GitHub repo > `Neko-Protocol/neko-backend-hackmeridian`, branch `main`.
2. Build and start: Railway detects Node. Build `npm run build`, start `npm run start`. Health check path: `/health`.
3. Variables:
   - `GITHUB_PACKAGES_TOKEN`: a GitHub token with `read:packages`. Needed at build time: the `@neko-protocol/*` packages come from GitHub Packages (see `.npmrc`). Without it `npm ci` fails with 401.
   - Required by `src/config/env.validation.ts`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `STELLAR_NETWORK`, `STELLAR_NETWORK_PASSPHRASE`, `STELLAR_RPC_URL`, `STELLAR_HORIZON_URL`, `INTERNAL_API_KEY` (at least 32 characters, generate with `openssl rand -hex 32`).
   - Launchpad: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_VERIFICATION_KEY`; Didit (`DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`, `DIDIT_KYC_WORKFLOW_ID`, `DIDIT_KYB_WORKFLOW_ID`) or `KYC_MOCK_ENABLED=true` for the demo; `REVIEW_SKIP_ENABLED=true` to let judges skip application pre-approval; `LAUNCHPAD_APP_URL` (the Launchpad URL from step 3).
   - Admin sign-in codes are sent by email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
   - `CORS_ORIGIN`: the four web app URLs.
   - Assistant and contracts: `ANTHROPIC_API_KEY`, `LAUNCHPAD_RAG_URL` (Legal KB connector URL), `NEKO_MANAGER_SECRET`, `NEKO_CLAIM_SIGNING_KEY` and the contract IDs from `deployments/testnet.json` (see the backend `.env.example`). Without `LAUNCHPAD_RAG_URL` the assistant still answers but shows the issuer that legal points are not verified.
4. Generate a public domain. That URL is the backend URL for the web apps: `BACKEND_URL` in the Launchpad and admin, `BACKEND_INTERNAL_URL` in Neko Pro.

## 3. Web apps on Vercel

For each app: Add New > Project > import the repo > set Root Directory as in the table > Deploy. Vercel detects Next.js and the npm workspaces.

Variables (Project Settings > Environment Variables):

| Variable                                                                                        | Launchpad | Admin | Neko Pro               |
| ----------------------------------------------------------------------------------------------- | --------- | ----- | ---------------------- |
| `BACKEND_URL`                                                                                   | yes       | yes   |                        |
| `BACKEND_INTERNAL_URL` (Neko Pro's proxy reads this name)                                       |           |       | yes                    |
| `BACKEND_INTERNAL_KEY` (= backend `INTERNAL_API_KEY`)                                           | yes       | yes   | yes                    |
| `NEXT_PUBLIC_STELLAR_NETWORK=testnet` and the other `NEXT_PUBLIC_STELLAR_*` from `.env.example` | yes       | yes   |                        |
| `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_PRIVY_CLIENT_ID`                                       | yes       |       | see its `.env.example` |
| `NEXT_PUBLIC_KYC_MOCK_ENABLED`                                                                  | yes       |       |                        |
| `NEXT_PUBLIC_REVIEW_SKIP_ENABLED`                                                               | yes       |       |                        |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                     |           | yes   | see its `.env.example` |
| `NEKO_LEGAL_KB_URL` (connector URL with token, server only)                                     |           | yes   |                        |
| `GITHUB_PACKAGES_TOKEN`                                                                         |           |       | yes                    |

After the backend has its final URL, set `LAUNCHPAD_APP_URL` and `CORS_ORIGIN` on Railway and redeploy it.

## 4. Contracts (only to redeploy)

The testnet contracts in `deployments/testnet.json` are already live. To rebuild and test them, build the WASM first: the tests import the built artifacts.

```bash
npm run contracts:build   # stellar contract build
npm run contracts:test    # builds again, then cargo test
```

## 5. Smoke test

The check is done when an investment is on chain, not when a page loads. Record each value in [evidence.md](evidence.md).

1. `GET <backend>/health` answers ok.
2. Launchpad: KYB with the mock, account and testnet wallet created.
3. Submit an application with the assistant open: ask one legal question (a `kb_` tool runs) and one question about past decisions (`find_precedents` runs). Note the application ID.
4. Admin: open that application, check the compliance panel loads its citations and the Similar cases panel answers, approve it. (For judging, the demo-only skip on the Launchpad can approve it instead when `REVIEW_SKIP_ENABLED` is on; say so in the demo.)
5. Launchpad: launch it (token symbol and funding deadline). Note the vault contract ID shown on the vault panel.
6. Neko Pro: verify a second wallet (KYC mock), confirm it shows as registered on chain, open the same opportunity and invest a small amount of test USDC. Note the transaction hash and check it on stellar.expert (testnet).
7. Neko Pro dashboard shows the vault token balance. A wallet without on-chain identity cannot receive the token (the contract rejects it).
