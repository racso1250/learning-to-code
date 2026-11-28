// Treetop Island: the dinosaurs.
// Every dinosaur belongs to a herd (in data.js), and the herd says how it behaves:
// shy ones run away, grumpy ones charge, thieves steal food, spitters spit, and hunters hunt.

const dinos = [];       // { kind, herd, x, z, y, yaw, mood, goal, wait, hp, model, sign ... }
const spits = [];       // blobs of spit flying through the air
const rollDino = seeded(99);

function makeDinos() {
  for (const herd of HERDS) {
    for (let n = 0; n < herd.count; n++) {
      const spot = landSpot(herd.at, rollDino);
      dinos.push({ kind: herd.kind, herd: herd, x: spot.x, z: spot.z, y: groundAt(spot.x, spot.z), yaw: rollDino() * 6, mood: "roam", goal: null, wait: rollDino() * 4, hp: 2, stun: 0, fleeUntil: 0, fear: null, biteAt: 0, warn: 0, moving: 0, model: null, sign: null, id: dinos.length });
    }
  }
}

// A random dry spot inside a round place
function landSpot(place, roll) {
  for (let tries = 0; tries < 40; tries++) {
    const angle = roll() * 6.283;
    const far = Math.sqrt(roll()) * place.r;
    const x = place.x + Math.cos(angle) * far;
    const z = place.z + Math.sin(angle) * far;
    if (groundAt(x, z) > 0.8) return { x: x, z: z };
  }
  return { x: place.x, z: place.z };
}

// Turn towards a spot and walk at it. Dinosaurs won't go into deep water. Gives back how far away it still is.
function stepTo(d, x, z, speed, dt) {
  const dx = x - d.x;
  const dz = z - d.z;
  const far = Math.hypot(dx, dz);
  if (far < 0.05) return far;
  let turn = Math.atan2(-dx, -dz) - d.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  d.yaw += clamp(turn, -4 * dt, 4 * dt);
  const step = Math.min(far, speed * dt);
  const nx = d.x + dx / far * step;
  const nz = d.z + dz / far * step;
  if (groundAt(nx, nz) < -0.9) return far;      // the water is too deep
  d.x = nx;
  d.z = nz;
  d.moving = speed;
  return far - step;
}

// Wander about inside the herd's home
function roam(d, dt) {
  if (d.wait > 0) {
    d.wait -= dt;
    return;
  }
  if (!d.goal) {
    let home = d.herd.night && isNight() ? d.herd.night : d.herd.at;
    if (d.kind === "rex") home = { x: 0, z: 0, r: 215 };       // the T. rex walks the whole island
    do {
      d.goal = landSpot(home, Math.random);
    } while (d.kind === "rex" && gap(d.goal, HOME) < (isNight() ? 30 : 55));
  }
  if (stepTo(d, d.goal.x, d.goal.z, d.herd.walk, dt) < 1.5 || (d.stuck = (d.moving ? 0 : (d.stuck || 0) + dt)) > 2) {
    d.goal = null;
    d.stuck = 0;
    d.wait = d.kind === "rex" ? 2 : 1 + Math.random() * 6;
  }
}

function scare(d, from, seconds) {
  d.fleeUntil = state.time + seconds;
  d.fear = { x: from.x, z: from.z };
  d.mood = "roam";
  d.goal = null;
  d.warn = 0;
}

// How close you can get before a hunter notices you
function noticeRange(d) {
  if (d.kind === "rex") {
    if (me.still > 1.5) return 9;               // it can't see you if you don't move!
    return me.sneak ? 22 : 48;
  }
  let far = isNight() ? 36 : 28;
  if (me.sneak) far *= 0.5;
  if (state.lit) far *= 0.7;                    // raptors are wary of fire
  return far;
}

function updateDinos(dt) {
  const pet = dinos.find(function (d) { return d.kind === "pet"; });
  const guard = pet && state.pet.grow >= 1 ? pet : null;
  for (const d of dinos) {
    d.moving = 0;
    if (d.kind === "pet") {
      updatePet(d, dt);
      continue;
    }
    if (d.stun > 0) {
      d.stun -= dt;
      continue;
    }
    const far = gap(d, me);
    const act = d.herd.act;
    if (far > 260 && d.mood !== "chase") continue;      // too far away to matter: let it stand
    if (state.time < d.fleeUntil) {
      // Running away from whatever frightened it
      const away = Math.atan2(d.x - d.fear.x, d.z - d.fear.z);
      stepTo(d, d.x + Math.sin(away) * 10, d.z + Math.cos(away) * 10, d.herd.run, dt);
      continue;
    }
    const reach = !me.up && !me.out;                    // can it get at you at all?
    if (act === "shy") {
      if (reach && far < 11) scare(d, me, 3);
      else roam(d, dt);
    } else if (act === "calm") {
      roam(d, dt);
    } else if (act === "grumpy") {
      if (reach && far < 7) {
        // It warns you first (a "?" over its head), and then it charges
        d.warn += dt;
        d.mood = d.warn > 1.5 || far < 4 ? "chase" : "warn";
        if (d.mood === "chase") {
          if (stepTo(d, me.x, me.z, d.herd.run, dt) < 2 + SPECIES[d.kind].size * 0.15) {
            hurt(18, d, "The " + SPECIES[d.kind].name + " knocks you flying! Keep away from it.");
            scare(d, me, 4);
          }
        } else {
          stepTo(d, me.x, me.z, 0.01, dt);              // (just turns to face you)
        }
      } else {
        d.warn = Math.max(0, d.warn - dt);
        d.mood = "roam";
        roam(d, dt);
      }
    } else if (act === "thief") {
      if (guard && gap(d, guard) < 12) scare(d, guard, 8);
      else if (reach && state.lit && far < 8) scare(d, me, 6);
      else if (reach && far < 14 && foodCount() > 0) {
        d.mood = "chase";
        if (stepTo(d, me.x, me.z, d.herd.run * 0.75, dt) < 1.2) {
          stealFood(d);
          scare(d, me, 9);
        }
      } else {
        d.mood = "roam";
        roam(d, dt);
      }
    } else if (act === "spitter") {
      if (reach && state.lit && far < 7) scare(d, me, 8);
      else if (reach && far < 22) {
        d.mood = "chase";
        if (far > 11) stepTo(d, me.x, me.z, d.herd.run * 0.6, dt);
        else stepTo(d, me.x, me.z, 0.01, dt);
        if (far < 14 && state.time > d.biteAt) {
          d.biteAt = state.time + 3.5;
          const high = SPECIES.dilo.size * 0.5;
          spits.push({ x: d.x, y: d.y + high, z: d.z, vx: (me.x - d.x) / far * 16, vy: (me.y - d.y - high) / far * 16 + 2.2, vz: (me.z - d.z) / far * 16, life: 2 });
          soundSpit();
        }
      } else {
        d.mood = "roam";
        roam(d, dt);
      }
    } else if (d.mood !== "chase") {
      // A hunter that has not seen you yet
      if (reach && far < noticeRange(d) && state.time > state.safeUntil) {
        startChase(d);
        // The rest of the pack joins in
        for (const mate of dinos) {
          if (mate.herd === d.herd && mate !== d && gap(mate, d) < 45 && state.time > mate.fleeUntil) mate.mood = "chase", mate.chaseUntil = d.chaseUntil;
        }
      } else {
        roam(d, dt);
      }
    } else {
      // A hunter that is after you
      const lost = d.kind === "rex" && me.still > 2.5 && far > 10;
      if (!reach || far > 80 || state.time > d.chaseUntil || lost) {
        d.mood = "roam";
        d.goal = null;
        d.wait = 2;
        if (me.up && far < 30) say("The " + SPECIES[d.kind].name + " can't reach you up here!", 3);
        else if (lost) say("You kept still, and the T. rex lost sight of you.", 4);
        continue;
      }
      if (guard && d.kind === "raptor" && gap(d, guard) < 16) {
        // Your grown-up pet sees it off
        guard.goal = { x: d.x, z: d.z };
        scare(d, guard, 40);
        say(state.pet.name + " chases the raptor away!", 3);
        soundGrowl();
        continue;
      }
      const bite = (d.kind === "rex" ? 5 : 1.7);
      if (stepTo(d, me.x, me.z, d.herd.run, dt) < bite && state.time > d.biteAt) {
        d.biteAt = state.time + (d.kind === "rex" ? 2.5 : 1.3);
        hurt(d.kind === "rex" ? 40 : 9, d, "");
      }
    }
  }

  // Spit flies in a curve, and splats if it hits you
  for (let n = spits.length - 1; n >= 0; n--) {
    const s = spits[n];
    s.life -= dt;
    s.vy -= 6 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    if (Math.hypot(s.x - me.x, s.y - me.y, s.z - me.z) < 1.1) {
      state.blind = state.time + 4;
      hurt(6, null, "Yuck! Spit in your eyes!");
      s.life = 0;
    }
    if (s.life <= 0 || s.y < groundAt(s.x, s.z)) spits.splice(n, 1);
  }
}

function startChase(d) {
  d.mood = "chase";
  d.goal = null;
  d.chaseUntil = state.time + (d.kind === "rex" ? 24 : 30);
  if (d.kind === "rex") {
    soundRoar();
    shake = 0.8;
    say("The T. REX has seen you! Run, or stand perfectly still!", 4);
  } else {
    soundGrowl();
  }
}

// ----- Your pet -----
function addPet() {
  if (dinos.some(function (d) { return d.kind === "pet"; })) return;
  const foot = homeSpot("foot");
  dinos.push({ kind: "pet", herd: { walk: 3, run: 9.5, act: "pet" }, x: foot.x + 2, z: foot.z + 2, y: 0, yaw: 0, mood: "roam", goal: null, wait: 0, stun: 0, fleeUntil: 0, moving: 0, model: null, sign: null, id: 999 });
}

// It follows you about. When you are up in the treehouse, it waits at the bottom.
function updatePet(d, dt) {
  let to = me.up ? homeSpot("foot") : me;
  if (d.goal) {
    // Seeing off a raptor
    if (stepTo(d, d.goal.x, d.goal.z, d.herd.run, dt) < 3 || gap(d, me) > 30) d.goal = null;
    return;
  }
  const far = gap(d, to);
  if (far > 60) {
    // Left far behind: it catches up in a flash
    d.x = to.x + 3;
    d.z = to.z + 3;
  } else if (far > (me.up ? 2.5 : 3.5)) {
    stepTo(d, to.x, to.z, far > 9 ? d.herd.run : d.herd.walk, dt);
  }
}

// ----- Drawing -----
const spitMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color: 0x9aff3a }), 12);
spitMesh.frustumCulled = false;
scene.add(spitMesh);

// Put every dinosaur's model where the dinosaur is, and make it move
function poseDinos(t) {
  for (const d of dinos) {
    const far = Math.hypot(d.x - camera.position.x, d.z - camera.position.z);
    if (!d.model) {
      if (far > 210) continue;                 // models are only built when you first get near
      d.model = makeDino(d.kind);
      d.model.group.rotation.order = "YXZ";
      d.sign = new THREE.Sprite(SIGNS.hunt);
      scene.add(d.model.group, d.sign);
    }
    const m = d.model;
    m.group.visible = far < 230;
    d.sign.visible = false;
    if (!m.group.visible) continue;
    const big = d.kind === "pet" ? 0.3 + 0.7 * state.pet.grow : 1;
    d.y += (groundAt(d.x, d.z) - d.y) * 0.3;
    m.group.scale.setScalar(big);
    m.group.position.set(d.x, Math.max(d.y, -0.6), d.z);
    m.group.rotation.set(0, d.yaw, d.stun > 0 ? 0.25 : 0);
    const stride = d.moving ? Math.sin(t * (4 + d.moving * 1.3) + d.id) * 0.55 : 0;
    m.legs.forEach(function (leg, n) {
      leg.rotation.x = stride * (n % 4 === 0 || n % 4 === 3 ? 1 : -1);
    });
    m.tail.rotation.y = Math.sin(t * 1.6 + d.id) * 0.25;
    const angry = d.mood === "chase" && d.herd.act !== "thief";
    m.head.rotation.x = d.mood === "roam" && !d.moving && d.id % 2 && SPECIES[d.kind].diet === "plants" ? -0.45 + Math.sin(t * 3 + d.id) * 0.06 : 0;
    if (m.jaw) m.jaw.rotation.x = angry ? -0.4 - Math.sin(t * 6) * 0.15 : -0.05;
    const sign = angry ? "hunt" : d.mood === "warn" ? "look" : d.kind === "pet" && petHungry() ? "love" : null;
    if (sign) {
      d.sign.visible = true;
      d.sign.material = SIGNS[sign];
      d.sign.position.set(d.x, d.y + SPECIES[d.kind].size * 0.6 * big + 1.4, d.z);
      d.sign.scale.setScalar(far * 0.05 + 0.6);
    }
  }
  spits.forEach(function (s, n) {
    if (n >= 12) return;
    helper.position.set(s.x, s.y, s.z);
    helper.rotation.set(0, 0, 0);
    helper.scale.set(1, 1, 1);
    helper.updateMatrix();
    spitMesh.setMatrixAt(n, helper.matrix);
  });
  spitMesh.count = Math.min(12, spits.length);
  spitMesh.instanceMatrix.needsUpdate = true;
}
