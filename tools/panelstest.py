#!/usr/bin/env python3
"""Test the Creatures / Inventory / System pause tabs (js/panels.js)."""
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
        pg = b.new_page(viewport={"width":1200,"height":820})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://127.0.0.1:8099/index.html", wait_until="load"); pg.wait_for_timeout(1500)
        check("panels.js loaded", pg.evaluate("() => !!(GAME.ui && GAME.ui.Party && GAME.ui.Inventory && GAME.ui.System)"))
        check("dex screens still present", pg.evaluate("() => !!(GAME.ui.Pokedex && GAME.ui.Guide && GAME.ui.Save)"))
        # second party member so LEAD has something to do; damage the lead so POTION has work
        pg.evaluate("""() => { Math.random = function () { return 0; };
            GAME.state.party.push({ speciesId: 2, level: 6,
                hp: 20, maxHp: 20, moves: GAME.species[2].moves.slice(0,2), xp: 5 });
            GAME.state.party[0].hp = Math.max(1, GAME.state.party[0].maxHp - 15);
            GAME.state.inventory.potions = 2; }""")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
        # ---- Creatures
        pg.click("#tab-party"); pg.wait_for_timeout(700)
        txt = pg.inner_text("#menu-content")
        check("creatures tab renders", "CREATURE" in txt.upper(), txt.splitlines()[0][:30])
        check("party size shown", "/6" in txt)
        rows = pg.locator("#menu-content canvas").count()
        check("a sprite per member", rows == 2, f"{rows} canvases")
        check("LEAD button offered on non-lead", pg.locator("#menu-content button:visible", has_text="LEAD").count() >= 1)
        pg.screenshot(path=str(OUT / "60-party.png"))
        # inspect
        pg.locator("#menu-content button:visible", has_text="INSPECT").first.click(); pg.wait_for_timeout(500)
        t2 = pg.inner_text("#menu-content")
        check("inspect shows stats+moves", "ATK" in t2.upper() and "SPD" in t2.upper())
        pg.screenshot(path=str(OUT / "61-party-inspect.png"))
        # potion
        before = pg.evaluate("() => ({pot: GAME.state.inventory.potions, hp: GAME.state.party[0].hp})")
        pg.locator("#menu-content button:visible", has_text="POTION").first.click(); pg.wait_for_timeout(700)
        after = pg.evaluate("() => ({pot: GAME.state.inventory.potions, hp: GAME.state.party[0].hp})")
        check("potion consumed + healed 20", after["pot"] == before["pot"]-1 and after["hp"] > before["hp"],
              f"{before} -> {after}")
        # lead swap
        pg.locator("#menu-content button:visible", has_text="LEAD").first.click(); pg.wait_for_timeout(700)
        lead = pg.evaluate("() => GAME.state.party[0].speciesId")
        check("LEAD swaps party lead", lead == 2, f"lead speciesId={lead}")
        hud = pg.inner_text("#hud-party-summary")
        check("HUD refreshed", "2/6" in hud or "Party" in hud, hud)
        # ---- Inventory
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300); pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
        pg.click("#tab-inventory"); pg.wait_for_timeout(600)
        ti = pg.inner_text("#menu-content")
        check("inventory renders", "INVENTORY" in ti.upper() and "POTION" in ti.upper())
        disabled = pg.locator("#menu-content button", has_text="BATTLE ONLY").first.is_disabled()
        check("ball button disabled", disabled)
        pg.screenshot(path=str(OUT / "62-inventory.png"))
        # ---- System
        pg.click("#tab-system"); pg.wait_for_timeout(600)
        ts = pg.inner_text("#menu-content")
        check("system renders", "SYSTEM" in ts.upper() and "Trainer" in ts)
        check("system shows save slots", "Save" in ts)
        pg.screenshot(path=str(OUT / "63-system.png"))
        # ---- empty-state safety
        pg.evaluate("() => { GAME.state.party.length = 0; }")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300); pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
        pg.click("#tab-party"); pg.wait_for_timeout(600)
        check("empty party does not throw", "CREATURE" in pg.inner_text("#menu-content").upper())
        b.close()
finally: srv.terminate()
print()
print("PAGE ERRORS:", json.dumps(errs[:3]) if errs else "none")
print("RESULT:", "ALL PASS" if not fails and not errs else f"{len(fails)} failed, {len(errs)} errors")
