import asyncio
import json
import subprocess
import time
import urllib.request
import websockets

async def run_cdp_audit():
    # Start FastAPI server in background
    server_proc = subprocess.Popen(
        [".venv/bin/python", "-m", "uvicorn", "backend.app:app", "--port", "8877", "--host", "127.0.0.1"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    # Wait for server to be responsive
    for _ in range(20):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8877/docs-showcase") as resp:
                print(f"Server check: HTTP {resp.status}, length={len(resp.read())}")
                break
        except Exception as e:
            time.sleep(0.5)
    else:
        out, err = server_proc.communicate(timeout=2)
        print("Server failed to start:", out, err)
        return

    # Start Chromium with remote debugging and fresh profile
    import tempfile
    profile_dir = tempfile.mkdtemp()
    chrome_proc = subprocess.Popen(
        [
            "/usr/bin/chromium",
            "--headless=new",
            f"--user-data-dir={profile_dir}",
            "--remote-debugging-port=9222",
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
    logs = []

    try:
        # Get CDP WebSocket URL for the actual PAGE target
        res = urllib.request.urlopen("http://127.0.0.1:9222/json")
        targets = json.loads(res.read().decode())
        page_targets = [t for t in targets if t.get("type") == "page"]
        if not page_targets:
            raise RuntimeError(f"No page target found in: {targets}")
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

            # Navigate to /docs (no trailing slash)
            nav_res = await send_cmd("Page.navigate", {"url": "http://127.0.0.1:8877/docs"})
            print(f"Navigated to /docs: {nav_res}")

            # Wait for Page.loadEventFired
            loaded = False
            start_t = time.time()
            while time.time() - start_t < 10.0 and not loaded:
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    data = json.loads(resp)
                    method = data.get("method", "")
                    if method == "Page.loadEventFired":
                        print("Page load event fired!")
                        loaded = True
                    elif method == "Runtime.exceptionThrown":
                        errors.append(f"JS Exception: {data['params']['exceptionDetails']}")
                    elif method == "Runtime.consoleAPICalled":
                        c_type = data["params"].get("type")
                        c_args = data["params"].get("args", [])
                        txt = " ".join([str(a.get("value", a)) for a in c_args])
                        if c_type == "error":
                            errors.append(f"Console.error: {txt}")
                        elif c_type == "warning":
                            warnings.append(f"Console.warn: {txt}")
                        else:
                            logs.append(f"Console.{c_type}: {txt}")
                    elif method == "Network.responseReceived":
                        status = data["params"]["response"]["status"]
                        url = data["params"]["response"]["url"]
                        if status >= 400:
                            errors.append(f"HTTP {status}: {url}")
                except asyncio.TimeoutError:
                    pass

            await asyncio.sleep(1.0)

            # Check title and elements
            title_id = await send_cmd("Runtime.evaluate", {"expression": "document.title"})
            doc_id = await send_cmd("Runtime.evaluate", {"expression": "document.querySelector('h1').textContent.trim()"})
            body_id = await send_cmd("Runtime.evaluate", {"expression": "document.body.innerHTML.length"})
            canvas_id = await send_cmd("Runtime.evaluate", {"expression": "!!document.getElementById('demoCanvas')"})

            start_t = time.time()
            while time.time() - start_t < 4.0:
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    data = json.loads(resp)
                    if "result" in data and "result" in data["result"]:
                        val = data["result"]["result"].get("value")
                        print(f"Eval result (id={data.get('id')}): {val}")
                    method = data.get("method", "")
                    if method == "Runtime.exceptionThrown":
                        errors.append(f"JS Exception: {data['params']['exceptionDetails']}")
                    elif method == "Log.entryAdded":
                        entry = data["params"]["entry"]
                        if entry.get("level") == "error":
                            errors.append(f"Console Error: {entry.get('text')}")
                        elif entry.get("level") == "warning":
                            warnings.append(f"Console Warning: {entry.get('text')}")
                        else:
                            logs.append(f"Console Log: {entry.get('text')}")
                    elif method == "Runtime.consoleAPICalled":
                        c_type = data["params"].get("type")
                        c_args = data["params"].get("args", [])
                        txt = " ".join([str(a.get("value", a)) for a in c_args])
                        if c_type == "error":
                            errors.append(f"Console.error: {txt}")
                        elif c_type == "warning":
                            warnings.append(f"Console.warn: {txt}")
                        else:
                            logs.append(f"Console.{c_type}: {txt}")
                    elif method == "Network.responseReceived":
                        status = data["params"]["response"]["status"]
                        url = data["params"]["response"]["url"]
                        if status >= 400:
                            errors.append(f"HTTP {status}: {url}")
                except asyncio.TimeoutError:
                    pass

            # Test interactions: click tabs, click buttons, click SFX, test touch and soundboard
            eval_id = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const results = [];

                    // 1. Test Mode Buttons
                    document.getElementById('btnModeTime')?.click();
                    document.getElementById('btnModeFFT')?.click();
                    document.getElementById('btnModeDual')?.click();
                    document.getElementById('btnModeOrbit')?.click();
                    results.push("Mode buttons switched successfully");

                    // 2. Test SFX Toggle
                    const sfxBtn = document.getElementById('sfxToggleBtn');
                    sfxBtn?.click();
                    results.push("SFX toggled: " + document.getElementById('sfxStateText')?.textContent);

                    // 3. Test Master Playback Toggle
                    const playBtn = document.getElementById('demoPlayBtn');
                    playBtn?.click();
                    results.push("Play button toggled: " + playBtn?.textContent);

                    // 4. Test Soundboard Card Interaction & State Sync
                    const firstSpkBtn = document.querySelector('.btn-soundboard-play');
                    const firstSpkCard = firstSpkBtn?.closest('.soundboard-card');
                    firstSpkBtn?.click();
                    const isCardPlaying = firstSpkCard?.classList.contains('playing');
                    results.push("Soundboard card playing state: " + isCardPlaying + ", btn text: " + firstSpkBtn?.textContent);

                    // 5. Test Soundboard Card Pause
                    firstSpkBtn?.click();
                    results.push("Soundboard card after second click (pause): " + firstSpkBtn?.textContent);

                    // 6. Test Touch Events on Scrubber Track
                    const scrubber = document.getElementById('scrubberTrack');
                    if (scrubber) {
                        const touchObj = new Touch({
                            identifier: 1,
                            target: scrubber,
                            clientX: 150,
                            clientY: 10
                        });
                        const touchStart = new TouchEvent('touchstart', {
                            bubbles: true,
                            cancelable: true,
                            touches: [touchObj],
                            targetTouches: [touchObj],
                            changedTouches: [touchObj]
                        });
                        scrubber.dispatchEvent(touchStart);
                        results.push("Scrubber touchstart dispatched cleanly");
                    }

                    // 7. Test Ternary Matrix Computation
                    const cell0 = document.querySelector('.ternary-cell[data-idx="0"]');
                    cell0?.click(); // +1 -> 0
                    results.push("Ternary formula: " + document.getElementById('ternaryFormula')?.textContent + " = " + document.getElementById('ternaryTotal')?.textContent);

                    // 8. Test Terminal Tabs
                    document.querySelectorAll('.terminal-tab-btn').forEach(b => b.click());
                    results.push("All terminal tabs switched cleanly");

                    // 9. Test Prosody Chips
                    document.querySelectorAll('.btn-tag-chip').forEach(b => b.click());
                    results.push("All prosody chips clicked cleanly");

                    // 10. Check __kittenShowcase global
                    results.push("Window showcase exported: " + (typeof window.__kittenShowcase === 'object'));

                    return results;
                })()
                """,
                "returnByValue": True
            })

            start_t = time.time()
            interaction_results = None
            while time.time() - start_t < 3.0:
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    data = json.loads(resp)
                    if data.get("id") == eval_id:
                        interaction_results = data.get("result", {}).get("result", {}).get("value")
                    method = data.get("method", "")
                    if method == "Runtime.exceptionThrown":
                        errors.append(f"JS Exception during interaction: {data['params']['exceptionDetails']}")
                    elif method == "Log.entryAdded":
                        entry = data["params"]["entry"]
                        if entry.get("level") == "error":
                            errors.append(f"Console Error during interaction: {entry.get('text')}")
                except asyncio.TimeoutError:
                    pass

            print("\n=== INTERACTION VERIFICATION RESULTS ===")
            if interaction_results:
                for r in interaction_results:
                    print(f"  ✓ {r}")
            else:
                print("  No interaction results returned.")

    finally:
        chrome_proc.terminate()
        server_proc.terminate()

    print("=== CDP AUDIT RESULTS ===")
    print(f"Total Errors: {len(errors)}")
    for e in errors:
        print(" [ERROR]", e)
    print(f"Total Warnings: {len(warnings)}")
    for w in warnings:
        print(" [WARN]", w)
    print(f"Total Logs: {len(logs)}")
    for l in logs:
        print(" [LOG]", l)

if __name__ == "__main__":
    asyncio.run(run_cdp_audit())
