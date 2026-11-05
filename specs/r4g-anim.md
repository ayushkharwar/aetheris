You are a senior gameplay-animation engineer. Rewrite ONE file of a working ES5 browser
game: `js/battle.js`, attached. Do not change any other file.

# 1. What already works (keep every bit of it)

Backdrop (sky, horizon glow, ground, shadow pools), entrance slide-in with
`requestAnimationFrame`, platform discs, type badges, creature outline/shading, hit flash
via `flashW`/`flashP`, XP bar, level-up maths, `GAME.state.battle` live state,
`G.drawCreature` export, PP, catch, run, faint/switch, turn order.

The current motion is the weak part: `pBob`/`wBob`/`pLunge`/`wLunge` are simple linear
offsets applied in `animLoop`, so attacks look like a sprite sliding and stopping, and a
hit has no impact beyond a white flash.

# 2. Make the fight feel alive

Implement all of the following. Everything must be ES5 and must not introduce a second
animation loop; drive time-based effects from the existing `animLoop(now)` using
timestamps, and use `setTimeout` only for DOM element cleanup.

## 2.1 Lunge with anticipation and follow-through

Replace the linear lunge with a keyframed curve driven by a start timestamp:
`lungeStart` and `lungeWho` (`"player"` or `"wild"`), duration 300ms.

- 0-60ms: pull back to `-8px` on the attacker's axis (anticipation),
- 60-170ms: drive forward to `+34px` (impact at about 165ms),
- 170-300ms: ease back to `0`.
- Use `Math.sin`-free, piecewise-linear interpolation with easing on the return leg
  (`t*t`), so the return decelerates. The defender's damage and the impact effects fire at
  the impact moment, not at the start of the lunge.

## 2.2 Impact: flinch, shake, flash, damage number

At impact:

- **Flinch**: the defender's sprite gets a horizontal shake of `+3, -3, +2, -1` pixels
  over 130ms (a decaying oscillation driven by a timestamp in `animLoop`, not a CSS
  animation), then returns to 0.
- **Screen shake**: the `.btl-scene` element gets `transform: translate(x, y)` with
  `x` alternating `-3, 3, -2, 2, 0` and `y` `1, -1, 1, 0` over 140ms, then cleared back to
  `""`.
- **Damage number**: spawn a `div` inside the defender's `.btl-side` element, absolutely
  positioned over the sprite (roughly `top:38%; left:50%`), text `"-" + damage`, font
  `bold 22px`, `text-shadow: 0 2px 0 rgba(0,0,0,0.6)`, `pointer-events:none`, and a class
  name `btl-dmg` so tests can find it. Colour: `#ffca3a` when effectiveness is 2.0,
  `#9aa3b2` when 0.5, `#f4f8ff` otherwise. Animate it with a CSS transition
  `transform 620ms ease-out, opacity 620ms ease-out` from `translateY(0)`/`opacity 1` to
  `translateY(-34px)`/`opacity 0` (set the initial values, force a reflow by reading
  `offsetHeight`, then set the final values). Remove it with `setTimeout(..., 700)`.
- Keep the existing white flash working.

## 2.3 Smooth bars

- Give `ui.pBar` and `ui.wBar` an inline `transition: width 220ms ease-out` at creation, so
  HP drains instead of snapping.

## 2.4 Move banner

- On each move execution, show a pill above the message box (or as the first line of the
  message area if a new element is risky) with the move name, background = the move's type
  colour (Fire `#ff595e`, Water `#1982c4`, Grass `#52b788`, Normal `#9aa3b2`,
  Electric `#ffd166`), dark text on light types, visible for 700ms, then fade out over
  200ms. Class name `btl-move-banner`.

## 2.5 Faint animation

- When a creature's HP reaches 0, animate its sprite: over 420ms, `translateY` down to
  `+18px` and `opacity` down to `0.15`. Use a CSS transition on the canvas element. The
  platform stays visible.
- On a new battle, `buildUI()` rebuilds the canvases, so no reset logic is needed; make
  sure the styles are set before the entrance animation runs so the two do not fight.

## 2.6 Catch wobble

- When a ball is thrown, before the catch result message: 3 wobbles of the wild sprite,
  each a rotate of `-7deg` then `+7deg` and back to `0`, 260ms per wobble, applied through
  a CSS transition on the wild canvas (`transform`), sequenced with `setTimeout`. The
  entrance translate must be finished by then; if it is not, skip the wobble instead of
  fighting the transform.
- Never leak the timeouts: a thrown ball that resolves must clear the chain, and nothing
  may still be animating once the overlay is hidden.

# 3. Hard constraints

- **ES5 only**: `var`, `function`, no arrow functions, no template literals, no
  `const`/`let`, no `class`. Zero ES6 today, keep it that way.
- No `setInterval` for new effects. No new globals outside the IIFE.
- Do not change gameplay numbers: damage formula, type chart, PP costs, catch rate
  formula, run chance, turn order, XP, level-up.
- `G.drawCreature` behaviour must stay exactly as today (`js/dex.js` depends on it).
- Inline styles only; do not touch `index.html`, `style.css`, `js/dex.js`,
  `js/panels.js`, or any other file.
- Reset `ctx.globalAlpha` and `ctx.globalCompositeOperation` after use.

# 4. Acceptance checklist: verify each line against your own code before answering

- [ ] A lunge pulls back, drives forward, and eases back; damage lands at the impact frame.
- [ ] The defender flinches and the scene shakes on impact.
- [ ] A `-N` damage number floats up, is coloured by effectiveness, and is removed.
- [ ] HP bars drain smoothly instead of jumping.
- [ ] The move banner shows the move name in its type colour and fades.
- [ ] A fainting creature drops and fades, platform intact.
- [ ] A thrown ball wobbles the wild sprite exactly 3 times before the result message.
- [ ] No dangling timers after the overlay hides; no page errors.
- [ ] Battle still plays to the end and a win still triggers XP and level-up.
- [ ] Zero ES6, no new globals, no other file touched.

# 5. Output format (strict)

- Exactly **one** fenced code block with the **entire** file.
- The line immediately before the fence must be exactly:

```
FILE: js/battle.js
```

- Nothing outside the fence: no explanation, no changelog, no ellipses, no TODOs.
- If and only if you had to skip a checklist line, add one line after the closing fence
  starting with `NOTE:`. Maximum one line.
