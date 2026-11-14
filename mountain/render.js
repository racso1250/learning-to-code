// Drawing Pinecrest: 3D mountains with flat 2D pixel-art sprites (the "HD-2D" style).
//
// Because the world goes on forever, we can't build it all at once!
// Instead we build the chunks (16 x 16 pieces) near you, and throw away
// the ones that are far behind you.

const RENDER_WIDTH = 400;   // draw small, then stretch: chunky pixels
const LEVEL = 0.5;          // how tall one step of mountain is
const VIEW_CHUNKS = 2;      // build chunks this many away from you in each direction

function topOf(height) {
  return 0.15 + height * LEVEL;
}

// ----- Pixel textures -----

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

function speckled(x, y, r) {
  return r < 0.6 ? 0 : r < 0.85 ? 1 : 2;
}

function layered(x, y, r) {
  if (y % 8 === 7) return 1;
  return r < 0.7 ? 0 : r < 0.9 ? 1 : 2;
}

function planks(x, y, r) {
  if (y % 4 === 3) return 1;
  return r < 0.8 ? 0 : 2;
}

function tiles(x, y, r) {
  if (x % 8 === 0 || y % 8 === 0) return 1;
  return r < 0.8 ? 0 : 2;
}

const waterTexture = pixelTexture(["#3a8ad0", "#4f9ee0", "#b8e4ff"], 6, function (x, y, r) {
  if ((x * 3 + y * 5) % 13 === 0 && r > 0.3) return 2;
  return r < 0.65 ? 0 : 1;
});
waterTexture.wrapS = THREE.RepeatWrapping;
waterTexture.wrapT = THREE.RepeatWrapping;

const tops = {
  grass: new THREE.MeshLambertMaterial({ map: pixelTexture(["#5fb04a", "#4e9a3c", "#77c45f"], 1, speckled) }),
  path: new THREE.MeshLambertMaterial({ map: pixelTexture(["#b08a5a", "#9a7448", "#c49e6a"], 2, speckled) }),
  rock: new THREE.MeshLambertMaterial({ map: pixelTexture(["#8a8794", "#77737f", "#a09daa"], 3, speckled) }),
  snow: new THREE.MeshLambertMaterial({ map: pixelTexture(["#f4f8fc", "#dfe8f2", "#ffffff"], 4, speckled) }),
  temple: new THREE.MeshLambertMaterial({ map: pixelTexture(["#e8dcc0", "#b8a888", "#f6eed8"], 5, tiles) }),
  water: new THREE.MeshLambertMaterial({ map: waterTexture }),
};
const sideLooks = {
  low: new THREE.MeshLambertMaterial({ map: pixelTexture(["#8a6a44", "#6f5232", "#a07c50"], 7, layered) }),
  high: new THREE.MeshLambertMaterial({ map: pixelTexture(["#77737f", "#5f5b66", "#8d8994"], 8, layered) }),
  temple: new THREE.MeshLambertMaterial({ map: pixelTexture(["#d8ccb0", "#a89878", "#e8dcc0"], 9, layered) }),
};
const wallLook = new THREE.MeshLambertMaterial({ map: pixelTexture(["#a87a4a", "#8a5e34", "#c08c58"], 10, planks) });
const pillarLook = new THREE.MeshLambertMaterial({ map: pixelTexture(["#e8dcc0", "#c8b898", "#f8f0e0"], 11, layered) });
const goldLook = new THREE.MeshLambertMaterial({ color: 0xf6d04a, emissive: 0x6a5010 });
const stoneLook = new THREE.MeshLambertMaterial({ map: pixelTexture(["#b8b4c0", "#9a96a4", "#cfcbd6"], 13, tiles) });
const windowLook = new THREE.MeshBasicMaterial({ color: 0xffe08a }); // "Basic" = glows

// How each level of home looks: 1 = cottage, 2 = farmhouse, 3 = lodge, 4 = manor, 5 = castle
const homeStyles = [
  { width: 0.9, height: 1.0, roofTiers: 3, roof: 0x3f8a4a, windows: 1, chimney: false, stone: false, towers: false },
  { width: 1.3, height: 1.1, roofTiers: 3, roof: 0xb03a2a, windows: 2, chimney: true, stone: false, towers: false },
  { width: 1.5, height: 1.4, roofTiers: 4, roof: 0x6a3a1a, windows: 2, chimney: true, stone: false, towers: false },
  { width: 1.6, height: 1.8, roofTiers: 4, roof: 0x2f5fa8, windows: 3, chimney: true, stone: true, towers: false },
  { width: 1.6, height: 2.2, roofTiers: 5, roof: 0x7a3aa8, windows: 3, chimney: false, stone: true, towers: true },
];
const roofColours = { house: 0x8a4a2a, shop: 0xc0392b, tom: 0x2f6fb0, cottage: 0x3f8a4a, home: 0x3f8a4a };
const roofLooks = {};
for (const type of Object.keys(roofColours)) {
  roofLooks[type] = new THREE.MeshLambertMaterial({ map: pixelTexture(["#ffffff", "#cccccc", "#e6e6e6"], 12, planks), color: roofColours[type] });
}
homeStyles.forEach(function (style, i) {
  roofLooks["home" + (i + 1)] = new THREE.MeshLambertMaterial({ map: pixelTexture(["#ffffff", "#cccccc", "#e6e6e6"], 12, planks), color: style.roof });
});

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
  return sprite.map(function (row) {
    return row.split("").reverse().join("");
  });
}

function makeSprite(sprite, size, swaps) {
  const flat = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture(sprite, swaps), alphaTest: 0.5 }));
  flat.center.set(0.5, 0); // stand on its feet
  flat.scale.set(size, size, 1);
  return flat;
}

const snowyPine = { g: "#ffffff", G: "#2f6a3a" };

// A soft glow (for the campfire and the fixed temple)
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
const fireGlow = new THREE.SpriteMaterial({ map: glowTexture("rgba(255, 170, 60, 0.8)"), blending: THREE.AdditiveBlending, depthWrite: false });
const templeGlow = new THREE.SpriteMaterial({ map: glowTexture("rgba(255, 230, 120, 0.9)"), blending: THREE.AdditiveBlending, depthWrite: false });

// ----- The view -----

// getTile(x, y) is given to us by the game, and tells us what's at each square.
// getTempleStage() tells us how much of the temple has been fixed.
// getHomeLevel() tells us how fancy your home is (1 = cottage ... 5 = castle).
function createMountainView(canvas, getTile, getTempleStage, getHomeLevel) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d4f0);
  scene.fog = new THREE.Fog(0xa8d4f0, 20, 40);
  const camera = new THREE.PerspectiveCamera(30, 1.5, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x506070, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  for (const side of ["left", "bottom"]) sun.shadow.camera[side] = -16;
  for (const side of ["right", "top"]) sun.shadow.camera[side] = 16;
  scene.add(sun);
  scene.add(sun.target);

  const blockShape = new THREE.BoxGeometry(1, 1, 1);
  const shadowShape = new THREE.CircleGeometry(0.32, 10);
  const shadowLook = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

  const chunks = new Map();  // "cx,cy" -> the chunk's group of 3D things
  const oreRocks = new Map(); // "x,y" -> the ore sprite and its shadow
  const particles = [];
  const fires = [];          // campfire sprites, so they can flicker

  function heightAt(x, y) {
    return Math.max(0, getTile(x, y).height);
  }

  function addShadow(group, x, y, z, size) {
    const blob = new THREE.Mesh(shadowShape, shadowLook);
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(x, y + 0.03, z);
    blob.scale.setScalar(size);
    group.add(blob);
    return blob;
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

  // Build one 16 x 16 chunk of the world
  function buildChunk(cx, cy) {
    const group = new THREE.Group();
    const topBlocks = { grass: [], path: [], rock: [], snow: [], temple: [], water: [] };
    const sides = { low: [], high: [], temple: [] };
    const walls = [];
    const roofs = {};
    const gold = [];
    const pillars = [];
    const stoneWalls = [];
    const windows = [];
    const templeStage = getTempleStage();

    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++) {
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) {
        const tile = getTile(x, y);
        const top = topOf(tile.height);

        if (tile.kind === "water") {
          topBlocks.water.push({ x: x, y: topOf(-1) + 0.28, z: y, w: 1, h: 0.04, d: 1 });
          continue;
        }
        topBlocks[tile.kind].push({ x: x, y: top, z: y, w: 1, h: 0.04, d: 1 });

        // Only build the cliff sides you can actually see (not the ones buried underground)
        let lowest = tile.height;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          lowest = Math.min(lowest, getTile(x + dx, y + dy).height);
        }
        const sideKind = tile.kind === "temple" ? "temple" : tile.height >= 5 ? "high" : "low";
        for (let level = Math.max(lowest, -1) + 1; level <= tile.height; level++) {
          sides[sideKind].push({ x: x, y: topOf(level) - LEVEL / 2, z: y, w: 1, h: LEVEL, d: 1 });
        }

        // Your home looks different depending on how much you've upgraded it
        if (tile.building === "home") {
          const level = getHomeLevel();
          const style = homeStyles[level - 1];
          const wallBlocks = style.stone ? stoneWalls : walls;
          wallBlocks.push({ x: x, y: top + style.height / 2, z: y, w: style.width, h: style.height, d: style.width * 0.9 });
          const roof = roofs["home" + level] || (roofs["home" + level] = []);
          let roofY = top + style.height + 0.1;
          let roofSize = style.width + 0.2;
          for (let tier = 0; tier < style.roofTiers; tier++) {
            roof.push({ x: x, y: roofY, z: y, w: roofSize, h: 0.22, d: roofSize * 0.9 });
            roofY += 0.2;
            roofSize *= 0.7;
          }
          if (style.chimney) {
            wallBlocks.push({ x: x + style.width * 0.3, y: top + style.height + 0.45, z: y - 0.1, w: 0.2, h: 0.7, d: 0.2 });
          }
          // Glowing windows on the front
          for (let w = 0; w < style.windows; w++) {
            const across = style.windows === 1 ? 0 : (w / (style.windows - 1) - 0.5) * style.width * 0.6;
            windows.push({ x: x + across, y: top + style.height * 0.55, z: y + style.width * 0.45 + 0.01, w: 0.16, h: 0.18, d: 0.02 });
          }
          gold.push({ x: x, y: top + 0.25, z: y + style.width * 0.45 + 0.01, w: 0.22, h: 0.45, d: 0.02 }); // the door
          // A castle has a tower on each corner, with golden tops
          if (style.towers) {
            for (const [tx, tz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
              const towerX = x + tx * style.width * 0.5;
              const towerZ = y + tz * style.width * 0.45;
              stoneWalls.push({ x: towerX, y: top + 1.45, z: towerZ, w: 0.4, h: 2.9, d: 0.4 });
              gold.push({ x: towerX, y: top + 3.0, z: towerZ, w: 0.5, h: 0.2, d: 0.5 });
            }
          }
        } else if (tile.building && tile.building !== "pillar") {
          // Other buildings: wooden walls with a stepped roof
          walls.push({ x: x, y: top + 0.5, z: y, w: 0.9, h: 1, d: 0.9 });
          const roof = roofs[tile.building] || (roofs[tile.building] = []);
          roof.push({ x: x, y: top + 1.1, z: y, w: 1.1, h: 0.25, d: 1.1 });
          roof.push({ x: x, y: top + 1.32, z: y, w: 0.75, h: 0.22, d: 0.75 });
          roof.push({ x: x, y: top + 1.5, z: y, w: 0.4, h: 0.18, d: 0.4 });
        }

        // Temple pillars: broken stumps that grow taller as you fix the temple
        if (tile.building === "pillar") {
          const height = 0.4 + templeStage * 0.5;
          pillars.push({ x: x, y: top + height / 2, z: y, w: 0.5, h: height, d: 0.5 });
          if (templeStage >= 4) {
            gold.push({ x: x, y: top + height + 0.08, z: y, w: 0.65, h: 0.16, d: 0.65 });
          }
        }
        if (tile.thing === "altar") {
          pillars.push({ x: x, y: top + 0.3, z: y, w: 0.8, h: 0.6, d: 0.8 });
          if (templeStage >= 4) {
            gold.push({ x: x, y: top + 0.65, z: y, w: 0.5, h: 0.1, d: 0.5 });
            const glow = new THREE.Sprite(templeGlow);
            glow.position.set(x, top + 1.2, y);
            glow.scale.setScalar(4);
            group.add(glow);
          }
        }

        // Flat sprites standing on top
        if (tile.thing === "tree") {
          const tree = makeSprite(pineSprite, 1.5, tile.kind === "snow" ? snowyPine : null);
          tree.position.set(x, top, y);
          group.add(tree);
          addShadow(group, x, top, y, 1.3);
        } else if (tile.thing === "ore") {
          const ore = ores[tile.ore];
          const rock = makeSprite(oreSprite, 1, { c: ore.colours[0], d: ore.colours[1] });
          rock.position.set(x, top, y);
          group.add(rock);
          oreRocks.set(x + "," + y, { sprite: rock, shadow: addShadow(group, x, top, y, 1), group: group });
        } else if (tile.thing === "campfire") {
          const fire = makeSprite(campfireSprite, 1);
          fire.position.set(x, top, y);
          group.add(fire);
          fires.push(fire);
          const glow = new THREE.Sprite(fireGlow);
          glow.position.set(x, top + 0.4, y);
          glow.scale.setScalar(3);
          group.add(glow);
        } else if (tile.thing === "sign") {
          const sign = makeSprite(signSprite, 0.9);
          sign.position.set(x, top, y);
          group.add(sign);
        }
      }
    }

    for (const kind of Object.keys(topBlocks)) addBlocks(group, topBlocks[kind], tops[kind], false);
    for (const kind of Object.keys(sides)) addBlocks(group, sides[kind], sideLooks[kind], true);
    addBlocks(group, walls, wallLook, true);
    for (const type of Object.keys(roofs)) addBlocks(group, roofs[type], roofLooks[type], true);
    addBlocks(group, pillars, pillarLook, true);
    addBlocks(group, gold, goldLook, true);
    addBlocks(group, stoneWalls, stoneLook, true);
    addBlocks(group, windows, windowLook, false);

    scene.add(group);
    return group;
  }

  function removeChunk(key) {
    const group = chunks.get(key);
    scene.remove(group);
    group.traverse(function (thing) {
      if (thing.isInstancedMesh) thing.dispose();
    });
    for (const [oreKey, ore] of oreRocks) {
      if (ore.group === group) oreRocks.delete(oreKey);
    }
    for (let i = fires.length - 1; i >= 0; i--) {
      if (fires[i].parent === group) fires.splice(i, 1);
    }
    chunks.delete(key);
  }

  // Build nearby chunks (a couple per frame, so the game doesn't stutter)
  // and throw away chunks that are far away
  function updateChunks(px, py) {
    const pcx = Math.floor(px / CHUNK);
    const pcy = Math.floor(py / CHUNK);
    let built = 0;
    for (let r = 0; r <= VIEW_CHUNKS; r++) {
      for (let cy = pcy - r; cy <= pcy + r; cy++) {
        for (let cx = pcx - r; cx <= pcx + r; cx++) {
          const key = cx + "," + cy;
          if (!chunks.has(key) && built < 2) {
            chunks.set(key, buildChunk(cx, cy));
            built++;
          }
        }
      }
    }
    for (const key of Array.from(chunks.keys())) {
      const [cx, cy] = key.split(",").map(Number);
      if (Math.abs(cx - pcx) > VIEW_CHUNKS + 1 || Math.abs(cy - pcy) > VIEW_CHUNKS + 1) {
        removeChunk(key);
      }
    }
  }

  // Rebuild the chunk at a square (for example, when the temple changes)
  function rebuildAt(x, y) {
    const key = Math.floor(x / CHUNK) + "," + Math.floor(y / CHUNK);
    if (chunks.has(key)) removeChunk(key);
  }

  function burst(x, y, hex, count) {
    for (let i = 0; i < count; i++) {
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: hex }));
      bit.position.set(x, topOf(heightAt(x, y)) + 0.35, y);
      bit.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
      bit.userData.life = 0.7;
      scene.add(bit);
      particles.push(bit);
    }
  }

  // A hit with the pickaxe: a few chips fly off and the rock shakes
  function hitOre(x, y, hex) {
    burst(x, y, hex, 5);
    const ore = oreRocks.get(x + "," + y);
    if (ore) ore.sprite.userData.shake = 0.25;
  }

  // The ore is all dug up!
  function removeOre(x, y, hex) {
    burst(x, y, hex, 16);
    const ore = oreRocks.get(x + "," + y);
    if (!ore) return;
    ore.group.remove(ore.sprite);
    ore.group.remove(ore.shadow);
    oreRocks.delete(x + "," + y);
  }

  // ----- The player and villagers -----

  const player = makeSprite(kidFront, 1);
  scene.add(player);
  const ghost = makeSprite(kidFront, 1);
  ghost.material = ghost.material.clone();
  ghost.material.depthTest = false; // a faint copy you can see through mountains
  ghost.material.transparent = true;
  ghost.material.opacity = 0.35;
  ghost.renderOrder = 10;
  scene.add(ghost);
  const playerShadow = new THREE.Mesh(shadowShape, shadowLook);
  playerShadow.rotation.x = -Math.PI / 2;
  scene.add(playerShadow);
  let facing = null;
  let target = null;
  const cameraTarget = new THREE.Vector3();

  const villagerSprites = {};
  function addVillager(id, sprite, x, y) {
    const flat = makeSprite(sprite, 1);
    flat.userData = { x: x, y: y };
    scene.add(flat);
    villagerSprites[id] = flat;
    const blob = new THREE.Mesh(shadowShape, shadowLook);
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(x, topOf(heightAt(x, y)) + 0.03, y);
    scene.add(blob);
  }

  // Make the picture match the game
  function sync(state) {
    if (target === null) {
      target = new THREE.Vector3(state.x, 0, state.y);
      player.position.set(state.x, topOf(heightAt(state.x, state.y)), state.y);
      cameraTarget.copy(player.position);
    }
    // Teleported far away (like with the homing feather)? Jump straight there.
    if (Math.hypot(state.x - target.x, state.y - target.z) > 3) {
      player.position.set(state.x, topOf(heightAt(state.x, state.y)), state.y);
      cameraTarget.copy(player.position);
    }
    target.set(state.x, 0, state.y);
    if (state.facing !== facing) {
      facing = state.facing;
      let sprite = kidFront;
      if (facing === "up") sprite = kidBack;
      if (facing === "left") sprite = mirror(kidFront);
      player.material.map = spriteTexture(sprite);
      ghost.material.map = player.material.map;
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
    if (target === null) return;

    updateChunks(target.x, target.z);
    waterTexture.offset.x = time * 0.03;

    // Glide to your square with a little hop
    const position = player.position;
    const distance = Math.hypot(target.x - position.x, target.z - position.z);
    const amount = 1 - Math.exp(-dt * 14);
    position.x += (target.x - position.x) * amount;
    position.z += (target.z - position.z) * amount;
    const ground = topOf(heightAt(Math.round(position.x), Math.round(position.z)));
    position.y = ground + Math.sin(Math.min(distance, 1) * Math.PI) * 0.3;
    ghost.position.copy(position);
    playerShadow.position.set(position.x, ground + 0.03, position.z);

    // Villagers bob as if humming a tune
    for (const flat of Object.values(villagerSprites)) {
      flat.position.set(flat.userData.x, topOf(heightAt(flat.userData.x, flat.userData.y)) + Math.abs(Math.sin(time * 2.5)) * 0.05, flat.userData.y);
    }

    // Campfires flicker, ore rocks shake when you hit them
    for (const fire of fires) {
      fire.scale.set(1 + Math.sin(time * 13) * 0.05, 1 + Math.sin(time * 17) * 0.08, 1);
    }
    for (const ore of oreRocks.values()) {
      const shake = ore.sprite.userData.shake || 0;
      if (shake > 0) {
        ore.sprite.userData.shake = Math.max(0, shake - dt);
        ore.sprite.material.rotation = Math.sin(time * 60) * shake * 0.5;
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

    // Camera follows from a distance, looking down at an angle
    cameraTarget.lerp(position, Math.min(1, dt * 5));
    camera.position.set(cameraTarget.x, cameraTarget.y + 10, cameraTarget.z + 12.5);
    camera.lookAt(cameraTarget.x, cameraTarget.y + 0.3, cameraTarget.z);
    sun.position.set(cameraTarget.x - 6, cameraTarget.y + 12, cameraTarget.z + 5);
    sun.target.position.copy(cameraTarget);

    renderer.render(scene, camera);
  }
  animate();

  return { sync: sync, addVillager: addVillager, hitOre: hitOre, removeOre: removeOre, rebuildAt: rebuildAt };
}
