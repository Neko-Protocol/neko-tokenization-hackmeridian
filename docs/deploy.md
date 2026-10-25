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

Run the migrations from `neko-web-hackmeridian/supabase/migrations` up to `0030_launchpad_applications.sql`. Add each admin email to `admin_emails` (`is_active = true`).

## 2. Backend on Railway

1. New project > Deploy from GitHub repo > `Neko-Protocol/neko-backend-hackmeridian`, branch `main`.
2. Build and start: Railway detects Node. Build `npm run build`, start `npm run start`. Health check path: `/health`.
3. Variables:
   - `GITHUB_PACKAGES_TOKEN`: a GitHub token with `read:packages`. Needed at build time: the `@neko-protocol/*` packages come from GitHub Packages (see `.npmrc`). Without it `npm ci` fails with 401.
   - Required by `src/config/env.validation.ts`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `STELLAR_NETWORK`, `STELLAR_NETWORK_PASSPHRASE`, `STELLAR_RPC_URL`, `STELLAR_HORIZON_URL`, `INTERNAL_API_KEY` (at least 32 characters, generate with `openssl rand -hex 32`).
   - Launchpad: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_VERIFICATION_KEY`; Didit (`DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`, `DIDIT_KYC_WORKFLOW_ID`, `DIDIT_KYB_WORKFLOW_ID`) or `KYC_MOCK_ENABLED=true` for the demo; `LAUNCHPAD_APP_URL` (the Launchpad URL from step 3).
   - Admin sign-in codes are sent by email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
   - `CORS_ORIGIN`: the four web app URLs.
4. Generate a public domain. That URL is `BACKEND_URL` for the web apps.

## 3. Web apps on Vercel

For each app: Add New > Project > import the repo > set Root Directory as in the table > Deploy. Vercel detects Next.js and the npm workspaces.

Variables (Project Settings > Environment Variables):

| Variable                                                                                        | Launchpad | Admin | Neko Pro               |
| ----------------------------------------------------------------------------------------------- | --------- | ----- | ---------------------- |
| `BACKEND_URL`                                                                                   | yes       | yes   | yes                    |
| `BACKEND_INTERNAL_KEY` (= backend `INTERNAL_API_KEY`)                                           | yes       | yes   | yes                    |
| `NEXT_PUBLIC_STELLAR_NETWORK=testnet` and the other `NEXT_PUBLIC_STELLAR_*` from `.env.example` | yes       | yes   |                        |
| `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_PRIVY_CLIENT_ID`                                       | yes       |       | see its `.env.example` |
| `NEXT_PUBLIC_KYC_MOCK_ENABLED`                                                                  | yes       |       |                        |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                     |           | yes   | see its `.env.example` |
| `NEKO_LEGAL_KB_URL` (connector URL with token, server only)                                     |           | yes   |                        |
| `GITHUB_PACKAGES_TOKEN`                                                                         |           |       | yes                    |

After the backend has its final URL, set `LAUNCHPAD_APP_URL` and `CORS_ORIGIN` on Railway and redeploy it.

## 4. Smoke test

1. `GET <backend>/health` answers ok.
2. Launchpad: KYB with the mock, account and testnet wallet created.
3. Submit an application, then sign in to the admin, open it, check the compliance panel loads its citations, approve it.
4. Neko Pro: the opportunities page loads.
