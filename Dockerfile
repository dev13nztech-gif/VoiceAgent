# =============================================================================
# VoiceAgent — Single-container image (FastAPI serves frontend + API)
# =============================================================================
# One Python process does everything:
#   - uvicorn / FastAPI    -> /api/* transcription routes
#   - FastAPI StaticFiles  -> React SPA on every other path
#
# Build:
#   docker build -t voiceagent .
#
# Bake a custom subset of models (comma-separated, no spaces):
#   docker build --build-arg WHISPER_MODELS=tiny,base,small -t voiceagent .
#
# Pick which baked-in model is pre-loaded at startup (small => fast cold start):
#   docker build --build-arg DEFAULT_MODEL=small -t voiceagent .
#
# Run locally:
#   docker run -p 8080:8080 voiceagent
#   open http://localhost:8080
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

# All Whisper sizes pre-downloaded at build time so the frontend can offer
# every model in the picker. Comma-separated, no spaces.
#   tiny     ~75 MB   | 1 GB  RAM
#   base     ~145 MB  | 1.5 GB RAM
#   small    ~465 MB  | 2 GB  RAM
#   medium   ~1.5 GB  | 4 GB  RAM
#   large-v2 ~3 GB    | 8 GB  RAM
#   large-v3 ~3 GB    | 8 GB  RAM
# Total image footprint with all six: ~8.5 GB.
ARG WHISPER_MODELS=tiny,base,small,medium,large-v2,large-v3
ENV WHISPER_MODELS=${WHISPER_MODELS}

# Which baked-in model the server should pre-load at startup.
# Pick a small one to keep cold start fast; users can switch in the UI.
ARG DEFAULT_MODEL=base
ENV WHISPER_MODEL=${DEFAULT_MODEL}

WORKDIR /app

# Python deps first (cached unless requirements.txt changes).
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download every requested Whisper model so the first request never has
# to fetch weights from the internet (avoids Cloud Run cold-start timeouts).
# Written as `python -c` (single line) because Cloud Build's classic Docker
# builder does not support heredoc syntax.
RUN python -c "import os; from faster_whisper import WhisperModel; \
    models=[m.strip() for m in os.environ['WHISPER_MODELS'].split(',') if m.strip()]; \
    [ (print(f'[build] downloading {m}', flush=True), WhisperModel(m, device='cpu', compute_type='int8')) for m in models ]; \
    print(f'[build] all models cached: {models}', flush=True)"

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