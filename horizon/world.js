// Wildlings: Wild Horizon. The island of Solara: one big open world.
// Meadows in the middle, a forest in the west, a desert in the east, a lake, high moors in the north
// and a snowy peak above them. The map is a grid of squares; each has a kind and a height (0, 1 or 2).

const TILE = 16;
const CW = 200, CH = 200, MID = 100;
const STEP_UP = 30;          // how much higher each level of land is
const MEADOW = 0, WOOD = 1, SAND = 2, SNOW = 3, MOOR = 4, PATH = 5, PLAZA = 6, WATER = 7, DEEP = 8, TREE = 9, BOULDER = 10, WALL = 11;
// A repeatable "random" number for a square (so the island is the same every time)
function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
// Smooth lumpy numbers, for wobbly coastlines and edges
function lumps(x, y, size, seed) {
  const gx = Math.floor(x / size), gy = Math.floor(y / size), fx = x / size - gx, fy = y / size - gy;
  const ease = (t) => t * t * (3 - 2 * t);
  const top = hash(gx, gy, seed) + (hash(gx + 1, gy, seed) - hash(gx, gy, seed)) * ease(fx);
  const bottom = hash(gx, gy + 1, seed) + (hash(gx + 1, gy + 1, seed) - hash(gx, gy + 1, seed)) * ease(fx);
  return top + (bottom - top) * ease(fy);
}
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function tinted(img, colour) {          // a one-colour shadow copy of a picture
  const c = makeCanvas(img.width, img.height), g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = colour;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
const tiles = Array.from({ length: CH }, () => new Uint8Array(CW));        // what stands on each square
const floor = Array.from({ length: CH }, () => new Uint8Array(CW));        // the ground underneath (for drawing)
const level = Array.from({ length: CH }, () => new Uint8Array(CW));        // how high it is: 0, 1 or 2
const LAKE = { x: 126, y: 142 };
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
  const dx = x - MID, dy = y - MID, r = Math.hypot(dx, dy), n = lumps(x, y, 18, 1), n2 = lumps(x, y, 11, 2);
  const coast = 86 + n * 10;
  let kind = MEADOW, lv = 0;
  if (r > coast + 13) kind = DEEP;
  else if (r > coast) kind = WATER;
  else {
    lv = y < 44 + n2 * 8 && Math.abs(dx) < 52 ? 2 : y < 76 + n * 8 ? 1 : 0;
    kind = lv === 2 ? SNOW : lv === 1 ? MOOR : r > coast - 3.5 ? SAND : x < 66 + n2 * 10 ? WOOD : x > 136 - n2 * 10 ? SAND : MEADOW;
  }
  if (((x - LAKE.x) / 26) ** 2 + ((y - LAKE.y) / 17) ** 2 < 1 && lv === 0 && kind !== DEEP) kind = Math.hypot(x - LAKE.x, y - LAKE.y) < 8.5 ? MEADOW : WATER;
  tiles[y][x] = floor[y][x] = kind;
  level[y][x] = lv;
}
const flatten = function (cx, cy, r, kind, lv) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) {
    tiles[y][x] = floor[y][x] = kind;
    level[y][x] = lv;
  }
};
// Far-off corners for the rarest Wildlings
const ISLET = { x: 30, y: 168 }, MESA = { x: 150, y: 58 }, GLADE = { x: 28, y: 96 };
flatten(ISLET.x, ISLET.y, 11, WATER, 0);
for (let n = 0; n < 16; n++) flatten(ISLET.x + n * 2, ISLET.y - n * 2, 3, tiles[ISLET.y - n * 2][ISLET.x + n * 2] >= WATER ? WATER : tiles[ISLET.y - n * 2][ISLET.x + n * 2], 0);      // (shallow water all the way to the islet)
flatten(ISLET.x, ISLET.y, 5, SAND, 0);
flatten(MESA.x, MESA.y, 6, MOOR, 2);
flatten(GLADE.x, GLADE.y, 5, MEADOW, 0);
// Trees, boulders and cactuses
for (let y = 2; y < CH - 2; y++) for (let x = 2; x < CW - 2; x++) {
  const kind = tiles[y][x], roll = hash(x, y, 3);
  const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => level[y + ay][x + ax] !== level[y][x] || tiles[y + ay][x + ax] === WATER);
  if (edge || Math.hypot(x - GLADE.x, y - GLADE.y) < 6 || Math.hypot(x - ISLET.x, y - ISLET.y) < 6 || Math.hypot(x - MESA.x, y - MESA.y) < 7) continue;
  if (kind === WOOD && roll < 0.17) tiles[y][x] = TREE;
  else if (kind === MEADOW && roll < 0.022) tiles[y][x] = TREE;
  else if (kind === MOOR && roll < 0.04) tiles[y][x] = roll < 0.03 ? BOULDER : TREE;
  else if (kind === SNOW && roll < 0.06) tiles[y][x] = roll < 0.04 ? TREE : BOULDER;
  else if (kind === SAND && x > 132 && roll < 0.035) tiles[y][x] = roll < 0.02 ? TREE : BOULDER;        // (a "tree" in the desert is a cactus)
}
// Dirt paths between the towns
function path(x0, y0, x1, y1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let n = 0; n <= steps; n++) {
    const x = Math.round(x0 + ((x1 - x0) * n) / steps), y = Math.round(y0 + ((y1 - y0) * n) / steps);
    for (const [ax, ay] of [[0, 0], [1, 0], [0, 1]]) if (tiles[y + ay][x + ax] < PATH || tiles[y + ay][x + ax] === TREE || tiles[y + ay][x + ax] === BOULDER) tiles[y + ay][x + ax] = floor[y + ay][x + ax] = floor[y + ay][x + ax] >= WATER ? floor[y + ay][x + ax] : PATH;
  }
}
// Towns: a paved clearing with a healing house, a shop and a Trial Hall
const towns = [], buildings = [];
function town(name, cx, cy, lv, hall) {
  flatten(cx, cy, 9, PLAZA, lv);
  const t = { name: name, x: cx * TILE, y: cy * TILE, hall: hall, lv: lv };
  const build = function (kind, x, y, w, h) {
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) tiles[ty][tx] = WALL;
    const b = { kind: kind, x: x, y: y, w: w, h: h, town: t, door: { x: (x + w / 2) * TILE, y: (y + h) * TILE + 9 } };
    buildings.push(b);
    return b;
  };
  t.heal = build("heal", cx - 7, cy - 6, 4, 3);
  t.shop = build("shop", cx + 3, cy - 6, 4, 3);
  if (hall) t.hallAt = build("hall", cx - 3, cy + 1, 6, 4);
  towns.push(t);
  return t;
}
// Each Trial Hall has a leader with a team: [family, level]
const SUNVALE = town("Sunvale", 100, 128, 0, { leader: "Leader Flora", badge: "Petal", kind: 0, team: [[3, 7], [16, 9]] });
const DUNMERE = town("Dunmere", 160, 118, 0, { leader: "Leader Brand", badge: "Cinder", kind: 1, team: [[8, 13], [12, 14], [8, 16]] });
const LAKE_ISLE = town("Lake Isle", LAKE.x, LAKE.y, 0, { leader: "Leader Marin", badge: "Ripple", kind: 2, team: [[9, 19], [17, 20], [9, 22]] });
const HIGHMOOR = town("Highmoor", 66, 62, 1, { leader: "Leader Tor", badge: "Crag", kind: 4, team: [[6, 26], [4, 27], [6, 29]] });
const FROSTHOLM = town("Frostholm", 100, 30, 2, { leader: "Leader Neve", badge: "Glacier", kind: 5, team: [[10, 33], [11, 34], [10, 36]] });
const ARENA = town("Summit Arena", 126, 27, 2, { leader: "Champion Vale", badge: "Champion", champion: true, kind: 7, team: [[4, 40], [7, 41], [12, 42], [15, 42], [11, 45]] });
path(100, 137, 108, 150);
path(109, 128, 151, 119);
path(91, 128, 62, 122);
path(100, 119, 100, 84);
path(100, 76, 74, 64);
path(70, 53, 96, 38);
path(109, 30, 117, 28);
// The three Elder Wildlings: giants that teach your ride something new when you beat them
const ELDERS = [
  { id: 54, lv: 16, x: 104, y: 150, name: "the Lake Elder", gives: "swim", says: "Zephyrun can SWIM now! Ride across the lake and along the coast." },
  { id: 51, lv: 26, x: 44, y: 112, name: "the Forest Elder", gives: "climb", says: "Zephyrun can CLIMB now! Ride up cliffs to the high moors and the snowy peak." },
  { id: 36, lv: 40, x: 72, y: 34, name: "the Snow Elder", gives: "dash", says: "Zephyrun can DASH now! It runs like the wind." },
].map((elder) => Object.assign(elder, { x: elder.x * TILE, y: elder.y * TILE }));
for (const elder of ELDERS) flatten(Math.round(elder.x / TILE), Math.round(elder.y / TILE), 4, level[Math.round(elder.y / TILE)][Math.round(elder.x / TILE)] === 2 ? SNOW : floor[Math.round(elder.y / TILE)][Math.round(elder.x / TILE)] === WOOD ? WOOD : MEADOW, level[Math.round(elder.y / TILE)][Math.round(elder.x / TILE)]);
// Legendary and mythical Wildlings wait in the far corners
const LEGENDS = [
  { id: 55, lv: 45, x: ISLET.x * TILE, y: ISLET.y * TILE, where: "an islet off the south-west coast" },
  { id: 56, lv: 50, x: MESA.x * TILE, y: MESA.y * TILE, where: "the Sun Mesa in the north-east" },
  { id: 57, lv: 35, x: GLADE.x * TILE, y: GLADE.y * TILE, where: "a hidden glade in the western forest", myth: true },
];
// Trainers who wait along the paths: [x, y, name, team as [family, level]]
const TRAINER_SPOTS = [
  [104, 112, "Rambler Kit", [[5, 4]]], [124, 124, "Kite Flyer Bo", [[4, 6], [3, 6]]], [78, 125, "Forager Wyn", [[16, 9], [7, 9]]], [140, 121, "Digger Sal", [[12, 11], [6, 12]]],
  [112, 147, "Angler Jo", [[9, 14], [17, 15]]], [52, 118, "Ranger Ash", [[14, 19], [16, 20]]], [100, 92, "Climber Rue", [[6, 22], [5, 23]]], [84, 68, "Shepherd Dag", [[13, 25], [4, 26]]],
  [84, 44, "Skier Lumi", [[10, 31], [11, 32]]], [114, 29, "Ace Corin", [[13, 37], [15, 38], [8, 38]]],
];
const tileAt = (px, py) => {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= CW || ty >= CH ? DEEP : tiles[ty][tx];
};
const levelAt = (px, py) => {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= CW || ty >= CH ? 0 : level[ty][tx];
};
const heightAt = (px, py) => (tileAt(px, py) === WATER || tileAt(px, py) === DEEP ? -3 : levelAt(px, py) * STEP_UP);
// What kind of country is this? (Used for names and for which Wildlings live there.)
function landAt(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE), kind = floor[Math.max(0, Math.min(CH - 1, ty))][Math.max(0, Math.min(CW - 1, tx))];
  if (kind === WOOD) return { name: "the Whispering Woods", families: [16, 7, 14, 3], lv: [8, 16] };
  if (kind === SNOW) return { name: "Frost Peak", families: [10, 11, 13], lv: [30, 40] };
  if (kind === MOOR) return { name: "the High Moors", families: [6, 5, 13, 4], lv: [20, 30] };
  if (kind === SAND && tx > 132) return { name: "the Ember Dunes", families: [8, 12, 6, 1], lv: [10, 18] };
  if (kind === SAND || kind === WATER) return { name: "the shore", families: [9, 17, 2], lv: [12, 20] };
  return { name: "the Sunny Meadows", families: [3, 4, 5, 0], lv: [2, 8] };
}
const START = { x: 100 * TILE + 8, y: 136 * TILE };
