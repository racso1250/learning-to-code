// Dino Island 100: the dinosaurs.
// How they hatch, grow, wander, eat and feel. An unhappy dinosaur gets angry and bashes
// its fence. If the fence breaks, it gets out!

// The model and the "what am I doing right now" notes for each dinosaur, by its id.
// (These are not saved: they are made again when the game loads.)
const live = {};

function liveOf(d) {
  if (!live[d.id]) {
    const sign = new THREE.Sprite(SIGNS.angry);
    sign.visible = false;
    scene.add(sign);
    live[d.id] = { model: null, egg: null, sign: sign, goal: null, pause: 1, moving: 0, eating: 0, ram: 0, heli: null, lift: 0, liftAt: 0, from: null };
  }
  return live[d.id];
}

// Throw away the models of dinosaurs that are gone (when a game is loaded, or one is sent away)
function sweepDinos() {
  for (const id in live) {
    if (state.dinos.some(function (d) { return String(d.id) === id; })) continue;
    const L = live[id];
    for (const part of [L.egg, L.model && L.model.group, L.sign, L.heli]) {
      if (part) scene.remove(part);
    }
    delete live[id];
  }
}

// Lay an egg of this kind in a paddock. It hatches after a few seconds.
function hatch(kind, pad) {
  const sp = SPECIES[kind];
  if (!state.known[kind]) return "You have not discovered that dinosaur yet";
  if (state.money < sp.cost) return "You need $" + sp.cost;
  state.money -= sp.cost;
  const middle = padMid(pad);
  state.dinos.push({
    id: state.nextId++, kind: kind, pad: pad.id,
    x: middle.x + (Math.random() - 0.5) * 4, z: middle.z + (Math.random() - 0.5) * 4, yaw: Math.random() * 6,
    grow: 0, hunger: 80, comfort: 80, mood: "egg", loose: false, why: [], hatchAt: state.time + 8, wake: 0,
  });
  return "";
}

// Send a dinosaur away to another park. You get a quarter of its money back.
function sendAway(d) {
  state.money += Math.floor(SPECIES[d.kind].cost / 4);
  state.dinos.splice(state.dinos.indexOf(d), 1);
  sweepDinos();
}

// The feeders of one kind ("plants" or "meat") inside a paddock
function feedersIn(pad, diet) {
  const list = [];
  for (let i = pad.i0; i <= pad.i1; i++) {
    for (let k = pad.k0; k <= pad.k1; k++) {
      if (typeAt(i, k) === diet) list.push({ x: mid(i), z: mid(k) });
    }
  }
  return list;
}

// Work out how a dinosaur feels, and why. 100 is perfectly happy. Under 40, it gets angry.
function feel(d, pad, dt) {
  const sp = SPECIES[d.kind];
  const mates = state.dinos.filter(function (o) { return o.pad === d.pad && !o.loose && o.mood !== "egg"; });
  let comfort = 100;
  const why = [];
  if (d.hunger < 30) {
    comfort -= d.hunger <= 0 ? 65 : 45;
    why.push(feedersIn(pad, sp.diet).length ? "hungry" : "hungry: it needs a " + (sp.diet === "plants" ? "plant" : sp.diet) + " feeder");
  }
  let room = 0;
  for (const m of mates) room += SPECIES[m.kind].need;
  if (room > padArea(pad)) {
    comfort -= 35;
    why.push("cramped: this paddock is too small");
  }
  if (mates.filter(function (m) { return m.kind === d.kind; }).length < sp.herd) {
    comfort -= 25;
    why.push("lonely: it wants a friend of its own kind");
  }
  if (sp.diet === "plants" && mates.some(function (m) { return SPECIES[m.kind].diet !== "plants"; })) {
    comfort -= 65;
    why.push("scared: there is a meat-eater in here!");
  }
  if (padBiome(pad) !== sp.biome) {
    comfort -= 20;
    why.push("not quite at home: it likes " + BIOMES[sp.biome].name + " best");
  }
  if (stormy() && !state.tech.shelter) {
    comfort -= 15;
    why.push("frightened by the storm");
  }
  // A keeper looking after this paddock cheers everybody up
  if (keptPads[pad.id]) comfort = Math.min(100, comfort + 18);
  d.why = why;
  d.comfort += (comfort - d.comfort) * Math.min(1, dt * 0.25);
}

// Turn towards a spot and walk at it. Gives back how far away it still is.
function walkTo(d, L, x, z, speed, dt) {
  const dx = x - d.x;
  const dz = z - d.z;
  const far = Math.hypot(dx, dz);
  if (far < 0.05) return far;
  let turn = Math.atan2(-dx, -dz) - d.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  d.yaw += clamp(turn, -3 * dt, 3 * dt);
  const step = Math.min(far, speed * dt);
  d.x += dx / far * step;
  d.z += dz / far * step;
  L.moving = speed;
  return far - step;
}

// Happy in its paddock: wander about, and go to the feeder when hungry
function graze(d, pad, L, dt) {
  const sp = SPECIES[d.kind];
  if (L.eating > 0) {
    L.eating -= dt;
    return;
  }
  if (d.hunger < 55 && !L.food) {
    const feeders = feedersIn(pad, sp.diet);
    if (feeders.length) L.food = feeders[Math.floor(Math.random() * feeders.length)];
  }
  if (L.food) {
    if (walkTo(d, L, L.food.x, L.food.z, sp.speed * 0.7, dt) < 2.2 + SHAPES[d.kind].long * 0.15) {
      L.food = null;
      L.eating = 3;
      d.hunger = 100;
      state.money = Math.max(0, state.money - 5);   // food costs a little
    }
    return;
  }
  if (L.pause > 0) {
    L.pause -= dt;
    return;
  }
  if (!L.goal) {
    const gap = 2.5;
    L.goal = {
      x: pad.i0 * TILE - HALF + gap + Math.random() * ((pad.i1 - pad.i0 + 1) * TILE - gap * 2),
      z: pad.k0 * TILE - HALF + gap + Math.random() * ((pad.k1 - pad.k0 + 1) * TILE - gap * 2),
    };
  }
  if (walkTo(d, L, L.goal.x, L.goal.z, sp.speed * 0.5, dt) < 0.5) {
    L.goal = null;
    L.pause = 1 + Math.random() * 5;
  }
}

// Angry: walk to the nearest bit of fence and bash it
function ram(d, pad, L, dt) {
  const sp = SPECIES[d.kind];
  if (pad.breach) {
    // The fence is already broken: straight out through the gap
    if (walkTo(d, L, pad.breach.x, pad.breach.z, sp.speed, dt) < 1.5) setLoose(d);
    return;
  }
  if (!L.ramSpot) {
    const x0 = pad.i0 * TILE - HALF;
    const x1 = (pad.i1 + 1) * TILE - HALF;
    const z0 = pad.k0 * TILE - HALF;
    const z1 = (pad.k1 + 1) * TILE - HALF;
    const sides = [[d.x - x0, x0, d.z], [x1 - d.x, x1, d.z], [d.z - z0, d.x, z0], [z1 - d.z, d.x, z1]];
    sides.sort(function (a, b) { return a[0] - b[0]; });
    L.ramSpot = { x: sides[0][1], z: sides[0][2] };
  }
  if (walkTo(d, L, L.ramSpot.x, L.ramSpot.z, sp.speed * 0.8, dt) > 1.2 + SHAPES[d.kind].long * 0.2) return;
  L.ram += dt;
  // A storm cuts the power, and an electric fence with no power is easy to break
  const weak = stormy() && pad.fence === "electric" ? 3 : 1;
  pad.hp -= sp.strength * dt * weak;
  pad.hitAt = state.time;
  if (pad.hp > 0) return;
  pad.hp = 0;
  pad.breach = { x: L.ramSpot.x, z: L.ramSpot.z };
  refreshPark();
  setLoose(d);
  soundRoar();
  shake = 0.6;
}

function setLoose(d) {
  const L = liveOf(d);
  d.loose = true;
  d.mood = "angry";
  L.goal = null;
  L.ramSpot = null;
  state.escapes++;
  say("A " + SPECIES[d.kind].name + " has broken out! Press J to drive the ranger jeep, then Space to fire a sleepy dart.", 8);
}

// On the loose: plant-eaters wander. Meat-eaters chase the visitors (who run away).
function roamLoose(d, L, dt) {
  const sp = SPECIES[d.kind];
  if (sp.diet !== "plants") {
    let prey = null;
    let near = 45;
    for (const g of guests) {
      const far = Math.hypot(g.x - d.x, g.z - d.z);
      if (far < near) {
        near = far;
        prey = g;
      }
    }
    if (prey) {
      if (walkTo(d, L, prey.x, prey.z, sp.speed, dt) < 2) {
        // The visitor gets such a fright that they run all the way home
        guests.splice(guests.indexOf(prey), 1);
        state.scare += 2;
      }
      return;
    }
  }
  // (It does not wander too far: somewhere within 120 metres of where it is now)
  if (!L.goal) L.goal = { x: clamp(d.x + (Math.random() * 2 - 1) * 120, 8 - HALF, HALF - 8), z: clamp(d.z + (Math.random() * 2 - 1) * 120, 8 - HALF, HALF - 8) };
  if (walkTo(d, L, L.goal.x, L.goal.z, sp.speed * 0.6, dt) < 2) L.goal = null;
}

// A sleepy dart hits this dinosaur
function dartHit(d) {
  const L = liveOf(d);
  d.mood = "asleep";
  L.ramSpot = null;
  L.ram = 0;
  if (d.loose) {
    d.wake = state.time + 9999;
    L.liftAt = state.time + 2.5;
    say("Got it! The helicopter is coming to carry it home.", 4);
  } else {
    d.wake = state.time + 15;
    say("The " + SPECIES[d.kind].name + " falls asleep. Fix what is upsetting it before it wakes up!", 5);
  }
}

// The helicopter flies in, lifts the sleeping dinosaur, and carries it back to its paddock
function liftHome(d, L, dt) {
  const pad = padById(d.pad);
  const home = padMid(pad);
  if (!L.heli) {
    L.heli = makeHelicopter();
    scene.add(L.heli);
    L.lift = 0;
    L.from = { x: d.x, z: d.z };
  }
  L.lift += dt;
  const high = SHAPES[d.kind].tall * (0.35 + 0.65 * d.grow) + 6;
  let up = 0;
  if (L.lift < 2.5) {
    // Coming down from the sky
    L.heli.position.set(d.x, high + (1 - L.lift / 2.5) * 60, d.z);
  } else if (L.lift < 6.5) {
    const s = smooth((L.lift - 2.5) / 4);
    d.x = L.from.x + (home.x - L.from.x) * s;
    d.z = L.from.z + (home.z - L.from.z) * s;
    up = Math.sin(s * Math.PI) * 10 + Math.min(1, (L.lift - 2.5) * 2) * 6 * (1 - s * s);
    L.heli.position.set(d.x, high + up, d.z);
  } else if (L.lift < 8) {
    L.heli.position.set(d.x, high + (L.lift - 6.5) * 30, d.z);
  } else {
    scene.remove(L.heli);
    L.heli = null;
    d.loose = false;
    d.mood = "calm";
    d.comfort = 70;
    d.hunger = Math.max(d.hunger, 70);
    pad.breach = null;
    pad.hp = Math.max(pad.hp, padMax(pad) * 0.6);
    refreshPark();
    state.caught++;
    state.money = Math.max(0, state.money - 100);
    say("The " + SPECIES[d.kind].name + " is safely home and the fence is mended. The rescue cost $100.", 6);
    L.up = 0;
    return;
  }
  L.up = up;
  L.heli.userData.rotor.rotation.y += dt * 30;
}

function updateDinos(dt) {
  for (const d of state.dinos) {
    const L = liveOf(d);
    L.moving = 0;
    if (d.mood === "egg") {
      if (state.time > d.hatchAt) {
        d.mood = "calm";
        soundHatch();
        say("A baby " + SPECIES[d.kind].name + " has hatched!", 4);
      }
      continue;
    }
    d.grow = Math.min(1, d.grow + dt / (state.tech.hatch ? 60 : 120));
    if (d.mood === "lift") {
      liftHome(d, L, dt);
      continue;
    }
    if (d.mood === "asleep") {
      if (d.loose && state.time > L.liftAt) d.mood = "lift";
      else if (!d.loose && state.time > d.wake) {
        d.mood = "calm";
        d.comfort = Math.max(d.comfort, 58);
      }
      continue;
    }
    d.hunger = Math.max(0, d.hunger - dt * 0.6);
    if (d.loose) {
      roamLoose(d, L, dt);
      continue;
    }
    const pad = padById(d.pad);
    feel(d, pad, dt);
    // Angry below 40. It only calms down again once it is above 55.
    if (d.comfort < 40 && d.mood !== "angry") {
      d.mood = "angry";
      soundGrowl();
    } else if (d.comfort > 55 && d.mood === "angry") {
      d.mood = "calm";
      L.ramSpot = null;
    }
    if (d.mood === "angry") ram(d, pad, L, dt);
    else graze(d, pad, L, dt);
  }
}

// Put every dinosaur's model where the dinosaur is, and make it move
function poseDinos(t) {
  for (const d of state.dinos) {
    const L = liveOf(d);
    if (d.mood === "egg") {
      if (!L.egg) {
        L.egg = makeEgg();
        scene.add(L.egg);
      }
      L.egg.position.set(d.x, 0, d.z);
      L.egg.rotation.z = Math.sin(t * 9) * 0.08 * (d.hatchAt - state.time < 3 ? 2 : 0.4);
      continue;
    }
    if (L.egg) {
      scene.remove(L.egg);
      L.egg = null;
    }
    if (!L.model) {
      L.model = makeDino(d.kind);
      L.model.group.rotation.order = "YXZ";
      scene.add(L.model.group);
    }
    const m = L.model;
    const big = 0.35 + 0.65 * d.grow;
    const asleep = d.mood === "asleep" || d.mood === "lift";
    m.group.scale.setScalar(big);
    m.group.position.set(d.x, (d.mood === "lift" ? L.up || 0 : 0) + (asleep ? SHAPES[d.kind].long * 0.08 * big : 0), d.z);
    m.group.rotation.set(0, d.yaw, asleep ? 1.35 : 0);
    // Legs swing when it walks. (Legs come in pairs: left and right swing opposite ways.)
    const stride = L.moving ? Math.sin(t * (4 + L.moving * 1.2) + d.id) * 0.5 : 0;
    m.legs.forEach(function (leg, n) {
      leg.rotation.x = stride * (n % 4 === 0 || n % 4 === 3 ? 1 : -1);
    });
    m.tail.rotation.y = Math.sin(t * 1.6 + d.id) * 0.25;
    // Head down to eat, or thrown forward to bash the fence
    const bash = d.mood === "angry" && L.ram > 0 && !d.loose ? Math.max(0, Math.sin(t * 7)) * 0.35 : 0;
    m.head.rotation.x = L.eating > 0 ? -0.5 - Math.sin(t * 6) * 0.08 : -bash;
    if (m.jaw) m.jaw.rotation.x = d.mood === "angry" ? -0.35 - Math.sin(t * 5) * 0.15 : -0.05;
    // A little sign over its head
    const sign = d.mood === "angry" ? "angry" : asleep ? "asleep" : d.hunger < 30 ? "hungry" : null;
    L.sign.visible = !!sign;
    if (sign) {
      L.sign.material = SIGNS[sign];
      L.sign.position.set(d.x, SHAPES[d.kind].tall * big + 2 + (L.up || 0), d.z);
      L.sign.scale.setScalar(3 + Math.sin(t * 6) * 0.3);
    }
  }
}
