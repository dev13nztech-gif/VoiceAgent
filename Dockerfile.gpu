# =============================================================================
# VoiceAgent — GPU-enabled container (NVIDIA CUDA + faster-whisper)
# =============================================================================
# Uses NVIDIA L4 / T4 / A100 on Google Cloud Run or any NVIDIA Docker host.
#
# One process:
#   • uvicorn / FastAPI  — transcription API  (/api/*)
#   • FastAPI StaticFiles — React SPA  (all other paths)
#
# GPU gives ~10–20× speed-up over CPU for large-v3 transcription.
# Models baked in at build time: large-v3 (default).
# To bake additional models, pass --build-arg MODELS="medium large-v2 large-v3".
#
# Local usage (requires nvidia-container-toolkit):
#   docker build -f Dockerfile.gpu -t voiceagent-gpu .
#   docker run --gpus all -p 8080:8080 voiceagent-gpu
#
# With docker compose:
#   docker compose -f docker-compose.gpu.yml up --build
#
# Cloud Run (NVIDIA L4):
#   GPU=1 ./deploy-cloudrun.sh
# =============================================================================

# ── Stage 1: Build React frontend ─────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json .
RUN npm install --frozen-lockfile
COPY frontend/ .
RUN npm run build

# ── Stage 2: GPU production image ─────────────────────────────────────────────────────
# CUDA 12.2 + cuDNN 8 runtime on Ubuntu 22.04.
# The NVIDIA drivers live on the host — only the runtime libs go in the image.
FROM nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04

# Install Python 3.11 and pip
RUN apt-get update && apt-get install -y --no-install-recommends \
        software-properties-common \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get install -y --no-install-recommends \
        python3.11 python3.11-distutils python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && python -m pip install --upgrade pip

WORKDIR /app

# ── Python dependencies ──────────────────────────────────────────────────────────────
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Pre-download Whisper models at build time ──────────────────────────────────────────────
# Download using CPU so no GPU is required during docker build.
# At runtime the loaded model is transferred to the GPU automatically.
# MODELS is space-separated; default bakes only large-v3 (~3 GB).
# Override with: --build-arg MODELS="medium large-v2 large-v3"
ARG MODELS="large-v3"
ENV MODELS=${MODELS}
RUN python -c "import os; from faster_whisper import WhisperModel; [\
    (print(f'[build] Downloading Whisper {m}...', flush=True), \
     WhisperModel(m, device='cpu', compute_type='int8'), \
     print(f'[build] {m} cached.', flush=True)) \
    for m in os.environ['MODELS'].split()]"

# ── Application source ──────────────────────────────────────────────────────────────
COPY backend/main.py .

# ── React production build → served by FastAPI ────────────────────────────────────────
COPY --from=frontend-builder /build/dist /app/static

# ── Environment ──────────────────────────────────────────────────────────────
# DEVICE=cuda          — use the GPU for inference
# COMPUTE_TYPE=float16 — half-precision for maximum GPU throughput
# WHISPER_MODEL        — large-v3 is the default on GPU
# PORT                 — Cloud Run injects this; default 8080
ENV STATIC_DIR=/app/static \
    DEVICE=cuda \
    COMPUTE_TYPE=float16 \
    WHISPER_MODEL=large-v3 \
    PORT=8080 \
    HF_HUB_DISABLE_SYMLINKS_WARNING=1

EXPOSE 8080

CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
