// Fossil Bay: Wild Again. The game.
// Driving the boat, walking about, climbing watchtowers, scanning creatures, flares and medkits,
// the three data drives, the big escape, the map, your field guide, and saving.

// ===== 1. What the game remembers =====
const SAVE = "wildagain-save";

function freshState() {
  return {
    time: 0,
    health: 100,
    flares: 3, medkits: 1,
    scanned: {},             // the kinds of creature you have scanned: { tri: true ... }
    drives: [false, false, false],
    crates: CRATES.map(function () { return false; }),      // which crates you have opened
    boat: { x: SHIP.x - 16, z: SHIP.z - 12, yaw: 0.2, hull: 100 },
    flare: null,             // the flare that is burning right now: { x, z, until }
    goal: 0,
    landed: false, reachedRock: false,
    bossAt: 0,               // the moment the Emperor woke up (0 = still asleep)
    gateDown: false,
    blind: 0, safeUntil: 0,
    faints: 0,
    won: false,
    at: null,                // where you were when the game was saved
  };
}

let state = freshState();
// mode: "boat" (driving it), "foot" (walking) or "tower" (up a watchtower)
const me = { x: 0, z: 0, y: 1.6, yaw: 0, pitch: 0, mode: "boat", tower: 0, sneak: false, moving: false, running: false, still: 0, stamina: 1 };
let mode = "intro";          // intro, play, card, guide or won
let near = null;             // what E would do right now: { text, act }
let aim = null;              // the creature in the middle of your view (close enough to scan)
let scanning = 0;            // how far through a scan you are (0 to 1)
let boatSpeed = 0;
let locked = false;          // is the mouse steering the camera?
let mouseDown = false;
let shake = 0;
let wall = 0;                // a clock that never stops (for animations)
let hurtAt = -9;
let lastHurt = -9;
let lastSave = 0;
let lastCheck = 0;
let stepAt = 0;
const keys = {};

function scanCount() {
  return SURVEY.filter(function (kind) { return state.scanned[kind]; }).length;
}

function hybridCount() {
  return HYBRIDS.filter(function (kind) { return state.scanned[kind]; }).length;
}

function driveCount() {
  return state.drives.filter(Boolean).length;
}

// ===== 2. Sounds and messages =====
function sound(make) {
  try { make(); } catch (problem) { /* no sound is fine */ }
}
function soundPick() { sound(function () { playTone(0, 0.08, 600, 900, 0.12); }); }
function soundNo() { sound(function () { playTone(0, 0.15, 220, 160, 0.15); }); }
function soundGrowl() { sound(function () { playNoise(0, 0.6, 300, 100, 0.3); playTone(0, 0.5, 140, 80, 0.25); }); }
function soundRoar() { sound(function () { playNoise(0, 1.4, 400, 60, 0.5); playTone(0, 1.2, 150, 45, 0.4); }); }
function soundHurt() { sound(function () { playTone(0, 0.2, 300, 120, 0.25); }); }
function soundSpit() { sound(function () { playNoise(0, 0.15, 2500, 900, 0.15); }); }
function soundThud() { sound(function () { playTone(0, 0.25, 70, 40, 0.35); }); }
function soundScan() { sound(function () { playTone(0, 0.08, 900, 1200, 0.12); playTone(0.1, 0.08, 1200, 1500, 0.12); playTone(0.2, 0.2, 1500, 2000, 0.12); }); }

const el = function (id) { return document.getElementById(id); };
let toastUntil = 0;
function say(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastUntil = wall + (seconds || 3);
}

// A big message that stops the game until you press a key
let cardAfter = null;
function showCard(text, after) {
  el("card-text").textContent = text;
  el("card").hidden = false;
  cardAfter = after || null;
  mode = "card";
  if (document.exitPointerLock) document.exitPointerLock();
}

function closeCard() {
  el("card").hidden = true;
  mode = "play";
  const after = cardAfter;
  cardAfter = null;
  if (after) after();
}

// ===== 3. Moving about =====
// Are you on one of the wooden piers?
function onPier(x, z) {
  return PIERS.some(function (pier) { return Math.abs(x - pier.x) < 2.3 && z > pier.z0 - 3 && z < pier.z1; });
}

// How high the floor is under your feet
function floorAt(x, z) {
  return onPier(x, z) ? 1.05 : Math.max(groundAt(x, z), -0.5);
}

function canWalk(x, z) {
  if (onPier(x, z)) return true;
  if (groundAt(x, z) < -1.2) return false;       // any deeper and the water is over your head
  for (const block of blocks) {
    if (x > block.x0 - 0.4 && x < block.x1 + 0.4 && z > block.z0 - 0.4 && z < block.z1 + 0.4) return false;
  }
  return true;
}

function walk(dt) {
  me.yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 2 * dt;
  me.pitch = clamp(me.pitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * 1.2 * dt, -1.3, 1.3);
  const ahead = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  me.sneak = !!(keys.KeyC || keys.ControlLeft);
  me.moving = !!(ahead || side);
  me.still = me.moving ? 0 : me.still + dt;
  const up = me.mode === "tower";
  me.running = me.moving && !me.sneak && !up && (keys.ShiftLeft || keys.ShiftRight) && me.stamina > 0.02;
  if (me.running) me.stamina = Math.max(0, me.stamina - dt / 9);
  else me.stamina = Math.min(1, me.stamina + dt / (me.moving ? 9 : 4));
  if (me.moving) {
    const wet = !up && !onPier(me.x, me.z) && groundAt(me.x, me.z) < -0.2;
    const speed = (me.sneak ? 2.2 : me.running ? 8.5 : up ? 2 : 4.8) * (wet ? 0.6 : 1);
    const long = Math.hypot(ahead, side);
    const x = me.x + (-Math.sin(me.yaw) * ahead + Math.cos(me.yaw) * side) / long * speed * dt;
    const z = me.z + (-Math.cos(me.yaw) * ahead - Math.sin(me.yaw) * side) / long * speed * dt;
    if (up) {
      // At the top of a tower there is only a little floor to walk on
      const tower = TOWERS[me.tower];
      me.x = clamp(x, tower.x - 1.1, tower.x + 1.1);
      me.z = clamp(z, tower.z - 1.1, tower.z + 1.1);
    } else {
      if (canWalk(x, me.z)) me.x = x;
      if (canWalk(me.x, z)) me.z = z;
      // Tree trunks are solid: slide round them
      for (const tree of treesNear(me.x, me.z)) {
        const dx = me.x - tree.x;
        const dz = me.z - tree.z;
        const far = Math.hypot(dx, dz);
        if (far < tree.r + 0.45 && far > 0.001) {
          me.x = tree.x + dx / far * (tree.r + 0.45);
          me.z = tree.z + dz / far * (tree.r + 0.45);
        }
      }
      if (wall > stepAt) {
        stepAt = wall + (me.running ? 0.3 : 0.5);
        if (!me.sneak) sound(function () { playNoise(0, 0.05, wet ? 1800 : 500, wet ? 900 : 250, 0.05); });
      }
    }
  }
  me.y = (up ? groundAt(TOWERS[me.tower].x, TOWERS[me.tower].z) + 7.1 : floorAt(me.x, me.z)) + (me.sneak ? 1.1 : 1.7);
}

// The boat: W and S for the throttle, A and D to steer. It can only go where the water is deep enough.
function sail(dt) {
  const boat = state.boat;
  const push = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  boatSpeed += push * 14 * dt;
  boatSpeed *= Math.exp(-0.85 * dt);
  boat.yaw += steer * 1.5 * dt * clamp(boatSpeed / 5, -1, 1);
  const x = boat.x - Math.sin(boat.yaw) * boatSpeed * dt;
  const z = boat.z - Math.cos(boat.yaw) * boatSpeed * dt;
  if (groundAt(x, z) < -0.9 && !onPier(x, z) && gap({ x: x, z: z }, SHIP) > 9) {
    boat.x = x;
    boat.z = z;
  } else {
    boatSpeed *= -0.3;       // bump!
  }
  me.x = boat.x;
  me.z = boat.z;
  me.y = 1.7;
  me.yaw = boat.yaw;
  me.moving = Math.abs(boatSpeed) > 1;
  me.still = 0;
  me.sneak = false;
}

// ===== 4. Getting hurt =====
function hurt(amount, from, text) {
  // You can't be hurt again for one second, so a whole pack can't bite you all at once
  if (state.time < state.safeUntil || state.time - lastHurt < 1) return;
  state.health -= amount;
  lastHurt = state.time;
  hurtAt = wall;
  shake = Math.max(shake, 0.5);
  soundHurt();
  if (text) say(text, 3);
  if (from && me.mode === "foot") {
    // Knocked back, away from whatever hit you
    const far = Math.max(0.1, gap(me, from));
    const x = me.x + (me.x - from.x) / far * 2.5;
    const z = me.z + (me.z - from.z) / far * 2.5;
    if (canWalk(x, z)) {
      me.x = x;
      me.z = z;
    }
  }
  if (state.health <= 0) faint(from);
}

// You never really get hurt badly: you wake up at the foot of the nearest watchtower
function faint(from) {
  let tower = TOWERS[0];
  for (const one of TOWERS) {
    if (gap(me, one) < gap(me, tower)) tower = one;
  }
  state.health = 70;
  state.faints++;
  state.blind = 0;
  state.safeUntil = state.time + 8;
  me.mode = "foot";
  me.x = tower.x;
  me.z = tower.z + 3;
  for (const d of dinos) {
    if (d.mood === "chase") d.mood = "roam";
    if (d.kind === "boss" && state.bossAt) {
      // The Emperor goes back to its broken gate, and comes looking again
      d.x = PEN.x0 + 4;
      d.z = (PEN.z0 + PEN.z1) / 2;
    }
  }
  showCard((from ? "The " + SPECIES[from.kind].name.replace("the ", "") + " was too much for you." : "That was too much for you.") + " Everything goes dark...\n\nYou wake up at the foot of a watchtower. Somebody up there must like you. Climb it if you need a rest: nothing can reach you at the top.", save);
}

// The Mosasaurus has smashed the boat. Your ship sends another one.
function sinkBoat() {
  let pier = PIERS[0];
  for (const one of PIERS) {
    if (gap(state.boat, { x: one.x, z: one.z1 }) < gap(state.boat, { x: pier.x, z: pier.z1 })) pier = one;
  }
  state.boat = { x: pier.x + 3.2, z: pier.z1 - 4, yaw: Math.PI, hull: 100 };
  boatSpeed = 0;
  state.safeUntil = state.time + 6;
  me.mode = "foot";
  me.x = pier.x;
  me.z = pier.z1 - 5;
  me.yaw = 0;
  showCard("CRUNCH! The Mosasaurus bites the boat in half!\n\nYou swim for your life, and haul yourself up on to a pier. Your ship has seen it all, and sends a new boat over. It is tied up beside you.", save);
}

// ===== 5. What E does =====
// The nearest spot to the boat where you could step out: a pier, or the shore
function landingSpot() {
  const boat = state.boat;
  let best = null;
  let bestFar = 8.5;
  for (const pier of PIERS) {
    const spot = { x: pier.x, z: clamp(boat.z, pier.z0, pier.z1 - 0.8) };
    if (gap(spot, boat) < bestFar) {
      best = spot;
      bestFar = gap(spot, boat);
    }
  }
  for (let turn = 0; turn < 6.28; turn += 0.4) {
    for (let far = 3; far < 8.5; far += 1.2) {
      const spot = { x: boat.x + Math.cos(turn) * far, z: boat.z + Math.sin(turn) * far };
      if (far < bestFar && groundAt(spot.x, spot.z) > 0.3 && canWalk(spot.x, spot.z)) {
        best = spot;
        bestFar = far;
      }
    }
  }
  return best;
}

function findNear() {
  let best = null;
  let bestFar = 99;
  function offer(far, reach, text, act) {
    if (far < reach && far < bestFar) {
      best = { text: text, act: act };
      bestFar = far;
    }
  }
  if (me.mode === "boat") {
    if (gap(state.boat, SHIP) < 30) {
      offer(0, 1, driveCount() === 3 ? "Climb aboard your ship" : "Your ship (come back when you have all three data drives)", function () {
        if (driveCount() === 3) win();
      });
      return best;
    }
    const spot = landingSpot();
    if (spot && Math.abs(boatSpeed) < 6) {
      offer(0, 1, "Step ashore", function () {
        me.mode = "foot";
        me.x = spot.x;
        me.z = spot.z;
        me.pitch = 0;
        boatSpeed = 0;
        if (gap(me, ROCK) > 100) state.landed = true;
        soundPick();
        save();
      });
    }
    return best;
  }
  if (me.mode === "tower") {
    offer(0, 1, "Climb down", function () {
      const tower = TOWERS[me.tower];
      me.mode = "foot";
      me.x = tower.x;
      me.z = tower.z + 2.6;
    });
    return best;
  }
  offer(gap(me, state.boat), 9.5, "Get in the boat", function () {
    me.mode = "boat";
    me.pitch = 0;
    soundPick();
  });
  TOWERS.forEach(function (tower, n) {
    offer(gap(me, { x: tower.x, z: tower.z + 2 }), 2.8, "Climb the watchtower", function () {
      me.mode = "tower";
      me.tower = n;
      me.x = tower.x;
      me.z = tower.z;
      save();
    });
  });
  CRATES.forEach(function (crate, n) {
    if (state.crates[n]) return;
    offer(gap(me, crate), 2.4, "Open the crate", function () {
      state.crates[n] = true;
      if (crate.has === "flare") state.flares += 2;
      else state.medkits += 1;
      soundPick();
      say(crate.has === "flare" ? "Two flares! Press G to throw one. Meat-eaters can't help going to look at it." : "A medkit! Press Q to use it when you are hurt.", 5);
    });
  });
  DRIVES.forEach(function (drive, n) {
    if (state.drives[n]) return;
    offer(gap(me, drive), 3, "Take data drive " + (n + 1), function () { takeDrive(n); });
  });
  return best;
}

function takeDrive(n) {
  state.drives[n] = true;
  soundScan();
  if (n === 2 && !state.bossAt) {
    // The lab has one last secret...
    state.bossAt = state.time;
    sound(function () { playTone(0, 0.5, 600, 900, 0.3); playTone(0.5, 0.5, 600, 900, 0.3); playTone(1, 0.5, 600, 900, 0.3); });
    say("You have the drive... and an ALARM goes off. Something in the pen outside is waking up!", 6);
  } else {
    say("Data drive " + (n + 1) + " of 3: everything the old park knew, from " + drive_where(n) + ".", 5);
  }
  checkGoals();
  save();
}

function drive_where(n) {
  return DRIVES[n].where;
}

function throwFlare() {
  if (me.mode === "boat") return say("Flares are no use out at sea.", 2);
  if (!state.flares) return say("You have no flares left. Look for red crates.", 3);
  state.flares--;
  let far = 11;
  // It lands in front of you (nearer, if something solid is in the way)
  while (far > 2 && groundAt(me.x - Math.sin(me.yaw) * far, me.z - Math.cos(me.yaw) * far) < -0.5) far -= 2;
  state.flare = { x: me.x - Math.sin(me.yaw) * far, z: me.z - Math.cos(me.yaw) * far, until: state.time + 9 };
  sound(function () { playNoise(0, 0.4, 3000, 1200, 0.2); });
  say("Fssssh! The flare burns bright red.", 2);
}

function useMedkit() {
  if (!state.medkits) return say("You have no medkits. Look for white crates.", 3);
  if (state.health >= 100) return say("You are not hurt.", 2);
  state.medkits--;
  state.health = Math.min(100, state.health + 45);
  soundPick();
  say("That feels better.", 2);
}

// ===== 6. The scanner =====
// How close you have to be to scan each kind (big ones can be scanned from further away)
function scanRange(kind) {
  if (kind === "ptera" || kind === "mosa") return 50;
  return 16 + SPECIES[kind].size * 2.2;
}

// Find the creature nearest the middle of your view
function findAim() {
  const boating = me.mode === "boat";
  const pitch = boating ? 0 : me.pitch;
  const dirX = -Math.sin(me.yaw) * Math.cos(pitch);
  const dirY = Math.sin(pitch);
  const dirZ = -Math.cos(me.yaw) * Math.cos(pitch);
  let best = null;
  let bestOff = 9;
  for (const d of dinos) {
    const size = SPECIES[d.kind].size;
    const land = d.herd.act !== "fly" && d.herd.act !== "swim";
    if (d.kind === "mosa" && d.y < -2) continue;                 // too deep to see
    const dx = d.x - me.x;
    const dy = d.y + (land ? size * 0.3 : 0) - me.y;
    const dz = d.z - me.z;
    const far = Math.hypot(dx, dy, dz);
    if (far > scanRange(d.kind) || far < 0.1) continue;
    const off = Math.acos(clamp((dx * dirX + dy * dirY + dz * dirZ) / far, -1, 1));
    // (From the boat you can scan all round you. On foot you have to point the scanner at it.)
    if (off < (boating ? 4 : 0.08) + Math.atan(size * 0.45 / far) && off < bestOff) {
      best = d;
      bestOff = off;
    }
  }
  return best;
}

function scan(dt) {
  aim = findAim();
  const holding = keys.Space || mouseDown;
  if (!aim || !holding || state.scanned[aim.kind]) {
    scanning = 0;
    return;
  }
  if (scanning === 0) sound(function () { playTone(0, 0.1, 500, 700, 0.08); });
  scanning += dt / 1.5;
  if (scanning < 1) return;
  scanning = 0;
  state.scanned[aim.kind] = true;
  soundScan();
  const sp = SPECIES[aim.kind];
  checkGoals();
  say(sp.name.replace("the ", "The ") + " scanned! " + sp.fact + (HYBRIDS.includes(aim.kind) ? " (hybrid " + hybridCount() + " of 4)" : " (" + scanCount() + " of 12)"), 9);
  save();
}

// ===== 7. Jobs =====
function goalDone(n) {
  if (n === 0) return state.landed;
  if (n === 1) return Object.keys(state.scanned).length > 0;
  if (n === 2) return state.drives[0];
  if (n === 3) return state.drives[1];
  if (n === 4) return state.reachedRock;
  if (n === 5) return state.drives[2];
  if (n === 6) return state.drives[2] && me.mode === "boat";
  return state.won;
}

function checkGoals() {
  let done = false;
  while (state.goal < GOALS.length && goalDone(state.goal)) {
    state.goal++;
    done = true;
  }
  if (done && state.goal < GOALS.length && mode === "play") {
    sound(function () { playTone(0, 0.1, 700, 900, 0.15); playTone(0.1, 0.2, 900, 1300, 0.15); });
    if (state.goal !== 6) say("Next: " + GOALS[state.goal], 8);
  }
  el("goal").textContent = state.goal < GOALS.length ? "Job " + (state.goal + 1) + " of " + GOALS.length + ": " + GOALS[state.goal] : "Expedition complete! You can go back and scan any creatures you missed";
}

function win() {
  state.won = true;
  sound(playJingle);
  const count = scanCount();
  const rank = count >= 12 ? "MASTER RANGER" : count >= 8 ? "SENIOR RANGER" : "RANGER";
  el("won-text").textContent = "You are back on your ship with all three data drives, and Fossil Bay drops away behind you. You scanned " + count + " of the 12 kinds of creature and " + hybridCount() + " of the 4 secret hybrids, and you fainted " + state.faints + " time" + (state.faints === 1 ? "" : "s") + ". Your rank: " + rank + "." + (count < 12 || hybridCount() < 4 ? " Press Keep exploring to go back for the ones you missed." : "");
  el("won").hidden = false;
  mode = "won";
  checkGoals();
  save();
  if (document.exitPointerLock) document.exitPointerLock();
}

// ===== 8. One step of the game =====
function tick(dt) {
  state.time += dt;
  if (me.mode === "boat") sail(dt);
  else walk(dt);
  updateDinos(dt);
  scan(dt);

  // Arriving on Lab Rock
  if (!state.reachedRock && me.mode === "foot" && gap(me, ROCK) < 55) {
    state.reachedRock = true;
    say("Lab Rock. The old lab is just ahead... and there is something asleep in the pen beside it.", 6);
  }
  // Slowly getting better when nothing is after you
  if (!dinos.some(function (d) { return d.mood === "chase"; })) state.health = Math.min(100, state.health + dt * 0.4);

  // The ground shakes when something huge walks near
  for (const d of dinos) {
    if ((d.kind !== "rex" && d.kind !== "boss") || !d.moving || gap(d, me) > 90) continue;
    if (wall > (tick.thudAt || 0)) {
      tick.thudAt = wall + (d.mood === "chase" ? 0.45 : 0.9);
      soundThud();
      shake = Math.max(shake, 0.5 * (1 - gap(d, me) / 90));
    }
  }
  // The lab's alarm
  if (state.bossAt && wall > (tick.alarmAt || 0) && gap(me, LAB) < 150) {
    tick.alarmAt = wall + 1.6;
    sound(function () { playTone(0, 0.5, 600, 900, 0.12); });
  }

  near = findNear();
  if (state.time - lastCheck > 0.5) {
    lastCheck = state.time;
    checkGoals();
  }
  if (state.time - lastSave > 30) save();
}

// ===== 9. Your field guide =====
// A tiny second 3D picture-maker takes a snapshot of each kind of creature the first time it is needed.
const pics = {};
let snap = null;

function pic(kind) {
  if (!pics[kind]) {
    pics[kind] = true;
    try {
      if (!snap) {
        snap = { renderer: new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }), scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(28, 4 / 3, 0.1, 500) };
        snap.renderer.setSize(160, 120, false);
        snap.scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8a6a, 0.85));
        const sun = new THREE.DirectionalLight(0xfff0d0, 0.6);
        sun.position.set(3, 6, -4);
        snap.scene.add(sun);
      }
      const model = makeCreature(kind).group;
      snap.scene.add(model);
      // Measure the model, then stand the camera far enough back to fit all of it in
      const box3 = new THREE.Box3().setFromObject(model);
      const middle = box3.getCenter(new THREE.Vector3());
      const size = box3.getSize(new THREE.Vector3());
      const far = Math.max(size.z * 1.6 + size.x, size.y * 2.5);
      snap.camera.position.set(middle.x + far * 0.72, middle.y + far * 0.22, middle.z - far * 0.66);
      snap.camera.lookAt(middle);
      snap.renderer.render(snap.scene, snap.camera);
      el("pics").appendChild(document.createTextNode(".pic-" + kind + "{background-image:url(" + snap.renderer.domElement.toDataURL("image/png") + ")}"));
      snap.scene.remove(model);
    } catch (problem) { /* no picture is fine */ }
  }
  return '<i class="pic pic-' + kind + '"></i>';
}

function showGuide(on) {
  mode = on ? "guide" : "play";
  el("guide").hidden = !on;
  if (!on) return;
  if (document.exitPointerLock) document.exitPointerLock();
  let html = "";
  for (const kind of SURVEY.concat(HYBRIDS)) {
    const sp = SPECIES[kind];
    if (kind === HYBRIDS[0]) html += "<h3>Secret hybrids from Genetics Lab 9</h3>";
    if (state.scanned[kind]) html += '<div class="page' + (HYBRIDS.includes(kind) ? " hybrid" : "") + '">' + pic(kind) + "<span><b>" + sp.name.replace("the ", "The ") + "</b><br>" + sp.fact + "</span></div>";
    else html += '<div class="page unknown"><i class="pic">?</i><span><b>???</b><br>Not scanned yet.</span></div>';
  }
  el("guide-list").innerHTML = html;
  el("guide-count").textContent = scanCount() + " of 12 creatures and " + hybridCount() + " of 4 hybrids scanned";
}

// ===== 10. Drawing =====
// The scanner you hold in your hand
const hand = new THREE.Group();
box(hand, paint(0x2a2a30), 0.16, 0.1, 0.26, 0, 0, 0);
box(hand, paint(0xffd23a), 0.17, 0.03, 0.27, 0, -0.04, 0);
const screen3d = box(hand, bright(0x4ac8ff), 0.12, 0.08, 0.01, 0, 0.02, 0.135);
piece(hand, new THREE.CylinderGeometry(0.03, 0.045, 0.1, 8), paint(0x8a8a90), 0, 0, -0.17).rotation.x = Math.PI / 2;
camera.add(hand);
scene.add(camera);

// A burning flare: a red glow on the ground
const flareGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot, color: 0xff3a2a, transparent: true, depthWrite: false, fog: false }));
const flareLight = new THREE.PointLight(0xff3a2a, 0, 40);
scene.add(flareGlow, flareLight);

const strings = {};
function setText(id, text) {
  if (strings[id] === text) return;
  strings[id] = text;
  el(id).innerHTML = text;
}

// The map never changes, so the land is painted once, on a hidden canvas. One dot is 5 metres.
const MAP = { x0: -330, z0: -300, wide: 160, high: 144 };
const mapBase = document.createElement("canvas");
mapBase.width = MAP.wide;
mapBase.height = MAP.high;
(function () {
  const pen = mapBase.getContext("2d");
  for (let i = 0; i < MAP.wide; i++) {
    for (let k = 0; k < MAP.high; k++) {
      const x = MAP.x0 + i * 5;
      const z = MAP.z0 + k * 5;
      const y = groundAt(x, z);
      pen.fillStyle = y < 0 ? "#2f8ab8" : y < 1.2 ? "#e8d8a0" : nearLine(x, z, ROAD) < 4 || nearLine(x, z, TRAIL) < 4 ? "#c8a870" : bump(x, z, CLIFFS, CLIFFS.r) > 0.55 ? "#8a8478" : forestAt(x, z) > 0.2 ? "#2f7a38" : "#6ab84a";
      pen.fillRect(i, k, 1, 1);
    }
  }
})();

function drawMap() {
  const pen = el("map").getContext("2d");
  pen.drawImage(mapBase, 0, 0);
  const dot = function (thing, colour, size) {
    pen.fillStyle = colour;
    pen.fillRect((thing.x - MAP.x0) / 5 - size / 2, (thing.z - MAP.z0) / 5 - size / 2, size, size);
  };
  for (const tower of TOWERS) dot(tower, "#5a3a1a", 3);
  dot(SHIP, "#000", 8);
  dot(SHIP, "#ffffff", 6);
  DRIVES.forEach(function (drive, n) {
    if (state.drives[n]) return;
    dot(drive, "#000", 7);
    dot(drive, Math.sin(wall * 5) > 0 ? "#4ac8ff" : "#ffffff", 5);
  });
  dot(state.boat, "#000", 5);
  dot(state.boat, "#ffd23a", 3);
  if (state.bossAt) dot(dinos.find(function (d) { return d.kind === "boss"; }), "#ff2a1a", 6);
  // You: a white dot, with a line showing which way you are facing
  dot(me, "#000", 5);
  dot(me, "#fff", 3);
  pen.strokeStyle = "#fff";
  pen.beginPath();
  pen.moveTo((me.x - MAP.x0) / 5, (me.z - MAP.z0) / 5);
  pen.lineTo((me.x - MAP.x0) / 5 - Math.sin(me.yaw) * 7, (me.z - MAP.z0) / 5 - Math.cos(me.yaw) * 7);
  pen.stroke();
}

function drawHud() {
  el("health-fill").style.width = Math.max(0, state.health) + "%";
  el("run-fill").style.width = (me.mode === "boat" ? state.boat.hull : me.stamina * 100) + "%";
  setText("run-label", me.mode === "boat" ? "Boat" : "Run");
  setText("place", placeAt(me.x, me.z) + (me.mode === "tower" ? " (up a watchtower)" : ""));
  setText("tally", "<span>Scanned " + scanCount() + "/12</span><span>Hybrids " + hybridCount() + "/4</span><span>Drives " + driveCount() + "/3</span><span>Flares " + state.flares + "</span><span>Medkits " + state.medkits + "</span>");
  setText("keys-line", me.mode === "boat" ? "W, S: speed &nbsp; A, D: steer &nbsp; Space: scan &nbsp; B: field guide" : "Space: scan &nbsp; G: flare &nbsp; Q: medkit &nbsp; C: duck &nbsp; B: field guide");
  // What the scanner is pointing at
  let label = "";
  if (aim && mode === "play") {
    const name = SPECIES[aim.kind].name.replace("the ", "The ");
    label = state.scanned[aim.kind] ? name + " (scanned)" : scanning > 0 ? name + ": scanning..." : name + ": hold Space to scan";
  }
  setText("scan-label", label);
  el("scan").hidden = !label;
  el("scan-fill").style.width = scanning * 100 + "%";
  el("scan-bar").hidden = !aim || !!state.scanned[aim.kind];
  let hint = "";
  if (mode === "play") {
    if (near) hint = "E: " + near.text;
    else if (state.health < 35 && state.medkits) hint = "You are hurt! Press Q to use a medkit";
    else if (!locked && me.mode !== "boat") hint = "Click the game to look around with the mouse (or use the arrow keys)";
  }
  setText("hint", hint);
  el("hint").hidden = !hint;
  if (!el("toast").hidden && wall > toastUntil) el("toast").hidden = true;
  el("tint").style.boxShadow = wall - hurtAt < 0.5 ? "inset 0 0 90px 30px rgba(220, 30, 20, 0.7)" : state.health < 30 ? "inset 0 0 70px 10px rgba(220, 30, 20, 0.4)" : "none";
  el("splat").style.opacity = clamp((state.blind - state.time) / 1.5, 0, 1);
  if (wall - (drawHud.mapAt || 0) > 0.3) {
    drawHud.mapAt = wall;
    drawMap();
  }
}

const SKIES = { day: new THREE.Color(0x9fd8f4), storm: new THREE.Color(0x6a5a78) };
const nowSky = new THREE.Color();
let gloom = 0;

function draw(dt) {
  wall += dt;
  shake = Math.max(0, shake - dt);
  const boat = state.boat;

  // ----- The camera -----
  if (mode === "intro") {
    // A slow look round your ship before you start
    camera.position.set(SHIP.x + Math.sin(wall * 0.08) * 60, 16, SHIP.z + Math.cos(wall * 0.08) * 60);
    camera.lookAt(SHIP.x, 4, SHIP.z - 20);
  } else if (me.mode === "boat") {
    // Behind and above the boat
    camera.position.set(boat.x + Math.sin(boat.yaw) * 10 + (Math.random() - 0.5) * shake, 4.6 + (Math.random() - 0.5) * shake, boat.z + Math.cos(boat.yaw) * 10);
    camera.lookAt(boat.x - Math.sin(boat.yaw) * 7, 1.2, boat.z - Math.cos(boat.yaw) * 7);
  } else {
    camera.position.set(me.x + (Math.random() - 0.5) * shake * 0.3, me.y + (Math.random() - 0.5) * shake * 0.3 + (me.moving && me.mode === "foot" ? Math.abs(Math.sin(wall * (me.running ? 12 : 8))) * 0.05 : 0), me.z);
    camera.rotation.set(me.pitch, me.yaw, 0);
  }

  // ----- The sky. When the Emperor wakes, a storm rolls in. -----
  gloom += ((state.bossAt ? 1 : 0) - gloom) * Math.min(1, dt * 0.4);
  nowSky.copy(SKIES.day).lerp(SKIES.storm, gloom);
  scene.fog.color.copy(nowSky);
  renderer.setClearColor(nowSky);
  scene.fog.far = 520 - gloom * 260;
  skyLight.intensity = 0.62 - gloom * 0.25;
  sunLight.intensity = 0.75 - gloom * 0.45;
  const focus = camera.position;
  sunLight.target.position.set(focus.x, 0, focus.z);
  sunLight.position.set(focus.x + 60, 120, focus.z + 50);
  sunBall.position.set(focus.x + 500, 700, focus.z + 400);
  sunBall.material.opacity = 1 - gloom;
  sea.position.set(focus.x, 0, focus.z);
  ruins.alarm.intensity = state.bossAt ? 1 + Math.sin(wall * 8) : 0;
  // The pen's gate falls flat when the Emperor breaks out
  ruins.penGate.rotation.z += ((state.gateDown ? Math.PI / 2 - 0.05 : 0) - ruins.penGate.rotation.z) * Math.min(1, dt * 4);

  // ----- Your boat, your scanner, flares, crates and drives -----
  boatModel.position.set(boat.x, Math.sin(wall * 1.7) * 0.08, boat.z);
  boatModel.rotation.set(Math.sin(wall * 1.3) * 0.03 - clamp(boatSpeed, -6, 14) * 0.006, boat.yaw, Math.sin(wall * 1.1) * 0.04);
  hand.visible = mode !== "intro" && me.mode !== "boat";
  hand.position.set(0.3, -0.25 - (me.moving ? Math.sin(wall * 8) * 0.01 : 0), -0.75);
  hand.rotation.set(0.1, 0.25, 0);
  screen3d.material.color.setHex(scanning > 0 && Math.sin(wall * 30) > 0 ? 0xffffff : aim && !state.scanned[aim.kind] ? 0x7dff8a : 0x4ac8ff);
  const flare = state.flare && state.time < state.flare.until ? state.flare : null;
  flareGlow.visible = !!flare;
  flareLight.intensity = flare ? 1.2 + Math.sin(wall * 20) * 0.3 : 0;
  if (flare) {
    const y = groundAt(flare.x, flare.z) + 0.5;
    flareGlow.position.set(flare.x, y, flare.z);
    flareGlow.scale.setScalar(3 + Math.sin(wall * 25) * 0.6);
    flareLight.position.set(flare.x, y + 1, flare.z);
  }
  crateModels.forEach(function (model, n) { model.visible = !state.crates[n]; });
  driveModels.forEach(function (model, n) {
    model.visible = !state.drives[n];
    model.rotation.y = wall;
  });

  poseDinos(wall);
  drawHud();
}

// ===== 11. Saving =====
function save() {
  lastSave = state.time;
  state.at = { x: me.x, z: me.z, yaw: me.yaw, mode: me.mode, tower: me.tower };
  try {
    localStorage.setItem(SAVE, JSON.stringify(state));
  } catch (problem) { /* the browser won't let us save: keep playing anyway */ }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(SAVE));
  } catch (problem) {
    return null;
  }
}

function begin(saved) {
  state = freshState();
  if (saved) {
    for (const key in saved) state[key] = saved[key];
  }
  for (const d of dinos) {
    if (d.model) scene.remove(d.model.group, d.sign);
  }
  dinos.length = 0;
  spits.length = 0;
  makeDinos();
  // The pen's gate is solid again unless the Emperor has already broken it
  if (!blocks.includes(ruins.gateBlock)) blocks.push(ruins.gateBlock);
  if (state.gateDown) blocks.splice(blocks.indexOf(ruins.gateBlock), 1);
  me.mode = "boat";
  me.pitch = 0;
  if (state.at) {
    me.x = state.at.x;
    me.z = state.at.z;
    me.yaw = state.at.yaw;
    me.mode = state.at.mode;
    me.tower = state.at.tower;
  }
  me.stamina = 1;
  boatSpeed = 0;
  scanning = 0;
  lastHurt = -9;
  lastSave = lastCheck = state.time;
  for (const id of ["intro", "won", "card", "guide"]) el(id).hidden = true;
  el("hud").hidden = false;
  mode = "play";
  checkGoals();
  if (!saved) say(GOALS[0], 9);
}

// ===== 12. Keys, mouse and buttons =====
window.addEventListener("keydown", function (e) {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (mode === "card") {
    if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") closeCard();
    return;
  }
  if (mode === "guide") {
    if (e.code === "KeyB" || e.code === "Escape") showGuide(false);
    return;
  }
  if (mode !== "play") return;
  if (e.code === "KeyE" && near) near.act();
  else if (e.code === "KeyG") throwFlare();
  else if (e.code === "KeyQ") useMedkit();
  else if (e.code === "KeyB") showGuide(true);
});

window.addEventListener("keyup", function (e) {
  keys[e.code] = false;
});

window.addEventListener("blur", function () {
  for (const code in keys) keys[code] = false;
  mouseDown = false;
});

canvas.addEventListener("mousedown", function () {
  if (mode !== "play") return;
  if (!locked && me.mode !== "boat" && canvas.requestPointerLock) canvas.requestPointerLock();
  mouseDown = true;
});

window.addEventListener("mouseup", function () {
  mouseDown = false;
});

document.addEventListener("pointerlockchange", function () {
  locked = document.pointerLockElement === canvas;
});

document.addEventListener("mousemove", function (e) {
  if (!locked || mode !== "play" || me.mode === "boat") return;
  me.yaw -= e.movementX * 0.0025;
  me.pitch = clamp(me.pitch - e.movementY * 0.0025, -1.3, 1.3);
});

el("card").addEventListener("click", function () {
  if (mode === "card") closeCard();
});
el("guide-close").addEventListener("click", function () {
  showGuide(false);
});
el("start").addEventListener("click", function () {
  begin(null);
});
el("continue").addEventListener("click", function () {
  begin(load());
});
el("won-close").addEventListener("click", function () {
  el("won").hidden = true;
  mode = "play";
});

// ===== 13. Go! =====
makeDinos();
el("continue").hidden = !load();

let lastTime = 0;
let frameCount = 0;
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ms - lastTime) / 1000 || 0.016);
  lastTime = ms;
  frameCount++;
  fit();
  if (mode === "play") tick(dt);
  draw(dt);
  renderer.render(scene, camera);
}

// For testing the game with a script: add ?test to the address
if (testing) {
  begin(null);
  window.WA = {
    me: me, keys: keys, dinos: dinos, trees: trees, spits: spits, blocks: blocks,
    state: function () { return state; },
    mode: function () { return mode; },
    near: function () { return near; },
    aim: function () { return aim; },
    scanning: function () { return scanning; },
    boatSpeed: function () { return boatSpeed; },
    frames: function () { return frameCount; },
    begin: begin, save: save, load: load, hurt: hurt, takeDrive: takeDrive, throwFlare: throwFlare, useMedkit: useMedkit,
    showGuide: showGuide, closeCard: closeCard, findNear: findNear, findAim: findAim, checkGoals: checkGoals, canWalk: canWalk, landingSpot: landingSpot, pic: pic,
    step: function (n) { for (let i = 0; i < n; i++) { if (mode === "play") tick(0.05); } },
  };
}

requestAnimationFrame(frame);
