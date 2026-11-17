// Space Explorers: the planets.
// Each planet is described by a few lines, and its whole map is built from that by code.
//
// Each square of ground is one letter (the same letters as the Dragon Tamers games):
//   G grass  F forest floor  S sand  R rock  N snow  I ice  A ash  T dark stone  C landing pad
//   W water  L lava  P mountain peak (the edge of the map)

const TILE = 16;      // one square is 16 pixels wide
let MAP_W = 64;
let MAP_H = 48;
let WORLD = null;     // the planet you are on now

// A repeatable "random" number from 0 to 1 for a square. Same square, same number.
function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}
// Smooth, blobby random numbers: good for lakes and patches of ground
function smoothNoise(x, y, size, seed) {
  const gx = Math.floor(x / size);
  const gy = Math.floor(y / size);
  let fx = x / size - gx;
  let fy = y / size - gy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, seed);
  const b = hash(gx + 1, gy, seed);
  const c = hash(gx, gy + 1, seed);
  const d = hash(gx + 1, gy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ground: the main floor.  patch: [other floor, how much of it].  pool: lakes of water (W) or lava (L).
// plants: what grows there.  night: the colour of the dark.  demons: who comes at night.
// fuel: how many crystals the ship needs to leave.
// thing: the special material you can only find on this planet (3 pieces are hidden on it).
// upgrade: what the ship's workshop can build from 3 of them: [short name, name, what it does].
// log: a page from the diary of the last ship that came this way.
const PLANETS = [
  { name: "Verdant Moon", ground: "G", patch: ["F", 0.6], pool: "W", plants: ["oak", "oak", "bush", "mushroom"], thick: 0.09, mood: "meadow",
    night: [0.34, 0.42, 0.72], demons: ["imp"], fuel: 5, log: ["LOG OF THE SHIP 'WANDERER', DAY 3", "\"We thought this moon was empty. It is not.\"", "\"They only come out at night. They do not like the light.\""], thing: ["Sun Moss", "#6fe08a"], upgrade: ["garden", "Healing garden", "2 more hearts for you, and Doc heals faster"],
    story: ["The ship drops out of the wormhole above a green moon.", "\"Engines are empty, Captain,\" says Tink. \"We need fuel crystals. And a star chart, or we will never find home.\"", "\"Scanners show something else here,\" says Nova. \"It only moves at night.\""] },
  { name: "Dune World", ground: "S", patch: ["R", 0.62], pool: null, plants: ["cactus", "rock", "skull", "cactus"], thick: 0.05, mood: "desert",
    night: [0.42, 0.36, 0.62], demons: ["imp", "imp", "brute"], fuel: 6, log: ["LOG OF THE 'WANDERER', DAY 9", "\"The small ones stop moving when you look at them.\"", "\"Do NOT turn your back.\""], thing: ["Sand Glass", "#ffd84a"], upgrade: ["lens", "Focus lens", "your blaster hits twice as hard"],
    story: ["Sand, as far as the scanners can see.", "\"The chart points this way,\" says Nova. \"Home is still four jumps off.\"", "\"Big footprints out there,\" says Doc. \"Very big.\""] },
  { name: "Frostheim", ground: "N", patch: ["I", 0.58], pool: "W", plants: ["snowpine", "icespire", "rock", "snowpine"], thick: 0.07, mood: "ice",
    night: [0.36, 0.46, 0.8], demons: ["imp", "spitter", "brute", "imp"], fuel: 7, log: ["LOG OF THE 'WANDERER', DAY 16", "\"We built walls. The big ones broke them.\"", "\"The ones that spit fire never come close. You only see their eyes.\""], thing: ["Frost Steel", "#8fd8ff"], upgrade: ["armour", "Armour plating", "a much stronger hull for the ship"],
    story: ["A world of ice. The landing legs creak in the cold.", "\"Some of the demons here can spit fire from far away,\" warns Doc. \"Build walls!\""] },
  { name: "Cinder", ground: "A", patch: ["R", 0.64], pool: "L", plants: ["ashtree", "spike", "rock", "ashtree"], thick: 0.07, mood: "isle",
    night: [0.5, 0.3, 0.42], demons: ["imp", "wing", "spitter", "brute", "wing"], fuel: 8, log: ["LOG OF THE 'WANDERER', DAY 22", "\"Some of them can fly. We lost two turrets last night.\"", "\"We leave at dawn. If dawn comes.\""], thing: ["Magma Core", "#ff5a3a"], upgrade: ["rapid", "Rapid fire", "the crew and the turrets shoot twice as fast"],
    story: ["Rivers of lava light the sky red.", "\"Winged ones on this planet,\" says Nova. \"Walls won't stop those. More turrets!\""] },
  { name: "Nightfall", ground: "A", patch: ["T", 0.5], pool: "L", plants: ["doomtree", "spike", "skull", "darkpillar"], thick: 0.08, mood: "shadow",
    night: [0.34, 0.24, 0.5], demons: ["imp", "wing", "spitter", "brute", "brute"], fuel: 8, boss: true, log: ["LOG OF THE 'WANDERER'. LAST PAGE", "\"This is where they all come from. They have a king.\"", "\"If anyone finds this: he has the last piece of the chart. We could not take it. Perhaps you can.\""], thing: ["Shadow Shard", "#b06af0"], upgrade: ["light", "Searchlight", "the ship lights up everything near it, so no demon can sneak up"],
    story: ["The last jump. A black planet under a purple sun.", "\"This is where they all come from,\" whispers Tink. \"The Demon King has the last piece of the chart.\"", "\"Then tonight,\" you say, \"we take it back.\""] },
];

function moodAt() {
  return WORLD.planet.mood;
}

// Build planet number "index". Gives back where everything is.
function makePlanet(index) {
  const planet = PLANETS[index];
  const seed = index * 100 + 7;
  const ground = [];
  const objects = [];
  const blocked = [];
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  for (let y = 0; y < MAP_H; y++) {
    ground.push([]);
    blocked.push([]);
    for (let x = 0; x < MAP_W; x++) {
      const fromShip = Math.hypot(x - cx, y - cy);
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      let letter = planet.ground;
      if (smoothNoise(x, y, 6, seed + 1) > planet.patch[1]) letter = planet.patch[0];
      if (planet.pool && fromShip > 10 && smoothNoise(x, y, 7, seed + 2) > 0.74) letter = planet.pool;
      if (edge < 2 + smoothNoise(x, y, 4, seed + 3) * 2.5) letter = "P";
      if (fromShip < 3.6) letter = "C";       // the landing pad
      ground[y].push(letter);
      blocked[y].push(letter === "W" || letter === "L" || letter === "P");
      if (letter === "P") objects.push({ type: index === 2 ? "snowpeak" : "peak", x: x, y: y, solid: true });
    }
  }
  // Things that grow (not too close to the ship, so there is room to build)
  for (let y = 3; y < MAP_H - 3; y++) {
    for (let x = 3; x < MAP_W - 3; x++) {
      const fromShip = Math.hypot(x - cx, y - cy);
      if (blocked[y][x] || fromShip < 7) continue;
      if (hash(x, y, seed + 4) > planet.thick * (fromShip < 13 ? 0.4 : 1)) continue;
      const type = planet.plants[Math.floor(hash(x, y, seed + 5) * planet.plants.length)];
      objects.push({ type: type, x: x, y: y, solid: type !== "mushroom", look: Math.floor(hash(x, y, seed + 6) * 3) });
      if (type !== "mushroom") blocked[y][x] = true;
    }
  }
  // Which squares can you walk to from the ship?
  const reach = [];
  for (let y = 0; y < MAP_H; y++) reach.push(new Uint8Array(MAP_W));
  const queue = [[cx, cy + 3]];
  reach[cy + 3][cx] = 1;
  const open = [];
  while (queue.length) {
    const [x, y] = queue.shift();
    open.push([x, y]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || reach[ny][nx] || blocked[ny][nx]) continue;
      reach[ny][nx] = 1;
      queue.push([nx, ny]);
    }
  }
  // Scatter the fuel crystals and scrap on squares you can reach (the same places every time)
  const far = open.filter(([x, y]) => Math.hypot(x - cx, y - cy) > 8);
  const pickSpots = function (count, salt, apart) {
    const spots = [];
    for (let tries = 0; spots.length < count && tries < 4000; tries++) {
      const spot = far[Math.floor(hash(tries, salt, seed + 8) * far.length)];
      if (spots.concat(taken).every((other) => Math.hypot(other[0] - spot[0], other[1] - spot[1]) >= apart)) spots.push(spot);
    }
    taken.push(...spots);
    return spots;
  };
  const taken = [];
  // The star chart piece is as far from the ship as it can be
  const chart = far.reduce((best, spot) => (Math.hypot(spot[0] - cx, spot[1] - cy) > Math.hypot(best[0] - cx, best[1] - cy) ? spot : best), far[0]);
  taken.push(chart);
  const crystals = pickSpots(planet.fuel + 4, 1, 5);
  const scraps = pickSpots(16, 2, 3);
  const things = pickSpots(3, 3, 9);          // the planet's special material
  const wreck = pickSpots(1, 4, 6)[0];        // a piece of an old ship, with a page of its log
  // The ship stands on the pad (and you can't walk through it)
  for (let y = cy - 2; y <= cy; y++) for (let x = cx - 2; x <= cx + 1; x++) blocked[y][x] = true;
  // Where demons can come from: reachable squares near the edge
  const gates = open.filter(([x, y]) => Math.hypot(x - cx, y - cy) > 19);
  WORLD = { planet: planet, index: index, ground: ground, objects: objects, blocked: blocked, reach: reach };
  return { ship: [cx, cy], crystals: crystals, scraps: scraps, things: things, wreck: wreck, chart: planet.boss ? null : chart, gates: gates };
}

// (This last line lets the planets be checked by a test outside the browser.)
if (typeof module !== "undefined") module.exports = { PLANETS, makePlanet, world: () => WORLD, MAP_W, MAP_H };
