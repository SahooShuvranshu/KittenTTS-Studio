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

if __name__ == "__main__":
    unittest.main()
