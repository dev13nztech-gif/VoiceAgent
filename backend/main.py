import os
import time
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

app = FastAPI(title="VoiceAgent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ordered list of all models faster-whisper supports.
ALL_MODELS = ["tiny", "base", "small", "medium", "large-v2", "large-v3"]

# Model to pre-load at startup (set via WHISPER_MODEL env var).
DEFAULT_MODEL = os.getenv("WHISPER_MODEL", "medium")

# In-process model cache — avoids reloading weights on every request.
_model_cache: dict[str, WhisperModel] = {}


# ── Model discovery ────────────────────────────────────────────────────────────

def get_downloaded_models() -> List[str]:
    """
    Return the subset of ALL_MODELS whose weights are already present in the
    HuggingFace hub cache on disk.  The frontend shows only these models.

    faster-whisper stores weights under:
        $HF_HOME/hub/models--Systran--faster-whisper-{name}/snapshots/...
    A model is considered available when that directory exists and is non-empty.
    """
    hf_home = Path(os.getenv("HF_HOME", Path.home() / ".cache" / "huggingface"))
    hub_dir = hf_home / "hub"

    available: List[str] = []
    for name in ALL_MODELS:
        repo_dir = hub_dir / f"models--Systran--faster-whisper-{name}"
        if repo_dir.exists() and any(repo_dir.iterdir()):
            available.append(name)

    # If nothing is cached yet (e.g. pure local dev before any download),
    # fall back to the full list so the UI is never empty.
    return available if available else ALL_MODELS


# ── Model loader ───────────────────────────────────────────────────────────────

def load_model(model_size: str) -> WhisperModel:
    if model_size not in _model_cache:
        print(f"[VoiceAgent] Loading Whisper model: {model_size} ...", flush=True)
        _model_cache[model_size] = WhisperModel(
            model_size, device="cpu", compute_type="int8"
        )
        print(f"[VoiceAgent] Model '{model_size}' ready.", flush=True)
    return _model_cache[model_size]


# ── Startup ────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    """Pre-load the default model so the first request is fast."""
    load_model(DEFAULT_MODEL)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "loaded_models": list(_model_cache.keys()),
    }


@app.get("/api/models")
def list_models():
    """
    Return only the models that are downloaded on disk.
    The frontend uses this to render exactly the available model buttons.
    """
    downloaded = get_downloaded_models()
    default = DEFAULT_MODEL if DEFAULT_MODEL in downloaded else downloaded[0]
    return {
        "models": downloaded,
        "default": default,
        "loaded": list(_model_cache.keys()),
    }


@app.post("/api/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
    language: Optional[str] = Form(None),
):
    downloaded = get_downloaded_models()
    if model not in downloaded:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{model}' is not available. Choose from: {downloaded}",
        )

    # Save upload to a temp file (faster-whisper needs a path, not a stream).
    ext = os.path.splitext(file.filename or "audio")[1] or ".audio"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        t0 = time.time()
        whisper = load_model(model)

        # language=None -> auto-detect; explicit code forces a language.
        forced_lang = (
            language if language and language.lower() not in ("", "auto") else None
        )

        segments_iter, info = whisper.transcribe(
            tmp_path,
            language=forced_lang,
            beam_size=5,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )

        segments = []
        for seg in segments_iter:
            words = []
            if seg.words:
                for w in seg.words:
                    words.append(
                        {
                            "word": w.word,
                            "start": round(w.start, 3),
                            "end": round(w.end, 3),
                            "probability": round(w.probability, 3),
                        }
                    )
            segments.append(
                {
                    "id": seg.id,
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": seg.text.strip(),
                    "words": words,
                }
            )

        full_text = " ".join(s["text"] for s in segments)
        elapsed = round(time.time() - t0, 2)

        return {
            "text": full_text,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 2),
            "model": model,
            "segments": segments,
            "processing_time_seconds": elapsed,
        }
    finally:
        os.unlink(tmp_path)
