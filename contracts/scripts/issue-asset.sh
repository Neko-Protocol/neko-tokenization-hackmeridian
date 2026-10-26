#!/usr/bin/env bash
#
# Issue a test asset the platform controls, and deploy its Stellar Asset
# Contract so a vault can be denominated in it.
#
#   ./scripts/issue-asset.sh USDT0
#
# On mainnet the same vault points at the real asset instead — USDT0 is
# USDT0:GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q there — and
# nothing about the contracts changes, only the address they are given.

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_tools
require_deployments

CODE="${1:-}"
[ -n "$CODE" ] || die "usage: $0 <ASSET-CODE>"

note "Issuer"
KEY="neko-$(echo "$CODE" | tr '[:upper:]' '[:lower:]')-issuer"
ISSUER=$(ensure_key "$KEY")
info "$ISSUER"

note "Stellar Asset Contract"
stellar contract asset deploy --asset "$CODE:$ISSUER" \
  --source-account neko-admin --network "$NETWORK" >/dev/null 2>&1 || true
SAC=$(stellar contract id asset --asset "$CODE:$ISSUER" --network "$NETWORK")
info "$SAC"

# The platform admin is the default fee recipient, so it has to be able to
# hold whatever a vault is denominated in.
stellar tx new change-trust --network "$NETWORK" --source-account neko-admin \
  --line "$CODE:$ISSUER" >/dev/null 2>&1 || true

save "$(jq -n --arg c "$CODE" --arg i "$ISSUER" --arg s "$SAC" --arg k "$KEY" \
  '{assets: {($c): {code: $c, issuer: $i, sac: $s, issuer_key: $k}}}')"

note "Done"
info "deploy a vault in it with:"
info "  ASSET_SAC=$SAC ASSET_CODE=$CODE ASSET_ISSUER=$ISSUER ./scripts/deploy-vault.sh <name>"
