# =============================================================================
# VoiceAgent — Single-container image (FastAPI serves frontend + API)
# =============================================================================
# One Python process does everything:
#   - uvicorn / FastAPI    -> /api/* transcription routes
#   - FastAPI StaticFiles  -> React SPA on every other path
#
# No nginx. No supervisor. Just Python.
#
# Build:
#   docker build -t voiceagent .
#
# Build with a different baked-in model (tiny | base | small | medium | large-v2 | large-v3):
#   docker build --build-arg WHISPER_MODEL=small -t voiceagent .
#
# Run locally:
#   docker run -p 8080:8080 voiceagent
#   open http://localhost:8080
#
# Deploy to Google Cloud Run (see commands below the file).
# =============================================================================


# -- Stage 1: Build the React frontend ---------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /build

# Copy lockfile + manifest first so npm install is cached when source changes.
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# -- Stage 2: Python runtime -------------------------------------------------
FROM python:3.11-slim

# Choose which Whisper model to bake into the image at build time.
#   tiny     ~75 MB   | 1 GB  RAM   <- smallest, lowest accuracy
#   base     ~145 MB  | 1.5 GB RAM  <- recommended for Cloud Run free tier
#   small    ~465 MB  | 2 GB  RAM
#   medium   ~1.5 GB  | 4 GB  RAM
#   large-v2 ~3 GB    | 8 GB  RAM
#   large-v3 ~3 GB    | 8 GB  RAM
ARG WHISPER_MODEL=base
ENV WHISPER_MODEL=${WHISPER_MODEL}

WORKDIR /app

# Python deps first (cached unless requirements.txt changes).
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the chosen Whisper model so the first request never has to
# fetch weights from the internet (avoids Cloud Run cold-start timeouts).
RUN python - <<'EOF'
import os
from faster_whisper import WhisperModel
m = os.environ["WHISPER_MODEL"]
print(f"[build] Pre-downloading Whisper model: {m}", flush=True)
WhisperModel(m, device="cpu", compute_type="int8")
print(f"[build] Model '{m}' cached.", flush=True)
EOF

# Backend source
COPY backend/main.py .

# React production build -> served by FastAPI StaticFiles
COPY --from=frontend-builder /build/dist /app/static

# STATIC_DIR    : where FastAPI looks for the React build
# PORT          : Cloud Run injects this automatically; 8080 is a safe default
ENV STATIC_DIR=/app/static \
    PORT=8080 \
    HF_HUB_DISABLE_SYMLINKS_WARNING=1

EXPOSE 8080

CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}"]