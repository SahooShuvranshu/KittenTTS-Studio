#!/usr/bin/env python3
"""
Kitten-TTS 2 Studio — System Verification Script
Validates audio utils, profile manager, engine telemetry, and FastAPI routes.
"""
import os
import sys
import numpy as np
import soundfile as sf

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.audio_utils import convert_to_wav, get_audio_metadata, validate_reference_audio
from backend.profiles import list_profiles, create_profile, delete_profile, get_profile
from backend.engine import KittenTTSEngine

def test_audio_pipeline():
    print("[1/4] Testing Audio Processing Pipeline...")
    temp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage", "temp"))
    os.makedirs(temp_dir, exist_ok=True)
    raw_path = os.path.join(temp_dir, "test_raw_sine.wav")
    clean_path = os.path.join(temp_dir, "test_clean_24k.wav")

    # Generate 5-second 440Hz sine wave at 44.1kHz
    sr_in = 44100
    t = np.linspace(0, 5, sr_in * 5, endpoint=False)
    sine = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    sf.write(raw_path, sine, sr_in)

    # Convert to 24kHz mono
    convert_to_wav(raw_path, clean_path, target_sr=24000)
    meta = get_audio_metadata(clean_path)
    assert meta["sample_rate"] == 24000, f"Expected 24000Hz, got {meta['sample_rate']}"
    assert meta["channels"] == 1, f"Expected 1 channel, got {meta['channels']}"
    assert abs(meta["duration"] - 5.0) < 0.1, f"Expected 5.0s, got {meta['duration']}"

    val = validate_reference_audio(clean_path)
    assert val["status"] == "optimal", f"Validation status: {val['status']}"

    # Cleanup test files
    if os.path.exists(raw_path): os.remove(raw_path)
    if os.path.exists(clean_path): os.remove(clean_path)
    print("  ✓ Audio processing (conversion, 24kHz resampling, metadata, validation) passed.")

def test_profile_manager():
    print("[2/4] Testing Voice Profile Manager...")
    temp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage", "temp"))
    test_sample = os.path.join(temp_dir, "profile_test_sample.wav")
    sr = 24000
    t = np.linspace(0, 4, sr * 4, endpoint=False)
    audio = (0.3 * np.sin(2 * np.pi * 300 * t)).astype(np.float32)
    sf.write(test_sample, audio, sr)

    profile = create_profile(name="Test Speaker", src_audio_path=test_sample, description="Automated verification test")
    p_id = profile["id"]
    assert profile["name"] == "Test Speaker"
    assert profile["sample_rate"] == 24000

    fetched = get_profile(p_id)
    assert fetched is not None
    assert fetched["id"] == p_id

    # Delete
    deleted = delete_profile(p_id)
    assert deleted is True
    assert get_profile(p_id) is None
    if os.path.exists(test_sample): os.remove(test_sample)
    print("  ✓ Voice profile creation, indexing, audio persistence, and deletion passed.")

def test_engine_telemetry():
    print("[3/4] Testing Engine & System Telemetry...")
    engine = KittenTTSEngine.get_instance()
    telem = engine.get_telemetry()
    assert "ram_total_gb" in telem
    assert "ram_used_gb" in telem
    assert telem["device"] == "cpu"
    print(f"  ✓ Telemetry verified: RAM {telem['ram_used_gb']}G / {telem['ram_total_gb']}G (Device: {telem['device']})")

def test_fastapi_app():
    print("[4/4] Testing FastAPI App & Static Assets...")
    from fastapi.testclient import TestClient
    from backend.app import app
    client = TestClient(app)

    # Telemetry endpoint
    r = client.get("/api/telemetry")
    assert r.status_code == 200, f"Status code: {r.status_code}"
    assert "ram_used_gb" in r.json()

    # Profiles endpoint
    r = client.get("/api/profiles")
    assert r.status_code == 200

    # History endpoint
    r = client.get("/api/history")
    assert r.status_code == 200

    # Frontend index.html
    r = client.get("/")
    assert r.status_code == 200
    assert "Kitten-TTS 2 Studio" in r.text
    print("  ✓ FastAPI routes and frontend static serving verified.")

if __name__ == "__main__":
    print("\n--- Running Kitten-TTS 2 Studio Verification Suite ---")
    test_audio_pipeline()
    test_profile_manager()
    test_engine_telemetry()
    test_fastapi_app()
    print("\n🎉 ALL VERIFICATION CHECKS PASSED!\n")
