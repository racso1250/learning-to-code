// Rings of Power: the game.
// The world comes from story.js (built by ../dragon/mapkit.js), the sprites from ../dragon/pixels.js
// and the painted ground from ../dragon/ground.js. This file is everything that moves.

const VIEW_W = 480;      // a finer picture than Dragon Tamers: more pixels, so more detail and more of the world on screen
const VIEW_H = 320;
const canvas = document.getElementById("game");
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const SPR = buildSprites();
const water = makeLiquid(["#2468b8", "#2f7fd0", "#4a9ae6", "#b8e4ff"], false);
const waterStreaks = makeLiquid(["#2468b8", "#2f7fd0", "#4a9ae6", "#b8e4ff"], true);
// For the fancy effects: shadows, glows, light rays and a soft "bloom" on bright things
const shadowCanvas = makeCanvas(VIEW_W, VIEW_H);
const shadowCtx = shadowCanvas.getContext("2d");
shadowCtx.imageSmoothingEnabled = false;
const bloomCanvas = makeCanvas(VIEW_W / 4, VIEW_H / 4);
const bloomCtx = bloomCanvas.getContext("2d");
const darkCopies = new Map();
function darkCopy(img) {
  if (!darkCopies.has(img)) darkCopies.set(img, tinted(img, "#1a1238"));
  return darkCopies.get(img);
}
const rays = (function () {
  const picture = makeCanvas(960, VIEW_H);
  const g = picture.getContext("2d");
  for (let i = 0; i < 12; i++) {
    const x = (i % 3) * 80 + Math.floor(i / 3) * 240 + [0, 14, -10][i % 3];
    const w = [26, 12, 40][i % 3];
    const fade = g.createLinearGradient(0, 0, 0, VIEW_H);
    fade.addColorStop(0, "rgba(255, 246, 210, 1)");
    fade.addColorStop(1, "rgba(255, 246, 210, 0)");
    g.fillStyle = fade;
    g.beginPath();
    g.moveTo(x + 190, 0);
    g.lineTo(x + 190 + w, 0);
    g.lineTo(x + w * 1.6, VIEW_H);
    g.lineTo(x, VIEW_H);
    g.fill();
  }
  return picture;
})();
const SWAY = { oak: [16, 30], doomtree: [12, 22], pine: [14, 28], snowpine: [14, 28], palm: [18, 30] };
const GLOW_OF = ["fire", "cyan", "white", "warm", "warm"];      // the colour of light each ring gives off
const lavaFlow = makeLiquid(["#d83a12", "#ff7a1a", "#ffb52e", "#fff0a0"], false);
const el = (id) => document.getElementById(id);
const centre = (square) => square * TILE + TILE / 2;
const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]];      // facing: down, left, right, up
const hero = SPR.galadriel;

function sound(make) {
  try { make(); } catch (error) { /* no sound: the game still works */ }
}
const sfx = {
  swing: () => sound(() => playNoise(0, 0.08, 2400, 700, 0.12)),
  hit: () => sound(() => playTone(0, 0.08, 240, 110, 0.16)),
  hurt: () => sound(() => playTone(0, 0.22, 210, 70, 0.22)),
  pick: () => sound(() => playTone(0, 0.09, 700, 1050, 0.12)),
  fire: () => sound(() => playNoise(0, 0.3, 1100, 200, 0.2)),
  frost: () => sound(() => playTone(0, 0.3, 1400, 700, 0.1)),
  gale: () => sound(() => playNoise(0, 0.35, 3000, 900, 0.18)),
  quake: () => sound(() => { playNoise(0, 0.5, 300, 60, 0.3); playTone(0, 0.4, 90, 40, 0.25); }),
  dawn: () => sound(() => { playTone(0, 0.5, 500, 1200, 0.15); playTone(0.1, 0.5, 750, 1500, 0.12); }),
  roar: () => sound(() => { playNoise(0, 0.7, 500, 90, 0.3); playTone(0, 0.7, 130, 55, 0.2); }),
  win: () => sound(() => playJingle()),
};

// ----- A few extra pictures -----
function drawRing(colour) {
  const a = new Art(14, 14);
  a.oval(7, 8, 5, 5, "#ffd84a");
  a.oval(7, 8, 2.6, 2.6, "#00000000");
  a.g.clearRect(5, 6, 4, 4);
  a.box(5, 1, 4, 4, colour);
  a.dot(6, 2, "#ffffff");
  return finish(a);
}
function drawMist() {
  const a = new Art(20, 24);
  a.oval(10, 14, 9, 8, "#dfe8f5");
  a.oval(6, 9, 5, 4, "#f4f8fc");
  a.oval(14, 8, 5, 4, "#f4f8fc");
  return finish(a, { outline: "#8a9ab8" });
}
const ringArt = RINGS.map((ring) => drawRing(ring.colour));
const gateArt = { thorns: SPR.thorns[0], flame: scaled(SPR.flame[0], 1.8), mist: drawMist(), boulder: scaled(SPR.rock[0], 1.5) };
const TYPES = {
  slime: { hp: 2, speed: 26 }, bat: { hp: 1, speed: 44, flies: true }, spider: { hp: 2, speed: 50 }, golem: { hp: 5, speed: 18 }, imp: { hp: 2, speed: 30 },
  bogSlime: { hp: 3, speed: 24 }, iceSlime: { hp: 3, speed: 28 }, magmaSlime: { hp: 3, speed: 26 }, scorpion: { hp: 3, speed: 52 }, wraith: { hp: 2, speed: 48, flies: true },
  iceGolem: { hp: 6, speed: 18 }, sandGolem: { hp: 6, speed: 18 }, shade: { hp: 3, speed: 34 },
};

// ----- What the game remembers -----
const SAVE_NAME = "ringsOfPowerSave";
function newState() {
  return { rings: [], ring: 0, gates: {}, beaten: {}, hp: 8, maxHp: 8, x: centre(PLACES.start.x), y: centre(PLACES.start.y) + 2, met: false, won: false };
}
let state = newState();
function save() {
  state.x = player.x;
  state.y = player.y;
  try { localStorage.setItem(SAVE_NAME, JSON.stringify(state)); } catch (error) { /* keep playing */ }
}
function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_NAME));
    return saved && Array.isArray(saved.rings) ? Object.assign(newState(), saved) : null;
  } catch (error) { return null; }
}

const player = { x: 0, y: 0, dir: 0, anim: 0, moving: false, swing: 0, safe: 0, shield: 0, dash: 0, mana: 10 };
let aim = { x: 0, y: 1 };
let monsters = [];
let shots = [];
let bits = [];
let drops = [];        // a ring lying where its giant fell
let boss = null;
let cam = { x: 0, y: 0 };
let time = 0;
let playing = false;
let paused = false;
let shake = 0;
let glow = 0;          // the screen flashes when a ring's power goes off
let pickedAt = {};

// Every tree, house and rock, ready to draw
const rows = [];
for (let y = 0; y < MAP_H; y++) rows.push([]);
for (const o of WORLD.objects) {
  let img;
  if (o.type === "gate") img = gateArt[o.look];
  else {
    const list = SPR[o.type === "peak" ? (o.snowy ? "snowpeak" : "peak") : o.type];
    img = list[(typeof o.look === "number" ? o.look : Math.floor(hash(o.x, o.y, 5) * list.length)) % list.length];
  }
  const natural = ["oak", "pine", "snowpine", "doomtree", "ashtree", "bush", "rock", "mushroom", "skull", "spike", "cactus", "icespire"].includes(o.type);
  const bx = (o.x + o.w / 2) * TILE + (natural ? Math.round((hash(o.x, o.y, 6) - 0.5) * 6) : 0);
  const by = (o.y + 1) * TILE + (o.type === "peak" ? 3 + Math.round(hash(o.x, o.y, 8) * 5) : natural ? -Math.round(hash(o.x, o.y, 7) * 4) : 0);
  rows[o.y].push({ o: o, img: img, x: Math.round(bx - img.width / 2), y: by - img.height, bx: bx, by: by });
}
const npcs = STORY.npcs;
for (const npc of npcs) {
  npc.px = centre(npc.x);
  npc.py = centre(npc.y) + 2;
}

function setUp(saved) {
  state = saved || newState();
  Object.assign(player, { x: state.x, y: state.y, dir: 0, mana: 10, safe: 0 });
  for (const o of WORLD.objects) if (o.type === "gate") WORLD.blocked[o.y][o.x] = !state.gates[o.id];
  monsters = WORLD.monsters.filter((spot) => TYPES[spot.type]).map((spot) => ({ type: spot.type, x: centre(spot.x), y: centre(spot.y), homeX: centre(spot.x), homeY: centre(spot.y), hp: TYPES[spot.type].hp, flash: 0, frozen: 0, dead: 0, vx: 0, vy: 0, think: 0 }));
  shots = [];
  bits = [];
  drops = [];
  boss = null;
  cam.x = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, player.x - VIEW_W / 2));
  cam.y = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, player.y - VIEW_H / 2));
  hudText = "";
}

// ----- Keyboard -----
const keys = {};
const justPressed = {};
const MOVE_KEYS = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
document.addEventListener("keydown", function (event) {
  if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
  if (!keys[event.code]) justPressed[event.code] = true;
  keys[event.code] = true;
});
document.addEventListener("keyup", (event) => (keys[event.code] = false));
const held = (name) => Object.keys(MOVE_KEYS).some((code) => MOVE_KEYS[code] === name && keys[code]);
function pressed(code) {
  const yes = justPressed[code];
  justPressed[code] = false;
  return yes;
}

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
  if (!pressed("Space") && !pressed("Enter")) return;
  card.index++;
  if (card.index < card.lines.length) return (el("card-text").textContent = card.lines[card.index]);
  const done = card.done;
  card = null;
  el("card").hidden = true;
  if (done) done();
}

function spark(x, y, vx, vy, life, colour) {
  if (bits.length < 400) bits.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, colour: colour });
}
function burst(x, y, colours, count, speed) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.3 + Math.random() * 0.7);
    spark(x, y, Math.cos(angle) * power, Math.sin(angle) * power, 0.3 + Math.random() * 0.5, colours[Math.floor(Math.random() * colours.length)]);
  }
}

function solidAt(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || WORLD.blocked[ty][tx];
}
const canStand = (x, y) => !solidAt(x - 4, y - 5) && !solidAt(x + 4, y - 5) && !solidAt(x - 4, y + 1) && !solidAt(x + 4, y + 1);

// ----- Fighting -----
function hurtMonster(m, power, fromX, fromY) {
  m.hp -= power;
  m.flash = 0.15;
  const away = Math.atan2(m.y - fromY, m.x - fromX);
  m.vx = Math.cos(away) * 90;
  m.vy = Math.sin(away) * 90;
  m.think = 0.25;
  sfx.hit();
  if (m.hp > 0) return;
  m.dead = 45;
  burst(m.x, m.y - 6, ["#ffffff", "#c8c0e0", "#8a7ab0"], 12, 60);
  if (Math.random() < 0.3 && state.hp < state.maxHp) {
    state.hp++;
    toast("A heart!", 1.5);
  }
}
function hurtBoss(power) {
  if (!boss || !boss.awake) return;
  boss.hp -= power;
  boss.flash = 0.12;
  sfx.hit();
  el("boss-fill").style.width = Math.max(0, (boss.hp / boss.def.hp) * 100) + "%";
  if (boss.hp > 0) return;
  // The giant falls, and drops its ring
  burst(boss.x, boss.y - 20, ["#ffffff", "#ffd84a", "#ff8ab0"], 80, 140);
  shake = 0.8;
  sfx.roar();
  state.beaten[boss.def.id] = true;
  drops.push({ ring: boss.def.id, x: boss.x, y: boss.y });
  el("boss-bar").hidden = true;
  shots = [];
  boss = null;
  save();
}
// Hurt everything near a spot (monsters and the giant)
function strike(x, y, reach, power) {
  for (const m of monsters) if (m.dead <= 0 && Math.hypot(m.x - x, m.y - 6 - y) < reach + 6) hurtMonster(m, power, player.x, player.y);
  if (boss && Math.hypot(boss.x - x, boss.y - 12 - y) < reach + 22) hurtBoss(power + 1);      // your blows count double against a giant
}
function hurtPlayer(amount, fromX, fromY) {
  if (player.safe > 0 || player.shield > 0) return;
  state.hp -= amount;
  player.safe = 1;
  shake = 0.3;
  sfx.hurt();
  el("hurt").style.opacity = 1;
  setTimeout(() => (el("hurt").style.opacity = 0), 150);
  const away = Math.atan2(player.y - fromY, player.x - fromX);
  for (let i = 0; i < 10; i++) if (canStand(player.x + Math.cos(away) * 1.5, player.y + Math.sin(away) * 1.5)) {
    player.x += Math.cos(away) * 1.5;
    player.y += Math.sin(away) * 1.5;
  }
  if (state.hp > 0) return;
  // Out of hearts: back to the village to rest
  state.hp = state.maxHp;
  Object.assign(player, { x: centre(PLACES.start.x), y: centre(PLACES.start.y) + 2, safe: 3 });
  if (boss) {
    boss = null;
    el("boss-bar").hidden = true;
  }
  shots = [];
  toast("You fell! Elrond's folk carried you back to Ringhaven.", 5);
}

// Is there a closed gate just in front of you? (Gates only open to one ring's power.)
function gateAhead() {
  const fx = player.x + DIRS[player.dir][0] * 18;
  const fy = player.y - 4 + DIRS[player.dir][1] * 18;
  return WORLD.objects.find((o) => o.type === "gate" && !state.gates[o.id] && Math.hypot(centre(o.x) - fx, centre(o.y) - fy) < 22);
}

// X: use the power of the ring you are wearing
function usePower() {
  if (!state.rings.length) return toast("You have no ring of power yet. The first is in Cinder Hollow, to the east.");
  const ring = RINGS[state.ring];
  if (player.mana < ring.cost) return toast("Your ring needs a moment to gather its power.", 1.5);
  player.mana -= ring.cost;
  glow = 0.25;
  const dx = aim.x, dy = aim.y;
  const gate = gateAhead();
  if (gate) {
    if (gate.needs === state.ring + 1) {
      for (const o of WORLD.objects) if (o.type === "gate" && o.id === gate.id) WORLD.blocked[o.y][o.x] = false;
      state.gates[gate.id] = true;
      burst(centre(gate.x), centre(gate.y), [ring.colour, "#ffffff"], 40, 90);
      shake = 0.4;
      sfx.win();
      toast("The " + ring.name + " opens the way to " + REGION_NAMES[gate.id] + "!", 4);
      save();
    } else toast("The " + ring.name + " does nothing to this. It needs the " + RINGS[gate.needs - 1].name + ".", 4);
  }
  if (state.ring === 0) {
    shots.push({ x: player.x + dx * 8, y: player.y - 8 + dy * 6, vx: dx * 200, vy: dy * 200, life: 0.9, power: 3, colour: "#ff7a1a" });
    sfx.fire();
  } else if (state.ring === 1) {
    // A cone of frost: freezes what it touches
    for (let i = 0; i < 26; i++) spark(player.x + dx * 10, player.y - 8, (dx + (Math.random() - 0.5) * 0.8) * 130, (dy + (Math.random() - 0.5) * 0.8) * 130, 0.4, i % 2 ? "#bfe8ff" : "#ffffff");
    for (const m of monsters) {
      const mx = m.x - player.x, my = m.y - player.y, far = Math.hypot(mx, my) || 1;
      if (m.dead <= 0 && far < 70 && (mx * dx + my * dy) / far > 0.5) {
        m.frozen = 3.5;
        hurtMonster(m, 1, player.x, player.y);
      }
    }
    if (boss && Math.hypot(boss.x - player.x, boss.y - player.y) < 80) hurtBoss(2);
    sfx.frost();
  } else if (state.ring === 2) {
    player.dash = 0.22;       // rush forward, blowing everything aside
    player.safe = Math.max(player.safe, 0.4);
    strike(player.x + dx * 30, player.y - 6 + dy * 30, 34, 2);
    sfx.gale();
  } else if (state.ring === 3) {
    shake = 0.5;
    player.shield = 2;
    burst(player.x, player.y - 4, ["#c8a468", "#8a6a3a", "#ffffff"], 40, 110);
    strike(player.x, player.y - 6, 52, 3);
    sfx.quake();
  } else {
    glow = 0.6;
    burst(player.x, player.y - 8, ["#ffe14a", "#ffffff", "#fff6c0"], 70, 170);
    strike(player.x, player.y - 6, 90, 5);
    sfx.dawn();
  }
}

function talk(npc) {
  const has = state.rings.length;
  if (npc.id === "elrond") {
    if (!state.met) {
      state.met = true;
      return showCard(["Elrond: \"Galadriel. You came. The five rings of power have been stolen.\"", "\"Each was carried off by a giant, to a different land. And the last... the last is with Sauron, in the Shadow Keep.\"", "\"Take the east road to Cinder Hollow. The Ember Ring is there. Its fire will burn the thorns that block the road beyond.\"", "\"Each ring you win will open the way to the next. Go well.\""], save);
    }
    return showCard(["Elrond: \"" + (has >= 5 ? "All five rings, and the Shadow gone. The land will sing of this, Galadriel." : has === 0 ? "The Ember Ring is in Cinder Hollow, along the east road." : "You carry " + has + " of the five. Stand before a gate, choose the right ring with the number keys, and press X.") + "\""]);
  }
  if (npc.id === "smith") return showCard(["Celebrimbor: \"I forged those rings. Ember, Frost, Gale, Stone and Dawn.\"", "\"" + (has ? "Wear one, and its power is yours: press X. They need a moment between uses." : "Bring one back and I will show you how to wake its power.") + "\""]);
  showCard(["Durin: \"A Stone Giant in MY halls! It has the Stone Ring. Knock it down for me, Elf, and Stonedeep is your friend for ever.\""]);
}

let hudText = "";
function update(dt) {
  time += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) el("toast").hidden = true;
  if (shake > 0) shake -= dt;
  if (glow > 0) glow -= dt;
  if (card) return updateCard();
  if (pressed("KeyP")) paused = !paused;
  if (paused) return toast("Paused. Press P to keep playing.", 0.3);
  for (const key of ["safe", "shield", "swing", "dash"]) if (player[key] > 0) player[key] -= dt;
  player.mana = Math.min(10, player.mana + dt * 1.2);
  // Moving
  let ax = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
  let ay = (held("down") ? 1 : 0) - (held("up") ? 1 : 0);
  player.moving = ax !== 0 || ay !== 0;
  if (player.moving) {
    const length = Math.hypot(ax, ay);
    aim = { x: ax / length, y: ay / length };
    player.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 1 : 2) : ay < 0 ? 3 : 0;
    player.anim += dt;
  }
  if (player.moving || player.dash > 0) {
    const speed = player.dash > 0 ? 330 : 82;
    if (canStand(player.x + aim.x * speed * dt, player.y)) player.x += aim.x * speed * dt;
    if (canStand(player.x, player.y + aim.y * speed * dt)) player.y += aim.y * speed * dt;
    if (player.dash > 0) spark(player.x, player.y - 8, 0, 0, 0.3, "#a8f0c8");
  }
  // Rings: 1 to 5 choose one, X uses it
  for (let i = 0; i < 5; i++) if (pressed("Digit" + (i + 1)) && state.rings.includes(i)) {
    state.ring = i;
    toast(RINGS[i].name + ". " + RINGS[i].power + ".", 3);
  }
  if (pressed("KeyX")) usePower();
  // Space: talk, pick berries, or swing your sword
  const fx = player.x + DIRS[player.dir][0] * 12;
  const fy = player.y - 4 + DIRS[player.dir][1] * 12;
  const who = npcs.find((npc) => Math.hypot(npc.px - fx, npc.py - 4 - fy) < 18);
  let bush = null;
  for (const thing of rows[Math.floor(fy / TILE)] || []) if (thing.o.type === "berrybush" && !(time - pickedAt[thing.o.id] < 40) && Math.hypot(thing.bx - fx, thing.by - 8 - fy) < 18) bush = thing.o;
  const gate = gateAhead();
  const label = who ? "Space: talk to " + who.name : bush ? "Space: eat some berries" : gate ? "This needs the " + RINGS[gate.needs - 1].name + (state.rings.includes(gate.needs - 1) ? ": press " + gate.needs + ", then X" : "") : "";
  if (el("prompt").textContent !== label) {
    el("prompt").textContent = label;
    el("prompt").hidden = !label;
  }
  if (pressed("Space")) {
    if (who) talk(who);
    else if (bush) {
      pickedAt[bush.id] = time;
      state.hp = Math.min(state.maxHp, state.hp + 2);
      sfx.pick();
      toast("Berries: +2 hearts.", 2);
    } else if (player.swing <= 0) {
      player.swing = 0.25;
      sfx.swing();
      strike(player.x + DIRS[player.dir][0] * 14, player.y - 6 + DIRS[player.dir][1] * 14, 16, 1 + Math.floor(state.rings.length / 2));
    }
  }
  // A ring lying on the ground
  for (const drop of drops.slice()) {
    if (Math.hypot(drop.x - player.x, drop.y - player.y) > 14) continue;
    drops.splice(drops.indexOf(drop), 1);
    state.rings.push(drop.ring);
    state.ring = drop.ring;
    state.maxHp++;
    state.hp = state.maxHp;
    sfx.win();
    const ring = RINGS[drop.ring];
    if (drop.ring < 4) showCard(["You have won the " + ring.name + "!", ring.power + ". Press X to use it.", "It gives you one more heart. And somewhere ahead, a gate is waiting for its power."], save);
    else {
      state.won = true;
      showCard(["Sauron falls, and the Dawn Ring rolls from his hand.", "You slip it on. Light pours out across the Shadow Keep, and the darkness burns away like mist.", "All five rings of power are home again.", "THE END. (You can keep exploring, with every ring's power!)"], save);
    }
  }
  // Monsters
  const nearHome = Math.hypot(player.x - centre(PLACES.start.x), player.y - centre(PLACES.start.y)) < 12 * TILE;
  for (const m of monsters) {
    const type = TYPES[m.type];
    if (m.dead > 0) {
      if ((m.dead -= dt) <= 0) {
        if (Math.hypot(m.homeX - player.x, m.homeY - player.y) < 230) m.dead = 5;
        else Object.assign(m, { hp: type.hp, x: m.homeX, y: m.homeY });
      }
      continue;
    }
    const dx = player.x - m.x, dy = player.y - m.y, far = Math.hypot(dx, dy) || 1;
    if (far > 300) continue;
    m.flash -= dt;
    if (m.frozen > 0) {
      m.frozen -= dt;
      continue;
    }
    if ((m.think -= dt) <= 0 && !(far < 80 && !nearHome)) {
      m.think = 1 + Math.random() * 2;
      const back = Math.hypot(m.homeX - m.x, m.homeY - m.y) > 40;
      const angle = back ? Math.atan2(m.homeY - m.y, m.homeX - m.x) : Math.random() * 6.28;
      m.vx = Math.cos(angle) * type.speed * 0.5;
      m.vy = Math.sin(angle) * type.speed * 0.5;
    } else if (m.think <= 0) {
      m.vx = (dx / far) * type.speed;
      m.vy = (dy / far) * type.speed;
    }
    if (type.flies || !solidAt(m.x + m.vx * dt, m.y - 2)) m.x += m.vx * dt;
    if (type.flies || !solidAt(m.x, m.y + m.vy * dt - 2)) m.y += m.vy * dt;
    if (far < 10) hurtPlayer(1, m.x, m.y);
  }
  // The giant of this land
  if (!boss) {
    const def = STORY.bosses.find((b) => !state.beaten[b.id] && Math.hypot(centre(b.x) - player.x, centre(b.y) - player.y) < 400);
    if (def) boss = { def: def, x: centre(def.x), y: centre(def.y), hp: def.hp, awake: false, flash: 0, cool: 2, t: 0 };
  } else {
    const dx = player.x - boss.x, dy = player.y - boss.y, far = Math.hypot(dx, dy) || 1;
    boss.flash -= dt;
    if (!boss.awake && far < 140) {
      boss.awake = true;
      toast(boss.def.name + " awakes!", 4);
      sfx.roar();
      shake = 0.5;
      el("boss-bar").hidden = false;
      el("boss-bar").querySelector("span").textContent = boss.def.name;
      el("boss-fill").style.width = "100%";
    } else if (far > 420) {
      boss = null;
      el("boss-bar").hidden = true;
    } else if (boss.awake) {
      boss.t += dt;
      const angry = boss.hp < boss.def.hp / 2;
      const speed = (17 + boss.def.id) * (angry ? 1.2 : 1);       // giants are slow: you can always walk away from one
      if (far > 22) {
        if (!solidAt(boss.x + (dx / far) * speed * dt, boss.y)) boss.x += (dx / far) * speed * dt;
        if (!solidAt(boss.x, boss.y + (dy / far) * speed * dt)) boss.y += (dy / far) * speed * dt;
      }
      if ((boss.cool -= dt) <= 0) {
        boss.cool = angry ? 3 : 3.8;
        const count = angry ? 8 : 6;
        for (let i = 0; i < count; i++) shots.push({ x: boss.x, y: boss.y - 6, vx: Math.cos((i / count) * 6.283 + boss.t) * 42, vy: Math.sin((i / count) * 6.283 + boss.t) * 42, life: 2.4, foe: true, colour: "#b03ad8" });
        shake = 0.2;
      }
      if (far < 20) hurtPlayer(1, boss.x, boss.y);
    }
  }
  // Fire bolts and the giants' dark fire
  for (const shot of shots) {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.foe) {
      if (Math.hypot(player.x - shot.x, player.y - 6 - shot.y) < 8) {
        shot.life = 0;
        hurtPlayer(1, shot.x, shot.y);
      }
    } else {
      const m = monsters.find((other) => other.dead <= 0 && Math.hypot(other.x - shot.x, other.y - 8 - shot.y) < 10);
      if (m) {
        shot.life = 0;
        hurtMonster(m, shot.power, shot.x, shot.y);
      } else if (boss && boss.awake && Math.hypot(boss.x - shot.x, boss.y - 14 - shot.y) < 26) {
        shot.life = 0;
        hurtBoss(shot.power);
      }
      if (shot.life <= 0) burst(shot.x, shot.y, [shot.colour, "#ffffff"], 8, 50);
    }
  }
  shots = shots.filter((shot) => shot.life > 0);
  for (const bit of bits) {
    bit.life -= dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
  }
  bits = bits.filter((bit) => bit.life > 0);
  // The top bar
  const next = state.rings.length;
  const goal = state.won ? "All five rings are home. The land is safe!" : !state.met ? "Talk to Elrond in the village square." : "Win the " + RINGS[next].name + " from " + STORY.bosses[next].name + " in " + REGION_NAMES[STORY.bosses[next].region] + ".";
  const all = [state.hp, state.maxHp, state.rings.join(), state.ring, goal].join("|");
  if (all !== hudText) {
    hudText = all;
    el("hearts").textContent = "♥".repeat(Math.max(0, state.hp)) + "♡".repeat(Math.max(0, state.maxHp - state.hp));
    el("rings").innerHTML = state.rings.length ? state.rings.slice().sort().map((i) => '<span class="' + (i === state.ring ? "picked" : "") + '" style="color:' + RINGS[i].colour + '">' + (i + 1) + " " + RINGS[i].name.split(" ")[0] + "</span>").join("") : "No rings yet";
    el("place").textContent = "➤ " + goal;
  }
  el("mana-fill").style.width = player.mana * 10 + "%";
  if (Math.floor(time / 8) !== Math.floor((time - dt) / 8)) save();
}

// ----- Drawing -----
const TINTS = { doom: "#9aa8c0", isle: "#ffd0c0", crag: "#e6eeff", ice: "#e0f0ff", desert: "#fff0d0", shadow: "#a890c8", marsh: "#c0d8c8" };
function draw() {
  const goX = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, player.x - VIEW_W / 2));
  const goY = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, player.y - 14 - VIEW_H / 2));
  cam.x += (goX - cam.x) * 0.18;
  cam.y += (goY - cam.y) * 0.18;
  const jolt = shake > 0 ? shake * 6 : 0;
  const sx = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, Math.round(cam.x + (Math.random() - 0.5) * jolt)));
  const sy = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, Math.round(cam.y + (Math.random() - 0.5) * jolt)));
  const mod = (n, size) => ((n % size) + size) % size;
  const lights = [];      // things that glow
  const casts = [];       // things that cast a shadow
  for (let y = -mod(sy + Math.floor(time * 2), 64); y < VIEW_H; y += 64) for (let x = -mod(sx + Math.floor(time * 5), 64); x < VIEW_W; x += 64) ctx.drawImage(water, 0, 0, 64, 64, x, y, 64, 64);
  const tx0 = Math.floor(sx / TILE), ty0 = Math.floor(sy / TILE);
  for (let ty = ty0; ty <= ty0 + VIEW_H / TILE; ty++) for (let tx = tx0; tx <= tx0 + VIEW_W / TILE + 1; tx++) {
    if (ty >= MAP_H || tx >= MAP_W) continue;
    if (WORLD.ground[ty][tx] === "L" && (tx + ty) % 2 === 0) lights.push({ x: centre(tx), y: centre(ty), r: 34, kind: "fire", a: 0.16 });
    if (WORLD.ground[ty][tx] === "W" && hash(tx, ty, Math.floor(time * 1.5)) < 0.06) {
      ctx.fillStyle = "#ffffff";       // a sparkle on the water
      ctx.fillRect(tx * TILE - sx + 6, ty * TILE - sy + 7, 3, 1);
      ctx.fillRect(tx * TILE - sx + 7, ty * TILE - sy + 6, 1, 3);
    }
    if (WORLD.ground[ty][tx] === "L") ctx.drawImage(lavaFlow, mod(tx * TILE + Math.floor(time * 4), 64), mod(ty * TILE + Math.floor(time * 2), 64), TILE, TILE, tx * TILE - sx, ty * TILE - sy, TILE, TILE);
  }
  for (let y = -mod(sy - Math.floor(time * 1.6), 64); y < VIEW_H; y += 64) for (let x = -mod(sx - Math.floor(time * 9), 64); x < VIEW_W; x += 64) ctx.drawImage(waterStreaks, 0, 0, 64, 64, x, y, 64, 64);
  const pieces = [];
  for (let cy = Math.floor(sy / CHUNK_PIXELS); cy <= Math.floor((sy + VIEW_H - 1) / CHUNK_PIXELS); cy++) for (let cx = Math.floor(sx / CHUNK_PIXELS); cx <= Math.floor((sx + VIEW_W - 1) / CHUNK_PIXELS); cx++) pieces.push({ chunk: groundChunk(cx, cy), x: cx * CHUNK_PIXELS - sx, y: cy * CHUNK_PIXELS - sy });
  for (const piece of pieces) if (!piece.chunk.dry) ctx.drawImage(piece.chunk.shore, piece.x, piece.y);
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 1.8);
  for (const piece of pieces) if (!piece.chunk.dry) ctx.drawImage(piece.chunk.foam, piece.x, piece.y);
  ctx.globalAlpha = 1;
  for (const piece of pieces) ctx.drawImage(piece.chunk.ground, piece.x, piece.y);
  // Everything that stands on the ground, back to front
  const list = [];
  const put = (img, x, y, sort, tint, sway) => list.push({ img: img, x: Math.round(x - sx), y: Math.round(y - sy), sort: sort, tint: tint, sway: sway });
  const cast = (img, x, y) => casts.push({ img: img, x: Math.round(x - sx), y: Math.round(y - sy) });
  ctx.fillStyle = "rgba(24, 16, 48, 0.26)";
  const shadow = function (x, y, w) {
    ctx.beginPath();
    ctx.ellipse(x - sx, y - sy, w, w * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let ty = Math.max(0, ty0 - 1); ty <= Math.min(MAP_H - 1, ty0 + VIEW_H / TILE + 5); ty++) {
    for (const thing of rows[ty]) {
      if (thing.x + thing.img.width < sx || thing.x > sx + VIEW_W) continue;
      const o = thing.o;
      if (o.type === "gate" && state.gates[o.id]) continue;
      let img = thing.img;
      if (o.type === "berrybush" && time - pickedAt[o.id] < 40) img = SPR.bush[0];
      if (o.type === "gate" && o.look === "flame") img = scaledFlames[Math.floor(time * 8) % 3];
      const bands = SWAY[o.type];
      put(img, thing.x, thing.y + (o.type === "gate" && o.look === "mist" ? Math.sin(time * 2 + o.x) * 2 : 0), thing.by, null, bands ? { bands: bands, by: Math.sin(time * 1.4 + thing.bx * 0.06 + thing.by * 0.04) * 1.8 } : null);
      if (o.type !== "peak" && o.type !== "gate") cast(img, thing.bx, thing.by - 1);
      if (o.type === "lantern") lights.push({ x: thing.bx, y: thing.by - 17, r: 40, kind: "warm", a: 0.3 });
      if (o.type === "mushroom") lights.push({ x: thing.bx, y: thing.by - 8, r: 22, kind: "cyan", a: 0.3 });
      if (o.type === "campfire" || (o.type === "gate" && o.look === "flame")) lights.push({ x: thing.bx, y: thing.by - 12, r: 54, kind: "fire", a: 0.45 });
      if (o.type === "darkpillar") lights.push({ x: thing.bx, y: thing.by - 18, r: 22, kind: "red", a: 0.3 });
    }
  }
  for (const npc of npcs) {
    shadow(npc.px, npc.py - 1, 7);
    put(SPR[npc.look][0][0], npc.px - 10, npc.py - 31, npc.py);
    cast(SPR[npc.look][0][0], npc.px, npc.py + 1);
  }
  for (const m of monsters) {
    if (m.dead > 0 || m.x < sx - 20 || m.x > sx + VIEW_W + 20 || m.y < sy - 20 || m.y > sy + VIEW_H + 30) continue;
    const frames = (m.flash > 0 ? SPR.monstersHurt : SPR.monsters)[m.type];
    const img = frames[m.frozen > 0 ? 0 : Math.floor(time * 4 + m.homeX) % 2];
    const lift = TYPES[m.type].flies ? 8 : 0;
    shadow(m.x, m.y - 1, img.width * 0.34);
    put(img, m.x - img.width / 2, m.y - img.height + 2 - lift, m.y, m.frozen > 0 ? "#8fd8ff" : null);
  }
  if (boss) {
    const giant = SPR.brutes[boss.def.look];
    const img = (boss.flash > 0 ? giant.hurt : giant.frames)[Math.floor(time * 3) % 2];
    shadow(boss.x, boss.y - 1, giant.w * 0.36);
    put(img, boss.x - giant.w / 2, boss.y - giant.feet, boss.y);
    cast(img, boss.x, boss.y - giant.feet + img.height);
    lights.push({ x: boss.x, y: boss.y - giant.feet / 2, r: 80, kind: "red", a: 0.3 + Math.sin(time * 5) * 0.08 });
  }
  for (const drop of drops) {
    put(ringArt[drop.ring], drop.x - 7, drop.y - 16 - Math.abs(Math.sin(time * 3)) * 4, drop.y);
    lights.push({ x: drop.x, y: drop.y - 10, r: 60 + Math.sin(time * 4) * 6, kind: GLOW_OF[drop.ring], a: 0.6 });
  }
  if (!(player.safe > 0 && Math.floor(time * 12) % 2 === 0)) {
    shadow(player.x, player.y - 1, 7);
    const picture = hero[player.dir][player.moving ? Math.floor(player.anim * 8) % 4 : 0];
    put(picture, player.x - 10, player.y - 31, player.y + 0.5);
    cast(picture, player.x, player.y + 1);
    if (state.rings.length) lights.push({ x: player.x, y: player.y - 10, r: 30, kind: GLOW_OF[state.ring], a: 0.18 + Math.sin(time * 3) * 0.05 });      // your ring glows
  }
  // Real shadows: a dark copy of each sprite, laid flat on the ground behind it
  shadowCtx.setTransform(1, 0, 0, 1, 0, 0);
  shadowCtx.clearRect(0, 0, VIEW_W, VIEW_H);
  for (const c of casts) {
    shadowCtx.setTransform(1, 0, -0.55, -0.42, c.x, c.y);
    shadowCtx.drawImage(darkCopy(c.img), -Math.round(c.img.width / 2), -c.img.height);
  }
  ctx.globalAlpha = 0.28;
  ctx.drawImage(shadowCanvas, 0, 0);
  ctx.globalAlpha = 1;
  list.sort((a, b) => a.sort - b.sort);
  for (const item of list) {
    if (item.sway) {
      // A tree swaying in the wind: the trunk stays still, the top leans most
      const [a, b] = item.sway.bands;
      const w = item.img.width, h = item.img.height;
      ctx.drawImage(item.img, 0, b, w, h - b, item.x, item.y + b, w, h - b);
      ctx.drawImage(item.img, 0, a, w, b - a, item.x + Math.round(item.sway.by / 2), item.y + a, w, b - a);
      ctx.drawImage(item.img, 0, 0, w, a, item.x + Math.round(item.sway.by), item.y, w, a);
    } else ctx.drawImage(item.img, item.x, item.y);
    if (item.tint) {
      ctx.globalAlpha = 0.45;      // frozen solid
      ctx.fillStyle = item.tint;
      ctx.fillRect(item.x + 2, item.y + 2, item.img.width - 4, item.img.height - 4);
      ctx.globalAlpha = 1;
    }
  }
  // Your sword, flashing out
  if (player.swing > 0) {
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = player.swing / 0.25;
    const facing = Math.atan2(DIRS[player.dir][1], DIRS[player.dir][0]);
    for (let turn = -0.9; turn <= 0.9; turn += 0.12) ctx.fillRect(Math.round(player.x - sx + Math.cos(facing + turn) * 17), Math.round(player.y - sy - 9 + Math.sin(facing + turn) * 17), 2, 2);
    ctx.globalAlpha = 1;
  }
  if (player.shield > 0) {
    ctx.strokeStyle = "rgba(200, 164, 104, 0.8)";
    ctx.beginPath();
    ctx.ellipse(player.x - sx, player.y - sy - 10, 13, 17, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const shot of shots) {
    ctx.fillStyle = shot.colour;
    ctx.fillRect(Math.round(shot.x - sx) - 2, Math.round(shot.y - sy) - 2, 5, 5);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(shot.x - sx) - 1, Math.round(shot.y - sy) - 1, 2, 2);
    lights.push({ x: shot.x, y: shot.y, r: 26, kind: shot.foe ? "magic" : "fire", a: 0.5 });
  }
  // Weather: snow, embers, drifting leaves or shadow-motes, depending on the land
  const mood = moodAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
  const weather = { ice: ["#ffffff", -10, 30], crag: ["#ffffff", -14, 34], isle: ["#ffb52e", 6, -22], shadow: ["#b06af0", 4, -10], desert: ["#f3e3a8", 70, 3], vale: ["#86c456", 12, 12], village: ["#e0b040", 10, 12], meadow: ["#ff8ab0", 10, 6] }[mood];
  if (weather && Math.random() < 0.5) spark(sx + Math.random() * VIEW_W, weather[2] < 0 ? sy + VIEW_H : weather[1] > 40 ? sy + Math.random() * VIEW_H : sy - 2, weather[1] + (Math.random() - 0.5) * 10, weather[2] + (Math.random() - 0.5) * 8, 6, weather[0]);
  for (const bit of bits) {
    ctx.globalAlpha = Math.min(1, (bit.life / bit.max) * 1.6);
    ctx.fillStyle = bit.colour;
    ctx.fillRect(Math.round(bit.x - sx), Math.round(bit.y - sy), 2, 2);
  }
  ctx.globalAlpha = 1;
  // Each land has its own colour of light
  const tint = TINTS[moodAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE))];
  if (tint) {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalCompositeOperation = "source-over";
  }
  // Glows round fire and magic, then beams of sunlight, then a soft bloom over everything bright
  ctx.globalCompositeOperation = "lighter";
  for (const light of lights) {
    ctx.globalAlpha = Math.min(1, light.a);
    ctx.drawImage(SPR.glow[light.kind], light.x - sx - light.r, light.y - sy - light.r, light.r * 2, light.r * 2);
  }
  if (mood !== "shadow" && mood !== "isle") {
    ctx.globalAlpha = 0.1;
    ctx.drawImage(rays, -mod(time * 5 + sx * 0.5, 240), 0);
  }
  bloomCtx.globalCompositeOperation = "source-over";
  bloomCtx.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
  bloomCtx.globalCompositeOperation = "multiply";
  bloomCtx.drawImage(bloomCanvas, 0, 0);
  bloomCtx.drawImage(bloomCanvas, 0, 0);
  ctx.globalAlpha = mood === "ice" || mood === "crag" ? 0.1 : 0.28;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bloomCanvas, 0, 0, VIEW_W, VIEW_H);
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  if (glow > 0 && state.rings.length) {
    ctx.globalAlpha = Math.min(0.5, glow);
    ctx.fillStyle = RINGS[state.ring].colour;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
}
const scaledFlames = SPR.flame.map((frame) => scaled(frame, 1.8));

let lastTime = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
  lastTime = now;
  if (playing) update(dt);
  else time += dt;
  draw();
  for (const code in justPressed) justPressed[code] = false;
  requestAnimationFrame(frame);
}
function startGame(saved) {
  setUp(saved);
  playing = true;
  el("intro").hidden = true;
}
el("start").addEventListener("click", () => startGame(null));
el("continue").addEventListener("click", () => startGame(loadSave()));
el("continue").hidden = !loadSave();
setUp(null);
requestAnimationFrame(frame);

// Only for testing the game.
window.RP = {
  get state() { return state; },
  player: player, keys: keys, justPressed: justPressed, monsters: () => monsters, boss: () => boss, drops: () => drops, card: () => card,
  go: (tx, ty) => Object.assign(player, { x: centre(tx), y: centre(ty) + 2 }), hurtBoss: hurtBoss,
};
