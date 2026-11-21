// Farshore: the world.
// This file is the "rule book". It has no drawing in it: it says how high the land is,
// where the islands are, what you can pick up, and what you can make and build.

const EDGE = 430;    // how far you can go from the middle of the map (in metres)
const CELL = 4;      // every room of your base is 4 metres wide and long...
const TALL = 3;      // ...and 3 metres tall

// ----- Random numbers that come out the same every time -----
function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Goes smoothly from 0 to 1
function smooth(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// Lumpy "noise": a number from 0 to 1 that changes gently from place to place
function hash(ix, iz) {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function bumps(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

// ----- The islands -----
// r = how wide the island's hill is. h = how high its top is (the sea is at 0).
// sharp = bigger numbers make a pointier mountain.
const ISLANDS = [
  { id: "home",  name: "Landing Isle", x: 0,    z: 120,  r: 140, h: 20, sharp: 1 },
  { id: "green", name: "Greenback",    x: -240, z: 70,   r: 125, h: 15, sharp: 1 },
  { id: "peak",  name: "Thunder Peak", x: 40,   z: -270, r: 135, h: 90, sharp: 1.5 },
  { id: "shoal", name: "Stack Shoal",  x: 130,  z: 10,   r: 60,  h: -4, sharp: 1 },
  { id: "gull",  name: "Gull Rock",    x: 310,  z: 10,   r: 55,  h: 7,  sharp: 1 },
];
const ATOLL = { x: 235, z: 160, r: 62 };                 // a ring of sand around a lagoon
const STACK = { x: 130, z: 10, r: 5.5, top: 12.4 };      // a tall rock nobody can climb
const TOWER = { x: -30, z: 140 };                        // the old signal tower
const TRENCH = { x: -280, z: -250 };                     // the deepest place in the sea

function isle(id) {
  return ISLANDS.find(function (one) { return one.id === id; });
}

// How high is the ground here? Under the sea it is a negative number.
function groundAt(x, z) {
  // The sea bed, with gentle hills
  let h = -24 + (bumps(x * 0.02 + 9, z * 0.02 + 9) - 0.5) * 8 + (bumps(x * 0.08, z * 0.08) - 0.5) * 2;
  // Each island is a smooth hill added on top
  for (const one of ISLANDS) {
    const far = Math.hypot(x - one.x, z - one.z);
    if (far >= one.r) continue;
    const s = Math.pow(smooth(1 - far / one.r), one.sharp);
    h += (one.h + 24) * s;
    if (one.h > 0) h += (bumps(x * 0.05 + 3, z * 0.05) - 0.5) * 5 * s;
  }
  // The atoll: a ring of sand (higher on its east and west sides) with a shallow lagoon inside
  const ax = x - ATOLL.x;
  const az = z - ATOLL.z;
  const far = Math.hypot(ax, az);
  if (far < ATOLL.r + 50) {
    const side = far > 1 ? Math.abs(ax / far) : 1;
    h += 29 * Math.exp(-Math.pow((far - ATOLL.r) / 15, 2)) * (0.35 + 0.65 * side);
    h += 15 * smooth(1 - far / ATOLL.r);
  }
  // The deep channel between Landing Isle and Thunder Peak
  h -= 36 * Math.exp(-Math.pow((z + 85) / 40, 2)) * smooth((340 - Math.abs(x)) / 120);
  // The trench
  h -= 92 * Math.exp(-Math.pow((x - TRENCH.x) / 110, 2) - Math.pow((z - TRENCH.z) / 36, 2));
  return h;
}

// ----- Things you can pick up -----
const STUFF = {
  wood:    { name: "Driftwood",    colour: 0xb98a5a },
  stone:   { name: "Stone",        colour: 0x9a94a8 },
  fibre:   { name: "Reed fibre",   colour: 0xb8d86a },
  fruit:   { name: "Sunfruit",     colour: 0xff9a2a },
  shell:   { name: "Spiral shell", colour: 0xffb8d0 },
  copper:  { name: "Copper",       colour: 0xd8823a },
  crystal: { name: "Sea crystal",  colour: 0x7af0ff },
  pearl:   { name: "Moon pearl",   colour: 0xf4f0ff },
};

// Where each thing is found. "isles" = scattered on those islands. "low" and "high" = how high the ground must be.
const SPAWN = [
  { kind: "wood",    count: 64, low: 0.8,  high: 14,  isles: ["home", "home", "green", "green", "green", "gull"] },
  { kind: "stone",   count: 52, low: 1,    high: 80,  isles: ["home", "home", "green", "peak", "peak", "gull"] },
  { kind: "fibre",   count: 44, low: 0.4,  high: 9,   isles: ["home", "home", "green", "green", "gull"] },
  { kind: "fruit",   count: 18, low: 3,    high: 16,  isles: ["home", "green", "green"] },
  { kind: "shell",   count: 44, low: -9,   high: -0.8 },
  { kind: "copper",  count: 32, low: -30,  high: -7,  south: true },
  { kind: "crystal", count: 30, low: -45,  high: -11 },
  { kind: "pearl",   count: 16, low: -200, high: -48 },
];

// ----- The five star stones you must find -----
const STONES = [
  { id: "lagoon", name: "the Lagoon Stone", x: ATOLL.x, z: ATOLL.z },
  { id: "forest", name: "the Forest Stone", x: -240, z: 70 },
  { id: "stack",  name: "the Stack Stone",  x: STACK.x, z: STACK.z, y: STACK.top },
  { id: "peak",   name: "the Storm Stone",  x: 40, z: -270 },
  { id: "trench", name: "the Deep Stone",   x: TRENCH.x, z: TRENCH.z },
];

// ----- Gear you can make at a workbench -----
const GEAR = {
  tank2:    { name: "Big air tank",   what: "Hold your breath for 90 seconds", cost: { shell: 3, fibre: 2 } },
  tank3:    { name: "Giant air tank", what: "Hold your breath for 170 seconds", cost: { copper: 4, crystal: 3 }, needs: "tank2" },
  flippers: { name: "Flippers",       what: "Swim much faster", cost: { fibre: 3, shell: 2 } },
  boots:    { name: "Spring boots",   what: "Jump much higher", cost: { fibre: 2, copper: 2 } },
  light:    { name: "Dive light",     what: "A torch for dark water. Press L", cost: { copper: 2, crystal: 1 } },
  horn:     { name: "Sea horn",       what: "Press R to scare the Deepmaw away for a while", cost: { shell: 3, copper: 1 } },
};

// ----- Things you can build (press B) -----
// face = it changes a wall. item = it is a thing that stands inside a room.
const PARTS = {
  room:    { name: "Room",        what: "A room block. Rooms that touch join into one big room. Build on land, in the sea, or on top of other rooms", cost: { wood: 3, stone: 2 } },
  door:    { name: "Door",        what: "Turns the wall you are looking at into a door", cost: { wood: 1 }, face: "door" },
  window:  { name: "Window",      what: "Turns the wall you are looking at into a window", cost: { crystal: 1 }, face: "window" },
  wall:    { name: "Plain wall",  what: "Turns a door or window back into a wall", cost: {}, face: "wall" },
  bed:     { name: "Bed",         what: "Sleep here to save. If you are badly hurt, you wake up here", cost: { wood: 2, fibre: 2 }, item: true },
  bench:   { name: "Workbench",   what: "Make diving gear here", cost: { wood: 3, stone: 2 }, item: true },
  planter: { name: "Sunfruit pot", what: "Grows sunfruit for you to eat", cost: { wood: 1, fibre: 1, fruit: 1 }, item: true },
  lamp:    { name: "Lamp",        what: "A warm light for your room", cost: { crystal: 1, copper: 1 }, item: true },
  table:   { name: "Table",       what: "Somewhere to put your shells", cost: { wood: 2 }, item: true },
  bowl:    { name: "Fish bowl",   what: "A little glowing pet fish", cost: { crystal: 2, shell: 1 }, item: true },
};

// Make the list of everything you can pick up: [{ kind, x, y, z }]
function makeNodes() {
  const rand = seeded(404);
  const list = [];
  for (const rule of SPAWN) {
    let made = 0;
    let tries = 0;
    while (made < rule.count && tries++ < 60000) {
      let x;
      let z;
      if (rule.isles) {
        const one = isle(rule.isles[Math.floor(rand() * rule.isles.length)]);
        const a = rand() * Math.PI * 2;
        const far = Math.sqrt(rand()) * one.r * 0.62;
        x = one.x + Math.cos(a) * far;
        z = one.z + Math.sin(a) * far;
      } else {
        x = (rand() * 2 - 1) * (EDGE - 15);
        z = (rand() * 2 - 1) * (EDGE - 15);
        if (rule.south && z < 0) continue;
      }
      const y = groundAt(x, z);
      if (y < rule.low || y > rule.high) continue;
      // Not right on top of a star stone, the tower or the tall rock
      if (Math.hypot(x - TOWER.x, z - TOWER.z) < 9 || Math.hypot(x - STACK.x, z - STACK.z) < 9) continue;
      list.push({ kind: rule.kind, x: x, y: y, z: z });
      made++;
    }
  }
  return list;
}
