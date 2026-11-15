// The worlds of Spark Knights: your home, Sparkhaven, and the 24 worlds through the tear.
// Everything is made by the computer from seeds, using "noise" (smooth random bumps).

// ----- Weapons from Mount Spark -----
// Drop spark into Mount Spark's crater to get the next weapon.

const weapons = [
  { name: "Twig", icon: "🪵", damage: 1, cost: 0, colour: "#c8a070" },
  { name: "Ember Dagger", icon: "🗡️", damage: 2, cost: 30, colour: "#ff9a4a" },
  { name: "Spark Sword", icon: "⚔️", damage: 4, cost: 120, colour: "#fff27a" },
  { name: "Flame Blade", icon: "🔥", damage: 6, cost: 350, colour: "#ff5a2a" },
  { name: "Storm Spear", icon: "⚡", damage: 9, cost: 800, colour: "#7fe0ff" },
  { name: "Star Hammer", icon: "🔨", damage: 13, cost: 1600, colour: "#ffe070" },
  { name: "Spark Sceptre", icon: "✨", damage: 20, cost: 3000, colour: "#ffffff" },
];

// ----- Levels -----

function xpForNextLevel(level) {
  return 15 + level * 10;
}
function maxHearts(level) {
  return Math.min(16, 5 + Math.floor(level / 2));
}
// More sparklings as you level up: 1 at level 1, then one more every 2 levels (up to 8)
function sparklingCount(level) {
  return Math.min(8, 1 + Math.floor((level - 1) / 2));
}
function sparklingDamage(level) {
  return 1 + Math.floor(level / 4);
}

// ----- Sparkhaven: your home, uncovered bit by bit as you level up -----

const HUB_SIZE = 72;
const HUB_START = { x: 36, y: 45 };
const TEAR = { x: 36, y: 39 };           // the Tear Gate: step in to visit other worlds
const ELDER = { x: 33, y: 42 };          // the Elder Spark, who helps you
const CRATER = { x: 36, y: 11 };         // the top of Mount Spark

const zones = [
  { id: "village", name: "Sparkhaven Village", level: 1 },
  { id: "meadow", name: "Glow Meadow", level: 2 },
  { id: "woods", name: "Whisper Woods", level: 4 },
  { id: "mount", name: "Mount Spark", level: 6 },
  { id: "lake", name: "Crystal Lake", level: 8 },
  { id: "gardens", name: "Sky Gardens", level: 11 },
  { id: "ruins", name: "Starfall Ruins", level: 14 },
  { id: "shore", name: "Sun Shore", level: 18 },
];

// Buildings in Sparkhaven (drawn as little 3D houses, towers and so on)
const hubBuildings = [
  { type: "house", x: 30, y: 37 },
  { type: "house", x: 42, y: 37 },
  { type: "house", x: 29, y: 47 },
  { type: "tower", x: 43, y: 47 },
  { type: "well", x: 36, y: 49 },
  { type: "market", x: 40, y: 50 },
  { type: "windmill", x: 54, y: 40 },
  { type: "house", x: 58, y: 46 },
  { type: "tower", x: 58, y: 14 },
  { type: "ruinTower", x: 12, y: 14 },
  { type: "ruinHouse", x: 18, y: 19 },
  { type: "ruinMill", x: 10, y: 21 },
  { type: "house", x: 61, y: 63 },
  { type: "windmill", x: 12, y: 62 },
];

// Which zone is a square in?
function zoneAt(x, y) {
  if (Math.hypot(x - 36, y - 43) <= 11) return "village";
  if (y < 26) return x < 24 ? "ruins" : x > 48 ? "gardens" : "mount";
  if (y > 56) return x < 22 || x > 50 ? "shore" : "lake";
  return x > 36 ? "meadow" : "woods";
}

// ----- Noise -----

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function noise(x, y, size, seed) {
  const gx = x / size;
  const gy = y / size;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const top = hash(x0, y0, seed) + (hash(x0 + 1, y0, seed) - hash(x0, y0, seed)) * sx;
  const bottom = hash(x0, y0 + 1, seed) + (hash(x0 + 1, y0 + 1, seed) - hash(x0, y0 + 1, seed)) * sx;
  return top + (bottom - top) * sy;
}

// A tile looks like: { kind, height, thing, zone }
function makeHub() {
  const tiles = [];
  for (let y = 0; y < HUB_SIZE; y++) {
    const row = [];
    for (let x = 0; x < HUB_SIZE; x++) row.push(makeHubTile(x, y));
    tiles.push(row);
  }
  for (const b of hubBuildings) tiles[b.y][b.x].thing = "building";
  return tiles;
}

function makeHubTile(x, y) {
  const zone = zoneAt(x, y);
  const tile = { kind: "grass", height: 1, thing: null, zone: zone };
  const edge = Math.min(x, y, HUB_SIZE - 1 - x, HUB_SIZE - 1 - y);
  const r = hash(x, y, 5);

  // The sea all around
  if (edge < 3 + noise(x, y, 6, 1) * 2) {
    tile.kind = "water";
    tile.height = -1;
    return tile;
  }

  if (zone === "village") {
    // A shining plaza in the middle, with the Tear Gate and the Elder Spark
    if (Math.abs(x - 36) <= 3 && Math.abs(y - 42) <= 3) tile.kind = "temple";
    if (x === TEAR.x && y === TEAR.y) tile.thing = "tear";
    if (Math.hypot(x - 36, y - 43) > 8 && r < 0.08) tile.thing = "tree";
    return tile;
  }

  if (zone === "mount") {
    // A big mountain, climbable step by step, with a glowing crater at the top
    const fromTop = Math.hypot(x - CRATER.x, y - CRATER.y);
    tile.height = Math.max(1, Math.min(9, Math.round(9 - fromTop / 2.4 + (noise(x, y, 5, 2) - 0.5) * 0.8)));
    tile.kind = tile.height >= 7 ? "snow" : "rock";
    if (x === CRATER.x && y === CRATER.y) tile.thing = "crater";
    else if (fromTop > 2 && r < 0.05) tile.thing = "rock";
    else if (fromTop > 2 && r < 0.08) tile.thing = "pine";
    return tile;
  }

  if (zone === "lake") {
    if (Math.hypot((x - 36) / 10, (y - 64) / 4.5) < 1) {
      tile.kind = "water";
      tile.height = -1;
      return tile;
    }
    if (r < 0.05) tile.thing = "spark";
    else if (r < 0.1) tile.thing = "bush";
    return tile;
  }

  tile.height = 1 + Math.floor(noise(x, y, 9, 3) * 2);
  if (zone === "meadow") {
    if (r < 0.05) tile.thing = "herb";
    else if (r < 0.08) tile.thing = "bush";
    else if (r < 0.11) tile.thing = "spark";
  } else if (zone === "woods") {
    if (r < 0.28) tile.thing = hash(x, y, 6) < 0.7 ? "tree" : "pine";
    else if (r < 0.31) tile.thing = "spark";
  } else if (zone === "gardens") {
    tile.height = 2 + Math.floor(noise(x, y, 9, 3) * 2);
    if (r < 0.08) tile.thing = "herb";
    else if (r < 0.12) tile.thing = "tree";
    else if (r < 0.16) tile.thing = "spark";
  } else if (zone === "ruins") {
    tile.kind = "rock";
    if (r < 0.06) tile.thing = "rock";
    else if (r < 0.1) tile.thing = "crystal";
    else if (r < 0.14) tile.thing = "spark";
  } else if (zone === "shore") {
    tile.height = 1;
    if (r < 0.05) tile.thing = "bush";
    else if (r < 0.09) tile.thing = "spark";
  }
  return tile;
}

// ----- The 24 worlds through the tear -----

const themes = {
  bloom: { name: "Bloom Jungle", monster: "blob", colours: ["#3fae4a", "#8fe07a"], things: ["tree", "bush"] },
  tide: { name: "Tide Caves", monster: "crab", colours: ["#2f8ab8", "#7fd8f0"], things: ["rock", "crystal"] },
  ember: { name: "Ember Wastes", monster: "blob", colours: ["#d8402a", "#ffa04a"], things: ["deadTree", "rock"], lava: true },
  frost: { name: "Frost Peaks", monster: "bat", colours: ["#5a8ad8", "#cfe8ff"], things: ["pine", "rock"] },
  shadow: { name: "Shadow Marsh", monster: "bat", colours: ["#5a2a98", "#a87ae0"], things: ["deadTree", "bush"] },
  star: { name: "Star Void", monster: "crab", colours: ["#c89a20", "#fff0a0"], things: ["crystal", "rock"] },
};
const themeOrder = ["bloom", "tide", "ember", "frost", "shadow", "star"];

const worlds = [];
themeOrder.forEach(function (theme, t) {
  for (let n = 1; n <= 4; n++) {
    worlds.push({ index: t * 4 + n - 1, theme: theme, name: themes[theme].name + " " + n });
  }
});

const WORLD_SIZE = 34;
const WORLD_START = { x: 17, y: 28 };
const WORLD_HEART = { x: 17, y: 4 };  // the Tear Heart you collect to clear a world

// How tough a world's monsters are
function monsterStats(index, guardian) {
  if (guardian) {
    return { hp: 15 + index * 6, damage: 1 + Math.floor(index / 4), speed: 900, xp: 20 + index * 4, size: 2.2 };
  }
  return { hp: Math.round(3 + index * 1.5), damage: 1 + Math.floor(index / 6), speed: Math.max(450, 750 - index * 12), xp: 4 + index, size: 1 };
}

// Build a world. If the way to the Tear Heart is blocked, try the next seed.
function makeWorldTiles(index) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const tiles = buildWorld(index, index * 977 + 13 + attempt * 31);
    if (canReach(tiles, WORLD_START, WORLD_HEART, worlds[index].theme)) return tiles;
  }
  throw new Error("Couldn't build world " + index);
}

function buildWorld(index, seed) {
  const theme = themes[worlds[index].theme];
  const tiles = [];
  for (let y = 0; y < WORLD_SIZE; y++) {
    const row = [];
    for (let x = 0; x < WORLD_SIZE; x++) {
      const tile = { kind: "grass", height: 1, thing: null };
      const edge = Math.min(x, y, WORLD_SIZE - 1 - x, WORLD_SIZE - 1 - y);
      const fromStart = Math.hypot(x - WORLD_START.x, y - WORLD_START.y);
      const fromHeart = Math.hypot(x - WORLD_HEART.x, y - WORLD_HEART.y);
      const r = hash(x, y, seed);

      if (fromStart < 3.5) {
        tile.height = 1; // you always arrive on dry land
      } else if (edge < 2 + noise(x, y, 5, seed + 1) * 2) {
        tile.kind = "water"; // (in the Ember Wastes, this is lava!)
        tile.height = -1;
      } else if (fromHeart <= 3.5) {
        tile.kind = "temple"; // the Tear Heart's shining platform
        tile.height = 2;
      } else {
        tile.height = Math.floor((noise(x, y, 10, seed + 2) * 0.7 + noise(x, y, 5, seed + 3) * 0.3) * 4);
        if (fromStart < 4) tile.height = 1;
        if (tile.height >= 3) tile.kind = "rock";
        if (noise(x, y, 8, seed + 4) < 0.17 && fromStart > 5 && fromHeart > 6) {
          tile.kind = "water";
          tile.height = -1;
        } else if (fromStart > 3) {
          if (r < 0.12) tile.thing = theme.things[hash(x, y, seed + 5) < 0.7 ? 0 : 1];
          else if (r < 0.15) tile.thing = "spark";
          else if (r < 0.156) tile.thing = "heartPickup";
        }
      }
      row.push(tile);
    }
    tiles.push(row);
  }
  tiles[WORLD_HEART.y][WORLD_HEART.x].thing = "tearHeart";
  return tiles;
}

// Things that block your way
const BLOCKERS = ["tree", "pine", "deadTree", "rock", "crystal", "bush", "herb", "building", "tear", "crater", "elder"];

// Can you walk from one place to another? (You can climb one step, and swim, but not in lava.)
function canReach(tiles, from, to, theme) {
  const lava = theme && themes[theme] && themes[theme].lava;
  const height = (t) => (t.kind === "water" ? 0 : t.height);
  const seen = new Set([from.x + "," + from.y]);
  const queue = [[from.x, from.y]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === to.x && y === to.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const t = tiles[ny] && tiles[ny][nx];
      const key = nx + "," + ny;
      if (!t || seen.has(key) || BLOCKERS.includes(t.thing)) continue;
      if (t.kind === "water" && lava) continue;
      if (Math.abs(height(t) - height(tiles[y][x])) > 1) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return false;
}
