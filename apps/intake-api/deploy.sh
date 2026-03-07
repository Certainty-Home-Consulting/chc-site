#!/usr/bin/env bash
# Deploy CHC intake API Cloud Function
# Prereqs:
#   - gcloud auth configured for chc-260226-27954
#   - Firestore enabled in chc project
#   - Discord webhook URL stored in Secret Manager
#
# Usage: ./deploy.sh [--webhook-url URL]

set -euo pipefail

PROJECT="chc-260226-27954"
REGION="us-central1"
FUNCTION_NAME="chc-intake"
ENTRY_POINT="intake"
RUNTIME="python312"

# Optional: pass webhook URL as arg for first deploy
WEBHOOK_URL="${1:-}"

echo "Deploying $FUNCTION_NAME to $PROJECT ($REGION)..."

EXTRA_FLAGS=""
if [[ -n "$WEBHOOK_URL" ]]; then
    EXTRA_FLAGS="--set-env-vars DISCORD_WEBHOOK_URL=$WEBHOOK_URL"
fi

gcloud functions deploy "$FUNCTION_NAME" \
    --project="$PROJECT" \
    --region="$REGION" \
    --runtime="$RUNTIME" \
    --gen2 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point="$ENTRY_POINT" \
    --source="$(dirname "$0")" \
    --memory=256MB \
    --timeout=30s \
    $EXTRA_FLAGS

echo ""
echo "Deployed! Endpoint:"
gcloud functions describe "$FUNCTION_NAME" \
    --project="$PROJECT" \
    --region="$REGION" \
    --gen2 \
    --format='value(serviceConfig.uri)'
