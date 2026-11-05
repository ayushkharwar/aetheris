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
        pg.goto(f"http://127.0.0.1:{PORT}/index.html",wait_until="load"); pg.wait_for_timeout(2000)
        info=pg.evaluate("""() => ({
            state: window.GAME.state ? Object.keys(window.GAME.state) : null,
            party: window.GAME.state ? window.GAME.state.party : null,
            dex: window.GAME.state ? window.GAME.state.dex : null,
            inv: window.GAME.state ? window.GAME.state.inventory : null,
            startBattleType: typeof window.GAME.startBattle })""")
        print("STATE CONTRACT:", json.dumps(info, indent=1)[:700])
        pg.evaluate("() => window.GAME.startBattle(3)"); pg.wait_for_timeout(2500)
        pg.screenshot(path=f"{OUT}/10-battle.png")
        bt=pg.evaluate("""() => ({
            overlay: !!document.querySelector('[id*=battle],[class*=battle]'),
            visible: [...document.querySelectorAll('[id*=battle],[class*=battle]')].map(e=>e.id+':'+(e.offsetParent?'shown':'hidden')),
            buttons: [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,10)
        })""")
        print("BATTLE:", json.dumps(bt, indent=1)[:600])
        b.close()
finally: srv.terminate()
print("PAGE ERRORS:", errs or "none")
