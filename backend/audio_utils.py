import os
import subprocess
import soundfile as sf
from typing import Dict, Any, Optional

TARGET_SAMPLE_RATE = 24000

def convert_to_wav(input_path: str, output_path: str, target_sr: int = TARGET_SAMPLE_RATE) -> str:
    """
    Converts any audio file to a clean mono PCM 16-bit WAV at target_sr (default 24kHz)
    using ffmpeg. This handles mp3, m4a, flac, ogg, webm, and raw wavs effortlessly.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel", "error",
        "-i", input_path,
        "-ar", str(target_sr),
        "-ac", "1",
        "-c:a", "pcm_s16le",
        output_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg conversion failed: {result.stderr.strip()}")
    return output_path

def get_audio_metadata(file_path: str) -> Dict[str, Any]:
    """
    Inspects audio file duration, sample rate, channels, and size.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    try:
        info = sf.info(file_path)
        size_bytes = os.path.getsize(file_path)
        return {
            "duration": round(info.duration, 3),
            "sample_rate": info.samplerate,
            "channels": info.channels,
            "format": info.format,
            "subtype": info.subtype,
            "size_bytes": size_bytes,
            "size_kb": round(size_bytes / 1024, 1)
        }
    except Exception as e:
        # Fallback using ffprobe
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration,size:stream=sample_rate,channels",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        lines = [l.strip() for l in res.stdout.strip().split("\n") if l.strip()]
        duration = float(lines[2]) if len(lines) > 2 else 0.0
        return {
            "duration": round(duration, 3),
            "sample_rate": int(lines[0]) if len(lines) > 0 else TARGET_SAMPLE_RATE,
            "channels": int(lines[1]) if len(lines) > 1 else 1,
            "size_bytes": os.path.getsize(file_path),
            "size_kb": round(os.path.getsize(file_path) / 1024, 1)
        }

def validate_reference_audio(file_path: str) -> Dict[str, Any]:
    """
    Validates audio suitability for zero-shot voice cloning.
    Recommends 5 to 30 seconds of clean speech.
    """
    meta = get_audio_metadata(file_path)
    dur = meta["duration"]
    status = "optimal"
    msg = f"Audio duration: {dur}s. Ideal for voice cloning."

    if dur < 3.0:
        status = "warning"
        msg = f"Duration ({dur}s) is very short. Clips between 5-30s produce best speaker fidelity."
    elif dur > 60.0:
        status = "warning"
        msg = f"Duration ({dur}s) is long. Consider trimming to a 10-30s clean sentence for faster processing."

    return {
        "status": status,
        "message": msg,
        "metadata": meta
    }
