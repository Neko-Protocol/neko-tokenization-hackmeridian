#!/usr/bin/env bash
#
# Deploy the Neko platform stack: the shared SEP-57 identity contracts, a test
# USDC, and the factory and milestone tracker. Run this once per network.
#
# Everything here is shared by every vault, which is the point — an investor
# passes KYC once and can then take part in any of them.
#
#   NETWORK=testnet ./scripts/deploy-shared.sh

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_tools

note "Building contracts"
(cd "$CONTRACTS_DIR" && stellar contract build >/dev/null)
info "wasm in $WASM_DIR"

note "Keys"
ADMIN=$(ensure_key neko-admin)
MANAGER=$(ensure_key neko-manager)
ISSUER_KEY=$(ensure_key neko-usdc-issuer)
info "admin   $ADMIN"
info "manager $MANAGER"

mkdir -p "$(dirname "$DEPLOYMENTS")"
[ -f "$DEPLOYMENTS" ] || echo '{}' > "$DEPLOYMENTS"
save "$(jq -n --arg n "$NETWORK" --arg a "$ADMIN" --arg m "$MANAGER" \
  '{network: $n, accounts: {admin: $a, manager: $m}}')"

note "Test USDC"
# The demo needs a stablecoin the scripts can mint. On mainnet this is replaced
# by the real USDC contract id and nothing else changes.
USDC_CODE="${USDC_CODE:-USDC}"
stellar contract asset deploy --asset "$USDC_CODE:$ISSUER_KEY" \
  --source-account neko-admin --network "$NETWORK" >/dev/null 2>&1 || true
USDC=$(stellar contract id asset --asset "$USDC_CODE:$ISSUER_KEY" --network "$NETWORK")
# The admin is the default fee recipient, so it has to be able to hold the asset.
stellar tx new change-trust --network "$NETWORK" --source-account neko-admin \
  --line "$USDC_CODE:$ISSUER_KEY" >/dev/null 2>&1 || true
info "usdc $USDC"

note "Claim topics and issuers"
TOPICS=$(stellar contract deploy --wasm "$WASM_DIR/rwa_claim_topics_and_issuers_example.wasm" \
  --source-account neko-admin --network "$NETWORK" \
  -- --admin "$ADMIN" --manager "$MANAGER")
info "$TOPICS"

# 1 = KYC, 2 = AML. Both are required of every holder.
for topic in 1 2; do
  invoke --id "$TOPICS" --source-account neko-manager \
    -- add_claim_topic --claim_topic "$topic" --operator "$MANAGER" >/dev/null
done
info "topics 1 (KYC) and 2 (AML) required"

note "Claim issuer"
CLAIM_ISSUER=$(stellar contract deploy --wasm "$WASM_DIR/rwa_claim_issuer_example.wasm" \
  --source-account neko-admin --network "$NETWORK" \
  -- --owner "$ADMIN")
info "$CLAIM_ISSUER"

# A signing key of our own. The one in DEPLOY.md is OpenZeppelin's public
# example key and must never be used for anything real.
KEY_FILE="$REPO_ROOT/deployments/.claim-signing-key-$NETWORK"
if [ -f "$KEY_FILE" ]; then
  SIGNING_SECRET=$(cat "$KEY_FILE")
  info "reusing the existing claim signing key"
else
  SIGNING_SECRET=$(openssl rand -hex 32)
  printf '%s' "$SIGNING_SECRET" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  info "generated a claim signing key in $KEY_FILE"
fi

SIGNING_PUBLIC=$(cargo run --quiet --manifest-path "$CONTRACTS_DIR/tools/sign-claim/Cargo.toml" -- \
  --secret-key "$SIGNING_SECRET" --claim-issuer "$CLAIM_ISSUER" --identity "$CLAIM_ISSUER" \
  --claim-topic 1 --network "$NETWORK" | awk '/--public-key/ {print $2}')

invoke --id "$TOPICS" --source-account neko-manager \
  -- add_trusted_issuer --trusted_issuer "$CLAIM_ISSUER" \
  --claim_topics '[1, 2]' --operator "$MANAGER" >/dev/null

for topic in 1 2; do
  invoke --id "$CLAIM_ISSUER" --source-account neko-admin \
    -- allow_key --public_key "$SIGNING_PUBLIC" --registry "$TOPICS" --claim_topic "$topic" >/dev/null
done
info "signing key authorised for topics 1 and 2"

note "Identity registry"
REGISTRY=$(stellar contract deploy --wasm "$WASM_DIR/rwa_identity_registry_example.wasm" \
  --source-account neko-admin --network "$NETWORK" \
  -- --admin "$ADMIN" --manager "$MANAGER")
info "$REGISTRY"

note "Identity verifier"
VERIFIER=$(stellar contract deploy --wasm "$WASM_DIR/rwa_identity_verifier_example.wasm" \
  --source-account neko-admin --network "$NETWORK" \
  -- --admin "$ADMIN" --manager "$MANAGER" \
  --identity_registry_storage "$REGISTRY" --claim_topics_and_issuers "$TOPICS")
info "$VERIFIER"

note "Contract templates"
TOKEN_HASH=$(stellar contract upload --wasm "$WASM_DIR/rwa_token_example.wasm" \
  --source-account neko-admin --network "$NETWORK")
COMPLIANCE_HASH=$(stellar contract upload --wasm "$WASM_DIR/rwa_compliance_example.wasm" \
  --source-account neko-admin --network "$NETWORK")
VAULT_HASH=$(stellar contract upload --wasm "$WASM_DIR/neko_vault.wasm" \
  --source-account neko-admin --network "$NETWORK")
info "token      $TOKEN_HASH"
info "compliance $COMPLIANCE_HASH"
info "vault      $VAULT_HASH"

note "Factory"
FACTORY=$(stellar contract deploy --wasm "$WASM_DIR/neko_factory.wasm" \
  --source-account neko-admin --network "$NETWORK" \
  -- --admin "$ADMIN" --manager "$MANAGER" \
  --templates "{\"token_wasm_hash\":\"$TOKEN_HASH\",\"compliance_wasm_hash\":\"$COMPLIANCE_HASH\",\"vault_wasm_hash\":\"$VAULT_HASH\",\"identity_verifier\":\"$VERIFIER\",\"identity_registry\":\"$REGISTRY\",\"platform_admin\":\"$ADMIN\",\"platform_manager\":\"$MANAGER\"}")
info "$FACTORY"

note "Milestone tracker"
TRACKER=$(stellar contract deploy --wasm "$WASM_DIR/neko_milestone_tracker.wasm" \
  --source-account neko-admin --network "$NETWORK" \
  -- --admin "$ADMIN" --manager "$MANAGER")
info "$TRACKER"

save "$(jq -n \
  --arg usdc "$USDC" --arg usdc_issuer "$ISSUER_KEY" --arg usdc_code "$USDC_CODE" \
  --arg topics "$TOPICS" --arg claim_issuer "$CLAIM_ISSUER" \
  --arg signing_public "$SIGNING_PUBLIC" \
  --arg registry "$REGISTRY" --arg verifier "$VERIFIER" \
  --arg factory "$FACTORY" --arg tracker "$TRACKER" \
  --arg token_hash "$TOKEN_HASH" --arg compliance_hash "$COMPLIANCE_HASH" \
  --arg vault_hash "$VAULT_HASH" \
  '{
     shared: {
       usdc: $usdc, usdc_issuer: $usdc_issuer, usdc_code: $usdc_code,
       claim_topics_and_issuers: $topics, claim_issuer: $claim_issuer,
       claim_signing_public_key: $signing_public,
       identity_registry: $registry, identity_verifier: $verifier,
       factory: $factory, milestone_tracker: $tracker
     },
     wasm_hashes: {
       token: $token_hash, compliance: $compliance_hash, vault: $vault_hash
     },
     vaults: {}
   }')"

note "Done"
info "addresses written to $DEPLOYMENTS"
info "next: ./scripts/onboard-investor.sh <name>  and  ./scripts/deploy-vault.sh <vault-name>"
