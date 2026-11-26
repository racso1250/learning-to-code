// Fossil Bay: the park.
// The grid of squares, paddocks and fences, paths and buildings, the visitors who walk
// around, and how many stars the park has earned.

const parkGroup = new THREE.Group();   // everything you have built
scene.add(parkGroup);
const padGroups = {};                  // the fence model of each paddock, by its id
let reach = new Int16Array(SIZE * SIZE);   // how many steps each square is from the gate (-1 = can't get there)
const guests = [];

function keyOf(i, k) {
  return i + "," + k;
}

function typeAt(i, k) {
  return state.tiles[keyOf(i, k)];
}

function inPark(i, k) {
  return i >= 0 && k >= 0 && i < SIZE && k < SIZE;
}

// The paddock this square is inside (or nothing)
function padAt(i, k) {
  return state.pads.find(function (p) { return i >= p.i0 && i <= p.i1 && k >= p.k0 && k <= p.k1; }) || null;
}

function padById(id) {
  return state.pads.find(function (p) { return p.id === id; }) || null;
}

function padArea(p) {
  return (p.i1 - p.i0 + 1) * (p.k1 - p.k0 + 1);
}

function padMid(p) {
  return { x: (p.i0 + p.i1 + 1) / 2 * TILE - HALF, z: (p.k0 + p.k1 + 1) / 2 * TILE - HALF };
}

// How many squares of fence go round a paddock
function fenceLength(p) {
  return 2 * (p.i1 - p.i0 + 1 + p.k1 - p.k0 + 1);
}

function walkable(i, k) {
  const type = typeAt(i, k);
  return !!type && !!TOOLS[type].walk;
}

// Is there a paddock right next to this square?
function padBeside(i, k) {
  return padAt(i + 1, k) || padAt(i - 1, k) || padAt(i, k + 1) || padAt(i, k - 1);
}

// ----- Building -----
// Can this thing go on this square? Gives the reason why not (or "" if it is fine).
function whyNot(type, i, k) {
  const tool = TOOLS[type];
  if (!inPark(i, k)) return "That is outside the park";
  if (typeAt(i, k)) return "Something is already there";
  if (tool.stars && state.best < tool.stars) return "You need a " + tool.stars + " star park for that";
  const pad = padAt(i, k);
  if (tool.inside && !pad) return "That goes inside a paddock";
  if (!tool.inside && pad) return "That can't go inside a paddock";
  if (type === "deck" && !padBeside(i, k)) return "Put a viewing deck right next to a paddock";
  if (state.money < tool.cost) return "You need $" + tool.cost;
  return "";
}

function place(type, i, k) {
  const why = whyNot(type, i, k);
  if (why) return why;
  state.money -= TOOLS[type].cost;
  state.tiles[keyOf(i, k)] = type;
  refreshPark();
  return "";
}

// Can a paddock go here? (i0, k0) and (i1, k1) are two opposite corners.
function whyNoPad(i0, k0, i1, k1) {
  const wide = i1 - i0 + 1;
  const deep = k1 - k0 + 1;
  if (!inPark(i0, k0) || !inPark(i1, k1)) return "That is outside the park";
  if (wide < 3 || deep < 3) return "Make it at least 3 squares each way";
  if (wide > 16 || deep > 16) return "That is too big (16 squares at most)";
  for (let i = i0; i <= i1; i++) {
    for (let k = k0; k <= k1; k++) {
      if (typeAt(i, k)) return "Something is in the way";
      if (padAt(i, k)) return "Another paddock is in the way";
    }
  }
  const cost = 2 * (wide + deep) * FENCES.wood.per;
  if (state.money < cost) return "You need $" + cost;
  return "";
}

function buildPad(i0, k0, i1, k1) {
  const why = whyNoPad(i0, k0, i1, k1);
  if (why) return why;
  const pad = { id: state.nextId++, i0: i0, k0: k0, i1: i1, k1: k1, fence: "wood", hp: FENCES.wood.hp, breach: null };
  state.money -= fenceLength(pad) * FENCES.wood.per;
  state.pads.push(pad);
  // If the jeep was parked right where the paddock went, move it back to the gate
  if (padAt(tileOf(state.jeep.x), tileOf(state.jeep.z))) {
    state.jeep.x = mid(GATE.i);
    state.jeep.z = mid(GATE.k);
  }
  refreshPark();
  return "";
}

// The bulldozer: take away whatever is on this square
function removeAt(i, k) {
  const type = typeAt(i, k);
  if (type) {
    if (i === GATE.i && k === GATE.k) return "The gate has to stay";
    state.money += Math.floor(TOOLS[type].cost / 2);
    delete state.tiles[keyOf(i, k)];
    refreshPark();
    return "";
  }
  const pad = padAt(i, k);
  if (!pad) return "Nothing to take away there";
  if (state.dinos.some(function (d) { return d.pad === pad.id; })) return "Move the dinosaurs out of this paddock first";
  state.money += Math.floor(fenceLength(pad) * FENCES[pad.fence].per / 2);
  state.pads.splice(state.pads.indexOf(pad), 1);
  refreshPark();
  return "";
}

// ----- What things look like -----
function makeBuilding(type) {
  const g = new THREE.Group();
  const wood = paint(0x9a6a3a);
  if (type === "deck") {
    piece(g, new THREE.BoxGeometry(3.6, 0.25, 3.6), wood, 0, 1.3, 0);
    for (const x of [-1.6, 1.6]) for (const z of [-1.6, 1.6]) piece(g, new THREE.BoxGeometry(0.25, 2.4, 0.25), wood, x, 1.2, z);
    for (const s of [-1, 1]) {
      piece(g, new THREE.BoxGeometry(3.6, 0.12, 0.12), wood, 0, 2.3, s * 1.7);
      piece(g, new THREE.BoxGeometry(0.12, 0.12, 3.6), wood, s * 1.7, 2.3, 0);
    }
    piece(g, new THREE.ConeGeometry(2.9, 1.2, 4), paint(0x3a8a5a), 0, 4.2, 0).rotation.y = Math.PI / 4;
    for (const x of [-1.6, 1.6]) for (const z of [-1.6, 1.6]) piece(g, new THREE.BoxGeometry(0.12, 1.4, 0.12), wood, x, 3, z);
  } else if (type === "snack") {
    piece(g, new THREE.BoxGeometry(3, 1.3, 2.4), paint(0xffffff), 0, 0.65, 0);
    for (let n = 0; n < 5; n++) piece(g, new THREE.BoxGeometry(0.68, 0.2, 3), paint(n % 2 ? 0xffffff : 0xe8443a), -1.36 + n * 0.68, 2.7, 0);
    for (const x of [-1.5, 1.5]) piece(g, new THREE.BoxGeometry(0.12, 2.7, 0.12), wood, x, 1.35, 1.3);
    ball(g, paint(0xffb84a), 0.35, 0.35, 0.35, 0.7, 1.6, 0);
    ball(g, paint(0xff7ab8), 0.3, 0.3, 0.3, -0.6, 1.55, 0.2);
  } else if (type === "gift") {
    piece(g, new THREE.BoxGeometry(3.4, 2.4, 3.2), paint(0xffd76a), 0, 1.2, 0);
    piece(g, new THREE.ConeGeometry(2.9, 1.6, 4), paint(0x4a7ad8), 0, 3.2, 0).rotation.y = Math.PI / 4;
    piece(g, new THREE.BoxGeometry(1, 1.7, 0.1), paint(0x6a4a2a), 0, 0.85, 1.62);
    // A toy dinosaur on the roof
    ball(g, paint(0x5ad86a), 0.45, 0.4, 0.8, 0, 4.2, 0);
    ball(g, paint(0x5ad86a), 0.25, 0.25, 0.35, 0, 4.7, -0.7);
  } else if (type === "plants" || type === "meat") {
    piece(g, new THREE.BoxGeometry(2.6, 0.7, 1.4), wood, 0, 0.35, 0);
    for (let n = 0; n < 6; n++) {
      if (type === "plants") ball(g, paint(n % 2 ? 0x3fa84a : 0x6ad85a), 0.5, 0.4, 0.5, -1 + n * 0.4, 0.85, (n % 3 - 1) * 0.3);
      else ball(g, paint(n % 2 ? 0xd8443a : 0xf08a7a), 0.4, 0.3, 0.5, -1 + n * 0.4, 0.85, (n % 3 - 1) * 0.3);
    }
  } else if (type === "tree") {
    piece(g, new THREE.CylinderGeometry(0.25, 0.4, 3, 6), paint(0x6a4a2a), 0, 1.5, 0);
    ball(g, paint(0x3aa04a), 1.7, 1.4, 1.7, 0, 3.8, 0);
    ball(g, paint(0x4ab85a), 1.1, 1, 1.1, 0.6, 4.7, 0.3);
  }
  return g;
}

const FENCE_LOOKS = {
  wood: { post: 0x7a4a2a, rail: 0x9a6a3a, rails: [0.8, 1.6] },
  steel: { post: 0x6a7a88, rail: 0xa8b8c4, rails: [0.8, 1.7, 2.6] },
  electric: { post: 0x2a2a30, rail: 0xffe14a, rails: [0.7, 1.5, 2.3, 3.1, 3.8] },
};

// Build the fence round a paddock: a post at every corner of every square, with rails between
function makeFence(p) {
  const g = new THREE.Group();
  const look = FENCE_LOOKS[p.fence];
  const high = FENCES[p.fence].high;
  const postPaint = paint(look.post);
  const railPaint = p.fence === "electric" ? new THREE.MeshBasicMaterial({ color: look.rail }) : paint(look.rail);
  const x0 = p.i0 * TILE - HALF;
  const z0 = p.k0 * TILE - HALF;
  const wide = p.i1 - p.i0 + 1;
  const deep = p.k1 - p.k0 + 1;
  // Every stretch of fence, one square long: { x, z, turned }
  const runs = [];
  for (let n = 0; n < wide; n++) {
    runs.push({ x: x0 + n * TILE + 2, z: z0, turned: false });
    runs.push({ x: x0 + n * TILE + 2, z: z0 + deep * TILE, turned: false });
  }
  for (let n = 0; n < deep; n++) {
    runs.push({ x: x0, z: z0 + n * TILE + 2, turned: true });
    runs.push({ x: x0 + wide * TILE, z: z0 + n * TILE + 2, turned: true });
  }
  const postShape = new THREE.BoxGeometry(0.36, high, 0.36);
  const railShape = new THREE.BoxGeometry(TILE, p.fence === "electric" ? 0.07 : 0.2, 0.12);
  for (const run of runs) {
    // Where the fence has been smashed, there is a gap
    const broken = p.breach && Math.hypot(run.x - p.breach.x, run.z - p.breach.z) < 4.2;
    const ex = run.turned ? 0 : 2;
    const ez = run.turned ? 2 : 0;
    piece(g, postShape, postPaint, run.x - ex, high / 2, run.z - ez);
    piece(g, postShape, postPaint, run.x + ex, high / 2, run.z + ez);
    if (broken) {
      // Snapped rails lying on the ground
      const bit = piece(g, railShape, railPaint, run.x + 0.6, 0.15, run.z + 0.8);
      bit.rotation.y = 0.7;
      continue;
    }
    for (const y of look.rails) {
      const rail = piece(g, railShape, railPaint, run.x, y, run.z);
      if (run.turned) rail.rotation.y = Math.PI / 2;
    }
  }
  g.userData.postPaint = postPaint;
  return g;
}

const pathShape = new THREE.BoxGeometry(TILE, 0.12, TILE);
const pathPaint = paint(0xe0c890);

// Take everything you have built out of the world and put it all back from the saved lists.
// (We do this whenever something is built or taken away.)
function refreshPark() {
  while (parkGroup.children.length) parkGroup.remove(parkGroup.children[0]);
  for (const key in state.tiles) {
    const type = state.tiles[key];
    const n = key.split(",").map(Number);
    let model;
    if (type === "path") {
      model = new THREE.Mesh(pathShape, pathPaint);
    } else {
      model = makeBuilding(type);
      if (TOOLS[type].walk) piece(model, pathShape, pathPaint, 0, 0.06, 0);
      // Decks and stalls turn to face the paddock or path beside them
      if (padAt(n[0] + 1, n[1])) model.rotation.y = -Math.PI / 2;
      else if (padAt(n[0] - 1, n[1])) model.rotation.y = Math.PI / 2;
      else if (padAt(n[0], n[1] - 1)) model.rotation.y = Math.PI;
    }
    model.position.set(mid(n[0]), type === "path" ? 0.06 : 0, mid(n[1]));
    parkGroup.add(model);
  }
  for (const id in padGroups) delete padGroups[id];
  for (const p of state.pads) {
    padGroups[p.id] = makeFence(p);
    parkGroup.add(padGroups[p.id]);
  }
  findReach();
}

// ----- Finding the way -----
// Work out how far every walkable square is from the gate, one step at a time.
// ("Breadth-first search": do all the squares 1 step away, then 2 steps away, and so on.)
function findReach() {
  reach.fill(-1);
  const todo = [[GATE.i, GATE.k]];
  reach[GATE.k * SIZE + GATE.i] = 0;
  while (todo.length) {
    const at = todo.shift();
    for (const way of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = at[0] + way[0];
      const k = at[1] + way[1];
      if (!inPark(i, k) || reach[k * SIZE + i] >= 0 || !walkable(i, k)) continue;
      reach[k * SIZE + i] = reach[at[1] * SIZE + at[0]] + 1;
      todo.push([i, k]);
    }
  }
}

function canReach(i, k) {
  return inPark(i, k) && reach[k * SIZE + i] >= 0;
}

// The squares to walk through to get from one square to another: [[i, k], ...]
function routeFrom(si, sk, ti, tk) {
  const from = new Int32Array(SIZE * SIZE).fill(-1);
  const start = sk * SIZE + si;
  const goal = tk * SIZE + ti;
  from[start] = start;
  const todo = [start];
  while (todo.length) {
    const at = todo.shift();
    if (at === goal) break;
    const i = at % SIZE;
    const k = Math.floor(at / SIZE);
    for (const way of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + way[0];
      const nk = k + way[1];
      if (!inPark(ni, nk) || from[nk * SIZE + ni] >= 0 || !walkable(ni, nk)) continue;
      from[nk * SIZE + ni] = at;
      todo.push(nk * SIZE + ni);
    }
  }
  if (from[goal] < 0) return null;
  const route = [];
  for (let at = goal; at !== start; at = from[at]) route.unshift([at % SIZE, Math.floor(at / SIZE)]);
  return route;
}

// Can visitors see into this paddock? (Is there a viewing deck beside it that they can walk to?)
function padSeen(p) {
  for (const key in state.tiles) {
    if (state.tiles[key] !== "deck") continue;
    const n = key.split(",").map(Number);
    if (!canReach(n[0], n[1])) continue;
    if (padAt(n[0] + 1, n[1]) === p || padAt(n[0] - 1, n[1]) === p || padAt(n[0], n[1] + 1) === p || padAt(n[0], n[1] - 1) === p) return true;
  }
  return false;
}

// Everywhere a visitor might want to go: decks and shops they can walk to
function attractions() {
  const list = [];
  for (const key in state.tiles) {
    const type = state.tiles[key];
    if (type !== "deck" && type !== "snack" && type !== "gift") continue;
    const n = key.split(",").map(Number);
    if (canReach(n[0], n[1])) list.push({ type: type, i: n[0], k: n[1] });
  }
  return list;
}

// ----- Stars -----
// Count up the park's rating points, and turn them into stars
function rate() {
  let points = 0;
  const kinds = new Set();
  const seen = {};
  for (const d of state.dinos) {
    if (d.mood === "egg") continue;
    if (d.loose) {
      points -= 8;   // a dinosaur on the loose is very bad for business
      continue;
    }
    const pad = padById(d.pad);
    if (!pad) continue;
    if (seen[pad.id] === undefined) seen[pad.id] = padSeen(pad);
    if (!seen[pad.id]) continue;
    points += SPECIES[d.kind].appeal * (0.4 + 0.6 * d.grow) * (d.comfort > 50 ? 1 : 0.5);
    kinds.add(d.kind);
  }
  points += kinds.size * 3;
  let snacks = 0;
  let gifts = 0;
  for (const spot of attractions()) {
    if (spot.type === "snack") snacks++;
    if (spot.type === "gift") gifts++;
  }
  points += Math.min(snacks, 2) * 2 + Math.min(gifts, 2) * 3;
  points -= state.scare * 2;
  state.points = Math.max(0, points);
  state.stars = STAR_POINTS.filter(function (need) { return state.points >= need; }).length;
  state.best = Math.max(state.best, state.stars);
}

// ----- Visitors -----
function addGuest() {
  if (guests.length >= MAX_GUESTS) return;
  guests.push({
    x: mid(GATE.i) + (Math.random() - 0.5) * 2, z: HALF + 40,
    route: [[GATE.i, GATE.k]], doing: "walk", wait: 0, visits: 0, joy: 0, wants: 3 + Math.floor(Math.random() * 3),
    goal: null, scared: false, side: (Math.random() - 0.5) * 1.6,
    shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)], skin: SKINS[Math.floor(Math.random() * SKINS.length)],
  });
  state.money += 25;   // the ticket
  state.arrived++;
}

// Choose the next place for a visitor to go
function sendGuest(g) {
  const i = clamp(tileOf(g.x), 0, SIZE - 1);
  const k = clamp(tileOf(g.z), 0, SIZE - 1);
  const spots = attractions();
  if (g.visits >= g.wants || !spots.length || g.scared) {
    g.doing = "leave";
    g.goal = null;
    g.route = routeFrom(i, k, GATE.i, GATE.k) || [[GATE.i, GATE.k]];
    return;
  }
  const spot = spots[Math.floor(Math.random() * spots.length)];
  g.goal = spot;
  g.doing = "walk";
  g.route = routeFrom(i, k, spot.i, spot.k) || [[GATE.i, GATE.k]];
}

function updateGuests(dt) {
  // New visitors arrive faster the more stars the park has
  const spots = attractions().length;
  const cap = Math.min(MAX_GUESTS, 10 + 14 * state.stars);
  state.nextGuest -= dt;
  if (state.nextGuest <= 0 && guests.length < cap) {
    state.nextGuest = (spots ? 9 : 30) / (state.stars + 0.6);
    addGuest();
  }

  for (let n = guests.length - 1; n >= 0; n--) {
    const g = guests[n];
    // Run from any dinosaur that is on the loose!
    if (!g.scared) {
      for (const d of state.dinos) {
        if (d.loose && d.mood !== "asleep" && Math.hypot(d.x - g.x, d.z - g.z) < 16) {
          g.scared = true;
          state.scare += 1;
          sendGuest(g);
          break;
        }
      }
    }
    if (g.wait > 0) {
      g.wait -= dt;
      if (g.wait <= 0) sendGuest(g);
      continue;
    }
    const next = g.route[0];
    if (!next) {
      // Arrived
      if (g.doing === "leave") {
        // Happy visitors leave a thank-you gift of money
        state.money += Math.min(40, Math.round(g.joy * 1.5));
        state.served++;
        guests.splice(n, 1);
        continue;
      }
      g.visits++;
      if (g.goal && g.goal.type === "deck") {
        const pad = padBeside(g.goal.i, g.goal.k);
        if (pad) {
          for (const d of state.dinos) {
            if (d.pad === pad.id && !d.loose && d.mood !== "egg") g.joy += SPECIES[d.kind].appeal * (0.4 + 0.6 * d.grow);
          }
        }
        g.wait = 5 + Math.random() * 4;
      } else if (g.goal) {
        state.money += g.goal.type === "gift" ? 15 : 8;
        g.wait = 3;
      } else {
        sendGuest(g);
      }
      continue;
    }
    // Walk to the middle of the next square (each visitor keeps a little to one side)
    const tx = next[0] === GATE.i && next[1] === GATE.k ? mid(next[0]) + g.side : mid(next[0]) + g.side;
    const tz = mid(next[1]) + g.side * 0.6;
    const far = Math.hypot(tx - g.x, tz - g.z);
    const speed = g.scared ? 6 : 2.4;
    if (far < speed * dt + 0.1) {
      g.x = tx;
      g.z = tz;
      g.route.shift();
    } else {
      g.x += (tx - g.x) / far * speed * dt;
      g.z += (tz - g.z) / far * speed * dt;
    }
  }
}

// Draw the visitors: every one is a little body and a head
const guestTint = new THREE.Color();
function drawGuests(t) {
  guests.forEach(function (g, n) {
    const bob = g.wait > 0 ? 0 : Math.abs(Math.sin(t * 9 + n)) * 0.12;
    const up = g.goal && g.goal.type === "deck" && g.wait > 0 ? 1.4 : 0;
    helper.rotation.set(0, 0, 0);
    helper.scale.set(1, 1, 1);
    helper.position.set(g.x, 0.6 + bob + up, g.z);
    helper.updateMatrix();
    guestBodies.setMatrixAt(n, helper.matrix);
    guestBodies.setColorAt(n, guestTint.setHex(g.shirt));
    helper.position.y = 1.45 + bob + up;
    helper.updateMatrix();
    guestHeads.setMatrixAt(n, helper.matrix);
    guestHeads.setColorAt(n, guestTint.setHex(g.skin));
  });
  guestBodies.count = guestHeads.count = guests.length;
  guestBodies.instanceMatrix.needsUpdate = guestHeads.instanceMatrix.needsUpdate = true;
  if (guestBodies.instanceColor) guestBodies.instanceColor.needsUpdate = true;
  if (guestHeads.instanceColor) guestHeads.instanceColor.needsUpdate = true;
}
