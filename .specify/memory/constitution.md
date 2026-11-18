# Kitten-TTS 2 Studio Constitution

## Core Principles

### I. Minimal Retro-Futurist Brutalism (NON-NEGOTIABLE)
- Industrial engineering aesthetic inspired by Dieter Rams, Teenage Engineering, Braun, and NASA telemetry instrumentation.
- Palette strictly anchored to matte charcoal chassis (`#090a0d`, `#111318`, `#181b22`), bone cream (`#eeebe3`), signal amber (`#ff8800`), and phosphor green (`#00ff88`).
- Absolute zero tolerance for cartoon elements, pastel pinks, or playful kitty emojis (🐾, 🐱, 🧶).
- Tactile brutalist physical depth: solid 2px borders, hard zero-blur offset block shadows (`4px 4px 0px #000`), tactile mechanical button depression on active state.

### II. 100% Offline & Zero Cloud Telemetry
- All speech synthesis and zero-shot voice cloning must execute strictly offline on local hardware.
- Zero analytics, zero tracking beacons, zero external cloud dependencies.
- No network requests during inference; models run strictly from local storage / cache.

### III. Strict 8 GB Physical RAM Budget & Hardware Optimization
- Total system working set must remain under 1.5 GB for the model, ensuring safe execution on consumer laptops with 8 GB physical RAM envelopes (7.6 GiB usable).
- Vectorized CPU execution (AVX2 / AVX-512) with automatic fallback.
- Where CUDA is available (e.g. NVIDIA MX250), opportunistically leverage GPU acceleration with seamless, automatic fallback to CPU upon OOM or device errors.

### IV. Broadcast Audio Standards (24 kHz PCM WAV)
- All speech output and voice profile references are strictly normalized to 24,000 Hz, 16-bit mono PCM WAV.
- Live microphone ingestion, upload transcoding (via FFmpeg), and synthesis pipelines must maintain exact 24 kHz alignment with automatic volume normalization and headroom clamping.

### V. Continuous Verification & DOM Contracts
- Every feature must be verified against `scripts/verify_setup.py`.
- Frontend DOM element IDs and backend REST endpoint contracts are strictly defined and must remain stable across refactors.
- Real-time phosphor CRT oscilloscope visualizers must provide true audio waveform/formant tracing without cartoon artifacts.

## Governance

- All pull requests, features, and model upgrades must comply with these principles.
- Code authored by Shuvransu Sekhar Sahoo with the help of Antigravity AI (Google DeepMind).

**Version**: 1.0.0 | **Ratified**: 2026-11-18 | **Last Amended**: 2026-11-18
