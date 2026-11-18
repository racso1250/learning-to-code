// Wildlings: Wild Horizon. The 57 new Wildlings of the island of Solara: their names, kinds, pictures and battle numbers.
// Each picture is drawn from ovals, triangles and lines in four shades, then given real colours to match its kind.

const PAL = ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"];       // the four drawing shades, darkest to lightest
const KINDS = ["Leaf", "Fire", "Water", "Spark", "Stone", "Frost", "Shade", "Wind"];
const KIND_COLOUR = ["#58b848", "#f0622a", "#3a8ae8", "#f2c81e", "#a08a6a", "#7ad8f0", "#8a5ad0", "#a8c8d8"];
const STRONG = [[2, 4], [0, 5], [1, 4], [2, 7], [1, 3], [0, 7], [3, 5], [0, 6]];       // each kind is strong against two others
const MOVES = [["Leaf Slap", "Thorn Storm"], ["Hot Breath", "Fire Wheel"], ["Splash Shot", "Tidal Crash"], ["Zap", "Thunder Clap"], ["Rock Toss", "Landslide"], ["Ice Chip", "Snow Crash"], ["Spooky Poke", "Night Wave"], ["Gust Flick", "Twister"]];
// Eighteen families of three: [kind, baby, middle, grown-up, body shape, looks of the baby, extra looks of the middle one, extra looks of the grown-up]
const FAMILIES = [
  [0, "Budkin", "Briarbuck", "Thornantler", "quad", "ears:point tail:stub", "horn", "antlers mane flower"],
  [1, "Cindercat", "Pyrolynx", "Infernoleo", "quad", "ears:tuft tail:flame", "stripes", "mane fangs"],
  [2, "Ottlet", "Riverudder", "Torrentail", "quad", "ears:round tail:fin whiskers", "spots", "fangs crystals"],
  [0, "Leafgrub", "Wrapleaf", "Verdawing", "bug", "worm antenna", "=cocoon", "=bug bigwings antenna"],
  [7, "Puffinch", "Galefinch", "Stormfalcon", "bird", "", "crest", "bigwings longtail"],
  [3, "Joltmouse", "Ampweasel", "Voltferret", "quad", "ears:round tail:bolt", "stripes", "mane spikes"],
  [4, "Rubblet", "Quarrox", "Monocrag", "rock", "", "arms", "legs crystals"],
  [6, "Shadelet", "Phantaur", "Umbraith", "ghost", "", "arms", "tail horns flames"],
  [1, "Cindertick", "Scorchpion", "Blazepede", "bug", "pincers", "stinger", "flames spikes"],
  [2, "Guppop", "Finnacle", "Marlinox", "fish", "", "hornnose stripes", "raywings fangs"],
  [5, "Rimehoot", "Glacihoot", "Blizzoot", "bird", "owl", "crest", "bigwings"],
  [5, "Flurrycub", "Sleetbear", "Avalanchor", "biped", "ears:round", "claws", "mane fangs tail:thin"],
  [4, "Dustworm", "Sandwyrm", "Dunedrake", "serpent", "stripes", "hood rattle", "horns spikes"],
  [7, "Mistlet", "Fogpuff", "Cumulord", "blob", "cloud", "bolts", "crown"],
  [6, "Nightflit", "Duskflap", "Eclipsewing", "bird", "batwings ears:point", "fangs", "bigwings crest"],
  [3, "Glimmerbug", "Flashfly", "Luminoth", "bug", "antenna:bolt stripes", "wings", "=bug bigwings antenna"],
  [0, "Mossling", "Fernguard", "Grovelord", "biped", "top:leaf", "thorns tail:leaf", "shell tusks claws"],
  [2, "Shellet", "Tortide", "Fortoise", "quad", "shell tail:stub", "ears:round crystals", "spikes horn"],
];
const DEX = [null];       // DEX[1] to DEX[57]
FAMILIES.forEach(function (family, f) {
  let looks = [];
  for (let stage = 0; stage < 3; stage++) {
    let shape = family[4];
    const extra = family[5 + stage];
    if (extra[0] === "=") {            // (this step of the family has a whole new shape, like a grub turning into a butterfly)
      shape = extra.slice(1).split(" ")[0];
      looks = extra.split(" ").slice(1);
    } else looks = looks.concat(extra.split(" ").filter(Boolean));
    DEX.push({ name: family[stage + 1], kind: family[0], family: f, stage: stage, shape: shape, looks: looks.slice() });
  }
});
// Two legendary Wildlings and one mythical one. They never evolve.
DEX.push({ name: "Marivane", kind: 2, family: 18, stage: 2, mystery: true, legend: true, shape: "serpent", looks: ["horns", "bigwings", "hood", "spikes"] });
DEX.push({ name: "Solarok", kind: 1, family: 19, stage: 2, mystery: true, legend: true, shape: "bird", looks: ["crest", "bigwings", "bolttail"] });
DEX.push({ name: "Whispera", kind: 7, family: 20, stage: 1, mystery: true, myth: true, shape: "biped", looks: ["wings", "top:star", "ears:long"] });
const TOTAL = DEX.length - 1;
const RIDE = { name: "Zephyrun", kind: 3, family: 21, stage: 2, shape: "quad", looks: ["ears:point", "tail:bushy", "mane", "horns", "stripes"] };       // the Wildling you ride
const GROW_AT = [12, 28];       // the levels where a Wildling changes into its next form
const familiesOf = KINDS.map((kind, k) => FAMILIES.map((family, f) => (family[0] === k ? f : -1)).filter((f) => f >= 0));
const idFor = (family, lv) => (family >= 18 ? 37 + family : family * 3 + 1 + (lv >= GROW_AT[1] ? 2 : lv >= GROW_AT[0] ? 1 : 0));

// ----- Numbers for battles -----
const maxHp = (c) => Math.round((20 + c.lv * (3 + DEX[c.id].stage * 0.8 + (DEX[c.id].family % 3) * 0.3)) * (c.big || 1));      // ("big" is for giant Elder Wildlings)
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
  const kind = DEX[c.id].kind;
  const list = [{ name: "Bonk", kind: -1, power: 5, sure: 1 }, { name: MOVES[kind][0], kind: kind, power: 8, sure: 0.95 }];
  if (c.lv >= 10) list.push({ name: MOVES[kind][1], kind: kind, power: 12, sure: 0.8 });
  return list;
}
const effect = (from, to) => (from < 0 ? 1 : STRONG[from].includes(to) ? 2 : from === to || STRONG[to].includes(from) ? 0.5 : 1);

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
// A Wildling's four colours: an outline, a second colour for its markings, its body, and a highlight
function coloursOf(info) {
  const body = turnHue(KIND_COLOUR[info.kind], ((info.family * 47) % 40) - 20);
  const second = info.family % 2 ? blend(turnHue(body, 70), "#000000", 0.2) : blend(body, "#000000", 0.36);
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
  done.side = ["quad", "bird", "fish", "serpent"].includes(info.shape) || (info.shape === "bug" && !f.bigwings);       // (drawn from the side, facing left)
  return done;
}
const pictures = [];
const picture = (id) => pictures[id] || (pictures[id] = drawWildling(DEX[id]));
let ridePicture = null;
const rideArt = () => ridePicture || (ridePicture = drawWildling(RIDE));
