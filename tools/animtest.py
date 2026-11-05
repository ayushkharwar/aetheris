#!/usr/bin/env python3
"""Prove the battle motion actually happens: entrance, damage number, banner, faint."""
import subprocess, sys, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path("/home/zen/projects/argon-pokemon")
OUT = Path("/home/zen/.cache/argon/pokemon"); OUT.mkdir(parents=True, exist_ok=True)
srv = subprocess.Popen([sys.executable,"-m","http.server","8099"], cwd=str(ROOT),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.5)
errs, fails = [], []
def check(n, c, extra=""):
    print(("PASS " if c else "FAIL ") + n + ((" | " + str(extra)) if extra else ""))
    if not c: fails.append(n)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        pg = b.new_page(viewport={"width":1100,"height":760})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://127.0.0.1:8099/index.html", wait_until="load"); pg.wait_for_timeout(1200)
        pg.evaluate("""() => { Math.random = function () { return 0; };
            const pm = GAME.state.party[0];
            pm.moves.forEach(function (m) { m.power = 999; m.pp = 99; m.maxPp = 99; });
            GAME.startBattle(4); }""")
        pg.wait_for_timeout(70)
        mid = pg.evaluate("() => getComputedStyle(GAME.ui ? document.querySelector('.btl-side-player canvas') : document.body).transform")
        pg.screenshot(path=str(OUT / "70-entrance.png"))
        pg.wait_for_timeout(600)
        done = pg.evaluate("() => getComputedStyle(document.querySelector('.btl-side-player canvas')).transform")
        check("entrance animates then settles", mid != done, f"mid={mid[:34]} end={done[:34]}")
        check("backdrop has sky gradient", "gradient" in pg.evaluate(
            "() => { const s=document.querySelector('.btl-scene'); return [...s.children].map(e=>getComputedStyle(e).backgroundImage).join(' '); }"))
        # attack
        pg.locator("#battle-overlay button").nth(0).click()
        pg.wait_for_timeout(260)
        shot = pg.evaluate("() => ({dmg: document.querySelectorAll('.btl-dmg').length, banner: document.querySelectorAll('.btl-move-banner').length, txt: (document.querySelector('.btl-dmg')||{}).textContent || ''})")
        pg.screenshot(path=str(OUT / "71-impact.png"))
        check("damage number spawned", shot["dmg"] >= 1, shot)
        check("damage number is -N", bool(shot["txt"].startswith("-")), shot["txt"])
        check("move banner shown", shot["banner"] >= 1)
        check("hp bar has smooth transition", "0.22s" in pg.evaluate(
            "() => { const b=document.querySelector('.btl-side-player .btl-bar'); return getComputedStyle(b).transition; }"), pg.evaluate(
            "() => getComputedStyle(document.querySelector('.btl-side-player .btl-bar')).transition"))
        pg.wait_for_timeout(1200)
        check("damage number cleaned up", pg.evaluate("() => document.querySelectorAll('.btl-dmg').length") == 0)
        pg.wait_for_timeout(2500)
        op = pg.evaluate("() => { const c=document.querySelector('.btl-side-wild canvas'); return c ? getComputedStyle(c).opacity : 'gone'; }")
        check("fainted wild faded out", op in ("0.15", "0") or op == "gone", f"opacity={op}")
        b.close()
finally: srv.terminate()
print()
print("PAGE ERRORS:", json.dumps(errs[:3]) if errs else "none")
print("RESULT:", "ALL PASS" if not fails and not errs else f"{len(fails)} failed, {len(errs)} errors")
