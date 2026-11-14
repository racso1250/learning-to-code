// Diamond Isles: explore islands and collect every diamond to unlock the next one!
// The islands are made in islands.js, the pixel art is in sprites.js,
// and the drawing happens in render.js.

// ----- Saving -----

const SAVE_NAME = "diamondIslesSave";

function loadSave() {
  const save = {
    unlocked: 1,     // how many islands you can visit
    current: 0,      // which island you're on (0 = the first one)
    found: {},       // diamonds found on each island, like { "0": ["12,5", "20,8"] }
    explored: {},    // the squares you've seen on each island, as a string of 0s and 1s
    items: { pickaxe: false, staff: false, cloak: false }, // tools from Bobby
  };
  try {
    const text = localStorage.getItem(SAVE_NAME);
    if (text) {
      Object.assign(save, JSON.parse(text));
    }
  } catch (error) {
    // No save yet, or the browser won't let us read it
  }
  return save;
}

function saveGame() {
  save.explored[islandNumber] = Array.from(explored).join("");
  try {
    localStorage.setItem(SAVE_NAME, JSON.stringify(save));
  } catch (error) {
    // Couldn't save. The game still works.
  }
}

const save = loadSave();

// ----- Game state -----

let islandNumber = 0;
let island = null;
let playerX = 0;
let playerY = 0;
let facing = "down";
let diamonds = [];       // diamonds still to find on this island
let explored = null;     // one number per square: 1 = seen, 0 = not seen yet
let travelling = false;  // true while going through the portal

const SIGHT = 4; // how far you can see, for the map

// ----- Bobby and his tools -----
// Bobby turns up near the start of every island, with a different tool each time.

const bobbyGifts = [
  {
    item: "pickaxe",
    lines: [
      "Oi! Hello there! Name's Bobby. I go exploring too, but mostly I collect tools.",
      "Here, have this PICKAXE! Walk into a rock and you'll smash it to bits.",
    ],
    after: "Smashed any good rocks lately? Some of them are hiding shortcuts!",
  },
  {
    item: "staff",
    lines: [
      "Brrr! Bobby again! Told you I go everywhere.",
      "Take this magic STAFF. With it, you can jump up and down cliffs TWO steps high!",
    ],
    after: "Hop, hop, hop! That staff is the best thing I ever found.",
  },
  {
    item: "cloak",
    lines: [
      "Hot, hot, HOT! Good thing I brought this along.",
      "A FIRE CLOAK! Wear it and you can walk right across the lava. Don't worry, it doesn't even tickle.",
    ],
    after: "Looking very fiery in that cloak, my friend!",
  },
  {
    item: null,
    lines: ["This is it: Dusk Island, the biggest island of all. I'm just here for the sunset."],
    after: "Good luck finding all those diamonds! I'll be right here, enjoying the view.",
  },
];

const itemNames = { pickaxe: "⛏️ Pickaxe", staff: "🪄 Staff", cloak: "🧥 Fire cloak" };

let bobby = null; // where Bobby is standing on this island

// Put Bobby near the start, somewhere he won't block the way to any diamond
function placeBobby() {
  bobby = null;
  const start = island.start;
  const spots = [[-2, 0], [2, 0], [-2, -1], [2, -1], [0, -2], [-1, -2], [1, -2], [-3, 0], [3, 0]];
  for (const [dx, dy] of spots) {
    const x = start.x + dx;
    const y = start.y + dy;
    const tile = island.tiles[y] && island.tiles[y][x];
    if (!tile || !isWalkable(tile)) continue;

    tile.thing = "person"; // pretend he's standing there, and check nothing gets blocked
    const reachable = findReachable(island.tiles, start.x, start.y);
    const diamondsOk = island.diamonds.every(function (d) {
      return reachable.has(d.x + "," + d.y);
    });
    const canReachHim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function ([nx, ny]) {
      return reachable.has(x + nx + "," + (y + ny));
    });
    if (diamondsOk && canReachHim) {
      bobby = { x: x, y: y };
      return;
    }
    tile.thing = null; // not a good spot, try the next one
  }
}

function nextToBobby() {
  return bobby !== null && Math.abs(bobby.x - playerX) + Math.abs(bobby.y - playerY) === 1;
}

// ----- The page -----

const canvas = document.getElementById("game");
const view = createIslandView(canvas);
const islandName = document.getElementById("island-name");
const diamondCount = document.getElementById("diamond-count");
const islandButtons = document.getElementById("island-buttons");
const minimap = document.getElementById("minimap");
const mapPen = minimap.getContext("2d");
const toast = document.getElementById("toast");
const fade = document.getElementById("fade");
const winBox = document.getElementById("win");
const dialogueBox = document.getElementById("dialogue");
const dialogueText = document.getElementById("dialogue-text");
const promptBox = document.getElementById("prompt");
const bag = document.getElementById("bag");

let toastTimer = null;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.hidden = true;
  }, 2800);
}

// ----- Sounds (from the arcade's sounds.js) -----

function playStep() {
  playTone(0, 0.03, 180, 120, 0.03);
}

function playDiamond() {
  playTone(0, 0.07, 1046, 1046, 0.07);
  playTone(0.07, 0.07, 1318, 1318, 0.07);
  playTone(0.14, 0.2, 1568, 1568, 0.07);
}

function playWhoosh() {
  playNoise(0, 1, 300, 4000, 0.3);
  playTone(0, 1, 200, 1200, 0.05);
}

// ----- Islands -----

function foundHere() {
  if (!save.found[islandNumber]) {
    save.found[islandNumber] = [];
  }
  return save.found[islandNumber];
}

function allFound() {
  return diamonds.length === 0;
}

// Is there another island after this one?
function hasNextIsland() {
  return islandNumber + 1 < islands.length;
}

// The small portal appears on the starting beach...
function hasSmallPortal() {
  return allFound() && hasNextIsland() && !islands[islandNumber].bigPortal;
}

// ...but some islands get a MASSIVE portal that rises from the sea instead.
// It stands out in the water, with a path of stepping stones from the beach.
let bigPortalSpot = null;

function raiseBigPortal(instant) {
  const path = [];
  let y = island.start.y + 1;
  while (y < island.size - 1 && path.length < 4) {
    path.push({ x: island.start.x, y: y });
    y = y + 1;
  }
  // Turn those sea squares into a walkable stone path
  for (const spot of path) {
    island.tiles[spot.y][spot.x] = { kind: "bridge", height: 0, thing: null };
  }
  bigPortalSpot = path[path.length - 1];
  view.openBigPortal(path, bigPortalSpot, instant);
}

function loadIsland(number) {
  islandNumber = number;
  save.current = number;
  island = buildIsland(islands[number]);
  playerX = island.start.x;
  playerY = island.start.y;
  facing = "down";

  // Only the diamonds you haven't found yet
  diamonds = island.diamonds.filter(function (d) {
    return !foundHere().includes(d.x + "," + d.y);
  });

  // What you've explored before
  const size = island.size * island.size;
  explored = new Uint8Array(size);
  const saved = save.explored[number];
  if (saved && saved.length === size) {
    for (let i = 0; i < size; i++) {
      explored[i] = saved[i] === "1" ? 1 : 0;
    }
  }

  view.load(island);
  placeBobby();
  bigPortalSpot = null;
  if (allFound() && hasNextIsland() && islands[number].bigPortal) {
    raiseBigPortal(true); // you already finished this island, so it's already there
  }
  reveal();
  draw();
  updatePanels();
  saveGame();
  showToast("~ " + islands[number].name + " ~");
}

// ----- Drawing -----

function draw() {
  view.sync({
    player: {
      x: playerX,
      y: playerY,
      facing: facing,
      // The fire cloak turns your blue shirt fiery red!
      swaps: save.items.cloak ? cloakColours : null,
    },
    people: bobby ? [{ id: "bobby", x: bobby.x, y: bobby.y, sprite: bobbySprite }] : [],
    diamonds: diamonds.map(function (d) {
      return { key: d.x + "," + d.y, x: d.x, y: d.y };
    }),
    portalOpen: hasSmallPortal(),
  });
}

function updatePanels() {
  const total = island.diamonds.length;
  islandName.textContent = (islandNumber + 1) + ". " + islands[islandNumber].name;
  diamondCount.textContent = "💎 " + (total - diamonds.length) + " / " + total;

  // A button for each island. Locked ones show a padlock.
  islandButtons.innerHTML = "";
  islands.forEach(function (config, number) {
    const button = document.createElement("button");
    if (number < save.unlocked) {
      button.textContent = (number + 1) + ". " + config.name;
      if (number === islandNumber) {
        button.className = "current";
      }
      button.addEventListener("click", function () {
        button.blur(); // so the arrow keys go to the game
        if (number !== islandNumber) {
          loadIsland(number);
        }
      });
    } else {
      button.textContent = "🔒 Island " + (number + 1);
      button.disabled = true;
    }
    islandButtons.appendChild(button);
  });

  // The bag shows which of Bobby's tools you have
  bag.innerHTML = "";
  for (const item of Object.keys(itemNames)) {
    const line = document.createElement("p");
    line.textContent = save.items[item] ? itemNames[item] + " ✔" : "❔ ???";
    line.className = save.items[item] ? "have" : "";
    bag.appendChild(line);
  }

  promptBox.hidden = !(nextToBobby() && !talking);
  drawMinimap();
}

// ----- The map: it fills in as you explore -----

// Mark everything near the explorer as seen
function reveal() {
  for (let dy = -SIGHT; dy <= SIGHT; dy++) {
    for (let dx = -SIGHT; dx <= SIGHT; dx++) {
      const x = playerX + dx;
      const y = playerY + dy;
      if (x >= 0 && y >= 0 && x < island.size && y < island.size && dx * dx + dy * dy <= SIGHT * SIGHT) {
        explored[y * island.size + x] = 1;
      }
    }
  }
}

function drawMinimap() {
  const size = island.size;
  const scale = Math.floor(minimap.width / size);
  const theme = island.theme;
  mapPen.fillStyle = "#0b1a2a";
  mapPen.fillRect(0, 0, minimap.width, minimap.height);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!explored[y * size + x]) continue; // not seen yet: stays dark
      const tile = island.tiles[y][x];
      let colour = theme.water[0];
      if (tile.kind === "beach") colour = theme.beachTop[0];
      if (tile.kind === "ground") colour = theme.groundTop[tile.height % 2];
      if (tile.kind === "peak") colour = theme.peakTop[0];
      if (tile.kind === "lava") colour = theme.lavaTop[0];
      if (tile.kind === "bridge") colour = "#b8b0c8";
      if (tile.thing === "tree") colour = "#2f7a3a";
      if (tile.thing === "rock") colour = "#8a8794";
      mapPen.fillStyle = colour;
      mapPen.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  // Diamonds you've spotted
  for (const d of diamonds) {
    if (explored[d.y * size + d.x]) {
      mapPen.fillStyle = theme.diamond[0];
      mapPen.fillRect(d.x * scale - 1, d.y * scale - 1, scale + 2, scale + 2);
    }
  }

  // The portal
  const spot = portalSpot();
  if (spot) {
    mapPen.fillStyle = "#c79bff";
    mapPen.fillRect(spot.x * scale - 2, spot.y * scale - 2, scale + 4, scale + 4);
  }

  // Bobby is a green dot
  if (bobby && explored[bobby.y * size + bobby.x]) {
    mapPen.fillStyle = "#4fae4a";
    mapPen.fillRect(bobby.x * scale - 1, bobby.y * scale - 1, scale + 2, scale + 2);
  }

  // You!
  mapPen.fillStyle = "#1d1726";
  mapPen.fillRect(playerX * scale - 2, playerY * scale - 2, scale + 4, scale + 4);
  mapPen.fillStyle = "#ff4d4d";
  mapPen.fillRect(playerX * scale - 1, playerY * scale - 1, scale + 2, scale + 2);
}

// ----- Moving -----

const cloakColours = { b: "#e0602a", B: "#a8401a" };

// Show a hint, but not too often
let lastWarning = 0;
function warn(text) {
  if (Date.now() - lastWarning > 2000) {
    lastWarning = Date.now();
    showToast(text);
  }
}

function move(dx, dy) {
  if (travelling || talking) return;

  if (dx < 0) facing = "left";
  if (dx > 0) facing = "right";
  if (dy < 0) facing = "up";
  if (dy > 0) facing = "down";

  const newX = playerX + dx;
  const newY = playerY + dy;
  const here = island.tiles[playerY][playerX];
  const there = island.tiles[newY] && island.tiles[newY][newX];
  const biggestStep = save.items.staff ? 2 : 1; // the staff lets you jump higher!

  if (!there || there.kind === "water" || there.thing === "tree" || there.thing === "person") {
    // Can't go there
  } else if (there.thing === "rock") {
    if (save.items.pickaxe) {
      // Smash!
      there.thing = null;
      view.smashRock(newX, newY);
      playNoise(0, 0.3, 2500, 200, 0.5);
    } else {
      warn("A big rock is in the way. If only you had a pickaxe...");
    }
  } else if (there.kind === "lava" && !save.items.cloak) {
    warn("Lava! Much too hot to walk on...");
  } else if (Math.abs(there.height - here.height) > biggestStep) {
    warn(there.height > here.height ? "Too high to climb! Find another way up." : "Too far to jump down!");
  } else {
    playerX = newX;
    playerY = newY;
    playStep();
    reveal();
    pickUpDiamond();
    checkPortal();
    saveGame();
  }

  draw();
  updatePanels();
}

// ----- Talking to Bobby -----

let talking = false;
let lines = [];
let lineNumber = 0;
let gift = null;

function startTalking() {
  const gifts = bobbyGifts[Math.min(islandNumber, bobbyGifts.length - 1)];
  gift = null;
  if (gifts.item && !save.items[gifts.item]) {
    lines = gifts.lines;
    gift = gifts.item;
  } else if (!gifts.item) {
    lines = gifts.lines.concat([gifts.after]); // no tool here, just a chat
  } else {
    lines = [gifts.after];
  }
  lineNumber = 0;
  talking = true;
  dialogueText.textContent = lines[0];
  dialogueBox.hidden = false;
  promptBox.hidden = true;
  playTone(0, 0.05, 600, 600, 0.05);
}

function nextLine() {
  lineNumber = lineNumber + 1;
  if (lineNumber < lines.length) {
    dialogueText.textContent = lines[lineNumber];
    playTone(0, 0.05, 600, 600, 0.05);
    return;
  }
  // Finished talking
  talking = false;
  dialogueBox.hidden = true;
  if (gift) {
    save.items[gift] = true;
    playJingle();
    showToast("You got the " + itemNames[gift] + "!");
    saveGame();
  }
  draw();
  updatePanels();
}

function pickUpDiamond() {
  const diamond = diamonds.find(function (d) {
    return d.x === playerX && d.y === playerY;
  });
  if (!diamond) return;

  diamonds = diamonds.filter(function (d) {
    return d !== diamond;
  });
  foundHere().push(diamond.x + "," + diamond.y);
  playDiamond();

  const total = island.diamonds.length;
  if (!allFound()) {
    showToast("💎 Diamond! " + (total - diamonds.length) + " of " + total);
  } else if (hasNextIsland() && islands[islandNumber].bigPortal) {
    // The ground shakes, and a massive portal rises from the sea!
    save.unlocked = Math.max(save.unlocked, islandNumber + 2);
    playJingle();
    playNoise(0.5, 3, 200, 50, 0.6); // a deep rumble
    raiseBigPortal(false);
    showToast("The ground shakes... A MASSIVE portal is rising from the sea by the beach where you started!");
  } else if (hasNextIsland()) {
    // Unlock the next island!
    save.unlocked = Math.max(save.unlocked, islandNumber + 2);
    playJingle();
    showToast("All diamonds found! A portal has opened on the beach where you started!");
  } else {
    playJingle();
    winBox.hidden = false;
  }
  updatePanels();
}

// Where is the open portal? (null if there isn't one)
function portalSpot() {
  if (bigPortalSpot) return bigPortalSpot;
  if (hasSmallPortal()) return island.start;
  return null;
}

// Walk into the open portal to travel to the next island
function checkPortal() {
  const spot = portalSpot();
  if (!spot || playerX !== spot.x || playerY !== spot.y) {
    return;
  }
  travelling = true;
  playWhoosh();
  fade.className = "on"; // fade the screen to white
  setTimeout(function () {
    loadIsland(islandNumber + 1);
    fade.className = "";
    travelling = false;
  }, 900);
}

// ----- Keyboard -----

document.addEventListener("keydown", function (event) {
  const key = event.key;
  const isAction = key === " " || key === "Enter" || key === "e";
  if (talking) {
    if (isAction) {
      nextLine();
      event.preventDefault();
    }
    return;
  }
  if (isAction && nextToBobby()) {
    startTalking();
  } else if (key === "ArrowUp" || key === "w") {
    move(0, -1);
  } else if (key === "ArrowDown" || key === "s") {
    move(0, 1);
  } else if (key === "ArrowLeft" || key === "a") {
    move(-1, 0);
  } else if (key === "ArrowRight" || key === "d") {
    move(1, 0);
  } else {
    return;
  }
  event.preventDefault();
});

document.getElementById("close-win").addEventListener("click", function () {
  winBox.hidden = true;
});

document.getElementById("new-game").addEventListener("click", function () {
  if (confirm("Start a new game? All your diamonds will be lost.")) {
    try {
      localStorage.removeItem(SAVE_NAME);
    } catch (error) {
      // nothing to remove
    }
    location.reload();
  }
});

// ----- Start! -----

loadIsland(Math.min(save.current, save.unlocked - 1));
