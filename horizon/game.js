// Wildlings: Wild Horizon. An open-world island to explore on foot or on the back of your ride, Zephyrun.
// Real-time battles and catching, five Trial Halls, three giant Elder Wildlings, and legendary Wildlings to find.
// The Wildlings are in creatures.js, the island is in world.js, and view3d.js shows it all in 3D.

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

// ----- The map -----
// A little picture of the whole island, painted once from the squares. Two map pixels are one square.
const cityMap = makeCanvas(CW * 2, CH * 2);
(function () {
  const g = cityMap.getContext("2d");
  const COLOURS = ["#7cc860", "#3f9a4c", "#ecd898", "#f4f8ff", "#a8b070", "#d8b888", "#e8e0d0", "#58a8f0", "#2f78d0"];
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    g.fillStyle = COLOURS[floor[y][x]];
    g.fillRect(x * 2, y * 2, 2, 2);
    if (tiles[y][x] === TREE && floor[y][x] !== SAND && (x + y) % 2) {
      g.fillStyle = floor[y][x] === SNOW ? "#9ac0b0" : "#2f7a3c";
      g.fillRect(x * 2, y * 2, 2, 2);
    }
    if (y + 1 < CH && level[y + 1][x] < level[y][x]) {        // a dark line along the bottom of every cliff
      g.fillStyle = "rgba(60,50,40,0.55)";
      g.fillRect(x * 2, y * 2 + 1, 2, 1);
    }
  }
  for (const b of buildings) {
    g.fillStyle = "#1d1730";
    g.fillRect(b.x * 2 - 1, b.y * 2 - 1, b.w * 2 + 2, b.h * 2 + 2);
    g.fillStyle = b.kind === "heal" ? "#f07898" : b.kind === "shop" ? "#5888e8" : "#f8c030";
    g.fillRect(b.x * 2, b.y * 2, b.w * 2, b.h * 2);
  }
})();
// Draw the map in a square on the screen: centred on (cx, cy) in squares, showing "across" squares.
function drawMap(x, y, size, cx, cy, across, goal, names) {
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
  ctx.fillStyle = "#2f78d0";
  ctx.fillRect(x, y, size, size);
  ctx.drawImage(cityMap, x + size / 2 - cx * 2 * k, y + size / 2 - cy * 2 * k, CW * 2 * k, CH * 2 * k);
  const dot = function (spot, colour, wide) {
    const [px, py] = toScreen(spot.x, spot.y);
    ctx.fillStyle = "#1d1730";
    ctx.fillRect(Math.round(px) - wide - 1, Math.round(py) - wide - 1, wide * 2 + 3, wide * 2 + 3);
    ctx.fillStyle = colour;
    ctx.fillRect(Math.round(px) - wide, Math.round(py) - wide, wide * 2 + 1, wide * 2 + 1);
  };
  for (const elder of ELDERS) if (!state[elder.gives]) dot(elder, "#ff8a2a", 2);            // Elders you haven't beaten: orange
  for (const t of trainers) if (!state.beaten[t.id]) dot(t, "#ff3c5a", 1);                    // trainers: red
  for (const legend of LEGENDS) if (state.dex[legend.id] && !state.legends[legend.id]) dot(legend, "#c87aff", 2);      // rare Wildlings you have seen: purple
  if (names) for (const t of towns) {
    const [tx, ty] = toScreen(t.x, t.y);
    words(t.name, tx, ty - 22, "#ffffff", 5, "center");
  }
  if (goal) {                             // where to go next: a flashing yellow diamond (kept on the edge if it is off the map)
    let [gx, gy] = toScreen(goal.x, goal.y);
    gx = Math.max(x + 5, Math.min(x + size - 5, gx));
    gy = Math.max(y + 5, Math.min(y + size - 5, gy));
    for (const [wide, colour] of [[6, "#1d1730"], [4, Math.floor(time * 4) % 2 ? "#fff27a" : "#ffb020"]]) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(gx, gy - wide);
      ctx.lineTo(gx + wide, gy);
      ctx.lineTo(gx, gy + wide);
      ctx.lineTo(gx - wide, gy);
      ctx.fill();
    }
  }
  const [px, py] = toScreen(me.x, me.y);   // you: an arrow pointing the way you are facing
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(Math.sin(me.face), -Math.cos(me.face)));
  for (const [wide, colour] of [[1.4, "#1d1730"], [1, "#ff5a3a"]]) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, -6 * wide);
    ctx.lineTo(4 * wide, 4 * wide);
    ctx.lineTo(0, 2 * wide);
    ctx.lineTo(-4 * wide, 4 * wide);
    ctx.fill();
  }
  ctx.restore();
}

// ----- What the game remembers -----
const SAVE_NAME = "wildHorizonSave";
const freshState = () => ({ team: [], stored: 0, dex: {}, orbs: 15, coins: 200, badges: {}, beaten: {}, legends: {}, swim: false, climb: false, dash: false, champion: false, heal: null, x: 0, y: 0, outfit: firstOutfit() });
let state = freshState();
const me = { x: START.x, y: START.y, face: Math.PI, anim: 0, moving: false, h: 0, riding: false };      // "face" is the way you are facing, as an angle
let look = 0;                // which way the camera looks round you (changed with the mouse or the left and right arrows)
let zoom = 1.3;              // how far back the camera is (the mouse wheel changes it)
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
const badgeCount = () => Object.keys(state.badges).filter((badge) => badge !== "Champion").length;        // the five Trial Badges
const caughtCount = () => Object.values(state.dex).filter((mark) => mark === 2).length;
const lead = () => state.team[0];
const awake = () => state.team.filter((c) => c.hp > 0);
function see(id, caught) {
  state.dex[id] = Math.max(state.dex[id] || 0, caught ? 2 : 1);
}
function healTeam() {
  for (const c of state.team) c.hp = maxHp(c);
}

// ----- Everything that moves -----
const pal = { x: START.x - 14, y: START.y, hop: 0, flash: 0, dash: null, charge: null };      // your Wildling's place in the world
let cool = [0, 0, 0];        // how long until each attack is ready again
let surge = 0;               // the Starburst meter, 0 to 100
let surging = 0;             // seconds of Starburst left
let foes = [];               // wild Wildlings, and the one a trainer has sent out
let fight = null;            // a trainer battle that is going on
let raid = null;             // a battle with a giant Elder that is going on
let shots = [];
let floats = [];             // numbers and words that float up
let marks = [];              // warnings on the ground: where an attack is about to land
let bits = [];
let time = 0;
let clock = 0.1;             // 0 to 0.6 is day, 0.6 to 1 is night
let mode = "title";          // title, outfit, choose, play, team, dex, map
let pick = 0;
const isNight = () => clock >= 0.6;
const rnd = (a, b) => a + Math.random() * (b - a);
const solid = (px, py) => tileAt(px, py) >= WATER;        // (wild Wildlings stay out of the water and off the rocks)
const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// A wild Wildling for a place: which family depends on the kind of country, and so does its level
function wildAt(x, y) {
  const land = landAt(x, y);
  const family = land.families[Math.random() < 0.08 ? land.families.length - 1 : Math.floor(Math.random() * (land.families.length - 1))];        // (the last in each list is rare)
  const lv = Math.round(rnd(land.lv[0], land.lv[1]));
  return { c: newCreature(idFor(family, lv), lv), x: x, y: y, vx: 0, vy: 0, lv0: levelAt(x, y), wild: true, angry: false, think: 0, next: rnd(1, 2), wind: null, flash: 0, gone: 0 };
}
// New wild Wildlings keep appearing around you as you travel (but never right on top of you)
function spawnAround() {
  for (let tries = 0; tries < 12; tries++) {
    const turn = Math.random() * 6.283, away = rnd(230, 520), x = me.x + Math.cos(turn) * away, y = me.y + Math.sin(turn) * away;
    if (tileAt(x, y) > MOOR || towns.some((t) => far(t, { x: x, y: y }) < 190)) continue;
    return foes.push(wildAt(x, y));
  }
}
// The rarest Wildlings stand and wait in their far corners (the mythical one only once you are Champion)
function addLegends() {
  for (const legend of LEGENDS) {
    if (state.legends[legend.id] || (legend.myth && !state.champion) || foes.some((foe) => foe.legend && foe.c.id === legend.id)) continue;
    foes.push({ c: newCreature(legend.id, legend.lv), x: legend.x, y: legend.y, home: legend, vx: 0, vy: 0, wild: true, legend: true, angry: false, think: 0, next: 2, wind: null, flash: 0, gone: 0 });
  }
}
// Trainers wait along the paths. Each is moved to the nearest square they can stand on.
const trainers = TRAINER_SPOTS.map(function ([tx, ty, name, team], n) {
  let spot = [tx, ty];
  for (let r = 0; r < 6 && tiles[spot[1]][spot[0]] > PLAZA; r++) for (let ay = -r; ay <= r; ay++) for (let ax = -r; ax <= r; ax++) if (tiles[spot[1]][spot[0]] > PLAZA && tiles[ty + ay][tx + ax] <= PLAZA) spot = [tx + ax, ty + ay];
  const made = team.map(([family, lv]) => newCreature(idFor(family, lv), lv));
  return { id: "t" + n, name: name, outfit: randomOutfit(), x: spot[0] * TILE + 8, y: spot[1] * TILE + 8, dir: 0, anim: 0, moving: false, team: made, prize: made[made.length - 1].lv * 14 };
});
// The leader of each Trial Hall stands outside it
const leaders = towns.map(function (t) {
  const made = t.hall.team.map(([family, lv]) => newCreature(idFor(family, lv), lv));
  return { name: t.hall.leader, hall: t.hall, town: t, outfit: randomOutfit(), x: t.hallAt.door.x + 26, y: t.hallAt.door.y + 14, dir: 0, anim: 0, moving: false, team: made, prize: 200 + made[made.length - 1].lv * 20 };
});

// ----- Elders -----
// Three giant Wildlings sleep around the island. Beat one and it teaches your ride, Zephyrun, a new trick.
function startElder(elder) {
  if (tileAt(me.x, me.y) !== WATER) me.riding = false;
  const c = newCreature(elder.id, elder.lv);
  c.big = 4;                         // an Elder has four times the usual health
  c.hp = maxHp(c);
  const actor = { c: c, x: elder.x, y: elder.y, vx: 0, vy: 0, wild: false, raid: true, angry: true, next: 1.6, wind: null, flash: 0, gone: 0 };
  foes.push(actor);
  raid = { elder: elder, actor: actor };
  see(c.id, false);
  sfx.alert();
  toast("The ground shakes... " + elder.name + " wakes up! Watch for its huge attacks.", 5);
}
function endElder(won) {
  const { elder, actor } = raid;
  raid = null;
  foes.splice(foes.indexOf(actor), 1);
  marks = marks.filter((mark) => mark.foe !== actor);
  if (!won) return;
  state[elder.gives] = true;
  state.coins += 400;
  state.orbs += 5;
  healTeam();
  sfx.win();
  burst(actor.x, actor.y - 20, ["#ffffff", "#fff27a", "#ffa040"], 80, 160);
  showCard(["You beat " + elder.name + "! It bows its great head, and breathes on Zephyrun...", elder.says, "You also get 400 coins and 5 capture orbs."]);
  save();
}
// What should you do next? (The map points to it.)
function goalNow() {
  const list = [
    [state.badges.Petal, SUNVALE.hallAt.door, "Sunvale Hall"], [state.badges.Cinder, DUNMERE.hallAt.door, "Dunmere Hall"], [state.swim, ELDERS[0], "Lake Elder"],
    [state.badges.Ripple, LAKE_ISLE.hallAt.door, "Lake Isle Hall"], [state.climb, ELDERS[1], "Forest Elder"], [state.badges.Crag, HIGHMOOR.hallAt.door, "Highmoor Hall"],
    [state.badges.Glacier, FROSTHOLM.hallAt.door, "Frostholm Hall"], [state.champion, ARENA.hallAt.door, "Summit Arena"], [state.dash, ELDERS[2], "Snow Elder"],
    [state.legends[55], LEGENDS[0], "Legendary!"], [state.legends[56], LEGENDS[1], "Legendary!"], [state.legends[57], LEGENDS[2], "Mythical!"],
  ];
  const next = list.find(([done]) => !done);
  return next ? { x: next[1].x, y: next[1].y, name: next[2] } : null;
}

// ----- Keyboard -----
const keys = {};
const justPressed = {};
const MOVE_KEYS = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
document.addEventListener("keydown", function (event) {
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
  const strong = effect(kind, DEX[victim.id].kind);
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
    return endElder(true);
  }
  burst(foe.x, foe.y - 12, ["#ffffff", "#c8c0e0"], 20, 80);
  foe.gone = foe.legend ? 60 : 4;
  foe.wind = null;
  marks = marks.filter((mark) => mark.foe !== foe);
  gainXp(lead(), Math.round(foe.c.lv * (foe.legend ? 20 : foe.wild ? 7 : 10)));
  if (foe.wild) {
    const coins = 5 + foe.c.lv * 2;
    state.coins += coins;
    float(foe.x, foe.y - 44, "+" + coins + " coins", "#fff27a");
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
  // Nobody left: back to the last healing house you used
  if (fight) endFight(false);
  if (raid) endElder(false);
  for (const foe of foes) foe.angry = false;
  marks = [];
  shots = [];
  const spot = state.heal || SUNVALE.heal.door;
  Object.assign(me, { x: spot.x, y: spot.y + 6, riding: false });
  me.h = heightAt(me.x, me.y);
  Object.assign(pal, { x: me.x - 14, y: me.y });
  healTeam();
  toast("All your Wildlings fainted! You wake up at the healing house, and everyone is rested.", 5);
}
function startFight(trainer) {
  if (tileAt(me.x, me.y) !== WATER) me.riding = false;
  fight = { trainer: trainer, left: trainer.team.slice(), actor: null, wait: 0.9 };
  sfx.alert();
  toast(trainer.name + " wants to battle!", 3);
}
function endFight(won) {
  const { trainer, actor } = fight;
  if (actor) foes.splice(foes.indexOf(actor), 1);
  fight = null;
  marks = [];
  for (const c of trainer.team) c.hp = maxHp(c);
  if (!won) return;
  sfx.win();
  state.coins += trainer.prize;
  if (trainer.hall) {
    const hall = trainer.hall;
    state.badges[hall.badge] = true;
    healTeam();
    if (hall.champion) {
      state.champion = true;
      addLegends();
      showCard(["YOU DID IT! You beat Champion Vale. You are the new Champion of Solara!", "Vale: \"I have never seen a trainer and their Wildlings move as one like that. The island is yours to explore.\"", "They say a mythical Wildling has been seen in a hidden glade, deep in the western forest..."]);
    } else {
      const got = badgeCount();
      showCard(["You beat " + hall.leader + "! You win the " + hall.badge + " Badge and " + trainer.prize + " coins.", "Badges: " + got + " of 5." + (got === 5 ? " You can now challenge the Champion at the Summit Arena, on Frost Peak!" : "")]);
    }
  } else {
    state.beaten[trainer.id] = true;
    state.orbs++;
    toast("You beat " + trainer.name + "! +" + trainer.prize + " coins and a capture orb.", 5);
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
  if (aim.raid) return toast("You can't catch an Elder! Beat it, and it will teach Zephyrun something new.", 3);
  if (!aim.wild) return toast("You can't catch a trainer's Wildling!", 2);
  if (state.orbs <= 0) return toast("No capture orbs left! Buy more at a shop.", 3);
  state.orbs--;
  sfx.orb();
  shots.push({ x: me.x, y: me.y - 16, vx: 0, vy: 0, life: 0.45, total: 0.45, orb: true, aim: aim, fx: me.x, fy: me.y - 16 });
}
function orbLands(foe) {
  if (foe.gone > 0) return;
  const chance = 0.2 + (1 - foe.c.hp / maxHp(foe.c)) * 0.72 - DEX[foe.c.id].stage * 0.08 - (foe.legend ? 0.42 : 0);        // (legendary Wildlings are very hard to catch)
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
  foe.gone = 4;
  if (foe.legend) state.legends[foe.c.id] = true;
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
      burst(wind.x, wind.y, [KIND_COLOUR[DEX[foe.c.id].kind], "#ffffff"], 40, 130);
      if (Math.hypot(pal.x - wind.x, pal.y - wind.y) < wind.r) strike(foe.c, null, 13, DEX[foe.c.id].kind);
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
let hudText = "", spawnWait = 0, noteWait = 0;
// Can you move to here? Trees, rocks and deep sea always stop you. Water needs a ride that can swim,
// and going up or down a cliff needs a ride that can climb.
function canGo(x, y) {
  const now = levelAt(me.x, me.y);
  for (const [ax, ay] of [[-4, -5], [4, -5], [-4, 1], [4, 1]]) {
    const kind = tileAt(x + ax, y + ay);
    if (kind >= TREE || kind === DEEP) return false;
    if (kind === WATER && !(me.riding && state.swim)) return note(state.swim ? "Hop on Zephyrun (R) to swim across." : "The water is too deep. If only Zephyrun could swim... The Lake Elder might teach it.");
    if (levelAt(x + ax, y + ay) !== now && !(me.riding && state.climb)) return note(state.climb ? "Hop on Zephyrun (R) to climb the cliff." : "The cliff is too steep. If only Zephyrun could climb... The Forest Elder might teach it.");
  }
  return true;
}
function note(text) {
  if (noteWait <= 0) {
    toast(text, 4);
    noteWait = 5;
  }
  return false;
}
function updatePlay(dt) {
  if (card) return updateCard();
  if (pressed("KeyX")) return ((mode = "team"), (pick = 0));
  if (pressed("KeyZ")) return (mode = "dex");
  if (pressed("KeyO") && !fight && !raid) return ((mode = "outfit"), (pick = 0));
  if (pressed("KeyM")) return (mode = "map");
  clock = (clock + dt / 480) % 1;
  noteWait -= dt;
  const battling = !!fight || !!raid || foes.some((foe) => foe.angry && foe.gone <= 0);
  // R: hop on or off your ride
  if (pressed("KeyR")) {
    if (me.riding) {
      if (tileAt(me.x, me.y) === WATER) toast("You can't get off in the water!", 2);
      else me.riding = false;
    } else if (battling) toast("You can't ride in the middle of a battle!", 2);
    else {
      me.riding = true;
      sfx.good();
      burst(me.x, me.y - 10, ["#fff27a", "#ffffff"], 14, 70);
    }
  }
  // W and S walk forwards and backwards (the way the camera looks), A and D step sideways, the arrows turn the camera
  look -= ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 2.4 * dt;
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), across = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  me.moving = ahead !== 0 || across !== 0;
  if (me.moving) {
    const ax = -Math.sin(look) * ahead + Math.cos(look) * across, ay = -Math.cos(look) * ahead - Math.sin(look) * across, length = Math.hypot(ax, ay);
    const swimming = tileAt(me.x, me.y) === WATER;
    const speed = me.riding ? (swimming ? 130 : state.dash ? 270 : 195) : keys.ShiftLeft || keys.ShiftRight ? 150 : 105;
    if (canGo(me.x + (ax / length) * speed * dt, me.y)) me.x += (ax / length) * speed * dt;
    if (canGo(me.x, me.y + (ay / length) * speed * dt)) me.y += (ay / length) * speed * dt;
    me.face = Math.atan2(ax, ay);
    me.anim += dt * (me.riding ? 1.5 : 1);
  }
  me.h += (heightAt(me.x, me.y) - me.h) * Math.min(1, dt * 9);       // glide up and down cliffs smoothly
  if (me.riding) for (const code of ["Digit1", "KeyJ", "Digit2", "KeyK", "Digit3", "KeyL", "KeyE", "KeyF", "KeyQ"]) justPressed[code] = false;       // (no attacking from the saddle)
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
      burst(aim.x, aim.y - 8, [KIND_COLOUR[DEX[c.id].kind], "#ffffff", "#fff27a"], 60, 150);
      for (const foe of foes.slice()) if (foe.gone <= 0 && (foe.angry || !foe.wild || foe === aim) && Math.hypot(foe.x - aim.x, foe.y - aim.y) < 50) strike(c, foe, 15, DEX[c.id].kind);
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
  if (me.riding) Object.assign(pal, { x: me.x, y: me.y, dash: null, charge: null });
  // Wild Wildlings: new ones appear as you travel, and ones left far behind are forgotten
  if ((spawnWait -= dt) <= 0) {
    spawnWait = 0.35;
    if (foes.filter((foe) => foe.wild && !foe.legend).length < 16) spawnAround();
  }
  for (const foe of foes.slice()) {
    if (foe.gone > 0) {
      if ((foe.gone -= dt) > 0) continue;
      if (foe.legend && !state.legends[foe.c.id]) Object.assign(foe, { x: foe.home.x, y: foe.home.y, angry: false, wind: null });        // (a legendary you didn't catch comes back)
      else foes.splice(foes.indexOf(foe), 1);
      if (foe.legend) foe.c.hp = maxHp(foe.c);
      continue;
    }
    if (foe.flash > 0) foe.flash -= dt;
    const away = far(foe, pal);
    if (foe.wild) {
      if (!foe.angry && away < 46 && !me.riding) {
        foe.angry = true;
        see(foe.c.id, false);
        float(foe.x, foe.y - 36, "!", "#ff5a5a");
        sfx.alert();
      }
      if (foe.angry && (away > 230 || me.riding)) {
        foe.angry = false;
        foe.wind = null;
        foe.c.hp = maxHp(foe.c);
        marks = marks.filter((mark) => mark.foe !== foe);
      }
      if (!foe.angry && !foe.legend && away > 780) {
        foes.splice(foes.indexOf(foe), 1);
        continue;
      }
    }
    if (foe.angry || !foe.wild) foeFights(foe, dt);
    else if (!foe.legend) {
      if ((foe.think -= dt) <= 0) {
        foe.think = rnd(1, 3);
        const turn = Math.random() * 6.283, speed = Math.random() < 0.35 ? 0 : 20;
        foe.vx = Math.cos(turn) * speed;
        foe.vy = Math.sin(turn) * speed;
      }
      const nx = foe.x + foe.vx * dt * 8, ny = foe.y + foe.vy * dt * 8;
      if (tileAt(nx, ny) <= PLAZA && levelAt(nx, ny) === foe.lv0) {
        foe.x += foe.vx * dt;
        foe.y += foe.vy * dt;
      } else foe.think = 0;
    }
  }
  // Trainers challenge you when you come close
  for (const t of trainers) if (!state.beaten[t.id] && !fight && !raid && far(t, me) < 54 && awake().length && tileAt(me.x, me.y) !== WATER) startFight(t);
  if (fight) {
    const t = fight.trainer;
    if (!fight.actor && (fight.wait -= dt) <= 0) {
      if (!fight.left.length) endFight(true);
      else {
        const next = fight.left.shift();
        fight.actor = { c: next, x: t.x + (me.x < t.x ? -22 : 22), y: t.y + 6, vx: 0, vy: 0, wild: false, angry: true, next: rnd(1, 1.6), wind: null, flash: 0, gone: 0 };
        foes.push(fight.actor);
        see(next.id, false);
        burst(fight.actor.x, fight.actor.y - 10, ["#ffffff", "#ff7a7a"], 16, 70);
        toast(t.name + " sends out " + DEX[next.id].name + " (level " + next.lv + ")!", 3);
      }
    }
    if (fight && far(t, me) > 320) {
      endFight(false);
      toast("You ran too far away, so the battle is off.", 3);
    }
  }
  if (raid && far(raid.elder, me) > 420) {
    endElder(false);
    toast("You ran too far away, and the Elder went back to sleep.", 3);
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
  // Space: use whatever you are standing next to
  const door = buildings.find((b) => far(b.door, me) < 24);
  const elder = !raid && ELDERS.find((each) => !state[each.gives] && far(each, me) < 70);
  const leader = door && door.kind === "hall" ? leaders.find((who) => who.town === door.town) : null;
  const ask = fight || raid ? "" : elder ? "Space: wake " + elder.name + " (a giant " + DEX[elder.id].name + ", level " + elder.lv + ")"
    : !door ? "" : door.kind === "heal" ? "Space: rest at the healing house" : door.kind === "shop" ? "Space: buy 5 capture orbs for 150 coins (you have " + state.coins + ")"
    : state.badges[leader.hall.badge] ? "" : leader.hall.champion ? "Space: challenge " + leader.name + "!" : "Space: take the " + door.town.name + " Trial against " + leader.name;
  if (el("prompt").textContent !== ask) {
    el("prompt").textContent = ask;
    el("prompt").hidden = !ask;
  }
  if (chose() && ask) {
    if (elder) startElder(elder);
    else if (door.kind === "heal") {
      healTeam();
      state.heal = door.door;
      sfx.good();
      toast("A warm meal and a rest. Your whole team is healed!", 3);
      save();
    } else if (door.kind === "shop") {
      if (state.coins < 150) toast("You need 150 coins. Beat wild Wildlings and trainers to earn more.", 3);
      else {
        state.coins -= 150;
        state.orbs += 5;
        sfx.good();
        toast("You bought 5 capture orbs. (" + state.orbs + " orbs, " + state.coins + " coins left)", 3);
        save();
      }
    } else if (leader.hall.champion && badgeCount() < 5) showCard(["Vale: \"The Summit Arena is only for trainers with all five Trial Badges. You have " + badgeCount() + ". Come back when you are ready!\""]);
    else if (!awake().length) toast("Your Wildlings need a rest first.", 3);
    else {
      healTeam();
      startFight(leader);
    }
  }
  const land = landAt(me.x, me.y), near = towns.find((t) => far(t, me) < 170), goal = goalNow();
  const top = [c.id, c.lv, c.hp, state.coins, state.orbs, caughtCount(), badgeCount(), near ? near.name : land.name, goal ? goal.name : "", isNight(), me.riding].join("|");
  if (top !== hudText) {
    hudText = top;
    el("hearts").textContent = "Badges " + badgeCount() + "/5 · " + state.coins + " coins";
    el("rings").textContent = "Orbs " + state.orbs + " · Caught " + caughtCount() + "/" + TOTAL;
    el("place").textContent = (isNight() ? "☾ " : "☀ ") + (near ? near.name : land.name + " (wild levels " + land.lv[0] + " to " + land.lv[1] + ")") + ". " + (goal ? "Next: " + goal.name + "." : "You have done it all!") + (me.riding ? " Riding Zephyrun." : "");
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
    words("L" + c.lv + " " + KINDS[DEX[c.id].kind] + (n === 0 ? " LEADER" : ""), x + 74, y + 24, "#bfe8ff", 6);
    hpBar(c, x + 74, y + 38, 110);
    words(c.hp + "/" + maxHp(c) + " HP", x + 74, y + 50, "#ffffff", 6);
  });
  words("Arrows: choose   Space: make leader   X: close", 240, 272, "#ffffff", 7, "center");
  words("Caught " + caughtCount() + " of " + TOTAL + "   Badges " + badgeCount() + "   At the ranch: " + state.stored, 240, 290, "#fff27a", 7, "center");
  words(KINDS.map((kind, k) => kind + ">" + STRONG[k].map((s) => KINDS[s]).join("+")).slice(0, 4).join("  "), 240, 304, "#bfe8ff", 5, "center");
}
function drawDex() {
  ctx.fillStyle = "#24304e";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  words("WILDDEX   caught " + caughtCount() + " of " + TOTAL, 240, 8, "#fff27a", 9, "center");
  for (let id = 1; id <= TOTAL; id++) {
    const x = 10 + ((id - 1) % 19) * 24.3, y = 26 + Math.floor((id - 1) / 19) * 34;
    ctx.fillStyle = state.dex[id] === 2 ? KIND_COLOUR[DEX[id].kind] : "#1a2238";
    ctx.fillRect(x, y, 22, 30);
    ctx.fillStyle = "#24304e";
    ctx.fillRect(x + 1, y + 1, 20, 28);
    if (state.dex[id] === 2) ctx.drawImage(picture(id), x + 1, y + 1, 20, 20);
    else if (state.dex[id]) ctx.drawImage(darkCopy(picture(id)), x + 1, y + 1, 20, 20);
    words(state.dex[id] ? String(id) : "?", x + 11, y + 22, state.dex[id] === 2 ? "#ffffff" : "#6a7090", 5, "center");
  }
  words("Bright: caught   Shadow: seen   ?: not found yet   Z: close", 240, 304, "#ffffff", 6, "center");
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
    words(DEX[id].name, x + 64, 178, "#ffffff", 8, "center");
    ctx.fillStyle = KIND_COLOUR[DEX[id].kind];
    ctx.fillRect(x + 34, 196, 60, 14);
    words(KINDS[DEX[id].kind], x + 64, 200, "#ffffff", 7, "center");
    words("strong against", x + 64, 218, "#bfe8ff", 5, "center");
    words(STRONG[DEX[id].kind].map((s) => KINDS[s]).join(", "), x + 64, 230, "#bfe8ff", 6, "center");
  });
  words("Left and right: choose     Space: this one!", 240, 276, "#ffffff", 7, "center");
}


// ----- Drawing -----
// The 3D island is drawn by view3d.js. On top of it, this draws the words, the map and the bars.
function drawPlay() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  const aim = target();
  const over = function (x, y, high, text, colour, size) {         // words floating above a place on the island
    const at = VIEW.project(x, y, high + heightAt(x, y));
    if (at) words(text, at.x, at.y, colour, size, "center");
  };
  for (const t of trainers) if (!state.beaten[t.id] && !fight && far(t, me) < 420) over(t.x, t.y, 38 + Math.sin(time * 6) * 2, "!", "#ff5a5a", 10);
  for (const foe of foes) if (foe.gone <= 0 && foe.wind && Math.floor(time * 14) % 2) over(foe.x, foe.y, 40, "!", "#ff5a5a", 10);
  if (fight) over(fight.trainer.x, fight.trainer.y, 38, fight.trainer.name, "#ffffff", 6);
  for (const who of leaders) if (far(who, me) < 300 && !(fight && fight.trainer === who)) over(who.x, who.y, 38, who.name, "#fff27a", 6);
  for (const b of buildings) if (far(b.door, me) < 330) over((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, 52, b.kind === "heal" ? "HEAL" : b.kind === "shop" ? "SHOP" : b.town.hall.champion ? "ARENA" : "TRIAL HALL", b.kind === "heal" ? "#ff9ab8" : b.kind === "shop" ? "#9ac4ff" : "#fff27a", 6);
  for (const elder of ELDERS) if (!state[elder.gives] && !(raid && raid.elder === elder) && far(elder, me) < 620) over(elder.x, elder.y, 96, elder.name.toUpperCase(), "#ffb060", 6);
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2.5);
    over(f.x, f.y + 30, 26 + (0.9 - f.life) * 24, f.text, f.colour, 7);
  }
  ctx.globalAlpha = 1;
  if (surge >= 100 && surging <= 0 && state.team.length && !me.riding) words("F: STARBURST!", 60, 258, Math.floor(time * 6) % 2 ? "#fff27a" : "#ff7ab0", 7);
  // The mini-map in the corner: the land around you, with north at the top
  const goal = fight || raid ? null : goalNow();
  drawMap(382, 8, 90, me.x / TILE, me.y / TILE, 56, goal);
  words("N", 427, 10, "#1d1730", 6, "center");
  if (goal) words(goal.name + " " + Math.round(far(goal, me) / TILE), 427, 104, "#fff27a", 6, "center");
  words("M: big map", 427, goal ? 114 : 104, "#ffffff", 5, "center");
  words(me.riding ? "R: get off" : "R: ride Zephyrun", 427, goal ? 123 : 113, me.riding ? "#fff27a" : "#ffffff", 5, "center");
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
    ctx.fillStyle = n === 0 ? "#8a8ca8" : KIND_COLOUR[DEX[c.id].kind];
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
    words((aim.raid ? "ELDER " : aim.legend ? "RARE " : "") + DEX[aim.c.id].name + " L" + aim.c.lv, 158, 12, aim.raid ? "#e0a0ff" : "#ffffff", 7);
    ctx.fillStyle = KIND_COLOUR[DEX[aim.c.id].kind];
    ctx.fillRect(158, 24, 34, 9);
    words(KINDS[DEX[aim.c.id].kind], 175, 26, "#ffffff", 5, "center");
    hpBar(aim.c, 198, 25, 124);
    if (aim.wild) words("E: throw orb (" + state.orbs + ")", 240, 44, "#fff27a", 6, "center");
  }
}

// The big map (M): the whole island on one screen
function drawBigMap() {
  ctx.fillStyle = "#24304e";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  words("SOLARA", 92, 12, "#fff27a", 9, "center");
  drawMap(184, 12, 288, MID, MID, CW, goalNow(), true);
  const key = function (y, colour, text) {
    ctx.fillStyle = colour;
    ctx.fillRect(12, y, 8, 8);
    words(text, 26, y, "#ffffff", 6);
  };
  key(34, "#ff5a3a", "You");
  key(48, "#fff27a", "Go here next");
  key(62, "#f07898", "Healing house");
  key(76, "#5888e8", "Shop");
  key(90, "#f8c030", "Trial Hall");
  key(104, "#ff8a2a", "Elder");
  key(118, "#ff3c5a", "Trainer");
  key(132, "#c87aff", "Rare Wildling");
  words("Badges " + badgeCount() + " of 5", 12, 156, "#fff27a", 6);
  words("Zephyrun can:", 12, 174, "#ffffff", 6);
  words(state.swim ? "swim" : "swim (not yet)", 20, 186, state.swim ? "#9af0a0" : "#8a8ca8", 6);
  words(state.climb ? "climb" : "climb (not yet)", 20, 198, state.climb ? "#9af0a0" : "#8a8ca8", 6);
  words(state.dash ? "dash" : "dash (not yet)", 20, 210, state.dash ? "#9af0a0" : "#8a8ca8", 6);
  words("M: close", 12, 296, "#ffffff", 6);
}

// The outfit designer: the 3D camera zooms in on you, and this draws the list of choices
function drawOutfit() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  panel(8, 12, 236, 296);
  words("DESIGN YOUR OUTFIT", 126, 24, "#fff27a", 9, "center");
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
      } else mode = "choose";
    }
  } else if (mode === "choose") {
    if (tapped("right")) pick = (pick + 1) % 3;
    if (tapped("left")) pick = (pick + 2) % 3;
    if (chose()) {
      const first = newCreature([1, 4, 7][pick], 5);
      state.team = [first];
      see(first.id, true);
      mode = "play";
      sfx.win();
      showCard(["You and " + DEX[first.id].name + " step out into the sunshine of Solara. The whole island is yours to explore!",
        "Your ride, Zephyrun, is waiting. Press R to hop on: it is much faster than walking. One day it may learn to swim and climb, too.",
        "Battles happen in real time. Press 1, 2 and 3 to attack. When a red mark appears on the ground, move away: your Wildling follows you out of danger.",
        "Wild Wildlings roam everywhere. Weaken one, then press E to throw a capture orb.",
        "Follow the yellow diamond on the map. First: the Trial Hall here in Sunvale. Good luck!"], save);
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
  else if (mode === "map" && (pressed("KeyM") || wentBack() || chose())) mode = "play";
}
function draw() {
  if (mode === "play" || mode === "outfit" || mode === "title") VIEW.render();
  if (mode === "team") drawTeam();
  else if (mode === "dex") drawDex();
  else if (mode === "choose") drawChoose();
  else if (mode === "outfit") drawOutfit();
  else if (mode === "map") drawBigMap();
  else if (mode === "title") ctx.clearRect(0, 0, VIEW_W, VIEW_H);
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
  foes = [];
  state = saved ? Object.assign(freshState(), saved) : freshState();
  Object.assign(me, { x: (saved && state.x) || START.x, y: (saved && state.y) || START.y, face: Math.PI, riding: false });
  if (tileAt(me.x, me.y) > PLAZA) Object.assign(me, { x: START.x, y: START.y });
  me.h = heightAt(me.x, me.y);
  Object.assign(pal, { x: me.x - 14, y: me.y });
  mode = saved ? "play" : "outfit";
  pick = 0;
  clock = 0.1;
  addLegends();
}
el("start").addEventListener("click", () => begin(null));
el("continue").addEventListener("click", () => begin(loadSave()));
el("continue").hidden = !loadSave();
VIEW.build();
requestAnimationFrame(frame);

// Only for testing the game.
window.WH = {
  get state() { return state; },
  get mode() { return mode; },
  get fight() { return fight; },
  get raid() { return raid; },
  get foes() { return foes; },
  get marks() { return marks; },
  get clock() { return clock; },
  set clock(value) { clock = value; },
  get look() { return look; },
  set look(value) { look = value; },
  me: me, pal: pal, keys: keys, DEX: DEX, newCreature: newCreature, maxHp: maxHp, target: target, card: () => card, surge: (n) => (surge = n), surging: () => surging, cool: () => cool,
  towns: towns, buildings: buildings, trainers: trainers, leaders: leaders, ELDERS: ELDERS, LEGENDS: LEGENDS, tiles: tiles, level: level, goal: goalNow,
};
