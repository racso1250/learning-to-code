// Space Explorers: the first-person 3D view.
// game.js still plays the game on a flat map. This file shows that map through your own eyes:
// the ground is a big painted floor, and trees, rocks, crew and demons are flat pictures
// standing upright that always turn to face you (the way early 3D games did it).

const view = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: false });
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1.5, 0.05, 120);
camera.rotation.order = "YXZ";
scene.add(camera);
scene.fog = new THREE.Fog(0x000000, 10, 40);
const UNIT = 1 / TILE;           // the map is measured in pixels; 16 pixels = 1 step in 3D
const EYE = 1.55;                // how high your eyes are
const SKIES = ["#8ecbff", "#f2c890", "#cfe6ff", "#6a2a26", "#3a2458"];

function fitView() {
  const w = view.clientWidth || 900;
  renderer.setSize(w, Math.round(w / 1.5), false);
}
window.addEventListener("resize", fitView);
fitView();

// ----- Lights -----
const daylight = new THREE.AmbientLight(0xffffff, 1);
scene.add(daylight);
// Your torch: a cone of light fixed to your head
const torch = new THREE.SpotLight(0xfff0c8, 0, 9, 0.5, 0.6, 1);
torch.position.set(0, 0, 0);
torch.target.position.set(0, 0, -1);
camera.add(torch, torch.target);
// A handful of lamps to share between the ship and the nearest lamps you have built
const lamps = [];
for (let i = 0; i < 6; i++) {
  const lamp = new THREE.PointLight(0xffd68c, 0, 6, 1.2);
  lamps.push(lamp);
  scene.add(lamp);
}

// Your blaster, held out in front of you
const blaster = new THREE.Group();
const metal = new THREE.MeshBasicMaterial({ color: 0x6a7282, fog: false });
const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.34), metal);
const tip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.1), new THREE.MeshBasicMaterial({ color: 0x8fe6ff, fog: false }));
tip.position.set(0, 0.02, -0.2);
blaster.add(body, tip);
blaster.scale.set(0.42, 0.42, 0.42);
blaster.position.set(0.2, -0.16, -0.5);
camera.add(blaster);

// ----- Turning the pixel-art pictures into things in the 3D world -----
const textures = new Map();
function textureOf(picture) {
  let texture = textures.get(picture);
  if (!texture) {
    texture = new THREE.CanvasTexture(picture);
    texture.magFilter = THREE.NearestFilter;      // keep the pixels sharp
    texture.minFilter = THREE.NearestFilter;
    textures.set(picture, texture);
  }
  return texture;
}
// An upright card, standing on its bottom edge
const card3d = new THREE.PlaneGeometry(1, 1);
card3d.translate(0, 0.5, 0);
const litMaterials = new Map();
function litMaterial(picture) {
  if (!litMaterials.has(picture)) litMaterials.set(picture, new THREE.MeshPhongMaterial({ map: textureOf(picture), alphaTest: 0.5, shininess: 0 }));
  return litMaterials.get(picture);
}

const land = new THREE.Group();        // the ground and everything that grows on this planet
scene.add(land);
let scenery = [];
let sea = null;
let shipModel = null;

// The ship, built from real 3D shapes
function makeShip() {
  const ship = new THREE.Group();
  const grey = new THREE.MeshPhongMaterial({ color: 0xcdd3dc, shininess: 40 });
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), grey);
  hull.scale.set(2.4, 0.62, 2.4);
  hull.position.y = 1.5;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.1, 6, 28), new THREE.MeshPhongMaterial({ color: 0xe0503a }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.5;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x5ab0e8, shininess: 80, transparent: true, opacity: 0.85 }));
  dome.position.y = 1.85;
  ship.add(hull, ring, dome);
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6), new THREE.MeshPhongMaterial({ color: 0x5a6272 }));
    const angle = (i / 3) * Math.PI * 2 + 0.5;
    leg.position.set(Math.cos(angle) * 1.9, 0.75, Math.sin(angle) * 1.9);
    leg.rotation.z = Math.cos(angle) * 0.4;
    leg.rotation.x = -Math.sin(angle) * 0.4;
    ship.add(leg);
  }
  for (let i = 0; i < 8; i++) {
    const window3d = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
    const angle = (i / 8) * Math.PI * 2;
    window3d.position.set(Math.cos(angle) * 2.25, 1.62, Math.sin(angle) * 2.25);
    window3d.rotation.y = -angle + Math.PI / 2;
    ship.add(window3d);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b4a, fog: false }));
  beacon.position.y = 3.1;
  ship.userData.beacon = beacon;
  ship.add(beacon);
  return ship;
}

// Build the planet you have just landed on
function build3D() {
  while (land.children.length) land.remove(land.children[0]);
  for (const [name, mesh] of pool) scene.remove(mesh);
  pool.clear();
  // The ground: each painted piece of map becomes a big flat tile
  for (let cy = 0; cy * CHUNK < MAP_H; cy++) {
    for (let cx = 0; cx * CHUNK < MAP_W; cx++) {
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK, CHUNK), new THREE.MeshPhongMaterial({ map: textureOf(groundChunk(cx, cy).ground), alphaTest: 0.5, shininess: 0 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(cx * CHUNK + CHUNK / 2, 0, cy * CHUNK + CHUNK / 2);
      land.add(floor);
    }
  }
  // Water (or lava) lies just under the ground and shows through the holes
  const lava = WORLD.planet.pool === "L";
  const liquid = makeCanvas(64, 64);
  liquid.getContext("2d").drawImage(lava ? lavaFlow : water, 0, 0);
  const waves = new THREE.CanvasTexture(liquid);
  waves.magFilter = THREE.NearestFilter;
  waves.wrapS = waves.wrapT = THREE.RepeatWrapping;
  waves.repeat.set(MAP_W / 4, MAP_H / 4);
  sea = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W + 60, MAP_H + 60), lava ? new THREE.MeshBasicMaterial({ map: waves }) : new THREE.MeshPhongMaterial({ map: waves, shininess: 60 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(MAP_W / 2, -0.12, MAP_H / 2);
  land.add(sea);
  // Trees, rocks and mountains: upright pictures
  scenery = [];
  for (const row of rows) {
    for (const thing of row) {
      const mesh = new THREE.Mesh(card3d, litMaterial(thing.img));
      mesh.scale.set(thing.img.width * UNIT, thing.img.height * UNIT, 1);
      mesh.position.set(thing.bx * UNIT, 0, (thing.by - 3) * UNIT);
      land.add(mesh);
      scenery.push(mesh);
    }
  }
  if (!shipModel) shipModel = makeShip();
  shipModel.position.set(shipX * UNIT, 0, (shipY - 20) * UNIT);
  land.add(shipModel);
}

// Things that come and go (people, demons, pickups, shots): each frame the game says what should
// be shown, and anything not asked for this frame is taken away again.
const pool = new Map();
const wanted = new Set();
function show(name, picture, x, y, options) {
  const o = options || {};
  let mesh = pool.get(name);
  if (!mesh) {
    const material = o.glow ? new THREE.MeshBasicMaterial({ alphaTest: 0.5, fog: !o.always }) : new THREE.MeshPhongMaterial({ alphaTest: 0.5, shininess: 0 });
    mesh = new THREE.Mesh(card3d, material);
    pool.set(name, mesh);
    scene.add(mesh);
  }
  wanted.add(name);
  if (mesh.material.map !== textureOf(picture)) {
    mesh.material.map = textureOf(picture);
    mesh.material.needsUpdate = true;
  }
  const size = o.size || 1;
  mesh.scale.set(picture.width * UNIT * size, picture.height * UNIT * size, 1);
  mesh.position.set(x * UNIT, o.lift || 0, y * UNIT);
  mesh.rotation.y = Math.atan2(camera.position.x - mesh.position.x, camera.position.z - mesh.position.z);
  return mesh;
}

// A pair of glowing eyes (two bright dots), for the things in the dark
function eyePicture(colour) {
  const picture = makeCanvas(7, 1);
  const g = picture.getContext("2d");
  g.fillStyle = colour;
  g.fillRect(0, 0, 2, 1);
  g.fillRect(5, 0, 2, 1);
  return picture;
}
const EYES = { yellow: eyePicture("#ffe14a"), red: eyePicture("#ff5a3a") };
const shotPictures = { friend: eyePicture("#8fe6ff"), foe: eyePicture("#ff7a1a") };
const dot = (function () {
  const picture = makeCanvas(1, 1);
  picture.getContext("2d").fillStyle = "#ffffff";
  picture.getContext("2d").fillRect(0, 0, 1, 1);
  return picture;
})();
document.getElementById("scare-face").src = SPR.face.toDataURL();

const stars3d = (function () {
  const spots = [];
  for (let i = 0; i < 400; i++) {
    const a = Math.random() * Math.PI * 2;
    const up = Math.random() * 0.9 + 0.08;
    const flat = Math.sqrt(1 - up * up);
    spots.push(Math.cos(a) * flat * 100, up * 100, Math.sin(a) * flat * 100);
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(spots, 3));
  const points = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true }));
  points.frustumCulled = false;
  scene.add(points);
  return points;
})();

function draw3D() {
  // Where you are, and which way you are looking
  const jolt = shake > 0 ? shake * 0.25 : 0;
  camera.position.set(player.x * UNIT + (Math.random() - 0.5) * jolt, EYE + Math.sin(player.anim * 12) * 0.03 + (Math.random() - 0.5) * jolt, (player.y - 4) * UNIT);
  camera.rotation.set(tilt, -beam - Math.PI / 2, 0);
  blaster.position.y = -0.16 + Math.sin(player.anim * 12) * 0.006 + (player.cool > 0.12 ? 0.015 : 0);

  // The light: bright sky by day; at night almost nothing but your torch
  const colour = ambient();
  const night = Math.max(0, Math.min(1, (1 - (colour[0] + colour[1] + colour[2]) / 3) / 0.75));
  daylight.color.setRGB(colour[0], colour[1], colour[2]);
  daylight.intensity = 1 - night * 0.45;
  const dim = flicker > 0 && state.phase === "night" ? 0.3 + Math.random() * 0.5 : 1;
  torch.intensity = night * 2.2 * (flicker > 0 ? 0.6 + Math.random() * 0.4 : 1);
  const sky = new THREE.Color(SKIES[state.planet]).multiplyScalar(1 - night * 0.97);
  renderer.setClearColor(sky);
  scene.fog.color.copy(sky);
  scene.fog.near = 12 - night * 10.5;
  scene.fog.far = 42 - night * 28;
  stars3d.position.copy(camera.position);
  stars3d.material.opacity = night;
  sea.material.map.offset.set(time * 0.03, time * 0.012);
  // Lamps: the ship first, then the nearest ones you have built
  const glows = structures.filter((s) => s.type === "lamp").map((s) => ({ x: centre(s.tx), y: centre(s.ty), h: 1.2, reach: 6 }));
  glows.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
  glows.unshift({ x: shipX, y: shipY + 6, h: 1, reach: state.ups.light ? 13 : 7 });
  lamps.forEach(function (lamp, i) {
    const glow = glows[i];
    lamp.intensity = glow ? night * 1.6 * dim : 0;
    if (glow) {
      lamp.position.set(glow.x * UNIT, glow.h, glow.y * UNIT);
      lamp.distance = glow.reach;
    }
  });
  shipModel.userData.beacon.visible = Math.sin(time * 4) > 0;

  // Scenery turns to face you
  for (const mesh of scenery) mesh.rotation.y = Math.atan2(camera.position.x - mesh.position.x, camera.position.z - mesh.position.z);

  // Everything that moves
  wanted.clear();
  for (const item of items) {
    const picture = item.kind === "crystal" ? SPR.crystal : item.kind === "scrap" ? SPR.scrap : item.kind === "chart" ? SPR.chart : item.kind === "log" ? SPR.wreck : SPR.things[state.planet];
    const still = item.kind === "scrap" || item.kind === "log";
    show("item" + item.id, picture, item.x, item.y, { glow: !still, lift: still ? 0 : 0.25 + Math.abs(Math.sin(time * 3 + item.x)) * 0.2 });
  }
  structures.forEach((s) => show("built" + s.tx + "," + s.ty, SPR[s.type], centre(s.tx), centre(s.ty), { size: 1.3 }));
  for (const mate of crew) {
    const picture = SPR.crew[mate.id][mate.down ? 0 : mate.dir][mate.moving && !mate.down ? Math.floor(mate.anim * 8) % 4 : 0];
    show("crew" + mate.id, picture, mate.x, mate.y, { lift: mate.down ? -0.9 : 0 }).visible = Math.hypot(mate.x - player.x, mate.y - player.y) > 16;      // (not when they are right in your face)
  }
  demons.forEach(function (d, i) {
    d.name3d = d.name3d || "demon" + Math.random();
    const art = SPR.demons[d.type];
    const lift = d.def.flies ? 1.3 + Math.sin(time * 6 + d.x) * 0.15 : 0;
    const size = d.dash > 0 ? 1.5 : 1.25;
    const mesh = show(d.name3d, (d.flash > 0 ? art.hurt : art.frames)[d.frozen ? 0 : Math.floor(time * 5 + d.x) % 2], d.x, d.y, { lift: lift, size: size });
    mesh.visible = !d.hidden;
    // In the dark, only its eyes show
    if (state.phase === "night") show(d.name3d + "eyes", d.def.boss ? EYES.red : EYES.yellow, d.x, d.y, { glow: true, always: true, lift: lift + art.h * UNIT * size * 0.66, size: d.def.boss ? 4 : 1.6 }).visible = d.hidden && Math.sin(time * 1.7 + d.x) < 0.96;
  });
  if (state.phase === "night") watchers.forEach((eye, i) => (show("watcher" + i, EYES.red, eye.x, eye.y, { glow: true, always: true, lift: 0.7 + (i % 3) * 0.3, size: 1.6 }).visible = Math.sin(time * 1.3 + i * 2) < 0.9));
  shots.forEach(function (shot, i) {
    show("shot" + i, shot.foe ? shotPictures.foe : shotPictures.friend, shot.x, shot.y + 8, { glow: true, always: true, lift: 1.05, size: 1.4 });
  });
  bits.forEach(function (bit, i) {
    if (i < 120) show("bit" + i, dot, bit.x, bit.y + 8, { glow: true, lift: 0.9 + (bit.max - bit.life) * 0.5 * (i % 2 ? 1 : -1) + 0.3, size: 1.6 });
  });
  for (const [name, mesh] of pool) {
    if (wanted.has(name)) continue;
    scene.remove(mesh);
    mesh.material.dispose();
    pool.delete(name);
  }
  renderer.render(scene, camera);

  // Boo! The face that fills the screen when a demon pounces
  const face = document.getElementById("scare-face");
  face.hidden = scare <= 0;
  if (scare > 0) face.style.width = 50 + (0.45 - scare) * 70 + "%";
  drawRadar();
}

// The radar: you are in the middle, facing up. It shows the ship and the things worth finding.
// Demons only show on it when they are in the light.
const radar = document.getElementById("radar").getContext("2d");
function drawRadar() {
  radar.clearRect(0, 0, 72, 72);
  const blip = function (x, y, colour, size) {
    const dx = (x - player.x) / 14;
    const dy = (y - player.y) / 14;
    // turn the map so that the way you face is up
    let rx = -dx * Math.sin(beam) + dy * Math.cos(beam);
    let ry = -dx * Math.cos(beam) - dy * Math.sin(beam);
    const far = Math.hypot(rx, ry);
    if (far > 32) {
      if (size < 3) return;          // only the ship stays on the rim when it is far away
      rx = (rx / far) * 32;
      ry = (ry / far) * 32;
    }
    radar.fillStyle = colour;
    radar.fillRect(Math.round(36 + rx - size / 2), Math.round(36 + ry - size / 2), size, size);
  };
  for (const item of items) blip(item.x, item.y, item.kind === "crystal" ? "#3ad8e8" : item.kind === "scrap" ? "#aab2c0" : item.kind === "chart" ? "#d8a0ff" : item.kind === "log" ? "#ff5a3a" : WORLD.planet.thing[1], 2);
  for (const mate of crew) blip(mate.x, mate.y, "#ffe14a", 2);
  for (const d of demons) if (!d.hidden) blip(d.x, d.y, "#ff3b4a", 2);
  blip(shipX, shipY, "#ffffff", 4);
  radar.fillStyle = "#8fe6ff";
  radar.fillRect(35, 33, 2, 5);
}
