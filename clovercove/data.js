// Clover Cove: the rule book.
// No drawing in here. This file makes the map of the village, and lists everything in it:
// the neighbours, the bugs, the fish, the fossils, the furniture, and what things cost.

const TILE = 2;                 // the village is a grid of squares, each 2 metres wide
const COLS = 64;
const ROWS = 44;

function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// The middle of a square, in metres
function mid(n) {
  return (n + 0.5) * TILE;
}

function tileOf(metres) {
  return Math.floor(metres / TILE);
}

// ----- Time -----
const DAY_SECONDS = 600;         // one whole day and night takes ten minutes
const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
const SEASON_DAYS = 5;           // each season lasts five days
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ----- Buildings -----
// Each one covers a block of squares (i, k is its top left corner), and its door faces south.
const PLACES = {
  home:   { i: 9,  k: 11, w: 4, d: 3, name: "Your house" },
  shop:   { i: 28, k: 9,  w: 4, d: 2, name: "Thistle's Stall" },
  cabin:  { i: 19, k: 7,  w: 3, d: 2, name: "Beaver Builders" },
  museum: { i: 48, k: 13, w: 6, d: 3, name: "The Museum" },
};
const PLAZA = { i0: 26, k0: 16, i1: 33, k1: 21 };
const POND = { i: 16.5, k: 26, a: 3.4, b: 2.2 };

// ----- Your neighbours -----
// Each has a kind of animal, colours (fur, face, clothes), a house, and a way of talking.
const NEIGHBOURS = [
  { id: "marmalade", name: "Marmalade", animal: "cat", fur: 0xf0963a, face: 0xfff0dc, shirt: 0x4a9ad8, house: { i: 5, k: 21 }, roof: 0xd8442e, mood: "cheery", says: "purrhaps" },
  { id: "boggs", name: "Boggs", animal: "frog", fur: 0x5ab84a, face: 0xdcf0b4, shirt: 0xffd23a, house: { i: 19, k: 30 }, roof: 0x4a8a4a, mood: "sleepy", says: "ribbit-ish" },
  { id: "barnaby", name: "Barnaby", animal: "bear", fur: 0x8a5a3a, face: 0xe8c8a0, shirt: 0xd8442e, house: { i: 30, k: 27 }, roof: 0x4a6ad8, mood: "sporty", says: "big paws" },
  { id: "saffron", name: "Saffron", animal: "fox", fur: 0xe8662a, face: 0xfff4e8, shirt: 0x3a3a48, house: { i: 45, k: 26 }, roof: 0x8a5ac8, mood: "cool", says: "naturally" },
  { id: "clementine", name: "Clementine", animal: "rabbit", fur: 0xf4ecd8, face: 0xffffff, shirt: 0xff8ab8, house: { i: 55, k: 22 }, roof: 0xff8ab8, mood: "sweet", says: "hop hop" },
  { id: "pipsqueak", name: "Pipsqueak", animal: "mouse", fur: 0xa8a8b0, face: 0xf4e4e0, shirt: 0x7ad86a, house: { i: 51, k: 5 }, roof: 0xffb02a, mood: "peppy", says: "squeee" },
];
// Three more animals run the village's shop, cabin and museum
const KEEPERS = {
  shop:   { id: "thistle", name: "Thistle", animal: "badger", fur: 0x4a4a52, face: 0xf4f4f4, shirt: 0x4aa84a },
  cabin:  { id: "chip", name: "Chip", animal: "beaver", fur: 0x7a4a2a, face: 0xd8b088, shirt: 0xffb02a },
  museum: { id: "trunkle", name: "Professor Trunkle", animal: "elephant", fur: 0x9aa4b4, face: 0xc8d0dc, shirt: 0x6a4a8a },
};

// What neighbours say when you just stop for a chat. {name} is your name and {says} is their catchphrase.
const CHATS = {
  cheery: ["What a lovely day, {name}! I've been humming since breakfast, {says}.", "I saw a butterfly as big as my paw this morning! I waved. It didn't wave back.", "You know what I love about Clover Cove? Everything, {says}!", "I'm thinking of painting my door. Again. Is five times too many?"],
  sleepy: ["Oh... hi, {name}. Is it lunchtime yet? It feels like lunchtime, {says}.", "I dreamed I was a lily pad. Best nap of the week.", "I was going to tidy my house today. Then I sat down. So that was that, {says}.", "If you find any snacks lying around, you know where I live."],
  sporty: ["{name}! Race you to the bridge! ...Maybe after my stretches, {says}.", "I did one hundred star jumps this morning. Then I lost count and started again.", "The river is perfect for a swim today. Shame about all the fish, {says}.", "Strong legs, strong heart, strong breakfast. That's my motto!"],
  cool: ["Oh, {name}. Nice of you to drop by, {says}.", "I've been working on my look. It's called 'effortless'. It takes two hours.", "The night sky here is something else. I write poems about it, {says}.", "Don't tell anyone, but I think this village is rather wonderful."],
  sweet: ["Hello, {name} dear! Have you eaten? You look like you need a biscuit, {says}.", "I've been knitting scarves for the trees. They do look chilly at night.", "Every flower in this village has a name. That one's Gerald, {says}.", "It's so nice to have you living here. Truly."],
  peppy: ["{name}! {name}! Guess what? ...I forgot. But it was AMAZING, {says}!", "I'm going to be a famous singer one day! Or a cheese taster. Or both!", "I counted every flower in the village today. Then a new one grew. Rude, {says}!", "Today is the best day ever! So was yesterday! Tomorrow too, probably!"],
};
const NIGHT_CHATS = ["Up late, {name}? Me too. Look at all those stars, {says}.", "The fireflies are out by the pond tonight. Bring your net!", "Shh... the crickets are singing. Isn't it lovely, {says}?"];

// ----- Things to catch -----
// place: where it lives. seasons: which seasons it comes out in (0 = spring ... 3 = winter).
// time: "day", "night" or "any". rare: 1 = common ... 4 = very rare.
const BUGS = [
  { id: "white", name: "White butterfly", place: "flower", seasons: [0, 1, 2], time: "day", price: 90, rare: 1, colour: 0xffffff },
  { id: "yellow", name: "Yellow butterfly", place: "flower", seasons: [0, 2], time: "day", price: 110, rare: 1, colour: 0xffe14a },
  { id: "emperor", name: "Emperor butterfly", place: "flower", seasons: [1], time: "day", price: 2400, rare: 4, colour: 0x3a6aff },
  { id: "ladybird", name: "Ladybird", place: "flower", seasons: [0, 1], time: "day", price: 160, rare: 1, colour: 0xe8243a },
  { id: "bee", name: "Honeybee", place: "flower", seasons: [0, 1], time: "day", price: 200, rare: 2, colour: 0xffb02a },
  { id: "mantis", name: "Mantis", place: "flower", seasons: [1, 2], time: "day", price: 430, rare: 3, colour: 0x6ad84a },
  { id: "hopper", name: "Grasshopper", place: "grass", seasons: [1, 2], time: "day", price: 160, rare: 1, colour: 0x8ac84a },
  { id: "cricket", name: "Cricket", place: "grass", seasons: [1, 2], time: "night", price: 130, rare: 1, colour: 0x6a4a2a },
  { id: "snail", name: "Snail", place: "grass", seasons: [0, 2], time: "any", price: 250, rare: 2, colour: 0xc8a070 },
  { id: "cicada", name: "Cicada", place: "tree", seasons: [1], time: "day", price: 250, rare: 2, colour: 0x8a7a5a },
  { id: "stag", name: "Stag beetle", place: "tree", seasons: [1], time: "night", price: 1800, rare: 4, colour: 0x3a2a2a },
  { id: "spider", name: "Spider", place: "tree", seasons: [0, 2], time: "night", price: 480, rare: 3, colour: 0x2a2a30 },
  { id: "dragonfly", name: "Dragonfly", place: "water", seasons: [1, 2], time: "day", price: 230, rare: 2, colour: 0x4ad8c8 },
  { id: "skater", name: "Pond skater", place: "water", seasons: [0, 1], time: "day", price: 130, rare: 1, colour: 0x4a5a6a },
  { id: "firefly", name: "Firefly", place: "water", seasons: [1], time: "night", price: 300, rare: 2, colour: 0xd8ff5a },
  { id: "snowbug", name: "Snow moth", place: "flower", seasons: [3], time: "any", price: 350, rare: 2, colour: 0xd8f0ff },
];

// water: "river", "pond" or "sea". size: how big its shadow is (1 small ... 4 huge).
const FISH = [
  { id: "dace", name: "Dace", water: "river", seasons: [0, 1, 2, 3], time: "any", price: 200, rare: 1, size: 1 },
  { id: "carp", name: "Carp", water: "river", seasons: [0, 1, 2, 3], time: "any", price: 300, rare: 1, size: 2 },
  { id: "bass", name: "River bass", water: "river", seasons: [0, 1, 2], time: "any", price: 400, rare: 2, size: 2 },
  { id: "trout", name: "Rainbow trout", water: "river", seasons: [0, 3], time: "day", price: 800, rare: 3, size: 2 },
  { id: "salmon", name: "Salmon", water: "river", seasons: [2], time: "any", price: 700, rare: 2, size: 3 },
  { id: "catfish", name: "Catfish", water: "river", seasons: [1, 2], time: "night", price: 800, rare: 3, size: 3 },
  { id: "pike", name: "Giant pike", water: "river", seasons: [1, 3], time: "any", price: 3000, rare: 4, size: 4 },
  { id: "goldfish", name: "Goldfish", water: "pond", seasons: [0, 1, 2, 3], time: "any", price: 500, rare: 2, size: 1 },
  { id: "frogfish", name: "Tadpole", water: "pond", seasons: [0], time: "any", price: 100, rare: 1, size: 1 },
  { id: "koi", name: "Koi", water: "pond", seasons: [0, 1, 2, 3], time: "any", price: 2200, rare: 4, size: 3 },
  { id: "seabass", name: "Sea bass", water: "sea", seasons: [0, 1, 2, 3], time: "any", price: 300, rare: 1, size: 3 },
  { id: "mackerel", name: "Mackerel", water: "sea", seasons: [0, 1, 2, 3], time: "any", price: 250, rare: 1, size: 2 },
  { id: "snapper", name: "Red snapper", water: "sea", seasons: [0, 1, 2, 3], time: "any", price: 1500, rare: 3, size: 3 },
  { id: "puffer", name: "Pufferfish", water: "sea", seasons: [1, 3], time: "any", price: 900, rare: 3, size: 2 },
  { id: "squid", name: "Squid", water: "sea", seasons: [2, 3], time: "night", price: 700, rare: 2, size: 2 },
  { id: "shark", name: "Shark", water: "sea", seasons: [1], time: "any", price: 5000, rare: 4, size: 4 },
];

const FOSSILS = [
  { id: "f_skull", name: "T. rex skull", price: 3000 }, { id: "f_spine", name: "T. rex spine", price: 2500 }, { id: "f_tail", name: "T. rex tail", price: 2500 },
  { id: "f_frill", name: "Triceratops frill", price: 2600 }, { id: "f_horn", name: "Triceratops horn", price: 2200 },
  { id: "f_plate", name: "Stegosaurus plate", price: 2000 }, { id: "f_neck", name: "Long-neck bones", price: 2800 },
  { id: "f_wing", name: "Pteranodon wing", price: 2400 }, { id: "f_shell", name: "Ammonite", price: 1100 }, { id: "f_amber", name: "Amber", price: 1200 },
];

// Fruit, shells and other things you can pick up and sell
const GOODS = {
  apple: { name: "Apple", price: 100, colour: 0xe8243a },
  orange: { name: "Orange", price: 100, colour: 0xff9a2a },
  cherry: { name: "Cherries", price: 100, colour: 0xc81a4a },
  coconut: { name: "Coconut", price: 250, colour: 0x8a5a3a },
  cockle: { name: "Cockle shell", price: 60, colour: 0xf4dcc0 },
  conch: { name: "Conch shell", price: 350, colour: 0xffb8a0 },
  starfish: { name: "Starfish", price: 180, colour: 0xff7a4a },
  coral: { name: "Coral", price: 500, colour: 0xff5a8a },
  fossil: { name: "Mystery fossil", price: 300, colour: 0x9a9a9e },
};

// Furniture for your house. Thistle sells a few different pieces each day.
const FURNITURE = [
  { id: "chair", name: "Wooden chair", price: 400, colour: 0xb8824a, shape: "chair" },
  { id: "table", name: "Round table", price: 600, colour: 0xb8824a, shape: "table" },
  { id: "bed", name: "Cosy bed", price: 1200, colour: 0x4a9ad8, shape: "bed" },
  { id: "lamp", name: "Floor lamp", price: 500, colour: 0xffe9a0, shape: "lamp" },
  { id: "plant", name: "Pot plant", price: 350, colour: 0x4aa84a, shape: "plant" },
  { id: "rug", name: "Clover rug", price: 700, colour: 0x7ad86a, shape: "rug" },
  { id: "shelf", name: "Bookshelf", price: 900, colour: 0x8a5a3a, shape: "shelf" },
  { id: "sofa", name: "Squashy sofa", price: 1500, colour: 0xd8442e, shape: "sofa" },
  { id: "tv", name: "Old telly", price: 1800, colour: 0x3a3a48, shape: "tv" },
  { id: "tank", name: "Fish tank", price: 1600, colour: 0x6ac8e8, shape: "tank" },
  { id: "piano", name: "Little piano", price: 2600, colour: 0x2a2a30, shape: "piano" },
  { id: "teddy", name: "Giant teddy", price: 1300, colour: 0xc8966a, shape: "teddy" },
  { id: "clock", name: "Tall clock", price: 1100, colour: 0x6a4a2a, shape: "clock" },
  { id: "stove", name: "Kitchen stove", price: 1400, colour: 0xf4f4f4, shape: "stove" },
  { id: "globe", name: "Globe", price: 800, colour: 0x4a9ad8, shape: "globe" },
  { id: "trophy", name: "Gold trophy", price: 3000, colour: 0xffd23a, shape: "trophy" },
];

// Tools. You start with a net and a rod. Thistle sells the shovel.
const TOOLS = {
  hand: { name: "Hands", what: "E: pick up, shake trees, talk" },
  net: { name: "Net", what: "Space: swing at a bug. Walk up slowly, don't run!" },
  rod: { name: "Fishing rod", what: "Space: cast near a fish shadow. Press Space again when the float goes UNDER" },
  shovel: { name: "Shovel", what: "Space: dig up a star crack in the ground", price: 500 },
};

// Your house grows each time you pay off your loan to Chip
const HOMES = [
  { name: "Tiny house", room: 5, loan: 5000 },
  { name: "Family house", room: 7, loan: 20000 },
  { name: "Grand house", room: 9, loan: 50000 },
  { name: "Golden house", room: 9, loan: 0 },
];

// Things to do, one after another (a gentle guide to the village)
const GOALS = [
  { text: "Say hello to Chip the beaver at Beaver Builders, just north-east of your house", reward: 200 },
  { text: "Shake a fruit tree (press E next to it), pick up the fruit, and sell it to Thistle at the stall", reward: 300 },
  { text: "Press 2 for your net and catch a bug. Walk up to it slowly, then press Space", reward: 300 },
  { text: "Press 3 for your rod and catch a fish. Cast near a shadow, and press Space when the float goes under", reward: 300 },
  { text: "Meet all six of your neighbours", reward: 500 },
  { text: "Give Professor Trunkle something for the museum, across the river", reward: 500 },
  { text: "Buy a shovel from Thistle, and dig up a star crack in the ground", reward: 500 },
  { text: "Buy a piece of furniture, and put it in your house (go in, then press B)", reward: 500 },
  { text: "Do a favour for a neighbour (one with a ! over their head)", reward: 800 },
  { text: "Pay off your first loan to Chip", reward: 1000 },
  { text: "Give the museum 20 different things", reward: 3000 },
  { text: "Pay off every loan and live in the Golden house", reward: 0 },
];

// ----- The map -----
// Every square has a ground type: "grass", "sand", "water", "path", "stone" or "bridge".
// Things stand on squares: trees, flowers, rocks and buildings.
function makeMap() {
  const roll = seeded(424242);
  const ground = [];
  const water = [];        // which water a square belongs to: "river", "pond" or "sea"
  const things = {};       // "i,k" -> { type: "tree" / "pine" / "palm" / "flower" / "rock" / "wall", ... }
  // Where the middle of the river is, on each row
  const riverAt = function (k) { return 40 + 3.5 * Math.sin(k * 0.22) + 1.5 * Math.sin(k * 0.5 + 1); };
  for (let k = 0; k < ROWS; k++) {
    ground.push([]);
    water.push([]);
    for (let i = 0; i < COLS; i++) {
      let type = "grass";
      let wet = "";
      if (k >= 40) {
        type = "water";
        wet = "sea";
      } else if (k >= 36) {
        type = "sand";
      }
      if (k < 40 && Math.abs(i - riverAt(k)) < 1.6) {
        type = "water";
        wet = "river";
      }
      const px = (i - POND.i) / POND.a;
      const pk = (k - POND.k) / POND.b;
      if (px * px + pk * pk < 1) {
        type = "water";
        wet = "pond";
      }
      if (i >= PLAZA.i0 && i <= PLAZA.i1 && k >= PLAZA.k0 && k <= PLAZA.k1) type = "stone";
      ground[k].push(type);
      water[k].push(wet);
    }
  }
  // Dirt paths, each a straight run of squares. Where a path crosses the river, it becomes a bridge.
  function path(i0, k0, i1, k1) {
    for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) {
      for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) {
        if (ground[k][i] === "water") ground[k][i] = "bridge";
        else if (ground[k][i] === "grass") ground[k][i] = "path";
      }
    }
  }
  path(11, 14, 11, 18);  path(11, 18, 26, 18);          // your house to the plaza
  path(30, 11, 30, 15);                                  // the plaza to Thistle's stall
  path(20, 9, 20, 18);                                   // Beaver Builders
  path(34, 18, 51, 18);  path(51, 16, 51, 18);           // over the first bridge to the museum
  path(30, 22, 30, 35);                                  // down to the beach
  path(30, 31, 47, 31);  path(47, 28, 47, 31);           // over the second bridge
  path(6, 18, 11, 18);   path(6, 18, 6, 23);
  path(20, 18, 20, 32);
  path(47, 18, 47, 28);  path(47, 24, 56, 24);
  path(52, 7, 52, 13);

  // Buildings are solid
  function block(place, type) {
    for (let i = place.i; i < place.i + place.w; i++) {
      for (let k = place.k; k < place.k + place.d; k++) things[i + "," + k] = { type: "wall", of: type };
    }
  }
  for (const id in PLACES) block(PLACES[id], id);
  for (const one of NEIGHBOURS) block({ i: one.house.i, k: one.house.k, w: 3, d: 2 }, one.id);

  // Is this square free for something to grow on?
  function free(i, k, type) {
    if (i < 0 || k < 0 || i >= COLS || k >= ROWS || ground[k][i] !== type || things[i + "," + k]) return false;
    // (keep the squares in front of doors clear)
    for (const id in PLACES) {
      const p = PLACES[id];
      if (i >= p.i - 1 && i <= p.i + p.w && k >= p.k - 1 && k <= p.k + p.d + 2) return false;
    }
    for (const one of NEIGHBOURS) {
      if (i >= one.house.i - 1 && i <= one.house.i + 3 && k >= one.house.k - 1 && k <= one.house.k + 3) return false;
    }
    return true;
  }
  // A wall of pine trees all round the edge of the village
  for (let i = 0; i < COLS; i++) {
    for (let k = 0; k < 36; k++) {
      if ((i < 2 || i >= COLS - 2 || k < 2) && ground[k][i] === "grass") things[i + "," + k] = { type: "pine" };
    }
  }
  // Fruit trees and leafy trees. Apples grow in the west, oranges in the east, cherries in the north.
  let made = 0;
  while (made < 78) {
    const i = 2 + Math.floor(roll() * (COLS - 4));
    const k = 2 + Math.floor(roll() * 33);
    if (!free(i, k, "grass")) continue;
    // Trees need a little room: no other tree right next door
    let crowded = false;
    for (let di = -1; di <= 1; di++) {
      for (let dk = -1; dk <= 1; dk++) {
        const near = things[(i + di) + "," + (k + dk)];
        if (near && (near.type === "tree" || near.type === "wall")) crowded = true;
        if (ground[clamp(k + dk, 0, ROWS - 1)][clamp(i + di, 0, COLS - 1)] === "path") crowded = true;
      }
    }
    if (crowded) continue;
    const fruit = roll() < 0.55 ? (k < 12 ? "cherry" : i < 34 ? "apple" : "orange") : "";
    things[i + "," + k] = { type: "tree", fruit: fruit, slot: made };
    made++;
  }
  for (const i of [5, 14, 24, 36, 52, 58]) things[i + ",37"] = { type: "palm", fruit: "coconut" };
  // Flowers grow in little patches
  for (let patch = 0; patch < 16; patch++) {
    const ci = 4 + Math.floor(roll() * (COLS - 8));
    const ck = 4 + Math.floor(roll() * 29);
    const colour = [0xff5a8a, 0xffd23a, 0xffffff, 0xc87aff, 0xff8a3a, 0x5ab8ff][patch % 6];
    for (let n = 0; n < 5; n++) {
      const i = ci + Math.floor(roll() * 4) - 1;
      const k = ck + Math.floor(roll() * 3) - 1;
      if (free(i, k, "grass")) things[i + "," + k] = { type: "flower", colour: colour };
    }
  }
  for (let n = 0; n < 7; n++) {
    const i = 3 + Math.floor(roll() * (COLS - 6));
    const k = 3 + Math.floor(roll() * 31);
    if (free(i, k, "grass")) things[i + "," + k] = { type: "rock" };
  }
  return { ground: ground, water: water, things: things };
}
