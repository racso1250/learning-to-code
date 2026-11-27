// Dino Island 100: the park.
// The grid of squares, paddocks, paths and buildings, the monorail,
// the visitors who walk and ride around, and how many stars the park has earned.

const parkGroup = new THREE.Group();   // everything you have built
scene.add(parkGroup);
const padGroups = {};                  // the fence model of each paddock, by its id
let reach = new Int16Array(SIZE * SIZE);   // how many steps each square is from the gate (-1 = can't get there)
const guests = [];
let railStops = [];                    // the monorail stations, in order: [{ i, k, x, z }]

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

function padBiome(p) {
  return biomeAt(p.i0, p.k0);
}

// How many squares of fence go round a paddock
function fenceLength(p) {
  return 2 * (p.i1 - p.i0 + 1 + p.k1 - p.k0 + 1);
}

// What one square's length of this paddock's fence costs
function wallCost(p) {
  return FENCES[p.fence].per;
}

// How much bashing this paddock's fence can take when it is new
function padMax(p) {
  return state.tech.fence ? FENCES[p.fence].hp * 1.5 : FENCES[p.fence].hp;
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
  if (!inPark(i, k)) return "That is off the edge of the island";
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
  const key = keyOf(i, k);
  state.money -= TOOLS[type].cost;
  state.tiles[key] = type;
  if (type === "station") state.stations.push(key);
  if (type === "lab" || type === "camp") state.labs[key] = { job: null };
  refreshPark();
  return "";
}

// Can a paddock go here? (i0, k0) and (i1, k1) are two opposite corners.
function whyNoPad(i0, k0, i1, k1, kind) {
  const wide = i1 - i0 + 1;
  const deep = k1 - k0 + 1;
  if (!inPark(i0, k0) || !inPark(i1, k1)) return "That is off the edge of the island";
  if (wide < 3 || deep < 3) return "Make it at least 3 squares each way";
  if (wide > 20 || deep > 20) return "That is too big (20 squares at most)";
  const biome = biomeAt(i0, k0);
  for (let i = i0; i <= i1; i++) {
    for (let k = k0; k <= k1; k++) {
      if (biomeAt(i, k) !== biome) return "A paddock has to be all in one region";
      if (typeAt(i, k)) return "Something is in the way";
      if (padAt(i, k)) return "Another paddock is in the way";
    }
  }
  const cost = 2 * (wide + deep) * PADS[kind].per;
  if (state.money < cost) return "You need $" + cost;
  return "";
}

function buildPad(i0, k0, i1, k1, kind) {
  kind = kind || "land";
  const why = whyNoPad(i0, k0, i1, k1, kind);
  if (why) return why;
  const pad = { id: state.nextId++, i0: i0, k0: k0, i1: i1, k1: k1, kind: kind, fence: "wood", hp: 0, breach: null };
  pad.hp = padMax(pad);
  state.money -= fenceLength(pad) * wallCost(pad);
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
  const key = keyOf(i, k);
  if (type) {
    if (i === GATE.i && k === GATE.k) return "The gate has to stay";
    state.money += Math.floor(TOOLS[type].cost / 2);
    delete state.tiles[key];
    delete state.labs[key];
    state.stations = state.stations.filter(function (one) { return one !== key; });
    refreshPark();
    return "";
  }
  const pad = padAt(i, k);
  if (!pad) return "Nothing to take away there";
  if (state.dinos.some(function (d) { return d.pad === pad.id; })) return "Move the dinosaurs out of this paddock first";
  state.money += Math.floor(fenceLength(pad) * wallCost(pad) / 2);
  state.pads.splice(state.pads.indexOf(pad), 1);
  refreshPark();
  return "";
}

// ----- What things look like -----
function makeBuilding(type) {
  const g = new THREE.Group();
  const wood = paint(0x9a6a3a);
  const stone = paint(0xb8b8b0);
  if (type === "deck") {
    piece(g, new THREE.BoxGeometry(3.6, 0.25, 3.6), wood, 0, 1.3, 0);
    for (const x of [-1.6, 1.6]) for (const z of [-1.6, 1.6]) piece(g, new THREE.BoxGeometry(0.25, 3.7, 0.25), wood, x, 1.85, z);
    for (const s of [-1, 1]) {
      piece(g, new THREE.BoxGeometry(3.6, 0.12, 0.12), wood, 0, 2.3, s * 1.7);
      piece(g, new THREE.BoxGeometry(0.12, 0.12, 3.6), wood, s * 1.7, 2.3, 0);
    }
    piece(g, new THREE.ConeGeometry(2.9, 1.2, 4), paint(0x3a8a5a), 0, 4.2, 0).rotation.y = Math.PI / 4;
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
    ball(g, paint(0x5ad86a), 0.45, 0.4, 0.8, 0, 4.2, 0);
    ball(g, paint(0x5ad86a), 0.25, 0.25, 0.35, 0, 4.7, -0.7);
  } else if (type === "diner") {
    piece(g, new THREE.CylinderGeometry(1.9, 1.9, 2.6, 12), paint(0xf4ecd8), 0, 1.3, 0);
    piece(g, new THREE.CylinderGeometry(1.92, 1.92, 0.9, 12), new THREE.MeshPhongMaterial({ color: 0x6ac8e8, shininess: 100 }), 0, 1.7, 0);
    piece(g, new THREE.ConeGeometry(2.5, 1.4, 12), paint(0xd8442e), 0, 3.3, 0);
    ball(g, paint(0xffd23a), 0.3, 0.3, 0.3, 0, 4.2, 0);
  } else if (type === "station") {
    // A raised platform with a roof, and stairs up to it
    piece(g, new THREE.BoxGeometry(3.8, 0.4, 3.8), stone, 0, 4.8, 0);
    for (const x of [-1.6, 1.6]) for (const z of [-1.6, 1.6]) piece(g, new THREE.CylinderGeometry(0.2, 0.2, 8.4, 6), paint(0x6a7a88), x, 4.2, z);
    piece(g, new THREE.BoxGeometry(4.6, 0.3, 4.6), paint(0xd8442e), 0, 8.5, 0);
    for (let n = 0; n < 6; n++) piece(g, new THREE.BoxGeometry(1.2, 0.3, 0.6), stone, 1.3, 0.4 + n * 0.8, 1.6 - n * 0.6);
    piece(g, new THREE.BoxGeometry(2.4, 0.7, 0.1), paint(0x2a4a6a), 0, 7.6, 2.2);
  } else if (type === "lab") {
    // A white dome with a blue window band, and a dish on the roof
    piece(g, new THREE.CylinderGeometry(1.9, 1.9, 2, 12), paint(0xf4f6f8), 0, 1, 0);
    piece(g, new THREE.SphereGeometry(1.9, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), paint(0xf4f6f8), 0, 2, 0);
    piece(g, new THREE.CylinderGeometry(1.93, 1.93, 0.6, 12), new THREE.MeshPhongMaterial({ color: 0x4ac8ff, emissive: 0x1a5a7a, shininess: 100 }), 0, 1.4, 0);
    piece(g, new THREE.CylinderGeometry(0.06, 0.06, 1.4, 5), paint(0x6a7a88), 0.6, 4, 0);
    piece(g, new THREE.SphereGeometry(0.6, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2.5), paint(0xd8e0e8), 0.6, 4.9, 0).rotation.x = Math.PI + 0.5;
    // A model of a DNA twist beside the door
    for (let n = 0; n < 7; n++) ball(g, paint(n % 2 ? 0x7dff8a : 0xff7ab8), 0.14, 0.14, 0.14, -1.5 + Math.cos(n * 0.9) * 0.3, 0.4 + n * 0.3, 1.5 + Math.sin(n * 0.9) * 0.3);
  } else if (type === "camp") {
    // A big tent, a flag, a stack of crates, and a landing pad for the expedition helicopter
    const canvasPaint = paint(0xd8c890);
    piece(g, new THREE.ConeGeometry(2, 2.6, 4), canvasPaint, -0.5, 1.3, -0.4).rotation.y = Math.PI / 4;
    piece(g, new THREE.BoxGeometry(0.9, 1.2, 0.1), paint(0x5a4a2a), -0.5, 0.6, 1.02);
    piece(g, new THREE.CylinderGeometry(0.06, 0.06, 4.6, 5), paint(0x6a7a88), 1.5, 2.3, -1.4);
    piece(g, new THREE.BoxGeometry(1.1, 0.7, 0.05), bright(0xff7a2a), 2.05, 4.2, -1.4);
    piece(g, new THREE.BoxGeometry(0.8, 0.8, 0.8), wood, 1.4, 0.4, 0.2);
    piece(g, new THREE.BoxGeometry(0.7, 0.7, 0.7), wood, 1.5, 1.15, 0.3).rotation.y = 0.5;
    piece(g, new THREE.CylinderGeometry(1.1, 1.1, 0.08, 12), paint(0x4a4a50), 1.1, 0.05, 1.4);
    piece(g, new THREE.BoxGeometry(1.1, 0.02, 0.22), bright(0xffe14a), 1.1, 0.1, 1.4);
  } else if (type === "plants" || type === "meat" || type === "fish") {
    piece(g, new THREE.BoxGeometry(2.6, 0.7, 1.4), wood, 0, 0.35, 0);
    const food = { plants: [0x3fa84a, 0x6ad85a], meat: [0xd8443a, 0xf08a7a], fish: [0x8ab8d8, 0xc8d8e8] }[type];
    for (let n = 0; n < 6; n++) ball(g, paint(food[n % 2]), type === "fish" ? 0.55 : 0.45, 0.3, type === "fish" ? 0.25 : 0.5, -1 + n * 0.4, 0.85, (n % 3 - 1) * 0.3);
  } else if (type === "tree") {
    piece(g, new THREE.CylinderGeometry(0.25, 0.4, 3, 6), paint(0x6a4a2a), 0, 1.5, 0);
    ball(g, paint(0x3aa04a), 1.7, 1.4, 1.7, 0, 3.8, 0);
    ball(g, paint(0x4ab85a), 1.1, 1, 1.1, 0.6, 4.7, 0.3);
  } else if (type === "flowers") {
    piece(g, new THREE.BoxGeometry(3.2, 0.3, 3.2), paint(0x6a4a2a), 0, 0.15, 0);
    for (let n = 0; n < 16; n++) ball(g, paint([0xff5a8a, 0xffd23a, 0xc87aff, 0xffffff, 0xff8a3a][n % 5]), 0.26, 0.2, 0.26, -1.1 + (n % 4) * 0.75, 0.45, -1.1 + Math.floor(n / 4) * 0.75);
  } else if (type === "bench") {
    piece(g, new THREE.BoxGeometry(2.4, 0.14, 0.7), wood, 0, 0.55, 0);
    piece(g, new THREE.BoxGeometry(2.4, 0.7, 0.12), wood, 0, 0.95, -0.35);
    for (const x of [-1, 1]) piece(g, new THREE.BoxGeometry(0.14, 0.55, 0.6), paint(0x2a2a30), x, 0.27, 0);
  } else if (type === "lamp") {
    piece(g, new THREE.CylinderGeometry(0.08, 0.14, 4, 6), paint(0x2a2a30), 0, 2, 0);
    piece(g, ballShape, bright(0xffe9a0), 0, 4.2, 0).scale.setScalar(0.38);
  } else if (type === "fountain") {
    piece(g, new THREE.CylinderGeometry(1.8, 1.9, 0.6, 14), stone, 0, 0.3, 0);
    piece(g, new THREE.CylinderGeometry(1.6, 1.6, 0.1, 14), new THREE.MeshPhongMaterial({ color: 0x5ac8ff, shininess: 120 }), 0, 0.62, 0);
    piece(g, new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8), stone, 0, 1.2, 0);
    piece(g, new THREE.CylinderGeometry(0.9, 0.4, 0.3, 10), stone, 0, 2, 0);
    for (let n = 0; n < 6; n++) ball(g, new THREE.MeshBasicMaterial({ color: 0xbfefff }), 0.12, 0.5, 0.12, Math.cos(n) * 0.6, 2.4, Math.sin(n) * 0.6);
  } else if (type === "statue") {
    piece(g, new THREE.BoxGeometry(2.4, 1.2, 2.4), stone, 0, 0.6, 0);
    const gold = new THREE.MeshPhongMaterial({ color: 0xffc83a, shininess: 90, flatShading: true });
    ball(g, gold, 0.5, 0.6, 1, 0, 2.4, 0.1);
    ball(g, gold, 0.36, 0.34, 0.6, 0, 3.1, -0.9);
    piece(g, new THREE.ConeGeometry(0.35, 1.8, 6), gold, 0, 2.3, 1.3).rotation.x = Math.PI / 2;
    for (const x of [-0.3, 0.3]) piece(g, new THREE.CylinderGeometry(0.14, 0.12, 1.1, 5), gold, x, 1.7, 0.2);
  }
  return g;
}

const FENCE_LOOKS = {
  wood: { post: 0x7a4a2a, rail: 0x9a6a3a, rails: [0.8, 1.6] },
  steel: { post: 0x6a7a88, rail: 0xa8b8c4, rails: [0.8, 1.7, 2.6] },
  electric: { post: 0x2a2a30, rail: 0xffe14a, rails: [0.7, 1.5, 2.3, 3.1, 3.8] },
};

// Build the fence round a paddock
function makeFence(p) {
  const g = new THREE.Group();
  const x0 = p.i0 * TILE - HALF;
  const z0 = p.k0 * TILE - HALF;
  const wide = p.i1 - p.i0 + 1;
  const deep = p.k1 - p.k0 + 1;
  const look = FENCE_LOOKS[p.fence];
  const high = FENCES[p.fence].high;
  const postPaint = paint(look.post);
  g.userData.postPaint = postPaint;
  const railPaint = p.fence === "electric" ? new THREE.MeshBasicMaterial({ color: look.rail }) : paint(look.rail);
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
  // All the posts are one shape drawn many times, and so are the rails (that is fast)
  const whole = runs.filter(function (run) { return !(p.breach && Math.hypot(run.x - p.breach.x, run.z - p.breach.z) < 4.2); });
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, high, 0.36), postPaint, runs.length);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, p.fence === "electric" ? 0.07 : 0.2, 0.12), railPaint, whole.length * look.rails.length + runs.length);
  let railCount = 0;
  runs.forEach(function (run, n) {
    helper.scale.set(1, 1, 1);
    helper.rotation.set(0, 0, 0);
    helper.position.set(run.x - (run.turned ? 0 : 2), high / 2, run.z - (run.turned ? 2 : 0));
    helper.updateMatrix();
    posts.setMatrixAt(n, helper.matrix);
    if (whole.includes(run)) {
      helper.rotation.y = run.turned ? Math.PI / 2 : 0;
      for (const y of look.rails) {
        helper.position.set(run.x, y, run.z);
        helper.updateMatrix();
        rails.setMatrixAt(railCount++, helper.matrix);
      }
    } else {
      // Where the fence has been smashed, there is a gap, and a rail lying on the ground
      helper.rotation.y = 0.7;
      helper.position.set(run.x + 0.6, 0.15, run.z + 0.8);
      helper.updateMatrix();
      rails.setMatrixAt(railCount++, helper.matrix);
    }
  });
  rails.count = railCount;
  posts.frustumCulled = rails.frustumCulled = false;
  posts.castShadow = rails.castShadow = true;
  g.add(posts, rails);
  return g;
}

const pathShape = new THREE.BoxGeometry(TILE, 0.12, TILE);
const pathPaint = paint(0xe0c890);
const RAIL_HIGH = 6.2;

// Take everything you have built out of the world and put it all back from the saved lists.
// (We do this whenever something is built or taken away.)
function refreshPark() {
  while (parkGroup.children.length) parkGroup.remove(parkGroup.children[0]);
  // Every path square (and the paving under every stall and station) is one shape drawn many times
  const paved = Object.keys(state.tiles).filter(function (key) { return TOOLS[state.tiles[key]].walk; });
  const paving = new THREE.InstancedMesh(pathShape, pathPaint, Math.max(1, paved.length));
  paved.forEach(function (key, n) {
    const at = key.split(",").map(Number);
    helper.position.set(mid(at[0]), 0.06, mid(at[1]));
    helper.rotation.set(0, 0, 0);
    helper.scale.set(1, 1, 1);
    helper.updateMatrix();
    paving.setMatrixAt(n, helper.matrix);
  });
  paving.count = paved.length;
  paving.frustumCulled = false;
  paving.receiveShadow = true;
  parkGroup.add(paving);
  for (const key in state.tiles) {
    const type = state.tiles[key];
    if (type === "path") continue;
    const n = key.split(",").map(Number);
    const model = shade(makeBuilding(type));
    // Decks and stalls turn to face the paddock beside them
    if (padAt(n[0] + 1, n[1])) model.rotation.y = -Math.PI / 2;
    else if (padAt(n[0] - 1, n[1])) model.rotation.y = Math.PI / 2;
    else if (padAt(n[0], n[1] - 1)) model.rotation.y = Math.PI;
    model.position.set(mid(n[0]), 0, mid(n[1]));
    parkGroup.add(model);
  }
  // Wild trees and rocks are hidden wherever something has been built on top of them
  for (const key in wild) showWild(key, !state.tiles[key]);
  for (const id in padGroups) delete padGroups[id];
  for (const p of state.pads) {
    padGroups[p.id] = makeFence(p);
    parkGroup.add(padGroups[p.id]);
  }

  // The monorail: a beam on tall legs from each station to the next, and back round to the first
  railStops = state.stations.map(function (key) {
    const n = key.split(",").map(Number);
    return { i: n[0], k: n[1], x: mid(n[0]), z: mid(n[1]) };
  });
  const legs = railStops.length < 2 ? 0 : railStops.length === 2 ? 1 : railStops.length;
  const beamPaint = paint(0xe8ecf0);
  for (let n = 0; n < legs; n++) {
    const a = railStops[n];
    const b = railStops[(n + 1) % railStops.length];
    const long = Math.hypot(b.x - a.x, b.z - a.z);
    const beam = piece(parkGroup, new THREE.BoxGeometry(0.7, 0.6, long), beamPaint, (a.x + b.x) / 2, RAIL_HIGH, (a.z + b.z) / 2);
    beam.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    beam.castShadow = true;
    for (let far = 14; far < long - 8; far += 16) {
      piece(parkGroup, new THREE.CylinderGeometry(0.3, 0.4, RAIL_HIGH, 6), paint(0x8a9aa8), a.x + (b.x - a.x) * far / long, RAIL_HIGH / 2, a.z + (b.z - a.z) * far / long).castShadow = true;
    }
  }
  findReach();
}

// ----- Finding the way -----
// The squares you can step to from this one. From a station you can also ride to any other station.
function stepsFrom(i, k) {
  const list = [[i + 1, k], [i - 1, k], [i, k + 1], [i, k - 1]];
  if (railStops.length > 1 && typeAt(i, k) === "station") {
    for (const stop of railStops) {
      if (stop.i !== i || stop.k !== k) list.push([stop.i, stop.k]);
    }
  }
  return list;
}

// Work out how far every walkable square is from the gate, one step at a time.
// ("Breadth-first search": do all the squares 1 step away, then 2 steps away, and so on.)
function findReach() {
  reach.fill(-1);
  const todo = [[GATE.i, GATE.k]];
  reach[GATE.k * SIZE + GATE.i] = 0;
  while (todo.length) {
    const at = todo.shift();
    for (const next of stepsFrom(at[0], at[1])) {
      const i = next[0];
      const k = next[1];
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
    for (const next of stepsFrom(at % SIZE, Math.floor(at / SIZE))) {
      const ni = next[0];
      const nk = next[1];
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

// Can visitors see into this paddock? (Is there a viewing deck beside it that they can get to?)
function padSeen(p) {
  for (const key in state.tiles) {
    if (state.tiles[key] !== "deck") continue;
    const n = key.split(",").map(Number);
    if (!canReach(n[0], n[1])) continue;
    if (padAt(n[0] + 1, n[1]) === p || padAt(n[0] - 1, n[1]) === p || padAt(n[0], n[1] + 1) === p || padAt(n[0], n[1] - 1) === p) return true;
  }
  return false;
}

const SHOP_MONEY = { snack: 8, gift: 15, diner: 25 };

// Everywhere a visitor might want to go: decks and shops they can get to
function attractions() {
  const list = [];
  for (const key in state.tiles) {
    const type = state.tiles[key];
    if (type !== "deck" && !SHOP_MONEY[type]) continue;
    const n = key.split(",").map(Number);
    if (canReach(n[0], n[1])) list.push({ type: type, i: n[0], k: n[1] });
  }
  return list;
}

// ----- Stars -----
// Count up the park's rating points, and turn them into stars
function rate() {
  let points = 0;
  let pretty = 0;
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
    // The first of a kind is worth the most. More of the same kind are worth a bit less each.
    points += SPECIES[d.kind].appeal * (kinds.has(d.kind) ? 0.5 : 1) * (0.4 + 0.6 * d.grow) * (d.comfort > 50 ? 1 : 0.5);
    kinds.add(d.kind);
  }
  points += kinds.size * 3;
  const shops = { snack: 0, gift: 0, diner: 0 };
  for (const spot of attractions()) {
    if (shops[spot.type] !== undefined) shops[spot.type]++;
  }
  points += Math.min(shops.snack, 2) * 2 + Math.min(shops.gift, 2) * 3 + Math.min(shops.diner, 2) * 4;
  // Pretty things add up (to a point). So does showing dinosaurs in more regions of the island.
  for (const key in state.tiles) pretty += TOOLS[state.tiles[key]].pretty || 0;
  points += Math.min(20, pretty);
  const regions = new Set();
  for (const pad of state.pads) {
    if (seen[pad.id]) regions.add(padBiome(pad));
  }
  state.regions = regions.size;
  points += Math.max(0, regions.size - 1) * 5;
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
    route: [[GATE.i, GATE.k]], doing: "walk", wait: 0, ride: 0, at: null, visits: 0, joy: 0, wants: 3 + Math.floor(Math.random() * 3),
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
  const cap = Math.min(MAX_GUESTS, 15 + 22 * state.stars);
  state.nextGuest -= dt;
  if (state.nextGuest <= 0 && guests.length < cap) {
    state.nextGuest = (spots ? 9 : 30) / (state.stars + 0.6);
    addGuest();
  }
  // Tour guides make every visit more fun
  const fun = 1 + Math.min(5, state.staff.guide) * 0.1;

  for (let n = guests.length - 1; n >= 0; n--) {
    const g = guests[n];
    // Riding the monorail: out of sight until the train gets there
    if (g.ride > 0) {
      g.ride -= dt;
      continue;
    }
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
        state.money += Math.min(60, Math.round(g.joy * 1.5));
        state.served++;
        guests.splice(n, 1);
        continue;
      }
      g.visits++;
      if (g.goal && g.goal.type === "deck") {
        const pad = padBeside(g.goal.i, g.goal.k);
        if (pad) {
          for (const d of state.dinos) {
            if (d.pad === pad.id && !d.loose && d.mood !== "egg") g.joy += SPECIES[d.kind].appeal * (0.4 + 0.6 * d.grow) * fun;
          }
        }
        g.wait = 5 + Math.random() * 4;
      } else if (g.goal) {
        state.money += SHOP_MONEY[g.goal.type];
        g.wait = g.goal.type === "diner" ? 6 : 3;
      } else {
        sendGuest(g);
      }
      continue;
    }
    // From one station to another station that is not next door: take the train
    if (g.at && typeAt(g.at[0], g.at[1]) === "station" && typeAt(next[0], next[1]) === "station" && Math.abs(g.at[0] - next[0]) + Math.abs(g.at[1] - next[1]) > 1) {
      g.ride = 3 + Math.hypot(next[0] - g.at[0], next[1] - g.at[1]) * TILE / 24;
      g.x = mid(next[0]);
      g.z = mid(next[1]);
      g.at = next;
      g.route.shift();
      continue;
    }
    // Walk to the middle of the next square (each visitor keeps a little to one side)
    const tx = mid(next[0]) + g.side;
    const tz = mid(next[1]) + g.side * 0.6;
    const far = Math.hypot(tx - g.x, tz - g.z);
    const speed = g.scared ? 6 : 2.4;
    if (far < speed * dt + 0.1) {
      g.x = tx;
      g.z = tz;
      g.at = next;
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
    const up = g.ride > 0 ? -50 : g.goal && g.goal.type === "deck" && g.wait > 0 ? 1.4 : 0;
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
