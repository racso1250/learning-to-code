// Trenchlight: the leviathans.
// Four giants live in the crater, one in each deep layer. Each one guards a power core,
// and each one hunts in its own way:
//   Lanternmaw   chases lights. Switch your lights off to sneak by.
//   Ribbonwyrm   swims round and round the Arches. Cross when it is far away.
//   Boulderclaw  looks like a rock on the sea bed until you come close. It can't swim.
//   Gloomking    sits in the Abyss and pulls you in with its long arms.
// All of them are built with the nose pointing along "minus z", like the sub.

const giants = [];   // every leviathan in the sea
const decoys = [];   // the glowing decoys you have dropped: { x, y, z, vx, vy, vz, until, mesh }

// ===== 1. What they look like =====

function makeLanternmaw() {
  const g = new THREE.Group();
  const skin = paint(0x26404f, 0x040c12);
  const belly = paint(0x4a6a78, 0x061018);
  const tooth = paint(0xf4f0d8, 0x55533c);
  const body = piece(g, new THREE.SphereGeometry(6, 14, 10), skin, 0, 0, 3);
  body.scale.set(1, 0.9, 1.8);
  // The top of the head, and a huge jaw that swings open underneath it
  const head = piece(g, new THREE.SphereGeometry(5.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, 0.4, -6);
  head.scale.set(1.05, 0.85, 1.5);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.3, -1);
  g.add(jaw);
  const chin = piece(jaw, new THREE.SphereGeometry(5.2, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), belly, 0, 0, -5);
  chin.scale.set(1.05, 0.6, 1.5);
  for (let i = 0; i < 11; i++) {
    const a = (i - 5) * 0.28;
    const x = Math.sin(a) * 4.9;
    const z = -Math.cos(a) * 7.2;
    const top = piece(g, new THREE.ConeGeometry(0.42, 2.4, 5), tooth, x, -0.6, -6 + z);
    top.rotation.x = Math.PI;
    piece(jaw, new THREE.ConeGeometry(0.42, 2.6, 5), tooth, x * 0.96, 1.1, -5 + z * 0.96);
  }
  for (const side of [-1, 1]) {
    piece(g, new THREE.SphereGeometry(0.55, 8, 6), bright(0xfff2a0), side * 3.4, 2.4, -9.6);
    const fin = piece(g, new THREE.BoxGeometry(5, 0.3, 3), skin, side * 6.5, -1, 3);
    fin.rotation.z = side * -0.5;
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0, 12.5);
  piece(tail, new THREE.ConeGeometry(2.6, 6, 8), skin, 0, 0, 2).rotation.x = Math.PI / 2;
  piece(tail, new THREE.BoxGeometry(0.4, 9, 4), skin, 0, 0, 6);
  g.add(tail);
  // The lure: a glowing lamp on a long stalk, hanging in front of its mouth
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 3.6, -5), new THREE.Vector3(0, 12, -10), new THREE.Vector3(0, 5.5, -17));
  piece(g, new THREE.TubeGeometry(curve, 10, 0.22, 5), skin, 0, 0, 0);
  piece(g, new THREE.SphereGeometry(1.1, 10, 8), bright(0xfff08a), 0, 5.5, -17);
  const shine = glow(0xffe46a, 16);
  shine.position.set(0, 5.5, -17);
  g.add(shine);
  return { group: g, jaw: jaw, tail: tail, shine: shine };
}

function makeRibbonwyrm() {
  const g = new THREE.Group();
  const skin = paint(0x9fe8f0, 0x0f3a44);
  const fin = bright(0xff6ad8);
  const skull = piece(g, new THREE.SphereGeometry(2.6, 12, 8), skin, 0, 0, 0);
  skull.scale.set(1, 0.8, 1.9);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.6, -1);
  piece(jaw, new THREE.BoxGeometry(3, 0.6, 4.6), paint(0x6fb8c8), 0, 0, -2.3);
  for (let i = 0; i < 6; i++) piece(jaw, new THREE.ConeGeometry(0.22, 1.1, 4), paint(0xffffff, 0x555555), (i % 2 ? 1 : -1) * 1.2, 0.7, -1 - Math.floor(i / 2) * 1.5);
  g.add(jaw);
  for (const side of [-1, 1]) {
    piece(g, new THREE.SphereGeometry(0.45, 8, 6), bright(0xff3ad0), side * 1.9, 0.9, -3);
    const whisker = piece(g, new THREE.CylinderGeometry(0.08, 0.2, 7, 4), fin, side * 3, 0, 1);
    whisker.rotation.set(Math.PI / 2 - 0.3, 0, side * 0.5);
  }
  // The long body is made of beads that follow the head, like a train
  const beads = [];
  for (let i = 0; i < 20; i++) {
    const bead = new THREE.Group();
    const fat = 2.5 * (1 - i / 26);
    const ball = piece(bead, new THREE.SphereGeometry(1, 9, 7), skin, 0, 0, 0);
    ball.scale.set(fat * 0.8, fat, 1.9);
    piece(bead, new THREE.BoxGeometry(0.12, fat * 1.5, 2.2), fin, 0, fat * 1.2, 0);
    scene.add(bead);
    beads.push(bead);
  }
  return { group: g, jaw: jaw, beads: beads };
}

function makeBoulderclaw() {
  const g = new THREE.Group();
  const rock = paint(0x4a383a, 0x0c0404);
  const shell = piece(g, new THREE.DodecahedronGeometry(8, 1), rock, 0, 0, 0);
  shell.scale.set(1.3, 0.55, 1.1);
  // Lumps and glowing cracks on its back
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    piece(g, new THREE.DodecahedronGeometry(1.4 + (i % 3), 0), rock, Math.cos(a) * (3 + i % 4), 3.2 + (i % 2), Math.sin(a) * (2 + i % 4));
  }
  const cracks = new THREE.MeshBasicMaterial({ color: 0x1a0a06 });
  for (let i = 0; i < 6; i++) {
    const crack = piece(g, new THREE.BoxGeometry(0.5, 0.3, 3 + (i % 3)), cracks, Math.cos(i * 1.1) * 5, 3.9, Math.sin(i * 1.1) * 3.5);
    crack.rotation.y = i * 0.9;
  }
  const eyes = new THREE.MeshBasicMaterial({ color: 0x1a0a06 });
  const legs = [];
  for (const side of [-1, 1]) {
    piece(g, new THREE.CylinderGeometry(0.25, 0.4, 2.6, 5), rock, side * 2.2, 3.4, -7.4);
    piece(g, new THREE.SphereGeometry(0.75, 8, 6), eyes, side * 2.2, 5, -7.4);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Group();
      leg.position.set(side * 8.5, -0.5, -3 + i * 4);
      const upper = piece(leg, new THREE.CylinderGeometry(0.7, 0.9, 6.5, 6), rock, side * 2.4, 1.2, 0);
      upper.rotation.z = side * -1;
      const lower = piece(leg, new THREE.CylinderGeometry(0.3, 0.7, 7.5, 6), rock, side * 5.6, -1.4, 0);
      lower.rotation.z = side * 0.25;
      g.add(leg);
      legs.push(leg);
    }
  }
  // Two huge claws that swing shut
  const claws = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 6.5, 0, -7);
    const upper = piece(arm, new THREE.CylinderGeometry(1, 1.3, 7, 6), rock, side * 1.5, 0.5, -3);
    upper.rotation.set(Math.PI / 2, 0, side * -0.4);
    const pinch = new THREE.Group();
    pinch.position.set(side * 2.6, 0.5, -6.5);
    const fixed = piece(pinch, new THREE.ConeGeometry(1.7, 7, 5), rock, 0, -0.9, -3);
    fixed.rotation.x = -Math.PI / 2;
    const thumb = new THREE.Group();
    const top = piece(thumb, new THREE.ConeGeometry(1.2, 6.4, 5), rock, 0, 0, -3);
    top.rotation.x = -Math.PI / 2;
    thumb.position.y = 0.8;
    pinch.add(thumb);
    arm.add(pinch);
    g.add(arm);
    claws.push({ arm: arm, thumb: thumb, side: side });
  }
  return { group: g, legs: legs, claws: claws, eyes: eyes, cracks: cracks };
}

function makeGloomking() {
  const g = new THREE.Group();
  const skin = paint(0x2a1a4a, 0x0a0418);
  const mantle = piece(g, new THREE.SphereGeometry(12, 16, 12), skin, 0, 0, 12);
  mantle.scale.set(1, 1, 2.1);
  piece(g, new THREE.SphereGeometry(9, 14, 10), skin, 0, 0, -6);
  // A crown of spikes
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * 0.42;
    const spike = piece(g, new THREE.ConeGeometry(1.2, 9, 5), paint(0x6a4ac8, 0x2a1a6a), Math.sin(a) * 9, 9 + Math.cos(a) * 3, 2);
    spike.rotation.z = -a * 0.8;
  }
  // Great pale eyes
  const eye = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, fog: false });
  for (const side of [-1, 1]) {
    piece(g, new THREE.SphereGeometry(2.4, 12, 10), eye, side * 7, 2.5, -9);
    piece(g, new THREE.SphereGeometry(1.1, 8, 6), bright(0x08040f), side * 7.9, 2.5, -10.7);
    const shine = glow(0x9fd8ff, 20);
    shine.position.set(side * 7.5, 2.5, -10);
    g.add(shine);
  }
  // Rows of glowing spots, so you can see its shape in the dark
  const spot = new THREE.MeshBasicMaterial({ color: 0x9a6aff, fog: false });
  for (let i = 0; i < 26; i++) {
    const a = i * 0.9;
    const z = 2 + (i % 13) * 2.4;
    const fat = 12 * Math.sqrt(Math.max(0, 1 - Math.pow((z - 12) / 25.2, 2)));
    piece(g, new THREE.SphereGeometry(0.5, 6, 5), spot, Math.cos(a) * fat, Math.sin(a) * fat, z);
  }
  // Eight long arms. Each one is a chain of beads that we bend every frame.
  const arms = [];
  const armSkin = paint(0x3a2468, 0x10062a);
  const tip = new THREE.MeshBasicMaterial({ color: 0xc89aff, fog: false });
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + 0.39;
    const beads = [];
    for (let j = 0; j < 10; j++) {
      beads.push(piece(g, new THREE.SphereGeometry(2.3 - j * 0.17, 8, 6), j === 9 ? tip : armSkin, 0, 0, 0));
    }
    arms.push({ beads: beads, root: new THREE.Vector3(Math.cos(a) * 5.5, Math.sin(a) * 5.5, -12), out: new THREE.Vector3(Math.cos(a), Math.sin(a), 0), phase: k * 1.7 });
  }
  return { group: g, arms: arms };
}

const GIANT_MODELS = { lanternmaw: makeLanternmaw, ribbonwyrm: makeRibbonwyrm, boulderclaw: makeBoulderclaw, gloomking: makeGloomking };

// Put all four leviathans into the sea, each at its home
function makeGiants() {
  for (const kind in GIANTS) {
    const info = GIANTS[kind];
    const model = GIANT_MODELS[kind]();
    model.group.rotation.order = "YXZ";
    scene.add(model.group);
    giants.push({
      kind: kind, info: info, model: model,
      x: info.home.x, y: 0, z: info.home.z, yaw: 0, pitch: 0,
      mood: "roam",     // roam, hunt, lured, stunned or sleep
      goal: null, goalUntil: 0,
      stunned: 0,       // stunned until this time
      rest: 0,          // won't hunt again until this time
      angry: 0,         // extra fierce until this time (after you take its core)
      shown: 0,         // on your radar until this time
      awake: 0,         // (Boulderclaw) 0 = hiding as a rock ... 1 = standing up
      met: false, trail: [], far: 999,
    });
  }
  resetGiants();
}

// Send every leviathan back home (when a game starts, or after your sub is sunk)
function resetGiants() {
  for (const g of giants) {
    const home = g.info.home;
    g.x = home.x;
    g.z = home.z;
    if (g.info.ring) {
      // The wyrm starts on the far side of its ring from its core
      g.x = -home.x * 1.02;
      g.z = -home.z * 1.02;
    }
    g.y = groundAt(g.x, g.z) + g.info.clear + (g.kind === "boulderclaw" ? 0 : 8);
    g.mood = g.kind === "boulderclaw" ? "sleep" : "roam";
    g.awake = 0;
    g.goal = null;
    g.stunned = g.rest = g.angry = g.shown = 0;
    g.trail = [];
  }
}

// ===== 2. How they think =====

function farFrom(g, thing) {
  return Math.hypot(g.x - thing.x, g.y - thing.y, g.z - thing.z);
}

// Is there a decoy this giant would rather chase?
function decoyFor(g) {
  let best = null;
  for (const decoy of decoys) {
    const far = farFrom(g, decoy);
    if (far < 110 && (!best || far < farFrom(g, best))) best = decoy;
  }
  return best;
}

// Turn towards a spot and swim at it. Giants stay above the sea bed and under the ice.
function swimTo(g, tx, ty, tz, speed, dt) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dz = tz - g.z;
  let turn = Math.atan2(-dx, -dz) - g.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  g.yaw += clamp(turn, -g.info.turn * dt, g.info.turn * dt);
  const tip = clamp(Math.atan2(dy, Math.hypot(dx, dz) + 0.01), -0.8, 0.8) - g.pitch;
  g.pitch += clamp(tip, -dt, dt);
  g.x -= Math.sin(g.yaw) * Math.cos(g.pitch) * speed * dt;
  g.y += Math.sin(g.pitch) * speed * dt;
  g.z -= Math.cos(g.yaw) * Math.cos(g.pitch) * speed * dt;
  g.y = clamp(g.y, groundAt(g.x, g.z) + g.info.clear, ICE - g.info.clear);
}

// Is the sub inside this giant's hunting ground?
function inTerritory(g) {
  const info = g.info;
  if (info.ring) return Math.abs(Math.hypot(sub.x, sub.z) - info.ring) < info.leash;
  return Math.hypot(sub.x - info.home.x, sub.z - info.home.z) < info.leash;
}

// The moment a giant spots you
function startHunt(g) {
  g.mood = "hunt";
  soundRoar();
  if (!g.met) {
    g.met = true;
    say(g.info.tip, 7);
  } else {
    say(g.info.name + " is after you!", 3);
  }
}

// The three swimmers: Lanternmaw, Ribbonwyrm and Gloomking
function thinkSwimmer(g, dt, now) {
  const info = g.info;
  const decoy = decoyFor(g);
  const fierce = now < g.angry;
  const sight = sub.lights || fierce ? info.see : info.dark;
  const mayHunt = !isHidden() && now > g.rest && inTerritory(g);
  let goal;
  let speed;

  if (decoy) {
    g.mood = "lured";
    goal = decoy;
    speed = info.chase;
    if (farFrom(g, decoy) < 9) decoy.until = 0;   // gulp!
  } else if (mayHunt && (g.far < sight || (g.mood === "hunt" && g.far < sight * 1.5))) {
    if (g.mood !== "hunt") startHunt(g);
    goal = sub;
    speed = info.chase * (fierce ? 1.15 : 1);
  } else {
    g.mood = "roam";
    goal = roamGoal(g, now);
    speed = info.speed;
  }
  swimTo(g, goal.x, goal.y, goal.z, speed, dt);

  if (g.mood !== "hunt") return;
  // Close enough to bite? (The Gloomking hits with its arms, so it only has to be near.)
  const mouth = { x: g.x - Math.sin(g.yaw) * info.reach, y: g.y, z: g.z - Math.cos(g.yaw) * info.reach };
  if (farFrom(mouth, sub) < info.jaws) {
    hurt(info.bite, g);
    g.rest = now + 5;
    g.goal = null;
  }
  // The Gloomking drags you towards it
  if (g.kind === "gloomking" && g.far < 85 && g.far > 1) {
    const pull = 9 * dt / g.far;
    sub.vx += (g.x - sub.x) * pull;
    sub.vy += (g.y - sub.y) * pull;
    sub.vz += (g.z - sub.z) * pull;
  }
}

// Where a giant wanders when it is not hunting
function roamGoal(g, now) {
  const info = g.info;
  if (info.ring) {
    // Round and round the ring, rising and falling like a wave
    const a = Math.atan2(g.z, g.x) + 0.3;
    const x = Math.cos(a) * info.ring;
    const z = Math.sin(a) * info.ring;
    return { x: x, y: groundAt(x, z) + 14 + Math.sin(now * 0.4) * 7, z: z };
  }
  if (!g.goal || now > g.goalUntil || farFrom(g, g.goal) < 10) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * info.roam;
    const x = info.home.x + Math.cos(a) * r;
    const z = info.home.z + Math.sin(a) * r;
    g.goal = { x: x, y: groundAt(x, z) + info.clear + 4 + Math.random() * 16, z: z };
    g.goalUntil = now + 14;
  }
  return g.goal;
}

// Boulderclaw: hides as a rock, then walks along the sea bed
function thinkCrab(g, dt, now) {
  const info = g.info;
  const decoy = decoyFor(g);
  const flat = Math.hypot(sub.x - g.x, sub.z - g.z);
  const above = sub.y - groundAt(g.x, g.z);
  const fierce = now < g.angry;

  if (g.mood === "sleep") {
    g.awake = Math.max(0, g.awake - dt);
    const close = !isHidden() && flat < info.see && above < 32;
    if (!close && !decoy && !fierce) return;
    g.mood = "roam";
    soundRoar();
    if (!g.met) {
      g.met = true;
      say(info.tip, 7);
    }
  }
  g.awake = Math.min(1, g.awake + dt * 0.8);
  let goal;
  if (decoy) {
    g.mood = "lured";
    goal = decoy;
    if (Math.hypot(decoy.x - g.x, decoy.z - g.z) < 9) decoy.until = 0;
  } else if (!isHidden() && now > g.rest && inTerritory(g) && above < 50) {
    g.mood = "hunt";
    goal = sub;
  } else {
    // Nothing to chase: walk home and turn back into a rock
    g.mood = "roam";
    goal = info.home;
    if (Math.hypot(info.home.x - g.x, info.home.z - g.z) < 3 && !fierce) {
      g.mood = "sleep";
      return;
    }
  }
  const dx = goal.x - g.x;
  const dz = goal.z - g.z;
  let turn = Math.atan2(-dx, -dz) - g.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  g.yaw += clamp(turn, -info.turn * dt, info.turn * dt);
  // Walk right up to its home, but stop a little short of the sub or a decoy
  if (Math.hypot(dx, dz) > (goal === info.home ? 1.5 : 6) && g.awake > 0.6) {
    const speed = info.speed * (fierce ? 1.15 : 1);
    g.x -= Math.sin(g.yaw) * speed * dt;
    g.z -= Math.cos(g.yaw) * speed * dt;
    g.walked = (g.walked || 0) + speed * dt;
  }
  if (g.mood === "hunt" && g.far < info.jaws && g.awake > 0.9) {
    hurt(info.bite, g);
    g.rest = now + 4;
    g.snap = now + 0.5;
  }
}

// ===== 3. Every frame =====
const armAim = new THREE.Vector3();

function updateGiants(dt, now) {
  for (const g of giants) {
    g.far = farFrom(g, sub);
    if (now < g.stunned) g.mood = g.mood === "sleep" ? "sleep" : "stunned";
    else if (g.kind === "boulderclaw") thinkCrab(g, dt, now);
    else thinkSwimmer(g, dt, now);
    // A giant that is hunting you nearby always shows on your radar
    if ((g.mood === "hunt" || g.mood === "lured") && g.far < 150) g.shown = Math.max(g.shown, now + 0.5);
    poseGiant(g, now);
  }

  // Decoys drift, sink a little, and then fizzle out
  for (let i = decoys.length - 1; i >= 0; i--) {
    const decoy = decoys[i];
    const slow = Math.exp(-1.5 * dt);
    decoy.vx *= slow;
    decoy.vy = decoy.vy * slow - 0.4 * dt;
    decoy.vz *= slow;
    decoy.x += decoy.vx * dt;
    decoy.y = Math.max(groundAt(decoy.x, decoy.z) + 1.5, decoy.y + decoy.vy * dt);
    decoy.z += decoy.vz * dt;
    decoy.mesh.position.set(decoy.x, decoy.y, decoy.z);
    decoy.mesh.scale.setScalar(1 + Math.sin(now * 12) * 0.2);
    if (now > decoy.until) {
      scene.remove(decoy.mesh);
      decoys.splice(i, 1);
    }
  }
}

// Move a giant's model to where the giant is, and wiggle its parts
function poseGiant(g, now) {
  const model = g.model;
  const group = model.group;
  const shake = g.mood === "stunned" ? Math.sin(now * 40) * 0.06 : 0;
  const hunting = g.mood === "hunt" || g.mood === "lured";

  if (g.kind === "boulderclaw") {
    // A sleeping Boulderclaw sits low, with its legs and claws tucked in
    g.y = groundAt(g.x, g.z) + 1.5 + g.awake * 5;
    group.position.set(g.x, g.y, g.z);
    group.rotation.set(0, g.yaw, shake);
    const step = (g.walked || 0) * 0.5;
    model.legs.forEach(function (leg, i) {
      leg.scale.setScalar(0.25 + g.awake * 0.75);
      leg.rotation.y = Math.sin(step + i * 2.1) * 0.3 * g.awake;
    });
    const snapping = now < (g.snap || 0);
    model.claws.forEach(function (claw) {
      claw.arm.scale.setScalar(0.3 + g.awake * 0.7);
      claw.arm.rotation.x = g.awake * (hunting ? 0.45 : 0.1);
      claw.thumb.rotation.x = snapping ? 0 : 0.5 + Math.sin(now * 3 + claw.side) * 0.2;
    });
    const fire = g.awake > 0.3 ? 0xff7a20 : 0x1a0a06;
    model.eyes.color.setHex(fire);
    model.cracks.color.setHex(fire);
    return;
  }

  group.position.set(g.x, g.y, g.z);
  group.rotation.set(g.pitch, g.yaw, shake);

  if (g.kind === "lanternmaw") {
    model.jaw.rotation.x = -(hunting ? 0.55 + Math.sin(now * 5) * 0.2 : 0.12 + Math.sin(now) * 0.05);
    model.tail.rotation.y = Math.sin(now * (hunting ? 6 : 2.5)) * 0.4;
    model.shine.material.opacity = 0.7 + Math.sin(now * 3) * 0.3;
  } else if (g.kind === "ribbonwyrm") {
    model.jaw.rotation.x = -(hunting ? 0.5 : 0.1);
    // Remember where the head has been, and string the beads out along that path
    const trail = g.trail;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - g.x, last.y - g.y, last.z - g.z) > 0.8) {
      trail.push({ x: g.x, y: g.y, z: g.z });
      if (trail.length > 110) trail.shift();
    }
    model.beads.forEach(function (bead, i) {
      const spot = trail[Math.max(0, trail.length - 1 - (i + 1) * 5)] || g;
      const ahead = trail[Math.max(0, trail.length - 1 - i * 5)] || g;
      bead.position.set(spot.x, spot.y + Math.sin(now * 3 - i * 0.6) * 0.6, spot.z);
      if (ahead !== spot) bead.lookAt(ahead.x, ahead.y, ahead.z);
    });
  } else if (g.kind === "gloomking") {
    // Bend the arms. When it hunts, half of them reach out for the sub.
    group.updateMatrixWorld();
    armAim.set(sub.x, sub.y, sub.z);
    group.worldToLocal(armAim);
    model.arms.forEach(function (arm, k) {
      const reach = g.mood === "hunt" && g.far < 70 && k % 2 === 0;
      let wx = arm.out.x * 0.35;
      let wy = arm.out.y * 0.35;
      let wz = -1;
      if (reach) {
        wx = armAim.x - arm.root.x;
        wy = armAim.y - arm.root.y;
        wz = armAim.z - arm.root.z;
      }
      const long = Math.hypot(wx, wy, wz) || 1;
      arm.beads.forEach(function (bead, j) {
        const along = (j + 1) * 3.1;
        const wave = j * (reach ? 0.25 : 0.5);
        bead.position.set(
          arm.root.x + wx / long * along + Math.sin(now * 1.3 + j * 0.6 + arm.phase) * wave,
          arm.root.y + wy / long * along + Math.cos(now * 1.1 + j * 0.5 + arm.phase * 2) * wave,
          arm.root.z + wz / long * along
        );
      });
    });
  }
}
