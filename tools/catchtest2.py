import subprocess, sys, time, json
from playwright.sync_api import sync_playwright
PORT=8099; OUT="/home/zen/.cache/argon/pokemon"
srv=subprocess.Popen([sys.executable,"-m","http.server",str(PORT)],cwd=".",
                     stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1.2)
errs=[]
try:
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True,args=["--no-sandbox"]); pg=b.new_page(viewport={"width":1100,"height":760})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{PORT}/index.html",wait_until="load"); pg.wait_for_timeout(1800)
        pg.evaluate("() => window.GAME.startBattle(3)"); pg.wait_for_timeout(1500)
        print("battle state keys:", pg.evaluate("() => Object.keys(GAME.state.battle || {})"))
        print("wild obj:", pg.evaluate("() => JSON.stringify(GAME.state.battle && (GAME.state.battle.wild || GAME.state.battle.enemy) || null).slice(0,200)"))
        # weaken with two hits
        for _ in range(2):
            pg.locator(".btl-btn", has_text="CLAW").first.click(); pg.wait_for_timeout(2300)
        pg.screenshot(path=f"{OUT}/11-after-attacks.png")
        print("wild after hits:", pg.evaluate("() => { const b=GAME.state.battle||{}; const w=b.wild||b.enemy||{}; return {hp:w.hp, maxHp:w.maxHp, log:(b.log||[]).slice(-2)}; }"))
        pg.locator(".btl-btn", has_text="BAG").first.click(); pg.wait_for_timeout(800)
        bag=[b.inner_text().strip() for b in pg.locator(".btl-btn").all()]
        print("bag options:", bag)
        ball=[x for x in bag if "BALL" in x.upper()]
        if ball:
            pg.locator(".btl-btn", has_text=ball[0].split()[0]).first.click(); pg.wait_for_timeout(4000)
            pg.screenshot(path=f"{OUT}/12-after-catch.png")
        print("result:", pg.evaluate("() => ({balls:GAME.state.inventory.balls, party:GAME.state.party.map(p=>p.speciesId), caught:Object.keys(GAME.state.dex.caught), overlay: !!document.querySelector('#battle-overlay') && !document.querySelector('#battle-overlay').classList.contains('hidden')})"))
        b.close()
finally: srv.terminate()
print("PAGE ERRORS:", errs or "none")
