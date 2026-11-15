// Pixel art for Spark Knights. (This page also loads ../temple/sprites.js,
// so trees, rocks, crystals and the tear swirl come from there.)
// Each sprite is 16 x 16. Each letter is a colour, and "." is see-through.

// New colours for Spark Knights
Object.assign(colours, {
  D: "#fff27a", // bright spark yellow
  E: "#ffc23a", // spark gold
  O: "#ff7a1a", // spark orange
  w: "#ffffff", // white sparkle
  T: "#888888", // monster body (changes for every world theme)
  t: "#bbbbbb", // monster body, lighter
});

const sparkFront = [
  ".......kk.......",
  "......kDDk......",
  ".....kDEDDk.....",
  "....kDEEEDDk....",
  "....kDEwEEDk....",
  "...kDEEEEEEDk...",
  "...kDEkEEkEDk...",
  "...kDEEEEEEDk...",
  "...kODEEEEDOk...",
  "....kODDDDOk....",
  "....kOOOOOOk....",
  ".....kOOOOk.....",
  "....kWk..kWk....",
  "....kWk..kWk....",
  "....kkk..kkk....",
  "................",
];

const sparkBack = [
  ".......kk.......",
  "......kDDk......",
  ".....kDEDDk.....",
  "....kDEEEDDk....",
  "....kDEEEEDk....",
  "...kDEEEEEEDk...",
  "...kDEEEEEEDk...",
  "...kDEEEEEEDk...",
  "...kODEEEEDOk...",
  "....kODDDDOk....",
  "....kOOOOOOk....",
  ".....kOOOOk.....",
  "....kWk..kWk....",
  "....kWk..kWk....",
  "....kkk..kkk....",
  "................",
];

const sparklingSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......k........",
  "......kDk.......",
  ".....kDwDk......",
  "....kDDDDDk.....",
  ".....kDkDk......",
  "......kDk.......",
  ".......k........",
  "................",
  "................",
  "................",
  "................",
];

const elderSprite = [
  ".......kk.......",
  "......kqqk......",
  ".....kqQqqk.....",
  "....kqQQQqqk....",
  "....kqQwQQqk....",
  "...kqQQQQQQqk...",
  "...kqQkQQkQqk...",
  "...kqQQQQQQqk...",
  "...kqqQQQQqqk...",
  "...kqqqqqqqqk...",
  "....kqqWWqqk....",
  ".....kqWWqk.....",
  "......kWWk......",
  "......kWWk......",
  ".....kkkkkk.....",
  "................",
];

const blobMonster = [
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  "....kkTTTTkk....",
  "...kTTtTTTTTk...",
  "..kTTTTTTTTTTk..",
  "..kTwwTTTTwwTk..",
  "..kTwkTTTTwkTk..",
  "..kTTTTTTTTTTk..",
  "..kTTTkkkkTTTk..",
  "..kTTTTTTTTTTk..",
  "..kTkTTkkTTkTk..",
  "..kk.kk..kk.kk..",
  "................",
];

const batMonster = [
  "................",
  "................",
  "................",
  "k..............k",
  "kk....kkkk....kk",
  "kTk..kTTTTk..kTk",
  "kTTkkTTTTTTkkTTk",
  "kTTTTTwTTwTTTTTk",
  ".kTTTTkTTkTTTTk.",
  "..kTTTTTTTTTTk..",
  "...kTTTkkTTTk...",
  "....kTTTTTTk....",
  ".....kkTTkk.....",
  ".......kk.......",
  "................",
  "................",
];

const crabMonster = [
  "................",
  "................",
  "................",
  "..kk........kk..",
  ".kTTk......kTTk.",
  ".kTkTk....kTkTk.",
  "..kTTk.kk.kTTk..",
  "...kkkkTTkkkk...",
  "....kTwTTwTk....",
  "...kTTkTTkTTk...",
  "..kTTTTTTTTTTk..",
  "..kTtTTTTTTtTk..",
  "...kTTTTTTTTk...",
  "..kTk.kTTk.kTk..",
  "..kk..kkkk..kk..",
  "................",
];

const sparkCrystal = [
  "................",
  "................",
  "................",
  "................",
  "......k.........",
  ".....kDk....k...",
  ".....kDEk..kDk..",
  "..k..kDwEk.kDEk.",
  ".kDk.kDEEk.kDEk.",
  ".kDEkkDEEkkkDEk.",
  ".kDwEkDEEkkDwEk.",
  "..kDEkDEEkkDEk..",
  ".kkkkkkkkkkkkkk.",
  "................",
  "................",
  "................",
];

const heartPickup = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "...kkk...kkk....",
  "..kbbbk.kbbbk...",
  ".kbebbbkbbbbbk..",
  ".kbbbbbbbbbbbk..",
  "..kbbbbbbbbbk...",
  "...kbbbbbbbk....",
  "....kbbbbbk.....",
  ".....kbbbk......",
  "......kbk.......",
  ".......k........",
  "................",
];

const tearHeart = [
  "................",
  ".......kk.......",
  "......kwwk......",
  ".....kwDDwk.....",
  "....kwDEEDwk....",
  "...kwDEEEEDwk...",
  "..kwDEEwEEEDwk..",
  "..kDEEEEEEEEDk..",
  "..kDEEEEEEEEDk..",
  "...kDEEEEEEDk...",
  "....kDEEEEDk....",
  ".....kDEEDk.....",
  "......kDDk......",
  ".......kk.......",
  "................",
  "................",
];

const craterSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "....kkkkkkkk....",
  "..kkAOOOOOOAkk..",
  ".kAOEDDDDDDEOAk.",
  "kAOEDwDDDwDDEOAk",
  "kAOEDDDDDDDDEOAk",
  ".kAOEDDDDDDEOAk.",
  "..kkAOOOOOOAkk..",
  "....kkkkkkkk....",
  "................",
];
