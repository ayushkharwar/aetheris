# TASK: rewrite ONE file of a finished game, fixing how buildings are drawn

You are working on `Aetheris: Creature Chronicles`, a 2D top-down creature-collecting
RPG. The complete, currently working file `js/world.js` is attached. Rewrite it.

## Environment and hard constraints

- Vanilla HTML/CSS/JS. **No libraries, no CDN, no external assets, no network calls.**
  All art is drawn procedurally with Canvas 2D primitives inside `drawTile`.
- The file is written in **ES5** on purpose: `var`, `function`, no arrow functions, no
  template literals, no `const`/`let`, no classes. Keep it that way. Verified: the file
  currently contains exactly zero ES6 constructs.
- `TILE = 32`, canvas `960x600`. Load order is `data.js`, `battle.js`, `world.js`.
- Do not add globals. Do not add new top-level names. Everything stays inside the
  existing IIFE.
- Do not rename anything. Do not reformat untouched lines. Preserve every existing
  comment.
- No `Math.random` in rendering: drawing must be deterministic frame to frame.

## The bug

Buildings render as **hollow courtyards**. In the map data a house is:

- a rectangular **ring** of tile `5` (wall), 4x4 in the shipped map,
- with the inside filled with tile `6` (floor), and the door tile also `6`.

`case 5:` in `drawTile` draws a **complete little house on every single tile**: wall,
roof band, a door in the middle and two windows. So a 4x4 house becomes 12 identical
mini-houses arranged in a ring around a beige floor pit. That is what must be fixed.

## What you must implement

Use the existing helpers as they are: `tileAt(gx, gy)`, `inBldg(gx, gy)`,
`bldgBottom(gx, gy)`, and the existing palette object `C`.

1. **Add a footprint helper** `bldgBox(gx, gy)` that returns the bounding box of the
   building the tile belongs to: `{ left, right, top, bottom, w, h, doorX }`.
   Walk outwards while the tile is `5` **or** `6` (a building is its ring plus its
   inside). `doorX` = the centre column of the footprint: `left + ((w / 2) | 0)`.
   Must be cheap and safe at map edges, and must not loop forever.
2. **Roof: every footprint tile that is NOT on the bottom row.**
   - Base fill `C.roof`.
   - Horizontal shingle bands every 8px, alternating `C.roof` and `C.roofMid`. Compute
     the band index from the **screen y** (`sy`), not from a per-tile counter, so the
     bands continue seamlessly across tile borders.
   - A `C.roofRidge` ridge line 3px tall only across the **top row** of the footprint.
   - A vertical seam line at every tile boundary inside the footprint, 1px, `C.roofRidge`
     at 0.35 alpha via `ctx.globalAlpha` (reset it to 1 afterwards).
   - A 3px `C.roofRidge` eave along the **bottom edge of the roof**, i.e. the bottom of
     the last roof row, so the roof visibly overhangs the wall below it.
   - On the footprint's leftmost and rightmost roof columns, a 2px `C.roofRidge` border.
3. **Wall: the bottom row of the footprint.**
   - Fill `C.wall`, then a `C.wallDk` foundation strip 4px tall at the very bottom of the
     tile, and a `C.wallSh` 1px top edge where the wall meets the roof.
   - The tile at `doorX`: draw an arched door 12px wide, 20px tall, sitting on the
     foundation: `C.door` body, a 2px darker `C.roofRidge` frame, `C.doorKnob` knob 2x2
     on the right side, and a `C.wallDk` 3px step under it.
   - Every other bottom-row tile: one window, 12px wide, 9px tall, vertically centred in
     the wall: `C.winF` frame, `C.winG` glass, and a 1px `C.winF` cross (one vertical, one
     horizontal) through the glass.
4. **Neighbour awareness only.** No full-map scan, no caching, no per-frame allocation
   beyond small object literals. The existing per-tile draw path stays.
5. **Collision:** `isSolid` currently returns true only for tile `5`. Because the inside
   of a house now renders as a roof, a walkable floor tile inside it would put the player
   on top of the roof. Change `isSolid` so tiles `5` **and** `6` are solid.
   That is the only behaviour change allowed outside the renderer: tile `6` is used only
   for building interiors and door tiles (`data.js` comment: "building walls = 5, floor
   inside = 6, door = 6"), so nothing else in the map depends on it being walkable.
6. **Everything else must behave exactly as before**: movement and tween, camera,
   `isWaterNear`, encounters (12% per step in tall grass), battle flash and
   `GAME.startBattle` hook, HUD, typewriter dialog, pause menu, `case 0..4` and `case 6`
   rendering, the `GAME.world` exports.

## Palette you must use (do not invent colours)

```
roof #b03030   roofMid #983838   roofLt #c04848   roofRidge #782020
roofShadow rgba(0,0,0,0.18)      chimney #706058  chimneyTop #504840
wall #d4c9a8   wallSh #b8ad8e    wallDk #a09478
door #6b4226   doorKnob #c8a84e  winF #607080     winG #a8d8ea
floor #e8dcc0  path #c9a95e
```

## Output format (strict)

- Exactly **one** fenced code block containing the **entire** file, from the first line
  to the last. No elisions, no `...`, no `// unchanged`, no TODOs.
- The line immediately before the fence must be exactly:

```
FILE: js/world.js
```

- Nothing else outside the fence. No explanation, no changelog, no summary.
- The result must run as-is when dropped in place of the current file, with zero console
  errors and zero page errors.
