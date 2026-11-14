// The levels mode of Carpet People.
// Sprites, colours, bunny brains and saving live in shared.js.

// ----- Setup -----

// The canvas is like a drawing board we can paint on with code
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Load the save, so we know which character you picked
const save = loadGame();

// ----- Game state (everything the game needs to remember) -----

let levelNumber = 0;   // which level we're on (0 is the first one!)
let map = [];          // the current level, as rows of letters
let playerX = 0;       // the player's column
let playerY = 0;       // the player's row
let crumbsLeft = 0;    // crumbs still to collect
let bunnies = [];      // the dust bunnies on this level
let mouls = [];        // the Mouls on this level
let waiting = false;   // true while we wait (after winning a level or getting caught)

// Find the parts of the page we need to use
const levelText = document.getElementById("level");
const crumbsText = document.getElementById("crumbs");
const message = document.getElementById("message");
const freePlayLink = document.getElementById("free-play-link");

// ----- Loading a level -----

function loadLevel(number) {
  levelNumber = number;
  waiting = false;
  crumbsLeft = 0;
  map = [];
  bunnies = [];
  mouls = [];

  // Go through every row and every letter of the level
  for (let y = 0; y < levels[number].length; y++) {
    const row = levels[number][y].split(""); // turn "#.c" into ["#", ".", "c"]

    for (let x = 0; x < row.length; x++) {
      if (row[x] === "P") {
        playerX = x;
        playerY = y;
        row[x] = "."; // the start square is just floor
      } else if (row[x] === "c") {
        crumbsLeft = crumbsLeft + 1;
      } else if (row[x] === "b") {
        // Make a new dust bunny. dx and dy are the direction it's walking.
        bunnies.push({ x: x, y: y, dx: 0, dy: 0 });
        row[x] = "."; // bunnies walk on floor
      } else if (row[x] === "M") {
        mouls.push({ x: x, y: y, dx: 0, dy: 0 });
        row[x] = ".";
      }
    }

    map.push(row);
  }

  message.textContent = "Collect all the crumbs!";
  updateText();
  draw();
}

// ----- Drawing -----

// Draw the whole level
function draw() {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      drawFloor(ctx, x, y, x * TILE, y * TILE);

      if (map[y][x] === "#") {
        drawSprite(ctx, fibreSprite, x * TILE, y * TILE);
      } else if (map[y][x] === "c") {
        drawSprite(ctx, crumbSprite, x * TILE, y * TILE);
      }
    }
  }

  const playerSprite = characters[save.character].sprite;
  drawSprite(ctx, playerSprite, playerX * TILE, playerY * TILE);

  // Draw every dust bunny
  for (const bunny of bunnies) {
    drawSprite(ctx, bunnySprite, bunny.x * TILE, bunny.y * TILE);
  }

  // And every Moul
  for (const moul of mouls) {
    drawSprite(ctx, moulSprite, moul.x * TILE, moul.y * TILE);
  }
}

function updateText() {
  levelText.textContent = "Level " + (levelNumber + 1);
  crumbsText.textContent = "Crumbs: " + crumbsLeft;
}

// ----- Moving -----

function move(dx, dy) {
  if (waiting) {
    return; // don't move while we're waiting
  }

  const newX = playerX + dx;
  const newY = playerY + dy;

  // Can't walk into carpet fibres!
  if (map[newY][newX] === "#") {
    return;
  }

  playerX = newX;
  playerY = newY;

  // Did we land on a crumb?
  if (map[newY][newX] === "c") {
    map[newY][newX] = ".";
    crumbsLeft = crumbsLeft - 1;
    playCrunch();
  }

  updateText();
  draw();

  const enemy = touchingEnemy();
  if (enemy !== null) {
    getCaught(enemy);
  } else if (crumbsLeft === 0) {
    finishLevel();
  }
}

function finishLevel() {
  waiting = true;

  if (levelNumber + 1 < levels.length) {
    message.textContent = "Level complete!";
    // Wait 1.5 seconds (1500 milliseconds), then load the next level
    setTimeout(function () {
      loadLevel(levelNumber + 1);
    }, 1500);
  } else {
    message.textContent = "You collected every crumb! Free Play unlocked!";
    save.freePlayUnlocked = true;
    saveGame(save);
    freePlayLink.hidden = false;
  }
}

// ----- Dust bunnies -----

// Is an enemy on the same square as the player?
// Gives back "dust bunny" or "Moul", or null if nobody is there.
function touchingEnemy() {
  for (const bunny of bunnies) {
    if (bunny.x === playerX && bunny.y === playerY) {
      return "dust bunny";
    }
  }
  for (const moul of mouls) {
    if (moul.x === playerX && moul.y === playerY) {
      return "Moul";
    }
  }
  return null;
}

function getCaught(enemy) {
  waiting = true;
  message.textContent = "Oh no! A " + enemy + " got you!";
  playPoof();
  // Wait 1.5 seconds, then start the level again
  setTimeout(function () {
    loadLevel(levelNumber);
  }, 1500);
}

// Move all the enemies. This runs over and over on a timer.
function moveEnemies() {
  if (waiting) {
    return;
  }

  for (const bunny of bunnies) {
    moveBunny(bunny, map);
  }

  // Mouls chase you when they're close!
  for (const moul of mouls) {
    moveMoul(moul, map, playerX, playerY, true);
  }

  draw();

  const enemy = touchingEnemy();
  if (enemy !== null) {
    getCaught(enemy);
  }
}

// Run moveEnemies every BUNNY_SPEED milliseconds, forever
setInterval(moveEnemies, BUNNY_SPEED);

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
  } else if (event.key === "r") {
    loadLevel(levelNumber); // restart this level
    return;
  } else {
    return; // some other key: do nothing
  }

  // Stop the arrow keys from scrolling the page
  event.preventDefault();
});

// ----- Start the game! -----

// Already unlocked Free Play before? Show the link straight away.
if (save.freePlayUnlocked) {
  freePlayLink.hidden = false;
}

loadLevel(0);
