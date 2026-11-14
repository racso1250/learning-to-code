// Pinecrest: explore the endless mountains, mine treasure, sell it,
// and save up for a home of your own.
//
// The world is made in world.js, the pixel art is in sprites.js,
// and the drawing happens in render.js.

// ----- Saving -----

const SAVE_NAME = "pinecrestSave";

function loadSave() {
  const save = {
    started: false,
    x: START.x,
    y: START.y,
    money: 0,
    totalEarned: 0,
    bag: {},                 // treasure you're carrying, like { stone: 3, iron: 1 }
    levels: { backpack: 0, pickaxe: 0, boots: 0, feather: 0 },
    hasMap: false,
    ownsHouse: false,
    homeLevel: 0,            // 0 = no home, 1 = cottage ... 5 = castle
    templeFound: false,
    templeStage: 0,          // 0 = ruins, 4 = fully fixed
    mined: [],               // squares you've dug up, like "40,-12"
    explored: {},            // which squares you've seen, chunk by chunk
    furthest: 0,
    goals: [],
    tomChats: 0,
  };
  try {
    const text = localStorage.getItem(SAVE_NAME);
    if (text) {
      const loaded = JSON.parse(text);
      Object.assign(save, loaded);
      save.levels = Object.assign({ backpack: 0, pickaxe: 0, boots: 0, feather: 0 }, loaded.levels);
    }
  } catch (error) {
    // No save yet, or the browser won't let us read it
  }
  return save;
}

function saveGame() {
  save.x = playerX;
  save.y = playerY;
  save.mined = Array.from(mined);
  try {
    localStorage.setItem(SAVE_NAME, JSON.stringify(save));
  } catch (error) {
    // Couldn't save. The game still works.
  }
}

const save = loadSave();
if (save.ownsHouse && save.homeLevel === 0) save.homeLevel = 1; // older saves
const mined = new Set(save.mined);
let playerX = save.x;
let playerY = save.y;
let facing = "down";

// ----- Shop prices -----

// Homes you can buy, one after another. Each one is fancier than the last!
const homes = [
  { name: "Cosy cottage", price: 500, icon: "🏠" },
  { name: "Farmhouse", price: 2000, icon: "🏡" },
  { name: "Log lodge", price: 6000, icon: "🛖" },
  { name: "Stone manor", price: 15000, icon: "🏘️" },
  { name: "Mountain castle", price: 40000, icon: "🏰" },
];

const upgrades = {
  backpack: { name: "🎒 Bigger backpack", sizes: [10, 20, 35, 60], prices: [40, 150, 450] },
  pickaxe: { name: "⛏️ Stronger pickaxe", prices: [60, 250, 700] },
  boots: { name: "🥾 Climbing boots", prices: [200], about: "Climb 2 steps at once" },
  feather: { name: "🪶 Homing feather", prices: [120], about: "Press H to fly home" },
};

function backpackSize() {
  return upgrades.backpack.sizes[save.levels.backpack];
}

function itemsInBag() {
  let count = 0;
  for (const ore of Object.keys(save.bag)) count += save.bag[ore];
  return count;
}

// The fixed temple makes all treasure worth double!
function priceOf(ore) {
  return ores[ore].price * (save.templeStage >= 4 ? 2 : 1);
}

// ----- The world, with your changes -----
// generateTile() makes the world, but we also remember what YOU changed:
// ore you've dug up, and the cottage once you've bought it.

const tileCache = new Map();

function getTile(x, y) {
  const cx = Math.floor(x / CHUNK);
  const cy = Math.floor(y / CHUNK);
  const key = cx + "," + cy;
  if (!tileCache.has(key)) {
    const chunkTiles = [];
    for (let ty = cy * CHUNK; ty < (cy + 1) * CHUNK; ty++) {
      for (let tx = cx * CHUNK; tx < (cx + 1) * CHUNK; tx++) {
        const tile = generateTile(tx, ty);
        if (tile.thing === "ore" && mined.has(tx + "," + ty)) {
          tile.thing = null;
          tile.ore = null;
        }
        if (save.ownsHouse && tile.building === "cottage") tile.building = "home";
        if (save.ownsHouse && tile.thing === "sign") tile.thing = null;
        chunkTiles.push(tile);
      }
    }
    tileCache.set(key, chunkTiles);
  }
  return tileCache.get(key)[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)];
}

// ----- Exploring (for Tom's map) -----

const SIGHT = 5;

function isExplored(x, y) {
  const key = Math.floor(x / CHUNK) + "," + Math.floor(y / CHUNK);
  const seen = save.explored[key];
  if (!seen) return false;
  return seen[(y - Math.floor(y / CHUNK) * CHUNK) * CHUNK + (x - Math.floor(x / CHUNK) * CHUNK)] === "1";
}

function markExplored(x, y) {
  const cx = Math.floor(x / CHUNK);
  const cy = Math.floor(y / CHUNK);
  const key = cx + "," + cy;
  const seen = save.explored[key] || "0".repeat(CHUNK * CHUNK);
  const i = (y - cy * CHUNK) * CHUNK + (x - cx * CHUNK);
  if (seen[i] !== "1") {
    save.explored[key] = seen.slice(0, i) + "1" + seen.slice(i + 1);
  }
}

function reveal() {
  for (let dy = -SIGHT; dy <= SIGHT; dy++) {
    for (let dx = -SIGHT; dx <= SIGHT; dx++) {
      if (dx * dx + dy * dy <= SIGHT * SIGHT) markExplored(playerX + dx, playerY + dy);
    }
  }
}

// ----- The page -----

const canvas = document.getElementById("game");
const view = createMountainView(
  canvas,
  getTile,
  function () { return save.templeStage; },
  function () { return save.homeLevel; }
);
view.addVillager("tom", tomSprite, villagers[0].x, villagers[0].y);
view.addVillager("mabel", mabelSprite, villagers[1].x, villagers[1].y);

const moneyText = document.getElementById("money");
const bagText = document.getElementById("bag-space");
const placeText = document.getElementById("place");
const toast = document.getElementById("toast");
const promptBox = document.getElementById("prompt");
const dialogueBox = document.getElementById("dialogue");
const dialogueName = document.getElementById("dialogue-name");
const dialogueText = document.getElementById("dialogue-text");
const shopBox = document.getElementById("shop");
const bigNews = document.getElementById("big-news");
const bigNewsText = document.getElementById("big-news-text");
const minimap = document.getElementById("minimap");
const mapPen = minimap.getContext("2d");
const bagList = document.getElementById("bag-list");
const goalList = document.getElementById("goal-list");

let toastTimer = null;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.hidden = true;
  }, 2800);
}

let lastWarning = 0;
function warn(text) {
  if (Date.now() - lastWarning > 2000) {
    lastWarning = Date.now();
    showToast(text);
  }
}

function showBigNews(text) {
  bigNewsText.textContent = text;
  bigNews.hidden = false;
}

// ----- Sounds (from the arcade's sounds.js) -----

function playStep() {
  playTone(0, 0.03, 180, 120, 0.03);
}
function playTink() {
  playTone(0, 0.05, 1400, 900, 0.06);
  playNoise(0, 0.06, 4000, 1500, 0.15);
}
function playCrumble() {
  playNoise(0, 0.35, 2000, 200, 0.45);
}
function playCoins() {
  for (let i = 0; i < 4; i++) playTone(i * 0.07, 0.07, 1200 + i * 200, 1600 + i * 200, 0.05);
}

// ----- Goals (they go on and on!) -----

const goals = [
  { id: "dig", text: "Dig up your first treasure", done: () => save.mined.length > 0 || mined.size > 0 },
  { id: "map", text: "Get a map from Tom", done: () => save.hasMap },
  { id: "sell", text: "Sell treasure to Mabel", done: () => save.totalEarned > 0 },
  { id: "home", text: "Buy the cottage ($500)", done: () => save.ownsHouse },
  { id: "gold", text: "Find gold", done: () => save.foundGold },
  { id: "far", text: "Go 150 steps from the village", done: () => save.furthest >= 150 },
  { id: "temple", text: "??? Find something hidden", reveal: "Find the secret temple", done: () => save.templeFound },
  { id: "fixed", text: "??? Fix something ancient", reveal: "Fix the secret temple", done: () => save.templeStage >= 4 },
  { id: "diamond", text: "Find a diamond", done: () => save.foundDiamond },
  { id: "manor", text: "Live in a stone manor", done: () => save.homeLevel >= 4 },
  { id: "castle", text: "Live in a CASTLE", done: () => save.homeLevel >= 5 },
  { id: "rich", text: "Earn $5000 in total", done: () => save.totalEarned >= 5000 },
];

function checkGoals() {
  for (const goal of goals) {
    if (!save.goals.includes(goal.id) && goal.done()) {
      save.goals.push(goal.id);
      playJingle();
      showToast("🏆 Goal complete: " + (goal.reveal || goal.text) + "!");
    }
  }
}

// ----- Panels -----

function updatePanels() {
  moneyText.textContent = "💰 $" + save.money;
  bagText.textContent = "🎒 " + itemsInBag() + " / " + backpackSize();
  const distance = Math.round(Math.hypot(playerX, playerY));
  placeText.textContent = distance <= VILLAGE_RADIUS ? "📍 Pinecrest village" : "📍 " + distance + " steps from Pinecrest";

  bagList.innerHTML = "";
  if (itemsInBag() === 0) {
    bagList.textContent = "Empty. Go mining!";
  }
  for (const ore of oreOrder) {
    if (save.bag[ore]) {
      const line = document.createElement("p");
      line.textContent = ores[ore].icon + " " + ores[ore].name + " x" + save.bag[ore] + "  ($" + priceOf(ore) * save.bag[ore] + ")";
      bagList.appendChild(line);
    }
  }

  goalList.innerHTML = "";
  for (const goal of goals) {
    const done = save.goals.includes(goal.id);
    const line = document.createElement("li");
    line.textContent = (done ? "✔ " : "• ") + (done && goal.reveal ? goal.reveal : goal.text);
    if (done) line.className = "done";
    goalList.appendChild(line);
  }

  const person = nearbyThing();
  promptBox.hidden = !person || talking || shopOpen;
  if (person) promptBox.textContent = "Space: " + person.label;

  drawMap();
}

// ----- Tom's map -----

const MAP_SQUARES = 64; // the map shows 64 x 64 squares around you
const MAP_SCALE = 3;

function mapColour(tile) {
  if (tile.building || tile.villager) return "#c0392b";
  if (tile.thing === "tree") return "#2f6a3a";
  if (tile.thing === "ore") return "#c8c2d8";
  if (tile.kind === "water") return "#3a8ad0";
  if (tile.kind === "path") return "#b08a5a";
  if (tile.kind === "temple") return "#f6d04a";
  if (tile.kind === "snow") return "#f0f4f8";
  if (tile.kind === "rock") return tile.height % 2 === 0 ? "#8a8794" : "#7d7a87";
  return tile.height % 2 === 0 ? "#5fb04a" : "#539c40";
}

function drawMap() {
  mapPen.fillStyle = "#101820";
  mapPen.fillRect(0, 0, minimap.width, minimap.height);

  if (!save.hasMap) {
    mapPen.fillStyle = "#c8d8e8";
    mapPen.font = "8px 'Press Start 2P', monospace";
    mapPen.textAlign = "center";
    mapPen.fillText("No map yet...", minimap.width / 2, minimap.height / 2 - 8);
    mapPen.fillText("Maybe Tom has one?", minimap.width / 2, minimap.height / 2 + 12);
    return;
  }

  const left = playerX - MAP_SQUARES / 2;
  const top = playerY - MAP_SQUARES / 2;
  for (let y = 0; y < MAP_SQUARES; y++) {
    for (let x = 0; x < MAP_SQUARES; x++) {
      if (!isExplored(left + x, top + y)) continue; // not explored yet: stays dark
      mapPen.fillStyle = mapColour(getTile(left + x, top + y));
      mapPen.fillRect(x * MAP_SCALE, y * MAP_SCALE, MAP_SCALE, MAP_SCALE);
    }
  }

  // The village and the temple: a marker if they're on the map, or an arrow at the edge if not
  markPlace(0, 0, "#ffd84a", left, top);
  if (save.templeFound) markPlace(TEMPLE.x, TEMPLE.y, "#ff9af0", left, top);

  // You, in the middle
  const middle = (MAP_SQUARES / 2) * MAP_SCALE;
  mapPen.fillStyle = "#1d1726";
  mapPen.fillRect(middle - 3, middle - 3, 9, 9);
  mapPen.fillStyle = "#ff4d4d";
  mapPen.fillRect(middle - 2, middle - 2, 7, 7);
}

function markPlace(x, y, colour, left, top) {
  let mx = (x - left) * MAP_SCALE;
  let my = (y - top) * MAP_SCALE;
  const size = minimap.width;
  if (mx < 0 || my < 0 || mx >= size || my >= size) {
    // Off the edge: squash it onto the edge so it points the right way
    const cx = size / 2;
    const cy = size / 2;
    const angle = Math.atan2(my - cy, mx - cx);
    mx = cx + Math.cos(angle) * (size / 2 - 8);
    my = cy + Math.sin(angle) * (size / 2 - 8);
  }
  mapPen.fillStyle = "#1d1726";
  mapPen.fillRect(mx - 5, my - 5, 11, 11);
  mapPen.fillStyle = colour;
  mapPen.fillRect(mx - 4, my - 4, 9, 9);
}

// ----- Moving and mining -----

let mining = null; // { key, hits } while you're digging something

function move(dx, dy) {
  if (talking || shopOpen || !save.started) return;

  if (dx < 0) facing = "left";
  if (dx > 0) facing = "right";
  if (dy < 0) facing = "up";
  if (dy > 0) facing = "down";

  const newX = playerX + dx;
  const newY = playerY + dy;
  const here = getTile(playerX, playerY);
  const there = getTile(newX, newY);
  const biggestStep = save.levels.boots ? 2 : 1;

  if (there.kind === "water" || there.thing === "tree" || there.building || there.villager ||
      there.thing === "campfire" || there.thing === "sign" || there.thing === "altar") {
    // Can't walk there
  } else if (there.thing === "ore") {
    dig(newX, newY, there);
  } else if (Math.abs(there.height - here.height) > biggestStep) {
    warn(there.height > here.height ? "Too steep to climb! Find another way (or buy climbing boots)." : "Too far to jump down!");
  } else {
    playerX = newX;
    playerY = newY;
    mining = null;
    playStep();
    reveal();
    save.furthest = Math.max(save.furthest, Math.round(Math.hypot(playerX, playerY)));
    checkTemple();
    checkGoals();
    saveGame();
  }

  draw();
  updatePanels();
}

function dig(x, y, tile) {
  const ore = ores[tile.ore];
  if (itemsInBag() >= backpackSize()) {
    warn("Your backpack is full! Sell your treasure to Mabel in the village.");
    return;
  }
  const key = x + "," + y;
  if (!mining || mining.key !== key) mining = { key: key, hits: 0 };
  mining.hits = mining.hits + 1;

  // A stronger pickaxe needs fewer hits
  const needed = Math.max(1, ore.hits - save.levels.pickaxe * 2);
  if (mining.hits < needed) {
    playTink();
    view.hitOre(x, y, ore.colours[0]);
    showToast("⛏️ Mining " + ore.name + "... " + mining.hits + " / " + needed);
    return;
  }

  // Dug it up!
  mining = null;
  playCrumble();
  view.removeOre(x, y, ore.colours[0]);
  tile.thing = null;
  tile.ore = null;
  mined.add(key);
  const oreName = Object.keys(ores).find(function (name) { return ores[name] === ore; });
  save.bag[oreName] = (save.bag[oreName] || 0) + 1;
  if (oreName === "gold") save.foundGold = true;
  if (oreName === "diamond") save.foundDiamond = true;
  showToast("You found " + ore.icon + " " + ore.name + "! (worth $" + priceOf(oreName) + ")");
  checkGoals();
  saveGame();
}

// ----- The secret temple -----

function checkTemple() {
  if (!save.templeFound && Math.abs(playerX - TEMPLE.x) <= TEMPLE_RADIUS + 1 && Math.abs(playerY - TEMPLE.y) <= TEMPLE_RADIUS + 1) {
    save.templeFound = true;
    showBigNews("You discovered a SECRET TEMPLE, hidden high in the mountains! It's in ruins... Maybe you can fix it?");
  }
}

function talkToAltar() {
  if (save.templeStage >= 4) {
    return ["The temple glows with golden light.", "Its blessing is on you: all your treasure sells for DOUBLE!"];
  }
  const stage = templeStages[save.templeStage];
  const have = save.bag[stage.ore] || 0;
  if (have < stage.amount) {
    const lines = [];
    if (save.templeStage === 0) {
      lines.push("A soft voice echoes from the old stones...");
      lines.push("\"Long ago, this temple watched over the mountains. Now it has crumbled.\"");
    }
    lines.push("\"" + stage.text + "\"");
    lines.push("(You have " + have + " " + ores[stage.ore].name + ". The temple needs " + stage.amount + ".)");
    return lines;
  }

  // You have enough! Fix the next part of the temple
  save.bag[stage.ore] = have - stage.amount;
  save.templeStage = save.templeStage + 1;
  view.rebuildAt(TEMPLE.x, TEMPLE.y);
  playJingle();
  playNoise(0.2, 1.5, 300, 60, 0.4);
  if (save.templeStage >= 4) {
    setTimeout(function () {
      showBigNews("The temple is FIXED! It shines with golden light. From now on, all your treasure sells for DOUBLE!");
    }, 300);
    return ["You place the diamond on the altar...", "The whole temple begins to glow!"];
  }
  return [
    "You give the temple " + stage.amount + " " + ores[stage.ore].name + ". The stones rumble and rise!",
    "\"" + templeStages[save.templeStage].text + "\"",
  ];
}

// ----- Talking -----

// What could you talk to, right next to you?
function nearbyThing() {
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const tile = getTile(playerX + dx, playerY + dy);
    if (tile.villager === "tom") return { id: "tom", label: "Talk to Tom" };
    if (tile.villager === "mabel") return { id: "mabel", label: "Talk to Mabel" };
    if (tile.thing === "sign") return { id: "sign", label: "Read the sign" };
    if (tile.thing === "campfire") return { id: "campfire", label: "Look at the campfire" };
    if (tile.thing === "altar") return { id: "altar", label: "Touch the altar" };
  }
  return null;
}

const tomTips = [
  "The further you go from the village, the rarer the treasure. Gold, rubies... maybe even diamonds!",
  "Grandpa tells a story about a temple, lost long ago. Far away, past the snow, where the sun goes down and the cold wind blows...",
  "If a cliff is too steep, Mabel sells climbing boots. I wish I had some!",
  "Your backpack fills up fast. A bigger one means fewer trips back to the village.",
];

let talking = false;
let lines = [];
let lineNumber = 0;
let afterTalking = null;

function interact() {
  const thing = nearbyThing();
  if (!thing) return;

  let name = "";
  let said = [];
  afterTalking = null;

  if (thing.id === "tom") {
    name = "Tom";
    if (!save.hasMap) {
      said = [
        "Hey! You're up early. Still sleeping by the campfire, huh?",
        "I made you something... a MAP! It fills in as you explore, and the yellow square always shows where the village is.",
        "If you dig up anything shiny in the mountains, Mabel at the shop will buy it. Save up enough, and maybe you can buy the old cottage!",
      ];
      afterTalking = function () {
        save.hasMap = true;
        playJingle();
        showToast("🗺️ You got Tom's map!");
      };
    } else if (save.ownsHouse && save.tomChats % 3 === 0) {
      const tomOnHomes = [
        "You've got a real home now! I'm so happy for you. Can I come over for tea?",
        "A farmhouse! You could keep chickens. Or a goat. Ooh, can we get a goat?",
        "Your log lodge is the coziest place in the whole village. Mum's jealous!",
        "A stone manor?! You're the fanciest person in Pinecrest now!",
        "You live in a CASTLE. My best friend lives in a castle! Nobody will believe me!",
      ];
      said = [tomOnHomes[save.homeLevel - 1]];
    } else {
      said = [tomTips[save.tomChats % tomTips.length]];
    }
    save.tomChats = save.tomChats + 1;
  } else if (thing.id === "mabel") {
    name = "Mabel";
    said = ["Hello, dear! I'll buy anything shiny you dig up, and I sell useful tools too. Let's see what you've got!"];
    afterTalking = openShop;
  } else if (thing.id === "sign") {
    name = "Sign";
    said = ["FOR SALE: Cosy cottage, with a warm fireplace and a soft bed. $500. Ask Mabel at the shop."];
  } else if (thing.id === "campfire") {
    name = "Campfire";
    said = save.ownsHouse
      ? ["Your old campfire. You still like to sit here sometimes and look at the stars."]
      : ["Your campfire. It's where you sleep at night. It's warm, but you dream of having a real home one day."];
  } else if (thing.id === "altar") {
    name = "Ancient altar";
    said = talkToAltar();
  }

  lines = said;
  lineNumber = 0;
  talking = true;
  dialogueName.textContent = name;
  dialogueText.textContent = lines[0];
  dialogueBox.hidden = false;
  playTone(0, 0.05, 600, 600, 0.05);
  updatePanels();
}

function nextLine() {
  lineNumber = lineNumber + 1;
  if (lineNumber < lines.length) {
    dialogueText.textContent = lines[lineNumber];
    playTone(0, 0.05, 600, 600, 0.05);
    return;
  }
  talking = false;
  dialogueBox.hidden = true;
  if (afterTalking) afterTalking();
  checkGoals();
  saveGame();
  draw();
  updatePanels();
}

// ----- Mabel's shop -----

let shopOpen = false;

function openShop() {
  shopOpen = true;
  shopBox.hidden = false;
  showShop();
}

function closeShop() {
  shopOpen = false;
  shopBox.hidden = true;
  updatePanels();
}

function sellEverything() {
  let earned = 0;
  for (const ore of Object.keys(save.bag)) {
    earned += priceOf(ore) * save.bag[ore];
  }
  if (earned === 0) return;
  save.bag = {};
  save.money += earned;
  save.totalEarned += earned;
  playCoins();
  showToast("Mabel pays you $" + earned + "!");
  checkGoals();
  saveGame();
  showShop();
}

function buyUpgrade(name) {
  const upgrade = upgrades[name];
  const price = upgrade.prices[save.levels[name]];
  if (price === undefined || save.money < price) return;
  save.money -= price;
  save.levels[name] = save.levels[name] + 1;
  playJingle();
  showToast("You bought: " + upgrade.name + "!");
  saveGame();
  showShop();
}

function buyHome() {
  const next = homes[save.homeLevel];
  if (!next || save.money < next.price) return;
  save.money -= next.price;
  save.homeLevel = save.homeLevel + 1;

  if (!save.ownsHouse) {
    // Your very first home! Change the cottage into your home, and take down the sign
    save.ownsHouse = true;
    for (const b of buildings) {
      if (b.type === "cottage") getTile(b.x, b.y).building = "home";
    }
    getTile(SIGN.x, SIGN.y).thing = null;
  }
  view.rebuildAt(SIGN.x, SIGN.y); // redraw the village so you can see your new home

  playJingle();
  checkGoals();
  saveGame();
  closeShop();
  if (save.homeLevel === 1) {
    showBigNews("🏠 You bought the cottage! For the first time in a long time, you have a HOME. But the mountains still go on forever... what else will you find?");
  } else if (save.homeLevel < homes.length) {
    showBigNews(next.icon + " Your home is now a " + next.name.toUpperCase() + "! Go and have a look at it in the village.");
  } else {
    showBigNews("🏰 You live in a MOUNTAIN CASTLE! From sleeping by a campfire to living in a castle. What an adventure!");
  }
}

// Draw the shop's buttons
function showShop() {
  shopBox.innerHTML = "";

  function heading(text) {
    const h = document.createElement("h2");
    h.textContent = text;
    shopBox.appendChild(h);
  }
  function button(text, enabled, onClick) {
    const b = document.createElement("button");
    b.textContent = text;
    b.disabled = !enabled;
    b.addEventListener("click", function () {
      b.blur();
      onClick();
    });
    shopBox.appendChild(b);
  }

  heading("Mabel's Shop   💰 $" + save.money);

  let value = 0;
  for (const ore of Object.keys(save.bag)) value += priceOf(ore) * save.bag[ore];
  button(value > 0 ? "Sell all your treasure: +$" + value : "Nothing to sell yet", value > 0, sellEverything);

  heading("Tools");
  for (const name of Object.keys(upgrades)) {
    const upgrade = upgrades[name];
    const price = upgrade.prices[save.levels[name]];
    let text = upgrade.name;
    if (name === "backpack") text += " (holds " + (upgrade.sizes[save.levels.backpack + 1] || "max") + ")";
    if (name === "pickaxe") text += " (level " + (save.levels.pickaxe + 2) + ")";
    if (upgrade.about) text += " (" + upgrade.about + ")";
    if (price === undefined) {
      button(upgrade.name + ": got it! ✔", false, function () {});
    } else {
      button(text + ": $" + price, save.money >= price, function () { buyUpgrade(name); });
    }
  }

  heading("Your home");
  const next = homes[save.homeLevel];
  if (save.homeLevel > 0) {
    const current = homes[save.homeLevel - 1];
    const line = document.createElement("p");
    line.textContent = "You live in: " + current.icon + " " + current.name;
    shopBox.appendChild(line);
  }
  if (!next) {
    button("🏰 You have the best home there is! ✔", false, function () {});
  } else if (save.homeLevel === 0) {
    button("🏠 Buy the cottage: $" + next.price, save.money >= next.price, buyHome);
  } else {
    button(next.icon + " Upgrade to a " + next.name + ": $" + next.price, save.money >= next.price, buyHome);
  }

  button("Leave the shop (Esc)", true, closeShop);
}

// ----- Drawing -----

function draw() {
  view.sync({ x: playerX, y: playerY, facing: facing });
}

// ----- Keyboard -----

document.addEventListener("keydown", function (event) {
  const key = event.key;
  const isAction = key === " " || key === "Enter" || key === "e";

  if (shopOpen) {
    if (key === "Escape") closeShop();
    return; // use the mouse for the shop's buttons
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
  else if (key === "h" && save.levels.feather) flyHome();
  else return;
  event.preventDefault();
});

// The homing feather flies you back to the village
function flyHome() {
  playerX = save.ownsHouse ? SIGN.x : START.x;
  playerY = save.ownsHouse ? SIGN.y : START.y;
  mining = null;
  playNoise(0, 0.8, 300, 3000, 0.25);
  showToast("🪶 Whoosh! The feather carries you home.");
  reveal();
  saveGame();
  draw();
  updatePanels();
}

document.getElementById("start").addEventListener("click", function () {
  this.blur();
  save.started = true;
  document.getElementById("intro").hidden = true;
  saveGame();
});

document.getElementById("close-news").addEventListener("click", function () {
  this.blur();
  bigNews.hidden = true;
});

document.getElementById("new-game").addEventListener("click", function () {
  this.blur();
  if (confirm("Start a new game? Everything will be lost.")) {
    try {
      localStorage.removeItem(SAVE_NAME);
    } catch (error) {
      // nothing to remove
    }
    location.reload();
  }
});

// ----- Start! -----

if (save.started) {
  document.getElementById("intro").hidden = true;
}
reveal();
draw();
updatePanels();
