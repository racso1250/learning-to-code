// Treetop Island: the scene.
// The island and the sea, the forest, the things you can pick up, the dinosaur models,
// and your treehouse, which is built from the design you chose.

// ===== 1. Setting up =====
const canvas = document.getElementById("game");
const testing = location.search.includes("test");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fd8f4, 60, 420);
const camera = new THREE.PerspectiveCamera(68, 1.5, 0.15, 1400);
camera.rotation.order = "YXZ";
// Add ?plain to the address to switch shadows off (if the game runs slowly)
const shadows = !location.search.includes("plain");
renderer.shadowMap.enabled = shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const dice = seeded(2718);
const helper = new THREE.Object3D();

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

const skyLight = new THREE.HemisphereLight(0xd8ecff, 0x4a6a3a, 0.62);
scene.add(skyLight);
const sunLight = new THREE.DirectionalLight(0xfff0d0, 0.75);
sunLight.castShadow = shadows;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -70;
sunLight.shadow.camera.right = sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 400;
sunLight.shadow.bias = -0.0008;
scene.add(sunLight, sunLight.target);

// ===== 2. Little helpers =====
function paint(colour, glowColour) {
  return new THREE.MeshPhongMaterial({ color: colour, emissive: glowColour || 0x000000, shininess: 10, flatShading: true });
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

// A box, in one line
function box(parent, material, w, h, d, x, y, z) {
  return piece(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}

// A ball squashed into an egg shape: rx wide, ry tall, rz long
const ballShape = new THREE.SphereGeometry(1, 12, 9);
function ball(parent, material, rx, ry, rz, x, y, z) {
  const mesh = piece(parent, ballShape, material, x, y, z);
  mesh.scale.set(rx, ry, rz);
  return mesh;
}

// Everything that should throw a shadow goes through here
function shade(thing) {
  thing.traverse(function (part) {
    if (part.isMesh && !part.material.transparent) part.castShadow = true;
  });
  return thing;
}

// A soft round glow (a picture of a fuzzy dot)
const glowDot = (function () {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const pen = c.getContext("2d");
  const fade = pen.createRadialGradient(32, 32, 2, 32, 32, 32);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(0.4, "rgba(255,255,255,0.4)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  pen.fillStyle = fade;
  pen.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

// ===== 3. The island and the sea =====
// How thick the forest is at a spot: 0 = no trees at all, 1 = a tree on every patch
function forestAt(x, z) {
  const here = { x: x, z: z };
  if (groundAt(x, z) < 1.3 || gap(here, HOME) < 17) return 0;
  for (const nest of NESTS) {
    if (gap(here, nest) < 6) return 0;
  }
  if (gap(here, MEADOW) < MEADOW.r * 0.85) return 0.05;
  if (bump(x, z, RIDGE, RIDGE.r) > 0.5) return 0.07;
  if (gap(here, LAKE) < LAKE.r + 10) return 0.25;
  return 0.5 + 0.2 * Math.sin(x * 0.04) * Math.cos(z * 0.05);
}

(function () {
  const shape = new THREE.PlaneGeometry(760, 760, 152, 152);
  shape.rotateX(-Math.PI / 2);
  const spots = shape.attributes.position;
  const colours = new Float32Array(spots.count * 3);
  const colour = new THREE.Color();
  const other = new THREE.Color();
  for (let i = 0; i < spots.count; i++) {
    const x = spots.getX(i);
    const z = spots.getZ(i);
    const y = groundAt(x, z);
    spots.setY(i, y);
    const thick = forestAt(x, z);
    if (y < -0.3) colour.setHex(0x3a7a8a);                                         // under the water
    else if (y < 1.2) colour.setHex(0xe8d8a0);                                     // sand
    else if (bump(x, z, RIDGE, RIDGE.r) > 0.5) colour.setHex(0x8a8478);            // bare rock
    else colour.setHex(0x6ab84a).lerp(other.setHex(0x2f6a34), clamp(thick * 1.8, 0, 1));   // grass, darker under the trees
    colour.multiplyScalar(0.92 + 0.16 * dice());
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  shape.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  shape.computeVertexNormals();
  const land = new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ vertexColors: true }));
  land.receiveShadow = true;
  scene.add(land);
})();

const sea = piece(scene, new THREE.PlaneGeometry(5000, 5000), new THREE.MeshPhongMaterial({ color: 0x2f9ac8, transparent: true, opacity: 0.8, shininess: 120, specular: 0xfff4d8 }), 0, 0, 0);
sea.rotation.x = -Math.PI / 2;

// The sun, the moon and the stars (game.js moves them round the sky)
const sunBall = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot, color: 0xfff0b0, fog: false, depthWrite: false }));
sunBall.scale.set(160, 160, 1);
const moonBall = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot, color: 0xd8e8ff, fog: false, depthWrite: false }));
moonBall.scale.set(90, 90, 1);
scene.add(sunBall, moonBall);
const stars = (function () {
  const spots = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    const around = dice() * Math.PI * 2;
    const up = 0.1 + dice() * 1.4;
    spots[i * 3] = Math.cos(around) * Math.cos(up) * 1100;
    spots[i * 3 + 1] = Math.sin(up) * 1100;
    spots[i * 3 + 2] = Math.sin(around) * Math.cos(up) * 1100;
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.BufferAttribute(spots, 3));
  const points = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  points.frustumCulled = false;
  scene.add(points);
  return points;
})();

// ===== 4. The forest =====
// Every tree: { x, z, y, r (how fat its trunk is), high, wide, tint, slot, gone }
const trees = [];
// To find the trees near a spot quickly, the island is cut into 8 metre squares,
// and each square keeps a list of the trees that stand in it.
const treeGrid = {};

function cellOf(x, z) {
  return Math.floor(x / 8) + "," + Math.floor(z / 8);
}

function treesNear(x, z) {
  const list = [];
  for (let dx = -8; dx <= 8; dx += 8) {
    for (let dz = -8; dz <= 8; dz += 8) {
      const cell = treeGrid[cellOf(x + dx, z + dz)];
      if (cell) {
        for (const tree of cell) {
          if (!tree.gone) list.push(tree);
        }
      }
    }
  }
  return list;
}

for (let x = -290; x < 290; x += 6.5) {
  for (let z = -290; z < 290; z += 6.5) {
    const tx = x + dice() * 5;
    const tz = z + dice() * 5;
    if (dice() > forestAt(tx, tz)) continue;
    const tree = { x: tx, z: tz, y: groundAt(tx, tz), r: 0.35 + dice() * 0.4, high: 9 + dice() * 9, wide: 2.6 + dice() * 1.8, slot: trees.length, gone: false, tint: [0x2a7a32, 0x35883a, 0x1f6a2a, 0x3f8a32, 0x2a6a3a][Math.floor(dice() * 5)] };
    trees.push(tree);
    const cell = cellOf(tx, tz);
    (treeGrid[cell] = treeGrid[cell] || []).push(tree);
  }
}

// All the trunks are one shape drawn many times, and so are the leaves. (That is what makes a big forest fast.)
const trunkShape = new THREE.CylinderGeometry(0.7, 1, 1, 7);
trunkShape.translate(0, 0.5, 0);
const trunkMesh = new THREE.InstancedMesh(trunkShape, paint(0x5a4030), trees.length);
const leafMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), trees.length * 2);
for (const mesh of [trunkMesh, leafMesh]) {
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  scene.add(mesh);
}

const treeTint = new THREE.Color();
function drawTree(tree) {
  const big = tree.gone ? 0.0001 : 1;
  helper.rotation.set(0, tree.x, 0);
  helper.position.set(tree.x, tree.y - 0.3, tree.z);
  helper.scale.set(tree.r * big, tree.high * big, tree.r * big);
  helper.updateMatrix();
  trunkMesh.setMatrixAt(tree.slot, helper.matrix);
  for (let n = 0; n < 2; n++) {
    helper.position.set(tree.x + (n ? tree.wide * 0.35 : 0), tree.y + tree.high * (n ? 0.82 : 1), tree.z + (n ? tree.wide * 0.2 : 0));
    helper.scale.set(tree.wide * (n ? 0.75 : 1) * big, tree.wide * (n ? 0.6 : 0.8) * big, tree.wide * (n ? 0.75 : 1) * big);
    helper.updateMatrix();
    leafMesh.setMatrixAt(tree.slot * 2 + n, helper.matrix);
    leafMesh.setColorAt(tree.slot * 2 + n, treeTint.setHex(tree.tint).multiplyScalar(n ? 0.85 : 1));
  }
  trunkMesh.instanceMatrix.needsUpdate = leafMesh.instanceMatrix.needsUpdate = true;
  if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
}
for (const tree of trees) drawTree(tree);

// Ferns on the forest floor (just for looks)
(function () {
  const list = [];
  for (let n = 0; n < 1500; n++) {
    const x = (dice() - 0.5) * 560;
    const z = (dice() - 0.5) * 560;
    if (forestAt(x, z) < 0.2) continue;
    list.push({ x: x, z: z, big: 0.5 + dice() * 0.7 });
  }
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x3f9a3a }), list.length);
  list.forEach(function (fern, n) {
    helper.rotation.set(0, fern.x, 0);
    helper.position.set(fern.x, groundAt(fern.x, fern.z) + fern.big * 0.2, fern.z);
    helper.scale.set(fern.big * 1.2, fern.big * 0.5, fern.big * 1.2);       // low and wide
    helper.updateMatrix();
    mesh.setMatrixAt(n, helper.matrix);
  });
  mesh.frustumCulled = false;
  scene.add(mesh);
})();

// ===== 5. Things to pick up =====
// finds.berry, finds.stick and so on: lists of { x, z, y, back }. "back" is the time it grows back
// (0 means it is there now).
const finds = {};

// How far from the middle of the lake you can wade, in each direction (the fish swim just inside that)
function wadeLine(angle) {
  for (let far = LAKE.r + 6; far > 4; far -= 0.5) {
    if (groundAt(LAKE.x + Math.cos(angle) * far, LAKE.z + Math.sin(angle) * far) < -1.3) return far;
  }
  return 4;
}

(function () {
  // Try random spots until one passes the test
  function scatter(type, test, nearHome) {
    finds[type] = [];
    let tries = 0;
    while (finds[type].length < FINDS[type].count && tries++ < 60000) {
      const close = finds[type].length < nearHome;      // the first few are always near your tree
      const x = close ? (dice() - 0.5) * 100 : (dice() - 0.5) * 520;
      const z = close ? (dice() - 0.5) * 100 : (dice() - 0.5) * 520;
      if (gap({ x: x, z: z }, HOME) < 19 || !test(x, z)) continue;
      if (treesNear(x, z).some(function (tree) { return Math.hypot(tree.x - x, tree.z - z) < tree.r + 1.2; })) continue;
      finds[type].push({ x: x, z: z, y: groundAt(x, z), back: 0 });
    }
  }
  scatter("berry", function (x, z) { return forestAt(x, z) > 0.2; }, 6);
  scatter("stick", function (x, z) { return forestAt(x, z) > 0.2; }, 7);
  scatter("stone", function (x, z) { const y = groundAt(x, z); return y > 0.4 && (dice() < 0.25 || y < 2.2 || bump(x, z, RIDGE, RIDGE.r) > 0.3); }, 6);
  // Vines hang from tree trunks
  finds.vine = [];
  const close = trees.filter(function (tree) { return gap(tree, HOME) < 50; });
  while (finds.vine.length < FINDS.vine.count) {
    const tree = finds.vine.length < 7 ? close[Math.floor(dice() * close.length)] : trees[Math.floor(dice() * trees.length)];
    const angle = dice() * 6.28;
    finds.vine.push({ x: tree.x + Math.cos(angle) * (tree.r + 0.3), z: tree.z + Math.sin(angle) * (tree.r + 0.3), y: tree.y, back: 0 });
  }
  // Fish swim round and round the lake
  finds.fish = [];
  for (let n = 0; n < FINDS.fish.count; n++) finds.fish.push({ x: 0, z: 0, y: -0.35, back: 0, angle: n * 0.7, speed: (n % 2 ? 1 : -1) * (0.05 + dice() * 0.05) });
  finds.egg = NESTS.map(function (nest) { return { x: nest.x, z: nest.z, y: groundAt(nest.x, nest.z) + 0.25, back: 0 }; });
  finds.tooth = [{ x: RIDGE.x + 6, z: RIDGE.z + 4, y: groundAt(RIDGE.x + 6, RIDGE.z + 4), back: 0 }];
})();

// What each kind of find looks like: its shape, its colour, how big it is, and how it is turned
const FIND_LOOKS = {
  berry: { shape: new THREE.SphereGeometry(0.16, 6, 5), colour: 0xe8243a, each: 5 },
  stick: { shape: new THREE.CylinderGeometry(0.06, 0.08, 1.3, 5), colour: 0x8a6238, each: 1 },
  stone: { shape: new THREE.DodecahedronGeometry(0.3, 0), colour: 0x9a9a9e, each: 1 },
  vine:  { shape: new THREE.CylinderGeometry(0.07, 0.05, 3.6, 5), colour: 0xa8e03a, each: 1 },
  fish:  { shape: new THREE.SphereGeometry(1, 8, 6), colour: 0xff8a3a, each: 1 },
  egg:   { shape: new THREE.SphereGeometry(1, 9, 7), colour: 0xf4ecd0, each: 1 },
  tooth: { shape: new THREE.ConeGeometry(0.28, 1.1, 6), colour: 0xfffbe8, each: 1 },
};
const findMeshes = {};
for (const type in FIND_LOOKS) {
  const look = FIND_LOOKS[type];
  const mesh = new THREE.InstancedMesh(look.shape, paint(look.colour, type === "tooth" ? 0x555540 : 0x000000), finds[type].length * look.each);
  mesh.frustumCulled = false;
  scene.add(mesh);
  findMeshes[type] = mesh;
}

// Put every find of one kind where it belongs (or shrink it to nothing if it has been taken)
function drawFinds(type, now) {
  const mesh = findMeshes[type];
  const each = FIND_LOOKS[type].each;
  finds[type].forEach(function (find, n) {
    const here = find.back <= now ? 1 : 0.0001;
    for (let m = 0; m < each; m++) {
      helper.rotation.set(0, 0, 0);
      helper.scale.set(here, here, here);
      helper.position.set(find.x, find.y, find.z);
      if (type === "berry") helper.position.set(find.x + Math.cos(m * 1.3 + n) * 0.75, find.y + 0.55 + (m % 3) * 0.3, find.z + Math.sin(m * 1.3 + n) * 0.75);
      else if (type === "stick") helper.rotation.set(0, n * 1.7, Math.PI / 2 - 0.05), helper.position.y += 0.1;
      else if (type === "stone") helper.rotation.set(n, n * 2, 0), helper.position.y += 0.15;
      else if (type === "vine") helper.position.y += 2.2;
      else if (type === "fish") helper.rotation.set(0, -find.angle + (find.speed > 0 ? 0 : Math.PI), 0), helper.scale.set(0.16 * here, 0.2 * here, 0.55 * here);
      else if (type === "egg") helper.scale.set(0.24 * here, 0.32 * here, 0.24 * here);
      else if (type === "tooth") helper.rotation.set(0.3, 0, 0.4), helper.position.y += 0.5;
      helper.updateMatrix();
      mesh.setMatrixAt(n * each + m, helper.matrix);
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
}

// The berry bushes themselves, and the raptors' nests, never go away
(function () {
  const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x2f8a3a }), finds.berry.length);
  finds.berry.forEach(function (find, n) {
    helper.rotation.set(0, n, 0);
    helper.position.set(find.x, find.y + 0.6, find.z);
    helper.scale.set(0.95, 0.85, 0.95);
    helper.updateMatrix();
    bushes.setMatrixAt(n, helper.matrix);
  });
  bushes.frustumCulled = false;
  bushes.castShadow = true;
  scene.add(bushes);
  for (const nest of NESTS) {
    const g = new THREE.Group();
    g.position.set(nest.x, groundAt(nest.x, nest.z), nest.z);
    for (let n = 0; n < 12; n++) {
      const twig = piece(g, new THREE.CylinderGeometry(0.09, 0.09, 1.3, 5), paint(n % 2 ? 0x7a5a32 : 0x9a7a4a), Math.cos(n * 0.52) * 1, 0.18, Math.sin(n * 0.52) * 1);
      twig.rotation.set(Math.PI / 2, 0, n * 0.52 + 0.3);
    }
    piece(g, new THREE.CylinderGeometry(0.95, 0.95, 0.1, 10), paint(0xc8b070), 0, 0.06, 0);
    scene.add(g);
  }
  // A few bones on Rex Ridge, so you know whose home it is
  for (let n = 0; n < 7; n++) {
    const x = RIDGE.x + Math.cos(n * 0.9) * (5 + n * 1.5);
    const z = RIDGE.z + Math.sin(n * 0.9) * (5 + n * 1.5);
    const bone = piece(scene, new THREE.CylinderGeometry(0.14, 0.14, 2 + n * 0.2, 6), paint(0xf0e8d0), x, groundAt(x, z) + 0.2, z);
    bone.rotation.set(Math.PI / 2, 0, n * 1.3);
  }
})();

// ===== 6. Dinosaurs =====
// There is ONE builder for every kind of dinosaur. It reads each kind's "body plan", size,
// colours and list of features from data.js. A horn here, a row of plates there...
// Every dinosaur is built with its nose pointing along "minus z" and its feet on the ground.

// A leg: it swings from the hip
function makeLeg(parent, material, long, thick, x, y, z) {
  const hip = new THREE.Group();
  hip.position.set(x, y, z);
  piece(hip, new THREE.CylinderGeometry(thick, thick * 0.7, long, 7), material, 0, -long / 2, 0);
  ball(hip, material, thick * 1.1, thick * 0.5, thick * 1.5, 0, -long + thick * 0.4, -thick * 0.5);
  parent.add(hip);
  return hip;
}

// A tail: a long cone that sways from where it joins the body
function makeTail(parent, material, long, thick, x, y, z) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  const cone = piece(root, new THREE.ConeGeometry(thick, long, 8), material, 0, 0, long / 2);
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
  const L = sp.size;
  const has = function (feat) { return sp.feats.includes(feat); };
  const g = new THREE.Group();
  const skin = paint(sp.a);
  const belly = paint(sp.b);
  const trim = paint(sp.c);
  const dark = paint(new THREE.Color(sp.a).multiplyScalar(0.65).getHex());
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
  for (const s of [-1, 1]) piece(head, ballShape, eye, s * hx * 0.82, hy0 + hy * 0.3, hz0 - hz * 0.2).scale.setScalar(hx * 0.2);
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
      legs.push(makeLeg(g, skin, front, thick, s * rx * 0.8, front, -rz * 0.55));
      legs.push(makeLeg(g, skin, hipH, thick * 1.05, s * rx * 0.8, hipH, rz * 0.55));
    }
  } else {
    const armLong = plan.arm * L * (has("longarms") ? 2.2 : 1);
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, hipH, thick, s * rx * 0.75, hipH, rz * 0.25));
      const arm = makeLeg(g, skin, armLong, thick * 0.4, s * rx * 0.8, hipH + ry * 0.05, -rz * 0.6);
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

// A little sign that floats over a dinosaur's head
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
const SIGNS = { hunt: makeSign("!", "#ff4a3a"), look: makeSign("?", "#ffd76a"), love: makeSign("♥", "#ff7ab8") };

// ===== 7. Your treehouse =====
// These sizes are used here (to build it) and in game.js (to stop you walking through its walls).
const DECK_R = 6.2;                                   // how far the round floor reaches from the middle of the tree
const TRUNK_R = 1.7;                                  // how fat the tree trunk is where it comes up through the floor
const HUT = { round: 3.6, square: 3.3, tall: 3.3 };   // how far the walls are from the middle
// Where things are, measured from the middle of the tree (x is east, z is south)
const SPOTS = {
  top: { x: DECK_R - 0.9, z: 0 },                     // the top of the way up
  foot: { x: DECK_R + 1.3, z: 0 },                    // the bottom of it
  slideTop: { x: -DECK_R + 0.9, z: 0 },
  slideFoot: { x: -16, z: 0 },
  hammock: { x: -1.87, z: -1.87 },
  bench: { x: 1.87, z: -1.87 },
  fire: { x: 4.5, z: 2.45 },
  nest: { x: -4.5, z: 2.45 },
  horn: { x: 0, z: -5.1 },
};

function makeTreehouse(design, built, egg) {
  const g = new THREE.Group();
  const moving = { flag: null, flames: [], swing: null, lamp: null, fireLight: null };
  g.userData = moving;
  const bark = paint(0x5a4030);
  const wood = paint(0x9a6a3a);
  const darkWood = paint(0x6a4a2a);
  const wall = paint(PAINTS[design.walls].hex);
  const top = paint(PAINTS[design.top].hex);
  const glass = new THREE.MeshPhongMaterial({ color: 0xbfe8ff, emissive: 0x2a4a5a, shininess: 100 });
  const shape = design.shape;
  const R = HUT[shape];
  const extras = design.extras || {};

  // ----- The giant tree -----
  piece(g, new THREE.CylinderGeometry(1.1, 1.9, 34, 12), bark, 0, 17, 0);
  for (let n = 0; n < 6; n++) {
    const root = piece(g, new THREE.ConeGeometry(0.8, 4.5, 6), bark, Math.cos(n * 1.05 + 0.5) * 2, 1, Math.sin(n * 1.05 + 0.5) * 2);
    root.rotation.set(Math.sin(n * 1.05 + 0.5) * 0.9, 0, -Math.cos(n * 1.05 + 0.5) * 0.9);
  }
  const leaf = [new THREE.MeshLambertMaterial({ color: 0x2f8a3a }), new THREE.MeshLambertMaterial({ color: 0x3f9a42 }), new THREE.MeshLambertMaterial({ color: 0x267a30 })];
  for (let n = 0; n < 9; n++) {
    const far = n ? 7.5 : 0;
    const blob = piece(g, new THREE.IcosahedronGeometry(1, 1), leaf[n % 3], Math.cos(n * 0.79) * far, n ? 27 + (n % 3) * 2.5 : 34, Math.sin(n * 0.79) * far);
    blob.scale.set(7.5, 5, 7.5);
    if (n) {
      const branch = piece(g, new THREE.CylinderGeometry(0.3, 0.55, 8, 6), bark, Math.cos(n * 0.79) * 3.4, 24.5, Math.sin(n * 0.79) * 3.4);
      branch.rotation.set(Math.sin(n * 0.79) * 1, 0, -Math.cos(n * 0.79) * 1);
    }
  }

  // ----- The floor, held up by beams, with a railing round it -----
  piece(g, new THREE.CylinderGeometry(DECK_R, DECK_R, 0.3, 24), wood, 0, DECK - 0.15, 0);
  piece(g, new THREE.CylinderGeometry(DECK_R + 0.08, DECK_R + 0.08, 0.16, 24), darkWood, 0, DECK - 0.32, 0);
  for (let n = 0; n < 6; n++) {
    const a = n * 1.047 + 0.52;
    const beam = piece(g, new THREE.CylinderGeometry(0.16, 0.16, 5.6, 6), darkWood, Math.cos(a) * 3, DECK - 2.4, Math.sin(a) * 3);
    beam.rotation.set(Math.sin(a) * 0.82, 0, -Math.cos(a) * 0.82);
  }
  // Is this direction a gap in the railing? (East is the way up. West is the slide, if you have one.)
  function open(a) {
    const turn = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.abs(turn) < 0.2 || (extras.slide && Math.abs(Math.abs(turn) - Math.PI) < 0.2);
  }
  const bunting = [0xd8442e, 0xffd23a, 0x4a9ad8, 0x4aa84a, 0x8a5ac8];
  for (let n = 0; n < 24; n++) {
    const a = n * Math.PI / 12 + Math.PI / 24;
    if (open(a)) continue;
    box(g, darkWood, 0.14, 1.05, 0.14, Math.cos(a) * (DECK_R - 0.15), DECK + 0.52, Math.sin(a) * (DECK_R - 0.15));
    const next = a + Math.PI / 12;
    if (open(next)) continue;
    const mid = a + Math.PI / 24;
    box(g, wood, 1.62, 0.1, 0.1, Math.cos(mid) * (DECK_R - 0.17), DECK + 1.02, Math.sin(mid) * (DECK_R - 0.17)).rotation.y = Math.PI / 2 - mid;
    if (extras.bunting) {
      for (const side of [-0.25, 0.25]) {
        const pennant = piece(g, new THREE.ConeGeometry(0.2, 0.42, 3), paint(bunting[(n * 2 + (side > 0 ? 1 : 0)) % 5]), Math.cos(mid + side * 0.26) * (DECK_R - 0.1), DECK + 0.76, Math.sin(mid + side * 0.26) * (DECK_R - 0.1));
        pennant.rotation.set(Math.PI, Math.PI / 2 - mid, 0);
        pennant.scale.z = 0.2;
      }
    }
  }

  // ----- The walls -----
  const high = 2.6;
  const panes = [];          // where the windows are: { x, z, turn }
  if (shape === "square") {
    box(g, wall, R * 2, high, 0.16, 0, DECK + high / 2, -R);
    for (const s of [-1, 1]) {
      box(g, wall, 0.16, high, R * 2, s * R, DECK + high / 2, 0);
      box(g, wall, R - 0.8, high, 0.16, s * (R + 0.8) / 2, DECK + high / 2, R);
      box(g, darkWood, 0.2, high + 0.1, 0.2, s * R, DECK + high / 2, R);
      box(g, darkWood, 0.2, high + 0.1, 0.2, s * R, DECK + high / 2, -R);
      panes.push({ x: s * R, z: 0.4, turn: Math.PI / 2 });
    }
    box(g, wall, 1.6, 0.5, 0.16, 0, DECK + high - 0.25, R);
    panes.push({ x: 0, z: -R, turn: 0 });
  } else {
    // A round wall is made of 14 flat planks. The one that faces south is left out: that is the doorway.
    for (let n = 1; n < 14; n++) {
      const a = Math.PI / 2 + n * Math.PI / 7;
      box(g, n % 2 ? wall : paint(new THREE.Color(PAINTS[design.walls].hex).multiplyScalar(0.9).getHex()), 2 * R * Math.tan(Math.PI / 14) + 0.04, high, 0.16, Math.cos(a) * R, DECK + high / 2, Math.sin(a) * R).rotation.y = Math.PI / 2 - a;
      if (n === 4 || n === 7 || n === 10) panes.push({ x: Math.cos(a) * R, z: Math.sin(a) * R, turn: Math.PI / 2 - a });
    }
    box(g, wall, 1.7, 0.5, 0.16, 0, DECK + high - 0.25, R - 0.05);
  }
  // The door frame, and the name of your treehouse on a sign above it
  for (const s of [-1, 1]) box(g, darkWood, 0.16, high - 0.45, 0.22, s * 0.86, DECK + (high - 0.45) / 2, R - 0.03);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const pen = c.getContext("2d");
  pen.fillStyle = "#4a3018";
  pen.fillRect(0, 0, 512, 96);
  pen.fillStyle = "#ffe9a0";
  pen.font = "bold 46px Georgia, serif";
  pen.textAlign = "center";
  pen.fillText(design.name || "My Treehouse", 256, 64, 490);
  piece(g, new THREE.PlaneGeometry(2.7, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }), 0, DECK + high - 0.22, R + 0.1);
  // Windows, with flower boxes under them if you chose those
  const blooms = [0xff5a8a, 0xffd23a, 0xffffff, 0xc87aff];
  for (const pane of panes) {
    const win = new THREE.Group();
    win.position.set(pane.x, DECK + 1.55, pane.z);
    win.rotation.y = pane.turn;
    box(win, glass, 0.9, 0.8, 0.22, 0, 0, 0);
    box(win, darkWood, 1.06, 0.1, 0.26, 0, 0.45, 0);
    box(win, darkWood, 1.06, 0.1, 0.26, 0, -0.45, 0);
    box(win, darkWood, 0.08, 0.8, 0.26, 0, 0, 0);
    if (extras.flowers) {
      for (const side of [-1, 1]) {
        box(win, darkWood, 1, 0.22, 0.3, 0, -0.62, side * 0.26);
        for (let n = 0; n < 4; n++) ball(win, paint(blooms[n]), 0.13, 0.13, 0.13, -0.36 + n * 0.24, -0.44, side * 0.26);
      }
    }
    g.add(win);
  }
  // A tall tower has a second room on top of the first
  let roofY = DECK + high;
  let roofR = shape === "square" ? R * 1.42 : R;
  if (shape === "tall") {
    piece(g, new THREE.CylinderGeometry(R + 0.5, R + 0.5, 0.2, 14), wood, 0, roofY + 0.1, 0);
    const upper = piece(g, new THREE.CylinderGeometry(2.7, 2.7, 2.2, 14, 1, true), new THREE.MeshPhongMaterial({ color: PAINTS[design.walls].hex, flatShading: true, side: THREE.DoubleSide }), 0, roofY + 1.3, 0);
    upper.castShadow = true;
    for (let n = 0; n < 4; n++) box(g, glass, 0.8, 0.8, 0.2, Math.cos(n * 1.57 + 0.78) * 2.66, roofY + 1.4, Math.sin(n * 1.57 + 0.78) * 2.66).rotation.y = Math.PI / 2 - (n * 1.57 + 0.78);
    roofY += 2.4;
    roofR = 2.7;
  }

  // ----- The roof -----
  const sides = shape === "square" ? 4 : 14;
  const turn = shape === "square" ? Math.PI / 4 : 0;
  let tip = roofY + 2.6;
  if (design.roof === "cone") {
    piece(g, new THREE.ConeGeometry(roofR + 0.9, 3, sides), top, 0, roofY + 1.5, 0).rotation.y = turn;
  } else if (design.roof === "thatch") {
    const under = paint(new THREE.Color(PAINTS[design.top].hex).multiplyScalar(0.78).getHex());
    piece(g, new THREE.ConeGeometry(roofR + 1.3, 1.7, sides), under, 0, roofY + 0.85, 0).rotation.y = turn;
    piece(g, new THREE.ConeGeometry(roofR + 0.5, 2.2, sides), top, 0, roofY + 1.8, 0).rotation.y = turn;
    piece(g, new THREE.ConeGeometry(roofR * 0.45, 1.6, sides), under, 0, roofY + 2.5, 0).rotation.y = turn;
  } else {
    piece(g, new THREE.CylinderGeometry(roofR + 0.7, roofR + 0.7, 0.3, sides), top, 0, roofY + 0.15, 0).rotation.y = turn;
    for (let n = 0; n < 14; n++) {
      const a = n * Math.PI / 7;
      const far = shape === "square" ? (R + 0.3) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) : roofR + 0.5;
      box(g, darkWood, 0.12, 0.9, 0.12, Math.cos(a) * far, roofY + 0.75, Math.sin(a) * far);
    }
    tip = roofY + 0.3;
  }

  // ----- The way up, on the east side -----
  const rope = paint(0xd8c890);
  if (design.way === "stairs") {
    const post = SPOTS.foot.x + 0.75;
    piece(g, new THREE.CylinderGeometry(0.22, 0.26, DECK + 1.2, 8), darkWood, post, (DECK + 1.2) / 2, 0);
    for (let n = 0; n < 20; n++) {
      const a = Math.PI + (n - 19) * 0.5;
      box(g, wood, 1.6, 0.12, 0.55, post + Math.cos(a) * 0.85, (n + 1) * DECK / 20 - 0.06, Math.sin(a) * 0.85).rotation.y = -a;
    }
  } else {
    const thin = design.way === "rope";
    for (let y = 0.3; y < DECK + 1; y += 0.42) {
      const x = SPOTS.foot.x - 0.2 - 1 * (y / DECK);
      if (y < DECK) box(g, wood, 0.1, thin ? 0.09 : 0.07, 0.95, x, y, 0).rotation.x = thin ? Math.sin(y * 9) * 0.08 : 0;
      for (const s of [-1, 1]) box(g, thin ? rope : darkWood, thin ? 0.06 : 0.1, 0.5, thin ? 0.06 : 0.1, x, y, s * 0.46).rotation.z = 0.125;
    }
  }

  // ----- Inside: your hammock and your workbench -----
  const bed = new THREE.Group();
  bed.position.set(SPOTS.hammock.x, DECK, SPOTS.hammock.z);
  bed.rotation.y = Math.PI / 4;
  box(bed, top, 2.1, 0.08, 0.85, 0, 0.62, 0);
  box(bed, paint(0xf4ecd8), 0.5, 0.14, 0.6, -0.7, 0.72, 0);
  for (const s of [-1, 1]) piece(bed, new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4), rope, s * 1.25, 1.1, 0).rotation.z = s * 0.5;
  g.add(bed);
  const bench = new THREE.Group();
  bench.position.set(SPOTS.bench.x, DECK, SPOTS.bench.z);
  bench.rotation.y = -Math.PI / 4;
  box(bench, wood, 1.5, 0.1, 0.7, 0, 0.85, 0);
  box(bench, darkWood, 1.3, 0.8, 0.5, 0, 0.4, 0);
  ball(bench, paint(0x9a9a9e), 0.16, 0.12, 0.16, -0.4, 0.98, 0);
  box(bench, paint(0x8a6238), 0.7, 0.06, 0.06, 0.25, 0.94, 0.1).rotation.y = 0.4;
  g.add(bench);

  // ----- The extras you chose -----
  if (extras.flag) {
    // A tall flagpole at the edge of the floor, on the north-east side
    const fx = Math.cos(-0.9) * (DECK_R - 0.2);
    const fz = Math.sin(-0.9) * (DECK_R - 0.2);
    piece(g, new THREE.CylinderGeometry(0.06, 0.08, 7, 6), darkWood, fx, DECK + 3.5, fz);
    moving.flag = new THREE.Group();
    moving.flag.position.set(fx, DECK + 6.4, fz);
    box(moving.flag, paint(PAINTS[(design.top + 3) % PAINTS.length].hex), 1.9, 1.1, 0.05, 0.98, 0, 0);
    g.add(moving.flag);
  }
  if (extras.lanterns) {
    for (let n = 0; n < 4; n++) {
      const a = n * Math.PI / 2 + Math.PI / 4;
      box(g, darkWood, 0.1, 2.1, 0.1, Math.cos(a) * (DECK_R - 0.2), DECK + 1.05, Math.sin(a) * (DECK_R - 0.2));
      ball(g, bright(0xffe9a0), 0.2, 0.26, 0.2, Math.cos(a) * (DECK_R - 0.2), DECK + 2.25, Math.sin(a) * (DECK_R - 0.2));
    }
    moving.lamp = new THREE.PointLight(0xffd890, 0, 26);
    moving.lamp.position.set(0, DECK + 2.4, R + 1.6);
    g.add(moving.lamp);
  }
  if (extras.slide) {
    const dx = -SPOTS.slideFoot.x - DECK_R;
    const long = Math.hypot(dx, DECK - 0.3);
    const slope = Math.atan2(DECK - 0.3, dx);
    const chute = new THREE.Group();
    chute.position.set(-DECK_R - dx / 2, DECK / 2 + 0.15, 0);
    chute.rotation.z = slope;
    box(chute, paint(0xffd23a), long, 0.12, 1.2, 0, 0, 0);
    for (const s of [-1, 1]) box(chute, paint(0xd8442e), long, 0.4, 0.1, 0, 0.2, s * 0.62);
    g.add(chute);
    box(g, darkWood, 0.2, DECK / 2, 0.2, -DECK_R - dx / 2, DECK / 4, 0.5);
    box(g, darkWood, 0.2, DECK / 2, 0.2, -DECK_R - dx / 2, DECK / 4, -0.5);
  }
  if (extras.swing) {
    moving.swing = new THREE.Group();
    moving.swing.position.set(-3.9, DECK - 0.3, 4.3);
    for (const s of [-1, 1]) piece(moving.swing, new THREE.CylinderGeometry(0.03, 0.03, DECK - 1.3, 4), rope, s * 0.4, -(DECK - 1.3) / 2, 0);
    box(moving.swing, wood, 1, 0.08, 0.4, 0, -(DECK - 1.3), 0);
    g.add(moving.swing);
  }

  // ----- The parts you have built since -----
  if (built.fire) {
    const fire = new THREE.Group();
    fire.position.set(SPOTS.fire.x, DECK, SPOTS.fire.z);
    piece(fire, new THREE.CylinderGeometry(0.75, 0.8, 0.1, 10), paint(0x6a6a70), 0, 0.05, 0);
    for (let n = 0; n < 7; n++) ball(fire, paint(0x8a8a90), 0.2, 0.16, 0.2, Math.cos(n * 0.9) * 0.6, 0.18, Math.sin(n * 0.9) * 0.6);
    for (let n = 0; n < 3; n++) moving.flames.push(piece(fire, new THREE.ConeGeometry(0.22 - n * 0.04, 0.8 - n * 0.15, 6), bright([0xff7a1a, 0xffb02a, 0xffe14a][n]), Math.cos(n * 2.1) * 0.12, 0.5, Math.sin(n * 2.1) * 0.12));
    moving.fireLight = new THREE.PointLight(0xff9a3a, 0, 18);
    moving.fireLight.position.y = 1;
    fire.add(moving.fireLight);
    g.add(fire);
  }
  if (built.lookout) {
    const up = DECK + 11;
    piece(g, new THREE.CylinderGeometry(2.3, 1.6, 0.3, 12), wood, 0, up, 0);
    for (let n = 0; n < 10; n++) box(g, darkWood, 0.1, 1, 0.1, Math.cos(n * 0.63) * 2.15, up + 0.6, Math.sin(n * 0.63) * 2.15);
    piece(g, new THREE.TorusGeometry(2.15, 0.06, 5, 20), wood, 0, up + 1.1, 0).rotation.x = Math.PI / 2;
    for (let y = tip; y < up; y += 0.45) box(g, wood, 0.7, 0.07, 0.1, 0, y, 1.55);
    const scope = piece(g, new THREE.CylinderGeometry(0.1, 0.14, 1.1, 8), paint(0xd8b03a), 1.6, up + 1.4, 1);
    scope.rotation.set(Math.PI / 2 - 0.2, 0, -0.9);
  }
  if (built.nest) {
    const nest = new THREE.Group();
    nest.position.set(SPOTS.nest.x, DECK, SPOTS.nest.z);
    box(nest, wood, 1.2, 0.5, 1.2, 0, 0.25, 0);
    piece(nest, new THREE.CylinderGeometry(0.5, 0.5, 0.12, 10), paint(0xe8d070), 0, 0.52, 0);
    if (egg) ball(nest, paint(0xf4ecd0), 0.24, 0.32, 0.24, 0, 0.8, 0);
    g.add(nest);
  }
  if (built.horn) {
    const horn = new THREE.Group();
    horn.position.set(SPOTS.horn.x, DECK, SPOTS.horn.z);
    box(horn, darkWood, 0.2, 1, 0.2, 0, 0.5, 0.5);
    box(horn, darkWood, 0.2, 0.6, 0.2, 0, 0.3, -0.5);
    const cone = piece(horn, new THREE.ConeGeometry(0.75, 2.6, 12, 1, true), new THREE.MeshPhongMaterial({ color: 0xf4ecd8, flatShading: true, side: THREE.DoubleSide }), 0, 1.15, -0.1);
    cone.rotation.x = Math.PI / 2 + 0.3;
    g.add(horn);
  }
  return shade(g);
}
