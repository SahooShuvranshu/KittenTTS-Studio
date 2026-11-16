import os
import json
import time
import uuid
import shutil
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
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
HISTORY_FILE = os.path.join(OUTPUTS_DIR, "history.json")

# Ensure directories exist
for d in [STORAGE_DIR, OUTPUTS_DIR, PROFILES_DIR, TEMP_DIR]:
    os.makedirs(d, exist_ok=True)

app = FastAPI(title="Kitten-TTS 2 Studio", version="1.0.0")

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
    description: Optional[str] = ""

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
    Accepts user audio file (.wav, .mp3, .m4a, .flac, .ogg), normalizes to 24kHz mono WAV.
    """
    ext = os.path.splitext(file.filename)[1].lower() or ".wav"
    raw_filename = f"raw_{uuid.uuid4().hex[:8]}{ext}"
    raw_path = os.path.join(TEMP_DIR, raw_filename)

    with open(raw_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    clean_filename = f"sample_{uuid.uuid4().hex[:8]}.wav"
    clean_path = os.path.join(TEMP_DIR, clean_filename)

    try:
        convert_to_wav(raw_path, clean_path, target_sr=24000)
        val = validate_reference_audio(clean_path)
        meta = val["metadata"]

        # Clean raw source file to save disk space
        if os.path.exists(raw_path):
            os.remove(raw_path)

        return {
            "status": "success",
            "filename": clean_filename,
            "original_filename": file.filename,
            "duration": meta["duration"],
            "sample_rate": meta["sample_rate"],
            "size_kb": meta["size_kb"],
            "validation": val
        }
    except Exception as e:
        if os.path.exists(raw_path):
            os.remove(raw_path)
        if os.path.exists(clean_path):
            os.remove(clean_path)
        raise HTTPException(status_code=400, detail=f"Audio processing failed: {str(e)}")

@app.post("/api/profiles/save-sample")
def save_sample_as_profile(req: SaveSampleProfileRequest):
    src_path = os.path.join(TEMP_DIR, req.filename)
    if not os.path.exists(src_path):
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
    raw_path = os.path.join(TEMP_DIR, f"rec_raw_{uuid.uuid4().hex[:8]}.webm")
    with open(raw_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        profile = create_profile(name=name, src_audio_path=raw_path, description=description or "")
        if os.path.exists(raw_path):
            os.remove(raw_path)
        return profile
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
    ref_audio_path = None

    if req.profile_id:
        profile = get_profile(req.profile_id)
        if profile:
            ref_audio_path = os.path.join(PROFILES_DIR, profile["filename"])
    elif req.temp_sample:
        temp_path = os.path.join(TEMP_DIR, req.temp_sample)
        if os.path.exists(temp_path):
            ref_audio_path = temp_path

    engine = KittenTTSEngine.get_instance()
    t0 = time.time()

    try:
        filename, duration = engine.synthesize(
            text=req.text,
            reference_path=ref_audio_path,
            speed=req.speed or 1.0,
            output_dir=OUTPUTS_DIR
        )
        elapsed = round(time.time() - t0, 2)

        entry = {
            "id": filename.replace(".wav", ""),
            "filename": filename,
            "text": req.text,
            "duration": duration,
            "latency": elapsed,
            "profile_used": req.profile_id or ("uploaded" if req.temp_sample else "default"),
            "audio_url": f"/api/audio/{filename}",
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        _append_history(entry)

        return entry
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")

@app.get("/api/audio/{filename}")
def serve_audio(filename: str, temp: Optional[int] = 0, profile: Optional[int] = 0):
    """
    Streams audio files (.wav) from outputs, profiles, or temp directories.
    """
    if profile:
        file_path = os.path.join(PROFILES_DIR, filename)
    elif temp:
        file_path = os.path.join(TEMP_DIR, filename)
    else:
        file_path = os.path.join(OUTPUTS_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found.")

    return FileResponse(file_path, media_type="audio/wav", filename=filename)

@app.get("/api/history")
def get_history():
    return _read_history()

# Serve Frontend static assets
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
