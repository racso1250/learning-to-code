// Camp Fossil Bay: the dinosaurs.
// Little thieves in the jungle, a stampede on the plains, Triceratops in the road, raptors that
// hunt by sight, and something very big asleep on Radio Hill.

const dinos = [];       // { kind, x, z, yaw, mood, home, model, sign, cone ... }

function addDino(kind, i, k, extra) {
  const d = Object.assign({ kind: kind, x: mid(i), z: mid(k), yaw: 0, mood: "roam", home: { x: mid(i), z: mid(k) }, goal: null, wait: Math.random() * 3, moving: 0, until: 0, biteAt: 0, id: dinos.length }, extra || {});
  d.model = makeDino(kind);
  d.model.group.rotation.order = "YXZ";
  d.sign = new THREE.Sprite(SIGNS.hunt);
  scene.add(d.model.group, d.sign);
  dinos.push(d);
  return d;
}

function makeDinos() {
  // Compsognathus in the jungle
  for (const spot of [[30, 36], [32, 35], [37, 24], [38, 34], [29, 24]]) addDino("compy", spot[0], spot[1], { act: "pest", walk: 1.6, run: 5 });
  // The Gallimimus herd: they run down the plains in a pack, again and again
  for (let n = 0; n < 7; n++) addDino("galli", 49 + (n % 4) * 1.3, 6, { act: "stampede", lane: 49 + (n % 4) * 1.3, back: (n % 3) * 3 + Math.floor(n / 4) * 5 });
  // Three Triceratops standing in the pass, and some gentle giants further off
  for (const spot of [[59, 27.5], [59.5, 29.5], [58.5, 31]]) addDino("tri", spot[0], spot[1], { act: "block", walk: 1.5, yaw: Math.PI / 2 });
  for (const spot of [[52, 12], [61, 10], [49, 20]]) addDino("para", spot[0], spot[1], { act: "calm", walk: 1.6 });
  for (const spot of [[51, 47], [61, 50]]) addDino("brach", spot[0], spot[1], { act: "calm", walk: 1.2 });
  // Raptors walk round and round their own beat. Each beat is a list of corners.
  const beats = [[[72, 28], [72, 40], [77, 40], [77, 31]], [[82, 22], [74, 22], [74, 27], [82, 27]], [[83, 32], [83, 37], [79, 37], [79, 32]]];
  for (const beat of beats) addDino("raptor", beat[0][0], beat[0][1], { act: "raptor", beat: beat.map(function (c) { return { x: mid(c[0]), z: mid(c[1]) }; }), next: 1, walk: 2.6, run: 6.9, cone: makeCone(12, 0.55) });
  // The Shimmer prowls round the fuse crate in the south of Raptor Valley. You can hardly see it!
  const ghost = addDino("ghost", 74, 44, { act: "ghost", beat: [[74, 44], [81, 44], [81, 50], [72, 50], [70, 46]].map(function (c) { return { x: mid(c[0]), z: mid(c[1]) }; }), next: 1, walk: 2.4, run: 6.6, fade: 0 });
  // Its skin can fade away. Its eyes can't: remember which parts are which.
  ghost.skin = [];
  ghost.eyes = [];
  ghost.model.group.traverse(function (part) {
    if (!part.isMesh) return;
    part.castShadow = false;
    part.material.transparent = true;
    (part.material.isMeshBasicMaterial ? ghost.eyes : ghost.skin).push(part.material);
  });
  // The T. rex, asleep on Radio Hill, just north-west of the ranger station
  addDino("rex", 92, 15, { act: "rex", mood: "asleep", walk: 3, run: 6.8, yaw: 1.2 });
  // Bonk, the baby Pachycephalosaurus
  addDino("bonk", 21, 18, { act: "bonk" });
}

// Put every dinosaur back where it started (when you run back to a campfire)
function resetDinos() {
  for (const d of dinos) {
    if (d.act === "bonk" || d.act === "stampede") continue;
    if (d.act === "block" && state.calm) continue;
    d.x = d.home.x;
    d.z = d.home.z;
    d.goal = null;
    d.until = 0;
    d.mood = d.act === "rex" ? (state.called ? "wait" : "asleep") : "roam";
    if (d.act === "rex") d.until = state.time + 6;
    if (d.act === "raptor") d.next = 1;
  }
}

// Can a dinosaur walk here? (Not into water, cliffs, trees or buildings.)
function dinoCanGo(x, z, d) {
  const type = groundAt(x, z);
  if (type === "water" || type === "rock" || type === "edge") return false;
  if (d.kind === "rex" && (type === "wood" || type === "sand")) return false;       // too heavy for the beach and the pier
  const thing = MAP.things[tileOf(x) + "," + tileOf(z)];
  return !thing || (d.kind === "rex" && thing.type !== "wall");                      // (the T. rex just knocks trees aside)
}

// Turn towards a spot and walk at it. Gives back how far away it still is.
function stepTo(d, x, z, speed, dt) {
  const dx = x - d.x;
  const dz = z - d.z;
  const far = Math.hypot(dx, dz);
  if (far < 0.05) return far;
  let turn = Math.atan2(-dx, -dz) - d.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  d.yaw += clamp(turn, -5 * dt, 5 * dt);
  const step = Math.min(far, speed * dt);
  const nx = d.x + dx / far * step;
  const nz = d.z + dz / far * step;
  const fromX = d.x;
  const fromZ = d.z;
  if (dinoCanGo(nx, d.z, d)) d.x = nx;
  if (dinoCanGo(d.x, nz, d)) d.z = nz;
  if (speed > 0.5 && Math.hypot(d.x - fromX, d.z - fromZ) < step * 0.5) {
    // Something solid is in the way: sidestep round it. (If that goes on too long, try the other side.)
    d.side = d.side || (d.id % 2 ? 1 : -1);
    const sx = d.x - dz / far * step * d.side;
    const sz = d.z + dx / far * step * d.side;
    if (dinoCanGo(sx, d.z, d)) d.x = sx;
    if (dinoCanGo(d.x, sz, d)) d.z = sz;
    d.sideFor = (d.sideFor || 0) + dt;
    if (d.sideFor > 3) {
      d.side = -d.side;
      d.sideFor = 0;
    }
  }
  d.moving = speed;
  return far - step;
}

function wander(d, dt, wide) {
  if (d.wait > 0) {
    d.wait -= dt;
    return;
  }
  if (!d.goal) d.goal = { x: d.home.x + (Math.random() - 0.5) * wide, z: d.home.z + (Math.random() - 0.5) * wide, t: 6 };
  d.goal.t -= dt;
  if (stepTo(d, d.goal.x, d.goal.z, d.walk, dt) < 1 || d.goal.t < 0) {
    d.goal = null;
    d.wait = 1 + Math.random() * 5;
  }
}

function updateDinos(dt) {
  const flare = state.flare && state.time < state.flare.until ? state.flare : null;
  const safe = state.time < me.safeUntil;
  for (const d of dinos) {
    d.moving = 0;
    const far = Math.hypot(d.x - me.x, d.z - me.z);
    const lured = flare && Math.hypot(d.x - flare.x, d.z - flare.z) < 40 && (d.act === "pest" || d.act === "raptor" || d.act === "ghost" || (d.act === "rex" && d.mood !== "asleep"));
    if (lured) {
      // Meat-eaters can't resist a burning flare: they walk up to it and stare
      d.mood = "lured";
      if (Math.hypot(d.x - flare.x, d.z - flare.z) > 2 + SPECIES[d.kind].size * 0.3) stepTo(d, flare.x, flare.z, d.run * 0.8, dt);
      continue;
    }
    if (d.mood === "lured") d.mood = d.act === "rex" ? "chase" : "roam";

    if (d.act === "calm") {
      wander(d, dt, 16);
    } else if (d.act === "pest") {
      if (state.time < d.until) {
        // Frightened off for a while
        const away = Math.atan2(d.x - me.x, d.z - me.z);
        stepTo(d, d.x + Math.sin(away) * 8, d.z + Math.cos(away) * 8, d.run, dt);
      } else if (!me.hidden && !safe && far < 9) {
        d.mood = "chase";
        if (stepTo(d, me.x, me.z, d.run, dt) < 1) {
          hurt(1, d, "Ow! A Compsognathus nipped you. Ren can tell Bonk to chase them off (press 4, then Q).");
          d.until = state.time + 7;
        }
      } else {
        d.mood = "roam";
        wander(d, dt, 12);
      }
    } else if (d.act === "stampede") {
      // The herd thunders down the plains for six seconds, then there are eight seconds of quiet
      const wave = (state.time + 4) % 14;
      if (wave < 6) {
        d.x = mid(d.lane) + Math.sin(state.time * 3 + d.id) * 0.5;
        d.z = 6 + wave / 6 * 104 - d.back;
        d.yaw = Math.PI;
        d.moving = 11;
        if (!safe && Math.hypot(d.x - me.x, d.z - me.z) < 1.5) hurt(1, d, "Trampled by a Gallimimus! Wait for the herd to pass, then cross.");
      } else {
        d.z = -30;
      }
    } else if (d.act === "block") {
      if (state.calm) {
        // Calmed down: they amble off the road, north-east into the meadow
        stepTo(d, d.home.x + 8 + d.id % 3 * 3, d.home.z - 14 - (d.id % 2) * 3, d.walk, dt);
      } else if (far < 4.2 && !safe) {
        hurt(1, d, "The Triceratops shoves you back! Ren could calm them down (press 4, then E). Or is there another way round, to the south?");
      } else if (far < 12) {
        stepTo(d, me.x, me.z, 0.01, dt);            // (just turns to glare at you)
        d.mood = "warn";
      } else {
        d.mood = "roam";
      }
    } else if (d.act === "raptor") {
      updateRaptor(d, dt, far, safe);
    } else if (d.act === "ghost") {
      updateGhost(d, dt, far, safe);
    } else if (d.act === "rex") {
      updateRex(d, dt, far, safe);
    }
  }
}

// Raptors see with their eyes (the red fan), and they hear running feet close by.
// In long grass you are hidden, unless one almost treads on you.
function updateRaptor(d, dt, far, safe) {
  let turn = Math.atan2(-(me.x - d.x), -(me.z - d.z)) - d.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  const seen = !safe && ((far < 12 && Math.abs(turn) < 0.55 && !me.hidden) || far < 2.2 || (me.running && !me.hidden && far < 6));
  if (d.mood === "chase") {
    if (seen) d.lost = 0;
    else d.lost = (d.lost || 0) + dt;
    if (d.lost > 2.5 || safe || far > 45) {
      // Lost you: it sniffs about where it last saw you, then goes back to its beat
      d.mood = "search";
      d.until = state.time + 3;
      return;
    }
    if (stepTo(d, me.x, me.z, d.run, dt) < 1.6 && state.time > d.biteAt) {
      d.biteAt = state.time + 1.5;
      hurt(1, d, "A raptor got you! Hide in the long grass, or throw a flare (G).");
    }
    return;
  }
  if (seen) {
    d.mood = "chase";
    d.lost = 0;
    soundGrowl();
    return;
  }
  if (d.mood === "search") {
    d.yaw += dt * 1.5;
    if (state.time > d.until) d.mood = "roam";
    return;
  }
  // Walking the beat
  const corner = d.beat[d.next];
  if (stepTo(d, corner.x, corner.z, d.walk, dt) < 0.8) d.next = (d.next + 1) % d.beat.length;
}

// The Shimmer. While it prowls it is all but invisible: look for two red eyes, and for footprints
// appearing in the dirt. It shows itself only when it pounces. Long grass hides you from it,
// a flare lights it up, and it is scared of Bonk.
const prints = [];          // its footprints: { x, z, at }
function updateGhost(d, dt, far, safe) {
  // Footprints, one every stride
  if (d.moving && (!d.printAt || Math.hypot(d.x - d.printAt.x, d.z - d.printAt.z) > 1.3)) {
    d.printAt = { x: d.x, z: d.z };
    prints.push({ x: d.x + (prints.length % 2 ? 0.5 : -0.5), z: d.z, at: state.time });
    if (prints.length > 16) prints.shift();
  }
  // The first time it comes near, Bonk notices before anybody else does
  if (!state.warned && far < 26 && state.bonk) {
    state.warned = true;
    openTalk([["Ren", "Wait. Bonk is growling at that patch of grass. But there's nothing there..."], ["Bex", "Yes there is. Look. Two red eyes. And footprints, appearing all by themselves!"], ["Milo", "It can change colour, like a chameleon. The lab called it the Shimmer. We can't fight what we can't see."], ["Ren", "Then we hide in the long grass, or light a flare so we CAN see it. And Bonk isn't scared of it. Are you, Bonk?"]]);
    return;
  }
  if (state.time < d.until) {
    // Scared off by Bonk: it slinks away
    d.mood = "roam";
    stepTo(d, d.beat[0].x + 14, d.beat[0].z + 8, d.run, dt);
    return;
  }
  const seen = !safe && ((far < 9 && !me.hidden) || far < 3 || (me.running && !me.hidden && far < 14));
  if (d.mood === "chase") {
    d.lost = seen ? 0 : (d.lost || 0) + dt;
    if (d.lost > 2 || safe || far > 40) {
      d.mood = "roam";
      return;
    }
    if (stepTo(d, me.x, me.z, d.run, dt) < 3.4 && state.time > d.biteAt) {
      d.biteAt = state.time + 2;
      hurt(2, d, "The Shimmer pounced out of nowhere! Hide in the long grass, light a flare (G), or let Bonk see it off (Ren, then Q).");
      d.until = state.time + 5;      // it melts away again before its next try
    }
    return;
  }
  if (seen) {
    d.mood = "chase";
    d.lost = 0;
    sound(function () { playNoise(0, 0.5, 3000, 600, 0.25); });
    return;
  }
  const corner = d.beat[d.next];
  if (stepTo(d, corner.x, corner.z, d.walk, dt) < 0.8) d.next = (d.next + 1) % d.beat.length;
}

// The T. rex sleeps until the radio wakes it. (Or until somebody runs past, or walks right up to it!)
function updateRex(d, dt, far, safe) {
  if (d.mood === "asleep") {
    if (!safe && (far < 6 || (me.running && far < 20))) wakeRex(d, "You woke the T. rex! RUN back to the campfire!");
    return;
  }
  if (d.mood === "wait") {
    // Shaking itself awake
    if (state.time > d.until) {
      d.mood = "chase";
      soundRoar();
      shake = 1;
    }
    return;
  }
  if (!state.called && (far > 50 || nearFire() >= 0)) {
    // It gives up, plods home, and goes back to sleep
    if (stepTo(d, d.home.x, d.home.z, d.walk, dt) < 2) d.mood = "asleep";
    return;
  }
  if (safe) return;
  if (stepTo(d, me.x, me.z, d.run, dt) < 5 && state.time > d.biteAt) {
    d.biteAt = state.time + 2.5;
    hurt(3, d, "");
  }
}

function wakeRex(d, text) {
  d.mood = "wait";
  d.until = state.time + 2.5;
  shake = 0.6;
  say(text, 5);
}

const printMesh = many(new THREE.CircleGeometry(0.34, 3), new THREE.MeshBasicMaterial({ color: 0x3a2a1a, transparent: true, opacity: 0.55 }), 16);

function drawDinos(t) {
  // The Shimmer's footprints fade away after a few seconds
  prints.forEach(function (print, n) {
    const big = Math.max(0, 1 - (state.time - print.at) / 7);
    helper.position.set(print.x, 0.04, print.z);
    helper.rotation.set(-Math.PI / 2, 0, n);
    helper.scale.set(big, big, big);
    helper.updateMatrix();
    printMesh.setMatrixAt(n, helper.matrix);
  });
  printMesh.count = prints.length;
  printMesh.instanceMatrix.needsUpdate = true;
  for (const d of dinos) {
    const m = d.model;
    d.sign.visible = false;
    m.group.position.set(d.x, 0, d.z);
    const asleep = d.mood === "asleep";
    m.group.rotation.set(0, d.yaw, asleep ? 1.3 : 0);
    if (asleep) m.group.position.y = SPECIES[d.kind].size * 0.07;
    const stride = d.moving ? Math.sin(t * (4 + d.moving * 1.3) + d.id) * 0.55 : 0;
    m.legs.forEach(function (leg, n) { leg.rotation.x = stride * (n % 4 === 0 || n % 4 === 3 ? 1 : -1); });
    m.tail.rotation.y = Math.sin(t * 1.6 + d.id) * (asleep ? 0.03 : 0.25);
    const angry = d.mood === "chase" || d.mood === "wait";
    if (m.jaw) m.jaw.rotation.x = angry ? -0.4 - Math.sin(t * 6) * 0.15 : -0.05;
    m.head.rotation.x = d.charging ? -0.5 : 0;
    const sign = angry ? "hunt" : d.mood === "warn" || d.mood === "lured" || d.mood === "search" ? "look" : asleep ? "sleep" : d.act === "block" && state.calm && d.moving ? "calm" : null;
    if (sign) {
      d.sign.visible = true;
      d.sign.material = SIGNS[sign];
      d.sign.position.set(d.x, SPECIES[d.kind].size * 0.5 + 1.6, d.z);
      d.sign.scale.setScalar(d.kind === "rex" ? 2.4 : 1.1);
    }
    if (d.act === "ghost") {
      // Fade in when it pounces, or when a flare is burning near it. Fade out when it prowls.
      const flare = state.flare && state.time < state.flare.until && Math.hypot(d.x - state.flare.x, d.z - state.flare.z) < 14;
      d.fade += ((d.mood === "chase" || flare || state.time < d.until ? 1 : 0) - d.fade) * 0.06;
      for (const material of d.skin) material.opacity = 0.05 + d.fade * 0.95;
      for (const material of d.eyes) material.opacity = 0.6 + d.fade * 0.4;
      d.sign.visible = d.sign.visible && d.fade > 0.5;
    }
    if (d.cone) {
      d.cone.position.set(d.x, 0.06, d.z);
      d.cone.rotation.y = d.yaw;
      d.cone.children[0].material.opacity = d.mood === "chase" ? 0.4 : 0.2;
    }
  }
}
