#!/usr/bin/env bash
#
# Walk a vault from first deposit to final payout, printing an explorer link for
# every step. This is the path a judge can follow on their own.
#
#   ./scripts/run-demo.sh casa-escazu alice bob
#
# Both investors must have been onboarded first. `alice` stays to maturity;
# `bob` leaves early and pays the exit fee, which is what shows that the
# holders who stay end up with more than their headline rate.

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_tools
require_deployments

VAULT_NAME="${1:-}"
A="${2:-alice}"
B="${3:-bob}"
[ -n "$VAULT_NAME" ] || die "usage: $0 <vault-name> [investor-a] [investor-b]"

VAULT=$(state ".vaults.\"$VAULT_NAME\".vault")
TOKEN=$(state ".vaults.\"$VAULT_NAME\".token")
VAULT_ID=$(state ".vaults.\"$VAULT_NAME\".vault_id")
BORROWER_ADDR=$(state ".vaults.\"$VAULT_NAME\".borrower")
TARGET=$(state ".vaults.\"$VAULT_NAME\".target")
EXPECTED=$(state ".vaults.\"$VAULT_NAME\".expected_repayment")
TRACKER=$(state '.shared.milestone_tracker')
USDC=$(state ".vaults[\"$VAULT_NAME\"].asset.sac")
[ -n "$USDC" ] || USDC=$(state '.shared.usdc')
MANAGER=$(state '.accounts.manager')
ISSUER_KEY=$(state ".assets[\"$(state ".vaults[\"$VAULT_NAME\"].asset.code")\"].issuer_key")
[ -n "$ISSUER_KEY" ] || ISSUER_KEY=neko-usdc-issuer
USDC_CODE=$(state ".vaults[\"$VAULT_NAME\"].asset.code")
USDC_ISSUER=$(state ".vaults[\"$VAULT_NAME\"].asset.issuer")
[ -n "$USDC_CODE" ] || USDC_CODE=$(state '.shared.usdc_code')
[ -n "$USDC_ISSUER" ] || USDC_ISSUER=$(state '.shared.usdc_issuer')
[ -n "$VAULT" ] || die "unknown vault $VAULT_NAME — run deploy-vault.sh first"

A_ADDR=$(state ".investors.\"$A\".address")
B_ADDR=$(state ".investors.\"$B\".address")
[ -n "$A_ADDR" ] && [ -n "$B_ADDR" ] || die "onboard $A and $B first"

A_AMOUNT=$(( TARGET * 60 / 100 ))
B_AMOUNT=$(( TARGET - A_AMOUNT ))

# The RWA token names the argument `account`; the Stellar Asset Contract that
# backs a classic asset names it `id`.
tokens() { invoke --id "$TOKEN" --source-account neko-manager -- balance --account "$1"; }
usdc() { invoke --id "$USDC" --source-account neko-manager -- balance --id "$1"; }

note "1. Funding"
invoke --id "$VAULT" --source-account "$A" -- invest --investor "$A_ADDR" --amount "$(units "$A_AMOUNT")" >/dev/null
info "$A invested $A_AMOUNT and holds $(human "$(tokens "$A_ADDR")") tokens"
invoke --id "$VAULT" --source-account "$B" -- invest --investor "$B_ADDR" --amount "$(units "$B_AMOUNT")" >/dev/null
info "$B invested $B_AMOUNT and holds $(human "$(tokens "$B_ADDR")") tokens"

note "2. A wallet without KYC is turned away"
STRANGER=$(ensure_key "$VAULT_NAME-stranger")
# Fund it properly first. Otherwise the call would fail for want of funds and
# prove nothing about the identity check.
stellar tx new change-trust --network "$NETWORK" --source-account "$VAULT_NAME-stranger" \
  --line "$USDC_CODE:$USDC_ISSUER" >/dev/null 2>&1 || true
stellar tx new payment --network "$NETWORK" --source-account "$ISSUER_KEY" \
  --destination "$STRANGER" --asset "$USDC_CODE:$USDC_ISSUER" --amount "$(units 10)" >/dev/null
info "funded with 10 $USDC_CODE, but never onboarded"

if invoke --id "$VAULT" --source-account "$VAULT_NAME-stranger" \
     -- invest --investor "$STRANGER" --amount "$(units 10)" >/dev/null 2>&1; then
  die "an unverified wallet was allowed in — the identity check is not wired up"
fi
info "rejected: it has the money and no verified identity, which is the point"

note "3. Closing and releasing"
invoke --id "$VAULT" --source-account neko-manager -- close_funding --operator "$MANAGER" >/dev/null
invoke --id "$VAULT" --source-account neko-manager -- release --operator "$MANAGER" >/dev/null
info "state $(invoke --id "$VAULT" --source-account neko-manager -- get_state)"

note "4. The issuer reports progress"
EVIDENCE=$(printf '%s' "$VAULT_NAME-phase-1" | shasum -a 256 | cut -c1-64)
invoke --id "$TRACKER" --source-account "$VAULT_NAME-borrower" \
  -- submit_milestone --vault_id "$VAULT_ID" --index 0 \
  --evidence_hash "$EVIDENCE" --evidence_uri "https://neko.example/evidence/$VAULT_NAME/1" >/dev/null
invoke --id "$TRACKER" --source-account neko-manager \
  -- review_milestone --vault_id "$VAULT_ID" --index 0 --approved true \
  --note_hash "$EVIDENCE" --operator "$MANAGER" >/dev/null
info "milestone 1 approved; $(invoke --id "$TRACKER" --source-account neko-manager -- approved_count --vault_id "$VAULT_ID") of 3 done"

note "5. Repaying, tranche by tranche"
# The interest is earned off-chain, so the borrower has to hold it before it
# can repay more than the raise. We can mint it only for the platform's own
# test asset; for a real one the borrower has to be funded beforehand.
INTEREST=$(( EXPECTED - TARGET ))
if stellar keys address "$ISSUER_KEY" >/dev/null 2>&1 \
   && [ "$(stellar keys address "$ISSUER_KEY")" = "$USDC_ISSUER" ]; then
  stellar tx new payment --network "$NETWORK" --source-account "$ISSUER_KEY" \
    --destination "$BORROWER_ADDR" --asset "$USDC_CODE:$USDC_ISSUER" \
    --amount "$(units "$INTEREST")" >/dev/null 2>&1 || true
  info "borrower topped up with $INTEREST $USDC_CODE of interest"
else
  HELD=$(human "$(usdc "$BORROWER_ADDR")")
  info "borrower holds $HELD $USDC_CODE; it needs $INTEREST for the interest"
  awk -v h="$HELD" -v n="$INTEREST" 'BEGIN { exit (h >= n) ? 0 : 1 }' \
    || die "fund $BORROWER_ADDR with at least $INTEREST $USDC_CODE first — we do not control this issuer"
fi

for index in 0 1 2; do
  AMOUNT=$(invoke --id "$VAULT" --source-account neko-manager -- get_tranche --index "$index" | jq -r '.expected_amount')
  invoke --id "$VAULT" --source-account "$VAULT_NAME-borrower" \
    -- repay --tranche_index "$index" --amount "$AMOUNT" \
    --evidence_uri "https://neko.example/receipts/$VAULT_NAME/$index" >/dev/null
  info "tranche $index paid: $(human "$AMOUNT")"

  # An early exit is paid out of what the borrower has already repaid, so it
  # can only happen once the vault holds at least B's capital. With three
  # roughly equal tranches that is after the second.
  if [ "$index" = "1" ]; then
    note "6. $B leaves early"
    info "the vault holds $(human "$(usdc "$VAULT")") $USDC_CODE; $B put in $B_AMOUNT"
    info "would collect $(human "$(invoke --id "$VAULT" --source-account neko-manager -- exit_value --investor "$B_ADDR")") after the fee"
    invoke --id "$VAULT" --source-account "$B" -- early_exit --investor "$B_ADDR" >/dev/null
    info "$B out, tokens burned; supply is now $(human "$(invoke --id "$TOKEN" --source-account neko-manager -- total_supply)")"
    note "5. Repaying, continued"
  fi
done

info "state $(invoke --id "$VAULT" --source-account neko-manager -- get_state)"

note "7. $A collects"
info "claimable $(human "$(invoke --id "$VAULT" --source-account neko-manager -- claimable --investor "$A_ADDR")")"
invoke --id "$VAULT" --source-account "$A" -- redeem --investor "$A_ADDR" >/dev/null
info "$A put in $A_AMOUNT and now holds $(human "$(usdc "$A_ADDR")") $USDC_CODE"
info "tokens left outstanding: $(human "$(invoke --id "$TOKEN" --source-account neko-manager -- total_supply)")"

note "Follow it on the explorer"
EXPLORER="https://stellar.expert/explorer/$NETWORK/contract"
info "vault   $EXPLORER/$VAULT"
info "token   $EXPLORER/$TOKEN"
info "tracker $EXPLORER/$TRACKER"
