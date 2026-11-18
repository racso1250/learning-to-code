// Beastlings: the game itself. Walking around, talking, battles, menus and saving.
// (The creatures are in data.js and the map is in world.js.)

const el = (id) => document.getElementById(id);
const canvas = el("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const DX = [0, -1, 1, 0], DY = [1, 0, 0, -1];        // directions: 0 down, 1 left, 2 right, 3 up
const INK = "#20203a", PAPER = "#f8f8f0", BLUE = "#4868c8";      // the colours of the words and boxes
const ITEMS = {
  orb: { name: "Snare Orb", price: 100, power: 1 }, great: { name: "Great Orb", price: 300, power: 1.8 },
  potion: { name: "Potion", price: 150, heals: 25 }, super: { name: "Super Potion", price: 400, heals: 70 },
};

function beep(make) {
  try { make(); } catch (error) { /* no sound: the game still works */ }
}
const sfx = {
  tick: () => beep(() => playTone(0, 0.04, 900, 900, 0.05)),
  ok: () => beep(() => playTone(0, 0.06, 700, 1100, 0.07)),
  hit: () => beep(() => playNoise(0, 0.12, 900, 200, 0.14)),
  bump: () => beep(() => playTone(0, 0.07, 140, 110, 0.08)),
  heal: () => beep(() => { playTone(0, 0.1, 520, 520, 0.08); playTone(0.12, 0.1, 660, 660, 0.08); playTone(0.24, 0.2, 780, 780, 0.08); }),
  wild: () => beep(() => { for (let n = 0; n < 6; n++) playTone(n * 0.07, 0.06, 300 + (n % 2) * 400, 300 + (n % 2) * 400, 0.08); }),
  win: () => beep(() => playJingle()),
};

// ----- What the game remembers -----
const SAVE_NAME = "beastlingsSave";
const newState = () => ({ look: lookOf(1, 0, 1, 1, 0, 0, 0), x: 14, y: 83, dir: 0, party: [], box: [], dex: {}, bag: { orb: 5, great: 0, potion: 2, super: 0 }, money: 500, badges: [], beaten: {}, flags: {}, heal: { x: 14, y: 83 } });
let state = newState();
function save() {
  try { localStorage.setItem(SAVE_NAME, JSON.stringify(state)); } catch (error) { /* keep playing */ }
}
function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_NAME));
    return saved && saved.party ? saved : null;
  } catch (error) { return null; }
}
const mark = (id, how) => (state.dex[id] = Math.max(state.dex[id] || 0, how));        // 1 = seen, 2 = caught
const caught = () => Object.values(state.dex).filter((how) => how === 2).length;
const nameOf = (mon) => DEX[mon.id].name;
function healAll() {
  for (const mon of state.party) mon.hp = stat(mon, "hp");
}

// ----- Buttons -----
const down = {}, tapped = {};
const BUTTONS = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", KeyZ: "a", Space: "a", KeyX: "b", Escape: "b", Backspace: "b", Enter: "start", ShiftLeft: "run", ShiftRight: "run" };
document.addEventListener("keydown", function (event) {
  const button = BUTTONS[event.code];
  if (!button) return;
  event.preventDefault();
  if (!down[button]) tapped[button] = true;
  down[button] = true;
});
document.addEventListener("keyup", function (event) {
  if (BUTTONS[event.code]) down[BUTTONS[event.code]] = false;
});

// ----- Words and menus on the screen -----
// The game's story code is written with "await": it asks for some words to be shown (or a menu),
// and carries on from the same place once the player has pressed a button.
const ui = [];           // the boxes on the screen right now; the last one is in front
const timers = [];
const say = (text) => new Promise((done) => ui.push({ kind: "text", pages: pagesOf(text), page: 0, shown: 0, done: done }));
const choose = (options, o) => new Promise((done) => ui.push(Object.assign({ kind: "menu", options: options, index: 0, top: 0, done: done }, o)));
const wait = (seconds) => new Promise((done) => timers.push({ t: seconds, done: done }));
const show = (thing) => new Promise((done) => ui.push(Object.assign(thing, { done: done })));
function pagesOf(text) {
  const lines = [];
  let row = "";
  for (const word of text.split(" ")) {
    if ((row + " " + word).trim().length > 18) {
      lines.push(row);
      row = "";
    }
    row = (row + " " + word).trim();
  }
  lines.push(row);
  const pages = [];
  for (let n = 0; n < lines.length; n += 2) pages.push(lines.slice(n, n + 2));
  return pages;
}
function close(thing, answer) {
  ui.splice(ui.indexOf(thing), 1);
  thing.done(answer);
}
function updateUi(dt) {
  const top = ui[ui.length - 1];
  const go = tapped.a || tapped.start;
  if (top.kind === "text") {
    const long = top.pages[top.page].join("").length;
    top.shown += dt * 70;
    if (!go && !tapped.b) return;
    if (top.shown < long) top.shown = 999;
    else if (top.page < top.pages.length - 1) {
      top.page++;
      top.shown = 0;
      sfx.tick();
    } else {
      sfx.tick();
      close(top);
    }
  } else if (top.kind === "menu") {
    const many = top.options.length, cols = top.cols || 1;
    if (tapped.down) top.index = (top.index + cols) % many;
    if (tapped.up) top.index = (top.index + many - cols) % many;
    if (cols > 1 && (tapped.left || tapped.right)) top.index = top.index % 2 ? top.index - 1 : Math.min(many - 1, top.index + 1);
    if (tapped.down || tapped.up || tapped.left || tapped.right) sfx.tick();
    const rows = top.rows || many;
    top.top = Math.max(Math.min(top.top, top.index), top.index - rows + 1);
    if (go) {
      sfx.ok();
      close(top, top.index);
    } else if (tapped.b && top.cancel !== false) close(top, -1);
  } else top.update(top, go);
}
function words(text, x, y, colour) {
  ctx.fillStyle = colour || INK;
  ctx.font = "8px \"Press Start 2P\", monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
}
function box(x, y, w, h) {
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAPER;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = BLUE;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = PAPER;
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
}
function arrow(x, y) {
  ctx.fillStyle = "#e03838";
  for (let n = 0; n < 4; n++) ctx.fillRect(x + n, y + n, 1, 7 - n * 2);
}
function bar(mon, x, y, w) {
  const full = stat(mon, "hp");
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = "#d8d8d0";
  ctx.fillRect(x + 1, y + 1, w - 2, 2);
  const part = shownHp(mon) / full;
  ctx.fillStyle = part > 0.5 ? "#38c048" : part > 0.2 ? "#f0b020" : "#e03838";       // green, then yellow, then red
  ctx.fillRect(x + 1, y + 1, Math.max(part > 0 ? 1 : 0, Math.round((w - 2) * part)), 2);
}
// Health bars slide down smoothly, so each Beastling has a "shown" amount that chases its real one
const sliding = new Map();
function shownHp(mon) {
  if (!sliding.has(mon)) sliding.set(mon, mon.hp);
  return sliding.get(mon);
}
function drawUi() {
  for (const thing of ui) {
    if (thing.kind === "text") {
      box(0, 96, 160, 48);
      let left = Math.floor(thing.shown);
      thing.pages[thing.page].forEach(function (row, n) {
        words(row.slice(0, Math.max(0, left)), 8, 108 + n * 16);
        left -= row.length;
      });
      if (left >= 0 && Math.floor(time * 3) % 2) { ctx.fillStyle = "#e03838"; for (let n = 0; n < 4; n++) ctx.fillRect(144 + n, 132 + n, 7 - n * 2, 1); }
    } else if (thing.kind === "menu") {
      const cols = thing.cols || 1, gap = thing.gap || (thing.tight ? 10 : 12), rows = thing.rows || Math.ceil(thing.options.length / cols);
      const w = thing.w || Math.max(...thing.options.map((o) => o.length)) * 8 + 24, h = thing.h || rows * gap + 12;
      const x = thing.x == null ? 160 - w : thing.x, y = thing.y == null ? 0 : thing.y;
      box(x, y, w, h);
      if (thing.onDraw) thing.onDraw(thing.index);
      for (let n = thing.top * cols; n < Math.min(thing.options.length, (thing.top + rows) * cols); n++) {
        const ox = x + 14 + (n % cols) * Math.floor((w - 12) / cols), oy = y + (thing.gap ? 11 : 7) + (Math.floor(n / cols) - thing.top) * gap;
        words(thing.options[n], ox, oy);
        if (n === thing.index) arrow(ox - 7, oy);
      }
    } else thing.draw(thing);
  }
}

// ----- Walking around the world -----
const walker = { ox: 0, oy: 0, moving: false, t: 0, steps: 0 };
let time = 0, busy = false, started = false;
let banner = { text: "", t: 0 }, placeNow = "";
const TEST = { noWild: false };
function run(script) {          // start a piece of story; nothing else happens until it ends
  busy = true;
  script().catch((error) => console.error(error)).then(function () {
    busy = false;
    save();
  });
}
const gateShut = (x, y) => (gates[key(x, y)] === 9 ? !state.flags.champion : state.badges.length < gates[key(x, y)]);
const legendHere = (legend) => !state.flags["got" + legend.id] && (!legend.myth || state.flags.champion);
const personAt = (x, y) => people.find((who) => who.x === x && who.y === y) || trainers.find((who) => who.x === x && who.y === y) || null;
const legendAt = (x, y) => legends.find((legend) => legend.x === x && legend.y === y && legendHere(legend)) || null;
// ----- Rooms: the insides of buildings -----
let room = null;         // the room you are in, or null when you are outdoors
function buildRoom(spot) {
  const door = doors[spot];
  if (!door) return null;
  const staff = Object.assign({ dir: 0 }, ROOM_STAFF[door.kind]);
  if (door.kind === "gym") staff.look = LEADER_LOOKS[door.n];
  return { door: door, rows: ROOM_PLANS[door.kind], staff: staff, colours: roomColours(door), art: roomPicture(door) };
}
const roomTile = (x, y) => (x < 0 || y < 0 || x > 9 || y > 8 ? "#" : room.rows[y][x]);
async function enterRoom(spot) {
  state.out = { x: state.x, y: state.y + 1 };          // where you will come back out: just below the door
  state.room = spot;
  room = buildRoom(spot);
  Object.assign(state, { x: 4, y: 7, dir: 3 });
  sfx.ok();
  banner = { text: ROOM_NAMES[room.door.kind], t: 2 };
}
function leaveRoom() {
  Object.assign(state, { x: state.out.x, y: state.out.y, dir: 0, room: null });
  room = null;
  sfx.ok();
}
// Talking to whoever is in the room (you can talk across a counter or a table)
async function roomTalk() {
  let x = state.x + DX[state.dir], y = state.y + DY[state.dir];
  if ("CT".includes(roomTile(x, y))) { x += DX[state.dir]; y += DY[state.dir]; }
  const who = room.staff, door = room.door;
  if (who.x !== x || who.y !== y) return;
  who.dir = [3, 2, 1, 0][state.dir];
  if (door.kind === "home") {
    await say("Mum: Welcome home, dear! Have a rest.");
    healAll();
    sfx.heal();
    state.heal = state.out;
    await say("You and your team feel great!");
  } else if (door.kind === "heal") {
    await say("Nurse: Welcome! Let me look after your Beastlings.");
    healAll();
    sfx.heal();
    state.heal = state.out;
    await say("Nurse: All better! Take care out there.");
  } else if (door.kind === "house") await say(door.text);
  else if (door.kind === "mart") await shop();
  else if (door.kind === "lab") await lab();
  else if (door.kind === "gym") await gym(door);
  else if (door.kind === "hall") await hall();
}

function canWalk(x, y) {
  if (room) return ".RM".includes(roomTile(x, y)) && !(room.staff.x === x && room.staff.y === y);
  const kind = tile(x, y);
  return !BLOCKS.includes(kind) && !(kind === GATE && gateShut(x, y)) && !personAt(x, y) && !legendAt(x, y);
}
function updateWorld(dt) {
  if (walker.moving) {
    walker.t += dt / (down.b || down.run ? 0.1 : 0.19);
    if (walker.t >= 1) {
      state.x += DX[state.dir];
      state.y += DY[state.dir];
      Object.assign(walker, { moving: false, ox: 0, oy: 0, steps: walker.steps + 1 });
      afterStep();
    } else {
      walker.ox = DX[state.dir] * walker.t * TS;
      walker.oy = DY[state.dir] * walker.t * TS;
    }
    return;
  }
  if (tapped.start) return run(startMenu);
  if (tapped.a) return run(interact);
  const want = down.down ? 0 : down.left ? 1 : down.right ? 2 : down.up ? 3 : -1;
  if (want < 0) return;
  state.dir = want;
  if (canWalk(state.x + DX[want], state.y + DY[want])) Object.assign(walker, { moving: true, t: 0 });
  else if (tapped.down || tapped.left || tapped.right || tapped.up) sfx.bump();
}
function afterStep() {
  if (room) {
    if (roomTile(state.x, state.y) === "M") leaveRoom();        // stepping on the doormat takes you back outside
    return;
  }
  const here = key(state.x, state.y), kind = tile(state.x, state.y), area = areaAt(state.x, state.y);
  if (area && area.name !== placeNow) {
    placeNow = area.name;
    banner = { text: area.name, t: 2.2 };
  }
  if (kind === DOOR) return run(() => enterRoom(here));
  if (steps[here] === "starter" && !state.party.length) return run(async function () {
    await say("Prof. Maple: Wait! It's not safe out there without a Beastling. Come to my lab!");
    state.y++;
  });
  if (steps[here] === "rival1" && state.party.length && !state.flags.rival1) return run(() => rival(1));
  if (steps[here] === "rival2" && !state.flags.rival2) return run(() => rival(2));
  // Has a trainer spotted you?
  for (const who of trainers) {
    if (state.beaten[who.id]) continue;
    const far = (state.x - who.x) * DX[who.dir] + (state.y - who.y) * DY[who.dir];
    const inLine = who.x + DX[who.dir] * far === state.x && who.y + DY[who.dir] * far === state.y;
    if (!inLine || far < 1 || far > who.sight) continue;
    let clear = true;
    for (let n = 1; n < far; n++) if (!canWalk(who.x + DX[who.dir] * n, who.y + DY[who.dir] * n)) clear = false;
    if (clear) return run(() => challenge(who, true));
  }
  // Wild Beastlings hide in tall grass (and anywhere in a cave)
  if (area && area.wild && state.party.length && !TEST.noWild && (kind === TALL || (area.cave && kind === CAVE)) && Math.random() < (area.cave ? 0.08 : 0.13)) run(() => wildBattle(area));
}
async function interact() {
  if (room) return roomTalk();
  const x = state.x + DX[state.dir], y = state.y + DY[state.dir], who = personAt(x, y), legend = legendAt(x, y);
  if (who) {
    who.dir = 3 - state.dir;
    if (!who.team) return say(who.text);
    return state.beaten[who.id] ? say(who.after) : challenge(who, false);
  }
  if (legend) return legendBattle(legend);
  if (tile(x, y) === SIGN) return say(signs[key(x, y)]);
  if (tile(x, y) === GATE && gateShut(x, y)) return say(gates[key(x, y)] === 9 ? "Guard: Only the Champion of Kova may enter the Moonlit Glade." : "Guard: You need " + gates[key(x, y)] + " gym badges to go this way. You have " + state.badges.length + ".");
}
function slide(who, dx, dy) {          // make a trainer walk one square
  return new Promise(function (done) {
    who.walk = { dx: dx, dy: dy, t: 0, done: done };
  });
}
async function whiteOut() {
  await say("You have no Beastlings left that can battle! You hurry back to rest...");
  healAll();
  room = null;
  Object.assign(state, { x: state.heal.x, y: state.heal.y, dir: 0, room: null });
  for (const who of trainers) Object.assign(who, { x: who.homeX, y: who.homeY });
  await say("Your team is rested and ready to try again.");
}
async function challenge(who, walkUp) {
  who.alert = true;
  sfx.wild();
  await wait(0.7);
  who.alert = false;
  while (walkUp && Math.abs(who.x - state.x) + Math.abs(who.y - state.y) > 1) await slide(who, DX[who.dir], DY[who.dir]);
  state.dir = [3, 2, 1, 0][who.dir];
  await say(who.before);
  const result = await battle(who.team.map(([id, lv]) => makeBeast(id, lv)), { trainer: who.name });
  if (result !== "won") return whiteOut();
  state.beaten[who.id] = true;
  const prize = who.team[who.team.length - 1][1] * 30;
  state.money += prize;
  await say("You beat " + who.name + "! You got $" + prize + ".");
  await say(who.after);
}
async function wildBattle(area) {
  let roll = Math.random() * area.wild.reduce((sum, row) => sum + row[3], 0), row = area.wild[0];
  for (const each of area.wild) {
    if ((roll -= each[3]) < 0) { row = each; break; }
  }
  const lv = row[1] + Math.floor(Math.random() * (row[2] - row[1] + 1));
  // (A wild one is the right step of its family for its level)
  let id = row[0];
  while (DEX[id].evolve && lv >= DEX[id].evolve + 4) id++;
  if ((await battle([makeBeast(id, lv)], {})) === "lost") await whiteOut();
}
async function legendBattle(legend) {
  await say(DEX[legend.id].name.toUpperCase() + ": Grraaaoooh!");
  const result = await battle([makeBeast(legend.id, legend.lv)], { legend: true, myth: legend.myth });
  if (result === "caught") state.flags["got" + legend.id] = true;
  if (result === "lost") await whiteOut();
}
async function rival(n) {
  const his = [0, 4, 7, 1][[1, 4, 7].indexOf(state.flags.starter) + 1];        // (he chose the one that beats yours)
  if (n === 1) {
    await say("Rook: Hey! Prof. Maple gave me a Beastling too. Let's see whose is better!");
    const result = await battle([makeBeast(his, 5)], { trainer: "Rival Rook" });
    state.flags.rival1 = true;
    if (result !== "won") return whiteOut();
    state.money += 150;
    await say("Rook: Hmph. Beginner's luck! I'm off to win some badges. Smell ya... never mind.");
  } else {
    await say("Rook: You made it this far? I've trained my whole team for this!");
    const result = await battle([makeBeast(13, 32), makeBeast(30, 32), makeBeast(46, 33), makeBeast(his + 2, 35)], { trainer: "Rival Rook" });
    if (result !== "won") return whiteOut();
    state.flags.rival2 = true;
    state.money += 1000;
    await say("Rook: ...You really are good. Go on. Beat the Champion for both of us.");
  }
}
// ----- What happens inside the buildings -----
async function lab() {
  if (state.party.length) {
    const got = caught();
    return say("Prof. Maple: You have caught " + got + " of the " + TOTAL + " kinds of Beastling. " + (got >= TOTAL ? "Every single one! Incredible!" : got >= 40 ? "What a collection!" : got >= 15 ? "You're doing well!" : "Keep looking in the tall grass!"));
  }
  await say("Prof. Maple: Ah, there you are! Welcome to the world of BEASTLINGS!");
  await say("People and Beastlings live side by side here in Kova. Today you get your very first one!");
  const firsts = [1, 4, 7];
  for (;;) {
    const pick = await choose(firsts.map((id) => DEX[id].name), { x: 4, y: 4, w: 88, cancel: false, onDraw: function (n) {
      box(96, 4, 60, 76);
      ctx.drawImage(pictureOf(firsts[n]), 98, 6);
      words(KIND[DEX[firsts[n]].kinds[0]], 104, 66, blend(KIND_COLOUR[DEX[firsts[n]].kinds[0]], "#000000", 0.35));
    } });
    await say("So you want " + DEX[firsts[pick]].name + ", the " + KIND[DEX[firsts[pick]].kinds[0]] + " Beastling?");
    if ((await choose(["YES", "NO"], { x: 112, y: 60, cancel: false })) !== 0) continue;
    state.party.push(makeBeast(firsts[pick], 5));
    state.flags.starter = firsts[pick];
    mark(firsts[pick], 2);
    sfx.win();
    await say("You got " + DEX[firsts[pick]].name + "!");
    await say("Prof. Maple: Take these 5 Snare Orbs too. Head north up Route 1 to Fernside City, and win your first gym badge!");
    return;
  }
}
async function shop() {
  await say("Shopkeeper: Welcome! What would you like?");
  const stock = state.badges.length >= 2 ? ["orb", "great", "potion", "super"] : ["orb", "potion"];
  for (;;) {
    const pick = await choose(stock.map((item) => ITEMS[item].name.padEnd(13) + "$" + ITEMS[item].price).concat(["Leave"]), { x: 0, y: 0, w: 160, onDraw: () => { box(64, 80, 96, 16); words("$" + state.money, 72, 85); } });
    if (pick < 0 || pick === stock.length) return say("Shopkeeper: Come again!");
    const item = ITEMS[stock[pick]];
    if (state.money < item.price) {
      await say("You don't have enough money for that.");
      continue;
    }
    state.money -= item.price;
    state.bag[stock[pick]]++;
    await say("You bought a " + item.name + ". (You have " + state.bag[stock[pick]] + ".)");
  }
}
async function gym(door) {
  if (state.badges.includes(door.n)) return say(door.leader + ": You already have the " + door.badge + ". Keep training!");
  if (!state.party.length) return say("The gym is closed to people without a Beastling.");
  await say(door.before);
  const result = await battle(door.team.map(([id, lv]) => makeBeast(id, lv)), { trainer: door.leader });
  if (result !== "won") return whiteOut();
  state.badges.push(door.n);
  state.money += 400 + door.n * 300;
  sfx.win();
  await say(door.after);
  await say("You got the " + door.badge + "! That's " + state.badges.length + " of 5 badges.");
}
async function hall() {
  await say("Aurelia: So, a new challenger has climbed all the way to Champion's Rise.");
  await say("Aurelia: I am the Champion of Kova. Show me everything you and your Beastlings have learned!");
  const result = await battle([[14, 38], [31, 39], [36, 40], [47, 40], [59, 42]].map(([id, lv]) => makeBeast(id, lv)), { trainer: "Champion Aurelia" });
  if (result !== "won") return whiteOut();
  state.flags.champion = true;
  state.money += 5000;
  healAll();
  sfx.win();
  await say("Aurelia: Magnificent! You and your team fight as one.");
  await say("Aurelia: From today, YOU are the Champion of Kova! Congratulations!");
  await say("THE END... or is it? They say something has woken in the glade south of Pebble Town.");
}

// ----- Designing your character -----
function designLook() {
  return show({ kind: "page", index: 0, update: function (page, go) {
    const part = LOOK_ROWS[page.index][0], many = LOOK_PARTS[part].length;
    if (tapped.down) page.index = (page.index + 1) % LOOK_ROWS.length;
    if (tapped.up) page.index = (page.index + LOOK_ROWS.length - 1) % LOOK_ROWS.length;
    if (tapped.right) state.look[part] = (state.look[part] + 1) % many;
    if (tapped.left) state.look[part] = (state.look[part] + many - 1) % many;
    if (tapped.down || tapped.up || tapped.left || tapped.right) sfx.tick();
    if (go) {
      sfx.ok();
      close(page);
    }
  }, draw: function (page) {
    box(0, 0, 160, 144);
    words("YOUR LOOK", 44, 6, BLUE);
    LOOK_ROWS.forEach(function ([part, label], n) {
      const y = 19 + n * 11, value = LOOK_PARTS[part][state.look[part]];
      words(label, 14, y);
      if (n === page.index) arrow(6, y);
      if (value[0] === "#") {
        ctx.fillStyle = INK;
        ctx.fillRect(98, y - 1, 44, 9);
        ctx.fillStyle = value;
        ctx.fillRect(99, y, 42, 7);
      } else words(value, 98, y, BLUE);
      if (n === page.index) { words("<", 88, y, "#e03838"); words(">", 146, y, "#e03838"); }
    });
    // Show yourself from all four sides, walking on the spot
    ctx.fillStyle = "#90d860";
    ctx.fillRect(6, 98, 148, 40);
    const art = personArt(state.look), step = Math.floor(time * 4) % 2;
    [0, 1, 3, 2].forEach((dir, n) => ctx.drawImage(art[dir][step], 14 + n * 35, 102, 32, 32));
  } });
}

// ----- The menu (Enter) -----
async function startMenu() {
  let pick = 0;
  for (;;) {
    pick = await choose(["BEASTS", "DEX", "BAG", "LOOK", "SAVE", "CLOSE"], { x: 88, y: 0, w: 72, index: pick, onDraw: () => { box(0, 0, 88, 40); words("$" + state.money, 8, 8); words("Badges " + state.badges.length, 8, 18); words("Got " + caught() + "/" + TOTAL, 8, 28); } });
    if (pick < 0 || pick === 5) return;
    if (pick === 3) await designLook();
    if (pick === 0) {
      if (!state.party.length) { await say("You don't have a Beastling yet."); continue; }
      const n = await pickBeast("Your team");
      if (n < 0) continue;
      const what = await choose(["SUMMARY", "MAKE FIRST", "BACK"], { x: 64, y: 96, w: 96 });
      if (what === 0) await show({ kind: "page", mon: state.party[n], update: (page, go) => { if (go || tapped.b) close(page); }, draw: drawSummary });
      if (what === 1) state.party.unshift(state.party.splice(n, 1)[0]);
    }
    if (pick === 1) await show({ kind: "page", index: 0, update: updateDex, draw: drawDex });
    if (pick === 2) {
      const item = await pickItem();
      if (item && ITEMS[item].heals) await usePotion(item);
      else if (item) await say("You can only use that in a battle.");
    }
    if (pick === 4) {
      save();
      await say("Game saved!");
    }
  }
}
async function pickItem() {
  const have = Object.keys(ITEMS).filter((item) => state.bag[item] > 0);
  if (!have.length) {
    await say("Your bag is empty.");
    return null;
  }
  const pick = await choose(have.map((item) => ITEMS[item].name.padEnd(13) + "x" + state.bag[item]), { x: 0, y: 0, w: 160 });
  return pick < 0 ? null : have[pick];
}
async function usePotion(item) {
  const n = await pickBeast("Use on which one?");
  if (n < 0) return false;
  const mon = state.party[n];
  if (mon.hp <= 0 || mon.hp >= stat(mon, "hp")) {
    await say(mon.hp <= 0 ? "It has fainted. A potion won't help." : "It is already at full health.");
    return false;
  }
  state.bag[item]--;
  mon.hp = Math.min(stat(mon, "hp"), mon.hp + ITEMS[item].heals);
  sfx.heal();
  await say(nameOf(mon) + " feels better!");
  return true;
}
// Choosing one of your team: a full-screen list
function pickBeast(title, mustPick) {
  return show({ kind: "page", title: title, index: mustPick ? Math.max(0, state.party.findIndex((mon) => mon.hp > 0)) : 0, update: function (page, go) {
    if (tapped.down) page.index = (page.index + 1) % state.party.length;
    if (tapped.up) page.index = (page.index + state.party.length - 1) % state.party.length;
    if (tapped.down || tapped.up) sfx.tick();
    if (go) close(page, page.index);
    else if (tapped.b && !mustPick) close(page, -1);
  }, draw: function (page) {
    box(0, 0, 160, 144);
    words(page.title, 8, 7);
    state.party.forEach(function (mon, n) {
      const y = 20 + n * 20;
      ctx.drawImage(pictureOf(mon.id), 10, y - 2, 18, 18);
      words(nameOf(mon), 32, y);
      words("L" + mon.lv, 124, y);
      bar(mon, 32, y + 11, 56);
      words(mon.hp + "/" + stat(mon, "hp"), 94, y + 9);
      if (n === page.index) arrow(4, y);
    });
  } });
}
function drawSummary(page) {
  const mon = page.mon, d = DEX[mon.id];
  box(0, 0, 160, 144);
  ctx.drawImage(pictureOf(mon.id), 6, 6);
  words(d.name, 68, 8);
  words("No." + String(mon.id).padStart(3, "0") + " L" + mon.lv, 68, 20);
  words(d.kinds.map((kind) => KIND[kind]).join("/"), 68, 32);
  words("HP " + mon.hp + "/" + stat(mon, "hp"), 68, 44);
  words("ATK " + stat(mon, "atk") + " DEF " + stat(mon, "def"), 8, 66);
  words("SPD " + stat(mon, "spd"), 8, 77);
  words("Next level: " + Math.max(0, xpFor(mon.lv + 1) - mon.xp), 8, 88);
  movesOf(mon).forEach((move, n) => words(move.padEnd(13) + KIND[MOVES[move][0]].slice(0, 5), 8, 102 + n * 10));
}
function updateDex(page, go) {
  if (tapped.down) page.index = Math.min(TOTAL - 1, page.index + 1);
  if (tapped.up) page.index = Math.max(0, page.index - 1);
  if (tapped.right) page.index = Math.min(TOTAL - 1, page.index + 8);
  if (tapped.left) page.index = Math.max(0, page.index - 8);
  if (go || tapped.b) close(page);
}
function drawDex(page) {
  box(0, 0, 160, 144);
  const top = Math.max(0, Math.min(TOTAL - 9, page.index - 4));
  for (let n = top; n < top + 9; n++) {
    const id = n + 1, how = state.dex[id] || 0;
    words(String(id).padStart(3, "0") + (how === 2 ? "*" : " ") + (how ? DEX[id].name : "------"), 14, 8 + (n - top) * 11);
    if (n === page.index) arrow(6, 8 + (n - top) * 11);
  }
  const id = page.index + 1;
  if (state.dex[id]) ctx.drawImage(pictureOf(id), 114, 100, 40, 40);
  else words("?", 130, 116);
  words("Seen " + Object.keys(state.dex).length + " Got " + caught(), 8, 110);
  words(state.dex[id] ? DEX[id].kinds.map((kind) => KIND[kind]).join("/") : "* = caught", 8, 124);
}

// ----- Battles -----
let B = null;          // the battle going on, if there is one
const boost = (steps) => (steps >= 0 ? (2 + steps) / 2 : 2 / (2 - steps));
async function battle(foes, opt) {
  B = { foes: foes.slice(), foe: foes[0], mine: state.party.find((mon) => mon.hp > 0), opt: opt, up: { mine: { atk: 0, def: 0 }, foe: { atk: 0, def: 0 } }, hideFoe: false, hideMine: true, blink: "", lunge: "", age: 0 };
  const short = opt.trainer ? opt.trainer.split(" ").pop() : "";
  mark(B.foe.id, 1);
  sfx.wild();
  await say(opt.trainer ? opt.trainer + " wants to battle!" : (opt.myth ? "The mythical " : opt.legend ? "The legendary " : "A wild ") + nameOf(B.foe) + " appeared!");
  if (opt.trainer) await say(short + " sent out " + nameOf(B.foe) + "!");
  B.hideMine = false;
  await say("Go! " + nameOf(B.mine) + "!");
  let result = "";
  while (!result) {
    const act = await battleMenu();
    if (!act) continue;
    let myMove = null;
    if (act.run) {
      if (opt.trainer) { await say("You can't run from a trainer battle!"); continue; }
      if (Math.random() < 0.85 || stat(B.mine, "spd") > stat(B.foe, "spd")) { await say("You got away safely!"); result = "ran"; break; }
      await say("You couldn't get away!");
    } else if (act.item) {
      const used = ITEMS[act.item].heals ? await usePotion(act.item) : await throwOrb(act.item);
      if (used === "caught") { result = "caught"; break; }
      if (!used) continue;
    } else if (act.swap != null) {
      B.mine = state.party[act.swap];
      B.up.mine = { atk: 0, def: 0 };
      await say("Go! " + nameOf(B.mine) + "!");
    } else myMove = act.move;
    const moves = movesOf(B.foe), hurting = moves.filter((move) => MOVES[move][1] > 0);
    const foeMove = Math.random() < 0.8 ? hurting[Math.floor(Math.random() * hurting.length)] : moves[Math.floor(Math.random() * moves.length)];
    const order = !myMove ? ["foe"] : stat(B.mine, "spd") >= stat(B.foe, "spd") ? ["mine", "foe"] : ["foe", "mine"];
    for (const who of order) if (B.mine.hp > 0 && B.foe.hp > 0) await attack(who, who === "mine" ? myMove : foeMove);
    if (B.foe.hp <= 0) {
      await foeDown();
      B.foes.shift();
      if (!B.foes.length) { result = "won"; break; }
      B.foe = B.foes[0];
      B.up.foe = { atk: 0, def: 0 };
      B.hideFoe = false;
      mark(B.foe.id, 1);
      await say(short + " sent out " + nameOf(B.foe) + "!");
    }
    if (B.mine.hp <= 0) {
      await say(nameOf(B.mine) + " fainted!");
      if (!state.party.some((mon) => mon.hp > 0)) { result = "lost"; break; }
      let n = -1;
      while (n < 0 || state.party[n].hp <= 0) n = await pickBeast("Send out which one?", true);
      B.mine = state.party[n];
      B.up.mine = { atk: 0, def: 0 };
      await say("Go! " + nameOf(B.mine) + "!");
    }
  }
  B = null;
  return result;
}
async function battleMenu() {
  const pick = await choose(["FIGHT", "BAG", "BEAST", "RUN"], { x: 48, y: 96, w: 112, h: 48, cols: 2, gap: 16, cancel: false });
  if (pick === 0) {
    const moves = movesOf(B.mine);
    const n = await choose(moves.map((move) => move.padEnd(13) + KIND[MOVES[move][0]].slice(0, 5)), { x: 0, y: 92, w: 160, h: 52, tight: true });
    return n < 0 ? null : { move: moves[n] };
  }
  if (pick === 1) {
    const item = await pickItem();
    return item ? { item: item } : null;
  }
  if (pick === 2) {
    const n = await pickBeast("Swap to which one?");
    if (n < 0) return null;
    if (state.party[n] === B.mine || state.party[n].hp <= 0) {
      await say(state.party[n] === B.mine ? "It is already battling!" : "It has fainted and can't battle.");
      return null;
    }
    return { swap: n };
  }
  return { run: true };
}
async function attack(who, move) {
  const other = who === "mine" ? "foe" : "mine", me = B[who], them = B[other];
  const [kind, power, sure, special] = MOVES[move];
  await say((who === "foe" ? (B.opt.trainer ? "Foe " : "Wild ") : "") + nameOf(me) + " used " + move + "!");
  if (Math.random() * 100 >= sure) return say("But it missed!");
  if (special === "atk-") {
    B.up[other].atk = Math.max(-6, B.up[other].atk - 1);
    return say(nameOf(them) + "'s attack fell!");
  }
  if (special === "def+") {
    B.up[who].def = Math.min(6, B.up[who].def + 1);
    return say(nameOf(me) + "'s defence rose!");
  }
  if (special === "heal") {
    me.hp = Math.min(stat(me, "hp"), me.hp + Math.ceil(stat(me, "hp") / 2));
    sfx.heal();
    await wait(0.5);
    return say(nameOf(me) + " soaked up the sun and got its health back!");
  }
  const lucky = Math.random() < 1 / 16, strong = effect(kind, them), same = DEX[me.id].kinds.includes(kind) ? 1.5 : 1;
  const push = stat(me, "atk") * boost(B.up[who].atk), block = stat(them, "def") * boost(B.up[other].def);
  const damage = Math.max(1, Math.floor((Math.floor((Math.floor((2 * me.lv) / 5 + 2) * power * push) / block / 50) + 2) * same * strong * (lucky ? 1.5 : 1) * (0.85 + Math.random() * 0.15)));
  B.lunge = who;                  // the attacker jumps forward...
  await wait(0.14);
  B.lunge = "";
  B.blink = other;                // ...and the other one flashes
  sfx.hit();
  await wait(0.35);
  B.blink = "";
  them.hp = Math.max(0, them.hp - damage);
  await wait(0.5);
  if (lucky) await say("A critical hit!");
  if (strong > 1) await say("It's super effective!");
  if (strong < 1) await say("It's not very effective...");
}
async function foeDown() {
  const mine = B.mine, foe = B.foe;
  B.hideFoe = true;
  await say((B.opt.trainer ? "Foe " : "Wild ") + nameOf(foe) + " fainted!");
  const gain = Math.floor(((DEX[foe.id].xp * foe.lv) / 5) * (B.opt.trainer ? 1.5 : 1));
  mine.xp += gain;
  await say(nameOf(mine) + " gained " + gain + " EXP!");
  while (mine.lv < 99 && mine.xp >= xpFor(mine.lv + 1)) {
    const knew = movesOf(mine), full = stat(mine, "hp");
    mine.lv++;
    mine.hp += stat(mine, "hp") - full;
    sfx.ok();
    await say(nameOf(mine) + " grew to level " + mine.lv + "!");
    for (const move of movesOf(mine)) if (!knew.includes(move)) await say(nameOf(mine) + " learned " + move + "!");
    if (DEX[mine.id].evolve && mine.lv >= DEX[mine.id].evolve) {
      const old = nameOf(mine), before = stat(mine, "hp"), had = movesOf(mine);
      await say("What? " + old + " is evolving!");
      for (let n = 0; n < 6; n++) {
        B.hideMine = !B.hideMine;
        await wait(0.18);
      }
      mine.id++;
      B.hideMine = false;
      mine.hp += stat(mine, "hp") - before;
      mark(mine.id, 2);
      sfx.win();
      await say(old + " evolved into " + nameOf(mine) + "!");
      for (const move of movesOf(mine)) if (!had.includes(move)) await say(nameOf(mine) + " learned " + move + "!");
    }
  }
}
async function throwOrb(item) {
  if (B.opt.trainer) {
    await say("You can't catch another trainer's Beastling!");
    return false;
  }
  const foe = B.foe, full = stat(foe, "hp");
  state.bag[item]--;
  await say("You threw a " + ITEMS[item].name + "!");
  B.hideFoe = true;
  const odds = ((3 * full - 2 * foe.hp) / (3 * full)) * DEX[foe.id].catchRate * ITEMS[item].power;
  for (let n = 0; n < 3; n++) {
    sfx.tick();
    await wait(0.45);
    if (Math.random() > Math.pow(Math.min(1, odds), 1 / 3)) {
      B.hideFoe = false;
      await say("Oh no! " + nameOf(foe) + " broke free!");
      return true;
    }
  }
  mark(foe.id, 2);
  sfx.win();
  await say("Gotcha! " + nameOf(foe) + " was caught!");
  if (state.party.length < 6) state.party.push(foe);
  else {
    state.box.push(foe);
    await say("Your team is full, so " + nameOf(foe) + " was sent to Prof. Maple's lab.");
  }
  return "caught";
}

// ----- Drawing -----
function drawRoom() {
  ctx.drawImage(room.art, 0, 0);
  const who = room.staff;
  const things = [{ x: who.x * TS, y: who.y * TS, img: personArt(who.look)[who.dir][0] }, { x: state.x * TS + Math.round(walker.ox), y: state.y * TS + Math.round(walker.oy), img: personArt(state.look)[state.dir][walker.moving ? (walker.steps + (walker.t > 0.5 ? 1 : 0)) % 2 : 0] }];
  things.sort((a, b) => a.y - b.y);
  for (const thing of things) {
    ctx.fillStyle = "rgba(32,32,58,0.25)";
    ctx.fillRect(thing.x + 3, thing.y + 14, 10, 2);
    ctx.drawImage(thing.img, thing.x, thing.y - 3);
  }
  // (things on the counter are drawn again in front of whoever stands behind it)
  for (let tx = 0; tx < 10; tx++) if (roomTile(tx, who.y + 1) === "C") ctx.drawImage(room.art, tx * TS, (who.y + 1) * TS, TS, TS, tx * TS, (who.y + 1) * TS, TS, TS);
  if (banner.t > 0 && !ui.length) {
    box(0, 0, banner.text.length * 8 + 16, 18);
    words(banner.text, 8, 5);
  }
}
function drawWorld() {
  if (room) return drawRoom();
  const cx = state.x * TS + Math.round(walker.ox) - 72, cy = state.y * TS + Math.round(walker.oy) - 64;
  const tx0 = Math.floor(cx / TS), ty0 = Math.floor(cy / TS);
  for (let ty = ty0; ty <= ty0 + 9; ty++) for (let tx = tx0; tx <= tx0 + 10; tx++) {
    const art = TILE_ART[themeAt(tx, ty)][tile(tx, ty)];
    ctx.drawImage(Array.isArray(art) ? art[Math.floor(time * 2 + (tx + ty) * 0.5) % 2] : art, tx * TS - cx, ty * TS - cy);
  }
  for (const b of buildings) if (b.x <= tx0 + 10 && b.x + b.w >= tx0 && b.y <= ty0 + 9 && b.y + b.h >= ty0) ctx.drawImage(b.img, b.x * TS - cx, b.y * TS - cy);
  const things = [];
  for (const spot in gates) {
    const [x, y] = spot.split(",").map(Number);
    if (gateShut(x, y)) things.push({ x: x * TS, y: y * TS, img: personArt(NPC_LOOKS[7])[0][0] });
  }
  for (const who of people) things.push({ x: who.x * TS, y: who.y * TS, img: personArt(NPC_LOOKS[who.look])[who.dir][0] });
  for (const who of trainers) {
    const px = who.x * TS + (who.walk ? who.walk.dx * who.walk.t * TS : 0), py = who.y * TS + (who.walk ? who.walk.dy * who.walk.t * TS : 0);
    things.push({ x: px, y: py, img: personArt(NPC_LOOKS[who.look])[who.dir][who.walk ? Math.floor(who.walk.t * 2) % 2 : 0], alert: who.alert });
  }
  for (const legend of legends) if (legendHere(legend)) things.push({ x: legend.x * TS - 4, y: legend.y * TS - 9 + Math.round(Math.sin(time * 3) * 1.5), img: pictureOf(legend.id), size: 24 });
  things.push({ x: state.x * TS + Math.round(walker.ox), y: state.y * TS + Math.round(walker.oy), img: personArt(state.look)[state.dir][walker.moving ? (walker.steps + (walker.t > 0.5 ? 1 : 0)) % 2 : 0], me: true });
  things.sort((a, b) => a.y - b.y);
  for (const thing of things) {
    ctx.fillStyle = "rgba(32,32,58,0.25)";             // a little shadow under everyone
    ctx.fillRect(Math.round(thing.x - cx) + (thing.size ? 6 : 3), Math.round(thing.y - cy) + (thing.size ? 22 : 14), thing.size ? 12 : 10, 2);
    if (thing.size) ctx.drawImage(thing.img, Math.round(thing.x - cx), Math.round(thing.y - cy), thing.size, thing.size);
    else ctx.drawImage(thing.img, Math.round(thing.x - cx), Math.round(thing.y - cy));
    if (thing.me && !walker.moving && tile(state.x, state.y) === TALL) ctx.drawImage(TILE_ART[themeAt(state.x, state.y)][TALL], 0, 9, 16, 7, 72, 73, 16, 7);       // tall grass hides your feet
    if (thing.alert) { box(Math.round(thing.x - cx) + 2, Math.round(thing.y - cy) - 14, 12, 14); words("!", Math.round(thing.x - cx) + 5, Math.round(thing.y - cy) - 11); }
  }
  if (banner.t > 0 && !ui.length) {
    box(0, 0, banner.text.length * 8 + 16, 18);
    words(banner.text, 8, 5);
  }
}
function drawBattle() {
  // The battle takes the colours of wherever you are: the land outside, the cave, or the room you are in
  const theme = room ? { ground: room.colours.floor2, mark: room.colours.trim } : THEMES[themeAt(state.x, state.y)], cave = !room && tile(state.x, state.y) === CAVE;
  ctx.fillStyle = cave ? "#d8d0e8" : room ? room.colours.wall : PAPER;
  ctx.fillRect(0, 0, 160, 144);
  ctx.fillStyle = cave ? "#b8aed0" : room ? room.colours.floor : blend(theme.ground, "#ffffff", 0.55);
  ctx.fillRect(0, 44, 160, 52);
  const slide = Math.max(0, 1 - B.age / 0.45);        // both sides slide in at the start
  const stand = function (x, y, wide) {                // the patch of ground a Beastling stands on
    ctx.fillStyle = cave ? "#8a80a0" : theme.ground;
    ctx.beginPath();
    ctx.ellipse(x, y, wide, wide / 4.5, 0, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = cave ? "#6a6088" : theme.mark;
    ctx.beginPath();
    ctx.ellipse(x, y + 1.5, wide - 5, wide / 6.5, 0, 0, 3.1416);
    ctx.fill();
  };
  stand(126 - slide * 170, 51, 30);
  stand(38 + slide * 170, 93, 38);
  const flicker = Math.floor(time * 14) % 2;
  if (!B.hideFoe && !(B.blink === "foe" && flicker)) ctx.drawImage(pictureOf(B.foe.id), Math.round(98 - slide * 170 - (B.lunge === "foe" ? 7 : 0)), B.lunge === "foe" ? 5 : 0);
  words(nameOf(B.foe), 8, 4);
  words("L" + B.foe.lv, 8, 15);
  bar(B.foe, 36, 17, 52);
  ctx.fillStyle = INK;
  ctx.fillRect(6, 26, 84, 1);
  ctx.fillRect(6, 13, 1, 13);
  if (!B.hideMine && !(B.blink === "mine" && flicker)) {
    ctx.save();
    ctx.translate(Math.round(68 + slide * 170 + (B.lunge === "mine" ? 7 : 0)), B.lunge === "mine" ? 35 : 40);
    ctx.scale(-1, 1);
    ctx.drawImage(pictureOf(B.mine.id), 0, 0);
    ctx.restore();
  }
  words(nameOf(B.mine), 76, 60);
  words("L" + B.mine.lv, 76, 71);
  bar(B.mine, 104, 73, 52);
  words(Math.ceil(shownHp(B.mine)) + "/" + stat(B.mine, "hp"), 96, 81);
  ctx.fillStyle = INK;
  ctx.fillRect(72, 91, 84, 1);
  ctx.fillRect(155, 78, 1, 13);
  box(0, 96, 160, 48);
}

function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  time += dt;
  if (banner.t > 0) banner.t -= dt;
  if (B) B.age += dt;
  for (const timer of timers.slice()) if ((timer.t -= dt) <= 0) {
    timers.splice(timers.indexOf(timer), 1);
    timer.done();
  }
  for (const who of trainers) if (who.walk && (who.walk.t += dt / 0.2) >= 1) {
    const walk = who.walk;
    who.x += walk.dx;
    who.y += walk.dy;
    who.walk = null;
    walk.done();
  }
  for (const [mon, shown] of sliding) {
    const speed = stat(mon, "hp") * dt * 1.6;
    sliding.set(mon, Math.abs(shown - mon.hp) <= speed ? mon.hp : shown + Math.sign(mon.hp - shown) * speed);
  }
  if (started) {
    if (ui.length) updateUi(dt);
    else if (!busy) updateWorld(dt);
  }
  if (B) drawBattle();
  else drawWorld();
  drawUi();
  for (const button in tapped) tapped[button] = false;
  requestAnimationFrame(frame);
}
let last = performance.now();
for (const who of trainers) Object.assign(who, { homeX: who.x, homeY: who.y });
function begin(saved) {
  state = saved ? Object.assign(newState(), saved) : newState();
  el("intro").hidden = true;
  started = true;
  room = state.room ? buildRoom(state.room) : null;
  if (!room) state.room = null;
  placeNow = room ? "" : (areaAt(state.x, state.y) || {}).name || "";
  if (!saved) run(async function () {
    await say("Welcome! First, what do you look like? Use the arrows, then press Z.");
    await designLook();
    await say("You wake up in Pebble Town, a quiet corner of the Kova region.");
    await say("Today is the day! Prof. Maple is waiting in her lab, the big building marked L. Go inside and talk to her.");
  });
}
el("start").addEventListener("click", () => begin(null));
el("continue").addEventListener("click", () => begin(loadSave()));
el("continue").hidden = !loadSave();
if (document.fonts && document.fonts.load) document.fonts.load("8px \"Press Start 2P\"");
requestAnimationFrame(frame);

// Only for testing the game.
window.BQ = {
  get state() { return state; },
  get battle() { return B; },
  get busy() { return busy; },
  get room() { return room; },
  ui: ui, TEST: TEST, trainers: trainers, legends: legends, doors: doors, gates: gates, tile: tile, canWalk: canWalk, makeBeast: makeBeast, healAll: healAll,
};
