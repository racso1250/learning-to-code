// Fossil Bay: the scene.
// The valley, the jungle hills, the volcano, the park gate, and all the models:
// twelve kinds of dinosaur, the ranger jeep, the helicopter and the visitors.

// ===== 1. Setting up =====
const canvas = document.getElementById("game");
const testing = location.search.includes("test");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const SKY = new THREE.Color(0xa8dcf0);
scene.fog = new THREE.Fog(0xa8dcf0, 220, 700);
const camera = new THREE.PerspectiveCamera(50, 1.5, 0.5, 1500);
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

const skyLight = new THREE.HemisphereLight(0xffffff, 0x4a6a3a, 0.6);
scene.add(skyLight);
const sunLight = new THREE.DirectionalLight(0xfff4d8, 0.6);
sunLight.position.set(-0.5, 1, 0.4);
scene.add(sunLight);

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

// ===== 3. The valley =====
// The park is flat. Around it, jungle hills climb up on every side.
function hillAt(x, z) {
  const out = Math.max(Math.abs(x), Math.abs(z)) - HALF - 10;
  if (out <= 0) return 0;
  const lumps = Math.sin(x * 0.031) * Math.cos(z * 0.027) + Math.sin(x * 0.011 + z * 0.017);
  return smooth(out / 70) * (26 + lumps * 12) + smooth((out - 60) / 160) * 40;
}

(function () {
  const shape = new THREE.PlaneGeometry(1100, 1100, 110, 110);
  shape.rotateX(-Math.PI / 2);
  const spots = shape.attributes.position;
  const colours = new Float32Array(spots.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < spots.count; i++) {
    const x = spots.getX(i);
    const z = spots.getZ(i);
    const y = hillAt(x, z);
    spots.setY(i, y);
    const patch = 0.5 + 0.5 * Math.sin(x * 0.09 + Math.cos(z * 0.07) * 2) * Math.cos(z * 0.08);
    colour.setHex(y > 1 ? 0x2f8a4a : 0x6ac85a).lerp(new THREE.Color(y > 1 ? 0x1f6a3a : 0x8ad86a), patch);
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  shape.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  shape.computeVertexNormals();
  // A speckled picture, repeated all over the ground, so the grass doesn't look flat
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const pen = c.getContext("2d");
  pen.fillStyle = "#e6e6e6";
  pen.fillRect(0, 0, 128, 128);
  for (let n = 0; n < 500; n++) {
    pen.fillStyle = n % 3 ? "rgba(255,255,255,0.5)" : "rgba(120,150,110,0.5)";
    pen.fillRect(dice() * 128, dice() * 128, 2 + dice() * 3, 2 + dice() * 5);
  }
  const grass = new THREE.CanvasTexture(c);
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(90, 90);
  scene.add(new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ vertexColors: true, map: grass })));

  // A hedge round the edge of the park, with a gap for the gate
  const hedge = paint(0x2a7a3a);
  const edge = HALF + 0.8;
  piece(scene, new THREE.BoxGeometry(SIZE * TILE + 3, 1.4, 1.4), hedge, 0, 0.7, -edge);
  piece(scene, new THREE.BoxGeometry(1.4, 1.4, SIZE * TILE + 3), hedge, -edge, 0.7, 0);
  piece(scene, new THREE.BoxGeometry(1.4, 1.4, SIZE * TILE + 3), hedge, edge, 0.7, 0);
  const gap = mid(GATE.i);
  piece(scene, new THREE.BoxGeometry(HALF + gap - 6, 1.4, 1.4), hedge, (-HALF + gap - 6) / 2, 0.7, edge);
  piece(scene, new THREE.BoxGeometry(HALF - gap - 6, 1.4, 1.4), hedge, (HALF + gap + 6) / 2, 0.7, edge);

  // Jungle trees on the hills
  const trunk = new THREE.CylinderGeometry(0.5, 0.8, 1, 6);
  trunk.translate(0, 0.5, 0);
  const trees = [];
  while (trees.length < 420) {
    const x = (dice() - 0.5) * 760;
    const z = (dice() - 0.5) * 760;
    const y = hillAt(x, z);
    if (y < 1.5) continue;
    trees.push({ x: x, y: y, z: z, high: 9 + dice() * 12, wide: 5 + dice() * 5 });
  }
  sprinkle(trunk, paint(0x6a4a2a), trees.map(function (t) { return { x: t.x, y: t.y - 1, z: t.z, sx: 1, sy: t.high, sz: 1 }; }));
  sprinkle(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), trees.map(function (t) {
    return { x: t.x, y: t.y + t.high, z: t.z, sx: t.wide, sy: t.wide * 0.7, sz: t.wide, turn: dice() * 6, tint: [0x2a8a3a, 0x3aa04a, 0x1f7a3a, 0x4ab04a][Math.floor(dice() * 4)] };
  }));

  // A volcano far away to the north, with a glowing top
  const volcano = piece(scene, new THREE.CylinderGeometry(30, 190, 210, 14, 1, true), paint(0x5a4a48), 0, 100, -470);
  volcano.material.side = THREE.DoubleSide;
  piece(scene, new THREE.CylinderGeometry(29, 29, 2, 14), bright(0xff7a2a), 0, 203, -470);

  // The road that leads up to the gate
  piece(scene, new THREE.BoxGeometry(TILE, 0.1, 60), paint(0xd8c08a), mid(GATE.i), 0.03, HALF + 30);
})();

// Smoke from the volcano, and clouds
const smokePuffs = [];
for (let i = 0; i < 7; i++) {
  smokePuffs.push(ball(scene, new THREE.MeshBasicMaterial({ color: 0xd8d0c8, transparent: true, opacity: 0.7, fog: false }), 20, 14, 20, 0, 0, -470));
}
const clouds = sprinkle(ballShape, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }), (function () {
  const list = [];
  for (let i = 0; i < 16; i++) list.push({ x: (dice() - 0.5) * 1200, y: 170 + dice() * 60, z: (dice() - 0.5) * 1200, sx: 40 + dice() * 40, sy: 9, sz: 26 + dice() * 20 });
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
    // A burning torch on each post
    piece(gate, new THREE.ConeGeometry(0.8, 2, 6), bright(0xffb02a), side * 6, 14, 0);
  }
  piece(gate, new THREE.BoxGeometry(15, 3.4, 1.2), wood, 0, 11, 0);
  // The sign: words painted onto a picture
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const pen = c.getContext("2d");
  pen.fillStyle = "#3a2412";
  pen.fillRect(0, 0, 512, 128);
  pen.fillStyle = "#ffd76a";
  pen.font = "bold 76px Georgia, serif";
  pen.textAlign = "center";
  pen.fillText("FOSSIL BAY", 256, 90);
  const sign = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) });
  piece(gate, new THREE.PlaneGeometry(13, 3), sign, 0, 11, 0.65);
  piece(gate, new THREE.PlaneGeometry(13, 3), sign, 0, 11, -0.65).rotation.y = Math.PI;
  scene.add(gate);
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

function makeDino(kind) {
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
const jeepModel = new THREE.Group();
(function () {
  const green = paint(0x3a7a4a);
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
  scene.add(jeepModel);
})();

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
