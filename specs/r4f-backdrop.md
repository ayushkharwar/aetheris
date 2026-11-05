You are a senior front-end game engineer. You are rewriting ONE file of a finished
browser game: `js/battle.js`, attached in full. Do not change any other file.

# 1. Current state (it works, keep it working)

`Aetheris: Creature Chronicles`, vanilla ES5 + Canvas 2D. The battle is a DOM overlay
(`#battle-overlay`) rebuilt by `buildUI()` on every `startBattle()`. It contains
`.btl-scene` (holding `.btl-side-player` with `ui.pCanvas` and `.btl-side-wild` with
`ui.wCanvas`), then the message box and the move grid.

Already implemented and must stay identical in behaviour: platform discs drawn under each
creature via `drawSide()`, type badges (`ui.pBadge` / `ui.wBadge`), creature shading and
outline, hit flash (`flashP` / `flashW` with `source-atop`), XP bar (`ui.pXpFill`,
`ui.pXpLabel`), `xpToNext` + level-up on win, `GAME.state.battle` live state,
`G.drawCreature` export used by `js/dex.js`, PP, catch, run, faint/switch, turn order.

# 2. What to add

## 2.1 A real battle backdrop

The scene is currently a flat dark rectangle, which makes the creatures look like they are
floating in a void. Add a painted backdrop behind both sides, built in `buildUI()`:

- Right after creating `scene`, set `scene.style.position = "relative"` (inline, no CSS
  file change) and append a backdrop element as the **first** child of `scene`.
- Backdrop element: `position:absolute; inset:0; z-index:0; pointer-events:none;`
  with these layers, all inline styles, no images, no canvas:
  - **sky**: `linear-gradient(180deg, #0d1320 0%, #16202f 42%, #22303f 62%)`,
  - **horizon band**: a `#2c4a3a` strip sitting at 62% height, 6px tall, with
    `box-shadow: 0 0 24px 6px rgba(44,74,58,0.35)` so it glows faintly,
  - **ground**: below the horizon, `linear-gradient(180deg, #1d2b22 0%, #131a15 100%)`,
  - **ground shadow pools**: two absolutely positioned ellipses
    (`border-radius:50%`, `background:radial-gradient(closest-side, rgba(0,0,0,0.45),
    rgba(0,0,0,0))`), one under each sprite, roughly 260x70px, centred under the
    platform discs (player side left third, wild side right third).
- The two sides (`.btl-side-player`, `.btl-side-wild`) must sit **above** the backdrop:
  set `style.position = "relative"; style.zIndex = "1"` on them in `buildUI()`.
- Nothing may overlap or hide the message box or the move grid.

## 2.2 An entrance animation, once per battle

- In `buildUI()`, immediately after creating each sprite canvas, set
  `ui.pCanvas.style.transform = "translateX(-72px)"` with `opacity = "0"`, and
  `ui.wCanvas.style.transform = "translateX(72px)"` with `opacity = "0"`.
- At the end of `startBattle()`, after `buildUI()` has run, schedule the reveal with two
  nested `requestAnimationFrame` calls (so the initial style is committed first), then:
  `transition = "transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 320ms ease-out"`,
  `transform = "translateX(0)"`, `opacity = "1"`.
- The info panels and badges should fade in with a 120ms delay and a 260ms duration, using
  the same `opacity` technique, so the entrance reads as sprite first, then HUD.
- The entrance must run exactly once per battle, must not restart when the player
  attacks, and must not interfere with the per-frame `drawSide()` calls or the hit flash.

## 2.3 Small polish, only if it does not risk anything

- A faint vignette on the overlay: one `box-shadow: inset 0 0 120px 20px rgba(0,0,0,0.55)`
  on the backdrop element (inline).
- Do **not** add particles, weather, timers that keep running, or anything requiring a
  new animation frame loop; the existing `animLoop` is the only loop.

# 3. Hard constraints

- **ES5 only**: `var`, `function`, no arrow functions, no template literals, no
  `const`/`let`, no `class`. The file has zero ES6 today and must stay that way.
- No `Math.random()` in drawing code. No `setInterval`. No new globals outside the IIFE
  except the ones already exported.
- `G.drawCreature` must keep its exact current behaviour (clears the canvas, draws the
  body) because `js/dex.js` calls it.
- Do not change gameplay: damage, type chart, PP, catch rates, run escape, turn order,
  faint/switch, level-up maths, `GAME.state.battle` fields.
- Do not touch `index.html`, `style.css`, `js/dex.js`, `js/panels.js`, or any other file.
  Inline styles only.
- Reset `ctx.globalAlpha` and `ctx.globalCompositeOperation` after every use.

# 4. Acceptance checklist: verify each line against your own code before answering

- [ ] The battle shows a sky, a glowing horizon line, a darker ground and two shadow pools.
- [ ] Both creatures slide in from their own sides and fade in, once per battle.
- [ ] The sprite canvases still animate their bob and lunge after the entrance completes.
- [ ] The hit flash still works after the entrance.
- [ ] Backdrop sits behind the sprites; message box and move buttons are unobstructed.
- [ ] A second battle re-runs the entrance (buildUI is called again).
- [ ] Zero ES6, no new globals, no other file touched, no page errors.
- [ ] The whole battle still plays to the end, and a win still levels up as before.

# 5. Output format (strict)

- Exactly **one** fenced code block with the **entire** file.
- The line immediately before the fence must be exactly:

```
FILE: js/battle.js
```

- Nothing outside the fence: no explanation, no changelog, no ellipses, no TODOs.
- If and only if you had to skip a checklist line, add one line after the closing fence
  starting with `NOTE:`. Maximum one line.
