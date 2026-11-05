import subprocess, sys, time
from playwright.sync_api import sync_playwright
PORT=8099
srv=subprocess.Popen([sys.executable,"-m","http.server",str(PORT)],cwd=".",
                     stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1.2)
try:
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True,args=["--no-sandbox"]); pg=b.new_page()
        pg.goto(f"http://127.0.0.1:{PORT}/index.html",wait_until="load"); pg.wait_for_timeout(1500)
        info=pg.evaluate("""() => {
            const m = window.GAME.map, counts = {};
            for (const t of m.tiles) counts[t] = (counts[t]||0)+1;
            const sp = m.spawn, rows = [];
            for (let y = sp.y-6; y <= sp.y+6; y++) {
                let line = "";
                for (let x = Math.max(0,sp.x-14); x <= Math.min(m.w-1,sp.x+14); x++) {
                    const t = m.tiles[y*m.w+x];
                    line += " .#~=TBF"[t] || "?";
                }
                rows.push(String(y).padStart(2," ") + " " + line);
            }
            return {w:m.w,h:m.h,counts:counts,spawn:sp,name:m.name,rows:rows,
                    legend:". grass  # tallGrass  ~ water  = path  T tree  B building  F floor"};
        }""")
        for k in ("name","w","h","spawn","counts","legend"): print(k+":", info[k])
        print("\n".join(info["rows"])); b.close()
finally: srv.terminate()
