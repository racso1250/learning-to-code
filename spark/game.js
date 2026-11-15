// Spark Knights: you're a little spark! Travel through the tear to 24 worlds,
// level up to get more sparklings and uncover more of Sparkhaven, collect spark,
// and drop it into Mount Spark to get new weapons. The best is the Spark Sceptre!

// ----- Teach the 3D engine about Spark Knights' worlds -----

Object.assign(areaColours, {
  hub: {
    sky: 0xc8e0ff,
    grass: ["#6ccf5a", "#5abb48", "#86e070"], rock: ["#a8a0b8", "#928aa4", "#bcb4cc"],
    snow: ["#f8f8ff", "#e4e8f8", "#ffffff"], water: ["#3a8ae0", "#50a0f0", "#d0f0ff"],
    dirt: ["#a07a50", "#856040", "#b48c60"], stone: ["#928aa4", "#7a7290", "#a8a0b8"],
  },
  bloom: {
    sky: 0x9fe8c8,
    grass: ["#3fae4a", "#2f9a3c", "#5ac860"], rock: ["#6a8a5a", "#5a7a4a", "#7a9a6a"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#2aa8a0", "#3ac0b8", "#b0fff0"],
    dirt: ["#6a5a3a", "#5a4a2a", "#7a6a4a"], stone: ["#5a7a4a", "#4a6a3a", "#6a8a5a"],
  },
  tide: {
    sky: 0x3a7a8a,
    grass: ["#5a8a98", "#4a7a88", "#6a9aa8"], rock: ["#4a6a7a", "#3a5a6a", "#5a7a8a"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#1a5a9a", "#2a6ab0", "#9fe8ff"],
    dirt: ["#3a5060", "#2a4050", "#4a6070"], stone: ["#3a5060", "#2a4050", "#4a6070"],
  },
  ember: {
    sky: 0xff7a3a,
    glowWater: true, // the "water" here is glowing lava
    grass: ["#5a4a48", "#4a3a38", "#6a5a56"], rock: ["#3d3036", "#2c2228", "#4e3e46"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#ff6a1a", "#ffa030", "#ffe070"],
    dirt: ["#3d3036", "#2c2228", "#4e3e46"], stone: ["#3d3036", "#2c2228", "#4e3e46"],
  },
  frost: {
    sky: 0xe8f4ff,
    grass: ["#e8f0f8", "#d0dcea", "#ffffff"], rock: ["#9ab0c8", "#86a0b8", "#b0c4d8"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#5a9ad8", "#7ab8f0", "#e0f4ff"],
    dirt: ["#8aa0b8", "#7890a8", "#9ab0c8"], stone: ["#8aa0b8", "#7890a8", "#9ab0c8"],
  },
  shadow: {
    sky: 0x5a3a6a,
    grass: ["#3a2a4a", "#2c1f3a", "#4a3a5a"], rock: ["#4a3a5a", "#3a2a4a", "#5a4a6a"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#2a3a2a", "#3a4a3a", "#8aff9a"],
    dirt: ["#2a1f30", "#1f1626", "#3a2a40"], stone: ["#2a1f30", "#1f1626", "#3a2a40"],
  },
  star: {
    sky: 0x3a2a6a,
    grass: ["#1a1a3a", "#12122a", "#3a3a7a"], rock: ["#3a3a6a", "#2a2a5a", "#4a4a8a"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#0a0a2a", "#1a1a4a", "#ffffff"],
    dirt: ["#22224a", "#18183a", "#2c2c5a"], stone: ["#22224a", "#18183a", "#2c2c5a"],
  },
});

// How each world looks and feels.
//   hemi / sun  = how bright the sky light and sunlight are
//   light       = how brightly YOU glow (dark worlds make your spark-light stand out)
//   bloom       = how strongly bright things glow, and bloomThreshold = how bright they must be to glow
//   spriteLight = how bright flat sprites are (a bit darker in gloomy worlds)
Object.assign(areaMoods, {
  hub: { skyTop: "#6a8af0", horizon: "#ffe4f0", sparkle: 0xfff6a0, sparkleKind: "pollen",
    hemi: 0.62, sun: 0.7, light: 0.35, bloom: 0.35, bloomThreshold: 0.94 },
  bloom: { skyTop: "#2a9a8a", horizon: "#d8ffe8", sparkle: 0xffffff, sparkleKind: "butterflies",
    hemi: 0.7, sun: 0.8, light: 0.6, bloom: 0.4, bloomThreshold: 0.9 },
  tide: { skyTop: "#0a2a3a", horizon: "#2a5a6a", sparkle: 0x9fe8ff, sparkleKind: "pollen",
    hemi: 0.45, sun: 0.4, light: 1.8, bloom: 0.8, bloomThreshold: 0.65, spriteLight: 0.85 },
  ember: { skyTop: "#2a0505", horizon: "#c8502a", sparkle: 0xff8a3a, sparkleKind: "embers",
    hemi: 0.45, sun: 0.45, light: 1.4, bloom: 0.7, bloomThreshold: 0.7, spriteLight: 0.9 },
  frost: { skyTop: "#5a8ad8", horizon: "#f0f8ff", sparkle: 0xffffff, sparkleKind: "pollen",
    hemi: 0.8, sun: 0.75, light: 0.7, bloom: 0.3, bloomThreshold: 0.95 },
  shadow: { skyTop: "#0a0518", horizon: "#3a2050", sparkle: 0xc08aff, sparkleKind: "fireflies",
    hemi: 0.36, sun: 0.28, light: 2.2, bloom: 0.8, bloomThreshold: 0.62, spriteLight: 0.78, stars: true },
  star: { skyTop: "#02020c", horizon: "#24184a", sparkle: 0xffffff, sparkleKind: "fireflies",
    hemi: 0.36, sun: 0.26, light: 2.4, bloom: 0.85, bloomThreshold: 0.62, spriteLight: 0.85, stars: true },
});

Object.assign(thingSprites, {
  spark: { sprite: sparkCrystal, size: 0.8, bobs: true, glow: "rgba(255, 230, 100, 0.8)" },
  heartPickup: { sprite: heartPickup, size: 0.7, bobs: true, glow: "rgba(255, 90, 110, 0.6)" },
  tearHeart: { sprite: tearHeart, size: 1.4, bobs: true, glow: "rgba(255, 240, 150, 1)" },
  tear: { sprite: riftSprite, size: 2.2, spins: true, noShadow: true, glow: "rgba(120, 200, 255, 0.4)",
    swaps: { m: "#1a3a6a", M: "#4a8ad8", v: "#9fe8ff", x: "#ffffff" } },
  crater: { sprite: craterSprite, size: 1.6, noShadow: true, glow: "rgba(255, 180, 60, 1)" },
});

const monsterSprites = { blob: blobMonster, bat: batMonster, crab: crabMonster };

// ----- Saving -----

const SAVE_NAME = "sparkKnightsSave";

function loadSave() {
  const save = {
    started: false,
    level: 1,
    xp: 0,
    spark: 0,
    weapon: 0,         // which weapon you have (0 = Twig ... 6 = Spark Sceptre)
    cleared: [],       // worlds you've cleared
    hubX: HUB_START.x,
    hubY: HUB_START.y,
    hubTaken: {},      // spark crystals you've picked up at home (they grow back)
    metElder: false,
  };
  try {
    const text = localStorage.getItem(SAVE_NAME);
    if (text) Object.assign(save, JSON.parse(text));
  } catch (error) {
    // No save yet
  }
  return save;
}

function saveGame() {
  if (mode === "hub") {
    save.hubX = playerX;
    save.hubY = playerY;
  }
  try {
    localStorage.setItem(SAVE_NAME, JSON.stringify(save));
  } catch (error) {
    // Couldn't save. The game still works.
  }
}

const save = loadSave();

// ----- Game state -----

let mode = "hub";        // "hub" (at home) or "world" (through the tear)
let worldIndex = 0;
let tiles = [];
let playerX = save.hubX;
let playerY = save.hubY;
let facing = "down";
let hearts = maxHearts(save.level);
let enemies = [];
let nextEnemyId = 1;
let guardianDefeated = false;
let sparklings = [];

const canvas = document.getElementById("game");
const view = createTempleView(canvas);

const heartsText = document.getElementById("hearts");
const levelText = document.getElementById("level");
const xpFill = document.getElementById("xp-fill");
const sparkText = document.getElementById("spark");
const weaponText = document.getElementById("weapon");
const placeText = document.getElementById("place");
const toast = document.getElementById("toast");
const promptBox = document.getElementById("prompt");
const dialogueBox = document.getElementById("dialogue");
const dialogueName = document.getElementById("dialogue-name");
const dialogueText = document.getElementById("dialogue-text");
const bigNews = document.getElementById("big-news");
const bigNewsText = document.getElementById("big-news-text");
const menuBox = document.getElementById("menu");
const hurtFlash = document.getElementById("hurt");
const homeButton = document.getElementById("home-button");

let toastTimer = null;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 2400);
}

let lastWarning = 0;
function warn(text) {
  if (Date.now() - lastWarning > 1600) {
    lastWarning = Date.now();
    showToast(text);
  }
}

let afterNews = null;
function showBigNews(text, after) {
  bigNewsText.textContent = text;
  bigNews.hidden = false;
  afterNews = after || null;
}
function closeBigNews() {
  bigNews.hidden = true;
  if (afterNews) {
    const next = afterNews;
    afterNews = null;
    next();
  }
}

// ----- Sounds (from the arcade's sounds.js) -----

function playStep() { playTone(0, 0.03, 220, 160, 0.03); }
function playSpark() { playTone(0, 0.06, 1200, 1800, 0.05); playTone(0.06, 0.08, 1800, 2400, 0.04); }
function playZap() { playTone(0, 0.1, 1400, 700, 0.03); }
function playLevelUp() { [523, 659, 784, 1046].forEach((f, i) => playTone(i * 0.1, 0.15, f, f, 0.08)); }

// ----- Zones at home -----

function zoneUnlocked(id) {
  return save.level >= zones.find((z) => z.id === id).level;
}

function updateMist() {
  const squares = [];
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles.length; x++) {
      const tile = tiles[y][x];
      if (tile.kind !== "water" && !zoneUnlocked(tile.zone)) squares.push({ x: x, y: y });
    }
  }
  view.setMist(squares);
}

// ----- Going home, and going through the tear -----

function goHome() {
  mode = "hub";
  tiles = makeHub();
  const now = Date.now();
  for (const key of Object.keys(save.hubTaken)) {
    const [x, y] = key.split(",").map(Number);
    if (now - save.hubTaken[key] < 90000) tiles[y][x].thing = null;
    else delete save.hubTaken[key];
  }
  playerX = save.hubX;
  playerY = save.hubY;
  // Don't arrive standing inside the tear
  if (Math.abs(playerX - TEAR.x) + Math.abs(playerY - TEAR.y) <= 1) {
    playerX = TEAR.x;
    playerY = TEAR.y + 2;
  }
  enemies = [];
  hearts = maxHearts(save.level);
  view.load(tiles, "hub");
  for (const b of hubBuildings) view.setBuilding(b.x + "," + b.y, b.type, b.x, b.y);
  updateMist();
  homeButton.hidden = true;
  draw();
  updatePanels();
  saveGame();
}

function enterWorld(index) {
  closeMenu();
  saveGame();
  mode = "world";
  worldIndex = index;
  const world = worlds[index];
  const theme = themes[world.theme];
  tiles = makeWorldTiles(index);
  playerX = WORLD_START.x;
  playerY = WORLD_START.y;
  hearts = maxHearts(save.level);
  guardianDefeated = false;
  enemies = [];
  view.load(tiles, world.theme);

  // Monsters, in this world's colours
  const look = { sprite: monsterSprites[theme.monster], size: 1, swaps: { T: theme.colours[0], t: theme.colours[1] } };
  const count = 6 + Math.floor(index / 2);
  let tries = 0;
  while (enemies.length < count && tries < 500) {
    tries++;
    const x = 2 + Math.floor(Math.random() * (WORLD_SIZE - 4));
    const y = 6 + Math.floor(Math.random() * (WORLD_SIZE - 14));
    if (Math.hypot(x - WORLD_START.x, y - WORLD_START.y) < 8) continue;
    if (canMonsterStand(x, y)) addMonster(x, y, false, look);
  }
  // The guardian, who protects the Tear Heart
  addMonster(WORLD_HEART.x, WORLD_HEART.y + 4, true, Object.assign({}, look, { size: 2.2 }));

  homeButton.hidden = false;
  playNoise(0, 0.8, 300, 3000, 0.25);
  showToast("~ " + world.name + " ~");
  draw();
  updatePanels();
}

function addMonster(x, y, guardian, look) {
  const stats = monsterStats(worldIndex, guardian);
  enemies.push({
    id: nextEnemyId++,
    kind: "gloomling",
    look: look,
    x: x,
    y: y,
    hp: stats.hp,
    maxHp: stats.hp,
    damage: stats.damage,
    speed: stats.speed,
    xp: stats.xp,
    guardian: guardian,
    lastMove: Date.now(),
  });
}

// ----- Moving, fighting and collecting -----

function enemyAt(x, y) {
  return enemies.find((e) => e.x === x && e.y === y);
}

function isLava(tile) {
  return mode === "world" && tile.kind === "water" && themes[worlds[worldIndex].theme].lava;
}

function climbHeight(tile) {
  return tile.kind === "water" ? 0 : tile.height;
}

function canMonsterStand(x, y) {
  const tile = tiles[y] && tiles[y][x];
  if (!tile || tile.kind === "water" || BLOCKERS.includes(tile.thing) || tile.thing === "tearHeart") return false;
  if (x === playerX && y === playerY) return false;
  return !enemyAt(x, y);
}

function busy() {
  return !save.started || !bigNews.hidden || !menuBox.hidden || talking;
}

function move(dx, dy) {
  if (busy()) return;
  if (dx < 0) facing = "left";
  if (dx > 0) facing = "right";
  if (dy < 0) facing = "up";
  if (dy > 0) facing = "down";

  const newX = playerX + dx;
  const newY = playerY + dy;
  const there = tiles[newY] && tiles[newY][newX];
  if (!there) return;

  const enemy = enemyAt(newX, newY);
  if (enemy) {
    attack(enemy, dx, dy);
  } else if (mode === "hub" && there.zone && !zoneUnlocked(there.zone)) {
    const zone = zones.find((z) => z.id === there.zone);
    warn("The mist is too thick! Reach level " + zone.level + " to uncover " + zone.name + ".");
  } else if (BLOCKERS.includes(there.thing) || (mode === "hub" && newX === ELDER.x && newY === ELDER.y)) {
    // something's in the way
  } else if (isLava(there)) {
    warn("That's lava! Even a spark can't swim in lava.");
  } else if (Math.abs(climbHeight(there) - climbHeight(tiles[playerY][playerX])) > 1) {
    warn("Too steep! Find another way up.");
  } else if (there.thing === "tearHeart" && !guardianDefeated) {
    warn("The Tear Heart is protected! Defeat its guardian first.");
  } else {
    playerX = newX;
    playerY = newY;
    playStep();
    pickUp(there);
    saveGame();
  }
  draw();
  updatePanels();
}

function pickUp(tile) {
  if (tile.thing === "spark") {
    const amount = mode === "world" ? 5 + worldIndex : 3;
    save.spark += amount;
    tile.thing = null;
    view.removeThing(playerX, playerY, "#fff27a");
    if (mode === "hub") save.hubTaken[playerX + "," + playerY] = Date.now();
    playSpark();
    showToast("+" + amount + " ✦ spark");
  } else if (tile.thing === "heartPickup") {
    tile.thing = null;
    view.removeThing(playerX, playerY, "#ff5a6a");
    hearts = Math.min(maxHearts(save.level), hearts + 2);
    playTone(0, 0.1, 600, 900, 0.06);
    showToast("❤️ +2 hearts");
  } else if (tile.thing === "tearHeart") {
    tile.thing = null;
    view.removeThing(playerX, playerY, "#ffffff");
    clearWorld();
  }
}

function attack(enemy, dx, dy) {
  const weapon = weapons[save.weapon];
  enemy.hp -= weapon.damage;
  enemy.hurt = true;
  view.slash(enemy.x, enemy.y, facing, weapon.colour);
  playNoise(0, 0.08, 3000, 800, 0.2);
  if (enemy.hp <= 0) {
    defeat(enemy);
  } else if (!enemy.guardian && canMonsterStand(enemy.x + dx, enemy.y + dy)) {
    enemy.x += dx; // knocked back!
    enemy.y += dy;
  }
}

function defeat(enemy) {
  enemies = enemies.filter((e) => e !== enemy);
  view.poof(enemy.x, enemy.y);
  playPoof();
  const sparkDrop = 1 + Math.floor(Math.random() * 3) + Math.floor(worldIndex / 3);
  save.spark += sparkDrop;
  showToast("+" + sparkDrop + " ✦ spark, +" + enemy.xp + " XP");
  // Sometimes they leave a heart behind
  const tile = tiles[enemy.y][enemy.x];
  if (!tile.thing && Math.random() < 0.15) {
    tile.thing = "heartPickup";
    view.addThing(enemy.x, enemy.y);
  }
  if (enemy.guardian) {
    guardianDefeated = true;
    playJingle();
    showToast("The guardian is defeated! Grab the Tear Heart!");
  }
  addXp(enemy.xp);
  saveGame();
}

function clearWorld() {
  const world = worlds[worldIndex];
  const firstTime = !save.cleared.includes(worldIndex);
  if (firstTime) save.cleared.push(worldIndex);
  const bonus = 20 + worldIndex * 5;
  save.spark += bonus;
  playJingle();
  addXp(10 + worldIndex * 3);
  let text = "🌟 You cleared " + world.name + "! +" + bonus + " ✦ spark.";
  if (firstTime && worldIndex + 1 < worlds.length) text += " A new world has opened in the tear!";
  if (save.cleared.length === worlds.length) text = "🏆 You cleared ALL 24 WORLDS! You are the greatest Spark Knight ever!";
  saveGame();
  showBigNews(text, goHome);
}

// ----- Levels -----

function addXp(amount) {
  save.xp += amount;
  while (save.xp >= xpForNextLevel(save.level)) {
    save.xp -= xpForNextLevel(save.level);
    const oldSparklings = sparklingCount(save.level);
    const oldHearts = maxHearts(save.level);
    save.level++;
    playLevelUp();
    const rewards = [];
    if (sparklingCount(save.level) > oldSparklings) rewards.push("a new sparkling");
    if (maxHearts(save.level) > oldHearts) rewards.push("an extra heart");
    const zone = zones.find((z) => z.level === save.level);
    if (zone) rewards.push("you can uncover " + zone.name + " at home");
    hearts = maxHearts(save.level);
    if (mode === "hub") updateMist();
    showToast("⭐ LEVEL " + save.level + "! " + (rewards.length ? "You got " + rewards.join(", ") + "!" : ""));
    if (zone && mode === "hub") view.celebrate(playerX, playerY);
  }
}

// ----- Sparklings: little sparks that float around you and zap monsters -----

let lastSparklingZap = {};

function updateSparklings(now) {
  const count = sparklingCount(save.level);
  sparklings = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + now / 900;
    sparklings.push({
      id: "sparkling" + i,
      x: playerX + Math.cos(angle) * 1.2,
      y: playerY + Math.sin(angle) * 0.9,
      sprite: sparklingSprite,
      size: 0.8,
      float: true,
      glow: "rgba(255, 240, 140, 0.45)",
    });
  }
  // Each sparkling zaps the nearest monster every so often
  sparklings.forEach(function (s, i) {
    if (now - (lastSparklingZap[i] || 0) < 1500) return;
    let target = null;
    let best = 4.5;
    for (const enemy of enemies) {
      const d = Math.hypot(enemy.x - playerX, enemy.y - playerY);
      if (d < best) {
        best = d;
        target = enemy;
      }
    }
    if (!target) return;
    lastSparklingZap[i] = now + Math.random() * 300;
    view.bolt(Math.round(s.x), Math.round(s.y), target.x, target.y, "#fff27a");
    playZap();
    target.hp -= sparklingDamage(save.level);
    target.hurt = true;
    if (target.hp <= 0) defeat(target);
  });
}

// ----- Monsters -----

function hurtPlayer(damage) {
  hearts -= damage;
  hurtFlash.className = "on";
  setTimeout(() => (hurtFlash.className = ""), 150);
  playTone(0, 0.15, 300, 120, 0.1);
  if (hearts <= 0) {
    showBigNews("Your flame flickered out! You float back home to Sparkhaven to warm up. (You keep your spark and XP.)", goHome);
  }
}

function monsterTurn(enemy) {
  const distance = Math.abs(enemy.x - playerX) + Math.abs(enemy.y - playerY);
  const swimming = tiles[playerY][playerX].kind === "water";
  if (distance === 1 && !swimming) {
    hurtPlayer(enemy.damage);
    return;
  }
  const chase = distance <= (enemy.guardian ? 9 : 7) && !swimming;
  const choices = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => canMonsterStand(enemy.x + dx, enemy.y + dy));
  if (choices.length === 0) return;
  if (chase) {
    choices.sort((a, b) => Math.abs(enemy.x + a[0] - playerX) + Math.abs(enemy.y + a[1] - playerY) - (Math.abs(enemy.x + b[0] - playerX) + Math.abs(enemy.y + b[1] - playerY)));
  } else if (Math.random() < 0.6) {
    return; // resting
  } else {
    choices.sort(() => Math.random() - 0.5);
  }
  // The guardian stays near the Tear Heart
  const [dx, dy] = choices[0];
  if (enemy.guardian && Math.hypot(enemy.x + dx - WORLD_HEART.x, enemy.y + dy - WORLD_HEART.y) > 9) return;
  enemy.x += dx;
  enemy.y += dy;
}

function tick() {
  if (busy()) return;
  const now = Date.now();
  updateSparklings(now);
  for (const enemy of enemies.slice()) {
    if (now - enemy.lastMove >= enemy.speed) {
      enemy.lastMove = now;
      monsterTurn(enemy);
      if (!bigNews.hidden) break; // you fainted
    }
  }
  draw();
  updatePanels();
}

// ----- Talking, the tear and Mount Spark -----

function nearbyThing() {
  if (mode !== "hub") return null;
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const x = playerX + dx;
    const y = playerY + dy;
    if (x === ELDER.x && y === ELDER.y) return "elder";
    const tile = tiles[y] && tiles[y][x];
    if (tile && tile.thing === "tear") return "tear";
    if (tile && tile.thing === "crater") return "crater";
  }
  return null;
}

let talking = false;
let lines = [];
let lineNumber = 0;

function say(name, said) {
  lines = said;
  lineNumber = 0;
  talking = true;
  dialogueName.textContent = name;
  dialogueText.textContent = lines[0];
  dialogueBox.hidden = false;
  playTone(0, 0.05, 700, 700, 0.05);
}

function nextLine() {
  lineNumber++;
  if (lineNumber < lines.length) {
    dialogueText.textContent = lines[lineNumber];
    playTone(0, 0.05, 700, 700, 0.05);
  } else {
    talking = false;
    dialogueBox.hidden = true;
    updatePanels();
  }
}

function elderHint() {
  if (save.level < 6) return "Mount Spark is still hidden in the mist, far to the north. Reach level 6 to uncover it!";
  if (save.weapon < weapons.length - 1) {
    const next = weapons[save.weapon + 1];
    return "Climb Mount Spark and drop " + next.cost + " spark into its crater, and it will forge you the " + next.name + "!";
  }
  return "The Spark Sceptre! You hold the greatest weapon of all. I'm so proud of you, little knight.";
}

function interact() {
  const thing = nearbyThing();
  if (thing === "elder") {
    if (!save.metElder) {
      save.metElder = true;
      say("Elder Spark", [
        "Welcome, little Spark Knight! Tears have opened up in the world, leading to 24 strange worlds.",
        "Step into the tear behind me to visit them. Defeat each world's guardian and bring home its Tear Heart!",
        "Collect spark wherever you go: it's what we use for everything. And as you grow stronger, your sparklings will grow in number.",
        "The mist around Sparkhaven will lift as you level up, uncovering new places. Far to the north, Mount Spark is waiting...",
      ]);
      saveGame();
    } else {
      say("Elder Spark", [elderHint()]);
    }
  } else if (thing === "tear") {
    openWorldMenu();
  } else if (thing === "crater") {
    openMountSpark();
  }
}

function closeMenu() {
  menuBox.hidden = true;
  menuBox.innerHTML = "";
}

function menuButton(text, enabled, onClick, className) {
  const b = document.createElement("button");
  b.textContent = text;
  b.disabled = !enabled;
  if (className) b.className = className;
  b.addEventListener("click", function () {
    b.blur();
    onClick();
  });
  menuBox.appendChild(b);
  return b;
}

// The tear: choose a world to visit
function openWorldMenu() {
  menuBox.innerHTML = "";
  const title = document.createElement("h2");
  title.textContent = "🌀 The Tear: choose a world";
  menuBox.appendChild(title);
  const grid = document.createElement("div");
  grid.className = "world-grid";
  menuBox.appendChild(grid);
  worlds.forEach(function (world) {
    const cleared = save.cleared.includes(world.index);
    const open = world.index <= save.cleared.length;
    const b = document.createElement("button");
    b.textContent = (cleared ? "✔ " : open ? "" : "🔒 ") + (open ? world.name : "World " + (world.index + 1));
    b.disabled = !open;
    b.className = "world " + world.theme + (cleared ? " cleared" : "");
    b.addEventListener("click", function () {
      b.blur();
      enterWorld(world.index);
    });
    grid.appendChild(b);
  });
  menuButton("Close (Esc)", true, closeMenu, "close");
  menuBox.hidden = false;
}

// Mount Spark: drop spark in to get a new weapon
function openMountSpark() {
  menuBox.innerHTML = "";
  const title = document.createElement("h2");
  title.textContent = "🌋 Mount Spark";
  menuBox.appendChild(title);
  const info = document.createElement("p");
  info.textContent = "The crater glows with ancient fire. Drop spark into it, and it will forge you a new weapon. You have " + save.spark + " ✦ spark.";
  menuBox.appendChild(info);
  weapons.forEach(function (weapon, i) {
    if (i === 0) return;
    if (i <= save.weapon) {
      menuButton("✔ " + weapon.icon + " " + weapon.name + " (damage " + weapon.damage + ")", false, function () {}, "owned");
    } else if (i === save.weapon + 1) {
      menuButton("Drop " + weapon.cost + " ✦ spark → " + weapon.icon + " " + weapon.name + " (damage " + weapon.damage + ")", save.spark >= weapon.cost, function () {
        forgeWeapon(i);
      });
    } else {
      menuButton("🔒 " + weapon.icon + " " + weapon.name + " (" + weapon.cost + " ✦)", false, function () {});
    }
  });
  menuButton("Close (Esc)", true, closeMenu, "close");
  menuBox.hidden = false;
}

function forgeWeapon(i) {
  const weapon = weapons[i];
  if (save.spark < weapon.cost) return;
  save.spark -= weapon.cost;
  save.weapon = i;
  closeMenu();
  view.celebrate(CRATER.x, CRATER.y);
  view.celebrate(playerX, playerY);
  playNoise(0, 1.2, 200, 2000, 0.4);
  playJingle();
  saveGame();
  const best = i === weapons.length - 1;
  showBigNews(
    best
      ? "✨ Mount Spark erupts with light! You forged the SPARK SCEPTRE, the greatest weapon of all!"
      : "🌋 Mount Spark rumbles and glows... You got the " + weapon.icon + " " + weapon.name + "! (damage " + weapon.damage + ")"
  );
  updatePanels();
}

// ----- Panels -----

function updatePanels() {
  const max = maxHearts(save.level);
  heartsText.textContent = "❤️".repeat(Math.max(0, hearts)) + "🖤".repeat(Math.max(0, max - hearts));
  levelText.textContent = "Lv " + save.level;
  xpFill.style.width = Math.min(100, (save.xp / xpForNextLevel(save.level)) * 100) + "%";
  sparkText.textContent = "✦ " + save.spark;
  const weapon = weapons[save.weapon];
  weaponText.textContent = weapon.icon + " " + weapon.name;
  if (mode === "hub") {
    const zone = tiles[playerY] && tiles[playerY][playerX] ? zones.find((z) => z.id === tiles[playerY][playerX].zone) : null;
    placeText.textContent = "🏡 " + (zone ? zone.name : "Sparkhaven");
  } else {
    const guardian = enemies.find((e) => e.guardian);
    placeText.textContent = "🌀 " + worlds[worldIndex].name + (guardian ? "  · Guardian " + Math.max(0, guardian.hp) + "/" + guardian.maxHp : "  · Grab the Tear Heart!");
  }

  // Progress panel
  const zoneList = document.getElementById("zone-list");
  zoneList.innerHTML = "";
  for (const zone of zones) {
    const li = document.createElement("li");
    const open = save.level >= zone.level;
    li.textContent = (open ? "✔ " : "🔒 ") + zone.name + (open ? "" : " (level " + zone.level + ")");
    if (open) li.className = "done";
    zoneList.appendChild(li);
  }
  document.getElementById("stats").textContent =
    "✨ Sparklings: " + sparklingCount(save.level) + "   🌀 Worlds cleared: " + save.cleared.length + " / " + worlds.length;

  const weaponList = document.getElementById("weapon-list");
  weaponList.innerHTML = "";
  weapons.forEach(function (w, i) {
    const li = document.createElement("li");
    li.textContent = (i <= save.weapon ? "✔ " : "• ") + w.icon + " " + w.name + " (damage " + w.damage + (w.cost ? ", " + w.cost + " ✦" : "") + ")";
    if (i === save.weapon) li.className = "current";
    else if (i < save.weapon) li.className = "done";
    weaponList.appendChild(li);
  });

  const thing = nearbyThing();
  promptBox.hidden = !thing || busy();
  if (thing === "elder") promptBox.textContent = "Space: Talk to the Elder Spark";
  if (thing === "tear") promptBox.textContent = "Space: Step into the tear";
  if (thing === "crater") promptBox.textContent = "Space: Drop spark into Mount Spark";

  drawMap();
}

function drawMap() {
  const map = document.getElementById("minimap");
  const pen = map.getContext("2d");
  const size = tiles.length;
  const scale = map.width / size;
  pen.fillStyle = "#0a0a1a";
  pen.fillRect(0, 0, map.width, map.height);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = tiles[y][x];
      let colour = "#5abb48";
      if (tile.kind === "water") colour = isLava(tile) ? "#ff7a1a" : "#3a8ae0";
      else if (tile.kind === "rock") colour = "#928aa4";
      else if (tile.kind === "snow") colour = "#f0f4ff";
      else if (tile.kind === "temple") colour = "#ffe8a0";
      if (["tree", "pine", "deadTree"].includes(tile.thing)) colour = "#2f6a3a";
      if (tile.thing === "spark") colour = "#fff27a";
      if (tile.thing === "tear" || tile.thing === "tearHeart" || tile.thing === "crater") colour = "#ffffff";
      if (mode === "hub" && tile.kind !== "water" && !zoneUnlocked(tile.zone)) colour = "#4a4060";
      pen.fillStyle = colour;
      pen.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
    }
  }
  for (const e of enemies) {
    pen.fillStyle = e.guardian ? "#ff00ff" : "#ff3a3a";
    pen.fillRect(e.x * scale - 1, e.y * scale - 1, scale + 2, scale + 2);
  }
  pen.fillStyle = "#ffffff";
  pen.fillRect(playerX * scale - 2, playerY * scale - 2, scale + 4, scale + 4);
}

function draw() {
  const people = sparklings.slice();
  if (mode === "hub") {
    people.push({ id: "elder", x: ELDER.x, y: ELDER.y, sprite: elderSprite, glow: "rgba(150, 220, 255, 0.7)" });
  }
  view.sync({
    x: playerX,
    y: playerY,
    facing: facing,
    front: sparkFront,
    back: sparkBack,
    swimming: tiles[playerY][playerX].kind === "water",
    enemies: enemies,
    embers: true, // you're a spark: embers float up from you
  });
  view.syncVillagers(people);
}

// ----- Keyboard -----

document.addEventListener("keydown", function (event) {
  const key = event.key;
  const isAction = key === " " || key === "Enter" || key === "e";
  if (!bigNews.hidden) {
    if (isAction) {
      closeBigNews();
      event.preventDefault();
    }
    return;
  }
  if (!menuBox.hidden) {
    if (key === "Escape") closeMenu();
    return;
  }
  if (talking) {
    if (isAction) {
      nextLine();
      event.preventDefault();
    }
    return;
  }
  if (key === "ArrowUp" || key === "w") move(0, -1);
  else if (key === "ArrowDown" || key === "s") move(0, 1);
  else if (key === "ArrowLeft" || key === "a") move(-1, 0);
  else if (key === "ArrowRight" || key === "d") move(1, 0);
  else if (isAction) interact();
  else if (key === "h" && mode === "world") goHome();
  else return;
  event.preventDefault();
});

homeButton.addEventListener("click", function () {
  this.blur();
  if (mode === "world") goHome();
});
document.getElementById("start").addEventListener("click", function () {
  this.blur();
  save.started = true;
  document.getElementById("intro").hidden = true;
  saveGame();
});
document.getElementById("close-news").addEventListener("click", function () {
  this.blur();
  closeBigNews();
});
document.getElementById("new-game").addEventListener("click", function () {
  this.blur();
  if (confirm("Start Spark Knights again? Everything will be lost.")) {
    try {
      localStorage.removeItem(SAVE_NAME);
    } catch (error) {
      // nothing to remove
    }
    location.reload();
  }
});

// ----- Start! -----

if (save.started) document.getElementById("intro").hidden = true;
goHome();
setInterval(tick, 200);
