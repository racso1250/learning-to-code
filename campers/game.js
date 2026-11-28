// Camp Fossil Bay: the game.
// Leading your friends, swapping between them, their special skills, the things in your way,
// hearts and campfires, the story, and saving.

// ===== 1. What the game remembers =====
const SAVE = "campers-save";
const HEARTS = 6;

function freshState() {
  return {
    time: 0,
    party: ["tavi"],         // who is with you. The first one is the camper you are steering.
    bonk: false,             // has Bonk joined?
    hearts: HEARTS,
    flares: 1, fuses: 0, key: false,
    done: {},                // the things you have dealt with: { camplog: true ... }
    calm: false,             // have the Triceratops been calmed?
    called: false,           // has the radio call been made?
    ferryAt: 0,              // when the ferry will reach the pier
    fire: 0,                 // the last campfire you rested at
    flare: null,             // the flare that is burning right now: { x, z, until }
    warned: false,           // have your friends spotted the Shimmer yet?
    goal: 0,
    won: false,
  };
}

let state = freshState();
const me = { x: mid(START.i), z: mid(START.k), yaw: Math.PI, moving: false, running: false, hidden: false, dashUntil: 0, safeUntil: 0 };
const skillAt = {};          // when each camper can use their skill again: { tavi: 12.5 ... }
let mode = "intro";          // intro, play, talk or won
let near = null;             // what E would do right now: { text, act }
let shake = 0;
let wall = 0;                // a clock that never stops (for animations)
let hurtAt = -9;
let stepAt = 0;
let lastCheck = 0;
const trail = [];            // where the leader has just walked (the others follow along it)
const keys = {};

function lead() {
  return CAMPERS.find(function (one) { return one.id === state.party[0]; });
}

function has(id) {
  return state.party.includes(id);
}

// ===== 2. Sounds and messages =====
function sound(make) {
  try { make(); } catch (problem) { /* no sound is fine */ }
}
function soundPick() { sound(function () { playTone(0, 0.08, 600, 900, 0.12); }); }
function soundNo() { sound(function () { playTone(0, 0.15, 220, 160, 0.12); }); }
function soundGot() { sound(function () { playTone(0, 0.1, 520, 660, 0.14); playTone(0.11, 0.1, 660, 780, 0.14); playTone(0.22, 0.22, 780, 1040, 0.14); }); }
function soundTalk() { sound(function () { playTone(0, 0.05, 500 + Math.random() * 300, 600 + Math.random() * 300, 0.06); }); }
function soundGrowl() { sound(function () { playNoise(0, 0.6, 300, 100, 0.3); playTone(0, 0.5, 140, 80, 0.25); }); }
function soundRoar() { sound(function () { playNoise(0, 1.4, 400, 60, 0.5); playTone(0, 1.2, 150, 45, 0.4); }); }
function soundCrash() { sound(function () { playNoise(0, 0.6, 600, 80, 0.4); }); }
function soundHurt() { sound(function () { playTone(0, 0.2, 300, 120, 0.25); }); }

const el = function (id) { return document.getElementById(id); };
let toastUntil = 0;
function say(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastUntil = wall + (seconds || 3);
}

// ----- Talking: a list of pages, each with who says it -----
let talk = null;
function openTalk(pages, after) {
  talk = { pages: pages, n: 0, after: after || null };
  mode = "talk";
  drawTalk();
}

function drawTalk() {
  const page = talk.pages[talk.n];
  el("talk").hidden = false;
  el("talk-who").textContent = page[0];
  el("talk-who").hidden = !page[0];
  el("talk-text").textContent = page[1];
  soundTalk();
}

function nextTalk() {
  if (!talk) return;
  talk.n++;
  if (talk.n < talk.pages.length) return drawTalk();
  const after = talk.after;
  talk = null;
  el("talk").hidden = true;
  mode = "play";
  if (after) after();
}

// ===== 3. The map =====
function groundAt(x, z) {
  const i = tileOf(x);
  const k = tileOf(z);
  if (i < 0 || k < 0 || i >= COLS || k >= ROWS) return "edge";
  return MAP.ground[k][i];
}

// Can a camper stand here? (Not in water or on a cliff, not inside a tree or a building,
// and not where something is still blocking the way.)
function canStand(x, z) {
  const type = groundAt(x, z);
  if (type === "edge" || type === "water" || type === "rock") return false;
  const i = tileOf(x);
  const k = tileOf(z);
  if (MAP.things[i + "," + k]) return false;
  for (const object of OBJECTS) {
    if (!object.block || state.done[object.id]) continue;
    if (i >= object.block[0] && i <= object.block[2] && k >= object.block[1] && k <= object.block[3]) return false;
  }
  // Big plant-eaters are solid too: you can't squeeze past a Triceratops
  for (const d of dinos) {
    if ((d.act === "block" || d.act === "calm") && Math.hypot(d.x - x, d.z - z) < SPECIES[d.kind].size * 0.28) return false;
  }
  return true;
}

// The drawbridge comes down: the river squares under it turn into wooden bridge
function lowerBridge() {
  for (let k = 28; k <= 30; k++) {
    for (let i = 41; i <= 48; i++) {
      if (MAP.ground[k][i] === "water") MAP.ground[k][i] = "wood";
    }
  }
  paintGround();
}

// Which campfire are you resting at? (-1 = none)
function nearFire() {
  for (let n = 0; n < FIRES.length; n++) {
    if (Math.hypot(mid(FIRES[n].i) - me.x, mid(FIRES[n].k) - me.z) < 3.2) return n;
  }
  return -1;
}

// ===== 4. The campers =====
const people = {};           // each camper's model, and where they are: { model, x, z, yaw, moving }
function makePeople() {
  for (const camper of CAMPERS) {
    const model = makePerson({ animal: "human", fur: camper.skin, face: camper.skin, shirt: camper.shirt, hair: camper.hair });
    const sign = new THREE.Sprite(SIGNS.help);
    scene.add(model.group, sign);
    const spot = FRIENDS[camper.id] || START;
    people[camper.id] = { model: model, sign: sign, x: mid(spot.i), z: mid(spot.k), yaw: 0, moving: false };
  }
}

function moveMe(dt) {
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  me.moving = !!(ahead || side);
  const dashing = state.time < me.dashUntil;
  me.running = me.moving && (dashing || !!(keys.ShiftLeft || keys.ShiftRight));
  me.hidden = groundAt(me.x, me.z) === "tall";
  if (!me.moving) return;
  const speed = dashing ? 10 : me.running ? 6.2 : 3.6;
  const long = Math.hypot(ahead, side);
  const dx = side / long * speed * dt;
  const dz = -ahead / long * speed * dt;
  me.yaw = Math.atan2(dx, dz);
  const pad = 0.3;
  if (canStand(me.x + dx + Math.sign(dx) * pad, me.z)) me.x += dx;
  if (canStand(me.x, me.z + dz + Math.sign(dz) * pad)) me.z += dz;
  // Leave a trail of footsteps for the others to follow
  const last = trail[trail.length - 1];
  if (!last || Math.hypot(last.x - me.x, last.z - me.z) > 0.3) {
    trail.push({ x: me.x, z: me.z });
    if (trail.length > 160) trail.shift();
  }
  if (wall > stepAt) {
    stepAt = wall + (me.running ? 0.24 : 0.4);
    sound(function () { playNoise(0, 0.04, me.hidden ? 1500 : 500, me.hidden ? 700 : 250, 0.03); });
  }
}

// Everybody else walks along the leader's trail, one behind another. (Bonk comes last.)
function moveFollowers(dt) {
  const line = state.party.slice(1);
  if (state.bonk) line.push("bonk");
  line.forEach(function (id, n) {
    const who = id === "bonk" ? dinos.find(function (d) { return d.act === "bonk"; }) : people[id];
    if (id === "bonk" && who.charge) return;
    const spot = trail[trail.length - 1 - (n + 1) * 5] || trail[0] || me;
    const dx = spot.x - who.x;
    const dz = spot.z - who.z;
    const far = Math.hypot(dx, dz);
    who.moving = far > 0.25 ? (id === "bonk" ? 4 : true) : (id === "bonk" ? 0 : false);
    if (far > 30) {
      // Left far behind: catch up in a flash
      who.x = spot.x;
      who.z = spot.z;
    } else if (far > 0.25) {
      const step = Math.min(far, (state.time < me.dashUntil ? 10.5 : me.running ? 6.6 : 4) * dt);
      who.x += dx / far * step;
      who.z += dz / far * step;
      who.yaw = id === "bonk" ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
    }
  });
  const leader = people[state.party[0]];
  leader.x = me.x;
  leader.z = me.z;
  leader.yaw = me.yaw;
  leader.moving = me.moving;
}

// Swap to another camper. They come to the front, and the one you were steering drops back.
function swapTo(n) {
  const camper = CAMPERS[n];
  if (!camper || !has(camper.id)) return say(camper ? "You have not found " + camper.name + " yet." : "", 2);
  if (state.party[0] === camper.id) return;
  const old = people[state.party[0]];
  const now = people[camper.id];
  // They swap places, so the new leader is where you are
  const spot = { x: now.x, z: now.z };
  now.x = old.x;
  now.z = old.z;
  old.x = spot.x;
  old.z = spot.z;
  state.party.splice(state.party.indexOf(camper.id), 1);
  state.party.unshift(camper.id);
  soundPick();
  say(camper.name + ", the " + camper.job.toLowerCase() + ". " + camper.what, 4);
}

// ===== 5. Hearts =====
function hurt(amount, from, text) {
  if (state.time < me.safeUntil || mode !== "play") return;
  state.hearts -= amount;
  me.safeUntil = state.time + 2;
  hurtAt = wall;
  shake = Math.max(shake, 0.5);
  soundHurt();
  if (text) say(text, 5);
  if (from) {
    // Knocked back, away from whatever hit you
    const far = Math.max(0.1, Math.hypot(me.x - from.x, me.z - from.z));
    const x = me.x + (me.x - from.x) / far * 3;
    const z = me.z + (me.z - from.z) / far * 3;
    if (canStand(x, z)) {
      me.x = x;
      me.z = z;
    }
  }
  if (state.hearts <= 0) retreat();
}

// Out of hearts: everybody runs back to the last campfire. Nobody is ever really hurt.
function retreat() {
  state.hearts = HEARTS;
  state.flare = null;
  gather(FIRES[state.fire]);
  me.safeUntil = state.time + 5;
  resetDinos();
  openTalk([["", "That was too close! Everybody runs for it, all the way back to the campfire at " + FIRES[state.fire].name + ". You catch your breath, and count heads. All here. Let's try that again."]]);
}

// Put the whole party at one spot
function gather(spot) {
  me.x = mid(spot.i);
  me.z = mid(spot.k) + 3;
  me.yaw = 0;
  trail.length = 0;
  for (const id of state.party) {
    people[id].x = me.x;
    people[id].z = me.z;
  }
  const bonk = dinos.find(function (d) { return d.act === "bonk"; });
  if (state.bonk) {
    bonk.x = me.x;
    bonk.z = me.z;
    bonk.charge = null;
  }
}

// ===== 6. Skills (Q), and flares (G) =====
function useSkill() {
  const camper = lead();
  if (state.time < (skillAt[camper.id] || 0)) return say("Not yet! " + camper.name + " needs a moment.", 2);
  if (camper.id === "tavi") {
    me.dashUntil = state.time + 4;
    skillAt.tavi = state.time + 10;
    sound(function () { playNoise(0, 0.3, 800, 2500, 0.15); });
    say("Tavi shouts 'RUN!' and everybody sprints!", 3);
  } else if (camper.id === "nell") {
    if (state.hearts >= HEARTS) return say("Nobody is hungry just now.", 2);
    state.hearts = Math.min(HEARTS, state.hearts + 2);
    skillAt.nell = state.time + 25;
    soundGot();
    say("Nell hands round cheese crackers. Everybody feels much better!", 3);
  } else if (camper.id === "ren") {
    if (!state.bonk) return say("Bonk is not with you yet.", 2);
    skillAt.ren = state.time + 4;
    bonkCharge();
  } else {
    say(camper.name + ": " + camper.what, 4);
  }
}

// Bonk puts his hard little head down and charges: at a wall of branches, or at any Compsognathus
function bonkCharge() {
  const bonk = dinos.find(function (d) { return d.act === "bonk"; });
  const wallNear = OBJECTS.find(function (o) { return o.type === "barricade" && !state.done[o.id] && Math.hypot(mid(o.i) - me.x, mid(o.k) - me.z) < 9; });
  sound(function () { playTone(0, 0.25, 500, 800, 0.2); });
  if (wallNear) {
    bonk.charge = { x: mid(wallNear.i), z: mid(wallNear.k), object: wallNear };
    say("'Bonk, CHARGE!' Bonk scrapes the ground with one foot...", 3);
  } else {
    bonk.charge = { x: me.x + Math.sin(me.yaw) * 7, z: me.z + Math.cos(me.yaw) * 7, object: null };
    let count = 0;
    let ghost = false;
    for (const d of dinos) {
      if ((d.act === "pest" && Math.hypot(d.x - me.x, d.z - me.z) < 12) || (d.act === "ghost" && Math.hypot(d.x - me.x, d.z - me.z) < 16)) {
        d.until = state.time + 14;
        d.mood = "roam";
        count++;
        if (d.act === "ghost") ghost = true;
      }
    }
    say(ghost ? "Bonk charges straight at the Shimmer, head down. It turns and slinks away!" : count ? "Bonk charges, and the Compsognathus scatter!" : "Bonk charges about happily. There is nothing here to bonk.", 3);
  }
}

function updateBonk(dt) {
  const bonk = dinos.find(function (d) { return d.act === "bonk"; });
  bonk.charging = !!bonk.charge;
  if (!bonk.charge) return;
  const dx = bonk.charge.x - bonk.x;
  const dz = bonk.charge.z - bonk.z;
  const far = Math.hypot(dx, dz);
  bonk.yaw = Math.atan2(-dx, -dz);
  bonk.moving = 9;
  if (far > 0.8) {
    bonk.x += dx / far * 9 * dt;
    bonk.z += dz / far * 9 * dt;
    return;
  }
  if (bonk.charge.object) {
    finish(bonk.charge.object);
    soundCrash();
    shake = 0.5;
    say("CRASH! Bonk smashes right through. Good boy, Bonk!", 4);
  }
  bonk.charge = null;
}

function throwFlare() {
  if (!state.flares) return say("You have no flares. Look for crates with a red mark.", 3);
  state.flares--;
  let far = 9;
  while (far > 2 && !canStand(me.x + Math.sin(me.yaw) * far, me.z + Math.cos(me.yaw) * far)) far -= 1.5;
  state.flare = { x: me.x + Math.sin(me.yaw) * far, z: me.z + Math.cos(me.yaw) * far, until: state.time + 8 };
  sound(function () { playNoise(0, 0.4, 3000, 1200, 0.2); });
  say("Fssssh! Meat-eaters can't help going to look at a flare. Sneak away!", 3);
}

// ===== 7. Things in your way =====
const objectModels = {};
const NEEDS = { log: "gus", barricade: "ren", climb: "bex", fusebox: "milo" };

function finish(object) {
  state.done[object.id] = true;
  if (objectModels[object.id] && object.type !== "fusebox" && object.type !== "climb") objectModels[object.id].visible = false;
  if (object.id === "cliff") lowerBridge();
  checkGoals();
}

function useObject(object) {
  const camper = lead();
  if (object.type === "crate") {
    finish(object);
    soundGot();
    if (object.has === "flare") {
      state.flares += 2;
      say("Two flares! Press G to throw one. Meat-eaters go and stare at it.", 5);
    } else if (object.has === "fuse") {
      state.fuses++;
      say("A fuse! Milo can use it to mend a fuse box.", 4);
    } else {
      state.key = true;
      say(object.text, 4);
    }
    return;
  }
  if (object.type === "door") {
    if (!state.key) return say("The mess hall door is locked, and somebody is shouting inside! The key must be in one of the cabins...", 5);
    finish(object);
    return join("milo");
  }
  const need = CAMPERS.find(function (one) { return one.id === NEEDS[object.type]; });
  if (!has(need.id)) return say("You can't get past this without " + need.name + ", the " + need.job.toLowerCase() + ".", 4);
  if (camper.id !== need.id) return say("This is a job for " + need.name + ", the " + need.job.toLowerCase() + ". Press " + (CAMPERS.indexOf(need) + 1) + " to swap to " + need.name + ".", 5);
  if (object.type === "log") {
    if (object.id === "camplog" && state.party.length < CAMPERS.length) return say("Gus: 'We are not leaving anybody behind! Let's find everyone first.'", 4);
    finish(object);
    soundCrash();
    say(object.id === "rocks" ? "Gus heaves the boulders aside. A secret way round!" : "Gus puts his shoulder to the fallen tree... and rolls it right off the road!", 4);
  } else if (object.type === "barricade") {
    if (!state.bonk) return say("Bonk is not with you.", 2);
    bonkCharge();
  } else if (object.type === "climb") {
    if (object.id === "tower" && !state.done.station) return say("Bex: 'No point climbing yet. The radio has no power. Milo needs to mend the fuse box at the station.'", 5);
    finish(object);
    soundGot();
    if (object.id === "tower") return radioCall();
    shake = 0.6;
    soundCrash();
    built.bridge.userData.falling = true;
    say(object.text, 6);
  } else if (object.type === "fusebox") {
    if (!state.fuses) return say("Milo: 'The fuse is burnt out. I can't mend it without a new one. There must be a spare in a crate somewhere near.'", 5);
    state.fuses--;
    finish(object);
    soundGot();
    objectModels[object.id].userData.light.material.color.setHex(0x4aff6a);
    say(object.id === "gate" ? "Milo clicks the fuse in. The lights come on, and the big gate rumbles open!" : "Milo clicks the fuse in. The radio hums into life! Now somebody has to turn the dish on the tower.", 6);
  }
}

// A friend joins the party
function join(id) {
  if (has(id)) return;
  state.party.push(id);
  const camper = CAMPERS.find(function (one) { return one.id === id; });
  const pages = [[camper.name, FRIENDS[id].line], ["", camper.name + " the " + camper.job.toLowerCase() + " joins you! Press " + (CAMPERS.indexOf(camper) + 1) + " to swap to " + camper.name + ". " + camper.what + "."]];
  if (id === "ren") {
    state.bonk = true;
    pages.push(["", "Bonk the baby Pachycephalosaurus joins you too! He can smash through walls of branches with his hard head."]);
  }
  soundGot();
  openTalk(pages, function () {
    if (state.party.length === CAMPERS.length) openTalk([["Tavi", "That's all six of us. And one small dinosaur."], ["Milo", "The grown-ups left on the ferry in the storm. They think we're on it!"], ["Bex", "There's a radio on the hill at the far end of the island. If we can reach it, we can call the ferry back."], ["Gus", "Then let's go. East. Together."]], checkGoals);
    checkGoals();
  });
}

function radioCall() {
  state.called = true;
  state.ferryAt = state.time + 45;
  built.radioLight.material.color.setHex(0x4aff6a);
  openTalk([["Milo", "Mayday, mayday! This is Camp Fossil Bay! Six campers are still on the island! Can anybody hear us?"], ["Radio", "...kzzzt... hear you loud and clear! Turning the ferry round now. Get to the SOUTH PIER. Five minutes!"], ["Nell", "We did it! We actually..."], ["Ren", "Um. Everybody? The radio is very loud. And that hill behind us just opened one eye."]], function () {
    const rex = dinos.find(function (d) { return d.act === "rex"; });
    wakeRex(rex, "THE T. REX IS AWAKE! Run south, down the road to the pier!");
    soundRoar();
    checkGoals();
  });
}

// ===== 8. What E does =====
function findNear() {
  let best = null;
  let bestFar = 99;
  function offer(far, reach, text, act) {
    if (far < reach && far < bestFar) {
      best = { text: text, act: act };
      bestFar = far;
    }
  }
  for (const id in FRIENDS) {
    if (has(id) || id === "milo") continue;
    const camper = CAMPERS.find(function (one) { return one.id === id; });
    offer(Math.hypot(mid(FRIENDS[id].i) - me.x, mid(FRIENDS[id].k) - me.z), 3.4, "Talk to " + camper.name, function () { join(id); });
  }
  for (const object of OBJECTS) {
    if (state.done[object.id]) continue;
    // How far to the thing itself, or to the nearest of the squares it blocks
    let far = Math.hypot(mid(object.i) - me.x, mid(object.k) - me.z);
    if (object.block) {
      const bx = clamp(me.x, object.block[0] * TILE, (object.block[2] + 1) * TILE);
      const bz = clamp(me.z, object.block[1] * TILE, (object.block[3] + 1) * TILE);
      far = Math.min(far, Math.hypot(bx - me.x, bz - me.z));
    }
    const words = { crate: "Open the crate", door: "Open the mess hall door", log: object.id === "rocks" ? "Push the boulders (Gus)" : "Push the fallen tree (Gus)", barricade: "Smash the wall of branches (Ren and Bonk)", climb: "Climb the rope (Bex)", fusebox: "Mend the fuse box (Milo)" };
    offer(far, object.type === "crate" ? 2.4 : 3.2, words[object.type], function () { useObject(object); });
  }
  if (!state.calm) {
    for (const d of dinos) {
      if (d.act !== "block") continue;
      offer(Math.hypot(d.x - me.x, d.z - me.z) - 3, 4.5, "Calm the Triceratops (Ren)", function () {
        if (!has("ren")) return;
        if (lead().id !== "ren") return say("This is a job for Ren, the dinosaur friend. Press 4 to swap to Ren.", 4);
        state.calm = true;
        soundGot();
        say("Ren hums softly and holds out a handful of ferns. The big Triceratops snorts... and leads her family off the road.", 6);
      });
    }
  }
  return best;
}

// ===== 9. The story =====
function goalDone(n) {
  if (n === 0) return state.party.length === CAMPERS.length;
  if (n === 1) return !!state.done.camplog;
  if (n === 2) return !!state.done.wall1;
  if (n === 3) return !!state.done.cliff;
  if (n === 4) return me.x > 60 * TILE;
  if (n === 5) return !!state.done.gate;
  if (n === 6) return me.x > 88 * TILE;
  if (n === 7) return me.x > 93 * TILE && me.z < 30 * TILE;
  if (n === 8) return state.called;
  return state.won;
}

function checkGoals() {
  while (state.goal < GOALS.length && goalDone(state.goal)) state.goal++;
  el("goal").textContent = state.goal < GOALS.length ? GOALS[state.goal] : "You made it! All six campers (and Bonk) are safe on the ferry";
}

function win() {
  state.won = true;
  sound(playJingle);
  checkGoals();
  try { localStorage.removeItem(SAVE); } catch (problem) { /* never mind */ }
  el("won-text").textContent = "The ferry bumps against the pier, and six campers and one small dinosaur tumble aboard. Behind you the T. rex roars at the sea. It took you " + Math.round(state.time / 60) + " minutes to cross the island. The captain looks at Bonk. Bonk looks at the captain. 'He's with us,' says Ren.";
  el("won").hidden = false;
  mode = "won";
}

// ===== 10. One step of the game =====
function tick(dt) {
  state.time += dt;
  moveMe(dt);
  moveFollowers(dt);
  updateBonk(dt);
  updateDinos(dt);

  // Resting at a campfire: all your hearts back, and the game is saved
  const fire = nearFire();
  if (fire >= 0 && (fire !== tick.fire || state.hearts < HEARTS)) {
    const fresh = fire > state.fire || state.hearts < HEARTS;
    state.fire = Math.max(state.fire, fire);
    state.hearts = HEARTS;
    if (fresh) {
      soundGot();
      say("You rest by the campfire at " + FIRES[fire].name + ". All your hearts are back, and the game is saved.", 4);
      save();
    }
  }
  tick.fire = fire;

  // The stampede: a warning rumble when the herd sets off
  const wave = (state.time + 4) % 14;
  if (wave < dt * 1.5 && me.x > 44 * TILE && me.x < 58 * TILE) {
    sound(function () { playNoise(0, 1.5, 200, 80, 0.3); });
    say("The ground is shaking... STAMPEDE! Keep clear of the middle of the plains!", 3);
  }
  // The ground shakes when the T. rex walks near
  const rex = dinos.find(function (d) { return d.act === "rex"; });
  if (rex.moving && Math.hypot(rex.x - me.x, rex.z - me.z) < 70 && wall > (tick.thudAt || 0)) {
    tick.thudAt = wall + 0.45;
    sound(function () { playTone(0, 0.25, 70, 40, 0.35); });
    shake = Math.max(shake, 0.4);
  }
  // The ferry
  if (state.called) {
    const onPier = groundAt(me.x, me.z) === "wood" && me.z > 57 * TILE;
    if (state.time >= state.ferryAt && onPier) return win();
    if (onPier && wall > (tick.waitAt || 0)) {
      tick.waitAt = wall + 4;
      say("You are safe on the pier: the T. rex is too heavy to follow. The ferry will be here in " + Math.max(1, Math.ceil(state.ferryAt - state.time)) + " seconds!", 4);
    }
  }
  near = findNear();
  if (state.time - lastCheck > 0.5) {
    lastCheck = state.time;
    checkGoals();
  }
}

// ===== 11. Drawing =====
const flareGlow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.8 }));
const flareLight = new THREE.PointLight(0xff3a2a, 0, 30);
scene.add(flareGlow, flareLight);

const strings = {};
function setText(id, text) {
  if (strings[id] === text) return;
  strings[id] = text;
  el(id).innerHTML = text;
}

function drawHud() {
  setText("hearts", "<b>" + "♥".repeat(Math.max(0, state.hearts)) + "</b>" + "♡".repeat(HEARTS - Math.max(0, state.hearts)));
  setText("items", "Flares " + state.flares + " &nbsp; Fuses " + state.fuses + (state.key ? " &nbsp; Key" : ""));
  let party = "";
  CAMPERS.forEach(function (camper, n) {
    const here = has(camper.id);
    party += '<span class="' + (state.party[0] === camper.id ? "on" : here ? "" : "gone") + '"><i style="background:#' + camper.shirt.toString(16).padStart(6, "0") + '"></i>' + (n + 1) + " " + (here ? camper.name : "???") + (here ? "<small>" + camper.job + "</small>" : "") + "</span>";
  });
  setText("party", party);
  let hint = "";
  if (mode === "play") {
    if (near) hint = "E: " + near.text;
    else if (me.hidden) hint = "Hidden in the long grass";
    else hint = lead().name + " the " + lead().job.toLowerCase() + ". " + lead().what;
  }
  setText("hint", hint);
  el("hint").hidden = !hint;
  if (!el("toast").hidden && wall > toastUntil) el("toast").hidden = true;
  el("tint").style.boxShadow = wall - hurtAt < 0.5 ? "inset 0 0 90px 30px rgba(220, 30, 20, 0.7)" : state.hearts <= 2 ? "inset 0 0 70px 10px rgba(220, 30, 20, 0.35)" : "none";
}

const SKIES = { day: new THREE.Color(0xa8dcf4), storm: new THREE.Color(0x8a7a8a) };
const nowSky = new THREE.Color();
let gloom = 0;

function draw(dt) {
  wall += dt;
  shake = Math.max(0, shake - dt);
  // When the T. rex wakes for the last chase, the sky turns stormy
  gloom += ((state.called ? 1 : 0) - gloom) * Math.min(1, dt * 0.5);
  nowSky.copy(SKIES.day).lerp(SKIES.storm, gloom);
  scene.fog.color.copy(nowSky);
  renderer.setClearColor(nowSky);
  skyLight.intensity = 0.72 - gloom * 0.2;
  sunLight.intensity = 0.65 - gloom * 0.3;

  // ----- The campers -----
  for (const camper of CAMPERS) {
    const who = people[camper.id];
    const here = has(camper.id);
    who.model.group.position.set(who.x, 0, who.z);
    who.model.group.rotation.y = who.yaw;
    const pace = me.running ? 14 : 9;
    const stride = here && who.moving ? Math.sin(wall * pace + who.x) * 0.7 : 0;
    who.model.limbs.forEach(function (limb, n) { limb.rotation.x = stride * (n === 0 || n === 3 ? 1 : -1); });
    // Crouched low when hiding in long grass. A friend who is waiting to be found waves.
    const hiding = here && groundAt(who.x, who.z) === "tall";
    who.model.body.position.y = hiding ? -0.45 : here && who.moving ? Math.abs(Math.sin(wall * pace + who.x)) * 0.06 : 0;
    if (!here) who.model.limbs[0].rotation.x = Math.PI + Math.sin(wall * 6) * 0.4;
    who.model.group.visible = here || camper.id !== "milo";        // (Milo is locked indoors until you open the door)
    who.sign.visible = !here && camper.id !== "milo";
    who.sign.position.set(who.x, 2.7 + Math.sin(wall * 3) * 0.08, who.z);
    who.sign.scale.setScalar(0.9);
    // A ring on the ground under the camper you are steering
  }
  ring.position.set(me.x, 0.05, me.z);
  ring.scale.setScalar(1 + Math.sin(wall * 5) * 0.06);

  // ----- The camera looks down on you from behind -----
  camera.position.set(me.x + (Math.random() - 0.5) * shake, 17 + (Math.random() - 0.5) * shake, me.z + 14);
  camera.lookAt(me.x, 0.8, me.z - 1);
  sunLight.target.position.set(me.x, 0, me.z);
  sunLight.position.set(me.x - 22, 44, me.z + 18);

  // ----- Things that move -----
  fireFlames.forEach(function (one, n) { one.scale.y = 1 + Math.sin(wall * (9 + n * 3)) * 0.25; });
  const bridge = built.bridge;
  if (state.done.cliff) bridge.rotation.z = bridge.userData.falling ? Math.max(0, bridge.rotation.z - dt * 2.2) : 0;
  for (const door of built.gate) {
    const to = door.shut + (state.done.gate ? door.side * 3 : 0);
    door.mesh.position.z += (to - door.mesh.position.z) * Math.min(1, dt * 1.2);
  }
  built.gateLight.material.color.setHex(state.done.gate ? 0x4aff6a : 0xff3a2a);
  if (state.done.tower) built.dish.rotation.y += (Math.PI - built.dish.rotation.y) * Math.min(1, dt);
  if (state.called) {
    const far = clamp((state.ferryAt - state.time) / 45, 0, 1);
    built.ferry.position.z = (PIER.k1 + 1) * TILE + 11 + far * 150;
  }
  const flare = state.flare && state.time < state.flare.until ? state.flare : null;
  flareGlow.visible = !!flare;
  flareLight.intensity = flare ? 1.4 + Math.sin(wall * 20) * 0.3 : 0;
  if (flare) {
    flareGlow.position.set(flare.x, 0.4, flare.z);
    flareGlow.scale.setScalar(1 + Math.sin(wall * 25) * 0.25);
    flareLight.position.set(flare.x, 1.5, flare.z);
  }
  // Bonk stays in his stable until Ren makes friends with him
  drawDinos(wall);
  drawHud();
}

// A ring that shows which camper you are steering
const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.64, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2;
scene.add(ring);

// ===== 12. Saving =====
function save() {
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
  state.flare = null;
  // Put the island back the way the save says
  const fresh = makeMap();
  for (let k = 0; k < ROWS; k++) MAP.ground[k] = fresh.ground[k];
  if (state.done.cliff) lowerBridge();
  else paintGround();
  built.bridge.rotation.z = state.done.cliff ? 0 : 1.25;
  built.bridge.userData.falling = false;
  for (const object of OBJECTS) {
    objectModels[object.id].visible = !state.done[object.id] || object.type === "fusebox" || object.type === "climb";
    if (object.type === "fusebox") objectModels[object.id].userData.light.material.color.setHex(state.done[object.id] ? 0x4aff6a : 0xff3a2a);
  }
  built.radioLight.material.color.setHex(state.called ? 0x4aff6a : 0x5a5a5a);
  for (const camper of CAMPERS) {
    const spot = FRIENDS[camper.id] || START;
    people[camper.id].x = mid(spot.i);
    people[camper.id].z = mid(spot.k);
    people[camper.id].moving = false;
  }
  const bonk = dinos.find(function (d) { return d.act === "bonk"; });
  bonk.x = bonk.home.x;
  bonk.z = bonk.home.z;
  bonk.charge = null;
  me.dashUntil = 0;
  for (const id in skillAt) delete skillAt[id];
  me.safeUntil = state.time + 3;
  if (saved) gather(FIRES[state.fire]);
  else {
    me.x = mid(START.i);
    me.z = mid(START.k);
    trail.length = 0;
  }
  if (state.called) state.ferryAt = Math.max(state.ferryAt, state.time + 30);
  resetDinos();
  for (const id of ["intro", "won", "talk"]) el(id).hidden = true;
  el("hud").hidden = false;
  mode = "play";
  checkGoals();
  if (!saved) {
    openTalk([["", "Camp Fossil Bay. The morning after the storm."], ["Tavi", "Hello? HELLO? ...Where is everybody? The cabins are empty. The ferry's gone!"], ["Tavi", "And the fences are down. I can hear things moving in the trees. I have to find the others. They can't have gone far."], ["", "Walk with W, A, S, D. Hold Shift to run. Press E to do things. Find your five friends: each has a ! over their head."]]);
  }
}

// ===== 13. Keys and buttons =====
window.addEventListener("keydown", function (e) {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (mode === "talk") {
    if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") nextTalk();
    return;
  }
  if (mode !== "play") return;
  if ((e.code === "KeyE" || e.code === "Space") && near) near.act();
  else if (e.code === "KeyQ") useSkill();
  else if (e.code === "KeyG") throwFlare();
  else if (e.code === "Tab") swapTo(CAMPERS.findIndex(function (one) { return one.id === state.party[1 % state.party.length]; }));
  else if (e.code.indexOf("Digit") === 0) swapTo(Number(e.code.slice(5)) - 1);
});

window.addEventListener("keyup", function (e) {
  keys[e.code] = false;
});

window.addEventListener("blur", function () {
  for (const code in keys) keys[code] = false;
});

el("talk").addEventListener("click", nextTalk);
el("party").addEventListener("click", function (e) {
  const slot = e.target.closest("span");
  if (slot && mode === "play") swapTo([...el("party").children].indexOf(slot));
});
el("start").addEventListener("click", function () {
  begin(null);
});
el("continue").addEventListener("click", function () {
  begin(load());
});
el("won-close").addEventListener("click", function () {
  begin(null);
});

// ===== 14. Go! =====
makePeople();
makeDinos();
for (const object of OBJECTS) objectModels[object.id] = makeObject(object);
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
  nextTalk(); nextTalk(); nextTalk(); nextTalk();
  window.CF = {
    me: me, keys: keys, dinos: dinos, people: people, trail: trail,
    state: function () { return state; },
    mode: function () { return mode; },
    near: function () { return near; },
    talkText: function () { return talk ? talk.pages[talk.n].join(": ") : ""; },
    frames: function () { return frameCount; },
    begin: begin, save: save, load: load, join: join, swapTo: swapTo, useSkill: useSkill, throwFlare: throwFlare, nextTalk: nextTalk, hurt: hurt, canStand: canStand, findNear: findNear, checkGoals: checkGoals, nearFire: nearFire,
    step: function (n) { for (let i = 0; i < n; i++) { if (mode === "play") tick(0.05); } },
  };
}

requestAnimationFrame(frame);
