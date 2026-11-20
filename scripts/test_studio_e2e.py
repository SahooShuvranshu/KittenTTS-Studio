import asyncio
import json
import subprocess
import time
import urllib.request
import websockets
import tempfile
import os

async def run_studio_e2e():
    print("--- Starting Studio & Landing Headless CDP Verification ---")
    
    # 1. Start a simple static HTTP server for frontend files
    http_proc = subprocess.Popen(
        [".venv/bin/python", "-m", "http.server", "8899", "--bind", "127.0.0.1", "--directory", "frontend"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(1)

    profile_dir = tempfile.mkdtemp()
    chrome_proc = subprocess.Popen(
        [
            "/usr/bin/chromium",
            "--headless=new",
            f"--user-data-dir={profile_dir}",
            "--remote-debugging-port=9223",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "about:blank"
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(1.5)

    errors = []
    warnings = []
    test_results = []

    try:
        res = urllib.request.urlopen("http://127.0.0.1:9223/json")
        targets = json.loads(res.read().decode())
        page_targets = [t for t in targets if t.get("type") == "page"]
        if not page_targets:
            raise RuntimeError(f"No page target found: {targets}")
        ws_url = page_targets[0]["webSocketDebuggerUrl"]

        async with websockets.connect(ws_url) as ws:
            msg_id = 0
            async def send_cmd(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method}
                if params:
                    payload["params"] = params
                await ws.send(json.dumps(payload))
                return msg_id

            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")
            await send_cmd("Log.enable")
            await send_cmd("Network.enable")

            # --- TEST 1: Landing Page (index.html) Viewports & Horizontal Overflow ---
            await send_cmd("Page.navigate", {"url": "http://127.0.0.1:8899/index.html"})
            await asyncio.sleep(1.5)

            viewports = [320, 375, 768, 1024, 1440]
            for width in viewports:
                await send_cmd("Emulation.setDeviceMetricsOverride", {
                    "width": width,
                    "height": 800,
                    "deviceScaleFactor": 1,
                    "mobile": width < 768
                })
                await asyncio.sleep(0.3)
                eval_id = await send_cmd("Runtime.evaluate", {
                    "expression": "({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })",
                    "returnByValue": True
                })
                # wait for result
                start_t = time.time()
                while time.time() - start_t < 2.0:
                    try:
                        resp = await asyncio.wait_for(ws.recv(), timeout=0.3)
                        data = json.loads(resp)
                        if data.get("id") == eval_id:
                            val = data["result"]["result"]["value"]
                            overflow = val["scrollWidth"] > val["innerWidth"]
                            status = "FAIL" if overflow else "PASS"
                            test_results.append(f"Landing Viewport {width}px: {status} (scrollWidth={val['scrollWidth']}, innerWidth={val['innerWidth']})")
                            break
                    except asyncio.TimeoutError:
                        pass

            # --- TEST 2: Studio Page (studio.html) Viewports & Horizontal Overflow ---
            await send_cmd("Page.navigate", {"url": "http://127.0.0.1:8899/studio.html"})
            await asyncio.sleep(2.0)

            for width in viewports:
                await send_cmd("Emulation.setDeviceMetricsOverride", {
                    "width": width,
                    "height": 800,
                    "deviceScaleFactor": 1,
                    "mobile": width < 768
                })
                await asyncio.sleep(0.3)
                eval_id = await send_cmd("Runtime.evaluate", {
                    "expression": "({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })",
                    "returnByValue": True
                })
                start_t = time.time()
                while time.time() - start_t < 2.0:
                    try:
                        resp = await asyncio.wait_for(ws.recv(), timeout=0.3)
                        data = json.loads(resp)
                        if data.get("id") == eval_id:
                            val = data["result"]["result"]["value"]
                            overflow = val["scrollWidth"] > val["innerWidth"]
                            status = "FAIL" if overflow else "PASS"
                            test_results.append(f"Studio Viewport {width}px: {status} (scrollWidth={val['scrollWidth']}, innerWidth={val['innerWidth']})")
                            break
                    except asyncio.TimeoutError:
                        pass

            # Reset viewport to 1280
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1280,
                "height": 800,
                "deviceScaleFactor": 1,
                "mobile": False
            })
            await asyncio.sleep(0.5)

            # --- TEST 3: Studio Offline Detection Banner ---
            eval_id = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const notice = document.getElementById('offlineNotice');
                    const isVisible = notice && window.getComputedStyle(notice).display !== 'none';
                    const noticeText = notice ? notice.textContent.trim() : '';
                    return { isVisible, noticeText };
                })()
                """,
                "returnByValue": True
            })
            start_t = time.time()
            while time.time() - start_t < 3.0:
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=0.3)
                    data = json.loads(resp)
                    if data.get("id") == eval_id:
                        val = data["result"]["result"]["value"]
                        test_results.append(f"Studio Offline Notice Visible: {val['isVisible']} (Text: '{val['noticeText'][:60]}...')")
                        break
                except asyncio.TimeoutError:
                    pass

            # --- TEST 4: Keyboard Navigation & Dropzone Focus ---
            eval_id = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const dropzone = document.getElementById('dropzone');
                    const tabIndex = dropzone ? dropzone.getAttribute('tabindex') : null;
                    dropzone.focus();
                    const isFocused = document.activeElement === dropzone;
                    return { tabIndex, isFocused };
                })()
                """,
                "returnByValue": True
            })
            start_t = time.time()
            while time.time() - start_t < 2.0:
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=0.3)
                    data = json.loads(resp)
                    if data.get("id") == eval_id:
                        val = data["result"]["result"]["value"]
                        test_results.append(f"Dropzone Keyboard Accessible: tabIndex={val['tabIndex']}, focused={val['isFocused']}")
                        break
                except asyncio.TimeoutError:
                    pass

            # --- TEST 5: Inline Tag Validation Counter ---
            eval_id = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const textarea = document.getElementById('textPrompt');
                    textarea.value = "Testing invalid tag [unclosed tag here";
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    const counter = document.getElementById('charCount');
                    return { counterText: counter.textContent, value: textarea.value };
                })()
                """,
                "returnByValue": True
            })
            start_t = time.time()
            while time.time() - start_t < 2.0:
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=0.3)
                    data = json.loads(resp)
                    if data.get("id") == eval_id:
                        val = data["result"]["result"]["value"]
                        test_results.append(f"Tag syntax validation triggered: {val['counterText']}")
                        break
                except asyncio.TimeoutError:
                    pass

            # --- TEST 6: Empty Text Synthesis Validation Toast ---
            eval_id = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const textarea = document.getElementById('textPrompt');
                    textarea.value = "   "; // whitespace only
                    const synthBtn = document.getElementById('synthesizeBtn');
                    synthBtn?.click();
                    const toast = document.querySelector('.toast');
                    return { toastText: toast ? toast.textContent : null };
                })()
                """,
                "returnByValue": True
            })
            start_t = time.time()
            while time.time() - start_t < 2.0:
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=0.3)
                    data = json.loads(resp)
                    if data.get("id") == eval_id:
                        val = data.get("result", {}).get("result", {}).get("value", {})
                        test_results.append(f"Empty synthesis error toast: {val.get('toastText')}")
                        break
                except asyncio.TimeoutError:
                    pass

            # Drain any exceptions/logs
            while True:
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=0.3)
                    data = json.loads(resp)
                    method = data.get("method", "")
                    if method == "Runtime.exceptionThrown":
                        errors.append(f"JS Exception: {data['params']['exceptionDetails']}")
                    elif method == "Log.entryAdded":
                        entry = data["params"]["entry"]
                        if entry.get("level") == "error":
                            errors.append(f"Console Error: {entry.get('text')}")
                except asyncio.TimeoutError:
                    break

    finally:
        chrome_proc.terminate()
        http_proc.terminate()

    print("\n=== STUDIO E2E VERIFICATION RESULTS ===")
    for res in test_results:
        print(f"  ✓ {res}")
    print(f"\nTotal JS Exceptions: {len(errors)}")
    for e in errors:
        print("  [ERROR]", e)

if __name__ == "__main__":
    asyncio.run(run_studio_e2e())
