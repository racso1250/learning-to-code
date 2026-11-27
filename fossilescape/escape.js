// Fossil Bay: Lights Out. The game.
// You slept through the night the fences failed. Now it is morning, the park is empty of
// people and full of loose dinosaurs, and you have to find the rangers' car and get away.

// ===== 1. What the game remembers =====
const SAVE = "lightsout-save";

// You: where you are, which way you look, and what you are doing
const me = { x: 0, z: 0, yaw: 0, pitch: 0, stamina: 1, sneak: false, running: false, moving: false, hidden: null, driving: false };
// What you are carrying
let inv = { map: false, darts: 0, flares: 0, keys: false, radio: false, snacks: false, fuel: false };
const car = { x: mid(PLACES.car.i), z: mid(PLACES.car.k), yaw: 2.4, speed: 0, fuelled: false };

let goal = 0;            // which part of the story you are on (see GOAL_TEXT below)
let mode = "intro";      // intro, play, card or won
let clock = 0;           // seconds played
let wall = 0;            // a clock that never stops (for animations)
let locked = false;      // is the mouse turning your head?
let shake = 0;
let flash = 0;
let night = false;       // the flashing red sirens behind the first story card
let rescueAt = 0;        // when the helicopter lands
let flare = null;        // a burning flare on the ground: { x, z, until, mesh }
let dartReady = 0;
let bumpedAt = -9;
const keys = {};
const heli = makeHelicopter();
heli.visible = false;
scene.add(heli);

const GOAL_TEXT = [
  "Find out what has happened. Follow the path north to the Visitor Centre (the big round roof)",
  "Find the rangers' car. They left it by the raptor paddock in the Red Desert, over the north bridge",
  "The car has no fuel. Fetch a can from the fuel store in the Misty Swamp, over the east bridge",
  "Carry the fuel back to the rangers' car. It is heavy: you can't run",
  "Drive to the helipad on the Frost Plateau and switch on the landing lights (the yellow box)",
  "Stay alive until the helicopter gets here!",
  "The helicopter has landed. Get to it!",
  "You escaped from Fossil Bay",
];
// Where each goal is (for the marker on your map), and where you start again if you are caught
function goalSpot() {
  const place = [PLACES.centre, PLACES.car, PLACES.depot, PLACES.car, PLACES.pad, PLACES.pad, PLACES.pad, PLACES.pad][goal];
  return goal === 3 ? { x: car.x, z: car.z } : { x: mid(place.i), z: mid(place.k) };
}
const STARTS = [
  { x: mid(10), z: mid(73) + 3.2 }, { x: mid(21) - 3.4, z: mid(65) }, { x: mid(PLACES.car.i) - 3, z: mid(PLACES.car.k) + 3 },
  { x: mid(67) - 1, z: mid(61) - 4.5 }, { x: mid(PLACES.car.i) - 3, z: mid(PLACES.car.k) + 3 },
  { x: mid(61), z: mid(12) + 3 }, { x: mid(61), z: mid(12) + 3 }, { x: mid(61), z: mid(12) + 3 },
];

// ===== 2. Sounds and messages =====
function sound(make) {
  try { make(); } catch (problem) { /* no sound is fine */ }
}
function soundGot() { sound(function () { playTone(0, 0.09, 600, 900, 0.15); playTone(0.09, 0.14, 900, 1300, 0.15); }); }
function soundGrowl() { sound(function () { playNoise(0, 0.7, 300, 90, 0.35); playTone(0, 0.6, 140, 70, 0.3); }); }
function soundRoar() { sound(function () { playNoise(0, 1.4, 400, 60, 0.5); playTone(0, 1.2, 150, 45, 0.4); }); }
function soundDart() { sound(function () { playNoise(0, 0.15, 3000, 1500, 0.2); }); }
function soundSiren() { sound(function () { playTone(0, 0.6, 500, 900, 0.12); playTone(0.6, 0.6, 900, 500, 0.12); }); }
function soundDoor() { sound(function () { playTone(0, 0.12, 300, 200, 0.2); }); }

const el = function (id) { return document.getElementById(id); };
let toastUntil = 0;
function say(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastUntil = wall + (seconds || 3);
}

// Story cards: the game waits until you press Space. Several can queue up.
const cards = [];
function showCard(text, after) {
  cards.push({ text: text, after: after });
  if (mode !== "card") nextCard();
}
function nextCard() {
  const card = cards[0];
  mode = "card";
  el("card-text").textContent = card.text;
  el("card").hidden = false;
  if (document.exitPointerLock) document.exitPointerLock();
}
function closeCard() {
  const card = cards.shift();
  night = false;
  if (card.after) card.after();
  if (cards.length) return nextCard();
  el("card").hidden = true;
  if (mode === "card") mode = "play";
}

// ===== 3. The dinosaurs =====
// The hunters. sense = how sharp its eyes and ears are. chase = how fast it runs after you.
const HUNTERS = {
  dilo: { sense: 0.8, chase: 6.2 }, raptor: { sense: 1.1, chase: 8.3 }, rex: { sense: 1.3, chase: 9.5, moveOnly: true },
  carno: { sense: 1, chase: 9 }, bary: { sense: 0.9, chase: 7 }, spino: { sense: 1, chase: 7 },
  yuty: { sense: 1.1, chase: 8.6 }, troo: { sense: 1, chase: 7.4 },
};
// Where everybody is. Hunters walk round and round a "loop" of squares. The others graze near "home".
const ZOO = [
  { kind: "dilo", loop: [[24, 72], [32, 72], [32, 66], [26, 67]] },
  { kind: "rex", loop: [[23, 58], [34, 57], [37, 48], [30, 41.5], [21, 42], [16.5, 50]] },
  { kind: "raptor", loop: [[22, 19], [36, 19], [36, 32], [22, 32.5]] },
  { kind: "raptor", loop: [[36, 19], [36, 32], [22, 32.5], [22, 19]] },
  { kind: "raptor", loop: [[36, 32], [22, 32.5], [22, 19], [36, 19]] },
  { kind: "carno", loop: [[6, 6], [14, 6], [14, 14], [6, 14]] },
  { kind: "bary", loop: [[60, 63], [70, 58], [73, 66], [63, 69]] },
  { kind: "spino", loop: [[44, 57], [56, 57], [56, 44], [44, 44]] },
  { kind: "yuty", loop: [[56, 7], [72, 7], [73, 18], [60, 21]] },
  { kind: "troo", loop: [[46, 10], [55, 10], [55, 22], [46, 22]] },
  { kind: "troo", loop: [[55, 22], [46, 22], [46, 10], [55, 10]] },
  { kind: "tri", home: [11, 60] }, { kind: "tri", home: [13, 62] }, { kind: "tri", home: [9, 63] },
  { kind: "para", home: [8, 68] }, { kind: "para", home: [10, 67] }, { kind: "steg", home: [30, 68] },
  { kind: "brach", home: [31, 63] }, { kind: "anky", home: [9, 34] }, { kind: "styra", home: [8, 10] }, { kind: "styra", home: [10, 12] },
  { kind: "proto", home: [30, 9] }, { kind: "proto", home: [32, 10] }, { kind: "proto", home: [31, 12] },
  { kind: "igua", home: [72, 72] }, { kind: "igua", home: [70, 74] }, { kind: "diplo", home: [50, 49] },
  { kind: "pachyr", home: [50, 30] }, { kind: "pachyr", home: [52, 32] }, { kind: "pachyr", home: [72, 36] },
  { kind: "mosa", swim: true }, { kind: "plesio", swim: true },
  { kind: "ptera", fly: 0 }, { kind: "ptera", fly: 2.1 }, { kind: "ptera", fly: 4.2 },
];
const dinos = [];

function resetDinos() {
  for (const d of dinos) {
    d.mood = "walk";
    d.until = d.pause = 0;
    d.goal = null;
    d.at = 0;
    const spot = d.loop ? d.loop[0] : d.home || [50, 69];
    d.x = mid(spot[0]);
    d.z = mid(spot[1]);
  }
}

function makeDinos() {
  for (const spec of ZOO) {
    const model = makeDino(spec.kind);
    model.group.rotation.order = "YXZ";
    scene.add(model.group);
    const sign = new THREE.Sprite(SIGNS.angry);
    sign.visible = false;
    scene.add(sign);
    dinos.push({ kind: spec.kind, loop: spec.loop, home: spec.home, swim: spec.swim, fly: spec.fly, model: model, sign: sign, x: 0, z: 0, yaw: Math.random() * 6, mood: "walk", at: 0, moving: 0, stride: 0, hunter: HUNTERS[spec.kind] && !!spec.loop });
  }
  resetDinos();
}

// Turn towards a spot and walk at it. Gives back how far away it still is.
function dinoTo(d, x, z, speed, dt) {
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
  d.moving = speed;
  d.stride += step;
  return far - step;
}

// How far away can a hunter notice you right now? Running is loud. Creeping is quiet.
function loudness() {
  if (me.hidden) return 0;
  if (me.driving) return 46;
  if (!me.moving) return 5;
  return me.sneak ? 7 : me.running ? 32 : 17;
}

function notices(d) {
  const info = HUNTERS[d.kind];
  let reach = loudness() * info.sense;
  // A T. rex can only see things that move
  if (info.moveOnly && !me.moving && !me.driving) reach = Math.min(reach, 4);
  const at = me.driving ? car : me;
  const dx = at.x - d.x;
  const dz = at.z - d.z;
  let turn = Math.atan2(-dx, -dz) - d.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  if (Math.abs(turn) < 1) reach *= 1.5;   // it sees further in front of its nose
  return Math.hypot(dx, dz) < reach;
}

function updateDinos(dt) {
  const at = me.driving ? car : me;
  for (const d of dinos) {
    d.moving = 0;
    const far = Math.hypot(at.x - d.x, at.z - d.z);
    if (d.swim) {
      // Round and round the lagoon
      const a = clock * 0.12 + (d.kind === "mosa" ? 0 : 3);
      const x = mid(50) + Math.cos(a) * 16;
      const z = mid(69) + Math.sin(a) * 16;
      dinoTo(d, x, z, 4, dt);
      continue;
    }
    if (d.fly !== undefined) {
      const a = clock * 0.25 + d.fly;
      dinoTo(d, mid(62) + Math.cos(a) * 34, mid(54) + Math.sin(a * 1.3) * 26, 9, dt);
      continue;
    }
    if (d.mood === "asleep") {
      if (clock > d.until) d.mood = "walk";
      continue;
    }
    if (!d.hunter) {
      // Plant-eaters just wander. Get too close and they shove you out of the way.
      if (d.pause > 0) d.pause -= dt;
      else {
        if (!d.goal) d.goal = { x: mid(d.home[0]) + (Math.random() - 0.5) * 36, z: mid(d.home[1]) + (Math.random() - 0.5) * 36 };
        if (dinoTo(d, d.goal.x, d.goal.z, 1.6, dt) < 1 || !free(d.goal.x, d.goal.z)) {
          d.goal = null;
          d.pause = 2 + Math.random() * 6;
        }
      }
      const gap = 1.5 + SHAPES[d.kind].long * 0.22;
      if (!me.driving && !me.hidden && far < gap && far > 0.01) {
        tryMove(me, me.x + (me.x - d.x) / far * (gap - far), me.z + (me.z - d.z) / far * (gap - far), 0.4);
        if (clock - bumpedAt > 6) {
          bumpedAt = clock;
          say("Careful! The " + SPECIES[d.kind].name + " is gentle, but very big.", 3);
        }
      }
      continue;
    }
    const info = HUNTERS[d.kind];
    // A burning flare is far more interesting than you are
    if (flare && Math.hypot(flare.x - d.x, flare.z - d.z) < 70) {
      d.mood = "lured";
      dinoTo(d, flare.x, flare.z, info.chase * 0.8, dt);
      continue;
    }
    if (d.mood === "lured") {
      d.mood = "search";
      d.last = { x: d.x, z: d.z };
      d.until = clock + 4;
    }
    const sees = clock > safeUntil && notices(d);
    if (sees) {
      if (d.mood !== "hunt") {
        d.mood = "hunt";
        if (d.kind === "rex" || d.kind === "yuty" || d.kind === "spino") soundRoar();
        else soundGrowl();
      }
      d.last = { x: at.x, z: at.z };
      d.until = clock + 3.5;
    }
    if (d.mood === "hunt") {
      if (clock > d.until) {
        d.mood = "search";
        d.until = clock + 5;
      } else {
        dinoTo(d, d.last.x, d.last.z, me.driving && d.kind === "rex" ? 12.5 : info.chase, dt);
        if (sees && far < 1.3 + SHAPES[d.kind].long * 0.22 + (me.driving ? 1.4 : 0)) caught(d);
      }
    } else if (d.mood === "search") {
      // It goes to where it last noticed you, and sniffs about
      if (dinoTo(d, d.last.x, d.last.z, info.chase * 0.5, dt) < 2) d.yaw += dt * 1.5;
      if (clock > d.until) d.mood = "walk";
    } else {
      const spot = d.loop[d.at];
      if (dinoTo(d, mid(spot[0]), mid(spot[1]), 2.8, dt) < 1.5) d.at = (d.at + 1) % d.loop.length;
    }
  }
}

function poseDinos(t) {
  for (const d of dinos) {
    const m = d.model;
    const asleep = d.mood === "asleep";
    const high = d.fly !== undefined ? 15 + Math.sin(t * 0.7 + d.fly) * 2 : d.swim ? -0.9 : 0;
    m.group.position.set(d.x, high + (asleep ? SHAPES[d.kind].long * 0.08 : 0), d.z);
    m.group.rotation.set(0, d.yaw, asleep ? 1.35 : 0);
    const stride = d.moving ? Math.sin(d.stride * 0.9) * 0.5 : 0;
    m.legs.forEach(function (leg, n) {
      leg.rotation.x = stride * (n % 4 === 0 || n % 4 === 3 ? 1 : -1);
    });
    m.tail.rotation.y = Math.sin(t * 1.6 + d.x) * 0.25;
    m.head.rotation.x = m.tilt;
    if (m.jaw) m.jaw.rotation.x = d.mood === "hunt" ? -0.4 - Math.sin(t * 5) * 0.15 : -0.05;
    if (m.wings) {
      for (const wing of m.wings) wing.group.rotation.z = wing.side * Math.sin(t * 5 + d.fly) * 0.5;
    }
    const sign = d.mood === "hunt" ? "angry" : asleep ? "asleep" : d.mood === "search" || d.mood === "lured" ? "hungry" : null;
    d.sign.visible = !!sign;
    if (sign) {
      d.sign.material = SIGNS[sign];
      d.sign.position.set(d.x, SHAPES[d.kind].tall + 2, d.z);
      d.sign.scale.setScalar(3 + Math.sin(t * 6) * 0.3);
    }
  }
}

// ===== 4. Getting caught =====
let safeUntil = 0;
function caught(d) {
  if (mode !== "play") return;
  flash = 1;
  shake = 1;
  soundRoar();
  const big = SHAPES[d.kind].tall > 5;
  showCard("The " + SPECIES[d.kind].name + (me.driving ? " catches the car and tips it right over!" : big ? " snatches you up by your rucksack!" : " knocks you flat!") + "\n\nYou wriggle free and run for your life...\n\nTry again from the last safe place.", restart);
}

// Put you (and everything else) back at the start of the part of the story you are on
function restart() {
  const spot = STARTS[goal];
  me.x = spot.x;
  me.z = spot.z;
  me.hidden = null;
  me.driving = false;
  me.stamina = 1;
  car.speed = 0;
  car.x = mid(PLACES.car.i);
  car.z = mid(PLACES.car.k);
  car.yaw = 2.4;
  if (goal >= 5) {
    // The helicopter is still on its way: you get the full wait again
    goal = 5;
    rescueAt = clock + 50;
    car.x = mid(63);
    car.z = mid(16);
  }
  if (flare) {
    scene.remove(flare.mesh);
    flare = null;
  }
  resetDinos();
  safeUntil = clock + 3;
  setGoal();
}

// ===== 5. Moving =====
// Is this spot open ground? (Not a building, not the river, not off the island.)
function free(x, z, gap) {
  gap = gap || 0.4;
  if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1) {
    // The pier sticks out past the gate
    if (!(Math.abs(x - mid(GATE.i)) < 1.6 && z > 0 && z < HALF + 44)) return false;
  }
  const i = tileOf(x);
  const k = tileOf(z);
  if (inPark(i, k) && biomeAt(i, k) === "river" && !state.tiles[i + "," + k]) return false;
  for (const b of blocks) {
    if (x > b.x0 - gap && x < b.x1 + gap && z > b.z0 - gap && z < b.z1 + gap) return false;
  }
  return true;
}

// Which paddock (if any) is this spot inside?
function padOf(x, z) {
  const pad = padAt(tileOf(x), tileOf(z));
  return pad ? pad.id : 0;
}

// Move someone to a new spot if nothing is in the way. Fences are solid, except where they are smashed.
function tryMove(who, x, z, gap) {
  // First try the sideways part of the step, then the forwards part.
  // (That way you slide along a wall instead of sticking to it.)
  if (canStep(who, x, who.z, gap)) who.x = x;
  if (canStep(who, who.x, z, gap)) who.z = z;
}

function canStep(who, x, z, gap) {
  if (!free(x, z, gap)) return false;
  const from = padOf(who.x, who.z);
  const to = padOf(x, z);
  if (from === to) return true;
  const pad = padById(from || to);
  return !!pad.breach && Math.hypot(x - pad.breach.x, z - pad.breach.z) < 4.6;
}

function moveMe(dt) {
  me.yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 2 * dt;
  me.pitch = clamp(me.pitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * 1.2 * dt, -1.3, 1.3);
  me.moving = false;
  if (me.hidden) return;
  if (me.driving) return driveCar(dt);
  const ahead = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  me.sneak = !!(keys.KeyC || keys.ControlLeft);
  me.moving = !!(ahead || side);
  // Running uses up your puff. (You can't run at all while you carry the heavy fuel can.)
  me.running = me.moving && !me.sneak && (keys.ShiftLeft || keys.ShiftRight) && me.stamina > 0.02 && !inv.fuel;
  if (me.running) me.stamina = Math.max(0, me.stamina - dt / (inv.snacks ? 12 : 6));
  else me.stamina = Math.min(1, me.stamina + dt / (me.moving ? 9 : 4));
  if (!me.moving) return;
  const speed = me.sneak ? 2.2 : me.running ? 8 : 4.5;
  const long = Math.hypot(ahead, side);
  const vx = (-Math.sin(me.yaw) * ahead + Math.cos(me.yaw) * side) / long * speed;
  const vz = (-Math.cos(me.yaw) * ahead - Math.sin(me.yaw) * side) / long * speed;
  tryMove(me, me.x + vx * dt, me.z + vz * dt, 0.4);
}

function driveCar(dt) {
  const push = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
  car.speed += push * 26 * dt;
  car.speed *= Math.exp(-1.4 * dt);
  car.yaw += steer * 2 * dt * clamp(car.speed / 5, -1, 1);
  const oldX = car.x;
  const oldZ = car.z;
  tryMove(car, car.x - Math.sin(car.yaw) * car.speed * dt, car.z - Math.cos(car.yaw) * car.speed * dt, 1.3);
  // Bumped into something
  if (Math.hypot(car.x - oldX, car.z - oldZ) < Math.abs(car.speed) * dt * 0.5) car.speed *= 0.5;
  me.x = car.x;
  me.z = car.z;
  me.moving = Math.abs(car.speed) > 1;
}

// ===== 6. Using things =====
function nearTo(x, z, reach) {
  return Math.hypot(me.x - x, me.z - z) < reach;
}

// What would E do right now? { text, act }
function findNear() {
  if (me.hidden) return { text: "E: come out", act: function () { me.hidden = null; soundDoor(); } };
  if (me.driving) return { text: "E: get out of the car", act: function () { me.driving = false; tryMove(me, car.x + Math.cos(car.yaw) * 2.6, car.z - Math.sin(car.yaw) * 2.6, 0.4); } };
  const centre = hides.find(function (h) { return h.name === "the visitor centre"; });
  if (goal === 0 && nearTo(centre.x, centre.z, 4)) return { text: "E: look inside the Visitor Centre", act: findMap };
  if (nearTo(car.x, car.z, 4.2)) {
    if (goal === 1) return { text: "E: search the rangers' car", act: findCar };
    if (goal === 3) return { text: "E: pour the fuel into the car", act: fuelCar };
    if (car.fuelled) return { text: "E: get in and drive", act: function () { me.driving = true; me.sneak = false; soundDoor(); } };
    return { text: "The rangers' car. It has no fuel" };
  }
  const depot = hides.find(function (h) { return h.locked; });
  if (goal === 2 && nearTo(depot.x, depot.z, 3.4)) return { text: "E: unlock the fuel store with the rangers' keys", act: findFuel };
  if (goal === 4 && nearTo(mid(63) - 1, mid(14), 3.6)) return { text: "E: switch on the landing lights", act: callHelp };
  if (goal === 6 && nearTo(heli.position.x, heli.position.z, 7)) return { text: "E: climb aboard!", act: win };
  for (const hide of hides) {
    if (!nearTo(hide.x, hide.z, 3)) continue;
    if (hide.locked && !inv.keys) return { text: "The fuel store. It is locked" };
    return { text: "E: hide in " + hide.name, act: function () { me.hidden = hide; me.yaw = hide.out; me.pitch = 0; soundDoor(); } };
  }
  return null;
}

function findMap() {
  inv.map = true;
  goal = 1;
  soundGot();
  save();
  showCard("The Visitor Centre is empty. Chairs are knocked over. A radio on the desk is still crackling:\n\n\"...all rangers to the dock. Leave the car where it is, by the raptor paddock in the Red Desert. No time to go back for it...\"\n\nYou take a PARK MAP from the rack. The rangers' car! It will have supplies in it.");
  setGoal();
}

function findCar() {
  inv.darts = 6;
  inv.flares = 3;
  inv.keys = inv.radio = inv.snacks = true;
  goal = 2;
  soundGot();
  save();
  showCard("The rangers' car! In the back you find:\n\nA DART GUN with 6 sleepy darts (click to fire)\n3 FLARES (press G: hunters go to the flare, not to you)\nA RANGER TRACKER (meat-eaters near you show red on your map)\nTRAIL MIX (you can run twice as far)\nA ring of KEYS");
  showCard("You turn the key. Click. The fuel gauge is on empty.\n\nThe radio hisses: \"...if anybody is still on the island, a helicopter can land on the Frost Plateau helipad. Switch on the landing lights and we will see you...\"\n\nThere is a fuel store in the Misty Swamp. The keys will open it.");
  setGoal();
}

function findFuel() {
  inv.fuel = true;
  goal = 3;
  soundGot();
  save();
  showCard("The key turns. Inside the fuel store you find a full can of fuel.\n\nIt is very heavy. You can't run while you carry it, so creep (hold C) and keep out of sight.");
  setGoal();
}

function fuelCar() {
  inv.fuel = false;
  car.fuelled = true;
  goal = 4;
  soundGot();
  save();
  showCard("Glug, glug, glug. The engine coughs... and roars into life!\n\nThe car is fast, but it is LOUD. Every hunter for miles will hear it. Drive north to the top path, east over the bridge, and on to the helipad.");
  setGoal();
}

function callHelp() {
  goal = 5;
  rescueAt = clock + 50;
  soundSiren();
  save();
  showCard("You pull the switch. Bright lights blaze round the helipad, and a siren starts to wail.\n\nThe radio crackles: \"We see your lights! We are on our way!\"\n\nBut the helicopter is not the only thing that has noticed...");
  setGoal();
}

function win() {
  goal = 7;
  mode = "won";
  sound(playJingle);
  try { localStorage.removeItem(SAVE); } catch (problem) { /* never mind */ }
  el("won").hidden = false;
  if (document.exitPointerLock) document.exitPointerLock();
}

// Fire a sleepy dart at the dinosaur you are looking at
function fireDart() {
  if (!inv.darts || clock < dartReady || me.hidden) return;
  dartReady = clock + 0.8;
  inv.darts--;
  soundDart();
  const way = { x: -Math.sin(me.yaw) * Math.cos(me.pitch), y: Math.sin(me.pitch), z: -Math.cos(me.yaw) * Math.cos(me.pitch) };
  let best = null;
  let bestOff = 0.12;
  for (const d of dinos) {
    if (d.swim || d.fly !== undefined) continue;
    const dx = d.x - me.x;
    const dy = SHAPES[d.kind].tall * 0.5 - 1.6;
    const dz = d.z - me.z;
    const far = Math.hypot(dx, dy, dz);
    if (far > 50) continue;
    // How far off your aim is it? (Bigger dinosaurs are easier to hit.)
    const off = Math.acos(clamp((dx * way.x + dy * way.y + dz * way.z) / far, -1, 1)) - Math.atan(SHAPES[d.kind].long * 0.3 / far);
    if (off < bestOff) {
      best = d;
      bestOff = off;
    }
  }
  if (!best) return say("Missed! " + inv.darts + " darts left.", 2);
  best.mood = "asleep";
  best.until = clock + 30;
  say("The " + SPECIES[best.kind].name + " yawns... and falls asleep. " + inv.darts + " darts left.", 3);
}

function throwFlare() {
  if (!inv.flares) return say(inv.radio ? "No flares left" : "You have no flares", 2);
  if (flare || me.hidden) return;
  inv.flares--;
  const at = me.driving ? car : me;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a2a, fog: false }));
  const shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot, color: 0xff5a3a, transparent: true, depthWrite: false, fog: false }));
  shine.scale.set(9, 9, 1);
  mesh.add(shine);
  flare = { x: at.x - Math.sin(me.yaw) * 20, z: at.z - Math.cos(me.yaw) * 20, until: clock + 12, mesh: mesh };
  mesh.position.set(flare.x, 0.5, flare.z);
  scene.add(mesh);
  say("You throw a flare. The hunters will go to it. " + inv.flares + " left.", 3);
}

// ===== 7. One step of the game =====
function setGoal() {
  el("goal").textContent = GOAL_TEXT[goal];
}

let near = null;
function tick(dt) {
  clock += dt;
  moveMe(dt);
  updateDinos(dt);
  if (mode !== "play") return;
  near = findNear();
  if (flare && clock > flare.until) {
    scene.remove(flare.mesh);
    flare = null;
  }
  // The helicopter comes in to land
  if (goal === 5 && clock > rescueAt) {
    goal = 6;
    setGoal();
    say("The helicopter is down! RUN!", 5);
  }
}

// ===== 8. Drawing =====
const strings = {};
function setText(id, text) {
  if (strings[id] === text) return;
  strings[id] = text;
  el(id).innerHTML = text;
}

// The park map (once you have found one). Your spot is white, your goal is yellow.
function drawMap() {
  const pen = el("minimap").getContext("2d");
  const s = 130 / SIZE;
  for (const quarter of [["desert", 0, 0], ["snow", 41, 0], ["jungle", 0, 41], ["swamp", 41, 41]]) {
    pen.fillStyle = BIOMES[quarter[0]].map;
    pen.fillRect(quarter[1] * s, quarter[2] * s, 39 * s, 39 * s);
  }
  pen.fillStyle = "#3aa8dc";
  pen.fillRect(39 * s, 0, 2 * s, 130);
  pen.fillRect(0, 39 * s, 130, 2 * s);
  for (const key in state.tiles) {
    const n = key.split(",").map(Number);
    pen.fillStyle = state.tiles[key] === "path" ? "#f0dca0" : "#8a5a3a";
    pen.fillRect(n[0] * s, n[1] * s, Math.max(1.6, s), Math.max(1.6, s));
  }
  for (const pad of state.pads) {
    pen.strokeStyle = pad.kind === "water" ? "#1a5a9a" : "#5a3a1a";
    pen.strokeRect(pad.i0 * s, pad.k0 * s, (pad.i1 - pad.i0 + 1) * s, (pad.k1 - pad.k0 + 1) * s);
  }
  const dot = function (x, z, colour, big) {
    pen.fillStyle = colour;
    pen.fillRect((x + HALF) / TILE * s - big / 2, (z + HALF) / TILE * s - big / 2, big, big);
  };
  // The tracker shows hunters that are close
  if (inv.radio) {
    for (const d of dinos) {
      if (d.hunter && Math.hypot(d.x - me.x, d.z - me.z) < 100) dot(d.x, d.z, d.mood === "hunt" ? "#ffffff" : "#ff2a1a", 5);
    }
  }
  const spot = goalSpot();
  if (Math.sin(wall * 5) > -0.4) dot(spot.x, spot.z, "#ffe14a", 7);
  if (car.fuelled || goal > 1) dot(car.x, car.z, "#3a7a4a", 5);
  dot(me.x, me.z, "#000000", 7);
  dot(me.x, me.z, "#ffffff", 4);
}

function drawHud() {
  el("stamina-fill").style.width = Math.round(me.stamina * 100) + "%";
  // How much danger are you in?
  let danger = 0;
  let who = "";
  for (const d of dinos) {
    if (!d.hunter || d.mood === "asleep") continue;
    const far = Math.hypot(d.x - me.x, d.z - me.z);
    const level = d.mood === "hunt" ? 3 : d.mood === "search" ? 2 : far < 45 ? 1 : 0;
    if (level > danger) {
      danger = level;
      who = SPECIES[d.kind].name;
    }
  }
  const loud = me.hidden ? "Hidden" : me.driving ? "Driving: very loud" : !me.moving ? "Standing still: silent" : me.sneak ? "Creeping: quiet" : me.running ? "Running: LOUD" : "Walking";
  setText("noise", loud);
  setText("warn", danger === 3 ? who + " IS HUNTING YOU! Hide (E at a door) or get away!" : danger === 2 ? "A " + who + " is looking for you. Keep still..." : danger === 1 ? "A " + who + " is near. Creep (hold C)." : "");
  el("warn").hidden = !danger || mode !== "play";
  el("warn").className = danger === 3 ? "hunted" : "";
  let stuff = "";
  if (inv.radio) stuff = "Darts " + inv.darts + " (click) · Flares " + inv.flares + " (G)";
  if (inv.fuel) stuff += " · Carrying fuel";
  if (goal === 5) stuff += " · Helicopter in " + Math.max(0, Math.ceil(rescueAt - clock)) + " s";
  setText("stuff", stuff);
  // Which way, and how far, to where you need to go (once you have the map)
  if (inv.map && goal < 7) {
    const spot = goalSpot();
    let turn = Math.atan2(-(spot.x - me.x), -(spot.z - me.z)) - (me.driving ? car.yaw : me.yaw);
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    setText("where", ["↑", "↖", "←", "↙", "↓", "↘", "→", "↗"][(Math.round(turn / (Math.PI / 4)) + 8) % 8] + " " + Math.round(Math.hypot(spot.x - me.x, spot.z - me.z)) + " m");
  } else {
    setText("where", "");
  }
  el("minimap").hidden = !inv.map;
  if (inv.map) drawMap();
  const hint = mode === "play" && near ? near.text : "";
  setText("hint", hint);
  el("hint").hidden = !hint;
  if (!el("toast").hidden && wall > toastUntil) el("toast").hidden = true;
  const red = night ? (Math.sin(wall * 6) > 0 ? 0.8 : 0.2) : flash;
  el("tint").style.boxShadow = red > 0 ? "inset 0 0 " + Math.round(120 + red * 120) + "px rgba(255,30,20," + (0.3 + red * 0.5) + ")" : me.hidden ? "inset 0 0 200px rgba(0,0,0,0.85)" : danger === 3 ? "inset 0 0 90px rgba(255,30,20,0.5)" : "none";
}

function draw(dt) {
  wall += dt;
  shake = Math.max(0, shake - dt);
  flash = Math.max(0, flash - dt);
  camera.rotation.order = "YXZ";
  if (mode === "intro" || mode === "won") {
    // Behind the title: a slow look round the silent resort
    camera.position.set(mid(10) + Math.cos(wall * 0.08) * 30, 14, mid(72) + Math.sin(wall * 0.08) * 30);
    camera.lookAt(mid(12), 2, mid(70));
  } else if (me.driving) {
    camera.position.set(car.x + Math.sin(car.yaw) * 11, 6, car.z + Math.cos(car.yaw) * 11);
    camera.lookAt(car.x - Math.sin(car.yaw) * 8, 2, car.z - Math.cos(car.yaw) * 8);
  } else {
    const high = me.hidden ? 1.5 : me.sneak ? 1.05 : 1.7 + (me.moving ? Math.sin(wall * (me.running ? 14 : 9)) * 0.05 : 0);
    // Hidden: you stand in the doorway with your back to the door, looking out
    camera.position.set(me.hidden ? me.hidden.x + Math.sin(me.hidden.out) * 0.45 : me.x, high, me.hidden ? me.hidden.z + Math.cos(me.hidden.out) * 0.45 : me.z);
    camera.rotation.set(me.pitch, me.yaw, 0);
  }
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.4;
    camera.position.y += (Math.random() - 0.5) * shake * 0.4;
  }
  sunLight.target.position.set(me.x, 0, me.z);
  sunLight.position.set(me.x - 60, 120, me.z + 50);
  jeepModel.position.set(car.x, 0, car.z);
  jeepModel.rotation.y = car.yaw;

  // The helicopter flies in, and settles on the pad
  heli.visible = goal >= 5;
  if (heli.visible) {
    const left = Math.max(0, rescueAt - clock);
    const down = goal >= 6 ? 0 : Math.min(1, left / 12);
    heli.position.set(mid(65) + down * 120, 1.6 + down * 70, mid(12) - down * 60);
    heli.rotation.y = 1.2;
    heli.userData.rotor.rotation.y += dt * 30;
  }
  smokePuffs.forEach(function (puff, n) {
    const up = (wall * 6 + n * 22) % 150;
    puff.position.set(VOLCANO.x + Math.sin(n * 2 + up * 0.02) * 12 + up * 0.25, 128 + up, VOLCANO.z);
    puff.scale.setScalar(16 + up * 0.25);
    puff.material.opacity = 0.7 * (1 - up / 150);
  });
  poseDinos(wall);
  drawHud();
}

// ===== 9. Saving =====
function save() {
  try {
    localStorage.setItem(SAVE, JSON.stringify({ goal: Math.min(goal, 5), inv: inv, fuelled: car.fuelled }));
  } catch (problem) { /* never mind */ }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(SAVE));
  } catch (problem) {
    return null;
  }
}

function begin(saved) {
  inv = { map: false, darts: 0, flares: 0, keys: false, radio: false, snacks: false, fuel: false };
  goal = 0;
  car.fuelled = false;
  clock = 0;
  if (saved) {
    goal = saved.goal;
    for (const key in saved.inv) inv[key] = saved.inv[key];
    car.fuelled = saved.fuelled;
  }
  el("intro").hidden = true;
  el("won").hidden = true;
  mode = "play";
  restart();
  me.yaw = goal === 0 ? -Math.PI / 2 : 0;   // at the very start you face along the resort path
  me.pitch = 0;
  if (!saved) {
    night = true;
    soundSiren();
    showCard("Midnight at Fossil Bay.\n\nThe power fails. Every fence on the island goes dead. Sirens wail and red lights flash, and the rangers bang on every cabin door: \"EVERYBODY TO THE DOCK! NOW!\"\n\nBut you are the heaviest sleeper in the whole world. You don't hear a thing.");
    showCard("Morning.\n\nYou wake up, stretch, and open your cabin door. The resort is silent. There is a note pinned to the door:\n\n\"ALL GUESTS TO THE DOCK AT ONCE. THE FENCES ARE DOWN.\"\n\nThe last boat left hours ago. And something very large has left footprints right outside.");
    showCard("Hunters hear you when you are loud. Hold C to creep, Shift to run. Standing still is silent.\n\nPress E at a door to hide inside a building.\n\nPlant-eaters won't hurt you. Things with sharp teeth will.");
  }
}

// ===== 10. Keys, mouse and buttons =====
window.addEventListener("keydown", function (e) {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (mode === "card") {
    if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") closeCard();
    return;
  }
  if (mode !== "play") return;
  if (e.code === "KeyE" && near && near.act) near.act();
  else if (e.code === "KeyG") throwFlare();
  else if (e.code === "Space" && !me.driving) fireDart();
});

window.addEventListener("keyup", function (e) {
  keys[e.code] = false;
});

window.addEventListener("blur", function () {
  for (const code in keys) keys[code] = false;
});

canvas.addEventListener("click", function () {
  if (mode !== "play") return;
  if (!locked && canvas.requestPointerLock) canvas.requestPointerLock();
  else if (!me.driving) fireDart();
});

document.addEventListener("pointerlockchange", function () {
  locked = document.pointerLockElement === canvas;
});

document.addEventListener("mousemove", function (e) {
  if (!locked || mode !== "play") return;
  me.yaw -= e.movementX * 0.0025;
  me.pitch = clamp(me.pitch - e.movementY * 0.0025, -1.3, 1.3);
});

el("card").addEventListener("click", function () {
  if (mode === "card") closeCard();
});
el("start").addEventListener("click", function () {
  begin(null);
});
el("continue").addEventListener("click", function () {
  begin(load());
});
el("again").addEventListener("click", function () {
  begin(null);
});

// ===== 11. Go! =====
refreshPark();
makeDinos();
// The monorail train is stuck on its track, half way between two stations
trainCars.forEach(function (carriage, n) {
  carriage.visible = true;
  carriage.position.set(mid(30) + n * 7, RAIL_HIGH + 1.4, mid(59));
  carriage.rotation.y = Math.PI / 2;
});
// A misty morning
scene.fog.color.setHex(0xd8ecf0);
scene.fog.near = 50;
scene.fog.far = 520;
renderer.setClearColor(0xd8ecf0);
camera.fov = 68;
camera.updateProjectionMatrix();
me.x = STARTS[0].x;
me.z = STARTS[0].z;
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
  else if (mode === "intro") updateDinos(dt);
  draw(dt);
  renderer.render(scene, camera);
}

// For testing the game with a script: add ?test to the address
if (testing) {
  begin(null);
  while (cards.length) closeCard();
  window.LO = {
    me: me, car: car, keys: keys, dinos: dinos, hides: hides,
    inv: function () { return inv; },
    goal: function () { return goal; },
    mode: function () { return mode; },
    near: function () { return near; },
    clock: function () { return clock; },
    frames: function () { return frameCount; },
    setGoal: function (n) { goal = n; setGoal(); },
    closeCards: function () { while (cards.length) closeCard(); },
    free: free, tryMove: tryMove, loudness: loudness, notices: notices, fireDart: fireDart, throwFlare: throwFlare, begin: begin, load: load, restart: restart,
    step: function (n) { for (let i = 0; i < n; i++) { if (mode === "play") tick(0.05); } },
  };
}

requestAnimationFrame(frame);
