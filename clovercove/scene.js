// Clover Cove: the scene.
// The ground, the trees and flowers, the buildings, the people and animals, and the inside of your house.

// ===== 1. Setting up =====
const canvas = document.getElementById("game");
const testing = location.search.includes("test");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa8dcf4, 40, 110);
const camera = new THREE.PerspectiveCamera(38, 1.5, 0.5, 400);
// Add ?plain to the address to switch shadows off (if the game runs slowly)
const shadows = !location.search.includes("plain");
renderer.shadowMap.enabled = shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const dice = seeded(777);
const helper = new THREE.Object3D();
const MAP = makeMap();
const WIDE = COLS * TILE;
const DEEP = ROWS * TILE;

function fit() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== w || size.y !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

const skyLight = new THREE.HemisphereLight(0xe8f4ff, 0x6a8a5a, 0.7);
scene.add(skyLight);
const sunLight = new THREE.DirectionalLight(0xfff0d0, 0.65);
sunLight.castShadow = shadows;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -34;
sunLight.shadow.camera.right = sunLight.shadow.camera.top = 34;
sunLight.shadow.camera.near = 5;
sunLight.shadow.camera.far = 160;
sunLight.shadow.bias = -0.0008;
scene.add(sunLight, sunLight.target);

// ===== 2. Little helpers =====
// Flat, chunky sides (good for buildings)
function paint(colour) {
  return new THREE.MeshPhongMaterial({ color: colour, shininess: 8, flatShading: true });
}

// Smooth and soft (good for people and animals)
function soft(colour) {
  return new THREE.MeshPhongMaterial({ color: colour, shininess: 16 });
}

function bright(colour) {
  return new THREE.MeshBasicMaterial({ color: colour });
}

function piece(parent, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function box(parent, material, w, h, d, x, y, z) {
  return piece(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}

// A ball squashed into an egg shape: rx wide, ry tall, rz long
const ballShape = new THREE.SphereGeometry(1, 14, 10);
function ball(parent, material, rx, ry, rz, x, y, z) {
  const mesh = piece(parent, ballShape, material, x, y, z);
  mesh.scale.set(rx, ry, rz);
  return mesh;
}

function shade(thing) {
  thing.traverse(function (part) {
    if (part.isMesh && !part.material.transparent) part.castShadow = true;
  });
  return thing;
}

// Many copies of one shape, drawn in one go. Each can have its own colour.
function many(geometry, material, count) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

const tint = new THREE.Color();
function putOne(mesh, slot, x, y, z, sx, sy, sz, turn, colour) {
  helper.position.set(x, y, z);
  helper.rotation.set(0, turn || 0, 0);
  helper.scale.set(sx, sy, sz);
  helper.updateMatrix();
  mesh.setMatrixAt(slot, helper.matrix);
  if (colour !== undefined) mesh.setColorAt(slot, tint.setHex(colour));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// Words painted on a board
function board(text, wide, high, colour, back) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = Math.round(256 * high / wide);
  const pen = c.getContext("2d");
  pen.fillStyle = back;
  pen.fillRect(0, 0, c.width, c.height);
  pen.fillStyle = colour;
  pen.font = "bold " + Math.round(c.height * 0.5) + "px Georgia, serif";
  pen.textAlign = "center";
  pen.fillText(text, 128, c.height * 0.67, 244);
  return new THREE.Mesh(new THREE.PlaneGeometry(wide, high), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
}

// ===== 3. The ground =====
// The whole village floor is one big picture, painted square by square. It is painted again
// when the season changes (green in spring, golden in autumn, white in winter).
const groundCanvas = document.createElement("canvas");
groundCanvas.width = COLS * 16;
groundCanvas.height = ROWS * 16;
const groundTexture = new THREE.CanvasTexture(groundCanvas);
const GRASS = [["#7cc85a", "#74c054"], ["#5ab84a", "#54b046"], ["#c8b04a", "#c0a846"], ["#eef4f8", "#e6eef4"]];

function paintGround(season) {
  const pen = groundCanvas.getContext("2d");
  const roll = seeded(5);
  for (let k = 0; k < ROWS; k++) {
    for (let i = 0; i < COLS; i++) {
      const type = MAP.ground[k][i];
      const odd = (i + k) % 2;
      pen.fillStyle = type === "grass" ? GRASS[season][odd] : type === "sand" ? (odd ? "#f0e0a8" : "#ecd89c") : type === "water" ? (MAP.water[k][i] === "sea" ? "#2f8ac8" : "#4aa8dc") : type === "path" ? "#c8a878" : type === "stone" ? (odd ? "#c8c8c0" : "#b8b8b0") : "#a8763e";
      pen.fillRect(i * 16, k * 16, 16, 16);
      if (type === "grass" && roll() < 0.3) {
        // little tufts
        pen.fillStyle = season === 3 ? "#ffffff" : "rgba(40, 110, 40, 0.35)";
        pen.fillRect(i * 16 + 3 + roll() * 9, k * 16 + 3 + roll() * 9, 2, 4);
      } else if (type === "bridge") {
        pen.fillStyle = "#8a5a2e";
        for (let n = 0; n < 4; n++) pen.fillRect(i * 16, k * 16 + n * 4, 16, 1);
      } else if (type === "water") {
        // a pale edge where water meets land
        pen.fillStyle = "rgba(255, 255, 255, 0.45)";
        if (k > 0 && MAP.ground[k - 1][i] !== "water" && MAP.ground[k - 1][i] !== "bridge") pen.fillRect(i * 16, k * 16, 16, 3);
        if (i > 0 && MAP.ground[k][i - 1] !== "water" && MAP.ground[k][i - 1] !== "bridge") pen.fillRect(i * 16, k * 16, 3, 16);
        if (i < COLS - 1 && MAP.ground[k][i + 1] !== "water" && MAP.ground[k][i + 1] !== "bridge") pen.fillRect(i * 16 + 13, k * 16, 3, 16);
        if (k < ROWS - 1 && MAP.ground[k + 1][i] !== "water" && MAP.ground[k + 1][i] !== "bridge") pen.fillRect(i * 16, k * 16 + 13, 16, 3);
      }
    }
  }
  groundTexture.needsUpdate = true;
}

(function () {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WIDE, DEEP), new THREE.MeshLambertMaterial({ map: groundTexture }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(WIDE / 2, 0, DEEP / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  // More sea and more woods beyond the edges, so the village does not end in nothing
  const sea = piece(scene, new THREE.PlaneGeometry(600, 300), new THREE.MeshLambertMaterial({ color: 0x2f8ac8 }), WIDE / 2, -0.05, DEEP + 100);
  sea.rotation.x = -Math.PI / 2;
  const woods = piece(scene, new THREE.PlaneGeometry(600, 400), new THREE.MeshLambertMaterial({ color: 0x3f7a3a }), WIDE / 2, -0.06, DEEP / 2 - 60);
  woods.rotation.x = -Math.PI / 2;
  // Bridge rails
  const rail = paint(0x8a5a2e);
  for (let k = 0; k < ROWS; k++) {
    for (let i = 0; i < COLS; i++) {
      if (MAP.ground[k][i] !== "bridge") continue;
      for (const s of [-1, 1]) {
        box(scene, rail, TILE, 0.12, 0.12, mid(i), 0.7, mid(k) + s * 0.95).castShadow = true;
        box(scene, rail, 0.14, 0.8, 0.14, mid(i) - 0.9, 0.4, mid(k) + s * 0.95);
      }
      box(scene, paint(0xa8763e), TILE, 0.16, TILE, mid(i), 0.06, mid(k));
    }
  }
})();

// Sparkles on the water
const sparkles = [];
(function () {
  for (let n = 0; n < 500 && sparkles.length < 70; n++) {
    const i = Math.floor(dice() * COLS);
    const k = Math.floor(dice() * ROWS);
    if (MAP.ground[k][i] === "water") sparkles.push({ x: mid(i) + dice() - 0.5, z: mid(k) + dice() - 0.5, at: dice() * 6 });
  }
})();
const sparkleMesh = many(new THREE.CircleGeometry(0.16, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }), sparkles.length);

// ===== 4. Trees, flowers and rocks =====
const trees = [];          // every tree: { i, k, x, z, type, fruit, has (fruit on it right now), shake, slot }
const flowers = [];
const rocks = [];
for (const key in MAP.things) {
  const thing = MAP.things[key];
  const at = key.split(",").map(Number);
  const spot = { i: at[0], k: at[1], x: mid(at[0]), z: mid(at[1]) };
  if (thing.type === "tree" || thing.type === "pine" || thing.type === "palm") trees.push(Object.assign(spot, { type: thing.type, fruit: thing.fruit || "", has: !!thing.fruit, shake: 0, slot: trees.length, tall: 0.85 + dice() * 0.35 }));
  else if (thing.type === "flower") flowers.push(Object.assign(spot, { colour: thing.colour, x: spot.x + (dice() - 0.5) * 0.6, z: spot.z + (dice() - 0.5) * 0.6 }));
  else if (thing.type === "rock") rocks.push(spot);
}
const trunkShape = new THREE.CylinderGeometry(0.22, 0.32, 1, 7);
trunkShape.translate(0, 0.5, 0);
const coneShape = new THREE.ConeGeometry(1, 1, 8);
coneShape.translate(0, 0.5, 0);
const white = function () { return new THREE.MeshLambertMaterial({ color: 0xffffff }); };
const trunkMesh = many(trunkShape, white(), trees.length);
const leafMesh = many(new THREE.IcosahedronGeometry(1, 1), white(), trees.length * 3);
const pineMesh = many(coneShape, white(), trees.length * 2);
const fruitMesh = many(new THREE.SphereGeometry(0.2, 8, 6), white(), trees.length * 3);
trunkMesh.castShadow = leafMesh.castShadow = pineMesh.castShadow = true;
// What colour the leaves are in each season
const LEAVES = [[0x6ad85a, 0x5ac84e, 0xffb8d8], [0x3fa84a, 0x349a40, 0x4ab85a], [0xe8963a, 0xd8742a, 0xe8c03a], [0xf4f8ff, 0xe4ecf4, 0xd8e4f0]];
const PINES = [0x2f7a3a, 0x2a6a32, 0x2f6a3a, 0xd8e8f0];

function drawTree(tree, season) {
  const wobble = tree.shake > 0 ? Math.sin(tree.shake * 40) * 0.12 * tree.shake : 0;
  const t = tree.tall;
  const x = tree.x + wobble;
  if (tree.type === "pine") {
    putOne(trunkMesh, tree.slot, tree.x, 0, tree.z, 1, 1.4 * t, 1, 0, 0x5a4030);
    putOne(pineMesh, tree.slot * 2, x, 1 * t, tree.z, 1.5 * t, 2.6 * t, 1.5 * t, 0, PINES[season]);
    putOne(pineMesh, tree.slot * 2 + 1, x, 2.6 * t, tree.z, 1.05 * t, 2 * t, 1.05 * t, 0, PINES[season]);
    for (let n = 0; n < 3; n++) putOne(leafMesh, tree.slot * 3 + n, 0, -5, 0, 0.001, 0.001, 0.001);
  } else if (tree.type === "palm") {
    putOne(trunkMesh, tree.slot, tree.x, 0, tree.z, 0.7, 3.6 * t, 0.7, 0, 0xa88a5a);
    for (let n = 0; n < 3; n++) putOne(leafMesh, tree.slot * 3 + n, x + Math.cos(n * 2.1) * 0.8, 3.6 * t, tree.z + Math.sin(n * 2.1) * 0.8, 1.2, 0.25, 0.55, -n * 2.1, 0x3fa84a);
    for (let n = 0; n < 2; n++) putOne(pineMesh, tree.slot * 2 + n, 0, -5, 0, 0.001, 0.001, 0.001);
  } else {
    putOne(trunkMesh, tree.slot, tree.x, 0, tree.z, 1, 1.7 * t, 1, 0, 0x6a4a2a);
    for (let n = 0; n < 3; n++) {
      const tone = LEAVES[season][season === 0 && tree.slot % 3 === 0 ? 2 : n % 2];
      putOne(leafMesh, tree.slot * 3 + n, x + [0, -0.55, 0.55][n] * t, (n ? 2.3 : 2.9) * t, tree.z + [0, 0.25, -0.2][n] * t, [1.15, 0.9, 0.9][n] * t, [1, 0.8, 0.8][n] * t, [1.15, 0.9, 0.9][n] * t, tree.slot, tone);
    }
    for (let n = 0; n < 2; n++) putOne(pineMesh, tree.slot * 2 + n, 0, -5, 0, 0.001, 0.001, 0.001);
  }
  // Fruit hangs in the leaves (or under a palm's)
  for (let n = 0; n < 3; n++) {
    const show = tree.has ? 1 : 0.001;
    const high = tree.type === "palm" ? 3.3 * t : 2.1 * t;
    putOne(fruitMesh, tree.slot * 3 + n, x + Math.cos(n * 2.1 + 0.5) * (tree.type === "palm" ? 0.3 : 0.75) * t, high + (n % 2) * 0.25, tree.z + Math.sin(n * 2.1 + 0.5) * 0.5 * t + 0.5, show, show, show, 0, tree.fruit ? GOODS[tree.fruit].colour : 0xffffff);
  }
}

const stemMesh = many(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0x3f8a3a }), flowers.length);
const bloomMesh = many(new THREE.SphereGeometry(0.17, 7, 5), white(), flowers.length);
const rockMesh = many(new THREE.DodecahedronGeometry(0.8, 0), new THREE.MeshLambertMaterial({ color: 0x9a9aa0 }), rocks.length);
rockMesh.castShadow = true;
flowers.forEach(function (flower, n) {
  putOne(stemMesh, n, flower.x, 0.25, flower.z, 1, 1, 1);
  putOne(bloomMesh, n, flower.x, 0.55, flower.z, 1, 0.8, 1, 0, flower.colour);
});
rocks.forEach(function (rock, n) { putOne(rockMesh, n, rock.x, 0.4, rock.z, 1, 0.75, 1, n); });

function drawSeason(season) {
  paintGround(season);
  for (const tree of trees) drawTree(tree, season);
  // In winter the flowers sleep under the snow
  flowers.forEach(function (flower, n) { putOne(bloomMesh, n, flower.x, 0.55, flower.z, season === 3 ? 0.4 : 1, season === 3 ? 0.4 : 0.8, season === 3 ? 0.4 : 1, 0, season === 3 ? 0xffffff : flower.colour); });
}

// ===== 5. Buildings =====
// A pointed roof: a triangle (as wide as "span" and as tall as "high"), stretched out to be "long".
// Its ridge runs from west to east.
function roofShape(span, high, long) {
  const triangle = new THREE.Shape();
  triangle.moveTo(-span / 2, 0);
  triangle.lineTo(span / 2, 0);
  triangle.lineTo(0, high);
  triangle.lineTo(-span / 2, 0);
  const shape = new THREE.ExtrudeGeometry(triangle, { depth: long, bevelEnabled: false });
  shape.translate(0, 0, -long / 2);
  shape.rotateY(Math.PI / 2);
  return shape;
}

const lampBulbs = [];      // the bulbs of the lamp posts (they glow at night)
// A little house: walls, a pointed roof, a door, two windows and a chimney. Its door faces south.
function makeHouse(wide, deep, high, wallColour, roofColour, doorColour) {
  const g = new THREE.Group();
  const wall = paint(wallColour);
  const roof = paint(roofColour);
  box(g, wall, wide, high, deep, 0, high / 2, 0);
  piece(g, roofShape(deep + 0.7, deep * 0.55, wide + 0.6), roof, 0, high, 0);
  box(g, paint(doorColour), 0.9, 1.5, 0.12, 0, 0.75, deep / 2 + 0.02);
  ball(g, bright(0xffd23a), 0.07, 0.07, 0.07, 0.3, 0.75, deep / 2 + 0.1);
  for (const s of [-1, 1]) {
    box(g, new THREE.MeshPhongMaterial({ color: 0xbfe8ff, emissive: 0x4a4a2a, shininess: 90 }), 0.8, 0.7, 0.1, s * wide * 0.32, high * 0.58, deep / 2 + 0.02);
    box(g, paint(0xffffff), 0.9, 0.08, 0.14, s * wide * 0.32, high * 0.58, deep / 2 + 0.03);
    box(g, paint(0xffffff), 0.08, 0.8, 0.14, s * wide * 0.32, high * 0.58, deep / 2 + 0.03);
  }
  box(g, paint(0xb8a898), 0.5, 1.2, 0.5, wide * 0.28, high + deep * 0.36, -deep * 0.2);
  return shade(g);
}

const homeSpot = { x: (PLACES.home.i + PLACES.home.w / 2) * TILE, z: (PLACES.home.k + PLACES.home.d / 2) * TILE };
let homeModel = null;
// Your own house gets bigger (and at last, golden) as you pay off your loans
function drawHome(stage) {
  if (homeModel) scene.remove(homeModel);
  const big = [0.72, 0.86, 1, 1][stage];
  homeModel = makeHouse(PLACES.home.w * TILE * big - 0.6, PLACES.home.d * TILE * big - 0.8, 2.6 + stage * 0.35, 0xfff4dc, stage === 3 ? 0xffd23a : 0xd8442e, 0x4a9ad8);
  homeModel.position.set(homeSpot.x, 0, homeSpot.z + (1 - big) * 1.6);
  scene.add(homeModel);
}

(function () {
  // Your neighbours' houses, each with its own colours and a name on the letterbox
  for (const one of NEIGHBOURS) {
    const house = makeHouse(3 * TILE - 0.8, 2 * TILE - 0.6, 2.4, 0xfff4dc, one.roof, one.shirt);
    house.position.set((one.house.i + 1.5) * TILE, 0, (one.house.k + 1) * TILE);
    scene.add(house);
    const sign = board(one.name, 1.5, 0.4, "#3a2412", "#fff4dc");
    sign.position.set((one.house.i + 1.5) * TILE + 1.9, 0.9, (one.house.k + 2) * TILE + 0.5);
    sign.rotation.x = -0.4;
    scene.add(sign);
    box(scene, paint(0x8a5a2e), 0.1, 0.8, 0.1, (one.house.i + 1.5) * TILE + 1.9, 0.4, (one.house.k + 2) * TILE + 0.48);
  }
  // Thistle's stall: a counter under a stripy awning, with crates of things to buy
  const shop = new THREE.Group();
  shop.position.set((PLACES.shop.i + 2) * TILE, 0, (PLACES.shop.k + 1) * TILE);
  box(shop, paint(0xb8824a), 7.2, 1, 1.2, 0, 0.5, 1.2);
  box(shop, paint(0x8a5a2e), 7.4, 0.12, 1.4, 0, 1.05, 1.2);
  for (let n = 0; n < 8; n++) box(shop, paint(n % 2 ? 0xffffff : 0x4aa84a), 0.92, 0.14, 3.4, -3.22 + n * 0.92, 3.1 - 0.001 * n, 0.6).rotation.x = 0.18;
  for (const x of [-3.5, 3.5]) {
    box(shop, paint(0x8a5a2e), 0.16, 3.4, 0.16, x, 1.7, 2.1);
    box(shop, paint(0x8a5a2e), 0.16, 3.4, 0.16, x, 1.7, -1.4);
  }
  box(shop, paint(0x9a6a3a), 7, 2.6, 0.2, 0, 1.3, -1.5);
  for (let n = 0; n < 5; n++) ball(shop, paint([0xe8243a, 0xff9a2a, 0xffd23a, 0x4a9ad8, 0xc87aff][n]), 0.22, 0.22, 0.22, -2.6 + n * 1.3, 1.3, 1.3);
  const shopSign = board("THISTLE'S", 3, 0.6, "#fff4dc", "#3a6a3a");
  shopSign.position.set(0, 3.6, 2.2);
  shop.add(shopSign);
  scene.add(shade(shop));
  // Beaver Builders: a log cabin
  const cabin = new THREE.Group();
  cabin.position.set((PLACES.cabin.i + 1.5) * TILE, 0, (PLACES.cabin.k + 1) * TILE);
  for (let n = 0; n < 6; n++) {
    const log = piece(cabin, new THREE.CylinderGeometry(0.24, 0.24, 5.4, 8), paint(n % 2 ? 0x9a6a3a : 0x8a5a2e), 0, 0.24 + n * 0.46, 1.5);
    log.rotation.z = Math.PI / 2;
  }
  box(cabin, paint(0x8a5a2e), 5.2, 2.8, 3, 0, 1.4, 0);
  piece(cabin, roofShape(3.8, 1.7, 5.8), paint(0x4a7a4a), 0, 2.8, 0);
  box(cabin, paint(0x5a3a1a), 1, 1.6, 0.1, 0, 0.8, 1.76);
  const cabinSign = board("BEAVER BUILDERS", 3.6, 0.5, "#fff4dc", "#5a3a1a");
  cabinSign.position.set(0, 2.5, 1.8);
  cabin.add(cabinSign);
  scene.add(shade(cabin));
  // The museum: white stone, with columns and wide steps
  const museum = new THREE.Group();
  museum.position.set((PLACES.museum.i + 3) * TILE, 0, (PLACES.museum.k + 1.5) * TILE);
  box(museum, paint(0xf4f0e8), 11, 3.6, 5, 0, 1.8, -0.3);
  box(museum, paint(0xd8d4c8), 11.6, 0.3, 6, 0, 0.15, 0);
  for (let n = 0; n < 6; n++) piece(museum, new THREE.CylinderGeometry(0.28, 0.3, 3.4, 10), paint(0xffffff), -4.6 + n * 1.84, 1.9, 2.4);
  box(museum, paint(0xf4f0e8), 11.4, 0.5, 5.6, 0, 3.85, 0);
  piece(museum, roofShape(5.8, 1.5, 11.6), paint(0x8a6a8a), 0, 4.1, 0);
  box(museum, paint(0x5a3a5a), 1.4, 2.2, 0.1, 0, 1.1, 2.22);
  const museumSign = board("MUSEUM", 2.6, 0.5, "#fff4dc", "#5a3a5a");
  museumSign.position.set(0, 3.2, 2.72);
  museum.add(museumSign);
  scene.add(shade(museum));
  // The plaza: a fountain with a big green clover on top, and a notice board
  const cx = (PLAZA.i0 + PLAZA.i1 + 1) / 2 * TILE;
  const cz = (PLAZA.k0 + PLAZA.k1 + 1) / 2 * TILE;
  const fountain = new THREE.Group();
  fountain.position.set(cx, 0, cz);
  piece(fountain, new THREE.CylinderGeometry(2.1, 2.3, 0.6, 16), paint(0xb8b8b0), 0, 0.3, 0);
  piece(fountain, new THREE.CylinderGeometry(1.85, 1.85, 0.1, 16), new THREE.MeshPhongMaterial({ color: 0x5ac8ff, shininess: 120 }), 0, 0.62, 0);
  piece(fountain, new THREE.CylinderGeometry(0.25, 0.4, 1.8, 8), paint(0xb8b8b0), 0, 1.2, 0);
  for (let n = 0; n < 4; n++) ball(fountain, paint(0x4ab84a), 0.42, 0.42, 0.14, Math.cos(n * 1.57 + 0.78) * 0.42, 2.5 + Math.sin(n * 1.57 + 0.78) * 0.42, 0);
  scene.add(shade(fountain));
  // Lamp posts along the paths. Their bulbs are kept in a list, so they can glow at night.
  for (const spot of [[13, 19], [20, 17], [25, 22], [34, 15], [44, 17], [30, 30], [47, 30], [52, 17], [6, 20], [30, 12]]) {
    // (Each stands just off the corner of its square, out of the way of the path)
    box(scene, paint(0x3a3a44), 0.14, 2.8, 0.14, mid(spot[0]) - 1.2, 1.4, mid(spot[1]) - 1.2).castShadow = true;
    lampBulbs.push(ball(scene, new THREE.MeshBasicMaterial({ color: 0xfff4c8 }), 0.24, 0.3, 0.24, mid(spot[0]) - 1.2, 2.95, mid(spot[1]) - 1.2));
  }
})();

// ===== 6. People and animals =====
// Everybody in Clover Cove is built the same way: a big round head, a small body, short arms
// and legs. What kind of animal they are decides their ears, nose and tail.
function makePerson(look) {
  const g = new THREE.Group();
  const fur = soft(look.fur);
  const face = soft(look.face);
  const shirt = soft(look.shirt);
  const dark = bright(0x2a2228);
  const body = new THREE.Group();
  g.add(body);
  ball(body, shirt, 0.34, 0.4, 0.3, 0, 0.72, 0);
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0);
  body.add(head);
  ball(head, fur, 0.5, 0.46, 0.46, 0, 0, 0);
  // Eyes, with a white shine
  for (const s of [-1, 1]) {
    ball(head, dark, 0.07, 0.1, 0.05, s * 0.19, 0.05, 0.42);
    ball(head, bright(0xffffff), 0.025, 0.03, 0.02, s * 0.2, 0.09, 0.46);
  }
  const animal = look.animal;
  if (animal === "human") {
    // Hair on top, and a little nose
    ball(head, soft(look.hair), 0.52, 0.34, 0.5, 0, 0.2, -0.04);
    ball(head, soft(look.hair), 0.3, 0.14, 0.1, 0, 0.36, 0.36);
    ball(head, face, 0.05, 0.05, 0.05, 0, -0.06, 0.46);
  } else {
    ball(head, face, 0.26, 0.2, 0.16, 0, -0.14, 0.36);                         // the muzzle
    ball(head, dark, 0.06, 0.045, 0.04, 0, -0.07, 0.5);                        // the nose
  }
  if (animal === "cat" || animal === "fox") {
    for (const s of [-1, 1]) {
      const ear = piece(head, new THREE.ConeGeometry(0.17, animal === "fox" ? 0.42 : 0.3, 4), fur, s * 0.3, 0.44, 0);
      ear.rotation.z = s * -0.25;
      piece(head, new THREE.ConeGeometry(0.09, 0.2, 4), animal === "fox" ? dark : face, s * 0.3, 0.42, 0.05).rotation.z = s * -0.25;
    }
  } else if (animal === "bear" || animal === "mouse" || animal === "beaver" || animal === "badger") {
    const big = animal === "mouse" ? 0.26 : 0.15;
    for (const s of [-1, 1]) {
      ball(head, fur, big, big, 0.07, s * 0.36, 0.38, -0.02);
      ball(head, face, big * 0.6, big * 0.6, 0.05, s * 0.36, 0.38, 0.03);
    }
  } else if (animal === "rabbit") {
    for (const s of [-1, 1]) {
      ball(head, fur, 0.11, 0.42, 0.08, s * 0.2, 0.72, -0.04).rotation.z = s * -0.12;
      ball(head, soft(0xffb8c8), 0.055, 0.3, 0.04, s * 0.2, 0.72, 0.02).rotation.z = s * -0.12;
    }
  } else if (animal === "frog") {
    // Eyes on top of the head, and a wide smile
    for (const s of [-1, 1]) {
      ball(head, fur, 0.17, 0.17, 0.17, s * 0.24, 0.42, 0.14);
      ball(head, dark, 0.07, 0.09, 0.05, s * 0.24, 0.45, 0.28);
    }
    box(head, dark, 0.36, 0.025, 0.02, 0, -0.2, 0.47);
  } else if (animal === "elephant") {
    for (const s of [-1, 1]) ball(head, fur, 0.3, 0.36, 0.06, s * 0.56, 0.02, -0.06);
    const trunk = piece(head, new THREE.CylinderGeometry(0.09, 0.06, 0.6, 8), fur, 0, -0.34, 0.46);
    trunk.rotation.x = -0.35;
  }
  if (animal === "badger") {
    // Two dark stripes over the head
    for (const s of [-1, 1]) ball(head, soft(0x2a2a30), 0.1, 0.3, 0.36, s * 0.2, 0.18, 0.08);
  }
  if (animal === "beaver") {
    box(head, bright(0xffffff), 0.12, 0.1, 0.03, 0, -0.26, 0.47);                 // two big front teeth
  }
  // Arms and legs swing from the shoulder and the hip
  const limbs = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.36, 0.95, 0);
    ball(arm, shirt, 0.1, 0.22, 0.1, 0, -0.16, 0);
    ball(arm, animal === "human" ? face : fur, 0.09, 0.09, 0.09, 0, -0.38, 0);
    body.add(arm);
    const leg = new THREE.Group();
    leg.position.set(s * 0.16, 0.42, 0);
    ball(leg, animal === "human" ? soft(0x4a5a8a) : fur, 0.12, 0.24, 0.12, 0, -0.2, 0);
    ball(leg, animal === "human" ? soft(0x8a4a2a) : fur, 0.13, 0.08, 0.18, 0, -0.38, 0.05);
    body.add(leg);
    limbs.push(arm, leg);
  }
  // Tails
  if (animal === "fox") ball(body, fur, 0.16, 0.16, 0.4, 0, 0.6, -0.45).rotation.x = 0.6;
  else if (animal === "cat") piece(body, new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), fur, 0, 0.75, -0.42).rotation.x = -0.9;
  else if (animal === "rabbit") ball(body, face, 0.13, 0.13, 0.13, 0, 0.55, -0.3);
  else if (animal === "beaver") ball(body, soft(0x4a3020), 0.2, 0.05, 0.4, 0, 0.4, -0.5);
  else if (animal === "mouse") piece(body, new THREE.CylinderGeometry(0.025, 0.025, 0.8, 5), soft(0xf4b8c0), 0, 0.5, -0.5).rotation.x = -1.2;
  return { group: shade(g), body: body, head: head, limbs: limbs, hand: limbs[2] };
}

// A sign that floats over somebody's head
function makeSign(text, colour) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const pen = c.getContext("2d");
  pen.font = "bold 46px sans-serif";
  pen.textAlign = "center";
  pen.lineWidth = 7;
  pen.strokeStyle = "#000";
  pen.strokeText(text, 32, 48);
  pen.fillStyle = colour;
  pen.fillText(text, 32, 48);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true });
}
const SIGNS = { want: makeSign("!", "#ffd23a"), new: makeSign("?", "#8fe8ff"), heart: makeSign("♥", "#ff7ab8") };

// ===== 7. Tools and small things =====
// The three tools, each a little model that sits in your hand
const toolModels = {};
(function () {
  const wood = paint(0x9a6a3a);
  const net = new THREE.Group();
  piece(net, new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), wood, 0, 0.4, 0);
  piece(net, new THREE.TorusGeometry(0.28, 0.03, 6, 14), paint(0xf4f4f4), 0, 1.3, 0);
  const mesh = piece(net, new THREE.SphereGeometry(0.28, 8, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }), 0, 1.3, 0);
  mesh.rotation.x = Math.PI / 2;
  const rod = new THREE.Group();
  piece(rod, new THREE.CylinderGeometry(0.02, 0.035, 1.9, 6), paint(0x4a8a5a), 0, 0.75, 0);
  ball(rod, paint(0xd8442e), 0.07, 0.07, 0.07, 0, 0.1, 0.06);
  const shovel = new THREE.Group();
  piece(shovel, new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), wood, 0, 0.4, 0);
  box(shovel, paint(0xb8c0c8), 0.3, 0.36, 0.05, 0, 1.05, 0);
  toolModels.net = net;
  toolModels.rod = rod;
  toolModels.shovel = shovel;
})();

// Bugs: a tiny body with two wings that flap. (All of them share these shapes, in different colours.)
const BUG_MAX = 14;
const bugBodies = many(new THREE.SphereGeometry(0.11, 7, 5), white(), BUG_MAX);
const bugWings = many(new THREE.CircleGeometry(0.16, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }), BUG_MAX * 2);
// Fish are only ever seen as dark shadows under the water
const FISH_MAX = 12;
const fishShadows = many(new THREE.CircleGeometry(0.5, 10), new THREE.MeshBasicMaterial({ color: 0x0f2f4a, transparent: true, opacity: 0.55 }), FISH_MAX);
// Things lying on the ground: fruit that has fallen, shells on the beach
const ITEM_MAX = 60;
const itemMesh = many(new THREE.SphereGeometry(0.22, 8, 6), white(), ITEM_MAX);
itemMesh.castShadow = true;
// Star cracks, where something is buried
const SPOT_MAX = 6;
const spotMesh = many(new THREE.CircleGeometry(0.34, 5), new THREE.MeshBasicMaterial({ color: 0x4a3a2a }), SPOT_MAX);
// The float on the end of your fishing line, and angry bees
const bobber = ball(scene, bright(0xff3a2a), 0.12, 0.12, 0.12, 0, -5, 0);
const beeMesh = many(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd23a }), 8);

// ===== 8. Inside your house =====
// The room is built far away from the village (500 metres east), so you never see both at once.
const ROOM = { x: 500, z: 0 };
let roomModel = null;
const WALLPAPERS = [0xfff0d8, 0xd8ecff, 0xffd8e4, 0xdcf4d0];
const FLOORS = [0xc89a5a, 0x9a6a3a, 0xe8dcc0, 0x8ab8d8];

function drawRoom(size, wallpaper, floorColour) {
  if (roomModel) scene.remove(roomModel);
  const g = new THREE.Group();
  g.position.set(ROOM.x, 0, ROOM.z);
  const wide = size * TILE * 0.5;
  box(g, paint(FLOORS[floorColour]), wide * 2, 0.2, wide * 2, wide, -0.1, wide).receiveShadow = true;
  const wall = paint(WALLPAPERS[wallpaper]);
  box(g, wall, wide * 2 + 0.4, 3, 0.2, wide, 1.5, -0.1);
  box(g, wall, 0.2, 3, wide * 2, -0.1, 1.5, wide);
  box(g, wall, 0.2, 3, wide * 2, wide * 2 + 0.1, 1.5, wide);
  box(g, paint(0x8a5a2e), wide * 2 + 0.4, 0.25, 0.26, wide, 0.12, -0.08);
  box(g, new THREE.MeshPhongMaterial({ color: 0xbfe8ff, emissive: 0x5a7a8a }), 1.6, 1.1, 0.1, wide * 0.5, 1.8, 0.02);
  box(g, new THREE.MeshPhongMaterial({ color: 0xbfe8ff, emissive: 0x5a7a8a }), 1.6, 1.1, 0.1, wide * 1.5, 1.8, 0.02);
  box(g, paint(0x4a9a4a), 1.4, 0.04, 0.8, wide, 0.02, wide * 2 - 0.5);        // the door mat
  g.traverse(function (part) { part.receiveShadow = true; });
  scene.add(g);
  roomModel = g;
}

// Furniture. Each shape is a few boxes and balls, about one square (1 metre) wide.
function makeFurniture(item) {
  const g = new THREE.Group();
  const main = paint(item.colour);
  const wood = paint(0x8a5a2e);
  const shape = item.shape;
  if (shape === "chair") {
    box(g, main, 0.6, 0.1, 0.6, 0, 0.45, 0);
    box(g, main, 0.6, 0.6, 0.1, 0, 0.8, -0.25);
    for (const x of [-0.24, 0.24]) for (const z of [-0.24, 0.24]) box(g, wood, 0.08, 0.45, 0.08, x, 0.22, z);
  } else if (shape === "table") {
    piece(g, new THREE.CylinderGeometry(0.5, 0.5, 0.08, 12), main, 0, 0.62, 0);
    piece(g, new THREE.CylinderGeometry(0.08, 0.2, 0.6, 8), wood, 0, 0.3, 0);
  } else if (shape === "bed") {
    box(g, wood, 0.9, 0.3, 1.5, 0, 0.2, 0);
    box(g, main, 0.86, 0.16, 1.1, 0, 0.42, 0.18);
    box(g, paint(0xffffff), 0.6, 0.14, 0.34, 0, 0.44, -0.52);
    box(g, wood, 0.9, 0.7, 0.1, 0, 0.45, -0.75);
  } else if (shape === "lamp") {
    piece(g, new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), wood, 0, 0.65, 0);
    piece(g, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10), wood, 0, 0.03, 0);
    piece(g, new THREE.CylinderGeometry(0.16, 0.28, 0.34, 10), new THREE.MeshBasicMaterial({ color: item.colour }), 0, 1.4, 0);
  } else if (shape === "plant") {
    piece(g, new THREE.CylinderGeometry(0.22, 0.16, 0.34, 8), paint(0xc8743a), 0, 0.17, 0);
    for (let n = 0; n < 4; n++) ball(g, main, 0.2, 0.34, 0.2, Math.cos(n * 1.57) * 0.14, 0.62, Math.sin(n * 1.57) * 0.14);
  } else if (shape === "rug") {
    piece(g, new THREE.CylinderGeometry(0.55, 0.55, 0.03, 16), main, 0, 0.02, 0);
    piece(g, new THREE.CylinderGeometry(0.34, 0.34, 0.035, 16), paint(0xffffff), 0, 0.022, 0);
  } else if (shape === "shelf") {
    box(g, main, 0.9, 1.6, 0.34, 0, 0.8, 0);
    for (let n = 0; n < 3; n++) for (let m = 0; m < 4; m++) box(g, paint([0xd8442e, 0x4a9ad8, 0xffd23a, 0x4aa84a][(n + m) % 4]), 0.14, 0.32, 0.2, -0.3 + m * 0.2, 0.36 + n * 0.5, 0.1);
  } else if (shape === "sofa") {
    box(g, main, 0.96, 0.34, 0.6, 0, 0.28, 0.05);
    box(g, main, 0.96, 0.5, 0.16, 0, 0.6, -0.24);
    for (const x of [-0.44, 0.44]) box(g, main, 0.14, 0.26, 0.6, x, 0.52, 0.05);
  } else if (shape === "tv") {
    box(g, wood, 0.8, 0.4, 0.4, 0, 0.2, 0);
    box(g, main, 0.7, 0.5, 0.36, 0, 0.66, 0);
    box(g, new THREE.MeshBasicMaterial({ color: 0x8fe8ff }), 0.5, 0.36, 0.02, -0.04, 0.66, 0.19);
  } else if (shape === "tank") {
    box(g, wood, 0.8, 0.5, 0.4, 0, 0.25, 0);
    box(g, new THREE.MeshPhongMaterial({ color: item.colour, transparent: true, opacity: 0.7 }), 0.74, 0.44, 0.36, 0, 0.72, 0);
    ball(g, bright(0xff9a2a), 0.07, 0.05, 0.03, 0.1, 0.72, 0);
  } else if (shape === "piano") {
    box(g, main, 0.96, 0.9, 0.4, 0, 0.45, -0.1);
    box(g, paint(0xffffff), 0.86, 0.05, 0.2, 0, 0.62, 0.2);
    box(g, main, 0.96, 0.08, 0.24, 0, 0.56, 0.2);
  } else if (shape === "teddy") {
    ball(g, main, 0.3, 0.34, 0.26, 0, 0.34, 0);
    ball(g, main, 0.24, 0.22, 0.22, 0, 0.82, 0);
    for (const s of [-1, 1]) ball(g, main, 0.09, 0.09, 0.05, s * 0.18, 1.02, 0);
    for (const s of [-1, 1]) ball(g, bright(0x2a2228), 0.03, 0.03, 0.02, s * 0.08, 0.86, 0.2);
  } else if (shape === "clock") {
    box(g, main, 0.44, 1.7, 0.3, 0, 0.85, 0);
    piece(g, new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14), paint(0xffffff), 0, 1.38, 0.16).rotation.x = Math.PI / 2;
    box(g, paint(0xffd23a), 0.06, 0.5, 0.04, 0, 0.6, 0.16);
  } else if (shape === "stove") {
    box(g, main, 0.8, 0.8, 0.6, 0, 0.4, 0);
    for (const x of [-0.2, 0.2]) piece(g, new THREE.CylinderGeometry(0.13, 0.13, 0.03, 10), paint(0x2a2a30), x, 0.82, 0);
    box(g, paint(0x2a2a30), 0.5, 0.36, 0.03, 0, 0.36, 0.31);
  } else if (shape === "globe") {
    piece(g, new THREE.CylinderGeometry(0.2, 0.24, 0.06, 10), wood, 0, 0.03, 0);
    piece(g, new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), wood, 0, 0.24, 0);
    ball(g, main, 0.28, 0.28, 0.28, 0, 0.66, 0);
    ball(g, paint(0x4aa84a), 0.14, 0.18, 0.1, 0.1, 0.72, 0.2);
  } else if (shape === "trophy") {
    box(g, wood, 0.4, 0.14, 0.4, 0, 0.07, 0);
    piece(g, new THREE.CylinderGeometry(0.05, 0.1, 0.3, 8), new THREE.MeshPhongMaterial({ color: item.colour, shininess: 100 }), 0, 0.29, 0);
    piece(g, new THREE.CylinderGeometry(0.22, 0.1, 0.34, 10), new THREE.MeshPhongMaterial({ color: item.colour, shininess: 100 }), 0, 0.6, 0);
  }
  return shade(g);
}
