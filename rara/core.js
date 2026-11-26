// Ra Ra Escape: the basics.
// Setting up the 3D picture, some helpers that every other file uses,
// and the model of the man you play as.

// ===== 1. Setting up =====
const canvas = document.getElementById("game");
const testing = location.search.includes("test");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a1020, 20, 200);
const camera = new THREE.PerspectiveCamera(62, 1.5, 0.3, 1200);
const UP = new THREE.Vector3(0, 1, 0);
const helper = new THREE.Object3D();
const skyLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
sunLight.position.set(-0.4, 1, 0.5);
scene.add(skyLight, sunLight);

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

// ===== 2. Helpers =====
function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function smooth(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

// Random numbers that come out the same every time (so each level is always the same)
function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lumpy "noise": a number from 0 to 1 that changes gently from place to place
function bumps(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const at = function (a, b) {
    let n = Math.imul(a, 374761393) + Math.imul(b, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  return (at(ix, iz) + (at(ix + 1, iz) - at(ix, iz)) * fx) * (1 - fz) + (at(ix, iz + 1) + (at(ix + 1, iz + 1) - at(ix, iz + 1)) * fx) * fz;
}

function paint(colour, glowColour) {
  return new THREE.MeshPhongMaterial({ color: colour, emissive: glowColour || 0x000000, shininess: 12, flatShading: true });
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

function box(parent, material, w, h, d, x, y, z) {
  return piece(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}

const ballShape = new THREE.SphereGeometry(1, 10, 8);
function ball(parent, material, rx, ry, rz, x, y, z) {
  const mesh = piece(parent, ballShape, material, x, y, z);
  mesh.scale.set(rx, ry, rz);
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

// Put many copies of one shape into a group in one go. spots = [{ x, y, z, sx, sy, sz, turn, tint }]
function sprinkle(parent, geometry, material, spots) {
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
  parent.add(mesh);
  return mesh;
}

// A soft round glow
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

// Words painted on a flat board (for shop signs)
function makeSign(text, back, ink, wide) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const pen = c.getContext("2d");
  pen.fillStyle = back;
  pen.fillRect(0, 0, 512, 96);
  pen.fillStyle = ink;
  pen.font = "bold 54px Arial, sans-serif";
  pen.textAlign = "center";
  pen.fillText(text, 256, 68, 490);
  return new THREE.Mesh(new THREE.PlaneGeometry(wide, wide * 96 / 512), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
}

// Words that float in the air and always face you (for "RA RA!")
function makeShout(text, colour) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const pen = c.getContext("2d");
  pen.font = "bold 64px Arial, sans-serif";
  pen.textAlign = "center";
  pen.lineWidth = 8;
  pen.strokeStyle = "#000";
  pen.strokeText(text, 128, 70);
  pen.fillStyle = colour;
  pen.fillText(text, 128, 70);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, fog: false }));
  sprite.scale.set(8, 3, 1);
  return sprite;
}

// ===== 3. A person =====
// Used for the man you play as, and (in a white coat) for the scientist.
// It comes back with its arms and legs, so the game can make them swing.
function makePerson(coat, trousers, hair) {
  const g = new THREE.Group();
  const skin = paint(0xf0c8a0);
  const top = paint(coat);
  const legPaint = paint(trousers);
  box(g, top, 0.75, 0.85, 0.42, 0, 1.3, 0);
  ball(g, skin, 0.27, 0.3, 0.27, 0, 1.98, 0);
  ball(g, paint(hair), 0.29, 0.2, 0.29, 0, 2.14, 0.03);
  const limbs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.2, 0.9, 0);
    box(leg, legPaint, 0.28, 0.9, 0.3, 0, -0.45, 0);
    box(leg, paint(0x2a2a30), 0.3, 0.14, 0.46, 0, -0.86, -0.08);
    const arm = new THREE.Group();
    arm.position.set(side * 0.5, 1.65, 0);
    box(arm, top, 0.22, 0.75, 0.24, 0, -0.35, 0);
    ball(arm, skin, 0.12, 0.12, 0.12, 0, -0.78, 0);
    g.add(leg, arm);
    limbs.push(leg, arm);
  }
  return { group: g, limbs: limbs };
}

// Swing a person's arms and legs. "pace" is how fast they are going (0 = standing still).
function walkPerson(person, t, pace) {
  const swing = Math.sin(t * (6 + pace * 0.9)) * Math.min(1, pace / 3) * 0.8;
  person.limbs[0].rotation.x = swing;
  person.limbs[1].rotation.x = -swing;
  person.limbs[2].rotation.x = -swing;
  person.limbs[3].rotation.x = swing;
}
