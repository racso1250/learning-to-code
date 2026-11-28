// Dino Island 100: the game.
// Money, the camera, the mouse and keys, the build tools, the panels (paddocks, camps, labs and staff),
// the Dinodex, the little map, the ranger jeep and its fossil sites, storms, your jobs, and saving.

// ===== 1. What the game remembers =====
const SAVE = "dino100-save";

function freshState() {
  const s = {
    money: 3000,
    time: 0,
    tiles: {},        // what is built on each square: { "80,159": "path" ... }
    pads: [],         // paddocks: { id, i0, k0, i1, k1, kind, fence, hp, breach }
    dinos: [],        // dinosaurs: { id, kind, pad, x, z, grow, hunger, comfort, mood, loose ... }
    stations: [],     // monorail stations, in the order they were built
    labs: {},         // research labs and expedition camps: { "i,k": { job } }
    known: {},        // the kinds of dinosaur you have discovered
    fresh: {},        // the ones you have not looked at in the Dinodex yet
    tech: {},         // the inventions your labs have made
    staff: { keeper: 1, ranger: 0, scientist: 1, guide: 0 },
    sites: [],        // fossil sites hidden around the island: { x, z, biome, found }
    fix: {},          // the two paddocks that start with a problem
    wageClock: 0,
    nextId: 1,
    stars: 0, best: 0, points: 0, regions: 1,
    scare: 0,         // how frightened the visitors have been lately
    arrived: 0, served: 0, escapes: 0, caught: 0, trips: 0,
    goal: 0,          // which job you are on
    nextGuest: 3, nextStorm: 420, stormUntil: 0,
    nextRaid: 240, raidUntil: 0,      // when wild Pteranodons will next attack the monorail
    won: false,
    jeep: { x: mid(GATE.i) + 8, z: HALF - 6, yaw: 0 },
  };
  readyPark(s);       // (in layout.js) the park is already built when you arrive
  return s;
}

let state = freshState();
let mode = "intro";          // intro, play or won
let view = "park";           // "park" (looking down, building) or "jeep" (driving)
let tool = "look";
let group = "homes";         // which tab of the toolbar is showing
let speed = 1;               // 0 = paused, 1 = normal, 3 = fast
let selected = null;         // what the side panel is showing: { type: "pad" / "lab" / "staff", ... }
let dexOpen = false;         // is the Dinodex showing? (The game waits while you read it.)
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
const cam = { x: mid(GATE.i), z: mid(142), yaw: 0, dist: 120 };

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

// A message with a picture of a dinosaur, for when you discover a new one
function sayFound(kind, text) {
  el("toast").innerHTML = pic(kind) + "<span>" + text + "</span>";
  el("toast").hidden = false;
  toastUntil = wall + 8;
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
  const rexPad = padById(state.fix.rex);
  const triPad = padById(state.fix.tri);
  if (n === 0) return !state.dinos.some(function (d) { return d.loose; });
  if (n === 1) return !rexPad || rexPad.hp >= padMax(rexPad) * 0.9;
  if (n === 2) return !triPad || feedersIn(triPad, "plants").length > 0;
  if (n === 3) return state.staff.ranger > 0;
  if (n === 4) return state.trips > 0;
  if (n === 5) return state.dinos.some(function (d) { return !STARTERS.includes(d.kind); });
  if (n === 6) return knownCount() >= 15;
  if (n === 7) return MIXES.some(function (mix) { return state.known[mix[0]]; });
  if (n === 8) return state.best >= 3;
  if (n === 9) return knownCount() >= 40;
  if (n === 10) return state.best >= 5;
  if (n === 11) return state.dinos.some(function (d) { return SPECIES[d.kind].home === "water"; }) && state.dinos.some(function (d) { return SPECIES[d.kind].home === "air"; });
  if (n === 12) return state.dinos.some(function (d) { return d.kind === "h_overlord"; });
  return knownCount() >= TOTAL;
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
  el("goal").textContent = state.goal < GOALS.length ? "Job " + (state.goal + 1) + " of " + GOALS.length + ": " + GOALS[state.goal].text : "Every creature discovered! The island is yours to build any way you like";
}

function win() {
  state.won = true;
  sound(playJingle);
  save();
  el("won-text").textContent = "You discovered all " + TOTAL + " creatures, hybrids and all! Your park has " + state.dinos.length + " dinosaurs in " + state.pads.length + " paddocks, your teams went on " + state.trips + " expeditions, " + state.arrived + " visitors came, and you caught " + state.caught + " runaways. It took you " + Math.round(state.time / 60) + " minutes.";
  el("won").hidden = false;
  mode = "won";
}

// ===== 4. Pictures of dinosaurs =====
// A tiny second 3D picture-maker takes a snapshot of each kind of dinosaur the first time one is needed.
// The snapshot is kept as a style rule, so the page can show it wherever a <i class="pic pic-rex"> is.
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
      const model = makeDino(kind).group;
      snap.scene.add(model);
      // Measure the model, then stand the camera far enough back to fit all of it in
      const box = new THREE.Box3().setFromObject(model);
      const middle = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const far = Math.max(size.z * 1.6 + size.x, size.y * 2.5);
      snap.camera.position.set(middle.x + far * 0.72, middle.y + far * 0.22, middle.z - far * 0.66);
      snap.camera.lookAt(middle);
      snap.renderer.render(snap.scene, snap.camera);
      el("pics").appendChild(document.createTextNode(".pic-" + kind + "{background-image:url(" + snap.renderer.domElement.toDataURL("image/png") + ")}"));
      // Tidy up: the model is not needed once its picture has been taken
      snap.scene.remove(model);
      model.traverse(function (part) {
        if (!part.isMesh) return;
        if (part.geometry !== ballShape) part.geometry.dispose();
        part.material.dispose();
      });
    } catch (problem) { /* no picture is fine */ }
  }
  return '<i class="pic pic-' + kind + '"></i>';
}

// ===== 5. The side panel: a paddock, a camp, a lab, or your staff =====
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
  const max = padMax(pad);
  if (pad.kind === "arena") {
    // The feeding show
    const waiting = Math.ceil((pad.nextShow || 0) - state.time);
    html += '<p class="small">' + (showOn(pad) ? '<span class="got">SHOW TIME! The crowd is going wild.</span>' : "Dangle a big fish from the crane, and the biggest creature in the pool leaps up to grab it. Every visitor near enough pays $8 to watch. (A tour guide puts on shows for free.)") + "</p>";
    html += '<button data-act="show"' + (showOn(pad) || waiting > 0 || state.money < 100 ? " disabled" : "") + ">" + (waiting > 0 && !showOn(pad) ? "Next show in " + waiting + " seconds" : "Start a feeding show: $100") + "</button>";
  }
  if (!wet(pad)) {
    const wallName = pad.kind === "land" ? FENCES[pad.fence].name : pad.kind === "air" ? "Net" : pad.kind === "vault" ? "Walls and doors" : "Bars";
    html += '<p class="small">' + wallName + ": " + Math.ceil(pad.hp) + " of " + Math.round(max) + (pad.breach ? ' <span class="need">BROKEN!</span>' : "") + "</p>";
    if (pad.hp < max) html += '<button data-act="fix"' + (state.money < fixCost(pad) ? " disabled" : "") + ">Mend it: $" + fixCost(pad) + "</button>";
  }
  if (pad.kind === "land") {
    for (const to of ["steel", "electric"]) {
      if (FENCES[to].hp > FENCES[pad.fence].hp) html += '<button data-act="fence-' + to + '"' + (state.money < upgradeCost(pad, to) ? " disabled" : "") + ">Change to " + FENCES[to].name.toLowerCase() + ": $" + upgradeCost(pad, to) + "</button>";
    }
  }
  if (pad.kind === "vault" && !pad.breach) {
    // The great doors: open for a show, shut for safety
    html += '<p class="small">The doors are <b>' + (pad.open ? "OPEN" : "shut") + "</b>. " + (pad.open ? "Visitors get a wonderful view. But if anything in here gets angry, it will walk straight out!" : "Visitors can only hear what is inside. Open the doors to give them a show.") + "</p>";
    html += '<button data-act="doors">' + (pad.open ? "Shut the doors" : "Open the doors") + "</button>";
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
  // The kinds you know, with the ones that like this region first, and then the cheapest first
  // (Only the ones that can live in this sort of home.)
  const fits = wet(pad) ? "water" : pad.kind === "air" ? "air" : "land";
  const kinds = Object.keys(state.known).filter(function (kind) {
    const sp = SPECIES[kind];
    if (sp.home !== fits || (pad.kind === "den" && sp.plan !== "R")) return false;
    return !(sp.vault && pad.kind !== "vault") && !(sp.pit && pad.kind !== "pit" && pad.kind !== "vault");
  }).sort(function (a, b) {
    return (SPECIES[a].biome === biome ? 0 : 1) - (SPECIES[b].biome === biome ? 0 : 1) || SPECIES[a].cost - SPECIES[b].cost;
  });
  for (const kind of kinds) {
    const sp = SPECIES[kind];
    html += '<button class="egg" data-act="hatch-' + kind + '"' + (state.money < sp.cost ? " disabled" : "") + ">" + pic(kind) + "<span><b>" + sp.name + "</b> $" + sp.cost + "<br>Eats " + sp.diet + ". Needs " + sp.need + " squares" + (sp.herd > 1 ? " and " + (sp.herd - 1) + " friend" + (sp.herd > 2 ? "s" : "") : "") + "." + (sp.biome !== biome && pad.kind !== "den" ? ' <span class="need">Likes ' + BIOMES[sp.biome].name + " best.</span>" : ' <span class="got">Likes it here.</span>') + "</span></button>";
  }
  if (!kinds.length) html += '<p class="small">You have not discovered anything that can live in ' + (fits === "water" ? "a lagoon" : fits === "air" ? "an aviary" : "here") + " yet.</p>";
  html += '<p class="small">' + (TOTAL - knownCount()) + " more kinds are waiting to be discovered. Send out expeditions, drive the jeep to fossil sites, and make hybrids in a lab.</p>";
  return html;
}

// An expedition camp or a research lab: what it is doing, and what it could do next
function labPanel(key) {
  const lab = state.labs[key];
  const camp = state.tiles[key] === "camp";
  const team = workers.filter(function (w) { return w.type === "scientist" && w.lab === key; }).length;
  let html = "<h2>" + (camp ? "Expedition camp" : "Research lab") + "</h2>";
  html += '<p class="small">' + (camp ? "Send a team by helicopter to any region of the island. They come back with a kind of dinosaur you have not seen before." : "Mix two kinds of dinosaur you know to make a hybrid: a brand new dinosaur with the best bits of both.") + "</p>";
  if (lab.job) {
    const done = Math.round((1 - lab.job.left / lab.job.total) * 100);
    html += '<p class="small"><b>' + lab.job.name + '</b></p><div class="meter"><div style="width:' + done + '%"></div></div><p class="small">' + done + "% done" + (team ? "" : '. <span class="need">Nobody is working on it! Every busy camp and lab needs a scientist of its own. Press Staff and hire one.</span>') + "</p>";
  } else {
    html += '<p class="small">' + (state.staff.scientist ? "" : '<span class="need">You have no scientists! Press Staff and hire one. </span>') + (camp ? "Where shall the team go?" : "Choose something to work on:") + "</p>";
  }
  const list = researchList(state.tiles[key]);
  // Things you can't do yet go at the bottom
  list.sort(function (a, b) { return (a.locked ? 1 : 0) - (b.locked ? 1 : 0); });
  for (const item of list) {
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
  } else if (act === "show") {
    attempt(startShow(pad, false));
  } else if (act === "doors") {
    pad.open = !pad.open;
    sound(function () { playNoise(0, 0.9, 200, 90, 0.3); playTone(0, 0.9, 80, 60, 0.2); });
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

// ===== 6. Warnings =====
function drawAlerts() {
  const lines = [];
  const loose = state.dinos.filter(function (d) { return d.loose && d.mood !== "lift" && d.mood !== "asleep"; });
  if (loose.length) {
    lines.push('<p class="bad" data-loose="1">' + loose.length + " dinosaur" + (loose.length > 1 ? "s are" : " is") + " ON THE LOOSE! " + (state.staff.ranger ? "Your rangers are on their way." : "Press J for the jeep, drive close, and press Space.") + ' <button data-act="rangers"' + (state.money < 250 ? " disabled" : "") + ">Emergency team: $250</button></p>");
  }
  for (const pad of state.pads) {
    const angry = state.dinos.filter(function (d) { return d.pad === pad.id && d.mood === "angry" && !d.loose; });
    if (!angry.length) continue;
    lines.push('<p class="bad" data-pad="' + pad.id + '">' + SPECIES[angry[0].kind].name + " in paddock " + (state.pads.indexOf(pad) + 1) + " is ANGRY" +  (wet(pad) ? "" : " and bashing its way out (" + Math.round(pad.hp / padMax(pad) * 100) + "% left)") + ". Click here to see why.</p>");
  }
  // Hungry dinosaurs with no feeder, and fences that are nearly broken
  for (const pad of state.pads) {
    const hungry = state.dinos.find(function (d) { return d.pad === pad.id && !d.loose && d.mood === "calm" && d.hunger < 30 && !feedersIn(pad, SPECIES[d.kind].diet).length; });
    if (hungry) lines.push('<p data-pad="' + pad.id + '">' + SPECIES[hungry.kind].name + " in paddock " + (state.pads.indexOf(pad) + 1) + " is hungry and has no " + (SPECIES[hungry.kind].diet === "plants" ? "plant" : SPECIES[hungry.kind].diet) + " feeder. Click here.</p>");
    else if (pad.hp < padMax(pad) * 0.35 && !state.dinos.some(function (d) { return d.pad === pad.id && d.mood === "angry"; })) lines.push('<p data-pad="' + pad.id + '">The fence of paddock ' + (state.pads.indexOf(pad) + 1) + " is " + (pad.breach ? "BROKEN" : "nearly broken") + ". Click here to mend it.</p>");
  }
  if (raiding()) lines.push('<p class="bad" data-train="1">Wild Pteranodons are attacking the monorail! ' + (state.staff.ranger ? "A ranger is on the way." : "Drive the jeep to the train and press Space.") + ' <button data-act="flares"' + (state.money < 150 ? " disabled" : "") + ">Fire flares: $150</button></p>");
  for (const pad of state.pads) {
    if (pad.kind === "vault" && pad.open && state.dinos.some(function (d) { return d.pad === pad.id && d.mood === "angry" && !d.loose; })) lines.push('<p class="bad" data-pad="' + pad.id + '">The vault doors are OPEN and something inside is ANGRY! Click here and shut them!</p>');
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

// ===== 7. The jeep, and the fossil sites it can find =====
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
  if (!target && raiding() && Math.hypot(trainCars[0].position.x - state.jeep.x, trainCars[0].position.z - state.jeep.z) < 70) {
    soundDart();
    return endRaid("Your dart whistles past them, and the Pteranodons flee!");
  }
  if (!target) return say("No angry or loose dinosaur is close enough in front of the jeep", 2);
  dartReady = state.time + 1.2;
  soundDart();
  dartFly = { target: target, t: 0 };
}

function driveJeep(dt) {
  const jeep = state.jeep;
  const push = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  jeepSpeed += push * 34 * dt;
  jeepSpeed *= Math.exp(-1.3 * dt);
  jeep.yaw += steer * 2 * dt * clamp(jeepSpeed / 5, -1, 1);
  const oldX = jeep.x;
  const oldZ = jeep.z;
  jeep.x = clamp(jeep.x - Math.sin(jeep.yaw) * jeepSpeed * dt, -HALF - 4, HALF + 4);
  jeep.z = clamp(jeep.z - Math.cos(jeep.yaw) * jeepSpeed * dt, -HALF - 4, HALF + 4);
  // Fences are solid: the jeep can't drive into a paddock
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

// A fossil site: a big old bone sticking out of the ground, with a beam of light you can see from far away
const siteModels = [];
function syncSites() {
  for (const model of siteModels) scene.remove(model);
  siteModels.length = 0;
  for (const site of state.sites) {
    if (site.found) continue;
    const g = new THREE.Group();
    const bone = paint(0xf4ecd8);
    piece(g, new THREE.CylinderGeometry(0.3, 0.3, 4, 7), bone, 0, 1.4, 0).rotation.z = 0.5;
    for (const s of [-1, 1]) {
      for (const side of [-0.35, 0.35]) ball(g, bone, 0.5, 0.5, 0.5, -s * 0.96 + side * 0.8, 1.4 + s * 1.76 + side * 0.4, 0);
    }
    piece(g, new THREE.CylinderGeometry(2.6, 3, 0.4, 9), paint(0x8a6a4a), 0, 0.1, 0);
    const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot, color: 0xffe14a, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    beam.scale.set(9, 110, 1);
    beam.position.y = 40;
    g.add(beam);
    g.position.set(site.x, 0, site.z);
    scene.add(g);
    siteModels.push(g);
  }
}

// Drive the jeep up to a fossil site to dig up a new kind of dinosaur
function checkSites() {
  for (const site of state.sites) {
    if (site.found || Math.hypot(site.x - state.jeep.x, site.z - state.jeep.z) > 9) continue;
    site.found = true;
    const list = findable(site.biome, 1);
    if (list.length) {
      const kind = list[Math.floor(Math.random() * list.length)];
      discover(kind, "You dug up the bones of a new dinosaur: " + SPECIES[kind].name + "!");
    } else {
      state.money += 500;
      soundCash();
      say("You dug up a lump of golden amber. A museum buys it for $500!", 5);
    }
    syncSites();
    save();
  }
}

// ===== 8. Storms =====
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

// ===== 9. One step of the game =====
function tick(dt) {
  state.time += dt;
  updateDinos(dt);
  updateGuests(dt);
  updateStaff(dt);
  updateFlock(dt);
  updateWeather(dt);
  moveTrain(dt);
  if (view === "jeep") {
    driveJeep(dt);
    checkSites();
  }
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

// ===== 10. The mouse =====
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

// The squares a new paddock would cover. Most are a box you drag out with the mouse.
// Dens, pits and vaults always come the same size, centred on the square you point at.
function padBox(from, to, kind) {
  const side = PADS[kind].side;
  if (side) {
    const i0 = to.i - Math.floor(side / 2);
    const k0 = to.k - Math.floor(side / 2);
    return { i0: i0, k0: k0, i1: i0 + side - 1, k1: k0 + side - 1 };
  }
  return { i0: Math.min(from.i, to.i), k0: Math.min(from.k, to.k), i1: Math.max(from.i, to.i), k1: Math.max(from.k, to.k) };
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
    const at = padBox(drag, spot, TOOLS[tool].pad);
    attempt(buildPad(at.i0, at.k0, at.i1, at.k1, TOOLS[tool].pad));
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
  cam.dist = clamp(cam.dist * (e.deltaY > 0 ? 1.12 : 0.89), 28, 420);
}, { passive: false });

// Click the little map to jump there
el("minimap").addEventListener("click", function (e) {
  if (mode !== "play") return;
  const box = el("minimap").getBoundingClientRect();
  if (view === "jeep") switchView();
  cam.x = ((e.clientX - box.left) / box.width - 0.5) * SIZE * TILE;
  cam.z = ((e.clientY - box.top) / box.height - 0.5) * SIZE * TILE;
});

// ===== 11. The Dinodex: every dinosaur you have discovered, and a "?" for each one you have not =====
function dexInfo(kind) {
  const sp = SPECIES[kind];
  if (!state.known[kind]) {
    if (!sp.parents) return "Not discovered yet. It lives somewhere in " + BIOMES[sp.biome].name + ", and it is " + RARITY[sp.tier] + ".";
    return "A hybrid nobody has made yet. A Research lab can make it from: " + sp.parents.map(function (parent) { return state.known[parent] ? SPECIES[parent].name : "???"; }).join(" + ") + ".";
  }
  return pic(kind) + "<span><b>" + sp.name + "</b> (" + RARITY[sp.tier] + ")<br>" + (sp.parents ? "A hybrid of " + SPECIES[sp.parents[0]].name + " and " + SPECIES[sp.parents[1]].name + ". " : "") + sp.size + " metres long. Eats " + sp.diet + ". Likes " + BIOMES[sp.biome].name + " best.<br>Needs " + sp.need + " squares of paddock" + (sp.herd > 1 ? " and " + (sp.herd - 1) + " friend" + (sp.herd > 2 ? "s" : "") : "") + ". An egg costs $" + sp.cost + ". Visitors give it " + sp.appeal + " points.</span>";
}

function drawDex() {
  let html = "";
  const groups = Object.keys(BIOMES).map(function (biome) {
    return { name: BIOMES[biome].name, kinds: Object.keys(SPECIES).filter(function (kind) { return SPECIES[kind].biome === biome && !SPECIES[kind].parents; }) };
  });
  groups.push({ name: "Hybrids", kinds: MIXES.map(function (mix) { return mix[0]; }) });
  for (const one of groups) {
    const found = one.kinds.filter(function (kind) { return state.known[kind]; }).length;
    html += "<h3>" + one.name + ": " + found + " of " + one.kinds.length + "</h3><div class=\"cells\">";
    for (const kind of one.kinds) {
      if (state.known[kind]) html += '<div class="cell tier' + SPECIES[kind].tier + (state.fresh[kind] ? " new" : "") + '" data-kind="' + kind + '">' + pic(kind) + SPECIES[kind].name + "</div>";
      else html += '<div class="cell unknown" data-kind="' + kind + '"><i class="pic">?</i>???</div>';
    }
    html += "</div>";
  }
  el("dex-list").innerHTML = html;
  el("dex-count").textContent = knownCount() + " of " + TOTAL + " discovered";
  el("dex-info").innerHTML = "Click a dinosaur to read about it.";
}

function showDex(on) {
  dexOpen = on;
  el("dex").hidden = !on;
  if (on) drawDex();
  else state.fresh = {};      // you have seen the new ones now
}

el("dex-list").addEventListener("click", function (e) {
  const cell = e.target.closest(".cell");
  if (cell) el("dex-info").innerHTML = dexInfo(cell.dataset.kind);
});
el("dex-open").addEventListener("click", function () {
  if (mode === "play") showDex(!dexOpen);
});
el("dex-close").addEventListener("click", function () {
  showDex(false);
});

// ===== 12. Keys and buttons =====
window.addEventListener("keydown", function (e) {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat || mode !== "play") return;
  if (e.code === "KeyB" || (dexOpen && e.code === "Escape")) return showDex(!dexOpen);
  if (dexOpen) return;
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
  if (button && button.dataset.act === "flares") {
    if (state.money >= 150) {
      state.money -= 150;
      endRaid("Whoosh! The flares send the Pteranodons flapping back to the volcano.");
    }
    return;
  }
  if (button) return sendRangers();
  const line = e.target.closest("p");
  if (!line) return;
  if (line.dataset.train && view === "park") {
    cam.x = trainCars[0].position.x;
    cam.z = trainCars[0].position.z;
  } else if (line.dataset.pad) {
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

// ===== 13. Drawing =====
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

// The seven regions never change, so they are painted once, on a hidden canvas (one dot for every square)
const mapBase = document.createElement("canvas");
mapBase.width = mapBase.height = SIZE;
(function () {
  const pen = mapBase.getContext("2d");
  for (let i = 0; i < SIZE; i++) {
    for (let k = 0; k < SIZE; k++) {
      pen.fillStyle = BIOMES[biomeAt(i, k)].map;
      pen.fillRect(i, k, 1, 1);
    }
  }
})();

// The little map in the corner: regions, paddocks, paths, the monorail, fossil sites, and trouble
function drawMap() {
  const pen = el("minimap").getContext("2d");
  pen.drawImage(mapBase, 0, 0);
  for (const key in state.tiles) {
    const n = key.split(",").map(Number);
    pen.fillStyle = state.tiles[key] === "path" ? "#fff4c8" : state.tiles[key] === "station" ? "#ffffff" : "#d8442e";
    pen.fillRect(n[0], n[1], 1.5, 1.5);
  }
  for (const pad of state.pads) {
    pen.strokeStyle = { land: "#5a3a1a", water: "#1a5a9a", air: "#ffffff", den: "#3a3a44", pit: "#8a1a1a", vault: "#000000", arena: "#1a5a9a" }[pad.kind];
    pen.lineWidth = 1.5;
    pen.strokeRect(pad.i0, pad.k0, pad.i1 - pad.i0 + 1, pad.k1 - pad.k0 + 1);
  }
  if (railStops.length > 1) {
    pen.strokeStyle = "#ffffff";
    pen.lineWidth = 1;
    pen.beginPath();
    railStops.forEach(function (stop, n) {
      if (n) pen.lineTo(stop.i + 0.5, stop.k + 0.5);
      else pen.moveTo(stop.i + 0.5, stop.k + 0.5);
    });
    if (railStops.length > 2) pen.closePath();
    pen.stroke();
  }
  // Fossil sites still waiting to be found
  for (const site of state.sites) {
    if (site.found) continue;
    pen.fillStyle = "#3a2a10";
    pen.fillRect((site.x + HALF) / TILE - 2.5, (site.z + HALF) / TILE - 2.5, 5, 5);
    pen.fillStyle = "#ffe14a";
    pen.fillRect((site.x + HALF) / TILE - 1.5, (site.z + HALF) / TILE - 1.5, 3, 3);
  }
  // Expedition helicopters
  for (const key in tripHelis) {
    pen.fillStyle = "#ff7a2a";
    pen.fillRect((tripHelis[key].position.x + HALF) / TILE - 2, (tripHelis[key].position.z + HALF) / TILE - 2, 4, 4);
  }
  for (const d of state.dinos) {
    if (!d.loose && d.mood !== "angry") continue;
    pen.fillStyle = Math.sin(wall * 8) > 0 ? "#ff2a1a" : "#ffffff";
    pen.fillRect((d.x + HALF) / TILE - 2.5, (d.z + HALF) / TILE - 2.5, 5, 5);
  }
  // Where you are looking
  const at = view === "jeep" ? state.jeep : cam;
  pen.strokeStyle = "#000000";
  pen.lineWidth = 1;
  pen.strokeRect((at.x + HALF) / TILE - 7, (at.z + HALF) / TILE - 5, 14, 10);
}

function drawHud() {
  const next = STAR_POINTS[state.stars];
  const at = view === "jeep" ? state.jeep : cam;
  const biome = biomeAt(clamp(tileOf(at.x), 0, SIZE - 1), clamp(tileOf(at.z), 0, SIZE - 1));
  setText("money", "$" + Math.floor(state.money));
  setText("stars", "★".repeat(state.stars) + "☆".repeat(5 - state.stars) + (next ? " <small>" + Math.floor(state.points) + "/" + next + "</small>" : ""));
  setText("crowd", guests.length + " visitors");
  setText("place", BIOMES[biome].name);
  const fresh = Object.keys(state.fresh).length;
  setText("dex-open", "B: Dinodex " + knownCount() + "/" + TOTAL + (fresh ? " <b>NEW!</b>" : ""));
  for (const n of [0, 1, 3]) el("speed" + n).classList.toggle("on", speed === n);
  setText("jeep", view === "jeep" ? "J: park" : "J: jeep");

  let hint = "";
  if (mode === "play" && view === "jeep") {
    const loose = state.dinos.filter(function (d) { return d.loose && d.mood !== "asleep" && d.mood !== "lift"; });
    const target = dartTarget();
    if (target) hint = "Space: fire a sleepy dart at the " + SPECIES[target.kind].name;
    else if (loose.length) hint = arrowTo(loose[0].x, loose[0].z) + " Loose " + SPECIES[loose[0].kind].name + ": " + Math.round(Math.hypot(loose[0].x - state.jeep.x, loose[0].z - state.jeep.z)) + " m away";
    else {
      // Nothing to catch: point the way to the nearest fossil site instead
      let near = null;
      for (const site of state.sites) {
        if (!site.found && (!near || Math.hypot(site.x - state.jeep.x, site.z - state.jeep.z) < Math.hypot(near.x - state.jeep.x, near.z - state.jeep.z))) near = site;
      }
      hint = "W, A, S, D: drive. J: back to the park." + (near ? " " + arrowTo(near.x, near.z) + " Fossil site in " + BIOMES[near.biome].name + ": " + Math.round(Math.hypot(near.x - state.jeep.x, near.z - state.jeep.z)) + " m" : "");
    }
  } else if (mode === "play") {
    hint = TOOLS[tool].what;
    if (TOOLS[tool].pad && hover && (drag || PADS[TOOLS[tool].pad].side)) {
      const at = padBox(drag || hover, hover, TOOLS[tool].pad);
      const wide = at.i1 - at.i0 + 1;
      const deep = at.k1 - at.k0 + 1;
      const why = whyNoPad(at.i0, at.k0, at.i1, at.k1, TOOLS[tool].pad);
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
      cam.dist = clamp(cam.dist * (1 + ((keys.KeyX ? 1 : 0) - (keys.KeyZ ? 1 : 0)) * dt), 28, 420);
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
    if (TOOLS[tool].pad && (drag || PADS[TOOLS[tool].pad].side)) {
      const at = padBox(drag || hover, hover, TOOLS[tool].pad);
      cursor.position.set((at.i0 + at.i1 + 1) / 2 * TILE - HALF, 0.2, (at.k0 + at.k1 + 1) / 2 * TILE - HALF);
      cursor.scale.set((at.i1 - at.i0 + 1) * TILE, 1, (at.k1 - at.k0 + 1) * TILE);
      bad = whyNoPad(at.i0, at.k0, at.i1, at.k1, TOOLS[tool].pad);
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
    if (!fence) continue;
    fence.userData.postPaint.emissive.setHex(state.time - (pad.hitAt || -9) < 0.5 && Math.sin(wall * 20) > 0 ? 0xaa1a0a : 0x000000);
    // A stadium's bait swings on its rope. In a show it is lowered right down to the water.
    if (fence.userData.bait) {
      fence.userData.bait.rotation.z = Math.sin(wall * 1.4) * 0.12;
      fence.userData.bait.position.y += ((showOn(pad) ? 10.5 : 14.3) - fence.userData.bait.position.y) * Math.min(1, dt * 2);
    }
    // A vault's doors slide slowly apart, or back together
    for (const door of fence.userData.doors || []) {
      const to = door.shut + (pad.open ? door.side * door.slide : 0);
      door.mesh.position.x += (to - door.mesh.position.x) * Math.min(1, dt * 1.5);
    }
  }

  poseDinos(wall);
  drawGuests(wall);
  drawStaff(wall);
  drawTrips(dt * (mode === "play" && !dexOpen ? speed : 0));
  drawFlock(wall);
  drawHud();
}

// ===== 14. Saving =====
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
  syncSites();
  rate();
  showDex(false);
  view = "park";
  el("toolbar").hidden = false;
  group = "homes";
  tool = "look";
  drawToolbar();
  selected = null;
  speed = 1;
  lastSave = lastCheck = state.time;
  cam.x = mid(GATE.i);
  cam.z = mid(142);
  cam.yaw = 0;
  cam.dist = 120;
  for (const id of ["intro", "won"]) el(id).hidden = true;
  mode = "play";
  checkGoals();
}

// ===== 15. Go! =====
refreshPark();
syncStaff();
syncSites();
rate();
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
  if (mode === "play" && !dexOpen) {
    for (let n = 0; n < speed; n++) tick(dt);
  }
  draw(dt);
  renderer.render(scene, camera);
}

// For testing the game with a script: add ?test to the address
if (testing) {
  begin(null);
  window.DI = {
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
    discover: discover, findable: findable, knownCount: knownCount, showDex: showDex, dexInfo: dexInfo, pic: pic, checkGoals: checkGoals, padPanel: padPanel, labPanel: labPanel,
    step: function (n) { for (let i = 0; i < n; i++) tick(0.05); },
  };
}

requestAnimationFrame(frame);
