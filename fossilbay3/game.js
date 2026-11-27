// Fossil Bay 3: the game.
// You, on the ground: walking, building where you look, checking paddocks,
// the jobs you are given, the little map, and saving.

// ===== 1. What the game remembers =====
const SAVE = "fossilbay3-save";

function freshState() {
  const tiles = {};
  tiles[keyOf(GATE.i, GATE.k)] = "path";   // the gate square is always a path
  return {
    money: 2500,
    time: 0,
    tiles: tiles, pads: [], dinos: [],
    felled: [],                 // forest trees you have cleared
    stations: [], labs: {}, tech: {}, staff: { keeper: 0, ranger: 0, scientist: 0, guide: 0 },
    nextId: 1,
    stars: 0, best: 0, points: 0, scare: 0,
    arrived: 0, served: 0, escapes: 0, caught: 0,
    slept: 0,                   // how many wild dinosaurs you have put to sleep
    caughtFrom: {},             // the sections you have caught a dinosaur from
    darts: 12,
    goal: 0, nextGuest: 6, won: false,
    jeep: { x: 0, z: 0, yaw: 0 },
    at: null,                   // where you and the helicopter were when the game was saved
  };
}

let state = freshState();
const me = { x: mid(CAMP.i), z: mid(CAMP.k), yaw: 0, pitch: 0, stamina: 1, sneak: false, running: false, moving: false };
let mode = "intro";       // intro, play, menu, panel, card or won
let flying = false;       // are you in the helicopter?
let tool = null;          // what you are building (or nothing)
let corner = null;        // the first corner of a paddock you are marking out
let selected = null;      // the id of the paddock whose panel is open
let near = null;          // what E would do right now
let locked = false;
let shake = 0;
let wall = 0;
let safeUntil = 0;
let dartReady = 0;
let lastSave = 0;
let lastCheck = 0;
const keys = {};
const keptPads = {};      // (no keepers in this game, but the dinosaurs' code looks here)

function stormy() {
  return false;
}

// ===== 2. Sounds and messages =====
function sound(make) {
  try { make(); } catch (problem) { /* no sound is fine */ }
}
function soundBuild() { sound(function () { playNoise(0, 0.12, 500, 1400, 0.15); playTone(0.05, 0.15, 500, 760, 0.15); }); }
function soundNo() { sound(function () { playTone(0, 0.15, 220, 160, 0.15); }); }
function soundCash() { sound(function () { playTone(0, 0.08, 900, 1200, 0.12); playTone(0.08, 0.12, 1200, 1600, 0.12); }); }
function soundHatch() { soundCash(); }
function soundGrowl() { sound(function () { playNoise(0, 0.6, 300, 100, 0.3); playTone(0, 0.5, 140, 80, 0.25); }); }
function soundRoar() { sound(function () { playNoise(0, 1.3, 400, 60, 0.5); playTone(0, 1.1, 150, 45, 0.4); }); }
function soundDart() { sound(function () { playNoise(0, 0.15, 3000, 1500, 0.2); }); }

const el = function (id) { return document.getElementById(id); };
let toastUntil = 0;
function say(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastUntil = wall + (seconds || 3);
}

function attempt(why) {
  if (why) {
    say(why, 3);
    soundNo();
    return false;
  }
  soundBuild();
  save();
  return true;
}

let cardAfter = null;
function showCard(text, after) {
  mode = "card";
  cardAfter = after || null;
  el("card-text").textContent = text;
  el("card").hidden = false;
  if (document.exitPointerLock) document.exitPointerLock();
}

function closeCard() {
  el("card").hidden = true;
  mode = "play";
  const after = cardAfter;
  cardAfter = null;
  if (after) after();
}

// A hunter caught you: you wake up back at camp
function knockedOut(kind) {
  if (mode !== "play") return;
  soundRoar();
  shake = 1;
  showCard("The " + SPECIES[kind].name + " bowls you over!\n\nEverything goes dark... and you wake up back at your camp, a bit bruised.\n\nDart the meat-eaters before they get close, or creep past them (hold C).", function () {
    me.x = mid(CAMP.i);
    me.z = mid(CAMP.k);
    safeUntil = state.time + 4;
    for (const w of wilds) {
      if (w.mood === "hunt") w.mood = "roam";
    }
  });
}

// ===== 3. Jobs =====
function goalDone(n) {
  const kinds = new Set(state.dinos.map(function (d) { return d.kind; }));
  if (n === 0) return state.pads.length > 0;
  if (n === 1) return state.slept > 0;
  if (n === 2) return state.dinos.length > 0;
  if (n === 3) return state.pads.some(function (p) { return feedersIn(p, "plants").length || feedersIn(p, "meat").length || feedersIn(p, "fish").length; });
  if (n === 4) return state.pads.some(padSeen);
  if (n === 5) return state.arrived >= 10;
  if (n === 6) return !!state.caughtFrom.forest;
  if (n === 7) return kinds.size >= 4;
  if (n === 8) return state.dinos.some(function (d) { return SPECIES[d.kind].hunter; });
  if (n === 9) return Object.keys(state.caughtFrom).length >= 5;
  if (n === 10) return kinds.has("rex");
  return state.best >= 5;
}

function checkGoals() {
  while (state.goal < GOALS.length && goalDone(state.goal)) {
    const done = GOALS[state.goal];
    state.goal++;
    if (done.reward) {
      state.money += done.reward;
      soundCash();
      say("Job done! You earned $" + done.reward + ".", 4);
    }
  }
  if (state.goal >= GOALS.length && !state.won) {
    state.won = true;
    sound(playJingle);
    save();
    el("won-text").textContent = "Fossil Bay has five stars! You caught " + state.dinos.length + " dinosaurs with your own two hands (and one helicopter), from " + Object.keys(state.caughtFrom).length + " sections of the island, and welcomed " + state.arrived + " visitors. It took you " + Math.round(state.time / 60) + " minutes.";
    el("won").hidden = false;
    mode = "won";
    if (document.exitPointerLock) document.exitPointerLock();
  }
  el("goal").textContent = state.goal < GOALS.length ? "Job " + (state.goal + 1) + " of " + GOALS.length + ": " + GOALS[state.goal].text : "Fossil Bay is a five star park! Keep building it any way you like";
}

// ===== 4. Moving about on foot =====
// Is this spot open ground? (Not a building, not off the island.)
function free(x, z, gap) {
  if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1) {
    if (!(Math.abs(x - mid(GATE.i)) < 1.6 && z > 0 && z < HALF + 44)) return false;   // the pier
  }
  const ti = tileOf(x);
  const tk = tileOf(z);
  for (let i = ti - 1; i <= ti + 1; i++) {
    for (let k = tk - 1; k <= tk + 1; k++) {
      const type = typeAt(i, k);
      if (!type || TOOLS[type].walk || type === "flowers" || type === "bench" || type === "lamp") continue;
      const size = TOOLS[type].inside || type === "tree" ? 1 : 1.75;   // feeders and trees are small
      if (Math.abs(x - mid(i)) < size + gap && Math.abs(z - mid(k)) < size + gap) return false;
    }
  }
  return true;
}

function padOf(x, z) {
  const pad = padAt(tileOf(x), tileOf(z));
  return pad ? pad.id : 0;
}

// Fences are solid, except where a dinosaur has smashed a gap
function canStep(x, z) {
  if (!free(x, z, 0.4)) return false;
  const from = padOf(me.x, me.z);
  const to = padOf(x, z);
  if (from === to) return true;
  const pad = padById(from || to);
  return !!pad.breach && Math.hypot(x - pad.breach.x, z - pad.breach.z) < 4.6;
}

function moveMe(dt) {
  me.yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 2 * dt;
  me.pitch = clamp(me.pitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * 1.2 * dt, -1.3, 1.3);
  me.moving = false;
  if (flying) return flyHeli(dt);
  const ahead = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  me.sneak = !!(keys.KeyC || keys.ControlLeft);
  me.moving = !!(ahead || side);
  me.running = me.moving && !me.sneak && (keys.ShiftLeft || keys.ShiftRight) && me.stamina > 0.02;
  if (me.running) me.stamina = Math.max(0, me.stamina - dt / 8);
  else me.stamina = Math.min(1, me.stamina + dt / (me.moving ? 9 : 4));
  if (!me.moving) return;
  const speed = me.sneak ? 2.2 : me.running ? 8.5 : 4.8;
  const long = Math.hypot(ahead, side);
  const x = me.x + (-Math.sin(me.yaw) * ahead + Math.cos(me.yaw) * side) / long * speed * dt;
  const z = me.z + (-Math.cos(me.yaw) * ahead - Math.sin(me.yaw) * side) / long * speed * dt;
  if (canStep(x, me.z)) me.x = x;
  if (canStep(me.x, z)) me.z = z;
  // Tree trunks are solid: slide round them
  const ti = tileOf(me.x);
  const tk = tileOf(me.z);
  for (let i = ti - 1; i <= ti + 1; i++) {
    for (let k = tk - 1; k <= tk + 1; k++) {
      const tree = treeAt[keyOf(i, k)];
      if (!tree) continue;
      const dx = me.x - tree.x;
      const dz = me.z - tree.z;
      const far = Math.hypot(dx, dz);
      const gap = tree.r + 0.45;
      if (far < gap && far > 0.001) {
        me.x = tree.x + dx / far * gap;
        me.z = tree.z + dz / far * gap;
      }
    }
  }
}

// The square you are looking at (up to 40 metres away)
function aimTile() {
  const dy = Math.sin(me.pitch);
  const flat = Math.cos(me.pitch);
  const far = dy < -0.04 ? Math.min(40, 1.7 / -dy * flat) : 14;
  const x = me.x - Math.sin(me.yaw) * far;
  const z = me.z - Math.cos(me.yaw) * far;
  return { i: tileOf(x), k: tileOf(z), x: x, z: z };
}

// ===== 5. Building where you look =====
function openMenu() {
  mode = "menu";
  corner = null;
  if (document.exitPointerLock) document.exitPointerLock();
  let html = "";
  let n = 1;
  for (const name in TOOLS) {
    const item = TOOLS[name];
    const locked = item.stars && state.best < item.stars;
    html += '<button data-tool="' + name + '"' + (locked ? " disabled" : "") + "><b>" + (n < 10 ? n + ". " : n === 10 ? "0. " : "") + item.name + "</b>" + (item.cost ? " $" + item.cost : "") + "<br>" + (locked ? "Needs a " + item.stars + " star park" : item.what) + "</button>";
    n++;
  }
  el("parts").innerHTML = html;
  el("build").hidden = false;
}

function closeMenu() {
  el("build").hidden = true;
  mode = "play";
}

function chooseTool(name) {
  closeMenu();
  tool = name;
  corner = null;
}

// Use the tool you are holding on the square you are looking at
function build() {
  const at = aimTile();
  if (TOOLS[tool].pad) {
    if (!corner) {
      corner = at;
      say("First corner marked. Now look at the opposite corner and click again.", 4);
      return;
    }
    attempt(buildPad(Math.min(corner.i, at.i), Math.min(corner.k, at.k), Math.max(corner.i, at.i), Math.max(corner.k, at.k), "land"));
    corner = null;
  } else if (tool === "remove") {
    attempt(removeAt(at.i, at.k));
  } else {
    attempt(place(tool, at.i, at.k));
  }
}

// ===== 6. The paddock panel =====
let panelText = "";
function fixCost(pad) {
  return Math.ceil((1 - pad.hp / padMax(pad)) * fenceLength(pad) * wallCost(pad) * 0.5);
}

function upgradeCost(pad, to) {
  return fenceLength(pad) * (FENCES[to].per - FENCES[pad.fence].per);
}

function drawPanel() {
  const pad = padById(selected);
  if (!pad) return closePanel();
  const here = state.dinos.filter(function (d) { return d.pad === pad.id; });
  const biome = padBiome(pad);
  const max = padMax(pad);
  let room = 0;
  for (const d of here) room += SPECIES[d.kind].need;
  let html = "<h2>Paddock " + (state.pads.indexOf(pad) + 1) + "</h2>";
  html += '<p class="small">In ' + BIOMES[biome].name + ". " + (pad.i1 - pad.i0 + 1) + " by " + (pad.k1 - pad.k0 + 1) + " squares. Room used: " + room + " of " + padArea(pad) + ".<br>";
  html += padSeen(pad) ? "Visitors can see in." : '<span class="need">Visitors can\'t see in yet: put a viewing deck beside it, joined to a path.</span>';
  html += '</p><p class="small">' + FENCES[pad.fence].name + ": " + Math.ceil(pad.hp) + " of " + Math.round(max) + (pad.breach ? ' <span class="need">BROKEN!</span>' : "") + "</p>";
  if (pad.hp < max) html += '<button data-act="fix"' + (state.money < fixCost(pad) ? " disabled" : "") + ">Mend it: $" + fixCost(pad) + "</button>";
  for (const to of ["steel", "electric"]) {
    if (FENCES[to].hp > FENCES[pad.fence].hp) html += '<button data-act="fence-' + to + '"' + (state.money < upgradeCost(pad, to) ? " disabled" : "") + ">Change to " + FENCES[to].name.toLowerCase() + ": $" + upgradeCost(pad, to) + "</button>";
  }
  html += "<h2>Dinosaurs</h2>";
  if (!here.length) html += '<p class="small">Nobody lives here yet. Dart a wild dinosaur and bring it here with the helicopter.</p>';
  for (const d of here) {
    let feeling = '<span class="got">happy</span>';
    if (d.loose) feeling = '<span class="need">ON THE LOOSE!</span>';
    else if (d.mood === "asleep" || d.mood === "lift") feeling = "fast asleep";
    else if (d.mood === "angry") feeling = '<span class="need">ANGRY</span>';
    else if (d.why.length) feeling = "a bit unhappy";
    html += '<p class="small"><b>' + SPECIES[d.kind].name + "</b>: " + feeling + (d.why.length ? "<br>It is " + d.why.join(", and ") + "." : "");
    if (!d.loose && d.mood !== "lift") html += ' <button class="tiny" data-act="free-' + d.id + '">Set it free</button>';
    html += "</p>";
  }
  html += '<button data-act="close">Close (E)</button>';
  if (html !== panelText) {
    panelText = html;
    el("panel").innerHTML = html;
  }
}

function openPanel(pad) {
  selected = pad.id;
  panelText = "";
  mode = "panel";
  if (document.exitPointerLock) document.exitPointerLock();
  drawPanel();
  el("panel").hidden = false;
}

function closePanel() {
  el("panel").hidden = true;
  selected = null;
  if (mode === "panel") mode = "play";
}

function panelAct(act) {
  const pad = padById(selected);
  if (!pad || act === "close") return closePanel();
  if (act === "fix") {
    const cost = fixCost(pad);
    if (state.money >= cost) {
      state.money -= cost;
      pad.hp = padMax(pad);
      pad.breach = null;
      refreshPark();
      soundBuild();
    }
  } else if (act.indexOf("fence-") === 0) {
    const to = act.slice(6);
    const cost = upgradeCost(pad, to);
    if (state.money >= cost) {
      state.money -= cost;
      pad.fence = to;
      pad.hp = padMax(pad);
      pad.breach = null;
      refreshPark();
      soundBuild();
    }
  } else if (act.indexOf("free-") === 0) {
    // Back to the wild it goes
    const d = state.dinos.find(function (one) { return String(one.id) === act.slice(5); });
    if (d) {
      state.dinos.splice(state.dinos.indexOf(d), 1);
      sweepDinos();
      addWild(d.kind, SPECIES[d.kind].biome);
      say("The " + SPECIES[d.kind].name + " is back in the wild.", 3);
    }
  }
  drawPanel();
  save();
}

// ===== 7. What E does =====
function findNear() {
  if (flying) {
    const sleeper = hookTarget();
    if (sleeper) return { text: "E: hook the sleeping " + SPECIES[sleeper.kind].name, act: function () { sleeper.mood = "hooked"; heli.cargo = sleeper; soundBuild(); say("Got it! Now fly over one of your paddocks.", 4); } };
    if (heli.cargo) {
      const pad = padAt(tileOf(heli.x), tileOf(heli.z));
      if (pad) return { text: "E: lower the " + SPECIES[heli.cargo.kind].name + " into this paddock", act: function () { lowerCargo(pad); } };
      return { text: "Carrying a sleeping " + SPECIES[heli.cargo.kind].name + ". Fly over one of your paddocks" };
    }
    if (heli.y <= 0.5) return { text: "Space: take off · E: get out", act: function () { flying = false; me.x = heli.x + Math.cos(heli.yaw) * 3.5; me.z = heli.z - Math.sin(heli.yaw) * 3.5; me.yaw = heli.yaw; } };
    const asleep = wilds.some(function (w) { return w.mood === "asleep"; });
    return { text: asleep ? "Hover low over the sleeping dinosaur (Zz) to hook it" : "W, A, S, D: fly · Space: up · C: down. Land to get out" };
  }
  if (tool) return null;
  if (Math.hypot(me.x - heli.x, me.z - heli.z) < 5.5 && heli.y < 1) return { text: "E: fly the helicopter", act: function () { flying = true; tool = null; } };
  if (Math.hypot(me.x - (mid(CAMP.i) - 5), me.z - (mid(CAMP.k) + 1.5)) < 3.5) return { text: "E: fill up with darts (you have " + state.darts + ")", act: function () { state.darts = 12; soundBuild(); say("12 darts. Ready!", 2); } };
  const at = aimTile();
  const pad = padAt(at.i, at.k);
  if (pad && Math.hypot(at.x - me.x, at.z - me.z) < 30) return { text: "E: check this paddock", act: function () { openPanel(pad); } };
  return null;
}

// ===== 8. One step of the game =====
function tick(dt) {
  state.time += dt;
  moveMe(dt);
  updateWilds(dt);
  updateDinos(dt);
  updateGuests(dt);
  if (mode !== "play") return;
  near = findNear();
  state.scare = Math.max(0, state.scare - dt * 0.08);
  if (state.time - lastCheck > 0.5) {
    lastCheck = state.time;
    rate();
    checkGoals();
  }
  if (state.time - lastSave > 20) save();
}

// ===== 9. Drawing =====
const cursor = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshBasicMaterial({ color: 0x6dff8e, transparent: true, opacity: 0.5, depthWrite: false }));
cursor.visible = false;
scene.add(cursor);
const strings = {};
function setText(id, text) {
  if (strings[id] === text) return;
  strings[id] = text;
  el(id).innerHTML = text;
}

// The little map: sections, paddocks, paths, the helicopter (H) and you
function drawMap() {
  const pen = el("minimap").getContext("2d");
  const s = 130 / SIZE;
  for (let i = 0; i < SIZE; i += 2) {
    for (let k = 0; k < SIZE; k += 2) {
      pen.fillStyle = BIOMES[biomeAt(i, k)].map;
      pen.fillRect(i * s, k * s, 2 * s + 0.5, 2 * s + 0.5);
    }
  }
  for (const key in state.tiles) {
    const n = key.split(",").map(Number);
    pen.fillStyle = state.tiles[key] === "path" ? "#f0dca0" : "#d8442e";
    pen.fillRect(n[0] * s, n[1] * s, Math.max(1.6, s), Math.max(1.6, s));
  }
  for (const pad of state.pads) {
    pen.strokeStyle = "#5a3a1a";
    pen.lineWidth = 1.5;
    pen.strokeRect(pad.i0 * s, pad.k0 * s, (pad.i1 - pad.i0 + 1) * s, (pad.k1 - pad.k0 + 1) * s);
  }
  const dot = function (x, z, colour, big) {
    pen.fillStyle = colour;
    pen.fillRect((x + HALF) / TILE * s - big / 2, (z + HALF) / TILE * s - big / 2, big, big);
  };
  // From the air you can spot every wild dinosaur. On foot you only see the sleeping ones.
  for (const w of wilds) {
    if (w.mood === "asleep") dot(w.x, w.z, Math.sin(wall * 6) > 0 ? "#6ad8ff" : "#ffffff", 5);
    else if (flying && w.mood !== "hooked") dot(w.x, w.z, SPECIES[w.kind].hunter ? "#ff2a1a" : "#2a2a2a", 3);
  }
  for (const d of state.dinos) {
    if (d.loose) dot(d.x, d.z, Math.sin(wall * 8) > 0 ? "#ff2a1a" : "#ffffff", 5);
  }
  dot(heli.x, heli.z, "#000000", 7);
  dot(heli.x, heli.z, "#ffe14a", 5);
  if (!flying) {
    dot(me.x, me.z, "#000000", 6);
    dot(me.x, me.z, "#ffffff", 4);
  }
}

function drawHud() {
  const next = STAR_POINTS[state.stars];
  const biome = biomeAt(clamp(tileOf(me.x), 0, SIZE - 1), clamp(tileOf(me.z), 0, SIZE - 1));
  setText("money", "$" + Math.floor(state.money));
  setText("stars", "★".repeat(state.stars) + "☆".repeat(5 - state.stars) + (next ? " <small>" + Math.floor(state.points) + "/" + next + "</small>" : ""));
  setText("crowd", guests.length + " visitors");
  setText("place", BIOMES[biome].name);
  setText("darts", "Darts " + state.darts);
  el("stamina-fill").style.width = Math.round(me.stamina * 100) + "%";

  // Trouble in the park, and hunters near you
  const lines = [];
  const loose = state.dinos.filter(function (d) { return d.loose && d.mood !== "lift" && d.mood !== "asleep"; });
  if (loose.length) lines.push('<p class="bad">' + loose.length + " of your dinosaurs " + (loose.length > 1 ? "are" : "is") + " ON THE LOOSE! Find " + (loose.length > 1 ? "them" : "it") + " (red on the map) and dart " + (loose.length > 1 ? "them" : "it") + ".</p>");
  for (const pad of state.pads) {
    const angry = state.dinos.find(function (d) { return d.pad === pad.id && d.mood === "angry" && !d.loose; });
    if (angry) lines.push('<p class="bad">' + SPECIES[angry.kind].name + " in paddock " + (state.pads.indexOf(pad) + 1) + " is ANGRY and bashing the fence (" + Math.round(pad.hp / padMax(pad) * 100) + "% left). Check the paddock to see why.</p>");
  }
  const hunted = wilds.find(function (w) { return w.mood === "hunt"; });
  if (hunted && !flying) lines.push('<p class="bad">A ' + SPECIES[hunted.kind].name + " IS AFTER YOU! Dart it!</p>");
  const html = lines.slice(0, 3).join("");
  if (drawHud.alerts !== html) {
    drawHud.alerts = html;
    el("alerts").innerHTML = html;
  }

  let hint = "";
  if (mode === "play") {
    if (tool && !flying) {
      const at = aimTile();
      if (TOOLS[tool].pad && corner) {
        const wide = Math.abs(at.i - corner.i) + 1;
        const deep = Math.abs(at.k - corner.k) + 1;
        const why = whyNoPad(Math.min(corner.i, at.i), Math.min(corner.k, at.k), Math.max(corner.i, at.i), Math.max(corner.k, at.k), "land");
        hint = wide + " by " + deep + " paddock: $" + 2 * (wide + deep) * PADS.land.per + (why ? " · " + why : " · click to build it");
      } else if (TOOLS[tool].pad) {
        hint = "Paddock: look at the ground where one corner should go, and click";
      } else if (tool === "remove") {
        hint = "Bulldozer: click on what you want to take away";
      } else {
        hint = whyNot(tool, at.i, at.k) || "Click to build the " + TOOLS[tool].name.toLowerCase() + " here";
      }
      hint += " · Esc: stop building";
    } else if (near) {
      hint = near.text;
    }
  }
  setText("hint", hint);
  el("hint").hidden = !hint;
  if (!el("toast").hidden && wall > toastUntil) el("toast").hidden = true;
  if (mode === "panel") drawPanel();
  drawMap();
}

const forestAir = new THREE.Color(0x6f9a7a);
const nowAir = new THREE.Color();
let woods = 0;

function draw(dt) {
  wall += dt;
  shake = Math.max(0, shake - dt);
  camera.rotation.order = "YXZ";
  if (mode === "intro" || mode === "won") {
    camera.position.set(mid(CAMP.i) + Math.cos(wall * 0.08) * 34, 16, mid(CAMP.k) - 10 + Math.sin(wall * 0.08) * 34);
    camera.lookAt(mid(CAMP.i), 2, mid(CAMP.k) - 10);
  } else if (flying) {
    camera.position.set(heli.x + Math.sin(heli.yaw) * 17, heli.y + 11, heli.z + Math.cos(heli.yaw) * 17);
    camera.lookAt(heli.x - Math.sin(heli.yaw) * 6, heli.y - 1, heli.z - Math.cos(heli.yaw) * 6);
  } else {
    const high = me.sneak ? 1.05 : 1.7 + (me.moving ? Math.sin(wall * (me.running ? 14 : 9)) * 0.05 : 0);
    camera.position.set(me.x, high, me.z);
    camera.rotation.set(me.pitch, me.yaw, 0);
  }
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.4;
    camera.position.y += (Math.random() - 0.5) * shake * 0.4;
  }
  sunLight.target.position.set(me.x, 0, me.z);
  sunLight.position.set(me.x - 60, 120, me.z + 50);

  // Under the trees the air is green and dim, and you can't see far
  const inWoods = !flying && mode === "play" && biomeAt(clamp(tileOf(me.x), 0, SIZE - 1), clamp(tileOf(me.z), 0, SIZE - 1)) === "forest";
  woods += ((inWoods ? 1 : 0) - woods) * Math.min(1, dt * 2);
  nowAir.copy(SKY).lerp(forestAir, woods);
  scene.fog.color.copy(nowAir);
  scene.fog.near = 260 - 245 * woods;
  scene.fog.far = 1100 - 940 * woods;
  renderer.setClearColor(nowAir);
  skyLight.intensity = 0.62 - 0.2 * woods;

  smokePuffs.forEach(function (puff, n) {
    const up = (wall * 6 + n * 22) % 150;
    puff.position.set(VOLCANO.x + Math.sin(n * 2 + up * 0.02) * 12 + up * 0.25, 128 + up, VOLCANO.z);
    puff.scale.setScalar(16 + up * 0.25);
    puff.material.opacity = 0.7 * (1 - up / 150);
  });

  // The square (or paddock outline) you are about to build on
  cursor.visible = false;
  if (mode === "play" && tool && !flying) {
    const at = aimTile();
    cursor.visible = true;
    let bad;
    if (TOOLS[tool].pad && corner) {
      const i0 = Math.min(corner.i, at.i);
      const i1 = Math.max(corner.i, at.i);
      const k0 = Math.min(corner.k, at.k);
      const k1 = Math.max(corner.k, at.k);
      cursor.position.set((i0 + i1 + 1) / 2 * TILE - HALF, 0.2, (k0 + k1 + 1) / 2 * TILE - HALF);
      cursor.scale.set((i1 - i0 + 1) * TILE, 1, (k1 - k0 + 1) * TILE);
      bad = whyNoPad(i0, k0, i1, k1, "land");
    } else {
      cursor.position.set(mid(at.i), 0.2, mid(at.k));
      cursor.scale.set(TILE, 1, TILE);
      bad = tool === "remove" ? !typeAt(at.i, at.k) && !padAt(at.i, at.k) && !treeAt[keyOf(at.i, at.k)] : TOOLS[tool].pad ? "" : whyNot(tool, at.i, at.k);
    }
    cursor.material.color.setHex(bad ? 0xff5a4a : tool === "remove" ? 0xffb02a : 0x6dff8e);
  }
  for (const pad of state.pads) {
    const fence = padGroups[pad.id];
    if (fence) fence.userData.postPaint.emissive.setHex(state.time - (pad.hitAt || -9) < 0.5 && Math.sin(wall * 20) > 0 ? 0xaa1a0a : 0x000000);
  }
  poseHeli(dt);
  poseWilds(wall);
  poseDinos(wall);
  drawGuests(wall);
  drawHud();
}

// ===== 10. Saving =====
function save() {
  lastSave = state.time;
  state.at = { x: me.x, z: me.z, yaw: me.yaw, hx: heli.x, hz: heli.z, hyaw: heli.yaw };
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
  // Put every forest tree back, then take out the ones you have cleared
  for (const tree of trees) {
    tree.gone = false;
    treeAt[tree.i + "," + tree.k] = tree;
    drawTree(tree, true);
  }
  const felled = state.felled;
  state.felled = [];
  for (const key of felled) {
    if (treeAt[key]) fellTree(treeAt[key]);
  }
  for (const d of state.dinos) {
    if (d.mood === "lift" || (d.mood === "asleep" && d.loose)) {
      const middle = padMid(padById(d.pad));
      d.x = middle.x;
      d.z = middle.z;
      d.loose = false;
      d.mood = "calm";
    }
  }
  guests.length = 0;
  sweepDinos();
  refreshPark();
  makeWilds();
  rate();
  flying = false;
  tool = corner = null;
  heli.cargo = null;
  heli.y = heli.speed = 0;
  const at = saved && state.at ? state.at : { x: mid(CAMP.i), z: mid(CAMP.k), yaw: 0, hx: mid(HELIPAD.i), hz: mid(HELIPAD.k), hyaw: 0 };
  me.x = at.x;
  me.z = at.z;
  me.yaw = at.yaw;
  me.pitch = 0;
  heli.x = at.hx;
  heli.z = at.hz;
  heli.yaw = at.hyaw;
  lastSave = lastCheck = state.time;
  safeUntil = state.time + 4;
  for (const id of ["intro", "won", "build", "panel", "card"]) el(id).hidden = true;
  mode = "play";
  checkGoals();
  if (!saved && !testing) showCard("Welcome to Fossil Bay.\n\nThis time there is no office in the sky. You have your own two feet, a dart gun, and a helicopter.\n\nThe island is full of wild dinosaurs. Build a paddock, put a dinosaur to sleep with darts, and fly it home under the helicopter.");
}

// ===== 11. Keys, mouse and buttons =====
window.addEventListener("keydown", function (e) {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (mode === "card") {
    if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") closeCard();
    return;
  }
  if (mode === "menu") {
    const digit = e.code.indexOf("Digit") === 0 ? Number(e.code.slice(5)) : -1;
    const name = Object.keys(TOOLS)[digit === 0 ? 9 : digit - 1];
    if (e.code === "KeyB" || e.code === "Escape") closeMenu();
    else if (name && !(TOOLS[name].stars && state.best < TOOLS[name].stars)) chooseTool(name);
    return;
  }
  if (mode === "panel") {
    if (e.code === "KeyE" || e.code === "Escape") closePanel();
    return;
  }
  if (mode !== "play") return;
  if (e.code === "KeyB" && !flying) openMenu();
  else if (e.code === "Escape") tool = corner = null;
  else if (e.code === "Space" && !flying && !tool) fireDart();
  else if (e.code === "KeyE") {
    if (tool && !flying) build();
    else if (near && near.act) near.act();
  }
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
  else if (tool && !flying) build();
  else fireDart();
});

canvas.addEventListener("contextmenu", function (e) {
  e.preventDefault();
  tool = corner = null;
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
el("parts").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (button && !button.disabled) chooseTool(button.dataset.tool);
});
el("build-close").addEventListener("click", closeMenu);
el("panel").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (button && button.dataset.act) panelAct(button.dataset.act);
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

// ===== 12. Go! =====
refreshPark();
makeWilds();
camera.fov = 68;
camera.updateProjectionMatrix();
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
  window.F3 = {
    me: me, heli: heli, keys: keys, wilds: wilds, guests: guests, trees: trees,
    state: function () { return state; },
    mode: function () { return mode; },
    near: function () { return near; },
    tool: function () { return tool; },
    flying: function () { return flying; },
    frames: function () { return frameCount; },
    setFlying: function (on) { flying = on; },
    begin: begin, save: save, load: load, place: place, buildPad: buildPad, removeAt: removeAt, fireDart: fireDart,
    aimTile: aimTile, chooseTool: chooseTool, build: build, lowerCargo: lowerCargo, hookTarget: hookTarget, rate: rate,
    step: function (n) { for (let i = 0; i < n; i++) { if (mode === "play") tick(0.05); } },
  };
}

requestAnimationFrame(frame);
