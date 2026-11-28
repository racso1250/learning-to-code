// Fossil Bay: Wild Again. The creatures.
// Land dinosaurs belong to herds (in data.js), and the herd says how they behave. There are also
// Pteranodons that swoop from the sky, a Mosasaurus that hunts your boat, and one surprise.

const dinos = [];       // { kind, herd, x, z, y, yaw, mood, goal, wait, hp, model, sign ... }
const spits = [];       // blobs of spit flying through the air
const rollDino = seeded(65);
// The Mosasaurus swims up and down the channel between the island and Lab Rock
const CHANNEL = [{ x: 318, z: -120 }, { x: 322, z: -30 }, { x: 330, z: 60 }, { x: 300, z: 150 }, { x: 230, z: 215 }];

function addDino(kind, herd, x, z) {
  const d = { kind: kind, herd: herd, x: x, z: z, y: groundAt(x, z), yaw: rollDino() * 6, mood: "roam", goal: null, wait: rollDino() * 4, hp: 2, stun: 0, fleeUntil: 0, fear: null, biteAt: 0, warn: 0, moving: 0, model: null, sign: null, id: dinos.length };
  dinos.push(d);
  return d;
}

function makeDinos() {
  for (const herd of HERDS) {
    for (let n = 0; n < herd.count; n++) {
      const spot = landSpot(herd.at, rollDino);
      addDino(herd.kind, herd, spot.x, spot.z);
    }
  }
  // Five Pteranodons circle over the Aviary Cliffs
  for (let n = 0; n < 5; n++) {
    const d = addDino("ptera", { act: "fly", walk: 9, run: 24 }, CLIFFS.x, CLIFFS.z);
    d.turn = n * 1.26;
    d.wide = 26 + n * 7;
    d.high = groundAt(CLIFFS.x, CLIFFS.z) + 20 + n * 4;
    d.y = d.high;
  }
  const mosa = addDino("mosa", { act: "swim", walk: 5, run: 17 }, CHANNEL[1].x, CHANNEL[1].z);
  mosa.y = -2.2;
  mosa.next = 2;
  mosa.step = 1;
  // The Emperor, asleep in its pen
  const boss = addDino("boss", { act: "hunter", walk: 3, run: 7.3 }, (PEN.x0 + PEN.x1) / 2 + 2, (PEN.z0 + PEN.z1) / 2);
  boss.mood = "asleep";
  boss.yaw = Math.PI / 2;
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

// Turn towards a spot and walk at it. Land animals won't go into deep water. Gives back how far away it still is.
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
    do {
      d.goal = landSpot(d.kind === "rex" ? { x: -20, z: -20, r: 200 } : d.herd.at, Math.random);   // the T. rex walks the whole island
    } while (d.kind === "rex" && (gap(d.goal, DOCK) < 60 || gap(d.goal, CENTRE) < 35));
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
  if (d.kind === "hlurk") return me.sneak ? 9 : 20;      // the Sail Lurker waits until you are close
  return me.sneak ? 14 : 28;
}

function updateDinos(dt) {
  const onFoot = me.mode === "foot" && state.time > state.safeUntil;      // can a land animal get at you?
  const flare = state.flare && state.time < state.flare.until ? state.flare : null;
  for (const d of dinos) {
    d.moving = 0;
    const act = d.herd.act;
    if (act === "fly") {
      fly(d, dt);
      continue;
    }
    if (act === "swim") {
      swim(d, dt);
      continue;
    }
    if (d.kind === "boss" && updateBoss(d, dt)) continue;
    if (d.stun > 0) {
      d.stun -= dt;
      continue;
    }
    const far = gap(d, me);
    if (far > 280 && d.mood !== "chase") continue;      // too far away to matter: let it stand
    if (state.time < d.fleeUntil) {
      // Running away from whatever frightened it
      const away = Math.atan2(d.x - d.fear.x, d.z - d.fear.z);
      stepTo(d, d.x + Math.sin(away) * 10, d.z + Math.cos(away) * 10, d.herd.run, dt);
      continue;
    }
    // Meat-eaters can't resist a burning flare: they walk up to it and stare
    if (flare && (act === "hunter" || act === "spitter" || act === "pest") && gap(d, flare) < 50) {
      d.mood = "lured";
      if (gap(d, flare) > 3 + SPECIES[d.kind].size * 0.3) stepTo(d, flare.x, flare.z, d.herd.run * 0.8, dt);
      continue;
    }
    if (d.mood === "lured") d.mood = "roam";
    if (act === "shy") {
      if (onFoot && far < 11) scare(d, me, 3);
      else roam(d, dt);
    } else if (act === "calm") {
      roam(d, dt);
    } else if (act === "grumpy") {
      if (onFoot && far < 7) {
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
    } else if (act === "pest") {
      if (onFoot && far < 13) {
        d.mood = "chase";
        if (stepTo(d, me.x, me.z, d.herd.run * 0.75, dt) < 1.2) {
          hurt(4, null, "Ow! A Compsognathus nipped your ankle.");
          scare(d, me, 10);
        }
      } else {
        d.mood = "roam";
        roam(d, dt);
      }
    } else if (act === "spitter") {
      if (onFoot && far < 22) {
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
      if (onFoot && far < noticeRange(d)) {
        startChase(d);
        for (const mate of dinos) {
          if (mate.herd === d.herd && mate !== d && gap(mate, d) < 45 && state.time > mate.fleeUntil) mate.mood = "chase", mate.chaseUntil = d.chaseUntil;
        }
      } else {
        roam(d, dt);
      }
    } else {
      // A hunter that is after you
      const lost = d.kind === "rex" && me.still > 2.5 && far > 10;
      if (!onFoot || far > 80 || state.time > d.chaseUntil || lost) {
        d.mood = "roam";
        d.goal = null;
        d.wait = 2;
        if (me.mode === "tower" && far < 30) say("The " + SPECIES[d.kind].name + " can't reach you up here!", 3);
        else if (lost) say("You kept still, and the T. rex lost sight of you.", 4);
        continue;
      }
      // Big hunters bite harder, but not so often
      const big = SPECIES[d.kind].size > 8;
      if (stepTo(d, me.x, me.z, d.herd.run, dt) < (big ? SPECIES[d.kind].size * 0.4 : 1.8) && state.time > d.biteAt) {
        d.biteAt = state.time + (big ? 2.5 : 1.3);
        hurt(d.kind === "rex" ? 40 : big ? 25 : 10, d, "");
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
    say("The T. REX has seen you! Run, climb a tower, or stand perfectly still!", 4);
  } else {
    soundGrowl();
  }
}

// ----- The Emperor -----
// It sleeps in its pen until you take the last drive. Then the alarm wakes it, the gate breaks,
// and it hunts you all the way to the water. Gives back true while it is doing something special.
function updateBoss(d, dt) {
  if (!state.bossAt) {
    d.mood = "asleep";
    return true;
  }
  const since = state.time - state.bossAt;
  if (since < 4) {
    // Waking up: it stands, and roars
    d.mood = "wake";
    if (!d.roared && since > 1.5) {
      d.roared = true;
      soundRoar();
      shake = 1;
    }
    return true;
  }
  if (!state.gateDown) {
    state.gateDown = true;
    blocks.splice(blocks.indexOf(ruins.gateBlock), 1);
    sound(function () { playNoise(0, 0.8, 500, 60, 0.5); });
    shake = 1.2;
    say("The gate is down! RUN FOR THE BOAT!", 4);
  }
  const flare = state.flare && state.time < state.flare.until ? state.flare : null;
  if (flare && gap(d, flare) < 50) return false;          // (the ordinary code makes it stare at the flare)
  if (me.mode === "foot" && state.time > state.safeUntil) {
    d.mood = "chase";
    d.chaseUntil = state.time + 99;
    if (stepTo(d, me.x, me.z, since < 7 ? 4 : d.herd.run, dt) < 5.5 && state.time > d.biteAt) {
      d.biteAt = state.time + 2.5;
      hurt(35, d, "");
    }
  } else {
    // You are out of its reach: it paces along the shore and bellows
    d.mood = "roam";
    stepTo(d, me.x, me.z, d.herd.walk, dt);
    if (state.time > (d.roarAt || 0)) {
      d.roarAt = state.time + 7;
      if (gap(d, me) < 120) soundRoar();
    }
  }
  return true;
}

// ----- Pteranodons -----
// They glide in circles over the cliffs. When you walk about up there, one at a time dives at you.
function fly(d, dt) {
  const exposed = me.mode === "foot" && gap(me, CLIFFS) < 75 && state.time > state.safeUntil;
  if (d.mood === "roam") {
    d.turn += dt * d.herd.walk / d.wide;
    const tx = CLIFFS.x + Math.cos(d.turn) * d.wide;
    const tz = CLIFFS.z + Math.sin(d.turn) * d.wide;
    d.x += (tx - d.x) * Math.min(1, dt * 1.5);
    d.z += (tz - d.z) * Math.min(1, dt * 1.5);
    d.y += (d.high - d.y) * Math.min(1, dt * 0.8);
    d.yaw = -d.turn + Math.PI;
    if (exposed && state.time > (fly.next || 0) && Math.abs(d.y - d.high) < 3) {
      fly.next = state.time + 7 + Math.random() * 3;
      d.mood = "chase";
      d.hit = false;
      sound(function () { playTone(0, 0.5, 1500, 700, 0.2); });
    }
    return;
  }
  // Diving: straight at your head, then away again
  const dx = me.x - d.x;
  const dy = me.y + 0.2 - d.y;
  const dz = me.z - d.z;
  const far = Math.hypot(dx, dy, dz);
  if (!d.hit && far > 1.6 && exposed) {
    const step = d.herd.run * dt;
    d.x += dx / far * step;
    d.y += dy / far * step;
    d.z += dz / far * step;
    d.yaw = Math.atan2(-dx, -dz);
    return;
  }
  if (!d.hit && exposed) {
    if (me.sneak) say("You ducked, and the Pteranodon missed!", 2);
    else hurt(10, d, "A Pteranodon swooped and hit you! Press C to duck when you hear the screech.");
  }
  d.hit = true;
  d.mood = "roam";
}

// ----- The Mosasaurus -----
// It cruises the channel, deep down. When your boat comes near it stalks you, then charges up at you.
function swim(d, dt) {
  const boat = state.boat;
  const hunting = me.mode === "boat" && gap(d, boat) < 95 && state.time > (d.restUntil || 0);
  let speed = d.herd.walk;
  let tx;
  let tz;
  let deep = -2.4;
  if (hunting) {
    // Aim a little ahead of the boat. It rises as it gets close.
    const far = gap(d, boat);
    tx = boat.x - Math.sin(boat.yaw) * boatSpeed * 0.8;
    tz = boat.z - Math.cos(boat.yaw) * boatSpeed * 0.8;
    speed = far < 45 ? d.herd.run : 9;
    deep = far < 30 ? -0.4 : -1.6;
    d.mood = far < 45 ? "chase" : "roam";
    if (d.mood === "chase" && !d.warned) {
      d.warned = true;
      say("Something huge is coming up under the boat! Full speed, and turn hard!", 4);
      sound(function () { playTone(0, 1.2, 60, 110, 0.4); });
    }
    if (far < 5) {
      // Crunch!
      state.boat.hull -= 25;
      boatSpeed = -6;
      shake = 1;
      sound(function () { playNoise(0, 0.5, 600, 80, 0.5); });
      say("The Mosasaurus rams the boat!", 3);
      d.restUntil = state.time + (state.bossAt ? 6 : 10);
      d.warned = false;
      if (state.boat.hull <= 0) sinkBoat();
    } else if (d.mood === "chase") {
      // If it has been charging for a while and still has not caught you, it gives up for now
      d.charge = (d.charge || 0) + dt;
      if (d.charge > 9) {
        d.charge = 0;
        d.restUntil = state.time + 8;
        d.warned = false;
        say("The Mosasaurus sinks back into the deep. For now.", 3);
      }
    }
  } else {
    d.mood = "roam";
    d.charge = 0;
    const goal = CHANNEL[d.next];
    tx = goal.x;
    tz = goal.z;
    if (gap(d, goal) < 8) {
      // Up and down the channel, turning round at each end
      if (d.next + d.step < 0 || d.next + d.step >= CHANNEL.length) d.step = -d.step;
      d.next += d.step;
    }
  }
  const dx = tx - d.x;
  const dz = tz - d.z;
  const far = Math.hypot(dx, dz);
  if (far > 0.1) {
    let turn = Math.atan2(-dx, -dz) - d.yaw;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    d.yaw += clamp(turn, -1.3 * dt, 1.3 * dt);             // it is big, so it turns slowly: that is how you dodge it
    const nx = d.x - Math.sin(d.yaw) * speed * dt;
    const nz = d.z - Math.cos(d.yaw) * speed * dt;
    if (groundAt(nx, nz) < -3.2) {
      d.x = nx;
      d.z = nz;
    } else {
      d.yaw += 2.5 * dt;                                     // too shallow: turn away
    }
    d.moving = speed;
  }
  d.y += (deep - d.y) * Math.min(1, dt * 1.2);
}

// ----- Drawing -----
const spitMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color: 0x9aff3a }), 12);
spitMesh.frustumCulled = false;
scene.add(spitMesh);

// Put every creature's model where the creature is, and make it move
function poseDinos(t) {
  for (const d of dinos) {
    const far = Math.hypot(d.x - camera.position.x, d.z - camera.position.z);
    if (!d.model) {
      if (far > 230) continue;                 // models are only built when you first get near
      d.model = makeCreature(d.kind);
      d.model.group.rotation.order = "YXZ";
      d.sign = new THREE.Sprite(SIGNS.hunt);
      scene.add(d.model.group, d.sign);
    }
    const m = d.model;
    m.group.visible = far < 260;
    d.sign.visible = false;
    if (!m.group.visible) continue;
    const act = d.herd.act;
    if (act === "fly") {
      m.group.position.set(d.x, d.y, d.z);
      m.group.rotation.set(d.mood === "chase" ? -0.5 : 0, d.yaw, d.mood === "chase" ? 0 : -0.3);
      for (const wing of m.wings) wing.group.rotation.z = wing.side * Math.sin(t * (d.mood === "chase" ? 2 : 4) + d.id) * (d.mood === "chase" ? 0.15 : 0.45);
      continue;
    }
    if (act === "swim") {
      m.group.position.set(d.x, d.y, d.z);
      m.group.rotation.set(d.mood === "chase" && d.y > -1 ? 0.25 : 0, d.yaw, 0);
      m.tail.rotation.y = Math.sin(t * (2 + d.moving * 0.2)) * 0.4;
      m.jaw.rotation.x = d.mood === "chase" ? -0.5 - Math.sin(t * 5) * 0.15 : -0.05;
      m.flippers.forEach(function (flipper, n) {
        flipper.rotation.z = Math.sin(t * 2 + n) * 0.25;
      });
      continue;
    }
    d.y += (groundAt(d.x, d.z) - d.y) * 0.3;
    const asleep = d.mood === "asleep";
    m.group.position.set(d.x, Math.max(d.y, -0.6) + (asleep ? SPECIES[d.kind].size * 0.07 : 0), d.z);
    m.group.rotation.set(0, d.yaw, asleep ? 1.3 : d.stun > 0 ? 0.25 : 0);
    const stride = d.moving ? Math.sin(t * (4 + d.moving * 1.3) + d.id) * 0.55 : 0;
    m.legs.forEach(function (leg, n) {
      leg.rotation.x = stride * (n % 4 === 0 || n % 4 === 3 ? 1 : -1);
    });
    m.tail.rotation.y = Math.sin(t * 1.6 + d.id) * (asleep ? 0.03 : 0.25);
    const angry = (d.mood === "chase" || d.mood === "wake") && act !== "pest";
    m.head.rotation.x = d.mood === "roam" && !d.moving && d.id % 2 && SPECIES[d.kind].diet === "plants" ? -0.45 + Math.sin(t * 3 + d.id) * 0.06 : d.mood === "wake" ? 0.4 : 0;
    if (m.jaw) m.jaw.rotation.x = angry ? -0.4 - Math.sin(t * 6) * 0.15 : -0.05;
    const sign = angry ? "hunt" : d.mood === "warn" || d.mood === "lured" ? "look" : asleep ? "sleep" : null;
    if (sign) {
      d.sign.visible = true;
      d.sign.material = SIGNS[sign];
      d.sign.position.set(d.x, d.y + SPECIES[d.kind].size * 0.6 + 1.4, d.z);
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
