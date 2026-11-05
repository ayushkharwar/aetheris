You are a senior front-end game engineer. You are rewriting ONE file of a finished,
working browser game: `js/battle.js`, attached in full.

# 1. Context

`Aetheris: Creature Chronicles`: vanilla HTML/CSS/JS, Canvas 2D, no libraries, no
external assets, ES5 only. The battle is a DOM overlay (`#battle-overlay`) containing two
sprite canvases (120x100 each), a message box, a four-move grid and action buttons.

Relevant internals already in the file:

- `drawCreature(cvs, palette, facingRight, bobY, lungeX)` draws a procedural creature.
  It is **exported** as `G.drawCreature` and used by another file (`js/dex.js`), so its
  signature and its clear-then-draw behaviour must keep working exactly.
- `buildUI()` creates `ui.pCanvas`, `ui.wCanvas`, `ui.pName`, `ui.pLvl`, `ui.wName`,
  `ui.wLvl`, `ui.pBar`, `ui.wBar`, `ui.pHpText`, `ui.wHpText`, `ui.msgBox`, `ui.menu`,
  `ui.moveGrid`, `ui.moveBtns`, `ui.actionRow`, `ui.bagBtn`, `ui.creatureBtn`,
  `ui.runBtn`, `ui.subMenu`.
- `updateBars()` already writes `hp/max` into both HP text elements and sets bar widths.
- `winBattle()` already computes `xpGain = floor(species.baseHp * wildLvl / 7)`, adds it
  to `pm.xp`, and prints "Gained N XP!". **`xp` is never used for anything else: there is
  no level-up.** That is the main thing this round fixes.
- `startBattle` rolls `wildLvl` and sets `G.state.dex.seen[wildId] = true`.
- `animLoop(now)` calls `drawCreature(ui.pCanvas, ...)` and `drawCreature(ui.wCanvas, ...)`
  every frame with `pBob`/`wBob`/`pLunge`/`wLunge`.

# 2. What must change (implement all of it)

## 2.1 Arena platforms

Both creatures must stand on a visible platform disc, drawn **behind** the creature.

- Refactor the sprite drawing into two layers: a body drawer that does **not** clear the
  canvas, and a platform drawer. `drawCreature(cvs, ...)` keeps its exact current
  behaviour (clear, then body) so `G.drawCreature` and `js/dex.js` are unaffected.
- The battle anim loop must instead call a new `drawSide(cvs, palette, facingRight, bobY,
  lungeX, isWild)` that clears, draws the platform, then the body.
- Platform geometry, in canvas coordinates, `w` and `h` being the canvas size:
  - outer ellipse centre `(w/2, h - 14)`, radiusX `42`, radiusY `10`, fill
    `rgba(0,0,0,0.30)`,
  - inner ellipse same centre, radiusX `34`, radiusY `7`, fill
    `rgba(255,255,255,0.09)`,
  - a 2px rim arc on the front half of the outer ellipse, stroke
    `palette[2]` at `globalAlpha 0.35`, then reset alpha to 1,
  - the wild side is 3px lower than the player side (shift the whole ellipse down by 3 on
    `isWild`), which sells the perspective, and the wild side is drawn at 0.92 scale.

## 2.2 Type badges

A small pill next to each creature's level showing its type.

- Inline styles only (no CSS file changes, no new classes required).
- Pill: `display:inline-block; padding:1px 6px; border-radius:3px; font-size:10px;
  letter-spacing:0.5px; text-transform:uppercase; border:1px solid rgba(0,0,0,0.45);`
- Type colours: Fire `#ff595e`, Water `#1982c4`, Grass `#52b788`, Normal `#9aa3b2`,
  Electric `#ffd166`. Dark text `#10141c` on Electric and Normal, `#ffffff` on the rest.
- Create one badge element per side in `buildUI()`, store as `ui.pBadge` / `ui.wBadge`,
  and update text plus colours in `updateBars()` from `G.species[...].type`.

## 2.3 Creature art polish

Inside the body drawer only, keeping the same silhouette and the same three palette
colours:

- Add a hex shade helper inside the IIFE:
  `function shade(hex, f)` parses `#rrggbb` and multiplies each channel by `f`, clamped to
  0..255, returning `rgb(r,g,b)`. No libraries.
- Body: base `palette[0]`; add a soft shadow blob in the lower-right of the body filled
  `shade(palette[0], 0.72)` at `globalAlpha 0.55`; add a highlight blob on the upper-left
  of the head filled `shade(palette[0], 1.22)` at `globalAlpha 0.40`; reset alpha after.
- 1px dark outline: stroke the head and body ellipses with `rgba(18,14,22,0.85)`,
  `lineWidth 1`.
- Eyes: white sclera ellipse, dark pupil `#14101a`, and a 1px white catchlight dot.
- Keep everything deterministic (no `Math.random`), and keep the existing bob/lunge
  motion untouched.

## 2.4 Hit flash

- Two module-level timestamps `flashP` and `flashW` (start at `0`).
- Set `flashW = performance.now() + 120` when the wild takes damage, `flashP` when the
  player does.
- In `animLoop`, after drawing a side, if `performance.now() < flash`, fill the whole
  canvas with `rgba(255,255,255,0.45)` using `globalCompositeOperation = "source-atop"`,
  then reset the composite op to `"source-over"`.

## 2.5 XP curve and level-up

- New helper `xpToNext(level)` = `15 * level + 25`. Export it as `G.xpToNext` so other
  screens can draw an XP bar later.
- In `winBattle()`, after `pm.xp += xpGain`, loop:
  `while (pm.xp >= xpToNext(pm.level)) { pm.xp -= xpToNext(pm.level); pm.level += 1; ... }`
- On each level gained: recompute `pm.maxHp = calcHp(species.baseHp, pm.level)`, raise
  `pm.hp` by the same amount the maximum went up (do not full-heal), and leave
  `baseAtk`/`baseDef`/`baseSpd` untouched since they are derived from level at use time.
- Message sequence on win, in order, each through the existing `typeMsg`/`chainMsgs`:
  1. `"<Wild name> fainted!"`
  2. `"Gained <n> XP!"`
  3. for each level gained: `"<Name> grew to Lv<level>!"`
  4. then hide the overlay after a short delay, exactly as it does now.
- Do not award XP for a run-away or a lost battle.
- `updateBars()` must refresh the player's XP bar after a level-up.

## 2.6 XP bar on the player side

- In `buildUI()`, under the player HP text, add a wrapper div (`ui.pXpWrap`) with an
  inline-styled track (height 4px, `background:#1b2230`, `border-radius:2px`,
  `margin-top:4px`) and a fill div (`ui.pXpFill`, height 100%, `background:#6ad1ff`,
  `width:0%`, `transition:width 180ms linear`), plus a small label (`ui.pXpLabel`,
  `font-size:10px`, `color:#93a4bd`).
- `updateBars()` sets fill width to `(pm.xp / xpToNext(pm.level)) * 100` and the label to
  `"XP " + pm.xp + "/" + xpToNext(pm.level)`.

## 2.7 Expose live battle state for automated tests

- Module-level object:
  `var live = { wildId: null, wildLvl: 0, wildHp: 0, wildMaxHp: 0, playerIndex: 0,
                playerHp: 0, playerMaxHp: 0, level: 0, xp: 0, over: false };`
- Assign `G.state.battle = live;` once at IIFE evaluation time.
- Update every field inside `updateBars()` (it is already called whenever anything
  changes), and set `live.over = true` in `winBattle()` and in the all-fainted path, and
  `live.over = false` in `startBattle`.

# 3. Hard constraints

- **ES5 only**: `var`, `function`, no arrow functions, no template literals, no
  `const`/`let`, no `class`. The file currently has zero ES6 and must stay that way.
- No `Math.random()` in any drawing path.
- No new globals except `G.state.battle`, `G.xpToNext`, and the existing
  `G.startBattle` / `G.drawCreature`; add `G.drawArena` only if you need it, and keep
  `G.drawCreature` behaving exactly as today.
- Do not touch `index.html`, `style.css`, or any other file. Inline styles only.
- **Do not change gameplay**: the damage formula, the type chart usage, PP costs, catch
  rates, the 50% run escape, turn order, faint/switch logic, sub-menu behaviour, and the
  four-move grid all keep working exactly as now.
- Reset `ctx.globalAlpha` and `ctx.globalCompositeOperation` after every use.

# 4. Acceptance checklist: verify each line against your own code before answering

- [ ] Both creatures stand on a platform disc; the disc is behind the creature, not on top.
- [ ] `G.drawCreature` still clears and draws exactly as before (dex.js depends on it).
- [ ] A type badge shows on both sides and changes colour with the species type.
- [ ] Creatures have a 1px outline, a shading blob and catchlight eyes.
- [ ] A hit makes the hit creature flash briefly, and the flash fades out.
- [ ] Winning awards XP, and enough XP raises the level: max HP grows by the right amount,
      current HP grows by the same amount, and the message chain shows the level-up line.
- [ ] The XP bar and label update on damage, on win and after a level-up.
- [ ] `GAME.state.battle` is live: after a battle starts it reports wild id, level, HP and
      the active party index, and `over` flips true when the wild faints.
- [ ] Zero ES6, zero `Math.random` in draw code, no CSS or HTML changes.
- [ ] No console errors and no page errors; the whole battle still plays to the end.

# 5. Output format (strict)

- Exactly **one** fenced code block containing the **entire** file, first line to last.
- The line immediately before the fence must be exactly:

```
FILE: js/battle.js
```

- Nothing outside the fence: no explanation, no changelog, no ellipses, no TODOs.
- If and only if you had to skip a checklist line, add one line after the closing fence
  starting with `NOTE:`. Maximum one line.
