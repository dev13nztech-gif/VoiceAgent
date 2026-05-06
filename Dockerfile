# =============================================================================
# VoiceAgent — Single-container image (FastAPI serves frontend + API)
# =============================================================================
# One process does everything:
#   • uvicorn / FastAPI  — transcription API  (/api/*)
#   • FastAPI StaticFiles — React SPA  (all other paths)
#
# No nginx. No supervisord. Just Python.
#
# Models baked in at build time: medium · large-v2 · large-v3
#
# Local usage:
#   docker build -t voiceagent .
#   docker run -p 8080:8080 voiceagent
#   open http://localhost:8080
#
# With docker compose:
#   docker compose up --build
#
# Cloud Run:
#   See deploy-cloudrun.sh
# =============================================================================

# ── Stage 1: Build React frontend ─────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json .
RUN npm install --frozen-lockfile
COPY frontend/ .
RUN npm run build

# ── Stage 2: Production image ──────────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# ── Python dependencies ──────────────────────────────────────────────────────────────
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Pre-download Whisper models at build time ──────────────────────────────────────────────
# Baking all three models avoids any internet access at runtime.
#   medium   ~1.5 GB
#   large-v2 ~3.0 GB
#   large-v3 ~3.0 GB
RUN python - <<'EOF'
from faster_whisper import WhisperModel
for model in ["medium", "large-v2", "large-v3"]:
    print(f"[build] Downloading Whisper '{model}'...", flush=True)
    WhisperModel(model, device="cpu", compute_type="int8")
    print(f"[build] '{model}' cached.", flush=True)
print("[build] All models ready.", flush=True)
EOF

# ── Application source ──────────────────────────────────────────────────────────────
COPY backend/main.py .

# ── React production build → served by FastAPI ────────────────────────────────────────
COPY --from=frontend-builder /build/dist /app/static

# ── Environment ──────────────────────────────────────────────────────────────
# STATIC_DIR    — where FastAPI looks for the React build
# WHISPER_MODEL — model pre-loaded at startup for fast first request
# PORT          — Cloud Run injects this automatically; default 8080
ENV STATIC_DIR=/app/static \
    WHISPER_MODEL=medium \
    PORT=8080 \
    HF_HUB_DISABLE_SYMLINKS_WARNING=1

EXPOSE 8080

# Single process — no supervisor needed
CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
