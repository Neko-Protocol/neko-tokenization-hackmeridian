# Contracts integration

How the Launchpad, the tokenization admin, the backend and Neko Pro use the contracts deployed on testnet (`deployments/testnet.json`). The contracts are fixed; everything below adapts to them.

> **Status:** everything below is built. The backend part is in `neko-backend-hackmeridian/src/domains/launchpad/chain/`, the migrations are `0032_launchpad_min_target.sql` and `0033_launchpad_deployments.sql`, and the Neko Pro part is in `neko-web-hackmeridian/src/features/shared/pro/`. Item 6 of the Neko Pro changes (demo vaults) was left out: the script vaults are `casa-circle` and `torre-cartago`, and neither uses the platform USDC. Launchpad account wallets with no investor record can also call `POST /v1/launchpad/investors/:wallet/onchain`.

## Who signs what

The contracts decide this, not the apps:

| Call                                                                                                                                                                                                                                                  | Auth required         | Signed by                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------- |
| factory `create_vault`, `wire_vault`; compliance and registry `bind_token`; tracker `register_vault`, `review_milestone`; vault `close_funding`, `release`; registry `add_identity`; identity `add_claim` (when the identity is owned by the manager) | `manager` role        | **backend**, `NEKO_MANAGER_SECRET`                      |
| token `accept_admin_transfer`                                                                                                                                                                                                                         | platform admin        | **backend**, `NEKO_ADMIN_SECRET`                        |
| vault `repay`, tracker `submit_milestone`, USDC trustline                                                                                                                                                                                             | issuer (the borrower) | **Launchpad**, Privy embedded wallet (`useSignRawHash`) |
| vault `invest`, `refund`, `early_exit`, `redeem`, USDC trustline                                                                                                                                                                                      | investor              | **Neko Pro**, Stellar Wallets Kit                       |

The identity verifier never checks who owns an investor's identity contract (`stellar-tokens` 0.8.0, `rwa/identity_verification/storage.rs`). The backend can therefore deploy each investor's identity with the manager as owner and add the claims itself, with no investor signature.

**Secrets needed before anything can launch.** Whoever ran `contracts/scripts/deploy-shared.sh` holds these keys in their Stellar CLI keystore:

- `neko-manager` → `NEKO_MANAGER_SECRET` (`stellar keys show neko-manager`)
- `neko-usdc-issuer` → `NEKO_USDC_ISSUER_SECRET`
- `deployments/.claim-signing-key-testnet` → `NEKO_CLAIM_SIGNING_KEY` (64 hex characters)
- optional: `neko-admin` → `NEKO_ADMIN_SECRET`

## From application to vault

All amounts are in USDC with 7 decimals. `packages/stellar` has the same arithmetic in `terms.ts`, and the backend must match it exactly:

```ts
rateBps = round(yield_pct * 100 * term_months / 12)              // simple interest over the term
expected_repayment = target + target * rateBps / 10_000          // in base units
tranche[i] = expected_repayment * round(pct_i * 100) / 10_000    // floor
tranche[last] = expected_repayment - sum(other tranches)         // remainder, so they add up exactly
```

| Contract field                               | Source                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `VaultRequest.vault_id`                      | `sha256(application.id)` as 32 bytes, so a retry targets the same vault                 |
| `VaultRequest.issuer`, `VaultTerms.borrower` | issuer wallet (`launchpad_wallets.address`)                                             |
| `VaultRequest.name`                          | `asset_name`                                                                            |
| `VaultRequest.symbol`                        | `token_symbol` from the launch request, matching `^[A-Z0-9]{2,12}$`                     |
| `VaultRequest.metadata_hash`                 | sha256 of the application row serialised as JSON with sorted keys                       |
| `VaultRequest.metadata_uri`                  | `GET /v1/launchpad/opportunities/:id` public URL                                        |
| `VaultTerms.usdc`                            | `shared.usdc`                                                                           |
| `target`, `min_target`                       | `target_amount`, `min_target` in base units                                             |
| `expected_repayment`                         | formula above                                                                           |
| `funding_deadline`                           | `funding_deadline` from the launch request, unix seconds (u64)                          |
| `exit_fee_bps` / `max_exit_fee_bps`          | `NEKO_EXIT_FEE_BPS` 500 / `NEKO_MAX_EXIT_FEE_BPS` 1000 (the Launchpad shows 5% and 10%) |
| `fee_recipient`                              | `accounts.admin`                                                                        |
| `tranches[i]`                                | `{ expected_amount: tranche[i], due_date: unix(milestones[i].due) }`                    |
| tracker `register_vault(titles)`             | `milestones[i].title`                                                                   |

The application form now sends:

- `min_target`
- `milestones: [{ title, amount_pct, due: "YYYY-MM-DD" }]`, which is the repayment schedule; the percentages add up to 100 and the dates are in order

The launch screen sends `token_symbol` and `funding_deadline`.

## Backend changes (neko-backend-hackmeridian)

### 1. Environment

Only keys and roots go in env. Every other address is read from the ledger at startup (checked live on testnet):

```bash
LAUNCHPAD_RPC_URL=https://soroban-testnet.stellar.org
LAUNCHPAD_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

NEKO_MANAGER_SECRET=S...          # signs every manager-role call
NEKO_USDC_ISSUER_SECRET=S...      # test USDC faucet; also identifies the USDC asset
NEKO_CLAIM_SIGNING_KEY=<64 hex>   # signs investor KYC/AML claims (deployments/.claim-signing-key-testnet)

NEKO_FACTORY_ID=C...              # root: the platform contracts are found from it
NEKO_MILESTONE_TRACKER_ID=C...    # nothing on-chain points to the tracker, so it is its own root
NEKO_IDENTITY_WASM_HASH=<hex>     # the identity contract code to deploy per investor

NEKO_ADMIN_SECRET=S...            # optional: only to accept each token's admin role
```

Derived at startup:

| Value                                 | How                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| manager address                       | `Keypair.fromSecret(NEKO_MANAGER_SECRET).publicKey()`; must equal `templates.platform_manager`             |
| platform admin (also `fee_recipient`) | factory `get_templates().platform_admin`                                                                   |
| identity registry                     | `get_templates().identity_registry`                                                                        |
| identity verifier                     | `get_templates().identity_verifier`                                                                        |
| claim topics and issuers              | verifier `claim_topics_and_issuers()`                                                                      |
| claim issuer                          | topics `get_trusted_issuers()[0]`                                                                          |
| USDC asset                            | `new Asset("USDC", Keypair.fromSecret(NEKO_USDC_ISSUER_SECRET).publicKey())`                               |
| USDC contract                         | `thatAsset.contractId(LAUNCHPAD_NETWORK_PASSPHRASE)` (the Stellar Asset Contract address is deterministic) |
| Horizon URL                           | `https://horizon-testnet.stellar.org` by default                                                           |

Exit fees default to 500 / 1000 bps in code. The public base URL for `metadata_uri` can reuse the existing `LAUNCHPAD_APP_URL` setting.

**`NEKO_ADMIN_SECRET` is optional.** The launch is complete without the admin handover: after `wire_vault` the vault already holds the minting role. Accepting the handover only matters for pausing a token later, and the offer expires after 7 days. Without the secret, skip the `accept_admin` step.

**The identity wasm hash** is already on testnet: it is the code behind the identity contracts `onboard-investor.sh` deployed for alice and bob. Read off the ledger, both run `3b406019c6b585b692c06dfe69d961eb3403af5d558434670151a82d108894b1`. No upload is needed.

**The milestone tracker ID** is the `shared.milestone_tracker` entry in `deployments/testnet.json`; it is already deployed.

Keep all of this apart from the mainnet `STELLAR_*` variables the keeper uses.

### 2. Migration (`neko-web-hackmeridian/supabase/migrations/0033_launchpad_deployments.sql`)

`min_target` is already added by `0032_launchpad_min_target.sql`.

```sql
create table launchpad_deployments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references launchpad_applications(id) on delete cascade,
  vault_id text not null unique,
  token_symbol text not null,
  funding_deadline timestamptz not null,
  token text, compliance text, vault text,
  status text not null default 'launching' check (status in ('launching','live','failed')),
  steps jsonb not null default '{}'::jsonb,
  error jsonb,
  launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table launchpad_deployments enable row level security;
revoke all on launchpad_deployments from anon, authenticated;

alter table launchpad_investors
  add column identity_contract text,
  add column onchain_registered_at timestamptz;
```

### 3. DTOs and views

**`CreateApplicationDto`** (done; the `min_target` view field and assistant fields are done too):

- `min_target` is a required number, at least `min_ticket` and at most `target_amount`.
- `milestones` is required: between 1 and 12 entries, `due` required as an ISO date, percentages summing to 100 (±0.01), dates ascending, and the first date after today.
- The service stores `min_target`.

**`ApplicationView` and `AdminApplicationView`** add:

- `min_target: number | null`
- `deployment: DeploymentView | null`. The shape is in `apps/platform/src/lib/services/launchpad.api.ts` as `Deployment`:

```ts
{ vault_id, token_symbol, funding_deadline, token, compliance, vault,
  status: "launching" | "live" | "failed",
  steps: Partial<Record<"create_vault"|"wire_vault"|"accept_admin"|"bind_compliance"|"bind_registry"|"register_milestones", txHash>>,
  error: { step, message } | null, launched_at }
```

`applications/mine` and the admin list and get must join it.

**AI assistant:** add `min_target` and `milestones` (in the format the form uses) to the fields it may propose. The Launchpad already accepts both from a proposal.

### 4. Soroban signer service (`src/domains/launchpad/chain/`)

Reuse the `sendTx` pattern in `src/domains/investing/vault-invest/keeper/tx.ts`, on a `new rpc.Server(LAUNCHPAD_RPC_URL)`:

1. Build with `new Contract(id).call(method, ...args)`.
2. Run `server.prepareTransaction`.
3. Sign with the manager or admin `Keypair`.
4. Call `sendTransaction`, then `pollTransaction`.

Parse `Error(Contract, #n)` out of failures:

| Contract     | Error codes                                                                      |
| ------------ | -------------------------------------------------------------------------------- |
| FactoryError | 1 VaultExists, 2 UnknownVault, 3 AlreadyWired                                    |
| VaultError   | 1 InvalidState … 11 SupplyOutstanding                                            |
| TrackerError | 1 VaultExists, 2 UnknownVault, 3 UnknownMilestone, 4 WrongStatus, 5 NoMilestones |

Argument encoding: `Address.fromString(x).toScVal()`, `nativeToScVal(n, {type: "u32" | "u64" | "i128" | "string"})`, and `nativeToScVal(Buffer.from(hex, "hex"))` for `BytesN<32>`. The struct arguments (`VaultRequest`, `VaultTerms`, `TrancheInit`) are ScMaps with **keys sorted alphabetically**:

```ts
const map = (o: Record<string, xdr.ScVal>) =>
  xdr.ScVal.scvMap(
    Object.keys(o)
      .sort()
      .map(
        (k) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: o[k] })
      )
  );
```

### 5. `POST /v1/launchpad/applications/:id/launch`

**Guard and body:**

- Privy bearer; the caller must own the application, and its status must be `approved`.
- Body: `{ token_symbol, funding_deadline }`. Check the symbol pattern, and that the deadline is in the future and before the first `due`.

**Before deploying:**

1. Load the issuer wallet. If Horizon shows no `USDC:NEKO_USDC_ISSUER` trustline, return **409 `TRUSTLINE_MISSING`**. The Launchpad opens the trustline itself before calling.
2. Upsert the `launchpad_deployments` row with status `launching`.

**Then run each step. Skip a step that has already happened, and save each tx hash into `steps`:**

| Step                  | Call                                                                                                                                              | Skip / tolerate when                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `create_vault`        | factory `create_vault(request, terms, tranches, manager)` (manager signs); store `token`, `compliance` and `vault` from the returned `Deployment` | `VaultExists` (#1): read `get_deployment` instead                                  |
| `wire_vault`          | factory `wire_vault(vault_id, manager)`                                                                                                           | `get_deployment().wired` is true                                                   |
| `accept_admin`        | token `accept_admin_transfer()`, signed by the **admin**                                                                                          | `get_admin()` already equals the platform admin, or `NEKO_ADMIN_SECRET` is not set |
| `bind_compliance`     | compliance `bind_token(token, manager)`                                                                                                           | the "already bound" error                                                          |
| `bind_registry`       | identity registry `bind_token(token, manager)`                                                                                                    | the "already bound" error                                                          |
| `register_milestones` | tracker `register_vault(vault_id, token, issuer, titles, manager)`                                                                                | `VaultExists` (#1)                                                                 |

**Finishing:**

- On success: set `status = 'live'` and `launched_at`, and return the application view.
- On a failure: set `status = 'failed'` with `error = { step, message }`, and return the view with **200**. The Launchpad shows the step and offers "Resume launch", which calls the same endpoint again.
- The whole run is about 6 transactions, roughly 40 s. The Launchpad proxy allows 300 s.

### 6. Admin vault endpoints (`AdminAuthGuard`)

Each returns `{ tx_hash }` and is signed by the manager. Each looks up the application's live deployment first.

| Endpoint                                                                                                                   | Contract call                                                                |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST /v1/launchpad/admin/applications/:id/vault/close-funding`                                                            | vault `close_funding(manager)`                                               |
| `POST /v1/launchpad/admin/applications/:id/vault/release`                                                                  | vault `release(manager)`                                                     |
| `POST /v1/launchpad/admin/applications/:id/vault/milestones/:index/review` with body `{ approved: boolean, note: string }` | tracker `review_milestone(vault_id, index, approved, sha256(note), manager)` |

### 7. Investor identity on-chain (Neko Pro KYC)

Run this right after `InvestorsService.create` whitelists a wallet. Also expose `POST /v1/launchpad/investors/:wallet/onchain` (idempotent) for retries.

1. **Skip check:** if registry `stored_identity(wallet)` succeeds, skip. Otherwise:
2. **Deploy the identity** with `Operation.createCustomContract`:
   ```ts
   { address: manager, wasmHash: NEKO_IDENTITY_WASM_HASH, salt: sha256(wallet), constructorArgs: [Address(manager)] }
   ```
   The manager owns it.
3. **Add claims.** For topic `1` (KYC) and `2` (AML), sign a claim the way `contracts/tools/sign-claim/src/main.rs` does:
   ```ts
   const seed = Buffer.from(NEKO_CLAIM_SIGNING_KEY, "hex");
   const kp = Keypair.fromRawEd25519Seed(seed);
   const created = BigInt(Math.floor(Date.now() / 1000));
   const data = Buffer.concat([u64be(created), u64be(created + 365n * 86400n)]);
   const message = Buffer.concat([
     Buffer.from([1]),
     sha256(Networks.TESTNET),
     Address.fromString(CLAIM_ISSUER).toScVal().toXDR(),
     Address.fromString(identity).toScVal().toXDR(),
     u32be(topic),
     u32be(0 /* nonce */),
     data,
   ]);
   const signature = Buffer.concat([kp.rawPublicKey(), kp.sign(message)]);
   // identity.add_claim(topic, 101, CLAIM_ISSUER, signature, data, `${LAUNCHPAD_PUBLIC_URL}/claims/${wallet}/${topic}`)
   ```
   `add_claim` is signed by the manager, because the manager owns the identity.
4. **Register the wallet:** call registry `add_identity(wallet, identity, [countryData], manager)`. `countryData` is:
   ```ts
   map({
     country: vec([
       sym("Individual"),
       vec([sym("Residence"), u32(isoNumeric)]),
     ]),
     metadata: xdr.ScVal.scvVoid(),
   });
   ```
   `isoNumeric` comes from `verification.country` (alpha-2 to ISO 3166-1 numeric; CR is 188, MX 484, CO 170). Avoid 840 (US) under Reg S.
5. **Record it:** store `identity_contract` and `onchain_registered_at`. `GET /v1/launchpad/investors/:wallet` adds `onchain: boolean`.

### 8. Test USDC faucet

`POST /v1/launchpad/faucet/usdc` with body `{ address, amount }`:

- `amount` can be at most 10,000.
- Authenticate with a Privy bearer **or** the internal key, so Neko Pro can call it.
- Pays `USDC:NEKO_USDC_ISSUER` from `NEKO_USDC_ISSUER_SECRET`.
- Requires a trustline (409 `TRUSTLINE_MISSING`). Rate-limit it per address.
- Returns `{ tx_hash }`.
- The Launchpad uses it to top up interest before a repayment. Interest is earned off-chain.

### 9. Opportunities for Neko Pro

- `GET /v1/launchpad/opportunities` returns approved applications whose deployment is `live`, with these fields: `id, asset_name, asset_type, description, issuer_country, target_amount, min_target, min_ticket, expected_yield_pct, term_months, token_symbol, vault, token, vault_id, funding_deadline, milestones, offering_type, investor_countries`.
- Each response also carries a `platform` object with the addresses the backend derived: `{ usdc, usdc_code, usdc_issuer, milestone_tracker, identity_registry }`. Neko Pro takes the USDC asset for trustlines and the tracker from there, so the frontend needs no contract IDs in env.
- `GET /v1/launchpad/opportunities/:id` returns one of them. It is also the vault's `metadata_uri`.

### 10. Small fixes

- `adminDecide` always stores `reviewed_by = null`. Pass the admin's email from `AdminAuthGuard`.
- If any of these transactions go through the existing relay, add the factory, tracker and every new vault and token to `src/shared/stellar/allowlist/contract-allowlist.ts`.

## Neko Pro changes (neko-web-hackmeridian)

1. **Testnet for Pro.** The main app runs on mainnet, but every vault is on testnet. Give `/pro` its own config:
   - `NEXT_PUBLIC_PRO_STELLAR_RPC_URL=https://soroban-testnet.stellar.org`
   - testnet Horizon
   - `Networks.TESTNET`

   Sign Pro transactions with `Kit.signTransaction(xdr, { networkPassphrase: Networks.TESTNET, address })`. Tell users to switch their wallet to testnet.

2. **Real opportunities.**
   - Replace `PRO_OPPORTUNITIES` (`src/features/shared/pro/constants/opportunities.ts`) with `GET /v1/launchpad/opportunities`.
   - Fill `raisedUsd` from vault `raised()` and the status from `get_state()`; `Funding` before the deadline means "open".
   - Category map: `real_estate→real-estate`, `agriculture→agriculture`, `energy→energy`, `private_credit` and `invoices` to `private-credit`, and `other` to a new category.
   - `targetApy = expected_yield_pct`, `minInvestmentUsd = min_ticket`, `tokenSymbol = token_symbol`.
3. **Detail page `/pro/[id]`:**
   - terms
   - repayment schedule from vault `list_tranches` (paid or due)
   - milestones from tracker `list_milestones(vault_id)` and `approved_count`
   - raised against target and minimum, and the deadline
   - stellar.expert links for the vault and token
4. **Invest,** reusing `signAndSubmit` from `src/features/shared/vault/hooks/useVaultAction.ts`:
   1. Require `whitelisted && onchain` from `GET /v1/launchpad/investors/:wallet`. If only whitelisted, call the `/onchain` retry.
   2. If the wallet has no `USDC:<issuer>` trustline, have it sign a `changeTrust`.
   3. Offer "Get test USDC" through the faucet.
   4. Simulate `vault.invest(investor, amount)` with `amount = whole × 10^7` as i128, then sign and send.
   5. Before sending, check `min_ticket ≤ amount ≤ target − raised`, that the state is `Funding` and that the deadline has not passed.
   6. An unverified wallet fails inside the token's identity check.
5. **Positions:** for each vault the wallet holds, read:
   - token `balance(account)` (the RWA token names the argument `account`)
   - vault `claimable(investor)` and `exit_value(investor)`

   Actions:
   - **Redeem** when `Settled`
   - **Leave early** when `Active`. Show the fee; it fails with `InsufficientLiquidity` (#6) until enough has been repaid.
   - **Refund** when `Failed`

6. **Demo vaults.** The two script-launched vaults in `deployments/testnet.json` (`casa-heredia`, `finca-turrialba`) have no application behind them. Either leave them out or list them from factory `list_deployments(0, 50)` with static copy. `casa-heredia` is already settled.

## End-to-end check on testnet

1. **Issuer applies.** On the Launchpad, mock KYB, then submit an application with a minimum raise and three repayments.
2. **Admin approves.** The approve button stays disabled until the terms are complete.
3. **Issuer launches.** The asset shows **Approved · ready to launch**. Open it, choose **Launch to tokenize**, enter a symbol and a deadline, and sign the trustline. The asset turns **Live**.
4. **Check the explorer.** Factory `get_deployment(vault_id)` shows `wired: true`, and the token's admin is `accounts.admin`.
5. **Investor joins.** In Neko Pro, mock KYC; the wallet gets an identity on-chain. Get test USDC and invest. A wallet that was never verified is rejected.
6. **Admin releases.** Choose **Close funding**, then **Release**. The issuer's USDC balance rises by the raise.
7. **Milestones.** The issuer submits evidence for milestone 1, and the admin approves it.
8. **Repayment.** The issuer repays every tranche, topping up test USDC for the interest. The vault becomes **Settled**.
9. **Redeem.** The investor redeems principal plus interest.
