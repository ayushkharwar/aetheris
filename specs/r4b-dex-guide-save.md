# TASK: write ONE NEW file that adds three pause-menu screens

Game: `Aetheris: Creature Chronicles`, a 2D top-down creature-collecting RPG in vanilla
HTML/CSS/JS. This round adds the three screens the pause menu already tries to open but
which were never written.

Attached for reference (read them, do not rewrite them): `index.html`, `style.css`,
`js/data.js`, `js/battle.js`, `js/world.js`.

## Deliverable

A single new file `js/dex.js`. It must be the complete, runnable file.

## How the game expects to be extended

`world.js` dispatches menu actions like this:

```js
function callUI(name) {
  if (G.ui && typeof G.ui[name] === "function") G.ui[name]();
  else console.log("GAME.ui." + name + "() – not yet implemented");
}
```

So your file must create `window.GAME.ui` (if missing) and attach three functions:
`GAME.ui.Pokedex`, `GAME.ui.Guide`, `GAME.ui.Save`. No other globals. No other files
change. All three render into the existing `<div id="menu-content" class="menu-content">`
which is emptied each time the pause menu opens.

## Hard constraints

- **ES5 only**: `var`, `function`, no arrow functions, no template literals, no
  `const`/`let`, no classes, no `Array.prototype.includes`, no `Object.assign`.
- No libraries, no CDN, no external assets, no network calls, no emoji.
- Must not throw when data is missing: `GAME.state.dex` may be `{}`, a species may never
  have been seen, `localStorage` may be blocked (every access wrapped in try/catch).
- Wrap the whole file in `(function (G) { "use strict"; ... })(window.GAME);` and handle
  `window.GAME` being undefined by returning early.
- Clear `#menu-content` before rendering anything, and never leave the DOM in a broken
  state if a render throws: build into a detached element and append once at the end.
- Reuse existing CSS classes where they fit: `btn`, `btn-tab`, `btn-small`, `hud-text`,
  `menu-title`. For anything else use inline styles on your own elements; do not rely on
  new classes existing in `style.css`.

## Data you can rely on

```js
GAME.species = [{ id, name, type, baseHp, baseAtk, baseDef, baseSpd, catchRate,
                  moves: [{ name, power, type, pp, maxPp }], palette: [c1, c2, c3] }]

GAME.state = {
  party: [{ speciesId, level, hp, maxHp, moves, xp }],   // may be empty
  dex: { seen: { [id]: true }, caught: { [id]: true } },  // may be missing entirely
  inventory: { balls: 5, potions: 2 },
  gold: 100,
  playerName: "Ash"
}

GAME.map = { w, h, tiles: Uint8Array, spawn: {x, y}, name }
// tile codes: 0 grass, 1 tallGrass, 2 water, 3 path, 4 tree, 5 building wall,
//             6 building floor, 7+ unused. SOLID tiles are 2, 4, 5, 6.

GAME.world.player = { gx, gy, px, py, dir, moving, tweenStart,
                      fromX, fromY, toX, toY, steps }   // px/py are pixels, 32 px per tile
GAME.drawCreature(canvas, palette, facingRight, bobY, lungeX)
// draws a procedural creature into an existing canvas using the species palette.
// Sized for a 120x100 canvas; it clears the canvas itself.
```

`GAME.drawCreature` is being exposed from `battle.js`. Still guard for it being undefined:
if it is missing, fill the card with `palette[0]` and a "?" instead of crashing.

## Screen 1: `GAME.ui.Pokedex()` (the Bestiary)

- Title row: "Bestiary", and a live count: `Seen 4/12` and `Caught 2/12`, computed from
  `GAME.species.length` and `GAME.state.dex`.
- Progress bar under the title: caught/total as a percentage, 8px tall.
- Grid of all 12 species, responsive: `display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px`.
- Each card: a 120x100 canvas sprite, the name, a type badge, and the state.
  - **Caught**: normal sprite, name, type badge, green "CAUGHT" label, 2px green border.
  - **Seen but not caught**: normal sprite, name, type badge, amber "SEEN" label.
  - **Never seen**: the sprite drawn but darkened to a near-black silhouette, name shown
    as `???`, no type badge, grey "UNKNOWN" label.
  - Silhouette recipe: draw the creature, then fill the canvas with
    `rgba(8,10,16,0.86)` using `globalCompositeOperation = "source-atop"`, then reset the
    composite op to `"source-over"`.
- Clicking a card that has been seen opens a detail strip **below** the grid (do not
  replace the grid, do not navigate away): name, type, base stats HP/ATK/DEF/SPD as
  small bars scaled to a max of 100, catch rate, and its move list as
  `name (power, type, pp)`. Clicking an unseen card does nothing.
- Only one detail strip at a time. The selected card gets a highlighted border.

## Screen 2: `GAME.ui.Guide()`

A readable "Adventure Guide" in the same content area, scrollable, with a heading and
these sections as short bullet lists, written from the facts above and the existing
mechanics (no invented features):

1. **Getting around** legs of the map, arrow keys / WASD, 120 ms tile tween, solid tiles.
2. **Tall grass** 12% encounter chance per step, higher-level species away from town.
3. **Battles** the four moves on keys `1`-`4`, PP, the type chart
   (Fire beats Grass, Water beats Fire, Grass beats Water, Electric beats Water).
4. **Catching** orbs, lower HP and higher catch rate make it easier, party cap of 6.
5. **Menus** `P` party, `B` bag, `Escape` pause menu, this Bestiary, saving.
6. **Saving** three slots, what is stored (party, bestiary, bag, gold, position).

Do not use more than 6 sections, keep every bullet under ~110 characters, no emoji.

## Screen 3: `GAME.ui.Save()`

Three save slots in `localStorage`, keys `aetheris.save.1`, `aetheris.save.2`,
`aetheris.save.3`.

Payload:

```js
{ version: 1, savedAt: <ms epoch>, playerName: "...", partySize: n, caught: n,
  seen: n, gold: n, slotLabel: "...",
  state: <deep copy of GAME.state>, position: { gx, gy, dir } }
```

- Each slot row shows: slot number, then either `Empty` or a summary
  (`playerName · party 3/6 · bestiary 5/12 · 240 gold · <relative time like "2h ago">`),
  plus three small buttons: **Save**, **Load**, **Delete**.
- Delete needs a two-step confirm inside the row (first click turns the button into
  "Sure?" for 3 seconds, second click deletes). No `window.confirm`.
- Load rules: refuse while `document.getElementById("battle-overlay")` is visible (not
  `.hidden`), and say so in the status line. Validate `payload.version === 1` and that
  `payload.state` and `payload.position` exist. On any problem show a red status message
  and change nothing.
- On a successful load: replace `GAME.state.party`, `.dex`, `.inventory`, `.gold`,
  `.playerName` with deep copies from the save (keep `GAME.state.battle` alone), then
  move the player to the saved tile, but **only if that tile is walkable**: reject tile
  codes 2, 4, 5, 6 and out-of-bounds, falling back to `GAME.map.spawn`. Set
  `player.gx/gy`, `player.px = gx * 32`, `player.py = gy * 32`, `player.moving = false`,
  `player.dir = saved dir or 0`, and clear the tween fields. Then call
  `GAME.world.updateHUD()` if it exists, and re-render this screen so the summaries
  update.
- Deep copy without `JSON.parse(JSON.stringify(...))` tricks that drop `undefined`? Use
  `JSON.parse(JSON.stringify(x))`, it is fine here and ES5-safe, but guard it.
- Status line at the bottom, `#menu-status` if it exists, otherwise your own div:
  green for success, red for a refused action.

## Style guidance

Dark pixel UI: backgrounds around `#11151f` / `#1a2130`, text `#e8eef7`, accent `#6ad1ff`,
warn `#ffca3a`, danger `#ff595e`, success `#52b788`. Borders 1px `#2a3446`. Keep radii at
4px. Font: inherit the page font, do not import one.

## Output format (strict)

- Exactly **one** fenced code block with the entire file.
- The line immediately before the fence is exactly:

```
FILE: js/dex.js
```

- Nothing outside the fence: no explanation, no changelog, no TODOs, no elisions.
- The file must load as-is with zero page errors and must survive the menu being opened
  before any creature has been seen.
