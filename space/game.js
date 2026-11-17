// Space Explorers: the game.
// planets.js builds each planet, art.js draws the sprites, and ../dragon/ground.js paints the ground.
// This file makes everything move: you, your crew, the demons, day and night, and the journey home.

const VIEW_W = 360;   // the game is drawn small and stretched: chunky 16-bit pixels!
const VIEW_H = 240;
const canvas = document.getElementById("flat");     // the flat picture: only used for the title screen and for flying between planets
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const lightCanvas = makeCanvas(VIEW_W, VIEW_H);   // the darkness and the lights are painted here
const lightCtx = lightCanvas.getContext("2d");
const SPR = buildArt();
const water = makeLiquid(["#2468b8", "#2f7fd0", "#4a9ae6", "#b8e4ff"], false);
const lavaFlow = makeLiquid(["#d83a12", "#ff7a1a", "#ffb52e", "#fff0a0"], false);
const el = (id) => document.getElementById(id);
const centre = (square) => square * TILE + TILE / 2;
const DAY_LENGTH = 110;     // seconds of daylight
const NIGHT_LENGTH = 75;    // seconds of night
const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]];      // facing: down, left, right, up

function sound(make) {
  try {
    make();
  } catch (error) {
    // no sound available: the game still works
  }
}
const sfx = {
  zap: () => sound(() => playTone(0, 0.08, 900, 400, 0.08)),
  pew: () => sound(() => playTone(0, 0.06, 600, 300, 0.04)),
  hit: () => sound(() => playTone(0, 0.08, 240, 110, 0.14)),
  hurt: () => sound(() => playTone(0, 0.22, 210, 70, 0.22)),
  pick: () => sound(() => playTone(0, 0.09, 700, 1050, 0.12)),
  build: () => sound(() => playTone(0, 0.1, 200, 320, 0.14)),
  screech: () => sound(() => { playTone(0, 0.35, 1400, 300, 0.2); playNoise(0, 0.35, 3000, 600, 0.25); }),
  thump: () => sound(() => { playTone(0, 0.09, 70, 45, 0.3); playTone(0.14, 0.09, 60, 40, 0.22); }),
  roar: () => sound(() => { playNoise(0, 0.7, 500, 90, 0.3); playTone(0, 0.7, 130, 55, 0.2); }),
  crash: () => sound(() => playNoise(0, 0.3, 800, 100, 0.3)),
  win: () => sound(() => playJingle()),
};

// ----- What the game remembers (and saves) -----
const SAVE_NAME = "spaceExplorersSave";
function newState() {
  return {
    planet: 0,
    day: 1,
    phase: "day",            // "day" or "night"
    timer: DAY_LENGTH,       // seconds left of this day or night
    hp: 8, maxHp: 8,
    hull: 12, maxHull: 20,   // how strong the ship is
    scrap: 4,
    fuel: 0,
    chart: false,            // have you found this planet's piece of the star chart?
    things: [0, 0, 0, 0, 0], // the special material from each planet
    ups: {},                 // the upgrades you have built
    boots: false,
    taken: {},               // what you have picked up on this planet
    built: [],               // what you have built on this planet: [type, x, y, strength]
  };
}
let state = newState();
let place = null;            // where things are on this planet

function save() {
  state.built = structures.map((s) => [s.type, s.tx, s.ty, s.hp]);
  try {
    localStorage.setItem(SAVE_NAME, JSON.stringify(state));
  } catch (error) {
    // saving isn't allowed here: keep playing anyway
  }
}
function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_NAME));
    return saved && typeof saved.planet === "number" ? Object.assign(newState(), saved) : null;
  } catch (error) {
    return null;
  }
}

// ----- You, your crew, and everything else that moves -----
const player = { x: 0, y: 0, dir: 0, anim: 0, moving: false, cool: 0, safe: 0 };
const crew = [
  { id: "nova", name: "Nova", post: [-46, 12] },      // the pilot: a good shot
  { id: "tink", name: "Tink", post: [46, 12] },       // the engineer: mends the ship at night
  { id: "doc", name: "Doc", post: [0, 36] },          // the medic: heals you when you stand close
];
// Demons. sneak: hides in the dark and creeps up on you.  ranged: spits fire from far away.  flies: goes over walls.
const DEMONS = {
  imp: { hp: 2, speed: 44, dmg: 1, sneak: true },
  brute: { hp: 9, speed: 20, dmg: 2, smash: true },
  spitter: { hp: 3, speed: 30, dmg: 1, ranged: true },
  wing: { hp: 2, speed: 54, dmg: 1, flies: true },
  king: { hp: 70, speed: 17, dmg: 2, boss: true },
};
const BUILD = { Digit1: ["turret", 6, 8], Digit2: ["wall", 2, 12], Digit3: ["lamp", 3, 4] };     // key: [what, scrap it costs, how strong it is]
let demons = [];
let shots = [];
let bits = [];
let structures = [];
let items = [];
let rows = [];
let trailTo = [];            // for every square: how many steps it is from the ship (demons use it to find their way)
let trailYou = [];           // the same, but how many steps from you
let trailTimer = 0;
let trail = [];
let aim = { x: 0, y: 1 };
let shipX = 0, shipY = 0;
let cam = { x: 0, y: 0 };
let time = 0;
let screen = "title";        // "title", "play" or "flight"
let paused = false;
let menuOpen = false;
let shake = 0;
let scare = 0;               // counts down while the big scary face is on the screen
let scareRest = 0;
let beat = 0;
let beam = Math.PI / 2;      // which way you are facing (your torch points this way)
let tilt = 0;                // looking up or down
let dread = 0;               // how close something is creeping (it darkens the edges of the screen)
let chatter = 8;             // until the next nervous word on the radio, or noise in the dark
let flicker = 0;             // counts down while the lights flicker
let flickerRest = 6;
const watchers = [];         // eyes that watch from the dark, and are gone when you shine your torch at them
for (let i = 0; i < 6; i++) watchers.push({ x: -999, y: -999 });
const RADIO = [
  "Nova: \"Captain... something is out there.\"", "Doc: \"Did you hear that?\"", "Tink: \"The scanner shows nothing. Why is it never nothing?\"",
  "Nova: \"Don't turn your back on the dark.\"", "Doc: \"I can see eyes. So many eyes.\"", "Tink: \"Stay in the light, Captain. Please.\"",
  "Nova: \"It's too quiet.\"", "Doc: \"Something just moved. Behind you.\"",
];
let toSpawn = 0;
let spawnTimer = 0;
let king = null;
let flight = null;

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
// The mouse: click the game to look around with it; the left button fires
let mouseDown = false;
function grabMouse() {
  const view = document.getElementById("game");
  if (screen === "play" && view.requestPointerLock && !location.search.includes("test")) view.requestPointerLock();
}
document.addEventListener("mousemove", function (event) {
  if (document.pointerLockElement && screen === "play" && !menuOpen && !card && !paused) {
    beam += event.movementX * 0.0026;
    tilt = Math.max(-0.7, Math.min(0.7, tilt - event.movementY * 0.0022));
  }
});
document.addEventListener("mousedown", function (event) {
  if (event.target.id === "game" && !document.pointerLockElement) return grabMouse();
  if (event.button === 0 && document.pointerLockElement) mouseDown = true;
});
document.addEventListener("mouseup", () => (mouseDown = false));
const held = (name) => Object.keys(MOVE_KEYS).some((code) => MOVE_KEYS[code] === name && keys[code]);
function pressed(code) {
  const yes = justPressed[code];
  justPressed[code] = false;
  return yes;
}

// ----- Words on the screen -----
let toastTimer = 0;
function toast(text, seconds, big) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  el("toast").classList.toggle("big", Boolean(big));      // big red letters for the scary moments
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

// ----- Sparks and puffs -----
function spark(x, y, vx, vy, life, colour, glow) {
  if (bits.length < 400) bits.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, colour: colour, glow: glow });
}
function burst(x, y, colours, count, speed, glow) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.3 + Math.random() * 0.7);
    spark(x, y, Math.cos(angle) * power, Math.sin(angle) * power, 0.3 + Math.random() * 0.5, colours[Math.floor(Math.random() * colours.length)], glow);
  }
}

// ---------------------------------------------------------------------------
// Landing on a planet
// ---------------------------------------------------------------------------

function landOn(index, fromSave) {
  state.planet = index;
  if (!fromSave) Object.assign(state, { day: 1, phase: "day", timer: DAY_LENGTH, fuel: 0, chart: false, taken: {}, built: [], hull: Math.max(4, state.hull - 3) });   // every landing is a bumpy one
  place = makePlanet(index);
  chunkCache.clear();        // forget the last planet's ground
  // Get every tree and rock ready to draw
  rows = [];
  for (let y = 0; y < MAP_H; y++) rows.push([]);
  for (const o of WORLD.objects) {
    const list = SPR.plants[o.type];
    const img = list[(o.look === undefined ? Math.floor(hash(o.x, o.y, 5) * list.length) : o.look) % list.length];
    const peak = o.type === "peak" || o.type === "snowpeak";
    const bx = centre(o.x) + (peak ? 0 : Math.round((hash(o.x, o.y, 6) - 0.5) * 6));
    const by = (o.y + 1) * TILE + (peak ? 3 + Math.round(hash(o.x, o.y, 8) * 5) : -Math.round(hash(o.x, o.y, 7) * 4));
    rows[o.y].push({ img: img, x: Math.round(bx - img.width / 2), y: by - img.height, bx: bx, by: by, light: o.type === "mushroom" ? "cyan" : o.type === "darkpillar" ? "red" : null });
  }
  // Things to pick up (minus the ones you already have)
  items = [];
  place.crystals.forEach((spot, i) => items.push({ id: "c" + i, kind: "crystal", x: centre(spot[0]), y: centre(spot[1]) }));
  place.scraps.forEach((spot, i) => items.push({ id: "s" + i, kind: "scrap", x: centre(spot[0]), y: centre(spot[1]) }));
  place.things.forEach((spot, i) => items.push({ id: "t" + i, kind: "thing", x: centre(spot[0]), y: centre(spot[1]) }));
  if (place.chart) items.push({ id: "chart", kind: "chart", x: centre(place.chart[0]), y: centre(place.chart[1]) });
  items.push({ id: "log", kind: "log", x: centre(place.wreck[0]), y: centre(place.wreck[1]) });
  items = items.filter((item) => !state.taken[item.id]);
  structures = state.built.map(([type, tx, ty, hp]) => ({ type: type, tx: tx, ty: ty, hp: hp, cool: 0 }));
  for (const s of structures) WORLD.blocked[s.ty][s.tx] = true;
  shipX = place.ship[0] * TILE;
  shipY = (place.ship[1] + 1) * TILE;
  Object.assign(player, { x: shipX, y: shipY + 20, dir: 0, safe: 0 });
  crew.forEach(function (mate, i) {
    Object.assign(mate, { x: shipX + (i - 1) * 16, y: shipY + 34, dir: 0, anim: 0, moving: false, hp: 6, down: false, cool: Math.random(), heal: 0 });
  });
  demons = [];
  shots = [];
  bits = [];
  trail = [];
  king = null;
  toSpawn = 0;
  cam.x = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, player.x - VIEW_W / 2));
  cam.y = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, player.y - VIEW_H / 2));
  hudText = "";
  beam = Math.PI / 2;
  build3D();
  if (!fromSave) {
    showCard(["Planet " + (index + 1) + " of 5: " + WORLD.planet.name].concat(WORLD.planet.story), function () {
      toast("Find " + WORLD.planet.fuel + " fuel crystals" + (WORLD.planet.boss ? "." : " and the star chart piece.") + " Be back at the ship before dark!", 6);
      save();
    });
  }
}

function startGame(saved) {
  state = saved || newState();
  screen = "play";
  el("intro").hidden = true;
  landOn(state.planet, Boolean(saved));
  if (saved && state.phase === "night") startNight(true);
}
el("start").addEventListener("click", function () {
  startGame(null);
  grabMouse();
});
el("continue").addEventListener("click", function () {
  startGame(loadSave());
  grabMouse();
});
el("continue").hidden = !loadSave();

// ---------------------------------------------------------------------------
// Day and night
// ---------------------------------------------------------------------------

function startNight(again) {
  state.phase = "night";
  if (!again) state.timer = NIGHT_LENGTH;
  toSpawn = Math.min(30, 5 + state.planet * 3 + (state.day - 1) * 2);
  spawnTimer = 3;
  menuOpen = false;
  el("ship-menu").hidden = true;
  toast("NIGHT " + state.day + ".  They are coming.", 5, true);
  sfx.roar();
  chatter = 9;
  flickerRest = 6;
  if (WORLD.planet.boss && !state.chart) {
    // The Demon King comes himself
    const gate = place.gates[Math.floor(Math.random() * place.gates.length)];
    king = addDemon("king", centre(gate[0]), centre(gate[1]));
  }
}

function dawn() {
  for (const d of demons) burst(d.x, d.y - 8, ["#ffffff", "#ffd84a", "#ff7a1a"], 10, 50, "fire");
  demons = [];
  shots = [];
  king = null;
  state.phase = "day";
  state.timer = DAY_LENGTH;
  state.day++;
  state.hp = Math.min(state.maxHp, state.hp + 2);
  for (const mate of crew) Object.assign(mate, { hp: 6, down: false });
  toast("The sun rises and the demons melt away. You made it through the night!", 6);
  sfx.win();
  save();
}

// The demons got into the ship: the night is lost, but you get to try again
function nightLost() {
  demons = [];
  shots = [];
  king = null;
  state.phase = "day";
  state.timer = 45;
  state.hull = Math.ceil(state.maxHull / 2);
  state.hp = state.maxHp;
  for (const mate of crew) Object.assign(mate, { hp: 6, down: false });
  Object.assign(player, { x: shipX, y: shipY + 20 });
  showCard(["The demons broke into the ship!", "The crew fought them off, but only just.", "Patch up the hull, build more defences and try again. Night is coming back soon."], save);
}

function addDemon(type, x, y) {
  const demon = { type: type, def: DEMONS[type], x: x, y: y, hp: DEMONS[type].hp, flash: 0, cool: 1, think: 0, target: null, hidden: false, frozen: false, pounced: false, dash: 0 };
  demons.push(demon);
  return demon;
}

// ---------------------------------------------------------------------------
// Moving about
// ---------------------------------------------------------------------------

function solidAt(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || WORLD.blocked[ty][tx];
}
function canStand(x, y) {
  return !solidAt(x - 4, y - 5) && !solidAt(x + 4, y - 5) && !solidAt(x - 4, y + 1) && !solidAt(x + 4, y + 1);
}
// Is there a straight, clear line between two spots? (It stops "short" pixels before the end.)
function clearPath(x0, y0, x1, y1, short) {
  const distance = Math.hypot(x1 - x0, y1 - y0);
  for (let along = 8; along < distance - short; along += 8) {
    if (solidAt(x0 + ((x1 - x0) * along) / distance, y0 + ((y1 - y0) * along) / distance)) return false;
  }
  return true;
}
// For every square, count the steps to get to one spot, spreading out from it one step at a time.
// A demon that follows the numbers downhill will find its way round rocks, trees and walls.
function stepsFrom(tx, ty) {
  const steps = [];
  for (let y = 0; y < MAP_H; y++) steps.push(new Int16Array(MAP_W).fill(-1));
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return steps;
  steps[ty][tx] = 0;
  const queue = [[tx, ty]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [ox, oy] of DIRS) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || steps[ny][nx] >= 0 || WORLD.blocked[ny][nx]) continue;
      steps[ny][nx] = steps[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return steps;
}
function structureAt(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return structures.find((s) => s.tx === tx && s.ty === ty);
}

function walkTo(who, x, y, speed, dt) {
  const dx = x - who.x;
  const dy = y - who.y;
  const distance = Math.hypot(dx, dy);
  who.moving = distance > 1.5;
  if (!who.moving) return;
  const step = Math.min(distance, speed * dt);
  who.x += (dx / distance) * step;
  who.y += (dy / distance) * step;
  who.anim += dt;
  who.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
}

function movePlayer(dt) {
  // You see through your own eyes now: the mouse (or the left and right arrows) turns you,
  // W and S walk forwards and back, A and D step sideways.
  beam += ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 2.4 * dt;
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const across = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  aim = { x: Math.cos(beam), y: Math.sin(beam) };                 // the way you are facing (and where your torch points)
  player.dir = Math.abs(aim.x) > Math.abs(aim.y) ? (aim.x < 0 ? 1 : 2) : aim.y < 0 ? 3 : 0;
  player.moving = ahead !== 0 || across !== 0;
  if (player.moving) {
    let ax = aim.x * ahead - aim.y * across;
    let ay = aim.y * ahead + aim.x * across;
    const length = Math.hypot(ax, ay);
    ax /= length;
    ay /= length;
    const speed = state.boots ? 104 : 80;
    if (canStand(player.x + ax * speed * dt, player.y)) player.x += ax * speed * dt;
    if (canStand(player.x, player.y + ay * speed * dt)) player.y += ay * speed * dt;
    player.anim += dt;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - player.x, last.y - player.y) > 3) {
      trail.push({ x: player.x, y: player.y });
      if (trail.length > 90) trail.shift();
    }
  }
  // Fire!
  player.cool -= dt;
  if ((keys.Space || mouseDown) && player.cool <= 0) {
    player.cool = 0.22;
    shots.push({ x: player.x + aim.x * 8, y: player.y - 10 + aim.y * 6, vx: aim.x * 240, vy: aim.y * 240, life: 0.55, power: state.ups.lens ? 2 : 1 });
    sfx.zap();
  }
  // Pick things up by walking over them
  for (const item of items.slice()) {
    if (Math.hypot(item.x - player.x, item.y - player.y + 4) > 12) continue;
    items.splice(items.indexOf(item), 1);
    state.taken[item.id] = true;
    sfx.pick();
    burst(item.x, item.y - 6, ["#ffffff", "#8fe6ff"], 8, 40, "cyan");
    const planet = WORLD.planet;
    if (item.kind === "log") {
      showCard(["Half buried in the ground: a piece of another ship. Its log is still working."].concat(planet.log));
    } else if (item.kind === "crystal") {
      state.fuel++;
      toast("A fuel crystal! (" + state.fuel + "/" + planet.fuel + ")");
    } else if (item.kind === "scrap") {
      state.scrap += 3;
      toast("Scrap metal: +3. Use it to build and to fix the ship.");
    } else if (item.kind === "thing") {
      state.things[state.planet]++;
      toast(planet.thing[0] + "! (" + state.things[state.planet] + "/3) Take 3 to the ship to build the " + planet.upgrade[1] + ".", 5);
    } else {
      state.chart = true;
      toast("You found a piece of the star chart!", 5);
      sfx.win();
    }
  }
}

// Building: a turret, a wall or a lamp on the square in front of you
function build(type, cost, hp) {
  const tx = Math.floor(player.x / TILE) + DIRS[player.dir][0];
  const ty = Math.floor((player.y - 2) / TILE) + DIRS[player.dir][1];
  if (state.scrap < cost) return toast("A " + type + " costs " + cost + " scrap. You have " + state.scrap + ".");
  if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1 || WORLD.blocked[ty][tx]) return toast("There's no room to build there.");
  state.scrap -= cost;
  structures.push({ type: type, tx: tx, ty: ty, hp: hp, cool: 0 });
  WORLD.blocked[ty][tx] = true;
  sfx.build();
  burst(centre(tx), centre(ty), ["#ffffff", "#aab2c0"], 8, 40);
}

function breakStructure(s) {
  structures.splice(structures.indexOf(s), 1);
  WORLD.blocked[s.ty][s.tx] = false;
  burst(centre(s.tx), centre(s.ty), ["#aab2c0", "#5a6272", "#ffd84a"], 12, 60);
  sfx.crash();
}

// ---------------------------------------------------------------------------
// The crew
// ---------------------------------------------------------------------------

function nearestDemon(x, y, reach) {
  let best = null;
  for (const d of demons) {
    const distance = Math.hypot(d.x - x, d.y - y);
    if (distance < reach) {
      reach = distance;
      best = d;
    }
  }
  return best;
}

function updateCrew(dt) {
  crew.forEach(function (mate, i) {
    if (mate.down) return;
    if (state.phase === "day") {
      // By day they follow you in a line
      let need = 50 + i * 26;       // they keep a few steps behind you
      let px = player.x, py = player.y, spot = null;
      for (let n = trail.length - 1; n >= 0; n--) {
        const d = Math.hypot(trail[n].x - px, trail[n].y - py);
        if (d >= need) {
          spot = { x: px + ((trail[n].x - px) * need) / d, y: py + ((trail[n].y - py) * need) / d };
          break;
        }
        need -= d;
        px = trail[n].x;
        py = trail[n].y;
      }
      if (spot) walkTo(mate, spot.x, spot.y, 140, dt);
      else mate.moving = false;
      return;
    }
    // At night they stand guard around the ship and shoot
    walkTo(mate, shipX + mate.post[0], shipY + mate.post[1], 90, dt);
    mate.cool -= dt;
    const foe = nearestDemon(mate.x, mate.y, 95);
    if (foe && mate.cool <= 0) {
      mate.cool = (mate.id === "nova" ? 0.5 : 0.8) * (state.ups.rapid ? 0.5 : 1);
      const d = Math.hypot(foe.x - mate.x, foe.y - mate.y) || 1;
      shots.push({ x: mate.x, y: mate.y - 10, vx: ((foe.x - mate.x) / d) * 220, vy: ((foe.y - 8 - mate.y + 10) / d) * 220, life: 0.6, power: 1 });
      if (!mate.moving) mate.dir = Math.abs(foe.x - mate.x) > Math.abs(foe.y - mate.y) ? (foe.x < mate.x ? 1 : 2) : foe.y < mate.y ? 3 : 0;
      sfx.pew();
    }
    mate.heal += dt;
    // Tink mends the ship when no demon is close; Doc heals you when you stand near
    if (mate.id === "tink" && mate.heal > 4 && !foe && state.hull < state.maxHull) {
      mate.heal = 0;
      state.hull++;
      spark(shipX + 20, shipY - 14, 0, -20, 0.5, "#ffe14a", "warm");
    }
    if (mate.id === "doc" && mate.heal > (state.ups.garden ? 1.4 : 2.6) && state.hp < state.maxHp && Math.hypot(player.x - mate.x, player.y - mate.y) < 36) {
      mate.heal = 0;
      state.hp++;
      burst(player.x, player.y - 16, ["#6fe08a", "#ffffff"], 5, 20);
    }
  });
}

// ---------------------------------------------------------------------------
// Demons
// ---------------------------------------------------------------------------

// Is this spot in the light? (Demons can only hide in the dark.)
function isLit(x, y) {
  if (state.phase === "day") return true;
  const away = Math.hypot(player.x - x, player.y - y);
  if (away < 30) return true;
  // Your torch only lights what is in front of you
  if (away < 118 && Math.abs(turnBetween(Math.atan2(y - player.y, x - player.x), beam)) < 0.5) return true;
  if (Math.hypot(shipX - x, shipY - 10 - y) < (state.ups.light ? 170 : 78)) return true;
  for (const mate of crew) if (!mate.down && Math.hypot(mate.x - x, mate.y - y) < 32) return true;
  for (const s of structures) if (Math.hypot(centre(s.tx) - x, centre(s.ty) - y) < (s.type === "lamp" ? 62 : 24)) return true;
  return false;
}
// The smallest turn (in radians) from one direction to another
function turnBetween(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
function inLampLight(x, y) {
  if (Math.hypot(shipX - x, shipY - 10 - y) < (state.ups.light ? 170 : 60)) return true;
  return structures.some((s) => s.type === "lamp" && Math.hypot(centre(s.tx) - x, centre(s.ty) - y) < 62);
}

function hurtPlayer(amount, fromX, fromY) {
  if (player.safe > 0) return;
  state.hp -= amount;
  player.safe = 0.9;
  shake = 0.3;
  sfx.hurt();
  el("hurt").style.opacity = 1;
  setTimeout(() => (el("hurt").style.opacity = 0), 150);
  const away = Math.atan2(player.y - fromY, player.x - fromX);
  for (let i = 0; i < 8; i++) {
    if (canStand(player.x + Math.cos(away) * 1.5, player.y + Math.sin(away) * 1.5)) {
      player.x += Math.cos(away) * 1.5;
      player.y += Math.sin(away) * 1.5;
    }
  }
  if (state.hp > 0) return;
  // Knocked out: the crew drag you back to the ship, but the demons get some hits in on the hull
  state.hp = Math.ceil(state.maxHp / 2);
  player.safe = 3;
  Object.assign(player, { x: shipX, y: shipY + 20 });
  toast("You were knocked out! The crew dragged you back to the ship.", 5);
  hurtShip(3);
}
function hurtShip(amount) {
  state.hull -= amount;
  shake = Math.max(shake, 0.2);
  burst(shipX + (Math.random() - 0.5) * 40, shipY - 20, ["#ffd84a", "#ff7a1a", "#aab2c0"], 6, 50, "fire");
  if (state.hull <= 0) nightLost();
}

// A demon jumps out at you!
function scareNow() {
  if (scareRest > 0) return;
  scare = 0.45;
  scareRest = 5;
  shake = 0.45;
  sfx.screech();
}

function hurtDemon(d, power) {
  d.hp -= power;
  d.flash = 0.12;
  d.frozen = false;
  d.pounced = true;       // no more sneaking once it has been shot
  sfx.hit();
  if (d.hp > 0) return;
  demons.splice(demons.indexOf(d), 1);
  burst(d.x, d.y - 8, ["#ffffff", "#ff8ab0", "#b8242e"], d.def.boss ? 80 : 14, d.def.boss ? 140 : 60, "red");
  if (!d.def.boss) return;
  // The Demon King is beaten!
  king = null;
  shake = 1;
  sfx.roar();
  state.chart = true;
  showCard(["The Demon King bursts into a thousand sparks!", "Something flutters down where he stood: the last piece of the star chart.", "All over the planet, the demons are fading away..."], dawn);
}

function updateDemons(dt) {
  if ((trailTimer -= dt) <= 0) {
    trailTimer = 0.7;
    trailTo = stepsFrom(place.ship[0], place.ship[1] + 2);
    trailYou = stepsFrom(Math.floor(player.x / TILE), Math.floor((player.y - 2) / TILE));
  }
  // More demons creep in from the edge of the map through the night
  if (state.phase === "night" && toSpawn > 0 && (spawnTimer -= dt) <= 0) {
    spawnTimer = (NIGHT_LENGTH * 0.75) / Math.min(30, 5 + state.planet * 3 + (state.day - 1) * 2);
    for (let tries = 0; tries < 12; tries++) {
      const gate = place.gates[Math.floor(Math.random() * place.gates.length)];
      if (Math.hypot(centre(gate[0]) - player.x, centre(gate[1]) - player.y) < 150) continue;     // never right on top of you
      const list = WORLD.planet.demons;
      addDemon(list[Math.floor(Math.random() * list.length)], centre(gate[0]), centre(gate[1]));
      toSpawn--;
      break;
    }
  }
  let nearestHidden = 999;
  for (const d of demons.slice()) {
    const def = d.def;
    d.flash -= dt;
    d.cool -= dt;
    // Choose who (or what) to go for
    if ((d.think -= dt) <= 0) {
      d.think = 0.6;
      let best = "ship";
      let reach = def.smash ? 0 : 400;
      if (def.smash) {
        reach = 70;
        for (const s of structures) {
          const distance = Math.hypot(centre(s.tx) - d.x, centre(s.ty) - d.y);
          if (distance < reach) {
            reach = distance;
            best = s;
          }
        }
      } else {
        for (const who of [player].concat(crew.filter((mate) => !mate.down))) {
          const distance = Math.hypot(who.x - d.x, who.y - d.y) * (who === player ? 0.8 : 1);
          if (distance < reach) {
            reach = distance;
            best = who;
          }
        }
      }
      d.target = best;
    }
    const t = d.target;
    const tx = t === "ship" ? shipX : t.tx !== undefined ? centre(t.tx) : t.x;
    const ty = t === "ship" ? shipY - 8 : t.tx !== undefined ? centre(t.ty) : t.y;
    const dx = tx - d.x;
    const dy = ty - d.y;
    const distance = Math.hypot(dx, dy) || 1;
    const wasHidden = d.hidden;
    d.hidden = !isLit(d.x, d.y);
    if (wasHidden && !d.hidden && !d.seen && state.phase === "night" && Math.hypot(player.x - d.x, player.y - d.y) < 120) {
      // Your torch finds something that was standing there all along
      d.seen = true;
      shake = Math.max(shake, 0.12);
      sound(() => playTone(0, 0.18, 1300, 1000, 0.1));
    }
    let speed = def.speed * (inLampLight(d.x, d.y) ? 0.6 : 1);
    // Sneaking: an imp freezes while you are looking its way, and creeps closer when you turn your back
    d.frozen = false;
    if (def.sneak && t === player && !d.pounced) {
      const facing = (aim.x * -dx + aim.y * -dy) / distance;      // 1 = you are looking straight at it
      if (facing > 0.55 && distance < 150) {       // (whether your torch is on it or not: it just stands there, staring)
        d.frozen = true;
        speed = 0;
      }
      if (d.hidden) nearestHidden = Math.min(nearestHidden, distance);
      if (distance < 36) {
        d.pounced = true;      // close enough: it leaps out of the dark!
        d.dash = 0.45;
        scareNow();
      }
    }
    if (d.dash > 0) {
      d.dash -= dt;
      speed = def.speed * 3;
    }
    if (def.ranged && distance < 105) {
      speed = distance < 70 ? -def.speed * 0.6 : 0;      // keep its distance, and spit fire
      if (d.cool <= 0) {
        d.cool = 2.3;
        shots.push({ x: d.x, y: d.y - 8, vx: (dx / distance) * 85, vy: (dy / distance) * 85, life: 2.2, foe: true, power: 1 });
      }
    }
    const reach = t === "ship" ? 34 : t.tx !== undefined ? 15 : def.boss ? 24 : 11;
    if (distance > reach || speed < 0) {
      // Walk (round things that are in the way; smash structures that block the path)
      let vx = (dx / distance) * speed;
      let vy = (dy / distance) * speed;
      if (!def.flies && speed > 0 && !clearPath(d.x, d.y - 2, tx, ty - 2, reach + 6)) {
        // Something is in the way: follow the trail of squares that leads round it
        const trail = t === player ? trailYou : trailTo;
        const cx = Math.floor(d.x / TILE);
        const cy = Math.floor((d.y - 2) / TILE);
        let best = trail[cy][cx];
        let bx = cx, by = cy;
        for (const [ox, oy] of DIRS) {
          const steps = trail[cy + oy] ? trail[cy + oy][cx + ox] : -1;
          if (steps >= 0 && (best < 0 || steps < best)) {
            best = steps;
            bx = cx + ox;
            by = cy + oy;
          }
        }
        if (bx !== cx || by !== cy) {
          const far = Math.hypot(centre(bx) - d.x, centre(by) + 2 - d.y) || 1;
          vx = ((centre(bx) - d.x) / far) * speed;
          vy = ((centre(by) + 2 - d.y) / far) * speed;
        }
      }
      const nx = d.x + vx * dt;
      const ny = d.y + vy * dt;
      let moved = false;
      if (def.flies || !solidAt(nx, d.y - 2)) { d.x = nx; moved = true; }
      if (def.flies || !solidAt(d.x, ny - 2)) { d.y = ny; moved = true; }
      if (!moved && speed > 0) {
        const wall = structureAt(nx, ny - 2);
        if (wall && d.cool <= 0) {
          d.cool = 0.9;
          wall.hp -= def.dmg;
          if (wall.hp <= 0) breakStructure(wall);
        }
      }
    } else if (d.cool <= 0 && !def.ranged) {
      d.cool = 0.9;
      if (t === "ship") hurtShip(def.dmg);
      else if (t.tx !== undefined) {
        t.hp -= def.dmg;
        if (t.hp <= 0) breakStructure(t);
      } else if (t === player) hurtPlayer(def.dmg, d.x, d.y);
      else {
        t.hp -= def.dmg;
        if (t.hp <= 0) {
          t.down = true;
          toast(t.name + " is down! They will be back on their feet at dawn.", 4);
        }
      }
    }
    // The Demon King also throws rings of fire
    if (def.boss && d.cool < -1.6) {
      d.cool = 0.6;
      for (let i = 0; i < 10; i++) shots.push({ x: d.x, y: d.y - 20, vx: Math.cos(i * 0.628 + time) * 70, vy: Math.sin(i * 0.628 + time) * 70, life: 2.4, foe: true, power: 1 });
      sfx.roar();
    }
  }
  // Your heart thumps faster as something creeps closer in the dark, and the edges of the screen close in
  if (nearestHidden < 150 && (beat -= dt) <= 0) {
    beat = 0.3 + (nearestHidden / 150) * 0.9;
    sfx.thump();
  }
  const fear = state.phase === "night" ? 0.45 + Math.max(0, 1 - nearestHidden / 150) * 0.5 : 0;
  dread += (fear - dread) * Math.min(1, dt * 3);
  el("dread").style.opacity = dread.toFixed(2);
  if (state.phase !== "night") return;
  // The lights flicker now and then
  if (flicker > 0) flicker -= dt;
  if ((flickerRest -= dt) <= 0) {
    flickerRest = 9 + Math.random() * 14;
    flicker = 0.7;
    sound(() => playNoise(0, 0.5, 200, 120, 0.12));
  }
  // Nervous voices on the radio, and noises far off in the dark
  if ((chatter -= dt) <= 0) {
    chatter = 10 + Math.random() * 9;
    if (Math.random() < 0.5 && toastTimer <= 0) toast(RADIO[Math.floor(Math.random() * RADIO.length)], 3.5);
    else sound(() => (Math.random() < 0.5 ? playTone(0, 1.2, 180 + Math.random() * 80, 90, 0.07) : playNoise(0, 0.9, 1800, 300, 0.05)));
  }
  // The eyes in the dark: keep them out of the light, and not too far from you
  for (const eye of watchers) {
    const away = Math.hypot(eye.x - player.x, eye.y - player.y);
    if (away > 60 && away < 190 && !isLit(eye.x, eye.y)) continue;
    const angle = Math.random() * Math.PI * 2;
    eye.x = player.x + Math.cos(angle) * (90 + Math.random() * 80);
    eye.y = player.y + Math.sin(angle) * (70 + Math.random() * 60);
  }
}

function updateShots(dt) {
  for (const s of structures) {
    // Turrets shoot by themselves
    if (s.type !== "turret" || (s.cool -= dt) > 0) continue;
    const foe = nearestDemon(centre(s.tx), centre(s.ty), 105);
    if (!foe) continue;
    s.cool = state.ups.rapid ? 0.35 : 0.7;
    const d = Math.hypot(foe.x - centre(s.tx), foe.y - 8 - centre(s.ty) + 10) || 1;
    shots.push({ x: centre(s.tx), y: centre(s.ty) - 10, vx: ((foe.x - centre(s.tx)) / d) * 220, vy: ((foe.y - 8 - centre(s.ty) + 10) / d) * 220, life: 0.6, power: 1 });
    sfx.pew();
  }
  for (const shot of shots) {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.foe) {
      if (Math.hypot(player.x - shot.x, player.y - 8 - shot.y) < 8) {
        shot.life = 0;
        hurtPlayer(shot.power, shot.x, shot.y);
      }
      for (const mate of crew) {
        if (mate.down || Math.hypot(mate.x - shot.x, mate.y - 8 - shot.y) > 8) continue;
        shot.life = 0;
        if (--mate.hp <= 0) mate.down = true;
      }
    } else {
      for (const d of demons) {
        if (Math.hypot(d.x - shot.x, d.y - 8 - shot.y) > (d.def.boss ? 26 : 10)) continue;
        shot.life = 0;
        burst(shot.x, shot.y, ["#ffffff", "#8fe6ff"], 4, 40, "cyan");
        hurtDemon(d, shot.power);
        break;
      }
    }
  }
  shots = shots.filter((shot) => shot.life > 0);
  for (const bit of bits) {
    bit.life -= dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
  }
  bits = bits.filter((bit) => bit.life > 0);
}

// ---------------------------------------------------------------------------
// The ship's workshop
// ---------------------------------------------------------------------------

function openMenu() {
  if (document.pointerLockElement) document.exitPointerLock();      // you need the mouse to click the buttons
  menuOpen = true;
  el("ship-menu").hidden = false;
  const list = el("menu-list");
  list.innerHTML = "";
  const planet = WORLD.planet;
  function option(text, can, act) {
    const button = document.createElement("button");
    button.textContent = text;
    button.disabled = !can;
    button.addEventListener("click", function () {
      act();
      sfx.build();
      hudText = "";
      save();
      if (menuOpen) openMenu();
    });
    list.appendChild(button);
  }
  option("Fix the hull: +5 for 2 scrap.   (Hull " + state.hull + "/" + state.maxHull + ", scrap " + state.scrap + ")", state.scrap >= 2 && state.hull < state.maxHull, function () {
    state.scrap -= 2;
    state.hull = Math.min(state.maxHull, state.hull + 5);
  });
  PLANETS.forEach(function (world, i) {
    const [id, name, what] = world.upgrade;
    if (state.ups[id]) return option("Built: " + name + " (" + what + ")", false, () => {});
    if (i > state.planet && !state.things[i]) return;
    option("Build the " + name + ": " + what + ".   Needs 3 " + world.thing[0] + " from " + world.name + " (you have " + state.things[i] + ")", state.things[i] >= 3, function () {
      state.things[i] -= 3;
      state.ups[id] = true;
      if (id === "garden") state.hp = state.maxHp = state.maxHp + 2;
      if (id === "armour") state.hull = state.maxHull = state.maxHull + 12;
      toast("You built the " + name + "!", 4);
    });
  });
  if (!state.boots) option("Jet boots: run faster.   Costs 10 scrap", state.scrap >= 10, function () {
    state.scrap -= 10;
    state.boots = true;
  });
  option("Rest until night", true, function () {
    closeMenu();
    startNight();
  });
  const missing = [];
  if (state.fuel < planet.fuel) missing.push((planet.fuel - state.fuel) + " more fuel crystals");
  if (!state.chart) missing.push(planet.boss ? "the last star chart piece (the Demon King has it)" : "the star chart piece");
  option(missing.length ? "Launch: you still need " + missing.join(" and ") : "LAUNCH to " + (planet.boss ? "home!" : "the next planet!"), !missing.length, function () {
    closeMenu();
    startFlight();
  });
}
function closeMenu() {
  grabMouse();
  menuOpen = false;
  el("ship-menu").hidden = true;
}

// ---------------------------------------------------------------------------
// Flying between planets: dodge the asteroids!
// ---------------------------------------------------------------------------

function startFlight() {
  save();
  screen = "flight";
  flight = { t: 0, x: 50, y: VIEW_H / 2, rocks: [], next: 1, hit: 0 };
  el("prompt").hidden = true;
  toast("Lift off! Steer with the arrow keys and dodge the asteroids.", 4);
}
function updateFlight(dt) {
  const f = flight;
  f.t += dt;
  f.hit -= dt;
  f.x = Math.max(16, Math.min(VIEW_W - 30, f.x + ((held("right") ? 1 : 0) - (held("left") ? 1 : 0)) * 120 * dt));
  f.y = Math.max(26, Math.min(VIEW_H - 14, f.y + ((held("down") ? 1 : 0) - (held("up") ? 1 : 0)) * 120 * dt));
  if ((f.next -= dt) <= 0 && f.t < 15) {
    f.next = 0.5 - state.planet * 0.05;
    f.rocks.push({ x: VIEW_W + 20, y: Math.random() * VIEW_H, speed: 90 + Math.random() * 90, size: 7 + Math.random() * 9 });
  }
  for (const rock of f.rocks) {
    rock.x -= rock.speed * dt;
    if (f.hit <= 0 && Math.hypot(rock.x - f.x, rock.y - f.y) < rock.size + 7) {
      f.hit = 0.8;
      rock.x = -99;
      state.hull = Math.max(1, state.hull - 1);
      shake = 0.4;
      sfx.crash();
    }
  }
  f.rocks = f.rocks.filter((rock) => rock.x > -30);
  if (f.t < 18) return;
  flight = null;
  if (WORLD.planet.boss) {
    // That was the last planet: you are home!
    localStorage.removeItem(SAVE_NAME);
    return showCard(["The ship drops out of the last jump... and there it is.", "A small blue planet. Home.", "\"We made it, Captain,\" says Nova. \"All of us.\"", "THE END. Thank you for flying with the Space Explorers!"], function () {
      sfx.win();
      screen = "title";
      el("continue").hidden = true;
      el("intro").hidden = false;
    });
  }
  screen = "play";
  landOn(state.planet + 1, false);
}

// ---------------------------------------------------------------------------
// Everything that happens, many times a second
// ---------------------------------------------------------------------------

let hudText = "";
function updateHud() {
  const planet = WORLD.planet;
  const left = Math.max(0, Math.ceil(state.timer));
  const clock = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
  const goal = state.phase === "night"
    ? (king ? "Defeat the Demon King!" : "NIGHT. Defend the ship until dawn: " + clock)
    : "Day " + state.day + " on " + planet.name + ". " + (state.fuel < planet.fuel ? "Find fuel crystals. " : "") + (!state.chart && !planet.boss ? "Find the star chart piece. " : "") + (state.fuel >= planet.fuel && state.chart ? "Ready to launch: press E at the ship! " : "") + "Dark in " + clock;
  const all = [state.hp, state.maxHp, state.fuel, state.scrap, state.hull, state.maxHull, state.chart, goal].join("|");
  if (all === hudText) return;
  hudText = all;
  el("hearts").textContent = "♥".repeat(Math.max(0, state.hp)) + "♡".repeat(Math.max(0, state.maxHp - state.hp));
  el("fuel").textContent = "Fuel " + state.fuel + "/" + planet.fuel + (state.chart ? "  Chart ✔" : "");
  el("scrap").textContent = "Scrap " + state.scrap;
  el("hull").textContent = "Ship " + Math.max(0, state.hull) + "/" + state.maxHull;
  el("phase").textContent = state.phase === "night" ? "Night" : "Day";
  el("place").textContent = "➤ " + goal;
}

let promptText = "";
function update(dt) {
  time += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) el("toast").hidden = true;
  if (shake > 0) shake -= dt;
  if (scare > 0) scare -= dt;
  if (scareRest > 0) scareRest -= dt;
  if (card) return updateCard();
  if (screen === "flight") return updateFlight(dt);
  if (pressed("KeyP")) {
    paused = !paused;
    el("paused").hidden = !paused;
  }
  if (paused) return;
  if (menuOpen) {
    if (pressed("KeyE") || pressed("Escape")) closeMenu();
    return;
  }
  if (player.safe > 0) player.safe -= dt;
  movePlayer(dt);
  // The ship: its workshop by day
  const atShip = Math.hypot(player.x - shipX, player.y - shipY - 12) < 36;
  const label = atShip ? (state.phase === "day" ? "E: The ship's workshop (fix, upgrade, launch)" : "No time for the workshop: defend the ship!") : "";
  if (label !== promptText) {
    promptText = label;
    el("prompt").textContent = label;
    el("prompt").hidden = !label;
  }
  if (pressed("KeyE") && atShip && state.phase === "day") openMenu();
  for (const code in BUILD) if (pressed(code)) build(BUILD[code][0], BUILD[code][1], BUILD[code][2]);
  if (pressed("KeyN") && state.phase === "day") startNight();
  updateCrew(dt);
  updateDemons(dt);
  updateShots(dt);
  // The clock
  state.timer -= dt;
  if (state.timer <= 0) {
    if (state.phase === "day") startNight();
    else if (!king) dawn();
  }
  if (state.phase === "day" && state.timer < 20 && state.timer + dt >= 20) toast("The sun is setting. Get back to the ship!", 4);
  updateHud();
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

// The colour of the light: white by day, fading to the planet's night colour
function ambient() {
  const night = WORLD.planet.night;
  let dark = state.phase === "night" ? Math.min(1, (NIGHT_LENGTH - state.timer) / 4, king ? 1 : state.timer / 4 + 0.15) : Math.max(0, 1 - state.timer / 14);
  dark = Math.max(0, Math.min(1, dark));
  return night.map((value) => 1 + (value * 0.5 - 1) * dark);     // (nights are very dark)
}

// Stars sliding past (used on the title screen and while flying)
function drawStars(speed) {
  ctx.fillStyle = "#05061a";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0; i < 90; i++) {
    const layer = 1 + (i % 3);
    const x = VIEW_W - (((hash(i, 1, 3) * VIEW_W + time * speed * layer) % VIEW_W) + VIEW_W) % VIEW_W;
    ctx.fillStyle = ["#5a6aa8", "#aab8e8", "#ffffff"][i % 3];
    ctx.fillRect(Math.floor(x), Math.floor(hash(i, 2, 3) * VIEW_H), layer === 3 ? 2 : 1, 1);
  }
}
function drawFlight() {
  drawStars(40);
  const f = flight;
  // The next planet grows as you get closer
  const next = PLANETS[Math.min(PLANETS.length - 1, state.planet + 1)];
  const tint = WORLD.planet.boss ? "#3a8fd8" : TERRAIN[next.ground].colours[0];
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(VIEW_W + 30 - f.t * 6, VIEW_H / 2, 10 + f.t * 4, 0, Math.PI * 2);
  ctx.fill();
  for (const rock of f.rocks) ctx.drawImage(SPR.plants.rock[0], Math.round(rock.x - rock.size), Math.round(rock.y - rock.size * 0.8), rock.size * 2, rock.size * 1.6);
  if (!(f.hit > 0 && Math.floor(time * 14) % 2)) ctx.drawImage(SPR.rocket[Math.floor(time * 12) % 2], Math.round(f.x - 20 + (Math.random() - 0.5) * shake * 8), Math.round(f.y - 10));
  ctx.fillStyle = "#2a3a6a";
  ctx.fillRect(40, 8, VIEW_W - 80, 4);
  ctx.fillStyle = "#8fe6ff";
  ctx.fillRect(40, 8, (VIEW_W - 80) * Math.min(1, f.t / 18), 4);
}
function drawTitle() {
  drawStars(14);
  ctx.fillStyle = "#3a9a5a";
  ctx.beginPath();
  ctx.arc(290, 70, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#58b870";
  ctx.beginPath();
  ctx.arc(282, 62, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(SPR.rocket[Math.floor(time * 12) % 2], Math.round(((time * 26) % (VIEW_W + 80)) - 40), Math.round(88 + Math.sin(time * 1.2) * 8));
  // Eyes watching from the dark at the bottom of the screen
  for (let i = 0; i < 7; i++) {
    if (Math.sin(time * 0.9 + i * 2.1) < 0.2) continue;
    ctx.fillStyle = "#ffe14a";
    const x = 30 + i * 48 + Math.sin(i * 5) * 12;
    const y = 190 + ((i * 37) % 30);
    ctx.fillRect(x, y, 2, 1);
    ctx.fillRect(x + 5, y, 2, 1);
  }
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
  lastTime = now;
  if (screen === "title") {
    time += dt;
    if (card) updateCard();
    drawTitle();
    canvas.hidden = false;
  } else {
    update(dt);
    if (screen === "flight" && flight) drawFlight();
    else if (screen === "play") draw3D();
    canvas.hidden = screen === "play";
  }
  for (const code in justPressed) justPressed[code] = false;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Only for testing the game.
window.SE = {
  get state() { return state; },
  player: player, crew: crew, keys: keys, justPressed: justPressed,
  watchers: watchers, beam: () => beam, turn: (angle) => (beam = angle), isLit: isLit, dread: () => dread, demons: () => demons, shots: () => shots, structures: () => structures, items: () => items, place: () => place,
  addDemon: addDemon, startNight: startNight, dawn: dawn, openMenu: openMenu, startFlight: startFlight, landOn: landOn, build: build,
  screen: () => screen, card: () => card, flight: () => flight, ship: () => [shipX, shipY], scare: () => scare, king: () => king,
};
