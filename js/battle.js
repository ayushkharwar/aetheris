/**
 * js/battle.js – Turn-based battle system for Aetheris: Creature Chronicles
 * IIFE, runs after data.js and before world.js.
 */
(function (G) {
  "use strict";

  /* ── State initialisation ───────────────────────────────────────── */
  var sp0 = G.species[0];
  var startHp = Math.floor(sp0.baseHp * (5 / 50 + 0.5) + 10);
  G.state = {
    party: [{
      speciesId: 0, level: 5, hp: startHp, maxHp: startHp,
      moves: sp0.moves.slice(0, 2).map(function (m) {
        return { name: m.name, power: m.power, type: m.type, pp: m.pp, maxPp: m.pp };
      }), xp: 0
    }],
    dex: { seen: {}, caught: {} },
    inventory: { balls: 5, potions: 2 },
    gold: 100, playerName: "Ash"
  };
  G.party = G.state.party;

  /* ── Live battle state (for automated tests) ────────────────────── */
  var live = {
    wildId: null, wildLvl: 0, wildHp: 0, wildMaxHp: 0, playerIndex: 0,
    playerHp: 0, playerMaxHp: 0, level: 0, xp: 0, over: false
  };
  G.state.battle = live;

  /* ── Helpers ─────────────────────────────────────────────────────── */
  var clamp = G.helpers.clamp;
  function calcHp(base, lvl) { return Math.floor(base * (lvl / 50 + 0.5) + 10); }
  function calcStat(base, lvl) { return Math.floor(base * (lvl / 50 + 0.5) + 5); }
  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function xpToNext(level) { return 15 * level + 25; }
  G.xpToNext = xpToNext;

  function shade(hex, f) {
    var r = parseInt(hex.substr(1, 2), 16);
    var g = parseInt(hex.substr(3, 2), 16);
    var b = parseInt(hex.substr(5, 2), 16);
    r = Math.min(255, Math.max(0, Math.floor(r * f)));
    g = Math.min(255, Math.max(0, Math.floor(g * f)));
    b = Math.min(255, Math.max(0, Math.floor(b * f)));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  /* ── Tracked timeouts (never leak past hideOverlay) ─────────────── */
  var timers = [];
  function later(fn, ms) {
    var id = setTimeout(function () {
      for (var i = 0; i < timers.length; i++) {
        if (timers[i] === id) { timers.splice(i, 1); break; }
      }
      fn();
    }, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) { clearTimeout(timers[i]); }
    timers = [];
  }

  /* ── Creature drawing ───────────────────────────────────────────── */
  /* Body drawer: no clear, no platform. Shared by G.drawCreature and the
     battle anim loop. */
  function drawBody(cvs, palette, facingRight, bobY, lungeX) {
    var w = cvs.width, h = cvs.height, cx = w / 2 + (lungeX || 0), cy = h / 2 + (bobY || 0);
    var c = cvs.getContext("2d");
    var p = palette, dir = facingRight ? 1 : -1;
    // shadow
    c.fillStyle = "rgba(0,0,0,0.15)";
    c.beginPath(); c.ellipse(w / 2, h - 12, 32, 8, 0, 0, 6.283); c.fill();
    // body
    c.fillStyle = p[0];
    c.beginPath(); c.ellipse(cx, cy + 8, 30, 28, 0, 0, 6.283); c.fill();
    // body shading blob (lower-right)
    c.globalAlpha = 0.55;
    c.fillStyle = shade(p[0], 0.72);
    c.beginPath(); c.ellipse(cx + dir * 8, cy + 16, 16, 13, 0, 0, 6.283); c.fill();
    c.globalAlpha = 1;
    // body outline
    c.strokeStyle = "rgba(18,14,22,0.85)"; c.lineWidth = 1;
    c.beginPath(); c.ellipse(cx, cy + 8, 30, 28, 0, 0, 6.283); c.stroke();
    // belly
    c.fillStyle = p[1];
    c.beginPath(); c.ellipse(cx + dir * 4, cy + 16, 18, 14, 0, 0, 6.283); c.fill();
    // head
    c.fillStyle = p[0];
    c.beginPath(); c.ellipse(cx + dir * 16, cy - 18, 20, 18, 0, 0, 6.283); c.fill();
    // head highlight blob (upper-left)
    c.globalAlpha = 0.40;
    c.fillStyle = shade(p[0], 1.22);
    c.beginPath(); c.ellipse(cx + dir * 10, cy - 26, 8, 6, 0, 0, 6.283); c.fill();
    c.globalAlpha = 1;
    // head outline
    c.strokeStyle = "rgba(18,14,22,0.85)"; c.lineWidth = 1;
    c.beginPath(); c.ellipse(cx + dir * 16, cy - 18, 20, 18, 0, 0, 6.283); c.stroke();
    // ears / horns
    c.fillStyle = p[2];
    c.beginPath();
    c.moveTo(cx + dir * 8, cy - 34);
    c.lineTo(cx + dir * 14, cy - 50);
    c.lineTo(cx + dir * 22, cy - 30);
    c.fill();
    c.beginPath();
    c.moveTo(cx + dir * 22, cy - 32);
    c.lineTo(cx + dir * 28, cy - 48);
    c.lineTo(cx + dir * 32, cy - 26);
    c.fill();
    // eyes
    c.fillStyle = "#fff";
    c.beginPath(); c.ellipse(cx + dir * 22, cy - 20, 6, 7, 0, 0, 6.283); c.fill();
    c.fillStyle = "#14101a";
    c.beginPath(); c.ellipse(cx + dir * 24, cy - 19, 3, 4, 0, 0, 6.283); c.fill();
    c.fillStyle = "#fff";
    c.beginPath(); c.arc(cx + dir * 25, cy - 21, 1.5, 0, 6.283); c.fill();
    // mouth
    c.strokeStyle = p[2]; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx + dir * 30, cy - 14);
    c.quadraticCurveTo(cx + dir * 36, cy - 10, cx + dir * 32, cy - 8);
    c.stroke();
    // tail
    c.fillStyle = p[2]; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx - dir * 26, cy + 4);
    c.quadraticCurveTo(cx - dir * 50, cy - 20, cx - dir * 44, cy - 32);
    c.lineTo(cx - dir * 38, cy - 24);
    c.quadraticCurveTo(cx - dir * 42, cy - 14, cx - dir * 24, cy + 8);
    c.fill();
    // feet
    c.fillStyle = p[2];
    c.fillRect(cx - dir * 12 - 6, cy + 30, 12, 6);
    c.fillRect(cx + dir * 6 - 6, cy + 30, 12, 6);
    // accent mark on body
    c.fillStyle = p[1];
    c.beginPath(); c.arc(cx - dir * 8, cy, 5, 0, 6.283); c.fill();
    c.beginPath(); c.arc(cx - dir * 14, cy + 10, 3, 0, 6.283); c.fill();
  }

  function drawPlatform(c, w, h, palette, isWild) {
    var cx = w / 2;
    var cy = h - 14 + (isWild ? 3 : 0);
    var s = isWild ? 0.92 : 1;
    c.save();
    c.translate(cx, cy);
    c.scale(s, s);
    c.translate(-cx, -cy);
    // outer disc
    c.fillStyle = "rgba(0,0,0,0.30)";
    c.beginPath(); c.ellipse(cx, cy, 42, 10, 0, 0, 6.283); c.fill();
    // inner disc
    c.fillStyle = "rgba(255,255,255,0.09)";
    c.beginPath(); c.ellipse(cx, cy, 34, 7, 0, 0, 6.283); c.fill();
    // front rim
    c.globalAlpha = 0.35;
    c.strokeStyle = palette[2];
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(cx, cy, 42, 10, 0, 0, Math.PI); c.stroke();
    c.globalAlpha = 1;
    c.restore();
  }

  /* Public export: unchanged signature and clear-then-body behaviour. */
  function drawCreature(cvs, palette, facingRight, bobY, lungeX) {
    var c = cvs.getContext("2d");
    c.clearRect(0, 0, cvs.width, cvs.height);
    drawBody(cvs, palette, facingRight, bobY, lungeX);
  }

  /* Battle-only: clears, draws platform, then body. */
  function drawSide(cvs, palette, facingRight, bobY, lungeX, isWild) {
    var c = cvs.getContext("2d");
    c.clearRect(0, 0, cvs.width, cvs.height);
    drawPlatform(c, cvs.width, cvs.height, palette, isWild);
    drawBody(cvs, palette, facingRight, bobY, lungeX);
  }

  /* ── Battle system ──────────────────────────────────────────────── */
  var overlay, inBattle = false, battleAnim = 0;
  var wild, wildHp, wildMaxHp, wildMoves, wildLvl, activeIdx;
  var menuMode, msgQueue, waitingInput, animFrameId;
  var flashP = 0, flashW = 0;

  /* ── Animation timing state ─────────────────────────────────────── */
  var LUNGE_DUR = 300, LUNGE_IMPACT = 165;
  var lungeWho = null, lungeStart = 0, lungeImpacted = true, lungeCb = null;
  var flinchPStart = 0, flinchWStart = 0;
  var shakeStart = 0;
  var entranceUntil = 0;
  var bannerTimerId = 0;
  var typeIv = 0;

  // DOM refs
  var ui = {};

  function applyBadgeBase(b) {
    b.style.display = "inline-block";
    b.style.padding = "1px 6px";
    b.style.borderRadius = "3px";
    b.style.fontSize = "10px";
    b.style.letterSpacing = "0.5px";
    b.style.textTransform = "uppercase";
    b.style.border = "1px solid rgba(0,0,0,0.45)";
    b.style.marginLeft = "4px";
  }

  /* Painted, image-free backdrop: sky, glowing horizon, ground, shadow pools. */
  function buildBackdrop(scene) {
    var bd = el("div", "", scene);
    bd.style.position = "absolute";
    bd.style.left = "0";
    bd.style.top = "0";
    bd.style.right = "0";
    bd.style.bottom = "0";
    bd.style.zIndex = "0";
    bd.style.pointerEvents = "none";
    bd.style.overflow = "hidden";
    bd.style.background = "linear-gradient(180deg, #0d1320 0%, #16202f 42%, #22303f 62%)";
    bd.style.boxShadow = "inset 0 0 120px 20px rgba(0,0,0,0.55)";

    var ground = el("div", "", bd);
    ground.style.position = "absolute";
    ground.style.left = "0";
    ground.style.right = "0";
    ground.style.top = "62%";
    ground.style.bottom = "0";
    ground.style.background = "linear-gradient(180deg, #1d2b22 0%, #131a15 100%)";

    var horizon = el("div", "", bd);
    horizon.style.position = "absolute";
    horizon.style.left = "0";
    horizon.style.right = "0";
    horizon.style.top = "62%";
    horizon.style.height = "6px";
    horizon.style.marginTop = "-3px";
    horizon.style.background = "#2c4a3a";
    horizon.style.boxShadow = "0 0 24px 6px rgba(44,74,58,0.35)";

    var poolP = el("div", "", bd);
    poolP.style.position = "absolute";
    poolP.style.left = "24%";
    poolP.style.top = "72%";
    poolP.style.width = "260px";
    poolP.style.height = "70px";
    poolP.style.marginLeft = "-130px";
    poolP.style.marginTop = "-35px";
    poolP.style.borderRadius = "50%";
    poolP.style.background = "radial-gradient(closest-side, rgba(0,0,0,0.45), rgba(0,0,0,0))";

    var poolW = el("div", "", bd);
    poolW.style.position = "absolute";
    poolW.style.left = "76%";
    poolW.style.top = "72%";
    poolW.style.width = "260px";
    poolW.style.height = "70px";
    poolW.style.marginLeft = "-130px";
    poolW.style.marginTop = "-35px";
    poolW.style.borderRadius = "50%";
    poolW.style.background = "radial-gradient(closest-side, rgba(0,0,0,0.45), rgba(0,0,0,0))";
  }

  function buildUI() {
    overlay = document.getElementById("battle-overlay");
    overlay.innerHTML = "";
    // scene area
    var scene = el("div", "btl-scene", overlay);
    scene.style.position = "relative";
    ui.scene = scene;
    buildBackdrop(scene);
    // player side (LEFT)
    var pSide = el("div", "btl-side btl-side-player", scene);
    pSide.style.position = "relative";
    pSide.style.zIndex = "1";
    ui.pSide = pSide;
    ui.pCanvas = el("canvas", "btl-sprite", pSide);
    ui.pCanvas.width = 120; ui.pCanvas.height = 100;
    ui.pCanvas.style.transform = "translateX(-72px)";
    ui.pCanvas.style.opacity = "0";
    var pInfo = el("div", "btl-info", pSide);
    ui.pInfo = pInfo;
    pInfo.style.opacity = "0";
    ui.pName = el("span", "btl-name", pInfo);
    ui.pLvl = el("span", "btl-lvl", pInfo);
    ui.pBadge = el("span", "", pInfo);
    applyBadgeBase(ui.pBadge);
    var pBarWrap = el("div", "btl-bar-wrap", pSide);
    ui.pBarWrap = pBarWrap;
    pBarWrap.style.opacity = "0";
    ui.pBar = el("div", "btl-bar btl-bar-green", pBarWrap);
    ui.pBar.style.transition = "width 220ms ease-out";
    ui.pHpText = el("span", "btl-hp-text", pSide);
    ui.pHpText.style.opacity = "0";
    // player XP bar
    ui.pXpWrap = el("div", "", pSide);
    ui.pXpWrap.style.opacity = "0";
    var pXpTrack = el("div", "", ui.pXpWrap);
    pXpTrack.style.height = "4px";
    pXpTrack.style.background = "#1b2230";
    pXpTrack.style.borderRadius = "2px";
    pXpTrack.style.marginTop = "4px";
    ui.pXpFill = el("div", "", pXpTrack);
    ui.pXpFill.style.height = "100%";
    ui.pXpFill.style.background = "#6ad1ff";
    ui.pXpFill.style.width = "0%";
    ui.pXpFill.style.transition = "width 180ms linear";
    ui.pXpLabel = el("div", "", ui.pXpWrap);
    ui.pXpLabel.style.fontSize = "10px";
    ui.pXpLabel.style.color = "#93a4bd";
    // wild side (RIGHT)
    var wSide = el("div", "btl-side btl-side-wild", scene);
    wSide.style.position = "relative";
    wSide.style.zIndex = "1";
    ui.wSide = wSide;
    ui.wCanvas = el("canvas", "btl-sprite", wSide);
    ui.wCanvas.width = 120; ui.wCanvas.height = 100;
    ui.wCanvas.style.transform = "translateX(72px)";
    ui.wCanvas.style.opacity = "0";
    var wInfo = el("div", "btl-info", wSide);
    ui.wInfo = wInfo;
    wInfo.style.opacity = "0";
    ui.wName = el("span", "btl-name", wInfo);
    ui.wLvl = el("span", "btl-lvl", wInfo);
    ui.wBadge = el("span", "", wInfo);
    applyBadgeBase(ui.wBadge);
    var wBarWrap = el("div", "btl-bar-wrap", wSide);
    ui.wBarWrap = wBarWrap;
    wBarWrap.style.opacity = "0";
    ui.wBar = el("div", "btl-bar btl-bar-green", wBarWrap);
    ui.wBar.style.transition = "width 220ms ease-out";
    ui.wHpText = el("span", "btl-hp-text", wSide);
    ui.wHpText.style.opacity = "0";
    // message
    ui.msgBox = el("div", "btl-msg", overlay);
    ui.msgLine1 = el("p", "btl-msg-line", ui.msgBox);
    ui.msgLine2 = el("p", "btl-msg-line", ui.msgBox);
    // move banner
    ui.banner = el("div", "btl-move-banner", overlay);
    ui.banner.style.position = "absolute";
    ui.banner.style.top = "12px";
    ui.banner.style.left = "50%";
    ui.banner.style.transform = "translateX(-50%)";
    ui.banner.style.padding = "4px 16px";
    ui.banner.style.borderRadius = "14px";
    ui.banner.style.fontSize = "13px";
    ui.banner.style.fontWeight = "bold";
    ui.banner.style.letterSpacing = "0.5px";
    ui.banner.style.opacity = "0";
    ui.banner.style.transition = "opacity 200ms ease-out";
    ui.banner.style.pointerEvents = "none";
    ui.banner.style.zIndex = "6";
    ui.banner.style.boxShadow = "0 2px 8px rgba(0,0,0,0.45)";
    // menu
    ui.menu = el("div", "btl-menu", overlay);
    ui.moveBtns = [];
    ui.moveGrid = el("div", "btl-move-grid", ui.menu);
    for (var i = 0; i < 4; i++) {
      var b = el("button", "btn btl-btn", ui.moveGrid);
      ui.moveBtns.push(b);
      (function (idx) { b.addEventListener("click", function () { pickMove(idx); }); })(i);
    }
    ui.actionRow = el("div", "btl-action-row", ui.menu);
    ui.bagBtn = el("button", "btn btl-btn", ui.actionRow); ui.bagBtn.textContent = "BAG";
    ui.creatureBtn = el("button", "btn btl-btn", ui.actionRow); ui.creatureBtn.textContent = "CREATURE";
    ui.runBtn = el("button", "btn btl-btn", ui.actionRow); ui.runBtn.textContent = "RUN";
    ui.bagBtn.addEventListener("click", openBag);
    ui.creatureBtn.addEventListener("click", openCreatureMenu);
    ui.runBtn.addEventListener("click", tryRun);
    // sub-menu overlay
    ui.subMenu = el("div", "btl-submenu hidden", overlay);
  }

  /* One-shot entrance: sprites slide in, then HUD fades in. */
  function playEntrance() {
    entranceUntil = performance.now() + 380;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var spriteT = "transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 320ms ease-out";
        ui.pCanvas.style.transition = spriteT;
        ui.wCanvas.style.transition = spriteT;
        ui.pCanvas.style.transform = "translateX(0)";
        ui.wCanvas.style.transform = "translateX(0)";
        ui.pCanvas.style.opacity = "1";
        ui.wCanvas.style.opacity = "1";
        var hudT = "opacity 260ms ease-out 120ms";
        var hud = [ui.pInfo, ui.wInfo, ui.pBarWrap, ui.wBarWrap,
                   ui.pHpText, ui.wHpText, ui.pXpWrap];
        for (var i = 0; i < hud.length; i++) {
          if (!hud[i]) continue;
          hud[i].style.transition = hudT;
          hud[i].style.opacity = "1";
        }
      });
    });
  }

  function showOverlay() {
    overlay.classList.remove("hidden");
    inBattle = true;
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
    inBattle = false;
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = 0; }
    clearTimers();
    if (typeIv) { clearInterval(typeIv); typeIv = 0; }
    if (ui.scene) { ui.scene.style.transform = ""; }
    if (ui.banner) { ui.banner.style.opacity = "0"; }
    shakeStart = 0;
    flinchPStart = 0;
    flinchWStart = 0;
    lungeWho = null;
    lungeCb = null;
    lungeImpacted = true;
    bannerTimerId = 0;
  }

  /* ── HP bar updates ─────────────────────────────────────────────── */
  var TYPE_COLORS = {
    Fire: "#ff595e", Water: "#1982c4", Grass: "#52b788",
    Normal: "#9aa3b2", Electric: "#ffd166"
  };
  var TYPE_DARK_TEXT = { Electric: true, Normal: true };

  function styleBadge(b, type) {
    b.textContent = type;
    b.style.background = TYPE_COLORS[type] || "#9aa3b2";
    b.style.color = TYPE_DARK_TEXT[type] ? "#10141c" : "#ffffff";
  }

  function hpColor(pct) {
    return pct > 0.5 ? "btl-bar-green" : pct > 0.2 ? "btl-bar-yellow" : "btl-bar-red";
  }
  function updateBars() {
    var pm = getActive();
    var pPct = pm.hp / pm.maxHp;
    ui.pBar.style.width = (pPct * 100) + "%";
    ui.pBar.className = "btl-bar " + hpColor(pPct);
    ui.pHpText.textContent = pm.hp + "/" + pm.maxHp;
    ui.pName.textContent = G.species[pm.speciesId].name;
    ui.pLvl.textContent = "Lv" + pm.level;
    styleBadge(ui.pBadge, G.species[pm.speciesId].type);
    var xpNeed = xpToNext(pm.level);
    ui.pXpFill.style.width = Math.min(100, (pm.xp / xpNeed) * 100) + "%";
    ui.pXpLabel.textContent = "XP " + pm.xp + "/" + xpNeed;
    var wPct = wildHp / wildMaxHp;
    ui.wBar.style.width = (wPct * 100) + "%";
    ui.wBar.className = "btl-bar " + hpColor(wPct);
    ui.wHpText.textContent = wildHp + "/" + wildMaxHp;
    ui.wName.textContent = G.species[wild].name;
    ui.wLvl.textContent = "Lv" + wildLvl;
    styleBadge(ui.wBadge, G.species[wild].type);
    // live test state
    live.wildId = wild;
    live.wildLvl = wildLvl;
    live.wildHp = wildHp;
    live.wildMaxHp = wildMaxHp;
    live.playerIndex = activeIdx;
    live.playerHp = pm.hp;
    live.playerMaxHp = pm.maxHp;
    live.level = pm.level;
    live.xp = pm.xp;
  }

  /* ── Typewriter message ─────────────────────────────────────────── */
  function typeMsg(text, cb) {
    if (typeIv) { clearInterval(typeIv); typeIv = 0; }
    ui.msgLine1.textContent = ui.msgLine2.textContent;
    ui.msgLine2.textContent = "";
    var i = 0;
    typeIv = setInterval(function () {
      if (i < text.length) { ui.msgLine2.textContent += text[i++]; }
      else {
        clearInterval(typeIv); typeIv = 0;
        if (cb) setTimeout(cb, 400);
      }
    }, 28);
  }

  function chainMsgs(msgs, cb) {
    if (!msgs.length) { cb(); return; }
    typeMsg(msgs[0], function () { chainMsgs(msgs.slice(1), cb); });
  }

  /* ── Move banner ────────────────────────────────────────────────── */
  function showBanner(name, type) {
    if (!ui.banner) return;
    ui.banner.textContent = name;
    ui.banner.style.background = TYPE_COLORS[type] || "#9aa3b2";
    ui.banner.style.color = TYPE_DARK_TEXT[type] ? "#10141c" : "#ffffff";
    ui.banner.style.opacity = "1";
    if (bannerTimerId) { clearTimeout(bannerTimerId); bannerTimerId = 0; }
    bannerTimerId = later(function () {
      bannerTimerId = 0;
      if (ui.banner) ui.banner.style.opacity = "0";
    }, 700);
  }

  /* ── Damage number ──────────────────────────────────────────────── */
  function spawnDamage(sideEl, dmg, eff) {
    if (!sideEl) return;
    var d = el("div", "btl-dmg", sideEl);
    d.textContent = "-" + dmg;
    d.style.position = "absolute";
    d.style.top = "38%";
    d.style.left = "50%";
    d.style.fontWeight = "bold";
    d.style.fontSize = "22px";
    d.style.textShadow = "0 2px 0 rgba(0,0,0,0.6)";
    d.style.pointerEvents = "none";
    d.style.zIndex = "4";
    d.style.color = eff >= 2.0 ? "#ffca3a" : (eff <= 0.5 ? "#9aa3b2" : "#f4f8ff");
    d.style.transform = "translate(-50%, 0)";
    d.style.opacity = "1";
    d.style.transition = "transform 620ms ease-out, opacity 620ms ease-out";
    d.offsetHeight;
    d.style.transform = "translate(-50%, -34px)";
    d.style.opacity = "0";
    later(function () {
      if (d.parentNode) { d.parentNode.removeChild(d); }
    }, 700);
  }

  /* ── Sprite animations ─────────────────────────────────────────── */
  var pBob = 0, wBob = 0;

  function applyFlash(cvs) {
    var c = cvs.getContext("2d");
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.fillRect(0, 0, cvs.width, cvs.height);
    c.globalCompositeOperation = "source-over";
  }

  /* Keyframed lunge: anticipation → drive → eased return. */
  function startLunge(who, onImpact) {
    lungeWho = who;
    lungeStart = performance.now();
    lungeImpacted = false;
    lungeCb = onImpact;
  }

  function lungeOffset(now) {
    if (!lungeWho) return 0;
    var t = now - lungeStart;
    if (t <= 0) return 0;
    if (t >= LUNGE_DUR) return 0;
    if (t < 60) return -8 * (t / 60);
    if (t < 170) return -8 + 42 * ((t - 60) / 110);
    var u = (t - 170) / (LUNGE_DUR - 170);
    var e = 1 - u;
    return 34 * e * e;
  }

  /* Decaying flinch shake, driven by a timestamp. */
  function flinchOffset(start, now) {
    if (!start) return 0;
    var t = now - start;
    if (t < 0 || t >= 130) return 0;
    var seq = [3, -3, 2, -1, 0];
    var i = Math.floor(t / 26);
    if (i > 4) i = 4;
    return seq[i];
  }

  function startShake() { shakeStart = performance.now() || 1; }

  function animLoop(now) {
    if (!inBattle) return;

    if (lungeWho && !lungeImpacted && (now - lungeStart) >= LUNGE_IMPACT) {
      lungeImpacted = true;
      var f = lungeCb;
      lungeCb = null;
      if (f) f();
      if (!inBattle) return;
    }

    pBob = Math.sin(now / 500) * 3;
    wBob = Math.sin(now / 500 + 1.5) * 3;

    var lo = lungeOffset(now);
    var pL = (lungeWho === "player") ? lo : 0;
    var wL = (lungeWho === "wild") ? -lo : 0;
    pL += flinchOffset(flinchPStart, now);
    wL += flinchOffset(flinchWStart, now);

    var pm = getActive();
    drawSide(ui.pCanvas, G.species[pm.speciesId].palette, true, pBob, pL, false);
    drawSide(ui.wCanvas, G.species[wild].palette, false, wBob, wL, true);
    if (performance.now() < flashP) applyFlash(ui.pCanvas);
    if (performance.now() < flashW) applyFlash(ui.wCanvas);

    if (shakeStart && ui.scene) {
      var st = now - shakeStart;
      if (st >= 140 || st < 0) {
        ui.scene.style.transform = "";
        shakeStart = 0;
      } else {
        var xs = [-3, 3, -2, 2, 0];
        var ys = [1, -1, 1, 0, 0];
        var si = Math.floor(st / 28);
        if (si > 4) si = 4;
        ui.scene.style.transform = "translate(" + xs[si] + "px," + ys[si] + "px)";
      }
    }

    animFrameId = requestAnimationFrame(animLoop);
  }

  /* ── Faint / sprite reset ───────────────────────────────────────── */
  function faintSprite(cvs) {
    if (!cvs) return;
    cvs.style.transition = "transform 420ms ease-in, opacity 420ms ease-in";
    cvs.style.transform = "translateY(18px)";
    cvs.style.opacity = "0.15";
  }

  function resetSprite(cvs) {
    if (!cvs) return;
    cvs.style.transition = "transform 220ms ease-out, opacity 220ms ease-out";
    cvs.style.transform = "translateY(0)";
    cvs.style.opacity = "1";
  }

  /* ── Battle logic helpers ───────────────────────────────────────── */
  function getActive() { return G.state.party[activeIdx]; }

  function calcDamage(level, power, atk, def, moveType, targetType) {
    var base = Math.floor(((2 * level / 5 + 2) * power * atk / def) / 50) + 2;
    var eff = (G.typeChart[moveType] && G.typeChart[moveType][targetType]) || 1.0;
    var rand = 0.85 + Math.random() * 0.15;
    return { dmg: Math.max(1, Math.floor(base * eff * rand)), eff: eff };
  }

  function effMsg(eff) {
    if (eff >= 2.0) return "It's super effective!";
    if (eff <= 0.5) return "It's not very effective...";
    return "";
  }

  /* ── Turn execution ─────────────────────────────────────────────── */
  function execPlayerMove(moveIdx, cb) {
    var pm = getActive(), mv = pm.moves[moveIdx];
    if (!mv || mv.pp <= 0) { typeMsg("No PP left!", cb); return; }
    mv.pp--;
    updateMoveButtons();
    showBanner(mv.name, mv.type);
    var aDef = calcStat(G.species[wild].baseDef, wildLvl);
    var aAtk = calcStat(G.species[pm.speciesId].baseAtk, pm.level);
    var res = calcDamage(pm.level, mv.power, aAtk, aDef, mv.type, G.species[wild].type);
    var msgs = [G.species[pm.speciesId].name + " used " + mv.name + "!"];
    var em = effMsg(res.eff); if (em) msgs.push(em);
    startLunge("player", function () {
      wildHp = Math.max(0, wildHp - res.dmg);
      flashW = performance.now() + 120;
      flinchWStart = performance.now() || 1;
      startShake();
      spawnDamage(ui.wSide, res.dmg, res.eff);
      updateBars();
      chainMsgs(msgs, cb);
    });
  }

  function execWildMove(cb) {
    if (wildHp <= 0) { cb(); return; }
    var mv = wildMoves[Math.floor(Math.random() * wildMoves.length)];
    var pm = getActive();
    var aDef = calcStat(G.species[pm.speciesId].baseDef, pm.level);
    var aAtk = calcStat(G.species[wild].baseAtk, wildLvl);
    var res = calcDamage(wildLvl, mv.power, aAtk, aDef, mv.type, G.species[pm.speciesId].type);
    var msgs = [G.species[wild].name + " used " + mv.name + "!"];
    var em = effMsg(res.eff); if (em) msgs.push(em);
    showBanner(mv.name, mv.type);
    startLunge("wild", function () {
      pm.hp = Math.max(0, pm.hp - res.dmg);
      flashP = performance.now() + 120;
      flinchPStart = performance.now() || 1;
      startShake();
      spawnDamage(ui.pSide, res.dmg, res.eff);
      updateBars();
      chainMsgs(msgs, cb);
    });
  }

  function determineTurnOrder() {
    var pm = getActive();
    var pSpd = G.species[pm.speciesId].baseSpd;
    var wSpd = G.species[wild].baseSpd;
    if (pSpd !== wSpd) return pSpd > wSpd;
    return pm.level >= wildLvl;
  }

  function doTurn(moveIdx) {
    setMenuEnabled(false);
    var playerFirst = determineTurnOrder();
    if (playerFirst) {
      execPlayerMove(moveIdx, function () {
        if (wildHp <= 0) { winBattle(); return; }
        execWildMove(function () { checkFaint(afterTurn); });
      });
    } else {
      execWildMove(function () {
        checkFaint(function () {
          execPlayerMove(moveIdx, function () {
            if (wildHp <= 0) { winBattle(); return; }
            afterTurn();
          });
        });
      });
    }
  }

  function wildTurnThen(cb) {
    execWildMove(function () { checkFaint(cb); });
  }

  function afterTurn() { setMenuEnabled(true); menuMode = "main"; }

  function winBattle() {
    var pm = getActive();
    faintSprite(ui.wCanvas);
    var xpGain = Math.floor(G.species[wild].baseHp * wildLvl / 7);
    pm.xp += xpGain;
    var msgs = [G.species[wild].name + " fainted!", "Gained " + xpGain + " XP!"];
    while (pm.xp >= xpToNext(pm.level)) {
      pm.xp -= xpToNext(pm.level);
      pm.level += 1;
      var oldMax = pm.maxHp;
      pm.maxHp = calcHp(G.species[pm.speciesId].baseHp, pm.level);
      pm.hp += (pm.maxHp - oldMax);
      if (pm.hp > pm.maxHp) pm.hp = pm.maxHp;
      msgs.push(G.species[pm.speciesId].name + " grew to Lv" + pm.level + "!");
    }
    live.over = true;
    updateBars();
    chainMsgs(msgs, function () {
      later(function () { hideOverlay(); }, 600);
    });
  }

  function checkFaint(cb) {
    var pm = getActive();
    if (pm.hp > 0) { cb(); return; }
    faintSprite(ui.pCanvas);
    typeMsg(G.species[pm.speciesId].name + " fainted!", function () {
      var next = -1;
      for (var i = 0; i < G.state.party.length; i++) {
        if (G.state.party[i].hp > 0) { next = i; break; }
      }
      if (next < 0) {
        live.over = true;
        typeMsg("All creatures fainted...", function () {
          for (var j = 0; j < G.state.party.length; j++) {
            G.state.party[j].hp = G.state.party[j].maxHp;
          }
          if (G.world && G.map && G.map.spawn) {
            G.world.player.gx = G.map.spawn.x;
            G.world.player.gy = G.map.spawn.y;
            G.world.player.px = G.map.spawn.x * 32;
            G.world.player.py = G.map.spawn.y * 32;
          }
          later(function () { hideOverlay(); }, 1200);
        });
      } else {
        activeIdx = next;
        resetSprite(ui.pCanvas);
        updateBars(); updateMoveButtons();
        typeMsg("Go, " + G.species[getActive().speciesId].name + "!", cb);
      }
    });
  }

  /* ── Menu interactions ──────────────────────────────────────────── */
  function updateMoveButtons() {
    var pm = getActive();
    for (var i = 0; i < 4; i++) {
      if (i < pm.moves.length) {
        var m = pm.moves[i];
        ui.moveBtns[i].textContent = m.name + " " + m.pp + "/" + m.maxPp;
        ui.moveBtns[i].classList.remove("hidden");
        ui.moveBtns[i].disabled = m.pp <= 0;
      } else {
        ui.moveBtns[i].classList.add("hidden");
      }
    }
  }

  function setMenuEnabled(v) {
    ui.moveBtns.forEach(function (b) { b.disabled = !v; });
    ui.bagBtn.disabled = !v;
    ui.creatureBtn.disabled = !v;
    ui.runBtn.disabled = !v;
  }

  function pickMove(idx) {
    if (menuMode !== "main") return;
    var pm = getActive();
    if (idx >= pm.moves.length || pm.moves[idx].pp <= 0) return;
    doTurn(idx);
  }

  function openBag() {
    if (menuMode !== "main") return;
    menuMode = "bag";
    ui.subMenu.classList.remove("hidden");
    ui.subMenu.innerHTML = "";
    var inv = G.state.inventory;
    var bBtn = el("button", "btn btl-btn btl-sub-btn", ui.subMenu);
    bBtn.textContent = "Balls: " + inv.balls;
    bBtn.addEventListener("click", throwBall);
    var pBtn = el("button", "btn btl-btn btl-sub-btn", ui.subMenu);
    pBtn.textContent = "Potions: " + inv.potions;
    pBtn.addEventListener("click", usePotion);
    var cBtn = el("button", "btn btl-btn btl-sub-btn", ui.subMenu);
    cBtn.textContent = "Back";
    cBtn.addEventListener("click", closeSub);
  }

  function openCreatureMenu() {
    if (menuMode !== "main") return;
    if (G.state.party.length <= 1) { typeMsg("No other creatures!"); return; }
    menuMode = "creature";
    ui.subMenu.classList.remove("hidden");
    ui.subMenu.innerHTML = "";
    G.state.party.forEach(function (p, i) {
      if (i === activeIdx) return;
      var b = el("button", "btn btl-btn btl-sub-btn", ui.subMenu);
      b.textContent = G.species[p.speciesId].name + " HP:" + p.hp + "/" + p.maxHp;
      b.disabled = p.hp <= 0;
      b.addEventListener("click", function () { switchTo(i); });
    });
    var cBtn = el("button", "btn btl-btn btl-sub-btn", ui.subMenu);
    cBtn.textContent = "Back";
    cBtn.addEventListener("click", closeSub);
  }

  function closeSub() {
    menuMode = "main";
    ui.subMenu.classList.add("hidden");
  }

  function switchTo(idx) {
    closeSub(); setMenuEnabled(false);
    activeIdx = idx;
    resetSprite(ui.pCanvas);
    updateBars(); updateMoveButtons();
    typeMsg("Go, " + G.species[getActive().speciesId].name + "!", function () {
      wildTurnThen(afterTurn);
    });
  }

  /* ── Catch ──────────────────────────────────────────────────────── */
  function wobbleWild(cb) {
    var cvs = ui.wCanvas;
    var totalSteps = 9, step = 0;
    cvs.style.transition = "transform 86ms ease-in-out";
    function tick() {
      if (!inBattle) return;
      if (step >= totalSteps) {
        cvs.style.transition = "";
        cb();
        return;
      }
      var phase = step % 3;
      var ang = phase === 0 ? -7 : (phase === 1 ? 7 : 0);
      cvs.style.transform = "rotate(" + ang + "deg)";
      step++;
      later(tick, 86);
    }
    tick();
  }

  function throwBall() {
    closeSub();
    if (G.state.inventory.balls <= 0) { typeMsg("No balls left!"); return; }
    G.state.inventory.balls--;
    setMenuEnabled(false);
    animBallThrow(function () {
      var resolve = function () {
        var chance = G.species[wild].catchRate * (1 - wildHp / wildMaxHp) / 255 + 0.1;
        if (Math.random() < chance) {
          G.state.dex.caught[wild] = true;
          if (G.state.party.length < 6) {
            var sp = G.species[wild];
            var hp = calcHp(sp.baseHp, wildLvl);
            G.state.party.push({
              speciesId: wild, level: wildLvl, hp: hp, maxHp: hp,
              moves: sp.moves.slice(0, 2).map(function (m) {
                return { name: m.name, power: m.power, type: m.type, pp: m.pp, maxPp: m.pp };
              }), xp: 0
            });
            G.party = G.state.party;
          }
          typeMsg("Gotcha! " + G.species[wild].name + " was caught!", function () {
            later(function () { hideOverlay(); }, 600);
          });
        } else {
          typeMsg("Oh no! It broke free!", function () { wildTurnThen(afterTurn); });
        }
      };
      if (performance.now() < entranceUntil) { resolve(); return; }
      wobbleWild(resolve);
    });
  }

  function animBallThrow(cb) {
    var ballDiv = el("div", "btl-ball", overlay);
    var start = { x: 120, y: 260 }, end = { x: 680, y: 100 };
    var step = 0, total = 20;
    var iv = setInterval(function () {
      step++;
      var t = step / total;
      var x = start.x + (end.x - start.x) * t;
      var y = start.y + (end.y - start.y) * t - Math.sin(t * Math.PI) * 100;
      ballDiv.style.left = x + "px";
      ballDiv.style.top = y + "px";
      if (step >= total) {
        clearInterval(iv);
        if (ballDiv.parentNode) ballDiv.parentNode.removeChild(ballDiv);
        cb();
      }
    }, 30);
  }

  /* ── Potion ─────────────────────────────────────────────────────── */
  function usePotion() {
    closeSub();
    if (G.state.inventory.potions <= 0) { typeMsg("No potions left!"); return; }
    var pm = getActive();
    if (pm.hp >= pm.maxHp) { typeMsg("HP is already full!"); return; }
    G.state.inventory.potions--;
    pm.hp = Math.min(pm.maxHp, pm.hp + 20);
    updateBars();
    setMenuEnabled(false);
    typeMsg(G.species[pm.speciesId].name + " recovered 20 HP!", function () {
      wildTurnThen(afterTurn);
    });
  }

  /* ── Run ─────────────────────────────────────────────────────────── */
  function tryRun() {
    if (menuMode !== "main") return;
    setMenuEnabled(false);
    var pm = getActive();
    var pSpd = G.species[pm.speciesId].baseSpd;
    var wSpd = G.species[wild].baseSpd;
    var chance = pSpd >= wSpd ? 0.7 : 0.35;
    if (Math.random() < chance) {
      typeMsg("Got away safely!", function () {
        later(function () { hideOverlay(); }, 400);
      });
    } else {
      typeMsg("Can't escape!", function () { wildTurnThen(afterTurn); });
    }
  }

  /* ── Keyboard ───────────────────────────────────────────────────── */
  document.addEventListener("keydown", function (e) {
    if (!inBattle) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (menuMode === "bag" || menuMode === "creature") closeSub();
      else tryRun();
      return;
    }
    if (menuMode !== "main") return;
    var n = parseInt(e.key);
    if (n >= 1 && n <= 4) pickMove(n - 1);
  });

  /* ── Entry point ────────────────────────────────────────────────── */
  G.startBattle = function (wildId) {
    if (inBattle) return;
    clearTimers();
    buildUI();

    wild = wildId;
    wildLvl = 3 + Math.floor(Math.random() * 5);
    var sp = G.species[wild];
    wildMaxHp = calcHp(sp.baseHp, wildLvl);
    wildHp = wildMaxHp;
    wildMoves = sp.moves.slice(0, 2);

    activeIdx = 0;
    for (var i = 0; i < G.state.party.length; i++) {
      if (G.state.party[i].hp > 0) { activeIdx = i; break; }
    }

    G.state.dex.seen[wildId] = true;
    menuMode = "main";
    live.over = false;
    flashP = 0;
    flashW = 0;
    lungeWho = null;
    lungeCb = null;
    lungeImpacted = true;
    flinchPStart = 0;
    flinchWStart = 0;
    shakeStart = 0;
    bannerTimerId = 0;

    showOverlay();
    updateBars();
    updateMoveButtons();
    setMenuEnabled(false);

    animFrameId = requestAnimationFrame(animLoop);

    var name = sp.name;
    if (G.world && G.world.showDialog) {
      G.world.showDialog("A wild " + name + " appeared!");
    }
    typeMsg("A wild " + name + " appeared!", function () {
      setMenuEnabled(true);
    });

    playEntrance();
  };
  G.drawCreature = drawCreature;
  G.drawArena = drawPlatform;
})(window.GAME);
