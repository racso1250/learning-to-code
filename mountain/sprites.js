// Pixel art for Pinecrest. Every sprite is 16 x 16 pixels.
// Each letter is a colour, and "." is see-through.

const colours = {
  k: "#1d1726", // outline
  R: "#d6403a", // beanie
  r: "#9a2a26", // beanie stripe
  h: "#6b3f22", // brown hair
  s: "#f2c79b", // skin
  j: "#7a7a3a", // old jacket
  P: "#b07a4a", // jacket patch
  n: "#3a4a6a", // trousers
  u: "#6b4423", // brown (boots, wood)
  p: "#8a5a2c", // backpack
  b: "#3f74c9", // Tom's blue cap
  y: "#f6d04a", // yellow
  W: "#c4c2cc", // light grey
  A: "#6e6b78", // dark grey
  e: "#ffffff", // white
  v: "#7a4aa8", // Mabel's purple shawl
  g: "#4fae4a", // green
  G: "#2f6a3a", // dark green
  O: "#ff8a1a", // orange flame
  o: "#fff0a0", // hot flame
  c: "#a4a2ad", // ore colour (changes for each kind of ore)
  d: "#6e6b78", // ore colour, darker
};

// ----- You -----

const kidFront = [
  "................",
  "......kkkk......",
  ".....kRRRRk.....",
  "....kRRRRRRk....",
  "....kRrRrRrk....",
  "....khsssshk....",
  "....kskssksk....",
  "....kssssssk....",
  ".....kssssk.....",
  "....kjjjjjjk....",
  "...ksjjPjjjsk...",
  "...ksjjjjPjsk...",
  "....kjjjjjjk....",
  "....knnk.knnk...",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];

const kidBack = [
  "................",
  "......kkkk......",
  ".....kRRRRk.....",
  "....kRRRRRRk....",
  "....kRrRrRrk....",
  "....khhhhhhk....",
  "....khhhhhhk....",
  "....khhhhhhk....",
  ".....khhhhk.....",
  "....kjppppjk....",
  "...ksppppppsk...",
  "...ksppppppsk...",
  "....kjppppjk....",
  "....knnk.knnk...",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];

// ----- People in the village -----

const tomSprite = [
  "................",
  ".....kkkkkk.....",
  "....kbbbbbbk....",
  "...kbbbbbbbbkk..",
  "....khhhhhhkbk..",
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

const mabelSprite = [
  "................",
  "......kkkk......",
  ".....kWWWWk.....",
  "....kWWWWWWk....",
  "....kWssssWk....",
  "....kskssksk....",
  "....kssssssk....",
  ".....kssssk.....",
  "...kvvvvvvvvk...",
  "..ksvveeeevvsk..",
  "..ksvveeeevvsk..",
  "...kvveeeevvk...",
  "...kvvvvvvvvk...",
  "....kvvvvvvk....",
  "....kuuk.kuuk...",
  "....kkkk.kkkk...",
];

// ----- Things in the world -----

// An ore rock. The c and d pixels are swapped for the colour of each ore.
const oreSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  "....kkWWWWkk....",
  "...kWcWWWdWAk...",
  "..kWWWWcWWAAAk..",
  "..kWdWWWWAAcAk..",
  ".kAWWWcWAAAAdAk.",
  ".kAAdAAAAcAAAAk.",
  ".kAAAAAAAAAAAAk.",
  "..kkkkkkkkkkkk..",
  "................",
];

const pineSprite = [
  ".......kk.......",
  "......kGGk......",
  ".....kGgGGk.....",
  "......kGGk......",
  ".....kGgGGk.....",
  "....kGGGgGGk....",
  "...kGGGGGGGGk...",
  ".....kGGgGk.....",
  "....kGGGGGgGk...",
  "...kGgGGGGGGGk..",
  "..kGGGGGGGGGgGk.",
  ".kkkkkkkkkkkkkk.",
  "......kuuk......",
  "......kuuk......",
  "......kuuk......",
  ".....kkkkkk.....",
];

const campfireSprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......kk.......",
  "......kyyk......",
  ".....kyOOyk.....",
  ".....kyOOyk.....",
  "....kyOooOyk....",
  "....kyOooOyk....",
  "...kkuuuuuukk...",
  "..kuukuuuukuuk..",
  "..kkkkkkkkkkkk..",
  "................",
];

const signSprite = [
  "................",
  "................",
  "................",
  "..kkkkkkkkkkkk..",
  "..kuuuuuuuuuuk..",
  "..kuekeekeeeuk..",
  "..kuuuuuuuuuuk..",
  "..kueeekeekeuk..",
  "..kuuuuuuuuuuk..",
  "..kkkkkkkkkkkk..",
  ".......kuk......",
  ".......kuk......",
  ".......kuk......",
  ".......kuk......",
  "......kkkkk.....",
  "................",
];
