# Contributing to Kitten-TTS 2 Studio

First off, thank you for considering contributing to **Kitten-TTS 2 Studio**! Open-source tools for privacy-preserving, zero-shot audio synthesis thrive on community collaboration.

---

## 🧭 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## 🛠️ Development Setup

### 1. Prerequisites
- Python 3.11 or 3.12 (Python 3.12 is recommended).
- `ffmpeg` installed on your system PATH (`pacman -S ffmpeg` or `apt install ffmpeg`).
- `uv` (recommended) or `pip`.

### 2. Fork and Clone
```bash
git clone https://github.com/SahooShuvranshu/KittenTTS-Studio.git
cd KittenTTS-Studio
```

### 3. Create Virtual Environment
```bash
uv venv .venv --python 3.12
source .venv/bin/activate
uv pip install -e .
```

### 4. Run the Verification Suite
Before writing code, make sure all tests pass:
```bash
python scripts/verify_setup.py
```

### 5. Launch the Local Studio
```bash
./run_studio.sh
```
Open `http://127.0.0.1:8765` in your browser.

---

## 🌿 Git Conventions

### Branch Naming
- Features: `feat/feature-name`
- Bug Fixes: `fix/bug-description`
- Documentation: `docs/doc-topic`
- Performance/Refactoring: `refactor/scope`

### Commit Messages
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```
Examples:
- `feat(engine): add streaming chunk audio generation`
- `fix(audio_utils): handle 32-bit float wav inputs`
- `docs(readme): add cloud deployment instructions`

---

## 🎨 UI/UX Unslopped Design Standards

Any contribution to the dashboard or showcase pages **must adhere to the `/unslop` design protocol**:
1. **4px Grid**: All margins, paddings, gaps, and component sizes must strictly align to multiples of 4px.
2. **Quiet Chrome**: Do not add purple gradients, glow shadows, or neon borders. Depth is created with subtle surface steps and 1px crisp borders (`#1F232D`).
3. **No Decorative Emojis**: Use consistent line icons (Lucide icon set, 16px size, 1.5 stroke).
4. **Tabular Numerics**: Apply `font-variant-numeric: tabular-nums` to timecodes, frequencies, file sizes, and audio metrics.
5. **Memory Discipline**: All backend routines must strictly preserve the 8 GB RAM physical memory budget.

---

## 🧪 Testing Guidelines

Before opening a pull request, ensure:
1. `python scripts/verify_setup.py` passes with zero errors.
2. Audio normalization outputs clean 24,000 Hz single-channel PCM 16-bit WAV files.
3. No lingering model allocations or memory leaks occur after synthesis.

---

## 📬 Submitting a Pull Request

1. Push your branch to your forked repository.
2. Open a Pull Request against the `main` branch of `SahooShuvranshu/KittenTTS-Studio`.
3. Fill out the PR template with a clear description of the problem solved and testing steps performed.
4. Maintainers will review your PR promptly!
