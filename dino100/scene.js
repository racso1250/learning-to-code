// Dino Island 100: the scene.
// The huge island with its eight regions, the sea, the volcano, the park gate, and all the models:
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
// Wild plants are drawn with five shapes, each drawn many times: trunks, round leafy tops,
// pointed tops (for pines and roots), rocks, and flat patches (pools, lava and flowers).
const wildMesh = {};
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
    // Mix the colours of the regions all round this spot, so one region fades gently into the next
    const patch = 0.5 + 0.5 * Math.sin(x * 0.09 + Math.cos(z * 0.07) * 2) * Math.cos(z * 0.08);
    const ti = tileOf(x - 0.1);
    const tk = tileOf(z - 0.1);
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let di = -4; di <= 4; di += 4) {
      for (let dk = -4; dk <= 4; dk += 4) {
        const biome = biomeAt(clamp(ti + di, 0, SIZE - 1), clamp(tk + dk, 0, SIZE - 1));
        colour.setHex(BIOMES[biome].ground).lerp(other.setHex(BIOMES[biome].other), patch);
        red += colour.r / 9;
        green += colour.g / 9;
        blue += colour.b / 9;
      }
    }
    colour.setRGB(red, green, blue);
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

  // Wild plants. Every region grows its own: how many trees, rocks and flat patches a square
  // is likely to have, and what its trees look like. A tree can have a round top ("ball"),
  // a pointed top or roots ("cone"), or both.
  const GROWS = {
    meadow: { trees: 0.014, rocks: 0.002, flats: 0.035, flat: [0xff7ab8, 0xffe14a, 0xffffff, 0xc87aff], flatWide: 0.7,
      tree: { high: 2.8, thick: 0.26, bark: 0x6a4a2a, ball: { wide: 1.8, flat: 0.8, tints: [0x4ab85a, 0x3aa04a, 0x5ac860] } } },
    forest: { trees: 0.21, rocks: 0.004, flats: 0,
      tree: { high: 7, thick: 0.32, bark: 0x5a4030, ball: { wide: 2.5, flat: 0.8, tints: [0x2a7a32, 0x35883a, 0x1f6a2a] } },
      other: { high: 4.5, thick: 0.26, bark: 0x4a3424, cone: { wide: 1.9, high: 6, up: 1, tints: [0x1f5a2a, 0x2a6a32] } } },
    desert: { trees: 0.022, rocks: 0.03, rock: 0xb8643a, flats: 0,
      tree: { high: 2.4, thick: 0.38, bark: 0x4a9a4a, ball: { wide: 0.42, flat: 1, tints: [0x4a9a4a] } } },
    snow: { trees: 0.06, rocks: 0.015, rock: 0xbfe0f0, flats: 0.015, flat: [0xd8f0ff], flatWide: 1.6,
      tree: { high: 1.6, thick: 0.2, bark: 0x5a4030, cone: { wide: 1.7, high: 4.6, up: 1, tints: [0xf4f8ff, 0x9ac8b0, 0xdfeaf4] } } },
    swamp: { trees: 0.08, rocks: 0.003, flats: 0.07, flat: [0x3a6a7a, 0x4a7a6a], flatWide: 1.7,
      tree: { high: 3.8, thick: 0.3, bark: 0x4a4030, ball: { wide: 2.7, flat: 0.45, tints: [0x3a6a3a, 0x4a7a42] } } },
    ash: { trees: 0.03, rocks: 0.035, rock: 0x3a3234, flats: 0.03, flat: [0xff7a1a, 0xffb02a], flatWide: 1.1, glow: true,
      tree: { high: 4.2, thick: 0.2, bark: 0x2a2424, ball: { wide: 0.5, flat: 0.6, tints: [0x3a3030] } } },
    coast: { trees: 0.03, rocks: 0.01, rock: 0xd8c8a8, flats: 0,
      tree: { high: 5.8, thick: 0.17, bark: 0x9a7a4a, ball: { wide: 2.1, flat: 0.25, tints: [0x2f9a3a, 0x4ab04a] } } },
    mangrove: { trees: 0.17, rocks: 0, flats: 0.16, flat: [0x2f7a8a, 0x3a8a7a], flatWide: 1.9,
      tree: { high: 4.4, thick: 0.2, bark: 0x6a5a40, cone: { wide: 1.3, high: 1.9, up: 0, tints: [0x6a5a40] }, ball: { wide: 2.2, flat: 0.6, tints: [0x3a8a4a, 0x2f7a42, 0x4a9a52] } } },
  };
  const lists = { tree: [], rock: [], flat: [] };
  for (let i = 0; i < SIZE; i++) {
    for (let k = 0; k < SIZE; k++) {
      // (Plants spread a little way over a border: each square asks a nearby square what region it is in)
      const grow = GROWS[biomeAt(clamp(i + Math.round((dice() - 0.5) * 7), 0, SIZE - 1), clamp(k + Math.round((dice() - 0.5) * 7), 0, SIZE - 1))];
      const roll = dice();
      if (Math.abs(i - GATE.i) < 4 && k > SIZE - 8) continue;
      const spot = { x: mid(i) + (dice() - 0.5) * 2, z: mid(k) + (dice() - 0.5) * 2, shown: false };
      if (roll < grow.trees) {
        const style = grow.other && dice() < 0.3 ? grow.other : grow.tree;
        const big = 0.7 + dice() * 0.6;
        spot.kind = "tree";
        spot.high = style.high * big;
        spot.thick = style.thick * big;
        spot.bark = style.bark;
        if (style.ball) spot.ball = { wide: style.ball.wide * (0.8 + dice() * 0.5), flat: style.ball.flat, tint: style.ball.tints[Math.floor(dice() * style.ball.tints.length)] };
        if (style.cone) spot.cone = { wide: style.cone.wide * big, high: style.cone.high * big, up: style.cone.up, tint: style.cone.tints[Math.floor(dice() * style.cone.tints.length)] };
      } else if (roll < grow.trees + grow.rocks) {
        spot.kind = "rock";
        spot.wide = 0.6 + dice() * 1.2;
        spot.tint = grow.rock || 0x8a8a90;
      } else if (roll < grow.trees + grow.rocks + grow.flats) {
        spot.kind = "flat";
        spot.wide = grow.flatWide * (0.6 + dice() * 0.8);
        spot.tint = grow.flat[Math.floor(dice() * grow.flat.length)];
      } else {
        continue;
      }
      spot.slot = lists[spot.kind].length;
      lists[spot.kind].push(spot);
      wild[i + "," + k] = spot;
    }
  }
  const trunkShape = new THREE.CylinderGeometry(0.7, 1, 1, 6);
  trunkShape.translate(0, 0.5, 0);
  const coneShape = new THREE.ConeGeometry(1, 1, 7);
  coneShape.translate(0, 0.5, 0);
  const white = function () { return new THREE.MeshLambertMaterial({ color: 0xffffff }); };
  wildMesh.trunk = new THREE.InstancedMesh(trunkShape, white(), lists.tree.length);
  wildMesh.ball = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), white(), lists.tree.length);
  wildMesh.cone = new THREE.InstancedMesh(coneShape, white(), lists.tree.length);
  wildMesh.rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), white(), lists.rock.length);
  wildMesh.flat = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.06, 9), new THREE.MeshBasicMaterial({ color: 0xffffff }), lists.flat.length);
  for (const name in wildMesh) {
    wildMesh[name].frustumCulled = false;
    wildMesh[name].castShadow = name !== "flat";
    scene.add(wildMesh[name]);
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

// Show (or hide) the wild plant, rock or patch on one square
function showWild(key, on) {
  const w = wild[key];
  if (!w || w.shown === on) return;
  w.shown = on;
  const big = on ? 1 : 0.0001;
  // Put one copy of a shape in its place, in its colour
  function set(mesh, x, y, z, sx, sy, sz, tint) {
    helper.rotation.set(0, w.x, 0);
    helper.position.set(x, y, z);
    helper.scale.set(sx * big, sy * big, sz * big);
    helper.updateMatrix();
    mesh.setMatrixAt(w.slot, helper.matrix);
    mesh.setColorAt(w.slot, wildTint.setHex(tint));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  if (w.kind === "tree") {
    set(wildMesh.trunk, w.x, 0, w.z, w.thick, w.high, w.thick, w.bark);
    if (w.ball) set(wildMesh.ball, w.x, w.high + w.ball.wide * w.ball.flat * 0.5, w.z, w.ball.wide, w.ball.wide * w.ball.flat, w.ball.wide, w.ball.tint);
    else set(wildMesh.ball, w.x, 0, w.z, 0.0001, 0.0001, 0.0001, 0);
    if (w.cone) set(wildMesh.cone, w.x, w.cone.up ? w.high * 0.75 : 0, w.z, w.cone.wide, w.cone.high, w.cone.wide, w.cone.tint);
    else set(wildMesh.cone, w.x, 0, w.z, 0.0001, 0.0001, 0.0001, 0);
  } else if (w.kind === "rock") {
    set(wildMesh.rock, w.x, w.wide * 0.3, w.z, w.wide, w.wide * 0.7, w.wide, w.tint);
  } else {
    set(wildMesh.flat, w.x, 0.05, w.z, w.wide, 1, w.wide * 0.8, w.tint);
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
// With so many kinds, we can't build each one by hand. So there is ONE builder, and it reads each
// kind's "body plan", size, colours and list of features from data.js. A horn here, a sail there...
// Every dinosaur is built with its nose pointing along "minus z" and its feet on the ground.

// A leg: it swings from the hip. It has a fat thigh, a thinner shin, and a foot with claws.
function makeLeg(parent, material, long, thick, x, y, z, claws) {
  const hip = new THREE.Group();
  hip.position.set(x, y, z);
  ball(hip, material, thick * 1.3, long * 0.36, thick * 1.6, 0, -long * 0.26, 0);
  piece(hip, new THREE.CylinderGeometry(thick * 0.8, thick * 0.55, long * 0.62, 7), material, 0, -long * 0.67, 0);
  ball(hip, material, thick * 1, thick * 0.42, thick * 1.5, 0, -long + thick * 0.38, -thick * 0.6);
  if (claws) {
    const toes = piece(hip, new THREE.ConeGeometry(thick * 0.85, thick * 1.2, 3), claws, 0, -long + thick * 0.22, -thick * 2);
    toes.rotation.x = -Math.PI / 2;
    toes.scale.z = 0.3;
  }
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
  if (SPECIES[kind].plan === "M") return makeSwimmer(kind);
  if (SPECIES[kind].plan === "W") return makeFlyer(kind);
  const sp = SPECIES[kind];
  const plan = PLANS[sp.plan];
  const L = sp.size * BIG;
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
  // Eyes, each with a dark pupil
  const iris = has("redeyes") ? bright(0xff2a1a) : eye;
  const pupil = bright(0x1a1a1a);
  for (const s of [-1, 1]) {
    piece(head, ballShape, iris, s * hx * 0.82, hy0 + hy * 0.3, hz0 - hz * 0.2).scale.setScalar(hx * 0.22);
    piece(head, ballShape, pupil, s * hx * 0.97, hy0 + hy * 0.3, hz0 - hz * 0.26).scale.setScalar(hx * 0.11);
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
      legs.push(makeLeg(g, skin, hipH, thick, s * rx * 0.75, hipH, rz * 0.25, horn));
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

// A sea reptile: a long smooth body, four flippers, and a tail. Its features can give it
// a long swan neck (plesiosaurs), a huge head (pliosaurs), or a fin and a beak (ichthyosaurs).
function makeSwimmer(kind) {
  const sp = SPECIES[kind];
  const L = sp.size * BIG;
  const has = function (feat) { return sp.feats.includes(feat); };
  const g = new THREE.Group();
  const skin = paint(sp.a);
  const belly = paint(sp.b);
  const dark = paint(sp.c);
  const swan = has("swanneck");
  const rx = (swan ? 0.11 : 0.085) * L;
  const ry = (swan ? 0.085 : 0.075) * L;
  const rz = (swan ? 0.2 : 0.3) * L;
  ball(g, skin, rx, ry, rz, 0, ry, 0);
  ball(g, belly, rx * 0.88, ry * 0.8, rz * 0.9, 0, ry * 0.72, 0);
  for (let n = 0; n < 5; n++) ball(g, dark, rx * 1.02, ry * 0.7, rz * 0.06, 0, ry * 1.3, -rz * 0.6 + n * rz * 0.3);
  if (has("ridge")) ball(g, dark, 0.012 * L, 0.03 * L, rz * 0.9, 0, ry * 2, 0);
  if (has("fin")) piece(g, new THREE.ConeGeometry(0.05 * L, 0.12 * L, 4), dark, 0, ry * 2 + 0.04 * L, -rz * 0.1).scale.x = 0.25;
  // The neck and the head (they nod together)
  const head = new THREE.Group();
  head.position.set(0, ry * 1.1, -rz * 0.85);
  const neckLong = (swan ? 0.3 : 0.03) * L;
  const big = has("bighead") ? 1.6 : 1;
  const hx = (swan ? 0.028 : 0.055) * L * big;
  const hy = (swan ? 0.024 : 0.042) * L * big;
  const hz = (swan ? 0.05 : has("beak") ? 0.16 : 0.13) * L * big;
  if (swan) piece(head, new THREE.CylinderGeometry(hy, ry * 0.5, neckLong, 7), skin, 0, neckLong * 0.18, -neckLong / 2).rotation.x = -Math.PI / 2 + 0.36;
  const hy0 = swan ? neckLong * 0.36 : 0;
  const hz0 = -neckLong - hz * 0.6;
  ball(head, skin, hx, hy, hz, 0, hy0, hz0);
  for (const s of [-1, 1]) {
    piece(head, ballShape, bright(0xfff4a0), s * hx * 0.8, hy0 + hy * 0.45, hz0 + hz * 0.1).scale.setScalar(hx * 0.2);
    piece(head, ballShape, bright(0x1a1a1a), s * hx * 0.94, hy0 + hy * 0.45, hz0 + hz * 0.06).scale.setScalar(hx * 0.1);
  }
  const jaw = new THREE.Group();
  jaw.position.set(0, hy0 - hy * 0.35, hz0 + hz * 0.5);
  ball(jaw, belly, hx * 0.85, hy * 0.35, hz * 0.85, 0, -hy * 0.1, -hz * 0.75);
  head.add(jaw);
  for (let n = 0; n < 5; n++) {
    for (const s of [-1, 1]) piece(head, new THREE.ConeGeometry(hx * 0.09, hy * 0.5, 4), paint(0xffffff), s * hx * 0.6, hy0 - hy * 0.6, hz0 - hz * 0.1 - n * hz * 0.16).rotation.x = Math.PI;
  }
  g.add(head);
  // Flippers (they paddle the way legs walk)
  const legs = [];
  for (const s of [-1, 1]) {
    for (const z of [-0.5, 0.55]) {
      const flipper = new THREE.Group();
      flipper.position.set(s * rx * 0.85, ry * 0.6, z * rz);
      ball(flipper, dark, 0.09 * L, 0.012 * L, 0.04 * L, s * 0.08 * L, -0.01 * L, 0.02 * L);
      g.add(flipper);
      legs.push(flipper);
    }
  }
  const tailLong = (swan ? 0.2 : 0.36) * L;
  const tail = makeTail(g, skin, tailLong, ry * 0.75, 0, ry, rz * 0.8);
  if (!swan) ball(tail, dark, 0.008 * L, has("fin") ? 0.09 * L : 0.05 * L, 0.07 * L, 0, has("fin") ? 0 : 0.01 * L, tailLong * 0.9);
  shade(g);
  return { group: g, legs: legs, tail: tail, head: head, jaw: jaw };
}

// A flying reptile: a small body, a long beak, and two big wings that flap. Its size is its wingspan.
function makeFlyer(kind) {
  const sp = SPECIES[kind];
  const L = sp.size * BIG;
  const has = function (feat) { return sp.feats.includes(feat); };
  const g = new THREE.Group();
  const skin = paint(sp.a);
  const belly = paint(sp.b);
  const trim = paint(sp.c);
  const up = 0.12 * L;                                   // the body hangs this high, so its feet touch the ground
  ball(g, skin, 0.055 * L, 0.05 * L, 0.13 * L, 0, up, 0);
  ball(g, belly, 0.046 * L, 0.038 * L, 0.11 * L, 0, up - 0.016 * L, 0);
  const head = new THREE.Group();
  head.position.set(0, up + 0.02 * L, -0.11 * L);
  const neck = (has("longneck") ? 0.2 : 0.09) * L;
  const big = has("bighead") ? 1.6 : 1;
  piece(head, new THREE.CylinderGeometry(0.016 * L, 0.024 * L, neck, 6), skin, 0, neck * 0.38, -neck * 0.3).rotation.x = -0.65;
  const hy0 = neck * 0.78;
  const hz0 = -neck * 0.62;
  ball(head, skin, 0.03 * L * big, 0.028 * L * big, 0.05 * L * big, 0, hy0, hz0);
  piece(head, new THREE.ConeGeometry(0.017 * L * big, 0.19 * L, 6), belly, 0, hy0 - 0.006 * L, hz0 - 0.13 * L).rotation.x = -Math.PI / 2;
  if (has("crest")) piece(head, new THREE.ConeGeometry(0.015 * L, 0.15 * L, 5), trim, 0, hy0 + 0.035 * L, hz0 + 0.09 * L).rotation.x = Math.PI / 2 - 0.5;
  if (has("sailcrest")) ball(head, trim, 0.006 * L, 0.07 * L, 0.06 * L, 0, hy0 + 0.07 * L, hz0 - 0.01 * L);
  for (const s of [-1, 1]) {
    piece(head, ballShape, bright(0xfff4a0), s * 0.026 * L * big, hy0 + 0.01 * L, hz0 - 0.015 * L).scale.setScalar(0.008 * L * big);
    piece(head, ballShape, bright(0x1a1a1a), s * 0.031 * L * big, hy0 + 0.01 * L, hz0 - 0.018 * L).scale.setScalar(0.004 * L * big);
  }
  g.add(head);
  // Each wing is a long flat triangle, with a thin bone along its front edge
  const wings = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.045 * L, up + 0.02 * L, -0.02 * L);
    const flat = piece(wing, new THREE.ConeGeometry(0.12 * L, 0.45 * L, 3), skin, s * 0.225 * L, 0, 0.03 * L);
    flat.rotation.set(0, 0, s * -Math.PI / 2);
    flat.scale.set(1, 1, 0.05);
    piece(wing, new THREE.CylinderGeometry(0.006 * L, 0.01 * L, 0.45 * L, 5), trim, s * 0.225 * L, 0.004 * L, -0.05 * L).rotation.z = Math.PI / 2;
    g.add(wing);
    wings.push({ group: wing, side: s });
  }
  const legs = [];
  for (const s of [-1, 1]) legs.push(makeLeg(g, skin, up * 0.9, 0.012 * L, s * 0.03 * L, up * 0.9, 0.09 * L, belly));
  const tailLong = (has("tailvane") ? 0.3 : 0.08) * L;
  const tail = makeTail(g, skin, tailLong, 0.014 * L, 0, up, 0.11 * L);
  if (has("tailvane")) ball(tail, trim, 0.035 * L, 0.004 * L, 0.04 * L, 0, 0, tailLong * 0.95);
  shade(g);
  return { group: g, legs: legs, tail: tail, head: head, jaw: null, wings: wings };
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
