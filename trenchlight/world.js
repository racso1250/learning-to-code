// Trenchlight: the world.
// This file has no drawing in it. It is the "rule book": how big the sea is,
// what you can dig up, what you can build, and where the leviathans live.

// The sea is a giant round crater under the ice. The middle is the deepest part.
const WORLD = 520;                 // how far the crater goes from its middle (in metres)
const ICE = -4;                    // the sub can't go higher than this: there is ice on top
const LIFT = { x: 0, z: 430 };     // where the Lift (your first home) stands

// ----- Random numbers that come out the same every time -----
// (So the sea is the same sea every time you play.)
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

// ----- The five layers of the crater -----
// "from" is how far from the middle the layer starts. "deep" is how deep its floor is.
const LAYERS = [
  { id: "shelf",   name: "Frostlight Shelf", from: 330, deep: 38,  ground: 0x6f9db8 },
  { id: "forest",  name: "Glimmer Forest",   from: 240, deep: 96,  ground: 0x2c6a5c },
  { id: "arches",  name: "Sunken Arches",    from: 150, deep: 172, ground: 0x5b4c80 },
  { id: "smokers", name: "Smoker Fields",    from: 70,  deep: 262, ground: 0x3a2a2c },
  { id: "abyss",   name: "The Abyss",        from: 0,   deep: 384, ground: 0x16162a },
];

// Which layer is this spot in?
function layerAt(x, z) {
  const r = Math.hypot(x, z);
  for (const layer of LAYERS) {
    if (r >= layer.from) return layer;
  }
  return LAYERS[LAYERS.length - 1];
}

// How high is the sea bed here? (A negative number: -38 means 38 metres down.)
function groundAt(x, z) {
  const r = Math.hypot(x, z);
  let deep = LAYERS[0].deep;
  // Each layer drops down a cliff into the next one
  for (let i = 1; i < LAYERS.length; i++) {
    deep += (LAYERS[i].deep - LAYERS[i - 1].deep) * smooth((LAYERS[i - 1].from + 16 - r) / 32);
  }
  // Hills and dips
  deep += (bumps(x * 0.018 + 40, z * 0.018 + 40) - 0.5) * 14 + (bumps(x * 0.07, z * 0.07) - 0.5) * 4;
  // A flat pad for the Lift to stand on
  const pad = smooth(1 - Math.hypot(x - LIFT.x, z - LIFT.z) / 36);
  deep = deep * (1 - pad) + LAYERS[0].deep * pad;
  // The crater's rim climbs all the way up to the ice
  const rim = smooth((r - 478) / 40);
  return -deep * (1 - rim) + 3 * rim;
}

// Pick a random spot inside a layer (not too close to its cliffs)
function spotIn(id, rand, margin) {
  const i = LAYERS.findIndex(function (layer) { return layer.id === id; });
  const inner = i === LAYERS.length - 1 ? 16 : LAYERS[i].from + margin;
  const outer = (i === 0 ? 474 : LAYERS[i - 1].from) - margin;
  const r = Math.sqrt(rand() * (outer * outer - inner * inner) + inner * inner);
  const a = rand() * Math.PI * 2;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

// ----- Things you can drill out of the sea bed -----
// "where" says which layers it grows in, and how many lumps of it there are.
const ORES = {
  ice:   { name: "Frost crystal", colour: 0xcdf4ff, glow: 0x2a6a7a, where: { shelf: 46 } },
  iron:  { name: "Iron nodule",   colour: 0xb09a88, glow: 0x2a1c12, where: { shelf: 38, forest: 22, arches: 14 } },
  moss:  { name: "Glow moss",     colour: 0x6dff8e, glow: 0x1f9a44, where: { forest: 38 } },
  amber: { name: "Sea amber",     colour: 0xffb53c, glow: 0x9a5a10, where: { arches: 36 } },
  magma: { name: "Magma glass",   colour: 0xff5c3a, glow: 0xa02410, where: { smokers: 30 } },
  pearl: { name: "Void pearl",    colour: 0xb884ff, glow: 0x5a2ab0, where: { abyss: 16 } },
};

// ----- Ways to make your sub better (made at a dock, if you have a workshop) -----
// Each one has levels. The first level is what you start with.
const UPGRADES = {
  hull: { name: "Hull", levels: [
    { limit: 120, hp: 100 },
    { limit: 210, hp: 140, cost: { iron: 6, moss: 4 }, what: "Dive down to 210 m (the Sunken Arches)" },
    { limit: 310, hp: 180, cost: { iron: 6, amber: 6 }, what: "Dive down to 310 m (the Smoker Fields)" },
    { limit: 470, hp: 240, cost: { amber: 4, magma: 6 }, what: "Dive all the way down into the Abyss" },
  ] },
  drill: { name: "Drill", levels: [
    { time: 1.5, gives: 1 },
    { time: 1.0, gives: 2, cost: { ice: 4, iron: 4 }, what: "Drill faster and get 2 from every lump" },
    { time: 0.6, gives: 3, cost: { amber: 4, magma: 2 }, what: "Drill very fast and get 3 from every lump" },
  ] },
  cargo: { name: "Cargo bay", levels: [
    { holds: 20 },
    { holds: 40, cost: { ice: 5, iron: 5 }, what: "Carry 40 things" },
    { holds: 70, cost: { amber: 5, moss: 5 }, what: "Carry 70 things" },
  ] },
  battery: { name: "Battery", levels: [
    { energy: 100 },
    { energy: 160, cost: { moss: 5, ice: 3 }, what: "A bigger battery (160)" },
    { energy: 240, cost: { magma: 4, pearl: 2 }, what: "A huge battery (240)" },
  ] },
  engine: { name: "Engine", levels: [
    { speed: 14 },
    { speed: 17, cost: { iron: 5, moss: 3 }, what: "Go faster" },
    { speed: 20, cost: { magma: 3, pearl: 3 }, what: "Go much faster" },
  ] },
  decoy: { name: "Decoy launcher", levels: [
    { decoys: 0 },
    { decoys: 3, cost: { moss: 3, iron: 2 }, what: "Press G to drop a glowing decoy. Leviathans chase it, not you. Carries 3" },
    { decoys: 6, cost: { amber: 3, moss: 3 }, what: "Carry 6 decoys" },
  ] },
  pulse: { name: "Shock pulse", levels: [
    { pulse: false },
    { pulse: true, cost: { amber: 3, moss: 3 }, what: "Press R to stun any leviathan close to you" },
  ] },
};

// ----- Pieces for your base -----
// makes / uses = power. A piece that uses power only works if its base makes enough.
// r = how wide it is, tall = how tall (the sub bumps into it).
const MODULES = {
  dock:     { name: "Docking ring",    cost: { ice: 3, iron: 3 }, r: 7,   tall: 0,  what: "The heart of a new base. Park here to fix your sub, save, and unload" },
  turbine:  { name: "Current turbine", cost: { iron: 3 },         r: 2.5, tall: 9,  makes: 4, what: "Spins in the sea current and makes 4 power" },
  workshop: { name: "Workshop",        cost: { ice: 4, iron: 4 }, r: 4.5, tall: 6,  uses: 2, what: "Lets you make your sub better when you park at a dock. Uses 2 power" },
  silo:     { name: "Cargo silo",      cost: { iron: 4 },         r: 3,   tall: 8,  what: "Your store room holds 20 more of everything" },
  shock:    { name: "Shock tower",     cost: { iron: 4, moss: 3 }, r: 2,  tall: 12, uses: 2, what: "Zaps any leviathan that comes close to your base. Uses 2 power" },
  sonar:    { name: "Sonar tower",     cost: { ice: 4, moss: 2 }, r: 2,   tall: 11, uses: 1, what: "Always shows leviathans near this base on your radar and map. Uses 1 power" },
  rig:      { name: "Mining rig",      cost: { iron: 5, moss: 2 }, r: 3.5, tall: 8, uses: 2, what: "Digs up something for your store room every little while. Uses 2 power" },
  dome:     { name: "Glass dome",      cost: { ice: 6, iron: 2 }, r: 5.5, tall: 6,  uses: 1, what: "A cosy glass garden to make your base a home. Uses 1 power" },
  lamp:     { name: "Glow lamp",       cost: { moss: 1 },         r: 0.8, tall: 5,  what: "A light to find your way home in the dark" },
};

// What a mining rig digs up depends on the layer it stands in
const RIG_DIGS = { shelf: "ice", forest: "moss", arches: "amber", smokers: "magma", abyss: "pearl" };

// ----- The leviathans -----
// see  = how far away it spots your sub with its lights on
// dark = how far away it spots your sub with its lights off
// chase = how fast it swims when it hunts (your sub starts at 14, or 24 with boost)
const GIANTS = {
  lanternmaw: {
    name: "Lanternmaw", home: { x: -205, z: 195 }, roam: 60, leash: 125,
    see: 78, dark: 22, speed: 6, chase: 13, turn: 1.1, bite: 30, reach: 12, jaws: 8, clear: 8,
    tip: "LANTERNMAW! It hunts lights. Press L to switch yours off and slip away in the dark.",
  },
  ribbonwyrm: {
    name: "Ribbonwyrm", home: { x: 150, z: -125 }, ring: 195, leash: 62,
    see: 48, dark: 40, speed: 15, chase: 21, turn: 1.6, bite: 25, reach: 5, jaws: 6, clear: 6,
    tip: "RIBBONWYRM! It swims round and round the Arches. Boost (Shift) out of its way.",
  },
  boulderclaw: {
    name: "Boulderclaw", home: { x: -82, z: -74 }, leash: 95,
    see: 40, dark: 40, speed: 9.5, chase: 9.5, turn: 1.4, bite: 35, reach: 0, jaws: 15, clear: 2,
    tip: "BOULDERCLAW! That rock was alive. It can't swim: stay high above it.",
  },
  gloomking: {
    name: "The Gloomking", home: { x: 0, z: 0 }, roam: 22, leash: 92,
    see: 72, dark: 60, speed: 4, chase: 8, turn: 0.7, bite: 40, reach: 0, jaws: 34, clear: 26,
    tip: "THE GLOOMKING! Its arms pull you in. Boost away, or stun it with a shock pulse (R).",
  },
};

// Where each power core lies: right in a leviathan's home
const CORE_SPOTS = {
  lanternmaw: { x: -205, z: 195 },
  ribbonwyrm: { x: 150, z: -125 },
  boulderclaw: { x: -72, z: -62 },
  gloomking: { x: 0, z: 0 },
};

// Make the list of every lump you can drill: [{ kind, x, z }]
function makeNodes() {
  const rand = seeded(77);
  const list = [];
  for (const kind in ORES) {
    for (const id in ORES[kind].where) {
      let made = 0;
      while (made < ORES[kind].where[id]) {
        const spot = spotIn(id, rand, 14);
        // Not on top of the Lift
        if (Math.hypot(spot.x - LIFT.x, spot.z - LIFT.z) < 24) continue;
        list.push({ kind: kind, x: spot.x, z: spot.z });
        made++;
      }
    }
  }
  return list;
}
