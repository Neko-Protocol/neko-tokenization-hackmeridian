#!/usr/bin/env bash
#
# Regenerate the TypeScript clients the apps import, from the built wasm.
#
#   ./scripts/gen-bindings.sh
#
# `stellar contract bindings typescript` emits a whole npm package per
# contract, with a generic name and its own tsconfig full of commented-out
# boilerplate. This normalises that output to the workspace's conventions, so
# re-running the command reproduces exactly what is committed instead of
# undoing hand edits.

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_tools

OUT="$REPO_ROOT/packages/bindings"

# wasm:directory:package name:one-line description
CONTRACTS=(
  "neko_vault:vault:@neko-tokenization/vault-bindings:Typed client for the Neko vault: invest, redeem, early exit and the tranche schedule."
  "neko_factory:factory:@neko-tokenization/factory-bindings:Typed client for the Neko factory: launch a vault and read the on-chain registry."
  "neko_milestone_tracker:milestone-tracker:@neko-tokenization/milestone-tracker-bindings:Typed client for the Neko milestone tracker: submit evidence and read progress."
  "rwa_token_example:token:@neko-tokenization/token-bindings:Typed client for the SEP-57 vault token: balances, freezing, forced transfers and recovery."
)

note "Building contracts"
(cd "$CONTRACTS_DIR" && stellar contract build >/dev/null)

note "Generating"
mkdir -p "$OUT"
for entry in "${CONTRACTS[@]}"; do
  IFS=':' read -r wasm dir name desc <<<"$entry"
  stellar contract bindings typescript \
    --wasm "$WASM_DIR/$wasm.wasm" --output-dir "$OUT/$dir" --overwrite >/dev/null

  # The generator names the package after the output directory and gives it no
  # typecheck script, so the workspace would skip it.
  jq --arg n "$name" --arg d "$desc" '
    .name = $n | .version = "0.1.0" | .description = $d | .private = true
    | .scripts = {build: "tsc", dev: "tsc --watch", typecheck: "tsc --noEmit"}
  ' "$OUT/$dir/package.json" > "$OUT/$dir/package.json.tmp"
  mv "$OUT/$dir/package.json.tmp" "$OUT/$dir/package.json"

  # Match packages/stellar rather than the generator's boilerplate. Bundler
  # resolution is what the Next.js apps use.
  cat > "$OUT/$dir/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
JSON

  # The generator ignores out/, but the build writes to dist/.
  printf 'node_modules/\ndist/\n' > "$OUT/$dir/.gitignore"

  info "$name"
done

# Format the generated sources, so `npm run format:check` stays green and a
# diff here reads as an interface change rather than a reflow.
note "Formatting"
(cd "$REPO_ROOT" && npx --yes prettier --write "packages/bindings/*/src/*.ts" >/dev/null)

note "Done"
info "run npm install at the repository root to link them"
