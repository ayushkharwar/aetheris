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
        pg.goto(f"http://127.0.0.1:{PORT}/index.html",wait_until="load"); pg.wait_for_timeout(1600)
        pg.evaluate("() => window.GAME.startBattle(5)"); pg.wait_for_timeout(1200)
        # force guaranteed catch: Math.random() -> 0 means chance test passes and damage rolls min
        pg.evaluate("() => { Math.random = () => 0; }")
        pg.locator(".btl-btn", has_text="BAG").first.click(); pg.wait_for_timeout(700)
        balls=[b.inner_text().strip() for b in pg.locator(".btl-btn").all()]
        print("bag:", balls)
        pg.locator(".btl-btn", has_text="BALLS").first.click()
        pg.wait_for_timeout(4500)
        pg.screenshot(path=f"{OUT}/13-catch-success.png")
        print("after forced catch:", pg.evaluate("""() => ({
            balls: GAME.state.inventory.balls,
            party: GAME.state.party.map(p => ({id:p.speciesId, lvl:p.level, hp:p.hp, moves:p.moves.length})),
            dexCaught: Object.keys(GAME.state.dex.caught),
            dexSeen: Object.keys(GAME.state.dex.seen),
            overlayOpen: !!document.querySelector('#battle-overlay') && !document.querySelector('#battle-overlay').classList.contains('hidden')
        })"""))
        b.close()
finally: srv.terminate()
print("PAGE ERRORS:", errs or "none")
