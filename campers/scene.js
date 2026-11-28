// Camp Fossil Bay: the scene.
// The ground, cliffs and long grass, the trees, the camp and its buildings, the things that
// block your way, and the models of the campers and the dinosaurs.

// ===== 1. Setting up =====
const canvas = document.getElementById("game");
const testing = location.search.includes("test");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa8dcf4, 45, 120);
const camera = new THREE.PerspectiveCamera(38, 1.5, 0.5, 400);
// Add ?plain to the address to switch shadows off (if the game runs slowly)
const shadows = !location.search.includes("plain");
renderer.shadowMap.enabled = shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const dice = seeded(65);
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
// The whole island floor is one big picture, painted square by square.
const groundCanvas = document.createElement("canvas");
groundCanvas.width = COLS * 16;
groundCanvas.height = ROWS * 16;
const groundTexture = new THREE.CanvasTexture(groundCanvas);

function paintGround() {
  const pen = groundCanvas.getContext("2d");
  const roll = seeded(5);
  const colours = { grass: ["#6ac052", "#64b84c"], tall: ["#4a9a3e", "#44923a"], path: ["#c8a878", "#c2a070"], sand: ["#f0e0a8", "#ecd89c"], water: ["#3a9ad8", "#3a9ad8"], rock: ["#8a8a88", "#84847e"], wood: ["#a8763e", "#a8763e"], floor: ["#b8b0a0", "#b8b0a0"] };
  for (let k = 0; k < ROWS; k++) {
    for (let i = 0; i < COLS; i++) {
      const type = MAP.ground[k][i];
      pen.fillStyle = colours[type][(i + k) % 2];
      pen.fillRect(i * 16, k * 16, 16, 16);
      if (type === "grass" && roll() < 0.3) {
        pen.fillStyle = "rgba(40, 110, 40, 0.35)";
        pen.fillRect(i * 16 + 3 + roll() * 9, k * 16 + 3 + roll() * 9, 2, 4);
      } else if (type === "wood") {
        pen.fillStyle = "#8a5a2e";
        for (let n = 0; n < 4; n++) pen.fillRect(i * 16, k * 16 + n * 4, 16, 1);
      } else if (type === "water") {
        pen.fillStyle = "rgba(255, 255, 255, 0.4)";
        const dry = function (di, dk) { const g = MAP.ground[clamp(k + dk, 0, ROWS - 1)][clamp(i + di, 0, COLS - 1)]; return g !== "water" && g !== "wood"; };
        if (dry(0, -1)) pen.fillRect(i * 16, k * 16, 16, 3);
        if (dry(-1, 0)) pen.fillRect(i * 16, k * 16, 3, 16);
        if (dry(1, 0)) pen.fillRect(i * 16 + 13, k * 16, 3, 16);
        if (dry(0, 1)) pen.fillRect(i * 16, k * 16 + 13, 16, 3);
      }
    }
  }
  groundTexture.needsUpdate = true;
}

(function () {
  paintGround();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WIDE, DEEP), new THREE.MeshLambertMaterial({ map: groundTexture }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(WIDE / 2, 0, DEEP / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  const sea = piece(scene, new THREE.PlaneGeometry(700, 300), new THREE.MeshLambertMaterial({ color: 0x3a9ad8 }), WIDE / 2, -0.05, DEEP + 100);
  sea.rotation.x = -Math.PI / 2;
  const woods = piece(scene, new THREE.PlaneGeometry(700, 400), new THREE.MeshLambertMaterial({ color: 0x3f7a3a }), WIDE / 2, -0.06, DEEP / 2 - 60);
  woods.rotation.x = -Math.PI / 2;
})();

// Cliffs: every "rock" square is a tall grey block. Long grass: a clump of blades on every "tall" square.
(function () {
  const cliffs = [];
  const clumps = [];
  for (let k = 0; k < ROWS; k++) {
    for (let i = 0; i < COLS; i++) {
      if (MAP.ground[k][i] === "rock") cliffs.push({ i: i, k: k });
      else if (MAP.ground[k][i] === "tall") {
        for (let n = 0; n < 4; n++) clumps.push({ x: mid(i) + (dice() - 0.5) * 1.7, z: mid(k) + (dice() - 0.5) * 1.7, big: 0.7 + dice() * 0.6 });
      }
    }
  }
  const cliffMesh = many(new THREE.BoxGeometry(TILE, 1, TILE), new THREE.MeshLambertMaterial({ color: 0xffffff }), cliffs.length);
  cliffs.forEach(function (cliff, n) {
    const high = 3 + ((cliff.i * 7 + cliff.k * 13) % 5) * 0.35;
    putOne(cliffMesh, n, mid(cliff.i), high / 2, mid(cliff.k), 1, high, 1, 0, [0x8a8a88, 0x7e7e7a, 0x96948e][(cliff.i + cliff.k * 3) % 3]);
  });
  cliffMesh.castShadow = cliffMesh.receiveShadow = true;
  const blade = new THREE.ConeGeometry(0.34, 1.5, 4);
  blade.translate(0, 0.75, 0);
  const grassMesh = many(blade, new THREE.MeshLambertMaterial({ color: 0xffffff }), clumps.length);
  clumps.forEach(function (clump, n) {
    putOne(grassMesh, n, clump.x, 0, clump.z, clump.big, clump.big, clump.big, n, [0x4a9a3e, 0x5aa84a, 0x3f8a36][n % 3]);
  });
})();

// ===== 4. Trees and rocks =====
(function () {
  const trees = [];
  const rocks = [];
  for (const key in MAP.things) {
    const thing = MAP.things[key];
    const at = key.split(",").map(Number);
    if (thing.type === "tree" || thing.type === "pine") trees.push({ x: mid(at[0]), z: mid(at[1]), pine: thing.type === "pine", tall: 0.85 + dice() * 0.4 });
    else if (thing.type === "rock") rocks.push({ x: mid(at[0]), z: mid(at[1]) });
  }
  const trunkShape = new THREE.CylinderGeometry(0.22, 0.32, 1, 7);
  trunkShape.translate(0, 0.5, 0);
  const coneShape = new THREE.ConeGeometry(1, 1, 8);
  coneShape.translate(0, 0.5, 0);
  const white = function () { return new THREE.MeshLambertMaterial({ color: 0xffffff }); };
  const trunkMesh = many(trunkShape, white(), trees.length);
  const leafMesh = many(new THREE.IcosahedronGeometry(1, 1), white(), trees.length * 3);
  const pineMesh = many(coneShape, white(), trees.length * 2);
  trunkMesh.castShadow = leafMesh.castShadow = pineMesh.castShadow = true;
  let leaves = 0;
  let cones = 0;
  trees.forEach(function (tree, n) {
    const t = tree.tall;
    putOne(trunkMesh, n, tree.x, 0, tree.z, 1, (tree.pine ? 1.4 : 1.8) * t, 1, 0, tree.pine ? 0x5a4030 : 0x6a4a2a);
    if (tree.pine) {
      putOne(pineMesh, cones++, tree.x, 1 * t, tree.z, 1.5 * t, 2.6 * t, 1.5 * t, 0, 0x2f7a3a);
      putOne(pineMesh, cones++, tree.x, 2.6 * t, tree.z, 1.05 * t, 2 * t, 1.05 * t, 0, 0x2a6a32);
    } else {
      for (let m = 0; m < 3; m++) putOne(leafMesh, leaves++, tree.x + [0, -0.55, 0.55][m] * t, (m ? 2.4 : 3) * t, tree.z + [0, 0.25, -0.2][m] * t, [1.15, 0.9, 0.9][m] * t, [1, 0.8, 0.8][m] * t, [1.15, 0.9, 0.9][m] * t, n, [0x3fa84a, 0x349a40, 0x4ab85a][(n + m) % 3]);
    }
  });
  leafMesh.count = leaves;
  pineMesh.count = cones;
  const rockMesh = many(new THREE.DodecahedronGeometry(0.85, 0), new THREE.MeshLambertMaterial({ color: 0x9a9aa0 }), rocks.length);
  rockMesh.castShadow = true;
  rocks.forEach(function (rock, n) { putOne(rockMesh, n, rock.x, 0.42, rock.z, 1, 0.75, 1, n); });
})();

// ===== 5. The camp, and everything built on the island =====
// A pointed roof: a triangle (as wide as "span" and as tall as "high"), stretched out to be "long"
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

// A wooden hut that fills a block of squares (i0, k0 is its top left corner)
function hut(i0, k0, wide, deep, high, wallColour, roofColour, label) {
  const g = new THREE.Group();
  const w = wide * TILE - 0.5;
  const d = deep * TILE - 0.5;
  g.position.set((i0 + wide / 2) * TILE, 0, (k0 + deep / 2) * TILE);
  box(g, paint(wallColour), w, high, d, 0, high / 2, 0);
  piece(g, roofShape(d + 0.8, d * 0.45, w + 0.6), paint(roofColour), 0, high, 0);
  box(g, paint(0x5a3a1a), 1, 1.6, 0.12, 0, 0.8, d / 2 + 0.02);
  for (const s of [-1, 1]) box(g, new THREE.MeshPhongMaterial({ color: 0xbfe8ff, emissive: 0x3a3a2a }), 0.8, 0.7, 0.1, s * w * 0.32, high * 0.6, d / 2 + 0.02);
  if (label) {
    const sign = board(label, Math.min(w - 0.4, 3.4), 0.5, "#fff4dc", "#5a3a1a");
    sign.position.set(0, high - 0.25, d / 2 + 0.08);
    g.add(sign);
  }
  scene.add(shade(g));
  return g;
}

const fireFlames = [];        // the flames of the campfires (they flicker)
const built = {};             // models that change during the game: the gate, the bridge, the ferry...
(function () {
  const wood = paint(0x9a6a3a);
  const dark = paint(0x6a4a2a);
  hut(5, 21, 3, 2, 2.4, 0xb8824a, 0x4a8a4a, "CABIN 1");
  hut(16, 21, 3, 2, 2.4, 0xb8824a, 0xd8442e, "CABIN 2");
  hut(5, 33, 3, 2, 2.4, 0xb8824a, 0x4a6ad8, "CABIN 3");
  hut(16, 33, 3, 2, 2.4, 0xb8824a, 0xffb02a, "CABIN 4");
  hut(9, 13, 6, 4, 3.2, 0xc89a5a, 0x8a5a2e, "MESS HALL");
  hut(12, 43, 3, 2, 2.2, 0x6a9ab8, 0x3a5a7a, "KAYAKS");
  hut(95, 20, 6, 4, 3.4, 0xb8b8b0, 0x5a6a5a, "RANGER STATION");
  // The stable: an open shed with straw
  const stable = new THREE.Group();
  stable.position.set(20.5 * TILE, 0, 17 * TILE);
  for (const x of [-2.6, 2.6]) for (const z of [-1.6, 1.6]) box(stable, dark, 0.2, 2.4, 0.2, x, 1.2, z);
  piece(stable, roofShape(4.2, 1.2, 6), paint(0xc8a04a), 0, 2.4, 0);
  box(stable, paint(0xe8d070), 5, 0.14, 3, 0, 0.07, 0);
  scene.add(shade(stable));
  // Kayaks beside the lake
  for (let n = 0; n < 3; n++) ball(scene, paint([0xd8442e, 0xffd23a, 0x4a9ad8][n]), 0.4, 0.25, 1.6, 22 + n * 1.1, 0.25, 92 + n * 0.4).castShadow = true;
  // The zipline tower, with a cable running away over the trees
  const tower = new THREE.Group();
  tower.position.set(20 * TILE, 0, 39.5 * TILE);
  for (const x of [-1.4, 1.4]) for (const z of [-0.8, 0.8]) box(tower, dark, 0.22, 7, 0.22, x, 3.5, z);
  box(tower, wood, 3.4, 0.25, 2.2, 0, 7, 0);
  for (let y = 0.5; y < 7; y += 0.5) box(tower, wood, 0.8, 0.08, 0.1, 0, y, 0.95);
  const cable = piece(tower, new THREE.CylinderGeometry(0.03, 0.03, 30, 4), paint(0x3a3a44), 12, 5.2, -4);
  cable.rotation.set(0.3, 0, Math.PI / 2 - 0.25);
  scene.add(shade(tower));
  // The treehouse
  const tree = new THREE.Group();
  tree.position.set(5.5 * TILE, 0, 9 * TILE);
  piece(tree, new THREE.CylinderGeometry(0.7, 1, 6, 9), paint(0x6a4a2a), 0, 3, 0);
  box(tree, wood, 5, 0.25, 3.4, 0, 3.6, 0);
  box(tree, paint(0xc89a5a), 3.4, 2, 2.4, 0, 4.8, -0.2);
  piece(tree, roofShape(3.2, 1.2, 4), paint(0x4a8a4a), 0, 5.8, -0.2);
  for (let m = 0; m < 4; m++) ball(tree, new THREE.MeshLambertMaterial({ color: [0x3fa84a, 0x349a40][m % 2] }), 2.6, 1.8, 2.6, Math.cos(m * 1.6) * 2, 8, Math.sin(m * 1.6) * 2);
  for (let y = 0.4; y < 3.6; y += 0.45) box(tree, wood, 0.7, 0.08, 0.1, 0, y, 1.75);
  scene.add(shade(tree));
  // The camp gate, over the road out
  const arch = new THREE.Group();
  arch.position.set(22.5 * TILE, 0, 29.5 * TILE);
  for (const s of [-1, 1]) piece(arch, new THREE.CylinderGeometry(0.3, 0.4, 5, 8), dark, 0, 2.5, s * 3.4);
  box(arch, wood, 0.5, 1.3, 7.6, 0, 5.2, 0);
  const name = board("CAMP FOSSIL BAY", 7, 1, "#fff4a8", "#5a3a1a");
  name.position.set(-0.27, 5.2, 0);
  name.rotation.y = -Math.PI / 2;
  arch.add(name);
  scene.add(shade(arch));
  // Campfires: a ring of stones, crossed logs, and a flame. You are safe at a campfire, and it saves the game.
  for (const fire of FIRES) {
    const g = new THREE.Group();
    g.position.set(mid(fire.i), 0, mid(fire.k));
    for (let n = 0; n < 8; n++) ball(g, paint(0x8a8a90), 0.2, 0.16, 0.2, Math.cos(n * 0.785) * 0.7, 0.12, Math.sin(n * 0.785) * 0.7);
    for (let n = 0; n < 3; n++) piece(g, new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark, 0, 0.2, 0).rotation.set(Math.PI / 2, 0, n * 1.05);
    for (let n = 0; n < 3; n++) fireFlames.push(piece(g, new THREE.ConeGeometry(0.28 - n * 0.07, 0.9 - n * 0.2, 6), bright([0xff7a1a, 0xffb02a, 0xffe14a][n]), 0, 0.55 + n * 0.06, 0));
    for (let n = 0; n < 4; n++) piece(g, new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8), wood, Math.cos(n * 1.57 + 0.5) * 1.9, 0.2, Math.sin(n * 1.57 + 0.5) * 1.9);
    scene.add(shade(g));
  }
  // The drawbridge. It starts tipped up on the west bank, and falls flat across the river.
  built.bridge = new THREE.Group();
  built.bridge.position.set(42.6 * TILE, 0.2, 29.5 * TILE);
  box(built.bridge, wood, 10.5, 0.25, 5.6, 5.25, 0, 0);
  for (const s of [-1, 1]) box(built.bridge, dark, 10.5, 0.7, 0.15, 5.25, 0.45, s * 2.7);
  built.bridge.rotation.z = 1.25;
  scene.add(shade(built.bridge));
  // The big electric gate: two doors that slide apart, between tall posts, with a light on top
  built.gate = [];
  for (const s of [-1, 1]) {
    piece(scene, new THREE.BoxGeometry(1.2, 6.5, 1.2), paint(0x4a4a54), 67 * TILE, 3.25, (28.5 + s * 1.9) * TILE).castShadow = true;
    const door = box(scene, paint(0x6a7a88), 0.5, 5, 3.2, 67 * TILE, 2.5, 28.5 * TILE + s * 1.6);
    door.castShadow = true;
    for (let n = 0; n < 4; n++) box(door, bright(n % 2 ? 0xffd23a : 0x2a2a30), 0.52, 0.5, 3.2, 0, -1.6 + n * 1.05, 0);
    built.gate.push({ mesh: door, shut: 28.5 * TILE + s * 1.6, side: s });
  }
  built.gateLight = ball(scene, bright(0xff3a2a), 0.4, 0.4, 0.4, 67 * TILE, 7, 28.5 * TILE);
  // The radio tower: four thin legs leaning together, with a dish and a light on top
  const radio = new THREE.Group();
  radio.position.set(mid(RADIO.i), 0, mid(RADIO.k));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) piece(radio, new THREE.CylinderGeometry(0.07, 0.1, 15, 5), paint(0xd8442e), sx * 0.6, 7.5, sz * 0.6).rotation.set(sz * 0.05, 0, sx * -0.05);
  for (let y = 2; y < 15; y += 2.5) box(radio, paint(0xf4f4f4), 1.3 - y * 0.05, 0.08, 1.3 - y * 0.05, 0, y, 0);
  built.dish = piece(radio, new THREE.SphereGeometry(1.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshPhongMaterial({ color: 0xe8ecf0, side: THREE.DoubleSide, flatShading: true }), 0, 13.5, 0.4);
  built.dish.rotation.x = -Math.PI / 2 - 0.3;
  built.radioLight = ball(radio, bright(0x5a5a5a), 0.3, 0.3, 0.3, 0, 15.3, 0);
  scene.add(shade(radio));
  // The pier, and the ferry that comes for you at the very end (it starts far out at sea)
  for (let k = PIER.k0; k <= PIER.k1; k += 2) {
    for (const s of [-1, 1]) piece(scene, new THREE.CylinderGeometry(0.2, 0.2, 5, 6), dark, mid(PIER.i) + s * 3.1, -1, mid(k));
  }
  box(scene, wood, 6.2, 0.3, (PIER.k1 - PIER.k0 + 1) * TILE, mid(PIER.i), 0.1, (PIER.k0 + PIER.k1 + 1) / 2 * TILE).receiveShadow = true;
  built.ferry = new THREE.Group();
  box(built.ferry, paint(0xf4f4f4), 7, 2.6, 18, 0, 1, 0);
  box(built.ferry, paint(0x2a4a6a), 7.1, 0.8, 18.1, 0, 0.2, 0);
  box(built.ferry, paint(0xd8442e), 5, 2.2, 8, 0, 3.3, -1);
  piece(built.ferry, new THREE.CylinderGeometry(0.7, 0.7, 2.6, 8), paint(0x2a2a30), 0, 5.4, 1);
  built.ferry.position.set(mid(PIER.i) + 8, -0.4, DEEP + 150);
  scene.add(shade(built.ferry));
})();

// The model for each thing you do something to. (game.js hides or changes them as you deal with them.)
function makeObject(object) {
  const g = new THREE.Group();
  g.position.set(mid(object.i), 0, mid(object.k));
  const wood = paint(0x8a5a2e);
  if (object.type === "log" && object.id === "rocks") {
    for (let n = 0; n < 4; n++) piece(g, new THREE.DodecahedronGeometry(0.8 + (n % 2) * 0.3, 0), paint([0x8a8a90, 0x7a7a80][n % 2]), (n % 2) * 0.5 - 0.2, 0.6 + (n > 1 ? 0.9 : 0), (n - 1.5) * 0.45);
  } else if (object.type === "log") {
    // A whole fallen tree, across the road
    const trunk = piece(g, new THREE.CylinderGeometry(0.6, 0.75, 7, 9), wood, 0, 0.65, 0);
    trunk.rotation.x = Math.PI / 2;
    for (let n = 0; n < 4; n++) ball(g, new THREE.MeshLambertMaterial({ color: 0x3fa84a }), 1, 0.8, 1, (n % 2 ? 0.7 : -0.7), 1, -3.4 + (n > 1 ? 0.9 : 0));
    piece(g, new THREE.CylinderGeometry(0.12, 0.12, 1.6, 5), wood, 0.7, 1.2, 1.4).rotation.z = -0.8;
  } else if (object.type === "barricade") {
    // A tangle of branches and old planks
    for (let n = 0; n < 12; n++) {
      const stick = piece(g, new THREE.CylinderGeometry(0.1, 0.13, 3.2 + (n % 3), 5), paint(n % 3 ? 0x8a5a2e : 0x6a4a2a), (n % 3 - 1) * 0.3, 0.6 + (n % 4) * 0.5, -2.6 + n * 0.48);
      stick.rotation.set(Math.PI / 2 + (n % 5 - 2) * 0.3, 0, (n % 4 - 1.5) * 0.5);
    }
  } else if (object.type === "climb") {
    // A rope hanging down, with knots, and a flag so you can spot it
    piece(g, new THREE.CylinderGeometry(0.05, 0.05, 4.5, 5), paint(0xd8c890), 0, 2.25, 0);
    for (let y = 0.6; y < 4.5; y += 0.8) ball(g, paint(0xc8b070), 0.1, 0.1, 0.1, 0, y, 0);
    box(g, bright(0xff7a2a), 0.7, 0.45, 0.04, 0.36, 4.3, 0);
  } else if (object.type === "fusebox") {
    box(g, paint(0x6a7a88), 0.9, 1.3, 0.5, 0, 1.25, 0);
    box(g, paint(0x4a4a54), 0.14, 1.2, 0.14, 0, 0.6, 0);
    g.userData.light = ball(g, bright(0xff3a2a), 0.12, 0.12, 0.12, 0, 1.6, 0.26);
    box(g, bright(0xffd23a), 0.5, 0.5, 0.02, 0, 1.15, 0.26);
  } else if (object.type === "crate") {
    box(g, wood, 1, 0.8, 1, 0, 0.4, 0);
    box(g, paint(0x6a4a2a), 1.06, 0.12, 1.06, 0, 0.82, 0);
    box(g, bright({ flare: 0xff3a2a, fuse: 0xffd23a, key: 0x8fe8ff }[object.has]), 0.5, 0.3, 0.02, 0, 0.42, 0.51);
  } else if (object.type === "door") {
    box(g, bright(0xffd23a), 0.5, 0.5, 0.06, 0.9, 1.5, -1.1);       // a big padlock on the mess hall door
    box(g, paint(0x6a6a70), 0.3, 0.3, 0.06, 0.9, 1.9, -1.1);
  }
  scene.add(shade(g));
  return g;
}

// The red fan on the ground that shows what a raptor can see
function makeCone(far, wide) {
  const fan = new THREE.Mesh(new THREE.CircleGeometry(far, 16, Math.PI / 2 - wide, wide * 2), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.22, depthWrite: false }));
  fan.rotation.x = -Math.PI / 2;
  const turner = new THREE.Group();
  turner.add(fan);
  scene.add(turner);
  return turner;
}

// ===== 6. Campers =====
// Every camper is built the same way: a big round head, a small body, and short arms and legs.
// (This builder can make animals too, but in this game everybody is a person.)
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
const SIGNS = { hunt: makeSign("!", "#ff4a3a"), look: makeSign("?", "#ffd76a"), sleep: makeSign("Zz", "#8fd8ff"), help: makeSign("!", "#8fe8ff"), calm: makeSign("♥", "#ff7ab8") };

// ===== 7. Dinosaurs =====
// One builder makes every kind of dinosaur, from its "body plan", size, colours and features in data.js.
// Every dinosaur is built with its nose pointing along "minus z" and its feet on the ground.

// Smooth skin for living things. (paint() makes flat, chunky sides, which suits buildings better.)
function hide(colour) {
  return new THREE.MeshPhongMaterial({ color: colour, shininess: 22 });
}

// A tapering tube from one point to another. (y is up and z is front-to-back, measured from the hip.)
function tube(parent, material, y0, z0, y1, z1, r0, r1) {
  const mesh = piece(parent, new THREE.CylinderGeometry(r0, r1, Math.hypot(y1 - y0, z1 - z0), 8), material, 0, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.rotation.x = Math.atan2(z0 - z1, y0 - y1);
  return mesh;
}

// A leg: it swings from the hip. It has a fat thigh, a thinner shin, and a foot with claws.
// "bent" legs are for dinosaurs that walk on two legs: the knee points forward and the ankle
// points back, like a bird's.
function makeLeg(parent, material, long, thick, x, y, z, claws, bent) {
  const hip = new THREE.Group();
  hip.position.set(x, y, z);
  if (bent) {
    ball(hip, material, thick * 1.45, thick * 1.5, thick * 1.7, 0, -long * 0.06, -long * 0.03);
    tube(hip, material, 0, 0, -long * 0.44, -long * 0.17, thick * 1.35, thick * 0.85);
    tube(hip, material, -long * 0.42, -long * 0.17, -long * 0.8, long * 0.1, thick * 0.85, thick * 0.5);
    tube(hip, material, -long * 0.78, long * 0.1, -long + thick * 0.3, -thick * 0.2, thick * 0.5, thick * 0.55);
  } else {
    ball(hip, material, thick * 1.3, long * 0.36, thick * 1.6, 0, -long * 0.26, 0);
    piece(hip, new THREE.CylinderGeometry(thick * 0.8, thick * 0.55, long * 0.62, 8), material, 0, -long * 0.67, 0);
  }
  ball(hip, material, thick * 1, thick * 0.42, thick * 1.5, 0, -long + thick * 0.38, -thick * 0.6);
  if (claws) {
    const toes = piece(hip, new THREE.ConeGeometry(thick * 0.85, thick * 1.2, 3), claws, 0, -long + thick * 0.22, -thick * 2);
    toes.rotation.x = -Math.PI / 2;
    toes.scale.z = 0.3;
  }
  parent.add(hip);
  return hip;
}

// A tail: thick where it joins the body, thinning to a point. It sways from the root.
function makeTail(parent, material, long, thick, x, y, z) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  ball(root, material, thick, thick, thick, 0, 0, 0);
  tube(root, material, 0, 0, 0, long * 0.5, thick, thick * 0.5).rotation.x = -Math.PI / 2;
  const cone = piece(root, new THREE.ConeGeometry(thick * 0.5, long * 0.5, 8), material, 0, 0, long * 0.75);
  cone.rotation.x = Math.PI / 2;
  parent.add(root);
  return root;
}

// The nine body plans. Every number is a fraction of the dinosaur's length.
//   quad = walks on four legs. body = half its width, height and length. hip = how high its hips are.
//   neck = how long its neck is, and "up" = how steeply it rises. head = half its width, height and length.
const PLANS = {
  T: { quad: false, body: [0.105, 0.125, 0.24], hip: 0.31, neck: 0.1,  up: 0.5,   head: [0.075, 0.075, 0.13], jaw: true, tail: 0.5,  leg: 0.045, arm: 0.07 },
  R: { quad: false, body: [0.075, 0.085, 0.2],  hip: 0.34, neck: 0.15, up: 0.8,   head: [0.05, 0.05, 0.11],   jaw: true, tail: 0.5,  leg: 0.03,  arm: 0.13 },
  O: { quad: false, body: [0.075, 0.085, 0.19], hip: 0.38, neck: 0.24, up: 1.05,  head: [0.035, 0.03, 0.065],            tail: 0.42, leg: 0.028, arm: 0.12 },
  H: { quad: false, body: [0.11, 0.125, 0.25],  hip: 0.3,  neck: 0.15, up: 0.65,  head: [0.055, 0.055, 0.11],            tail: 0.45, leg: 0.045, arm: 0.17 },
  P: { quad: false, body: [0.095, 0.105, 0.22], hip: 0.33, neck: 0.11, up: 0.75,  head: [0.07, 0.065, 0.09],             tail: 0.48, leg: 0.04,  arm: 0.1 },
  S: { quad: true,  body: [0.085, 0.095, 0.16], hip: 0.2,  neck: 0.34, up: 0.35,  head: [0.03, 0.027, 0.048],            tail: 0.4,  leg: 0.03 },
  C: { quad: true,  body: [0.17, 0.16, 0.3],    hip: 0.25, neck: 0.03, up: 0,     head: [0.11, 0.1, 0.16],               tail: 0.24, leg: 0.05 },
  G: { quad: true,  body: [0.15, 0.185, 0.3],   hip: 0.27, neck: 0.1,  up: -0.45, head: [0.045, 0.042, 0.09],            tail: 0.36, leg: 0.045 },
  A: { quad: true,  body: [0.22, 0.12, 0.33],   hip: 0.17, neck: 0.03, up: 0,     head: [0.085, 0.065, 0.1],             tail: 0.3,  leg: 0.05 },
};

function makeDino(kind) {
  const sp = SPECIES[kind];
  const plan = PLANS[sp.plan];
  const L = sp.size * BIG;
  const has = function (feat) { return sp.feats.includes(feat); };
  const g = new THREE.Group();
  const skin = hide(sp.a);
  const belly = hide(sp.b);
  const trim = hide(sp.c);
  const dark = hide(new THREE.Color(sp.a).multiplyScalar(0.62).getHex());
  const horn = paint(0xf4ecd8);
  const eye = bright(0xfff4a0);
  const legs = [];
  let jaw = null;
  const cone = function (parent, material, wide, long, x, y, z) {
    return piece(parent, new THREE.ConeGeometry(wide, long, 5), material, x, y, z);
  };

  // ----- The body and the tail -----
  const rx = plan.body[0] * L;
  const ry = plan.body[1] * L;
  const rz = plan.body[2] * L;
  const hipH = plan.hip * L;
  const topAt = function (z) { return hipH + ry * Math.sqrt(Math.max(0, 1 - z * z / (rz * rz))); };
  ball(g, skin, rx, ry, rz, 0, hipH, 0);
  ball(g, belly, rx * 0.85, ry * 0.8, rz * 0.85, 0, hipH - ry * 0.25, 0);
  // A darker back, big shoulders at the front, and big hips at the back
  ball(g, dark, rx * 0.9, ry * 0.6, rz * 0.93, 0, hipH + ry * 0.5, 0);
  ball(g, skin, rx * 0.97, ry * 0.9, rz * 0.45, 0, hipH + ry * 0.04, -rz * 0.5);
  ball(g, skin, rx * 1.04, ry * 0.98, rz * 0.45, 0, hipH, rz * (plan.quad ? 0.5 : 0.25));
  const tailLong = plan.tail * L * (has("whip") ? 1.35 : 1);
  const tail = makeTail(g, skin, tailLong, ry * 0.7, 0, hipH, rz * 0.8);

  // ----- The neck and the head (they nod together, from where the neck joins the body) -----
  const head = new THREE.Group();
  head.position.set(0, hipH + ry * 0.4, -rz * 0.8);
  const up = has("tall") ? 1.1 : has("low") ? 0.3 : plan.up;
  const nl = (plan.neck + (has("longneck") ? 0.1 : 0)) * L;
  const little = has("smallhead") ? 0.6 : 1;
  let hx = plan.head[0] * L * little;
  let hy = plan.head[1] * L * little;
  let hz = plan.head[2] * L * little;
  if (has("snout")) {
    // A long thin snout, like a crocodile's
    hz *= 1.55;
    hy *= 0.8;
    hx *= 0.8;
  }
  const neck = piece(head, new THREE.CylinderGeometry(Math.max(hy * 0.75, 0.02 * L), ry * 0.5, nl, 7), skin, 0, Math.sin(up) * nl / 2, -Math.cos(up) * nl / 2);
  neck.rotation.x = up - Math.PI / 2;
  const hy0 = Math.sin(up) * nl + hy * 0.3;      // the middle of the head: how high...
  const hz0 = -Math.cos(up) * nl - hz * 0.55;    // ...and how far forward
  ball(head, skin, hx, hy, hz, 0, hy0, hz0);
  // Eyes, each with a dark pupil, a tiny white shine, and a brow above it. And two nostrils.
  const iris = has("redeyes") ? bright(0xff2a1a) : eye;
  const pupil = bright(0x1a1a1a);
  for (const s of [-1, 1]) {
    piece(head, ballShape, iris, s * hx * 0.82, hy0 + hy * 0.3, hz0 - hz * 0.2).scale.setScalar(hx * 0.22);
    piece(head, ballShape, pupil, s * hx * 0.97, hy0 + hy * 0.3, hz0 - hz * 0.26).scale.setScalar(hx * 0.11);
    piece(head, ballShape, bright(0xffffff), s * hx * 1.03, hy0 + hy * 0.38, hz0 - hz * 0.3).scale.setScalar(hx * 0.045);
    ball(head, dark, hx * 0.2, hy * 0.14, hz * 0.3, s * hx * 0.72, hy0 + hy * 0.6, hz0 - hz * 0.2);
    piece(head, ballShape, pupil, s * hx * 0.3, hy0 + hy * 0.42, hz0 - hz * 0.9).scale.setScalar(hx * 0.07);
  }
  if (plan.jaw) {
    // Hunters get a long strong snout, and the inside of the mouth is dark red
    ball(head, skin, hx * 0.82, hy * 0.72, hz * 0.7, 0, hy0 - hy * 0.04, hz0 - hz * 0.5);
    ball(head, bright(0x6a1418), hx * 0.66, hy * 0.2, hz * 0.75, 0, hy0 - hy * 0.42, hz0 - hz * 0.25);
  }
  ball(head, skin, Math.max(hy * 0.9, 0.028 * L), ry * 0.5, ry * 0.5, 0, 0, 0);       // a smooth join where the neck meets the body
  // Stripes across the back. (Not on the ones with armour or plates, which have enough going on.)
  if (has("stripes") || "TROHP".includes(sp.plan)) {
    const band = has("stripes") ? trim : dark;
    for (let n = 0; n < 5; n++) ball(g, band, rx * 1.02, ry * 0.72, rz * 0.055, 0, hipH + ry * 0.32, -rz * 0.62 + n * rz * 0.31);
    for (let n = 0; n < 3; n++) ball(tail, band, ry * (0.62 - n * 0.14), ry * (0.62 - n * 0.14), 0.012 * L, 0, 0.012 * L, tailLong * (0.16 + n * 0.17));
  }
  if (has("hump")) ball(g, trim, 0.03 * L, 0.11 * L, 0.06 * L, 0, hipH + ry + 0.04 * L, rz * 0.3);
  if (plan.jaw && sp.diet !== "plants") {
    // Meat-eaters get a jaw that opens, and teeth
    jaw = new THREE.Group();
    jaw.position.set(0, hy0 - hy * 0.3, hz0 + hz * 0.35);
    ball(jaw, belly, hx * 0.85, hy * 0.3, hz * 0.8, 0, -hy * 0.12, -hz * 0.6);
    head.add(jaw);
    for (let n = 0; n < 5; n++) {
      for (const s of [-1, 1]) cone(head, paint(0xffffff), hx * 0.1, hy * 0.4, s * hx * 0.62, hy0 - hy * 0.6, hz0 - hz * 0.1 - n * hz * 0.17).rotation.x = Math.PI;
    }
  } else if (sp.plan !== "S") {
    ball(head, belly, hx * 0.6, hy * 0.45, hz * 0.4, 0, hy0 - hy * 0.25, hz0 - hz * 0.8);   // a beak
  }
  g.add(head);

  // ----- Legs (and arms) -----
  const thick = plan.leg * L;
  if (plan.quad) {
    const front = hipH + (has("tall") ? ry * 0.5 : 0);
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, front, thick, s * rx * 0.8, front, -rz * 0.55, horn));
      legs.push(makeLeg(g, skin, hipH, thick * 1.05, s * rx * 0.8, hipH, rz * 0.55, horn));
    }
  } else {
    const armLong = plan.arm * L * (has("longarms") ? 2.2 : 1);
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, hipH, thick, s * rx * 0.75, hipH, rz * 0.25, horn, true));
      const arm = makeLeg(g, skin, armLong, thick * 0.4, s * rx * 0.8, hipH + ry * 0.05, -rz * 0.6, horn);
      legs.push(arm);
      if (has("longarms")) cone(arm, horn, thick * 0.3, armLong * 0.5, 0, -armLong * 1.1, -thick).rotation.x = Math.PI;
      if (has("thumbs")) cone(arm, horn, thick * 0.25, armLong * 0.3, 0, -armLong * 0.9, -thick * 0.8).rotation.x = -1.2;
      if (has("feathers") || has("wings")) piece(arm, new THREE.BoxGeometry(0.012 * L, armLong * (has("wings") ? 1.1 : 0.7), 0.1 * L * (has("wings") ? 1.6 : 1)), trim, s * thick * 0.5, -armLong * 0.5, 0.05 * L);
    }
  }

  // ----- Features on the back -----
  if (has("sail")) {
    ball(g, trim, 0.025 * L, 0.17 * L, rz * 0.9, 0, hipH + ry + 0.09 * L, 0);
    for (let n = 0; n < 6; n++) piece(g, new THREE.BoxGeometry(0.035 * L, 0.3 * L * (1 - Math.abs(n - 2.5) * 0.2), 0.012 * L), dark, 0, hipH + ry + 0.08 * L, -rz * 0.6 + n * rz * 0.24);
  }
  if (has("ridge")) ball(g, trim, 0.02 * L, 0.06 * L, rz * 0.9, 0, hipH + ry + 0.025 * L, 0);
  if (has("plates") || has("smallplates")) {
    const count = has("plates") ? 9 : 5;
    for (let n = 0; n < count; n++) {
      const t = has("plates") ? n / 8 * 2 - 1 : n / 4 - 1;
      const big = (has("plates") ? 1 : 0.6) * (1 - Math.abs(t) * 0.45);
      const plate = piece(g, new THREE.ConeGeometry(0.055 * L * big, 0.14 * L * big, 4), trim, (n % 2 ? 0.012 : -0.012) * L, topAt(t * rz * 0.8) + 0.05 * L * big, t * rz * 0.8);
      plate.scale.x = 0.25;
    }
    for (let n = 0; n < 3; n++) piece(tail, new THREE.ConeGeometry(0.03 * L, 0.07 * L, 4), trim, 0, 0.06 * L, tailLong * (0.15 + n * 0.15)).scale.x = 0.25;
  }
  if (has("spines") || has("backspikes")) {
    const from = has("backspikes") ? -0.7 : 0;
    for (let n = 0; n < 6; n++) {
      const z = rz * (from + n * (0.8 - from) / 5);
      for (const s of [-1, 1]) cone(g, horn, 0.016 * L, (has("spines") ? 0.15 : 0.09) * L, s * rx * 0.4, topAt(z) + 0.04 * L, z).rotation.z = s * -0.5;
    }
  }
  if (has("neckspines")) {
    for (let n = 1; n < 7; n++) {
      for (const s of [-1, 1]) cone(head, trim, 0.01 * L, 0.17 * L * (1 - n * 0.06), s * hy * 0.3, Math.sin(up) * nl * n / 7 + 0.09 * L, -Math.cos(up) * nl * n / 7);
    }
  }
  if (has("armour")) {
    ball(g, dark, rx * 0.96, ry * 0.6, rz * 0.93, 0, hipH + ry * 0.45, 0);
    for (let n = 0; n < 6; n++) {
      for (const s of [-1, 1]) ball(g, trim, 0.022 * L, 0.016 * L, 0.022 * L, s * rx * 0.4, topAt(-rz * 0.6 + n * rz * 0.24) + 0.01 * L, -rz * 0.6 + n * rz * 0.24);
    }
  }
  if (has("sidespikes")) {
    for (let n = 0; n < 6; n++) {
      for (const s of [-1, 1]) cone(g, horn, 0.018 * L, 0.09 * L, s * rx, hipH + ry * 0.15, -rz * 0.65 + n * rz * 0.26).rotation.z = s * -1.3;
    }
  }
  if (has("shoulder")) {
    for (const s of [-1, 1]) cone(g, horn, 0.02 * L, 0.17 * L, s * rx * 0.95, hipH + ry * 0.35, -rz * 0.55).rotation.z = s * -1;
  }
  if (has("fluff")) {
    const fuzz = paint(0xf8faff);
    for (let n = 0; n < 7; n++) ball(g, fuzz, rx * 0.6, 0.03 * L, rz * 0.2, 0, topAt(-rz * 0.7 + n * rz * 0.23) + 0.005 * L, -rz * 0.7 + n * rz * 0.23);
    ball(head, fuzz, hx * 0.75, hy * 0.5, hz * 0.6, 0, hy0 + hy * 0.6, hz0 + hz * 0.3);
  }
  if (has("feathers")) {
    piece(tail, new THREE.BoxGeometry(0.13 * L, 0.012 * L, 0.16 * L), trim, 0, 0, tailLong * 0.88);
    for (let n = 0; n < 3; n++) cone(head, trim, hx * 0.14, hy * 0.7, 0, hy0 + hy * 1.1, hz0 + hz * (0.1 + n * 0.25)).rotation.x = 0.6;
  }
  if (has("quills")) {
    for (let n = 0; n < 6; n++) cone(tail, trim, 0.008 * L, 0.12 * L, 0, 0.07 * L, tailLong * (0.08 + n * 0.08));
  }

  // ----- Features on the head -----
  if (has("frill") || has("bigfrill")) {
    const wide = hx * (has("bigfrill") ? 2 : 1.5);
    const fy = hy0 + hy * (has("bigfrill") ? 1.3 : 0.95);
    const fz = hz0 + hz * 0.8;
    const disc = piece(head, new THREE.CylinderGeometry(wide, wide, 0.014 * L, 12), has("bigfrill") ? trim : belly, 0, fy, fz);
    disc.rotation.x = Math.PI / 2 - 0.5;
    if (has("frillspikes")) {
      for (let n = 0; n < 6; n++) {
        const a = (n - 2.5) * 0.42;
        cone(head, horn, hx * 0.1, hz * 0.6, Math.sin(a) * wide, fy + Math.cos(a) * wide * 0.85, fz + 0.03 * L).rotation.z = -a;
      }
    }
    if (has("frillhooks")) {
      for (let n = 0; n < 7; n++) ball(head, trim, hx * 0.13, hx * 0.2, hx * 0.2, (n - 3) * wide * 0.28, fy + wide * 0.8 - Math.abs(n - 3) * wide * 0.08, fz - 0.01 * L);
    }
    if (has("devilhorns")) {
      for (const s of [-1, 1]) cone(head, trim, hx * 0.12, hz * 1.2, s * wide * 0.5, fy + wide * 1.1, fz + 0.02 * L).rotation.z = s * -0.45;
    }
  }
  if (has("horns3")) {
    for (const s of [-1, 1]) cone(head, horn, hx * 0.17, hz * 1.3, s * hx * 0.5, hy0 + hy * 0.9, hz0 - hz * 0.55).rotation.x = -1.1;
    cone(head, horn, hx * 0.15, hz * 0.5, 0, hy0 + hy * 0.5, hz0 - hz * 0.95).rotation.x = -0.8;
  }
  if (has("nosehorn")) cone(head, horn, hx * 0.17, hz * 0.8, 0, hy0 + hy * 0.75, hz0 - hz * 0.7).rotation.x = -0.4;
  if (has("hook")) cone(head, horn, hx * 0.16, hz * 0.75, 0, hy0 + hy * 0.5, hz0 - hz * 0.95).rotation.x = -1.9;
  if (has("boss")) ball(head, horn, hx * 0.45, hy * 0.35, hz * 0.4, 0, hy0 + hy * 0.6, hz0 - hz * 0.6);
  if (has("browhorns")) {
    for (const s of [-1, 1]) cone(head, horn, hx * 0.2, hy * 0.95, s * hx * 0.55, hy0 + hy * 1.05, hz0 - hz * 0.05).rotation.z = s * -0.5;
  }
  if (has("browhornsbig")) {
    for (const s of [-1, 1]) cone(head, horn, hx * 0.14, hz * 0.95, s * hx * 0.5, hy0 + hy * 0.7, hz0 - hz * 0.55).rotation.x = -1.4;
  }
  if (has("brows")) {
    for (const s of [-1, 1]) cone(head, trim, hx * 0.16, hy * 0.5, s * hx * 0.6, hy0 + hy * 0.95, hz0 - hz * 0.2);
  }
  if (has("crest1")) ball(head, trim, 0.012 * L, hy * 0.6, hz * 0.7, 0, hy0 + hy * 0.95, hz0 - hz * 0.1);
  if (has("crest2")) {
    for (const s of [-1, 1]) ball(head, trim, 0.008 * L, hy * 0.65, hz * 0.6, s * hx * 0.4, hy0 + hy * 0.95, hz0 - hz * 0.1);
  }
  if (has("fan")) ball(head, trim, hx * 1.05, hy * 0.75, 0.012 * L, 0, hy0 + hy * 1.1, hz0 + hz * 0.15);
  if (has("tube")) piece(head, new THREE.CylinderGeometry(hy * 0.2, hy * 0.3, hz * 2, 6), trim, 0, hy0 + hy * 1.1, hz0 + hz * 0.8).rotation.x = 1.05;
  if (has("helmet")) ball(head, trim, 0.012 * L, hy * 0.85, hz * 0.6, 0, hy0 + hy * 1.0, hz0 + hz * 0.05);
  if (has("hatchet")) {
    ball(head, trim, 0.012 * L, hy * 0.8, hz * 0.4, 0, hy0 + hy * 1.05, hz0 - hz * 0.2);
    cone(head, trim, hy * 0.15, hz * 0.9, 0, hy0 + hy * 0.9, hz0 + hz * 0.6).rotation.x = 1.3;
  }
  if (has("unicorn")) cone(head, trim, hx * 0.15, hz * 1.2, 0, hy0 + hy * 1.3, hz0 - hz * 0.3).rotation.x = -0.5;
  if (has("nosebump")) ball(head, skin, hx * 0.6, hy * 0.5, hz * 0.35, 0, hy0 + hy * 0.55, hz0 - hz * 0.6);
  if (has("bump")) ball(head, skin, hx * 0.65, hy * 0.6, hx * 0.65, 0, hy0 + hy * 0.8, hz0);
  if (has("dome")) ball(head, trim, hx * 0.95, hy * 0.75, hz * 0.7, 0, hy0 + hy * 0.6, hz0 + hz * 0.1);
  if (has("knobs") || has("spiky")) {
    for (let n = 0; n < 6; n++) {
      const a = (n - 2.5) * 0.5;
      cone(head, horn, hx * 0.12, hy * (has("spiky") ? 1.3 : 0.45), Math.sin(a) * hx, hy0 + hy * 0.5 + Math.cos(a) * hy * 0.4, hz0 + hz * 0.85).rotation.x = 1.1;
    }
  }

  // ----- Features on the tail -----
  if (has("club")) ball(tail, dark, 0.045 * L, 0.034 * L, 0.055 * L, 0, 0, tailLong * 0.97);
  if (has("thagomizer")) {
    for (const s of [-1, 1]) {
      for (const far of [0.8, 0.92]) cone(tail, horn, 0.013 * L, 0.11 * L, s * 0.03 * L, 0.02 * L, tailLong * far).rotation.z = s * -1.1;
    }
  }

  shade(g);
  return { group: g, legs: legs, tail: tail, head: head, jaw: jaw };
}

