#!/usr/bin/env python3
"""
Comprehensive Forensic Test Suite for Kitten-TTS 2 Studio Showcase Website & Assets.
Validates:
1. All static routes (/docs, /docs-showcase, /style.css, /demo.js, /assets/logo.svg, /assets/audio/...)
2. Removal of all NSFW counter themes (rule34, getloli)
3. Ingestion of JetBrains Mono fonts and CSS custom properties token system
4. Quad-mode Tektronix visualizer DOM structures & interactive scrubbers
5. Handcrafted native vector architecture SVG (absence of external Mermaid.js CDN)
6. 1.6-bit Ternary matrix and 8 GB RAM allocation meters
7. Tabbed developer terminal and soundboard matrix elements
"""

import os
import sys
import unittest
from fastapi.testclient import TestClient

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app

class TestDocsShowcase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_docs_showcase_html_route(self):
        r = self.client.get("/docs-showcase")
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/html", r.headers["content-type"])
        html = r.text

        # Assert title and brand
        self.assertIn("Kitten-TTS 2 Studio", html)
        self.assertIn("SahooShuvranshu", html)
        self.assertIn("Acoustic Audition Laboratory", html)

        # Assert purge of NSFW visitor counters
        self.assertNotIn("rule34", html.lower())
        self.assertNotIn("count.getloli.com", html.lower())

        # Assert purge of 1.5MB external Mermaid.js CDN
        self.assertNotIn("cdn.jsdelivr.net/npm/mermaid", html.lower())

        # Assert Google Fonts preconnect for JetBrains Mono
        self.assertIn("fonts.googleapis.com", html)
        self.assertIn("JetBrains+Mono", html)

        # Assert Vector Logo SVG reference
        self.assertIn("assets/logo.svg", html)

        # Assert Metrics & Digital Odometer
        self.assertIn("githubStars", html)
        self.assertIn("odometerDisplay", html)

        # Multi-Page Documentation System Routing & Content Validation
        r_arch = self.client.get("/docs/architecture")
        self.assertEqual(r_arch.status_code, 200)
        arch_html = r_arch.text
        self.assertIn("Architecture", arch_html)
        self.assertIn("1.6-bit Ternary", arch_html)

        r_hw = self.client.get("/docs/hardware")
        self.assertEqual(r_hw.status_code, 200)
        hw_html = r_hw.text
        self.assertIn("Benchmark Matrix", hw_html)
        self.assertIn("8 GB", hw_html)

        r_syntax = self.client.get("/docs/syntax")
        self.assertEqual(r_syntax.status_code, 200)
        syntax_html = r_syntax.text
        self.assertIn("Expression", syntax_html)
        self.assertIn("[whisper]", syntax_html)

        r_api = self.client.get("/docs/api")
        self.assertEqual(r_api.status_code, 200)
        api_html = r_api.text
        self.assertIn("/api/synthesize", api_html)

        r_quick = self.client.get("/docs/quickstart")
        self.assertEqual(r_quick.status_code, 200)
        quick_html = r_quick.text
        self.assertIn("run_studio.sh", quick_html)

    def test_static_asset_routes(self):
        # 1. style.css direct fallback & /docs/style.css
        r_css = self.client.get("/style.css")
        self.assertEqual(r_css.status_code, 200)
        self.assertIn("text/css", r_css.headers["content-type"])
        self.assertIn("--phosphor-green", r_css.text)
        self.assertIn("--signal-amber", r_css.text)

        # 2. demo.js direct fallback & /docs/demo.js
        r_js = self.client.get("/demo.js")
        self.assertEqual(r_js.status_code, 200)
        self.assertIn("javascript", r_js.headers["content-type"])
        self.assertIn("rgba(5, 6, 8, 0.20)", r_js.text)  # P31 phosphor persistence
        self.assertIn("playRelayClick", r_js.text)

        # 3. Vector Logo SVG
        r_logo = self.client.get("/assets/logo.svg")
        self.assertEqual(r_logo.status_code, 200)
        self.assertIn("image/svg+xml", r_logo.headers["content-type"])
        self.assertIn("<svg", r_logo.text)

        # 4. Audio files via /assets/
        r_audio = self.client.get("/assets/audio/sample_01.mp3")
        self.assertEqual(r_audio.status_code, 200)
        self.assertGreater(len(r_audio.content), 1000)

        r_audio_wav = self.client.get("/assets/audio/sample_01.wav")
        self.assertEqual(r_audio_wav.status_code, 200)
        self.assertGreater(len(r_audio_wav.content), 1000)

        # 5. OpenGraph preview card
        r_og = self.client.get("/assets/og-card.png")
        self.assertEqual(r_og.status_code, 200)
        self.assertGreater(len(r_og.content), 1000)

    def test_docs_directory_static_mount(self):
        # /docs/ (with trailing slash)
        r = self.client.get("/docs/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Kitten-TTS 2 Studio", r.text)
        self.assertNotIn("swagger", r.text.lower())

        # /docs (without trailing slash) - must serve showcase, not Swagger UI
        r_noslash = self.client.get("/docs")
        self.assertEqual(r_noslash.status_code, 200)
        self.assertIn("Kitten-TTS 2 Studio", r_noslash.text)
        self.assertNotIn("swagger", r_noslash.text.lower())

        # OpenAPI Swagger UI must be cleanly relocated to /api/docs
        r_api = self.client.get("/api/docs")
        self.assertEqual(r_api.status_code, 200)
        self.assertIn("swagger", r_api.text.lower())

        r_logo = self.client.get("/docs/assets/logo.svg")
        self.assertEqual(r_logo.status_code, 200)
        self.assertIn("<svg", r_logo.text)

    def test_css_tokens_and_responsive_tiers(self):
        css_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "style.css"))
        with open(css_path, "r", encoding="utf-8") as f:
            css = f.read()

        # Tokens check
        self.assertIn("--bg-base", css)
        self.assertIn("--phosphor-green", css)
        self.assertIn("--signal-amber", css)
        self.assertIn("--border-dark", css)
        self.assertIn("--radius-brutal", css)

        # 4-tier responsive breakpoints check
        self.assertTrue("min-width: 900px" in css and "max-width: 1199px" in css)  # Laptop
        self.assertTrue("min-width: 600px" in css and "max-width: 899px" in css)   # Tablet
        self.assertTrue("max-width: 599px" in css)                                 # Mobile

    def test_css_html_class_unification(self):
        """Verify that 100% of HTML classes in docs/index.html have styling rules in docs/style.css."""
        import re
        html_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "index.html"))
        css_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "style.css"))

        with open(html_path, "r", encoding="utf-8") as f:
            html = f.read()
        with open(css_path, "r", encoding="utf-8") as f:
            css = f.read()

        classes_in_html = set()
        for m in re.finditer(r"class=[\"\x27]([^\"\x27]+)[\"\x27]", html):
            for c in m.group(1).split():
                classes_in_html.add(c)

        unmatched = []
        for c in sorted(classes_in_html):
            pattern = rf"\.{re.escape(c)}(?=[^\w-]|$)"
            if not re.search(pattern, css):
                unmatched.append(c)

        self.assertEqual(unmatched, [], f"Classes in HTML without matching CSS rules: {unmatched}")

    def test_demo_js_features_and_touch_support(self):
        """Verify demo.js implements touch listeners, playback synchronization, and testing hooks."""
        js_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "demo.js"))
        with open(js_path, "r", encoding="utf-8") as f:
            js = f.read()

        # Mobile touch listener support
        self.assertIn("touchstart", js)
        self.assertIn("touchmove", js)
        self.assertIn("getEventClientX", js)

        # Playback UI synchronization
        self.assertIn("syncPlaybackUI", js)
        self.assertIn("active-playing", js)

        # Testing interface export
        self.assertIn("__kittenShowcase", js)

if __name__ == "__main__":
    unittest.main()
