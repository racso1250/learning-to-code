// The map-making kit for Dragon Tamers 2, 3 and 4.
// Each of those games describes its lands in a short list (see its story.js),
// and this kit builds the whole world from that list: a chain of lands, walled off
// from each other by mountains, with one road winding through them all.

const TILE = 16;
let MAP_W = 0;
let MAP_H = 0;
let WORLD = null;
let PLACES = null;
let REGION_NAMES = {};
let STORY = null;
let SAGA_GRID = null;

// A repeatable "random" number from 0 to 1 for a square. Same square, same number.
function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}

// Smooth, blobby random numbers: good for coastlines and clumps of trees
function smoothNoise(x, y, size, seed) {
  const gx = Math.floor(x / size);
  const gy = Math.floor(y / size);
  let fx = x / size - gx;
  let fy = y / size - gy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, seed);
  const b = hash(gx + 1, gy, seed);
  const c = hash(gx, gy + 1, seed);
  const d = hash(gx + 1, gy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// Kinds of land. ground = the letter of its floor (see ../dragon/world.js for the letters; M is mud, I is ice).
// patches = other floors mixed in. plants = [what, how often]. mood = its weather and light.
const BIOMES = {
  village: { ground: "G", plants: [["oak", 0.04], ["bush", 0.03]], mood: "village" },
  meadow: { ground: "G", plants: [["oak", 0.035], ["bush", 0.03], ["rock", 0.01]], monsters: ["slime"], density: 0.012, mood: "meadow" },
  woods: { ground: "G", plants: [["oak", 0.07], ["bush", 0.02]], forest: 0.8, monsters: ["slime", "bat"], density: 0.014, mood: "vale" },
  lake: { ground: "G", patches: [["W", 0.6, 7, 21]], plants: [["oak", 0.06], ["bush", 0.04]], monsters: ["slime", "bogSlime"], density: 0.014, mood: "vale" },
  marsh: { ground: "M", patches: [["W", 0.62, 5, 22], ["G", 0.7, 4, 23]], plants: [["doomtree", 0.1], ["mushroom", 0.05], ["bush", 0.04]], monsters: ["bogSlime", "bat"], density: 0.02, mood: "marsh" },
  pines: { ground: "F", plants: [["pine", 0.2], ["mushroom", 0.03], ["rock", 0.02]], monsters: ["spider", "bat"], density: 0.022, mood: "doom" },
  doom: { ground: "F", plants: [["doomtree", 0.34], ["mushroom", 0.05], ["skull", 0.02]], monsters: ["spider", "bat"], density: 0.026, mood: "doom" },
  drylands: { ground: "G", patches: [["R", 0.55, 5, 24], ["S", 0.7, 4, 25]], plants: [["rock", 0.05], ["oak", 0.02], ["bush", 0.03]], monsters: ["slime", "scorpion"], density: 0.014, mood: "vale" },
  crag: { ground: "R", patches: [["N", 0.6, 6, 26]], plants: [["rock", 0.06], ["pine", 0.06]], rocky: 0.74, monsters: ["golem", "bat"], density: 0.022, mood: "crag" },
  snow: { ground: "N", patches: [["I", 0.66, 5, 27]], plants: [["snowpine", 0.1], ["rock", 0.03]], rocky: 0.78, snowy: true, monsters: ["iceSlime", "iceGolem"], density: 0.02, mood: "ice" },
  ice: { ground: "I", patches: [["N", 0.5, 5, 28], ["W", 0.74, 4, 29]], plants: [["icespire", 0.06], ["snowpine", 0.03]], snowy: true, monsters: ["iceSlime", "wraith"], density: 0.024, mood: "ice" },
  desert: { ground: "S", plants: [["cactus", 0.035], ["rock", 0.02], ["skull", 0.008]], monsters: ["scorpion"], density: 0.02, mood: "desert" },
  oasis: { ground: "S", core: ["G", 11], plants: [["palm", 0.07], ["bush", 0.03], ["cactus", 0.02]], mood: "village" },
  canyon: { ground: "R", patches: [["S", 0.62, 5, 30]], plants: [["rock", 0.07], ["skull", 0.03], ["ashtree", 0.03]], rocky: 0.7, monsters: ["sandGolem", "scorpion"], density: 0.022, mood: "desert" },
  ruins: { ground: "T", patches: [["W", 0.66, 5, 31], ["G", 0.58, 4, 32]], plants: [["pillar", 0.05], ["bush", 0.03], ["darkpillar", 0.015]], monsters: ["wraith", "shade"], density: 0.024, mood: "marsh" },
  jungle: { ground: "G", plants: [["oak", 0.16], ["bush", 0.06], ["mushroom", 0.03], ["palm", 0.04]], forest: 0.5, monsters: ["spider", "bat", "slime"], density: 0.026, mood: "jungle" },
  ash: { ground: "A", patches: [["L", 0.68, 3, 33]], plants: [["ashtree", 0.07], ["spike", 0.05]], monsters: ["imp", "magmaSlime"], density: 0.026, mood: "isle" },
  shadow: { ground: "A", patches: [["T", 0.6, 5, 34]], plants: [["doomtree", 0.1], ["spike", 0.06], ["skull", 0.03]], monsters: ["shade", "wraith"], density: 0.028, mood: "shadow" },
};

function regionAt(x, y) {
  const g = SAGA_GRID;
  if (g.open) {
    // In the Middle Lands there are no walls, so the edges between lands wander about
    const wobbleX = (smoothNoise(x, y, 9, 40) - 0.5) * 16;
    y += Math.round((smoothNoise(x, y, 9, 41) - 0.5) * 12);
    x += Math.round(wobbleX);
  }
  const gx = Math.max(0, Math.min(g.cols - 1, Math.floor((x - g.margin) / g.cw)));
  const gy = Math.max(0, Math.min(g.rows - 1, Math.floor((y - g.margin) / g.ch)));
  return g.cells[gy][gx].id;
}
function moodAt(x, y) {
  return STORY.moods[regionAt(x, y)];
}

// Build a whole game world (and get its story ready) from a description
function startSaga(spec) {
  const margin = 5;
  const cw = spec.cellW || 40;
  const ch = spec.cellH || 30;
  const cols = spec.cols;
  const rows = spec.rows;
  MAP_W = margin * 2 + cols * cw;
  MAP_H = margin * 2 + rows * ch;
  const regions = spec.regions.map((r) => Object.assign({}, BIOMES[r.biome], r));
  const cells = [];
  for (let y = 0; y < rows; y++) cells.push([]);
  const byId = {};
  regions.forEach(function (r, i) {
    const [gx, gy] = spec.order[i];
    Object.assign(r, { index: i, gx: gx, gy: gy, x0: margin + gx * cw, y0: margin + gy * ch });
    r.cx = Math.round(r.x0 + cw / 2);
    r.cy = Math.round(r.y0 + ch / 2);
    cells[gy][gx] = r;
    byId[r.id] = r;
  });
  SAGA_GRID = { margin: margin, cw: cw, ch: ch, cols: cols, rows: rows, cells: cells, open: Boolean(spec.open) };
  const regionOf = (x, y) => byId[regionAt(x, y)];

  const ground = [];
  const clear = new Set();
  const objects = [];
  const npcs = [];
  const beaconOf = {};
  const landing = {};
  const counts = { beacon: 0, bush: 0, dig: 0, pickup: 0 };
  const key = (x, y) => x + "," + y;
  const inside = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const get = (x, y) => (inside(x, y) ? ground[y][x] : "W");
  const set = (x, y, letter) => { if (inside(x, y)) ground[y][x] = letter; };

  // ----- 1. Land, sea, and each land's own kind of ground -----
  for (let y = 0; y < MAP_H; y++) {
    ground.push([]);
    for (let x = 0; x < MAP_W; x++) {
      let letter = "W";
      const r = regionOf(x, y);
      const edge = Math.min(x - margin, margin + cols * cw - 1 - x, y - margin, margin + rows * ch - 1 - y);
      if (edge > smoothNoise(x, y, 6, 1) * 4 - 1) {
        letter = r.ground;
        for (const [other, level, size, seed] of r.patches || []) if (smoothNoise(x, y, size, seed) > level) letter = other;
        if (r.core && Math.hypot(x - r.cx, y - r.cy) < r.core[1] + smoothNoise(x, y, 4, 12) * 3) letter = r.core[0];
        if (r.rocky && smoothNoise(x, y, 4, 9) > r.rocky) letter = "P";
        if (r.fly) {
          // An island: sea all the way round, so only a dragon can reach it
          const inner = Math.min(x - r.x0, r.x0 + cw - 1 - x, y - r.y0, r.y0 + ch - 1 - y);
          if (inner < 4 + smoothNoise(x, y, 5, 13) * 2) letter = "W";
        }
      }
      ground[y].push(letter);
    }
  }

  // ----- 2. Walls of mountains between the lands -----
  for (const a of regions) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const b = cells[a.gy + dy] && cells[a.gy + dy][a.gx + dx];
      if (!b || a.fly || b.fly || spec.open) continue;
      for (let along = 0; along < (dx ? ch : cw); along++) {
        for (let across = -3; across <= 2; across++) {
          const x = dx ? b.x0 + across : a.x0 + along;
          const y = dx ? a.y0 + along : b.y0 + across;
          const thick = across < 0 ? -1 - Math.floor(smoothNoise(x, y, 5, 7) * 2.2) : Math.floor(smoothNoise(x, y, 5, 8) * 2.2);
          if ((across < 0 ? across >= thick : across <= thick) && get(x, y) !== "W") set(x, y, "P");
        }
      }
    }
  }

  // ----- Tools for making paths and clearings -----
  function path(points, letter) {
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(x0 + ((x1 - x0) * s) / steps);
        const y = Math.round(y0 + ((y1 - y0) * s) / steps);
        for (let oy = -1; oy <= 2; oy++) {
          for (let ox = -1; ox <= 2; ox++) {
            clear.add(key(x + ox, y + oy));
            if (ox < 0 || oy < 0 || ox > 1 || oy > 1) continue;
            const now = get(x + ox, y + oy);
            if (now === "C" || now === "T") continue;       // keep village squares and arenas
            set(x + ox, y + oy, now === "W" || now === "B" || now === "L" ? "B" : letter);
          }
        }
      }
    }
  }
  // Make one square safe to stand on
  function open(x, y, floor) {
    clear.add(key(x, y));
    const now = get(x, y);
    if (now === "W" || now === "L") set(x, y, "B");
    else if (now === "P") set(x, y, floor);
  }
  function pad(cx, cy, radius, letter, floor) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > radius * radius + 1) continue;
        if (letter) {
          clear.add(key(x, y));
          set(x, y, letter);
        } else open(x, y, floor);
      }
    }
  }
  // A thin track from one square to another (across, then up or down)
  function trail(x0, y0, x1, y1, floor) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) open(x, y0, floor);
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) open(x1, y, floor);
  }
  function add(type, x, y, more) {
    const thing = Object.assign({ type: type, x: x, y: y, w: 1, h: 1, solid: true }, more || {});
    objects.push(thing);
    for (let oy = 0; oy < thing.h; oy++) for (let ox = 0; ox < thing.w; ox++) clear.add(key(x + ox, y - oy));
    return thing;
  }

  // ----- 3. The middle of each land: a village, a camp, a boss arena or just a clearing -----
  for (const r of regions) {
    const floor = r.ground === "W" ? "D" : r.ground;
    if (r.village) {
      for (let y = r.cy - 3; y <= r.cy + 3; y++) for (let x = r.cx - 5; x <= r.cx + 5; x++) pad(x, y, 0, "C");
      add("house", r.cx - 9, r.cy - 2, { w: 3, h: 2, look: 0 });
      add("house", r.cx + 7, r.cy - 2, { w: 3, h: 2, look: 1 });
      add("house", r.cx - 9, r.cy + 5, { w: 3, h: 2, look: 2 });
      add("house", r.cx + 7, r.cy + 5, { w: 3, h: 2, look: 0 });
      if (r.hall) add("hall", r.cx - 6, r.cy - 4, { w: 4, h: 2 });
      add("well", r.cx - 3, r.cy + 2, {});
      for (const [dx, dy] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) add("lantern", r.cx + dx, r.cy + dy, {});
      for (let y = r.cy - 7; y <= r.cy + 7; y++) for (let x = r.cx - 11; x <= r.cx + 11; x++) open(x, y, floor);
    } else if (r.arena) {
      pad(r.cx, r.cy, 6, "T");
      for (const [dx, dy] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) add("darkpillar", r.cx + dx, r.cy + dy, {});
    } else {
      pad(r.cx, r.cy, 3, null, floor);
      if (r.camp) add("campfire", r.cx + 2, r.cy - 2, { solid: false });
    }
  }

  // ----- 4. The road from each land to the next, and the gates across it -----
  for (let i = 1; i < regions.length && !spec.open; i++) {
    const a = regions[i - 1];
    const b = regions[i];
    const across = a.gy === b.gy;                       // true = side by side, false = one above the other
    const sign = across ? Math.sign(b.gx - a.gx) : Math.sign(b.gy - a.gy);
    const edge = across ? Math.max(a.x0, b.x0) : Math.max(a.y0, b.y0);
    const at = across ? Math.round((a.cy + b.cy) / 2) : Math.round((a.cx + b.cx) / 2);
    const spot = (along, wobble) => (across ? [along, at + (wobble || 0)] : [at + (wobble || 0), along]);
    const out = across ? [a.cx + sign * 8, a.cy] : [a.cx, a.cy + sign * 8];
    const into = across ? [b.cx - sign * 8, b.cy] : [b.cx, b.cy - sign * 8];
    const wobbleA = Math.round((hash(i, 1, 50) - 0.5) * 8);
    const wobbleB = Math.round((hash(i, 2, 50) - 0.5) * 8);
    if (b.fly) {
      // No road over the sea: a jetty on this side, a landing beach on the island
      path([[a.cx, a.cy], out, spot(edge - sign * 6)], "D");
      const beach = spot(edge + sign * 9);
      landing[b.id] = { x: beach[0], y: beach[1] };
      pad(beach[0], beach[1], 2, null, b.ground);
      path([beach, into, [b.cx, b.cy]], "D");
      const dock = spot(edge - sign * 6);
      add("sign", dock[0] + (across ? 0 : 3), dock[1] + (across ? 3 : 0), { text: "Only a dragon can cross the sea to " + b.name + "." });
      continue;
    }
    path([[a.cx, a.cy], out, spot(Math.round((across ? a.cx : a.cy) / 2 + edge / 2), wobbleA), spot(edge - sign * 4), spot(edge + sign * 3), spot(Math.round((across ? b.cx : b.cy) / 2 + edge / 2), wobbleB), into, [b.cx, b.cy]], "D");
    if (b.gate) {
      const first = spot(edge);
      add("gate", first[0], first[1], { id: b.id, look: b.gate.look || "thorns", needs: b.gate.needs || 1 });
      add("gate", first[0] + (across ? 0 : 1), first[1] + (across ? 1 : 0), { id: b.id, look: b.gate.look || "thorns", needs: b.gate.needs || 1 });
    }
  }

  // ----- 5. Things to find in each land -----
  const SPOTS = [[-0.34, -0.3], [0.32, -0.32], [-0.3, 0.3], [0.34, 0.26], [0.03, -0.37], [-0.03, 0.36], [-0.4, 0.03], [0.4, 0.05]];
  for (const r of regions) {
    const floor = r.ground === "W" ? "D" : r.ground;
    let next = r.index * 3;
    function place(kind, dx, dy, more) {
      const x = r.cx + dx;
      const y = r.cy + dy;
      pad(x, y, 1, null, floor);
      trail(r.cx, r.cy, x, y + 1, floor);
      if (kind === "npc") return npcs.push(Object.assign({ x: x, y: y }, more));
      if (kind === "beacon") {
        beaconOf[r.id] = counts.beacon;
        return add("beacon", x, y, { id: counts.beacon++, name: more.name });
      }
      if (kind === "berrybush") return add(kind, x, y, { id: counts.bush++ });
      if (kind === "dig") return add(kind, x, y, { id: counts.dig++, solid: false });
      if (kind === "pickup") return add(kind, x, y, Object.assign({ id: counts.pickup++, solid: false }, more));
      return add(kind, x, y, more);
    }
    const auto = function (kind, more) {
      const [fx, fy] = SPOTS[next++ % SPOTS.length];
      place(kind, Math.round(fx * cw), Math.round(fy * ch), more);
    };
    for (const [kind, dx, dy, more] of r.features || []) place(kind, dx, dy, more || {});
    if (r.pickups) for (let n = 0; n < r.pickups.count; n++) auto("pickup", { item: r.pickups.item, label: r.pickups.name, colour: r.pickups.colour });
    for (let n = 0; n < (r.bushes || 0); n++) auto("berrybush");
    if (r.dig) auto("dig");
  }

  // ----- 6. Beaches -----
  const sandy = [];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (!"GFM".includes(ground[y][x])) continue;
      let wet = false;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (ground[y + oy][x + ox] === "W") wet = true;
      if (wet) sandy.push([x, y]);
    }
  }
  for (const [x, y] of sandy) set(x, y, "S");

  // ----- 7. Trees, rocks and everything that grows by itself -----
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 2; x++) {
      const letter = ground[y][x];
      const r = regionOf(x, y);
      if (letter === "P") {
        objects.push({ type: "peak", x: x, y: y, w: 1, h: 1, solid: true, snowy: Boolean(r.snowy) });
        continue;
      }
      if (clear.has(key(x, y)) || "WLBCD".includes(letter)) continue;
      const roll = hash(x, y, 11);
      const thick = r.forest && smoothNoise(x, y, 5, 6) > 0.5 ? 1 + r.forest * 5 : 1;
      let total = 0;
      for (const [type, chance] of r.plants || []) {
        total += chance * thick;
        if (roll >= total) continue;
        objects.push({ type: type, x: x, y: y, w: 1, h: 1, solid: type !== "mushroom", look: Math.floor(hash(x, y, 5) * 3) });
        break;
      }
    }
  }

  // ----- 8. Where you can and can't go -----
  const blocked = [];
  const noFly = [];
  for (let y = 0; y < MAP_H; y++) {
    blocked.push([]);
    noFly.push([]);
    for (let x = 0; x < MAP_W; x++) {
      const letter = ground[y][x];
      blocked[y].push(letter === "W" || letter === "L" || letter === "P");
      noFly[y].push(letter === "P" || x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1);
    }
  }
  for (const thing of objects) {
    if (!thing.solid) continue;
    for (let oy = 0; oy < thing.h; oy++) for (let ox = 0; ox < thing.w; ox++) blocked[thing.y - oy][thing.x + ox] = true;
  }

  // ----- 9. Monsters -----
  // First find every square you can walk to (gates count as open), so no monster hides where you can't get at it
  const canReach = [];
  for (let y = 0; y < MAP_H; y++) canReach.push(new Uint8Array(MAP_W));
  const isGate = new Set(objects.filter((thing) => thing.type === "gate").map((thing) => key(thing.x, thing.y)));
  const queue = [[regions[0].cx, regions[0].cy + 1]];
  for (const id in landing) queue.push([landing[id].x, landing[id].y]);
  for (const [x, y] of queue) canReach[y][x] = 1;
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(nx, ny) || canReach[ny][nx] || (blocked[ny][nx] && !isGate.has(key(nx, ny)))) continue;
      canReach[ny][nx] = 1;
      queue.push([nx, ny]);
    }
  }
  const monsters = [];
  for (let y = 3; y < MAP_H - 3; y++) {
    for (let x = 3; x < MAP_W - 3; x++) {
      if (!canReach[y][x] || hash(x, y, 77) > 0.03) continue;
      const r = regionOf(x, y);
      if (!r.monsters || clear.has(key(x, y))) continue;
      if (hash(x, y, 77) > (r.density || 0.015) || Math.hypot(x - r.cx, y - r.cy) < 7) continue;
      monsters.push({ type: r.monsters[Math.floor(hash(x, y, 78) * r.monsters.length)], x: x, y: y });
    }
  }
  // Make sure every land has plenty of each of its monsters (so "defeat 8 spiders" can always be done)
  for (const r of regions) {
    if (!r.monsters || spec.open) continue;
    for (const type of r.monsters) {
      let have = monsters.filter((monster) => monster.type === type && regionOf(monster.x, monster.y) === r).length;
      for (let tries = 0; have < 10 && tries < 5000; tries++) {
        const x = r.x0 + 2 + Math.floor(hash(tries, r.index, 81) * (cw - 4));
        const y = r.y0 + 2 + Math.floor(hash(tries, r.index, 82) * (ch - 4));
        if (!canReach[y][x] || Math.hypot(x - r.cx, y - r.cy) < 7 || regionOf(x, y) !== r) continue;
        monsters.push({ type: type, x: x, y: y });
        have++;
      }
    }
  }

  // ----- 10. Get the story ready -----
  WORLD = { ground: ground, objects: objects, blocked: blocked, noFly: noFly, monsters: monsters, beaconOf: beaconOf, regions: regions, counts: counts };
  PLACES = { start: { x: regions[0].cx, y: regions[0].cy + 1 }, landing: landing };
  REGION_NAMES = {};
  const moods = {};
  for (const r of regions) {
    REGION_NAMES[r.id] = r.name;
    moods[r.id] = r.mood;
  }
  STORY = Object.assign({ npcs: npcs, moods: moods }, spec.story);
  for (const boss of STORY.bosses) {
    const r = byId[boss.region];
    boss.x = r.cx;
    boss.y = r.cy;
  }
  // Where you wake up if you faint: the last village or camp the story has taken you to
  let safe = regions[0];
  for (const step of STORY.steps) {
    const r = byId[step.in];
    if (r && (r.village || r.camp)) safe = r;
    step.respawn = [safe.cx, safe.cy + 1];
    if (step.type === "light") step.beacons = step.regions.map((id) => beaconOf[id]);
    if (step.type === "reach") step.at = landing[step.region] ? [landing[step.region].x, landing[step.region].y] : [byId[step.region].cx, byId[step.region].cy];
  }
  return WORLD;
}

// ---------------------------------------------------------------------------
// Free Play: the Middle Lands. One enormous open world, 20 times the size of a
// story world: 15 lands across and 14 down, with no walls between them.
// ---------------------------------------------------------------------------
const MIDDLE_NAMES = {
  meadow: "the Golden Plains", woods: "the Greenwood", lake: "the Thousand Pools", marsh: "the Mirelands", pines: "the Pinemarch",
  doom: "the Gloomwood", drylands: "the Dustdowns", crag: "the Cloudspine Mountains", snow: "the White Wastes", ice: "the Glass Sea",
  desert: "the Burning Sands", canyon: "the Red Canyons", ruins: "the Lost City", jungle: "the Deep Jungle", ash: "the Cinderlands", shadow: "the Shadowfells",
};
const MIDDLE_BOSSES = {
  marsh: ["bogKing", "A Bog King"], lake: ["bogKing", "A Bog King"], doom: ["broodmother", "A Broodmother"], jungle: ["broodmother", "A Broodmother"], pines: ["broodmother", "A Broodmother"],
  snow: ["frostGiant", "A Frost Giant"], ice: ["frostGiant", "A Frost Giant"], desert: ["sandGiant", "A Sand Giant"], canyon: ["sandGiant", "A Sand Giant"],
  ash: ["lavaBrute", "A Lava Brute"], shadow: ["shadowKing", "A Shadow Sorcerer"], ruins: ["shadowKing", "A Shadow Sorcerer"],
};
const MIDDLE_GEMS = ["#ffd84a", "#6fc0f5", "#ff5a3a", "#a86ad8", "#6fe08a", "#ff8ab0"];
const MIDDLE_TALK = [
  "Welcome, traveller! Nobody has ever walked right across the Middle Lands. Perhaps you could fly?",
  "They say there is a beacon in every third land. Light them all and the whole world will shine.",
  "Mind the giants. They sleep until you come close.",
  "Press M to look at your map. The Middle Lands are very, very big.",
  "Is that a real dragon? And a real wizard? And a very scruffy dog?",
];

function middleLands(spec) {
  const cols = 15;
  const rows = 14;
  const kinds = Object.keys(MIDDLE_NAMES);
  const order = [[7, 7]];
  const regions = [{ id: "midhaven", name: "Midhaven, the heart of the Middle Lands", biome: "village", village: true, hall: true, bushes: 2,
    features: [["npc", -2, -2, { id: "mayor", name: "The Mayor of Midhaven", look: "grandma", line: "Welcome to the Middle Lands, Dragon Tamer! Go anywhere you like. Press M for your map." }]] }];
  const bosses = [];
  let n = 0;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (gx === 7 && gy === 7) continue;
      n++;
      // Lands of the same kind clump together into big countries
      const own = hash(gx, gy, 63) < 0.3;      // most lands match their neighbours; some are a surprise
      const kind = kinds[Math.floor(hash(own ? gx : Math.floor((gx + (gy % 4 < 2 ? 1 : 0)) / 2), own ? gy : Math.floor(gy / 2), own ? 66 : 65) * kinds.length)];
      const roll = hash(gx, gy, 62);
      const r = { id: "m" + n, name: "The Middle Lands: " + MIDDLE_NAMES[kind], biome: kind, bushes: 1 };
      if (roll < 0.1) {
        Object.assign(r, { village: true, monsters: null, name: "A village in " + MIDDLE_NAMES[kind], bushes: 2 });
        r.features = [["npc", -2, -2, { id: "villager" + n, name: "Villager", look: ["baker", "lily", "finn", "grandma"][n % 4], line: MIDDLE_TALK[n % MIDDLE_TALK.length] }]];
      } else if (roll < 0.42) {
        r.features = [["beacon", 6, -5, { name: "the beacon of " + MIDDLE_NAMES[kind] }]];
      } else if (roll < 0.74) {
        r.pickups = { item: "gem", name: "Middle Gem", colour: MIDDLE_GEMS[n % MIDDLE_GEMS.length], count: 3 };
      } else if (roll < 0.87) {
        const giant = MIDDLE_BOSSES[kind];
        r.arena = true;
        if (giant) bosses.push({ id: "boss" + n, name: giant[1], kind: "brute", look: giant[0], hp: 45, speed: 26, region: r.id });
        else bosses.push({ id: "boss" + n, name: "A Wild Wyrm", kind: "wyrm", look: ["ice", "sand", "wyrm"][n % 3], hp: 60, region: r.id });
      } else {
        r.camp = true;
        r.dig = true;
      }
      order.push([gx, gy]);
      regions.push(r);
    }
  }
  const story = Object.assign({}, spec.story, {
    free: true,
    save: spec.story.save + "Free",
    bosses: bosses,
    steps: [{ type: "free", in: "midhaven", hint: "This is Free Play! Go wherever you like. Light beacons, find gems and beat the giants. Press M for the map." }],
    start: Object.assign({}, spec.story.start, { stage: 3, grown: true, hp: 10, maxHp: 10 }),
    ending: [],
  });
  return { cols: cols, rows: rows, open: true, order: order, regions: regions, story: story };
}

// (This last line lets the maps be checked by a test outside the browser.)
if (typeof module !== "undefined") module.exports = { startSaga: startSaga, middleLands: middleLands, world: () => ({ WORLD, PLACES, STORY, MAP_W, MAP_H, REGION_NAMES }), regionAt: regionAt };
