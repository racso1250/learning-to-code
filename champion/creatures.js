// Champion of the Wildlings. The 60 Wildlings of Crownhaven: their names, types, pictures and battle numbers.
// Each picture is drawn from ovals, triangles and lines in four shades, then given real colours to match its type.

const TILE = 16;          // one square of the city map is 16 units wide
// A repeatable "random" number for a square (so the city is the same every time)
function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function makeCanvas(w, h) {
  const board = document.createElement("canvas");
  board.width = w;
  board.height = h;
  return board;
}
function tinted(img, colour) {          // a one-colour shadow copy of a picture
  const board = makeCanvas(img.width, img.height), g = board.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = colour;
  g.fillRect(0, 0, board.width, board.height);
  return board;
}
const PAL = ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"];       // the four drawing shades, darkest to lightest
// Twelve types. STRONG[a] lists the types that type "a" does double damage to; WEAK[a] lists the types that shrug it off.
const KINDS = ["Fire", "Water", "Grass", "Electric", "Ice", "Rock", "Flying", "Fighting", "Psychic", "Dark", "Dragon", "Fairy"];
const KIND_COLOUR = ["#f2682c", "#3c8cf0", "#5cc24a", "#f6cc20", "#84dcf0", "#b09468", "#a8b8f0", "#c8553a", "#f060a8", "#6a5a78", "#6a58e0", "#f0a0d8"];
const STRONG = [[2, 4], [0, 5], [1, 5], [1, 6], [2, 6, 10], [0, 4, 6], [2, 7], [4, 5, 9], [7], [8], [10], [7, 10, 9]];
const WEAK = [[1, 5, 0, 10], [1, 2, 10], [0, 2, 6, 10], [2, 3, 10], [0, 1, 4], [7], [3, 5], [6, 8, 11], [8, 9], [7, 9, 11], [11], [0]];
const MOVES = [["Flame Lick", "Fire Wheel"], ["Water Jet", "Tidal Slam"], ["Leaf Whip", "Bramble Burst"], ["Spark Shot", "Thunder Clap"], ["Ice Dart", "Blizzard Burst"], ["Rock Throw", "Rock Slide"], ["Air Slice", "Whirlwind"], ["Quick Jab", "Mega Kick"], ["Mind Poke", "Dream Wave"], ["Shadow Nip", "Night Crash"], ["Dragon Breath", "Dragon Storm"], ["Sparkle Puff", "Star Shower"]];
// Nineteen families of three: [types of the baby and middle one, types of the grown-up, baby, middle, grown-up, body shape, looks, extra looks, more extra looks]
const FAMILIES = [
  [[0], [0, 10], "Flickit", "Blazard", "Infernagon", "dragon", "", "spikes", "wings horns claws fangs"],
  [[1], [1, 4], "Waddlet", "Glidefin", "Emperoar", "penguin", "", "crest", "crown crystals spikes"],
  [[2], [2, 5], "Budops", "Frondhorn", "Terratops", "tricera", "", "frill leaves", "horns flower"],
  [[3], [3], "Zipkit", "Voltlynx", "Thunderpard", "quad", "ears:point tail:bolt", "stripes", "mane fangs spikes"],
  [[6], [6], "Chirrup", "Windwing", "Skylord", "bird", "", "crest", "bigwings longtail"],
  [[5], [5, 7], "Pebblo", "Bouldar", "Titanrock", "rock", "", "arms", "legs crystals"],
  [[4], [4, 7], "Frostcub", "Glacibear", "Icequake", "biped", "ears:round", "claws", "mane fangs"],
  [[8], [8], "Mindlet", "Dreamist", "Oraclone", "ghost", "", "arms", "tail horns flames"],
  [[9], [9, 6], "Gloomwing", "Nightflap", "Umbrawl", "bird", "batwings ears:point", "fangs", "bigwings crest"],
  [[11], [11, 8], "Twinkit", "Glimmerie", "Starfae", "biped", "ears:long", "top:star", "wings"],
  [[10], [10, 6], "Wyrmling", "Drakescale", "Tempestwyrm", "serpent", "horns", "spikes wings", "=serpent horns spikes bigwings hood"],
  [[7], [7], "Punchlet", "Brawlroo", "Champkick", "biped", "ears:point tail:thin", "claws", "mane tusks"],
  [[1], [1, 9], "Finnip", "Wavefin", "Tidalshark", "fish", "", "hornnose stripes", "raywings fangs"],
  [[2], [2, 6], "Nibleaf", "Silkpod", "Petalwing", "bug", "worm antenna", "=cocoon", "=bug bigwings antenna"],
  [[0], [0, 5], "Emberclaw", "Scorchtail", "Magmasting", "bug", "pincers", "stinger", "flames spikes"],
  [[3], [3, 6], "Sparkmite", "Buzzvolt", "Stormhornet", "bug", "antenna:bolt stripes", "wings", "spikes stinger"],
  [[4], [4, 6], "Snowhoot", "Frosthoot", "Blizzowl", "bird", "owl", "crest", "bigwings"],
  [[9], [9], "Shadepup", "Duskhound", "Nightfang", "quad", "ears:point tail:bushy", "stripes fangs", "mane spikes"],
  [[11], [11, 6], "Puffairy", "Cloudream", "Nimbliss", "blob", "cloud", "bolts", "crown"],
];
const DEX = [null];       // DEX[1] to DEX[60]
FAMILIES.forEach(function (family, f) {
  let looks = [];
  for (let stage = 0; stage < 3; stage++) {
    let shape = family[5];
    const extra = family[6 + stage];
    if (extra[0] === "=") {            // (this step of the family has a whole new shape, like a grub turning into a butterfly)
      shape = extra.slice(1).split(" ")[0];
      looks = extra.split(" ").slice(1);
    } else looks = looks.concat(extra.split(" ").filter(Boolean));
    const kinds = stage === 2 ? family[1] : family[0];
    DEX.push({ name: family[stage + 2], kind: kinds[0], kinds: kinds, family: f, stage: stage, shape: shape, looks: looks.slice() });
  }
});
// Two legendary Wildlings and one mythical one. They never evolve.
DEX.push({ name: "Glaciarch", kind: 4, kinds: [4, 10], family: 19, stage: 2, mystery: true, legend: true, shape: "serpent", looks: ["horns", "bigwings", "hood", "spikes"] });
DEX.push({ name: "Voltaris", kind: 3, kinds: [3, 6], family: 20, stage: 2, mystery: true, legend: true, shape: "bird", looks: ["crest", "bigwings", "bolttail"] });
DEX.push({ name: "Wishling", kind: 11, kinds: [11, 8], family: 21, stage: 1, mystery: true, myth: true, shape: "biped", looks: ["wings", "top:star", "ears:long"] });
const TOTAL = DEX.length - 1, FAMILY_COUNT = FAMILIES.length;
const GROW_AT = [14, 30];       // the levels where a Wildling changes into its next form
const familiesOf = KINDS.map((kind, k) => FAMILIES.map((family, f) => (family[0][0] === k ? f : -1)).filter((f) => f >= 0));
const idFor = (family, lv) => (family >= FAMILY_COUNT ? 39 + family : family * 3 + 1 + (lv >= GROW_AT[1] ? 2 : lv >= GROW_AT[0] ? 1 : 0));
const bigKind = (id) => DEX[id].kinds[DEX[id].kinds.length - 1];        // the type of a Wildling's biggest attack: its second type, if it has two
const kindsOf = (id) => DEX[id].kinds.map((kind) => KINDS[kind]).join("/");

// ----- Numbers for battles -----
const maxHp = (c) => Math.round((20 + c.lv * (3 + DEX[c.id].stage * 0.8 + (DEX[c.id].family % 3) * 0.3)) * (c.big || 1));      // ("big" is for giant raid Wildlings)
const power = (c) => 6 + c.lv * (1.2 + DEX[c.id].stage * 0.25 + (DEX[c.id].family % 4) * 0.06);
const guard = (c) => 6 + c.lv * (1.2 + DEX[c.id].stage * 0.25 + ((DEX[c.id].family + 2) % 4) * 0.06);
const quick = (c) => c.lv * (1 + (DEX[c.id].family % 5) * 0.1) + (2 - DEX[c.id].stage);
const xpToGrow = (c) => 12 + c.lv * 9;
const newCreature = (id, lv) => {
  const c = { id: id, lv: lv, xp: 0 };
  c.hp = maxHp(c);
  return c;
};
function movesOf(c) {
  const kinds = DEX[c.id].kinds, big = kinds[kinds.length - 1];
  const list = [{ name: "Bonk", kind: -1, power: 5, sure: 1 }, { name: MOVES[kinds[0]][0], kind: kinds[0], power: 8, sure: 0.95 }];
  if (c.lv >= 10) list.push({ name: MOVES[big][1], kind: big, power: 12, sure: 0.8 });
  return list;
}
// How well does a move of one type work on a Wildling? Double for each of its types the move is strong against, half for each that shrugs it off.
function effect(from, id) {
  if (from < 0) return 1;
  let times = 1;
  for (const kind of DEX[id].kinds) times *= STRONG[from].includes(kind) ? 2 : WEAK[from].includes(kind) ? 0.5 : 1;
  return times;
}

// ----- Colours -----
const hexToRgb = (hex) => [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16));
const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const blend = (a, b, part) => rgbToHex(hexToRgb(a).map((v, n) => v + (hexToRgb(b)[n] - v) * part));
// Turn a colour round the colour wheel a little (so two families of the same kind don't look identical)
function turnHue(hex, degrees) {
  const [r, g, b] = hexToRgb(hex), a = (degrees * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const mix = (x, y, z) => r * (x[0] + cos * x[1] + sin * x[2]) + g * (y[0] + cos * y[1] + sin * y[2]) + b * (z[0] + cos * z[1] + sin * z[2]);
  return rgbToHex([
    mix([0.213, 0.787, -0.213], [0.715, -0.715, -0.715], [0.072, -0.072, 0.928]),
    mix([0.213, -0.213, 0.143], [0.715, 0.285, 0.14], [0.072, -0.072, -0.283]),
    mix([0.213, -0.213, -0.787], [0.715, -0.715, 0.715], [0.072, 0.928, 0.072]),
  ]);
}
// Swap the four drawing shades in a picture for four real colours
function recolour(picture, colours) {
  const copy = document.createElement("canvas");
  copy.width = picture.width;
  copy.height = picture.height;
  const g = copy.getContext("2d");
  g.drawImage(picture, 0, 0);
  const img = g.getImageData(0, 0, copy.width, copy.height), px = img.data;
  const swap = colours.map(hexToRgb);
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const shade = px[i] === 15 && px[i + 1] === 56 ? 0 : px[i] === 48 && px[i + 1] === 98 ? 1 : px[i] === 139 && px[i + 1] === 172 ? 2 : px[i] === 155 && px[i + 1] === 188 ? 3 : -1;
    if (shade >= 0) px.set(swap[shade], i);
  }
  g.putImageData(img, 0, 0);
  return copy;
}
// A Wildling's four colours: an outline, a second colour (its second type, or its markings), its body, and a highlight
function coloursOf(info) {
  const body = turnHue(KIND_COLOUR[info.kind], ((info.family * 47) % 30) - 15);
  const second = info.kinds.length > 1 ? blend(KIND_COLOUR[info.kinds[1]], "#000000", 0.12) : info.family % 2 ? blend(turnHue(body, 60), "#000000", 0.22) : blend(body, "#000000", 0.36);
  return [blend(body, "#000000", 0.74), second, body, blend(body, "#ffffff", 0.8)];
}

// ----- Drawing a Wildling -----
// Each shape (four legs, two legs, bird, fish...) is built from ovals, triangles and lines,
// then tidied into chunky pixels in the four greens, with a dark outline.
let G = null;
const oval = (x, y, rx, ry, c) => { G.fillStyle = PAL[c]; G.beginPath(); G.ellipse(x, y, rx, ry, 0, 0, 6.2832); G.fill(); };
const poly = (c, ...points) => { G.fillStyle = PAL[c]; G.beginPath(); points.forEach(([x, y], n) => (n ? G.lineTo(x, y) : G.moveTo(x, y))); G.fill(); };
const line = (x1, y1, x2, y2, w, c) => { G.strokeStyle = PAL[c]; G.lineWidth = w; G.lineCap = "round"; G.beginPath(); G.moveTo(x1, y1); G.lineTo(x2, y2); G.stroke(); };
const rect = (x, y, w, h, c) => { G.fillStyle = PAL[c]; G.fillRect(x, y, w, h); };
const eye = (x, y, r) => { oval(x, y, r || 2.3, r || 2.3, 3); oval(x - 0.4, y + 0.2, (r || 2.3) * 0.55, (r || 2.3) * 0.6, 0); };
const zigzag = (x, y, c) => { line(x, y, x + 4, y - 5, 2, c); line(x + 4, y - 5, x + 1, y - 7, 2, c); line(x + 1, y - 7, x + 6, y - 13, 2, c); };
function tailOf(kind, x, y) {
  if (kind === "thin") { line(x, y, x + 8, y - 8, 2, 2); oval(x + 9, y - 9, 2, 2, 1); }
  if (kind === "bushy") { oval(x + 5, y - 5, 6, 8, 2); oval(x + 6, y - 8, 3, 4, 3); }
  if (kind === "flame") { poly(1, [x - 1, y + 2], [x + 4, y - 16], [x + 7, y - 7], [x + 11, y - 13], [x + 10, y + 2]); poly(3, [x + 2, y + 1], [x + 5, y - 9], [x + 8, y + 1]); }
  if (kind === "leaf") { line(x, y, x + 5, y - 4, 2, 1); poly(1, [x + 4, y - 3], [x + 8, y - 13], [x + 13, y - 5], [x + 9, y + 1]); line(x + 6, y - 2, x + 10, y - 9, 1, 3); }
  if (kind === "bolt") zigzag(x, y, 3);
  if (kind === "stub") oval(x + 1, y - 1, 3, 3, 2);
  if (kind === "fin") poly(1, [x - 1, y - 2], [x + 9, y - 10], [x + 8, y + 5]);
}
const SHAPES = {
  // A dragon, standing tall, seen from the side (facing left). Its wings and horns grow as it evolves.
  dragon: function (f) {
    tailOf("flame", 44, 40);
    line(40, 44, 50, 40, 5, 2);
    if (f.wings) { poly(1, [30, 26], [44, 4], [47, 14], [54, 10], [50, 24], [54, 26], [42, 34]); line(31, 26, 45, 6, 1, 0); line(33, 28, 52, 12, 1, 0); }
    rect(24, 42, 5, 10, 1);
    rect(36, 42, 5, 10, 1);
    oval(32, 37, 11, 10, 2);
    oval(29, 40, 6.5, 7, 3);
    for (let y = 35; y <= 45; y += 3.4) line(24, y, 34, y, 1, 1);          // plates down its belly
    rect(27, 44, 5, 8, 2);
    rect(34, 44, 5, 8, 2);
    rect(26, 51, 7, 2, 0);
    rect(33, 51, 7, 2, 0);
    line(25, 30, 19, 20, 7, 2);                                             // a long neck
    oval(15, 17, 8, 6.5, 2);
    oval(9, 20, 5, 3.6, 2);
    if (f.spikes) for (let n = 0; n < 4; n++) poly(1, [24 + n * 4, 27 + n * 2], [28 + n * 4, 20 + n * 2], [29 + n * 4, 29 + n * 2]);
    if (f.horns) { poly(3, [16, 12], [20, 1], [21, 12]); poly(3, [20, 13], [27, 5], [24, 15]); } else poly(3, [17, 12], [20, 6], [21, 13]);
    oval(18, 33, 3, 5, 2);
    if (f.claws) { poly(3, [15, 37], [16, 42], [18, 38]); poly(3, [18, 38], [19, 42], [21, 37]); }
    eye(13, 16, 2.3);
    rect(5, 19, 1.5, 1.5, 0);
    line(6, 22, 12, 23, 1, 0);
    if (f.fangs) { poly(3, [7, 22], [8, 26], [10, 23]); poly(3, [11, 23], [12, 26], [13, 23]); }
  },
  // A penguin, seen from the front: a dark coat, a white tummy, flippers and a beak
  penguin: function (f) {
    oval(21, 51, 5.5, 2.4, 3);
    oval(35, 51, 5.5, 2.4, 3);
    poly(1, [16, 30], [7, 44], [12, 46], [19, 38]);                         // flippers
    poly(1, [40, 30], [49, 44], [44, 46], [37, 38]);
    oval(28, 36, 12.5, 15, 1);
    oval(28, 39, 8.5, 11, 3);
    oval(28, 19, 10, 9, 1);
    oval(23.5, 20, 4, 4.6, 3);
    oval(32.5, 20, 4, 4.6, 3);
    if (f.crest) { poly(2, [20, 13], [15, 3], [24, 10]); poly(2, [36, 13], [41, 3], [32, 10]); poly(2, [26, 11], [28, 2], [30, 11]); }
    if (f.crown) poly(3, [20, 12], [18, 2], [24, 8], [28, 0], [32, 8], [38, 2], [36, 12]);
    if (f.crystals) { poly(3, [13, 30], [9, 20], [17, 27]); poly(3, [43, 30], [47, 20], [39, 27]); }
    eye(23.5, 20, 2.1);
    eye(32.5, 20, 2.1);
    poly(2, [25, 24], [28, 29], [31, 24]);
    if (f.spikes) for (const x of [22, 28, 34]) line(x, 42, x, 46, 1.2, 1);
  },
  // A triceratops, seen from the side (facing left): a big frill, three horns and a beak
  tricera: function (f) {
    tailOf(f.tail || "stub", 46, 40);
    line(42, 40, 50, 44, 6, 2);
    rect(24, 42, 5, 10, 1);
    rect(38, 42, 5, 10, 1);
    oval(33, 38, 14, 9.5, 2);
    oval(33, 43, 10, 4.2, 3);
    rect(27, 43, 5, 9, 2);
    rect(35, 43, 5, 9, 2);
    rect(26, 51, 7, 2, 0);
    rect(34, 51, 7, 2, 0);
    if (f.leaves) for (let x = 28; x <= 42; x += 5) poly(1, [x - 3, 31], [x, 21], [x + 3, 31]);       // leafy plates down its back
    if (f.flower) { oval(36, 26, 4, 4, 3); oval(36, 26, 1.6, 1.6, 1); }
    oval(23, 26, f.frill ? 11 : 7, f.frill ? 13 : 8, 1);                    // the frill behind its head
    if (f.frill) { oval(23, 26, 7.5, 9.5, 2); for (let a = -1.2; a <= 1.2; a += 0.6) oval(23 + Math.sin(a) * -1 + Math.cos(a + 1.57) * 0, 26 + Math.sin(a) * 11.5, 1.6, 1.6, 3); }
    oval(15, 31, 9, 7.5, 2);
    poly(2, [8, 30], [2, 35], [9, 37]);                                     // a beak
    if (f.horns) { poly(3, [14, 26], [8, 10], [18, 24]); poly(3, [19, 25], [16, 9], [23, 24]); }
    poly(3, [7, 30], [4, f.horns ? 22 : 25], [10, 28]);
    eye(14, 30, 2.2);
    line(4, 36, 9, 37, 1, 0);
  },
  // Four legs, seen from the side, facing left
  quad: function (f) {
    rect(21, 41, 4, 10, 1);
    rect(37, 41, 4, 10, 1);
    tailOf(f.tail, 44, 34);
    if (f.spikes) for (let x = 24; x <= 40; x += 5) poly(1, [x - 3, 29], [x, 20], [x + 3, 29]);
    oval(31, 36, 14, 9, 2);
    if (f.shell) {
      oval(32, 32, 14, 9.5, 1);
      line(22, 31, 42, 31, 1, 0);
      line(28, 24, 26, 38, 1, 0);
      line(36, 24, 38, 38, 1, 0);
      if (f.tree) { rect(31, 12, 3, 12, 0); oval(32, 11, 8, 6, 1); oval(29, 9, 3, 2, 2); }
    } else oval(31, 40, 10, 4.5, 3);
    rect(25, 42, 4, 9, 2);
    rect(33, 42, 4, 9, 2);
    rect(24, 50, 6, 2, 0);
    rect(32, 50, 6, 2, 0);
    if (f.stripes) for (let x = 27; x <= 39; x += 5) line(x, 29, x + 1.5, 36, 1.6, 1);
    if (f.spots) { oval(28, 33, 2.2, 2.2, 1); oval(36, 31, 2.6, 2.6, 1); oval(39, 37, 1.8, 1.8, 1); }
    if (f.crystals) { poly(3, [26, 28], [29, 17], [32, 28]); poly(3, [34, 28], [38, 19], [40, 29]); }
    if (f.mane) oval(22, 30, 6.5, 9, 1);
    if (f.flower) for (let a = 0; a < 6; a++) oval(22 + Math.cos(a) * 6, 30 + Math.sin(a) * 7, 2.6, 2.6, 3);
    if (f.ears === "long") { oval(13, 12, 2.6, 9, 2); oval(20, 11, 2.6, 9, 2); oval(13, 12, 1, 6, 1); }
    oval(16, 28, 8.5, 7.5, 2);
    if (f.ears === "point") { poly(2, [10, 23], [9, 12], [16, 20]); poly(2, [17, 21], [21, 11], [24, 22]); poly(1, [11, 21], [10.5, 15], [14, 20]); }
    if (f.ears === "round") { oval(11, 20, 3.6, 3.6, 2); oval(21, 19, 3.6, 3.6, 2); oval(11, 20, 1.6, 1.6, 1); }
    if (f.ears === "tuft") { poly(2, [10, 23], [8, 11], [16, 20]); poly(2, [17, 21], [23, 10], [24, 22]); line(8, 11, 6, 7, 1.4, 0); line(23, 10, 25, 6, 1.4, 0); }
    if (f.horn) poly(3, [9, 23], [3, 13], [13, 20]);
    if (f.horns) { poly(3, [10, 22], [6, 9], [14, 19]); poly(3, [18, 20], [22, 8], [23, 20]); }
    if (f.antlers) { line(13, 21, 9, 7, 2, 1); line(11, 14, 5, 11, 2, 1); line(10, 10, 14, 5, 2, 1); line(20, 20, 25, 6, 2, 1); line(23, 13, 29, 10, 2, 1); line(24, 9, 21, 3, 2, 1); }
    eye(13, 27);
    rect(7, 29, 2, 2, 0);
    line(9, 32, 13, 33, 1, 0);
    if (f.fangs) { poly(3, [9, 32], [10, 37], [12, 33]); }
    if (f.whiskers) { line(8, 31, 1, 29, 0.8, 0); line(8, 32, 1, 34, 0.8, 0); }
  },
  // Two legs, seen from the front
  biped: function (f) {
    if (f.wings) { poly(1, [18, 30], [3, 12], [6, 36], [14, 40]); poly(1, [38, 30], [53, 12], [50, 36], [42, 40]); line(8, 20, 12, 36, 1, 0); line(48, 20, 44, 36, 1, 0); }
    if (f.tail === "thin") { line(36, 46, 48, 42, 2.4, 2); poly(1, [47, 38], [53, 41], [47, 46]); } else tailOf(f.tail, 37, 46);
    if (f.shell) oval(28, 38, 14, 13.5, 1);
    oval(22, 50, 5.5, 2.8, 1);
    oval(34, 50, 5.5, 2.8, 1);
    oval(28, 39, 10.5, 11.5, 2);
    oval(28, 41, 6.5, 7.5, 3);
    oval(16.5, 37, 3.2, 6.5, 2);
    oval(39.5, 37, 3.2, 6.5, 2);
    if (f.claws) { poly(3, [14, 42], [15, 47], [17, 43]); poly(3, [17, 43], [18, 47], [19, 42]); poly(3, [37, 42], [38, 47], [40, 43]); poly(3, [40, 43], [41, 47], [42, 42]); }
    if (f.thorns) { poly(1, [14, 33], [8, 26], [18, 30]); poly(1, [42, 33], [48, 26], [38, 30]); }
    if (f.mane) oval(28, 29, 12, 5.5, 1);
    if (f.ears === "long") { oval(20, 9, 2.6, 8, 2); oval(36, 9, 2.6, 8, 2); }
    oval(28, 22, 10, 8.5, 2);
    if (f.ears === "round") { oval(19, 15, 3.8, 3.8, 2); oval(37, 15, 3.8, 3.8, 2); oval(19, 15, 1.7, 1.7, 1); oval(37, 15, 1.7, 1.7, 1); }
    if (f.horns) { poly(3, [20, 17], [15, 5], [24, 14]); poly(3, [36, 17], [41, 5], [32, 14]); }
    if (f.top === "leaf") { line(28, 14, 28, 9, 1.6, 0); poly(1, [28, 11], [19, 3], [26, 1], [29, 8]); poly(1, [28, 11], [37, 4], [31, 1]); line(28, 10, 22, 4, 1, 3); }
    if (f.top === "flame") { poly(1, [22, 15], [25, 2], [28, 9], [32, 1], [34, 15]); poly(3, [25, 15], [28, 7], [31, 15]); }
    if (f.top === "star") { poly(3, [28, 1], [30, 7], [36, 7], [31, 11], [33, 16], [28, 13], [23, 16], [25, 11], [20, 7], [26, 7]); }
    eye(24, 22, 2.4);
    eye(32, 22, 2.4);
    line(26, 27, 30, 27, 1, 0);
    if (f.tusks) { poly(3, [21, 26], [20, 33], [24, 28]); poly(3, [35, 26], [36, 33], [32, 28]); }
    if (f.fangs) { poly(3, [25, 27], [26, 31], [27, 27]); poly(3, [29, 27], [30, 31], [31, 27]); }
  },
  // A bird, seen from the side, facing left
  bird: function (f) {
    if (f.bolttail) { zigzag(40, 40, 3); zigzag(44, 44, 3); } else if (f.longtail) { poly(1, [38, 36], [55, 28], [55, 34], [42, 40]); poly(1, [38, 38], [55, 40], [54, 46], [40, 42]); } else poly(1, [38, 35], [51, 31], [51, 42], [40, 41]);
    line(27, 43, 27, 50, 1.6, 0);
    line(33, 43, 33, 50, 1.6, 0);
    line(24, 51, 29, 51, 1.6, 0);
    line(30, 51, 35, 51, 1.6, 0);
    if (f.bigwings) poly(1, [26, 30], [50, 6], [47, 20], [53, 17], [46, 30], [38, 36]);
    oval(30, 36, 11.5, 9.5, 2);
    oval(27, 39, 7, 5.5, 3);
    if (f.batwings) { poly(1, [28, 32], [44, 12], [46, 24], [51, 21], [48, 32], [44, 30], [42, 37], [36, 34]); line(30, 32, 44, 14, 1, 0); } else if (!f.bigwings) { oval(34, 34, 8, 5.5, 1); line(29, 35, 39, 35, 1, 0); } else line(30, 31, 46, 12, 1, 0);
    oval(18, 25, 7.5, 7, 2);
    if (f.crest) { poly(1, [15, 19], [17, 8], [20, 18]); poly(1, [19, 18], [23, 9], [24, 19]); }
    if (f.ears === "point") { poly(2, [13, 20], [12, 10], [18, 18]); poly(2, [19, 19], [23, 10], [24, 20]); }
    if (f.owl) { poly(2, [12, 20], [10, 11], [17, 18]); poly(2, [20, 18], [25, 11], [24, 21]); oval(17, 25, 5.2, 5.2, 3); eye(17, 25, 3.2); poly(1, [12, 28], [9, 31], [14, 31]); } else {
      poly(3, [12, 25], [3, 27], [12, 30]);
      line(4, 27.5, 12, 27.5, 0.8, 0);
      eye(16, 24);
    }
    if (f.fangs) { poly(3, [11, 30], [12, 34], [13, 30]); }
  },
  // A fish, seen from the side, facing left
  fish: function (f) {
    poly(1, [41, 33], [53, 23], [50, 33], [53, 43]);
    if (f.raywings) { poly(1, [20, 30], [32, 8], [42, 30]); poly(1, [20, 36], [32, 51], [42, 36]); line(30, 14, 31, 29, 1, 0); }
    poly(1, [24, 26], [31, 16], [38, 26]);
    oval(28, 33, 15, 8.5, 2);
    oval(27, 37, 11, 4.2, 3);
    poly(1, [27, 35], [33, 43], [35, 35]);
    if (f.stripes) for (let x = 26; x <= 38; x += 5) line(x, 27, x, 38, 1.6, 1);
    if (f.crystals) { poly(3, [22, 26], [25, 15], [28, 26]); poly(3, [32, 26], [36, 17], [38, 27]); poly(3, [44, 28], [50, 20], [49, 31]); }
    if (f.hornnose) poly(3, [14, 31], [2, 29], [14, 35]);
    if (f.lure) { line(18, 26, 12, 14, 1, 0); oval(11, 13, 3, 3, 3); }
    eye(18, 31, 2.4);
    line(13, 36, 18, 37, 1, 0);
    line(23, 29, 23, 37, 1, 1);
    if (f.fangs) { poly(3, [13, 36], [14, 40], [16, 37]); poly(3, [16, 37], [17, 40], [18, 37]); }
  },
  // A bug: a head, a middle and a back end. (A "worm" is a row of round segments.)
  bug: function (f) {
    if (f.worm) {
      for (const [x, y] of [[42, 45], [34, 44], [26, 43], [18, 42]]) { oval(x, y, 6.2, 6.2, 2); oval(x, y + 3, 4, 2.4, 3); rect(x - 1, y + 5, 2, 3, 0); }
      oval(11, 38, 7, 7, 2);
      line(9, 32, 6, 24, 1, 0);
      line(13, 32, 14, 23, 1, 0);
      oval(6, 23, 1.6, 1.6, 0);
      oval(14, 22, 1.6, 1.6, 0);
      eye(9, 38, 2.4);
      line(6, 42, 10, 43, 1, 0);
      return;
    }
    if (f.bigwings) { oval(21, 20, 11, 12, 3); oval(39, 20, 11, 12, 3); oval(22, 40, 7, 8, 3); oval(38, 40, 7, 8, 3); oval(21, 19, 4, 4.5, 1); oval(39, 19, 4, 4.5, 1); line(30, 16, 30, 46, 5, 2); line(30, 16, 30, 46, 1.4, 1); oval(30, 14, 4.5, 4.5, 2); line(28, 10, 24, 3, 1, 0); line(32, 10, 36, 3, 1, 0); eye(28, 14, 1.8); eye(32, 14, 1.8); return; }
    if (f.wings) { oval(27, 23, 10, 7, 3); oval(38, 23, 9, 6, 3); line(20, 25, 34, 21, 1, 1); line(31, 25, 44, 21, 1, 1); }
    if (f.stinger) { line(46, 34, 52, 24, 3.4, 2); line(52, 24, 47, 15, 3.4, 2); poly(3, [45, 17], [42, 8], [50, 13]); }
    for (const [x1, x2] of [[23, 19], [28, 28], [34, 38]]) line(x1, 40, x2, 50, 1.4, 0);
    oval(39, 36, 9.5, 7.5, 2);
    oval(27, 36, 7, 6.5, 2);
    if (f.stripes) for (let x = 35; x <= 45; x += 4) line(x, 30, x, 42, 1.8, 1);
    if (f.shell) { oval(34, 33, 14, 8.5, 1); line(22, 33, 46, 33, 1, 0); line(34, 25, 34, 41, 1, 0); }
    if (f.spikes) for (let x = 26; x <= 44; x += 6) poly(1, [x - 3, 30], [x, 21], [x + 3, 30]);
    if (f.flames) for (let x = 28; x <= 42; x += 7) poly(3, [x - 3, 29], [x, 18], [x + 3, 29]);
    oval(16, 35, 6.5, 6.5, 2);
    if (f.pincers) { oval(7, 43, 5.5, 4.2, 2); poly(3, [3, 41], [0, 46], [6, 45]); oval(9, 27, 4.5, 3.6, 2); poly(3, [6, 25], [2, 28], [8, 29]); }
    if (f.antenna === "bolt") { zigzag(11, 30, 3); zigzag(16, 29, 3); } else if (f.antenna) { line(14, 30, 9, 20, 1, 0); line(18, 29, 18, 19, 1, 0); oval(9, 19, 1.6, 1.6, 0); oval(18, 18, 1.6, 1.6, 0); }
    eye(14, 34, 2.3);
  },
  // A cocoon: wrapped up tight, waiting to hatch
  cocoon: function () {
    line(28, 2, 28, 16, 1, 0);
    oval(28, 33, 11, 17, 2);
    oval(25, 30, 5, 10, 3);
    for (let y = 22; y <= 44; y += 6) line(18, y, 38, y + 2, 1.5, 1);
    poly(1, [17, 26], [8, 18], [20, 20]);
    line(22, 32, 27, 33, 1.4, 0);
    line(30, 33, 35, 32, 1.4, 0);
  },
  // A snake or a dragon: a curling line of circles, fat at the head and thin at the tail
  serpent: function (f) {
    const at = (t) => [46 - 30 * t, 47 - 24 * t + Math.sin(t * 6.5) * 6, 2.6 + 4.2 * t];
    if (f.rattle) { oval(49, 46, 2.4, 2.4, 1); oval(52, 43, 2, 2, 1); oval(54, 40, 1.6, 1.6, 1); }
    if (f.wings || f.bigwings) {
      const w = f.bigwings ? 1.5 : 1;
      poly(1, [30, 30], [30 + 14 * w, 30 - 20 * w], [30 + 10 * w, 30 - 8 * w], [30 + 17 * w, 30 - 10 * w], [36, 34]);
      poly(1, [24, 30], [24 - 12 * w, 30 - 20 * w], [24 - 9 * w, 30 - 7 * w], [20, 34]);
      line(30, 30, 30 + 13 * w, 30 - 18 * w, 1, 0);
    }
    for (let n = 0; n <= 16; n++) {
      const [x, y, r] = at(n / 16);
      if (f.spikes && n % 3 === 1) poly(1, [x - 2, y - r + 1], [x + 1, y - r - 5], [x + 3, y - r + 1]);
      oval(x, y, r, r, f.stripes && n % 4 === 2 ? 1 : 2);
    }
    if (f.hood) oval(15, 24, 11.5, 9.5, 1);
    oval(15, 22, 7.6, 6.6, 2);
    oval(11, 25, 4.6, 3.6, 2);
    if (f.horns) { poly(3, [13, 17], [10, 6], [17, 15]); poly(3, [18, 17], [22, 7], [22, 18]); }
    eye(13, 20, 2.2);
    line(7, 26, 2, 24, 0.9, 0);
    line(7, 26, 2, 28, 0.9, 0);
    rect(8, 23, 1, 1, 0);
  },
  // A soft round blob (or a puffy cloud)
  blob: function (f) {
    if (f.cloud) {
      if (f.bolts) { zigzag(18, 53, 3); zigzag(34, 53, 3); }
      oval(16, 36, 9.5, 8.5, 2);
      oval(40, 36, 9.5, 8.5, 2);
      oval(28, 30, 12, 11, 2);
      oval(28, 40, 15, 7, 2);
      oval(23, 26, 4, 2.6, 3);
    } else {
      if (f.tentacles) for (let x = 18; x <= 38; x += 5) { line(x, 44, x - 1.5, 51, 2.6, 2); }
      G.fillStyle = PAL[2];
      G.beginPath();
      G.ellipse(28, f.tentacles ? 34 : 40, 14.5, 13.5, 0, Math.PI, 0);
      G.lineTo(42.5, f.tentacles ? 42 : 48);
      G.quadraticCurveTo(28, f.tentacles ? 47 : 54, 13.5, f.tentacles ? 42 : 48);
      G.fill();
      oval(22, f.tentacles ? 26 : 32, 3.4, 2.2, 3);
      if (f.arms) { oval(13, 43, 4.2, 3.2, 2); oval(43, 43, 4.2, 3.2, 2); }
      if (f.bubbles) { oval(8, 22, 3, 3, 3); oval(47, 17, 3.6, 3.6, 3); oval(42, 9, 2, 2, 3); }
    }
    if (f.crown) { poly(3, [20, 22], [18, 12], [24, 18], [28, 9], [32, 18], [38, 12], [36, 22]); }
    const y = f.cloud ? 35 : f.tentacles ? 35 : 40;
    if (f.sleepy) { line(19, y, 25, y, 1.6, 0); line(31, y, 37, y, 1.6, 0); oval(44, 24, 1.6, 1.6, 0); oval(48, 19, 2.2, 2.2, 0); } else { eye(22, y, 2.8); eye(34, y, 2.8); }
    line(26, y + 5, 30, y + 5, 1, 0);
  },
  // A ghost: dark, with glowing eyes and a wavy hem
  ghost: function (f) {
    if (f.flames) { poly(3, [3, 30], [7, 16], [11, 30]); poly(3, [45, 30], [49, 16], [53, 30]); }
    if (f.tail) { line(36, 44, 47, 50, 4, 1); line(47, 50, 52, 46, 2.4, 1); }
    if (f.horns) { poly(0, [19, 18], [14, 4], [25, 14]); poly(0, [37, 18], [42, 4], [31, 14]); }
    G.fillStyle = PAL[1];
    G.beginPath();
    G.ellipse(28, 28, 13.5, 14.5, 0, Math.PI, 0);
    G.lineTo(41.5, 46);
    for (const x of [37, 32.5, 28, 23.5, 19]) { G.lineTo(x, 41); G.lineTo(x - 2.3, 47); }
    G.lineTo(14.5, 46);
    G.fill();
    oval(22, 20, 4, 2.6, 2);
    if (f.arms) { oval(11, 33, 4.6, 3.2, 1); oval(45, 33, 4.6, 3.2, 1); }
    if (f.antenna === "bolt") zigzag(26, 15, 3);
    oval(23, 28, 3.2, 3.8, 3);
    oval(33, 28, 3.2, 3.8, 3);
    oval(23.5, 29, 1.4, 1.8, 0);
    oval(32.5, 29, 1.4, 1.8, 0);
    poly(3, [23, 35], [25.5, 38], [28, 35], [30.5, 38], [33, 35], [33, 36.5], [30.5, 39.5], [28, 36.5], [25.5, 39.5], [23, 36.5]);
  },
  // A living boulder
  rock: function (f) {
    if (f.legs) { rect(18, 43, 8, 9, 1); rect(30, 43, 8, 9, 1); }
    const up = f.legs ? 4 : 0;
    if (f.arms) { oval(9, 38 - up, 5.5, 5.5, 1); oval(47, 38 - up, 5.5, 5.5, 1); oval(7, 37 - up, 2, 2, 2); }
    if (f.crystals) { poly(3, [22, 22 - up], [26, 7 - up], [30, 21 - up]); poly(3, [32, 22 - up], [38, 11 - up], [40, 25 - up]); poly(3, [15, 28 - up], [13, 17 - up], [20, 24 - up]); }
    poly(2, [14, 39 - up], [17, 26 - up], [26, 20 - up], [36, 21 - up], [43, 30 - up], [42, 43 - up], [34, 50 - up], [20, 50 - up]);
    poly(3, [18, 27 - up], [26, 21 - up], [30, 24 - up], [21, 31 - up]);
    poly(1, [42, 43 - up], [34, 50 - up], [28, 50 - up], [38, 40 - up], [43, 31 - up]);
    line(30, 22 - up, 33, 29 - up, 1, 0);
    line(20, 44 - up, 25, 47 - up, 1, 0);
    line(20, 32 - up, 36, 32 - up, 1.8, 0);
    if (f.rune) { rect(22, 34 - up, 4, 4, 3); rect(31, 34 - up, 4, 4, 3); line(25, 42 - up, 28, 39 - up, 1, 3); line(28, 39 - up, 31, 42 - up, 1, 3); } else { eye(24, 36 - up, 2.1); eye(33, 36 - up, 2.1); line(26, 43 - up, 31, 43 - up, 1, 0); }
  },
};
// Draw one Wildling (from its DEX entry) as a 56 by 56 picture in full colour
function drawWildling(info) {
  const f = {};
  for (const word of info.looks) {
    const [name, value] = word.split(":");
    f[name] = value || true;
  }
  const board = document.createElement("canvas");
  board.width = board.height = 56;
  G = board.getContext("2d");
  const size = info.legend ? 1.02 : info.myth ? 0.72 : [0.64, 0.82, 1][info.stage];
  G.translate(28, 53);
  G.scale(size, size);
  G.translate(-28, -53);
  SHAPES[info.shape](f);
  G.setTransform(1, 0, 0, 1, 0, 0);
  // Tidy up: every pixel becomes see-through or exactly one of the four shades, then gets a dark outline
  const img = G.getImageData(0, 0, 56, 56), px = img.data;
  const shades = PAL.map((hex) => parseInt(hex.slice(3, 5), 16));
  const solid = new Uint8Array(56 * 56);
  for (let i = 0; i < 56 * 56; i++) {
    if (px[i * 4 + 3] < 110) { px[i * 4 + 3] = 0; continue; }
    let best = 0;
    for (let n = 1; n < 4; n++) if (Math.abs(shades[n] - px[i * 4 + 1]) < Math.abs(shades[best] - px[i * 4 + 1])) best = n;
    px[i * 4] = parseInt(PAL[best].slice(1, 3), 16);
    px[i * 4 + 1] = shades[best];
    px[i * 4 + 2] = parseInt(PAL[best].slice(5, 7), 16);
    px[i * 4 + 3] = 255;
    solid[i] = 1;
  }
  for (let y = 0; y < 56; y++) for (let x = 0; x < 56; x++) {
    const i = y * 56 + x;
    if (solid[i]) continue;
    if ((x > 0 && solid[i - 1]) || (x < 55 && solid[i + 1]) || (y > 0 && solid[i - 56]) || (y < 55 && solid[i + 56])) px.set([15, 56, 15, 255], i * 4);
  }
  G.putImageData(img, 0, 0);
  const done = recolour(board, coloursOf(info));
  done.side = ["quad", "bird", "fish", "serpent", "dragon", "tricera"].includes(info.shape) || (info.shape === "bug" && !f.bigwings);       // (drawn from the side, facing left)
  return done;
}
const pictures = [];
const picture = (id) => pictures[id] || (pictures[id] = drawWildling(DEX[id]));
