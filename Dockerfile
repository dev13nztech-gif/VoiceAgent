# =============================================================================
# VoiceAgent — Single-container image
# =============================================================================
# One image runs everything:
#   • nginx      — serves the React SPA and proxies /api/* to uvicorn
#   • uvicorn    — FastAPI + faster-whisper transcription backend
#   • supervisord — lightweight process manager keeping both alive
#
# Build args
#   WHISPER_MODEL  tiny | base (default) | small | medium | large-v2 | large-v3
#
# Local usage
#   docker build -t voiceagent .
#   docker run -p 8080:8080 voiceagent
#   open http://localhost:8080
#
# With docker compose
#   docker compose up --build
#
# Cloud Run
#   See deploy-cloudrun.sh
# =============================================================================

# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json .
RUN npm install --frozen-lockfile
COPY frontend/ .
RUN npm run build

# ── Stage 2: Production image ──────────────────────────────────────────────────
FROM python:3.11-slim

# Which Whisper model to bake into the image at build time.
# Baking avoids a download on first request (no cold-start penalty).
#
#   tiny     ~75 MB model   1 GB RAM   fastest, lower accuracy
#   base     ~145 MB model  2 GB RAM   ← default, good for most use cases
#   small    ~465 MB model  2 GB RAM   balanced
#   medium   ~1.5 GB model  4 GB RAM   high accuracy
#   large-v2 ~3 GB model    8 GB RAM   best quality
ARG WHISPER_MODEL=base
ENV WHISPER_MODEL=${WHISPER_MODEL}

# System packages:
#   nginx        — web server / reverse proxy
#   supervisor   — keeps nginx + uvicorn running
#   gettext-base — provides envsubst (substitutes $PORT in nginx config)
RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx \
        supervisor \
        gettext-base \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ────────────────────────────────────────────────────────
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Pre-download Whisper model ─────────────────────────────────────────────────
# Running WhisperModel() here triggers the HuggingFace download and caches the
# weights in /root/.cache/huggingface inside the image layer.  Subsequent
# container starts find the model already on disk — no internet needed at runtime.
RUN python - <<'EOF'
import os
from faster_whisper import WhisperModel
model = os.environ["WHISPER_MODEL"]
print(f"[build] Downloading Whisper '{model}' model...", flush=True)
WhisperModel(model, device="cpu", compute_type="int8")
print("[build] Model cached.", flush=True)
EOF

# ── Application source ─────────────────────────────────────────────────────────
COPY backend/main.py .

# ── React production build ─────────────────────────────────────────────────────
COPY --from=frontend-builder /build/dist /app/static

# ── nginx ──────────────────────────────────────────────────────────────────────
# nginx.conf contains $PORT which is substituted at container startup.
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
# Remove the default site so only our config is active.
RUN rm -f /etc/nginx/sites-enabled/default \
          /etc/nginx/conf.d/default.conf

# ── supervisord ────────────────────────────────────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/voiceagent.conf

# ── Entrypoint ─────────────────────────────────────────────────────────────────
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# PORT defaults to 8080.  Cloud Run overrides this automatically.
ENV PORT=8080
EXPOSE 8080

CMD ["/entrypoint.sh"]
