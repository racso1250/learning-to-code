// Camp Fossil Bay: the rule book.
// No drawing in here. This file makes the map of the island, and lists the six campers,
// the dinosaurs, and everything on the way from camp to the ferry.

const TILE = 2;                 // the island is a grid of squares, each 2 metres wide
const COLS = 112;
const ROWS = 64;
const BIG = 1;                  // dinosaurs are drawn life size in this game

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

// ----- The six campers -----
// Each has a look, and one special skill that the others don't have.
//   skill: what they can do. needs: the kind of obstacle only they can deal with.
const CAMPERS = [
  { id: "tavi", name: "Tavi", hair: 0x2a2228, shirt: 0xffb02a, skin: 0xc8946a, job: "Runner", what: "Q: dash at top speed for a few seconds" },
  { id: "bex", name: "Bex", hair: 0xd8442e, shirt: 0x4aa84a, skin: 0xf4c8a0, job: "Climber", what: "E: climb cliffs and towers marked with a rope" },
  { id: "milo", name: "Milo", hair: 0xe8c04a, shirt: 0x4a9ad8, skin: 0xf0c098, job: "Fixer", what: "E: mend fuse boxes and open locked gates" },
  { id: "ren", name: "Ren", hair: 0x5a3a1a, shirt: 0x8a5ac8, skin: 0xe0a878, job: "Dinosaur friend", what: "E: calm plant-eaters. Q: tell Bonk to charge!" },
  { id: "gus", name: "Gus", hair: 0x3a2a1a, shirt: 0xd8442e, skin: 0x9a6a48, job: "Strong one", what: "E: push logs and boulders out of the way" },
  { id: "nell", name: "Nell", hair: 0xf4f4f4, shirt: 0xff8ab8, skin: 0xf4d0b0, job: "Cook", what: "Q: share a snack that gives everyone two hearts back" },
];

// Where each friend is when the game starts, and what they say when you find them
const FRIENDS = {
  bex: { i: 19, k: 40, line: "Up here! I climbed the zipline tower when the roaring started. Hang on, I'll slide down!" },
  milo: { i: 11, k: 17, line: "You found the key! I got locked in the mess hall. I've eaten SO many crackers." },
  ren: { i: 20, k: 18, line: "Shhh, you'll scare him. This is Bonk. He's a baby Pachycephalosaurus, and he hasn't got anyone either. He's coming with us." },
  gus: { i: 12, k: 45, line: "I was hiding under a kayak. Don't laugh. It was a very good kayak." },
  nell: { i: 5, k: 10, line: "I'm up in the treehouse! I saved all the snacks from the kitchen. Well. Most of them." },
};

// ----- Dinosaurs -----
// Each row: id, name, body plan, length in metres, three colours, and its special features.
const ROWS_OF_DINOS = [
  ["compy", "Compsognathus", "R", 1.2, 0x6a9a4a, 0xd8e8b0, 0x3a5a2a, ""],
  ["galli", "Gallimimus", "O", 5.5, 0xd8b070, 0xf0e0b0, 0x7a5a3a, ""],
  ["tri", "Triceratops", "C", 8, 0x8a9a6a, 0xd8d0a8, 0xf4ecd8, "frill horns3"],
  ["brach", "Brachiosaurus", "S", 22, 0x7a8aa0, 0xb8c4d0, 0x6a7a90, "tall bump"],
  ["para", "Parasaurolophus", "H", 9, 0xd98a3a, 0xf0d8a0, 0xc8402a, "tube"],
  ["raptor", "Velociraptor", "R", 3.6, 0x4a6a8a, 0xc8d0e0, 0xff7a2a, "feathers stripes"],
  ["rex", "Tyrannosaurus rex", "T", 12.5, 0x7a4a32, 0xd8b890, 0x4a2a1a, ""],
  ["bonk", "Bonk", "P", 1.9, 0x5ab8a0, 0xe0f4e8, 0xffd23a, "dome knobs"],
  // The Shimmer: something the island's lab made. It can change colour to match whatever is behind it.
  ["ghost", "the Shimmer", "T", 8.5, 0x8aa89a, 0xd0e0d8, 0xff3a2a, "backspikes longarms redeyes stripes"],
];
const SPECIES = {};
for (const row of ROWS_OF_DINOS) {
  SPECIES[row[0]] = { name: row[1], plan: row[2], size: row[3], a: row[4], b: row[5], c: row[6], feats: row[7].split(" ").filter(Boolean), diet: ["compy", "raptor", "rex", "ghost"].includes(row[0]) ? "meat" : "plants" };
}

// ----- Places -----
const FIRES = [{ i: 12, k: 28, name: "Camp" }, { i: 40, k: 31, name: "The jungle trail" }, { i: 62, k: 31, name: "The plains" }, { i: 90, k: 31, name: "Radio hill" }];
const START = { i: 12, k: 30 };
const PIER = { i: 100, k0: 55, k1: 61 };
const RADIO = { i: 102, k: 18 };

// Things on the map that you do something to. Each has a type, a square, and (for some) who it needs.
//   log: Gus pushes it away.  barricade: Bonk smashes it (Ren, press Q).  climb: Bex climbs it.
//   fusebox: Milo mends it (it needs a fuse).  crate: anybody opens it.  door: needs the key.
//   block: the squares nobody can walk through until it has been dealt with.
const OBJECTS = [
  { id: "key", type: "crate", i: 17, k: 35, has: "key", text: "A cabin key! It has a tag: MESS HALL." },
  { id: "door", type: "door", i: 11, k: 17 },
  { id: "camplog", type: "log", i: 24, k: 29, block: [24, 28, 25, 30] },
  { id: "snack1", type: "crate", i: 30, k: 22, has: "flare" },
  { id: "wall1", type: "barricade", i: 34, k: 29, block: [34, 28, 34, 30] },
  { id: "cliff", type: "climb", i: 42, k: 26, text: "Bex scrambles up the cliff and cuts the rope. The drawbridge crashes down across the river!" },
  { id: "fuse1", type: "crate", i: 61, k: 44, has: "fuse" },
  { id: "rocks", type: "log", i: 57, k: 43, block: [56, 43, 57, 43] },
  { id: "gate", type: "fusebox", i: 65, k: 27, block: [66, 27, 67, 29] },
  { id: "flares2", type: "crate", i: 70, k: 20, has: "flare" },
  { id: "fuse2", type: "crate", i: 77, k: 46, has: "fuse" },
  { id: "wall2", type: "barricade", i: 86, k: 29, block: [86, 28, 87, 30] },
  { id: "station", type: "fusebox", i: 96, k: 24 },
  { id: "tower", type: "climb", i: RADIO.i, k: RADIO.k + 1, text: "Bex climbs the radio tower, hand over hand, and turns the dish to face the sea." },
];

// ----- The story, one job after another -----
const GOALS = [
  "Find your five friends. They are hiding all round the camp. (Walk up to one and press E)",
  "Everybody is together! Head east out of camp. Gus can move that fallen tree (press 5, then E)",
  "Follow the jungle trail east. Something has built a wall of branches across it...",
  "The drawbridge is up. Find a way to bring it down. (Look for a rope on the cliff, north of the trail)",
  "Cross the plains. Watch out for the Gallimimus stampede, and find a way past the Triceratops",
  "The big gate has no power. Find a fuse, then have Milo mend the fuse box (press 3, then E)",
  "Sneak through Raptor Valley. Stay in the long grass, and out of the red view cones. (You will need the fuse from the crate in the south)",
  "Get to the ranger station on Radio Hill. Don't wake what is sleeping there. (Walk, don't run!)",
  "Mend the radio: Milo fixes the fuse box at the station, then Bex climbs the tower",
  "THE T. REX IS AWAKE! Run south to the pier! The ferry is coming!",
];

// ----- The map -----
// Every square has a ground type:
//   grass, tall (long grass you can hide in), path, sand, water, rock (cliff: nobody can walk on it),
//   wood (bridges and piers), floor (inside a building).
function makeMap() {
  const roll = seeded(1993);
  const ground = [];
  const things = {};       // "i,k" -> { type: "tree" / "pine" / "rock" / "wall" / "fence" }
  for (let k = 0; k < ROWS; k++) {
    ground.push([]);
    for (let i = 0; i < COLS; i++) ground[k].push(k >= 58 ? "water" : k >= 55 ? "sand" : "grass");
  }
  function fill(type, i0, k0, i1, k1) {
    for (let i = i0; i <= i1; i++) {
      for (let k = k0; k <= k1; k++) ground[k][i] = type;
    }
  }
  function put(type, i0, k0, i1, k1, extra) {
    for (let i = i0; i <= i1; i++) {
      for (let k = k0; k <= k1; k++) things[i + "," + k] = Object.assign({ type: type }, extra || {});
    }
  }
  // Three cliffs run from north to south and cut the island into four parts. Each has one gap.
  fill("rock", 24, 0, 25, 54);   fill("path", 24, 28, 25, 30);       // the way out of camp
  fill("rock", 66, 0, 67, 54);   fill("path", 66, 27, 67, 29);       // the big gate
  fill("rock", 86, 0, 87, 54);   fill("path", 86, 28, 87, 30);       // the way up to Radio Hill
  fill("rock", 34, 0, 34, 27);   fill("rock", 34, 31, 34, 54);       // a ridge across the jungle trail
  // The river (the drawbridge is not down yet, so the gap in the road is still water)
  for (let k = 0; k < 58; k++) {
    const bend = Math.round(1.5 * Math.sin(k * 0.2));
    fill("water", 44 + bend, k, 46 + bend, k);
  }
  // A lake at camp
  for (let i = 3; i <= 10; i++) {
    for (let k = 40; k <= 48; k++) {
      if (Math.hypot((i - 6.5) / 3.6, (k - 44) / 4.2) < 1) ground[k][i] = "water";
    }
  }
  // The road east, from the campfire to Radio Hill, and a branch south to the pier
  const road = function (i0, k0, i1, k1) {
    for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) {
      for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) {
        if (ground[k][i] === "grass") ground[k][i] = "path";
      }
    }
  };
  road(8, 28, 43, 30);   road(47, 28, 65, 30);   road(68, 28, 85, 30);   road(88, 28, 100, 30);
  road(99, 31, 101, 54); road(96, 24, 98, 28);   road(11, 18, 12, 28);
  fill("wood", PIER.i - 1, 55, PIER.i + 1, PIER.k1);
  // A narrow pass in the plains, between two heaps of rock (the Triceratops like to stand in it)
  fill("rock", 56, 2, 57, 26);   fill("rock", 56, 32, 57, 42);   fill("rock", 56, 44, 57, 54);
  ground[43][56] = ground[43][57] = "path";
  // Long grass in Raptor Valley (and a little elsewhere)
  for (const patch of [[69, 33, 75, 39], [70, 18, 76, 25], [78, 31, 84, 36], [79, 20, 84, 26], [72, 42, 80, 49], [68, 26, 70, 27], [83, 27, 85, 27], [91, 33, 97, 38], [50, 36, 54, 40], [28, 34, 33, 38]]) fill("tall", patch[0], patch[1], patch[2], patch[3]);
  road(68, 28, 85, 30);

  // ----- Buildings (solid) -----
  put("wall", 5, 21, 7, 22, { of: "cabin" });    put("wall", 16, 21, 18, 22, { of: "cabin" });
  put("wall", 5, 33, 7, 34, { of: "cabin" });    put("wall", 16, 33, 18, 34, { of: "cabin" });
  put("wall", 9, 13, 14, 16, { of: "hall" });
  put("wall", 19, 16, 21, 17, { of: "stable" });
  put("wall", 12, 43, 14, 44, { of: "shed" });
  put("wall", 19, 39, 20, 39, { of: "zip" });
  put("wall", 4, 8, 6, 9, { of: "treehouse" });
  put("wall", 95, 20, 100, 23, { of: "station" });
  put("wall", RADIO.i, RADIO.k, RADIO.i, RADIO.k, { of: "tower" });
  // The fence beside the big gate
  put("fence", 66, 26, 67, 26);   put("fence", 66, 30, 67, 30);

  // ----- Trees -----
  // A thick wall of pines round the whole island, and trees scattered everywhere else
  for (let i = 0; i < COLS; i++) {
    for (let k = 0; k < 55; k++) {
      if ((i < 2 || i >= COLS - 2 || k < 2) && ground[k][i] === "grass") things[i + "," + k] = { type: "pine" };
    }
  }
  const density = function (i) { return i < 24 ? 0.05 : i < 44 ? 0.2 : i < 66 ? 0.03 : i < 86 ? 0.07 : 0.06; };
  for (let i = 2; i < COLS - 2; i++) {
    for (let k = 2; k < 55; k++) {
      if (ground[k][i] !== "grass" || things[i + "," + k]) continue;
      // Keep the squares beside paths, buildings and important things clear
      let busy = false;
      for (let di = -1; di <= 1 && !busy; di++) {
        for (let dk = -1; dk <= 1; dk++) {
          const near = ground[clamp(k + dk, 0, ROWS - 1)][clamp(i + di, 0, COLS - 1)];
          if (near === "path" || near === "wood" || things[(i + di) + "," + (k + dk)]) busy = true;
        }
      }
      if (OBJECTS.some(function (o) { return Math.abs(o.i - i) < 2 && Math.abs(o.k - k) < 2; })) busy = true;
      for (const id in FRIENDS) {
        if (Math.abs(FRIENDS[id].i - i) < 2 && Math.abs(FRIENDS[id].k - k) < 3) busy = true;
      }
      if (i >= 88 && i <= 96 && k >= 11 && k <= 19) busy = true;          // where the T. rex sleeps
      if (!busy && roll() < density(i)) things[i + "," + k] = { type: roll() < (i < 44 ? 0.35 : 0.15) ? "pine" : roll() < 0.12 ? "rock" : "tree" };
    }
  }
  return { ground: ground, things: things };
}
