// Clover Cove: the game.
// Your character, the clock and seasons, tools, fishing, talking, the shop, the museum,
// your loan, decorating your house, your bag and journal, and saving.

// ===== 1. What the game remembers =====
const SAVE = "clovercove-save";
const HAIRS = [0x5a3a1a, 0x2a2228, 0xe8c04a, 0xd8662a, 0xf4f4f4, 0x4a9ad8];
const SHIRTS = [0xd8442e, 0x4a9ad8, 0x4aa84a, 0xffd23a, 0xff8ab8, 0x8a5ac8, 0xf4f4f4, 0x3a3a48];
const POCKETS = 30;          // how many things you can carry

function freshState() {
  const friends = {};
  for (const one of NEIGHBOURS) friends[one.id] = { met: false, points: 0, talked: false };
  for (const id in KEEPERS) friends[KEEPERS[id].id] = { met: false, points: 0, talked: false };
  return {
    name: "Clover", hair: 0, shirt: 1,
    time: 50,                // seconds since six o'clock on the first morning (so you start at eight)
    day: 1,
    coins: 300,
    bag: {},                 // what is in your pockets: { apple: 3, "bug:white": 1 ... }
    tools: { net: true, rod: true, shovel: false },
    tool: "hand",
    bugs: {}, fish: {}, fossils: {},      // every kind you have ever caught or found
    museum: {},              // every kind you have given to the museum
    friends: friends,
    wants: {}, stock: [], items: [], spots: [],
    home: { stage: 0, paid: 0, wall: 0, floor: 0, items: [{ id: "bed", i: 0, k: 0, turn: 0 }] },
    goal: 0,
    sold: 0, favours: 0, dug: 0, placed: false,
    at: null,
  };
}

let state = freshState();
const me = { x: mid(11), z: mid(15) + 0.4, yaw: 0, moving: false, running: false, swing: 0 };
let mode = "intro";          // intro, play, talk, panel or card
let inside = false;          // are you in your house?
let talking = null;          // the neighbour you are talking to
let near = null;             // what E would do right now: { text, act }
let fishing = null;          // your line, when it is in the water: { x, z, phase, fish, timer, nibbles }
let placing = null;          // the furniture you are about to put down: { id, turn }
let bees = null;             // angry bees: { x, z, t }
let panel = "";              // which panel is open: "bag", "journal" or "shop"
let wall = 0;                // a clock that never stops (for animations)
let lastSave = 0;
let lastCheck = 0;
let stepAt = 0;
const keys = {};

function clockHour() {
  return (6 + (state.time % DAY_SECONDS) / DAY_SECONDS * 24) % 24;
}

function season() {
  return Math.floor((state.day - 1) / SEASON_DAYS) % 4;
}

// Everything worth knowing about a thing you can carry, from its id
function info(id) {
  if (id.indexOf("bug:") === 0) {
    const bug = BUGS.find(function (one) { return one.id === id.slice(4); });
    return { name: bug.name, price: bug.price, colour: bug.colour, type: "bug" };
  }
  if (id.indexOf("fish:") === 0) {
    const fish = FISH.find(function (one) { return one.id === id.slice(5); });
    return { name: fish.name, price: fish.price, colour: 0x4a8ac8, type: "fish" };
  }
  if (id.indexOf("furn:") === 0) {
    const item = FURNITURE.find(function (one) { return one.id === id.slice(5); });
    return { name: item.name, price: Math.floor(item.price / 4), colour: item.colour, type: "furniture" };
  }
  return { name: GOODS[id].name, price: GOODS[id].price, colour: GOODS[id].colour, type: id === "fossil" ? "fossil" : "good" };
}

function bagCount() {
  let total = 0;
  for (const id in state.bag) total += state.bag[id];
  return total;
}

// Put something in your pockets. Gives back false if they are full.
function give(id, count) {
  if (bagCount() + (count || 1) > POCKETS) return false;
  state.bag[id] = (state.bag[id] || 0) + (count || 1);
  return true;
}

function take(id, count) {
  state.bag[id] -= count || 1;
  if (state.bag[id] <= 0) delete state.bag[id];
}

// ===== 2. Sounds and messages =====
function sound(make) {
  try { make(); } catch (problem) { /* no sound is fine */ }
}
function soundPick() { sound(function () { playTone(0, 0.08, 600, 900, 0.12); }); }
function soundNo() { sound(function () { playTone(0, 0.15, 220, 160, 0.12); }); }
function soundCoins() { sound(function () { playTone(0, 0.07, 1200, 1500, 0.1); playTone(0.08, 0.1, 1500, 1900, 0.1); }); }
function soundGot() { sound(function () { playTone(0, 0.1, 520, 660, 0.14); playTone(0.11, 0.1, 660, 780, 0.14); playTone(0.22, 0.22, 780, 1040, 0.14); }); }
function soundTalk() { sound(function () { playTone(0, 0.05, 500 + Math.random() * 300, 600 + Math.random() * 300, 0.06); }); }
function soundSplash() { sound(function () { playNoise(0, 0.25, 1800, 500, 0.2); }); }
function soundSwish() { sound(function () { playNoise(0, 0.12, 2500, 900, 0.1); }); }

const el = function (id) { return document.getElementById(id); };
let toastUntil = 0;
function say(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastUntil = wall + (seconds || 3);
}

// ----- Talking -----
// A conversation is a list of pages. The last page can have choices: [{ text, act }].
let talk = null;
function openTalk(who, pages, choices) {
  talk = { who: who, pages: pages, n: 0, choices: choices || null };
  mode = "talk";
  drawTalk();
  soundTalk();
}

function drawTalk() {
  el("talk").hidden = false;
  el("talk-who").textContent = talk.who;
  el("talk-who").hidden = !talk.who;
  el("talk-text").textContent = talk.pages[talk.n].replace(/\{name\}/g, state.name);
  const last = talk.n === talk.pages.length - 1;
  let html = "";
  if (last && talk.choices) {
    talk.choices.forEach(function (choice, n) { html += '<button data-choice="' + n + '">' + (n + 1) + ". " + choice.text + "</button>"; });
  } else {
    html = '<span class="next">E</span>';
  }
  el("talk-choices").innerHTML = html;
}

function nextTalk(choice) {
  if (!talk) return;
  const last = talk.n === talk.pages.length - 1;
  if (!last) {
    talk.n++;
    soundTalk();
    return drawTalk();
  }
  if (talk.choices) {
    if (choice === undefined || !talk.choices[choice]) return;
    const act = talk.choices[choice].act;
    closeTalk();
    if (act) act();
    return;
  }
  closeTalk();
}

function closeTalk() {
  talk = null;
  talking = null;
  el("talk").hidden = true;
  if (mode === "talk") mode = "play";
}

// ===== 3. Your character =====
let playerModel = null;
function drawPlayer() {
  if (playerModel) scene.remove(playerModel.group);
  playerModel = makePerson({ animal: "human", fur: 0xf4c8a0, face: 0xf4c8a0, shirt: SHIRTS[state.shirt], hair: HAIRS[state.hair] });
  for (const id in toolModels) {
    toolModels[id].position.set(0, -0.4, 0.05);
    toolModels[id].rotation.set(0.5, 0, 0);
    playerModel.hand.add(toolModels[id]);
  }
  scene.add(playerModel.group);
}

// Is this spot of your room free to walk on (or to put furniture on)?
function roomFree(x, z, margin) {
  const size = HOMES[state.home.stage].room;
  if (x < margin || z < margin || x > size - margin || z > size - margin) return false;
  for (const item of state.home.items) {
    if (item.id === "rug") continue;
    if (Math.abs(x - (item.i + 0.5)) < 0.5 + margin * 0.6 && Math.abs(z - (item.k + 0.5)) < 0.5 + margin * 0.6) return false;
  }
  return true;
}

function moveMe(dt) {
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  me.moving = !!(ahead || side) && me.swing <= 0;
  me.running = me.moving && !!(keys.ShiftLeft || keys.ShiftRight);
  if (!me.moving) return;
  if (fishing) reelIn("You pull your line in.");
  const speed = me.running ? 7 : 3.4;
  const long = Math.hypot(ahead, side);
  const dx = side / long * speed * dt;
  const dz = -ahead / long * speed * dt;
  me.yaw = Math.atan2(dx, dz);
  if (inside) {
    if (roomFree(me.x + dx - ROOM.x, me.z - ROOM.z, 0.3)) me.x += dx;
    if (roomFree(me.x - ROOM.x, me.z + dz - ROOM.z, 0.3)) me.z += dz;
  } else {
    // A little room round you, so you don't walk with your nose in a tree
    const pad = 0.3;
    if (canStand(me.x + dx + Math.sign(dx) * pad, me.z)) me.x += dx;
    if (canStand(me.x, me.z + dz + Math.sign(dz) * pad)) me.z += dz;
  }
  if (wall > stepAt) {
    stepAt = wall + (me.running ? 0.24 : 0.4);
    sound(function () { playNoise(0, 0.04, 500, 250, 0.03); });
  }
}

// ===== 4. Tools =====
function setTool(tool) {
  if (tool !== "hand" && !state.tools[tool]) return say(tool === "shovel" ? "You don't have a shovel yet. Thistle sells them." : "You don't have that.", 3);
  if (fishing) reelIn("");
  state.tool = tool;
  soundPick();
}

// ----- The net -----
function swingNet() {
  if (me.swing > 0) return;
  me.swing = 0.4;
  soundSwish();
  // Angry bees can be caught too, if you are quick!
  if (bees && Math.hypot(bees.x - me.x, bees.z - me.z) < 2.4) {
    bees = null;
    return caught("bug:bee", "You caught the bees before they caught you!");
  }
  let best = null;
  let bestFar = 2;
  for (const bug of bugs) {
    if (bug.fleeing) continue;
    const far = Math.hypot(bug.x - me.x, bug.z - me.z);
    let turn = Math.atan2(bug.x - me.x, bug.z - me.z) - me.yaw;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    if (far < bestFar && (Math.abs(turn) < 1.1 || far < 0.8)) {
      best = bug;
      bestFar = far;
    }
  }
  if (!best) return;
  bugs.splice(bugs.indexOf(best), 1);
  caught("bug:" + best.kind.id, "");
}

// You caught something! Show it off, and put it in your pockets.
function caught(id, extra) {
  const thing = info(id);
  const first = thing.type === "bug" ? !state.bugs[id.slice(4)] : !state.fish[id.slice(5)];
  if (thing.type === "bug") state.bugs[id.slice(4)] = true;
  else state.fish[id.slice(5)] = true;
  soundGot();
  const full = !give(id);
  openTalk("", [(extra ? extra + " " : "") + "You caught a " + thing.name + "! " + (first ? "That's a new one for your journal. " : "") + "It is worth " + thing.price + " coins." + (full ? " But your pockets are full, so you let it go." : "")]);
  checkGoals();
}

// ----- The fishing rod -----
function castLine() {
  const x = me.x + Math.sin(me.yaw) * 3.2;
  const z = me.z + Math.cos(me.yaw) * 3.2;
  if (groundAt(x, z) !== "water") return say("Face the water, and stand a step back from the edge.", 3);
  fishing = { x: x, z: z, phase: "wait", fish: null, timer: 0, nibbles: 0 };
  soundSplash();
}

function reelIn(text) {
  if (fishing && fishing.fish) {
    // A fish that was nosing at your float swims off
    fishes.splice(fishes.indexOf(fishing.fish), 1);
  }
  fishing = null;
  if (text) say(text, 2);
}

function useRod() {
  if (!fishing) return castLine();
  if (fishing.phase === "bite") {
    const fish = fishing.fish;
    fishes.splice(fishes.indexOf(fish), 1);
    fishing = null;
    soundSplash();
    return caught("fish:" + fish.kind.id, "");
  }
  reelIn(fishing.fish ? "Too soon! You scared it away. Wait until the float goes right under." : "You pull your line in.");
}

function updateFishing(dt) {
  if (!fishing) return;
  const line = fishing;
  line.timer -= dt;
  if (line.phase === "wait") {
    // Any fish close enough comes to look
    if (!line.fish) {
      for (const fish of fishes) {
        if (!fish.lured && Math.hypot(fish.x - line.x, fish.z - line.z) < 4.5) {
          line.fish = fish;
          fish.lured = true;
          break;
        }
      }
      return;
    }
    const fish = line.fish;
    const dx = line.x - fish.x;
    const dz = line.z - fish.z;
    const far = Math.hypot(dx, dz);
    if (far > 0.35) {
      fish.x += dx / far * dt * 1.6;
      fish.z += dz / far * dt * 1.6;
      fish.turn = Math.atan2(dx, dz);
    } else {
      line.phase = "nibble";
      line.nibbles = 1 + Math.floor(Math.random() * 3);
      line.timer = 0.9;
    }
  } else if (line.phase === "nibble" && line.timer <= 0) {
    line.nibbles--;
    if (line.nibbles > 0) {
      line.timer = 0.7 + Math.random() * 0.8;
      line.dip = wall;
      sound(function () { playTone(0, 0.05, 700, 500, 0.08); });
    } else {
      // The real bite! Rare fish give you less time.
      line.phase = "bite";
      line.timer = 1.05 - line.fish.kind.rare * 0.12;
      soundSplash();
    }
  } else if (line.phase === "bite" && line.timer <= 0) {
    reelIn("It got away...");
  }
}

// ----- The shovel -----
function dig() {
  const spot = state.spots.find(function (one) { return Math.hypot(one.x - me.x, one.z - me.z) < 1.8; });
  if (!spot) return say("Nothing to dig here. Look for a dark star crack in the grass.", 3);
  state.spots.splice(state.spots.indexOf(spot), 1);
  state.dug++;
  me.swing = 0.4;
  sound(function () { playNoise(0, 0.2, 400, 150, 0.2); });
  if (Math.random() < 0.75) {
    const full = !give("fossil");
    openTalk("", ["You dug up a mystery fossil!" + (full ? " But your pockets are full, so you bury it again." : " Professor Trunkle at the museum can tell you what it is.")]);
    if (full) state.spots.push(spot);
  } else {
    const coins = 300 + Math.floor(Math.random() * 8) * 100;
    state.coins += coins;
    soundCoins();
    openTalk("", ["You dug up a bag of " + coins + " coins! Somebody must have buried it long ago."]);
  }
  checkGoals();
}

// ----- Trees -----
function shake(tree) {
  tree.shake = 0.6;
  sound(function () { playNoise(0, 0.3, 900, 400, 0.12); });
  if (tree.has) {
    tree.has = false;
    for (let n = 0; n < 3; n++) dropNear(tree.fruit, tree.x, tree.z);
    return;
  }
  if (tree.type !== "tree" || tree.shaken === state.day) return;
  tree.shaken = state.day;
  const roll = Math.random();
  if (roll < 0.1) {
    state.coins += 100;
    soundCoins();
    say("100 coins fell out of the tree!", 3);
  } else if (roll < 0.18 && !isNight()) {
    bees = { x: tree.x, z: tree.z, t: 0 };
    say("BEES! Run... or get your net out and swing (press 2, then Space)!", 4);
  }
}

function updateBees(dt) {
  if (!bees) return;
  bees.t += dt;
  const dx = me.x - bees.x;
  const dz = me.z - bees.z;
  const far = Math.hypot(dx, dz);
  if (bees.t > 1) {
    bees.x += dx / Math.max(0.1, far) * dt * 6;
    bees.z += dz / Math.max(0.1, far) * dt * 6;
  }
  if (bees.t > 1.5 && far < 0.6) {
    bees = null;
    sound(function () { playTone(0, 0.3, 300, 150, 0.2); });
    openTalk("", ["OUCH! The bees stung you on the nose. It will be better by tomorrow. (Next time, catch them with your net!)"]);
  } else if (bees.t > 9 || inside) {
    bees = null;
  }
}

// ===== 5. Your neighbours =====
function hearts(friend) {
  return Math.min(5, Math.floor(friend.points / 5));
}

function talkTo(one) {
  talking = one;
  one.yaw = Math.atan2(me.x - one.x, me.z - one.z);
  const def = one.def;
  const friend = state.friends[def.id];
  if (one.keeper === "shop") return talkShop(friend);
  if (one.keeper === "cabin") return talkLoan(friend);
  if (one.keeper === "museum") return talkMuseum(friend);
  const fill = function (text) { return text.replace(/\{says\}/g, def.says); };
  if (!friend.met) {
    friend.met = true;
    friend.points += 2;
    checkGoals();
    return openTalk(def.name, ["Oh! You must be {name}, the one who moved into the little house!", fill("I'm " + def.name + ". I live in the house with the " + ["red", "green", "blue", "purple", "pink", "orange"][NEIGHBOURS.indexOf(def)] + " roof. Come and say hello any time, {says}!")]);
  }
  const want = state.wants[def.id];
  if (want) {
    const thing = info(want);
    if (state.bag[want]) {
      return openTalk(def.name, [fill("Is that... a " + thing.name + "? For me? I've wanted one all day, {says}!")], [
        { text: "Here you are!", act: function () { favour(one, want); } },
        { text: "Not just now", act: null },
      ]);
    }
    return openTalk(def.name, [fill("You know what I can't stop thinking about, {name}? A " + thing.name + ". If you ever find one, would you bring it to me, {says}?")]);
  }
  if (!friend.talked) {
    friend.talked = true;
    friend.points += 1;
  }
  const lines = isNight() ? NIGHT_CHATS : CHATS[def.mood];
  openTalk(def.name + "  " + "♥".repeat(hearts(friend)), [fill(lines[Math.floor(Math.random() * lines.length)])]);
}

function favour(one, want) {
  const def = one.def;
  const friend = state.friends[def.id];
  const before = hearts(friend);
  take(want);
  delete state.wants[def.id];
  friend.points += 5;
  state.favours++;
  const coins = Math.max(400, info(want).price * 3);
  state.coins += coins;
  soundGot();
  const pages = ["Thank you, thank you, THANK YOU! Here, take " + coins + " coins. You're the best neighbour ever, " + def.says + "!"];
  if (hearts(friend) > before && hearts(friend) >= 2) {
    // A present, when you become better friends
    const gift = FURNITURE[Math.floor(Math.random() * FURNITURE.length)];
    if (give("furn:" + gift.id)) pages.push("And... I want you to have this " + gift.name + ". It's for your house. Because we're real friends now.");
  }
  talking = one;
  openTalk(def.name, pages);
  checkGoals();
}

// ----- Thistle's stall -----
function talkShop(friend) {
  const first = !friend.met;
  friend.met = true;
  openTalk("Thistle", [first ? "Welcome to Thistle's Stall, {name}! If it grows, swims or crawls, I'll buy it. And I've furniture for your house, fresh every morning." : "Hello again, {name}! What can I do for you?"], [
    { text: "I'd like to buy", act: function () { openPanel("shop"); shopTab = "buy"; drawPanel(); } },
    { text: "I'd like to sell", act: function () { openPanel("shop"); shopTab = "sell"; drawPanel(); } },
    { text: "Just looking", act: null },
  ]);
}

let shopTab = "buy";
function buy(what) {
  if (what === "shovel") {
    if (state.coins < TOOLS.shovel.price) return soundNo();
    state.coins -= TOOLS.shovel.price;
    state.tools.shovel = true;
    say("You bought a shovel! Press 4 to hold it.", 4);
  } else if (what === "wall" || what === "floor") {
    if (state.coins < 800) return soundNo();
    state.coins -= 800;
    state.home[what] = (state.home[what] + 1) % 4;
    drawRoom(HOMES[state.home.stage].room, state.home.wall, state.home.floor);
    say(what === "wall" ? "New wallpaper! Go home and have a look." : "A new floor! Go home and have a look.", 4);
  } else {
    const item = FURNITURE.find(function (one) { return one.id === what; });
    if (state.coins < item.price || !give("furn:" + item.id)) return soundNo();
    state.coins -= item.price;
    say("You bought a " + item.name + ". Go into your house and press B to put it down.", 5);
  }
  soundCoins();
  drawPanel();
  checkGoals();
}

function sell(id, all) {
  const count = all ? state.bag[id] : 1;
  state.coins += info(id).price * count;
  state.sold += count;
  take(id, count);
  soundCoins();
  drawPanel();
  checkGoals();
}

// ----- Chip, and your loan -----
function talkLoan(friend) {
  const first = !friend.met;
  friend.met = true;
  checkGoals();
  const home = HOMES[state.home.stage];
  const left = home.loan - state.home.paid;
  if (!home.loan) return openTalk("Chip", ["Your house is the finest in all Clover Cove, {name}. A golden roof! I've never built better. Nothing left to pay, not ever."]);
  const pages = first ? ["Ah, {name}! I'm Chip, of Beaver Builders. I built your house. Do you like it? It's... cosy.", "You owe me " + home.loan + " coins for it. No hurry! Pay a bit at a time. When it's all paid, I'll build you a bigger one."] : ["Hello, {name}! You still owe " + left + " coins on your " + home.name.toLowerCase() + ". Want to pay some now?"];
  openTalk("Chip", pages, [
    { text: "Pay 1,000 coins", act: function () { payLoan(1000); } },
    { text: "Pay as much as I can", act: function () { payLoan(state.coins); } },
    { text: "Not just now", act: null },
  ]);
}

function payLoan(amount) {
  const home = HOMES[state.home.stage];
  const pay = Math.min(amount, state.coins, home.loan - state.home.paid);
  if (pay <= 0) return openTalk("Chip", ["Hmm, your pockets sound a bit empty, {name}. Come back when they jingle!"]);
  state.coins -= pay;
  state.home.paid += pay;
  soundCoins();
  if (state.home.paid < home.loan) return openTalk("Chip", ["Lovely! That's " + pay + " coins paid. Only " + (home.loan - state.home.paid) + " to go."]);
  // All paid: a bigger house!
  state.home.stage++;
  state.home.paid = 0;
  const next = HOMES[state.home.stage];
  drawHome(state.home.stage);
  drawRoom(next.room, state.home.wall, state.home.floor);
  soundGot();
  openTalk("Chip", ["That's the last of it. All paid! I'm proud of you, {name}.", "So my team and I got busy while you weren't looking... Ta-da! You now live in a " + next.name.toLowerCase() + "!" + (next.loan ? " That will be " + next.loan + " coins. No hurry." : " And it's yours for ever. No more loans!")]);
  checkGoals();
}

// ----- Professor Trunkle, and the museum -----
function museumCount() {
  return Object.keys(state.museum).length;
}

function talkMuseum(friend) {
  const first = !friend.met;
  friend.met = true;
  openTalk("Professor Trunkle", [first ? "Ah, a visitor! I am Professor Trunkle, and this is my museum. It is, I'm sorry to say, rather empty. Bring me bugs, fish and fossils, and I shall put them on show!" : "Good day, {name}! The museum has " + museumCount() + " of " + (BUGS.length + FISH.length + FOSSILS.length) + " treasures. Have you brought me something?"], [
    { text: "I have things for you", act: donate },
    { text: "Show me the collection", act: function () { openPanel("journal"); } },
    { text: "Just visiting", act: null },
  ]);
}

function donate() {
  const pages = [];
  let added = 0;
  // Bugs and fish the museum does not have yet
  for (const id of Object.keys(state.bag)) {
    const type = info(id).type;
    if ((type !== "bug" && type !== "fish") || state.museum[id]) continue;
    state.museum[id] = true;
    take(id);
    added++;
    pages.push("A " + info(id).name + "! Splendid! I shall put it on show at once.");
  }
  // Every mystery fossil turns out to be something
  while (state.bag.fossil) {
    take("fossil");
    const piece = FOSSILS[Math.floor(Math.random() * FOSSILS.length)];
    state.fossils[piece.id] = true;
    if (!state.museum[piece.id]) {
      state.museum[piece.id] = true;
      added++;
      pages.push("Let me see this fossil... My word! It is a " + piece.name + "! The museum must have it.");
    } else {
      state.coins += piece.price;
      pages.push("This fossil is a " + piece.name + ". We have one already, so I shall buy it from you for " + piece.price + " coins.");
    }
  }
  if (!pages.length) pages.push("Hmm. I'm afraid you have nothing new for the museum just now. Keep looking, {name}!");
  else if (added) {
    soundGot();
    pages.push("That makes " + museumCount() + " treasures in the museum. Thank you, {name}!");
  }
  talking = folk.find(function (one) { return one.keeper === "museum"; });
  openTalk("Professor Trunkle", pages);
  checkGoals();
}

// ===== 6. Your house =====
const furnitureModels = [];
function drawFurniture() {
  for (const model of furnitureModels) scene.remove(model);
  furnitureModels.length = 0;
  for (const item of state.home.items) {
    const model = makeFurniture(FURNITURE.find(function (one) { return one.id === item.id; }));
    model.position.set(ROOM.x + item.i + 0.5, 0, ROOM.z + item.k + 0.5);
    model.rotation.y = item.turn * Math.PI / 2;
    scene.add(model);
    furnitureModels.push(model);
  }
}

function goInside() {
  inside = true;
  const size = HOMES[state.home.stage].room;
  me.x = ROOM.x + size / 2;
  me.z = ROOM.z + size - 0.9;
  me.yaw = Math.PI;
  if (fishing) reelIn("");
  sound(function () { playTone(0, 0.12, 400, 300, 0.1); });
}

function goOutside() {
  inside = false;
  placing = null;
  me.x = homeSpot.x;
  me.z = (PLACES.home.k + PLACES.home.d) * TILE + 0.9;
  me.yaw = 0;
  sound(function () { playTone(0, 0.12, 300, 400, 0.1); });
}

// The square of the room just in front of you
function cellAhead() {
  return { i: Math.floor(me.x - ROOM.x + Math.sin(me.yaw) * 1.1), k: Math.floor(me.z - ROOM.z + Math.cos(me.yaw) * 1.1) };
}

let ghost = null;
function startPlacing(id) {
  placing = { id: id, turn: 0 };
  if (ghost) scene.remove(ghost);
  ghost = makeFurniture(FURNITURE.find(function (one) { return one.id === id; }));
  scene.add(ghost);
  closePanel();
  say("Walk to where you want it. E: put it down. R: turn it. Esc: never mind.", 6);
}

function putDown() {
  const cell = cellAhead();
  const size = HOMES[state.home.stage].room;
  const taken = state.home.items.some(function (item) { return item.i === cell.i && item.k === cell.k; });
  if (cell.i < 0 || cell.k < 0 || cell.i >= size || cell.k >= size - 1 || taken) return soundNo();
  state.home.items.push({ id: placing.id, i: cell.i, k: cell.k, turn: placing.turn });
  take("furn:" + placing.id);
  state.placed = true;
  placing = null;
  scene.remove(ghost);
  ghost = null;
  drawFurniture();
  soundPick();
  checkGoals();
  save();
}

function pickUp(item) {
  if (!give("furn:" + item.id)) return say("Your pockets are full.", 2);
  state.home.items.splice(state.home.items.indexOf(item), 1);
  drawFurniture();
  soundPick();
}

function sleep() {
  // Skip on to six o'clock tomorrow morning
  state.time = (Math.floor(state.time / DAY_SECONDS) + 1) * DAY_SECONDS;
  sound(playJingle);
  openTalk("", ["You snuggle down in bed, and dream of fish as big as boats...", "Good morning! It is a brand new day in Clover Cove."]);
}

// ===== 7. What E does =====
function findNear() {
  let best = null;
  let bestFar = 99;
  function offer(far, reach, text, act) {
    if (far < reach && far < bestFar) {
      best = { text: text, act: act };
      bestFar = far;
    }
  }
  if (inside) {
    const size = HOMES[state.home.stage].room;
    if (placing) return { text: "Put the " + info("furn:" + placing.id).name + " down here", act: putDown };
    offer(Math.hypot(me.x - ROOM.x - size / 2, me.z - ROOM.z - size + 0.4), 0.9, "Go outside", goOutside);
    for (const item of state.home.items) {
      const far = Math.hypot(me.x - ROOM.x - item.i - 0.5, me.z - ROOM.z - item.k - 0.5);
      const name = info("furn:" + item.id).name;
      if (item.id === "bed") {
        offer(far, 1.5, "Your bed", function () {
          openTalk("", ["Your bed looks very comfy."], [{ text: "Sleep until morning", act: sleep }, { text: "Pick the bed up", act: function () { pickUp(item); } }, { text: "Leave it", act: null }]);
        });
      } else {
        offer(far, 1.4, "Pick up the " + name, function () { pickUp(item); });
      }
    }
    return best;
  }
  for (const item of state.items) {
    offer(Math.hypot(item.x - me.x, item.z - me.z), 1.3, "Pick up the " + GOODS[item.id].name.toLowerCase(), function () {
      if (!give(item.id)) return say("Your pockets are full. Sell some things to Thistle.", 3);
      state.items.splice(state.items.indexOf(item), 1);
      soundPick();
    });
  }
  for (const one of folk) {
    if (one.asleep) continue;
    // (Thistle stands behind a counter, so you can talk from a little further away)
    offer(Math.hypot(one.x - me.x, one.z - me.z) - 0.6, one.keeper === "shop" ? 2.8 : 1.6, "Talk to " + one.def.name, function () { talkTo(one); });
  }
  for (const tree of trees) {
    if (Math.abs(tree.x - me.x) > 3 || Math.abs(tree.z - me.z) > 3) continue;
    offer(Math.hypot(tree.x - me.x, tree.z - me.z), 1.9, tree.has ? "Shake the tree" : "Shake the tree (no fruit today)", function () { shake(tree); });
  }
  offer(Math.hypot(homeSpot.x - me.x, (PLACES.home.k + PLACES.home.d) * TILE + 0.3 - me.z), 1.5, "Go into your house", goInside);
  return best;
}

function useTool() {
  if (inside) return;
  if (state.tool === "net") swingNet();
  else if (state.tool === "rod") useRod();
  else if (state.tool === "shovel") dig();
  else if (near) near.act();
}

// ===== 8. Jobs =====
function goalDone(n) {
  const friends = state.friends;
  if (n === 0) return friends.chip.met;
  if (n === 1) return state.sold > 0;
  if (n === 2) return Object.keys(state.bugs).length > 0;
  if (n === 3) return Object.keys(state.fish).length > 0;
  if (n === 4) return NEIGHBOURS.every(function (one) { return friends[one.id].met; });
  if (n === 5) return museumCount() > 0;
  if (n === 6) return state.dug > 0;
  if (n === 7) return state.placed;
  if (n === 8) return state.favours > 0;
  if (n === 9) return state.home.stage >= 1;
  if (n === 10) return museumCount() >= 20;
  return state.home.stage >= 3;
}

function checkGoals() {
  while (state.goal < GOALS.length && goalDone(state.goal)) {
    const done = GOALS[state.goal];
    state.goal++;
    if (done.reward) {
      state.coins += done.reward;
      soundCoins();
      say("Well done! You earned " + done.reward + " coins.", 4);
    } else {
      say("You did everything! Clover Cove is truly your home now.", 8);
    }
  }
  el("goal").textContent = state.goal < GOALS.length ? "To do: " + GOALS[state.goal].text : "You have done it all! Enjoy your life in Clover Cove";
}

// ===== 9. Panels: your bag, your journal, and the shop =====
function openPanel(which) {
  panel = which;
  mode = "panel";
  el("panel").hidden = false;
  drawPanel();
}

function closePanel() {
  panel = "";
  el("panel").hidden = true;
  if (mode === "panel") mode = "play";
}

function dot(colour) {
  return '<i class="dot" style="background:#' + colour.toString(16).padStart(6, "0") + '"></i>';
}

function drawPanel() {
  let html = "";
  if (panel === "bag") {
    html += "<h2>Your pockets (" + bagCount() + " of " + POCKETS + ")</h2><div class=\"list\">";
    const ids = Object.keys(state.bag);
    if (!ids.length) html += '<p class="small">Empty! Shake a tree, or catch something.</p>';
    for (const id of ids) {
      const thing = info(id);
      html += '<div class="row">' + dot(thing.colour) + "<span>" + thing.name + (state.bag[id] > 1 ? " ×" + state.bag[id] : "") + "</span><em>" + thing.price + " coins</em>" + (thing.type === "furniture" ? (inside ? '<button data-place="' + id.slice(5) + '">Put it in the room</button>' : "<em>(goes in your house)</em>") : "") + "</div>";
    }
    html += "</div>";
  } else if (panel === "journal") {
    html += "<h2>Your journal</h2><p class=\"small\">★ means it is in the museum. The museum has " + museumCount() + " of " + (BUGS.length + FISH.length + FOSSILS.length) + " treasures.</p><div class=\"columns\">";
    const column = function (title, list, found, prefix, hint) {
      let out = "<div><h3>" + title + " (" + list.filter(function (one) { return found[one.id]; }).length + " of " + list.length + ")</h3>";
      for (const one of list) {
        out += '<p class="small' + (found[one.id] ? "" : " unknown") + '">' + (state.museum[prefix + one.id] ? "★ " : "") + (found[one.id] ? one.name : "??? " + hint(one)) + "</p>";
      }
      return out + "</div>";
    };
    const when = function (one) { return "(" + one.seasons.map(function (s) { return SEASONS[s].slice(0, 3); }).join(", ") + (one.time === "any" ? "" : ", " + one.time) + ")"; };
    html += column("Bugs", BUGS, state.bugs, "bug:", function (one) { return when(one) + " " + { flower: "by flowers", tree: "on trees", grass: "in grass", water: "by water" }[one.place]; });
    html += column("Fish", FISH, state.fish, "fish:", function (one) { return when(one) + " " + one.water; });
    html += column("Fossils", FOSSILS, state.fossils, "", function () { return "(dig for it)"; });
    html += "</div>";
  } else if (panel === "shop") {
    html += "<h2>Thistle's Stall</h2><p><button data-tab=\"buy\"" + (shopTab === "buy" ? ' class="on"' : "") + ">Buy</button><button data-tab=\"sell\"" + (shopTab === "sell" ? ' class="on"' : "") + ">Sell</button> You have " + state.coins + " coins.</p><div class=\"list\">";
    if (shopTab === "buy") {
      if (!state.tools.shovel) html += '<div class="row">' + dot(0xb8c0c8) + "<span>Shovel</span><em>" + TOOLS.shovel.price + ' coins</em><button data-buy="shovel"' + (state.coins < TOOLS.shovel.price ? " disabled" : "") + ">Buy</button></div>";
      for (const id of state.stock) {
        const item = FURNITURE.find(function (one) { return one.id === id; });
        html += '<div class="row">' + dot(item.colour) + "<span>" + item.name + "</span><em>" + item.price + ' coins</em><button data-buy="' + id + '"' + (state.coins < item.price ? " disabled" : "") + ">Buy</button></div>";
      }
      html += '<div class="row">' + dot(WALLPAPERS[(state.home.wall + 1) % 4]) + '<span>New wallpaper for your house</span><em>800 coins</em><button data-buy="wall"' + (state.coins < 800 ? " disabled" : "") + ">Buy</button></div>";
      html += '<div class="row">' + dot(FLOORS[(state.home.floor + 1) % 4]) + '<span>A new floor for your house</span><em>800 coins</em><button data-buy="floor"' + (state.coins < 800 ? " disabled" : "") + ">Buy</button></div>";
      html += '<p class="small">Thistle has different furniture every morning.</p>';
    } else {
      const ids = Object.keys(state.bag);
      if (!ids.length) html += '<p class="small">Your pockets are empty.</p>';
      for (const id of ids) {
        const thing = info(id);
        html += '<div class="row">' + dot(thing.colour) + "<span>" + thing.name + (state.bag[id] > 1 ? " ×" + state.bag[id] : "") + "</span><em>" + thing.price + ' each</em><button data-sell="' + id + '">Sell one</button>' + (state.bag[id] > 1 ? '<button data-sellall="' + id + '">Sell all</button>' : "") + "</div>";
      }
    }
    html += "</div>";
  }
  html += '<p><button data-close="1">Close (Esc)</button></p>';
  el("panel").innerHTML = html;
}

// ===== 10. One step of the game =====
function tick(dt) {
  state.time += dt;
  const day = Math.floor(state.time / DAY_SECONDS) + 1;
  if (day !== state.day) {
    state.day = day;
    freshDay();
    if (mode === "play") say("Good morning! It is " + DAY_NAMES[(day - 1) % 7] + ", day " + ((day - 1) % SEASON_DAYS + 1) + " of " + SEASONS[season()] + ".", 5);
    save();
  }
  if (mode !== "play") return;
  me.swing = Math.max(0, me.swing - dt);
  moveMe(dt);
  updateFishing(dt);
  updateBugs(dt);
  updateFish(dt);
  updateFolk(dt);
  updateBees(dt);
  for (const tree of trees) {
    if (tree.shake > 0) {
      tree.shake = Math.max(0, tree.shake - dt);
      drawTree(tree, season());
    }
  }
  near = findNear();
  if (state.time - lastCheck > 1) {
    lastCheck = state.time;
    checkGoals();
  }
  if (state.time - lastSave > 30) save();
}

// ===== 11. Drawing =====
const strings = {};
function setText(id, text) {
  if (strings[id] === text) return;
  strings[id] = text;
  el(id).innerHTML = text;
}

function drawHud() {
  const hour = clockHour();
  const minutes = Math.floor((hour % 1) * 6) * 10;
  const twelve = Math.floor(hour) % 12 || 12;
  setText("clock", twelve + ":" + String(minutes).padStart(2, "0") + (hour < 12 ? " am" : " pm") + " &nbsp; " + DAY_NAMES[(state.day - 1) % 7] + " &nbsp; " + SEASONS[season()]);
  setText("coins", state.coins + " coins");
  let tools = "";
  ["hand", "net", "rod", "shovel"].forEach(function (id, n) {
    if (id !== "hand" && !state.tools[id]) return;
    tools += "<span" + (state.tool === id ? ' class="on"' : "") + ">" + (n + 1) + " " + TOOLS[id].name + "</span>";
  });
  setText("tools", tools);
  let hint = "";
  if (mode === "play") {
    if (fishing) hint = fishing.phase === "bite" ? "NOW! Press Space!" : fishing.fish ? "A fish is looking... wait for the float to go right under" : "Waiting for a fish... (Space: pull the line in)";
    else if (near && (state.tool === "hand" || inside || near.text.indexOf("Shake") < 0)) hint = "E: " + near.text;
    else if (state.tool !== "hand" && !inside) hint = TOOLS[state.tool].what;
    else if (near) hint = "E: " + near.text;
  }
  setText("hint", hint);
  el("hint").hidden = !hint;
  el("hint").classList.toggle("now", !!fishing && fishing.phase === "bite");
  if (!el("toast").hidden && wall > toastUntil) el("toast").hidden = true;
}

const SKIES = { day: new THREE.Color(0xa8dcf4), dusk: new THREE.Color(0xf4b078), night: new THREE.Color(0x18223c) };
const nowSky = new THREE.Color();

function draw(dt) {
  wall += dt;
  const hour = mode === "intro" ? 11 : clockHour();       // (it is always a bright morning on the first screen)

  // ----- The sky and the light: bright by day, orange at sunset, dark blue at night -----
  let dark = 0;
  if (hour >= 18 && hour < 20) dark = (hour - 18) / 2;
  else if (hour >= 20 || hour < 5) dark = 1;
  else if (hour < 6.5) dark = 1 - (hour - 5) / 1.5;
  const glow = Math.max(0, 1 - Math.abs(hour - 18.6) / 1.4, 1 - Math.abs(hour - 5.8) / 1);
  nowSky.copy(SKIES.day).lerp(SKIES.dusk, glow * 0.8).lerp(SKIES.night, dark);
  if (inside) nowSky.setHex(0x2a2430);
  scene.fog.color.copy(nowSky);
  renderer.setClearColor(nowSky);
  skyLight.intensity = inside ? 0.85 : 0.72 - dark * 0.4;
  sunLight.intensity = inside ? 0.4 : 0.65 * (1 - dark);
  for (const bulb of lampBulbs) bulb.material.color.setHex(dark > 0.4 ? 0xffe9a0 : 0x8a8a80);

  // ----- You -----
  const model = playerModel;
  model.group.position.set(me.x, 0, me.z);
  model.group.rotation.y = me.yaw;
  const pace = me.running ? 14 : 9;
  const stride = me.moving ? Math.sin(wall * pace) * (me.running ? 0.9 : 0.6) : 0;
  model.limbs.forEach(function (limb, n) { limb.rotation.x = stride * (n === 0 || n === 3 ? 1 : -1); });
  model.body.position.y = me.moving ? Math.abs(Math.sin(wall * pace)) * 0.06 : 0;
  // Holding a tool: the right arm sticks out, and swings when you use it
  for (const id in toolModels) toolModels[id].visible = state.tool === id && !inside;
  if (state.tool !== "hand" && !inside) model.hand.rotation.x = -1.1 + (me.swing > 0 ? Math.sin((0.4 - me.swing) / 0.4 * Math.PI) * 1.6 : 0) + (fishing ? -0.4 : 0);

  // ----- The camera looks down on you from behind. (Before the game starts, it comes in close
  // so you can see what you look like.) -----
  if (mode === "intro") {
    camera.position.set(me.x - 1.9, 2.3, me.z + 5.4);
    camera.lookAt(me.x - 1.9, 1, me.z);
    model.group.rotation.y = Math.sin(wall * 0.8) * 0.6;
  } else {
    const high = inside ? 9 : 15;
    camera.position.set(me.x, high, me.z + (inside ? 7.5 : 12.5));
    camera.lookAt(me.x, 0.8, me.z - 0.5);
  }
  sunLight.target.position.set(me.x, 0, me.z);
  sunLight.position.set(me.x - 22, 44, me.z + 18);

  // ----- Small things -----
  if (fishing) {
    const under = fishing.phase === "bite" ? -0.22 : wall - (fishing.dip || -9) < 0.2 ? -0.07 : 0;
    bobber.position.set(fishing.x, 0.08 + under + Math.sin(wall * 3) * 0.02, fishing.z);
  } else {
    bobber.position.y = -5;
  }
  if (bees) {
    for (let n = 0; n < 8; n++) putOne(beeMesh, n, bees.x + Math.cos(wall * 9 + n * 2) * 0.5, 1.2 + Math.sin(wall * 13 + n) * 0.4, bees.z + Math.sin(wall * 8 + n * 3) * 0.5, 1, 1, 1);
    beeMesh.count = 8;
  } else {
    beeMesh.count = 0;
  }
  sparkles.forEach(function (spark, n) {
    const big = Math.max(0, Math.sin(wall * 1.5 + spark.at));
    helper.position.set(spark.x, 0.03, spark.z);
    helper.rotation.set(-Math.PI / 2, 0, 0);
    helper.scale.set(big, big, big);
    helper.updateMatrix();
    sparkleMesh.setMatrixAt(n, helper.matrix);
  });
  sparkleMesh.instanceMatrix.needsUpdate = true;
  if (ghost && placing) {
    const cell = cellAhead();
    ghost.position.set(ROOM.x + cell.i + 0.5, 0.05, ROOM.z + cell.k + 0.5);
    ghost.rotation.y = placing.turn * Math.PI / 2;
  }
  drawBugs(wall);
  drawFish();
  drawItems(wall);
  drawFolk(wall);
  drawHud();
}

// ===== 12. Saving =====
function save() {
  lastSave = state.time;
  state.at = { x: me.x, z: me.z, inside: inside };
  state.fruit = trees.filter(function (tree) { return tree.fruit && !tree.has; }).map(function (tree) { return tree.slot; });
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
  } else {
    state.name = el("your-name").value.trim().slice(0, 12) || "Clover";
    state.hair = pickedHair;
    state.shirt = pickedShirt;
  }
  bugs.length = 0;
  fishes.length = 0;
  fishing = placing = bees = null;
  inside = false;
  me.x = mid(11);
  me.z = mid(15) + 0.4;
  me.yaw = 0;
  if (saved) {
    for (const tree of trees) tree.has = !!tree.fruit && !(state.fruit || []).includes(tree.slot);
    drawSeason(season());
    if (state.at) {
      me.x = state.at.x;
      me.z = state.at.z;
      inside = state.at.inside;
    }
  } else {
    freshDay();
  }
  drawPlayer();
  drawHome(state.home.stage);
  drawRoom(HOMES[state.home.stage].room, state.home.wall, state.home.floor);
  drawFurniture();
  for (let n = 0; n < 8; n++) {
    addBug();
    addFish();
  }
  lastSave = lastCheck = state.time;
  for (const id of ["intro", "talk", "panel"]) el(id).hidden = true;
  el("hud").hidden = false;
  mode = "play";
  checkGoals();
  if (!saved) openTalk("", ["Welcome to Clover Cove, {name}! This little house with the red roof is yours.", "Your neighbours can't wait to meet you. Chip the beaver, who built your house, would like a word too: he is just up the path to the north-east.", "Walk with W, A, S, D. Hold Shift to run. Press E to do things. Have a lovely time!"]);
}

// ===== 13. Keys, mouse and buttons =====
window.addEventListener("keydown", function (e) {
  if (e.target.tagName === "INPUT") return;
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (mode === "talk") {
    if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") nextTalk();
    else if (e.code.indexOf("Digit") === 0) nextTalk(Number(e.code.slice(5)) - 1);
    return;
  }
  if (mode === "panel") {
    if (e.code === "Escape" || e.code === "KeyB" || e.code === "KeyJ" || e.code === "KeyI") closePanel();
    return;
  }
  if (mode !== "play") return;
  if (placing) {
    if (e.code === "KeyR") placing.turn = (placing.turn + 1) % 4;
    else if (e.code === "Escape") {
      placing = null;
      scene.remove(ghost);
      ghost = null;
    } else if (e.code === "KeyE" || e.code === "Space") putDown();
    return;
  }
  if (e.code === "KeyE" && near) near.act();
  else if (e.code === "Space") useTool();
  else if (e.code === "KeyB" || e.code === "KeyI") openPanel("bag");
  else if (e.code === "KeyJ") openPanel("journal");
  else if (e.code === "Digit1") setTool("hand");
  else if (e.code === "Digit2") setTool("net");
  else if (e.code === "Digit3") setTool("rod");
  else if (e.code === "Digit4") setTool("shovel");
});

window.addEventListener("keyup", function (e) {
  keys[e.code] = false;
});

window.addEventListener("blur", function () {
  for (const code in keys) keys[code] = false;
});

el("talk").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  nextTalk(button ? Number(button.dataset.choice) : undefined);
});
el("panel").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (!button) return;
  if (button.dataset.close) closePanel();
  else if (button.dataset.tab) {
    shopTab = button.dataset.tab;
    drawPanel();
  } else if (button.dataset.buy) buy(button.dataset.buy);
  else if (button.dataset.sell) sell(button.dataset.sell, false);
  else if (button.dataset.sellall) sell(button.dataset.sellall, true);
  else if (button.dataset.place) startPlacing(button.dataset.place);
});

// Choosing how you look, before the game starts
let pickedHair = 0;
let pickedShirt = 1;
function drawLooks() {
  const swatches = function (list, picked, kind) {
    return list.map(function (colour, n) { return '<button class="swatch' + (n === picked ? " on" : "") + '" data-' + kind + '="' + n + '" style="background:#' + colour.toString(16).padStart(6, "0") + '"></button>'; }).join("");
  };
  el("hairs").innerHTML = swatches(HAIRS, pickedHair, "hair");
  el("shirts").innerHTML = swatches(SHIRTS, pickedShirt, "shirt");
  state.hair = pickedHair;
  state.shirt = pickedShirt;
  drawPlayer();
}
el("looks").addEventListener("click", function (e) {
  const button = e.target.closest("button");
  if (!button) return;
  if (button.dataset.hair) pickedHair = Number(button.dataset.hair);
  if (button.dataset.shirt) pickedShirt = Number(button.dataset.shirt);
  drawLooks();
});
el("start").addEventListener("click", function () {
  begin(null);
});
el("continue").addEventListener("click", function () {
  begin(load());
});

// ===== 14. Go! =====
makeFolk();
drawSeason(0);
drawHome(0);
drawRoom(HOMES[0].room, 0, 0);
drawLooks();
el("continue").hidden = !load();

let lastTime = 0;
let frameCount = 0;
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ms - lastTime) / 1000 || 0.016);
  lastTime = ms;
  frameCount++;
  fit();
  if (mode !== "intro") tick(mode === "play" ? dt : 0);
  draw(dt);
  renderer.render(scene, camera);
}

// For testing the game with a script: add ?test to the address
if (testing) {
  begin(null);
  closeTalk();
  window.CC = {
    me: me, keys: keys, bugs: bugs, fishes: fishes, folk: folk, trees: trees,
    state: function () { return state; },
    mode: function () { return mode; },
    near: function () { return near; },
    inside: function () { return inside; },
    fishing: function () { return fishing; },
    talkText: function () { return talk ? talk.pages[talk.n] : ""; },
    frames: function () { return frameCount; },
    begin: begin, save: save, load: load, give: give, take: take, info: info, setTool: setTool, useTool: useTool, nextTalk: nextTalk, closeTalk: closeTalk,
    openPanel: openPanel, closePanel: closePanel, buy: buy, sell: sell, payLoan: payLoan, donate: donate, talkTo: talkTo, shake: shake, goInside: goInside, goOutside: goOutside,
    startPlacing: startPlacing, putDown: putDown, sleep: sleep, checkGoals: checkGoals, addBug: addBug, addFish: addFish, findNear: findNear, freshDay: freshDay,
    setBees: function (b) { bees = b; }, bees: function () { return bees; },
    step: function (n) { for (let i = 0; i < n; i++) { if (mode === "play") tick(0.05); } },
  };
}

requestAnimationFrame(frame);
