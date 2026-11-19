// Champion of the Wildlings. You arrive in the city of Crownhaven by train, choose a starter Wildling,
// and climb the League from Rank 100 all the way to Champion. Battles happen in real time.
// The Wildlings are in creatures.js. This file runs the game on a flat map; view3d.js shows it all in 3D.

const VIEW_W = 480;
const VIEW_H = 320;
const el = (id) => document.getElementById(id);
const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]];

function sound(make) {
  try { make(); } catch (error) { /* no sound: the game still works */ }
}
const sfx = {
  step: () => sound(() => playTone(0, 0.05, 500, 700, 0.06)),
  hit: () => sound(() => playTone(0, 0.1, 260, 110, 0.16)),
  zap: () => sound(() => playTone(0, 0.12, 900, 1500, 0.07)),
  warn: () => sound(() => playTone(0, 0.08, 700, 500, 0.05)),
  boom: () => sound(() => { playNoise(0, 0.35, 700, 120, 0.22); playTone(0, 0.3, 160, 60, 0.16); }),
  orb: () => sound(() => { playTone(0, 0.1, 500, 900, 0.1); playTone(0.15, 0.1, 500, 900, 0.1); }),
  good: () => sound(() => { playTone(0, 0.12, 880, 1320, 0.14); playTone(0.12, 0.18, 1320, 1760, 0.12); }),
  alert: () => sound(() => { playTone(0, 0.1, 300, 600, 0.12); playTone(0.1, 0.1, 300, 600, 0.12); playTone(0.2, 0.2, 400, 900, 0.12); }),
  surge: () => sound(() => { playTone(0, 0.5, 200, 1200, 0.16); playNoise(0, 0.5, 600, 3000, 0.1); }),
  win: () => sound(() => playJingle()),
};

// ----- Outfits: everything you can choose in the outfit designer -----
const OUTFIT = {
  skin: ["#f6d3b0", "#f2c79a", "#dba878", "#b9805a", "#8a5a3a", "#5c3b28"],
  hairStyle: ["short", "long", "ponytail", "spiky", "bun", "bald"],
  hair: ["#2b2118", "#4a3020", "#7a4a26", "#c8a04a", "#e8d8a0", "#d8483a", "#3ab8e8", "#e870b0", "#8a5ad0", "#e8e8f0"],
  hat: ["none", "cap", "beanie"],
  hatColour: ["#e0503a", "#3a6ad8", "#2a2c36", "#ffd84a", "#3aa858", "#ffffff", "#e870b0"],
  topStyle: ["T-shirt", "hoodie", "jacket"],
  top: ["#e0503a", "#3a6ad8", "#3aa858", "#ffd84a", "#ffffff", "#2a2c36", "#e870b0", "#8a5ad0", "#ff9a3a", "#3ab8c8"],
  bottomStyle: ["trousers", "shorts", "skirt"],
  bottom: ["#3a5a8a", "#2a2c36", "#8a6a4a", "#d8d0c0", "#4a7a4a", "#8a2a3a", "#e870b0", "#5a4a8a"],
  shoes: ["#2a2020", "#ffffff", "#e0503a", "#3a6ad8", "#ffd84a", "#8a5a3a"],
};
const OUTFIT_ROWS = [["skin", "Skin"], ["hairStyle", "Hair style"], ["hair", "Hair colour"], ["hat", "Hat"], ["hatColour", "Hat colour"], ["topStyle", "Top"], ["top", "Top colour"], ["bottomStyle", "Bottoms"], ["bottom", "Bottoms colour"], ["shoes", "Shoes"]];
const firstOutfit = () => ({ skin: 1, hairStyle: 0, hair: 1, hat: 0, hatColour: 0, topStyle: 0, top: 0, bottomStyle: 0, bottom: 0, shoes: 0 });
function randomOutfit() {
  const outfit = {};
  for (const part in OUTFIT) outfit[part] = Math.floor(Math.random() * OUTFIT[part].length);
  return outfit;
}
const canvas = el("game");
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const darkCopies = new Map();
const darkCopy = (img) => darkCopies.get(img) || darkCopies.set(img, tinted(img, "#1a1238")).get(img);
const whiteCopies = new Map();
const whiteCopy = (img) => whiteCopies.get(img) || whiteCopies.set(img, tinted(img, "#ffffff")).get(img);

// ----- The city -----
// Crownhaven is a round city. Ring roads circle the tower in the middle, and avenues run out from it
// like the spokes of a wheel. It is a grid of squares; each square is street, grass, water, building...
const CW = 336, CH = 336, MID = 168, CITY_R = 156;
const STREET = 0, PLAZA = 1, GRASS = 2, TALL = 3, YARD = 4, POND = 5, WALL = 6, TREE = 7, OUT = 8, LOT = 9;
const tiles = Array.from({ length: CH }, () => new Uint8Array(CW));
const fromMid = (tx, ty) => Math.hypot(tx + 0.5 - MID, ty + 0.5 - MID);
const turnOf = (tx, ty) => ((Math.atan2(ty + 0.5 - MID, tx + 0.5 - MID) * 180) / Math.PI + 360) % 360;      // the angle round the city, in degrees
const polar = (deg, r) => ({ x: MID + Math.cos((deg * Math.PI) / 180) * r, y: MID + Math.sin((deg * Math.PI) / 180) * r });
const RINGS = [23, 45, 67, 89, 111, 133, 154.5];        // how far out each ring boulevard is, in squares
const AVENUES = [];          // every avenue: the way it points (in degrees) and how far from the middle it starts
for (let k = 0; k < 12; k++) AVENUES.push({ deg: k * 30, from: 15 });
for (let k = 0; k < 12; k++) AVENUES.push({ deg: k * 30 + 15, from: 67 });        // (the outer city has extra avenues in between)
const PARKS = [          // (the numbers in "kinds" are types: 0 Fire, 1 Water, 2 Grass, 3 Electric, 4 Ice, 5 Rock, 6 Flying, 7 Fighting, 8 Psychic, 9 Dark, 10 Dragon, 11 Fairy)
  { name: "Clover Park", at: polar(104, 138), r: 10, kinds: [2, 6, 3], lv: [2, 5] },
  { name: "Sunny Meadow", at: polar(25, 100), r: 11, kinds: [2, 11, 3], lv: [5, 9] },
  { name: "Mirror Pond", at: polar(45, 56), r: 11, kinds: [1, 11], lv: [7, 12], pond: true },
  { name: "Windy Green", at: polar(190, 78), r: 12, kinds: [6, 7, 3], lv: [11, 17] },
  { name: "Stone Court", at: polar(140, 100), r: 11, kinds: [5, 7, 9], lv: [13, 20] },
  { name: "Ember Yard", at: polar(255, 100), r: 12, kinds: [0, 5], lv: [16, 24] },
  { name: "Frost Garden", at: polar(315, 122), r: 12, kinds: [4, 8], lv: [22, 31], pond: true },
  { name: "Gloom Garden", at: polar(165, 143), r: 10, kinds: [9, 10, 8], lv: [28, 40] },
];
const inPark = (park, tx, ty) => Math.hypot(tx + 0.5 - park.at.x, ty + 0.5 - park.at.y) < park.r;
const BATTLE_ZONES = [{ name: "the South Quarter", from: 60, to: 120 }, { name: "the West Quarter", from: 150, to: 210 }, { name: "the East Quarter", from: 330, to: 390 }, { name: "the North Quarter", from: 240, to: 300 }];
const inZone = function (zone, tx, ty) {
  const d = fromMid(tx, ty), turn = (turnOf(tx, ty) - zone.from + 720) % 360;
  return d > 23 && d < 134 && turn <= zone.to - zone.from;
};
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
  const d = fromMid(x, y), dx = x + 0.5 - MID, dy = y + 0.5 - MID;
  let kind = LOT;
  if (d > CITY_R) kind = OUT;
  else if (d < 16) kind = PLAZA;
  else {
    // seven ring boulevards, and avenues running outwards (all 3 squares wide)
    let road = RINGS.some((r) => Math.abs(d - r) < 1.5);
    for (const avenue of AVENUES) {
      const a = (avenue.deg * Math.PI) / 180, along = dx * Math.cos(a) + dy * Math.sin(a), off = Math.abs(dy * Math.cos(a) - dx * Math.sin(a));
      if (along > avenue.from && off < 1.5) road = true;
    }
    if (road) kind = STREET;
    else if (Math.abs(y + 0.5 - (MID - 36 + Math.sin(x / 14) * 5)) < 2.5) kind = POND;        // the river (streets cross it on bridges)
  }
  tiles[y][x] = kind;
}
for (const park of PARKS) {
  for (let y = Math.floor(park.at.y - park.r); y <= park.at.y + park.r; y++) for (let x = Math.floor(park.at.x - park.r); x <= park.at.x + park.r; x++) {
    const d = Math.hypot(x + 0.5 - park.at.x, y + 0.5 - park.at.y);
    if (d >= park.r) continue;
    tiles[y][x] = park.pond && d < park.r * 0.36 ? POND : d < park.r - 1.5 && hash(x, y, 3) < 0.07 ? TREE : hash(Math.floor(x / 3), Math.floor(y / 2), 4) < 0.55 ? TALL : GRASS;
  }
}
for (let y = MID - 2; y < MID + 2; y++) for (let x = MID - 2; x < MID + 2; x++) tiles[y][x] = WALL;      // the tower
// Fill every empty lot with buildings, packed side by side like city terraces
const buildings = [];
const SIZES = [[6, 5], [5, 6], [5, 5], [5, 4], [4, 5], [4, 4], [4, 3], [3, 4], [3, 3]];       // biggest first, so the rows come out regular
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
  if (tiles[y][x] !== LOT) continue;
  let placed = false;
  for (let n = 0; n < SIZES.length && !placed; n++) {
    const [w, h] = SIZES[n];
    let fits = x + w <= CW && y + h <= CH;
    for (let ty = y; ty < y + h && fits; ty++) for (let tx = x; tx < x + w && fits; tx++) fits = tiles[ty][tx] === LOT;
    if (!fits) continue;
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) tiles[ty][tx] = WALL;
    buildings.push({ x: x, y: y, w: w, h: h, floors: (fromMid(x, y) < 45 ? 3 : 2) + (hash(x, y, 10) < 0.3 ? 1 : 0), tint: Math.floor(hash(x, y, 11) * 2), shop: Math.floor(hash(x, y, 12) * 3), lit: hash(x, y, 13) < 0.6, cafe: false });
    placed = true;
  }
  if (!placed) tiles[y][x] = YARD;       // (a bit of clean pavement between buildings)
}
// Cafes: the building nearest each of these spots that has a street along its south side
const cafes = [];
// (Each one is: the way to it in degrees, how far out it is, and "true" for a shop, where you sell star shards and buy capture orbs. The rest are cafes, which heal your team.)
for (const [deg, r, isShop] of [[94, 148], [84, 148, true], [187, 49], [277, 49, true], [52, 93], [142, 71, true], [232, 93], [322, 71], [7, 49], [260, 137], [20, 137, true], [170, 115], [215, 137, true], [320, 137], [120, 115], [300, 100, true]]) {
  const want = polar(deg, r);
  const best = buildings.filter((b) => !b.cafe && b.y + b.h < CH && tiles[b.y + b.h][b.x + Math.floor(b.w / 2)] === STREET).sort((a, b) => Math.hypot(a.x - want.x, a.y - want.y) - Math.hypot(b.x - want.x, b.y - want.y))[0];
  best.cafe = true;
  best.mart = !!isShop;
  cafes.push({ x: (best.x + best.w / 2) * TILE, y: (best.y + best.h) * TILE + 9, shop: !!isShop });
}
const lamps = [], trees = [];
for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) if (tiles[y][x] === TREE) trees.push({ x: x * TILE + 8, y: y * TILE + 8 });
// Street lamps stand in neat rows along the kerbs of the ring boulevards
for (const r of RINGS.slice(0, 6)) for (let k = 0; k < (r > 80 ? 48 : 24); k++) {
  const spot = polar((k + 0.5) * (r > 80 ? 7.5 : 15), r + (k % 2 ? 1.75 : -1.75));
  lamps.push({ x: spot.x * TILE, y: spot.y * TILE });
}
const tileAt = (px, py) => {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= CW || ty >= CH ? OUT : tiles[ty][tx];
};
const solid = (px, py) => tileAt(px, py) >= POND;
const canStand = (x, y) => !solid(x - 4, y - 5) && !solid(x + 4, y - 5) && !solid(x - 4, y + 1) && !solid(x + 4, y + 1);
const START = { x: MID * TILE + 8, y: (MID + 152) * TILE + 8 };        // just inside the south gate, by the railway station
const STATION = { x: MID * TILE, y: (MID + 160) * TILE };              // the platform, outside the city wall
const OFFICIAL = { x: MID * TILE, y: (MID + 7) * TILE, name: "League Master Orla", outfit: { skin: 2, hairStyle: 1, hair: 9, hat: 0, hatColour: 0, topStyle: 2, top: 1, bottomStyle: 0, bottom: 1, shoes: 0 } };

// ----- The map -----
// A little picture of the whole city, painted once: roads, parks, the river, cafes, shops and the tower.
// Two map pixels are one square of the city.
const cityMap = makeCanvas(CW * 2, CH * 2);
(function () {
  const g = cityMap.getContext("2d"), mid = MID * 2;
  g.fillStyle = "#2c4a34";
  g.fillRect(0, 0, CW * 2, CH * 2);
  g.fillStyle = "#b4a992";
  g.beginPath();
  g.arc(mid, mid, CITY_R * 2 + 2, 0, 6.2832);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(mid, mid, CITY_R * 2, 0, 6.2832);
  g.clip();
  g.strokeStyle = "#4a90e0";
  g.lineWidth = 10;
  g.beginPath();
  for (let x = 0; x <= CW; x++) g.lineTo(x * 2, (MID - 36 + Math.sin(x / 14) * 5) * 2);
  g.stroke();
  g.restore();
  g.strokeStyle = "#f6f2e8";
  g.lineWidth = 6;
  for (const r of RINGS) {
    g.beginPath();
    g.arc(mid, mid, r * 2, 0, 6.2832);
    g.stroke();
  }
  for (const avenue of AVENUES) {
    const a = (avenue.deg * Math.PI) / 180;
    g.beginPath();
    g.moveTo(mid + Math.cos(a) * avenue.from * 2, mid + Math.sin(a) * avenue.from * 2);
    g.lineTo(mid + Math.cos(a) * CITY_R * 2, mid + Math.sin(a) * CITY_R * 2);
    g.stroke();
  }
  g.fillStyle = "#f4dc90";
  g.beginPath();
  g.arc(mid, mid, 32, 0, 6.2832);
  g.fill();
  for (const park of PARKS) {
    g.fillStyle = "#6cc860";
    g.beginPath();
    g.arc(park.at.x * 2, park.at.y * 2, park.r * 2, 0, 6.2832);
    g.fill();
    g.strokeStyle = "#2f8a3c";
    g.lineWidth = 2;
    g.stroke();
    if (park.pond) {
      g.fillStyle = "#4a90e0";
      g.beginPath();
      g.arc(park.at.x * 2, park.at.y * 2, park.r * 0.72, 0, 6.2832);
      g.fill();
    }
  }
  g.fillStyle = "#3a4a8a";
  g.beginPath();
  g.arc(mid, mid, 7, 0, 6.2832);
  g.fill();
  g.fillStyle = "#9fe8ff";
  g.beginPath();
  g.arc(mid, mid, 3, 0, 6.2832);
  g.fill();
  for (const cafe of cafes) {
    const x = Math.round(cafe.x / 8), y = Math.round(cafe.y / 8) - 4;
    g.fillStyle = "#ffffff";
    g.fillRect(x - 4, y - 4, 9, 9);
    g.fillStyle = cafe.shop ? "#3a6ad8" : "#2f9a4c";          // green cross: a cafe. Blue square: a shop.
    g.fillRect(x - 1, y - 3, 3, 7);
    g.fillRect(x - 3, y - 1, 7, 3);
    if (cafe.shop) g.fillRect(x - 3, y - 3, 7, 7);
  }
})();
// Draw the map in a square on the screen: centred on (cx, cy) in city squares, showing "across" squares.
function drawMap(x, y, size, cx, cy, across, goal) {
  const k = size / (across * 2);         // how big one map pixel is on the screen
  const toScreen = (px, py) => [x + size / 2 + (px / 8 - cx * 2) * k, y + size / 2 + (py / 8 - cy * 2) * k];
  ctx.fillStyle = "#1d1730";
  ctx.fillRect(x - 3, y - 3, size + 6, size + 6);
  ctx.fillStyle = "#f4f0e0";
  ctx.fillRect(x - 2, y - 2, size + 4, size + 4);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = "#2c4a34";
  ctx.fillRect(x, y, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cityMap, x + size / 2 - cx * 2 * k, y + size / 2 - cy * 2 * k, CW * 2 * k, CH * 2 * k);
  ctx.imageSmoothingEnabled = false;
  if (isNight()) {                        // tonight's Battle Zone, in red
    const zone = zoneNow(), [mx, my] = toScreen(MID * TILE, MID * TILE), from = (zone.from * Math.PI) / 180, to = (zone.to * Math.PI) / 180;
    ctx.fillStyle = "rgba(255,60,90,0.32)";
    ctx.strokeStyle = "#ff3c5a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 133.5 * 2 * k, from, to);
    ctx.arc(mx, my, 23.5 * 2 * k, to, from, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff3c5a";
    for (const t of trainers) if (!t.beaten) {
      const [tx, ty] = toScreen(t.x, t.y);
      ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3);
    }
  }
  for (const portal of RAIDS) if (portal.open) {
    const [px, py] = toScreen(portal.x, portal.y);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(px) - 3, Math.round(py) - 3, 7, 7);
    ctx.fillStyle = "#a050f0";
    ctx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 5, 5);
  }
  if (goal) {                             // where to go next: a flashing yellow diamond (kept on the edge if it is off the map)
    let [gx, gy] = toScreen(goal.x, goal.y);
    gx = Math.max(x + 5, Math.min(x + size - 5, gx));
    gy = Math.max(y + 5, Math.min(y + size - 5, gy));
    ctx.fillStyle = "#1d1730";
    ctx.beginPath();
    ctx.moveTo(gx, gy - 6);
    ctx.lineTo(gx + 6, gy);
    ctx.lineTo(gx, gy + 6);
    ctx.lineTo(gx - 6, gy);
    ctx.fill();
    ctx.fillStyle = Math.floor(time * 4) % 2 ? "#fff27a" : "#ffb020";
    ctx.beginPath();
    ctx.moveTo(gx, gy - 4);
    ctx.lineTo(gx + 4, gy);
    ctx.lineTo(gx, gy + 4);
    ctx.lineTo(gx - 4, gy);
    ctx.fill();
  }
  const [px, py] = toScreen(me.x, me.y);   // you: an arrow pointing the way you are facing
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(Math.sin(me.face), -Math.cos(me.face)));
  ctx.fillStyle = "#1d1730";
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 6);
  ctx.fill();
  ctx.fillStyle = "#ff5a3a";
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 4);
  ctx.lineTo(0, 2);
  ctx.lineTo(-4, 4);
  ctx.fill();
  ctx.restore();
}

// ----- What the game remembers -----
const SAVE_NAME = "championSave";
// "rank" counts the ranks you have climbed: 0 means Rank 100, and 99 means Rank 1
const freshState = () => ({ name: "Trainer", city: 2, team: [], stored: 0, dex: {}, orbs: 5, coins: 0, shards: 0, rank: 0, champion: false, x: 0, y: 0, outfit: firstOutfit() });
let state = freshState();
const me = { x: START.x, y: START.y, face: Math.PI, anim: 0, moving: false };      // "face" is the way you are facing, as an angle
let look = 0;                // which way the camera looks round you (changed with the mouse or the left and right arrows)
let zoom = 1.2;              // how far back the camera is (the mouse wheel changes it)
function save() {
  state.x = me.x;
  state.y = me.y;
  try { localStorage.setItem(SAVE_NAME, JSON.stringify(state)); } catch (error) { /* keep playing */ }
}
function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_NAME));
    return saved && saved.team && saved.team.length ? saved : null;
  } catch (error) { return null; }
}
const caughtCount = () => Object.values(state.dex).filter((mark) => mark === 2).length;
const lead = () => state.team[0];
const awake = () => state.team.filter((c) => c.hp > 0);
function see(id, caught) {
  state.dex[id] = Math.max(state.dex[id] || 0, caught ? 2 : 1);
}
function healTeam() {
  for (const c of state.team) c.hp = maxHp(c);
}
const rankName = () => (state.champion ? "CHAMPION" : "Rank " + (100 - state.rank));
// Every tenth rank is a gate: you can't climb past it until you win a gate match at the tower
const atGate = () => !state.champion && state.rank % 10 === 9;
const SHARD_PRICE = 20, ORB_PRICE = 100;

// ----- Everything that moves -----
const pal = { x: START.x - 14, y: START.y, hop: 0, flash: 0, dash: null, charge: null };      // your Wildling's place in the world
let cool = [0, 0, 0];        // how long until each attack is ready again
let surge = 0;               // the Starburst meter, 0 to 100
let surging = 0;             // seconds of Starburst left
let foes = [];               // wild creatures, and the creature a trainer has sent out
let trainers = [];           // the trainers in tonight's Battle Zone
let fight = null;            // a trainer battle that is going on
let shots = [];
let floats = [];             // numbers and words that float up
let marks = [];              // warnings on the ground: where an attack is about to land
let bits = [];
let cam = { x: 0, y: 0 };
let time = 0;
let clock = 0.08;            // 0 to 0.6 is day, 0.6 to 1 is night
let nights = 0;
let mode = "title";          // title, outfit, train, choose, play, team, dex, map
let trainTime = 0, trainDone = false;       // for the train ride at the start
let pick = 0;
const isNight = () => clock >= 0.6;
const zoneNow = () => BATTLE_ZONES[nights % BATTLE_ZONES.length];
const rnd = (a, b) => a + Math.random() * (b - a);

function spawnWild(park) {
  for (let tries = 0; tries < 60; tries++) {
    const tx = Math.floor(park.at.x + rnd(-park.r, park.r)), ty = Math.floor(park.at.y + rnd(-park.r, park.r));
    if (!inPark(park, tx, ty) || (tiles[ty][tx] !== GRASS && tiles[ty][tx] !== TALL)) continue;
    const kind = park.kinds[Math.floor(Math.random() * park.kinds.length)];
    const lv = Math.round(rnd(park.lv[0], park.lv[1]));
    const family = familiesOf[kind][Math.floor(Math.random() * familiesOf[kind].length)];
    return { c: newCreature(idFor(family, lv), lv), x: tx * TILE + 8, y: ty * TILE + 10, vx: 0, vy: 0, park: park, wild: true, angry: false, think: 0, next: rnd(1, 2), wind: null, flash: 0, gone: 0 };
  }
}
for (const park of PARKS) for (let n = 0; n < 7; n++) foes.push(spawnWild(park));
function makeTrainers() {
  const zone = zoneNow(), r = state.rank;
  const NAMES = ["Skater Bea", "Chef Ravi", "Dancer Lio", "Artist Mina", "Biker Juno", "Gardener Pip", "DJ Kaz", "Runner Tess", "Baker Odo"];
  trainers = [];
  for (let n = 0; n < 9; n++) {
    for (let tries = 0; tries < 120; tries++) {
      const spot = polar(rnd(zone.from, zone.to), rnd(26, 132));
      const tx = Math.floor(spot.x), ty = Math.floor(spot.y);
      if (tiles[ty][tx] !== STREET || trainers.some((t) => Math.hypot(t.x - tx * TILE, t.y - ty * TILE) < 150)) continue;
      // The higher you have climbed, the stronger (and bigger) the teams you meet
      const size = 1 + (r > 12 ? 1 : 0) + (r > 40 ? 1 : 0);
      const team = Array.from({ length: size }, function () {
        const lv = Math.max(2, Math.round(3 + r * 0.46 + rnd(-1, 1)));
        return newCreature(idFor(Math.floor(Math.random() * FAMILY_COUNT), lv), lv);
      });
      trainers.push({ name: NAMES[(n + nights) % NAMES.length], outfit: randomOutfit(), x: tx * TILE + 8, y: ty * TILE + 10, dir: 0, anim: 0, moving: false, walk: 0, team: team, beaten: false, prize: 2 + size });
      break;
    }
  }
}
// Star shards glitter on the streets. Pick them up and sell them at a shop.
let shards = [];
function scatterShards() {
  shards = [];
  for (let tries = 0; tries < 900 && shards.length < 80; tries++) {
    const spot = polar(rnd(0, 360), Math.sqrt(rnd(0.02, 1)) * 154);          // (the square root spreads them evenly over the round city)
    if (tiles[Math.floor(spot.y)][Math.floor(spot.x)] === STREET) shards.push({ x: spot.x * TILE, y: spot.y * TILE });
  }
}

// ----- People and cars -----
// Everyone who travels round the city follows a "route": either round a ring boulevard, or along an avenue.
// A route remembers which road it is on, how far along it is ("at": an angle on a ring, a distance on an avenue),
// which way it is going ("dir": 1 or -1), and which side of the road it keeps to ("side").
const MIDPX = MID * TILE, FULL_TURN = Math.PI * 2;
const avenueTurn = (k) => (AVENUES[k].deg * Math.PI) / 180;
// Where is a route right now, and which way is it heading?
// ("gap" is how far from the middle of the road to be; leave it out to use the route's own)
function routeAt(r, gap) {
  const off = r.side * (gap === undefined ? r.off : gap);
  if (r.ring >= 0) {
    const far = RINGS[r.ring] * TILE + off;
    return { x: MIDPX + Math.cos(r.at) * far, y: MIDPX + Math.sin(r.at) * far, hx: -Math.sin(r.at) * r.dir, hy: Math.cos(r.at) * r.dir };
  }
  const a = avenueTurn(r.avenue);
  return { x: MIDPX + Math.cos(a) * r.at - Math.sin(a) * off, y: MIDPX + Math.sin(a) * r.at + Math.cos(a) * off, hx: Math.cos(a) * r.dir, hy: Math.sin(a) * r.dir };
}
// Cars keep to the left: on a ring that is the outside when going one way and the inside when going the other
const leftSide = (r) => (r.ring >= 0 ? r.dir : -r.dir);
// Look ahead to the next crossroads and decide now what to do there: go straight on, or turn.
// ("skip" is the road just left behind, so nobody turns straight back onto it.)
function planRoute(r, skip) {
  if (r.ring >= 0) {
    const far = RINGS[r.ring] * TILE;
    let best = -1, bestAhead = 99;
    AVENUES.forEach(function (avenue, k) {
      if (k === skip || avenue.from > RINGS[r.ring]) return;
      const ahead = ((((avenueTurn(k) - r.at) * r.dir) % FULL_TURN) + FULL_TURN) % FULL_TURN;
      if (ahead > 0.12 && ahead < bestAhead) [best, bestAhead] = [k, ahead];
    });
    const ways = [];
    if (r.ring < RINGS.length - 1) ways.push(1);                                   // outwards along the avenue
    if (r.ring > 0 && AVENUES[best].from < RINGS[r.ring]) ways.push(-1);           // inwards
    const turn = Math.random() < 0.5 ? 0 : ways[Math.floor(Math.random() * ways.length)];
    const side = r.keepLeft ? -turn : Math.random() < 0.5 ? 1 : -1;
    r.plan = { avenue: best, turn: turn, side: side, left: turn ? bestAhead + (side * r.off * r.dir) / far : bestAhead };
  } else {
    const avenue = AVENUES[r.avenue];
    let best = -1, bestAhead = 1e9;
    RINGS.forEach(function (ring, n) {
      const ahead = (ring * TILE - r.at) * r.dir;
      if (n !== skip && ring >= avenue.from - 0.1 && ahead > r.off + 4 && ahead < bestAhead) [best, bestAhead] = [n, ahead];
    });
    if (best < 0) {                      // (nothing ahead: turn round)
      r.dir = -r.dir;
      if (r.keepLeft) r.side = leftSide(r);
      return planRoute(r, -1);
    }
    const last = r.dir > 0 ? best === RINGS.length - 1 : RINGS[best] <= Math.max(avenue.from, RINGS[0]) + 0.1;      // the avenue ends here, so they must turn
    const turn = last || Math.random() < 0.55 ? (Math.random() < 0.5 ? 1 : -1) : 0;
    const side = r.keepLeft ? turn : best === RINGS.length - 1 ? -1 : Math.random() < 0.5 ? 1 : -1;
    r.plan = { ring: best, turn: turn, side: side, left: bestAhead + (turn ? side * r.off * r.dir : 0) };
  }
}
// Move a route along by a number of steps, turning at the crossroads if that was the plan
function moveRoute(r, step) {
  if (!r.plan) planRoute(r, -1);
  const moved = r.ring >= 0 ? step / (RINGS[r.ring] * TILE) : step;
  r.at += moved * r.dir;
  r.plan.left -= moved;
  if (r.plan.left > 0) return;
  const plan = r.plan;
  if (r.ring >= 0) {
    if (!plan.turn) return planRoute(r, plan.avenue);
    const from = r.ring;
    Object.assign(r, { ring: -1, avenue: plan.avenue, at: RINGS[from] * TILE + r.side * r.off, dir: plan.turn, side: plan.side });
    planRoute(r, from);
  } else {
    if (!plan.turn) return planRoute(r, plan.ring);
    const from = r.avenue;
    Object.assign(r, { avenue: -1, ring: plan.ring, at: avenueTurn(from) + (r.side * r.off) / (RINGS[plan.ring] * TILE), dir: plan.turn, side: plan.side });
    planRoute(r, from);
  }
}
// Where will a route be a little further on? (It tries the journey out on a copy.)
function routeAhead(r, step, gap) {
  const copy = Object.assign({}, r, { plan: r.plan && Object.assign({}, r.plan) });
  moveRoute(copy, step);
  return routeAt(copy, gap);
}
function turnRound(r) {
  r.dir = -r.dir;
  if (r.keepLeft) r.side = leftSide(r);
  r.plan = null;
}
// Put a route on a road somewhere new: not too near you (so nobody pops up in front of you) and not too far
function placeRoute(r, min, max) {
  for (let tries = 0; tries < 10; tries++) {
    const angle = rnd(0, FULL_TURN), away = rnd(min, max);
    const px = me.x + Math.cos(angle) * away, py = me.y + Math.sin(angle) * away;
    const d = Math.hypot(px - MIDPX, py - MIDPX) / TILE, turn = Math.atan2(py - MIDPX, px - MIDPX);
    if (d < 26 || d > 153) continue;
    r.dir = Math.random() < 0.5 ? 1 : -1;
    r.plan = null;
    if (Math.random() < 0.5) {          // the nearest ring boulevard...
      let ring = 0;
      RINGS.forEach((far, n) => (ring = Math.abs(far - d) < Math.abs(RINGS[ring] - d) ? n : ring));
      Object.assign(r, { ring: ring, avenue: -1, at: turn });
    } else {                            // ...or the nearest avenue
      let best = -1, gap = 9;
      AVENUES.forEach(function (avenue, k) {
        const off = Math.abs(Math.atan2(Math.sin(avenueTurn(k) - turn), Math.cos(avenueTurn(k) - turn)));
        if (avenue.from < d - 4 && off < gap) [best, gap] = [k, off];
      });
      Object.assign(r, { ring: -1, avenue: best, at: d * TILE });
    }
    r.side = r.keepLeft ? leftSide(r) : r.ring === RINGS.length - 1 || Math.random() < 0.5 ? -1 : 1;
    const spot = routeAt(r), far = Math.hypot(spot.x - me.x, spot.y - me.y);
    if (tileAt(spot.x, spot.y) === STREET && far >= min && far <= max + 60) return spot;
  }
  return null;
}
// People stroll along the edge of the road (one in six is out for a run). Say hello and they will give you a tip.
const HELLOS = ["Fire beats Grass, Water beats Fire, and Grass beats Water. Easy to remember!", "A Fairy type makes short work of a Dragon.", "Sell your star shards at the shops with the blue signs.", "The cafes with a green cross heal your Wildlings for free.", "They say a legendary Wildling comes to the raid portals once you reach Rank 50.", "The gate matches at the tower are tough. Train in the parks first!", "Ice is super against Dragons. Brr!", "Press T to see which types beat which.", "New star shards fall on the streets every morning.", "The Battle Zone only opens at night. Press N if you can't wait.", "Wilder Wildlings live in the parks far from the station.", "I heard only a Champion has ever seen the mythical Wishling.", "Lovely day for a walk, isn't it?", "Mind the cars when you cross the road!"];
const walkers = Array.from({ length: 14 }, function (unused, n) {
  const jog = n % 6 === 5;
  return { route: { off: 21.5, keepLeft: false }, live: false, x: 0, y: 0, face: 0, anim: n, moving: true, jog: jog, speed: jog ? 96 : 30 + (n % 4) * 3, outfit: randomOutfit(), hello: n };
});
// Cars drive round the roads, keeping to the left. They stop for you, for your Wildling and for each other.
const cars = Array.from({ length: 12 }, (unused, n) => ({ route: { off: 9, keepLeft: true }, live: false, x: 0, y: 0, face: 0, speed: 0, top: 120 + (n % 4) * 14, rolled: 0, stuck: 0 }));
let firstTraffic = true;          // (when the game starts, people and cars may appear close to you)
function updateTraffic(dt) {
  for (const walker of walkers) {
    if (!walker.live || Math.hypot(walker.x - me.x, walker.y - me.y) > 860) {
      const spot = placeRoute(walker.route, firstTraffic ? 90 : 430, 780);
      walker.live = !!spot;
      if (!spot) continue;
      Object.assign(walker, { x: spot.x, y: spot.y, outfit: randomOutfit(), hello: Math.floor(Math.random() * HELLOS.length) });
    }
    walker.moving = Math.hypot(walker.x - me.x, walker.y - me.y) > 19;        // (they wait politely if you stand in their way)
    if (walker.moving) {
      moveRoute(walker.route, walker.speed * dt);
      walker.anim += dt * (walker.jog ? 12.5 : 5.4);
    }
    const ahead = routeAhead(walker.route, 26, 0);
    if (tileAt(ahead.x, ahead.y) === POND) turnRound(walker.route);            // (a pond ahead: turn back)
    // They keep to the edge of the road, and step in a little where a building or the river comes close
    let spot = null;
    for (const gap of [21.5, 17, 12.5]) {
      spot = routeAt(walker.route, gap);
      if (![WALL, POND, OUT, TREE].includes(tileAt(spot.x, spot.y))) break;
    }
    walker.x += (spot.x - walker.x) * Math.min(1, dt * 8);                     // (easing makes them walk round corners instead of jumping)
    walker.y += (spot.y - walker.y) * Math.min(1, dt * 8);
    walker.face = walker.moving ? Math.atan2(spot.hx, spot.hy) : Math.atan2(me.x - walker.x, me.y - walker.y);
  }
  const inTheWay = [me, pal].concat(fight && fight.actor ? [fight.actor] : [], raid ? [raid.actor] : []);
  for (const car of cars) {
    if (!car.live || Math.hypot(car.x - me.x, car.y - me.y) > 980) {
      const spot = placeRoute(car.route, firstTraffic ? 150 : 520, 880);
      car.live = !!spot;
      if (!spot) continue;
      Object.assign(car, { x: spot.x, y: spot.y, face: Math.atan2(spot.hx, spot.hy), speed: car.top, stuck: 0 });
    }
    let spot = routeAt(car.route);
    if (tileAt(spot.x, spot.y) !== STREET) {                 // (somehow off the road: start again somewhere else)
      car.live = false;
      continue;
    }
    const ahead = routeAhead(car.route, 38);
    if (tileAt(ahead.x, ahead.y) !== STREET) turnRound(car.route);            // (a park ahead, where the road stops: turn round)
    const frontX = car.x + spot.hx * 44, frontY = car.y + spot.hy * 44, noseX = car.x + spot.hx * 24, noseY = car.y + spot.hy * 24;
    const carAhead = cars.some((other) => other !== car && other.live && Math.hypot(other.x - noseX - spot.hx * 12, other.y - noseY - spot.hy * 12) < 26);
    car.stuck = carAhead ? car.stuck + dt : 0;
    const blocked = inTheWay.some((thing) => Math.hypot(thing.x - frontX, thing.y - frontY) < 34 || Math.hypot(thing.x - car.x, thing.y - car.y) < 24) || (carAhead && car.stuck < 3);       // (after 3 seconds stuck behind another car, it squeezes past)
    car.speed += ((blocked ? 0 : car.top) - car.speed) * Math.min(1, dt * 6);
    if (inTheWay.some((thing) => Math.hypot(thing.x - noseX, thing.y - noseY) < 22)) car.speed = 0;        // (right in front of the bonnet: stop dead)
    moveRoute(car.route, car.speed * dt);
    car.rolled += car.speed * dt;
    spot = routeAt(car.route);
    car.x += (spot.x - car.x) * Math.min(1, dt * 7);
    car.y += (spot.y - car.y) * Math.min(1, dt * 7);
    car.face = Math.atan2(spot.hx, spot.hy);
  }
  firstTraffic = false;
}

// ----- Raids -----
// Three glowing portals stand on the outer boulevard. Inside each waits a GIANT, rare Wildling:
// a fully grown one you can't find in the parks. Beat it in a raid battle and it joins you.
const RAIDS = [50, 170, 290].map(function (deg) {
  const at = polar(deg, 111);
  return { x: at.x * TILE + 8, y: at.y * TILE + 8, open: true, id: 3 };
});
let raid = null;
function fillRaids() {
  for (const portal of RAIDS) {
    portal.open = true;
    portal.id = Math.floor(Math.random() * FAMILY_COUNT) * 3 + 3;
  }
  // Legendary Wildlings come to the portals once you have climbed high enough. The mythical one comes only for the Champion.
  if (state.rank >= 50 && state.dex[58] !== 2) RAIDS[1].id = 58;
  if (state.rank >= 90 && state.dex[59] !== 2) RAIDS[2].id = 59;
  if (state.champion && state.dex[60] !== 2) RAIDS[0].id = 60;
}
function startRaid(portal) {
  const lv = Math.max(8, Math.min(50, Math.max(...state.team.map((c) => c.lv)) + 2));
  const c = newCreature(portal.id, lv);
  c.big = 4;                         // a raid Wildling has four times the usual health
  c.hp = maxHp(c);
  const actor = { c: c, x: portal.x, y: portal.y, vx: 0, vy: 0, wild: false, raid: true, angry: true, next: 1.6, wind: null, flash: 0, gone: 0 };
  foes.push(actor);
  raid = { portal: portal, actor: actor };
  see(c.id, false);
  sfx.alert();
  toast("RAID! A giant " + DEX[c.id].name + " bursts out of the portal! Watch for its huge attacks.", 5);
}
function endRaid(won) {
  const { portal, actor } = raid;
  raid = null;
  foes.splice(foes.indexOf(actor), 1);
  marks = marks.filter((mark) => mark.foe !== actor);
  if (!won) return;
  const c = actor.c, fresh = state.dex[c.id] !== 2;
  delete c.big;
  c.hp = maxHp(c);
  see(c.id, true);
  if (state.team.length < 6) state.team.push(c);
  else state.stored++;
  portal.open = false;
  state.shards += 8;
  sfx.win();
  burst(actor.x, actor.y - 20, ["#ffffff", "#fff27a", "#c87aff"], 80, 160);
  showCard(["RAID WON! The giant " + DEX[c.id].name + " shrinks down... and joins you!" + (fresh ? " That's a new one for your Wilddex (" + caughtCount() + " of " + TOTAL + ")." : ""), (state.team.includes(c) ? "It is on your team now." : "Your team is full, so it went to the ranch.") + " You also get 8 star shards. The portal will open again tomorrow."]);
  save();
}

// ----- Keyboard -----
const keys = {};
const justPressed = {};
const MOVE_KEYS = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
document.addEventListener("keydown", function (event) {
  if (event.target.tagName === "INPUT") return;        // (typing your name on the title screen)
  if (event.code === "Space" || event.code === "Tab" || event.code.startsWith("Arrow")) event.preventDefault();
  if (!keys[event.code]) justPressed[event.code] = true;
  keys[event.code] = true;
});
document.addEventListener("keyup", (event) => (keys[event.code] = false));
canvas.addEventListener("mousedown", function () {
  try { if (!document.pointerLockElement) canvas.requestPointerLock(); } catch (error) { /* the arrow keys still turn the camera */ }
});
document.addEventListener("mousemove", function (event) {
  if (document.pointerLockElement === canvas && mode === "play") look -= event.movementX * 0.004;
});
canvas.addEventListener("wheel", function (event) {
  event.preventDefault();
  zoom = Math.max(0.7, Math.min(2.6, zoom + Math.sign(event.deltaY) * 0.15));
}, { passive: false });
const held = (name) => Object.keys(MOVE_KEYS).some((code) => MOVE_KEYS[code] === name && keys[code]);
const tapped = (name) => Object.keys(MOVE_KEYS).some((code) => MOVE_KEYS[code] === name && justPressed[code]);
const pressed = (...codes) => codes.some((code) => justPressed[code]);
const chose = () => pressed("Space", "Enter");
const wentBack = () => pressed("Escape", "KeyX", "Backspace");
let toastTimer = 0;
function toast(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastTimer = seconds || 3;
}
let card = null;
function showCard(lines, done) {
  card = { lines: lines, index: 0, done: done };
  el("card").hidden = false;
  el("card-text").textContent = lines[0];
}
function updateCard() {
  if (!chose()) return;
  card.index++;
  if (card.index < card.lines.length) return (el("card-text").textContent = card.lines[card.index]);
  const done = card.done;
  card = null;
  el("card").hidden = true;
  if (done) done();
}
function burst(x, y, colours, count, speed) {
  for (let i = 0; i < count && bits.length < 400; i++) {
    const angle = Math.random() * Math.PI * 2, push = speed * (0.3 + Math.random() * 0.7);
    bits.push({ x: x, y: y, vx: Math.cos(angle) * push, vy: Math.sin(angle) * push, life: 0.3 + Math.random() * 0.5, colour: colours[Math.floor(Math.random() * colours.length)] });
  }
}
const float = (x, y, text, colour) => floats.push({ x: x, y: y, text: text, colour: colour || "#ffffff", life: 0.9 });

// ----- Fighting, in real time -----
// The foe your Wildling is aiming at: the nearest one that is fighting you, or a calm wild one close by
function target() {
  let best = null, near = 250;
  for (const foe of foes) {
    const far = Math.hypot(foe.x - pal.x, foe.y - pal.y);
    if (foe.gone <= 0 && (foe.angry || !foe.wild || far < 110) && far < near) {
      near = far;
      best = foe;
    }
  }
  return best;
}
// One creature hits another. "to" is a foe, or null for your own Wildling.
function strike(from, to, strength, kind) {
  const victim = to ? to.c : lead();
  if (victim.hp <= 0) return;
  const strong = effect(kind, victim.id);
  const boost = !to ? 1 : surging > 0 ? 1.5 : 1;
  const damage = Math.max(1, Math.round((3 + from.lv * 0.6) * (strength / 9) * (power(from) / guard(victim)) * strong * boost * rnd(0.85, 1)));
  victim.hp = Math.max(0, victim.hp - damage);
  const at = to || pal;
  at.flash = 0.3;
  sfx.hit();
  float(at.x, at.y - 30, damage + (strong > 1 ? " SUPER!" : strong < 1 ? " weak" : ""), to ? (strong > 1 ? "#fff27a" : "#ffffff") : "#ff8a8a");
  burst(at.x, at.y - 12, [KIND_COLOUR[Math.max(0, kind)], "#ffffff"], 8, 70);
  if (to) {
    to.angry = true;
    if (surging <= 0) surge = Math.min(100, surge + 6 + damage * 0.6);
    if (victim.hp === 0) foeFainted(to);
  } else if (victim.hp === 0) palFainted();
}
function gainXp(c, amount) {
  c.xp += amount;
  let grew = false;
  while (c.lv < 60 && c.xp >= xpToGrow(c)) {
    c.xp -= xpToGrow(c);
    const before = maxHp(c);
    c.lv++;
    c.hp += maxHp(c) - before;
    grew = true;
  }
  if (!grew) return;
  sfx.good();
  toast(DEX[c.id].name + " grew to level " + c.lv + "!", 3);
  const stage = DEX[c.id].stage;
  if (DEX[c.id].mystery || stage >= 2 || c.lv < GROW_AT[stage]) return;
  const old = DEX[c.id].name, before = maxHp(c);
  c.id += c.lv >= GROW_AT[1] && stage === 0 ? 2 : 1;
  c.hp += maxHp(c) - before;
  see(c.id, true);
  sfx.win();
  burst(pal.x, pal.y - 14, ["#ffffff", "#fff27a", KIND_COLOUR[DEX[c.id].kind]], 50, 120);
  toast("What? " + old + " is changing... It grew into " + DEX[c.id].name + "!", 5);
}
function foeFainted(foe) {
  if (foe.raid) {
    gainXp(lead(), foe.c.lv * 30);
    return endRaid(true);
  }
  burst(foe.x, foe.y - 12, ["#ffffff", "#c8c0e0"], 20, 80);
  foe.gone = 45;
  foe.wind = null;
  marks = marks.filter((mark) => mark.foe !== foe);
  gainXp(lead(), Math.round(foe.c.lv * (foe.wild ? 7 : 10)));
  if (foe.wild && Math.random() < 0.5) {
    state.shards++;
    float(foe.x, foe.y - 44, "+1 star shard", "#fff27a");
  }
  if (fight && fight.actor === foe) {
    fight.actor = null;
    fight.wait = 1;
    foes.splice(foes.indexOf(foe), 1);
  }
  save();
}
function palFainted() {
  pal.dash = pal.charge = null;
  surging = 0;
  const next = state.team.findIndex((c) => c.hp > 0);
  if (next > 0) {
    toast(DEX[lead().id].name + " fainted! Go, " + DEX[state.team[next].id].name + "!", 3);
    state.team.unshift(state.team.splice(next, 1)[0]);
    cool = [1, 1, 1];
    return;
  }
  // Nobody left: back to the cafe
  if (fight) endFight(false);
  if (raid) endRaid(false);
  for (const foe of foes) foe.angry = false;
  marks = [];
  shots = [];
  Object.assign(me, { x: cafes[0].x, y: cafes[0].y + 6 });
  Object.assign(pal, { x: me.x - 14, y: me.y });
  healTeam();
  toast("All your Wildlings fainted! You wake up at the cafe, and everyone is healed.", 5);
}
function startFight(trainer, promo) {
  fight = { trainer: trainer, left: trainer.team.slice(), actor: null, wait: 0.9, promo: promo };
  sfx.alert();
  toast(trainer.name + " wants to battle!", 3);
}
function endFight(won) {
  const { trainer, promo, actor } = fight;
  if (actor) foes.splice(foes.indexOf(actor), 1);
  fight = null;
  marks = [];
  for (const c of trainer.team) c.hp = maxHp(c);
  if (!won) return;
  sfx.win();
  if (promo) {
    healTeam();
    state.shards += 5;
    if (state.rank >= 99) {
      state.champion = true;
      state.rank = 99;
      fillRaids();
      showCard(["YOU DID IT! You beat the Champion. " + state.name.toUpperCase() + " is the new CHAMPION OF THE WILDLINGS!", "Orla: \"From Rank 100 all the way to the top. I have never seen a climb like it. Crownhaven is proud of you!\"", "They say a mythical Wildling only shows itself to a Champion. Look for a new raid portal...", "You can keep battling, and try to catch all " + TOTAL + " Wildlings."]);
    } else {
      state.rank++;
      fillRaids();
      showCard(["You won the gate match! You are now " + rankName() + ".", "Orla: \"Well battled! The next gate is at Rank " + (100 - (Math.floor(state.rank / 10) * 10 + 9)) + ". Keep winning in the Battle Zone to reach it.\"", "You also get 5 star shards."]);
    }
    makeTrainers();
  } else {
    trainer.beaten = true;
    const before = state.rank;
    state.rank = Math.min(state.rank + 2, Math.floor(state.rank / 10) * 10 + 9);        // climb two ranks, but never past a gate
    state.shards += trainer.prize;
    toast("You beat " + trainer.name + "! " + (state.rank > before ? "You climb to " + rankName() + "." : "") + " +" + trainer.prize + " star shards." + (atGate() ? " You have reached a gate: see the League Master at the tower!" : ""), 6);
  }
  save();
}
// Your three attacks
function useMove(n) {
  const aim = target(), c = lead();
  if (!aim || c.hp <= 0 || cool[n] > 0 || pal.dash || pal.charge) return;
  if (n === 2 && c.lv < 10) return toast("Your Wildling learns its big attack at level 10.", 2);
  const far = Math.hypot(aim.x - pal.x, aim.y - pal.y);
  const fast = surging > 0 ? 0.6 : 1;
  if (n === 0) {
    if (far > 180) return float(pal.x, pal.y - 34, "too far!", "#bfe8ff");
    pal.dash = { t: 0, fx: pal.x, fy: pal.y, aim: aim };
    cool[0] = 0.8 * fast;
  } else if (n === 1) {
    const angle = Math.atan2(aim.y - pal.y, aim.x - pal.x);
    shots.push({ x: pal.x, y: pal.y - 12, vx: Math.cos(angle) * 230, vy: Math.sin(angle) * 230, life: 1.5, mine: true, aim: aim, from: c, strength: 9, kind: DEX[c.id].kind });
    cool[1] = 2.4 * fast;
    sfx.zap();
  } else {
    pal.charge = { t: 0.5, aim: aim };
    cool[2] = 7 * fast;
    sfx.warn();
  }
}
function throwOrb() {
  const aim = target();
  if (!aim) return;
  if (aim.raid) return toast("Beat the raid Wildling first. Then it will join you!", 3);
  if (!aim.wild) return toast("You can't catch a trainer's Wildling!", 2);
  if (state.orbs <= 0) return toast("No capture orbs left! Sell star shards at a shop and buy some more.", 3);
  state.orbs--;
  sfx.orb();
  shots.push({ x: me.x, y: me.y - 16, vx: 0, vy: 0, life: 0.45, total: 0.45, orb: true, aim: aim, fx: me.x, fy: me.y - 16 });
}
function orbLands(foe) {
  if (foe.gone > 0) return;
  const chance = 0.2 + (1 - foe.c.hp / maxHp(foe.c)) * 0.72 - DEX[foe.c.id].stage * 0.08;
  if (Math.random() > chance) {
    foe.angry = true;
    burst(foe.x, foe.y - 12, ["#ffffff", "#e0503a"], 10, 60);
    return float(foe.x, foe.y - 34, "broke free!", "#ff8a8a");
  }
  const fresh = state.dex[foe.c.id] !== 2;
  see(foe.c.id, true);
  foe.c.hp = Math.max(foe.c.hp, Math.round(maxHp(foe.c) / 2));
  if (state.team.length < 6) state.team.push(foe.c);
  else state.stored++;
  foe.gone = 45;
  marks = marks.filter((mark) => mark.foe !== foe);
  sfx.win();
  burst(foe.x, foe.y - 12, ["#ffffff", "#fff27a", "#e0503a"], 30, 90);
  toast("Gotcha! " + DEX[foe.c.id].name + " was caught!" + (fresh ? " New in your Wilddex (" + caughtCount() + " of " + TOTAL + ")." : "") + (state.team.includes(foe.c) ? "" : " Your team is full, so it went to the ranch."), 5);
  save();
}
// What a foe does when it is fighting your Wildling
function foeFights(foe, dt) {
  const dx = pal.x - foe.x, dy = pal.y - foe.y, far = Math.hypot(dx, dy) || 1;
  const big = foe.raid ? 1.9 : 1;            // a raid Wildling's attacks cover much more ground
  if (foe.wind) {
    const wind = foe.wind;
    if ((wind.t -= dt) > 0) return;
    foe.wind = null;
    marks = marks.filter((mark) => mark.foe !== foe);
    if (wind.kind === "lunge") {
      Object.assign(foe, { x: wind.x, y: wind.y });
      burst(wind.x, wind.y - 6, ["#ffffff"], 6, 50);
      if (Math.hypot(pal.x - wind.x, pal.y - wind.y) < 22 * big) strike(foe.c, null, 7, -1);
    } else if (wind.kind === "slam") {
      sfx.boom();
      burst(wind.x, wind.y, [KIND_COLOUR[bigKind(foe.c.id)], "#ffffff"], 40, 130);
      if (Math.hypot(pal.x - wind.x, pal.y - wind.y) < wind.r) strike(foe.c, null, 13, bigKind(foe.c.id));
    } else {
      const angle = Math.atan2(pal.y - 10 - foe.y, pal.x - foe.x);
      shots.push({ x: foe.x, y: foe.y - 12, vx: Math.cos(angle) * 150, vy: Math.sin(angle) * 150, life: 2, from: foe.c, strength: 9, kind: DEX[foe.c.id].kind });
      sfx.zap();
    }
    return;
  }
  // Keep a little way off, circling
  const want = far > 70 ? 1 : far < 44 ? -1 : 0;
  const speed = 46 + foe.c.lv * 0.5;
  const mx = (dx / far) * want * speed + (-dy / far) * 18 * (foe.c.id % 2 ? 1 : -1), my = (dy / far) * want * speed + (dx / far) * 18 * (foe.c.id % 2 ? 1 : -1);
  if (!solid(foe.x + mx * dt, foe.y)) foe.x += mx * dt;
  if (!solid(foe.x, foe.y + my * dt)) foe.y += my * dt;
  if ((foe.next -= dt) > 0 || lead().hp <= 0) return;
  foe.next = rnd(1.5, 2.6) - Math.min(0.6, foe.c.lv * 0.012);
  const roll = Math.random();
  sfx.warn();
  if ((foe.c.lv >= 10 || foe.raid) && roll < (foe.raid ? 0.45 : 0.28)) {
    foe.wind = { kind: "slam", t: 0.95 * (foe.raid ? 1.25 : 1), total: 0.95 * (foe.raid ? 1.25 : 1), x: pal.x, y: pal.y, r: 40 * big };
    marks.push({ foe: foe, kind: "circle", x: pal.x, y: pal.y, r: 40 * big, wind: foe.wind });
  } else if (roll < 0.62 && far < 130) {
    foe.wind = { kind: "lunge", t: 0.6, total: 0.6, x: pal.x, y: pal.y };
    marks.push({ foe: foe, kind: "line", x: pal.x, y: pal.y, r: 16 * big, wind: foe.wind });
  } else foe.wind = { kind: "blast", t: 0.35, total: 0.35 };
}

// ----- Playing -----
let hudText = "";
function updatePlay(dt) {
  if (card) return updateCard();
  if (pressed("KeyX")) return ((mode = "team"), (pick = 0));
  if (pressed("KeyZ")) return (mode = "dex");
  if (pressed("KeyT")) return (mode = "types");
  if (pressed("KeyO") && !fight) return ((mode = "outfit"), (pick = 0));
  if (pressed("KeyM")) return (mode = "map");
  // The clock: day turns to night, and the Battle Zone opens
  const wasNight = isNight();
  if (!fight) clock += dt / 420;
  if (pressed("KeyN") && !fight && !foes.some((foe) => foe.angry && foe.gone <= 0)) {
    clock = wasNight ? 1 : 0.6;
    toast(wasNight ? "You rest until morning." : "You wait for night to fall...", 3);
  }
  if (clock >= 1) {
    clock -= 1;
    nights++;
    trainers = [];
    scatterShards();
    if (!raid) fillRaids();
    toast("Morning! The Battle Zone is closed. The parks are full of wild Wildlings, and new star shards have fallen.", 5);
  } else if (!wasNight && isNight()) {
    makeTrainers();
    sfx.alert();
    toast("Night falls. The Battle Zone is open in " + zoneNow().name + "! Look for the glowing red border.", 6);
  }
  // Star shards: walk over one to pick it up
  for (const shard of shards.slice()) if (Math.hypot(shard.x - me.x, shard.y - me.y) < 24) {
    shards.splice(shards.indexOf(shard), 1);
    state.shards++;
    sfx.good();
    float(shard.x, shard.y - 30, "+1 star shard", "#fff27a");
    burst(shard.x, shard.y - 8, ["#fff27a", "#ffffff"], 12, 70);
  }
  // You
  // W and S walk forwards and backwards (the way the camera looks), A and D step sideways, the arrows turn the camera
  look -= ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 2.4 * dt;
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), across = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  me.moving = ahead !== 0 || across !== 0;
  if (me.moving) {
    const ax = -Math.sin(look) * ahead + Math.cos(look) * across, ay = -Math.cos(look) * ahead - Math.sin(look) * across;
    const length = Math.hypot(ax, ay), speed = keys.ShiftLeft || keys.ShiftRight ? 150 : 105;
    if (canStand(me.x + (ax / length) * speed * dt, me.y)) me.x += (ax / length) * speed * dt;
    if (canStand(me.x, me.y + (ay / length) * speed * dt)) me.y += (ay / length) * speed * dt;
    me.face = Math.atan2(ax, ay);
    for (const car of cars) {                      // (you can't walk through a car: it nudges you round it)
      const gap = Math.hypot(me.x - car.x, me.y - car.y);
      if (!car.live || gap > 15 || gap < 0.01) continue;
      const nx = car.x + ((me.x - car.x) / gap) * 15, ny = car.y + ((me.y - car.y) / gap) * 15;
      if (canStand(nx, ny)) Object.assign(me, { x: nx, y: ny });
    }
    me.running = !!(keys.ShiftLeft || keys.ShiftRight);
    me.anim += dt * (me.running ? 12.5 : 8.2);          // (how fast your legs go: quicker when you run)
  }
  // Your Wildling: it follows you, dashes in to attack, and charges up its big move
  const c = lead();
  for (let n = 0; n < 3; n++) cool[n] = Math.max(0, cool[n] - dt);
  if (surging > 0 && (surging -= dt) <= 0) {
    burst(pal.x, pal.y - 14, ["#ffffff", "#fff27a"], 20, 80);
    toast("The Starburst fades, and " + DEX[c.id].name + " changes back.", 3);
  }
  if (pal.flash > 0) pal.flash -= dt;
  if (pal.dash) {
    const dash = pal.dash;
    dash.t += dt / 0.16;
    pal.x = dash.fx + (dash.aim.x - dash.fx) * Math.min(1, dash.t) * 0.85;
    pal.y = dash.fy + (dash.aim.y - dash.fy) * Math.min(1, dash.t) * 0.85;
    if (dash.t >= 1) {
      pal.dash = null;
      if (dash.aim.gone <= 0) strike(c, dash.aim, 6, -1);
    }
  } else {
    const gx = me.x - Math.sin(me.face) * 16 + Math.cos(me.face) * 12, gy = me.y - Math.cos(me.face) * 16 - Math.sin(me.face) * 12;      // just behind you, to one side
    const dx = gx - pal.x, dy = gy - pal.y, far = Math.hypot(dx, dy);
    if (far > 200) Object.assign(pal, { x: gx, y: gy });
    else if (far > 2) {
      const step = Math.min(far, (pal.charge ? 40 : 150) * dt);
      pal.x += (dx / far) * step;
      pal.y += (dy / far) * step;
      pal.hop += dt * 12;
    }
    if (pal.charge && (pal.charge.t -= dt) <= 0) {
      const aim = pal.charge.aim;
      pal.charge = null;
      sfx.boom();
      burst(aim.x, aim.y - 8, [KIND_COLOUR[bigKind(c.id)], "#ffffff", "#fff27a"], 60, 150);
      for (const foe of foes.slice()) if (foe.gone <= 0 && (foe.angry || !foe.wild || foe === aim) && Math.hypot(foe.x - aim.x, foe.y - aim.y) < 50) strike(c, foe, 15, bigKind(c.id));
    }
  }
  if (pressed("Digit1", "KeyJ")) useMove(0);
  if (pressed("Digit2", "KeyK")) useMove(1);
  if (pressed("Digit3", "KeyL")) useMove(2);
  if (pressed("KeyE")) throwOrb();
  if (pressed("KeyF")) {
    if (surge < 100) toast("The Starburst meter isn't full yet. Land attacks to fill it.", 2);
    else {
      surge = 0;
      surging = 12;
      sfx.surge();
      burst(pal.x, pal.y - 14, ["#fff27a", "#ffffff", "#ff7ab0", "#7ad8f0"], 70, 150);
      toast("STARBURST! " + DEX[c.id].name + " changes into Star " + DEX[c.id].name + ": stronger and faster!", 4);
    }
  }
  if (pressed("KeyQ") && awake().length > 1 && !pal.dash && !pal.charge) {
    const next = state.team.findIndex((other, n) => n > 0 && other.hp > 0);
    state.team.push(state.team.shift());
    while (lead().hp <= 0) state.team.push(state.team.shift());
    cool = [1, 1, 1];
    burst(pal.x, pal.y - 12, ["#ffffff", "#bfe8ff"], 14, 70);
    toast("Go, " + DEX[lead().id].name + "!", 2);
    void next;
  }
  // Foes
  for (const foe of foes) {
    if (foe.gone > 0) {
      if ((foe.gone -= dt) <= 0 && foe.wild) Object.assign(foe, spawnWild(foe.park));
      continue;
    }
    if (foe.flash > 0) foe.flash -= dt;
    const far = Math.hypot(foe.x - pal.x, foe.y - pal.y);
    if (foe.wild) {
      if (!foe.angry && far < 46) {
        foe.angry = true;
        see(foe.c.id, false);
        float(foe.x, foe.y - 36, "!", "#ff5a5a");
        sfx.alert();
      }
      if (foe.angry && far > 230) {
        foe.angry = false;
        foe.wind = null;
        foe.c.hp = maxHp(foe.c);
        marks = marks.filter((mark) => mark.foe !== foe);
      }
    }
    if (foe.angry || !foe.wild) foeFights(foe, dt);
    else {
      if ((foe.think -= dt) <= 0) {
        foe.think = rnd(1, 3);
        const angle = Math.random() * 6.283, speed = Math.random() < 0.35 ? 0 : 20;
        foe.vx = Math.cos(angle) * speed;
        foe.vy = Math.sin(angle) * speed;
      }
      const kind = tileAt(foe.x + foe.vx * dt * 8, foe.y + foe.vy * dt * 8);
      if (kind === GRASS || kind === TALL) {
        foe.x += foe.vx * dt;
        foe.y += foe.vy * dt;
      } else foe.think = 0;
    }
  }
  updateTraffic(dt);
  // Trainers stroll about the Battle Zone at night, and battle you when they spot you
  for (const t of trainers) {
    if (t.beaten || fight) {
      t.moving = false;
      continue;
    }
    if ((t.walk -= dt) <= 0) {
      t.walk = rnd(1, 3);
      t.dir = Math.floor(Math.random() * 4);
      t.moving = Math.random() < 0.6;
    }
    if (t.moving) {
      const nx = t.x + DIRS[t.dir][0] * 30 * dt, ny = t.y + DIRS[t.dir][1] * 30 * dt;
      if (canStand(nx, ny) && tileAt(nx, ny) === STREET && inZone(zoneNow(), Math.floor(nx / TILE), Math.floor(ny / TILE))) Object.assign(t, { x: nx, y: ny });
      else t.walk = 0;
      t.anim += dt * 5;
    }
    if (Math.hypot(t.x - me.x, t.y - me.y) < 54 && awake().length) startFight(t, false);
  }
  if (fight) {
    const t = fight.trainer;
    if (!fight.actor && (fight.wait -= dt) <= 0) {
      if (!fight.left.length) endFight(true);
      else {
        const next = fight.left.shift();
        fight.actor = { c: next, x: t.x + (me.x < t.x ? -22 : 22), y: t.y + 6, wild: false, angry: true, next: rnd(1, 1.6), wind: null, flash: 0, gone: 0 };
        foes.push(fight.actor);
        see(next.id, false);
        burst(fight.actor.x, fight.actor.y - 10, ["#ffffff", "#ff7a7a"], 16, 70);
        toast(t.name + " sends out " + DEX[next.id].name + " (level " + next.lv + ")!", 3);
      }
    }
    if (fight && Math.hypot(t.x - me.x, t.y - me.y) > 300) {
      endFight(false);
      toast("You ran too far away, so the battle is off.", 3);
    }
  }
  // Flying things
  for (const shot of shots) {
    shot.life -= dt;
    if (shot.orb) {
      const part = 1 - shot.life / shot.total;
      shot.x = shot.fx + (shot.aim.x - shot.fx) * part;
      shot.y = shot.fy + (shot.aim.y - 12 - shot.fy) * part - Math.sin(part * Math.PI) * 30;
      if (shot.life <= 0) orbLands(shot.aim);
      continue;
    }
    if (shot.mine && shot.aim.gone <= 0) {        // your shots curve towards their target
      const angle = Math.atan2(shot.aim.y - 12 - shot.y, shot.aim.x - shot.x);
      shot.vx += (Math.cos(angle) * 230 - shot.vx) * Math.min(1, dt * 18);
      shot.vy += (Math.sin(angle) * 230 - shot.vy) * Math.min(1, dt * 18);
    }
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.mine) {
      const hit = foes.find((foe) => foe.gone <= 0 && (foe.angry || !foe.wild || foe === shot.aim) && Math.hypot(foe.x - shot.x, foe.y - 12 - shot.y) < 16);
      if (hit) {
        shot.life = 0;
        strike(shot.from, hit, shot.strength, shot.kind);
      }
    } else if (Math.hypot(pal.x - shot.x, pal.y - 12 - shot.y) < 10) {
      shot.life = 0;
      strike(shot.from, null, shot.strength, shot.kind);
    }
  }
  shots = shots.filter((shot) => shot.life > 0);
  // Cafes heal, shops trade, and the League Master at the tower runs the gate matches
  const atCafe = cafes.find((cafe) => Math.hypot(cafe.x - me.x, cafe.y - me.y) < 20);
  const atOfficial = Math.hypot(OFFICIAL.x - me.x, OFFICIAL.y - me.y) < 26;
  const atWalker = walkers.find((walker) => walker.live && Math.hypot(walker.x - me.x, walker.y - me.y) < 30);
  const atPortal = !raid && RAIDS.find((portal) => portal.open && Math.hypot(portal.x - me.x, portal.y - me.y) < 40);
  if (raid && Math.hypot(raid.portal.x - me.x, raid.portal.y - me.y) > 380) {
    endRaid(false);
    toast("You ran too far from the portal, so the raid is over.", 3);
  }
  const ask = fight || raid ? "" : atPortal ? "Space: start the RAID (a giant " + DEX[atPortal.id].name + ")"
    : atCafe && atCafe.shop ? "Space: sell your " + state.shards + " star shards for " + state.shards * SHARD_PRICE + " coins     B: buy 5 orbs for " + ORB_PRICE + " coins (you have " + state.coins + ")"
    : atCafe ? "Space: rest at the cafe (heals your team)" : atOfficial ? "Space: talk to " + OFFICIAL.name : atWalker ? "Space: say hello" : "";
  if (el("prompt").textContent !== ask) {
    el("prompt").textContent = ask;
    el("prompt").hidden = !ask;
  }
  if (pressed("KeyB") && ask && atCafe && atCafe.shop) {
    if (state.coins < ORB_PRICE) toast("You need " + ORB_PRICE + " coins. Sell some star shards first!", 3);
    else {
      state.coins -= ORB_PRICE;
      state.orbs += 5;
      sfx.good();
      toast("You bought 5 capture orbs. (" + state.orbs + " orbs, " + state.coins + " coins left)", 3);
      save();
    }
  }
  if (chose() && ask) {
    if (atPortal) startRaid(atPortal);
    else if (atCafe && atCafe.shop) {
      if (!state.shards) toast("You have no star shards to sell. Look for them glittering on the streets.", 3);
      else {
        state.coins += state.shards * SHARD_PRICE;
        toast("You sold " + state.shards + " star shards for " + state.shards * SHARD_PRICE + " coins! (" + state.coins + " coins)", 4);
        state.shards = 0;
        sfx.good();
        save();
      }
    } else if (atCafe) {
      healTeam();
      sfx.good();
      toast("A hot chocolate and a rest. Your whole team is healed!", 3);
      save();
    } else if (!atOfficial) toast("Passer-by: \"" + (state.champion && atWalker.hello % 3 === 0 ? "Look, it's " + state.name + ", the Champion! Can I shake your hand?" : HELLOS[atWalker.hello]) + "\"", 5);
    else if (state.champion) showCard(["Orla: \"Champion! The whole city is talking about you. The trainers will still battle you every night.\""]);
    else if (!atGate()) showCard(["Orla: \"Welcome to the Wildling League! You are " + rankName() + ". Rank 1 is the top, and after that... Champion.\"", "\"Beat trainers in the Battle Zone at night to climb. Every tenth rank is a gate, and I hold the gate matches here. Your next gate is Rank " + (100 - (Math.floor(state.rank / 10) * 10 + 9)) + ".\"", "\"By day, catch and train Wildlings in the parks. Press N to wait for night.\""]);
    else showCard([state.rank >= 99 ? "Orla: \"Rank 1! Only one battle is left: the Champion. Are you ready? It starts NOW!\"" : "Orla: \"You have reached the gate at " + rankName() + "! Beat the Gatekeeper and you may climb on. It starts NOW!\""], function () {
      const r = state.rank, last = r >= 99;
      healTeam();
      const size = last ? 5 : r < 20 ? 2 : r < 70 ? 3 : 4;
      const team = Array.from({ length: size }, (unused, n) => newCreature(idFor((r * 7 + n * 5 + 3) % FAMILY_COUNT, 5 + r * 0.46 + n), Math.round(5 + r * 0.46 + n)));
      startFight({ name: last ? "Champion Regis" : "Gatekeeper " + ["Nova", "Blaze", "Indigo", "Sable", "Onyx", "Lyric", "Storm", "Vesper", "Crown", "Zenith"][Math.floor(r / 10)], outfit: randomOutfit(), x: OFFICIAL.x + 40, y: OFFICIAL.y + 30, dir: 1, anim: 0, team: team, promo: true }, true);
    });
  }
  const park = PARKS.find((p) => inPark(p, Math.floor(me.x / TILE), Math.floor(me.y / TILE)));
  const where = park ? park.name + " (wild levels " + park.lv[0] + " to " + park.lv[1] + ")" : tileAt(me.x, me.y) === PLAZA ? "Tower Plaza" : isNight() && inZone(zoneNow(), Math.floor(me.x / TILE), Math.floor(me.y / TILE)) ? "the BATTLE ZONE" : "Crownhaven";
  const goal = state.champion ? "You are the Champion!" : atGate() ? (state.rank >= 99 ? "Go to the tower and challenge the Champion!" : "Go to the tower for your gate match!") : isNight() ? "Beat trainers in the Battle Zone (" + zoneNow().name + ")." : "Catch and train in the parks. N: wait for night.";
  const top = [c.id, c.lv, c.hp, state.rank, state.champion, state.coins, state.shards, state.orbs, caughtCount(), where, goal, isNight()].join("|");
  if (top !== hudText) {
    hudText = top;
    el("hearts").textContent = rankName() + " · " + state.coins + " coins";
    el("rings").textContent = "Orbs " + state.orbs + " · Star shards " + state.shards + " · Caught " + caughtCount() + "/" + TOTAL;
    el("place").textContent = (isNight() ? "☾ Night in " : "☀ Day in ") + where + ". " + goal;
  }
}
function words(text, x, y, colour, size, align) {
  ctx.font = (size || 8) + "px \"Press Start 2P\", monospace";
  ctx.textAlign = align || "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#1d1730";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = colour || "#ffffff";
  ctx.fillText(text, x, y);
}
function wrapped(text, x, y, width, colour) {
  let line = "", row = 0;
  for (const word of text.split(" ")) {
    if ((line + word).length * 8 > width) {
      words(line, x, y + row++ * 13, colour);
      line = "";
    }
    line += word + " ";
  }
  words(line, x, y + row * 13, colour);
}
function panel(x, y, w, h) {
  ctx.fillStyle = "#1d1730";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#f4f0e0";
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = "#2a2c4a";
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
}
function hpBar(c, x, y, w) {
  const part = c.hp / maxHp(c);
  ctx.fillStyle = "#1d1730";
  ctx.fillRect(x, y, w, 7);
  ctx.fillStyle = part > 0.5 ? "#4ad85a" : part > 0.2 ? "#f2c81e" : "#e83a3a";
  ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * part), 5);
}
function drawTeam() {
  ctx.fillStyle = "#24304e";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  words("YOUR TEAM", 240, 10, "#fff27a", 10, "center");
  state.team.forEach(function (c, n) {
    const x = 12 + (n % 2) * 232, y = 30 + Math.floor(n / 2) * 78;
    panel(x, y, 224, 72);
    ctx.drawImage(picture(c.id), x + 6, y + 4, 64, 64);
    words((n === pick ? "▶" : "") + DEX[c.id].name, x + 74, y + 10, n === pick ? "#fff27a" : "#ffffff", 7);
    words("L" + c.lv + " " + kindsOf(c.id) + (n === 0 ? " *" : ""), x + 74, y + 24, "#bfe8ff", 6);
    hpBar(c, x + 74, y + 38, 110);
    words(c.hp + "/" + maxHp(c) + " HP", x + 74, y + 50, "#ffffff", 6);
  });
  words("Arrows: choose   Space: make leader   X: close", 240, 272, "#ffffff", 7, "center");
  words("Caught " + caughtCount() + " of " + TOTAL + "   " + rankName() + "   At the ranch: " + state.stored, 240, 290, "#fff27a", 7, "center");
  words("Press T while you play to see the type chart.", 240, 304, "#bfe8ff", 5, "center");
}
function drawDex() {
  ctx.fillStyle = "#24304e";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  words("WILDDEX   caught " + caughtCount() + " of " + TOTAL, 240, 8, "#fff27a", 9, "center");
  for (let id = 1; id <= TOTAL; id++) {
    const x = 22 + ((id - 1) % 10) * 44, y = 26 + Math.floor((id - 1) / 10) * 45;
    ctx.fillStyle = state.dex[id] === 2 ? KIND_COLOUR[DEX[id].kind] : "#1a2238";
    ctx.fillRect(x, y, 40, 42);
    ctx.fillStyle = "#24304e";
    ctx.fillRect(x + 1, y + 1, 38, 40);
    if (state.dex[id] === 2) ctx.drawImage(picture(id), x + 5, y + 1, 30, 30);
    else if (state.dex[id]) ctx.drawImage(darkCopy(picture(id)), x + 5, y + 1, 30, 30);
    words(state.dex[id] ? String(id) : "?", x + 20, y + 32, state.dex[id] === 2 ? "#ffffff" : "#6a7090", 6, "center");
  }
  words("Bright: caught   Shadow: seen   ?: not found yet   Z: close", 240, 304, "#ffffff", 6, "center");
}
// The type chart: what each type is strong against, and which types shrug it off
function drawTypes() {
  ctx.fillStyle = "#24304e";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  words("TYPE CHART", 240, 8, "#fff27a", 9, "center");
  words("SUPER against (double damage)", 150, 26, "#fff27a", 6, "center");
  words("weak against (half damage)", 356, 26, "#ff8a8a", 6, "center");
  KINDS.forEach(function (kind, k) {
    const y = 40 + k * 21;
    ctx.fillStyle = blend(KIND_COLOUR[k], "#000000", 0.3);
    ctx.fillRect(8, y, 54, 16);
    words(kind, 35, y + 5, "#ffffff", 6, "center");
    words(STRONG[k].map((s) => KINDS[s]).join(", "), 70, y + 5, "#ffffff", 6);
    words(WEAK[k].map((s) => KINDS[s]).join(", "), 262, y + 5, "#ffb0b0", 6);
  });
  words("A Wildling with two types can be hit 4 times as hard!   T: close", 240, 304, "#ffffff", 6, "center");
}
function drawChoose() {
  ctx.fillStyle = "#24304e";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  words("CHOOSE YOUR FIRST WILDLING", 240, 22, "#fff27a", 10, "center");
  [1, 4, 7].forEach(function (id, n) {
    const x = 30 + n * 146;
    panel(x, 60, 128, 190);
    if (n === pick) {
      ctx.strokeStyle = "#fff27a";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, 61.5, 125, 187);
    }
    ctx.drawImage(picture(id), x + 16, 70 + (n === pick ? Math.round(Math.sin(time * 6) * 3) : 0), 96, 96);
    words(DEX[id].name, x + 64, 172, "#ffffff", 8, "center");
    ctx.fillStyle = KIND_COLOUR[DEX[id].kind];
    ctx.fillRect(x + 34, 186, 60, 14);
    words(KINDS[DEX[id].kind], x + 64, 190, "#ffffff", 7, "center");
    words("strong against", x + 64, 206, "#bfe8ff", 5, "center");
    words(STRONG[DEX[id].kind].map((s) => KINDS[s]).join(", "), x + 64, 216, "#bfe8ff", 6, "center");
    words("grows into", x + 64, 228, "#fff27a", 5, "center");
    words(DEX[id + 2].name, x + 64, 237, "#fff27a", 6, "center");
  });
  words("Left and right: choose     Space: this one!", 240, 276, "#ffffff", 7, "center");
}


// ----- Drawing the city -----
// The 3D city is drawn by view3d.js. On top of it, this draws the words and bars.
function drawPlay() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  const aim = target();
  const over = function (x, y, high, text, colour, size) {         // words floating above a place in the city
    const at = VIEW.project(x, y, high);
    if (at) words(text, at.x, at.y, colour, size, "center");
  };
  for (const t of trainers) if (!t.beaten && !fight) over(t.x, t.y, 36 + Math.sin(time * 6) * 2, "!", "#ff5a5a", 10);
  for (const foe of foes) if (foe.gone <= 0 && foe.wind && Math.floor(time * 14) % 2) over(foe.x, foe.y, 38, "!", "#ff5a5a", 10);
  if (fight) over(fight.trainer.x, fight.trainer.y, 36, fight.trainer.name, "#ffffff", 6);
  const near = (thing, range) => Math.hypot(thing.x - me.x, thing.y - me.y) < range;
  if (near(OFFICIAL, 300)) over(OFFICIAL.x, OFFICIAL.y, 40, "League Master", "#fff27a", 6);
  for (const portal of RAIDS) if (portal.open && !(raid && raid.portal === portal) && near(portal, 520)) over(portal.x, portal.y, 54, (DEX[portal.id].legend ? "LEGENDARY RAID: " : DEX[portal.id].myth ? "MYTHICAL RAID: " : "RAID: ") + DEX[portal.id].name, "#e0a0ff", 6);
  for (const cafe of cafes) if (near(cafe, 260)) over(cafe.x, cafe.y - 8, 30, cafe.shop ? "SHOP" : "CAFE", cafe.shop ? "#9ac4ff" : "#7af0a0", 6);
  for (const park of PARKS) if (near({ x: park.at.x * TILE, y: park.at.y * TILE }, 420)) over(park.at.x * TILE, park.at.y * TILE, 60, park.name + "  L" + park.lv[0] + "-" + park.lv[1], "#9af0a0", 6);
  // An arrow in the corner points the way to where you should go next
  const zone = zoneNow(), zoneMid = polar((zone.from + zone.to) / 2, 78);
  const nearestPark = PARKS.slice().sort((a, b) => Math.hypot(a.at.x * TILE - me.x, a.at.y * TILE - me.y) - Math.hypot(b.at.x * TILE - me.x, b.at.y * TILE - me.y))[0];
  const goal = fight || raid ? null : atGate() ? { x: OFFICIAL.x, y: OFFICIAL.y, name: "Tower" }
    : isNight() ? (inZone(zone, Math.floor(me.x / TILE), Math.floor(me.y / TILE)) ? null : { x: zoneMid.x * TILE, y: zoneMid.y * TILE, name: "Battle Zone" })
    : { x: nearestPark.at.x * TILE, y: nearestPark.at.y * TILE, name: nearestPark.name };
  // The mini-map in the corner: the streets around you, with north at the top
  drawMap(382, 8, 90, me.x / TILE, me.y / TILE, 46, goal);
  words("N", 427, 10, "#1d1730", 6, "center");
  if (goal) words(goal.name + " " + Math.round(Math.hypot(goal.x - me.x, goal.y - me.y) / TILE), 427, 104, "#fff27a", 6, "center");
  words("M: big map", 427, goal ? 114 : 104, "#ffffff", 5, "center");
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2.5);
    over(f.x, f.y + 30, 26 + (0.9 - f.life) * 24, f.text, f.colour, 7);
  }
  ctx.globalAlpha = 1;
  if (surge >= 100 && surging <= 0 && state.team.length) words("F: STARBURST!", 60, 258, Math.floor(time * 6) % 2 ? "#fff27a" : "#ff7ab0", 7);
  // On-screen bars: your Wildling, its three attacks, the Starburst meter, and the foe you are fighting
  if (!state.team.length) return;
  const c = lead();
  panel(6, 268, 216, 46);
  words((surging > 0 ? "Star " : "") + DEX[c.id].name + " L" + c.lv, 14, 275, surging > 0 ? "#fff27a" : "#ffffff", 7);
  hpBar(c, 14, 287, 92);
  words(c.hp + "/" + maxHp(c), 14, 298, "#bfe8ff", 6);
  ctx.fillStyle = "#1d1730";
  ctx.fillRect(64, 297, 42, 7);
  ctx.fillStyle = surging > 0 ? "#ffffff" : surge >= 100 ? (Math.floor(time * 6) % 2 ? "#fff27a" : "#ff7ab0") : "#b06af0";
  ctx.fillRect(65, 298, Math.round(40 * (surging > 0 ? surging / 12 : surge / 100)), 5);
  const moves = movesOf(c);
  for (let n = 0; n < 3; n++) {
    const x = 114 + n * 35, ready = cool[n] <= 0 && (n < 2 || c.lv >= 10);
    ctx.fillStyle = n === 0 ? "#8a8ca8" : KIND_COLOUR[n === 2 ? bigKind(c.id) : DEX[c.id].kind];        // (each button is the colour of that attack's type)
    ctx.globalAlpha = ready ? 1 : 0.35;
    ctx.fillRect(x, 276, 31, 30);
    ctx.globalAlpha = 1;
    words(String(n + 1), x + 15, 279, "#ffffff", 9, "center");
    words(n === 0 ? "dash" : n === 1 ? "shot" : c.lv >= 10 ? "BIG" : "L10", x + 15, 294, "#ffffff", 5, "center");
    if (cool[n] > 0) {
      ctx.fillStyle = "rgba(20,16,50,0.7)";
      ctx.fillRect(x, 276, 31, Math.round(30 * Math.min(1, cool[n] / [0.8, 2.4, 7][n])));
    }
  }
  void moves;
  if (aim) {
    panel(150, 6, 180, 34);
    words((aim.raid ? "RAID " : "") + DEX[aim.c.id].name + " L" + aim.c.lv, 158, 12, aim.raid ? "#e0a0ff" : "#ffffff", 7);
    ctx.fillStyle = blend(KIND_COLOUR[DEX[aim.c.id].kind], "#000000", 0.35);
    ctx.fillRect(158, 24, 66, 9);
    words(kindsOf(aim.c.id), 191, 26, "#ffffff", 5, "center");
    hpBar(aim.c, 230, 25, 92);
    if (aim.wild) words("E: throw orb (" + state.orbs + ")", 240, 44, "#fff27a", 6, "center");
  }
}

// The big map (M): the whole city on one screen
function drawBigMap() {
  ctx.fillStyle = "#24304e";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  words("CROWNHAVEN", 96, 12, "#fff27a", 8, "center");
  drawMap(184, 12, 288, MID, MID, CW, null);
  const key = function (y, colour, text) {
    ctx.fillStyle = colour;
    ctx.fillRect(12, y, 8, 8);
    words(text, 26, y, "#ffffff", 6);
  };
  key(36, "#ff5a3a", "You");
  key(50, "#6cc860", "Wild zones");
  key(64, "#2f9a4c", "Cafes (heal)");
  key(78, "#3a6ad8", "Shops");
  key(92, "#a050f0", "Raid portals");
  key(106, "#9fe8ff", "The tower");
  key(120, "#ff3c5a", "Battle Zone");
  words("(at night)", 26, 130, "#bfe8ff", 5);
  PARKS.forEach((park, n) => words(park.name + " L" + park.lv[0] + "-" + park.lv[1], 12, 146 + n * 11, "#9af0a0", 5));
  words(rankName(), 12, 242, "#fff27a", 6);
  words(isNight() ? "It is night." : "It is day.", 12, 256, "#ffffff", 6);
  words("M: close", 12, 296, "#ffffff", 6);
}

// The outfit designer: the 3D camera zooms in on you, and this draws the list of choices
function drawOutfit() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  panel(8, 12, 236, 296);
  words("DESIGN YOUR TRAINER", 126, 24, "#fff27a", 9, "center");
  OUTFIT_ROWS.forEach(function ([part, name], n) {
    const y = 48 + n * 22, value = OUTFIT[part][state.outfit[part]], on = n === pick;
    words((on ? "▶" : " ") + name, 16, y, on ? "#fff27a" : "#ffffff", 6);
    if (on) words("<", 132, y, "#fff27a", 7), words(">", 226, y, "#fff27a", 7);
    if (value[0] === "#") {
      ctx.fillStyle = "#1d1730";
      ctx.fillRect(146, y - 3, 72, 13);
      ctx.fillStyle = value;
      ctx.fillRect(148, y - 1, 68, 9);
    } else words(value, 182, y, "#bfe8ff", 6, "center");
  });
  words("Up, down: choose", 126, 272, "#ffffff", 6, "center");
  words("Left, right: change   Space: done", 126, 286, "#ffffff", 6, "center");
}

function update(dt) {
  time += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) el("toast").hidden = true;
  for (const bit of bits) {
    bit.life -= dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
  }
  bits = bits.filter((bit) => bit.life > 0);
  for (const f of floats) f.life -= dt;
  floats = floats.filter((f) => f.life > 0);
  if (mode === "play") updatePlay(dt);
  else if (mode === "outfit") {
    if (tapped("down")) pick = (pick + 1) % OUTFIT_ROWS.length;
    if (tapped("up")) pick = (pick + OUTFIT_ROWS.length - 1) % OUTFIT_ROWS.length;
    const part = OUTFIT_ROWS[pick][0], many = OUTFIT[part].length;
    if (tapped("right")) state.outfit[part] = (state.outfit[part] + 1) % many;
    if (tapped("left")) state.outfit[part] = (state.outfit[part] + many - 1) % many;
    if (tapped("left") || tapped("right") || tapped("up") || tapped("down")) sfx.step();
    if (chose()) {
      sfx.good();
      pick = 0;
      if (state.team.length) {
        mode = "play";
        save();
      } else {
        mode = "train";           // your train pulls into the station
        trainTime = 0;
        Object.assign(me, { x: STATION.x - 122, y: STATION.y - 24, face: 0 });        // (you will step out onto the platform)
      }
    }
  } else if (mode === "train") {
    trainTime += dt;
    if (card) updateCard();
    else if (trainTime > 6 && !trainDone) {
      trainDone = true;
      showCard(["The train hisses to a stop. CROWNHAVEN CENTRAL: the city of the Wildling League!", "You step down onto the platform with your bag. Someone is waving at you from the city gate.", "Orla: \"You must be " + state.name + ", the new trainer! I'm Orla, the League Master. Every trainer here starts with a Wildling of their own. Come and choose yours!\""], function () {
        mode = "choose";
        pick = 0;
      });
    }
  } else if (mode === "choose") {
    if (tapped("right")) pick = (pick + 1) % 3;
    if (tapped("left")) pick = (pick + 2) % 3;
    if (chose()) {
      const first = newCreature([1, 4, 7][pick], 5);
      Object.assign(me, { x: START.x, y: START.y, face: Math.PI });
      Object.assign(pal, { x: me.x - 14, y: me.y });
      state.team = [first];
      see(first.id, true);
      mode = "play";
      sfx.win();
      showCard(["You and " + DEX[first.id].name + " are partners now! It is a " + kindsOf(first.id) + " type.",
        "Orla: \"Welcome to the Wildling League, " + state.name + ". Everyone starts at Rank 100. Climb all the way to Rank 1, and then you can challenge the Champion.\"",
        "Battles happen in real time. Press 1, 2 and 3 to attack. When a red mark appears on the ground, walk away: your Wildling follows you out of danger.",
        "Types matter! Fire beats Grass, Water beats Fire, Fairy beats Dragon, and so on. A super hit does double damage.",
        "Wild Wildlings live in the parks. Weaken one, then press E to throw a capture orb. You only have a few orbs...",
        "...so look for glittering STAR SHARDS on the streets. Sell them at a shop (the blue signs) and buy more orbs.",
        "At night the Battle Zone opens. Win there to climb the ranks. Follow the yellow diamond on your map. Good luck!"], save);
    }
  } else if (mode === "team") {
    if (tapped("right") || tapped("down")) pick = (pick + 1) % state.team.length;
    if (tapped("left") || tapped("up")) pick = (pick + state.team.length - 1) % state.team.length;
    if (chose() && pick > 0 && state.team[pick].hp > 0) {
      state.team.unshift(state.team.splice(pick, 1)[0]);
      pick = 0;
      cool = [1, 1, 1];
      sfx.good();
    }
    if (wentBack()) mode = "play";
  } else if (mode === "dex" && (pressed("KeyZ") || wentBack() || chose())) mode = "play";
  else if (mode === "types" && (pressed("KeyT") || wentBack() || chose())) mode = "play";
  else if (mode === "map" && (pressed("KeyM") || wentBack() || chose())) mode = "play";
}
function draw() {
  if (mode === "play" || mode === "outfit" || mode === "title" || mode === "train") VIEW.render();
  if (mode === "team") drawTeam();
  else if (mode === "dex") drawDex();
  else if (mode === "types") drawTypes();
  else if (mode === "choose") drawChoose();
  else if (mode === "outfit") drawOutfit();
  else if (mode === "map") drawBigMap();
  else if (mode === "title" || mode === "train") ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  else drawPlay();
  if (mode !== "play" && !el("prompt").hidden) el("prompt").hidden = true;
}
let lastTime = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
  lastTime = now;
  update(dt);
  draw();
  for (const code in justPressed) justPressed[code] = false;
  requestAnimationFrame(frame);
}
function begin(saved) {
  el("intro").hidden = true;
  if (saved && saved.city !== 2) Object.assign(saved, { x: 0, y: 0, city: 2 });        // (a save from the old, smaller city: start at the gate)
  state = saved ? Object.assign(freshState(), saved) : freshState();
  if (!saved) state.name = el("name").value.trim().slice(0, 12) || "Trainer";
  el("name").blur();
  Object.assign(me, { x: (saved && state.x) || START.x, y: (saved && state.y) || START.y, face: Math.PI });
  if (!canStand(me.x, me.y)) Object.assign(me, { x: START.x, y: START.y });
  mode = saved ? "play" : "outfit";          // a new trainer first designs what they look like
  pick = 0;
  trainDone = false;
  Object.assign(pal, { x: me.x - 14, y: me.y });
  for (const each of walkers.concat(cars)) each.live = false;
  firstTraffic = true;
  fillRaids();
  scatterShards();
  clock = 0.08;
}
el("start").addEventListener("click", () => begin(null));
el("continue").addEventListener("click", () => begin(loadSave()));
el("continue").hidden = !loadSave();
VIEW.build();
requestAnimationFrame(frame);

// Only for testing the game.
window.COTW = {
  get state() { return state; },
  get mode() { return mode; },
  get fight() { return fight; },
  get foes() { return foes; },
  get trainers() { return trainers; },
  get marks() { return marks; },
  get clock() { return clock; },
  set clock(value) { clock = value; },
  get zoom() { return zoom; },
  set zoom(value) { zoom = value; },
  get look() { return look; },
  set look(value) { look = value; },
  tiles: tiles, buildings: buildings, START: START, RAIDS: RAIDS, raid: () => raid, shards: () => shards, walkers: walkers, cars: cars, rankName: rankName, atGate: atGate, makeTrainers: makeTrainers,
  me: me, pal: pal, keys: keys, DEX: DEX, newCreature: newCreature, maxHp: maxHp, target: target, card: () => card, cafes: cafes, OFFICIAL: OFFICIAL, PARKS: PARKS, zone: zoneNow, surge: (n) => (surge = n), surging: () => surging, cool: () => cool,
};
