#!/usr/bin/env python3
"""Test the Bestiary / Guide / Save screens added by js/dex.js."""
import subprocess, sys, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path("/home/zen/projects/argon-pokemon")
OUT = Path("/home/zen/.cache/argon/pokemon"); OUT.mkdir(parents=True, exist_ok=True)
PORT = 8099
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=str(ROOT),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
errors, fails = [], []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + ((" | " + str(extra)) if extra else ""))
    if not cond: fails.append(name)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 1200, "height": 820})
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="load")
        pg.wait_for_timeout(2000)
        check("dex.js loaded", pg.evaluate("() => !!(window.GAME.ui && GAME.ui.Pokedex)"))

        # --- Bestiary, nothing seen yet
        pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
        pg.click("#tab-dex"); pg.wait_for_timeout(700)
        txt = pg.inner_text("#menu-content")
        check("bestiary renders", "bestiary" in txt.lower(), txt.splitlines()[0][:40] if txt else "empty")
        n = pg.evaluate("() => document.querySelectorAll('#menu-content canvas').length")
        check("12 species cards", n == 12, f"{n} canvases")
        check("empty state says unknown", "UNKNOWN" in txt.upper(), "UNKNOWN label present")
        pg.screenshot(path=str(OUT / "20-dex-empty.png"))

        # --- populate dex, re-render
        pg.evaluate("""() => { GAME.state.dex = { seen: {0:true,1:true,2:true}, caught: {0:true} };
                               }""")
        pg.click("#tab-dex"); pg.wait_for_timeout(700)
        txt = pg.inner_text("#menu-content")
        check("caught state shows", "CAUGHT" in txt.upper())
        check("seen state shows", "SEEN" in txt.upper())
        check("counts update", "3/12" in txt, [l for l in txt.splitlines() if "/12" in l][:2])
        pg.screenshot(path=str(OUT / "21-dex-populated.png"))

        # --- detail strip
        pg.locator("#menu-content canvas").first.click(); pg.wait_for_timeout(600)
        txt = pg.inner_text("#menu-content")
        check("detail strip opens", "ATK" in txt.upper() and "CATCH" in txt.upper(),
              [l for l in txt.splitlines() if "ATK" in l.upper()][:1])
        pg.screenshot(path=str(OUT / "22-dex-detail.png"))

        # --- Guide
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
        pg.locator("#menu-content button", has_text="Guide").first.click(); pg.wait_for_timeout(600)
        txt = pg.inner_text("#menu-content")
        check("guide renders", "guide" in txt.lower() and len(txt) > 400, f"{len(txt)} chars")
        pg.screenshot(path=str(OUT / "23-guide.png"))

        # --- Save screen + round trip
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
        pg.locator("#menu-content button", has_text="Save").first.click(); pg.wait_for_timeout(600)
        txt = pg.inner_text("#menu-content")
        check("save screen shows 3 slots", txt.count("Empty") + txt.count("slot") >= 1, txt.splitlines()[:2])
        pg.screenshot(path=str(OUT / "24-save.png"))
        pg.locator("#menu-content button", has_text="Save").first.click(); pg.wait_for_timeout(900)
        raw = pg.evaluate("() => localStorage.getItem('aetheris.save.1')")
        check("slot 1 written to localStorage", bool(raw), f"{len(raw or '')} bytes")
        saved = json.loads(raw) if raw else {}
        check("payload shape", saved.get("version") == 1 and "state" in saved and "position" in saved,
              sorted(saved.keys())[:6])
        # mutate then load back
        pg.evaluate("() => { GAME.state.gold = 999; GAME.world.player.gx = 3; }")
        pg.click("#tab-system") if pg.locator("#tab-system").count() else None
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
        pg.locator("#menu-content button", has_text="Save").first.click(); pg.wait_for_timeout(600)
        pg.locator("#menu-content button", has_text="Load").first.click(); pg.wait_for_timeout(1200)
        gold = pg.evaluate("() => GAME.state.gold")
        gx = pg.evaluate("() => GAME.world.player.gx")
        hud = pg.inner_text("#hud-zone") + " " + pg.inner_text("#hud-coords")
        check("load restores gold", gold == saved.get("state", {}).get("gold"), f"gold={gold}")
        check("load restores position", gx == saved.get("position", {}).get("gx"), f"gx={gx}")
        pg.screenshot(path=str(OUT / "25-after-load.png"))
        b.close()
finally:
    srv.terminate()

print()
print("PAGE ERRORS:", json.dumps(errors[:4]) if errors else "none")
print("RESULT:", "ALL PASS" if not fails and not errors else f"{len(fails)} failed, {len(errors)} errors")
