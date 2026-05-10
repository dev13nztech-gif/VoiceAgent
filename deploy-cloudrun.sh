#!/usr/bin/env bash
# =============================================================================
# deploy-cloudrun.sh — Build and deploy VoiceAgent to Google Cloud Run
#
# Supports both CPU (default) and GPU (NVIDIA L4) deployments.
# The same single-container image serves the React SPA + transcription API.
#
# Prerequisites:
#   1. Google Cloud SDK: https://cloud.google.com/sdk/docs/install
#   2. Docker Desktop running locally
#   3. One-time auth setup:
#        gcloud auth login
#        gcloud config set project YOUR_PROJECT_ID
#        gcloud auth configure-docker ${REGION}-docker.pkg.dev   # e.g. us-central1-docker.pkg.dev
#
# Usage:
#   ./deploy-cloudrun.sh                        # CPU, base model
#   WHISPER_MODEL=medium ./deploy-cloudrun.sh   # CPU, medium model
#   GPU=1 ./deploy-cloudrun.sh                  # GPU (NVIDIA L4), large-v3
#   GPU=1 WHISPER_MODEL=large-v2 ./deploy-cloudrun.sh
#   PROJECT_ID=my-project REGION=us-central1 GPU=1 ./deploy-cloudrun.sh
# =============================================================================
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-voiceagent}"
REPO="${REPO:-voiceagent}"             # Artifact Registry repository name
GPU="${GPU:-0}"                        # set GPU=1 to deploy with NVIDIA L4

# GPU forces large-v3; CPU defaults to base
if [[ "$GPU" == "1" ]]; then
  WHISPER_MODEL="${WHISPER_MODEL:-large-v3}"
  DEVICE="cuda"
  COMPUTE_TYPE="float16"
  DOCKERFILE="Dockerfile.gpu"
  SERVICE_NAME="${SERVICE_NAME}-gpu"
else
  WHISPER_MODEL="${WHISPER_MODEL:-base}"
  DEVICE="cpu"
  COMPUTE_TYPE="int8"
  DOCKERFILE="Dockerfile"
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}"

# ── Resource sizing ────────────────────────────────────────────────────────────
if [[ "$GPU" == "1" ]]; then
  # NVIDIA L4 on Cloud Run requires ≥4 vCPU and ≥16Gi memory.
  # Concurrency is low: the GPU handles one transcription at a time efficiently.
  MEMORY="16Gi"
  CPU="4"
  CONCURRENCY="2"
  # --no-gpu-zonal-redundancy matches the most common GPU quota shape and
  # avoids the "Zonal Redundancy" quota requirement.
  # --cpu-boost speeds up the cold start while large-v3 loads onto the GPU.
  # Startup probe gives the container up to 5 min to come healthy
  # (large-v3 takes ~20–30s to load on L4; default Cloud Run probe is too aggressive).
  GPU_FLAGS="--gpu 1 --gpu-type nvidia-l4 --no-gpu-zonal-redundancy --no-cpu-throttling --cpu-boost --startup-probe=httpGet.path=/api/health,initialDelaySeconds=0,periodSeconds=10,timeoutSeconds=5,failureThreshold=30"
  GPU_ENVS=",DEVICE=cuda,COMPUTE_TYPE=float16"
else
  case "$WHISPER_MODEL" in
    tiny)   MEMORY="1Gi";  CPU="1" ;;
    base)   MEMORY="2Gi";  CPU="1" ;;
    small)  MEMORY="2Gi";  CPU="2" ;;
    medium) MEMORY="4Gi";  CPU="2" ;;
    large*) MEMORY="8Gi";  CPU="4" ;;
    *)      MEMORY="2Gi";  CPU="1" ;;
  esac
  CONCURRENCY="4"
  GPU_FLAGS=""
  GPU_ENVS=""
fi

# ── Validate ──────────────────────────────────────────────────────────────
if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: GCP project not set."
  echo "  Run:  gcloud config set project YOUR_PROJECT_ID"
  echo "  Or:   PROJECT_ID=your-project ./deploy-cloudrun.sh"
  exit 1
fi

if [[ "$GPU" == "1" ]]; then
  # GPU is only available in specific Cloud Run regions
  GPU_REGIONS="us-central1 us-east4 europe-west4 asia-southeast1"
  if ! echo "$GPU_REGIONS" | grep -qw "$REGION"; then
    echo "WARNING: GPU may not be available in region '$REGION'."
    echo "  GPU-capable regions: $GPU_REGIONS"
    echo "  Set REGION=us-central1 for best availability."
    echo ""
  fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  VoiceAgent → Google Cloud Run"
echo "  Project   : ${PROJECT_ID}"
echo "  Region    : ${REGION}"
echo "  Service   : ${SERVICE_NAME}"
echo "  Model     : ${WHISPER_MODEL}  |  ${MEMORY} RAM  |  ${CPU} vCPU"
if [[ "$GPU" == "1" ]]; then
echo "  GPU       : NVIDIA L4  |  float16  |  CUDA 12.2"
fi
echo "  Image     : ${IMAGE}"
echo "  Dockerfile: ${DOCKERFILE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Enable required GCP APIs ──────────────────────────────────────────────────────────
echo ""
echo "[1/4] Enabling GCP APIs…"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  --project="${PROJECT_ID}" --quiet

# Ensure the Artifact Registry repository exists (one-time create per project/region).
if ! gcloud artifacts repositories describe "${REPO}" \
      --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "       Creating Artifact Registry repo '${REPO}' in ${REGION}…"
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --quiet
fi

# ── Build image ──────────────────────────────────────────────────────────────
echo "[2/4] Building image (${DOCKERFILE}, model: ${WHISPER_MODEL})…"
echo "      GPU build may take 10–20 min — CUDA base image + model downloads."
docker build \
  --file "${DOCKERFILE}" \
  --tag "${IMAGE}:latest" \
  --tag "${IMAGE}:${WHISPER_MODEL}" \
  .

# ── Push to Artifact Registry ──────────────────────────────────────────────────────────
echo "[3/4] Pushing to Artifact Registry (${REGION}-docker.pkg.dev)…"
docker push "${IMAGE}:latest"
docker push "${IMAGE}:${WHISPER_MODEL}"

# ── Deploy to Cloud Run ──────────────────────────────────────────────────────────────
echo "[4/4] Deploying to Cloud Run…"
gcloud run deploy "${SERVICE_NAME}" \
  --image           "${IMAGE}:latest" \
  --platform        managed \
  --region          "${REGION}" \
  --project         "${PROJECT_ID}" \
  --memory          "${MEMORY}" \
  --cpu             "${CPU}" \
  --timeout         900 \
  --concurrency     "${CONCURRENCY}" \
  --min-instances   0 \
  --max-instances   3 \
  --set-env-vars    "WHISPER_MODEL=${WHISPER_MODEL},HF_HUB_DISABLE_SYMLINKS_WARNING=1,STATIC_DIR=/app/static${GPU_ENVS}" \
  --allow-unauthenticated \
  ${GPU_FLAGS} \
  --quiet

# ── Done ──────────────────────────────────────────────────────────────
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" --project "${PROJECT_ID}" \
  --format "value(status.url)")

echo ""
echo "✓ Deployed!"
echo "  App      : ${SERVICE_URL}"
echo "  Health   : ${SERVICE_URL}/api/health"
echo "  API docs : ${SERVICE_URL}/docs"
echo "  Model    : ${WHISPER_MODEL} | ${MEMORY} RAM | ${CPU} vCPU$([ "$GPU" == "1" ] && echo " | NVIDIA L4 GPU")"
echo ""
if [[ "$GPU" == "1" ]]; then
echo "  Verify GPU is active:"
echo "    curl ${SERVICE_URL}/api/health"
echo "    → should show: \"device\": \"cuda\""
echo ""
fi
echo "  Redeploy examples:"
echo "    WHISPER_MODEL=medium ./deploy-cloudrun.sh          # CPU"
echo "    GPU=1 ./deploy-cloudrun.sh                         # GPU + large-v3"
echo "    GPU=1 WHISPER_MODEL=large-v2 ./deploy-cloudrun.sh  # GPU + large-v2"
