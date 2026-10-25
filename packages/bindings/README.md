# Contract bindings

Typed TypeScript clients for the contracts the apps talk to, generated from the
built wasm so the types cannot drift from what is deployed.

| Package                                         | Contract            | What the front end does with it                                         |
| ----------------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| `@neko-tokenization/vault-bindings`             | `vault`             | Invest, redeem, early exit, read the state and the tranche schedule     |
| `@neko-tokenization/factory-bindings`           | `factory`           | List the vaults for the opportunities shelf, read one vault's addresses |
| `@neko-tokenization/milestone-tracker-bindings` | `milestone-tracker` | Show an issuer's progress, submit evidence                              |
| `@neko-tokenization/token-bindings`             | `token`             | An investor's balance, the token's name and symbol, frozen amounts      |

## Using one

Add it to the app's dependencies, then:

```ts
import { Client as VaultClient } from "@neko-tokenization/vault-bindings";
import {
  getNetworkConfig,
  getSharedContracts,
} from "@neko-tokenization/stellar";

const { rpcUrl, passphrase } = getNetworkConfig();

const vault = new VaultClient({
  contractId: vaultAddress,
  rpcUrl,
  networkPassphrase: passphrase,
});

// Reads simulate and come back straight away.
const { result: state } = await vault.get_state();

// Writes return an AssembledTransaction to sign and send with the wallet.
const tx = await vault.invest({ investor, amount });
```

Addresses come from `@neko-tokenization/stellar`, which reads them from the
environment; `contracts/scripts/print-env.sh` produces that block from
`deployments/<network>.json`.

Amounts are `i128` and arrive as `bigint`, in the asset's smallest unit — the
test USDC has seven decimals, so a hundred thousand dollars is
`1000000000000n`.

## Regenerating

```bash
npm run contracts:bindings
```

That rebuilds the wasm and regenerates all four packages, so **nothing here
should be edited by hand** — the next run would undo it. The script also
normalises what the generator emits: it names each package, adds the
`typecheck` script the workspace expects, and replaces the generator's
tsconfig with the one the rest of the workspace uses, so re-running it
reproduces exactly what is committed.

Regenerate whenever a contract's interface changes. The types are built from
the wasm, so a stale binding is a compile error rather than a surprise at
runtime.

## A note on `dist/`

These packages compile to `dist/`, which is gitignored, so a fresh clone needs
one `npm run build` at the repository root before an app can import them.
Turbo builds them as part of that.
