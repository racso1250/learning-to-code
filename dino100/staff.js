// Dino Island 100: your staff, your expedition camps and labs, and the monorail train.
// Keepers look after paddocks, rangers catch runaways and mend fences, tour guides make visits
// more fun, and scientists go on expeditions to discover dinosaurs and make hybrids in the labs.

let keptPads = {};        // the paddocks that have a keeper with them right now: { padId: true }
const workers = [];       // the little people you can see: { type, model, x, z, ... }
let trainAt = 0;          // how far along its track the train is (in metres)

// ----- Hiring -----
function hire(type) {
  if (state.staff[type] >= 6) return "You can have 6 of each at most";
  const fee = STAFF[type].wage * 2;
  if (state.money < fee) return "You need $" + fee + " to hire a " + STAFF[type].name.toLowerCase();
  state.money -= fee;
  state.staff[type]++;
  return "";
}

function fire(type) {
  if (state.staff[type] > 0) state.staff[type]--;
}

function wageBill() {
  let total = 0;
  for (const type in STAFF) total += STAFF[type].wage * state.staff[type];
  return total;
}

// Make sure there is one little person in the world for everybody on the payroll
function syncStaff() {
  for (const type in STAFF) {
    let have = workers.filter(function (w) { return w.type === type; });
    while (have.length > state.staff[type]) {
      const gone = have.pop();
      scene.remove(gone.model);
      if (gone.jeep) scene.remove(gone.jeep);
      workers.splice(workers.indexOf(gone), 1);
    }
    while (have.length < state.staff[type]) {
      const w = { type: type, model: makeWorker(UNIFORMS[type][0], UNIFORMS[type][1]), x: mid(GATE.i) + 4 + Math.random() * 6, z: HALF - 6 - Math.random() * 4, n: have.length, pad: null, until: 0, goal: null, moving: false };
      if (type === "ranger") {
        w.jeep = makeJeep(0xc8a04a);
        w.yaw = 0;
      }
      workers.push(w);
      have.push(w);
    }
  }
}

// Walk (or drive) a worker towards a spot. Gives back how far away it still is.
function workerTo(w, x, z, speed, dt) {
  const dx = x - w.x;
  const dz = z - w.z;
  const far = Math.hypot(dx, dz);
  if (far < 0.2) return far;
  const step = Math.min(far, speed * dt);
  w.x += dx / far * step;
  w.z += dz / far * step;
  w.yaw = Math.atan2(-dx, -dz);
  w.moving = true;
  return far - step;
}

// How unhappy a paddock is (the lower its dinosaurs' comfort, the more it needs a keeper)
function padMood(pad) {
  const here = state.dinos.filter(function (d) { return d.pad === pad.id && !d.loose && d.mood !== "egg"; });
  if (!here.length) return 999;
  let total = 0;
  for (const d of here) total += d.comfort;
  return total / here.length;
}

function updateStaff(dt) {
  keptPads = {};
  const labs = Object.keys(state.labs);
  const busyLabs = labs.filter(function (key) { return state.labs[key].job; });
  const dartReach = state.tech.darts ? 44 : 22;
  for (const w of workers) {
    w.moving = false;
    if (w.type === "keeper") {
      // Go to the unhappiest paddock that no other keeper has taken, and stay a while
      let pad = w.pad === null ? null : padById(w.pad);
      if (!pad || state.time > w.until) {
        const taken = workers.filter(function (o) { return o !== w && o.type === "keeper"; }).map(function (o) { return o.pad; });
        const free = state.pads.filter(function (p) { return !taken.includes(p.id) && padMood(p) < 999; });
        free.sort(function (a, b) { return padMood(a) - padMood(b); });
        pad = free[0] || null;
        w.pad = pad ? pad.id : null;
        w.until = state.time + 45;
      }
      if (pad) {
        const middle = padMid(pad);
        if (workerTo(w, middle.x, (pad.k1 + 1) * TILE - HALF + 1.6, 5, dt) < 3) keptPads[pad.id] = true;
      }
    } else if (w.type === "ranger") {
      // First: any dinosaur on the loose that no other ranger is already after
      const chased = workers.filter(function (o) { return o !== w && o.type === "ranger"; }).map(function (o) { return o.prey; });
      let prey = null;
      let near = 9999;
      for (const d of state.dinos) {
        if (!d.loose || d.mood === "asleep" || d.mood === "lift" || chased.includes(d.id)) continue;
        const far = Math.hypot(d.x - w.x, d.z - w.z);
        if (far < near) {
          near = far;
          prey = d;
        }
      }
      w.prey = prey ? prey.id : null;
      if (prey) {
        if (workerTo(w, prey.x, prey.z, 14, dt) < dartReach) dartHit(prey);
        continue;
      }
      // Next: wild Pteranodons attacking the monorail
      if (raiding()) {
        const car = trainCars[0].position;
        if (workerTo(w, car.x, car.z, 14, dt) < dartReach) endRaid("Your ranger fires a flare, and the Pteranodons scatter!");
        continue;
      }
      // Next: a fence that has been knocked about, and is not being bashed right now
      const hurt = state.pads.find(function (p) { return p.hp < padMax(p) - 0.5 && state.time - (p.hitAt || -9) > 4 && !p.breach; });
      if (hurt) {
        const middle = padMid(hurt);
        if (workerTo(w, middle.x, (hurt.k1 + 1) * TILE - HALF + 3.5, 14, dt) < 4) hurt.hp = Math.min(padMax(hurt), hurt.hp + 14 * dt);
        continue;
      }
      workerTo(w, mid(GATE.i) + 9 + w.n * 5, HALF - 5, 12, dt);
    } else if (w.type === "scientist") {
      // Scientists share themselves out between the labs and camps that have work to do
      const pool = busyLabs.length ? busyLabs : labs;
      w.lab = pool.length ? pool[w.n % pool.length] : null;
      if (w.lab) {
        const n = w.lab.split(",").map(Number);
        workerTo(w, mid(n[0]) + 2.4 + (w.n % 3) * 0.9, mid(n[1]) + 2.6, 5, dt);
      }
    } else {
      // Tour guides stroll between the places visitors go
      if (!w.goal || state.time > w.until) {
        const spots = attractions();
        const spot = spots.length ? spots[Math.floor(Math.random() * spots.length)] : { i: GATE.i, k: GATE.k };
        w.goal = { x: mid(spot.i) + 1.5, z: mid(spot.k) + 1.5 };
        w.until = state.time + 25;
      }
      workerTo(w, w.goal.x, w.goal.z, 2.6, dt);
    }
  }

  // A tour guide puts on a free feeding show at every stadium, every couple of minutes
  if (state.staff.guide > 0) {
    for (const pad of state.pads) {
      if (pad.kind === "arena" && state.time > (pad.nextShow || 0) + 60) startShow(pad, true);
    }
  }

  // Each lab or camp with a job gets on with it, as long as it has a scientist
  for (const key of busyLabs) {
    const lab = state.labs[key];
    const team = workers.filter(function (w) { return w.type === "scientist" && w.lab === key; }).length;
    if (!team) continue;
    lab.job.left -= dt * (0.4 + 0.6 * team);
    if (lab.job.left <= 0) finishResearch(lab);
  }

  // Wages are paid every half a minute
  state.wageClock += dt;
  if (state.wageClock >= 30) {
    state.wageClock = 0;
    const bill = wageBill();
    if (bill > state.money) {
      // Can't pay everyone: somebody leaves
      const types = Object.keys(STAFF).filter(function (type) { return state.staff[type] > 0; });
      const type = types[Math.floor(Math.random() * types.length)];
      fire(type);
      syncStaff();
      say("You could not pay your staff, so a " + STAFF[type].name.toLowerCase() + " has left!", 6);
    }
    state.money = Math.max(0, state.money - bill);
  }
}

function drawStaff(t) {
  for (const w of workers) {
    const riding = w.type === "ranger";
    w.model.position.set(w.x + (riding ? 0 : 0), (riding ? 0.9 : 0) + (w.moving && !riding ? Math.abs(Math.sin(t * 9 + w.n)) * 0.12 : 0), w.z);
    if (riding) {
      w.jeep.position.set(w.x, 0, w.z);
      w.jeep.rotation.y = w.yaw || 0;
    }
  }
}

// ----- Discovering dinosaurs -----
// The kinds a team could find in a region right now. Rare kinds need a park with more stars.
// ("extra" lets a lucky find be one tier rarer than usual.)
function findable(biome, extra) {
  return Object.keys(SPECIES).filter(function (kind) {
    const sp = SPECIES[kind];
    return !sp.parents && sp.biome === biome && !state.known[kind] && sp.tier <= state.best + (extra || 0);
  });
}

function knownCount() {
  return Object.keys(state.known).length;
}

// A new dinosaur for the Dinodex!
function discover(kind, how) {
  state.known[kind] = true;
  state.fresh[kind] = true;
  sound(playJingle);
  sayFound(kind, how + " That is " + knownCount() + " of " + TOTAL + " in your Dinodex.");
}

// Everything a camp or a lab could work on. "locked" says why you can't start it yet (or "" if you can).
function researchList(type) {
  const list = [];
  const doing = Object.keys(state.labs).map(function (key) { return state.labs[key].job && state.labs[key].job.id; });
  if (type === "camp") {
    // Expeditions: one to each region of the island
    for (const biome in TRIPS) {
      const all = Object.keys(SPECIES).filter(function (kind) { return SPECIES[kind].biome === biome && !SPECIES[kind].parents; });
      const left = all.filter(function (kind) { return !state.known[kind]; });
      let locked = "";
      if (!left.length) locked = "you have found everything that lives there";
      else if (!findable(biome).length) locked = "the ones left are " + RARITY[Math.min.apply(null, left.map(function (kind) { return SPECIES[kind].tier; }))] + ": you need a park with more stars";
      else if (doing.includes("trip-" + biome)) locked = "another team is already there";
      list.push({ id: "trip-" + biome, name: "Expedition to " + BIOMES[biome].name, what: "You have found " + (all.length - left.length) + " of the " + all.length + " kinds that live there", cost: TRIPS[biome].cost, time: TRIPS[biome].time, locked: locked });
    }
    return list;
  }
  // Hybrids: mix two kinds you know to make a brand new one
  for (const mix of MIXES) {
    if (state.known[mix[0]]) continue;
    const sp = SPECIES[mix[0]];
    const missing = sp.parents.filter(function (kind) { return !state.known[kind]; });
    const names = sp.parents.map(function (kind) {
      if (state.known[kind]) return SPECIES[kind].name;
      return SPECIES[kind].parents ? "??? (another hybrid)" : "??? (from " + BIOMES[SPECIES[kind].biome].name + ")";
    });
    let locked = "";
    if (missing.length) locked = "discover both parents first";
    else if (doing.includes("mix-" + mix[0])) locked = "another lab is already making it";
    list.push({ id: "mix-" + mix[0], hybrid: true, name: "Make the hybrid " + sp.name, what: names.join(" + "), cost: Math.round(sp.cost * 0.6 / 50) * 50, time: 30 + sp.tier * 8, locked: locked });
  }
  for (const id in TECH) {
    if (state.tech[id]) continue;
    const tech = TECH[id];
    let locked = "";
    if (state.best < tech.stars) locked = "needs a " + tech.stars + " star park";
    else if (doing.includes("tech-" + id)) locked = "another lab is already on it";
    list.push({ id: "tech-" + id, name: tech.name, what: tech.what, cost: tech.cost, time: tech.time, locked: locked });
  }
  return list;
}

function startResearch(labKey, id) {
  const lab = state.labs[labKey];
  const item = researchList(state.tiles[labKey]).find(function (one) { return one.id === id; });
  if (!lab || !item) return "That can't be done here";
  if (lab.job) return "They are busy";
  if (item.locked) return "Not yet: " + item.locked;
  if (state.money < item.cost) return "You need $" + item.cost;
  state.money -= item.cost;
  lab.job = { id: id, name: item.name, left: item.time, total: item.time, cost: item.cost };
  if (id.indexOf("trip-") === 0) {
    // Choose the spot in that region where the helicopter will land
    const biome = id.slice(5);
    let i = 0;
    let k = 0;
    do {
      i = 6 + Math.floor(Math.random() * (SIZE - 12));
      k = 6 + Math.floor(Math.random() * (SIZE - 12));
    } while (biomeAt(i, k) !== biome || padAt(i, k) || typeAt(i, k));
    lab.job.x = mid(i);
    lab.job.z = mid(k);
    state.trips++;
  }
  return "";
}

function finishResearch(lab) {
  const id = lab.job.id;
  const cost = lab.job.cost;
  lab.job = null;
  if (id.indexOf("trip-") === 0) {
    const biome = id.slice(5);
    const list = findable(biome);
    if (list.length) {
      const kind = list[Math.floor(Math.random() * list.length)];
      discover(kind, "Your team is back from " + BIOMES[biome].name + " with a new dinosaur: " + SPECIES[kind].name + "!");
    } else {
      state.money += cost;
      say("The team found nothing new in " + BIOMES[biome].name + " this time, so you get your money back.", 5);
    }
  } else if (id.indexOf("mix-") === 0) {
    const kind = id.slice(4);
    discover(kind, "The lab has made a hybrid: " + SPECIES[kind].name + "!");
  } else {
    const tech = id.slice(5);
    soundCash();
    // Stronger fences: every fence you already have gets stronger too
    if (tech === "fence") {
      for (const pad of state.pads) pad.hp *= 1.5;
    }
    state.tech[tech] = true;
    say("Research done: " + TECH[tech].name + "!", 6);
  }
}

// The little helicopters that carry expedition teams out to a region and back
const tripHelis = {};
function drawTrips(dt) {
  for (const key in tripHelis) {
    const lab = state.labs[key];
    if (lab && lab.job && lab.job.x !== undefined) continue;
    scene.remove(tripHelis[key]);
    delete tripHelis[key];
  }
  for (const key in state.labs) {
    const job = state.labs[key].job;
    if (!job || job.x === undefined) continue;
    let heli = tripHelis[key];
    if (!heli) {
      heli = tripHelis[key] = makeHelicopter();
      heli.scale.setScalar(0.6);
      heli.children[heli.children.length - 1].visible = false;   // no rope: this one is not lifting anything
      scene.add(heli);
    }
    const n = key.split(",").map(Number);
    const homeX = mid(n[0]) + 1.1;
    const homeZ = mid(n[1]) + 1.4;
    // The first third of the trip is flying out, the middle is digging, and the last third is flying home
    const done = 1 - job.left / job.total;
    const out = done < 0.35 ? smooth(done / 0.35) : done < 0.65 ? 1 : 1 - smooth((done - 0.65) / 0.35);
    const flying = out > 0.001 && out < 0.999;
    heli.position.set(homeX + (job.x - homeX) * out, 1.2 + Math.sin(out * Math.PI) * 45, homeZ + (job.z - homeZ) * out);
    const back = done >= 0.65 ? Math.PI : 0;
    heli.rotation.y = Math.atan2(-(job.x - homeX), -(job.z - homeZ)) + back;
    if (flying || done < 0.02) heli.userData.rotor.rotation.y += dt * 30;
  }
}

// ----- The monorail train -----
// The train runs round all the stations in order, for ever
function moveTrain(dt) {
  const stops = railStops;
  if (stops.length < 2) {
    for (const car of trainCars) car.visible = false;
    return;
  }
  // The track as a list of straight legs. (With two stations it goes there and back.)
  const legs = [];
  let total = 0;
  for (let n = 0; n < stops.length; n++) {
    const a = stops[n];
    const b = stops[(n + 1) % stops.length];
    const long = Math.hypot(b.x - a.x, b.z - a.z);
    legs.push({ a: a, b: b, long: long });
    total += long;
  }
  if (!raiding()) trainAt = (trainAt + dt * 22) % total;      // the driver stops while Pteranodons are attacking
  trainCars.forEach(function (car, n) {
    let far = ((trainAt - n * 7) % total + total) % total;
    let leg = legs[0];
    for (const one of legs) {
      leg = one;
      if (far <= one.long) break;
      far -= one.long;
    }
    const t = far / leg.long;
    car.visible = true;
    car.position.set(leg.a.x + (leg.b.x - leg.a.x) * t, RAIL_HIGH + 1.4, leg.a.z + (leg.b.z - leg.a.z) * t);
    car.rotation.y = Math.atan2(-(leg.b.x - leg.a.x), -(leg.b.z - leg.a.z));
  });
}

// ----- Wild Pteranodons -----
// A flock of wild Pteranodons lives over the Ashlands, near the volcano. Every so often they
// come down and mob the monorail train. It has to stop until somebody frightens them off.
const flock = [];
for (let n = 0; n < 4; n++) flock.push({ x: 0, y: 70, z: -HALF + 80, turn: n * 1.6, model: null });
const ROOST = { x: 0, z: -HALF + 90 };

function raiding() {
  return state.time < state.raidUntil;
}

function endRaid(how) {
  if (!raiding()) return;
  state.raidUntil = 0;
  state.nextRaid = state.time + 200 + Math.random() * 200;
  soundCash();
  say(how, 5);
}

function updateFlock(dt) {
  // Time for a raid? (Only if there is a monorail to attack, and it has no horn to scare them.)
  if (!raiding() && railStops.length > 1 && !state.tech.horn && state.time > state.nextRaid) {
    state.raidUntil = state.time + 80;
    soundRoar();
    say("Wild Pteranodons are attacking the monorail! The train has stopped. Send a ranger, drive the jeep there, or pay for flares.", 8);
  } else if (!raiding() && state.raidUntil && state.time > state.raidUntil) {
    // They got bored and flew home by themselves
    state.raidUntil = 0;
    state.nextRaid = state.time + 200 + Math.random() * 200;
  }
  const mobbing = raiding();
  if (mobbing) state.scare = Math.min(12, state.scare + dt * 0.15);     // the visitors don't like it one bit
  const car = trainCars[0].position;
  flock.forEach(function (bird, n) {
    // Round and round: tight circles over the train, or wide lazy ones over the Ashlands
    bird.turn += dt * (mobbing ? 1.6 : 0.25);
    const wide = mobbing ? 6 + n * 2 : 40 + n * 12;
    const tx = (mobbing ? car.x : ROOST.x) + Math.cos(bird.turn) * wide;
    const tz = (mobbing ? car.z : ROOST.z) + Math.sin(bird.turn) * wide;
    const ty = mobbing ? RAIL_HIGH + 4 + Math.sin(bird.turn * 2 + n) * 2.5 : 60 + n * 7;
    const dx = tx - bird.x;
    const dy = ty - bird.y;
    const dz = tz - bird.z;
    const far = Math.hypot(dx, dy, dz);
    const step = Math.min(far, 45 * dt);
    if (far > 0.01) {
      bird.x += dx / far * step;
      bird.y += dy / far * step;
      bird.z += dz / far * step;
      bird.yaw = Math.atan2(-dx, -dz);
    }
  });
}

function drawFlock(t) {
  flock.forEach(function (bird, n) {
    if (!bird.model) {
      bird.model = makeDino("ptera");
      bird.model.group.rotation.order = "YXZ";
      scene.add(bird.model.group);
    }
    bird.model.group.position.set(bird.x, bird.y, bird.z);
    bird.model.group.rotation.set(0, bird.yaw || 0, Math.sin(t * 2 + n) * 0.2);
    for (const wing of bird.model.wings) wing.group.rotation.z = wing.side * Math.sin(t * 6 + n) * 0.5;
  });
}
