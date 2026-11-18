// The Kova region: seven towns and places joined by seven routes, a cave, and some secret corners.
// The map is one big grid of squares. This file builds it, and draws the pictures for every kind of square.

const MW = 112, MH = 98, TS = 16;
const GRASS = 0, TALL = 1, PATH = 2, TREE = 3, WATER = 4, WALL = 5, DOOR = 6, FENCE = 7, FLOWER = 8, CAVE = 9, ROCK = 10, PLAZA = 11, SIGN = 12, GATE = 13;
const BLOCKS = [TREE, WATER, WALL, FENCE, ROCK, SIGN];        // squares you can't walk onto
const map = new Uint8Array(MW * MH).fill(TREE);
const tile = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? TREE : map[y * MW + x]);
const put = (x, y, kind) => (map[y * MW + x] = kind);
function fill(x0, y0, x1, y1, kind) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, kind);
}
// A repeatable "random" number for a square
function chance(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const key = (x, y) => x + "," + y;
const doors = {}, signs = {}, gates = {}, steps = {};       // special squares, looked up by "x,y"
const buildings = [], people = [], trainers = [], legends = [], areas = [];

function town(name, x0, y0, x1, y1, px, py) {
  fill(x0, y0, x1, y1, GRASS);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (chance(x, y, 1) < 0.07) put(x, y, FLOWER);
  fill(px, y0, px + 1, y1, PLAZA);
  fill(x0, py, x1, py + 1, PLAZA);
  put(px + 2, py - 1, SIGN);
  signs[key(px + 2, py - 1)] = name.toUpperCase();
  areas.push({ name: name, x0: x0, y0: y0, x1: x1, y1: y1, town: true });
}
function route(name, x0, y0, x1, y1, across, mid, wild) {
  fill(x0, y0, x1, y1, GRASS);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const off = across ? Math.min(Math.abs(y - mid), Math.abs(y - mid - 1)) : Math.min(Math.abs(x - mid), Math.abs(x - mid - 1));
    if (off === 0) put(x, y, PATH);
    else if (off >= 2 && chance(x, y, 2) < 0.07) put(x, y, TREE);
    else if (chance(Math.floor(x / 3), Math.floor(y / 2), 3) < 0.55) put(x, y, TALL);
    else if (chance(x, y, 1) < 0.05) put(x, y, FLOWER);
  }
  areas.push({ name: name, x0: x0, y0: y0, x1: x1, y1: y1, wild: wild });
}
function building(kind, x, y, w, h, more) {
  fill(x, y, x + w - 1, y + h - 1, WALL);
  const dx = x + Math.floor(w / 2), dy = y + h - 1;
  put(dx, dy, DOOR);
  doors[key(dx, dy)] = Object.assign({ kind: kind }, more);
  if (tile(dx, dy + 1) !== PLAZA) put(dx, dy + 1, PATH);
  buildings.push({ kind: kind, x: x, y: y, w: w, h: h });
}
function gate(x, y, needs) {
  put(x, y, GATE);
  gates[key(x, y)] = needs;
}
function trainer(id, name, look, x, y, dir, team, before, after) {
  put(x, y, GRASS);
  trainers.push({ id: id, name: name, look: look, x: x, y: y, dir: dir, team: team, before: before, after: after, sight: 4 });
}
function person(look, x, y, dir, text) {
  if (tile(x, y) === TREE || tile(x, y) === TALL) put(x, y, GRASS);
  people.push({ look: look, x: x, y: y, dir: dir, text: text });
}
function usualTown(x0, y0, px, py, gym, heal) {
  building("heal", x0 + 2, py - 5, 5, 4, heal);
  building("mart", px + 4, py - 5, 5, 4, {});
  if (gym) building("gym", x0 + 2, py + 3, 6, 5, gym);
}

// ----- Building the region -----
// Wild Beastlings for each place: [which one, lowest level, highest level, how common]
town("Pebble Town", 10, 78, 29, 91, 19, 84);
building("home", 12, 80, 4, 3, {});
building("lab", 23, 79, 6, 4, {});
building("house", 12, 87, 4, 3, { text: "Gran: I caught a Nibbit once. It ate my slippers." });
building("house", 23, 87, 4, 3, { text: "Fisherman: They say three legendary Beastlings sleep in secret corners of Kova." });
route("Route 1", 16, 62, 23, 77, false, 19, [[10, 2, 4, 4], [12, 2, 4, 3], [15, 2, 3, 3]]);
town("Fernside City", 10, 46, 29, 61, 19, 53);
usualTown(10, 46, 19, 53, { n: 0, leader: "Leader Fennel", badge: "Sprout Badge", team: [[15, 8], [22, 10]], before: "Fennel: My leafy friends and I have been waiting. Show me what you've got!", after: "Fennel: You've grown like a weed! Take the Sprout Badge." });
building("house", 23, 56, 4, 3, { text: "Boy: Leaf moves are great against Aqua and Rock kinds. Flame burns Leaf, though!" });
route("Route 2", 30, 50, 51, 57, true, 53, [[18, 6, 8, 3], [20, 6, 9, 3], [22, 6, 8, 3], [12, 7, 9, 2], [24, 7, 9, 1]]);
town("Brinewater Town", 52, 46, 71, 61, 61, 53);
usualTown(52, 46, 61, 53, { n: 1, leader: "Leader Marlo", badge: "Tide Badge", team: [[24, 13], [27, 14], [20, 16]], before: "Marlo: The tide waits for no one! Let's make a splash!", after: "Marlo: Washed away! The Tide Badge is yours." });
fill(64, 57, 70, 60, WATER);
route("Route 3", 58, 28, 65, 45, false, 61, [[37, 14, 17, 3], [39, 14, 17, 3], [41, 14, 17, 3], [22, 14, 16, 2], [13, 15, 17, 2], [1, 14, 15, 1]]);
town("Emberfall City", 52, 12, 71, 27, 61, 19);
usualTown(52, 12, 61, 19, { n: 2, leader: "Leader Ashlyn", badge: "Ember Badge", team: [[37, 20], [39, 21], [38, 24]], before: "Ashlyn: Can you take the heat? My Flame kinds burn bright!", after: "Ashlyn: You put my fire out! Here: the Ember Badge." });
building("house", 65, 22, 4, 3, { text: "Girl: Aqua moves put out Flame kinds. Rock moves work too!" });
route("Route 4", 30, 16, 51, 23, true, 19, [[43, 19, 23, 3], [45, 19, 23, 3], [48, 19, 22, 3], [13, 20, 23, 2], [61, 20, 22, 1], [4, 19, 20, 1]]);
town("Galewood Town", 10, 12, 29, 27, 19, 19);
usualTown(10, 12, 19, 19, { n: 3, leader: "Leader Zeph", badge: "Gale Badge", team: [[44, 26], [13, 27], [46, 29]], before: "Zeph: Hold on to your hat! My team strikes like a storm!", after: "Zeph: Blown away... Take the Gale Badge, you earned it." });
building("house", 23, 22, 4, 3, { text: "Old man: There's a meadow north of Route 4 where the thunder never stops..." });
route("Route 5", 72, 16, 91, 23, true, 19, [[50, 24, 28, 3], [53, 24, 28, 3], [55, 24, 28, 3], [63, 25, 27, 1], [7, 24, 25, 1]]);
town("Frostpeak City", 92, 10, 109, 27, 100, 19);
usualTown(92, 10, 100, 19, { n: 4, leader: "Leader Isolde", badge: "Frost Badge", team: [[54, 32], [56, 33], [51, 34], [52, 36]], before: "Isolde: Welcome to the coldest gym in Kova. Try not to freeze up.", after: "Isolde: You melted my defences. The Frost Badge is yours." });
building("house", 104, 22, 4, 3, { text: "Climber: Something huge with antlers lives on the summit north of here." });
route("Route 6", 72, 50, 91, 57, true, 53, [[57, 28, 33, 3], [46, 30, 34, 2], [51, 30, 34, 2], [35, 30, 34, 2], [62, 30, 32, 1], [60, 30, 32, 1]]);
town("Champion's Rise", 92, 46, 109, 61, 100, 53);
building("hall", 96, 47, 9, 5, {});
building("heal", 94, 56, 5, 4, {});
route("Route 7", 30, 81, 51, 88, true, 84, [[24, 10, 12, 3], [27, 10, 13, 3], [20, 10, 12, 2], [10, 10, 12, 2]]);
// Hollow Cave: dark, rocky, and full of Beastlings wherever you step
fill(52, 76, 71, 93, ROCK);
for (let y = 77; y <= 92; y++) for (let x = 53; x <= 70; x++) if (y === 84 || y === 85 || chance(Math.floor(x / 2), Math.floor(y / 2), 5) > 0.24) put(x, y, CAVE);
fill(52, 84, 52, 85, CAVE);
fill(71, 84, 71, 85, CAVE);
areas.push({ name: "Hollow Cave", x0: 52, y0: 76, x1: 71, y1: 93, cave: true, wild: [[29, 12, 16, 3], [32, 12, 16, 3], [34, 13, 16, 2], [41, 14, 16, 2], [64, 15, 16, 1]] });
// The Old Shrine, beyond the cave
fill(72, 80, 85, 89, GRASS);
for (let y = 80; y <= 89; y++) for (let x = 72; x <= 85; x++) if (chance(x, y, 1) < 0.12) put(x, y, FLOWER);
fill(72, 84, 79, 85, PATH);
fill(78, 82, 83, 87, PLAZA);
areas.push({ name: "The Old Shrine", x0: 72, y0: 80, x1: 85, y1: 89, town: true });
legends.push({ id: 65, lv: 40, x: 81, y: 84 });
// Thunder Meadow, north of Route 4
fill(36, 4, 45, 13, GRASS);
for (let y = 4; y <= 13; y++) for (let x = 36; x <= 45; x++) if (chance(x, y, 1) < 0.15) put(x, y, FLOWER);
fill(40, 9, 41, 15, PATH);
areas.push({ name: "Thunder Meadow", x0: 36, y0: 4, x1: 45, y1: 13, town: true });
legends.push({ id: 67, lv: 45, x: 40, y: 7 });
// The Frozen Summit, north of Frostpeak
fill(96, 2, 105, 7, PLAZA);
fill(100, 6, 101, 9, PATH);
areas.push({ name: "The Frozen Summit", x0: 96, y0: 2, x1: 105, y1: 7, town: true });
legends.push({ id: 66, lv: 50, x: 100, y: 4 });
// Moonlit Glade, south of Pebble Town: nobody has ever got in...
fill(16, 93, 23, 96, GRASS);
for (let y = 93; y <= 96; y++) for (let x = 16; x <= 23; x++) if (chance(x, y, 1) < 0.3) put(x, y, FLOWER);
fill(19, 92, 20, 93, PATH);
areas.push({ name: "Moonlit Glade", x0: 16, y0: 93, x1: 23, y1: 96, town: true });
legends.push({ id: 68, lv: 30, x: 19, y: 95, myth: true });
fill(40, 16, 41, 18, GRASS);        // (keep the way from Route 4 up to the meadow clear)
// Guards: they only let you past with enough badges
for (let y = 81; y <= 88; y++) put(51, y, TREE);
gate(51, 84, 2);
gate(51, 85, 2);
gate(40, 15, 4);
gate(41, 15, 4);
gate(100, 9, 5);
gate(101, 9, 5);
for (let y = 50; y <= 57; y++) put(91, y, TREE);
gate(91, 53, 5);
gate(91, 54, 5);
gate(19, 92, 9);        // (9 means: only the Champion may pass)
gate(20, 92, 9);
// Things that happen when you step on a square
for (let x = 16; x <= 23; x++) steps[key(x, 77)] = "starter";
for (let x = 16; x <= 23; x++) steps[key(x, 64)] = "rival1";
for (let y = 50; y <= 57; y++) steps[key(84, y)] = "rival2";
// Trainers on the routes: they battle you when they see you
trainer("t1", "Youngster Tam", 1, 17, 72, 2, [[10, 3]], "Tam: I just got my first Beastling! Battle me!", "Tam: Aw. I'll train harder.");
trainer("t2", "Lass Mina", 2, 22, 67, 1, [[12, 4], [15, 3]], "Mina: Our eyes met, so we have to battle!", "Mina: You're pretty good!");
trainer("t3", "Bug Fan Ori", 3, 36, 51, 0, [[15, 7], [18, 8]], "Ori: Bugs are the best! I'll prove it!", "Ori: My poor bugs...");
trainer("t4", "Camper Dell", 1, 44, 56, 3, [[20, 9], [10, 9]], "Dell: Halt! Nobody passes without a battle!", "Dell: OK, OK, you can pass.");
trainer("t5", "Hiker Brom", 4, 59, 40, 2, [[29, 15], [41, 16]], "Brom: These rocks and I go way back.", "Brom: Solid work, kid.");
trainer("t6", "Picnicker Suze", 2, 64, 34, 1, [[22, 16], [37, 16]], "Suze: Lunch can wait. Battle time!", "Suze: Now I've lost my appetite.");
trainer("t7", "Kite Flyer Wen", 3, 45, 17, 0, [[43, 21], [13, 21]], "Wen: The wind is perfect for a battle!", "Wen: You blew me away.");
trainer("t8", "Rancher Hale", 4, 36, 22, 3, [[48, 22], [45, 23]], "Hale: My Beastlings are farm-strong!", "Hale: Well, I'll be.");
trainer("t9", "Skier Nix", 1, 78, 17, 0, [[50, 26], [53, 26]], "Nix: Brrr! A battle will warm us up!", "Nix: I'm still cold.");
trainer("t10", "Boarder Jett", 3, 86, 22, 3, [[55, 27], [51, 28]], "Jett: Check out these moves!", "Jett: Wipeout!");
trainer("t11", "Ace Lune", 2, 77, 51, 0, [[57, 31], [46, 32], [25, 32]], "Lune: Only the best walk this road.", "Lune: ...And you are one of them.");
trainer("t12", "Ace Sol", 4, 88, 56, 3, [[52, 34], [38, 34], [14, 34]], "Sol: The Champion is just ahead. Are you ready?", "Sol: You're ready.");
trainer("t13", "Fisher Pau", 4, 38, 82, 0, [[24, 11], [27, 12]], "Pau: I fish them up, I battle with them!", "Pau: Back to the pond for me.");
trainer("t14", "Explorer Ines", 2, 46, 87, 3, [[29, 13], [32, 13]], "Ines: The cave ahead is full of treasures. And me!", "Ines: Mind the dark in there.");
person(5, 17, 86, 0, "Girl: Tall grass is where wild Beastlings hide. Weaken one, then throw a Snare Orb!");
person(6, 22, 82, 0, "Man: Prof. Maple's lab is the big building here. She gives new trainers a Beastling!");
person(5, 24, 52, 1, "Woman: The house with the + heals your team for free. The $ house sells things.");
person(6, 58, 52, 2, "Sailor: East of here is Route 6 and Champion's Rise. You'll need all five badges to get in.");
person(5, 57, 21, 2, "Kid: Beastlings evolve when they reach a high enough level. Mine just did!");
person(6, 15, 21, 0, "Woman: Press ENTER to open the menu. Don't forget to SAVE!");
person(5, 97, 21, 2, "Man: Ice moves are strong against Leaf and Sky kinds.");
person(6, 98, 55, 2, "Guard: Beyond that door, Champion Aurelia waits. Heal up first!");

// Which place is this square in? (The last match wins, so small places sit on top of big ones.)
function areaAt(x, y) {
  let found = null;
  for (const area of areas) if (x >= area.x0 && x <= area.x1 && y >= area.y0 && y <= area.y1) found = area;
  return found;
}

// ----- Pictures -----
// "dot" paints a little rectangle. Its colour is a drawing shade (0 to 3), which gets swapped for a real colour
// later, or a colour written out in full, which stays exactly as it is.
function board(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  const dot = (x, y, wide, tall, shade) => {
    g.fillStyle = typeof shade === "string" ? shade : PAL[shade];
    g.fillRect(x, y, wide, tall);
  };
  draw(dot, g);
  return c;
}
const LINE = "#20203a";         // the dark outline colour used everywhere
const grassBits = (dot) => {
  dot(0, 0, 16, 16, 3);
  for (const [x, y] of [[2, 3], [10, 2], [6, 8], [13, 10], [3, 13], [9, 14]]) { dot(x, y, 1, 2, 2); dot(x + 1, y + 1, 1, 1, 2); }
};
const BASE = [];
BASE[GRASS] = board(16, 16, grassBits);
BASE[TALL] = board(16, 16, function (dot) {
  dot(0, 0, 16, 16, 2);
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    const x = col * 8 + (row ? 4 : 0), y = row * 8;
    for (const [ax, ay, tall] of [[0, 3, 5], [2, 1, 7], [4, 3, 5], [6, 2, 6]]) dot((x + ax) % 16, y + ay, 1, tall, 0);
    dot((x + 1) % 16, y + 4, 1, 4, 1);
    dot((x + 3) % 16, y + 3, 1, 5, 1);
    dot((x + 5) % 16, y + 4, 1, 4, 1);
    dot((x + 2) % 16, y + 1, 1, 1, 3);
  }
});
BASE[PATH] = board(16, 16, function (dot) {
  dot(0, 0, 16, 16, 3);
  for (const [x, y] of [[4, 5], [12, 11], [9, 2], [2, 13]]) dot(x, y, 2, 1, 2);
});
BASE[TREE] = board(16, 16, function (dot) {
  dot(0, 0, 16, 16, 3);
  dot(4, 0, 8, 1, 0);
  dot(2, 1, 12, 1, 0);
  dot(1, 2, 14, 8, 0);
  dot(2, 10, 12, 1, 0);
  dot(4, 11, 8, 1, 0);
  dot(4, 1, 8, 1, 1);
  dot(2, 2, 12, 8, 1);
  dot(4, 10, 8, 1, 1);
  for (const [x, y, wide] of [[4, 2, 3], [9, 3, 3], [3, 5, 2], [7, 6, 3], [11, 6, 2]]) { dot(x, y, wide, 1, 2); dot(x, y + 1, wide - 1, 1, 2); }
  dot(6, 12, 4, 3, "#4a3020");
  dot(7, 12, 2, 3, "#8a5a30");
  dot(3, 15, 10, 1, 2);
});
BASE[WATER] = [0, 1].map((frame) => board(16, 16, function (dot) {
  dot(0, 0, 16, 16, 2);
  for (const [x, y] of [[1, 3], [9, 6], [4, 11], [12, 14]]) { dot((x + frame * 3) % 16, y, 4, 1, 3); dot((x + frame * 3 + 1) % 16, y + 1, 2, 1, 1); }
}));
BASE[WALL] = BASE[DOOR] = BASE[GATE] = BASE[PATH];
BASE[FENCE] = board(16, 16, function (dot) {
  grassBits(dot);
  dot(0, 6, 16, 2, "#6a4428");
  dot(0, 11, 16, 2, "#6a4428");
  dot(3, 3, 3, 12, "#6a4428");
  dot(11, 3, 3, 12, "#6a4428");
  dot(4, 4, 1, 10, "#b88850");
  dot(12, 4, 1, 10, "#b88850");
});
BASE[FLOWER] = [0, 1].map((frame) => board(16, 16, function (dot) {
  grassBits(dot);
  [[4, 5, "#f05888"], [11, 10, "#f8f8f8"]].forEach(function ([x, y, petal], n) {
    const sway = (frame + n) % 2;
    dot(x + sway, y + 2, 1, 3, "#3a8a3a");
    dot(x - 1 + sway, y, 3, 1, petal);
    dot(x + sway, y - 1, 1, 3, petal);
    dot(x + sway, y, 1, 1, "#f8d030");
  });
}));
BASE[CAVE] = board(16, 16, function (dot) {
  dot(0, 0, 16, 16, 2);
  for (const [x, y] of [[2, 3], [10, 2], [6, 9], [13, 12], [3, 13]]) dot(x, y, 2, 1, 1);
});
BASE[ROCK] = board(16, 16, function (dot) {
  dot(0, 0, 16, 16, 0);
  dot(1, 2, 6, 5, 1);
  dot(9, 1, 6, 4, 1);
  dot(8, 8, 7, 6, 1);
  dot(1, 10, 5, 5, 1);
  dot(2, 3, 3, 1, 2);
  dot(10, 2, 3, 1, 2);
  dot(9, 9, 3, 1, 2);
  dot(2, 11, 2, 1, 2);
});
BASE[PLAZA] = board(16, 16, function (dot) {
  dot(0, 0, 16, 16, 3);
  dot(0, 7, 16, 1, 2);
  dot(0, 15, 16, 1, 2);
  dot(7, 0, 1, 7, 2);
  dot(15, 8, 1, 7, 2);
});
BASE[SIGN] = board(16, 16, function (dot) {
  grassBits(dot);
  dot(2, 3, 12, 8, "#5a3a20");
  dot(3, 4, 10, 6, "#e8c888");
  dot(5, 6, 6, 1, "#5a3a20");
  dot(5, 8, 4, 1, "#5a3a20");
  dot(7, 11, 2, 4, "#5a3a20");
});
// Four looks for the land: green fields, snowy north-east, dry autumn hills, and breezy yellow plains
const THEMES = [
  { bg: "#90d860", mark: "#6cc048", tall: ["#1f6a2a", "#389038", "#58b048"], path: "#e8d8a0", pathDot: "#cdb276", tree: ["#184a28", "#2f8a3c", "#5cba58"], plaza: "#e4dccc", plazaLine: "#bab2a2", ground: "#a8e078" },
  { bg: "#f0f8ff", mark: "#c4d8ee", tall: ["#4a80a0", "#78a8c4", "#a8cce0"], path: "#dce6f2", pathDot: "#b4c6da", tree: ["#1a4a48", "#3a8a7c", "#f0f8ff"], plaza: "#e8f0f8", plazaLine: "#b8c8d8", ground: "#d8ecf8" },
  { bg: "#ecc880", mark: "#d4a860", tall: ["#784820", "#a06830", "#c89048"], path: "#f4dcb0", pathDot: "#dab884", tree: ["#5a2a18", "#c05828", "#ec9038"], plaza: "#ecd4b4", plazaLine: "#c4a484", ground: "#e8c078" },
  { bg: "#bce474", mark: "#98c850", tall: ["#487818", "#689828", "#88b840"], path: "#ecdca0", pathDot: "#d0bc78", tree: ["#2a5a20", "#5a9a30", "#a0d058"], plaza: "#e8dcc0", plazaLine: "#c0b494", ground: "#c8e888" },
];
const themeAt = (x, y) => (x >= 72 && y <= 29 ? 1 : x >= 48 && x <= 71 && y <= 45 ? 2 : x <= 47 && y <= 29 ? 3 : 0);
const TILE_ART = THEMES.map(function (t) {
  const grass = [LINE, LINE, t.mark, t.bg];
  const colours = [];
  colours[GRASS] = colours[FENCE] = colours[FLOWER] = colours[SIGN] = grass;
  colours[TALL] = [t.tall[0], t.tall[1], t.tall[2], t.bg];
  colours[PATH] = colours[WALL] = colours[DOOR] = colours[GATE] = [LINE, LINE, t.pathDot, t.path];
  colours[TREE] = [t.tree[0], t.tree[1], t.tree[2], t.bg];
  colours[WATER] = [LINE, "#2868c0", "#4890e8", "#b0d8f8"];
  colours[CAVE] = [LINE, "#6a6088", "#8a80a0", "#8a80a0"];
  colours[ROCK] = ["#2a2440", "#4a4268", "#6a6290", "#6a6290"];
  colours[PLAZA] = [LINE, LINE, t.plazaLine, t.plaza];
  return BASE.map((art, kind) => (Array.isArray(art) ? art.map((frame) => recolour(frame, colours[kind])) : recolour(art, colours[kind])));
});
// Each building gets its own picture: a tiled roof, a wall with windows, a door, and a sign saying what it is
const ROOFS = { home: ["#e05858", "#a83030"], heal: ["#f07898", "#c04868"], mart: ["#5888e8", "#3058b0"], gym: ["#f0a838", "#b87018"], lab: ["#98a8b8", "#687888"], hall: ["#9868d0", "#6840a0"] };
const HOUSE_ROOFS = [["#e05858", "#a83030"], ["#60b070", "#388048"], ["#c89058", "#906030"], ["#6898d8", "#4068a8"]];
const BADGE = { heal: "+", mart: "$", gym: "G", lab: "L", hall: "C" };
for (const b of buildings) {
  const [roofColour, roofLine] = ROOFS[b.kind] || HOUSE_ROOFS[Math.floor(chance(b.x, b.y, 7) * 4)];
  b.img = board(b.w * TS, b.h * TS, function (dot, g) {
    const w = b.w * TS, h = b.h * TS, roof = h - 26;
    dot(0, 0, w, h, LINE);
    dot(1, 1, w - 2, roof - 1, roofColour);
    dot(1, 1, w - 2, 2, blend(roofColour, "#ffffff", 0.35));
    for (let y = 5; y < roof - 1; y += 4) dot(1, y, w - 2, 1, roofLine);
    for (let x = 6; x < w - 2; x += 8) for (let y = 1; y < roof - 1; y += 8) dot(x, y + 2, 1, 3, roofLine);
    dot(1, roof - 2, w - 2, 2, roofLine);
    dot(1, roof, w - 2, h - roof - 1, "#f8f0d8");
    dot(1, roof, w - 2, 3, "#dccfa8");
    dot(1, h - 4, w - 2, 3, "#c8bc98");
    const door = Math.floor(b.w / 2) * TS;
    for (let x = 4; x < w - 10; x += TS) if (Math.abs(x - door) > 10) {
      dot(x, roof + 7, 9, 9, LINE);
      dot(x + 1, roof + 8, 7, 7, "#88c8f8");
      dot(x + 1, roof + 8, 7, 2, "#d0ecff");
      dot(x + 4, roof + 8, 1, 7, LINE);
      dot(x + 1, roof + 11, 7, 1, LINE);
      dot(x - 1, roof + 16, 11, 1, roofLine);
    }
    dot(door + 2, h - 17, 12, 16, LINE);
    dot(door + 3, h - 16, 10, 15, b.kind === "house" || b.kind === "home" ? "#a06838" : "#d8ecf8");
    dot(door + 3, h - 16, 10, 2, b.kind === "house" || b.kind === "home" ? "#c08850" : "#ffffff");
    dot(door + 10, h - 8, 1, 2, "#f8d030");
    if (b.kind === "home" || b.kind === "house") { dot(w - 12, 0, 7, 9, LINE); dot(w - 11, 1, 5, 8, "#b86848"); }
    if (BADGE[b.kind]) {
      dot(w / 2 - 8, 3, 16, 14, LINE);
      dot(w / 2 - 7, 4, 14, 12, "#ffffff");
      if (b.kind === "heal") { dot(w / 2 - 1, 6, 3, 8, "#e03048"); dot(w / 2 - 4, 9, 9, 3, "#e03048"); } else {
        g.fillStyle = roofLine;
        g.font = "8px \"Press Start 2P\", monospace";
        g.textAlign = "center";
        g.textBaseline = "top";
        g.fillText(BADGE[b.kind], w / 2 + 0.5, 6);
      }
    }
  });
}
// ----- People -----
// A person is drawn from a "look": skin, hair, hat and clothes. The same code draws you and everyone else.
const LOOK_PARTS = {
  skin: ["#fce0c0", "#f4c898", "#dba878", "#b98058", "#8a5a3a", "#5c3b28"],
  hair: ["short", "long", "bob", "spiky", "bald"],
  hairColour: ["#2a2030", "#5a3a20", "#a86a30", "#e8c050", "#e04838", "#3aa8e8", "#f078b8", "#8a5ad8", "#f0f0f0"],
  hat: ["none", "cap", "beanie"],
  hatColour: ["#e03838", "#3868d8", "#38a858", "#f8d030", "#f8f8f8", "#2a2030", "#f078b8"],
  shirt: ["#e03838", "#3868d8", "#38a858", "#f8d030", "#f8f8f8", "#2a2030", "#f078b8", "#8a5ad8", "#f09030", "#38b8c8"],
  trousers: ["#3a5a9a", "#2a2030", "#8a6a4a", "#d8d0c0", "#4a7a4a", "#8a2a3a"],
};
const LOOK_ROWS = [["skin", "Skin"], ["hair", "Hair"], ["hairColour", "Hair col."], ["hat", "Hat"], ["hatColour", "Hat col."], ["shirt", "Top"], ["trousers", "Trousers"]];
const lookOf = (skin, hair, hairColour, hat, hatColour, shirt, trousers) => ({ skin: skin, hair: hair, hairColour: hairColour, hat: hat, hatColour: hatColour, shirt: shirt, trousers: trousers });
// Looks for other people: 1 to 4 are trainers, 5 and 6 are townsfolk, 7 is a guard
const NPC_LOOKS = [lookOf(1, 0, 1, 1, 0, 0, 0), lookOf(1, 0, 1, 1, 1, 3, 0), lookOf(0, 1, 3, 0, 0, 6, 5), lookOf(3, 3, 0, 0, 0, 2, 2), lookOf(2, 0, 0, 2, 5, 8, 1), lookOf(0, 2, 2, 0, 0, 9, 3), lookOf(4, 4, 0, 0, 0, 4, 0), lookOf(1, 0, 0, 1, 1, 1, 1)];
const peopleDrawn = new Map();
function personArt(look) {
  const name = JSON.stringify(look);
  if (peopleDrawn.has(name)) return peopleDrawn.get(name);
  const part = (which) => LOOK_PARTS[which][look[which] % LOOK_PARTS[which].length];
  const skin = part("skin"), hair = part("hairColour"), style = part("hair"), hat = part("hat"), hatColour = part("hatColour"), shirt = part("shirt"), trousers = part("trousers");
  const draw = (dir, step) => board(16, 16, function (dot) {
    const side = dir === 1 || dir === 2;
    dot(4, 1, 8, 8, LINE);                                   // head
    dot(5, 2, 6, 6, skin);
    if (style !== "bald") {
      dot(4, 1, 8, 3, hair);
      if (dir === 3) dot(5, 2, 6, 6, hair);                  // seen from behind: all hair
      else if (side) dot(9, 3, 3, 5, hair);
      else { dot(4, 4, 1, 2, hair); dot(11, 4, 1, 2, hair); }
      if (style === "long") { dot(3, 3, 2, 8, hair); dot(11, 3, 2, 8, hair); if (dir === 3) dot(4, 8, 8, 3, hair); }
      if (style === "bob") { dot(3, 2, 2, 6, hair); dot(11, 2, 2, 6, hair); }
      if (style === "spiky" && hat === "none") for (const x of [4, 6, 8, 10]) { dot(x, 0, 2, 1, hair); dot(x + (x % 4 ? 1 : 0), -1 + 1, 1, 1, hair); }
    }
    if (hat === "cap") {
      dot(4, 1, 8, 3, hatColour);
      dot(4, 1, 8, 1, blend(hatColour, "#ffffff", 0.4));
      if (dir === 0) dot(4, 4, 8, 1, blend(hatColour, "#000000", 0.35));
      if (side) dot(2, 3, 3, 1, blend(hatColour, "#000000", 0.35));
    }
    if (hat === "beanie") { dot(4, 0, 8, 4, hatColour); dot(4, 3, 8, 1, blend(hatColour, "#000000", 0.3)); dot(7, -1 + 1, 2, 1, "#f8f8f8"); }
    if (dir === 0) { dot(6, 5, 1, 2, LINE); dot(9, 5, 1, 2, LINE); }
    if (side) { dot(5, 5, 1, 2, LINE); }
    dot(3, 9, 10, 5, LINE);                                  // body
    dot(4, 9, 8, 4, shirt);
    dot(4, 12, 8, 1, blend(shirt, "#000000", 0.25));
    dot(3, 10, 1, 2, shirt);
    dot(12, 10, 1, 2, shirt);
    dot(3, 12, 1, 1, skin);
    dot(12, 12, 1, 1, skin);
    const lift = step ? 1 : 0;                               // legs take turns to step
    dot(5, 13, 2, 3 - lift, trousers);
    dot(9, 13, 2, 2 + lift, trousers);
    dot(5, 15 - lift, 2, 1, LINE);
    dot(9, 14 + lift, 2, 1, LINE);
  });
  const flip = (art) => board(16, 16, function (dot, g) {
    g.translate(16, 0);
    g.scale(-1, 1);
    g.drawImage(art, 0, 0);
  });
  const frames = [0, 1, 2, 3].map((dir) => [0, 1].map((step) => (dir === 2 ? flip(draw(1, step)) : draw(dir, step))));
  peopleDrawn.set(name, frames);
  return frames;
}

// ----- Inside the buildings -----
// Each kind of building has a room, drawn from a little plan. In the plans:
// # wall, W window, . floor, C counter, M doormat (the way out), T table, S shelf, P plant, B bed, H machine, R rug, X statue
const ROOM_PLANS = {
  heal: ["#W######W#", "#PH....SS#", "#CCCCCCCC#", "#........#", "#.RRRRRR.#", "#.RRRRRR.#", "#P......P#", "#........#", "####MM####"],
  mart: ["#W######W#", "#......SS#", "#CCCCCCCC#", "#........#", "#.SS..SS.#", "#.SS..SS.#", "#........#", "#P......P#", "####MM####"],
  home: ["#W##W###W#", "#BB....SS#", "#BB......#", "#........#", "#.....TT.#", "#.RR..TT.#", "#.RR....P#", "#........#", "####MM####"],
  house: ["#W######W#", "#SS....PB#", "#........#", "#........#", "#.TT.....#", "#.TT..RR.#", "#P....RR.#", "#........#", "####MM####"],
  lab: ["#W##W###W#", "#SSS.HH.S#", "#........#", "#..TTT...#", "#........#", "#S......S#", "#S..RR..S#", "#...RR...#", "####MM####"],
  gym: ["##########", "#X......X#", "#........#", "#X.RRRR.X#", "#..RRRR..#", "#X.RRRR.X#", "#..RRRR..#", "#........#", "####MM####"],
  hall: ["##########", "#X..RR..X#", "#...RR...#", "#X..RR..X#", "#...RR...#", "#X..RR..X#", "#...RR...#", "#...RR...#", "####MM####"],
};
const ROOM_NAMES = { heal: "Rest Stop", mart: "Shop", home: "Your house", house: "House", lab: "Prof. Maple's Lab", gym: "Gym", hall: "Champion's Hall" };
// Who you find inside, and where they stand (always straight ahead of the door, so they are easy to find)
const ROOM_STAFF = {
  heal: { x: 4, y: 1, look: lookOf(0, 2, 6, 0, 0, 4, 3) }, mart: { x: 4, y: 1, look: lookOf(2, 0, 0, 1, 1, 1, 1) }, home: { x: 4, y: 3, look: lookOf(1, 2, 1, 0, 0, 6, 0) },
  house: { x: 4, y: 3, look: lookOf(3, 0, 8, 0, 0, 2, 2) }, lab: { x: 4, y: 2, look: lookOf(1, 1, 2, 0, 0, 4, 2) }, gym: { x: 4, y: 1, look: lookOf(1, 0, 0, 0, 0, 0, 0) }, hall: { x: 4, y: 1, look: lookOf(1, 1, 7, 0, 0, 7, 1) },
};
const LEADER_LOOKS = [lookOf(0, 1, 3, 0, 0, 2, 4), lookOf(2, 0, 5, 0, 0, 1, 0), lookOf(1, 3, 4, 0, 0, 8, 1), lookOf(3, 3, 8, 0, 0, 9, 3), lookOf(0, 1, 8, 2, 4, 4, 0)];
const LEADER_KINDS = [1, 3, 2, 7, 6];        // each gym is decorated in the colour of its leader's favourite kind
function roomColours(door) {
  if (door.kind === "heal") return { floor: "#fce8ec", floor2: "#f0d0d8", wall: "#fff4f4", trim: "#f07898", rug: "#f8b0c0", rug2: "#f07898", tiled: true };
  if (door.kind === "mart") return { floor: "#e4f0fc", floor2: "#c8dcf0", wall: "#f0f8ff", trim: "#5888e8", rug: "#a8c8f8", rug2: "#5888e8", tiled: true };
  if (door.kind === "lab") return { floor: "#e8ecf0", floor2: "#c8d0d8", wall: "#f0f4f8", trim: "#98a8b8", rug: "#b8e0c0", rug2: "#68b080", tiled: true };
  if (door.kind === "hall") return { floor: "#e8dcf8", floor2: "#c8b4e8", wall: "#f4eefc", trim: "#f8d030", rug: "#d83848", rug2: "#f8d030", tiled: true };
  if (door.kind === "gym") {
    const colour = KIND_COLOUR[LEADER_KINDS[door.n]];
    return { floor: blend(colour, "#ffffff", 0.66), floor2: blend(colour, "#ffffff", 0.4), wall: "#f0f0ec", trim: blend(colour, "#000000", 0.25), rug: colour, rug2: blend(colour, "#000000", 0.3), tiled: true };
  }
  return { floor: "#e4b878", floor2: "#c89858", wall: "#f8f0d8", trim: "#c08850", rug: "#e86868", rug2: "#b83838", tiled: false };
}
const roomsDrawn = new Map();
function roomPicture(door) {
  const name = door.kind + (door.n == null ? "" : door.n);
  if (roomsDrawn.has(name)) return roomsDrawn.get(name);
  const plan = ROOM_PLANS[door.kind], c = roomColours(door);
  const art = board(160, 144, function (dot) {
    for (let ty = 0; ty < 9; ty++) for (let tx = 0; tx < 10; tx++) {
      const ch = plan[ty][tx], x = tx * 16, y = ty * 16;
      const floor = function () {
        dot(x, y, 16, 16, c.floor);
        if (c.tiled) { dot(x, y + 15, 16, 1, c.floor2); dot(x + 15, y, 1, 16, c.floor2); } else { dot(x, y + 7, 16, 1, c.floor2); dot(x, y + 15, 16, 1, c.floor2); dot(x + (ty % 2 ? 4 : 11), y, 1, 7, c.floor2); dot(x + (ty % 2 ? 11 : 4), y + 8, 1, 7, c.floor2); }
      };
      if (ch === "#" || ch === "W") {
        if (ty === 0) {                    // the back wall, with a coloured stripe and a skirting board
          dot(x, y, 16, 16, c.wall);
          dot(x, y, 16, 2, LINE);
          dot(x, y + 5, 16, 2, c.trim);
          dot(x, y + 13, 16, 3, blend(c.trim, "#000000", 0.3));
          if (ch === "W") { dot(x + 2, y + 3, 12, 9, LINE); dot(x + 3, y + 4, 10, 7, "#88c8f8"); dot(x + 3, y + 4, 10, 2, "#d0ecff"); dot(x + 7, y + 4, 1, 7, LINE); }
        } else dot(x, y, 16, 16, LINE);     // side walls and the front wall are just dark edges
        if (ty > 0 && tx === 0) dot(x + 14, y, 2, 16, blend(c.trim, "#000000", 0.3));
        if (ty > 0 && tx === 9) dot(x, y, 2, 16, blend(c.trim, "#000000", 0.3));
        if (ty === 8) dot(x, y, 16, 2, blend(c.trim, "#000000", 0.3));
        continue;
      }
      floor();
      if (ch === "C") { dot(x, y + 2, 16, 14, LINE); dot(x, y + 3, 16, 7, "#e8b878"); dot(x, y + 3, 16, 2, "#f8d8a0"); dot(x, y + 10, 16, 5, "#a06838"); }
      if (ch === "M") { dot(x, y + 3, 16, 11, "#a83030"); dot(x + (tx === 4 ? 2 : 0), y + 5, 14, 7, "#e05858"); dot(x + (tx === 4 ? 4 : 0), y + 8, 12, 1, "#f8b0b0"); }
      if (ch === "R") {
        dot(x, y, 16, 16, c.rug);
        const edge = (ax, ay) => plan[ty + ay][tx + ax] !== "R";
        if (edge(-1, 0)) dot(x, y, 2, 16, c.rug2);
        if (edge(1, 0)) dot(x + 14, y, 2, 16, c.rug2);
        if (edge(0, -1)) dot(x, y, 16, 2, c.rug2);
        if (edge(0, 1)) dot(x, y + 14, 16, 2, c.rug2);
        dot(x + 7, y + 7, 2, 2, c.rug2);
      }
      if (ch === "T") {
        dot(x, y + 1, 16, 14, LINE);
        dot(x, y + 2, 16, 9, "#c08850");
        dot(x, y + 2, 16, 2, "#e0a868");
        dot(x, y + 11, 16, 3, "#8a5a30");
        if (door.kind === "lab") { dot(x + 4, y + 3, 8, 7, LINE); dot(x + 5, y + 4, 6, 2, "#e03838"); dot(x + 5, y + 6, 6, 3, "#f8f8f8"); dot(x + 7, y + 5, 2, 2, "#f8f8f8"); }      // a Snare Orb
        else if ((tx + ty) % 2) { dot(x + 5, y + 4, 6, 5, "#f8f8f8"); dot(x + 6, y + 5, 4, 3, "#f0a838"); }       // a plate of food
      }
      if (ch === "S") {
        dot(x, y, 16, 16, LINE);
        dot(x + 1, y + 1, 14, 14, "#8a5a30");
        for (const row of [2, 9]) {
          dot(x + 2, y + row, 12, 5, "#5a3a20");
          ["#e03838", "#3868d8", "#f8d030", "#38a858", "#f078b8"].forEach((book, n) => dot(x + 2 + n * 2 + (row > 5 ? 1 : 0), y + row + (n % 2), 2, 5 - (n % 2), door.kind === "mart" ? ["#f8f8f8", "#e03838", "#58a8f8"][n % 3] : book));
        }
      }
      if (ch === "P") { dot(x + 4, y + 10, 8, 5, LINE); dot(x + 5, y + 10, 6, 4, "#c06838"); dot(x + 3, y + 1, 10, 10, "#2f8a3c"); dot(x + 5, y + 2, 3, 3, "#5cba58"); dot(x + 9, y + 5, 3, 3, "#5cba58"); dot(x + 2, y + 5, 2, 3, "#2f8a3c"); }
      if (ch === "B") { dot(x, y, 16, 16, LINE); dot(x + 1, y + 1, 14, 14, "#5888e8"); if (ty === 1) dot(x + 2, y + 2, 12, 7, "#f8f8f8"); else dot(x + 1, y + 1, 14, 3, "#88b0f8"); }
      if (ch === "H") { dot(x, y, 16, 16, LINE); dot(x + 1, y + 1, 14, 14, "#b8c0d0"); dot(x + 1, y + 1, 14, 3, "#e0e8f0"); dot(x + 3, y + 6, 4, 4, "#38c048"); dot(x + 9, y + 6, 4, 4, "#e03838"); dot(x + 3, y + 12, 10, 2, "#687888"); }
      if (ch === "X") { dot(x + 2, y + 11, 12, 5, LINE); dot(x + 3, y + 12, 10, 3, "#98a0b0"); dot(x + 4, y + 2, 8, 10, LINE); dot(x + 5, y + 3, 6, 8, "#c8d0dc"); dot(x + 5, y + 3, 2, 8, "#e8ecf4"); dot(x + 6, y + 5, 1, 2, LINE); dot(x + 9, y + 5, 1, 2, LINE); }
    }
  });
  roomsDrawn.set(name, art);
  return art;
}
