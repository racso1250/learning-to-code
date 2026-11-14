// The world of Pinecrest: a village surrounded by mountains that go on FOREVER.
//
// The world is never stored. Instead, generateTile(x, y) works out what's at any
// square from a seed, using "noise" (smooth random bumps). The same square always
// comes out the same, so the world can be as big as you like!

const WORLD_SEED = 2024;
const CHUNK = 16;           // the world is built in 16 x 16 pieces called chunks
const VILLAGE_RADIUS = 11;  // the flat, safe village in the middle

// ----- Treasure -----
// Rarer treasure is found higher up and further from the village.

const oreOrder = ["stone", "coal", "copper", "iron", "silver", "gold", "ruby", "diamond"];

const ores = {
  stone: { name: "Stone", price: 1, hits: 2, colours: ["#a4a2ad", "#6e6b78"], icon: "🪨" },
  coal: { name: "Coal", price: 3, hits: 3, colours: ["#2a2a30", "#111114"], icon: "⚫" },
  copper: { name: "Copper", price: 6, hits: 3, colours: ["#e08a4a", "#a85a2a"], icon: "🟠" },
  iron: { name: "Iron", price: 10, hits: 4, colours: ["#e8d8c8", "#b09888"], icon: "⚪" },
  silver: { name: "Silver", price: 20, hits: 5, colours: ["#f0f6ff", "#a8b8d0"], icon: "🥈" },
  gold: { name: "Gold", price: 40, hits: 6, colours: ["#ffd84a", "#e09a10"], icon: "🥇" },
  ruby: { name: "Ruby", price: 80, hits: 7, colours: ["#ff4a6a", "#b81a3a"], icon: "❤️" },
  diamond: { name: "Diamond", price: 150, hits: 8, colours: ["#9ff4ff", "#3ac0e0"], icon: "💎" },
};

// ----- The village -----

const buildings = [
  { x: -6, y: -5, type: "house" },
  { x: -2, y: -7, type: "house" },
  { x: -7, y: 2, type: "house" },
  { x: 6, y: -6, type: "house" },
  { x: 3, y: -4, type: "shop" },
  { x: -4, y: -3, type: "tom" },
  { x: 6, y: 2, type: "cottage" },   // the cottage you're saving up for!
];

const villagers = [
  { id: "tom", name: "Tom", x: -4, y: -2 },
  { id: "mabel", name: "Mabel", x: 3, y: -3 },
];

const CAMPFIRE = { x: 0, y: 4 };      // where you sleep...for now
const SIGN = { x: 5, y: 3 };          // the "For Sale" sign outside the cottage
const START = { x: 1, y: 3 };

// ----- The secret temple -----
// Hidden far away in the mountains. Don't tell anyone where!

const TEMPLE = { x: -96, y: -112 };
const TEMPLE_RADIUS = 4;   // the temple floor is 9 x 9 squares

// The pillars around the altar
const templePillars = [
  [-3, -3], [0, -4], [3, -3], [-4, 0], [4, 0], [-3, 3], [3, 3],
];

// What it takes to fix the temple, one stage at a time
const templeStages = [
  { ore: "stone", amount: 15, text: "Bring me 15 Stone, and the temple's steps shall rise again." },
  { ore: "iron", amount: 8, text: "Bring me 8 Iron, to mend the great pillars." },
  { ore: "gold", amount: 4, text: "Bring me 4 Gold, to crown the temple in light." },
  { ore: "diamond", amount: 1, text: "Last of all, bring me 1 Diamond: the temple's heart." },
];

// ----- Noise: smooth random bumps -----

// A random-looking number from 0 to 1 for any square (always the same for the same square)
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + (seed + WORLD_SEED) * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

// Smooth bumps: random values on a grid, blended together
function noise(x, y, size, seed) {
  const gx = x / size;
  const gy = y / size;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

// Goes smoothly from 0 to 1 as t goes from a to b
function smoothstep(a, b, t) {
  const v = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return v * v * (3 - 2 * v);
}

// ----- What's at a square? -----
// A tile looks like: { kind, height, thing, ore, building, villager }

function generateTile(x, y) {
  const distance = Math.hypot(x, y);
  const tile = { kind: "grass", height: 0, thing: null, ore: null, building: null, villager: null };

  // ----- The village -----
  if (distance <= VILLAGE_RADIUS) {
    if (x === 0 || y === 0) tile.kind = "path";
    for (const b of buildings) {
      if (b.x === x && b.y === y) tile.building = b.type;
    }
    for (const v of villagers) {
      if (v.x === x && v.y === y) tile.villager = v.id;
    }
    if (x === CAMPFIRE.x && y === CAMPFIRE.y) tile.thing = "campfire";
    if (x === SIGN.x && y === SIGN.y) tile.thing = "sign";
    if (!tile.building && !tile.thing && !tile.villager && tile.kind === "grass" && distance > 8 && hash(x, y, 7) < 0.08) {
      tile.thing = "tree";
    }
    return tile;
  }

  // ----- The mountains -----
  // Low near the village, rising up further away
  const rise = smoothstep(VILLAGE_RADIUS, VILLAGE_RADIUS + 30, distance);
  const bumps = noise(x, y, 28, 1) * 0.55 + noise(x, y, 11, 2) * 0.3 + noise(x, y, 4, 3) * 0.15;
  const giant = noise(x, y, 90, 4);
  let height = (bumps * 16 + giant * 6 - 5) * rise;

  // The secret temple sits on a flat shelf, hidden among the high peaks
  const templeDistance = Math.hypot(x - TEMPLE.x, y - TEMPLE.y);
  const templeHeight = 9;
  const blend = smoothstep(TEMPLE_RADIUS + 1, TEMPLE_RADIUS + 12, templeDistance);
  height = templeHeight + (height - templeHeight) * blend;

  // Lakes in the low valleys
  if (height < 1.5 && noise(x, y, 20, 5) < 0.25 && templeDistance > 20) {
    tile.kind = "water";
    tile.height = -1;
    return tile;
  }

  tile.height = Math.max(0, Math.min(14, Math.floor(height)));
  if (tile.height >= 10) tile.kind = "snow";
  else if (tile.height >= 5) tile.kind = "rock";

  // The temple itself
  if (Math.abs(x - TEMPLE.x) <= TEMPLE_RADIUS && Math.abs(y - TEMPLE.y) <= TEMPLE_RADIUS) {
    tile.kind = "temple";
    tile.height = templeHeight;
    if (x === TEMPLE.x && y === TEMPLE.y) tile.thing = "altar";
    for (const [px, py] of templePillars) {
      if (x === TEMPLE.x + px && y === TEMPLE.y + py) tile.building = "pillar";
    }
    return tile;
  }

  // Trees and treasure
  const r = hash(x, y, 9);
  if (tile.kind === "grass" && r < 0.07) {
    tile.thing = "tree";
  } else if (tile.kind === "snow" && r < 0.04) {
    tile.thing = "tree";
  } else if (((tile.kind === "rock" || tile.kind === "snow") && r < 0.13) || (tile.kind === "grass" && r > 0.97)) {
    tile.thing = "ore";
    // The higher and further away, the rarer the treasure can be
    const rarity = tile.height * 0.5 + distance / 60;
    const bestTier = Math.min(oreOrder.length - 1, 1 + Math.floor(rarity / 1.6));
    const roll = hash(x, y, 11);
    tile.ore = oreOrder[Math.floor(roll * roll * (bestTier + 1))];
  }
  return tile;
}
