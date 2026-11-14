// Pixel art for Diamond Isles.
// These sprites are 16 x 16 pixels: twice as detailed as the other games!
// Each letter is a colour, and "." is see-through.
// The dark "k" outline around everything is a classic 16-bit trick.

const colours = {
  k: "#1d1726", // outline
  y: "#d9a45b", // hat
  Y: "#b07c3a", // hat (shadow)
  s: "#f2c79b", // skin
  h: "#6b3f22", // hair
  r: "#d6403a", // red scarf
  b: "#3f74c9", // blue shirt
  B: "#2c548f", // blue shirt (shadow)
  u: "#6b4423", // boots / bark
  p: "#8a5a2c", // backpack
  e: "#ffffff", // white
  g: "#4fae4a", // leaves
  G: "#2f7a3a", // leaves (dark)
  t: "#8a5a32", // palm trunk
  T: "#6a4122", // palm trunk (dark)
  W: "#a4a2ad", // rock
  A: "#6e6b78", // rock (dark)
  f: "#e8475f", // flower petals
  F: "#f6d04a", // flower middle
  v: "#8a4fd8", // portal purple
  V: "#c79bff", // portal light purple
  w: "#ffffff", // diamond shine
  c: "#6fe6ff", // diamond (changes colour on each island)
  d: "#2aa6d6", // diamond dark (changes colour on each island)
};

// ----- The explorer -----

const playerFront = [
  "................",
  ".....kkkkkk.....",
  "....kyyyyyyk....",
  "...kyyyyyyyYk...",
  "..kkkkkkkkkkkk..",
  "....khsssshk....",
  "....kskssksk....",
  "....kssssssk....",
  ".....krrrrk.....",
  "....kbbbbbbk....",
  "...ksbbbbbBsk...",
  "...ksbbbbbBsk...",
  "....kbbbbbBk....",
  "....kuuk.kuuk...",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];

const playerBack = [
  "................",
  ".....kkkkkk.....",
  "....kyyyyyyk....",
  "...kyyyyyyyYk...",
  "..kkkkkkkkkkkk..",
  "....khhhhhhk....",
  "....khhhhhhk....",
  "....khhhhhhk....",
  ".....krrrrk.....",
  "....kbppppbk....",
  "...ksppppppsk...",
  "...ksppppppsk...",
  "....kbppppbk....",
  "....kuuk.kuuk...",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];

// ----- Diamonds and the portal -----

const diamondSprite = [
  "................",
  "................",
  "................",
  "....kkkkkkkk....",
  "...kwccwcccck...",
  "..kwcccwccccdk..",
  ".kccccccccccddk.",
  ".kkkkkkkkkkkkkk.",
  "..kcccccccccdk..",
  "...kwcccccddk...",
  "....kcccccdk....",
  ".....kcccdk.....",
  "......kcdk......",
  ".......kk.......",
  "................",
  "................",
];

const portalSprite = [
  "................",
  ".....kkkkkk.....",
  "...kkvvvvvvkk...",
  "..kvvVVVVVVvvk..",
  ".kvVVwwwwwwVVvk.",
  ".kvVw......wVvk.",
  "kvVw..vvvv..wVvk",
  "kvVw.vVVVVv.wVvk",
  "kvVw.vVwwVv.wVvk",
  "kvVw.vVVVVv.wVvk",
  "kvVw..vvvv..wVvk",
  ".kvVw......wVvk.",
  ".kvVVwwwwwwVVvk.",
  "..kvvVVVVVVvvk..",
  "...kkvvvvvvkk...",
  ".....kkkkkk.....",
];

// ----- Plants and rocks -----

const palmSprite = [
  "......kk..kk....",
  "....kkggkkggkk..",
  "..kkgggGggGgggk.",
  ".kgGGkggggkGGgk.",
  ".kGk.kgttgk.kGk.",
  "k....k.tT.k....k",
  ".......tT.......",
  ".......tT.......",
  "......ktT.......",
  "......tTk.......",
  "......tT........",
  ".....ktT........",
  ".....tTk........",
  ".....tT.........",
  "....kttTk.......",
  "...kkkkkkk......",
];

const bushSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  "....kkggggkk....",
  "...kggfgggGGk...",
  "..kgggggggGGGk..",
  "..kgfggggfgGGk..",
  ".kggggggggggGGk.",
  ".kgggGgggggGGGk.",
  ".kGGGGGGGGGGGGk.",
  "..kkkkkkkkkkkk..",
  "................",
];

const pineSprite = [
  ".......kk.......",
  "......keek......",
  ".....kGeeGk.....",
  "......kGGk......",
  ".....kGeGGk.....",
  "....kGGGeGGk....",
  "...kGGGGGGGGk...",
  ".....kGGeGk.....",
  "....kGGGGGeGk...",
  "...kGeGGGGGGGk..",
  "..kGGGGGGGGGeGk.",
  ".kkkkkkkkkkkkkk.",
  "......kuuk......",
  "......kuuk......",
  "......kuuk......",
  ".....kkkkkk.....",
];

const deadTreeSprite = [
  "..k.......k.....",
  "..ku.....uk.....",
  "...uu...uu..k...",
  "....uu.uu..uk...",
  ".k...uuu..uk....",
  ".ku...uu.uk.....",
  "...uu.uuuk......",
  ".....uuuk.......",
  "......uuk.......",
  "......uuk.......",
  "......uuk.......",
  ".....kuuk.......",
  ".....uuuuk......",
  "....kuukuuk.....",
  "....kkk.kkk.....",
  "................",
];

const rockSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  "....kkWWWWkk....",
  "...kWWeWWWWAk...",
  "..kWWWWWWWAAAk..",
  "..kWWWWWWAAAAk..",
  ".kAWWWWAAAAAAAk.",
  ".kAAAAAAAAAAAAk.",
  "..kkkkkkkkkkkk..",
  "................",
];

const flowerSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "...........kk...",
  "....kk....kffk..",
  "...kffk..kfFfk..",
  "..kfFfk...kffk..",
  "...kffk....kGk..",
  "....kGk...kGk...",
  ".....kGk.kGk....",
  "......kkkk......",
];

const snowTuftSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......kkk.......",
  "....kkeeekk.....",
  "...keeeeeeek....",
  "...kkkkkkkkk....",
  "................",
];

// ----- Bobby, the friendly traveller who gives you tools -----

const bobbySprite = [
  "................",
  ".....kkkkkk.....",
  "....kGGGGGGk....",
  "...kGGGGGGGGk...",
  "..kkkkkkkkkkkk..",
  "....kssssssk....",
  "....kskssksk....",
  "....kuuuuuuk....",
  "...kuuuuuuuuk...",
  "...kruuuuuurk...",
  "..ksrrruurrrsk..",
  "...krrrrrrrrk...",
  "....kWWWWWWk....",
  "....kWWk.kWWk...",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];
