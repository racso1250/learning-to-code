// Wildlings: Wind Isles. The map: eight islands in a wide, windy sea.
// The world is a grid of squares. Each square is sand, grass, sea and so on. The islands are worked out
// with a little maths (a wobbly circle each), so they are the same every time you play.

const MAP = 320;             // the sea is 320 squares wide and 320 squares tall
const SAND = 0, GRASS = 1, TALL = 2, PATH = 3, SHALLOW = 4, SEA = 5, ROCK = 6, TREE = 7, HUT = 8, OUT = 9;
// (You can walk on the first five. Anything from SEA upwards blocks your way on foot. Your boat sails on SEA and SHALLOW.)
const tiles = Array.from({ length: MAP }, () => new Uint8Array(MAP).fill(SEA));

// The islands. "at" is the middle (in squares), "r" is how big it is, "kinds" are the types of wild Wildling
// that live there (0 Fire, 1 Water, 2 Grass, 3 Electric, 4 Ice, 5 Rock, 6 Flying, 7 Fighting, 8 Psychic, 9 Dark, 10 Dragon, 11 Fairy)
// and "lv" is how strong they are. "middle" is what stands on the island: a lagoon, a volcano, ice, pillars or storm stones.
const ISLES = [
  { name: "Kite Cove", at: { x: 70, y: 250 }, r: 26, kinds: [2, 6], lv: [2, 4], middle: "", sand: "#f2e2a8", grass: "#6cc45a" },
  { name: "Palm Atoll", at: { x: 152, y: 266 }, r: 24, kinds: [2, 6, 7], lv: [5, 9], middle: "", sand: "#f6e8b4", grass: "#58b84e" },
  { name: "Coral Key", at: { x: 236, y: 242 }, r: 25, kinds: [1, 11, 5], lv: [10, 15], middle: "lagoon", sand: "#f8dcc4", grass: "#62c070" },
  { name: "Ember Isle", at: { x: 264, y: 160 }, r: 27, kinds: [0, 5, 9], lv: [16, 22], middle: "volcano", sand: "#8a8088", grass: "#7a9a4a" },
  { name: "Thunder Reef", at: { x: 234, y: 76 }, r: 24, kinds: [3, 9, 7], lv: [23, 29], middle: "rocks", sand: "#e0d49a", grass: "#8ab04a" },
  { name: "Frost Spire", at: { x: 150, y: 50 }, r: 25, kinds: [4, 8, 11], lv: [30, 36], middle: "ice", sand: "#e4eef4", grass: "#c8e4ec" },
  { name: "Skyhaven", at: { x: 66, y: 92 }, r: 26, kinds: [10, 8, 6], lv: [37, 43], middle: "pillars", sand: "#eadcc0", grass: "#5cc09a" },
  { name: "Storm's Eye", at: { x: 150, y: 158 }, r: 23, kinds: [10, 3, 9], lv: [44, 50], middle: "storm", sand: "#9a94a8", grass: "#5a8a6a" },
];
const STORM_WALL = 46;       // you can't sail closer than this to Storm's Eye until you have all six Wind Chimes
// How far out the shore is, looking from the middle of an island in a direction (an angle). The sines make it wobbly.
function edgeOf(isle, angle) {
  const s = isle.at.x * 0.37 + isle.at.y * 0.11;
  return isle.r * (1 + 0.13 * Math.sin(3 * angle + s) + 0.08 * Math.sin(5 * angle + s * 2.3) + 0.045 * Math.sin(8 * angle + s * 3.1));
}
const BEACH = 3.4, WADE = 2.6;         // how wide the beach is, and the shallow water round it (in squares)
const HUTS = [], JETTIES = [], trees = [], rocks = [];
const HOME_COST = 6, HOME_SAFE = 95;       // how much wood a home of your own costs, and how close to it you must be at night to be safe
ISLES.forEach(function (isle, n) {
  const cx = isle.at.x, cy = isle.at.y;
  isle.n = n;
  isle.village = { x: cx, y: Math.round(cy + isle.r * 0.4) };       // the village is in the south of the island...
  isle.shrine = { x: cx, y: Math.round(cy - isle.r * 0.42) };       // ...and the Wind Shrine is in the north
  isle.feature = isle.middle ? { x: Math.round(cx + (isle.middle === "lagoon" ? -1 : 1) * isle.r * 0.44), y: cy - 1, r: isle.middle === "lagoon" ? 6 : isle.middle === "volcano" ? 6.5 : 4.5 } : null;
  // Patches of tall grass, where most wild Wildlings hide
  isle.patches = [];
  for (let k = 0; k < 90 && isle.patches.length < 5; k++) {
    const angle = hash(n, k, 21) * 6.283, size = 3 + hash(n, k, 23) * 1.8;
    const room = edgeOf(isle, angle) - BEACH - size - 0.6;          // (so the patch stays on the grass, clear of the beach)
    const far = isle.r * 0.2 + hash(n, k, 22) * (room - isle.r * 0.2);
    if (room < isle.r * 0.25) continue;
    const patch = { x: cx + Math.cos(angle) * far, y: cy + Math.sin(angle) * far, r: size };
    const clear = (spot, gap) => Math.hypot(patch.x - spot.x, patch.y - spot.y) > patch.r + gap;
    if (clear(isle.village, 7) && clear(isle.shrine, 4.6) && Math.abs(patch.x - cx) > patch.r + 1.2 && (!isle.feature || clear(isle.feature, isle.feature.r + 1)) && isle.patches.every((other) => clear(other, other.r - 1.5))) isle.patches.push(patch);
  }
  // Lay the island down, square by square
  const reach = Math.ceil(isle.r * 1.3 + WADE + 2);
  for (let y = cy - reach; y <= cy + reach; y++) for (let x = cx - reach; x <= cx + reach; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), edge = edgeOf(isle, Math.atan2(y + 0.5 - cy, x + 0.5 - cx));
    if (d >= edge + WADE) continue;
    let kind = d >= edge ? SHALLOW : d >= edge - BEACH ? SAND : GRASS;
    if (kind === GRASS && isle.patches.some((patch) => Math.hypot(x + 0.5 - patch.x, y + 0.5 - patch.y) < patch.r)) kind = TALL;
    tiles[y][x] = kind;
  }
  if (isle.feature) {
    const f = isle.feature;
    for (let y = Math.floor(f.y - f.r); y <= f.y + f.r; y++) for (let x = Math.floor(f.x - f.r); x <= f.x + f.r; x++) {
      if (Math.hypot(x + 0.5 - f.x, y + 0.5 - f.y) < f.r && tiles[y][x] !== SEA && tiles[y][x] !== SHALLOW) tiles[y][x] = isle.middle === "lagoon" ? SHALLOW : ROCK;
    }
  }
  // A path runs from the jetty on the south shore, through the village, to the shrine
  const shore = Math.floor(cy + edgeOf(isle, Math.PI / 2));
  for (let y = isle.shrine.y - 3; y <= shore; y++) for (const x of [cx - 1, cx]) if (tiles[y][x] === GRASS || tiles[y][x] === TALL) tiles[y][x] = PATH;
  for (let y = isle.shrine.y - 4; y <= isle.shrine.y + 4; y++) for (let x = cx - 5; x <= cx + 4; x++) {
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - isle.shrine.y) < 4.2 && tiles[y][x] <= TALL) tiles[y][x] = PATH;       // a round clearing for the shrine
  }
  for (let y = isle.village.y - 1; y <= isle.village.y + 3; y++) for (let x = cx - 9; x <= cx + 8; x++) if (tiles[y][x] === GRASS || tiles[y][x] === TALL) tiles[y][x] = PATH;      // the village square
  // Two huts: one to rest in (it heals your team), and a shop
  [-6, 5].forEach(function (off, k) {
    const hx = cx + off, hy = isle.village.y - 3;
    for (let y = hy; y < hy + 3; y++) for (let x = hx - 1; x <= hx + 1; x++) tiles[y][x] = HUT;
    HUTS.push({ x: (hx + 0.5) * TILE, y: (hy + 3) * TILE + 9, shop: k === 1, isle: isle, tx: hx, ty: hy });
  });
  JETTIES.push({ x: (cx - 0.5) * TILE + 8, y: (cy + edgeOf(isle, Math.PI / 2) + 0.4) * TILE, isle: isle });
  isle.jetty = JETTIES[n];
  // Palm trees and a few boulders
  for (let y = cy - reach; y <= cy + reach; y++) for (let x = cx - reach; x <= cx + reach; x++) {
    const kind = tiles[y][x];
    if (kind !== GRASS && kind !== SAND) continue;
    if (Math.abs(x - cx) < 3 || Math.hypot(x - isle.village.x, y - isle.village.y) < 11 || Math.hypot(x - cx, y - isle.shrine.y) < 6) continue;
    const roll = hash(x, y, 31 + n);
    if (roll < (kind === GRASS ? 0.05 : 0.018)) {
      tiles[y][x] = TREE;
      trees.push({ x: x * TILE + 8, y: y * TILE + 8, isle: isle });
    } else if (roll > 0.992 && kind === GRASS) {
      tiles[y][x] = ROCK;
      rocks.push({ x: x * TILE + 8, y: y * TILE + 8, isle: isle });
    }
  }
});
for (let n = 0; n < MAP; n++) tiles[0][n] = tiles[MAP - 1][n] = tiles[n][0] = tiles[n][MAP - 1] = OUT;      // the edge of the world

const tileAt = (px, py) => {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= MAP || ty >= MAP ? OUT : tiles[ty][tx];
};
const solid = (px, py) => tileAt(px, py) >= SEA;
const canStand = (x, y) => !solid(x - 4, y - 5) && !solid(x + 4, y - 5) && !solid(x - 4, y + 1) && !solid(x + 4, y + 1);
// Your boat floats on the sea and in the shallows
const afloat = (px, py) => tileAt(px, py) === SEA || tileAt(px, py) === SHALLOW;
const canSail = (x, y) => afloat(x - 7, y - 7) && afloat(x + 7, y - 7) && afloat(x - 7, y + 7) && afloat(x + 7, y + 7);
// Which island is this place on (or right next to)?
function isleAt(px, py) {
  for (const isle of ISLES) if (Math.hypot(px / TILE - isle.at.x, py / TILE - isle.at.y) < isle.r * 1.3 + WADE + 1) return isle;
  return null;
}
const nearestIsle = (px, py) => ISLES.slice().sort((a, b) => Math.hypot(px / TILE - a.at.x, py / TILE - a.at.y) - Math.hypot(px / TILE - b.at.x, py / TILE - b.at.y))[0];
const spotOf = (place) => ({ x: place.x * TILE + 8, y: place.y * TILE + 8 });       // a place in squares, as a point on the map
const START = { x: ISLES[0].at.x * TILE, y: (ISLES[0].village.y + 2) * TILE + 8 };  // in the village square at Kite Cove

// ----- The map picture -----
// A little picture of the whole sea, painted once. Two map pixels are one square.
const seaMap = makeCanvas(MAP * 2, MAP * 2);
(function () {
  const g = seaMap.getContext("2d");
  g.fillStyle = "#2f7ac8";
  g.fillRect(0, 0, MAP * 2, MAP * 2);
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
    const kind = tiles[y][x];
    if (kind === SEA || kind === OUT) continue;
    const isle = nearestIsle(x * TILE, y * TILE);
    g.fillStyle = kind === SHALLOW ? "#6cc8e8" : kind === SAND ? isle.sand : kind === TALL ? blend(isle.grass, "#000000", 0.22) : kind === PATH ? "#c8a060" : kind === ROCK ? "#7a7684" : kind === TREE ? blend(isle.grass, "#0a5a20", 0.5) : kind === HUT ? "#a8703a" : isle.grass;
    g.fillRect(x * 2, y * 2, 2, 2);
  }
  for (const hut of HUTS) {
    const x = Math.round(hut.x / 8), y = Math.round(hut.y / 8) - 5;
    g.fillStyle = "#ffffff";
    g.fillRect(x - 4, y - 4, 9, 9);
    g.fillStyle = hut.shop ? "#3a6ad8" : "#2f9a4c";          // green cross: a rest hut. Blue square: a shop.
    g.fillRect(x - 1, y - 3, 3, 7);
    g.fillRect(x - 3, y - 1, 7, 3);
    if (hut.shop) g.fillRect(x - 3, y - 3, 7, 7);
  }
  for (const isle of ISLES) if (isle.n > 0) {                // a gold star: a Wind Shrine
    g.fillStyle = "#1d1730";
    g.fillRect(isle.shrine.x * 2 - 4, isle.shrine.y * 2 - 4, 9, 9);
    g.fillStyle = "#ffd84a";
    g.fillRect(isle.shrine.x * 2 - 3, isle.shrine.y * 2 - 3, 7, 7);
  }
})();
