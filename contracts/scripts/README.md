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

`deployments/<network>.json` records what the scripts last deployed. Two vaults
are in it: `casa-heredia`, which has been through the whole money path and sits
at `Settled`, and `finca-turrialba`, which is at `Funding` and is the one to
point `run-demo.sh` at.

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

Do not edit a script while it is running. Bash reads a script as it executes,
so a change part-way through gets picked up mid-run.
