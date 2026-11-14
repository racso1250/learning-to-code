// Drawing Temple Guardian: a 3D world with flat 2D pixel-art sprites (the "HD-2D" style).

const RENDER_WIDTH = 400;   // draw small, then stretch: chunky 16-bit pixels
const LEVEL = 0.5;          // how tall one step of hill is
const WATER_TOP = -0.07;    // the height of the water's surface

function topOf(height) {
  return 0.15 + height * LEVEL;
}

// ----- Textures -----

function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pixelTexture(colourList, seed, pick) {
  const random = seeded(seed);
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const pen = canvas.getContext("2d");
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      pen.fillStyle = colourList[pick(x, y, random())];
      pen.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

const speckled = (x, y, r) => (r < 0.6 ? 0 : r < 0.85 ? 1 : 2);
const layered = (x, y, r) => (y % 8 === 7 ? 1 : r < 0.7 ? 0 : r < 0.9 ? 1 : 2);
const tiled = (x, y, r) => (x % 8 === 0 || y % 8 === 0 ? 1 : r < 0.8 ? 0 : 2);

// Each area has its own colours
const areaColours = {
  builder: {
    sky: 0xb8e0ff,
    grass: ["#6cc04c", "#5aac3e", "#84d462"], rock: ["#9a96a2", "#86828e", "#aeaab6"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#2f8ad0", "#46a0e0", "#c0e8ff"],
    dirt: ["#9a7448", "#7f5c36", "#b08654"], stone: ["#86828e", "#6e6a76", "#9a96a2"],
  },
  temple: {
    sky: 0x9fd0f0,
    grass: ["#5fb04a", "#4e9a3c", "#77c45f"], rock: ["#8a8794", "#77737f", "#a09daa"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#2f7fc8", "#4592da", "#b8e4ff"],
    dirt: ["#8a6a44", "#6f5232", "#a07c50"], stone: ["#77737f", "#5f5b66", "#8d8994"],
  },
  farm: {
    sky: 0xb8e4ff,
    grass: ["#7cc850", "#6ab440", "#94d868"], rock: ["#8a8794", "#77737f", "#a09daa"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#3a90d8", "#50a4e8", "#c8ecff"],
    dirt: ["#9a7448", "#7f5c36", "#b08654"], stone: ["#77737f", "#5f5b66", "#8d8994"],
  },
  dusk: {
    sky: 0x7a4a7a,
    grass: ["#6a5a9a", "#5a4a8a", "#7a6aaa"], rock: ["#9a8ac8", "#8a7ab8", "#b0a0dc"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#3a2a6a", "#4a3a80", "#ff9a7a"],
    dirt: ["#4a3a64", "#3a2c52", "#5c4a78"], stone: ["#4a3a64", "#3a2c52", "#5c4a78"],
  },
  gloom: {
    sky: 0x4a3848,
    grass: ["#5a5056", "#4a4046", "#6a6066"], rock: ["#4e454c", "#3f373d", "#5e555c"],
    snow: ["#f4f8fc", "#dfe8f2", "#ffffff"], water: ["#1f3a6f", "#2f4a86", "#6f90d0"],
    dirt: ["#3d3036", "#2c2228", "#4e3e46"], stone: ["#3d3036", "#2c2228", "#4e3e46"],
  },
};

// How the sky and the floating "magic" look in each area
const areaMoods = {
  temple: { skyTop: "#4f9be0", horizon: "#cfe8f5", sparkle: 0xfff4b0, sparkleKind: "pollen" },
  builder: { skyTop: "#5aa8ec", horizon: "#e2f2ff", sparkle: 0xfff8c8, sparkleKind: "fireflies" },
  farm: { skyTop: "#5aaef0", horizon: "#eaf6ff", sparkle: 0xffffff, sparkleKind: "butterflies" },
  dusk: { skyTop: "#2a1848", horizon: "#e8907a", sparkle: 0x9ff8ff, sparkleKind: "fireflies" },
  gloom: { skyTop: "#1a0f1f", horizon: "#6a3036", sparkle: 0xff7a3a, sparkleKind: "embers" },
};

// A see-through texture of white specks, for foam where water meets land
function foamTexture() {
  const random = seeded(99);
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const pen = canvas.getContext("2d");
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = random();
      if (r < 0.35) {
        pen.fillStyle = r < 0.15 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)";
        pen.fillRect(x, y, 1, 1);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}
const foamLook = new THREE.MeshBasicMaterial({ map: foamTexture(), transparent: true, depthWrite: false });

// Make a colour darker (factor below 1) or lighter (above 1)
function shade(hex, factor) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return "#" + c.getHexString();
}

// Materials for buildings in the Great Land
const plankLook = new THREE.MeshLambertMaterial({ map: pixelTexture(["#a87a4a", "#8a5e34", "#c08c58"], 21, (x, y, r) => (y % 4 === 3 ? 1 : r < 0.8 ? 0 : 2)) });
const brickLook = new THREE.MeshLambertMaterial({ map: pixelTexture(["#c8c4d0", "#9a96a4", "#dedae6"], 22, tiled) });
const ruinLook = new THREE.MeshLambertMaterial({ map: pixelTexture(["#7a7480", "#5a5460", "#8e8894"], 23, layered) });
const windowLook = new THREE.MeshBasicMaterial({ color: 0xffd890 }); // "Basic" = glows in the dark
const whiteLook = new THREE.MeshLambertMaterial({ color: 0xf4f0e8 });
const roofLooks = {};
function roofLook(hex) {
  if (!roofLooks[hex]) {
    roofLooks[hex] = new THREE.MeshLambertMaterial({ map: pixelTexture(["#ffffff", "#cccccc", "#e6e6e6"], 24, (x, y, r) => (y % 4 === 3 ? 1 : r < 0.85 ? 0 : 2)), color: hex });
  }
  return roofLooks[hex];
}

// Make the textures and materials for one area
function makeLooks(area) {
  const c = areaColours[area];
  const water = pixelTexture(c.water, 6, function (x, y, r) {
    if ((x * 3 + y * 5) % 13 === 0 && r > 0.3) return 2;
    return r < 0.65 ? 0 : 1;
  });
  water.wrapS = THREE.RepeatWrapping;
  water.wrapT = THREE.RepeatWrapping;
  return {
    water: water,
    tops: {
      grass: new THREE.MeshLambertMaterial({ map: pixelTexture(c.grass, 1, speckled) }),
      rock: new THREE.MeshLambertMaterial({ map: pixelTexture(c.rock, 3, speckled) }),
      snow: new THREE.MeshLambertMaterial({ map: pixelTexture(c.snow, 4, speckled) }),
      temple: new THREE.MeshLambertMaterial({ map: pixelTexture(["#e8dcc0", "#b8a888", "#f6eed8"], 5, tiled) }),
      water: new THREE.MeshLambertMaterial({ map: water }),
      deepWater: new THREE.MeshLambertMaterial({ map: water, color: 0x9aa8d8 }), // darker far from shore
    },
    sides: {
      dirt: new THREE.MeshLambertMaterial({ map: pixelTexture(c.dirt, 7, layered) }),
      stone: new THREE.MeshLambertMaterial({ map: pixelTexture(c.stone, 8, layered) }),
      temple: new THREE.MeshLambertMaterial({ map: pixelTexture(["#d8ccb0", "#a89878", "#e8dcc0"], 9, layered) }),
    },
  };
}
const pillarLook = new THREE.MeshLambertMaterial({ map: pixelTexture(["#e8dcc0", "#c8b898", "#f8f0e0"], 11, layered) });
const crackedLook = new THREE.MeshLambertMaterial({ map: pixelTexture(["#8a8478", "#5a5448", "#a8a090"], 12, layered) });
const goldLook = new THREE.MeshLambertMaterial({ color: 0xf6d04a, emissive: 0x6a5010 });

// ----- Sprites -----

const spriteCache = new Map();
function spriteTexture(sprite, swaps) {
  const key = sprite.join("") + JSON.stringify(swaps || {});
  if (spriteCache.has(key)) return spriteCache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const pen = canvas.getContext("2d");
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const letter = sprite[y][x];
      if (letter !== ".") {
        pen.fillStyle = (swaps && swaps[letter]) || colours[letter];
        pen.fillRect(x, y, 1, 1);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  spriteCache.set(key, texture);
  return texture;
}

function mirror(sprite) {
  return sprite.map((row) => row.split("").reverse().join(""));
}

function makeSprite(sprite, size, swaps) {
  const flat = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture(sprite, swaps), alphaTest: 0.5 }));
  flat.center.set(0.5, 0); // stand on its feet
  flat.scale.set(size, size, 1);
  return flat;
}

// Which sprite to use for each thing you can gather
const thingSprites = {
  tree: { sprite: treeSprite, size: 1.5 },
  pine: { sprite: pineSprite, size: 1.5 },
  rock: { sprite: rockSprite, size: 1 },
  iron: { sprite: ironSprite, size: 1 },
  crystal: { sprite: crystalSprite, size: 1 },
  bush: { sprite: bushSprite, size: 1 },
  herb: { sprite: herbSprite, size: 0.9 },
  wheat: { sprite: wheatSprite, size: 1 },
  pumpkin: { sprite: pumpkinSprite, size: 1 },
  fence: { sprite: fenceSprite, size: 1, noShadow: true },
  deadTree: { sprite: deadTreeSprite, size: 1.4 },
  duskTree: { sprite: treeSprite, size: 1.5, swaps: { g: "#4fe0c8", G: "#2a9a9a", u: "#5a3a6a", U: "#3a2448" } },
  duskstone: { sprite: crystalSprite, size: 1, swaps: { c: "#e0a8ff", C: "#8a4fd8" } },
  gloomsteel: { sprite: ironSprite, size: 1, swaps: { o: "#ff3a3a", W: "#5e555c", A: "#2c2228" } },
  throne: { sprite: totemSprite, size: 2, swaps: { c: "#ff3a3a", C: "#8a1a1a", e: "#ffb0b0", W: "#3a2a48", A: "#1a1028", y: "#8a4fd8" } },
};

function glowTexture(colour) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const pen = canvas.getContext("2d");
  const gradient = pen.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, colour);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  pen.fillStyle = gradient;
  pen.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}
const goldGlow = new THREE.SpriteMaterial({ map: glowTexture("rgba(255, 230, 120, 0.9)"), blending: THREE.AdditiveBlending, depthWrite: false });
const gloomGlow = new THREE.SpriteMaterial({ map: glowTexture("rgba(140, 60, 220, 0.8)"), blending: THREE.AdditiveBlending, depthWrite: false });

// ----- The view -----

function createTempleView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd0f0);
  scene.fog = new THREE.Fog(0x9fd0f0, 20, 40);
  const camera = new THREE.PerspectiveCamera(30, 1.5, 0.1, 200);

  const skyLight = new THREE.HemisphereLight(0xfff6e8, 0x405068, 0.8);
  scene.add(skyLight);
  let timeOfDay = 1;
  let spriteLight = 1; // how bright flat sprites are (lower at night)
  const sun = new THREE.DirectionalLight(0xffe8c8, 0.85);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.far = 60;
  for (const side of ["left", "bottom"]) sun.shadow.camera[side] = -16;
  for (const side of ["right", "top"]) sun.shadow.camera[side] = 16;
  scene.add(sun);
  scene.add(sun.target);

  const blockShape = new THREE.BoxGeometry(1, 1, 1);
  const shadowShape = new THREE.CircleGeometry(0.32, 10);
  const shadowLook = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

  let tiles = [];
  let size = 0;
  let worldGroup = null;           // everything in the current area
  let looks = null;
  let seaTexture = null;
  let spirit = null;
  let sky = null;
  let cullTimer = 0;
  let clouds = [];
  let sparkles = null;
  let sparklePositions = null;
  const things = new Map();        // "x,y" -> sprite of something you can gather
  const thingShadows = new Map();  // "x,y" -> shadow blob
  const riftSprites = {};          // temple id -> rift sprite
  const templeGroups = {};         // temple id -> the temple's pillars, rebuilt as it changes
  const particles = [];
  const slashes = [];

  function heightAt(x, y) {
    const tile = tiles[y] && tiles[y][x];
    if (!tile) return 0;
    return tile.height;
  }

  function addBlocks(group, blocks, material, castShadows) {
    if (blocks.length === 0) return;
    const mesh = new THREE.InstancedMesh(blockShape, material, blocks.length);
    const placer = new THREE.Object3D();
    blocks.forEach(function (b, i) {
      placer.position.set(b.x, b.y, b.z);
      placer.scale.set(b.w, b.h, b.d);
      placer.updateMatrix();
      mesh.setMatrixAt(i, placer.matrix);
    });
    mesh.castShadow = castShadows;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  // A random-looking number for a square that's always the same
  function hashTile(x, y, n) {
    const v = Math.sin(x * 12.9898 + y * 78.233 + n * 37.719) * 43758.5453;
    return v - Math.floor(v);
  }

  // Blocks that each have their own colour (like grass tufts)
  const tuftLook = new THREE.MeshLambertMaterial({ color: 0xffffff });
  function addColouredBlocks(group, blocks) {
    if (blocks.length === 0) return;
    const mesh = new THREE.InstancedMesh(blockShape, tuftLook, blocks.length);
    const placer = new THREE.Object3D();
    const colour = new THREE.Color();
    blocks.forEach(function (b, i) {
      placer.position.set(b.x, b.y, b.z);
      placer.scale.set(b.w, b.h, b.d);
      placer.updateMatrix();
      mesh.setMatrixAt(i, placer.matrix);
      mesh.setColorAt(i, colour.set(b.colour));
    });
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  function addShadowBlob(x, y, z, scale) {
    const blob = new THREE.Mesh(shadowShape, shadowLook);
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(x, y + 0.03, z);
    blob.scale.setScalar(scale);
    (worldGroup || scene).add(blob);
    return blob;
  }

  // Put a gatherable thing (tree, rock...) on a square
  function addThing(x, y) {
    const tile = tiles[y][x];
    const look = thingSprites[tile.thing];
    if (!look) return;
    const top = topOf(tile.height);
    const flat = makeSprite(look.sprite, look.size, look.swaps);
    flat.position.set(x, top, y);
    flat.userData.sways = look.size > 1.2; // tall things sway in the wind
    flat.userData.phase = x * 0.7 + y * 1.3;
    worldGroup.add(flat);
    things.set(x + "," + y, flat);
    if (!look.noShadow) thingShadows.set(x + "," + y, addShadowBlob(x, top, y, look.size > 1 ? 1.3 : 1));
  }

  // ----- Load an area: build its land, water and things -----
  function load(newTiles, area) {
    // Throw away the old area
    if (worldGroup) {
      scene.remove(worldGroup);
      worldGroup.traverse(function (thing) {
        if (thing.isInstancedMesh) thing.dispose();
      });
    }
    things.clear();
    thingShadows.clear();
    for (const id of Object.keys(riftSprites)) delete riftSprites[id];
    for (const id of Object.keys(templeGroups)) delete templeGroups[id];
    wizardSprites.clear();
    buildings.clear();
    sails.length = 0;
    villagers.clear();
    dayNight = false;
    spriteLight = 1;
    player.material.color.setScalar(1);
    skyLight.intensity = 0.8;
    sun.intensity = 0.85;
    windowLook.color.set(0xffd890);
    for (const e of enemySprites.values()) {
      scene.remove(e.sprite);
      scene.remove(e.shadow);
    }
    enemySprites.clear();
    target = null;

    tiles = newTiles;
    size = tiles.length;
    worldGroup = new THREE.Group();
    scene.add(worldGroup);
    looks = makeLooks(area);
    const mood = areaMoods[area];
    dayColour.set(mood.horizon);
    scene.background = new THREE.Color(mood.horizon);
    scene.fog = new THREE.Fog(mood.horizon, 20, 42);

    // The sky: a giant ball around everything, fading from the sky colour to the horizon
    const skyPaint = document.createElement("canvas");
    skyPaint.width = 4;
    skyPaint.height = 64;
    const skyPen = skyPaint.getContext("2d");
    const gradient = skyPen.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, mood.skyTop);
    gradient.addColorStop(0.5, mood.horizon);
    gradient.addColorStop(1, mood.horizon);
    skyPen.fillStyle = gradient;
    skyPen.fillRect(0, 0, 4, 64);
    sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 16, 12),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyPaint), side: THREE.BackSide, fog: false })
    );
    worldGroup.add(sky);

    // Invisible clouds that only cast SHADOWS, drifting across the ground
    clouds = [];
    const cloudLook = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const cloud = new THREE.Group();
      for (let p = 0; p < 4; p++) {
        const puff = new THREE.Mesh(blockShape, cloudLook);
        puff.scale.set(2 + Math.random() * 2.5, 0.5, 1.5 + Math.random() * 2);
        puff.position.set(p * 1.6, 0, Math.random() * 1.5);
        puff.castShadow = true;
        cloud.add(puff);
      }
      cloud.position.set(Math.random() * size, 7, Math.random() * size);
      worldGroup.add(cloud);
      clouds.push(cloud);
    }

    // Floating magic in the air: pollen, butterflies, fireflies or embers
    const count = 120;
    sparklePositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      sparklePositions[i * 3] = (Math.random() - 0.5) * 24;
      sparklePositions[i * 3 + 1] = Math.random() * 4;
      sparklePositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const sparkleShape = new THREE.BufferGeometry();
    sparkleShape.setAttribute("position", new THREE.BufferAttribute(sparklePositions, 3));
    sparkles = new THREE.Points(sparkleShape, new THREE.PointsMaterial({
      color: mood.sparkle,
      size: mood.sparkleKind === "butterflies" ? 0.14 : 0.09,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    sparkles.userData.kind = mood.sparkleKind;
    worldGroup.add(sparkles);

    const topBlocks = { grass: [], rock: [], snow: [], temple: [], water: [], deepWater: [] };
    const sides = { dirt: [], stone: [], temple: [] };
    const foam = [];
    const tufts = [];
    const grassColours = areaColours[area].grass;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tile = tiles[y][x];
        if (tile.kind === "water") {
          // Water far from any land looks deeper and darker
          let deep = true;
          for (let dy = -2; dy <= 2 && deep; dy++) {
            for (let dx = -2; dx <= 2 && deep; dx++) {
              const n = tiles[y + dy] && tiles[y + dy][x + dx];
              if (n && n.kind !== "water") deep = false;
            }
          }
          (deep ? topBlocks.deepWater : topBlocks.water).push({ x: x, y: WATER_TOP, z: y, w: 1, h: 0.04, d: 1 });
          // Foam where the water touches the shore
          const nextToLand = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function ([dx, dy]) {
            const n = tiles[y + dy] && tiles[y + dy][x + dx];
            return n && n.kind !== "water";
          });
          if (nextToLand) foam.push({ x: x, y: WATER_TOP + 0.03, z: y, w: 1, h: 0.01, d: 1 });
          continue;
        }
        // Little tufts of grass on empty grassy squares
        if (tile.kind === "grass" && !tile.thing && hashTile(x, y, 1) < 0.5) {
          for (let t = 0; t < 3; t++) {
            const height = 0.08 + hashTile(x, y, t + 2) * 0.1;
            tufts.push({
              x: x + hashTile(x, y, t + 10) * 0.8 - 0.4,
              y: topOf(tile.height) + height / 2,
              z: y + hashTile(x, y, t + 20) * 0.8 - 0.4,
              w: 0.04, h: height, d: 0.04,
              colour: grassColours[t % 2 === 0 ? 1 : 2],
            });
          }
        }
        topBlocks[tile.kind].push({ x: x, y: topOf(tile.height), z: y, w: 1, h: 0.04, d: 1 });
        // Only build the cliff sides you can see
        let lowest = tile.height;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          lowest = Math.min(lowest, heightAt(x + dx, y + dy));
        }
        const sideKind = tile.kind === "temple" ? "temple" : tile.kind === "rock" || tile.kind === "snow" ? "stone" : "dirt";
        for (let level = Math.max(lowest, -1) + 1; level <= tile.height; level++) {
          sides[sideKind].push({ x: x, y: topOf(level) - LEVEL / 2, z: y, w: 1, h: LEVEL, d: 1 });
        }
        if (tile.thing) addThing(x, y);
      }
    }
    for (const kind of Object.keys(topBlocks)) addBlocks(worldGroup, topBlocks[kind], looks.tops[kind], false);
    for (const kind of Object.keys(sides)) addBlocks(worldGroup, sides[kind], looks.sides[kind], true);
    addBlocks(worldGroup, foam, foamLook, false);
    addColouredBlocks(worldGroup, tufts);

    // A big sea all around the area
    seaTexture = looks.water.clone();
    seaTexture.needsUpdate = true;
    seaTexture.repeat.set(300, 300);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ map: seaTexture }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(size / 2, WATER_TOP - 0.03, size / 2);
    worldGroup.add(sea);

    // The Temple Spirit lives in the Temple Lands
    spirit = null;
    if (area === "temple") {
      spirit = makeSprite(spiritSprite, 1);
      worldGroup.add(spirit);
    }
  }

  // ----- Temples and rifts -----

  // (Re)build one temple. Its pillars are cracked and short when it's hurt,
  // and tall and golden once it's saved.
  function setTemple(temple, health, saved) {
    if (templeGroups[temple.id]) worldGroup.remove(templeGroups[temple.id]);
    const group = new THREE.Group();
    const top = topOf(heightAt(temple.x, temple.y));
    const pillarHeight = saved ? 2.2 : 0.4 + (health / 100) * 1.5;
    const pillarBlocks = [];
    const gold = [];
    for (const [px, py] of templePillars) {
      pillarBlocks.push({ x: temple.x + px, y: top + pillarHeight / 2, z: temple.y + py, w: 0.55, h: pillarHeight, d: 0.55 });
      if (saved) gold.push({ x: temple.x + px, y: top + pillarHeight + 0.08, z: temple.y + py, w: 0.7, h: 0.16, d: 0.7 });
    }
    pillarBlocks.push({ x: temple.x, y: top + 0.3, z: temple.y, w: 0.8, h: 0.6, d: 0.8 }); // the altar
    addBlocks(group, pillarBlocks, health < 40 && !saved ? crackedLook : pillarLook, true);
    if (saved) {
      gold.push({ x: temple.x, y: top + 0.65, z: temple.y, w: 0.5, h: 0.1, d: 0.5 });
      addBlocks(group, gold, goldLook, true);
      const glow = new THREE.Sprite(goldGlow);
      glow.position.set(temple.x, top + 1.2, temple.y);
      glow.scale.setScalar(5);
      group.add(glow);
    }
    worldGroup.add(group);
    templeGroups[temple.id] = group;
  }

  // Draw a rift: open (dark and swirling) or closed (a light totem)
  function setRift(temple, closed) {
    if (riftSprites[temple.id]) {
      worldGroup.remove(riftSprites[temple.id].sprite);
      worldGroup.remove(riftSprites[temple.id].glow);
    }
    const r = temple.rift;
    const top = topOf(heightAt(r.x, r.y));
    const sprite = makeSprite(closed ? totemSprite : riftSprite, closed ? 1.2 : 1.6);
    sprite.position.set(r.x, top, r.y);
    worldGroup.add(sprite);
    const glow = new THREE.Sprite(closed ? goldGlow : gloomGlow);
    glow.position.set(r.x, top + 0.7, r.y);
    glow.scale.setScalar(closed ? 3 : 4);
    worldGroup.add(glow);
    riftSprites[temple.id] = { sprite: sprite, glow: glow, closed: closed };
  }

  const mountain = temples[0];

  // ----- Effects -----

  function burst(x, y, hex, count, height) {
    for (let i = 0; i < count; i++) {
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: hex }));
      bit.position.set(x, (height !== undefined ? height : topOf(Math.max(0, heightAt(x, y)))) + 0.35, y);
      bit.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
      bit.userData.life = 0.7;
      scene.add(bit);
      particles.push(bit);
    }
  }

  function hitThing(x, y, hex) {
    burst(x, y, hex, 5);
    const flat = things.get(x + "," + y);
    if (flat) flat.userData.shake = 0.25;
  }

  function removeThing(x, y, hex) {
    burst(x, y, hex, 14);
    const key = x + "," + y;
    if (things.has(key)) {
      worldGroup.remove(things.get(key));
      if (thingShadows.has(key)) worldGroup.remove(thingShadows.get(key));
      things.delete(key);
      thingShadows.delete(key);
    }
  }

  // The flash of your weapon
  function slash(x, y, facing, hex) {
    const flat = makeSprite(facing === "left" ? mirror(slashSprite) : slashSprite, 1, { e: hex });
    flat.material = flat.material.clone();
    flat.material.transparent = true;
    flat.position.set(x, topOf(Math.max(0, heightAt(x, y))) + 0.05, y);
    flat.userData.life = 0.18;
    scene.add(flat);
    slashes.push(flat);
  }

  // ----- Wizards -----

  const wizardSprites = new Map(); // wizard id -> sprite
  const bolts = [];
  const boltLook = new THREE.SpriteMaterial({ map: glowTexture("rgba(160, 220, 255, 1)"), blending: THREE.AdditiveBlending, depthWrite: false });

  // Make the wizards' sprites match the game: standing, or lying down when knocked out
  function syncWizards(wizards) {
    for (const w of wizards) {
      if (!wizardSprites.has(w.id)) {
        const flat = makeSprite(wizardSprite, 1, { v: w.colour });
        flat.material = flat.material.clone();
        flat.userData = { x: w.x, y: w.y };
        worldGroup.add(flat);
        addShadowBlob(w.x, topOf(heightAt(w.x, w.y)), w.y, 1);
        wizardSprites.set(w.id, flat);
      }
      const flat = wizardSprites.get(w.id);
      flat.userData.out = w.out;
      flat.material.color.set(w.out ? 0x8888a0 : 0xffffff);
      flat.material.rotation = w.out ? Math.PI / 2 : 0; // lying down
    }
  }

  // A glowing magic bolt flies from a wizard to an enemy
  function bolt(fromX, fromY, toX, toY, hex) {
    const flat = new THREE.Sprite(boltLook);
    flat.scale.setScalar(0.6);
    const startY = topOf(Math.max(0, heightAt(fromX, fromY))) + 0.8;
    flat.userData = {
      from: new THREE.Vector3(fromX + 0.35, startY, fromY),
      to: new THREE.Vector3(toX, topOf(Math.max(0, heightAt(toX, toY))) + 0.4, toY),
      life: 0,
      hex: hex,
    };
    scene.add(flat);
    bolts.push(flat);
  }

  // ----- Buildings (in the Great Land) -----

  const buildings = new Map(); // key -> group
  const sails = [];            // windmill sails, which spin

  function box(group, look, x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(blockShape, look);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // A stepped roof, getting smaller as it goes up
  function roof(group, hex, top, width, tiers) {
    let size = width;
    for (let i = 0; i < tiers; i++) {
      box(group, roofLook(hex), 0, top + 0.1 + i * 0.18, 0, size, 0.2, size);
      size *= 0.72;
    }
  }

  // Build the 3D model for a building (or a ruin) at a square
  function setBuilding(key, type, x, y) {
    removeBuilding(key);
    const group = new THREE.Group();
    const top = topOf(heightAt(x, y));
    group.position.set(x, top, y);

    if (type === "house") {
      box(group, plankLook, 0, 0.45, 0, 0.9, 0.9, 0.8);
      roof(group, 0xb8402a, 0.9, 1.1, 3);
      box(group, windowLook, -0.2, 0.5, 0.41, 0.18, 0.18, 0.02);
      box(group, windowLook, 0.2, 0.5, 0.41, 0.18, 0.18, 0.02);
    } else if (type === "farm") {
      box(group, roofLook(0xc0392b), 0, 0.4, 0, 0.95, 0.8, 0.8);
      box(group, whiteLook, 0, 0.35, 0.41, 0.35, 0.5, 0.02);
      roof(group, 0x6a3a1a, 0.8, 1.05, 2);
    } else if (type === "well") {
      box(group, brickLook, 0, 0.2, 0, 0.7, 0.4, 0.7);
      box(group, new THREE.MeshLambertMaterial({ color: 0x2f7fc8 }), 0, 0.41, 0, 0.5, 0.02, 0.5);
      box(group, plankLook, -0.3, 0.6, 0, 0.08, 0.6, 0.08);
      box(group, plankLook, 0.3, 0.6, 0, 0.08, 0.6, 0.08);
      roof(group, 0x8a4a2a, 0.85, 0.8, 2);
    } else if (type === "windmill") {
      box(group, brickLook, 0, 0.75, 0, 0.7, 1.5, 0.7);
      roof(group, 0x6a3a1a, 1.5, 0.85, 3);
      box(group, windowLook, 0, 0.9, 0.36, 0.15, 0.2, 0.02);
      const sail = new THREE.Group();
      sail.position.set(0, 1.3, 0.42);
      box(sail, whiteLook, 0, 0, 0, 1.6, 0.14, 0.03);
      box(sail, whiteLook, 0, 0, 0, 0.14, 1.6, 0.03);
      group.add(sail);
      sails.push(sail);
    } else if (type === "tower") {
      box(group, brickLook, 0, 1.1, 0, 0.75, 2.2, 0.75);
      for (const [cx, cz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        box(group, brickLook, cx, 2.3, cz, 0.18, 0.2, 0.18);
      }
      box(group, windowLook, 0, 1.6, 0.38, 0.15, 0.25, 0.02);
      box(group, windowLook, 0, 0.9, 0.38, 0.15, 0.25, 0.02);
    } else if (type === "market") {
      box(group, plankLook, 0, 0.25, 0, 1, 0.5, 0.7);
      for (const cx of [-0.45, 0.45]) box(group, plankLook, cx, 0.6, 0.3, 0.07, 0.7, 0.07);
      for (let i = 0; i < 5; i++) {
        box(group, i % 2 === 0 ? roofLook(0xe04a4a) : whiteLook, -0.4 + i * 0.2, 0.98, 0.1, 0.2, 0.06, 0.9);
      }
      box(group, new THREE.MeshLambertMaterial({ color: 0xe8862a }), -0.2, 0.55, 0.2, 0.15, 0.1, 0.15);
      box(group, new THREE.MeshLambertMaterial({ color: 0x6fd06f }), 0.15, 0.55, 0.2, 0.15, 0.1, 0.15);
    } else if (type === "statue") {
      box(group, brickLook, 0, 0.25, 0, 0.8, 0.5, 0.8);
      const hero = makeSprite(heroFront, 1.3, { R: "#f6d04a", r: "#c8a030", h: "#f6d04a", s: "#ffe890", j: "#f6d04a", J: "#c8a030", n: "#c8a030", u: "#c8a030" });
      hero.position.set(0, 0.5, 0);
      group.add(hero);
    } else if (type === "ruinHouse") {
      box(group, ruinLook, -0.3, 0.25, 0, 0.15, 0.5, 0.8);
      box(group, ruinLook, 0.1, 0.15, -0.35, 0.7, 0.3, 0.12);
      box(group, ruinLook, 0.25, 0.08, 0.2, 0.3, 0.15, 0.25);
    } else if (type === "ruinWell") {
      box(group, ruinLook, -0.2, 0.12, 0, 0.3, 0.25, 0.7);
      box(group, ruinLook, 0.25, 0.08, 0.1, 0.25, 0.15, 0.4);
    } else if (type === "ruinTower") {
      box(group, ruinLook, 0, 0.35, 0, 0.7, 0.7, 0.7);
      box(group, ruinLook, 0.4, 0.08, 0.3, 0.3, 0.15, 0.25);
    } else if (type === "ruinMill") {
      box(group, ruinLook, 0, 0.3, 0, 0.6, 0.6, 0.6);
      const broken = box(group, whiteLook, 0.3, 0.05, 0.4, 0.9, 0.05, 0.12);
      broken.rotation.y = 0.6;
    }

    worldGroup.add(group);
    buildings.set(key, group);
  }

  function removeBuilding(key) {
    const old = buildings.get(key);
    if (!old) return;
    worldGroup.remove(old);
    for (let i = sails.length - 1; i >= 0; i--) {
      if (sails[i].parent === old) sails.splice(i, 1);
    }
    buildings.delete(key);
  }

  // A sparkly burst when you build or fix something
  function celebrate(x, y) {
    burst(x, y, "#f6d04a", 20);
    burst(x, y, "#ffffff", 12);
  }

  // ----- Villagers who walk around your land -----

  const villagers = new Map(); // id -> { sprite, shadow, x, y }

  function syncVillagers(list) {
    const stillHere = new Set();
    for (const v of list) {
      stillHere.add(v.id);
      if (!villagers.has(v.id)) {
        const flat = makeSprite(v.sprite, 1, v.swaps);
        flat.position.set(v.x, topOf(Math.max(0, heightAt(v.x, v.y))), v.y);
        worldGroup.add(flat);
        villagers.set(v.id, { sprite: flat, shadow: addShadowBlob(v.x, 0, v.y, 1), x: v.x, y: v.y });
      }
      const villager = villagers.get(v.id);
      villager.x = v.x;
      villager.y = v.y;
    }
    for (const [id, villager] of villagers) {
      if (!stillHere.has(id)) {
        worldGroup.remove(villager.sprite);
        worldGroup.remove(villager.shadow);
        villagers.delete(id);
      }
    }
  }

  // ----- Day and night -----

  let dayNight = false;
  const DAY_LENGTH = 240; // seconds for a whole day and night
  const dayColour = new THREE.Color();
  const nightColour = new THREE.Color(0x1a2448);
  function setDayNight(on) {
    dayNight = on;
  }

  function poof(x, y) {
    burst(x, y, "#4a2a68", 18);
    burst(x, y, "#2a1838", 10);
  }

  // ----- Player and enemies -----

  const player = makeSprite(heroFront, 1);
  scene.add(player);
  const ghost = makeSprite(heroFront, 1);
  ghost.material = ghost.material.clone();
  ghost.material.depthTest = false; // see yourself behind hills
  ghost.material.transparent = true;
  ghost.material.opacity = 0.3;
  ghost.renderOrder = 10;
  scene.add(ghost);
  const playerShadow = new THREE.Mesh(shadowShape, shadowLook);
  playerShadow.rotation.x = -Math.PI / 2;
  scene.add(playerShadow);
  function sceneShadow(scale) {
    const blob = new THREE.Mesh(shadowShape, shadowLook);
    blob.rotation.x = -Math.PI / 2;
    blob.scale.setScalar(scale);
    scene.add(blob);
    return blob;
  }
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })
  );
  ripple.rotation.x = -Math.PI / 2;
  scene.add(ripple);

  let target = null;
  let facing = null;
  let playerFront = null;
  let playerSwaps = null;
  let inBoat = false;

  // A little wooden sailing boat
  const boat = new THREE.Group();
  box(boat, plankLook, 0, 0.05, 0, 1.0, 0.22, 0.55);
  box(boat, plankLook, 0, 0.18, 0.3, 1.0, 0.1, 0.05);
  box(boat, plankLook, 0, 0.18, -0.3, 1.0, 0.1, 0.05);
  box(boat, plankLook, 0.15, 0.6, 0, 0.05, 0.9, 0.05);
  const boatSail = box(boat, whiteLook, 0.15, 0.7, 0, 0.04, 0.6, 0.5);
  boat.visible = false;
  scene.add(boat);
  let swimming = false;
  const cameraTarget = new THREE.Vector3();
  const enemySprites = new Map(); // enemy id -> { sprite, shadow, target }

  const enemyLooks = {
    gloomling: { sprite: gloomlingSprite, size: 1 },
    big: { sprite: gloomlingSprite, size: 1.5 },
    wisp: { sprite: gloomlingSprite, size: 1, swaps: { m: "#3a2a6a", M: "#6a4a9a", x: "#7ff0ff" } },
    king: { sprite: gloomKingSprite, size: 2.6 },
  };

  function groundY(x, y) {
    const tile = tiles[Math.round(y)] && tiles[Math.round(y)][Math.round(x)];
    if (!tile || tile.kind === "water") return WATER_TOP;
    return topOf(tile.height);
  }

  // Make the picture match the game
  function sync(state) {
    if (target === null) {
      target = new THREE.Vector3(state.x, 0, state.y);
      player.position.set(state.x, groundY(state.x, state.y), state.y);
      cameraTarget.copy(player.position);
    }
    if (Math.hypot(state.x - target.x, state.y - target.z) > 3) {
      player.position.set(state.x, groundY(state.x, state.y), state.y); // teleported
      cameraTarget.copy(player.position);
    }
    target.set(state.x, 0, state.y);
    swimming = state.swimming;
    inBoat = state.swimming && state.boat;
    if (state.facing !== facing || state.front !== playerFront || state.swaps !== playerSwaps) {
      facing = state.facing;
      playerFront = state.front;
      playerSwaps = state.swaps;
      let sprite = state.front;
      if (facing === "up") sprite = state.back;
      if (facing === "left") sprite = mirror(state.front);
      player.material.map = spriteTexture(sprite, state.swaps); // swaps = costume colours
      ghost.material.map = player.material.map;
    }

    // Enemies: add new ones, move them, remove the defeated ones
    const stillHere = new Set();
    for (const enemy of state.enemies) {
      stillHere.add(enemy.id);
      if (!enemySprites.has(enemy.id)) {
        const look = enemyLooks[enemy.kind];
        const flat = makeSprite(look.sprite, look.size, look.swaps);
        flat.material = flat.material.clone(); // its own copy, so it can flash red
        flat.position.set(enemy.x, groundY(enemy.x, enemy.y), enemy.y);
        scene.add(flat);
        enemySprites.set(enemy.id, { sprite: flat, shadow: sceneShadow(look.size), x: enemy.x, y: enemy.y, flash: 0 });
      }
      const e = enemySprites.get(enemy.id);
      e.x = enemy.x;
      e.y = enemy.y;
      if (enemy.hurt) {
        e.flash = 0.2;
        enemy.hurt = false;
      }
    }
    for (const [id, e] of enemySprites) {
      if (!stillHere.has(id)) {
        scene.remove(e.sprite);
        scene.remove(e.shadow);
        enemySprites.delete(id);
      }
    }
  }

  // ----- Animation loop -----

  const clock = new THREE.Clock();
  let lastWidth = 0;
  let lastHeight = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width !== lastWidth || height !== lastHeight) {
      renderer.setSize(RENDER_WIDTH, Math.round((RENDER_WIDTH * height) / width), false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      lastWidth = width;
      lastHeight = height;
    }
    if (target === null || !looks) return;

    looks.water.offset.x = time * 0.03;
    seaTexture.offset.x = time * 0.03;

    // Glide to your square with a hop (or bob gently while swimming)
    const position = player.position;
    const distance = Math.hypot(target.x - position.x, target.z - position.z);
    const amount = 1 - Math.exp(-dt * 14);
    position.x += (target.x - position.x) * amount;
    position.z += (target.z - position.z) * amount;
    const ground = groundY(position.x, position.z);
    if (inBoat) {
      // Sailing! Stand in the boat as it bobs on the waves
      boat.visible = true;
      boat.position.set(position.x, WATER_TOP + Math.sin(time * 2) * 0.03, position.z);
      boat.rotation.y = facing === "up" || facing === "down" ? Math.PI / 2 : 0;
      boat.rotation.z = Math.sin(time * 1.5) * 0.05;
      position.y = WATER_TOP + 0.12 + Math.sin(time * 2) * 0.03;
      ripple.visible = true;
      ripple.position.set(position.x, WATER_TOP + 0.03, position.z);
      ripple.scale.setScalar(1.6 + Math.sin(time * 4) * 0.1);
      playerShadow.visible = false;
    } else if (swimming) {
      boat.visible = false;
      // Sink in up to your neck, so only your head sticks out
      position.y = WATER_TOP - 0.42 + Math.sin(time * 4) * 0.03;
      ripple.visible = true;
      ripple.position.set(position.x, WATER_TOP + 0.03, position.z);
      ripple.scale.setScalar(1 + Math.sin(time * 4) * 0.1);
      playerShadow.visible = false;
    } else {
      boat.visible = false;
      position.y = ground + Math.sin(Math.min(distance, 1) * Math.PI) * 0.3;
      ripple.visible = false;
      playerShadow.visible = true;
      playerShadow.position.set(position.x, ground + 0.03, position.z);
    }
    ghost.position.copy(position);
    ghost.visible = !swimming || inBoat;

    // Enemies glide and wobble; they flash red when hit
    for (const e of enemySprites.values()) {
      const p = e.sprite.position;
      p.x += (e.x - p.x) * amount;
      p.z += (e.y - p.z) * amount;
      const g = groundY(p.x, p.z);
      p.y = g + Math.abs(Math.sin(time * 6 + e.x)) * 0.06;
      e.shadow.position.set(p.x, g + 0.03, p.z);
      e.flash = Math.max(0, e.flash - dt);
      e.sprite.material.color.set(e.flash > 0 ? 0xff6060 : 0xffffff);
    }

    // The spirit floats up and down
    if (spirit) spirit.position.set(mountain.x, topOf(heightAt(mountain.x, mountain.y)) + 0.7 + Math.sin(time * 2) * 0.12, mountain.y);

    // Rifts spin, things you hit shake
    for (const r of Object.values(riftSprites)) {
      if (!r.closed) r.sprite.material.rotation = time * 1.5;
    }
    for (const flat of things.values()) {
      const shake = flat.userData.shake || 0;
      if (shake > 0) {
        flat.userData.shake = Math.max(0, shake - dt);
        flat.material.rotation = Math.sin(time * 60) * shake * 0.5;
      } else if (flat.userData.sways) {
        flat.material.rotation = Math.sin(time * 1.2 + flat.userData.phase) * 0.035; // swaying in the breeze
      }
    }

    // Hide trees and rocks far from the camera, so the game runs fast even in huge lands
    cullTimer -= dt;
    if (cullTimer <= 0) {
      cullTimer = 0.4;
      for (const [key, flat] of things) {
        const near = Math.abs(flat.position.x - position.x) < 22 && Math.abs(flat.position.z - position.z) < 20;
        flat.visible = near;
        if (near && flat.userData.shake === undefined) flat.material.color.setScalar(spriteLight); // darker at night
        const blob = thingShadows.get(key);
        if (blob) blob.visible = near;
      }
    }

    // Cloud shadows drift across the land
    for (const cloud of clouds) {
      cloud.position.x += dt * 0.6;
      if (cloud.position.x > size + 10) cloud.position.x = -10;
    }

    // The magic in the air moves differently in each area
    if (sparkles) {
      const kind = sparkles.userData.kind;
      for (let i = 0; i < sparklePositions.length / 3; i++) {
        if (kind === "embers") {
          sparklePositions[i * 3 + 1] += dt * 0.8; // embers float up
        } else if (kind === "fireflies" || kind === "butterflies") {
          sparklePositions[i * 3] += Math.sin(time * 2 + i) * dt * 0.6; // flutter about
          sparklePositions[i * 3 + 1] += Math.cos(time * 3 + i * 2) * dt * 0.3;
        } else {
          sparklePositions[i * 3 + 1] += dt * 0.15; // pollen drifts up slowly
          sparklePositions[i * 3] += dt * 0.1;
        }
        if (sparklePositions[i * 3 + 1] > 4) sparklePositions[i * 3 + 1] = 0;
        if (sparklePositions[i * 3 + 1] < 0) sparklePositions[i * 3 + 1] = 4;
      }
      sparkles.geometry.attributes.position.needsUpdate = true;
      sparkles.position.set(position.x, Math.max(ground, 0), position.z);
      if (kind === "fireflies" && !dayNight) sparkles.material.opacity = 0.6 + Math.sin(time * 4) * 0.4; // they blink!
    }

    // Windmill sails spin
    for (const sail of sails) sail.rotation.z += dt * 1.2;

    // Villagers glide to their squares
    for (const v of villagers.values()) {
      v.sprite.material.color.setScalar(spriteLight);
      const p = v.sprite.position;
      p.x += (v.x - p.x) * amount * 0.5;
      p.z += (v.y - p.z) * amount * 0.5;
      const g = groundY(p.x, p.z);
      p.y = g + Math.abs(Math.sin(time * 5 + v.x * 3)) * 0.05;
      v.shadow.position.set(p.x, g + 0.03, p.z);
    }

    // Day and night: the light, sky and fog slowly change colour
    if (dayNight) {
      const day = (Math.cos((time / DAY_LENGTH) * Math.PI * 2) + 1) / 2; // 1 = noon, 0 = midnight
      skyLight.intensity = 0.25 + day * 0.55;
      sun.intensity = 0.1 + day * 0.75;
      const tint = dayColour.clone().lerp(nightColour, 1 - day);
      scene.background = tint;
      scene.fog.color.copy(tint);
      if (sky) sky.material.color.setScalar(0.3 + day * 0.7);
      // Windows look like dark glass by day, and glow warmly at night
      windowLook.color.set(0x4a6a8a).lerp(new THREE.Color(0xffd890), Math.min(1, (1 - day) * 1.6));
      if (sparkles) sparkles.material.opacity = Math.max(0, 0.8 - day * 1.2) * (0.6 + Math.sin(time * 4) * 0.4);
      timeOfDay = day;
      // Flat sprites don't notice the light, so we darken them ourselves at night
      spriteLight = 0.4 + day * 0.6;
      player.material.color.setScalar(0.55 + day * 0.45); // you stay a bit easier to see
    }

    // Wizards bob gently (unless they're knocked out)
    for (const flat of wizardSprites.values()) {
      const base = topOf(heightAt(flat.userData.x, flat.userData.y));
      flat.position.set(flat.userData.x, base + (flat.userData.out ? 0 : Math.abs(Math.sin(time * 2 + flat.userData.x)) * 0.05), flat.userData.y);
    }

    // Magic bolts fly in an arc, then burst
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.userData.life += dt / 0.3;
      const t = Math.min(1, b.userData.life);
      b.position.lerpVectors(b.userData.from, b.userData.to, t);
      b.position.y += Math.sin(t * Math.PI) * 0.8;
      if (t >= 1) {
        burst(b.userData.to.x, b.userData.to.z, b.userData.hex, 8);
        scene.remove(b);
        bolts.splice(i, 1);
      }
    }

    // Weapon flashes fade away
    for (let i = slashes.length - 1; i >= 0; i--) {
      const s = slashes[i];
      s.userData.life -= dt;
      s.material.opacity = Math.max(0, s.userData.life / 0.18);
      if (s.userData.life <= 0) {
        scene.remove(s);
        slashes.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const bit = particles[i];
      bit.userData.life -= dt;
      bit.userData.velocity.y -= 7 * dt;
      bit.position.addScaledVector(bit.userData.velocity, dt);
      bit.scale.setScalar(Math.max(bit.userData.life / 0.7, 0.01));
      if (bit.userData.life <= 0) {
        scene.remove(bit);
        bit.geometry.dispose();
        bit.material.dispose();
        particles.splice(i, 1);
      }
    }

    // The camera follows you
    cameraTarget.lerp(new THREE.Vector3(position.x, Math.max(ground, WATER_TOP), position.z), Math.min(1, dt * 5));
    camera.position.set(cameraTarget.x, cameraTarget.y + 10, cameraTarget.z + 12.5);
    camera.lookAt(cameraTarget.x, cameraTarget.y + 0.3, cameraTarget.z);
    if (sky) sky.position.copy(camera.position);
    sun.position.set(cameraTarget.x - 6, cameraTarget.y + 12, cameraTarget.z + 5);
    sun.target.position.copy(cameraTarget);

    renderer.render(scene, camera);
  }
  animate();

  return {
    load: load,
    sync: sync,
    setTemple: setTemple,
    setRift: setRift,
    addThing: addThing,
    hitThing: hitThing,
    removeThing: removeThing,
    slash: slash,
    poof: poof,
    syncWizards: syncWizards,
    bolt: bolt,
    setBuilding: setBuilding,
    removeBuilding: removeBuilding,
    celebrate: celebrate,
    syncVillagers: syncVillagers,
    setDayNight: setDayNight,
    isNight: () => timeOfDay < 0.3,
    burst: burst,
  };
}
