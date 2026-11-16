import os
import gc
import time
import uuid
import psutil
import soundfile as sf
import numpy as np
from typing import Optional, Dict, Any, Tuple

class KittenTTSEngine:
    """
    Manages loading and CPU execution of Kitten-TTS 2 for speech synthesis and voice cloning.
    """
    _instance = None

    def __init__(self, model_name: str = "KittenML/kitten-tts-2", device: str = "cpu"):
        self.model_name = model_name
        self.device = device
        self._model = None
        self.sample_rate = 24000

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = KittenTTSEngine()
        return cls._instance

    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self):
        if self._model is not None:
            return self._model
        try:
            from kittenml import KittenTTS
            # Force CPU device to protect the host 8GB RAM envelope
            self._model = KittenTTS(self.model_name, device=self.device)
            if hasattr(self._model, "sample_rate"):
                self.sample_rate = self._model.sample_rate
            return self._model
        except Exception as e:
            raise RuntimeError(f"Failed to load Kitten-TTS 2 ({self.model_name}): {str(e)}")

    def synthesize(
        self,
        text: str,
        reference_path: Optional[str] = None,
        speed: float = 1.0,
        output_dir: Optional[str] = None
    ) -> Tuple[str, float]:
        """
        Executes text synthesis. If reference_path is provided, clones the speaker in-context.
        Returns: (output_filename, duration_seconds)
        """
        if not text or not text.strip():
            raise ValueError("Input text cannot be empty.")

        model = self.load()

        kwargs = {}
        if reference_path and os.path.exists(reference_path):
            kwargs["reference"] = reference_path

        # Kitten-TTS 2 synthesis
        audio = model.generate(text.strip(), **kwargs)
        sr = getattr(model, "sample_rate", self.sample_rate)

        # Apply speed stretching if requested
        speed = float(speed)
        if abs(speed - 1.0) >= 0.05:
            try:
                import librosa
                audio = librosa.effects.time_stretch(audio, rate=speed)
            except Exception as e:
                print(f"[Engine] Speed stretch note: {e}")

        # Destination path
        if not output_dir:
            output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage", "outputs"))
        os.makedirs(output_dir, exist_ok=True)

        filename = f"gen_{int(time.time())}_{uuid.uuid4().hex[:6]}.wav"
        out_path = os.path.join(output_dir, filename)

        sf.write(out_path, audio, sr)

        # Reclaim intermediate memory
        gc.collect()

        duration = round(len(audio) / sr, 2)
        return filename, duration

    def get_telemetry(self) -> Dict[str, Any]:
        """
        Returns real-time host RAM, CPU, and model execution state.
        """
        mem = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=None)
        return {
            "model_name": self.model_name,
            "device": self.device,
            "model_loaded": self.is_loaded(),
            "sample_rate": self.sample_rate,
            "ram_total_gb": round(mem.total / (1024 ** 3), 2),
            "ram_used_gb": round(mem.used / (1024 ** 3), 2),
            "ram_available_gb": round(mem.available / (1024 ** 3), 2),
            "ram_percent": mem.percent,
            "cpu_percent": cpu
        }
