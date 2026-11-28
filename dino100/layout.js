// Dino Island 100: the park you take over.
// When a new game starts, the park is already built. This file lays it all out: the paths,
// six paddocks with their dinosaurs, the shops, a research lab and an expedition camp.
// It also leaves you three problems to fix, and hides fossil sites all over the island.

function readyPark(s) {
  const roll = seeded(7);

  function put(type, i, k) {
    const key = i + "," + k;
    s.tiles[key] = type;
    if (type === "station") s.stations.push(key);
    if (type === "lab" || type === "camp") s.labs[key] = { job: null };
  }

  // A straight line of something, from one square to another
  function line(type, i0, k0, i1, k1) {
    for (let i = i0; i <= i1; i++) {
      for (let k = k0; k <= k1; k++) put(type, i, k);
    }
  }

  function pad(i0, k0, i1, k1, fence) {
    const p = { id: s.nextId++, i0: i0, k0: k0, i1: i1, k1: k1, kind: "land", fence: fence, hp: FENCES[fence].hp, breach: null };
    s.pads.push(p);
    return p;
  }

  // Put some grown-up dinosaurs of one kind into a paddock
  function dinos(kind, p, count, hunger) {
    for (let n = 0; n < count; n++) {
      s.dinos.push({
        id: s.nextId++, kind: kind, pad: p.id,
        x: (p.i0 + 1 + roll() * (p.i1 - p.i0 - 1)) * TILE - HALF, z: (p.k0 + 1 + roll() * (p.k1 - p.k0 - 1)) * TILE - HALF, yaw: roll() * 6,
        grow: 1, hunger: hunger || 60 + roll() * 35, comfort: 80, mood: "calm", loose: false, why: [], hatchAt: 0, wake: 0,
      });
    }
  }

  // ----- Paths: an avenue north from the gate, and two streets across it -----
  line("path", GATE.i, 121, GATE.i, GATE.k);
  line("path", 58, 140, 104, 140);
  line("path", 70, 126, 90, 126);
  put("station", GATE.i, 120);

  // ----- Six paddocks, each with a viewing deck -----
  const paras = pad(64, 142, 73, 150, "wood");
  put("deck", 68, 141);
  put("plants", 66, 146);
  dinos("para", paras, 3);

  const trikes = pad(86, 142, 95, 150, "wood");
  put("deck", 90, 141);
  dinos("tri", trikes, 2, 18);          // Problem: nobody gave them a feeder, and they are very hungry

  const gallis = pad(57, 130, 65, 138, "wood");
  put("deck", 61, 139);
  put("plants", 59, 134);
  dinos("galli", gallis, 3);

  const stegs = pad(67, 130, 76, 138, "wood");
  put("deck", 71, 139);
  put("plants", 69, 134);
  dinos("steg", stegs, 1);

  const raptors = pad(84, 131, 90, 138, "steel");
  put("deck", 87, 139);
  put("meat", 86, 135);
  dinos("raptor", raptors, 3);
  // Problem: the raptors broke their fence, and one of them is out!
  raptors.hp = 0;
  raptors.breach = { x: (raptors.i1 + 1) * TILE - HALF, z: mid(134) };
  const runaway = s.dinos[s.dinos.length - 1];
  runaway.loose = true;
  runaway.mood = "angry";
  runaway.x = mid(71);
  runaway.z = mid(154);

  const rexes = pad(93, 128, 104, 138, "electric");
  put("deck", 98, 139);
  put("meat", 96, 133);
  dinos("rex", rexes, 1);
  rexes.hp = 90;                         // Problem: this fence has been bashed nearly to bits

  // The game needs to remember these two paddocks, to know when you have fixed them
  s.fix = { rex: rexes.id, tri: trikes.id };

  // ----- Shops, science, and pretty things -----
  put("snack", 81, 146);
  put("gift", 79, 150);
  put("lab", 74, 125);
  put("camp", 86, 125);
  put("fountain", 81, 131);
  put("statue", 79, 131);
  for (const k of [152, 154, 156, 158]) {
    put("tree", 77, k);
    put("tree", 83, k);
  }
  for (const k of [122, 128, 134]) {
    put("lamp", 79, k);
    put("lamp", 81, k);
  }
  put("bench", 79, 143);
  put("bench", 81, 143);
  put("flowers", 79, 137);
  put("flowers", 81, 137);

  for (const kind of STARTERS) s.known[kind] = true;

  // ----- Fossil sites: four hidden in every region, for the jeep to find -----
  for (const biome in BIOMES) {
    let made = 0;
    let tries = 0;
    while (made < 4 && tries++ < 3000) {
      const i = 6 + Math.floor(roll() * (SIZE - 12));
      const k = 6 + Math.floor(roll() * (SIZE - 12));
      if (biomeAt(i, k) !== biome) continue;
      if (i > 48 && i < 112 && k > 112) continue;      // not inside the park itself
      const x = mid(i);
      const z = mid(k);
      // Sites should be well apart. (If a region is too small for that, they may be a bit closer.)
      const apart = tries < 1500 ? 70 : 35;
      if (s.sites.some(function (site) { return Math.hypot(site.x - x, site.z - z) < apart; })) continue;
      s.sites.push({ x: x, z: z, biome: biome, found: false });
      made++;
    }
  }
}
