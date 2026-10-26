#!/usr/bin/env bash
#
# Add the trustline and pay out a test asset the platform issues.
#
#   ./scripts/fund-asset.sh USDT0 alice 100000
#
# Only works for assets from issue-asset.sh, where we hold the issuer key. For
# a real asset like Circle's testnet USDC, use their faucet instead.

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_tools
require_deployments

CODE="${1:-}"; WHO="${2:-}"; AMOUNT="${3:-100000}"
[ -n "$CODE" ] && [ -n "$WHO" ] || die "usage: $0 <ASSET-CODE> <key-name> [amount]"

ISSUER=$(state ".assets[\"$CODE\"].issuer")
ISSUER_KEY=$(state ".assets[\"$CODE\"].issuer_key")
[ -n "$ISSUER" ] || die "$CODE was not issued by us — run issue-asset.sh $CODE, or use the asset's own faucet"

ADDRESS=$(stellar keys address "$WHO" 2>/dev/null) || die "no key called $WHO"

stellar tx new change-trust --network "$NETWORK" --source-account "$WHO" \
  --line "$CODE:$ISSUER" >/dev/null 2>&1 || true
stellar tx new payment --network "$NETWORK" --source-account "$ISSUER_KEY" \
  --destination "$ADDRESS" --asset "$CODE:$ISSUER" --amount "$(units "$AMOUNT")" >/dev/null

info "$WHO now holds $AMOUNT $CODE"
