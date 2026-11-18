import os
import gc
import sys
import time
import uuid
import psutil
import soundfile as sf
import numpy as np
from typing import Optional, Dict, Any, Tuple

class KittenTTSEngine:
    """
    Manages loading and execution of Kitten-TTS 2 for speech synthesis and voice cloning.
    Supports GPU acceleration (CUDA) with automatic fallback to CPU.
    """
    _instance = None

    def __init__(self, model_name: str = "KittenML/kitten-tts-2", device: Optional[str] = None):
        self.model_name = model_name
        self._model = None
        self.sample_rate = 24000

        if device is not None:
            self.device = device
        else:
            # Check CUDA availability
            try:
                import torch
                if torch.cuda.is_available():
                    self.device = "cuda"
                else:
                    self.device = "cpu"
            except Exception:
                self.device = "cpu"

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = KittenTTSEngine()
        return cls._instance

    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self):
        """
        Loads KittenTTS model. If CUDA was selected, attempts initialization on GPU.
        Automatically catches device/memory errors and falls back to CPU.
        """
        if self._model is not None:
            return self._model

        from kittenml import KittenTTS

        if self.device == "cuda":
            try:
                print(f"[Engine] Attempting Kitten-TTS 2 initialization on CUDA GPU...")
                self._model = KittenTTS(self.model_name, device="cuda")
                if hasattr(self._model, "sample_rate"):
                    self.sample_rate = self._model.sample_rate
                print(f"[Engine] Kitten-TTS 2 successfully initialized on CUDA GPU.")
                return self._model
            except Exception as e:
                print(f"[Engine] CUDA initialization failed ({e}). Falling back to CPU...")
                self.device = "cpu"
                self._model = None
                try:
                    import torch
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                except Exception:
                    pass
                gc.collect()

        # Initialize on CPU
        try:
            print(f"[Engine] Initializing Kitten-TTS 2 on CPU...")
            self._model = KittenTTS(self.model_name, device="cpu")
            if hasattr(self._model, "sample_rate"):
                self.sample_rate = self._model.sample_rate
            print(f"[Engine] Kitten-TTS 2 successfully initialized on CPU.")
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
        Supports automatic CPU fallback on CUDA error or OOM.
        Dual-engine audio saving with soundfile and scipy.io.wavfile fallback.
        Returns: (output_filename, duration_seconds)
        """
        if not text or not text.strip():
            raise ValueError("Input text cannot be empty.")

        model = self.load()

        kwargs = {}
        if reference_path and os.path.exists(reference_path):
            kwargs["reference"] = reference_path

        # Kitten-TTS 2 synthesis with CUDA error / OOM fallback
        try:
            audio = model.generate(text.strip(), **kwargs)
        except Exception as e:
            if self.device == "cuda":
                print(f"[Engine] CUDA generation failed ({e}). Falling back to CPU...")
                self.device = "cpu"
                self._model = None
                try:
                    import torch
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                except Exception:
                    pass
                gc.collect()
                model = self.load()
                audio = model.generate(text.strip(), **kwargs)
            else:
                raise

        sr = getattr(model, "sample_rate", self.sample_rate)

        # Apply speed stretching if requested
        speed = float(speed)
        if abs(speed - 1.0) >= 0.05:
            try:
                import librosa
                audio = librosa.effects.time_stretch(audio, rate=speed)
            except Exception as e:
                print(f"[Engine] Speed stretch note: {e}")

        # Destination path validation
        if not output_dir:
            output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage", "outputs"))
        os.makedirs(output_dir, exist_ok=True)
        if not os.access(output_dir, os.W_OK):
            try:
                os.chmod(output_dir, 0o775)
            except Exception:
                pass

        filename = f"gen_{int(time.time())}_{uuid.uuid4().hex[:6]}.wav"
        out_path = os.path.join(output_dir, filename)

        # Dual-engine audio saving (soundfile with scipy fallback)
        try:
            sf.write(out_path, audio, sr)
        except Exception as sf_err:
            print(f"[Engine] soundfile.write failed ({sf_err}). Falling back to scipy.io.wavfile...")
            try:
                import scipy.io.wavfile as wavfile
                audio_arr = np.asarray(audio, dtype=np.float32)
                pcm16 = (np.clip(audio_arr, -1.0, 1.0) * 32767).astype(np.int16)
                wavfile.write(out_path, sr, pcm16)
                print(f"[Engine] Audio successfully written via scipy fallback: {out_path}")
            except Exception as scipy_err:
                raise RuntimeError(
                    f"Dual-engine audio writing failed: soundfile={sf_err} | scipy={scipy_err}"
                )

        # Reclaim intermediate memory
        gc.collect()

        duration = round(len(audio) / sr, 2)
        return filename, duration

    def get_telemetry(self) -> Dict[str, Any]:
        """
        Returns real-time host RAM, CPU, GPU, and model execution state.
        """
        mem = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=None)
        gpu_name = None
        cuda_available = False
        try:
            import torch
            cuda_available = torch.cuda.is_available()
            if cuda_available:
                gpu_name = torch.cuda.get_device_name(0)
        except Exception:
            pass

        return {
            "model_name": self.model_name,
            "device": self.device,
            "gpu_name": gpu_name,
            "cuda_available": cuda_available,
            "model_loaded": self.is_loaded(),
            "sample_rate": self.sample_rate,
            "ram_total_gb": round(mem.total / (1024 ** 3), 2),
            "ram_used_gb": round(mem.used / (1024 ** 3), 2),
            "ram_available_gb": round(mem.available / (1024 ** 3), 2),
            "ram_percent": mem.percent,
            "cpu_percent": cpu
        }
