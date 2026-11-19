// Deepwild: the game.
// You live on a little raft in the middle of the sea. Dive down to explore: watch your air, pick up useful things,
// climb back onto the raft to make better gear, scan the creatures you meet, and find the four Tide Tablets
// that open the Great Shell at the very bottom of the Trench. The sea itself is described in world.js.

const el = (id) => document.getElementById(id);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const mix = (a, b, t) => a + (b - a) * t;
const TEST = location.search.includes("test");       // (only for testing the game)
const canvas = el("game");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x2aa8c8, 0.02);
const camera = new THREE.PerspectiveCamera(72, 1.5, 0.15, 700);
camera.rotation.order = "YXZ";
scene.add(camera);
function resize() {
  const w = canvas.clientWidth || 960;
  renderer.setSize(w, Math.round(w / 1.5), false);
}
window.addEventListener("resize", resize);
resize();

// ----- Sounds -----
let soundOn = true;
function sound(make) {
  try { if (soundOn) make(); } catch (error) { soundOn = false; }
}
const sfx = {
  pick: () => sound(() => playTone(0, 0.08, 520, 880, 0.12)),
  make: () => sound(() => { playTone(0, 0.1, 440, 660, 0.12); playTone(0.1, 0.18, 660, 990, 0.12); }),
  scan: () => sound(() => { playTone(0, 0.12, 700, 1400, 0.1); playTone(0.12, 0.2, 1400, 1400, 0.08); }),
  bubble: () => sound(() => playTone(0, 0.06, 300 + Math.random() * 300, 700, 0.04)),
  hurt: () => sound(() => playNoise(0, 0.2, 500, 150, 0.2)),
  warn: () => sound(() => { playTone(0, 0.12, 620, 620, 0.12); playTone(0.18, 0.12, 620, 620, 0.12); }),
  win: () => sound(() => playJingle()),
  splash: () => sound(() => playNoise(0, 0.3, 1800, 500, 0.12)),
};

// ----- Light -----
// The deeper you go, the less sunlight there is. Everything is lit by these lights (and by your torch).
const skyLight = new THREE.AmbientLight(0xbfe8ff, 0.8);
const sunLight = new THREE.DirectionalLight(0xfff6d8, 0.6);
sunLight.position.set(0.4, 1, 0.3);
const torch = new THREE.SpotLight(0xfff2cc, 0, 70, 0.5, 0.45, 1.2);
torch.position.set(0.3, -0.2, 0);
torch.target.position.set(0, 0, -6);
camera.add(torch, torch.target);
scene.add(skyLight, sunLight);
const clock = { value: 0 };             // seconds since the game began (shared with the tiny graphics programs below)

// ----- The sea bed -----
// One big sheet of points, each pushed down to the depth of the sea at that place and coloured like the ground there.
// A tiny program for the graphics card (a "shader") lights it, and draws the wobbly lines of sunlight you see in shallow water.
const seaBed = { uniforms: { time: clock, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.02 }, light: { value: 0.8 }, sun: { value: 0.6 }, torchAt: { value: new THREE.Vector3() }, torchWay: { value: new THREE.Vector3(0, 0, -1) }, torchOn: { value: 0 } } };
(function () {
  const cells = 200, size = (WORLD + 20) * 2, places = [], colours = [], corners = [];
  for (let iz = 0; iz <= cells; iz++) for (let ix = 0; ix <= cells; ix++) {
    const x = (ix / cells - 0.5) * size, z = (iz / cells - 0.5) * size, sand = ZONES[zoneAt(x, z)].sand;
    const shade = 0.82 + noise2(x, z, 9, 41) * 0.3;
    places.push(x, -depthAt(x, z), z);
    colours.push(sand[0] * shade, sand[1] * shade, sand[2] * shade);
  }
  for (let iz = 0; iz < cells; iz++) for (let ix = 0; ix < cells; ix++) {
    const a = iz * (cells + 1) + ix, b = a + 1, c = a + cells + 1, d = c + 1;
    corners.push(a, c, b, b, c, d);
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(places, 3));
  shape.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  shape.setIndex(corners);
  shape.computeVertexNormals();
  const material = new THREE.ShaderMaterial({
    uniforms: seaBed.uniforms,
    vertexColors: true,
    vertexShader: `
      varying vec3 vColour;
      varying vec3 vUp;
      varying vec3 vPlace;
      varying float vFar;
      void main() {
        vColour = color;
        vUp = normal;
        vPlace = position;
        vec4 seen = modelViewMatrix * vec4(position, 1.0);
        vFar = -seen.z;
        gl_Position = projectionMatrix * seen;
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 fogColor;
      uniform float fogDensity;
      uniform float light;
      uniform float sun;
      uniform vec3 torchAt;
      uniform vec3 torchWay;
      uniform float torchOn;
      varying vec3 vColour;
      varying vec3 vUp;
      varying vec3 vPlace;
      varying float vFar;
      void main() {
        float up = max(0.0, normalize(vUp).y);
        vec3 colour = vColour * (light * 0.62 + sun * (0.2 + 0.4 * up));
        // Wobbly lines of sunlight on the sand (they fade away as the water gets deeper)
        vec2 p = vPlace.xz * 0.4;
        float lines = sin(p.x + sin(p.y * 1.3 + time * 0.9) * 1.7 + time * 0.5) * sin(p.y * 1.1 + sin(p.x * 1.2 - time * 0.7) * 1.7);
        colour += vColour * pow(1.0 - abs(lines), 7.0) * sun * 0.75 * clamp(1.0 + vPlace.y / 50.0, 0.0, 1.0) * up;
        // Your torch: a bright circle where you point it
        vec3 toHere = vPlace - torchAt;
        float far = length(toHere);
        colour += vColour * smoothstep(0.84, 0.96, dot(toHere / far, torchWay)) * torchOn * 1.1 / (1.0 + far * far * 0.004);
        float mist = 1.0 - exp(-fogDensity * fogDensity * vFar * vFar);
        gl_FragColor = vec4(mix(colour, fogColor, mist), 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(shape, material));
})();

// ----- The top of the water, and the sky above it -----
const surface = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ color: 0x8fe0f0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
surface.rotation.x = -Math.PI / 2;
scene.add(surface);
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(26, 20), new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
sunDisc.position.set(180, 420, 140);
sunDisc.lookAt(0, 0, 0);
scene.add(sunDisc);
// Beams of sunlight slanting down through the water near you
const beams = Array.from({ length: 7 }, function (unused, n) {
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 4.5, 60, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8fff0, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  beam.userData = { x: Math.cos(n * 0.9) * (8 + n * 4), z: Math.sin(n * 0.9) * (8 + n * 4) };
  beam.rotation.z = 0.22;
  scene.add(beam);
  return beam;
});
// Specks drifting in the water, so you can feel yourself moving
const specks = (function () {
  const spots = [];
  for (let n = 0; n < 500; n++) spots.push((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 60);
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(spots, 3));
  const cloud = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xdff8ff, size: 0.09, transparent: true, opacity: 0.6, depthWrite: false }));
  cloud.frustumCulled = false;
  scene.add(cloud);
  return cloud;
})();
// Bubbles that rise from you as you breathe
const bubbles = Array.from({ length: 40 }, function () {
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.7 }));
  bubble.visible = false;
  bubble.userData = { life: 0, drift: 0 };
  scene.add(bubble);
  return bubble;
});

// ----- Plants, rocks and things to pick up -----
// There are thousands of these, so each kind is drawn in one go: the same shape copied to many places ("instancing").
const paints = new Map();
const paint = (colour) => paints.get(colour) || paints.set(colour, new THREE.MeshLambertMaterial({ color: colour })).get(colour);
// Glue several simple shapes into one. Each part is [shape, x, y, z, turn about x, turn about z, stretch x, stretch y, stretch z].
function glue(parts) {
  const places = [], ups = [];
  for (const [shape, x, y, z, tiltX, tiltZ, sx, sy, sz] of parts) {
    const mesh = new THREE.Mesh(shape);
    mesh.position.set(x, y, z);
    mesh.rotation.set(tiltX || 0, 0, tiltZ || 0);
    mesh.scale.set(sx || 1, sy || 1, sz || 1);
    mesh.updateMatrix();
    const moved = (shape.index ? shape.toNonIndexed() : shape.clone()).applyMatrix4(mesh.matrix);
    places.push(...moved.attributes.position.array);
    ups.push(...moved.attributes.normal.array);
  }
  const whole = new THREE.BufferGeometry();
  whole.setAttribute("position", new THREE.Float32BufferAttribute(places, 3));
  whole.setAttribute("normal", new THREE.Float32BufferAttribute(ups, 3));
  return whole;
}
const BALL = new THREE.IcosahedronGeometry(1, 1), LUMP = new THREE.IcosahedronGeometry(1, 0), STICK = new THREE.CylinderGeometry(0.6, 1, 1, 7), CONE = new THREE.ConeGeometry(1, 1, 7), BOX = new THREE.BoxGeometry(1, 1, 1);
// Put one shape at every place in a list. "colourOf" picks each one's colour, and "sizeOf" its width and height.
function scatter(shape, material, list, colourOf, sizeOf) {
  const many = new THREE.InstancedMesh(shape, material, list.length);
  const helper = new THREE.Object3D(), colour = new THREE.Color();
  list.forEach(function (at, n) {
    const [wide, high] = sizeOf(at);
    helper.position.set(at.x, at.y, at.z);
    helper.rotation.set(0, at.turn, 0);
    helper.scale.set(wide, high, wide);
    helper.updateMatrix();
    many.setMatrixAt(n, helper.matrix);
    many.setColorAt(n, colour.set(colourOf(at)));
  });
  many.frustumCulled = false;
  scene.add(many);
  return many;
}
const pickFrom = (colours) => (at) => colours[Math.floor(at.tint * colours.length)];
// Kelp: two tall ribbons crossed over. A few lines added to its graphics program make it sway in the current.
const kelpShape = (function () {
  const one = new THREE.PlaneGeometry(1, 1, 1, 7);
  one.translate(0, 0.5, 0);
  const other = one.clone();
  other.rotateY(Math.PI / 2);
  return glue([[one, 0, 0, 0], [other, 0, 0, 0]]);
})();
const kelpPaint = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
kelpPaint.onBeforeCompile = function (shader) {
  shader.uniforms.time = clock;
  shader.vertexShader = "uniform float time;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
    float bend = position.y * position.y;
    transformed.x += sin(time * 1.1 + instanceMatrix[3][0] * 0.31 + position.y * 3.0) * 0.5 * bend;
    transformed.z += cos(time * 0.9 + instanceMatrix[3][2] * 0.27 + position.y * 2.4) * 0.4 * bend;`);
};
scatter(kelpShape, kelpPaint, decor.kelp, pickFrom([0x4a8a3a, 0x5a9a44, 0x6aa040, 0x3e7a34]), (at) => [1.3 * at.size, 9 * at.size]);
scatter(glue([[STICK, 0, 0.7, 0, 0, 0, 0.22, 1.4, 0.22], [STICK, 0.45, 1, 0, 0, -0.7, 0.16, 1.1, 0.16], [STICK, -0.4, 1.1, 0.1, 0, 0.6, 0.16, 1.2, 0.16], [STICK, 0, 1.1, 0.45, 0.6, 0, 0.14, 1, 0.14], [BALL, 0, 1.5, 0, 0, 0, 0.3, 0.3, 0.3], [BALL, 0.85, 1.45, 0, 0, 0, 0.22, 0.22, 0.22], [BALL, -0.8, 1.6, 0.1, 0, 0, 0.22, 0.22, 0.22]]),
  new THREE.MeshLambertMaterial({ color: 0xffffff }), decor.coral, pickFrom([0xff6a8a, 0xff9a4a, 0xffd84a, 0xc86af0, 0x4ad8c8, 0xff5ab0]), (at) => [1.5 * at.size, 1.5 * at.size]);
scatter(glue([[new THREE.CircleGeometry(1, 14), 0, 1.4, 0], [STICK, 0, 0.3, 0, 0, 0, 0.08, 0.6, 0.08]]), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), decor.fan, pickFrom([0xe84a7a, 0xf0a03a, 0x8a5ae0, 0xe0e04a]), (at) => [1.3 * at.size, 1.3 * at.size]);
scatter(glue([[BALL, 0, 0.4, 0, 0, 0, 1.4, 0.9, 1.1], [LUMP, 0.9, 0.2, 0.4, 0, 0, 0.6, 0.5, 0.6]]), new THREE.MeshLambertMaterial({ color: 0xffffff }), decor.rock, pickFrom([0x7a7684, 0x8a8694, 0x6a6672, 0x7c8a7a]), (at) => [1.2 * at.size, 1.2 * at.size]);
scatter(CONE, new THREE.MeshLambertMaterial({ color: 0xffffff }), decor.spire.map((at) => Object.assign({}, at, { y: at.y + 5 * at.size })), pickFrom([0x2c2a3c, 0x34324a, 0x242232]), (at) => [2.4 * at.size, 10 * at.size]);
// Glow bulbs: plants that shine with their own light in the dark
scatter(glue([[BALL, 0, 1.2, 0, 0, 0, 0.45, 0.55, 0.45], [STICK, 0, 0.45, 0, 0, 0, 0.07, 0.9, 0.07]]), new THREE.MeshBasicMaterial({ color: 0xffffff }), decor.bulb, pickFrom([0x5affd8, 0x8a7aff, 0xff7ae0, 0x7affa0]), (at) => [at.size, at.size]);
// Things to pick up. Each kind has its own shape. When you take one it shrinks away to nothing.
const LOOT_SHAPES = {
  shell: [glue([[new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0, 0, 0, 0.5, 0.3, 0.6]]), new THREE.MeshLambertMaterial({ color: 0xffffff }), [0xffd0e0, 0xfff0d8, 0xffb8a0]],
  kelp: [glue([[CONE, 0, 0.5, 0, 0, 0.2, 0.18, 1, 0.18], [CONE, 0.2, 0.4, 0.1, 0, -0.35, 0.16, 0.8, 0.16], [CONE, -0.15, 0.45, -0.1, 0.3, 0.3, 0.16, 0.9, 0.16]]), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x1a3a10 }), [0x8ad84a, 0x7ac83a]],
  copper: [glue([[LUMP, 0, 0.3, 0, 0, 0, 0.45, 0.38, 0.45]]), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 80, emissive: 0x3a1a08 }), [0xe07a3a, 0xf08a4a]],
  quartz: [glue([[CONE, 0, 0.5, 0, 0, 0, 0.2, 1, 0.2], [CONE, 0.22, 0.35, 0.05, 0, -0.5, 0.15, 0.7, 0.15], [CONE, -0.2, 0.35, -0.05, 0, 0.5, 0.15, 0.7, 0.15]]), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 120, emissive: 0x2a4a5a }), [0xc8f0ff, 0xe0d8ff]],
  salvage: [glue([[BOX, 0, 0.35, 0, 0, 0, 0.8, 0.6, 0.6], [BOX, 0, 0.35, 0, 0, 0, 0.84, 0.12, 0.64]]), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x16181c }), [0x9aa0ae, 0xb0946a]],
  pearl: [new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), [0x9affe0, 0xd0fff0]],
};
const lootMeshes = {};
for (const kind in LOOT_SHAPES) {
  const list = loot.filter((thing) => thing.kind === kind);
  list.forEach((thing, n) => (thing.slot = n));
  lootMeshes[kind] = scatter(LOOT_SHAPES[kind][0], LOOT_SHAPES[kind][1], kind === "pearl" ? list.map((thing) => Object.assign({}, thing, { y: thing.y + 0.3 })) : list, pickFrom(LOOT_SHAPES[kind][2]), (at) => [at.size, at.size]);
}
// Show or hide one thing (hidden means shrunk to nothing)
const lootHelper = new THREE.Object3D();
function showLoot(thing, shown) {
  lootHelper.position.set(thing.x, thing.y + (thing.kind === "pearl" ? 0.3 : 0), thing.z);
  lootHelper.rotation.set(0, thing.turn, 0);
  lootHelper.scale.setScalar(shown ? thing.size : 0.0001);
  lootHelper.updateMatrix();
  lootMeshes[thing.kind].setMatrixAt(thing.slot, lootHelper.matrix);
  lootMeshes[thing.kind].instanceMatrix.needsUpdate = true;
}

// ----- Special places -----
const box = (w, h, d, colour, x, y, z, parent) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof colour === "object" ? colour : paint(colour));
  mesh.position.set(x, y, z);
  (parent || scene).add(mesh);
  return mesh;
};
const glowPaint = (colour) => new THREE.MeshBasicMaterial({ color: colour });
// Your raft: planks on four barrels, with a mast, a lamp, a workbench and a ladder down into the water
const raft = new THREE.Group();
box(10, 0.4, 10, 0xb98c50, 0, 0.5, 0, raft);
for (let n = -4; n <= 4; n += 2) box(0.12, 0.42, 10, 0x8f6a3a, n, 0.5, 0, raft);
for (const [x, z] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) {
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.4, 12), paint(0x3a6ad8));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(x, -0.2, z);
  raft.add(barrel);
}
box(0.3, 7, 0.3, 0x8f6a3a, -3.5, 4, -3.5, raft);
box(0.1, 1.6, 2.4, 0xff7a4a, -3.5, 6.4, -2.2, raft);
const raftLamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), glowPaint(0xfff0a0));
raftLamp.position.set(-3.5, 7.8, -3.5);
raft.add(raftLamp);
box(3, 1.2, 1.4, 0x8a5a36, 2.5, 1.3, -3.4, raft);
box(1.4, 1.4, 1.4, 0xc89a5c, -2.8, 1.4, 3.2, raft);
for (let n = 0; n < 6; n++) box(1.2, 0.12, 0.12, 0xd8dce6, 5.2, 0.4 - n * 0.6, 0, raft);
for (const z of [-0.6, 0.6]) box(0.12, 4, 0.12, 0xd8dce6, 5.2, -1.2, z, raft);
scene.add(raft);
// The sunken boat on the Twilight Slope
(function () {
  const wreck = new THREE.Group();
  wreck.position.set(WRECK.x, -depthAt(WRECK.x, WRECK.z) + 1.6, WRECK.z);
  wreck.rotation.set(0.25, 0.8, 0.5);
  box(5, 3.4, 16, 0x6a4a36, 0, 0, 0, wreck);
  box(4.2, 0.4, 14.6, 0x8a6a4a, 0, 1.8, 0, wreck);
  box(3, 2.4, 4, 0xb8b0a0, 0, 3.2, -3, wreck);
  box(0.4, 9, 0.4, 0x5a4030, 0, 5, 3, wreck).rotation.z = 0.5;
  for (const z of [-5, 0, 5]) box(5.2, 0.5, 0.5, 0x4a3426, 0, -0.6, z, wreck);
  scene.add(wreck);
})();
// A coral arch in the Coral Gardens marks the first tablet
(function () {
  const arch = new THREE.Mesh(new THREE.TorusGeometry(6, 1.3, 8, 18, Math.PI), paint(0xff8a6a));
  arch.position.set(TABLETS[0].x, -depthAt(TABLETS[0].x, TABLETS[0].z) - 0.5, TABLETS[0].z);
  arch.rotation.y = 0.6;
  scene.add(arch);
})();
// The Tide Tablets: old stones with a glowing sign carved on them
const tabletModels = TABLETS.map(function (tablet, n) {
  const stone = new THREE.Group();
  stone.position.set(tablet.x, -depthAt(tablet.x, tablet.z), tablet.z);
  box(1.8, 2.6, 0.5, 0x8a8694, 0, 1.3, 0, stone).rotation.z = 0.06;
  const sign = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 4 + n * 2), glowPaint(0x7affe0));
  sign.position.set(0, 1.6, 0.27);
  const back = sign.clone();
  back.position.z = -0.27;
  back.rotation.y = Math.PI;
  stone.add(sign, back);
  stone.rotation.y = n * 1.3;
  scene.add(stone);
  tablet.y = stone.position.y + 1.4;
  return stone;
});
// The Great Shell at the bottom of the Trench. Its lid lifts when you bring all four tablets.
const shellLid = new THREE.Group();
const heartPearl = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
(function () {
  const y = -depthAt(HEART.x, HEART.z);
  HEART.y = y + 3;
  const pale = new THREE.MeshLambertMaterial({ color: 0xe8d8f0, side: THREE.DoubleSide, emissive: 0x2a2440 });
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), pale);
  bowl.position.set(HEART.x, y + 4.5, HEART.z);
  bowl.scale.y = 0.6;
  const lid = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), pale);
  lid.scale.y = 0.6;
  lid.position.z = 7;
  shellLid.add(lid);
  shellLid.position.set(HEART.x, y + 4.6, HEART.z - 7);
  heartPearl.position.set(HEART.x, y + 4, HEART.z);
  for (let k = 0; k < 8; k++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), glowPaint(k % 2 ? 0x7affe0 : 0xc08aff));
    lamp.position.set(HEART.x + Math.cos(k * 0.785) * 11, -depthAt(HEART.x + Math.cos(k * 0.785) * 11, HEART.z + Math.sin(k * 0.785) * 11) + 1.2, HEART.z + Math.sin(k * 0.785) * 11);
    scene.add(lamp);
  }
  // (the Sea Heart shines: a soft halo of light round it)
  const haloBoard = document.createElement("canvas");
  haloBoard.width = haloBoard.height = 64;
  const g2 = haloBoard.getContext("2d"), fade = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(0.4, "rgba(255,255,255,0.35)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  g2.fillStyle = fade;
  g2.fillRect(0, 0, 64, 64);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloBoard), color: 0xfff0b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  halo.scale.set(9, 9, 1);
  heartPearl.add(halo);
  scene.add(bowl, shellLid, heartPearl);
})();
// The Bubble: your mini-sub. A glass ball in a yellow ring, with two lamps and a propeller.
const bubbleSub = new THREE.Group();
(function () {
  bubbleSub.add(new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 12), new THREE.MeshPhongMaterial({ color: 0xbfefff, transparent: true, opacity: 0.35, shininess: 120 })));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.28, 8, 24), paint(0xf2c02a));
  ring.rotation.x = Math.PI / 2;
  bubbleSub.add(ring);
  box(1.2, 0.5, 1.6, 0xf2c02a, 0, -1.5, 0, bubbleSub);
  box(0.3, 0.3, 1.2, 0x5a6070, 0, -0.2, 2, bubbleSub);
  box(0.12, 1.6, 0.3, 0xd8dce6, 0, -0.2, 2.6, bubbleSub);
  for (const x of [-1.2, 1.2]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), glowPaint(0xfff6c8));
    lamp.position.set(x, -0.6, -1.4);
    bubbleSub.add(lamp);
  }
  bubbleSub.visible = false;
  scene.add(bubbleSub);
})();

// ----- Creatures -----
// Every creature is built from a few simple shapes. They all face along +z, so "forwards" is the same for everyone.
const dab = function (shape, material, x, y, z, sx, sy, sz, parent) {
  const mesh = new THREE.Mesh(shape, typeof material === "object" ? material : paint(material));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  parent.add(mesh);
  return mesh;
};
// A fish: a body, a tail that wags, a fin on top and two eyes. "glow" fish shine in the dark.
function fishModel(body, fin, more) {
  const opts = more || {}, group = new THREE.Group(), tail = new THREE.Group();
  const skin = opts.glow ? glowPaint(body) : body, finSkin = opts.glow ? glowPaint(fin) : fin;
  dab(BALL, skin, 0, 0, 0, 0.34 * (opts.wide || 1), 0.5 * (opts.tall || 1), 1, group);
  tail.position.z = -0.85;
  dab(CONE, finSkin, 0, 0, -0.3, 0.07, 0.7, 0.6, tail).rotation.x = Math.PI / 2;
  dab(CONE, finSkin, 0, 0.5 * (opts.tall || 1), -0.1, 0.05, 0.4, 0.4, group);
  for (const side of [-1, 1]) {
    dab(BALL, 0xffffff, side * 0.25 * (opts.wide || 1), 0.12, 0.62, 0.1, 0.1, 0.1, group);
    dab(BALL, 0x101018, side * 0.3 * (opts.wide || 1), 0.12, 0.66, 0.05, 0.05, 0.05, group);
  }
  if (opts.stripes) for (const z of [0.25, -0.2]) dab(BALL, opts.stripes, 0, 0, z, 0.36, 0.52, 0.09, group);
  if (opts.teeth) for (let k = -2; k <= 2; k++) dab(CONE, 0xffffff, k * 0.09, -0.16, 0.9, 0.04, 0.16, 0.04, group).rotation.x = Math.PI;
  group.add(tail);
  return { group: group, tail: tail };
}
function rayModel(top, under, glow) {
  const group = new THREE.Group(), wings = [];
  dab(BALL, glow ? glowPaint(top) : top, 0, 0, 0, 0.7, 0.16, 1, group);
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.x = side * 0.5;
    dab(BALL, glow ? glowPaint(under) : top, side * 0.75, 0, -0.05, 0.85, 0.07, 0.7, wing);
    group.add(wing);
    wings.push(wing);
  }
  dab(STICK, under, 0, 0, -1.6, 0.04, 1.6, 0.04, group).rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) dab(BALL, 0x101018, side * 0.3, 0.12, 0.8, 0.07, 0.07, 0.07, group);
  return { group: group, wings: wings };
}
// What lives in the sea. depth: how deep the sea bed is where it lives. rise: how far up from the sea bed it swims (1 is all the way to the top).
// shy: it darts away from you. school: how many swim together. hunter: it chases you (range to notice you, reach and harm of its bite).
const SPECIES = {
  sunnyfin: { name: "Sunnyfin", count: 30, school: 5, depth: [4, 16], rise: 0.8, speed: 3, size: 0.45, shy: true, make: () => fishModel(0xffd84a, 0xff9a2a),
    text: "A little yellow fish that lives near the top where the water is warm. Sunnyfins always swim in a gang." },
  stripetail: { name: "Stripetail", count: 18, school: 3, depth: [14, 46], side: "coral", rise: 0.5, speed: 2.6, size: 0.6, shy: true, make: () => fishModel(0x4a9af0, 0xf2f2f6, { stripes: 0xf2f2f6, tall: 1.2 }),
    text: "It nibbles the coral clean. The white stripes help it hide among the sea fans." },
  puffball: { name: "Puffball", count: 9, depth: [5, 34], rise: 0.5, speed: 1.2, size: 0.55, puffs: true, make: function () {
    const model = fishModel(0xf0a8d8, 0xc86aa8, { wide: 2.4, tall: 1.4 });
    for (let k = 0; k < 8; k++) dab(CONE, 0xffffff, Math.cos(k * 0.785) * 0.6, Math.sin(k * 0.785) * 0.6, 0, 0.07, 0.3, 0.07, model.group).rotation.z = k * 0.785 - Math.PI / 2;
    return model;
  }, text: "Swim close and it puffs itself up to twice its size to look scary. It is not scary at all." },
  skitter: { name: "Sand Skitter", count: 12, depth: [4, 30], rise: 0, speed: 1.6, size: 0.5, crawl: true, make: function () {
    const group = new THREE.Group();
    dab(BALL, 0xe0603a, 0, 0.2, 0, 0.7, 0.3, 0.55, group);
    for (const side of [-1, 1]) {
      dab(BALL, 0xf07a4a, side * 0.75, 0.25, 0.45, 0.28, 0.2, 0.3, group);
      for (const z of [-0.3, 0, 0.3]) dab(STICK, 0xb8482a, side * 0.75, 0.08, z, 0.05, 0.5, 0.05, group).rotation.z = side * 1.1;
      dab(BALL, 0x101018, side * 0.2, 0.5, 0.4, 0.07, 0.07, 0.07, group);
    }
    return { group: group };
  }, text: "A crab that scuttles sideways over the sand looking for crumbs. Its shell is as orange as a sunset." },
  glider: { name: "Kelp Glider", count: 9, depth: [14, 46], side: "kelp", rise: 0.6, speed: 2.2, size: 1.1, make: () => rayModel(0x5a7a4a, 0xd8e8b0),
    text: "It flies through the kelp like a slow green kite, flapping its wide wings." },
  stingcap: { name: "Stingcap", count: 18, depth: [34, 125], rise: 0.7, speed: 0.5, size: 0.8, jelly: true, make: function () {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8ad8, transparent: true, opacity: 0.8, side: THREE.DoubleSide, fog: false })));      // (no mist on it: it glows, so you can see it from far away)
    for (let k = 0; k < 6; k++) dab(STICK, new THREE.MeshBasicMaterial({ color: 0xffc0f0, fog: false }), Math.cos(k * 1.05) * 0.45, -0.9, Math.sin(k * 1.05) * 0.45, 0.04, 1.8, 0.04, group);
    return { group: group };
  }, text: "A jellyfish that glows pink. Its trailing arms sting, so admire it from a little way off." },
  lampback: { name: "Lampback Turtle", count: 5, depth: [40, 112], rise: 0.5, speed: 1.5, size: 1.6, make: function () {
    const group = new THREE.Group(), wings = [];
    dab(BALL, 0x3a7a5a, 0, 0, 0, 0.8, 0.4, 1, group);
    for (const [x, z] of [[0, 0.3], [0.3, -0.2], [-0.3, -0.2], [0, -0.5]]) dab(BALL, glowPaint(0x9affd0), x, 0.3, z, 0.16, 0.1, 0.16, group);
    dab(BALL, 0x6aa87a, 0, 0, 1.1, 0.26, 0.24, 0.32, group);
    for (const side of [-1, 1]) {
      const flipper = new THREE.Group();
      flipper.position.set(side * 0.7, -0.05, 0.4);
      dab(BALL, 0x6aa87a, side * 0.5, 0, 0, 0.6, 0.06, 0.26, flipper);
      group.add(flipper);
      wings.push(flipper);
      dab(BALL, 0x101018, side * 0.14, 0.08, 1.32, 0.05, 0.05, 0.05, group);
    }
    return { group: group, wings: wings };
  }, text: "An old, gentle turtle. The spots on its shell glow, so its friends can find it in the gloom." },
  snapjaw: { name: "Snapjaw", count: 7, depth: [48, 125], rise: 0.35, speed: 2.4, size: 1.5, hunter: { range: 17, speed: 6.4, reach: 1.9, bite: 18, wait: 2.2, fearsTorch: true }, make: () => fishModel(0x8a2a3a, 0x5a1a26, { wide: 1.2, teeth: true }),
    text: "DANGER. A fierce hunter of the Twilight Slope. It hates bright light: shine your torch at it and it turns tail." },
  moonmanta: { name: "Moon Manta", count: 3, depth: [112, 210], rise: 0.6, speed: 2.4, size: 4, make: () => rayModel(0x8ab8ff, 0xe0f0ff, true),
    text: "A huge, peaceful ray that shines like the moon. It glides over the edge of the Trench." },
  glowfry: { name: "Glowfry", count: 24, school: 6, depth: [125, 310], rise: 0.4, speed: 2.2, size: 0.3, shy: true, make: () => fishModel(0x7affe0, 0xc8fff0, { glow: true }),
    text: "Tiny fish that make their own light. A whole gang of them looks like a drifting cloud of stars." },
  lanternjaw: { name: "Lanternjaw", count: 4, depth: [150, 310], rise: 0.4, speed: 2.6, size: 3.4, hunter: { range: 26, speed: 8.5, reach: 3.6, bite: 34, wait: 2.6 }, make: function () {
    const model = fishModel(0x34344e, 0x4a4a6a, { wide: 1.5, tall: 1.3, teeth: true });
    dab(STICK, 0x34344c, 0, 0.75, 0.7, 0.03, 0.7, 0.03, model.group).rotation.x = 0.7;
    dab(BALL, glowPaint(0xfff27a), 0, 1.02, 1.02, 0.14, 0.14, 0.14, model.group);
    return model;
  }, text: "DANGER. The terror of the Trench. It dangles a little lamp to tempt fish closer. Only the Bubble keeps you safe from it." },
  oldblue: { name: "Old Blue", count: 1, depth: [50, 110], giant: true, speed: 3.2, size: 9, make: function () {
    const group = new THREE.Group(), tail = new THREE.Group();
    dab(BALL, 0x3a6aa8, 0, 0, 0, 0.42, 0.42, 1, group);
    dab(BALL, 0xc8dcf0, 0, -0.12, 0.1, 0.36, 0.32, 0.9, group);
    tail.position.z = -0.9;
    dab(BALL, 0x3a6aa8, 0, 0, -0.2, 0.5, 0.05, 0.22, tail);
    for (const side of [-1, 1]) {
      dab(BALL, 0x3a6aa8, side * 0.45, -0.15, 0.35, 0.28, 0.04, 0.14, group);
      dab(BALL, 0x101018, side * 0.33, 0.06, 0.72, 0.03, 0.03, 0.03, group);
    }
    group.add(tail);
    return { group: group, tail: tail, flatTail: true };
  }, text: "A whale as long as four buses. Old Blue has swum the same slow circle round these waters for a hundred years." },
};
const creatures = [];
for (const kind in SPECIES) {
  const spec = SPECIES[kind];
  let leader = null;
  for (let n = 0; n < spec.count; n++) {
    // Find a home: somewhere the sea is the right depth (and on the right side, for kelp and coral creatures)
    let home = null;
    for (let tries = 0; tries < 400 && !home; tries++) {
      const at = spot(hash(n, tries, 51 + kind.length) * 360, 12 + hash(n, tries, 52 + kind.length) * (WORLD - 30)), deep = depthAt(at.x, at.z);
      if (deep >= spec.depth[0] && deep <= spec.depth[1] && (!spec.side || zoneAt(at.x, at.z) === spec.side)) home = at;
    }
    if (!home) continue;
    const follows = spec.school && n % spec.school !== 0 ? leader : null;
    const model = spec.make();
    model.group.scale.setScalar(spec.size);
    model.group.rotation.order = "YXZ";
    scene.add(model.group);
    const c = { kind: kind, spec: spec, model: model, home: follows ? follows.home : home, leader: follows, x: (follows || { x: home.x }).x + (follows ? (hash(n, 1, 53) - 0.5) * 3 : 0), z: (follows || { z: home.z }).z + (follows ? (hash(n, 2, 53) - 0.5) * 3 : 0), y: 0,
      yaw: hash(n, 3, 53) * 6.283, pitch: 0, goal: null, timer: 0, cool: 0, puff: 1, off: [(hash(n, 4, 53) - 0.5) * 3, (hash(n, 5, 53) - 0.5) * 1.6, (hash(n, 6, 53) - 0.5) * 3], phase: hash(n, 7, 53) * 6 };
    c.y = -depthAt(c.x, c.z) * (1 - (spec.rise || 0) * 0.5) - 1;
    if (!follows) leader = c;
    creatures.push(c);
  }
}

// ----- What the game remembers -----
const SAVE_NAME = "deepwildSave";
const freshState = () => ({ bag: { shell: 0, kelp: 0, copper: 0, quartz: 0, salvage: 0, pearl: 0 }, gear: {}, tablets: [false, false, false, false], journal: [], won: false, subAt: null });
let state = freshState();
const DOCK = { x: 12, y: -1.8, z: 7 };           // where the Bubble waits, a little way from the raft
const player = { x: 7, y: -0.5, z: 0, vx: 0, vy: 0, vz: 0, yaw: -Math.PI / 2, pitch: 0, air: 45, hp: 100, inSub: false };
let mode = "title";          // title, raft, swim
let card = null;             // a message on the screen (press Space to go on)
let torchOn = false, scanTime = 0, shake = 0, shellOpen = 0, warned = 0, hudTimer = 0, saveTimer = 0, airBeep = 0;
const maxAir = () => (state.gear.tank2 ? 150 : state.gear.tank1 ? 90 : 45);
const depthLimit = () => (player.inSub ? 335 : state.gear.suit ? 150 : 60);
function save() {
  try { localStorage.setItem(SAVE_NAME, JSON.stringify(state)); } catch (error) { /* keep playing */ }
}
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_NAME)); } catch (error) { return null; }
}
let toastTimer = 0;
function toast(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastTimer = seconds || 3.5;
}
function showCard(lines, done) {
  card = { lines: lines, index: 0, done: done };
  el("card-text").textContent = lines[0];
  el("card").hidden = false;
}
function nextCard() {
  if (!card) return;
  card.index++;
  if (card.index < card.lines.length) return (el("card-text").textContent = card.lines[card.index]);
  const done = card.done;
  card = null;
  el("card").hidden = true;
  if (done) done();
}

// ----- Keyboard and mouse -----
const keys = {};
let scanning = false;
document.addEventListener("keydown", function (event) {
  if (event.target.tagName === "INPUT") return;
  if (event.code === "Space" || event.code === "Tab" || event.code.startsWith("Arrow")) event.preventDefault();
  if (event.repeat) return;
  keys[event.code] = true;
  if (card) return void ((event.code === "Space" || event.code === "Enter") && nextCard());
  if (mode !== "swim") return;
  if (event.code === "KeyE") interact();
  if (event.code === "KeyF") {
    if (!state.gear.torch) toast("You have no torch yet. Make one at the raft.", 3);
    else {
      torchOn = !torchOn;
      sfx.pick();
    }
  }
  if (event.code === "KeyJ") toggleJournal();
});
document.addEventListener("keyup", (event) => (keys[event.code] = false));
canvas.addEventListener("mousedown", function (event) {
  if (mode !== "swim" || card) return;
  if (!TEST && document.pointerLockElement !== canvas) return void canvas.requestPointerLock();
  if (event.button === 2) scanning = true;
});
document.addEventListener("mouseup", (event) => event.button === 2 && (scanning = false));
document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("mousemove", function (event) {
  if (mode !== "swim" || document.pointerLockElement !== canvas) return;
  player.yaw -= event.movementX * 0.0024;
  player.pitch = clamp(player.pitch - event.movementY * 0.0024, -1.5, 1.5);
});
const lookWay = () => [-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch)];

// ----- Getting hurt -----
function hurt(amount, why) {
  if (mode !== "swim" || card) return;
  player.hp -= amount;
  shake = 0.35;
  sfx.hurt();
  el("tint").style.boxShadow = "inset 0 0 120px 40px rgba(255, 60, 60, 0.6)";
  setTimeout(() => (el("tint").style.boxShadow = ""), 250);
  if (why) toast(why, 4);
  if (player.hp > 0) return;
  // No strength left: you are pulled back up to your raft, but the sea keeps half of what you were carrying
  for (const kind in state.bag) state.bag[kind] = Math.ceil(state.bag[kind] / 2);
  state.subAt = null;
  player.inSub = false;
  goToRaft();
  showCard(["Everything goes dark...", "You wake up on your raft, coughing. A friendly current must have carried you home.", "The sea kept half of what you were carrying. Next time, turn back while you still have plenty of air!"]);
}

// ----- The raft: your home, and your workshop -----
function goToRaft() {
  mode = "raft";
  Object.assign(player, { x: 7, y: -0.5, z: 0, vx: 0, vy: 0, vz: 0, air: maxAir(), hp: Math.max(player.hp, 60), inSub: false });
  if (player.hp <= 0) player.hp = 60;
  torchOn = false;
  scanning = false;
  if (document.pointerLockElement) document.exitPointerLock();
  el("raft").hidden = false;
  el("prompt").hidden = true;
  drawRaftMenu();
  save();
}
function drawRaftMenu() {
  const list = el("recipes");
  list.innerHTML = "";
  for (const recipe of RECIPES) {
    const button = document.createElement("button");
    const made = Boolean(state.gear[recipe.id]), locked = recipe.after && !state.gear[recipe.after];
    const enough = Object.keys(recipe.needs).every((kind) => state.bag[kind] >= recipe.needs[kind]);
    button.className = "recipe" + (made ? " made" : "");
    button.disabled = made || locked || !enough;
    const needs = Object.keys(recipe.needs).map((kind) => '<span class="' + (state.bag[kind] >= recipe.needs[kind] ? "ok" : "short") + '">' + recipe.needs[kind] + " " + LOOT[kind].name.toLowerCase() + "</span>").join(", ");
    button.innerHTML = "<b>" + recipe.name + "</b>" + (made ? " ✓ made" : locked ? " (make the " + RECIPES.find((other) => other.id === recipe.after).name.toLowerCase() + " first)" : "") + "<br>" + recipe.does + (made ? "" : "<br>Needs: " + needs);
    button.addEventListener("click", function () {
      for (const kind in recipe.needs) state.bag[kind] -= recipe.needs[kind];
      state.gear[recipe.id] = true;
      sfx.make();
      toast("You made: " + recipe.name + "! " + recipe.does, 5);
      if (recipe.id === "bubble") toast("You built the Bubble! It is bobbing beside the raft. Swim up to it and press E to climb in.", 7);
      drawRaftMenu();
      save();
    });
    list.appendChild(button);
  }
  el("bag-list").textContent = Object.keys(LOOT).map((kind) => LOOT[kind].name + ": " + state.bag[kind]).join("   ");
}
el("rest").addEventListener("click", function () {
  player.hp = 100;
  for (const thing of loot) if (thing.taken) {
    thing.taken = false;
    showLoot(thing, true);
  }
  sfx.make();
  toast("You sleep under the stars. In the morning you feel strong again, and the sea has washed in new things to find.", 6);
  save();
});
el("dive").addEventListener("click", function () {
  el("raft").hidden = true;
  mode = "swim";
  Object.assign(player, { x: 7.2, y: -0.6, z: 0, yaw: -Math.PI / 2, pitch: -0.3, air: maxAir() });
  sfx.splash();
  if (!TEST) canvas.requestPointerLock();
});
function toggleJournal() {
  const page = el("journal");
  page.hidden = !page.hidden;
  if (page.hidden) return;
  if (document.pointerLockElement) document.exitPointerLock();
  const kinds = Object.keys(SPECIES);
  el("journal-list").innerHTML = "<p>You have scanned " + state.journal.length + " of " + kinds.length + " creatures. Hold the right mouse button (or Q) while you look at one.</p>" +
    kinds.map((kind) => (state.journal.includes(kind) ? "<p><b>" + SPECIES[kind].name + "</b><br>" + SPECIES[kind].text + "</p>" : '<p class="unknown"><b>???</b><br>Not scanned yet. It lives where the sea is ' + SPECIES[kind].depth[0] + " to " + SPECIES[kind].depth[1] + " metres deep.</p>")).join("");
}
el("journal-button").addEventListener("click", toggleJournal);
el("journal-close").addEventListener("click", toggleJournal);

// ----- Doing things with E -----
// What is close enough to use? (The nearest thing wins.)
function nearby() {
  const near = (place, reach) => Math.hypot(place.x - player.x, (place.y === undefined ? player.y : place.y) - player.y, place.z - player.z) < reach;
  if (!player.inSub && player.y > -4 && Math.hypot(player.x - 5.5, player.z) < 3.8) return { text: "E: climb onto your raft", act: goToRaft };
  const sub = state.subAt || DOCK;
  if (state.gear.bubble && !player.inSub && near(sub, 5)) return { text: "E: climb into the Bubble", act: function () {
    Object.assign(player, { inSub: true, x: sub.x, y: sub.y, z: sub.z });
    sfx.make();
    toast("You are in the Bubble: endless air, and safe from every creature. E: climb out.", 5);
  } };
  for (let n = 0; n < TABLETS.length; n++) {
    if (!state.tablets[n] && near(TABLETS[n], 5)) return { text: "E: read the Tide Tablet", act: function () {
      state.tablets[n] = true;
      sfx.scan();
      const found = state.tablets.filter(Boolean).length;
      showCard([TABLETS[n].text, found === 4 ? "That is all four tablets! Now take them down to the Great Shell, at the very bottom of the Trench." : "You have " + found + " of the 4 Tide Tablets."], save);
    } };
  }
  if (near(HEART, 12)) {
    if (state.won) return null;
    if (state.tablets.includes(false)) return { text: "The Great Shell is shut tight. It needs all four Tide Tablets.", act: () => toast("You need all four Tide Tablets to open the Great Shell.", 4) };
    return { text: "E: hold up the four Tide Tablets", act: function () {
      state.won = true;
      shellOpen = 0.001;
      sfx.win();
      showCard(["The four tablets begin to hum. With a deep, slow groan, the Great Shell opens...", "Inside lies the SEA HEART: a pearl as big as a boat, shining like a second sun. Its light rolls out through the dark water.", "Far above, the creatures of the sea turn towards it. The Trench is not dark any more.", "YOU DID IT! You found the Sea Heart, the greatest secret of the deep. You can keep exploring: can you scan every creature for your journal?"], save);
    } };
  }
  let best = null, bestFar = player.inSub ? 5.5 : 3;
  for (const thing of loot) {
    if (thing.taken || Math.abs(thing.x - player.x) > 6 || Math.abs(thing.z - player.z) > 6) continue;
    const far = Math.hypot(thing.x - player.x, thing.y + 0.3 - player.y, thing.z - player.z);
    if (far < bestFar) [best, bestFar] = [thing, far];
  }
  if (best) return { text: "E: pick up " + LOOT[best.kind].name.toLowerCase(), act: function () {
    best.taken = true;
    showLoot(best, false);
    state.bag[best.kind]++;
    sfx.pick();
    toast("+1 " + LOOT[best.kind].name.toLowerCase() + " (you have " + state.bag[best.kind] + ")", 2);
  } };
  if (player.inSub) return { text: "E: climb out of the Bubble", act: function () {
    state.subAt = { x: player.x, y: player.y, z: player.z };
    player.inSub = false;
    player.air = maxAir();
    player.y += 1.5;
    sfx.splash();
  } };
  return null;
}
function interact() {
  const thing = nearby();
  if (thing) thing.act();
}

// ----- Swimming -----
function swim(dt) {
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), across = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const rise = (keys.Space ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0);
  player.yaw -= ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 1.8 * dt;          // (the left and right arrows turn you, if you would rather not use the mouse)
  const way = lookWay(), side = [Math.cos(player.yaw), 0, -Math.sin(player.yaw)];
  let wx = way[0] * ahead + side[0] * across, wy = way[1] * ahead + rise, wz = way[2] * ahead + side[2] * across;
  const length = Math.hypot(wx, wy, wz) || 1;
  const boost = state.gear.zipfin && (keys.ShiftLeft || keys.ShiftRight) && !player.inSub;
  const speed = player.inSub ? (state.gear.booster ? 21 : 12) : (state.gear.flippers ? 7 : 5) * (boost ? 1.9 : 1);
  const want = ahead || across || rise ? speed : 0;
  player.vx += ((wx / length) * want - player.vx) * Math.min(1, dt * 3);
  player.vy += ((wy / length) * want - player.vy) * Math.min(1, dt * 3);
  player.vz += ((wz / length) * want - player.vz) * Math.min(1, dt * 3);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.z += player.vz * dt;
  // You can't swim through the sea bed, above the waves, or out of this part of the sea
  const floor = -depthAt(player.x, player.z) + (player.inSub ? 2 : 0.9), top = player.inSub ? -1.6 : 0.25;
  if (player.y < floor) [player.y, player.vy] = [floor, Math.max(0, player.vy)];
  if (player.y > top) [player.y, player.vy] = [top, Math.min(0, player.vy)];
  const far = Math.hypot(player.x, player.z);
  if (far > WORLD - 4) {
    player.x *= (WORLD - 4) / far;
    player.z *= (WORLD - 4) / far;
    if (clock.value > warned) {
      warned = clock.value + 5;
      toast("A strong current pushes you back. This is as far as you can go.", 3);
    }
  }
  const raftGap = Math.hypot(player.x, player.z);
  if (player.y > -1.6 && raftGap < 6.4 && raftGap > 0.01) {       // (the raft is in the way)
    player.x *= 6.4 / raftGap;
    player.z *= 6.4 / raftGap;
  }
  // Air: it runs down under water, and fills up again at the top (or inside the Bubble)
  const under = player.y < -0.35 && !player.inSub;
  if (under) player.air -= dt;
  else player.air = Math.min(maxAir(), player.air + dt * 30);
  if (under && Math.random() < dt * (boost ? 8 : 2.5)) blowBubble();
  if (player.air <= 0) {
    player.air = 0;
    player.hp -= 11 * dt;
    if (clock.value > airBeep) {
      airBeep = clock.value + 1.2;
      hurt(0.01, "You are out of air! Swim up, quickly!");
    }
  } else if (player.air < 12 && under && clock.value > airBeep) {
    airBeep = clock.value + 2;
    sfx.warn();
    toast("Your air is running low! Head for the surface.", 2);
  }
  if (!under && player.hp < 100) player.hp = Math.min(100, player.hp + dt * 2);
  // Going deeper than your gear allows squeezes you
  const deep = -player.y;
  if (deep > depthLimit()) {
    player.hp -= 7 * dt;
    if (clock.value > warned) {
      warned = clock.value + 2.5;
      hurt(0.01, player.inSub ? "Even the Bubble can't go any deeper!" : state.gear.suit ? "Too deep, even for your deep suit! Only the Bubble can go further down." : "Too deep! The water is squeezing you. Swim up, or make a deep suit.");
    }
  } else if (deep > depthLimit() - 8 && clock.value > warned) {
    warned = clock.value + 6;
    sfx.warn();
    toast("Careful: you are almost as deep as your " + (player.inSub ? "Bubble" : state.gear.suit ? "deep suit" : "body") + " can go (" + depthLimit() + " metres).", 3);
  }
  if (player.hp <= 0) hurt(0.01);
}
function blowBubble() {
  const bubble = bubbles.find((each) => each.userData.life <= 0);
  if (!bubble) return;
  const way = lookWay();
  bubble.position.set(player.x + way[0] * 0.5 + (Math.random() - 0.5) * 0.3, player.y - 0.2, player.z + way[2] * 0.5 + (Math.random() - 0.5) * 0.3);
  bubble.scale.setScalar(0.5 + Math.random());
  bubble.userData = { life: 2.5, drift: Math.random() * 6 };
  bubble.visible = true;
  if (Math.random() < 0.25) sfx.bubble();
}

// ----- How the creatures behave -----
function updateCreatures(dt) {
  const way = lookWay(), swimming = mode === "swim" && !card;
  for (const c of creatures) {
    const spec = c.spec, model = c.model;
    const dx = player.x - c.x, dy = player.y - c.y, dz = player.z - c.z, far = Math.hypot(dx, dy, dz);
    c.far = far;
    model.group.visible = far < 190;
    if (far > 190 && !spec.giant) continue;          // (too far away to matter)
    c.timer -= dt;
    c.cool -= dt;
    let speed = spec.speed, turning = spec.giant ? 0.35 : 2.4;
    if (spec.giant) {
      // Old Blue swims a great slow circle round the raft
      const round = Math.atan2(c.z, c.x) + 0.2;
      c.goal = { x: Math.cos(round) * 235, y: -34, z: Math.sin(round) * 235 };
    } else if (spec.hunter && swimming && far < spec.hunter.range) {
      const lit = spec.hunter.fearsTorch && torchOn && far < 18 && (-dx * way[0] - dy * way[1] - dz * way[2]) / far > 0.84;
      if (lit) {
        c.goal = { x: c.x - dx * 3, y: c.y - dy * 3, z: c.z - dz * 3 };       // dazzled by your torch: it flees
        speed = spec.hunter.speed * 1.2;
      } else {
        c.goal = { x: player.x, y: player.y, z: player.z };
        speed = spec.hunter.speed;
        if (far < spec.hunter.reach && c.cool <= 0) {
          c.cool = spec.hunter.wait;
          if (player.inSub) {
            shake = 0.4;
            sfx.hurt();
            toast("A " + spec.name + " bumps the Bubble, but it can't get in!", 3);
          } else hurt(spec.hunter.bite, "A " + spec.name + " bit you! " + (spec.hunter.fearsTorch ? "Shine your torch at it, or swim away." : "Get away from it!"));
        }
      }
      c.timer = 1;
    } else if (spec.shy && swimming && far < 5.5) {
      c.goal = { x: c.x - dx * 3, y: c.y - dy * 2, z: c.z - dz * 3 };
      speed = spec.speed * 2.3;
      c.timer = 0.8;
    } else if (c.leader) {
      c.goal = { x: c.leader.x + c.off[0], y: c.leader.y + c.off[1], z: c.leader.z + c.off[2] };
      speed = spec.speed * 1.15;
    } else if (c.timer <= 0 || !c.goal) {
      // Wander: pick somewhere new to swim to, not far from home
      const angle = Math.random() * 6.283, out = Math.random() * 22;
      const gx = c.home.x + Math.cos(angle) * out, gz = c.home.z + Math.sin(angle) * out, deep = depthAt(gx, gz);
      c.goal = { x: gx, z: gz, y: -deep + 1.2 + Math.random() * deep * (spec.rise || 0) * 0.8 };
      c.timer = 4 + Math.random() * 6;
    }
    if (spec.jelly && swimming && !player.inSub && far < spec.size * 1.7 && c.cool <= 0) {
      c.cool = 2;
      hurt(12, "A Stingcap stung you! Swim round them, not through them.");
    }
    if (spec.puffs) c.puff += ((far < 6 ? 1.8 : 1) - c.puff) * Math.min(1, dt * 5);
    // Turn towards the goal, then swim forwards
    const gx = c.goal.x - c.x, gy = c.goal.y - c.y, gz = c.goal.z - c.z, flat = Math.hypot(gx, gz);
    let turn = Math.atan2(gx, gz) - c.yaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    c.yaw += clamp(turn, -turning * dt, turning * dt);
    c.pitch += (clamp(Math.atan2(gy, flat || 1), -0.7, 0.7) - c.pitch) * Math.min(1, dt * 2);
    if (flat + Math.abs(gy) < 1.5 && !spec.hunter) speed *= 0.3;
    if (spec.jelly) speed = spec.speed * (0.4 + Math.max(0, Math.sin(clock.value * 1.6 + c.phase)));      // jellyfish swim in pulses
    c.x += Math.sin(c.yaw) * Math.cos(c.pitch) * speed * dt;
    c.z += Math.cos(c.yaw) * Math.cos(c.pitch) * speed * dt;
    c.y += Math.sin(c.pitch) * speed * dt;
    const floor = -depthAt(c.x, c.z) + (spec.crawl ? 0.05 : spec.size * 0.7 + 0.4);
    c.y = spec.crawl ? floor : clamp(c.y, floor, -spec.size * 0.8 - 0.6);
    // Show it: tails wag, wings flap, jellyfish pulse
    model.group.position.set(c.x, c.y, c.z);
    model.group.rotation.set(spec.jelly || spec.crawl ? 0 : -c.pitch, c.yaw, 0);
    const beat = clock.value * (2 + speed * 1.6) + c.phase;
    if (model.tail) model.tail.rotation[model.flatTail ? "x" : "y"] = Math.sin(beat) * (model.flatTail ? 0.3 : 0.5);
    if (model.wings) model.wings.forEach((wing, n) => (wing.rotation.z = Math.sin(beat * 0.5) * 0.45 * (n ? -1 : 1)));
    const pulse = spec.jelly ? 1 + Math.sin(clock.value * 1.6 + c.phase) * 0.12 : 1;
    model.group.scale.set(spec.size * c.puff * pulse, spec.size * c.puff * (2 - pulse), spec.size * c.puff * pulse);
  }
}

// ----- Scanning: hold the right mouse button (or Q) while you look at a creature -----
function updateScan(dt) {
  const wanting = (scanning || keys.KeyQ) && mode === "swim" && !card;
  let seen = null, best = 0.94;
  if (wanting) {
    const way = lookWay();
    for (const c of creatures) {
      if (c.far > 9 + c.spec.size * 4) continue;
      const lined = ((c.x - player.x) * way[0] + (c.y - player.y) * way[1] + (c.z - player.z) * way[2]) / c.far;
      if (lined > best - Math.min(0.12, c.spec.size * 0.03)) [seen, best] = [c, lined];
    }
  }
  scanTime = seen ? scanTime + dt : 0;
  el("scan").hidden = !wanting;
  el("scan-fill").style.width = Math.min(100, (scanTime / 1.3) * 100) + "%";
  el("scan-text").textContent = !wanting ? "" : seen ? "Scanning..." : "Point at a creature (get close)";
  if (seen && scanTime >= 1.3) {
    scanTime = 0;
    scanning = false;
    keys.KeyQ = false;
    sfx.scan();
    if (state.journal.includes(seen.kind)) toast(seen.spec.name + ": already in your sea journal (J).", 3);
    else {
      state.journal.push(seen.kind);
      toast("NEW in your sea journal: " + seen.spec.name + "! (" + state.journal.length + " of " + Object.keys(SPECIES).length + ". Press J to read it.)", 6);
      save();
    }
  }
}

// ----- The words on the screen -----
function goalText() {
  if (state.won) return "You found the Sea Heart! Keep exploring: can you scan every creature?";
  const found = state.tablets.filter(Boolean).length;
  if (found === 4) return "You have all four Tide Tablets! Take them to the Great Shell at the bottom of the Trench.";
  return "Find the four Tide Tablets (" + found + " of 4). The next one is by " + TABLETS[state.tablets.indexOf(false)].name + ".";
}
// Which way is a place, compared with the way you are facing? (An arrow, and how far.)
function pointer(place, name) {
  const dx = place.x - player.x, dz = place.z - player.z, far = Math.hypot(dx, dz);
  let turn = Math.atan2(-dx, -dz) - player.yaw;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  const arrow = ["↑", "↖", "←", "↙", "↓", "↘", "→", "↗"][((Math.round(turn / (Math.PI / 4)) % 8) + 8) % 8];
  const down = place.y === undefined ? "" : place.y < player.y - 3 ? ", " + Math.round(player.y - place.y) + " m below you" : place.y > player.y + 3 ? ", " + Math.round(place.y - player.y) + " m above you" : "";
  return name + " " + arrow + " " + Math.round(far) + " m" + down;
}
function updateHud() {
  const air = Math.ceil(player.air), deep = Math.max(0, -player.y);
  el("air-fill").style.width = (player.air / maxAir()) * 100 + "%";
  el("air-fill").style.background = player.air < 12 ? "#ff5a5a" : "#7ad8ff";
  el("air-text").textContent = player.inSub ? "Air: endless (in the Bubble)" : "Air: " + air + " s";
  el("hp-fill").style.width = clamp(player.hp, 0, 100) + "%";
  el("depth").textContent = Math.round(deep) + " m deep · " + ZONES[zoneAt(player.x, player.z)].name + " · you can go to " + depthLimit() + " m";
  el("bag").textContent = Object.keys(LOOT).map((kind) => LOOT[kind].name + " " + state.bag[kind]).join(" · ");
  el("goal").textContent = goalText();
  const next = state.won ? null : state.tablets.includes(false) ? TABLETS[state.tablets.indexOf(false)] : HEART;
  el("compass").textContent = pointer({ x: 5.5, z: 0, y: 0 }, "Raft") + (next ? "     " + pointer(next, state.tablets.includes(false) ? "Tablet" : "Great Shell") : "") + (state.gear.bubble && !player.inSub ? "     " + pointer(state.subAt || DOCK, "Bubble") : "");
  const thing = mode === "swim" && !card ? nearby() : null;
  el("prompt").textContent = thing ? thing.text : "";
  el("prompt").hidden = !thing;
  el("cockpit").hidden = !player.inSub || mode !== "swim";
  for (const id of ["meters", "depth", "compass", "bag", "crosshair"]) el(id).style.visibility = mode === "swim" ? "visible" : "hidden";
  el("tint").style.background = player.air < 10 && !player.inSub && mode === "swim" ? "radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, " + (0.85 - player.air * 0.06) + "))" : "";
}

// ----- Everything that happens, many times a second -----
const DEEP_BLUE = [new THREE.Color(0x35b4cc), new THREE.Color(0x0e3a5c), new THREE.Color(0x02050c)], SKY = new THREE.Color(0x9fd8ff);
function update(dt) {
  clock.value += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) el("toast").hidden = true;
  if (mode === "swim" && !card && el("journal").hidden) swim(dt);
  updateCreatures(dt);
  updateScan(dt);
  // The camera: your eyes when you swim, or a slow look round from the raft
  if (mode === "swim") {
    camera.position.set(player.x, player.y, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  } else {
    camera.position.set(Math.cos(clock.value * 0.1) * 16, 5.5, Math.sin(clock.value * 0.1) * 16);
    camera.lookAt(0, 1.5, 0);
  }
  if (shake > 0) {
    shake -= dt;
    camera.position.x += (Math.random() - 0.5) * shake * 0.4;
    camera.position.y += (Math.random() - 0.5) * shake * 0.4;
  }
  // The colour of the water and how much light there is both depend on how deep the camera is
  const eye = camera.position.y, deep = Math.max(0, -eye), part = clamp(deep / 150, 0, 1);
  const water = part < 0.5 ? DEEP_BLUE[0].clone().lerp(DEEP_BLUE[1], part * 2) : DEEP_BLUE[1].clone().lerp(DEEP_BLUE[2], part * 2 - 1);
  if (state.won) water.lerp(new THREE.Color(0x2a6a8a), 0.35 * part);           // (the Sea Heart lights up the deep)
  const colour = eye > 0 ? SKY : water;
  scene.fog.color.copy(colour);
  scene.fog.density = eye > 0 ? 0.0022 : mix(0.02, 0.034, part);
  renderer.setClearColor(colour);
  const light = eye > 0 ? 0.85 : mix(0.8, state.won ? 0.3 : 0.1, part), sun = eye > 0 ? 0.7 : mix(0.6, 0, Math.min(1, part * 1.6));
  skyLight.intensity = light;
  sunLight.intensity = sun;
  const lamps = mode === "swim" && (player.inSub || (torchOn && state.gear.torch));
  torch.intensity = lamps ? (player.inSub ? 1.5 : 1.2) : 0;
  torch.angle = player.inSub ? 0.75 : 0.5;
  const u = seaBed.uniforms, way = lookWay();
  u.fogColor.value.copy(colour);
  u.fogDensity.value = scene.fog.density;
  u.light.value = light;
  u.sun.value = sun;
  u.torchOn.value = lamps ? (player.inSub ? 1.5 : 1) : 0;
  u.torchAt.value.copy(camera.position);
  u.torchWay.value.set(way[0], way[1], way[2]);
  surface.position.set(camera.position.x, 0, camera.position.z);
  surface.material.color.set(eye > 0 ? 0x2f9ac8 : 0xbff4ff);
  surface.material.opacity = eye > 0 ? 0.82 : 0.5 + Math.sin(clock.value * 2) * 0.05;
  beams.forEach(function (beam, n) {
    beam.visible = eye < 0 && deep < 45;
    beam.position.set(camera.position.x + beam.userData.x + Math.sin(clock.value * 0.3 + n) * 2, -28, camera.position.z + beam.userData.z);
    beam.material.opacity = 0.075 * (1 - deep / 45) * (0.7 + Math.sin(clock.value + n * 2) * 0.3);
  });
  specks.visible = eye < 0;
  specks.position.set(Math.round(camera.position.x / 30) * 30, Math.round(camera.position.y / 20) * 20, Math.round(camera.position.z / 30) * 30);
  for (const bubble of bubbles) {
    if (bubble.userData.life <= 0) continue;
    bubble.userData.life -= dt;
    bubble.position.y += dt * 2.2;
    bubble.position.x += Math.sin(clock.value * 4 + bubble.userData.drift) * dt * 0.3;
    if (bubble.userData.life <= 0 || bubble.position.y > -0.05) [bubble.userData.life, bubble.visible] = [0, false];
  }
  // The Bubble, the raft's lamp, the tablets you have read, and the Great Shell opening
  const sub = state.subAt || DOCK;
  bubbleSub.visible = Boolean(state.gear.bubble) && !(player.inSub && mode === "swim");
  bubbleSub.position.set(sub.x, sub.y + Math.sin(clock.value * 1.2) * 0.08, sub.z);
  raft.position.y = Math.sin(clock.value * 0.9) * 0.08;
  raft.rotation.z = Math.sin(clock.value * 0.7) * 0.012;
  tabletModels.forEach((stone, n) => (stone.children[1].material.color.set(state.tablets[n] ? 0x3a6a6a : 0x7affe0)));
  if (state.won) shellOpen = Math.min(1, shellOpen + dt * 0.25);
  shellLid.rotation.x = -shellOpen * 1.15;
  heartPearl.visible = shellOpen > 0.05;
  heartPearl.scale.setScalar(1 + Math.sin(clock.value * 2) * 0.04);
  if ((hudTimer -= dt) <= 0) {
    hudTimer = 0.12;
    updateHud();
  }
  if (mode === "swim" && (saveTimer += dt) > 15) {
    saveTimer = 0;
    save();
  }
}
let lastTime = performance.now();
function frame(now) {
  const dt = clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ----- Starting -----
function begin(saved) {
  state = saved ? Object.assign(freshState(), saved) : freshState();
  state.bag = Object.assign(freshState().bag, state.bag);
  shellOpen = state.won ? 1 : 0;
  player.hp = 100;
  el("intro").hidden = true;
  goToRaft();
  if (!saved) showCard(["This is your raft, far out on the wide blue sea. Under it lies a whole world that nobody has ever explored.",
    "Dive in and look around. Watch your AIR: when it runs low, swim back up to the top to breathe.",
    "Pick up shells, kelp and anything else useful (E). Then climb back onto the raft to make better gear: flippers, bigger air tanks, a torch, even a little submarine.",
    "The old sailors tell of four Tide Tablets hidden under these waves, and a Great Shell at the bottom of the deepest dark. Find them, and you will find the sea's greatest secret.",
    "Hold the right mouse button (or Q) to scan the creatures you meet for your sea journal. Most are friendly. Some are not. Good luck, diver!"]);
}
el("start").addEventListener("click", () => begin(null));
el("continue").addEventListener("click", () => begin(loadSave()));
el("continue").hidden = !loadSave();
requestAnimationFrame(frame);

// Only for testing the game.
window.DW = {
  player: player, keys: keys, creatures: creatures, loot: loot, SPECIES: SPECIES,
  state: () => state, mode: () => mode, card: () => card, interact: interact, nearby: nearby, goToRaft: goToRaft, hurt: hurt, save: save,
  setTorch: (on) => (torchOn = on), scan: (on) => (scanning = on),
};
