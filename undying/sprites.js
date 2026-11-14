// Pixel art for The Undying Lands.
// Each sprite is 8 rows of 8 letters. Each letter is a colour, and "." is see-through.
// In 3D, every pixel becomes a little cube!

const colours = {
  h: "#5a3a1e", // brown hair
  A: "#d9a95b", // sandy hair
  s: "#f2c79b", // skin
  c: "#6f8a64", // elven cloak (grey-green)
  y: "#f2c443", // gold
  e: "#ffffff", // white
  W: "#cfd3dc", // light grey
  u: "#7a4f2a", // wood / brown
  t: "#5e4126", // dark brown
  r: "#b8322a", // red
  k: "#1e1a24", // black
  v: "#c9d6e3", // silver
  p: "#5b2a6e", // deep purple
  o: "#3a6fd8", // blue
  q: "#f3e9c8", // paper
  i: "#3a2a1a", // ink
  l: "#b8e0a8", // silverleaf green
  g: "#3f8a3a", // stem green
  b: "#f5e08a", // blonde hair
  d: "#2a1d14", // dark hair
  S: "#e8ecf2", // silver hair
  G: "#3f8f5a", // green robe
  B: "#3a5fb8", // blue robe
  T: "#2f9a9a", // teal robe
  V: "#8a5ac8", // violet robe
  C: "#7fe0ff", // crystal blue
  R: "#c86a3a", // fox orange
};

// ----- People -----

const frodoSprite = [
  ".hhhhh..",
  "hhhhhhh.",
  ".hssssh.",
  "..ssss..",
  ".cccccc.",
  "sccyccs.",
  ".cccccc.",
  ".ss..ss.",
];

const gandalfSprite = [
  "...ee..y",
  "..eeee.u",
  ".eeeeeeu",
  "..ssss.u",
  "..eeee.u",
  ".WeeeeWu",
  "sWWWWWWs",
  ".WWWWWW.",
];

const bilboSprite = [
  "..WWWW..",
  ".WWWWWW.",
  ".WssssW.",
  "..ssss..",
  ".rryyrr.",
  "srryyrrs",
  ".uuuuuu.",
  ".ss..ss.",
];

const galadrielSprite = [
  "..yyyy..",
  ".yyyyyy.",
  ".yssssy.",
  ".yssssy.",
  ".yeeeey.",
  "seeeeees",
  ".eeeeee.",
  "eeeeeeee",
];

const elrondSprite = [
  "..vvvv..",
  ".kkkkkk.",
  ".kssssk.",
  ".kssssk.",
  ".pppppp.",
  "sppvvpps",
  ".pppppp.",
  ".pppppp.",
];

const samSprite = [
  "..AAAA..",
  ".AAAAAA.",
  "..ssss..",
  "..ssss..",
  ".ueeeeu.",
  "sueeeeus",
  ".tttttt.",
  ".ss..ss.",
];

// ----- Things to collect -----

const pageSprite = [
  "........",
  ".qqqqq..",
  ".qiiiqq.",
  ".qqqqqq.",
  ".qiiiiq.",
  ".qqqqqq.",
  "..qqqqq.",
  "........",
];

const herbSprite = [
  "...l....",
  "..lvl.l.",
  "...l.lvl",
  ".l..g.l.",
  "lvl.g...",
  ".l..g...",
  "...ggg..",
  "........",
];

const pearlSprite = [
  "........",
  "........",
  "...ee...",
  "..evve..",
  "..evve..",
  "...ee...",
  "........",
  "........",
];

// ----- The swan ship -----

const shipSprite = [
  ".....ee.",
  "....e.ey",
  "....e...",
  "....e...",
  "e...e...",
  "eeeeeee.",
  "eeeeeeee",
  ".uuuuuu.",
];

// ----- More friends -----

const legolasSprite = [
  "..bbbb..",
  ".bbbbbbu",
  ".bssssbu",
  "..ssss.u",
  ".GGGGGGu",
  "sGGyGGsu",
  ".tttttt.",
  ".tt..tt.",
];

const gimliSprite = [
  "..vvvv..",
  ".vvvvvv.",
  ".rssssr.",
  "rrrrrrrv",
  "rrrrrr.v",
  "suuyuusu",
  ".uuuuuu.",
  ".tt..tt.",
];

// Elves all share one shape, with different hair and robe colours.
// This function swaps the letters H (hair) and X (robe) for real colours.
function elfSprite(hair, robe) {
  const shape = [
    "..HHHH..",
    ".HHHHHH.",
    ".HssssH.",
    ".HssssH.",
    ".XXXXXX.",
    "sXXyyXXs",
    ".XXXXXX.",
    ".XXXXXX.",
  ];
  return shape.map(function (row) {
    return row.replaceAll("H", hair).replaceAll("X", robe);
  });
}

// ----- Animals -----

const swanSprite = [
  "........",
  ".ee.....",
  "e.ey....",
  ".e......",
  ".e..eee.",
  ".eeeeeee",
  "..eeeee.",
  "........",
];

const deerSprite = [
  ".u...u..",
  "..u.u...",
  "..uuu...",
  "..uku...",
  "...uuuuu",
  "...uuuuu",
  "...u...u",
  "...u...u",
];

const foxSprite = [
  "........",
  ".R.R....",
  ".RRR....",
  ".RkR....",
  "..RRRRR.",
  "..RRRRRe",
  "..R..R..",
  "........",
];

// ----- More things to collect -----

const crystalSprite = [
  "...C....",
  "..CvC...",
  "..CvC.C.",
  ".CCvCCvC",
  ".CvCCCvC",
  ".CCCCCC.",
  "..CCCC..",
  "........",
];

const featherSprite = [
  "......e.",
  ".....ee.",
  "....eWe.",
  "...eWe..",
  "..eWe...",
  ".eWe....",
  ".u......",
  "u.......",
];
