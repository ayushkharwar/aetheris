#!/usr/bin/env python3
"""Smoke test: load the game headless, collect console errors, drive input, screenshot."""
import subprocess, sys, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path("/home/zen/projects/argon-pokemon")
OUT = Path("/home/zen/.cache/argon/pokemon")
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8099

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
errors, logs = [], []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 1100, "height": 760})
        pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="load")
        pg.wait_for_timeout(2500)
        pg.screenshot(path=str(OUT / "01-load.png"))
        for k in ["ArrowRight"]*4 + ["ArrowDown"]*4 + ["ArrowLeft"]*2:
            pg.keyboard.press(k); pg.wait_for_timeout(140)
        pg.wait_for_timeout(1200)
        pg.screenshot(path=str(OUT / "02-moved.png"))
        state = pg.evaluate("""() => ({
            hasGAME: !!window.GAME,
            world: window.GAME && window.GAME.world ? Object.keys(window.GAME.world) : null,
            player: window.GAME && window.GAME.world ? window.GAME.world.player : null,
            ids: ['hud','dialog','menu','hud-zone','hud-coords','hud-party-summary','tab-party']
                 .map(i => i + ':' + (document.getElementById(i) ? 'ok' : 'MISSING')),
            canvas: !!document.getElementById('game')
        })""")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(600)
        pg.screenshot(path=str(OUT / "03-menu.png"))
        b.close()
finally:
    srv.terminate()

print("PAGE ERRORS:", json.dumps(errors, indent=1) if errors else "none")
print("CONSOLE:", json.dumps(logs[-8:], indent=1) if logs else "none")
print("STATE:", json.dumps(state, indent=1))
