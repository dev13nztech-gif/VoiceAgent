#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-cloudrun.sh — Build and deploy VoiceAgent to Google Cloud Run
#
# Prerequisites:
#   1. Google Cloud SDK (gcloud):  https://cloud.google.com/sdk/docs/install
#   2. Docker Desktop running locally
#   3. Run once: gcloud auth login && gcloud auth configure-docker
#
# Usage:
#   ./deploy-cloudrun.sh                        # deploy with base model
#   WHISPER_MODEL=medium ./deploy-cloudrun.sh   # deploy with medium model
#   PROJECT_ID=my-project ./deploy-cloudrun.sh  # explicit project
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration (override with environment variables) ────────────────────
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-voiceagent}"
WHISPER_MODEL="${WHISPER_MODEL:-base}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Cloud Run resource sizing per model
case "$WHISPER_MODEL" in
  tiny)    MEMORY="1Gi";  CPU="1" ;;
  base)    MEMORY="2Gi";  CPU="1" ;;
  small)   MEMORY="2Gi";  CPU="2" ;;
  medium)  MEMORY="4Gi";  CPU="2" ;;
  large*)  MEMORY="8Gi";  CPU="4" ;;
  *)       MEMORY="2Gi";  CPU="1" ;;
esac

# ── Validation ──────────────────────────────────────────────────────────────
if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: PROJECT_ID is not set."
  echo "  Run: gcloud config set project YOUR_PROJECT_ID"
  echo "  Or:  PROJECT_ID=your-project ./deploy-cloudrun.sh"
  exit 1
fi

echo "VoiceAgent — Cloud Run Deployment"
echo "  Project  : ${PROJECT_ID}"
echo "  Region   : ${REGION}"
echo "  Service  : ${SERVICE_NAME}"
echo "  Model    : ${WHISPER_MODEL}"
echo "  Image    : ${IMAGE}"
echo "  Memory   : ${MEMORY} / CPU: ${CPU}"
echo ""

# ── Enable required GCP APIs (idempotent) ───────────────────────────────────
echo "[1/4] Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  containerregistry.googleapis.com \
  --project="${PROJECT_ID}" \
  --quiet

# ── Build Docker image ──────────────────────────────────────────────────────
echo "[2/4] Building Docker image (WHISPER_MODEL=${WHISPER_MODEL})..."
docker build \
  --file Dockerfile.cloudrun \
  --build-arg WHISPER_MODEL="${WHISPER_MODEL}" \
  --tag "${IMAGE}:latest" \
  --tag "${IMAGE}:${WHISPER_MODEL}" \
  .

# ── Push to Google Container Registry ───────────────────────────────────────
echo "[3/4] Pushing image to GCR..."
docker push "${IMAGE}:latest"
docker push "${IMAGE}:${WHISPER_MODEL}"

# ── Deploy to Cloud Run ──────────────────────────────────────────────────────
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

# ── Print service URL ────────────────────────────────────────────────────────
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format "value(status.url)")

echo ""
echo "Deployment complete!"
echo "  Service URL : ${SERVICE_URL}"
echo "  API health  : ${SERVICE_URL}/api/health"
echo "  API docs    : ${SERVICE_URL}/docs"
echo "  Model       : ${WHISPER_MODEL} (${MEMORY} RAM / ${CPU} vCPU)"
