// Farshore: your base.
// A base is made of room blocks on a big invisible grid, like building bricks.
// Rooms that touch each other join up: the wall between them disappears.
// Every room has a ladder in one corner, which goes up to the room above (or onto the roof).
// You can build on land, under the sea (the rooms stay full of air) or on top of other rooms.

const baseGroup = new THREE.Group();
scene.add(baseGroup);
let cellSet = new Set();   // quick way to ask "is there a room here?"
let cellList = [];         // every room as { i, j, k }
const itemModels = [];     // the furniture models, in the same order as state.items

// The four ways a wall can face: 0 = east (+x), 1 = south (+z), 2 = west (-x), 3 = north (-z)
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function keyOf(i, j, k) {
  return i + "," + j + "," + k;
}

function hasCell(i, j, k) {
  return cellSet.has(keyOf(i, j, k));
}

function faceKind(i, j, k, d) {
  return state.faces[keyOf(i, j, k) + "," + d] || "wall";
}

// The room you are standing in (only makes sense while you are indoors)
function myCell() {
  return { i: Math.floor(me.x / CELL), j: me.level, k: Math.floor(me.z / CELL) };
}

// ----- What rooms and furniture look like -----
const panelPaint = paint(0xeef2f4);
const trimPaint = paint(0x2fb8a8);
const floorPaint = paint(0xc9b592);
const roofPaint = paint(0xd8e2e6);
const legPaint = paint(0x5a6a72);
const glassPaint = new THREE.MeshPhongMaterial({ color: 0xa8ecff, transparent: true, opacity: 0.3, shininess: 120, side: THREE.DoubleSide });
const shimmerPaint = new THREE.MeshBasicMaterial({ color: 0x8ffff0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
const legShape = new THREE.CylinderGeometry(0.14, 0.14, 1, 6);

function buildCell(i, j, k) {
  const g = new THREE.Group();
  g.position.set(i * CELL, j * TALL, k * CELL);
  piece(g, new THREE.BoxGeometry(CELL, 0.2, CELL), floorPaint, 2, 0.1, 2);
  if (!hasCell(i, j + 1, k)) {
    piece(g, new THREE.BoxGeometry(CELL + 0.3, 0.2, CELL + 0.3), roofPaint, 2, TALL - 0.1, 2);
    piece(g, new THREE.BoxGeometry(0.9, 0.06, 0.9), trimPaint, 3.3, TALL + 0.02, 3.3);   // the roof hatch
  }
  // The four walls. No wall where another room joins on.
  for (let d = 0; d < 4; d++) {
    const n = DIRS[d];
    if (hasCell(i + n[0], j, k + n[1])) continue;
    const wall = new THREE.Group();
    wall.position.set(2 + n[0] * 1.93, 0, 2 + n[1] * 1.93);
    if (n[0]) wall.rotation.y = Math.PI / 2;
    const kind = faceKind(i, j, k, d);
    if (kind === "window") {
      piece(wall, new THREE.BoxGeometry(CELL, 0.9, 0.14), panelPaint, 0, 0.65, 0);
      piece(wall, new THREE.BoxGeometry(CELL, 0.5, 0.14), panelPaint, 0, 2.75, 0);
      piece(wall, new THREE.BoxGeometry(CELL - 0.3, 1.4, 0.05), glassPaint, 0, 1.8, 0);
    } else if (kind === "door") {
      piece(wall, new THREE.BoxGeometry(1.25, 2.8, 0.14), panelPaint, -1.375, 1.6, 0);
      piece(wall, new THREE.BoxGeometry(1.25, 2.8, 0.14), panelPaint, 1.375, 1.6, 0);
      piece(wall, new THREE.BoxGeometry(1.5, 0.6, 0.14), trimPaint, 0, 2.7, 0);
      piece(wall, new THREE.PlaneGeometry(1.5, 2.2), shimmerPaint, 0, 1.3, 0);
      // Steps down to the ground outside, if the door is up in the air
      const drop = j * TALL - groundAt(i * CELL + 2 + n[0] * 3.4, k * CELL + 2 + n[1] * 3.4);
      if (j * TALL > -0.5 && drop > 0.3 && drop < 4.5) {
        for (let s = 0; s < 4; s++) {
          const high = drop * (1 - s / 4) + 0.4;
          const step = piece(g, new THREE.BoxGeometry(n[0] ? 0.55 : 1.5, high, n[0] ? 1.5 : 0.55), floorPaint, 2 + n[0] * (2.3 + s * 0.5), 0.15 - s * drop / 4 - high / 2, 2 + n[1] * (2.3 + s * 0.5));
          step.userData.step = true;
        }
      }
    } else {
      piece(wall, new THREE.BoxGeometry(CELL, 2.8, 0.14), panelPaint, 0, 1.6, 0);
    }
    g.add(wall);
  }
  // Corner posts, and legs down to the ground if the room is up in the air
  const below = hasCell(i, j - 1, k);
  for (const cx of [0, CELL]) {
    for (const cz of [0, CELL]) {
      piece(g, new THREE.BoxGeometry(0.24, TALL, 0.24), trimPaint, cx, TALL / 2, cz);
      const ground = groundAt(i * CELL + cx, k * CELL + cz);
      if (!below && j * TALL - ground > 0.15) {
        const leg = new THREE.Mesh(legShape, legPaint);
        stretch(leg, new THREE.Vector3(cx, ground - j * TALL - 0.4, cz), new THREE.Vector3(cx, 0, cz));
        g.add(leg);
      }
    }
  }
  // The ladder in the corner
  for (const side of [-0.25, 0.25]) piece(g, new THREE.BoxGeometry(0.07, 2.8, 0.07), trimPaint, 3.3 + side, 1.6, 3.78);
  for (let y = 0.5; y < 3; y += 0.45) piece(g, new THREE.BoxGeometry(0.5, 0.06, 0.06), trimPaint, 3.3, y, 3.78);
  return g;
}

function makeItem(kind) {
  const g = new THREE.Group();
  const wood = paint(0xb98a5a);
  if (kind === "bed") {
    piece(g, new THREE.BoxGeometry(1.1, 0.35, 2), wood, 0, 0.2, 0);
    piece(g, new THREE.BoxGeometry(1, 0.2, 1.9), paint(0x4ab8d8), 0, 0.45, 0);
    piece(g, new THREE.BoxGeometry(0.8, 0.16, 0.45), paint(0xffffff), 0, 0.6, -0.65);
  } else if (kind === "bench") {
    piece(g, new THREE.BoxGeometry(1.8, 0.14, 0.8), wood, 0, 0.9, 0);
    for (const x of [-0.8, 0.8]) piece(g, new THREE.BoxGeometry(0.12, 0.9, 0.7), wood, x, 0.45, 0);
    piece(g, new THREE.BoxGeometry(0.5, 0.3, 0.4), paint(0xff7a3a), -0.4, 1.1, 0);
    piece(g, new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5), paint(0x8a8a98), 0.5, 1.25, 0).rotation.z = 0.5;
  } else if (kind === "planter") {
    piece(g, new THREE.CylinderGeometry(0.45, 0.35, 0.5, 8), paint(0xc8643a), 0, 0.25, 0);
    piece(g, new THREE.SphereGeometry(0.55, 8, 6), paint(0x3fb86a), 0, 0.9, 0);
    g.userData.fruit = piece(g, new THREE.SphereGeometry(0.2, 8, 6), paint(0xff9a2a, 0x7a3a00), 0.3, 1.2, 0.3);
  } else if (kind === "lamp") {
    piece(g, new THREE.CylinderGeometry(0.05, 0.2, 1.5, 6), legPaint, 0, 0.75, 0);
    piece(g, new THREE.SphereGeometry(0.25, 8, 6), bright(0xfff0b0), 0, 1.6, 0);
    const halo = glow(0xffe8a0, 3.5);
    halo.position.y = 1.6;
    g.add(halo);
  } else if (kind === "table") {
    piece(g, new THREE.CylinderGeometry(0.7, 0.7, 0.1, 10), wood, 0, 0.75, 0);
    piece(g, new THREE.CylinderGeometry(0.1, 0.2, 0.75, 6), wood, 0, 0.37, 0);
    piece(g, new THREE.ConeGeometry(0.14, 0.3, 6), paint(0xffb8d0), 0.2, 0.92, 0.1).rotation.z = 1.3;
  } else if (kind === "bowl") {
    piece(g, new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8), wood, 0, 0.4, 0);
    piece(g, new THREE.SphereGeometry(0.4, 12, 8), glassPaint, 0, 1.15, 0);
    g.userData.fish = piece(g, new THREE.SphereGeometry(0.09, 6, 5), bright(0xffb84a), 0.15, 1.15, 0);
  }
  return g;
}

// Take the whole base out of the world and build it again from the saved lists.
// (We do this every time something in the base changes.)
function rebuildBase() {
  while (baseGroup.children.length) baseGroup.remove(baseGroup.children[0]);
  cellSet = new Set(state.cells);
  cellList = state.cells.map(function (key) {
    const n = key.split(",").map(Number);
    return { i: n[0], j: n[1], k: n[2] };
  });
  for (const c of cellList) baseGroup.add(buildCell(c.i, c.j, c.k));
  itemModels.length = 0;
  for (const item of state.items) {
    const model = makeItem(item.kind);
    model.position.set(item.x, item.y, item.z);
    model.rotation.y = item.turn;
    baseGroup.add(model);
    itemModels.push(model);
  }
}

// ----- Building -----
// The lowest level a room can sit at here, so the ground doesn't poke up through its floor
function groundLevel(i, k) {
  let top = groundAt(i * CELL + 2, k * CELL + 2);
  for (const cx of [0, CELL]) {
    for (const cz of [0, CELL]) top = Math.max(top, groundAt(i * CELL + cx, k * CELL + cz));
  }
  return Math.ceil((top - 0.3) / TALL);
}

function lookWay() {
  return { x: -Math.sin(me.yaw) * Math.cos(me.pitch), y: Math.sin(me.pitch), z: -Math.cos(me.yaw) * Math.cos(me.pitch) };
}

// Which way is "ahead" as one of the four wall directions?
function facing() {
  const way = lookWay();
  if (Math.abs(way.x) > Math.abs(way.z)) return way.x > 0 ? 0 : 2;
  return way.z > 0 ? 1 : 3;
}

// Is there a room right next to this space (beside, above or below)?
function touches(i, j, k) {
  return hasCell(i + 1, j, k) || hasCell(i - 1, j, k) || hasCell(i, j, k + 1) || hasCell(i, j, k - 1) || hasCell(i, j + 1, k) || hasCell(i, j - 1, k);
}

// Where would a new room go, and is that allowed?
function roomTarget() {
  const way = lookWay();
  let i;
  let j;
  let k;
  if (me.indoor) {
    // Indoors: the next space over, or above if you look up, or below if you look down
    const c = myCell();
    i = c.i;
    j = c.j;
    k = c.k;
    if (way.y > 0.7) j++;
    else if (way.y < -0.7) j--;
    else {
      const n = DIRS[facing()];
      while (hasCell(i, j, k)) {
        i += n[0];
        k += n[1];
      }
    }
  } else {
    // Outdoors: the space about 5 metres in front of you
    const flat = Math.hypot(way.x, way.z) || 1;
    i = Math.floor((me.x + way.x / flat * 5) / CELL);
    k = Math.floor((me.z + way.z / flat * 5) / CELL);
    j = Math.max(groundLevel(i, k), Math.floor((me.y + way.y * 6 - 0.2) / TALL));
    // Up in the air and not touching another room? Then it goes on the ground instead.
    if (!touches(i, j, k)) j = groundLevel(i, k);
  }
  const cx = i * CELL + 2;
  const cz = k * CELL + 2;
  const low = groundLevel(i, k);
  const touching = touches(i, j, k);
  let why = "";
  if (!canPay(PARTS.room.cost)) why = "You need " + costText(PARTS.room.cost);
  else if (hasCell(i, j, k)) why = "There is already a room there";
  else if (Math.hypot(cx, cz) > EDGE - 20) why = "Too far out to sea";
  else if (j < low) why = "The ground is in the way";
  else if (j > low && !touching) why = "Too high: build it on the ground, or touching another room";
  else if (!me.indoor && me.y - 1.6 - j * TALL > 11) why = "Go down closer to the ground to build here";
  else if (Math.hypot(cx - STACK.x, cz - STACK.z) < STACK.r + 2.4 || Math.hypot(cx - TOWER.x, cz - TOWER.z) < 10) why = "Too close to the rock";
  else if (STONES.some(function (s) { return Math.hypot(cx - s.x, cz - s.z) < 4; })) why = "Too close to a star stone";
  else if (solids.some(function (s) { return s.top > j * TALL + 0.3 && Math.abs(s.x - cx) < 2 + s.r && Math.abs(s.z - cz) < 2 + s.r; })) why = "A tree or a rock is in the way";
  else if (!me.indoor && Math.abs(me.x - cx) < 2.4 && Math.abs(me.z - cz) < 2.4 && me.y > j * TALL && me.y - 1.6 < j * TALL + TALL) why = "Step back a little";
  return { i: i, j: j, k: k, why: why, alone: !touching };
}

function placeRoom() {
  const spot = roomTarget();
  if (spot.why) return say(spot.why, 3) && false;
  pay(PARTS.room.cost);
  const key = keyOf(spot.i, spot.j, spot.k);
  state.cells.push(key);
  // The first room of a new base gets a door on the side nearest to you
  if (spot.alone) {
    const dx = me.x - (spot.i * CELL + 2);
    const dz = me.z - (spot.k * CELL + 2);
    const d = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0 : 2) : (dz > 0 ? 1 : 3);
    state.faces[key + "," + d] = "door";
  }
  rebuildBase();
  soundBuild();
  say(spot.alone ? "Room built! Walk up to its glowing door and press E to go in." : "Room built!", 4);
  return true;
}

// Follow your eyes until they hit a room. Gives the room and which of its walls you are looking at.
function lookCell() {
  const way = lookWay();
  let last = null;
  for (let far = 0.2; far < 9; far += 0.2) {
    const x = me.x + way.x * far;
    const y = me.y + way.y * far;
    const z = me.z + way.z * far;
    const c = { i: Math.floor(x / CELL), j: Math.floor(y / TALL), k: Math.floor(z / CELL) };
    if (hasCell(c.i, c.j, c.k)) {
      let d = -1;
      if (last && last.i !== c.i) d = last.i > c.i ? 0 : 2;
      else if (last && last.k !== c.k) d = last.k > c.k ? 1 : 3;
      return { i: c.i, j: c.j, k: c.k, d: d };
    }
    last = c;
  }
  return null;
}

// The outside wall you are looking at (from inside or outside)
function faceTarget() {
  if (!me.indoor) {
    const hit = lookCell();
    return hit && hit.d >= 0 ? hit : null;
  }
  const c = myCell();
  const d = facing();
  const n = DIRS[d];
  // Walk through the joined rooms until we reach the outside wall
  while (hasCell(c.i + n[0], c.j, c.k + n[1])) {
    c.i += n[0];
    c.k += n[1];
  }
  c.d = d;
  return c;
}

// How many doors does the base that this room belongs to have?
function doorsOf(i, j, k) {
  const seen = new Set([keyOf(i, j, k)]);
  const todo = [[i, j, k]];
  let doors = 0;
  while (todo.length) {
    const c = todo.pop();
    for (let d = 0; d < 4; d++) {
      if (faceKind(c[0], c[1], c[2], d) === "door" && !hasCell(c[0] + DIRS[d][0], c[1], c[2] + DIRS[d][1])) doors++;
    }
    for (const n of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const next = [c[0] + n[0], c[1] + n[1], c[2] + n[2]];
      const key = keyOf(next[0], next[1], next[2]);
      if (cellSet.has(key) && !seen.has(key)) {
        seen.add(key);
        todo.push(next);
      }
    }
  }
  return doors;
}

// Turn the wall you are looking at into a door, a window, or a plain wall again
function setFace(kind) {
  const f = faceTarget();
  if (!f) return say("Look at an outside wall of one of your rooms", 3) && false;
  const now = faceKind(f.i, f.j, f.k, f.d);
  if (now === kind) return say("That wall is already a " + kind, 2) && false;
  if (now === "door" && doorsOf(f.i, f.j, f.k) <= 1) return say("That is the only door! Make another door first.", 3) && false;
  if (!canPay(PARTS[kind].cost)) return say("You need " + costText(PARTS[kind].cost), 3) && false;
  pay(PARTS[kind].cost);
  const key = keyOf(f.i, f.j, f.k) + "," + f.d;
  if (kind === "wall") delete state.faces[key];
  else state.faces[key] = kind;
  rebuildBase();
  soundBuild();
  say(PARTS[kind].name + " built!", 2);
  return true;
}

// Put a piece of furniture on the floor in front of you
function placeItem(kind) {
  if (!me.indoor) return say("Go inside a room to build a " + PARTS[kind].name, 3) && false;
  if (!canPay(PARTS[kind].cost)) return say("You need " + costText(PARTS[kind].cost), 3) && false;
  const c = myCell();
  const x = clamp(me.x - Math.sin(me.yaw) * 1.6, c.i * CELL + 0.7, c.i * CELL + CELL - 0.7);
  const z = clamp(me.z - Math.cos(me.yaw) * 1.6, c.k * CELL + 0.7, c.k * CELL + CELL - 0.7);
  pay(PARTS[kind].cost);
  state.items.push({ kind: kind, x: x, y: c.j * TALL + 0.2, z: z, turn: me.yaw, ripe: state.time + 45 });
  rebuildBase();
  soundBuild();
  say(PARTS[kind].name + " built!", 2);
  return true;
}

function giveBack(cost) {
  for (const kind in cost) state.inv[kind] = (state.inv[kind] || 0) + cost[kind];
}

// Pack up a piece of furniture (indoors) or a whole room (from outside). You get everything back.
function packUp() {
  if (me.indoor) {
    const near = itemNear(2.4);
    if (!near) return say("Stand by a piece of furniture to pack it up. To pack up a room, go outside and look at it.", 4) && false;
    giveBack(PARTS[near.kind].cost);
    state.items.splice(state.items.indexOf(near), 1);
    rebuildBase();
    say(PARTS[near.kind].name + " packed up", 2);
    return true;
  }
  const hit = lookCell();
  if (!hit) return say("Look at one of your rooms to pack it up", 3) && false;
  const key = keyOf(hit.i, hit.j, hit.k);
  giveBack(PARTS.room.cost);
  // The furniture inside comes back too
  state.items = state.items.filter(function (item) {
    const inside = Math.floor(item.x / CELL) === hit.i && Math.floor(item.z / CELL) === hit.k && Math.round((item.y - 0.2) / TALL) === hit.j;
    if (inside) giveBack(PARTS[item.kind].cost);
    return !inside;
  });
  state.cells = state.cells.filter(function (one) { return one !== key; });
  for (let d = 0; d < 4; d++) delete state.faces[key + "," + d];
  cellSet.delete(key);
  // If that room had the only door, the rooms left behind get a new door where it used to join on
  for (let d = 0; d < 4; d++) {
    const ni = hit.i + DIRS[d][0];
    const nk = hit.k + DIRS[d][1];
    if (hasCell(ni, hit.j, nk) && doorsOf(ni, hit.j, nk) === 0) state.faces[keyOf(ni, hit.j, nk) + "," + ((d + 2) % 4)] = "door";
  }
  for (const nj of [hit.j + 1, hit.j - 1]) {
    if (!hasCell(hit.i, nj, hit.k) || doorsOf(hit.i, nj, hit.k) > 0) continue;
    for (let d = 0; d < 4; d++) {
      if (!hasCell(hit.i + DIRS[d][0], nj, hit.k + DIRS[d][1])) {
        state.faces[keyOf(hit.i, nj, hit.k) + "," + d] = "door";
        break;
      }
    }
  }
  rebuildBase();
  soundBuild();
  say("Room packed up. You got everything back.", 3);
  return true;
}

// ----- Doors and ladders -----
// The door close enough to use: { i, j, k, d } or nothing
function doorNear() {
  const feet = me.y - 1.6;
  for (const key in state.faces) {
    if (state.faces[key] !== "door") continue;
    const n = key.split(",").map(Number);
    const way = DIRS[n[3]];
    if (!hasCell(n[0], n[1], n[2]) || hasCell(n[0] + way[0], n[1], n[2] + way[1])) continue;
    const x = n[0] * CELL + 2 + way[0] * 2;
    const z = n[2] * CELL + 2 + way[1] * 2;
    if (me.indoor) {
      if (me.level === n[1] && Math.hypot(me.x - (x - way[0] * 0.7), me.z - (z - way[1] * 0.7)) < 1.7) return { i: n[0], j: n[1], k: n[2], d: n[3], x: x, z: z };
    } else if (Math.hypot(me.x - (x + way[0]), me.z - (z + way[1])) < 2.5 && feet > n[1] * TALL - 4.5 && feet < n[1] * TALL + 2.4) {
      return { i: n[0], j: n[1], k: n[2], d: n[3], x: x, z: z };
    }
  }
  return null;
}

// Step through a door: in if you are outside, out if you are inside
function useDoor(door) {
  const way = DIRS[door.d];
  if (me.indoor) {
    me.indoor = false;
    me.x = door.x + way[0] * 1.3;
    me.z = door.z + way[1] * 1.3;
    me.y = door.j * TALL + 1.75;
  } else {
    me.indoor = true;
    me.level = door.j;
    me.x = door.x - way[0] * 1.1;
    me.z = door.z - way[1] * 1.1;
    me.y = door.j * TALL + 1.8;
  }
  me.vy = 0;
  soundDoor();
}

// Are you at a ladder? Says which ways you can climb.
function ladderNear() {
  if (me.indoor) {
    const c = myCell();
    if (Math.hypot(me.x - (c.i * CELL + 3.3), me.z - (c.k * CELL + 3.4)) > 1.5) return null;
    return { up: hasCell(c.i, c.j + 1, c.k) ? "room" : "roof", down: hasCell(c.i, c.j - 1, c.k) };
  }
  // Standing on a roof, by its hatch?
  const i = Math.floor(me.x / CELL);
  const k = Math.floor(me.z / CELL);
  const j = Math.round((me.y - 1.6) / TALL) - 1;
  if (!hasCell(i, j, k) || hasCell(i, j + 1, k) || Math.abs(me.y - 1.6 - (j + 1) * TALL) > 0.6) return null;
  if (Math.hypot(me.x - (i * CELL + 3.3), me.z - (k * CELL + 3.3)) > 1.6) return null;
  return { roof: true, j: j };
}

// Climb the ladder: way = 1 for up, -1 for down
function climb(way) {
  const ladder = ladderNear();
  if (!ladder) return false;
  const c = myCell();
  if (ladder.roof) {
    if (way > 0) return false;
    me.indoor = true;
    me.level = ladder.j;
  } else if (way > 0 && ladder.up === "room") {
    me.level++;
  } else if (way > 0) {
    // Out through the hatch, onto the roof
    me.indoor = false;
    me.x = c.i * CELL + 2.7;
    me.z = c.k * CELL + 2.7;
    me.y = (c.j + 1) * TALL + 1.65;
    me.vy = 0;
    me.noJump = 0.4;
    soundDoor();
    return true;
  } else if (ladder.down) {
    me.level--;
  } else {
    return false;
  }
  me.y = me.level * TALL + 1.8;
  me.vy = 0;
  me.noJump = 0.4;
  soundDoor();
  return true;
}

// ----- Walls are solid -----
// Indoors: you can walk through joined rooms, but not through walls
function clampIndoors() {
  const c = myCell();
  if (!hasCell(c.i, c.j, c.k)) {
    // Somehow outside the rooms (a room was packed up?): you are simply outdoors now
    me.indoor = false;
    return;
  }
  const gap = 0.35;
  const lx = me.x - c.i * CELL;
  const lz = me.z - c.k * CELL;
  if (lx < gap && !hasCell(c.i - 1, c.j, c.k)) me.x = c.i * CELL + gap;
  if (lx > CELL - gap && !hasCell(c.i + 1, c.j, c.k)) me.x = c.i * CELL + CELL - gap;
  if (lz < gap && !hasCell(c.i, c.j, c.k - 1)) me.z = c.k * CELL + gap;
  if (lz > CELL - gap && !hasCell(c.i, c.j, c.k + 1)) me.z = c.k * CELL + CELL - gap;
}

// Outdoors: push you out of any room you have walked or swum into
function pushOutOfRooms() {
  const feet = me.y - 1.6;
  const gap = 0.4;
  for (const c of cellList) {
    if (feet + 1.75 < c.j * TALL || feet + 0.3 > c.j * TALL + TALL) continue;
    const x0 = c.i * CELL - gap;
    const x1 = c.i * CELL + CELL + gap;
    const z0 = c.k * CELL - gap;
    const z1 = c.k * CELL + CELL + gap;
    if (me.x <= x0 || me.x >= x1 || me.z <= z0 || me.z >= z1) continue;
    const left = me.x - x0;
    const right = x1 - me.x;
    const back = me.z - z0;
    const front = z1 - me.z;
    const least = Math.min(left, right, back, front);
    if (least === left) me.x = x0;
    else if (least === right) me.x = x1;
    else if (least === back) me.z = z0;
    else me.z = z1;
  }
}

// The highest roof under your feet (so you can stand on top of your base)
function roofUnder(x, z, feet) {
  const i = Math.floor(x / CELL);
  const k = Math.floor(z / CELL);
  let best = -999;
  for (const c of cellList) {
    if (c.i !== i || c.k !== k) continue;
    const top = c.j * TALL + TALL;
    if (top <= feet + 0.7 && top > best) best = top;
  }
  return best;
}

// The piece of furniture close enough to use
function itemNear(reach) {
  if (!me.indoor) return null;
  let best = null;
  let bestFar = reach || 2;
  for (const item of state.items) {
    if (Math.abs(item.y - 0.2 - me.level * TALL) > 0.5) continue;
    const far = Math.hypot(item.x - me.x, item.z - me.z);
    if (far < bestFar) {
      best = item;
      bestFar = far;
    }
  }
  return best;
}

// The see-through box that shows where a new room will go
const ghost = new THREE.Mesh(new THREE.BoxGeometry(CELL, TALL, CELL), new THREE.MeshBasicMaterial({ color: 0x6dff8e, transparent: true, opacity: 0.3, depthWrite: false }));
ghost.visible = false;
scene.add(ghost);
// A glowing bar that shows which wall a door or window will go on
const faceMark = new THREE.Mesh(new THREE.BoxGeometry(CELL, 2.8, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.35, depthWrite: false }));
faceMark.visible = false;
scene.add(faceMark);

// Move the furniture that moves
function moveBase(t) {
  state.items.forEach(function (item, n) {
    const parts = itemModels[n] && itemModels[n].userData;
    if (!parts) return;
    if (parts.fruit) parts.fruit.visible = state.time > item.ripe;
    if (parts.fish) parts.fish.position.set(Math.cos(t * 1.5) * 0.2, 1.15 + Math.sin(t * 2) * 0.08, Math.sin(t * 1.5) * 0.2);
  });
  shimmerPaint.opacity = 0.3 + Math.sin(t * 3) * 0.12;
}
