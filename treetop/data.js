// Treetop Island: the rule book.
// No drawing in here. This file says where everything on the island is, which dinosaurs live there,
// what you can pick up and make, and all the choices in the treehouse designer.

// ----- Places (x is east, z is south, in metres. Your tree is in the middle.) -----
const HOME = { x: 0, z: 0 };
const DECK = 8;                               // how high the treehouse floor is above the ground
const LAKE = { x: 140, z: 20, r: 34, name: "Mirror Lake" };
const MARSH = { x: 15, z: 135, r: 42, name: "Spitter Marsh" };
const MEADOW = { x: -135, z: 15, r: 62, name: "Sunny Meadow" };
const WOODS = { x: 105, z: -125, r: 55, name: "Raptor Woods" };
const RIDGE = { x: -45, z: -170, r: 70, name: "Rex Ridge" };
const NESTS = [{ x: 96, z: -118 }, { x: 128, z: -140 }, { x: 108, z: -160 }];

function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// How far apart two things are (each has an x and a z)
function gap(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// A round bump (or dip): 1 in the middle of a place, fading to 0 around its edge
function bump(x, z, place, wide) {
  const far = Math.hypot(x - place.x, z - place.z) / wide;
  return Math.exp(-far * far);
}

// How high the ground is at any spot. The sea is at height 0, so anything below 0 is under water.
function groundAt(x, z) {
  const far = Math.hypot(x, z);
  const angle = Math.atan2(z, x);
  const edge = 245 + 22 * Math.sin(angle * 3 + 0.5) + 12 * Math.sin(angle * 7 + 2);   // a wobbly coastline
  let high = 3.5 + 2.2 * Math.sin(x * 0.023 + 1) * Math.cos(z * 0.019) + 1.2 * Math.sin(x * 0.051 + z * 0.043);
  high += 24 * bump(x, z, RIDGE, RIDGE.r);
  high -= 9.5 * bump(x, z, LAKE, LAKE.r);
  high -= 4.4 * bump(x, z, MARSH, MARSH.r);
  high += (3.5 - high) * smooth((36 - gap({ x: x, z: z }, HOME)) / 14);  // flat ground round your tree
  return -7 + (high + 7) * smooth((edge - far) / 50);
}

// The name of the place you are standing in
function placeAt(x, z) {
  const here = { x: x, z: z };
  if (gap(here, HOME) < 24) return "Home Glade";
  for (const place of [LAKE, MARSH, MEADOW, WOODS, RIDGE]) {
    if (gap(here, place) < place.r) return place.name;
  }
  return groundAt(x, z) < 1.2 ? "The shore" : "The deep forest";
}

// ----- Dinosaurs -----
// Each row: id, name, body plan, length in metres, three colours (body, belly, trim), and its special features.
// (The body plans are explained in scene.js, where the dinosaurs are built.)
const ROWS = [
  ["compy", "Compsognathus", "R", 1.1, 0x6a9a4a, 0xd8e8b0, 0x3a5a2a, ""],
  ["galli", "Gallimimus", "O", 5.5, 0xd8b070, 0xf0e0b0, 0x7a5a3a, ""],
  ["para", "Parasaurolophus", "H", 9, 0xd98a3a, 0xf0d8a0, 0xc8402a, "tube"],
  ["tri", "Triceratops", "C", 8, 0x8a9a6a, 0xd8d0a8, 0xf4ecd8, "frill horns3"],
  ["steg", "Stegosaurus", "G", 8.5, 0x5a9a4a, 0xc8d8a0, 0xe8823a, "plates thagomizer"],
  ["brach", "Brachiosaurus", "S", 22, 0x7a8aa0, 0xb8c4d0, 0x6a7a90, "tall bump"],
  ["dilo", "Dilophosaurus", "T", 5.5, 0x6a9a3a, 0xc8d88a, 0xffd23a, "crest2"],
  ["raptor", "Velociraptor", "R", 3.4, 0x8a5a3a, 0xe0c8a0, 0x2a2a2a, "feathers"],
  ["rex", "Tyrannosaurus rex", "T", 12.5, 0x6a4a3a, 0xd8b890, 0x3a2a1a, ""],
  ["pet", "your raptor", "R", 3, 0x3a9ad8, 0xd8ecf8, 0xffd23a, "feathers"],
];
const SPECIES = {};
for (const row of ROWS) {
  SPECIES[row[0]] = { name: row[1], plan: row[2], size: row[3], a: row[4], b: row[5], c: row[6], feats: row[7].split(" ").filter(Boolean), diet: ["compy", "dilo", "raptor", "rex", "pet"].includes(row[0]) ? "meat" : "plants" };
}

// Where each kind lives, how many there are, how fast it walks and runs, and how it behaves:
//   shy = runs away from you, calm = ignores you, grumpy = hits you if you get too close,
//   thief = steals your food, spitter = spits from far away, hunter = chases and bites.
const HERDS = [
  { kind: "compy", count: 5, at: { x: 40, z: 60, r: 45 }, walk: 1.6, run: 6.5, act: "thief" },
  { kind: "compy", count: 5, at: { x: -60, z: -70, r: 50 }, walk: 1.6, run: 6.5, act: "thief" },
  { kind: "compy", count: 4, at: { x: 70, z: -40, r: 45 }, walk: 1.6, run: 6.5, act: "thief" },
  { kind: "galli", count: 6, at: MEADOW, walk: 2.4, run: 11, act: "shy" },
  { kind: "para", count: 4, at: MEADOW, walk: 1.8, run: 5, act: "shy" },
  { kind: "tri", count: 3, at: { x: -150, z: -20, r: 45 }, walk: 1.4, run: 7, act: "grumpy" },
  { kind: "steg", count: 2, at: { x: -70, z: 95, r: 45 }, walk: 1.2, run: 3, act: "grumpy" },
  { kind: "brach", count: 2, at: { x: 150, z: 70, r: 50 }, walk: 1.5, run: 1.5, act: "calm" },
  { kind: "dilo", count: 3, at: MARSH, walk: 1.8, run: 6, act: "spitter" },
  { kind: "raptor", count: 3, at: WOODS, walk: 2.2, run: 8.8, act: "hunter" },
  // (This second pack comes prowling near your tree when it is dark)
  { kind: "raptor", count: 3, at: { x: 135, z: -150, r: 40 }, night: { x: 25, z: -55, r: 40 }, walk: 2.2, run: 8.8, act: "hunter" },
  { kind: "rex", count: 1, at: RIDGE, walk: 3, run: 7.6, act: "hunter" },
];

// ----- Things you can carry -----
const ITEMS = {
  berry: { name: "Berries", food: 10 },
  fish:  { name: "Raw fish", food: 14 },
  egg:   { name: "Eggs", food: 14 },
  meal:  { name: "Cooked meals", food: 45 },
  stick: { name: "Sticks" },
  stone: { name: "Stones" },
  vine:  { name: "Vines" },
  wood:  { name: "Wood" },
  tooth: { name: "Giant tooth" },
};

// Things lying about the island for you to pick up: how many there are, and how many seconds until they grow back
const FINDS = {
  berry: { count: 46, back: 200, gives: 2, word: "Pick the berries" },
  stick: { count: 70, back: 300, gives: 1, word: "Pick up the stick" },
  stone: { count: 50, back: 300, gives: 1, word: "Pick up the stone" },
  vine:  { count: 44, back: 300, gives: 1, word: "Pull down the vine" },
  fish:  { count: 9, back: 120, gives: 1, word: "Spear the fish" },
  egg:   { count: 3, back: 500, gives: 1, word: "Take the egg" },
  tooth: { count: 1, back: 99999, gives: 1, word: "Pick up the giant tooth" },
};

// ----- Things you can make at your workbench -----
// "needs" is what it costs. Tools are yours to keep. Parts get built on to your treehouse.
const MAKES = {
  axe:     { name: "Stone axe", type: "tool", needs: { stick: 2, stone: 2, vine: 1 }, what: "Chop down trees for wood (press E at a tree)" },
  spear:   { name: "Spear", type: "tool", needs: { stick: 2, stone: 1, vine: 2 }, what: "Jab at dinosaurs with Space, and spear fish in the lake" },
  torch:   { name: "Torch", type: "tool", needs: { stick: 1, vine: 1, wood: 1 }, what: "Press T to light it. Little dinosaurs are scared of fire" },
  fire:    { name: "Cooking fire", type: "part", needs: { stone: 4, wood: 3 }, what: "Cooks fish and eggs into big meals" },
  lookout: { name: "Lookout", type: "part", needs: { wood: 8, vine: 4 }, what: "A crow's nest high in the tree. Your map shows every dinosaur" },
  nest:    { name: "Nest box", type: "part", needs: { wood: 6, vine: 4, berry: 6 }, what: "Put a raptor egg in it to hatch a pet of your own" },
  horn:    { name: "Great horn", type: "part", needs: { wood: 6, vine: 3, tooth: 1 }, what: "Press H anywhere to blow it. Every hunter nearby runs away" },
};

// ----- The treehouse designer -----
const PAINTS = [
  { name: "Honey", hex: 0xd8a04a }, { name: "Cherry", hex: 0xd8442e }, { name: "Sky", hex: 0x4a9ad8 },
  { name: "Leaf", hex: 0x4aa84a }, { name: "Plum", hex: 0x8a5ac8 }, { name: "Snow", hex: 0xf0ece0 },
  { name: "Night", hex: 0x3a3a48 }, { name: "Sunny", hex: 0xffd23a },
];
const CHOICES = {
  shape: { name: "House", options: { round: "Round hut", square: "Square cabin", tall: "Tall tower" } },
  roof:  { name: "Roof", options: { cone: "Pointed", thatch: "Leafy thatch", flat: "Flat with a railing" } },
  way:   { name: "Way up", options: { ladder: "Wooden ladder", rope: "Rope ladder", stairs: "Spiral stairs" } },
};
const EXTRAS = { flag: "Flag", lanterns: "Lanterns", slide: "Slide", swing: "Rope swing", flowers: "Flower boxes", bunting: "Bunting" };

function freshDesign() {
  return { shape: "round", roof: "cone", way: "ladder", walls: 0, top: 1, extras: { flag: true, lanterns: true }, name: "My Treehouse" };
}

// ----- Time -----
const DAY = 420;        // seconds in one whole day and night
const DUSK = 0.62;      // the part of the day when the sun goes down (0 = sunrise, 1 = the next sunrise)
const DARK = 0.7;       // night falls

// ----- Your jobs, one after another -----
const GOALS = [
  "Climb down from your treehouse (press E at the top of the ladder) and pick 4 berries from a bush with red dots",
  "Pick up 2 sticks, 2 stones and 3 vines. Sticks lie under trees, stones are grey, and vines hang down from tree trunks",
  "Climb back up, press E at your workbench, and make a Stone axe",
  "Chop down trees (press E at a tree) until you have 4 wood",
  "Make a Spear at your workbench",
  "Get home before it is dark, and sleep in your hammock",
  "Build the Cooking fire. Spear a fish in Mirror Lake (east) and cook it",
  "Build the Lookout, so your map shows where the dinosaurs are",
  "Take an egg from a nest in the Raptor Woods (north-east). Be careful: the raptors will not like it!",
  "Build the Nest box and put the egg in it. It hatches the next morning",
  "Feed your baby raptor (press E beside it) until it is fully grown",
  "Find the giant tooth on Rex Ridge (north) and build the Great horn",
  "Live on the island for 7 nights",
];
