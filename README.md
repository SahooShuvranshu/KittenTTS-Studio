<div align="center">

# 🎛️ Kitten-TTS 2 Studio

**An industrial, minimal retro-futurist speech synthesis and zero-shot voice cloning console.**  
*Powered by Kitten-TTS 2 (1.7B Ternary SLM) • 100% Offline • Built by Shuvransu with the help of Antigravity*

<br/>

<!-- ==================== BADGE MATRIX (FOR-THE-BADGE STYLE) ==================== -->
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org)
[![Model](https://img.shields.io/badge/Model-Kitten--TTS%202%20(1.7B)-10B981?style=for-the-badge&logo=huggingface&logoColor=white)](https://huggingface.co/KittenML/kitten-tts-2)
[![Weights](https://img.shields.io/badge/Weights-1.6--bit%20Ternary%20SLM-2B3245?style=for-the-badge&labelColor=0E1116)]()
[![Audio Output](https://img.shields.io/badge/Audio-24kHz%20PCM%20WAV-2563EB?style=for-the-badge&logo=audio-technica&logoColor=white)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-FF8800?style=for-the-badge&labelColor=0E1116)](LICENSE)

[![Built with Antigravity AI](https://img.shields.io/badge/Built%20with-Antigravity%20AI-00FF88?style=for-the-badge&logo=google&logoColor=black&labelColor=0E1116)](https://deepmind.google)
[![RAM Budget](https://img.shields.io/badge/RAM%20Envelope-8GB%20Safe-8B5CF6?style=for-the-badge&labelColor=0E1116)]()
[![Execution](https://img.shields.io/badge/Execution-CPU%20AVX2-6366F1?style=for-the-badge&labelColor=0E1116)]()
[![Offline](https://img.shields.io/badge/Privacy-100%25%20Offline-00FF88?style=for-the-badge&labelColor=0E1116)]()
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS-14B8A6?style=for-the-badge&logo=linux&logoColor=white)]()

[![GitHub Stars](https://img.shields.io/github/stars/SahooShuvranshu/KittenTTS-Studio?style=for-the-badge&color=FF8800&labelColor=0E1116)](https://github.com/SahooShuvranshu/KittenTTS-Studio/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/SahooShuvranshu/KittenTTS-Studio?style=for-the-badge&color=EEEBE3&labelColor=0E1116)](https://github.com/SahooShuvranshu/KittenTTS-Studio/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/SahooShuvranshu/KittenTTS-Studio?style=for-the-badge&color=FF3744&labelColor=0E1116)](https://github.com/SahooShuvranshu/KittenTTS-Studio/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-00FF88?style=for-the-badge&labelColor=0E1116)](CONTRIBUTING.md)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-Yes-00FF88?style=for-the-badge&labelColor=0E1116)](https://github.com/SahooShuvranshu/KittenTTS-Studio)

<br/>

<p align="center">
  <img src="frontend/assets/og-card.png" alt="Kitten-TTS 2 Studio Interface" width="100%" style="border-radius:4px; border:2px solid #282d3b; box-shadow:4px 4px 0px #000;" />
</p>

<br/>

[**Live Showcase & Interactive Demo**](https://sahooshuvranshu.github.io/KittenTTS-Studio) • [**Architecture Docs**](ARCHITECTURE.md) • [**Contributing Guide**](CONTRIBUTING.md)

</div>

---

## ⚡ Overview

**Kitten-TTS 2 Studio** is an open-source, local audio workstation built by **Shuvransu** with the help of **Antigravity** (Google DeepMind) to clone human voices and synthesize expressive speech with zero cloud dependencies.

Inspired by Dieter Rams, Teenage Engineering, and NASA instrumentation aesthetics, the interface embraces a tactile brutalist design with high-contrast hardware telemetry, real-time CRT phosphor oscilloscope monitoring, and strict zero-shot offline execution.

Built upon **KittenML/kitten-tts-2**—a 1.7-billion-parameter speech language model compressed using exact 1.6-bit ternary weights—this studio runs comfortably on standard laptop CPUs within a strict **8 GB physical RAM budget**, producing broadcast-ready 24,000 Hz audio.

---

## 🎛️ Key Highlights & Instrumentation

- **Zero-Shot Voice Cloning**: Clone any voice in real time using a 5–30 second reference sample. No fine-tuning, training, or cloud upload required.
- **Dual Ingestion Hardware Bay**:
  - **Tactile Drag & Drop**: Accepts `.wav`, `.mp3`, `.m4a`, `.flac`, and `.ogg`. Automatically normalized to 24 kHz mono 16-bit PCM WAV via FFmpeg.
  - **Live Microphone Capture**: Capture reference audio directly from your microphone with calibrated VU-level dynamics.
- **Voice Profile Registry & Memory**: Save, tag, and audition multiple voice identities. Selections persist automatically across browser reloads via `localStorage`.
- **Expression & Event Syntax**: Control speech inflection with native tags:
  - Emotions: `[happy]`, `[whisper]`, `[serious]`, `[excited]`
  - Non-Speech Events: `<laugh>`, `<sigh>`
  - Stress & Prosody: `(((emphasis)))`
- **Minimal Retro-Futurist Workstation**: Clean hardware rack chassis featuring a real-time CRT phosphor oscilloscope trace (`#00ff88`) and strict 4px instrumentation grid.
- **100% Offline & Private**: Zero analytics, zero cloud transmission, zero telemetry.

---

## 🏗️ Technical Architecture

```mermaid
flowchart TD
    subgraph Frontend["🖥️ Hardware Studio Console"]
        Landing["Landing Page (index.html)"]
        Studio["Studio Console (studio.html)"]
        Oscilloscope["Web Audio API Oscilloscope & VU Meter"]
        ProfileMemory["localStorage Profile Persistence"]
    end

    subgraph Backend["⚡ FastAPI Application Layer"]
        Router["REST & Streaming Endpoints (backend/app.py)"]
        AudioPipeline["FFmpeg Audio Ingestion Pipeline (backend/audio_utils.py)"]
        ProfileStore["Voice Profile Database (backend/profiles.py)"]
        KittenEngine["Kitten-TTS 2 Model Runner (backend/engine.py)"]
    end

    subgraph Hardware["⚙️ Hardware Execution"]
        CPU["CPU Execution (AVX2 Vectorized)"]
        RAM["RAM Budget Guard (<1.5 GB Working Set)"]
    end

    Studio --> Router
    Router --> AudioPipeline
    AudioPipeline --> ProfileStore
    ProfileStore --> KittenEngine
    KittenEngine --> CPU
    KittenEngine --> RAM
    KittenEngine --> Router
    Router --> Oscilloscope
```

*For complete memory allocation profiles, codec specs, and benchmarks, see [ARCHITECTURE.md](ARCHITECTURE.md).*

---

## 🚀 Quickstart

### Prerequisites
- **OS**: Linux (Arch, Ubuntu, Debian, Fedora) or macOS.
- **Python**: 3.11 or 3.12 (Python 3.12 recommended).
- **FFmpeg**: Required for audio transcoding (`sudo pacman -S ffmpeg` or `sudo apt install ffmpeg`).
- **uv** (recommended) or `pip`.

### 1. Clone & Setup

```bash
git clone https://github.com/SahooShuvranshu/KittenTTS-Studio.git
cd KittenTTS-Studio

# Create virtual environment and install dependencies
uv venv .venv --python 3.12
source .venv/bin/activate
uv pip install -e .
```

### 2. Launch Local Studio

```bash
chmod +x run_studio.sh
./run_studio.sh
```

The studio starts at **`http://127.0.0.1:8765`** and opens automatically in your browser.

---

## 🌐 Remote & Cloud Deployment

Kitten-TTS 2 Studio is cloud-ready and can be hosted on a remote server, VPS, or private Tailscale mesh:

```bash
# Bind to all network interfaces with custom port
export HOST="0.0.0.0"
export PORT="8765"
export CORS_ORIGINS="*"

./run_studio.sh
```

Access the studio from any smartphone, laptop, or remote workstation over your network at `http://your-server-ip:8765`.

---

## 🎛️ Expression & Emotion Syntax Guide

Kitten-TTS 2 natively parses emotional markers and vocal inflections inline:

| Tag | Intonation Effect | Example Usage |
| :--- | :--- | :--- |
| `[happy]` | Warm, upbeat, energetic delivery | `[happy] Good morning! The system telemetry looks fantastic today.` |
| `[whisper]` | Quiet, intimate, breathy tone | `[whisper] Keep your voice down, the servers are sleeping.` |
| `[serious]` | Authoritative, firm, steady cadence | `[serious] Critical threshold reached. Initiating protocol zero.` |
| `[excited]` | Rapid tempo and elevated pitch | `[excited] We just benchmarked over 1.2x real-time generation on CPU!` |
| `<laugh>` | Audible laugh / chuckle event | `You really thought that would fail? <laugh> It compiled on the first try.` |
| `<sigh>` | Exhale / contemplative pause | `Another 3:00 AM debugging session. <sigh> Back to the terminal.` |
| `(((text)))` | Heavy pitch & volume emphasis | `This parameter is (((crucial))) for memory stability.` |

---

## 📡 REST API Reference

The backend provides a clean, self-documented REST API:

| Endpoint | Method | Payload | Description |
| :--- | :--- | :--- | :--- |
| `POST /api/synthesize` | JSON | `{ text, speed, profile_id }` | Synthesizes text; clones speaker if `profile_id` is passed. |
| `POST /api/upload-sample` | Multipart | Audio File | Normalizes upload to 24kHz mono WAV and returns metadata. |
| `POST /api/profiles/save-sample` | JSON | `{ filename, name }` | Persists temporary sample as permanent voice profile. |
| `POST /api/profiles/record` | Multipart | Mic Blob + Name | Saves in-browser recording directly into profile store. |
| `GET /api/profiles` | GET | None | Lists all saved voice profiles. |
| `PUT /api/profiles/{id}` | PUT | `{ name, description }` | Renames or updates notes on a profile. |
| `DELETE /api/profiles/{id}` | DELETE | None | Deletes voice profile and deletes reference WAV. |
| `GET /api/audio/{filename}` | GET | None | Streams audio with range-header support. |
| `GET /api/telemetry` | GET | None | Returns real-time host RAM, CPU load, and model status. |

---

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=SahooShuvranshu/KittenTTS-Studio&type=Date)](https://star-history.com/#SahooShuvranshu/KittenTTS-Studio&Date)

---

## 🤝 Contributing

Contributions are welcomed! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before opening pull requests.

---

## 📜 Credits & Acknowledgments

This project is built by **Shuvransu** with the help of **Antigravity**:

- **[Shuvransu](https://github.com/SahooShuvranshu)**: Lead Developer, System Architecture, & Open-Source Author.
- **[Google DeepMind Antigravity](https://deepmind.google)**: Autonomous AI Architect & Agentic Co-Engineer.
- **[KittenML Team](https://github.com/KittenML)**: Kitten-TTS 2 1.7B Speech Language Model and ternary quantization.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for complete terms.  
Copyright (c) 2026 SahooShuvranshu.
