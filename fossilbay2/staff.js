// Fossil Bay 2: your staff, your labs, and the monorail train.
// Keepers look after paddocks, rangers catch runaways and mend fences,
// scientists do research in labs, and tour guides make visits more fun.

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
      // Next: a fence that has been knocked about, and is not being bashed right now
      const hurt = state.pads.find(function (p) { return p.kind !== "water" && p.hp < padMax(p) - 0.5 && state.time - (p.hitAt || -9) > 4 && !p.breach; });
      if (hurt) {
        const middle = padMid(hurt);
        if (workerTo(w, middle.x, (hurt.k1 + 1) * TILE - HALF + 3.5, 14, dt) < 4) hurt.hp = Math.min(padMax(hurt), hurt.hp + 14 * dt);
        continue;
      }
      workerTo(w, mid(GATE.i) + 9 + w.n * 5, HALF - 5, 12, dt);
    } else if (w.type === "scientist") {
      // Scientists share themselves out between the labs that have work to do
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

  // Research: each lab with a job gets on with it, as long as it has a scientist
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

// ----- Research -----
// Everything a lab could work on: new dinosaurs and new inventions.
// "locked" says why you can't start it yet (or "" if you can).
function researchList() {
  const list = [];
  const doing = Object.keys(state.labs).map(function (key) { return state.labs[key].job && state.labs[key].job.id; });
  for (const kind in SPECIES) {
    if (state.known[kind]) continue;
    const sp = SPECIES[kind];
    let locked = "";
    if (state.best < sp.stars) locked = "needs a " + sp.stars + " star park";
    else if (!biomeOpen(sp.biome)) locked = "its fossils are in " + BIOMES[sp.biome].name + ": build a monorail station there";
    else if (doing.includes("dna-" + kind)) locked = "another lab is already on it";
    list.push({ id: "dna-" + kind, name: "Find the DNA of " + sp.name, what: "Eats " + sp.diet + ". Lives in " + (sp.home === "water" ? "a lagoon" : sp.home === "air" ? "an aviary" : "a paddock") + ". Likes " + BIOMES[sp.biome].name, cost: Math.max(150, Math.round(sp.cost * 0.5 / 50) * 50), time: 20 + sp.stars * 12, locked: locked });
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
  const item = researchList().find(function (one) { return one.id === id; });
  if (!lab || !item) return "That can't be researched";
  if (lab.job) return "This lab is busy";
  if (item.locked) return "Not yet: " + item.locked;
  if (state.money < item.cost) return "You need $" + item.cost;
  state.money -= item.cost;
  lab.job = { id: id, name: item.name, left: item.time, total: item.time };
  return "";
}

function finishResearch(lab) {
  const id = lab.job.id;
  lab.job = null;
  soundCash();
  if (id.indexOf("dna-") === 0) {
    const kind = id.slice(4);
    state.known[kind] = true;
    say("Research done! You can now hatch " + SPECIES[kind].name + ".", 6);
  } else {
    const tech = id.slice(5);
    // Stronger fences: every fence you already have gets stronger too
    if (tech === "fence") {
      for (const pad of state.pads) pad.hp *= 1.5;
    }
    state.tech[tech] = true;
    say("Research done: " + TECH[tech].name + "!", 6);
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
  trainAt = (trainAt + dt * 22) % total;
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
