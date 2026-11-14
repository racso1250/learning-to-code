// The world of Temple Guardian: mountains, forests, snow and sea, with FOUR temples.
// The map is made by the computer from a seed, using "noise" (smooth random bumps).

const SIZE = 96;        // the world is 96 x 96 squares
const SEED = 77;

// ----- The four temples, and the Gloom rift attacking each one -----

const temples = [
  { id: "mountain", name: "Mountain Temple", x: 48, y: 44, rift: { x: 58, y: 36 } },
  { id: "forest", name: "Forest Temple", x: 16, y: 46, rift: { x: 22, y: 30 } },
  { id: "ice", name: "Ice Temple", x: 50, y: 12, rift: { x: 36, y: 10 } },
  { id: "sea", name: "Sea Temple", x: 80, y: 80, rift: { x: 80, y: 85 } },
];
const TEMPLE_RADIUS = 3;     // each temple floor is 7 x 7

// The wizards who defend each temple, and the colour of their robes
const templeWizards = {
  mountain: { colour: "#3f6fd8", names: ["Wizard Bramble", "Wizard Flint", "Wizard Orla"] },
  forest: { colour: "#3f9a4a", names: ["Wizard Moss", "Wizard Rowan", "Wizard Hazel"] },
  ice: { colour: "#cfe8ff", names: ["Wizard Frost", "Wizard Sleet", "Wizard Ivy"] },
  sea: { colour: "#2fa8a8", names: ["Wizard Coral", "Wizard Tide", "Wizard Pearl"] },
};
// Where the wizards stand, compared to the middle of their temple
const wizardSpots = [[-4, 1], [4, 1], [0, 4]];
const templePillars = [[-3, -3], [0, -3], [3, -3], [-3, 0], [3, 0], [-3, 3], [3, 3]];

const START = { x: 48, y: 53 };   // your camp, just south of the Mountain Temple

// Where the Gloom King appears once all four temples are saved
const KING_SPOT = { x: 48, y: 33 };

// ----- Materials -----

const materials = {
  wood: { name: "Wood", icon: "🪵" },
  stone: { name: "Stone", icon: "🪨" },
  iron: { name: "Iron", icon: "🔩" },
  crystal: { name: "Crystal", icon: "💎" },
  berries: { name: "Berries", icon: "🍒" },
  herbs: { name: "Herbs", icon: "🌿" },
  shards: { name: "Gloom shards", icon: "🟣" },
  // Found in the Free Play areas
  wheat: { name: "Wheat", icon: "🌾" },
  pumpkin: { name: "Pumpkins", icon: "🎃" },
  duskstone: { name: "Duskstone", icon: "🔮" },
  gloomsteel: { name: "Gloomsteel", icon: "⬛" },
};

// Things you can gather. "tool" is what you need to gather it (null = bare hands).
// "hits" is how many hits it takes (better tools take fewer).
const resources = {
  tree: { gives: "wood", amount: 2, hits: 4, tool: null, better: "axe" },
  pine: { gives: "wood", amount: 2, hits: 4, tool: null, better: "axe" },
  rock: { gives: "stone", amount: 2, hits: 4, tool: null, better: "pickaxe" },
  iron: { gives: "iron", amount: 1, hits: 4, tool: "stonePick", better: "pickaxe" },
  crystal: { gives: "crystal", amount: 1, hits: 5, tool: "ironPick", better: "pickaxe" },
  bush: { gives: "berries", amount: 2, hits: 1, tool: null },
  herb: { gives: "herbs", amount: 1, hits: 1, tool: null },
  // Free Play areas
  wheat: { gives: "wheat", amount: 1, hits: 1, tool: null },
  pumpkin: { gives: "pumpkin", amount: 1, hits: 2, tool: null },
  duskTree: { gives: "wood", amount: 2, hits: 4, tool: null, better: "axe" },
  deadTree: { gives: "wood", amount: 1, hits: 3, tool: null, better: "axe" },
  duskstone: { gives: "duskstone", amount: 1, hits: 4, tool: "ironPick", better: "pickaxe" },
  gloomsteel: { gives: "gloomsteel", amount: 1, hits: 5, tool: "ironPick", better: "pickaxe" },
};

// ----- Crafting recipes -----

const recipes = [
  { id: "woodSword", name: "Wooden sword", icon: "🗡️", needs: { wood: 5 }, damage: 2 },
  { id: "stoneAxe", name: "Stone axe", icon: "🪓", needs: { wood: 3, stone: 3 }, about: "chop trees faster" },
  { id: "stonePick", name: "Stone pickaxe", icon: "⛏️", needs: { wood: 3, stone: 4 }, about: "mine iron" },
  { id: "stoneSword", name: "Stone sword", icon: "🗡️", needs: { wood: 2, stone: 6 }, damage: 3 },
  { id: "ironPick", name: "Iron pickaxe", icon: "⛏️", needs: { wood: 2, iron: 5 }, about: "mine crystal" },
  { id: "ironSword", name: "Iron sword", icon: "⚔️", needs: { wood: 2, iron: 6 }, damage: 5 },
  { id: "armour", name: "Iron armour", icon: "🛡️", needs: { iron: 8 }, about: "take half damage" },
  { id: "crystalBlade", name: "Crystal blade", icon: "✨", needs: { iron: 3, crystal: 5 }, damage: 8 },
  { id: "potion", name: "Healing potion", icon: "🧪", needs: { berries: 2, herbs: 1 }, repeat: true, about: "press Q to drink" },
  { id: "repairKit", name: "Temple repair kit", icon: "🧰", needs: { stone: 6, iron: 2 }, repeat: true, about: "fix a temple" },
  { id: "totem", name: "Light totem", icon: "🕯️", needs: { crystal: 3, stone: 4, shards: 2 }, repeat: true, about: "close a rift" },
  // Recipes for Free Play materials
  { id: "pie", name: "Pumpkin pie", icon: "🥧", needs: { wheat: 2, pumpkin: 1 }, repeat: true, about: "heals 10, press Q" },
  { id: "duskBlade", name: "Dusk blade", icon: "🔮", needs: { duskstone: 4, iron: 2 }, damage: 10 },
  { id: "gloomBlade", name: "Gloomsteel blade", icon: "🗡️", needs: { gloomsteel: 4, crystal: 2 }, damage: 14 },
];

// ----- Free Play areas -----
// You unlock these by doing quests after defeating the Gloom King.

const areas = {
  temple: { name: "Temple Lands", size: SIZE, start: START },
  farm: { name: "Farm Lands", size: 64, start: { x: 32, y: 56 } },
  dusk: { name: "Dusk Lands", size: 64, start: { x: 32, y: 56 } },
  gloom: { name: "Mount Gloom", size: 64, start: { x: 32, y: 58 }, summit: { x: 32, y: 28 } },
  // The Great Land: the massive building world you reach with the Free Play button
  builder: { name: "The Great Land", size: 120, start: { x: 75, y: 87 } },
};

// ----- The Great Land: ruins to fix, and buildings to build -----

// Ruins you find in the Great Land, what it costs to fix them, and what they become
const ruinTypes = {
  ruinHouse: { name: "ruined house", becomes: "house", needs: { wood: 6, stone: 4 } },
  ruinWell: { name: "broken well", becomes: "well", needs: { stone: 6 } },
  ruinTower: { name: "crumbling tower", becomes: "tower", needs: { stone: 12, iron: 4 } },
  ruinMill: { name: "broken windmill", becomes: "windmill", needs: { wood: 10, stone: 6 } },
};

// Buildings, and how many people come to live in your land when you build (or fix) one
const buildingTypes = {
  house: { name: "House", icon: "🏠", needs: { wood: 8, stone: 4 }, people: 2 },
  farm: { name: "Farm", icon: "🌾", needs: { wood: 5, wheat: 3 }, people: 1 },
  well: { name: "Well", icon: "🪣", needs: { stone: 8 }, people: 1 },
  windmill: { name: "Windmill", icon: "🌬️", needs: { wood: 12, stone: 6 }, people: 3 },
  tower: { name: "Tower", icon: "🗼", needs: { stone: 15, iron: 6 }, people: 3 },
  market: { name: "Market", icon: "🏪", needs: { wood: 12, stone: 12, iron: 4 }, people: 4 },
  statue: { name: "Statue", icon: "🗽", needs: { stone: 20, crystal: 3 }, people: 2 },
};

const BOAT_COST = { wood: 12 };

// ----- Noise -----

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + (seed + SEED) * 2246822519) | 0;
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

// ----- Building the world -----
// Each tile looks like: { kind, height, thing, temple, rift }

function makeWorld(area) {
  area = area || "temple";
  const size = areas[area].size;
  const tiles = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      row.push(area === "temple" ? makeTile(x, y) : makeAreaTile(area, x, y));
    }
    tiles.push(row);
  }
  return tiles;
}

// The Free Play areas: Farm Lands, Dusk Lands and Mount Gloom
function makeAreaTile(area, x, y) {
  const size = areas[area].size;
  const start = areas[area].start;
  const tile = { kind: "grass", height: 0, thing: null, temple: null, rift: null };
  const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
  const fromStart = Math.hypot(x - start.x, y - start.y);
  const r = hash(x, y, 31);

  if (area === "builder") return makeBuilderTile(x, y, tile);

  // Water all around the edge
  if (edge < 3 + noise(x, y, 6, 30) * 2) {
    tile.kind = "water";
    tile.height = -1;
    return tile;
  }

  if (area === "farm") {
    // Gentle hills, ponds, and fenced fields of wheat and pumpkins
    tile.height = Math.floor(noise(x, y, 16, 21) * 2);
    if (noise(x, y, 10, 22) < 0.15 && fromStart > 6) {
      tile.kind = "water";
      tile.height = -1;
      return tile;
    }
    if (fromStart < 4) return tile;
    const inFields = x > 8 && x < 56 && y > 8 && y < 48;
    const field = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
    if (inFields && field) {
      tile.height = 0;
      const onBorder = x % 8 === 0 || y % 8 === 0;
      const gate = x % 8 === 4 || y % 8 === 4;
      if (onBorder) {
        if (!gate) tile.thing = "fence";
      } else if (x % 2 === 0) {
        tile.thing = hash(Math.floor(x / 8), Math.floor(y / 8), 23) < 0.5 ? "wheat" : "pumpkin";
      }
      return tile;
    }
    if (r < 0.06) tile.thing = "tree";
    else if (r < 0.09) tile.thing = "bush";
    else if (r < 0.11) tile.thing = "herb";
    return tile;
  }

  if (area === "dusk") {
    // Purple twilight lands with glowing duskstone
    tile.height = Math.floor((noise(x, y, 12, 24) * 0.6 + noise(x, y, 5, 25) * 0.4) * 4);
    if (fromStart < 4) tile.height = 1;
    if (tile.height <= 1 && noise(x, y, 9, 26) < 0.18 && fromStart > 6) {
      tile.kind = "water";
      tile.height = -1;
      return tile;
    }
    if (fromStart < 4) return tile;
    if (r < 0.12) tile.thing = "duskTree";
    else if (r < 0.17) tile.thing = "duskstone";
    else if (r < 0.2) tile.thing = "herb";
    else if (r < 0.22) tile.thing = "bush";
    return tile;
  }

  // Mount Gloom: one huge dark mountain, with a throne at the very top
  const summit = areas.gloom.summit;
  const fromSummit = Math.hypot(x - summit.x, y - summit.y);
  tile.kind = "rock";
  tile.height = Math.max(0, Math.min(8, Math.floor(8 - fromSummit / 3.2 + noise(x, y, 6, 27) * 1.2)));
  if (fromStart < 3) tile.height = 0;
  if (x === summit.x && y === summit.y) {
    tile.thing = "throne";
    return tile;
  }
  if (fromStart < 3 || fromSummit < 2) return tile;
  if (r < 0.05) tile.thing = "deadTree";
  else if (r < 0.11) tile.thing = "gloomsteel";
  else if (r < 0.15) tile.thing = "rock";
  else if (r < 0.17) tile.thing = "crystal";
  return tile;
}

function nearest(list, x, y) {
  let best = Infinity;
  for (const p of list) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
  return best;
}

function makeTile(x, y) {
  const tile = { kind: "grass", height: 0, thing: null, temple: null, rift: null };

  // Rifts always sit on dry land
  for (const temple of temples) {
    if (x === temple.rift.x && y === temple.rift.y) {
      tile.height = 1;
      tile.rift = temple.id;
      tile.thing = "rift";
      return tile;
    }
  }

  // The sea: all around the edge, and a big bay in the south-east
  const edge = Math.min(x, y, SIZE - 1 - x, SIZE - 1 - y);
  const bay = Math.hypot(x - 80, y - 80);
  let sea = edge < 4 + noise(x, y, 6, 1) * 3;
  if (bay < 20 + noise(x, y, 8, 2) * 4 && bay > 6) sea = true;  // water around the Sea Temple's island
  if (sea) {
    tile.kind = "water";
    tile.height = -1;
    return tile;
  }

  // Hills
  const bumps = noise(x, y, 14, 3) * 0.6 + noise(x, y, 5, 4) * 0.4;
  let height = Math.floor(bumps * 5);

  // Temples sit on flat ground, and so does your camp
  const templeDistance = nearest(temples, x, y);
  const campDistance = Math.hypot(x - START.x, y - START.y);
  if (templeDistance < 7 || campDistance < 4) height = 1;

  // Lakes in some low places (you can swim in them!)
  if (height <= 1 && noise(x, y, 9, 5) < 0.2 && templeDistance > 8 && campDistance > 6 && nearest(temples.map((t) => t.rift), x, y) > 4) {
    tile.kind = "water";
    tile.height = -1;
    return tile;
  }
  tile.height = height;

  // Which part of the world is this? North = snow, west = forest, middle = rocky hills
  const region = y < 24 ? "snow" : x < 30 ? "forest" : x > 64 && y > 60 ? "island" : y > 66 ? "meadow" : "hills";
  if (region === "snow") tile.kind = "snow";
  else if (region === "hills" && height >= 3) tile.kind = "rock";

  // Temple floors and pillars
  for (const temple of temples) {
    if (Math.abs(x - temple.x) <= TEMPLE_RADIUS && Math.abs(y - temple.y) <= TEMPLE_RADIUS) {
      tile.kind = "temple";
      tile.temple = temple.id;
      if (x === temple.x && y === temple.y) tile.thing = "altar";
      for (const [px, py] of templePillars) {
        if (x === temple.x + px && y === temple.y + py) tile.thing = "pillar";
      }
      return tile;
    }
  }

  // Keep the camp, the paths near temples and the rifts clear
  if (campDistance < 4 || templeDistance < 5 || nearest(temples.map((t) => t.rift), x, y) < 2.5) {
    return tile;
  }

  // Things to gather, depending on the region
  const r = hash(x, y, 9);
  const chances = {
    forest: [["tree", 0.22], ["bush", 0.05], ["herb", 0.03], ["rock", 0.02]],
    hills: [["rock", 0.08], ["iron", 0.05], ["tree", 0.04], ["bush", 0.02]],
    snow: [["pine", 0.1], ["iron", 0.04], ["crystal", 0.04], ["rock", 0.04]],
    meadow: [["bush", 0.07], ["herb", 0.06], ["tree", 0.04], ["rock", 0.03]],
    island: [["crystal", 0.06], ["bush", 0.04], ["tree", 0.06], ["rock", 0.03]],
  };
  let total = 0;
  for (const [thing, chance] of chances[region]) {
    total += chance;
    if (r < total) {
      tile.thing = thing;
      break;
    }
  }
  return tile;
}

// The Great Land: a huge continent with rivers, hills, a snowy north, and islands out at sea
function makeBuilderTile(x, y, tile) {
  const size = areas.builder.size;
  const start = areas.builder.start;
  const middle = size / 2;
  const fromMiddle = Math.hypot((x - middle) / middle, (y - middle) / middle);
  const fromStart = Math.hypot(x - start.x, y - start.y);
  const r = hash(x, y, 41);

  // Land is higher in the middle, with gentle hills; the sea is all around.
  // (Only smooth, wide bumps are used for height, so hills can be climbed step by step.)
  const smooth = noise(x, y, 26, 42) * 0.6 + noise(x, y, 11, 43) * 0.4 - fromMiddle * fromMiddle * 0.8 + 0.1;
  const land = smooth + (noise(x, y, 4, 44) - 0.5) * 0.08; // a wobbly coastline
  // A few islands out in the sea
  const island = noise(x, y, 7, 45) > 0.78 && fromMiddle > 0.75 && fromMiddle < 0.95;
  // Winding rivers
  const river = Math.abs(noise(x, y, 30, 46) - 0.5) < 0.025 && fromStart > 6;

  if ((land < 0.05 && !island) || (river && land < 0.4)) {
    tile.kind = "water";
    tile.height = -1;
    return tile;
  }

  tile.height = island ? 0 : Math.max(0, Math.min(6, Math.floor((smooth - 0.05) * 11)));
  if (tile.height >= 4) tile.kind = "rock";
  if (y < size * 0.22 && tile.height >= 2) tile.kind = "snow";
  if (fromStart < 6) return tile;

  // Ruins to fix, scattered across the land (and on the islands)
  if (r < 0.008 && tile.height <= 3) {
    const kinds = Object.keys(ruinTypes);
    tile.thing = "ruin";
    tile.ruin = kinds[Math.floor(hash(x, y, 47) * kinds.length)];
    return tile;
  }

  // Things to gather
  if (tile.kind === "snow") {
    if (r < 0.08) tile.thing = "pine";
    else if (r < 0.11) tile.thing = "crystal";
    else if (r < 0.14) tile.thing = "iron";
  } else if (tile.kind === "rock") {
    if (r < 0.1) tile.thing = "rock";
    else if (r < 0.15) tile.thing = "iron";
    else if (r < 0.17) tile.thing = "crystal";
  } else {
    if (r < 0.09) tile.thing = "tree";
    else if (r < 0.12) tile.thing = "rock";
    else if (r < 0.135) tile.thing = "bush";
    else if (r < 0.15) tile.thing = "wheat";
    else if (r < 0.16) tile.thing = "herb";
  }
  return tile;
}
