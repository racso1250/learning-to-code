// Nightwood: the forest map, built by code.
// Each square of ground is a letter: F forest floor, G grass, D dirt path, W water, P mountain (the edge).

const TILE = 16;
let MAP_W = 72;
let MAP_H = 72;
let WORLD = null;
const CAMP = [36, 40];      // your campfire
const GATE = [36, 3];       // the way out

function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}
function smoothNoise(x, y, size, seed) {
  const gx = Math.floor(x / size);
  const gy = Math.floor(y / size);
  let fx = x / size - gx;
  let fy = y / size - gy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, seed), b = hash(gx + 1, gy, seed), c = hash(gx, gy + 1, seed), d = hash(gx + 1, gy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function moodAt() {
  return "doom";
}

function makeForest() {
  const ground = [];
  const blocked = [];
  const objects = [];
  const clear = new Set();      // squares where no tree may grow (paths and clearings)
  const key = (x, y) => x + "," + y;
  for (let y = 0; y < MAP_H; y++) {
    ground.push([]);
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      let letter = smoothNoise(x, y, 6, 1) > 0.64 ? "G" : "F";
      if (smoothNoise(x, y, 7, 2) > 0.78 && Math.hypot(x - CAMP[0], y - CAMP[1]) > 9) letter = "W";
      if (edge < 2 + smoothNoise(x, y, 4, 3) * 2) letter = "P";
      ground[y].push(letter);
    }
  }
  const dirt = function (x, y) {
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return;
    ground[y][x] = "D";
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      clear.add(key(x + ox, y + oy));
      const now = ground[y + oy][x + ox];
      if (now === "W" || now === "P") ground[y + oy][x + ox] = "F";      // paths cut through ponds and rock
    }
  };
  // A winding path from one square to another
  const path = function (x0, y0, x1, y1, salt) {
    let x = x0, y = y0;
    for (let n = 0; n < 400 && (x !== x1 || y !== y1); n++) {
      dirt(x, y);
      const wander = hash(n, salt, 9);
      if (x !== x1 && (y === y1 || wander < 0.5)) x += Math.sign(x1 - x);
      else y += Math.sign(y1 - y);
      if (wander > 0.88 && n % 3 === 0) dirt(x + (wander > 0.94 ? 1 : -1), y);
    }
    dirt(x1, y1);
  };
  // The camp clearing, the six rune stones in a ring around it, and the gate to the north
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y < 12) dirt(CAMP[0] + x, CAMP[1] + y);
  const stones = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.5;
    const sx = Math.max(7, Math.min(MAP_W - 8, Math.round(CAMP[0] + Math.cos(angle) * 27)));
    const sy = Math.max(9, Math.min(MAP_H - 8, Math.round(CAMP[1] + Math.sin(angle) * 24)));
    path(CAMP[0], CAMP[1], sx, sy, i + 20);
    dirt(sx + 1, sy);
    dirt(sx, sy + 1);
    stones.push([sx, sy]);
    objects.push({ type: "stone", x: sx, y: sy - 1, solid: true });
  }
  path(CAMP[0], CAMP[1], GATE[0], GATE[1] + 2, 40);
  for (let y = 0; y <= GATE[1] + 1; y++) for (const x of [GATE[0] - 1, GATE[0]]) {
    ground[y][x] = "D";
    clear.add(key(x, y));
  }
  // Trees and other things
  for (let y = 0; y < MAP_H; y++) {
    blocked.push([]);
    for (let x = 0; x < MAP_W; x++) {
      const letter = ground[y][x];
      blocked[y].push(letter === "W" || letter === "P");
      if (letter === "P") objects.push({ type: "peak", x: x, y: y });
      if (letter === "W" || letter === "P" || clear.has(key(x, y))) continue;
      const roll = hash(x, y, 11);
      const type = roll < 0.2 ? "tree" : roll < 0.23 ? "mushroom" : roll < 0.25 ? "rock" : roll < 0.26 ? "skull" : null;
      if (!type) continue;
      objects.push({ type: type, x: x, y: y, look: Math.floor(hash(x, y, 5) * 3) });
      if (type !== "mushroom") blocked[y][x] = true;
    }
  }
  for (const o of objects) if (o.solid) blocked[o.y][o.x] = true;
  // Firewood and batteries lie along the paths
  const paths = [];
  for (let y = 4; y < MAP_H - 4; y++) for (let x = 4; x < MAP_W - 4; x++) if (ground[y][x] === "D" && !blocked[y][x] && Math.hypot(x - CAMP[0], y - CAMP[1]) > 6) paths.push([x, y]);
  const scatter = function (count, salt, apart) {
    const spots = [];
    for (let tries = 0; spots.length < count && tries < 3000; tries++) {
      const spot = paths[Math.floor(hash(tries, salt, 13) * paths.length)];
      if (spots.concat(used).every((other) => Math.hypot(other[0] - spot[0], other[1] - spot[1]) >= apart)) spots.push(spot);
    }
    used.push(...spots);
    return spots;
  };
  const used = stones.slice();
  const wood = scatter(18, 1, 4);
  const batteries = scatter(8, 7, 3);
  WORLD = { ground: ground, objects: objects, blocked: blocked, paths: paths };
  return { stones: stones, wood: wood, batteries: batteries };
}

if (typeof module !== "undefined") module.exports = { makeForest, world: () => WORLD, CAMP, GATE, MAP_W, MAP_H };
