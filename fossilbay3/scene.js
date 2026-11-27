// Fossil Bay 3: the scene.
// The island with its four biomes, the sea, the volcano, the park gate, and all the models:
// the dinosaurs, the ranger jeeps, the helicopter, the monorail train and the people.

// ===== 1. Setting up =====
const canvas = document.getElementById("game");
const testing = location.search.includes("test");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const SKY = new THREE.Color(0x9fd8f4);
scene.fog = new THREE.Fog(0x9fd8f4, 260, 1100);
const camera = new THREE.PerspectiveCamera(50, 1.5, 0.5, 2600);
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
// The park is flat. Round it is a sandy beach, then the sea. A volcano smokes on its own
// little island to the north.
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

// The scenery that grows wild on each square: { "i,k": model }. It is hidden when you build there.
const wild = {};
// The big trees of the forest. Each one stands on its own square: { "i,k": tree }
const treeAt = {};
const trees = [];
let trunkMesh;
let leafMesh;

(function () {
  // The sea bed and the beach, all round
  const shape = new THREE.PlaneGeometry(1300, 1300, 130, 130);
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

  // The park itself: one corner of the picture for every corner of every square, coloured by section
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
  const sea = piece(scene, new THREE.PlaneGeometry(4000, 4000), seaPaint, 0, -0.8, 0);
  sea.rotation.x = -Math.PI / 2;

  // The volcano, with a glowing top
  piece(scene, new THREE.CylinderGeometry(27, 30, 3, 14), bright(0xff7a2a), VOLCANO.x, 122, VOLCANO.z);
  const lava = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot, color: 0xff8a3a, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
  lava.scale.set(110, 60, 1);
  lava.position.set(VOLCANO.x, 135, VOLCANO.z);
  scene.add(lava);

  // ----- The Greenwood Forest: a real forest, with a tall tree on nearly every other square -----
  // (Every tree is the same two shapes, drawn hundreds of times. That is fast.)
  for (let i = 0; i < 30; i++) {
    for (let k = 0; k < SIZE; k++) {
      // Thick in the heart of the forest, thinning out towards the meadow
      const thick = i < 24 ? 0.48 : 0.48 - (i - 23) * 0.07;
      if (dice() > thick || (Math.abs(i - GATE.i) < 4 && k > 68)) continue;
      const tree = { i: i, k: k, x: mid(i) + (dice() - 0.5) * 2.2, z: mid(k) + (dice() - 0.5) * 2.2, r: 0.35 + dice() * 0.4, high: 10 + dice() * 9, wide: 2.6 + dice() * 1.8, slot: trees.length, tint: [0x2a7a32, 0x35883a, 0x1f6a2a, 0x3f8a32, 0x2a6a3a][Math.floor(dice() * 5)] };
      trees.push(tree);
      treeAt[i + "," + k] = tree;
    }
  }
  const trunkShape = new THREE.CylinderGeometry(0.7, 1, 1, 7);
  trunkShape.translate(0, 0.5, 0);
  trunkMesh = new THREE.InstancedMesh(trunkShape, paint(0x5a4030), trees.length);
  leafMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), trees.length * 2);
  trunkMesh.frustumCulled = leafMesh.frustumCulled = false;
  trunkMesh.castShadow = leafMesh.castShadow = true;
  scene.add(trunkMesh, leafMesh);
  for (const tree of trees) drawTree(tree, true);

  // Ferns and bushes under the trees
  const fern = new THREE.ConeGeometry(0.5, 1.2, 5);
  fern.translate(0, 0.6, 0);
  const ferns = [];
  for (let n = 0; n < 700; n++) ferns.push({ x: -HALF + dice() * 116, y: 0, z: -HALF + dice() * SIZE * TILE, sx: 0.6 + dice() * 0.9, sy: 0.5 + dice() * 0.8, turn: dice() * 6, tint: dice() < 0.5 ? 0x3fa84a : 0x2f8a3a });
  sprinkle(fern, new THREE.MeshLambertMaterial({ color: 0xffffff }), ferns);

  // ----- Plants and rocks in the other sections -----
  const makeWild = function (biome) {
    const g = new THREE.Group();
    const pick = dice();
    if (biome === "meadow") {
      if (pick < 0.25) {
        piece(g, new THREE.CylinderGeometry(0.2, 0.3, 2.6, 6), paint(0x6a4a2a), 0, 1.3, 0);
        ball(g, paint(0x4ab85a), 1.5, 1.3, 1.5, 0, 3.2, 0);
      } else if (pick < 0.6) {
        for (let n = 0; n < 7; n++) ball(g, paint([0xff5a8a, 0xffd23a, 0xffffff, 0xc87aff][n % 4]), 0.16, 0.16, 0.16, Math.cos(n) * 0.7, 0.3, Math.sin(n * 1.7) * 0.7);
      } else {
        ball(g, paint(0x3fa84a), 0.9, 0.6, 0.9, 0, 0.4, 0);
      }
    } else if (biome === "desert") {
      if (pick < 0.5) {
        piece(g, new THREE.CylinderGeometry(0.35, 0.4, 3, 7), paint(0x4a9a4a), 0, 1.5, 0);
        piece(g, new THREE.CylinderGeometry(0.2, 0.2, 1.2, 6), paint(0x4a9a4a), 0.7, 1.9, 0);
        piece(g, new THREE.CylinderGeometry(0.2, 0.2, 0.9, 6), paint(0x4a9a4a), -0.7, 1.5, 0);
      } else {
        ball(g, paint(0xb8643a), 1 + dice(), 0.7 + dice() * 0.8, 1 + dice(), 0, 0.4, 0);
      }
    } else if (biome === "snow") {
      if (pick < 0.65) {
        piece(g, new THREE.CylinderGeometry(0.2, 0.28, 1.4, 6), paint(0x5a4030), 0, 0.7, 0);
        piece(g, new THREE.ConeGeometry(1.5, 2.6, 7), paint(0x2a6a4a), 0, 2.4, 0);
        piece(g, new THREE.ConeGeometry(1.1, 2.2, 7), paint(0xf4f8ff), 0, 3.6, 0);
      } else {
        piece(g, new THREE.OctahedronGeometry(0.9, 0), paint(0xbfe8ff, 0x1a4a5a), 0, 0.6, 0).scale.y = 1.5;
      }
    } else {
      if (pick < 0.5) {
        piece(g, new THREE.CylinderGeometry(0.3, 0.7, 4.5, 6), paint(0x4a3a2a), 0, 2.25, 0);
        ball(g, paint(0x3a6a3a), 2.2, 1.2, 2.2, 0, 4.8, 0);
      } else {
        for (let n = 0; n < 6; n++) piece(g, new THREE.ConeGeometry(0.1, 2 + dice(), 4), paint(0xa8b85a), Math.cos(n) * 0.4, 1, Math.sin(n) * 0.4);
        ball(g, paint(0x3a7a9a), 1.3, 0.05, 1.3, 0, 0.06, 0);
      }
    }
    return g;
  };
  let placed = 0;
  while (placed < 200) {
    const i = 28 + Math.floor(dice() * (SIZE - 28));
    const k = Math.floor(dice() * SIZE);
    if (wild[i + "," + k] || (Math.abs(i - GATE.i) < 7 && k > 66)) continue;
    const model = shade(makeWild(biomeAt(i, k)));
    model.position.set(mid(i) + (dice() - 0.5) * 2, 0, mid(k) + (dice() - 0.5) * 2);
    model.rotation.y = dice() * 6;
    scene.add(model);
    wild[i + "," + k] = model;
    placed++;
  }

  // The pier where the visitors' ferry ties up
  piece(scene, new THREE.BoxGeometry(TILE, 0.4, 46), paint(0x9a7a4a), mid(GATE.i), 0.05, HALF + 23);
  for (let z = 6; z < 46; z += 8) for (const s of [-1, 1]) piece(scene, new THREE.CylinderGeometry(0.25, 0.25, 4, 6), paint(0x6a4a2a), mid(GATE.i) + s * 2, -1, HALF + z);
  const ferry = new THREE.Group();
  ferry.position.set(mid(GATE.i) + 7, -0.5, HALF + 38);
  piece(ferry, new THREE.BoxGeometry(7, 2.4, 18), paint(0xf4f4f4), 0, 1, 0);
  piece(ferry, new THREE.BoxGeometry(5, 2, 9), paint(0xd8443a), 0, 3, -1);
  piece(ferry, new THREE.CylinderGeometry(0.7, 0.7, 2.6, 8), paint(0x2a2a30), 0, 5, 1);
  scene.add(shade(ferry));

  // Your camp: a tent, a crate of darts, and a round pad for the helicopter
  const camp = new THREE.Group();
  camp.position.set(mid(CAMP.i) - 9, 0, mid(CAMP.k));
  piece(camp, new THREE.ConeGeometry(3, 2.6, 4), paint(0xd8b070), 0, 1.3, 0).rotation.y = Math.PI / 4;
  piece(camp, new THREE.BoxGeometry(1.3, 0.9, 1), paint(0x9a6a3a), 4, 0.45, 1.5);
  piece(camp, new THREE.BoxGeometry(1.34, 0.2, 1.04), bright(0xffe14a), 4, 0.6, 1.5);
  scene.add(shade(camp));
  const padSpot = piece(scene, new THREE.CylinderGeometry(6, 6, 0.16, 20), paint(0x5a6a78), mid(HELIPAD.i), 0.08, mid(HELIPAD.k));
  padSpot.receiveShadow = true;
  piece(scene, new THREE.BoxGeometry(0.6, 0.05, 4), bright(0xffffff), mid(HELIPAD.i) - 1.3, 0.18, mid(HELIPAD.k));
  piece(scene, new THREE.BoxGeometry(0.6, 0.05, 4), bright(0xffffff), mid(HELIPAD.i) + 1.3, 0.18, mid(HELIPAD.k));
  piece(scene, new THREE.BoxGeometry(2.6, 0.05, 0.6), bright(0xffffff), mid(HELIPAD.i), 0.18, mid(HELIPAD.k));
})();

// Draw one forest tree (or make it vanish, when it has been cleared)
function drawTree(tree, here) {
  const big = here ? 1 : 0.0001;
  helper.rotation.set(0, tree.x, 0);
  helper.position.set(tree.x, 0, tree.z);
  helper.scale.set(tree.r * big, tree.high * big, tree.r * big);
  helper.updateMatrix();
  trunkMesh.setMatrixAt(tree.slot, helper.matrix);
  const tint = new THREE.Color(tree.tint);
  for (let n = 0; n < 2; n++) {
    helper.position.set(tree.x + (n ? tree.wide * 0.35 : 0), tree.high * (n ? 0.86 : 1), tree.z + (n ? tree.wide * 0.2 : 0));
    helper.scale.set(tree.wide * (n ? 0.75 : 1) * big, tree.wide * 0.75 * (n ? 0.75 : 1) * big, tree.wide * (n ? 0.75 : 1) * big);
    helper.updateMatrix();
    leafMesh.setMatrixAt(tree.slot * 2 + n, helper.matrix);
    leafMesh.setColorAt(tree.slot * 2 + n, tint);
  }
  trunkMesh.instanceMatrix.needsUpdate = leafMesh.instanceMatrix.needsUpdate = true;
  if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
}

// Cut a tree down for good
function fellTree(tree) {
  tree.gone = true;
  delete treeAt[tree.i + "," + tree.k];
  drawTree(tree, false);
  state.felled.push(tree.i + "," + tree.k);
}

// Smoke from the volcano, and clouds
const smokePuffs = [];
for (let i = 0; i < 7; i++) {
  smokePuffs.push(ball(scene, new THREE.MeshBasicMaterial({ color: 0xd8d0c8, transparent: true, opacity: 0.7, fog: false }), 20, 14, 20, VOLCANO.x, 0, VOLCANO.z));
}
const clouds = sprinkle(ballShape, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }), (function () {
  const list = [];
  for (let i = 0; i < 18; i++) list.push({ x: (dice() - 0.5) * 1400, y: 190 + dice() * 70, z: (dice() - 0.5) * 1400, sx: 40 + dice() * 40, sy: 9, sz: 26 + dice() * 20 });
  return list;
})());

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
  pen.font = "bold 70px Georgia, serif";
  pen.textAlign = "center";
  pen.fillText("FOSSIL BAY 3", 256, 88);
  const sign = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) });
  piece(gate, new THREE.PlaneGeometry(13, 3), sign, 0, 11, 0.65);
  piece(gate, new THREE.PlaneGeometry(13, 3), sign, 0, 11, -0.65).rotation.y = Math.PI;
  scene.add(shade(gate));
})();

// ===== 5. Dinosaurs =====
// Every dinosaur is built with its nose pointing along "minus z" and its feet on the ground.
// The model comes back with its moving parts, so the game can make it walk.

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

function makeBase(kind) {
  const g = new THREE.Group();
  const legs = [];
  const eye = bright(0xfff4a0);
  let tail;
  let head = new THREE.Group();
  let jaw = null;

  if (kind === "para") {
    const skin = paint(0xd98a3a);
    const belly = paint(0xf0d8a0);
    ball(g, skin, 1.1, 1.2, 2.4, 0, 2.6, 0.3);
    ball(g, belly, 0.9, 0.9, 2, 0, 2.2, 0.3);
    tail = makeTail(g, skin, 4.2, 0.8, 0, 2.6, 2.3);
    head.position.set(0, 3.2, -1.8);
    piece(head, new THREE.CylinderGeometry(0.42, 0.6, 2.2, 7), skin, 0, 0.8, -0.6).rotation.x = -0.7;
    ball(head, skin, 0.5, 0.5, 0.95, 0, 1.8, -1.7);
    ball(head, belly, 0.4, 0.25, 0.5, 0, 1.6, -2.3);
    piece(head, new THREE.ConeGeometry(0.24, 2, 6), paint(0xc8402a), 0, 2.4, -0.8).rotation.x = 1.9;
    for (const s of [-1, 1]) piece(head, ballShape, eye, s * 0.42, 1.95, -1.9).scale.setScalar(0.1);
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, 2.2, 0.45, s * 0.8, 2.2, 0.8));
      legs.push(makeLeg(g, skin, 1.4, 0.22, s * 0.7, 2.3, -1.4));
    }
  } else if (kind === "tri") {
    const skin = paint(0x8a9a6a);
    const frill = paint(0xc8a04a);
    const horn = paint(0xf4ecd8);
    ball(g, skin, 1.5, 1.4, 2.6, 0, 2.1, 0.4);
    tail = makeTail(g, skin, 2.8, 0.8, 0, 2.1, 2.7);
    head.position.set(0, 2.2, -2.2);
    ball(head, skin, 0.9, 0.85, 1.3, 0, 0, -0.9);
    const disc = piece(head, new THREE.CylinderGeometry(1.6, 1.6, 0.25, 12), frill, 0, 0.8, 0.1);
    disc.rotation.x = Math.PI / 2 - 0.5;
    for (const s of [-1, 1]) {
      piece(head, new THREE.ConeGeometry(0.16, 1.5, 6), horn, s * 0.45, 0.75, -1.5).rotation.x = -1.1;
      piece(head, ballShape, eye, s * 0.75, 0.25, -1.3).scale.setScalar(0.11);
    }
    piece(head, new THREE.ConeGeometry(0.15, 0.7, 6), horn, 0, 0.3, -2.1).rotation.x = -0.8;
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, 1.5, 0.42, s * 1, 1.5, -1));
      legs.push(makeLeg(g, skin, 1.5, 0.46, s * 1, 1.5, 1.7));
    }
  } else if (kind === "steg") {
    const skin = paint(0x5a9a4a);
    const plate = paint(0xe8823a);
    ball(g, skin, 1.3, 1.6, 2.8, 0, 2.3, 0.2);
    tail = makeTail(g, skin, 3.8, 0.8, 0, 2.1, 2.7);
    for (const s of [-1, 1]) {
      piece(tail, new THREE.ConeGeometry(0.12, 1.1, 5), paint(0xf4ecd8), s * 0.4, 0.3, 3.1).rotation.z = s * -1.1;
      piece(tail, new THREE.ConeGeometry(0.12, 1.1, 5), paint(0xf4ecd8), s * 0.4, 0.3, 3.6).rotation.z = s * -1.1;
    }
    for (let i = 0; i < 9; i++) {
      const z = -1.9 + i * 0.6;
      const p = piece(g, new THREE.ConeGeometry(0.62, 1.3 - Math.abs(i - 4) * 0.13, 4), plate, (i % 2 ? 0.2 : -0.2), 3.95 - Math.pow(z - 0.2, 2) * 0.13, z);
      p.scale.x = 0.25;
    }
    head.position.set(0, 1.7, -2.6);
    ball(head, skin, 0.55, 0.55, 0.9, 0, 0, 0);
    ball(head, skin, 0.36, 0.34, 0.75, 0, -0.25, -1);
    for (const s of [-1, 1]) piece(head, ballShape, eye, s * 0.3, -0.1, -1.2).scale.setScalar(0.08);
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, 1.3, 0.36, s * 0.9, 1.3, -1.4));
      legs.push(makeLeg(g, skin, 1.9, 0.46, s * 0.95, 1.9, 1.6));
    }
  } else if (kind === "raptor") {
    const skin = paint(0x3a9a9a);
    const stripe = paint(0x1f5a6a);
    ball(g, skin, 0.45, 0.5, 1.05, 0, 1.45, 0.1);
    ball(g, stripe, 0.3, 0.2, 0.8, 0, 1.85, 0.2);
    tail = makeTail(g, skin, 2.4, 0.3, 0, 1.5, 1);
    head.position.set(0, 1.7, -0.8);
    piece(head, new THREE.CylinderGeometry(0.17, 0.26, 0.9, 6), skin, 0, 0.3, -0.2).rotation.x = -0.6;
    ball(head, skin, 0.24, 0.24, 0.5, 0, 0.7, -0.75);
    for (let i = 0; i < 3; i++) piece(head, new THREE.ConeGeometry(0.07, 0.4, 4), paint(0xff5a3a), 0, 1 - i * 0.05, -0.5 + i * 0.2).rotation.x = 0.6;
    jaw = new THREE.Group();
    jaw.position.set(0, 0.6, -0.5);
    ball(jaw, stripe, 0.18, 0.07, 0.42, 0, 0, -0.42);
    head.add(jaw);
    for (const s of [-1, 1]) piece(head, ballShape, eye, s * 0.2, 0.8, -0.85).scale.setScalar(0.06);
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, 1.3, 0.16, s * 0.3, 1.3, 0.3));
      legs.push(makeLeg(g, skin, 0.6, 0.08, s * 0.35, 1.4, -0.6));
    }
  } else if (kind === "brach") {
    const skin = paint(0x7a8aa0);
    const belly = paint(0xb8c4d0);
    ball(g, skin, 2.6, 2.6, 4.2, 0, 5.2, 0.5);
    ball(g, belly, 2.2, 2, 3.6, 0, 4.4, 0.5);
    tail = makeTail(g, skin, 7.5, 1.4, 0, 4.8, 4.2);
    head.position.set(0, 6.4, -3);
    piece(head, new THREE.CylinderGeometry(0.6, 1, 8.4, 8), skin, 0, 3.7, -1.8).rotation.x = -0.45;
    ball(head, skin, 0.7, 0.62, 1.1, 0, 7.6, -4.1);
    ball(head, skin, 0.45, 0.4, 0.5, 0, 8.1, -3.8);
    for (const s of [-1, 1]) piece(head, ballShape, eye, s * 0.55, 7.8, -4.4).scale.setScalar(0.12);
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, 4.4, 0.75, s * 1.7, 4.4, -2.2));
      legs.push(makeLeg(g, skin, 3.9, 0.8, s * 1.7, 3.9, 2.6));
    }
  } else if (kind === "galli") {
    // Gallimimus: built like an ostrich, and just as fast
    const skin = paint(0xd8b070);
    const stripe = paint(0x7a5a3a);
    ball(g, skin, 0.6, 0.65, 1.3, 0, 2.3, 0.1);
    ball(g, stripe, 0.4, 0.25, 1, 0, 2.75, 0.2);
    tail = makeTail(g, skin, 3, 0.4, 0, 2.35, 1.2);
    head.position.set(0, 2.6, -1);
    piece(head, new THREE.CylinderGeometry(0.14, 0.24, 1.9, 6), skin, 0, 0.8, -0.35).rotation.x = -0.4;
    ball(head, skin, 0.22, 0.2, 0.4, 0, 1.75, -0.9);
    ball(head, paint(0xf0d060), 0.1, 0.07, 0.25, 0, 1.7, -1.3);
    for (const s of [-1, 1]) piece(head, ballShape, eye, s * 0.18, 1.82, -1).scale.setScalar(0.06);
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, 2.1, 0.17, s * 0.4, 2.1, 0.3));
      legs.push(makeLeg(g, skin, 0.8, 0.08, s * 0.45, 2.2, -0.8));
    }
  } else if (kind === "pachy") {
    // Pachycephalosaurus: a thick bony dome on its head, for head-butting
    const skin = paint(0x6a7ab0);
    const dome = paint(0xe8c86a);
    ball(g, skin, 0.8, 0.9, 1.6, 0, 2.2, 0.2);
    tail = makeTail(g, skin, 3.2, 0.6, 0, 2.2, 1.6);
    head.position.set(0, 2.7, -1.3);
    piece(head, new THREE.CylinderGeometry(0.3, 0.42, 1.1, 6), skin, 0, 0.4, -0.25).rotation.x = -0.5;
    ball(head, skin, 0.42, 0.4, 0.6, 0, 1, -0.75);
    ball(head, dome, 0.4, 0.36, 0.44, 0, 1.3, -0.65);
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.6;
      piece(head, new THREE.ConeGeometry(0.07, 0.25, 4), dome, Math.sin(a) * 0.4, 1.15, -0.3 + Math.abs(a) * 0.12).rotation.x = 1.2;
    }
    for (const s of [-1, 1]) piece(head, ballShape, eye, s * 0.36, 1.05, -1.05).scale.setScalar(0.07);
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, 2, 0.3, s * 0.55, 2, 0.5));
      legs.push(makeLeg(g, skin, 0.8, 0.12, s * 0.55, 2.1, -0.9));
    }
  } else if (kind === "anky") {
    // Ankylosaurus: a walking tank, with armour, spikes and a club on its tail
    const skin = paint(0x9a8a5a);
    const armour = paint(0x6a5a3a);
    const spike = paint(0xe8dcc0);
    ball(g, skin, 1.7, 1, 2.6, 0, 1.5, 0.2);
    ball(g, armour, 1.6, 0.65, 2.4, 0, 2, 0.2);
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) {
        piece(g, new THREE.ConeGeometry(0.18, 0.75, 5), spike, s * 1.55, 1.9, -1.6 + i * 0.72).rotation.z = s * -1.1;
        ball(g, spike, 0.2, 0.14, 0.2, s * 0.6, 2.62, -1.5 + i * 0.7);
      }
    }
    tail = makeTail(g, skin, 2.8, 0.5, 0, 1.4, 2.6);
    ball(tail, armour, 0.65, 0.45, 0.75, 0, 0, 3);
    head.position.set(0, 1.4, -2.5);
    ball(head, skin, 0.6, 0.45, 0.75, 0, 0, -0.4);
    for (const s of [-1, 1]) {
      piece(head, new THREE.ConeGeometry(0.12, 0.4, 4), spike, s * 0.5, 0.3, 0).rotation.z = s * -0.9;
      piece(head, ballShape, eye, s * 0.45, 0.12, -0.8).scale.setScalar(0.07);
      legs.push(makeLeg(g, skin, 1, 0.38, s * 1.1, 1, -1.3));
      legs.push(makeLeg(g, skin, 1, 0.4, s * 1.1, 1, 1.5));
    }
  } else if (kind === "dilo") {
    // Dilophosaurus: a meat-eater with two thin crests on its head
    const skin = paint(0x6a9a3a);
    const crest = paint(0xffd23a);
    ball(g, skin, 0.8, 0.85, 1.8, 0, 2.4, 0.2);
    ball(g, paint(0xc8d88a), 0.6, 0.6, 1.4, 0, 2.1, 0.1);
    tail = makeTail(g, skin, 4, 0.6, 0, 2.4, 1.8);
    head.position.set(0, 2.9, -1.5);
    piece(head, new THREE.CylinderGeometry(0.26, 0.4, 1.4, 6), skin, 0, 0.5, -0.35).rotation.x = -0.6;
    ball(head, skin, 0.36, 0.34, 0.8, 0, 1.2, -1);
    for (const s of [-1, 1]) {
      ball(head, crest, 0.04, 0.32, 0.5, s * 0.17, 1.58, -0.9);
      piece(head, ballShape, eye, s * 0.3, 1.3, -1.2).scale.setScalar(0.07);
    }
    jaw = new THREE.Group();
    jaw.position.set(0, 1.05, -0.75);
    ball(jaw, paint(0xc8d88a), 0.3, 0.1, 0.65, 0, 0, -0.55);
    head.add(jaw);
    for (const s of [-1, 1]) {
      legs.push(makeLeg(g, skin, 2.2, 0.28, s * 0.5, 2.2, 0.4));
      legs.push(makeLeg(g, skin, 0.8, 0.1, s * 0.55, 2.2, -1.1));
    }
  } else if (kind === "carno") {
    // Carnotaurus: the "meat-eating bull", with a horn over each eye and very tiny arms
    const skin = paint(0xb8502a);
    const belly = paint(0xe8c8a0);
    ball(g, skin, 1.2, 1.35, 2.5, 0, 3.3, 0.3);
    ball(g, belly, 1, 1, 2, 0, 2.9, 0.1);
    for (let i = 0; i < 7; i++) ball(g, paint(0x5a2a1a), 0.22, 0.1, 0.22, (i % 2 ? 0.5 : -0.5), 4.45 - Math.abs(i - 3) * 0.12, -1.2 + i * 0.5);
    tail = makeTail(g, skin, 5.2, 1, 0, 3.3, 2.5);
    head.position.set(0, 4, -2.1);
    ball(head, skin, 0.7, 0.8, 0.9, 0, 0, -0.1);
    ball(head, skin, 0.7, 0.75, 1, 0, 0.5, -1);
    jaw = new THREE.Group();
    jaw.position.set(0, 0.2, -0.5);
    ball(jaw, belly, 0.6, 0.22, 0.9, 0, -0.1, -0.6);
    head.add(jaw);
    for (let i = 0; i < 5; i++) {
      for (const s of [-1, 1]) piece(head, new THREE.ConeGeometry(0.08, 0.34, 4), paint(0xffffff), s * 0.48, 0.05, -0.8 - i * 0.24).rotation.x = Math.PI;
    }
    for (const s of [-1, 1]) {
      piece(head, new THREE.ConeGeometry(0.17, 0.75, 5), paint(0xf4ecd8), s * 0.5, 1.3, -0.8).rotation.z = s * -0.55;
      piece(head, ballShape, eye, s * 0.58, 0.85, -1.1).scale.setScalar(0.1);
      legs.push(makeLeg(g, skin, 3, 0.5, s * 0.8, 3, 0.5));
      legs.push(makeLeg(g, skin, 0.5, 0.1, s * 0.8, 3, -1.5));
    }
  } else if (kind === "spino") {
    // Spinosaurus: the biggest meat-eater of all, with a sail on its back and a snout like a crocodile
    const skin = paint(0x4a7a8a);
    const belly = paint(0xd8d0a8);
    const sail = paint(0xe8663a);
    ball(g, skin, 1.6, 1.7, 3.6, 0, 4.2, 0.3);
    ball(g, belly, 1.3, 1.3, 3, 0, 3.7, 0.1);
    ball(g, sail, 0.12, 2.7, 3.2, 0, 6.2, 0.4);
    for (let i = 0; i < 7; i++) piece(g, new THREE.BoxGeometry(0.16, 4.2 - Math.abs(i - 3) * 0.75, 0.1), paint(0xa8401a), 0, 6.7 - Math.abs(i - 3) * 0.2, -2 + i * 0.8);
    tail = makeTail(g, skin, 7.5, 1.2, 0, 4.1, 3.5);
    head.position.set(0, 4.8, -3);
    ball(head, skin, 0.8, 0.9, 1.2, 0, 0, -0.2);
    ball(head, skin, 0.6, 0.55, 2, 0, 0.5, -2);
    ball(head, sail, 0.08, 0.3, 0.5, 0, 1.05, -1.3);
    jaw = new THREE.Group();
    jaw.position.set(0, 0.2, -0.8);
    ball(jaw, belly, 0.5, 0.2, 1.7, 0, -0.1, -1.2);
    head.add(jaw);
    for (let i = 0; i < 8; i++) {
      for (const s of [-1, 1]) piece(head, new THREE.ConeGeometry(0.08, 0.36, 4), paint(0xffffff), s * 0.42, 0.02, -1.4 - i * 0.3).rotation.x = Math.PI;
    }
    for (const s of [-1, 1]) {
      piece(head, ballShape, eye, s * 0.5, 0.85, -1.5).scale.setScalar(0.11);
      legs.push(makeLeg(g, skin, 3.7, 0.62, s * 1.1, 3.7, 0.8));
      legs.push(makeLeg(g, skin, 1.6, 0.25, s * 1.1, 3.6, -2.2));
    }
  } else if (kind === "mosa") {
    // Mosasaurus: a sea monster as long as a bus, with paddles for legs
    const skin = paint(0x2a4a6a);
    const belly = paint(0xc8d8e0);
    ball(g, skin, 1.6, 1.5, 6, 0, 1.3, 0);
    ball(g, belly, 1.3, 1.1, 5.2, 0, 0.9, 0);
    for (let i = 0; i < 6; i++) piece(g, new THREE.ConeGeometry(0.4, 0.9, 4), skin, 0, 2.8, -3 + i * 1.3).scale.x = 0.3;
    tail = makeTail(g, skin, 7, 1.1, 0, 1.3, 5);
    piece(tail, new THREE.BoxGeometry(0.2, 3.4, 2.2), skin, 0, 0, 6.4);
    head.position.set(0, 1.4, -5.2);
    ball(head, skin, 1.1, 0.9, 2.2, 0, 0.2, -1.6);
    jaw = new THREE.Group();
    jaw.position.set(0, -0.1, -0.4);
    ball(jaw, belly, 0.9, 0.3, 2, 0, -0.2, -1.5);
    head.add(jaw);
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) piece(head, new THREE.ConeGeometry(0.1, 0.45, 4), paint(0xffffff), s * 0.7, -0.35, -1 - i * 0.38).rotation.x = Math.PI;
    }
    for (const s of [-1, 1]) {
      piece(head, ballShape, eye, s * 0.85, 0.6, -1.4).scale.setScalar(0.14);
      for (const z of [-2.6, 2.4]) {
        const flipper = new THREE.Group();
        flipper.position.set(s * 1.4, 0.8, z);
        ball(flipper, skin, 1.5, 0.16, 0.7, s * 1.3, -0.3, 0.3);
        g.add(flipper);
        legs.push(flipper);
      }
    }
  } else if (kind === "plesio") {
    // Plesiosaurus: a round body, four flippers, and a very long neck
    const skin = paint(0x3a8a8a);
    const belly = paint(0xe8e0c0);
    ball(g, skin, 2, 1.3, 3, 0, 1.2, 0);
    ball(g, belly, 1.7, 1, 2.6, 0, 0.8, 0);
    tail = makeTail(g, skin, 3, 0.8, 0, 1.2, 2.6);
    head.position.set(0, 1.6, -2.4);
    piece(head, new THREE.CylinderGeometry(0.3, 0.6, 6, 7), skin, 0, 1.3, -2.6).rotation.x = -1.1;
    ball(head, skin, 0.42, 0.36, 0.75, 0, 2.7, -5.4);
    for (const s of [-1, 1]) {
      piece(head, ballShape, eye, s * 0.34, 2.85, -5.6).scale.setScalar(0.08);
      for (const z of [-1.4, 1.6]) {
        const flipper = new THREE.Group();
        flipper.position.set(s * 1.8, 0.8, z);
        ball(flipper, skin, 1.6, 0.14, 0.6, s * 1.4, -0.3, 0.3);
        g.add(flipper);
        legs.push(flipper);
      }
    }
  } else if (kind === "ptera") {
    // Pteranodon: a flying reptile with a long beak and a crest on the back of its head
    const skin = paint(0xc87a4a);
    ball(g, skin, 0.5, 0.5, 1.2, 0, 1, 0);
    tail = makeTail(g, skin, 0.9, 0.2, 0, 1, 1);
    head.position.set(0, 1.2, -1);
    ball(head, skin, 0.3, 0.3, 0.45, 0, 0.3, -0.4);
    piece(head, new THREE.ConeGeometry(0.16, 2, 5), paint(0xf0d060), 0, 0.25, -1.6).rotation.x = -Math.PI / 2;
    piece(head, new THREE.ConeGeometry(0.14, 1.5, 5), paint(0xd8442e), 0, 0.7, 0.5).rotation.x = Math.PI / 2 - 0.4;
    for (const s of [-1, 1]) piece(head, ballShape, eye, s * 0.26, 0.42, -0.6).scale.setScalar(0.06);
    g.userData.wings = [];
    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(s * 0.4, 1.1, -0.1);
      piece(wing, new THREE.BoxGeometry(3.2, 0.07, 1.5), skin, s * 1.6, 0, 0.2);
      piece(wing, new THREE.BoxGeometry(2.2, 0.06, 0.9), paint(0xe8a070), s * 4.1, 0, 0.5).rotation.y = s * -0.35;
      g.add(wing);
      g.userData.wings.push({ group: wing, side: s });
      legs.push(makeLeg(g, skin, 0.6, 0.07, s * 0.2, 0.6, 0.6));
    }
  } else {
    const skin = paint(0x8a4a32);
    const belly = paint(0xd8b890);
    const tooth = paint(0xffffff);
    ball(g, skin, 1.5, 1.7, 3, 0, 4, 0.3);
    ball(g, belly, 1.2, 1.3, 2.4, 0, 3.5, 0);
    tail = makeTail(g, skin, 6.4, 1.2, 0, 4, 2.9);
    head.position.set(0, 4.8, -2.4);
    ball(head, skin, 0.9, 1, 1.1, 0, 0, -0.2);
    ball(head, skin, 0.95, 0.75, 1.6, 0, 0.6, -1.5);
    jaw = new THREE.Group();
    jaw.position.set(0, 0.15, -0.6);
    ball(jaw, belly, 0.8, 0.3, 1.35, 0, -0.15, -0.95);
    head.add(jaw);
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) {
        piece(head, new THREE.ConeGeometry(0.1, 0.42, 4), tooth, s * 0.62, 0.02, -1 - i * 0.28).rotation.x = Math.PI;
        if (i % 2) piece(jaw, new THREE.ConeGeometry(0.09, 0.36, 4), tooth, s * 0.55, 0.2, -0.6 - i * 0.24);
      }
    }
    for (const s of [-1, 1]) {
      piece(head, ballShape, eye, s * 0.72, 1, -1.2).scale.setScalar(0.13);
      legs.push(makeLeg(g, skin, 3.6, 0.6, s * 1, 3.6, 0.6));
      legs.push(makeLeg(g, skin, 0.9, 0.14, s * 0.9, 3.5, -2));
    }
  }
  g.add(head);
  return { group: g, legs: legs, tail: tail, head: head, jaw: jaw };
}

// Many dinosaurs are built from another one's shape, with new colours and a few changes.
//   base = whose shape to start from. size = how much bigger or smaller.
//   swap = colours to change. hide = which bits to take off. tilt = how far to lower the neck.
const LOOKS = {
  proto:  { base: "tri",    size: 0.5,  swap: { 0x8a9a6a: 0xc8a070, 0xc8a04a: 0xa85a3a }, hide: function (m) { return m.geometry.type === "ConeGeometry" && m.geometry.parameters.height < 2; } },
  styra:  { base: "tri",    size: 0.92, swap: { 0x8a9a6a: 0xa8623a, 0xc8a04a: 0xe8b04a }, hide: function (m) { return m.geometry.type === "ConeGeometry" && m.geometry.parameters.height === 1.5; } },
  pachyr: { base: "tri",    size: 1,    swap: { 0x8a9a6a: 0x8a7a6a, 0xc8a04a: 0xe8ecf2 }, hide: function (m) { return m.geometry.type === "ConeGeometry" && m.geometry.parameters.height < 2; } },
  igua:   { base: "para",   size: 1.15, swap: { 0xd98a3a: 0x5a8a4a, 0xf0d8a0: 0xc8d8a0 }, hide: function (m) { return m.material.color.getHex() === 0xc8402a; } },
  troo:   { base: "raptor", size: 0.8,  swap: { 0x3a9a9a: 0xdfe6ee, 0x1f5a6a: 0x8a96a8 } },
  cryo:   { base: "dilo",   size: 1.25, swap: { 0x6a9a3a: 0x4a6a9a, 0xc8d88a: 0xc8d8e8 }, hide: function (m) { return m.material.color.getHex() === 0xffd23a; } },
  bary:   { base: "spino",  size: 0.72, swap: { 0x4a7a8a: 0x5a7a4a }, hide: function (m) { const c = m.material.color.getHex(); return c === 0xe8663a || c === 0xa8401a; } },
  diplo:  { base: "brach",  size: 0.95, swap: { 0x7a8aa0: 0xb89a6a, 0xb8c4d0: 0xe0d0a8 }, tilt: -0.8 },
  allo:   { base: "rex",    size: 0.82, swap: { 0x8a4a32: 0xc8743a, 0xd8b890: 0x8a9aa8 } },
  yuty:   { base: "rex",    size: 0.9,  swap: { 0x8a4a32: 0xe8ecf2, 0xd8b890: 0xb8c4d0 } },
};

// Build the model of any kind of dinosaur
function makeDino(kind) {
  const look = LOOKS[kind];
  const model = makeBase(look ? look.base : kind);
  model.tilt = 0;
  model.wings = model.group.userData.wings || null;
  if (look) {
    model.group.traverse(function (part) {
      if (!part.isMesh) return;
      if (look.hide && look.hide(part)) part.visible = false;
      const to = look.swap[part.material.color.getHex()];
      if (to !== undefined) part.material = paint(to);
    });
    const head = model.head;
    if (kind === "styra") {
      // A crown of spikes round the frill, and one long horn on the nose
      for (let n = 0; n < 6; n++) {
        const a = (n - 2.5) * 0.42;
        piece(head, new THREE.ConeGeometry(0.14, 1.2, 5), paint(0xf4ecd8), Math.sin(a) * 1.5, 1.1 + Math.cos(a) * 1.3, 0.75).rotation.z = -a;
      }
      piece(head, new THREE.ConeGeometry(0.17, 1.5, 6), paint(0xf4ecd8), 0, 0.7, -2).rotation.x = -0.5;
    } else if (kind === "pachyr") {
      ball(head, paint(0xc8b8a0), 0.45, 0.3, 0.65, 0, 0.5, -1.7);   // a bony lump where the horn would be
      for (const s of [-1, 1]) piece(head, new THREE.ConeGeometry(0.13, 0.9, 5), paint(0xf4ecd8), s * 0.5, 2.3, 0.7).rotation.z = s * -0.4;
    } else if (kind === "cryo") {
      ball(head, paint(0xff7a3a), 0.5, 0.36, 0.06, 0, 1.68, -0.95);  // a crest that runs from side to side
    } else if (kind === "allo") {
      for (const s of [-1, 1]) piece(head, new THREE.ConeGeometry(0.14, 0.5, 4), paint(0xd8442e), s * 0.55, 1.35, -1);
    } else if (kind === "yuty") {
      // Fluffy feathers, to keep warm in the snow
      for (let n = 0; n < 9; n++) ball(model.group, paint(0xf8faff), 0.9 - n * 0.04, 0.5, 0.8, 0, 5.5 - Math.abs(n - 3) * 0.14, -2 + n * 0.8);
      ball(head, paint(0xf8faff), 0.7, 0.5, 0.8, 0, 1.1, -0.2);
    } else if (kind === "igua") {
      for (const s of [-1, 1]) piece(model.group, new THREE.ConeGeometry(0.1, 0.5, 4), paint(0xf4ecd8), s * 0.7, 1, -1.5);   // thumb spikes
    }
    model.tilt = look.tilt || 0;
    // Wrap it in an outer group, so the game can still grow it from a baby
    const outer = new THREE.Group();
    model.group.scale.setScalar(look.size);
    outer.add(model.group);
    model.group = outer;
  }
  shade(model.group);
  return model;
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
const MAX_GUESTS = 90;
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
