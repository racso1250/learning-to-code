// Fossil Bay: Wild Again. The rule book.
// No drawing in here. This file says where everything on the island is, which creatures live
// there and how they behave, what you can find, and the jobs of your expedition.

// ----- Places (x is east, z is south, in metres) -----
const SHIP = { x: 40, z: 372 };                              // your expedition ship, anchored out at sea
const DOCK = { x: 0, z: 190, name: "The Old Dock" };
// Wooden piers you can walk along, out to where the water is deep enough for the boat: { x, z0, z1 }
const PIERS = [{ x: 0, z0: 193, z1: 218 }, { x: 384, z0: 8, z1: 30 }];
// The old road from the dock to the Visitor Centre, and the trail on to the cliffs (lists of corners)
const ROAD = [{ x: 0, z: 192 }, { x: 8, z: 150 }, { x: -4, z: 115 }, { x: 0, z: 92 }];
const TRAIL = [{ x: 0, z: 46 }, { x: -6, z: -40 }, { x: -6, z: -110 }, { x: -28, z: -158 }];
const PEN = { x0: 404, z0: -24, x1: 420, z1: -8 };           // where the old park locked something away
const CENTRE = { x: 0, z: 70, r: 24, name: "The Visitor Centre" };
const PLAINS = { x: -135, z: 40, r: 62, name: "The Plains" };
const LAKE = { x: 120, z: 50, r: 32, name: "Still Lake" };
const MARSH = { x: 95, z: 150, r: 38, name: "Spitter Marsh" };
const JUNGLE = { x: 60, z: -50, r: 60, name: "Raptor Jungle" };
const CLIFFS = { x: -30, z: -175, r: 72, name: "The Aviary Cliffs" };
const ROCK = { x: 392, z: -30, r: 40, name: "Lab Rock" };       // a little island of its own, off the east coast
const LAB = { x: 398, z: -38 };
const TOWERS = [{ x: 14, z: 178 }, { x: -70, z: 60 }, { x: 22, z: 44 }, { x: -12, z: -108 }, { x: 374, z: -10 }];

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

// How far a spot is from a bendy line (a list of corners)
function nearLine(x, z, corners) {
  let best = 9999;
  for (let n = 0; n < corners.length - 1; n++) {
    const a = corners[n];
    const b = corners[n + 1];
    const t = clamp(((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / ((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z)), 0, 1);
    best = Math.min(best, Math.hypot(x - a.x - (b.x - a.x) * t, z - a.z - (b.z - a.z) * t));
  }
  return best;
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
  // The main island: a wobbly oval
  const far = Math.hypot(x * 0.9, z);
  const angle = Math.atan2(z, x * 0.9);
  const edge = 235 + 20 * Math.sin(angle * 3 + 1.3) + 10 * Math.sin(angle * 6 + 0.4);
  let high = 3.2 + 2 * Math.sin(x * 0.021 + 2) * Math.cos(z * 0.018) + 1.2 * Math.sin(x * 0.047 + z * 0.04);
  high += 28 * bump(x, z, CLIFFS, CLIFFS.r);
  high -= 9 * bump(x, z, LAKE, LAKE.r);
  high -= 4.2 * bump(x, z, MARSH, MARSH.r);
  high += (3.4 - high) * smooth((30 - gap({ x: x, z: z }, CENTRE)) / 12);     // flat ground at the Visitor Centre
  const main = -8 + (high + 8) * smooth((edge - far) / 45);
  // Lab Rock: a small flat-topped island
  const rock = -8 + 12.5 * smooth((62 - gap({ x: x, z: z }, ROCK)) / 36);
  return Math.max(main, rock);
}

// The name of the place you are in
function placeAt(x, z) {
  const here = { x: x, z: z };
  if (groundAt(x, z) < -0.6) return "The sea";
  if (gap(here, DOCK) < 26) return DOCK.name;
  for (const place of [CENTRE, ROCK, LAKE, MARSH, PLAINS, JUNGLE, CLIFFS]) {
    if (gap(here, place) < place.r) return place.name;
  }
  return groundAt(x, z) < 1.2 ? "The shore" : "The wild forest";
}

// ----- Creatures -----
// Each row: id, name, body plan, length in metres, three colours (body, belly, trim), special features,
// and a fact for your field guide. (The body plans are explained in scene.js, where they are built.)
const ROWS = [
  ["compy", "Compsognathus", "R", 1.1, 0x6a9a4a, 0xd8e8b0, 0x3a5a2a, "", "About as big as a chicken. It hunted lizards and insects."],
  ["galli", "Gallimimus", "O", 5.5, 0xd8b070, 0xf0e0b0, 0x7a5a3a, "", "Its name means chicken mimic. It could run as fast as a racehorse."],
  ["para", "Parasaurolophus", "H", 9, 0xd98a3a, 0xf0d8a0, 0xc8402a, "tube", "The long crest on its head was hollow, and worked like a trumpet."],
  ["tri", "Triceratops", "C", 8, 0x8a9a6a, 0xd8d0a8, 0xf4ecd8, "frill horns3", "Three horns and a bony frill. Its skull was as long as a sofa."],
  ["steg", "Stegosaurus", "G", 8.5, 0x5a9a4a, 0xc8d8a0, 0xe8823a, "plates thagomizer", "Big plates down its back, four spikes on its tail, and a brain the size of a plum."],
  ["anky", "Ankylosaurus", "A", 7, 0x9a8a5a, 0xd8d0a8, 0xe8dcc0, "armour sidespikes club", "A living tank. The club on its tail could break a leg bone."],
  ["brach", "Brachiosaurus", "S", 22, 0x7a8aa0, 0xb8c4d0, 0x6a7a90, "tall bump", "As tall as a four-storey house. It ate leaves from the tops of trees."],
  ["dilo", "Dilophosaurus", "T", 5.5, 0x6a9a3a, 0xc8d88a, 0xffd23a, "crest2", "It had two thin crests on its head. (The spitting was made up for films, and for this game!)"],
  ["raptor", "Velociraptor", "R", 3.4, 0x8a5a3a, 0xe0c8a0, 0x2a2a2a, "feathers", "Real ones were the size of a turkey, and covered in feathers."],
  ["rex", "Tyrannosaurus rex", "T", 12.5, 0x6a4a3a, 0xd8b890, 0x3a2a1a, "", "Its bite was the strongest of any land animal that ever lived."],
  ["ptera", "Pteranodon", "fly", 6, 0xc8a070, 0xf0e0c0, 0xd8442e, "", "Not a dinosaur but a flying reptile. Its wings were wider than a small plane's."],
  ["mosa", "Mosasaurus", "swim", 15, 0x3a5a6a, 0xc8d8d8, 0x2a3a4a, "", "Not a dinosaur but a giant sea lizard, as long as a bus."],
  // The hybrids: mutants that Genetics Lab 9 made in secret by mixing dinosaurs together. Nothing like them ever lived.
  ["hstalk", "Thorn Stalker", "R", 4.6, 0x4a2a5a, 0xc8b8d8, 0xff7a2a, "feathers spiky crest1 backspikes", "Hybrid. Part raptor, part thorn-headed dome-skull. It hunts in pairs and never gives up easily."],
  ["hlurk", "Sail Lurker", "T", 10, 0x2a5a5a, 0xb8d8c8, 0x7dff8a, "snout sail armour", "Hybrid. A fish-eater's long jaws, a tall sail and an armoured back. It lies in wait in the marsh."],
  ["htitan", "Thunderhorn", "S", 24, 0x8a6a8a, 0xd8c8d8, 0xffd23a, "tall bump frill horns3", "Hybrid. A long-neck giant with a three-horned head. Huge, but as gentle as a cow."],
  ["boss", "the Emperor", "T", 15, 0x4a2a3a, 0xc8a8a0, 0xff5a3a, "armour sidespikes club browhorns ridge", "Hybrid. The lab's biggest secret: a giant armoured hunter with a hammer for a tail. They locked it away and ran."],
];
const HYBRIDS = ["hstalk", "hlurk", "htitan", "boss"];
const SPECIES = {};
for (const row of ROWS) {
  SPECIES[row[0]] = { name: row[1], plan: row[2], size: row[3], a: row[4], b: row[5], c: row[6], feats: row[7].split(" ").filter(Boolean), fact: row[8], diet: ["compy", "dilo", "raptor", "rex", "boss", "hstalk", "hlurk"].includes(row[0]) ? "meat" : "plants" };
}
// The twelve real kinds that count for your survey. (The four hybrids are a surprise.)
const SURVEY = ROWS.map(function (row) { return row[0]; }).filter(function (kind) { return !HYBRIDS.includes(kind); });

// Where each kind lives, how many there are, how fast it walks and runs, and how it behaves:
//   shy = runs away from you, calm = ignores you, grumpy = hits you if you get too close,
//   pest = nips at you, spitter = spits from far away, hunter = chases and bites.
const HERDS = [
  { kind: "compy", count: 5, at: { x: -20, z: 150, r: 45 }, walk: 1.6, run: 6.5, act: "pest" },
  { kind: "compy", count: 4, at: { x: -60, z: -60, r: 45 }, walk: 1.6, run: 6.5, act: "pest" },
  { kind: "galli", count: 6, at: PLAINS, walk: 2.4, run: 11, act: "shy" },
  { kind: "para", count: 4, at: PLAINS, walk: 1.8, run: 5, act: "shy" },
  { kind: "tri", count: 3, at: { x: -150, z: -10, r: 40 }, walk: 1.4, run: 7, act: "grumpy" },
  { kind: "steg", count: 2, at: { x: -80, z: 120, r: 40 }, walk: 1.2, run: 3, act: "grumpy" },
  { kind: "anky", count: 2, at: { x: -150, z: 90, r: 35 }, walk: 1.1, run: 2.5, act: "grumpy" },
  { kind: "brach", count: 3, at: { x: 135, z: 85, r: 45 }, walk: 1.5, run: 1.5, act: "calm" },
  { kind: "dilo", count: 3, at: MARSH, walk: 1.8, run: 6, act: "spitter" },
  { kind: "raptor", count: 3, at: JUNGLE, walk: 2.2, run: 8.8, act: "hunter" },
  { kind: "raptor", count: 2, at: { x: 30, z: 20, r: 40 }, walk: 2.2, run: 8.8, act: "hunter" },
  { kind: "rex", count: 1, at: { x: -60, z: -80, r: 60 }, walk: 3, run: 7.6, act: "hunter" },
  // The hybrids that got out of the lab
  { kind: "hstalk", count: 2, at: { x: 388, z: -62, r: 20 }, walk: 2.2, run: 8.6, act: "hunter" },
  { kind: "hlurk", count: 1, at: { x: 70, z: 135, r: 30 }, walk: 1.6, run: 6.8, act: "hunter" },
  { kind: "htitan", count: 1, at: { x: -95, z: -40, r: 40 }, walk: 1.5, run: 1.5, act: "calm" },
];

// ----- Things to find -----
// The three data drives of the old park, and crates of supplies
const DRIVES = [
  { x: CENTRE.x - 3, z: CENTRE.z - 2, where: "the Visitor Centre" },
  { x: CLIFFS.x, z: CLIFFS.z, where: "the Aviary" },
  { x: LAB.x + 3, z: LAB.z - 2, where: "the lab" },
];
const CRATES = [
  { x: -7, z: 184, has: "flare" }, { x: 5, z: 66, has: "medkit" }, { x: -8, z: 78, has: "flare" },
  { x: -72, z: 66, has: "medkit" }, { x: -24, z: -168, has: "flare" }, { x: -16, z: -102, has: "medkit" },
  { x: 384, z: -14, has: "medkit" }, { x: 380, z: -22, has: "flare" }, { x: 110, z: 96, has: "flare" },
];

// ----- The jobs of your expedition, one after another -----
const GOALS = [
  "Steer the motor boat to the Old Dock on the island (W, A, S, D). When you are beside it, press E to step ashore",
  "Scan your first dinosaur: get one in the middle of your view and hold Space. (Watchtowers are safe places to scan from)",
  "Follow the old road north to the ruined Visitor Centre, and find data drive 1",
  "Climb to the broken Aviary on the northern cliffs for drive 2. Press C to duck when a Pteranodon swoops!",
  "Go back to your boat and sail round the east coast to Lab Rock. Something very big lives in that water...",
  "Find data drive 3 inside the old lab",
  "THE EMPEROR IS LOOSE! Run to your boat! (Press G to throw a flare: it will stop and look)",
  "Get back to your ship!",
];
