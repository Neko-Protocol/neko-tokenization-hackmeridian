#!/usr/bin/env bash
#
# Give an existing wallet (one we don't hold the key for, like a Freighter
# wallet that passed KYC in Neko Web) a verified on-chain identity, so it can
# hold vault tokens.
#
# Same steps as onboard-investor.sh, except the identity contract is owned by
# the manager, acting as the KYC provider: the claims are attached without the
# investor's signature. No funding, the wallet brings its own asset.
#
#   ./scripts/onboard-wallet.sh G... [country-code]
#
# The country is ISO 3166-1 numeric; 188 is Costa Rica. Note 840 (US) is the
# one to avoid under Reg S.

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_tools
require_deployments

ADDRESS="${1:-}"
COUNTRY="${2:-188}"
[[ "$ADDRESS" =~ ^G[A-Z2-7]{55}$ ]] || die "usage: $0 <G-address> [iso-country-code]"

CLAIM_ISSUER=$(state '.shared.claim_issuer')
REGISTRY=$(state '.shared.identity_registry')
MANAGER=$(state '.accounts.manager')
SIGNING_SECRET=$(cat "$REPO_ROOT/deployments/.claim-signing-key-$NETWORK")

note "Identity contract"
IDENTITY=$(stellar contract deploy --wasm "$WASM_DIR/rwa_identity_example.wasm" \
  --source-account neko-manager --network "$NETWORK" -- --owner "$MANAGER")
info "$IDENTITY"

note "Signed claims"
for topic in 1 2; do
  OUTPUT=$(cargo run --quiet --manifest-path "$CONTRACTS_DIR/tools/sign-claim/Cargo.toml" -- \
    --secret-key "$SIGNING_SECRET" --claim-issuer "$CLAIM_ISSUER" \
    --identity "$IDENTITY" --claim-topic "$topic" --network "$NETWORK")
  DATA=$(awk '/^--data/ {print $2}' <<<"$OUTPUT")
  SIGNATURE=$(awk '/^--signature/ {print $2}' <<<"$OUTPUT")

  invoke --id "$IDENTITY" --source-account neko-manager \
    -- add_claim --topic "$topic" --scheme 101 --issuer "$CLAIM_ISSUER" \
    --signature "$SIGNATURE" --data "$DATA" \
    --uri "https://neko.example/claims/$ADDRESS/$topic" >/dev/null
  info "topic $topic signed and attached"
done

note "Registry"
# See onboard-investor.sh for why CountryData is hand-encoded.
PROFILE="[{\"map\":[{\"key\":{\"symbol\":\"country\"},\"val\":{\"vec\":[{\"symbol\":\"Individual\"},{\"vec\":[{\"symbol\":\"Residence\"},{\"u32\":$COUNTRY}]}]}},{\"key\":{\"symbol\":\"metadata\"},\"val\":\"void\"}]}]"
invoke --id "$REGISTRY" --source-account neko-manager \
  -- add_identity --account "$ADDRESS" --identity "$IDENTITY" \
  --initial_profiles "$PROFILE" --operator "$MANAGER" >/dev/null
info "registered, country $COUNTRY"

save "$(jq -n --arg a "$ADDRESS" --arg i "$IDENTITY" --argjson c "$COUNTRY" \
  '{investors: {($a): {address: $a, identity: $i, country: $c}}}')"

note "Done"
info "$ADDRESS can now hold any Neko vault token"
