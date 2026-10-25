#!/usr/bin/env bash
#
# Launch one vault: the factory deploys its token, compliance contract and
# vault, the token is wired up, and the milestone tracker opens its record.
#
#   ./scripts/deploy-vault.sh casa-escazu
#
# Tune the vault with environment variables:
#   TARGET=100000 RATE_BPS=1300 MIN_TARGET=50000 EXIT_FEE_BPS=500 \
#   ./scripts/deploy-vault.sh casa-escazu

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_tools
require_deployments

VAULT_NAME="${1:-}"
[ -n "$VAULT_NAME" ] || die "usage: $0 <vault-name>"

TOKEN_NAME="${TOKEN_NAME:-Casa Escazu}"
TOKEN_SYMBOL="${TOKEN_SYMBOL:-CASA}"
TARGET="${TARGET:-100000}"
MIN_TARGET="${MIN_TARGET:-50000}"
RATE_BPS="${RATE_BPS:-1300}"
EXIT_FEE_BPS="${EXIT_FEE_BPS:-500}"
MAX_EXIT_FEE_BPS="${MAX_EXIT_FEE_BPS:-1000}"

# The vault compares against a fixed total, so the rate is applied here, once.
EXPECTED_REPAYMENT=$(( TARGET + TARGET * RATE_BPS / 10000 ))

FACTORY=$(state '.shared.factory')
TRACKER=$(state '.shared.milestone_tracker')
REGISTRY=$(state '.shared.identity_registry')
USDC=$(state '.shared.usdc')
ADMIN=$(state '.accounts.admin')
MANAGER=$(state '.accounts.manager')

note "Borrower"
BORROWER=$(ensure_key "$VAULT_NAME-borrower")
# A classic asset needs a trustline before the account can receive it, and the
# borrower receives the whole raise.
USDC_CODE=$(state '.shared.usdc_code')
USDC_ISSUER=$(state '.shared.usdc_issuer')
stellar tx new change-trust --network "$NETWORK" --source-account "$VAULT_NAME-borrower" \
  --line "$USDC_CODE:$USDC_ISSUER" >/dev/null 2>&1 || true
info "$BORROWER"

# A deterministic 32-byte id, so the vault's three contract addresses can be
# worked out from its name alone.
VAULT_ID=$(printf '%s' "$VAULT_NAME" | shasum -a 256 | cut -c1-64)
info "vault id $VAULT_ID"

note "Vault"
info "raising $TARGET USDC at ${RATE_BPS} bps; repays $EXPECTED_REPAYMENT"
info "minimum $MIN_TARGET; exit fee ${EXIT_FEE_BPS} bps, capped at ${MAX_EXIT_FEE_BPS}"

# A year from now, so the demo never trips over the funding deadline.
DEADLINE=$(( $(date +%s) + 31536000 ))

# One tranche per third of the repayment, the last one taking the remainder.
T1=$(( EXPECTED_REPAYMENT / 3 ))
T2=$T1
T3=$(( EXPECTED_REPAYMENT - T1 - T2 ))

# i128 fields go as strings, u64 fields as numbers — that is what the CLI's
# type parser expects. The factory fills in the token address itself.
TERMS="{\"usdc\":\"$USDC\",\"borrower\":\"$BORROWER\",\"target\":\"$(units "$TARGET")\",\"min_target\":\"$(units "$MIN_TARGET")\",\"expected_repayment\":\"$(units "$EXPECTED_REPAYMENT")\",\"funding_deadline\":$DEADLINE,\"exit_fee_bps\":$EXIT_FEE_BPS,\"max_exit_fee_bps\":$MAX_EXIT_FEE_BPS,\"fee_recipient\":\"$ADMIN\"}"
TRANCHES="[{\"expected_amount\":\"$(units "$T1")\",\"due_date\":$(( DEADLINE + 2592000 ))},{\"expected_amount\":\"$(units "$T2")\",\"due_date\":$(( DEADLINE + 5184000 ))},{\"expected_amount\":\"$(units "$T3")\",\"due_date\":$(( DEADLINE + 7776000 ))}]"

METADATA_HASH=$(printf '%s' "$VAULT_NAME-prospectus" | shasum -a 256 | cut -c1-64)

note "create_vault"
invoke --id "$FACTORY" --source-account neko-manager \
  -- create_vault \
  --request "{\"vault_id\":\"$VAULT_ID\",\"issuer\":\"$BORROWER\",\"name\":\"$TOKEN_NAME\",\"symbol\":\"$TOKEN_SYMBOL\",\"metadata_hash\":\"$METADATA_HASH\",\"metadata_uri\":\"https://neko.example/vaults/$VAULT_NAME\"}" \
  --terms "$TERMS" --tranches "$TRANCHES" \
  --operator "$MANAGER" >/dev/null

DEPLOYMENT_JSON=$(invoke --id "$FACTORY" --source-account neko-manager \
  -- get_deployment --vault_id "$VAULT_ID")
TOKEN=$(jq -r '.token' <<<"$DEPLOYMENT_JSON")
COMPLIANCE=$(jq -r '.compliance' <<<"$DEPLOYMENT_JSON")
VAULT=$(jq -r '.vault' <<<"$DEPLOYMENT_JSON")
info "token      $TOKEN"
info "compliance $COMPLIANCE"
info "vault      $VAULT"

note "wire_vault"
invoke --id "$FACTORY" --source-account neko-manager \
  -- wire_vault --vault_id "$VAULT_ID" --operator "$MANAGER" >/dev/null
info "vault can mint and burn"

# The handover of the token's admin role is two-step on purpose, so a wrong
# address cannot strand the token. The platform accepts it here.
invoke --id "$TOKEN" --source-account neko-admin -- accept_admin_transfer >/dev/null
info "token administration handed from the factory to the platform"

# Both binds belong to the platform manager, which already holds the role. The
# identity registry in particular has no AccessControl, so its manager role can
# never be transferred to the factory in the first place.
invoke --id "$COMPLIANCE" --source-account neko-manager \
  -- bind_token --token "$TOKEN" --operator "$MANAGER" >/dev/null
invoke --id "$REGISTRY" --source-account neko-manager \
  -- bind_token --token "$TOKEN" --operator "$MANAGER" >/dev/null
info "token bound to its compliance contract and to the shared identity registry"

note "Milestones"
invoke --id "$TRACKER" --source-account neko-manager \
  -- register_vault --vault_id "$VAULT_ID" --token "$TOKEN" --issuer "$BORROWER" \
  --titles '["Permits granted","Structure complete","Handover"]' \
  --operator "$MANAGER" >/dev/null
info "3 milestones opened, all pending"

save "$(jq -n --arg n "$VAULT_NAME" --arg id "$VAULT_ID" --arg t "$TOKEN" \
  --arg c "$COMPLIANCE" --arg v "$VAULT" --arg b "$BORROWER" \
  --argjson target "$TARGET" --argjson repay "$EXPECTED_REPAYMENT" \
  '{vaults: {($n): {vault_id: $id, token: $t, compliance: $c, vault: $v,
                   borrower: $b, target: $target, expected_repayment: $repay}}}')"

note "Done"
EXPLORER="https://stellar.expert/explorer/$NETWORK/contract"
info "token  $EXPLORER/$TOKEN"
info "vault  $EXPLORER/$VAULT"
info "next: ./scripts/run-demo.sh $VAULT_NAME"
