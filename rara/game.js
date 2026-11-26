// Ra Ra Escape: the game.
// You, the camera, hiding places, boulders, the rope bridge, the fight with Doctor Twigg,
// and the story that joins the levels together.

// ===== 1. What the game remembers =====
const SAVE = "rara-save";
const me = {
  x: 0, y: 0, z: 0, face: 0, vy: 0, pace: 0,
  stamina: 1,        // how much sprint you have left (0 to 1)
  inside: null,      // the building or cave you are hiding in
  hidden: false,     // hidden in the reeds?
  hideTime: 0,
  dizzy: 0,          // slowed down until this time
  model: makePerson(0x3a6ad8, 0x3a3a44, 0x5a3a22),
};
scene.add(me.model.group);

let level = null;
let levelIndex = 0;
let mode = "intro";    // intro, play, card, grow, end or won
let clock = 0;         // seconds of play (it stops while a story card is showing)
let wall = 0;          // a clock that never stops (for animations)
let look = 0;          // which way the camera looks (0 = north)
let tilt = 0.2;
let locked = false;
let shake = 0;
let mark = 0;          // where you start again if you are caught
let near = null;
let holdTime = 0;
let stageTime = 0;     // how far through a film-like scene we are
let nextRa = 0;
let fall = null;
const keys = {};

// ===== 2. Sounds and messages =====
function sound(make) {
  try { make(); } catch (problem) { /* no sound is fine */ }
}
function soundRa() { sound(function () { playTone(0, 0.16, 190, 150, 0.22); playTone(0.2, 0.2, 190, 140, 0.22); }); }
function soundRoar() { sound(function () { playNoise(0, 0.9, 500, 80, 0.4); playTone(0, 0.3, 220, 150, 0.3); playTone(0.32, 0.5, 220, 110, 0.3); }); }
function soundGot() { sound(function () { playTone(0, 0.09, 600, 900, 0.15); playTone(0.09, 0.14, 900, 1300, 0.15); }); }
function soundCrash() { sound(function () { playNoise(0, 0.8, 1200, 80, 0.5); }); }
function soundZap() { sound(function () { playNoise(0, 0.35, 3000, 400, 0.3); playTone(0, 0.35, 1400, 300, 0.2); }); }
function soundDoor() { sound(function () { playTone(0, 0.12, 300, 200, 0.2); }); }

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

// ===== 3. Starting a level =====
const STORY = {
  home: "Late one night, you hear a strange noise in the garden.\n\nRa... ra... ra...\n\nIt is coming from the bush by the fence. Go and have a look.",
  city: "RUN! Down the street!\n\nYou can hide in a building with a glowing door (press E). But only STRONG buildings keep it out. Look at what a building is made of before you go in.\n\nHold Shift to sprint.",
  swamp: "You are out of the city, but it is still coming.\n\nThis is the Swamp. The wooden boards are quick. The water is slow, and its long legs don't mind water one bit.\n\nStand in a patch of tall reeds, well ahead of it, and it will lose you.",
  mountains: "The Mountains. The only way is up.\n\nJump the cracks in the path (Space). Push a boulder down the hill at it (E). The caves are solid rock.\n\nAt the very top there is an old rope bridge.",
  forest: "The Alaskan Redwood Forest. The trees are as wide as houses.\n\nSomebody has been here. There are signs, and a trail through the snow.\n\nAnd behind you... ra. Ra. RA.",
};

function loadLevel(index) {
  if (level) scene.remove(level.group);
  levelIndex = index;
  level = BUILDERS[ORDER[index]]();
  scene.add(level.group);
  scene.fog.color.setHex(level.sky);
  scene.fog.near = level.fog[0];
  scene.fog.far = level.fog[1];
  renderer.setClearColor(level.sky);
  skyLight.intensity = level.amb;
  sunLight.intensity = level.sun;
  mark = 0;
  placeAt(0);
  look = 0;
  bug.dropping = false;
  if (level.id === "home") {
    bug.size = 0.03;
    bug.mood = "still";
    bug.x = level.bush.x;
    bug.z = level.bush.z;
    bug.y = 1.2;
    bug.yaw = 2;
  } else {
    bug.size = 1;
  }
  try { localStorage.setItem(SAVE, JSON.stringify({ level: index })); } catch (problem) { /* never mind */ }
  showCard(STORY[level.id]);
}

// Put you at a checkpoint, with the stick bug a fair way behind
function placeAt(z) {
  me.z = z;
  me.x = level.id === "swamp" ? boardX(z) : level.id === "mountains" ? trailX(z) : 0;
  me.y = level.ground(me.x, me.z);
  me.vy = 0;
  me.inside = null;
  me.hidden = false;
  me.dizzy = 0;
  me.stamina = 1;
  me.face = 0;
  me.model.group.visible = true;
  fall = null;
  if (level.id === "home") return;
  bug.z = z + level.gap;
  bug.x = level.id === "swamp" ? boardX(Math.min(10, bug.z)) : level.id === "mountains" ? trailX(bug.z) : 0;
  bug.yaw = 0;
  bug.mood = "stun";       // it rears up and roars for a moment before it charges
  bug.until = clock + 2;
  // In the lab, it comes in through the gap in the trees behind you
  if (level.boss && level.boss.on) {
    me.z = LAB.z + LAB.r - 6;
    bug.z = LAB.z + LAB.r + 30;
  }
}

// Caught! Go back to the last checkpoint.
function caught(why) {
  if (mode !== "play") return;
  soundRoar();
  showCard(why + "\n\nRA RA!\n\nTry again from the last safe spot.", function () {
    // Everything ahead of the checkpoint is put back the way it was
    for (const door of level.doors) {
      door.used = door.cracking = false;
      door.building.visible = true;
      if (door.rubble) door.rubble.visible = false;
    }
    for (const hide of level.hides) hide.used = false;
    level.boulders.forEach(function (rock, n) {
      rock.state = "ready";
      rock.mesh.visible = true;
      rock.mesh.position.set(rock.x, level.ground(rock.x, rock.z) + 1.8, rock.z);
    });
    placeAt(mark);
  });
}

// ===== 4. Moving =====
function moveMe(dt) {
  look += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 2.2 * dt;
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  let vx = -Math.sin(look) * ahead + Math.cos(look) * side;
  let vz = -Math.cos(look) * ahead - Math.sin(look) * side;
  const moving = Math.hypot(vx, vz) > 0.01;
  // Sprinting uses up your puff. It comes back when you slow down.
  const sprint = moving && (keys.ShiftLeft || keys.ShiftRight) && me.stamina > 0.02;
  if (sprint) me.stamina = Math.max(0, me.stamina - dt / 5);
  else me.stamina = Math.min(1, me.stamina + dt / (moving ? 8 : 4));
  let speed = (sprint ? 10.5 : 6.2) * level.pace(me.x, me.z);
  if (clock < me.dizzy) speed *= 0.5;
  me.pace = 0;
  if (moving) {
    const long = Math.hypot(vx, vz);
    vx = vx / long * speed;
    vz = vz / long * speed;
    me.x += vx * dt;
    me.z += vz * dt;
    me.pace = speed;
    let turn = Math.atan2(-vx, -vz) - me.face;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    me.face += turn * Math.min(1, dt * 12);
  }
  // Solid things: cars, trees, rocks, walls
  for (const s of level.solids) {
    if (s.off) continue;
    if (s.r) {
      const dx = me.x - s.x;
      const dz = me.z - s.z;
      const far = Math.hypot(dx, dz);
      const gap = s.r + 0.45;
      if (far < gap && far > 0.001) {
        me.x = s.x + dx / far * gap;
        me.z = s.z + dz / far * gap;
      }
    } else if (me.x > s.x0 - 0.45 && me.x < s.x1 + 0.45 && me.z > s.z0 - 0.45 && me.z < s.z1 + 0.45) {
      const left = me.x - (s.x0 - 0.45);
      const right = s.x1 + 0.45 - me.x;
      const back = me.z - (s.z0 - 0.45);
      const front = s.z1 + 0.45 - me.z;
      const least = Math.min(left, right, back, front);
      if (least === left) me.x = s.x0 - 0.45;
      else if (least === right) me.x = s.x1 + 0.45;
      else if (least === back) me.z = s.z0 - 0.45;
      else me.z = s.z1 + 0.45;
    }
  }
  me.x = clamp(me.x, -level.half, level.half);
  me.z = Math.min(me.z, 14);
  if (level.keepIn) level.keepIn(me);
  // Jumping and falling
  let floor = level.ground(me.x, me.z);
  // If you have dropped below the edge of a crack, you can't step back up: you fall
  if (level.id === "mountains" && floor - me.y > 1) floor = -60;
  me.vy -= 22 * dt;
  me.y += me.vy * dt;
  if (me.y <= floor) {
    me.y = floor;
    me.vy = 0;
    if (keys.Space) me.vy = 8;
  }
  if (level.id === "mountains" && me.y < level.ground(me.x, me.z, true) - 9) caught("You fell down a crack in the mountain!");
}

// ===== 5. Hiding =====
// Hiding in tall reeds (the Swamp)
function hideInReeds(dt) {
  const patch = level.hides.find(function (h) { return !h.used && Math.hypot(me.x - h.x, me.z - h.z) < h.r; });
  if (!patch) {
    me.hidden = false;
    me.hideTime = 0;
    return;
  }
  me.hideTime += dt;
  if (!me.hidden && me.hideTime > 1) {
    if (bugGap() > 12 || bug.mood !== "chase") {
      me.hidden = true;
      me.patch = patch;
      say("Shh... you are hidden in the reeds. Keep still until it goes away.", 4);
    } else if (me.hideTime < 1.1) {
      say("It saw you go in! Too close. Keep running!", 3);
    }
  }
}

// The stick bug lost you in the reeds and has wandered off
function hidWell() {
  if (me.patch) {
    me.patch.used = true;
    mark = Math.min(mark, me.patch.z);
  }
  me.hidden = false;
  soundGot();
  say("It has lost you! It wanders off... but not for long. Go!", 4);
}

// The stick bug has finished bashing on the door you are hiding behind
function doorHeld() {
  const door = me.inside;
  if (!door) {
    bug.mood = "chase";
  } else if (bug.mood === "smash") {
    caught("It smashed its way into " + door.name + "!");
  } else if (door.safe) {
    bug.mood = "retreat";
    bug.backTo = bug.z + 55;
    bug.until = clock + 8;
    door.used = true;
    mark = Math.min(mark, door.z);
    soundGot();
    say("It can't break in! It stalks away. Wait a moment, then press E to come out.", 6);
  } else {
    // Not strong enough: you have a few seconds to get out of the back
    bug.mood = "smash";
    bug.until = clock + 3;
    door.cracking = true;
    soundCrash();
  }
}

function goInside(door) {
  me.inside = door;
  me.model.group.visible = false;
  me.hidden = false;
  soundDoor();
  say("You are hiding in " + door.name + "...", 3);
}

function comeOut() {
  const door = me.inside;
  me.inside = null;
  me.model.group.visible = true;
  me.vy = 0;
  if (door.cracking) {
    // Out of the back just in time, as the whole place comes down on the stick bug
    door.cracking = false;
    door.used = true;
    door.building.visible = false;
    if (door.rubble) door.rubble.visible = true;
    me.x = door.x - door.side * 4;
    me.z = door.z - 15;
    bug.mood = "stun";
    bug.until = clock + 3.5;
    shake = 1;
    soundCrash();
    say("You dash out of the back as it all comes crashing down!", 4);
  } else {
    me.x = door.x - door.side * 2;
    me.z = door.z;
    door.used = true;
  }
  if (level.keepIn) level.keepIn(me);
  me.y = level.ground(me.x, me.z);
}

// ===== 6. Things to use =====
function findNear() {
  if (me.inside) return null;
  if (level.bush && Math.hypot(me.x - level.bush.x, me.z - level.bush.z) < 3.5) return { type: "bush", text: "E: look in the bush" };
  for (const door of level.doors) {
    if (!door.used && Math.hypot(me.x - door.x, me.z - door.z) < 3.4) return { type: "door", door: door, text: "E: hide in " + door.name + " (" + door.clue + ")" };
  }
  for (const rock of level.boulders) {
    if (rock.state === "ready" && Math.hypot(me.x - rock.x, me.z - rock.z) < 4.4 && me.z < rock.z + 1) return { type: "boulder", rock: rock, text: "E: push the boulder down the hill" };
  }
  if (level.rope && !level.bridgeDown && me.z < BRIDGE.to && Math.hypot(me.x - level.rope.x, me.z - level.rope.z) < 4.5) return { type: "rope", text: "E: cut the ropes of the bridge!" };
  for (const lever of level.levers) {
    if (level.boss.on && !lever.pulled && Math.hypot(me.x - lever.x, me.z - lever.z) < 3.2) return { type: "lever", lever: lever, text: "Hold E: pull the power lever" };
  }
  return null;
}

function pressE() {
  if (me.inside) return comeOut();
  if (!near) return;
  if (near.type === "door") goInside(near.door);
  else if (near.type === "bush") showCard("You part the leaves. Sitting on a twig is a tiny stick bug, no longer than your finger.\n\n\"Ra ra,\" it says.\n\nThen a beam of green light flashes down out of the night sky...", function () {
    mode = "grow";
    stageTime = 0;
    soundZap();
  });
  else if (near.type === "boulder") {
    near.rock.state = "rolling";
    level.solids.forEach(function (s) { if (s.boulder !== undefined && level.boulders[s.boulder] === near.rock) s.off = true; });
    soundCrash();
  } else if (near.type === "rope") cutBridge();
}

// Rolling boulders (the Mountains)
function rollBoulders(dt) {
  for (const rock of level.boulders) {
    if (rock.state !== "rolling") continue;
    rock.z += 17 * dt;
    rock.x = trailX(rock.z);
    rock.spin += dt * 8;
    rock.mesh.position.set(rock.x, trailY(rock.z) + 1.8, rock.z);
    rock.mesh.rotation.x = rock.spin;
    if (Math.abs(rock.z - bug.z) < 5 && bug.mood !== "still") {
      bug.mood = "stun";
      bug.until = clock + 6;
      bug.z += 16;
      rock.state = "gone";
      rock.mesh.visible = false;
      shake = 0.8;
      soundCrash();
      say("CRASH! The boulder bowls it right back down the hill!", 4);
    } else if (rock.z > 20) {
      rock.state = "gone";
      rock.mesh.visible = false;
    }
  }
}

function cutBridge() {
  level.bridgeDown = true;
  const onIt = bug.z < BRIDGE.from + 8 && bug.z > BRIDGE.to - 4;
  bug.mood = "still";
  bug.dropping = onIt;
  soundCrash();
  fall = { time: 0, onIt: onIt };
}

// ===== 7. Doctor Twigg's lab (the last fight) =====
const blobShape = new THREE.SphereGeometry(1, 10, 8);

function bossTick(dt) {
  const boss = level.boss;
  if (!boss) return;
  if (!boss.on) {
    if (Math.hypot(me.x - LAB.x, me.z - LAB.z) > LAB.r - 5) return;
    boss.on = true;
    boss.nextShot = clock + 4;
    mark = -296;
    bug.z = Math.max(bug.z, me.z + 30);
    bug.mood = "stun";
    bug.until = clock + 3;
    showCard("\"So! You led my beautiful stick bug all the way home!\"\n\nA scientist in a white coat stands beside a huge machine. \"I am Doctor Twigg. My Ra-Ra Ray made one tiny bug into a GIANT. Soon every bug in the world will be as big as a bus!\"\n\nThe machine has three power levers, round the edge of the clearing. Pull all three (hold E)!");
    return;
  }
  if (boss.done) return;
  // Twigg turns to face you, and fires the ray at where you are standing
  level.twigg.group.rotation.y = Math.atan2(me.x - level.twiggAt.x, me.z - level.twiggAt.z);
  if (clock > boss.nextShot) {
    boss.nextShot = clock + 3.2;
    const mesh = new THREE.Mesh(blobShape, bright(0x9dff4a));
    mesh.add(glow(0x7dff3a, 8));
    level.group.add(mesh);
    boss.blobs.push({ mesh: mesh, t: 0, x: me.x, z: me.z });
    soundZap();
  }
  for (let n = boss.blobs.length - 1; n >= 0; n--) {
    const blob = boss.blobs[n];
    blob.t += dt / 1.5;
    const from = level.twiggAt;
    blob.mesh.position.set(from.x + (blob.x - from.x) * blob.t, from.y + 2 + Math.sin(blob.t * Math.PI) * 9 - blob.t * (from.y + 1.5), from.z + (blob.z - from.z) * blob.t);
    if (blob.t < 1) continue;
    // Splat! Anything the ray hits grows: a giant mushroom pops up where it lands.
    level.group.remove(blob.mesh);
    boss.blobs.splice(n, 1);
    const shroom = new THREE.Group();
    shroom.position.set(blob.x, level.ground(blob.x, blob.z), blob.z);
    piece(shroom, new THREE.CylinderGeometry(0.4, 0.6, 2.4, 7), paint(0xf0e8d8), 0, 1.2, 0);
    ball(shroom, paint(0xd8443a), 1.8, 0.9, 1.8, 0, 2.6, 0);
    level.group.add(shroom);
    if (Math.hypot(me.x - blob.x, me.z - blob.z) < 2.8) {
      me.dizzy = clock + 2.5;
      say("The Ra-Ra Ray hits you! Everything spins...", 3);
    }
  }
}

function pullLever(lever) {
  const boss = level.boss;
  lever.pulled = true;
  lever.handle.rotation.x = 0.7;
  lever.lamp.material = bright(0x5aff7a);
  lever.shine.material.color.setHex(0x5aff7a);
  boss.pulled++;
  soundZap();
  bug.mood = "stun";
  bug.until = clock + 3.5;
  shake = 0.5;
  if (boss.pulled < 3) return say("Lever " + boss.pulled + " of 3! Sparks fly from the machine, and the stick bug staggers.", 4);
  // All three: the machine goes into reverse
  boss.done = true;
  mode = "end";
  stageTime = 0;
  bug.mood = "still";
  for (const blob of boss.blobs) level.group.remove(blob.mesh);
  boss.blobs.length = 0;
}

// ===== 8. One step of the game =====
function tick(dt) {
  clock += dt;
  if (!me.inside) moveMe(dt);
  if (mode !== "play") return;
  hideInReeds(dt);
  near = findNear();
  // Holding E on a lever
  if (near && near.type === "lever" && keys.KeyE) {
    holdTime += dt;
    if (holdTime > 1.3) {
      holdTime = 0;
      pullLever(near.lever);
    }
  } else {
    holdTime = 0;
  }
  if (mode !== "play") return;
  if (!level.quiet) updateBug(dt);
  rollBoulders(dt);
  bossTick(dt);
  if (mode !== "play") return;

  // The rope bridge falling
  if (fall) {
    fall.time += dt;
    level.bridge.position.y -= dt * 30;
    level.bridge.rotation.z += dt * 0.3;
    if (bug.dropping) bug.y -= dt * 28;
    if (fall.time > 2.6) {
      const onIt = fall.onIt;
      fall = null;
      showCard(onIt ? "SNAP! The bridge drops away, and the stick bug with it.\n\n\"RA RAAAAAaaaaa...\"\n\nIt lands in the river far below. But stick bugs float." : "SNAP! The bridge is gone. Now it will have to climb the long way round.\n\nThat should give you a head start.", function () { loadLevel(levelIndex + 1); });
    }
    return;
  }
  // Checkpoints, and the end of the level
  for (const z of level.marks) {
    if (me.z < z && z < mark) mark = z;
  }
  if (!level.noExit && level.id !== "home" && me.z < -level.length) {
    showCard(level.id === "city" ? "You made it out of the city! The street lamps end, and the road turns to mud..." : "Dry land! Stone steps climb up out of the swamp, towards the snowy mountains.", function () { loadLevel(levelIndex + 1); });
  }
  // "Ra ra": the closer it is, the faster it chants
  if (bug.size > 0.5 && (bug.mood === "chase" || bug.mood === "bang") && clock > nextRa) {
    nextRa = clock + clamp(bugGap() / 22, 0.45, 2.4);
    soundRa();
  }
}

// The film-like scenes: the bug growing at the start, and shrinking at the end
function stage(dt) {
  stageTime += dt;
  if (mode === "grow") {
    bug.size = 0.03 + smooth(stageTime / 3.5) * 0.97;
    bug.y = level.ground(bug.x, bug.z) + (1 - smooth(stageTime / 3.5)) * 1.2;
    shake = 0.3;
    if (stageTime > 4.3) {
      soundRoar();
      showCard("The tiny stick bug grows... and grows... and GROWS, until it is as long as a bus.\n\n\"RA RA!\"\n\nIt is looking straight at you.", function () { loadLevel(1); });
    }
  } else if (mode === "end") {
    // The beam turns blue and shrinks the stick bug. Then it swings round onto Twigg.
    const twigg = level.twigg.group;
    level.orb.material.color.setHex(0x6ad8ff);
    level.orbGlow.material.color.setHex(0x6ad8ff);
    level.beam.visible = stageTime > 0.6 && stageTime < 7;
    const from = new THREE.Vector3(LAB.x, level.ground(LAB.x, LAB.z) + 13.5, LAB.z);
    const onTwigg = stageTime > 4.3;
    const to = onTwigg ? new THREE.Vector3(level.twiggAt.x, level.twiggAt.y + 1, level.twiggAt.z) : new THREE.Vector3(bug.x, bug.y + BUG_HIGH * bug.size, bug.z);
    stretch(level.beam, from, to);
    if (stageTime > 0.6) bug.size = Math.max(0.035, 1 - smooth((stageTime - 0.6) / 3.2) * 0.965);
    if (onTwigg) twigg.scale.setScalar(Math.max(0.2, 1.25 - smooth((stageTime - 4.3) / 2.2) * 1.05));
    if (stageTime > 7.6) {
      mode = "won";
      sound(playJingle);
      try { localStorage.removeItem(SAVE); } catch (problem) { /* never mind */ }
      el("won").hidden = false;
    }
  }
}

// ===== 9. Drawing =====
const strings = {};
function setText(id, text) {
  if (strings[id] === text) return;
  strings[id] = text;
  el(id).innerHTML = text;
}

function drawHud() {
  const gap = bugGap();
  const hunting = level && !level.quiet && bug.size > 0.5 && bug.mood !== "still";
  el("stamina-fill").style.width = Math.round(me.stamina * 100) + "%";
  el("bug-fill").style.width = hunting ? clamp(100 - gap, 4, 100) + "%" : "0%";
  setText("bug-text", !hunting ? "" : bug.mood === "retreat" || bug.mood === "lost" ? "It has lost you" : bug.mood === "stun" ? "Stick bug: stunned" : "Stick bug: " + Math.round(gap) + " m behind");
  const far = level.boss && level.boss.on ? "Levers pulled: " + level.boss.pulled + " of 3" : level.quiet ? "" : Math.round(clamp(-me.z / level.length, 0, 1) * 100) + "% of the way";
  setText("where", level.name + (far ? " · " + far : ""));

  let warn = "";
  if (mode === "play") {
    if (me.inside && me.inside.cracking) warn = "CRACK! IT IS BREAKING IN! PRESS E TO RUN OUT OF THE BACK!";
    else if (!me.inside && hunting && bug.mood === "chase" && gap < 9) warn = "IT IS RIGHT BEHIND YOU!";
    else if (clock < me.dizzy) warn = "You are dizzy!";
  }
  setText("warn", warn);
  el("warn").hidden = !warn;

  let hint = "";
  if (mode === "play") {
    if (me.inside) hint = me.inside.cracking ? "" : bug.mood === "bang" ? "It is bashing on the walls..." : "E: come out";
    else if (near) hint = near.text;
    else if (me.hidden) hint = "Hidden. Keep still...";
  }
  setText("hint", hint);
  el("hint").hidden = !hint;
  el("hold").hidden = holdTime <= 0;
  el("hold-fill").style.width = Math.min(100, holdTime / 1.3 * 100) + "%";
  if (!el("toast").hidden && wall > toastUntil) el("toast").hidden = true;
  const red = hunting && bug.mood === "chase" && !me.inside ? clamp(1 - gap / 16, 0, 1) : 0;
  el("tint").style.boxShadow = red > 0 ? "inset 0 0 " + Math.round(red * 170) + "px rgba(255,30,20," + (0.4 + red * 0.4) + ")" : "none";
}

function draw(dt) {
  wall += dt;
  shake = Math.max(0, shake - dt);
  // You
  const model = me.model.group;
  model.position.set(me.x, me.y, me.z);
  model.rotation.y = me.face;
  walkPerson(me.model, wall, me.pace);
  if (level.twigg) walkPerson(level.twigg, wall, mode === "end" ? 6 : 0.6);
  poseBug(wall);
  if (level.lights) level.lights.forEach(function (sheet, n) { sheet.material.opacity = 0.16 + Math.sin(wall * 0.7 + n * 1.7) * 0.1; });

  // The camera
  if (mode === "intro" && level.id === "home") {
    camera.position.set(Math.sin(wall * 0.1) * 26, 9, -8 + Math.cos(wall * 0.1) * 26);
    camera.lookAt(0, 2, -8);
  } else if (mode === "grow" || mode === "end" || mode === "won") {
    // Stand back and watch
    const back = mode === "grow" ? 10 + bug.size * 16 : 22;
    camera.position.set(bug.x - Math.sin(wall * 0.25) * back, bug.y + 4 + bug.size * 6, bug.z + Math.cos(wall * 0.25) * back);
    if (mode !== "grow" && stageTime > 4.3) camera.position.set(level.twiggAt.x - 9, level.twiggAt.y + 3, level.twiggAt.z + 11);
    const at = mode !== "grow" && stageTime > 4.3 ? level.twiggAt : bug;
    camera.lookAt(at.x, at.y + (at === bug ? BUG_HIGH * bug.size : 1), at.z);
  } else if (fall) {
    // The rope bridge falling, seen from the side
    const bx = trailX(BRIDGE.from);
    const by = trailY(BRIDGE.from);
    camera.position.set(bx + 34, by + 9, BRIDGE.to - 16);
    camera.lookAt(bx, by - fall.time * 5, (BRIDGE.from + BRIDGE.to) / 2);
  } else if (me.inside) {
    // Watch the building from across the way
    const door = me.inside;
    camera.position.set(door.x - door.side * 15, door.y + 8, door.z + 16);
    camera.lookAt(door.x + door.side * 4, door.y + 3, door.z);
  } else {
    const high = 4.2 + tilt * 6;
    camera.position.set(me.x + Math.sin(look) * 9, me.y + high, me.z + Math.cos(look) * 9);
    camera.position.y = Math.max(camera.position.y, level.ground(camera.position.x, camera.position.z) + 1);
    camera.lookAt(me.x - Math.sin(look) * 4, me.y + 1.8, me.z - Math.cos(look) * 4);
  }
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.6;
    camera.position.y += (Math.random() - 0.5) * shake * 0.6;
  }
  drawHud();
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
  if (mode === "play" && e.code === "KeyE") pressE();
});

window.addEventListener("keyup", function (e) {
  keys[e.code] = false;
});

window.addEventListener("blur", function () {
  for (const code in keys) keys[code] = false;
});

canvas.addEventListener("click", function () {
  if (mode === "play" && canvas.requestPointerLock) canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", function () {
  locked = document.pointerLockElement === canvas;
});

document.addEventListener("mousemove", function (e) {
  if (!locked || mode !== "play") return;
  look -= e.movementX * 0.003;
  tilt = clamp(tilt + e.movementY * 0.002, -0.2, 0.9);
});

el("card").addEventListener("click", function () {
  if (mode === "card") closeCard();
});
el("start").addEventListener("click", function () {
  el("intro").hidden = true;
  loadLevel(0);
});
el("continue").addEventListener("click", function () {
  el("intro").hidden = true;
  loadLevel(savedLevel());
});
el("again").addEventListener("click", function () {
  el("won").hidden = true;
  loadLevel(0);
});

function savedLevel() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE));
    return saved && saved.level > 0 && saved.level < ORDER.length ? saved.level : 0;
  } catch (problem) {
    return 0;
  }
}

// ===== 11. Go! =====
// Behind the title: your garden at night
level = buildHome();
scene.add(level.group);
scene.fog.color.setHex(level.sky);
scene.fog.near = level.fog[0];
scene.fog.far = level.fog[1];
renderer.setClearColor(level.sky);
skyLight.intensity = level.amb;
sunLight.intensity = level.sun;
bug.size = 0.03;
bug.mood = "still";
bug.x = level.bush.x;
bug.z = level.bush.z;
bug.y = 1.2;
me.z = 0;
el("continue").hidden = savedLevel() === 0;

let lastTime = 0;
let frameCount = 0;
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ms - lastTime) / 1000 || 0.016);
  lastTime = ms;
  frameCount++;
  fit();
  if (mode === "play") tick(dt);
  else if (mode === "grow" || mode === "end") stage(dt);
  draw(dt);
  renderer.render(scene, camera);
}

// For testing the game with a script: add ?test to the address
if (testing) {
  el("intro").hidden = true;
  window.RR = {
    me: me, bug: bug, keys: keys,
    level: function () { return level; },
    mode: function () { return mode; },
    clock: function () { return clock; },
    mark: function () { return mark; },
    near: function () { return near; },
    frames: function () { return frameCount; },
    load: loadLevel, pressE: pressE, closeCard: closeCard, gap: bugGap, caught: caught,
    // Run the game forward by n small steps, without waiting
    step: function (n) {
      for (let i = 0; i < n; i++) {
        if (mode === "play") tick(0.05);
        else if (mode === "grow" || mode === "end") stage(0.05);
      }
    },
  };
}

requestAnimationFrame(frame);
