// Fossil Bay 2: the game.
// Money, the camera, the mouse and keys, the build tools, the panels (paddocks, labs and staff),
// the little map, the ranger jeep, storms, your jobs, and saving.

// ===== 1. What the game remembers =====
const SAVE = "fossilbay2-save";

function freshState() {
  const tiles = {};
  tiles[keyOf(GATE.i, GATE.k)] = "path";   // the gate square is always a path
  return {
    money: 4000,
    time: 0,
    tiles: tiles,     // what is built on each square: { "19,79": "path" ... }
    pads: [],         // paddocks: { id, i0, k0, i1, k1, kind, fence, hp, breach }
    dinos: [],        // dinosaurs: { id, kind, pad, x, z, grow, hunger, comfort, mood, loose ... }
    stations: [],     // monorail stations, in the order you built them
    labs: {},         // research labs: { "i,k": { job } }
    known: { para: true, tri: true },   // the kinds of dinosaur you know how to hatch
    tech: {},         // the inventions your labs have made
    staff: { keeper: 0, ranger: 0, scientist: 0, guide: 0 },
    wageClock: 0,
    nextId: 1,
    stars: 0, best: 0, points: 0,
    scare: 0,         // how frightened the visitors have been lately
    arrived: 0, served: 0, escapes: 0, caught: 0,
    goal: 0,          // which job you are on
    nextGuest: 6, nextStorm: 300, stormUntil: 0,
    won: false,
    jeep: { x: mid(GATE.i) + 8, z: HALF - 8, yaw: 0 },
  };
}

let state = freshState();
let mode = "intro";          // intro, play or won
let view = "park";           // "park" (looking down, building) or "jeep" (driving)
let tool = "look";
let group = "dinos";         // which tab of the toolbar is showing
let speed = 1;               // 0 = paused, 1 = normal, 3 = fast
let selected = null;         // what the side panel is showing: { type: "pad" / "lab" / "staff", ... }
let hover = null;            // the square under the mouse
let drag = null;             // where a mouse drag started
let shake = 0;
let wall = 0;                // a clock that never stops (for animations)
let lastSave = 0;
let lastCheck = 0;
let lastMap = 0;
let jeepSpeed = 0;
let dartReady = 0;
let dartFly = null;
const keys = {};
const cam = { x: mid(GATE.i), z: HALF - 26, yaw: 0, dist: 80 };

function stormy() {
  return state.time < state.stormUntil;
}

// ===== 2. Sounds and messages =====
function sound(make) {
  try { make(); } catch (problem) { /* no sound is fine */ }
}
function soundBuild() { sound(function () { playNoise(0, 0.12, 500, 1400, 0.15); playTone(0.05, 0.15, 500, 760, 0.15); }); }
function soundNo() { sound(function () { playTone(0, 0.15, 220, 160, 0.15); }); }
function soundCash() { sound(function () { playTone(0, 0.08, 900, 1200, 0.12); playTone(0.08, 0.12, 1200, 1600, 0.12); }); }
function soundHatch() { sound(function () { playNoise(0, 0.15, 2000, 800, 0.2); playTone(0.1, 0.3, 500, 900, 0.2); }); }
function soundGrowl() { sound(function () { playNoise(0, 0.6, 300, 100, 0.3); playTone(0, 0.5, 140, 80, 0.25); }); }
function soundRoar() { sound(function () { playNoise(0, 1.3, 400, 60, 0.5); playTone(0, 1.1, 150, 45, 0.4); }); }
function soundDart() { sound(function () { playNoise(0, 0.15, 3000, 1500, 0.2); }); }
function soundThunder() { sound(function () { playNoise(0, 1.6, 200, 40, 0.5); }); }

const el = function (id) { return document.getElementById(id); };
let toastUntil = 0;
function say(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastUntil = wall + (seconds || 3);
}

// Try to do something that gives back "" when it worked, or the reason why not
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

// ===== 3. Jobs =====
function goalDone(n) {
  const hasFeeder = state.pads.some(function (p) { return feedersIn(p, "plants").length || feedersIn(p, "meat").length || feedersIn(p, "fish").length; });
  const open = Object.keys(BIOMES).filter(biomeOpen).length;
  if (n === 0) return state.pads.length > 0;
  if (n === 1) return hasFeeder;
  if (n === 2) return state.dinos.length > 0;
  if (n === 3) return state.pads.some(padSeen);
  if (n === 4) return state.arrived >= 10;
  if (n === 5) return Object.keys(state.labs).length > 0 && state.staff.scientist > 0;
  if (n === 6) return Object.keys(state.known).length > STARTERS.length;
  if (n === 7) return railStops.some(function (s) { return biomeAt(s.i, s.k) === "jungle" && canReach(s.i, s.k); });
  if (n === 8) return open >= 2;
  if (n === 9) return state.staff.ranger > 0 && state.staff.keeper > 0;
  if (n === 10) return state.dinos.some(function (d) { const pad = padById(d.pad); return pad && padBiome(pad) !== "jungle"; });
  if (n === 11) return state.best >= 3;
  if (n === 12) return state.dinos.some(function (d) { return SPECIES[d.kind].home !== "land"; });
  if (n === 13) return open >= 4;
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
  if (state.goal >= GOALS.length && !state.won) win();
  el("goal").textContent = state.goal < GOALS.length ? "Job " + (state.goal + 1) + " of " + GOALS.length + ": " + GOALS[state.goal].text : "Fossil Bay is a five star island! Keep building it any way you like";
}

function win() {
  state.won = true;
  sound(playJingle);
  save();
  el("won-text").textContent = "Fossil Bay has five stars! You hatched " + state.dinos.length + " dinosaurs of " + Object.keys(state.known).length + " kinds, opened " + Object.keys(BIOMES).filter(biomeOpen).length + " biomes, welcomed " + state.arrived + " visitors and caught " + state.caught + " runaways. It took you " + Math.round(state.time / 60) + " minutes.";
  el("won").hidden = false;
  mode = "won";
}

// ===== 4. The side panel: a paddock, a lab, or your staff =====
let panelText = "";

function fixCost(pad) {
  return Math.ceil((1 - pad.hp / padMax(pad)) * fenceLength(pad) * wallCost(pad) * 0.5);
}

function upgradeCost(pad, to) {
  return fenceLength(pad) * (FENCES[to].per - FENCES[pad.fence].per);
}

function padPanel(pad) {
  const here = state.dinos.filter(function (d) { return d.pad === pad.id; });
  const biome = padBiome(pad);
  let room = 0;
  for (const d of here) room += SPECIES[d.kind].need;
  let html = "<h2>" + PADS[pad.kind].name + " " + (state.pads.indexOf(pad) + 1) + "</h2>";
  html += '<p class="small">In ' + BIOMES[biome].name + ". " + (pad.i1 - pad.i0 + 1) + " by " + (pad.k1 - pad.k0 + 1) + " squares. Room used: " + room + " of " + padArea(pad) + ".<br>";
  html += padSeen(pad) ? "Visitors can see in." : '<span class="need">Visitors can\'t see in yet: put a viewing deck beside it, joined to a path.</span>';
  html += keptPads[pad.id] ? '<br><span class="got">A keeper is looking after it.</span>' : "";
  html += "</p>";
  if (pad.kind !== "water") {
    const max = padMax(pad);
    html += '<p class="small">' + (pad.kind === "air" ? "Aviary net" : FENCES[pad.fence].name) + ": " + Math.ceil(pad.hp) + " of " + Math.round(max) + (pad.breach ? ' <span class="need">BROKEN!</span>' : "") + "</p>";
    if (pad.hp < max) html += '<button data-act="fix"' + (state.money < fixCost(pad) ? " disabled" : "") + ">Mend it: $" + fixCost(pad) + "</button>";
    if (pad.kind === "land") {
      for (const to of ["steel", "electric"]) {
        if (FENCES[to].hp > FENCES[pad.fence].hp) html += '<button data-act="fence-' + to + '"' + (state.money < upgradeCost(pad, to) ? " disabled" : "") + ">Change to " + FENCES[to].name.toLowerCase() + ": $" + upgradeCost(pad, to) + "</button>";
      }
    }
  }
  html += "<h2>Dinosaurs</h2>";
  if (!here.length) html += '<p class="small">Nobody lives here yet.</p>';
  for (const d of here) {
    const age = d.mood === "egg" ? "egg" : d.grow < 0.4 ? "baby" : d.grow < 1 ? "young" : "grown";
    let feeling = '<span class="got">happy</span>';
    if (d.loose) feeling = '<span class="need">ON THE LOOSE!</span>';
    else if (d.mood === "egg") feeling = "about to hatch";
    else if (d.mood === "asleep" || d.mood === "lift") feeling = "fast asleep";
    else if (d.mood === "angry") feeling = '<span class="need">ANGRY</span>';
    else if (d.why.length) feeling = "a bit unhappy";
    html += '<p class="small"><b>' + SPECIES[d.kind].name + "</b> (" + age + "): " + feeling + (d.why.length && d.mood !== "egg" ? "<br>It is " + d.why.join(", and ") + "." : "");
    if (!d.loose && d.mood !== "lift") html += ' <button class="tiny" data-act="away-' + d.id + '">Send away</button>';
    html += "</p>";
  }
  html += "<h2>Hatch an egg here</h2>";
  let unknown = 0;
  for (const kind in SPECIES) {
    const sp = SPECIES[kind];
    if (sp.home !== pad.kind) continue;
    if (!state.known[kind]) {
      unknown++;
      continue;
    }
    html += '<button data-act="hatch-' + kind + '"' + (state.money < sp.cost ? " disabled" : "") + "><b>" + sp.name + "</b> $" + sp.cost + "<br>Eats " + sp.diet + ". Needs " + sp.need + " squares" + (sp.herd > 1 ? " and " + (sp.herd - 1) + " friend" + (sp.herd > 2 ? "s" : "") : "") + "." + (sp.biome !== biome ? ' <span class="need">Likes ' + BIOMES[sp.biome].name + " best.</span>" : "") + "</button>";
  }
  if (unknown) html += '<p class="small">' + unknown + " more kind" + (unknown > 1 ? "s" : "") + " could live here. A research lab can find their DNA.</p>";
  return html;
}

function labPanel(key) {
  const lab = state.labs[key];
  const team = workers.filter(function (w) { return w.type === "scientist" && w.lab === key; }).length;
  let html = "<h2>Research lab</h2>";
  html += '<p class="small">' + (team ? team + " scientist" + (team > 1 ? "s are" : " is") + " working here." : '<span class="need">No scientist! Press Staff and hire one, or nothing will get done.</span>') + "</p>";
  if (lab.job) {
    const done = Math.round((1 - lab.job.left / lab.job.total) * 100);
    html += '<p class="small"><b>' + lab.job.name + '</b></p><div class="meter"><div style="width:' + done + '%"></div></div><p class="small">' + done + "% done</p>";
  } else {
    html += '<p class="small">Choose something to work on:</p>';
  }
  for (const item of researchList()) {
    const off = lab.job || item.locked || state.money < item.cost;
    html += '<button data-act="res-' + item.id + '"' + (off ? " disabled" : "") + "><b>" + item.name + "</b> $" + item.cost + "<br>" + item.what + "." + (item.locked ? ' <span class="need">(' + item.locked + ")</span>" : "") + "</button>";
  }
  return html;
}

function staffPanel() {
  let html = "<h2>Your staff</h2>";
  html += '<p class="small">Wages: $' + wageBill() + " every half a minute.</p>";
  for (const type in STAFF) {
    const job = STAFF[type];
    html += '<p class="small"><b>' + job.name + "s: " + state.staff[type] + "</b> ($" + job.wage + " each)<br>" + job.what + ".</p>";
    html += '<button data-act="hire-' + type + '"' + (state.money < job.wage * 2 || state.staff[type] >= 6 ? " disabled" : "") + ">Hire a " + job.name.toLowerCase() + ": $" + job.wage * 2 + "</button>";
    if (state.staff[type]) html += '<button class="tiny" data-act="fire-' + type + '">Let one go</button>';
  }
  return html;
}

// Write the words and buttons for whatever is selected
function drawPanel() {
  let html = "";
  if (selected && selected.type === "pad" && padById(selected.id)) html = padPanel(padById(selected.id));
  else if (selected && selected.type === "lab" && state.labs[selected.key]) html = labPanel(selected.key);
  else if (selected && selected.type === "staff") html = staffPanel();
  if (!html) {
    selected = null;
    el("panel").hidden = true;
    panelText = "";
    return;
  }
  html += '<button data-act="close">Close</button>';
  // Only redraw when something has really changed (so buttons don't flicker under the mouse)
  if (html !== panelText) {
    panelText = html;
    el("panel").innerHTML = html;
  }
  el("panel").hidden = false;
}

function panelAct(act) {
  const pad = selected && selected.type === "pad" ? padById(selected.id) : null;
  if (act === "close") {
    selected = null;
  } else if (act.indexOf("hire-") === 0) {
    if (attempt(hire(act.slice(5)))) syncStaff();
  } else if (act.indexOf("fire-") === 0) {
    fire(act.slice(5));
    syncStaff();
  } else if (act.indexOf("res-") === 0) {
    attempt(startResearch(selected.key, act.slice(4)));
  } else if (!pad) {
    return;
  } else if (act === "fix") {
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
  } else if (act.indexOf("hatch-") === 0) {
    attempt(hatch(act.slice(6), pad));
  } else if (act.indexOf("away-") === 0) {
    const d = state.dinos.find(function (one) { return String(one.id) === act.slice(5); });
    if (d) sendAway(d);
  }
  drawPanel();
  save();
}

// ===== 5. Warnings =====
function drawAlerts() {
  const lines = [];
  const loose = state.dinos.filter(function (d) { return d.loose && d.mood !== "lift" && d.mood !== "asleep"; });
  if (loose.length) {
    lines.push('<p class="bad" data-loose="1">' + loose.length + " dinosaur" + (loose.length > 1 ? "s are" : " is") + " ON THE LOOSE! " + (state.staff.ranger ? "Your rangers are on their way." : "Press J for the jeep, drive close, and press Space.") + ' <button data-act="rangers"' + (state.money < 250 ? " disabled" : "") + ">Emergency team: $250</button></p>");
  }
  for (const pad of state.pads) {
    const angry = state.dinos.filter(function (d) { return d.pad === pad.id && d.mood === "angry" && !d.loose; });
    if (!angry.length) continue;
    lines.push('<p class="bad" data-pad="' + pad.id + '">' + SPECIES[angry[0].kind].name + " in " + PADS[pad.kind].name.toLowerCase() + " " + (state.pads.indexOf(pad) + 1) + " is ANGRY" + (pad.kind === "water" ? "" : " and bashing the fence (" + Math.round(pad.hp / padMax(pad) * 100) + "% left)") + ". Click here to see why.</p>");
  }
  if (stormy()) lines.push("<p>STORM! Electric fences have no power" + (state.tech.shelter ? "." : ", and the dinosaurs are frightened.") + "</p>");
  else if (state.dinos.length && state.nextStorm - state.time < 25 && state.nextStorm > state.time) lines.push("<p>A storm is coming. Check your fences!</p>");
  const html = lines.slice(0, 4).join("");
  if (drawAlerts.last !== html) {
    drawAlerts.last = html;
    el("alerts").innerHTML = html;
  }
}

// Pay an emergency team to dart every loose dinosaur at once
function sendRangers() {
  if (state.money < 250) return;
  state.money -= 250;
  for (const d of state.dinos) {
    if (d.loose && d.mood !== "lift" && d.mood !== "asleep") dartHit(d);
  }
}

// ===== 6. The jeep =====
function switchView() {
  view = view === "park" ? "jeep" : "park";
  selected = null;
  drag = null;
  if (view === "park") {
    cam.x = clamp(state.jeep.x, -HALF, HALF);
    cam.z = clamp(state.jeep.z, -HALF, HALF);
  } else {
    setTool("look");
  }
  el("toolbar").hidden = view === "jeep";
}

// The dinosaur the jeep could dart right now: loose or angry, close by, and in front
function dartTarget() {
  const jeep = state.jeep;
  let best = null;
  let bestFar = state.tech.darts ? 68 : 34;
  for (const d of state.dinos) {
    if (d.mood === "egg" || d.mood === "asleep" || d.mood === "lift") continue;
    if (!d.loose && d.mood !== "angry") continue;
    const dx = d.x - jeep.x;
    const dz = d.z - jeep.z;
    const far = Math.hypot(dx, dz);
    let turn = Math.atan2(-dx, -dz) - jeep.yaw;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    if (far < bestFar && Math.abs(turn) < 1.1) {
      best = d;
      bestFar = far;
    }
  }
  return best;
}

function fireDart() {
  if (state.time < dartReady) return;
  const target = dartTarget();
  if (!target) return say("No angry or loose dinosaur is close enough in front of the jeep", 2);
  dartReady = state.time + 1.2;
  soundDart();
  dartFly = { target: target, t: 0 };
}

function driveJeep(dt) {
  const jeep = state.jeep;
  const push = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  jeepSpeed += push * 24 * dt;
  jeepSpeed *= Math.exp(-1.3 * dt);
  jeep.yaw += steer * 2 * dt * clamp(jeepSpeed / 5, -1, 1);
  const oldX = jeep.x;
  const oldZ = jeep.z;
  jeep.x = clamp(jeep.x - Math.sin(jeep.yaw) * jeepSpeed * dt, -HALF - 4, HALF + 4);
  jeep.z = clamp(jeep.z - Math.cos(jeep.yaw) * jeepSpeed * dt, -HALF - 4, HALF + 4);
  // Fences are solid: the jeep can't drive into a paddock. (It can splash across the rivers.)
  if (padAt(tileOf(jeep.x), tileOf(jeep.z))) {
    jeep.x = oldX;
    jeep.z = oldZ;
    jeepSpeed *= -0.3;
  }
}

// Which way is something from the jeep? An arrow for the screen.
function arrowTo(x, z) {
  const jeep = state.jeep;
  let turn = Math.atan2(-(x - jeep.x), -(z - jeep.z)) - jeep.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  return ["↑", "↖", "←", "↙", "↓", "↘", "→", "↗"][(Math.round(turn / (Math.PI / 4)) + 8) % 8];
}

// ===== 7. Storms =====
function updateWeather(dt) {
  if (stormy()) {
    if (Math.random() < dt * 0.25) {
      soundThunder();
      updateWeather.flash = 0.25;
    }
    return;
  }
  // No storms until the park has a dinosaur and a star: beginners get a quiet start
  if (!state.dinos.length || state.best < 1) {
    state.nextStorm = Math.max(state.nextStorm, state.time + 60);
    return;
  }
  if (state.time > state.nextStorm) {
    state.stormUntil = state.time + 45;
    state.nextStorm = state.time + 45 + 240 + Math.random() * 180;
    soundThunder();
    say("A storm hits the island!", 4);
  }
}
updateWeather.flash = 0;

// ===== 8. One step of the game =====
function tick(dt) {
  state.time += dt;
  updateDinos(dt);
  updateGuests(dt);
  updateStaff(dt);
  updateWeather(dt);
  moveTrain(dt);
  if (view === "jeep") driveJeep(dt);
  if (dartFly) {
    dartFly.t += dt * 4;
    if (dartFly.t >= 1) {
      dartHit(dartFly.target);
      dartFly = null;
    }
  }
  // Visitors slowly forget a fright
  state.scare = Math.max(0, state.scare - dt * 0.08);
  if (state.time - lastCheck > 0.5) {
    lastCheck = state.time;
    rate();
    checkGoals();
  }
  if (state.time - lastSave > 20) save();
}

// ===== 9. The mouse =====
const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const pointer = new THREE.Vector2();

// Which square of the island is the mouse pointing at?
function squareAt(e) {
  const box = canvas.getBoundingClientRect();
  pointer.set((e.clientX - box.left) / box.width * 2 - 1, -(e.clientY - box.top) / box.height * 2 + 1);
  ray.setFromCamera(pointer, camera);
  if (!ray.ray.intersectPlane(ground, hit)) return null;
  return { i: tileOf(hit.x), k: tileOf(hit.z), x: hit.x, z: hit.z };
}

// The buttons along the bottom: Look and Bulldozer, the four tabs, and the tools on the tab you chose
function drawToolbar() {
  let tabs = '<button data-tool="look">1 Look</button><button data-tool="remove">0 Bulldozer</button>';
  for (const id in GROUPS) tabs += '<button class="tab" data-group="' + id + '">' + GROUPS[id] + "</button>";
  el("tabs").innerHTML = tabs;
  let html = "";
  let n = 2;
  for (const name in TOOLS) {
    if (TOOLS[name].group !== group) continue;
    html += '<button data-tool="' + name + '">' + (n < 10 ? n + " " : "") + TOOLS[name].name + (TOOLS[name].cost ? " $" + TOOLS[name].cost : "") + "</button>";
    n++;
  }
  el("tools").innerHTML = html;
  setTool(tool);
}

function setTool(name) {
  tool = name;
  drag = null;
  for (const row of [el("tabs"), el("tools")]) {
    for (const button of row.children) button.classList.toggle("on", button.dataset.tool === name || button.dataset.group === group);
  }
}

// A click (or the end of a drag) with the tool you are holding
function useTool(spot) {
  if (!spot) return;
  if (tool === "look") {
    const pad = padAt(spot.i, spot.k);
    const key = keyOf(spot.i, spot.k);
    selected = pad ? { type: "pad", id: pad.id } : state.labs[key] ? { type: "lab", key: key } : null;
    panelText = "";
  } else if (TOOLS[tool].pad) {
    if (!drag) return;
    attempt(buildPad(Math.min(drag.i, spot.i), Math.min(drag.k, spot.k), Math.max(drag.i, spot.i), Math.max(drag.k, spot.k), TOOLS[tool].pad));
  } else if (tool === "remove") {
    attempt(removeAt(spot.i, spot.k));
  } else if (tool !== "path") {
    attempt(place(tool, spot.i, spot.k));
  }
}

canvas.addEventListener("mousedown", function (e) {
  if (mode !== "play" || view !== "park" || e.button !== 0) return;
  const spot = squareAt(e);
  if (!spot) return;
  drag = spot;
  hover = spot;
  if (tool === "path") attempt(place("path", spot.i, spot.k));
});

canvas.addEventListener("mousemove", function (e) {
  if (mode !== "play" || view !== "park") return;
  hover = squareAt(e);
  // Hold the button and sweep the mouse to lay a whole line of path
  if (drag && tool === "path" && hover && !whyNot("path", hover.i, hover.k)) {
    place("path", hover.i, hover.k);
    soundBuild();
  }
});

window.addEventListener("mouseup", function (e) {
  if (mode !== "play" || view !== "park" || e.button !== 0 || !drag) return;
  useTool(hover || drag);
  drag = null;
});

canvas.addEventListener("contextmenu", function (e) {
  e.preventDefault();
  setTool("look");
});

canvas.addEventListener("wheel", function (e) {
  e.preventDefault();
  cam.dist = clamp(cam.dist * (e.deltaY > 0 ? 1.12 : 0.89), 28, 260);
}, { passive: false });

// Click the little map to jump there
el("minimap").addEventListener("click", function (e) {
  if (mode !== "play") return;
  const box = el("minimap").getBoundingClientRect();
  if (view === "jeep") switchView();
  cam.x = ((e.clientX - box.left) / box.width - 0.5) * SIZE * TILE;
  cam.z = ((e.clientY - box.top) / box.height - 0.5) * SIZE * TILE;
});

// ===== 10. Keys and buttons =====
window.addEventListener("keydown", function (e) {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat || mode !== "play") return;
  if (e.code === "KeyJ") return switchView();
  if (e.code === "KeyP") speed = speed ? 0 : 1;
  else if (e.code === "KeyO") speed = speed === 3 ? 1 : 3;
  if (view === "jeep") {
    if (e.code === "Space") fireDart();
    return;
  }
  if (e.code === "Escape") {
    setTool("look");
    selected = null;
  } else if (e.code === "Digit1") {
    setTool("look");
  } else if (e.code === "Digit0") {
    setTool("remove");
  } else if (e.code.indexOf("Digit") === 0) {
    // 2 to 9: the tools on the tab that is showing
    const names = Object.keys(TOOLS).filter(function (name) { return TOOLS[name].group === group; });
    const name = names[Number(e.code.slice(5)) - 2];
    if (name) setTool(name);
  }
});

window.addEventListener("keyup", function (e) {
  keys[e.code] = false;
});

window.addEventListener("blur", function () {
  for (const code in keys) keys[code] = false;
});

el("toolbar").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (!button) return;
  if (button.dataset.group) {
    group = button.dataset.group;
    drawToolbar();
  } else {
    setTool(button.dataset.tool);
  }
});
el("panel").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (button && button.dataset.act) panelAct(button.dataset.act);
});
el("alerts").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (button) return sendRangers();
  const line = e.target.closest("p");
  if (!line) return;
  if (line.dataset.pad) {
    // Jump to the paddock and open its panel
    const pad = padById(Number(line.dataset.pad));
    if (!pad) return;
    if (view === "jeep") switchView();
    const middle = padMid(pad);
    cam.x = middle.x;
    cam.z = middle.z;
    selected = { type: "pad", id: pad.id };
    panelText = "";
  } else if (line.dataset.loose) {
    const d = state.dinos.find(function (one) { return one.loose; });
    if (d && view === "park") {
      cam.x = d.x;
      cam.z = d.z;
    }
  }
});
el("jeep").addEventListener("click", function () {
  if (mode === "play") switchView();
});
el("staff").addEventListener("click", function () {
  if (mode !== "play") return;
  selected = selected && selected.type === "staff" ? null : { type: "staff" };
  panelText = "";
});
for (const n of [0, 1, 3]) {
  el("speed" + n).addEventListener("click", function () { speed = n; });
}
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

// ===== 11. Drawing =====
// The square that lights up under the mouse (green = fine, red = not allowed)
const cursor = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshBasicMaterial({ color: 0x6dff8e, transparent: true, opacity: 0.45, depthWrite: false }));
cursor.visible = false;
scene.add(cursor);
// The grid lines you see while you are building
const lines = new THREE.GridHelper(SIZE * TILE, SIZE, 0xffffff, 0xffffff);
lines.material.transparent = true;
lines.material.opacity = 0.16;
lines.position.y = 0.09;
scene.add(lines);
const dartBall = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bright(0xffe14a));
dartBall.visible = false;
scene.add(dartBall);

const strings = {};
function setText(id, text) {
  if (strings[id] === text) return;
  strings[id] = text;
  el(id).innerHTML = text;
}

// The little map in the corner: biomes, rivers, paddocks, paths, the monorail, and trouble
function drawMap() {
  const pen = el("minimap").getContext("2d");
  const s = 120 / SIZE;
  for (const quarter of [["desert", 0, 0], ["snow", 41, 0], ["jungle", 0, 41], ["swamp", 41, 41]]) {
    pen.fillStyle = BIOMES[quarter[0]].map;
    pen.globalAlpha = biomeOpen(quarter[0]) ? 1 : 0.45;
    pen.fillRect(quarter[1] * s, quarter[2] * s, 39 * s, 39 * s);
  }
  pen.globalAlpha = 1;
  pen.fillStyle = "#3aa8dc";
  pen.fillRect(39 * s, 0, 2 * s, 120);
  pen.fillRect(0, 39 * s, 120, 2 * s);
  pen.fillStyle = "#f0dca0";
  for (const key in state.tiles) {
    const n = key.split(",").map(Number);
    pen.fillStyle = state.tiles[key] === "path" ? "#f0dca0" : state.tiles[key] === "station" ? "#ffffff" : "#d8442e";
    pen.fillRect(n[0] * s, n[1] * s, Math.max(1.5, s), Math.max(1.5, s));
  }
  for (const pad of state.pads) {
    pen.strokeStyle = pad.kind === "water" ? "#1a5a9a" : pad.kind === "air" ? "#ffffff" : "#5a3a1a";
    pen.lineWidth = 1.5;
    pen.strokeRect(pad.i0 * s, pad.k0 * s, (pad.i1 - pad.i0 + 1) * s, (pad.k1 - pad.k0 + 1) * s);
  }
  if (railStops.length > 1) {
    pen.strokeStyle = "#ffffff";
    pen.lineWidth = 1;
    pen.beginPath();
    railStops.forEach(function (stop, n) {
      if (n) pen.lineTo((stop.i + 0.5) * s, (stop.k + 0.5) * s);
      else pen.moveTo((stop.i + 0.5) * s, (stop.k + 0.5) * s);
    });
    if (railStops.length > 2) pen.closePath();
    pen.stroke();
  }
  for (const d of state.dinos) {
    if (!d.loose && d.mood !== "angry") continue;
    pen.fillStyle = Math.sin(wall * 8) > 0 ? "#ff2a1a" : "#ffffff";
    pen.fillRect((d.x + HALF) / TILE * s - 2, (d.z + HALF) / TILE * s - 2, 4, 4);
  }
  // Where you are looking
  const at = view === "jeep" ? state.jeep : cam;
  pen.strokeStyle = "#000000";
  pen.lineWidth = 1;
  pen.strokeRect((at.x + HALF) / TILE * s - 5, (at.z + HALF) / TILE * s - 4, 10, 8);
}

function drawHud() {
  const next = STAR_POINTS[state.stars];
  const at = view === "jeep" ? state.jeep : cam;
  const biome = biomeAt(clamp(tileOf(at.x), 0, SIZE - 1), clamp(tileOf(at.z), 0, SIZE - 1));
  setText("money", "$" + Math.floor(state.money));
  setText("stars", "★".repeat(state.stars) + "☆".repeat(5 - state.stars) + (next ? " <small>" + Math.floor(state.points) + "/" + next + "</small>" : ""));
  setText("crowd", guests.length + " visitors");
  setText("place", biome === "river" ? "The river" : BIOMES[biome].name + (biomeOpen(biome) ? "" : " (needs a station)"));
  for (const n of [0, 1, 3]) el("speed" + n).classList.toggle("on", speed === n);
  setText("jeep", view === "jeep" ? "J: back to the park" : "J: jeep");

  let hint = "";
  if (mode === "play" && view === "jeep") {
    const loose = state.dinos.filter(function (d) { return d.loose && d.mood !== "asleep" && d.mood !== "lift"; });
    const target = dartTarget();
    if (target) hint = "Space: fire a sleepy dart at the " + SPECIES[target.kind].name;
    else if (loose.length) hint = arrowTo(loose[0].x, loose[0].z) + " Loose " + SPECIES[loose[0].kind].name + ": " + Math.round(Math.hypot(loose[0].x - state.jeep.x, loose[0].z - state.jeep.z)) + " m away";
    else hint = "W, A, S, D: drive. Nothing is on the loose. Press J to go back to building";
  } else if (mode === "play") {
    hint = TOOLS[tool].what;
    if (TOOLS[tool].pad && drag && hover) {
      const wide = Math.abs(hover.i - drag.i) + 1;
      const deep = Math.abs(hover.k - drag.k) + 1;
      const why = whyNoPad(Math.min(drag.i, hover.i), Math.min(drag.k, hover.k), Math.max(drag.i, hover.i), Math.max(drag.k, hover.k), TOOLS[tool].pad);
      hint = wide + " by " + deep + " " + PADS[TOOLS[tool].pad].name.toLowerCase() + ": $" + 2 * (wide + deep) * PADS[TOOLS[tool].pad].per + (why ? " · " + why : "");
    } else if (hover && TOOLS[tool].cost && whyNot(tool, hover.i, hover.k)) {
      hint = whyNot(tool, hover.i, hover.k);
    }
  }
  setText("hint", hint);
  el("hint").hidden = !hint;
  if (!el("toast").hidden && wall > toastUntil) el("toast").hidden = true;
  drawAlerts();
  drawPanel();
  if (wall - lastMap > 0.4) {
    lastMap = wall;
    drawMap();
  }
}

const stormSky = new THREE.Color(0x56667a);
const nowSky = new THREE.Color();

function draw(dt) {
  wall += dt;
  shake = Math.max(0, shake - dt);

  // The camera
  let focus = cam;
  if (view === "park" || mode !== "play") {
    if (mode === "play") {
      const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const pan = cam.dist * 0.9 * dt;
      cam.x = clamp(cam.x + (-Math.sin(cam.yaw) * ahead + Math.cos(cam.yaw) * side) * pan, -HALF, HALF);
      cam.z = clamp(cam.z + (-Math.cos(cam.yaw) * ahead - Math.sin(cam.yaw) * side) * pan, -HALF, HALF);
      cam.yaw += ((keys.KeyQ ? 1 : 0) - (keys.KeyE ? 1 : 0)) * 1.4 * dt;
      cam.dist = clamp(cam.dist * (1 + ((keys.KeyX ? 1 : 0) - (keys.KeyZ ? 1 : 0)) * dt), 28, 260);
    } else {
      cam.yaw += dt * 0.05;   // a slow spin behind the title
    }
    camera.position.set(cam.x + Math.sin(cam.yaw) * cam.dist * 0.62, cam.dist * 0.78, cam.z + Math.cos(cam.yaw) * cam.dist * 0.62);
    camera.lookAt(cam.x, 0, cam.z);
  } else {
    const jeep = state.jeep;
    focus = jeep;
    camera.position.set(jeep.x + Math.sin(jeep.yaw) * 13, 7.5, jeep.z + Math.cos(jeep.yaw) * 13);
    camera.lookAt(jeep.x - Math.sin(jeep.yaw) * 8, 2, jeep.z - Math.cos(jeep.yaw) * 8);
  }
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  // The sun follows where you are looking, so its shadows are always sharp there
  sunLight.target.position.set(focus.x, 0, focus.z);
  sunLight.position.set(focus.x - 60, 120, focus.z + 50);

  jeepModel.position.set(state.jeep.x, 0, state.jeep.z);
  jeepModel.rotation.y = state.jeep.yaw;
  if (dartFly) {
    const d = dartFly.target;
    dartBall.visible = true;
    dartBall.position.set(state.jeep.x + (d.x - state.jeep.x) * dartFly.t, 2 + dartFly.t * 2, state.jeep.z + (d.z - state.jeep.z) * dartFly.t);
  } else {
    dartBall.visible = false;
  }

  // Weather: dark skies and rain in a storm
  const dark = stormy() ? 1 : 0;
  draw.dark = (draw.dark || 0) + (dark - (draw.dark || 0)) * Math.min(1, dt * 1.5);
  updateWeather.flash = Math.max(0, updateWeather.flash - dt);
  nowSky.copy(SKY).lerp(stormSky, draw.dark);
  if (updateWeather.flash > 0) nowSky.setHex(0xffffff);
  scene.fog.color.copy(nowSky);
  renderer.setClearColor(nowSky);
  skyLight.intensity = 0.62 - 0.25 * draw.dark + (updateWeather.flash > 0 ? 0.6 : 0);
  sunLight.intensity = 0.7 - 0.5 * draw.dark;
  rain.visible = draw.dark > 0.3;
  if (rain.visible) {
    const drops = rain.geometry.attributes.position;
    for (let n = 0; n < RAIN; n++) {
      let y = drops.getY(n) - dt * 70;
      if (y < 0) y += 90;
      drops.setY(n, y);
    }
    drops.needsUpdate = true;
    rain.position.set(camera.position.x, 0, camera.position.z - 40);
  }
  smokePuffs.forEach(function (puff, n) {
    const up = (wall * 6 + n * 22) % 150;
    puff.position.set(VOLCANO.x + Math.sin(n * 2 + up * 0.02) * 12 + up * 0.25, 128 + up, VOLCANO.z);
    puff.scale.setScalar(16 + up * 0.25);
    puff.material.opacity = 0.7 * (1 - up / 150);
  });

  // The square under the mouse
  lines.visible = view === "park" && tool !== "look" && mode === "play";
  cursor.visible = false;
  if (lines.visible && hover && inPark(hover.i, hover.k)) {
    cursor.visible = true;
    let bad;
    if (TOOLS[tool].pad && drag) {
      const i0 = Math.min(drag.i, hover.i);
      const i1 = Math.max(drag.i, hover.i);
      const k0 = Math.min(drag.k, hover.k);
      const k1 = Math.max(drag.k, hover.k);
      cursor.position.set((i0 + i1 + 1) / 2 * TILE - HALF, 0.2, (k0 + k1 + 1) / 2 * TILE - HALF);
      cursor.scale.set((i1 - i0 + 1) * TILE, 1, (k1 - k0 + 1) * TILE);
      bad = whyNoPad(i0, k0, i1, k1, TOOLS[tool].pad);
    } else {
      cursor.position.set(mid(hover.i), 0.2, mid(hover.k));
      cursor.scale.set(TILE, 1, TILE);
      bad = tool === "remove" ? !typeAt(hover.i, hover.k) && !padAt(hover.i, hover.k) : TOOLS[tool].pad ? "" : whyNot(tool, hover.i, hover.k);
    }
    cursor.material.color.setHex(bad ? 0xff5a4a : tool === "remove" ? 0xffb02a : 0x6dff8e);
  }

  // A fence that is being bashed flashes red
  for (const pad of state.pads) {
    const fence = padGroups[pad.id];
    if (fence) fence.userData.postPaint.emissive.setHex(state.time - (pad.hitAt || -9) < 0.5 && Math.sin(wall * 20) > 0 ? 0xaa1a0a : 0x000000);
  }

  poseDinos(wall);
  drawGuests(wall);
  drawStaff(wall);
  drawHud();
}

// ===== 12. Saving =====
function save() {
  lastSave = state.time;
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
  // A dinosaur that was being carried by the helicopter when the game was saved is simply home again
  for (const d of state.dinos) {
    if (d.mood === "lift" || (d.mood === "asleep" && d.loose)) {
      const middle = padMid(padById(d.pad));
      d.x = middle.x;
      d.z = middle.z;
      d.loose = false;
      d.mood = "calm";
      d.comfort = 70;
    }
  }
  guests.length = 0;
  sweepDinos();
  refreshPark();
  syncStaff();
  rate();
  view = "park";
  el("toolbar").hidden = false;
  group = "dinos";
  tool = "look";
  drawToolbar();
  selected = null;
  speed = 1;
  lastSave = lastCheck = state.time;
  cam.x = mid(GATE.i);
  cam.z = HALF - 26;
  cam.yaw = 0;
  cam.dist = 80;
  for (const id of ["intro", "won"]) el(id).hidden = true;
  mode = "play";
  checkGoals();
}

// ===== 13. Go! =====
refreshPark();
drawToolbar();
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
    for (let n = 0; n < speed; n++) tick(dt);
  }
  draw(dt);
  renderer.render(scene, camera);
}

// For testing the game with a script: add ?test to the address
if (testing) {
  begin(null);
  window.FB = {
    cam: cam, keys: keys, guests: guests, live: live, workers: workers,
    state: function () { return state; },
    mode: function () { return mode; },
    view: function () { return view; },
    tool: function () { return tool; },
    frames: function () { return frameCount; },
    begin: begin, save: save, load: load, place: place, buildPad: buildPad, removeAt: removeAt, hatch: hatch,
    setTool: setTool, switchView: switchView, fireDart: fireDart, dartTarget: dartTarget, sendRangers: sendRangers,
    panelAct: panelAct, select: function (what) { selected = what; panelText = ""; }, rate: rate,
    hire: function (type) { const why = hire(type); syncStaff(); return why; }, startResearch: startResearch, researchList: researchList,
    step: function (n) { for (let i = 0; i < n; i++) tick(0.05); },
  };
}

requestAnimationFrame(frame);
