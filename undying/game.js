// The Undying Lands: the main game.
// The story lives in story.js, the map in world.js, the pixel art in sprites.js,
// and the 3D drawing in render.js.

// ----- Saving -----

const SAVE_NAME = "undyingLandsSave2";

function loadSave() {
  const save = {
    metGandalf: false,
    bilbo: "unmet",
    elrond: "unmet",
    galadriel: "unmet",
    legolas: "unmet",
    gimli: "unmet",
    samArrived: false,
    theEnd: false,
    pages: 0,
    herbs: 0,
    pearls: 0,
    crystals: 0,
    feathers: 0,
    collected: [], // items you've picked up, like "12,14"
    playerX: null,
    playerY: null,
  };
  try {
    const text = localStorage.getItem(SAVE_NAME);
    if (text) {
      Object.assign(save, JSON.parse(text));
    }
  } catch (error) {
    // No save, or the browser won't let us read it. Start fresh.
  }
  return save;
}

function saveGame() {
  save.playerX = playerX;
  save.playerY = playerY;
  try {
    localStorage.setItem(SAVE_NAME, JSON.stringify(save));
  } catch (error) {
    // Couldn't save. The game still works.
  }
}

const save = loadSave();

// ----- Reading the map -----

const WALKABLE = ".,=:Dn"; // the kinds of ground you can walk on
const SAM_X = 58;          // where Sam appears at the end, on the dock
const SAM_Y = 24;

// What each collectable item is
const itemTypes = {
  q: { name: "one of Bilbo's pages", sprite: pageSprite, colour: "#f3e9c8", counter: "pages" },
  h: { name: "a silverleaf herb", sprite: herbSprite, colour: "#b8e0a8", counter: "herbs" },
  o: { name: "the sea pearl", sprite: pearlSprite, colour: "#ffffff", counter: "pearls" },
  x: { name: "a glittering crystal", sprite: crystalSprite, colour: "#7fe0ff", counter: "crystals" },
  f: { name: "a swan feather", sprite: featherSprite, colour: "#ffffff", counter: "feathers" },
};

let ground = [];        // just the ground: grass, sand, walls...
let items = [];         // things to pick up
let characters = [];    // people standing on the map
let playerX = 0;
let playerY = 0;
let facingLeft = false;
let facingX = 0;        // the direction Frodo is facing,
let facingY = 1;        // for talking to people

// People and items stand on ground too. Guess what's underneath them
// by looking at the ground next to them.
function groundUnder(x, y) {
  const counts = {};
  let best = ".";
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const letter = world[y + dy][x + dx];
    if (WALKABLE.includes(letter)) {
      counts[letter] = (counts[letter] || 0) + 1;
      if (counts[letter] > (counts[best] || 0)) {
        best = letter;
      }
    }
  }
  return best;
}

function readMap() {
  for (let y = 0; y < world.length; y++) {
    const row = [];
    for (let x = 0; x < world[y].length; x++) {
      const letter = world[y][x];
      const key = x + "," + y;

      if (people[letter]) {
        // Animals can appear more than once, so give each one its own id like "7@40,27"
        const id = people[letter].wanders ? letter + "@" + key : letter;
        characters.push({ id: id, kind: letter, x: x, y: y, facingLeft: false });
        row.push(groundUnder(x, y));
      } else if (itemTypes[letter]) {
        if (!save.collected.includes(key)) {
          items.push({ key: key, letter: letter, x: x, y: y });
        }
        row.push(groundUnder(x, y));
      } else if (letter === "P") {
        playerX = x;
        playerY = y;
        row.push(groundUnder(x, y));
      } else {
        row.push(letter);
      }
    }
    ground.push(row);
  }

  // Carry on from where you were last time
  if (save.playerX !== null) {
    playerX = save.playerX;
    playerY = save.playerY;
  }

  if (save.samArrived) {
    addSam();
  }
}

function addSam() {
  if (!characters.some(function (c) { return c.id === "M"; })) {
    characters.push({ id: "M", kind: "M", x: SAM_X, y: SAM_Y });
  }
}

// ----- Finding things -----

function personAt(x, y) {
  return characters.find(function (c) { return c.x === x && c.y === y; });
}

function canWalk(x, y) {
  return WALKABLE.includes(ground[y][x]) && !personAt(x, y);
}

// Who could Frodo talk to right now? Whoever he's facing, or anyone next to him.
function nearbyPerson() {
  const facing = personAt(playerX + facingX, playerY + facingY);
  if (facing) {
    return facing;
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const person = personAt(playerX + dx, playerY + dy);
    if (person) {
      return person;
    }
  }
  return null;
}

// ----- The page -----

const canvas = document.getElementById("game");
const view = createWorldView(canvas);
const dialogueBox = document.getElementById("dialogue");
const dialogueName = document.getElementById("dialogue-name");
const dialogueText = document.getElementById("dialogue-text");
const promptBox = document.getElementById("prompt");
const toast = document.getElementById("toast");
const questList = document.getElementById("quests");
const bag = document.getElementById("bag");
const theEndBox = document.getElementById("the-end");
const minimap = document.getElementById("minimap");
const minimapPen = minimap.getContext("2d");
const regionText = document.getElementById("region");

function draw() {
  view.sync({
    player: { x: playerX, y: playerY, facingLeft: facingLeft },
    people: characters.map(function (c) {
      const person = { id: c.id, x: c.x, y: c.y, sprite: people[c.kind].sprite };
      if (people[c.kind].wanders) {
        person.facingLeft = c.facingLeft; // animals face where they're walking
      }
      return person;
    }),
    items: items.map(function (item) {
      const type = itemTypes[item.letter];
      return { key: item.key, x: item.x, y: item.y, sprite: type.sprite, colour: type.colour };
    }),
  });
}

function updatePanels() {
  questList.innerHTML = "";
  for (const line of questLog(save)) {
    const li = document.createElement("li");
    li.textContent = line;
    if (line.startsWith("✔")) {
      li.className = "done";
    }
    questList.appendChild(li);
  }
  bag.textContent =
    "📜 Pages: " + save.pages + "   🌿 Herbs: " + save.herbs + "   ⚪ Pearls: " + save.pearls +
    "\n💎 Crystals: " + save.crystals + "   🪶 Feathers: " + save.feathers;
  drawMinimap();

  // Show "Space: Talk to ..." when someone is next to you
  const person = nearbyPerson();
  if (person && !talking) {
    promptBox.textContent = "Space: Talk to " + people[person.kind].name;
    promptBox.hidden = false;
  } else {
    promptBox.hidden = true;
  }
}

// A message that pops up for a couple of seconds
let toastTimer = null;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.hidden = true;
  }, 2500);
}

// ----- Little sounds (using sounds.js from the arcade) -----

function playBlip() {
  playTone(0, 0.03, 720, 720, 0.03);
}

function playChime() {
  playTone(0, 0.08, 880, 880, 0.07);
  playTone(0.08, 0.15, 1320, 1320, 0.07);
}

// ----- Moving -----

function move(dx, dy) {
  facingX = dx;
  facingY = dy;
  if (dx < 0) facingLeft = true;
  if (dx > 0) facingLeft = false;

  const newX = playerX + dx;
  const newY = playerY + dy;
  if (canWalk(newX, newY)) {
    playerX = newX;
    playerY = newY;
    pickUp();
    checkRegion();
    saveGame();
  }

  draw();
  updatePanels();
}

// Pick up any item where Frodo is standing
function pickUp() {
  const item = items.find(function (i) { return i.x === playerX && i.y === playerY; });
  if (!item) {
    return;
  }
  const type = itemTypes[item.letter];
  items = items.filter(function (i) { return i !== item; });
  save.collected.push(item.key);
  save[type.counter] = save[type.counter] + 1;
  playChime();
  showToast("You found " + type.name + "!");
}

// ----- Talking -----

let talking = false;
let lines = [];
let lineNumber = 0;
let typing = null;   // the timer that types out letters one by one
let shownLetters = 0;
let afterTalk = null;

function startTalking(person) {
  const result = talk(person.kind, save);
  talking = true;
  lines = result.lines;
  lineNumber = 0;
  dialogueName.textContent = people[person.kind].name;
  dialogueBox.hidden = false;
  promptBox.hidden = true;

  if (save.samArrived) {
    addSam();
  }
  afterTalk = function () {
    if (result.jingle) {
      playJingle();
    }
    if (result.end) {
      theEndBox.hidden = false;
    }
  };

  showLine();
  saveGame();
}

// Type out the current line one letter at a time, like an old console game
function showLine() {
  const line = lines[lineNumber];
  shownLetters = 0;
  dialogueText.textContent = "";
  clearInterval(typing);
  typing = setInterval(function () {
    shownLetters = shownLetters + 1;
    dialogueText.textContent = line.slice(0, shownLetters);
    if (shownLetters % 3 === 0) {
      playBlip();
    }
    if (shownLetters >= line.length) {
      clearInterval(typing);
      typing = null;
    }
  }, 25);
}

// Space while talking: finish typing the line, or go to the next one
function nextLine() {
  if (typing !== null) {
    clearInterval(typing);
    typing = null;
    dialogueText.textContent = lines[lineNumber];
    return;
  }

  lineNumber = lineNumber + 1;
  if (lineNumber < lines.length) {
    showLine();
  } else {
    talking = false;
    dialogueBox.hidden = true;
    afterTalk();
    draw();
    updatePanels();
  }
}

// ----- Areas and the mini-map -----

let currentRegion = null;

// Which named area is this square in?
function regionAt(x, y) {
  for (const region of regions) {
    if (x >= region.x1 && x <= region.x2 && y >= region.y1 && y <= region.y2) {
      return region.name;
    }
  }
  return "The Island";
}

// When Frodo walks into a new area, show its name
function checkRegion() {
  const name = regionAt(playerX, playerY);
  if (name !== currentRegion) {
    currentRegion = name;
    regionText.textContent = name;
    showToast("~ " + name + " ~");
  }
}

// The colour of each kind of square on the mini-map
const mapColours = {
  "~": "#3b7fd0", ":": "#e8d7a2", ".": "#62b34b", ",": "#8fd46f", "=": "#c9cad6",
  "n": "#4f9a3a", "D": "#8b5a2b", "#": "#ffffff", "H": "#3a80a8", "I": "#f2c443",
  "Y": "#f2c443", "T": "#c8b84a", "!": "#2f6b3a", "^": "#8d8794", "*": "#ffffff", "S": "#ffffff",
};
const MINI = 3; // each square is 3 x 3 pixels on the mini-map

function drawMinimap() {
  for (let y = 0; y < ground.length; y++) {
    for (let x = 0; x < ground[y].length; x++) {
      minimapPen.fillStyle = mapColours[ground[y][x]] || "#62b34b";
      minimapPen.fillRect(x * MINI, y * MINI, MINI, MINI);
    }
  }

  // Friends you can do quests for are gold dots. Elves are light blue.
  for (const c of characters) {
    if (people[c.kind].wanders) {
      continue;
    }
    minimapPen.fillStyle = people[c.kind].lines ? "#9fd0ff" : "#f2c443";
    minimapPen.fillRect(c.x * MINI - 1, c.y * MINI - 1, MINI + 2, MINI + 2);
  }

  // Frodo is a red dot with a dark border
  minimapPen.fillStyle = "#1e1a24";
  minimapPen.fillRect(playerX * MINI - 2, playerY * MINI - 2, MINI + 4, MINI + 4);
  minimapPen.fillStyle = "#ff4d4d";
  minimapPen.fillRect(playerX * MINI - 1, playerY * MINI - 1, MINI + 2, MINI + 2);
}

// ----- Animals wander about -----

function moveAnimals() {
  if (talking) {
    return; // everyone holds still while you talk
  }
  let moved = false;
  for (const c of characters) {
    if (!people[c.kind].wanders || Math.random() < 0.5) {
      continue; // people stay put, and animals often stop to rest
    }
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
    const newX = c.x + dx;
    const newY = c.y + dy;
    const isPlayerThere = newX === playerX && newY === playerY;
    if (canWalk(newX, newY) && !isPlayerThere) {
      c.x = newX;
      c.y = newY;
      if (dx !== 0) {
        c.facingLeft = dx < 0;
      }
      moved = true;
    }
  }
  if (moved) {
    draw();
    updatePanels();
  }
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
    return; // no walking while talking!
  }

  if (key === "ArrowUp" || key === "w") {
    move(0, -1);
  } else if (key === "ArrowDown" || key === "s") {
    move(0, 1);
  } else if (key === "ArrowLeft" || key === "a") {
    move(-1, 0);
  } else if (key === "ArrowRight" || key === "d") {
    move(1, 0);
  } else if (isAction) {
    const person = nearbyPerson();
    if (person) {
      startTalking(person);
    }
  } else {
    return;
  }
  event.preventDefault();
});

document.getElementById("close-the-end").addEventListener("click", function () {
  theEndBox.hidden = true;
});

document.getElementById("new-game").addEventListener("click", function () {
  if (confirm("Start a new game? Your progress will be lost.")) {
    try {
      localStorage.removeItem(SAVE_NAME);
    } catch (error) {
      // nothing to remove
    }
    location.reload();
  }
});

// ----- Start! -----

readMap();
view.build(ground);
draw();
updatePanels();
checkRegion();
setInterval(moveAnimals, 900);
if (!save.metGandalf) {
  showToast("Welcome to the Undying Lands! Gandalf is waiting nearby.");
}
