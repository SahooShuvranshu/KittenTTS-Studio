import os
import json
import time
import uuid
import shutil
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from backend.audio_utils import convert_to_wav, get_audio_metadata, validate_reference_audio
from backend.profiles import list_profiles, get_profile, create_profile, update_profile, delete_profile
from backend.engine import KittenTTSEngine

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
OUTPUTS_DIR = os.path.join(STORAGE_DIR, "outputs")
PROFILES_DIR = os.path.join(STORAGE_DIR, "profiles")
TEMP_DIR = os.path.join(STORAGE_DIR, "temp")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DOCS_DIR = os.path.join(BASE_DIR, "docs")
HISTORY_FILE = os.path.join(OUTPUTS_DIR, "history.json")

# Ensure directories exist
for d in [STORAGE_DIR, OUTPUTS_DIR, PROFILES_DIR, TEMP_DIR, DOCS_DIR]:
    os.makedirs(d, exist_ok=True)

app = FastAPI(
    title="Kitten-TTS 2 Studio",
    version="1.0.0",
    description="Industrial local zero-shot voice cloning and speech synthesis studio by SahooShuvranshu.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Secure CORS Configuration
raw_cors = os.getenv("CORS_ORIGINS", "http://localhost:8765,http://127.0.0.1:8765,http://localhost:8000,http://127.0.0.1:8000")
cors_origins = [o.strip() for o in raw_cors.split(",") if o.strip()]

if "*" in cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm"}
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB

def cleanup_temp_files(max_age_seconds: int = 7200):
    """Purges expired temporary samples from storage/temp older than max_age_seconds (default 2 hours)."""
    now = time.time()
    if not os.path.exists(TEMP_DIR):
        return
    for fname in os.listdir(TEMP_DIR):
        fpath = os.path.join(TEMP_DIR, fname)
        if os.path.isfile(fpath):
            try:
                if now - os.path.getmtime(fpath) > max_age_seconds:
                    os.remove(fpath)
            except OSError:
                pass

# Run startup purge
cleanup_temp_files()

# Request Schemas
class SynthesizeRequest(BaseModel):
    text: str
    speed: Optional[float] = 1.0
    profile_id: Optional[str] = None
    temp_sample: Optional[str] = None

class SaveSampleProfileRequest(BaseModel):
    filename: str
    name: str
    description: Optional[str] = ""

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

def _read_history() -> List[Dict[str, Any]]:
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def _append_history(entry: Dict[str, Any]):
    history = _read_history()
    history.insert(0, entry)
    # Keep last 50 entries
    history = history[:50]
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

# ==================== API ROUTES ====================

@app.get("/api/telemetry")
def get_telemetry():
    engine = KittenTTSEngine.get_instance()
    return engine.get_telemetry()

@app.post("/api/upload-sample")
async def upload_sample(file: UploadFile = File(...)):
    """
    Accepts user audio file (.wav, .mp3, .m4a, .flac, .ogg, .webm), normalizes to 24kHz mono WAV.
    Enforces format whitelisting and 50 MB size limits.
    """
    orig_name = file.filename or "sample.wav"
    ext = os.path.splitext(orig_name)[1].lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}"
        )

    raw_filename = f"raw_{uuid.uuid4().hex[:8]}{ext}"
    raw_path = os.path.join(TEMP_DIR, raw_filename)

    total_bytes = 0
    try:
        with open(raw_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE:
                    raise HTTPException(status_code=413, detail="File size exceeds maximum 50 MB limit.")
                buffer.write(chunk)

        if total_bytes < 100:
            raise HTTPException(status_code=400, detail="Uploaded file is empty or corrupted.")

        clean_filename = f"sample_{uuid.uuid4().hex[:8]}.wav"
        clean_path = os.path.join(TEMP_DIR, clean_filename)

        convert_to_wav(raw_path, clean_path, target_sr=24000)
        val = validate_reference_audio(clean_path)
        meta = val["metadata"]

        # Clean raw source file to save disk space
        if os.path.exists(raw_path):
            os.remove(raw_path)

        return {
            "status": "success",
            "filename": clean_filename,
            "original_filename": orig_name,
            "duration": meta["duration"],
            "sample_rate": meta["sample_rate"],
            "size_kb": meta["size_kb"],
            "validation": val
        }
    except HTTPException:
        if os.path.exists(raw_path):
            os.remove(raw_path)
        raise
    except Exception as e:
        if os.path.exists(raw_path):
            os.remove(raw_path)
        raise HTTPException(status_code=400, detail=f"Audio processing failed: {str(e)}")

@app.post("/api/profiles/save-sample")
def save_sample_as_profile(req: SaveSampleProfileRequest):
    safe_filename = os.path.basename(req.filename)
    if safe_filename != req.filename or ".." in req.filename or not safe_filename.endswith(".wav"):
        raise HTTPException(status_code=400, detail="Invalid sample filename.")

    src_path = os.path.abspath(os.path.join(TEMP_DIR, safe_filename))
    if not src_path.startswith(os.path.abspath(TEMP_DIR)) or not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail="Temporary sample not found or expired.")

    profile = create_profile(name=req.name, src_audio_path=src_path, description=req.description or "")
    return profile

@app.post("/api/profiles/record")
async def record_profile(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form("")
):
    """
    Receives browser MediaRecorder audio blob and registers a new voice profile.
    """
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Profile name cannot be blank.")

    raw_path = os.path.join(TEMP_DIR, f"rec_raw_{uuid.uuid4().hex[:8]}.webm")
    total_bytes = 0
    try:
        with open(raw_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE:
                    raise HTTPException(status_code=413, detail="Recording exceeds 50 MB limit.")
                buffer.write(chunk)

        if total_bytes < 100:
            raise HTTPException(status_code=400, detail="Recorded audio is empty or corrupted.")

        profile = create_profile(name=name.strip(), src_audio_path=raw_path, description=description or "")
        if os.path.exists(raw_path):
            os.remove(raw_path)
        return profile
    except HTTPException:
        if os.path.exists(raw_path):
            os.remove(raw_path)
        raise
    except Exception as e:
        if os.path.exists(raw_path):
            os.remove(raw_path)
        raise HTTPException(status_code=400, detail=f"Failed to save voice profile: {str(e)}")

@app.get("/api/profiles")
def get_profiles():
    return list_profiles()

@app.delete("/api/profiles/{profile_id}")
def remove_profile(profile_id: str):
    success = delete_profile(profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return {"status": "deleted", "id": profile_id}

@app.put("/api/profiles/{profile_id}")
def edit_profile(profile_id: str, req: UpdateProfileRequest):
    updated = update_profile(profile_id, name=req.name, description=req.description)
    if not updated:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return updated

@app.post("/api/synthesize")
def synthesize_speech(req: SynthesizeRequest):
    """
    Main speech generation endpoint. Clones speaker voice if profile or temp_sample is given.
    """
    clean_text = req.text.strip()
    if not clean_text:
        raise HTTPException(status_code=422, detail="Text prompt cannot be empty or whitespace.")

    if len(clean_text) > 5000:
        raise HTTPException(status_code=422, detail="Text prompt exceeds maximum 5000 character limit.")

    ref_audio_path = None
    voice_label = "Default Voice"

    if req.profile_id:
        profile = get_profile(req.profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail=f"Voice profile '{req.profile_id}' not found.")
        ref_audio_path = os.path.join(PROFILES_DIR, profile["filename"])
        voice_label = f"Profile: {profile.get('name', req.profile_id)}"
    elif req.temp_sample:
        safe_temp = os.path.basename(req.temp_sample)
        if safe_temp != req.temp_sample or ".." in req.temp_sample:
            raise HTTPException(status_code=400, detail="Invalid reference sample filename.")
        temp_path = os.path.abspath(os.path.join(TEMP_DIR, safe_temp))
        if not temp_path.startswith(os.path.abspath(TEMP_DIR)) or not os.path.exists(temp_path):
            raise HTTPException(status_code=404, detail="Temporary reference sample not found or expired.")
        ref_audio_path = temp_path
        voice_label = f"Temp Sample: {safe_temp}"

    engine = KittenTTSEngine.get_instance()
    t0 = time.time()
    char_count = len(clean_text)

    try:
        filename, duration = engine.synthesize(
            text=clean_text,
            reference_path=ref_audio_path,
            speed=req.speed or 1.0,
            output_dir=OUTPUTS_DIR
        )
        elapsed = round(time.time() - t0, 2)
        device_used = engine.device.upper()

        # Clear console logging for every /api/synthesize request
        print(
            f"[Synthesize] Processed request | "
            f"Chars: {char_count} | "
            f"Voice: {voice_label} | "
            f"Device: {device_used} | "
            f"Elapsed: {elapsed}s | "
            f"Output: {filename}"
        )

        entry = {
            "id": filename.replace(".wav", ""),
            "filename": filename,
            "text": clean_text,
            "duration": duration,
            "latency": elapsed,
            "device": engine.device,
            "profile_used": req.profile_id or ("uploaded" if req.temp_sample else "default"),
            "audio_url": f"/api/audio/{filename}",
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        _append_history(entry)

        return entry
    except HTTPException:
        raise
    except Exception as e:
        elapsed = round(time.time() - t0, 2)
        print(
            f"[Synthesize ERROR] Failed request | "
            f"Chars: {char_count} | "
            f"Voice: {voice_label} | "
            f"Device: {engine.device.upper()} | "
            f"Elapsed: {elapsed}s | "
            f"Error: {str(e)}"
        )
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")

@app.get("/api/audio/{filename}")
def serve_audio(filename: str, temp: Optional[int] = 0, profile: Optional[int] = 0):
    """
    Streams audio files (.wav) from outputs, profiles, or temp directories.
    Strictly prevents path traversal outside the storage envelope.
    """
    safe_filename = os.path.basename(filename)
    if safe_filename != filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid audio filename.")

    if profile:
        base_dir = PROFILES_DIR
    elif temp:
        base_dir = TEMP_DIR
    else:
        base_dir = OUTPUTS_DIR

    file_path = os.path.abspath(os.path.join(base_dir, safe_filename))
    if not file_path.startswith(os.path.abspath(base_dir)) or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found.")

    return FileResponse(file_path, media_type="audio/wav", filename=safe_filename)

@app.get("/api/history")
def get_history():
    return _read_history()

@app.get("/studio")
def serve_studio():
    studio_html = os.path.join(FRONTEND_DIR, "studio.html")
    if not os.path.exists(studio_html):
        raise HTTPException(status_code=404, detail="Studio console not found.")
    return FileResponse(studio_html, media_type="text/html")

@app.get("/docs-showcase")
def serve_docs_showcase():
    docs_html = os.path.join(DOCS_DIR, "index.html")
    if not os.path.exists(docs_html):
        raise HTTPException(status_code=404, detail="Docs showcase not found.")
    return FileResponse(docs_html, media_type="text/html")

@app.get("/docs")
def serve_docs():
    docs_html = os.path.join(DOCS_DIR, "index.html")
    if not os.path.exists(docs_html):
        raise HTTPException(status_code=404, detail="Docs showcase not found.")
    return FileResponse(docs_html, media_type="text/html")

# Mount Documentation showcase directory
app.mount("/docs", StaticFiles(directory=DOCS_DIR, html=True), name="docs")

# Direct fallback routes for docs-showcase relative assets
@app.get("/style.css")
def serve_docs_style():
    style_path = os.path.join(DOCS_DIR, "style.css")
    if os.path.exists(style_path):
        return FileResponse(style_path, media_type="text/css")
    raise HTTPException(status_code=404)

@app.get("/demo.js")
def serve_docs_demo():
    demo_path = os.path.join(DOCS_DIR, "demo.js")
    if os.path.exists(demo_path):
        return FileResponse(demo_path, media_type="application/javascript")
    raise HTTPException(status_code=404)

@app.get("/assets/{subpath:path}")
def serve_assets(subpath: str):
    docs_asset = os.path.join(DOCS_DIR, "assets", subpath)
    if os.path.exists(docs_asset) and os.path.isfile(docs_asset):
        return FileResponse(docs_asset)
    fe_asset = os.path.join(FRONTEND_DIR, "assets", subpath)
    if os.path.exists(fe_asset) and os.path.isfile(fe_asset):
        return FileResponse(fe_asset)
    raise HTTPException(status_code=404, detail="Asset not found")

# Serve Frontend static assets
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
