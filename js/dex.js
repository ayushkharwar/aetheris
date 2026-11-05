/**
 * js/dex.js – Pause-menu screens for Aetheris: Creature Chronicles
 * Exposes GAME.ui.Pokedex, GAME.ui.Guide, GAME.ui.Save.
 * ES5 only, no external assets, no network.
 */
(function (G) {
  "use strict";
  if (!G) return;

  G.ui = G.ui || {};

  /* ── Shared helpers ─────────────────────────────────────────────── */
  function mk(tag) {
    return document.createElement(tag);
  }

  function style(node, css) {
    node.style.cssText = css;
    return node;
  }

  function deepCopy(x) {
    try {
      return JSON.parse(JSON.stringify(x));
    } catch (e) {
      return null;
    }
  }

  function lsGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function lsSet(key, val) {
    try {
      window.localStorage.setItem(key, val);
      return true;
    } catch (e) {
      return false;
    }
  }

  function lsDel(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  function relTime(ms) {
    if (typeof ms !== "number" || !isFinite(ms)) return "unknown";
    var diff = Date.now() - ms;
    if (diff < 0) diff = 0;
    var sec = Math.floor(diff / 1000);
    if (sec < 60) return sec + "s ago";
    var min = Math.floor(sec / 60);
    if (min < 60) return min + "m ago";
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + "h ago";
    var days = Math.floor(hr / 24);
    return days + "d ago";
  }

  function speciesTotal() {
    return (G.species && G.species.length) || 12;
  }

  function dexCounts() {
    var sp = G.species || [];
    var dex = (G.state && G.state.dex) || {};
    var seen = dex.seen || {};
    var caught = dex.caught || {};
    var seenN = 0, caughtN = 0, i, id;
    for (i = 0; i < sp.length; i++) {
      id = sp[i].id;
      if (caught[id]) caughtN++;
      if (caught[id] || seen[id]) seenN++;
    }
    return { seen: seenN, caught: caughtN, total: sp.length };
  }

  function isWalkable(gx, gy) {
    if (!G.map || !G.map.tiles) return false;
    var w = G.map.w, h = G.map.h;
    if (typeof gx !== "number" || typeof gy !== "number") return false;
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return false;
    var t = G.map.tiles[gy * w + gx];
    if (t === 2 || t === 4 || t === 5 || t === 6) return false;
    return true;
  }

  function drawSilhouetteOrSprite(cvs, sp, unseen) {
    cvs.width = 120;
    cvs.height = 100;
    cvs.style.cssText = "image-rendering:pixelated;display:block;";
    var ctx = null;
    try {
      if (typeof G.drawCreature === "function" && sp && sp.palette) {
        G.drawCreature(cvs, sp.palette, true, 0, 0);
        if (unseen) {
          ctx = cvs.getContext("2d");
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = "rgba(8,10,16,0.86)";
          ctx.fillRect(0, 0, 120, 100);
          ctx.globalCompositeOperation = "source-over";
        }
        return;
      }
    } catch (e) {
      /* fall through to placeholder */
    }
    ctx = cvs.getContext("2d");
    ctx.fillStyle = (sp && sp.palette && sp.palette[0]) || "#2a3446";
    ctx.fillRect(0, 0, 120, 100);
    ctx.fillStyle = "#e8eef7";
    ctx.font = "bold 42px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 60, 52);
  }

  function statBar(label, value, color) {
    var row = style(mk("div"),
      "display:flex;align-items:center;gap:8px;margin:3px 0;font-size:12px;color:#e8eef7;");
    var l = style(mk("span"), "width:34px;color:#9aa5b1;");
    l.textContent = label;
    row.appendChild(l);
    var wrap = style(mk("div"),
      "flex:1;height:6px;background:#1a2130;border:1px solid #2a3446;border-radius:3px;overflow:hidden;");
    var fill = style(mk("div"),
      "height:100%;width:" + Math.min(100, Math.max(0, value)) + "%;background:" + color + ";");
    wrap.appendChild(fill);
    row.appendChild(wrap);
    var v = style(mk("span"), "width:28px;text-align:right;color:#e8eef7;");
    v.textContent = String(value);
    row.appendChild(v);
    return row;
  }

  /* ── Screen 1: Pokedex / Bestiary ──────────────────────────────── */
  G.ui.Pokedex = function () {
    var content = document.getElementById("menu-content");
    if (!content) return;
    content.innerHTML = "";

    var root = style(mk("div"),
      "grid-column:1 / -1;display:flex;flex-direction:column;gap:10px;color:#e8eef7;");

    var species = G.species || [];
    var dex = (G.state && G.state.dex) || {};
    var seenMap = dex.seen || {};
    var caughtMap = dex.caught || {};
    var counts = dexCounts();

    /* Title row */
    var titleRow = style(mk("div"),
      "display:flex;justify-content:space-between;align-items:center;gap:10px;");
    var title = mk("h2");
    title.className = "menu-title";
    title.textContent = "Bestiary";
    titleRow.appendChild(title);
    var countsEl = style(mk("span"), "font-size:13px;color:#e8eef7;");
    countsEl.textContent =
      "Seen " + counts.seen + "/" + counts.total +
      "   Caught " + counts.caught + "/" + counts.total;
    titleRow.appendChild(countsEl);
    root.appendChild(titleRow);

    /* Progress bar */
    var progWrap = style(mk("div"),
      "height:8px;background:#1a2130;border:1px solid #2a3446;border-radius:4px;overflow:hidden;");
    var pct = counts.total ? (counts.caught / counts.total) * 100 : 0;
    var progFill = style(mk("div"),
      "height:100%;width:" + pct + "%;background:#52b788;");
    progWrap.appendChild(progFill);
    root.appendChild(progWrap);

    /* Grid */
    var grid = style(mk("div"),
      "display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;");
    root.appendChild(grid);

    /* Detail strip */
    var detail = style(mk("div"),
      "display:none;background:#11151f;border:1px solid #2a3446;border-radius:4px;" +
      "padding:12px;color:#e8eef7;");
    root.appendChild(detail);

    var selectedCard = null;

    function showDetail(sp) {
      detail.style.display = "block";
      while (detail.firstChild) detail.removeChild(detail.firstChild);

      var head = style(mk("div"),
        "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;");
      var name = style(mk("span"),
        "font-size:16px;font-weight:bold;color:#6ad1ff;text-transform:uppercase;");
      name.textContent = sp.name || "?";
      head.appendChild(name);
      var tb = style(mk("span"),
        "padding:2px 8px;border-radius:4px;font-size:12px;background:#2a3446;color:#e8eef7;");
      tb.textContent = sp.type || "?";
      head.appendChild(tb);
      detail.appendChild(head);

      detail.appendChild(statBar("HP", sp.baseHp || 0, "#52b788"));
      detail.appendChild(statBar("ATK", sp.baseAtk || 0, "#ff595e"));
      detail.appendChild(statBar("DEF", sp.baseDef || 0, "#6ad1ff"));
      detail.appendChild(statBar("SPD", sp.baseSpd || 0, "#ffca3a"));

      var cr = style(mk("div"),
        "margin-top:8px;font-size:12px;color:#9aa5b1;");
      cr.textContent = "Catch rate: " + (typeof sp.catchRate === "number" ? sp.catchRate : "?");
      detail.appendChild(cr);

      var mh = style(mk("div"),
        "margin-top:8px;font-size:12px;font-weight:bold;color:#ffca3a;letter-spacing:0.5px;");
      mh.textContent = "MOVES";
      detail.appendChild(mh);

      var moves = sp.moves || [];
      if (!moves.length) {
        var none = style(mk("div"), "font-size:12px;color:#9aa5b1;");
        none.textContent = "(no moves)";
        detail.appendChild(none);
      } else {
        var i;
        for (i = 0; i < moves.length; i++) {
          var m = moves[i];
          var row = style(mk("div"),
            "font-size:12px;color:#e8eef7;padding:2px 0;");
          row.textContent = m.name + " (" + m.power + ", " + m.type + ", " + m.pp + ")";
          detail.appendChild(row);
        }
      }
    }

    var i;
    for (i = 0; i < species.length; i++) {
      (function (sp) {
        var id = sp.id;
        var isCaught = !!caughtMap[id];
        var isSeen = isCaught || !!seenMap[id];

        var card = style(mk("div"),
          "background:#1a2130;border:1px solid #2a3446;border-radius:4px;" +
          "padding:8px;display:flex;flex-direction:column;align-items:center;gap:4px;" +
          "cursor:" + (isSeen ? "pointer" : "default") + ";");
        if (isCaught) {
          card.style.border = "2px solid #52b788";
        }

        var cvs = mk("canvas");
        drawSilhouetteOrSprite(cvs, sp, !isSeen);
        card.appendChild(cvs);

        var nameEl = style(mk("div"),
          "font-size:13px;font-weight:bold;color:#e8eef7;text-transform:uppercase;");
        nameEl.textContent = isSeen ? sp.name : "???";
        card.appendChild(nameEl);

        if (isSeen) {
          var typeEl = style(mk("div"),
            "font-size:11px;padding:1px 6px;border-radius:4px;background:#2a3446;color:#e8eef7;");
          typeEl.textContent = sp.type || "?";
          card.appendChild(typeEl);
        }

        var stateEl = style(mk("div"), "font-size:11px;font-weight:bold;letter-spacing:0.5px;");
        if (isCaught) {
          stateEl.textContent = "CAUGHT";
          stateEl.style.color = "#52b788";
        } else if (isSeen) {
          stateEl.textContent = "SEEN";
          stateEl.style.color = "#ffca3a";
        } else {
          stateEl.textContent = "UNKNOWN";
          stateEl.style.color = "#9aa5b1";
        }
        card.appendChild(stateEl);

        if (isSeen) {
          card.addEventListener("click", function () {
            if (selectedCard && selectedCard !== card) {
              selectedCard.style.boxShadow = "";
            }
            card.style.boxShadow = "0 0 0 2px #6ad1ff";
            selectedCard = card;
            showDetail(sp);
          });
        }

        grid.appendChild(card);
      })(species[i]);
    }

    content.appendChild(root);
  };

  /* ── Screen 2: Adventure Guide ────────────────────────────────── */
  G.ui.Guide = function () {
    var content = document.getElementById("menu-content");
    if (!content) return;
    content.innerHTML = "";

    var root = style(mk("div"),
      "grid-column:1 / -1;display:flex;flex-direction:column;gap:14px;color:#e8eef7;");

    var h = mk("h2");
    h.className = "menu-title";
    h.textContent = "Adventure Guide";
    root.appendChild(h);

    function section(title, bullets) {
      var s = style(mk("div"), "display:flex;flex-direction:column;gap:4px;");
      var hh = style(mk("h3"),
        "font-size:14px;color:#6ad1ff;letter-spacing:0.5px;margin:0;");
      hh.textContent = title;
      s.appendChild(hh);
      var ul = style(mk("ul"),
        "list-style:none;padding:0;margin:0;font-size:12px;line-height:1.6;color:#e8eef7;");
      var j;
      for (j = 0; j < bullets.length; j++) {
        var li = style(mk("li"), "padding:2px 0 2px 14px;");
        li.textContent = "\u2022 " + bullets[j];
        ul.appendChild(li);
      }
      s.appendChild(ul);
      root.appendChild(s);
    }

    section("1. Getting around", [
      "Move with the arrow keys or WASD.",
      "Each step tweens over 120 ms to the next tile.",
      "Water, trees and buildings are solid; grass and paths are walkable.",
      "Paths link the town to the river bridge and the outer wilds."
    ]);

    section("2. Tall grass", [
      "Stepping into tall grass has a 12% chance of an encounter.",
      "All twelve species can appear in the wild.",
      "Leave tall grass to move without triggering wild creatures."
    ]);

    section("3. Battles", [
      "Pick your four moves with number keys 1 through 4.",
      "Every move has PP; a move at 0 PP cannot be used.",
      "Fire beats Grass, Water beats Fire, Grass beats Water.",
      "Electric beats Water and is resisted by Grass and Electric."
    ]);

    section("4. Catching", [
      "Throw an orb from the Bag to catch a wild creature.",
      "Lower wild HP and a higher catch rate both improve odds.",
      "Your party holds up to six creatures; new catches fill empty slots."
    ]);

    section("5. Menus", [
      "P opens the party, B the bag, Escape opens the pause menu.",
      "The pause menu holds Bestiary, Guide and Save tabs.",
      "Bestiary shows every species you have seen or caught."
    ]);

    section("6. Saving", [
      "Three slots are stored in your browser via localStorage.",
      "Each save holds party, bestiary, bag, gold and your position.",
      "Loading is refused while a battle is on screen."
    ]);

    content.appendChild(root);
  };

  /* ── Screen 3: Save / Load ────────────────────────────────────── */
  G.ui.Save = function () {
    var content = document.getElementById("menu-content");
    if (!content) return;
    content.innerHTML = "";

    var root = style(mk("div"),
      "grid-column:1 / -1;display:flex;flex-direction:column;gap:10px;color:#e8eef7;");

    var titleRow = style(mk("div"),
      "display:flex;justify-content:space-between;align-items:center;gap:10px;");
    var title = mk("h2");
    title.className = "menu-title";
    title.textContent = "Save Slots";
    titleRow.appendChild(title);
    root.appendChild(titleRow);

    var slotsContainer = style(mk("div"),
      "display:flex;flex-direction:column;gap:8px;");
    root.appendChild(slotsContainer);

    var ownStatus = null;

    function setStatus(msg, ok) {
      var color = ok ? "#52b788" : "#ff595e";
      var ms = document.getElementById("menu-status");
      if (ms) {
        ms.textContent = msg;
        ms.style.color = color;
        return;
      }
      if (!ownStatus) {
        ownStatus = style(mk("div"),
          "font-size:12px;padding:6px 0;min-height:18px;");
        root.appendChild(ownStatus);
      }
      ownStatus.textContent = msg;
      ownStatus.style.color = color;
    }

    function mkBtn(label, color, onClick) {
      var b = mk("button");
      b.type = "button";
      b.className = "btn btn-small";
      b.textContent = label;
      b.style.cssText =
        "font-family:inherit;font-size:11px;font-weight:bold;padding:4px 10px;" +
        "border-radius:4px;cursor:pointer;background:#11151f;color:" + color +
        ";border:1px solid " + color + ";text-transform:uppercase;letter-spacing:0.5px;";
      b.addEventListener("click", onClick);
      return b;
    }

    function readPayload(slot) {
      var raw = lsGet("aetheris.save." + slot);
      if (!raw) return null;
      try {
        var p = JSON.parse(raw);
        if (!p || p.version !== 1) return null;
        return p;
      } catch (e) {
        return null;
      }
    }

    function copyStateForSave() {
      if (!G.state) return null;
      var full = deepCopy(G.state);
      if (full) return full;
      var partial = {};
      var keys = ["party", "dex", "inventory", "gold", "playerName"];
      var i;
      for (i = 0; i < keys.length; i++) {
        if (G.state[keys[i]] !== undefined) {
          partial[keys[i]] = G.state[keys[i]];
        }
      }
      return deepCopy(partial);
    }

    function doSave(slot) {
      if (!G.state) {
        setStatus("No game state to save.", false);
        return;
      }
      var st = copyStateForSave();
      if (!st) {
        setStatus("Could not copy game state.", false);
        return;
      }

      var caughtMap = (st.dex && st.dex.caught) || {};
      var seenMap = (st.dex && st.dex.seen) || {};
      var caughtN = 0, seenN = 0;
      var sp = G.species || [];
      var ids = {};
      var i, k;
      for (i = 0; i < sp.length; i++) ids[sp[i].id] = true;
      for (k in caughtMap) {
        if (Object.prototype.hasOwnProperty.call(caughtMap, k) && caughtMap[k] && ids[k]) caughtN++;
      }
      for (k in seenMap) {
        if (Object.prototype.hasOwnProperty.call(seenMap, k) && seenMap[k] && ids[k]) seenN++;
      }
      if (caughtN > seenN) seenN = caughtN;

      var pos = { gx: 0, gy: 0, dir: 0 };
      if (G.world && G.world.player) {
        pos.gx = G.world.player.gx;
        pos.gy = G.world.player.gy;
        pos.dir = G.world.player.dir || 0;
      } else if (G.map && G.map.spawn) {
        pos.gx = G.map.spawn.x;
        pos.gy = G.map.spawn.y;
      }

      var payload = {
        version: 1,
        savedAt: Date.now(),
        playerName: st.playerName || "Ash",
        partySize: (st.party && st.party.length) || 0,
        caught: caughtN,
        seen: seenN,
        gold: typeof st.gold === "number" ? st.gold : 0,
        slotLabel: "Slot " + slot,
        state: st,
        position: pos
      };

      var wrote = lsSet("aetheris.save." + slot, JSON.stringify(payload));
      if (!wrote) {
        setStatus("Could not write to storage.", false);
        return;
      }
      setStatus("Saved to slot " + slot + ".", true);
      renderSlots();
    }

    function doLoad(slot) {
      var bo = document.getElementById("battle-overlay");
      if (bo && !bo.classList.contains("hidden")) {
        setStatus("Cannot load during a battle.", false);
        return;
      }

      var payload = readPayload(slot);
      if (!payload) {
        setStatus("Slot " + slot + " is empty or invalid.", false);
        return;
      }
      if (payload.version !== 1 || !payload.state || !payload.position) {
        setStatus("Invalid save data.", false);
        return;
      }

      var stateCopy = deepCopy(payload.state);
      var posCopy = deepCopy(payload.position);
      if (!stateCopy || !posCopy) {
        setStatus("Corrupt save data.", false);
        return;
      }

      if (!G.state) G.state = {};
      G.state.party = Array.isArray(stateCopy.party) ? stateCopy.party : [];
      G.state.dex = (stateCopy.dex && typeof stateCopy.dex === "object")
        ? stateCopy.dex
        : { seen: {}, caught: {} };
      G.state.inventory = (stateCopy.inventory && typeof stateCopy.inventory === "object")
        ? stateCopy.inventory
        : { balls: 0, potions: 0 };
      G.state.gold = typeof stateCopy.gold === "number" ? stateCopy.gold : 0;
      G.state.playerName = stateCopy.playerName || "Ash";
      G.party = G.state.party;

      var gx = posCopy.gx;
      var gy = posCopy.gy;
      var dir = typeof posCopy.dir === "number" ? posCopy.dir : 0;

      if (!isWalkable(gx, gy)) {
        if (G.map && G.map.spawn) {
          gx = G.map.spawn.x;
          gy = G.map.spawn.y;
        } else {
          gx = 0;
          gy = 0;
        }
        dir = 0;
      }

      if (G.world && G.world.player) {
        var p = G.world.player;
        p.gx = gx;
        p.gy = gy;
        p.px = gx * 32;
        p.py = gy * 32;
        p.moving = false;
        p.dir = dir;
        p.fromX = p.px;
        p.fromY = p.py;
        p.toX = p.px;
        p.toY = p.py;
        p.tweenStart = 0;
      }

      if (G.world && typeof G.world.updateHUD === "function") {
        try { G.world.updateHUD(); } catch (e) { /* ignore */ }
      }

      setStatus("Loaded slot " + slot + ".", true);
      renderSlots();
    }

    function handleDelete(slot, btn) {
      if (btn.getAttribute("data-confirm") === "1") {
        lsDel("aetheris.save." + slot);
        setStatus("Slot " + slot + " deleted.", true);
        renderSlots();
        return;
      }
      btn.setAttribute("data-confirm", "1");
      btn.textContent = "Sure?";
      window.setTimeout(function () {
        if (!btn.parentNode) return;
        if (btn.getAttribute("data-confirm") === "1") {
          btn.setAttribute("data-confirm", "0");
          btn.textContent = "Delete";
        }
      }, 3000);
    }

    function renderSlots() {
      while (slotsContainer.firstChild) slotsContainer.removeChild(slotsContainer.firstChild);

      var total = speciesTotal();
      var slot;
      for (slot = 1; slot <= 3; slot++) {
        (function (n) {
          var row = style(mk("div"),
            "display:flex;align-items:center;gap:10px;padding:10px;" +
            "background:#1a2130;border:1px solid #2a3446;border-radius:4px;");

          var label = style(mk("div"),
            "font-weight:bold;min-width:56px;font-size:13px;color:#e8eef7;");
          label.textContent = "Slot " + n;
          row.appendChild(label);

          var payload = readPayload(n);
          var info = style(mk("div"),
            "flex:1;font-size:12px;color:#9aa5b1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;");

          if (payload) {
            info.textContent =
              (payload.playerName || "Ash") +
              " \u00b7 party " + (payload.partySize || 0) + "/6" +
              " \u00b7 bestiary " + (payload.caught || 0) + "/" + total +
              " \u00b7 " + (payload.gold || 0) + " gold" +
              " \u00b7 " + relTime(payload.savedAt);
          } else {
            info.textContent = "Empty";
            info.style.color = "#6b7688";
          }
          row.appendChild(info);

          var saveBtn = mkBtn("Save", "#52b788", function () { doSave(n); });
          row.appendChild(saveBtn);

          var loadBtn = mkBtn("Load", "#6ad1ff", function () { doLoad(n); });
          if (!payload) {
            loadBtn.disabled = true;
            loadBtn.style.opacity = "0.4";
            loadBtn.style.cursor = "default";
          }
          row.appendChild(loadBtn);

          var delBtn = mkBtn("Delete", "#ff595e", function () { handleDelete(n, delBtn); });
          delBtn.setAttribute("data-confirm", "0");
          if (!payload) {
            delBtn.disabled = true;
            delBtn.style.opacity = "0.4";
            delBtn.style.cursor = "default";
          }
          row.appendChild(delBtn);

          slotsContainer.appendChild(row);
        })(slot);
      }
    }

    renderSlots();
    content.appendChild(root);
    setStatus("Select a slot.", true);
  };
})(window.GAME);
