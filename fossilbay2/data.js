// Fossil Bay 2: the rule book.
// No drawing in here. This file says how big the island is, where its four biomes are,
// which dinosaurs you can hatch, what you can build, who you can hire, and what it all costs.

const TILE = 4;                    // the island is a grid of squares, each 4 metres wide
const SIZE = 80;                   // 80 squares across and 80 squares deep
const HALF = SIZE * TILE / 2;      // from the middle of the island to its edge (in metres)
const GATE = { i: 19, k: 79 };     // the square where visitors come in

// The middle of square number n, in metres
function mid(n) {
  return (n + 0.5) * TILE - HALF;
}

// Which square is this spot in?
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

// ----- The four biomes -----
// Two rivers cross in the middle of the island and cut it into four parts.
// Paths can't cross a river: only the monorail can.
const BIOMES = {
  jungle: { name: "Jungle Valley", ground: 0x62c052, other: 0x86d466, map: "#5ab84a" },
  swamp:  { name: "Misty Swamp",   ground: 0x4a7a4a, other: 0x5e8c50, map: "#3f6f3f" },
  desert: { name: "Red Desert",    ground: 0xd8a060, other: 0xe8be84, map: "#d8a060" },
  snow:   { name: "Frost Plateau", ground: 0xe6eef6, other: 0xcfdbe8, map: "#e6eef6" },
};

function biomeAt(i, k) {
  if (i === 39 || i === 40 || k === 39 || k === 40) return "river";
  if (k > 40) return i < 39 ? "jungle" : "swamp";
  return i < 39 ? "desert" : "snow";
}

// ----- The dinosaurs -----
// diet     = "plants", "meat" or "fish"
// appeal   = how much visitors love it
// need     = how many squares of paddock one of them needs
// herd     = how many of its own kind it wants around (1 = happy alone)
// strength = how hard it hits a fence when it is angry
// stars    = how many stars your park needs before a lab can find its DNA
// biome    = where it likes to live best
// home     = "land" (a paddock), "water" (a lagoon) or "air" (an aviary)
const SPECIES = {
  para:   { name: "Parasaurolophus",    diet: "plants", cost: 250,  appeal: 3,  need: 6,  herd: 2, strength: 2,  speed: 3.2, stars: 0, biome: "jungle", home: "land" },
  tri:    { name: "Triceratops",        diet: "plants", cost: 450,  appeal: 5,  need: 9,  herd: 2, strength: 5,  speed: 2.6, stars: 0, biome: "jungle", home: "land" },
  proto:  { name: "Protoceratops",      diet: "plants", cost: 200,  appeal: 2,  need: 4,  herd: 3, strength: 2,  speed: 3,   stars: 0, biome: "desert", home: "land" },
  galli:  { name: "Gallimimus",         diet: "plants", cost: 300,  appeal: 3,  need: 5,  herd: 3, strength: 1,  speed: 7,   stars: 1, biome: "desert", home: "land" },
  pachy:  { name: "Pachycephalosaurus", diet: "plants", cost: 550,  appeal: 5,  need: 7,  herd: 2, strength: 7,  speed: 3.5, stars: 1, biome: "desert", home: "land" },
  steg:   { name: "Stegosaurus",        diet: "plants", cost: 650,  appeal: 6,  need: 9,  herd: 1, strength: 4,  speed: 2.2, stars: 0, biome: "jungle", home: "land" },
  igua:   { name: "Iguanodon",          diet: "plants", cost: 500,  appeal: 5,  need: 8,  herd: 2, strength: 4,  speed: 3.4, stars: 1, biome: "swamp",  home: "land" },
  dilo:   { name: "Dilophosaurus",      diet: "meat",   cost: 750,  appeal: 7,  need: 7,  herd: 1, strength: 4,  speed: 5,   stars: 1, biome: "jungle", home: "land" },
  troo:   { name: "Troodon",            diet: "meat",   cost: 600,  appeal: 6,  need: 5,  herd: 2, strength: 3,  speed: 6.5, stars: 1, biome: "snow",   home: "land" },
  raptor: { name: "Velociraptor",       diet: "meat",   cost: 900,  appeal: 8,  need: 6,  herd: 2, strength: 6,  speed: 6.5, stars: 2, biome: "desert", home: "land" },
  anky:   { name: "Ankylosaurus",       diet: "plants", cost: 800,  appeal: 7,  need: 10, herd: 1, strength: 6,  speed: 1.8, stars: 2, biome: "desert", home: "land" },
  styra:  { name: "Styracosaurus",      diet: "plants", cost: 850,  appeal: 8,  need: 9,  herd: 2, strength: 6,  speed: 2.6, stars: 2, biome: "desert", home: "land" },
  pachyr: { name: "Pachyrhinosaurus",   diet: "plants", cost: 800,  appeal: 7,  need: 9,  herd: 2, strength: 6,  speed: 2.6, stars: 2, biome: "snow",   home: "land" },
  cryo:   { name: "Cryolophosaurus",    diet: "meat",   cost: 1400, appeal: 11, need: 12, herd: 1, strength: 6,  speed: 5.5, stars: 2, biome: "snow",   home: "land" },
  bary:   { name: "Baryonyx",           diet: "fish",   cost: 1500, appeal: 11, need: 14, herd: 1, strength: 7,  speed: 4.5, stars: 2, biome: "swamp",  home: "land" },
  ptera:  { name: "Pteranodon",         diet: "fish",   cost: 1200, appeal: 10, need: 8,  herd: 2, strength: 3,  speed: 8,   stars: 2, biome: "swamp",  home: "air" },
  plesio: { name: "Plesiosaurus",       diet: "fish",   cost: 1600, appeal: 12, need: 12, herd: 1, strength: 0,  speed: 3,   stars: 2, biome: "swamp",  home: "water" },
  diplo:  { name: "Diplodocus",         diet: "plants", cost: 1700, appeal: 12, need: 24, herd: 1, strength: 7,  speed: 1.8, stars: 3, biome: "swamp",  home: "land" },
  brach:  { name: "Brachiosaurus",      diet: "plants", cost: 1800, appeal: 12, need: 25, herd: 1, strength: 8,  speed: 1.8, stars: 3, biome: "jungle", home: "land" },
  carno:  { name: "Carnotaurus",        diet: "meat",   cost: 2200, appeal: 14, need: 20, herd: 1, strength: 8,  speed: 6.5, stars: 3, biome: "desert", home: "land" },
  allo:   { name: "Allosaurus",         diet: "meat",   cost: 2400, appeal: 15, need: 22, herd: 1, strength: 9,  speed: 5.5, stars: 3, biome: "jungle", home: "land" },
  yuty:   { name: "Yutyrannus",         diet: "meat",   cost: 3000, appeal: 18, need: 26, herd: 1, strength: 9,  speed: 5,   stars: 4, biome: "snow",   home: "land" },
  rex:    { name: "Tyrannosaurus rex",  diet: "meat",   cost: 3500, appeal: 20, need: 30, herd: 1, strength: 10, speed: 5,   stars: 4, biome: "jungle", home: "land" },
  mosa:   { name: "Mosasaurus",         diet: "fish",   cost: 4000, appeal: 26, need: 36, herd: 1, strength: 0,  speed: 4,   stars: 4, biome: "swamp",  home: "water" },
  spino:  { name: "Spinosaurus",        diet: "fish",   cost: 4500, appeal: 24, need: 36, herd: 1, strength: 11, speed: 4.5, stars: 5, biome: "swamp",  home: "land" },
};
// The two kinds you know how to hatch from the very start
const STARTERS = ["para", "tri"];

// ----- Fences (for ordinary paddocks) -----
const FENCES = {
  wood:     { name: "Wooden fence",   hp: 60,  per: 8,  high: 2.2 },
  steel:    { name: "Steel fence",    hp: 160, per: 20, high: 3.2 },
  electric: { name: "Electric fence", hp: 400, per: 45, high: 4 },
};

// ----- The three kinds of home for a dinosaur -----
const PADS = {
  land:   { name: "Paddock", per: 8 },
  water:  { name: "Lagoon",  per: 30, hp: 99999 },
  air:    { name: "Aviary",  per: 40, hp: 260 },
};

// ----- Things you can build -----
// group  = which tab of the toolbar it is on
// inside = it goes inside a paddock. walk = visitors can walk on it. stars = stars needed first.
// pretty = how much nicer it makes the park look
const TOOLS = {
  look:     { name: "Look",            group: "all",   what: "Click a paddock or a lab to see what is going on in it" },
  remove:   { name: "Bulldozer",       group: "all",   what: "Click something to take it away. You get half its money back" },
  paddock:  { name: "Paddock",         group: "dinos", pad: "land",  what: "Hold the mouse button and drag a box. A fence goes round it" },
  lagoon:   { name: "Lagoon",          group: "dinos", pad: "water", what: "Drag a box to dig a lagoon for sea reptiles. $30 for each square of edge" },
  aviary:   { name: "Aviary",          group: "dinos", pad: "air",   what: "Drag a box to build a netted dome for flying reptiles. $40 for each square of edge" },
  plants:   { name: "Plant feeder",    group: "dinos", cost: 100, inside: true, what: "Food for plant-eaters. Goes inside a paddock" },
  meat:     { name: "Meat feeder",     group: "dinos", cost: 150, inside: true, what: "Food for meat-eaters. Goes inside a paddock" },
  fish:     { name: "Fish feeder",     group: "dinos", cost: 150, inside: true, what: "Food for fish-eaters. Goes inside a paddock, lagoon or aviary" },
  path:     { name: "Path",            group: "guests", cost: 10,   walk: true, what: "Visitors walk on paths. Drag to lay a line of them from the gate" },
  deck:     { name: "Viewing deck",    group: "guests", cost: 150,  walk: true, what: "Put it right next to a paddock, joined to a path. Visitors watch from here" },
  station:  { name: "Monorail station", group: "guests", cost: 1500, walk: true, what: "Stations join up by monorail. Build one in another biome to open that biome up" },
  snack:    { name: "Snack stall",     group: "guests", cost: 300,  walk: true, what: "Hungry visitors spend money here" },
  gift:     { name: "Gift shop",       group: "guests", cost: 600,  walk: true, stars: 2, what: "Visitors buy toy dinosaurs here" },
  diner:    { name: "Restaurant",      group: "guests", cost: 900,  walk: true, stars: 3, what: "A sit-down dinner with a dinosaur view. Visitors spend a lot here" },
  lab:      { name: "Research lab",    group: "park",   cost: 1200, what: "Scientists here find the DNA of new dinosaurs, and invent better things for the park" },
  tree:     { name: "Tree",            group: "pretty", cost: 20,  pretty: 0.2, what: "Makes the park prettier" },
  flowers:  { name: "Flower bed",      group: "pretty", cost: 40,  pretty: 0.3, what: "A splash of colour" },
  bench:    { name: "Bench",           group: "pretty", cost: 60,  pretty: 0.3, what: "Somewhere for tired visitors to sit" },
  lamp:     { name: "Lamp post",       group: "pretty", cost: 50,  pretty: 0.2, what: "A warm light beside the path" },
  fountain: { name: "Fountain",        group: "pretty", cost: 250, pretty: 1.5, what: "Sparkling water. Visitors love it" },
  statue:   { name: "Dinosaur statue", group: "pretty", cost: 400, pretty: 2,   what: "A proud golden T. rex on a stone block" },
};
const GROUPS = { dinos: "Dinosaurs", guests: "Visitors", park: "Science", pretty: "Pretty things" };

// ----- People you can hire -----
// wage = what each one is paid every half a minute
const STAFF = {
  keeper:    { name: "Keeper",     wage: 20, what: "Looks after the paddock that needs it most. The dinosaurs there are happier" },
  ranger:    { name: "Ranger",     wage: 35, what: "Drives out to dart any dinosaur that gets loose, and mends broken fences" },
  scientist: { name: "Scientist",  wage: 40, what: "Works in a research lab. A lab can't do anything without one" },
  guide:     { name: "Tour guide", wage: 15, what: "Tells visitors all about the dinosaurs. They enjoy it more and give more money" },
};

// ----- Inventions a lab can make (as well as finding dinosaur DNA) -----
const TECH = {
  fence:   { name: "Reinforced fences", cost: 800,  time: 40, stars: 1, what: "Every fence can take half as much bashing again" },
  hatch:   { name: "Warm hatchery",     cost: 600,  time: 30, stars: 1, what: "Babies grow up twice as fast" },
  darts:   { name: "Long-range darts",  cost: 700,  time: 35, stars: 2, what: "The jeep and your rangers can dart from twice as far away" },
  shelter: { name: "Storm shelters",    cost: 1000, time: 45, stars: 2, what: "Dinosaurs are not frightened by storms any more" },
};

// How many rating points you need for 1, 2, 3, 4 and 5 stars
const STAR_POINTS = [8, 25, 55, 95, 150];

// ----- Your jobs, one after another. Each one pays a reward when it is done. -----
const GOALS = [
  { text: "Choose Paddock on the Dinosaurs tab and drag a box on the grass", reward: 200 },
  { text: "Put a Plant feeder inside your paddock", reward: 100 },
  { text: "Choose Look, click your paddock, and hatch a dinosaur", reward: 200 },
  { text: "On the Visitors tab: lay a Path from the gate, and put a Viewing deck next to the paddock", reward: 300 },
  { text: "Welcome 10 visitors to your park", reward: 300 },
  { text: "Build a Research lab (Science tab), then press Staff and hire a scientist", reward: 400 },
  { text: "Click your lab with Look and find the DNA of a new dinosaur", reward: 400 },
  { text: "Build a Monorail station in Jungle Valley, joined to a path", reward: 500 },
  { text: "Build a second station across a river. That opens a new biome", reward: 800 },
  { text: "Hire a ranger and a keeper (press Staff)", reward: 400 },
  { text: "Hatch a dinosaur outside Jungle Valley", reward: 500 },
  { text: "Make your park a 3 star park", reward: 1000 },
  { text: "Build a Lagoon or an Aviary and hatch something in it", reward: 1000 },
  { text: "Put a monorail station in all four biomes", reward: 1500 },
  { text: "Make your park a 5 star park!", reward: 0 },
];
