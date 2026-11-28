// Fossil Bay: Wild Again. The scene.
// The island and the sea, the forest, the ruins of the old park, and the models of every
// creature, your boat and your ship.

// ===== 1. Setting up =====
const canvas = document.getElementById("game");
const testing = location.search.includes("test");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fd8f4, 70, 520);
const camera = new THREE.PerspectiveCamera(68, 1.5, 0.15, 1400);
camera.rotation.order = "YXZ";
// Add ?plain to the address to switch shadows off (if the game runs slowly)
const shadows = !location.search.includes("plain");
renderer.shadowMap.enabled = shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const dice = seeded(1993);
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
  if (groundAt(x, z) < 1.3 || gap(here, CENTRE) < 27 || gap(here, DOCK) < 14) return 0;
  if (nearLine(x, z, ROAD) < 5 || nearLine(x, z, TRAIL) < 4) return 0;
  for (const tower of TOWERS) {
    if (gap(here, tower) < 6) return 0;
  }
  if (gap(here, ROCK) < 70) return gap(here, ROCK) < 34 || (x > 396 && z > -30) ? 0 : 0.3;
  if (gap(here, PLAINS) < PLAINS.r * 0.85) return 0.05;
  if (bump(x, z, CLIFFS, CLIFFS.r) > 0.55) return 0.04;
  if (gap(here, LAKE) < LAKE.r + 8) return 0.2;
  return 0.5 + 0.2 * Math.sin(x * 0.04) * Math.cos(z * 0.05);
}

(function () {
  const shape = new THREE.PlaneGeometry(1000, 900, 200, 180);
  shape.rotateX(-Math.PI / 2);
  shape.translate(70, 0, 40);
  const spots = shape.attributes.position;
  const colours = new Float32Array(spots.count * 3);
  const colour = new THREE.Color();
  const other = new THREE.Color();
  for (let i = 0; i < spots.count; i++) {
    const x = spots.getX(i);
    const z = spots.getZ(i);
    const y = groundAt(x, z);
    spots.setY(i, y);
    if (y < -0.3) colour.setHex(0x3a7a8a);                                         // under the water
    else if (y < 1.2) colour.setHex(0xe8d8a0);                                     // sand
    else if (nearLine(x, z, ROAD) < 4 || nearLine(x, z, TRAIL) < 3) colour.setHex(0xa88a5a);   // the old road
    else if (bump(x, z, CLIFFS, CLIFFS.r) > 0.55) colour.setHex(0x8a8478);         // bare rock
    else colour.setHex(0x6ab84a).lerp(other.setHex(0x2f6a34), clamp(forestAt(x, z) * 1.8, 0, 1));
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

const sea = piece(scene, new THREE.PlaneGeometry(6000, 6000), new THREE.MeshPhongMaterial({ color: 0x2f9ac8, transparent: true, opacity: 0.82, shininess: 120, specular: 0xfff4d8 }), 0, 0, 0);
sea.rotation.x = -Math.PI / 2;
const sunBall = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot, color: 0xfff0b0, fog: false, depthWrite: false }));
sunBall.scale.set(170, 170, 1);
scene.add(sunBall);

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

for (let x = -300; x < 460; x += 6.5) {
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

// Low bushes on the forest floor (just for looks)
(function () {
  const list = [];
  for (let n = 0; n < 1700; n++) {
    const x = (dice() - 0.5) * 620;
    const z = (dice() - 0.5) * 560;
    if (forestAt(x, z) < 0.2) continue;
    list.push({ x: x, z: z, big: 0.5 + dice() * 0.7 });
  }
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x3f9a3a }), list.length);
  list.forEach(function (fern, n) {
    helper.rotation.set(0, fern.x, 0);
    helper.position.set(fern.x, groundAt(fern.x, fern.z) + fern.big * 0.2, fern.z);
    helper.scale.set(fern.big * 1.2, fern.big * 0.5, fern.big * 1.2);
    helper.updateMatrix();
    mesh.setMatrixAt(n, helper.matrix);
  });
  mesh.frustumCulled = false;
  scene.add(mesh);
})();

// ===== 5. Dinosaurs =====
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
const SIGNS = { hunt: makeSign("!", "#ff4a3a"), look: makeSign("?", "#ffd76a"), sleep: makeSign("Zz", "#8fd8ff") };

// ===== 6. Sea and sky creatures =====
// A Mosasaurus: a long body, a head with a jaw that opens, four flippers and a tail with a fin
function makeMosa() {
  const sp = SPECIES.mosa;
  const g = new THREE.Group();
  const skin = paint(sp.a);
  const belly = paint(sp.b);
  const dark = paint(sp.c);
  ball(g, skin, 1.5, 1.3, 5, 0, 0, 0);
  ball(g, belly, 1.3, 1, 4.4, 0, -0.4, 0);
  for (let n = 0; n < 7; n++) ball(g, dark, 0.5, 0.25, 0.9, 0, 1.15 - Math.abs(n - 3) * 0.08, -3.3 + n * 1.1);
  const head = new THREE.Group();
  head.position.set(0, 0.1, -4.4);
  ball(head, skin, 1.05, 0.75, 2.3, 0, 0.1, -1.6);
  for (const s of [-1, 1]) piece(head, ballShape, bright(0xfff4a0), s * 0.8, 0.45, -1.2).scale.setScalar(0.16);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.2, -0.3);
  ball(jaw, belly, 0.9, 0.3, 2, 0, -0.15, -1.4);
  head.add(jaw);
  for (let n = 0; n < 7; n++) {
    for (const s of [-1, 1]) {
      piece(head, new THREE.ConeGeometry(0.09, 0.4, 5), paint(0xffffff), s * 0.7, -0.25, -0.6 - n * 0.42).rotation.x = Math.PI;
      piece(jaw, new THREE.ConeGeometry(0.08, 0.32, 5), paint(0xffffff), s * 0.62, 0.15, -0.5 - n * 0.42);
    }
  }
  g.add(head);
  const flippers = [];
  for (const s of [-1, 1]) {
    for (const z of [-2.4, 2.2]) {
      const flipper = new THREE.Group();
      flipper.position.set(s * 1.2, -0.5, z);
      ball(flipper, dark, 1.4, 0.14, 0.6, s * 1.2, 0, 0.2);
      g.add(flipper);
      flippers.push(flipper);
    }
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0, 4.2);
  const cone = piece(tail, new THREE.ConeGeometry(1.1, 6.5, 8), skin, 0, 0, 3.2);
  cone.rotation.x = Math.PI / 2;
  ball(tail, dark, 0.12, 1.3, 1.5, 0, 0.2, 6);
  g.add(tail);
  return { group: shade(g), tail: tail, jaw: jaw, flippers: flippers, legs: [], head: head };
}

// A Pteranodon: a small body, a long beak with a crest behind it, and two big wings that flap
function makePtera() {
  const sp = SPECIES.ptera;
  const g = new THREE.Group();
  const skin = paint(sp.a);
  const belly = paint(sp.b);
  const trim = paint(sp.c);
  ball(g, skin, 0.45, 0.4, 1, 0, 0, 0);
  ball(g, belly, 0.38, 0.3, 0.85, 0, -0.12, 0);
  const head = new THREE.Group();
  head.position.set(0, 0.25, -0.9);
  piece(head, new THREE.CylinderGeometry(0.14, 0.2, 0.8, 6), skin, 0, 0.2, -0.25).rotation.x = -0.9;
  ball(head, skin, 0.24, 0.22, 0.4, 0, 0.5, -0.6);
  piece(head, new THREE.ConeGeometry(0.13, 1.5, 6), belly, 0, 0.45, -1.6).rotation.x = -Math.PI / 2;
  piece(head, new THREE.ConeGeometry(0.12, 1.2, 5), trim, 0, 0.75, 0.2).rotation.x = Math.PI / 2 - 0.5;
  for (const s of [-1, 1]) piece(head, ballShape, bright(0xfff4a0), s * 0.2, 0.58, -0.7).scale.setScalar(0.05);
  g.add(head);
  const wings = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.35, 0.15, -0.1);
    // Each wing is a long flat triangle
    const flat = piece(wing, new THREE.ConeGeometry(0.9, 3, 3), skin, s * 1.5, 0, 0.15);
    flat.rotation.set(0, 0, s * -Math.PI / 2);
    flat.scale.set(1, 1, 0.06);
    piece(wing, new THREE.CylinderGeometry(0.05, 0.07, 3, 5), trim, s * 1.5, 0.03, -0.3).rotation.z = Math.PI / 2;
    g.add(wing);
    wings.push({ group: wing, side: s });
  }
  for (const s of [-1, 1]) piece(g, new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4), skin, s * 0.15, -0.2, 1).rotation.x = Math.PI / 2;
  return { group: shade(g), wings: wings, legs: [], tail: new THREE.Group(), head: head, jaw: null };
}

// Build any creature by its kind
function makeCreature(kind) {
  if (kind === "mosa") return makeMosa();
  if (kind === "ptera") return makePtera();
  return makeDino(kind);
}

// ===== 7. The ruins of the old park =====
// Solid things you can't walk through: boxes on the ground, each { x0, z0, x1, z1 }
const blocks = [];

// A solid wall (or any solid box). "base" is the height of the ground it stands on.
function solidWall(material, x0, z0, x1, z1, high, base) {
  blocks.push({ x0: x0, z0: z0, x1: x1, z1: z1 });
  const mesh = box(scene, material, x1 - x0, high, z1 - z0, (x0 + x1) / 2, base + high / 2, (z0 + z1) / 2);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// Words painted on a board
function board(text, wide, high, colour, back) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.round(512 * high / wide);
  const pen = c.getContext("2d");
  pen.fillStyle = back;
  pen.fillRect(0, 0, c.width, c.height);
  pen.fillStyle = colour;
  pen.font = "bold " + Math.round(c.height * 0.55) + "px Georgia, serif";
  pen.textAlign = "center";
  pen.fillText(text, 256, c.height * 0.68, 490);
  return new THREE.Mesh(new THREE.PlaneGeometry(wide, high), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
}

const ruins = { penGate: null, alarm: null, lamps: [] };
(function () {
  const stone = paint(0xb8b0a0);
  const mossy = paint(0x7a9a6a);
  const rust = paint(0x8a4a2a);
  const wood = paint(0x8a6238);
  const concrete = paint(0x9a9aa0);

  // ----- The Visitor Centre: broken walls, a fallen roof, and a skeleton that is still standing -----
  const cy = groundAt(CENTRE.x, CENTRE.z);
  const X = CENTRE.x;
  const Z = CENTRE.z;
  solidWall(stone, X - 11, Z - 10, X + 11, Z - 9.4, 5, cy);                 // north wall
  solidWall(stone, X - 11, Z - 10, X - 10.4, Z + 10, 4, cy);                // west wall
  solidWall(stone, X + 10.4, Z - 10, X + 11, Z - 3, 4.5, cy);               // east wall (with a hole in the middle)
  solidWall(mossy, X + 10.4, Z + 3, X + 11, Z + 10, 2.5, cy);
  solidWall(stone, X - 11, Z + 9.4, X - 2.6, Z + 10, 4.5, cy);              // south wall, either side of the door
  solidWall(mossy, X + 2.6, Z + 9.4, X + 11, Z + 10, 3, cy);
  box(scene, stone, 5.4, 0.8, 0.7, X, cy + 4.9, Z + 9.7);
  const sign = board("FOSSIL BAY", 5, 0.9, "#ffe9a0", "#3a2412");
  sign.position.set(X, cy + 5.9, Z + 10.1);
  scene.add(sign);
  const slab = box(scene, concrete, 10, 0.4, 8, X - 5.5, cy + 3.4, Z - 5.5);   // a bit of roof that fell in
  slab.rotation.z = 0.5;
  slab.castShadow = true;
  for (let n = 0; n < 5; n++) box(scene, mossy, 1.2 + n * 0.3, 0.7, 1, X + 12 + n * 0.8, cy + 0.3, Z + n * 1.1 - 2).rotation.y = n;   // rubble
  solidWall(wood, X - 5, Z - 3, X - 1, Z - 1.8, 1, cy);                       // the front desk
  // The skeleton: a spine, ribs, legs and a big skull
  const bone = paint(0xf0e8d0);
  const skeleton = new THREE.Group();
  skeleton.position.set(X + 4.5, cy, Z + 2);
  box(skeleton, concrete, 7, 0.5, 3, 0, 0.25, 0);
  piece(skeleton, new THREE.CylinderGeometry(0.12, 0.12, 6, 6), bone, 0, 3, 0).rotation.z = Math.PI / 2 - 0.15;
  for (let n = 0; n < 6; n++) piece(skeleton, new THREE.TorusGeometry(0.6 - Math.abs(n - 2) * 0.06, 0.05, 4, 10, Math.PI), bone, -1 + n * 0.45, 2.7, 0).rotation.set(0, Math.PI / 2, Math.PI);
  for (const s of [-1, 1]) piece(skeleton, new THREE.CylinderGeometry(0.1, 0.08, 2.6, 5), bone, 0.3, 1.6, s * 0.5);
  ball(skeleton, bone, 0.9, 0.55, 0.45, -3.4, 3.6, 0);
  scene.add(shade(skeleton));
  blocks.push({ x0: X + 1, z0: Z + 0.5, x1: X + 8, z1: Z + 3.5 });

  // ----- The Aviary: a ring of rusty posts under a broken dome of wire -----
  const ay = groundAt(CLIFFS.x, CLIFFS.z);
  for (let n = 0; n < 12; n++) {
    const a = n * Math.PI / 6;
    if (n === 4 || n === 5) continue;                                    // the side that fell down
    piece(scene, new THREE.CylinderGeometry(0.2, 0.28, 9, 6), rust, CLIFFS.x + Math.cos(a) * 17, groundAt(CLIFFS.x + Math.cos(a) * 17, CLIFFS.z + Math.sin(a) * 17) + 4.5, CLIFFS.z + Math.sin(a) * 17).castShadow = true;
  }
  const dome = piece(scene, new THREE.SphereGeometry(17.5, 14, 7, 0.4, Math.PI * 1.55, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8c8b0, wireframe: true, transparent: true, opacity: 0.55 }), CLIFFS.x, ay + 7, CLIFFS.z);
  dome.scale.y = 0.7;
  piece(scene, new THREE.CylinderGeometry(1.3, 1.6, 1, 8), stone, CLIFFS.x, ay + 0.5, CLIFFS.z);
  for (let n = 0; n < 3; n++) {
    // Pteranodon nests
    const nx = CLIFFS.x + Math.cos(n * 2.1 + 1) * 10;
    const nz = CLIFFS.z + Math.sin(n * 2.1 + 1) * 10;
    piece(scene, new THREE.TorusGeometry(1.1, 0.3, 5, 9), wood, nx, groundAt(nx, nz) + 0.25, nz).rotation.x = Math.PI / 2;
    ball(scene, paint(0xf4ecd0), 0.3, 0.4, 0.3, nx, groundAt(nx, nz) + 0.5, nz);
  }

  // ----- The lab on Lab Rock, and the pen beside it -----
  const ly = groundAt(LAB.x, LAB.z);
  solidWall(concrete, LAB.x - 9, LAB.z - 8, LAB.x + 9, LAB.z - 7.4, 4.6, ly);         // north
  solidWall(concrete, LAB.x - 9, LAB.z - 8, LAB.x - 8.4, LAB.z + 8, 4.6, ly);         // west
  solidWall(concrete, LAB.x + 8.4, LAB.z - 8, LAB.x + 9, LAB.z + 8, 4.6, ly);         // east
  solidWall(concrete, LAB.x - 9, LAB.z + 7.4, LAB.x - 1.4, LAB.z + 8, 4.6, ly);       // south, either side of the door
  solidWall(concrete, LAB.x + 1.4, LAB.z + 7.4, LAB.x + 9, LAB.z + 8, 4.6, ly);
  box(scene, concrete, 18.6, 0.4, 16.6, LAB.x, ly + 4.8, LAB.z).castShadow = true;   // the roof
  const labSign = board("GENETICS LAB 9", 4.4, 0.7, "#d8f0ff", "#1a2a3a");
  labSign.position.set(LAB.x, ly + 3.9, LAB.z + 8.05);
  scene.add(labSign);
  solidWall(paint(0x5a6a78), LAB.x + 1, LAB.z - 3.2, LAB.x + 6, LAB.z - 1.6, 1, ly);   // the desk
  for (let n = 0; n < 3; n++) {
    // Glass tanks with something green in them
    piece(scene, new THREE.CylinderGeometry(0.8, 0.8, 3, 10), new THREE.MeshPhongMaterial({ color: 0x7dffb0, emissive: 0x1a6a3a, transparent: true, opacity: 0.55 }), LAB.x - 6 + n * 2.4, ly + 1.6, LAB.z - 6);
    piece(scene, new THREE.CylinderGeometry(0.9, 0.9, 0.3, 10), paint(0x3a3a44), LAB.x - 6 + n * 2.4, ly + 0.15, LAB.z - 6);
  }
  blocks.push({ x0: LAB.x - 7, z0: LAB.z - 7, x1: LAB.x - 0.4, z1: LAB.z - 5 });
  ruins.alarm = new THREE.PointLight(0xff2a1a, 0, 40);
  ruins.alarm.position.set(LAB.x, ly + 4, LAB.z);
  scene.add(ruins.alarm);
  // The pen: thick steel bars all round, and a gate on the west side that will not hold for ever
  const steel = paint(0x4a4a54);
  const bars = [];
  for (let x = PEN.x0; x <= PEN.x1; x += 1.6) bars.push([x, PEN.z0], [x, PEN.z1]);
  for (let z = PEN.z0 + 1.6; z < PEN.z1; z += 1.6) bars.push([PEN.x1, z]);
  const barMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.16, 7, 6), steel, bars.length);
  bars.forEach(function (bar, n) {
    helper.rotation.set(0, 0, 0);
    helper.scale.set(1, 1, 1);
    helper.position.set(bar[0], ly + 3.5, bar[1]);
    helper.updateMatrix();
    barMesh.setMatrixAt(n, helper.matrix);
  });
  barMesh.castShadow = true;
  scene.add(barMesh);
  blocks.push({ x0: PEN.x0, z0: PEN.z0 - 0.3, x1: PEN.x1, z1: PEN.z0 + 0.3 }, { x0: PEN.x0, z0: PEN.z1 - 0.3, x1: PEN.x1, z1: PEN.z1 + 0.3 }, { x0: PEN.x1 - 0.3, z0: PEN.z0, x1: PEN.x1 + 0.3, z1: PEN.z1 });
  ruins.penGate = new THREE.Group();
  ruins.penGate.position.set(PEN.x0, ly, (PEN.z0 + PEN.z1) / 2);
  for (let z = PEN.z0; z <= PEN.z1; z += 1.6) piece(ruins.penGate, new THREE.CylinderGeometry(0.16, 0.16, 7, 6), steel, 0, 3.5, z - (PEN.z0 + PEN.z1) / 2);
  box(ruins.penGate, paint(0xd8b02a), 0.3, 0.5, PEN.z1 - PEN.z0, 0, 5, 0);
  const warning = board("DANGER", 3, 0.7, "#1a1a1a", "#ffd23a");
  warning.position.set(-0.3, 2.6, 0);
  warning.rotation.y = -Math.PI / 2;
  ruins.penGate.add(warning);
  scene.add(shade(ruins.penGate));
  ruins.gateBlock = { x0: PEN.x0 - 0.3, z0: PEN.z0, x1: PEN.x0 + 0.3, z1: PEN.z1 };
  blocks.push(ruins.gateBlock);

  // ----- Watchtowers: nothing can reach you at the top -----
  for (const tower of TOWERS) {
    const g = new THREE.Group();
    g.position.set(tower.x, groundAt(tower.x, tower.z), tower.z);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) piece(g, new THREE.CylinderGeometry(0.14, 0.18, 7, 6), wood, sx * 1.3, 3.5, sz * 1.3).rotation.set(sz * -0.06, 0, sx * 0.06);
    }
    box(g, wood, 3.2, 0.25, 3.2, 0, 7, 0);
    for (const s of [-1, 1]) {
      box(g, wood, 3.2, 0.1, 0.1, 0, 8, s * 1.55);
      box(g, wood, 0.1, 0.1, 3.2, s * 1.55, 8, 0);
    }
    piece(g, new THREE.ConeGeometry(2.6, 1.3, 4), paint(0x4a7a4a), 0, 9.6, 0).rotation.y = Math.PI / 4;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, wood, 0.1, 2, 0.1, sx * 1.5, 8, sz * 1.5);
    for (let y = 0.4; y < 7; y += 0.45) box(g, wood, 0.7, 0.07, 0.08, 0, y, 1.75);
    for (const s of [-1, 1]) box(g, wood, 0.08, 7.2, 0.08, s * 0.38, 3.6, 1.75);
    scene.add(shade(g));
  }

  // ----- Piers, a gate at the dock, broken fences along the road, and wrecked jeeps -----
  for (const pier of PIERS) {
    box(scene, wood, 4.6, 0.3, pier.z1 - pier.z0 + 3, pier.x, 0.9, (pier.z0 + pier.z1) / 2 - 1.5).castShadow = true;
    for (let z = pier.z0 + 1; z < pier.z1; z += 5) {
      for (const s of [-1, 1]) piece(scene, new THREE.CylinderGeometry(0.2, 0.2, 9, 6), paint(0x5a4030), pier.x + s * 2.2, -3, z);
    }
  }
  const gy = groundAt(DOCK.x, DOCK.z - 8);
  for (const s of [-1, 1]) piece(scene, new THREE.CylinderGeometry(0.6, 0.8, 9, 8), wood, DOCK.x + s * 5, gy + 4.5, DOCK.z - 8).castShadow = true;
  const arch = box(scene, wood, 11.5, 1.6, 0.6, DOCK.x, gy + 8.2, DOCK.z - 8);
  arch.rotation.z = 0.06;                                                 // the gate has slumped to one side
  const gateSign = board("FOSSIL BAY", 9, 1.3, "#c8b070", "#3a2412");
  gateSign.position.set(DOCK.x, gy + 8.2, DOCK.z - 7.65);
  gateSign.rotation.z = 0.06;
  scene.add(gateSign);
  const posts = [];
  for (let n = 0; n < ROAD.length - 1; n++) {
    const a = ROAD[n];
    const b = ROAD[n + 1];
    const long = gap(a, b);
    for (let far = 6; far < long; far += 7) {
      for (const s of [-1, 1]) {
        if (dice() < 0.3) continue;                                       // some posts have fallen
        const x = a.x + (b.x - a.x) * far / long + s * 4.4;
        const z = a.z + (b.z - a.z) * far / long;
        posts.push({ x: x, z: z, lean: (dice() - 0.5) * 0.5 });
      }
    }
  }
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), rust, posts.length);
  posts.forEach(function (post, n) {
    helper.scale.set(1, 1, 1);
    helper.rotation.set(post.lean, 0, post.lean * 0.6);
    helper.position.set(post.x, groundAt(post.x, post.z) + 1.2, post.z);
    helper.updateMatrix();
    postMesh.setMatrixAt(n, helper.matrix);
  });
  postMesh.castShadow = true;
  scene.add(postMesh);
  for (const spot of [[-9, 176, 0.6], [13, 96, 2.2], [-96, 30, 4]]) {
    const jeep = new THREE.Group();
    jeep.position.set(spot[0], groundAt(spot[0], spot[1]), spot[1]);
    jeep.rotation.set(0.08, spot[2], 0.14);
    box(jeep, rust, 2.2, 0.8, 4.2, 0, 0.9, 0);
    box(jeep, paint(0x5a7a4a), 2, 0.7, 1.6, 0, 1.55, 0.6);
    for (const x of [-1.1, 1.1]) for (const z of [-1.4, 1.4]) piece(jeep, new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8), paint(0x2a2a30), x, 0.45, z).rotation.z = Math.PI / 2;
    ball(jeep, mossy, 1, 0.3, 1.4, 0.2, 2, 0.4);
    scene.add(shade(jeep));
    blocks.push({ x0: spot[0] - 1.8, z0: spot[1] - 1.8, x1: spot[0] + 1.8, z1: spot[1] + 1.8 });
  }
})();

// Supply crates and the three data drives. (game.js hides each one when you take it.)
const crateModels = CRATES.map(function (crate) {
  const g = new THREE.Group();
  g.position.set(crate.x, groundAt(crate.x, crate.z), crate.z);
  box(g, paint(crate.has === "flare" ? 0xd8442e : 0xf4f4f4), 0.9, 0.6, 0.6, 0, 0.3, 0);
  box(g, paint(crate.has === "flare" ? 0xffd23a : 0xd8442e), 0.3, 0.62, 0.62, 0, 0.3, 0);
  scene.add(shade(g));
  return g;
});
const driveModels = DRIVES.map(function (drive, n) {
  const g = new THREE.Group();
  g.position.set(drive.x, groundAt(drive.x, drive.z) + (n === 1 ? 1 : 1.05), drive.z);
  box(g, paint(0x2a2a30), 0.5, 0.14, 0.34, 0, 0.1, 0);
  box(g, bright(0x4ac8ff), 0.3, 0.04, 0.1, 0, 0.19, 0.08);
  // A beam of light, so you can see where it is from far away
  const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot, color: 0x4ac8ff, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
  beam.scale.set(7, 90, 1);
  beam.position.y = 36;
  g.add(beam);
  scene.add(g);
  return g;
});

// ===== 8. Your boat and your ship =====
const boatModel = (function () {
  const g = new THREE.Group();
  const hull = paint(0xf4f4f4);
  box(g, hull, 2.2, 0.8, 5, 0, 0.3, 0);
  piece(g, new THREE.ConeGeometry(1.1, 2, 4), hull, 0, 0.3, -3.4).rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  box(g, paint(0xd8442e), 2.26, 0.2, 5.06, 0, 0.55, 0);
  box(g, paint(0x8a6238), 1.8, 0.1, 1, 0, 0.75, 0.6);
  box(g, paint(0x2a2a30), 0.5, 1, 0.6, 0, 0.6, 2.7);                    // the motor
  box(g, new THREE.MeshPhongMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.6 }), 1.6, 0.7, 0.08, 0, 1.2, -1);
  piece(g, ballShape, bright(0xfff4c8), 0, 1, -2.4).scale.setScalar(0.18);
  scene.add(shade(g));
  return g;
})();

(function () {
  const g = new THREE.Group();
  g.position.set(SHIP.x, 0, SHIP.z);
  g.rotation.y = 0.5;
  const hull = paint(0x2a4a6a);
  box(g, hull, 9, 5, 34, 0, 1.5, 0);
  piece(g, new THREE.ConeGeometry(4.5, 9, 4), hull, 0, 1.5, -21.4).rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  box(g, paint(0xd8442e), 9.1, 0.8, 34.1, 0, 0.3, 0);
  box(g, paint(0xf4f4f4), 7, 4, 12, 0, 6, 6);
  box(g, paint(0xf4f4f4), 5, 3, 6, 0, 9.5, 6);
  box(g, new THREE.MeshPhongMaterial({ color: 0x9fe8ff, shininess: 100 }), 5.1, 1, 6.1, 0, 10, 6);
  piece(g, new THREE.CylinderGeometry(0.2, 0.2, 9, 6), paint(0x5a5a60), 0, 15, 6);
  piece(g, new THREE.CylinderGeometry(1, 1, 3, 10), paint(0xffb02a), 0, 9.5, 12);
  box(g, paint(0xffd23a), 2.4, 0.4, 6, 0, 4.4, -10).rotation.x = -0.2;   // a crane arm
  scene.add(shade(g));
})();
