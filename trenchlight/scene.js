// Trenchlight: the scene.
// Everything you can SEE is built in this file: the sea bed, the ice, the plants and rocks,
// the Lift, your submarine, the lumps you drill, the base pieces, and the little sea life.
// (The leviathans are in giants.js, and the rules of the game are in game.js.)

// ===== 1. Setting up =====
const canvas = document.getElementById("game");
const testing = location.search.includes("test");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x57b4d4, 6, 230);
const camera = new THREE.PerspectiveCamera(62, 1.5, 0.4, 900);
const UP = new THREE.Vector3(0, 1, 0);
const dice = seeded(2026);          // random numbers for placing scenery
const helper = new THREE.Object3D(); // a spare object, used to work out positions

// Make the picture the same size as its box on the page
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

// Light from the ice above (it fades as you dive), and a soft light all around
const skyLight = new THREE.HemisphereLight(0xd8f4ff, 0x1c3a52, 0.8);
scene.add(skyLight);
const sunLight = new THREE.DirectionalLight(0xe6f8ff, 0.6);
sunLight.position.set(0.4, 1, 0.3);
scene.add(sunLight);

// ===== 2. Little helpers =====
function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// A solid colour that light shines on. "glowColour" makes it shine by itself in the dark.
function paint(colour, glowColour) {
  return new THREE.MeshPhongMaterial({ color: colour, emissive: glowColour || 0x000000, shininess: 30, flatShading: true });
}

// A colour that is always fully bright (for lights)
function bright(colour) {
  return new THREE.MeshBasicMaterial({ color: colour });
}

// Make one shape and put it inside a group
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

// A soft round glow (a picture of a fuzzy dot that always faces you)
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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
  }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

// Put many copies of one shape into the sea in one go (this is fast to draw).
// spots = [{ x, y, z, sx, sy, sz, turn, tilt, lean }]
function sprinkle(geometry, material, spots) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, spots.length));
  spots.forEach(function (s, i) {
    helper.position.set(s.x, s.y, s.z);
    helper.rotation.set(s.tilt || 0, s.turn || 0, s.lean || 0);
    helper.scale.set(s.sx || 1, s.sy || 1, s.sz || s.sx || 1);
    helper.updateMatrix();
    mesh.setMatrixAt(i, helper.matrix);
  });
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

// ----- The colour of the water and of the sea bed, by how deep it is -----
const WATER = [[0, 0x57b4d4], [45, 0x3391b6], [100, 0x0f5f66], [175, 0x282a70], [265, 0x30121a], [385, 0x05050f]];
const colourA = new THREE.Color();
const colourB = new THREE.Color();

// Blend between the colours in a list like WATER. The answer goes into "into".
function blend(list, depth, into) {
  let i = 0;
  while (i < list.length - 2 && depth > list[i + 1][0]) i++;
  const t = clamp((depth - list[i][0]) / (list[i + 1][0] - list[i][0]), 0, 1);
  colourA.setHex(list[i][1]);
  colourB.setHex(list[i + 1][1]);
  return into.copy(colourA).lerp(colourB, t);
}

const GROUND = LAYERS.map(function (layer) { return [layer.deep, layer.ground]; });

// ===== 3. The sea bed and the ice =====
(function () {
  const size = WORLD * 2 + 60;
  const cuts = 160;
  const shape = new THREE.PlaneGeometry(size, size, cuts, cuts);
  shape.rotateX(-Math.PI / 2);
  const spots = shape.attributes.position;
  const colours = new Float32Array(spots.count * 3);
  const colour = new THREE.Color();
  const lava = new THREE.Color(0xff5a20);
  for (let i = 0; i < spots.count; i++) {
    const x = spots.getX(i);
    const z = spots.getZ(i);
    const y = groundAt(x, z);
    spots.setY(i, y);
    blend(GROUND, -y, colour);
    // Glowing cracks in the Smoker Fields
    if (-y > 235 && -y < 300 && bumps(x * 0.09 + 7, z * 0.09) > 0.74) colour.lerp(lava, 0.7);
    const shade = 0.78 + 0.44 * bumps(x * 0.11, z * 0.11);
    colours[i * 3] = colour.r * shade;
    colours[i * 3 + 1] = colour.g * shade;
    colours[i * 3 + 2] = colour.b * shade;
  }
  shape.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  shape.computeVertexNormals();
  scene.add(new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // The ice: a painted picture of cracks, stuck to a huge round lid over the sea
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const pen = c.getContext("2d");
  pen.fillStyle = "#8fcfe6";
  pen.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    pen.fillStyle = i % 2 ? "rgba(255,255,255,0.22)" : "rgba(40,110,150,0.25)";
    pen.beginPath();
    pen.arc(dice() * 256, dice() * 256, 12 + dice() * 34, 0, Math.PI * 2);
    pen.fill();
  }
  pen.strokeStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 22; i++) {
    pen.lineWidth = 1 + dice() * 2;
    pen.beginPath();
    let x = dice() * 256;
    let y = dice() * 256;
    pen.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (dice() - 0.5) * 80;
      y += (dice() - 0.5) * 80;
      pen.lineTo(x, y);
    }
    pen.stroke();
  }
  const picture = new THREE.CanvasTexture(c);
  picture.wrapS = picture.wrapT = THREE.RepeatWrapping;
  picture.repeat.set(16, 16);
  const lid = new THREE.CircleGeometry(WORLD + 40, 48);
  lid.rotateX(Math.PI / 2);
  scene.add(new THREE.Mesh(lid, new THREE.MeshBasicMaterial({ map: picture })));
})();

// ===== 4. Scenery =====
// Solid things the sub bumps into: { x, z, r, top }
const walls = [];

// Is this spot free? (Not on the Lift, and not on a power core.)
function isFree(x, z) {
  if (Math.hypot(x - LIFT.x, z - LIFT.z) < 34) return false;
  for (const kind in CORE_SPOTS) {
    if (Math.hypot(x - CORE_SPOTS[kind].x, z - CORE_SPOTS[kind].z) < 16) return false;
  }
  return true;
}

// Pick "count" free spots in a layer
function pick(id, count) {
  const list = [];
  let tries = 0;
  while (list.length < count && tries++ < count * 20) {
    const spot = spotIn(id, dice, 12);
    if (!isFree(spot.x, spot.z)) continue;
    spot.y = groundAt(spot.x, spot.z);
    list.push(spot);
  }
  return list;
}

const stacks = [];   // the tops of the smoking chimneys

(function () {
  // --- Frostlight Shelf: icicles hanging from the ice, and ice boulders ---
  const spike = new THREE.ConeGeometry(1, 1, 6);
  spike.rotateX(Math.PI);
  spike.translate(0, -0.5, 0);
  sprinkle(spike, paint(0xd8f6ff, 0x1c4a5a), pick("shelf", 170).concat(pick("forest", 30)).map(function (s) {
    const wide = 1.2 + dice() * 3;
    return { x: s.x, y: 0, z: s.z, sx: wide, sy: 5 + dice() * 15, sz: wide, turn: dice() * 6 };
  }));
  sprinkle(new THREE.IcosahedronGeometry(1, 0), paint(0xcdefff, 0x16323c), pick("shelf", 120).map(function (s) {
    const wide = 1.4 + dice() * 4;
    if (wide > 3) walls.push({ x: s.x, z: s.z, r: wide * 0.8, top: s.y + wide * 0.7 });
    return { x: s.x, y: s.y + wide * 0.2, z: s.z, sx: wide, sy: wide * (0.6 + dice() * 0.5), sz: wide, turn: dice() * 6, tilt: dice() };
  }));
  // Beams of light coming down through holes in the ice
  const shaft = new THREE.ConeGeometry(9, 44, 12, 1, true);
  const shaftPaint = new THREE.MeshBasicMaterial({ color: 0xcff4ff, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  sprinkle(shaft, shaftPaint, pick("shelf", 16).map(function (s) {
    return { x: s.x, y: -22, z: s.z, sx: 0.6 + dice() };
  }));

  // --- Glimmer Forest: tall dark stalks with glowing bulbs on top ---
  const trunk = new THREE.CylinderGeometry(0.3, 1, 1, 6);
  trunk.translate(0, 0.5, 0);
  const trees = pick("forest", 200).map(function (s) {
    return { x: s.x, y: s.y - 1, z: s.z, sx: 0.8 + dice() * 0.9, sy: 12 + dice() * 26, lean: (dice() - 0.5) * 0.12, tilt: (dice() - 0.5) * 0.12 };
  });
  trees.forEach(function (t) { walls.push({ x: t.x, z: t.z, r: t.sx * 0.7, top: t.y + t.sy }); });
  sprinkle(trunk, paint(0x1c4a44, 0x06201c), trees);
  sprinkle(new THREE.SphereGeometry(1, 8, 6), bright(0x8dffd0), trees.map(function (t) {
    return { x: t.x - t.lean * t.sy, y: t.y + t.sy + 0.6, z: t.z + t.tilt * t.sy, sx: 1 + dice() * 1.1 };
  }));
  sprinkle(new THREE.SphereGeometry(1, 6, 5), bright(0x4fd8c8), trees.map(function (t) {
    return { x: t.x - t.lean * t.sy * 0.6 + 1.2, y: t.y + t.sy * 0.6, z: t.z + t.tilt * t.sy * 0.6, sx: 0.5 + dice() * 0.4 };
  }));

  // --- Sunken Arches: giant stone arches and pillars ---
  const arch = new THREE.TorusGeometry(1, 0.15, 6, 14, Math.PI);
  const stone = paint(0x6a5a92, 0x100a1c);
  const archSpots = pick("arches", 30);
  archSpots.push({ x: CORE_SPOTS.ribbonwyrm.x, z: CORE_SPOTS.ribbonwyrm.z, y: groundAt(CORE_SPOTS.ribbonwyrm.x, CORE_SPOTS.ribbonwyrm.z), big: true });
  sprinkle(arch, stone, archSpots.map(function (s) {
    const wide = s.big ? 24 : 11 + dice() * 13;
    const turn = dice() * Math.PI;
    // Its two feet are solid
    for (const side of [-1, 1]) {
      walls.push({ x: s.x + side * wide * Math.cos(turn), z: s.z - side * wide * Math.sin(turn), r: wide * 0.16, top: s.y + wide * 0.55 });
    }
    return { x: s.x, y: s.y - 2, z: s.z, sx: wide, sy: wide * (0.9 + dice() * 0.4), sz: wide, turn: turn };
  }));
  const pillar = new THREE.CylinderGeometry(0.8, 1, 1, 7);
  pillar.translate(0, 0.5, 0);
  sprinkle(pillar, stone, pick("arches", 44).map(function (s) {
    const wide = 1.6 + dice() * 2.6;
    const high = 8 + dice() * 34;
    walls.push({ x: s.x, z: s.z, r: wide, top: s.y + high });
    return { x: s.x, y: s.y - 1, z: s.z, sx: wide, sy: high, sz: wide, turn: dice() * 6 };
  }));

  // --- Smoker Fields: chimneys puffing smoke, and pools of glowing lava ---
  const chimney = new THREE.CylinderGeometry(0.45, 1, 1, 7);
  chimney.translate(0, 0.5, 0);
  const tips = [];
  sprinkle(chimney, paint(0x3c2e30, 0x120606), pick("smokers", 58).map(function (s) {
    const wide = 2.4 + dice() * 2.8;
    const high = 8 + dice() * 18;
    walls.push({ x: s.x, z: s.z, r: wide * 0.85, top: s.y + high });
    stacks.push({ x: s.x, y: s.y + high - 1, z: s.z });
    tips.push({ x: s.x, y: s.y + high - 1.2, z: s.z, sx: wide * 0.5, sy: 0.5 });
    return { x: s.x, y: s.y - 1, z: s.z, sx: wide, sy: high, sz: wide };
  }));
  sprinkle(new THREE.SphereGeometry(1, 8, 5), bright(0xff7a30), tips);
  const pool = new THREE.CircleGeometry(1, 10);
  pool.rotateX(-Math.PI / 2);
  sprinkle(pool, bright(0xff5a20), pick("smokers", 40).map(function (s) {
    return { x: s.x, y: s.y + 0.5, z: s.z, sx: 2 + dice() * 4 };
  }));

  // --- The Abyss: the ribs of something enormous ---
  const rib = new THREE.TorusGeometry(1, 0.07, 6, 16, Math.PI);
  const ribs = [];
  for (let i = 0; i < 9; i++) {
    const x = -44 + i * 11;
    const wide = 15 - Math.abs(i - 4) * 1.6;
    ribs.push({ x: x, y: groundAt(x, 38) - 2, z: 38, sx: wide, sy: wide * 1.2, sz: wide, turn: Math.PI / 2 });
  }
  sprinkle(rib, paint(0xd8d0c0, 0x2a2a3a), ribs);
})();

// Smoke rising out of the chimneys
const smoke = (function () {
  const count = 260;
  const spots = new Float32Array(count * 3);
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.BufferAttribute(spots, 3));
  const points = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0x8a7a78, size: 6, map: glowTexture, transparent: true, opacity: 0.6, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);
  return points;
})();

// Glowing specks drifting in the Abyss
const spores = (function () {
  const count = 320;
  const spots = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = dice() * Math.PI * 2;
    const r = Math.sqrt(dice()) * 78;
    spots[i * 3] = Math.cos(a) * r;
    spots[i * 3 + 2] = Math.sin(a) * r;
    spots[i * 3 + 1] = groundAt(spots[i * 3], spots[i * 3 + 2]) + 2 + dice() * 70;
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.BufferAttribute(spots, 3));
  const points = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xa98cff, size: 1.8, map: glowTexture, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  points.frustumCulled = false;
  scene.add(points);
  return points;
})();

// "Sea snow": tiny specks all around you, so you can feel how fast you are moving
const SNOW = 220;
const SNOW_BOX = 70;
const snow = (function () {
  const spots = new Float32Array(SNOW * 3);
  for (let i = 0; i < SNOW * 3; i++) spots[i] = (dice() - 0.5) * SNOW_BOX;
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.BufferAttribute(spots, 3));
  const points = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xdff6ff, size: 0.45, map: glowTexture, transparent: true, opacity: 0.8, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);
  return points;
})();

// ===== 5. The Lift (your first home) =====
const DOCK_HIGH = 7;   // how high above the sea bed a docking ring floats
const liftY = groundAt(LIFT.x, LIFT.z);
const liftBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(3.2, 3.2, 1, 14, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
);
const liftLight = new THREE.MeshPhongMaterial({ color: 0x6a5a2a, emissive: 0xa87a18 });

(function () {
  const lift = new THREE.Group();
  lift.position.set(LIFT.x, liftY, LIFT.z);
  const metal = paint(0x6f8794);
  const dark = paint(0x2f3e48);
  piece(lift, new THREE.CylinderGeometry(10, 11.5, 1.4, 20), metal, 0, 0.5, 0);
  const ring = piece(lift, new THREE.TorusGeometry(7, 0.6, 8, 28), liftLight, 0, DOCK_HIGH, 0);
  ring.rotation.x = Math.PI / 2;
  const high = -liftY;   // all the way up to the ice
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    piece(lift, new THREE.CylinderGeometry(0.5, 0.5, high, 6), dark, Math.cos(a) * 9.5, high / 2, Math.sin(a) * 9.5);
    walls.push({ x: LIFT.x + Math.cos(a) * 9.5, z: LIFT.z + Math.sin(a) * 9.5, r: 0.6, top: 0 });
  }
  for (let y = 14; y < high; y += 9) {
    const hoop = piece(lift, new THREE.TorusGeometry(9.5, 0.25, 5, 24), dark, 0, y, 0);
    hoop.rotation.x = Math.PI / 2;
  }
  liftBeam.scale.y = high;
  liftBeam.position.y = high / 2;
  lift.add(liftBeam);
  const lampGlow = glow(0xffd76a, 16);
  lampGlow.position.y = DOCK_HIGH;
  lift.add(lampGlow);
  scene.add(lift);

  // The broken research cabin that came down with you
  const cabin = new THREE.Group();
  const cx = LIFT.x + 26;
  const cz = LIFT.z - 12;
  cabin.position.set(cx, groundAt(cx, cz) + 2, cz);
  cabin.rotation.set(0.2, 0.7, 0.35);
  const tube = piece(cabin, new THREE.CylinderGeometry(3.4, 3.4, 15, 12), paint(0xd9dde0), 0, 0, 0);
  tube.rotation.z = Math.PI / 2;
  const stripe = piece(cabin, new THREE.CylinderGeometry(3.45, 3.45, 2, 12), paint(0xd8442e), 2, 0, 0);
  stripe.rotation.z = Math.PI / 2;
  piece(cabin, new THREE.SphereGeometry(3.4, 12, 8), paint(0x9fd8e8, 0x0a2a33), -7.5, 0, 0);
  scene.add(cabin);
  walls.push({ x: cx, z: cz, r: 6, top: groundAt(cx, cz) + 6 });
})();

// ===== 6. Your submarine, the Lantern =====
// It is built with its nose pointing along "minus z" (that is the way a camera looks, too).
const subModel = new THREE.Group();
subModel.rotation.order = "YXZ";
const lampPaint = new THREE.MeshBasicMaterial({ color: 0xfff4c8 });
const propeller = new THREE.Group();
const headlight = new THREE.SpotLight(0xfff0c8, 1.8, 120, 0.55, 0.5, 1.1);

(function () {
  const yellow = new THREE.MeshPhongMaterial({ color: 0xffb630, shininess: 70 });
  const dark = paint(0x2b3a48);
  const teal = paint(0x1fb8a8);
  const hull = piece(subModel, new THREE.SphereGeometry(1.5, 18, 12), yellow, 0, 0, 0);
  hull.scale.set(1, 0.92, 2.1);
  piece(subModel, new THREE.SphereGeometry(1.2, 14, 10), new THREE.MeshPhongMaterial({ color: 0x9fefff, transparent: true, opacity: 0.55, shininess: 100, emissive: 0x124450 }), 0, 0.28, -1.9);
  piece(subModel, new THREE.BoxGeometry(0.5, 0.9, 1.5), teal, 0, 1.45, 0.4);
  piece(subModel, new THREE.SphereGeometry(0.16, 6, 5), bright(0xff5a4a), 0, 2.05, 0.9);
  for (const side of [-1, 1]) {
    const pod = piece(subModel, new THREE.CylinderGeometry(0.42, 0.42, 2.6, 10), dark, side * 1.75, -0.45, 0.2);
    pod.rotation.x = Math.PI / 2;
    piece(subModel, new THREE.BoxGeometry(0.7, 0.2, 0.8), dark, side * 1.3, -0.4, 0.2);
    piece(subModel, new THREE.SphereGeometry(0.38, 10, 8), lampPaint, side * 1.75, -0.45, -1.12);
    piece(subModel, new THREE.BoxGeometry(1.5, 0.12, 0.9), teal, side * 1.15, 0, 2.5);
  }
  piece(subModel, new THREE.BoxGeometry(0.12, 1.5, 0.9), teal, 0, 0.55, 2.6);
  piece(subModel, new THREE.TorusGeometry(0.82, 0.12, 6, 16), dark, 0, 0, 3.25);
  propeller.position.set(0, 0, 3.25);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = i * Math.PI * 2 / 3;
    piece(arm, new THREE.BoxGeometry(0.24, 0.72, 0.06), teal, 0, 0.38, 0);
    propeller.add(arm);
  }
  subModel.add(propeller);
  // The drill under the nose
  const arm = piece(subModel, new THREE.CylinderGeometry(0.16, 0.16, 1.6, 6), dark, 0, -1.15, -1.6);
  arm.rotation.x = Math.PI / 2;
  const bit = piece(subModel, new THREE.ConeGeometry(0.3, 0.9, 8), paint(0xcfd8dc), 0, -1.15, -2.8);
  bit.rotation.x = -Math.PI / 2;

  // The headlights: one real beam of light, pointing where the nose points
  headlight.position.set(0, -0.3, -1.4);
  const aim = new THREE.Object3D();
  aim.position.set(0, -3, -40);
  subModel.add(headlight, aim);
  headlight.target = aim;
  // A soft glow so you can always see your own sub
  subModel.add(new THREE.PointLight(0xa8ecff, 0.4, 24));
  scene.add(subModel);
})();

// Bubbles behind the propeller
const BUBBLES = 60;
const bubbleAge = new Float32Array(BUBBLES).fill(9);
let nextBubble = 0;
const bubbles = (function () {
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BUBBLES * 3), 3));
  const points = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xeaffff, size: 0.8, map: glowTexture, transparent: true, opacity: 0.7, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);
  return points;
})();

function puff(x, y, z) {
  const spots = bubbles.geometry.attributes.position;
  spots.setXYZ(nextBubble, x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6);
  bubbleAge[nextBubble] = 0;
  nextBubble = (nextBubble + 1) % BUBBLES;
}

// The drill's beam, and the flash of a shock
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 6), bright(0x8ff3ff));
beam.visible = false;
scene.add(beam);
const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 5), new THREE.MeshBasicMaterial({ color: 0xd8c8ff, fog: false }));
bolt.visible = false;
scene.add(bolt);
const pulseRing = new THREE.Mesh(
  new THREE.SphereGeometry(1, 20, 12),
  new THREE.MeshBasicMaterial({ color: 0xbfa8ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
);
pulseRing.visible = false;
scene.add(pulseRing);

// ===== 7. The lumps you can drill =====
const nodes = makeNodes();
const nodeMeshes = {};

(function () {
  const shapes = {
    ice: new THREE.OctahedronGeometry(1, 0),
    iron: new THREE.DodecahedronGeometry(1, 0),
    moss: new THREE.SphereGeometry(1, 7, 5),
    amber: new THREE.OctahedronGeometry(1, 0),
    magma: new THREE.TetrahedronGeometry(1.2, 0),
    pearl: new THREE.SphereGeometry(1, 10, 8),
  };
  const counts = {};
  nodes.forEach(function (node) {
    node.slot = counts[node.kind] || 0;
    counts[node.kind] = node.slot + 1;
    node.y = groundAt(node.x, node.z);
    node.back = 0;         // when it grows back (0 = it is here now)
    node.seed = dice();
  });
  for (const kind in shapes) {
    // Every lump is a little cluster of three shapes
    const mesh = new THREE.InstancedMesh(shapes[kind], paint(ORES[kind].colour, ORES[kind].glow), counts[kind] * 3);
    mesh.frustumCulled = false;
    scene.add(mesh);
    nodeMeshes[kind] = mesh;
  }
  nodes.forEach(function (node) { showNode(node, true); });
})();

// Draw a lump (or hide it, once it has been drilled)
function showNode(node, here) {
  const mesh = nodeMeshes[node.kind];
  const sizes = { ice: [0.7, 2.3, 0.7], iron: [1.3, 0.9, 1.2], moss: [1.6, 0.55, 1.6], amber: [0.9, 1.4, 0.9], magma: [1, 1.2, 1], pearl: [0.85, 0.85, 0.85] }[node.kind];
  for (let k = 0; k < 3; k++) {
    const a = node.seed * 20 + k * 2.1;
    const big = here ? (k === 0 ? 1 : 0.6) : 0.0001;
    helper.position.set(node.x + (k ? Math.cos(a) * 1.3 : 0), node.y + sizes[1] * big * 0.6, node.z + (k ? Math.sin(a) * 1.3 : 0));
    helper.rotation.set(node.kind === "ice" ? Math.sin(a) * 0.35 : a, a, node.kind === "ice" ? Math.cos(a) * 0.35 : 0);
    helper.scale.set(sizes[0] * big, sizes[1] * big, sizes[2] * big);
    helper.updateMatrix();
    mesh.setMatrixAt(node.slot * 3 + k, helper.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

// ===== 8. The four power cores =====
const cores = [];
(function () {
  for (const kind in CORE_SPOTS) {
    const spot = CORE_SPOTS[kind];
    const group = new THREE.Group();
    const y = groundAt(spot.x, spot.z);
    group.position.set(spot.x, y, spot.z);
    piece(group, new THREE.CylinderGeometry(1.6, 2.2, 2, 8), paint(0x4a5a66), 0, 1, 0);
    const gem = piece(group, new THREE.IcosahedronGeometry(1.3, 0), new THREE.MeshPhongMaterial({ color: 0xfff2b0, emissive: 0xffb020, flatShading: true }), 0, 4, 0);
    const shine = glow(0xffc94a, 12);
    shine.position.y = 4;
    group.add(shine);
    // A thin beam of light so you can find it from far away
    const ray = piece(group, new THREE.CylinderGeometry(0.3, 0.3, 60, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0, 34, 0);
    scene.add(group);
    cores.push({ kind: kind, x: spot.x, y: y + 4, z: spot.z, group: group, gem: gem, shine: shine, ray: ray });
  }
})();

// ===== 9. Base pieces =====
// Build the model of one base piece. Its bottom is at y = 0.
function makeModule(kind) {
  const g = new THREE.Group();
  const metal = paint(0x7f97a4);
  const dark = paint(0x2f3e48);
  const white = paint(0xe6eef2);
  // Every piece has one "light" colour, which goes dark when the base has no power
  const light = new THREE.MeshPhongMaterial({ color: 0x1a2a30, emissive: 0x6fe8ff });
  g.userData.light = light;
  g.userData.shine = 0x6fe8ff;

  if (kind === "dock") {
    piece(g, new THREE.CylinderGeometry(8, 9, 1, 18), metal, 0, 0.4, 0);
    const ring = piece(g, new THREE.TorusGeometry(6, 0.5, 8, 26), light, 0, DOCK_HIGH, 0);
    ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      piece(g, new THREE.CylinderGeometry(0.35, 0.55, DOCK_HIGH, 6), dark, Math.cos(a) * 6, DOCK_HIGH / 2, Math.sin(a) * 6);
    }
  } else if (kind === "turbine") {
    piece(g, new THREE.CylinderGeometry(0.35, 0.6, 7, 7), dark, 0, 3.5, 0);
    piece(g, new THREE.BoxGeometry(0.9, 0.9, 1.8), white, 0, 7, 0);
    const fan = new THREE.Group();
    fan.position.set(0, 7, -1.05);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = i * Math.PI * 2 / 3;
      piece(arm, new THREE.BoxGeometry(0.5, 2.8, 0.1), white, 0, 1.5, 0);
      fan.add(arm);
    }
    piece(fan, new THREE.SphereGeometry(0.3, 8, 6), light, 0, 0, 0);
    g.add(fan);
    g.userData.spin = fan;
  } else if (kind === "workshop") {
    piece(g, new THREE.BoxGeometry(7, 3.4, 5.5), white, 0, 1.9, 0);
    const roof = piece(g, new THREE.CylinderGeometry(2.75, 2.75, 7, 12), metal, 0, 3.3, 0);
    roof.rotation.z = Math.PI / 2;
    piece(g, new THREE.BoxGeometry(5, 1.1, 0.2), light, 0, 2.2, -2.8);
    piece(g, new THREE.BoxGeometry(5, 1.1, 0.2), light, 0, 2.2, 2.8);
    piece(g, new THREE.CylinderGeometry(0.1, 0.1, 2.4, 5), dark, 2.4, 6.6, 0);
    piece(g, new THREE.BoxGeometry(1.6, 0.5, 1.6), paint(0xffb630), -1.6, 6.2, 0);
  } else if (kind === "silo") {
    piece(g, new THREE.CylinderGeometry(2.4, 2.4, 6, 12), white, 0, 3.2, 0);
    piece(g, new THREE.SphereGeometry(2.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), metal, 0, 6.2, 0);
    const band = piece(g, new THREE.TorusGeometry(2.45, 0.18, 5, 20), light, 0, 4.6, 0);
    band.rotation.x = Math.PI / 2;
    piece(g, new THREE.CylinderGeometry(2.8, 3, 0.5, 12), dark, 0, 0.25, 0);
  } else if (kind === "shock") {
    light.emissive.setHex(0xc8a8ff);
    g.userData.shine = 0xc8a8ff;
    piece(g, new THREE.CylinderGeometry(0.4, 0.9, 10, 7), dark, 0, 5, 0);
    piece(g, new THREE.SphereGeometry(1.1, 12, 8), light, 0, 10.8, 0);
    for (const y of [7, 8.6]) {
      const hoop = piece(g, new THREE.TorusGeometry(1, 0.14, 5, 14), metal, 0, y, 0);
      hoop.rotation.x = Math.PI / 2;
    }
  } else if (kind === "sonar") {
    piece(g, new THREE.CylinderGeometry(0.3, 0.7, 8.5, 7), dark, 0, 4.2, 0);
    const turner = new THREE.Group();
    turner.position.y = 9;
    const dish = piece(turner, new THREE.SphereGeometry(2, 12, 5, 0, Math.PI * 2, 0, Math.PI / 3), white, 0, 0, 0);
    dish.material = new THREE.MeshPhongMaterial({ color: 0xe6eef2, side: THREE.DoubleSide, flatShading: true });
    dish.rotation.x = -Math.PI / 2;
    dish.position.z = 1.2;
    piece(turner, new THREE.SphereGeometry(0.3, 8, 6), light, 0, 0, -0.4);
    g.add(turner);
    g.userData.turn = turner;
  } else if (kind === "rig") {
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const leg = piece(g, new THREE.CylinderGeometry(0.25, 0.25, 6.4, 5), dark, Math.cos(a) * 1.6, 2.9, Math.sin(a) * 1.6);
      leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
    piece(g, new THREE.BoxGeometry(2.4, 1.8, 2.4), paint(0xffb630), 0, 6.3, 0);
    piece(g, new THREE.BoxGeometry(1.2, 0.5, 0.2), light, 0, 6.3, -1.25);
    g.userData.pump = piece(g, new THREE.CylinderGeometry(0.35, 0.1, 5, 6), metal, 0, 2.8, 0);
  } else if (kind === "dome") {
    light.emissive.setHex(0xffe9a8);
    g.userData.shine = 0xffe9a8;
    piece(g, new THREE.CylinderGeometry(5.2, 5.7, 0.9, 18), metal, 0, 0.45, 0);
    piece(g, new THREE.SphereGeometry(5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0xa8f0ff, transparent: true, opacity: 0.3, shininess: 100, side: THREE.DoubleSide }), 0, 0.9, 0);
    piece(g, new THREE.SphereGeometry(0.5, 8, 6), light, 0, 4.4, 0);
    const leaf = paint(0x3fbf6a, 0x0a3a1a);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      piece(g, new THREE.ConeGeometry(0.7, 1.6 + (i % 3) * 0.6, 6), leaf, Math.cos(a) * 2.6, 1.8, Math.sin(a) * 2.6);
    }
    piece(g, new THREE.BoxGeometry(1.6, 0.6, 1), paint(0xd8442e), 0, 1.2, 0);
  } else if (kind === "lamp") {
    light.emissive.setHex(0xfff0b0);
    g.userData.shine = 0xfff0b0;
    piece(g, new THREE.CylinderGeometry(0.12, 0.25, 4.2, 5), dark, 0, 2.1, 0);
    piece(g, new THREE.SphereGeometry(0.5, 8, 6), light, 0, 4.5, 0);
    const halo = glow(0xfff0b0, 9);
    halo.position.y = 4.5;
    g.add(halo);
    g.userData.halo = halo;
  }
  return g;
}

// Switch a base piece's lights on or off
function lightModule(group, on) {
  group.userData.light.emissive.setHex(on ? group.userData.shine : 0x000000);
  if (group.userData.halo) group.userData.halo.visible = on;
}

// ===== 10. Little sea life (they can't hurt you) =====
// Schools of fish that swim round and round
const SCHOOL_FISH = 12;
const schools = [];
const fishMesh = (function () {
  const shape = new THREE.ConeGeometry(0.32, 1.5, 5);
  shape.rotateX(-Math.PI / 2);
  shape.scale(0.6, 1, 1);
  const tints = { shelf: [0xdff6ff, 0xffd76a, 0x9fd8ff], forest: [0x8dffd0, 0xff9ad8], arches: [0xffb53c, 0xc8a8ff], smokers: [0xff7a50] };
  for (const id in tints) {
    for (let k = 0; k < (id === "shelf" ? 5 : 3); k++) {
      const spot = spotIn(id, dice, 20);
      schools.push({
        x: spot.x, z: spot.z, y: groundAt(spot.x, spot.z) + 6 + dice() * 16,
        r: 7 + dice() * 9, speed: (0.25 + dice() * 0.3) * (dice() < 0.5 ? 1 : -1), tint: tints[id][k % tints[id].length],
      });
    }
  }
  const mesh = new THREE.InstancedMesh(shape, new THREE.MeshLambertMaterial({ color: 0xffffff }), schools.length * SCHOOL_FISH);
  const tint = new THREE.Color();
  schools.forEach(function (school, s) {
    for (let i = 0; i < SCHOOL_FISH; i++) mesh.setColorAt(s * SCHOOL_FISH + i, tint.setHex(school.tint));
  });
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
})();

// Driftwhales: huge gentle singers of the Shelf
const whales = [];
(function () {
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    g.rotation.order = "YXZ";
    const skin = paint(0x7fa8c8, 0x0a1c2a);
    const body = piece(g, new THREE.SphereGeometry(3, 14, 10), skin, 0, 0, 0);
    body.scale.set(1, 0.9, 3.2);
    const tail = new THREE.Group();
    tail.position.set(0, 0, 8.5);
    piece(tail, new THREE.BoxGeometry(6, 0.3, 2.2), skin, 0, 0, 1.6);
    piece(tail, new THREE.CylinderGeometry(0.5, 1.3, 3, 8), skin, 0, 0, 0).rotation.x = -Math.PI / 2;
    g.add(tail);
    for (const side of [-1, 1]) {
      const fin = piece(g, new THREE.BoxGeometry(4, 0.25, 1.6), skin, side * 4, -1, -3);
      fin.rotation.z = side * -0.4;
      piece(g, new THREE.SphereGeometry(0.3, 6, 5), bright(0xbfffff), side * 2.5, 0.8, -6.5);
    }
    for (let k = 0; k < 6; k++) piece(g, new THREE.SphereGeometry(0.28, 6, 5), bright(0x9ff8ff), 0, 2.6 - Math.abs(k - 2.5) * 0.25, -5 + k * 2.2);
    scene.add(g);
    whales.push({ group: g, tail: tail, cx: i ? -250 : 280, cz: i ? 300 : 250, r: 55 + i * 15, phase: i * 3 });
  }
})();

// Glowing jellies bobbing in the Glimmer Forest
const jellies = pick("forest", 28).map(function (s) {
  return { x: s.x, y: s.y + 14 + dice() * 34, z: s.z, sx: 0.8 + dice() * 1.2, phase: dice() * 6 };
});
const jellyMesh = sprinkle(
  new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xff9ad8, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
  jellies
);

// ===== 11. Make the scenery move =====
// t = the time in seconds. (cx, cy, cz) = where the camera is.
function moveScenery(dt, t, cx, cy, cz) {
  // Smoke climbs out of the chimneys and starts again
  const puffs = smoke.geometry.attributes.position;
  for (let i = 0; i < puffs.count; i++) {
    const stack = stacks[i % Math.min(stacks.length, 36)];
    const up = (t * 3.5 + i * 7.3) % 34;
    puffs.setXYZ(i, stack.x + Math.sin(i + up * 0.2) * up * 0.12, stack.y + up, stack.z + Math.cos(i * 1.7 + up * 0.2) * up * 0.12);
  }
  puffs.needsUpdate = true;
  spores.position.y = Math.sin(t * 0.3) * 1.5;

  // Sea snow stays in a box around the camera: a speck that drifts out one side comes in the other
  snow.position.set(cx, cy, cz);
  const flakes = snow.geometry.attributes.position.array;
  const half = SNOW_BOX / 2;
  for (let i = 0; i < flakes.length; i += 3) {
    flakes[i + 1] -= dt * 0.5;
  }
  if (moveScenery.last) {
    const dx = cx - moveScenery.last.x;
    const dy = cy - moveScenery.last.y;
    const dz = cz - moveScenery.last.z;
    for (let i = 0; i < flakes.length; i += 3) {
      flakes[i] = ((flakes[i] - dx + half) % SNOW_BOX + SNOW_BOX) % SNOW_BOX - half;
      flakes[i + 1] = ((flakes[i + 1] - dy + half) % SNOW_BOX + SNOW_BOX) % SNOW_BOX - half;
      flakes[i + 2] = ((flakes[i + 2] - dz + half) % SNOW_BOX + SNOW_BOX) % SNOW_BOX - half;
    }
  }
  moveScenery.last = { x: cx, y: cy, z: cz };
  snow.geometry.attributes.position.needsUpdate = true;

  // Bubbles float up and fade away
  const pops = bubbles.geometry.attributes.position;
  for (let i = 0; i < BUBBLES; i++) {
    bubbleAge[i] += dt;
    if (bubbleAge[i] > 1.6) pops.setY(i, 9999);
    else pops.setY(i, pops.getY(i) + dt * 1.6);
  }
  pops.needsUpdate = true;

  // Fish
  schools.forEach(function (school, s) {
    for (let i = 0; i < SCHOOL_FISH; i++) {
      const a = t * school.speed + i * 0.5 + (i % 3) * 0.2;
      const r = school.r + (i % 4) * 0.9;
      helper.position.set(school.x + Math.cos(a) * r, school.y + Math.sin(a * 2 + i) * 1.6 + (i % 5) * 0.5, school.z + Math.sin(a) * r);
      // Face the way it is swimming
      const way = school.speed > 0 ? 1 : -1;
      helper.rotation.set(0, Math.atan2(Math.sin(a) * way, -Math.cos(a) * way), 0);
      helper.scale.set(1, 1, 1);
      helper.updateMatrix();
      fishMesh.setMatrixAt(s * SCHOOL_FISH + i, helper.matrix);
    }
  });
  fishMesh.instanceMatrix.needsUpdate = true;

  // Whales
  whales.forEach(function (whale) {
    const a = t * 0.05 + whale.phase;
    whale.group.position.set(whale.cx + Math.cos(a) * whale.r, -19 + Math.sin(t * 0.2 + whale.phase) * 4, whale.cz + Math.sin(a) * whale.r);
    whale.group.rotation.y = Math.atan2(Math.sin(a), -Math.cos(a));
    whale.tail.rotation.x = Math.sin(t * 1.2 + whale.phase) * 0.35;
  });

  // Jellies
  jellies.forEach(function (jelly, i) {
    const squeeze = 1 + Math.sin(t * 1.6 + jelly.phase) * 0.15;
    helper.position.set(jelly.x, jelly.y + Math.sin(t * 0.5 + jelly.phase) * 3, jelly.z);
    helper.rotation.set(0, 0, 0);
    helper.scale.set(jelly.sx * squeeze, jelly.sx / squeeze, jelly.sx * squeeze);
    helper.updateMatrix();
    jellyMesh.setMatrixAt(i, helper.matrix);
  });
  jellyMesh.instanceMatrix.needsUpdate = true;

  // Power cores spin and bob
  cores.forEach(function (core) {
    core.gem.rotation.y = t * 1.2;
    core.gem.position.y = 4 + Math.sin(t * 2) * 0.3;
  });
}
