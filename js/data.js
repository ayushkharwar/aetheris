window.GAME = window.GAME || {};

(function (G) {
  "use strict";

  G.REGION = "Verdant Hollow";

  G.helpers = {
    rng: function (seed) {
      var s = (seed >>> 0) || 1;
      return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        var t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    randInt: function (rng, a, b) {
      var min = Math.ceil(Math.min(a, b));
      var max = Math.floor(Math.max(a, b));
      return Math.floor(rng() * (max - min + 1)) + min;
    },
    choice: function (rng, arr) {
      if (!arr || !arr.length) return undefined;
      return arr[Math.floor(rng() * arr.length)];
    },
    clamp: function (v, a, b) {
      return v < a ? a : v > b ? b : v;
    }
  };

  G.typeChart = {
    Fire:     { Fire: 0.5, Water: 0.5, Grass: 2.0, Normal: 1.0, Electric: 1.0 },
    Water:    { Fire: 2.0, Water: 0.5, Grass: 0.5, Normal: 1.0, Electric: 0.5 },
    Grass:    { Fire: 0.5, Water: 2.0, Grass: 0.5, Normal: 1.0, Electric: 1.0 },
    Normal:   { Fire: 1.0, Water: 1.0, Grass: 1.0, Normal: 1.0, Electric: 1.0 },
    Electric: { Fire: 1.0, Water: 2.0, Grass: 0.5, Normal: 1.0, Electric: 0.5 }
  };

  var M = {
    scratch:   { name: "Claw Swipe",  power: 40, type: "Normal",   pp: 30 },
    bodySlam:  { name: "Heavy Slam",  power: 65, type: "Normal",   pp: 15 },
    swiftStrike:{ name: "Swift Dash", power: 50, type: "Normal",   pp: 25 },
    ember:     { name: "Cinder Spit", power: 45, type: "Fire",     pp: 25 },
    flameBurst:{ name: "Blaze Surge", power: 75, type: "Fire",     pp: 12 },
    scorch:    { name: "Magma Bite",  power: 60, type: "Fire",     pp: 18 },
    aquaJet:   { name: "Rill Splash", power: 45, type: "Water",    pp: 25 },
    tidalWave: { name: "Torrential",  power: 75, type: "Water",    pp: 12 },
    brineSnap: { name: "Brine Snap",  power: 60, type: "Water",    pp: 18 },
    leafCut:   { name: "Briar Lash",  power: 45, type: "Grass",    pp: 25 },
    solarBloom:{ name: "Thorn Surge", power: 75, type: "Grass",    pp: 12 },
    sporeWhip: { name: "Canopy Slap", power: 60, type: "Grass",    pp: 18 },
    spark:     { name: "Static Jolt", power: 45, type: "Electric", pp: 25 },
    voltCrash: { name: "Arc Burst",   power: 75, type: "Electric", pp: 12 },
    pulseZing: { name: "Pulse Snap",  power: 60, type: "Electric", pp: 18 }
  };

  function cloneMoves(list) {
    return list.map(function (m) {
      return { name: m.name, power: m.power, type: m.type, pp: m.pp };
    });
  }

  G.species = [
    {
      id: 0, name: "Pyrokit", type: "Fire",
      baseHp: 48, baseAtk: 58, baseDef: 44, baseSpd: 64, catchRate: 180,
      moves: cloneMoves([M.scratch, M.ember, M.scorch]),
      palette: ["#ff595e", "#ffca3a", "#6a1b1a"]
    },
    {
      id: 1, name: "Cinderlynx", type: "Fire",
      baseHp: 74, baseAtk: 88, baseDef: 66, baseSpd: 92, catchRate: 75,
      moves: cloneMoves([M.swiftStrike, M.scorch, M.flameBurst]),
      palette: ["#d62828", "#f77f00", "#fcbf49"]
    },
    {
      id: 2, name: "Aquapup", type: "Water",
      baseHp: 54, baseAtk: 50, baseDef: 56, baseSpd: 52, catchRate: 180,
      moves: cloneMoves([M.scratch, M.aquaJet, M.brineSnap]),
      palette: ["#1982c4", "#8ac926", "#caf0f8"]
    },
    {
      id: 3, name: "Tidehound", type: "Water",
      baseHp: 84, baseAtk: 78, baseDef: 82, baseSpd: 74, catchRate: 75,
      moves: cloneMoves([M.bodySlam, M.brineSnap, M.tidalWave]),
      palette: ["#00509d", "#00b4d8", "#90e0ef"]
    },
    {
      id: 4, name: "Briarling", type: "Grass",
      baseHp: 56, baseAtk: 52, baseDef: 60, baseSpd: 46, catchRate: 180,
      moves: cloneMoves([M.scratch, M.leafCut, M.sporeWhip]),
      palette: ["#52b788", "#d8f3dc", "#2d6a4f"]
    },
    {
      id: 5, name: "Thornstag", type: "Grass",
      baseHp: 86, baseAtk: 82, baseDef: 88, baseSpd: 68, catchRate: 75,
      moves: cloneMoves([M.bodySlam, M.sporeWhip, M.solarBloom]),
      palette: ["#2d6a4f", "#74c69d", "#b7e4c7"]
    },
    {
      id: 6, name: "Mossbun", type: "Normal",
      baseHp: 50, baseAtk: 48, baseDef: 45, baseSpd: 62, catchRate: 220,
      moves: cloneMoves([M.scratch, M.swiftStrike, M.leafCut]),
      palette: ["#ddb892", "#ede0d4", "#7f5539"]
    },
    {
      id: 7, name: "Burrowl", type: "Normal",
      baseHp: 78, baseAtk: 76, baseDef: 72, baseSpd: 80, catchRate: 110,
      moves: cloneMoves([M.swiftStrike, M.bodySlam, M.scorch]),
      palette: ["#9c6644", "#e6ccb2", "#432818"]
    },
    {
      id: 8, name: "Zaphare", type: "Electric",
      baseHp: 46, baseAtk: 60, baseDef: 42, baseSpd: 78, catchRate: 170,
      moves: cloneMoves([M.scratch, M.spark, M.pulseZing]),
      palette: ["#ffd166", "#fff3b0", "#5c4d7d"]
    },
    {
      id: 9, name: "Voltraptor", type: "Electric",
      baseHp: 70, baseAtk: 90, baseDef: 64, baseSpd: 102, catchRate: 65,
      moves: cloneMoves([M.swiftStrike, M.pulseZing, M.voltCrash]),
      palette: ["#ffb703", "#fb8500", "#219ebc"]
    },
    {
      id: 10, name: "Dewshell", type: "Water",
      baseHp: 68, baseAtk: 54, baseDef: 85, baseSpd: 38, catchRate: 130,
      moves: cloneMoves([M.aquaJet, M.brineSnap, M.bodySlam]),
      palette: ["#48cae4", "#ade8f4", "#023e8a"]
    },
    {
      id: 11, name: "Emberkeet", type: "Fire",
      baseHp: 58, baseAtk: 72, baseDef: 50, baseSpd: 86, catchRate: 120,
      moves: cloneMoves([M.ember, M.swiftStrike, M.flameBurst]),
      palette: ["#f94144", "#f8961e", "#f9c74f"]
    }
  ];

  G.makeMap = function () {
    var w = 60;
    var h = 40;
    var tiles = new Uint8Array(w * h);
    var rng = G.helpers.rng(20260405);
    var townRect = { x: 4, y: 12, w: 20, h: 16 };
    var x, y, i;

    function idx(tx, ty) {
      return ty * w + tx;
    }

    function setTile(tx, ty, code) {
      if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
        tiles[idx(tx, ty)] = code;
      }
    }

    function fillRect(rx, ry, rw, rh, code) {
      for (var yy = ry; yy < ry + rh; yy++) {
        for (var xx = rx; xx < rx + rw; xx++) {
          setTile(xx, yy, code);
        }
      }
    }

    // 1. Base grass
    fillRect(0, 0, w, h, 0);

    // 2. Perimeter forest bands
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var edgeDist = Math.min(x, y, w - 1 - x, h - 1 - y);
        if (edgeDist < 2 || (edgeDist === 2 && rng() < 0.65) || (edgeDist === 3 && rng() < 0.25)) {
          setTile(x, y, 4);
        }
      }
    }

    // 3. Interior forest clusters
    var treeClusters = [
      { x: 10, y: 5,  r: 3 },
      { x: 24, y: 7,  r: 3 },
      { x: 14, y: 33, r: 3 },
      { x: 44, y: 7,  r: 4 },
      { x: 51, y: 20, r: 4 },
      { x: 45, y: 32, r: 4 }
    ];
    for (i = 0; i < treeClusters.length; i++) {
      var tc = treeClusters[i];
      for (y = tc.y - tc.r; y <= tc.y + tc.r; y++) {
        for (x = tc.x - tc.r; x <= tc.x + tc.r; x++) {
          var d2 = (x - tc.x) * (x - tc.x) + (y - tc.y) * (y - tc.y);
          if (d2 <= tc.r * tc.r && rng() < 0.78) {
            setTile(x, y, 4);
          }
        }
      }
    }

    // 4. Tall grass patches for wild creature encounters
    var grassPatches = [
      { x: 6,  y: 5,  w: 11, h: 5 },
      { x: 6,  y: 30, w: 14, h: 6 },
      { x: 23, y: 28, w: 6,  h: 8 },
      { x: 36, y: 5,  w: 10, h: 9 },
      { x: 37, y: 15, w: 12, h: 7 },
      { x: 36, y: 26, w: 12, h: 9 },
      { x: 49, y: 10, w: 7,  h: 18 }
    ];
    for (i = 0; i < grassPatches.length; i++) {
      var gp = grassPatches[i];
      for (y = gp.y; y < gp.y + gp.h; y++) {
        for (x = gp.x; x < gp.x + gp.w; x++) {
          if (tiles[idx(x, y)] === 0 && rng() < 0.82) {
            setTile(x, y, 1);
          }
        }
      }
    }

    // 5. Clear town area to grass
    fillRect(townRect.x, townRect.y, townRect.w, townRect.h, 0);

    // 6. Vertical meandering river (water = 2)
    for (y = 0; y < h; y++) {
      var center = 31 + Math.round(Math.sin(y * 0.25) * 1.5);
      for (x = center - 1; x <= center + 2; x++) {
        setTile(x, y, 2);
      }
    }

    // 7. Main path road & bridge crossing the river (path = 3)
    fillRect(8, 19, 38, 2, 3);
    // North-south town avenues
    fillRect(9, 17, 2, 7, 3);
    fillRect(17, 17, 2, 7, 3);
    // East wilderness trail branches
    fillRect(44, 10, 2, 20, 3);

    // 8. Three small buildings in town (building walls = 5, floor inside = 6, door = 6)
    var buildings = [
      { x: 6,  y: 13, w: 6, h: 5, doorX: 9,  doorY: 17 },
      { x: 15, y: 13, w: 6, h: 5, doorX: 17, doorY: 17 },
      { x: 10, y: 22, w: 7, h: 5, doorX: 13, doorY: 22 }
    ];

    for (i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      fillRect(b.x, b.y, b.w, b.h, 5);
      fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 6);
      setTile(b.doorX, b.doorY, 6);
    }

    // Connect third building door to main road
    fillRect(13, 21, 2, 1, 3);

    // 9. Spawn point guaranteed on walkable path
    var spawn = { x: 12, y: 19 };
    setTile(spawn.x, spawn.y, 3);

    return {
      w: w,
      h: h,
      tiles: tiles,
      spawn: spawn,
      townRect: townRect,
      name: G.REGION
    };
  };

  G.map = G.makeMap();
})(window.GAME);
