// Treetop Island: the game.
// The treehouse designer, walking about and climbing, picking things up, making things,
// eating and sleeping, day and night, the map, your jobs, and saving.

// ===== 1. What the game remembers =====
const SAVE = "treetop-save";

function freshState() {
  const bag = {};
  const got = {};
  for (const type in ITEMS) bag[type] = got[type] = 0;
  return {
    design: freshDesign(),   // what your treehouse looks like
    time: DAY * 0.05,        // seconds since the first sunrise
    day: 1,
    nights: 0, slept: 0,
    health: 100, food: 80,
    bag: bag,                // what you are carrying: { berry: 3, stick: 1 ... }
    got: got,                // everything you have ever gathered (your jobs count these)
    tools: {},               // the tools you have made: { axe: true ... }
    built: {},               // the parts you have built on to the treehouse
    lit: false,              // is your torch burning?
    nestEgg: false,          // is there an egg in the nest box?
    pet: null,               // your raptor: { name, grow, fedAt }
    cooked: 0,
    chopped: [],             // the trees you have cut down
    back: {},                // when each berry bush, stick and so on comes back
    goal: 0,
    blind: 0, safeUntil: 0, hornAt: 0,
    won: false,
    at: null,                // where you were when the game was saved
  };
}

let state = freshState();
const homeY = groundAt(HOME.x, HOME.z);
const me = { x: 0, z: 0, y: 0, yaw: 0, pitch: 0, up: true, out: false, sneak: false, moving: false, running: false, still: 0, stamina: 1 };
let mode = "intro";          // intro, design, play, make, card, name or won
let near = null;             // what E would do right now: { text, act }
let locked = false;          // is the mouse steering the camera?
let shake = 0;
let wall = 0;                // a clock that never stops (for animations)
let hurtAt = -9;             // when you were last hurt, and when you last jabbed (by the "wall" clock, for drawing)
let jabAt = -9;
let lastHurt = -9;           // the same two moments by the game's own clock (for the rules)
let jabReady = 0;
let swingUntil = 0;
let lastSave = 0;
let lastCheck = 0;
let stepAt = 0;
let spin = 0.6;              // which way the camera looks at the treehouse while you design it
let redesign = false;        // true when you came to the designer from your workbench
const keys = {};

function timeOfDay() {
  return (state.time % DAY) / DAY;
}

function isNight() {
  return timeOfDay() > DARK;
}

// A spot on (or under) your treehouse, by its name in SPOTS
function homeSpot(name) {
  return { x: HOME.x + SPOTS[name].x, z: HOME.z + SPOTS[name].z };
}

// ===== 2. Sounds and messages =====
function sound(make) {
  try { make(); } catch (problem) { /* no sound is fine */ }
}
function soundPick() { sound(function () { playTone(0, 0.08, 600, 900, 0.12); }); }
function soundMake() { sound(function () { playNoise(0, 0.12, 500, 1400, 0.15); playTone(0.05, 0.2, 500, 800, 0.15); }); }
function soundNo() { sound(function () { playTone(0, 0.15, 220, 160, 0.15); }); }
function soundChop() { sound(function () { playNoise(0, 0.1, 900, 300, 0.25); }); }
function soundEat() { sound(function () { playNoise(0, 0.08, 1200, 700, 0.12); playNoise(0.14, 0.08, 1200, 700, 0.12); }); }
function soundGrowl() { sound(function () { playNoise(0, 0.6, 300, 100, 0.3); playTone(0, 0.5, 140, 80, 0.25); }); }
function soundRoar() { sound(function () { playNoise(0, 1.4, 400, 60, 0.5); playTone(0, 1.2, 150, 45, 0.4); }); }
function soundHurt() { sound(function () { playTone(0, 0.2, 300, 120, 0.25); }); }
function soundSpit() { sound(function () { playNoise(0, 0.15, 2500, 900, 0.15); }); }
function soundThud() { sound(function () { playTone(0, 0.25, 70, 40, 0.35); }); }
function soundHorn() { sound(function () { playTone(0, 1.4, 110, 150, 0.4); playTone(0, 1.4, 165, 220, 0.25); }); }

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

// ===== 3. Your treehouse, and designing it =====
let homeModel = null;
function rebuildHome() {
  if (homeModel) scene.remove(homeModel);
  homeModel = makeTreehouse(state.design, state.built, state.nestEgg);
  homeModel.position.set(HOME.x, homeY, HOME.z);
  scene.add(homeModel);
}

// Write all the buttons of the designer. The ones you have chosen are lit up.
function drawDesigner() {
  const design = state.design;
  let html = "";
  for (const key in CHOICES) {
    html += "<h3>" + CHOICES[key].name + "</h3><div class=\"row\">";
    for (const option in CHOICES[key].options) html += '<button data-set="' + key + '" data-to="' + option + '"' + (design[key] === option ? ' class="on"' : "") + ">" + CHOICES[key].options[option] + "</button>";
    html += "</div>";
  }
  for (const key of ["walls", "top"]) {
    html += "<h3>" + (key === "walls" ? "Wall colour" : "Roof colour") + "</h3><div class=\"row\">";
    PAINTS.forEach(function (colour, n) {
      html += '<button class="swatch' + (design[key] === n ? " on" : "") + '" data-set="' + key + '" data-to="' + n + '" title="' + colour.name + '" style="background:#' + colour.hex.toString(16).padStart(6, "0") + '"></button>';
    });
    html += "</div>";
  }
  html += "<h3>Extras (have as many as you like)</h3><div class=\"row\">";
  for (const key in EXTRAS) html += '<button data-extra="' + key + '"' + (design.extras[key] ? ' class="on"' : "") + ">" + EXTRAS[key] + "</button>";
  html += "</div>";
  el("design-choices").innerHTML = html;
  el("design-done").textContent = redesign ? "Done" : "Start living here!";
}

function openDesigner(again) {
  redesign = again;
  mode = "design";
  el("design-name").value = state.design.name;
  drawDesigner();
  el("designer").hidden = false;
  el("hud").hidden = true;
  if (document.exitPointerLock) document.exitPointerLock();
}

function closeDesigner() {
  state.design.name = el("design-name").value.trim().slice(0, 18) || "My Treehouse";
  rebuildHome();
  el("designer").hidden = true;
  el("hud").hidden = false;
  mode = "play";
  if (!redesign) say("Welcome home! " + GOALS[0], 9);
  save();
}

// Can you stand here, up in the treehouse? (x and z are measured from the middle of the tree)
function deckFree(x, z) {
  const far = Math.hypot(x, z);
  if (far > DECK_R - 0.45 || far < TRUNK_R + 0.35) return false;
  const wallFar = state.design.shape === "square" ? Math.max(Math.abs(x), Math.abs(z)) : far;
  const doorway = z > 0 && Math.abs(x) < 0.62;
  return doorway || Math.abs(wallFar - HUT[state.design.shape]) > 0.38;
}

// ===== 4. Moving about =====
function canWalk(x, z) {
  return groundAt(x, z) > -1.5;       // any deeper and the water is over your head
}

function moveMe(dt) {
  me.yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 2 * dt;
  me.pitch = clamp(me.pitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * 1.2 * dt, -1.3, 1.3);
  const ahead = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  me.sneak = !!(keys.KeyC || keys.ControlLeft);
  me.moving = !!(ahead || side);
  me.still = me.moving ? 0 : me.still + dt;
  me.running = me.moving && !me.sneak && !me.up && (keys.ShiftLeft || keys.ShiftRight) && me.stamina > 0.02;
  if (me.running) me.stamina = Math.max(0, me.stamina - dt / 9);
  else me.stamina = Math.min(1, me.stamina + dt / (me.moving ? 9 : 4));
  const eyes = me.sneak ? 1.15 : 1.7;
  if (me.moving) {
    const wet = !me.up && groundAt(me.x, me.z) < -0.2;
    const speed = (me.sneak ? 2.2 : me.running ? 8.5 : me.up ? 3.4 : 4.8) * (wet ? 0.6 : 1);
    const long = Math.hypot(ahead, side);
    const x = me.x + (-Math.sin(me.yaw) * ahead + Math.cos(me.yaw) * side) / long * speed * dt;
    const z = me.z + (-Math.cos(me.yaw) * ahead - Math.sin(me.yaw) * side) / long * speed * dt;
    if (me.up) {
      if (deckFree(x - HOME.x, me.z - HOME.z)) me.x = x;
      if (deckFree(me.x - HOME.x, z - HOME.z)) me.z = z;
    } else {
      if (canWalk(x, me.z)) me.x = x;
      if (canWalk(me.x, z)) me.z = z;
      // Tree trunks are solid: slide round them. (So is the giant trunk of your own tree.)
      const solid = treesNear(me.x, me.z).concat([{ x: HOME.x, z: HOME.z, r: 2.1 }]);
      for (const tree of solid) {
        const dx = me.x - tree.x;
        const dz = me.z - tree.z;
        const far = Math.hypot(dx, dz);
        if (far < tree.r + 0.45 && far > 0.001) {
          me.x = tree.x + dx / far * (tree.r + 0.45);
          me.z = tree.z + dz / far * (tree.r + 0.45);
        }
      }
      // Footsteps
      if (wall > stepAt) {
        stepAt = wall + (me.running ? 0.3 : 0.5);
        if (!me.sneak) sound(function () { playNoise(0, 0.05, wet ? 1800 : 500, wet ? 900 : 250, 0.05); });
      }
    }
  }
  me.y = (me.up ? homeY + DECK : Math.max(groundAt(me.x, me.z), -0.5)) + eyes;
}

// ===== 5. Your bag, eating, and getting hurt =====
function give(type, count) {
  state.bag[type] += count;
  state.got[type] += count;
}

function foodCount() {
  return state.bag.berry + state.bag.fish + state.bag.egg + state.bag.meal;
}

// Do you have everything this costs? ({ stick: 2, vine: 1 } and so on)
function canPay(needs) {
  for (const type in needs) {
    if (state.bag[type] < needs[type]) return false;
  }
  return true;
}

function eat() {
  if (state.food > 95) return say("You are not hungry.", 2);
  // A cooked meal when you are really hungry. Otherwise berries first.
  const order = state.food < 60 ? ["meal", "berry", "fish", "egg"] : ["berry", "meal", "fish", "egg"];
  const type = order.find(function (one) { return state.bag[one] > 0; });
  if (!type) return say("You have nothing to eat. Look for bushes with red berries.", 3);
  state.bag[type]--;
  state.food = Math.min(100, state.food + ITEMS[type].food);
  if (type === "meal") state.health = Math.min(100, state.health + 15);
  soundEat();
  say(type === "meal" ? "Delicious! A hot cooked meal." : type === "berry" ? "Yum, berries." : "You eat it raw. It would be much better cooked.", 2);
}

function stealFood(d) {
  const type = ["berry", "fish", "egg", "meal"].find(function (one) { return state.bag[one] > 0; });
  if (!type) return;
  state.bag[type]--;
  soundNo();
  say("A Compsognathus stole " + (type === "berry" ? "a berry" : type === "meal" ? "a meal" : type === "egg" ? "an egg" : "a fish") + " from your bag! A torch or a spear keeps them away.", 4);
}

function hurt(amount, from, text) {
  // You can't be hurt again for one second, so a whole pack can't bite you all at once
  if (state.time < state.safeUntil || state.time - lastHurt < 1) return;
  state.health -= amount;
  lastHurt = state.time;
  hurtAt = wall;
  shake = Math.max(shake, 0.5);
  soundHurt();
  if (text) say(text, 3);
  if (from) {
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

// You never really get hurt badly: you wake up at home the next morning, with less in your bag
function faint(from) {
  for (const type of ["stick", "stone", "vine", "wood", "berry"]) state.bag[type] = Math.ceil(state.bag[type] / 2);
  state.health = 60;
  state.food = Math.max(state.food, 45);
  state.time = (Math.floor(state.time / DAY) + 1) * DAY + DAY * 0.04;
  state.safeUntil = state.time + 6;
  state.blind = 0;
  goHome();
  for (const d of dinos) d.mood = "roam";
  showCard((from ? "The " + SPECIES[from.kind].name + " was too much for you." : "You were too hungry to go on.") + " Everything goes dark...\n\nYou wake up in your hammock the next morning. You dropped half of the things in your bag on the way home.", save);
}

// Put you in the treehouse, standing in the doorway
function goHome() {
  me.up = true;
  me.x = HOME.x;
  me.z = HOME.z + HUT[state.design.shape] - 0.9;
  me.yaw = Math.PI;
  me.pitch = 0;
}

// ===== 6. What E does =====
function take(type, find) {
  const rule = FINDS[type];
  if (type === "fish" && !state.tools.spear) return say("The fish are too quick to catch by hand. You need a spear.", 3);
  find.back = state.time + rule.back;
  give(type, rule.gives);
  drawFinds(type, state.time);
  soundPick();
  say(ITEMS[type].name + " +" + rule.gives, 1.5);
  if (type === "egg") {
    // The raptors notice!
    for (const d of dinos) {
      if (d.kind === "raptor" && gap(d, me) < 90 && state.time > d.fleeUntil) startChase(d);
    }
    say("You have the egg... and the raptors have seen you. RUN!", 5);
  }
}

function chop(tree) {
  tree.hits = (tree.hits || 0) + 1;
  soundChop();
  jabAt = wall;
  if (tree.hits < 3) return;
  tree.gone = true;
  state.chopped.push(tree.slot);
  drawTree(tree);
  give("wood", 3);
  sound(function () { playNoise(0.1, 0.5, 300, 80, 0.3); });
  say("Timber! Wood +3", 2);
}

function sleep() {
  state.time = (Math.floor(state.time / DAY) + 1) * DAY + DAY * 0.04;
  state.slept++;
  state.health = Math.min(100, state.health + 40);
  state.food = Math.max(10, state.food - 12);
  state.lit = false;
  sound(playJingle);
  showCard("You climb into your hammock and listen to the forest. Far away, something roars...\n\nYou wake up safe and well. It is morning.", save);
}

function cook() {
  const count = state.bag.fish + state.bag.egg;
  if (!count) return say("You have no fish or eggs to cook.", 3);
  state.bag.meal += count;
  state.got.meal += count;
  state.bag.fish = state.bag.egg = 0;
  state.cooked += count;
  soundMake();
  say("Sizzle! You cooked " + count + " meal" + (count > 1 ? "s" : "") + ". Press Q to eat.", 4);
}

function petHungry() {
  return !!state.pet && state.pet.grow < 1 && state.time - state.pet.fedAt > 40;
}

function feedPet() {
  const type = ["fish", "meal", "egg", "berry"].find(function (one) { return state.bag[one] > 0; });
  if (!type) return say(state.pet.name + " is hungry, but you have no food to give.", 3);
  state.bag[type]--;
  state.pet.grow = Math.min(1, state.pet.grow + 0.2);
  state.pet.fedAt = state.time;
  soundEat();
  say(state.pet.grow >= 1 ? state.pet.name + " is fully grown! It will guard you from Compsognathus and raptors now." : state.pet.name + " gobbles it up and grows a little.", 4);
}

function blowHorn() {
  if (!state.built.horn) return;
  if (state.time < state.hornAt) return say("You are out of breath. Wait a little.", 2);
  state.hornAt = state.time + 60;
  soundHorn();
  let count = 0;
  for (const d of dinos) {
    if ((d.herd.act === "hunter" || d.herd.act === "spitter") && gap(d, me) < 110) {
      scare(d, me, 30);
      count++;
    }
  }
  say(count ? "HOOOOONK! " + count + " dinosaur" + (count > 1 ? "s run" : " runs") + " for the hills." : "HOOOOONK! The sound rolls across the island.", 4);
}

// Work out what E would do right now: the nearest thing you can use
function findNear() {
  let best = null;
  let bestFar = 99;
  function offer(far, reach, text, act) {
    if (far < reach && far < bestFar) {
      best = { text: text, act: act };
      bestFar = far;
    }
  }
  const tod = timeOfDay();
  if (me.up) {
    offer(gap(me, homeSpot("top")), 1.5, "Climb down", function () {
      me.up = false;
      const foot = homeSpot("foot");
      me.x = foot.x;
      me.z = foot.z + 2.2;
    });
    if (state.design.extras.slide) {
      offer(gap(me, homeSpot("slideTop")), 1.5, "Slide down!", function () {
        me.up = false;
        const foot = homeSpot("slideFoot");
        me.x = foot.x;
        me.z = foot.z;
        me.yaw = Math.PI / 2;
        sound(function () { playTone(0, 0.5, 900, 300, 0.15); });
        say("Wheeeee!", 2);
      });
    }
    offer(gap(me, homeSpot("hammock")), 1.6, tod > DUSK ? "Sleep until morning" : "Your hammock (come back when it is getting dark)", function () {
      if (timeOfDay() > DUSK) sleep();
      else say("You are not sleepy yet. Come back when the sun is going down.", 3);
    });
    offer(gap(me, homeSpot("bench")), 1.6, "Use your workbench", openMake);
    if (state.built.fire) offer(gap(me, homeSpot("fire")), 1.9, "Cook your fish and eggs", cook);
    if (state.built.nest && !state.pet) {
      offer(gap(me, homeSpot("nest")), 1.9, state.nestEgg ? "The egg will hatch in the morning" : state.bag.egg ? "Put an egg in the nest box" : "The nest box (it needs a raptor egg)", function () {
        if (state.nestEgg || !state.bag.egg) return;
        state.bag.egg--;
        state.nestEgg = true;
        rebuildHome();
        soundMake();
        say("The egg is snug in its nest. It will hatch in the morning.", 4);
      });
    }
    return best;
  }
  offer(gap(me, homeSpot("foot")), 3.2, "Climb up to your treehouse", function () {
    me.up = true;
    const top = homeSpot("top");
    me.x = top.x;
    me.z = top.z;
    me.yaw = Math.PI / 2;
  });
  if (state.design.extras.swing) {
    offer(gap(me, { x: HOME.x - 3.9, z: HOME.z + 4.3 }), 1.8, "Have a swing", function () {
      swingUntil = wall + 5;
      say("Wheeeee!", 2);
    });
  }
  const pet = dinos.find(function (d) { return d.kind === "pet"; });
  if (pet && petHungry()) offer(gap(me, pet) - 2.6, 1.6, "Feed " + state.pet.name, feedPet);     // (your pet comes first)
  for (const type in finds) {
    for (const find of finds[type]) {
      if (find.back > state.time) continue;
      offer(gap(me, find), type === "fish" ? 4.4 : 2.5, FINDS[type].word, function () { take(type, find); });
    }
  }
  if (state.tools.axe) {
    for (const tree of treesNear(me.x, me.z)) {
      // Only a tree you are facing
      let turn = Math.atan2(-(tree.x - me.x), -(tree.z - me.z)) - me.yaw;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      if (Math.abs(turn) < 0.8) offer(gap(me, tree) - tree.r + 0.6, 2.6, "Chop the tree (" + (3 - (tree.hits || 0)) + " more)", function () { chop(tree); });
    }
  }
  return best;
}

// Space: jab with your spear at the nearest dinosaur in front of you
function jab() {
  if (!state.tools.spear) return say("You have nothing to fight with. Make a spear at your workbench.", 3);
  if (state.time < jabReady) return;
  jabReady = state.time + 0.45;
  jabAt = wall;
  sound(function () { playNoise(0, 0.08, 2000, 800, 0.12); });
  let hit = null;
  let hitFar = 99;
  for (const d of dinos) {
    if (d.kind === "pet") continue;
    const far = gap(d, me) - SPECIES[d.kind].size * 0.22;
    let turn = Math.atan2(-(d.x - me.x), -(d.z - me.z)) - me.yaw;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    if (far < 3.3 && Math.abs(turn) < 0.9 && far < hitFar) {
      hit = d;
      hitFar = far;
    }
  }
  if (!hit || me.up) return;
  const name = SPECIES[hit.kind].name;
  if (hit.kind === "rex") return say("The spear just bounces off the T. rex!", 3);
  if (hit.herd.act === "hunter") {
    hit.hp--;
    hit.stun = 0.9;
    soundGrowl();
    if (hit.hp <= 0) {
      hit.hp = 2;
      scare(hit, me, 40);
      say("The raptor has had enough, and runs!", 3);
    } else {
      say("A hit! One more should see it off.", 2);
    }
  } else if (hit.herd.act === "grumpy") {
    hit.warn = 9;
    say("Now the " + name + " is really cross!", 3);
  } else {
    scare(hit, me, hit.herd.act === "calm" ? 4 : 18);
    say("The " + name + " runs away.", 2);
  }
}

// ===== 7. Making things at your workbench =====
function drawMake() {
  let html = "";
  for (const id in MAKES) {
    const item = MAKES[id];
    const have = item.type === "tool" ? state.tools[id] : state.built[id];
    const needs = Object.keys(item.needs).map(function (type) {
      return '<span class="' + (state.bag[type] >= item.needs[type] ? "got" : "need") + '">' + ITEMS[type].name + " " + item.needs[type] + "</span>";
    }).join(", ");
    html += '<button data-make="' + id + '"' + (have || !canPay(item.needs) ? " disabled" : "") + "><b>" + item.name + "</b>" + (have ? ' <span class="got">(you have it)</span>' : "") + "<br>" + item.what + "." + (have ? "" : "<br>Needs: " + needs) + "</button>";
  }
  el("make-list").innerHTML = html;
}

function openMake() {
  mode = "make";
  drawMake();
  el("make").hidden = false;
  if (document.exitPointerLock) document.exitPointerLock();
}

function closeMake() {
  el("make").hidden = true;
  mode = "play";
}

function make(id) {
  const item = MAKES[id];
  if (!item || !canPay(item.needs) || state.tools[id] || state.built[id]) return soundNo();
  for (const type in item.needs) state.bag[type] -= item.needs[type];
  if (item.type === "tool") state.tools[id] = true;
  else state.built[id] = true;
  rebuildHome();
  soundMake();
  drawMake();
  say("You made the " + item.name + "! " + item.what + ".", 5);
  checkGoals();
  save();
}

// ===== 8. Jobs =====
function goalDone(n) {
  const got = state.got;
  if (n === 0) return got.berry >= 4;
  if (n === 1) return got.stick >= 2 && got.stone >= 2 && got.vine >= 3;
  if (n === 2) return !!state.tools.axe;
  if (n === 3) return got.wood >= 4;
  if (n === 4) return !!state.tools.spear;
  if (n === 5) return state.slept > 0;
  if (n === 6) return !!state.built.fire && state.cooked > 0;
  if (n === 7) return !!state.built.lookout;
  if (n === 8) return got.egg > 0;
  if (n === 9) return !!state.built.nest && (state.nestEgg || !!state.pet);
  if (n === 10) return !!state.pet && state.pet.grow >= 1;
  if (n === 11) return !!state.built.horn;
  return state.nights >= 7;
}

function checkGoals() {
  let done = false;
  while (state.goal < GOALS.length && goalDone(state.goal)) {
    state.goal++;
    done = true;
  }
  if (done && state.goal < GOALS.length) {
    sound(function () { playTone(0, 0.1, 700, 900, 0.15); playTone(0.1, 0.2, 900, 1300, 0.15); });
    say("Job done! Next: " + GOALS[state.goal], 7);
  }
  if (state.goal >= GOALS.length && !state.won) {
    state.won = true;
    sound(playJingle);
    save();
    el("won-text").textContent = "You have lived on Treetop Island for " + state.nights + " nights. " + state.design.name + " has a fire, a lookout, a nest box and a great horn, and " + (state.pet ? state.pet.name : "your raptor") + " is fully grown. The island is your home now, dinosaurs and all!";
    el("won").hidden = false;
    mode = "won";
    if (document.exitPointerLock) document.exitPointerLock();
  }
  el("goal").textContent = state.goal < GOALS.length ? "Job " + (state.goal + 1) + " of " + GOALS.length + ": " + GOALS[state.goal] : "You are the ruler of Treetop Island! Live here as long as you like";
}

// ===== 9. One step of the game =====
// A new morning
function newDay(day) {
  state.day = day;
  state.nights++;
  if (state.nestEgg) {
    // The egg hatches!
    state.nestEgg = false;
    state.pet = { name: "Pip", grow: 0, fedAt: -999 };
    rebuildHome();
    addPet();
    sound(playJingle);
    mode = "name";
    el("name").hidden = false;
    el("pet-name").value = "";
    if (document.exitPointerLock) document.exitPointerLock();
  }
}

// How far you can wade into the lake, in 64 directions. (The fish swim just inside that line.)
const wade = [];
for (let n = 0; n < 64; n++) wade.push(wadeLine(n / 64 * Math.PI * 2));

function tick(dt) {
  const before = timeOfDay();
  state.time += dt;
  const tod = timeOfDay();
  if (before < DUSK && tod >= DUSK) say("The sun is going down. Head home to your treehouse!", 6);
  if (before < DARK && tod >= DARK) say("It is night. Raptors prowl the forest near your tree. You are safe up in the treehouse.", 7);
  const day = Math.floor(state.time / DAY) + 1;
  if (day !== state.day) newDay(day);
  if (mode !== "play") return;

  moveMe(dt);
  me.out = state.time < state.safeUntil;
  updateDinos(dt);

  // Fish swim round the lake
  for (const fish of finds.fish) {
    fish.angle = (fish.angle + fish.speed * dt + Math.PI * 2) % (Math.PI * 2);
    const far = wade[Math.floor(fish.angle / (Math.PI * 2) * 64) % 64] - 1.6 + Math.sin(fish.angle * 5) * 0.8;
    fish.x = LAKE.x + Math.cos(fish.angle) * far;
    fish.z = LAKE.z + Math.sin(fish.angle) * far;
  }

  // Getting hungry. With an empty tummy you slowly get weaker. With a full one you slowly get better.
  state.food = Math.max(0, state.food - dt * 100 / 540);
  if (state.food <= 0) {
    state.health -= dt * 1.4;
    if (state.health <= 0) faint(null);
  } else if (state.food > 40) {
    state.health = Math.min(100, state.health + dt * 0.5);
  }

  // The ground shakes when the T. rex walks near
  const rex = dinos.find(function (d) { return d.kind === "rex"; });
  if (rex && rex.moving && gap(rex, me) < 90 && wall > (tick.thudAt || 0)) {
    tick.thudAt = wall + (rex.mood === "chase" ? 0.45 : 0.9);
    soundThud();
    shake = Math.max(shake, 0.5 * (1 - gap(rex, me) / 90));
  }

  near = findNear();
  if (state.time - lastCheck > 0.5) {
    lastCheck = state.time;
    checkGoals();
  }
  if (state.time - lastSave > 30) save();
}

// ===== 10. Drawing =====
// What you hold in your hand: a spear, or a burning torch
const hand = new THREE.Group();
const spearModel = new THREE.Group();
piece(spearModel, new THREE.CylinderGeometry(0.02, 0.025, 1.7, 6), paint(0x8a6238), 0, 0, 0).rotation.x = Math.PI / 2;
piece(spearModel, new THREE.ConeGeometry(0.05, 0.22, 5), paint(0x9a9a9e), 0, 0, -0.95).rotation.x = -Math.PI / 2;
const torchModel = new THREE.Group();
piece(torchModel, new THREE.CylinderGeometry(0.025, 0.03, 0.6, 6), paint(0x8a6238), 0, 0, 0);
const flame = piece(torchModel, new THREE.ConeGeometry(0.07, 0.22, 6), bright(0xffb02a), 0, 0.4, 0);
torchModel.scale.setScalar(0.5);
torchModel.position.set(0, -0.02, -0.25);
const torchLight = new THREE.PointLight(0xffb060, 0, 26);
hand.add(spearModel, torchModel, torchLight);
camera.add(hand);
scene.add(camera);

const strings = {};
function setText(id, text) {
  if (strings[id] === text) return;
  strings[id] = text;
  el(id).innerHTML = text;
}

// The map never changes, so the land is painted once, on a hidden canvas
const mapBase = document.createElement("canvas");
mapBase.width = mapBase.height = 150;
(function () {
  const pen = mapBase.getContext("2d");
  for (let i = 0; i < 150; i++) {
    for (let k = 0; k < 150; k++) {
      const x = (i - 75) * 4;
      const z = (k - 75) * 4;
      const y = groundAt(x, z);
      pen.fillStyle = y < 0 ? "#2f8ab8" : y < 1.2 ? "#e8d8a0" : bump(x, z, RIDGE, RIDGE.r) > 0.5 ? "#8a8478" : forestAt(x, z) > 0.2 ? "#2f7a38" : "#6ab84a";
      pen.fillRect(i, k, 1, 1);
    }
  }
  pen.font = "8px sans-serif";
  pen.textAlign = "center";
  for (const place of [LAKE, MARSH, MEADOW, WOODS, RIDGE]) {
    pen.fillStyle = "#000";
    pen.fillText(place.name.split(" ")[1], place.x / 4 + 76, place.z / 4 + 79);
    pen.fillStyle = "#fff";
    pen.fillText(place.name.split(" ")[1], place.x / 4 + 75, place.z / 4 + 78);
  }
})();

function drawMap() {
  const pen = el("map").getContext("2d");
  pen.drawImage(mapBase, 0, 0);
  const dot = function (thing, colour, size) {
    pen.fillStyle = colour;
    pen.fillRect(thing.x / 4 + 75 - size / 2, thing.z / 4 + 75 - size / 2, size, size);
  };
  dot(HOME, "#000", 7);
  dot(HOME, "#ffd23a", 5);
  // The lookout lets you see every dinosaur: red for hunters, orange for spitters, pale for the rest
  if (state.built.lookout) {
    for (const d of dinos) {
      if (d.kind === "pet") dot(d, "#4ac8ff", 3);
      else dot(d, d.herd.act === "hunter" ? "#ff2a1a" : d.herd.act === "spitter" ? "#ff9a2a" : "#d8f0c0", d.kind === "rex" ? 5 : d.herd.act === "hunter" ? 3 : 2);
    }
  }
  // You: a white dot, with a line showing which way you are facing
  dot(me, "#000", 5);
  dot(me, "#fff", 3);
  pen.strokeStyle = "#fff";
  pen.beginPath();
  pen.moveTo(me.x / 4 + 75, me.z / 4 + 75);
  pen.lineTo(me.x / 4 + 75 - Math.sin(me.yaw) * 7, me.z / 4 + 75 - Math.cos(me.yaw) * 7);
  pen.stroke();
}

function drawHud() {
  const tod = timeOfDay();
  el("health-fill").style.width = Math.max(0, state.health) + "%";
  el("food-fill").style.width = state.food + "%";
  el("run-fill").style.width = me.stamina * 100 + "%";
  const part = tod < 0.2 ? "morning" : tod < 0.45 ? "midday" : tod < DUSK ? "afternoon" : tod < DARK ? "sunset" : "night";
  setText("clock", "Day " + state.day + " · " + part + " · " + (me.up ? state.design.name : placeAt(me.x, me.z)));
  let bag = "";
  for (const type in ITEMS) {
    if (state.bag[type]) bag += "<span>" + ITEMS[type].name + " " + state.bag[type] + "</span>";
  }
  setText("bag", bag || "<span>Your bag is empty</span>");
  const tools = [];
  if (foodCount()) tools.push("Q: eat");
  if (state.tools.spear) tools.push("Space: spear");
  if (state.tools.torch) tools.push("T: torch" + (state.lit ? " (lit)" : ""));
  if (state.built.horn) tools.push("H: horn" + (state.time < state.hornAt ? " (wait)" : ""));
  setText("keys-line", tools.join(" &nbsp; "));
  let hint = "";
  if (mode === "play") {
    if (near) hint = "E: " + near.text;
    else if (state.food < 25) hint = "You are hungry! Press Q to eat";
    else if (!locked) hint = "Click the game to look around with the mouse (or use the arrow keys)";
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

const SKIES = { day: new THREE.Color(0x9fd8f4), dusk: new THREE.Color(0xf0a868), night: new THREE.Color(0x0c1830) };
const nowSky = new THREE.Color();

function draw(dt) {
  wall += dt;
  shake = Math.max(0, shake - dt);
  const tod = timeOfDay();

  // ----- The camera -----
  if (mode === "intro" || mode === "design") {
    // Circle slowly round the treehouse. (In the designer, the left and right arrow keys turn it.)
    spin += dt * (mode === "design" ? ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 1.5 + 0.06 : 0.1);
    const far = mode === "design" ? 21 : 30;
    camera.position.set(HOME.x + Math.sin(spin) * far, homeY + DECK + (mode === "design" ? 6 : 9), HOME.z + Math.cos(spin) * far);
    // Look a little to one side, so the treehouse is not hidden behind the designer's buttons
    const aside = mode === "design" ? -5.5 : 0;
    camera.lookAt(HOME.x + Math.cos(spin) * aside, homeY + DECK + 2.6, HOME.z - Math.sin(spin) * aside);
  } else {
    const sway = wall < swingUntil ? Math.sin(wall * 2.6) * 0.5 : 0;
    camera.position.set(me.x + (Math.random() - 0.5) * shake * 0.3, me.y + (Math.random() - 0.5) * shake * 0.3 + (me.moving && !me.up ? Math.abs(Math.sin(wall * (me.running ? 12 : 8))) * 0.05 : 0), me.z + sway * 2);
    camera.rotation.set(me.pitch + sway * 0.2, me.yaw, 0);
  }

  // ----- The sky: the sun goes over by day, and the moon by night -----
  const sunTurn = tod / DARK * Math.PI;                   // 0 at sunrise, half a turn at nightfall
  const dark = tod < 0.04 ? 1 - tod / 0.04 : smooth((tod - DUSK - 0.03) / (DARK - DUSK));   // 0 = day, 1 = night
  const glow = Math.max(0, 1 - Math.abs(tod - DUSK - 0.03) / 0.08, 1 - tod / 0.06);          // 1 at sunset and sunrise
  nowSky.copy(SKIES.day).lerp(SKIES.dusk, glow * 0.8).lerp(SKIES.night, dark);
  scene.fog.color.copy(nowSky);
  renderer.setClearColor(nowSky);
  scene.fog.far = 420 - dark * 250;
  skyLight.intensity = 0.62 - dark * 0.42;
  sunLight.intensity = 0.75 * (1 - dark) * (0.4 + 0.6 * Math.sin(Math.min(Math.PI, sunTurn)));
  const focus = camera.position;
  sunLight.target.position.set(focus.x, 0, focus.z);
  sunLight.position.set(focus.x + Math.cos(sunTurn) * 110, 40 + Math.sin(Math.min(Math.PI, sunTurn)) * 110, focus.z + 50);
  sunBall.position.set(focus.x + Math.cos(sunTurn) * 900, Math.sin(sunTurn) * 700, focus.z + 300);
  sunBall.visible = tod < DARK + 0.02;
  const moonTurn = (tod - DARK) / (1 - DARK) * Math.PI;
  moonBall.position.set(focus.x + Math.cos(moonTurn) * 900, Math.sin(moonTurn) * 600, focus.z - 300);
  moonBall.visible = tod > DARK;
  stars.material.opacity = dark;
  stars.position.copy(focus);
  sea.position.set(focus.x, 0, focus.z);

  // ----- Your treehouse: the flag flaps, the fire flickers, the lanterns glow at night -----
  const parts = homeModel.userData;
  if (parts.flag) parts.flag.rotation.y = Math.sin(wall * 3) * 0.25;
  if (parts.swing) parts.swing.rotation.x = Math.sin(wall * 1.3) * (wall < swingUntil ? 0.5 : 0.06);
  parts.flames.forEach(function (one, n) {
    one.scale.y = 1 + Math.sin(wall * (9 + n * 3)) * 0.25;
  });
  if (parts.lamp) parts.lamp.intensity = 0.2 + dark * 1.1;
  if (parts.fireLight) parts.fireLight.intensity = 0.4 + dark * 0.8 + Math.sin(wall * 11) * 0.1;

  // ----- What is in your hand -----
  const playing = mode === "play" || mode === "card";
  torchModel.visible = playing && state.lit;
  spearModel.visible = playing && !state.lit && !!state.tools.spear;
  torchLight.intensity = state.lit && playing ? 1.1 + Math.sin(wall * 13) * 0.12 : 0;
  flame.scale.y = 1 + Math.sin(wall * 15) * 0.3;
  const thrust = Math.max(0, 1 - (wall - jabAt) / 0.25);
  hand.position.set(0.34, -0.3 - (me.moving ? Math.sin(wall * 8) * 0.012 : 0), -0.6 - thrust * 0.45);
  spearModel.rotation.set(0.12, 0.1, 0);

  if (wall - (draw.findsAt || 0) > 0.25) {
    // Things that have grown back appear again
    draw.findsAt = wall;
    for (const type in finds) {
      if (type !== "fish") drawFinds(type, state.time);
    }
  }
  drawFinds("fish", state.time);
  poseDinos(wall);
  drawHud();
}

// ===== 11. Saving =====
function save() {
  lastSave = state.time;
  state.at = { x: me.x, z: me.z, yaw: me.yaw, up: me.up };
  for (const type in finds) state.back[type] = finds[type].map(function (find) { return Math.round(find.back); });
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
  // Put the island back the way the save says: trees that were cut down, and things that were picked
  for (const tree of trees) {
    const gone = state.chopped.includes(tree.slot);
    if (tree.gone !== gone) {
      tree.gone = gone;
      drawTree(tree);
    }
    tree.hits = 0;
  }
  for (const type in finds) {
    finds[type].forEach(function (find, n) {
      find.back = state.back[type] ? state.back[type][n] || 0 : 0;
    });
    drawFinds(type, state.time);
  }
  for (const d of dinos) {
    if (d.model) scene.remove(d.model.group, d.sign);
  }
  dinos.length = 0;
  spits.length = 0;
  makeDinos();
  if (state.pet) addPet();
  rebuildHome();
  goHome();
  if (state.at) {
    me.x = state.at.x;
    me.z = state.at.z;
    me.yaw = state.at.yaw;
    me.up = state.at.up;
  }
  me.stamina = 1;
  lastSave = lastCheck = state.time;
  lastHurt = -9;
  jabReady = 0;
  for (const id of ["intro", "won", "card", "make", "name"]) el(id).hidden = true;
  checkGoals();
  if (saved) {
    el("designer").hidden = true;
    el("hud").hidden = false;
    mode = "play";
  } else {
    openDesigner(false);       // a new game starts with designing your treehouse
  }
}

// ===== 12. Keys, mouse and buttons =====
window.addEventListener("keydown", function (e) {
  if (e.target.tagName === "INPUT") {
    // Typing a name: Enter is the same as pressing the button
    if (e.code === "Enter") (mode === "name" ? el("name-done") : el("design-done")).click();
    return;
  }
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (mode === "card") {
    if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") closeCard();
    return;
  }
  if (mode === "make") {
    if (e.code === "KeyE" || e.code === "Escape") closeMake();
    return;
  }
  if (mode !== "play") return;
  if (e.code === "KeyE" && near) near.act();
  else if (e.code === "Space") jab();
  else if (e.code === "KeyQ") eat();
  else if (e.code === "KeyH") blowHorn();
  else if (e.code === "KeyT") {
    if (!state.tools.torch) return say("You have no torch. Make one at your workbench.", 3);
    state.lit = !state.lit;
    soundPick();
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
  else jab();
});

document.addEventListener("pointerlockchange", function () {
  locked = document.pointerLockElement === canvas;
});

document.addEventListener("mousemove", function (e) {
  if (!locked || mode !== "play") return;
  me.yaw -= e.movementX * 0.0025;
  me.pitch = clamp(me.pitch - e.movementY * 0.0025, -1.3, 1.3);
});

el("design-choices").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (!button) return;
  const design = state.design;
  if (button.dataset.extra) design.extras[button.dataset.extra] = !design.extras[button.dataset.extra];
  else if (button.dataset.set === "walls" || button.dataset.set === "top") design[button.dataset.set] = Number(button.dataset.to);
  else design[button.dataset.set] = button.dataset.to;
  soundPick();
  drawDesigner();
  rebuildHome();
});
el("design-name").addEventListener("input", function () {
  state.design.name = el("design-name").value.slice(0, 18);
  rebuildHome();
});
el("design-done").addEventListener("click", closeDesigner);
el("design-left").addEventListener("click", function () { spin -= 0.8; });
el("design-right").addEventListener("click", function () { spin += 0.8; });
el("make-list").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (button && !button.disabled) make(button.dataset.make);
});
el("make-close").addEventListener("click", closeMake);
el("make-design").addEventListener("click", function () {
  closeMake();
  openDesigner(true);
});
el("card").addEventListener("click", function () {
  if (mode === "card") closeCard();
});
el("name-done").addEventListener("click", function () {
  if (!state.pet) return;
  state.pet.name = el("pet-name").value.trim().slice(0, 14) || "Pip";
  el("name").hidden = true;
  mode = "play";
  say(state.pet.name + " has hatched! Climb down and feed it (press E beside it). It will follow you everywhere.", 8);
  save();
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
rebuildHome();
for (const type in finds) drawFinds(type, 0);
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
  closeDesigner();
  window.TT = {
    me: me, keys: keys, dinos: dinos, finds: finds, trees: trees, spits: spits,
    state: function () { return state; },
    mode: function () { return mode; },
    near: function () { return near; },
    frames: function () { return frameCount; },
    begin: begin, save: save, load: load, give: give, make: make, jab: jab, eat: eat, sleep: sleep, cook: cook, hurt: hurt,
    openDesigner: openDesigner, closeDesigner: closeDesigner, openMake: openMake, closeMake: closeMake, closeCard: closeCard,
    findNear: findNear, blowHorn: blowHorn, feedPet: feedPet, checkGoals: checkGoals, homeSpot: homeSpot, deckFree: deckFree, rebuildHome: rebuildHome,
    step: function (n) { for (let i = 0; i < n; i++) { if (mode === "play") tick(0.05); } },
  };
}

requestAnimationFrame(frame);
