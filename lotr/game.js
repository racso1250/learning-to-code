// The Lord of the Rings: Ring Quest.
// The story of The Hobbit and The Lord of the Rings, told as 25 levels. Each is a small land built by
// ../dragon/mapkit.js. Find the gold rings in a level (and beat its boss, if it has one) to move on.
// Finish the story to unlock Free Play: one enormous open land.

const VIEW_W = 480;
const VIEW_H = 320;
const el = (id) => document.getElementById(id);
const centre = (square) => square * TILE + TILE / 2;
const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]];

// The levels follow the two books in order. For each: the land, how many gold rings are hidden there,
// who you are, who walks with you, the boss (if that part of the story has one), and the story told in cards.
const B = "bilbo", F = "frodo";
const LEVELS = [
  // ----- THE HOBBIT -----
  { name: "Bag End", biome: "meadow", rings: 1, hero: B, friends: ["wizard"], story: ["THE HOBBIT", "In a hole in the ground there lived a hobbit: Bilbo Baggins, who liked his pipe, his garden and second breakfast.", "Then Gandalf the wizard knocked on his round green door, and thirteen dwarves ate everything in his pantry.", "Gandalf: \"Thorin's folk mean to win back their gold from Smaug the dragon. They need a burglar. I chose you.\""] },
  { name: "The Trollshaws", biome: "woods", rings: 1, hero: B, friends: ["wizard", "thorin"], boss: ["The three Trolls", "sandGiant", 14], story: ["Rain, hunger, and a fire flickering in the trees.", "Three huge trolls sit round it, arguing about how to cook dwarves.", "Thorin: \"Burglar! Go and see what you can steal.\""] },
  { name: "Rivendell", biome: "lake", rings: 1, hero: B, friends: ["wizard", "thorin"], story: ["The Last Homely House: the hidden valley of Rivendell.", "Elrond reads the moon-letters on Thorin's map. They tell of a secret door into the Lonely Mountain."] },
  { name: "The Misty Mountains", biome: "crag", rings: 2, hero: B, friends: ["wizard", "thorin"], boss: ["The Great Goblin", "bogKing", 16], story: ["A storm in the high passes. The company shelters in a cave...", "and the back of the cave opens. Goblins! Down, down to Goblin-town."] },
  { name: "Gollum's Cave", biome: "ice", rings: 1, hero: B, friends: [], story: ["Bilbo wakes alone in the dark at the roots of the mountain.", "His hand closes on something small and cold lying on the ground: a ring.", "And by a black lake, a voice whispers: \"What has it got in its pocketses, my precious?\""] },
  { name: "Mirkwood", biome: "doom", rings: 2, hero: B, friends: ["thorin"], boss: ["The Great Spider", "broodmother", 20], story: ["Mirkwood: black trees, black water, and no sun for days.", "Gandalf has gone on other business. \"Do not leave the path,\" he said. They left the path.", "Now the dwarves hang in webs, and Bilbo has only his little sword. He names it Sting."] },
  { name: "Lake-town", biome: "lake", rings: 1, hero: B, friends: ["thorin"], story: ["Out of the Elvenking's halls in barrels, down the river to Lake-town.", "Thorin: \"I am Thorin, King under the Mountain. I have come back!\"", "The people cheer. Far off, the Lonely Mountain smokes."] },
  { name: "The Lonely Mountain", biome: "ash", rings: 2, hero: B, friends: ["thorin"], boss: ["Smaug the dragon", "smaug", 30], story: ["The secret door opens on Durin's Day. A hot red glow comes up the tunnel.", "Smaug lies on a mountain of gold. \"Well, thief! I smell you. I hear your breath.\""] },
  { name: "The Battle of Five Armies", biome: "drylands", rings: 2, hero: B, friends: ["wizard", "thorin"], boss: ["Bolg of the North", "frostGiant", 26], story: ["Smaug is dead, and everyone wants his gold: men, elves, dwarves...", "and then goblins and wolves pour out of the north, and all the others stand together.", "Bilbo: \"The Eagles! The Eagles are coming!\""] },
  // ----- THE LORD OF THE RINGS -----
  { name: "The Shire", biome: "meadow", rings: 1, hero: F, friends: ["sam", "wizard"], story: ["THE LORD OF THE RINGS", "Sixty years later. Bilbo has gone away and left everything to his nephew Frodo, even his old ring.", "Gandalf: \"It is the One Ring, Frodo. The Dark Lord Sauron made it, and he wants it back. It must leave the Shire.\"", "Sam was listening at the window. So Sam is coming too."] },
  { name: "The Old Forest", biome: "pines", rings: 1, hero: F, friends: ["sam"], story: ["Black Riders are hunting on the road, so the hobbits cut through the Old Forest.", "Sam: \"I don't like these trees, Mr. Frodo. They're watching us.\""] },
  { name: "Bree", biome: "woods", rings: 1, hero: F, friends: ["sam", "aragorn"], story: ["The inn of the Prancing Pony, in Bree.", "A tall, weather-beaten man is watching from the corner. They call him Strider.", "Aragorn: \"I can take you to Rivendell by paths that are seldom trodden. Will you have me?\""] },
  { name: "Weathertop", biome: "drylands", rings: 2, hero: F, friends: ["sam", "aragorn"], boss: ["A Black Rider", "shadowKing", 22], story: ["A ruined watchtower on a lonely hill.", "In the night five dark shapes climb towards the camp-fire. The Black Riders have found them."] },
  { name: "Rivendell", biome: "lake", rings: 1, hero: F, friends: ["sam", "wizard"], story: ["Frodo wakes in Rivendell, and Gandalf is there.", "Elrond holds a council. The Ring cannot be hidden and cannot be used. It must be unmade in the fire of Mount Doom.", "Frodo: \"I will take the Ring, though I do not know the way.\" Nine set out: the Fellowship of the Ring."] },
  { name: "Caradhras", biome: "snow", rings: 1, hero: F, friends: ["sam", "aragorn"], story: ["The Fellowship tries the high pass over the mountain Caradhras.", "The snow falls until it is over the hobbits' heads. The mountain will not let them pass.", "Gimli: \"Then let us go under it. Through the Mines of Moria.\""] },
  { name: "The Mines of Moria", biome: "crag", rings: 2, hero: F, friends: ["sam", "wizard"], boss: ["The Balrog", "lavaBrute", 30], story: ["Dark halls, deep stairs, and drums in the deep: doom, doom.", "Something is coming, wrapped in shadow and flame.", "Gandalf: \"You cannot pass! Fly, you fools!\""] },
  { name: "Lothlorien", biome: "jungle", rings: 2, hero: F, friends: ["sam", "aragorn"], story: ["Gandalf fell with the Balrog into the dark. The Fellowship goes on without him, grieving.", "Under the golden trees of Lothlorien, the Lady Galadriel gives each of them a gift.", "To Frodo: a small glass of starlight. \"A light for you in dark places, when all other lights go out.\""] },
  { name: "Amon Hen", biome: "woods", rings: 1, hero: F, friends: ["sam"], story: ["The Ring is pulling the Fellowship apart. Frodo decides to go on alone.", "Sam: \"Not without your Sam, you don't!\"", "Two small hobbits cross the river and turn their faces towards Mordor."] },
  { name: "Fangorn Forest", biome: "doom", rings: 1, hero: "aragorn", friends: ["wizard"], story: ["Meanwhile, Aragorn hunts through Fangorn for his lost friends.", "An old man in white steps from the trees. It is Gandalf, come back from the dead.", "Gandalf: \"I am Gandalf the White now. And Rohan needs us.\""] },
  { name: "Helm's Deep", biome: "canyon", rings: 2, hero: "aragorn", friends: ["wizard"], boss: ["The Uruk captain", "sandGiant", 28], story: ["The fortress of Helm's Deep. Ten thousand orcs come against it in the night and the rain.", "Aragorn: \"Hold the wall until dawn. Gandalf will come.\""] },
  { name: "The Dead Marshes", biome: "marsh", rings: 2, hero: F, friends: ["sam"], story: ["Frodo and Sam have a guide now: Gollum, who carried the Ring for five hundred years, and wants it back.", "Gollum: \"Follow Smeagol! Don't follow the lights. Dead faces in the water...\""] },
  { name: "Shelob's Lair", biome: "shadow", rings: 1, hero: "sam", friends: [], boss: ["Shelob", "broodmother", 30], story: ["Gollum has led them into a tunnel that stinks of old webs. He meant to all along.", "Shelob the great spider has stung Frodo. Sam is alone, with Sting and the glass of starlight.", "Sam: \"Now come, you filth! You've hurt my master!\""] },
  { name: "The Pelennor Fields", biome: "drylands", rings: 2, hero: "aragorn", friends: ["wizard"], boss: ["The Witch-king", "shadowKing", 34], story: ["Before the white city of Minas Tirith, the greatest battle of the age.", "The Witch-king of Angmar, lord of the Black Riders, rides at the head of Sauron's army.", "Horns in the morning: Rohan has come! And up the river, Aragorn, with the banner of the King."] },
  { name: "Mount Doom", biome: "ash", rings: 2, hero: F, friends: ["sam"], boss: ["Gollum", "bogKing", 24], story: ["The last climb. Frodo can go no further.", "Sam: \"I can't carry the Ring for you, Mr. Frodo. But I can carry you!\"", "At the Crack of Doom Frodo cannot let the Ring go. And then Gollum leaps out of the shadows for his Precious..."] },
  { name: "The Grey Havens", biome: "meadow", rings: 1, hero: F, friends: ["sam", "wizard"], story: ["Gollum fell into the fire with the Ring. Sauron is gone. Aragorn is King.", "The hobbits go home to the Shire. But Frodo's hurts are deep, and at last he rides to the Grey Havens.", "A white ship waits there for Bilbo, Gandalf and Frodo. Sam watches until it is only a glimmer on the sea."] },
];
const TOTAL_RINGS = LEVELS.reduce((sum, level) => sum + level.rings, 0);
const HOBBITS = {
  frodo: { size: "teen", skin: "#f2c79a", blush: "#e89a84", hair: "#4a3020", style: "short", tunic: "#5a8a4a", trim: "#f4d06f", sleeve: "#4a7a3e", pants: "#6a4a30", boots: "#c8a078", belt: "#3a2a20", cape: "#3a5a8a" },
  sam: { size: "teen", skin: "#f2c79a", blush: "#e89a84", hair: "#c8a04a", style: "short", tunic: "#a87a4a", trim: "#f2ead8", sleeve: "#8f6238", pants: "#5a6a4a", boots: "#c8a078", belt: "#3a2a20" },
  bilbo: { size: "teen", skin: "#f2c79a", blush: "#e89a84", hair: "#7a5a30", style: "short", tunic: "#b8323f", trim: "#f4d06f", sleeve: "#f2ead8", pants: "#5a6a3a", boots: "#c8a078", belt: "#3a2a20" },
  thorin: { size: "teen", skin: "#e8b88a", hair: "#2b2b3a", style: "long", beard: "#2b2b3a", tunic: "#3d5a8a", trim: "#c8ccd4", sleeve: "#2f4a74", pants: "#3a3a46", boots: "#2a2020", belt: "#c8a050", cape: "#5a4a3a" },
  // The enemy: small quick goblins and big armoured orcs
  goblin: { size: "teen", skin: "#7a9a4a", style: "bald", tunic: "#4a3a2a", trim: "#8a8a8a", sleeve: "#3a2e22", pants: "#3a3028", boots: "#2a2020", belt: "#8a8a8a" },
  orc: { skin: "#5a7a3a", style: "bald", tunic: "#3a3a46", trim: "#aab2c0", sleeve: "#2a2a34", pants: "#2a2420", boots: "#1a1414", belt: "#b8323f" },
  aragorn: { skin: "#e8b88a", hair: "#3a2a20", style: "long", beard: "#3a2a20", tunic: "#4a5a3a", trim: "#c8a050", sleeve: "#3a4a2e", pants: "#3a3028", boots: "#2a2020", belt: "#6a4a26", cape: "#3a4a3a" },
};
function levelSpec(i) {
  const level = LEVELS[i];
  const region = { id: "land", name: level.name, biome: level.biome, bushes: 2, pickups: { item: "ring", name: "gold ring", colour: "#ffd84a", count: level.rings } };
  if (level.boss) region.features = [["sign", 2, -11, { text: "Beware: " + level.boss[0] + "!" }]];
  const bosses = level.boss ? [{ id: "boss", name: level.boss[0], look: level.boss[1], hp: level.boss[2], region: "land" }] : [];
  return { cols: 1, rows: 1, order: [[0, 0]], regions: [region], story: { dragon: ["ember", "gold"], looks: HOBBITS, steps: [], bosses: bosses, save: "x", start: {} } };
}

function sound(make) {
  try { make(); } catch (error) { /* no sound: the game still works */ }
}
const sfx = {
  swing: () => sound(() => playNoise(0, 0.08, 2400, 700, 0.12)),
  hit: () => sound(() => playTone(0, 0.08, 240, 110, 0.16)),
  hurt: () => sound(() => playTone(0, 0.22, 210, 70, 0.22)),
  ring: () => sound(() => { playTone(0, 0.12, 880, 1320, 0.14); playTone(0.12, 0.18, 1320, 1760, 0.12); }),
  bolt: () => sound(() => playTone(0, 0.12, 900, 1500, 0.06)),
  roar: () => sound(() => { playNoise(0, 0.7, 500, 90, 0.3); playTone(0, 0.7, 130, 55, 0.2); }),
  win: () => sound(() => playJingle()),
};

// ----- What the game remembers -----
const SAVE_NAME = "ringQuestSave";
function newState() {
  return { level: 0, taken: {}, rings: 0, hp: 6, unlocked: false, free: false, freeTaken: {}, gems: 0, giants: {} };
}
let state = newState();
function save() {
  try { localStorage.setItem(SAVE_NAME, JSON.stringify(state)); } catch (error) { /* keep playing */ }
}
function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_NAME));
    return saved && typeof saved.level === "number" ? Object.assign(newState(), saved) : null;
  } catch (error) { return null; }
}

// ----- Loading a land -----
startSaga(levelSpec(0));               // (the sprite kit needs a world to exist before it draws anything)
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
const bloomCanvas = makeCanvas(VIEW_W / 4, VIEW_H / 4);
const bloomCtx = bloomCanvas.getContext("2d");
const darkCopies = new Map();
const darkCopy = (img) => darkCopies.get(img) || darkCopies.set(img, tinted(img, "#1a1238")).get(img);
function drawGoldRing() {
  const a = new Art(14, 14);
  a.oval(7, 7, 5.5, 5.5, "#ffd84a");
  a.g.clearRect(5, 5, 4, 4);
  a.dot(4, 3, "#ffffff");
  return finish(a);
}
const ringArt = drawGoldRing();
// Smaug: a dragon (the sprite kit's wyrm) used as a boss
SPR.brutes.smaug = (function () {
  const frames = [SPR.wyrms.sand.fly[1][0], SPR.wyrms.sand.fly[1][2]];
  return { frames: frames, hurt: frames.map((frame) => tinted(frame, "#ffffff")), w: frames[0].width, feet: frames[0].height - 4 };
})();
const TYPES = {
  goblin: 2, orc: 4, slime: 2, bat: 1, spider: 2, golem: 5, imp: 2, bogSlime: 3, iceSlime: 3, magmaSlime: 3, scorpion: 3, wraith: 2, iceGolem: 6, sandGolem: 6, shade: 3,
};
// Give the goblins and orcs red eyes
for (const [name, eyeY] of [["goblin", 17], ["orc", 15]]) {
  SPR[name].forEach(function (frames, dir) {
    for (const frame of frames) {
      const g = frame.getContext("2d");
      g.fillStyle = "#ff3b3b";
      if (dir === 0) g.fillRect(7, eyeY, 1, 2), g.fillRect(12, eyeY, 1, 2);
      if (dir === 1) g.fillRect(7, eyeY, 1, 2);
      if (dir === 2) g.fillRect(12, eyeY, 1, 2);
    }
  });
}
const whiteCopies = new Map();
const whiteCopy = (img) => whiteCopies.get(img) || whiteCopies.set(img, tinted(img, "#ffffff")).get(img);
// In this game the slimes, bats and other little monsters are goblins and orcs instead
const ORC_KIND = { slime: "goblin", bogSlime: "goblin", iceSlime: "goblin", magmaSlime: "orc", bat: "goblin", wraith: "orc", imp: "orc", shade: "orc", scorpion: "goblin" };
// (one goblin in every three is swapped for a bigger orc, so every land has both)
const enemyFor = (spot) => (ORC_KIND[spot.type] === "goblin" && hash(spot.x, spot.y, 90) < 0.34 ? "orc" : ORC_KIND[spot.type] || spot.type);
const SPEED = { goblin: 42, orc: 30, bat: 44, spider: 50, scorpion: 52, wraith: 48, golem: 18, iceGolem: 18, sandGolem: 18 };

const frodo = { x: 0, y: 0, dir: 0, anim: 0, moving: false, swing: 0, safe: 0 };      // (whoever you are playing as in this level)
let heroLook = "frodo";
let friends = [];        // whoever is walking with you in this level
let boltTimer = 1;
let rows = [];
let monsters = [];
let shots = [];
let bits = [];
let trail = [];
let boss = null;
let cam = { x: 0, y: 0 };
let time = 0;
let playing = false;
let paused = false;
let shake = 0;
let pickedAt = {};

function loadLand(spec) {
  startSaga(spec);
  chunkCache.clear();
  rows = [];
  for (let y = 0; y < MAP_H; y++) rows.push([]);
  for (const o of WORLD.objects) {
    let img;
    if (o.type === "pickup") img = o.item === "ring" ? ringArt : SPR.gems[o.colour] || (SPR.gems[o.colour] = drawGem(o.colour));
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
  // The level's boss waits in the north of the land, not on top of you
  for (const b of STORY.bosses) if (b.id === "boss") b.y -= 10;
  const level = state.free ? { hero: "frodo", friends: ["sam", "wizard"] } : LEVELS[state.level];
  heroLook = level.hero;
  friends = level.friends.map((look, i) => ({ look: look, x: centre(PLACES.start.x) + (i ? 14 : -14), y: centre(PLACES.start.y) + 2, dir: 0, anim: 0, moving: false }));
  monsters = WORLD.monsters.filter((spot) => TYPES[spot.type]).map((spot) => ({ type: enemyFor(spot), dir: 0, step: 0, x: centre(spot.x), y: centre(spot.y), homeX: centre(spot.x), homeY: centre(spot.y), hp: TYPES[enemyFor(spot)], flash: 0, dead: 0, vx: 0, vy: 0, think: 0 }));
  Object.assign(frodo, { x: centre(PLACES.start.x), y: centre(PLACES.start.y) + 2, dir: 0 });
  shots = [];
  bits = [];
  trail = [];
  boss = null;
  pickedAt = {};
  cam.x = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, frodo.x - VIEW_W / 2));
  cam.y = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, frodo.y - VIEW_H / 2));
  hudText = "";
}
const takenHere = () => (state.free ? state.freeTaken : state.taken);

function startLevel(first) {
  state.free = false;
  loadLand(levelSpec(state.level));
  if (first) showCard(LEVELS[state.level].story.concat(["Chapter " + (state.level + 1) + " of " + LEVELS.length + ": " + LEVELS[state.level].name]), save);
}
function startFreePlay() {
  state.free = true;
  loadLand(middleLands(levelSpec(0)));
  toast("Free Play! All of Middle-earth is open. Wander where you like.", 6);
  save();
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
function burst(x, y, colours, count, speed) {
  for (let i = 0; i < count && bits.length < 400; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.3 + Math.random() * 0.7);
    bits.push({ x: x, y: y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power, life: 0.3 + Math.random() * 0.5, colour: colours[Math.floor(Math.random() * colours.length)] });
  }
}
function solidAt(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || WORLD.blocked[ty][tx];
}
const canStand = (x, y) => !solidAt(x - 4, y - 5) && !solidAt(x + 4, y - 5) && !solidAt(x - 4, y + 1) && !solidAt(x + 4, y + 1);

function walkTo(who, x, y, speed, dt) {
  const dx = x - who.x, dy = y - who.y, far = Math.hypot(dx, dy);
  who.moving = far > 1.5;
  if (!who.moving) return;
  const step = Math.min(far, speed * dt);
  who.x += (dx / far) * step;
  who.y += (dy / far) * step;
  who.anim += dt;
  who.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
}
function follow(who, gap, dt) {
  let need = gap, px = frodo.x, py = frodo.y;
  for (let n = trail.length - 1; n >= 0; n--) {
    const d = Math.hypot(trail[n].x - px, trail[n].y - py);
    if (d >= need) return walkTo(who, px + ((trail[n].x - px) * need) / d, py + ((trail[n].y - py) * need) / d, 150, dt);
    need -= d;
    px = trail[n].x;
    py = trail[n].y;
  }
  who.moving = false;
}

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
  if (Math.random() < 0.3 && state.hp < 6) state.hp++;
}
function hurtBoss(power) {
  if (!boss || !boss.awake) return;
  boss.hp -= power;
  boss.flash = 0.12;
  sfx.hit();
  el("boss-fill").style.width = Math.max(0, (boss.hp / boss.def.hp) * 100) + "%";
  if (boss.hp > 0) return;
  burst(boss.x, boss.y - 20, ["#ffffff", "#ffd84a", "#b06af0"], 80, 140);
  shake = 0.8;
  sfx.roar();
  toast(boss.def.name + " is beaten!", 4);
  if (boss.def.id === "boss") state.taken.boss = true;
  else state.giants[boss.def.id] = true;
  el("boss-bar").hidden = true;
  shots = [];
  boss = null;
  save();
  checkLevel();
}
function hurtFrodo(fromX, fromY) {
  if (frodo.safe > 0) return;
  state.hp--;
  frodo.safe = 1;
  shake = 0.3;
  sfx.hurt();
  el("hurt").style.opacity = 1;
  setTimeout(() => (el("hurt").style.opacity = 0), 150);
  const away = Math.atan2(frodo.y - fromY, frodo.x - fromX);
  for (let i = 0; i < 10; i++) if (canStand(frodo.x + Math.cos(away) * 1.5, frodo.y + Math.sin(away) * 1.5)) {
    frodo.x += Math.cos(away) * 1.5;
    frodo.y += Math.sin(away) * 1.5;
  }
  if (state.hp > 0) return;
  state.hp = 6;
  for (const who of [frodo].concat(friends)) Object.assign(who, { x: centre(PLACES.start.x), y: centre(PLACES.start.y) + 2 });
  frodo.safe = 3;
  trail = [];
  boss = null;
  shots = [];
  el("boss-bar").hidden = true;
  toast("You fell! Your friends carried you back to where you began. Your rings are safe.", 5);
}

// Has this level been finished?
function checkLevel() {
  if (state.free) return;
  const level = LEVELS[state.level];
  const found = Object.keys(state.taken).length;
  if (found < level.rings + (level.boss ? 1 : 0)) return;       // (beating the boss counts as one more thing to do)
  if (state.level < LEVELS.length - 1) {
    sfx.win();
    return showCard(["Chapter complete: " + level.name + ".", "Gold rings so far: " + state.rings + " of " + TOTAL_RINGS + "."].concat(state.level === 8 ? ["So ends THE HOBBIT. Bilbo goes home with a chest of gold, a sword called Sting... and a magic ring."] : []), function () {
      state.level++;
      state.taken = {};
      state.hp = 6;
      startLevel(true);
    });
  }
  state.unlocked = true;
  save();
  sfx.win();
  showCard(["Sam: \"Well, I'm back.\"", "THE END of The Hobbit and The Lord of the Rings.", "FREE PLAY UNLOCKED! You can wander the whole of Middle-earth."], startFreePlay);
}

let hudText = "";
function update(dt) {
  time += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) el("toast").hidden = true;
  if (shake > 0) shake -= dt;
  if (card) return updateCard();
  if (pressed("KeyP")) paused = !paused;
  if (paused) return toast("Paused. Press P to keep playing.", 0.3);
  if (frodo.safe > 0) frodo.safe -= dt;
  if (frodo.swing > 0) frodo.swing -= dt;
  let ax = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
  let ay = (held("down") ? 1 : 0) - (held("up") ? 1 : 0);
  frodo.moving = ax !== 0 || ay !== 0;
  if (frodo.moving) {
    const length = Math.hypot(ax, ay);
    if (canStand(frodo.x + (ax / length) * 84 * dt, frodo.y)) frodo.x += (ax / length) * 84 * dt;
    if (canStand(frodo.x, frodo.y + (ay / length) * 84 * dt)) frodo.y += (ay / length) * 84 * dt;
    frodo.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 1 : 2) : ay < 0 ? 3 : 0;
    frodo.anim += dt;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - frodo.x, last.y - frodo.y) > 3) {
      trail.push({ x: frodo.x, y: frodo.y });
      if (trail.length > 80) trail.shift();
    }
  }
  friends.forEach((friend, i) => follow(friend, 15 + i * 15, dt));
  // Things in front of you: someone to talk to, berries to eat
  const fx = frodo.x + DIRS[frodo.dir][0] * 12;
  const fy = frodo.y - 4 + DIRS[frodo.dir][1] * 12;
  const who = STORY.npcs.find((npc) => Math.hypot(npc.px - fx, npc.py - 4 - fy) < 18);
  let bush = null;
  let sign = null;
  for (let ty = Math.floor(fy / TILE) - 1; ty <= Math.floor(fy / TILE) + 1; ty++) for (const thing of rows[ty] || []) {
    if (Math.hypot(thing.bx - fx, thing.by - 8 - fy) > 18) continue;
    if (thing.o.type === "berrybush" && !(time - pickedAt[thing.o.id] < 40)) bush = thing.o;
    if (thing.o.type === "sign") sign = thing.o;
  }
  const label = who ? "Space: talk to " + who.name : bush ? "Space: eat some berries" : sign ? "Space: read the sign" : "";
  if (el("prompt").textContent !== label) {
    el("prompt").textContent = label;
    el("prompt").hidden = !label;
  }
  if (pressed("Space")) {
    if (who) showCard([who.name + ": \"" + who.line + "\""]);
    else if (sign) showCard([sign.text]);
    else if (bush) {
      pickedAt[bush.id] = time;
      state.hp = Math.min(6, state.hp + 2);
      toast("Berries: +2 hearts.", 2);
    } else if (frodo.swing <= 0) {
      frodo.swing = 0.25;
      sfx.swing();
      const hx = frodo.x + DIRS[frodo.dir][0] * 14, hy = frodo.y - 6 + DIRS[frodo.dir][1] * 14;
      for (const m of monsters) if (m.dead <= 0 && Math.hypot(m.x - hx, m.y - 6 - hy) < 22) hurtMonster(m, 1, frodo.x, frodo.y);
      if (boss && Math.hypot(boss.x - hx, boss.y - 12 - hy) < 38) hurtBoss(2);
    }
  }
  // Rings (and, in Free Play, gems) are picked up by walking over them
  const taken = takenHere();
  for (let ty = Math.floor(frodo.y / TILE) - 1; ty <= Math.floor(frodo.y / TILE) + 1; ty++) for (const thing of rows[ty] || []) {
    const o = thing.o;
    if (o.type !== "pickup" || taken["p" + o.id] || Math.hypot(centre(o.x) - frodo.x, centre(o.y) - frodo.y) > 14) continue;
    taken["p" + o.id] = true;
    sfx.ring();
    burst(centre(o.x), centre(o.y) - 6, ["#ffd84a", "#ffffff"], 16, 60);
    if (state.free) {
      state.gems++;
      toast("A gem! (" + state.gems + ")", 2);
    } else {
      state.rings++;
      toast(state.level === 4 ? "A ring, lying in the dark. Bilbo puts it in his pocket." : "A gold ring! (" + state.rings + " of " + TOTAL_RINGS + ")", 3);
      checkLevel();
    }
    save();
  }
  // Gandalf (when he is with you) throws a bolt at the nearest monster
  const gandalf = friends.find((friend) => friend.look === "wizard");
  if (gandalf && (boltTimer -= dt) <= 0) {
    let target = boss && boss.awake && Math.hypot(boss.x - gandalf.x, boss.y - gandalf.y) < 150 ? boss : null;
    let nearest = 95;
    for (const m of monsters) {
      const far = Math.hypot(m.x - gandalf.x, m.y - gandalf.y);
      if (m.dead <= 0 && far < nearest) {
        nearest = far;
        target = m;
      }
    }
    if (target) {
      boltTimer = 1.6;
      shots.push({ x: gandalf.x + 6, y: gandalf.y - 22, vx: 0, vy: -40, life: 2.5, target: target });
      sfx.bolt();
    }
  }
  // Monsters
  for (const m of monsters) {
    if (m.dead > 0) {
      if ((m.dead -= dt) <= 0) {
        if (Math.hypot(m.homeX - frodo.x, m.homeY - frodo.y) < 230) m.dead = 5;
        else Object.assign(m, { hp: TYPES[m.type], x: m.homeX, y: m.homeY });
      }
      continue;
    }
    const dx = frodo.x - m.x, dy = frodo.y - m.y, far = Math.hypot(dx, dy) || 1;
    if (far > 300) continue;
    m.flash -= dt;
    const speed = SPEED[m.type] || 28;
    const flies = m.type === "bat" || m.type === "wraith";
    if ((m.think -= dt) <= 0) {
      if (far < 80 && Math.hypot(frodo.x - centre(PLACES.start.x), frodo.y - centre(PLACES.start.y)) > 70) {
        m.vx = (dx / far) * speed;
        m.vy = (dy / far) * speed;
      } else {
        m.think = 1 + Math.random() * 2;
        const back = Math.hypot(m.homeX - m.x, m.homeY - m.y) > 40;
        const angle = back ? Math.atan2(m.homeY - m.y, m.homeX - m.x) : Math.random() * 6.28;
        m.vx = Math.cos(angle) * speed * 0.5;
        m.vy = Math.sin(angle) * speed * 0.5;
      }
    }
    if (flies || !solidAt(m.x + m.vx * dt, m.y - 2)) m.x += m.vx * dt;
    if (flies || !solidAt(m.x, m.y + m.vy * dt - 2)) m.y += m.vy * dt;
    if (far < 10) hurtFrodo(m.x, m.y);
  }
  // The Witch-king (and, in Free Play, the giants)
  if (!boss) {
    const def = STORY.bosses.find((b) => !(b.id === "boss" ? state.taken.boss : state.giants[b.id]) && Math.hypot(centre(b.x) - frodo.x, centre(b.y) - frodo.y) < 400);
    if (def) boss = { def: def, x: centre(def.x), y: centre(def.y), hp: def.hp, awake: false, flash: 0, cool: 2, t: 0 };
  } else {
    const dx = frodo.x - boss.x, dy = frodo.y - boss.y, far = Math.hypot(dx, dy) || 1;
    boss.flash -= dt;
    if (!boss.awake && far < 130) {
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
      if (far > 22) {
        if (!solidAt(boss.x + (dx / far) * 22 * dt, boss.y)) boss.x += (dx / far) * 22 * dt;
        if (!solidAt(boss.x, boss.y + (dy / far) * 22 * dt)) boss.y += (dy / far) * 22 * dt;
      }
      if ((boss.cool -= dt) <= 0) {
        boss.cool = 3;
        for (let i = 0; i < 8; i++) shots.push({ x: boss.x, y: boss.y - 6, vx: Math.cos((i / 8) * 6.283 + boss.t) * 50, vy: Math.sin((i / 8) * 6.283 + boss.t) * 50, life: 2.5, foe: true });
      }
      if (far < 20) hurtFrodo(boss.x, boss.y);
    }
  }
  for (const shot of shots) {
    shot.life -= dt;
    if (shot.foe) {
      if (Math.hypot(frodo.x - shot.x, frodo.y - 6 - shot.y) < 8) {
        shot.life = 0;
        hurtFrodo(shot.x, shot.y);
      }
    } else {
      const t = shot.target;
      if (t === boss ? !boss : t.dead > 0) shot.life = 0;
      else {
        const dx = t.x - shot.x, dy = t.y - 8 - shot.y, far = Math.hypot(dx, dy) || 1;
        shot.vx += ((dx / far) * 170 - shot.vx) * Math.min(1, dt * 6);
        shot.vy += ((dy / far) * 170 - shot.vy) * Math.min(1, dt * 6);
        if (far < 9) {
          shot.life = 0;
          burst(shot.x, shot.y, ["#ffffff", "#bfe8ff"], 8, 50);
          if (t === boss) hurtBoss(1);
          else hurtMonster(t, 1, shot.x, shot.y);
        }
      }
    }
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }
  shots = shots.filter((shot) => shot.life > 0);
  for (const bit of bits) {
    bit.life -= dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
  }
  bits = bits.filter((bit) => bit.life > 0);
  // The top bar
  const level = LEVELS[state.level];
  const rings = Object.keys(state.taken).filter((id) => id !== "boss").length;
  const goal = state.free ? "Free Play in Middle-earth. Gems found: " + state.gems + ". " + REGION_NAMES[regionAt(Math.floor(frodo.x / TILE), Math.floor(frodo.y / TILE))]
    : (state.level < 9 ? "The Hobbit" : "The Lord of the Rings") + ", chapter " + (state.level + 1) + ": " + level.name + ". Rings: " + rings + "/" + level.rings + (level.boss ? (state.taken.boss ? "" : ". Beat " + level.boss[0] + " (in the north)") : "");
  const all = [state.hp, state.rings, goal].join("|");
  if (all !== hudText) {
    hudText = all;
    el("hearts").textContent = "♥".repeat(Math.max(0, state.hp)) + "♡".repeat(Math.max(0, 6 - state.hp));
    el("rings").textContent = "Gold rings " + state.rings + "/" + TOTAL_RINGS;
    el("place").textContent = "➤ " + goal;
  }
}

// ----- Drawing -----
const SWAY = { oak: [16, 30], doomtree: [12, 22], pine: [14, 28], snowpine: [14, 28], palm: [18, 30] };
function draw() {
  const goX = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, frodo.x - VIEW_W / 2));
  const goY = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, frodo.y - 14 - VIEW_H / 2));
  cam.x += (goX - cam.x) * 0.18;
  cam.y += (goY - cam.y) * 0.18;
  const jolt = shake > 0 ? shake * 6 : 0;
  const sx = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, Math.round(cam.x + (Math.random() - 0.5) * jolt)));
  const sy = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, Math.round(cam.y + (Math.random() - 0.5) * jolt)));
  const mod = (n, size) => ((n % size) + size) % size;
  const lights = [];
  const casts = [];
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
  const put = (img, x, y, sort, sway) => list.push({ img: img, x: Math.round(x - sx), y: Math.round(y - sy), sort: sort, sway: sway });
  const cast = (img, x, y) => casts.push({ img: img, x: Math.round(x - sx), y: Math.round(y - sy) });
  const taken = takenHere();
  for (let ty = Math.max(0, ty0 - 1); ty <= Math.min(MAP_H - 1, ty0 + VIEW_H / TILE + 5); ty++) {
    for (const thing of rows[ty]) {
      if (thing.x + thing.img.width < sx || thing.x > sx + VIEW_W) continue;
      const o = thing.o;
      if (o.type === "pickup") {
        if (taken["p" + o.id]) continue;
        put(thing.img, thing.x, thing.y - 3 - Math.abs(Math.sin(time * 3 + o.x)) * 4, thing.by);
        lights.push({ x: thing.bx, y: thing.by - 10, r: 44 + Math.sin(time * 4 + o.x) * 5, kind: "warm", a: 0.55 });
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
  for (const npc of STORY.npcs) person({ x: npc.px, y: npc.py, dir: 0, moving: false }, SPR[npc.look]);
  for (const friend of friends) {
    person(friend, SPR[friend.look]);
    if (friend.look === "wizard") lights.push({ x: friend.x + 6, y: friend.y - 24, r: 30, kind: "magic", a: 0.3 });
  }
  if (!(frodo.safe > 0 && Math.floor(time * 12) % 2 === 0)) person(frodo, SPR[heroLook]);
  for (const m of monsters) {
    if (m.dead > 0 || m.x < sx - 20 || m.x > sx + VIEW_W + 20 || m.y < sy - 20 || m.y > sy + VIEW_H + 30) continue;
    let img;
    if (m.type === "goblin" || m.type === "orc") {
      // Goblins and orcs walk like people, facing the way they are going
      if (Math.abs(m.vx) + Math.abs(m.vy) > 1) m.dir = Math.abs(m.vx) > Math.abs(m.vy) ? (m.vx < 0 ? 1 : 2) : m.vy < 0 ? 3 : 0;
      img = SPR[m.type][m.dir][Math.floor(time * 7 + m.homeX) % 4];
      if (m.flash > 0) img = whiteCopy(img);
    } else img = (m.flash > 0 ? SPR.monstersHurt : SPR.monsters)[m.type][Math.floor(time * 4 + m.homeX) % 2];
    put(img, m.x - img.width / 2, m.y - img.height + 2 - (m.type === "bat" || m.type === "wraith" ? 8 : 0), m.y);
    cast(img, m.x, m.y + 1);
  }
  if (boss) {
    const giant = SPR.brutes[boss.def.look];
    const img = (boss.flash > 0 ? giant.hurt : giant.frames)[Math.floor(time * 3) % 2];
    put(img, boss.x - giant.w / 2, boss.y - giant.feet, boss.y);
    cast(img, boss.x, boss.y - giant.feet + img.height);
    lights.push({ x: boss.x, y: boss.y - giant.feet / 2, r: 80, kind: "red", a: 0.3 });
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
  if (frodo.swing > 0) {
    ctx.fillStyle = "#bfe8ff";       // Sting glows blue
    ctx.globalAlpha = frodo.swing / 0.25;
    const facing = Math.atan2(DIRS[frodo.dir][1], DIRS[frodo.dir][0]);
    for (let turn = -0.9; turn <= 0.9; turn += 0.12) ctx.fillRect(Math.round(frodo.x - sx + Math.cos(facing + turn) * 16), Math.round(frodo.y - sy - 9 + Math.sin(facing + turn) * 16), 2, 2);
    ctx.globalAlpha = 1;
  }
  for (const shot of shots) {
    ctx.fillStyle = shot.foe ? "#b03ad8" : "#bfe8ff";
    ctx.fillRect(Math.round(shot.x - sx) - 2, Math.round(shot.y - sy) - 2, 5, 5);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(shot.x - sx) - 1, Math.round(shot.y - sy) - 1, 2, 2);
    lights.push({ x: shot.x, y: shot.y, r: 24, kind: "magic", a: 0.5 });
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
  bloomCtx.globalCompositeOperation = "source-over";
  bloomCtx.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
  bloomCtx.globalCompositeOperation = "multiply";
  bloomCtx.drawImage(bloomCanvas, 0, 0);
  bloomCtx.drawImage(bloomCanvas, 0, 0);
  ctx.globalAlpha = 0.24;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bloomCanvas, 0, 0, VIEW_W, VIEW_H);
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

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
function begin(saved, free) {
  state = saved || newState();
  playing = true;
  el("intro").hidden = true;
  if (free) startFreePlay();
  else if (state.free) startFreePlay();
  else startLevel(!saved);
}
el("start").addEventListener("click", function () {
  const old = loadSave();
  begin(null);
  if (old && old.unlocked) state.unlocked = true;      // Free Play stays unlocked for good
});
el("continue").addEventListener("click", () => begin(loadSave()));
el("free").addEventListener("click", () => begin(loadSave(), true));
const before = loadSave();
el("continue").hidden = !before;
if (before && before.unlocked) {
  el("free").disabled = false;
  el("free").textContent = "Free Play: all of Middle-earth";
}
loadLand(levelSpec(0));
requestAnimationFrame(frame);

// Only for testing the game.
window.RQ = {
  get state() { return state; },
  frodo: frodo, keys: keys, monsters: () => monsters, boss: () => boss, card: () => card, hurtBoss: hurtBoss, levels: LEVELS.length, total: TOTAL_RINGS,
  rings: () => WORLD.objects.filter((o) => o.type === "pickup" && !takenHere()["p" + o.id]),
};
