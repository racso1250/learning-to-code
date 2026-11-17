// Nightwood: the game. You see through your own eyes (drawn with THREE.js).
// The forest is a flat map (see map.js); trees and monsters are flat pictures that turn to face you.

const el = (id) => document.getElementById(id);
const centre = (square) => square * TILE + TILE / 2;
const UNIT = 1 / TILE;        // the map is measured in pixels; 16 pixels = 1 step in 3D
const DAY_LENGTH = 100;
const NIGHT_LENGTH = 90;
const TEST = location.search.includes("test");

function sound(make) {
  try { make(); } catch (error) { /* no sound: the game still works */ }
}
const sfx = {
  pick: () => sound(() => playTone(0, 0.09, 700, 1050, 0.12)),
  flash: () => sound(() => playNoise(0, 0.15, 4000, 1000, 0.2)),
  screech: () => sound(() => { playTone(0, 0.45, 1500, 250, 0.25); playNoise(0, 0.45, 3200, 500, 0.3); }),
  thump: () => sound(() => { playTone(0, 0.09, 70, 45, 0.3); playTone(0.14, 0.09, 60, 40, 0.22); }),
  moan: () => sound(() => playTone(0, 1.4, 150 + Math.random() * 60, 70, 0.07)),
  twig: () => sound(() => playNoise(0, 0.06, 2500, 800, 0.1)),
  puff: () => sound(() => playNoise(0, 0.3, 900, 200, 0.15)),
  win: () => sound(() => playJingle()),
};

// ----- Pictures (drawn with the pixel-art toolkit from the Dragon Tamers games) -----
function drawGhoulFace() {
  // The face that jumps out at you: pale, with hollow eyes and a mouth that is far too wide
  const a = new Art(44, 44);
  a.oval(22, 22, 17, 19, "#d8d8cc");
  a.oval(22, 14, 13, 9, "#ecece2");
  a.oval(14, 18, 5, 6.5, "#08040a");
  a.oval(30, 18, 5, 6.5, "#08040a");
  a.box(13, 18, 2, 2, "#ff2a2a");
  a.box(29, 18, 2, 2, "#ff2a2a");
  a.oval(22, 33, 10, 6, "#08040a");
  for (let x = 14; x < 30; x += 3) a.box(x, 28, 2, 3, "#ecece2");
  for (let x = 15; x < 30; x += 3) a.box(x, 36, 2, 3, "#ecece2");
  a.line(10, 8, 6, 2, "#d8d8cc");
  a.line(34, 8, 38, 2, "#d8d8cc");
  return finish(a);
}
function drawStalker(frame) {
  // Tall, thin and dark, with long arms and white eyes
  const a = new Art(22, 44);
  a.box(8, 12, 6, 20, "#14101c");
  a.oval(11, 8, 5, 6, "#1c1626");
  a.box(3 - frame, 13, 3, 20, "#14101c");
  a.box(16 + frame, 13, 3, 20, "#14101c");
  a.box(8, 32, 2, 10 - frame, "#14101c");
  a.box(12, 32, 2, 9 + frame, "#14101c");
  a.box(8, 7, 2, 2, "#ffffff");
  a.box(12, 7, 2, 2, "#ffffff");
  return finish(a, { outline: "#000000" });
}
function drawLurker(frame) {
  // Low and wide, all teeth: it crouches behind trees
  const a = new Art(30, 22);
  a.oval(15, 13, 12, 8, "#1a2416");
  a.oval(15, 9, 9, 5, "#243020");
  a.box(8, 7, 3, 2, "#d8ff5a");
  a.box(19, 7, 3, 2, "#d8ff5a");
  a.box(7, 14, 16, 4 + frame, "#08040a");
  for (let x = 8; x < 22; x += 3) a.box(x, 14, 2, 2, "#ffffff");
  a.box(3, 18, 4, 3, "#1a2416");
  a.box(23, 18, 4, 3, "#1a2416");
  return finish(a, { outline: "#000000" });
}
function drawRuneStone() {
  const a = new Art(18, 30);
  a.shape([[3, 28], [4, 6], [9, 1], [14, 6], [15, 28]], "#5a6272");
  a.box(5, 7, 2, 20, "#7a8292");
  a.box(8, 9, 2, 8, "#7af0ff");
  a.box(6, 12, 6, 2, "#7af0ff");
  a.box(8, 20, 2, 3, "#7af0ff");
  return finish(a);
}
function drawWood() {
  const a = new Art(18, 12);
  a.box(2, 6, 14, 4, "#7a5230");
  a.box(4, 2, 12, 4, "#8f6238");
  a.oval(3, 8, 1.6, 2, "#c8a468");
  a.oval(5, 4, 1.6, 2, "#c8a468");
  return finish(a);
}
function drawBattery() {
  const a = new Art(10, 14);
  a.box(2, 3, 6, 10, "#3a3a46");
  a.box(4, 1, 2, 2, "#aab2c0");
  a.box(2, 6, 6, 3, "#ffe14a");
  return finish(a);
}
function drawGate(open) {
  const a = new Art(40, 44);
  a.box(2, 4, 6, 40, "#3a3346");
  a.box(32, 4, 6, 40, "#3a3346");
  a.box(0, 0, 40, 6, "#2b2634");
  if (!open) {
    for (let x = 9; x < 32; x += 4) a.box(x, 6, 2, 38, "#1c1824");
    a.box(8, 20, 24, 2, "#1c1824");
    a.oval(20, 21, 4, 4, "#7af0ff");
  }
  return finish(a);
}
const eyePicture = function (colour) {
  const picture = makeCanvas(7, 1);
  const g = picture.getContext("2d");
  g.fillStyle = colour;
  g.fillRect(0, 0, 2, 1);
  g.fillRect(5, 0, 2, 1);
  return picture;
};
const SPR = {
  tree: [drawDoomTree(0), drawDoomTree(1), drawDoomTree(2)], mushroom: [drawMushroom()], rock: [drawRock(0), drawRock(1), drawRock(2)], skull: [drawSkull()],
  peak: [drawPeak(false, 0), drawPeak(false, 1), drawPeak(false, 2)], stone: [drawRuneStone()],
  stalker: [drawStalker(0), drawStalker(1)], lurker: [drawLurker(0), drawLurker(1)],
  key: drawGem("#7af0ff"), wood: drawWood(), battery: drawBattery(), gate: [drawGate(false), drawGate(true)],
  flame: [drawFlame(0), drawFlame(1), drawFlame(2)], logs: drawCampfire(),
  eyesWhite: eyePicture("#ffffff"), eyesGreen: eyePicture("#d8ff5a"), eyesRed: eyePicture("#ff5a3a"),
};
el("scare-face").src = scaled(drawGhoulFace(), 5).toDataURL();

// ----- What the game remembers -----
const SAVE_NAME = "nightwoodSave";
const forest = makeForest();
function newState() {
  return { day: 1, phase: "day", timer: DAY_LENGTH, hp: 3, keys: [], wood: 2, battery: 100, fire: 50, taken: {} };
}
let state = newState();
function save() {
  try { localStorage.setItem(SAVE_NAME, JSON.stringify(state)); } catch (error) { /* keep playing */ }
}
function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_NAME));
    return saved && Array.isArray(saved.keys) ? Object.assign(newState(), saved) : null;
  } catch (error) { return null; }
}

const player = { x: centre(CAMP[0]), y: centre(CAMP[1]) + 58, anim: 0, moving: false };
let face = -Math.PI / 2;      // which way you are looking (north to begin with)
let tilt = 0;
let items = [];
let monsters = [];
let playing = false;
let paused = false;
let time = 0;
let scare = 0;
let shake = 0;
let flash = 0;
let safe = 0;                 // a moment of safety after a monster gets you
let beat = 0;
let spawnTimer = 5;
let noise = 6;
let dread = 0;
const watchers = [];
for (let i = 0; i < 7; i++) watchers.push({ x: -999, y: -999 });

function setUp(saved) {
  state = saved || newState();
  items = [];
  forest.stones.forEach((spot, i) => items.push({ id: "k" + i, kind: "key", x: centre(spot[0]), y: centre(spot[1]) }));
  forest.wood.forEach((spot, i) => items.push({ id: "w" + i, kind: "wood", x: centre(spot[0]), y: centre(spot[1]) }));
  forest.batteries.forEach((spot, i) => items.push({ id: "b" + i, kind: "battery", x: centre(spot[0]), y: centre(spot[1]) }));
  items = items.filter((item) => !state.taken[item.id]);
  monsters = [];
  Object.assign(player, { x: centre(CAMP[0]), y: centre(CAMP[1]) + 58 });
  face = -Math.PI / 2;
  openGate();
  hudText = "";
}
function openGate() {
  const open = state.keys.length >= 6;
  for (const x of [GATE[0] - 1, GATE[0]]) WORLD.blocked[GATE[1]][x] = !open;
}

// ----- Keyboard and mouse -----
const keys = {};
const justPressed = {};
let mouseDown = false;
document.addEventListener("keydown", function (event) {
  if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
  if (!keys[event.code]) justPressed[event.code] = true;
  keys[event.code] = true;
});
document.addEventListener("keyup", (event) => (keys[event.code] = false));
function pressed(code) {
  const yes = justPressed[code];
  justPressed[code] = false;
  return yes;
}
function grabMouse() {
  if (playing && !TEST && el("game").requestPointerLock) el("game").requestPointerLock();
}
document.addEventListener("mousemove", function (event) {
  if (!document.pointerLockElement || !playing || card || paused) return;
  face += event.movementX * 0.0026;
  tilt = Math.max(-0.7, Math.min(0.7, tilt - event.movementY * 0.0022));
});
document.addEventListener("mousedown", function (event) {
  if (event.target.id === "game" && !document.pointerLockElement) return grabMouse();
  if (event.button === 0 && document.pointerLockElement) justPressed.Space = true;
});

let toastTimer = 0;
function toast(text, seconds, big) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  el("toast").classList.toggle("big", Boolean(big));
  toastTimer = seconds || 3;
}
let card = null;
function showCard(lines, done) {
  card = { lines: lines, index: 0, done: done };
  el("card").hidden = false;
  el("card-text").textContent = lines[0];
}
function updateCard() {
  if (!pressed("Space") && !pressed("Enter")) return;
  card.index++;
  if (card.index < card.lines.length) return (el("card-text").textContent = card.lines[card.index]);
  const done = card.done;
  card = null;
  el("card").hidden = true;
  if (done) done();
}

// ----- Light and dark -----
const turnBetween = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const campX = centre(CAMP[0]);
const campY = centre(CAMP[1]);
const fireBurning = () => state.fire > 0;
const inFirelight = (x, y) => fireBurning() && Math.hypot(x - campX, y - campY) < 96;
// Is this spot lit by your torch? (Only what is in front of you.)
function inTorch(x, y, reach) {
  const away = Math.hypot(x - player.x, y - player.y);
  return state.battery > 0 && away < (reach || 110) && Math.abs(turnBetween(Math.atan2(y - player.y, x - player.x), face)) < 0.5;
}
function solidAt(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || WORLD.blocked[ty][tx];
}
const canStand = (x, y) => !solidAt(x - 4, y - 4) && !solidAt(x + 4, y - 4) && !solidAt(x - 4, y + 2) && !solidAt(x + 4, y + 2);

// For every square, how many steps to you? Monsters follow the numbers downhill to find their way round the trees.
let trail = [];
let trailTimer = 0;
function stepsFrom(tx, ty) {
  const steps = [];
  for (let y = 0; y < MAP_H; y++) steps.push(new Int16Array(MAP_W).fill(-1));
  steps[ty][tx] = 0;
  const queue = [[tx, ty]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || steps[ny][nx] >= 0 || WORLD.blocked[ny][nx]) continue;
      steps[ny][nx] = steps[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return steps;
}

// ----- Day and night -----
function startNight() {
  state.phase = "night";
  state.timer = NIGHT_LENGTH;
  spawnTimer = 6;
  toast("NIGHT " + state.day + ".  Get to the fire.", 5, true);
  sfx.moan();
}
function dawn() {
  for (const m of monsters) m.gone = true;
  monsters = [];
  state.phase = "day";
  state.timer = DAY_LENGTH;
  state.day++;
  state.hp = 3;
  toast("Morning. The things in the trees have gone... for now.", 5);
  sfx.win();
  save();
}

// A monster gets you: the face, the scream, and you wake up by the fire
function caught() {
  if (safe > 0) return;
  scare = 0.7;
  shake = 0.6;
  safe = 4;
  sfx.screech();
  state.hp--;
  monsters = [];
  Object.assign(player, { x: campX, y: campY + 58 });
  face = -Math.PI / 2;
  if (state.hp > 0) return toast("It got you! You wake up beside the fire, shaking. Hearts left: " + state.hp, 5);
  // Out of hearts: the night starts again
  state.hp = 3;
  state.fire = Math.max(state.fire, 40);
  state.timer = NIGHT_LENGTH;
  showCard(["Everything goes dark.", "You wake up by the fire. It is still night.", "Was it a dream? Something is breathing in the trees."]);
}

function addMonster(type, x, y) {
  const monster = { type: type, x: x, y: y, state: type === "lurker" ? "hide" : "hunt", frozen: false, name: "m" + Math.random(), watched: 0 };
  monsters.push(monster);
  return monster;
}

function updateMonsters(dt) {
  if (state.phase !== "night") return;
  if ((trailTimer -= dt) <= 0) {
    trailTimer = 0.6;
    trail = stepsFrom(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
  }
  // New monsters come out of the trees through the night
  if ((spawnTimer -= dt) <= 0) {
    spawnTimer = 7 - Math.min(3, state.day * 0.5);
    if (monsters.length < 2 + state.day) {
      for (let tries = 0; tries < 20; tries++) {
        const spot = WORLD.paths[Math.floor(Math.random() * WORLD.paths.length)];
        const x = centre(spot[0]), y = centre(spot[1]);
        const away = Math.hypot(x - player.x, y - player.y);
        if (away < 130 || away > 300 || inFirelight(x, y) || inTorch(x, y, 200)) continue;
        addMonster(Math.random() < 0.5 ? "stalker" : "lurker", x, y);
        break;
      }
    }
  }
  let nearest = 999;
  for (const m of monsters.slice()) {
    const dx = player.x - m.x;
    const dy = player.y - m.y;
    const away = Math.hypot(dx, dy) || 1;
    const looking = (Math.cos(face) * -dx + Math.sin(face) * -dy) / away > 0.6;
    nearest = Math.min(nearest, away);
    let speed = 0;
    if (m.type === "stalker") {
      // A Stalker only moves when you are not looking at it
      m.frozen = looking && away < 190;
      speed = m.frozen ? 0 : 52;
    } else if (m.state === "hide") {
      // A Lurker waits behind a tree until you walk past... then jumps out
      if (inTorch(m.x, m.y) && looking && (m.watched += dt) > 1.2) {
        m.gone = true;       // you spotted it in time: it slinks away
        sfx.puff();
      }
      if (away < 52) {
        m.state = "leap";
        shake = 0.3;
        sound(() => { playTone(0, 0.25, 1100, 500, 0.18); playNoise(0, 0.2, 2500, 900, 0.15); });
      }
    } else speed = 150;
    if (speed) {
      // Head for you, round the trees, but never into the firelight
      let vx = (dx / away) * speed, vy = (dy / away) * speed;
      const cx = Math.floor(m.x / TILE), cy = Math.floor(m.y / TILE);
      if (m.state !== "leap" && trail[cy]) {
        let best = trail[cy][cx], bx = cx, by = cy;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const steps = trail[cy + oy] ? trail[cy + oy][cx + ox] : -1;
          if (steps >= 0 && (best < 0 || steps < best)) { best = steps; bx = cx + ox; by = cy + oy; }
        }
        if (best > 1) {
          const far = Math.hypot(centre(bx) - m.x, centre(by) - m.y) || 1;
          vx = ((centre(bx) - m.x) / far) * speed;
          vy = ((centre(by) - m.y) / far) * speed;
        }
      }
      const nx = m.x + vx * dt, ny = m.y + vy * dt;
      if (inFirelight(nx, ny)) {
        if (m.state === "leap") m.gone = true;
      } else {
        if (m.state === "leap" || !solidAt(nx, m.y)) m.x = nx;
        if (m.state === "leap" || !solidAt(m.x, ny)) m.y = ny;
      }
    }
    if (m.gone) {
      monsters.splice(monsters.indexOf(m), 1);
      continue;
    }
    if (away < 18 && !inFirelight(player.x, player.y)) return caught();
  }
  // Your heart thumps as something gets close
  if (nearest < 170 && (beat -= dt) <= 0) {
    beat = 0.3 + (nearest / 170) * 0.9;
    sfx.thump();
  }
  const fear = 0.4 + Math.max(0, 1 - nearest / 170) * 0.55;
  dread += (fear - dread) * Math.min(1, dt * 3);
  // Noises in the dark
  if ((noise -= dt) <= 0) {
    noise = 6 + Math.random() * 9;
    if (Math.random() < 0.5) sfx.moan();
    else sfx.twig();
  }
  // Eyes that watch from between the trees, and are gone when your torch finds them
  for (const eye of watchers) {
    const away = Math.hypot(eye.x - player.x, eye.y - player.y);
    if (away > 70 && away < 200 && !inTorch(eye.x, eye.y) && !inFirelight(eye.x, eye.y)) continue;
    const angle = Math.random() * Math.PI * 2;
    eye.x = player.x + Math.cos(angle) * (100 + Math.random() * 80);
    eye.y = player.y + Math.sin(angle) * (100 + Math.random() * 80);
  }
}

// Space: a bright flash from your torch. Any monster caught in it is driven away.
function flashTorch() {
  if (state.battery < 10) return toast("The torch is too weak to flash. Find a battery!");
  state.battery -= 10;
  flash = 0.35;
  sfx.flash();
  for (const m of monsters) {
    if (!inTorch(m.x, m.y, 140)) continue;
    m.gone = true;
    sfx.puff();
  }
  monsters = monsters.filter((m) => !m.gone);
}

let hudText = "";
function update(dt) {
  time += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) el("toast").hidden = true;
  if (scare > 0) scare -= dt;
  if (shake > 0) shake -= dt;
  if (flash > 0) flash -= dt;
  if (safe > 0) safe -= dt;
  if (card) return updateCard();
  if (pressed("KeyP")) paused = !paused;
  if (paused) return toast("Paused. Press P to keep playing.", 0.3);
  // Looking and walking
  face += ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 2.4 * dt;
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const across = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  player.moving = ahead !== 0 || across !== 0;
  if (player.moving) {
    let ax = Math.cos(face) * ahead - Math.sin(face) * across;
    let ay = Math.sin(face) * ahead + Math.cos(face) * across;
    const length = Math.hypot(ax, ay);
    const speed = keys.ShiftLeft || keys.ShiftRight ? 112 : 76;
    ax = (ax / length) * speed * dt;
    ay = (ay / length) * speed * dt;
    if (canStand(player.x + ax, player.y)) player.x += ax;
    if (canStand(player.x, player.y + ay)) player.y += ay;
    player.anim += dt * (speed / 76);
  }
  if (pressed("Space")) flashTorch();
  // Picking things up
  for (const item of items.slice()) {
    if (Math.hypot(item.x - player.x, item.y - player.y) > 14) continue;
    items.splice(items.indexOf(item), 1);
    state.taken[item.id] = true;
    sfx.pick();
    if (item.kind === "wood") {
      state.wood++;
      toast("Firewood. (" + state.wood + ") Press E at the campfire to feed the fire.");
    } else if (item.kind === "battery") {
      state.battery = Math.min(100, state.battery + 50);
      toast("A battery! The torch is brighter.");
    } else {
      state.keys.push(item.id);
      openGate();
      sfx.win();
      toast(state.keys.length < 6 ? "A rune key! (" + state.keys.length + "/6)" : "The last rune key! The gate in the north is open. RUN.", 5, state.keys.length >= 6);
    }
    save();
  }
  // The campfire
  const atFire = Math.hypot(player.x - campX, player.y - campY) < 40;
  const label = atFire ? (state.wood > 0 ? "E: put wood on the fire (it burns for " + Math.ceil(state.fire) + "s more)" : "You have no wood for the fire.") : "";
  if (el("prompt").textContent !== label) {
    el("prompt").textContent = label;
    el("prompt").hidden = !label;
  }
  if (pressed("KeyE") && atFire && state.wood > 0) {
    state.wood--;
    state.fire = Math.min(180, state.fire + 40);
    sfx.pick();
  }
  if (state.phase === "night") {
    state.fire = Math.max(0, state.fire - dt);
    state.battery = Math.max(0, state.battery - dt * 0.7);
  }
  updateMonsters(dt);
  if (state.phase === "day") dread += (0 - dread) * Math.min(1, dt * 3);
  el("dread").style.opacity = dread.toFixed(2);
  // The clock
  state.timer -= dt;
  if (state.phase === "day" && state.timer < 20 && state.timer + dt >= 20) toast("The light is going. Get back to your fire!", 4);
  if (state.timer <= 0) {
    if (state.phase === "day") startNight();
    else dawn();
  }
  // Out through the gate!
  if (player.y < TILE * 2.5 && state.keys.length >= 6) {
    playing = false;
    localStorage.removeItem(SAVE_NAME);
    if (document.pointerLockElement) document.exitPointerLock();
    return showCard(["You run through the gate and do not look back.", "Behind you, the trees close over the path.", "You are out of Nightwood. You are safe.", "THE END. (Probably.)"], function () {
      sfx.win();
      setUp(null);
      el("continue").hidden = true;
      el("intro").hidden = false;
    });
  }
  // The top bar
  const left = Math.max(0, Math.ceil(state.timer));
  const clock = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
  const goal = state.keys.length >= 6 ? "The gate is open! Go north and get out!" : state.phase === "night" ? "NIGHT. Stay by the fire until morning: " + clock : "Day " + state.day + ". Find the rune keys. Dark in " + clock;
  const all = [state.hp, state.keys.length, state.wood, Math.ceil(state.battery), Math.ceil(state.fire / 5), goal].join("|");
  if (all !== hudText) {
    hudText = all;
    el("hearts").textContent = "♥".repeat(state.hp) + "♡".repeat(3 - state.hp);
    el("keys").textContent = "Keys " + state.keys.length + "/6";
    el("wood").textContent = "Wood " + state.wood;
    el("battery").textContent = "Torch " + Math.ceil(state.battery) + "%";
    el("fire").textContent = state.fire > 0 ? "Fire " + Math.ceil(state.fire) + "s" : "FIRE OUT!";
    el("place").textContent = "➤ " + goal;
  }
  // The arrow back to camp (turned so that "up" is the way you are facing)
  el("arrow").style.transform = "rotate(" + (Math.atan2(campY - player.y, campX - player.x) - face) + "rad) rotate(90deg)";
}

// ---------------------------------------------------------------------------
// The 3D view
// ---------------------------------------------------------------------------

const view = el("game");
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: false });
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1.5, 0.05, 90);
camera.rotation.order = "YXZ";
scene.add(camera);
scene.fog = new THREE.Fog(0x000000, 4, 26);
function fitView() {
  const w = view.clientWidth || 900;
  renderer.setSize(w, Math.round(w / 1.5), false);
}
window.addEventListener("resize", fitView);
fitView();

const daylight = new THREE.AmbientLight(0xffffff, 1);
const torch = new THREE.SpotLight(0xfff0c8, 0, 9, 0.5, 0.6, 1);
torch.target.position.set(0, 0, -1);
camera.add(torch, torch.target);
const fireLight = new THREE.PointLight(0xff9a3a, 0, 9, 1.2);
fireLight.position.set(campX * UNIT, 0.8, campY * UNIT);
scene.add(daylight, fireLight);

const textures = new Map();
function textureOf(picture) {
  if (!textures.has(picture)) {
    const texture = new THREE.CanvasTexture(picture);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    textures.set(picture, texture);
  }
  return textures.get(picture);
}
const upright = new THREE.PlaneGeometry(1, 1);
upright.translate(0, 0.5, 0);
const materials = new Map();
const lit = (picture) => materials.get(picture) || materials.set(picture, new THREE.MeshPhongMaterial({ map: textureOf(picture), alphaTest: 0.5, shininess: 0 })).get(picture);

// The ground, the pond, and every tree
for (let cy = 0; cy * CHUNK < MAP_H; cy++) {
  for (let cx = 0; cx * CHUNK < MAP_W; cx++) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK, CHUNK), new THREE.MeshPhongMaterial({ map: textureOf(groundChunk(cx, cy).ground), alphaTest: 0.5, shininess: 0 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx * CHUNK + CHUNK / 2, 0, cy * CHUNK + CHUNK / 2);
    scene.add(floor);
  }
}
const pond = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W + 40, MAP_H + 40), new THREE.MeshPhongMaterial({ color: 0x10202e, shininess: 90 }));
pond.rotation.x = -Math.PI / 2;
pond.position.set(MAP_W / 2, -0.12, MAP_H / 2);
scene.add(pond);
const scenery = [];
for (const o of WORLD.objects) {
  const list = SPR[o.type];
  const picture = list[(o.look === undefined ? Math.floor(hash(o.x, o.y, 5) * list.length) : o.look) % list.length];
  const mesh = new THREE.Mesh(upright, lit(picture));
  const big = o.type === "tree" ? 1.5 + hash(o.x, o.y, 6) * 0.7 : 1;       // tall, looming trees
  mesh.scale.set(picture.width * UNIT * big, picture.height * UNIT * big, 1);
  mesh.position.set((centre(o.x) + (hash(o.x, o.y, 7) - 0.5) * 6) * UNIT, 0, (centre(o.y) + (hash(o.x, o.y, 8) - 0.5) * 6) * UNIT);
  scene.add(mesh);
  scenery.push(mesh);
}
const stars = (function () {
  const spots = [];
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2, up = Math.random() * 0.9 + 0.1, flat = Math.sqrt(1 - up * up);
    spots.push(Math.cos(a) * flat * 80, up * 80, Math.sin(a) * flat * 80);
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(spots, 3));
  const points = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false, transparent: true }));
  points.frustumCulled = false;
  scene.add(points);
  return points;
})();

// Things that come and go: each frame the game says what to show; anything not asked for is taken away
const pool = new Map();
const wanted = new Set();
function show(name, picture, x, y, options) {
  const o = options || {};
  let mesh = pool.get(name);
  if (!mesh) {
    mesh = new THREE.Mesh(upright, o.glow ? new THREE.MeshBasicMaterial({ alphaTest: 0.5, fog: !o.always }) : new THREE.MeshPhongMaterial({ alphaTest: 0.5, shininess: 0 }));
    pool.set(name, mesh);
    scene.add(mesh);
  }
  wanted.add(name);
  if (mesh.material.map !== textureOf(picture)) {
    mesh.material.map = textureOf(picture);
    mesh.material.needsUpdate = true;
  }
  const size = o.size || 1;
  mesh.scale.set(picture.width * UNIT * size, picture.height * UNIT * size, 1);
  mesh.position.set(x * UNIT, o.lift || 0, y * UNIT);
  mesh.rotation.y = Math.atan2(camera.position.x - mesh.position.x, camera.position.z - mesh.position.z);
  return mesh;
}

function draw() {
  const jolt = shake > 0 ? shake * 0.25 : 0;
  camera.position.set(player.x * UNIT + (Math.random() - 0.5) * jolt, 1.5 + Math.sin(player.anim * 11) * 0.035 + (Math.random() - 0.5) * jolt, player.y * UNIT);
  camera.rotation.set(tilt, -face - Math.PI / 2, 0);
  // How dark is it? (Dusk comes on slowly; night is nearly black.)
  const night = state.phase === "night" ? Math.min(1, (NIGHT_LENGTH - state.timer) / 4, state.timer / 5 + 0.2) : Math.max(0, 1 - state.timer / 16);
  daylight.color.setRGB(0.72 - night * 0.6, 0.8 - night * 0.66, 0.74 - night * 0.52);
  const power = state.battery > 0 ? 0.4 + Math.min(1, state.battery / 30) * 0.6 : 0;
  torch.intensity = flash > 0 ? 6 : (0.35 + night * 1.9) * power * (Math.random() < 0.02 ? 0.4 : 1);
  torch.distance = flash > 0 ? 16 : 9;
  const sky = new THREE.Color(0.5, 0.58, 0.52).multiplyScalar(1 - night * 0.97);
  renderer.setClearColor(sky);
  scene.fog.color.copy(sky);
  scene.fog.near = 3 - night * 2;
  scene.fog.far = 26 - night * 14;
  stars.position.copy(camera.position);
  stars.material.opacity = night * 0.8;
  fireLight.intensity = fireBurning() ? (1.3 + night * 1.2) * (0.85 + Math.random() * 0.3) : 0;
  for (const mesh of scenery) mesh.rotation.y = Math.atan2(camera.position.x - mesh.position.x, camera.position.z - mesh.position.z);

  wanted.clear();
  show("logs", SPR.logs, campX, campY, { size: 1.6 });
  if (fireBurning()) show("flame", SPR.flame[Math.floor(time * 9) % 3], campX, campY - 1, { glow: true, size: 0.9 + Math.min(1, state.fire / 60) * 0.7, lift: 0.15 });
  show("gate", SPR.gate[state.keys.length >= 6 ? 1 : 0], GATE[0] * TILE, centre(GATE[1]), { size: 1.7 });
  for (const item of items) show(item.id, SPR[item.kind], item.x, item.y, { glow: item.kind === "key", size: item.kind === "key" ? 1.2 : 1.3, lift: item.kind === "key" ? 0.5 + Math.sin(time * 3 + item.x) * 0.12 : 0 });
  for (const m of monsters) {
    const lurking = m.type === "lurker" && m.state === "hide";
    const seen = inTorch(m.x, m.y) || inFirelight(m.x, m.y) || state.phase === "day" || flash > 0;
    const picture = SPR[m.type][m.frozen ? 0 : Math.floor(time * 6) % 2];
    show(m.name, picture, m.x, m.y, { size: m.state === "leap" ? 2.4 : m.type === "stalker" ? 1.5 : 1.6 }).visible = seen || m.state === "leap";
    show(m.name + "e", m.type === "stalker" ? SPR.eyesWhite : SPR.eyesGreen, m.x, m.y, { glow: true, always: true, size: 1.5, lift: m.type === "stalker" ? 3.3 : 0.95 }).visible = !seen && (!lurking || Math.sin(time * 0.8 + m.x) > 0.75);
  }
  if (state.phase === "night") watchers.forEach((eye, i) => (show("w" + i, SPR.eyesRed, eye.x, eye.y, { glow: true, always: true, size: 1.5, lift: 0.6 + (i % 3) * 0.5 }).visible = Math.sin(time * 1.3 + i * 2) < 0.9));
  for (const [name, mesh] of pool) {
    if (wanted.has(name)) continue;
    scene.remove(mesh);
    mesh.material.dispose();
    pool.delete(name);
  }
  renderer.render(scene, camera);
  el("scare-face").hidden = scare <= 0;
  if (scare > 0) el("scare-face").style.width = 45 + (0.7 - scare) * 80 + "%";
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
  lastTime = now;
  if (playing || card) update(dt);
  else {
    time += dt;
    face += dt * 0.08;        // the title screen: slowly looking round the camp
    if (scare > 0) scare -= dt;
  }
  draw();
  for (const code in justPressed) justPressed[code] = false;
  requestAnimationFrame(frame);
}

function startGame(saved) {
  setUp(saved);
  playing = true;
  el("intro").hidden = true;
  grabMouse();
  if (!saved) {
    showCard(["You don't remember how you got here.", "A cold campfire. A torch. Trees in every direction, all the same.", "Scratched on a stone by the fire: FIND THE SIX RUNES. THE GATE IS NORTH. DO NOT LET THE FIRE GO OUT."], function () {
      toast("Follow the paths to find rune keys, firewood and batteries. Be back at the fire before dark.", 7);
    });
  }
}
el("start").addEventListener("click", () => startGame(null));
el("continue").addEventListener("click", () => startGame(loadSave()));
el("continue").hidden = !loadSave();
setUp(null);
requestAnimationFrame(frame);

// Only for testing the game.
window.NW = {
  get state() { return state; },
  player: player, keys: keys, justPressed: justPressed, watchers: watchers,
  monsters: () => monsters, items: () => items, turn: (angle) => (face = angle), face: () => face, scare: () => scare,
  addMonster: addMonster, startNight: startNight, dawn: dawn, card: () => card, playing: () => playing, camp: [campX, campY],
};
