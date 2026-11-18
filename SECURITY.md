# Security Policy

## Supported Versions

We provide security updates and patches for the current release branch of **Kitten-TTS 2 Studio**:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## 🔒 Security Best Practices

### 1. Local Processing & Zero Telemetry
Kitten-TTS 2 Studio operates **100% locally**. The application transmits zero audio samples, voice clones, or prompts to external servers or third-party cloud services.

### 2. Audio Processing & Path Traversal Prevention
All incoming file uploads are strictly verified by `audio_utils.py`. Filenames are stripped of path components, assigned random UUID tokens, and processed in a sandboxed temporary directory before being normalized to 24 kHz mono WAV files.

### 3. Remote & Cloud Deployments
When hosting Kitten-TTS 2 Studio on a public VPS, cloud container, or Tailscale network:
- Always run behind an authenticated reverse proxy (e.g. Caddy, Nginx, Cloudflare Zero Trust) with HTTPS enabled.
- Restrict `CORS_ORIGINS` to trusted domains.
- Do not expose the raw FastAPI port to open public networks without authentication.

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability within Kitten-TTS 2 Studio, please do **NOT** open a public issue.

Instead, please send a responsible disclosure email to:
**`contact@sahooshuvranshu.is-a.dev`**
or visit **[sahooshuvranshu.is-a.dev](https://sahooshuvranshu.is-a.dev)**.

Please include:
1. Description of the vulnerability.
2. Steps to reproduce or proof-of-concept.
3. Potential impact on the host system or network.

### Response Timeline
- **Initial Response**: Within 24–48 hours acknowledging receipt.
- **Assessment & Fix**: Security patches are prioritized and released in a patch version promptly.
- **Public Disclosure**: Coordinated after a fix is published.
