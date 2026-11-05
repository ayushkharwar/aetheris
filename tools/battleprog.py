#!/usr/bin/env python3
"""Prove XP, level-up, live battle state and the new battle chrome."""
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
        pg.goto("http://127.0.0.1:8099/index.html", wait_until="load"); pg.wait_for_timeout(1500)
        before = pg.evaluate("""() => { Math.random = function () { return 0; };
            const pm = GAME.state.party[0];
            pm.level = 20; pm.maxHp = Math.floor(GAME.species[pm.speciesId].baseHp * (20/50+0.5) + 10);
            pm.hp = pm.maxHp;
            pm.xp = GAME.xpToNext(pm.level) - 1;
            pm.moves.forEach(function (m) { m.power = 999; m.pp = 99; m.maxPp = 99; });
            return {level: pm.level, maxHp: pm.maxHp, hp: pm.hp, xp: pm.xp,
                    need: GAME.xpToNext(pm.level)}; }""")
        print("setup:", before)
        pg.evaluate("() => GAME.startBattle(4)")   # Grass type, weak to Fire
        pg.wait_for_timeout(1200)
        live = pg.evaluate("() => JSON.parse(JSON.stringify(GAME.state.battle))")
        check("live state exposed", live.get("wildId") == 4 and live.get("wildHp") == live.get("wildMaxHp") > 0, live)
        check("playerIndex tracked", live.get("playerIndex") == 0)
        check("over starts false", live.get("over") is False)
        txt = pg.inner_text("#battle-overlay")
        check("type badges present", "GRASS" in txt.upper() and "FIRE" in txt.upper())
        check("xp bar rendered", pg.locator("#battle-overlay div").filter(has_text="XP ").count() > 0,
              [l for l in txt.splitlines() if l.startswith("XP")][:1])
        pg.screenshot(path=str(OUT / "50-battle.png"))
        # attack until the battle ends
        hits = 0
        for _ in range(3):
            if pg.evaluate("() => GAME.state.battle.over"): break
            if pg.locator("#battle-overlay button").count() < 4: break
            pg.locator("#battle-overlay button").nth(0).click(); hits += 1
            pg.wait_for_timeout(3000)
        pg.wait_for_timeout(2500)
        after = pg.evaluate("""() => { const pm = GAME.state.party[0];
            return {over: GAME.state.battle.over, level: pm.level, maxHp: pm.maxHp, hp: pm.hp,
                    xp: pm.xp, need: GAME.xpToNext(pm.level),
                    dexCaught: !!GAME.state.dex }; }""")
        print(f"after {hits} hits:", after)
        check("battle marked over", after["over"] is True)
        check("level went up", after["level"] == before["level"] + 1, after["level"])
        check("maxHp grew", after["maxHp"] > before["maxHp"], f'{before["maxHp"]} -> {after["maxHp"]}')
        check("hp grew by same amount", after["hp"] - before["hp"] == after["maxHp"] - before["maxHp"],
              f'{before["hp"]} -> {after["hp"]}')
        check("xp rolled over", after["xp"] < after["need"], f'{after["xp"]}/{after["need"]}')
        b.close()
finally: srv.terminate()
print()
print("PAGE ERRORS:", json.dumps(errs[:3]) if errs else "none")
print("RESULT:", "ALL PASS" if not fails and not errs else f"{len(fails)} failed, {len(errs)} errors")
