// Fossil Bay 3: the wild dinosaurs, your dart gun, and your helicopter.
// Wild dinosaurs roam every section of the island. Put one to sleep with darts, hook it
// under the helicopter, and lower it into a paddock: that is how your park gets its animals.

const wilds = [];        // every wild dinosaur: { kind, section, x, z, yaw, mood, hits, model ... }
const comeBack = [];     // wild dinosaurs that will turn up again later: { kind, section, at }

// Your helicopter. y is how high it is (0 = parked on the ground).
const heli = { x: mid(HELIPAD.i), y: 0, z: mid(HELIPAD.k), yaw: 0, speed: 0, cargo: null, model: makeHelicopter() };
heli.model.scale.setScalar(1.5);
scene.add(shade(heli.model));

// Pick a random open spot in a section (not in a paddock, not on something built)
function wildSpot(section) {
  for (let tries = 0; tries < 300; tries++) {
    const i = Math.floor(Math.random() * SIZE);
    const k = Math.floor(Math.random() * SIZE);
    if (biomeAt(i, k) !== section || padAt(i, k) || typeAt(i, k)) continue;
    if (Math.hypot(mid(i) - mid(CAMP.i), mid(k) - mid(CAMP.k)) < 40) continue;   // not right on top of your camp
    return { x: mid(i), z: mid(k) };
  }
  return { x: 0, z: 0 };
}

function addWild(kind, section) {
  const spot = wildSpot(section);
  const model = makeDino(kind);
  model.group.rotation.order = "YXZ";
  scene.add(model.group);
  const sign = new THREE.Sprite(SIGNS.angry);
  sign.visible = false;
  scene.add(sign);
  wilds.push({ kind: kind, section: section, x: spot.x, z: spot.z, home: spot, yaw: Math.random() * 6, mood: "roam", hits: 0, until: 0, pause: Math.random() * 4, goal: null, moving: 0, stride: 0, model: model, sign: sign });
}

function removeWild(w) {
  scene.remove(w.model.group);
  scene.remove(w.sign);
  wilds.splice(wilds.indexOf(w), 1);
}

// Fill the island with wild dinosaurs (at the start of a game)
function makeWilds() {
  while (wilds.length) removeWild(wilds[0]);
  comeBack.length = 0;
  for (const section in WILD) {
    for (const kind in WILD[section]) {
      for (let n = 0; n < WILD[section][kind]; n++) addWild(kind, section);
    }
  }
}

// Turn towards a spot and walk at it (but never into a paddock). Gives back how far away it still is.
function wildTo(w, x, z, speed, dt) {
  const dx = x - w.x;
  const dz = z - w.z;
  const far = Math.hypot(dx, dz);
  if (far < 0.05) return far;
  let turn = Math.atan2(-dx, -dz) - w.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  w.yaw += clamp(turn, -3 * dt, 3 * dt);
  const step = Math.min(far, speed * dt);
  const nx = clamp(w.x + dx / far * step, -HALF + 3, HALF - 3);
  const nz = clamp(w.z + dz / far * step, -HALF + 3, HALF - 3);
  if (padAt(tileOf(nx), tileOf(nz))) return 0;   // a fence is in the way: give up on this spot
  w.x = nx;
  w.z = nz;
  w.moving = speed;
  w.stride += step;
  return far - step;
}

// How far away can a hunter notice you? Creeping is quiet, running is loud, and up in the helicopter you are safe.
function loudness() {
  if (flying) return 0;
  if (!me.moving) return 6;
  return me.sneak ? 8 : me.running ? 30 : 18;
}

function updateWilds(dt) {
  for (let n = comeBack.length - 1; n >= 0; n--) {
    if (state.time > comeBack[n].at) {
      addWild(comeBack[n].kind, comeBack[n].section);
      comeBack.splice(n, 1);
    }
  }
  for (const w of wilds) {
    const sp = SPECIES[w.kind];
    w.moving = 0;
    const far = Math.hypot(me.x - w.x, me.z - w.z);
    if (w.mood === "hooked") {
      // Hanging under the helicopter
      w.x = heli.x;
      w.z = heli.z;
      continue;
    }
    if (w.mood === "asleep") {
      if (state.time > w.until) {
        w.mood = "roam";
        w.hits = 0;
      }
      continue;
    }
    // Each dart that has hit it makes it slower and sleepier
    const drowsy = 1 - 0.5 * w.hits / sp.darts;
    if (w.mood === "flee") {
      // Startled: it runs away from you for a few seconds
      wildTo(w, w.x + (w.x - me.x), w.z + (w.z - me.z), sp.speed * 1.6 * drowsy, dt);
      if (state.time > w.until) w.mood = "roam";
      continue;
    }
    if (sp.hunter && state.time > safeUntil && (far < loudness() || (w.mood === "hunt" && far < 34 && !flying))) {
      if (w.mood !== "hunt") {
        w.mood = "hunt";
        if (SHAPES[w.kind].tall > 5) soundRoar();
        else soundGrowl();
      }
      w.until = state.time + 4;
    }
    if (w.mood === "hunt") {
      if (state.time > w.until || flying) {
        w.mood = "roam";
      } else {
        wildTo(w, me.x, me.z, Math.min(8.8, sp.speed * 1.45) * drowsy, dt);
        if (far < 1.3 + SHAPES[w.kind].long * 0.22) knockedOut(w.kind);
      }
      continue;
    }
    // Just wandering about near where it lives
    if (w.pause > 0) {
      w.pause -= dt;
      continue;
    }
    if (!w.goal) {
      const x = clamp(w.home.x + (Math.random() - 0.5) * 60, -HALF + 6, HALF - 6);
      const z = clamp(w.home.z + (Math.random() - 0.5) * 60, -HALF + 6, HALF - 6);
      if (biomeAt(tileOf(x), tileOf(z)) === w.section) w.goal = { x: x, z: z };
      else continue;
    }
    if (wildTo(w, w.goal.x, w.goal.z, sp.speed * 0.5 * drowsy, dt) < 1.5) {
      w.goal = null;
      w.pause = 2 + Math.random() * 6;
    }
  }
}

function poseWilds(t) {
  for (const w of wilds) {
    const m = w.model;
    // Dinosaurs a long way off are not drawn at all (that keeps the game fast)
    m.group.visible = Math.hypot(w.x - camera.position.x, w.z - camera.position.z) < (flying ? 300 : 200);
    if (!m.group.visible) {
      w.sign.visible = false;
      continue;
    }
    const asleep = w.mood === "asleep" || w.mood === "hooked";
    const high = w.mood === "hooked" ? Math.max(0, heli.y - 5 - SHAPES[w.kind].tall * 0.4) : 0;
    m.group.position.set(w.x, high + (asleep ? SHAPES[w.kind].long * 0.08 : 0), w.z);
    m.group.rotation.set(0, w.yaw, asleep ? 1.35 : 0);
    const stride = w.moving ? Math.sin(w.stride * 0.9) * 0.5 : 0;
    m.legs.forEach(function (leg, n) {
      leg.rotation.x = stride * (n % 4 === 0 || n % 4 === 3 ? 1 : -1);
    });
    m.tail.rotation.y = Math.sin(t * 1.6 + w.x) * 0.25;
    m.head.rotation.x = m.tilt;
    if (m.jaw) m.jaw.rotation.x = w.mood === "hunt" ? -0.4 - Math.sin(t * 5) * 0.15 : -0.05;
    const sign = w.mood === "hunt" ? "angry" : asleep ? "asleep" : w.hits > 0 ? "hungry" : null;
    w.sign.visible = !!sign;
    if (sign) {
      w.sign.material = SIGNS[sign];
      w.sign.position.set(w.x, SHAPES[w.kind].tall + 2 + high, w.z);
      w.sign.scale.setScalar(3 + Math.sin(t * 6) * 0.3);
    }
  }
}

// ----- The dart gun -----
// Fire a sleepy dart at whatever dinosaur is under the little cross in the middle of the screen
function fireDart() {
  if (flying || state.time < dartReady) return;
  if (state.darts <= 0) return say("Out of darts! Fetch more from the yellow crate at your camp.", 3);
  dartReady = state.time + 0.7;
  state.darts--;
  soundDart();
  const way = { x: -Math.sin(me.yaw) * Math.cos(me.pitch), y: Math.sin(me.pitch), z: -Math.cos(me.yaw) * Math.cos(me.pitch) };
  let best = null;
  let bestOff = 0.1;
  const aimAt = function (thing, kind, wild) {
    const dx = thing.x - me.x;
    const dy = SHAPES[kind].tall * 0.5 - 1.6;
    const dz = thing.z - me.z;
    const far = Math.hypot(dx, dy, dz);
    if (far > 55) return;
    // How far off your aim is it? (Bigger dinosaurs are easier to hit.)
    const off = Math.acos(clamp((dx * way.x + dy * way.y + dz * way.z) / far, -1, 1)) - Math.atan(SHAPES[kind].long * 0.3 / far);
    if (off < bestOff) {
      best = { thing: thing, kind: kind, wild: wild };
      bestOff = off;
    }
  };
  for (const w of wilds) {
    if (w.mood !== "asleep" && w.mood !== "hooked") aimAt(w, w.kind, true);
  }
  for (const d of state.dinos) {
    if (d.mood !== "egg" && d.mood !== "asleep" && d.mood !== "lift" && (d.loose || d.mood === "angry")) aimAt(d, d.kind, false);
  }
  if (!best) return say("Missed!", 1.5);
  const sp = SPECIES[best.kind];
  if (!best.wild) return dartHit(best.thing);
  const w = best.thing;
  w.hits++;
  if (w.hits >= sp.darts) {
    w.mood = "asleep";
    w.until = state.time + 100;
    state.slept++;
    say("The " + sp.name + " is fast asleep. Now fetch the helicopter and hook it!", 5);
  } else {
    // Not asleep yet: plant-eaters bolt, and meat-eaters come for you
    w.mood = sp.hunter ? "hunt" : "flee";
    w.until = state.time + (sp.hunter ? 6 : 5);
    say("Hit! The " + sp.name + " needs " + (sp.darts - w.hits) + " more.", 2.5);
  }
}

// ----- The helicopter -----
function flyHeli(dt) {
  const push = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const turn = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
  const lift = (keys.Space ? 1 : 0) - (keys.KeyC ? 1 : 0);
  heli.yaw += turn * 1.5 * dt;
  heli.y = clamp(heli.y + lift * 9 * dt, 0, 70);
  // It only moves along once it is off the ground
  heli.speed += (heli.y > 0.5 ? push * 20 : 0) * dt;
  heli.speed *= Math.exp(-0.9 * dt);
  if (heli.y <= 0.5) heli.speed *= Math.exp(-6 * dt);
  heli.x = clamp(heli.x - Math.sin(heli.yaw) * heli.speed * dt, -HALF - 30, HALF + 30);
  heli.z = clamp(heli.z - Math.cos(heli.yaw) * heli.speed * dt, -HALF - 30, HALF + 30);
  // It can't sink into the trees, or into a paddock fence
  const i = tileOf(heli.x);
  const k = tileOf(heli.z);
  const floor = treeAt[keyOf(i, k)] ? treeAt[keyOf(i, k)].high + 3 : padAt(i, k) || typeAt(i, k) && !TOOLS[typeAt(i, k)].walk ? 6 : 0;
  if (heli.y < floor) heli.y = Math.min(floor, heli.y + 14 * dt);
  me.x = heli.x;
  me.z = heli.z;
}

function poseHeli(dt) {
  heli.model.position.set(heli.x, heli.y + 2.2, heli.z);
  heli.model.rotation.set(flying ? clamp(heli.speed / 60, -0.3, 0.3) : 0, heli.yaw, 0);
  if (flying) heli.model.userData.rotor.rotation.y += dt * 32;
}

// The sleeping dinosaur the helicopter could hook right now
function hookTarget() {
  if (heli.cargo || heli.y < 4 || heli.y > 34) return null;
  let best = null;
  let bestFar = 10;
  for (const w of wilds) {
    if (w.mood !== "asleep") continue;
    const far = Math.hypot(w.x - heli.x, w.z - heli.z);
    if (far < bestFar) {
      best = w;
      bestFar = far;
    }
  }
  return best;
}

// Lower the dinosaur you are carrying into the paddock under the helicopter: it joins your park
function lowerCargo(pad) {
  const w = heli.cargo;
  heli.cargo = null;
  state.dinos.push({
    id: state.nextId++, kind: w.kind, pad: pad.id, x: heli.x, z: heli.z, yaw: w.yaw,
    grow: 1, hunger: 75, comfort: 75, mood: "calm", loose: false, why: [], hatchAt: 0, wake: 0,
  });
  state.caughtFrom[w.section] = true;
  comeBack.push({ kind: w.kind, section: w.section, at: state.time + 150 });
  removeWild(w);
  soundCash();
  say("The " + SPECIES[w.kind].name + " wakes up in its new home!", 4);
  save();
}
