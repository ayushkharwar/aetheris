/**
 * js/world.js – Overworld engine for Aetheris: Creature Chronicles
 * IIFE, classic script, runs after js/data.js.
 * Exposes window.GAME.world = { player, showDialog, started }
 */
(function (G) {
  "use strict";
  if (G.world && G.world.started) return;

  var TILE = 32, CW = 960, CH = 600, STEP_MS = 120;
  var SOLID = { 2: 1, 4: 1, 5: 1, 6: 1 };
  var DX = [0, 0, -1, 1], DY = [1, -1, 0, 0];
  var encounterRng = G.helpers.rng(Date.now() & 0xffff);
  var wildRng = G.helpers.rng((Date.now() & 0xffff) ^ 0x9e37);

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  var $ = function (id) { return document.getElementById(id); };
  var $hudZone = $("hud-zone"), $hudCoords = $("hud-coords"), $hudParty = $("hud-party-summary");
  var $dialog = $("dialog"), $dlgText = $("dialog-text"), $dlgSpeaker = $("dialog-speaker"), $dlgPrompt = $("dialog-prompt");
  var $menu = $("menu"), $menuClose = $("btn-menu-close"), $menuContent = $("menu-content"), $btnSave = $("btn-save");
  var map = G.map;

  var player = {
    gx: map.spawn.x, gy: map.spawn.y,
    px: map.spawn.x * TILE, py: map.spawn.y * TILE,
    dir: 0, moving: false, tweenStart: 0,
    fromX: 0, fromY: 0, toX: 0, toY: 0, steps: 0, name: "Trainer"
  };

  var keys = {};
  document.addEventListener("keydown", function (e) { keys[e.key] = true; });
  document.addEventListener("keyup",   function (e) { keys[e.key] = false; });
  function dirPressed() {
    if (keys.ArrowUp || keys.w || keys.W) return 1;
    if (keys.ArrowDown || keys.s || keys.S) return 0;
    if (keys.ArrowLeft || keys.a || keys.A) return 2;
    if (keys.ArrowRight || keys.d || keys.D) return 3;
    return -1;
  }
  function isSolid(gx, gy) {
    return gx < 0 || gy < 0 || gx >= map.w || gy >= map.h || !!SOLID[map.tiles[gy * map.w + gx]];
  }

  var cam = { x: 0, y: 0 };
  function updateCamera() {
    cam.x = G.helpers.clamp(player.px + TILE / 2 - CW / 2, 0, map.w * TILE - CW);
    cam.y = G.helpers.clamp(player.py + TILE / 2 - CH / 2, 0, map.h * TILE - CH);
  }

  function tH(x, y) {
    var h = (x * 374761 + y * 668265) ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }

  function hash(gx, gy) {
    return ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
  }

  var C = {
    tgBase: "#327a2a", tgA: "#3b8c34", tgB: "#266620", tgC: "#44a03c",
    w1: "#3b8beb", w2: "#2870c8",
    path: "#c9a95e", pathSp: "#bfa050", pathEdge: "#b49238",
    bridgePlank: "#a08040", bridgeRail: "#6b4226", bridgeNail: "#888",
    trunk: "#6b4226", canopy: "#276e2b", canopyLt: "#3a9140",
    roof: "#b03030", roofMid: "#983838", roofLt: "#c04848", roofRidge: "#782020",
    roofShadow: "rgba(0,0,0,0.18)", chimney: "#706058", chimneyTop: "#504840",
    wall: "#d4c9a8", wallSh: "#b8ad8e", wallDk: "#a09478",
    door: "#6b4226", doorKnob: "#c8a84e", winF: "#607080", winG: "#a8d8ea",
    floor: "#e8dcc0",
    shade1: "#2a3a1e",
    shade2: "#1e2a16",
    highlight: "#8fd07a",
    waterDeep: "#1c4a7a",
    waterFoam: "#c8e8ff",
    bladeA: "#5fa843",
    bladeB: "#3f7a2c",
    outline: "#1b1520"
  };

  function olRect(x, y, w, h) {
    ctx.fillStyle = C.outline;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  function olArc(cx, cy, r, a0, a1) {
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();
  }

  function partRect(px, py, pw, ph, col) {
    ctx.fillStyle = C.outline;
    ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
    ctx.fillStyle = col;
    ctx.fillRect(px, py, pw, ph);
  }

  var tallList = [];
  for (var ti = 0; ti < 800; ti++) {
    tallList.push({ type: 0, gx: 0, gy: 0, sx: 0, sy: 0, bottom: 0, code: 0 });
  }
  var tallCount = 0;

  function addTallTile(code, gx, gy, sx, sy) {
    if (tallCount >= 800) return;
    var e = tallList[tallCount++];
    e.type = 0;
    e.code = code;
    e.gx = gx;
    e.gy = gy;
    e.sx = sx;
    e.sy = sy;
    e.bottom = gy * TILE + TILE;
  }

  function addTallPlayer() {
    if (tallCount >= 800) return;
    var e = tallList[tallCount++];
    e.type = 1;
    e.bottom = player.py + 26;
  }

  function sortTall() {
    var i, j, tmp;
    for (i = 1; i < tallCount; i++) {
      tmp = tallList[i];
      j = i - 1;
      while (j >= 0 && tallList[j].bottom > tmp.bottom) {
        tallList[j + 1] = tallList[j];
        j--;
      }
      tallList[j + 1] = tmp;
    }
  }

  var vignetteGrad = null;
  function drawVignette() {
    if (!vignetteGrad) {
      vignetteGrad = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.35, CW / 2, CH / 2, CH * 0.75);
      vignetteGrad.addColorStop(0, "rgba(0,0,0,0)");
      vignetteGrad.addColorStop(1, "rgba(0,0,0,0.18)");
    }
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, CW, CH);
  }

  /* ── Building helper: classify a tile-5 cell within its block ──── */
  function tileAt(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= map.w || gy >= map.h) return -1;
    return map.tiles[gy * map.w + gx];
  }
  function inBldg(gx, gy) { var t = tileAt(gx, gy); return t === 5 || t === 6; }

  /* scan the bottom row of the building this tile belongs to */
  function bldgBottom(gx, gy) {
    var by = gy;
    while (inBldg(gx, by + 1)) by++;
    var lx = gx, rx = gx;
    while (inBldg(lx - 1, by)) lx--;
    while (inBldg(rx + 1, by)) rx++;
    var w = rx - lx + 1;
    return { left: lx, right: rx, bottom: by, center: lx + ((w / 2) | 0), width: w };
  }

  function bldgBox(gx, gy) {
    var left = gx, right = gx, top = gy, bottom = gy, guard = 0;
    while (inBldg(left - 1, gy) && guard++ < 256) left--;
    guard = 0;
    while (inBldg(right + 1, gy) && guard++ < 256) right++;
    guard = 0;
    while (inBldg(left, top - 1) && guard++ < 256) top--;
    guard = 0;
    while (inBldg(left, bottom + 1) && guard++ < 256) bottom++;
    var w = right - left + 1, h = bottom - top + 1;
    return { left: left, right: right, top: top, bottom: bottom, w: w, h: h, doorX: left + ((w / 2) | 0) };
  }

  function isWaterNear(gx, gy) {
    return tileAt(gx - 1, gy) === 2 || tileAt(gx + 1, gy) === 2 ||
           tileAt(gx, gy - 1) === 2 || tileAt(gx, gy + 1) === 2;
  }
  var gS = ["#6abf4b", "#5fb843", "#72c654", "#64b848"];
  var fC = ["#e84060", "#e8d040", "#d860d0", "#f0f0f0"];

  function drawTile(code, sx, sy, t, gx, gy) {
    var h, b, bx, sway, f, ry, i, px, py, off, n, count, bh, top, sw, box, stag, vx, chx, chy, wx, wy, ww, wh, dx, dy, dw, dh;
    switch (code) {
      case 0:
        h = hash(gx, gy);
        ctx.fillStyle = gS[h & 3]; ctx.fillRect(sx, sy, TILE, TILE);
        ctx.fillStyle = C.bladeA; ctx.fillRect(sx, sy, TILE, 2);
        count = 3 + (h % 3);
        for (i = 0; i < count; i++) {
          px = sx + 3 + (hash(gx + i * 17, gy + i * 31) % 26);
          py = sy + 6 + (hash(gx + i * 13, gy + i * 19) % 22);
          ctx.fillStyle = C.bladeA; ctx.fillRect(px, py, 1, 1);
          ctx.fillStyle = C.bladeB; ctx.fillRect(px, py + 1, 1, 2);
        }
        break;
      case 1:
        h = hash(gx, gy);
        ctx.fillStyle = gS[h & 3]; ctx.fillRect(sx, sy, TILE, TILE);
        ctx.fillStyle = C.bladeA; ctx.fillRect(sx, sy, TILE, 2);
        count = 6 + (h % 3);
        sway = Math.round(Math.sin((t / 900) + (gx * 13 + gy * 7)) * 1);
        for (i = 0; i < count; i++) {
          b = hash(gx + i * 23, gy + i * 29);
          bx = sx + 3 + (b % 26);
          bh = 7 + (b % 4);
          top = sy + 24 - bh;
          ctx.fillStyle = C.bladeB;
          ctx.fillRect(bx, top + 3, 2, bh - 3);
          ctx.fillStyle = C.bladeA;
          ctx.fillRect(bx + sway, top, 2, 3);
        }
        break;
      case 2:
        ctx.fillStyle = C.w1; ctx.fillRect(sx, sy, TILE, TILE);
        ctx.fillStyle = C.w2; ctx.fillRect(sx, sy + 8, TILE, 12);
        ctx.fillStyle = C.waterDeep; ctx.fillRect(sx, sy + 20, TILE, 12);
        off = Math.floor((t / 40 + gx * 8 + gy * 5) % TILE);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = C.waterFoam;
        ctx.fillRect(sx + off, sy + 6, TILE - off, 1);
        ctx.fillRect(sx + ((off + 16) % TILE), sy + 18, TILE - ((off + 16) % TILE), 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.waterDeep;
        if (tileAt(gx - 1, gy) !== 2) ctx.fillRect(sx, sy, 1, TILE);
        if (tileAt(gx + 1, gy) !== 2) ctx.fillRect(sx + TILE - 1, sy, 1, TILE);
        if (tileAt(gx, gy - 1) !== 2) ctx.fillRect(sx, sy, TILE, 1);
        if (tileAt(gx, gy + 1) !== 2) ctx.fillRect(sx, sy + TILE - 1, TILE, 1);
        break;
      case 3:
        ctx.fillStyle = C.path; ctx.fillRect(sx, sy, TILE, TILE);
        if (isWaterNear(gx, gy)) {
          /* ── Bridge: planks + railing ── */
          ctx.fillStyle = C.bridgePlank;
          for (i = 0; i < 4; i++) {
            ry = sy + 2 + i * 8;
            ctx.fillRect(sx, ry, TILE, 6);
            ctx.fillStyle = C.pathEdge; ctx.fillRect(sx, ry + 5, TILE, 1); ctx.fillStyle = C.bridgePlank;
          }
          ctx.fillStyle = C.bridgeNail;
          for (i = 0; i < 4; i++) { ctx.fillRect(sx + 2, sy + 4 + i * 8, 2, 2); ctx.fillRect(sx + 28, sy + 4 + i * 8, 2, 2); }
          /* railings on sides adjacent to water */
          ctx.fillStyle = C.bridgeRail;
          if (tileAt(gx, gy - 1) === 2 || (!inBldg(gx, gy - 1) && tileAt(gx, gy - 1) !== 3)) ctx.fillRect(sx, sy, TILE, 3);
          if (tileAt(gx, gy + 1) === 2 || (!inBldg(gx, gy + 1) && tileAt(gx, gy + 1) !== 3)) ctx.fillRect(sx, sy + 29, TILE, 3);
          if (tileAt(gx - 1, gy) === 2) ctx.fillRect(sx, sy, 3, TILE);
          if (tileAt(gx + 1, gy) === 2) ctx.fillRect(sx + 29, sy, 3, TILE);
          /* railing posts */
          ctx.fillStyle = C.bridgeRail;
          ctx.fillRect(sx, sy, 3, 3); ctx.fillRect(sx + 29, sy, 3, 3);
          ctx.fillRect(sx, sy + 29, 3, 3); ctx.fillRect(sx + 29, sy + 29, 3, 3);
        } else {
          h = hash(gx, gy);
          count = 4 + (h % 3);
          ctx.fillStyle = C.pathSp;
          for (i = 0; i < count; i++) {
            px = sx + 4 + (hash(gx + i * 37, gy + i * 41) % 24);
            py = sy + 4 + (hash(gx + i * 43, gy + i * 47) % 24);
            n = 1 + (hash(gx + i * 53, gy + i * 59) & 1);
            ctx.fillRect(px, py, n, n);
          }
          if (tileAt(gx - 1, gy) === 0 || tileAt(gx - 1, gy) === 1) { ctx.fillStyle = C.pathEdge; ctx.fillRect(sx, sy, 1, TILE); }
          if (tileAt(gx + 1, gy) === 0 || tileAt(gx + 1, gy) === 1) { ctx.fillStyle = C.pathEdge; ctx.fillRect(sx + TILE - 1, sy, 1, TILE); }
          if (tileAt(gx, gy - 1) === 0 || tileAt(gx, gy - 1) === 1) { ctx.fillStyle = C.pathEdge; ctx.fillRect(sx, sy, TILE, 1); }
          if (tileAt(gx, gy + 1) === 0 || tileAt(gx, gy + 1) === 1) { ctx.fillStyle = C.pathEdge; ctx.fillRect(sx, sy + TILE - 1, TILE, 1); }
          ctx.fillStyle = C.shade1;
          if (tileAt(gx - 1, gy) === 2) ctx.fillRect(sx, sy, 2, TILE);
          if (tileAt(gx + 1, gy) === 2) ctx.fillRect(sx + TILE - 2, sy, 2, TILE);
          if (tileAt(gx, gy - 1) === 2) ctx.fillRect(sx, sy, TILE, 2);
          if (tileAt(gx, gy + 1) === 2) ctx.fillRect(sx, sy + TILE - 2, TILE, 2);
        }
        break;
      case 4:
        ctx.fillStyle = "rgba(0,0,0,0.20)";
        ctx.beginPath(); ctx.ellipse(sx + 16, sy + 30, 13, 4, 0, 0, 6.283); ctx.fill();
        partRect(sx + 12, sy + 16, 8, 16, C.trunk);
        ctx.fillStyle = C.shade2; ctx.fillRect(sx + 12, sy + 16, 2, 16);
        ctx.fillStyle = C.pathEdge; ctx.fillRect(sx + 19, sy + 16, 1, 16);
        sw = Math.round(Math.sin((t / 950) + (gx * 11 + gy * 3)) * 1);
        olArc(sx + 16 + sw, sy + 10, 11, 0, 6.283);
        olArc(sx + 8 + sw, sy + 14, 9, 0, 6.283);
        olArc(sx + 24 + sw, sy + 14, 9, 0, 6.283);
        ctx.fillStyle = C.canopy;
        ctx.beginPath(); ctx.arc(sx + 16 + sw, sy + 10, 10, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 8 + sw, sy + 14, 8, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 24 + sw, sy + 14, 8, 0, 6.283); ctx.fill();
        ctx.fillStyle = C.canopyLt;
        ctx.beginPath(); ctx.arc(sx + 11 + sw, sy + 7, 6, 0, 6.283); ctx.fill();
        ctx.fillStyle = C.highlight;
        ctx.beginPath(); ctx.arc(sx + 9 + sw, sy + 5, 3, 0, 6.283); ctx.fill();
        break;
      case 5:
      case 6:
        if (inBldg(gx, gy)) {
          box = bldgBox(gx, gy);
          if (gy !== box.bottom) {
            /* roof */
            for (ry = 0; ry < TILE; ry += 6) {
              var band = ((sy + ry) / 6) | 0;
              ctx.fillStyle = (band & 1) ? C.roofMid : C.roof;
              ctx.fillRect(sx, sy + ry, TILE, 6);
              stag = ((ry / 6) & 1) ? 3 : 0;
              ctx.fillStyle = C.roofShadow;
              for (vx = stag; vx < TILE; vx += 8) {
                ctx.fillRect(sx + vx, sy + ry, 1, 6);
              }
            }
            if (gy === box.top) {
              ctx.fillStyle = C.roofRidge; ctx.fillRect(sx, sy, TILE, 2);
            }
            if (gy === box.bottom - 1) {
              ctx.fillStyle = C.roofShadow; ctx.fillRect(sx, sy + TILE - 4, TILE, 4);
            }
            if (gx === box.left) {
              ctx.fillStyle = C.roofRidge; ctx.fillRect(sx, sy, 2, TILE);
            }
            if (gx === box.right) {
              ctx.fillStyle = C.roofRidge; ctx.fillRect(sx + TILE - 2, sy, 2, TILE);
            }
            if (gy === box.top && gx === box.left + ((box.w / 2) | 0) && ((box.left * 7 + box.top * 13) % 3 === 0)) {
              chx = sx + 10; chy = sy + 2;
              olRect(chx - 1, chy - 1, 14, 16);
              ctx.fillStyle = C.chimney; ctx.fillRect(chx, chy, 12, 14);
              ctx.fillStyle = C.chimneyTop; ctx.fillRect(chx - 1, chy - 2, 14, 2);
              ctx.fillStyle = C.wallSh; ctx.fillRect(chx, chy, 2, 2);
            }
          } else {
            /* wall bottom row */
            ctx.fillStyle = C.wall; ctx.fillRect(sx, sy, TILE, TILE);
            ctx.fillStyle = C.wallSh; ctx.fillRect(sx, sy, TILE, 1);
            ctx.fillStyle = C.wallDk; ctx.fillRect(sx, sy + TILE - 4, TILE, 4);
            ctx.fillStyle = C.roofShadow; ctx.fillRect(sx, sy + TILE - 4, TILE, 4);
            if (gx === box.doorX) {
              dx = sx + 10; dy = sy + 8; dw = 12; dh = 20;
              ctx.fillStyle = C.roofRidge;
              ctx.beginPath();
              ctx.moveTo(dx - 2, dy + dh);
              ctx.lineTo(dx - 2, dy + 6);
              ctx.quadraticCurveTo(dx - 2, dy - 2, dx + 6, dy - 2);
              ctx.quadraticCurveTo(dx + dw + 2, dy - 2, dx + dw + 2, dy + 6);
              ctx.lineTo(dx + dw + 2, dy + dh);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = C.door;
              ctx.beginPath();
              ctx.moveTo(dx, dy + dh);
              ctx.lineTo(dx, dy + 6);
              ctx.quadraticCurveTo(dx, dy, dx + 6, dy);
              ctx.quadraticCurveTo(dx + dw, dy, dx + dw, dy + 6);
              ctx.lineTo(dx + dw, dy + dh);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = C.doorKnob; ctx.fillRect(dx + dw - 4, dy + 12, 2, 2);
              ctx.fillStyle = C.wallDk; ctx.fillRect(dx - 2, sy + 28, dw + 4, 3);
            } else {
              wx = sx + 10; wy = sy + 10; ww = 12; wh = 9;
              ctx.fillStyle = C.winF; ctx.fillRect(wx, wy, ww, wh);
              ctx.fillStyle = C.winF; ctx.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
              ctx.fillStyle = C.winG;
              for (i = 0; i < 6; i++) ctx.fillRect(wx + 2 + i, wy + 2 + i, 1, 1);
            }
          }
        } else {
          if (code === 6) {
            ctx.fillStyle = C.floor; ctx.fillRect(sx, sy, TILE, TILE);
            ctx.fillStyle = C.wallSh; ctx.fillRect(sx + 15, sy + 15, 2, 2);
          } else {
            ctx.fillStyle = C.wall; ctx.fillRect(sx, sy, TILE, TILE);
            ctx.fillStyle = C.wallDk; ctx.fillRect(sx, sy + 28, TILE, 4);
          }
        }
        break;
      default:
        ctx.fillStyle = "#222"; ctx.fillRect(sx, sy, TILE, TILE);
    }
  }

  // ── Player sprite: 16×22 trainer ──────────────────────────────────
  function drawPlayer(sx, sy, dir, wf) {
    var baseX = sx + 8, baseY = sy + 10;
    var bob = wf ? -1 : 0;
    var x = baseX, y = baseY + bob;
    var legY = y + 16;

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse(baseX + 8, baseY + 22, 8, 3, 0, 0, 6.283); ctx.fill();

    if (wf) {
      partRect(x + 2, legY, 3, 6, "#3355aa");
      partRect(x + 11, legY, 3, 6, "#3355aa");
      ctx.fillStyle = "#4a70c8"; ctx.fillRect(x + 2, legY, 1, 6); ctx.fillRect(x + 11, legY, 1, 6);
    } else {
      partRect(x + 4, legY, 3, 6, "#3355aa");
      partRect(x + 9, legY, 3, 6, "#3355aa");
      ctx.fillStyle = "#4a70c8"; ctx.fillRect(x + 4, legY, 1, 6); ctx.fillRect(x + 9, legY, 1, 6);
    }

    if (wf) {
      partRect(x + 2, legY + 5, 4, 2, "#333");
      partRect(x + 11, legY + 5, 4, 2, "#333");
    } else {
      partRect(x + 4, legY + 5, 4, 2, "#333");
      partRect(x + 9, legY + 5, 4, 2, "#333");
    }

    partRect(x + 3, y + 8, 10, 9, "#e04040");
    ctx.fillStyle = "#ff6060"; ctx.fillRect(x + 3, y + 8, 2, 9); ctx.fillRect(x + 3, y + 8, 10, 1);
    ctx.fillStyle = "#b02828"; ctx.fillRect(x + 11, y + 8, 2, 9);

    if (dir === 2) {
      partRect(x + 12, y + 10, 2, 6, "#e04040");
      ctx.fillStyle = "#fdd8b5"; ctx.fillRect(x + 12, y + 15, 2, 2);
    } else if (dir === 3) {
      partRect(x + 2, y + 10, 2, 6, "#e04040");
      ctx.fillStyle = "#fdd8b5"; ctx.fillRect(x + 2, y + 15, 2, 2);
    } else {
      partRect(x + 1, y + 10, 2, 6, "#e04040");
      partRect(x + 13, y + 10, 2, 6, "#e04040");
      ctx.fillStyle = "#fdd8b5"; ctx.fillRect(x + 1, y + 15, 2, 2); ctx.fillRect(x + 13, y + 15, 2, 2);
    }

    partRect(x + 4, y + 3, 8, 7, "#fdd8b5");

    if (dir === 0) {
      ctx.fillStyle = "#222"; ctx.fillRect(x + 6, y + 6, 1, 2); ctx.fillRect(x + 10, y + 6, 1, 2);
    } else if (dir === 1) {
      ctx.fillStyle = "#6b4226"; ctx.fillRect(x + 5, y + 3, 6, 2);
    } else if (dir === 2) {
      ctx.fillStyle = "#222"; ctx.fillRect(x + 4, y + 6, 1, 2);
    } else {
      ctx.fillStyle = "#222"; ctx.fillRect(x + 11, y + 6, 1, 2);
    }

    partRect(x + 3, y + 0, 10, 4, "#2244aa");
    ctx.fillStyle = "#3355cc"; ctx.fillRect(x + 3, y + 0, 2, 1); ctx.fillRect(x + 3, y + 0, 1, 4);
    ctx.fillStyle = "#1a3388";
    if (dir === 0) {
      partRect(x + 2, y + 3, 12, 2, "#1a3388");
    } else if (dir === 1) {
      partRect(x + 4, y - 1, 8, 2, "#1a3388");
    } else if (dir === 2) {
      partRect(x - 1, y + 2, 6, 2, "#1a3388");
    } else {
      partRect(x + 10, y + 2, 6, 2, "#1a3388");
    }
    ctx.fillStyle = "#f0f0f0"; ctx.fillRect(x + 7, y + 1, 2, 1);
  }

  // ── Dialog ──────────────────────────────────────────────────────────
  var dlgActive = false, dlgTyping = false, dlgFull = "", dlgShown = "", dlgI = 0, dlgTimer = null;

  function showDialog(text) {
    if (dlgTimer) { clearInterval(dlgTimer); dlgTimer = null; }
    dlgFull = text; dlgShown = ""; dlgI = 0;
    dlgActive = true; dlgTyping = true;
    $dialog.classList.remove("hidden");
    $dlgSpeaker.textContent = "System"; $dlgPrompt.textContent = ""; $dlgText.textContent = "";
    dlgTimer = setInterval(function () {
      if (dlgI < dlgFull.length) { dlgShown += dlgFull[dlgI++]; $dlgText.textContent = dlgShown; }
      else { clearInterval(dlgTimer); dlgTimer = null; dlgTyping = false; $dlgPrompt.textContent = "[Space / Enter]"; }
    }, 25);
  }

  function advanceDialog() {
    if (dlgTyping) {
      clearInterval(dlgTimer); dlgTimer = null;
      $dlgText.textContent = dlgFull; dlgTyping = false; $dlgPrompt.textContent = "[Space / Enter]";
    } else if (dlgActive) {
      dlgActive = false; $dialog.classList.add("hidden");
    }
  }

  document.addEventListener("keydown", function (e) {
    if (dlgActive && (e.key === " " || e.key === "Enter")) { e.preventDefault(); advanceDialog(); }
  });
  $dialog.addEventListener("click", function () { if (dlgActive) advanceDialog(); });

  // ── Battle flash (#8) ──────────────────────────────────────────────
  var flashEl = null;
  function battleFlash(cb) {
    if (!flashEl) {
      flashEl = document.createElement("div");
      flashEl.style.cssText = "position:absolute;inset:0;background:#fff;z-index:50;pointer-events:none;display:none;";
      canvas.parentNode.appendChild(flashEl);
    }
    flashEl.style.display = "block";
    setTimeout(function () { flashEl.style.display = "none"; cb(); }, 150);
  }

  // ── Encounter (#1 fix) ─────────────────────────────────────────────
  function checkEncounter() {
    if (map.tiles[player.gy * map.w + player.gx] !== 1) return;
    if (encounterRng() < 0.12) {
      var sp = G.helpers.choice(wildRng, G.species);
      battleFlash(function () {
        if (typeof G.startBattle === "function") { G.startBattle(sp.id); return; }
        G.startBattle = function (id) { showDialog("A wild " + G.species[id].name + " appeared!"); };
        G.startBattle(sp.id);
      });
    }
  }

  // ── HUD ─────────────────────────────────────────────────────────────
  function updateHUD() {
    var party = G.party || [];
    $hudZone.textContent = map.name || G.REGION;
    $hudCoords.textContent = "X:" + player.gx + " Y:" + player.gy + " Steps:" + player.steps;
    $hudParty.textContent = "Party: " + party.length + "/6";
  }

  // ── Menu ────────────────────────────────────────────────────────────
  var menuOpen = false;
  function callUI(name) {
    if (G.ui && typeof G.ui[name] === "function") G.ui[name]();
    else console.log("GAME.ui." + name + "() – not yet implemented"); // TODO: pause-menu hooks
  }
  function toggleMenu() {
    menuOpen = !menuOpen;
    if (menuOpen) {
      $menu.classList.remove("hidden"); $menuContent.innerHTML = "";
      [["Continue", function () { toggleMenu(); }],
       ["Bestiary", function () { callUI("Pokedex"); }],
       ["Guide",    function () { callUI("Guide"); }],
       ["Save",     function () { callUI("Save"); }]
      ].forEach(function (b) {
        var el = document.createElement("button");
        el.className = "btn"; el.textContent = b[0]; el.addEventListener("click", b[1]);
        $menuContent.appendChild(el);
      });
    } else { $menu.classList.add("hidden"); }
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); if (!dlgActive) toggleMenu(); }
  });
  $menuClose.addEventListener("click", function () { if (menuOpen) toggleMenu(); });
  $btnSave.addEventListener("click", function () { if (!menuOpen) toggleMenu(); });
  $("tab-party").addEventListener("click",     function () { callUI("Party"); });
  $("tab-inventory").addEventListener("click",  function () { callUI("Inventory"); });
  $("tab-dex").addEventListener("click",        function () { callUI("Pokedex"); });
  $("tab-system").addEventListener("click",     function () { callUI("System"); });

  // ── Game loop ───────────────────────────────────────────────────────
  function update(now) {
    if (menuOpen || dlgActive) return;
    if (player.moving) {
      var t = Math.min((now - player.tweenStart) / STEP_MS, 1);
      player.px = player.fromX + (player.toX - player.fromX) * t;
      player.py = player.fromY + (player.toY - player.fromY) * t;
      if (t >= 1) {
        player.px = player.toX; player.py = player.toY;
        player.moving = false; player.steps++;
        checkEncounter(); updateHUD();
      }
      return;
    }
    var d = dirPressed();
    if (d < 0) return;
    player.dir = d;
    var nx = player.gx + DX[d], ny = player.gy + DY[d];
    if (isSolid(nx, ny)) return;
    player.fromX = player.gx * TILE; player.fromY = player.gy * TILE;
    player.gx = nx; player.gy = ny;
    player.toX = nx * TILE; player.toY = ny * TILE;
    player.moving = true; player.tweenStart = performance.now();
  }

  function draw(now) {
    ctx.clearRect(0, 0, CW, CH);
    updateCamera();
    var sx0 = Math.floor(cam.x / TILE), sy0 = Math.floor(cam.y / TILE);
    var sx1 = Math.min(sx0 + Math.ceil(CW / TILE) + 1, map.w);
    var sy1 = Math.min(sy0 + Math.ceil(CH / TILE) + 1, map.h);
    var ty, tx, code, sx, sy;
    tallCount = 0;
    for (ty = sy0; ty < sy1; ty++) {
      for (tx = sx0; tx < sx1; tx++) {
        code = map.tiles[ty * map.w + tx];
        sx = tx * TILE - cam.x;
        sy = ty * TILE - cam.y;
        if (code === 4 || code === 5 || code === 6) {
          drawTile(0, sx, sy, now, tx, ty);
          addTallTile(code, tx, ty, sx, sy);
        } else {
          drawTile(code, sx, sy, now, tx, ty);
        }
      }
    }
    addTallPlayer();
    sortTall();
    for (var i = 0; i < tallCount; i++) {
      var e = tallList[i];
      if (e.type === 1) {
        drawPlayer(Math.round(player.px - cam.x), Math.round(player.py - cam.y),
                   player.dir, player.moving ? (Math.floor(now / 100) & 1) : 0);
      } else {
        drawTile(e.code, e.sx, e.sy, now, e.gx, e.gy);
      }
    }
    drawVignette();
  }

  function loop(now) { update(now); draw(now); requestAnimationFrame(loop); }

  // ── Boot ────────────────────────────────────────────────────────────
  function init() {
    if (G.world && G.world.started) return;
    player.px = player.gx * TILE; player.py = player.gy * TILE;
    updateHUD();
    G.world = { player: player, showDialog: showDialog, updateHUD: updateHUD, started: true };
    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.GAME);
