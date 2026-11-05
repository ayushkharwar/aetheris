You are a senior front-end game engineer. Write ONE NEW file for a finished browser
game. The rest of the project is attached for reference; do not rewrite any of it.

# 1. Context

`Aetheris: Creature Chronicles`: vanilla HTML/CSS/JS, Canvas 2D, **ES5 only**, no
libraries, no external assets. The pause menu has four tabs:
`#tab-party`, `#tab-inventory`, `#tab-dex`, `#tab-system`.

`world.js` already dispatches them like this:

```js
function callUI(name) {
  if (G.ui && typeof G.ui[name] === "function") G.ui[name]();
  else console.log("GAME.ui." + name + "() – not yet implemented");
}
$("tab-party").addEventListener("click",     function () { callUI("Party"); });
$("tab-inventory").addEventListener("click", function () { callUI("Inventory"); });
$("tab-dex").addEventListener("click",       function () { callUI("Pokedex"); });
$("tab-system").addEventListener("click",    function () { callUI("System"); });
```

`js/dex.js` already implements `GAME.ui.Pokedex`, `GAME.ui.Guide`, `GAME.ui.Save`
(Bestiary, Adventure Guide, Save slots). Your file must add the other three and must not
touch, replace or duplicate `Pokedex`, `Guide` or `Save`.

# 2. Data you can rely on

```js
GAME.state.party = [{ speciesId, level, hp, maxHp, moves: [{name, power, type, pp, maxPp}], xp }]
GAME.state.inventory = { balls: 5, potions: 2 }
GAME.state.gold = 100
GAME.state.playerName = "Ash"
GAME.species = [{ id, name, type, baseHp, baseAtk, baseDef, baseSpd, catchRate, moves, palette }]
GAME.map = { name: "Verdant Hollow", w, h, spawn }
GAME.REGION = "Verdant Hollow"
GAME.world = { player: { gx, gy, px, py, dir, steps }, showDialog, updateHUD, started }
GAME.xpToNext(level)            // exists in battle.js; XP needed for the next level
GAME.drawCreature(canvas, palette, facingRight, bobY, lungeX)   // 120x100 canvas
localStorage keys "aetheris.save.1" .. "aetheris.save.3"        // written by js/dex.js
```

Guard every one of these for absence: the file must render without throwing even if
`GAME.state.party` is empty, `GAME.drawCreature` is missing, or `localStorage` throws.
If `GAME.xpToNext` is absent, fall back to `15 * level + 25`.

# 3. `GAME.ui.Party()`

Render into `<div id="menu-content">` (clear it first; build into a detached element and
append once at the end).

- Title row: `CREATURES`, then `Party 3/6`.
- One row per party member, in party order, the first row marked `LEAD` with a highlight
  border:
  - a 80x66 canvas sprite drawn with `GAME.drawCreature` using the species palette (if
    the function is missing, draw a filled rounded rect in `palette[0]` with a `?`),
  - name, `Lv<level>`, and a type badge pill (inline styles; Fire `#ff595e`,
    Water `#1982c4`, Grass `#52b788`, Normal `#9aa3b2`, Electric `#ffd166`),
  - HP bar, 8px tall, width `hp/maxHp`, coloured `#52b788` above 50%, `#ffca3a` above
    20%, `#ff595e` at or below 20%, plus text `hp/max`,
  - XP bar, 4px tall, width `xp / xpToNext(level)`, `#6ad1ff`, plus text `XP n/need`,
  - buttons: `LEAD` (hidden when already lead, disabled with a tooltip-ish label
    `FAINTED` when `hp === 0`), `POTION`, `INSPECT`.
- `LEAD` moves that member to index 0 of `GAME.state.party` and re-renders; then call
  `GAME.world.updateHUD()` if it exists.
- `POTION` uses the same rules as the battle bag: refuse when `inventory.potions <= 0`
  or `hp >= maxHp`, otherwise `potions--` and `hp = min(maxHp, hp + 20)`, then re-render
  and call `updateHUD`. Report the result in the status line described below.
- `INSPECT` toggles a detail panel **below the list** (do not replace the list) showing
  that member's moves as `name (power, type, pp/maxPp)` and its base stats
  HP/ATK/DEF/SPD from `GAME.species[speciesId]` as small bars scaled to 100. Only one
  detail panel open at a time.
- Empty party: a single line `No creatures yet.`

# 4. `GAME.ui.Inventory()`

- Title row: `INVENTORY`, then gold as `G<n>`.
- Two item cards side by side:
  - **Catching Orb**, count from `inventory.balls`, description
    `Thrown in battle to catch a creature`. A disabled button labelled
    `BATTLE ONLY` because balls cannot be used from this menu.
  - **Potion**, count from `inventory.potions`, description `Restores 20 HP to a
    creature`. Button `USE ON LEAD`.
- `USE ON LEAD`: heal the **first damaged** member (`hp < maxHp`); if none is damaged,
  refuse with `Nobody needs healing.`; if `potions <= 0`, refuse with `No potions left.`
  Otherwise `potions--`, `hp = min(maxHp, hp + 20)`, re-render, `updateHUD()`.
- A footer line: `No other items yet.`

# 5. `GAME.ui.System()`

- Title row: `SYSTEM`.
- A definition list of read-only facts: `Region` (`GAME.REGION` or `GAME.map.name`),
  `Trainer` (`GAME.state.playerName`), `Gold`, `Party` (`n/6`), `Bestiary`
  (`seen/12 seen, caught/12 caught`), `Steps` (`GAME.world.player.steps` if present),
  `Save slots` (`k of 3 used`, counting which of `aetheris.save.1..3` parse in a
  try/catch).
- A `CONTROLS` block: `WASD / Arrows  walk`, `1-4  battle moves`, `B  bag`,
  `P  party`, `Esc  pause menu`.
- No destructive buttons anywhere. No writes to `localStorage`.

# 6. Status line (all three screens)

Every action that can be refused or succeed writes one line at the bottom: use
`#menu-status` if that element exists, otherwise your own div. Success text `#52b788`,
refusal text `#ff995e`, and it must not shift the layout above it.

# 7. Hard constraints

- **ES5 only**: `var`, `function`, no arrow functions, no template literals, no
  `const`/`let`, no `class`, no `Array.prototype.forEach` on DOM collections (plain
  `for` loops), no `Object.assign`.
- Wrap in `(function (G) { "use strict"; ... })(window.GAME);`, return early if
  `window.GAME` is missing, and create `G.ui = G.ui || {}` without clobbering existing
  members.
- No new globals beyond `GAME.ui.Party`, `GAME.ui.Inventory`, `GAME.ui.System`.
- Do not modify `index.html`, `style.css`, `js/dex.js`, `js/battle.js`, `js/world.js`, or
  `js/data.js`. Inline styles only. Reuse existing classes `btn`, `btn-small`,
  `hud-text`, `menu-title` where they fit.
- No `Math.random`, no timers, no network, no emoji.

# 8. Acceptance checklist: verify each line against your own code before answering

- [ ] All three tabs render content and never leave the menu blank.
- [ ] LEAD reorders the party, the first row gets the highlight, HUD updates.
- [ ] POTION/`USE ON LEAD` heals exactly 20, clamps at maxHp, decrements the count, and
      refuses correctly at full HP and at zero potions.
- [ ] INSPECT shows the right moves and base stats for the chosen member and only one
      panel is open at a time.
- [ ] Inventory shows live counts and gold; the ball button is disabled.
- [ ] System shows real values including save-slot usage, and writes nothing.
- [ ] Empty party, empty inventory and missing `GAME.drawCreature` all render without
      throwing.
- [ ] Zero ES6, zero globals beyond the three, no other file touched.

# 9. Output format (strict)

- Exactly **one** fenced code block with the entire file.
- The line immediately before the fence must be exactly:

```
FILE: js/panels.js
```

- Nothing outside the fence: no explanation, no changelog, no ellipses, no TODOs.
- If and only if you had to skip a checklist line, add one line after the closing fence
  starting with `NOTE:`. Maximum one line.
