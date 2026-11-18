// Wildlings: Thunder Ride. The map: five different places joined by one long winding road.
// The land is a grid of squares. Mountain ridges wall off each place, with a gap where the road goes through.

const TILE = 32, MW = 160, MH = 110;
const PLACES = [
  { name: "Greenway Meadows", ground: "#86d264", speck: ["#74c452", "#9ade78"], families: [0, 1, 2], lv: [2, 5] },
  { name: "Coral Coast", ground: "#f0dc9c", speck: ["#e4cc84", "#f8e8b4"], families: [3, 4, 1], lv: [6, 10] },
  { name: "Rustrock Canyon", ground: "#dc9a5c", speck: ["#c8864a", "#e8ac70"], families: [5, 6, 7], lv: [11, 16] },
  { name: "Frostline Pass", ground: "#e9f1fa", speck: ["#d4e2f2", "#f8fcff"], families: [8, 9, 6], lv: [17, 23] },
  { name: "Neon Bay City", ground: "#5d6276", speck: ["#52576a", "#686d82"], families: [10, 11, 2], lv: [24, 30] },
];
const OPEN = 0, WATER = 1, RIDGE = 2, TREE = 3, ROCK = 4, BUILDING = 5;
// A repeatable "random" number for a square
function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function lumps(x, y, size, seed) {          // smooth lumpy numbers, for wobbly borders
  const gx = Math.floor(x / size), gy = Math.floor(y / size), fx = x / size - gx, fy = y / size - gy;
  const ease = (t) => t * t * (3 - 2 * t);
  const top = hash(gx, gy, seed) + (hash(gx + 1, gy, seed) - hash(gx, gy, seed)) * ease(fx);
  const bottom = hash(gx, gy + 1, seed) + (hash(gx + 1, gy + 1, seed) - hash(gx, gy + 1, seed)) * ease(fx);
  return top + (bottom - top) * ease(fy);
}
// Which place is this square in? 0 meadows, 1 coast, 2 canyon, 3 frost, 4 city
function placeOf(tx, ty) {
  const w = (lumps(tx, ty, 9, 1) - 0.5) * 6, w2 = (lumps(tx, ty, 9, 2) - 0.5) * 6;
  if (tx < 46 + w && ty < 52 + w2) return 4;
  if (ty < 32 + w) return 3;
  if (tx > 98 + w && ty < 80 + w2) return 2;
  if (ty > 80 + w2 && tx > 62 + w) return 1;
  return 0;
}
// The roads, as lists of corners (in squares). The second is a shortcut home that opens at the end of the story.
const ROADS = [
  [[20, 90], [34, 86], [46, 82], [58, 88], [72, 93], [88, 96], [102, 94], [118, 93], [134, 90], [142, 78], [140, 66], [130, 56], [124, 48], [128, 38], [132, 28], [122, 18], [104, 14], [88, 13], [75, 14], [60, 14], [46, 18], [36, 24], [24, 26]],
  [[24, 26], [20, 40], [18, 58], [18, 76], [20, 90]],
];
function roadGap(px, py) {          // how far it is to the nearest road, in pixels
  let best = 1e9;
  for (const road of ROADS) for (let n = 0; n < road.length - 1; n++) {
    const ax = road[n][0] * TILE, ay = road[n][1] * TILE, bx = road[n + 1][0] * TILE, by = road[n + 1][1] * TILE;
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    best = Math.min(best, Math.hypot(px - ax - (bx - ax) * t, py - ay - (by - ay) * t));
  }
  return best;
}
const land = Array.from({ length: MH }, () => new Uint8Array(MW));         // what is on each square
const place = Array.from({ length: MH }, () => new Uint8Array(MW));        // which place it belongs to
const gap = Array.from({ length: MH }, () => new Float32Array(MW));        // how far it is from the road, in squares
for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
  place[ty][tx] = placeOf(tx, ty);
  gap[ty][tx] = roadGap(tx * TILE + 16, ty * TILE + 16) / TILE;
}
// The spots that matter: pit stops, the gang, and where the story happens (all in squares)
const TOWN = { x: 20, y: 90 };
const PITS = [[24, 86, "Gran's Garage"], [84, 91, "Coast Pit Stop"], [134, 66, "Canyon Pit Stop"], [96, 19, "Frost Pit Stop"], [30, 31, "City Pit Stop"]].map(([x, y, name]) => ({ tx: x, ty: y, name: name, x: (x + 1) * TILE, y: (y + 2) * TILE + 20 }));
// The Rust Riders: a captain in each place, a few grunts, and the boss. Teams are [family, level].
const GANG = [
  { id: "skid", name: "Captain Skid", look: "skid", at: [50, 79], captain: 0, camp: "Windmill Camp", team: [[1, 5], [2, 6], [0, 7]] },
  { id: "slick", name: "Captain Slick", look: "slick", at: [106, 90], captain: 1, camp: "Driftwood Camp", team: [[3, 10], [4, 11], [3, 12]] },
  { id: "burnout", name: "Captain Burnout", look: "burnout", at: [120, 46], captain: 2, camp: "Scrapyard Camp", team: [[5, 16], [7, 17], [5, 18]] },
  { id: "blackice", name: "Captain Black Ice", look: "blackice", at: [88, 9], captain: 3, camp: "Icebreaker Camp", team: [[9, 23], [8, 24], [9, 25]] },
  { id: "vex", name: "Vex Throttle", look: "vex", at: [22, 21], captain: 4, camp: "Storm Engine HQ", team: [[10, 30], [11, 31], [5, 31]], boss: true },
  { id: "g1", name: "Rust Rider Pip", look: "grunt", at: [34, 82], team: [[0, 3]] }, { id: "g2", name: "Rust Rider Dez", look: "grunt", at: [56, 84], team: [[2, 5], [1, 5]] },
  { id: "g3", name: "Rust Rider Mo", look: "grunt", at: [88, 92], team: [[3, 8], [4, 8]] }, { id: "g4", name: "Rust Rider Kai", look: "grunt", at: [126, 88], team: [[4, 10], [1, 10]] },
  { id: "g5", name: "Rust Rider Zed", look: "grunt", at: [143, 70], team: [[6, 13], [7, 14]] }, { id: "g6", name: "Rust Rider Ivy", look: "grunt", at: [126, 54], team: [[5, 15], [6, 15]] },
  { id: "g7", name: "Rust Rider Bex", look: "grunt", at: [118, 22], team: [[8, 20], [9, 20]] }, { id: "g8", name: "Rust Rider Ned", look: "grunt", at: [70, 18], team: [[6, 22], [8, 22]] },
  { id: "g9", name: "Rust Rider Roz", look: "grunt", at: [40, 26], team: [[10, 27], [11, 27]] }, { id: "g10", name: "Rust Rider Gus", look: "grunt", at: [28, 31], team: [[2, 28], [10, 29]] },
].map((who) => Object.assign(who, { x: who.at[0] * TILE + 16, y: who.at[1] * TILE + 16 }));
const GRAN = { x: 21 * TILE, y: 89 * TILE + 8 };
const PEAK = { x: 104 * TILE, y: 6 * TILE };          // Storm Peak, where the legendary Wildling goes
const clear = [].concat(PITS.map((p) => [p.tx + 1, p.ty + 1, 4]), GANG.map((who) => [who.at[0], who.at[1], 4]), [[TOWN.x, TOWN.y, 6], [104, 6, 4]]);
const buildings = [];
for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
  const here = place[ty][tx], far = gap[ty][tx], roll = hash(tx, ty, 3);
  const edge = tx < 2 || ty < 2 || tx > MW - 3 || ty > MH - 3;
  const border = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => placeOf(tx + ax, ty + ay) !== here);
  const kept = clear.some(([cx, cy, r]) => Math.hypot(tx - cx, ty - cy) < r);
  let kind = OPEN;
  if ((edge || border) && far > 2.7) kind = RIDGE;                                       // mountains wall each place off
  else if (here === 1 && ty > 101 + lumps(tx, ty, 7, 4) * 4 && far > 2.5) kind = WATER;   // the sea
  else if (here === 0 && ((tx - 62) / 8) ** 2 + ((ty - 62) / 5) ** 2 < 1) kind = WATER;   // a lake in the meadows
  else if (far < 2.3 || kept) kind = OPEN;
  else if (here === 4) kind = tx % 7 < 4 && ty % 7 < 4 && far > 3.3 ? BUILDING : roll < 0.012 ? TREE : OPEN;
  else kind = roll < [0.05, 0.03, 0.03, 0.065, 0][here] ? TREE : roll < [0.058, 0.045, 0.085, 0.08, 0][here] ? ROCK : OPEN;
  land[ty][tx] = kind;
}
for (const pit of PITS) {
  for (let ty = pit.ty; ty < pit.ty + 2; ty++) for (let tx = pit.tx; tx < pit.tx + 2; tx++) land[ty][tx] = BUILDING;
  buildings.push({ tx: pit.tx, ty: pit.ty, w: 2, h: 2, pit: pit });
}
for (let ty = 0; ty < MH; ty += 7) for (let tx = 0; tx < MW; tx += 7) if (land[ty][tx] === BUILDING && place[ty][tx] === 4 && !buildings.some((b) => b.tx === tx && b.ty === ty)) {
  let w = 0, h = 0;
  while (w < 4 && land[ty][tx + w] === BUILDING) w++;
  while (h < 4 && land[ty + h] && land[ty + h][tx] === BUILDING) h++;
  buildings.push({ tx: tx, ty: ty, w: w, h: h, neon: Math.floor(hash(tx, ty, 9) * 4) });
}
for (const [tx, ty] of [[15, 87], [16, 93], [25, 93], [12, 90]]) {          // houses in Sparkplug Town
  for (let y = ty; y < ty + 2; y++) for (let x = tx; x < tx + 2; x++) land[y][x] = BUILDING;
  buildings.push({ tx: tx, ty: ty, w: 2, h: 2, house: Math.floor(hash(tx, ty, 8) * 3) });
}
// Roadblocks: wherever a road crosses from one place into another, the Rust Riders have put up a barrier.
// It opens when you have beaten enough captains ("need").
const gates = [];
ROADS.forEach(function (road, which) {
  for (let n = 0; n < road.length - 1; n++) for (let step = 0; step < 40; step++) {
    const at = (t) => [road[n][0] + (road[n + 1][0] - road[n][0]) * t, road[n][1] + (road[n + 1][1] - road[n][1]) * t];
    const [ax, ay] = at(step / 40), [bx, by] = at((step + 1) / 40);
    const from = placeOf(Math.floor(ax), Math.floor(ay)), to = placeOf(Math.floor(bx), Math.floor(by));
    if (from !== to && !gates.some((g) => Math.hypot(g.x - bx * TILE, g.y - by * TILE) < 260)) gates.push({ x: bx * TILE, y: by * TILE, need: which ? 5 : Math.max(from, to), turn: Math.atan2(by - ay, bx - ax) });
  }
});
// Crates of capture orbs, left along the roadside
const crates = [];
(function () {
  let walked = 0, n = 0;
  const road = ROADS[0];
  for (let i = 0; i < road.length - 1; i++) {
    const long = Math.hypot(road[i + 1][0] - road[i][0], road[i + 1][1] - road[i][1]);
    for (let d = 0; d < long; d += 0.5) {
      walked += 0.5;
      if (walked < 12) continue;
      walked = 0;
      const t = d / long, ux = (road[i + 1][0] - road[i][0]) / long, uy = (road[i + 1][1] - road[i][1]) / long, side = n++ % 2 ? 2.2 : -2.2;
      const x = road[i][0] + (road[i + 1][0] - road[i][0]) * t - uy * side, y = road[i][1] + (road[i + 1][1] - road[i][1]) * t + ux * side;
      if (land[Math.floor(y)][Math.floor(x)] === OPEN) crates.push({ id: "c" + n, x: x * TILE, y: y * TILE });
    }
  }
})();
const landAt = (px, py) => {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= MW || ty >= MH ? RIDGE : land[ty][tx];
};
const placeAt = (px, py) => place[Math.max(0, Math.min(MH - 1, Math.floor(py / TILE)))][Math.max(0, Math.min(MW - 1, Math.floor(px / TILE)))];
const gapAt = (px, py) => gap[Math.max(0, Math.min(MH - 1, Math.floor(py / TILE)))][Math.max(0, Math.min(MW - 1, Math.floor(px / TILE)))];
const START = { x: 20 * TILE, y: 91 * TILE };
