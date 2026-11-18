// The 151 Wildlings: their names, kinds, pictures and battle numbers (the same creatures as in the Wildlings game).

// ----- The 151 Wildlings -----
// Eight kinds. Each kind is strong against two others.
const KINDS = ["Leaf", "Fire", "Water", "Spark", "Stone", "Frost", "Shade", "Wind"];
const KIND_COLOUR = ["#58b848", "#f0622a", "#3a8ae8", "#f2c81e", "#a08a6a", "#7ad8f0", "#8a5ad0", "#a8c8d8"];
const KIND_PAINT = [[110, 60, 52], [14, 82, 55], [212, 72, 56], [50, 88, 56], [32, 26, 52], [188, 62, 72], [272, 46, 46], [200, 28, 80]];      // hue, colourfulness, lightness
const KIND_EXTRA = ["#ffe36a", "#ffd23a", "#bfeaff", "#ffffff", "#5a4a3a", "#ffffff", "#ff6ad0", "#ffffff"];
const STRONG = [[2, 4], [0, 5], [1, 4], [2, 7], [1, 3], [0, 7], [3, 5], [0, 6]];
const MOVES = [["Leaf Slap", "Thorn Storm"], ["Hot Breath", "Fire Wheel"], ["Splash Shot", "Tidal Crash"], ["Zap", "Thunder Clap"], ["Rock Toss", "Landslide"], ["Ice Chip", "Snow Crash"], ["Spooky Poke", "Night Wave"], ["Gust Flick", "Twister"]];
// Fifty families of three (a baby, a middle one and a big one), and one mystery creature: 151 in all.
const FAMILIES = [
  [0, "Sproutle", "Thornlet", "Bramblor"], [1, "Emberkit", "Flarefox", "Infernox"], [2, "Dripple", "Splashet", "Tidalor"],
  [0, "Mossip", "Fernock", "Grovemaw"], [0, "Petalu", "Bloomra", "Floravex"], [0, "Acornip", "Oakling", "Timberox"], [0, "Shroomi", "Sporecap", "Mycelord"], [0, "Vinny", "Creepvine", "Junglash"],
  [1, "Cindle", "Scorchet", "Pyrowl"], [1, "Magmite", "Lavalump", "Volcrag"], [1, "Kindlepup", "Charhound", "Hellmane"], [1, "Smolder", "Ashwing", "Phoenara"], [1, "Coalby", "Furnip", "Forgemaw"], [1, "Wyrmlet", "Drakeling", "Dragonyx"],
  [2, "Bubblet", "Foamfin", "Surgeray"], [2, "Puddlo", "Marshog", "Bogzilla"], [2, "Shellby", "Coralit", "Reefguard"], [2, "Tadpip", "Frogleap", "Croakking"], [2, "Minnowt", "Pikefang", "Leviatide"], [2, "Sealy", "Otterush", "Kelpiecorn"],
  [3, "Zappip", "Voltail", "Thundermane"], [3, "Buzzle", "Ampwing", "Stormoth"], [3, "Wattle", "Dynamoo", "Teslord"], [3, "Flickit", "Glowbug", "Lumibeam"], [3, "Statty", "Shockoon", "Boltusk"], [3, "Plugg", "Socketeer", "Gridlock"],
  [4, "Pebblet", "Rockrun", "Bouldrake"], [4, "Gravlin", "Cragmaw", "Monolith"], [4, "Dusty", "Sandigger", "Dunetitan"], [4, "Orelet", "Ironhide", "Steelossus"], [4, "Fossi", "Bonecrest", "Ancientus"], [4, "Crystip", "Geodeon", "Prismarock"],
  [5, "Flakey", "Snowlet", "Blizzarus"], [5, "Chillpup", "Frostfang", "Glaciwolf"], [5, "Icicub", "Polarok", "Tundrabear"], [5, "Slushi", "Sleetle", "Hailstorm"], [5, "Pengwee", "Skatefin", "Emperice"], [5, "Frosti", "Rimewing", "Aurorowl"],
  [6, "Gloomp", "Duskit", "Nightmaw"], [6, "Wispy", "Phantlet", "Spectrix"], [6, "Shady", "Umbrat", "Eclipsor"], [6, "Batlet", "Nocturn", "Vampyre"], [6, "Spookle", "Hauntern", "Dreadlamp"], [6, "Inkit", "Murkoil", "Abyssquid"],
  [7, "Breezi", "Gustling", "Cyclonis"], [7, "Flit", "Swooper", "Skytalon"], [7, "Puffet", "Cloudle", "Nimbustorm"], [7, "Kitey", "Glidera", "Zephyrex"], [7, "Featherp", "Plumage", "Galehawk"], [7, "Whirly", "Twistle", "Tornadon"],
];
const DEX = [null];       // DEX[1] to DEX[151]
FAMILIES.forEach(function (family, f) {
  for (let stage = 0; stage < 3; stage++) DEX.push({ name: family[stage + 1], kind: family[0], family: f, stage: stage });
});
DEX.push({ name: "Auroth", kind: 7, family: 50, stage: 2, mystery: true });
const TOTAL = DEX.length - 1;
const GROW_AT = [12, 28];       // the levels where a Wildling changes into its next form
const familiesOf = KINDS.map((kind, k) => FAMILIES.map((family, f) => (family[0] === k ? f : -1)).filter((f) => f >= 0));

// A repeatable random-number maker, so each creature always looks the same
function dice(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Draw a creature: a round body made of chunky pixels, the same on both sides, with ears, feet and eyes
const pictures = [];
function picture(id) {
  if (pictures[id]) return pictures[id];
  const info = DEX[id];
  const roll = dice(info.family * 97 + 13);
  const [hue, rich, light] = KIND_PAINT[info.kind];
  const tint = hue + (roll() - 0.5) * 44;
  const paint = (l) => "hsl(" + tint + "," + rich + "%," + l + "%)";
  const wobble = Array.from({ length: 16 }, () => roll());
  const ears = roll() < 0.75, earAt = roll(), wings = roll() < 0.6, spots = roll() < 0.5, crest = roll() < 0.4;
  const hw = 3.6 + info.stage * 1.5 + roll() * 0.8, hh = 4 + info.stage * 1.4 + roll() * 0.8, cy = 14.5 - hh;
  const cells = Array.from({ length: 16 }, () => new Array(16).fill(""));
  const set = (x, y, colour) => {      // paint a cell on both sides
    if (y < 0 || y > 15 || x < 0 || x > 7) return;
    cells[y][8 + x] = cells[y][7 - x] = colour;
  };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
    const dx = (x + 0.5) / hw, dy = (y + 0.5 - cy) / hh;
    if (dx * dx + dy * dy > 0.7 + wobble[y] * 0.3) continue;
    const belly = dx < 0.5 && dy > 0 && dy < 0.75;
    set(x, y, belly ? paint(light + 24) : dy > 0.45 ? paint(light - 12) : spots && wobble[(x * 5 + y * 3) % 16] < 0.18 ? KIND_EXTRA[info.kind] : paint(light));
  }
  const top = Math.max(0, Math.round(cy - hh * 0.8));
  const earX = Math.min(6, Math.max(1, Math.round(hw * (0.35 + earAt * 0.4))));
  if (ears) for (let n = 1; n <= 1 + info.stage; n++) set(earX, top - n + 1, n > info.stage ? KIND_EXTRA[info.kind] : paint(light - 6));
  if (crest || info.mystery) for (let n = 0; n <= info.stage; n++) set(0, top - n, KIND_EXTRA[info.kind]);
  if (wings && info.stage > 0) for (let n = 0; n < info.stage + 1; n++) {
    set(Math.min(7, Math.round(hw) + n), Math.round(cy) - n, KIND_EXTRA[info.kind]);
    set(Math.min(7, Math.round(hw) + n), Math.round(cy) - n + 1, paint(light - 6));
  }
  set(1, 15, paint(light - 18));       // feet
  set(Math.min(6, Math.round(hw * 0.6)), 15, paint(light - 18));
  const eyeY = Math.round(cy - hh * 0.2), eyeX = Math.max(1, Math.round(hw * 0.38));
  const img = makeCanvas(32, 32);
  const g = img.getContext("2d");
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (cells[y][x]) {
      g.fillStyle = cells[y][x];
      g.fillRect(x * 2, y * 2, 2, 2);
    } else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => cells[y + ay] && cells[y + ay][x + ax])) {
      g.fillStyle = paint(14);        // a dark outline round the edge
      g.fillRect(x * 2, y * 2, 2, 2);
    }
  }
  for (const side of [-1, 1]) {
    const ex = side > 0 ? (8 + eyeX) * 2 : (7 - eyeX) * 2;
    g.fillStyle = "#ffffff";
    g.fillRect(ex, eyeY * 2, 2, 2 + info.stage);
    g.fillStyle = "#1d1730";
    g.fillRect(side > 0 ? ex : ex + 1, eyeY * 2 + 1, 1, 1 + info.stage);
  }
  return (pictures[id] = img);
}

// ----- Numbers for battles -----
const maxHp = (c) => Math.round((20 + c.lv * (3 + DEX[c.id].stage * 0.8 + (DEX[c.id].family % 3) * 0.3)) * (c.big || 1));      // ("big" is for giant raid Wildlings)
const power = (c) => 6 + c.lv * (1.2 + DEX[c.id].stage * 0.25 + (DEX[c.id].family % 4) * 0.06);
const guard = (c) => 6 + c.lv * (1.2 + DEX[c.id].stage * 0.25 + ((DEX[c.id].family + 2) % 4) * 0.06);
const quick = (c) => c.lv * (1 + (DEX[c.id].family % 5) * 0.1) + (2 - DEX[c.id].stage);
const xpToGrow = (c) => 12 + c.lv * 9;
const idFor = (family, lv) => (family === 50 ? 151 : family * 3 + 1 + (lv >= GROW_AT[1] ? 2 : lv >= GROW_AT[0] ? 1 : 0));
const newCreature = (id, lv) => {
  const c = { id: id, lv: lv, xp: 0 };
  c.hp = maxHp(c);
  return c;
};
function movesOf(c) {
  const kind = DEX[c.id].kind;
  const list = [{ name: "Bonk", kind: -1, power: 5, sure: 1 }, { name: MOVES[kind][0], kind: kind, power: 8, sure: 0.95 }];
  if (c.lv >= 10) list.push({ name: MOVES[kind][1], kind: kind, power: 12, sure: 0.8 });
  return list;
}
const effect = (from, to) => (from < 0 ? 1 : STRONG[from].includes(to) ? 2 : from === to || STRONG[to].includes(from) ? 0.5 : 1);

