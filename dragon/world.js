// The world of Legacy of the Dragon Tamers.
// Nobody drew this map by hand: the code below builds it, the same way every time.
//
// Each square of ground is one letter:
//   W water   S sand    G grass   D dirt path   C cobbles   B bridge
//   F forest floor (the Forest of Doom)   R rock   N snow   P mountain peak
//   A ash     L lava    T temple floor

const MAP_W = 104;
const MAP_H = 80;
const TILE = 16; // one square is 16 pixels wide

// A repeatable "random" number from 0 to 1 for a square. Same square, same number.
function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}

// Smooth, blobby random numbers: good for coastlines and clumps of trees
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

// The important places (in squares)
const PLACES = {
  start: { x: 48, y: 57 },
  grandma: { x: 48, y: 53 },
  wizard: { x: 50, y: 53 },
  glade: { x: 16, y: 46 },
  pass: { x: 57, y: 26 },
  landing: { x: 90, y: 22 },
  boss: { x: 90, y: 14 },
  beacons: [
    { x: 78, y: 51, name: "the Meadow Beacon" },
    { x: 20, y: 62, name: "the Doom Beacon" },
    { x: 40, y: 15, name: "the Stormcrag Beacon" },
  ],
  bushes: [[66, 50], [70, 58], [74, 47], [81, 56], [68, 44], [84, 50], [36, 62], [60, 62]],
  digs: [[62, 66], [27, 38], [48, 20], [40, 70]],
};

function isIsle(x, y) {
  const wobble = (smoothNoise(x, y, 4, 2) - 0.5) * 0.3;
  const dx = (x - 90) / 11;
  const dy = (y - 15) / 10;
  return dx * dx + dy * dy < 1 + wobble;
}

function isMainland(x, y) {
  // Keep a wide channel of sea around the island
  const mx = (x - 90) / 15;
  const my = (y - 15) / 14;
  if (mx * mx + my * my < 1) return false;
  const wobble = (smoothNoise(x, y, 7, 1) - 0.5) * 0.22;
  const dx = (x - 46) / 42;
  const dy = (y - 44) / 32;
  return dx * dx + dy * dy < 1 + wobble;
}

// Which part of the world is this square in?
function regionAt(x, y) {
  if (x >= 78 && y <= 27 && (x - 90) * (x - 90) / 196 + (y - 15) * (y - 15) / 169 < 1) {
    return x >= 84 && x <= 96 && y <= 19 ? "temple" : "isle";
  }
  if (y < 26) return "crag";
  if (y >= 27 && x < 30 + (smoothNoise(x, y, 6, 3) - 0.5) * 5) return "doom";
  if (Math.abs(x - 48) <= 10 && Math.abs(y - 56) <= 8) return "village";
  const lx = (x - 42) / 11;
  const ly = (y - 36) / 7;
  if (lx * lx + ly * ly < 1) return "lake";
  if (x >= 62) return "meadow";
  return "vale";
}

const REGION_NAMES = {
  village: "Emberwick Village",
  vale: "Emberwick Vale",
  meadow: "The Sunny Meadows",
  lake: "Glimmer Lake",
  doom: "The Forest of Doom",
  crag: "The Stormcrag Mountains",
  isle: "Ashen Isle",
  temple: "The Temple of Sauron",
};

function buildWorld() {
  const ground = [];
  const clear = new Set();   // squares where no trees or rocks may grow
  const objects = [];        // trees, houses, lanterns and everything else that stands on the ground
  const key = (x, y) => x + "," + y;
  const inside = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const set = (x, y, letter) => { if (inside(x, y)) ground[y][x] = letter; };
  const get = (x, y) => (inside(x, y) ? ground[y][x] : "W");

  // ----- 1. Land and sea -----
  for (let y = 0; y < MAP_H; y++) {
    ground.push([]);
    for (let x = 0; x < MAP_W; x++) {
      let letter = "W";
      const edge = x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1;
      if (!edge && isIsle(x, y)) letter = "A";
      else if (!edge && isMainland(x, y)) {
        const region = regionAt(x, y);
        if (region === "crag") letter = y < 18 + (smoothNoise(x, y, 4, 8) - 0.5) * 3 ? "N" : "R";
        else if (region === "doom") letter = "F";
        else letter = "G";
      }
      ground[y].push(letter);
    }
  }

  // ----- 2. Glimmer Lake and the river that runs east to the sea -----
  for (let y = 28; y < 45; y++) {
    for (let x = 30; x < 54; x++) {
      const dx = (x - 42) / 8;
      const dy = (y - 36) / 4.5;
      if (dx * dx + dy * dy < 1 + (smoothNoise(x, y, 3, 4) - 0.5) * 0.3) set(x, y, "W");
    }
  }
  const riverY = (x) => Math.round(36 + 2.2 * Math.sin((x - 50) / 5));
  for (let x = 49; x < MAP_W; x++) {
    if (get(x, riverY(x)) === "W" && x > 80) break; // reached the sea
    set(x, riverY(x), "W");
    set(x, riverY(x) + 1, "W");
  }

  // ----- 3. The wall of mountain peaks, with one pass through it -----
  for (let x = 0; x < MAP_W; x++) {
    for (let y = 25; y <= 26; y++) {
      if (get(x, y) !== "W" && regionAt(x, y) !== "isle" && regionAt(x, y) !== "temple") set(x, y, "P");
    }
  }

  // ----- 4. Paths -----
  // Stamp a 2-square-wide path along a list of corner points
  function path(points, letter) {
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(x0 + ((x1 - x0) * s) / steps);
        const y = Math.round(y0 + ((y1 - y0) * s) / steps);
        for (let oy = -1; oy <= 2; oy++) {
          for (let ox = -1; ox <= 2; ox++) {
            clear.add(key(x + ox, y + oy));
            if (ox < 0 || oy < 0 || ox > 1 || oy > 1) continue;
            const now = get(x + ox, y + oy);
            set(x + ox, y + oy, now === "W" || now === "B" ? "B" : letter); // over water, a path becomes a bridge
          }
        }
      }
    }
  }
  // A round patch of ground with nothing growing on it
  function pad(cx, cy, radius, letter) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > radius * radius + 1) continue;
        clear.add(key(x, y));
        if (letter) set(x, y, letter);
      }
    }
  }

  path([[44, 56], [36, 56], [31, 53], [24, 52], [19, 49], [16, 47]], "D");             // west, into the Forest of Doom
  path([[16, 47], [17, 54], [20, 60]], "D");                                           // deeper, to the Doom Beacon
  path([[52, 56], [62, 55], [70, 53], [76, 53]], "D");                                 // east, to the Sunny Meadows
  path([[51, 51], [53, 48], [57, 44], [57, 34], [57, 28], [57, 23]], "D");             // north, over the bridge, to the pass
  path([[57, 23], [56, 21], [50, 19], [44, 18], [40, 17]], "D");                       // up the mountain
  path([[48, 59], [48, 64]], "D");                                                     // a little road south
  pad(16, 46, 4, "F");
  pad(20, 62, 2, "F");
  pad(78, 52, 2, "G");
  pad(40, 16, 2, "N");
  pad(90, 22, 2, "A");

  // The village square
  for (let y = 52; y <= 59; y++) {
    for (let x = 43; x <= 53; x++) {
      set(x, y, "C");
      clear.add(key(x, y));
    }
  }
  // The temple and the arena in front of it
  for (let y = 6; y <= 19; y++) {
    for (let x = 85; x <= 95; x++) {
      set(x, y, "T");
      clear.add(key(x, y));
    }
  }

  // ----- 5. Beaches -----
  const sandy = [];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (ground[y][x] !== "G" && ground[y][x] !== "F") continue;
      let nearWater = false;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (ground[y + oy][x + ox] === "W") nearWater = true;
      if (nearWater) sandy.push([x, y]);
    }
  }
  for (const [x, y] of sandy) set(x, y, "S");

  // ----- 6. Buildings and other things placed by hand -----
  function add(type, x, y, more) {
    const thing = Object.assign({ type: type, x: x, y: y, w: 1, h: 1, solid: true }, more || {});
    objects.push(thing);
    for (let oy = 0; oy < thing.h; oy++) for (let ox = 0; ox < thing.w; ox++) clear.add(key(x + ox, y - oy));
    return thing;
  }
  // (x, y) is the bottom-left square a thing stands on; w and h are how many squares it blocks
  add("hall", 46, 51, { w: 4, h: 2 });
  add("house", 38, 53, { w: 3, h: 2, look: 0 });
  add("house", 38, 59, { w: 3, h: 2, look: 1 });
  add("house", 56, 55, { w: 3, h: 2, look: 2 });
  add("house", 56, 60, { w: 3, h: 2, look: 0 });
  add("house", 44, 63, { w: 3, h: 2, look: 1 });
  add("well", 48, 55, {});
  add("statue", 52, 58, {});
  for (const [x, y] of [[43, 52], [53, 52], [43, 59], [53, 59], [36, 55], [60, 54], [55, 46], [56, 40], [59, 33]]) add("lantern", x, y, {});
  add("sign", 32, 52, { text: "WEST: The Forest of Doom. Do not go alone!" });
  add("sign", 59, 28, { text: "NORTH: The Stormcrag Mountains. The pass is blocked by thorns." });
  add("sign", 63, 54, { text: "EAST: The Sunny Meadows. Emberberries grow here." });
  add("sign", 88, 21, { text: "The Temple of Sauron. Turn back!" });
  add("thorns", 57, 26, {});
  add("thorns", 58, 26, {});
  set(57, 25, "D"); set(58, 25, "D"); set(57, 26, "D"); set(58, 26, "D");
  add("temple", 86, 10, { w: 9, h: 4 });
  add("nest", 16, 45, { solid: false });
  PLACES.beacons.forEach(function (spot, i) {
    add("beacon", spot.x, spot.y, { id: i });
  });
  PLACES.bushes.forEach(function (spot, i) {
    pad(spot[0], spot[1], 1, null);
    add("berrybush", spot[0], spot[1], { id: i });
  });
  PLACES.digs.forEach(function (spot, i) {
    pad(spot[0], spot[1], 1, null);
    add("dig", spot[0], spot[1], { id: i, solid: false });
  });
  // Broken pillars around the Meadow Beacon, and around the temple arena
  for (const [x, y] of [[75, 50], [81, 50], [75, 54], [81, 54]]) add("pillar", x, y, {});
  for (const [x, y] of [[85, 12], [95, 12], [85, 16], [95, 16], [85, 19], [95, 19]]) add("darkpillar", x, y, {});
  add("campfire", 15, 48, { solid: false });

  // ----- 7. Trees, rocks and everything that grows by itself -----
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 2; x++) {
      const letter = ground[y][x];
      if (letter === "P") {
        objects.push({ type: "peak", x: x, y: y, w: 1, h: 1, solid: true, snowy: y < 18 });
        continue;
      }
      if (clear.has(key(x, y))) continue;
      const roll = hash(x, y, 11);
      const clump = smoothNoise(x, y, 5, 6);
      const region = regionAt(x, y);
      let type = null;
      if (letter === "G") {
        if (region === "village") type = roll < 0.03 ? "bush" : null;
        else if (region === "meadow") type = roll < 0.035 ? "oak" : roll < 0.06 ? "bush" : roll < 0.07 ? "rock" : null;
        else type = roll < 0.07 + (clump > 0.55 ? 0.3 : 0) ? "oak" : roll > 0.97 ? "bush" : roll > 0.955 ? "rock" : null;
      } else if (letter === "F") {
        type = roll < 0.4 ? "doomtree" : roll < 0.45 ? "mushroom" : roll < 0.47 ? "skull" : null;
      } else if (letter === "R" || letter === "N") {
        if (smoothNoise(x, y, 4, 9) > 0.7) {
          ground[y][x] = "P";
          objects.push({ type: "peak", x: x, y: y, w: 1, h: 1, solid: true, snowy: letter === "N" });
          continue;
        }
        type = roll < 0.06 ? "rock" : roll < 0.12 ? (letter === "N" ? "snowpine" : "pine") : null;
      } else if (letter === "A") {
        if (smoothNoise(x, y, 3, 5) > 0.7 && region !== "temple") {
          ground[y][x] = "L";
          continue;
        }
        type = roll < 0.08 ? "ashtree" : roll < 0.14 ? "spike" : null;
      } else if (letter === "S") {
        type = roll < 0.012 ? "rock" : null;
      }
      if (type) objects.push({ type: type, x: x, y: y, w: 1, h: 1, solid: type !== "mushroom", look: Math.floor(hash(x, y, 5) * 3) });
    }
  }

  // ----- 8. Where you can and can't go -----
  const blocked = [];   // on foot
  const noFly = [];     // on dragon-back
  for (let y = 0; y < MAP_H; y++) {
    blocked.push([]);
    noFly.push([]);
    for (let x = 0; x < MAP_W; x++) {
      const letter = ground[y][x];
      blocked[y].push(letter === "W" || letter === "L" || letter === "P");
      noFly[y].push(letter === "P" || x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1);
    }
  }
  for (const thing of objects) {
    if (!thing.solid) continue;
    for (let oy = 0; oy < thing.h; oy++) {
      for (let ox = 0; ox < thing.w; ox++) {
        blocked[thing.y - oy][thing.x + ox] = true;
        if (thing.type === "temple") noFly[thing.y - oy][thing.x + ox] = true;
      }
    }
  }

  // ----- 9. Monsters -----
  const monsters = [];
  const kinds = { meadow: ["slime"], vale: ["slime"], lake: ["slime"], doom: ["bat", "spider"], crag: ["golem", "golem", "bat"], isle: ["imp"] };
  for (let y = 3; y < MAP_H - 3; y++) {
    for (let x = 3; x < MAP_W - 3; x++) {
      if (blocked[y][x]) continue;
      const region = regionAt(x, y);
      const list = kinds[region];
      if (!list) continue;
      const chance = region === "doom" ? 0.03 : region === "isle" ? 0.06 : region === "crag" ? 0.03 : 0.012;
      if (hash(x, y, 77) > chance) continue;
      if (Math.hypot(x - 48, y - 56) < 13 || Math.hypot(x - 16, y - 46) < 6) continue; // keep home and the glade safe
      if (PLACES.beacons.some((spot) => Math.hypot(x - spot.x, y - spot.y) < 4)) continue;  // and the beacons
      if (Math.hypot(x - PLACES.landing.x, y - PLACES.landing.y) < 4) continue;             // and the landing beach
      monsters.push({ type: list[Math.floor(hash(x, y, 78) * list.length)], x: x, y: y });
    }
  }

  return { ground: ground, objects: objects, blocked: blocked, noFly: noFly, monsters: monsters };
}

const WORLD = buildWorld();

// (This last line lets the map be checked by a test outside the browser.)
if (typeof module !== "undefined") module.exports = { WORLD, PLACES, MAP_W, MAP_H, TILE, regionAt, REGION_NAMES, hash, smoothNoise };
