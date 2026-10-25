#!/usr/bin/env bash
#
# Give a wallet a verified on-chain identity, so it can hold vault tokens.
#
# This is what a real KYC provider's integration ends up doing: deploy the
# investor's identity contract, add claims signed by a trusted issuer, and
# register the wallet with its country in the shared identity registry. The
# personal data stays off-chain; only hashes and the country code go on it.
#
#   ./scripts/onboard-investor.sh alice [country-code]
#
# The country is ISO 3166-1 numeric; 188 is Costa Rica. Note 840 (US) is the
# one to avoid under Reg S.

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_tools
require_deployments

NAME="${1:-}"
COUNTRY="${2:-188}"
[ -n "$NAME" ] || die "usage: $0 <investor-name> [iso-country-code]"

CLAIM_ISSUER=$(state '.shared.claim_issuer')
REGISTRY=$(state '.shared.identity_registry')
MANAGER=$(state '.accounts.manager')
USDC_CODE=$(state '.shared.usdc_code')
USDC_ISSUER=$(state '.shared.usdc_issuer')
SIGNING_SECRET=$(cat "$REPO_ROOT/deployments/.claim-signing-key-$NETWORK")

note "Wallet"
ADDRESS=$(ensure_key "$NAME")
info "$ADDRESS"

note "Identity contract"
IDENTITY=$(stellar contract deploy --wasm "$WASM_DIR/rwa_identity_example.wasm" \
  --source-account "$NAME" --network "$NETWORK" -- --owner "$ADDRESS")
info "$IDENTITY"

note "Signed claims"
for topic in 1 2; do
  OUTPUT=$(cargo run --quiet --manifest-path "$CONTRACTS_DIR/tools/sign-claim/Cargo.toml" -- \
    --secret-key "$SIGNING_SECRET" --claim-issuer "$CLAIM_ISSUER" \
    --identity "$IDENTITY" --claim-topic "$topic" --network "$NETWORK")
  DATA=$(awk '/^--data/ {print $2}' <<<"$OUTPUT")
  SIGNATURE=$(awk '/^--signature/ {print $2}' <<<"$OUTPUT")

  invoke --id "$IDENTITY" --source-account "$NAME" \
    -- add_claim --topic "$topic" --scheme 101 --issuer "$CLAIM_ISSUER" \
    --signature "$SIGNATURE" --data "$DATA" \
    --uri "https://neko.example/claims/$NAME/$topic" >/dev/null
  info "topic $topic signed and attached"
done

note "Registry"
# CountryData has to be hand-encoded: the CLI cannot infer the type behind a
# Vec<Val>. Individual / Residence / <ISO numeric code>.
PROFILE="[{\"map\":[{\"key\":{\"symbol\":\"country\"},\"val\":{\"vec\":[{\"symbol\":\"Individual\"},{\"vec\":[{\"symbol\":\"Residence\"},{\"u32\":$COUNTRY}]}]}},{\"key\":{\"symbol\":\"metadata\"},\"val\":\"void\"}]}]"
invoke --id "$REGISTRY" --source-account neko-manager \
  -- add_identity --account "$ADDRESS" --identity "$IDENTITY" \
  --initial_profiles "$PROFILE" --operator "$MANAGER" >/dev/null
info "registered, country $COUNTRY"

note "Funding with test USDC"
AMOUNT="${FUND_AMOUNT:-100000}"
# A classic asset needs a trustline before it can be received.
stellar tx new change-trust --network "$NETWORK" --source-account "$NAME" \
  --line "$USDC_CODE:$USDC_ISSUER" >/dev/null 2>&1 || true
stellar tx new payment --network "$NETWORK" --source-account neko-usdc-issuer \
  --destination "$ADDRESS" --asset "$USDC_CODE:$USDC_ISSUER" --amount "$(units "$AMOUNT")" >/dev/null
info "$AMOUNT $USDC_CODE"

save "$(jq -n --arg n "$NAME" --arg a "$ADDRESS" --arg i "$IDENTITY" --argjson c "$COUNTRY" \
  '{investors: {($n): {address: $a, identity: $i, country: $c}}}')"

note "Done"
info "$NAME can now hold any Neko vault token"
