#!/usr/bin/env bash
#
# Turn deployments/<network>.json into the environment block the apps read.
#
#   ./scripts/print-env.sh >> ../.env.local

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_tools
require_deployments

jq -r '
  "NEXT_PUBLIC_STELLAR_NETWORK=" + .network,
  "NEXT_PUBLIC_STELLAR_USDC_CONTRACT_ID=" + .shared.usdc,
  "NEXT_PUBLIC_CLAIM_TOPICS_CONTRACT_ID=" + .shared.claim_topics_and_issuers,
  "NEXT_PUBLIC_CLAIM_ISSUER_CONTRACT_ID=" + .shared.claim_issuer,
  "NEXT_PUBLIC_IDENTITY_REGISTRY_CONTRACT_ID=" + .shared.identity_registry,
  "NEXT_PUBLIC_IDENTITY_VERIFIER_CONTRACT_ID=" + .shared.identity_verifier,
  "NEXT_PUBLIC_FACTORY_CONTRACT_ID=" + .shared.factory,
  "NEXT_PUBLIC_MILESTONE_TRACKER_CONTRACT_ID=" + .shared.milestone_tracker
' "$DEPLOYMENTS"
