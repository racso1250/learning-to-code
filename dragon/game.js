// Legacy of the Dragon Tamers: the game itself.
// world.js builds the map, pixels.js draws the sprites, ground.js paints the ground.
// This file makes everything move, and tells the story.

const VIEW_W = 360;   // the game is drawn small (360 x 240 pixels) and stretched: chunky 16-bit pixels!
const VIEW_H = 240;
const canvas = document.getElementById("game");
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const lightCanvas = makeCanvas(VIEW_W, VIEW_H);   // the darkness and the lights are painted here
const lightCtx = lightCanvas.getContext("2d");

const sprites = buildSprites();
const WATER_COLOURS = ["#2468b8", "#2f7fd0", "#4a9ae6", "#b8e4ff"];
const water = makeLiquid(WATER_COLOURS, false);
const waterStreaks = makeLiquid(WATER_COLOURS, true);
const lava = makeLiquid(["#d83a12", "#ff7a1a", "#ffb52e", "#fff0a0"], false);
const WORLD_W = MAP_W * TILE;
const WORLD_H = MAP_H * TILE;
const centre = (square) => square * TILE + TILE / 2;

// Dragon Tamers 2, 3 and 4 share this file. Each brings a STORY (made in its story.js); the first game has none.
const SAGA = typeof STORY !== "undefined" && STORY ? STORY : null;
const FREE = Boolean(SAGA && SAGA.free);                    // Free Play in the Middle Lands
const hasWizard = () => (SAGA ? true : state.quest >= 1);    // has Gandalf joined you yet?

// ----- Sounds (made with ../sounds.js) -----
function sound(make) {
  try {
    make();
  } catch (error) {
    // no sound available: the game still works
  }
}
const sfx = {
  swing: () => sound(() => playNoise(0, 0.08, 2400, 700, 0.12)),
  hit: () => sound(() => playTone(0, 0.08, 240, 110, 0.18)),
  fire: () => sound(() => playNoise(0, 0.4, 1100, 200, 0.22)),
  bolt: () => sound(() => playTone(0, 0.12, 900, 1500, 0.06)),
  hurt: () => sound(() => playTone(0, 0.22, 210, 70, 0.22)),
  pick: () => sound(() => playTone(0, 0.09, 700, 1050, 0.12)),
  note: (i) => sound(() => playTone(0, 0.28, [392, 523, 659, 784][i], [392, 523, 659, 784][i], 0.16)),
  wrong: () => sound(() => playTone(0, 0.3, 160, 110, 0.18)),
  bark: () => sound(() => { playTone(0, 0.07, 520, 380, 0.14); playTone(0.12, 0.07, 540, 380, 0.14); }),
  swap: () => sound(() => playTone(0, 0.15, 300, 900, 0.1)),
  roar: () => sound(() => { playNoise(0, 0.7, 500, 90, 0.3); playTone(0, 0.7, 130, 55, 0.2); }),
  win: () => sound(() => playJingle()),
};

// ----- What the game remembers (and saves) -----
const SAVE_NAME = SAGA ? SAGA.save : "dragonTamersSave";

function newState() {
  const fresh = {
    quest: 0,            // how far through the story you are (0 to 6)
    berries: 0,
    hp: 5,
    maxHp: 5,
    name: "Ember",       // your dragon's name
    stage: 0,            // 0 no dragon, 1 hatchling, 2 drake, 3 great dragon
    mode: "human",       // who you are playing as: "human" or "dragon"
    grown: false,        // false = teen, true = grown up
    beacons: [false, false, false],
    thorns: false,       // have the thorns in the pass been burned?
    dug: [false, false, false, false],
    bossDead: false,
    ended: false,
    x: centre(PLACES.start.x),
    y: centre(PLACES.start.y) + 2,
    clock: 15,           // the time of day, in seconds
  };
  if (SAGA) {
    // The later games keep track of a few more things
    Object.assign(fresh, {
      beacons: new Array(WORLD.counts.beacon).fill(false),
      dug: new Array(WORLD.counts.dig).fill(false),
      gates: {}, taken: {}, bag: {}, kills: {}, bossesDead: {},
      respawn: [PLACES.start.x, PLACES.start.y],
    }, SAGA.start);
  }
  return fresh;
}

let state = newState();

function save() {
  const leader = lead();
  state.x = leader.x;
  state.y = leader.y;
  try {
    localStorage.setItem(SAVE_NAME, JSON.stringify(state));
  } catch (error) {
    // saving isn't allowed here: keep playing anyway
  }
}

function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_NAME));
    return saved && typeof saved.quest === "number" ? Object.assign(newState(), saved) : null;
  } catch (error) {
    return null;
  }
}

// ----- The party -----
const hero = { x: 0, y: 0, dir: 0, anim: 0, moving: false };
const wizard = { x: 0, y: 0, dir: 0, anim: 0, moving: false, cool: 1 };
const dog = { x: 0, y: 0, face: 0, anim: 0, moving: false, barked: -1, bubble: 0 };
const dragon = { x: 0, y: 0, face: 0, anim: 0, moving: false, cool: 0, fireTime: 0, auto: 2, hop: 0 };
let aim = { x: 1, y: 0 };      // the direction you last moved (dragon fire goes this way)
let trail = [];                // breadcrumbs behind the leader, for the others to follow
let cam = { x: 0, y: 0 };
let time = 0;
let screen = "title";          // "title" or "play"
let paused = false;
let shake = 0;
let safeTime = 0;              // after being hurt you can't be hurt again for a moment
let swingTime = 0;
let regionNow = "village";
let mood = "village";          // the weather and light of where you are (in the first game, the same as the region)
let regionTint = [1, 1, 1];
let saveTimer = 0;

const lead = () => (state.mode === "dragon" ? dragon : hero);
const flying = () => state.mode === "dragon" && state.stage >= 2;
const heroSet = () => sprites[SAGA ? SAGA.hero[state.grown ? 1 : 0] : state.grown ? "adult" : "teen"];

function dragonInfo() {
  if (state.stage <= 1) return { title: "Hatchling", range: 34, power: 1, speed: 84, k: 0.5 };
  if (state.stage === 2) return { title: "Drake", range: 64, power: 3, speed: 128, k: 1, set: sprites.drake };
  return { title: "Great Dragon", range: 84, power: 5, speed: 160, k: 1.35, set: sprites.great };
}

// ----- People who live in the world -----
const npcs = SAGA ? SAGA.npcs : [
  { id: "grandma", name: "Grandma Wren", look: "grandma", x: PLACES.grandma.x, y: PLACES.grandma.y },
  { id: "wizard", name: "Gandalf", look: "wizard", x: PLACES.wizard.x, y: PLACES.wizard.y },
  { id: "bram", name: "Bram the baker", look: "baker", x: 45, y: 57 },
  { id: "lily", name: "Lily", look: "lily", x: 51, y: 55 },
  { id: "finn", name: "Old Finn", look: "finn", x: 46, y: 43 },
];
for (const npc of npcs) {
  npc.px = centre(npc.x);
  npc.py = centre(npc.y) + 2;
}
let hatchlingNpc = SAGA ? { x: 0, y: 0 } : { x: centre(PLACES.glade.x), y: centre(PLACES.glade.y) - 4 };   // the wild baby dragon, before it is tamed

// ----- Monsters, flying things and sparkles -----
const MONSTER_TYPES = {
  slime: { hp: 2, speed: 26, sight: 70, feet: 14, w: 18 },
  bat: { hp: 1, speed: 44, sight: 90, feet: 22, w: 22, flies: true },
  spider: { hp: 2, speed: 52, sight: 80, feet: 13, w: 20 },
  golem: { hp: 5, speed: 17, sight: 70, feet: 27, w: 26 },
  imp: { hp: 2, speed: 30, sight: 110, feet: 19, w: 18, shoots: true },
  // Monsters from the later games ("like" = it moves like that monster)
  bogSlime: { hp: 3, speed: 24, sight: 70, feet: 14, w: 18, like: "slime" },
  iceSlime: { hp: 3, speed: 30, sight: 75, feet: 14, w: 18, like: "slime" },
  magmaSlime: { hp: 3, speed: 26, sight: 100, feet: 14, w: 18, like: "slime", shoots: true },
  scorpion: { hp: 3, speed: 56, sight: 85, feet: 13, w: 20, like: "spider" },
  wraith: { hp: 2, speed: 50, sight: 95, feet: 22, w: 22, flies: true, like: "bat" },
  iceGolem: { hp: 6, speed: 18, sight: 75, feet: 27, w: 26 },
  sandGolem: { hp: 6, speed: 18, sight: 75, feet: 27, w: 26 },
  shade: { hp: 3, speed: 32, sight: 115, feet: 19, w: 18, shoots: true },
};
let monsters = [];
let shots = [];        // magic bolts, fireballs and shadow orbs
let particles = [];
let pickups = [];      // hearts dropped by monsters
let boss = null;
let burning = [];      // thorns that are on fire right now
let pickedAt = {};     // when each berry bush was last picked

function spawnMonsters() {
  monsters = WORLD.monsters.map(function (spot) {
    const type = MONSTER_TYPES[spot.type];
    return { type: spot.type, x: centre(spot.x), y: centre(spot.y), homeX: centre(spot.x), homeY: centre(spot.y), hp: type.hp, flash: 0, wait: 0, dead: 0, cool: 1 + Math.random() * 2, wx: 0, wy: 0, think: 0 };
  });
}

function makeBoss() {
  boss = null;
  el("boss-bar").hidden = true;
  let def = null;
  if (!SAGA) {
    if (!state.bossDead) def = { id: "wyrm", name: "The Shadow Wyrm", kind: "wyrm", look: "wyrm", hp: 30, x: PLACES.boss.x, y: PLACES.boss.y };
  } else if (FREE) {
    // Free Play: whichever boss is closest (and still alive)
    let nearest = 440;
    for (const other of SAGA.bosses) {
      const distance = Math.hypot(centre(other.x) - lead().x, centre(other.y) - lead().y);
      if (!state.bossesDead[other.id] && distance < nearest) {
        nearest = distance;
        def = other;
      }
    }
  } else {
    const step = stepNow();
    if (step.type === "boss" && !state.bossesDead[step.boss]) def = SAGA.bosses.find((other) => other.id === step.boss);
  }
  if (def) boss = { def: def, kind: def.kind, x: centre(def.x), y: centre(def.y), homeX: centre(def.x), homeY: centre(def.y), hp: def.hp, maxHp: def.hp, awake: false, flash: 0, cool: 2, t: 0, face: 1 };
}

// ----- Keyboard -----
const keys = {};
const justPressed = {};
const MOVE_KEYS = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};
document.addEventListener("keydown", function (event) {
  if (event.target.tagName === "INPUT") {
    if (event.key === "Enter") document.getElementById("name-ok").click();
    return;
  }
  if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
  if (!keys[event.code]) justPressed[event.code] = true;
  keys[event.code] = true;
});
document.addEventListener("keyup", function (event) {
  keys[event.code] = false;
});
const held = (name) => Object.keys(MOVE_KEYS).some((code) => MOVE_KEYS[code] === name && keys[code]);
function pressed(code) {
  const yes = justPressed[code];
  justPressed[code] = false;
  return yes;
}

// ----- Words on the screen -----
const el = (id) => document.getElementById(id);
let toastTimer = 0;
function toast(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastTimer = seconds || 3;
}

let talk = null;   // the conversation happening now: { lines, index, shown, done }
function say(lines, done) {
  talk = { lines: lines, index: 0, shown: 0, done: done };
  showLine();
}
function showLine() {
  const line = talk.lines[talk.index];
  el("dialogue").hidden = false;
  el("dialogue-name").textContent = line.who;
  el("dialogue-text").textContent = "";
  const face = el("dialogue-face").getContext("2d");
  face.clearRect(0, 0, 16, 16);
  if (line.face === "dog") face.drawImage(sprites.dog[0][0], 0, 1);
  else if (line.face === "dragon") face.drawImage(sprites.hatchling[0][0], 8, 0, 16, 16, 0, 0, 16, 16);
  else {
    const set = line.face === "hero" ? heroSet() : sprites[line.face];
    face.drawImage(portrait(set[0][0], line.face === "lily" || (line.face === "hero" && !state.grown)), 0, 0);
  }
  talk.shown = 0;
}
function updateTalk(dt) {
  const line = talk.lines[talk.index];
  const text = line.text.replace(/\{name\}/g, state.name);
  if (talk.shown < text.length) {
    talk.shown = Math.min(text.length, talk.shown + dt * 60);
    el("dialogue-text").textContent = text.slice(0, Math.floor(talk.shown));
  }
  if (pressed("Space") || pressed("Enter")) {
    if (talk.shown < text.length) {
      talk.shown = text.length;
      el("dialogue-text").textContent = text;
      return;
    }
    talk.index++;
    if (talk.index < talk.lines.length) return showLine();
    const done = talk.done;
    talk = null;
    el("dialogue").hidden = true;
    if (done) done();
  }
}

// Story cards: big black screens with the story on them
let card = null;
function showCard(lines, done, drawArt) {
  card = { lines: lines, index: 0, done: done };
  el("card").hidden = false;
  el("card-art").hidden = !drawArt;
  if (drawArt) drawArt(el("card-art").getContext("2d"));
  el("card-text").textContent = lines[0].replace(/\{name\}/g, state.name);
}
function updateCard() {
  if (!pressed("Space") && !pressed("Enter")) return;
  card.index++;
  if (card.index < card.lines.length) {
    el("card-text").textContent = card.lines[card.index].replace(/\{name\}/g, state.name);
    return;
  }
  const done = card.done;
  card = null;
  el("card").hidden = true;
  if (done) done();
}

const QUESTS = [
  () => "Talk to Grandma Wren in the village square.",
  () => "Pick 3 emberberries in the Sunny Meadows, to the east. (" + Math.min(3, state.berries) + "/3)",
  () => "Take the west road into the Forest of Doom and find the baby dragon.",
  () => "Light the 3 Dragon Beacons with dragon fire: press C to become " + state.name + "! (" + state.beacons.filter(Boolean).length + "/3)",
  () => "Press C to fly! Cross the sea to Ashen Isle in the north-east and find the Temple of Sauron.",
  () => "Defeat the Shadow Wyrm with dragon fire!",
  () => "You are a true Dragon Tamer! Explore the world with " + state.name + ".",
];

let hudText = "";
function updateHud() {
  const who = state.stage === 0 ? "" : "🐉 " + state.name + " the " + dragonInfo().title;
  const quest = SAGA ? stepText() : QUESTS[state.quest]();
  const all = [state.hp, state.maxHp, state.berries, who, state.mode, hasWizard(), state.grown, quest].join("|");
  if (all === hudText) return;
  hudText = all;
  // Hearts, drawn with the pixel-art heart
  const hearts = el("hearts");
  hearts.width = state.maxHp * 11;
  const g = hearts.getContext("2d");
  for (let i = 0; i < state.maxHp; i++) g.drawImage(i < state.hp ? sprites.heart : sprites.heartEmpty, i * 11, 0);
  el("berries").textContent = "🍓 " + state.berries + "   " + (state.grown ? "⚔ Sword" : "🔪 Pocket knife");
  el("dragon-label").textContent = who;
  el("place").textContent = "➤ " + quest;
  // The faces of your party: the one with the gold border is who you are playing as
  showSlot("human", true, portrait(heroSet()[0][0], !state.grown));
  showSlot("dragon", state.stage > 0, dragonFace());
  showSlot("wizard", hasWizard(), portrait(sprites.wizard[0][0], false));
}

function showSlot(mode, have, face) {
  const button = el("slot-" + mode);
  button.hidden = !have;
  button.classList.toggle("active", state.mode === mode);
  const g = button.querySelector("canvas").getContext("2d");
  g.clearRect(0, 0, 16, 16);
  if (have) g.drawImage(face, 0, 0);
}

function dragonFace() {
  const face = makeCanvas(16, 16);
  const g = face.getContext("2d");
  if (state.stage <= 1) g.drawImage(sprites.hatchling[0][0], 8, 1, 16, 16, 0, 0, 16, 16);
  else {
    const info = dragonInfo();
    g.drawImage(info.set.stand[0][1], Math.round(25 * info.k), Math.round(1 * info.k), 16, 16, 0, 0, 16, 16);
  }
  return face;
}

// ----- Can you walk or fly here? -----
function tileBlocked(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || WORLD.blocked[ty][tx];
}
function canStand(x, y) {
  return !tileBlocked(x - 4, y - 5) && !tileBlocked(x + 4, y - 5) && !tileBlocked(x - 4, y + 1) && !tileBlocked(x + 4, y + 1);
}
function canWalk(x, y) {
  if (!canStand(x, y)) return false;
  for (const npc of npcs) {
    if (npc.id === "wizard" && hasWizard()) continue;
    if (Math.hypot(npc.px - x, npc.py - y) < 9 && Math.hypot(npc.px - lead().x, npc.py - lead().y) >= 9) return false;
  }
  return true;
}
function canFly(x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && !WORLD.noFly[ty][tx];
}

// ----- Sparkles, smoke and fire -----
function spark(x, y, vx, vy, life, colour, more) {
  if (particles.length > 500) return;
  particles.push(Object.assign({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, colour: colour, size: 1, gravity: 0, glow: null, high: false }, more || {}));
}
function burst(x, y, colours, count, speed, more) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.3 + Math.random() * 0.7);
    spark(x, y, Math.cos(angle) * power, Math.sin(angle) * power, 0.3 + Math.random() * 0.5, colours[Math.floor(Math.random() * colours.length)], more);
  }
}
const FIRE_COLOURS = ["#fff6c0", "#ffd84a", "#ff9a2a", "#ff5a1a", "#c8321a"];

// ---------------------------------------------------------------------------
// Starting and loading
// ---------------------------------------------------------------------------

function placeParty() {
  for (const who of [hero, dragon, wizard, dog]) {
    who.x = state.x;
    who.y = state.y;
  }
  if (!hasWizard()) {
    wizard.x = centre(PLACES.wizard.x);
    wizard.y = centre(PLACES.wizard.y) + 2;
  }
  // Spread everyone out a little, so they don't stand on top of each other
  const leader = lead();
  if (!flying()) {
    if (leader !== wizard && hasWizard()) wizard.x -= 13;
    if (leader !== hero) hero.y += 8;
    dog.x += 12;
    dog.y += 3;
    if (leader !== dragon) {
      dragon.x += state.stage >= 2 ? 30 : 22;
      dragon.y -= 2;
    }
  }
  trail = [];
  cam.x = Math.max(0, Math.min(WORLD_W - VIEW_W, state.x - VIEW_W / 2));
  cam.y = Math.max(0, Math.min(WORLD_H - VIEW_H, state.y - 12 - VIEW_H / 2));
}

function applyWorldChanges() {
  // Things in the world that the saved game has changed
  for (const thing of WORLD.objects) {
    if (thing.type === "thorns") WORLD.blocked[thing.y][thing.x] = !state.thorns;
    if (thing.type === "gate") {
      // A closed gate stops you on foot and in the air
      WORLD.blocked[thing.y][thing.x] = !state.gates[thing.id];
      WORLD.noFly[thing.y][thing.x] = !state.gates[thing.id];
    }
  }
}

function startGame(saved) {
  state = saved || newState();
  if (flying() && !canStand(state.x, state.y)) {
    // A saved game in mid-air: that's fine, keep flying
  }
  placeParty();
  applyWorldChanges();
  spawnMonsters();
  makeBoss();
  shots = [];
  particles = [];
  pickups = [];
  pickedAt = {};
  screen = "play";
  el("intro").hidden = true;
  hudText = "";
  regionNow = regionAt(Math.floor(state.x / TILE), Math.floor(state.y / TILE));
  toast(REGION_NAMES[regionNow], 3);
  if (SAGA && !saved) state.respawn = stepNow().respawn;
}

el("start").addEventListener("click", () => startGame(null));
el("continue").addEventListener("click", () => startGame(loadSave()));
el("continue").hidden = !loadSave();
el("new-game").addEventListener("click", function () {
  if (confirm("Start again from the very beginning?")) {
    localStorage.removeItem(SAVE_NAME);
    location.reload();
  }
});
if (el("free-play")) {
  // Dragon Tamers 2, 3 and 4: swap between the story and Free Play in the Middle Lands
  el("free-play").textContent = FREE ? "Back to the story" : "Free Play: the Middle Lands";
  el("free-play").addEventListener("click", () => (location.search = FREE ? "" : "?free=1"));
  if (FREE) {
    el("intro-text").textContent = "Free Play! The Middle Lands are 20 times bigger than the story world. Fly anywhere with your Great Dragon: light beacons, find gems and beat giants. Press M for the map.";
    el("start").textContent = "New Free Play";
  }
}
el("pause-button").addEventListener("click", function () {
  el("pause-button").blur();
  togglePause();
});
function togglePause() {
  if (screen !== "play") return;
  paused = !paused;
  el("paused").hidden = !paused;
}


// ---------------------------------------------------------------------------
// The story engine for Dragon Tamers 2, 3 and 4.
// Their stories are lists of steps (see each game's story.js). Kinds of step:
//   talk (to someone), collect (gems), kill (monsters), light (beacons),
//   burn (a gate of thorns or ice), boss, reach (a place), end.
// ---------------------------------------------------------------------------

function stepNow() {
  return SAGA.steps[Math.min(state.quest, SAGA.steps.length - 1)];
}

// Turn ["Gandalf", "Hello!"] from a story file into a line for the talking box
function sagaLine(pair) {
  const face = pair[0] === "{name}" ? "dragon" : pair[0] === "Gandalf" ? "wizard" : pair[0] === "Biscuit" ? "dog" : (npcs.find((npc) => npc.name === pair[0]) || { look: "wizard" }).look;
  return { who: pair[0].replace("{name}", state.name), face: face, text: pair[1] };
}

function stepText() {
  const step = stepNow();
  const lit = state.beacons.filter(Boolean).length;
  if (step.type === "free") {
    return "Free Play in the Middle Lands!  Beacons lit: " + lit + "/" + state.beacons.length + "   Gems: " + Object.keys(state.taken).length + "/" + WORLD.counts.pickup + "   Bosses beaten: " + Object.keys(state.bossesDead).length + "/" + SAGA.bosses.length;
  }
  let text = step.text;
  if (step.type === "collect") text += " (" + Math.min(step.count, state.bag[step.item] || 0) + "/" + step.count + ")";
  if (step.type === "kill") text += " (" + Math.min(step.count, state.kills[step.monster] || 0) + "/" + step.count + ")";
  if (step.type === "light" && step.beacons.length > 1) text += " (" + step.beacons.filter((id) => state.beacons[id]).length + "/" + step.beacons.length + ")";
  return text.replace(/\{name\}/g, state.name);
}

function stepDone(step) {
  if (step.type === "collect") return (state.bag[step.item] || 0) >= step.count;
  if (step.type === "kill") return (state.kills[step.monster] || 0) >= step.count;
  if (step.type === "light") return step.beacons.every((id) => state.beacons[id]);
  if (step.type === "burn") return Boolean(state.gates[step.gate]);
  if (step.type === "boss") return Boolean(state.bossesDead[step.boss]);
  if (step.type === "reach") return Math.hypot(lead().x - centre(step.at[0]), lead().y - centre(step.at[1])) < (step.radius || 6) * TILE;
  return false;   // "talk" steps finish when you talk; "end" and "free" never finish
}

let stepBusy = false;
let afterName = null;    // what to do once the dragon has been given a name

function sagaUpdate() {
  if (stepBusy || talk || card) return;
  if (stepDone(stepNow())) completeStep();
}

function completeStep() {
  const step = stepNow();
  const reward = step.reward || {};
  stepBusy = true;
  sfx.win();
  if (reward.maxHp) state.maxHp += reward.maxHp;
  if (reward.maxHp || reward.heal) state.hp = state.maxHp;
  const finish = function () {
    if (reward.grown) state.grown = true;
    if (reward.stage && reward.stage > state.stage) growDragon(reward.stage);
    state.quest++;
    stepBusy = false;
    enterStep();
    save();
  };
  const after = () => (step.done ? say(step.done.map(sagaLine), finish) : finish());
  if (step.card) showCard(step.card, after);
  else after();
}

function growDragon(stage) {
  state.stage = stage;
  if (state.mode !== "dragon") {
    dragon.x = lead().x + 20;
    dragon.y = lead().y;
    trail = [];
  }
  burst(dragon.x, dragon.y - 14, ["#ffffff", "#ffd84a", "#ff9a2a"], 60, 90, { glow: "warm" });
  sfx.roar();
  toast(state.name + " has grown into a " + dragonInfo().title + "!" + (stage === 2 ? " Become " + state.name + " (press C) to fly." : ""), 6);
}

function enterStep() {
  const step = stepNow();
  state.kills = {};
  state.respawn = step.respawn;
  makeBoss();
  hudText = "";
  if (step.type === "end" && !state.ended) {
    state.ended = true;
    showCard(SAGA.ending, function () {
      sfx.win();
      save();
    });
  }
}

function sagaTalk(npc) {
  const step = stepNow();
  if (step.type !== "talk" || step.npc !== npc.id) return say([{ who: npc.name, face: npc.look, text: npc.line }]);
  say(step.lines.map(sagaLine), function () {
    if (!step.askName) return completeStep();
    afterName = completeStep;
    el("name-input").value = state.name;
    el("name-box").hidden = false;
    el("name-input").focus();
    el("name-input").select();
  });
}

function takePickup(thing) {
  state.taken[thing.id] = true;
  state.bag[thing.item] = (state.bag[thing.item] || 0) + 1;
  sfx.pick();
  burst(centre(thing.x), centre(thing.y) - 4, [thing.colour, "#ffffff"], 14, 50, { glow: "warm" });
  toast("You found a " + thing.label + "!", 2.5);
  hudText = "";
}

// ---------------------------------------------------------------------------
// The story (of the first game)
// ---------------------------------------------------------------------------

function talkTo(npc) {
  if (SAGA) return sagaTalk(npc);
  const g = (text) => ({ who: "Grandma Wren", face: "grandma", text: text });
  const w = (text) => ({ who: "Gandalf", face: "wizard", text: text });
  if (npc.id === "grandma" || npc.id === "wizard") {
    if (!hasWizard()) {
      return say([
        g("There you are, sleepyhead! Today is a big day."),
        g("Our family were the Dragon Tamers. But the dragons vanished long ago, when the Shadow Wyrm came."),
        w("Not all of them! I am Gandalf, and I bring news. A dragon egg has hatched in the Forest of Doom."),
        w("The little one is all alone. A Dragon Tamer must go to it. I will travel with you."),
        g("Dragons love emberberries. Pick 3 in the Sunny Meadows to the east, then take the west road into the forest."),
        g("And take Biscuit! That little border terrier can sniff out buried treasure."),
        g("One more thing: here is my old pocket knife. It is only little, but it has seen off many a slime!"),
      ], function () {
        state.quest = 1;
        wizard.x = centre(PLACES.wizard.x);
        wizard.y = centre(PLACES.wizard.y) + 2;
        sfx.win();
        save();
      });
    }
    if (state.quest === 1) return say([g("Pick 3 emberberries in the Sunny Meadows, to the east. Look for bushes with red berries!")]);
    if (state.quest === 2) return say([g("You have the berries! Now take the west road into the Forest of Doom. Stay close to Gandalf, his staff lights the way.")]);
    if (state.quest === 3) return say([g("A dragon in Emberwick again! I never thought I would see the day."), g("Light the three Dragon Beacons, dear. Press C to become {name}, then Space to breathe fire.")]);
    if (state.quest < 6) return say([g("Look how you have both grown! Be brave at the Temple of Sauron. The Shadow Wyrm fears dragon fire.")]);
    return say([g("The dragons are home, and so are you. I am so proud of you, Dragon Tamer.")]);
  }
  if (npc.id === "bram") {
    return say([{ who: npc.name, face: "baker", text: state.stage === 0 ? "Fresh bread! They say the Forest of Doom has spiders as big as dogs. Rather you than me!" : "Could {name} toast my bread? No? Worth a try." }]);
  }
  if (npc.id === "lily") {
    return say([{ who: npc.name, face: "lily", text: state.stage === 0 ? "Is that your dog? He's so scruffy! I love him." : "A REAL DRAGON! Can I pat {name}? Please please please!" }]);
  }
  if (npc.id === "finn") {
    return say([{ who: npc.name, face: "finn", text: state.stage < 2 ? "I once saw a black dragon fly over Glimmer Lake, heading north-east across the sea. Gave me the shivers." : "You FLEW here? On a DRAGON? Well, I never." }]);
  }
}

// Taming: the baby dragon sings a song, and you copy it
let tame = null;
function startTaming() {
  say([
    { who: "Gandalf", face: "wizard", text: "Gently now. Dragons trust those who can sing their song." },
    { who: "Gandalf", face: "wizard", text: "Listen to the little one, then copy the song with the arrow keys!" },
  ], function () {
    tame = { round: 0, song: [], step: 0, phase: "listen", timer: 0.8, playing: 0 };
    el("tame").hidden = false;
    nextSong();
  });
}
function nextSong() {
  tame.song = [];
  for (let i = 0; i < 3 + tame.round; i++) tame.song.push(Math.floor(Math.random() * 4));
  tame.phase = "listen";
  tame.playing = 0;
  tame.timer = 0.9;
  tame.step = 0;
  el("tame-text").textContent = "Listen...";
  el("tame-trust").textContent = "Trust: " + "♥".repeat(tame.round) + "♡".repeat(3 - tame.round);
}
function lightPad(note) {
  for (const pad of document.querySelectorAll(".pad")) pad.classList.toggle("lit", Number(pad.dataset.note) === note);
}
function updateTaming(dt) {
  tame.timer -= dt;
  if (tame.phase === "listen") {
    if (tame.timer > 0) return;
    if (tame.playing < tame.song.length) {
      const note = tame.song[tame.playing++];
      lightPad(note);
      sfx.note(note);
      dragon.hop = 0.3;
      tame.timer = 0.55;
      setTimeout(() => lightPad(-1), 330);
    } else {
      tame.phase = "copy";
      el("tame-text").textContent = "Your turn! Copy the song with the arrow keys.";
    }
    return;
  }
  if (tame.phase === "wait") {
    if (tame.timer <= 0) nextSong();
    return;
  }
  const noteKeys = [["ArrowUp", "KeyW"], ["ArrowLeft", "KeyA"], ["ArrowRight", "KeyD"], ["ArrowDown", "KeyS"]];
  for (let note = 0; note < 4; note++) {
    if (!pressed(noteKeys[note][0]) && !pressed(noteKeys[note][1])) continue;
    lightPad(note);
    setTimeout(() => lightPad(-1), 200);
    if (note !== tame.song[tame.step]) {
      sfx.wrong();
      el("tame-text").textContent = "Oops! That wasn't it. Listen again...";
      tame.phase = "wait";
      tame.timer = 1.2;
      return;
    }
    sfx.note(note);
    tame.step++;
    if (tame.step < tame.song.length) continue;
    // A whole song copied: feed the dragon a berry
    tame.round++;
    state.berries = Math.max(0, state.berries - 1);
    dragon.hop = 0.6;
    burst(hatchlingNpc.x, hatchlingNpc.y - 14, ["#ff8ab0", "#ffc0d0"], 10, 30, { gravity: -30 });
    el("tame-trust").textContent = "Trust: " + "♥".repeat(tame.round) + "♡".repeat(3 - tame.round);
    if (tame.round >= 3) {
      tame = null;
      el("tame").hidden = true;
      sfx.win();
      el("name-box").hidden = false;
      el("name-input").focus();
      el("name-input").select();
      return;
    }
    el("tame-text").textContent = "It ate a berry from your hand! One more song...";
    tame.phase = "wait";
    tame.timer = 1.3;
    return;
  }
}
el("name-ok").addEventListener("click", function () {
  if (el("name-box").hidden) return;
  state.name = el("name-input").value.trim().slice(0, 10) || state.name || "Ember";
  el("name-box").hidden = true;
  el("name-input").blur();
  if (afterName) {
    // (In the later games the dragon is named at the start of the story)
    const next = afterName;
    afterName = null;
    hudText = "";
    return next();
  }
  state.stage = 1;
  state.quest = 3;
  dragon.x = hatchlingNpc.x;
  dragon.y = hatchlingNpc.y;
  trail = [];
  const w = (text) => ({ who: "Gandalf", face: "wizard", text: text });
  say([
    { who: state.name, face: "dragon", text: "Chirp! Chirrup!" },
    w("Well done, Dragon Tamer! {name} trusts you now."),
    w("Press C to swap who you are: you, {name}, or even me! When you are the dragon, Space breathes fire."),
    w("Fire burns thorns, and it lights the three Dragon Beacons: one in the Sunny Meadows, one deep in this forest, one on Stormcrag."),
    w("Light all three, and their old magic will help {name} grow."),
  ], save);
});

function lightBeacon(id) {
  if (state.beacons[id]) return;
  state.beacons[id] = true;
  const spot = SAGA ? WORLD.objects.find((thing) => thing.type === "beacon" && thing.id === id) : PLACES.beacons[id];
  burst(centre(spot.x), spot.y * TILE - 6, FIRE_COLOURS, 40, 70, { glow: "fire", gravity: -40 });
  shake = 0.4;
  sfx.win();
  const count = state.beacons.filter(Boolean).length;
  toast("You lit " + spot.name + "! (" + count + "/" + state.beacons.length + ")", 4);
  hudText = "";
  save();
  if (!SAGA && count === 3 && state.quest === 3) setTimeout(growUp, 1800);
}

function growUp() {
  showCard([
    "The three Dragon Beacons blaze across the land.",
    "Their old magic flows into {name}...",
    "Three years pass. You grow tall and strong.",
    "And so does {name}!",
  ], function () {
    if (state.mode === "dragon") hero.x = dragon.x, hero.y = dragon.y;
    state.mode = "human";
    if (!canStand(hero.x, hero.y)) hero.x = dragon.x, hero.y = dragon.y;
    state.grown = true;
    state.stage = 2;
    state.quest = 4;
    state.maxHp += 2;
    state.hp = state.maxHp;
    dragon.x = hero.x + 20;
    dragon.y = hero.y;
    trail = [];
    makeBoss();
    burst(dragon.x, dragon.y - 14, ["#ffffff", "#ffd84a", "#ff9a2a"], 60, 90, { glow: "warm" });
    sfx.roar();
    const w = (text) => ({ who: "Gandalf", face: "wizard", text: text });
    say([
      w("Look at you both! {name} is a Drake now, strong enough to carry us all."),
      w("And a grown Dragon Tamer needs more than a pocket knife. Take this: the sword of the old Tamers."),
      w("Press C and we fly! Nothing but the highest peaks can stop a dragon."),
      w("The Shadow Wyrm hides in the Temple of Sauron, on Ashen Isle in the north-east sea. It is time to end its shadow."),
    ], save);
  });
}

function bossDefeated() {
  if (SAGA) {
    const def = boss.def;
    state.bossesDead[def.id] = true;
    state.maxHp++;
    state.hp = state.maxHp;
    boss = null;
    shots = [];
    el("boss-bar").hidden = true;
    shake = 1;
    sfx.roar();
    toast(def.name + " is defeated! You gain a heart.", 4);
    hudText = "";
    return save();
  }
  state.bossDead = true;
  boss = null;
  shots = [];
  el("boss-bar").hidden = true;
  shake = 1;
  sfx.roar();
  setTimeout(function () {
    showCard([
      "The Shadow Wyrm bursts into a thousand sparks!",
      "The darkness lifts from the Temple of Sauron.",
      "{name} glows like the sun: a Great Dragon!",
      "And dragons return to the skies of Emberwick...",
    ], function () {
      state.stage = 3;
      state.quest = 6;
      state.hp = state.maxHp;
      showCard([
        "Many years later...",
        "\"Your turn,\" you say, and hand over a warm red egg.",
        "The legacy of the Dragon Tamers lives on.",
        "THE END. (But you can keep exploring!)",
      ], function () {
        state.ended = true;
        sfx.win();
        save();
      }, drawEndingArt);
    });
  }, 1500);
}

function drawEndingArt(g) {
  g.imageSmoothingEnabled = false;
  const sky = g.createLinearGradient(0, 0, 0, 48);
  sky.addColorStop(0, "#3a2a6a");
  sky.addColorStop(0.6, "#ff8a5a");
  sky.addColorStop(1, "#ffd88a");
  g.fillStyle = sky;
  g.fillRect(0, 0, 120, 48);
  g.fillStyle = "#fff3c0";
  g.beginPath();
  g.arc(22, 13, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#3f8a3a";
  g.fillRect(0, 40, 120, 8);
  g.fillStyle = "#52a044";
  g.fillRect(0, 40, 120, 2);
  g.drawImage(sprites.great.stand[1][0], 58, -3);
  g.drawImage(sprites.elder[2][0], 34, 11);
  g.drawImage(sprites.newTeen[1][0], 50, 11);
  g.drawImage(sprites.egg, 45, 24);
  g.drawImage(sprites.dog[0][0], 16, 29);
  g.drawImage(sprites.wizard[2][0], 2, 11);
}

// ---------------------------------------------------------------------------
// Doing things: talking, picking, digging, fighting, breathing fire
// ---------------------------------------------------------------------------

// What is in front of you that Space would use?
function findUse() {
  const who = lead();     // you, or Gandalf
  const fx = who.x + [0, -10, 10, 0][who.dir];
  const fy = who.y - 4 + [10, 0, 0, -10][who.dir];
  let best = null;
  let bestDistance = 20;
  function consider(x, y, label, act, reach) {
    const distance = Math.hypot(x - fx, y - fy);
    if (distance < bestDistance && distance < (reach || 20)) {
      bestDistance = distance;
      best = { label: label, act: act };
    }
  }
  for (const npc of npcs) {
    if (npc.id === "wizard" && hasWizard()) continue;
    consider(npc.px, npc.py - 4, "Talk to " + npc.name, () => talkTo(npc));
  }
  // Gandalf walks right behind you, so you have to face him closely to talk (and not in a fight!)
  const fighting = monsters.some((m) => m.dead <= 0 && Math.hypot(m.x - who.x, m.y - who.y) < 70);
  if (hasWizard() && !fighting && state.mode === "human") consider(wizard.x, wizard.y - 4, "Ask Gandalf what to do", () => say([{ who: "Gandalf", face: "wizard", text: gandalfHint() }]), 11);
  if (state.stage === 0) {
    consider(hatchlingNpc.x, hatchlingNpc.y - 4, "Say hello to the baby dragon", function () {
      if (state.berries < 3) say([{ who: "Gandalf", face: "wizard", text: "The poor thing is hiding. It looks hungry! We need 3 emberberries from the Sunny Meadows, far to the east." }]);
      else startTaming();
    });
  }
  const nearRow = Math.floor(fy / TILE);
  for (let ty = Math.max(0, nearRow - 2); ty <= Math.min(MAP_H - 1, nearRow + 2); ty++) for (const near of rows[ty]) {
    const thing = near.o;
    const x = centre(thing.x);
    const y = centre(thing.y);
    if (Math.abs(x - fx) > 30 || Math.abs(y - fy) > 30) continue;
    if (thing.type === "sign") consider(x, y, "Read the sign", () => say([{ who: "The sign says", face: "hero", text: thing.text }]));
    if (thing.type === "berrybush" && berriesReady(thing)) consider(x, y, "Pick emberberries", () => pickBerries(thing));
    if (thing.type === "dig" && !state.dug[thing.id]) consider(x, y, "Dig here", () => digUp(thing));
    if (thing.type === "beacon" && !state.beacons[thing.id]) consider(x, y, "Look at the beacon", () => say([{ who: "Gandalf", face: "wizard", text: state.stage === 0 ? "A Dragon Beacon. Only dragon fire can light it." : "Only dragon fire can light it. Press C to become {name}, face the beacon and press Space!" }]));
    if (thing.type === "pickup" && !state.taken[thing.id]) consider(x, y, "Pick up the " + thing.label, () => takePickup(thing));
    if (thing.type === "gate" && !state.gates[thing.id]) consider(x, y, thing.look === "ice" ? "Look at the wall of ice" : "Look at the thorns", () => say([{ who: "Gandalf", face: "wizard", text: state.stage >= thing.needs ? "Dragon fire will clear this! Press C to become {name}, face it and press Space." : "This is too strong for {name}'s fire. {name} must grow bigger first." }]));
    if (thing.type === "thorns" && !state.thorns) consider(x, y, "Look at the thorns", () => say([{ who: "Gandalf", face: "wizard", text: state.stage === 0 ? "These thorns are as hard as iron. Only dragon fire could burn them." : "Dragon fire will burn these! Press C to become {name}, then Space." }]));
  }
  return best;
}

function gandalfHint() {
  if (SAGA) return (stepNow().hint || "Follow the road, young Tamer, and keep your eyes open.").replace(/\{name\}/g, state.name);
  return [
    "",
    "The Sunny Meadows are along the east road. Look for bushes with red berries.",
    "The baby dragon is in the Forest of Doom. Follow the west road, and stay in the light of my staff.",
    "Three beacons to light: in the Sunny Meadows, deep in the Forest of Doom, and on Stormcrag past the thorns. Only {name}'s fire will do it.",
    "Press C and we fly! Ashen Isle is north-east, across the sea.",
    "Keep moving, and keep breathing fire at the Wyrm!",
    "A wizard is never late. Nor is he early. But he does enjoy a good dragon ride.",
  ][state.quest];
}

const berriesReady = (bush) => !(pickedAt[bush.id] && time - pickedAt[bush.id] < 45);

function pickBerries(bush) {
  pickedAt[bush.id] = time;
  sfx.pick();
  burst(centre(bush.x), centre(bush.y) - 6, ["#ff5a3a", "#ffc0a0"], 8, 40, { gravity: 80 });
  if (state.hp < state.maxHp && (SAGA || state.quest !== 1)) {
    state.hp++;
    return toast("Yum! An emberberry heals 1 heart.");
  }
  state.berries++;
  if (!SAGA && state.quest === 1 && state.berries >= 3) {
    state.quest = 2;
    sfx.win();
    say([{ who: "Gandalf", face: "wizard", text: "Three emberberries! Now, back through the village and along the west road, into the Forest of Doom." }], save);
  } else toast("You picked an emberberry! (" + state.berries + ")");
}

function digUp(spot) {
  state.dug[spot.id] = true;
  state.maxHp++;
  state.hp = state.maxHp;
  sfx.win();
  burst(centre(spot.x), centre(spot.y), ["#8a5a30", "#c8a060", "#ff4a5a"], 20, 50, { gravity: 100 });
  say([{ who: "Biscuit", face: "dog", text: "Woof! Woof! (Biscuit dug up a Heart Root. You gain 1 more heart!)" }], save);
}

let slash = null;   // the knife swishing through the air: { who, dx, dy, time }

// Space, when there is nothing to talk to or pick up: attack!
function attack() {
  if (swingTime > 0) return;
  if (state.mode === "wizard") {
    // Gandalf casts a bolt of magic the way he is facing
    swingTime = 0.4;
    const dx = [0, -1, 1, 0][wizard.dir];
    const dy = [1, 0, 0, -1][wizard.dir];
    shots.push({ kind: "bolt", x: wizard.x + dx * 8, y: wizard.y - 12 + dy * 6, vx: dx * 210, vy: dy * 210, life: 0.75, power: 2 });
    burst(wizard.x + dx * 8, wizard.y - 14, ["#ffffff", "#bfe8ff", "#7ab8ff"], 8, 40, { glow: "magic" });
    sfx.bolt();
    return;
  }
  swingTime = 0.28;
  stab(hero);
}

// A quick jab with the pocket knife (or, once you are grown up, a swing of your sword)
function stab(who) {
  const dx = [0, -1, 1, 0][who.dir];
  const dy = [1, 0, 0, -1][who.dir];
  const reach = state.grown ? 15 : 11;
  const hx = who.x + dx * reach;
  const hy = who.y - 6 + dy * reach;
  slash = { who: who, dx: dx, dy: dy, time: 0.18 };
  sfx.swing();
  hurtMonstersNear(hx, hy, state.grown ? 16 : 11, state.grown ? 2 : 1);
  if (boss && boss.awake && Math.hypot(boss.x - hx, boss.y - hy) < 26) hurtBoss(state.grown ? 2 : 1);
}

function hurtMonstersNear(x, y, radius, power) {
  let any = false;
  for (const m of monsters) {
    if (m.dead > 0) continue;
    if (Math.hypot(m.x - x, m.y - 6 - y) > radius + 6) continue;
    hurtMonster(m, power, x, y);
    any = true;
  }
  return any;
}

function hurtMonster(m, power, fromX, fromY) {
  m.hp -= power;
  m.flash = 0.15;
  const away = Math.atan2(m.y - fromY, m.x - fromX);
  m.wx = Math.cos(away) * 90;
  m.wy = Math.sin(away) * 90;
  m.wait = 0.25;
  sfx.hit();
  if (m.hp > 0) return;
  m.dead = 50;      // seconds until it comes back
  if (SAGA) {
    state.kills[m.type] = (state.kills[m.type] || 0) + 1;
    hudText = "";
  }
  burst(m.x, m.y - 6, m.type === "slime" ? ["#57c95a", "#b6f5a0"] : m.type === "imp" || m.type === "magmaSlime" ? FIRE_COLOURS : ["#ffffff", "#c8c0e0", "#8a7ab0"], 14, 60, {});
  if (Math.random() < 0.35) pickups.push({ x: m.x, y: m.y - 4, life: 12 });
}

function hurtBoss(power) {
  boss.hp -= power;
  boss.flash = 0.12;
  sfx.hit();
  burst(boss.x, boss.y - 30, ["#ff8ab0", "#a03ad8", "#ffffff"], 8, 80, { high: true });
  el("boss-fill").style.width = Math.max(0, (boss.hp / boss.maxHp) * 100) + "%";
  if (boss.hp <= 0) {
    burst(boss.x, boss.y - 30, ["#ffffff", "#ff8ab0", "#a03ad8", "#ffd84a"], 120, 160, { high: true, glow: "magic" });
    bossDefeated();
  }
}

// The dragon breathes fire in the direction you last moved
function breatheFire(byItself, targetX, targetY) {
  if (dragon.cool > 0) return;
  const info = dragonInfo();
  dragon.cool = byItself ? 2.4 : 0.55;
  dragon.fireTime = 0.35;
  if (byItself) {
    const length = Math.hypot(targetX - dragon.x, targetY - dragon.y) || 1;
    dragon.aim = { x: (targetX - dragon.x) / length, y: (targetY - dragon.y) / length };
    dragon.face = dragon.aim.x < 0 ? 1 : 0;
  } else dragon.aim = { x: aim.x, y: aim.y };
  sfx.fire();
  const mouth = dragonMouth();
  const reach = info.range;
  // What does the fire touch?
  function touched(x, y, extra) {
    const dx = x - mouth.x;
    const dy = y - mouth.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 12 + (extra || 0)) return true;
    return distance < reach + (extra || 0) && (dx * dragon.aim.x + dy * dragon.aim.y) / distance > 0.6;
  }
  for (const m of monsters) {
    if (m.dead <= 0 && touched(m.x, m.y - 6)) hurtMonster(m, info.power, mouth.x, mouth.y);
  }
  if (boss && boss.awake && touched(boss.x, boss.y - 10, 26)) hurtBoss(info.power);
  for (const thing of WORLD.objects) {
    if (thing.type === "beacon" && touched(centre(thing.x), centre(thing.y), 6)) lightBeacon(thing.id);
    if (thing.type === "thorns" && !state.thorns && touched(centre(thing.x), centre(thing.y), 6)) {
      state.thorns = true;
      burning.push({ time: 1.2 });
      applyWorldChanges();
      toast("The thorns burn away! The pass to Stormcrag is open.", 4);
      save();
    }
    if (thing.type === "gate" && !state.gates[thing.id] && touched(centre(thing.x), centre(thing.y), 6)) {
      if (state.stage < thing.needs) toast(state.name + "'s fire is not hot enough for this yet!", 3);
      else {
        state.gates[thing.id] = true;
        burning.push({ time: 1.2 });
        applyWorldChanges();
        toast(thing.look === "ice" ? "The wall of ice melts away!" : "The thorns burn away!", 4);
        save();
      }
    }
  }
}

function dragonMouth() {
  const info = dragonInfo();
  const side = dragon.face ? -1 : 1;
  const lift = flying() ? 18 : 0;
  if (state.stage <= 1) return { x: dragon.x + side * 9, y: dragon.y - 9 };
  return { x: dragon.x + side * 16 * info.k, y: dragon.y - 20 * info.k - lift + 12 };
}

function hurtPlayer(fromX, fromY) {
  if (safeTime > 0 || state.hp <= 0) return;
  state.hp--;
  safeTime = 1.1;
  shake = 0.3;
  sfx.hurt();
  el("hurt").style.opacity = 1;
  setTimeout(() => (el("hurt").style.opacity = 0), 150);
  const leader = lead();
  const away = Math.atan2(leader.y - fromY, leader.x - fromX);
  const test = flying() ? canFly : canStand;
  for (let i = 0; i < 10; i++) {
    const nx = leader.x + Math.cos(away) * 1.5;
    const ny = leader.y + Math.sin(away) * 1.5;
    if (test(nx, ny)) leader.x = nx, leader.y = ny;
  }
  // An emberberry can save you
  if (state.hp === 1 && state.berries > 0 && (SAGA || (state.quest !== 1 && state.quest !== 2))) {
    state.berries--;
    state.hp++;
    toast("You ate an emberberry just in time!");
  }
  if (state.hp <= 0) faint();
}

function faint() {
  if (SAGA) {
    toast("You fainted! Gandalf carried everyone back to safety.", 5);
    state.hp = state.maxHp;
    safeTime = 3;
    state.mode = "human";
    state.x = centre(state.respawn[0]);
    state.y = centre(state.respawn[1]) + 2;
    placeParty();
    shots = [];
    return makeBoss();
  }
  const atTemple = state.quest === 5;
  toast(atTemple ? "You fainted! " + state.name + " carried everyone back to the shore." : "You fainted! Gandalf carried you home to Emberwick.", 5);
  state.hp = state.maxHp;
  safeTime = 3;
  const spot = atTemple ? PLACES.landing : PLACES.start;
  if (!atTemple) state.mode = "human";
  state.x = centre(spot.x);
  state.y = centre(spot.y) + 2;
  placeParty();
  shots = [];
  if (boss) {
    boss.hp = boss.maxHp;
    boss.awake = false;
    boss.x = centre(PLACES.boss.x);
    boss.y = centre(PLACES.boss.y);
    el("boss-bar").hidden = true;
    if (state.quest === 5) state.quest = 4;
  }
}

// Swap between the human and the dragon
function swapMode() {
  const order = ["human"];
  if (state.stage > 0) order.push("dragon");
  if (hasWizard()) order.push("wizard");
  if (order.length < 2) return toast("There is nobody to swap with... yet!");
  setMode(order[(order.indexOf(state.mode) + 1) % order.length]);
}

// Play as someone else: "human" (you), "dragon" or "wizard" (Gandalf)
function setMode(next) {
  if (next === state.mode || talk || card || tame) return;
  if (next === "dragon" && state.stage === 0) return toast("You don't have a dragon... yet!");
  if (next === "wizard" && !hasWizard()) return toast("Gandalf hasn't joined you yet. Talk to Grandma Wren!");
  if (flying()) {
    // Everyone climbs down
    if (!canStand(dragon.x, dragon.y)) return toast("You can't land here! Find some open ground.");
    hero.x = wizard.x = dog.x = dragon.x;
    hero.y = wizard.y = dog.y = dragon.y;
    dragon.x += dragon.face ? 14 : -14;
    if (next === "human") wizard.x -= 14;
    else hero.x -= 14;
    dog.y += 10;
  }
  if (next === "dragon" && state.stage >= 2) {
    const from = lead();      // everyone climbs on
    dragon.x = from.x;
    dragon.y = from.y;
  }
  state.mode = next;
  trail = [];
  if (next === "human") toast("You are you again. Space: " + (state.grown ? "swing your sword." : "use your pocket knife."), 2.5);
  if (next === "wizard") toast("You are Gandalf! Space casts a bolt of magic.", 2.5);
  if (next === "dragon") toast(state.stage >= 2 ? "Up, up and away! You are flying on " + state.name + "." : "You are " + state.name + "! Space breathes fire.", 2.5);
  sfx.swap();
  const leader = lead();
  burst(leader.x, leader.y - 10, ["#ffffff", "#ffd84a", "#bfe8ff"], 18, 60, {});
}
for (const mode of ["human", "dragon", "wizard"]) {
  el("slot-" + mode).addEventListener("click", function () {
    el("slot-" + mode).blur();
    if (screen === "play" && !paused) setMode(mode);
  });
}

// ---------------------------------------------------------------------------
// Moving everything, many times a second
// ---------------------------------------------------------------------------

function moveLeader(dt) {
  const leader = lead();
  let ax = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
  let ay = (held("down") ? 1 : 0) - (held("up") ? 1 : 0);
  leader.moving = ax !== 0 || ay !== 0;
  if (!leader.moving) return;
  const length = Math.hypot(ax, ay);
  ax /= length;
  ay /= length;
  aim = { x: ax, y: ay };
  const speed = state.mode === "dragon" ? dragonInfo().speed : state.mode === "wizard" ? 74 : state.grown ? 84 : 76;
  const test = flying() ? canFly : state.mode === "dragon" ? canStand : canWalk;
  if (test(leader.x + ax * speed * dt, leader.y)) leader.x += ax * speed * dt;
  if (test(leader.x, leader.y + ay * speed * dt)) leader.y += ay * speed * dt;
  leader.anim += dt;
  if (leader !== dragon) leader.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 1 : 2) : ay < 0 ? 3 : 0;
  else if (ax !== 0) dragon.face = ax < 0 ? 1 : 0;
  // Little puffs of dust (or grass, or snow) kicked up by your feet
  leader.stepTime = (leader.stepTime || 0) + dt;
  if (!flying() && leader.stepTime > 0.15) {
    leader.stepTime = 0;
    const kind = WORLD.ground[Math.floor(leader.y / TILE)][Math.floor(leader.x / TILE)];
    const colour = { S: "#f3e3a8", D: "#d8b888", N: "#ffffff", G: "#86cf68", F: "#4a7a62", A: "#7a7284", R: "#b4b1bc", C: "#d0cac0" }[kind];
    if (colour) spark(leader.x + (Math.random() - 0.5) * 5, leader.y, -ax * 12 + (Math.random() - 0.5) * 10, -8 - Math.random() * 10, 0.4, colour, { gravity: 40 });
  }
  // Drop a breadcrumb for the others to follow
  const last = trail[trail.length - 1];
  if (!last || Math.hypot(last.x - leader.x, last.y - leader.y) > 3) {
    trail.push({ x: leader.x, y: leader.y });
    if (trail.length > 110) trail.shift();
  }
}

// Walk someone towards a spot. Gives back true if they moved.
function walkTo(who, x, y, speed, dt) {
  const dx = x - who.x;
  const dy = y - who.y;
  const distance = Math.hypot(dx, dy);
  who.moving = distance > 1.5;
  if (!who.moving) return false;
  const step = Math.min(distance, speed * dt);
  who.x += (dx / distance) * step;
  who.y += (dy / distance) * step;
  who.anim += dt;
  if (who.dir !== undefined) who.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
  if (who.face !== undefined && Math.abs(dx) > 0.5) who.face = dx < 0 ? 1 : 0;
  return true;
}

// Follow the leader's breadcrumbs, staying "gap" pixels behind
function follow(who, gap, dt) {
  const leader = lead();
  if (Math.hypot(leader.x - who.x, leader.y - who.y) > 170) {
    who.x = leader.x;
    who.y = leader.y;
  }
  let need = gap;
  let px = leader.x;
  let py = leader.y;
  let target = null;
  for (let i = trail.length - 1; i >= 0; i--) {
    const crumb = trail[i];
    const distance = Math.hypot(crumb.x - px, crumb.y - py);
    if (distance >= need) {
      target = { x: px + ((crumb.x - px) * need) / distance, y: py + ((crumb.y - py) * need) / distance };
      break;
    }
    need -= distance;
    px = crumb.x;
    py = crumb.y;
  }
  if (!target) {
    who.moving = false;
    return;
  }
  walkTo(who, target.x, target.y, 150, dt);
}

function moveFollowers(dt) {
  const leader = lead();
  if (flying()) {
    hero.x = wizard.x = dog.x = dragon.x;      // everyone is riding
    hero.y = wizard.y = dog.y = dragon.y;
    return;
  }
  // Everyone you are not playing as lines up behind the leader
  const line = [hero];
  if (hasWizard()) line.push(wizard);
  line.push(dog);
  if (state.stage >= 1) line.push(dragon);
  let gap = 0;
  for (const who of line) {
    if (who === leader) continue;
    gap += who === dragon && state.stage >= 2 ? 26 : 15;
    if (who === dog && dogSniffs(dt)) continue;
    follow(who, gap, dt);
  }
  // Friends who are following you still help in a fight.
  // The dragon breathes fire at monsters that come close...
  if (state.mode !== "dragon" && state.stage >= 1 && dragon.cool <= 0) {
    for (const m of monsters) {
      if (m.dead <= 0 && Math.hypot(m.x - dragon.x, m.y - dragon.y) < dragonInfo().range * 0.8) {
        breatheFire(true, m.x, m.y - 6);
        break;
      }
    }
  }
  // ...the teen jabs with the knife...
  hero.cool = (hero.cool || 0) - dt;
  if (state.mode !== "human" && hero.cool <= 0) {
    for (const m of monsters) {
      if (m.dead > 0 || Math.hypot(m.x - hero.x, m.y - hero.y) > 20) continue;
      hero.dir = Math.abs(m.x - hero.x) > Math.abs(m.y - hero.y) ? (m.x < hero.x ? 1 : 2) : m.y < hero.y ? 3 : 0;
      stab(hero);
      hero.cool = 0.9;
      break;
    }
  }
  // ...and Gandalf throws bolts of magic
  wizard.cool -= dt;
  if (state.mode !== "wizard" && hasWizard() && wizard.cool <= 0) {
    let target = null;
    let nearest = 95;
    for (const m of monsters) {
      const distance = Math.hypot(m.x - wizard.x, m.y - wizard.y);
      if (m.dead <= 0 && distance < nearest) {
        nearest = distance;
        target = m;
      }
    }
    if (!target && boss && boss.awake && Math.hypot(boss.x - wizard.x, boss.y - wizard.y) < 150) target = boss;
    if (target) {
      shots.push({ kind: "bolt", x: wizard.x + 6, y: wizard.y - 22, vx: 0, vy: -40, life: 2.5, target: target, power: 1 });
      wizard.cool = 1.7;
      sfx.bolt();
    }
  }
}

// Biscuit the border terrier runs to buried treasure and barks at it
function dogSniffs(dt) {
  const leader = lead();
  dog.bubble = 0;
  for (const spot of DIGS) {
    if (state.dug[spot.id]) continue;
    const x = centre(spot.x);
    const y = centre(spot.y);
    if (Math.hypot(x - leader.x, y - leader.y) > 110) continue;
    const arrived = !walkTo(dog, x + 9, y + 4, 120, dt);
    if (arrived) {
      dog.bubble = 1;
      dog.face = 1;
      if (dog.barked !== spot.id || Math.floor(time * 0.5) !== Math.floor((time - dt) * 0.5)) sfx.bark();
      if (dog.barked !== spot.id) toast("Woof! Biscuit has found something buried!", 3);
      dog.barked = spot.id;
    }
    return true;
  }
  return false;
}

function updateMonsters(dt) {
  const leader = lead();
  const nearHome = Math.hypot(leader.x - centre(48), leader.y - centre(56)) < 12 * TILE;
  for (const m of monsters) {
    const type = MONSTER_TYPES[m.type];
    if (m.dead > 0) {
      m.dead -= dt;
      if (m.dead <= 0) {
        if (Math.hypot(m.homeX - leader.x, m.homeY - leader.y) < 230) m.dead = 5;   // don't pop back while you watch
        else {
          m.hp = type.hp;
          m.x = m.homeX;
          m.y = m.homeY;
        }
      }
      continue;
    }
    const dx = leader.x - m.x;
    const dy = leader.y - m.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 300) continue;
    m.flash -= dt;
    let vx = 0;
    let vy = 0;
    if (m.wait > 0) {
      m.wait -= dt;       // knocked back
      vx = m.wx;
      vy = m.wy;
    } else if (!flying() && !nearHome && distance < type.sight) {
      let speed = type.speed;
      let toward = 1;
      const moves = type.like || m.type;
      if (moves === "slime") speed *= (time * 1.6 + m.homeX) % 1 < 0.5 ? 2 : 0;
      if (moves === "spider") speed *= (time * 0.8 + m.homeX) % 1 < 0.55 ? 1.7 : 0.1;
      if (type.shoots) {
        toward = distance < 46 ? -1 : distance < 70 ? 0 : 1;
        m.cool -= dt;
        if (m.cool <= 0) {
          m.cool = 2.3;
          shots.push({ kind: "fireball", x: m.x, y: m.y - 8, vx: (dx / distance) * 62, vy: (dy / distance) * 62, life: 2.5 });
        }
      }
      vx = (dx / distance) * speed * toward;
      vy = (dy / distance) * speed * toward;
      if ((type.like || m.type) === "bat") {
        vx += Math.cos(time * 5 + m.homeX) * 30;
        vy += Math.sin(time * 4 + m.homeY) * 30;
      }
    } else {
      // Nothing to chase: potter about near home
      m.think -= dt;
      if (m.think <= 0) {
        m.think = 1 + Math.random() * 2;
        const far = Math.hypot(m.homeX - m.x, m.homeY - m.y) > 40;
        const angle = far ? Math.atan2(m.homeY - m.y, m.homeX - m.x) : Math.random() * Math.PI * 2;
        const speed = Math.random() < 0.4 && !far ? 0 : type.speed * 0.5;
        m.vx = Math.cos(angle) * speed;
        m.vy = Math.sin(angle) * speed;
      }
      vx = m.vx || 0;
      vy = m.vy || 0;
    }
    const free = (x, y) => type.flies || !tileBlocked(x, y - 2);
    if (free(m.x + vx * dt, m.y)) m.x += vx * dt;
    if (free(m.x, m.y + vy * dt)) m.y += vy * dt;
    if (!flying() && distance < 10) hurtPlayer(m.x, m.y);
  }
}

function updateBoss(dt) {
  if (!boss) return;
  const leader = lead();
  const def = boss.def;
  const distance = Math.hypot(leader.x - boss.x, leader.y - boss.y);
  if (!boss.awake) {
    if ((SAGA || state.quest >= 4) && distance < 150) {
      boss.awake = true;
      if (!SAGA) state.quest = 5;
      toast(def.name + " awakes!", 4);
      sfx.roar();
      shake = 0.6;
      el("boss-bar").hidden = false;
      el("boss-bar").querySelector("span").textContent = def.name;
      el("boss-fill").style.width = "100%";
    }
    return;
  }
  if (distance > 330) {
    // You got away: the boss goes back to sleep and heals
    boss.awake = false;
    boss.hp = boss.maxHp;
    boss.x = boss.homeX;
    boss.y = boss.homeY;
    if (!SAGA) state.quest = 4;
    el("boss-bar").hidden = true;
    if (FREE) boss = null;
    return;
  }
  boss.t += dt;
  boss.flash -= dt;
  const angry = boss.hp < boss.maxHp / 2;
  boss.face = leader.x < boss.x ? 1 : 0;
  boss.cool -= dt;
  if (boss.kind === "wyrm") {
    // A wyrm swoops around in the air and spits dark orbs at you
    const goX = boss.homeX + Math.sin(boss.t * (angry ? 0.9 : 0.6)) * 74;
    const goY = boss.homeY + 20 + Math.sin(boss.t * (angry ? 1.5 : 1.1)) * 36;
    boss.x += (goX - boss.x) * Math.min(1, dt * 3);
    boss.y += (goY - boss.y) * Math.min(1, dt * 3);
    if (boss.cool <= 0) {
      boss.cool = angry ? 1.05 : 1.6;
      const angle = Math.atan2(leader.y - boss.y, leader.x - boss.x);
      for (const spread of angry ? [-0.4, 0, 0.4] : [0]) {
        shots.push({ kind: "orb", x: boss.x + (boss.face ? -22 : 22), y: boss.y, vx: Math.cos(angle + spread) * 64, vy: Math.sin(angle + spread) * 64, life: 4.5 });
      }
      sound(() => playTone(0, 0.2, 180, 90, 0.1));
    }
  } else {
    // A giant stomps after you on the ground, and now and then sends out a ring of dark fire
    if (distance > 22) {
      const speed = (def.speed || 26) * (angry ? 1.4 : 1);
      const nx = boss.x + ((leader.x - boss.x) / distance) * speed * dt;
      const ny = boss.y + ((leader.y - boss.y) / distance) * speed * dt;
      if (!tileBlocked(nx, boss.y)) boss.x = nx;
      if (!tileBlocked(boss.x, ny)) boss.y = ny;
    }
    if (boss.cool <= 0) {
      boss.cool = angry ? 1.9 : 2.8;
      const count = angry ? 12 : 8;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + boss.t;
        shots.push({ kind: "orb", low: true, x: boss.x, y: boss.y - 6, vx: Math.cos(angle) * 58, vy: Math.sin(angle) * 58, life: 2.6 });
      }
      shake = 0.25;
      sound(() => playNoise(0, 0.3, 300, 80, 0.2));
    }
  }
  if (distance < (boss.kind === "wyrm" ? 16 : 20)) hurtPlayer(boss.x, boss.y);
}

function updateShots(dt) {
  const leader = lead();
  for (const shot of shots) {
    shot.life -= dt;
    if (shot.kind === "bolt") {
      const t = shot.target;
      if (!t) {
        // A bolt you aimed yourself as Gandalf: it flies straight and hits the first monster in its way
        for (const m of monsters) {
          if (m.dead > 0 || Math.hypot(m.x - shot.x, m.y - 8 - shot.y) > 11) continue;
          shot.life = 0;
          burst(shot.x, shot.y, ["#ffffff", "#bfe8ff", "#7ab8ff"], 10, 60, { glow: "magic" });
          hurtMonster(m, shot.power, shot.x - shot.vx, shot.y - shot.vy);
          break;
        }
        if (shot.life > 0 && boss && boss.awake && Math.hypot(boss.x - shot.x, boss.y - 14 - shot.y) < 30) {
          shot.life = 0;
          hurtBoss(shot.power);
        }
      } else if (t === boss ? !boss : t.dead > 0) shot.life = 0;
      else {
        const dx = t.x - shot.x;
        const dy = t.y - 8 - shot.y;
        const distance = Math.hypot(dx, dy) || 1;
        shot.vx += ((dx / distance) * 170 - shot.vx) * Math.min(1, dt * 6);
        shot.vy += ((dy / distance) * 170 - shot.vy) * Math.min(1, dt * 6);
        if (distance < 8) {
          shot.life = 0;
          burst(shot.x, shot.y, ["#ffffff", "#bfe8ff", "#7ab8ff"], 8, 50, { glow: "magic" });
          if (t === boss) hurtBoss(1);
          else hurtMonster(t, 1, shot.x - shot.vx, shot.y - shot.vy);
        }
      }
      if (Math.random() < dt * 40) spark(shot.x, shot.y, 0, 0, 0.3, "#bfe8ff", { glow: "magic" });
    } else {
      const reach = Math.hypot(leader.x - shot.x, leader.y - 6 - shot.y);
      if (reach < 8 && (shot.kind === "orb" || !flying())) {
        shot.life = 0;
        hurtPlayer(shot.x, shot.y);
      }
      if (Math.random() < dt * 30) spark(shot.x, shot.y - (shot.kind === "orb" && !shot.low ? 14 : 0), 0, 0, 0.35, shot.kind === "orb" ? "#a03ad8" : "#ff9a2a", { high: shot.kind === "orb" });
    }
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }
  shots = shots.filter((shot) => shot.life > 0);
  // Hearts dropped by monsters
  for (const heart of pickups) {
    heart.life -= dt;
    if (!flying() && Math.hypot(heart.x - leader.x, heart.y - leader.y + 4) < 11) {
      heart.life = 0;
      if (state.hp < state.maxHp) state.hp++;
      sfx.pick();
    }
  }
  pickups = pickups.filter((heart) => heart.life > 0);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.life -= dt;
    p.vy += p.gravity * dt;
    if (p.flutter) p.vx += Math.sin(time * 9 + p.max * 50) * 90 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  particles = particles.filter((p) => p.life > 0);
}

// Little living details: fireflies, butterflies, snow, embers, chimney smoke
function ambience(dt) {
  const chance = (perSecond) => Math.random() < perSecond * dt;
  const rx = cam.x + Math.random() * VIEW_W;
  const ry = cam.y + Math.random() * VIEW_H;
  const dark = darkness();
  if ((mood === "doom" || mood === "marsh" || mood === "shadow" || mood === "jungle") && chance(5)) spark(rx, ry, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 3, "#d8ff8a", { glow: "cyan", flutter: true });
  else if (dark > 0.35 && mood !== "crag" && mood !== "isle" && mood !== "temple" && chance(4)) spark(rx, ry, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 3, "#fff6a0", { glow: "warm", flutter: true });
  if ((mood === "meadow" || mood === "vale") && dark < 0.2 && chance(1.6)) spark(rx, ry, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 10, 5, ["#ff8ab0", "#ffe14a", "#ffffff", "#8ac4ff"][Math.floor(Math.random() * 4)], { flutter: true, size: 2 });
  if ((mood === "vale" || mood === "village" || mood === "lake") && chance(2.5)) spark(rx, ry - 30, 6 + Math.random() * 10, 10 + Math.random() * 8, 4, ["#6fc65c", "#86c456", "#e0b040", "#d87a3a"][Math.floor(Math.random() * 4)], { flutter: true, size: 2 });
  if (mood === "desert" && chance(9)) spark(cam.x - 2, ry, 70 + Math.random() * 40, (Math.random() - 0.5) * 8, 4, "#f3e3a8", { high: true });
  if ((mood === "crag" || mood === "ice") && chance(22)) spark(rx, cam.y - 2, -10 + Math.random() * 6, 24 + Math.random() * 14, 7, "#ffffff", { high: true });
  if ((mood === "isle" || mood === "temple") && chance(12)) spark(rx, cam.y + VIEW_H + 2, (Math.random() - 0.5) * 12, -20 - Math.random() * 16, 6, FIRE_COLOURS[1 + Math.floor(Math.random() * 3)], { glow: "fire", high: true });
  for (const thing of fires) {
    const x = thing.bx;
    const y = thing.by;
    if (x < cam.x - 40 || x > cam.x + VIEW_W + 40 || y < cam.y - 40 || y > cam.y + VIEW_H + 80) continue;
    const type = thing.o.type;
    if ((type === "house" || type === "hall") && chance(4)) spark(x + thing.img.width / 2 - 12, y - thing.img.height + 2, 3 + Math.random() * 4, -9, 2.6, "rgba(235, 235, 245, 0.55)", { size: 2, high: true });
    if (type === "beacon" && state.beacons[thing.o.id] && chance(26)) spark(x + (Math.random() - 0.5) * 8, y - 24, (Math.random() - 0.5) * 8, -26 - Math.random() * 20, 0.7, FIRE_COLOURS[Math.floor(Math.random() * 5)], { glow: "fire" });
    if (type === "campfire" && chance(20)) spark(x + (Math.random() - 0.5) * 5, y - 20, (Math.random() - 0.5) * 6, -18 - Math.random() * 12, 0.6, FIRE_COLOURS[Math.floor(Math.random() * 5)], { glow: "fire" });
    if ((type === "thorns" || (type === "gate" && state.gates[thing.o.id])) && burning.length && chance(40)) spark(x + (Math.random() - 0.5) * 14, y - 4 - Math.random() * 12, (Math.random() - 0.5) * 10, -30 - Math.random() * 20, 0.6, FIRE_COLOURS[Math.floor(Math.random() * 5)], { glow: "fire" });
  }
  // The dragon's fire
  if (dragon.fireTime > 0) {
    dragon.fireTime -= dt;
    const info = dragonInfo();
    const mouth = dragonMouth();
    for (let i = 0; i < Math.ceil(4 * info.k) + 2; i++) {
      const wobble = (Math.random() - 0.5) * 0.55;
      const cos = Math.cos(wobble);
      const sin = Math.sin(wobble);
      const speed = info.range * (2.2 + Math.random() * 1.2);
      spark(mouth.x, mouth.y, (dragon.aim.x * cos - dragon.aim.y * sin) * speed, (dragon.aim.x * sin + dragon.aim.y * cos) * speed, 0.22 + Math.random() * 0.16, FIRE_COLOURS[Math.floor(Math.random() * 4)], { glow: "fire", size: info.k >= 1 ? 2 : 1, high: flying() });
    }
  }
}

// ----- The world map (press M) -----
let mapOpen = false;
let mapPicture = null;
const MAP_MARKS = WORLD.objects.filter((thing) => ["beacon", "gate", "pickup", "hall"].includes(thing.type));
function toggleMap() {
  mapOpen = !mapOpen;
  el("map").hidden = !mapOpen;
}
function drawMap() {
  if (!mapPicture) {
    // Paint the whole world once, one pixel for each square
    mapPicture = makeCanvas(MAP_W, MAP_H);
    const g = mapPicture.getContext("2d");
    const image = g.createImageData(MAP_W, MAP_H);
    const colours = { W: [47, 127, 208], L: [255, 122, 26] };
    for (const letter in TERRAIN) if (TERRAIN[letter].rgb) colours[letter] = TERRAIN[letter].rgb[0];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const rgb = colours[WORLD.ground[y][x]];
        const i = (y * MAP_W + x) * 4;
        const shade = WORLD.blocked[y][x] && rgb !== colours.W && rgb !== colours.L ? 0.72 : 1;    // trees and rocks look darker
        image.data[i] = rgb[0] * shade;
        image.data[i + 1] = rgb[1] * shade;
        image.data[i + 2] = rgb[2] * shade;
        image.data[i + 3] = 255;
      }
    }
    g.putImageData(image, 0, 0);
  }
  const canvas = el("map-canvas");
  if (canvas.width !== MAP_W) {
    canvas.width = MAP_W;
    canvas.height = MAP_H;
  }
  const g = canvas.getContext("2d");
  g.drawImage(mapPicture, 0, 0);
  const dot = MAP_W > 300 ? 5 : 3;
  for (const thing of MAP_MARKS) {
    if (thing.type === "pickup" && state.taken[thing.id]) continue;
    if (thing.type === "gate" && state.gates[thing.id]) continue;
    g.fillStyle = thing.type === "beacon" ? (state.beacons[thing.id] ? "#ffd84a" : "#ffffff") : thing.type === "gate" ? "#ff3b4a" : thing.type === "hall" ? "#7a3f8f" : thing.colour;
    g.fillRect(thing.x - 1, thing.y - 1, thing.type === "pickup" ? 2 : dot, thing.type === "pickup" ? 2 : dot);
  }
  if (SAGA) {
    g.fillStyle = "#ff3b4a";
    for (const other of SAGA.bosses) if (!state.bossesDead[other.id] && (FREE || stepNow().boss === other.id)) g.fillRect(other.x - 3, other.y - 3, 7, 7);
  }
  // You: a flashing dot
  g.fillStyle = Math.floor(time * 4) % 2 ? "#ffffff" : "#e0402a";
  g.fillRect(Math.floor(lead().x / TILE) - dot, Math.floor(lead().y / TILE) - dot, dot * 2 + 1, dot * 2 + 1);
}

let promptText = "";
function update(dt) {
  time += dt;
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) el("toast").hidden = true;
  }
  updateParticles(dt);
  if (shake > 0) shake -= dt;
  if (dragon.hop > 0) dragon.hop -= dt;
  if (card || talk || tame || !el("name-box").hidden) {
    promptText = "";
    el("prompt").hidden = true;
  }
  if (card) return updateCard();
  if (talk) return updateTalk(dt);
  if (tame) return updateTaming(dt);
  if (!el("name-box").hidden) return;
  if (pressed("KeyP")) togglePause();
  if (pressed("KeyM")) toggleMap();
  if (mapOpen) return drawMap();
  if (paused) return;

  state.clock += dt;
  if (safeTime > 0) safeTime -= dt;
  if (swingTime > 0) swingTime -= dt;
  if (dragon.cool > 0) dragon.cool -= dt;
  for (const fire of burning) fire.time -= dt;
  burning = burning.filter((fire) => fire.time > 0);

  if (pressed("KeyC")) swapMode();
  if (pressed("Digit1")) setMode("human");
  if (pressed("Digit2")) setMode("dragon");
  if (pressed("Digit3")) setMode("wizard");
  if (slash) slash.time -= dt;
  updateSky(dt);
  moveLeader(dt);
  moveFollowers(dt);

  // Space: use what's in front of you, or attack
  let label = "";
  if (state.mode !== "dragon") {
    const use = findUse();
    if (use) label = "Space: " + use.label;
    if (pressed("Space")) {
      if (use) use.act();
      else attack();
    }
  } else if (pressed("Space")) breatheFire(false);
  if (label !== promptText) {
    promptText = label;
    el("prompt").textContent = label;
    el("prompt").hidden = !label;
  }

  updateMonsters(dt);
  updateBoss(dt);
  updateShots(dt);
  ambience(dt);

  // Which part of the world are you in?
  const leader = lead();
  const region = regionAt(Math.floor(leader.x / TILE), Math.floor(leader.y / TILE));
  if (region !== regionNow) {
    regionNow = region;
    if (toastTimer <= 0.5) toast(REGION_NAMES[region], 2.5);
  }
  mood = SAGA ? SAGA.moods[regionNow] : regionNow;
  const tint = REGION_TINTS[mood] || [1, 1, 1];
  if (SAGA) sagaUpdate();
  if (FREE && !boss && Math.floor(time) !== Math.floor(time - dt)) makeBoss();
  for (let i = 0; i < 3; i++) regionTint[i] += (tint[i] - regionTint[i]) * Math.min(1, dt * 1.5);

  saveTimer += dt;
  if (saveTimer > 8) {
    saveTimer = 0;
    save();
  }
  updateHud();
}

// ---------------------------------------------------------------------------
// Light and dark: the time of day, and gloomy places
// ---------------------------------------------------------------------------

const DAY_LENGTH = 300;   // seconds for a whole day and night
// The colour of the light at different times of day: [time from 0 to 1, [red, green, blue]]
const SKY = [
  [0, [1, 1, 1]], [0.5, [1, 1, 1]], [0.58, [1, 0.8, 0.62]], [0.66, [0.47, 0.5, 0.78]],
  [0.88, [0.42, 0.45, 0.74]], [0.95, [1, 0.76, 0.68]], [1, [1, 1, 1]],
];
const REGION_TINTS = {
  doom: [0.5, 0.58, 0.66], isle: [0.92, 0.7, 0.66], temple: [0.8, 0.56, 0.58], crag: [0.93, 0.96, 1],
  marsh: [0.76, 0.86, 0.82], ice: [0.9, 0.96, 1], desert: [1, 0.95, 0.84], jungle: [0.84, 0.96, 0.86], shadow: [0.62, 0.55, 0.76],
};

function ambientColour() {
  const t = (state.clock / DAY_LENGTH) % 1;
  let colour = [1, 1, 1];
  for (let i = 0; i < SKY.length - 1; i++) {
    if (t >= SKY[i][0] && t <= SKY[i + 1][0]) {
      const part = (t - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]);
      colour = SKY[i][1].map((value, c) => value + (SKY[i + 1][1][c] - value) * part);
    }
  }
  return colour.map((value, c) => Math.max(c === 2 ? 0.44 : 0.3, value * regionTint[c]));   // never pitch black
}
function darkness() {
  const colour = ambientColour();
  return 1 - (colour[0] + colour[1] + colour[2]) / 3;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

// Get every tree, house and rock ready to draw: where its picture goes, and what it is drawn in front of
const rows = [];
for (let y = 0; y < MAP_H; y++) rows.push([]);
const fires = [];     // things that make smoke, flames or light
const NATURAL = ["oak", "pine", "snowpine", "doomtree", "ashtree", "bush", "rock", "mushroom", "skull", "spike"];
const FLAT = ["dig", "nest", "campfire"];
const DIGS = WORLD.objects.filter((thing) => thing.type === "dig");
for (const o of WORLD.objects) {
  const name = o.type === "peak" ? (o.snowy ? "snowpeak" : "peak") : o.type;
  const list = sprites[name];
  let img;
  if (o.type === "gate") img = sprites.gates[o.look];
  else if (o.type === "pickup") img = sprites.gems[o.colour] || (sprites.gems[o.colour] = drawGem(o.colour));
  else img = list[typeof o.look === "number" ? o.look % list.length : Math.floor(hash(o.x, o.y, 5) * list.length)];
  let bx = (o.x + o.w / 2) * TILE;
  let by = (o.y + 1) * TILE;
  if (NATURAL.includes(o.type)) {
    bx += Math.round((hash(o.x, o.y, 6) - 0.5) * 6);
    by -= Math.round(hash(o.x, o.y, 7) * 4);
  }
  if (o.type === "peak") by += 3 + Math.round(hash(o.x, o.y, 8) * 5);
  const thing = { o: o, img: img, x: Math.round(bx - img.width / 2), y: by - img.height, bx: bx, by: by, sort: FLAT.includes(o.type) ? by - 14 : by };
  thing.shadow = o.type === "peak" || FLAT.includes(o.type) || o.type === "temple" ? 0 : Math.min(26, img.width * 0.42);
  rows[o.y].push(thing);
  if (["house", "hall", "beacon", "campfire", "thorns", "gate", "lantern", "mushroom", "temple", "darkpillar"].includes(o.type)) fires.push(thing);
}

const cloudShadow = drawGlow(128, "rgba(14, 18, 48, 1)");
const moon = (function () {
  const a = new Art(56, 56);
  a.oval(28, 28, 26, 26, "#fff3c8");
  a.oval(19, 20, 5, 4, "#eadfae");
  a.oval(35, 35, 6, 5, "#eadfae");
  a.oval(37, 17, 3, 2.5, "#eadfae");
  return a.canvas;
})();

// Real shadows: a dark copy of each sprite, laid down on the ground. They swing round and stretch as the sun moves.
const shadowCanvas = makeCanvas(VIEW_W, VIEW_H);
const shadowCtx = shadowCanvas.getContext("2d");
shadowCtx.imageSmoothingEnabled = false;
const shadowCache = new Map();
function shadowOf(img) {
  let dark = shadowCache.get(img);
  if (!dark) {
    dark = tinted(img, "#1a1238");
    shadowCache.set(img, dark);
  }
  return dark;
}
function sunShadow() {
  const t = (state.clock / DAY_LENGTH) % 1;
  const day = Math.min(1, t / 0.6);       // 0 at sunrise, 1 at sunset
  return { lean: 0.9 - day * 1.8, length: 0.36 + Math.abs(day - 0.5) * 0.5, alpha: Math.max(0.05, 0.3 - darkness() * 0.45) };
}

// Trees sway in the wind: [where the top part ends, where the middle part ends]
const SWAY = { oak: [16, 30], doomtree: [12, 22], pine: [14, 28], snowpine: [14, 28] };

// Beams of sunlight (or moonlight) slanting down
const rays = (function () {
  const picture = makeCanvas(720, VIEW_H);
  const g = picture.getContext("2d");
  for (let i = 0; i < 9; i++) {
    const x = (i % 3) * 80 + Math.floor(i / 3) * 240 + [0, 14, -10][i % 3];
    const w = [26, 12, 40][i % 3];
    const fade = g.createLinearGradient(0, 0, 0, VIEW_H);
    fade.addColorStop(0, "rgba(255, 246, 210, 1)");
    fade.addColorStop(1, "rgba(255, 246, 210, 0)");
    g.fillStyle = fade;
    g.beginPath();
    g.moveTo(x + 150, 0);
    g.lineTo(x + 150 + w, 0);
    g.lineTo(x + w * 1.6, VIEW_H);
    g.lineTo(x, VIEW_H);
    g.fill();
  }
  return picture;
})();

// "Bloom": bright things glow softly. The picture is shrunk, only its bright parts kept, and added back on top.
const bloomCanvas = makeCanvas(VIEW_W / 4, VIEW_H / 4);
const bloomCtx = bloomCanvas.getContext("2d");

// Birds and lightning
let birds = [];
let birdTimer = 3;
let lightning = 0;
let lightningTimer = 5;
let lightningX = 100;
function updateSky(dt) {
  const bright = mood !== "doom" && mood !== "isle" && mood !== "temple" && darkness() < 0.3;
  birdTimer -= dt;
  if (birdTimer <= 0 && bright) {
    birdTimer = 8 + Math.random() * 10;
    const y = cam.y + 20 + Math.random() * (VIEW_H - 90);
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) birds.push({ x: cam.x - 10 - i * 10, y: y + (i % 2) * 8 - i * 2, speed: 46 + Math.random() * 5, flap: Math.random() * 6 });
  }
  for (const bird of birds) {
    bird.x += bird.speed * dt;
    bird.y -= 4 * dt;
  }
  birds = birds.filter((bird) => bird.x < cam.x + VIEW_W + 60);
  // Storms over Stormcrag, and around the Shadow Wyrm
  if (lightning > 0) lightning -= dt;
  if (mood === "crag" || (boss && boss.awake)) {
    lightningTimer -= dt;
    if (lightningTimer <= 0) {
      lightningTimer = 4 + Math.random() * 8;
      lightning = 0.4;
      lightningX = 30 + Math.random() * (VIEW_W - 60);
      sound(() => playNoise(0.2, 1.1, 500, 50, 0.3));
    }
  }
}

let items = [];
let casts = [];
let shadows = [];
let lights = [];

function drawWorld() {
  const leader = lead();
  // The camera follows whoever you are playing as
  const goX = Math.max(0, Math.min(WORLD_W - VIEW_W, leader.x - VIEW_W / 2));
  const goY = Math.max(0, Math.min(WORLD_H - VIEW_H, leader.y - 14 - VIEW_H / 2));
  cam.x += (goX - cam.x) * 0.18;
  cam.y += (goY - cam.y) * 0.18;
  const jolt = shake > 0 ? shake * 6 : 0;
  const sx = Math.max(0, Math.min(WORLD_W - VIEW_W, Math.round(cam.x + (Math.random() - 0.5) * jolt)));
  const sy = Math.max(0, Math.min(WORLD_H - VIEW_H, Math.round(cam.y + (Math.random() - 0.5) * jolt)));
  const mod = (n, size) => ((n % size) + size) % size;

  // 1. Water, moving slowly, with brighter streaks sliding over it
  const drift = Math.floor(time * 5);
  for (let y = -mod(sy + Math.floor(drift / 2), 64); y < VIEW_H; y += 64) {
    for (let x = -mod(sx + drift, 64); x < VIEW_W; x += 64) ctx.drawImage(water, 0, 0, 64, 64, x, y, 64, 64);
  }
  for (let y = -mod(sy - Math.floor(drift / 3), 64); y < VIEW_H; y += 64) {
    for (let x = -mod(sx - Math.floor(time * 9), 64); x < VIEW_W; x += 64) ctx.drawImage(waterStreaks, 0, 0, 64, 64, x, y, 64, 64);
  }
  // Lava, and sparkles on the sea
  const tx0 = Math.floor(sx / TILE);
  const ty0 = Math.floor(sy / TILE);
  for (let ty = ty0; ty <= ty0 + VIEW_H / TILE; ty++) {
    for (let tx = tx0; tx <= tx0 + VIEW_W / TILE + 1; tx++) {
      if (ty >= MAP_H || tx >= MAP_W) continue;
      const kind = WORLD.ground[ty][tx];
      if (kind === "L") {
        ctx.drawImage(lava, mod(tx * TILE + Math.floor(time * 4), 64), mod(ty * TILE + Math.floor(time * 2), 64), TILE, TILE, tx * TILE - sx, ty * TILE - sy, TILE, TILE);
        if ((tx + ty) % 2 === 0) lights.push({ x: centre(tx), y: centre(ty), r: 30, kind: "fire", a: 0.5, glow: 0.12 });
      } else if (kind === "W") {
        const twinkle = hash(tx, ty, Math.floor(time * 1.5));
        if (twinkle < 0.06) {
          const px = tx * TILE - sx + Math.floor(hash(tx, ty, 91) * 12) + 2;
          const py = ty * TILE - sy + Math.floor(hash(tx, ty, 92) * 12) + 2;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px - 1, py, 3, 1);
          ctx.fillRect(px, py - 1, 1, 3);
        }
      }
    }
  }
  // The ground is kept in big square pieces: draw the ones on screen (painting any new ones first)
  const pieces = [];
  for (let cy = Math.floor(sy / CHUNK_PIXELS); cy <= Math.floor((sy + VIEW_H - 1) / CHUNK_PIXELS); cy++) {
    for (let cx = Math.floor(sx / CHUNK_PIXELS); cx <= Math.floor((sx + VIEW_W - 1) / CHUNK_PIXELS); cx++) {
      pieces.push({ chunk: groundChunk(cx, cy), x: cx * CHUNK_PIXELS - sx, y: cy * CHUNK_PIXELS - sy });
    }
  }
  for (const piece of pieces) if (!piece.chunk.dry) ctx.drawImage(piece.chunk.shore, piece.x, piece.y);
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 1.8);
  for (const piece of pieces) if (!piece.chunk.dry) ctx.drawImage(piece.chunk.foam, piece.x, piece.y);
  ctx.globalAlpha = 1;

  // 2. The ground
  for (const piece of pieces) ctx.drawImage(piece.chunk.ground, piece.x, piece.y);

  // 3. Collect everything that stands on the ground, so it can be drawn back-to-front
  items = [];
  shadows = [];
  const put = (img, x, y, sort, sway) => items.push({ img: img, x: Math.round(x - sx), y: Math.round(y - sy), sort: sort, sway: sway });
  const cast = (img, x, y) => casts.push({ img: img, x: Math.round(x - sx), y: Math.round(y - sy) });
  casts = [];
  const shade = (x, y, w) => shadows.push({ x: x - sx, y: y - sy, w: w });
  const dark = darkness();

  for (let ty = Math.max(0, ty0 - 1); ty <= Math.min(MAP_H - 1, ty0 + VIEW_H / TILE + 8); ty++) {
    for (const thing of rows[ty]) {
      if (thing.x + thing.img.width < sx || thing.x > sx + VIEW_W) continue;
      const o = thing.o;
      let img = thing.img;
      if (o.type === "thorns" && state.thorns && !burning.length) continue;
      if (o.type === "gate" && state.gates[o.id] && !burning.length) continue;
      if (o.type === "pickup") {
        if (state.taken[o.id]) continue;
        lights.push({ x: thing.bx, y: thing.by - 8, r: 20, kind: "warm", a: 0.7, glow: 0.25 + Math.sin(time * 4 + thing.bx) * 0.1 });
      }
      if (o.type === "berrybush" && !berriesReady(o)) img = sprites.bush[0];
      if (o.type === "dig" && state.dug[o.id]) img = sprites.dig[1];
      const bands = SWAY[o.type];
      put(img, thing.x, thing.y, thing.sort, bands ? { bands: bands, by: Math.sin(time * 1.4 + thing.bx * 0.06 + thing.by * 0.04) * 1.7 } : null);
      if (thing.shadow) cast(img, thing.bx, thing.by - 1);
      // Things that glow
      if (o.type === "lantern") lights.push({ x: thing.bx, y: thing.by - 17, r: 52, kind: "warm", a: 0.95, glow: 0.1 + dark * 0.25 });
      if (o.type === "mushroom") lights.push({ x: thing.bx, y: thing.by - 8, r: 26, kind: "cyan", a: 0.7, glow: dark * 0.35 });
      if (o.type === "darkpillar") lights.push({ x: thing.bx, y: thing.by - 18, r: 22, kind: "red", a: 0.7, glow: 0.25 });
      if (o.type === "campfire") {
        put(sprites.flame[Math.floor(time * 9) % 3], thing.bx - 6, thing.by - 20, thing.sort + 1);
        lights.push({ x: thing.bx, y: thing.by - 8, r: 58 + Math.sin(time * 11) * 3, kind: "fire", a: 1, glow: 0.3 });
      }
      if (o.type === "beacon" && state.beacons[o.id]) {
        put(sprites.flame[Math.floor(time * 9) % 3], thing.bx - 6, thing.by - 37, thing.sort + 1);
        lights.push({ x: thing.bx, y: thing.by - 24, r: 80 + Math.sin(time * 10) * 4, kind: "fire", a: 1, glow: 0.4 });
      }
      if ((o.type === "house" || o.type === "hall") && dark > 0.15) {
        lights.push({ x: thing.bx - img.width / 4, y: thing.by - 16, r: 30, kind: "warm", a: 0.9, glow: dark * 0.5 });
        lights.push({ x: thing.bx + img.width / 4, y: thing.by - 16, r: 30, kind: "warm", a: 0.9, glow: dark * 0.5 });
      }
      if (o.type === "temple") {
        lights.push({ x: thing.bx, y: thing.by - 12, r: 70, kind: "red", a: 1, glow: 0.35 + Math.sin(time * 2) * 0.1 });
        lights.push({ x: thing.bx, y: thing.by - 104, r: 36, kind: "red", a: 1, glow: 0.5 });
      }
    }
  }

  // People
  const person = (who, set, sortBonus) => {
    const frame = who.moving ? Math.floor(who.anim * 8) % 4 : 0;
    put(set[who.dir][frame], who.x - 10, who.y - 31, who.y + (sortBonus || 0));
    cast(set[who.dir][frame], who.x, who.y + 1);
    shade(who.x, who.y - 1, 6);
  };
  for (const npc of npcs) {
    if (npc.id === "wizard" && hasWizard()) continue;
    const dx = hero.x - npc.px;
    const dy = hero.y - npc.py;
    const close = Math.hypot(dx, dy) < 44;
    person({ x: npc.px, y: npc.py, dir: close ? (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0) : 0, moving: false, anim: 0 }, sprites[npc.look]);
    if (npc.id === "wizard") lights.push({ x: npc.px + 6, y: npc.py - 24, r: 44, kind: "magic", a: 0.9, glow: 0.2 });
  }
  if (state.stage === 0) {
    // The wild baby dragon, peeping out of its nest
    const hop = dragon.hop > 0 ? Math.abs(Math.sin(dragon.hop * 20)) * 4 : Math.abs(Math.sin(time * 2)) * 1;
    put(sprites.hatchling[hero.x < hatchlingNpc.x ? 1 : 0][Math.floor(time * 3) % 2 === 0 ? 0 : 2], hatchlingNpc.x - 12, hatchlingNpc.y - 21 - hop, hatchlingNpc.y);
    shade(hatchlingNpc.x, hatchlingNpc.y - 1, 9);
  }
  if (!flying()) {
    const blinking = safeTime > 0 && Math.floor(time * 12) % 2 === 0;
    if (!(blinking && state.mode === "human")) person(hero, heroSet(), state.mode === "human" ? 0.5 : 0);
    if (hasWizard()) {
      if (!(blinking && state.mode === "wizard")) person(wizard, sprites.wizard, state.mode === "wizard" ? 0.5 : 0);
      lights.push({ x: wizard.x + 6, y: wizard.y - 24, r: state.mode === "wizard" ? 72 : 56, kind: "magic", a: 1, glow: 0.22 });
    }
    put(sprites.dog[dog.face][dog.moving ? Math.floor(dog.anim * 10) % 2 : 0], dog.x - 9, dog.y - 13, dog.y);
    shade(dog.x, dog.y - 1, 6);
    if (dog.bubble) {
      // A little "!" above Biscuit's head
      items.push({ bubble: true, x: Math.round(dog.x - sx), y: Math.round(dog.y - sy - 26 - Math.abs(Math.sin(time * 6)) * 2), sort: dog.y + 1 });
    }
    lights.push({ x: hero.x, y: hero.y - 10, r: 30, kind: "warm", a: 0.45 });
  }
  // The dragon, when it is walking on the ground
  if (state.stage >= 1 && !flying()) {
    const blink = safeTime > 0 && state.mode === "dragon" && Math.floor(time * 12) % 2 === 0;
    const flap = dragon.fireTime > 0 || dragon.moving;
    if (!blink) {
      if (state.stage === 1) {
        const index = (flap && Math.floor(time * 7) % 2 ? 2 : 0) + (dragon.moving ? Math.floor(dragon.anim * 9) % 2 : 0);
        put(sprites.hatchling[dragon.face][index], dragon.x - 12, dragon.y - 21, dragon.y + (state.mode === "dragon" ? 0.5 : 0));
        shade(dragon.x, dragon.y - 1, 9);
      } else {
        const info = dragonInfo();
        const img = info.set.stand[dragon.face][flap ? [1, 0, 1, 2][Math.floor(time * 6) % 4] : 1];
        put(img, dragon.x - img.width / 2, dragon.y - 31 * info.k - 1, dragon.y);
        cast(img, dragon.x, dragon.y + 5 * info.k - 1);
        shade(dragon.x, dragon.y - 1, 18 * info.k);
      }
    }
    lights.push({ x: dragon.x, y: dragon.y - 10, r: 26, kind: "fire", a: 0.5 });
  }
  // Monsters
  for (const m of monsters) {
    if (m.dead > 0 || m.x < sx - 20 || m.x > sx + VIEW_W + 20 || m.y < sy - 20 || m.y > sy + VIEW_H + 30) continue;
    const type = MONSTER_TYPES[m.type];
    const frame = Math.floor(time * (type.flies ? 8 : 4) + m.homeX) % 2;
    const lift = type.flies ? 8 + Math.sin(time * 6 + m.homeX) * 2 : 0;
    put((m.flash > 0 ? sprites.monstersHurt : sprites.monsters)[m.type][frame], m.x - type.w / 2, m.y - type.feet - lift, m.y);
    shade(m.x, m.y - 1, type.w * 0.36);
    if (m.type === "imp" || m.type === "magmaSlime") lights.push({ x: m.x, y: m.y - 8, r: 22, kind: "fire", a: 0.6, glow: 0.15 });
  }
  for (const heart of pickups) put(sprites.heart, heart.x - 5, heart.y - 8 - Math.abs(Math.sin(time * 4 + heart.x)) * 3, heart.y);
  // A giant boss that walks on the ground
  if (boss && boss.kind === "brute") {
    const giant = sprites.brutes[boss.def.look];
    const img = (boss.flash > 0 ? giant.hurt : giant.frames)[Math.floor(time * 3) % 2];
    put(img, boss.x - giant.w / 2, boss.y - giant.feet, boss.y);
    cast(img, boss.x, boss.y - giant.feet + img.height);
    shade(boss.x, boss.y - 1, giant.w * 0.36);
    lights.push({ x: boss.x, y: boss.y - giant.feet / 2, r: 70, kind: "red", a: 1, glow: 0.3 + Math.sin(time * 5) * 0.08 });
  }

  // 4. Shadows, then everything back-to-front
  const sun = sunShadow();
  shadowCtx.setTransform(1, 0, 0, 1, 0, 0);
  shadowCtx.clearRect(0, 0, VIEW_W, VIEW_H);
  for (const c of casts) {
    // Flip the dark copy upside down, squash it and lean it over: now it lies on the ground
    shadowCtx.setTransform(1, 0, sun.lean, -sun.length, c.x, c.y);
    shadowCtx.drawImage(shadowOf(c.img), -Math.round(c.img.width / 2), -c.img.height);
  }
  ctx.globalAlpha = sun.alpha * (mood === "doom" ? 0.6 : 1);
  ctx.drawImage(shadowCanvas, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(24, 16, 48, 0.26)";
  for (const s of shadows) {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.w, s.w * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  items.sort((a, b) => a.sort - b.sort);
  for (const item of items) {
    if (item.bubble) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(item.x - 3, item.y, 7, 9);
      ctx.fillStyle = "#e0402a";
      ctx.fillRect(item.x, item.y + 1, 1, 4);
      ctx.fillRect(item.x, item.y + 6, 1, 1);
    } else if (item.sway) {
      // A tree: draw the trunk still, the middle leaning a little and the top leaning more
      const [a, b] = item.sway.bands;
      const w = item.img.width;
      const h = item.img.height;
      ctx.drawImage(item.img, 0, b, w, h - b, item.x, item.y + b, w, h - b);
      ctx.drawImage(item.img, 0, a, w, b - a, item.x + Math.round(item.sway.by / 2), item.y + a, w, b - a);
      ctx.drawImage(item.img, 0, 0, w, a, item.x + Math.round(item.sway.by), item.y, w, a);
    } else ctx.drawImage(item.img, item.x, item.y);
  }
  // The knife (or sword) flashing out, with a white swish
  if (slash && slash.time > 0) {
    const blade = sprites[state.grown ? "sword" : "knife"][[1, 2, 0, 3][slash.who.dir]];
    const reach = state.grown ? 12 : 9;
    ctx.drawImage(blade, Math.round(slash.who.x - sx + slash.dx * reach - blade.width / 2), Math.round(slash.who.y - sy - 9 + slash.dy * reach - blade.height / 2));
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = Math.max(0, slash.time / 0.18);
    const facing = Math.atan2(slash.dy, slash.dx);
    for (let turn = -0.9; turn <= 0.9; turn += 0.12) {
      ctx.fillRect(Math.round(slash.who.x - sx + Math.cos(facing + turn) * (reach + 7)), Math.round(slash.who.y - sy - 9 + Math.sin(facing + turn) * (reach + 7)), 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // Birds flying over, with their shadows on the ground far below
  for (const bird of birds) {
    ctx.fillStyle = "rgba(24, 16, 48, 0.2)";
    ctx.fillRect(Math.round(bird.x - sx) + 1, Math.round(bird.y - sy) + 46, 5, 2);
    ctx.drawImage(sprites.bird[Math.floor(time * 7 + bird.flap) % 2], Math.round(bird.x - sx), Math.round(bird.y - sy));
  }

  // 5. Things in the air: a flying dragon, the Shadow Wyrm, their shots
  if (flying()) {
    const info = dragonInfo();
    const lift = 18 + Math.sin(time * 4) * 2;
    const img = info.set.fly[dragon.face][[0, 1, 2, 1][Math.floor(time * 8) % 4]];
    ctx.fillStyle = "rgba(24, 16, 48, 0.2)";
    ctx.beginPath();
    ctx.ellipse(dragon.x - sx, dragon.y - sy, 15 * info.k, 6 * info.k, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!(safeTime > 0 && Math.floor(time * 12) % 2 === 0)) {
      const top = dragon.y - sy - 31 * info.k - lift;
      ctx.drawImage(img, Math.round(dragon.x - sx - img.width / 2), Math.round(top));
      // You, riding on its back
      const rider = heroSet()[dragon.face ? 1 : 2][0];
      ctx.drawImage(rider, 0, 0, 20, 26, Math.round(dragon.x - sx - 10 + (dragon.face ? 3 : -3) * info.k), Math.round(top + 16 * info.k - 25), 20, 26);
    }
    lights.push({ x: dragon.x, y: dragon.y - lift - 10, r: 44, kind: "fire", a: 0.6 });
  }
  if (boss && boss.kind === "wyrm") {
    const lift = 20 + Math.sin(time * 3) * 3;
    const img = (boss.flash > 0 ? sprites.wyrms[boss.def.look].hurt : sprites.wyrms[boss.def.look].fly)[boss.face ? 0 : 1][[0, 1, 2, 1][Math.floor(time * (boss.awake ? 7 : 2)) % 4]];
    ctx.fillStyle = "rgba(24, 16, 48, 0.25)";
    ctx.beginPath();
    ctx.ellipse(boss.x - sx, boss.y - sy, 28, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, Math.round(boss.x - sx - img.width / 2), Math.round(boss.y - sy - 53 - lift));
    lights.push({ x: boss.x, y: boss.y - 34, r: 90, kind: "red", a: 1, glow: 0.4 + Math.sin(time * 5) * 0.08 });
  }
  for (const shot of shots) {
    const x = Math.round(shot.x - sx);
    const y = Math.round(shot.y - sy - (shot.kind === "orb" && !shot.low ? 14 : 0));
    ctx.fillStyle = shot.kind === "bolt" ? "#bfe8ff" : shot.kind === "orb" ? "#5a1a8a" : "#ff7a1a";
    ctx.fillRect(x - 2, y - 1, 5, 3);
    ctx.fillRect(x - 1, y - 2, 3, 5);
    ctx.fillStyle = shot.kind === "orb" ? "#ff8ad8" : "#ffffff";
    ctx.fillRect(x - 1, y - 1, 2, 2);
    lights.push({ x: shot.x, y: shot.y - (shot.kind === "orb" && !shot.low ? 14 : 0), r: 20, kind: shot.kind === "bolt" ? "magic" : shot.kind === "orb" ? "red" : "fire", a: 0.9, glow: 0.5 });
  }
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
    ctx.fillStyle = p.colour;
    ctx.fillRect(Math.round(p.x - sx), Math.round(p.y - sy), p.size, p.size);
    if (p.glow) lights.push({ x: p.x, y: p.y, r: 9, kind: p.glow, a: 0.6 * ctx.globalAlpha, glow: 0.3 * ctx.globalAlpha });
  }
  ctx.globalAlpha = 1;

  // 6. Cloud shadows drifting over the land (not in the gloomy places)
  const sunny = Math.max(0, Math.min(1, (regionTint[0] - 0.6) / 0.3)) * (1 - dark);
  if (sunny > 0.05) {
    ctx.globalAlpha = 0.2 * sunny;
    for (let i = 0; i < 5; i++) {
      const x = mod(i * 420 + time * 7, WORLD_W + 400) - 200 - sx;
      const y = mod(i * 333 + time * 2, WORLD_H + 300) - 150 - sy;
      if (x > -260 && x < VIEW_W && y > -160 && y < VIEW_H) ctx.drawImage(cloudShadow, x, y, 260, 150);
    }
    ctx.globalAlpha = 1;
  }

  // 7. Darkness, with every light cutting a hole in it
  const colour = ambientColour();
  if (Math.min(colour[0], colour[1], colour[2]) < 0.97) {
    lightCtx.globalCompositeOperation = "source-over";
    lightCtx.globalAlpha = 1;
    lightCtx.fillStyle = "rgb(" + colour.map((value) => Math.round(value * 255)).join(",") + ")";
    lightCtx.fillRect(0, 0, VIEW_W, VIEW_H);
    lightCtx.globalCompositeOperation = "lighter";
    for (const light of lights) {
      lightCtx.globalAlpha = light.a * Math.min(1, dark * 2.2);
      lightCtx.drawImage(sprites.glow[light.kind], light.x - sx - light.r, light.y - sy - light.r, light.r * 2, light.r * 2);
    }
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(lightCanvas, 0, 0);
  }
  // 8. A soft glow around fire and magic
  ctx.globalCompositeOperation = "lighter";
  for (const light of lights) {
    if (!light.glow) continue;
    ctx.globalAlpha = Math.min(1, light.glow);
    const r = light.r * 0.6;
    ctx.drawImage(sprites.glow[light.kind], light.x - sx - r, light.y - sy - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  lights = [];

  // 9. Creeping fog in the Forest of Doom
  const gloom = Math.max(0, (0.9 - regionTint[0]) / 0.4) * (mood === "doom" || mood === "marsh" || mood === "shadow" ? 1 : 0.3);
  if (gloom > 0.05 && regionTint[2] > regionTint[0]) {
    ctx.globalAlpha = 0.13 * gloom;
    for (let i = 0; i < 6; i++) {
      const x = mod(i * 190 + time * (6 + i) - sx * 0.6, VIEW_W + 300) - 150;
      const y = mod(i * 97 + Math.sin(time * 0.3 + i) * 20 - sy * 0.6, VIEW_H + 120) - 60;
      ctx.drawImage(sprites.glow.magic, x, y, 240, 90);
    }
    ctx.globalAlpha = 1;
  }

  // 10. Beams of sunlight by day, and pale moonbeams in the Forest of Doom
  const beams = Math.max(sunny * 0.11, gloom * 0.09);
  ctx.globalCompositeOperation = "lighter";
  if (beams > 0.01) {
    ctx.globalAlpha = beams;
    ctx.drawImage(rays, -mod(time * 5 + sx * 0.5, 240), 0);
  }
  // 11. Lightning!
  if (lightning > 0) {
    ctx.globalAlpha = Math.min(1, lightning * 2.2) * 0.34;
    ctx.fillStyle = "#dfe8ff";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (lightning > 0.26) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      let x = lightningX;
      for (let y = 0; y < 130; y += 7) {
        const next = x + (hash(y, Math.floor(lightningX), 9) - 0.5) * 18;
        ctx.fillRect(Math.round(Math.min(x, next)), y, Math.round(Math.abs(next - x)) + 2, 2);
        ctx.fillRect(Math.round(next), y, 2, 7);
        x = next;
      }
    }
  }
  // 12. Bloom: everything bright gets a soft glow
  bloomCtx.globalCompositeOperation = "source-over";
  bloomCtx.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
  bloomCtx.globalCompositeOperation = "multiply";
  bloomCtx.drawImage(bloomCanvas, 0, 0);
  bloomCtx.drawImage(bloomCanvas, 0, 0);
  ctx.globalAlpha = mood === "ice" || mood === "crag" ? 0.1 : 0.26;     // (snow is bright enough already)
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bloomCanvas, 0, 0, VIEW_W, VIEW_H);
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

// The title screen: a dragon flying past the moon
function drawTitle() {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, "#160c34");
  sky.addColorStop(0.3, "#4a1f5a");
  sky.addColorStop(0.5, "#d0502e");
  sky.addColorStop(0.62, "#ffb04a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0; i < 70; i++) {
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * (0.5 + hash(i, 3, 1)) + i));
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.floor(hash(i, 1, 1) * VIEW_W), Math.floor(hash(i, 2, 1) * 130), 1, 1);
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35;
  ctx.drawImage(sprites.glow.warm, 270 - 70, 62 - 70, 140, 140);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(moon, 242, 34);
  // Three rows of mountains, sliding past at different speeds
  const layers = [["#7a2f52", 128, 34, 3], ["#4a1c46", 150, 30, 7], ["#241034", 176, 26, 14]];
  for (const [colour, base, height, speed] of layers) {
    ctx.fillStyle = colour;
    for (let x = 0; x < VIEW_W; x++) {
      const ridge = smoothNoise(x + time * speed, base, 38, base) * height + smoothNoise(x + time * speed, base, 9, base + 1) * 8;
      ctx.fillRect(x, Math.round(base - ridge), 1, VIEW_H);
    }
  }
  const x = ((time * 34) % (VIEW_W + 160)) - 80;
  ctx.drawImage(sprites.drake.fly[0][[0, 1, 2, 1][Math.floor(time * 7) % 4]], Math.round(x), Math.round(40 + Math.sin(time * 1.4) * 10));
  for (let i = 0; i < 26; i++) {
    const rise = (time * (8 + hash(i, 5, 1) * 14) + hash(i, 6, 1) * 240) % 240;
    ctx.globalAlpha = 1 - rise / 240;
    ctx.fillStyle = FIRE_COLOURS[1 + (i % 3)];
    ctx.fillRect(Math.floor(hash(i, 7, 1) * VIEW_W + Math.sin(time + i) * 6), Math.floor(VIEW_H - rise), 1, 1);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// The game loop: update, draw, repeat
// ---------------------------------------------------------------------------

let lastTime = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));   // the time since the last frame, in seconds
  lastTime = now;
  if (screen === "play") {
    update(dt);
    drawWorld();
  } else {
    time += dt;
    drawTitle();
  }
  for (const code in justPressed) justPressed[code] = false;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Only for testing the game: lets a test jump to any point in the story.
window.DT = {
  get state() { return state; },
  hero: hero, dragon: dragon, wizard: wizard, dog: dog, keys: keys, justPressed: justPressed,
  lead: lead, flying: flying, canStand: canStand, setMode: (mode) => setMode(mode),
  step: () => (SAGA ? stepNow() : null), things: () => WORLD.objects, npcs: npcs,
  mouth: () => dragonMouth(),
  go: function (x, y) {
    for (const who of [hero, dragon, wizard, dog]) {
      who.x = centre(x);
      who.y = centre(y) + 2;
    }
    trail = [];
  },
  fire: function (dx, dy) {
    aim = { x: dx, y: dy };
    dragon.cool = 0;
    breatheFire(false);
  },
  monsters: () => monsters, boss: () => boss, shots: () => shots, tame: () => tame, talk: () => talk, card: () => card,
  jump: function (changes, squareX, squareY) {
    talk = card = tame = null;
    for (const id of ["dialogue", "card", "tame", "name-box"]) el(id).hidden = true;
    const fresh = Object.assign(newState(), changes);
    if (squareX !== undefined) {
      fresh.x = centre(squareX);
      fresh.y = centre(squareY) + 2;
    }
    startGame(fresh);
    stepBusy = false;
    mood = SAGA ? SAGA.moods[regionNow] : regionNow;
    regionTint = (REGION_TINTS[mood] || [1, 1, 1]).slice();
  },
};
if (location.search.includes("test=")) {
  const test = JSON.parse(decodeURIComponent(location.search.split("test=")[1]));
  window.DT.jump(test.state || {}, test.at && test.at[0], test.at && test.at[1]);
}
