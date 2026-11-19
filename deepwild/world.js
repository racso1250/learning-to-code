// Deepwild: the sea.
// The sea bed is worked out with maths from where you are, so it is the same every time you play.
// Everything is measured in metres. Your raft floats at the middle (0, 0), over a shallow sandbank.
// The further you swim from it, the deeper the water gets, until the sea bed drops away into the Trench.

const WORLD = 430;           // how far from the raft you can swim, in metres

// ----- Repeatable "random" numbers: the same place always gives the same number -----
function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
const step = (from, to, n) => smooth(Math.max(0, Math.min(1, (n - from) / (to - from))));      // 0 below "from", 1 above "to", and a smooth rise in between
// Smooth hills of random numbers (between 0 and 1)
function noise2(x, z, size, seed) {
  const fx = x / size, fz = z / size, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = smooth(fx - x0), tz = smooth(fz - z0);
  const a = hash(x0, z0, seed), b = hash(x0 + 1, z0, seed), c = hash(x0, z0 + 1, seed), d = hash(x0 + 1, z0 + 1, seed);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

// ----- The shape of the sea bed -----
// How deep is the water here? (metres from the surface down to the sand)
function depthAt(x, z) {
  const far = Math.hypot(x, z);
  // The big shape: a sandbank, then gardens and forest, then a long slope, then the Trench
  let deep = 6 + step(20, 110, far) * 14 + step(90, 190, far) * 26 + step(170, 300, far) * 70 + step(285, 400, far) * 185;
  // Hills and hollows on top of that (bigger ones further out)
  deep += (noise2(x, z, 46, 11) - 0.5) * (5 + far * 0.07) + (noise2(x, z, 15, 12) - 0.5) * (2 + far * 0.016) + (noise2(x, z, 5, 13) - 0.5) * 0.8;
  return Math.max(3, deep);
}
// The four parts of the sea. The east side of the middle ring is a kelp forest; the west side is coral gardens.
const ZONES = {
  shallows: { name: "the Sunny Shallows", sand: [0.95, 0.88, 0.62] },
  kelp: { name: "the Kelp Forest", sand: [0.52, 0.6, 0.4] },
  coral: { name: "the Coral Gardens", sand: [0.9, 0.78, 0.66] },
  twilight: { name: "the Twilight Slope", sand: [0.42, 0.46, 0.56] },
  trench: { name: "the Trench", sand: [0.16, 0.16, 0.24] },
};
function zoneAt(x, z) {
  const deep = depthAt(x, z);
  if (deep < 15) return "shallows";
  if (deep < 47) return x + noise2(x, z, 60, 14) * 60 - 30 > 0 ? "kelp" : "coral";
  return deep < 125 ? "twilight" : "trench";
}
// A point at a distance from the raft in a direction (0 degrees is east, 90 is south)
const spot = (degrees, far) => ({ x: Math.cos((degrees * Math.PI) / 180) * far, z: Math.sin((degrees * Math.PI) / 180) * far });

// ----- Special places -----
const WRECK = Object.assign(spot(205, 222), { name: "the sunken boat" });       // at the top of the Twilight Slope...
for (let far = 222; depthAt(WRECK.x, WRECK.z) > 54 && far > 150; far -= 3) Object.assign(WRECK, spot(205, far));      // ...where it is no more than 54 metres down
const HEART = Object.assign(spot(118, 392), { name: "the Great Shell" });       // at the bottom of the Trench
// Four ancient Tide Tablets. You need all of them to open the Great Shell.
const TABLETS = [
  Object.assign(spot(155, 78), { name: "the coral arch", text: "THE FIRST TABLET: \"Long ago the sea had a heart, and the heart kept the water bright.\"" }),
  Object.assign(spot(8, 150), { name: "the tallest kelp", text: "THE SECOND TABLET: \"The Tide Folk hid the heart in a great shell, where the light of the sun cannot reach.\"" }),
  Object.assign({ x: WRECK.x + 6, z: WRECK.z - 3 }, { name: "the sunken boat", text: "THE THIRD TABLET: \"Four stones were carved, so that only a patient swimmer could open the shell.\"" }),
  Object.assign(spot(60, 338), { name: "a ledge in the Trench", text: "THE FOURTH TABLET: \"Bring the four stones to the bottom of the dark. The heart will know a friend.\"" }),
];

// ----- Things scattered over the sea bed -----
// The sea is cut into squares, 7 metres across. Each square may hold one thing, chosen by where it is.
// decor: plants and rocks that are only there to look at (and scan). loot: things you can pick up.
const decor = { kelp: [], coral: [], rock: [], fan: [], bulb: [], spire: [] };
const loot = [];
for (let gz = -Math.ceil(WORLD / 7); gz <= WORLD / 7; gz++) for (let gx = -Math.ceil(WORLD / 7); gx <= WORLD / 7; gx++) {
  const x = gx * 7 + (hash(gx, gz, 21) - 0.5) * 6, z = gz * 7 + (hash(gx, gz, 22) - 0.5) * 6;
  if (Math.hypot(x, z) > WORLD - 6 || Math.hypot(x, z) < 9) continue;
  const zone = zoneAt(x, z), roll = hash(gx, gz, 23), size = 0.7 + hash(gx, gz, 24) * 0.8, at = { x: x, z: z, y: -depthAt(x, z), size: size, turn: hash(gx, gz, 25) * 6.283, tint: hash(gx, gz, 26) };
  const take = (kind) => loot.push(Object.assign({ kind: kind, taken: false, id: loot.length }, at));
  if (zone === "shallows") {
    if (roll < 0.1) take("shell");
    else if (roll < 0.2) decor.coral.push(at);
    else if (roll < 0.26) decor.rock.push(at);
    else if (roll < 0.33) decor.kelp.push(Object.assign(at, { size: size * 0.45 }));
    else if (roll < 0.37) take("kelp");
    else if (roll < 0.385) take("salvage");
  } else if (zone === "kelp") {
    if (roll < 0.5) decor.kelp.push(Object.assign(at, { size: size * 1.5 }));
    else if (roll < 0.6) take("kelp");
    else if (roll < 0.68) decor.rock.push(at);
    else if (roll < 0.74) take("copper");
    else if (roll < 0.77) take("shell");
    else if (roll < 0.8) take("salvage");
  } else if (zone === "coral") {
    if (roll < 0.34) decor.coral.push(at);
    else if (roll < 0.46) decor.fan.push(at);
    else if (roll < 0.54) decor.rock.push(at);
    else if (roll < 0.6) take("shell");
    else if (roll < 0.66) take("copper");
    else if (roll < 0.69) take("kelp");
    else if (roll < 0.72) take("salvage");
  } else if (zone === "twilight") {
    if (roll < 0.12) decor.rock.push(Object.assign(at, { size: size * 1.7 }));
    else if (roll < 0.2) decor.fan.push(at);
    else if (roll < 0.26) take("quartz");
    else if (roll < 0.29) take("salvage");
    else if (roll < 0.33) decor.bulb.push(at);
  } else {
    if (roll < 0.07) decor.spire.push(Object.assign(at, { size: size * 1.6 }));
    else if (roll < 0.17) decor.bulb.push(at);
    else if (roll < 0.2) take("pearl");
    else if (roll < 0.22) take("quartz");
  }
}
// The sunken boat spilled its cargo: plenty of salvage lies around it
for (let n = 0; n < 16; n++) {
  const x = WRECK.x + (hash(n, 1, 31) - 0.5) * 34, z = WRECK.z + (hash(n, 2, 31) - 0.5) * 34;
  loot.push({ kind: "salvage", taken: false, id: loot.length, x: x, z: z, y: -depthAt(x, z), size: 1, turn: hash(n, 3, 31) * 6.283, tint: hash(n, 4, 31) });
}
// What each thing is called, and its colour on the screen
const LOOT = {
  shell: { name: "Shell", colour: 0xffd0e0 },
  kelp: { name: "Kelp", colour: 0x5aa83a },
  copper: { name: "Copper", colour: 0xe07a3a },
  quartz: { name: "Quartz", colour: 0xc8f0ff },
  salvage: { name: "Salvage", colour: 0x9aa0ae },
  pearl: { name: "Glow pearl", colour: 0x9affe0 },
};

// ----- Things to make at the raft -----
// needs: what it costs. after: something you must have made first. Each one changes what you can do (see "gear" in game.js).
const RECIPES = [
  { id: "flippers", name: "Flippers", does: "Swim much faster.", needs: { kelp: 4, shell: 3 } },
  { id: "tank1", name: "Big air tank", does: "Air for 90 seconds instead of 45.", needs: { salvage: 4, kelp: 2 } },
  { id: "torch", name: "Dive torch", does: "F: a bright light. It also scares Snapjaws away.", needs: { copper: 2, quartz: 1, salvage: 1 } },
  { id: "zipfin", name: "Zipfin scooter", does: "Hold Shift to zoom along.", needs: { copper: 4, salvage: 3, quartz: 2 } },
  { id: "tank2", name: "Great air tank", does: "Air for 150 seconds.", needs: { copper: 4, quartz: 3 }, after: "tank1" },
  { id: "suit", name: "Deep suit", does: "Dive safely down to 150 metres (instead of 60).", needs: { copper: 5, quartz: 4, kelp: 6 } },
  { id: "bubble", name: "The Bubble (mini-sub)", does: "Endless air, bright lamps, safe from every creature, and it can go to the very bottom.", needs: { salvage: 8, copper: 6, quartz: 6, kelp: 5 }, after: "suit" },
  { id: "booster", name: "Pearl booster", does: "The Bubble goes nearly twice as fast.", needs: { pearl: 5, copper: 3 }, after: "bubble" },
];
