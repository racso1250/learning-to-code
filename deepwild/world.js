// Deepwild: the sea.
// The sea bed is worked out with maths from where you are, so it is the same every time you play.
// Everything is measured in metres. Your pod floats at the middle (0, 0), over a shallow sandbank.
// The further you swim from it, the deeper the water gets. Far out, the sea is different in every direction:
// a trench, fields of crystal, hot vents, a whale graveyard and wide dark plains. Right at the edge lies the Abyss.

const WORLD = 900;           // how far from the raft you can swim, in metres

// ----- Repeatable "random" numbers: the same place always gives the same number -----
function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
const step = (from, to, n) => smooth(Math.max(0, Math.min(1, (n - from) / (to - from))));      // 0 below "from", 1 above "to", and a smooth rise in between
// Smooth hills of random numbers (between 0 and 1)
function noise2(x, z, size, seed) {
  const fx = x / size, fz = z / size, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = smooth(fx - x0), tz = smooth(fz - z0);
  const a = hash(x0, z0, seed), b = hash(x0 + 1, z0, seed), c = hash(x0, z0 + 1, seed), d = hash(x0 + 1, z0 + 1, seed);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

// ----- The shape of the sea bed -----
// Far from the raft, each direction has its own kind of sea. "lobe" says how much a place belongs to one of them:
// 1 in the middle of that direction, fading to 0 at its edges. (Directions are in degrees: 0 is east, 90 is south.)
function lobe(x, z, middle, wide) {
  const off = Math.abs(((((Math.atan2(z, x) * 180) / Math.PI - middle) % 360) + 540) % 360 - 180);
  return 1 - step(wide * 0.45, wide, off);
}
const lobesAt = (x, z) => ({ trench: lobe(x, z, 118, 42), vents: lobe(x, z, 250, 40), crystal: lobe(x, z, 5, 46), bones: lobe(x, z, 312, 30) });
// How deep is the water here? (metres from the surface down to the sand)
function depthAt(x, z) {
  const far = Math.hypot(x, z), part = lobesAt(x, z), plains = Math.max(0, 1 - part.trench - part.vents - part.crystal - part.bones);
  // The big shape near the raft: a sandbank, then gardens and forest, then a long slope
  let deep = 6 + step(20, 110, far) * 14 + step(90, 190, far) * 26 + step(170, 300, far) * 70;
  // Further out, each direction settles at its own depth
  deep += step(280, 420, far) * (part.trench * 185 + part.vents * 95 + part.crystal * 22 + part.bones * 105 + plains * 62);
  // At the very edge of the sea, the floor falls away into the Abyss
  deep += step(730, 860, far) * (300 - part.trench * 115);
  // Hills and hollows on top of that (bigger ones further out, and rough ground round the vents)
  const bumps = Math.min(far, 420);
  deep += (noise2(x, z, 46, 11) - 0.5) * (5 + bumps * 0.07) + (noise2(x, z, 15, 12) - 0.5) * (2 + bumps * 0.016 + part.vents * step(300, 400, far) * 9) + (noise2(x, z, 5, 13) - 0.5) * 0.8;
  return Math.max(3, deep);
}
// The parts of the sea. Near the raft they go by depth; the east side of the middle ring is kelp forest and the west side is coral gardens.
const ZONES = {
  shallows: { name: "the Sunny Shallows", sand: [0.95, 0.88, 0.62] },
  kelp: { name: "the Kelp Forest", sand: [0.52, 0.6, 0.4] },
  coral: { name: "the Coral Gardens", sand: [0.9, 0.78, 0.66] },
  twilight: { name: "the Twilight Slope", sand: [0.42, 0.46, 0.56] },
  trench: { name: "the Trench", sand: [0.16, 0.16, 0.24] },
  plains: { name: "the Deep Plains", sand: [0.3, 0.34, 0.44] },
  crystal: { name: "the Crystal Fields", sand: [0.42, 0.36, 0.58] },
  vents: { name: "the Ember Vents", sand: [0.32, 0.2, 0.18] },
  bones: { name: "the Whale Graveyard", sand: [0.5, 0.5, 0.46] },
  abyss: { name: "the Abyss", sand: [0.08, 0.08, 0.13] },
};
function zoneAt(x, z) {
  const far = Math.hypot(x, z);
  if (far > 775) return "abyss";
  if (far > 330) {
    const part = lobesAt(x, z);
    return part.trench > 0.5 ? "trench" : part.vents > 0.5 ? "vents" : part.crystal > 0.5 ? "crystal" : part.bones > 0.5 ? "bones" : "plains";
  }
  const deep = depthAt(x, z);
  if (deep < 15) return "shallows";
  if (deep < 47) return x + noise2(x, z, 60, 14) * 60 - 30 > 0 ? "kelp" : "coral";
  return "twilight";
}
// A point at a distance from the raft in a direction (0 degrees is east, 90 is south)
const spot = (degrees, far) => ({ x: Math.cos((degrees * Math.PI) / 180) * far, z: Math.sin((degrees * Math.PI) / 180) * far });

// ----- Special places -----
const WRECK = Object.assign(spot(205, 222), { name: "the sunken boat" });       // at the top of the Twilight Slope...
for (let far = 222; depthAt(WRECK.x, WRECK.z) > 54 && far > 150; far -= 3) Object.assign(WRECK, spot(205, far));      // ...where it is no more than 54 metres down
const HEART = Object.assign(spot(118, 440), { name: "the Great Shell" });       // at the bottom of the Trench
// Four ancient Tide Tablets. You need all of them to open the Great Shell.
const TABLETS = [
  Object.assign(spot(155, 78), { name: "the coral arch", text: "THE FIRST TABLET: \"Long ago the sea had a heart, and the heart kept the water bright.\"" }),
  Object.assign(spot(8, 150), { name: "the tallest kelp", text: "THE SECOND TABLET: \"The Tide Folk hid the heart in a great shell, where the light of the sun cannot reach.\"" }),
  Object.assign({ x: WRECK.x + 6, z: WRECK.z - 3 }, { name: "the sunken boat", text: "THE THIRD TABLET: \"Four stones were carved, so that only a patient swimmer could open the shell.\"" }),
  Object.assign(spot(104, 352), { name: "a ledge in the Trench", text: "THE FOURTH TABLET: \"Bring the four stones to the bottom of the dark. The heart will know a friend.\"" }),
];
// Where the leviathans (the giants of the sea) make their homes
const LAIRS = { tidewyrm: spot(182, 560), kraken: spot(62, 822), emberback: spot(250, 545), lumen: spot(5, 540), gapejaw: spot(312, 560) };

// ----- Things scattered over the sea bed -----
// The sea is cut into squares, 7 metres across. Each square may hold one thing, chosen by where it is.
// decor: plants and rocks that are only there to look at. loot: things you can pick up.
const decor = { kelp: [], coral: [], rock: [], fan: [], bulb: [], spire: [], grass: [], anemone: [], brain: [], table: [], crystal: [], bone: [], vent: [] };
const loot = [];
for (let gz = -Math.ceil(WORLD / 7); gz <= WORLD / 7; gz++) for (let gx = -Math.ceil(WORLD / 7); gx <= WORLD / 7; gx++) {
  const x = gx * 7 + (hash(gx, gz, 21) - 0.5) * 6, z = gz * 7 + (hash(gx, gz, 22) - 0.5) * 6;
  if (Math.hypot(x, z) > WORLD - 6 || Math.hypot(x, z) < 9) continue;
  const zone = zoneAt(x, z), roll = hash(gx, gz, 23), size = 0.7 + hash(gx, gz, 24) * 0.8, at = { x: x, z: z, y: -depthAt(x, z), size: size, turn: hash(gx, gz, 25) * 6.283, tint: hash(gx, gz, 26) };
  const take = (kind) => loot.push(Object.assign({ kind: kind, taken: false, id: loot.length }, at));
  const grow = (kind, bigger) => decor[kind].push(Object.assign(at, { size: size * (bigger || 1) }));
  if (zone === "shallows") {
    if (roll < 0.1) take("shell");
    else if (roll < 0.2) grow("coral");
    else if (roll < 0.26) grow("rock");
    else if (roll < 0.33) grow("kelp", 0.45);
    else if (roll < 0.37) take("kelp");
    else if (roll < 0.385) take("salvage");
    else if (roll < 0.62) grow("grass");
    else if (roll < 0.67) grow("anemone");
    else if (roll < 0.7) take("glass");
  } else if (zone === "kelp") {
    if (roll < 0.5) grow("kelp", 1.5);
    else if (roll < 0.6) take("kelp");
    else if (roll < 0.68) grow("rock");
    else if (roll < 0.74) take("copper");
    else if (roll < 0.77) take("shell");
    else if (roll < 0.8) take("salvage");
    else if (roll < 0.9) grow("grass");
    else if (roll < 0.93) take("glass");
  } else if (zone === "coral") {
    if (roll < 0.26) grow("coral");
    else if (roll < 0.38) grow("fan");
    else if (roll < 0.46) grow("rock");
    else if (roll < 0.52) take("shell");
    else if (roll < 0.58) take("copper");
    else if (roll < 0.61) take("kelp");
    else if (roll < 0.64) take("salvage");
    else if (roll < 0.74) grow("brain");
    else if (roll < 0.82) grow("table");
    else if (roll < 0.9) grow("anemone");
    else if (roll < 0.94) take("glass");
  } else if (zone === "twilight") {
    if (roll < 0.12) grow("rock", 1.7);
    else if (roll < 0.2) grow("fan");
    else if (roll < 0.26) take("quartz");
    else if (roll < 0.29) take("salvage");
    else if (roll < 0.33) grow("bulb");
  } else if (zone === "trench") {
    if (roll < 0.07) grow("spire", 1.6);
    else if (roll < 0.17) grow("bulb");
    else if (roll < 0.2) take("pearl");
    else if (roll < 0.22) take("quartz");
  } else if (zone === "plains") {
    if (roll < 0.05) grow("rock", 2.2);
    else if (roll < 0.11) grow("bulb");
    else if (roll < 0.135) take("silver");
    else if (roll < 0.15) take("quartz");
    else if (roll < 0.16) take("salvage");
  } else if (zone === "crystal") {
    if (roll < 0.11) grow("crystal", 1.3);
    else if (roll < 0.17) grow("bulb");
    else if (roll < 0.21) take("amethyst");
    else if (roll < 0.23) take("quartz");
  } else if (zone === "vents") {
    if (roll < 0.045) grow("vent", 1.2);
    else if (roll < 0.13) grow("rock", 1.6);
    else if (roll < 0.17) take("ember");
    else if (roll < 0.185) take("copper");
  } else if (zone === "bones") {
    if (roll < 0.04) grow("bone", 1.4);
    else if (roll < 0.1) grow("rock", 1.3);
    else if (roll < 0.14) take("bone");
    else if (roll < 0.17) grow("bulb");
    else if (roll < 0.18) take("salvage");
  } else {
    if (roll < 0.05) grow("spire", 2.4);
    else if (roll < 0.11) grow("bulb");
    else if (roll < 0.125) take("scale");
    else if (roll < 0.14) take("pearl");
  }
}
// The sunken boat spilled its cargo: plenty of salvage lies around it
for (let n = 0; n < 16; n++) {
  const x = WRECK.x + (hash(n, 1, 31) - 0.5) * 34, z = WRECK.z + (hash(n, 2, 31) - 0.5) * 34;
  loot.push({ kind: "salvage", taken: false, id: loot.length, x: x, z: z, y: -depthAt(x, z), size: 1, turn: hash(n, 3, 31) * 6.283, tint: hash(n, 4, 31) });
}
// What each thing is called
const LOOT = {
  shell: { name: "Shell" }, kelp: { name: "Kelp" }, glass: { name: "Sea glass" }, copper: { name: "Copper" }, quartz: { name: "Quartz" }, salvage: { name: "Salvage" },
  pearl: { name: "Glow pearl" }, silver: { name: "Silver" }, amethyst: { name: "Amethyst" }, ember: { name: "Emberstone" }, bone: { name: "Whalebone" }, scale: { name: "Titan scale" },
  fish: { name: "Raw fish" }, cooked: { name: "Cooked fish" },          // (fish are caught with the Net, not picked up off the sea bed)
  water: { name: "Water bottle" }, medkit: { name: "First aid kit" },   // (made at a fabricator)
};

// ----- Things to build inside a room (go in, then press B) -----
const ROOM_ITEMS = [
  { id: "locker", name: "Locker", does: "Store your things. Every locker holds the same things as your pod locker.", needs: { salvage: 2 }, item: true },
  { id: "bed", name: "Bed", does: "Rest here, or sleep through the night.", needs: { kelp: 3, shell: 1 }, item: true },
  { id: "oven", name: "Oven", does: "Cooks all the raw fish in your bag at once. It needs power.", needs: { salvage: 1, copper: 1 }, item: true },
  { id: "tank", name: "Fish tank", does: "Put fish you have caught in it and watch them swim.", needs: { glass: 3 }, item: true },
  { id: "planter", name: "Planter", does: "Grows kelp indoors for you to pick.", needs: { kelp: 2, shell: 1 }, item: true },
  { id: "reactor", name: "Kelp reactor", does: "Feed it kelp and it makes power for your base, even at night.", needs: { salvage: 2, copper: 2 }, item: true },
  { id: "table", name: "Table and stools", does: "Somewhere to sit.", needs: { salvage: 1 }, item: true },
];

// ----- Supplies: things you use up, so the fabricator can make them again and again -----
// (oven: it can only be made where there is something to cook with: at your pod, or in a room with an oven)
const SUPPLIES = [
  { id: "water", name: "Water bottle", does: "V: drink it when you are thirsty. (The fabricator squeezes fresh water out of kelp.)", needs: { kelp: 2 } },
  { id: "cooked", name: "Cooked fish", does: "G: eat it when you are hungry.", needs: { fish: 1 }, oven: true },
  { id: "medkit", name: "First aid kit", does: "H: mends 60 health.", needs: { kelp: 1, shell: 2 } },
];

// ----- Things to make at your pod -----
// needs: what it costs. after: something you must have made first. Each one changes what you can do (see "gear" in game.js).
const RECIPES = [
  { id: "flippers", name: "Flippers", does: "Swim much faster.", needs: { kelp: 4, shell: 3 } },
  { id: "tank1", name: "Big air tank", does: "Air for 90 seconds instead of 45.", needs: { salvage: 4, kelp: 2 } },
  { id: "knife", name: "Dive knife", does: "Tool 5. Jab a Snapjaw or a Lanternjaw and it swims away.", needs: { salvage: 1, quartz: 1 } },
  { id: "torch", name: "Dive torch", does: "T: a bright light. It also scares Snapjaws away.", needs: { copper: 2, quartz: 1, salvage: 1 } },
  { id: "zipfin", name: "Zipfin scooter", does: "Hold Shift to zoom along.", needs: { copper: 4, salvage: 3, quartz: 2 } },
  { id: "tank2", name: "Great air tank", does: "Air for 150 seconds.", needs: { copper: 4, quartz: 3 }, after: "tank1" },
  { id: "suit", name: "Deep suit", does: "Dive safely down to 150 metres (instead of 60).", needs: { copper: 5, quartz: 4, kelp: 6 } },
  { id: "bubble", name: "The Bubble (mini-sub)", does: "Endless air, bright lamps, safe from every creature, and it can go to the very bottom.", needs: { salvage: 8, copper: 6, quartz: 6, kelp: 5 }, after: "suit" },
  { id: "booster", name: "Pearl booster", does: "The Bubble goes nearly twice as fast.", needs: { pearl: 5, copper: 3 }, after: "bubble" },
  { id: "tank3", name: "Giant air tank", does: "Air for 240 seconds.", needs: { silver: 4, glass: 4 }, after: "tank2" },
  { id: "lens", name: "Bright lens", does: "Your torch and the Bubble's lamps shine twice as far.", needs: { glass: 3, amethyst: 2 }, after: "torch" },
  { id: "whistle", name: "Sea whistle", does: "R: a deep note that sends leviathans away for a while.", needs: { bone: 3, silver: 2 } },
  { id: "armour", name: "Scale armour", does: "Bites and stings hurt only half as much.", needs: { scale: 4, silver: 3 } },
  { id: "hull", name: "Titan hull", does: "The Bubble can go down to 560 metres, into the Abyss, and takes far less harm.", needs: { silver: 6, amethyst: 4, ember: 4 }, after: "bubble" },
];

const ROOM = 7;              // how big a room of your base is: 7 metres from the middle to each wall (rooms are square)
const HIGH = 5;              // how high a room is, from the floor to the ceiling
const TUBE = 2.2;            // how wide a tunnel is, from the middle to the glass
// ----- Things to build on the sea bed (press B) -----
// kit: this piece is made at a fabricator first. Then the Builder puts it down.
// Each piece of your base costs materials. "room" pieces are full of air: inside one you can breathe, rest and make gear.
const BASE_PARTS = [
  { id: "dome", name: "Room", does: "An empty square room full of air, with a hatch to climb in by. No creature can get in. Go inside and press B to build things in it.", needs: { salvage: 4, quartz: 2, glass: 2 }, room: true },
  { id: "glassdome", name: "Glass room", does: "The same, but all glass: watch the fish swim past.", needs: { glass: 6, copper: 2 }, room: true },
  { id: "lookout", name: "Lookout tower", does: "A tall tower with a glass top. From inside you can see much further, and your compass shows the nearest hunting leviathan.", needs: { salvage: 5, glass: 4, quartz: 2 }, room: true },
  { id: "tunnel", name: "Tunnel", does: "A glass tube full of air that joins two of your rooms together.", needs: { glass: 2, salvage: 1 }, tunnel: true },
  { id: "poles", name: "Poles", does: "A platform on tall poles. Build a room on top of it to lift your base up off the sea bed.", needs: { salvage: 3 } },
  { id: "solar", name: "Solar panel", does: "Makes power for your base while the sun is up. It works best in shallow water, where the light is strong.", needs: { quartz: 2, copper: 1 }, kit: true },
  { id: "thermal", name: "Vent generator", does: "Makes power day and night from the heat of a hot vent. A long cable carries it back to your base.", needs: { salvage: 3, copper: 3, ember: 2 }, vent: true, kit: true },
  { id: "beacon", name: "Beacon", does: "A flashing light with a tall pink beam. You can see it from far away, so you can always find your way back.", needs: { copper: 1, glass: 1 }, kit: true },
  { id: "lamp", name: "Sea lamp", does: "Lights up the water. Snapjaws keep well away from it.", needs: { copper: 1, quartz: 1 }, kit: true },
  { id: "garden", name: "Kelp garden", does: "Grows kelp for you to pick.", needs: { kelp: 3, shell: 2 }, kit: true },
  { id: "dock", name: "Sub dock", does: "Press E here to call the Bubble to your base.", needs: { salvage: 3, copper: 2 }, kit: true },
];
