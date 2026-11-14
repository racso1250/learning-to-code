// Temple Guardian: gather materials, craft weapons and tools,
// fight off the Gloom and save all four temples!
//
// The world and recipes are in world.js, the pixel art is in sprites.js,
// and the drawing happens in render.js.

// ----- Saving -----

const SAVE_NAME = "templeGuardianSave";

function freshSave() {
  const save = {
    started: false,
    x: START.x,
    y: START.y,
    hearts: 10,
    bag: {},           // materials, like { wood: 5, stone: 2 }
    made: {},          // crafted things, like { woodSword: 1, potion: 2 }
    temples: {},       // each temple's health, and whether it's saved
    kingAwake: false,
    kingDefeated: false,
    gathered: { temple: {} }, // squares you've gathered from in each area, and when (they grow back!)
    metSpirit: false,
    // Free Play
    area: "temple",
    positions: {},     // where you were in each area
    areas: ["temple"], // areas you've unlocked
    character: "guardian",
    characters: ["guardian"],
    stats: {},         // things you've done in Free Play, for quests
    questsDone: [],
  };
  for (const temple of temples) {
    save.temples[temple.id] = { health: 100, saved: false };
  }
  return save;
}

function loadSave() {
  const save = freshSave();
  try {
    const text = localStorage.getItem(SAVE_NAME);
    if (text) Object.assign(save, JSON.parse(text));
    // Older saves kept gathered squares for just one area
    if (Object.keys(save.gathered).some((k) => k.includes(","))) save.gathered = { temple: save.gathered };
  } catch (error) {
    // No save yet, or the browser won't let us read it
  }
  return save;
}

function saveGame() {
  save.x = playerX;
  save.y = playerY;
  save.positions[save.area] = { x: playerX, y: playerY };
  try {
    localStorage.setItem(SAVE_NAME, JSON.stringify(save));
  } catch (error) {
    // Couldn't save. The game still works.
  }
}

const save = loadSave();

// ----- The world -----

let tiles = [];
const REGROW_TIME = 120000; // things you gather grow back after 2 minutes
let savedThings = {};       // "x,y" -> what was there before you gathered it
let playerX = save.x;
let playerY = save.y;
let facing = "down";
let enemies = [];
let nextEnemyId = 1;

function gatheredHere() {
  if (!save.gathered[save.area]) save.gathered[save.area] = {};
  return save.gathered[save.area];
}

// Go to an area: build its world, and put you where you were (or at its start)
function loadArea(area) {
  save.area = area;
  tiles = makeWorld(area);
  savedThings = {};
  for (const key of Object.keys(gatheredHere())) {
    const [x, y] = key.split(",").map(Number);
    savedThings[key] = tiles[y][x].thing;
    tiles[y][x].thing = null;
  }
  // Where you were last time in this area (older saves only remember one spot)
  const place = save.positions[area] || (area === "temple" ? { x: save.x, y: save.y } : areas[area].start);
  playerX = place.x;
  playerY = place.y;
  enemies = [];
  view.load(tiles, area);
  if (area === "temple") {
    for (const temple of temples) {
      view.setTemple(temple, save.temples[temple.id].health, save.temples[temple.id].saved);
      view.setRift(temple, save.temples[temple.id].saved);
    }
  }
  placeWizards();
  draw();
}

// ----- The page -----

const canvas = document.getElementById("game");
const view = createTempleView(canvas);

const heartsText = document.getElementById("hearts");
const weaponText = document.getElementById("weapon");
const placeText = document.getElementById("place");
const toast = document.getElementById("toast");
const promptBox = document.getElementById("prompt");
const dialogueBox = document.getElementById("dialogue");
const dialogueName = document.getElementById("dialogue-name");
const dialogueText = document.getElementById("dialogue-text");
const bigNews = document.getElementById("big-news");
const bigNewsText = document.getElementById("big-news-text");
const hurtFlash = document.getElementById("hurt");
const bagList = document.getElementById("bag-list");
const craftList = document.getElementById("craft-list");
const templeList = document.getElementById("temple-list");
const minimap = document.getElementById("minimap");
const mapPen = minimap.getContext("2d");

let toastTimer = null;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.hidden = true;
  }, 2600);
}

let lastWarning = 0;
function warn(text) {
  if (Date.now() - lastWarning > 1800) {
    lastWarning = Date.now();
    showToast(text);
  }
}

function showBigNews(text) {
  bigNewsText.textContent = text;
  bigNews.hidden = false;
}

// ----- Sounds (from the arcade's sounds.js) -----

function playStep() { playTone(0, 0.03, 180, 120, 0.03); }
function playSplash() { playNoise(0, 0.15, 1200, 400, 0.15); }
function playChop() { playTone(0, 0.05, 300, 200, 0.08); playNoise(0, 0.05, 2000, 800, 0.2); }
function playSwing() { playNoise(0, 0.08, 3000, 800, 0.2); }
function playCraft() { playTone(0, 0.06, 660, 660, 0.06); playTone(0.07, 0.1, 990, 990, 0.06); }

// ----- Wizards who defend the temples -----

const WIZARD_HP = 6;            // how many hits a wizard can take before being knocked out
const WIZARD_RANGE = 5;         // how far their magic bolts reach
const WIZARD_CAST_TIME = 2200;  // milliseconds between bolts
const WIZARD_NAP_TIME = 25000;  // how long a knocked-out wizard stays down

let wizards = [];

function wizardAt(x, y) {
  return wizards.find((w) => w.x === x && w.y === y);
}

// Find a free spot for a wizard near (x, y): dry land, not on the temple, not next to the rift
function findWizardSpot(x, y, temple) {
  for (let r = 0; r < 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        const tile = tiles[ty] && tiles[ty][tx];
        if (!tile || tile.kind === "water" || tile.kind === "temple" || tile.thing) continue;
        if (Math.hypot(tx - temple.rift.x, ty - temple.rift.y) < 3) continue;
        if (wizardAt(tx, ty) || (tx === playerX && ty === playerY)) continue;
        return { x: tx, y: ty };
      }
    }
  }
  return null;
}

function placeWizards() {
  wizards = [];
  if (save.area !== "temple") return;
  for (const temple of temples) {
    const info = templeWizards[temple.id];
    wizardSpots.forEach(function ([dx, dy], i) {
      const spot = findWizardSpot(temple.x + dx, temple.y + dy, temple);
      if (!spot) return;
      wizards.push({
        id: temple.id + i,
        name: info.names[i],
        temple: temple.id,
        colour: info.colour,
        x: spot.x,
        y: spot.y,
        hp: WIZARD_HP,
        out: false,
        wakeAt: 0,
        lastCast: 0,
      });
    });
  }
}

// Each wizard zaps the nearest Gloom in range with a magic bolt
function wizardsTakeTurns(now) {
  for (const w of wizards) {
    if (w.out) {
      if (now >= w.wakeAt) {
        w.out = false; // back on their feet!
        w.hp = WIZARD_HP;
      }
      continue;
    }
    if (now - w.lastCast < WIZARD_CAST_TIME) continue;
    let target = null;
    let best = WIZARD_RANGE + 0.5;
    for (const enemy of enemies) {
      const distance = Math.hypot(enemy.x - w.x, enemy.y - w.y);
      if (distance < best) {
        best = distance;
        target = enemy;
      }
    }
    if (!target) continue;
    w.lastCast = now;
    view.bolt(w.x, w.y, target.x, target.y, "#9fd8ff");
    playTone(0, 0.12, 900, 1800, 0.04);
    target.hp -= 1;
    target.hurt = true;
    if (target.hp <= 0) defeat(target);
  }
}

function hurtWizard(wizard, damage) {
  wizard.hp -= damage;
  if (wizard.hp <= 0) {
    wizard.out = true;
    wizard.wakeAt = Date.now() + WIZARD_NAP_TIME;
    showToast(wizard.name + " has been knocked out! They'll be back soon.");
  }
}

// ----- Characters (unlocked by quests in Free Play) -----

const characters = {
  guardian: { name: "The Guardian", front: heroFront, back: heroBack, perk: "No perk, just brave!" },
  tom: { name: "Tom", front: tomSprite, perk: "+1 wood from every tree" },
  fern: { name: "Fern the Farmer", front: fernSprite, perk: "Food heals double" },
  bobby: { name: "Bobby", front: bobbySprite, perk: "Gathers twice as fast" },
  duskKnight: { name: "Dusk Knight", front: knightSprite, perk: "+3 damage" },
  gloomy: { name: "Gloomy", front: gloomySprite, perk: "The Gloom won't attack you" },
  jack: { name: "Jack the Scarecrow", front: jackSprite, perk: "Double crops: wheat and pumpkins count twice" },
};

function me() {
  return save.character;
}

// ----- Quests (in Free Play) -----

const quests = [
  { id: "q1", text: "Defeat 10 Gloomlings", stat: "defeated", goal: 10, reward: { character: "tom" } },
  { id: "q2", text: "Gather 30 wood", stat: "wood", goal: 30, reward: { area: "farm" } },
  { id: "q3", text: "Harvest 15 wheat in the Farm Lands", stat: "wheat", goal: 15, reward: { character: "fern" } },
  { id: "q9", text: "Harvest 20 pumpkins in the Farm Lands", stat: "pumpkin", goal: 20, reward: { character: "jack" } },
  { id: "q4", text: "Gather 10 crystal", stat: "crystal", goal: 10, reward: { area: "dusk" } },
  { id: "q5", text: "Craft 3 healing potions", stat: "potions", goal: 3, reward: { character: "bobby" } },
  { id: "q6", text: "Mine 8 duskstone in the Dusk Lands", stat: "duskstone", goal: 8, reward: { character: "duskKnight" } },
  { id: "q7", text: "Defeat 15 Dusk wisps", stat: "wisps", goal: 15, reward: { area: "gloom" } },
  { id: "q8", text: "Reach the throne at the top of Mount Gloom", stat: "summit", goal: 1, reward: { character: "gloomy" } },
];

function freePlay() {
  return save.kingDefeated;
}

// Count something for the quests (only in Free Play)
function countStat(name, amount) {
  if (!freePlay()) return;
  save.stats[name] = (save.stats[name] || 0) + amount;
  checkQuests();
}

function checkQuests() {
  for (const quest of quests) {
    if (save.questsDone.includes(quest.id) || (save.stats[quest.stat] || 0) < quest.goal) continue;
    save.questsDone.push(quest.id);
    playJingle();
    if (quest.reward.character) {
      save.characters.push(quest.reward.character);
      showBigNews("Quest complete: " + quest.text + "! You unlocked a new character: " + characters[quest.reward.character].name + "! (" + characters[quest.reward.character].perk + ")");
    } else {
      save.areas.push(quest.reward.area);
      showBigNews("Quest complete: " + quest.text + "! You unlocked a new area: " + areas[quest.reward.area].name + "! Travel there from the Quests & Lands panel.");
    }
  }
}

// ----- Your gear -----

function have(id) {
  return (save.made[id] || 0) > 0;
}

// Your best weapon: the one that does the most damage
function bestWeapon() {
  let best = { name: "Bare hands", icon: "✊", damage: 1, colour: "#ffffff" };
  for (const recipe of recipes) {
    if (recipe.damage && have(recipe.id) && recipe.damage > best.damage) best = recipe;
  }
  // The Dusk Knight hits harder
  if (me() === "duskKnight") best = Object.assign({}, best, { damage: best.damage + 3 });
  return best;
}

const weaponColours = { woodSword: "#d8a868", stoneSword: "#d8d8e0", ironSword: "#ffffff", crystalBlade: "#8ff0ff", duskBlade: "#e0a8ff", gloomBlade: "#ff5a5a" };

function hasTool(tool) {
  if (tool === null) return true;
  if (tool === "stonePick") return have("stonePick") || have("ironPick");
  return have(tool);
}

// ----- Moving, fighting and gathering -----

function enemyAt(x, y) {
  return enemies.find((e) => e.x === x && e.y === y);
}

const BLOCKERS = ["tree", "pine", "rock", "iron", "crystal", "bush", "herb", "pillar", "altar", "rift",
  "wheat", "pumpkin", "fence", "duskTree", "deadTree", "duskstone", "gloomsteel", "throne"];

// How high a square is for climbing. Water counts as 0, so you can climb out onto low shores.
function climbHeight(tile) {
  return tile.kind === "water" ? 0 : tile.height;
}

function move(dx, dy) {
  if (talking || !save.started) return;

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
  } else if (wizardAt(newX, newY)) {
    // a wizard is standing there (press Space to talk to them)
  } else if (resources[there.thing]) {
    gather(newX, newY, there);
  } else if (BLOCKERS.includes(there.thing)) {
    // can't walk through pillars, altars or rifts
  } else if (Math.abs(climbHeight(there) - climbHeight(tiles[playerY][playerX])) > 1) {
    warn("Too steep to climb! Find another way.");
  } else {
    playerX = newX;
    playerY = newY;
    if (there.kind === "water") playSplash();
    else playStep();
    saveGame();
  }
  draw();
  updatePanels();
}

function attack(enemy, dx, dy) {
  const weapon = bestWeapon();
  enemy.hp -= weapon.damage;
  enemy.hurt = true;
  playSwing();
  playBonk();
  view.slash(enemy.x, enemy.y, facing, weaponColours[weapon.id] || "#ffffff");

  if (enemy.hp <= 0) {
    defeat(enemy);
    return;
  }
  // Knock it back a square, if there's room (not for the king, he's too big!)
  if (enemy.kind !== "king" && canEnemyStand(enemy.x + dx, enemy.y + dy)) {
    enemy.x += dx;
    enemy.y += dy;
  }
}

function defeat(enemy) {
  enemies = enemies.filter((e) => e !== enemy);
  view.poof(enemy.x, enemy.y);
  playPoof();

  // Gloom shards are left behind
  const shards = enemy.kind === "king" ? 0 : enemy.kind === "big" ? 2 : Math.random() < 0.6 ? 1 : 0;
  if (enemy.kind === "wisp" && Math.random() < 0.5) {
    save.bag.duskstone = (save.bag.duskstone || 0) + 1;
  }
  if (shards > 0) {
    save.bag.shards = (save.bag.shards || 0) + shards;
    showToast("+" + shards + " " + materials.shards.icon + " Gloom shard" + (shards > 1 ? "s" : ""));
  }
  if (enemy.kind === "king") winTheGame();
  if (enemy.kind === "wisp") countStat("wisps", 1);
  else if (enemy.kind !== "king") countStat("defeated", 1);
  saveGame();
}

let gathering = null; // { key, hits } while you're chopping or mining something

function gather(x, y, tile) {
  const resource = resources[tile.thing];
  if (!hasTool(resource.tool)) {
    const toolName = recipes.find((r) => r.id === resource.tool).name;
    warn("You need a " + toolName + " to mine that!");
    return;
  }

  const key = x + "," + y;
  if (!gathering || gathering.key !== key) gathering = { key: key, hits: 0 };
  gathering.hits++;

  // Better tools need fewer hits
  let needed = resource.hits;
  if (resource.better === "axe" && have("stoneAxe")) needed = Math.ceil(needed / 2);
  if (resource.better === "pickaxe" && (have("stonePick") || have("ironPick"))) needed = Math.ceil(needed / (have("ironPick") ? 3 : 2));
  if (me() === "bobby") needed = Math.ceil(needed / 2); // Bobby is a super fast gatherer

  const colour = {
    wood: "#8a5a32", stone: "#b4b0bc", iron: "#e08a4a", crystal: "#8ff0ff", berries: "#e0303a", herbs: "#4fae4a",
    wheat: "#d8b040", pumpkin: "#e8862a", duskstone: "#e0a8ff", gloomsteel: "#ff3a3a",
  }[resource.gives];
  if (gathering.hits < needed) {
    playChop();
    view.hitThing(x, y, colour);
    return;
  }

  // Got it!
  gathering = null;
  playNoise(0, 0.25, 2000, 300, 0.35);
  view.removeThing(x, y, colour);
  savedThings[key] = tile.thing;
  gatheredHere()[key] = Date.now();
  tile.thing = null;
  let amount = resource.amount;
  if (me() === "tom" && resource.gives === "wood") amount++; // Tom is great at chopping
  if (me() === "jack" && (resource.gives === "wheat" || resource.gives === "pumpkin")) amount *= 2; // Jack grows double crops
  save.bag[resource.gives] = (save.bag[resource.gives] || 0) + amount;
  const material = materials[resource.gives];
  showToast("+" + amount + " " + material.icon + " " + material.name);
  countStat(resource.gives, amount);
  saveGame();
}

// Gathered things grow back after a while
function regrow() {
  if (paused) return;
  const now = Date.now();
  const gathered = gatheredHere();
  for (const key of Object.keys(gathered)) {
    if (now - gathered[key] < REGROW_TIME) continue;
    const [x, y] = key.split(",").map(Number);
    if ((x === playerX && y === playerY) || enemyAt(x, y) || wizardAt(x, y)) continue;
    tiles[y][x].thing = savedThings[key];
    delete gathered[key];
    delete savedThings[key];
    view.addThing(x, y);
  }
}

// ----- Crafting -----

function canCraft(recipe) {
  for (const material of Object.keys(recipe.needs)) {
    if ((save.bag[material] || 0) < recipe.needs[material]) return false;
  }
  return true;
}

function craft(recipe) {
  if (!canCraft(recipe)) return;
  for (const material of Object.keys(recipe.needs)) {
    save.bag[material] -= recipe.needs[material];
  }
  save.made[recipe.id] = (save.made[recipe.id] || 0) + 1;
  if (recipe.id === "potion") countStat("potions", 1);
  playCraft();
  showToast("You made: " + recipe.icon + " " + recipe.name + "!");
  saveGame();
  updatePanels();
}

// Press Q: drink a potion, or eat some berries
function heal() {
  const boost = me() === "fern" ? 2 : 1; // Fern knows how to cook!
  if (save.hearts >= 10) {
    warn("You're already at full health!");
  } else if (have("pie")) {
    save.made.pie--;
    save.hearts = Math.min(10, save.hearts + 10 * boost);
    playJingle();
    showToast("🥧 Delicious pumpkin pie! Full health!");
  } else if (have("potion")) {
    save.made.potion--;
    save.hearts = Math.min(10, save.hearts + 6 * boost);
    playJingle();
    showToast("🧪 You drink a potion. +" + 6 * boost + " hearts!");
  } else if ((save.bag.berries || 0) > 0) {
    save.bag.berries--;
    save.hearts = Math.min(10, save.hearts + boost);
    playTone(0, 0.08, 500, 700, 0.06);
    showToast("🍒 Yum! +1 heart");
  } else {
    warn("No potions or berries! Pick berries from bushes.");
  }
  saveGame();
  updatePanels();
}

// ----- The Gloom -----

const enemyKinds = {
  gloomling: { hp: 4, damage: 1, speed: 700 },
  big: { hp: 10, damage: 2, speed: 900 },
  wisp: { hp: 6, damage: 1, speed: 600 },
  king: { hp: 60, damage: 2, speed: 1000 },
};

function canEnemyStand(x, y) {
  const tile = tiles[y] && tiles[y][x];
  if (!tile || tile.kind === "water") return false; // the Gloom can't swim!
  if (BLOCKERS.includes(tile.thing)) return false;
  if (x === playerX && y === playerY) return false;
  if (wizardAt(x, y)) return false;
  return !enemyAt(x, y);
}

function spawnEnemy(kind, x, y, home) {
  // Find a free square near the spot
  for (let r = 0; r < 4; r++) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const sx = x + dx * r;
      const sy = y + dy * r;
      if (canEnemyStand(sx, sy)) {
        if (sx < 0 || sy < 0 || sy >= tiles.length || sx >= tiles.length) continue;
        enemies.push({ id: nextEnemyId++, kind: kind, x: sx, y: sy, hp: enemyKinds[kind].hp, home: home, lastMove: Date.now() });
        return;
      }
    }
  }
}

function templeById(id) {
  return temples.find((t) => t.id === id);
}

function hurtPlayer(damage) {
  if (have("armour")) damage = Math.ceil(damage / 2);
  save.hearts -= damage;
  hurtFlash.className = "on";
  setTimeout(() => (hurtFlash.className = ""), 150);
  playTone(0, 0.15, 300, 120, 0.1);
  if (save.hearts <= 0) {
    // You faint, and the Spirit carries you back to camp
    save.hearts = 10;
    playerX = START.x;
    playerY = START.y;
    showBigNews("You fainted! The Temple Spirit carried you back to camp. Craft better weapons and armour, and don't forget your potions!");
  }
  saveGame();
}

function hurtTemple(temple, damage) {
  const state = save.temples[temple.id];
  const before = state.health;
  state.health = Math.max(0, state.health - damage);
  if (state.health === 0) {
    state.health = 40;
    showBigNews("The " + temple.name + " almost fell! The Temple Spirit used its magic to hold it together. Hurry and close that rift!");
  }
  // Only rebuild the temple's look when its health drops past a multiple of 10
  if (Math.floor(before / 10) !== Math.floor(state.health / 10)) {
    view.setTemple(temple, state.health, false);
  }
}

// Each enemy takes a turn: chase you if you're close, otherwise go and attack its temple
function enemyTurn(enemy) {
  const kind = enemyKinds[enemy.kind];
  const distanceToPlayer = Math.abs(enemy.x - playerX) + Math.abs(enemy.y - playerY);
  const swimming = tiles[playerY][playerX].kind === "water";

  // Gloomy is friends with the Gloom, so they leave you alone
  const friendly = me() === "gloomy";

  // Next to you? Attack!
  if (distanceToPlayer === 1 && !swimming && !friendly) {
    hurtPlayer(kind.damage);
    return;
  }

  // A wizard right next to it? Attack the wizard!
  const wizard = wizards.find((w) => !w.out && Math.abs(w.x - enemy.x) + Math.abs(w.y - enemy.y) === 1);
  if (wizard) {
    hurtWizard(wizard, kind.damage);
    return;
  }

  // Wild Gloom in Free Play: chase you if you're close, otherwise wander
  if (enemy.home === null) {
    const chase = distanceToPlayer <= 8 && !swimming && !friendly;
    const choices = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => canEnemyStand(enemy.x + dx, enemy.y + dy));
    if (choices.length === 0) return;
    if (chase) {
      choices.sort((a, b) => Math.abs(enemy.x + a[0] - playerX) + Math.abs(enemy.y + a[1] - playerY) - (Math.abs(enemy.x + b[0] - playerX) + Math.abs(enemy.y + b[1] - playerY)));
    } else if (Math.random() < 0.5) {
      return; // resting
    } else {
      choices.sort(() => Math.random() - 0.5);
    }
    enemy.x += choices[0][0];
    enemy.y += choices[0][1];
    return;
  }

  // Pick a target: you (if close and not in the water), or its temple
  let targetX, targetY;
  const temple = templeById(enemy.home);
  if ((distanceToPlayer <= 7 && !swimming && !friendly) || enemy.kind === "king") {
    targetX = playerX;
    targetY = playerY;
  } else {
    targetX = temple.x;
    targetY = temple.y;
    // Close enough to the temple? Attack it!
    if (Math.abs(enemy.x - temple.x) <= TEMPLE_RADIUS + 1 && Math.abs(enemy.y - temple.y) <= TEMPLE_RADIUS + 1) {
      if (!save.temples[temple.id].saved) hurtTemple(temple, kind.damage * 2);
      return;
    }
  }

  // Step towards the target (or sideways if something's in the way)
  const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .filter(([dx, dy]) => canEnemyStand(enemy.x + dx, enemy.y + dy))
    .map(([dx, dy]) => ({ dx: dx, dy: dy, d: Math.abs(enemy.x + dx - targetX) + Math.abs(enemy.y + dy - targetY) + Math.random() * 0.8 }));
  options.sort((a, b) => a.d - b.d);
  if (options.length > 0) {
    enemy.x += options[0].dx;
    enemy.y += options[0].dy;
  }
}

let lastSpawn = {};
let lastKingSpawn = 0;

function gameTick() {
  if (!save.started || talking || paused) return;
  const now = Date.now();

  // Open rifts send out Gloomlings, but only when you're nearby
  for (const temple of temples) {
    if (save.area !== "temple" || save.temples[temple.id].saved) continue;
    const near = Math.hypot(playerX - temple.rift.x, playerY - temple.rift.y) < 26;
    const count = enemies.filter((e) => e.home === temple.id).length;
    if (near && count < 4 && now - (lastSpawn[temple.id] || 0) > 9000) {
      lastSpawn[temple.id] = now;
      const tough = (temple.id === "ice" || temple.id === "sea") && Math.random() < 0.4;
      spawnEnemy(tough ? "big" : "gloomling", temple.rift.x, temple.rift.y + 1, temple.id);
    }
  }

  // The Gloom King calls more Gloomlings to help him
  const king = enemies.find((e) => e.kind === "king");
  if (king && now - lastKingSpawn > 10000 && enemies.length < 7) {
    lastKingSpawn = now;
    spawnEnemy("gloomling", king.x + 2, king.y, "mountain");
  }
  if (save.area === "temple" && save.kingAwake && !save.kingDefeated && !king) {
    spawnEnemy("king", KING_SPOT.x, KING_SPOT.y, "mountain");
  }

  // Free Play: wild Gloom roam the lands (but not the peaceful Farm Lands)
  const wild = { temple: ["gloomling", 3, 12000], dusk: ["wisp", 5, 7000], gloom: ["big", 5, 8000] }[save.area];
  if (freePlay() && wild && enemies.length < wild[1] && now - (lastSpawn.wild || 0) > wild[2]) {
    lastSpawn.wild = now;
    const angle = Math.random() * Math.PI * 2;
    spawnEnemy(wild[0], Math.round(playerX + Math.cos(angle) * 10), Math.round(playerY + Math.sin(angle) * 10), null);
  }

  // Wizards zap the Gloom
  wizardsTakeTurns(now);

  // Enemies take their turns
  for (const enemy of enemies.slice()) {
    if (now - enemy.lastMove >= enemyKinds[enemy.kind].speed) {
      enemy.lastMove = now;
      enemyTurn(enemy);
    }
  }

  draw();
  updatePanels();
}

// ----- Temples, rifts and the Spirit -----

function nearbyThing() {
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const x = playerX + dx;
    const y = playerY + dy;
    const tile = tiles[y] && tiles[y][x];
    if (!tile) continue;
    if (tile.thing === "altar") return { kind: "altar", temple: templeById(tile.temple) };
    if (tile.thing === "rift") return { kind: "rift", temple: templeById(tile.rift) };
    if (tile.thing === "throne") return { kind: "throne" };
    const wizard = wizardAt(x, y);
    if (wizard) return { kind: "wizard", wizard: wizard };
  }
  return null;
}

let talking = false;
let lines = [];
let lineNumber = 0;
let afterTalking = null;

function say(name, said, after) {
  lines = said;
  lineNumber = 0;
  afterTalking = after || null;
  talking = true;
  dialogueName.textContent = name;
  dialogueText.textContent = lines[0];
  dialogueBox.hidden = false;
  playTone(0, 0.05, 600, 600, 0.05);
}

function nextLine() {
  lineNumber++;
  if (lineNumber < lines.length) {
    dialogueText.textContent = lines[lineNumber];
    playTone(0, 0.05, 600, 600, 0.05);
    return;
  }
  talking = false;
  dialogueBox.hidden = true;
  if (afterTalking) afterTalking();
  saveGame();
  updatePanels();
}

function interact() {
  const thing = nearbyThing();
  if (!thing) return;
  if (thing.kind === "wizard") {
    const w = thing.wizard;
    const temple = templeById(w.temple);
    if (w.out) {
      say(w.name, ["Zzz... (" + w.name + " was knocked out by the Gloom, but will be back on their feet soon.)"]);
    } else if (save.temples[temple.id].saved) {
      say(w.name, ["The " + temple.name + " is safe at last, thanks to you! I'll keep watch, just in case."]);
    } else {
      say(w.name, [
        "I'm " + w.name + ", one of the wizards of the " + temple.name + ".",
        "My magic bolts will zap any Gloom that comes near! But there are so many... we need you to close that rift.",
      ]);
    }
    return;
  }
  if (thing.kind === "throne") {
    say("The Gloom Throne", [
      "An empty throne of dark stone, at the very top of Mount Gloom.",
      "This is where the Gloom King once sat. Now the whole world below is peaceful... thanks to you.",
    ], function () {
      countStat("summit", 1);
    });
    return;
  }
  const temple = thing.temple;
  const state = save.temples[temple.id];

  if (thing.kind === "altar") {
    if (temple.id === "mountain" && !save.metSpirit) {
      save.metSpirit = true;
      say("Temple Spirit", [
        "Guardian! Thank goodness you have come.",
        "The Gloom has awoken. Shadowy creatures pour out of dark rifts and attack the four temples of the mountains.",
        "There is the Mountain Temple here, the Forest Temple to the west, the Ice Temple in the snowy north... and the Sea Temple on an island. You will have to swim to reach it!",
        "Gather wood, stone, iron and crystal. Craft weapons to fight, and tools to dig deeper.",
        "To close a rift forever, craft a Light totem and place it on the rift. Save all four temples, and the Gloom will be beaten... I hope.",
      ]);
    } else if (state.saved) {
      say(temple.name, ["This temple is safe, glowing with golden light."]);
    } else if (have("repairKit") && state.health < 100) {
      save.made.repairKit--;
      state.health = Math.min(100, state.health + 30);
      view.setTemple(temple, state.health, false);
      playJingle();
      say(temple.name, ["You use a repair kit. The temple's stones mend! (+30 health)"]);
    } else if (temple.id === "mountain") {
      say("Temple Spirit", [spiritHint()]);
    } else {
      say(temple.name, ["The temple is under attack! (Health: " + state.health + ") Repair kits can mend it, but only a Light totem on the rift will stop the Gloom."]);
    }
  } else if (thing.kind === "rift") {
    if (state.saved) {
      say("Light totem", ["Your light totem shines here. This rift is closed forever."]);
    } else if (have("totem")) {
      closeRift(temple);
    } else {
      say("Gloom rift", ["A dark rift swirls here, full of shadows. You need a Light totem to close it. (Craft one from 3 crystal, 4 stone and 2 Gloom shards.)"]);
    }
  }
}

function spiritHint() {
  if (!have("woodSword")) return "First, chop some trees and craft a wooden sword. Walk into the Gloomlings to fight them!";
  if (!have("stonePick")) return "Rocks give stone. With a stone pickaxe, you'll be able to mine iron.";
  if (!have("ironPick")) return "Iron makes strong tools. An iron pickaxe can dig out crystals, in the snowy north or on the island.";
  if (!have("totem")) return "Defeated Gloomlings leave shards behind. Combine shards with crystal and stone to make a Light totem.";
  return "You have a Light totem! Place it on a rift to close it. Remember, the Gloom cannot swim...";
}

function closeRift(temple) {
  save.made.totem--;
  const state = save.temples[temple.id];
  state.saved = true;
  state.health = 100;
  view.setRift(temple, true);
  view.setTemple(temple, 100, true);
  // All the Gloomlings from this rift vanish
  for (const enemy of enemies.filter((e) => e.home === temple.id && e.kind !== "king")) {
    view.poof(enemy.x, enemy.y);
  }
  enemies = enemies.filter((e) => e.home !== temple.id || e.kind === "king");
  playJingle();
  playNoise(0.2, 1.2, 400, 3000, 0.3);

  const savedCount = temples.filter((t) => save.temples[t.id].saved).length;
  if (savedCount === temples.length) {
    save.kingAwake = true;
    showBigNews("All four temples are saved! But the ground shakes... The GLOOM KING has appeared near the Mountain Temple! Defeat him to end the Gloom forever!");
  } else {
    showBigNews("You closed the rift! The " + temple.name + " is saved! (" + savedCount + " of 4 temples saved)");
  }
  saveGame();
}

function winTheGame() {
  save.kingDefeated = true;
  for (const enemy of enemies) view.poof(enemy.x, enemy.y);
  enemies = [];
  playJingle();
  setTimeout(playJingle, 400);
  showBigNews("🏆 You defeated the Gloom King! The shadows are gone, and all four temples shine with golden light. You are the true Temple Guardian! QUESTS & NEW LANDS are now unlocked: do quests to unlock new characters and new lands!");
  saveGame();
}

// ----- Panels -----

function updatePanels() {
  heartsText.textContent = "❤️".repeat(Math.max(0, save.hearts)) + "🖤".repeat(Math.max(0, 10 - save.hearts));
  const weapon = bestWeapon();
  weaponText.textContent = weapon.icon + " " + weapon.name + " (" + weapon.damage + ")";
  const tile = tiles[playerY][playerX];
  placeText.textContent = tile.kind === "water" ? "🏊 Swimming" : have("armour") ? "🛡️ Armour on" : "";

  // Your bag
  bagList.innerHTML = "";
  for (const id of Object.keys(materials)) {
    const line = document.createElement("p");
    line.textContent = materials[id].icon + " " + materials[id].name + ": " + (save.bag[id] || 0);
    bagList.appendChild(line);
  }
  for (const recipe of recipes) {
    if (recipe.repeat && have(recipe.id)) {
      const line = document.createElement("p");
      line.className = "item";
      line.textContent = recipe.icon + " " + recipe.name + " x" + save.made[recipe.id];
      bagList.appendChild(line);
    }
  }

  // Crafting buttons
  craftList.innerHTML = "";
  for (const recipe of recipes) {
    if (!recipe.repeat && have(recipe.id)) continue; // already made it
    const button = document.createElement("button");
    const cost = Object.keys(recipe.needs).map((m) => recipe.needs[m] + materials[m].icon).join(" ");
    button.textContent = recipe.icon + " " + recipe.name + "  " + cost + (recipe.about ? "  (" + recipe.about + ")" : "");
    button.disabled = !canCraft(recipe);
    button.addEventListener("click", function () {
      button.blur();
      craft(recipe);
    });
    craftList.appendChild(button);
  }

  // Temples
  templeList.innerHTML = "";
  for (const temple of temples) {
    const state = save.temples[temple.id];
    const row = document.createElement("div");
    row.className = "temple-row";
    const label = document.createElement("span");
    label.textContent = (state.saved ? "✔ " : "") + temple.name;
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = state.saved ? "fill saved" : state.health < 40 ? "fill low" : "fill";
    fill.style.width = state.health + "%";
    bar.appendChild(fill);
    row.appendChild(label);
    row.appendChild(bar);
    templeList.appendChild(row);
  }

  updateFreePlayPanel();

  const thing = nearbyThing();
  promptBox.hidden = !thing || talking;
  if (thing) {
    promptBox.textContent =
      thing.kind === "altar" ? "Space: Use the altar" :
      thing.kind === "throne" ? "Space: Look at the throne" :
      thing.kind === "wizard" ? "Space: Talk to " + thing.wizard.name :
      "Space: Look at the rift";
  }

  drawMap();
}

function updateFreePlayPanel() {
  const panel = document.getElementById("freeplay");
  panel.hidden = !freePlay();
  if (!freePlay()) return;

  // Quests
  const questList = document.getElementById("quest-list");
  questList.innerHTML = "";
  for (const quest of quests) {
    const done = save.questsDone.includes(quest.id);
    const line = document.createElement("li");
    const progress = Math.min(save.stats[quest.stat] || 0, quest.goal);
    const reward = quest.reward.character ? "🧑 " + characters[quest.reward.character].name : "🗺️ " + areas[quest.reward.area].name;
    line.textContent = (done ? "✔ " : "• ") + quest.text + (done ? "" : " (" + progress + "/" + quest.goal + ")") + " → " + reward;
    if (done) line.className = "done";
    questList.appendChild(line);
  }

  // Characters
  const characterList = document.getElementById("character-list");
  characterList.innerHTML = "";
  for (const id of Object.keys(characters)) {
    const button = document.createElement("button");
    const unlocked = save.characters.includes(id);
    button.textContent = unlocked ? characters[id].name + ": " + characters[id].perk : "🔒 ???";
    button.disabled = !unlocked;
    if (id === save.character) button.className = "chosen";
    button.addEventListener("click", function () {
      button.blur();
      save.character = id;
      saveGame();
      draw();
      updatePanels();
    });
    characterList.appendChild(button);
  }

  // Travel
  const travelList = document.getElementById("travel-list");
  travelList.innerHTML = "";
  for (const id of Object.keys(areas)) {
    const button = document.createElement("button");
    const unlocked = save.areas.includes(id);
    button.textContent = unlocked ? (id === save.area ? "📍 " : "") + areas[id].name : "🔒 ???";
    button.disabled = !unlocked || id === save.area;
    button.addEventListener("click", function () {
      button.blur();
      saveGame();
      loadArea(id);
      showToast("~ " + areas[id].name + " ~");
      saveGame();
      updatePanels();
    });
    travelList.appendChild(button);
  }
}

const MAP_SCALE = 2;
function drawMap() {
  const size = tiles.length;
  const scale = Math.floor(192 / size);
  mapPen.fillStyle = "#101020";
  mapPen.fillRect(0, 0, 192, 192);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = tiles[y][x];
      let colour = tile.height % 2 === 0 ? "#5fb04a" : "#539c40";
      if (tile.kind === "water") colour = "#2f7fc8";
      if (tile.kind === "rock") colour = "#8a8794";
      if (tile.kind === "snow") colour = "#eef3f8";
      if (tile.kind === "temple") colour = "#e8dcc0";
      if (tile.thing === "tree" || tile.thing === "pine") colour = "#2f6a3a";
      if (["wheat", "pumpkin"].includes(tile.thing)) colour = "#d8b040";
      if (tile.thing === "fence") colour = "#8a5a32";
      if (tile.thing === "duskTree") colour = "#2a9a9a";
      if (tile.thing === "throne") colour = "#ff3a3a";
      mapPen.fillStyle = colour;
      mapPen.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  for (const temple of save.area === "temple" ? temples : []) {
    const state = save.temples[temple.id];
    mapPen.fillStyle = state.saved ? "#ffd84a" : "#ff8a3a";
    mapPen.fillRect(temple.x * scale - 4, temple.y * scale - 4, 10, 10);
    mapPen.fillStyle = state.saved ? "#ffffff" : "#8a4fd8";
    mapPen.fillRect(temple.rift.x * scale - 3, temple.rift.y * scale - 3, 8, 8);
  }
  for (const w of wizards) {
    mapPen.fillStyle = w.out ? "#6a6a80" : "#9fd8ff";
    mapPen.fillRect(w.x * scale - 1, w.y * scale - 1, 4, 4);
  }
  for (const enemy of enemies) {
    mapPen.fillStyle = enemy.kind === "king" ? "#ff00ff" : "#ff3a3a";
    mapPen.fillRect(enemy.x * scale - 1, enemy.y * scale - 1, 4, 4);
  }
  mapPen.fillStyle = "#1d1726";
  mapPen.fillRect(playerX * scale - 3, playerY * scale - 3, 8, 8);
  mapPen.fillStyle = "#ffffff";
  mapPen.fillRect(playerX * scale - 2, playerY * scale - 2, 6, 6);
}

function draw() {
  view.sync({
    x: playerX,
    y: playerY,
    facing: facing,
    front: characters[me()].front,
    back: characters[me()].back || characters[me()].front,
    swimming: tiles[playerY][playerX].kind === "water",
    enemies: enemies,
  });
  view.syncWizards(wizards);
}

// ----- Pausing -----

let paused = false;
const pauseButton = document.getElementById("pause-button");
const pauseBox = document.getElementById("paused");

function setPaused(value) {
  paused = value;
  pauseBox.hidden = !paused;
  pauseButton.textContent = paused ? "▶ Resume" : "⏸ Pause";
  if (!paused) {
    // Give the Gloom a fresh start on their timers, so they don't all jump at once
    const now = Date.now();
    for (const enemy of enemies) enemy.lastMove = now;
  }
}

pauseButton.addEventListener("click", function () {
  this.blur();
  setPaused(!paused);
});
document.getElementById("resume").addEventListener("click", function () {
  this.blur();
  setPaused(false);
});

// ----- Keyboard -----

document.addEventListener("keydown", function (event) {
  const key = event.key;
  const isAction = key === " " || key === "Enter" || key === "e";

  // P or Escape pauses and unpauses the game
  if ((key === "p" || key === "Escape") && save.started && !talking) {
    setPaused(!paused);
    event.preventDefault();
    return;
  }
  if (paused) return; // nothing else happens while paused

  if (talking) {
    if (isAction) {
      nextLine();
      event.preventDefault();
    }
    return;
  }
  if (!bigNews.hidden && isAction) {
    bigNews.hidden = true;
    event.preventDefault();
    return;
  }
  if (key === "ArrowUp" || key === "w") move(0, -1);
  else if (key === "ArrowDown" || key === "s") move(0, 1);
  else if (key === "ArrowLeft" || key === "a") move(-1, 0);
  else if (key === "ArrowRight" || key === "d") move(1, 0);
  else if (isAction) interact();
  else if (key === "q") heal();
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

if (save.started) document.getElementById("intro").hidden = true;
loadArea(save.area);
updatePanels();
setInterval(gameTick, 200);
setInterval(regrow, 10000);
