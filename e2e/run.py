"""End-to-end: headless Chromium (fake mic) -> built front end -> real FastAPI -> fake AssemblyAI socket.
Usage: python3 run.py [clean|drop]"""
import json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright

MODE = sys.argv[1] if len(sys.argv) > 1 else "clean"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = f"{ROOT}/backend/.venv/bin/python"
data = tempfile.mkdtemp()
procs = []

def spawn(cmd, env=None, cwd=None):
    p = subprocess.Popen(cmd, env={**os.environ, **(env or {})}, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    procs.append(p); return p

def wait_http(url, tries=60):
    for _ in range(tries):
        try: urllib.request.urlopen(url, timeout=1); return
        except Exception: time.sleep(0.3)
    raise SystemExit(f"never came up: {url}")

try:
    aai = spawn([PY, "e2e/fake_aai.py"], {"DROP_FIRST_AFTER": "130000" if MODE != "clean" else "0", "REFUSE_SECONDS": "7" if MODE == "gap" else "0"}, cwd=ROOT)
    api = spawn([PY, "-m", "uvicorn", "app.main:create_app", "--factory", "--port", "8000"],
                {"TRANSCRIBER": "fake", "LLM_PROVIDER": "fake", "ASSEMBLYAI_STREAM_URL": "ws://127.0.0.1:8765",
                 "LOCAL_STORAGE_DIR": data, "ALLOWED_ORIGINS": "*"}, cwd=f"{ROOT}/backend")
    web = spawn(["python3", "-m", "http.server", "5173", "--bind", "127.0.0.1", "-d", f"{ROOT}/frontend/dist"])
    wait_http("http://127.0.0.1:8000/health"); wait_http("http://127.0.0.1:5173/")

    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(permissions=["microphone"], viewport={"width": 420, "height": 860})
        page = ctx.new_page()
        logs = []
        page.on("console", lambda m: logs.append(m.text))
        page.on("pageerror", lambda e: logs.append(f"PAGEERROR {e}"))
        page.goto("http://127.0.0.1:5173/?api=http://127.0.0.1:8000")
        page.get_by_label("Record now").click()
        page.get_by_role("timer").wait_for()
        t0 = time.time()
        time.sleep(1.5)
        status_line = page.locator(".status-line").inner_text()
        time.sleep(8.5 if MODE != 'gap' else 16.5)
        shown = page.get_by_role("timer").inner_text()
        page.get_by_label("Stop recording").click()
        t_stop = time.time()
        page.get_by_text("words", exact=False).first.wait_for(timeout=60000)
        latency = time.time() - t_stop
        text = page.locator(".prose").all_inner_texts()
        notice = page.locator(".notice").all_inner_texts()
        title = page.locator(".subhead-title h1").inner_text()
        # AI actions
        page.get_by_role("button", name="Summarise").click()
        page.locator(".prose.lead").wait_for(timeout=15000)
        summary = page.locator(".prose.lead").inner_text()
        page.screenshot(path=f"{ROOT}/e2e/{MODE}.png")
        print(json.dumps({"mode": MODE, "timer_at_stop": shown, "status_line": status_line, "stop_to_transcript_s": round(latency, 2),
                          "title": title, "transcript": text, "notice": notice, "summary": summary,
                          "errors": [l for l in logs if "error" in l.lower()]}, indent=1))
        b.close()
    import glob
    for f in sorted(glob.glob(f"{data}/audio/**/*.*", recursive=True)):
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name:format=duration", "-of", "default=nw=1", f], capture_output=True, text=True).stdout.split()
        dec = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "null", "-"], capture_output=True, text=True)
        print("CHUNK", os.path.basename(f), os.path.getsize(f), "bytes", probe, "decode_errors:", dec.stderr.strip() or "none")
finally:
    for p in procs: p.terminate()
    for p in procs:
        try: print(f"--- {p.args[1] if len(p.args)>1 else p.args}\n" + (p.communicate(timeout=3)[0] or "")[-1200:])
        except Exception: pass
