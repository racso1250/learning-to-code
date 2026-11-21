// Farshore: the leviathans.
// Three giants live on this world, and each one owns a different part of it:
//   The Tidewalker  wades around Landing Isle on four enormous legs. It is gentle,
//                   but it does not look where it puts its feet.
//   The Deepmaw     hunts in the deep water north of Landing Isle. It never comes into the shallows.
//   The Stormwing   circles the top of Thunder Peak and dives at anything out in the open.

// ===== 1. The Tidewalker =====
const WALK = { x: 0, z: 120, r: 150, speed: 3.2, high: 34 };
const walker = { a: 2.4, x: 0, y: WALK.high, z: 0, yaw: 0, feet: [], group: new THREE.Group() };

(function () {
  const g = walker.group;
  g.rotation.order = "YXZ";
  const hide = paint(0x4a7a78, 0x061414);
  const moss = paint(0x5fc88a, 0x0a2a14);
  const shell = piece(g, new THREE.SphereGeometry(1, 16, 10), hide, 0, 0, 0);
  shell.scale.set(13, 7, 18);
  const back = piece(g, new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), moss, 0, 2.5, 1);
  back.scale.set(10.5, 6, 15);
  // A little forest grows on its back
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3;
    const x = Math.cos(a) * (2 + i % 5);
    const z = Math.sin(a) * (3 + i % 7) + 1;
    piece(g, new THREE.CylinderGeometry(0.15, 0.3, 4, 5), paint(0x7a5a8a), x, 9.5, z);
    piece(g, new THREE.SphereGeometry(1.6, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), paint(i % 2 ? 0xff7ab8 : 0xffb86a), x, 11, z).scale.y = 0.5;
  }
  // The head hangs low at the front, with four glowing eyes
  const head = piece(g, new THREE.SphereGeometry(1, 12, 9), hide, 0, -4, -17);
  head.scale.set(5, 4, 6.5);
  for (const side of [-1, 1]) {
    piece(g, new THREE.SphereGeometry(0.8, 8, 6), bright(0xfff0a0), side * 3.6, -3, -21);
    piece(g, new THREE.SphereGeometry(0.5, 8, 6), bright(0xfff0a0), side * 4.4, -1.6, -18.5);
  }
  // Long feelers hanging underneath
  walker.feelers = [];
  for (let i = 0; i < 8; i++) {
    const feeler = piece(g, new THREE.CylinderGeometry(0.12, 0.3, 12, 5), moss, Math.cos(i * 1.9) * 6, -11, Math.sin(i * 2.7) * 11);
    walker.feelers.push(feeler);
  }
  scene.add(g);

  // Four legs. Each has a hip (on the body), a knee and a foot, joined by two long bones.
  const bone = new THREE.CylinderGeometry(1.2, 1.5, 1, 8);
  const shin = new THREE.CylinderGeometry(1.4, 0.9, 1, 8);
  for (const lx of [-9, 9]) {
    for (const lz of [-11, 11]) {
      const foot = {
        lx: lx, lz: lz, x: 0, y: 0, z: 0, t: 1,
        thigh: new THREE.Mesh(bone, hide), shin: new THREE.Mesh(shin, hide),
        knee: new THREE.Mesh(new THREE.SphereGeometry(2, 9, 7), hide),
        pad: new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 2, 10), hide),
      };
      scene.add(foot.thigh, foot.shin, foot.knee, foot.pad);
      walker.feet.push(foot);
    }
  }
})();

const hipSpot = new THREE.Vector3();
const kneeSpot = new THREE.Vector3();
const footSpot = new THREE.Vector3();

// Turn a spot beside the Tidewalker (lx to its side, lz behind it) into a real place in the world
function besideWalker(lx, lz) {
  const c = Math.cos(walker.yaw);
  const s = Math.sin(walker.yaw);
  return { x: walker.x + lx * c + lz * s, z: walker.z - lx * s + lz * c };
}

function placeWalker() {
  walker.x = WALK.x + Math.cos(walker.a) * WALK.r;
  walker.z = WALK.z + Math.sin(walker.a) * WALK.r;
  walker.yaw = Math.atan2(Math.sin(walker.a), -Math.cos(walker.a));
}

// Stand it up with all four feet on the ground (when a game starts)
function resetWalker() {
  placeWalker();
  for (const foot of walker.feet) {
    const spot = besideWalker(foot.lx * 1.9, foot.lz);
    foot.x = spot.x;
    foot.z = spot.z;
    foot.y = groundAt(spot.x, spot.z);
    foot.t = 1;
  }
}

function updateWalker(dt, now) {
  walker.a += WALK.speed / WALK.r * dt;
  placeWalker();
  walker.y = WALK.high + Math.sin(now * 0.8) * 0.8;
  let stepping = walker.feet.filter(function (foot) { return foot.t < 1; }).length;
  for (const foot of walker.feet) {
    if (foot.t >= 1) {
      // A foot stays planted until the body has walked on too far. Then it takes a big step.
      const want = besideWalker(foot.lx * 1.9, foot.lz - 8);
      if (stepping < 2 && Math.hypot(foot.x - want.x, foot.z - want.z) > 15) {
        const ahead = besideWalker(foot.lx * 1.9, foot.lz - 15);
        foot.t = 0;
        foot.from = { x: foot.x, y: foot.y, z: foot.z };
        foot.to = { x: ahead.x, y: groundAt(ahead.x, ahead.z), z: ahead.z };
        stepping++;
      }
    } else {
      foot.t = Math.min(1, foot.t + dt / 1.5);
      const s = smooth(foot.t);
      foot.x = foot.from.x + (foot.to.x - foot.from.x) * s;
      foot.z = foot.from.z + (foot.to.z - foot.from.z) * s;
      foot.y = foot.from.y + (foot.to.y - foot.from.y) * s + Math.sin(foot.t * Math.PI) * 11;
      if (foot.t >= 1) stomp(foot);
    }
  }
}

// A foot comes down: the ground shakes, and anybody underneath is in trouble
function stomp(foot) {
  const far = Math.hypot(me.x - foot.x, me.z - foot.z);
  if (far < 110) {
    soundStomp(1 - far / 110);
    shake = Math.max(shake, 0.7 * (1 - far / 110));
  }
  if (far < 6.5 && !me.indoor && Math.abs(me.y - 1.6 - foot.y) < 9) hurt(35, "The Tidewalker trod on you! It never even noticed.");
}

function poseWalker(now) {
  const g = walker.group;
  g.position.set(walker.x, walker.y, walker.z);
  g.rotation.set(Math.sin(now * 0.5) * 0.02, walker.yaw, Math.sin(now * 0.8) * 0.03);
  walker.feelers.forEach(function (feeler, i) {
    feeler.rotation.x = Math.sin(now * 0.9 + i) * 0.2;
    feeler.rotation.z = Math.cos(now * 0.7 + i * 2) * 0.2;
  });
  for (const foot of walker.feet) {
    const hip = besideWalker(foot.lx, foot.lz);
    hipSpot.set(hip.x, walker.y - 3, hip.z);
    footSpot.set(foot.x, foot.y + 1, foot.z);
    // The knee sticks up and out to the side, like a spider's
    const out = besideWalker(foot.lx * 2.6, foot.lz);
    kneeSpot.set((out.x + foot.x) / 2, walker.y + 9, (out.z + foot.z) / 2);
    stretch(foot.thigh, hipSpot, kneeSpot);
    stretch(foot.shin, kneeSpot, footSpot);
    foot.knee.position.copy(kneeSpot);
    foot.pad.position.copy(footSpot);
  }
}

// ===== 2. The Deepmaw =====
const MAW = { x: 0, z: -85, rx: 250, rz: 26, deep: -22, see: 80, speed: 7, chase: 10.5, bite: 45 };
const maw = { x: MAW.rx, y: MAW.deep, z: MAW.z, yaw: 0, pitch: 0, a: 0, mood: "roam", rest: 0, scared: 0, breach: -99, nextBreach: 12, met: false, group: new THREE.Group() };

(function () {
  const g = maw.group;
  g.rotation.order = "YXZ";
  const skin = paint(0x8a2a3a, 0x1a0408);
  const belly = paint(0xe8c8b8);
  const body = piece(g, new THREE.SphereGeometry(1, 16, 12), skin, 0, 0, 3);
  body.scale.set(4.6, 4.3, 14);
  const under = piece(g, new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), belly, 0, -0.3, 3);
  under.scale.set(4.2, 4.2, 13);
  // The top of the head, and a huge jaw that swings open underneath
  const head = piece(g, new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, 0.2, -8);
  head.scale.set(4.2, 3, 7);
  maw.jaw = new THREE.Group();
  maw.jaw.position.set(0, -0.2, -4);
  const chin = piece(maw.jaw, new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), belly, 0, 0, -4);
  chin.scale.set(4, 2.2, 6.8);
  const tooth = paint(0xffffff, 0x444444);
  for (let i = 0; i < 9; i++) {
    const a = (i - 4) * 0.33;
    const x = Math.sin(a) * 3.7;
    const z = -Math.cos(a) * 6.3;
    piece(g, new THREE.ConeGeometry(0.4, 1.8, 5), tooth, x, -0.6, -8 + z).rotation.x = Math.PI;
    piece(maw.jaw, new THREE.ConeGeometry(0.4, 1.9, 5), tooth, x * 0.95, 0.8, -4 + z * 0.95);
  }
  for (const side of [-1, 1]) {
    piece(g, new THREE.SphereGeometry(0.5, 8, 6), bright(0xffe14a), side * 3.3, 1.2, -10.5);
    const fin = piece(g, new THREE.BoxGeometry(6, 0.3, 3), skin, side * 6.5, -1.5, -1);
    fin.rotation.z = side * -0.45;
    // Glowing stripes along its sides
    for (let i = 0; i < 5; i++) piece(g, new THREE.BoxGeometry(0.1, 2.4, 0.5), bright(0x4affd8), side * (4.5 - i * 0.12), 0.4, -2 + i * 1.6);
  }
  // A row of sail fins down its back, and a tall tail
  for (let i = 0; i < 3; i++) piece(g, new THREE.ConeGeometry(1.4, 4.5 - i, 4), skin, 0, 5.4 - i * 0.5, i * 5).scale.x = 0.2;
  maw.tail = new THREE.Group();
  maw.tail.position.set(0, 0, 15);
  piece(maw.tail, new THREE.ConeGeometry(2, 5, 8), skin, 0, 0, 1.5).rotation.x = Math.PI / 2;
  piece(maw.tail, new THREE.BoxGeometry(0.4, 11, 4), skin, 0, 0, 5);
  g.add(maw.jaw, maw.tail);
  scene.add(g);
})();

function farFrom(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// Turn towards a spot and swim at it
function swimTo(g, tx, ty, tz, speed, dt, turnSpeed) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dz = tz - g.z;
  let turn = Math.atan2(-dx, -dz) - g.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  g.yaw += clamp(turn, -turnSpeed * dt, turnSpeed * dt);
  const tip = clamp(Math.atan2(dy, Math.hypot(dx, dz) + 0.01), -0.8, 0.8) - g.pitch;
  g.pitch += clamp(tip, -dt, dt);
  g.x -= Math.sin(g.yaw) * Math.cos(g.pitch) * speed * dt;
  g.y += Math.sin(g.pitch) * speed * dt;
  g.z -= Math.cos(g.yaw) * Math.cos(g.pitch) * speed * dt;
}

function updateMaw(dt, now) {
  const far = farFrom(maw, me);
  // It only hunts swimmers in deep water, in the northern sea
  const prey = alive() && isSwimming() && groundAt(me.x, me.z) < -18 && me.z < 30 && now > maw.rest && now > maw.scared;
  const oldX = maw.x;
  const oldY = maw.y;
  const oldZ = maw.z;

  if (maw.mood === "roam") {
    if (prey && far < MAW.see) {
      maw.mood = "hunt";
      soundRoar();
      say(maw.met ? "The Deepmaw is after you!" : "THE DEEPMAW! It can't follow you into shallow water. Swim for the shore!", maw.met ? 3 : 7);
      maw.met = true;
      return;
    }
    // Swim round and round its long loop. Now and then it leaps right out of the sea.
    maw.a += MAW.speed / 160 * dt;
    if (now > maw.nextBreach) {
      maw.breach = now;
      maw.nextBreach = now + 30 + Math.random() * 25;
    }
    const leap = (now - maw.breach) / 3.6;
    const wantY = MAW.deep + (leap >= 0 && leap <= 1 ? Math.sin(leap * Math.PI) * 34 : 0);
    const ease = Math.min(1, dt * 3);
    maw.x += (MAW.x + Math.cos(maw.a) * MAW.rx - maw.x) * ease;
    maw.z += (MAW.z + Math.sin(maw.a) * MAW.rz - maw.z) * ease;
    maw.y += (wantY - maw.y) * ease;
    // A great splash when it lands
    if (oldY > 1 && maw.y <= 1 && far < 260) soundSplash(1 - far / 260);
    // Point the way it is moving
    const dx = maw.x - oldX;
    const dy = maw.y - oldY;
    const dz = maw.z - oldZ;
    if (Math.hypot(dx, dz) > 0.001) {
      maw.yaw = Math.atan2(-dx, -dz);
      maw.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    }
    return;
  }

  if (maw.mood === "hunt") {
    if (!prey || far > MAW.see * 1.6) {
      maw.mood = "return";
    } else {
      swimTo(maw, me.x, me.y - 0.6, me.z, MAW.chase, dt, 1.3);
      maw.y = clamp(maw.y, groundAt(maw.x, maw.z) + 4, -3);
      // Too shallow! It turns back.
      if (groundAt(maw.x, maw.z) > -12) {
        maw.mood = "return";
        maw.rest = now + 6;
      }
      const mouth = { x: maw.x - Math.sin(maw.yaw) * 12, y: maw.y, z: maw.z - Math.cos(maw.yaw) * 12 };
      if (farFrom(mouth, me) < 5.5) {
        hurt(MAW.bite, "The Deepmaw got you!");
        maw.rest = now + 7;
        maw.mood = "return";
      }
    }
    if (maw.mood === "return") maw.a = Math.atan2((maw.z - MAW.z) / MAW.rz, (maw.x - MAW.x) / MAW.rx);
    return;
  }

  // Going back to its loop
  const tx = MAW.x + Math.cos(maw.a) * MAW.rx;
  const tz = MAW.z + Math.sin(maw.a) * MAW.rz;
  swimTo(maw, tx, MAW.deep, tz, MAW.speed * 1.4, dt, 1.3);
  maw.y = clamp(maw.y, groundAt(maw.x, maw.z) + 4, -3);
  if (Math.hypot(maw.x - tx, maw.z - tz) < 16) maw.mood = "roam";
}

function poseMaw(now) {
  const hunting = maw.mood === "hunt";
  maw.group.position.set(maw.x, maw.y, maw.z);
  maw.group.rotation.set(maw.pitch, maw.yaw, 0);
  maw.jaw.rotation.x = -(hunting || maw.y > -6 ? 0.6 + Math.sin(now * 5) * 0.15 : 0.12);
  maw.tail.rotation.y = Math.sin(now * (hunting ? 7 : 3)) * 0.4;
}

// ===== 3. The Stormwing =====
const WING = { r: 75, high: 124, turn: 0.13 };
const wing = { a: 1, x: 0, y: WING.high, z: 0, yaw: 0, pitch: 0, mood: "circle", t0: 0, from: null, aim: null, next: 6, met: false, group: new THREE.Group(), flaps: [] };

(function () {
  const g = wing.group;
  g.rotation.order = "YXZ";
  const skin = paint(0x3a3a7a, 0x06061a);
  const body = piece(g, new THREE.SphereGeometry(1, 14, 10), skin, 0, 0, 0);
  body.scale.set(4.5, 1.6, 8);
  // Glowing marks underneath, so you can see it against the sky
  for (let i = 0; i < 6; i++) piece(g, new THREE.SphereGeometry(0.5, 6, 5), bright(0x8ff0ff), (i % 2 ? 1 : -1) * 1.8, -1.4, -4 + Math.floor(i / 2) * 3.4);
  for (const side of [-1, 1]) {
    const flap = new THREE.Group();
    flap.position.set(side * 3.5, 0, 0);
    const panel = piece(flap, new THREE.BoxGeometry(13, 0.3, 9), skin, side * 6.5, 0, 0.5);
    panel.rotation.y = side * -0.25;
    piece(flap, new THREE.BoxGeometry(6, 0.2, 4), paint(0x5a5ab8, 0x10103a), side * 14, 0, 2.5).rotation.y = side * -0.6;
    g.add(flap);
    wing.flaps.push({ group: flap, side: side });
    piece(g, new THREE.ConeGeometry(0.4, 3, 5), skin, side * 1.6, 0.4, -8.6).rotation.x = -Math.PI / 2;
    piece(g, new THREE.SphereGeometry(0.4, 8, 6), bright(0xff5a3a), side * 2.2, 0.5, -6.4);
  }
  const tail = piece(g, new THREE.CylinderGeometry(0.15, 0.5, 16, 5), skin, 0, 0, 15);
  tail.rotation.x = Math.PI / 2;
  piece(g, new THREE.SphereGeometry(0.7, 8, 6), bright(0x8ff0ff), 0, 0, 23);
  scene.add(g);
})();

function wingCircle() {
  const peak = isle("peak");
  return { x: peak.x + Math.cos(wing.a) * WING.r, y: WING.high + Math.sin(wing.a * 3) * 6, z: peak.z + Math.sin(wing.a) * WING.r };
}

function updateWing(dt, now) {
  const peak = isle("peak");
  wing.a += WING.turn * dt;
  const oldX = wing.x;
  const oldY = wing.y;
  const oldZ = wing.z;
  // It can only see you out in the open, up on the mountain
  const open = alive() && !me.indoor && !sheltered() && Math.hypot(me.x - peak.x, me.z - peak.z) < 100 && me.y - 1.6 > 16;

  if (wing.mood === "circle") {
    const spot = wingCircle();
    const ease = Math.min(1, dt * 2);
    wing.x += (spot.x - wing.x) * ease;
    wing.y += (spot.y - wing.y) * ease;
    wing.z += (spot.z - wing.z) * ease;
    if (open && now > wing.next) {
      wing.mood = "dive";
      wing.t0 = now;
      wing.from = { x: wing.x, y: wing.y, z: wing.z };
      wing.aim = { x: me.x, y: me.y + 0.5, z: me.z };
      soundScreech();
      say(wing.met ? "The Stormwing is diving! Get under cover!" : "THE STORMWING! It dives at anything in the open. Hide under a rock arch, or inside a room!", wing.met ? 3 : 7);
      wing.met = true;
    }
  } else if (wing.mood === "dive") {
    const u = (now - wing.t0) / 3.4;
    // It follows you for most of the dive. A quick dash at the very end can dodge it.
    if (u < 0.8) wing.aim = { x: me.x, y: me.y + 0.5, z: me.z };
    const s = Math.min(1, u * u);
    wing.x = wing.from.x + (wing.aim.x - wing.from.x) * s;
    wing.y = wing.from.y + (wing.aim.y - wing.from.y) * s;
    wing.z = wing.from.z + (wing.aim.z - wing.from.z) * s;
    if (u >= 1) {
      if (!me.indoor && !sheltered() && farFrom(wing.aim, me) < 4.5) hurt(30, "The Stormwing got you!");
      wing.mood = "climb";
      wing.t0 = now;
      wing.from = { x: wing.x, y: wing.y, z: wing.z };
    }
  } else {
    // Flapping back up to its circle
    const u = Math.min(1, (now - wing.t0) / 4.5);
    const spot = wingCircle();
    const s = smooth(u);
    wing.x = wing.from.x + (spot.x - wing.from.x) * s;
    wing.y = wing.from.y + (spot.y - wing.from.y) * s + Math.sin(u * Math.PI) * 10;
    wing.z = wing.from.z + (spot.z - wing.from.z) * s;
    if (u >= 1) {
      wing.mood = "circle";
      wing.next = now + 6;
    }
  }
  const dx = wing.x - oldX;
  const dy = wing.y - oldY;
  const dz = wing.z - oldZ;
  if (Math.hypot(dx, dz) > 0.001) {
    wing.yaw = Math.atan2(-dx, -dz);
    wing.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.1, 1.1);
  }
}

function poseWing(now) {
  wing.group.position.set(wing.x, wing.y, wing.z);
  wing.group.rotation.set(wing.pitch, wing.yaw, wing.mood === "circle" ? -0.3 : 0);
  const beat = wing.mood === "dive" ? 0.1 : Math.sin(now * (wing.mood === "climb" ? 6 : 2.2)) * 0.45;
  for (const flap of wing.flaps) flap.group.rotation.z = flap.side * beat;
}

// ===== 4. All together =====
function resetGiants() {
  walker.a = 2.4;
  resetWalker();
  maw.a = 0;
  maw.x = MAW.x + MAW.rx;
  maw.y = MAW.deep;
  maw.z = MAW.z;
  maw.mood = "roam";
  maw.rest = maw.scared = 0;
  wing.mood = "circle";
  const spot = wingCircle();
  wing.x = spot.x;
  wing.y = spot.y;
  wing.z = spot.z;
}

function updateGiants(dt, now) {
  updateWalker(dt, now);
  updateMaw(dt, now);
  updateWing(dt, now);
}

function poseGiants(now) {
  poseWalker(now);
  poseMaw(now);
  poseWing(now);
}
