// Cubewild: the world.
// The whole world is made of cubes ("blocks"). It goes on forever: the land is worked out
// from a "seed" number with maths, so nothing has to be stored until you change it.
// The world is kept in pieces called chunks: 16 blocks wide, 16 long and 48 tall.

const CH = 16;      // chunk width and length
const H = 48;       // world height
const SEA = 16;     // water fills up to this height

// ----- Repeatable "random" numbers: the same place always gives the same number -----
function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}
function hash3(x, y, z, seed) {
  return hash(x + Math.imul(y, 7919), z + Math.imul(y, 104729), seed);
}
const smooth = (t) => t * t * (3 - 2 * t);
// Smooth hills of random numbers, on the flat
function noise2(x, z, size, seed) {
  const gx = Math.floor(x / size);
  const gz = Math.floor(z / size);
  const fx = smooth(x / size - gx);
  const fz = smooth(z / size - gz);
  const a = hash(gx, gz, seed);
  const b = hash(gx + 1, gz, seed);
  const c = hash(gx, gz + 1, seed);
  const d = hash(gx + 1, gz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
// The same, but in 3D (for caves and veins of rock)
function noise3(x, y, z, size, seed) {
  const gx = Math.floor(x / size);
  const gy = Math.floor(y / size);
  const gz = Math.floor(z / size);
  const fx = smooth(x / size - gx);
  const fy = smooth(y / size - gy);
  const fz = smooth(z / size - gz);
  const at = (i, j, k) => hash3(gx + i, gy + j, gz + k, seed);
  const low = (at(0, 0, 0) * (1 - fx) + at(1, 0, 0) * fx) * (1 - fz) + (at(0, 0, 1) * (1 - fx) + at(1, 0, 1) * fx) * fz;
  const high = (at(0, 1, 0) * (1 - fx) + at(1, 1, 0) * fx) * (1 - fz) + (at(0, 1, 1) * (1 - fx) + at(1, 1, 1) * fx) * fz;
  return low + (high - low) * fy;
}

// ----- The little pictures on the blocks -----
// Each one is 16 x 16 pixels and is painted by a small function that says what colour
// each pixel is: (x, y, r, n) where r is a random number and n is a blobby random number.
// "null" means see-through.
const pick = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
const dirtLook = (x, y, r, n) => (r < 0.06 ? "#5e4630" : pick(["#8a6844", "#7d5d3c", "#94714b"], n));
const stoneLook = (x, y, r, n) => (n > 0.66 ? "#7a7f8c" : n < 0.3 ? "#8f95a3" : r < 0.07 ? "#727784" : "#868b99");
const speckled = (colours, dot) => (x, y, r, n) => (r < 0.06 ? dot : pick(colours, n));
const ore = (colour, shine) => (x, y, r, n) => {
  const lump = noise2(x + 40, y + 40, 2.6, 300);
  return lump > 0.7 ? shine : lump > 0.6 ? colour : stoneLook(x, y, r, n);
};
const boards = (light, dark, seam) => (x, y, r) => (y % 4 === 3 || (x + Math.floor(y / 4) * 5) % 8 === 0 ? seam : r < 0.2 ? dark : light);
const metal = (light, mid, dark) => (x, y, r) => (x === 0 || y === 0 ? light : x === 15 || y === 15 ? dark : (x === 3 || x === 12) && (y === 3 || y === 12) ? dark : r < 0.1 ? light : mid);
const flower = (petal) => (x, y) => {
  if (Math.hypot(x - 7.5, y - 4.5) < 1.2) return "#ffd84a";
  if (Math.hypot(x - 7.5, y - 4.5) < 3.4) return petal;
  if ((x === 7 || x === 8) && y > 6) return "#3a9a44";
  if (y === 11 && (x === 5 || x === 6 || x === 9 || x === 10)) return "#58b040";
  return null;
};

const TILES = {
  grassTop: (x, y, r, n) => (r < 0.08 ? "#8fd35a" : pick(["#58b040", "#4ea238", "#66bc4a"], n)),
  grassSide: (x, y, r, n) => (y < 3 + (hash(x, 0, 5) < 0.5 ? 1 : 0) + (hash(x, 1, 5) < 0.25 ? 1 : 0) ? pick(["#58b040", "#4ea238", "#66bc4a"], r) : dirtLook(x, y, r, n)),
  dirt: dirtLook,
  stone: stoneLook,
  sand: speckled(["#ecdca0", "#e4d294", "#f2e4ae"], "#cdb878"),
  water: (x, y, r, n) => ((y + Math.floor(Math.sin(x * 0.8) * 1.5)) % 5 === 0 ? "#6ab8f0" : pick(["#2f7fd0", "#3a8adc"], n)),
  logSide: (x, y, r) => (x % 4 === 0 ? "#5a4026" : r < 0.15 ? "#6a4c2e" : "#7a5836"),
  logTop: (x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return d > 7 ? "#5a4026" : Math.floor(d) % 2 ? "#c8a468" : "#b08e56"; },
  leaves: (x, y, r, n) => (r < 0.14 ? null : pick(["#2f8a3a", "#3a9a44", "#267a34"], n * 0.6 + r * 0.4)),
  planks: boards("#c89a5c", "#b98c50", "#8f6a3a"),
  bricks: (x, y, r) => (y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 15 ? "#5c6070" : r < 0.2 ? "#8a8f9e" : "#969baa"),
  glass: (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? "#dff3ff" : (x + y === 8 || x + y === 9) && x > 2 && x < 7 ? "#ffffff" : null),
  coal: ore("#2a2c36", "#454856"),
  ironOre: ore("#c8946c", "#e8c0a0"),
  sunstone: ore("#ffc23a", "#fff3a0"),
  lantern: (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 || x === 7 || x === 8 || y === 7 || y === 8 ? "#4a3a2a" : Math.hypot(x - 7.5, y - 7.5) < 5 ? "#fff3b0" : "#ffc850"),
  deep: (x, y, r, n) => pick(["#2a2634", "#33303f", "#211e2a"], n * 0.7 + r * 0.3),
  snowTop: speckled(["#f4f8fc", "#ffffff"], "#dbe6f2"),
  snowSide: (x, y, r, n) => (y < 4 + (hash(x, 2, 5) < 0.4 ? 1 : 0) ? "#f4f8fc" : dirtLook(x, y, r, n)),
  ironBlock: metal("#f2f4f8", "#cfd3dc", "#8a8f9c"),
  red: boards("#d84a3a", "#c63e30", "#8f2a24"),
  blue: boards("#3a7ad8", "#306cc6", "#22488f"),
  yellow: boards("#f0c83a", "#e0b82e", "#a8841c"),
  white: boards("#f2f2f6", "#e4e4ea", "#b0b0bc"),
  green: boards("#4ab850", "#3ea844", "#2a7a30"),
  purple: boards("#9a5ad8", "#8a4cc6", "#5e2f8f"),
  orange: boards("#f08a3a", "#e07c2e", "#a8541c"),
  black: boards("#3a3a46", "#30303a", "#1c1c24"),
  gravel: (x, y, r, n) => pick(["#8a8680", "#7a766f", "#9c9890", "#6a665f"], r * 0.6 + n * 0.4),
  clay: speckled(["#a8b0c0", "#9ea6b6", "#b2bac8"], "#8a92a2"),
  redBricks: (x, y, r) => (y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7 ? "#d8c8b8" : r < 0.2 ? "#a84a3a" : "#b8553f"),
  sandstone: (x, y, r) => (y % 5 === 4 ? "#b89a5c" : r < 0.15 ? "#d8c080" : "#e0c88a"),
  ice: (x, y, r, n) => ((x + y * 2) % 11 === 0 ? "#ffffff" : pick(["#a8dcf5", "#b8e6fa", "#98d0ee"], n)),
  cactusSide: (x, y, r) => (x % 4 === 1 ? "#2f7a3a" : (x % 4 === 3 && y % 4 === 2) ? "#f2f0c0" : r < 0.1 ? "#48a852" : "#3f9a4a"),
  cactusTop: (x, y) => (Math.hypot(x - 7.5, y - 7.5) < 3 ? "#6cc86a" : (x + y) % 4 === 0 ? "#2f7a3a" : "#3f9a4a"),
  pumpkinSide: (x, y, r) => (x % 5 === 2 ? "#c86a1a" : r < 0.1 ? "#f29a3a" : "#e8842a"),
  pumpkinTop: (x, y) => (Math.hypot(x - 7.5, y - 7.5) < 2 ? "#5a7a2a" : (x + y) % 5 === 0 ? "#c86a1a" : "#e8842a"),
  goldOre: ore("#f0c020", "#fff0a0"),
  goldBlock: metal("#fff3a0", "#f0c83a", "#b8901c"),
  gemOre: ore("#3ad8e8", "#c8fbff"),
  gemBlock: (x, y) => ((x + y) % 6 === 0 || (x - y + 16) % 6 === 0 ? "#c8fbff" : (x + y) % 3 === 0 ? "#2ab8d0" : "#3ad8e8"),
  mossy: (x, y, r, n) => (noise2(x, y, 3, 301) > 0.55 ? pick(["#4a8a3a", "#5a9a44"], r) : stoneLook(x, y, r, n)),
  bookshelf: (x, y, r) => (y < 2 || y > 13 || y === 7 || y === 8 ? "#8f6a3a" : pick(["#c63e30", "#306cc6", "#3ea844", "#e0b82e", "#8a4cc6", "#f2f2f6"], hash(Math.floor(x / 2), y < 8 ? 0 : 1, 9))),
  crate: (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? "#6a4a26" : x === y || x === 15 - y ? "#8f6a3a" : (x + y) % 2 ? "#c89a5c" : "#b98c50"),
  hay: (x, y, r) => (y === 4 || y === 11 ? "#a8741c" : r < 0.3 ? "#e8c84a" : "#d8b83a"),
  checker: (x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? "#f2f2f6" : "#30303a"),
  marble: (x, y, r, n) => (Math.abs(noise2(x, y, 5, 302) - 0.5) < 0.04 ? "#b8b8c8" : pick(["#f4f4f8", "#ececf2"], n)),
  nightstone: (x, y, r, n) => ((x * 3 + y * 5) % 13 === 0 ? "#b88af0" : pick(["#2a1a4a", "#34205a", "#1f1238"], n)),
  lava: (x, y, r, n) => (n > 0.62 ? "#ffe14a" : n < 0.36 ? "#d83a12" : "#ff7a1a"),
  popperSide: (x, y) => (y < 3 || y > 12 ? "#7a2a22" : y === 7 || y === 8 ? "#fff3b0" : (x + y) % 2 ? "#e0402a" : "#c63626"),
  popperTop: (x, y) => (Math.hypot(x - 7.5, y - 7.5) < 2 ? "#2a2c36" : "#c63626"),
  bedTop: (x, y) => (y < 5 ? "#f2f2f6" : x === 0 || x === 15 || y === 15 ? "#8f2a24" : (x + y) % 6 === 0 ? "#e86a5a" : "#d84a3a"),
  bedSide: (x, y) => (y > 10 ? "#8f6a3a" : y < 6 && x < 5 ? "#f2f2f6" : "#c63e30"),
  flowerRed: flower("#e8402a"),
  flowerYellow: flower("#fff0a0"),
  flowerBlue: flower("#5a9af0"),
  tallGrass: (x, y, r) => (y > 15 - (4 + hash(x, 3, 7) * 9) && hash(x, 4, 7) < 0.6 ? (r < 0.3 ? "#66bc4a" : "#4ea238") : null),
  mushroom: (x, y) => ((x - 7.5) * (x - 7.5) / 30 + (y - 7) * (y - 7) / 9 < 1 && y < 9 ? ((x * 5 + y * 3) % 7 === 0 ? "#ffffff" : "#a05ad8") : x > 5 && x < 10 && y >= 9 ? "#f2ead8" : null),
  sapling: (x, y) => (Math.hypot(x - 7.5, y - 6) < 3.6 ? ((x + y) % 3 ? "#3a9a44" : "#58b040") : (x === 7 || x === 8) && y > 8 ? "#7a5836" : null),
  berryBush: (x, y, r) => (Math.hypot(x - 7.5, (y - 9) * 1.2) < 6.5 ? (r < 0.12 ? "#e8304a" : r < 0.4 ? "#2f8a3a" : "#3a9a44") : null),
  berries: (x, y) => (Math.hypot(x - 5, y - 9) < 3 || Math.hypot(x - 10, y - 10) < 3 || Math.hypot(x - 8, y - 5) < 3 ? ((x + y) % 5 === 0 ? "#ff9aa8" : "#e8304a") : null),
};
const TILE_NAMES = Object.keys(TILES);
const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;

// ----- The kinds of block -----
// tex: which pictures go on the [top, sides, bottom]. hard: seconds to break it (none = unbreakable).
// see: you can see through it.  plant: it is drawn as a little cross you can walk through.
// liquid: you can swim in it.  glow: it shines.  lamp: its light spreads to the blocks around it.
const BLOCKS = [{ name: "Air", see: true }];
function block(name, tex, more) {
  const names = typeof tex === "string" ? [tex, tex, tex] : tex;
  BLOCKS.push(Object.assign({ name: name, tex: names.map((n) => TILE_NAMES.indexOf(n)) }, more));
  return BLOCKS.length - 1;
}
const AIR = 0;
const GRASS = block("Grass", ["grassTop", "grassSide", "dirt"], { hard: 0.45 });
const DIRT = block("Dirt", "dirt", { hard: 0.4 });
const STONE = block("Stone", "stone", { hard: 0.9, rock: true });
const SAND = block("Sand", "sand", { hard: 0.35 });
const WATER = block("Water", "water", { see: true, liquid: true });
const LOG = block("Log", ["logTop", "logSide", "logTop"], { hard: 0.7 });
const LEAVES = block("Leaves", "leaves", { hard: 0.15, see: true });
const PLANKS = block("Planks", "planks", { hard: 0.55 });
const BRICKS = block("Stone bricks", "bricks", { hard: 1, rock: true });
const GLASS = block("Glass", "glass", { hard: 0.2, see: true });
const COAL = block("Coal", "coal", { hard: 1.1, rock: true });
const IRON = block("Iron ore", "ironOre", { hard: 1.3, rock: true });
const SUNSTONE = block("Sunstone", "sunstone", { hard: 1.5, rock: true, glow: 0.45 });
const LANTERN = block("Lantern", "lantern", { hard: 0.2, glow: 1, lamp: true });
const DEEP = block("Deepstone", "deep", {});                         // the bottom of the world: can't be broken
const SNOW = block("Snowy grass", ["snowTop", "snowSide", "dirt"], { hard: 0.45 });
const IRON_BLOCK = block("Iron block", "ironBlock", { hard: 1.4, rock: true });
const PAINTS = ["red", "blue", "yellow", "white", "green", "purple", "orange", "black"].map((colour) => block(colour[0].toUpperCase() + colour.slice(1) + " blocks", colour, { hard: 0.5 }));
const GRAVEL = block("Gravel", "gravel", { hard: 0.4 });
const CLAY = block("Clay", "clay", { hard: 0.45 });
const RED_BRICKS = block("Red bricks", "redBricks", { hard: 1, rock: true });
const SANDSTONE = block("Sandstone", "sandstone", { hard: 0.8, rock: true });
const ICE = block("Ice", "ice", { hard: 0.4 });
const SNOW_BLOCK = block("Snow", "snowTop", { hard: 0.3 });
const CACTUS = block("Cactus", ["cactusTop", "cactusSide", "cactusTop"], { hard: 0.4 });
const PUMPKIN = block("Pumpkin", ["pumpkinTop", "pumpkinSide", "pumpkinTop"], { hard: 0.5 });
const GOLD = block("Gold ore", "goldOre", { hard: 1.4, rock: true });
const GOLD_BLOCK = block("Gold block", "goldBlock", { hard: 1.4, rock: true });
const GEM = block("Skygem ore", "gemOre", { hard: 1.8, rock: true, glow: 0.3 });
const GEM_BLOCK = block("Skygem block", "gemBlock", { hard: 1.6, rock: true, glow: 0.6 });
const MOSSY = block("Mossy stone", "mossy", { hard: 0.9, rock: true });
const BOOKSHELF = block("Bookshelf", ["planks", "bookshelf", "planks"], { hard: 0.6 });
const CRATE = block("Crate", "crate", { hard: 0.6 });
const HAY = block("Hay bale", "hay", { hard: 0.4 });
const CHECKER = block("Checker tiles", "checker", { hard: 0.8, rock: true });
const MARBLE = block("Marble", "marble", { hard: 1, rock: true });
const NIGHTSTONE = block("Nightstone", "nightstone", { hard: 3, rock: true });
const LAVA = block("Lava", "lava", { see: true, liquid: true, glow: 1, lamp: false, hurts: true });
const POPPER = block("Popper", ["popperTop", "popperSide", "popperTop"], { hard: 0.3, use: "pop" });
const BED = block("Bed", ["bedTop", "bedSide", "planks"], { hard: 0.4, use: "sleep" });
const FLOWERS = ["flowerRed", "flowerYellow", "flowerBlue"].map((name, i) => block(["Red", "Yellow", "Blue"][i] + " flower", name, { hard: 0.05, see: true, plant: true }));
const TALL_GRASS = block("Long grass", "tallGrass", { hard: 0.05, see: true, plant: true });
const MUSHROOM = block("Mushroom", "mushroom", { hard: 0.05, see: true, plant: true, glow: 0.25 });
const SAPLING = block("Sapling", "sapling", { hard: 0.05, see: true, plant: true });
const BERRY_BUSH = block("Berry bush", "berryBush", { hard: 0.1, see: true, plant: true });
const BERRIES = block("Berries", "berries", { item: true, food: 2 });   // not a block: something to eat

const isSolid = (id) => id !== AIR && !BLOCKS[id].liquid && !BLOCKS[id].plant;   // can you stand on it?
const isOpaque = (id) => !BLOCKS[id].see;                                        // does it hide what is behind it?

// What you can make. Each recipe: what you need, and what it makes (or which tool it gives you).
const RECIPES = [
  { needs: [[LOG, 1]], makes: [PLANKS, 4] },
  { needs: [[STONE, 3], [PLANKS, 2]], tool: 1, name: "Stone pick (digs faster)" },
  { needs: [[IRON, 3], [PLANKS, 2]], tool: 2, name: "Iron pick (digs much faster)" },
  { needs: [[GEM, 3], [PLANKS, 2]], tool: 3, name: "Skygem pick (the fastest)" },
  { needs: [[PLANKS, 1], [COAL, 1]], makes: [LANTERN, 2] },
  { needs: [[STONE, 4]], makes: [BRICKS, 4] },
  { needs: [[SAND, 2], [COAL, 1]], makes: [GLASS, 2] },
  { needs: [[SAND, 4]], makes: [SANDSTONE, 2] },
  { needs: [[CLAY, 2], [COAL, 1]], makes: [RED_BRICKS, 4] },
  { needs: [[PLANKS, 4]], makes: [CRATE, 1] },
  { needs: [[PLANKS, 3], [LEAVES, 3]], makes: [BOOKSHELF, 1] },
  { needs: [[TALL_GRASS, 4]], makes: [HAY, 1] },
  { needs: [[PLANKS, 3], [PAINTS[3], 2]], makes: [BED, 1] },
  { needs: [[SAND, 2], [COAL, 2]], makes: [POPPER, 1] },
  { needs: [[IRON, 4]], makes: [IRON_BLOCK, 1] },
  { needs: [[GOLD, 4]], makes: [GOLD_BLOCK, 1] },
  { needs: [[GEM, 4]], makes: [GEM_BLOCK, 1] },
  { needs: [[PAINTS[3], 1], [PAINTS[7], 1]], makes: [CHECKER, 2] },
].concat(PAINTS.map((id) => ({ needs: [[PLANKS, 1]], makes: [id, 1] })));

// ----- The world -----
const world = {
  seed: 1,
  chunks: new Map(),     // the chunks made so far, by name ("3,-2")
  edits: {},             // every block you have changed: edits["3,-2"][place] = block
  lamps: new Map(),      // where the lanterns are in each chunk (so they can light things up)
};

// How high is the land here, and what kind of land is it?
function landAt(x, z) {
  const s = world.seed;
  const big = noise2(x, z, 96, s + 1);
  const hills = noise2(x, z, 34, s + 2) * 0.55 + noise2(x, z, 13, s + 3) * 0.25 + noise2(x, z, 5, s + 4) * 0.08;
  const h = Math.min(H - 12, Math.floor(7 + big * 15 + hills * 15));
  const cold = noise2(x, z, 150, s + 5);
  const dry = noise2(x, z, 120, s + 6);
  const kind = cold < 0.36 ? "snow" : dry > 0.62 && cold > 0.48 ? "desert" : noise2(x, z, 60, s + 7) > 0.52 ? "forest" : "plains";
  return { h: h, kind: kind };
}
function treeHere(x, z, land) {
  if (land.h <= SEA + 1 || land.kind === "desert") return 0;
  const chance = land.kind === "forest" ? 0.03 : land.kind === "snow" ? 0.008 : 0.004;
  return hash(x, z, world.seed + 20) < chance ? 4 + Math.floor(hash(x, z, world.seed + 21) * 2) : 0;   // the trunk's height, or 0
}

const place = (x, y, z) => (y * CH + z) * CH + x;     // where a block is inside its chunk's list

function makeChunk(cx, cz) {
  const data = new Uint8Array(CH * CH * H);
  const s = world.seed;
  const lands = [];                       // the land for this chunk and 2 blocks around it (trees can poke in)
  for (let z = -2; z < CH + 2; z++) for (let x = -2; x < CH + 2; x++) lands.push(landAt(cx * CH + x, cz * CH + z));
  const landOf = (x, z) => lands[(z + 2) * (CH + 4) + x + 2];
  for (let z = 0; z < CH; z++) {
    for (let x = 0; x < CH; x++) {
      const wx = cx * CH + x;
      const wz = cz * CH + z;
      const land = landOf(x, z);
      const beach = land.h <= SEA + 1;
      const desert = land.kind === "desert";
      const floor = beach ? (noise2(wx, wz, 7, s + 40) > 0.66 ? GRAVEL : land.h < SEA - 1 && noise2(wx, wz, 6, s + 41) > 0.62 ? CLAY : SAND) : SAND;
      for (let y = 0; y <= Math.max(land.h, SEA); y++) {
        let id;
        if (y === 0) id = DEEP;
        else if (y > land.h) id = y === SEA && land.kind === "snow" ? ICE : WATER;
        else if (y === land.h) id = beach ? floor : desert ? SAND : land.kind === "snow" ? SNOW : GRASS;
        else if (y > land.h - 4) id = beach ? floor : desert ? (y > land.h - 2 ? SAND : SANDSTONE) : DIRT;
        else {
          id = y <= 2 && hash3(wx, y, wz, s + 35) < 0.55 ? NIGHTSTONE : STONE;
          // Caves: wormy holes where a 3D noise is high (with lava at the very bottom)
          if (y > 1 && noise3(wx, y * 1.6, wz, 9, s + 30) > 0.7) id = y <= 4 ? LAVA : AIR;
          else if (id === STONE) {
            // Big streaks of marble and mossy stone
            const streak = noise3(wx, y, wz, 7, s + 36);
            if (streak > 0.8) id = MARBLE;
            else if (streak < 0.17 && y > 14) id = MOSSY;
            // Ore: each little 4x4x4 box of stone might hold one lump of something
            const bx = wx >> 2, by = y >> 2, bz = wz >> 2;
            const roll = hash3(bx, by, bz, s + 31);
            const kind = roll < 0.1 ? COAL : roll < 0.16 && y < 24 ? IRON : roll < 0.19 && y < 14 ? GOLD : roll < 0.22 && y < 12 ? SUNSTONE : roll < 0.245 && y < 9 ? GEM : 0;
            if (kind) {
              const ox = (bx << 2) + 1 + hash3(bx, by, bz, s + 32) * 2;
              const oy = (by << 2) + 1 + hash3(bx, by, bz, s + 33) * 2;
              const oz = (bz << 2) + 1 + hash3(bx, by, bz, s + 34) * 2;
              if ((wx - ox) * (wx - ox) + (y - oy) * (y - oy) + (wz - oz) * (wz - oz) < 2.2) id = kind;
            }
          }
        }
        data[place(x, y, z)] = id;
      }
      // Things growing on top
      if (land.h > SEA + 1 && land.h + 3 < H) {
        const roll = hash(wx, wz, s + 50);
        const top = land.h + 1;
        if (desert) {
          if (roll < 0.012) for (let i = 0; i < 2 + Math.floor(hash(wx, wz, s + 51) * 2); i++) data[place(x, top + i, z)] = CACTUS;
        } else if (land.kind === "plains") {
          if (roll < 0.14) data[place(x, top, z)] = TALL_GRASS;
          else if (roll < 0.18) data[place(x, top, z)] = FLOWERS[Math.floor(hash(wx, wz, s + 52) * 3)];
          else if (roll < 0.186) data[place(x, top, z)] = BERRY_BUSH;
        } else if (land.kind === "forest") {
          if (roll < 0.07) data[place(x, top, z)] = TALL_GRASS;
          else if (roll < 0.09) data[place(x, top, z)] = MUSHROOM;
          else if (roll < 0.105) data[place(x, top, z)] = BERRY_BUSH;
          else if (roll < 0.109) data[place(x, top, z)] = PUMPKIN;
          else if (roll < 0.12) data[place(x, top, z)] = FLOWERS[Math.floor(hash(wx, wz, s + 52) * 3)];
        }
      }
    }
  }
  // Trees (including the edges of trees whose trunks are in the chunk next door)
  for (let z = -2; z < CH + 2; z++) {
    for (let x = -2; x < CH + 2; x++) {
      const land = landOf(x, z);
      const trunk = treeHere(cx * CH + x, cz * CH + z, land);
      if (!trunk) continue;
      const top = land.h + trunk;
      for (let dy = -1; dy <= 2; dy++) {
        const reach = dy < 1 ? 2 : 1;
        for (let dz = -reach; dz <= reach; dz++) {
          for (let dx = -reach; dx <= reach; dx++) {
            const px = x + dx, pz = z + dz, py = top + dy;
            if (px < 0 || pz < 0 || px >= CH || pz >= CH || py >= H) continue;
            if (Math.abs(dx) === reach && Math.abs(dz) === reach && (dy === 2 || hash3(px + cx * CH, py, pz + cz * CH, s + 22) < 0.5)) continue;   // nibble the corners
            const now = data[place(px, py, pz)];
            if (now === AIR || BLOCKS[now].plant) data[place(px, py, pz)] = LEAVES;
          }
        }
      }
      if (x >= 0 && z >= 0 && x < CH && z < CH) for (let y = land.h + 1; y <= top; y++) data[place(x, y, z)] = LOG;
    }
  }
  // Put back everything you have changed here
  const name = cx + "," + cz;
  const changed = world.edits[name];
  const lamps = [];
  if (changed) {
    for (const at in changed) {
      data[at] = changed[at];
      if (BLOCKS[changed[at]].lamp) lamps.push([cx * CH + (at % CH), Math.floor(at / (CH * CH)), cz * CH + (Math.floor(at / CH) % CH)]);
    }
  }
  world.lamps.set(name, lamps);
  return { cx: cx, cz: cz, name: name, data: data, dirty: true, mesh: null, water: null };
}

function chunkAt(cx, cz) {
  const name = cx + "," + cz;
  let chunk = world.chunks.get(name);
  if (!chunk) {
    chunk = makeChunk(cx, cz);
    world.chunks.set(name, chunk);
  }
  return chunk;
}

function getBlock(x, y, z) {
  if (y < 0) return DEEP;
  if (y >= H) return AIR;
  return chunkAt(x >> 4, z >> 4).data[place(x & 15, y, z & 15)];
}

// Change a block, remember the change, and note which chunks need redrawing
function setBlock(x, y, z, id) {
  if (y < 1 || y >= H) return false;
  const cx = x >> 4, cz = z >> 4;
  const chunk = chunkAt(cx, cz);
  const at = place(x & 15, y, z & 15);
  const before = chunk.data[at];
  if (before === id) return false;
  chunk.data[at] = id;
  (world.edits[chunk.name] = world.edits[chunk.name] || {})[at] = id;
  const lamp = Boolean(BLOCKS[before].lamp || BLOCKS[id].lamp);
  if (lamp) {
    const list = world.lamps.get(chunk.name).filter((p) => p[0] !== x || p[1] !== y || p[2] !== z);
    if (BLOCKS[id].lamp) list.push([x, y, z]);
    world.lamps.set(chunk.name, list);
  }
  // Redraw this chunk, and its neighbours if the block is on an edge (or is a lantern, whose light spreads)
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const edge = (dx === 0 || (dx < 0 ? (x & 15) === 0 : (x & 15) === 15)) && (dz === 0 || (dz < 0 ? (z & 15) === 0 : (z & 15) === 15));
      const other = world.chunks.get(cx + dx + "," + (cz + dz));
      if (other && (edge || lamp)) other.dirty = true;
    }
  }
  return true;
}

// The highest solid block in a column (so things can be put on the ground)
function groundAt(x, z) {
  for (let y = H - 1; y > 0; y--) if (isSolid(getBlock(x, y, z))) return y;
  return 0;
}

// Paint every block picture onto one sheet (an "atlas")
function makeAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * 16;
  canvas.height = ATLAS_ROWS * 16;
  const g = canvas.getContext("2d");
  TILE_NAMES.forEach(function (name, index) {
    const ox = (index % ATLAS_COLS) * 16;
    const oy = Math.floor(index / ATLAS_COLS) * 16;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const colour = TILES[name](x, y, hash(x, y, index + 100), noise2(x, y, 4, index + 200));
        if (!colour) continue;
        g.fillStyle = colour;
        g.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  });
  return canvas;
}

// ----- Turning a chunk of blocks into a 3D shape -----
// A cube has 6 faces. For each: which way it points (n), its 4 corners, how bright it is,
// and which picture it uses (0 top, 1 side, 2 bottom).
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], bright: 0.8, t: 1 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], bright: 0.8, t: 1 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], bright: 1, t: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], bright: 0.55, t: 2 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], bright: 0.9, t: 1 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], bright: 0.68, t: 1 },
];
// Plants are two flat pictures crossed over, like an X seen from above
const CROSSES = [[[0.15, 0, 0.15], [0.85, 0, 0.85], [0.85, 1, 0.85], [0.15, 1, 0.15]], [[0.85, 0, 0.15], [0.15, 0, 0.85], [0.15, 1, 0.85], [0.85, 1, 0.15]]];
const CORNER_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const SHADOW = [0.5, 0.68, 0.84, 1];     // how dark a corner is when 3, 2, 1 or 0 blocks crowd round it

// Only the faces you could possibly see are drawn: a face is skipped when the block next to it hides it.
// Gives back two lists of numbers ready for THREE.js: one for solid blocks, one for water.
function meshChunk(chunk) {
  const solid = { pos: [], uv: [], shade: [], glow: [], index: [] };
  const water = { pos: [], uv: [], shade: [], glow: [], index: [] };
  const ox = chunk.cx * CH;
  const oz = chunk.cz * CH;
  // Lanterns in this chunk and the ones around it
  const lamps = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const lamp of world.lamps.get(chunk.cx + dx + "," + (chunk.cz + dz)) || []) lamps.push(lamp);
  const data = chunk.data;
  const blockAt = (x, y, z) => (x >= 0 && z >= 0 && x < CH && z < CH && y >= 0 && y < H ? data[place(x, y, z)] : getBlock(ox + x, y, oz + z));
  function corner(out, tile, i, wx, wy, wz, light, ownGlow) {
    const u0 = (tile % ATLAS_COLS) / ATLAS_COLS;
    const v0 = 1 - (Math.floor(tile / ATLAS_COLS) + 1) / ATLAS_ROWS;
    out.pos.push(wx, wy, wz);
    out.uv.push(u0 + (0.002 + CORNER_UV[i][0] * 0.996) / ATLAS_COLS, v0 + (0.002 + CORNER_UV[i][1] * 0.996) / ATLAS_ROWS);
    out.shade.push(light, light, light);
    let glow = ownGlow || 0;
    for (const lamp of lamps) {
      const d = Math.hypot(lamp[0] + 0.5 - wx, lamp[1] + 0.5 - wy, lamp[2] + 0.5 - wz);
      if (d < 8) glow = Math.max(glow, Math.pow(1 - d / 8, 1.4));
    }
    out.glow.push(glow);
  }
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < CH; z++) {
      for (let x = 0; x < CH; x++) {
        const id = data[place(x, y, z)];
        if (id === AIR) continue;
        const kind = BLOCKS[id];
        if (kind.plant) {
          for (const cross of CROSSES) {
            const first = solid.pos.length / 3;
            for (let i = 0; i < 4; i++) corner(solid, kind.tex[1], i, ox + x + cross[i][0], y + cross[i][1], oz + z + cross[i][2], 0.95, kind.glow);
            solid.index.push(first, first + 1, first + 2, first, first + 2, first + 3);
          }
          continue;
        }
        const out = id === WATER ? water : solid;
        for (const face of FACES) {
          const next = blockAt(x + face.n[0], y + face.n[1], z + face.n[2]);
          if (isOpaque(next) || next === id) continue;                       // hidden, or water next to water
          if (kind.liquid && face.n[1] !== 1 && next !== AIR && !BLOCKS[next].plant) continue;
          const first = out.pos.length / 3;
          const dark = [];
          for (let i = 0; i < 4; i++) {
            const c = face.c[i];
            // Soft shadows in corners: count the blocks crowding round this corner
            let crowd = 3;
            if (!kind.liquid && !kind.glow) {
              const side = [];
              for (let axis = 0; axis < 3; axis++) if (face.n[axis] === 0) side.push(axis);
              const p = [x + face.n[0], y + face.n[1], z + face.n[2]];
              const a = p.slice(), b = p.slice(), both = p.slice();
              a[side[0]] += c[side[0]] ? 1 : -1;
              b[side[1]] += c[side[1]] ? 1 : -1;
              both[side[0]] = a[side[0]];
              both[side[1]] = b[side[1]];
              const s1 = isOpaque(blockAt(a[0], a[1], a[2])) ? 1 : 0;
              const s2 = isOpaque(blockAt(b[0], b[1], b[2])) ? 1 : 0;
              crowd = s1 && s2 ? 0 : 3 - s1 - s2 - (isOpaque(blockAt(both[0], both[1], both[2])) ? 1 : 0);
            }
            dark.push(crowd);
            corner(out, kind.tex[face.t], i, ox + x + c[0], y + (kind.liquid && c[1] === 1 ? 0.88 : c[1]), oz + z + c[2], face.bright * SHADOW[crowd], kind.glow);
          }
          // Two triangles make the square. (Which way they split depends on the shadows, so they look smooth.)
          if (dark[0] + dark[2] >= dark[1] + dark[3]) out.index.push(first, first + 1, first + 2, first, first + 2, first + 3);
          else out.index.push(first + 1, first + 2, first + 3, first + 1, first + 3, first);
        }
      }
    }
  }
  return { solid: solid, water: water };
}

// (This last line lets the world be checked by a test outside the browser.)
if (typeof module !== "undefined") module.exports = { world, BLOCKS, RECIPES, TILE_NAMES, landAt, makeChunk, chunkAt, getBlock, setBlock, groundAt, meshChunk, CH, H, SEA };
