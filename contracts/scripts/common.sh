# Shared helpers for the Neko deploy scripts. Sourced, not run.

set -euo pipefail

NETWORK="${NETWORK:-testnet}"
CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$CONTRACTS_DIR/.." && pwd)"
WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"
DEPLOYMENTS="$REPO_ROOT/deployments/$NETWORK.json"

# The test USDC has 7 decimals, like every classic Stellar asset. The scripts
# talk in whole USDC and scale here, so the amounts a judge sees on the
# explorer are the amounts the story quotes.
DECIMALS=7
units() { printf '%s%0*d' "$1" "$DECIMALS" 0; }
# The other way, for anything shown to a reader. Strips the quotes the CLI puts
# around an i128.
human() { awk -v v="${1//\"/}" -v d="$DECIMALS" 'BEGIN { printf "%.2f", v / (10 ^ d) }'; }

# Progress goes to stderr so that `$(...)` around a helper captures only the
# value the helper is there to produce.
note() { printf '\n\033[1m==> %s\033[0m\n' "$*" >&2; }
info() { printf '    %s\n' "$*" >&2; }
die() { printf '\n\033[31merror: %s\033[0m\n' "$*" >&2; exit 1; }

require_tools() {
  for tool in stellar jq cargo; do
    command -v "$tool" >/dev/null || die "$tool is not installed"
  done
}

require_deployments() {
  [ -f "$DEPLOYMENTS" ] || die "no $DEPLOYMENTS — run deploy-shared.sh first"
}

# Read a dotted path out of the deployments file.
state() { jq -r "$1 // empty" "$DEPLOYMENTS"; }

# Merge a JSON fragment into the deployments file.
save() {
  local tmp
  tmp="$(mktemp)"
  jq ". * $1" "$DEPLOYMENTS" > "$tmp"
  mv "$tmp" "$DEPLOYMENTS"
}

# Create and fund a named key, reusing it when it already exists.
ensure_key() {
  local name="$1"
  if stellar keys address "$name" >/dev/null 2>&1; then
    info "key $name already exists"
  else
    stellar keys generate "$name" --network "$NETWORK" --fund >/dev/null
    info "key $name created and funded"
  fi
  stellar keys address "$name"
}

invoke() {
  stellar contract invoke --network "$NETWORK" "$@"
}
