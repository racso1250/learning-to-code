// 3D drawing for The Undying Lands, using Three.js.
//
// The "16-bit" look comes from three tricks:
//   1. Every texture is tiny (16 x 16 pixels) and never smoothed.
//   2. People and things are built from cubes, one for each pixel of their sprite.
//   3. The whole picture is drawn small (480 pixels wide) and then stretched
//      up to fill the screen, so you see big chunky pixels.

const VOXEL = 1 / 8;
const RENDER_WIDTH = 480;

const voxelShape = new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL * 2);
const blockShape = new THREE.BoxGeometry(1, 1, 1);
const plainLook = new THREE.MeshLambertMaterial({ color: 0xffffff });

// How high the top of each kind of ground you can walk on is
const groundHeight = {
  "~": -0.45,
  "S": -0.45,
  ":": -0.08,
  ".": 0,
  ",": 0,
  "=": 0.02,
  "n": 0.35,
  "D": 0.05,
};

// A "random" number from 0 to 1 that's always the same for the same inputs
function fixedRandom(a, b, c) {
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

// ----- Pixel textures -----

// Paint a tiny 16x16 texture. "paint" picks a colour for each pixel.
function pixelTexture(seed, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const pen = canvas.getContext("2d");
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      pen.fillStyle = paint(x, y, fixedRandom(x, y, seed));
      pen.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; // keep pixels sharp and chunky
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

const textures = {
  grass: pixelTexture(1, function (x, y, r) {
    return r < 0.15 ? "#76c95c" : r < 0.3 ? "#4f9a3a" : "#62b34b";
  }),
  flowers: pixelTexture(2, function (x, y, r) {
    return r < 0.2 ? "#7ccf60" : "#66b84e";
  }),
  sand: pixelTexture(3, function (x, y, r) {
    return r < 0.2 ? "#f3e6bb" : r < 0.35 ? "#d6c086" : "#e8d7a2";
  }),
  road: pixelTexture(4, function (x, y, r) {
    const offset = Math.floor(y / 4) % 2 === 0 ? 0 : 2;
    if (y % 4 === 3 || (x + offset) % 4 === 3) return "#8f8f9e";
    return r < 0.3 ? "#cfd0db" : "#b9bac8";
  }),
  wall: pixelTexture(5, function (x, y, r) {
    const offset = Math.floor(y / 4) % 2 === 0 ? 0 : 4;
    if (y % 4 === 3 || (x + offset) % 8 === 7) return "#c4c6d4";
    return r < 0.2 ? "#ffffff" : "#eef0f6";
  }),
  dock: pixelTexture(6, function (x, y, r) {
    if (y % 4 === 3) return "#5a3a1c";
    return r < 0.3 ? "#9a6a38" : "#8b5a2b";
  }),
  water: pixelTexture(7, function (x, y, r) {
    if ((x + y * 3) % 11 === 0 && r > 0.4) return "#9fd0ff";
    return r < 0.3 ? "#4a8ee0" : "#3b7fd0";
  }),
  leaves: pixelTexture(8, function (x, y, r) {
    return r < 0.2 ? "#ffffff" : r < 0.4 ? "#b0b0b0" : "#dcdcdc";
  }),
  bark: pixelTexture(9, function (x, y, r) {
    return x % 4 === 0 || r < 0.15 ? "#4c3219" : "#6b4a2b";
  }),
  rock: pixelTexture(10, function (x, y, r) {
    if (r < 0.12) return "#5f5a66";
    return r < 0.4 ? "#8d8794" : "#7a7482";
  }),
  snow: pixelTexture(11, function (x, y, r) {
    return r < 0.2 ? "#dde8f5" : "#ffffff";
  }),
  roof: pixelTexture(12, function (x, y, r) {
    if (y % 4 === 3) return "#24506e";
    return (x + Math.floor(y / 4) * 2) % 4 === 0 ? "#2f6a90" : "#3a80a8";
  }),
};

// The water texture repeats and slides along to look like it's moving
textures.water.wrapS = THREE.RepeatWrapping;
textures.water.wrapT = THREE.RepeatWrapping;

// One material ("look") for each texture
const looks = {};
for (const name of Object.keys(textures)) {
  looks[name] = new THREE.MeshLambertMaterial({ map: textures[name] });
}
const goldLook = new THREE.MeshLambertMaterial({ color: 0xf2c443 });
const glowLook = new THREE.MeshBasicMaterial({ color: 0xffe9a0 }); // "Basic" ignores light, so it glows

// A soft round glow, used around lanterns and the tower top
function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const pen = canvas.getContext("2d");
  const gradient = pen.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255, 236, 170, 0.9)");
  gradient.addColorStop(1, "rgba(255, 236, 170, 0)");
  pen.fillStyle = gradient;
  pen.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}
const haloLook = new THREE.SpriteMaterial({
  map: glowTexture(),
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

// ----- Cube models from sprites -----

function makeModel(sprite, size) {
  const pixels = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (sprite[row][col] !== ".") {
        pixels.push({ row: row, col: col, letter: sprite[row][col] });
      }
    }
  }

  const cubes = new THREE.InstancedMesh(voxelShape, plainLook, pixels.length);
  const placer = new THREE.Object3D();
  const colour = new THREE.Color();
  pixels.forEach(function (pixel, i) {
    placer.position.set((pixel.col - 3.5) * VOXEL, (7 - pixel.row) * VOXEL + VOXEL / 2, 0);
    placer.updateMatrix();
    cubes.setMatrixAt(i, placer.matrix);
    cubes.setColorAt(i, colour.set(colours[pixel.letter]));
  });
  cubes.castShadow = true;
  cubes.frustumCulled = false;

  const model = new THREE.Group();
  model.add(cubes);
  model.scale.setScalar(size);
  return model;
}

// ----- The view -----

function createWorldView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  // Far-away things fade into a warm, golden haze
  scene.fog = new THREE.Fog(0xf3ead8, 16, 34);

  const camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 200);

  // Golden light, like a never-ending summer evening
  scene.add(new THREE.HemisphereLight(0xfff4d6, 0x5a7a4a, 0.85));
  const sun = new THREE.DirectionalLight(0xffe2a0, 0.75);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  scene.add(sun);
  scene.add(sun.target);

  // ----- The sky: a giant ball around everything, blue at the top, golden at the bottom -----
  const skyPaint = document.createElement("canvas");
  skyPaint.width = 4;
  skyPaint.height = 64;
  const skyPen = skyPaint.getContext("2d");
  const skyGradient = skyPen.createLinearGradient(0, 0, 0, 64);
  skyGradient.addColorStop(0, "#4f9be0");
  skyGradient.addColorStop(0.45, "#a9d4f5");
  skyGradient.addColorStop(0.5, "#f3ead8");
  skyGradient.addColorStop(1, "#f3ead8");
  skyPen.fillStyle = skyGradient;
  skyPen.fillRect(0, 0, 4, 64);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 16, 12),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyPaint), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // A huge sea that stretches to the horizon
  const seaTexture = textures.water.clone();
  seaTexture.needsUpdate = true;
  seaTexture.repeat.set(400, 400);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ map: seaTexture })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(32, -0.47, 24);
  scene.add(sea);

  // ----- Fluffy clouds made of boxes, drifting across the sky -----
  const clouds = [];
  const cloudLook = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x666666 });
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(fixedRandom(i, 1, 1) * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(blockShape, cloudLook);
      puff.scale.set(1.5 + fixedRandom(i, p, 2) * 2, 0.6 + fixedRandom(i, p, 3) * 0.6, 1.2 + fixedRandom(i, p, 4) * 1.5);
      puff.position.set(p * 1.3 - puffs * 0.6, fixedRandom(i, p, 5) * 0.4, fixedRandom(i, p, 6) * 1.2);
      puff.castShadow = true;
      cloud.add(puff);
    }
    cloud.position.set(fixedRandom(i, 0, 7) * 100 - 20, 9 + fixedRandom(i, 0, 8) * 3, fixedRandom(i, 0, 9) * 60 - 6);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Magic sparkles floating in the air
  const SPARKLES = 80;
  const sparklePositions = new Float32Array(SPARKLES * 3);
  const sparkleShape = new THREE.BufferGeometry();
  sparkleShape.setAttribute("position", new THREE.BufferAttribute(sparklePositions, 3));
  const sparkles = new THREE.Points(sparkleShape, new THREE.PointsMaterial({ color: 0xfff6c8, size: 0.09 }));
  scene.add(sparkles);
  for (let i = 0; i < SPARKLES; i++) {
    sparklePositions[i * 3] = (Math.random() - 0.5) * 20;
    sparklePositions[i * 3 + 1] = Math.random() * 3;
    sparklePositions[i * 3 + 2] = (Math.random() - 0.5) * 16;
  }

  let ground = [];
  let tallness = [];            // how tall the thing on each square is (for the camera)
  let player = null;
  const characters = new Map(); // id -> model
  const pickups = new Map();    // key -> model
  const particles = [];
  const cameraTarget = new THREE.Vector3();
  let cameraLift = 0;
  let firstSync = true;

  function heightAt(x, y) {
    if (y < 0 || y >= ground.length || x < 0 || x >= ground[0].length) {
      return 0;
    }
    return groundHeight[ground[y][x]] || 0;
  }

  function tallAt(x, y) {
    if (y < 0 || y >= tallness.length || x < 0 || x >= tallness[0].length) {
      return 0;
    }
    return tallness[y][x];
  }

  // Make one InstancedMesh holding many blocks that share a look.
  // Each block is { x, y, z, w, h, d, colour (optional) }
  function addBlocks(blocks, look, shadows) {
    if (blocks.length === 0) {
      return;
    }
    const mesh = new THREE.InstancedMesh(blockShape, look, blocks.length);
    const placer = new THREE.Object3D();
    const colour = new THREE.Color();
    const anyColours = blocks.some(function (b) { return b.colour; });
    blocks.forEach(function (b, i) {
      placer.position.set(b.x, b.y, b.z);
      placer.scale.set(b.w, b.h, b.d);
      placer.updateMatrix();
      mesh.setMatrixAt(i, placer.matrix);
      // If some blocks have their own colour, the rest must be white (not black!)
      if (anyColours) {
        mesh.setColorAt(i, colour.set(b.colour || "#ffffff"));
      }
    });
    mesh.castShadow = shadows !== false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // Put a glowing lamp with a soft halo at a spot
  function addLamp(x, y, z, size) {
    const lamp = new THREE.Mesh(blockShape, glowLook);
    lamp.scale.setScalar(size);
    lamp.position.set(x, y, z);
    scene.add(lamp);
    const halo = new THREE.Sprite(haloLook);
    halo.scale.setScalar(size * 6);
    halo.position.set(x, y, z);
    scene.add(halo);
  }

  // Build all the land, sea, mountains, buildings, trees and plants
  function build(groundMap) {
    ground = groundMap;
    const kinds = {
      grass: [], flowers: [], sand: [], road: [], wall: [], dock: [], water: [],
      leaves: [], bark: [], rock: [], snow: [], roof: [],
    };
    const gold = [];
    const tufts = [];
    const petals = [];
    const stems = [];
    tallness = [];

    for (let y = 0; y < ground.length; y++) {
      tallness.push([]);
      for (let x = 0; x < ground[y].length; x++) {
        const letter = ground[y][x];
        const top = groundHeight[letter] || 0;
        const block = { x: x, y: top - 0.5, z: y, w: 1, h: 1, d: 1 };
        const r1 = fixedRandom(x, y, 1);
        const r2 = fixedRandom(x, y, 2);
        let tall = 0;

        if (letter === "~" || letter === "S") {
          kinds.water.push(block);
          if (letter === "S") {
            const ship = makeModel(shipSprite, 2.6);
            ship.position.set(x, -0.5, y);
            scene.add(ship);
          }
        } else if (letter === ":") {
          kinds.sand.push(block);
          if (r1 < 0.04) {
            kinds.rock.push({ x: x + r2 * 0.4 - 0.2, y: 0, z: y, w: 0.3, h: 0.2, d: 0.25 });
          }
        } else if (letter === "=") {
          kinds.road.push(block);
        } else if (letter === "D") {
          kinds.water.push({ x: x, y: -0.95, z: y, w: 1, h: 1, d: 1 });
          kinds.dock.push({ x: x, y: top - 0.08, z: y, w: 1, h: 0.16, d: 0.9 });
        } else if (letter === "#") {
          // White stone wall with a thin gold stripe near the top
          kinds.road.push(block);
          kinds.wall.push({ x: x, y: 0.6, z: y, w: 1, h: 1.2, d: 1 });
          gold.push({ x: x, y: 1.0, z: y, w: 1.04, h: 0.08, d: 1.04 });
          tall = 1.2;
        } else if (letter === "H") {
          // A little house: white walls and a stepped blue roof
          kinds.grass.push(block);
          kinds.wall.push({ x: x, y: 0.45, z: y, w: 0.9, h: 0.9, d: 0.9 });
          kinds.roof.push({ x: x, y: 1.0, z: y, w: 1.05, h: 0.25, d: 1.05 });
          kinds.roof.push({ x: x, y: 1.22, z: y, w: 0.7, h: 0.22, d: 0.7 });
          kinds.roof.push({ x: x, y: 1.4, z: y, w: 0.35, h: 0.18, d: 0.35 });
          gold.push({ x: x, y: 0.55, z: y + 0.46, w: 0.25, h: 0.3, d: 0.02 }); // golden door
          tall = 1.5;
        } else if (letter === "I") {
          // The tall white tower with golden bands and a glowing top
          kinds.road.push(block);
          kinds.wall.push({ x: x, y: 1.8, z: y, w: 0.8, h: 3.6, d: 0.8 });
          for (const bandHeight of [1.2, 2.4, 3.55]) {
            gold.push({ x: x, y: bandHeight, z: y, w: 0.86, h: 0.1, d: 0.86 });
          }
          gold.push({ x: x, y: 3.85, z: y, w: 0.6, h: 0.4, d: 0.6 });
          gold.push({ x: x, y: 4.2, z: y, w: 0.3, h: 0.35, d: 0.3 });
          addLamp(x, 4.55, y, 0.18);
          tall = 4;
        } else if (letter === "Y") {
          // A lantern on a post
          kinds.road.push(block);
          kinds.bark.push({ x: x, y: 0.45, z: y, w: 0.08, h: 0.9, d: 0.08, colour: "#333333" });
          addLamp(x, 0.98, y, 0.2);
        } else if (letter === "^" || letter === "*") {
          // Mountains: tall rock, with snow on the highest ones
          const height = letter === "*" ? 2.2 + r1 * 1.3 : 0.9 + r1 * 1.3;
          const snowy = letter === "*" || height > 1.8;
          const rockHeight = snowy ? height - 0.35 : height;
          kinds.rock.push({ x: x, y: rockHeight / 2 - 0.5, z: y, w: 1, h: rockHeight + 1, d: 1 });
          if (snowy) {
            kinds.snow.push({ x: x, y: height - 0.175, z: y, w: 1, h: 0.35, d: 1 });
          }
          tall = height;
        } else if (letter === "T") {
          // A tree with golden or silver-green leaves
          kinds.grass.push(block);
          const leaf = r1 < 0.5 ? "#f2d35b" : "#a8e090";
          const height = 0.8 + r2 * 0.5;
          kinds.bark.push({ x: x, y: height / 2, z: y, w: 0.25, h: height, d: 0.25 });
          kinds.leaves.push({ x: x, y: height + 0.25, z: y, w: 0.95, h: 0.7, d: 0.95, colour: leaf });
          kinds.leaves.push({ x: x, y: height + 0.75, z: y, w: 0.6, h: 0.45, d: 0.6, colour: leaf });
          tall = height + 1;
        } else if (letter === "!") {
          // A pine tree: three dark green layers getting smaller
          kinds.grass.push(block);
          kinds.bark.push({ x: x, y: 0.25, z: y, w: 0.2, h: 0.5, d: 0.2 });
          const green = r1 < 0.5 ? "#2f6b3a" : "#3b7d45";
          kinds.leaves.push({ x: x, y: 0.65, z: y, w: 0.9, h: 0.45, d: 0.9, colour: green });
          kinds.leaves.push({ x: x, y: 1.05, z: y, w: 0.65, h: 0.4, d: 0.65, colour: green });
          kinds.leaves.push({ x: x, y: 1.4, z: y, w: 0.35, h: 0.35, d: 0.35, colour: green });
          tall = 1.6;
        } else if (letter === ",") {
          // Flower meadow: little stems with coloured petals on top
          kinds.flowers.push(block);
          const petalColours = ["#ffffff", "#f2c443", "#e57bb6", "#9fc3ff"];
          for (let f = 0; f < 5; f++) {
            const fx = x + fixedRandom(x, y, f + 10) * 0.8 - 0.4;
            const fz = y + fixedRandom(x, y, f + 20) * 0.8 - 0.4;
            const height = 0.1 + fixedRandom(x, y, f + 30) * 0.1;
            stems.push({ x: fx, y: height / 2, z: fz, w: 0.03, h: height, d: 0.03 });
            petals.push({
              x: fx, y: height, z: fz, w: 0.08, h: 0.06, d: 0.08,
              colour: petalColours[Math.floor(fixedRandom(x, y, f + 40) * 4)],
            });
          }
        } else {
          // Grass (flat or a hill), with little tufts of longer grass
          kinds.grass.push(block);
          if (r1 < 0.6) {
            for (let t = 0; t < 3; t++) {
              const height = 0.1 + fixedRandom(x, y, t + 50) * 0.12;
              tufts.push({
                x: x + fixedRandom(x, y, t + 60) * 0.8 - 0.4,
                y: top + height / 2,
                z: y + fixedRandom(x, y, t + 70) * 0.8 - 0.4,
                w: 0.04, h: height, d: 0.04,
                colour: fixedRandom(x, y, t + 80) < 0.5 ? "#4f9a3a" : "#8fd46f",
              });
            }
          }
          if (r2 < 0.02) {
            kinds.rock.push({ x: x, y: top + 0.08, z: y, w: 0.3, h: 0.16, d: 0.25 });
          }
        }
        tallness[y].push(tall);
      }
    }

    for (const name of Object.keys(kinds)) {
      addBlocks(kinds[name], looks[name]);
    }
    addBlocks(gold, goldLook);
    addBlocks(tufts, plainLook, false);
    addBlocks(stems, new THREE.MeshLambertMaterial({ color: 0x3f8a3a }), false);
    addBlocks(petals, plainLook, false);
  }

  // Tell a model where to go; it glides there in animate()
  function setTarget(model, x, y) {
    if (!model.userData.target) {
      model.userData.target = new THREE.Vector3(x, 0, y);
      model.position.set(x, heightAt(x, y), y);
      model.userData.facing = 0;
    }
    model.userData.target.set(x, 0, y);
  }

  function burst(x, y, hex) {
    for (let i = 0; i < 14; i++) {
      const bit = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, 0.07),
        new THREE.MeshBasicMaterial({ color: hex })
      );
      bit.position.set(x, heightAt(x, y) + 0.3, y);
      bit.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        1 + Math.random() * 2.5,
        (Math.random() - 0.5) * 2.5
      );
      bit.userData.life = 0.8;
      scene.add(bit);
      particles.push(bit);
    }
  }

  // Make the 3D world match the game.
  //   state.player = { x, y, facingLeft }
  //   state.people = [{ id, x, y, sprite, facingLeft (optional) }]
  //   state.items  = [{ key, x, y, sprite, colour }]
  function sync(state) {
    if (player === null) {
      player = makeModel(frodoSprite, 1);
      scene.add(player);
    }
    setTarget(player, state.player.x, state.player.y);
    player.userData.facing = state.player.facingLeft ? Math.PI : 0;

    // People: add new ones. Animals face where they walk; people look at Frodo.
    for (const person of state.people) {
      if (!characters.has(person.id)) {
        const model = makeModel(person.sprite, 1);
        scene.add(model);
        characters.set(person.id, model);
      }
      const model = characters.get(person.id);
      setTarget(model, person.x, person.y);
      const facingLeft = person.facingLeft !== undefined ? person.facingLeft : state.player.x < person.x;
      model.userData.facing = facingLeft ? Math.PI : 0;
    }

    // Items: add new ones, and burst the ones that were picked up
    const stillHere = new Set();
    for (const item of state.items) {
      stillHere.add(item.key);
      if (!pickups.has(item.key)) {
        const model = makeModel(item.sprite, 0.7);
        model.scale.z = model.scale.z * 3; // chunky, not flat
        model.position.set(item.x, heightAt(item.x, item.y) + 0.15, item.y);
        model.userData.item = item;
        scene.add(model);
        pickups.set(item.key, model);
      }
    }
    for (const [key, model] of pickups) {
      if (!stillHere.has(key)) {
        burst(model.userData.item.x, model.userData.item.y, model.userData.item.colour);
        scene.remove(model);
        pickups.delete(key);
      }
    }

    if (firstSync) {
      cameraTarget.copy(player.position);
      firstSync = false;
    }
  }

  // ----- Animation loop -----
  const clock = new THREE.Clock();
  let lastWidth = 0;
  let lastHeight = 0;

  function glide(model, dt) {
    const target = model.userData.target;
    const position = model.position;
    const distance = Math.hypot(target.x - position.x, target.z - position.z);

    if (distance > 3) {
      position.x = target.x;
      position.z = target.z;
    } else {
      const amount = 1 - Math.exp(-dt * 14);
      position.x += (target.x - position.x) * amount;
      position.z += (target.z - position.z) * amount;
    }
    const hop = Math.sin(Math.min(distance, 1) * Math.PI) * 0.22;
    position.y = heightAt(Math.round(position.x), Math.round(position.z)) + hop;
    model.rotation.y += (model.userData.facing - model.rotation.y) * Math.min(1, dt * 12);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;

    // Draw small (RENDER_WIDTH pixels wide), then let CSS stretch it: chunky pixels!
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width !== lastWidth || height !== lastHeight) {
      renderer.setSize(RENDER_WIDTH, Math.round((RENDER_WIDTH * height) / width), false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      lastWidth = width;
      lastHeight = height;
    }

    // Moving water and drifting clouds
    textures.water.offset.x = time * 0.04;
    seaTexture.offset.x = time * 0.04;
    for (const cloud of clouds) {
      cloud.position.x += dt * 0.3;
      if (cloud.position.x > 90) {
        cloud.position.x = -25;
      }
    }

    if (player === null) {
      return;
    }

    glide(player, dt);
    for (const model of characters.values()) {
      glide(model, dt);
    }

    // Items spin and bob
    for (const model of pickups.values()) {
      const item = model.userData.item;
      model.rotation.y = time * 1.5 + item.x;
      model.position.y = heightAt(item.x, item.y) + 0.15 + Math.sin(time * 3 + item.y) * 0.06;
    }

    // Particles fly up, fall and shrink
    for (let i = particles.length - 1; i >= 0; i--) {
      const bit = particles[i];
      bit.userData.life -= dt;
      bit.userData.velocity.y -= 7 * dt;
      bit.position.addScaledVector(bit.userData.velocity, dt);
      bit.scale.setScalar(Math.max(bit.userData.life / 0.8, 0.01));
      if (bit.userData.life <= 0) {
        scene.remove(bit);
        bit.geometry.dispose();
        bit.material.dispose();
        particles.splice(i, 1);
      }
    }

    // Camera follows Frodo. If something tall is just in front of him
    // (like a mountain), the camera lifts up higher so you can still see him.
    cameraTarget.lerp(player.position, Math.min(1, dt * 5));
    const px = Math.round(player.userData.target.x);
    const py = Math.round(player.userData.target.z);
    const blocking = Math.max(tallAt(px, py + 1), tallAt(px, py + 2) * 0.7, tallAt(px - 1, py + 1) * 0.6, tallAt(px + 1, py + 1) * 0.6);
    const wantedLift = Math.max(0, blocking - 0.8);
    cameraLift += (wantedLift - cameraLift) * Math.min(1, dt * 3);
    camera.position.set(cameraTarget.x, cameraTarget.y + 6.5 + cameraLift * 2.5, cameraTarget.z + 6.5 - cameraLift * 1.6);
    camera.lookAt(cameraTarget.x, cameraTarget.y + 0.5, cameraTarget.z);
    sky.position.copy(camera.position);

    sun.position.set(cameraTarget.x - 5, 14, cameraTarget.z + 4);
    sun.target.position.copy(cameraTarget);

    // Sparkles drift slowly upwards around Frodo
    for (let i = 0; i < SPARKLES; i++) {
      sparklePositions[i * 3 + 1] += dt * 0.25;
      if (sparklePositions[i * 3 + 1] > 3) {
        sparklePositions[i * 3 + 1] = 0;
      }
    }
    sparkles.position.set(cameraTarget.x, 0, cameraTarget.z);
    sparkleShape.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animate();

  return { build: build, sync: sync };
}
