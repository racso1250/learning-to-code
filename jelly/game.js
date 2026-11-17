// Jelly Town: a wobbly sandbox. Everything is built from simple 3D shapes with THREE.js.

const el = (id) => document.getElementById(id);
const TEST = location.search.includes("test");
const view = el("game");
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;                 // real shadows from the sun
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ecbff);
scene.fog = new THREE.Fog(0x7ecbff, 90, 330);
const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 600);
function fitView() {
  const w = view.clientWidth || 960;
  renderer.setSize(w, Math.round(w / 1.5), false);
}
window.addEventListener("resize", fitView);
fitView();
const skyLight = new THREE.HemisphereLight(0xffffff, 0x7aa868, 0.6);
scene.add(skyLight);
const sun = new THREE.DirectionalLight(0xfff1d0, 0.75);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 260 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

function sound(make) {
  try { make(); } catch (error) { /* no sound: the game still works */ }
}
const sfx = {
  boing: () => sound(() => playTone(0, 0.18, 220, 520, 0.12)),
  coin: () => sound(() => { playTone(0, 0.08, 880, 1320, 0.12); playTone(0.09, 0.12, 1320, 1760, 0.1); }),
  pick: () => sound(() => playTone(0, 0.09, 600, 900, 0.1)),
  throw: () => sound(() => playNoise(0, 0.12, 900, 2400, 0.1)),
  bonk: () => sound(() => playTone(0, 0.25, 320, 90, 0.16)),
  honk: () => sound(() => playTone(0, 0.2, 300, 280, 0.12)),
  win: () => sound(() => playJingle()),
  rocket: () => sound(() => { playNoise(0, 3.2, 200, 1400, 0.28); playTone(0, 3.2, 60, 200, 0.14); }),
};

// ----- Handy shape makers -----
const paints = new Map();
const paint = (colour) => paints.get(colour) || paints.set(colour, new THREE.MeshLambertMaterial({ color: colour })).get(colour);
const glosses = new Map();       // shiny paint, for cars and jelly
const gloss = (colour) => glosses.get(colour) || glosses.set(colour, new THREE.MeshPhongMaterial({ color: colour, shininess: 90, specular: 0x666666 })).get(colour);
function add(mesh, x, y, z, parent) {
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.still = !parent;          // (things that never move get glued together later, so they draw faster)
  (parent || scene).add(mesh);
  return mesh;
}
const usePaint = (colour) => (typeof colour === "number" ? paint(colour) : colour);
const box = (w, h, d, colour, x, y, z, parent) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), usePaint(colour)), x, y, z, parent);
const ball = (r, colour, x, y, z, parent) => add(new THREE.Mesh(new THREE.SphereGeometry(r, 10, 7), usePaint(colour)), x, y, z, parent);
const tube = (r1, r2, h, colour, x, y, z, parent) => add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, r1 > 10 ? 40 : 10), usePaint(colour)), x, y, z, parent);
// Paint a little picture to wrap onto a shape
function picture(w, h, draw, repeat) {
  const board = document.createElement("canvas");
  board.width = w;
  board.height = h;
  draw(board.getContext("2d"));
  const texture = new THREE.CanvasTexture(board);
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
  }
  return texture;
}
// A repeatable "random" number for a place (so the town is the same every time)
function rand(a, b) {
  let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

// ----- The sky: clouds, sun, moon and stars -----
const clouds = [];
for (let i = 0; i < 11; i++) {
  const cloud = new THREE.Group();
  for (let n = 0; n < 5; n++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(5 + rand(i, n) * 4, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false }));
    puff.position.set((n - 2) * 6, rand(n, i) * 3, rand(i + 5, n) * 5);
    puff.scale.y = 0.6;
    cloud.add(puff);
  }
  cloud.position.set((rand(i, 20) - 0.5) * 500, 55 + rand(i, 21) * 30, (rand(i, 22) - 0.5) * 500);
  scene.add(cloud);
  clouds.push(cloud);
}
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff2a8, fog: false }));
const moonBall = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }));
scene.add(sunBall, moonBall);
const starSpots = [];
for (let i = 0; i < 300; i++) {
  const a = rand(i, 30) * 6.283, up = 0.15 + rand(i, 31) * 1.3;
  starSpots.push(Math.cos(a) * Math.cos(up) * 420, Math.sin(up) * 420, Math.sin(a) * Math.cos(up) * 420);
}
const twinkles = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(starSpots, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
scene.add(twinkles);
const glassLit = new THREE.MeshLambertMaterial({ color: 0xbfe6ff });      // windows that light up at night
const glassDark = new THREE.MeshLambertMaterial({ color: 0xa8d4f0 });
const bulb = new THREE.MeshLambertMaterial({ color: 0xfff6d8 });          // street lamp bulbs

// ----- The island and the town -----
const walls = [];       // things you can't walk through: { x, z, w, d } boxes
const posts = [];       // round things you can't walk through: { x, z, r }
const bouncers = [];    // trampolines: { x, z }
const BLOCK = 22;       // the town is a grid of blocks with roads between them
const KERB = 0.18;      // the blocks are a little higher than the roads
const built = new Set();
const sea = new THREE.Mesh(new THREE.CircleGeometry(600, 48), new THREE.MeshPhongMaterial({ color: 0x2a8ee0, shininess: 120, specular: 0xffffff, transparent: true, opacity: 0.92 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -0.6;
scene.add(sea);
tube(96, 104, 1.6, 0xf4e4a8, 0, -0.82, 0).castShadow = false;                    // the beach
tube(81, 82, 1, 0x58b84c, 0, -0.5, 0).castShadow = false;
const grassPicture = picture(128, 128, function (g) {
  g.fillStyle = "#62c254";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = ["#57b64a", "#6fce5e", "#4fae44", "#7ad868"][i % 4];
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 3);
  }
}, 50);
const lawn = new THREE.MeshLambertMaterial({ map: grassPicture });
const meadow = new THREE.Mesh(new THREE.CircleGeometry(81, 48), lawn);
meadow.rotation.x = -Math.PI / 2;
meadow.position.y = 0.005;
meadow.receiveShadow = true;
scene.add(meadow);
for (const [x, z, r] of [[260, -180, 60], [-300, 90, 80], [60, 330, 50], [-140, -310, 45]]) {
  const hill = ball(r, 0x4fae44, x, -r * 0.55, z);          // far-away islands
  hill.castShadow = false;
  tube(r * 0.95, r * 1.05, 2, 0xf4e4a8, x, -1, z).castShadow = false;
}
for (let k = -3; k <= 2; k++) {
  box(5, 0.05, 150, 0x4c525e, (k + 0.5) * BLOCK, 0.03, 0).castShadow = false;      // roads north to south
  box(150, 0.05, 5, 0x4c525e, 0, 0.03, (k + 0.5) * BLOCK).castShadow = false;      // roads east to west
  for (let n = -7; n <= 7; n++) {
    box(0.25, 0.06, 2, 0xfff6c8, (k + 0.5) * BLOCK, 0.04, n * 10).castShadow = false;
    box(2, 0.06, 0.25, 0xfff6c8, n * 10, 0.04, (k + 0.5) * BLOCK).castShadow = false;
  }
}
// Far-away places
const MOUNTAIN = { x: -78, z: -78 };
const DOOR = { x: MOUNTAIN.x + 0.7071 * 29.7, z: MOUNTAIN.z + 0.7071 * 29.7 };      // the hidden way in
const ROOM = { x: 0, z: -3000 };                // the secret room (really it is far away, where nobody can see it)
const SECRET = { x: -190, z: -190, r: 30 };     // the secret island
const MOON = { x: 3000, z: 0 };
const TOWN_PAD = { x: 64, z: 48 };              // where the rocket stands
const MOON_PAD = { x: MOON.x - 14, z: -12 };
// How high the ground is at a place (the sea is lower, the blocks are a step up)
function groundAt(x, z) {
  if (x > 2000 || z < -2000) return 0;
  if (Math.hypot(x - SECRET.x, z - SECRET.z) < SECRET.r) return 0;
  if (Math.hypot(x, z) > 97) return -1;
  const gx = Math.round(x / BLOCK), gz = Math.round(z / BLOCK);
  return built.has(gx + "," + gz) && Math.abs(x - gx * BLOCK) < 8.5 && Math.abs(z - gz * BLOCK) < 8.5 ? KERB : 0;
}
const HOUSE_COLOURS = [0xffb3c8, 0xa8d8ff, 0xfff0a0, 0xb8f0c0, 0xe0c0ff, 0xffd0a0];
const ROOFS = [0xd8487e, 0x3a6ad8, 0xe07a2a, 0x3a9a58, 0x8a4ad8];
const SPECIAL = { "1,0": "pizza", "-1,1": "bins", "0,-1": "taxi", "-1,0": "shop", "1,-1": "depot", "2,-2": "mansion", "0,0": "park" };
const places = {};      // where the special buildings' doors are
const homes = [];       // ordinary houses (pizzas get delivered to them)
const roofShape = new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4);
const FLOWERS = [0xff5a8a, 0xffd84a, 0xffffff, 0xb06af0, 0xff8a3a];
const petal = new THREE.SphereGeometry(0.13, 6, 5);
function flower(x, y, z, n) {
  const mesh = new THREE.Mesh(petal, paint(FLOWERS[n % 5]));
  mesh.userData.still = true;
  mesh.position.set(x, y, z);
  scene.add(mesh);
}
function windowAt(x, y, z, sideways) {
  box(sideways ? 0.12 : 1.7, 1.5, sideways ? 1.7 : 0.12, 0xffffff, x, y, z);
  box(sideways ? 0.2 : 1.4, 1.2, sideways ? 1.4 : 0.2, rand(Math.round(x * 3), Math.round(z * 3 + y)) < 0.65 ? glassLit : glassDark, x, y, z).castShadow = false;
}
function building(x, z, w, h, d, colour, roof, shop) {
  box(w, h, d, colour, x, KERB + h / 2, z);
  box(w + 0.3, 0.3, d + 0.3, 0xffffff, x, KERB + h - 0.15, z);
  const top = add(new THREE.Mesh(roofShape, paint(roof)), x, KERB + h + 1.3, z);
  top.scale.set(w + 1.4, 2.6, d + 1.4);
  const front = z + d / 2;
  box(1.9, 2.7, 0.1, 0xffffff, x, KERB + 1.35, front + 0.02);
  box(1.5, 2.4, 0.16, shop ? 0x6a4428 : ROOFS[Math.floor(rand(x, z) * 5)], x, KERB + 1.2, front + 0.05);
  ball(0.08, 0xffd84a, x + 0.5, KERB + 1.2, front + 0.16);
  box(2.4, 0.12, 0.9, 0xbdb6a6, x, KERB + 0.06, front + 0.45);
  const floors = h >= 7 ? [KERB + 2.5, KERB + 5.4] : [KERB + Math.max(2.5, h * 0.6)];
  for (const y of floors) {
    for (const side of [-1, 1]) {
      windowAt(x + (side * w) / 4, y, front, false);
      windowAt(x + (side * w) / 4, y, z - d / 2, false);
      windowAt(x + (side * w) / 2, y, z, true);
    }
  }
  if (shop) {
    const stripes = new THREE.MeshLambertMaterial({ map: picture(64, 8, function (g) {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? "#ffffff" : "#" + new THREE.Color(colour).multiplyScalar(0.8).getHexString();
        g.fillRect(i * 8, 0, 8, 8);
      }
    }) });
    box(w * 0.8, 0.14, 2.2, stripes, x, KERB + 3.3, front + 1).rotation.x = 0.28;
  } else {
    box(0.9, 2.4, 0.9, 0xb0523a, x + w / 4, KERB + h + 1.5, z - d / 5);      // chimney
    for (const side of [-1, 1]) {
      box(1.7, 0.3, 0.4, 0x8a5a34, x + (side * w) / 4, floors[0] - 0.95, front + 0.2);      // flower boxes
      for (let n = 0; n < 4; n++) flower(x + (side * w) / 4 - 0.6 + n * 0.4, floors[0] - 0.72, front + 0.25, Math.floor(rand(x + n, z + side) * 5));
      ball(0.7, 0x3a9a48, x + side * 1.9, KERB + 0.5, front + 0.6).scale.y = 0.8;           // bushes by the door
    }
  }
  walls.push({ x: x, z: z, w: w, d: d, h: h + 3 });
}
// A big sign with a word painted on it
function sign(word, x, y, z) {
  const face = picture(256, 64, function (g) {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = "#e0508a";
    g.fillRect(0, 0, 256, 6);
    g.fillRect(0, 58, 256, 6);
    g.fillStyle = "#2a2c36";
    g.font = "bold 44px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(word, 128, 34);
  });
  add(new THREE.Mesh(new THREE.BoxGeometry(7, 1.75, 0.3), new THREE.MeshBasicMaterial({ map: face })), x, y, z);
}
function tree(x, z) {
  const y = groundAt(x, z);
  tube(0.28, 0.42, 2.4, 0x7a5230, x, y + 1.2, z);
  ball(1.5, 0x3aa858, x, y + 3.2, z);
  ball(1.1, 0x48b85e, x + 0.9, y + 2.7, z + 0.3);
  ball(1.1, 0x2f9a4c, x - 0.8, y + 2.8, z - 0.4);
  ball(0.9, 0x58c86a, x + 0.1, y + 4.2, z + 0.2);
  posts.push({ x: x, z: z, r: 0.6 });
}
function lamp(x, z) {
  tube(0.09, 0.13, 4.2, 0x3a3f4c, x, KERB + 2.1, z);
  box(0.9, 0.1, 0.1, 0x3a3f4c, x - 0.4, KERB + 4.2, z);
  ball(0.26, bulb, x - 0.85, KERB + 4.05, z).castShadow = false;
  posts.push({ x: x, z: z, r: 0.25 });
}
for (let gx = -3; gx <= 3; gx++) {
  for (let gz = -3; gz <= 3; gz++) {
    const x = gx * BLOCK, z = gz * BLOCK;
    if (Math.hypot(x, z) > 66) continue;
    built.add(gx + "," + gz);
    const kind = SPECIAL[gx + "," + gz];
    box(17, KERB, 17, 0xd4cfc0, x, KERB / 2, z).castShadow = false;                 // pavement
    box(15, 0.02, 15, lawn, x, KERB + 0.01, z).castShadow = false;                    // and a lawn
    lamp(x + 7.9, z + 7.9);
    const door = { x: x, z: z + 8.2 };
    if (kind === "park") {
      for (const [dx, dz] of [[-4, -3], [4, -3], [0, 4]]) {
        tube(2, 2.1, 0.55, 0x3a6ad8, x + dx, KERB + 0.27, z + dz);
        tube(1.7, 1.7, 0.57, 0xfff27a, x + dx, KERB + 0.28, z + dz);
        bouncers.push({ x: x + dx, z: z + dz });
      }
      tree(x - 6.5, z + 6);
      tree(x + 6.5, z + 6);
      tree(x - 6.5, z - 6.5);
      for (let n = 0; n < 60; n++) flower(x + (rand(n, 40) - 0.5) * 14, KERB + 0.14, z + (rand(n, 41) - 0.5) * 14, n);
      for (const side of [-1, 1]) {                      // benches
        box(2.2, 0.14, 0.7, 0xa8743c, x + side * 6.6, KERB + 0.55, z);
        box(2.2, 0.7, 0.12, 0xa8743c, x + side * 6.6, KERB + 0.95, z - 0.35);
        box(0.14, 0.5, 0.6, 0x3a3f4c, x + side * 6.6 - 0.9, KERB + 0.25, z);
        box(0.14, 0.5, 0.6, 0x3a3f4c, x + side * 6.6 + 0.9, KERB + 0.25, z);
      }
    } else if (kind === "mansion") {
      building(x, z, 15, 9, 11, 0xfff8e8, 0xd8487e, false);
      for (const side of [-1, 1]) {
        tube(1.6, 1.6, 12, 0xfff8e8, x + side * 7, KERB + 6, z - 4);
        add(new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.4, 16), paint(0xd8487e)), x + side * 7, KERB + 13.7, z - 4);
        tube(0.3, 0.3, 4.6, 0xffffff, x + side * 2.2, KERB + 2.3, z + 6.6);       // columns by the door
      }
      box(6.4, 0.4, 2, 0xffffff, x, KERB + 4.8, z + 6.4);
      places.mansion = door;
    } else if (kind) {
      const look = { pizza: [0xe0503a, 0xfff27a], bins: [0x3aa858, 0x2a6a3a], taxi: [0xffd84a, 0x2a2c36], shop: [0xb06af0, 0xfff27a], depot: [0xc98f52, 0x6a4428] }[kind];
      building(x, z, 12, 6, 10, look[0], look[1], true);
      sign(kind.toUpperCase(), x, KERB + 4.9, z + 5.25);
      places[kind] = door;
    } else if (rand(gx, gz) < 0.8) {
      const w = 8 + Math.floor(rand(gx + 9, gz) * 5), h = 4 + Math.floor(rand(gx, gz + 9) * 4);
      building(x, z, w, h, 9, HOUSE_COLOURS[Math.floor(rand(gx + 3, gz + 5) * 6)], ROOFS[Math.floor(rand(gx + 7, gz + 2) * 5)], false);
      homes.push({ x: x, z: z + 7 });
      tube(0.07, 0.07, 1, 0xffffff, x + 3.2, KERB + 0.5, z + 7.6);                // a mailbox
      box(0.5, 0.35, 0.7, 0xe0503a, x + 3.2, KERB + 1.1, z + 7.6);
      if (rand(gx + 1, gz + 1) < 0.7) tree(x - 7, z + 6.5);
    } else {
      for (let i = 0; i < 5; i++) tree(x + (rand(gx + i, gz) - 0.5) * 13, z + (rand(gx, gz + i) - 0.5) * 13);
      for (let n = 0; n < 30; n++) flower(x + (rand(n, gx) - 0.5) * 14, KERB + 0.14, z + (rand(n, gz + 50) - 0.5) * 14, n);
    }
  }
}
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * 6.283, x = Math.cos(a) * 88, z = Math.sin(a) * 88;        // palm trees on the beach
  tube(0.22, 0.34, 5, 0xa8743c, x, 2.4, z).rotation.z = 0.12;
  for (let leaf = 0; leaf < 6; leaf++) {
    const frond = ball(1, 0x48b858, x - 0.3 + Math.cos(leaf * 1.05) * 1.3, 4.9, z + Math.sin(leaf * 1.05) * 1.3);
    frond.scale.set(1.5, 0.16, 0.5);
    frond.rotation.set(0, -leaf * 1.05, -0.35);
  }
  posts.push({ x: x, z: z, r: 0.4 });
}
// Spinning gold stars mark the places where you can do something
const stars = [];
const starShape = new THREE.OctahedronGeometry(0.7);
function star(name, where, label) {
  const mesh = new THREE.Mesh(starShape, new THREE.MeshPhongMaterial({ color: 0xffd84a, emissive: 0x8a5a00, shininess: 120 }));
  mesh.position.set(where.x, 2.8, where.z);
  scene.add(mesh);
  stars.push({ name: name, x: where.x, z: where.z, mesh: mesh, label: label });
}
star("pizza", places.pizza, "E: deliver a pizza (job)");
star("bins", places.bins, "E: collect the bins (job)");
star("taxi", places.taxi, "E: drive the taxi (job)");
star("depot", places.depot, "E: move the crates (job)");
star("shop", places.shop, "E: go into the Wobble Shop");
star("mansion", places.mansion, "E: look at the mansion");

// ----- Wobbly jelly people -----
const smileShape = new THREE.TorusGeometry(0.13, 0.028, 6, 12, Math.PI);
function makeJelly(colour) {
  const group = new THREE.Group();
  const tip = new THREE.Group();           // tips over when the jelly flops
  const body = new THREE.Group();          // everything that wobbles
  group.add(tip);
  tip.add(body);
  const skin = new THREE.MeshPhongMaterial({ color: colour, shininess: 100, specular: 0x777777 });
  const part = (geometry, x, y, z, parent) => add(new THREE.Mesh(geometry, skin), x, y, z, parent);
  part(new THREE.SphereGeometry(0.55, 20, 16), 0, 0.95, 0, body).scale.set(1, 1.25, 0.95);
  part(new THREE.SphereGeometry(0.44, 20, 16), 0, 1.92, 0, body);
  for (const side of [-1, 1]) {
    ball(0.13, 0xffffff, side * 0.17, 2, 0.36, body).castShadow = false;
    ball(0.07, 0x1d1730, side * 0.17, 2, 0.46, body).castShadow = false;
    ball(0.025, 0xffffff, side * 0.17 + 0.03, 2.04, 0.52, body).castShadow = false;
    const cheek = ball(0.08, 0xff9ab8, side * 0.3, 1.84, 0.3, body);
    cheek.scale.z = 0.4;
    cheek.castShadow = false;
  }
  const smile = add(new THREE.Mesh(smileShape, paint(0x1d1730)), 0, 1.84, 0.41, body);
  smile.rotation.z = Math.PI;
  smile.castShadow = false;
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.55, 1.38, 0);
    part(new THREE.CylinderGeometry(0.11, 0.12, 0.62, 10), 0, -0.3, 0, arm);
    part(new THREE.SphereGeometry(0.16, 12, 10), 0, -0.66, 0, arm);          // a round hand
    body.add(arm);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.24, 0.45, 0);
    part(new THREE.CylinderGeometry(0.14, 0.15, 0.4, 10), 0, -0.2, 0, leg);
    part(new THREE.SphereGeometry(0.2, 12, 10), 0, -0.38, 0.06, leg).scale.set(1, 0.6, 1.3);      // a foot
    tip.add(leg);
    legs.push(leg);
  }
  const hat = new THREE.Group();
  hat.position.y = 2.28;
  body.add(hat);
  return { group: group, tip: tip, body: body, arms: arms, legs: legs, hat: hat, skin: skin, lean: 0, leanSpeed: 0, squash: 1, squashSpeed: 0, step: 0, fall: 0, flopped: false, carrying: false, dancing: false };
}
// Make a jelly wobble: it leans as it speeds up, springs back too far, and squashes when it lands
function wobble(jelly, dt, speed, push) {
  jelly.leanSpeed += ((push || speed * 0.05) - jelly.lean) * 60 * dt - jelly.leanSpeed * 5 * dt;
  jelly.lean += jelly.leanSpeed * dt;
  jelly.squashSpeed += (1 - jelly.squash) * 120 * dt - jelly.squashSpeed * 7 * dt;
  jelly.squash += jelly.squashSpeed * dt;
  jelly.step += dt * (4 + speed * 1.6);
  jelly.fall += ((jelly.flopped ? 1 : 0) - jelly.fall) * Math.min(1, dt * 9);
  jelly.tip.rotation.x = -jelly.fall * 1.45;
  jelly.tip.position.y = jelly.fall * 0.4;
  const flop = Math.sin(jelly.step) * Math.min(1, speed / 3);
  const bop = jelly.dancing ? Math.sin(jelly.step * 2.2) : 0;
  jelly.body.rotation.x = jelly.lean + Math.sin(jelly.step * 2) * 0.04;
  jelly.body.rotation.z = flop * 0.16 + bop * 0.25;
  jelly.body.rotation.y = bop * 0.5;
  const squish = jelly.squash * (1 + Math.abs(bop) * 0.08);
  jelly.body.scale.set(1 / Math.sqrt(squish), squish, 1 / Math.sqrt(squish));
  for (const side of [0, 1]) {
    const sign = side ? 1 : -1;
    const arm = jelly.arms[side];
    if (jelly.fall > 0.5) arm.rotation.set(Math.sin(jelly.step * 3 + side * 2) * 1.6, 0, sign * 1.2);           // flailing
    else if (jelly.carrying) arm.rotation.set(Math.PI + Math.sin(jelly.step) * 0.08, 0, sign * -0.25);           // arms up, holding something
    else if (jelly.dancing) arm.rotation.set(0, 0, sign * (2.2 + Math.sin(jelly.step * 2.2 + side * 3) * 0.7));
    else arm.rotation.set(-sign * flop * 1.1, 0, sign * (0.3 + Math.abs(flop) * 0.3));
    jelly.legs[side].rotation.x = jelly.fall > 0.5 ? Math.sin(jelly.step * 3 + side * 3) * 0.9 : sign * flop * 0.8;
  }
}
const HATS = {
  none: () => {},
  cap: (g) => { tube(0.45, 0.47, 0.22, 0xe0503a, 0, 0.03, 0, g); box(0.5, 0.06, 0.42, 0xe0503a, 0, -0.04, 0.42, g); ball(0.06, 0xffffff, 0, 0.16, 0, g); },
  party: (g) => { add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 14), gloss(0x3ab8e8)), 0, 0.36, 0, g); ball(0.1, 0xffd84a, 0, 0.8, 0, g); },
  top: (g) => { tube(0.6, 0.6, 0.06, 0x2a2c36, 0, -0.04, 0, g); tube(0.36, 0.36, 0.7, 0x2a2c36, 0, 0.34, 0, g); tube(0.37, 0.37, 0.12, 0xe0508a, 0, 0.08, 0, g); },
  crown: (g) => { tube(0.4, 0.36, 0.3, gloss(0xffd84a), 0, 0.08, 0, g); for (let i = 0; i < 5; i++) ball(0.09, gloss(0xff5a8a), Math.cos(i * 1.257) * 0.38, 0.28, Math.sin(i * 1.257) * 0.38, g); },
  alien: (g) => { for (const side of [-1, 1]) { tube(0.03, 0.03, 0.5, 0x4aa84a, side * 0.18, 0.15, 0, g).rotation.z = -side * 0.3; ball(0.09, gloss(0xffd84a), side * 0.26, 0.42, 0, g); } },
  spinner: (g) => { tube(0.45, 0.47, 0.2, 0x3a6ad8, 0, 0.02, 0, g); tube(0.03, 0.03, 0.3, 0xffffff, 0, 0.26, 0, g); g.userData.blade = box(0.9, 0.04, 0.12, 0xffd84a, 0, 0.42, 0, g); },
};
function wear(jelly, hat) {
  while (jelly.hat.children.length) jelly.hat.remove(jelly.hat.children[0]);
  jelly.hat.userData.blade = null;
  HATS[hat](jelly.hat);
}

// ----- What the game remembers -----
const SAVE_NAME = "jellyTownSave";
let state = { coins: 0, owned: { none: true, pink: true }, hat: "none", colour: "pink", pet: false, mansion: false, jobs: 0, rocket: {}, chest: false, gifts: {} };
try {
  const saved = JSON.parse(localStorage.getItem(SAVE_NAME));
  if (saved && typeof saved.coins === "number") state = Object.assign(state, saved);
} catch (error) { /* start fresh */ }
function save() {
  try { localStorage.setItem(SAVE_NAME, JSON.stringify(state)); } catch (error) { /* keep playing */ }
}
const COLOURS = { pink: 0xff7ab0, blue: 0x5ab0ff, green: 0x6ad87a, yellow: 0xffd84a, purple: 0xb06af0, orange: 0xff9a3a };
const SHOP = [
  ["hat", "cap", "A red cap", 20], ["hat", "party", "A party hat", 30], ["hat", "top", "A top hat", 50], ["hat", "spinner", "A spinner hat", 80], ["hat", "crown", "A crown", 150],
  ["colour", "blue", "Be blue", 15], ["colour", "green", "Be green", 15], ["colour", "yellow", "Be yellow", 15], ["colour", "purple", "Be purple", 15], ["colour", "orange", "Be orange", 15],
  ["pet", "pet", "A wobbly pet dog", 120], ["mansion", "mansion", "The mansion: the biggest house in town", 400],
];

// ----- You, your pet, the townsfolk and the cars -----
const me = makeJelly(COLOURS[state.colour]);
scene.add(me.group);
wear(me, state.hat);
const player = { x: 0, z: 7, y: 0, vy: 0, face: Math.PI, speed: 0, grounded: true, car: null, flop: 0, kx: 0, kz: 0, holding: null };
let look = 0;              // which way the camera looks round you
let tilt = 0.35;
const pet = new THREE.Group();
ball(0.36, gloss(0xc98f52), 0, 0.42, 0, pet).scale.set(1, 0.85, 1.4);
ball(0.27, gloss(0xc98f52), 0, 0.74, 0.42, pet);
ball(0.07, 0x1d1730, 0, 0.72, 0.68, pet);
for (const side of [-1, 1]) {
  ball(0.045, 0x1d1730, side * 0.11, 0.84, 0.62, pet);
  ball(0.12, 0x86684c, side * 0.2, 0.9, 0.36, pet).scale.set(0.6, 1.3, 0.8);       // floppy ears
}
const tail = box(0.09, 0.32, 0.09, 0x86684c, 0, 0.72, -0.5, pet);
pet.visible = state.pet;
scene.add(pet);
const petAt = { x: 2, z: 7, step: 0 };

const folk = [];
for (let i = 0; i < 14; i++) {
  const jelly = makeJelly(Object.values(COLOURS)[i % 6]);
  wear(jelly, ["none", "cap", "none", "top", "party"][i % 5]);
  scene.add(jelly.group);
  folk.push({ jelly: jelly, x: (Math.floor(rand(i, 1) * 6) - 2.5) * BLOCK + 3.2, z: (rand(i, 2) - 0.5) * 100, dir: 0, timer: 0, along: i % 2, flop: 0, kx: 0, kz: 0, y: 0, vy: 0, home: { x: 0, z: 0, r: 70 } });
  if (i % 2 === 0) [folk[i].x, folk[i].z] = [folk[i].z, folk[i].x];
}
function knock(person, vx, vz) {
  if (person.flop > 0) return;
  Object.assign(person, { flop: 2.6, kx: vx, kz: vz, vy: 6 });
  sfx.bonk();
  puff(person.x, 1.4, person.z, 0xffffff, 8);
}
function makeCar(colour, x, z, taxi) {
  const group = new THREE.Group();
  const shell = new THREE.Group();
  group.add(shell);
  box(2, 0.6, 4, gloss(colour), 0, 0.8, 0, shell);
  box(2.06, 0.18, 4.06, 0x2a2c36, 0, 0.5, 0, shell);                       // bumper strip
  box(1.72, 0.68, 2, gloss(0xcfeaff), 0, 1.42, -0.25, shell);                // windows
  box(1.8, 0.12, 2.1, gloss(colour), 0, 1.8, -0.25, shell);
  for (const side of [-1, 1]) {
    ball(0.17, 0xfff6c8, side * 0.65, 0.86, 2, shell);
    ball(0.13, 0xe0303a, side * 0.7, 0.86, -2, shell);
  }
  if (taxi) box(0.8, 0.26, 0.4, 0xffffff, 0, 1.98, -0.25, shell);
  for (const [wx, wz] of [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]]) {
    tube(0.44, 0.44, 0.34, 0x22242c, wx, 0.44, wz, group).rotation.z = Math.PI / 2;
    tube(0.2, 0.2, 0.36, 0xd8dce4, wx, 0.44, wz, group).rotation.z = Math.PI / 2;
  }
  group.position.set(x, 0, z);
  scene.add(group);
  return { group: group, shell: shell, x: x, z: z, face: 0, speed: 0, roll: 0, rollSpeed: 0 };
}
const cars = [makeCar(0xffd84a, places.taxi.x + 4.5, places.taxi.z + 3, true), makeCar(0xe0503a, 15, 13.2), makeCar(0x3a6ad8, -30, -8.8)];
// Other jellies drive up and down the roads
const traffic = [0, 1, 2].map(function (i) {
  const car = makeCar([0x6ad87a, 0xb06af0, 0xff9a3a][i], 0, 0);
  return Object.assign(car, { road: (i - 1.5) * BLOCK * (i === 1 ? -1 : 1) + (i === 1 ? BLOCK : 0), across: i === 2, way: 1, at: -40 + i * 30, speed: 8 });
});

// ----- Things you can pick up, carry and throw -----
const props = [];
const beachBall = new THREE.MeshPhongMaterial({ shininess: 80, map: picture(96, 16, function (g) {
  ["#ff5a6a", "#ffffff", "#ffd84a", "#ffffff", "#3ab8e8", "#ffffff"].forEach(function (colour, i) {
    g.fillStyle = colour;
    g.fillRect(i * 16, 0, 16, 16);
  });
}) });
const wood = new THREE.MeshLambertMaterial({ map: picture(32, 32, function (g) {
  g.fillStyle = "#c98f52";
  g.fillRect(0, 0, 32, 32);
  g.strokeStyle = "#8a5a2c";
  g.lineWidth = 3;
  g.strokeRect(2, 2, 28, 28);
  g.beginPath();
  g.moveTo(2, 2);
  g.lineTo(30, 30);
  g.stroke();
}) });
const KINDS = {
  nose: { r: 0.8, bounce: 0.2, make: () => new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 16), gloss(0xe0503a)) },
  fin: { r: 0.6, bounce: 0.2, make: () => new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 1.2), gloss(0xe0503a)) },
  engine: { r: 0.7, bounce: 0.2, make: () => new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 1.1, 14), gloss(0x6a7080)) },
  beach: { rolls: true, r: 0.7, bounce: 0.75, make: () => new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), beachBall) },
  ball: { rolls: true, r: 0.36, bounce: 0.65, make: () => new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), gloss(0xffffff)) },
  melon: { rolls: true, r: 0.42, bounce: 0.3, make: () => new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), gloss(0x2f9a4c)) },
  crate: { r: 0.5, bounce: 0.15, make: () => new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), wood) },
  cone: { r: 0.4, bounce: 0.25, make: () => new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.9, 12), paint(0xff7a2a)) },
};
function makeProp(kind, x, z) {
  const mesh = add(KINDS[kind].make(), x, 3, z);
  mesh.userData.still = false;
  const prop = { kind: kind, mesh: mesh, x: x, y: groundAt(x, z) + KINDS[kind].r, z: z, vx: 0, vy: 0, vz: 0, r: KINDS[kind].r, bounce: KINDS[kind].bounce, held: false, job: false, rolls: !!KINDS[kind].rolls };
  props.push(prop);
  return prop;
}
[["beach", -2, 3], ["beach", 3, 6], ["ball", 0, -5], ["ball", 5, 2], ["melon", 26, 12.6], ["melon", 28, 12.6], ["cone", 10, 11], ["cone", -11, 9], ["cone", 12, -11], ["crate", -27, 12.6], ["ball", -20, 34], ["beach", 60, 62], ["beach", -70, 55], ["ball", 40, -12], ["melon", -45, -30], ["crate", 30, 30]].forEach(([kind, x, z]) => makeProp(kind, x, z));

// ----- Far-away places: the mountain and its secret room, the secret island, the rocket and the Moon -----
function warp(x, z, facing) {
  Object.assign(player, { x: x, z: z, y: groundAt(x, z), vy: 0, face: facing, flop: 0, speed: 0 });
  look = facing + Math.PI;
  Object.assign(petAt, { x: x + 1.5, z: z });
}
// The mountain
const stone = new THREE.MeshLambertMaterial({ color: 0x8a8478, flatShading: true });
const snow = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
add(new THREE.Mesh(new THREE.ConeGeometry(30, 75, 11, 5), stone), MOUNTAIN.x, 36, MOUNTAIN.z);
add(new THREE.Mesh(new THREE.ConeGeometry(10.9, 26.4, 11, 2), snow), MOUNTAIN.x, 60.7, MOUNTAIN.z);
add(new THREE.Mesh(new THREE.ConeGeometry(17, 38, 9, 3), stone), MOUNTAIN.x + 26, 17, MOUNTAIN.z - 28);
posts.push({ x: MOUNTAIN.x, z: MOUNTAIN.z, r: 27.6 });
box(3.8, 4, 1.2, 0x6a655c, MOUNTAIN.x + 0.7071 * 28.8, 1.9, MOUNTAIN.z + 0.7071 * 28.8).rotation.y = Math.PI / 4;       // a doorway, hidden behind bushes
box(2.8, 3.4, 1.3, 0x100c0a, MOUNTAIN.x + 0.7071 * 28.9, 1.6, MOUNTAIN.z + 0.7071 * 28.9).rotation.y = Math.PI / 4;
ball(1.7, 0x3a9a48, DOOR.x + 1.9, 1, DOOR.z - 0.2);
ball(1.5, 0x2f8a40, DOOR.x - 0.4, 0.9, DOOR.z + 1.9);
// The secret room, with the boat-car inside
box(24, 0.2, 16, 0x7a7064, ROOM.x, -0.1, ROOM.z).castShadow = false;
const cave = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 16), new THREE.MeshLambertMaterial({ color: 0x6a5f52, side: THREE.BackSide }));
cave.position.set(ROOM.x, 4, ROOM.z);
scene.add(cave);
for (const [lx, lz] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe8a8 })), ROOM.x + lx, 7.4, ROOM.z + lz).castShadow = false;
sign("SECRET GARAGE", ROOM.x, 5.6, ROOM.z - 7.8);
box(0.3, 5, 8, 0x0a0806, ROOM.x - 11.8, 2.5, ROOM.z);              // the tunnel out to the sea
for (const [cx, cz, top] of [[8, -6, 0], [9.2, -5.6, 0], [8.6, -5.9, 1], [-9, 6, 0], [-8, -6, 0]]) box(1.1, 1.1, 1.1, wood, ROOM.x + cx, 0.55 + top * 1.1, ROOM.z + cz);
tube(0.5, 0.5, 1.2, 0x3a6ad8, ROOM.x + 5, 0.6, ROOM.z - 6.4);
const boat = makeCar(0xffc83a, ROOM.x, ROOM.z);
boat.boat = true;
box(2.8, 0.4, 4.8, gloss(0xe0503a), 0, 0.42, 0, boat.shell);       // a rubber ring, so it floats
tube(0.04, 0.04, 1.4, 0xffffff, -0.8, 2.5, -1.6, boat.shell);
box(0.7, 0.4, 0.04, 0xe0508a, -0.45, 3, -1.6, boat.shell);
boat.face = -Math.PI / 2;
boat.group.rotation.y = boat.face;
cars.push(boat);
star("roomExit", { x: ROOM.x + 9, z: ROOM.z + 5 }, "E: go back outside");
function enterRoom() {
  if (player.car !== boat) {
    Object.assign(boat, { x: ROOM.x, z: ROOM.z, face: -Math.PI / 2, speed: 0 });
    boat.group.position.set(boat.x, 0, boat.z);
    boat.group.rotation.y = boat.face;
  }
  warp(ROOM.x + 8, ROOM.z + 3, -Math.PI / 2);
  sfx.win();
  toast("You found the secret room inside the mountain! What is that car for...?", 6);
}
function launchBoat() {
  Object.assign(boat, { x: -104, z: -44, speed: 8 });
  boat.face = Math.atan2(SECRET.x - boat.x, SECRET.z - boat.z);
  look = boat.face + Math.PI;
  if (!job) job = { name: "secret", x: SECRET.x, z: SECRET.z };
  toast("WHOOSH! Down the tunnel and out to sea. It's a boat-car! Follow the arrow to the secret island.", 7);
}
// The secret island
tube(SECRET.r, SECRET.r + 4, 1.6, 0xf4e4a8, SECRET.x, -0.82, SECRET.z).castShadow = false;
tube(17, 17, 0.1, lawn, SECRET.x, 0.02, SECRET.z).castShadow = false;
for (let i = 0; i < 7; i++) {
  const a = i * 0.9 + 0.3, x = SECRET.x + Math.cos(a) * 23, z = SECRET.z + Math.sin(a) * 23;
  tube(0.22, 0.34, 5, 0xa8743c, x, 2.4, z).rotation.z = 0.12;
  for (let leaf = 0; leaf < 6; leaf++) {
    const frond = ball(1, 0x48b858, x - 0.3 + Math.cos(leaf * 1.05) * 1.3, 4.9, z + Math.sin(leaf * 1.05) * 1.3);
    frond.scale.set(1.5, 0.16, 0.5);
    frond.rotation.set(0, -leaf * 1.05, -0.35);
  }
  posts.push({ x: x, z: z, r: 0.4 });
}
const statue = makeJelly(0xffd84a);             // a giant golden jelly
statue.group.scale.setScalar(4);
statue.group.position.set(SECRET.x, 0, SECRET.z - 9);
wear(statue, "crown");
scene.add(statue.group);
posts.push({ x: SECRET.x, z: SECRET.z - 9, r: 2.6 });
box(1.7, 0.9, 1.1, wood, SECRET.x, 0.45, SECRET.z + 2);
const lid = box(1.8, 0.4, 1.2, gloss(0xffd84a), SECRET.x, 1.05, SECRET.z + 2);
lid.userData.still = false;
posts.push({ x: SECRET.x, z: SECRET.z + 2, r: 1 });
star("chest", { x: SECRET.x, z: SECRET.z + 4.5 }, "E: open the treasure chest");
for (const side of [-1, 1]) {
  tube(2, 2.1, 0.55, 0xe0508a, SECRET.x + side * 9, 0.27, SECRET.z + 7);
  tube(1.7, 1.7, 0.57, 0xfff27a, SECRET.x + side * 9, 0.28, SECRET.z + 7);
  bouncers.push({ x: SECRET.x + side * 9, z: SECRET.z + 7 });
}
makeProp("beach", SECRET.x + 4, SECRET.z + 12);
makeProp("melon", SECRET.x - 5, SECRET.z + 11);
// The rocket. It is broken: three parts are missing, lying around the island.
function launchPad(spot) {
  tube(6.5, 6.9, 0.3, 0x8a909c, spot.x, 0.15, spot.z);
  tube(4.6, 4.6, 0.32, 0xffd84a, spot.x, 0.16, spot.z);
  tube(4, 4, 0.34, 0x6a7080, spot.x, 0.17, spot.z);
  box(0.9, 12, 0.9, 0xe0503a, spot.x + 3.8, 6, spot.z - 1);
  box(2.4, 0.4, 0.6, 0xe0503a, spot.x + 2.6, 9, spot.z - 1);
  posts.push({ x: spot.x, z: spot.z, r: 2.3 });
}
launchPad(TOWN_PAD);
const rocket = new THREE.Group();
tube(1.5, 1.5, 7, gloss(0xf4f6fa), 0, 5.6, 0, rocket);
tube(1.52, 1.52, 0.6, gloss(0xe0503a), 0, 7.6, 0, rocket);
tube(0.62, 0.62, 0.2, 0x3a3f4c, 0, 6.2, 1.36, rocket).rotation.x = Math.PI / 2;
tube(0.5, 0.5, 0.22, gloss(0x8fd4ff), 0, 6.2, 1.38, rocket).rotation.x = Math.PI / 2;
const fins = [0, 1, 2].map(function (i) {
  const fin = box(0.25, 3.4, 2.2, gloss(0xe0503a), Math.sin(i * 2.094 + 1) * 2.3, 2.6, Math.cos(i * 2.094 + 1) * 2.3, rocket);
  fin.rotation.y = i * 2.094 + 1;
  return fin;
});
const rocketParts = {
  nose: add(new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.2, 18), gloss(0xe0503a)), 0, 10.7, 0, rocket),
  engine: tube(0.9, 1.4, 1.6, gloss(0x6a7080), 0, 1.4, 0, rocket),
  fin: fins[2],
};
for (const part in rocketParts) rocketParts[part].visible = !!state.rocket[part];
rocket.position.set(TOWN_PAD.x, 0, TOWN_PAD.z);
scene.add(rocket);
star("rocket", { x: TOWN_PAD.x - 5.5, z: TOWN_PAD.z }, "E: the rocket");
const PART_SPOTS = { nose: [44, -51.3], fin: [10, 90], engine: [-88, 10] };
const PART_HINTS = { nose: "the nose cone (behind the mansion)", fin: "a fin (on the beach)", engine: "the engine (on the beach)" };
for (const part in PART_SPOTS) if (!state.rocket[part]) makeProp(part, PART_SPOTS[part][0], PART_SPOTS[part][1]).part = part;
const rocketFixed = () => !!(state.rocket.nose && state.rocket.fin && state.rocket.engine);
function install(prop) {
  scene.remove(prop.mesh);
  props.splice(props.indexOf(prop), 1);
  state.rocket[prop.part] = true;
  rocketParts[prop.part].visible = true;
  puff(TOWN_PAD.x, 4, TOWN_PAD.z, 0xffd84a, 20);
  sfx.coin();
  if (rocketFixed()) {
    sfx.win();
    toast("The rocket is FIXED! Stand by the gold star and press E to blast off to the Moon!", 7);
    if (job && job.name === "parts") endJob();
  } else toast("Clunk! That part fits. Parts still to find: " + Object.keys(PART_SPOTS).filter((part) => !state.rocket[part]).length + ".", 5);
  save();
}
let launch = null;
function blastOff(to) {
  if (player.holding) throwIt(2);
  launch = { t: 0, to: to };
  me.group.visible = false;
  sfx.rocket();
  toast("3... 2... 1... BLAST OFF!", 3);
}
// The Moon
const moonDust = new THREE.MeshLambertMaterial({ map: picture(256, 256, function (g) {
  g.fillStyle = "#b9bcc6";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = ["rgba(120,124,138,0.5)", "rgba(220,222,230,0.5)"][i % 2];
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 12, 0, 6.283);
    g.fill();
  }
}, 5) });
const moonTop = new THREE.Mesh(new THREE.CircleGeometry(80, 48), moonDust);
moonTop.rotation.x = -Math.PI / 2;
moonTop.position.set(MOON.x, 0, MOON.z);
moonTop.receiveShadow = true;
scene.add(moonTop);
tube(80, 55, 10, 0x8f929c, MOON.x, -5.02, MOON.z).castShadow = false;
for (let i = 0; i < 9; i++) {
  const a = i * 0.74, far = 22 + rand(i, 60) * 40, r = 3 + rand(i, 61) * 4;
  const ring = add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.45, 8, 24), paint(0x9a9da8)), MOON.x + Math.cos(a) * far, 0.05, MOON.z + Math.sin(a) * far);
  ring.rotation.x = Math.PI / 2;
  const boulder = add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + rand(i, 62) * 1.2), stone), MOON.x + Math.cos(a + 0.4) * (far + 6), 0.5, MOON.z + Math.sin(a + 0.4) * (far + 6));
  posts.push({ x: boulder.position.x, z: boulder.position.z, r: 1.2 });
}
const BASE = { x: MOON.x + 22, z: MOON.z - 20 };
add(new THREE.Mesh(new THREE.SphereGeometry(7, 28, 14, 0, 6.283, 0, Math.PI / 2), gloss(0xf4f6fa)), BASE.x, 0, BASE.z);
box(2, 2.6, 0.6, 0x3a3f4c, BASE.x, 1.3, BASE.z + 6.8);
sign("MOON BASE", BASE.x, 4, BASE.z + 6.6);
posts.push({ x: BASE.x, z: BASE.z, r: 7 });
star("moon", { x: BASE.x, z: BASE.z + 9.5 }, "E: collect moon crystals (job)");
tube(0.05, 0.05, 3, 0xffffff, MOON.x - 4, 1.5, MOON.z + 4);
box(1.4, 0.9, 0.05, 0xe0508a, MOON.x - 3.3, 2.5, MOON.z + 4);
const earth = new THREE.Mesh(new THREE.SphereGeometry(42, 24, 18), new THREE.MeshBasicMaterial({ fog: false, map: picture(128, 64, function (g) {
  g.fillStyle = "#2a78d8";
  g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 3 ? "#4ab858" : "#ffffff";
    g.beginPath();
    g.ellipse(Math.random() * 128, 8 + Math.random() * 48, 5 + Math.random() * 12, 3 + Math.random() * 6, 0, 0, 6.283);
    g.fill();
  }
}) }));
earth.position.set(MOON.x - 120, 150, MOON.z - 330);
scene.add(earth);
for (let i = 0; i < 5; i++) {
  const jelly = makeJelly(0x7be07a);          // friendly aliens
  wear(jelly, "alien");
  scene.add(jelly.group);
  folk.push({ jelly: jelly, x: MOON.x + Math.cos(i * 1.3) * 25, z: MOON.z + Math.sin(i * 1.3) * 25, dir: i, timer: 0, free: true, flop: 0, kx: 0, kz: 0, y: 0, vy: 0, home: { x: MOON.x, z: MOON.z, r: 60 } });
}
cars.push(makeCar(0xd8dce4, MOON.x + 4, MOON.z + 10));        // a moon buggy
const crystals = [];
for (let i = 0; i < 8; i++) {
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshPhongMaterial({ color: 0x5af0ff, emissive: 0x1a7a9a, shininess: 120 }));
  gem.position.set(MOON.x + Math.cos(i * 0.785 + 0.3) * (28 + (i % 3) * 16), 1, MOON.z + Math.sin(i * 0.785 + 0.3) * (28 + (i % 3) * 16));
  gem.scale.y = 1.5;
  gem.visible = false;
  scene.add(gem);
  crystals.push(gem);
}
launchPad(MOON_PAD);
star("rocketHome", { x: MOON_PAD.x + 5.5, z: MOON_PAD.z }, "E: fly home in the rocket");
// Presents hidden all over the place
const GIFT_SPOTS = [[7, -7], [0, -92], [72, -58], [-60, 62], [30, 84], [-33, -33], [55, 11], [SECRET.x - 12, SECRET.z + 5], [SECRET.x + 11, SECRET.z - 15], [MOON.x - 32, 26], [MOON.x + 42, 30], [ROOM.x - 8, ROOM.z - 5]];
const gifts = GIFT_SPOTS.map(function ([x, z], i) {
  const gift = new THREE.Group();
  box(0.8, 0.8, 0.8, gloss(FLOWERS[i % 5] === 0xffffff ? 0x3ab8e8 : FLOWERS[i % 5]), 0, 0, 0, gift);
  box(0.84, 0.84, 0.18, gloss(0xfff27a), 0, 0, 0, gift);
  box(0.18, 0.84, 0.84, gloss(0xfff27a), 0, 0, 0, gift);
  ball(0.16, gloss(0xfff27a), 0, 0.5, 0, gift);
  gift.position.set(x, groundAt(x, z) + 0.9, z);
  gift.visible = !state.gifts[i];
  scene.add(gift);
  return gift;
});
function useStar(name) {
  if (name === "shop") toggleShop();
  else if (name === "mansion") toast(state.mansion ? "Home sweet wobbly home!" : "The mansion costs 400 coins at the Wobble Shop. You have " + state.coins + ".", 4);
  else if (name === "taxi") toast("Get into a car first, drive it here, then press T.", 4);
  else if (name === "rocket") {
    if (rocketFixed()) return blastOff("moon");
    toast("The rocket is broken! Find and carry here (F): " + Object.keys(PART_HINTS).filter((part) => !state.rocket[part]).map((part) => PART_HINTS[part]).join(", ") + ". Follow the arrow!", 8);
    if (!job || job.name === "secret") job = { name: "parts" };
  } else if (name === "rocketHome") blastOff("town");
  else if (name === "roomExit") {
    warp(DOOR.x + 2.6, DOOR.z + 2.6, Math.PI / 4);
    toast("Back outside. Shh, it's a secret!");
  } else if (name === "chest") {
    if (state.chest) return toast("The chest is empty now. But the island is still yours to play on!");
    state.chest = true;
    state.coins += 250;
    lid.rotation.x = -1;
    lid.position.set(SECRET.x, 1.4, SECRET.z + 1.5);
    sfx.win();
    puff(SECRET.x, 1.5, SECRET.z + 2, 0xffd84a, 30);
    toast("TREASURE! +250 coins!", 6);
    save();
  } else startJob(name);
}
if (state.chest) {
  lid.rotation.x = -1;
  lid.position.set(SECRET.x, 1.4, SECRET.z + 1.5);
}

// Little puffs and sparkles
const bits = [];
const bitShape = new THREE.SphereGeometry(0.12, 6, 5);
function puff(x, y, z, colour, count) {
  for (let i = 0; i < count; i++) {
    let bit = bits.find((b) => b.life <= 0);
    if (!bit) {
      if (bits.length >= 80) return;
      bit = { mesh: new THREE.Mesh(bitShape, new THREE.MeshBasicMaterial()), life: 0 };
      scene.add(bit.mesh);
      bits.push(bit);
    }
    const a = Math.random() * 6.283;
    Object.assign(bit, { life: 0.5 + Math.random() * 0.4, vx: Math.cos(a) * (1 + Math.random() * 3), vy: 2 + Math.random() * 3, vz: Math.sin(a) * (1 + Math.random() * 3) });
    bit.mesh.material.color.setHex(colour);
    bit.mesh.position.set(x, y, z);
    bit.mesh.visible = true;
  }
}

// ----- Jobs -----
let job = null;
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
beacon.visible = false;
scene.add(beacon);
const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.08, 24), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.6 }));
pad.visible = false;
scene.add(pad);
const carried = new THREE.Group();          // the pizza box you carry
box(1, 0.16, 1, 0xf2e2c0, 0, 0, 0, carried);
tube(0.3, 0.3, 0.17, 0xe0503a, 0, 0.01, 0, carried);
carried.position.y = 2.95;
carried.visible = false;
me.body.add(carried);
const bins = [];
for (let i = 0; i < 6; i++) {
  const bin = new THREE.Group();
  tube(0.45, 0.36, 1, 0x3aa858, 0, 0.5, 0, bin);
  tube(0.5, 0.5, 0.1, 0x2a7a40, 0, 1.03, 0, bin);
  bin.visible = false;
  scene.add(bin);
  bins.push(bin);
}
const rider = makeJelly(0xffffff);       // the taxi passenger
rider.group.visible = false;
scene.add(rider.group);

function endJob() {
  job = null;
  beacon.visible = pad.visible = carried.visible = rider.group.visible = false;
  me.carrying = !!player.holding;
  for (const bin of bins) bin.visible = false;
  for (const gem of crystals) gem.visible = false;
  for (const prop of props.filter((p) => p.job)) {
    if (player.holding === prop) player.holding = null;
    scene.remove(prop.mesh);
    props.splice(props.indexOf(prop), 1);
  }
}
function pay(amount, why) {
  state.coins += amount;
  state.jobs++;
  sfx.coin();
  puff(player.x, player.y + 2.5, player.z, 0xffd84a, 16);
  toast(why + " +" + amount + " coins!", 4);
  endJob();
  save();
}
function startJob(name) {
  if (job && job.name !== "secret" && job.name !== "parts") return toast("Finish the job you are doing first!");
  if (job) endJob();
  if (name === "pizza") {
    if (player.holding) return toast("Put down what you are carrying first (F).");
    const home = homes[Math.floor(Math.random() * homes.length)];
    job = { name: "pizza", x: home.x, z: home.z, time: 60 };
    carried.visible = me.carrying = true;
    toast("Hot pizza! Take it to the house with the beam of light. Quick, before it goes cold!", 5);
  } else if (name === "bins") {
    job = { name: "bins", left: 6 };
    bins.forEach(function (bin, i) {
      const home = homes[(i * 3 + state.jobs) % homes.length];
      bin.position.set(home.x - 3, KERB, home.z + 0.8);
      bin.visible = true;
    });
    toast("Six green bins need collecting. Bump into each one!", 5);
  } else if (name === "depot") {
    let home = homes[Math.floor(Math.random() * homes.length)];
    while (Math.hypot(home.x - places.depot.x, home.z - places.depot.z) > 50) home = homes[Math.floor(Math.random() * homes.length)];
    job = { name: "depot", left: 3, x: home.x, z: home.z + 0.5 };
    for (let i = 0; i < 3; i++) makeProp("crate", places.depot.x - 3 + i * 3, places.depot.z + 1.5).job = true;
    pad.position.set(job.x, groundAt(job.x, job.z) + 0.06, job.z);
    pad.visible = true;
    toast("Moving day! Carry (F) or drive the three crates to the yellow circle. Throwing counts!", 6);
  } else if (name === "moon") {
    job = { name: "moon", left: crystals.length };
    for (const gem of crystals) gem.visible = true;
    toast("Eight glowing crystals are scattered over the Moon. Bounce over and grab them all! (The moon buggy helps.)", 6);
  } else {
    if (!player.car) return toast("You need to be in a car to drive the taxi. Get in one with E!");
    const from = homes[Math.floor(Math.random() * homes.length)];
    let to = from;
    while (Math.hypot(to.x - from.x, to.z - from.z) < 40) to = homes[Math.floor(Math.random() * homes.length)];
    job = { name: "taxi", x: from.x, z: from.z + 3.5, to: to, picked: false };
    rider.skin.color.setHex(Object.values(COLOURS)[Math.floor(Math.random() * 6)]);
    rider.group.position.set(from.x, KERB, from.z + 0.8);
    rider.group.visible = true;
    toast("Someone needs a lift! Drive to the beam of light to pick them up.", 5);
  }
}
function updateJob(dt) {
  el("job").textContent = !job ? "No job right now. Jobs done: " + state.jobs : job.name === "pizza" ? "Pizza: " + Math.ceil(job.time) + "s left" : job.name === "bins" ? "Bins left: " + job.left : job.name === "depot" ? "Crates left: " + job.left : job.name === "moon" ? "Crystals left: " + job.left : job.name === "secret" ? "Drive the boat-car to the secret island!" : job.name === "parts" ? "Find the rocket parts" : job.picked ? "Taxi: take them home" : "Taxi: pick them up";
  if (!job) return (el("guide").hidden = true);
  let tx = job.x, tz = job.z;
  const nearest = (list, where) => list.slice().sort((a, b) => Math.hypot(where(a).x - player.x, where(a).z - player.z) - Math.hypot(where(b).x - player.x, where(b).z - player.z))[0];
  const things = job.name === "bins" ? bins : job.name === "moon" ? crystals : null;
  if (things) {
    for (const each of things) {
      if (!each.visible || Math.hypot(each.position.x - player.x, each.position.z - player.z) > (player.car ? 2.6 : 1.8)) continue;
      each.visible = false;
      sfx.pick();
      puff(each.position.x, 1, each.position.z, job.name === "bins" ? 0x6ad87a : 0x5af0ff, 8);
      if (--job.left === 0) return job.name === "bins" ? pay(35, "All the bins are collected.") : pay(80, "All the moon crystals are found.");
    }
    const next = nearest(things.filter((b) => b.visible), (b) => b.position);
    tx = next.position.x;
    tz = next.position.z;
  }
  if (job.name === "parts") {
    const part = nearest(props.filter((p) => p.part), (p) => p);
    if (!part) return endJob();
    tx = part.held ? TOWN_PAD.x : part.x;
    tz = part.held ? TOWN_PAD.z : part.z;
  }
  if (job.name === "secret" && Math.hypot(SECRET.x - player.x, SECRET.z - player.z) < 27) {
    endJob();
    sfx.win();
    return toast("You found the SECRET ISLAND! There's treasure here somewhere...", 6);
  }
  if (job.name === "depot") {
    for (const crate of props.filter((p) => p.job && !p.held)) {
      if (Math.hypot(crate.x - job.x, crate.z - job.z) > 2.9 || crate.y > 2) continue;
      scene.remove(crate.mesh);
      props.splice(props.indexOf(crate), 1);
      sfx.pick();
      puff(crate.x, 1, crate.z, 0xffd84a, 10);
      if (--job.left === 0) return pay(55, "All the crates are moved.");
    }
    const crate = nearest(props.filter((p) => p.job), (p) => p);
    if (crate && !crate.held) {
      tx = crate.x;
      tz = crate.z;
    }
  }
  const far = Math.hypot(tx - player.x, tz - player.z);
  beacon.visible = true;
  beacon.position.set(tx, 15, tz);
  el("guide").hidden = false;
  el("far").textContent = Math.round(far) + " steps";
  el("arrow").style.transform = "rotate(" + (Math.atan2(tx - player.x, tz - player.z) - look + Math.PI) * -1 + "rad)";
  if (job.name === "pizza") {
    job.time -= dt;
    if (job.time <= 0) {
      endJob();
      return toast("The pizza went cold. Oh well, you ate it. Try again!", 4);
    }
    if (far < 2.5) pay(20 + Math.ceil(job.time / 3), "Pizza delivered!");
  } else if (job.name === "taxi" && far < 4.5 && player.car) {
    if (!job.picked) {
      job.picked = true;
      job.x = job.to.x;
      job.z = job.to.z + 3.5;
      rider.group.visible = false;
      sfx.honk();
      toast("In they hop! Now drive them to the new beam of light.", 4);
    } else pay(45, "Thanks for the lift!");
  }
}

// ----- The shop -----
let shopOpen = false;
function drawShop() {
  const list = el("shop-list");
  list.innerHTML = "";
  const button = function (text, on, off, click) {
    const b = document.createElement("button");
    b.className = on ? "on" : "";
    b.textContent = text;
    b.disabled = off;
    b.addEventListener("click", function () {
      click();
      save();
      drawShop();
    });
    list.appendChild(b);
  };
  for (const [kind, id, name, cost] of SHOP) {
    const have = kind === "pet" ? state.pet : kind === "mansion" ? state.mansion : state.owned[id];
    const on = (kind === "hat" && state.hat === id) || (kind === "colour" && state.colour === id);
    const forever = kind === "pet" || kind === "mansion";
    button(name + (have ? (on ? " (wearing)" : forever ? " (yours!)" : " (click to wear)") : ": " + cost + " coins"), on || (have && forever), !have && state.coins < cost, function () {
      if (!have) {
        state.coins -= cost;
        sfx.coin();
        if (kind === "pet") state.pet = pet.visible = true;
        else if (kind === "mansion") {
          state.mansion = true;
          sfx.win();
          toast("The mansion is YOURS! You are the fanciest jelly in Jelly Town.", 6);
        } else state.owned[id] = true;
      }
      if (kind === "hat") wear(me, (state.hat = id));
      if (kind === "colour") me.skin.color.setHex(COLOURS[(state.colour = id)]);
    });
  }
  button("No hat" + (state.hat === "none" ? " (wearing)" : ""), state.hat === "none", false, () => wear(me, (state.hat = "none")));
  button("Be pink" + (state.colour === "pink" ? " (wearing)" : ""), state.colour === "pink", false, () => me.skin.color.setHex(COLOURS[(state.colour = "pink")]));
}
function toggleShop() {
  shopOpen = !shopOpen;
  el("shop").hidden = !shopOpen;
  if (shopOpen) {
    if (document.pointerLockElement) document.exitPointerLock();
    drawShop();
  } else grabMouse();
}

// ----- Keyboard and mouse -----
const keys = {};
const justPressed = {};
let playing = false;
document.addEventListener("keydown", function (event) {
  if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
  if (!keys[event.code]) justPressed[event.code] = true;
  keys[event.code] = true;
});
document.addEventListener("keyup", (event) => (keys[event.code] = false));
function grabMouse() {
  if (playing && !TEST && view.requestPointerLock) view.requestPointerLock();
}
document.addEventListener("mousemove", function (event) {
  if (!document.pointerLockElement) return;
  look -= event.movementX * 0.003;
  tilt = Math.max(0.05, Math.min(1.2, tilt + event.movementY * 0.003));
});
view.addEventListener("mousedown", function () {
  if (document.pointerLockElement) justPressed.KeyF = true;      // a click grabs or throws, the same as F
  else grabMouse();
});
let toastTimer = 0;
function toast(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastTimer = seconds || 3;
}

// Push a circle out of every building and tree. Gives back true if it bumped into something.
function bump(thing, r) {
  let hit = false;
  for (const wall of walls) {
    const dx = thing.x - wall.x, dz = thing.z - wall.z;
    const ox = wall.w / 2 + r - Math.abs(dx), oz = wall.d / 2 + r - Math.abs(dz);
    if (ox <= 0 || oz <= 0) continue;
    hit = true;
    if (ox < oz) thing.x += Math.sign(dx) * ox;
    else thing.z += Math.sign(dz) * oz;
  }
  for (const post of posts) {
    const dx = thing.x - post.x, dz = thing.z - post.z, far = Math.hypot(dx, dz) || 0.01;
    if (far >= post.r + r) continue;
    hit = true;
    thing.x = post.x + (dx / far) * (post.r + r);
    thing.z = post.z + (dz / far) * (post.r + r);
  }
  return hit;
}
function flopOver(vx, vz, seconds) {
  if (player.flop > 0 || player.car) return;
  Object.assign(player, { flop: seconds, kx: vx, kz: vz });
  if (player.holding) throwIt(3);
  sfx.bonk();
  puff(player.x, player.y + 1.4, player.z, 0xffffff, 8);
}
function throwIt(power) {
  const prop = player.holding;
  player.holding = null;
  me.carrying = carried.visible;
  Object.assign(prop, { held: false, vx: Math.sin(player.face) * (power + player.speed), vz: Math.cos(player.face) * (power + player.speed), vy: power * 0.4 });
  sfx.throw();
}

// ----- Day and night -----
let clock = 0.12;         // 0 is sunrise, 0.375 is noon, 0.75 is sunset, then night until 1
let daylight = 1;
const sunDir = new THREE.Vector3();
function updateSky(dt) {
  clock = (clock + dt / 300) % 1;
  const angle = clock < 0.75 ? (clock / 0.75) * Math.PI : Math.PI + ((clock - 0.75) / 0.25) * Math.PI;
  const height = Math.sin(angle);
  daylight = Math.max(0, Math.min(1, (height + 0.12) / 0.35));
  const glow = 1 - Math.abs(daylight * 2 - 1);          // sunrise and sunset
  const sky = mix(0x0c1436, 0x7ecbff, daylight).lerp(new THREE.Color(0xff9a62), glow * 0.55);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  skyLight.intensity = 0.42 + daylight * 0.2;
  skyLight.color.copy(mix(0x7a8cd8, 0xffffff, daylight));
  sun.intensity = daylight * 0.8;
  sun.color.copy(mix(0xff9a50, 0xfff1d0, Math.min(1, height * 2.5 + 0.2)));
  sunDir.set(Math.cos(angle) * 0.75, Math.max(0.22, height), 0.45).normalize();
  sunBall.position.set(player.x + Math.cos(angle) * 380, height * 300, player.z + 170);
  moonBall.position.set(player.x - Math.cos(angle) * 380, -height * 300, player.z + 170);
  twinkles.position.set(player.x, 0, player.z);
  twinkles.material.opacity = 1 - daylight;
  const night = 1 - daylight;
  glassLit.emissive.setRGB(night * 0.95, night * 0.75, night * 0.3);
  bulb.emissive.setRGB(night, night * 0.9, night * 0.55);
  const where = player.x > 2000 ? "moon" : player.z < -2000 ? "room" : "";
  sunBall.visible = moonBall.visible = !where;
  if (where) {                       // on the Moon the sky is black; in the secret room there is no sky
    const dark = new THREE.Color(where === "moon" ? 0x04050c : 0x14100c);
    scene.background.copy(dark);
    scene.fog.color.copy(dark);
    skyLight.intensity = where === "moon" ? 0.42 : 0.8;
    skyLight.color.set(0xffffff);
    sun.intensity = where === "moon" ? 0.9 : 0.2;
    sun.color.set(0xffffff);
    sunDir.set(0.5, 0.7, 0.4).normalize();
    twinkles.material.opacity = where === "moon" ? 1 : 0;
  }
  for (const cloud of clouds) {
    cloud.position.x += dt * 1.2;
    if (cloud.position.x > 260) cloud.position.x = -260;
    for (const puffBall of cloud.children) puffBall.material.color.copy(mix(0x3a4468, 0xffffff, daylight)).lerp(new THREE.Color(0xffb890), glow * 0.5);
  }
}

let time = 0;
function update(dt) {
  time += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) el("toast").hidden = true;
  if (justPressed.KeyE && shopOpen) return toggleShop();
  if (shopOpen) return;
  if (launch) {                      // riding the rocket
    launch.t += dt;
    rocket.position.y = launch.t * launch.t * 5;
    puff(rocket.position.x, rocket.position.y + 0.6, rocket.position.z, [0xffa030, 0xffe070, 0xffffff][Math.floor(Math.random() * 3)], 3);
    if (launch.t > 3.2) {
      const moon = launch.to === "moon", spot = moon ? MOON_PAD : TOWN_PAD;
      rocket.position.set(spot.x, 0, spot.z);
      warp(spot.x + (moon ? 5.5 : -5.5), spot.z + 2.5, 0);
      me.group.visible = true;
      launch = null;
      toast(moon ? "The MOON! You are very light here: try a big jump. The aliens are friendly." : "Back home in Jelly Town!", 6);
    }
    return;
  }
  const onMoon = player.x > 2000;
  const arrows = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  if (!player.car) look -= arrows * 2 * dt;
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const across = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const car = player.car;
  if (car) {
    // Driving: W and S go and reverse; A and D (or the left and right arrows) steer
    const steer = Math.max(-1, Math.min(1, across + arrows));
    car.speed += (ahead * 17 - car.speed) * Math.min(1, dt * 1.6);
    car.face -= steer * Math.max(-1, Math.min(1, car.speed / 5)) * 2 * dt;
    car.x += Math.sin(car.face) * car.speed * dt;
    car.z += Math.cos(car.face) * car.speed * dt;
    if (bump(car, 1.6)) {
      if (Math.abs(car.speed) > 6) sfx.bonk();
      car.speed *= -0.3;
    }
    const middle = onMoon ? MOON : { x: 0, z: 0 };
    if (!car.boat && Math.hypot(car.x - middle.x, car.z - middle.z) > (onMoon ? 74 : 92)) {      // ordinary cars can't swim (or fall off the Moon)
      car.x += (middle.x - car.x) * 0.01;
      car.z += (middle.z - car.z) * 0.01;
      car.speed *= 0.5;
    }
    car.rollSpeed += (-steer * car.speed * 0.02 - car.roll) * 40 * dt - car.rollSpeed * 4 * dt;      // the car wobbles round corners
    car.roll += car.rollSpeed * dt;
    car.shell.rotation.z = car.roll;
    car.shell.rotation.x = Math.sin(time * 9) * Math.min(0.03, Math.abs(car.speed) * 0.003);
    car.group.position.set(car.x, Math.max(groundAt(car.x, car.z), -0.5 + Math.sin(time * 3) * 0.06), car.z);
    car.group.rotation.y = car.face;
    Object.assign(player, { x: car.x, z: car.z, y: 0, face: car.face, speed: 0 });
    look += Math.atan2(Math.sin(car.face + Math.PI - look), Math.cos(car.face + Math.PI - look)) * Math.min(1, dt * 4);        // the camera swings round behind the car
    me.group.visible = false;
    for (const person of folk) if (Math.abs(car.speed) > 4 && Math.hypot(person.x - car.x, person.z - car.z) < 2) knock(person, Math.sin(car.face) * car.speed * 0.8, Math.cos(car.face) * car.speed * 0.8);
  } else {
    // Walking: wobble the way the camera is facing
    const flopped = player.flop > 0;
    const moving = !flopped && (ahead !== 0 || across !== 0);
    const swim = groundAt(player.x, player.z) < 0;
    player.speed += ((moving ? (swim ? 3 : 7) : 0) - player.speed) * Math.min(1, dt * 6);
    if (moving) {
      const want = Math.atan2(-Math.sin(look) * ahead + Math.cos(look) * across, -Math.cos(look) * ahead - Math.sin(look) * across);
      player.face += Math.atan2(Math.sin(want - player.face), Math.cos(want - player.face)) * Math.min(1, dt * 10);
    }
    if (flopped) {
      player.flop -= dt;
      player.x += player.kx * dt;
      player.z += player.kz * dt;
      player.kx *= 1 - Math.min(1, dt * 2.5);
      player.kz *= 1 - Math.min(1, dt * 2.5);
    } else {
      player.x += Math.sin(player.face) * player.speed * dt;
      player.z += Math.cos(player.face) * player.speed * dt;
    }
    bump(player, 0.6);
    if (player.z < -2000) {            // the walls of the secret room
      player.x = Math.max(ROOM.x - 11, Math.min(ROOM.x + 11, player.x));
      player.z = Math.max(ROOM.z - 7, Math.min(ROOM.z + 7, player.z));
    }
    const fromMoon = Math.hypot(player.x - MOON.x, player.z - MOON.z);
    if (onMoon && fromMoon > 77) {     // the edge of the Moon
      player.x = MOON.x + ((player.x - MOON.x) / fromMoon) * 77;
      player.z = MOON.z + ((player.z - MOON.z) / fromMoon) * 77;
    }
    // Jumping, and bouncing on trampolines
    const floor = swim ? -0.9 + Math.sin(time * 3) * 0.1 : groundAt(player.x, player.z);
    player.vy -= (onMoon ? 7 : 26) * dt;      // (things fall slowly on the Moon)
    player.y += player.vy * dt;
    if (player.y <= floor) {
      const onPad = !swim && bouncers.find((b) => Math.hypot(b.x - player.x, b.z - player.z) < 2);
      if (player.vy < -4) {
        me.squash = 0.6;
        puff(player.x, floor + 0.2, player.z, swim ? 0xcfeaff : 0xe8e0c8, 6);
      }
      if (player.vy < -19 && !onPad) flopOver(Math.sin(player.face) * 3, Math.cos(player.face) * 3, 1.4);       // a very big fall: splat!
      player.y = floor;
      player.vy = 0;
      player.grounded = true;
      if (onPad) {
        player.vy = keys.Space ? 22 : 13;
        me.squash = 0.5;
        sfx.boing();
      }
    }
    if (!flopped) {
      if (justPressed.Space && player.grounded && player.y <= floor + 0.01) {
        player.vy = 9.5;
        player.grounded = false;
        me.squash = 1.35;
        sfx.boing();
      }
      if (justPressed.KeyQ) flopOver(Math.sin(player.face) * player.speed, Math.cos(player.face) * player.speed, 1.5);
    }
    me.dancing = !!keys.KeyG && !flopped && !moving;
    me.flopped = flopped;
    me.group.visible = true;
    me.group.position.set(player.x, player.y, player.z);
    me.group.rotation.y = player.face;
    wobble(me, dt, me.dancing ? 2 : player.speed);
    // Picking up and throwing (F or a mouse click)
    const reach = !player.holding && !carried.visible && !flopped && props.filter((p) => Math.hypot(p.x - player.x, p.z - player.z) < 2.2 && Math.abs(p.y - player.y) < 2.5).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
    if (justPressed.KeyF) {
      if (player.holding) throwIt(12);
      else if (reach) {
        player.holding = reach;
        reach.held = me.carrying = true;
        sfx.pick();
      }
    }
    player.reach = reach;
  }
  if (me.hat.userData.blade) me.hat.userData.blade.rotation.y += dt * (6 + player.speed * 3);
  // E: whatever is nearest that you can use
  const nearCar = !player.holding && cars.find((c) => Math.hypot(c.x - player.x, c.z - player.z) < 3.5);
  const nearStar = stars.find((s) => Math.hypot(s.x - player.x, s.z - player.z) < 4);
  const label = car ? "E: get out of the car" + (nearStar && nearStar.name === "taxi" ? "   T: start the taxi job" : "") : player.holding ? "F: throw it!" : nearStar ? nearStar.label : nearCar ? "E: get in the car" : player.reach ? "F: pick it up" : "";
  if (el("prompt").textContent !== label) {
    el("prompt").textContent = label;
    el("prompt").hidden = !label;
  }
  if (justPressed.KeyT && car && nearStar && nearStar.name === "taxi") startJob("taxi");
  if (justPressed.KeyE && player.flop <= 0) {
    if (car) {
      player.car = null;
      player.x += Math.cos(car.face) * 2.2;
      player.z -= Math.sin(car.face) * 2.2;
      car.speed = 0;
    } else if (nearStar) useStar(nearStar.name);
    else if (nearCar) {
      player.car = nearCar;
      sfx.honk();
      if (nearCar.boat && player.z < -2000) launchBoat();
    }
  }
  if (launch) return;
  updateJob(dt);
  if (!player.car && Math.hypot(player.x - DOOR.x, player.z - DOOR.z) < 1.7) enterRoom();
  gifts.forEach(function (gift, i) {
    if (!gift.visible) return;
    gift.rotation.y += dt * 1.5;
    if (Math.hypot(gift.position.x - player.x, gift.position.z - player.z) > 1.6) return;
    gift.visible = false;
    state.gifts[i] = true;
    const found = Object.keys(state.gifts).length;
    state.coins += found === gifts.length ? 110 : 10;
    sfx.coin();
    puff(gift.position.x, gift.position.y, gift.position.z, 0xfff27a, 14);
    toast(found === gifts.length ? "You found EVERY present! +110 coins!" : "A present! +10 coins. (" + found + " of " + gifts.length + " found)", 4);
    save();
  });
  // Things you can throw: they fall, bounce, roll and get kicked about
  for (const prop of props) {
    if (prop.held) {
      Object.assign(prop, { x: player.x, y: player.y + 3 + prop.r * 0.6, z: player.z, vx: 0, vy: 0, vz: 0 });
      prop.mesh.rotation.set(0, player.face, 0);
    } else {
      prop.vy -= (prop.x > 2000 ? 7 : 24) * dt;
      prop.x += prop.vx * dt;
      prop.y += prop.vy * dt;
      prop.z += prop.vz * dt;
      const speed = Math.hypot(prop.vx, prop.vz);
      const floor = groundAt(prop.x, prop.z) + prop.r + (groundAt(prop.x, prop.z) < 0 ? 0.5 : 0);
      if (prop.y < floor) {
        prop.y = floor;
        const onPad = bouncers.find((b) => Math.hypot(b.x - prop.x, b.z - prop.z) < 2);
        prop.vy = onPad ? 11 : prop.vy < -2.5 ? -prop.vy * prop.bounce : 0;
        const grip = 1 - Math.min(1, dt * (prop.rolls ? 1.2 : 6));
        prop.vx *= grip;
        prop.vz *= grip;
      }
      if (prop.y < 12 && bump(prop, prop.r)) {
        prop.vx *= -0.4;
        prop.vz *= -0.4;
      }
      if (prop.rolls) {
        prop.mesh.rotation.x += (prop.vz * dt) / prop.r;
        prop.mesh.rotation.z -= (prop.vx * dt) / prop.r;
      }
      // kicked by you, shoved by a car, or bonking a townsperson
      const mover = car || player;
      const dx = prop.x - mover.x, dz = prop.z - mover.z, far = Math.hypot(dx, dz) || 0.01;
      const push = car ? Math.abs(car.speed) : player.speed;
      if (far < prop.r + (car ? 1.8 : 0.6) && prop.y - player.y < 2 && push > 1) {
        prop.vx = (dx / far) * push * 1.3;
        prop.vz = (dz / far) * push * 1.3;
        prop.vy = Math.max(prop.vy, car ? 5 : 2.5);
      }
      if (speed > 5) for (const person of folk) if (Math.hypot(person.x - prop.x, person.z - prop.z) < 1 + prop.r && prop.y < 4.6) knock(person, prop.vx * 0.5, prop.vz * 0.5);
    }
    prop.mesh.position.set(prop.x, prop.y, prop.z);
    if (prop.part && !prop.held && Math.hypot(prop.x - TOWN_PAD.x, prop.z - TOWN_PAD.z) < 7) install(prop);      // a rocket part, brought to the rocket
  }
  // The townsfolk wobble up and down the roads, and wave when you come close
  for (const person of folk) {
    const close = Math.hypot(person.x - player.x, person.z - player.z) < 4;
    let speed = 0;
    if (person.flop > 0) {
      person.flop -= dt;
      person.x += person.kx * dt;
      person.z += person.kz * dt;
      person.kx *= 1 - Math.min(1, dt * 2);
      person.kz *= 1 - Math.min(1, dt * 2);
    } else {
      if ((person.timer -= dt) <= 0) {
        person.timer = 3 + Math.random() * 5;
        person.dir = person.free ? Math.random() * 6.283 : (person.along ? 0 : Math.PI / 2) + (Math.random() < 0.5 ? Math.PI : 0);
      }
      speed = close ? 0 : 2;
      person.x += Math.sin(person.dir) * speed * dt;
      person.z += Math.cos(person.dir) * speed * dt;
      if (Math.hypot(person.x - person.home.x, person.z - person.home.z) > person.home.r) person.dir = Math.atan2(person.home.x - person.x, person.home.z - person.z);
    }
    bump(person, 0.6);
    const floor = groundAt(person.x, person.z);
    person.vy -= 24 * dt;
    person.y = Math.max(floor, person.y + person.vy * dt);
    if (person.y === floor) person.vy = 0;
    person.jelly.flopped = person.flop > 0;
    person.jelly.group.position.set(person.x, person.y, person.z);
    if (person.flop <= 0) person.jelly.group.rotation.y = close ? Math.atan2(player.x - person.x, player.z - person.z) : person.dir;
    wobble(person.jelly, dt, speed);
    if (close && person.flop <= 0) person.jelly.arms[0].rotation.set(0, 0, -2.4 + Math.sin(time * 10) * 0.4);      // waving
  }
  // Traffic drives up and down its road, stops for you, and bonks you if you walk into it
  for (const t of traffic) {
    const fx = t.across ? t.way : 0, fz = t.across ? 0 : t.way;
    const px = t.across ? t.at : t.road - t.way * 1.25, pz = t.across ? t.road + t.way * 1.25 : t.at;
    const dx = player.x - px, dz = player.z - pz;
    const inFront = dx * fx + dz * fz, beside = Math.abs(dx * fz - dz * fx);
    t.speed += ((inFront > 0 && inFront < 9 && beside < 2.2 ? 0 : 8) - t.speed) * Math.min(1, dt * 3);
    t.at += t.way * t.speed * dt;
    if (Math.abs(t.at) > 60) t.way = -t.way;
    Object.assign(t, { x: px, z: pz });
    t.group.position.set(px, 0, pz);
    t.group.rotation.y = Math.atan2(fx, fz);
    t.shell.rotation.x = Math.sin(time * 9 + t.road) * 0.02;
    if (!car && t.speed > 3 && Math.hypot(dx, dz) < 2 && player.y < 1.5) flopOver(fx * 9 + dx * 2, fz * 9 + dz * 2, 1.8);
  }
  if (state.pet) {
    const dx = player.x - petAt.x, dz = player.z - petAt.z, far = Math.hypot(dx, dz);
    if (far > 2.2) {
      petAt.x += (dx / far) * Math.min(far - 2, 9 * dt);
      petAt.z += (dz / far) * Math.min(far - 2, 9 * dt);
      petAt.step += dt * 14;
    }
    pet.position.set(petAt.x, Math.max(groundAt(petAt.x, petAt.z), -0.7) + Math.abs(Math.sin(petAt.step)) * 0.25, petAt.z);
    pet.rotation.y = Math.atan2(dx, dz);
    pet.rotation.z = Math.sin(petAt.step) * 0.15;
    tail.rotation.z = Math.sin(time * 14) * 0.6;
  }
  for (const each of stars) {
    each.mesh.rotation.y += dt * 2;
    each.mesh.position.y = 2.8 + Math.sin(time * 2 + each.x) * 0.3;
  }
  if (rider.group.visible) {
    wobble(rider, dt, 0, Math.sin(time * 3) * 0.1);
    rider.arms[0].rotation.set(0, 0, -2.4 + Math.sin(time * 10) * 0.4);
  }
  for (const gem of crystals) gem.rotation.y += dt * 2;
  el("coins").textContent = state.coins + " coins · presents " + Object.keys(state.gifts).length + "/" + gifts.length;
}

function draw(dt) {
  updateSky(playing && !TEST ? dt : 0);
  for (const bit of bits) {
    if (bit.life <= 0) continue;
    bit.life -= dt;
    bit.vy -= 9 * dt;
    bit.mesh.position.x += bit.vx * dt;
    bit.mesh.position.y += bit.vy * dt;
    bit.mesh.position.z += bit.vz * dt;
    bit.mesh.scale.setScalar(Math.max(0.01, bit.life * 2));
    bit.mesh.visible = bit.life > 0;
  }
  // The camera floats behind you, a little above
  let back = player.car ? 13 : 8.5;
  const spot = (far) => [player.x + Math.sin(look) * Math.cos(tilt) * far, player.y + 2 + Math.sin(tilt) * far, player.z + Math.cos(look) * Math.cos(tilt) * far];
  const inside = ([x, y, z]) => walls.some((wall) => y < wall.h && Math.abs(x - wall.x) < wall.w / 2 + 0.6 && Math.abs(z - wall.z) < wall.d / 2 + 0.6);
  while (back > 2 && inside(spot(back))) back -= 0.5;          // come closer instead of going inside a house
  camera.position.set(...spot(back));
  if (launch) camera.lookAt(rocket.position.x, rocket.position.y + 5, rocket.position.z);
  else camera.lookAt(player.x, player.y + 1.6, player.z);
  sun.position.set(player.x + sunDir.x * 120, sunDir.y * 120, player.z + sunDir.z * 120);
  sun.target.position.set(player.x, 0, player.z);
  sun.target.updateMatrixWorld();
  sea.position.y = -0.6 + Math.sin(time * 1.5) * 0.05;
  renderer.render(scene, camera);
}

// Glue together all the shapes that never move and share a paint: thousands of little shapes become a few big ones.
(function () {
  const piles = new Map();
  for (const mesh of scene.children.slice()) {
    if (!mesh.isMesh || !mesh.userData.still) continue;
    const name = mesh.material.uuid + mesh.castShadow;
    if (!piles.has(name)) piles.set(name, { material: mesh.material, shadow: mesh.castShadow, position: [], normal: [], uv: [] });
    const pile = piles.get(name);
    mesh.updateMatrixWorld();
    let shape = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (shape.index) shape = shape.toNonIndexed();
    for (const part of ["position", "normal", "uv"]) pile[part].push(shape.attributes[part].array);
    scene.remove(mesh);
  }
  for (const pile of piles.values()) {
    const shape = new THREE.BufferGeometry();
    for (const [part, size] of [["position", 3], ["normal", 3], ["uv", 2]]) {
      const all = new Float32Array(pile[part].reduce((sum, list) => sum + list.length, 0));
      let at = 0;
      for (const list of pile[part]) {
        all.set(list, at);
        at += list.length;
      }
      shape.setAttribute(part, new THREE.BufferAttribute(all, size));
    }
    const mesh = new THREE.Mesh(shape, pile.material);
    mesh.castShadow = pile.shadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
})();

let lastTime = performance.now();
let slowFrames = 0;
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
  // On a slow computer, switch the shadows off so the game stays smooth
  if (renderer.shadowMap.enabled && now - lastTime > 45 && ++slowFrames > 90) {
    renderer.shadowMap.enabled = sun.castShadow = false;
    renderer.setPixelRatio(1);
    fitView();
  }
  lastTime = now;
  if (playing) update(dt);
  else {
    time += dt;
    look += dt * 0.15;       // the title screen: the camera circles the town
    me.dancing = true;
    wobble(me, dt, 2);
  }
  draw(dt);
  for (const code in justPressed) justPressed[code] = false;
  requestAnimationFrame(frame);
}
el("start").addEventListener("click", function () {
  playing = true;
  el("intro").hidden = true;
  look = 0;
  grabMouse();
  toast("Welcome to Jelly Town! Find a spinning gold star to start a job.", 5);
});
requestAnimationFrame(frame);

// Only for testing the game.
window.JT = {
  get state() { return state; },
  player: player, keys: keys, justPressed: justPressed, cars: cars, stars: stars, homes: homes, bins: bins, me: me, props: props, folk: folk, traffic: traffic,
  job: () => job, turn: (angle) => (look = angle), startJob: startJob, setClock: (t) => (clock = t), daylight: () => daylight, warp: warp, boat: boat, rocket: rocket, launching: () => !!launch, gifts: gifts, crystals: crystals,
  spots: { DOOR: DOOR, ROOM: ROOM, SECRET: SECRET, MOON: MOON, TOWN_PAD: TOWN_PAD, MOON_PAD: MOON_PAD },
};
