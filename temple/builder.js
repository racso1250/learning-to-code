// The Great Land: Free Play building mode.
// You can't get hurt here. Gather materials, fix ruins, build villages and a boat,
// and the more people live in your land, the higher your rank!
//
// The land is made in world.js and drawn by render.js (the same files as Temple Guardian).

// ----- Saving -----

const SAVE_NAME = "greatLandSave";

function loadSave() {
  const save = {
    started: false,
    x: areas.builder.start.x,
    y: areas.builder.start.y,
    bag: {},
    built: [],      // buildings you built, like { type: "house", x: 70, y: 80 }
    fixed: {},      // ruins you fixed, by "x,y"
    gathered: {},   // squares you've gathered from, and when (they grow back)
    boat: false,
    rank: 0,
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
  save.x = playerX;
  save.y = playerY;
  try {
    localStorage.setItem(SAVE_NAME, JSON.stringify(save));
  } catch (error) {
    // Couldn't save. The game still works.
  }
}

const save = loadSave();

// ----- Ranks: more people = higher rank = new costume and weapon -----

// Different hats replace the top of your sprite
const hats = {
  beanie: ["......kkkk......", ".....kRRRRk.....", "....kRRRRRRk....", "....kRrRrRrk...."],
  hood: ["......kkkk......", "....kkRRRRkk....", "...kRRRRRRRRk...", "...kRrrrrrrRk..."],
  hardhat: ["......kkkk......", ".....kRRRRk.....", "....kRRrRRRk....", "..kkkkkkkkkkkk.."],
  feather: ["..........kek...", ".....kkkkkek....", "....kRRRRRRk....", "...kkkkkkkkkk..."],
  crown: ["....k.k..k.k....", "....kRkkkkRk....", "....kRRrRRRk....", "....kkkkkkkk...."],
};

const ranks = [
  { name: "Wanderer", people: 0, hat: "beanie", colours: { R: "#8a6a44", r: "#6a4a2a", j: "#8a6a44", J: "#6a4a2a" },
    weapon: { name: "Stick", icon: "🪵", speed: 1, colour: "#c8a070" } },
  { name: "Settler", people: 4, hat: "hood", colours: { R: "#3f8a4a", r: "#2f6a3a", j: "#3f8a4a", J: "#2f6a3a" },
    weapon: { name: "Stone hammer", icon: "🔨", speed: 1.5, colour: "#d8d8e0" } },
  { name: "Builder", people: 10, hat: "hardhat", colours: { R: "#f6c030", r: "#c89020", j: "#e8862a", J: "#b8661a" },
    weapon: { name: "Iron axe", icon: "🪓", speed: 2, colour: "#ffffff" } },
  { name: "Village Chief", people: 20, hat: "feather", colours: { R: "#3a5fb8", r: "#2a4590", j: "#3a5fb8", J: "#2a4590" },
    weapon: { name: "Golden hammer", icon: "🔨", speed: 2.5, colour: "#f6d04a" } },
  { name: "Lord", people: 35, hat: "feather", colours: { R: "#7a3aa8", r: "#5a2a80", j: "#7a3aa8", J: "#5a2a80" },
    weapon: { name: "Crystal sword", icon: "✨", speed: 3, colour: "#8ff0ff" } },
  { name: "Royal Ruler", people: 55, hat: "crown", colours: { R: "#f6d04a", r: "#c8a030", j: "#c0392b", J: "#8a2a20" },
    weapon: { name: "Royal sceptre", icon: "🪄", speed: 4, colour: "#ffe070" } },
];

// Make your costume: swap the top of your sprite for the rank's hat.
// The rank's colours are swapped in when it's drawn.
function withHat(base, hat) {
  const sprite = base.slice();
  for (let i = 0; i < 4; i++) sprite[i + 1] = hats[hat][i];
  return sprite;
}
const costumes = ranks.map((rank) => ({
  front: withHat(heroFront, rank.hat),
  back: withHat(heroBack, rank.hat),
  swaps: rank.colours,
}));

function peopleCount() {
  let people = 0;
  for (const b of save.built) people += buildingTypes[b.type].people;
  for (const key of Object.keys(save.fixed)) people += buildingTypes[save.fixed[key]].people;
  return people;
}

function currentRank() {
  let rank = 0;
  ranks.forEach(function (r, i) {
    if (peopleCount() >= r.people) rank = i;
  });
  return rank;
}

// ----- The world -----

const tiles = makeWorld("builder");
const savedThings = {};
const REGROW_TIME = 60000;

// Put back everything you changed: things you gathered, ruins you fixed, buildings you built
for (const key of Object.keys(save.gathered)) {
  const [x, y] = key.split(",").map(Number);
  savedThings[key] = tiles[y][x].thing;
  tiles[y][x].thing = null;
}
for (const key of Object.keys(save.fixed)) {
  const [x, y] = key.split(",").map(Number);
  tiles[y][x].thing = "building";
}
for (const b of save.built) {
  tiles[b.y][b.x].thing = "building";
}

let playerX = save.x;
let playerY = save.y;
let facing = "down";

const canvas = document.getElementById("game");
const view = createTempleView(canvas);
view.load(tiles, "builder");
view.setDayNight(true);

// Draw every ruin, fixed building and built building
for (let y = 0; y < tiles.length; y++) {
  for (let x = 0; x < tiles.length; x++) {
    if (tiles[y][x].ruin) {
      const key = x + "," + y;
      view.setBuilding(key, save.fixed[key] || tiles[y][x].ruin, x, y);
    }
  }
}
for (const b of save.built) view.setBuilding(b.x + "," + b.y, b.type, b.x, b.y);

// ----- The page -----

const rankText = document.getElementById("rank");
const peopleText = document.getElementById("people");
const weaponText = document.getElementById("weapon");
const toast = document.getElementById("toast");
const promptBox = document.getElementById("prompt");
const bigNews = document.getElementById("big-news");
const bigNewsText = document.getElementById("big-news-text");
const bagList = document.getElementById("bag-list");
const buildList = document.getElementById("build-list");
const rankList = document.getElementById("rank-list");
const minimap = document.getElementById("minimap");
const mapPen = minimap.getContext("2d");

let toastTimer = null;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 2600);
}

let lastWarning = 0;
function warn(text) {
  if (Date.now() - lastWarning > 1600) {
    lastWarning = Date.now();
    showToast(text);
  }
}

function showBigNews(text) {
  bigNewsText.textContent = text;
  bigNews.hidden = false;
}

function playStep() { playTone(0, 0.03, 180, 120, 0.03); }
function playChop() { playTone(0, 0.05, 300, 200, 0.08); playNoise(0, 0.05, 2000, 800, 0.2); }
function playBuild() { playTone(0, 0.08, 523, 523, 0.07); playTone(0.08, 0.08, 659, 659, 0.07); playTone(0.16, 0.15, 784, 784, 0.07); }

// ----- Materials -----

function canAfford(needs) {
  for (const m of Object.keys(needs)) {
    if ((save.bag[m] || 0) < needs[m]) return false;
  }
  return true;
}

function pay(needs) {
  for (const m of Object.keys(needs)) save.bag[m] -= needs[m];
}

function costText(needs) {
  return Object.keys(needs).map((m) => needs[m] + materials[m].icon).join(" ");
}

// ----- Moving and gathering -----

function climbHeight(tile) {
  return tile.kind === "water" ? 0 : tile.height;
}

function villagerAt(x, y) {
  return villagers.find((v) => v.x === x && v.y === y);
}

function move(dx, dy) {
  if (!save.started || !bigNews.hidden) return;
  if (dx < 0) facing = "left";
  if (dx > 0) facing = "right";
  if (dy < 0) facing = "up";
  if (dy > 0) facing = "down";

  const newX = playerX + dx;
  const newY = playerY + dy;
  const there = tiles[newY] && tiles[newY][newX];
  if (!there) return;

  if (resources[there.thing]) {
    gather(newX, newY, there);
  } else if (there.thing || villagerAt(newX, newY)) {
    // something's in the way
  } else if (Math.abs(climbHeight(there) - climbHeight(tiles[playerY][playerX])) > 1) {
    warn("Too steep to climb! Find another way.");
  } else {
    playerX = newX;
    playerY = newY;
    if (there.kind === "water") playNoise(0, 0.12, 1200, 400, 0.12);
    else playStep();
    saveGame();
  }
  draw();
  updatePanels();
}

let gathering = null;

function gather(x, y, tile) {
  const resource = resources[tile.thing];
  const weapon = ranks[currentRank()].weapon;
  const key = x + "," + y;
  if (!gathering || gathering.key !== key) gathering = { key: key, hits: 0 };
  gathering.hits++;
  // A better weapon (from a higher rank) gathers faster
  const needed = Math.max(1, Math.ceil(resource.hits / weapon.speed));
  if (gathering.hits < needed) {
    playChop();
    view.hitThing(x, y, weapon.colour);
    view.slash(x, y, facing, weapon.colour);
    return;
  }
  gathering = null;
  playNoise(0, 0.25, 2000, 300, 0.35);
  view.removeThing(x, y, weapon.colour);
  savedThings[key] = tile.thing;
  save.gathered[key] = Date.now();
  tile.thing = null;
  save.bag[resource.gives] = (save.bag[resource.gives] || 0) + resource.amount;
  showToast("+" + resource.amount + " " + materials[resource.gives].icon + " " + materials[resource.gives].name);
  saveGame();
}

function regrow() {
  const now = Date.now();
  for (const key of Object.keys(save.gathered)) {
    if (now - save.gathered[key] < REGROW_TIME) continue;
    const [x, y] = key.split(",").map(Number);
    if ((x === playerX && y === playerY) || villagerAt(x, y) || tiles[y][x].thing) continue;
    tiles[y][x].thing = savedThings[key];
    delete save.gathered[key];
    delete savedThings[key];
    view.addThing(x, y);
  }
}

// ----- Building -----

let chosenBuilding = "house";

// The square right in front of you
function frontSquare() {
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[facing];
  return { x: playerX + d[0], y: playerY + d[1] };
}

function build() {
  const type = buildingTypes[chosenBuilding];
  const spot = frontSquare();
  const tile = tiles[spot.y] && tiles[spot.y][spot.x];
  if (!tile || tile.kind === "water" || tile.thing || villagerAt(spot.x, spot.y)) {
    warn("You can't build there. Face an empty patch of land!");
    return;
  }
  if (!canAfford(type.needs)) {
    warn("Not enough materials for a " + type.name + " (" + costText(type.needs) + ")");
    return;
  }
  pay(type.needs);
  tile.thing = "building";
  save.built.push({ type: chosenBuilding, x: spot.x, y: spot.y });
  view.setBuilding(spot.x + "," + spot.y, chosenBuilding, spot.x, spot.y);
  view.celebrate(spot.x, spot.y);
  playBuild();
  showToast(type.icon + " You built a " + type.name + "! +" + type.people + " people");
  afterPeopleChange();
}

function buildBoat() {
  if (save.boat || !canAfford(BOAT_COST)) return;
  pay(BOAT_COST);
  save.boat = true;
  playBuild();
  showBigNews("⛵ You built a boat! Walk into the water to sail. Explore the sea and find the islands!");
  saveGame();
  updatePanels();
}

// Fix a ruin right next to you
function nearbyRuin() {
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const x = playerX + dx;
    const y = playerY + dy;
    const tile = tiles[y] && tiles[y][x];
    if (tile && tile.ruin && !save.fixed[x + "," + y]) return { x: x, y: y, ruin: ruinTypes[tile.ruin] };
  }
  return null;
}

function nearbyVillager() {
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const v = villagerAt(playerX + dx, playerY + dy);
    if (v) return v;
  }
  return null;
}

const villagerLines = [
  "Thank you for building our village! I love it here.",
  "Have you seen the islands out at sea? You'll need a boat!",
  "I heard there are old ruins all over the Great Land. Maybe you can fix them?",
  "The windmill makes the best flour. Mmm, bread!",
  "At night, all the windows glow. It's so cosy.",
  "When enough people live here, you'll be a Royal Ruler!",
];

function interact() {
  const ruin = nearbyRuin();
  if (ruin) {
    if (!canAfford(ruin.ruin.needs)) {
      warn("To fix this " + ruin.ruin.name + " you need " + costText(ruin.ruin.needs));
      return;
    }
    pay(ruin.ruin.needs);
    save.fixed[ruin.x + "," + ruin.y] = ruin.ruin.becomes;
    view.setBuilding(ruin.x + "," + ruin.y, ruin.ruin.becomes, ruin.x, ruin.y);
    view.celebrate(ruin.x, ruin.y);
    playBuild();
    showToast("🔧 You fixed the " + ruin.ruin.name + "! +" + buildingTypes[ruin.ruin.becomes].people + " people");
    afterPeopleChange();
    return;
  }
  const villager = nearbyVillager();
  if (villager) {
    showToast("💬 \"" + villagerLines[Math.floor(Math.random() * villagerLines.length)] + "\"");
  }
}

// After building or fixing: more villagers, and maybe a new rank!
function afterPeopleChange() {
  makeVillagers();
  const rank = currentRank();
  if (rank > save.rank) {
    save.rank = rank;
    const r = ranks[rank];
    playJingle();
    view.celebrate(playerX, playerY);
    showBigNews("⭐ RANK UP! You are now a " + r.name.toUpperCase() + "! You got a new costume and a new weapon: " + r.weapon.icon + " " + r.weapon.name + "!");
  }
  saveGame();
  draw();
  updatePanels();
}

// ----- Villagers -----

const villagerLooks = [
  { sprite: tomSprite, swaps: { y: "#e05a5a" } },
  { sprite: tomSprite, swaps: { y: "#5ac05a", j: "#a85a2a" } },
  { sprite: fernSprite, swaps: {} },
  { sprite: fernSprite, swaps: { F: "#5a7ad8" } },
  { sprite: bobbySprite, swaps: {} },
  { sprite: tomSprite, swaps: { y: "#e8a0d0", j: "#7a3aa8" } },
];

let villagers = [];
const MAX_VILLAGERS = 30; // the most villagers walking around at once

// Every building's people come and live near it
function makeVillagers() {
  const homes = save.built.map((b) => ({ x: b.x, y: b.y, type: b.type }));
  for (const key of Object.keys(save.fixed)) {
    const [x, y] = key.split(",").map(Number);
    homes.push({ x: x, y: y, type: save.fixed[key] });
  }
  const wanted = [];
  for (const home of homes) {
    for (let i = 0; i < buildingTypes[home.type].people; i++) {
      wanted.push({ id: home.x + "," + home.y + "#" + i, home: home });
    }
  }
  // Keep the ones we have, and add new ones next to their home
  const kept = [];
  for (const w of wanted.slice(0, MAX_VILLAGERS)) {
    const existing = villagers.find((v) => v.id === w.id);
    if (existing) {
      kept.push(existing);
      continue;
    }
    const spot = freeSpotNear(w.home.x, w.home.y);
    if (!spot) continue;
    const look = villagerLooks[Math.abs(hashString(w.id)) % villagerLooks.length];
    kept.push({ id: w.id, x: spot.x, y: spot.y, homeX: w.home.x, homeY: w.home.y, sprite: look.sprite, swaps: look.swaps });
  }
  villagers = kept;
}

function hashString(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return h;
}

function canVillagerStand(x, y) {
  const tile = tiles[y] && tiles[y][x];
  return tile && tile.kind !== "water" && !tile.thing && !villagerAt(x, y) && !(x === playerX && y === playerY);
}

function freeSpotNear(x, y) {
  for (let r = 1; r < 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (canVillagerStand(x + dx, y + dy)) return { x: x + dx, y: y + dy };
      }
    }
  }
  return null;
}

// Villagers wander about near their homes
function villagersWander() {
  if (!save.started) return;
  let moved = false;
  for (const v of villagers) {
    if (Math.random() < 0.6) continue;
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
    const nx = v.x + dx;
    const ny = v.y + dy;
    if (Math.abs(nx - v.homeX) > 4 || Math.abs(ny - v.homeY) > 4) continue;
    if (!canVillagerStand(nx, ny)) continue;
    if (Math.abs(tiles[ny][nx].height - tiles[v.y][v.x].height) > 1) continue;
    v.x = nx;
    v.y = ny;
    moved = true;
  }
  if (moved) draw();
}

// ----- Panels -----

function updatePanels() {
  const rank = ranks[currentRank()];
  const next = ranks[currentRank() + 1];
  rankText.textContent = "⭐ " + rank.name;
  peopleText.textContent = "👥 " + peopleCount() + (next ? " / " + next.people : "") + " people";
  weaponText.textContent = rank.weapon.icon + " " + rank.weapon.name;

  bagList.innerHTML = "";
  for (const id of ["wood", "stone", "iron", "crystal", "wheat", "berries", "herbs"]) {
    const line = document.createElement("p");
    line.textContent = materials[id].icon + " " + materials[id].name + ": " + (save.bag[id] || 0);
    bagList.appendChild(line);
  }
  if (save.boat) {
    const line = document.createElement("p");
    line.className = "item";
    line.textContent = "⛵ Boat";
    bagList.appendChild(line);
  }

  buildList.innerHTML = "";
  for (const id of Object.keys(buildingTypes)) {
    const type = buildingTypes[id];
    const button = document.createElement("button");
    button.textContent = type.icon + " " + type.name + "  " + costText(type.needs) + "  (+" + type.people + "👥)";
    button.className = id === chosenBuilding ? "chosen" : canAfford(type.needs) ? "" : "cant";
    button.addEventListener("click", function () {
      button.blur();
      chosenBuilding = id;
      updatePanels();
    });
    buildList.appendChild(button);
  }
  const boatButton = document.createElement("button");
  boatButton.textContent = save.boat ? "⛵ Boat: built! ✔" : "⛵ Build a boat  " + costText(BOAT_COST);
  boatButton.disabled = save.boat || !canAfford(BOAT_COST);
  boatButton.addEventListener("click", function () {
    boatButton.blur();
    buildBoat();
  });
  buildList.appendChild(boatButton);

  rankList.innerHTML = "";
  ranks.forEach(function (r, i) {
    const line = document.createElement("li");
    line.textContent = (i <= currentRank() ? "✔ " : "• ") + r.name + " (" + r.people + " people): " + r.weapon.icon + " " + r.weapon.name;
    if (i === currentRank()) line.className = "current";
    else if (i < currentRank()) line.className = "done";
    rankList.appendChild(line);
  });

  const ruin = nearbyRuin();
  const villager = nearbyVillager();
  promptBox.hidden = !ruin && !villager;
  if (ruin) promptBox.textContent = "Space: Fix the " + ruin.ruin.name + " (" + costText(ruin.ruin.needs) + ")";
  else if (villager) promptBox.textContent = "Space: Talk to the villager";

  drawMap();
}

function drawMap() {
  const size = tiles.length;
  const scale = 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = tiles[y][x];
      let colour = tile.height % 2 === 0 ? "#6cc04c" : "#5aac3e";
      if (tile.kind === "water") colour = "#2f8ad0";
      if (tile.kind === "rock") colour = "#9a96a2";
      if (tile.kind === "snow") colour = "#eef3f8";
      if (tile.thing === "tree" || tile.thing === "pine") colour = "#2f6a3a";
      if (tile.ruin) colour = save.fixed[x + "," + y] ? "#f6d04a" : "#6a6470";
      if (tile.thing === "building" && !tile.ruin) colour = "#f6d04a";
      mapPen.fillStyle = colour;
      mapPen.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  mapPen.fillStyle = "#1d1726";
  mapPen.fillRect(playerX * scale - 3, playerY * scale - 3, 8, 8);
  mapPen.fillStyle = "#ffffff";
  mapPen.fillRect(playerX * scale - 2, playerY * scale - 2, 6, 6);
}

function draw() {
  const rankNumber = currentRank();
  view.sync({
    x: playerX,
    y: playerY,
    facing: facing,
    front: costumes[rankNumber].front,
    back: costumes[rankNumber].back,
    swaps: costumes[rankNumber].swaps,
    swimming: tiles[playerY][playerX].kind === "water",
    boat: save.boat,
    enemies: [],
  });
  view.syncVillagers(villagers);
}

// ----- Keyboard -----

document.addEventListener("keydown", function (event) {
  const key = event.key;
  if (!bigNews.hidden && (key === " " || key === "Enter")) {
    bigNews.hidden = true;
    event.preventDefault();
    return;
  }
  if (key === "ArrowUp" || key === "w") move(0, -1);
  else if (key === "ArrowDown" || key === "s") move(0, 1);
  else if (key === "ArrowLeft" || key === "a") move(-1, 0);
  else if (key === "ArrowRight" || key === "d") move(1, 0);
  else if (key === " " || key === "Enter" || key === "e") interact();
  else if (key === "b") build();
  else return;
  event.preventDefault();
});

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
  if (confirm("Start the Great Land again? All your buildings will be gone.")) {
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
makeVillagers();
draw();
updatePanels();
setInterval(villagersWander, 1200);
setInterval(regrow, 10000);
setInterval(updatePanels, 1000);
