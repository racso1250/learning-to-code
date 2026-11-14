// The islands, and the code that builds them.
//
// Every island is made by the computer from a "seed" number. The same seed
// always makes the same island, so you can design a new island just by adding
// one line to the list below and trying different seeds!

const islands = [
  { name: "Palm Island", theme: "tropical", seed: 7, size: 36, diamonds: 6 },
  { name: "Frost Island", theme: "snowy", seed: 21, size: 42, diamonds: 8 },
  // When you finish Ember Island, a MASSIVE portal rises out of the sea...
  { name: "Ember Island", theme: "volcano", seed: 5, size: 46, diamonds: 10, bigPortal: true },
  // ...and it takes you to the biggest island of all!
  { name: "Dusk Island", theme: "dusk", seed: 42, size: 64, diamonds: 14 },
];

// What each kind of island looks like
const themes = {
  tropical: {
    beachTop: ["#f3e3a8", "#e6d18e", "#fbf0c4"],   // the colours of each texture
    groundTop: ["#5fbf4a", "#4ea83c", "#77d35f"],
    peakTop: ["#7dd862", "#68c552", "#92e47a"],
    side: ["#9a6a3c", "#7f5530", "#b07c48"],
    water: ["#2fb6d6", "#4fcbe6", "#a8f0ff"],
    sky: "#9fe0ff",
    fog: "#c9f0ff",
    light: 0xfff2d8,
    diamond: ["#6fe6ff", "#2aa6d6"],
    trees: [palmSprite, palmSprite, bushSprite],
    flower: flowerSprite,
    treeChance: 0.12,
    rockChance: 0.03,
    flowerChance: 0.06,
    lavaPeaks: false,
  },
  snowy: {
    beachTop: ["#e4eef5", "#d2e0ea", "#f4f9fc"],
    groundTop: ["#f4f8fc", "#e2ebf3", "#ffffff"],
    peakTop: ["#dff2ff", "#c9e8fb", "#f2fbff"],
    side: ["#8fa3b8", "#748aa1", "#a9bccf"],
    water: ["#2f6fb0", "#4688c8", "#9fd0ff"],
    sky: "#cfe6f7",
    fog: "#e4f1fa",
    light: 0xeef6ff,
    diamond: ["#ff8fd0", "#d6409a"],
    trees: [pineSprite],
    flower: snowTuftSprite,
    treeChance: 0.14,
    rockChance: 0.04,
    flowerChance: 0.08,
    lavaPeaks: false,
  },
  volcano: {
    beachTop: ["#3a3540", "#2d2932", "#4a4452"],
    groundTop: ["#6a6066", "#5a5056", "#7a7076"],
    peakTop: ["#4e454c", "#3f373d", "#5e555c"],
    lavaTop: ["#ff7a1a", "#ffb02e", "#ff4a10"],   // the very tops are LAVA!
    side: ["#3d3036", "#2c2228", "#4e3e46"],
    water: ["#1f4f8f", "#2f63a6", "#6fa0e0"],
    sky: "#f2a46b",
    fog: "#f0b88a",
    light: 0xffd2b0,
    diamond: ["#ffd84a", "#e09a10"],
    trees: [deadTreeSprite],
    flower: null,
    treeChance: 0.06,
    rockChance: 0.08,
    flowerChance: 0,
    lavaPeaks: true,
  },
  dusk: {
    beachTop: ["#e8b8a8", "#d8a090", "#f6ccbc"],
    groundTop: ["#6a5a9a", "#5a4a8a", "#7a6aaa"],
    peakTop: ["#9a8ac8", "#8a7ab8", "#b0a0dc"],
    side: ["#4a3a64", "#3a2c52", "#5c4a78"],
    water: ["#3a2a6a", "#4a3a80", "#ff9a7a"],
    sky: "#7a4a7a",
    fog: "#9a5a7a",
    light: 0xffc0b0,
    diamond: ["#ffffff", "#b08aff"],
    trees: [palmSprite, pineSprite, bushSprite],
    treeSwaps: { g: "#4fe0c8", G: "#2a9a9a", t: "#5a3a6a", T: "#3a2448", u: "#3a2448" }, // glowing teal leaves
    flower: flowerSprite,
    flowerSwaps: { f: "#7fd0ff", F: "#ffffff", G: "#2a9a9a" },
    treeChance: 0.1,
    rockChance: 0.03,
    flowerChance: 0.1,
    lavaPeaks: false,
  },
};

const MAX_HEIGHT = 4; // the tallest a hill can be

// ----- Random numbers from a seed -----

// Math.random() gives different numbers every time. This gives the SAME
// list of "random" numbers every time for the same seed.
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "Noise" is a smooth, bumpy pattern: perfect for making hills.
// We pick random heights on a coarse grid and blend smoothly between them.
function makeNoise(random, size, cellSize) {
  const gridSize = Math.ceil(size / cellSize) + 2;
  const grid = [];
  for (let i = 0; i < gridSize * gridSize; i++) {
    grid.push(random());
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function (x, y) {
    const gx = x / cellSize;
    const gy = y / cellSize;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const a = grid[y0 * gridSize + x0];
    const b = grid[y0 * gridSize + x0 + 1];
    const c = grid[(y0 + 1) * gridSize + x0];
    const d = grid[(y0 + 1) * gridSize + x0 + 1];
    const top = a + (b - a) * tx;
    const bottom = c + (d - c) * tx;
    return top + (bottom - top) * ty;
  };
}

// ----- Building an island -----

// Can you walk on this square? (Not water, lava, trees, rocks or people.)
function isWalkable(tile) {
  return (
    tile.kind !== "water" &&
    tile.kind !== "lava" &&
    tile.thing !== "tree" &&
    tile.thing !== "rock" &&
    tile.thing !== "person"
  );
}

// Find every square you can reach from (startX, startY).
// You can step up or down ONE level at a time, but not climb cliffs.
function findReachable(tiles, startX, startY) {
  const size = tiles.length;
  const reached = new Set([startX + "," + startY]);
  const queue = [[startX, startY]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const key = nx + "," + ny;
      const next = tiles[ny][nx];
      if (!reached.has(key) && isWalkable(next) && Math.abs(next.height - tiles[y][x].height) <= 1) {
        reached.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return reached;
}

function tryToBuild(config, seed) {
  const theme = themes[config.theme];
  const size = config.size;
  const random = seededRandom(seed);
  const bigBumps = makeNoise(random, size, 8);
  const smallBumps = makeNoise(random, size, 3);
  const middle = (size - 1) / 2;
  const tiles = [];

  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      // Higher in the middle, lower at the edges, with bumps for hills
      const dx = (x - middle) / middle;
      const dy = (y - middle) / middle;
      const distance = dx * dx + dy * dy;
      const elevation = bigBumps(x, y) * 0.65 + smallBumps(x, y) * 0.35 - distance - 0.05;

      const tile = { kind: "water", height: -1, thing: null };
      if (elevation >= 0) {
        tile.height = elevation < 0.06 ? 0 : Math.min(MAX_HEIGHT, 1 + Math.floor((elevation - 0.06) / 0.09));
        if (tile.height === 0) {
          tile.kind = "beach";
        } else if (tile.height === MAX_HEIGHT) {
          // On a volcano, the very highest places are bubbling lava
          tile.kind = theme.lavaPeaks && elevation > 0.42 ? "lava" : "peak";
        } else {
          tile.kind = "ground";
        }

        // Trees, rocks and flowers
        const r = random();
        if (tile.kind === "ground" || tile.kind === "peak") {
          if (r < theme.treeChance) {
            tile.thing = "tree";
            tile.treeSprite = theme.trees[Math.floor(random() * theme.trees.length)];
          } else if (r < theme.treeChance + theme.rockChance) {
            tile.thing = "rock";
          } else if (r < theme.treeChance + theme.rockChance + theme.flowerChance) {
            tile.thing = "flower";
          }
        } else if (tile.kind === "beach" && r < 0.03) {
          tile.thing = "rock";
        }
      }
      row.push(tile);
    }
    tiles.push(row);
  }

  // Start on the beach closest to the bottom-middle of the island
  let start = null;
  for (let y = size - 1; y >= 0 && start === null; y--) {
    let bestX = -1;
    for (let x = 0; x < size; x++) {
      if (tiles[y][x].kind === "beach" && (bestX < 0 || Math.abs(x - middle) < Math.abs(bestX - middle))) {
        bestX = x;
      }
    }
    if (bestX >= 0) {
      start = { x: bestX, y: y };
    }
  }
  if (start === null) {
    return null; // no beach! try another seed
  }

  // Clear trees and rocks around the start
  for (let y = start.y - 2; y <= start.y + 2; y++) {
    for (let x = start.x - 2; x <= start.x + 2; x++) {
      if (tiles[y] && tiles[y][x] && tiles[y][x].thing !== "flower") {
        tiles[y][x].thing = null;
      }
    }
  }

  const reachable = findReachable(tiles, start.x, start.y);
  if (reachable.size < 150) {
    return null; // too small to explore: try another seed
  }

  // Hide diamonds far apart from each other, preferring high-up places.
  // Each new diamond goes on the reachable square furthest from the others.
  const chosen = [start];
  const diamonds = [];
  for (let i = 0; i < config.diamonds; i++) {
    let best = null;
    let bestScore = -1;
    for (const key of reachable) {
      const [x, y] = key.split(",").map(Number);
      let nearest = Infinity;
      for (const c of chosen) {
        nearest = Math.min(nearest, Math.abs(c.x - x) + Math.abs(c.y - y));
      }
      const score = nearest + tiles[y][x].height * 1.5;
      if (score > bestScore) {
        bestScore = score;
        best = { x: x, y: y };
      }
    }
    chosen.push(best);
    diamonds.push(best);
    tiles[best.y][best.x].thing = null; // no flower under a diamond
  }

  return { size: size, tiles: tiles, start: start, diamonds: diamonds, theme: theme };
}

// Build an island. If a seed makes a bad island, quietly try the next one.
function buildIsland(config) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const island = tryToBuild(config, config.seed + attempt * 101);
    if (island !== null) {
      return island;
    }
  }
  throw new Error("Couldn't build " + config.name + ". Try a different seed!");
}
