// Wildlings: Thunder Ride. The game itself: riding, walking, catching, battles, the story and the words on screen.
// (The pictures are in art.js, the map is in world.js, and view3d.js shows the world in 3D.)

const el = (id) => document.getElementById(id);
const canvas = el("game");
const ctx = canvas.getContext("2d");
const VW = 960, VH = 640;
const rnd = (a, b) => a + Math.random() * (b - a);
const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const turnTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));        // the shortest way round from one angle to another

function beep(make) {
  try { make(); } catch (error) { /* no sound: the game still works */ }
}
const sfx = {
  hit: () => beep(() => playTone(0, 0.1, 260, 110, 0.16)),
  zap: () => beep(() => playTone(0, 0.12, 900, 1500, 0.07)),
  warn: () => beep(() => playTone(0, 0.08, 700, 500, 0.05)),
  boom: () => beep(() => { playNoise(0, 0.35, 700, 120, 0.22); playTone(0, 0.3, 160, 60, 0.16); }),
  orb: () => beep(() => { playTone(0, 0.1, 500, 900, 0.1); playTone(0.15, 0.1, 500, 900, 0.1); }),
  good: () => beep(() => { playTone(0, 0.12, 880, 1320, 0.14); playTone(0.12, 0.18, 1320, 1760, 0.12); }),
  alert: () => beep(() => { playTone(0, 0.1, 300, 600, 0.12); playTone(0.1, 0.1, 300, 600, 0.12); playTone(0.2, 0.2, 400, 900, 0.12); }),
  rev: () => beep(() => { playTone(0, 0.25, 90, 240, 0.12); playNoise(0, 0.25, 300, 900, 0.06); }),
  over: () => beep(() => { playTone(0, 0.6, 160, 1400, 0.16); playNoise(0, 0.6, 600, 3000, 0.1); }),
  bump: () => beep(() => playTone(0, 0.08, 140, 90, 0.1)),
  talk: () => beep(() => playTone(0, 0.04, 620, 620, 0.04)),
  win: () => beep(() => playJingle()),
};

// ----- What the game remembers -----
const SAVE_NAME = "thunderRideSave";
const fresh = () => ({ owned: { 26: newCreature(VOLTREV, 5) }, team: [VOLTREV], active: 0, dex: { 26: 2 }, orbs: 12, story: 0, core: false, beaten: {}, crates: {}, pit: 0, x: START.x, y: START.y });
let state = fresh();
function save() {
  state.x = me.x;
  state.y = me.y;
  try { localStorage.setItem(SAVE_NAME, JSON.stringify(state)); } catch (error) { /* keep playing */ }
}
function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_NAME));
    return saved && saved.owned && saved.owned[26] ? saved : null;
  } catch (error) { return null; }
}
const lead = () => state.owned[state.team[state.active]];        // the Wildling that battles for you
const voltrev = () => state.owned[VOLTREV];
const caught = () => Object.values(state.dex).filter((mark) => mark === 2).length;
const see = (id, got) => (state.dex[id] = Math.max(state.dex[id] || 0, got ? 2 : 1));
function healAll() {
  for (const id in state.owned) state.owned[id].hp = maxHp(state.owned[id]);
}

// ----- Everything that moves -----
const me = { x: START.x, y: START.y, a: 0, v: 0, riding: true, flip: false, step: 0, moving: false, boost: 100, spin: 0, dx: 1, dy: 0 };
const pal = { x: START.x, y: START.y, a: 0, hop: 0, flash: 0, dash: null, charge: null, flip: false };       // where your battling Wildling is, when you are on foot
let camTurn = 0;                // which way the camera faces (an angle on the map: 0 is east, and it grows clockwise)
let steerNow = 0;            // how hard you are steering the bike (so it can lean)
let foes = [], shots = [], floats = [], marks = [], bits = [];
let fight = null;            // a battle with one of the Rust Riders
let cool = [0, 0, 0];        // how long until each attack is ready again
let meter = 0, over = 0;     // the Overdrive meter (0 to 100), and seconds of Overdrive left
let time = 0, mode = "title", pick = 0, banner = { text: "", t: 0 }, placeNow = -1, spawnWait = 0, hint = 0;
let talk = null;             // the conversation on screen, if there is one

// ----- Keys -----
const keys = {}, tapped = {};
document.addEventListener("keydown", function (event) {
  if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
  if (!keys[event.code]) tapped[event.code] = true;
  keys[event.code] = true;
});
document.addEventListener("keyup", (event) => (keys[event.code] = false));
canvas.addEventListener("mousedown", function () {
  try { if (!document.pointerLockElement) canvas.requestPointerLock(); } catch (error) { /* the arrow keys still turn the view */ }
});
document.addEventListener("mousemove", function (event) {
  if (document.pointerLockElement === canvas && mode === "play" && !me.riding && !talk) camTurn += event.movementX * 0.004;
});
const hit = (...codes) => codes.some((code) => tapped[code]);
const holdX = () => (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
const holdY = () => (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
let toastText = "", toastTime = 0;
function toast(text, seconds) {
  toastText = text;
  toastTime = seconds || 3;
}
// Start a conversation: a list of [who, what they say]. "then" runs when it is finished.
function say(lines, then) {
  talk = { lines: lines, i: 0, shown: 0, then: then };
}
function burst(x, y, colours, count, speed) {
  for (let i = 0; i < count && bits.length < 500; i++) {
    const a = Math.random() * 6.283, push = speed * (0.3 + Math.random() * 0.7);
    bits.push({ x: x, y: y, vx: Math.cos(a) * push, vy: Math.sin(a) * push, life: 0.3 + Math.random() * 0.5, colour: colours[Math.floor(Math.random() * colours.length)], size: 3 + Math.random() * 4 });
  }
}
const float = (x, y, text, colour) => floats.push({ x: x, y: y, text: text, colour: colour || "#ffffff", life: 1 });

// Can you be here? Not on trees, rocks, water, buildings or mountains, and not through a closed roadblock.
function free(x, y) {
  for (const [ax, ay] of [[-10, -6], [10, -6], [-10, 6], [10, 6]]) if (landAt(x + ax, y + ay) !== OPEN) return false;
  for (const gate of gates) if (state.story < gate.need && Math.hypot(gate.x - x, gate.y - y) < 100) {
    if (hint <= 0) {
      toast(gate.need === 5 ? "This road home is closed until the Rust Riders are beaten for good." : "A Rust Rider roadblock! Beat the captain of " + PLACES[gate.need - 1].name + " to open it.", 4);
      hint = 4;
    }
    return false;
  }
  return true;
}

// ----- The story -----
const TALES = [
  { before: [["Captain Skid", "Well, well. A kid on a talking motorbike. This road belongs to the Rust Riders now!"], ["Captain Skid", "Every Wildling we catch powers the boss's Storm Engine. Yours will do nicely!"]],
    after: [["Captain Skid", "Flattened... by a rookie! Fine. The roadblock's open. But Captain Slick on the coast won't go so easy."]] },
  { before: [["Captain Slick", "You're the one who beat Skid? Cute. The tide's coming in, and you're about to get washed away."]],
    after: [["Captain Slick", "Ugh, I'm soaked! Take this. We pulled it out of the sea and couldn't make it work."], ["", "You got the OVERDRIVE CORE! It hums when Voltrev comes near..."], ["", "When the Overdrive meter is full in a battle, press F. Only Voltrev can do it!"]] },
  { before: [["Captain Burnout", "Welcome to the scrapyard, where little bikes come to get crushed. Let's turn up the heat!"]],
    after: [["Captain Burnout", "Burnt out... again. The boss is up north of the pass, in Neon Bay. He's got something BIG chained to that engine."]] },
  { before: [["Captain Black Ice", "You have ridden a long way to slip up now. Nobody gets past the Icebreaker."]],
    after: [["Captain Black Ice", "...Impressive. The city gates are open. But Vex Throttle has a legendary Wildling. You cannot win."]] },
  { before: [["Vex Throttle", "So you are the little spark who has been knocking over my captains."], ["Vex Throttle", "Behold the Storm Engine! With the legendary Tempestrix chained inside it, I will own every road there is."], ["Vex Throttle", "Hand over that motorbike Wildling, and I might let you walk home."]],
    after: [["Vex Throttle", "No... NO! The engine... it's breaking apart!"], ["", "With a crack of thunder, Tempestrix bursts free and soars away to the north."], ["Vex Throttle", "Fine. FINE! The Rust Riders are finished. Just... keep that thing away from me."], ["", "You did it! Every road is open, and the wild Wildlings are safe."], ["", "They say Tempestrix has landed on Storm Peak, north of Icebreaker Camp. Maybe it would like a friend..."]] },
];
const GOALS = ["Ride east to Windmill Camp and beat Captain Skid.", "Follow the road to Driftwood Camp on the Coral Coast.", "Head north to Scrapyard Camp in Rustrock Canyon.", "Climb to Icebreaker Camp in Frostline Pass.", "Ride into Neon Bay City and stop Vex Throttle!", "Find Tempestrix on Storm Peak, north of Icebreaker Camp."];
function goal() {
  if (state.story < 5) return GANG[state.story];
  return state.owned[TEMPESTRIX] ? null : PEAK;
}

// ----- Wild Wildlings -----
function wildAt(x, y) {
  const here = PLACES[placeAt(x, y)], lv = Math.round(rnd(here.lv[0], here.lv[1]));
  return { c: newCreature(idFor(here.families[Math.floor(Math.random() * 3)], lv), lv), x: x, y: y, vx: 0, vy: 0, wild: true, mood: "calm", think: 0, next: rnd(1, 2), wind: null, flash: 0, gone: 0, flip: false };
}
function spawnAround() {
  for (let tries = 0; tries < 10; tries++) {
    const a = Math.random() * 6.283, away = rnd(620, 900), x = me.x + Math.cos(a) * away, y = me.y + Math.sin(a) * away;
    if (landAt(x, y) !== OPEN || gapAt(x, y) < 1.4 || GANG.some((who) => far(who, { x: x, y: y }) < 240)) continue;
    return foes.push(wildAt(x, y));
  }
}
function addLegend() {
  if (state.story < 5 || state.owned[TEMPESTRIX] || foes.some((foe) => foe.legend)) return;
  foes.push({ c: newCreature(TEMPESTRIX, 34), x: PEAK.x, y: PEAK.y, vx: 0, vy: 0, wild: true, legend: true, mood: "calm", think: 0, next: 2, wind: null, flash: 0, gone: 0, flip: false });
}

// ----- Battles (on foot, in real time) -----
// The foe your Wildling is aiming at: the nearest one that is fighting you
function target() {
  let best = null, near = 380;
  for (const foe of foes) if (foe.gone <= 0 && foe.mood === "fight" && far(foe, pal) < near) {
    near = far(foe, pal);
    best = foe;
  }
  return best;
}
// One Wildling hits another. "to" is a foe, or null for your own Wildling.
function strike(from, to, strength, kind) {
  const victim = to ? to.c : lead();
  if (victim.hp <= 0) return;
  const strong = effect(kind, DEX[victim.id].kind);
  const boost = to && over > 0 && from.id === VOLTREV ? 1.6 : 1;
  const damage = Math.max(1, Math.round((3 + from.lv * 0.6) * (strength / 9) * (power(from) / guard(victim)) * strong * boost * rnd(0.85, 1)));
  victim.hp = Math.max(0, victim.hp - damage);
  const at = to || pal;
  at.flash = 0.3;
  sfx.hit();
  float(at.x, at.y - 60, damage + (strong > 1 ? " SUPER!" : strong < 1 ? " weak" : ""), to ? (strong > 1 ? "#fff27a" : "#ffffff") : "#ff8a8a");
  burst(at.x, at.y - 24, [KIND_COLOUR[Math.max(0, kind)], "#ffffff"], 10, 130);
  if (to) {
    if (over <= 0 && from.id === VOLTREV) meter = Math.min(100, meter + 7 + damage * 0.5);
    if (victim.hp === 0) foeDown(to);
  } else if (victim.hp === 0) palDown();
}
function gainXp(c, amount) {
  c.xp += amount;
  let grew = false;
  while (c.lv < 50 && c.xp >= xpToGrow(c)) {
    c.xp -= xpToGrow(c);
    const before = maxHp(c);
    c.lv++;
    c.hp += maxHp(c) - before;
    grew = true;
  }
  if (!grew) return;
  sfx.good();
  toast(DEX[c.id].name + " grew to level " + c.lv + "!", 3);
  if (c.id < 25 && DEX[c.id].stage === 0 && c.lv >= GROWS_AT) {        // a baby grows up
    const old = c.id, before = maxHp(c);
    c.id++;
    c.hp += maxHp(c) - before;
    delete state.owned[old];
    state.owned[c.id] = c;
    state.team[state.team.indexOf(old)] = c.id;
    see(c.id, true);
    sfx.win();
    burst(pal.x, pal.y - 24, ["#ffffff", "#fff27a", KIND_COLOUR[DEX[c.id].kind]], 50, 200);
    toast("What? " + DEX[old].name + " is changing... It grew into " + DEX[c.id].name + "!", 5);
  }
}
function foeDown(foe) {
  burst(foe.x, foe.y - 24, ["#ffffff", "#c8c0e0"], 24, 150);
  foe.gone = foe.legend ? 40 : 3;
  foe.wind = null;
  marks = marks.filter((mark) => mark.foe !== foe);
  gainXp(lead(), Math.round(foe.c.lv * (foe.legend ? 16 : foe.wild ? 7 : 10)));
  if (fight && fight.actor === foe) {
    fight.actor = null;
    fight.wait = 1;
    foes.splice(foes.indexOf(foe), 1);
  }
}
function palDown() {
  pal.dash = pal.charge = null;
  over = 0;
  const next = state.team.findIndex((id) => state.owned[id].hp > 0);
  if (next >= 0) {
    toast(DEX[lead().id].name + " fainted! Go, " + DEX[state.team[next]].name + "!", 3);
    state.active = next;
    cool = [1, 1, 1];
    return;
  }
  // Nobody left: back to the last pit stop
  if (fight) endFight(false);
  for (const foe of foes) foe.mood = "calm";
  marks = [];
  shots = [];
  Object.assign(me, { x: PITS[state.pit].x, y: PITS[state.pit].y + 30, riding: true, v: 0 });
  healAll();
  state.active = 0;
  toast("All your Wildlings fainted! You wake up at the pit stop, and everyone is fixed up.", 5);
}
function startFight(who) {
  me.riding = false;
  me.v = 0;
  Object.assign(pal, { x: me.x - 30, y: me.y + 10 });
  fight = { who: who, left: who.team.map(([family, lv]) => newCreature(idFor(family, lv), lv)), actor: null, wait: 0.8 };
  if (who.boss) fight.left.push(Object.assign(newCreature(TEMPESTRIX, 33), { big: 1.5, hp: 0 }));
  for (const c of fight.left) c.hp = maxHp(c);
  sfx.alert();
  toast(who.name + " wants to battle!", 3);
}
function endFight(won) {
  const who = fight.who;
  if (fight.actor) foes.splice(foes.indexOf(fight.actor), 1);
  fight = null;
  marks = [];
  if (!won) return;
  sfx.win();
  state.beaten[who.id] = true;
  state.orbs += 2;
  if (who.captain == null) return toast("You beat " + who.name + "! They hand over 2 capture orbs and slink away.", 4);
  healAll();
  say(TALES[who.captain].after, function () {
    state.story = who.captain + 1;
    if (who.captain === 1) state.core = true;
    addLegend();
    banner = { text: who.boss ? "The Rust Riders are beaten!" : "The road ahead is open!", t: 4 };
    save();
  });
}
// Your three attacks
function useMove(n) {
  const aim = target(), c = lead();
  if (!aim || c.hp <= 0 || cool[n] > 0 || pal.dash || pal.charge) return;
  if (n === 2 && c.lv < 8) return toast("Your Wildling learns its big attack at level 8.", 2);
  const quick = over > 0 && c.id === VOLTREV ? 0.6 : 1;
  if (n === 0) {
    if (far(aim, pal) > 300) return float(pal.x, pal.y - 70, "too far!", "#bfe8ff");
    pal.dash = { t: 0, fx: pal.x, fy: pal.y, aim: aim };
    cool[0] = 0.8 * quick;
  } else if (n === 1) {
    const a = Math.atan2(aim.y - pal.y, aim.x - pal.x);
    shots.push({ x: pal.x, y: pal.y - 26, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 1.4, mine: true, aim: aim, from: c, strength: 9, kind: DEX[c.id].kind });
    cool[1] = 2.2 * quick;
    sfx.zap();
  } else {
    pal.charge = { t: 0.5, aim: aim };
    cool[2] = 6.5 * quick;
    sfx.warn();
  }
}
function throwOrb() {
  const riding = me.riding;
  const aim = riding ? foes.filter((foe) => foe.wild && foe.gone <= 0 && far(foe, me) < 330).sort((a, b) => far(a, me) - far(b, me))[0] : target();
  if (!aim) return toast(riding ? "Ride closer to a wild Wildling, then throw!" : "There's nothing to throw at.", 2);
  if (!aim.wild) return toast("You can't catch a Rust Rider's Wildling!", 2);
  if (aim.legend && riding) return toast("Tempestrix is far too strong to catch from the saddle. Hop off (R) and battle it!", 4);
  if (state.orbs <= 0) return toast("No capture orbs left! Look for crates by the road.", 3);
  state.orbs--;
  sfx.orb();
  shots.push({ x: me.x, y: me.y - 40, life: 0.4, total: 0.4, orb: true, aim: aim, fx: me.x, fy: me.y - 40, riding: riding });
}
function orbLands(foe, riding) {
  if (foe.gone > 0) return;
  const hurt = 1 - foe.c.hp / maxHp(foe.c);
  const chance = riding ? clamp(0.45 - (foe.c.lv - voltrev().lv) * 0.035 + (hurt > 0.4 ? 0.3 : 0), 0.06, 0.85) : 0.22 + hurt * 0.72 - (foe.legend ? 0.42 : 0);
  if (Math.random() > chance) {
    burst(foe.x, foe.y - 24, ["#ffffff", "#e0503a"], 12, 120);
    if (riding) Object.assign(foe, { mood: "flee", think: 2.5 });
    return float(foe.x, foe.y - 70, "broke free!", "#ff8a8a");
  }
  const id = foe.c.id;
  foe.gone = 3;
  marks = marks.filter((mark) => mark.foe !== foe);
  sfx.win();
  burst(foe.x, foe.y - 24, ["#ffffff", "#fff27a", "#e0503a"], 40, 180);
  if (state.owned[id]) {
    gainXp(state.owned[id], xpToGrow(state.owned[id]));
    return toast("You already have a " + DEX[id].name + ", so yours trains with the new one and gets stronger!", 4);
  }
  const fresh = state.dex[id] !== 2;
  see(id, true);
  foe.c.hp = Math.max(foe.c.hp, Math.round(maxHp(foe.c) / 2));
  state.owned[id] = foe.c;
  if (state.team.length < 4) state.team.push(id);
  toast("Gotcha! " + DEX[id].name + " was caught!" + (fresh ? " (" + caught() + " of " + TOTAL + ")" : "") + (state.team.includes(id) ? " It joins your team." : " Press X to put it in your team."), 5);
  save();
}
// What a foe does when it is fighting your Wildling
function foeFights(foe, dt) {
  const dx = pal.x - foe.x, dy = pal.y - foe.y, away = Math.hypot(dx, dy) || 1, big = foe.c.big ? 1.5 : foe.legend ? 1.4 : 1;
  foe.flip = dx > 0;
  if (foe.wind) {
    const wind = foe.wind;
    if ((wind.t -= dt) > 0) return;
    foe.wind = null;
    marks = marks.filter((mark) => mark.foe !== foe);
    if (wind.kind === "lunge") {
      Object.assign(foe, { x: wind.x, y: wind.y });
      burst(wind.x, wind.y - 10, ["#ffffff"], 8, 100);
      if (Math.hypot(pal.x - wind.x, pal.y - wind.y) < 40 * big) strike(foe.c, null, 7, -1);
    } else if (wind.kind === "slam") {
      sfx.boom();
      burst(wind.x, wind.y, [KIND_COLOUR[DEX[foe.c.id].kind], "#ffffff"], 50, 260);
      if (Math.hypot(pal.x - wind.x, pal.y - wind.y) < wind.r) strike(foe.c, null, 13, DEX[foe.c.id].kind);
    } else {
      const a = Math.atan2(pal.y - 20 - foe.y, pal.x - foe.x);
      shots.push({ x: foe.x, y: foe.y - 26, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 2, from: foe.c, strength: 9, kind: DEX[foe.c.id].kind });
      sfx.zap();
    }
    return;
  }
  // Keep a little way off, circling
  const want = away > 150 ? 1 : away < 90 ? -1 : 0, speed = 80 + foe.c.lv, side = foe.c.id % 2 ? 1 : -1;
  const mx = (dx / away) * want * speed + (-dy / away) * 30 * side, my = (dy / away) * want * speed + (dx / away) * 30 * side;
  if (landAt(foe.x + mx * dt, foe.y) === OPEN) foe.x += mx * dt;
  if (landAt(foe.x, foe.y + my * dt) === OPEN) foe.y += my * dt;
  if ((foe.next -= dt) > 0 || lead().hp <= 0) return;
  foe.next = rnd(1.5, 2.6) - Math.min(0.6, foe.c.lv * 0.015);
  const roll = Math.random();
  sfx.warn();
  if (foe.c.lv >= 8 && roll < 0.3) {
    foe.wind = { kind: "slam", t: 0.95, total: 0.95, x: pal.x, y: pal.y, r: 74 * big };
    marks.push({ foe: foe, x: pal.x, y: pal.y, r: 74 * big, wind: foe.wind });
  } else if (roll < 0.64 && away < 260) {
    foe.wind = { kind: "lunge", t: 0.6, total: 0.6, x: pal.x, y: pal.y };
    marks.push({ foe: foe, line: true, x: pal.x, y: pal.y, r: 30 * big, wind: foe.wind });
  } else foe.wind = { kind: "blast", t: 0.35, total: 0.35 };
}

// ----- Playing -----
function updatePlay(dt) {
  hint -= dt;
  if (hit("KeyX", "Tab")) return ((mode = "garage"), (pick = state.team[state.active] - 1));
  const here = placeAt(me.x, me.y);
  if (here !== placeNow) {
    placeNow = here;
    banner = { text: PLACES[here].name, t: 3 };
  }
  const battling = !!fight || foes.some((foe) => foe.mood === "fight" && foe.gone <= 0);
  // R: hop on or off Voltrev
  if (hit("KeyR")) {
    if (fight) toast("You can't ride away from a Rust Rider battle!", 2);
    else {
      me.riding = !me.riding;
      me.v = 0;
      if (me.riding) {
        sfx.rev();
        for (const foe of foes) if (foe.mood === "fight") foe.mood = "calm";
        marks = [];
        over = 0;
      } else {
        Object.assign(pal, { x: me.x, y: me.y, dash: null, charge: null });        // you step off to the left, and Voltrev stays where it stopped
        me.x += Math.sin(me.a) * 40;
        me.y -= Math.cos(me.a) * 40;
        if (!free(me.x, me.y)) Object.assign(me, { x: pal.x, y: pal.y });
      }
    }
  }
  const steer = holdX(), gas = -holdY();
  steerNow = me.riding ? steer : 0;
  if (me.riding) {
    // Riding: hold up (or W) to go and down (or S) to brake. Left and right steer. Shift is a boost.
    const boosting = (keys.ShiftLeft || keys.ShiftRight) && me.boost > 0 && gas > 0;
    const top = (gapAt(me.x, me.y) < 1.6 ? 340 : 220) * (boosting ? 1.45 : 1);
    me.v += ((gas > 0 ? top : gas < 0 ? -110 : 0) - me.v) * Math.min(1, dt * (gas ? 2.2 : 1.5));
    me.a += steer * dt * 2.3 * clamp(me.v / 150, -1, 1);
    me.boost = clamp(me.boost + (boosting ? -32 : 13) * dt, 0, 100);
    const nx = me.x + Math.cos(me.a) * me.v * dt, ny = me.y + Math.sin(me.a) * me.v * dt;
    let stuck = 0;
    if (free(nx, me.y)) me.x = nx; else stuck++;
    if (free(me.x, ny)) me.y = ny; else stuck++;
    if (stuck === 2 && Math.abs(me.v) > 120) {
      sfx.bump();
      me.v *= 0.3;
    }
    me.spin += (me.v * dt) / 10;
    me.moving = Math.abs(me.v) > 30;
    Object.assign(me, { dx: Math.cos(me.a), dy: Math.sin(me.a) });
    camTurn += turnTo(camTurn, me.a) * Math.min(1, dt * 4);          // the camera swings round behind the bike
    if (me.v > 200 && Math.random() < dt * 30) bits.push({ x: me.x - Math.cos(me.a) * 30 + rnd(-6, 6), y: me.y - Math.sin(me.a) * 30 - 20 + rnd(-4, 6), vx: -Math.cos(me.a) * 40, vy: -Math.sin(me.a) * 40, life: 0.4, colour: boosting ? "#4ae8ff" : "#ffffff", size: boosting ? 5 : 3 });
    Object.assign(pal, { x: me.x, y: me.y, a: me.a });
  } else {
    // Walking: W (or up) goes the way the camera faces, A and D step sideways, and the left and right arrows turn the view. Shift runs.
    camTurn += ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 2.4 * dt;
    const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), sideways = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    me.moving = ahead !== 0 || sideways !== 0;
    if (me.moving) {
      const dx = Math.cos(camTurn) * ahead - Math.sin(camTurn) * sideways, dy = Math.sin(camTurn) * ahead + Math.cos(camTurn) * sideways, long = Math.hypot(dx, dy), speed = keys.ShiftLeft || keys.ShiftRight ? 215 : 140;
      if (free(me.x + (dx / long) * speed * dt, me.y)) me.x += (dx / long) * speed * dt;
      if (free(me.x, me.y + (dy / long) * speed * dt)) me.y += (dy / long) * speed * dt;
      me.a = Math.atan2(dy, dx);
      me.step += dt * (speed / 20);
      Object.assign(me, { dx: dx / long, dy: dy / long, v: speed });
    } else me.v = 0;
    // Your Wildling follows you, dashes in to attack, and charges up its big move
    const c = lead();
    for (let n = 0; n < 3; n++) cool[n] = Math.max(0, cool[n] - dt);
    if (over > 0 && (over -= dt) <= 0) {
      burst(pal.x, pal.y - 24, ["#ffffff", "#ff7a2a"], 30, 160);
      toast("The Overdrive fades, and Voltrev cools down.", 3);
    }
    if (pal.flash > 0) pal.flash -= dt;
    if (pal.dash) {
      const dash = pal.dash;
      dash.t += dt / 0.16;
      pal.x = dash.fx + (dash.aim.x - dash.fx) * Math.min(1, dash.t) * 0.85;
      pal.y = dash.fy + (dash.aim.y - dash.fy) * Math.min(1, dash.t) * 0.85;
      pal.flip = dash.aim.x > dash.fx;
      if (dash.t >= 1) {
        pal.dash = null;
        if (dash.aim.gone <= 0) strike(c, dash.aim, 6, -1);
      }
    } else {
      // (it keeps to your right-hand side, a little ahead, so it never blocks your view)
      const gx = me.x - Math.sin(camTurn) * 58 + Math.cos(camTurn) * 26, gy = me.y + Math.cos(camTurn) * 58 + Math.sin(camTurn) * 26, gap = Math.hypot(gx - pal.x, gy - pal.y);
      if (gap > 420) Object.assign(pal, { x: gx, y: gy });
      else if (gap > 3) {
        const step = Math.min(gap, (pal.charge ? 60 : 250) * dt);
        pal.x += ((gx - pal.x) / gap) * step;
        pal.y += ((gy - pal.y) / gap) * step;
        pal.hop += dt * 12;
        const aim = target();
        pal.flip = aim ? aim.x > pal.x : gx > pal.x + 1 ? true : gx < pal.x - 1 ? false : pal.flip;
      }
      if (pal.charge && (pal.charge.t -= dt) <= 0) {
        const aim = pal.charge.aim;
        pal.charge = null;
        sfx.boom();
        burst(aim.x, aim.y - 16, [KIND_COLOUR[DEX[c.id].kind], "#ffffff", "#fff27a"], 70, 300);
        for (const foe of foes.slice()) if (foe.gone <= 0 && foe.mood === "fight" && far(foe, aim) < 90) strike(c, foe, 15, DEX[c.id].kind);
      }
    }
    const facing = target();
    pal.a = facing ? Math.atan2(facing.y - pal.y, facing.x - pal.x) : me.a;
    if (hit("Digit1", "KeyJ")) useMove(0);
    if (hit("Digit2", "KeyK")) useMove(1);
    if (hit("Digit3", "KeyL")) useMove(2);
    if (hit("KeyF")) {
      if (!state.core) toast("Voltrev feels there is more power in it somewhere... but not yet.", 3);
      else if (c.id !== VOLTREV) toast("Only Voltrev can go into Overdrive. Swap to it with Q.", 3);
      else if (meter < 100) toast("The Overdrive meter isn't full yet. Land Voltrev's attacks to fill it.", 3);
      else {
        meter = 0;
        over = 14;
        sfx.over();
        burst(pal.x, pal.y - 24, ["#ff7a2a", "#ffffff", "#ff4ad8", "#fff27a"], 90, 320);
        toast("OVERDRIVE! Voltrev blazes with power!", 3);
      }
    }
    if (hit("KeyQ") && !pal.dash && !pal.charge) {
      for (let n = 1; n <= state.team.length; n++) {
        const next = (state.active + n) % state.team.length;
        if (next !== state.active && state.owned[state.team[next]].hp > 0) {
          state.active = next;
          cool = [1, 1, 1];
          over = 0;
          burst(pal.x, pal.y - 24, ["#ffffff", "#bfe8ff"], 16, 140);
          toast("Go, " + DEX[lead().id].name + "!", 2);
          break;
        }
      }
    }
  }
  if (hit("KeyE")) throwOrb();
  // Wild Wildlings: new ones appear as you travel. They run from the bike, but stand and fight if you are on foot.
  if ((spawnWait -= dt) <= 0) {
    spawnWait = 0.3;
    if (foes.filter((foe) => foe.wild && !foe.legend).length < 14) spawnAround();
  }
  for (const foe of foes.slice()) {
    if (foe.gone > 0) {
      if ((foe.gone -= dt) > 0) continue;
      if (foe.legend && !state.owned[TEMPESTRIX]) Object.assign(foe, { x: PEAK.x, y: PEAK.y, mood: "calm", wind: null });
      else foes.splice(foes.indexOf(foe), 1);
      foe.c.hp = maxHp(foe.c);
      continue;
    }
    if (foe.flash > 0) foe.flash -= dt;
    if (!foe.wild) {
      foeFights(foe, dt);
      continue;
    }
    const away = far(foe, me);
    if (away > 1400 && !foe.legend) {
      foes.splice(foes.indexOf(foe), 1);
      continue;
    }
    if (foe.mood === "fight") {
      if (away > 520) {
        foe.mood = "calm";
        foe.wind = null;
        foe.c.hp = maxHp(foe.c);
        marks = marks.filter((mark) => mark.foe !== foe);
      } else foeFights(foe, dt);
      continue;
    }
    if (!me.riding && away < 130 && !fight && lead().hp > 0) {
      foe.mood = "fight";
      see(foe.c.id, false);
      float(foe.x, foe.y - 70, "!", "#ff5a5a");
      sfx.alert();
      continue;
    }
    if (foe.legend) continue;
    if (me.riding && away < 210 && foe.mood !== "flee") {
      Object.assign(foe, { mood: "flee", think: 1.6 });
      see(foe.c.id, false);
    }
    if ((foe.think -= dt) <= 0) {
      foe.mood = "calm";
      foe.think = rnd(1, 3);
      const a = Math.random() * 6.283, speed = Math.random() < 0.35 ? 0 : 34;
      foe.vx = Math.cos(a) * speed;
      foe.vy = Math.sin(a) * speed;
    }
    if (foe.mood === "flee") {
      const a = Math.atan2(foe.y - me.y, foe.x - me.x) + Math.sin(time * 3 + foe.x) * 0.5;
      foe.vx = Math.cos(a) * 170;
      foe.vy = Math.sin(a) * 170;
    }
    if (landAt(foe.x + foe.vx * dt * 6, foe.y) === OPEN) foe.x += foe.vx * dt;
    if (landAt(foe.x, foe.y + foe.vy * dt * 6) === OPEN) foe.y += foe.vy * dt;
    if (Math.abs(foe.vx) > 4) foe.flip = foe.vx > 0;
  }
  // The Rust Riders challenge you when you come close
  for (const who of GANG) {
    if (state.beaten[who.id] || fight || talk || far(who, me) > 150) continue;
    if (who.captain != null && who.captain !== state.story) continue;
    if (who.captain != null) say(TALES[who.captain].before, () => startFight(who));
    else startFight(who);
    me.riding = false;
    me.v = 0;
  }
  if (fight) {
    const who = fight.who;
    if (!fight.actor && (fight.wait -= dt) <= 0) {
      if (!fight.left.length) endFight(true);
      else {
        const next = fight.left.shift();
        fight.actor = { c: next, x: who.x + (me.x < who.x ? -50 : 50), y: who.y + 20, vx: 0, vy: 0, wild: false, mood: "fight", next: rnd(1, 1.6), wind: null, flash: 0, gone: 0, flip: false, legend: next.id === TEMPESTRIX };
        foes.push(fight.actor);
        see(next.id, false);
        burst(fight.actor.x, fight.actor.y - 20, ["#ffffff", "#ff7a7a"], 20, 150);
        toast(who.name + " sends out " + DEX[next.id].name + " (level " + next.lv + ")!", 3);
      }
    }
    if (fight && far(who, me) > 560) {
      endFight(false);
      toast("You went too far away, so the battle is off.", 3);
    }
  }
  // Flying things
  for (const shot of shots) {
    shot.life -= dt;
    if (shot.orb) {
      const part = 1 - shot.life / shot.total;
      shot.x = shot.fx + (shot.aim.x - shot.fx) * part;
      shot.y = shot.fy + (shot.aim.y - 24 - shot.fy) * part - Math.sin(part * Math.PI) * 60;
      if (shot.life <= 0) orbLands(shot.aim, shot.riding);
      continue;
    }
    if (shot.mine && shot.aim.gone <= 0) {        // your shots curve towards their target
      const a = Math.atan2(shot.aim.y - 24 - shot.y, shot.aim.x - shot.x);
      shot.vx += (Math.cos(a) * 420 - shot.vx) * Math.min(1, dt * 18);
      shot.vy += (Math.sin(a) * 420 - shot.vy) * Math.min(1, dt * 18);
    }
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.mine) {
      const struck = foes.find((foe) => foe.gone <= 0 && foe.mood === "fight" && Math.hypot(foe.x - shot.x, foe.y - 24 - shot.y) < 30);
      if (struck) {
        shot.life = 0;
        strike(shot.from, struck, shot.strength, shot.kind);
      }
    } else if (!me.riding && Math.hypot(pal.x - shot.x, pal.y - 24 - shot.y) < 22) {
      shot.life = 0;
      strike(shot.from, null, shot.strength, shot.kind);
    }
  }
  shots = shots.filter((shot) => shot.life > 0);
  // Crates of orbs, pit stops, and talking to Gran
  for (const crate of crates) if (!state.crates[crate.id] && far(crate, me) < 44) {
    state.crates[crate.id] = true;
    state.orbs += 2;
    sfx.good();
    burst(crate.x, crate.y - 10, ["#fff27a", "#ffffff", "#c88a48"], 20, 160);
    float(crate.x, crate.y - 40, "+2 orbs", "#fff27a");
  }
  const pit = PITS.find((p) => far(p, me) < 80), gran = far(GRAN, me) < 90;
  prompt = fight || battling ? "" : pit ? "Space: pit stop (heals your team)" : gran ? "Space: talk to Gran Torque" : "";
  if (hit("Space", "Enter") && prompt) {
    if (pit) {
      healAll();
      state.pit = PITS.indexOf(pit);
      sfx.good();
      toast("Oil change, fresh tyres and a snack. Your whole team is healed!", 3);
      save();
    } else say([["Gran Torque", state.story >= 5 ? "You did it, kiddo! The roads are free again. I knew that bike picked the right rider." : "The Rust Riders went east along the road. " + GOALS[state.story]], ["Gran Torque", "Remember: wild Wildlings run from the bike, so chase them and throw orbs with E. Or hop off with R and battle them."]]);
  }
}
let prompt = "";

const blob = (g, fill, x, y, rx, ry) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.2832); g.fill(); };
// A little map of the whole land, painted once
const mapArt = makeCanvas(MW * 2, MH * 2);
(function () {
  const g = mapArt.getContext("2d");
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    g.fillStyle = land[ty][tx] === WATER ? "#4a9af0" : land[ty][tx] === RIDGE ? "#5a5648" : PLACES[place[ty][tx]].ground;
    g.fillRect(tx * 2, ty * 2, 2, 2);
  }
  g.lineJoin = "round";
  for (const [colour, wide] of [["#2a2238", 5], ["#f8f4e8", 3]]) for (const road of ROADS) {
    g.strokeStyle = colour;
    g.lineWidth = wide;
    g.beginPath();
    road.forEach(([x, y], n) => (n ? g.lineTo(x * 2, y * 2) : g.moveTo(x * 2, y * 2)));
    g.stroke();
  }
})();

// ----- Drawing -----
function words(text, x, y, size, colour, align, weight) {
  ctx.font = (weight || 600) + " " + size + "px Fredoka, \"Trebuchet MS\", sans-serif";
  ctx.textAlign = align || "left";
  ctx.textBaseline = "top";
  ctx.lineWidth = Math.max(3, size / 4.5);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#2a2238";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = colour || "#ffffff";
  ctx.fillText(text, x, y);
}
function wrap(text, width, size) {
  ctx.font = "600 " + size + "px Fredoka, \"Trebuchet MS\", sans-serif";
  const rows = [];
  let row = "";
  for (const word of text.split(" ")) {
    if (ctx.measureText(row + word).width > width && row) {
      rows.push(row.trim());
      row = "";
    }
    row += word + " ";
  }
  rows.push(row.trim());
  return rows;
}
function panel(x, y, w, h, fill) {
  ctx.fillStyle = "#2a2238";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.fillStyle = fill || "#3d3a5c";
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 11);
  ctx.fill();
}
function bar(x, y, w, h, part, colour) {
  ctx.fillStyle = "#2a2238";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, Math.max(0, (w - 4) * clamp(part, 0, 1)), h - 4, (h - 4) / 2);
  ctx.fill();
}
const hpColour = (part) => (part > 0.5 ? "#4ad85a" : part > 0.2 ? "#f2c81e" : "#e83a3a");
// The 3D world is drawn by view3d.js. This draws the words that float above things in it.
function drawLabels() {
  const above = function (x, y, high, text, size, colour) {
    const at = VIEW.project(x, y, high);
    if (at) words(text, at.x, at.y, size, colour, "center", 700);
  };
  for (const who of GANG) if (!state.beaten[who.id] && !fight && far(who, me) < 700 && !(who.captain != null && who.captain !== state.story)) above(who.x, who.y, 52 + Math.sin(time * 6) * 2, "!", 30, "#ff5a5a");
  if (fight) above(fight.who.x, fight.who.y, 52, fight.who.name, 15, "#ffffff");
  if (far(GRAN, me) < 500) above(GRAN.x, GRAN.y, 52, "Gran Torque", 15, "#fff27a");
  for (const foe of foes) if (foe.gone <= 0 && far(foe, me) < 620) {
    if (foe.wind && Math.floor(time * 14) % 2) above(foe.x, foe.y, 66, "!", 30, "#ff5a5a");
    else if (foe.wild && foe.mood !== "fight") above(foe.x, foe.y, foe.legend ? 80 : 50, (foe.legend ? "LEGENDARY  " : "") + "L" + foe.c.lv, 13, foe.legend ? "#e0a0ff" : "#ffffff");
  }
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2.5);
    above(f.x, f.y + 50, 44 + (1 - f.life) * 36, f.text, 20, f.colour);
  }
  ctx.globalAlpha = 1;
  const aim = me.riding ? null : target();
  if (aim && aim.wild) above(aim.x, aim.y, -8, "E: throw orb", 14, "#fff27a");
}
function drawHud() {
  const c = lead(), aim = me.riding ? null : target();
  // Your Wildling, top left
  panel(12, 12, 292, 86);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(20, 20, 70, 70, 10);
  ctx.fillStyle = blend(KIND_COLOUR[DEX[c.id].kind], "#ffffff", 0.45);
  ctx.fill();
  ctx.clip();
  ctx.drawImage(c.id === VOLTREV && over > 0 ? bikePicture(true) : picture(c.id), 16, 18, 78, 78);
  ctx.restore();
  words(DEX[c.id].name, 100, 18, 19, over > 0 && c.id === VOLTREV ? "#ffb060" : "#ffffff");
  words("Lv " + c.lv, 294, 20, 16, "#fff27a", "right");
  bar(100, 46, 192, 16, c.hp / maxHp(c), hpColour(c.hp / maxHp(c)));
  words(c.hp + " / " + maxHp(c), 196, 44, 13, "#ffffff", "center");
  bar(100, 66, 192, 9, c.xp / xpToGrow(c), "#6ab8ff");
  state.team.forEach(function (id, n) {
    blob(ctx, "#2a2238", 108 + n * 20, 86, 7, 7);
    blob(ctx, state.owned[id].hp <= 0 ? "#6a6a7a" : n === state.active ? "#fff27a" : KIND_COLOUR[DEX[id].kind], 108 + n * 20, 86, 5, 5);
  });
  words("orbs " + state.orbs, 294, 78, 14, "#ffffff", "right");
  // Riding: a boost bar. On foot: your three attacks and the Overdrive meter.
  if (me.riding) {
    panel(12, 104, 292, 40);
    words("BOOST (Shift)", 24, 114, 14, "#bfe8ff");
    bar(140, 114, 152, 16, me.boost / 100, "#4ae8ff");
  } else {
    panel(12, 104, 292, state.core ? 96 : 68);
    [["dash", 0.8], ["shot", 2.2], [c.lv >= 8 ? "BIG" : "Lv 8", 6.5]].forEach(function ([name, wait], n) {
      const x = 24 + n * 92, ready = cool[n] <= 0 && (n < 2 || c.lv >= 8);
      ctx.globalAlpha = ready ? 1 : 0.4;
      ctx.fillStyle = n ? KIND_COLOUR[DEX[c.id].kind] : "#9a9cb8";
      ctx.beginPath();
      ctx.roundRect(x, 112, 84, 50, 10);
      ctx.fill();
      ctx.globalAlpha = 1;
      words(String(n + 1), x + 12, 116, 26, "#ffffff", "left", 700);
      words(name, x + 76, 128, 15, "#ffffff", "right");
      if (cool[n] > 0) {
        ctx.fillStyle = "rgba(30,24,60,0.6)";
        ctx.beginPath();
        ctx.roundRect(x, 112, 84 * Math.min(1, cool[n] / wait), 50, 10);
        ctx.fill();
      }
    });
    if (state.core) {
      const ready = meter >= 100 && c.id === VOLTREV && over <= 0;
      words(over > 0 ? "OVERDRIVE!" : ready ? "F: OVERDRIVE!" : "Overdrive", 24, 170, 14, ready && Math.floor(time * 6) % 2 ? "#ffffff" : "#ffb060");
      bar(140, 170, 152, 16, over > 0 ? over / 14 : meter / 100, over > 0 ? "#ffffff" : "#ff7a2a");
    }
  }
  // The foe you are fighting, top middle
  if (aim) {
    panel(330, 12, 300, 62);
    words((aim.wild ? (aim.legend ? "LEGENDARY " : "Wild ") : "") + DEX[aim.c.id].name, 344, 18, 17, aim.legend ? "#e0a0ff" : "#ffffff");
    words("Lv " + aim.c.lv, 618, 20, 15, "#fff27a", "right");
    ctx.fillStyle = KIND_COLOUR[DEX[aim.c.id].kind];
    ctx.beginPath();
    ctx.roundRect(344, 44, 64, 20, 8);
    ctx.fill();
    words(KINDS[DEX[aim.c.id].kind], 376, 46, 13, "#ffffff", "center");
    bar(416, 46, 202, 16, aim.c.hp / maxHp(aim.c), hpColour(aim.c.hp / maxHp(aim.c)));
  }
  // The map, top right, with a flashing marker for where to go next
  const mx = 760, my = 12, k = 188 / (MW * 2), next = goal();
  panel(mx - 6, my - 6, 200, 142);
  ctx.drawImage(mapArt, mx, my, 188, MH * 2 * k);
  const onMap = (spot) => [mx + (spot.x / TILE) * 2 * k, my + (spot.y / TILE) * 2 * k];
  for (const pit of PITS) {
    const [px, py] = onMap(pit);
    blob(ctx, "#2a2238", px, py, 4, 4);
    blob(ctx, "#ff5a5a", px, py, 2.6, 2.6);
  }
  for (const gate of gates) if (state.story < gate.need) {
    const [gx, gy] = onMap(gate);
    ctx.fillStyle = "#2a2238";
    ctx.fillRect(gx - 4, gy - 4, 8, 8);
    ctx.fillStyle = "#f8d028";
    ctx.fillRect(gx - 3, gy - 3, 6, 6);
  }
  if (next) {
    const [gx, gy] = onMap(next), wide = 5 + Math.sin(time * 6) * 1.5;
    blob(ctx, "#2a2238", gx, gy, wide + 2, wide + 2);
    blob(ctx, "#ff4ad8", gx, gy, wide, wide);
  }
  const [px, py] = onMap(me);
  blob(ctx, "#2a2238", px, py, 5.5, 5.5);
  blob(ctx, "#ffffff", px, py, 3.6, 3.6);
  wrap(state.story < 6 && next ? GOALS[Math.min(5, state.story)] : "You have done everything. Ride free!", 196, 14).forEach((row, n) => words(row, mx + 94, my + 142 + n * 17, 14, "#fff27a", "center"));
  words("caught " + caught() + "/" + TOTAL + "   X: team", mx + 94, my + 182, 13, "#ffffff", "center");
  // Messages
  if (banner.t > 0) {
    ctx.globalAlpha = Math.min(1, banner.t);
    words(banner.text, VW / 2, 110, 40, "#ffffff", "center", 700);
    ctx.globalAlpha = 1;
  }
  if (toastTime > 0) {
    const rows = wrap(toastText, 560, 17);
    panel(VW / 2 - 300, 536 - rows.length * 22, 600, 20 + rows.length * 22, "#2f2c4a");
    rows.forEach((row, n) => words(row, VW / 2, 546 - rows.length * 22 + n * 22, 17, "#fff27a", "center"));
  }
  const tip = prompt || (me.riding ? "Up: go   Down: brake   Left, right: steer   Shift: boost   E: throw an orb   R: hop off" : "W A S D: walk   Left, right: look   1 2 3: attack   E: orb   Q: swap   F: Overdrive   R: ride");
  words(tip, VW / 2, 606, prompt ? 18 : 14, prompt ? "#ffffff" : "rgba(255,255,255,0.85)", "center");
}
function drawTalk() {
  const [who, text] = talk.lines[talk.i], face = { "Gran Torque": "gran", "Captain Skid": "skid", "Captain Slick": "slick", "Captain Burnout": "burnout", "Captain Black Ice": "blackice", "Vex Throttle": "vex" }[who];
  panel(60, 440, 840, 170, "#2f2c4a");
  if (face) {
    blob(ctx, "#2a2238", 150, 525, 66, 66);
    blob(ctx, "#5a5688", 150, 525, 62, 62);
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 525, 62, 0, 6.2832);
    ctx.clip();
    ctx.drawImage(person(LOOKS[face], 0), 150 - 86, 525 - 78, 172, 210);
    ctx.restore();
    words(who, 240, 456, 20, "#fff27a", "left", 700);
  }
  wrap(text.slice(0, Math.floor(talk.shown)), face ? 620 : 780, 21).forEach((row, n) => words(row, face ? 240 : 90, (face ? 490 : 470) + n * 28, 21, "#ffffff"));
  if (talk.shown >= text.length && Math.floor(time * 3) % 2) words("Space ▶", 870, 574, 15, "#fff27a", "right");
}
// The team screen (X): every Wildling you know about. Choose up to three to ride with you and Voltrev.
function drawGarage() {
  ctx.fillStyle = "#2f2c4a";
  ctx.fillRect(0, 0, VW, VH);
  words("YOUR WILDLINGS", VW / 2, 14, 30, "#fff27a", "center", 700);
  words("caught " + caught() + " of " + TOTAL, VW / 2, 50, 16, "#ffffff", "center");
  for (let id = 1; id <= TOTAL; id++) {
    const col = (id - 1) % 9, row = Math.floor((id - 1) / 9), x = 66 + col * 93, y = 84 + row * 108, own = state.owned[id], inTeam = state.team.includes(id);
    panel(x, y, 86, 100, inTeam ? "#5a8a5a" : own ? blend(KIND_COLOUR[DEX[id].kind], "#2f2c4a", 0.55) : "#3d3a5c");
    if (id - 1 === pick) {
      ctx.strokeStyle = "#fff27a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(x, y, 86, 100, 14);
      ctx.stroke();
    }
    if (state.dex[id]) ctx.drawImage(own ? picture(id) : tinted(picture(id), "#1a1830"), x + 8, y + 4, 70, 70);
    else words("?", x + 43, y + 20, 34, "#6a6890", "center", 700);
    words(state.dex[id] ? DEX[id].name : "???", x + 43, y + 76, 11, "#ffffff", "center");
    if (own) words("Lv " + own.lv, x + 43, y + 88, 10, "#fff27a", "center");
  }
  const id = pick + 1, own = state.owned[id];
  panel(66, 416, 828, 150);
  if (own) {
    ctx.drawImage(picture(id), 80, 424, 132, 132);
    words(DEX[id].name, 226, 430, 26, "#ffffff", "left", 700);
    words(KINDS[DEX[id].kind] + " kind   Level " + own.lv + "   Health " + own.hp + "/" + maxHp(own), 226, 466, 17, "#bfe8ff");
    words("Strong against: " + STRONG[DEX[id].kind].map((kind) => KINDS[kind]).join(" and "), 226, 492, 16, "#ffffff");
    words(id === VOLTREV ? "Your ride and best friend. The only Wildling that can use OVERDRIVE." : state.team.includes(id) ? "In your team. Space: send it home to rest." : state.team.length >= 4 ? "Your team is full (Voltrev and three others)." : "Space: add it to your team.", 226, 520, 16, "#fff27a");
  } else words(state.dex[id] ? DEX[id].name + ": seen, but not caught yet." : "You haven't found this Wildling yet.", 90, 474, 20, "#ffffff");
  words("Arrows: choose     Space: add to or remove from your team     X: back", VW / 2, 592, 16, "#ffffff", "center");
}
function updateGarage() {
  if (hit("ArrowRight", "KeyD")) pick = (pick + 1) % TOTAL;
  if (hit("ArrowLeft", "KeyA")) pick = (pick + TOTAL - 1) % TOTAL;
  if (hit("ArrowDown", "KeyS")) pick = Math.min(TOTAL - 1, pick + 9);
  if (hit("ArrowUp", "KeyW")) pick = Math.max(0, pick - 9);
  const id = pick + 1;
  if (hit("Space", "Enter") && state.owned[id] && id !== VOLTREV && !fight) {
    const lead0 = state.team[state.active];
    if (state.team.includes(id)) state.team.splice(state.team.indexOf(id), 1);
    else if (state.team.length < 4) state.team.push(id);
    state.active = Math.max(0, state.team.indexOf(lead0));
    sfx.good();
    save();
  }
  if (hit("KeyX", "Tab", "Escape")) mode = "play";
}

function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  time += dt;
  if (banner.t > 0) banner.t -= dt;
  if (toastTime > 0) toastTime -= dt;
  for (const bit of bits) {
    bit.life -= dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
  }
  bits = bits.filter((bit) => bit.life > 0);
  for (const f of floats) f.life -= dt;
  floats = floats.filter((f) => f.life > 0);
  if (mode === "garage") updateGarage();
  else if (mode === "play" && talk) {
    const long = talk.lines[talk.i][1].length;
    if (Math.floor(talk.shown) < Math.floor(talk.shown + dt * 60) && talk.shown < long && Math.floor(talk.shown) % 3 === 0) sfx.talk();
    talk.shown += dt * 60;
    if (hit("Space", "Enter")) {
      if (talk.shown < long) talk.shown = long;
      else if (talk.i < talk.lines.length - 1) Object.assign(talk, { i: talk.i + 1, shown: 0 });
      else {
        const then = talk.then;
        talk = null;
        if (then) then();
      }
    }
  } else if (mode === "play") updatePlay(dt);
  if (mode === "garage") drawGarage();
  else {
    VIEW.render();
    ctx.clearRect(0, 0, VW, VH);
    if (mode === "play") drawLabels();
    if (mode === "play") drawHud();
    if (talk) drawTalk();
  }
  for (const code in tapped) tapped[code] = false;
  requestAnimationFrame(frame);
}
let last = performance.now();
function begin(saved) {
  el("intro").hidden = true;
  state = saved ? Object.assign(fresh(), saved) : fresh();
  foes = [];
  Object.assign(me, { x: saved ? state.x : START.x, y: saved ? state.y : START.y, riding: true, v: 0, a: 0 });
  if (!free(me.x, me.y)) Object.assign(me, { x: START.x, y: START.y });
  camTurn = 0;
  mode = "play";
  placeNow = -1;
  addLegend();
  if (!saved) say([["Gran Torque", "There you are! Come and meet the one I told you about. I found it curled up asleep in my garage."],
    ["Gran Torque", "This is Voltrev. It's a Wildling... and a motorbike. And it has already decided you are its rider."],
    ["Gran Torque", "Just in time, too. A biker gang called the Rust Riders is rounding up wild Wildlings to power some terrible machine."],
    ["Gran Torque", "Hold W or the up arrow to go, and steer with left and right. Wild Wildlings run from the bike, so chase them down and throw capture orbs with E."],
    ["Gran Torque", "Or hop off with R, and Voltrev will battle beside you: press 1, 2 and 3 to attack, and step away from the red marks."],
    ["Gran Torque", "Follow the road east. Stop them, kiddo. And take this cape. Every hero needs one!"]], save);
}
el("start").addEventListener("click", () => begin(null));
el("continue").addEventListener("click", () => begin(loadSave()));
el("continue").hidden = !loadSave();
if (document.fonts && document.fonts.load) document.fonts.load("600 16px Fredoka");
VIEW.build();
requestAnimationFrame(frame);

// Only for testing the game.
window.TR = {
  get state() { return state; },
  get mode() { return mode; },
  get fight() { return fight; },
  get foes() { return foes; },
  get marks() { return marks; },
  get talk() { return talk; },
  get meter() { return meter; },
  set meter(value) { meter = value; },
  get over() { return over; },
  get camTurn() { return camTurn; },
  set camTurn(value) { camTurn = value; },
  me: me, pal: pal, keys: keys, DEX: DEX, lead: lead, target: target, free: free, cool: () => cool, GANG: GANG, PITS: PITS, gates: gates, crates: crates,
};
