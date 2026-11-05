You are a senior rendering engineer for 2D pixel-art games. You are rewriting the
renderer of a working browser game. The complete current file `js/world.js` is attached.

# 1. Context

`Aetheris: Creature Chronicles` is a top-down creature-collecting RPG: vanilla
HTML/CSS/JS, Canvas 2D, no libraries, no external images, every pixel drawn with canvas
primitives. `TILE = 32`, canvas `960x600`, one tile layer plus a player sprite, camera
follows the player, `drawTile(code, sx, sy, t, gx, gy)` is called per visible tile with
`t = performance.now()`, and `drawPlayer(sx, sy, dir, wf)` gets a 0/1 walk frame.

# 2. What is wrong with the current art (do not reproduce this)

- Terrain is flat single-colour fills. Grass is one green with random speckles that read
  as noise, not texture.
- Water is three static horizontal bands. It reads as a blue stripe, not water.
- Trees are three stacked rectangles with no shading, no outline, no ground shadow.
- Nothing has an outline, so sprites dissolve into the grass behind them.
- No shadows anywhere, so nothing is grounded and the scene has zero depth.
- The player is a legless blob about 16px tall with one flat colour per part.
- Tiles read as wallpaper: every tile is equally loud, so there is no focal point.
- The player is always drawn on top of everything, including tree canopies and roofs,
  so walking "behind" an object looks broken.

# 3. Art direction (follow exactly)

- Style: **16-bit era, top-down, limited palette**, like a late SNES RPG.
- **Key light from the top-left.** Every material gets three values: shadow, base,
  highlight, with the highlight on the upper-left edge and shadow on the lower-right.
- **Terrain is the background, objects are the foreground.** Terrain colours must sit
  roughly 10 to 15 percent darker and less saturated than characters and objects, so
  the player and buildings pop.
- **Everything solid gets a 1px dark outline and a soft ground shadow.**
- Animation is slow and subtle. Nothing blinks or jitters. Every animation must be
  continuous across tile borders, computed from absolute position plus `t`, never from
  per-tile phase offsets that reset.

# 4. Required changes, material by material

Implement all of these. Be literal and pixel-precise.

1. **Grass (code 0).** Base fill with a vertical two-tone band (upper edge lighter).
   Add 3 to 5 short blade marks per tile: 1px wide, 3px tall, upper pixel in `bladeA`,
   lower in `bladeB`. Positions deterministic from `(gx, gy)` via a tiny integer hash
   you write inside the IIFE (`h = (gx*73856093 ^ gy*19349663) >>> 0`).
   Vary base colour slightly per tile from a 4-entry array already present (`gS`).
2. **Tall grass (code 1).** Same base plus 6 to 8 taller blades (2px wide, 7 to 10px
   tall) with a two-tone ramp. Sway: horizontal offset `Math.round(Math.sin((t/900) + (gx * 13 + gy * 7) ) * 1)` applied to the blade tips only. Period about 5.6s, amplitude 1px.
3. **Water (code 2).** Vertical three-band gradient (`waterDeep` at the bottom,
   existing `w1`/`w2` as base and upper). Animated foam: two horizontal 1px lines whose
   x-offset is `Math.floor((t/40 + gx*8 + gy*5) % TILE)`, drawn in `waterFoam` at 0.55
   alpha. A 1px darker lip on any tile edge that touches a non-water tile, so the
   shoreline reads.
4. **Path (code 3).** Base `C.path`, plus 4 to 6 pebbles (1 to 2px `pathSp` rects) placed
   by the same hash, plus a 1px lighter lip (`pathEdge`) on edges that touch grass, and a
   2px soft shadow where the path meets water. No speckle noise.
5. **Trees (code 4).** Ground shadow first: ellipse, `rgba(0,0,0,0.20)`, centred at the
   tile bottom, radii about 13x4. Trunk: 8px wide with a dark left edge and lit right
   edge, 2 shades of `trunk`. Canopy: three overlapping circles (`ctx.arc`) with a
   three-tone ramp `canopy`, `canopyLt`, plus a new `highlight`; then a 1px `outline`
   arc around the silhouette. Canopy sway: 1px horizontal offset of the whole canopy,
   phase from `gx*11 + gy*3`, period about 6s.
6. **Buildings (codes 5 and 6).** Keep the existing footprint compositing exactly as it
   is. Improve only the texture: shingle rows every 6px with a 1px stagger that alternates
   per row (brick-bond look), a `roofRidge` ridge highlight on the top row, a
   `roofShadow` band under the roof above the wall row, and a ground shadow strip on the
   row **below** the wall row (draw it on the wall tile itself, 4px at the bottom, so no
   extra draw pass is needed). Add a chimney (existing `C.chimney` / `C.chimneyTop`,
   12x14px, with a 2px cap and a 2px top-left highlight) on the top row of a footprint
   only when `(box.left * 7 + box.top * 13) % 3 === 0`. Windows get a 1px `winF` frame
   plus a diagonal 1px highlight in `winG`.
7. **Player (`drawPlayer`).** Redraw as a proper 16x22 trainer sprite, centred on the
   tile, with:
   - a 1px `outline` around the whole silhouette,
   - a `rgba(0,0,0,0.22)` shadow ellipse at the feet (radii 8x3),
   - **four directions**: `dir` 0 = facing down, 1 = up, 2 = left, 3 = right. Down/up
     show the face or the back of the head; left/right show a profile.
   - a two-frame walk cycle driven by `wf`: frame 0 legs together, frame 1 legs split,
     plus a 1px vertical body bob on frame 1.
   - a three-tone outfit (cap, jacket, trousers) with the highlight on the upper-left.
8. **Depth sort.** The player must be occluded by tall objects that are below him on
   screen. Build a small array of "tall" drawables in the visible range (trees coded 4,
   plus the player) and draw them sorted by their bottom edge (`gy * TILE + TILE` for
   tiles, `player.py + 26` for the player), so the player disappears behind a tree
   canopy when he walks behind it and reappears in front when he walks below it. Reuse
   one scratch array declared once, never allocate inside the loop, and cap it at 800
   entries.
9. **Vignette.** After the world is drawn, one cached radial gradient (built once, reused
   every frame) that darkens the four screen edges by about 0.18 alpha. Nothing else on
   top of the HUD.
10. **Outline helper.** One small helper `olRect(x, y, w, h)` and `olArc(cx, cy, r, a0, a1)`
    used by everything above, so outlines stay 1px and consistent.

# 5. Palette rules

You may add **at most these 8 keys** to the existing `C` object, and no others:

```
shade1, shade2, highlight, waterDeep, waterFoam, bladeA, bladeB, outline
```

Everything else must use existing keys (`tgBase, tgA, tgB, tgC, w1, w2, path, pathSp,
pathEdge, trunk, canopy, canopyLt, roof, roofMid, roofLt, roofRidge, roofShadow,
chimney, chimneyTop, wall, wallSh, wallDk, door, doorKnob, winF, winG, floor`).
Pick values that fit the existing palette; no neon, no pure black (`outline` should be a
very dark desaturated blue-brown such as `#1b1520`, not `#000`).

# 6. Hard constraints

- **ES5 only**: `var`, `function`, no arrow functions, no template literals, no
  `const`/`let`, no classes. The current file has zero ES6 and must stay that way.
- No `Math.random()` anywhere in a draw path. Animation and texture must be deterministic
  functions of `t`, `gx`, `gy`.
- No new globals. Everything stays inside the existing IIFE. Do not rename existing
  functions or the exported `GAME.world` API (`player`, `showDialog`, `updateHUD`,
  `started`).
- Do not change gameplay: movement speed, 120ms tween, collision (`SOLID` table),
  encounter chance, HUD text, dialog, pause menu, `GAME.startBattle` hook.
- Do not touch `case 3`..`case 7` behaviour outside the textures described above, and do
  not touch any other file.
- Performance: the renderer must stay O(visible tiles). No `ctx.createLinearGradient` or
  `createRadialGradient` inside the per-tile path; if you need a gradient, build it once
  per frame outside the tile loops and reuse it, or fake it with 2 to 3 stacked rects.
- `ctx.globalAlpha` must be reset to `1` after every use, and every `beginPath` must be
  paired with a single `fill`/`stroke`.

# 7. Acceptance checklist: verify each line against your own code before answering

- [ ] Grass, tall grass, water, path, trees, buildings, player all use a 2 or 3 tone ramp.
- [ ] Water and tall grass animate purely from `t` and their coordinates, with visible
      continuity across tile borders (no seams, no flip-flop per tile).
- [ ] Every tree, building and the player has a ground shadow.
- [ ] Every non-terrain object has a 1px `outline`.
- [ ] The player is occluded by trees/buildings that sit below him on screen.
- [ ] `dir` shows four visually distinct facings and `wf` changes the legs.
- [ ] Zero ES6 constructs. Zero `Math.random` in draw code. Zero new globals.
- [ ] No `createGradient` call inside the tile loop.
- [ ] The file loads with no console or page errors, and movement/collision/encounters/
      HUD/dialog/menu behave exactly as before.

# 8. Output contract

- Exactly **one** fenced code block with the **entire** file, first line to last line.
- The line immediately before the fence must be exactly:

```
FILE: js/world.js
```

- Nothing else outside the fence. No explanation, no changelog, no elisions, no TODOs.
- If, and only if, you could not satisfy one checklist item, add a single line after the
  closing fence starting with `NOTE:` naming the item and the reason. Maximum one line.
