# Deploy scripts

Four scripts that take a fresh network to a working demo. They read and write
`deployments/<network>.json`, so each one picks up where the last left off.

```bash
./deploy-shared.sh                 # the platform stack, once per network
./onboard-investor.sh alice        # a wallet with a verified on-chain identity
./onboard-investor.sh bob
./deploy-vault.sh casa-escazu      # one vault: its token, compliance and the vault
./run-demo.sh casa-escazu          # the whole money path, with explorer links
./print-env.sh                     # the addresses as environment variables
./gen-bindings.sh                  # the TypeScript clients the apps import

./issue-asset.sh USDT0             # a test asset the platform controls
./fund-asset.sh USDT0 alice 100000 # trustline plus a payout, for our own assets
```

`NETWORK=testnet` by default. Every script needs `stellar`, `jq`, `openssl` and
`cargo` on the path.

## What each one does

**`deploy-shared.sh`** builds the contracts, creates the `neko-admin` and
`neko-manager` keys, deploys a test USDC, and stands up the identity stack —
claim topics (KYC and AML are both required), a claim issuer with a signing key
of its own, the identity registry and the verifier. Then it uploads the token,
compliance and vault wasm as templates and deploys the factory and the
milestone tracker against them.

The claim signing key is generated here and kept in
`deployments/.claim-signing-key-<network>`, chmod 600 and gitignored — only its
public half goes into `deployments/<network>.json`. The key in
[`../rwa/DEPLOY.md`](../rwa/DEPLOY.md) is OpenZeppelin's public example key, all
zeroes, and must never be used for anything real.

**`onboard-investor.sh <name> [country]`** deploys the investor's identity
contract, signs a KYC and an AML claim with the platform's key, attaches both,
registers the wallet and its country in the shared registry, and funds it with
test USDC. The country is ISO 3166-1 numeric and defaults to 188, Costa Rica;
840 is the US, which Reg S says to keep out.

After this the wallet can hold any Neko vault token, which is the point of
keeping the identity stack shared.

**`deploy-vault.sh <name>`** has the factory deploy the vault's token, compliance
contract and vault, finishes the handover of the token's admin role to the
platform, binds the token to its compliance contract and to the shared
registry, and opens its milestones. Tunable:

```bash
TARGET=100000 MIN_TARGET=50000 RATE_BPS=1300 \
EXIT_FEE_BPS=500 MAX_EXIT_FEE_BPS=1000 \
TOKEN_NAME="Casa Escazu" TOKEN_SYMBOL=CASA \
./deploy-vault.sh casa-escazu
```

**`run-demo.sh <vault> [a] [b]`** walks the vault from the first deposit to the
final payout: both investors fund it, a wallet without KYC is turned away, the
raise goes to the borrower, the issuer reports a milestone and Neko approves it,
the borrower repays tranche by tranche, one investor leaves early and pays the
fee, and the one who stayed collects more than the headline rate.

The early exit waits until the second tranche on purpose. It is paid out of
what the borrower has already repaid, so the vault has to be holding at least
that investor's capital — with three roughly equal tranches and a 40% stake,
one tranche is not enough. The vault rejects it with `InsufficientLiquidity`
rather than paying out money it does not have, which is also what keeps the
redemption pool from ever going short.

**`gen-bindings.sh`** regenerates the typed clients in
[`packages/bindings`](../../packages/bindings) from the built wasm, and
normalises what the generator emits so a re-run reproduces what is committed.
Run it whenever a contract's interface changes. Also available as
`npm run contracts:bindings` from the repository root.

## What a vault is denominated in

A vault takes any SEP-41 token as its money, so `deploy-vault.sh` accepts the
asset through the environment:

```bash
ASSET_SAC=<contract address> ASSET_CODE=USDT0 ASSET_ISSUER=<G…> \
  ./deploy-vault.sh torre-sabana
```

Without those it falls back to the platform's test USDC. The asset is recorded
with the vault, so `run-demo.sh` funds and reads the right one.

**Test assets we issue.** `issue-asset.sh USDT0` creates an issuer, deploys the
Stellar Asset Contract and gives the platform admin a trustline, so we can mint
freely and the whole path runs. On mainnet the same vault points at the real
asset — USDT0 is `USDT0:GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q`
there — and nothing in the contracts changes, only the address they are given.

**Real assets.** Circle's testnet USDC is
`USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, SAC
`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`. A vault can be
denominated in it, but we do not hold the issuer key, so every account has to
be funded from [Circle's faucet](https://faucet.circle.com) — 20 USDC per
address every two hours. `run-demo.sh` checks the borrower's balance up front
and stops with the address to fund rather than failing halfway.

There is no canonical USDT0 on testnet: the ones in the asset list are
unrelated test issuances. That is why we issue our own.

## Amounts

The scripts talk in whole USDC and scale by the asset's seven decimals at the
call, so what a judge sees on the explorer is the amount the story quotes.
`TARGET=100000` really is a hundred thousand dollars on chain, not a hundred
thousand stroops. The contracts themselves are unit-agnostic: they move `i128`
amounts and never assume a decimal place.

## Trustlines

The test USDC is a classic Stellar asset, so every _account_ that receives it
needs a trustline first: the investors, the borrower who receives the raise,
and the fee recipient who receives early-exit fees. The scripts add these as
they go. Contracts need none — the vault holds USDC without one.

This is a property of classic assets, not of these contracts. A vault
denominated in a contract token would not need any of it.

## What is on testnet now

`deployments/<network>.json` lists the vaults worth looking at, which is not
the same as everything that exists: the factory's own registry is append-only,
so a vault that was abandoned part-way stays in it and is simply left out of
the file.

| Vault           | Asset                      | State                             |
| --------------- | -------------------------- | --------------------------------- |
| `torre-cartago` | our test USDT0             | `Settled` — the whole money path  |
| `casa-circle`   | Circle's real testnet USDC | `Funding` — waiting on the faucet |

Both of these name their asset explicitly, which is the shape to copy. The
vaults from before the asset became configurable are gone from the file: they
ran on the platform's test USDC against an earlier token template, so quoting
them would be quoting a build that is no longer what the factory deploys.

That leaves `casa-circle` as the only vault at `Funding`, and it cannot move
until the three addresses are funded from Circle's faucet. For a run that
depends on nobody else, issue a fresh vault on our own USDT0 — we hold that
issuer, so `run-demo.sh` can mint every amount it needs:

```bash
ASSET_SAC=$(jq -r '.assets.USDT0.sac' ../../deployments/testnet.json) \
ASSET_CODE=USDT0 ASSET_ISSUER=$(jq -r '.assets.USDT0.issuer' ../../deployments/testnet.json) \
TOKEN_SYMBOL=TORRE2 ./deploy-vault.sh torre-sabana
```

Nothing enforces that two vaults have different token symbols — neither the
factory nor the token checks it. For the contracts that is harmless, since each
token is its own address, but a list in Neko Pro showing the same symbol twice
is ambiguous, so the Launchpad form is the place to validate it.

## Re-running

`deploy-shared.sh` is not idempotent: run it again and you get a fresh platform
with new addresses, and investors have to be onboarded into the new registry.
Delete `deployments/<network>.json` first if that is what you want.

The other three are meant to be run repeatedly, one vault name at a time.
`run-demo.sh` drives a vault from `Funding` to `Settled` in one pass, so it has
to start from a vault nobody has invested in yet; give `deploy-vault.sh` a new
name to get one.

A run that stops part-way still spent the investors' money into that vault, so
top them up with `fund-asset.sh` before starting another one — otherwise the
next `invest` fails with the asset contract's "resulting balance is not within
the allowed range".

Do not edit a script while it is running. Bash reads a script as it executes,
so a change part-way through gets picked up mid-run.
