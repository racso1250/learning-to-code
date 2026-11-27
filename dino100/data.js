// Dino Island 100: the rule book.
// No drawing in here. This file says how big the island is, where its seven regions are,
// and lists all 100 dinosaurs: 80 that you can discover, and 20 hybrids you can make in a lab.

const TILE = 4;                    // the island is a grid of squares, each 4 metres wide
const SIZE = 160;                  // 160 squares across and 160 deep: four times the size of Fossil Bay
const HALF = SIZE * TILE / 2;      // from the middle of the island to its edge (in metres)
const GATE = { i: 80, k: 159 };    // the square where visitors come in

function mid(n) {
  return (n + 0.5) * TILE - HALF;
}

function tileOf(metres) {
  return Math.floor((metres + HALF) / TILE);
}

function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// ----- The seven regions of the island -----
const BIOMES = {
  meadow: { name: "Emerald Plains",   ground: 0x62c052, other: 0x86d466, map: "#5ab84a" },
  forest: { name: "Greenwood",        ground: 0x3a7a3a, other: 0x4a8a42, map: "#2a6a2e" },
  desert: { name: "Red Desert",       ground: 0xd8a060, other: 0xe8be84, map: "#d8a060" },
  snow:   { name: "Frost Plateau",    ground: 0xe6eef6, other: 0xcfdbe8, map: "#e6eef6" },
  swamp:  { name: "Misty Swamp",      ground: 0x4a7a5a, other: 0x5e8c60, map: "#3f6f4f" },
  ash:    { name: "Ashlands",         ground: 0x5a504c, other: 0x74645a, map: "#5a504c" },
  coast:  { name: "Coral Coast",      ground: 0xe8d8a0, other: 0xd8e0a8, map: "#e8d8a0" },
};

// Which region is this square in? The plains (where your park is) fill the south and middle.
function biomeAt(i, k) {
  if (k < 44) return i < 54 ? "snow" : i < 108 ? "ash" : "desert";     // the far north
  if (i < 42) return k < 104 ? "forest" : "swamp";                     // the west
  if (i >= 120) return "coast";                                        // the east
  return "meadow";
}

// ----- The 80 dinosaurs you can discover -----
// Each row: id, name, body plan, length in metres, what it eats, its region, its tier (0 = common ... 5 = legendary),
// three colours (body, belly, trim), and its special features.
// Body plans: T = big meat-eater on two legs, R = raptor, O = ostrich-like runner, H = duckbill,
//             P = dome-head, S = long-neck, C = horned face, G = plated back, A = armoured tank.
const ROWS = [
  ["para", "Parasaurolophus", "H", 9, "plants", "meadow", 0, 0xd98a3a, 0xf0d8a0, 0xc8402a, "tube"],
  ["tri", "Triceratops", "C", 8, "plants", "meadow", 0, 0x8a9a6a, 0xd8d0a8, 0xf4ecd8, "frill horns3"],
  ["galli", "Gallimimus", "O", 6, "plants", "meadow", 0, 0xd8b070, 0xf0e0b0, 0x7a5a3a, ""],
  ["maia", "Maiasaura", "H", 8, "plants", "meadow", 0, 0xa8a070, 0xe0d8b0, 0x8a8050, ""],
  ["struthi", "Struthiomimus", "O", 4.5, "plants", "meadow", 0, 0xb89a70, 0xe8dcc0, 0x5a4a3a, ""],
  ["edmo", "Edmontosaurus", "H", 11, "plants", "meadow", 1, 0x7a9a5a, 0xd8e0b0, 0x5a7a3a, ""],
  ["cory", "Corythosaurus", "H", 9, "plants", "meadow", 1, 0x4a8a9a, 0xc8e0d8, 0xe8c83a, "helmet"],
  ["lambeo", "Lambeosaurus", "H", 10, "plants", "meadow", 1, 0x8a6a9a, 0xd8c8e0, 0xd8442e, "hatchet"],
  ["toro", "Torosaurus", "C", 9, "plants", "meadow", 2, 0x9a7a5a, 0xe0d0b0, 0xd8442e, "bigfrill horns3"],
  ["alberto", "Albertosaurus", "T", 9, "meat", "meadow", 2, 0x6a5a4a, 0xc8b8a0, 0x8a3a2a, ""],
  ["brach", "Brachiosaurus", "S", 22, "plants", "meadow", 3, 0x7a8aa0, 0xb8c4d0, 0x6a7a90, "tall bump"],
  ["rex", "Tyrannosaurus rex", "T", 12.5, "meat", "meadow", 4, 0x8a4a32, 0xd8b890, 0x5a2a1a, ""],

  ["campto", "Camptosaurus", "H", 6, "plants", "forest", 0, 0x8a7a4a, 0xd8d0a8, 0x6a5a3a, ""],
  ["dryo", "Dryosaurus", "H", 3.5, "plants", "forest", 0, 0x6a8a5a, 0xd0e0b0, 0x4a6a3a, ""],
  ["steg", "Stegosaurus", "G", 8.5, "plants", "forest", 1, 0x5a9a4a, 0xc8d8a0, 0xe8823a, "plates thagomizer"],
  ["igua", "Iguanodon", "H", 9.5, "plants", "forest", 1, 0x5a8a4a, 0xc8d8a0, 0xf4ecd8, "thumbs"],
  ["dilo", "Dilophosaurus", "T", 6.5, "meat", "forest", 1, 0x6a9a3a, 0xc8d88a, 0xffd23a, "crest2"],
  ["kentro", "Kentrosaurus", "G", 5, "plants", "forest", 1, 0x7a8a4a, 0xd0d8a8, 0xf4ecd8, "smallplates spines thagomizer"],
  ["raptor", "Velociraptor", "R", 3.2, "meat", "forest", 2, 0x3a9a9a, 0xc8e0d8, 0xff5a3a, "feathers"],
  ["deino", "Deinonychus", "R", 3.6, "meat", "forest", 2, 0x5a6a8a, 0xc8d0e0, 0x3a9aff, "feathers"],
  ["cerato", "Ceratosaurus", "T", 6.5, "meat", "forest", 2, 0xa84a3a, 0xe0c0a0, 0xf4ecd8, "nosehorn brows ridge"],
  ["megalo", "Megalosaurus", "T", 8, "meat", "forest", 2, 0x5a6a3a, 0xc8d0a0, 0x3a4a2a, ""],
  ["allo", "Allosaurus", "T", 9.5, "meat", "forest", 3, 0xc8743a, 0x8a9aa8, 0xd8442e, "brows"],
  ["theri", "Therizinosaurus", "T", 10, "plants", "forest", 3, 0x7a6a4a, 0xd8c8a0, 0xf4ecd8, "longarms fluff smallhead"],

  ["proto", "Protoceratops", "C", 2.2, "plants", "desert", 0, 0xc8a070, 0xe8dcc0, 0xa85a3a, "frill"],
  ["psitta", "Psittacosaurus", "H", 2, "plants", "desert", 0, 0x9a7a4a, 0xe0d0a8, 0xd8a03a, "quills"],
  ["pachy", "Pachycephalosaurus", "P", 4.8, "plants", "desert", 1, 0x6a7ab0, 0xd0d8e8, 0xe8c86a, "dome knobs"],
  ["ovi", "Oviraptor", "R", 2, "meat", "desert", 1, 0xd8a04a, 0xf0e0c0, 0xd8442e, "crest1 feathers"],
  ["anky", "Ankylosaurus", "A", 7, "plants", "desert", 2, 0x9a8a5a, 0xd8d0a8, 0xe8dcc0, "armour sidespikes club"],
  ["styra", "Styracosaurus", "C", 5.5, "plants", "desert", 2, 0xa8623a, 0xe0c8a0, 0xf4ecd8, "frill frillspikes nosehorn"],
  ["pentac", "Pentaceratops", "C", 6.5, "plants", "desert", 2, 0x8a7a9a, 0xd8d0e0, 0xe8a03a, "bigfrill horns3"],
  ["salta", "Saltasaurus", "S", 12, "plants", "desert", 2, 0xa89a7a, 0xe0d8c0, 0x6a5a4a, "low armour"],
  ["carno", "Carnotaurus", "T", 8, "meat", "desert", 3, 0xb8502a, 0xe8c8a0, 0xf4ecd8, "browhorns"],
  ["utah", "Utahraptor", "R", 6, "meat", "desert", 3, 0x7a4a2a, 0xd8c0a0, 0x2a2a2a, "feathers"],
  ["tarbo", "Tarbosaurus", "T", 10, "meat", "desert", 3, 0x9a7a4a, 0xe0d0a8, 0x5a3a1a, ""],
  ["giga", "Giganotosaurus", "T", 13, "meat", "desert", 4, 0x5a6a5a, 0xc8d0c0, 0x8a2a1a, "ridge"],

  ["leael", "Leaellynasaura", "H", 2.5, "plants", "snow", 0, 0xc8d0d8, 0xf0f4f8, 0x8a96a8, "fluff"],
  ["troo", "Troodon", "R", 2.4, "meat", "snow", 1, 0xdfe6ee, 0x8a96a8, 0xf4f4ff, "feathers"],
  ["muttab", "Muttaburrasaurus", "H", 8, "plants", "snow", 1, 0x7a8a9a, 0xd8e0e8, 0xd8442e, "nosebump"],
  ["einio", "Einiosaurus", "C", 4.5, "plants", "snow", 1, 0x9a8a7a, 0xe0e0e8, 0xf4ecd8, "frill hook"],
  ["stygi", "Stygimoloch", "P", 3, "plants", "snow", 1, 0x5a5a7a, 0xc8c8d8, 0xe8c86a, "dome spiky"],
  ["pachyr", "Pachyrhinosaurus", "C", 6, "plants", "snow", 2, 0x8a7a6a, 0xe8ecf2, 0xc8b8a0, "frill boss"],
  ["cryo", "Cryolophosaurus", "T", 6.5, "meat", "snow", 2, 0x4a6a9a, 0xc8d8e8, 0xff7a3a, "fan"],
  ["edmont", "Edmontonia", "A", 6.5, "plants", "snow", 2, 0x7a7a8a, 0xd0d0d8, 0xe8dcc0, "armour sidespikes"],
  ["naso", "Nasutoceratops", "C", 4.8, "plants", "snow", 2, 0x6a7a8a, 0xd8dce0, 0xf4ecd8, "frill browhornsbig"],
  ["gorgo", "Gorgosaurus", "T", 9, "meat", "snow", 3, 0x5a6a7a, 0xc8d0d8, 0x2a3a4a, ""],
  ["yuty", "Yutyrannus", "T", 9, "meat", "snow", 4, 0xe8ecf2, 0xb8c4d0, 0xffffff, "fluff"],

  ["compy", "Compsognathus", "R", 1.2, "meat", "swamp", 0, 0x6a9a4a, 0xd8e8b0, 0x3a5a2a, ""],
  ["polac", "Polacanthus", "A", 5, "plants", "swamp", 1, 0x6a7a4a, 0xd0d8a8, 0xf4ecd8, "armour backspikes"],
  ["tenon", "Tenontosaurus", "H", 7, "plants", "swamp", 1, 0x7a8a5a, 0xd8e0b8, 0x4a5a3a, ""],
  ["bary", "Baryonyx", "T", 9.5, "fish", "swamp", 2, 0x5a7a4a, 0xc8d8a0, 0x3a5a2a, "snout"],
  ["ourano", "Ouranosaurus", "H", 8, "plants", "swamp", 2, 0x8a9a4a, 0xe0e0b0, 0xe8823a, "sail"],
  ["irrit", "Irritator", "T", 7.5, "fish", "swamp", 2, 0x4a6a6a, 0xc0d8d0, 0xd8a03a, "snout crest1"],
  ["diplo", "Diplodocus", "S", 26, "plants", "swamp", 3, 0xb89a6a, 0xe0d0a8, 0x8a6a4a, "low whip"],
  ["sucho", "Suchomimus", "T", 11, "fish", "swamp", 3, 0x6a8a6a, 0xd0e0c0, 0x4a9a7a, "snout ridge"],
  ["apato", "Apatosaurus", "S", 22, "plants", "swamp", 3, 0x8a8a7a, 0xd0d0c0, 0x5a5a4a, "low"],
  ["deinoch", "Deinocheirus", "O", 11, "plants", "swamp", 4, 0x8a7a6a, 0xe0d8c8, 0x5a8ad8, "sail fluff"],
  ["spino", "Spinosaurus", "T", 15, "fish", "swamp", 5, 0x4a7a8a, 0xd8d0a8, 0xe8663a, "snout sail"],

  ["herrera", "Herrerasaurus", "R", 4.5, "meat", "ash", 1, 0x6a5a3a, 0xd0c8a0, 0x3a2a1a, ""],
  ["shuno", "Shunosaurus", "S", 10, "plants", "ash", 1, 0x7a6a5a, 0xd8d0c0, 0xf4ecd8, "low club"],
  ["amarga", "Amargasaurus", "S", 10, "plants", "ash", 2, 0x9a5a3a, 0xe0c8a0, 0xffb02a, "low neckspines"],
  ["majunga", "Majungasaurus", "T", 7, "meat", "ash", 2, 0x7a5a6a, 0xd8c8d0, 0xf4ecd8, "nosehorn"],
  ["raja", "Rajasaurus", "T", 7.5, "meat", "ash", 2, 0xa85a2a, 0xe8d0a0, 0xf4ecd8, "browhorns ridge"],
  ["gasto", "Gastonia", "A", 5, "plants", "ash", 2, 0x5a4a4a, 0xc8c0c0, 0xf4ecd8, "armour sidespikes backspikes"],
  ["draco", "Dracorex", "P", 3.5, "plants", "ash", 2, 0x8a3a3a, 0xe0c0c0, 0xf4ecd8, "spiky"],
  ["diablo", "Diabloceratops", "C", 5.5, "plants", "ash", 2, 0x9a4a3a, 0xe8c8b0, 0x2a2a2a, "frill devilhorns"],
  ["pyro", "Pyroraptor", "R", 2.6, "meat", "ash", 2, 0xd8442e, 0xf0d0a0, 0xffb02a, "feathers"],
  ["acro", "Acrocanthosaurus", "T", 11.5, "meat", "ash", 4, 0x6a3a3a, 0xc8a8a0, 0xff5a3a, "ridge"],
  ["carcha", "Carcharodontosaurus", "T", 12.5, "meat", "ash", 4, 0x4a4a4a, 0xc0c0c0, 0xd8442e, ""],

  ["micro", "Microraptor", "R", 1, "meat", "coast", 1, 0x2a2a3a, 0x4a4a6a, 0x3a9aff, "feathers wings"],
  ["chasmo", "Chasmosaurus", "C", 5, "plants", "coast", 1, 0x5a8a8a, 0xd0e8e0, 0xe85a8a, "bigfrill horns3"],
  ["huaya", "Huayangosaurus", "G", 4.5, "plants", "coast", 1, 0x6a7a6a, 0xd0d8d0, 0xe8a03a, "plates shoulder thagomizer"],
  ["kosmo", "Kosmoceratops", "C", 4.5, "plants", "coast", 2, 0x3a7a9a, 0xc8e0f0, 0xffd23a, "frill frillhooks horns3"],
  ["olor", "Olorotitan", "H", 9, "plants", "coast", 2, 0x3a6a9a, 0xc8d8f0, 0xffffff, "fan"],
  ["tsinta", "Tsintaosaurus", "H", 9, "plants", "coast", 2, 0x8a8a3a, 0xe8e8b0, 0xffffff, "unicorn"],
  ["mono", "Monolophosaurus", "T", 5.5, "meat", "coast", 2, 0x8a8a5a, 0xe0e0c0, 0xe8663a, "crest1"],
  ["sino", "Sinoceratops", "C", 6, "plants", "coast", 2, 0x7a6a8a, 0xd8d0e0, 0xf4ecd8, "frill frillspikes nosehorn"],
  ["gigantor", "Gigantoraptor", "R", 8, "plants", "coast", 3, 0xc88a3a, 0xf0e0c0, 0xd8442e, "crest1 feathers"],
  ["mamen", "Mamenchisaurus", "S", 24, "plants", "coast", 3, 0x6a9a8a, 0xd0e8e0, 0x3a6a5a, "tall longneck"],
  ["argent", "Argentinosaurus", "S", 34, "plants", "coast", 5, 0x9a8a70, 0xe0d8c0, 0x6a5a40, "low"],
];

// ----- The 20 hybrids -----
// A hybrid is made in a research lab from two kinds you already know. It has the body of the
// first parent and the special features of both. (The last few are hybrids of hybrids!)
const MIXES = [
  ["h_thunderhorn", "Thunderhorn", "brach", "tri"],
  ["h_sailtyrant", "Sail Tyrant", "rex", "spino"],
  ["h_platedneck", "Plated Longneck", "diplo", "steg"],
  ["h_hammerrex", "Hammertail Rex", "rex", "anky"],
  ["h_crownraptor", "Crowned Raptor", "raptor", "dilo"],
  ["h_fortress", "Fortress Beast", "anky", "tri"],
  ["h_frostsail", "Frost Sailback", "yuty", "ourano"],
  ["h_domecharger", "Dome Charger", "pachy", "styra"],
  ["h_embertyrant", "Ember Tyrant", "carno", "acro"],
  ["h_featherking", "Feather King", "gigantor", "yuty"],
  ["h_spiketitan", "Spike Titan", "argent", "kentro"],
  ["h_twinhorn", "Twin-horn Hunter", "allo", "cerato"],
  ["h_skysail", "Sky Sail", "deinoch", "amarga"],
  ["h_rainbow", "Rainbow Crest", "para", "olor"],
  ["h_thornrunner", "Thorn Runner", "utah", "stygi"],
  ["h_stonerex", "Stone Rex", "giga", "gasto"],
  ["h_stormfrill", "Storm Frill", "dilo", "kosmo"],
  ["h_icehorn", "Ice Horn", "pachyr", "cryo"],
  ["h_swampking", "Swamp King", "h_sailtyrant", "sucho"],
  ["h_emperor", "The Emperor", "h_hammerrex", "h_embertyrant"],
];

const PLAN_NAMES = { T: "thero", R: "raptor", O: "runner", H: "duckbill", P: "dome", S: "longneck", C: "horned", G: "plated", A: "tank" };
const PLAN_SPEED = { T: 5, R: 6.5, O: 7, H: 3.2, P: 3.5, S: 1.8, C: 2.6, G: 2.2, A: 1.8 };
const PLAN_TALL = { T: 0.5, R: 0.55, O: 0.7, H: 0.55, P: 0.6, S: 0.45, C: 0.45, G: 0.52, A: 0.36 };

// Build the full list of 100 from the two tables above. Every dinosaur gets:
//   name, diet, biome, tier, plan, size, colours, feats (its features),
//   and numbers worked out from its size and tier: cost, appeal, need, herd, strength, speed.
const SPECIES = {};
const SHAPES = {};   // how tall and how long each kind is (in metres)

function addKind(id, name, plan, size, diet, biome, tier, a, b, c, feats, parents) {
  const meat = diet !== "plants";
  let appeal = Math.round(2 + tier * 3.2 + size * 0.25 + (meat ? 2 : 0));
  if (parents) appeal = Math.round(appeal * 1.4 + 4);
  const small = size < 5;
  SPECIES[id] = {
    name: name, diet: diet, biome: biome, tier: tier, plan: plan, size: size, a: a, b: b, c: c, feats: feats, parents: parents || null, home: "land",
    appeal: appeal,
    cost: Math.round((80 + appeal * 90) / 50) * 50,
    need: clamp(Math.round(size * 1.2), 4, 36),
    herd: plan === "R" ? 2 : !meat && small ? 3 : !meat && size < 10 && plan !== "G" && plan !== "A" ? 2 : 1,
    strength: Math.min(12, Math.round(1 + size * 0.5 + (meat ? 2 : 0) + (parents ? 2 : 0))),
    speed: PLAN_SPEED[plan],
    stars: Math.min(5, tier),
  };
  const tall = feats.includes("tall") ? 0.75 : PLAN_TALL[plan];
  SHAPES[id] = { tall: size * tall + (feats.includes("sail") ? size * 0.12 : 0), long: size };
}

for (const row of ROWS) addKind(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10].split(" ").filter(Boolean));
for (const mix of MIXES) {
  const one = SPECIES[mix[2]];
  const two = SPECIES[mix[3]];
  // Body, size and home from the first parent; features from both; the trim colour from the second
  const feats = Array.from(new Set(one.feats.concat(two.feats)));
  addKind(mix[0], mix[1], one.plan, Math.round(Math.max(one.size, two.size * 0.7) * 1.1 * 10) / 10, one.diet, one.biome, Math.min(5, Math.max(one.tier, two.tier) + 1), one.a, two.a, two.c, feats, [mix[2], mix[3]]);
}

// The kinds the park already has when you take over
const STARTERS = ["para", "tri", "galli", "steg", "raptor", "rex"];

// ----- Fences -----
const FENCES = {
  wood:     { name: "Wooden fence",   hp: 60,  per: 8,  high: 2.2 },
  steel:    { name: "Steel fence",    hp: 160, per: 20, high: 3.2 },
  electric: { name: "Electric fence", hp: 400, per: 45, high: 4 },
};
const PADS = { land: { name: "Paddock", per: 8 } };

// ----- Things you can build -----
const TOOLS = {
  look:     { name: "Look",            group: "all",   what: "Click a paddock, a lab or a camp to see what is going on in it" },
  remove:   { name: "Bulldozer",       group: "all",   what: "Click something to take it away. You get half its money back" },
  paddock:  { name: "Paddock",         group: "dinos", pad: "land", what: "Hold the mouse button and drag a box. A fence goes round it" },
  plants:   { name: "Plant feeder",    group: "dinos", cost: 100, inside: true, what: "Food for plant-eaters. Goes inside a paddock" },
  meat:     { name: "Meat feeder",     group: "dinos", cost: 150, inside: true, what: "Food for meat-eaters. Goes inside a paddock" },
  fish:     { name: "Fish feeder",     group: "dinos", cost: 150, inside: true, what: "Food for fish-eaters. Goes inside a paddock" },
  path:     { name: "Path",            group: "guests", cost: 10,   walk: true, what: "Visitors walk on paths. Drag to lay a line of them" },
  deck:     { name: "Viewing deck",    group: "guests", cost: 150,  walk: true, what: "Put it right next to a paddock, joined to a path. Visitors watch from here" },
  station:  { name: "Monorail station", group: "guests", cost: 1500, walk: true, what: "Stations join up by monorail, so visitors can cross this huge island" },
  snack:    { name: "Snack stall",     group: "guests", cost: 300,  walk: true, what: "Hungry visitors spend money here" },
  gift:     { name: "Gift shop",       group: "guests", cost: 600,  walk: true, what: "Visitors buy toy dinosaurs here" },
  diner:    { name: "Restaurant",      group: "guests", cost: 900,  walk: true, stars: 3, what: "Visitors spend a lot here" },
  camp:     { name: "Expedition camp", group: "park",   cost: 800,  what: "Sends teams out across the island to discover new dinosaurs" },
  lab:      { name: "Research lab",    group: "park",   cost: 1200, what: "Makes hybrid dinosaurs from two kinds you know, and invents things for the park" },
  tree:     { name: "Tree",            group: "pretty", cost: 20,  pretty: 0.2, what: "Makes the park prettier" },
  flowers:  { name: "Flower bed",      group: "pretty", cost: 40,  pretty: 0.3, what: "A splash of colour" },
  bench:    { name: "Bench",           group: "pretty", cost: 60,  pretty: 0.3, what: "Somewhere for tired visitors to sit" },
  lamp:     { name: "Lamp post",       group: "pretty", cost: 50,  pretty: 0.2, what: "A warm light beside the path" },
  fountain: { name: "Fountain",        group: "pretty", cost: 250, pretty: 1.5, what: "Sparkling water. Visitors love it" },
  statue:   { name: "Dinosaur statue", group: "pretty", cost: 400, pretty: 2,   what: "A proud golden T. rex on a stone block" },
};
const GROUPS = { dinos: "Dinosaurs", guests: "Visitors", park: "Science", pretty: "Pretty things" };

// ----- People you can hire -----
const STAFF = {
  keeper:    { name: "Keeper",     wage: 20, what: "Looks after the paddock that needs it most. The dinosaurs there are happier" },
  ranger:    { name: "Ranger",     wage: 35, what: "Drives out to dart any dinosaur that gets loose, and mends broken fences" },
  scientist: { name: "Scientist",  wage: 40, what: "Works in a research lab or an expedition camp. They can't do anything without one" },
  guide:     { name: "Tour guide", wage: 15, what: "Tells visitors all about the dinosaurs. They enjoy it more and give more money" },
};

const TECH = {
  fence:   { name: "Reinforced fences", cost: 800,  time: 40, stars: 1, what: "Every fence can take half as much bashing again" },
  hatch:   { name: "Warm hatchery",     cost: 600,  time: 30, stars: 1, what: "Babies grow up twice as fast" },
  darts:   { name: "Long-range darts",  cost: 700,  time: 35, stars: 2, what: "The jeep and your rangers can dart from twice as far away" },
  shelter: { name: "Storm shelters",    cost: 1000, time: 45, stars: 2, what: "Dinosaurs are not frightened by storms any more" },
};

// How many rating points you need for 1, 2, 3, 4 and 5 stars
const STAR_POINTS = [40, 90, 160, 280, 450];

// How rare each tier of dinosaur is. Rarer kinds can only be found once your park has that many stars.
const RARITY = ["common", "common", "uncommon", "rare", "epic", "legendary"];

// What an expedition to each region costs, and how many seconds it takes (far-away regions cost more)
const TRIPS = {
  meadow: { cost: 250, time: 24 },
  forest: { cost: 400, time: 32 },
  swamp:  { cost: 400, time: 32 },
  coast:  { cost: 400, time: 32 },
  desert: { cost: 550, time: 40 },
  ash:    { cost: 550, time: 40 },
  snow:   { cost: 550, time: 40 },
};

// ----- Your jobs, one after another -----
const GOALS = [
  { text: "A Velociraptor is loose near the gate! Press J for the jeep, drive close, and press Space to dart it", reward: 400 },
  { text: "The Tyrannosaurus fence is nearly broken. Choose Look, click its paddock, and mend the fence", reward: 300 },
  { text: "The Triceratops are hungry. Put a Plant feeder in their paddock (Dinosaurs tab)", reward: 300 },
  { text: "Press Staff and hire a ranger, so somebody is ready next time", reward: 300 },
  { text: "Click the Expedition camp with Look and send a team out to discover a new dinosaur", reward: 400 },
  { text: "Hatch a kind of dinosaur that the park did not have when you took over", reward: 500 },
  { text: "Discover 15 kinds of dinosaur. (Press B to see them all in your Dinodex)", reward: 1000 },
  { text: "Make a hybrid dinosaur in the Research lab", reward: 1500 },
  { text: "Make your park a 3 star park", reward: 1500 },
  { text: "Discover 40 kinds of dinosaur", reward: 3000 },
  { text: "Make your park a 5 star park", reward: 5000 },
  { text: "Discover all 100 dinosaurs!", reward: 0 },
];
