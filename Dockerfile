# =============================================================================
# VoiceAgent — Single-container image
# =============================================================================
# One image runs everything:
#   • nginx      — serves the React SPA and proxies /api/* to uvicorn
#   • uvicorn    — FastAPI + faster-whisper transcription backend
#   • supervisord — lightweight process manager keeping both alive
#
# Models baked in at build time: medium · large-v2 · large-v3
# The frontend dynamically shows only models present on disk.
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

# ── Pre-download Whisper models ────────────────────────────────────────────────
# All three models are baked into the image so the frontend can offer all of
# them without any internet access at runtime.
#
#   medium   ~1.5 GB   high accuracy, reasonable speed
#   large-v2 ~3.0 GB   best quality (stable)
#   large-v3 ~3.0 GB   best quality (latest)
#
# Total added image size: ~7.5 GB — plan registry storage accordingly.
RUN python - <<'EOF'
from faster_whisper import WhisperModel
for model in ["medium", "large-v2", "large-v3"]:
    print(f"[build] Downloading Whisper '{model}'...", flush=True)
    WhisperModel(model, device="cpu", compute_type="int8")
    print(f"[build] '{model}' cached.", flush=True)
print("[build] All models ready.", flush=True)
EOF

# Default model to pre-load at container startup (warms the cache so the first
# transcription request is fast). Must be one of the models downloaded above.
ENV WHISPER_MODEL=medium

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
