// Pixel art for Temple Guardian. Every sprite is 16 x 16 pixels.
// Each letter is a colour, and "." is see-through.

const colours = {
  k: "#1d1726", // outline
  R: "#d6403a", // beanie
  r: "#9a2a26", // beanie stripe
  h: "#6b3f22", // hair
  s: "#f2c79b", // skin
  j: "#3f6fb0", // guardian tunic
  J: "#2c4f80", // tunic shadow
  y: "#f6d04a", // gold
  n: "#3a3a4a", // trousers
  u: "#6b4423", // wood / boots
  U: "#4a2e18", // dark wood
  g: "#4fae4a", // leaves
  G: "#2f6a3a", // dark leaves
  W: "#b4b0bc", // stone
  A: "#6e6b78", // dark stone
  o: "#e08a4a", // iron ore
  c: "#8ff0ff", // crystal
  C: "#3ab8e0", // crystal dark
  e: "#ffffff", // white
  b: "#e0303a", // berries
  l: "#d8f0c8", // herb flowers
  m: "#2a1838", // gloom (dark purple)
  M: "#4a2a68", // gloom (lighter)
  x: "#ff3a3a", // glowing red eyes
  q: "#9fd8ff", // spirit blue
  Q: "#d8f0ff", // spirit light
  v: "#8a4fd8", // rift purple
  Y: "#e8c870", // straw
  F: "#3f8a5a", // farmer's overalls
  P: "#e8862a", // pumpkin orange
  B: "#d8b040", // wheat gold
  S: "#6a3aa8", // dusk knight purple
};

// ----- You: the kid from Pinecrest, now the Temple Guardian -----

const heroFront = [
  "................",
  "......kkkk......",
  ".....kRRRRk.....",
  "....kRRRRRRk....",
  "....kRrRrRrk....",
  "....khsssshk....",
  "....kskssksk....",
  "....kssssssk....",
  ".....kssssk.....",
  "....kjjyyjjk....",
  "...ksjjjjjJsk...",
  "...ksjjjjjJsk...",
  "....kjjjjjJk....",
  "....knnk.knnk...",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];

const heroBack = [
  "................",
  "......kkkk......",
  ".....kRRRRk.....",
  "....kRRRRRRk....",
  "....kRrRrRrk....",
  "....khhhhhhk....",
  "....khhhhhhk....",
  "....khhhhhhk....",
  ".....khhhhk.....",
  "....kjjjjjjk....",
  "...ksjjjjjJsk...",
  "...ksjjjjjJsk...",
  "....kjjjjjJk....",
  "....knnk.knnk...",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];

// ----- The Temple Spirit -----

const spiritSprite = [
  "................",
  "......kkkk......",
  ".....kQQQQk.....",
  "....kQqqqqQk....",
  "....kqkqqkqk....",
  "....kqqqqqqk....",
  ".....kqQQqk.....",
  "....kqqqqqqk....",
  "...kqqQqqQqqk...",
  "...kqqqqqqqqk...",
  "...kqQqqqqQqk...",
  "....kqqqqqqk....",
  ".....kqqqqk.....",
  "......kqqk......",
  ".......kk.......",
  "................",
];

// ----- The Gloom: shadowy monsters -----

const gloomlingSprite = [
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  "....kkmmmmkk....",
  "...kmmMmmmmmk...",
  "..kmmmmmmmmmmk..",
  "..kmxxmmmmxxmk..",
  "..kmxxmmmmxxmk..",
  "..kmmmmmmmmmmk..",
  "..kmMmmmmmmMmk..",
  "..kmmmmmmmmmmk..",
  "..kmkmmkkmmkmk..",
  "..kk.kk..kk.kk..",
  "................",
];

const gloomKingSprite = [
  "...k..k..k..k...",
  "...kykkykkykk...",
  "...kyyyyyyyyk...",
  "....kkkkkkkk....",
  "...kmmmmmmmmk...",
  "..kmmMmmmmmMmk..",
  ".kmmmmmmmmmmmmk.",
  ".kmxxxmmmmxxxmk.",
  ".kmxxxmmmmxxxmk.",
  ".kmmmmmmmmmmmmk.",
  ".kmmmkkkkkkmmmk.",
  ".kmmmmmmmmmmmmk.",
  ".kmMmmmmmmmmMmk.",
  ".kmmmmmmmmmmmmk.",
  ".kmkmmkmmkmmkmk.",
  ".kk.kk.kk.kk.kk.",
];

// A dark, swirling rift that Gloomlings come out of
const riftSprite = [
  "................",
  ".....kkkkkk.....",
  "...kkmmmmmmkk...",
  "..kmmvvvvvvmmk..",
  ".kmvvMMMMMMvvmk.",
  ".kmvM......Mvmk.",
  "kmvM..mmmm..Mvmk",
  "kmvM.mvvvvm.Mvmk",
  "kmvM.mvxxvm.Mvmk",
  "kmvM.mvvvvm.Mvmk",
  "kmvM..mmmm..Mvmk",
  ".kmvM......Mvmk.",
  ".kmvvMMMMMMvvmk.",
  "..kmmvvvvvvmmk..",
  "...kkmmmmmmkk...",
  ".....kkkkkk.....",
];

// A light totem: placed on a rift to close it forever
const totemSprite = [
  ".......kk.......",
  "......kcck......",
  ".....kcecCk.....",
  ".....kcccCk.....",
  "......kcCk......",
  ".....kkcCkk.....",
  "....kyykkyyk....",
  ".....kWWWWk.....",
  ".....kWeWAk.....",
  ".....kWWWAk.....",
  ".....kWWWAk.....",
  ".....kWeWAk.....",
  ".....kWWWAk.....",
  "....kWWWWWAk....",
  "...kkkkkkkkkk...",
  "................",
];

// ----- Things to gather -----

const treeSprite = [
  ".....kkkkkk.....",
  "...kkggggggkk...",
  "..kgggGggggggk..",
  ".kggggggggGgggk.",
  ".kgGgggggggggGk.",
  "kgggggGgggggggGk",
  "kggggggggGgggGGk",
  ".kgGggggggggGGk.",
  ".kggggGgggGGGGk.",
  "..kkGGGGGGGGkk..",
  "....kkkuUkkk....",
  "......kuUk......",
  "......kuUk......",
  "......kuUk......",
  ".....kuuuUk.....",
  "....kkkkkkkk....",
];

const pineSprite = [
  ".......kk.......",
  "......kGGk......",
  ".....kGeGGk.....",
  "......kGGk......",
  ".....kGeGGk.....",
  "....kGGGeGGk....",
  "...kGGGGGGGGk...",
  ".....kGGeGk.....",
  "....kGGGGGeGk...",
  "...kGeGGGGGGGk..",
  "..kGGGGGGGGGeGk.",
  ".kkkkkkkkkkkkkk.",
  "......kuUk......",
  "......kuUk......",
  "......kuUk......",
  ".....kkkkkk.....",
];

// Rock, iron and crystal share a shape; their colours are swapped in
const rockSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  "....kkWWWWkk....",
  "...kWWWWWWWAk...",
  "..kWWWWWWWAAAk..",
  "..kWWWWWWAAAAk..",
  ".kAWWWWWAAAAAAk.",
  ".kAAAAAAAAAAAAk.",
  ".kAAAAAAAAAAAAk.",
  "..kkkkkkkkkkkk..",
  "................",
];

const ironSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  "....kkWWWWkk....",
  "...kWoWWWoWAk...",
  "..kWWWWoWWAAAk..",
  "..kWoWWWWAAoAk..",
  ".kAWWWoWAAAAoAk.",
  ".kAAoAAAAoAAAAk.",
  ".kAAAAAAAAAAAAk.",
  "..kkkkkkkkkkkk..",
  "................",
];

const crystalSprite = [
  "................",
  "................",
  "......k.........",
  ".....kck....k...",
  ".....kcCk..kck..",
  "..k..kcCk..kcCk.",
  ".kck.kceCk.kcCk.",
  ".kcCkkcCCk.kcCk.",
  ".kcCkkcCCkkkcCk.",
  ".kceCkcCCkkceCk.",
  ".kcCCkcCCkkcCCk.",
  "..kcCkcCCkkcCk..",
  ".kkkkkkkkkkkkkk.",
  ".kAAAAAAAAAAAAk.",
  "..kkkkkkkkkkkk..",
  "................",
];

const bushSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  "....kkggggkk....",
  "...kggbgggGgk...",
  "..kgggggbgggGk..",
  "..kgbgggggbgGk..",
  ".kggggbggggggGk.",
  ".kgbggggggbgGGk.",
  ".kgggggbgggGGGk.",
  ".kGGGGGGGGGGGGk.",
  "..kkkkkkkkkkkk..",
  "................",
];

const herbSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......kk..kk....",
  ".....klk.klk....",
  "..kk..kG.Gk..kk.",
  ".klk..kGkGk.klk.",
  "..kGk.kGGGk.kGk.",
  "...kGkkGgGkkGk..",
  "....kGGgggGGk...",
  ".....kGgggGk....",
  "......kkkkk.....",
  "................",
];

// The flash of your weapon when you swing it
const slashSprite = [
  "................",
  "..........eee...",
  "............ee..",
  ".............ee.",
  "..............e.",
  "..............ee",
  "...............e",
  "...............e",
  "...............e",
  "...............e",
  "..............ee",
  "..............e.",
  ".............ee.",
  "............ee..",
  "..........eee...",
  "................",
];

// ----- Characters you can unlock in Free Play -----

const tomSprite = [
  "................",
  ".....kkkkkk.....",
  "....kjjjjjjk....",
  "...kjjjjjjjjkk..",
  "....khhhhhhkjk..",
  "....kskssksk.k..",
  "....kssssssk....",
  ".....kssssk.....",
  "....kyyyyyyk....",
  "...ksyyyyyysk...",
  "...ksyyyyyysk...",
  "....kyyyyyyk....",
  "....knnnnnnk....",
  "....knnk.knnk...",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];

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
  "...kRuuuuuuRk...",
  "..ksRRRuuRRRsk..",
  "...kRRRRRRRRk...",
  "....kWWWWWWk....",
  "....kWWk.kWWk...",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];

const fernSprite = [
  "................",
  "......kkkk......",
  "....kkYYYYkk....",
  "..kkYYYYYYYYkk..",
  "..kkkkkkkkkkkk..",
  "....khsssshk....",
  "....kskssksk....",
  "....khsssshk....",
  "....kh.kk.hk....",
  "....kFeeeeFk....",
  "...ksFFFFFFsk...",
  "...ksFFyyFFsk...",
  "....kFFFFFFk....",
  "....kFFk.kFFk...",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];

const knightSprite = [
  ".......kk.......",
  "......kSSk......",
  ".....kkSSkk.....",
  "....kWWWWWWk....",
  "...kWeWWWWWAk...",
  "...kWkkkkkkAk...",
  "...kWkxkkxkAk...",
  "...kWWWWWWWAk...",
  "....kkkkkkkk....",
  "...kSWWyyWWSk...",
  "..kWSSSSSSSSWk..",
  "..kWSSSSSSSSWk..",
  "...kSSSSSSSSk...",
  "....kWWk.kWWk...",
  "....kAAk.kAAk...",
  "....kkkk.kkkk...",
];

// Gloomy: a friendly Gloomling who decided to help!
const gloomySprite = [
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  "....kkmmmmkk....",
  "...kmmMmmmmmk...",
  "..kmmmmmmmmmmk..",
  "..kmyymmmmyymk..",
  "..kmykmmmmykmk..",
  "..kmmmmmmmmmmk..",
  "..kmmmkmmkmmmk..",
  "..kmmmmkkmmmmk..",
  "..kmkmmkkmmkmk..",
  "..kk.kk..kk.kk..",
  "................",
];

// ----- Things in the new Free Play areas -----

const wheatSprite = [
  "................",
  "................",
  "................",
  "..kB..kB..kB....",
  ".kBBk.kBBk.kBk..",
  ".kBBk.kBBkkBBk..",
  "..kBk..kBk.kBk..",
  "..kgk..kgk.kgk..",
  ".kBgk.kBgk.kgBk.",
  ".kBBk.kBBk.kBBk.",
  "..kgk..kgk.kgk..",
  "..kgk..kgk.kgk..",
  "..kgk..kgk.kgk..",
  "..kgk..kgk.kgk..",
  "..kkk..kkk.kkk..",
  "................",
];

const pumpkinSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......kgk......",
  "......kkgkk.....",
  "....kkPPkPPkk...",
  "...kPPPkPPPkPk..",
  "..kPPPPkPPPPkPk.",
  "..kPePPkPPPPkPk.",
  "..kPPPPkPPPPkPk.",
  "...kPPPkPPPkPk..",
  "....kkkkkkkkk...",
  "................",
];

const fenceSprite = [
  "................",
  "................",
  "................",
  "................",
  "..kk........kk..",
  ".kuUk......kuUk.",
  "kkuUkkkkkkkkuUkk",
  "kuuuuuuuuuuuuuuk",
  "kkuUkkkkkkkkuUkk",
  ".kuUk......kuUk.",
  "kkuUkkkkkkkkuUkk",
  "kuuuuuuuuuuuuuuk",
  "kkuUkkkkkkkkuUkk",
  ".kuUk......kuUk.",
  ".kkkk......kkkk.",
  "................",
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

// Jack the Pumpkin Scarecrow: unlocked by harvesting 20 pumpkins
const jackSprite = [
  "................",
  ".......kgk......",
  ".....kkPgPkk....",
  "....kPPPPPPPk...",
  "...kPPkPPPkPPk..",
  "...kPPPPPPPPPk..",
  "...kPPkkkkkPPk..",
  "....kPPPPPPPk...",
  ".....kkkkkkk....",
  "...kYkFFFFFkYk..",
  "..kYYkFFFFFkYYk.",
  "...kk.kFFFk.kk..",
  "......kFFFk.....",
  "......kYkYk.....",
  "......kukuk.....",
  "......kkkkk.....",
];

// A wizard who defends a temple. "v" is swapped for each temple's colour.
const wizardSprite = [
  "........k.......",
  ".......kvk......",
  "......kvvvk.....",
  ".....kvvyvvk....",
  "....kvvvvvvvk...",
  "...kkkkkkkkkkk..",
  ".....kssssk..ky.",
  ".....kskssk..ku.",
  ".....keeeek..ku.",
  "....kveeeevk.ku.",
  "...kvvveevvvkku.",
  "...kvvvvvvvvsku.",
  "...kvvvvvvvvkku.",
  "....kvvvvvvk.ku.",
  "....kvvvvvvk.ku.",
  "....kkkkkkkk.kk.",
];
