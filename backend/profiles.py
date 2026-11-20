import os
import json
import uuid
import time
from typing import List, Dict, Any, Optional
from backend.audio_utils import convert_to_wav, get_audio_metadata

STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage", "profiles"))
INDEX_FILE = os.path.join(STORAGE_DIR, "profiles.json")

def _ensure_storage():
    os.makedirs(STORAGE_DIR, exist_ok=True)
    if not os.path.exists(INDEX_FILE):
        with open(INDEX_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)

def _read_index() -> List[Dict[str, Any]]:
    _ensure_storage()
    try:
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def _write_index(profiles: List[Dict[str, Any]]) -> None:
    _ensure_storage()
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(profiles, f, indent=2)

def list_profiles() -> List[Dict[str, Any]]:
    return _read_index()

def get_profile(profile_id: str) -> Optional[Dict[str, Any]]:
    profiles = _read_index()
    for p in profiles:
        if p["id"] == profile_id:
            return p
    return None

def create_profile(name: str, src_audio_path: str, description: str = "") -> Dict[str, Any]:
    _ensure_storage()
    profile_id = str(uuid.uuid4())[:8]
    dest_filename = f"{profile_id}.wav"
    dest_path = os.path.join(STORAGE_DIR, dest_filename)

    # Normalize to 24kHz Mono WAV
    convert_to_wav(src_audio_path, dest_path, target_sr=24000)
    meta = get_audio_metadata(dest_path)

    profile = {
        "id": profile_id,
        "name": name.strip() or f"Voice {profile_id}",
        "description": description.strip(),
        "filename": dest_filename,
        "duration": meta["duration"],
        "sample_rate": meta["sample_rate"],
        "size_kb": meta["size_kb"],
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    profiles = _read_index()
    profiles.append(profile)
    _write_index(profiles)
    return profile

def update_profile(profile_id: str, name: Optional[str] = None, description: Optional[str] = None) -> Optional[Dict[str, Any]]:
    profiles = _read_index()
    target = None
    for p in profiles:
        if p["id"] == profile_id:
            if name is not None and name.strip():
                p["name"] = name.strip()
            if description is not None:
                p["description"] = description.strip()
            target = p
            break
    if target:
        _write_index(profiles)
    return target

def delete_profile(profile_id: str) -> bool:
    profiles = _read_index()
    kept = []
    found = False
    for p in profiles:
        if p["id"] == profile_id:
            found = True
            raw_fn = p.get("filename", "")
            safe_fn = os.path.basename(raw_fn) if raw_fn else ""
            if safe_fn and safe_fn == raw_fn and safe_fn.endswith(".wav"):
                audio_path = os.path.abspath(os.path.join(STORAGE_DIR, safe_fn))
                if audio_path.startswith(os.path.abspath(STORAGE_DIR)) and os.path.isfile(audio_path):
                    try:
                        os.remove(audio_path)
                    except OSError:
                        pass
        else:
            kept.append(p)
    if found:
        _write_index(kept)
    return found
