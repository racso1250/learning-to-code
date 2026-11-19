// Cubewild: the game.
// world.js knows what the world is made of. This file draws it in 3D (with THREE.js),
// lets you walk about, dig and build, and looks after animals, night creatures, crafting and saving.

const el = (id) => document.getElementById(id);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const canvas = el("game");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1.5, 0.1, 700);
camera.rotation.order = "YXZ";      // turn left/right first, then look up/down
const VIEW = 5;                     // how many chunks you can see in each direction
const DAY_SECONDS = 420;            // how long a whole day and night lasts
const TEST = location.search.includes("test");    // (only for testing the game)

// Your hand, and whatever it is holding, is drawn on top of everything else (with its own little camera)
const handScene = new THREE.Scene();
const handCamera = new THREE.PerspectiveCamera(60, 1.5, 0.05, 10);
const handLight = new THREE.AmbientLight(0xffffff, 0.8);
const handSun = new THREE.DirectionalLight(0xffffff, 0.5);
handSun.position.set(-0.4, 1, 0.6);
handScene.add(handLight, handSun);
function resize() {
  const w = canvas.clientWidth || 960;
  const h = Math.round(w / 1.5);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  handCamera.aspect = w / h;
  handCamera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function sound(make) {
  try {
    make();
  } catch (error) {
    // no sound available: the game still works
  }
}
const sfx = {
  dig: () => sound(() => playNoise(0, 0.05, 1200, 500, 0.08)),
  crack: () => sound(() => playNoise(0, 0.14, 900, 200, 0.18)),
  put: () => sound(() => playTone(0, 0.07, 260, 160, 0.14)),
  pick: () => sound(() => playTone(0, 0.08, 700, 1050, 0.1)),
  hurt: () => sound(() => playTone(0, 0.22, 210, 70, 0.22)),
  happy: () => sound(() => { playTone(0, 0.08, 660, 880, 0.1); playTone(0.1, 0.1, 880, 1100, 0.1); }),
  boom: () => sound(() => { playNoise(0, 0.7, 700, 60, 0.4); playTone(0, 0.5, 120, 40, 0.3); }),
  make: () => sound(() => playJingle()),
};

// ----- How blocks are drawn -----
// One picture sheet for every block, and a tiny program for the graphics card (a "shader") that
// works out each pixel: the block's picture x (its shading x the daylight + any lantern glow), then fog.
const atlasCanvas = makeAtlas();
const atlas = new THREE.CanvasTexture(atlasCanvas);
atlas.magFilter = THREE.NearestFilter;
atlas.minFilter = THREE.NearestFilter;
const shared = { map: { value: atlas }, day: { value: new THREE.Color(1, 1, 1) }, fogColor: { value: new THREE.Color() }, fogNear: { value: 40 }, fogFar: { value: 80 }, time: { value: 0 } };
function blockMaterial(alpha) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({ alpha: { value: alpha } }, shared),
    vertexShader: `
      uniform float time;
      uniform float alpha;
      attribute vec3 shade;      // x: how bright this corner is. y: how much it sways in the wind (or bobs, if it is water).
      attribute float glow;
      varying vec2 vUv;
      varying float vLight;
      varying float vGlow;
      varying float vFar;
      varying vec3 vPlace;
      void main() {
        vUv = uv;
        vLight = shade.x;
        vGlow = glow;
        vec3 p = position;
        if (alpha < 1.0) p.y += (sin(time * 1.7 + p.x * 0.9 + p.z * 0.6) * 0.06 - 0.03) * shade.y;      // little waves on the water
        else {
          p.x += sin(time * 1.9 + p.x * 0.8 + p.z * 0.6 + p.y) * 0.07 * shade.y;                        // plants and leaves rustle
          p.z += cos(time * 1.6 + p.z * 0.9 + p.x * 0.5) * 0.06 * shade.y;
        }
        vPlace = p;
        vec4 seen = modelViewMatrix * vec4(p, 1.0);
        vFar = -seen.z;
        gl_Position = projectionMatrix * seen;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 day;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      uniform float alpha;
      uniform float time;
      varying vec2 vUv;
      varying float vLight;
      varying float vGlow;
      varying float vFar;
      varying vec3 vPlace;
      void main() {
        vec4 picture = texture2D(map, vUv);
        if (picture.a < 0.5) discard;
        vec3 light = min(vLight * day + vGlow * vec3(1.0, 0.84, 0.58), vec3(1.2));
        vec3 colour = picture.rgb * light;
        if (alpha < 1.0) {
          // Water: a little of the sky's colour, and ripples of light that drift across it
          float ripple = sin(vPlace.x * 2.6 + time * 1.8) * sin(vPlace.z * 2.6 + time * 1.3);
          colour = mix(colour, fogColor, 0.2) + vec3(0.08) * ripple * day;
        } else {
          // A soft shadow round the edge of each face, so every block stands out from its neighbours
          vec2 cell = fract(vUv * vec2(${ATLAS_COLS}.0, ${ATLAS_ROWS}.0));
          float edge = min(min(cell.x, 1.0 - cell.x), min(cell.y, 1.0 - cell.y));
          colour *= 0.88 + 0.12 * smoothstep(0.0, 0.09, edge);
        }
        gl_FragColor = vec4(mix(colour, fogColor, smoothstep(fogNear, fogFar, vFar)), alpha);
      }`,
    side: THREE.DoubleSide,
    transparent: alpha < 1,
    depthWrite: alpha === 1,
  });
}
const solidMaterial = blockMaterial(1);
const waterMaterial = blockMaterial(0.72);

// A small picture of each block (for the belt and the backpack), and its average colour (for the bits that fly off)
const icons = [];
const iconCanvases = [];
const colours = [];
for (let id = 1; id < BLOCKS.length; id++) {
  const tile = BLOCKS[id].tex[1];
  const icon = document.createElement("canvas");
  icon.width = 16;
  icon.height = 16;
  const g = icon.getContext("2d");
  g.drawImage(atlasCanvas, (tile % ATLAS_COLS) * 16, Math.floor(tile / ATLAS_COLS) * 16, 16, 16, 0, 0, 16, 16);
  icons[id] = icon.toDataURL();
  iconCanvases[id] = icon;
  const pixels = g.getImageData(0, 0, 16, 16).data;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    r += pixels[i]; gg += pixels[i + 1]; b += pixels[i + 2]; n++;
  }
  colours[id] = new THREE.Color(r / n / 255, gg / n / 255, b / n / 255);
}

// ----- What the game remembers (and saves) -----
const SAVE_NAME = "cubewildSave";
let state = null;
const player = { x: 0, y: 30, z: 0, vy: 0, yaw: 0, pitch: 0, grounded: false, fly: false, fallFrom: 0, inWater: false };

function freshState() {
  return {
    seed: Math.floor(Math.random() * 100000) + 1,
    x: 0, y: 0, z: 0, yaw: 0, pitch: -0.1,
    inv: {},                     // how many of each thing you have
    slots: [0, 0, 0, 0, 0, 0, 0, 0, 0],   // the 9 boxes on your belt
    sel: 0,                      // which box is picked
    builder: false,              // true in Creative mode: free blocks, no danger, and flying
    time: 0.06,                  // the time of day: 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight
    day: 1,
    clock: 0,                    // seconds played
    hp: 10,
    pick: 0,                     // your pick: 0 hands, 1 stone, 2 iron, 3 skygem
    spawn: null,                 // where you wake up
    grow: [],                    // saplings waiting to grow: [x, y, z, when]
  };
}

function save() {
  Object.assign(state, { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch });
  try {
    localStorage.setItem(SAVE_NAME, JSON.stringify({ state: state, edits: world.edits }));
  } catch (error) {
    // saving isn't allowed here (or the world got too big to save): keep playing anyway
  }
}

function startWorld(saved) {
  for (const chunk of world.chunks.values()) dropChunk(chunk);
  world.chunks.clear();
  world.lamps.clear();
  state = saved ? Object.assign(freshState(), saved.state) : freshState();
  world.seed = state.seed;
  world.edits = saved ? saved.edits : {};
  if (!state.spawn) {
    // Find a nice place to start: dry land that isn't desert
    for (let i = 0; i < 600; i++) {
      const x = Math.round(Math.cos(i * 2.4) * i * 1.5);
      const z = Math.round(Math.sin(i * 2.4) * i * 1.5);
      const land = landAt(x, z);
      if (land.h > SEA + 1 && land.kind !== "desert" && land.kind !== "snow") {
        state.spawn = [x + 0.5, groundAt(x, z) + 1, z + 0.5];
        break;
      }
    }
    state.spawn = state.spawn || [0.5, groundAt(0, 0) + 1, 0.5];
    [state.x, state.y, state.z] = state.spawn;
  }
  Object.assign(player, { x: state.x, y: state.y, z: state.z, yaw: state.yaw, pitch: state.pitch, vy: 0, fly: false, fallFrom: state.y });
  for (const creature of creatures) scene.remove(creature.group, creature.shadow);
  creatures.length = 0;
  for (const shot of shots) scene.remove(shot.mesh);
  shots.length = 0;
  fuses.length = 0;
  loading = true;
  drawBelt();
  el("mode-button").textContent = state.builder ? "Mode: Creative" : "Mode: Explorer";
}

// ----- Chunks: making their 3D shapes, and forgetting the far-away ones -----
function dropChunk(chunk) {
  for (const part of ["mesh", "water"]) {
    if (!chunk[part]) continue;
    scene.remove(chunk[part]);
    chunk[part].geometry.dispose();
    chunk[part] = null;
  }
}

function buildChunk(chunk) {
  const lists = meshChunk(chunk);
  dropChunk(chunk);
  for (const [part, list, material] of [["mesh", lists.solid, solidMaterial], ["water", lists.water, waterMaterial]]) {
    if (!list.index.length) continue;
    const shape = new THREE.BufferGeometry();
    shape.setAttribute("position", new THREE.Float32BufferAttribute(list.pos, 3));
    shape.setAttribute("uv", new THREE.Float32BufferAttribute(list.uv, 2));
    shape.setAttribute("shade", new THREE.Float32BufferAttribute(list.shade, 3));
    shape.setAttribute("glow", new THREE.Float32BufferAttribute(list.glow, 1));
    shape.setIndex(list.index);
    shape.computeBoundingSphere();
    chunk[part] = new THREE.Mesh(shape, material);
    scene.add(chunk[part]);
  }
  chunk.dirty = false;
}

let loading = true;
let tidyTimer = 0;
function updateChunks(dt) {
  const pcx = Math.floor(player.x) >> 4;
  const pcz = Math.floor(player.z) >> 4;
  const todo = [];
  for (let dz = -VIEW; dz <= VIEW; dz++) {
    for (let dx = -VIEW; dx <= VIEW; dx++) {
      if (dx * dx + dz * dz > (VIEW + 0.5) * (VIEW + 0.5)) continue;
      const chunk = chunkAt(pcx + dx, pcz + dz);
      if (chunk.dirty) todo.push([dx * dx + dz * dz, chunk]);
    }
  }
  todo.sort((a, b) => a[0] - b[0]);       // nearest first
  for (let i = 0; i < Math.min(todo.length, loading ? 5 : 2); i++) buildChunk(todo[i][1]);
  if (todo.length <= 5) loading = false;
  tidyTimer -= dt;
  if (tidyTimer <= 0) {
    tidyTimer = 2;
    for (const chunk of world.chunks.values()) {
      if (Math.max(Math.abs(chunk.cx - pcx), Math.abs(chunk.cz - pcz)) <= VIEW + 3) continue;
      dropChunk(chunk);
      world.chunks.delete(chunk.name);
      world.lamps.delete(chunk.name);
    }
  }
}

// ----- The sky: sun, moon, stars, clouds, and the colour of the light -----
scene.fog = new THREE.Fog(0x8ecbff, 40, 80);       // (for the animals and clouds; the blocks do their own fog)
const skyLight = new THREE.AmbientLight(0xffffff, 0.7);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.5);
scene.add(skyLight, sunLight);
const sun = new THREE.Mesh(new THREE.BoxGeometry(34, 34, 1), new THREE.MeshBasicMaterial({ color: 0xfff3a0, fog: false }));
const moon = new THREE.Mesh(new THREE.BoxGeometry(22, 22, 1), new THREE.MeshBasicMaterial({ color: 0xdfe6f5, fog: false }));
scene.add(sun, moon);
// The sky is the inside of a huge ball: pale at the horizon, deeper overhead, with a warm glow round the sun
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(640, 24, 14), new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sunWay: { value: new THREE.Vector3(0, 1, 0) }, sunGlow: { value: new THREE.Color() } },
  vertexShader: `
    varying vec3 vWay;
    void main() {
      vWay = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 top;
    uniform vec3 bottom;
    uniform vec3 sunWay;
    uniform vec3 sunGlow;
    varying vec3 vWay;
    void main() {
      vec3 way = normalize(vWay);
      vec3 colour = mix(bottom, top, pow(clamp(way.y * 1.5 + 0.05, 0.0, 1.0), 0.6));
      float towards = max(0.0, dot(way, sunWay));
      colour += sunGlow * (pow(towards, 5.0) * 0.45 + pow(towards, 50.0) * 0.5);
      gl_FragColor = vec4(colour, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
}));
skyDome.renderOrder = -10;
skyDome.frustumCulled = false;
scene.add(skyDome);
// A soft glow round the sun and the moon
const glowPicture = (function () {
  const board = document.createElement("canvas");
  board.width = board.height = 64;
  const g2 = board.getContext("2d"), fade = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(0.35, "rgba(255,255,255,0.3)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  g2.fillStyle = fade;
  g2.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(board);
})();
const haloOf = function (colour, size) {
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowPicture, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  halo.scale.set(size, size, 1);
  scene.add(halo);
  return halo;
};
const sunHalo = haloOf(0xffe9a0, 190), moonHalo = haloOf(0xa8c0ff, 90);
// The moon has a few grey craters
moon.material.map = (function () {
  const board = document.createElement("canvas");
  board.width = board.height = 8;
  const g2 = board.getContext("2d");
  g2.fillStyle = "#ffffff";
  g2.fillRect(0, 0, 8, 8);
  g2.fillStyle = "#c2cadc";
  for (const [x, y, w, h] of [[1, 1, 2, 2], [5, 2, 2, 1], [3, 5, 1, 1], [5, 5, 2, 2], [1, 6, 1, 1]]) g2.fillRect(x, y, w, h);
  const picture = new THREE.CanvasTexture(board);
  picture.magFilter = THREE.NearestFilter;
  return picture;
})();
const starSpots = [];
for (let i = 0; i < 500; i++) {
  const a = Math.random() * Math.PI * 2;
  const up = Math.random() * 0.95 + 0.05;
  const flat = Math.sqrt(1 - up * up);
  starSpots.push(Math.cos(a) * flat * 500, up * 500, Math.sin(a) * flat * 500);
}
const starShape = new THREE.BufferGeometry();
starShape.setAttribute("position", new THREE.Float32BufferAttribute(starSpots, 3));
const stars = new THREE.Points(starShape, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true }));
stars.frustumCulled = false;
scene.add(stars);
const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
const clouds = [];
for (let i = 0; i < 26; i++) {
  // Each cloud is a few flat boxes that overlap, so it looks puffy
  const cloud = new THREE.Group();
  const wide = 16 + Math.random() * 22, deep = 10 + Math.random() * 16;
  for (let k = 0; k < 4; k++) {
    const puff = new THREE.Mesh(new THREE.BoxGeometry(wide * (0.5 + Math.random() * 0.5), 2.5 + Math.random() * 2.5, deep * (0.5 + Math.random() * 0.5)), cloudMaterial);
    puff.position.set((Math.random() - 0.5) * wide * 0.8, k * 1.2, (Math.random() - 0.5) * deep * 0.8);
    cloud.add(puff);
  }
  cloud.userData = { x: Math.random() * 480 - 240, z: Math.random() * 480 - 240, y: 72 + Math.random() * 16 };
  clouds.push(cloud);
  scene.add(cloud);
}

let sunHeight = 1;     // 1 at noon, -1 at midnight
function updateSky(dt) {
  if (playing) {
    state.time += dt / DAY_SECONDS;
    if (state.time >= 1) {
      state.time -= 1;
      state.day++;
    }
  }
  const angle = state.time * Math.PI * 2;
  sunHeight = Math.sin(angle);
  const light = clamp((sunHeight + 0.15) / 0.4, 0, 1);            // 0 at night, 1 in the day
  const blush = Math.max(0, 1 - Math.abs(sunHeight) / 0.3);       // sunrise and sunset
  shared.day.value.setRGB(0.2 + 0.8 * light, 0.22 + 0.78 * light - 0.1 * blush * light, 0.36 + 0.64 * light - 0.24 * blush * light);
  const sky = new THREE.Color(0.03 + 0.5 * light + 0.45 * blush, 0.04 + 0.74 * light + 0.05 * blush, 0.1 + 0.9 * light - 0.2 * blush * light);
  const under = BLOCKS[getBlock(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z))].liquid;
  if (under) sky.setRGB(0.08, 0.3 * (0.3 + light * 0.7), 0.62 * (0.3 + light * 0.7));
  const far = under ? 20 : VIEW * CH - 6;
  const near = under ? 1 : far * 0.55;
  shared.fogColor.value.copy(sky);
  shared.fogNear.value = near;
  shared.fogFar.value = far;
  scene.fog.color.copy(sky);
  scene.fog.near = near;
  scene.fog.far = far;
  renderer.setClearColor(sky);
  // The sky ball: the horizon is the colour of the mist, and it gets deeper overhead
  skyDome.position.copy(camera.position);
  skyDome.material.uniforms.bottom.value.copy(sky);
  skyDome.material.uniforms.top.value.setRGB(sky.r * (under ? 1 : 0.42), sky.g * (under ? 1 : 0.6), under ? sky.b : Math.min(1, sky.b * 0.96 + 0.03));
  skyDome.material.uniforms.sunWay.value.set(Math.cos(angle) * 560, sunHeight * 560, 130).normalize();
  skyDome.material.uniforms.sunGlow.value.setRGB(1, 0.72, 0.36).multiplyScalar(under ? 0 : light * 0.35 + blush * 0.75);
  el("under").style.opacity = under ? 1 : 0;
  shared.time.value = state.clock;
  handLight.intensity = 0.4 + 0.45 * light;
  handSun.intensity = 0.15 + 0.45 * light;
  skyLight.intensity = 0.3 + 0.5 * light;
  sunLight.intensity = 0.5 * light;
  sunLight.position.set(Math.cos(angle), Math.max(0.2, sunHeight), 0.3);
  sun.position.set(camera.position.x + Math.cos(angle) * 560, camera.position.y + sunHeight * 560, camera.position.z + 130);
  moon.position.set(camera.position.x - Math.cos(angle) * 560, camera.position.y - sunHeight * 560, camera.position.z - 130);
  sun.lookAt(camera.position);
  moon.lookAt(camera.position);
  sunHalo.position.copy(sun.position);
  moonHalo.position.copy(moon.position);
  sunHalo.material.opacity = 0.75 + blush * 0.25;
  moonHalo.material.opacity = 0.7 * (1 - light);
  sun.material.color.setRGB(1, 0.95 - 0.3 * blush, 0.63 - 0.4 * blush);
  stars.position.copy(camera.position);
  stars.material.opacity = 1 - light;
  cloudMaterial.color.setRGB(0.3 + 0.7 * light + 0.1 * blush, 0.3 + 0.7 * light - 0.1 * blush, 0.4 + 0.6 * light - 0.2 * blush);
  for (const cloud of clouds) {
    cloud.userData.x += dt * 1.6;
    const wrap = (n) => ((((n % 480) + 480) % 480) - 240);
    cloud.position.set(player.x + wrap(cloud.userData.x - player.x), cloud.userData.y, player.z + wrap(cloud.userData.z - player.z));
  }
}

// ----- Keyboard and mouse -----
const keys = {};
const mouse = { left: false, right: false };
let lastSpace = 0;
let playing = false;
let bagOpen = false;

function grabMouse() {
  el("intro").hidden = true;
  if (TEST) playing = true;
  else canvas.requestPointerLock();
}
el("start").addEventListener("click", function () {
  setMode(false);
  grabMouse();
});
document.addEventListener("pointerlockchange", function () {
  playing = document.pointerLockElement === canvas;
  mouse.left = mouse.right = false;
  if (!playing && !bagOpen) {
    el("intro").hidden = false;
    save();
  }
});
document.addEventListener("mousemove", function (event) {
  if (!playing) return;
  player.yaw -= event.movementX * 0.0024;
  player.pitch = clamp(player.pitch - event.movementY * 0.0024, -1.55, 1.55);
});
canvas.addEventListener("mousedown", function (event) {
  if (!playing) return;
  if (event.button === 0) {
    mouse.left = true;
    attack();
  }
  if (event.button === 2) {
    mouse.right = true;
    useOrPlace();
    placeTimer = 0.28;
  }
});
document.addEventListener("mouseup", function (event) {
  if (event.button === 0) mouse.left = false;
  if (event.button === 2) mouse.right = false;
});
document.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("wheel", function (event) {
  if (!playing) return;
  event.preventDefault();
  state.sel = (state.sel + (event.deltaY > 0 ? 1 : 8)) % 9;
  drawBelt();
}, { passive: false });
document.addEventListener("keydown", function (event) {
  if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
  if (event.repeat) return;
  keys[event.code] = true;
  if (event.code === "KeyE" && (playing || bagOpen)) toggleBag();
  if (!playing) return;
  if (event.code.startsWith("Digit") && event.code !== "Digit0") {
    state.sel = Number(event.code.slice(5)) - 1;
    drawBelt();
  }
  // Flying (Creative mode): press G, or tap Space twice quickly
  const doubleTap = event.code === "Space" && performance.now() - lastSpace < 300;
  if (event.code === "Space") lastSpace = performance.now();
  if (event.code === "KeyG" || (doubleTap && state.builder)) {
    if (!state.builder) toast("You can only fly in Creative mode.");
    else {
      player.fly = !player.fly;
      toast(player.fly ? "Flying! Space: up. Shift: down." : "Walking again.", 2);
    }
  }
  // Creative mode: T jumps the clock forward (morning, afternoon, evening, night)
  if (event.code === "KeyT" && state.builder) {
    state.time = (Math.floor(state.time * 4 + 1) % 4) / 4 + 0.06;
    toast(["Morning", "Afternoon", "Evening", "Night"][Math.floor(state.time * 4)], 2);
  }
});
document.addEventListener("keyup", (event) => (keys[event.code] = false));

let toastTimer = 0;
function toast(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastTimer = seconds || 3;
}

// ----- Walking, jumping, swimming and flying -----
function blocked(x, y, z) {
  // You are a box 0.6 wide and 1.75 tall. Is any solid block inside that box?
  for (let by = Math.floor(y); by <= Math.floor(y + 1.75); by++) {
    for (let bz = Math.floor(z - 0.3); bz <= Math.floor(z + 0.3); bz++) {
      for (let bx = Math.floor(x - 0.3); bx <= Math.floor(x + 0.3); bx++) if (isSolid(getBlock(bx, by, bz))) return true;
    }
  }
  return false;
}

function movePlayer(dt) {
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const across = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  let wx = -sin * ahead + cos * across;
  let wz = -cos * ahead - sin * across;
  const length = Math.hypot(wx, wz) || 1;
  const feet = getBlock(Math.floor(player.x), Math.floor(player.y + 0.2), Math.floor(player.z));
  player.inWater = Boolean(BLOCKS[feet].liquid);
  const speed = (player.fly ? 12 : player.inWater ? 3 : keys.ShiftLeft || keys.ShiftRight ? 6.6 : 4.3) * (chillTimer > 0 ? 0.55 : 1);
  if ((ahead || across) && (player.grounded || player.fly)) walkPhase += dt * (keys.ShiftLeft || keys.ShiftRight ? 13 : 9);
  wx = (wx / length) * speed * dt;
  wz = (wz / length) * speed * dt;
  if (player.fly) player.vy = ((keys.Space ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0)) * 9;
  else if (player.inWater) {
    player.vy = clamp(player.vy - 8 * dt, -2.5, 4);
    if (keys.Space) player.vy = 3.4;
  } else {
    player.vy = Math.max(-34, player.vy - 27 * dt);
    if (keys.Space && player.grounded) player.vy = 8.6;
  }
  let wy = player.vy * dt;
  // Move in small steps, one direction at a time, so you slide along walls instead of sticking to them
  const steps = Math.ceil(Math.max(Math.abs(wx), Math.abs(wy), Math.abs(wz)) / 0.3) || 1;
  player.grounded = false;
  for (let i = 0; i < steps; i++) {
    if (!blocked(player.x + wx / steps, player.y, player.z)) player.x += wx / steps;
    if (!blocked(player.x, player.y, player.z + wz / steps)) player.z += wz / steps;
    if (!blocked(player.x, player.y + wy / steps, player.z)) player.y += wy / steps;
    else {
      if (wy < 0) player.grounded = true;
      player.vy = 0;
      wy = 0;
    }
  }
  // Falling a long way hurts
  if (player.grounded || player.inWater || player.fly) {
    const fell = player.fallFrom - player.y;
    if (player.grounded && fell > 4.5) hurt(Math.floor(fell - 3.5), "Ouch! That was a long fall.");
    player.fallFrom = player.y;
  } else player.fallFrom = Math.max(player.fallFrom, player.y);
  if (BLOCKS[feet].hurts) hurt(2, "Hot! Get out of the lava!");
  camera.position.set(player.x, player.y + 1.6, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

// ----- What are you looking at? -----
function lookDirection() {
  const flat = Math.cos(player.pitch);
  return [-Math.sin(player.yaw) * flat, Math.sin(player.pitch), -Math.cos(player.yaw) * flat];
}
// Step along your line of sight, one block at a time, until it hits something
function lookAtBlock(reach) {
  const o = camera.position;
  const d = lookDirection();
  const at = [Math.floor(o.x), Math.floor(o.y), Math.floor(o.z)];
  const start = [o.x, o.y, o.z];
  const step = [], gap = [], next = [];
  for (let i = 0; i < 3; i++) {
    step[i] = d[i] > 0 ? 1 : -1;
    gap[i] = Math.abs(1 / (d[i] || 1e-9));
    next[i] = (d[i] > 0 ? at[i] + 1 - start[i] : start[i] - at[i]) * gap[i];
  }
  let side = -1;
  let far = 0;
  for (let n = 0; n < 40; n++) {
    const id = getBlock(at[0], at[1], at[2]);
    if (id !== AIR && !BLOCKS[id].liquid) {
      const normal = [0, 0, 0];
      if (side >= 0) normal[side] = -step[side];
      return { x: at[0], y: at[1], z: at[2], id: id, nx: normal[0], ny: normal[1], nz: normal[2], far: far };
    }
    side = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : next[1] < next[2] ? 1 : 2;
    far = next[side];
    if (far > reach) return null;
    at[side] += step[side];
    next[side] += gap[side];
  }
  return null;
}
function lookAtCreature(reach) {
  const o = camera.position;
  const d = lookDirection();
  let best = null;
  for (const creature of creatures) {
    const cx = creature.x - o.x, cy = creature.y + creature.def.tall / 2 - o.y, cz = creature.z - o.z;
    const along = cx * d[0] + cy * d[1] + cz * d[2];
    if (along < 0 || along > reach) continue;
    const off = Math.hypot(cx - d[0] * along, cy - d[1] * along, cz - d[2] * along);
    if (off < creature.def.tall * 0.6 + 0.25 && (!best || along < best.far)) best = { creature: creature, far: along };
  }
  return best;
}

// The outline round the block you are looking at, and the dark cover that grows as you dig
const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000 }));
const cracks = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
scene.add(outline, cracks);
let target = null;
let digging = null;
let placeTimer = 0;

// ----- Your things -----
function give(id, count) {
  state.inv[id] = (state.inv[id] || 0) + count;
  if (!state.slots.includes(id) && state.slots.includes(0)) state.slots[state.slots.indexOf(0)] = id;
  drawBelt();
}
function have(id) {
  return state.builder ? 999 : state.inv[id] || 0;
}

function drawBelt() {
  const belt = el("hotbar");
  belt.innerHTML = "";
  state.slots.forEach(function (id, i) {
    if (id && have(id) < 1) id = state.slots[i] = 0;       // all used up: the box is empty again
    const slot = document.createElement("div");
    slot.className = "slot" + (i === state.sel ? " picked" : "");
    if (id) slot.innerHTML = '<img src="' + icons[id] + '"><b>' + (state.builder ? "" : have(id)) + "</b>";
    belt.appendChild(slot);
  });
  const held = state.slots[state.sel];
  el("held").textContent = held ? BLOCKS[held].name : "";
}

function toggleBag() {
  bagOpen = !bagOpen;
  el("bag").hidden = !bagOpen;
  if (bagOpen) {
    playing = false;
    if (document.pointerLockElement) document.exitPointerLock();
    drawBag();
  } else grabMouse();
}

function drawBag() {
  const items = el("items");
  items.innerHTML = "";
  for (let id = 1; id < BLOCKS.length; id++) {
    if (id === DEEP || (!state.builder && !(state.inv[id] > 0))) continue;
    const button = document.createElement("button");
    button.className = "item";
    button.title = BLOCKS[id].name;
    button.innerHTML = '<img src="' + icons[id] + '"><b>' + (state.builder ? "" : state.inv[id]) + "</b>";
    button.addEventListener("click", function () {
      // Put it in the picked box on your belt (swapping if it was already in another box)
      const was = state.slots.indexOf(id);
      if (was >= 0) state.slots[was] = state.slots[state.sel];
      state.slots[state.sel] = id;
      drawBelt();
    });
    items.appendChild(button);
  }
  if (!items.children.length) items.textContent = "Nothing yet. Dig something up!";
  const list = el("recipes");
  list.innerHTML = "";
  for (const recipe of RECIPES) {
    const button = document.createElement("button");
    button.className = "recipe";
    const needs = recipe.needs.map(([id, n]) => n + ' <img src="' + icons[id] + '" title="' + BLOCKS[id].name + '">').join(" + ");
    const makes = recipe.tool ? recipe.name : recipe.makes[1] + ' <img src="' + icons[recipe.makes[0]] + '"> ' + BLOCKS[recipe.makes[0]].name;
    button.innerHTML = needs + " = " + makes;
    button.disabled = !recipe.needs.every(([id, n]) => have(id) >= n) || (recipe.tool && state.pick >= recipe.tool);
    button.addEventListener("click", function () {
      if (!state.builder) for (const [id, n] of recipe.needs) state.inv[id] -= n;
      if (recipe.tool) {
        state.pick = recipe.tool;
        toast("You made a " + recipe.name.split(" (")[0] + "!");
      } else give(recipe.makes[0], recipe.makes[1]);
      sfx.make();
      drawBelt();
      drawBag();
    });
    list.appendChild(button);
  }
}

// ----- Little bits that fly about (dust from digging, hearts, sparks) -----
const bits = [];
const bitShape = new THREE.BoxGeometry(0.12, 0.12, 0.12);
function puff(x, y, z, colour, count, power) {
  for (let i = 0; i < count; i++) {
    let bit = bits.find((b) => b.life <= 0);
    if (!bit) {
      if (bits.length > 160) return;
      bit = { mesh: new THREE.Mesh(bitShape, new THREE.MeshBasicMaterial()), life: 0 };
      scene.add(bit.mesh);
      bits.push(bit);
    }
    bit.mesh.material.color.copy(colour);
    bit.mesh.position.set(x + Math.random() - 0.5, y + Math.random() - 0.5, z + Math.random() - 0.5);
    bit.mesh.visible = true;
    bit.v = [(Math.random() - 0.5) * power, Math.random() * power, (Math.random() - 0.5) * power];
    bit.life = 0.4 + Math.random() * 0.5;
  }
}
function updateBits(dt) {
  for (const bit of bits) {
    if (bit.life <= 0) continue;
    bit.life -= dt;
    bit.v[1] -= 14 * dt;
    bit.mesh.position.x += bit.v[0] * dt;
    bit.mesh.position.y += bit.v[1] * dt;
    bit.mesh.position.z += bit.v[2] * dt;
    if (bit.life <= 0) bit.mesh.visible = false;
  }
}
const RED = new THREE.Color(0xff4a5a);
const SPARK = new THREE.Color(0xffe14a);
const SMOKE = new THREE.Color(0x3a3a46);

// ----- Digging and building -----
function breakBlock(x, y, z) {
  const id = getBlock(x, y, z);
  if (id === AIR || BLOCKS[id].liquid || BLOCKS[id].hard === undefined) return;
  setBlock(x, y, z, AIR);
  puff(x + 0.5, y + 0.5, z + 0.5, colours[id], 10, 4);
  sfx.crack();
  if (!state.builder) {
    // What do you get for it?
    if (id === GRASS || id === SNOW) give(DIRT, 1);
    else if (id === BERRY_BUSH) give(BERRIES, 2);
    else {
      give(id, 1);
      if (BLOCKS[id].leaf && Math.random() < 0.12) give(SAPLING, 1);
      if (BLOCKS[id].leaf && Math.random() < 0.12) give(BERRIES, 1);
    }
  }
  // A plant standing on this block falls off
  if (BLOCKS[getBlock(x, y + 1, z)].plant) breakBlock(x, y + 1, z);
}

function dig(dt) {
  if (!mouse.left || !target || BLOCKS[target.id].hard === undefined || heldWeapon()) {
    digging = null;
    return;
  }
  if (swing <= 0) swing = 1;              // (your hand keeps chopping while you dig)
  const name = target.x + "," + target.y + "," + target.z;
  if (!digging || digging.name !== name) digging = { name: name, time: 0 };
  // A better pick digs faster (most of all through rock)
  const speed = state.builder ? 30 : 1 + state.pick * (BLOCKS[target.id].rock ? 1.1 : 0.3);
  digging.time += dt * speed;
  if (Math.random() < dt * 12) sfx.dig();
  if (digging.time >= BLOCKS[target.id].hard) {
    breakBlock(target.x, target.y, target.z);
    digging = null;
    if (state.builder) mouse.left = false;     // Creative mode: one click, one block
  }
}

function useOrPlace() {
  const seen = lookAtCreature(4.5);
  if (seen && (!target || seen.far < target.far)) return pet(seen.creature);
  const held = state.slots[state.sel];
  if (target && BLOCKS[target.id].use === "sleep") return sleep();
  if (target && BLOCKS[target.id].use === "pop") return fuses.push({ x: target.x, y: target.y, z: target.z, time: 1.6 });
  if (held && BLOCKS[held].food) {
    if (have(held) < 1) return;
    if (state.hp >= 10) return toast("You aren't hungry.");
    if (!state.builder) state.inv[held]--;
    state.hp = Math.min(10, state.hp + BLOCKS[held].food);
    sfx.pick();
    return drawBelt();
  }
  if (!target || !held || have(held) < 1 || BLOCKS[held].item) return;      // (weapons and other things you hold can't be built with)
  // Build on the side of the block you are looking at (or right on top of a plant)
  const onPlant = BLOCKS[target.id].plant;
  const x = target.x + (onPlant ? 0 : target.nx);
  const y = target.y + (onPlant ? 0 : target.ny);
  const z = target.z + (onPlant ? 0 : target.nz);
  const there = getBlock(x, y, z);
  if (there !== AIR && !BLOCKS[there].liquid && !BLOCKS[there].plant) return;
  if (BLOCKS[held].plant && !isSolid(getBlock(x, y - 1, z))) return toast("Plants need something to stand on.");
  if (isSolid(held) && x === Math.floor(player.x) && z === Math.floor(player.z) && (y === Math.floor(player.y) || y === Math.floor(player.y + 1))) return;   // not inside yourself!
  if (isSolid(held) && Math.abs(x + 0.5 - player.x) < 0.8 && Math.abs(z + 0.5 - player.z) < 0.8 && y + 1 > player.y && y < player.y + 1.75) return;
  if (!setBlock(x, y, z, held)) return;
  if (!state.builder) state.inv[held]--;
  if (held === SAPLING) state.grow.push([x, y, z, state.clock + 40]);
  sfx.put();
  swing = 1;
  drawBelt();
}

// A sapling grows into a tree
function growTree(x, y, z) {
  const tall = 4 + Math.floor(Math.random() * 2);
  for (let dy = -1; dy <= 2; dy++) {
    const reach = dy < 1 ? 2 : 1;
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (Math.abs(dx) === reach && Math.abs(dz) === reach && Math.random() < 0.5) continue;
        if (getBlock(x + dx, y + tall + dy, z + dz) === AIR) setBlock(x + dx, y + tall + dy, z + dz, LEAVES);
      }
    }
  }
  for (let i = 0; i <= tall; i++) setBlock(x, y + i, z, LOG);
  puff(x + 0.5, y + 2, z + 0.5, colours[LEAVES], 20, 5);
}

// Poppers go bang
const fuses = [];
function explode(x, y, z) {
  setBlock(x, y, z, AIR);
  for (let dy = -3; dy <= 3; dy++) {
    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy + dz * dz > 10.5) continue;
        const id = getBlock(x + dx, y + dy, z + dz);
        if (id === POPPER) fuses.push({ x: x + dx, y: y + dy, z: z + dz, time: 0.25 });      // one sets off the next
        else if (id !== AIR && BLOCKS[id].hard !== undefined) setBlock(x + dx, y + dy, z + dz, AIR);
      }
    }
  }
  puff(x + 0.5, y + 0.5, z + 0.5, SPARK, 30, 12);
  puff(x + 0.5, y + 0.5, z + 0.5, SMOKE, 30, 8);
  sfx.boom();
  shake = 0.5;
  if (Math.hypot(player.x - x, player.y - y, player.z - z) < 5) hurt(3, "Too close to the Popper!");
}

function sleep() {
  state.spawn = [player.x, player.y, player.z];
  if (sunHeight > -0.05) return toast("You can only sleep at night. But you will wake up here from now on.", 4);
  state.time = 0.02;
  state.day++;
  state.hp = 10;
  for (const creature of creatures.filter((c) => c.def.hostile)) removeCreature(creature);
  toast("Good morning! Day " + state.day + ".", 4);
}

let hurtTimer = 0;
let shake = 0;
function hurt(amount, why) {
  if (state.builder || hurtTimer > 0) return;
  state.hp -= amount;
  hurtTimer = 0.8;
  sfx.hurt();
  el("hurt").style.opacity = 1;
  setTimeout(() => (el("hurt").style.opacity = 0), 200);
  if (why) toast(why);
  if (state.hp > 0) return;
  // No hearts left: you wake up back at your spot (and keep all your things)
  state.hp = 10;
  Object.assign(player, { x: state.spawn[0], y: state.spawn[1], z: state.spawn[2], vy: 0, fallFrom: state.spawn[1] });
  toast("You fainted, and woke up back at your wake-up spot.", 5);
}

// ----- Animals and night creatures, all built out of boxes -----
// parts: [width, height, depth, x, y, z, colour, is it a leg?]   (they face along +z)
const CREATURES = {
  rabbit: { tall: 0.7, speed: 2.4, hop: 4.6, shy: true, lands: ["plains", "forest"], parts: [
    [0.34, 0.3, 0.5, 0, 0.25, 0, 0xb09a84], [0.28, 0.26, 0.26, 0, 0.45, 0.3, 0xb09a84], [0.07, 0.3, 0.07, -0.08, 0.72, 0.28, 0xc8b29a], [0.07, 0.3, 0.07, 0.08, 0.72, 0.28, 0xc8b29a],
    [0.13, 0.13, 0.13, 0, 0.3, -0.3, 0xffffff], [0.05, 0.05, 0.03, -0.09, 0.48, 0.44, 0x1d1730], [0.05, 0.05, 0.03, 0.09, 0.48, 0.44, 0x1d1730]] },
  deer: { tall: 1.9, speed: 2.6, shy: true, lands: ["forest"], parts: [
    [0.5, 0.5, 1, 0, 0.9, 0, 0xb07a4a], [0.42, 0.2, 0.9, 0, 0.7, 0, 0xe8cfa8], [0.24, 0.5, 0.24, 0, 1.3, 0.45, 0xb07a4a], [0.3, 0.3, 0.45, 0, 1.6, 0.62, 0xb07a4a],
    [0.06, 0.4, 0.06, -0.12, 1.95, 0.5, 0xf2e6c8], [0.06, 0.4, 0.06, 0.12, 1.95, 0.5, 0xf2e6c8], [0.5, 0.06, 0.06, 0, 2.05, 0.5, 0xf2e6c8], [0.12, 0.14, 0.1, 0, 1, -0.55, 0xffffff],
    [0.05, 0.05, 0.03, -0.1, 1.66, 0.85, 0x1d1730], [0.05, 0.05, 0.03, 0.1, 1.66, 0.85, 0x1d1730],
    [0.14, 0.66, 0.14, -0.18, 0.33, 0.38, 0x7a5230, 1], [0.14, 0.66, 0.14, 0.18, 0.33, 0.38, 0x7a5230, 1], [0.14, 0.66, 0.14, -0.18, 0.33, -0.38, 0x7a5230, 1], [0.14, 0.66, 0.14, 0.18, 0.33, -0.38, 0x7a5230, 1]] },
  fox: { tall: 0.9, speed: 2.8, lands: ["forest", "snow", "plains"], parts: [
    [0.34, 0.34, 0.8, 0, 0.46, 0, 0xe07a2a], [0.36, 0.32, 0.32, 0, 0.6, 0.5, 0xe07a2a], [0.16, 0.14, 0.2, 0, 0.53, 0.72, 0xffffff], [0.1, 0.16, 0.06, -0.12, 0.84, 0.5, 0x3a2a20], [0.1, 0.16, 0.06, 0.12, 0.84, 0.5, 0x3a2a20],
    [0.2, 0.2, 0.5, 0, 0.5, -0.62, 0xe07a2a], [0.2, 0.2, 0.16, 0, 0.5, -0.92, 0xffffff], [0.05, 0.05, 0.03, -0.1, 0.64, 0.67, 0x1d1730], [0.05, 0.05, 0.03, 0.1, 0.64, 0.67, 0x1d1730],
    [0.1, 0.3, 0.1, -0.12, 0.15, 0.3, 0x3a2a20, 1], [0.1, 0.3, 0.1, 0.12, 0.15, 0.3, 0x3a2a20, 1], [0.1, 0.3, 0.1, -0.12, 0.15, -0.3, 0x3a2a20, 1], [0.1, 0.3, 0.1, 0.12, 0.15, -0.3, 0x3a2a20, 1]] },
  penguin: { tall: 1.1, speed: 1.4, waddle: true, lands: ["snow"], parts: [
    [0.45, 0.7, 0.4, 0, 0.45, 0, 0x2a2a3a], [0.32, 0.5, 0.06, 0, 0.42, 0.21, 0xffffff], [0.36, 0.3, 0.34, 0, 0.95, 0, 0x2a2a3a], [0.12, 0.08, 0.16, 0, 0.92, 0.22, 0xf08a3a],
    [0.08, 0.45, 0.25, -0.27, 0.5, 0, 0x2a2a3a], [0.08, 0.45, 0.25, 0.27, 0.5, 0, 0x2a2a3a], [0.05, 0.05, 0.03, -0.1, 1, 0.175, 0xffffff], [0.05, 0.05, 0.03, 0.1, 1, 0.175, 0xffffff],
    [0.14, 0.08, 0.24, -0.12, 0.04, 0.06, 0xf08a3a, 1], [0.14, 0.08, 0.24, 0.12, 0.04, 0.06, 0xf08a3a, 1]] },
  duck: { tall: 0.7, speed: 1.6, swims: true, lands: ["water"], parts: [
    [0.34, 0.28, 0.5, 0, 0.3, 0, 0xf6f0d8], [0.22, 0.22, 0.22, 0, 0.56, 0.22, 0x3a8a4a], [0.14, 0.06, 0.14, 0, 0.53, 0.38, 0xf0a83a], [0.06, 0.2, 0.34, -0.2, 0.32, 0, 0xe0d8b8], [0.06, 0.2, 0.34, 0.2, 0.32, 0, 0xe0d8b8],
    [0.04, 0.04, 0.03, -0.08, 0.6, 0.335, 0x1d1730], [0.04, 0.04, 0.03, 0.08, 0.6, 0.335, 0x1d1730], [0.08, 0.16, 0.08, -0.08, 0.08, 0, 0xf0a83a, 1], [0.08, 0.16, 0.08, 0.08, 0.08, 0, 0xf0a83a, 1]] },
  lizard: { tall: 0.3, speed: 3.4, shy: true, lands: ["desert"], parts: [
    [0.24, 0.14, 0.7, 0, 0.13, 0, 0x6aa84a], [0.22, 0.14, 0.26, 0, 0.15, 0.46, 0x7aba56], [0.14, 0.1, 0.5, 0, 0.11, -0.56, 0x5a9840], [0.04, 0.04, 0.03, -0.07, 0.2, 0.6, 0x1d1730], [0.04, 0.04, 0.03, 0.07, 0.2, 0.6, 0x1d1730],
    [0.22, 0.06, 0.08, -0.2, 0.05, 0.24, 0x5a9840, 1], [0.22, 0.06, 0.08, 0.2, 0.05, 0.24, 0x5a9840, 1], [0.22, 0.06, 0.08, -0.2, 0.05, -0.24, 0x5a9840, 1], [0.22, 0.06, 0.08, 0.2, 0.05, -0.24, 0x5a9840, 1]] },
  wobbler: { tall: 0.9, speed: 1.8, hop: 6.2, lands: ["plains", "forest", "desert", "snow"], parts: [
    [0.6, 0.5, 0.6, 0, 0.35, 0, 0xf29ad8], [0.16, 0.16, 0.04, -0.14, 0.42, 0.31, 0xffffff], [0.16, 0.16, 0.04, 0.14, 0.42, 0.31, 0xffffff], [0.07, 0.08, 0.03, -0.14, 0.4, 0.34, 0x1d1730], [0.07, 0.08, 0.03, 0.14, 0.4, 0.34, 0x1d1730],
    [0.05, 0.3, 0.05, -0.15, 0.75, 0.1, 0xc87ab0], [0.05, 0.3, 0.05, 0.15, 0.75, 0.1, 0xc87ab0], [0.12, 0.12, 0.12, -0.15, 0.94, 0.1, 0xffe14a], [0.12, 0.12, 0.12, 0.15, 0.94, 0.1, 0xffe14a],
    [0.18, 0.1, 0.26, -0.16, 0.05, 0.04, 0xc87ab0, 1], [0.18, 0.1, 0.26, 0.16, 0.05, 0.04, 0xc87ab0, 1]] },
  fish: { tall: 0.3, speed: 1.6, fish: true, lands: ["water"], parts: [
    [0.14, 0.22, 0.42, 0, 0.15, 0, 0xf08a3a], [0.04, 0.2, 0.18, 0, 0.15, -0.3, 0xffffff], [0.15, 0.06, 0.1, 0, 0.2, 0.1, 0xffffff], [0.03, 0.04, 0.04, -0.075, 0.18, 0.15, 0x1d1730], [0.03, 0.04, 0.04, 0.075, 0.18, 0.15, 0x1d1730]] },
  // Monsters. hostile: it comes after you. when: "night" (it vanishes at sunrise) or "cave" (it lives underground).
  // hp: how much harm it can take. hit: how many hearts it takes from you. fears: it stays this far from lanterns.
  // hover: it floats this high. spits: it keeps its distance and spits. chill: its touch slows you down. drops: [what, how likely, how many at most].
  gloom: { name: "Gloom", tall: 0.9, speed: 2.3, hostile: true, hover: 1.3, hp: 3, hit: 1, when: "night", fears: 7, says: "A Gloom got you! Hit it, or get near a lantern.", drops: [[COAL, 0.3, 1]], lands: [], parts: [
    [0.8, 0.8, 0.8, 0, 0.45, 0, 0x241a3c], [0.6, 0.2, 0.6, 0, 0.95, 0, 0x33265a], [0.16, 0.1, 0.04, -0.18, 0.5, 0.41, 0xd8ff5a, 0, 1], [0.16, 0.1, 0.04, 0.18, 0.5, 0.41, 0xd8ff5a, 0, 1]] },
  prowler: { name: "Prowler", tall: 0.95, speed: 3.3, hostile: true, hp: 6, hit: 2, when: "night", fears: 4.5, says: "A Prowler bit you! Fight back, or stand by a lantern.", drops: [[ARROW, 0.5, 3]], lands: ["plains", "forest"], parts: [
    [0.42, 0.42, 1, 0, 0.62, 0, 0x2a3044], [0.4, 0.38, 0.42, 0, 0.78, 0.62, 0x353c54], [0.2, 0.16, 0.22, 0, 0.7, 0.9, 0x1c2030], [0.1, 0.18, 0.08, -0.13, 1.04, 0.6, 0x1c2030], [0.1, 0.18, 0.08, 0.13, 1.04, 0.6, 0x1c2030],
    [0.08, 0.06, 0.03, -0.1, 0.84, 0.835, 0xff3a3a, 0, 1], [0.08, 0.06, 0.03, 0.1, 0.84, 0.835, 0xff3a3a, 0, 1], [0.14, 0.14, 0.5, 0, 0.74, -0.7, 0x1c2030],
    [0.14, 0.44, 0.14, -0.14, 0.22, 0.36, 0x1c2030, 1], [0.14, 0.44, 0.14, 0.14, 0.22, 0.36, 0x1c2030, 1], [0.14, 0.44, 0.14, -0.14, 0.22, -0.36, 0x1c2030, 1], [0.14, 0.44, 0.14, 0.14, 0.22, -0.36, 0x1c2030, 1]] },
  spitter: { name: "Spitter", tall: 1.2, speed: 1.7, hostile: true, hp: 4, hit: 1, when: "night", spits: true, fears: 4, says: "A Spitter hit you! Dodge its spit, or shoot it with a bow.", drops: [[BERRIES, 0.5, 3]], lands: ["desert", "plains"], parts: [
    [0.62, 0.6, 0.62, 0, 0.55, 0, 0x5aa83a], [0.5, 0.3, 0.06, 0, 0.45, 0.32, 0xc8e88a], [0.34, 0.3, 0.4, 0, 0.95, 0.3, 0x6ab848], [0.2, 0.14, 0.04, 0, 0.9, 0.51, 0x2a1a2a],
    [0.09, 0.09, 0.03, -0.11, 1.05, 0.505, 0xfff04a, 0, 1], [0.09, 0.09, 0.03, 0.11, 1.05, 0.505, 0xfff04a, 0, 1], [0.06, 0.4, 0.5, 0, 1.05, -0.2, 0xe8642a],
    [0.18, 0.26, 0.22, -0.2, 0.13, 0, 0x3f8a2a, 1], [0.18, 0.26, 0.22, 0.2, 0.13, 0, 0x3f8a2a, 1]] },
  frostling: { name: "Frostling", tall: 0.7, speed: 2.6, hop: 5.5, hostile: true, hp: 3, hit: 1, when: "night", chill: true, fears: 5, says: "A Frostling froze your toes! You are slowed down for a moment.", drops: [[SNOW_BLOCK, 0.6, 3]], lands: ["snow"], parts: [
    [0.5, 0.5, 0.5, 0, 0.35, 0, 0x9ad8f5], [0.12, 0.3, 0.12, 0, 0.74, 0, 0xffffff], [0.3, 0.1, 0.1, -0.36, 0.4, 0, 0xffffff], [0.3, 0.1, 0.1, 0.36, 0.4, 0, 0xffffff],
    [0.09, 0.09, 0.03, -0.12, 0.42, 0.255, 0x2a4ad8, 0, 1], [0.09, 0.09, 0.03, 0.12, 0.42, 0.255, 0x2a4ad8, 0, 1]] },
  crawler: { name: "Crawler", tall: 0.55, speed: 3.5, hostile: true, hp: 5, hit: 1, when: "cave", fears: 6, says: "A Crawler nipped you! They live in the dark: light your tunnels with torches.", drops: [[COAL, 0.5, 2]], lands: [], parts: [
    [0.7, 0.26, 0.8, 0, 0.32, 0, 0x4a3a5a], [0.5, 0.14, 0.56, 0, 0.5, -0.06, 0x5c4a70], [0.4, 0.22, 0.3, 0, 0.32, 0.5, 0x3a2c48],
    [0.07, 0.07, 0.03, -0.1, 0.38, 0.655, 0xff5ae0, 0, 1], [0.07, 0.07, 0.03, 0.1, 0.38, 0.655, 0xff5ae0, 0, 1],
    [0.42, 0.07, 0.07, -0.5, 0.2, 0.26, 0x2a2036, 1], [0.42, 0.07, 0.07, 0.5, 0.2, 0.26, 0x2a2036, 1], [0.42, 0.07, 0.07, -0.5, 0.2, 0, 0x2a2036, 1], [0.42, 0.07, 0.07, 0.5, 0.2, 0, 0x2a2036, 1],
    [0.42, 0.07, 0.07, -0.5, 0.2, -0.26, 0x2a2036, 1], [0.42, 0.07, 0.07, 0.5, 0.2, -0.26, 0x2a2036, 1]] },
  stonejaw: { name: "Stonejaw", tall: 2, speed: 1.3, hostile: true, hp: 14, hit: 3, when: "cave", says: "A Stonejaw thumped you! It is slow: keep your distance.", drops: [[IRON, 0.7, 2], [GOLD, 0.3, 1]], lands: [], parts: [
    [0.3, 0.6, 0.3, -0.24, 0.3, 0, 0x6a6e7a, 1], [0.3, 0.6, 0.3, 0.24, 0.3, 0, 0x6a6e7a, 1], [0.95, 0.9, 0.6, 0, 1.05, 0, 0x868b99], [0.6, 0.1, 0.5, 0.1, 1.55, 0, 0x4a8a3a],
    [0.6, 0.5, 0.5, 0, 1.75, 0.1, 0x7a7f8c], [0.5, 0.14, 0.2, 0, 1.5, 0.4, 0x5c6070], [0.12, 0.08, 0.03, -0.15, 1.82, 0.355, 0xffa82a, 0, 1], [0.12, 0.08, 0.03, 0.15, 1.82, 0.355, 0xffa82a, 0, 1],
    [0.26, 0.9, 0.26, -0.62, 1.05, 0, 0x7a7f8c, 1], [0.26, 0.9, 0.26, 0.62, 1.05, 0, 0x7a7f8c, 1]] },
  gloomking: { name: "Gloom King", tall: 2.6, speed: 2, hostile: true, hover: 1.2, hp: 30, hit: 3, when: "night", king: true, says: "The Gloom King struck you! It is not afraid of lanterns.", drops: [[GEM, 1, 2], [GOLD, 1, 3]], lands: [], parts: [
    [1.9, 1.9, 1.9, 0, 1.1, 0, 0x241a3c], [1.4, 0.5, 1.4, 0, 2.3, 0, 0x33265a], [0.4, 0.24, 0.06, -0.42, 1.2, 0.96, 0xff5a3a, 0, 1], [0.4, 0.24, 0.06, 0.42, 1.2, 0.96, 0xff5a3a, 0, 1],
    [1.1, 0.2, 1.1, 0, 2.65, 0, 0xf0c83a, 0, 1], [0.2, 0.3, 0.2, -0.4, 2.9, -0.4, 0xffe14a, 0, 1], [0.2, 0.3, 0.2, 0.4, 2.9, -0.4, 0xffe14a, 0, 1], [0.2, 0.3, 0.2, -0.4, 2.9, 0.4, 0xffe14a, 0, 1], [0.2, 0.3, 0.2, 0.4, 2.9, 0.4, 0xffe14a, 0, 1]] },
};
const WOBBLER_COLOURS = [0xf29ad8, 0x8ad8f2, 0xa8e86a, 0xffc86a, 0xc8a0ff];
const creatures = [];
const paints = new Map();
function paint(colour, bright) {
  const name = colour + (bright ? "b" : "");
  if (!paints.has(name)) paints.set(name, bright ? new THREE.MeshBasicMaterial({ color: colour }) : new THREE.MeshLambertMaterial({ color: colour }));
  return paints.get(name);
}

const shadowShape = new THREE.CircleGeometry(1, 16);
const shadowPaint = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
function addCreature(kind, x, y, z) {
  const def = CREATURES[kind];
  const group = new THREE.Group();
  const legs = [];
  const tint = kind === "wobbler" ? WOBBLER_COLOURS[Math.floor(Math.random() * WOBBLER_COLOURS.length)] : kind === "fish" ? [0xf08a3a, 0x5ab8f0, 0xffe14a][Math.floor(Math.random() * 3)] : null;
  def.parts.forEach(function ([w, h, d, px, py, pz, colour, leg, bright], i) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint(tint && i === 0 ? tint : colour, bright));
    if (leg) {
      // A leg hangs from a hinge at its top, so it can swing
      const hinge = new THREE.Group();
      hinge.position.set(px, py + h / 2, pz);
      mesh.position.y = -h / 2;
      hinge.add(mesh);
      group.add(hinge);
      legs.push(hinge);
    } else {
      mesh.position.set(px, py, pz);
      group.add(mesh);
    }
  });
  scene.add(group);
  // A soft round shadow on the ground under it
  const shadow = new THREE.Mesh(shadowShape, shadowPaint);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.setScalar(Math.max(0.35, def.tall * 0.42));
  shadow.visible = !def.fish && !def.swims;
  scene.add(shadow);
  const creature = { kind: kind, def: def, group: group, legs: legs, shadow: shadow, x: x, y: y, z: z, vy: 0, dir: Math.random() * 6.28, walking: false, timer: 0, step: 0, happy: 0, hp: def.hp || 3, grounded: false, cool: 0, flash: 0, spiked: 0 };
  creatures.push(creature);
  return creature;
}
function removeCreature(creature) {
  scene.remove(creature.group);
  scene.remove(creature.shadow);
  creatures.splice(creatures.indexOf(creature), 1);
}

function pet(creature) {
  if (creature.def.hostile) return;
  creature.happy = 1.2;
  creature.walking = false;
  creature.timer = 2;
  puff(creature.x, creature.y + creature.def.tall + 0.3, creature.z, RED, 6, 2.5);
  sfx.happy();
  toast("The " + creature.kind + " likes you!", 1.5);
}

// ----- Fighting -----
let attackWait = 0;        // seconds until you can strike again
let swing = 0;             // your arm swinging: 1 at the start of a swing, falling to 0
let walkPhase = 0;         // (counts up as you walk, to make your hand bob)
let chillTimer = 0;        // seconds of being slowed down by a Frostling
let kingDay = 0;           // the last day the Gloom King came
// The weapon in your hand (or nothing, if you are holding a block or your hands are empty)
function heldWeapon() {
  const held = state.slots[state.sel];
  return held && have(held) > 0 ? BLOCKS[held].weapon || null : null;
}
// Hurt a monster. It is knocked back, and when its health runs out it bursts, and may drop something.
function harm(creature, amount, pushX, pushZ) {
  creature.hp -= amount;
  creature.flash = 0.2;
  const nx = creature.x + pushX, nz = creature.z + pushZ;
  if (!isSolid(getBlock(Math.floor(nx), Math.floor(creature.y + 0.3), Math.floor(nz)))) {
    creature.x = nx;
    creature.z = nz;
  }
  puff(creature.x, creature.y + creature.def.tall * 0.5, creature.z, SMOKE, 8, 4);
  sfx.crack();
  if (creature.hp > 0) return false;
  puff(creature.x, creature.y + creature.def.tall * 0.5, creature.z, SPARK, 16, 5);
  if (!state.builder) {
    for (const [id, chance, most] of creature.def.drops || []) {
      if (Math.random() >= chance) continue;
      const count = 1 + Math.floor(Math.random() * most);
      give(id, count);
      toast("The " + creature.def.name + " dropped " + count + " x " + BLOCKS[id].name + "!", 4);
    }
  }
  removeCreature(creature);
  return true;
}
// A hammer blow shakes the ground and hits every monster close to where it lands
function smash(x, y, z, weapon) {
  puff(x, y + 0.2, z, SMOKE, 18, 6);
  shake = 0.25;
  sfx.boom();
  for (const creature of creatures.slice()) {
    if (!creature.def.hostile || Math.hypot(creature.x - x, creature.z - z) > weapon.smash || Math.abs(creature.y - y) > 2.6) continue;
    const away = Math.atan2(creature.x - player.x, creature.z - player.z);
    harm(creature, weapon.hit, Math.sin(away) * 2.6, Math.cos(away) * 2.6);
  }
}
// Left click: strike with whatever you are holding (or shoot, if it is a bow). Animals are only startled.
function attack() {
  const weapon = heldWeapon();
  const seen = lookAtCreature(4.8);
  const blockFirst = Boolean(target && seen && target.far < seen.far);
  if (weapon) mouse.left = false;                       // (a weapon doesn't dig)
  if (attackWait > 0) return;
  if (weapon && weapon.bow) {
    if (have(ARROW) < 1) return toast("No arrows! Make some from planks and gravel.", 3);
    if (!state.builder) state.inv[ARROW]--;
    const way = lookDirection(), eye = camera.position;
    shoot(eye.x + way[0] * 0.6, eye.y - 0.15 + way[1] * 0.6, eye.z + way[2] * 0.6, way[0] * 30, way[1] * 30 + 1.5, way[2] * 30, true, weapon.hit);
    attackWait = weapon.wait;
    swing = 1;
    sfx.put();
    return drawBelt();
  }
  if (weapon) {
    swing = 1;
    attackWait = weapon.wait;
  }
  if (!seen || blockFirst) {
    if (weapon && weapon.smash && target) smash(target.x + 0.5, target.y + 1, target.z + 0.5, weapon);
    return;
  }
  const creature = seen.creature;
  mouse.left = false;
  if (!creature.def.hostile) {
    creature.dir = Math.atan2(creature.x - player.x, creature.z - player.z);
    creature.walking = true;
    creature.timer = 2;
    return;
  }
  swing = 1;
  if (!weapon) attackWait = 0.3;
  if (weapon && weapon.smash) return smash(creature.x, creature.y, creature.z, weapon);
  harm(creature, weapon ? weapon.hit : 1 + state.pick, -Math.sin(player.yaw) * 1.5, -Math.cos(player.yaw) * 1.5);
}

// ----- Things that fly: your arrows, and what Spitters spit -----
const shots = [];
const arrowShape = new THREE.BoxGeometry(0.07, 0.07, 0.7), spitShape = new THREE.BoxGeometry(0.28, 0.28, 0.28);
const SLIME = new THREE.Color(0x9ae84a);
function shoot(x, y, z, vx, vy, vz, mine, hit) {
  const mesh = new THREE.Mesh(mine ? arrowShape : spitShape, paint(mine ? 0xc89a5c : 0x9ae84a, !mine));
  scene.add(mesh);
  shots.push({ x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, mine: mine, hit: hit, life: 3, mesh: mesh });
}
function spit(creature) {
  const x = creature.x, y = creature.y + creature.def.tall * 0.8, z = creature.z;
  const dx = player.x - x, dy = player.y + 1 - y, dz = player.z - z, far = Math.hypot(dx, dy, dz) || 1;
  shoot(x, y, z, (dx / far) * 11, (dy / far) * 11 + far * 0.14, (dz / far) * 11, false, creature.def.hit);
  sfx.put();
}
function updateShots(dt) {
  for (const shot of shots.slice()) {
    shot.life -= dt;
    shot.vy -= (shot.mine ? 9 : 3) * dt;              // (they curve down as they fly)
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.z += shot.vz * dt;
    let done = shot.life <= 0 || isSolid(getBlock(Math.floor(shot.x), Math.floor(shot.y), Math.floor(shot.z)));
    if (!done && shot.mine) {
      for (const creature of creatures) {
        if (!creature.def.hostile || Math.hypot(creature.x - shot.x, creature.y + creature.def.tall / 2 - shot.y, creature.z - shot.z) > creature.def.tall * 0.5 + 0.35) continue;
        harm(creature, shot.hit, shot.vx * 0.04, shot.vz * 0.04);
        done = true;
        break;
      }
    } else if (!done && Math.hypot(player.x - shot.x, player.y + 0.9 - shot.y, player.z - shot.z) < 0.7) {
      hurt(shot.hit, "A Spitter hit you! Dodge its spit, or shoot it with a bow.");
      done = true;
    }
    if (done) {
      puff(shot.x, shot.y, shot.z, shot.mine ? SMOKE : SLIME, 4, 2);
      scene.remove(shot.mesh);
      shots.splice(shots.indexOf(shot), 1);
      continue;
    }
    shot.mesh.position.set(shot.x, shot.y, shot.z);
    shot.mesh.lookAt(shot.x + shot.vx, shot.y + shot.vy, shot.z + shot.vz);
  }
}

// ----- Your hand, and what it holds -----
const hand = new THREE.Group();
const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.46), new THREE.MeshLambertMaterial({ color: 0xe8b890 }));
armMesh.position.set(0.03, -0.05, 0.16);
const heldThing = new THREE.Group();
hand.add(armMesh, heldThing);
handScene.add(hand);
const heldPictures = new Map();
let heldShown = -1;
function showHeld(id) {
  heldShown = id;
  while (heldThing.children.length) heldThing.remove(heldThing.children[0]);
  if (!id) return;
  if (!heldPictures.has(id)) {
    const picture = new THREE.CanvasTexture(iconCanvases[id]);
    picture.magFilter = picture.minFilter = THREE.NearestFilter;
    heldPictures.set(id, picture);
  }
  const kind = BLOCKS[id], picture = heldPictures.get(id);
  if (kind.item || kind.plant) {
    // Flat things (weapons, berries, flowers, torches) are held up like a card
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshLambertMaterial({ map: picture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    flat.position.set(-0.03, 0.11, -0.1);
    flat.rotation.set(0, -0.45, kind.weapon ? 0.15 : 0);
    if (kind.weapon) flat.scale.x = -1;               // (so the blade points in towards the middle of the screen)
    heldThing.add(flat);
  } else {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.17), new THREE.MeshLambertMaterial({ map: picture }));
    cube.position.set(0, 0.07, -0.12);
    cube.rotation.y = 0.5;
    heldThing.add(cube);
  }
}
function updateHand(dt) {
  const held = state.slots[state.sel], shown = held && have(held) > 0 ? held : 0;
  if (shown !== heldShown) showHeld(shown);
  if (swing > 0) swing = Math.max(0, swing - dt * 4.5);
  const bob = Math.sin(walkPhase) * 0.012, blow = Math.sin(swing * Math.PI);
  hand.position.set(0.34 + Math.cos(walkPhase * 0.5) * 0.008, -0.3 + bob - blow * 0.06, -0.52 - blow * 0.14);
  hand.rotation.set(0.1 - blow * 0.9, -0.12 - blow * 0.25, 0);
}

function nearLantern(x, y, z, reach) {
  const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const lamp of world.lamps.get(cx + dx + "," + (cz + dz)) || []) if (Math.hypot(lamp[0] - x, lamp[1] - y, lamp[2] - z) < reach) return true;
    }
  }
  return false;
}

let spawnTimer = 1;
function updateCreatures(dt) {
  // New creatures appear a little way off; far-away ones go
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = 1.2;
    const angle = Math.random() * 6.28;
    const far = 14 + Math.random() * 28;
    const x = Math.floor(player.x + Math.cos(angle) * far);
    const z = Math.floor(player.z + Math.sin(angle) * far);
    const land = landAt(x, z);
    const kind = land.h < SEA ? "water" : land.kind;
    const night = sunHeight < -0.12;
    const hostiles = creatures.filter((c) => c.def.hostile).length;
    const animals = creatures.length - hostiles;
    const under = player.y < landAt(Math.floor(player.x), Math.floor(player.z)).h - 5;        // are you down in a cave or a mine?
    let made = false;
    if (!state.builder && hostiles < 6) {
      if (under && Math.random() < 0.5) {
        // Cave monsters: look for a dark spot nearby with room to stand
        for (let tries = 0; tries < 14 && !made; tries++) {
          const sx = Math.floor(player.x + (Math.random() - 0.5) * 30), sy = Math.floor(player.y + (Math.random() - 0.5) * 8), sz = Math.floor(player.z + (Math.random() - 0.5) * 30);
          if (Math.hypot(sx - player.x, sz - player.z) < 7 || sy < 2 || sy >= landAt(sx, sz).h - 3) continue;
          if (getBlock(sx, sy, sz) !== AIR || getBlock(sx, sy + 1, sz) !== AIR || !isSolid(getBlock(sx, sy - 1, sz)) || nearLantern(sx, sy, sz, 9)) continue;
          addCreature(sy < 16 && Math.random() < 0.3 ? "stonejaw" : "crawler", sx + 0.5, sy, sz + 0.5);
          made = true;
        }
      } else if (night && far > 16 && kind !== "water" && Math.random() < 0.45) {
        const y = groundAt(x, z) + 1;
        if (!nearLantern(x, y, z, 10)) {
          // Glooms come out everywhere. Each kind of land has its own monsters too.
          const choices = ["gloom", "gloom"].concat(Object.keys(CREATURES).filter((name) => CREATURES[name].hostile && CREATURES[name].when === "night" && CREATURES[name].lands.includes(kind)));
          let name = choices[Math.floor(Math.random() * choices.length)];
          if (state.day >= 3 && kingDay !== state.day && Math.random() < 0.08) {
            name = "gloomking";
            kingDay = state.day;
            toast("The ground trembles... the GLOOM KING is near!", 5);
          }
          addCreature(name, x + 0.5, y, z + 0.5);
          made = true;
        }
      }
    }
    if (!made && animals < 14) {
      const choices = Object.keys(CREATURES).filter((name) => !CREATURES[name].hostile && CREATURES[name].lands.includes(kind));
      const name = choices[Math.floor(Math.random() * choices.length)];
      if (name === "fish") addCreature(name, x + 0.5, land.h + 1 + Math.random() * Math.max(0.5, SEA - land.h - 2), z + 0.5);
      else if (name === "duck") addCreature(name, x + 0.5, SEA + 0.6, z + 0.5);
      else if (name) addCreature(name, x + 0.5, groundAt(x, z) + 1, z + 0.5);
    }
  }
  for (const c of creatures.slice()) {
    const def = c.def;
    const toX = player.x - c.x, toZ = player.z - c.z;
    const away = Math.hypot(toX, toZ);
    if (away > 70 || (def.when === "night" && sunHeight > 0.02) || (def.when === "cave" && away > 36)) {
      if (def.hostile && away < 70) puff(c.x, c.y + 0.5, c.z, SMOKE, 10, 3);
      removeCreature(c);
      continue;
    }
    c.timer -= dt;
    if (c.timer <= 0) {
      c.timer = 1 + Math.random() * 3;
      c.walking = Math.random() < 0.6;
      c.dir = Math.random() * 6.28;
    }
    let speed = c.walking ? def.speed : 0;
    if (def.hostile) {
      // Monsters come straight at you. Lanterns and torches keep most of them away. Spitters stay back and spit.
      c.dir = Math.atan2(toX, toZ);
      const scared = def.fears && nearLantern(c.x, c.y, c.z, def.fears);
      const sees = away < (def.when === "cave" ? 16 : 44);
      speed = scared ? -def.speed : !sees ? 0 : def.spits ? (away < 5 ? -def.speed : away > 9 ? def.speed : 0) : away > 1 ? def.speed : 0;
      c.cool -= dt;
      if (def.spits && sees && away < 13 && c.cool <= 0) {
        c.cool = 2.4;
        spit(c);
      } else if (!def.spits && away < (def.tall > 1.5 ? 1.8 : 1.25) && Math.abs(player.y - c.y) < 2.4 && c.cool <= 0) {
        c.cool = 1.2;
        hurt(def.hit, def.says);
        if (def.chill) chillTimer = 2.5;
      }
      // A spike trap hurts any monster standing in it
      if (BLOCKS[getBlock(Math.floor(c.x), Math.floor(c.y + 0.1), Math.floor(c.z))].spikes && (c.spiked -= dt) <= 0) {
        c.spiked = 0.7;
        if (harm(c, 2, 0, 0)) continue;
      }
    } else if (def.shy && away < 3.5) {
      c.dir = Math.atan2(-toX, -toZ);       // run away!
      speed = def.speed * 1.8;
      c.walking = true;
    }
    if (c.happy > 0) {
      c.happy -= dt;
      speed = 0;
      if (c.grounded) c.vy = 4;
    }
    const nx = c.x + Math.sin(c.dir) * speed * dt;
    const nz = c.z + Math.cos(c.dir) * speed * dt;
    const front = getBlock(Math.floor(nx + Math.sin(c.dir) * 0.35), Math.floor(c.y + 0.1), Math.floor(nz + Math.cos(c.dir) * 0.35));
    if (def.fish) {
      // Fish stay in the water
      if (front === WATER && getBlock(Math.floor(nx), Math.floor(c.y + 0.5), Math.floor(nz)) === WATER) { c.x = nx; c.z = nz; }
      else c.dir += 2 + Math.random();
      c.group.position.set(c.x, c.y + Math.sin(state.clock * 2 + c.x) * 0.05, c.z);
      c.group.rotation.y = c.dir + Math.sin(state.clock * 8) * 0.2;
      continue;
    }
    if (isSolid(front)) {
      if (!isSolid(getBlock(Math.floor(nx + Math.sin(c.dir) * 0.35), Math.floor(c.y + 1.1), Math.floor(nz + Math.cos(c.dir) * 0.35))) && c.grounded) c.vy = 7;   // hop up a step
      else if (c.grounded && !def.hostile) c.dir += 1.6 + Math.random() * 2;
    } else if (BLOCKS[front].liquid && !def.swims && !def.hover) c.dir += 2.5 + Math.random();       // keep out of the water
    else { c.x = nx; c.z = nz; }
    if (def.hop && speed && c.grounded) c.vy = def.hop;
    // Gravity (ducks float; Glooms hover)
    const under = getBlock(Math.floor(c.x), Math.floor(c.y - 0.05), Math.floor(c.z));
    c.grounded = false;
    if (def.hover) c.y += (groundAt(Math.floor(c.x), Math.floor(c.z)) + def.hover + Math.sin(state.clock * 3 + c.x) * 0.2 - c.y) * Math.min(1, dt * 3);
    else if (def.swims && BLOCKS[getBlock(Math.floor(c.x), Math.floor(c.y + 0.2), Math.floor(c.z))].liquid) { c.y += (SEA + 0.62 - c.y) * Math.min(1, dt * 6); c.vy = 0; c.grounded = true; }
    else {
      c.vy -= 22 * dt;
      c.y += c.vy * dt;
      if (c.vy <= 0 && isSolid(getBlock(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)))) {
        c.y = Math.floor(c.y) + 1;
        c.vy = 0;
        c.grounded = true;
      } else if (isSolid(under) && c.vy <= 0) c.grounded = true;
    }
    // Show it
    if (speed) c.step += dt * 10;
    c.legs.forEach((leg, i) => (leg.rotation.x = speed ? Math.sin(c.step + (i % 2) * Math.PI + (i > 1 ? Math.PI : 0)) * 0.6 : 0));
    c.group.position.set(c.x, c.y, c.z);
    c.group.rotation.y = c.dir;
    c.group.rotation.z = def.waddle && speed ? Math.sin(c.step) * 0.14 : 0;
    if (c.flash > 0) c.flash -= dt;
    c.group.scale.setScalar(c.flash > 0 ? 1.18 : 1);            // (it puffs up for a moment when it is hit)
    // Its shadow lies on the first solid block underneath it
    let floor = Math.floor(c.y + 0.2);
    while (floor > 0 && !isSolid(getBlock(Math.floor(c.x), floor - 1, Math.floor(c.z)))) floor--;
    c.shadow.position.set(c.x, floor + 0.03, c.z);
    c.shadow.material.opacity = 0.28;
  }
}

// ----- Everything that happens, many times a second -----
let hudTimer = 0;
let saveTimer = 0;
let healTimer = 0;
function update(dt) {
  state.clock += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) el("toast").hidden = true;
  if (hurtTimer > 0) hurtTimer -= dt;
  movePlayer(dt);
  if (shake > 0) {
    shake -= dt;
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  target = lookAtBlock(5.5);
  dig(dt);
  if (mouse.right && (placeTimer -= dt) <= 0) {
    placeTimer = 0.2;          // hold the button to keep building
    useOrPlace();
  }
  // The outline, and the dark cover that grows while you dig
  outline.visible = Boolean(target);
  if (target) outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
  cracks.visible = Boolean(digging && target);
  if (cracks.visible) {
    cracks.position.copy(outline.position);
    cracks.material.opacity = Math.min(0.6, (digging.time / BLOCKS[target.id].hard) * 0.6);
  }
  // Poppers counting down
  for (const fuse of fuses.slice()) {
    fuse.time -= dt;
    if (Math.random() < dt * 20) puff(fuse.x + 0.5, fuse.y + 1.1, fuse.z + 0.5, SPARK, 1, 2);
    if (fuse.time > 0) continue;
    fuses.splice(fuses.indexOf(fuse), 1);
    if (getBlock(fuse.x, fuse.y, fuse.z) === POPPER) explode(fuse.x, fuse.y, fuse.z);
  }
  // Saplings growing
  for (const seed of state.grow.slice()) {
    if (state.clock < seed[3]) continue;
    state.grow.splice(state.grow.indexOf(seed), 1);
    if (getBlock(seed[0], seed[1], seed[2]) === SAPLING) growTree(seed[0], seed[1], seed[2]);
  }
  if (attackWait > 0) attackWait -= dt;
  if (chillTimer > 0) chillTimer -= dt;
  updateCreatures(dt);
  updateShots(dt);
  updateHand(dt);
  updateBits(dt);
  // Hearts slowly come back
  if (state.hp < 10 && (healTimer += dt) > 12) {
    healTimer = 0;
    state.hp++;
  }
  if ((hudTimer -= dt) <= 0) {
    hudTimer = 0.25;
    const part = state.time < 0.2 ? "Morning" : state.time < 0.38 ? "Afternoon" : state.time < 0.5 ? "Evening" : "Night";
    el("hearts").textContent = state.builder ? "" : "♥".repeat(Math.max(0, state.hp)) + "♡".repeat(Math.max(0, 10 - state.hp));
    el("where").textContent = "X " + Math.floor(player.x) + "  Y " + Math.floor(player.y) + "  Z " + Math.floor(player.z) + "  " + landAt(Math.floor(player.x), Math.floor(player.z)).kind;
    el("clock").textContent = "Day " + state.day + ", " + part;
    el("tool").textContent = ["Bare hands", "Stone pick", "Iron pick", "Skygem pick"][state.pick] + (chillTimer > 0 ? " · chilled!" : "");
  }
  if ((saveTimer += dt) > 10) {
    saveTimer = 0;
    save();
  }
}

let lastTime = performance.now();
function frame(now) {
  const dt = clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;
  if (playing) update(dt);
  else {
    camera.position.set(player.x, player.y + 1.6, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  }
  updateChunks(dt);
  updateSky(dt);
  renderer.render(scene, camera);
  // Then your hand is drawn on top (so it never pokes into a wall)
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(handScene, handCamera);
  renderer.autoClear = true;
  requestAnimationFrame(frame);
}

// ----- Buttons -----
// Explorer mode: collect blocks by digging, and watch your hearts.
// Creative mode: every block is free, nothing can hurt you, and you can fly.
function setMode(creative) {
  if (state.builder !== creative) {
    state.builder = creative;
    player.fly = false;
    toast(creative ? "Creative mode: every block is free. E: choose blocks. Tap Space twice (or press G) to fly. T: change the time of day." : "Explorer mode: collect blocks by digging.", 6);
    if (creative) {
      // Fill the empty boxes on your belt with some good blocks to start building with
      const starters = [GRASS, STONE, PLANKS, BRICKS, GLASS, LOG, LANTERN, PAINTS[0], PAINTS[1]];
      state.slots.forEach(function (id, i) {
        const fresh = starters.find((block) => !state.slots.includes(block));
        if (!id && fresh) state.slots[i] = fresh;
      });
      for (const creature of creatures.filter((c) => c.def.hostile)) removeCreature(creature);    // no monsters in Creative mode
    }
  }
  el("mode-button").textContent = state.builder ? "Mode: Creative" : "Mode: Explorer";
  drawBelt();
  if (bagOpen) drawBag();
}
el("mode-button").addEventListener("click", function () {
  el("mode-button").blur();
  setMode(!state.builder);
});
el("start-creative").addEventListener("click", function () {
  setMode(true);
  grabMouse();
});
el("new-world").addEventListener("click", function () {
  if (!confirm("Make a brand new world? Your old world will be gone for ever.")) return;
  localStorage.removeItem(SAVE_NAME);
  startWorld(null);
  save();
});

// ----- Go! -----
let saved = null;
try {
  saved = JSON.parse(localStorage.getItem(SAVE_NAME));
} catch (error) {
  saved = null;
}
startWorld(saved && saved.state ? saved : null);
requestAnimationFrame(frame);

// Only for testing the game.
window.CW = {
  player: player, keys: keys, mouse: mouse, creatures: creatures, fuses: fuses,
  state: () => state, target: () => target, give: give, breakBlock: breakBlock, useOrPlace: useOrPlace, attack: attack, harm: harm, shots: shots, shoot: shoot,
  addCreature: addCreature, explode: explode, toggleBag: toggleBag, startWorld: startWorld, save: save, hurt: hurt,
  loading: () => loading, chunksDrawn: () => [...world.chunks.values()].filter((chunk) => chunk.mesh).length,
};
