# Aetheris: Creature Chronicles

A 2D top-down open-world creature-collecting RPG. Vanilla HTML/CSS/JS, no
libraries, no CDN, no external assets, no network calls. Every sprite is drawn
procedurally with canvas primitives.

## Run it

```sh
cd ~/projects/argon-pokemon && python3 -m http.server 8099
```

Open <http://127.0.0.1:8099> in a browser.

## Controls

| Input | Action |
|---|---|
| Arrows / WASD | walk, with 120ms tile tween and collision |
| walk into tall grass | 12% chance per step to trigger a wild encounter |
| `1` `2` `3` `4` | use battle move |
| `BAG` / `B` | balls and potions |
| `CREATURE` | switch party member |
| `RUN` | 50% escape by speed |
| `Escape` | pause menu / close overlay |
| `Space` / click | complete or dismiss dialog |

## Files

| File | What it owns |
|---|---|
| `index.html` | canvas `#game` 960x600, HUD, dialog, menu, battle overlay |
| `style.css` | dark pixel theme, HUD, dialog, battle styling |
| `js/data.js` | 12 original species, type chart, seeded RNG helpers, 60x40 map |
| `js/battle.js` | turn-based battle overlay, damage, catch, faint, run |
| `js/world.js` | camera, tile rendering, movement, encounters, HUD, dialog, menu |
| `js/dex.js` | Bestiary, Adventure Guide, Save/Load screens (`GAME.ui.*`) |

Load order in `index.html` is `data.js`, `battle.js`, `world.js`, `dex.js`. `world.js`
only installs a stub `GAME.startBattle` if `battle.js` did not already define it.

## State contract

```js
GAME.state = {
  party: [{ speciesId, level, hp, maxHp, moves: [{name, power, type, pp, maxPp}], xp }],
  dex: { seen: {id: true}, caught: {id: true} },
  inventory: { balls: 5, potions: 2 },
  gold: 100,
  playerName: 'Ash'
}
```

`GAME.map` = `{w: 60, h: 40, tiles: Uint8Array, spawn: {x, y}, name: 'Verdant Hollow'}`.
Tile codes: `0` grass, `1` tallGrass, `2` water, `3` path, `4` tree, `5` building, `6` floor.

## Test harness

Headless Chromium on port 8099, zero page errors expected.

| Script | Purpose |
|---|---|
| `tools/smoke.py` | load, drive input, screenshot, DOM/state assertions |
| `tools/mapview.py` | print an ASCII view of the tile map around spawn |
| `tools/battletest.py` | force `startBattle`, assert overlay and buttons |
| `tools/catchtest2.py` | play a battle, read state, try a ball |
| `tools/catchforce.py` | force `Math.random = 0` to prove the catch success path |
| `tools/dextest.py` | Bestiary grid, silhouettes, detail strip, Guide, Save round trip |
| `tools/battleprog.py` | one-shot win, XP rollover, level-up maths, live battle state |

## Status

Verified working: movement, collision, camera, HUD, typewriter dialog, Escape
menu shell, tall grass encounters (12%/step, varied species), battle overlay
with PP and HP tween, damage with the type chart, catch success (party grows,
`dex.caught` set, balls decrement), bridge planks over water, houses that read
as houses, Bestiary, Adventure Guide, three-slot Save/Load.

Round 4 changes:

- **Houses are houses now.** `case 5:` used to draw a complete mini-house on
  every wall tile, which turned each 4x4 block into a ring of huts around a
  beige pit. Now `bldgBox()` finds the footprint (ring `5` plus interior `6`),
  the roof is drawn across every row but the bottom, shingles keyed off screen
  `y` so bands continue across tiles, and the bottom row is wall + centred door
  + windows. Tile `6` joined the `SOLID` table so you cannot walk onto a roof.
- **Graphics pass, overworld** (round 4c): three-tone shading everywhere with a
  top-left key light, grass blade texture and per-tile tone variation, animated
  tall-grass sway and water foam from `t` only, pebbled path with edge lips,
  layered tree canopies with outlines and ground shadows, brick-bond roof
  shingles with staggered rows, a chimney on some houses, a redrawn 16x22
  four-direction trainer with a walk cycle, a cached vignette, and a **depth
  sort**: trees, buildings and the player now draw in one list ordered by their
  bottom edge, so the player walks behind a roof or canopy instead of always on
  top.
- **Battle round** (round 4d, `battle.js`): both creatures stand on draw-order-correct
  platform discs, each side carries a colour-coded **type badge**, creatures gained a
  1px outline with shaded body blobs and catchlight eyes, hits trigger a short white
  flash (`source-atop`), the player side has an **XP bar** with a numeric label, and
  **XP finally does something**: `xpToNext(level) = 15 * level + 25`, wins roll XP over
  into levels, and a level-up raises `maxHp` and `hp` by the same amount. The live battle
  object is exposed as `GAME.state.battle` (`wildId, wildLvl, wildHp, wildMaxHp,
  playerIndex, playerHp, playerMaxHp, level, xp, over`) so tests can assert instead of
  guessing.
- **Bestiary** (`dex.js`): all 12 species as a scrollable grid, procedural
  sprites via `GAME.drawCreature`, silhouettes plus `???` for the unseen,
  CAUGHT/SEEN labels, progress bar, and a detail strip with base stats, catch
  rate and moves.
- **Adventure Guide** (`dex.js`): six short sections covering movement,
  encounters, battles and the type chart, catching, menus, saving.
- **Save/Load** (`dex.js`): slots 1-3 in `localStorage` under `aetheris.save.N`,
  payload `{version, savedAt, state, position}`, two-step Delete, refuses to
  load mid-battle, and rejects a saved tile that is solid or out of bounds.

Known issues and next work:

1. **Creatures / Inventory / System tabs still stubs.** `callUI()` logs
   "not yet implemented" for them; only Bestiary, Guide and Save exist.
2. **Battle scene is sparse.** The overlay is a flat dark panel: no backdrop, no
   ground, no entrance animation, and only the platforms ground the creatures.
3. Houses cannot be entered: the interior is roof and tile `6` is solid. There is no
   interior content, so this is intended.
4. `dex.js` validates `version`, `state` and `position` on load, but does not
   deep-validate party species ids against `GAME.species`.
5. Grass tone variation reads slightly checkerboard; a hash-based dither would smooth it.

## How this was built

Orchestrator (DSH agent) wrote **zero game code**. It wrote specs, then reviewed
and verified each round in headless Chromium, feeding defects back to the model:

| Round | Model | Result |
|---|---|---|
| 1a | Gemini 4 Argon (web, high) | `index.html`, `style.css` |
| 1b | Gemini 4 Argon (web, medium) | `js/data.js` |
| 1c | Gemini 4 Argon (web) | died on quota |
| 2, 3 | Claude Opus 4.6 via `agy` | `js/world.js`, `js/battle.js`, art fixes |
| 4a | DeepSeek web (thinking+search on) | `js/world.js` building compositing |
| 4b | DeepSeek web (thinking+search on) | `js/dex.js` Bestiary, Guide, Save/Load |
| 4c | DeepSeek web (thinking+search on) | `js/world.js` full graphics pass + depth sort |
| 4d | DeepSeek web (thinking+search on) | `js/battle.js` platforms, badges, XP + level-up |

Defects caught by review that the models did not notice on their own:

- encounters always spawned the same species (`helpers.rng(7)` re-seeded on
  every call); replaced with one persistent `wildRng`
- building blocks rendered as repeating walls
- file extraction swallowed code-block language labels (`index.htmlHTML`)
