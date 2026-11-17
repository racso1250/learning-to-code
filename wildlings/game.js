// Wildlings: explore a huge land, battle and catch 151 creatures, and beat the Guardians.
// The land is built by ../dragon/mapkit.js; every creature's picture is drawn by the code below.

const VIEW_W = 480;
const VIEW_H = 320;
const el = (id) => document.getElementById(id);
const centre = (square) => square * TILE + TILE / 2;
const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]];

// ----- The 151 Wildlings -----
// Eight kinds. Each kind is strong against two others.
const KINDS = ["Leaf", "Fire", "Water", "Spark", "Stone", "Frost", "Shade", "Wind"];
const KIND_COLOUR = ["#58b848", "#f0622a", "#3a8ae8", "#f2c81e", "#a08a6a", "#7ad8f0", "#8a5ad0", "#a8c8d8"];
const KIND_PAINT = [[110, 60, 52], [14, 82, 55], [212, 72, 56], [50, 88, 56], [32, 26, 52], [188, 62, 72], [272, 46, 46], [200, 28, 80]];      // hue, colourfulness, lightness
const KIND_EXTRA = ["#ffe36a", "#ffd23a", "#bfeaff", "#ffffff", "#5a4a3a", "#ffffff", "#ff6ad0", "#ffffff"];
const STRONG = [[2, 4], [0, 5], [1, 4], [2, 7], [1, 3], [0, 7], [3, 5], [0, 6]];
const MOVES = [["Leaf Slap", "Thorn Storm"], ["Hot Breath", "Fire Wheel"], ["Splash Shot", "Tidal Crash"], ["Zap", "Thunder Clap"], ["Rock Toss", "Landslide"], ["Ice Chip", "Snow Crash"], ["Spooky Poke", "Night Wave"], ["Gust Flick", "Twister"]];
// Fifty families of three (a baby, a middle one and a big one), and one mystery creature: 151 in all.
const FAMILIES = [
  [0, "Sproutle", "Thornlet", "Bramblor"], [1, "Emberkit", "Flarefox", "Infernox"], [2, "Dripple", "Splashet", "Tidalor"],
  [0, "Mossip", "Fernock", "Grovemaw"], [0, "Petalu", "Bloomra", "Floravex"], [0, "Acornip", "Oakling", "Timberox"], [0, "Shroomi", "Sporecap", "Mycelord"], [0, "Vinny", "Creepvine", "Junglash"],
  [1, "Cindle", "Scorchet", "Pyrowl"], [1, "Magmite", "Lavalump", "Volcrag"], [1, "Kindlepup", "Charhound", "Hellmane"], [1, "Smolder", "Ashwing", "Phoenara"], [1, "Coalby", "Furnip", "Forgemaw"], [1, "Wyrmlet", "Drakeling", "Dragonyx"],
  [2, "Bubblet", "Foamfin", "Surgeray"], [2, "Puddlo", "Marshog", "Bogzilla"], [2, "Shellby", "Coralit", "Reefguard"], [2, "Tadpip", "Frogleap", "Croakking"], [2, "Minnowt", "Pikefang", "Leviatide"], [2, "Sealy", "Otterush", "Kelpiecorn"],
  [3, "Zappip", "Voltail", "Thundermane"], [3, "Buzzle", "Ampwing", "Stormoth"], [3, "Wattle", "Dynamoo", "Teslord"], [3, "Flickit", "Glowbug", "Lumibeam"], [3, "Statty", "Shockoon", "Boltusk"], [3, "Plugg", "Socketeer", "Gridlock"],
  [4, "Pebblet", "Rockrun", "Bouldrake"], [4, "Gravlin", "Cragmaw", "Monolith"], [4, "Dusty", "Sandigger", "Dunetitan"], [4, "Orelet", "Ironhide", "Steelossus"], [4, "Fossi", "Bonecrest", "Ancientus"], [4, "Crystip", "Geodeon", "Prismarock"],
  [5, "Flakey", "Snowlet", "Blizzarus"], [5, "Chillpup", "Frostfang", "Glaciwolf"], [5, "Icicub", "Polarok", "Tundrabear"], [5, "Slushi", "Sleetle", "Hailstorm"], [5, "Pengwee", "Skatefin", "Emperice"], [5, "Frosti", "Rimewing", "Aurorowl"],
  [6, "Gloomp", "Duskit", "Nightmaw"], [6, "Wispy", "Phantlet", "Spectrix"], [6, "Shady", "Umbrat", "Eclipsor"], [6, "Batlet", "Nocturn", "Vampyre"], [6, "Spookle", "Hauntern", "Dreadlamp"], [6, "Inkit", "Murkoil", "Abyssquid"],
  [7, "Breezi", "Gustling", "Cyclonis"], [7, "Flit", "Swooper", "Skytalon"], [7, "Puffet", "Cloudle", "Nimbustorm"], [7, "Kitey", "Glidera", "Zephyrex"], [7, "Featherp", "Plumage", "Galehawk"], [7, "Whirly", "Twistle", "Tornadon"],
];
const DEX = [null];       // DEX[1] to DEX[151]
FAMILIES.forEach(function (family, f) {
  for (let stage = 0; stage < 3; stage++) DEX.push({ name: family[stage + 1], kind: family[0], family: f, stage: stage });
});
DEX.push({ name: "Auroth", kind: 7, family: 50, stage: 2, mystery: true });
const TOTAL = DEX.length - 1;
const GROW_AT = [12, 28];       // the levels where a Wildling changes into its next form
const familiesOf = KINDS.map((kind, k) => FAMILIES.map((family, f) => (family[0] === k ? f : -1)).filter((f) => f >= 0));

// A repeatable random-number maker, so each creature always looks the same
function dice(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Draw a creature: a round body made of chunky pixels, the same on both sides, with ears, feet and eyes
const pictures = [];
function picture(id) {
  if (pictures[id]) return pictures[id];
  const info = DEX[id];
  const roll = dice(info.family * 97 + 13);
  const [hue, rich, light] = KIND_PAINT[info.kind];
  const tint = hue + (roll() - 0.5) * 44;
  const paint = (l) => "hsl(" + tint + "," + rich + "%," + l + "%)";
  const wobble = Array.from({ length: 16 }, () => roll());
  const ears = roll() < 0.75, earAt = roll(), wings = roll() < 0.6, spots = roll() < 0.5, crest = roll() < 0.4;
  const hw = 3.6 + info.stage * 1.5 + roll() * 0.8, hh = 4 + info.stage * 1.4 + roll() * 0.8, cy = 14.5 - hh;
  const cells = Array.from({ length: 16 }, () => new Array(16).fill(""));
  const set = (x, y, colour) => {      // paint a cell on both sides
    if (y < 0 || y > 15 || x < 0 || x > 7) return;
    cells[y][8 + x] = cells[y][7 - x] = colour;
  };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
    const dx = (x + 0.5) / hw, dy = (y + 0.5 - cy) / hh;
    if (dx * dx + dy * dy > 0.7 + wobble[y] * 0.3) continue;
    const belly = dx < 0.5 && dy > 0 && dy < 0.75;
    set(x, y, belly ? paint(light + 24) : dy > 0.45 ? paint(light - 12) : spots && wobble[(x * 5 + y * 3) % 16] < 0.18 ? KIND_EXTRA[info.kind] : paint(light));
  }
  const top = Math.max(0, Math.round(cy - hh * 0.8));
  const earX = Math.min(6, Math.max(1, Math.round(hw * (0.35 + earAt * 0.4))));
  if (ears) for (let n = 1; n <= 1 + info.stage; n++) set(earX, top - n + 1, n > info.stage ? KIND_EXTRA[info.kind] : paint(light - 6));
  if (crest || info.mystery) for (let n = 0; n <= info.stage; n++) set(0, top - n, KIND_EXTRA[info.kind]);
  if (wings && info.stage > 0) for (let n = 0; n < info.stage + 1; n++) {
    set(Math.min(7, Math.round(hw) + n), Math.round(cy) - n, KIND_EXTRA[info.kind]);
    set(Math.min(7, Math.round(hw) + n), Math.round(cy) - n + 1, paint(light - 6));
  }
  set(1, 15, paint(light - 18));       // feet
  set(Math.min(6, Math.round(hw * 0.6)), 15, paint(light - 18));
  const eyeY = Math.round(cy - hh * 0.2), eyeX = Math.max(1, Math.round(hw * 0.38));
  const img = makeCanvas(32, 32);
  const g = img.getContext("2d");
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (cells[y][x]) {
      g.fillStyle = cells[y][x];
      g.fillRect(x * 2, y * 2, 2, 2);
    } else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => cells[y + ay] && cells[y + ay][x + ax])) {
      g.fillStyle = paint(14);        // a dark outline round the edge
      g.fillRect(x * 2, y * 2, 2, 2);
    }
  }
  for (const side of [-1, 1]) {
    const ex = side > 0 ? (8 + eyeX) * 2 : (7 - eyeX) * 2;
    g.fillStyle = "#ffffff";
    g.fillRect(ex, eyeY * 2, 2, 2 + info.stage);
    g.fillStyle = "#1d1730";
    g.fillRect(side > 0 ? ex : ex + 1, eyeY * 2 + 1, 1, 1 + info.stage);
  }
  return (pictures[id] = img);
}

// ----- Numbers for battles -----
const maxHp = (c) => Math.round(20 + c.lv * (3 + DEX[c.id].stage * 0.8 + (DEX[c.id].family % 3) * 0.3));
const power = (c) => 6 + c.lv * (1.2 + DEX[c.id].stage * 0.25 + (DEX[c.id].family % 4) * 0.06);
const guard = (c) => 6 + c.lv * (1.2 + DEX[c.id].stage * 0.25 + ((DEX[c.id].family + 2) % 4) * 0.06);
const quick = (c) => c.lv * (1 + (DEX[c.id].family % 5) * 0.1) + (2 - DEX[c.id].stage);
const xpToGrow = (c) => 12 + c.lv * 9;
const idFor = (family, lv) => (family === 50 ? 151 : family * 3 + 1 + (lv >= GROW_AT[1] ? 2 : lv >= GROW_AT[0] ? 1 : 0));
const newCreature = (id, lv) => {
  const c = { id: id, lv: lv, xp: 0 };
  c.hp = maxHp(c);
  return c;
};
function movesOf(c) {
  const kind = DEX[c.id].kind;
  const list = [{ name: "Bonk", kind: -1, power: 5, sure: 1 }, { name: MOVES[kind][0], kind: kind, power: 8, sure: 0.95 }];
  if (c.lv >= 10) list.push({ name: MOVES[kind][1], kind: kind, power: 12, sure: 0.8 });
  return list;
}
const effect = (from, to) => (from < 0 ? 1 : STRONG[from].includes(to) ? 2 : from === to || STRONG[to].includes(from) ? 0.5 : 1);

function sound(make) {
  try { make(); } catch (error) { /* no sound: the game still works */ }
}
const sfx = {
  step: () => sound(() => playTone(0, 0.05, 500, 700, 0.06)),
  hit: () => sound(() => playTone(0, 0.1, 260, 110, 0.16)),
  miss: () => sound(() => playNoise(0, 0.1, 1800, 600, 0.08)),
  orb: () => sound(() => { playTone(0, 0.1, 500, 900, 0.1); playTone(0.15, 0.1, 500, 900, 0.1); }),
  good: () => sound(() => { playTone(0, 0.12, 880, 1320, 0.14); playTone(0.12, 0.18, 1320, 1760, 0.12); }),
  wild: () => sound(() => { playTone(0, 0.1, 300, 600, 0.12); playTone(0.1, 0.1, 300, 600, 0.12); playTone(0.2, 0.2, 400, 900, 0.12); }),
  win: () => sound(() => playJingle()),
};

// ----- What the game remembers -----
const SAVE_NAME = "wildlingsSave";
let state = { team: [], stored: 0, dex: {}, orbs: 10, badges: {}, taken: {}, x: 0, y: 0 };
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

// ----- The land -----
const KID_LOOKS = { kid: { size: "teen", skin: "#f2c79a", blush: "#e89a84", hair: "#4a3020", style: "short", tunic: "#e0503a", trim: "#ffffff", sleeve: "#ffffff", pants: "#3a5a8a", boots: "#2a2020", belt: "#3a2a20" } };
startSaga(middleLands({ cols: 1, rows: 1, order: [[0, 0]], regions: [{ id: "land", name: "Home", biome: "meadow", bushes: 2 }], story: { dragon: ["ember", "gold"], looks: KID_LOOKS, steps: [], bosses: [], save: "x", start: {} } }));
const SPR = buildSprites();
const canvas = el("game");
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const water = makeLiquid(["#2468b8", "#2f7fd0", "#4a9ae6", "#b8e4ff"], false);
const lavaFlow = makeLiquid(["#d83a12", "#ff7a1a", "#ffb52e", "#fff0a0"], false);
const shadowCanvas = makeCanvas(VIEW_W, VIEW_H);
const shadowCtx = shadowCanvas.getContext("2d");
const darkCopies = new Map();
const darkCopy = (img) => darkCopies.get(img) || darkCopies.set(img, tinted(img, "#1a1238")).get(img);
const rows = [];
for (let y = 0; y < MAP_H; y++) rows.push([]);
for (const o of WORLD.objects) {
  let img;
  if (o.type === "pickup") img = SPR.gems[o.colour] || (SPR.gems[o.colour] = drawGem(o.colour));
  else {
    const list = SPR[o.type === "peak" ? (o.snowy ? "snowpeak" : "peak") : o.type];
    if (!list) continue;
    img = list[(typeof o.look === "number" ? o.look : Math.floor(hash(o.x, o.y, 5) * list.length)) % list.length];
  }
  const natural = ["oak", "pine", "snowpine", "doomtree", "ashtree", "bush", "rock", "mushroom", "skull", "spike", "cactus", "icespire", "palm"].includes(o.type);
  const bx = (o.x + o.w / 2) * TILE + (natural ? Math.round((hash(o.x, o.y, 6) - 0.5) * 6) : 0);
  const by = (o.y + 1) * TILE + (o.type === "peak" ? 3 + Math.round(hash(o.x, o.y, 8) * 5) : natural ? -Math.round(hash(o.x, o.y, 7) * 4) : 0);
  rows[o.y].push({ o: o, img: img, x: Math.round(bx - img.width / 2), y: by - img.height, bx: bx, by: by });
}
for (const npc of STORY.npcs) {
  npc.px = centre(npc.x);
  npc.py = centre(npc.y) + 2;
}
// Wild creatures: which kind lives where depends on the land, and they get stronger the further you go from home
const HOME = { x: centre(PLACES.start.x), y: centre(PLACES.start.y) + 2 };
const LIVES_AS = { slime: 0, bat: 7, spider: 6, golem: 4, imp: 1, bogSlime: 2, iceSlime: 5, magmaSlime: 1, scorpion: 3, wraith: 6, iceGolem: 5, sandGolem: 4, shade: 6 };
const wilds = [];
for (const spot of WORLD.monsters) {
  const far = Math.hypot(spot.x - PLACES.start.x, spot.y - PLACES.start.y);
  if (far < 6 || LIVES_AS[spot.type] === undefined) continue;
  const kind = hash(spot.x, spot.y, 91) < 0.22 ? Math.floor(hash(spot.x, spot.y, 92) * 8) : LIVES_AS[spot.type];
  const family = familiesOf[kind][Math.floor(hash(spot.x, spot.y, 93) * familiesOf[kind].length)];
  const lv = Math.min(46, 2 + Math.floor(far / 8) + Math.floor(hash(spot.x, spot.y, 94) * 3));
  wilds.push({ id: idFor(family, lv), lv: lv, x: centre(spot.x), y: centre(spot.y), homeX: centre(spot.x), homeY: centre(spot.y), vx: 0, vy: 0, think: 0, away: 0 });
}
const guardians = STORY.bosses.map(function (b, i) {
  const far = Math.hypot(b.x - PLACES.start.x, b.y - PLACES.start.y);
  const lv = Math.max(12, Math.min(48, Math.round(6 + far / 7)));
  const kind = i % 8;
  return { def: b, name: "Guardian of " + KINDS[kind], x: centre(b.x), y: centre(b.y), team: [0, 1].map((n) => newCreature(idFor(familiesOf[kind][(i + n * 3) % familiesOf[kind].length], lv), lv + n)) };
});
let mystery = null;      // Auroth, who only appears once every Guardian is beaten
function wakeMystery() {
  if (mystery || state.dex[151] === 2 || guardians.some((g) => !state.badges[g.def.id])) return;
  mystery = { id: 151, lv: 50, x: HOME.x + 40, y: HOME.y + 30, homeX: HOME.x + 40, homeY: HOME.y + 30, vx: 0, vy: 0, think: 0, away: 0, still: true };
  wilds.push(mystery);
}

const me = { x: HOME.x, y: HOME.y, dir: 0, anim: 0, moving: false };
const buddy = { x: HOME.x - 14, y: HOME.y, hop: 0 };      // your leading Wildling walks behind you
let trail = [];
let cam = { x: 0, y: 0 };
let time = 0;
let mode = "title";      // title, choose, walk, battle, team, dex
let pickedAt = {};
let bits = [];
let pick = 0;            // which thing is chosen in a menu

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
const tapped = (name) => Object.keys(MOVE_KEYS).some((code) => MOVE_KEYS[code] === name && justPressed[code]);
const pressed = (code) => !!justPressed[code];
const chose = () => pressed("Space") || pressed("Enter");
const wentBack = () => pressed("Escape") || pressed("KeyX") || pressed("Backspace");
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
  for (let i = 0; i < count && bits.length < 300; i++) {
    const angle = Math.random() * Math.PI * 2, push = speed * (0.3 + Math.random() * 0.7);
    bits.push({ x: x, y: y, vx: Math.cos(angle) * push, vy: Math.sin(angle) * push, life: 0.3 + Math.random() * 0.5, colour: colours[Math.floor(Math.random() * colours.length)] });
  }
}
function solidAt(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || WORLD.blocked[ty][tx];
}
const canStand = (x, y) => !solidAt(x - 4, y - 5) && !solidAt(x + 4, y - 5) && !solidAt(x - 4, y + 1) && !solidAt(x + 4, y + 1);
function healTeam() {
  for (const c of state.team) c.hp = maxHp(c);
}

// ----- Battles -----
// A battle is a list of little happenings. Each one is a function that does something and
// gives back the words to show (or nothing, to skip straight to the next one).
let battle = null;
function startBattle(foes, wild, guardian) {
  battle = { foes: foes, foe: foes[0], wild: wild, guardian: guardian, queue: [], text: "", menu: "main", done: "", shake: 0 };
  mode = "battle";
  pick = 0;
  el("toast").hidden = true;
  see(battle.foe.id, false);
  sfx.wild();
  battle.text = guardian ? guardian.name + " wants to battle! They send out " + DEX[battle.foe.id].name + "!" : "A wild " + DEX[battle.foe.id].name + " appeared!";
  if (lead().hp <= 0) state.team.unshift(state.team.splice(state.team.findIndex((c) => c.hp > 0), 1)[0]);
}
const label = (c) => (c === battle.foe ? (battle.guardian ? "The Guardian's " : "The wild ") : "") + DEX[c.id].name;
function attack(from, to, move) {
  return function () {
    if (from.hp <= 0 || to.hp <= 0 || from !== (to === battle.foe ? lead() : battle.foe)) return null;
    if (Math.random() > move.sure) {
      sfx.miss();
      return label(from) + " used " + move.name + "... but it missed!";
    }
    const strong = effect(move.kind, DEX[to.id].kind);
    const damage = Math.max(1, Math.round((3 + from.lv * 0.6) * (move.power / 6) * (power(from) / guard(to)) * strong * (0.85 + Math.random() * 0.15)));
    to.hp = Math.max(0, to.hp - damage);
    to.flash = 0.4;
    battle.shake = 0.25;
    sfx.hit();
    if (to.hp === 0) {
      battle.queue.length = 0;
      battle.queue.push(to === battle.foe ? foeFainted : mineFainted);
    }
    return label(from) + " used " + move.name + "!" + (strong > 1 ? " It's super strong!" : strong < 1 ? " It's not very strong..." : "");
  };
}
const foeAttacks = () => {
  const moves = movesOf(battle.foe);
  return attack(battle.foe, lead(), moves[Math.floor(Math.random() * moves.length)]);
};
function foeFainted() {
  const mine = lead(), foe = battle.foe;
  mine.xp += Math.round(foe.lv * (battle.guardian ? 11 : 7));
  battle.queue.push(function () {
    const grew = [];
    while (mine.lv < 60 && mine.xp >= xpToGrow(mine)) {
      mine.xp -= xpToGrow(mine);
      const before = maxHp(mine);
      mine.lv++;
      mine.hp += maxHp(mine) - before;
      grew.push(mine.lv);
    }
    if (!grew.length) return null;
    sfx.good();
    const stage = DEX[mine.id].stage;
    if (!DEX[mine.id].mystery && stage < 2 && mine.lv >= GROW_AT[stage]) battle.queue.unshift(function () {
      const old = DEX[mine.id].name, before = maxHp(mine);
      mine.id += mine.lv >= GROW_AT[1] && stage === 0 ? 2 : 1;
      mine.hp += maxHp(mine) - before;
      see(mine.id, true);
      sfx.win();
      return "What? " + old + " is changing... It grew into " + DEX[mine.id].name + "!";
    });
    return DEX[mine.id].name + " grew to level " + grew[grew.length - 1] + "!";
  });
  battle.queue.push(function () {
    battle.foes.shift();
    if (!battle.foes.length) {
      battle.done = "won";
      if (!battle.guardian && Math.random() < 0.35) {
        state.orbs++;
        return "It dropped a capture orb!";
      }
      return null;
    }
    battle.foe = battle.foes[0];
    see(battle.foe.id, false);
    return battle.guardian.name + " sends out " + DEX[battle.foe.id].name + "!";
  });
  return label(foe) + " fainted! " + DEX[mine.id].name + " gained experience.";
}
function mineFainted() {
  const name = DEX[lead().id].name;
  if (awake().length) battle.menu = "swap!";         // you must choose who comes out next
  else battle.queue.push(function () {
    battle.done = "lost";
    return "All your Wildlings have fainted! You hurry back home...";
  });
  return name + " fainted!";
}
function act(what, n) {
  const q = battle.queue, mine = lead(), foe = battle.foe;
  battle.menu = "main";
  pick = 0;
  if (what === "move") {
    const move = movesOf(mine)[n];
    if (quick(mine) >= quick(foe)) q.push(attack(mine, foe, move), foeAttacks());
    else q.push(foeAttacks(), attack(mine, foe, move));
  } else if (what === "catch") {
    if (battle.guardian) q.push(() => "You can't catch a Guardian's Wildling!");
    else if (state.orbs <= 0) q.push(() => "You have no capture orbs left! Win battles or find gems to get more.");
    else {
      state.orbs--;
      q.push(function () {
        sfx.orb();
        return "You threw a capture orb! It wobbles... and wobbles...";
      }, function () {
        const chance = 0.22 + (1 - foe.hp / maxHp(foe)) * 0.7 - DEX[foe.id].stage * 0.08 - (DEX[foe.id].mystery ? 0.15 : 0);
        if (Math.random() > chance) {
          q.push(foeAttacks());
          return "Oh no! " + DEX[foe.id].name + " broke free!";
        }
        const fresh = !(state.dex[foe.id] === 2);
        see(foe.id, true);
        if (state.team.length < 6) state.team.push(foe);
        else state.stored++;
        battle.done = "caught";
        sfx.win();
        return "Gotcha! " + DEX[foe.id].name + " was caught!" + (fresh ? " That's a new one for your Wilddex (" + caughtCount() + " of " + TOTAL + ")." : "") + (state.team.length >= 6 && state.team[state.team.length - 1] !== foe ? " Your team is full, so it went to the ranch." : "");
      });
    }
  } else if (what === "swap") {
    const forced = mine.hp <= 0;
    state.team.unshift(state.team.splice(n, 1)[0]);
    q.push(() => "Go, " + DEX[lead().id].name + "!");
    if (!forced) q.push(foeAttacks());
  } else if (what === "run") {
    if (battle.guardian) q.push(() => "You can't run from a Guardian battle!");
    else if (Math.random() < 0.8) q.push(function () {
      battle.done = "ran";
      return "You got away safely!";
    });
    else q.push(() => "You couldn't get away!", foeAttacks());
  }
  next();
}
function next() {
  while (battle.queue.length) {
    const words = battle.queue.shift()();
    if (words) return (battle.text = words);
  }
  battle.text = "";
  if (battle.done) endBattle();
}
function endBattle() {
  const { done, wild, guardian } = battle;
  if (wild) wild.away = done === "ran" ? 12 : wild === mystery && done !== "caught" ? 5 : 120;
  if (wild && wild === mystery && done === "caught") wilds.splice(wilds.indexOf(mystery), 1);
  for (const c of battle.foes) c.hp = maxHp(c);           // (a Guardian's team is ready again for next time)
  battle = null;
  mode = "walk";
  if (done === "lost") {
    Object.assign(me, { x: HOME.x, y: HOME.y });
    trail = [];
    healTeam();
    toast("Back home, your Wildlings are all rested and ready again.", 5);
  } else if (guardian && done === "won") {
    state.badges[guardian.def.id] = true;
    state.orbs += 5;
    sfx.win();
    const got = Object.keys(state.badges).length;
    showCard(["You beat the " + guardian.name + "! You win the " + guardian.name.slice(12) + " Badge and 5 capture orbs.", "Badges: " + got + " of " + guardians.length + "."].concat(got === guardians.length ? ["Every Guardian is beaten! They say a mystery Wildling has appeared near your home..."] : []), wakeMystery);
  }
  if (caughtCount() === TOTAL) showCard(["You caught all " + TOTAL + " Wildlings! You are a true Wildling Master!"]);
  save();
}
function updateBattle(dt) {
  if (battle.shake > 0) battle.shake -= dt;
  for (const c of [lead(), battle.foe]) if (c.flash > 0) c.flash -= dt;
  if (battle.text) {
    if (chose()) next();
    return;
  }
  const options = menuOptions();
  if (tapped("down")) pick = (pick + 1) % options.length;
  if (tapped("up")) pick = (pick + options.length - 1) % options.length;
  if (tapped("down") || tapped("up")) sfx.step();
  if (wentBack() && battle.menu !== "main" && battle.menu !== "swap!") {
    battle.menu = "main";
    pick = 0;
  }
  if (!chose()) return;
  const option = options[pick];
  if (option.off) return sfx.miss();
  if (battle.menu === "main") {
    if (pick === 0) battle.menu = "moves";
    else if (pick === 2) battle.menu = "swap";
    else return act(pick === 1 ? "catch" : "run");
    pick = 0;
  } else if (battle.menu === "moves") {
    if (pick === options.length - 1) battle.menu = "main";
    else return act("move", pick);
    pick = 0;
  } else act("swap", option.n);
}
function menuOptions() {
  if (battle.menu === "main") return [{ text: "Fight" }, { text: "Catch (" + state.orbs + " orbs)" }, { text: "Swap Wildling", off: awake().length < 2 }, { text: "Run away" }];
  if (battle.menu === "moves") return movesOf(lead()).map((move) => ({ text: move.name + (move.kind < 0 ? "" : " (" + KINDS[move.kind] + ")") })).concat([{ text: "Back" }]);
  return state.team.map((c, n) => ({ text: DEX[c.id].name + " L" + c.lv + " " + c.hp + "/" + maxHp(c), off: c.hp <= 0 || n === 0, n: n })).filter((o) => o.n > 0);
}

// ----- Walking around -----
let hudText = "";
function updateWalk(dt) {
  if (card) return updateCard();
  if (pressed("KeyX")) return ((mode = "team"), (pick = 0));
  if (pressed("KeyZ")) return (mode = "dex");
  const ax = (held("right") ? 1 : 0) - (held("left") ? 1 : 0), ay = (held("down") ? 1 : 0) - (held("up") ? 1 : 0);
  me.moving = ax !== 0 || ay !== 0;
  if (me.moving) {
    const length = Math.hypot(ax, ay), speed = keys.ShiftLeft || keys.ShiftRight ? 150 : 100;
    if (canStand(me.x + (ax / length) * speed * dt, me.y)) me.x += (ax / length) * speed * dt;
    if (canStand(me.x, me.y + (ay / length) * speed * dt)) me.y += (ay / length) * speed * dt;
    me.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 1 : 2) : ay < 0 ? 3 : 0;
    me.anim += dt;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - me.x, last.y - me.y) > 3) {
      trail.push({ x: me.x, y: me.y });
      if (trail.length > 40) trail.shift();
    }
  }
  // Your leading Wildling hops along behind you
  let need = 18, px = me.x, py = me.y;
  for (let n = trail.length - 1; n >= 0 && need > 0; n--) {
    const d = Math.hypot(trail[n].x - px, trail[n].y - py);
    if (d >= need) {
      const tx = px + ((trail[n].x - px) * need) / d, ty = py + ((trail[n].y - py) * need) / d;
      if (Math.hypot(tx - buddy.x, ty - buddy.y) > 1) buddy.hop += dt * 12;
      buddy.x += (tx - buddy.x) * Math.min(1, dt * 12);
      buddy.y += (ty - buddy.y) * Math.min(1, dt * 12);
      break;
    }
    need -= d;
    px = trail[n].x;
    py = trail[n].y;
  }
  // Things in front of you: someone to talk to, berries to pick
  const fx = me.x + DIRS[me.dir][0] * 12, fy = me.y - 4 + DIRS[me.dir][1] * 12;
  const who = STORY.npcs.find((npc) => Math.hypot(npc.px - fx, npc.py - 4 - fy) < 18);
  let bush = null, sign = null;
  for (let ty = Math.floor(fy / TILE) - 1; ty <= Math.floor(fy / TILE) + 1; ty++) for (const thing of rows[ty] || []) {
    if (Math.hypot(thing.bx - fx, thing.by - 8 - fy) > 18) continue;
    if (thing.o.type === "berrybush" && !(time - pickedAt[thing.o.id] < 40)) bush = thing.o;
    if (thing.o.type === "sign") sign = thing.o;
  }
  const words = who ? "Space: talk to " + who.name : bush ? "Space: feed berries to your team" : sign ? "Space: read the sign" : "";
  if (el("prompt").textContent !== words) {
    el("prompt").textContent = words;
    el("prompt").hidden = !words;
  }
  if (chose()) {
    if (who) {
      healTeam();
      showCard([who.name + ": \"" + who.line + "\"", who.name + ": \"Your Wildlings look tired. There! All better.\" (Your team is healed.)"]);
    } else if (sign) showCard([sign.text]);
    else if (bush) {
      pickedAt[bush.id] = time;
      healTeam();
      sfx.good();
      toast("Yum! Your whole team is healed.", 3);
    }
  }
  // Gems on the ground are worth capture orbs
  for (let ty = Math.floor(me.y / TILE) - 1; ty <= Math.floor(me.y / TILE) + 1; ty++) for (const thing of rows[ty] || []) {
    const o = thing.o;
    if (o.type !== "pickup" || state.taken["p" + o.id] || Math.hypot(centre(o.x) - me.x, centre(o.y) - me.y) > 14) continue;
    state.taken["p" + o.id] = true;
    state.orbs += 3;
    sfx.good();
    burst(centre(o.x), centre(o.y) - 6, ["#ffd84a", "#ffffff"], 16, 60);
    toast("A gem! You swap it for 3 capture orbs. (" + state.orbs + " orbs)", 3);
    save();
  }
  // Wild creatures wander about. Bump into one to battle it.
  for (const w of wilds) {
    const dx = me.x - w.x, dy = me.y - w.y, far = Math.hypot(dx, dy);
    if (w.away > 0) {
      if (far > 200 || w.away > 100) w.away -= dt;
      if (w.away <= 0) Object.assign(w, { x: w.homeX, y: w.homeY });
      continue;
    }
    if (far > 320) continue;
    if (!w.still && (w.think -= dt) <= 0) {
      w.think = 1 + Math.random() * 2;
      const back = Math.hypot(w.homeX - w.x, w.homeY - w.y) > 50;
      const angle = back ? Math.atan2(w.homeY - w.y, w.homeX - w.x) : far < 70 && Math.random() < 0.5 ? Math.atan2(dy, dx) : Math.random() * 6.28;
      const speed = Math.random() < 0.3 ? 0 : 22;
      w.vx = Math.cos(angle) * speed;
      w.vy = Math.sin(angle) * speed;
    }
    if (!solidAt(w.x + w.vx * dt, w.y - 2)) w.x += w.vx * dt;
    if (!solidAt(w.x, w.y + w.vy * dt - 2)) w.y += w.vy * dt;
    if (far < 13 && Math.hypot(me.x - HOME.x, me.y - HOME.y) > 40 - (w.still ? 40 : 0)) return startBattle([newCreature(w.id, w.lv)], w, null);
  }
  for (const g of guardians) if (!state.badges[g.def.id] && Math.hypot(g.x - me.x, g.y - me.y) < 26) {
    me.y += 30;        // (step back, so losing doesn't start the battle again straight away)
    return startBattle(g.team.slice(), null, g);
  }
  const top = [DEX[lead().id].name, lead().lv, lead().hp, caughtCount(), state.orbs, Object.keys(state.badges).length, regionAt(Math.floor(me.x / TILE), Math.floor(me.y / TILE))].join("|");
  if (top !== hudText) {
    hudText = top;
    el("hearts").textContent = DEX[lead().id].name + " L" + lead().lv + "  HP " + lead().hp + "/" + maxHp(lead());
    el("rings").textContent = "Caught " + caughtCount() + "/" + TOTAL + " · Orbs " + state.orbs + " · Badges " + Object.keys(state.badges).length + "/" + guardians.length;
    el("place").textContent = "➤ " + REGION_NAMES[regionAt(Math.floor(me.x / TILE), Math.floor(me.y / TILE))] + ". Wild creatures near here are about level " + Math.min(46, 3 + Math.floor(Math.hypot(me.x - HOME.x, me.y - HOME.y) / TILE / 8)) + ".";
  }
}

// ----- Drawing -----
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
const SWAY = { oak: [16, 30], doomtree: [12, 22], pine: [14, 28], snowpine: [14, 28], palm: [18, 30] };
function drawWalk() {
  const goX = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, me.x - VIEW_W / 2));
  const goY = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, me.y - 14 - VIEW_H / 2));
  cam.x += (goX - cam.x) * 0.18;
  cam.y += (goY - cam.y) * 0.18;
  const sx = Math.round(cam.x), sy = Math.round(cam.y);
  const mod = (n, size) => ((n % size) + size) % size;
  const lights = [], casts = [];
  for (let y = -mod(sy + Math.floor(time * 2), 64); y < VIEW_H; y += 64) for (let x = -mod(sx + Math.floor(time * 5), 64); x < VIEW_W; x += 64) ctx.drawImage(water, 0, 0, 64, 64, x, y, 64, 64);
  const tx0 = Math.floor(sx / TILE), ty0 = Math.floor(sy / TILE);
  for (let ty = ty0; ty <= ty0 + VIEW_H / TILE; ty++) for (let tx = tx0; tx <= tx0 + VIEW_W / TILE + 1; tx++) {
    if (ty >= MAP_H || tx >= MAP_W || WORLD.ground[ty][tx] !== "L") continue;
    ctx.drawImage(lavaFlow, mod(tx * TILE + Math.floor(time * 4), 64), mod(ty * TILE + Math.floor(time * 2), 64), TILE, TILE, tx * TILE - sx, ty * TILE - sy, TILE, TILE);
    if ((tx + ty) % 2 === 0) lights.push({ x: centre(tx), y: centre(ty), r: 34, kind: "fire", a: 0.16 });
  }
  const pieces = [];
  for (let cy = Math.floor(sy / CHUNK_PIXELS); cy <= Math.floor((sy + VIEW_H - 1) / CHUNK_PIXELS); cy++) for (let cx = Math.floor(sx / CHUNK_PIXELS); cx <= Math.floor((sx + VIEW_W - 1) / CHUNK_PIXELS); cx++) pieces.push({ chunk: groundChunk(cx, cy), x: cx * CHUNK_PIXELS - sx, y: cy * CHUNK_PIXELS - sy });
  for (const piece of pieces) if (!piece.chunk.dry) ctx.drawImage(piece.chunk.shore, piece.x, piece.y);
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 1.8);
  for (const piece of pieces) if (!piece.chunk.dry) ctx.drawImage(piece.chunk.foam, piece.x, piece.y);
  ctx.globalAlpha = 1;
  for (const piece of pieces) ctx.drawImage(piece.chunk.ground, piece.x, piece.y);
  const list = [];
  const put = (img, x, y, sort, sway, scale) => list.push({ img: img, x: Math.round(x - sx), y: Math.round(y - sy), sort: sort, sway: sway, scale: scale });
  const cast = (img, x, y) => casts.push({ img: img, x: Math.round(x - sx), y: Math.round(y - sy) });
  for (let ty = Math.max(0, ty0 - 1); ty <= Math.min(MAP_H - 1, ty0 + VIEW_H / TILE + 5); ty++) {
    for (const thing of rows[ty]) {
      if (thing.x + thing.img.width < sx || thing.x > sx + VIEW_W) continue;
      const o = thing.o;
      if (o.type === "pickup") {
        if (state.taken["p" + o.id]) continue;
        put(thing.img, thing.x, thing.y - 3 - Math.abs(Math.sin(time * 3 + o.x)) * 4, thing.by);
        lights.push({ x: thing.bx, y: thing.by - 10, r: 30, kind: "warm", a: 0.5 });
        continue;
      }
      const bands = SWAY[o.type];
      put(o.type === "berrybush" && time - pickedAt[o.id] < 40 ? SPR.bush[0] : thing.img, thing.x, thing.y, thing.by, bands ? { bands: bands, by: Math.sin(time * 1.4 + thing.bx * 0.06 + thing.by * 0.04) * 1.8 } : null);
      if (o.type !== "peak") cast(thing.img, thing.bx, thing.by - 1);
      if (o.type === "lantern") lights.push({ x: thing.bx, y: thing.by - 17, r: 40, kind: "warm", a: 0.3 });
      if (o.type === "mushroom") lights.push({ x: thing.bx, y: thing.by - 8, r: 22, kind: "cyan", a: 0.3 });
    }
  }
  const person = function (who, set) {
    const img = set[who.dir][who.moving ? Math.floor(who.anim * 8) % 4 : 0];
    put(img, who.x - 10, who.y - 31, who.y);
    cast(img, who.x, who.y + 1);
  };
  for (const npc of STORY.npcs) if (SPR[npc.look]) person({ x: npc.px, y: npc.py, dir: 0, moving: false }, SPR[npc.look]);
  person(me, SPR.kid);
  if (state.team.length) {
    const img = picture(lead().id);
    put(img, buddy.x - 16, buddy.y - 30 - Math.abs(Math.sin(buddy.hop)) * 3, buddy.y - 1);
    cast(img, buddy.x, buddy.y + 1);
  }
  for (const w of wilds) {
    if (w.away > 0 || w.x < sx - 20 || w.x > sx + VIEW_W + 20 || w.y < sy - 20 || w.y > sy + VIEW_H + 34) continue;
    const img = picture(w.id);
    put(img, w.x - 16, w.y - 30 - Math.abs(Math.sin(time * 5 + w.homeX)) * 2, w.y);
    cast(img, w.x, w.y + 1);
    if (w.still) lights.push({ x: w.x, y: w.y - 14, r: 46, kind: "magic", a: 0.6 });
  }
  for (const g of guardians) {
    if (g.x < sx - 60 || g.x > sx + VIEW_W + 60 || g.y < sy - 20 || g.y > sy + VIEW_H + 80) continue;
    const giant = SPR.brutes[g.def.look];
    if (!giant) continue;
    const img = giant.frames[Math.floor(time * 2) % 2];
    put(img, g.x - giant.w / 2, g.y - giant.feet, g.y);
    cast(img, g.x, g.y - giant.feet + img.height);
    if (!state.badges[g.def.id]) lights.push({ x: g.x, y: g.y - giant.feet / 2, r: 70, kind: "magic", a: 0.35 });
  }
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
    if (!item.sway) {
      ctx.drawImage(item.img, item.x, item.y);
      continue;
    }
    const [a, b] = item.sway.bands;
    const w = item.img.width, h = item.img.height;
    ctx.drawImage(item.img, 0, b, w, h - b, item.x, item.y + b, w, h - b);
    ctx.drawImage(item.img, 0, a, w, b - a, item.x + Math.round(item.sway.by / 2), item.y + a, w, b - a);
    ctx.drawImage(item.img, 0, 0, w, a, item.x + Math.round(item.sway.by), item.y, w, a);
  }
  for (const bit of bits) {
    ctx.globalAlpha = Math.min(1, bit.life * 3);
    ctx.fillStyle = bit.colour;
    ctx.fillRect(Math.round(bit.x - sx), Math.round(bit.y - sy), 2, 2);
  }
  ctx.globalCompositeOperation = "lighter";
  for (const light of lights) {
    ctx.globalAlpha = Math.min(1, light.a);
    ctx.drawImage(SPR.glow[light.kind], light.x - sx - light.r, light.y - sy - light.r, light.r * 2, light.r * 2);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}
function drawBattle() {
  const mine = lead(), foe = battle.foe;
  const sky = ctx.createLinearGradient(0, 0, 0, 230);
  sky.addColorStop(0, "#8fd4ff");
  sky.addColorStop(0.55, "#dff3ff");
  sky.addColorStop(0.56, "#8fd070");
  sky.addColorStop(1, "#5cae4c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const pad = function (x, y, w, colour) {
    ctx.fillStyle = "#4a9a40";
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.28, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(x, y - 3, w - 6, w * 0.24, 0, 0, 6.283);
    ctx.fill();
  };
  pad(360, 118, 76, "#a8e088");
  pad(116, 214, 92, "#a8e088");
  const jolt = battle.shake > 0 ? Math.round((Math.random() - 0.5) * 8) : 0;
  const show = function (c, x, y, size) {
    if (c.hp <= 0 || (c.flash > 0 && Math.floor(time * 16) % 2)) return;
    ctx.drawImage(picture(c.id), x, y + Math.round(Math.sin(time * 3 + x) * 2), size, size);
  };
  show(foe, 312 + (foe.flash > 0 ? jolt : 0), 22, 96);
  show(mine, 56 + (mine.flash > 0 ? jolt : 0), 96, 128);
  const info = function (c, x, y) {
    panel(x, y, 196, 44);
    words(DEX[c.id].name, x + 10, y + 9);
    words("L" + c.lv, x + 186, y + 9, "#fff27a", 8, "right");
    ctx.fillStyle = KIND_COLOUR[DEX[c.id].kind];
    ctx.fillRect(x + 10, y + 23, 40, 11);
    words(KINDS[DEX[c.id].kind], x + 30, y + 25, "#ffffff", 6, "center");
    hpBar(c, x + 56, y + 25, 96);
    if (c === mine) words(c.hp + "", x + 186, y + 24, "#ffffff", 7, "right");
  };
  info(foe, 14, 14);
  info(mine, 270, 168);
  panel(8, 226, 464, 88);
  if (battle.text) {
    wrapped(battle.text, 22, 240, 430);
    if (Math.floor(time * 3) % 2) words("▼", 448, 294, "#fff27a");
    return;
  }
  wrapped(battle.menu === "swap!" ? "Who will you send out next?" : battle.menu === "swap" ? "Swap to which Wildling?" : "What will " + DEX[mine.id].name + " do?", 22, 240, 190);
  menuOptions().forEach(function (option, n) {
    words((n === pick ? "▶" : " ") + option.text, 226, 238 + n * 13, option.off ? "#8a8ca8" : n === pick ? "#fff27a" : "#ffffff", 7);
  });
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
  words("Caught " + caughtCount() + " of " + TOTAL + "   Badges " + Object.keys(state.badges).length + "/" + guardians.length + "   At the ranch: " + state.stored, 240, 290, "#fff27a", 7, "center");
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

function update(dt) {
  time += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) el("toast").hidden = true;
  for (const bit of bits) {
    bit.life -= dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
  }
  bits = bits.filter((bit) => bit.life > 0);
  if (mode === "walk") updateWalk(dt);
  else if (mode === "battle") updateBattle(dt);
  else if (mode === "choose") {
    if (tapped("right")) pick = (pick + 1) % 3;
    if (tapped("left")) pick = (pick + 2) % 3;
    if (chose()) {
      const first = newCreature([1, 4, 7][pick], 5);
      state.team = [first];
      see(first.id, true);
      mode = "walk";
      sfx.win();
      showCard(["You and " + DEX[first.id].name + " are partners now!", "Wild creatures roam the land. Walk into one to battle it. Wear it down, then throw a capture orb.", "They get stronger the further you go from home. Berry bushes and villagers heal your team. Good luck!"], save);
    }
  } else if (mode === "team") {
    if (tapped("right") || tapped("down")) pick = (pick + 1) % state.team.length;
    if (tapped("left") || tapped("up")) pick = (pick + state.team.length - 1) % state.team.length;
    if (chose() && pick > 0 && state.team[pick].hp > 0) {
      state.team.unshift(state.team.splice(pick, 1)[0]);
      pick = 0;
      sfx.good();
    }
    if (wentBack()) mode = "walk";
  } else if (mode === "dex" && (pressed("KeyZ") || wentBack() || chose())) mode = "walk";
}
function draw() {
  if (mode === "battle") drawBattle();
  else if (mode === "team") drawTeam();
  else if (mode === "dex") drawDex();
  else if (mode === "choose") drawChoose();
  else drawWalk();
  const quiet = mode !== "walk";
  if (quiet && !el("prompt").hidden) el("prompt").hidden = true;
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
  if (saved) {
    state = Object.assign(state, saved);
    Object.assign(me, { x: state.x || HOME.x, y: state.y || HOME.y });
    if (!canStand(me.x, me.y)) Object.assign(me, { x: HOME.x, y: HOME.y });
    Object.assign(buddy, { x: me.x - 14, y: me.y });
    mode = "walk";
    wakeMystery();
  } else {
    state = { team: [], stored: 0, dex: {}, orbs: 10, badges: {}, taken: {}, x: 0, y: 0 };
    mode = "choose";
    pick = 0;
  }
}
el("start").addEventListener("click", () => begin(null));
el("continue").addEventListener("click", () => begin(loadSave()));
el("continue").hidden = !loadSave();
requestAnimationFrame(frame);

// Only for testing the game.
window.WL = {
  get state() { return state; },
  get battle() { return battle; },
  get mode() { return mode; },
  me: me, keys: keys, wilds: wilds, guardians: guardians, DEX: DEX, picture: picture, newCreature: newCreature, startBattle: startBattle, maxHp: maxHp, card: () => card, mystery: () => mystery,
};
