// Dino Island 100: the scene.
// The huge island with its seven regions, the sea, the volcano, the park gate, and all the models:
// the dinosaurs, the ranger jeeps, the helicopter, the monorail train and the people.

// ===== 1. Setting up =====
const canvas = document.getElementById("game");
const testing = location.search.includes("test");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const SKY = new THREE.Color(0x9fd8f4);
scene.fog = new THREE.Fog(0x9fd8f4, 400, 1900);
const camera = new THREE.PerspectiveCamera(50, 1.5, 0.5, 4200);
// Add ?plain to the address to switch shadows off (if the game runs slowly)
const shadows = !location.search.includes("plain");
renderer.shadowMap.enabled = shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const UP = new THREE.Vector3(0, 1, 0);
const dice = seeded(65);
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

const skyLight = new THREE.HemisphereLight(0xd8ecff, 0x5a7a4a, 0.62);
scene.add(skyLight);
const sunLight = new THREE.DirectionalLight(0xfff0d0, 0.7);
sunLight.position.set(-60, 120, 50);
sunLight.castShadow = shadows;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -110;
sunLight.shadow.camera.right = sunLight.shadow.camera.top = 110;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 400;
sunLight.shadow.bias = -0.0006;
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

// A ball squashed into an egg shape: rx wide, ry tall, rz long
const ballShape = new THREE.SphereGeometry(1, 12, 9);
function ball(parent, material, rx, ry, rz, x, y, z) {
  const mesh = piece(parent, ballShape, material, x, y, z);
  mesh.scale.set(rx, ry, rz);
  return mesh;
}

// Put many copies of one shape into the world in one go
function sprinkle(geometry, material, spots) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, spots.length));
  const tint = new THREE.Color();
  spots.forEach(function (s, i) {
    helper.position.set(s.x, s.y, s.z);
    helper.rotation.set(0, s.turn || 0, 0);
    helper.scale.set(s.sx || 1, s.sy || s.sx || 1, s.sz || s.sx || 1);
    helper.updateMatrix();
    mesh.setMatrixAt(i, helper.matrix);
    if (s.tint !== undefined) mesh.setColorAt(i, tint.setHex(s.tint));
  });
  mesh.count = spots.length;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

// ===== 3. The island =====
// The island is flat (so you can build anywhere), with a sandy beach all round and then the sea.
// A volcano smokes on its own little island to the north, off the Ashlands.
const VOLCANO = { x: 0, z: -HALF - 170 };

function hillAt(x, z) {
  const out = Math.max(Math.abs(x), Math.abs(z)) - HALF;
  let y = out <= 0 ? 0 : 0.1 - smooth(out / 50) * 4.5;
  const far = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  if (far < 120) y = Math.max(y, Math.pow(1 - far / 120, 1.3) * 130 - 3);
  return y;
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

// Everything that should throw a shadow goes through here
function shade(thing) {
  thing.traverse(function (part) {
    if (part.isMesh && !part.material.transparent) part.castShadow = true;
  });
  return thing;
}

// The trees and rocks that grow wild: { "i,k": { tree or rock, slot ... } }. They vanish when you build on them.
const wild = {};
let wildTrunks;
let wildTops;
let wildRocks;
const wildTint = new THREE.Color();

(function () {
  // The sea bed and the beach, all round
  const shape = new THREE.PlaneGeometry(2400, 2400, 120, 120);
  shape.rotateX(-Math.PI / 2);
  const spots = shape.attributes.position;
  const colours = new Float32Array(spots.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < spots.count; i++) {
    const y = hillAt(spots.getX(i), spots.getZ(i));
    spots.setY(i, y - 0.06);
    colour.setHex(y > 60 ? 0x4a3a38 : y > 6 ? 0x6a5a4a : y > -1 ? 0xf0dca0 : 0x3a8aa8);
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  shape.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  shape.computeVertexNormals();
  scene.add(new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // The island itself: one corner of the picture for every corner of every square, coloured by region
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const pen = c.getContext("2d");
  pen.fillStyle = "#e8e8e8";
  pen.fillRect(0, 0, 128, 128);
  for (let n = 0; n < 500; n++) {
    pen.fillStyle = n % 3 ? "rgba(255,255,255,0.5)" : "rgba(110,130,110,0.45)";
    pen.fillRect(dice() * 128, dice() * 128, 2 + dice() * 3, 2 + dice() * 5);
  }
  const speckle = new THREE.CanvasTexture(c);
  speckle.wrapS = speckle.wrapT = THREE.RepeatWrapping;
  speckle.repeat.set(SIZE / 2, SIZE / 2);
  const park = new THREE.PlaneGeometry(SIZE * TILE, SIZE * TILE, SIZE, SIZE);
  park.rotateX(-Math.PI / 2);
  const corners = park.attributes.position;
  const tints = new Float32Array(corners.count * 3);
  const other = new THREE.Color();
  for (let n = 0; n < corners.count; n++) {
    const x = corners.getX(n);
    const z = corners.getZ(n);
    const biome = biomeAt(clamp(tileOf(x - 0.1), 0, SIZE - 1), clamp(tileOf(z - 0.1), 0, SIZE - 1));
    const patch = 0.5 + 0.5 * Math.sin(x * 0.09 + Math.cos(z * 0.07) * 2) * Math.cos(z * 0.08);
    colour.setHex(BIOMES[biome].ground).lerp(other.setHex(BIOMES[biome].other), patch);
    tints[n * 3] = colour.r;
    tints[n * 3 + 1] = colour.g;
    tints[n * 3 + 2] = colour.b;
  }
  park.setAttribute("color", new THREE.BufferAttribute(tints, 3));
  const lawn = new THREE.Mesh(park, new THREE.MeshLambertMaterial({ vertexColors: true, map: speckle }));
  lawn.receiveShadow = true;
  scene.add(lawn);

  const seaPaint = new THREE.MeshPhongMaterial({ color: 0x2f9ac8, transparent: true, opacity: 0.86, shininess: 120, specular: 0xfff4d8 });
  const sea = piece(scene, new THREE.PlaneGeometry(6000, 6000), seaPaint, 0, -0.8, 0);
  sea.rotation.x = -Math.PI / 2;

  // The volcano, with a glowing top
  piece(scene, new THREE.CylinderGeometry(27, 30, 3, 14), bright(0xff7a2a), VOLCANO.x, 122, VOLCANO.z);
  const lava = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot, color: 0xff8a3a, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
  lava.scale.set(110, 60, 1);
  lava.position.set(VOLCANO.x, 135, VOLCANO.z);
  scene.add(lava);

  // Wild trees and rocks. Each region has its own kind, and its own amount of them.
  // (All the trees are one shape drawn many times, which is fast.)
  const GROWS = {
    meadow: { trees: 0.012, rocks: 0.002, top: [0x4ab85a, 0x3aa04a], trunk: 2.6, wide: 1.6, flat: 0.8 },
    forest: { trees: 0.2,   rocks: 0.004, top: [0x2a7a32, 0x35883a, 0x1f6a2a], trunk: 7, wide: 2.4, flat: 0.8 },
    desert: { trees: 0.012, rocks: 0.03,  top: [0x4a9a4a], trunk: 0.4, wide: 0.5, flat: 3, rock: 0xb8643a },
    snow:   { trees: 0.04,  rocks: 0.015, top: [0xf4f8ff, 0xdfeaf4], trunk: 1.2, wide: 1.4, flat: 1.7, rock: 0xbfe0f0 },
    swamp:  { trees: 0.07,  rocks: 0.003, top: [0x3a6a3a, 0x4a7a42], trunk: 4.4, wide: 2.3, flat: 0.5 },
    ash:    { trees: 0.02,  rocks: 0.035, top: [0x3a3030], trunk: 3.4, wide: 0.5, flat: 0.6, rock: 0x3a3234 },
    coast:  { trees: 0.02,  rocks: 0.01,  top: [0x2f9a3a, 0x4ab04a], trunk: 5.5, wide: 1.9, flat: 0.35, rock: 0xd8c8a8 },
  };
  const treeList = [];
  const rockList = [];
  for (let i = 0; i < SIZE; i++) {
    for (let k = 0; k < SIZE; k++) {
      const grow = GROWS[biomeAt(i, k)];
      const roll = dice();
      if (Math.abs(i - GATE.i) < 4 && k > SIZE - 8) continue;
      if (roll < grow.trees) {
        wild[i + "," + k] = { tree: true, slot: treeList.length, x: mid(i) + (dice() - 0.5) * 2, z: mid(k) + (dice() - 0.5) * 2, high: grow.trunk * (0.7 + dice() * 0.6), wide: grow.wide * (0.8 + dice() * 0.5), flat: grow.flat, tint: grow.top[Math.floor(dice() * grow.top.length)], shown: false };
        treeList.push(wild[i + "," + k]);
      } else if (roll < grow.trees + grow.rocks) {
        wild[i + "," + k] = { tree: false, slot: rockList.length, x: mid(i) + (dice() - 0.5) * 2, z: mid(k) + (dice() - 0.5) * 2, wide: 0.6 + dice() * 1.2, tint: grow.rock || 0x8a8a90, shown: false };
        rockList.push(wild[i + "," + k]);
      }
    }
  }
  const trunkShape = new THREE.CylinderGeometry(0.16, 0.28, 1, 6);
  trunkShape.translate(0, 0.5, 0);
  wildTrunks = new THREE.InstancedMesh(trunkShape, paint(0x5a4030), treeList.length);
  wildTops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), treeList.length);
  wildRocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), rockList.length);
  for (const mesh of [wildTrunks, wildTops, wildRocks]) {
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    scene.add(mesh);
  }
  for (const key in wild) showWild(key, true);

  // The pier where the visitors' ferry ties up
  piece(scene, new THREE.BoxGeometry(TILE, 0.4, 46), paint(0x9a7a4a), mid(GATE.i), 0.05, HALF + 23);
  for (let z = 6; z < 46; z += 8) for (const s of [-1, 1]) piece(scene, new THREE.CylinderGeometry(0.25, 0.25, 4, 6), paint(0x6a4a2a), mid(GATE.i) + s * 2, -1, HALF + z);
  const ferry = new THREE.Group();
  ferry.position.set(mid(GATE.i) + 7, -0.5, HALF + 38);
  piece(ferry, new THREE.BoxGeometry(7, 2.4, 18), paint(0xf4f4f4), 0, 1, 0);
  piece(ferry, new THREE.BoxGeometry(5, 2, 9), paint(0xd8443a), 0, 3, -1);
  piece(ferry, new THREE.CylinderGeometry(0.7, 0.7, 2.6, 8), paint(0x2a2a30), 0, 5, 1);
  scene.add(shade(ferry));
})();

// Show (or hide) the wild tree or rock on one square
function showWild(key, on) {
  const w = wild[key];
  if (!w || w.shown === on) return;
  w.shown = on;
  const big = on ? 1 : 0.0001;
  helper.rotation.set(0, w.x, 0);
  if (w.tree) {
    helper.position.set(w.x, 0, w.z);
    helper.scale.set(big * (0.6 + w.wide * 0.4), w.high * big, big * (0.6 + w.wide * 0.4));
    helper.updateMatrix();
    wildTrunks.setMatrixAt(w.slot, helper.matrix);
    helper.position.set(w.x, w.high + w.wide * w.flat * 0.5, w.z);
    helper.scale.set(w.wide * big, w.wide * w.flat * big, w.wide * big);
    helper.updateMatrix();
    wildTops.setMatrixAt(w.slot, helper.matrix);
    wildTops.setColorAt(w.slot, wildTint.setHex(w.tint));
    wildTrunks.instanceMatrix.needsUpdate = wildTops.instanceMatrix.needsUpdate = true;
    if (wildTops.instanceColor) wildTops.instanceColor.needsUpdate = true;
  } else {
    helper.position.set(w.x, w.wide * 0.3, w.z);
    helper.scale.set(w.wide * big, w.wide * 0.7 * big, w.wide * big);
    helper.updateMatrix();
    wildRocks.setMatrixAt(w.slot, helper.matrix);
    wildRocks.setColorAt(w.slot, wildTint.setHex(w.tint));
    wildRocks.instanceMatrix.needsUpdate = true;
    if (wildRocks.instanceColor) wildRocks.instanceColor.needsUpdate = true;
  }
}

// Smoke from the volcano, and clouds
const smokePuffs = [];
for (let i = 0; i < 7; i++) {
  smokePuffs.push(ball(scene, new THREE.MeshBasicMaterial({ color: 0xd8d0c8, transparent: true, opacity: 0.7, fog: false }), 20, 14, 20, VOLCANO.x, 0, VOLCANO.z));
}
const clouds = sprinkle(ballShape, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }), (function () {
  const list = [];
  for (let i = 0; i < 24; i++) list.push({ x: (dice() - 0.5) * 2200, y: 240 + dice() * 90, z: (dice() - 0.5) * 2200, sx: 40 + dice() * 50, sy: 10, sz: 26 + dice() * 24 });
  return list;
})());

// Rain, for storms
const RAIN = 500;
const rain = (function () {
  const spots = new Float32Array(RAIN * 3);
  for (let i = 0; i < RAIN; i++) {
    spots[i * 3] = (dice() - 0.5) * 220;
    spots[i * 3 + 1] = dice() * 90;
    spots[i * 3 + 2] = (dice() - 0.5) * 220;
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.BufferAttribute(spots, 3));
  const points = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xcfe8ff, size: 0.8, transparent: true, opacity: 0.8 }));
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  return points;
})();

// ===== 4. The park gate =====
(function () {
  const gate = new THREE.Group();
  gate.position.set(mid(GATE.i), 0, HALF + 1);
  const wood = paint(0x7a4a2a);
  for (const side of [-1, 1]) {
    piece(gate, new THREE.CylinderGeometry(1.1, 1.4, 13, 8), wood, side * 6, 6.5, 0);
    piece(gate, new THREE.ConeGeometry(0.8, 2, 6), bright(0xffb02a), side * 6, 14, 0);
  }
  piece(gate, new THREE.BoxGeometry(15, 3.4, 1.2), wood, 0, 11, 0);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const pen = c.getContext("2d");
  pen.fillStyle = "#3a2412";
  pen.fillRect(0, 0, 512, 128);
  pen.fillStyle = "#ffd76a";
  pen.font = "bold 62px Georgia, serif";
  pen.textAlign = "center";
  pen.fillText("DINO ISLAND 100", 256, 86);
  const sign = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) });
  piece(gate, new THREE.PlaneGeometry(13, 3), sign, 0, 11, 0.65);
  piece(gate, new THREE.PlaneGeometry(13, 3), sign, 0, 11, -0.65).rotation.y = Math.PI;
  scene.add(shade(gate));
})();

// ===== 5. Dinosaurs =====
// With 100 kinds, we can't build each one by hand. So there is ONE builder, and it reads each
// kind's "body plan", size, colours and list of features from data.js. A horn here, a sail there...
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

// An egg, waiting to hatch
function makeEgg() {
  const g = new THREE.Group();
  ball(g, paint(0xf4ecd8), 0.7, 0.95, 0.7, 0, 0.9, 0);
  for (let i = 0; i < 5; i++) ball(g, paint(0xb8a070), 0.14, 0.14, 0.05, Math.cos(i * 1.4) * 0.55, 0.7 + (i % 3) * 0.3, Math.sin(i * 1.4) * 0.55);
  ball(g, paint(0x8a6a3a), 1.3, 0.2, 1.3, 0, 0.1, 0);
  return g;
}

// "Zzz" over a sleeping dinosaur, "!" over an angry one: little pictures made from text
function makeSign(text, colour) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const pen = c.getContext("2d");
  pen.font = "bold 44px sans-serif";
  pen.textAlign = "center";
  pen.lineWidth = 6;
  pen.strokeStyle = "#000";
  pen.strokeText(text, 32, 48);
  pen.fillStyle = colour;
  pen.fillText(text, 32, 48);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true });
}
const SIGNS = { angry: makeSign("!", "#ff4a3a"), asleep: makeSign("Zz", "#8fd8ff"), hungry: makeSign("?", "#ffd76a") };

// ===== 6. The ranger jeep and the helicopter =====
function makeJeep(colour) {
  const jeepModel = new THREE.Group();
  const green = paint(colour);
  const yellow = paint(0xffd23a);
  const dark = paint(0x2a2a30);
  piece(jeepModel, new THREE.BoxGeometry(2.2, 0.8, 4.2), green, 0, 1, 0);
  piece(jeepModel, new THREE.BoxGeometry(2.24, 0.25, 4.24), yellow, 0, 0.75, 0);
  piece(jeepModel, new THREE.BoxGeometry(2, 0.7, 1.6), green, 0, 1.6, 0.6);
  piece(jeepModel, new THREE.BoxGeometry(1.9, 0.6, 0.1), new THREE.MeshPhongMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.6 }), 0, 1.7, -0.3);
  for (const x of [-1.1, 1.1]) {
    for (const z of [-1.4, 1.4]) {
      const wheel = piece(jeepModel, new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10), dark, x, 0.55, z);
      wheel.rotation.z = Math.PI / 2;
    }
    piece(jeepModel, ballShape, bright(0xfff4c8), x * 0.75, 1.1, -2.1).scale.setScalar(0.22);
  }
  piece(jeepModel, new THREE.BoxGeometry(1.2, 0.2, 0.3), bright(0xff5a3a), 0, 2.1, 0.6);
  scene.add(shade(jeepModel));
  return jeepModel;
}
const jeepModel = makeJeep(0x3a7a4a);

function makeHelicopter() {
  const g = new THREE.Group();
  const red = paint(0xd8442e);
  ball(g, red, 1.6, 1.4, 2.6, 0, 0, 0);
  ball(g, new THREE.MeshPhongMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.7 }), 1.2, 1, 1.2, 0, 0.2, -1.7);
  piece(g, new THREE.BoxGeometry(0.4, 0.4, 4.5), red, 0, 0.3, 4);
  piece(g, new THREE.BoxGeometry(0.15, 1.4, 0.8), red, 0, 1, 6);
  const rotor = piece(g, new THREE.BoxGeometry(9, 0.1, 0.5), paint(0x2a2a30), 0, 1.6, 0);
  piece(g, new THREE.CylinderGeometry(0.05, 0.05, 6, 4), paint(0x2a2a30), 0, -4, 0);
  g.userData.rotor = rotor;
  return g;
}

// ===== 7. Visitors =====
const MAX_GUESTS = 140;
const guestBodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.38, 1.2, 7), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_GUESTS);
const guestHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.27, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_GUESTS);
guestBodies.frustumCulled = guestHeads.frustumCulled = false;
guestBodies.count = guestHeads.count = 0;
scene.add(guestBodies, guestHeads);
const SHIRTS = [0xff5a5a, 0x4a9aff, 0xffd23a, 0x7ad86a, 0xc87aff, 0xff9a3a, 0xffffff, 0x3ad8c8];
const SKINS = [0xf4c8a0, 0xd8a070, 0x9a6a48, 0x6a4a34, 0xf8dcc0];

// ===== 8. Your staff, and the monorail =====
// A worker: like a visitor, but in uniform with a hat
function makeWorker(colour, hat) {
  const g = new THREE.Group();
  piece(g, new THREE.CylinderGeometry(0.32, 0.4, 1.25, 7), paint(colour), 0, 0.62, 0);
  ball(g, paint(0xe8b890), 0.28, 0.28, 0.28, 0, 1.5, 0);
  piece(g, new THREE.CylinderGeometry(0.42, 0.42, 0.06, 9), paint(hat), 0, 1.72, 0);
  piece(g, new THREE.CylinderGeometry(0.24, 0.27, 0.22, 9), paint(hat), 0, 1.84, 0);
  scene.add(shade(g));
  return g;
}
const UNIFORMS = { keeper: [0x3fa84a, 0xc8a04a], ranger: [0xc8a04a, 0x5a3a22], scientist: [0xf4f4f4, 0x4a7ad8], guide: [0xd8443a, 0xffd23a] };

// One car of the monorail train
function makeCar(first) {
  const g = new THREE.Group();
  piece(g, new THREE.BoxGeometry(2.3, 2, 6.4), paint(0xf4f6f8), 0, 0, 0);
  piece(g, new THREE.BoxGeometry(2.34, 0.5, 6.44), paint(0xd8442e), 0, -0.5, 0);
  piece(g, new THREE.BoxGeometry(2.36, 0.7, 5.4), new THREE.MeshPhongMaterial({ color: 0x2a4a6a, shininess: 100 }), 0, 0.35, 0);
  if (first) ball(g, paint(0xf4f6f8), 1.15, 1, 1.6, 0, 0, -3.2);
  scene.add(shade(g));
  g.visible = false;
  return g;
}
const trainCars = [makeCar(true), makeCar(false), makeCar(false)];
