// Wildlings: Wind Isles. You sail a little boat between eight windy islands, catch and train Wildlings,
// win a Wind Chime from the Keeper of each island, and then sail into the storm to become the Wind Champion.
// The Wildlings are in creatures.js and the islands are in world.js. This file runs the game on a flat map;
// view3d.js shows it all in 3D.

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
  hairStyle: ["short", "long", "ponytail", "spiky", "bun", "curly", "bald"],
  hair: ["#2b2118", "#4a3020", "#7a4a26", "#c8a04a", "#e8d8a0", "#d8483a", "#3ab8e8", "#e870b0", "#8a5ad0", "#e8e8f0"],
  hat: ["none", "cap", "beanie", "straw hat"],
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

// ----- The map on the screen -----
// Draw the map in a square on the screen: centred on (cx, cy) in squares, showing "across" squares.
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
  ctx.fillStyle = "#2f7ac8";
  ctx.fillRect(x, y, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(seaMap, x + size / 2 - cx * 2 * k, y + size / 2 - cy * 2 * k, MAP * 2 * k, MAP * 2 * k);
  ctx.imageSmoothingEnabled = false;
  if (state.chimes < 6) {                 // the wall of storm round Storm's Eye
    const [sx, sy] = toScreen(ISLES[7].at.x * TILE, ISLES[7].at.y * TILE);
    ctx.strokeStyle = "rgba(120,90,200,0.9)";
    ctx.fillStyle = "rgba(90,70,160,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, STORM_WALL * 2 * k, 0, 6.2832);
    ctx.fill();
    ctx.stroke();
  }
  const [bx, by] = toScreen(state.boat.x, state.boat.y);      // your boat: a little white sail
  ctx.fillStyle = "#1d1730";
  ctx.fillRect(Math.round(bx) - 3, Math.round(by) - 3, 7, 7);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(bx) - 2, Math.round(by) - 2, 5, 5);
  for (const home of state.homes) {       // your homes: little red houses
    const [hx, hy] = toScreen(home.x, home.y);
    ctx.fillStyle = "#1d1730";
    ctx.fillRect(Math.round(hx) - 4, Math.round(hy) - 4, 9, 9);
    ctx.fillStyle = "#e0503a";
    ctx.fillRect(Math.round(hx) - 3, Math.round(hy) - 3, 7, 7);
    ctx.fillStyle = "#ffe9a0";
    ctx.fillRect(Math.round(hx) - 1, Math.round(hy), 3, 3);
  }
  for (const giant of giants) {           // giants, at night
    const [gx, gy] = toScreen(giant.x, giant.y);
    ctx.fillStyle = Math.floor(time * 4) % 2 ? "#ff3c5a" : "#7a2ad8";
    ctx.fillRect(Math.round(gx) - 3, Math.round(gy) - 3, 7, 7);
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
const SAVE_NAME = "windIslesSave";
// Where your boat waits at each jetty: the first spot out from the jetty where it floats freely
for (const jetty of JETTIES) {
  jetty.berth = { x: jetty.x + 16, y: jetty.y + 30 };
  for (let step = 0; step < 30 && !canSail(jetty.berth.x, jetty.berth.y); step++) jetty.berth.y += 4;
}
const freshState = () => ({ name: "Sailor", team: [], stored: 0, dex: {}, orbs: 8, coins: 0, shells: 0, chimes: 0, champion: false, beaten: [], wood: 0, homes: [], x: 0, y: 0, boat: { x: JETTIES[0].berth.x, y: JETTIES[0].berth.y }, sailing: false, outfit: firstOutfit() });
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
const SHELL_PRICE = 20, ORB_PRICE = 100;

// ----- Everything that moves -----
const pal = { x: START.x - 14, y: START.y, hop: 0, flash: 0, dash: null, charge: null };      // your Wildling, out beside you
const boat = { face: Math.PI, speed: 0, rock: 0 };       // your sailing boat (where it is gets saved, in state.boat)
let cool = [0, 0, 0, 0];     // how long until each of your four moves is ready again
let coolFull = [1, 1, 1, 1]; // (how long each of those waits started at, for drawing the timers)
let learnQueue = [];         // new moves waiting for you to choose which old move to forget
let learning = null;         // the one you are choosing about right now
let surge = 0;               // the Starburst meter, 0 to 100
let surging = 0;             // seconds of Starburst left
let foes = [];               // wild creatures, and the creature a trainer has sent out
let fight = null;            // a trainer battle that is going on
let shots = [];
let floats = [];             // numbers and words that float up
let marks = [];              // warnings on the ground: where an attack is about to land
let bits = [];
let time = 0;
let clock = 0.08;            // 0 to 0.6 is day, 0.6 to 1 is night
let nights = 0;
let mode = "title";          // title, outfit, arrive, choose, play, team, dex, types, map
let arriveTime = 0, arriveDone = false;       // for sailing in to the jetty at the start
let pick = 0;
const isNight = () => clock >= 0.6;
const rnd = (a, b) => a + Math.random() * (b - a);

// ----- The wind -----
// The wind blows across the whole sea, and slowly swings round to a new direction now and then.
// It matters twice: your boat is fast with the wind behind it and slow against it,
// and an attack that travels WITH the wind hits a quarter harder.
const wind = { angle: 0.9, want: 0.9, next: 35 };        // "angle" is the way the wind blows TOWARDS (0 is east, a quarter turn is south)
const windX = () => Math.cos(wind.angle), windY = () => Math.sin(wind.angle);
const WIND_NAMES = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
const windName = () => WIND_NAMES[((Math.round(wind.angle / (Math.PI / 4)) % 8) + 8) % 8];
function updateWind(dt) {
  if ((wind.next -= dt) <= 0) {
    wind.next = rnd(40, 70);
    wind.want = wind.angle + rnd(1, 2.4) * (Math.random() < 0.5 ? 1 : -1);
  }
  wind.angle += (wind.want - wind.angle) * Math.min(1, dt * 0.3);
}
// Is the wind blowing from one place towards another? (Used for attacks.)
function windBehind(fromX, fromY, toX, toY) {
  const far = Math.hypot(toX - fromX, toY - fromY) || 1;
  return ((toX - fromX) / far) * windX() + ((toY - fromY) / far) * windY() > 0.5;
}

// ----- Wild Wildlings -----
// They live on every island, mostly in the patches of tall grass
function spawnWild(isle) {
  for (let tries = 0; tries < 90; tries++) {
    const angle = rnd(0, 6.283), far = rnd(0, isle.r * 0.95);
    const tx = Math.floor(isle.at.x + Math.cos(angle) * far), ty = Math.floor(isle.at.y + Math.sin(angle) * far);
    const tile = tiles[ty][tx];
    if (tile !== TALL && !(tile === GRASS && tries > 40)) continue;
    if (Math.hypot(tx - isle.village.x, ty - isle.village.y) < 10) continue;
    const kind = isle.kinds[Math.floor(Math.random() * isle.kinds.length)];
    const lv = Math.round(rnd(isle.lv[0], isle.lv[1]));
    const family = familiesOf[kind][Math.floor(Math.random() * familiesOf[kind].length)];
    return { c: newCreature(idFor(family, lv), lv), x: tx * TILE + 8, y: ty * TILE + 10, vx: 0, vy: 0, park: isle, wild: true, angry: false, think: 0, next: rnd(1, 2), wind: null, flash: 0, gone: 0 };
  }
}
for (const isle of ISLES) for (let n = 0; n < (isle.n === 0 ? 5 : 7); n++) {
  const foe = spawnWild(isle);
  if (foe) foes.push(foe);
}
// Sea shells wash up on the beaches. Pick them up and sell them at a shop.
let shells = [];
function scatterShells() {
  shells = [];
  for (let tries = 0; tries < 4000 && shells.length < 72; tries++) {
    const isle = ISLES[Math.floor(Math.random() * ISLES.length)], angle = rnd(0, 6.283), far = edgeOf(isle, angle) - rnd(0.6, BEACH - 0.5);
    const x = (isle.at.x + Math.cos(angle) * far) * TILE, y = (isle.at.y + Math.sin(angle) * far) * TILE;
    if (tileAt(x, y) === SAND && shells.filter((shell) => isleAt(shell.x, shell.y) === isle).length < 9) shells.push({ x: x, y: y });
  }
}

// ----- Night, and your homes -----
// When night falls, giant sea Wildlings rise out of the ocean and sweep away anyone they find.
// The only safe place is close to a home you have built. A home costs wood, which you gather from palm trees,
// and you need one on every island where you want to stay the night.
const GIANT_IDS = [9, 18, 51, 42, 59];     // the Wildlings that rise at night: the biggest ones in the sea
let gathered = new Set();                  // the trees you have already taken wood from today
let giants = [];
let duskTold = false;
const homeOn = (isle) => state.homes.find((home) => home.n === isle.n);
const safeAtHome = () => !state.sailing && state.homes.some((home) => Math.hypot(home.x - me.x, home.y - me.y) < HOME_SAFE);
// A home takes up four squares of the map, so nobody walks through its walls
function placeHome(home) {
  const tx = Math.round(home.x / TILE), ty = Math.round(home.y / TILE);
  for (const dy of [-1, 0]) for (const dx of [-1, 0]) tiles[ty + dy][tx + dx] = HUT;
}
// Build a home just in front of you (H). It needs wood, and a clear bit of grass or sand.
function buildHome() {
  const isle = isleAt(me.x, me.y);
  if (state.sailing || !isle) return toast("You can only build a home on an island.", 3);
  if (homeOn(isle)) return toast("You already have a home on " + isle.name + ".", 3);
  if (state.wood < HOME_COST) return toast("A home needs " + HOME_COST + " wood, and you have " + state.wood + ". Press Space next to palm trees to gather wood.", 5);
  const tx = Math.round((me.x + Math.sin(me.face) * 44) / TILE), ty = Math.round((me.y + Math.cos(me.face) * 44) / TILE);
  const home = { x: tx * TILE, y: ty * TILE, n: isle.n };
  let clear = [-1, 0].every((dy) => [-1, 0].every((dx) => [SAND, GRASS, TALL].includes(tiles[ty + dy][tx + dx])));
  const tooNear = (place, gap) => Math.hypot(place.x - home.x, place.y - home.y) < gap;
  if (HUTS.some((hut) => tooNear(hut, 80)) || people.some((who) => tooNear(who, 50)) || JETTIES.some((jetty) => tooNear(jetty, 70)) || RAIDS.some((rift) => tooNear(rift, 70)) || tooNear(spotOf(isle.shrine), 90)) clear = false;
  if (!clear) return toast("There isn't room for a home just there. Face a clear patch of grass or sand and try again.", 4);
  state.wood -= HOME_COST;
  state.homes.push(home);
  placeHome(home);
  sfx.win();
  burst(home.x, home.y, ["#ffd890", "#ffffff", "#b07a44"], 50, 130);
  toast("You built a home on " + isle.name + "! Stay close to it at night and the giants can't find you. Space at the door: rest or sleep.", 7);
  save();
}
// Night falls: the giants rise out of the sea round the island you are on (or round your boat)
function giantSpot(k) {
  const isle = nearestIsle(me.x, me.y), angle = k * 1.571 + 0.6 + nights;
  if (state.sailing && !isleAt(me.x, me.y)) return { x: me.x + Math.cos(angle) * 330, y: me.y + Math.sin(angle) * 330 };
  const far = (edgeOf(isle, angle) + WADE + 5) * TILE;
  return { x: isle.at.x * TILE + Math.cos(angle) * far, y: isle.at.y * TILE + Math.sin(angle) * far };
}
function raiseGiants() {
  giants = [0, 1, 2, 3].map(function (k) {
    const sea = giantSpot(k);
    return { id: GIANT_IDS[(k + nights) % GIANT_IDS.length], x: sea.x, y: sea.y, sea: sea, rise: 0, face: 0, k: k };
  });
}
// The giants hunt you whenever you are outside at night. Close to your home they lose sight of you and wade back out to sea.
function updateGiants(dt) {
  if (!isNight()) return false;
  if (!giants.length) raiseGiants();
  const hidden = safeAtHome(), busy = !!(fight || raid);
  for (const giant of giants) {
    giant.rise = Math.min(1, giant.rise + dt * 0.45);
    if (Math.hypot(giant.x - me.x, giant.y - me.y) > 1000) Object.assign(giant, giantSpot(giant.k), { sea: giantSpot(giant.k), rise: 0 });      // (you have gone somewhere else: it rises again near you)
    const goal = hidden || busy ? giant.sea : me, dx = goal.x - giant.x, dy = goal.y - giant.y, far = Math.hypot(dx, dy);
    const speed = hidden ? 70 : busy ? 0 : state.sailing ? 150 : 100;
    if (far > 4 && giant.rise >= 1) {
      giant.x += (dx / far) * Math.min(far, speed * dt);
      giant.y += (dy / far) * Math.min(far, speed * dt);
    }
    giant.face = Math.atan2(me.x - giant.x, me.y - giant.y);
    if (!hidden && !busy && giant.rise >= 1 && Math.hypot(giant.x - me.x, giant.y - me.y) < 48) {
      sweptAway(giant);
      return true;
    }
  }
  return false;
}
// Caught by a giant: you are swept all the way back to where your adventure started
function sweptAway(giant) {
  if (fight) endFight(false);
  if (raid) endRaid(false);
  for (const foe of foes) foe.angry = false;
  marks = [];
  shots = [];
  giants = [];
  const lost = Math.floor(state.coins / 2);
  state.coins -= lost;
  state.wood = 0;
  state.sailing = false;
  boat.speed = 0;
  Object.assign(state.boat, JETTIES[0].berth);
  Object.assign(me, { x: START.x, y: START.y, face: Math.PI });
  Object.assign(pal, { x: me.x - 14, y: me.y, dash: null, charge: null });
  healTeam();
  clock = 0.02;                           // (it is morning again, so you have a whole day to get ready for the next night)
  nights++;
  duskTold = false;
  gathered = new Set();
  scatterShells();
  fillRaids();
  sfx.boom();
  showCard(["A giant " + DEX[giant.id].name + " rises out of the black water. A wave as tall as a house crashes down... and everything goes dark.",
    "You wake up on the sand at Kite Cove, right back where your adventure started. It is morning.",
    "The sea took all your wood" + (lost ? " and " + lost + " of your coins" : "") + ". Your Wildlings, your Wind Chimes and your homes are safe.",
    "Next time, be close to a home you have built before night falls. No home on the island? Gather " + HOME_COST + " wood from palm trees (Space) and press H."]);
  save();
}

// ----- The people of the isles -----
// The Keeper of each island guards a Wind Chime. (The numbers in "kinds" are types, and "lv" lists their team's levels.)
const KEEPERS = [null,
  { name: "Keeper Fern", kinds: [2, 6], lv: [8, 10], hello: "The breeze told me you were coming! Let's see if your Wildlings can dance in it." },
  { name: "Keeper Marina", kinds: [1, 5], lv: [14, 15, 16], hello: "The tide waits for nobody. Show me you can keep up with it!" },
  { name: "Keeper Ash", kinds: [0, 9], lv: [21, 22, 23], hello: "A hot wind blows off my volcano. Can you stand the heat?" },
  { name: "Keeper Volt", kinds: [3, 7], lv: [28, 29, 30], hello: "Storm clouds gather over my reef every night. My team hits like lightning!" },
  { name: "Keeper Crystal", kinds: [4, 11, 8], lv: [35, 36, 36, 37], hello: "The north wind is cold and clever. So am I." },
  { name: "Keeper Zephyr", kinds: [10, 6, 8], lv: [42, 43, 43, 44], hello: "Up here the wind never stops. Neither do my dragons!" },
  { name: "Champion Tempest", kinds: [10, 3, 9, 6, 1], lv: [48, 49, 50, 51, 52], hello: "So you sailed through my storm. Nobody has done that in years. Show me the wind is with you!" },
];
// Make a team: one Wildling for each level in the list, taking the types in turn
function teamOf(kinds, levels) {
  return levels.map(function (lv, n) {
    const families = familiesOf[kinds[n % kinds.length]];
    return newCreature(idFor(families[(n + lv) % families.length], lv), lv);
  });
}
// Everyone looks the same each time you play: their outfit is worked out from a number
function outfitFor(seed) {
  const outfit = {};
  Object.keys(OUTFIT).forEach((part, i) => (outfit[part] = Math.floor(hash(seed, i, 77) * OUTFIT[part].length)));
  return outfit;
}
const people = [];
const TRAINER_NAMES = ["Sailor Finn", "Diver Coral", "Kite-flyer Pip", "Fisher Nell", "Surfer Kai", "Lookout Mira", "Deckhand Sol", "Explorer Wren", "Climber Jo", "Stargazer Lune", "Drummer Tam", "Shell-hunter Bea", "Windchaser Ravi", "Rower Odo", "Storm-watcher Ike"];
const HELLOS = ["I never go out after dark. The giants from the sea would get me!", "Six pieces of wood and the H key: that's all a home takes.", "With the wind behind your boat you fly along. Against it, you crawl!", "An attack that goes the same way as the wind hits harder. Watch the wind dial!", "Fire beats Grass, Water beats Fire, and Grass beats Water.", "Sell your sea shells at the shop, then buy capture orbs.", "The rest hut heals your Wildlings for free.", "New shells wash up on the beaches every morning.", "They say a legendary Wildling of the wind visits the storm rifts.", "You can hop out of your boat anywhere the water is shallow.", "Lost your boat? Whistle for it at any jetty.", "Press T to see which types beat which.", "Wilder Wildlings live on the islands further round the sea.", "Only someone with all six Wind Chimes can sail into Storm's Eye."];
// Find a place to stand near a square: the square itself if it is free, or else the nearest free one
function standNear(tx, ty) {
  for (let far = 0; far < 8; far++) for (let dy = -far; dy <= far; dy++) for (let dx = -far; dx <= far; dx++) {
    const kind = tiles[ty + dy][tx + dx];
    if ((kind === GRASS || kind === SAND || kind === TALL) && canStand((tx + dx) * TILE + 8, (ty + dy) * TILE + 10)) return { x: (tx + dx) * TILE + 8, y: (ty + dy) * TILE + 10 };
  }
  return { x: tx * TILE + 8, y: ty * TILE + 10 };
}
people.push({ role: "captain", name: "Captain Mistral", x: START.x + 44, y: START.y - 22, dir: 0, anim: 0, moving: false, outfit: { skin: 2, hairStyle: 1, hair: 9, hat: 1, hatColour: 3, topStyle: 2, top: 3, bottomStyle: 0, bottom: 1, shoes: 0 } });
ISLES.forEach(function (isle, n) {
  if (n > 0) {
    const at = spotOf(isle.shrine);
    people.push({ role: n === 7 ? "champion" : "keeper", n: n, name: KEEPERS[n].name, x: at.x - 8, y: at.y, dir: 0, anim: 0, moving: false, outfit: outfitFor(100 + n) });
  }
  // Trainers stand about on the island and battle you when you come close
  [[7, 0.06], [-9, -0.16]].slice(0, n === 0 ? 1 : 2).forEach(function ([dx, dy], k) {
    const at = standNear(isle.at.x + dx, Math.round(isle.at.y + isle.r * dy));
    const size = n < 2 ? 1 : n < 5 ? 2 : 3, top = Math.max(3, isle.lv[1] - 1 + k);
    people.push({ role: "trainer", id: n * 10 + k, name: TRAINER_NAMES[n * 2 + k - (n === 0 ? 0 : 1)], x: at.x, y: at.y, dir: k ? 2 : 1, anim: 0, moving: false, outfit: outfitFor(200 + n * 10 + k),
      team: teamOf(isle.kinds, Array.from({ length: size }, (unused, i) => top - (size - 1 - i))), prize: 40 + top * 6, beaten: false });
  });
  // One islander strolls about each village and will give you a tip
  people.push({ role: "villager", name: "an islander", home: { x: (isle.at.x + 3) * TILE, y: (isle.village.y + 2) * TILE }, x: (isle.at.x + 3) * TILE, y: (isle.village.y + 2) * TILE, dir: 0, anim: 0, moving: false, walk: 0, hello: n, outfit: outfitFor(300 + n) });
});
function updatePeople(dt) {
  for (const who of people) {
    if (who.role === "villager" && !fight && Math.hypot(who.x - me.x, who.y - me.y) < 600) {
      if ((who.walk -= dt) <= 0) {
        who.walk = rnd(1.5, 4);
        who.dir = Math.floor(Math.random() * 4);
        who.moving = Math.random() < 0.6;
      }
      if (Math.hypot(who.x - me.x, who.y - me.y) < 26) who.moving = false;        // (they stop to chat if you come close)
      if (who.moving) {
        const nx = who.x + DIRS[who.dir][0] * 28 * dt, ny = who.y + DIRS[who.dir][1] * 28 * dt;
        if (canStand(nx, ny) && tileAt(nx, ny) !== SHALLOW && Math.hypot(nx - who.home.x, ny - who.home.y) < 110) Object.assign(who, { x: nx, y: ny });
        else who.walk = 0;
        who.anim += dt * 5.4;
      }
    }
    if (who.role === "trainer" && !who.beaten && !fight && !raid && !state.sailing && awake().length && Math.hypot(who.x - me.x, who.y - me.y) < 54) startFight(who, false);
  }
}
// The next thing to do, in words and as a place on the map
const nextIsle = () => (state.champion ? null : ISLES[Math.min(7, state.chimes + 1)]);
function goalText() {
  if (state.champion) return "You are the Wind Champion!";
  const isle = nextIsle();
  return isle.n === 7 ? "Sail into Storm's Eye and face Champion Tempest!" : "Sail to " + isle.name + " and win the Wind Chime from " + KEEPERS[isle.n].name + ".";
}
function goalSpot() {
  const isle = nextIsle();
  if (!isle) return null;
  const here = isleAt(me.x, me.y) === isle && !state.sailing;
  return here ? { x: spotOf(isle.shrine).x, y: spotOf(isle.shrine).y, name: isle.n === 7 ? "Champion" : "Wind Shrine" } : { x: isle.jetty.x, y: isle.jetty.y, name: isle.name };
}

// ----- Storm rifts (raids) -----
// Three glowing portals stand on the outer boulevard. Inside each waits a GIANT, rare Wildling:
// a fully grown one you can't find in the parks. Beat it in a raid battle and it joins you.
const RAIDS = [1, 4, 7].map(function (n) {
  const at = standNear(Math.round(ISLES[n].at.x - ISLES[n].r * 0.5), ISLES[n].at.y + 2);
  return { x: at.x, y: at.y, open: true, id: 3 };
});
let raid = null;
function fillRaids() {
  for (const portal of RAIDS) {
    portal.open = true;
    portal.id = Math.floor(Math.random() * FAMILY_COUNT) * 3 + 3;
  }
  // Legendary Wildlings come to the rifts once you have enough Wind Chimes. The mythical one comes only for the Champion.
  if (state.chimes >= 3 && state.dex[58] !== 2) RAIDS[0].id = 58;
  if (state.chimes >= 6 && state.dex[59] !== 2) RAIDS[1].id = 59;
  if (state.champion && state.dex[60] !== 2) RAIDS[2].id = 60;
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
  toast("RAID! A giant " + DEX[c.id].name + " bursts out of the storm rift! Watch for its huge attacks.", 5);
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
  state.shells += 8;
  sfx.win();
  burst(actor.x, actor.y - 20, ["#ffffff", "#fff27a", "#c87aff"], 80, 160);
  showCard(["RAID WON! The giant " + DEX[c.id].name + " shrinks down... and joins you!" + (fresh ? " That's a new one for your Wilddex (" + caughtCount() + " of " + TOTAL + ")." : ""), (state.team.includes(c) ? "It is on your team now." : "Your team is full, so it went to the ranch.") + " You also get 8 sea shells. The rift will open again tomorrow."]);
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
  // An attack that travels with the wind hits a quarter harder
  const hitter = to ? pal : foes.find((foe) => foe.c === from) || pal, struck = to || pal;
  const gust = kind >= 0 && windBehind(hitter.x, hitter.y, struck.x, struck.y) ? 1.25 : 1;
  const damage = Math.max(1, Math.round((3 + from.lv * 0.6) * (strength / 9) * (power(from) / guard(victim)) * strong * boost * gust * rnd(0.85, 1)));
  victim.hp = Math.max(0, victim.hp - damage);
  const at = to || pal;
  at.flash = 0.3;
  sfx.hit();
  float(at.x, at.y - 30, damage + (strong > 1 ? " SUPER!" : strong < 1 ? " weak" : "") + (gust > 1 ? " +WIND" : ""), to ? (strong > 1 ? "#fff27a" : "#ffffff") : "#ff8a8a");
  burst(at.x, at.y - 12, [KIND_COLOUR[Math.max(0, kind)], "#ffffff"], 8, 70);
  if (to) {
    to.angry = true;
    if (surging <= 0) surge = Math.min(100, surge + 6 + damage * 0.6);
    if (victim.hp === 0) foeFainted(to);
  } else if (victim.hp === 0) palFainted();
}
function gainXp(c, amount) {
  c.xp += amount;
  let grew = false, learned = [];
  while (c.lv < 60 && c.xp >= xpToGrow(c)) {
    c.xp -= xpToGrow(c);
    const before = maxHp(c);
    c.lv++;
    c.hp += maxHp(c) - before;
    grew = true;
    learned = learned.concat(learnMoves(c));
  }
  if (!grew) return;
  sfx.good();
  toast(DEX[c.id].name + " grew to level " + c.lv + (learned.length ? " and learned " + learned.join(" and ") + "! Press " + c.moves.length + " to use it." : "!"), learned.length ? 5 : 3);
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
    state.coins += 5 + foe.c.lv;
    float(foe.x, foe.y - 44, "+" + (5 + foe.c.lv) + " coins", "#fff27a");
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
    cool = [1, 1, 1, 1];
    return;
  }
  // Nobody left: back to the island's rest hut
  if (fight) endFight(false);
  if (raid) endRaid(false);
  for (const foe of foes) foe.angry = false;
  marks = [];
  shots = [];
  const hut = restHutNear(me.x, me.y);
  Object.assign(me, { x: hut.x, y: hut.y + 6 });
  Object.assign(pal, { x: me.x - 14, y: me.y });
  healTeam();
  toast("All your Wildlings fainted! You wake up in the rest hut, and everyone is healed.", 5);
}
function startFight(trainer, promo) {
  fight = { trainer: trainer, left: trainer.team.slice(), actor: null, wait: 0.9, promo: promo };
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
  if (trainer.role === "champion") {
    state.champion = true;
    state.coins += 1000;
    healTeam();
    fillRaids();
    showCard(["YOU DID IT! You beat Champion Tempest. " + state.name.toUpperCase() + " is the new WIND CHAMPION of the Gale Isles!", "Tempest: \"The storm has been waiting for someone like you. Listen... it is calming down already.\"", "You win 1000 coins. They say a mythical Wildling only shows itself to a Champion. Look for a new storm rift here on Storm's Eye...", "You can keep sailing, and try to catch all " + TOTAL + " Wildlings."]);
  } else if (trainer.role === "keeper") {
    state.chimes = trainer.n;
    state.coins += 150 + trainer.n * 50;
    healTeam();
    fillRaids();
    showCard(["You beat " + trainer.name + "! You win WIND CHIME number " + state.chimes + " of 6, and " + (150 + trainer.n * 50) + " coins.", trainer.name + ": \"Hang it on your mast and the wind will know you.\"", state.chimes === 6 ? "All six Wind Chimes ring together... and far away, the wall of storm round Storm's Eye opens for your boat!" : "Next: " + goalText()]);
  } else {
    trainer.beaten = true;
    state.beaten.push(trainer.id);
    state.coins += trainer.prize;
    toast("You beat " + trainer.name + "! You win " + trainer.prize + " coins.", 5);
  }
  save();
}
const restHutNear = (x, y) => HUTS.filter((hut) => !hut.shop).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
// Your Wildling's moves: it knows up to four, on keys 1 to 4
function useMove(n) {
  const aim = target(), c = lead(), move = MOVE_LIST[c.moves[n]];
  if (!move) return;                    // (it hasn't learned a move for this key yet)
  if (!aim || c.hp <= 0 || cool[n] > 0 || pal.dash || pal.charge) return;
  const far = Math.hypot(aim.x - pal.x, aim.y - pal.y);
  const fast = surging > 0 ? 0.6 : 1;
  if (move.style === "dash") {
    if (far > 180) return float(pal.x, pal.y - 34, "too far!", "#bfe8ff");
    pal.dash = { t: 0, fx: pal.x, fy: pal.y, aim: aim, move: move };
  } else if (move.style === "shot") {
    const angle = Math.atan2(aim.y - pal.y, aim.x - pal.x);
    shots.push({ x: pal.x, y: pal.y - 12, vx: Math.cos(angle) * 230, vy: Math.sin(angle) * 230, life: 1.5, mine: true, aim: aim, from: c, strength: move.power, kind: move.kind });
    sfx.zap();
  } else {
    pal.charge = { t: 0.5, aim: aim, move: move };
    sfx.warn();
  }
  cool[n] = coolFull[n] = move.cool * fast;
  float(pal.x, pal.y - 40, move.name, move.kind < 0 ? "#ffffff" : blend(KIND_COLOUR[move.kind], "#ffffff", 0.45));
}
// When a Wildling reaches a new level it may learn a move. With four already, you choose which one to forget.
function learnMoves(c) {
  const learned = [];
  for (const [level, move] of learnsOf(c.id)) {
    if (level !== c.lv || c.moves.includes(move)) continue;
    if (c.moves.length < 4) {
      c.moves.push(move);
      learned.push(MOVE_LIST[move].name);
    } else learnQueue.push({ c: c, move: move });
  }
  return learned;
}
function throwOrb() {
  const aim = target();
  if (!aim) return;
  if (aim.raid) return toast("Beat the raid Wildling first. Then it will join you!", 3);
  if (!aim.wild) return toast("You can't catch a trainer's Wildling!", 2);
  if (state.orbs <= 0) return toast("No capture orbs left! Sell sea shells at a shop and buy some more.", 3);
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
let hudText = "", stormTold = 0;
function updatePlay(dt) {
  if (card) return updateCard();
  if (pressed("KeyX")) return ((mode = "team"), (pick = 0));
  if (pressed("KeyZ")) return (mode = "dex");
  if (pressed("KeyT")) return (mode = "types");
  if (pressed("KeyO") && !fight && !state.sailing) return ((mode = "outfit"), (pick = 0));
  if (pressed("KeyM")) return (mode = "map");
  // The clock: day turns to night and back again. Every morning, new shells wash up and the storm rifts open again.
  const wasNight = isNight();
  if (!fight) clock += dt / 420;
  if (clock >= 1) {
    clock -= 1;
    nights++;
    giants = [];
    duskTold = false;
    gathered = new Set();
    scatterShells();
    if (!raid) fillRaids();
    toast("Morning! The giants have sunk back under the sea. New shells have washed up, and the trees have new wood.", 5);
  } else if (!duskTold && clock >= 0.5) {
    duskTold = true;
    const here = isleAt(me.x, me.y);
    sfx.alert();
    toast(here && homeOn(here) && !state.sailing ? "The sun is setting. Head back to your home before dark!" : state.sailing ? "The sun is setting! Sail to an island where you have a home, or land and build one, before the giants rise!" : "The sun is setting, and you have no home on this island! Gather " + HOME_COST + " wood from palm trees (Space) and press H to build one. Quickly!", 8);
  } else if (!wasNight && isNight()) {
    raiseGiants();
    sfx.boom();
    toast(safeAtHome() ? "Night has fallen, and giant sea Wildlings are rising out of the ocean. You are safe near your home. Space at the door: sleep until morning." : "NIGHT HAS FALLEN! Giant sea Wildlings are rising out of the ocean. Get to a home you have built!", 8);
  }
  if (updateGiants(dt)) return;
  if (pressed("KeyH") && !fight && !raid) buildHome();
  updateWind(dt);
  // Sea shells: walk over one to pick it up
  if (!state.sailing) for (const shell of shells.slice()) if (Math.hypot(shell.x - me.x, shell.y - me.y) < 22) {
    shells.splice(shells.indexOf(shell), 1);
    state.shells++;
    sfx.good();
    float(shell.x, shell.y - 30, "+1 sea shell", "#fff27a");
    burst(shell.x, shell.y - 8, ["#ffd0e0", "#ffffff"], 12, 70);
  }
  // You
  // W and S go forwards and backwards (the way the camera looks), A and D go sideways, the arrows turn the camera
  look -= ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 2.4 * dt;
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), across = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  me.moving = ahead !== 0 || across !== 0;
  const ax = -Math.sin(look) * ahead + Math.cos(look) * across, ay = -Math.cos(look) * ahead - Math.sin(look) * across, length = Math.hypot(ax, ay) || 1;
  if (state.sailing) {
    // Sailing: steer the boat the way you want to go. The wind decides how fast it gets there!
    for (const code of ["Digit1", "Digit2", "Digit3", "Digit4", "KeyJ", "KeyK", "KeyL", "Semicolon", "KeyE", "KeyF", "KeyQ"]) justPressed[code] = false;      // (no battling from the boat)
    if (me.moving) {
      let turn = Math.atan2(ax, ay) - boat.face;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      boat.face += turn * Math.min(1, dt * 3.5);
    }
    const hx = Math.sin(boat.face), hy = Math.cos(boat.face);
    const withWind = hx * windX() + hy * windY();                 // 1: the wind is right behind you. -1: you are sailing straight into it.
    boat.speed += ((me.moving ? 125 * (1 + 0.6 * withWind) : 0) - boat.speed) * Math.min(1, dt * 1.6);
    boat.rock += dt * (1 + boat.speed / 60);
    const nx = state.boat.x + hx * boat.speed * dt, ny = state.boat.y + hy * boat.speed * dt;
    const storm = state.chimes < 6 && Math.hypot(nx / TILE - ISLES[7].at.x, ny / TILE - ISLES[7].at.y) < STORM_WALL;
    if (storm && time > stormTold) {
      stormTold = time + 6;
      sfx.alert();
      toast("A wall of storm wind pushes your boat back! You need all 6 Wind Chimes to sail into Storm's Eye.", 5);
    }
    if (storm) boat.speed = -60;                                  // (blown back out)
    else {
      const from = { x: state.boat.x, y: state.boat.y };
      if (canSail(nx, state.boat.y)) state.boat.x = nx;
      if (canSail(state.boat.x, ny)) state.boat.y = ny;
      if (Math.hypot(state.boat.x - from.x, state.boat.y - from.y) < Math.abs(boat.speed) * dt * 0.5) boat.speed *= 0.8;       // (bumping against the shore slows you down)
    }
    Object.assign(me, { x: state.boat.x, y: state.boat.y, face: boat.face, moving: false });
    Object.assign(pal, { x: me.x, y: me.y });
  } else if (me.moving) {
    const speed = keys.ShiftLeft || keys.ShiftRight ? 150 : 105;
    if (canStand(me.x + (ax / length) * speed * dt, me.y)) me.x += (ax / length) * speed * dt;
    if (canStand(me.x, me.y + (ay / length) * speed * dt)) me.y += (ay / length) * speed * dt;
    me.face = Math.atan2(ax, ay);
    me.running = !!(keys.ShiftLeft || keys.ShiftRight);
    me.anim += dt * (me.running ? 14 : 9.4);          // (how fast your legs go: quicker when you run)
  }
  // Your Wildling: it follows you, dashes in to attack, and charges up its big move
  const c = lead();
  for (let n = 0; n < 4; n++) cool[n] = Math.max(0, cool[n] - dt);
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
      if (dash.aim.gone <= 0) strike(c, dash.aim, dash.move.power, dash.move.kind);
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
      const aim = pal.charge.aim, blast = pal.charge.move;
      pal.charge = null;
      sfx.boom();
      burst(aim.x, aim.y - 8, [KIND_COLOUR[Math.max(0, blast.kind)], "#ffffff", "#fff27a"], 60, 150);
      for (const foe of foes.slice()) if (foe.gone <= 0 && (foe.angry || !foe.wild || foe === aim) && Math.hypot(foe.x - aim.x, foe.y - aim.y) < 50) strike(c, foe, blast.power, blast.kind);
    }
  }
  if (pressed("Digit1", "KeyJ")) useMove(0);
  if (pressed("Digit2", "KeyK")) useMove(1);
  if (pressed("Digit3", "KeyL")) useMove(2);
  if (pressed("Digit4", "Semicolon")) useMove(3);
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
    cool = [1, 1, 1, 1];
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
      if (!foe.angry && far < 46 && !state.sailing) {
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
  updatePeople(dt);
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
  // Things to do with Space: sail, hop out, rest, shop, talk, start a raid, or whistle for your boat
  const onFoot = !state.sailing;
  const hut = onFoot && HUTS.find((each) => Math.hypot(each.x - me.x, each.y - me.y) < 20);
  const who = onFoot && people.find((each) => each.role !== "trainer" && Math.hypot(each.x - me.x, each.y - me.y) < 30);
  const rift = onFoot && !raid && RAIDS.find((portal) => portal.open && Math.hypot(portal.x - me.x, portal.y - me.y) < 40);
  const boatNear = onFoot && Math.hypot(state.boat.x - me.x, state.boat.y - me.y) < 38;
  const jetty = onFoot && !boatNear && JETTIES.find((each) => Math.hypot(each.x - me.x, each.y - me.y) < 44);
  const canLand = state.sailing && !!landingSpot();
  const home = onFoot && state.homes.find((each) => Math.hypot(each.x - me.x, each.y - me.y) < 52);
  const treeAt = onFoot ? trees.findIndex((tree, n) => !gathered.has(n) && Math.hypot(tree.x - me.x, tree.y - me.y) < 30) : -1;
  if (raid && Math.hypot(raid.portal.x - me.x, raid.portal.y - me.y) > 380) {
    endRaid(false);
    toast("You ran too far from the rift, so the raid is over.", 3);
  }
  const ask = fight || raid ? "" : state.sailing ? (canLand ? "Space: hop out of the boat" : "")
    : rift ? "Space: start the RAID (a giant " + DEX[rift.id].name + ")"
    : hut && hut.shop ? "Space: sell your " + state.shells + " sea shells for " + state.shells * SHELL_PRICE + " coins     B: buy 5 orbs for " + ORB_PRICE + " coins (you have " + state.coins + ")"
    : hut ? "Space: rest in the hut (heals your team)" : who ? (who.role === "villager" ? "Space: say hello" : "Space: talk to " + who.name)
    : home ? (clock >= 0.5 ? "Space: sleep in your home until morning" : "Space: rest in your home (heals your team)")
    : boatNear ? "Space: sail away in your boat" : treeAt >= 0 ? "Space: gather wood from this tree (you have " + state.wood + ", a home needs " + HOME_COST + ")" : jetty ? "Space: whistle for your boat" : "";
  if (el("prompt").textContent !== ask) {
    el("prompt").textContent = ask;
    el("prompt").hidden = !ask;
  }
  if (pressed("KeyB") && ask && hut && hut.shop) {
    if (state.coins < ORB_PRICE) toast("You need " + ORB_PRICE + " coins. Sell some sea shells, or win some battles!", 3);
    else {
      state.coins -= ORB_PRICE;
      state.orbs += 5;
      sfx.good();
      toast("You bought 5 capture orbs. (" + state.orbs + " orbs, " + state.coins + " coins left)", 3);
      save();
    }
  }
  if (chose() && ask) {
    if (state.sailing) hopOut();
    else if (rift) startRaid(rift);
    else if (hut && hut.shop) {
      if (!state.shells) toast("You have no sea shells to sell. Look for them on the beaches.", 3);
      else {
        state.coins += state.shells * SHELL_PRICE;
        toast("You sold " + state.shells + " sea shells for " + state.shells * SHELL_PRICE + " coins! (" + state.coins + " coins)", 4);
        state.shells = 0;
        sfx.good();
        save();
      }
    } else if (hut) {
      healTeam();
      sfx.good();
      toast("A nap in the hammock. Your whole team is healed!", 3);
      save();
    } else if (who) talkTo(who);
    else if (home) {
      healTeam();
      sfx.good();
      if (clock >= 0.5) {
        clock = 1;                        // (straight to morning)
        toast("You bolt the door and sleep soundly while the giants prowl outside...", 4);
      } else toast("A rest at home. Your whole team is healed!", 3);
      save();
    } else if (boatNear) {
      state.sailing = true;
      boat.speed = 0;
      Object.assign(me, { x: state.boat.x, y: state.boat.y });
      sfx.good();
      toast("You are sailing! The wind is blowing " + windName() + ". Go with it and you fly along.", 4);
    } else if (treeAt >= 0) {
      gathered.add(treeAt);
      state.wood++;
      sfx.good();
      float(trees[treeAt].x, trees[treeAt].y - 30, "+1 wood", "#e8c890");
      burst(trees[treeAt].x, trees[treeAt].y, ["#b07a44", "#e8c890"], 10, 60);
      if (state.wood === HOME_COST) toast("You have " + HOME_COST + " wood: enough for a home! Face a clear patch of ground and press H.", 5);
    } else if (jetty) {
      Object.assign(state.boat, jetty.berth);
      sfx.good();
      toast("You whistle... and your boat bobs up to the jetty.", 3);
      save();
    }
  }
  const isle = isleAt(me.x, me.y);
  const where = state.sailing ? (isle ? "Sailing by " + isle.name : "Sailing the Gale Sea") + " (wind blowing " + windName() + ")" : isle ? isle.name + " (wild levels " + isle.lv[0] + " to " + isle.lv[1] + ")" : "the Gale Sea";
  const homeNote = !isle || state.sailing ? "" : homeOn(isle) ? " You have a home here." : " NO HOME HERE: gather " + HOME_COST + " wood (Space at palm trees) and press H to build one before night!";
  const top = [c.id, c.lv, c.hp, state.chimes, state.champion, state.coins, state.shells, state.orbs, state.wood, caughtCount(), where, isNight(), homeNote].join("|");
  if (top !== hudText) {
    hudText = top;
    el("hearts").textContent = (state.champion ? "WIND CHAMPION" : "Wind Chimes " + state.chimes + "/6") + " · " + state.coins + " coins";
    el("rings").textContent = "Orbs " + state.orbs + " · Shells " + state.shells + " · Wood " + state.wood + " · Caught " + caughtCount() + "/" + TOTAL;
    el("place").textContent = (isNight() ? "☾ " : "☀ ") + where + ". " + goalText() + homeNote;
  }
}
// Is there somewhere to stand close to the boat, on the side nearest the island? (You can hop out into shallow water.)
function landingSpot() {
  const isle = nearestIsle(state.boat.x, state.boat.y), dx = isle.at.x * TILE - state.boat.x, dy = isle.at.y * TILE - state.boat.y, far = Math.hypot(dx, dy) || 1;
  for (let step = 0; step <= 56; step += 8) {
    const x = state.boat.x + (dx / far) * step, y = state.boat.y + (dy / far) * step;
    if (canStand(x, y)) return { x: x, y: y, isle: isle };
  }
  return null;
}
// Climb out of the boat into the shallows (it stays where you leave it)
function hopOut() {
  const spot = landingSpot();
  if (!spot) return;
  state.sailing = false;
  boat.speed = 0;
  Object.assign(me, { x: spot.x, y: spot.y });
  Object.assign(pal, { x: spot.x - 12, y: spot.y });
  sfx.good();
  toast("You splash ashore on " + spot.isle.name + ". Your boat will wait here.", 3);
  save();
}
function talkTo(who) {
  if (who.role === "villager") {
    return toast("Islander: \"" + (state.champion && who.hello % 3 === 0 ? "Look, it's " + state.name + ", the Wind Champion! Can I shake your hand?" : HELLOS[(who.hello + nights) % HELLOS.length]) + "\"", 5);
  }
  if (who.role === "captain") {
    return showCard(state.champion ? ["Mistral: \"Wind Champion " + state.name + "! I always knew that little boat would carry you far.\""]
      : ["Mistral: \"You have " + state.chimes + " of the 6 Wind Chimes. " + goalText() + "\"", "\"And never be caught outside at night! Build a home on each island you visit: " + HOME_COST + " wood from the palm trees, then press H.\"", "\"Remember: the wind dial shows which way the wind blows. Sail WITH it, and attack WITH it. The yellow diamond on your map shows the way.\""]);
  }
  const info = KEEPERS[who.n], last = who.role === "champion";
  if (last ? state.champion : state.chimes >= who.n) return showCard([who.name + ": \"" + (last ? "The storm is calm, thanks to you, Champion." : "My Wind Chime is yours already. " + goalText()) + "\""]);
  if (state.chimes < Math.min(who.n - 1, 6)) return showCard([who.name + ": \"You are not ready for me yet. You have " + state.chimes + " Wind Chimes, and you need " + (who.n - 1) + ". " + goalText() + "\""]);
  showCard([who.name + ": \"" + info.hello + "\"", last ? "\"This is the last battle. Win, and you are the Wind Champion. It starts NOW!\"" : "\"Beat my team and the Wind Chime of " + ISLES[who.n].name + " is yours. It starts NOW!\""], function () {
    healTeam();
    who.team = teamOf(info.kinds, info.lv);
    startFight(who, true);
  });
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
    hpBar(c, x + 74, y + 36, 84);
    words(c.hp + "/" + maxHp(c), x + 162, y + 36, "#ffffff", 5);
    c.moves.forEach(function (id, k) {          // its moves, each in the colour of its type
      const move = MOVE_LIST[id];
      words(move.name, x + 74 + (k % 2) * 76, y + 49 + Math.floor(k / 2) * 10, move.kind < 0 ? "#d8d8e8" : blend(KIND_COLOUR[move.kind], "#ffffff", 0.45), 4);
    });
  });
  words("Arrows: choose   Space: make leader   X: close", 240, 272, "#ffffff", 7, "center");
  words("Caught " + caughtCount() + " of " + TOTAL + "   " + (state.champion ? "WIND CHAMPION" : "Wind Chimes " + state.chimes + "/6") + "   At the ranch: " + state.stored, 240, 290, "#fff27a", 7, "center");
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


// ----- Drawing the game -----
// The 3D world is drawn by view3d.js. On top of it, this draws the words and bars.
function drawPlay() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  const aim = target();
  const over = function (x, y, high, text, colour, size) {         // words floating above a place in the world
    const at = VIEW.project(x, y, high);
    if (at) words(text, at.x, at.y, colour, size, "center");
  };
  const near = (place, far) => Math.hypot(place.x - me.x, place.y - me.y) < far;
  for (const who of people) {
    if (!near(who, 420)) continue;
    if (who.role === "trainer" && !who.beaten && !fight) over(who.x, who.y, 30 + Math.sin(time * 6) * 2, "!", "#ff5a5a", 10);
    else if (who.role !== "trainer" && who.role !== "villager" && fight?.trainer !== who) over(who.x, who.y, 33, who.name, "#fff27a", 6);
  }
  for (const foe of foes) if (foe.gone <= 0 && foe.wind && Math.floor(time * 14) % 2) over(foe.x, foe.y, 38, "!", "#ff5a5a", 10);
  if (fight) over(fight.trainer.x, fight.trainer.y, 30, fight.trainer.name, "#ffffff", 6);
  for (const portal of RAIDS) if (portal.open && !(raid && raid.portal === portal) && near(portal, 520)) over(portal.x, portal.y, 54, (DEX[portal.id].legend ? "LEGENDARY RAID: " : DEX[portal.id].myth ? "MYTHICAL RAID: " : "RAID: ") + DEX[portal.id].name, "#e0a0ff", 6);
  for (const hut of HUTS) if (near(hut, 260)) over(hut.x, hut.y - 26, 40, hut.shop ? "SHOP" : "REST HUT", hut.shop ? "#9ac4ff" : "#7af0a0", 6);
  for (const isle of ISLES) if (isle.n > 0 && near(spotOf(isle.shrine), 300)) over(spotOf(isle.shrine).x, spotOf(isle.shrine).y - 20, 62, isle.n === 7 ? "The Eye of the Storm" : "Wind Shrine", "#ffd84a", 6);
  if (!state.sailing && near(state.boat, 320)) over(state.boat.x, state.boat.y, 44, "Your boat", "#ffffff", 5);
  for (const home of state.homes) if (near(home, 420)) over(home.x, home.y, 46, "Your home", "#ffd890", 6);
  for (const giant of giants) if (near(giant, 800)) over(giant.x, giant.y, 150 * giant.rise, "GIANT " + DEX[giant.id].name.toUpperCase(), "#ff7a7a", 6);
  if (isNight() && !fight && !raid) {
    const safe = safeAtHome();
    words(safe ? "Safe at home. Space at the door: sleep until morning." : "DANGER! GIANTS! Get to a home you have built!", 240, 58, safe ? "#7af0a0" : Math.floor(time * 5) % 2 ? "#ff5a5a" : "#ffd84a", safe ? 6 : 8, "center");
  } else if (clock >= 0.5 && !isNight()) words("The sun is setting... night is coming!", 240, 58, "#ffd890", 6, "center");
  const goal = fight || raid ? null : goalSpot();
  // The mini-map in the corner: the streets around you, with north at the top
  drawMap(382, 8, 90, me.x / TILE, me.y / TILE, 46, goal);
  words("N", 427, 10, "#1d1730", 6, "center");
  if (goal) words(goal.name + " " + Math.round(Math.hypot(goal.x - me.x, goal.y - me.y) / TILE), 427, 104, "#fff27a", 6, "center");
  words("M: big map", 427, goal ? 114 : 104, "#ffffff", 5, "center");
  // The wind dial: the arrow points the way the wind is blowing (north is up, like the map)
  ctx.fillStyle = "#1d1730";
  ctx.beginPath();
  ctx.arc(356, 28, 19, 0, 6.2832);
  ctx.fill();
  ctx.fillStyle = "#e8f6ff";
  ctx.beginPath();
  ctx.arc(356, 28, 17, 0, 6.2832);
  ctx.fill();
  ctx.save();
  ctx.translate(356, 28);
  ctx.rotate(wind.angle);
  ctx.fillStyle = "#2a8ad8";
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(2, -8);
  ctx.lineTo(2, -3);
  ctx.lineTo(-13, -3);
  ctx.lineTo(-13, 3);
  ctx.lineTo(2, 3);
  ctx.lineTo(2, 8);
  ctx.fill();
  ctx.restore();
  words("WIND", 356, 50, "#ffffff", 5, "center");
  if (state.sailing) {
    const withWind = Math.sin(boat.face) * windX() + Math.cos(boat.face) * windY();
    words(Math.round(Math.abs(boat.speed) / 9) + " knots", 356, 60, "#fff27a", 6, "center");
    words(withWind > 0.4 ? "wind behind you!" : withWind < -0.4 ? "against the wind" : "wind from the side", 356, 70, withWind > 0.4 ? "#7af0a0" : withWind < -0.4 ? "#ff9a8a" : "#ffffff", 5, "center");
  }
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2.5);
    over(f.x, f.y + 30, 26 + (0.9 - f.life) * 24, f.text, f.colour, 7);
  }
  ctx.globalAlpha = 1;
  if (surge >= 100 && surging <= 0 && state.team.length) words("F: STARBURST!", 60, 258, Math.floor(time * 6) % 2 ? "#fff27a" : "#ff7ab0", 7);
  // On-screen bars: your Wildling, its three attacks, the Starburst meter, and the foe you are fighting
  if (!state.team.length) return;
  const c = lead();
  panel(6, 268, 300, 46);
  words((surging > 0 ? "Star " : "") + DEX[c.id].name + " L" + c.lv, 14, 275, surging > 0 ? "#fff27a" : "#ffffff", 7);
  hpBar(c, 14, 287, 92);
  words(c.hp + "/" + maxHp(c), 14, 298, "#bfe8ff", 6);
  ctx.fillStyle = "#1d1730";
  ctx.fillRect(64, 297, 42, 7);
  ctx.fillStyle = surging > 0 ? "#ffffff" : surge >= 100 ? (Math.floor(time * 6) % 2 ? "#fff27a" : "#ff7ab0") : "#b06af0";
  ctx.fillRect(65, 298, Math.round(40 * (surging > 0 ? surging / 12 : surge / 100)), 5);
  // The four move buttons: each shows its key, its name and the colour of its type. A grey shade drains away while it gets ready again.
  for (let n = 0; n < 4; n++) {
    const x = 114 + n * 46, move = MOVE_LIST[c.moves[n]], ready = move && cool[n] <= 0;
    ctx.fillStyle = !move ? "#2a3250" : move.kind < 0 ? "#8a8ca8" : blend(KIND_COLOUR[move.kind], "#000000", 0.18);
    ctx.globalAlpha = ready ? 1 : 0.4;
    ctx.fillRect(x, 276, 43, 30);
    ctx.globalAlpha = 1;
    words(String(n + 1), x + 3, 278, move ? "#ffffff" : "#5a6488", 6);
    if (move) {
      const parts = move.name.split(" ");
      words(move.style === "dash" ? "dash" : move.style === "shot" ? "shot" : "BLAST", x + 40, 279, "#fff6c8", 4, "right");
      words(parts[0], x + 21, 288, "#ffffff", 5, "center");
      if (parts[1]) words(parts[1], x + 21, 296, "#ffffff", 5, "center");
    } else words("-", x + 21, 290, "#5a6488", 6, "center");
    if (move && cool[n] > 0) {
      ctx.fillStyle = "rgba(20,16,50,0.7)";
      ctx.fillRect(x, 276, 43, Math.round(30 * Math.min(1, cool[n] / coolFull[n])));
    }
  }
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

// A Wildling with four moves wants to learn a fifth: choose which one to forget (or not to learn the new one)
function drawLearn() {
  const c = learning.c, fresh = MOVE_LIST[learning.move];
  ctx.fillStyle = "#24304e";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(picture(c.id), 20, 14, 72, 72);
  words(DEX[c.id].name + " wants to learn", 104, 24, "#ffffff", 8);
  words(fresh.name.toUpperCase() + "!", 104, 42, "#fff27a", 10);
  words("But it already knows four moves.", 104, 62, "#bfe8ff", 6);
  words("Choose one to forget:", 104, 74, "#bfe8ff", 6);
  c.moves.concat([learning.move]).forEach(function (id, n) {
    const move = MOVE_LIST[id], y = 96 + n * 36 + (n === 4 ? 8 : 0), on = n === pick;
    panel(40, y, 400, 31);
    if (on) {
      ctx.strokeStyle = "#fff27a";
      ctx.lineWidth = 2;
      ctx.strokeRect(41, y + 1, 398, 29);
    }
    words((on ? "▶ " : "  ") + (n === 4 ? "Don't learn " + move.name : "Forget " + move.name), 50, y + 7, on ? "#fff27a" : "#ffffff", 7);
    ctx.fillStyle = move.kind < 0 ? "#8a8ca8" : blend(KIND_COLOUR[move.kind], "#000000", 0.25);
    ctx.fillRect(330, y + 5, 56, 11);
    words(move.kind < 0 ? "Normal" : KINDS[move.kind], 358, y + 8, "#ffffff", 5, "center");
    words(move.style + "   power " + move.power + "   ready in " + move.cool + "s", 50, y + 20, "#bfe8ff", 5);
  });
  words("Up, down: choose     Space: decide", 240, 306, "#ffffff", 6, "center");
}

// The big map (M): the whole sea on one screen
function drawBigMap() {
  ctx.fillStyle = "#24304e";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  words("THE GALE ISLES", 96, 12, "#fff27a", 8, "center");
  drawMap(184, 12, 288, MAP / 2, MAP / 2, MAP, goalSpot());
  for (const isle of ISLES) words(isle.name, 184 + isle.at.x * 0.9, 12 + (isle.at.y + isle.r * 1.3) * 0.9, "#ffffff", 5, "center");
  const key = function (y, colour, text) {
    ctx.fillStyle = colour;
    ctx.fillRect(12, y, 8, 8);
    words(text, 26, y, "#ffffff", 6);
  };
  key(34, "#ff5a3a", "You");
  key(47, "#ffffff", "Your boat");
  key(60, "#2f9a4c", "Rest huts (heal)");
  key(73, "#3a6ad8", "Shops");
  key(86, "#ffd84a", "Wind Shrines");
  key(99, "#a050f0", "Storm rifts (raids)");
  key(112, "#e0503a", "Your homes");
  ISLES.forEach((isle, n) => words(isle.name + " L" + isle.lv[0] + "-" + isle.lv[1], 12, 128 + n * 10, state.chimes >= n && n > 0 && n < 7 ? "#ffd84a" : "#9af0a0", 5));
  words("(gold: chime won)", 12, 211, "#bfe8ff", 5);
  words(state.champion ? "WIND CHAMPION" : "Wind Chimes " + state.chimes + "/6", 12, 228, "#fff27a", 6);
  words("Wind blowing " + windName(), 12, 242, "#ffffff", 5);
  words(isNight() ? "It is night." : "It is day.", 12, 256, "#ffffff", 6);
  words("M: close", 12, 296, "#ffffff", 6);
}

function drawOutfit() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  panel(8, 12, 236, 296);
  words("DESIGN YOUR SAILOR", 126, 24, "#fff27a", 9, "center");
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
  if (mode === "play" && learnQueue.length && !card && !pal.dash && !pal.charge) {
    learning = learnQueue.shift();
    mode = "learn";
    el("toast").hidden = true;
    pick = 4;
    sfx.good();
  }
  if (mode === "play") updatePlay(dt);
  else if (mode === "learn") {
    if (tapped("down")) pick = (pick + 1) % 5;
    if (tapped("up")) pick = (pick + 4) % 5;
    if (chose()) {
      const c = learning.c, fresh = MOVE_LIST[learning.move];
      if (pick === 4) toast(DEX[c.id].name + " did not learn " + fresh.name + ".", 4);
      else {
        toast(DEX[c.id].name + " forgot " + MOVE_LIST[c.moves[pick]].name + " and learned " + fresh.name + "! It is on key " + (pick + 1) + ".", 5);
        c.moves[pick] = learning.move;
      }
      learning = null;
      mode = "play";
      save();
    }
  }
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
        mode = "arrive";          // you sail in to Kite Cove
        arriveTime = 0;
        state.sailing = true;
      }
    }
  } else if (mode === "arrive") {
    // The start of the game: your little boat sails in to the jetty at Kite Cove
    arriveTime += dt;
    updateWind(dt);
    const part = Math.min(1, arriveTime / 5), eased = 1 - (1 - part) * (1 - part), berth = JETTIES[0].berth;
    Object.assign(state.boat, { x: berth.x + (1 - eased) * 90, y: berth.y + (1 - eased) * 640 });
    Object.assign(boat, { face: Math.PI - (1 - eased) * 0.14, speed: (1 - eased) * 150, rock: boat.rock + dt * 2 });
    Object.assign(me, { x: state.boat.x, y: state.boat.y, face: boat.face });
    if (card) updateCard();
    else if (arriveTime > 6.4 && !arriveDone) {
      arriveDone = true;
      showCard(["After three days at sea, an island! Your little boat bumps against the jetty at KITE COVE, in the Gale Isles.", "An old sea captain is waiting on the sand, holding on to her hat in the wind.", "Mistral: \"You must be " + state.name + "! I'm Captain Mistral. Nobody sails these seas alone: every sailor here has a Wildling for a shipmate. Come and choose yours!\""], function () {
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
      state.sailing = false;
      Object.assign(state.boat, JETTIES[0].berth);
      showCard(["You and " + DEX[first.id].name + " are shipmates now! It is a " + kindsOf(first.id) + " type.",
        "Mistral: \"Each island has a Keeper who guards a WIND CHIME. Win all six, and the storm round Storm's Eye will let you in to face the Champion.\"",
        "Battles happen in real time. Press 1 and 2 to use your Wildling's two moves. It learns more as it grows, up to four. When a red mark appears on the ground, walk away: your Wildling follows you out of danger.",
        "Types matter! Fire beats Grass, Water beats Fire, Fairy beats Dragon, and so on. A super hit does double damage.",
        "So does the WIND. An attack that travels the same way as the wind hits harder, so look at the wind dial and pick your side.",
        "Wild Wildlings hide in the tall grass. Weaken one, then press E to throw a capture orb. Sea shells from the beach sell for coins at the shop, to buy more orbs.",
        "BEWARE THE NIGHT! When it gets dark, giant sea Wildlings rise out of the ocean and sweep away anyone caught outside. The only safe place is close to a home you have built.",
        "So before dark: press Space next to palm trees to gather wood, then press H to build a home (it costs " + HOME_COST + " wood). You need a home on every island where you stay the night. Start with one here!",
        "Your boat is at the jetty, south of the village. Walk up to it and press Space to sail. Follow the yellow diamond on your map. Fair winds!"], save);
    }
  } else if (mode === "team") {
    if (tapped("right") || tapped("down")) pick = (pick + 1) % state.team.length;
    if (tapped("left") || tapped("up")) pick = (pick + state.team.length - 1) % state.team.length;
    if (chose() && pick > 0 && state.team[pick].hp > 0) {
      state.team.unshift(state.team.splice(pick, 1)[0]);
      pick = 0;
      cool = [1, 1, 1, 1];
      sfx.good();
    }
    if (wentBack()) mode = "play";
  } else if (mode === "dex" && (pressed("KeyZ") || wentBack() || chose())) mode = "play";
  else if (mode === "types" && (pressed("KeyT") || wentBack() || chose())) mode = "play";
  else if (mode === "map" && (pressed("KeyM") || wentBack() || chose())) mode = "play";
}
function draw() {
  if (mode === "play" || mode === "outfit" || mode === "title" || mode === "arrive") VIEW.render();
  if (mode === "team") drawTeam();
  else if (mode === "dex") drawDex();
  else if (mode === "types") drawTypes();
  else if (mode === "learn") drawLearn();
  else if (mode === "choose") drawChoose();
  else if (mode === "outfit") drawOutfit();
  else if (mode === "map") drawBigMap();
  else if (mode === "title" || mode === "arrive") ctx.clearRect(0, 0, VIEW_W, VIEW_H);
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
  state = saved ? Object.assign(freshState(), saved) : freshState();
  if (!saved) state.name = el("name").value.trim().slice(0, 12) || "Sailor";
  el("name").blur();
  if (!canSail(state.boat.x, state.boat.y)) Object.assign(state.boat, JETTIES[0].berth);
  Object.assign(me, { x: (saved && state.x) || START.x, y: (saved && state.y) || START.y, face: Math.PI });
  if (state.sailing) Object.assign(me, { x: state.boat.x, y: state.boat.y });
  else if (!canStand(me.x, me.y)) Object.assign(me, { x: START.x, y: START.y });
  for (const who of people) if (who.role === "trainer") who.beaten = state.beaten.includes(who.id);
  for (const home of state.homes) placeHome(home);
  giants = [];
  gathered = new Set();
  duskTold = false;
  for (const c of state.team) if (!c.moves) c.moves = movesAt(c.id, c.lv);          // (a save from before Wildlings had moves of their own)
  learnQueue = [];
  mode = saved ? "play" : "outfit";          // a new sailor first designs what they look like
  pick = 0;
  arriveDone = false;
  Object.assign(pal, { x: me.x - 14, y: me.y });
  fillRaids();
  scatterShells();
  clock = 0.03;                             // (every time you start playing, it is early morning)
}
el("start").addEventListener("click", () => begin(null));
el("continue").addEventListener("click", () => begin(loadSave()));
el("continue").hidden = !loadSave();
VIEW.build();
requestAnimationFrame(frame);

// Only for testing the game.
window.WQ = {
  get state() { return state; },
  get mode() { return mode; },
  get learning() { return learning; },
  gainXp: gainXp, giants: () => giants, buildHome: buildHome, safeAtHome: safeAtHome, gathered: () => gathered,
  get fight() { return fight; },
  get foes() { return foes; },
  get marks() { return marks; },
  get clock() { return clock; },
  set clock(value) { clock = value; },
  get zoom() { return zoom; },
  set zoom(value) { zoom = value; },
  get look() { return look; },
  set look(value) { look = value; },
  tiles: tiles, ISLES: ISLES, HUTS: HUTS, JETTIES: JETTIES, START: START, RAIDS: RAIDS, raid: () => raid, shells: () => shells, people: people, wind: wind, boat: boat,
  me: me, pal: pal, keys: keys, DEX: DEX, newCreature: newCreature, maxHp: maxHp, target: target, card: () => card, surge: (n) => (surge = n), surging: () => surging, cool: () => cool,
};
