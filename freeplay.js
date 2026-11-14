// Free Play mode: explore a giant carpet, fill in the map,
// and do quests to unlock new characters.
// Sprites, colours, bunny brains and saving live in shared.js.

// ----- Setup -----

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const minimap = document.getElementById("minimap");
const miniCtx = minimap.getContext("2d");

// The screen shows 15 x 11 tiles of the world at a time
const VIEW_WIDTH = 15;
const VIEW_HEIGHT = 11;

// How far you can see around you, in tiles (unless your character's power changes it)
const NORMAL_SIGHT = 2;

// Each tile on the mini-map is 4 x 4 pixels
const MINI_TILE = 4;

// Load everything the game remembers
const save = loadGame();

// Find the parts of the page we need to use
const message = document.getElementById("message");
const exploredText = document.getElementById("explored");
const crumbsText = document.getElementById("crumbs");
const questsBox = document.getElementById("quests");
const charactersBox = document.getElementById("characters");

// ----- Game state -----

let map = [];
let playerX = 0;
let playerY = 0;
let startX = 0;
let startY = 0;
let bunnies = [];
let waiting = false;
let totalFloor = 0; // how many squares you can walk on, for working out "explored %"
let totalCrumbs = 0;      // how many crumbs are on the whole carpet
let crumbsThisVisit = 0;  // crumbs eaten since you opened the page
let bunnyTurn = 0;        // counts bunny moves, so Chef Crumble can slow them down
let mouls = [];           // the Mouls roaming the carpet
let shieldUsed = false;   // has Snibril's Brave Heart been used up this visit?

// The four corners of the carpet, for Brocando's quest
const corners = ["1,1", "38,1", "1,22", "38,22"];

// The character you're playing as right now
function player() {
  return characters[save.character];
}

// A Set is like a list that never has the same thing twice.
// We store every square you've seen as text, like "4,7".
const explored = new Set(save.explored);

// ----- Quests -----
// Each quest has a reward: the character it unlocks.
// isDone works out if the quest is finished; progress shows how far along you are.

const quests = [
  {
    title: "Crumb Muncher",
    goal: "Eat 20 crumbs",
    reward: "pip",
    isDone: function () {
      return save.crumbsEaten >= 20;
    },
    progress: function () {
      return Math.min(save.crumbsEaten, 20) + " / 20";
    },
  },
  {
    title: "Explorer",
    goal: "Explore half the carpet",
    reward: "moss",
    isDone: function () {
      return exploredPercent() >= 50;
    },
    progress: function () {
      return Math.min(exploredPercent(), 50) + "% / 50%";
    },
  },
  {
    title: "The Lost Button",
    goal: "Find the giant lost button",
    reward: "king",
    isDone: function () {
      return save.foundButton;
    },
    progress: function () {
      if (save.foundButton) {
        return "Found!";
      }
      return "Somewhere out there...";
    },
  },
  {
    title: "Crumb Collector",
    goal: "Eat every crumb on the carpet in one visit",
    reward: "chef",
    isDone: function () {
      return save.ateAllCrumbs;
    },
    progress: function () {
      if (save.ateAllCrumbs) {
        return "All eaten!";
      }
      return crumbsThisVisit + " / " + totalCrumbs;
    },
  },
  {
    title: "The Journey Begins",
    goal: "Walk 300 steps",
    reward: "snibril",
    isDone: function () {
      return save.stepsTaken >= 300;
    },
    progress: function () {
      return Math.min(save.stepsTaken, 300) + " / 300";
    },
  },
  {
    title: "Big Appetite",
    goal: "Eat 100 crumbs in total",
    reward: "glurk",
    isDone: function () {
      return save.crumbsEaten >= 100;
    },
    progress: function () {
      return Math.min(save.crumbsEaten, 100) + " / 100";
    },
  },
  {
    title: "Map Maker",
    goal: "Explore the whole carpet",
    reward: "pismire",
    isDone: function () {
      return exploredPercent() >= 100;
    },
    progress: function () {
      return exploredPercent() + "% / 100%";
    },
  },
  {
    title: "Royal Tour",
    goal: "Visit all four corners of the carpet",
    reward: "brocando",
    isDone: function () {
      return save.corners.length >= 4;
    },
    progress: function () {
      return save.corners.length + " / 4";
    },
  },
  {
    title: "Moul Hunter",
    goal: "Bonk 3 Mouls (Glurk can do it!)",
    reward: "bane",
    isDone: function () {
      return save.moulsDefeated >= 3;
    },
    progress: function () {
      return Math.min(save.moulsDefeated, 3) + " / 3";
    },
  },
];

// ----- Loading the world -----

function loadWorld() {
  for (let y = 0; y < world.length; y++) {
    const row = world[y].split("");

    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "#") {
        totalFloor = totalFloor + 1;
      }

      if (row[x] === "P") {
        startX = x;
        startY = y;
        row[x] = ".";
      } else if (row[x] === "c") {
        totalCrumbs = totalCrumbs + 1;
      } else if (row[x] === "b") {
        // homeX and homeY remember where it started, so it can be sent back there
        bunnies.push({ x: x, y: y, dx: 0, dy: 0, homeX: x, homeY: y });
        row[x] = ".";
      } else if (row[x] === "M") {
        mouls.push({ x: x, y: y, dx: 0, dy: 0, homeX: x, homeY: y });
        row[x] = ".";
      } else if (row[x] === "B" && save.foundButton) {
        row[x] = "."; // already found it, so it's gone
      }
    }

    map.push(row);
  }

  playerX = startX;
  playerY = startY;
}

// ----- Exploring -----

// Reveal the squares around the player
function reveal() {
  // "||" means "or": use the character's sight, or NORMAL_SIGHT if they don't have one
  const sight = player().sight || NORMAL_SIGHT;

  for (let dy = -sight; dy <= sight; dy++) {
    for (let dx = -sight; dx <= sight; dx++) {
      // Only reveal a round area, not a square
      if (dx * dx + dy * dy <= sight * sight + 1) {
        const x = playerX + dx;
        const y = playerY + dy;
        if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
          explored.add(x + "," + y);
        }
      }
    }
  }
}

// What percentage of the floor have you seen?
function exploredPercent() {
  let seenFloor = 0;
  for (const square of explored) {
    const parts = square.split(",");
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (map[y][x] !== "#") {
      seenFloor = seenFloor + 1;
    }
  }
  return Math.floor((seenFloor / totalFloor) * 100);
}

// ----- Drawing -----

function draw() {
  // The camera tries to keep the player in the middle of the screen,
  // but stops at the edges of the world
  const worldWidth = map[0].length;
  const worldHeight = map.length;
  const cameraX = Math.max(0, Math.min(playerX - 7, worldWidth - VIEW_WIDTH));
  const cameraY = Math.max(0, Math.min(playerY - 5, worldHeight - VIEW_HEIGHT));

  for (let viewY = 0; viewY < VIEW_HEIGHT; viewY++) {
    for (let viewX = 0; viewX < VIEW_WIDTH; viewX++) {
      const x = cameraX + viewX;
      const y = cameraY + viewY;
      const screenX = viewX * TILE;
      const screenY = viewY * TILE;

      // Haven't been here yet? It's dark!
      if (!explored.has(x + "," + y)) {
        ctx.fillStyle = "#0a0014";
        ctx.fillRect(screenX, screenY, TILE, TILE);
        continue; // skip to the next square
      }

      drawFloor(ctx, x, y, screenX, screenY);

      if (map[y][x] === "#") {
        drawSprite(ctx, fibreSprite, screenX, screenY);
      } else if (map[y][x] === "c") {
        drawSprite(ctx, crumbSprite, screenX, screenY);
      } else if (map[y][x] === "B") {
        drawSprite(ctx, buttonSprite, screenX, screenY);
      }
    }
  }

  const playerSprite = characters[save.character].sprite;
  drawSprite(ctx, playerSprite, (playerX - cameraX) * TILE, (playerY - cameraY) * TILE);

  // Only draw bunnies on squares you've explored
  for (const bunny of bunnies) {
    if (explored.has(bunny.x + "," + bunny.y)) {
      drawSprite(ctx, bunnySprite, (bunny.x - cameraX) * TILE, (bunny.y - cameraY) * TILE);
    }
  }

  // Mouls too
  for (const moul of mouls) {
    if (explored.has(moul.x + "," + moul.y)) {
      drawSprite(ctx, moulSprite, (moul.x - cameraX) * TILE, (moul.y - cameraY) * TILE);
    }
  }

  drawMinimap(cameraX, cameraY);
}

function drawMinimap(cameraX, cameraY) {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const seen = explored.has(x + "," + y);

      if (!seen && player().wise && map[y][x] === "c") {
        miniCtx.fillStyle = "#e0a040"; // Pismire knows where every crumb is
      } else if (!seen) {
        miniCtx.fillStyle = "#0a0014";
      } else if (map[y][x] === "#") {
        miniCtx.fillStyle = "#2d6324";
      } else if (map[y][x] === "c") {
        miniCtx.fillStyle = "#e0a040";
      } else if (map[y][x] === "B") {
        miniCtx.fillStyle = "#5d95e8";
      } else {
        miniCtx.fillStyle = "#8c1c3a";
      }
      miniCtx.fillRect(x * MINI_TILE, y * MINI_TILE, MINI_TILE, MINI_TILE);
    }
  }

  // The player is a white dot
  miniCtx.fillStyle = "white";
  miniCtx.fillRect(playerX * MINI_TILE, playerY * MINI_TILE, MINI_TILE, MINI_TILE);

  // A box showing what's on the big screen
  miniCtx.strokeStyle = "#00f0ff";
  miniCtx.strokeRect(
    cameraX * MINI_TILE + 0.5,
    cameraY * MINI_TILE + 0.5,
    VIEW_WIDTH * MINI_TILE - 1,
    VIEW_HEIGHT * MINI_TILE - 1
  );
}

// ----- The panels below the game -----

function updateText() {
  exploredText.textContent = "Explored: " + exploredPercent() + "%";
  crumbsText.textContent = "Crumbs eaten: " + save.crumbsEaten;
}

function showQuests() {
  questsBox.innerHTML = ""; // clear out the old list

  for (const quest of quests) {
    const div = document.createElement("div");
    div.className = "quest";
    if (quest.isDone()) {
      div.className = "quest done";
    }

    const reward = characters[quest.reward].name;
    div.innerHTML =
      "<strong>" + quest.title + "</strong><br>" +
      quest.goal + "<br>" +
      "<span class='progress'>" + quest.progress() + "</span><br>" +
      "Reward: " + reward;

    questsBox.appendChild(div);
  }
}

function showCharacters() {
  charactersBox.innerHTML = "";

  // Object.keys gives us every character's id: "tiny", "pip", "moss", "king"
  for (const id of Object.keys(characters)) {
    const button = document.createElement("button");
    button.className = "character";

    if (save.unlocked.includes(id)) {
      // Draw a little picture of the character on the button
      const picture = document.createElement("canvas");
      picture.width = TILE;
      picture.height = TILE;
      drawSprite(picture.getContext("2d"), characters[id].sprite, 0, 0);
      button.appendChild(picture);
      button.appendChild(document.createElement("br"));
      button.appendChild(document.createTextNode(characters[id].name));

      // Show their special power in small writing
      const power = document.createElement("span");
      power.className = "power";
      power.textContent = characters[id].power;
      button.appendChild(power);

      if (save.character === id) {
        button.className = "character selected";
      }

      button.addEventListener("click", function () {
        save.character = id;
        message.textContent = characters[id].name + "! " + characters[id].power;
        reveal(); // Moss can see further straight away
        save.explored = Array.from(explored);
        saveGame(save);
        updateText();
        showCharacters();
        draw();
        button.blur(); // so the arrow keys go to the game, not the button
      });
    } else {
      button.textContent = "🔒 ???";
      button.disabled = true;
    }

    charactersBox.appendChild(button);
  }
}

// Check every quest, and unlock characters for any that are newly finished
function checkQuests() {
  for (const quest of quests) {
    if (quest.isDone() && !save.unlocked.includes(quest.reward)) {
      save.unlocked.push(quest.reward);
      message.textContent =
        "Quest complete! You unlocked " + characters[quest.reward].name + "!";
      playJingle();
      showCharacters();
    }
  }
  showQuests();
}

// ----- Moving -----

function move(dx, dy) {
  if (waiting) {
    return;
  }

  // Most characters take 1 step. Pip's Dash power lets them take 2!
  const steps = player().steps || 1;

  for (let i = 0; i < steps; i++) {
    const moved = step(dx, dy);
    // Stop early if we hit a wall or a dust bunny
    if (!moved || enemyTouching() !== null) {
      break;
    }
  }

  save.explored = Array.from(explored);
  checkQuests();
  saveGame(save);
  updateText();
  draw();
  checkTouch();
}

// Take one step. Gives back true if we moved, or false if a wall was in the way.
function step(dx, dy) {
  const newX = playerX + dx;
  const newY = playerY + dy;

  if (map[newY][newX] === "#") {
    return false;
  }

  playerX = newX;
  playerY = newY;

  eatCrumb(newX, newY);

  // King Crumb's Crumb Magnet grabs crumbs on the 4 squares next to him too
  if (player().magnet) {
    eatCrumb(newX, newY - 1);
    eatCrumb(newX, newY + 1);
    eatCrumb(newX - 1, newY);
    eatCrumb(newX + 1, newY);
  }

  if (map[newY][newX] === "B") {
    map[newY][newX] = ".";
    save.foundButton = true;
    message.textContent = "You found the giant lost button!";
  }

  save.stepsTaken = save.stepsTaken + 1;
  visitCorner();
  reveal();
  return true;
}

// If we're standing in a corner we haven't visited yet, remember it
function visitCorner() {
  const here = playerX + "," + playerY;
  if (corners.includes(here) && !save.corners.includes(here)) {
    save.corners.push(here);
    message.textContent = "You reached a corner of the carpet!";
  }
}

// If there's a crumb on this square, eat it
function eatCrumb(x, y) {
  if (map[y][x] !== "c") {
    return;
  }

  map[y][x] = ".";
  save.crumbsEaten = save.crumbsEaten + 1;
  crumbsThisVisit = crumbsThisVisit + 1;
  playCrunch();

  // Was that the very last crumb?
  if (crumbsThisVisit === totalCrumbs) {
    save.ateAllCrumbs = true;
  }
}

// ----- Dust bunnies -----

// Is a dust bunny or Moul on the same square as the player?
// Gives back the enemy if there is one, or null if not.
function enemyTouching() {
  for (const enemy of bunnies.concat(mouls)) {
    if (enemy.x === playerX && enemy.y === playerY) {
      return enemy;
    }
  }
  return null;
}

// Send an enemy back to where it started
function sendHome(enemy) {
  enemy.x = enemy.homeX;
  enemy.y = enemy.homeY;
}

// Check if an enemy has got us, and what happens next
function checkTouch() {
  const enemy = enemyTouching();
  if (enemy === null) {
    return; // phew, nobody here
  }

  // Glurk's Mighty Spear bonks enemies away!
  if (player().strong) {
    sendHome(enemy);
    playBonk();
    if (mouls.includes(enemy)) {
      save.moulsDefeated = save.moulsDefeated + 1;
      message.textContent = "Glurk bonks the Moul away!";
      checkQuests();
      saveGame(save);
    } else {
      message.textContent = "Glurk shoos the dust bunny away!";
    }
    return;
  }

  // Snibril's Brave Heart saves him once per visit
  if (player().shield && !shieldUsed) {
    shieldUsed = true;
    sendHome(enemy);
    playBonk();
    message.textContent = "Snibril's Brave Heart saves him! (Only works once!)";
    return;
  }

  getCaught();
}

// In Free Play you don't lose anything. You just go back to the start.
function getCaught() {
  waiting = true;
  message.textContent = "You got caught! Back to the start...";
  playPoof();
  setTimeout(function () {
    playerX = startX;
    playerY = startY;
    waiting = false;
    message.textContent = "Keep exploring!";
    draw();
  }, 1500);
}

// Move all the dust bunnies and Mouls. This runs over and over on a timer.
function moveEnemies() {
  if (waiting) {
    return;
  }

  // Chef Crumble's Bunny Treats: the bunnies skip every other move
  bunnyTurn = bunnyTurn + 1;
  const bunniesRest = player().slowBunnies && bunnyTurn % 2 === 0;

  if (!bunniesRest) {
    for (const bunny of bunnies) {
      moveBunny(bunny, map);
    }
  }

  // Mouls chase you, unless you're Bane (they can't see him!)
  for (const moul of mouls) {
    moveMoul(moul, map, playerX, playerY, !player().sneaky);
  }

  draw();
  checkTouch();
}

// ----- Keyboard controls -----

document.addEventListener("keydown", function (event) {
  if (event.key === "ArrowUp" || event.key === "w") {
    move(0, -1);
  } else if (event.key === "ArrowDown" || event.key === "s") {
    move(0, 1);
  } else if (event.key === "ArrowLeft" || event.key === "a") {
    move(-1, 0);
  } else if (event.key === "ArrowRight" || event.key === "d") {
    move(1, 0);
  } else {
    return;
  }
  event.preventDefault();
});

// ----- Start! -----

if (save.freePlayUnlocked) {
  document.getElementById("game-area").hidden = false;
  loadWorld();
  reveal();
  showQuests();
  showCharacters();
  updateText();
  draw();
  visitCorner(); // you start in a corner!
  saveGame(save);
  setInterval(moveEnemies, BUNNY_SPEED);
} else {
  document.getElementById("locked").hidden = false;
}
