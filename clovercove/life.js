// Clover Cove: everything that lives and grows.
// Bugs, fish, things lying on the ground, buried treasure, and your neighbours.

// ===== 1. The map =====
function groundAt(x, z) {
  const i = tileOf(x);
  const k = tileOf(z);
  if (i < 0 || k < 0 || i >= COLS || k >= ROWS) return "edge";
  return MAP.ground[k][i];
}

// Can somebody stand here? (Not in water, and not inside a tree, a rock or a building.)
function canStand(x, z) {
  const type = groundAt(x, z);
  if (type === "edge" || type === "water") return false;
  const thing = MAP.things[tileOf(x) + "," + tileOf(z)];
  return !thing || thing.type === "flower";
}

function isNight() {
  const hour = clockHour();
  return hour >= 19 || hour < 6;
}

// Is this bug or fish about right now? (The right season, and the right time of day.)
function about(kind) {
  if (!kind.seasons.includes(season())) return false;
  return kind.time === "any" || (kind.time === "night") === isNight();
}

// Pick one from a list, where rare things are picked less often
function pickRare(list) {
  const weights = [0, 10, 5, 2, 0.6];
  let total = 0;
  for (const one of list) total += weights[one.rare];
  let roll = Math.random() * total;
  for (const one of list) {
    roll -= weights[one.rare];
    if (roll <= 0) return one;
  }
  return list[0];
}

// ===== 2. Bugs =====
const bugs = [];        // { kind, x, y, z, home, fleeing, t, hop }
let bugClock = 0;

function addBug() {
  const list = BUGS.filter(about);
  if (!list.length) return;
  const kind = pickRare(list);
  let home = null;
  if (kind.place === "flower" && flowers.length) {
    const flower = flowers[Math.floor(Math.random() * flowers.length)];
    home = { x: flower.x, z: flower.z, y: 0.9 };
  } else if (kind.place === "tree") {
    const leafy = trees.filter(function (tree) { return tree.type === "tree"; });
    const tree = leafy[Math.floor(Math.random() * leafy.length)];
    home = { x: tree.x, z: tree.z + 0.34, y: 1 };
  } else {
    // A random square of grass, or of pond or river (never the sea)
    for (let tries = 0; tries < 60 && !home; tries++) {
      const i = 2 + Math.floor(Math.random() * (COLS - 4));
      const k = 2 + Math.floor(Math.random() * 34);
      const wet = MAP.ground[k][i] === "water";
      if (kind.place === "water" ? wet : MAP.ground[k][i] === "grass" && !MAP.things[i + "," + k]) home = { x: mid(i), z: mid(k), y: kind.id === "skater" ? 0.08 : kind.place === "water" ? 1 : 0.12 };
    }
  }
  if (!home || Math.hypot(home.x - me.x, home.z - me.z) < 5) return;
  bugs.push({ kind: kind, x: home.x, y: home.y, z: home.z, home: home, fleeing: 0, t: Math.random() * 9, hop: 0 });
}

function updateBugs(dt) {
  bugClock -= dt;
  if (bugClock <= 0 && bugs.length < BUG_MAX - 2) {
    bugClock = 2.5;
    addBug();
  }
  for (let n = bugs.length - 1; n >= 0; n--) {
    const bug = bugs[n];
    bug.t += dt;
    const far = Math.hypot(bug.x - me.x, bug.z - me.z);
    if (bug.fleeing) {
      // Up and away
      bug.fleeing += dt;
      bug.y += dt * 4;
      bug.x += (bug.x - me.x) / Math.max(0.5, far) * dt * 5;
      bug.z += (bug.z - me.z) / Math.max(0.5, far) * dt * 5;
      if (bug.fleeing > 2.5) bugs.splice(n, 1);
      continue;
    }
    // Bugs are frightened by running feet. Walk, and you can get much closer.
    const scare = (me.running ? 4 : 0.8) * (bug.kind.rare > 2 ? 1.4 : 1);
    if (!inside && far < scare) {
      bug.fleeing = 0.01;
      continue;
    }
    // Things that have gone out of season fly off when nobody is near
    if (!about(bug.kind) && far > 14) {
      bugs.splice(n, 1);
      continue;
    }
    const place = bug.kind.place;
    if (place === "tree") continue;                         // sits still on its trunk
    if (place === "grass") {
      // A little hop now and then
      bug.hop -= dt;
      if (bug.hop < -3) {
        bug.hop = 0.4;
        bug.vx = (Math.random() - 0.5) * 3;
        bug.vz = (Math.random() - 0.5) * 3;
      }
      if (bug.hop > 0 && bug.kind.id !== "snail") {
        const nx = bug.x + bug.vx * dt;
        const nz = bug.z + bug.vz * dt;
        if (canStand(nx, nz)) {
          bug.x = nx;
          bug.z = nz;
        }
        bug.y = 0.12 + Math.sin((0.4 - bug.hop) / 0.4 * Math.PI) * 0.5;
      } else {
        bug.y = 0.12;
      }
      continue;
    }
    // Fliers (and pond skaters) drift round and round their home
    const wide = bug.kind.id === "skater" ? 1.2 : 1.6;
    bug.x = bug.home.x + Math.cos(bug.t * 0.9) * wide * Math.sin(bug.t * 0.37);
    bug.z = bug.home.z + Math.sin(bug.t * 0.7) * wide;
    bug.y = bug.home.y + (bug.kind.id === "skater" ? 0 : Math.sin(bug.t * 2.3) * 0.3);
  }
}

function drawBugs(t) {
  bugs.forEach(function (bug, n) {
    if (n >= BUG_MAX) return;
    const glow = bug.kind.id === "firefly" && Math.sin(t * 4 + n) > 0;
    putOne(bugBodies, n, bug.x, bug.y, bug.z, 1, 0.8, 1.3, bug.t, glow ? 0xffffff : bug.kind.colour);
    // Wings flap. (Beetles, snails and spiders keep theirs tucked away.)
    const wings = ["flower", "water"].includes(bug.kind.place) && bug.kind.id !== "skater" && bug.kind.id !== "mantis" && bug.kind.id !== "ladybird";
    for (let side = 0; side < 2; side++) {
      helper.position.set(bug.x + (side ? 0.14 : -0.14), bug.y + 0.06, bug.z);
      helper.rotation.set(-Math.PI / 2 + Math.sin(t * 22 + n) * 0.9 * (side ? 1 : -1), 0, 0);
      const size = wings ? (bug.kind.id === "emperor" ? 1.5 : 1) : 0.001;
      helper.scale.set(size, size, size);
      helper.updateMatrix();
      bugWings.setMatrixAt(n * 2 + side, helper.matrix);
      bugWings.setColorAt(n * 2 + side, tint.setHex(bug.kind.colour));
    }
  });
  bugBodies.count = Math.min(BUG_MAX, bugs.length);
  bugWings.count = bugBodies.count * 2;
  bugWings.instanceMatrix.needsUpdate = true;
  if (bugWings.instanceColor) bugWings.instanceColor.needsUpdate = true;
}

// ===== 3. Fish =====
const fishes = [];      // { kind, water, x, z, goal, lured }
let fishClock = 0;
// Every square of each kind of water, so fish can be put somewhere sensible
const waters = { river: [], pond: [], sea: [] };
for (let k = 0; k < ROWS; k++) {
  for (let i = 0; i < COLS; i++) {
    if (MAP.ground[k][i] === "water") waters[MAP.water[k][i]].push({ i: i, k: k });
  }
}

function waterAt(x, z) {
  return groundAt(x, z) === "water" ? MAP.water[tileOf(z)][tileOf(x)] : "";
}

function addFish() {
  // Keep four fish in the river, two in the pond and four in the sea
  const want = { river: 4, pond: 2, sea: 4 };
  for (const water in want) {
    if (fishes.filter(function (fish) { return fish.water === water; }).length >= want[water]) continue;
    const list = FISH.filter(function (kind) { return kind.water === water && about(kind); });
    if (!list.length) continue;
    // (Sea fish stay near the shore, where your line can reach them.)
    const squares = water === "sea" ? waters.sea.filter(function (s) { return s.k < 42; }) : waters[water];
    const spot = squares[Math.floor(Math.random() * squares.length)];
    if (Math.hypot(mid(spot.i) - me.x, mid(spot.k) - me.z) < 6) continue;
    fishes.push({ kind: pickRare(list), water: water, x: mid(spot.i), z: mid(spot.k), goal: null, lured: false, turn: 0 });
    return;
  }
}

function updateFish(dt) {
  fishClock -= dt;
  if (fishClock <= 0) {
    fishClock = 3;
    addFish();
  }
  for (const fish of fishes) {
    if (fish.lured) continue;            // (the fishing code moves a fish that is after your float)
    if (!fish.goal) {
      const gx = fish.x + (Math.random() - 0.5) * 12;
      const gz = fish.z + (Math.random() - 0.5) * 12;
      if (waterAt(gx, gz) === fish.water && (fish.water !== "sea" || gz < 42 * TILE)) fish.goal = { x: gx, z: gz, wait: 1 + Math.random() * 4 };
      continue;
    }
    const dx = fish.goal.x - fish.x;
    const dz = fish.goal.z - fish.z;
    const far = Math.hypot(dx, dz);
    if (far < 0.3) {
      fish.goal.wait -= dt;
      if (fish.goal.wait <= 0) fish.goal = null;
      continue;
    }
    const nx = fish.x + dx / far * dt * 0.9;
    const nz = fish.z + dz / far * dt * 0.9;
    if (waterAt(nx, nz) === fish.water) {
      fish.x = nx;
      fish.z = nz;
      fish.turn = Math.atan2(dx, dz);
    } else {
      fish.goal = null;
    }
  }
}

function drawFish() {
  fishes.forEach(function (fish, n) {
    if (n >= FISH_MAX) return;
    const big = 0.5 + fish.kind.size * 0.28;
    putOne(fishShadows, n, fish.x, 0.03, fish.z, big * 0.55, big, 1, 0);
    // Lie it flat on the water, pointing the way it swims
    helper.position.set(fish.x, 0.03, fish.z);
    helper.rotation.set(-Math.PI / 2, 0, -fish.turn);
    helper.scale.set(big * 0.5, big, 1);
    helper.updateMatrix();
    fishShadows.setMatrixAt(n, helper.matrix);
  });
  fishShadows.count = Math.min(FISH_MAX, fishes.length);
  fishShadows.instanceMatrix.needsUpdate = true;
}

// ===== 4. Things on the ground, and buried treasure =====
// state.items: things lying about: { id, x, z }. state.spots: star cracks: { x, z }.
function dropNear(id, x, z) {
  for (let tries = 0; tries < 20; tries++) {
    const angle = Math.random() * 6.28;
    const dx = x + Math.cos(angle) * (1.2 + Math.random() * 0.8);
    const dz = z + Math.sin(angle) * (1.2 + Math.random() * 0.8);
    if (canStand(dx, dz) && state.items.length < ITEM_MAX) {
      state.items.push({ id: id, x: dx, z: dz });
      return;
    }
  }
}

// What happens at the start of every new day
function freshDay() {
  for (const tree of trees) tree.has = !!tree.fruit;
  // New shells wash up on the beach (yesterday's are swept away)
  state.items = state.items.filter(function (item) { return !["cockle", "conch", "starfish", "coral"].includes(item.id); });
  for (let n = 0; n < 6; n++) {
    const x = 6 + Math.random() * (WIDE - 12);
    const z = mid(37) + Math.random() * 4;
    const id = ["cockle", "cockle", "cockle", "starfish", "starfish", "conch", "coral"][Math.floor(Math.random() * 7)];
    if (canStand(x, z)) state.items.push({ id: id, x: x, z: z });
  }
  // Three new star cracks, somewhere on the grass
  state.spots = [];
  while (state.spots.length < 3) {
    const i = 3 + Math.floor(Math.random() * (COLS - 6));
    const k = 3 + Math.floor(Math.random() * 31);
    if (MAP.ground[k][i] === "grass" && !MAP.things[i + "," + k]) state.spots.push({ x: mid(i), z: mid(k) });
  }
  // Two neighbours wish for something. Thistle puts out four new pieces of furniture.
  state.wants = {};
  const wishes = ["apple", "orange", "cherry", "coconut", "cockle", "starfish", "bug:white", "bug:ladybird", "fish:carp", "fish:dace", "fish:mackerel", "fish:seabass"];
  const two = NEIGHBOURS.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 2);
  for (const one of two) state.wants[one.id] = wishes[Math.floor(Math.random() * wishes.length)];
  state.stock = FURNITURE.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 4).map(function (item) { return item.id; });
  for (const id in state.friends) state.friends[id].talked = false;
  drawSeason(season());
}

function drawItems(t) {
  state.items.forEach(function (item, n) {
    if (n >= ITEM_MAX) return;
    putOne(itemMesh, n, item.x, 0.22 + Math.abs(Math.sin(t * 2 + n)) * 0.05, item.z, 1, item.id === "starfish" || item.id === "cockle" ? 0.5 : 1, 1, 0, GOODS[item.id].colour);
  });
  itemMesh.count = Math.min(ITEM_MAX, state.items.length);
  state.spots.forEach(function (spot, n) {
    helper.position.set(spot.x, 0.02, spot.z);
    helper.rotation.set(-Math.PI / 2, 0, 0.3);
    helper.scale.set(1, 1, 1);
    helper.updateMatrix();
    spotMesh.setMatrixAt(n, helper.matrix);
  });
  spotMesh.count = state.spots.length;
  spotMesh.instanceMatrix.needsUpdate = true;
}

// ===== 5. Neighbours =====
// Everybody you can talk to: { def, x, z, yaw, goal, wait, model, sign, keeper }
const folk = [];

function makeFolk() {
  for (const def of NEIGHBOURS) {
    const model = makePerson(def);
    const sign = new THREE.Sprite(SIGNS.want);
    scene.add(model.group, sign);
    folk.push({ def: def, x: (def.house.i + 1.5) * TILE, z: (def.house.k + 3) * TILE, yaw: 0, goal: null, wait: Math.random() * 4, model: model, sign: sign, keeper: "" });
  }
  // The three keepers stay at their posts
  const posts = { shop: { x: (PLACES.shop.i + 2) * TILE, z: (PLACES.shop.k + 1) * TILE + 0.2 }, cabin: { x: (PLACES.cabin.i + 1.5) * TILE + 2, z: (PLACES.cabin.k + 2) * TILE + 0.9 }, museum: { x: (PLACES.museum.i + 3) * TILE + 2, z: (PLACES.museum.k + 3) * TILE + 0.9 } };
  for (const id in KEEPERS) {
    const model = makePerson(KEEPERS[id]);
    const sign = new THREE.Sprite(SIGNS.want);
    scene.add(model.group, sign);
    folk.push({ def: KEEPERS[id], x: posts[id].x, z: posts[id].z, yaw: 0, goal: null, wait: 0, model: model, sign: sign, keeper: id });
  }
}

function updateFolk(dt) {
  const hour = clockHour();
  for (const one of folk) {
    one.moving = false;
    if (one.keeper || talking === one) continue;
    // Bedtime: neighbours go indoors from ten at night until seven in the morning
    one.asleep = hour >= 22 || hour < 7;
    if (one.asleep) continue;
    if (one.wait > 0) {
      one.wait -= dt;
      continue;
    }
    if (!one.goal) {
      // Somewhere to stroll to: near home, or (sometimes) the plaza
      const home = { x: (one.def.house.i + 1.5) * TILE, z: (one.def.house.k + 3) * TILE };
      const base = Math.random() < 0.25 ? { x: mid(30), z: mid(22) } : home;
      const goal = { x: base.x + (Math.random() - 0.5) * 22, z: base.z + (Math.random() - 0.5) * 16 };
      if (canStand(goal.x, goal.z)) one.goal = goal;
      continue;
    }
    const dx = one.goal.x - one.x;
    const dz = one.goal.z - one.z;
    const far = Math.hypot(dx, dz);
    const nx = one.x + dx / far * dt * 1.5;
    const nz = one.z + dz / far * dt * 1.5;
    if (far < 0.3 || !canStand(nx, nz)) {
      one.goal = null;
      one.wait = 2 + Math.random() * 6;
      continue;
    }
    one.x = nx;
    one.z = nz;
    one.yaw = Math.atan2(dx, dz);
    one.moving = true;
  }
}

function drawFolk(t) {
  for (const one of folk) {
    const model = one.model;
    model.group.visible = !one.asleep && !inside;
    one.sign.visible = false;
    if (!model.group.visible) continue;
    model.group.position.set(one.x, 0, one.z);
    model.group.rotation.y = one.yaw;
    const swing = one.moving ? Math.sin(t * 9 + one.x) * 0.6 : 0;
    model.limbs.forEach(function (limb, n) { limb.rotation.x = swing * (n === 0 || n === 3 ? 1 : -1); });
    model.body.position.y = one.moving ? Math.abs(Math.sin(t * 9 + one.x)) * 0.05 : Math.sin(t * 2 + one.x) * 0.012;
    model.head.rotation.z = talking === one ? Math.sin(t * 6) * 0.06 : 0;
    // "!" if they want something today, "?" if you have never met
    const friend = state.friends[one.def.id];
    const sign = !friend.met ? "new" : state.wants[one.def.id] ? "want" : null;
    if (sign) {
      one.sign.visible = true;
      one.sign.material = SIGNS[sign];
      one.sign.position.set(one.x, 2.5 + Math.sin(t * 3) * 0.06, one.z);
      one.sign.scale.setScalar(0.7);
    }
  }
}
