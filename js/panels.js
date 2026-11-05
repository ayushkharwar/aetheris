/**
 * js/panels.js – Party, Inventory and System pause-menu screens for
 * Aetheris: Creature Chronicles. ES5 only, no external assets.
 */
(function (G) {
  "use strict";
  if (!G) return;

  G.ui = G.ui || {};

  /* ── Tiny helpers ──────────────────────────────────────────── */
  function mk(tag) { return document.createElement(tag); }
  function style(n, css) { n.style.cssText = css; return n; }
  function num(v, d) { return (typeof v === "number" && isFinite(v)) ? v : d; }

  function getParty() {
    if (G.state && G.state.party) return G.state.party;
    return [];
  }
  function getInv() {
    if (G.state && G.state.inventory) return G.state.inventory;
    return { balls: 0, potions: 0 };
  }
  function getGold() {
    if (G.state && typeof G.state.gold === "number") return G.state.gold;
    return 0;
  }
  function findSpecies(id) {
    var sp = G.species || [];
    for (var i = 0; i < sp.length; i++) if (sp[i].id === id) return sp[i];
    return null;
  }
  function xpNeeded(level) {
    if (typeof G.xpToNext === "function") {
      try {
        var v = G.xpToNext(level);
        if (typeof v === "number" && isFinite(v) && v > 0) return v;
      } catch (e) { /* ignore */ }
    }
    return 15 * level + 25;
  }
  function updateHUD() {
    if (G.world && typeof G.world.updateHUD === "function") {
      try { G.world.updateHUD(); } catch (e) { /* ignore */ }
    }
  }

  function typeColor(t) {
    if (t === "Fire") return "#ff595e";
    if (t === "Water") return "#1982c4";
    if (t === "Grass") return "#52b788";
    if (t === "Electric") return "#ffd166";
    return "#9aa3b2";
  }
  function hpColor(r) {
    if (r > 0.5) return "#52b788";
    if (r > 0.2) return "#ffca3a";
    return "#ff595e";
  }

  function bar(v, max, height, color) {
    var wrap = style(mk("div"),
      "height:" + height + "px;background:#1a2130;border:1px solid #2a3446;" +
      "border-radius:2px;overflow:hidden;box-sizing:border-box;");
    var pct = max > 0 ? Math.min(100, Math.max(0, (v / max) * 100)) : 0;
    wrap.appendChild(style(mk("div"),
      "height:100%;width:" + pct + "%;background:" + color + ";"));
    return wrap;
  }

  function btn(label, color, onClick) {
    var b = mk("button");
    b.type = "button";
    b.className = "btn btn-small";
    b.textContent = label;
    b.style.cssText =
      "font-family:inherit;font-size:11px;font-weight:bold;padding:3px 8px;" +
      "border-radius:4px;cursor:pointer;background:#11151f;color:" + color +
      ";border:1px solid " + color + ";text-transform:uppercase;letter-spacing:0.5px;";
    b.addEventListener("click", onClick);
    return b;
  }

  function statBar(label, value, color) {
    var row = style(mk("div"),
      "display:flex;align-items:center;gap:8px;font-size:12px;color:#e8eef7;");
    var l = style(mk("span"), "width:34px;color:#9aa5b1;");
    l.textContent = label;
    row.appendChild(l);
    var wrap = style(mk("div"),
      "flex:1;height:6px;background:#1a2130;border:1px solid #2a3446;" +
      "border-radius:3px;overflow:hidden;box-sizing:border-box;");
    var pct = Math.min(100, Math.max(0, value));
    wrap.appendChild(style(mk("div"),
      "height:100%;width:" + pct + "%;background:" + color + ";"));
    row.appendChild(wrap);
    var v = style(mk("span"), "width:28px;text-align:right;color:#e8eef7;");
    v.textContent = String(value);
    row.appendChild(v);
    return row;
  }

  /* ── Status line ───────────────────────────────────────────── */
  var lastStatus = null;
  var fallbackStatus = null;

  function statusFooter(root) {
    if (document.getElementById("menu-status")) return;
    if (!fallbackStatus) fallbackStatus = mk("div");
    fallbackStatus.style.cssText = "font-size:12px;padding:4px 0;min-height:16px;";
    fallbackStatus.textContent = "";
    fallbackStatus.style.color = "";
    root.appendChild(fallbackStatus);
  }
  function applyStatus() {
    if (!lastStatus) return;
    var el = document.getElementById("menu-status") || fallbackStatus;
    if (!el) return;
    el.textContent = lastStatus.msg;
    el.style.color = lastStatus.ok ? "#52b788" : "#ff995e";
  }
  function setStatus(msg, ok) {
    lastStatus = { msg: msg, ok: !!ok };
    applyStatus();
  }
  function resetStatus() {
    lastStatus = null;
    var ms = document.getElementById("menu-status");
    if (ms) { ms.textContent = "Use WASD or Arrow Keys to move."; ms.style.color = ""; }
    if (fallbackStatus) { fallbackStatus.textContent = ""; fallbackStatus.style.color = ""; }
  }

  /* ── Sprite drawing ────────────────────────────────────────── */
  function drawSpriteInto(cvs, sp) {
    cvs.width = 80;
    cvs.height = 66;
    cvs.style.cssText = "width:80px;height:66px;image-rendering:pixelated;display:block;flex-shrink:0;";
    try {
      if (sp && sp.palette && typeof G.drawCreature === "function") {
        G.drawCreature(cvs, sp.palette, true, 0, 0);
        return;
      }
    } catch (e) { /* fall through */ }
    var ctx = cvs.getContext("2d");
    if (!ctx) return;
    var col = (sp && sp.palette && sp.palette[0]) || "#2a3446";
    ctx.fillStyle = col;
    var x = 4, y = 4, w = 72, h = 58, r = 8;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e8eef7";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 40, 34);
  }

  /* ── Detail panel (shared by Party INSPECT) ────────────────── */
  function detailPanel(m) {
    var sp = findSpecies(m.speciesId);
    var panel = style(mk("div"),
      "background:#11151f;border:1px solid #2a3446;border-radius:4px;" +
      "padding:10px;color:#e8eef7;display:flex;flex-direction:column;gap:4px;");

    var head = style(mk("div"),
      "font-size:13px;font-weight:bold;color:#6ad1ff;text-transform:uppercase;");
    head.textContent = (sp ? sp.name : "???") + " - Details";
    panel.appendChild(head);

    var mt = style(mk("div"),
      "font-size:11px;color:#ffca3a;font-weight:bold;letter-spacing:0.5px;margin-top:4px;");
    mt.textContent = "MOVES";
    panel.appendChild(mt);

    var moves = m.moves || [];
    if (!moves.length) {
      var none = style(mk("div"), "font-size:12px;color:#9aa5b1;");
      none.textContent = "(no moves)";
      panel.appendChild(none);
    } else {
      for (var i = 0; i < moves.length; i++) {
        var mv = moves[i] || {};
        var row = style(mk("div"), "font-size:12px;color:#e8eef7;");
        row.textContent = (mv.name || "?") + " (" + num(mv.power, 0) + ", " +
          (mv.type || "?") + ", " + num(mv.pp, 0) + "/" + num(mv.maxPp, 0) + ")";
        panel.appendChild(row);
      }
    }

    if (sp) {
      var st = style(mk("div"),
        "font-size:11px;color:#ffca3a;font-weight:bold;letter-spacing:0.5px;margin-top:4px;");
      st.textContent = "BASE STATS";
      panel.appendChild(st);
      panel.appendChild(statBar("HP", num(sp.baseHp, 0), "#52b788"));
      panel.appendChild(statBar("ATK", num(sp.baseAtk, 0), "#ff595e"));
      panel.appendChild(statBar("DEF", num(sp.baseDef, 0), "#6ad1ff"));
      panel.appendChild(statBar("SPD", num(sp.baseSpd, 0), "#ffca3a"));
    }
    return panel;
  }

  /* ── Screen: Party ─────────────────────────────────────────── */
  G.ui.Party = function () {
    var content = document.getElementById("menu-content");
    if (!content) return;
    resetStatus();

    var inspectIdx = -1;

    function render() {
      content.innerHTML = "";

      var root = style(mk("div"),
        "grid-column:1 / -1;display:flex;flex-direction:column;gap:10px;color:#e8eef7;");

      var p = getParty();

      var titleRow = style(mk("div"),
        "display:flex;justify-content:space-between;align-items:center;gap:10px;");
      var title = mk("h2");
      title.className = "menu-title";
      title.textContent = "CREATURES";
      titleRow.appendChild(title);
      var countEl = style(mk("span"), "font-size:13px;color:#e8eef7;");
      countEl.textContent = "Party " + p.length + "/6";
      titleRow.appendChild(countEl);
      root.appendChild(titleRow);

      if (!p.length) {
        var empty = style(mk("div"), "font-size:13px;color:#9aa5b1;padding:8px 0;");
        empty.textContent = "No creatures yet.";
        root.appendChild(empty);
      } else {
        var list = style(mk("div"), "display:flex;flex-direction:column;gap:8px;");
        for (var i = 0; i < p.length; i++) list.appendChild(memberRow(p, i));
        root.appendChild(list);

        if (inspectIdx >= 0 && inspectIdx < p.length) {
          root.appendChild(detailPanel(p[inspectIdx]));
        }
      }

      statusFooter(root);
      content.appendChild(root);
      applyStatus();
    }

    function memberRow(p, i) {
      var m = p[i] || {};
      var sp = findSpecies(m.speciesId);

      var row = style(mk("div"),
        "display:flex;align-items:center;gap:10px;padding:8px;" +
        "background:#1a2130;border-radius:4px;" +
        "border:1px solid " + (i === 0 ? "#6ad1ff" : "#2a3446") + ";");
      if (i === 0) row.style.boxShadow = "0 0 0 1px #6ad1ff";

      var cvs = mk("canvas");
      drawSpriteInto(cvs, sp);
      row.appendChild(cvs);

      var mid = style(mk("div"),
        "flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;");

      var nameRow = style(mk("div"),
        "display:flex;align-items:center;gap:8px;flex-wrap:wrap;");
      var nm = style(mk("span"),
        "font-size:13px;font-weight:bold;color:#e8eef7;text-transform:uppercase;");
      nm.textContent = sp ? sp.name : "???";
      nameRow.appendChild(nm);

      var lv = style(mk("span"), "font-size:12px;color:#9aa5b1;");
      lv.textContent = "Lv" + num(m.level, 1);
      nameRow.appendChild(lv);

      if (sp && sp.type) {
        var badge = style(mk("span"),
          "font-size:11px;padding:1px 8px;border-radius:8px;font-weight:bold;" +
          "background:" + typeColor(sp.type) + ";color:#11151f;");
        badge.textContent = sp.type;
        nameRow.appendChild(badge);
      }

      if (i === 0) {
        var tag = style(mk("span"),
          "font-size:10px;padding:1px 6px;border-radius:4px;" +
          "background:#6ad1ff;color:#11151f;font-weight:bold;");
        tag.textContent = "LEAD";
        nameRow.appendChild(tag);
      }
      mid.appendChild(nameRow);

      var hp = num(m.hp, 0);
      var maxHp = num(m.maxHp, 0);
      var ratio = maxHp > 0 ? hp / maxHp : 0;
      mid.appendChild(bar(hp, maxHp > 0 ? maxHp : 1, 8, hpColor(ratio)));
      var hpText = style(mk("div"), "font-size:11px;color:#9aa5b1;");
      hpText.textContent = hp + "/" + maxHp + " HP";
      mid.appendChild(hpText);

      var lvl = num(m.level, 1);
      var need = xpNeeded(lvl);
      var xp = num(m.xp, 0);
      mid.appendChild(bar(xp, need, 4, "#6ad1ff"));
      var xpText = style(mk("div"), "font-size:11px;color:#9aa5b1;");
      xpText.textContent = "XP " + xp + "/" + need;
      mid.appendChild(xpText);

      row.appendChild(mid);

      var col = style(mk("div"),
        "display:flex;flex-direction:column;gap:4px;flex-shrink:0;");

      if (i === 0) {
        var leadHidden = btn("LEAD", "#6ad1ff", function () {});
        leadHidden.style.display = "none";
        col.appendChild(leadHidden);
      } else {
        var leadBtn = btn("LEAD", "#6ad1ff", (function (idx) {
          return function () { setLead(idx); };
        })(i));
        if (hp <= 0) {
          leadBtn.disabled = true;
          leadBtn.textContent = "FAINTED";
          leadBtn.title = "Cannot lead a fainted creature.";
          leadBtn.style.opacity = "0.45";
          leadBtn.style.cursor = "default";
        }
        col.appendChild(leadBtn);
      }

      col.appendChild(btn("POTION", "#52b788", (function (idx) {
        return function () { usePotionOn(idx); };
      })(i)));

      col.appendChild(btn("INSPECT", "#ffca3a", (function (idx) {
        return function () {
          inspectIdx = (inspectIdx === idx) ? -1 : idx;
          render();
        };
      })(i)));

      row.appendChild(col);
      return row;
    }

    function setLead(idx) {
      var p = getParty();
      if (idx <= 0 || idx >= p.length) return;
      var moved = p.splice(idx, 1)[0];
      if (!moved) return;
      p.unshift(moved);
      inspectIdx = -1;
      setStatus("Lead creature updated.", true);
      updateHUD();
      render();
    }

    function usePotionOn(idx) {
      var p = getParty();
      var m = p[idx];
      if (!m) return;
      var inv = getInv();
      if (num(inv.potions, 0) <= 0) {
        setStatus("No potions left.", false);
        return;
      }
      var hp = num(m.hp, 0);
      var maxHp = num(m.maxHp, 0);
      if (hp >= maxHp) {
        setStatus("Already at full HP.", false);
        return;
      }
      inv.potions = num(inv.potions, 0) - 1;
      m.hp = Math.min(maxHp, hp + 20);
      setStatus("Healed to " + m.hp + "/" + maxHp + " HP.", true);
      updateHUD();
      render();
    }

    render();
  };

  /* ── Screen: Inventory ─────────────────────────────────────── */
  G.ui.Inventory = function () {
    var content = document.getElementById("menu-content");
    if (!content) return;
    resetStatus();

    function render() {
      content.innerHTML = "";

      var root = style(mk("div"),
        "grid-column:1 / -1;display:flex;flex-direction:column;gap:10px;color:#e8eef7;");

      var titleRow = style(mk("div"),
        "display:flex;justify-content:space-between;align-items:center;gap:10px;");
      var title = mk("h2");
      title.className = "menu-title";
      title.textContent = "INVENTORY";
      titleRow.appendChild(title);
      var goldEl = style(mk("span"),
        "font-size:13px;color:#ffca3a;font-weight:bold;");
      goldEl.textContent = "G" + getGold();
      titleRow.appendChild(goldEl);
      root.appendChild(titleRow);

      var inv = getInv();

      var grid = style(mk("div"),
        "display:grid;grid-template-columns:1fr 1fr;gap:10px;");

      grid.appendChild(itemCard(
        "Catching Orb",
        num(inv.balls, 0),
        "Thrown in battle to catch a creature",
        function (card) {
          var b = btn("BATTLE ONLY", "#9aa3b2", function () {});
          b.disabled = true;
          b.style.opacity = "0.45";
          b.style.cursor = "default";
          card.appendChild(b);
        }
      ));

      grid.appendChild(itemCard(
        "Potion",
        num(inv.potions, 0),
        "Restores 20 HP to a creature",
        function (card) {
          card.appendChild(btn("USE ON LEAD", "#52b788", function () { useOnLead(); }));
        }
      ));

      root.appendChild(grid);

      var footer = style(mk("div"), "font-size:12px;color:#9aa5b1;");
      footer.textContent = "No other items yet.";
      root.appendChild(footer);

      statusFooter(root);
      content.appendChild(root);
      applyStatus();
    }

    function itemCard(name, count, desc, addButton) {
      var card = style(mk("div"),
        "background:#1a2130;border:1px solid #2a3446;border-radius:4px;" +
        "padding:10px;display:flex;flex-direction:column;gap:6px;");

      var head = style(mk("div"),
        "display:flex;justify-content:space-between;align-items:center;gap:8px;");
      var nm = style(mk("span"),
        "font-size:13px;font-weight:bold;color:#e8eef7;text-transform:uppercase;");
      nm.textContent = name;
      head.appendChild(nm);
      var cnt = style(mk("span"),
        "font-size:12px;color:#ffca3a;font-weight:bold;");
      cnt.textContent = "x" + count;
      head.appendChild(cnt);
      card.appendChild(head);

      var d = style(mk("div"), "font-size:12px;color:#9aa5b1;flex:1;");
      d.textContent = desc;
      card.appendChild(d);

      if (addButton) addButton(card);
      return card;
    }

    function useOnLead() {
      var inv = getInv();
      if (num(inv.potions, 0) <= 0) {
        setStatus("No potions left.", false);
        return;
      }
      var p = getParty();
      var target = null;
      for (var i = 0; i < p.length; i++) {
        var hp = num(p[i].hp, 0);
        var maxHp = num(p[i].maxHp, 0);
        if (hp < maxHp) { target = p[i]; break; }
      }
      if (!target) {
        setStatus("Nobody needs healing.", false);
        return;
      }
      inv.potions = num(inv.potions, 0) - 1;
      target.hp = Math.min(num(target.maxHp, 0), num(target.hp, 0) + 20);
      setStatus("Healed to " + target.hp + "/" + target.maxHp + " HP.", true);
      updateHUD();
      render();
    }

    render();
  };

  /* ── Screen: System ────────────────────────────────────────── */
  G.ui.System = function () {
    var content = document.getElementById("menu-content");
    if (!content) return;
    resetStatus();

    content.innerHTML = "";

    var root = style(mk("div"),
      "grid-column:1 / -1;display:flex;flex-direction:column;gap:10px;color:#e8eef7;");

    var title = mk("h2");
    title.className = "menu-title";
    title.textContent = "SYSTEM";
    root.appendChild(title);

    var dl = style(mk("div"),
      "display:grid;grid-template-columns:120px 1fr;gap:4px 12px;font-size:13px;");

    function fact(label, value) {
      var l = style(mk("span"), "color:#9aa5b1;");
      l.textContent = label;
      dl.appendChild(l);
      var v = style(mk("span"), "color:#e8eef7;");
      v.textContent = value;
      dl.appendChild(v);
    }

    fact("Region", G.REGION || (G.map && G.map.name) || "Unknown");
    fact("Trainer", (G.state && G.state.playerName) || "Ash");
    fact("Gold", "G" + getGold());
    fact("Party", getParty().length + "/6");

    var sp = G.species || [];
    var total = sp.length || 12;
    var dex = (G.state && G.state.dex) || {};
    var seenMap = dex.seen || {};
    var caughtMap = dex.caught || {};
    var seenN = 0, caughtN = 0, i, id;
    for (i = 0; i < sp.length; i++) {
      id = sp[i].id;
      if (caughtMap[id]) caughtN++;
      if (caughtMap[id] || seenMap[id]) seenN++;
    }
    fact("Bestiary", seenN + "/" + total + " seen, " + caughtN + "/" + total + " caught");

    var steps = 0;
    if (G.world && G.world.player && typeof G.world.player.steps === "number") {
      steps = G.world.player.steps;
    }
    fact("Steps", String(steps));

    var used = 0, s, raw;
    for (s = 1; s <= 3; s++) {
      try {
        raw = window.localStorage.getItem("aetheris.save." + s);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed) used++;
        }
      } catch (e) { /* ignore */ }
    }
    fact("Save slots", used + " of 3 used");

    root.appendChild(dl);

    var ch = style(mk("h3"), "font-size:13px;color:#6ad1ff;margin:6px 0 0;");
    ch.textContent = "CONTROLS";
    root.appendChild(ch);

    var ctl = style(mk("div"),
      "display:grid;grid-template-columns:140px 1fr;gap:3px 12px;font-size:12px;color:#9aa5b1;");
    var rows = [
      ["WASD / Arrows", "walk"],
      ["1-4", "battle moves"],
      ["B", "bag"],
      ["P", "party"],
      ["Esc", "pause menu"]
    ];
    for (i = 0; i < rows.length; i++) {
      var k = style(mk("span"), "color:#e8eef7;");
      k.textContent = rows[i][0];
      ctl.appendChild(k);
      var v = style(mk("span"), "");
      v.textContent = rows[i][1];
      ctl.appendChild(v);
    }
    root.appendChild(ctl);

    statusFooter(root);
    content.appendChild(root);
    applyStatus();
  };
})(window.GAME);
