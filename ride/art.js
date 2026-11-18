// Wildlings: Thunder Ride. All the pictures: the Wildlings, Voltrev the motorbike Wildling, the people, and the scenery.
// Everything is drawn with smooth shapes (ovals, curves and lines), then given a thick cartoon outline.

const KINDS = ["Leaf", "Fire", "Water", "Spark", "Stone", "Frost", "Wind"];
const KIND_COLOUR = ["#5cc24a", "#f2682c", "#3c8cf0", "#f6cc20", "#b09468", "#84dcf0", "#b4c4e8"];
const STRONG = [[2, 4], [0, 5], [1, 4], [2, 6], [1, 3], [0, 6], [0, 4]];       // each kind is strong against two others
const MOVES = [["Leaf Whip", "Bramble Burst"], ["Flame Lick", "Fire Wheel"], ["Water Jet", "Tidal Slam"], ["Spark Shot", "Thunder Wheel"], ["Rock Throw", "Rock Slide"], ["Ice Dart", "Blizzard Burst"], ["Air Slice", "Whirlwind"]];
// Twelve families of two: [baby, grown-up, kind, body shape, looks of the baby, extra looks of the grown-up]
const FAMILIES = [
  ["Clovercub", "Meadowmaul", 0, "quad", "ears:round tail:stub", "mane flower fangs"],
  ["Tweetle", "Skyraptor", 6, "bird", "", "crest bigwings longtail"],
  ["Zapbug", "Thunderfly", 3, "bug", "antenna:bolt stripes", "wings spikes"],
  ["Splashfin", "Tidefang", 2, "fish", "", "hornnose fangs stripes"],
  ["Pinchy", "Clawdron", 2, "bug", "pincers shell", "spikes stinger"],
  ["Cinderhog", "Blazeboar", 1, "quad", "ears:round tail:flame", "mane fangs spikes"],
  ["Gravelpup", "Bouldog", 4, "rock", "arms", "legs crystals"],
  ["Sandviper", "Dunecobra", 4, "serpent", "stripes", "hood rattle"],
  ["Snowpaw", "Blizzabear", 5, "biped", "ears:round", "claws mane"],
  ["Icicowl", "Frosthoot", 5, "bird", "owl", "crest bigwings"],
  ["Wattkit", "Neoncat", 3, "quad", "ears:point tail:bolt", "stripes mane"],
  ["Smogpuff", "Stormcloud", 6, "blob", "cloud", "bolts crown"],
];
const DEX = [null];       // DEX[1] to DEX[26]
FAMILIES.forEach(function (family, f) {
  const baby = family[4].split(" ").filter(Boolean);
  DEX.push({ name: family[0], kind: family[2], family: f, stage: 0, shape: family[3], looks: baby });
  DEX.push({ name: family[1], kind: family[2], family: f, stage: 1, shape: family[3], looks: baby.concat(family[5].split(" ")) });
});
DEX.push({ name: "Tempestrix", kind: 3, family: 12, stage: 1, legend: true, shape: "serpent", looks: ["horns", "bigwings", "spikes", "hood"] });
DEX.push({ name: "Voltrev", kind: 3, family: 13, stage: 1, bike: true });
const TOTAL = DEX.length - 1, VOLTREV = 26, TEMPESTRIX = 25;
const GROWS_AT = 15;       // the level where a baby Wildling grows up
const idFor = (family, lv) => family * 2 + 1 + (lv >= GROWS_AT ? 1 : 0);

// ----- Numbers for battles -----
const maxHp = (c) => Math.round((22 + c.lv * (3.2 + DEX[c.id].stage * 0.8 + (DEX[c.id].family % 3) * 0.3)) * (c.big || 1));
const power = (c) => 6 + c.lv * (1.25 + DEX[c.id].stage * 0.25 + (DEX[c.id].family % 4) * 0.06);
const guard = (c) => 6 + c.lv * (1.25 + DEX[c.id].stage * 0.25 + ((DEX[c.id].family + 2) % 4) * 0.06);
const xpToGrow = (c) => 12 + c.lv * 9;
const newCreature = (id, lv) => {
  const c = { id: id, lv: lv, xp: 0 };
  c.hp = maxHp(c);
  return c;
};
const effect = (from, to) => (from < 0 ? 1 : STRONG[from].includes(to) ? 2 : from === to || STRONG[to].includes(from) ? 0.5 : 1);

// ----- Colour helpers -----
const hexToRgb = (hex) => [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16));
const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const blend = (a, b, part) => rgbToHex(hexToRgb(a).map((v, n) => v + (hexToRgb(b)[n] - v) * part));
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function tinted(img, colour) {          // a one-colour copy of a picture (used for outlines and shadows)
  const c = makeCanvas(img.width, img.height), g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = colour;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
// Give a picture a thick dark cartoon outline
function outlined(img, thick, colour) {
  const out = makeCanvas(img.width, img.height), g = out.getContext("2d"), dark = tinted(img, colour || "#2a2238");
  for (let n = 0; n < 12; n++) g.drawImage(dark, Math.cos(n * 0.5236) * thick, Math.sin(n * 0.5236) * thick);
  g.drawImage(img, 0, 0);
  return out;
}

// ----- Drawing a Wildling -----
// Each body shape is built from ovals, triangles and lines in four colours:
// PAL[0] dark, PAL[1] a second colour for markings, PAL[2] the body, PAL[3] a pale highlight.
let PAL = ["#000000", "#555555", "#aaaaaa", "#ffffff"];
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
const pictures = [];
function picture(id) {
  if (pictures[id]) return pictures[id];
  const info = DEX[id];
  if (info.bike) return (pictures[id] = bikePicture(false));
  const body = blend(KIND_COLOUR[info.kind], ["#ffffff", "#000000", "#ff80c0", "#40ffd0"][info.family % 4], 0.14);
  PAL = [blend(body, "#000000", 0.68), blend(info.family % 2 ? KIND_COLOUR[(info.kind + 3) % 7] : body, "#000000", 0.3), body, blend(body, "#ffffff", 0.82)];
  const f = {};
  for (const word of info.looks) {
    const [name, value] = word.split(":");
    f[name] = value || true;
  }
  const board = makeCanvas(120, 120);
  G = board.getContext("2d");
  const size = info.legend ? 1.02 : info.stage ? 0.96 : 0.72;
  G.translate(4, 2);
  G.scale(2, 2);
  G.translate(28, 53);
  G.scale(size, size);
  G.translate(-28, -53);
  SHAPES[info.shape](f);
  const done = outlined(board, 2.4);
  done.side = ["quad", "bird", "fish", "serpent"].includes(info.shape) || (info.shape === "bug" && !f.bigwings);       // (drawn from the side, facing left)
  return (pictures[id] = done);
}

// ----- Voltrev: the motorbike Wildling -----
// A sleek lightning-beast whose paws curl into two glowing wheels. Drawn facing right.
// "spin" turns the wheels, and "mega" draws its Overdrive form: hotter colours, back spikes and flames.
function drawBike(g, spin, mega, time) {
  const body = mega ? "#ff7a2a" : "#f8d028", belly = mega ? "#ffe9a8" : "#fff4b0", dark = "#2a2238", glow = mega ? "#ff4ad8" : "#4ae8ff", stripe = mega ? "#ffffff" : "#4ae8ff";
  const wheel = function (x, y) {
    g.lineWidth = 9;
    g.strokeStyle = dark;
    g.beginPath();
    g.arc(x, y, 20, 0, 6.2832);
    g.stroke();
    g.lineWidth = 3.5;
    g.strokeStyle = glow;
    g.beginPath();
    g.arc(x, y, 20, 0, 6.2832);
    g.stroke();
    g.strokeStyle = glow;
    g.lineWidth = 3;
    for (let n = 0; n < 3; n++) {
      const a = spin + n * 2.094;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
      g.lineTo(x + Math.cos(a + 0.5) * 11, y + Math.sin(a + 0.5) * 11);
      g.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
      g.stroke();
    }
    g.fillStyle = body;
    g.beginPath();
    g.arc(x, y, 6, 0, 6.2832);
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = dark;
    g.stroke();
  };
  const shape = function (fill, points, close) {
    g.beginPath();
    points.forEach(([x, y], n) => (n ? g.lineTo(x, y) : g.moveTo(x, y)));
    if (close !== false) g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = dark;
    g.lineJoin = "round";
    g.stroke();
  };
  if (mega) {                       // exhaust flames and a hot glow
    for (let n = 0; n < 3; n++) {
      const long = 22 + Math.sin(time * 30 + n * 2) * 8;
      g.fillStyle = ["#ff4ad8", "#ffb030", "#ffffff"][n];
      g.beginPath();
      g.moveTo(14, 44 + n * 3);
      g.lineTo(14 - long + n * 6, 50);
      g.lineTo(14, 56 - n * 3);
      g.fill();
    }
  }
  shape("#9aa0b0", [[6, 44], [28, 46], [28, 56], [6, 56]]);                 // the exhaust-pipe tail
  shape(mega ? "#ffffff" : "#f8d028", [[6, 44], [0, 34], [8, 38], [4, 26], [14, 40]]);        // a lightning-bolt tail tip
  g.lineWidth = 7;                    // legs reaching down to the wheel hubs
  g.strokeStyle = dark;
  g.beginPath();
  g.moveTo(46, 54);
  g.lineTo(38, 74);
  g.moveTo(110, 48);
  g.lineTo(114, 74);
  g.stroke();
  wheel(38, 74);
  wheel(114, 74);
  if (mega) for (let n = 0; n < 4; n++) shape("#ffe9a8", [[42 + n * 14, 42 - n * 3], [44 + n * 14, 22 - n * 4], [54 + n * 14, 40 - n * 3]]);        // spikes down its back
  shape(body, [[22, 60], [30, 44], [50, 40], [72, 48], [92, 34], [112, 22], [128, 20], [146, 32], [138, 44], [118, 52], [100, 64], [60, 66], [30, 64]]);
  shape(belly, [[60, 66], [100, 64], [118, 52], [104, 54], [86, 60], [62, 60]]);
  g.strokeStyle = stripe;             // a lightning stripe along its side
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(36, 54);
  g.lineTo(54, 48);
  g.lineTo(50, 56);
  g.lineTo(72, 52);
  g.lineTo(68, 58);
  g.lineTo(90, 50);
  g.stroke();
  shape(dark, [[112, 22], [96, 8], [102, 6], [124, 20]]);                    // swept-back ears, like handlebars
  shape(body, [[96, 8], [90, 2], [102, 6]]);
  shape(glow, [[120, 26], [138, 28], [142, 34], [124, 34]]);                 // a visor for an eye
  g.fillStyle = "#ffffff";
  g.fillRect(126, 28, 6, 2.5);
  g.fillStyle = dark;
  g.fillRect(140, 38, 4, 2.5);
}
const bikeDrawn = [null, null];
function bikePicture(mega) {
  if (bikeDrawn[mega ? 1 : 0]) return bikeDrawn[mega ? 1 : 0];
  const c = makeCanvas(120, 120), g = c.getContext("2d");
  g.translate(2, 22);
  g.scale(0.78, 0.78);
  drawBike(g, 0.6, mega, 0);
  return (bikeDrawn[mega ? 1 : 0] = c);
}

// ----- People: smooth cartoon characters with big heads -----
// A look is: skin, hair colour, hair style, jacket colour, trousers colour, and an extra (helmet, bandana, shades, goggles, cap).
const peopleDrawn = new Map();
function person(look, pose) {          // pose: 0 and 1 are two walking steps, 2 is sitting on the bike
  const name = JSON.stringify(look) + pose;
  if (peopleDrawn.has(name)) return peopleDrawn.get(name);
  const c = makeCanvas(72, 88), g = c.getContext("2d"), dark = "#2a2238";
  const blob = function (fill, draw) {
    g.beginPath();
    draw();
    g.fillStyle = fill;
    g.fill();
  };
  const round = (x, y, rx, ry, fill) => blob(fill, () => g.ellipse(x, y, rx, ry, 0, 0, 6.2832));
  const sit = pose === 2, lift = pose === 1 ? 3 : 0;
  // legs and shoes
  if (sit) {
    blob(look.legs, () => g.roundRect(30, 60, 22, 9, 4));
    round(54, 66, 6, 4, dark);
  } else {
    blob(look.legs, () => g.roundRect(26, 62, 8, 16 - lift, 3));
    blob(look.legs, () => g.roundRect(38, 62, 8, 13 + lift, 3));
    round(30, 79 - lift, 6, 3.6, dark);
    round(42, 76 + lift, 6, 3.6, dark);
  }
  // body: a little jacket with a zip and a collar
  blob(look.top, () => g.roundRect(22, 44, 28, 24, 9));
  blob(blend(look.top, "#000000", 0.22), () => g.roundRect(22, 60, 28, 8, 5));
  g.fillStyle = blend(look.top, "#ffffff", 0.6);
  g.fillRect(35, 47, 2, 18);
  blob(blend(look.top, "#ffffff", 0.45), () => g.roundRect(28, 43, 16, 5, 2));
  // arms
  round(sit ? 52 : 20, sit ? 52 : 54 + lift, 4.6, 8, look.top);
  round(sit ? 58 : 20, sit ? 56 : 62 + lift, 3.6, 3.6, look.skin);
  if (!sit) {
    round(52, 54 - lift, 4.6, 8, look.top);
    round(52, 62 - lift, 3.6, 3.6, look.skin);
  }
  // the head: big and round
  if (look.hair !== "none" && (look.style === "long" || look.style === "tail")) blob(look.hair, () => g.roundRect(15, 18, 42, look.style === "long" ? 34 : 22, 12));
  if (look.style === "tail") round(60, 34, 6, 12, look.hair);
  round(36, 26, 19, 18, look.skin);
  round(17, 28, 3.4, 4.4, look.skin);
  round(55, 28, 3.4, 4.4, look.skin);
  // hair on top
  if (look.style === "spiky") blob(look.hair, function () {
    g.moveTo(17, 22);
    for (const [x, y] of [[20, 4], [27, 12], [32, 0], [38, 11], [45, 1], [48, 13], [56, 6], [55, 22]]) g.lineTo(x, y);
    g.quadraticCurveTo(36, 12, 17, 22);
  });
  else if (look.style === "mohawk") blob(look.hair, () => g.roundRect(31, -2, 10, 20, 5));
  else if (look.style !== "bald") blob(look.hair, function () {
    g.moveTo(16, 24);
    g.quadraticCurveTo(18, 5, 36, 6);
    g.quadraticCurveTo(54, 5, 56, 24);
    g.quadraticCurveTo(46, 14, 34, 17);
    g.quadraticCurveTo(24, 16, 16, 24);
  });
  // face: big shiny eyes, rosy cheeks and a little smile
  if (look.extra !== "shades" && look.extra !== "goggles") for (const x of [28, 44]) {
    round(x, 29, 3.6, 5, dark);
    round(x + 1, 27, 1.4, 1.8, "#ffffff");
  }
  round(24, 35, 3.4, 2, "rgba(255,120,120,0.45)");
  round(48, 35, 3.4, 2, "rgba(255,120,120,0.45)");
  if (look.extra !== "bandana") {
    g.strokeStyle = dark;
    g.lineWidth = 1.6;
    g.lineCap = "round";
    g.beginPath();
    g.arc(36, 35, 4, 0.25, 2.9);
    g.stroke();
  }
  // extras
  if (look.extra === "helmet" || look.extra === "goggles") {
    blob(look.gear, function () {
      g.moveTo(16, 25);
      g.quadraticCurveTo(15, 4, 36, 5);
      g.quadraticCurveTo(57, 4, 56, 25);
      g.closePath();
    });
    blob("#ffffff", () => g.roundRect(33, 6, 6, 18, 2));
    if (look.extra === "goggles") {
      blob(dark, () => g.roundRect(18, 23, 36, 11, 5));
      round(27, 28.5, 6.5, 4, "#8fe8ff");
      round(45, 28.5, 6.5, 4, "#8fe8ff");
      round(29, 27, 2, 1.2, "#ffffff");
      round(47, 27, 2, 1.2, "#ffffff");
    } else blob(dark, () => g.roundRect(16, 21, 40, 4, 2));
  }
  if (look.extra === "cap") {
    blob(look.gear, function () {
      g.moveTo(17, 20);
      g.quadraticCurveTo(18, 5, 36, 5);
      g.quadraticCurveTo(54, 5, 55, 20);
      g.closePath();
    });
    blob(blend(look.gear, "#000000", 0.3), () => g.roundRect(14, 18, 34, 5, 2));
  }
  if (look.extra === "shades") {
    blob(dark, () => g.roundRect(20, 24, 14, 9, 3));
    blob(dark, () => g.roundRect(38, 24, 14, 9, 3));
    g.fillStyle = dark;
    g.fillRect(32, 26, 8, 2);
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillRect(22, 26, 5, 2);
    g.fillRect(40, 26, 5, 2);
  }
  if (look.extra === "bandana") blob(look.gear, function () {
    g.moveTo(18, 32);
    g.lineTo(54, 32);
    g.quadraticCurveTo(52, 46, 36, 48);
    g.quadraticCurveTo(20, 46, 18, 32);
  });
  const done = outlined(c, 1.8);
  peopleDrawn.set(name, done);
  return done;
}
const look = (skin, hair, style, top, legs, extra, gear) => ({ skin: skin, hair: hair, style: style, top: top, legs: legs, extra: extra || "", gear: gear || "#e03838" });
const LOOKS = {
  you: look("#f6cfa8", "#7a4a26", "spiky", "#e84040", "#3a4a7a", "goggles", "#e84040"),
  gran: look("#f0c8a0", "#c8c8d4", "tail", "#4aa860", "#5a4a3a", "cap", "#f0a830"),
  grunt: look("#e8b890", "#8a4ad8", "mohawk", "#3a3a48", "#2a2a36", "bandana", "#f07020"),
  skid: look("#c98f62", "#58c048", "spiky", "#3f8a3a", "#2a2a36", "shades"),
  slick: look("#f6cfa8", "#3a8ae8", "long", "#2a6ac8", "#2a2a36", "shades"),
  burnout: look("#8a5a3a", "#f06a20", "mohawk", "#c83a20", "#2a2a36", "shades"),
  blackice: look("#f0e0d8", "#d8f0ff", "tail", "#5a7a9a", "#2a2a36", "shades"),
  vex: look("#e8c0a0", "#f4f4ff", "spiky", "#5a2a8a", "#1a1a26", "shades"),
  villager: look("#dba878", "#2a2030", "bald", "#e8a030", "#6a5a4a", "cap", "#3a8ae8"),
};
