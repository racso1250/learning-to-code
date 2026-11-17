// Space Explorers: the pictures.
// Like the Dragon Tamers games, every sprite is drawn by code with the little pixel-art
// toolkit in ../dragon/pixels.js (boxes, ovals and shapes, then a dark outline).

// An astronaut: a person in a coloured space suit, with a glass helmet and a backpack
function drawAstronaut(suit, dir, step) {
  const sprite = drawPerson({ skin: "#f2c79a", hair: "#3a2a20", style: "short", tunic: suit, trim: "#ffffff", sleeve: tone(suit, 0.82), pants: tone(suit, 0.72), boots: "#3a3a46", belt: "#3a3a46" }, dir, step);
  const g = sprite.getContext("2d");
  g.fillStyle = "#dff3ff";          // the helmet: a ring of glass round the head
  g.fillRect(5, 9, 10, 1);
  g.fillRect(3, 11, 1, 7);
  g.fillRect(16, 11, 1, 7);
  g.fillRect(4, 10, 1, 1);
  g.fillRect(15, 10, 1, 1);
  g.fillRect(4, 18, 1, 1);
  g.fillRect(15, 18, 1, 1);
  g.fillStyle = "#8a92a2";          // the collar
  g.fillRect(5, 19, 10, 1);
  if (dir !== 3) {
    g.fillStyle = "rgba(255, 255, 255, 0.75)";      // a shine on the glass
    g.fillRect(dir === 1 ? 6 : 13, 12, 1, 3);
  } else {
    g.fillStyle = "#8a92a2";        // the air tank on their back
    g.fillRect(7, 20, 6, 6);
    g.fillStyle = "#5a6272";
    g.fillRect(9, 21, 2, 4);
  }
  return sprite;
}
function astronautSet(suit) {
  const set = [];
  for (let dir = 0; dir < 4; dir++) {
    set.push([]);
    for (let step = 0; step < 4; step++) set[dir].push(drawAstronaut(suit, dir, step));
  }
  return set;
}

// The ship: a silver lander with a glass dome
function drawShip() {
  const a = new Art(78, 62);
  a.line(16, 44, 7, 57, "#5a6272");
  a.line(62, 44, 71, 57, "#5a6272");
  a.box(3, 57, 9, 3, "#3a3a46");
  a.box(66, 57, 9, 3, "#3a3a46");
  a.oval(39, 41, 25, 9, "#8a92a2");
  a.oval(39, 35, 31, 13, "#cdd3dc");
  a.oval(39, 31, 26, 7, "#e6eaf0");
  a.box(9, 35, 60, 3, "#e0503a");
  a.oval(39, 22, 14, 12, "#5ab0e8");
  a.oval(34, 17, 4, 3, "#dff3ff");
  a.line(39, 10, 39, 3, "#5a6272");
  a.box(38, 1, 3, 3, "#ff3b4a");
  for (const x of [17, 28, 47, 58]) a.box(x, 39, 4, 3, "#ffe14a");
  a.box(34, 43, 10, 11, "#5a6272");
  a.box(35, 44, 8, 9, "#2a3040");
  a.shape([[32, 54], [46, 54], [49, 60], [29, 60]], "#8a92a2");
  return finish(a);
}

function drawTurret() {
  const a = new Art(18, 22);
  a.box(4, 14, 10, 6, "#5a6272");
  a.box(2, 19, 14, 2, "#3a3a46");
  a.oval(9, 11, 5.5, 4.5, "#aab2c0");
  a.box(8, 2, 2, 8, "#3a3a46");
  a.box(7, 1, 4, 2, "#5a6272");
  a.dot(11, 11, "#ff3b4a");
  return finish(a);
}

function drawWall() {
  const a = new Art(18, 22);
  a.box(1, 7, 16, 13, "#8a92a2");
  a.box(1, 7, 16, 3, "#ffd84a");
  for (let x = 2; x < 16; x += 4) a.box(x, 7, 2, 3, "#2a2c36");
  for (const [x, y] of [[3, 12], [14, 12], [3, 17], [14, 17]]) a.dot(x, y, "#5a6272");
  a.box(1, 14, 16, 1, "#6a7282");
  return finish(a);
}

function drawScrap() {
  const a = new Art(16, 12);
  a.box(2, 6, 7, 4, "#8a92a2");
  a.box(7, 3, 6, 5, "#aab2c0");
  a.box(4, 4, 3, 3, "#c87a3a");
  a.line(10, 9, 14, 6, "#5a6272");
  a.dot(9, 5, "#3a3a46");
  return finish(a);
}

function drawChart() {
  const a = new Art(16, 18);
  a.box(3, 2, 10, 14, "#3a2a6a");
  a.box(4, 3, 8, 12, "#5a3a9a");
  for (const [x, y] of [[6, 5], [9, 7], [5, 10], [10, 12], [7, 13]]) a.dot(x, y, "#ffffff");
  a.line(6, 5, 9, 7, "#bfa8ff");
  a.line(9, 7, 5, 10, "#bfa8ff");
  return finish(a);
}

// The little rocket seen from the side, for flying between planets
function drawRocket(frame) {
  const a = new Art(40, 20);
  a.shape(frame ? [[1, 10], [9, 6], [9, 14]] : [[4, 10], [9, 7], [9, 13]], "#ffb52e");
  a.shape([[8, 3], [14, 8], [8, 8]], "#e0503a");
  a.shape([[8, 17], [14, 12], [8, 12]], "#e0503a");
  a.oval(20, 10, 13, 5.5, "#cdd3dc");
  a.shape([[30, 5.5], [38, 10], [30, 14.5]], "#e0503a");
  a.oval(24, 9, 3.4, 2.6, "#5ab0e8");
  a.box(10, 9, 6, 2, "#8a92a2");
  return finish(a);
}

// The face that jumps out of the dark: horns, burning eyes and a mouth full of teeth
function drawScareFace() {
  const a = new Art(44, 40);
  a.shape([[8, 14], [3, 1], [15, 9]], "#e6dcc8");
  a.shape([[36, 14], [41, 1], [29, 9]], "#e6dcc8");
  a.oval(22, 21, 16, 15, "#1a0812");
  a.oval(22, 17, 13, 8, "#2e1424");
  a.shape([[8, 14], [19, 18], [17, 22], [9, 19]], "#ffe14a");       // slanted, glowing eyes
  a.shape([[36, 14], [25, 18], [27, 22], [35, 19]], "#ffe14a");
  a.box(14, 17, 2, 3, "#ff3b1a");
  a.box(28, 17, 2, 3, "#ff3b1a");
  a.box(11, 27, 22, 6, "#06020a");                                   // the mouth
  for (let x = 11; x < 33; x += 4) {
    a.shape([[x, 27], [x + 4, 27], [x + 2, 30]], "#ffffff");
    a.shape([[x + 2, 33], [x + 6, 33], [x + 4, 30]], "#ffffff");
  }
  return finish(a);
}

// A broken piece of the ship that came here before you
function drawWreck() {
  const a = new Art(30, 22);
  a.shape([[2, 20], [6, 8], [18, 4], [27, 12], [28, 20]], "#6a7282");
  a.shape([[6, 8], [18, 4], [16, 12], [9, 14]], "#8a92a2");
  a.box(12, 12, 8, 8, "#2a3040");
  a.line(20, 5, 25, 1, "#3a3a46");
  a.box(4, 16, 4, 2, "#e0503a");
  a.dot(22, 15, "#ffe14a");
  a.speckle("#4a5262", 0.08, 81);
  return finish(a);
}

// Build every sprite once, when the game starts
function buildArt() {
  const s = {};
  s.crew = { you: astronautSet("#f08a3a"), nova: astronautSet("#3a8fd8"), tink: astronautSet("#f0c83a"), doc: astronautSet("#e8ecf2") };
  s.ship = drawShip();
  s.turret = drawTurret();
  s.wall = drawWall();
  s.lamp = drawLantern();
  s.scrap = drawScrap();
  s.chart = drawChart();
  s.crystal = drawGem("#3ad8e8");
  s.things = PLANETS.map((planet) => drawGem(planet.thing[1]));
  s.rocket = [drawRocket(0), drawRocket(1)];
  s.heart = drawHeart();
  // Demons: horned, dark and red (each has two frames, and a white "ouch" version)
  const demon = function (frames, times) {
    const big = times ? frames.map((frame) => scaled(frame, times)) : frames;
    return { frames: big, hurt: big.map((frame) => tinted(frame, "#ffffff")), w: big[0].width, h: big[0].height };
  };
  s.demons = {
    // (They are nearly black, so in the dark all you see is their eyes)
    imp: demon([drawImp(0, "#3a1428", "#1a0812", "#ff4a3a"), drawImp(1, "#3a1428", "#1a0812", "#ff4a3a")]),
    brute: demon([drawGolem(0, "#2e1c2e", "#160c18", "#ff7a1a", "#5a1424", "#44283e"), drawGolem(1, "#2e1c2e", "#160c18", "#ff7a1a", "#5a1424", "#44283e")], 1.2),
    spitter: demon([drawSpider(0, "#2a1440", "#120820", "#7af0ff"), drawSpider(1, "#2a1440", "#120820", "#7af0ff")]),
    wing: demon([drawBat(0, "#2a0c18", "#4a1424", "#ffe14a"), drawBat(1, "#2a0c18", "#4a1424", "#ffe14a")]),
    king: demon([drawImp(0, "#22102e", "#0e0616", "#ff3b3b"), drawImp(1, "#22102e", "#0e0616", "#ff3b3b")], 3.2),
  };
  s.face = scaled(drawScareFace(), 5);       // the big face that flashes up when one pounces
  s.wreck = drawWreck();
  // Things that grow on the planets
  s.plants = {
    oak: [drawOak(0), drawOak(1), drawOak(2)], bush: [drawBush(false)], mushroom: [drawMushroom()], cactus: [drawCactus()],
    rock: [drawRock(0), drawRock(1), drawRock(2)], skull: [drawSkull()], snowpine: [drawPine(true)], icespire: [drawIceSpire()],
    ashtree: [drawAshTree()], spike: [drawSpike()], doomtree: [drawDoomTree(0), drawDoomTree(1), drawDoomTree(2)], darkpillar: [drawPillar(true)],
    peak: [drawPeak(false, 0), drawPeak(false, 1), drawPeak(false, 2)], snowpeak: [drawPeak(true, 0), drawPeak(true, 1), drawPeak(true, 2)],
  };
  s.glow = {
    warm: drawGlow(128, "rgba(255, 214, 140, 1)"), fire: drawGlow(128, "rgba(255, 150, 60, 1)"), cyan: drawGlow(128, "rgba(120, 240, 255, 1)"),
    red: drawGlow(128, "rgba(255, 70, 80, 1)"), white: drawGlow(128, "rgba(255, 255, 255, 1)"),
  };
  return s;
}
