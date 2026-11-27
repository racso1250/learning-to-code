// Fossil Bay 3: the rule book.
// No drawing in here. This file says how big the island is, where its five sections are,
// which dinosaurs live wild in each one, and what you can build.

const TILE = 4;                    // the island is a grid of squares, each 4 metres wide
const SIZE = 80;                   // 80 squares across and 80 squares deep
const HALF = SIZE * TILE / 2;      // from the middle of the island to its edge (in metres)
const GATE = { i: 41, k: 79 };     // the square where visitors come in
const CAMP = { i: 41, k: 73 };     // your camp: where you start, and where you wake up if something gets you
const HELIPAD = { i: 46, k: 72 };  // where your helicopter is parked at the start

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

// ----- The five sections of the island -----
const BIOMES = {
  meadow: { name: "Home Meadow",      ground: 0x62c052, other: 0x86d466, map: "#5ab84a" },
  forest: { name: "Greenwood Forest", ground: 0x2f6a32, other: 0x3f7a3a, map: "#1f5a26" },
  desert: { name: "Red Desert",       ground: 0xd8a060, other: 0xe8be84, map: "#d8a060" },
  snow:   { name: "Frost Plateau",    ground: 0xe6eef6, other: 0xcfdbe8, map: "#e6eef6" },
  swamp:  { name: "Misty Swamp",      ground: 0x4a7a4a, other: 0x5e8c50, map: "#3f6f3f" },
};

// Which section is this square in? The forest fills the west, the desert the north,
// the snow the north-east, the swamp the south-east, and the meadow the middle.
function biomeAt(i, k) {
  if (i < 28) return "forest";
  if (i >= 54) return k < 36 ? "snow" : "swamp";
  return k < 30 ? "desert" : "meadow";
}

// ----- The dinosaurs -----
// diet     = "plants", "meat" or "fish"
// appeal   = how much visitors love it
// need     = how many squares of paddock one of them needs
// herd     = how many of its own kind it wants around (1 = happy alone)
// strength = how hard it hits a fence when it is angry
// biome    = the section where it lives wild, and likes best
// darts    = how many sleepy darts it takes to put it to sleep
// hunter   = it will chase you!
const SPECIES = {
  para:   { name: "Parasaurolophus",    diet: "plants", appeal: 3,  need: 6,  herd: 2, strength: 2,  speed: 3.2, biome: "meadow", darts: 2, home: "land" },
  galli:  { name: "Gallimimus",         diet: "plants", appeal: 3,  need: 5,  herd: 3, strength: 1,  speed: 7,   biome: "meadow", darts: 1, home: "land" },
  tri:    { name: "Triceratops",        diet: "plants", appeal: 5,  need: 9,  herd: 2, strength: 5,  speed: 2.6, biome: "meadow", darts: 2, home: "land" },
  brach:  { name: "Brachiosaurus",      diet: "plants", appeal: 12, need: 25, herd: 1, strength: 8,  speed: 1.8, biome: "meadow", darts: 5, home: "land" },
  steg:   { name: "Stegosaurus",        diet: "plants", appeal: 6,  need: 9,  herd: 1, strength: 4,  speed: 2.2, biome: "forest", darts: 2, home: "land" },
  igua:   { name: "Iguanodon",          diet: "plants", appeal: 5,  need: 8,  herd: 2, strength: 4,  speed: 3.4, biome: "forest", darts: 2, home: "land" },
  dilo:   { name: "Dilophosaurus",      diet: "meat",   appeal: 7,  need: 7,  herd: 1, strength: 4,  speed: 5,   biome: "forest", darts: 2, home: "land", hunter: true },
  raptor: { name: "Velociraptor",       diet: "meat",   appeal: 8,  need: 6,  herd: 2, strength: 6,  speed: 6.5, biome: "forest", darts: 1, home: "land", hunter: true },
  allo:   { name: "Allosaurus",         diet: "meat",   appeal: 15, need: 22, herd: 1, strength: 9,  speed: 5.5, biome: "forest", darts: 3, home: "land", hunter: true },
  proto:  { name: "Protoceratops",      diet: "plants", appeal: 2,  need: 4,  herd: 3, strength: 2,  speed: 3,   biome: "desert", darts: 1, home: "land" },
  pachy:  { name: "Pachycephalosaurus", diet: "plants", appeal: 5,  need: 7,  herd: 2, strength: 7,  speed: 3.5, biome: "desert", darts: 2, home: "land" },
  anky:   { name: "Ankylosaurus",       diet: "plants", appeal: 7,  need: 10, herd: 1, strength: 6,  speed: 1.8, biome: "desert", darts: 3, home: "land" },
  styra:  { name: "Styracosaurus",      diet: "plants", appeal: 8,  need: 9,  herd: 2, strength: 6,  speed: 2.6, biome: "desert", darts: 2, home: "land" },
  carno:  { name: "Carnotaurus",        diet: "meat",   appeal: 14, need: 20, herd: 1, strength: 8,  speed: 6.5, biome: "desert", darts: 3, home: "land", hunter: true },
  pachyr: { name: "Pachyrhinosaurus",   diet: "plants", appeal: 7,  need: 9,  herd: 2, strength: 6,  speed: 2.6, biome: "snow",   darts: 2, home: "land" },
  troo:   { name: "Troodon",            diet: "meat",   appeal: 6,  need: 5,  herd: 2, strength: 3,  speed: 6.5, biome: "snow",   darts: 1, home: "land", hunter: true },
  cryo:   { name: "Cryolophosaurus",    diet: "meat",   appeal: 11, need: 12, herd: 1, strength: 6,  speed: 5.5, biome: "snow",   darts: 3, home: "land", hunter: true },
  yuty:   { name: "Yutyrannus",         diet: "meat",   appeal: 18, need: 26, herd: 1, strength: 9,  speed: 5,   biome: "snow",   darts: 4, home: "land", hunter: true },
  diplo:  { name: "Diplodocus",         diet: "plants", appeal: 12, need: 24, herd: 1, strength: 7,  speed: 1.8, biome: "swamp",  darts: 5, home: "land" },
  bary:   { name: "Baryonyx",           diet: "fish",   appeal: 11, need: 14, herd: 1, strength: 7,  speed: 4.5, biome: "swamp",  darts: 3, home: "land", hunter: true },
  spino:  { name: "Spinosaurus",        diet: "fish",   appeal: 24, need: 36, herd: 1, strength: 11, speed: 4.5, biome: "swamp",  darts: 5, home: "land", hunter: true },
  rex:    { name: "Tyrannosaurus rex",  diet: "meat",   appeal: 20, need: 30, herd: 1, strength: 10, speed: 5,   biome: "desert", darts: 5, home: "land", hunter: true },
};

// How many of each kind live wild in each section
const WILD = {
  meadow: { para: 4, galli: 4, tri: 3, brach: 1 },
  forest: { steg: 2, igua: 3, dilo: 2, raptor: 3, allo: 1 },
  desert: { proto: 4, pachy: 2, anky: 1, styra: 2, carno: 1, rex: 1 },
  snow:   { pachyr: 3, troo: 2, cryo: 1, yuty: 1 },
  swamp:  { diplo: 1, bary: 1, spino: 1, igua: 2 },
};

// ----- Fences -----
const FENCES = {
  wood:     { name: "Wooden fence",   hp: 60,  per: 8,  high: 2.2 },
  steel:    { name: "Steel fence",    hp: 160, per: 20, high: 3.2 },
  electric: { name: "Electric fence", hp: 400, per: 45, high: 4 },
};
const PADS = { land: { name: "Paddock", per: 8 } };

// ----- Things you can build (press B) -----
const TOOLS = {
  paddock:  { name: "Paddock",      pad: "land", what: "Click one corner, walk to the far corner, and click again. A fence goes round it" },
  plants:   { name: "Plant feeder", cost: 100, inside: true, what: "Food for plant-eaters. Goes inside a paddock" },
  meat:     { name: "Meat feeder",  cost: 150, inside: true, what: "Food for meat-eaters. Goes inside a paddock" },
  fish:     { name: "Fish feeder",  cost: 150, inside: true, what: "Food for fish-eaters. Goes inside a paddock" },
  path:     { name: "Path",         cost: 10,   walk: true, what: "Visitors walk on paths. Lay them from the gate" },
  deck:     { name: "Viewing deck", cost: 150,  walk: true, what: "Put it right next to a paddock, joined to a path. Visitors watch from here" },
  snack:    { name: "Snack stall",  cost: 300,  walk: true, what: "Hungry visitors spend money here" },
  gift:     { name: "Gift shop",    cost: 600,  walk: true, stars: 2, what: "Visitors buy toy dinosaurs here" },
  diner:    { name: "Restaurant",   cost: 900,  walk: true, stars: 3, what: "Visitors spend a lot here" },
  tree:     { name: "Tree",         cost: 20,  pretty: 0.2, what: "Makes the park prettier" },
  flowers:  { name: "Flower bed",   cost: 40,  pretty: 0.3, what: "A splash of colour" },
  bench:    { name: "Bench",        cost: 60,  pretty: 0.3, what: "Somewhere for tired visitors to sit" },
  lamp:     { name: "Lamp post",    cost: 50,  pretty: 0.2, what: "A warm light beside the path" },
  fountain: { name: "Fountain",     cost: 250, pretty: 1.5, what: "Sparkling water. Visitors love it" },
  statue:   { name: "Dinosaur statue", cost: 400, pretty: 2, what: "A proud golden T. rex on a stone block" },
  remove:   { name: "Bulldozer",    what: "Takes away what you look at (you get half its money back), or clears a forest tree for $20" },
};

// How many rating points you need for 1, 2, 3, 4 and 5 stars
const STAR_POINTS = [8, 22, 45, 80, 125];

// ----- Your jobs, one after another. Each one pays a reward when it is done. -----
const GOALS = [
  { text: "Press B, choose Paddock, and fence in a patch of the meadow", reward: 200 },
  { text: "Find a wild plant-eater in the meadow and fire sleepy darts at it (click) until it falls asleep", reward: 200 },
  { text: "Fly your helicopter (E to get in) over the sleeping dinosaur, hook it (E), and lower it into your paddock (E)", reward: 400 },
  { text: "Give your paddock the right feeder (B)", reward: 100 },
  { text: "Lay a Path from the gate and put a Viewing deck next to the paddock", reward: 300 },
  { text: "Welcome 10 visitors to your park", reward: 300 },
  { text: "Catch a dinosaur from the Greenwood Forest (it likes a paddock in the forest best)", reward: 500 },
  { text: "Show your visitors 4 different kinds of dinosaur", reward: 600 },
  { text: "Catch a meat-eater. Dart it before it gets to you!", reward: 800 },
  { text: "Catch a dinosaur from every one of the five sections", reward: 1500 },
  { text: "Catch the Tyrannosaurus rex", reward: 2000 },
  { text: "Make your park a 5 star park!", reward: 0 },
];
