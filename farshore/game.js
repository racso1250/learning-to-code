// Farshore: the game.
// This file has the rules: walking, swimming, picking things up, air and health,
// building, making gear, the star stones, and saving.

// ===== 1. What the game remembers =====
const SAVE = "farshore-save";

// You: where your eyes are, which way you look, and whether you are inside your base
const me = { x: START.x, y: 5, z: START.z, yaw: 0, pitch: 0, vy: 0, indoor: false, level: 0, noJump: 0 };

function freshState() {
  return {
    inv: {},        // what you are carrying: { wood: 3, shell: 1 ... }
    cells: [],      // the rooms of your base
    faces: {},      // which walls are doors or windows
    items: [],      // the furniture
    gear: {},       // the gear you have made: { flippers: true ... }
    stones: {},     // star stones: "have" (carrying it) or "placed" (in the tower)
    bed: null,      // where your bed is (you wake up there)
    hp: 100, air: 45,
    time: 0,
    won: false,
    met: {},
    at: null,
  };
}

let state = freshState();
let mode = "intro";     // intro, play, menu, gear, card or won
let placing = null;     // what you are about to build
let near = null;        // the thing close enough to use
let swimming = false;
let torchOn = false;
let locked = false;     // is the mouse turning your head?
let shake = 0;
let flash = 0;
let hurtAt = -99;
let wall = 0;           // a clock that never stops (for animations)
let lastSave = 0;
let lastPlace = "";
const keys = {};

function airMax() {
  return state.gear.tank3 ? 170 : state.gear.tank2 ? 90 : 45;
}

function alive() {
  return mode === "play";
}

function isSwimming() {
  return swimming && !me.indoor;
}

// Are you under one of the rock arches on Thunder Peak?
function sheltered() {
  return shelters.some(function (s) { return Math.hypot(me.x - s.x, me.z - s.z) < s.r; });
}

function canPay(cost) {
  for (const kind in cost) {
    if ((state.inv[kind] || 0) < cost[kind]) return false;
  }
  return true;
}

function pay(cost) {
  for (const kind in cost) state.inv[kind] -= cost[kind];
}

// "3 Driftwood, 2 Stone". With "marked", it also shows how many you have.
function costText(cost, marked) {
  const parts = [];
  for (const kind in cost) {
    const text = cost[kind] + " " + STUFF[kind].name;
    const got = state.inv[kind] || 0;
    parts.push(marked ? '<span class="' + (got >= cost[kind] ? "got" : "need") + '">' + text + " (" + got + ")</span>" : text);
  }
  return parts.length ? parts.join(", ") : "free";
}

// ===== 2. Sounds =====
function sound(make) {
  try { make(); } catch (problem) { /* no sound is fine */ }
}
function soundGot() { sound(function () { playTone(0, 0.08, 700, 950, 0.14); }); }
function soundBuild() { sound(function () { playNoise(0, 0.2, 500, 1500, 0.2); playTone(0.1, 0.25, 500, 800, 0.2); }); }
function soundDoor() { sound(function () { playTone(0, 0.18, 500, 900, 0.12); }); }
function soundHit() { sound(function () { playNoise(0, 0.35, 900, 120, 0.5); playTone(0, 0.3, 160, 60, 0.4); }); }
function soundRoar() { sound(function () { playNoise(0, 1.3, 260, 60, 0.45); playTone(0, 1.1, 110, 45, 0.35); }); }
function soundScreech() { sound(function () { playTone(0, 0.9, 1800, 700, 0.25); playNoise(0, 0.9, 3000, 1500, 0.15); }); }
function soundStomp(loud) { sound(function () { playNoise(0, 0.7, 180, 40, 0.7 * loud); playTone(0, 0.6, 70, 30, 0.6 * loud); }); }
function soundSplash(loud) { sound(function () { playNoise(0, 1.2, 2500, 300, 0.5 * loud); }); }
function soundHorn() { sound(function () { playTone(0, 1.2, 180, 160, 0.4); playTone(0, 1.2, 271, 240, 0.25); }); }

// ===== 3. Messages =====
const el = function (id) { return document.getElementById(id); };
let toastUntil = 0;

function say(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastUntil = wall + (seconds || 3);
}

// Story cards: the game waits until you press Space
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

function stoneCount(what) {
  return STONES.filter(function (s) { return state.stones[s.id] === what; }).length;
}

// The line of words above the game: what to do next
function setGoal() {
  let text;
  const placed = stoneCount("placed");
  if (state.won) text = "The signal is calling across the stars. This whole world is yours to explore";
  else if (stoneCount("have")) text = "You are carrying a star stone. Take it to the old tower on Landing Isle";
  else if (!state.cells.length) text = "Pick up driftwood and stones (E). Then press B and build your first room";
  else text = "Star stones in the tower: " + placed + " of 5. Each stone sends a beam of light up into the sky: go and find them";
  el("goal").textContent = text;
}

// ===== 4. Getting hurt =====
function hurt(amount, why) {
  if (mode !== "play") return;
  state.hp -= amount;
  flash = 0.5;
  shake = Math.max(shake, 0.5);
  hurtAt = state.time;
  soundHit();
  if (state.hp <= 0) faint(why);
}

// Out of health: you wake up in your bed (or by your landing pod, if you have no bed)
function faint(why) {
  const bed = state.bed && hasCell(Math.floor(state.bed.x / CELL), state.bed.level, Math.floor(state.bed.z / CELL)) ? state.bed : null;
  placing = null;
  showCard(why + "\n\nEverything goes dark... and you wake up " + (bed ? "safe in your bed." : "on the beach by your landing pod.") + "\nYou still have all your things.", function () {
    if (bed) {
      me.indoor = true;
      me.level = bed.level;
      me.x = bed.x;
      me.z = bed.z;
      me.y = bed.level * TALL + 1.8;
    } else {
      me.indoor = false;
      me.x = START.x;
      me.z = START.z;
      me.y = groundAt(START.x, START.z) + 1.6;
    }
    me.vy = 0;
    state.hp = 100;
    state.air = airMax();
    maw.rest = state.time + 8;
    wing.next = state.time + 8;
    save();
  });
}

// ===== 5. Moving =====
// How high is the thing under your feet: the ground, a rock, or the roof of your base?
function standHeight(x, z, feet) {
  let high = groundAt(x, z);
  for (const s of solids) {
    if (s.top <= feet + 0.7 && s.top > high && Math.hypot(x - s.x, z - s.z) < s.r) high = s.top;
  }
  return Math.max(high, roofUnder(x, z, feet));
}

function movePlayer(dt) {
  // Looking around with the arrow keys (the mouse works too)
  me.yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 1.8 * dt;
  me.pitch = clamp(me.pitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * 1.3 * dt, -1.45, 1.45);
  const ahead = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const run = keys.ShiftLeft || keys.ShiftRight;
  const fx = -Math.sin(me.yaw);
  const fz = -Math.cos(me.yaw);
  const rx = Math.cos(me.yaw);
  const rz = -Math.sin(me.yaw);
  me.noJump = Math.max(0, me.noJump - dt);

  if (me.indoor) {
    // Inside your base: walk on the floor of the room
    const speed = run ? 6.5 : 4.2;
    me.x += (fx * ahead + rx * side) * speed * dt;
    me.z += (fz * ahead + rz * side) * speed * dt;
    clampIndoors();
    swimming = false;
    if (!me.indoor) return;
    const floor = me.level * TALL + 1.8;
    me.vy -= 20 * dt;
    me.y += me.vy * dt;
    if (me.y <= floor) {
      me.y = floor;
      me.vy = 0;
      if (keys.Space && !me.noJump && !ladderNear()) me.vy = 5.5;
    }
    if (me.y > me.level * TALL + 2.7) {
      me.y = me.level * TALL + 2.7;
      me.vy = Math.min(0, me.vy);
    }
    return;
  }

  const stand = standHeight(me.x, me.z, me.y - 1.6);
  // You swim when the water is deep and your head is at (or under) the top of the sea
  swimming = stand < -1.3 && me.y <= 0.36;
  if (swimming) {
    const speed = (state.gear.flippers ? 7.5 : 4.5) * (run ? 1.35 : 1);
    const way = lookWay();
    me.x += (way.x * ahead + rx * side * 0.7) * speed * dt;
    me.z += (way.z * ahead + rz * side * 0.7) * speed * dt;
    me.y += (way.y * ahead + ((keys.Space ? 1 : 0) - (keys.KeyC ? 1 : 0)) * 0.8) * speed * dt;
    me.y = clamp(me.y, standHeight(me.x, me.z, me.y - 1.6) + 0.7, 0.35);
    me.vy = 0;
  } else {
    let speed = run ? 8 : 5;
    if (stand < -0.4) speed *= 0.7;   // wading through shallow water is slow
    me.x += (fx * ahead + rx * side) * speed * dt;
    me.z += (fz * ahead + rz * side) * speed * dt;
    const under = standHeight(me.x, me.z, me.y - 1.6);
    me.vy -= 20 * dt;
    me.y += me.vy * dt;
    if (under < -1.3) {
      // Falling into deep water: stop at the top of the sea, and start swimming
      if (me.y <= 0.3) {
        me.y = 0.3;
        me.vy = 0;
      }
    } else if (me.y <= under + 1.6) {
      me.y = under + 1.6;
      me.vy = 0;
      if (keys.Space && !me.noJump) me.vy = state.gear.boots ? 10.5 : 6.8;
    }
  }

  // Solid things: your rooms, trees, rocks, and the edge of the map
  pushOutOfRooms();
  const feet = me.y - 1.6;
  for (const s of solids) {
    // You can step up onto anything that is no higher than your knees
    if (feet > s.top - 0.75) continue;
    const dx = me.x - s.x;
    const dz = me.z - s.z;
    const far = Math.hypot(dx, dz);
    const gap = s.r + 0.35;
    if (far < gap && far > 0.001) {
      me.x = s.x + dx / far * gap;
      me.z = s.z + dz / far * gap;
    }
  }
  me.x = clamp(me.x, -EDGE, EDGE);
  me.z = clamp(me.z, -EDGE, EDGE);
}

// Air and health
function breathe(dt) {
  const under = !me.indoor && me.y < -0.1;
  if (under) {
    state.air -= dt;
    if (state.air <= 0) {
      state.air = 0;
      state.hp -= 10 * dt;
      flash = Math.max(flash, 0.2);
      hurtAt = state.time;
      if (state.hp <= 0) faint("You ran out of air!");
    }
  } else {
    state.air = Math.min(airMax(), state.air + 40 * dt);
  }
  // Health slowly comes back when nothing has hurt you for a while
  if (state.time - hurtAt > 6) state.hp = Math.min(100, state.hp + 1.5 * dt);
}

// ===== 6. Using things =====
function findNear() {
  if (placing) return null;
  const door = doorNear();
  if (door) return { type: "door", door: door, text: me.indoor ? "E: go outside" : "E: go inside" };
  const ladder = ladderNear();
  if (me.indoor) {
    const item = itemNear(2);
    if (item) {
      let text = PARTS[item.kind].name;
      if (item.kind === "bench") text = "E: make gear at the workbench";
      else if (item.kind === "bed") text = "E: sleep (this saves your game)";
      else if (item.kind === "planter") text = state.time > item.ripe ? "E: pick the sunfruit" : "The sunfruit is still growing";
      return { type: "item", item: item, text: text + " · X: pack it up" };
    }
    if (ladder) return { type: "ladder", text: "Space: climb up" + (ladder.up === "roof" ? " onto the roof" : "") + (ladder.down ? " · C: climb down" : "") };
    return null;
  }
  if (ladder) return { type: "ladder", text: "C: climb down into your base" };
  if (Math.hypot(me.x - TOWER.x, me.z - TOWER.z) < 8) {
    const carried = stoneCount("have");
    return { type: "tower", text: carried ? "E: put your star stone" + (carried > 1 ? "s" : "") + " into the tower" : "The old signal tower. It has " + stoneCount("placed") + " of its 5 star stones" };
  }
  for (const stone of STONES) {
    if (!state.stones[stone.id] && Math.hypot(me.x - stone.x, me.y - stone.y, me.z - stone.z) < 3.4) return { type: "stone", stone: stone, text: "E: take " + stone.name };
  }
  let best = null;
  let bestFar = 3;
  for (const node of nodes) {
    if (node.back) continue;
    const far = Math.hypot(me.x - node.x, (me.y - 1.2 - node.y) * 0.6, me.z - node.z);
    if (far < bestFar) {
      best = node;
      bestFar = far;
    }
  }
  if (best) return { type: "node", node: best, text: "E: pick up " + STUFF[best.kind].name };
  return null;
}

function pressE() {
  if (placing) {
    if (placing === "room") return placeRoom() && afterBuild();
    if (PARTS[placing].face) return setFace(placing) && afterBuild();
    if (placeItem(placing)) {
      const item = state.items[state.items.length - 1];
      if (item.kind === "bed") state.bed = { x: item.x, z: item.z, level: me.level };
      placing = null;
      afterBuild();
    }
    return;
  }
  if (!near) return;
  if (near.type === "door") {
    useDoor(near.door);
  } else if (near.type === "node") {
    const node = near.node;
    const amount = node.kind === "wood" ? 2 : 1;
    state.inv[node.kind] = (state.inv[node.kind] || 0) + amount;
    node.back = state.time + 150;
    showNode(node, false);
    soundGot();
    say("+" + amount + " " + STUFF[node.kind].name, 1.5);
    setGoal();
  } else if (near.type === "stone") {
    state.stones[near.stone.id] = "have";
    stoneModels[near.stone.id].group.visible = false;
    sound(playJingle);
    say("You found " + near.stone.name + "! Take it to the tower on Landing Isle.", 6);
    setGoal();
    save();
  } else if (near.type === "tower") {
    fillTower();
  } else if (near.type === "item") {
    const item = near.item;
    if (item.kind === "bench") openGear();
    else if (item.kind === "bed") {
      state.bed = { x: item.x, z: item.z, level: me.level };
      state.hp = 100;
      save();
      say("You had a good sleep. Game saved. You will wake up here if you are badly hurt.", 5);
    } else if (item.kind === "planter" && state.time > item.ripe) {
      state.inv.fruit = (state.inv.fruit || 0) + 1;
      item.ripe = state.time + 60;
      soundGot();
      say("+1 Sunfruit. Press H to eat one.", 3);
    }
  }
}

function afterBuild() {
  setGoal();
  save();
  return true;
}

// Put the stones you carry into the tower. With all five, you win!
function fillTower() {
  if (!stoneCount("have")) return;
  for (const stone of STONES) {
    if (state.stones[stone.id] === "have") state.stones[stone.id] = "placed";
  }
  lightTower();
  sound(playJingle);
  const placed = stoneCount("placed");
  setGoal();
  save();
  if (placed < 5) return say("The tower hums. " + placed + " of 5 star stones are in place.", 5);
  state.won = true;
  lightTower();
  setGoal();
  save();
  el("won-text").textContent = "All five star stones blaze with light, and a beam shoots up from the old tower, past the ringed planet and out to the stars. Somebody out there will see it. Until they come, you have " + state.cells.length + " rooms to call home, and a whole world of islands and sea to explore. It took you " + Math.round(state.time / 60) + " minutes.";
  el("won").hidden = false;
  mode = "won";
  if (document.exitPointerLock) document.exitPointerLock();
}

function lightTower() {
  const placed = stoneCount("placed");
  towerLights.forEach(function (lamp, n) {
    lamp.material.emissive.setHex(n < placed ? 0x4ad8ff : 0x000000);
  });
  towerBeam.visible = state.won;
}

function eat() {
  if (!state.inv.fruit) return say("You have no sunfruit. They grow on bushes on Landing Isle and Greenback.", 3);
  if (state.hp >= 100) return say("You are not hurt", 2);
  state.inv.fruit--;
  state.hp = Math.min(100, state.hp + 35);
  soundGot();
  say("Yum! That feels better.", 2);
}

function blowHorn() {
  if (!state.gear.horn) return say("You have no sea horn yet. You can make one at a workbench.", 3);
  soundHorn();
  if (farFrom(maw, me) < 140) {
    maw.scared = state.time + 14;
    say("The Deepmaw swims away from the sound!", 3);
  }
}

// ===== 7. The build list and the gear list =====
function openBuild() {
  placing = null;
  mode = "menu";
  if (document.exitPointerLock) document.exitPointerLock();
  let html = "";
  let n = 1;
  for (const kind in PARTS) {
    const part = PARTS[kind];
    html += '<button data-kind="' + kind + '"><b>' + (n < 10 ? n : 0) + ". " + part.name + "</b>: " + part.what + "<br>" + costText(part.cost, true) + "</button>";
    n++;
  }
  el("parts").innerHTML = html;
  el("build").hidden = false;
}

function closeMenus() {
  el("build").hidden = true;
  el("gear").hidden = true;
  mode = "play";
}

function chooseBuild(kind) {
  closeMenus();
  placing = kind;
}

function openGear() {
  mode = "gear";
  if (document.exitPointerLock) document.exitPointerLock();
  let html = "";
  for (const id in GEAR) {
    const gear = GEAR[id];
    const done = state.gear[id];
    const blocked = gear.needs && !state.gear[gear.needs];
    html += '<button data-gear="' + id + '"' + (done || blocked || !canPay(gear.cost) ? " disabled" : "") + "><b>" + gear.name + "</b>: " + gear.what + "<br>" + (done ? "You have this" : blocked ? "Make the " + GEAR[gear.needs].name + " first" : costText(gear.cost, true)) + "</button>";
  }
  el("gear-list").innerHTML = html;
  el("gear").hidden = false;
}

function makeGear(id) {
  const gear = GEAR[id];
  if (!gear || state.gear[id] || (gear.needs && !state.gear[gear.needs]) || !canPay(gear.cost)) return false;
  pay(gear.cost);
  state.gear[id] = true;
  state.air = airMax();
  soundBuild();
  save();
  say("You made: " + gear.name + "!", 3);
  if (mode === "gear") openGear();
  return true;
}

// ===== 8. One step of the game =====
function play(dt) {
  movePlayer(dt);
  breathe(dt);
  near = findNear();
  updateGiants(dt, state.time);

  // Things you picked up grow back after a while
  for (const node of nodes) {
    if (node.back && state.time > node.back) {
      node.back = 0;
      showNode(node, true);
    }
  }
  if (state.time - lastSave > 20) save();
}

// ===== 9. Drawing =====
const strings = {};
function setText(id, text) {
  if (strings[id] === text) return;
  strings[id] = text;
  el(id).innerHTML = text;
}

// What is this place called?
function placeName() {
  if (me.indoor) return "Your base";
  if (me.y < -0.5) return Math.round(-me.y) + " m under the sea";
  for (const one of ISLANDS) {
    if (one.h > 0 && Math.hypot(me.x - one.x, me.z - one.z) < one.r * 0.75) return one.name;
  }
  if (Math.hypot(me.x - ATOLL.x, me.z - ATOLL.z) < ATOLL.r + 25) return "The Lagoon";
  return "The open sea";
}

function drawHud() {
  el("health-fill").style.width = clamp(state.hp, 0, 100) + "%";
  el("air-fill").style.width = clamp(state.air / airMax() * 100, 0, 100) + "%";
  setText("air-text", "Air " + Math.ceil(state.air));
  setText("where", placeName());
  const carried = stoneCount("have");
  setText("tally", "Star stones " + stoneCount("placed") + "/5" + (carried ? "<br>Carrying " + carried : ""));
  const things = [];
  for (const kind in STUFF) {
    if (state.inv[kind]) things.push(STUFF[kind].name + " " + state.inv[kind]);
  }
  setText("inv", (things.join(" · ") || "Your bag is empty") + "<br>B Build · X Pack up · H Eat" + (state.gear.light ? " · L Light" : "") + (state.gear.horn ? " · R Horn" : ""));

  let warn = "";
  if (mode === "play") {
    if (!me.indoor && me.y < -0.1 && state.air < 12) warn = "ALMOST OUT OF AIR! SWIM UP!";
    else if (wing.mood === "dive") warn = "STORMWING! GET UNDER COVER!";
    else if (maw.mood === "hunt") warn = "DEEPMAW! SWIM FOR SHALLOW WATER!";
    else if (state.hp < 30) warn = "You are badly hurt. Eat a sunfruit (H) or sleep in your bed";
  }
  setText("warn", warn);
  el("warn").hidden = !warn;

  let hint = "";
  if (mode === "play") {
    if (placing === "room") {
      const spot = roomTarget();
      hint = (spot.why || "E or click: build a room here") + " · Esc: stop building";
    } else if (placing && PARTS[placing].face) {
      hint = (faceTarget() ? "E or click: make this wall a " + PARTS[placing].name.toLowerCase() : "Look at an outside wall of your base") + " · Esc: stop";
    } else if (placing) {
      hint = (me.indoor ? "E or click: put the " + PARTS[placing].name.toLowerCase() + " here" : "Go inside a room first") + " · Esc: stop";
    } else if (near) {
      hint = near.text;
    } else if (sheltered()) {
      hint = "You are safe under this rock arch";
    }
  }
  setText("hint", hint);
  el("hint").hidden = !hint;
  if (!el("toast").hidden && wall > toastUntil) el("toast").hidden = true;

  // The edges of the picture: red when hurt, blue under water
  const under = camera.position.y < 0;
  el("tint").style.boxShadow = flash > 0 ? "inset 0 0 " + Math.round(flash * 180) + "px rgba(255,40,30,0.8)" : under ? "inset 0 0 120px rgba(0,40,70,0.7)" : "none";
}

const SEA_COLOURS = [[0, 0x2fa8b8], [30, 0x1c6a80], [70, 0x0c2c44], [118, 0x040c18]];
const seaColour = new THREE.Color();
const skyColour = new THREE.Color(0xffd9c4);

function draw(dt) {
  wall += dt;
  flash = Math.max(0, flash - dt);
  shake = Math.max(0, shake - dt);

  camera.position.set(me.x, me.y, me.z);
  if (mode === "intro" || mode === "won") {
    // Behind the title: a slow look around
    camera.rotation.set(0.05, wall * 0.06 + 2.6, 0);
  } else {
    camera.rotation.set(me.pitch, me.yaw, 0);
  }
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * shake * 0.5;
  }
  // Swimming at the top of the sea, your head bobs up and down
  if (swimming && me.y > 0.2) camera.position.y += Math.sin(wall * 2) * 0.08;

  // Above the water you can see for miles. Under it, the sea closes in.
  const under = camera.position.y < 0;
  const depth = Math.max(0, -camera.position.y);
  if (under) {
    blend(SEA_COLOURS, depth, seaColour);
    scene.fog.color.copy(seaColour);
    scene.fog.near = 1;
    scene.fog.far = Math.max(30, 80 - depth * 0.4);
    skyLight.intensity = 0.5 - 0.3 * clamp(depth / 80, 0, 1);
    sunLight.intensity = 0.6 * (1 - clamp(depth / 50, 0, 1));
  } else {
    scene.fog.color.copy(skyColour);
    scene.fog.near = 150;
    scene.fog.far = 1300;
    skyLight.intensity = 0.5;
    sunLight.intensity = 0.6;
  }
  renderer.setClearColor(scene.fog.color);
  sky.visible = !under;
  clouds.visible = !under;
  torch.intensity = torchOn && state.gear.light ? 1.6 : 0;

  moveScenery(dt, wall);
  poseGiants(state.time);
  moveBase(wall);

  // The see-through box (or glowing wall) that shows where you are about to build
  ghost.visible = false;
  faceMark.visible = false;
  if (mode === "play" && placing === "room") {
    const spot = roomTarget();
    ghost.visible = true;
    ghost.position.set(spot.i * CELL + 2, spot.j * TALL + 1.5, spot.k * CELL + 2);
    ghost.material.color.setHex(spot.why ? 0xff5a4a : 0x6dff8e);
  } else if (mode === "play" && placing && PARTS[placing].face) {
    const f = faceTarget();
    if (f) {
      faceMark.visible = true;
      faceMark.position.set(f.i * CELL + 2 + DIRS[f.d][0] * 2, f.j * TALL + 1.6, f.k * CELL + 2 + DIRS[f.d][1] * 2);
      faceMark.rotation.y = DIRS[f.d][0] ? Math.PI / 2 : 0;
    }
  }
  drawHud();
}

// ===== 10. Saving =====
function save() {
  lastSave = state.time;
  state.at = { x: me.x, y: me.y, z: me.z, yaw: me.yaw, indoor: me.indoor, level: me.level };
  state.met = { maw: maw.met, wing: wing.met };
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
  }
  placing = null;
  rebuildBase();
  resetGiants();
  maw.met = !!state.met.maw;
  wing.met = !!state.met.wing;
  for (const node of nodes) {
    node.back = 0;
    showNode(node, true);
  }
  for (const stone of STONES) stoneModels[stone.id].group.visible = !state.stones[stone.id];
  lightTower();

  if (saved && state.at) {
    me.x = state.at.x;
    me.y = state.at.y;
    me.z = state.at.z;
    me.yaw = state.at.yaw;
    me.indoor = state.at.indoor;
    me.level = state.at.level;
  } else {
    me.x = START.x;
    me.z = START.z;
    me.y = groundAt(START.x, START.z) + 1.6;
    me.yaw = 0;
    me.indoor = false;
  }
  me.pitch = me.vy = 0;
  hurtAt = -99;
  lastSave = state.time;
  for (const id of ["intro", "build", "gear", "card", "won"]) el(id).hidden = true;
  mode = "play";
  setGoal();
  if (!saved && !testing) {
    showCard("Your little landing pod is stuck in the sand, and its radio is broken.\n\nUp the hill stands an old signal tower. Five beams of light rise into the sky, far away: the tower's lost star stones. Bring them back, and the tower can call for help.\n\nBut you are not alone here. Something enormous is walking through the sea.");
  }
}

// ===== 11. Keys, mouse and buttons =====
window.addEventListener("keydown", function (e) {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;

  if (mode === "card") {
    if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") closeCard();
    return;
  }
  if (mode === "menu") {
    const digit = e.code.indexOf("Digit") === 0 ? Number(e.code.slice(5)) : -1;
    const kind = Object.keys(PARTS)[digit === 0 ? 9 : digit - 1];
    if (e.code === "KeyB" || e.code === "Escape") closeMenus();
    else if (kind) chooseBuild(kind);
    return;
  }
  if (mode === "gear") {
    if (e.code === "KeyE" || e.code === "Escape") closeMenus();
    return;
  }
  if (mode !== "play") return;

  if (e.code === "KeyE") pressE();
  else if (e.code === "KeyB") openBuild();
  else if (e.code === "Escape") placing = null;
  else if (e.code === "KeyX") packUp() && afterBuild();
  else if (e.code === "KeyH") eat();
  else if (e.code === "KeyR") blowHorn();
  else if (e.code === "KeyL") {
    if (!state.gear.light) say("You have no dive light yet. You can make one at a workbench.", 3);
    else torchOn = !torchOn;
  } else if (e.code === "Space") climb(1);
  else if (e.code === "KeyC") climb(-1);
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
  else if (placing) pressE();
});

document.addEventListener("pointerlockchange", function () {
  locked = document.pointerLockElement === canvas;
});

document.addEventListener("mousemove", function (e) {
  if (!locked || mode !== "play") return;
  me.yaw -= e.movementX * 0.0024;
  me.pitch = clamp(me.pitch - e.movementY * 0.0024, -1.45, 1.45);
});

el("card").addEventListener("click", closeCard);
el("build-close").addEventListener("click", closeMenus);
el("gear-close").addEventListener("click", closeMenus);
el("won-close").addEventListener("click", function () {
  el("won").hidden = true;
  mode = "play";
});
el("parts").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (button) chooseBuild(button.dataset.kind);
});
el("gear-list").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (button) makeGear(button.dataset.gear);
});
el("start").addEventListener("click", function () {
  begin(null);
});
el("continue").addEventListener("click", function () {
  begin(load());
});

// ===== 12. Go! =====
rebuildBase();
resetGiants();
me.y = groundAt(START.x, START.z) + 1.6;
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
    // Behind the title, the Tidewalker keeps walking
    updateWalker(dt, wall);
  }
  draw(dt);
  renderer.render(scene, camera);
}

// For testing the game with a script: add ?test to the address
if (testing) {
  begin(null);
  window.FS = {
    me: me, keys: keys, nodes: nodes, walker: walker, maw: maw, wing: wing, solids: solids, shelters: shelters,
    state: function () { return state; },
    mode: function () { return mode; },
    near: function () { return near; },
    placing: function () { return placing; },
    swimming: function () { return swimming; },
    frames: function () { return frameCount; },
    begin: begin, save: save, load: load, pressE: pressE, hurt: hurt, chooseBuild: chooseBuild, makeGear: makeGear,
    roomTarget: roomTarget, faceTarget: faceTarget, placeRoom: placeRoom, setFace: setFace, placeItem: placeItem, packUp: packUp,
    doorNear: doorNear, ladderNear: ladderNear, climb: climb, sheltered: sheltered,
    // Run the game forward by n small steps, without waiting
    step: function (n) {
      for (let i = 0; i < n; i++) {
        if (mode !== "play") break;
        state.time += 0.05;
        play(0.05);
      }
    },
  };
}

requestAnimationFrame(frame);
