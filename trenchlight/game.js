// Trenchlight: the game.
// This file has the rules: driving the sub, drilling, building bases, parking at docks,
// what happens when a leviathan gets you, the radar, the map, and saving.

// ===== 1. What the game remembers =====
const SAVE = "trenchlight-save";

// Your submarine: where it is, which way it points, and how fast it is moving
const sub = { x: LIFT.x, y: liftY + DOCK_HIGH, z: LIFT.z, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0, lights: true };

// Everything that gets saved
function freshState() {
  return {
    bank: {},        // your store room (safe for ever)
    cargo: {},       // what the sub is carrying (lost if the hull breaks)
    up: { hull: 0, drill: 0, cargo: 0, battery: 0, engine: 0, decoy: 0, pulse: 0 },
    cores: [],       // the power cores you have found
    mods: [],        // your base pieces: { id, kind, x, z, base, turn }
    nextId: 1,
    home: 0,         // the dock you last parked at (0 = the Lift)
    hp: 100, energy: 100, decoys: 0,
    time: 0,         // seconds played
    won: false,
    met: [],         // leviathans you have met
    at: null,        // where the sub was when the game was saved
  };
}

let state = freshState();
let mode = "intro";       // intro, play, dock, menu, map, card or won
let placing = null;       // the kind of base piece you are about to put down
let ghost = null;         // the see-through model of that piece
let dockedAt = null;
let near = null;          // the thing close enough to use
let holdTime = 0;         // how long E has been held on something
let holdFor = null;
let pingUntil = 0;
let pulseAt = -99;
let safeUntil = 0;        // leviathans leave you alone until this time
let flash = 0;            // red flash when hit
let shake = 0;
let boltUntil = 0;
let wall = 0;             // a clock that never stops (for animations)
let lastLayer = "";
let lastSave = 0;
let lastTick = 0;
let mapFrom = "play";
let locked = false;       // is the mouse steering the sub?
const keys = {};
const mods = [];          // the base pieces that are in the sea right now
const tubes = new THREE.Group();
scene.add(tubes);

// What level of an upgrade do you have? level("hull").limit, level("drill").time ...
function level(id) {
  return UPGRADES[id].levels[state.up[id]];
}

function countOf(bag) {
  let n = 0;
  for (const kind in bag) n += bag[kind];
  return n;
}

function cargoRoom() {
  return level("cargo").holds - countOf(state.cargo);
}

// How much of something you have, in the store room and the cargo bay together
function stock(kind) {
  return (state.bank[kind] || 0) + (state.cargo[kind] || 0);
}

function canPay(cost) {
  for (const kind in cost) {
    if (stock(kind) < cost[kind]) return false;
  }
  return true;
}

// Pay for something: use up the cargo first, then the store room
function pay(cost) {
  for (const kind in cost) {
    const fromCargo = Math.min(cost[kind], state.cargo[kind] || 0);
    if (fromCargo) state.cargo[kind] -= fromCargo;
    if (cost[kind] > fromCargo) state.bank[kind] -= cost[kind] - fromCargo;
  }
}

// "3 Frost crystal, 3 Iron nodule", with what you are short of marked
function costText(cost, marked) {
  const parts = [];
  for (const kind in cost) {
    const text = cost[kind] + " " + ORES[kind].name;
    if (!marked) parts.push(text);
    else parts.push('<span class="' + (stock(kind) >= cost[kind] ? "got" : "need") + '">' + text + " (" + stock(kind) + ")</span>");
  }
  return parts.join(", ");
}

// How many of each thing the store room can hold
function bankCap() {
  return 20 + 20 * state.mods.filter(function (m) { return m.kind === "silo"; }).length;
}

function forward() {
  return { x: -Math.sin(sub.yaw) * Math.cos(sub.pitch), y: Math.sin(sub.pitch), z: -Math.cos(sub.yaw) * Math.cos(sub.pitch) };
}

// Leviathans can't see you while you are parked, or just after a rescue
function isHidden() {
  return mode !== "play" || state.time < safeUntil;
}

// ===== 2. Sounds =====
function sound(make) {
  try { make(); } catch (problem) { /* no sound is fine */ }
}
function soundPing() { sound(function () { playTone(0, 0.45, 1500, 1100, 0.1); playTone(0.3, 0.7, 1500, 800, 0.05); }); }
function soundRoar() { sound(function () { playNoise(0, 1.3, 260, 60, 0.45); playTone(0, 1.1, 110, 45, 0.35); }); }
function soundHit() { sound(function () { playNoise(0, 0.35, 900, 120, 0.5); playTone(0, 0.3, 160, 60, 0.4); }); }
function soundGot() { sound(function () { playTone(0, 0.09, 700, 900, 0.15); playTone(0.08, 0.12, 900, 1300, 0.15); }); }
function soundDock() { sound(function () { playTone(0, 0.2, 300, 450, 0.2); playTone(0.18, 0.3, 450, 680, 0.2); }); }
function soundBuild() { sound(function () { playNoise(0, 0.2, 500, 1500, 0.2); playTone(0.1, 0.25, 500, 800, 0.2); }); }
function soundZap() { sound(function () { playNoise(0, 0.3, 3000, 500, 0.3); }); }
function soundTick() { sound(function () { playNoise(0, 0.07, 2400, 1800, 0.05); }); }
function soundAlarm() { sound(function () { playTone(0, 0.16, 880, 880, 0.1); }); }

// ===== 3. Messages =====
const el = function (id) { return document.getElementById(id); };
let toastUntil = 0;

// Show a message at the top of the game for a few seconds
function say(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastUntil = wall + (seconds || 3);
}

// Story cards: the game waits until you press Space
const cardList = [];
function showCard(text, after) {
  cardList.push({ text: text, after: after });
  if (mode !== "card") nextCard();
}

function nextCard() {
  const card = cardList.shift();
  if (!card) return;
  mode = "card";
  el("card-text").textContent = card.text;
  el("card").hidden = false;
  nextCard.after = card.after;
}

function closeCard() {
  const after = nextCard.after;
  nextCard.after = null;
  el("card").hidden = true;
  mode = "play";
  if (cardList.length) nextCard();
  else if (after) after();
}

// The line of words above the game: what to do next
function setGoal() {
  let text;
  const started = mods.length > 0 || countOf(state.up) > 0 || state.cores.length > 0;
  if (state.won) text = "The Lift is alive. The whole sea is yours to explore";
  else if (state.cores.length === 4) text = "You have all four power cores! Take them back to the Lift";
  else if (!started) text = "Hold E by crystals and iron to drill them. Then press B and build a turbine and a workshop by the Lift";
  else text = "Power cores: " + state.cores.length + " of 4. Follow the pink marks on your radar (M shows the map)";
  el("goal").textContent = text;
}

// ===== 4. Your base =====
// Every place you can park: the Lift, and each docking ring you have built
function docks() {
  const list = [{ id: 0, x: LIFT.x, y: liftY + DOCK_HIGH, z: LIFT.z }];
  for (const m of mods) {
    if (m.kind === "dock") list.push({ id: m.id, x: m.x, y: m.y + DOCK_HIGH, z: m.z });
  }
  return list;
}

function dockById(id) {
  const all = docks();
  return all.find(function (d) { return d.id === id; }) || all[0];
}

function nearestDock(x, z, reach) {
  let best = null;
  for (const d of docks()) {
    const far = Math.hypot(d.x - x, d.z - z);
    if (far < reach && (!best || far < Math.hypot(best.x - x, best.z - z))) best = d;
  }
  return best;
}

// How much power does a base make and use? (A base is a dock and the pieces built near it.)
function basePower(id) {
  let made = 0;
  let used = 0;
  for (const m of mods) {
    if (m.base !== id) continue;
    made += m.info.makes || 0;
    used += m.info.uses || 0;
  }
  return { made: made, used: used };
}

function workshopReady() {
  return mods.some(function (m) { return m.kind === "workshop" && m.on; });
}

const tubeShape = new THREE.CylinderGeometry(0.8, 0.8, 1, 8);
const cableShape = new THREE.CylinderGeometry(0.16, 0.16, 1, 5);
const tubeGlass = new THREE.MeshPhongMaterial({ color: 0xa8e8f8, transparent: true, opacity: 0.55, shininess: 90 });
const cablePaint = paint(0x26323a);

// Take every base piece out of the sea and put them all back in, from the saved list.
// (We do this whenever you build or pack up a piece.)
function rebuildBase() {
  for (const m of mods) scene.remove(m.group);
  mods.length = 0;
  while (tubes.children.length) tubes.remove(tubes.children[0]);

  for (const data of state.mods) {
    const group = makeModule(data.kind);
    const y = groundAt(data.x, data.z);
    group.position.set(data.x, y, data.z);
    group.rotation.y = data.turn || 0;
    scene.add(group);
    mods.push({ id: data.id, kind: data.kind, x: data.x, y: y, z: data.z, base: data.base, info: MODULES[data.kind], group: group, on: true, timer: 0, cool: 0 });
  }

  // Work out which pieces have power
  for (const d of docks()) {
    const power = basePower(d.id);
    for (const m of mods) {
      if (m.base !== d.id) continue;
      m.on = !m.info.uses || power.made >= power.used;
      lightModule(m.group, m.on);
    }
  }

  // Join each piece to its base with a glass tube (or a cable, for machines)
  mods.forEach(function (m, i) {
    if (m.kind === "dock" || m.kind === "lamp") return;
    let best = m.base === 0 ? { x: LIFT.x, y: liftY, z: LIFT.z } : mods.find(function (o) { return o.id === m.base; });
    if (!best) return;
    for (let k = 0; k < i; k++) {
      const o = mods[k];
      if (o.base !== m.base || o.kind === "lamp" || o.kind === "dock") continue;
      if (Math.hypot(o.x - m.x, o.z - m.z) < Math.hypot(best.x - m.x, best.z - m.z)) best = o;
    }
    const fat = m.kind === "workshop" || m.kind === "silo" || m.kind === "dome";
    const rod = new THREE.Mesh(fat ? tubeShape : cableShape, fat ? tubeGlass : cablePaint);
    stretch(rod, new THREE.Vector3(m.x, m.y + (fat ? 1.4 : 0.4), m.z), new THREE.Vector3(best.x, best.y + (fat ? 1.4 : 0.4), best.z));
    tubes.add(rod);
  });
}

// Where would the piece you are holding go, and is that allowed?
function buildSpot() {
  const info = MODULES[placing];
  const x = sub.x - Math.sin(sub.yaw) * (info.r + 9);
  const z = sub.z - Math.cos(sub.yaw) * (info.r + 9);
  const y = groundAt(x, z);
  const home = nearestDock(x, z, 60);
  let why = "";
  if (!canPay(info.cost)) why = "You need " + costText(info.cost);
  else if (Math.hypot(x, z) > 468) why = "Too close to the crater wall";
  else if (placing === "dock" && nearestDock(x, z, 90)) why = "Too close to another dock (go 90 m away)";
  else if (placing !== "dock" && !home) why = "Build it within 60 m of a dock or the Lift";
  else if (Math.hypot(x - LIFT.x, z - LIFT.z) < 13 + info.r) why = "Too close to the Lift";
  else if (mods.some(function (m) { return Math.hypot(m.x - x, m.z - z) < m.info.r + info.r + 1.5; })) why = "Too close to another piece";
  else if (Math.abs(groundAt(x + 3, z) - groundAt(x - 3, z)) > 5 || Math.abs(groundAt(x, z + 3) - groundAt(x, z - 3)) > 5) why = "Too steep here";
  else if (sub.y - y > 40) why = "Go down closer to the sea bed";
  return { x: x, y: y, z: z, why: why, base: home ? home.id : 0 };
}

function startPlacing(kind) {
  cancelPlacing();
  placing = kind;
  ghost = makeModule(kind);
  const ring = new THREE.Mesh(new THREE.RingGeometry(MODULES[kind].r, MODULES[kind].r + 0.6, 24), new THREE.MeshBasicMaterial({ color: 0x6dff8e, side: THREE.DoubleSide, fog: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.6;
  ghost.add(ring);
  ghost.userData.ring = ring;
  scene.add(ghost);
}

function cancelPlacing() {
  if (ghost) scene.remove(ghost);
  ghost = null;
  placing = null;
}

// Put the piece down
function placePart() {
  if (!placing) return false;
  const spot = buildSpot();
  if (spot.why) {
    say(spot.why, 3);
    return false;
  }
  const kind = placing;
  pay(MODULES[kind].cost);
  const id = state.nextId++;
  state.mods.push({ id: id, kind: kind, x: spot.x, z: spot.z, base: kind === "dock" ? id : spot.base, turn: sub.yaw });
  cancelPlacing();
  rebuildBase();
  soundBuild();
  const made = mods[mods.length - 1];
  if (made.info.uses && !made.on) say(made.info.name + " built, but this base needs more power. Build a turbine!", 5);
  else say(made.info.name + " built!", 3);
  setGoal();
  save();
  return true;
}

// The base piece close enough to pack up
function packTarget() {
  let best = null;
  for (const m of mods) {
    const far = Math.hypot(m.x - sub.x, m.z - sub.z);
    if (far < m.info.r + 10 && sub.y - m.y < 30 && (!best || far < Math.hypot(best.x - sub.x, best.z - sub.z))) best = m;
  }
  return best;
}

// Pack a base piece up again. You get back everything it cost.
function packUp() {
  const m = packTarget();
  if (!m) {
    say("Go close to one of your base pieces to pack it up", 3);
    return false;
  }
  if (m.kind === "dock" && mods.some(function (o) { return o.base === m.id && o !== m; })) {
    say("Pack up the other pieces of this base first", 3);
    return false;
  }
  for (const kind in m.info.cost) state.bank[kind] = (state.bank[kind] || 0) + m.info.cost[kind];
  state.mods = state.mods.filter(function (data) { return data.id !== m.id; });
  if (state.home === m.id) state.home = 0;
  rebuildBase();
  soundBuild();
  say(m.info.name + " packed up. Its parts are in your store room.", 3);
  save();
  return true;
}

// What your base does by itself, every frame
function updateBase(dt, now) {
  for (const m of mods) {
    if (!m.on) continue;
    if (m.kind === "rig") {
      m.timer += dt;
      if (m.timer > 40) {
        m.timer = 0;
        const kind = RIG_DIGS[layerAt(m.x, m.z).id];
        if ((state.bank[kind] || 0) < bankCap()) {
          state.bank[kind] = (state.bank[kind] || 0) + 1;
          if (Math.hypot(m.x - sub.x, m.z - sub.z) < 90) say("Your mining rig dug up 1 " + ORES[kind].name, 2);
        }
      }
    } else if (m.kind === "shock" && now > m.cool) {
      for (const g of giants) {
        if (g.mood === "sleep" || Math.hypot(g.x - m.x, g.z - m.z) > 60) continue;
        g.stunned = now + 5;
        g.rest = now + 14;
        m.cool = now + 4;
        zap(new THREE.Vector3(m.x, m.y + 10.8, m.z), g);
      }
    } else if (m.kind === "sonar") {
      for (const g of giants) {
        if (Math.hypot(g.x - m.x, g.z - m.z) < 190) g.shown = Math.max(g.shown, now + 1);
      }
    }
  }
}

// A flash of lightning from a spot to a leviathan
function zap(from, g) {
  stretch(bolt, from, new THREE.Vector3(g.x, g.y, g.z));
  bolt.visible = true;
  boltUntil = wall + 0.3;
  soundZap();
}

// ===== 5. Parking at a dock =====
function park(d) {
  dockedAt = d;
  mode = "dock";
  sub.x = d.x;
  sub.y = d.y;
  sub.z = d.z;
  sub.vx = sub.vy = sub.vz = 0;
  sub.pitch = 0;
  cancelPlacing();
  // Unload the cargo bay into the store room (as much as fits)
  const cap = bankCap();
  for (const kind in state.cargo) {
    const move = Math.min(Math.max(0, cap - (state.bank[kind] || 0)), state.cargo[kind]);
    state.bank[kind] = (state.bank[kind] || 0) + move;
    state.cargo[kind] -= move;
  }
  refill();
  state.home = d.id;
  if (document.exitPointerLock) document.exitPointerLock();
  save();
  soundDock();
  drawDock();
  el("dock").hidden = false;
}

// Fix the hull, charge the battery and load new decoys
function refill() {
  state.hp = level("hull").hp;
  state.energy = level("battery").energy;
  state.decoys = level("decoy").decoys;
}

function launch() {
  if (mode !== "dock") return;
  mode = "play";
  dockedAt = null;
  el("dock").hidden = true;
  safeUntil = state.time + 3;
  setGoal();
}

// Fill in the panel you see while parked
function drawDock() {
  const cap = bankCap();
  let html = '<p class="small">Hull fixed. Battery full. Game saved.</p>';
  html += "<h2>Store room</h2><div class=\"chips\">";
  for (const kind in ORES) {
    html += '<span class="chip"><i style="background:#' + ORES[kind].colour.toString(16).padStart(6, "0") + '"></i>' + ORES[kind].name + ": " + (state.bank[kind] || 0) + "/" + cap + "</span>";
  }
  html += "</div>";
  if (countOf(state.cargo) > 0) html += '<p class="small">The store room is full of some things, so they are still in your cargo bay. A cargo silo makes more room.</p>';

  const power = basePower(dockedAt.id);
  const pieces = mods.filter(function (m) { return m.base === dockedAt.id && m.kind !== "dock"; }).length;
  html += "<h2>This base</h2>";
  html += '<p class="small">' + pieces + " pieces. Power: makes " + power.made + ", uses " + power.used + "." + (power.used > power.made ? " NOT ENOUGH POWER: build a turbine here." : "") + "<br>Launch and press B to build more.</p>";

  html += "<h2>Workshop</h2>";
  if (!workshopReady()) {
    html += '<p class="small">You need a workshop with power to make your sub better. Launch, press B, and build a turbine and a workshop near a dock.</p>';
  } else {
    let any = false;
    for (const id in UPGRADES) {
      const next = UPGRADES[id].levels[state.up[id] + 1];
      if (!next) continue;
      any = true;
      html += '<button data-up="' + id + '"' + (canPay(next.cost) ? "" : " disabled") + "><b>" + UPGRADES[id].name + " Mk" + (state.up[id] + 2) + "</b>: " + next.what + "<br>" + costText(next.cost, true) + "</button>";
    }
    if (!any) html += '<p class="small">Your sub is as good as it can be!</p>';
  }
  el("dock-title").textContent = dockedAt.id === 0 ? "Parked at the Lift" : "Parked at your dock";
  el("dock-body").innerHTML = html;
}

function buy(id) {
  const next = UPGRADES[id].levels[state.up[id] + 1];
  if (!next || !workshopReady() || !canPay(next.cost)) return false;
  pay(next.cost);
  state.up[id]++;
  refill();
  soundBuild();
  say(UPGRADES[id].name + " Mk" + (state.up[id] + 1) + " fitted!", 3);
  save();
  if (mode === "dock") drawDock();
  return true;
}

// ===== 6. The build list =====
function openBuild() {
  cancelPlacing();
  mode = "menu";
  if (document.exitPointerLock) document.exitPointerLock();
  let html = "";
  let n = 1;
  for (const kind in MODULES) {
    const info = MODULES[kind];
    html += '<button data-kind="' + kind + '"><b>' + n++ + ". " + info.name + "</b>: " + info.what + "<br>" + costText(info.cost, true) + "</button>";
  }
  el("parts").innerHTML = html;
  el("build").hidden = false;
}

function closeBuild() {
  el("build").hidden = true;
  mode = "play";
}

function chooseBuild(kind) {
  closeBuild();
  startPlacing(kind);
}

// ===== 7. Tools: sonar, decoys and the shock pulse =====
function ping() {
  if (state.time < pingUntil - 7) return;
  pingUntil = state.time + 9;
  state.energy = Math.max(0, state.energy - 2);
  for (const g of giants) {
    if (g.far < 240) g.shown = Math.max(g.shown, state.time + 9);
  }
  soundPing();
}

function dropDecoy() {
  if (!level("decoy").decoys) return say("You have no decoy launcher yet. A workshop can make one.", 3);
  if (state.decoys <= 0) return say("No decoys left. Park at a dock to get more.", 3);
  state.decoys--;
  const f = forward();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff08a, fog: false }));
  mesh.add(glow(0xffe46a, 14));
  scene.add(mesh);
  decoys.push({ x: sub.x + f.x * 4, y: sub.y + f.y * 4, z: sub.z + f.z * 4, vx: sub.vx + f.x * 24, vy: sub.vy + f.y * 24, vz: sub.vz + f.z * 24, until: state.time + 14, mesh: mesh });
  soundGot();
}

function shockPulse() {
  if (!level("pulse").pulse) return say("You have no shock pulse yet. A workshop can make one.", 3);
  if (state.time < pulseAt + 8) return say("The shock pulse is still charging", 2);
  if (state.energy < 30) return say("Not enough battery for a shock pulse", 2);
  state.energy -= 30;
  pulseAt = state.time;
  for (const g of giants) {
    if (g.far > 55 || g.mood === "sleep") continue;
    g.stunned = state.time + 6;
    g.rest = state.time + 12;
  }
  soundZap();
}

// ===== 8. Getting hurt =====
// "giant" is the leviathan that did it (or nothing, if it was the deep water)
function hurt(amount, giant) {
  if (mode !== "play") return;
  state.hp -= amount;
  flash = 0.5;
  shake = 0.5;
  soundHit();
  if (giant) {
    // Knocked away
    const far = Math.max(1, giant.far);
    sub.vx += (sub.x - giant.x) / far * 16;
    sub.vy += (sub.y - giant.y) / far * 8 + 3;
    sub.vz += (sub.z - giant.z) / far * 16;
  }
  if (state.hp <= 0) sink(giant ? giant.info.name + " broke your hull!" : "The deep water crushed your hull!");
}

// The hull broke: lose the cargo and float back to the last dock
function sink(why) {
  const lost = countOf(state.cargo);
  state.cargo = {};
  const d = dockById(state.home);
  sub.x = d.x;
  sub.y = d.y;
  sub.z = d.z;
  sub.vx = sub.vy = sub.vz = 0;
  sub.pitch = 0;
  refill();
  resetGiants();
  cancelPlacing();
  safeUntil = state.time + 4;
  save();
  showCard(why + "\n\nThe sub's safety bubble floated you back to " + (d.id === 0 ? "the Lift" : "your dock") + "." + (lost ? "\nYou lost the " + lost + " things in your cargo bay." : ""));
}

// ===== 9. Drilling and grabbing =====
// Find the thing that is close enough to use
function findNear() {
  if (placing) return null;
  for (const d of docks()) {
    if (Math.hypot(sub.x - d.x, sub.z - d.z) < 9 && Math.abs(sub.y - d.y) < 9) {
      const finish = d.id === 0 && state.cores.length === 4 && !state.won;
      return { type: "dock", dock: d, text: finish ? "E: put the four power cores into the Lift" : "E: park at " + (d.id === 0 ? "the Lift" : "your dock") };
    }
  }
  for (const core of cores) {
    if (!state.cores.includes(core.kind) && Math.hypot(sub.x - core.x, sub.y - core.y, sub.z - core.z) < 11) {
      return { type: "core", core: core, text: "Hold E: grab the power core" };
    }
  }
  let best = null;
  let bestFar = 10;
  for (const node of nodes) {
    if (node.back) continue;
    const far = Math.hypot(sub.x - node.x, sub.y - node.y, sub.z - node.z);
    if (far < bestFar) {
      best = node;
      bestFar = far;
    }
  }
  if (best) return { type: "node", node: best, text: "Hold E: drill " + ORES[best.kind].name };
  const m = packTarget();
  if (m) return { type: "mod", mod: m, text: m.info.name + (m.info.uses && !m.on ? " (no power)" : "") + " · X: pack it up" };
  return null;
}

const beamFrom = new THREE.Vector3();
const beamTo = new THREE.Vector3();

// Holding E on a lump or a core fills a bar. When it is full, you get the thing.
function holdE(dt) {
  const job = keys.KeyE && near && (near.type === "node" || near.type === "core") ? near : null;
  if (!job) {
    holdTime = 0;
    holdFor = null;
    beam.visible = false;
    el("hold").hidden = true;
    return;
  }
  const target = job.node || job.core;
  if (holdFor !== target) {
    holdFor = target;
    holdTime = 0;
  }
  if (job.type === "node" && cargoRoom() <= 0) {
    say("Your cargo bay is full. Park at a dock to unload.", 2);
    beam.visible = false;
    el("hold").hidden = true;
    return;
  }
  const need = job.type === "core" ? 3 : level("drill").time;
  holdTime += dt * (state.energy > 1 ? 1 : 0.5);
  state.energy = Math.max(0, state.energy - 2 * dt);
  const f = forward();
  beamFrom.set(sub.x + f.x * 2.8, sub.y + f.y * 2.8 - 1.1, sub.z + f.z * 2.8);
  beamTo.set(target.x, target.y + (job.type === "node" ? 0.8 : 0), target.z);
  stretch(beam, beamFrom, beamTo);
  beam.visible = true;
  el("hold").hidden = false;
  el("hold-fill").style.width = Math.min(100, holdTime / need * 100) + "%";
  if (wall - lastTick > 0.14) {
    lastTick = wall;
    soundTick();
  }
  if (holdTime < need) return;
  holdTime = 0;
  if (job.type === "node") takeNode(job.node);
  else takeCore(job.core);
}

function takeNode(node) {
  const amount = Math.min(level("drill").gives, cargoRoom());
  state.cargo[node.kind] = (state.cargo[node.kind] || 0) + amount;
  node.back = state.time + 200;   // it grows back after a while
  showNode(node, false);
  soundGot();
  say("+" + amount + " " + ORES[node.kind].name, 1.5);
}

function takeCore(core) {
  state.cores.push(core.kind);
  core.group.visible = false;
  // Its guard is furious!
  const guard = giants.find(function (g) { return g.kind === core.kind; });
  guard.angry = state.time + 25;
  guard.rest = 0;
  sound(playJingle);
  setGoal();
  save();
  const left = 4 - state.cores.length;
  say(left ? "POWER CORE! " + left + " more to find. Now get out of here!" : "The last POWER CORE! Take them all back to the Lift!", 6);
}

// All four cores are back in the Lift: you win!
function win() {
  state.won = true;
  liftBeam.material.opacity = 0.4;
  sound(playJingle);
  save();
  setGoal();
  const minutes = Math.round(state.time / 60);
  el("won-text").textContent = "The four power cores click into place. Light races up the shaft, the ice above you glows, and the Lift hums back to life. You crossed the whole crater, slipped past four leviathans and built " + mods.length + " base pieces, in " + minutes + " minutes of diving. The way home is open, and the sea under the ice is yours.";
  el("won").hidden = false;
  mode = "won";
  if (document.exitPointerLock) document.exitPointerLock();
}

// ===== 10. Driving the sub =====
function drive(dt) {
  const turn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  sub.yaw += turn * 1.7 * dt;
  const tip = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
  sub.pitch += tip * 1.1 * dt;
  // Without the mouse, the nose slowly comes back level by itself
  if (!tip && !locked) sub.pitch *= Math.exp(-1.2 * dt);
  sub.pitch = clamp(sub.pitch, -1.1, 1.1);

  const push = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 0.6 : 0);
  const rise = (keys.Space ? 1 : 0) - (keys.KeyC ? 1 : 0);
  let speed = level("engine").speed;
  const boosting = (keys.ShiftLeft || keys.ShiftRight) && push > 0 && state.energy > 1;
  if (boosting) {
    speed *= 1.7;
    state.energy = Math.max(0, state.energy - 5 * dt);
  } else {
    // The battery slowly charges itself from the sea current
    state.energy = Math.min(level("battery").energy, state.energy + 0.8 * dt);
  }
  // How hard the engine pushes. (Water drags the sub back, so it settles at "speed".)
  const power = speed * 1.6;
  const f = forward();
  sub.vx += f.x * push * power * dt;
  sub.vy += (f.y * push + rise * 0.75) * power * dt;
  sub.vz += f.z * push * power * dt;
  const drag = Math.exp(-1.6 * dt);
  sub.vx *= drag;
  sub.vy *= drag;
  sub.vz *= drag;
  sub.x += sub.vx * dt;
  sub.y += sub.vy * dt;
  sub.z += sub.vz * dt;
  if (push > 0 && Math.random() < (boosting ? 0.9 : 0.4)) puff(sub.x - f.x * 3.4, sub.y - f.y * 3.4, sub.z - f.z * 3.4);
}

// Keep the sub out of solid things
function collide() {
  // The crater wall
  const r = Math.hypot(sub.x, sub.z);
  if (r > 500) {
    sub.x *= 500 / r;
    sub.z *= 500 / r;
  }
  // The sea bed and the ice
  const floor = groundAt(sub.x, sub.z) + 2;
  if (sub.y < floor) {
    sub.y = floor;
    if (sub.vy < 0) sub.vy = 0;
  }
  if (sub.y > ICE - 1.5) {
    sub.y = ICE - 1.5;
    if (sub.vy > 0) sub.vy = 0;
  }
  // Rocks, stalks, arches and chimneys
  for (const w of walls) {
    if (sub.y > w.top + 1.5) continue;
    pushOut(w.x, w.z, w.r + 1.8);
  }
  // Your own base
  for (const m of mods) {
    if (m.kind === "dock" || sub.y > m.y + m.info.tall + 1.5) continue;
    pushOut(m.x, m.z, m.info.r + 1.6);
  }
}

function pushOut(x, z, gap) {
  const dx = sub.x - x;
  const dz = sub.z - z;
  const far = Math.hypot(dx, dz);
  if (far >= gap || far < 0.001) return;
  sub.x = x + dx / far * gap;
  sub.z = z + dz / far * gap;
}

// ===== 11. One step of the game =====
function play(dt) {
  const now = state.time;
  drive(dt);
  collide();
  near = findNear();
  holdE(dt);

  // Too deep for the hull?
  const depth = -sub.y;
  if (depth > level("hull").limit) {
    state.hp -= 7 * dt;
    flash = 0.3;
    if (state.hp <= 0) sink("The deep water crushed your hull!");
  }

  updateGiants(dt, now);
  updateBase(dt, now);

  // Drilled lumps grow back
  for (const node of nodes) {
    if (node.back && now > node.back) {
      node.back = 0;
      showNode(node, true);
    }
  }

  // Tell you when you cross into a new layer
  const layer = layerAt(sub.x, sub.z);
  if (layer.id !== lastLayer) {
    if (lastLayer) say(layer.name + (layer.deep > level("hull").limit ? ": too deep for your hull! Make it stronger first." : ""), 4);
    lastLayer = layer.id;
  }

  if (now - lastSave > 15) save();
}

// ===== 12. Drawing =====
const strings = {};
// Only touch the page when the words have really changed (that is faster)
function setText(id, text) {
  if (strings[id] === text) return;
  strings[id] = text;
  el(id).innerHTML = text;
}

function drawHud() {
  const hull = level("hull");
  const depth = Math.max(0, Math.round(-sub.y));
  el("hull-fill").style.width = clamp(state.hp / hull.hp * 100, 0, 100) + "%";
  el("energy-fill").style.width = clamp(state.energy / level("battery").energy * 100, 0, 100) + "%";
  setText("hull-text", "Hull " + Math.max(0, Math.ceil(state.hp)));
  setText("energy-text", "Battery " + Math.ceil(state.energy));
  setText("where", layerAt(sub.x, sub.z).name + " · " + depth + " m deep · hull safe to " + hull.limit + " m");
  setText("tally", "Power cores " + state.cores.length + "/4<br>Cargo " + countOf(state.cargo) + "/" + level("cargo").holds);
  let gear = "L Lights " + (sub.lights ? "ON" : "off") + " · Q Sonar";
  if (level("decoy").decoys) gear += " · G Decoys " + state.decoys;
  if (level("pulse").pulse) gear += " · R Pulse " + (state.time < pulseAt + 8 ? "charging" : "ready");
  setText("gear", gear + "<br>B Build · X Pack up · M Map");

  // Warnings
  let warn = "";
  if (mode === "play") {
    if (depth > hull.limit) warn = "TOO DEEP! THE HULL IS CRACKING! GO UP!";
    else if (depth > hull.limit - 12) warn = "Careful: almost too deep for your hull";
    else if (state.hp < hull.hp * 0.3) warn = "Hull is weak! Park at a dock to fix it";
  }
  setText("warn", warn);
  el("warn").hidden = !warn;
  if (warn && wall - lastTick > 0.6 && depth > hull.limit) {
    lastTick = wall;
    soundAlarm();
  }

  // The hint at the bottom
  let hint = "";
  if (mode === "play") {
    if (placing) {
      const spot = buildSpot();
      hint = spot.why ? spot.why + " · Esc: stop building" : "E or click: build the " + MODULES[placing].name + " here · Esc: stop";
    } else if (near) {
      hint = near.text;
    }
  }
  setText("hint", hint);
  el("hint").hidden = !hint;
  if (!el("toast").hidden && wall > toastUntil) el("toast").hidden = true;
  el("tint").style.boxShadow = flash > 0 ? "inset 0 0 " + Math.round(flash * 160) + "px rgba(255,40,30,0.8)" : "none";
}

// The radar: a round screen that shows what is around you. Up is the way you are facing.
const radarPen = el("radar").getContext("2d");
function drawRadar() {
  const pen = radarPen;
  const mid = 75;
  const size = 68;
  const range = 150;
  pen.clearRect(0, 0, 150, 150);
  pen.fillStyle = "rgba(2,26,36,0.72)";
  pen.beginPath();
  pen.arc(mid, mid, size, 0, Math.PI * 2);
  pen.fill();
  pen.strokeStyle = "rgba(120,255,230,0.35)";
  pen.lineWidth = 1;
  for (const ring of [size, size / 2]) {
    pen.beginPath();
    pen.arc(mid, mid, ring, 0, Math.PI * 2);
    pen.stroke();
  }
  // The ring of a sonar ping spreading out
  const pinging = state.time < pingUntil;
  const age = 9 - (pingUntil - state.time);
  if (pinging && age < 1.2) {
    pen.strokeStyle = "rgba(160,255,240,0.9)";
    pen.lineWidth = 2;
    pen.beginPath();
    pen.arc(mid, mid, size * age / 1.2, 0, Math.PI * 2);
    pen.stroke();
  }
  const fx = -Math.sin(sub.yaw);
  const fz = -Math.cos(sub.yaw);
  // Draw one dot. "pin" dots stick to the edge when they are far away, to show the way.
  function dot(x, z, colour, big, pin) {
    const dx = x - sub.x;
    const dz = z - sub.z;
    let u = (dx * -fz + dz * fx) / range;
    let v = (dx * fx + dz * fz) / range;
    const far = Math.hypot(u, v);
    if (far > 0.94) {
      if (!pin) return;
      u *= 0.94 / far;
      v *= 0.94 / far;
    }
    pen.fillStyle = colour;
    pen.beginPath();
    pen.arc(mid + u * size, mid - v * size, big, 0, Math.PI * 2);
    pen.fill();
  }
  if (pinging) {
    for (const node of nodes) {
      if (!node.back) dot(node.x, node.z, "#" + ORES[node.kind].colour.toString(16).padStart(6, "0"), 1.8, false);
    }
  }
  for (const m of mods) dot(m.x, m.z, m.kind === "dock" ? "#6fe8ff" : "rgba(111,232,255,0.6)", m.kind === "dock" ? 4 : 2, m.kind === "dock");
  dot(LIFT.x, LIFT.z, "#ffc94a", 4.5, true);
  for (const core of cores) {
    if (!state.cores.includes(core.kind)) dot(core.x, core.z, "#ff6ad8", 3.5, true);
  }
  for (const g of giants) {
    if (g.shown > state.time) dot(g.x, g.z, wall % 0.5 < 0.25 ? "#ff3a2a" : "#ffb0a0", 6, false);
  }
  // You, in the middle
  pen.fillStyle = "#ffffff";
  pen.beginPath();
  pen.moveTo(mid, mid - 6);
  pen.lineTo(mid + 4, mid + 5);
  pen.lineTo(mid - 4, mid + 5);
  pen.fill();
}

// The big map of the whole crater (M)
function drawMap() {
  const pen = el("chart").getContext("2d");
  const mid = 220;
  const scale = 212 / 490;
  pen.clearRect(0, 0, 440, 440);
  LAYERS.forEach(function (layer, i) {
    const outer = i === 0 ? 490 : LAYERS[i - 1].from;
    pen.fillStyle = "#" + layer.ground.toString(16).padStart(6, "0");
    pen.beginPath();
    pen.arc(mid, mid, outer * scale, 0, Math.PI * 2);
    pen.fill();
  });
  pen.font = "9px monospace";
  pen.textAlign = "center";
  LAYERS.forEach(function (layer, i) {
    const outer = i === 0 ? 490 : LAYERS[i - 1].from;
    pen.fillStyle = i === 0 ? "#12303c" : "#eafcff";
    pen.fillText(layer.name, mid, mid - ((outer + layer.from) / 2) * scale + 3);
  });
  function mark(x, z, colour, big) {
    pen.fillStyle = colour;
    pen.beginPath();
    pen.arc(mid + x * scale, mid + z * scale, big, 0, Math.PI * 2);
    pen.fill();
    pen.strokeStyle = "#000";
    pen.lineWidth = 1;
    pen.stroke();
  }
  for (const m of mods) {
    if (m.kind === "dock") mark(m.x, m.z, "#6fe8ff", 5);
  }
  mark(LIFT.x, LIFT.z, "#ffc94a", 6);
  for (const core of cores) {
    if (!state.cores.includes(core.kind)) mark(core.x, core.z, "#ff6ad8", 5);
  }
  for (const g of giants) {
    if (g.shown > state.time) mark(g.x, g.z, "#ff3a2a", 7);
  }
  // You: a white arrow pointing the way you face
  pen.save();
  pen.translate(mid + sub.x * scale, mid + sub.z * scale);
  pen.rotate(-sub.yaw);
  pen.fillStyle = "#ffffff";
  pen.strokeStyle = "#000";
  pen.beginPath();
  pen.moveTo(0, -9);
  pen.lineTo(6, 7);
  pen.lineTo(-6, 7);
  pen.closePath();
  pen.fill();
  pen.stroke();
  pen.restore();
}

function openMap() {
  mapFrom = mode;
  mode = "map";
  if (document.exitPointerLock) document.exitPointerLock();
  drawMap();
  el("map").hidden = false;
}

function closeMap() {
  el("map").hidden = true;
  mode = mapFrom;
}

const waterColour = new THREE.Color();

// Move the models and the camera, and set the colour of the water
function draw(dt) {
  wall += dt;
  flash = Math.max(0, flash - dt);
  shake = Math.max(0, shake - dt);
  const f = forward();

  // The sub
  subModel.position.set(sub.x, sub.y, sub.z);
  subModel.rotation.set(sub.pitch, sub.yaw, clamp(-(keys.KeyA ? 1 : 0) + (keys.KeyD ? 1 : 0), -1, 1) * (mode === "play" ? 0.18 : 0));
  propeller.rotation.z += dt * (4 + Math.hypot(sub.vx, sub.vy, sub.vz) * 1.5);
  // The headlights look brighter the darker the water is
  headlight.intensity = sub.lights ? 0.5 + 1.4 * clamp(-sub.y / 150, 0, 1) : 0;
  lampPaint.color.setHex(sub.lights ? 0xfff4c8 : 0x3a3a34);

  // The camera follows behind the sub. While you are parked, it circles slowly around.
  let cx;
  let cy;
  let cz;
  if (mode === "play" || mode === "menu" || mode === "map" && mapFrom === "play") {
    cx = sub.x - f.x * 12;
    cy = sub.y - f.y * 12 + 4.2;
    cz = sub.z - f.z * 12;
  } else {
    cx = sub.x + Math.cos(wall * 0.12) * 20;
    cy = sub.y + 6;
    cz = sub.z + Math.sin(wall * 0.12) * 20;
  }
  const ease = 1 - Math.exp(-7 * dt);
  camera.position.x += (cx - camera.position.x) * ease;
  camera.position.y += (cy - camera.position.y) * ease;
  camera.position.z += (cz - camera.position.z) * ease;
  camera.position.y = clamp(camera.position.y, groundAt(camera.position.x, camera.position.z) + 1.2, -1);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  if (mode === "dock") {
    // The panel covers the left of the picture, so look a little to one side: the sub shows on the right
    camera.lookAt(sub.x - Math.sin(wall * 0.12) * 8, sub.y, sub.z + Math.cos(wall * 0.12) * 8);
  } else {
    camera.lookAt(sub.x + f.x * 8, sub.y + f.y * 8 + 0.8, sub.z + f.z * 8);
  }

  // Deeper water is darker and a different colour
  const depth = -camera.position.y;
  blend(WATER, depth, waterColour);
  scene.fog.color.copy(waterColour);
  scene.fog.far = 230 - 110 * clamp(depth / 380, 0, 1);
  renderer.setClearColor(waterColour);
  skyLight.intensity = 0.8 - 0.55 * clamp(depth / 300, 0, 1);
  sunLight.intensity = 0.45 * (1 - clamp(depth / 200, 0, 1));

  moveScenery(dt, wall, camera.position.x, camera.position.y, camera.position.z);

  // Base pieces that move
  for (const m of mods) {
    const parts = m.group.userData;
    if (parts.spin) parts.spin.rotation.z += dt * 2.5;
    if (parts.turn && m.on) parts.turn.rotation.y += dt * 1.2;
    if (parts.pump) parts.pump.position.y = 2.8 + (m.on ? Math.sin(wall * 4) * 0.8 : 0);
  }

  // The piece you are about to build follows the nose of the sub
  if (ghost) {
    const spot = buildSpot();
    ghost.position.set(spot.x, spot.y, spot.z);
    ghost.rotation.y = sub.yaw;
    ghost.userData.ring.material.color.setHex(spot.why ? 0xff5a4a : 0x6dff8e);
  }

  // Flashes
  if (bolt.visible && wall > boltUntil) bolt.visible = false;
  const pulseAge = state.time - pulseAt;
  pulseRing.visible = pulseAge >= 0 && pulseAge < 0.7;
  if (pulseRing.visible) {
    pulseRing.position.set(sub.x, sub.y, sub.z);
    pulseRing.scale.setScalar(2 + pulseAge * 75);
    pulseRing.material.opacity = 0.35 * (1 - pulseAge / 0.7);
  }

  drawHud();
  drawRadar();
}

// ===== 13. Saving =====
function save() {
  lastSave = state.time;
  state.at = { x: sub.x, y: sub.y, z: sub.z, yaw: sub.yaw };
  state.met = giants.filter(function (g) { return g.met; }).map(function (g) { return g.kind; });
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

// Start playing: a new game, or carry on a saved one
function begin(saved) {
  state = freshState();
  if (saved) {
    for (const key in saved) state[key] = saved[key];
    const blank = freshState();
    for (const id in blank.up) {
      if (state.up[id] === undefined) state.up[id] = 0;
    }
  }
  cancelPlacing();
  rebuildBase();
  resetGiants();
  for (const g of giants) g.met = state.met.includes(g.kind);
  for (const node of nodes) {
    node.back = 0;
    showNode(node, true);
  }
  for (const core of cores) core.group.visible = !state.cores.includes(core.kind);
  for (const decoy of decoys) scene.remove(decoy.mesh);
  decoys.length = 0;
  liftBeam.material.opacity = state.won ? 0.4 : 0.07;

  const d = dockById(state.home);
  const at = saved && state.at ? state.at : { x: d.x, y: d.y, z: d.z, yaw: 0 };
  sub.x = at.x;
  sub.y = at.y;
  sub.z = at.z;
  sub.yaw = at.yaw;
  sub.pitch = sub.vx = sub.vy = sub.vz = 0;
  sub.lights = true;
  camera.position.set(sub.x, sub.y + 4, sub.z + 14);
  lastLayer = "";
  pingUntil = 0;
  pulseAt = -99;
  safeUntil = state.time + 3;
  lastSave = state.time;

  for (const id of ["intro", "dock", "build", "map", "card", "won"]) el(id).hidden = true;
  mode = "play";
  setGoal();
  if (!saved && !testing) {
    showCard("Pilot's log, the Lantern.\n\nThe Lift has lost its four power cores, and without them nobody goes home. My radar hears all four, far down in the crater.\n\nSomething very big is moving down there too.");
  }
}

// ===== 14. Keys, mouse and buttons =====
window.addEventListener("keydown", function (e) {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;

  if (mode === "card") {
    if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") closeCard();
    return;
  }
  if (mode === "dock") {
    if (e.code === "KeyE" || e.code === "Escape") launch();
    else if (e.code === "KeyM") openMap();
    return;
  }
  if (mode === "map") {
    if (e.code === "KeyM" || e.code === "Escape") closeMap();
    return;
  }
  if (mode === "menu") {
    const pick = Object.keys(MODULES)[Number(e.code.replace("Digit", "")) - 1];
    if (e.code === "KeyB" || e.code === "Escape") closeBuild();
    else if (pick) chooseBuild(pick);
    return;
  }
  if (mode !== "play") return;

  if (e.code === "KeyE") pressE();
  else if (e.code === "KeyB") openBuild();
  else if (e.code === "Escape") cancelPlacing();
  else if (e.code === "KeyX") packUp();
  else if (e.code === "KeyL") sub.lights = !sub.lights;
  else if (e.code === "KeyQ") ping();
  else if (e.code === "KeyG") dropDecoy();
  else if (e.code === "KeyR") shockPulse();
  else if (e.code === "KeyM") openMap();
});

window.addEventListener("keyup", function (e) {
  keys[e.code] = false;
});

window.addEventListener("blur", function () {
  for (const code in keys) keys[code] = false;
});

// Pressing E once: build, park, or finish the game
function pressE() {
  if (placing) return placePart();
  if (near && near.type === "dock") {
    if (near.dock.id === 0 && state.cores.length === 4 && !state.won) return win();
    park(near.dock);
  }
}

// Click the game to steer with the mouse
canvas.addEventListener("click", function () {
  if (mode !== "play") return;
  if (placing) placePart();
  else if (canvas.requestPointerLock) canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", function () {
  locked = document.pointerLockElement === canvas;
});

document.addEventListener("mousemove", function (e) {
  if (!locked || mode !== "play") return;
  sub.yaw -= e.movementX * 0.0025;
  sub.pitch = clamp(sub.pitch - e.movementY * 0.002, -1.1, 1.1);
});

el("card").addEventListener("click", closeCard);
el("launch").addEventListener("click", launch);
el("build-close").addEventListener("click", closeBuild);
el("map-close").addEventListener("click", closeMap);
el("won-close").addEventListener("click", function () {
  el("won").hidden = true;
  mode = "play";
});
el("parts").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (button) chooseBuild(button.dataset.kind);
});
el("dock-body").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (button) buy(button.dataset.up);
});
el("start").addEventListener("click", function () {
  begin(null);
});
el("continue").addEventListener("click", function () {
  begin(load());
});

// ===== 15. Go! =====
makeGiants();
rebuildBase();
el("continue").hidden = !load();

let lastTime = 0;
let frameCount = 0;
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ms - lastTime) / 1000 || 0.016);
  lastTime = ms;
  frameCount++;
  fit();
  if (mode === "play") {
    state.time += dt;
    play(dt);
  } else if (mode === "intro") {
    // Behind the title: the leviathans keep swimming
    for (const g of giants) poseGiant(g, wall);
  }
  draw(dt);
  renderer.render(scene, camera);
}

// For testing the game with a script: add ?test to the address
if (testing) {
  begin(null);
  window.TL = {
    sub: sub, keys: keys, giants: giants, nodes: nodes, cores: cores, mods: mods, decoys: decoys, walls: walls,
    state: function () { return state; },
    mode: function () { return mode; },
    near: function () { return near; },
    frames: function () { return frameCount; },
    begin: begin, save: save, load: load, park: park, launch: launch, buy: buy, pressE: pressE,
    startPlacing: startPlacing, placePart: placePart, buildSpot: buildSpot, packUp: packUp,
    ping: ping, dropDecoy: dropDecoy, shockPulse: shockPulse, hurt: hurt, win: win,
    openBuild: openBuild, openMap: openMap, closeMap: closeMap, docks: docks, basePower: basePower,
    workshopReady: workshopReady, level: level, takeCore: takeCore, takeNode: takeNode,
    // Run the game forward by n small steps, without waiting
    step: function (n) { for (let i = 0; i < n; i++) { if (mode !== "play") break; state.time += 0.05; play(0.05); } },
  };
}

requestAnimationFrame(frame);
