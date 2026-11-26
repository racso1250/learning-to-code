// Fossil Bay: the rule book.
// No drawing in here. This file says how big the park is, which dinosaurs you can hatch,
// what you can build, and what everything costs.

const TILE = 4;                    // the park is a grid of squares, each 4 metres wide
const SIZE = 48;                   // 48 squares across and 48 squares deep
const HALF = SIZE * TILE / 2;      // from the middle of the park to its edge (in metres)
const GATE = { i: 24, k: 47 };     // the square where visitors come in

// The middle of square number n, in metres
function mid(n) {
  return (n + 0.5) * TILE - HALF;
}

// Which square is this spot in?
function tileOf(metres) {
  return Math.floor((metres + HALF) / TILE);
}

// ----- Random numbers that come out the same every time (for scenery) -----
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

// ----- The dinosaurs -----
// diet     = what it eats ("plants" or "meat")
// appeal   = how much visitors love it
// need     = how many squares of paddock one of them needs
// herd     = how many of its own kind it wants around (1 = happy alone)
// strength = how hard it hits a fence when it is angry
// stars    = how many stars your park needs before you can hatch it
const SPECIES = {
  para:   { name: "Parasaurolophus",    diet: "plants", cost: 250,  appeal: 3,  need: 6,  herd: 2, strength: 2,  speed: 3.2, stars: 0 },
  tri:    { name: "Triceratops",        diet: "plants", cost: 450,  appeal: 5,  need: 9,  herd: 2, strength: 5,  speed: 2.6, stars: 0 },
  galli:  { name: "Gallimimus",         diet: "plants", cost: 300,  appeal: 3,  need: 5,  herd: 3, strength: 1,  speed: 7,   stars: 1 },
  pachy:  { name: "Pachycephalosaurus", diet: "plants", cost: 550,  appeal: 5,  need: 7,  herd: 2, strength: 7,  speed: 3.5, stars: 1 },
  steg:   { name: "Stegosaurus",        diet: "plants", cost: 650,  appeal: 6,  need: 9,  herd: 1, strength: 4,  speed: 2.2, stars: 1 },
  dilo:   { name: "Dilophosaurus",      diet: "meat",   cost: 750,  appeal: 7,  need: 7,  herd: 1, strength: 4,  speed: 5,   stars: 1 },
  raptor: { name: "Velociraptor",       diet: "meat",   cost: 900,  appeal: 8,  need: 6,  herd: 2, strength: 6,  speed: 6.5, stars: 2 },
  anky:   { name: "Ankylosaurus",       diet: "plants", cost: 800,  appeal: 7,  need: 10, herd: 1, strength: 6,  speed: 1.8, stars: 2 },
  brach:  { name: "Brachiosaurus",      diet: "plants", cost: 1800, appeal: 12, need: 25, herd: 1, strength: 8,  speed: 1.8, stars: 3 },
  carno:  { name: "Carnotaurus",        diet: "meat",   cost: 2200, appeal: 14, need: 20, herd: 1, strength: 8,  speed: 6.5, stars: 3 },
  rex:    { name: "Tyrannosaurus rex",  diet: "meat",   cost: 3500, appeal: 20, need: 30, herd: 1, strength: 10, speed: 5,   stars: 4 },
  spino:  { name: "Spinosaurus",        diet: "meat",   cost: 4500, appeal: 24, need: 36, herd: 1, strength: 11, speed: 4.5, stars: 5 },
};

// ----- Fences -----
// hp = how much bashing it can take. per = what one square's length of it costs.
const FENCES = {
  wood:     { name: "Wooden fence",   hp: 60,  per: 8,  high: 2.2 },
  steel:    { name: "Steel fence",    hp: 160, per: 20, high: 3.2 },
  electric: { name: "Electric fence", hp: 400, per: 45, high: 4 },
};

// ----- Things you can build -----
// inside = it goes inside a paddock. walk = visitors can walk on it. stars = stars needed first.
const TOOLS = {
  look:    { name: "Look",         what: "Click a paddock to see how its dinosaurs feel" },
  paddock: { name: "Paddock",      what: "Hold the mouse button and drag a box. A fence goes round it" },
  path:    { name: "Path",         cost: 10,  walk: true, what: "Visitors walk on paths. Drag to lay a line of them from the gate" },
  deck:    { name: "Viewing deck", cost: 150, walk: true, what: "Put it right next to a paddock, joined to a path. Visitors watch from here" },
  snack:   { name: "Snack stall",  cost: 300, walk: true, what: "Hungry visitors spend money here" },
  gift:    { name: "Gift shop",    cost: 600, walk: true, stars: 2, what: "Visitors buy toy dinosaurs here" },
  plants:  { name: "Plant feeder", cost: 100, inside: true, what: "Food for plant-eaters. Goes inside a paddock" },
  meat:    { name: "Meat feeder",  cost: 150, inside: true, what: "Food for meat-eaters. Goes inside a paddock" },
  tree:    { name: "Tree",         cost: 20,  what: "Makes the park prettier" },
  remove:  { name: "Bulldozer",    what: "Click something to take it away. You get half its money back" },
};

// How many rating points you need for 1, 2, 3, 4 and 5 stars
const STAR_POINTS = [6, 18, 38, 65, 100];

// ----- Your jobs, one after another. Each one pays a reward when it is done. -----
const GOALS = [
  { text: "Choose Paddock (2) and drag a box on the grass to fence it in", reward: 200 },
  { text: "Choose Plant feeder (7) and put one inside your paddock", reward: 100 },
  { text: "Choose Look (1), click your paddock, and hatch a dinosaur", reward: 200 },
  { text: "Lay a Path (3) from the gate, and put a Viewing deck (4) next to the paddock", reward: 300 },
  { text: "Welcome 10 visitors to your park", reward: 300 },
  { text: "Make your park a 2 star park: more dinosaurs, more kinds, and a snack stall", reward: 500 },
  { text: "Hatch a meat-eater. It needs its own paddock, a meat feeder and a strong fence", reward: 500 },
  { text: "Make your park a 4 star park", reward: 1000 },
  { text: "Hatch a Tyrannosaurus rex", reward: 1500 },
  { text: "Make your park a 5 star park!", reward: 0 },
];
