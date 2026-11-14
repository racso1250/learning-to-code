// Things that BOTH Carpet People modes use: the levels mode (carpet.js)
// and Free Play (freeplay.js). Keeping them in one place means if you change
// a sprite or a colour here, it changes everywhere!

// Each tile is 32 x 32 screen pixels.
// Each sprite is 8 x 8 "art pixels", so each art pixel is 4 screen pixels big.
// Big chunky pixels are what give it the 16-bit look!
const TILE = 32;
const PIXEL = 4;

// How often the dust bunnies move, in milliseconds (1000 = 1 second).
// Make this smaller to make them faster!
const BUNNY_SPEED = 400;

// ----- Colours -----
// The colours used in the sprites. Each letter means one colour.
const colours = {
  h: "#6b3a1e", // hair
  s: "#f5c08a", // skin
  b: "#2f6fd6", // shirt
  l: "#1c2340", // trousers
  c: "#e0a040", // crumb
  C: "#a8641c", // crumb (dark bits)
  g: "#4f9a3a", // fibres
  G: "#2d6324", // fibres (dark)
  w: "#d4d4dc", // dust bunny fluff
  W: "#9a9aa8", // dust bunny fluff (dark)
  k: "#111111", // black (eyes, button holes)
  p: "#ff8fb1", // dust bunny nose
  r: "#e23b3b", // red (Pip's cap and shirt)
  m: "#7fbf3f", // moss green (Moss's hood)
  y: "#ffd23f", // gold (King Crumb's crown)
  v: "#8a3fd1", // purple (King Crumb's robe)
  o: "#2a5fb0", // the lost button
  O: "#5d95e8", // the lost button (shiny part)
  e: "#ffffff", // white (Chef Crumble's hat and jacket)
  n: "#3b2a24", // Moul fur
  N: "#5e4334", // Moul fur (light)
  R: "#ff2020", // Moul eyes
};

// ----- Sprites (pixel art!) -----
// Each sprite is 8 rows of 8 letters. A "." means see-through.

const crumbSprite = [
  "........",
  "...cc...",
  "..cCcc..",
  ".cccCcc.",
  ".cCcccc.",
  "..cccc..",
  "........",
  "........",
];

const fibreSprite = [
  "g.g..g.g",
  "gGg.gGg.",
  ".gGggGg.",
  "GgGgGgGg",
  "gGgGgGgG",
  "GgGgGgGg",
  "gGgGgGgG",
  "GGGGGGGG",
];

const bunnySprite = [
  ".W....W.",
  ".wW..Ww.",
  "..wwww..",
  ".wwwwww.",
  "wwkwwkww",
  "Wwwwwwww",
  ".wwppwW.",
  "..WwwW..",
];

const buttonSprite = [
  "..oooo..",
  ".oOOOOo.",
  "oOOOOOOo",
  "oOkOOkOo",
  "oOkOOkOo",
  "oOOOOOOo",
  ".oOOOOo.",
  "..oooo..",
];

const moulSprite = [
  "N.n..n.N",
  ".nnnnnn.",
  "nRnnnnRn",
  "nnNnnNnn",
  "neenneen",
  "nnnnnnnn",
  ".n.nn.n.",
  "n..nn..n",
];

// ----- Characters you can play as -----
// "tiny" is unlocked from the start. The others are unlocked with quests.
//
// Special powers (they only work in Free Play):
//   steps: 2           = moves 2 squares each key press
//   sight: 4           = sees further in the dark
//   magnet: true       = grabs crumbs on the squares next to you
//   slowBunnies: true  = dust bunnies move at half speed
//   shield: true       = shrugs off the first hit each visit
//   strong: true       = bonks Mouls and dust bunnies away instead of getting caught
//   wise: true         = sees every crumb on the mini-map, even in the dark
//   sneaky: true       = Mouls can't see you, so they don't chase

const characters = {
  tiny: {
    name: "Tiny",
    power: "No power. Just plucky!",
    sprite: [
      "..hhhh..",
      "..hsss..",
      "..ssss..",
      "...bb...",
      ".bbbbbb.",
      "s.bbbb.s",
      "..l..l..",
      ".ll..ll.",
    ],
  },
  pip: {
    name: "Pip",
    power: "Dash: moves 2 squares at a time",
    steps: 2,
    sprite: [
      "..rrrr..",
      "..rrrrrr",
      "..ssss..",
      "..ssss..",
      ".rrrrrr.",
      "s.rrrr.s",
      "..l..l..",
      ".ll..ll.",
    ],
  },
  moss: {
    name: "Moss",
    power: "Far Sight: sees twice as far",
    sight: 4,
    sprite: [
      "..mmmm..",
      ".mmmmmm.",
      ".mssssm.",
      ".mmmmmm.",
      ".mmmmmm.",
      "s.mmmm.s",
      "..l..l..",
      ".ll..ll.",
    ],
  },
  king: {
    name: "King Crumb",
    power: "Crumb Magnet: grabs crumbs next to him",
    magnet: true,
    sprite: [
      ".y.yy.y.",
      ".yyyyyy.",
      "..ssss..",
      "..ssss..",
      ".vvvvvv.",
      "svvvvvvs",
      ".vvvvvv.",
      ".ll..ll.",
    ],
  },
  chef: {
    name: "Chef Crumble",
    power: "Bunny Treats: dust bunnies move at half speed",
    slowBunnies: true,
    sprite: [
      ".eeeeee.",
      "..eeee..",
      "..ssss..",
      "..ssss..",
      ".eeeeee.",
      "s.eCCe.s",
      "..l..l..",
      ".ll..ll.",
    ],
  },
  snibril: {
    name: "Snibril",
    power: "Brave Heart: shrugs off the first hit each visit",
    shield: true,
    sprite: [
      "..hhhh..",
      "..hssh..",
      "..ssss..",
      "...ss...",
      ".mmmmmm.",
      "s.mmmm.s",
      "..l..l..",
      ".ll..ll.",
    ],
  },
  glurk: {
    name: "Glurk",
    power: "Mighty Spear: bonks Mouls and dust bunnies away",
    strong: true,
    sprite: [
      ".hhhh..W",
      ".hssss.W",
      ".hhhhh.h",
      "hhhhhh.h",
      "CCCCCCsh",
      "sCCCCC.h",
      ".l...l.h",
      "ll...ll.",
    ],
  },
  pismire: {
    name: "Pismire",
    power: "Wisdom: sees every crumb on the mini-map",
    wise: true,
    sprite: [
      "..eeee..",
      "..esss.h",
      "..eeee.h",
      "..eeee.h",
      ".ooooosh",
      "sooooo.h",
      ".ooooo.h",
      ".ooooo..",
    ],
  },
  brocando: {
    name: "Brocando",
    power: "Swift: moves 3 squares at a time",
    steps: 3,
    sprite: [
      "........",
      "..y.y.y.",
      "..yyyyy.",
      "..sssss.",
      ".rrbbbr.",
      "srrbbbrs",
      ".r.l.l.r",
      "...l.l..",
    ],
  },
  bane: {
    name: "Bane",
    power: "Shadow: Mouls can't see you",
    sneaky: true,
    sprite: [
      "..kkkk..",
      ".kkkkkk.",
      ".kssssk.",
      ".kkkkkk.",
      "kWWWWWWk",
      "kWWWWWWk",
      ".WW..WW.",
      ".kk..kk.",
    ],
  },
};

// ----- Drawing -----

// Draw an 8x8 sprite flat (2D) with its top-left corner at screen position (x, y).
// The game itself is 3D now (see render3d.js), but the character picker
// buttons still use this to show little pictures.
function drawSprite(ctx, sprite, x, y) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const letter = sprite[row][col];
      if (letter !== ".") {
        ctx.fillStyle = colours[letter];
        ctx.fillRect(x + col * PIXEL, y + row * PIXEL, PIXEL, PIXEL);
      }
    }
  }
}

// ----- Dust bunny brains -----

// Move one dust bunny one square on the map
function moveBunny(bunny, map) {
  // Find every direction the bunny could walk (not into fibres)
  const directions = [
    { dx: 0, dy: -1 }, // up
    { dx: 0, dy: 1 },  // down
    { dx: -1, dy: 0 }, // left
    { dx: 1, dy: 0 },  // right
  ];
  let options = [];
  for (const dir of directions) {
    if (map[bunny.y + dir.dy][bunny.x + dir.dx] !== "#") {
      options.push(dir);
    }
  }

  // Totally boxed in? Then stay put.
  if (options.length === 0) {
    return;
  }

  // Bunnies don't like turning around, unless they're stuck in a dead end
  if (options.length > 1) {
    options = options.filter(function (dir) {
      return !(dir.dx === -bunny.dx && dir.dy === -bunny.dy);
    });
  }

  // Pick one of the options at random
  const choice = options[Math.floor(Math.random() * options.length)];
  bunny.dx = choice.dx;
  bunny.dy = choice.dy;
  bunny.x = bunny.x + choice.dx;
  bunny.y = bunny.y + choice.dy;
}

// ----- Moul brains -----

// How close you have to be (in squares) before a Moul spots you
const MOUL_SIGHT = 6;

// Move one Moul one square. If it can see the player, it chases them!
function moveMoul(moul, map, playerX, playerY, canChase) {
  // Math.abs makes a number positive, so this is how many squares away you are
  const distance = Math.abs(playerX - moul.x) + Math.abs(playerY - moul.y);

  // Too far away (or can't see you)? Just wander like a dust bunny.
  if (!canChase || distance > MOUL_SIGHT) {
    moveBunny(moul, map);
    return;
  }

  // Try every direction and pick the one that gets closest to the player
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  let best = null;
  let bestDistance = 9999;

  for (const dir of directions) {
    const newX = moul.x + dir.dx;
    const newY = moul.y + dir.dy;
    if (map[newY][newX] === "#") {
      continue; // can't go through fibres
    }
    const newDistance = Math.abs(playerX - newX) + Math.abs(playerY - newY);
    if (newDistance < bestDistance) {
      best = dir;
      bestDistance = newDistance;
    }
  }

  if (best !== null) {
    moul.dx = best.dx;
    moul.dy = best.dy;
    moul.x = moul.x + best.dx;
    moul.y = moul.y + best.dy;
  }
}

// ----- Saving -----
// The browser can remember things for us using "localStorage", even after
// the page is closed. We save everything as one bundle called the "save".

const SAVE_NAME = "carpetPeopleSave";

function loadGame() {
  // What a brand new save looks like
  const save = {
    freePlayUnlocked: false,
    crumbsEaten: 0,      // total crumbs eaten in Free Play
    explored: [],        // every square you've seen, like "4,7"
    foundButton: false,  // have you found the lost button?
    ateAllCrumbs: false, // have you eaten every crumb in one visit?
    stepsTaken: 0,       // total steps walked in Free Play
    corners: [],         // which corners of the carpet you've visited
    moulsDefeated: 0,    // Mouls bonked by Glurk
    unlocked: ["tiny"],  // characters you can play as
    character: "tiny",   // the character you picked
  };

  // "try" means: attempt this, and if it goes wrong, don't crash the game
  try {
    const text = localStorage.getItem(SAVE_NAME);
    if (text) {
      Object.assign(save, JSON.parse(text)); // copy the saved bits in
    }
  } catch (error) {
    // Couldn't read the save. That's OK, we'll use a new one.
  }
  return save;
}

function saveGame(save) {
  try {
    localStorage.setItem(SAVE_NAME, JSON.stringify(save));
  } catch (error) {
    // Couldn't save. The game still works, it just won't remember.
  }
}
