#!/usr/bin/env bash
# =============================================================================
# deploy-cloudrun.sh — Build and deploy VoiceAgent to Google Cloud Run
#
# The same single-container Dockerfile used locally is deployed to Cloud Run.
# No separate backend/frontend images — one image, one service.
#
# Prerequisites:
#   1. Google Cloud SDK: https://cloud.google.com/sdk/docs/install
#   2. Docker Desktop running locally
#   3. One-time auth setup:
#        gcloud auth login
#        gcloud auth configure-docker
#        gcloud config set project YOUR_PROJECT_ID
#
# Usage:
#   ./deploy-cloudrun.sh
#   WHISPER_MODEL=medium ./deploy-cloudrun.sh
#   PROJECT_ID=my-project REGION=europe-west1 ./deploy-cloudrun.sh
# =============================================================================
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-voiceagent}"
WHISPER_MODEL="${WHISPER_MODEL:-base}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Auto-size Cloud Run resources based on chosen model.
case "$WHISPER_MODEL" in
  tiny)    MEMORY="1Gi"; CPU="1" ;;
  base)    MEMORY="2Gi"; CPU="1" ;;
  small)   MEMORY="2Gi"; CPU="2" ;;
  medium)  MEMORY="4Gi"; CPU="2" ;;
  large*)  MEMORY="8Gi"; CPU="4" ;;
  *)       MEMORY="2Gi"; CPU="1" ;;
esac

# ── Validate ───────────────────────────────────────────────────────────────────
if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: GCP project not set."
  echo "  Run:  gcloud config set project YOUR_PROJECT_ID"
  echo "  Or:   PROJECT_ID=your-project ./deploy-cloudrun.sh"
  exit 1
fi

echo "VoiceAgent -> Google Cloud Run"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "  Service : ${SERVICE_NAME}"
echo "  Model   : ${WHISPER_MODEL} (${MEMORY} RAM / ${CPU} vCPU)"
echo "  Image   : ${IMAGE}"
echo ""

# ── Enable required GCP APIs ───────────────────────────────────────────────────
echo "[1/4] Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  containerregistry.googleapis.com \
  --project="${PROJECT_ID}" --quiet

# ── Build image ────────────────────────────────────────────────────────────────
echo "[2/4] Building image (model baked in: ${WHISPER_MODEL})..."
docker build \
  --file Dockerfile \
  --build-arg WHISPER_MODEL="${WHISPER_MODEL}" \
  --tag "${IMAGE}:latest" \
  --tag "${IMAGE}:${WHISPER_MODEL}" \
  .

# ── Push to GCR ───────────────────────────────────────────────────────────────
echo "[3/4] Pushing to Google Container Registry..."
docker push "${IMAGE}:latest"
docker push "${IMAGE}:${WHISPER_MODEL}"

# ── Deploy to Cloud Run ────────────────────────────────────────────────────────
echo "[4/4] Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image           "${IMAGE}:latest" \
  --platform        managed \
  --region          "${REGION}" \
  --project         "${PROJECT_ID}" \
  --memory          "${MEMORY}" \
  --cpu             "${CPU}" \
  --timeout         900 \
  --concurrency     4 \
  --min-instances   0 \
  --max-instances   3 \
  --set-env-vars    "WHISPER_MODEL=${WHISPER_MODEL},HF_HUB_DISABLE_SYMLINKS_WARNING=1" \
  --allow-unauthenticated \
  --quiet

# ── Done ───────────────────────────────────────────────────────────────────────
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" --project "${PROJECT_ID}" \
  --format "value(status.url)")

echo ""
echo "Deployed!"
echo "  App     : ${SERVICE_URL}"
echo "  Health  : ${SERVICE_URL}/health"
echo "  API docs: ${SERVICE_URL}/docs"
echo "  Model   : ${WHISPER_MODEL} | ${MEMORY} RAM | ${CPU} vCPU"
echo ""
echo "  To redeploy with a different model:"
echo "    WHISPER_MODEL=medium ./deploy-cloudrun.sh"
