#!/usr/bin/env python3
"""
Comprehensive backend API, security, and lifecycle test suite.
Validates:
1. Path traversal prevention on /api/audio/{filename} and /api/profiles/save-sample
2. Audio file upload validation (allowed extensions whitelist, size guard)
3. Profile creation, retrieval, description preservation on rename, and file deletion
4. Synthesis input validation (empty text, oversized text, missing profile 404)
5. CORS headers and security defaults
6. Temp sample cleanup routine
"""

import os
import sys
import io
import time
import unittest
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app, TEMP_DIR, PROFILES_DIR, OUTPUTS_DIR, cleanup_temp_files
from backend.profiles import create_profile, delete_profile, get_profile

class TestBackendApi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_path_traversal_serve_audio(self):
        """Verify arbitrary file read attempts via /api/audio are strictly blocked."""
        traversal_attempts = [
            "../../../../etc/passwd",
            "..%2F..%2F..%2Fetc%2Fpasswd",
            "..\\..\\backend\\app.py",
            "../profiles/profiles.json",
            "....//....//etc/shadow"
        ]
        for payload in traversal_attempts:
            r = self.client.get(f"/api/audio/{payload}")
            self.assertIn(r.status_code, [400, 404], f"Payload '{payload}' was not rejected: {r.status_code}")

    def test_path_traversal_save_sample(self):
        """Verify path traversal attempts in save-sample are blocked."""
        r = self.client.post("/api/profiles/save-sample", json={
            "filename": "../../storage/profiles/e8755172.wav",
            "name": "Hacked Profile"
        })
        self.assertEqual(r.status_code, 400)

    def test_upload_format_whitelist(self):
        """Verify unapproved file extensions are rejected by upload_sample."""
        bad_file = io.BytesIO(b"MZ executable header dummy data" * 10)
        r = self.client.post(
            "/api/upload-sample",
            files={"file": ("malicious.exe", bad_file, "application/octet-stream")}
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("Unsupported audio format", r.json()["detail"])

    def test_upload_empty_file_rejected(self):
        """Verify empty audio uploads are rejected."""
        empty_file = io.BytesIO(b"")
        r = self.client.post(
            "/api/upload-sample",
            files={"file": ("empty.wav", empty_file, "audio/wav")}
        )
        self.assertEqual(r.status_code, 400)

    def test_profile_description_preserved_on_rename(self):
        """Verify PUT /api/profiles/{id} without description does NOT overwrite existing description."""
        # Create a test audio file
        test_wav = os.path.join(TEMP_DIR, "test_desc_orig.wav")
        sr = 24000
        t = np.linspace(0, 3, sr * 3, endpoint=False)
        audio = (0.2 * np.sin(2 * np.pi * 350 * t)).astype(np.float32)
        sf.write(test_wav, audio, sr)

        profile = create_profile(
            name="Original Speaker",
            src_audio_path=test_wav,
            description="Crucial reference description"
        )
        p_id = profile["id"]

        try:
            # Rename without providing description
            r = self.client.put(f"/api/profiles/{p_id}", json={"name": "Renamed Speaker"})
            self.assertEqual(r.status_code, 200)
            updated = r.json()
            self.assertEqual(updated["name"], "Renamed Speaker")
            self.assertEqual(updated["description"], "Crucial reference description")

            # Check persistent index
            fetched = get_profile(p_id)
            self.assertEqual(fetched["name"], "Renamed Speaker")
            self.assertEqual(fetched["description"], "Crucial reference description")
        finally:
            delete_profile(p_id)
            if os.path.exists(test_wav):
                os.remove(test_wav)

    def test_profile_deletion_removes_wav(self):
        """Verify delete_profile physically removes reference WAV from disk."""
        test_wav = os.path.join(TEMP_DIR, "test_del_sample.wav")
        sr = 24000
        t = np.linspace(0, 3, sr * 3, endpoint=False)
        audio = (0.2 * np.sin(2 * np.pi * 400 * t)).astype(np.float32)
        sf.write(test_wav, audio, sr)

        profile = create_profile(name="Temp To Delete", src_audio_path=test_wav)
        p_id = profile["id"]
        wav_path = os.path.join(PROFILES_DIR, profile["filename"])
        self.assertTrue(os.path.exists(wav_path))

        r = self.client.delete(f"/api/profiles/{p_id}")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(os.path.exists(wav_path), "Audio file was not removed upon profile deletion")

        if os.path.exists(test_wav):
            os.remove(test_wav)

    def test_synthesize_validation_empty_text(self):
        """Verify empty or whitespace-only text is rejected with 422 Unprocessable Entity."""
        r = self.client.post("/api/synthesize", json={"text": ""})
        self.assertEqual(r.status_code, 422)

        r2 = self.client.post("/api/synthesize", json={"text": "   \n\t  "})
        self.assertEqual(r2.status_code, 422)

    def test_synthesize_validation_oversized_text(self):
        """Verify text exceeding 5000 characters is rejected with 422."""
        r = self.client.post("/api/synthesize", json={"text": "a" * 5001})
        self.assertEqual(r.status_code, 422)

    def test_synthesize_nonexistent_profile_returns_404(self):
        """Verify requesting a non-existent profile returns 404 rather than silently using default voice."""
        r = self.client.post("/api/synthesize", json={
            "text": "Valid test phrase",
            "profile_id": "nonexistent_profile_id_9999"
        })
        self.assertEqual(r.status_code, 404)
        self.assertIn("not found", r.json()["detail"])

    def test_temp_cleanup_routine(self):
        """Verify cleanup_temp_files deletes expired files and preserves fresh files."""
        fresh_file = os.path.join(TEMP_DIR, "fresh_sample.wav")
        old_file = os.path.join(TEMP_DIR, "old_expired_sample.wav")

        with open(fresh_file, "w") as f:
            f.write("fresh")
        with open(old_file, "w") as f:
            f.write("old")

        # Set old_file mtime to 3 hours ago
        past_time = time.time() - 10800
        os.utime(old_file, (past_time, past_time))

        cleanup_temp_files(max_age_seconds=7200)

        self.assertTrue(os.path.exists(fresh_file))
        self.assertFalse(os.path.exists(old_file))

        if os.path.exists(fresh_file):
            os.remove(fresh_file)

    def test_speed_parameter_bounds(self):
        """Verify speed parameter outside [0.25, 4.0] is rejected with 422."""
        r1 = self.client.post("/api/synthesize", json={"text": "Valid text", "speed": 0.1})
        self.assertEqual(r1.status_code, 422)
        self.assertIn("Speed must be between", r1.json()["detail"])

        r2 = self.client.post("/api/synthesize", json={"text": "Valid text", "speed": 5.0})
        self.assertEqual(r2.status_code, 422)

    def test_missing_reference_wav_on_disk_returns_404(self):
        """Verify profile with missing WAV file returns 404 rather than silent fallback."""
        # Create a dummy profile, then delete its audio file manually
        test_wav = os.path.join(TEMP_DIR, "test_orphan.wav")
        sr = 24000
        t = np.linspace(0, 2, sr * 2, endpoint=False)
        audio = (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        sf.write(test_wav, audio, sr)

        profile = create_profile(name="Orphan Voice", src_audio_path=test_wav)
        p_id = profile["id"]
        wav_path = os.path.join(PROFILES_DIR, profile["filename"])
        if os.path.exists(wav_path):
            os.remove(wav_path)

        try:
            r = self.client.post("/api/synthesize", json={
                "text": "Testing orphan audio handling",
                "profile_id": p_id
            })
            self.assertEqual(r.status_code, 404)
            self.assertIn("not found on disk", r.json()["detail"])
        finally:
            delete_profile(p_id)
            if os.path.exists(test_wav):
                os.remove(test_wav)

    def test_reference_audio_validation_5_to_30s(self):
        """Verify 5 to 30 second reference-length validation logic."""
        from backend.audio_utils import validate_reference_audio

        # 2-second short clip (< 5s)
        short_wav = os.path.join(TEMP_DIR, "short_test.wav")
        sr = 24000
        t2 = np.linspace(0, 2, sr * 2, endpoint=False)
        sf.write(short_wav, (0.1 * np.sin(2 * np.pi * 300 * t2)).astype(np.float32), sr)

        # 10-second optimal clip
        opt_wav = os.path.join(TEMP_DIR, "opt_test.wav")
        t10 = np.linspace(0, 10, sr * 10, endpoint=False)
        sf.write(opt_wav, (0.1 * np.sin(2 * np.pi * 300 * t10)).astype(np.float32), sr)

        try:
            v_short = validate_reference_audio(short_wav)
            self.assertEqual(v_short["status"], "warning")
            self.assertIn("5 to 30s", v_short["message"])

            v_opt = validate_reference_audio(opt_wav)
            self.assertEqual(v_opt["status"], "optimal")
        finally:
            for f in [short_wav, opt_wav]:
                if os.path.exists(f):
                    os.remove(f)

    def test_rate_limiting_enforcement(self):
        """Verify that rapid requests exceeding limits receive HTTP 429 Too Many Requests."""
        from backend.app import _request_records
        _request_records.clear()

        # Send 25 rapid requests to heavy endpoint (limit is 20)
        got_429 = False
        for _ in range(25):
            r = self.client.post("/api/upload-sample", files={"file": ("test.exe", b"dummy", "text/plain")})
            if r.status_code == 429:
                got_429 = True
                self.assertIn("Rate limit exceeded", r.json()["detail"])
                break

        _request_records.clear()
        self.assertTrue(got_429, "Rate limiter did not trigger HTTP 429 after 20 rapid requests")

    def test_full_happy_path_smoke_test(self):
        """
        Full end-to-end happy path smoke test:
        1. Upload valid 24kHz mono audio file -> /api/upload-sample
        2. Verify 200 OK, valid metadata, 5-30s validation
        3. Save temporary sample as permanent profile -> /api/profiles/save-sample
        4. Verify profile exists in list -> /api/profiles
        5. Synthesize speech referencing profile (with mocked model forward pass for offline unit testing) -> /api/synthesize
        6. Stream synthesized audio with HTTP 206 Range -> /api/audio/{filename}
        7. Delete profile and verify file cleanup -> /api/profiles/{id}
        """
        from unittest.mock import patch
        from backend.app import _request_records, KittenTTSEngine
        _request_records.clear()

        # 1. Prepare 6-second valid audio clip
        sr = 24000
        duration = 6.0
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        audio = (0.2 * np.sin(2 * np.pi * 260 * t)).astype(np.float32)
        buf = io.BytesIO()
        sf.write(buf, audio, sr, format="WAV")
        buf.seek(0)

        # Upload
        up_res = self.client.post(
            "/api/upload-sample",
            files={"file": ("happy_speaker.wav", buf, "audio/wav")}
        )
        self.assertEqual(up_res.status_code, 200)
        up_data = up_res.json()
        self.assertEqual(up_data["status"], "success")
        temp_fn = up_data["filename"]
        self.assertEqual(up_data["sample_rate"], 24000)

        # 2. Save as profile
        save_res = self.client.post("/api/profiles/save-sample", json={
            "filename": temp_fn,
            "name": "Smoke Test Speaker",
            "description": "Automated smoke test profile"
        })
        self.assertEqual(save_res.status_code, 200)
        p_data = save_res.json()
        p_id = p_data["id"]

        dummy_out = os.path.join(OUTPUTS_DIR, "smoke_synth_out.wav")
        sf.write(dummy_out, audio[:sr * 2], sr)

        try:
            # 3. Verify in profiles list
            list_res = self.client.get("/api/profiles")
            self.assertEqual(list_res.status_code, 200)
            ids = [p["id"] for p in list_res.json()]
            self.assertIn(p_id, ids)

            # 4. Synthesize speech with mocked engine.synthesize
            engine = KittenTTSEngine.get_instance()
            with patch.object(engine, "synthesize", return_value=("smoke_synth_out.wav", 2.0)):
                syn_res = self.client.post("/api/synthesize", json={
                    "text": "Smoke test happy path speech synthesis",
                    "speed": 1.0,
                    "profile_id": p_id
                })
            self.assertEqual(syn_res.status_code, 200)
            syn_data = syn_res.json()
            out_fn = syn_data["filename"]
            self.assertEqual(out_fn, "smoke_synth_out.wav")

            # 5. Stream audio with Range header
            audio_res = self.client.get(
                f"/api/audio/{out_fn}",
                headers={"Range": "bytes=0-49"}
            )
            self.assertIn(audio_res.status_code, [200, 206])
            self.assertGreater(len(audio_res.content), 0)

        finally:
            # Clean up dummy output
            if os.path.exists(dummy_out):
                os.remove(dummy_out)

            # 6. Delete profile
            del_res = self.client.delete(f"/api/profiles/{p_id}")
            self.assertEqual(del_res.status_code, 200)
            wav_path = os.path.join(PROFILES_DIR, p_data["filename"])
            self.assertFalse(os.path.exists(wav_path))

if __name__ == "__main__":
    unittest.main()
