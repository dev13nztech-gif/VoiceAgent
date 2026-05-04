import os
import time
import tempfile
from typing import Optional

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

SUPPORTED_MODELS = ["tiny", "base", "small", "medium", "large-v2", "large-v3"]
DEFAULT_MODEL = "medium"

# Cache loaded models to avoid reloading on every request
_model_cache: dict[str, WhisperModel] = {}


def load_model(model_size: str) -> WhisperModel:
    if model_size not in _model_cache:
        print(f"[VoiceAgent] Loading Whisper model: {model_size} ...")
        _model_cache[model_size] = WhisperModel(
            model_size, device="cpu", compute_type="int8"
        )
        print(f"[VoiceAgent] Model '{model_size}' ready.")
    return _model_cache[model_size]


@app.on_event("startup")
async def startup():
    load_model(DEFAULT_MODEL)


@app.get("/api/health")
def health():
    return {"status": "ok", "loaded_models": list(_model_cache.keys())}


@app.get("/api/models")
def list_models():
    return {
        "models": SUPPORTED_MODELS,
        "default": DEFAULT_MODEL,
        "loaded": list(_model_cache.keys()),
    }


@app.post("/api/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
    language: Optional[str] = Form(None),
):
    if model not in SUPPORTED_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model '{model}'. Choose from: {SUPPORTED_MODELS}",
        )

    ext = os.path.splitext(file.filename or "audio")[1] or ".audio"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        t0 = time.time()
        whisper = load_model(model)

        forced_lang = language if language and language.lower() not in ("", "auto") else None

        segments_iter, info = whisper.transcribe(
            tmp_path,
            language=forced_lang,
            beam_size=5,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )

        segments = []
        words_all = []
        for seg in segments_iter:
            words = []
            if seg.words:
                for w in seg.words:
                    words.append({
                        "word": w.word,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 3),
                    })
                    words_all.append(w.word)
            segments.append({
                "id": seg.id,
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
                "words": words,
            })

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
