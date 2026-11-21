// Farshore: the scene.
// Everything you can SEE that is not alive or built by you: the land and sea bed, the water,
// the alien sky, trees, rocks, coral, the star stones, and the things you can pick up.

// ===== 1. Setting up =====
const canvas = document.getElementById("game");
const testing = location.search.includes("test");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffd9c4, 120, 1100);
const camera = new THREE.PerspectiveCamera(70, 1.5, 0.15, 5000);
camera.rotation.order = "YXZ";
scene.add(camera);
const UP = new THREE.Vector3(0, 1, 0);
const dice = seeded(2027);
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

const skyLight = new THREE.HemisphereLight(0xfff0e0, 0x3a5a6a, 0.5);
scene.add(skyLight);
const sunLight = new THREE.DirectionalLight(0xfff2d8, 0.6);
sunLight.position.set(-0.5, 0.8, 0.35);
scene.add(sunLight);
// Your dive light (it only shines once you have made one and switched it on)
const torch = new THREE.SpotLight(0xeaffff, 0, 60, 0.6, 0.5, 1.2);
const torchAim = new THREE.Object3D();
torchAim.position.set(0, 0, -10);
camera.add(torch, torchAim);
torch.target = torchAim;

// ===== 2. Little helpers =====
function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function paint(colour, glowColour) {
  return new THREE.MeshPhongMaterial({ color: colour, emissive: glowColour || 0x000000, shininess: 20, flatShading: true });
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

// Stretch a rod (a cylinder 1 tall) so it goes from point a to point b
const rodWay = new THREE.Vector3();
function stretch(mesh, a, b) {
  rodWay.subVectors(b, a);
  const long = rodWay.length() || 0.001;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.set(1, long, 1);
  mesh.quaternion.setFromUnitVectors(UP, rodWay.divideScalar(long));
}

const glowTexture = (function () {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const pen = c.getContext("2d");
  const fade = pen.createRadialGradient(32, 32, 2, 32, 32, 32);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(0.3, "rgba(255,255,255,0.4)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  pen.fillStyle = fade;
  pen.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

function glow(colour, size) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

// Put many copies of one shape into the world in one go. spots = [{ x, y, z, sx, sy, sz, turn, tilt, lean, tint }]
function sprinkle(geometry, material, spots) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, spots.length));
  const tint = new THREE.Color();
  spots.forEach(function (s, i) {
    helper.position.set(s.x, s.y, s.z);
    helper.rotation.set(s.tilt || 0, s.turn || 0, s.lean || 0);
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

// Pick "count" random spots where the ground is between low and high. "around" = near that island.
function pick(count, low, high, around, wide) {
  const list = [];
  let tries = 0;
  while (list.length < count && tries++ < count * 400) {
    let x;
    let z;
    if (around) {
      const a = dice() * Math.PI * 2;
      const far = Math.sqrt(dice()) * (wide || around.r * 0.62);
      x = around.x + Math.cos(a) * far;
      z = around.z + Math.sin(a) * far;
    } else {
      x = (dice() * 2 - 1) * EDGE;
      z = (dice() * 2 - 1) * EDGE;
    }
    const y = groundAt(x, z);
    if (y < low || y > high) continue;
    if (Math.hypot(x - TOWER.x, z - TOWER.z) < 12 || Math.hypot(x - STACK.x, z - STACK.z) < 10) continue;
    list.push({ x: x, y: y, z: z });
  }
  return list;
}

// ===== 3. The land, the sea bed and the water =====
const LAND = [[0, 0xe8d8a8], [1.8, 0xe8d8a8], [3.2, 0x35a88a], [40, 0x2a8a78], [52, 0x6a6078], [90, 0x3a3448]];
const SEABED = [[0, 0xdcdca4], [8, 0x7fc0a8], [28, 0x3a8a8c], [60, 0x1c4a5e], [118, 0x0a1a2c]];
const colourA = new THREE.Color();
const colourB = new THREE.Color();

function blend(list, value, into) {
  let i = 0;
  while (i < list.length - 2 && value > list[i + 1][0]) i++;
  const t = clamp((value - list[i][0]) / (list[i + 1][0] - list[i][0]), 0, 1);
  colourA.setHex(list[i][1]);
  colourB.setHex(list[i + 1][1]);
  return into.copy(colourA).lerp(colourB, t);
}

(function () {
  const size = EDGE * 2 + 240;
  const cuts = 230;
  const shape = new THREE.PlaneGeometry(size, size, cuts, cuts);
  shape.rotateX(-Math.PI / 2);
  const spots = shape.attributes.position;
  const colours = new Float32Array(spots.count * 3);
  const colour = new THREE.Color();
  const rock = new THREE.Color(0x6a6078);
  for (let i = 0; i < spots.count; i++) {
    const x = spots.getX(i);
    const z = spots.getZ(i);
    const y = groundAt(x, z);
    spots.setY(i, y);
    if (y > 0) {
      blend(LAND, y, colour);
      // Steep ground is bare rock
      const steep = Math.hypot(groundAt(x + 2, z) - groundAt(x - 2, z), groundAt(x, z + 2) - groundAt(x, z - 2)) / 4;
      if (y > 2.5) colour.lerp(rock, smooth((steep - 0.55) / 0.35));
    } else {
      blend(SEABED, -y, colour);
    }
    const shade = 0.82 + 0.36 * bumps(x * 0.16, z * 0.16);
    colours[i * 3] = colour.r * shade;
    colours[i * 3 + 1] = colour.g * shade;
    colours[i * 3 + 2] = colour.b * shade;
  }
  shape.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  shape.computeVertexNormals();
  scene.add(new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ vertexColors: true })));
})();

// The top of the sea
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(6000, 6000),
  new THREE.MeshPhongMaterial({ color: 0x2fb4c6, transparent: true, opacity: 0.72, shininess: 140, specular: 0xfff0d8, side: THREE.DoubleSide })
);
water.rotation.x = -Math.PI / 2;
scene.add(water);

// ===== 4. The alien sky =====
// The sky is a huge ball painted from peach at the bottom to deep teal at the top.
// It follows you around, so you can never reach it.
const sky = new THREE.Group();
scene.add(sky);
(function () {
  const ball = new THREE.SphereGeometry(3000, 24, 14);
  const spots = ball.attributes.position;
  const colours = new Float32Array(spots.count * 3);
  const colour = new THREE.Color();
  const steps = [[-0.2, 0xffd9c4], [0.02, 0xffd9c4], [0.25, 0x8fd8e0], [1, 0x1f5a9a]];
  for (let i = 0; i < spots.count; i++) {
    blend(steps, spots.getY(i) / 3000, colour);
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  ball.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  sky.add(new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));

  // A giant ringed planet, and two moons
  const far = function (colour) { return new THREE.MeshBasicMaterial({ color: colour, fog: false, transparent: true, opacity: 0.9 }); };
  const planet = piece(sky, new THREE.SphereGeometry(420, 24, 16), far(0xf4c8b8), -1300, 900, -2100);
  const ring = piece(sky, new THREE.RingGeometry(520, 760, 48), new THREE.MeshBasicMaterial({ color: 0xffe8d8, fog: false, transparent: true, opacity: 0.55, side: THREE.DoubleSide }), -1300, 900, -2100);
  ring.rotation.set(1.25, 0.3, 0);
  piece(sky, new THREE.SphereGeometry(380, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd9c4, fog: false, transparent: true, opacity: 0.35 }), -1380, 880, -2000).scale.set(1, 1, 0.2);
  piece(sky, new THREE.SphereGeometry(90, 16, 12), far(0xe8f4ff), 1500, 1300, -1500);
  piece(sky, new THREE.SphereGeometry(45, 12, 10), far(0xc8b8ff), 1100, 1700, 900);
  planet.rotation.z = 0.3;
  // The sun
  const sun = glow(0xfff4d0, 900);
  sun.position.set(-1500, 2400, 1050);
  sky.add(sun);
})();

// Clouds
const clouds = sprinkle(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff4ee, fog: false, transparent: true, opacity: 0.85 }), (function () {
  const list = [];
  for (let i = 0; i < 22; i++) {
    const wide = 40 + dice() * 70;
    list.push({ x: (dice() - 0.5) * 2400, y: 260 + dice() * 120, z: (dice() - 0.5) * 2400, sx: wide, sy: 9 + dice() * 8, sz: wide * (0.5 + dice() * 0.4) });
  }
  return list;
})());

// ===== 5. Scenery =====
// Solid round things you bump into: { x, z, r, top }
const solids = [];
// Rock arches on Thunder Peak where the Stormwing can't reach you: { x, z, r }
const shelters = [];

(function () {
  // --- Parasol trees: a tall stalk with a wide pink or orange top ---
  const trunk = new THREE.CylinderGeometry(0.22, 0.4, 1, 6);
  trunk.translate(0, 0.5, 0);
  const top = new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const trees = pick(30, 2.5, 16, isle("home")).concat(pick(80, 2.5, 14, isle("green")), pick(5, 2.5, 8, isle("gull")), pick(8, 1.6, 6, ATOLL, 80));
  trees.forEach(function (t) {
    t.high = 6 + dice() * 6;
    t.wide = 2.6 + dice() * 2.2;
    t.tint = [0xff7ab8, 0xff9a5a, 0xf05a9a, 0xffb86a][Math.floor(dice() * 4)];
    solids.push({ x: t.x, z: t.z, r: 0.45, top: t.y + t.high });
  });
  sprinkle(trunk, paint(0x7a5a8a), trees.map(function (t) { return { x: t.x, y: t.y - 0.3, z: t.z, sx: 1, sy: t.high + 0.3, sz: 1 }; }));
  sprinkle(top, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), trees.map(function (t) {
    return { x: t.x, y: t.y + t.high - 0.6, z: t.z, sx: t.wide, sy: t.wide * 0.45, sz: t.wide, tint: t.tint };
  }));

  // --- Boulders on the land and on the sea bed ---
  const boulders = pick(40, 1.5, 80, isle("peak")).concat(pick(20, 1.5, 20, isle("home")), pick(90, -60, -3));
  sprinkle(new THREE.DodecahedronGeometry(1, 0), paint(0x7a7088), boulders.map(function (s) {
    const wide = 0.8 + dice() * 2.4;
    if (wide > 2) solids.push({ x: s.x, z: s.z, r: wide * 0.8, top: s.y + wide * 0.7 });
    return { x: s.x, y: s.y + wide * 0.2, z: s.z, sx: wide, sy: wide * (0.6 + dice() * 0.4), sz: wide, turn: dice() * 6, tilt: dice() };
  }));
  // Blue crystals near the top of Thunder Peak
  sprinkle(new THREE.OctahedronGeometry(1, 0), paint(0x6ad8ff, 0x1a6a9a), pick(46, 45, 95, isle("peak")).map(function (s) {
    return { x: s.x, y: s.y + 0.6, z: s.z, sx: 0.5 + dice() * 0.6, sy: 1.4 + dice() * 2.2, turn: dice() * 6, tilt: (dice() - 0.5) * 0.6 };
  }));

  // --- Under the sea: kelp, coral and glowing stalks in the deep ---
  const blade = new THREE.ConeGeometry(0.35, 1, 5);
  blade.translate(0, 0.5, 0);
  sprinkle(blade, paint(0x3f9a4a, 0x0a2a10), pick(260, -34, -5).map(function (s) {
    return { x: s.x, y: s.y - 0.2, z: s.z, sx: 0.7 + dice() * 0.8, sy: Math.min(-s.y - 1.5, 3 + dice() * 9), lean: (dice() - 0.5) * 0.3, tilt: (dice() - 0.5) * 0.3 };
  }));
  const corals = pick(300, -16, -1.5);
  sprinkle(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), corals.map(function (s) {
    const wide = 0.4 + dice() * 1.1;
    return { x: s.x, y: s.y + wide * 0.3, z: s.z, sx: wide, sy: wide * (0.6 + dice()), sz: wide, turn: dice() * 6, tint: [0xff6a8a, 0xffb84a, 0xc87aff, 0x4ad8c8, 0xff8ad8][Math.floor(dice() * 5)] };
  }));
  sprinkle(blade, bright(0x4ab8ff), pick(120, -200, -50).map(function (s) {
    return { x: s.x, y: s.y - 0.2, z: s.z, sx: 0.5 + dice() * 0.5, sy: 2 + dice() * 6, lean: (dice() - 0.5) * 0.2 };
  }));

  // A coral arch over the middle of the lagoon
  const arch = piece(scene, new THREE.TorusGeometry(5, 0.9, 6, 12, Math.PI), paint(0xff7a9a, 0x3a1020), ATOLL.x, groundAt(ATOLL.x, ATOLL.z) - 0.5, ATOLL.z);
  arch.rotation.y = 0.6;

  // --- The Stack: a tall rock with sides too steep to climb ---
  const stackBase = groundAt(STACK.x, STACK.z);
  const stack = piece(scene, new THREE.CylinderGeometry(STACK.r, STACK.r * 1.08, STACK.top - stackBase + 1, 9), paint(0x7a7088), STACK.x, (STACK.top + stackBase - 1) / 2, STACK.z);
  stack.rotation.y = 0.4;
  solids.push({ x: STACK.x, z: STACK.z, r: STACK.r, top: STACK.top });

  // --- Rock arches on Thunder Peak, to hide under ---
  const peak = isle("peak");
  const slab = paint(0x5a5068);
  [[1.57, 72], [2.35, 54], [0.95, 36], [1.9, 18]].forEach(function (spot) {
    const x = peak.x + Math.cos(spot[0]) * spot[1];
    const z = peak.z + Math.sin(spot[0]) * spot[1];
    const y = groundAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = -spot[0];
    piece(group, new THREE.BoxGeometry(1.6, 6, 5), slab, -3.6, 1.6, 0);
    piece(group, new THREE.BoxGeometry(1.6, 6, 5), slab, 3.6, 1.6, 0);
    piece(group, new THREE.BoxGeometry(10.5, 1.4, 6), slab, 0, 5, 0);
    scene.add(group);
    shelters.push({ x: x, z: z, r: 3.4 });
  });
})();

// ===== 6. The landing pod and the signal tower =====
// Find the beach on the south side of Landing Isle: that is where you start
const START = (function () {
  let z = 215;
  while (groundAt(0, z) < 2.2 && z > 130) z -= 1;
  return { x: 0, z: z };
})();

(function () {
  const pod = new THREE.Group();
  const px = START.x + 9;
  const pz = START.z + 3;
  pod.position.set(px, groundAt(px, pz) + 1.2, pz);
  pod.rotation.set(0.15, 0.6, 0.2);
  piece(pod, new THREE.SphereGeometry(2.2, 12, 9), paint(0xe8ecf0), 0, 0, 0).scale.set(1, 1.25, 1);
  piece(pod, new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshPhongMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.6 }), 0, 0.8, -1.5);
  piece(pod, new THREE.CylinderGeometry(2.3, 2.3, 0.5, 12), paint(0xff7a3a), 0, -0.6, 0);
  scene.add(pod);
  solids.push({ x: px, z: pz, r: 2.6, top: groundAt(px, pz) + 4 });
})();

// The tower: a ring of five old stone pillars. Each one lights up when you bring it a star stone.
const towerY = groundAt(TOWER.x, TOWER.z);
const towerLights = [];
const towerBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.9, 0.9, 900, 10, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
);
(function () {
  const tower = new THREE.Group();
  tower.position.set(TOWER.x, towerY, TOWER.z);
  const old = paint(0x8a8498);
  piece(tower, new THREE.CylinderGeometry(6.5, 7, 1.6, 14), old, 0, -0.2, 0);
  piece(tower, new THREE.CylinderGeometry(1, 1.4, 2.2, 8), old, 0, 1.4, 0);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    piece(tower, new THREE.CylinderGeometry(0.5, 0.7, 5, 6), old, Math.cos(a) * 5, 2.8, Math.sin(a) * 5);
    const lamp = piece(tower, new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshPhongMaterial({ color: 0x3a3a48, emissive: 0x000000, flatShading: true }), Math.cos(a) * 5, 6, Math.sin(a) * 5);
    towerLights.push(lamp);
  }
  towerBeam.position.y = 450;
  towerBeam.visible = false;
  tower.add(towerBeam);
  scene.add(tower);
  solids.push({ x: TOWER.x, z: TOWER.z, r: 1.6, top: towerY + 3 });
})();

// ===== 7. The star stones =====
// Each one sends a thin beam of light up into the sky, so you can find it from far away.
const stoneModels = {};
STONES.forEach(function (stone) {
  stone.y = (stone.y !== undefined ? stone.y : groundAt(stone.x, stone.z)) + 1.3;
  const group = new THREE.Group();
  group.position.set(stone.x, stone.y, stone.z);
  const gem = piece(group, new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshPhongMaterial({ color: 0xeaffff, emissive: 0x4ad8ff, flatShading: true }), 0, 0, 0);
  group.add(glow(0x8fe8ff, 6));
  piece(group, new THREE.CylinderGeometry(0.25, 0.25, 700, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0, 350, 0);
  scene.add(group);
  stoneModels[stone.id] = { group: group, gem: gem };
});

// ===== 8. Things you can pick up =====
const nodes = makeNodes();
const nodeMeshes = {};
(function () {
  const log = new THREE.CylinderGeometry(0.22, 0.26, 1.8, 6);
  log.rotateZ(Math.PI / 2);
  const reed = new THREE.ConeGeometry(0.45, 1.5, 5);
  reed.translate(0, 0.75, 0);
  const shell = new THREE.ConeGeometry(0.3, 0.6, 7);
  shell.rotateZ(1.2);
  const shapes = {
    wood: log,
    stone: new THREE.DodecahedronGeometry(0.42, 0),
    fibre: reed,
    fruit: new THREE.SphereGeometry(0.38, 8, 6),
    shell: shell,
    copper: new THREE.OctahedronGeometry(0.45, 0),
    crystal: new THREE.OctahedronGeometry(0.4, 0),
    pearl: new THREE.SphereGeometry(0.35, 10, 8),
  };
  const glows = { fruit: 0x7a3a00, crystal: 0x1a8a9a, pearl: 0x8a88a0, copper: 0x3a1a04, shell: 0x3a1420 };
  const counts = {};
  nodes.forEach(function (node) {
    node.slot = counts[node.kind] || 0;
    counts[node.kind] = node.slot + 1;
    node.back = 0;
    node.turn = dice() * 6;
  });
  for (const kind in shapes) {
    const mesh = new THREE.InstancedMesh(shapes[kind], paint(STUFF[kind].colour, glows[kind]), counts[kind]);
    mesh.frustumCulled = false;
    scene.add(mesh);
    nodeMeshes[kind] = mesh;
  }
  nodes.forEach(function (node) { showNode(node, true); });
})();

// Draw a thing you can pick up (or hide it, once you have taken it)
function showNode(node, here) {
  const lift = { wood: 0.2, stone: 0.25, fibre: 0, fruit: 0.7, shell: 0.15, copper: 0.3, crystal: 0.5, pearl: 0.35 }[node.kind];
  helper.position.set(node.x, node.y + lift, node.z);
  helper.rotation.set(0, node.turn, 0);
  const big = here ? (node.kind === "crystal" ? 1.5 : 1) : 0.0001;
  helper.scale.set(big, node.kind === "crystal" ? big * 1.6 : big, big);
  helper.updateMatrix();
  nodeMeshes[node.kind].setMatrixAt(node.slot, helper.matrix);
  nodeMeshes[node.kind].instanceMatrix.needsUpdate = true;
}

// ===== 9. Little animals (they can't hurt you) =====
const SCHOOL_FISH = 10;
const schools = pick(16, -40, -4).map(function (s) {
  return { x: s.x, z: s.z, y: Math.min(-2, s.y + 2 + dice() * 8), r: 4 + dice() * 6, speed: (0.3 + dice() * 0.4) * (dice() < 0.5 ? 1 : -1), tint: [0xffd76a, 0xff7a9a, 0x8fe8ff, 0xc8a8ff, 0xffffff][Math.floor(dice() * 5)] };
});
const fishMesh = (function () {
  const shape = new THREE.ConeGeometry(0.22, 0.9, 5);
  shape.rotateX(-Math.PI / 2);
  shape.scale(0.5, 1, 1);
  const mesh = new THREE.InstancedMesh(shape, new THREE.MeshLambertMaterial({ color: 0xffffff }), schools.length * SCHOOL_FISH);
  const tint = new THREE.Color();
  schools.forEach(function (school, s) {
    for (let i = 0; i < SCHOOL_FISH; i++) mesh.setColorAt(s * SCHOOL_FISH + i, tint.setHex(school.tint));
  });
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
})();

// Skimmers: little flying things that circle over the islands
const SKIMMERS = 14;
const skimmerMesh = (function () {
  const shape = new THREE.ConeGeometry(0.9, 0.5, 3);
  shape.rotateX(-Math.PI / 2);
  shape.scale(1.6, 0.15, 1);
  const mesh = new THREE.InstancedMesh(shape, bright(0xfff4e8), SKIMMERS);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
})();

// t = the time in seconds
function moveScenery(dt, t) {
  sky.position.copy(camera.position);
  water.position.x = camera.position.x;
  water.position.z = camera.position.z;
  clouds.position.x = (t * 2) % 400;

  schools.forEach(function (school, s) {
    for (let i = 0; i < SCHOOL_FISH; i++) {
      const a = t * school.speed + i * 0.6;
      const r = school.r + (i % 3) * 0.7;
      const way = school.speed > 0 ? 1 : -1;
      helper.position.set(school.x + Math.cos(a) * r, school.y + Math.sin(a * 2 + i) * 0.8, school.z + Math.sin(a) * r);
      helper.rotation.set(0, Math.atan2(Math.sin(a) * way, -Math.cos(a) * way), 0);
      helper.scale.set(1, 1, 1);
      helper.updateMatrix();
      fishMesh.setMatrixAt(s * SCHOOL_FISH + i, helper.matrix);
    }
  });
  fishMesh.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < SKIMMERS; i++) {
    const home = ISLANDS[i % 3];
    const a = t * 0.25 + i * 1.3;
    const r = 30 + (i % 5) * 9;
    helper.position.set(home.x + Math.cos(a) * r, Math.max(14, home.h) + 14 + Math.sin(t + i) * 3, home.z + Math.sin(a) * r);
    helper.rotation.set(0, Math.atan2(Math.sin(a), -Math.cos(a)), Math.sin(t * 6 + i) * 0.3);
    helper.scale.set(1, 1, 1);
    helper.updateMatrix();
    skimmerMesh.setMatrixAt(i, helper.matrix);
  }
  skimmerMesh.instanceMatrix.needsUpdate = true;

  for (const id in stoneModels) stoneModels[id].gem.rotation.y = t * 1.5;
}
