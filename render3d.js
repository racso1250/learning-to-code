// 3D drawing for Carpet People, using the Three.js library.
//
// The game rules (moving, crumbs, enemies) still live in carpet.js and
// freeplay.js. They just call view.sync(...) and this file draws it all in 3D.
//
// The big ideas in Three.js:
//   scene    = the 3D world that holds everything
//   camera   = where we look at the scene from
//   renderer = paints what the camera sees onto the canvas
//   mesh     = a 3D object: a shape (geometry) + a look (material)
//   light    = lets us see things, and makes shadows

// Every sprite pixel becomes a little cube. A tile is 1 unit wide,
// and a sprite is 8 pixels wide, so each cube is 1/8 of a unit.
const VOXEL = 1 / 8;

// Shapes and looks we reuse over and over (sharing them makes it faster)
const voxelShape = new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL * 2);
const fibreShape = new THREE.BoxGeometry(1, 1, 1);
const fogShape = new THREE.BoxGeometry(1, 1.3, 1);
const particleShape = new THREE.BoxGeometry(0.07, 0.07, 0.07);
const whiteLook = new THREE.MeshLambertMaterial({ color: 0xffffff });
const fogLook = new THREE.MeshLambertMaterial({ color: 0x1c0b38 });

// A "random" number between 0 and 1 that is always the same for the same
// inputs, so the carpet fibres don't change shape every time we rebuild.
function fixedRandom(a, b, c) {
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

// Turn an 8x8 sprite into a 3D model made of little cubes
function makeVoxelModel(sprite, size) {
  const pixels = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (sprite[row][col] !== ".") {
        pixels.push({ row: row, col: col, letter: sprite[row][col] });
      }
    }
  }

  // An "InstancedMesh" draws lots of copies of one shape in one go: very fast!
  const cubes = new THREE.InstancedMesh(voxelShape, whiteLook, pixels.length);
  const placer = new THREE.Object3D();
  const colour = new THREE.Color();

  pixels.forEach(function (pixel, i) {
    placer.position.set((pixel.col - 3.5) * VOXEL, (7 - pixel.row) * VOXEL + VOXEL / 2, 0);
    placer.updateMatrix();
    cubes.setMatrixAt(i, placer.matrix);
    colour.set(colours[pixel.letter]);
    cubes.setColorAt(i, colour);
  });

  cubes.castShadow = true;
  cubes.frustumCulled = false;

  // Put the cubes inside a holder, so we can move, spin and scale it
  const model = new THREE.Group();
  model.add(cubes);
  model.scale.setScalar(size);
  return model;
}

// Paint a carpet pattern onto a hidden 2D canvas, to use as the floor's texture
function makeCarpetTexture(width, height) {
  const paint = document.createElement("canvas");
  paint.width = width * 8;
  paint.height = height * 8;
  const pen = paint.getContext("2d");

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pen.fillStyle = (x + y) % 2 === 0 ? "#8c1c3a" : "#7a1832";
      pen.fillRect(x * 8, y * 8, 8, 8);

      // Little dots of carpet fluff
      pen.fillStyle = "#a8284a";
      pen.fillRect(x * 8 + 2, y * 8 + 2, 1, 1);
      pen.fillRect(x * 8 + 5, y * 8 + 5, 1, 1);
      pen.fillStyle = "#5e1027";
      pen.fillRect(x * 8 + 6, y * 8 + 1, 1, 1);
      pen.fillRect(x * 8 + 1, y * 8 + 6, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(paint);
  texture.magFilter = THREE.NearestFilter; // keep the pixels chunky
  return texture;
}

// Make a 3D view on a canvas.
//   follow: true  = the camera follows the player (Free Play)
//   follow: false = the camera shows the whole level at once
function createView(canvas, options) {
  // ----- Renderer, scene, camera -----
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12002b);
  if (options.follow) {
    scene.fog = new THREE.Fog(0x12002b, 14, 28); // far away things fade out
  }

  const camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 100);

  // ----- Lights -----
  // A soft light from all around: warm from above, dark red from below
  scene.add(new THREE.HemisphereLight(0xfff0dd, 0x401020, 0.8));

  // A "sun" that casts shadows
  const sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  scene.add(sun);
  scene.add(sun.target);

  // ----- Things in the world -----
  let currentMap = null;
  let worldGroup = null;        // floor, fibres and fog for the current map
  let fog = null;               // the dark boxes over unexplored squares
  let fogHidden = new Set();    // squares where the fog has gone
  let mapWidth = 0;
  let mapHeight = 0;
  const pickups = new Map();    // crumbs and the lost button, by "x,y"
  const enemies = new Map();    // enemy object -> its 3D model
  const particles = [];
  const lookCache = {};

  let player = null;
  let playerSprite = null;
  const cameraTarget = new THREE.Vector3();

  function lookFor(hex) {
    if (!lookCache[hex]) {
      lookCache[hex] = new THREE.MeshLambertMaterial({ color: hex });
    }
    return lookCache[hex];
  }

  // Build the floor, fibres and fog for a new map
  function buildWorld(map, explored) {
    // Clear away the old world
    if (worldGroup) {
      scene.remove(worldGroup);
      worldGroup.traverse(function (thing) {
        if (thing.isMesh && thing.geometry.type === "PlaneGeometry") {
          thing.geometry.dispose();
          thing.material.map.dispose();
          thing.material.dispose();
        }
      });
    }
    for (const model of pickups.values()) {
      scene.remove(model);
    }
    pickups.clear();

    worldGroup = new THREE.Group();
    scene.add(worldGroup);
    currentMap = map;
    mapHeight = map.length;
    mapWidth = map[0].length;

    // The floor: one big flat square with the carpet pattern on it
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth, mapHeight),
      new THREE.MeshLambertMaterial({ map: makeCarpetTexture(mapWidth, mapHeight) })
    );
    floor.rotation.x = -Math.PI / 2; // lie it flat
    floor.position.set((mapWidth - 1) / 2, 0, (mapHeight - 1) / 2);
    floor.receiveShadow = true;
    worldGroup.add(floor);

    // Count the walls so we know how many fibres to make
    const walls = [];
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (map[y][x] === "#") {
          walls.push({ x: x, y: y });
        }
      }
    }

    // Each wall square gets a mossy base and 5 tall strands of carpet fibre
    const STRANDS = 5;
    const fibres = new THREE.InstancedMesh(fibreShape, whiteLook, walls.length * (STRANDS + 1));
    const placer = new THREE.Object3D();
    const colour = new THREE.Color();
    const spots = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25], [0, 0]];
    let i = 0;

    for (const wall of walls) {
      // The base
      placer.position.set(wall.x, 0.15, wall.y);
      placer.rotation.set(0, 0, 0);
      placer.scale.set(1, 0.3, 1);
      placer.updateMatrix();
      fibres.setMatrixAt(i, placer.matrix);
      fibres.setColorAt(i, colour.set(colours.G));
      i++;

      // The strands, each a slightly different height and lean
      for (let s = 0; s < STRANDS; s++) {
        const height = 0.55 + fixedRandom(wall.x, wall.y, s) * 0.45;
        const lean = (fixedRandom(wall.y, wall.x, s) - 0.5) * 0.3;
        placer.position.set(wall.x + spots[s][0], height / 2, wall.y + spots[s][1]);
        placer.rotation.set(lean, 0, -lean);
        placer.scale.set(0.24, height, 0.24);
        placer.updateMatrix();
        fibres.setMatrixAt(i, placer.matrix);
        fibres.setColorAt(i, colour.set(s % 2 === 0 ? colours.g : colours.G));
        i++;
      }
    }
    fibres.castShadow = true;
    fibres.receiveShadow = true;
    fibres.frustumCulled = false;
    worldGroup.add(fibres);

    // Crumbs and the lost button
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (map[y][x] === "c" || map[y][x] === "B") {
          const sprite = map[y][x] === "c" ? crumbSprite : buttonSprite;
          const model = makeVoxelModel(sprite, map[y][x] === "c" ? 0.7 : 0.9);
          model.scale.z = model.scale.z * 3; // make them chunky, not flat
          model.position.set(x, 0.1, y);
          model.userData.letter = map[y][x];
          model.userData.x = x;
          model.userData.y = y;
          scene.add(model);
          pickups.set(x + "," + y, model);
        }
      }
    }

    // Fog: a dark box over every square, which disappears when you explore it
    fog = null;
    fogHidden = new Set();
    if (explored) {
      fog = new THREE.InstancedMesh(fogShape, fogLook, mapWidth * mapHeight);
      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          placer.position.set(x, 0.65, y);
          placer.rotation.set(0, 0, 0);
          placer.scale.set(1, 1, 1);
          placer.updateMatrix();
          fog.setMatrixAt(y * mapWidth + x, placer.matrix);
        }
      }
      fog.frustumCulled = false;
      worldGroup.add(fog);
    }
  }

  // Remove the fog from squares you've explored
  function updateFog(explored) {
    const placer = new THREE.Object3D();
    placer.scale.set(0, 0, 0); // shrink it to nothing
    placer.updateMatrix();
    let changed = false;

    for (const square of explored) {
      if (!fogHidden.has(square)) {
        fogHidden.add(square);
        const parts = square.split(",");
        fog.setMatrixAt(Number(parts[1]) * mapWidth + Number(parts[0]), placer.matrix);
        changed = true;
      }
    }
    if (changed) {
      fog.instanceMatrix.needsUpdate = true;
    }
  }

  // Tell a model where it should go. It glides there in animate().
  function setTarget(model, x, y) {
    if (!model.userData.target) {
      model.userData.target = new THREE.Vector3(x, 0, y);
      model.position.set(x, 0, y);
      model.userData.facing = 0;
    }
    const target = model.userData.target;
    if (x < target.x) {
      model.userData.facing = Math.PI; // turn around to face left
    } else if (x > target.x) {
      model.userData.facing = 0;
    }
    target.set(x, 0, y);
  }

  // A burst of tiny cubes flying out
  function burst(x, y, hex, count, speed, gravity) {
    for (let i = 0; i < count; i++) {
      const bit = new THREE.Mesh(particleShape, lookFor(hex));
      bit.position.set(x, 0.35, y);
      bit.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed,
        (Math.random() - 0.5) * speed
      );
      bit.userData.life = 0.7;
      bit.userData.gravity = gravity;
      scene.add(bit);
      particles.push(bit);
    }
  }

  // ----- sync: make the 3D world match the game -----
  function sync(state) {
    if (state.map !== currentMap) {
      buildWorld(state.map, state.explored);
    }

    // The player (rebuild the model if you changed character)
    if (state.playerSprite !== playerSprite) {
      const oldPlayer = player;
      player = makeVoxelModel(state.playerSprite, 1.1);
      if (oldPlayer) {
        player.position.copy(oldPlayer.position);
        player.userData = oldPlayer.userData;
        scene.remove(oldPlayer);
      }
      scene.add(player);
      playerSprite = state.playerSprite;
    }
    setTarget(player, state.playerX, state.playerY);

    // Enemies: make models for new ones, remove old ones, move the rest
    const stillHere = new Set();
    const allEnemies = [];
    for (const bunny of state.bunnies) {
      allEnemies.push({ enemy: bunny, sprite: bunnySprite });
    }
    for (const moul of state.mouls) {
      allEnemies.push({ enemy: moul, sprite: moulSprite });
    }
    for (const item of allEnemies) {
      if (!enemies.has(item.enemy)) {
        const model = makeVoxelModel(item.sprite, 1.1);
        scene.add(model);
        enemies.set(item.enemy, model);
      }
      setTarget(enemies.get(item.enemy), item.enemy.x, item.enemy.y);
      stillHere.add(item.enemy);
    }
    for (const [enemy, model] of enemies) {
      if (!stillHere.has(enemy)) {
        scene.remove(model);
        enemies.delete(enemy);
      }
    }

    // Crumbs that have been eaten burst into bits!
    for (const [key, model] of pickups) {
      const x = model.userData.x;
      const y = model.userData.y;
      if (state.map[y][x] !== model.userData.letter) {
        scene.remove(model);
        pickups.delete(key);
        burst(x, y, model.userData.letter === "c" ? colours.c : colours.O, 12, 2.5, 9);
      }
    }

    if (fog && state.explored) {
      updateFog(state.explored);
    }
  }

  // A big cloud of dust, for getting caught
  function poof(x, y) {
    burst(x, y, colours.w, 30, 3, 1);
  }

  // ----- The animation loop: runs about 60 times a second -----
  const clock = new THREE.Clock();
  let lastWidth = 0;
  let lastHeight = 0;

  // Glide a model towards where it should be, with a little hop
  function glide(model, dt) {
    const target = model.userData.target;
    const position = model.position;
    const distance = Math.hypot(target.x - position.x, target.z - position.z);

    if (distance > 3.5) {
      position.x = target.x; // too far to glide: jump straight there
      position.z = target.z;
    } else {
      const amount = 1 - Math.exp(-dt * 16);
      position.x += (target.x - position.x) * amount;
      position.z += (target.z - position.z) * amount;
    }
    position.y = Math.sin(Math.min(distance, 1) * Math.PI) * 0.25;

    // Turn smoothly to face the way we're going
    model.rotation.y += (model.userData.facing - model.rotation.y) * Math.min(1, dt * 12);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;

    // Keep the picture sharp if the canvas changes size
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width !== lastWidth || height !== lastHeight) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      lastWidth = width;
      lastHeight = height;
    }

    if (player === null) {
      return; // nothing to draw yet
    }

    glide(player, dt);
    for (const model of enemies.values()) {
      glide(model, dt);
    }

    // Crumbs spin and bob up and down
    for (const model of pickups.values()) {
      model.rotation.y = time * 1.5 + model.userData.x;
      model.position.y = 0.12 + Math.sin(time * 3 + model.userData.y) * 0.05;
    }

    // Particles fly, fall and shrink
    for (let i = particles.length - 1; i >= 0; i--) {
      const bit = particles[i];
      bit.userData.life -= dt;
      bit.userData.velocity.y -= bit.userData.gravity * dt;
      bit.position.addScaledVector(bit.userData.velocity, dt);
      bit.scale.setScalar(Math.max(bit.userData.life / 0.7, 0.01));
      if (bit.userData.life <= 0) {
        scene.remove(bit);
        particles.splice(i, 1);
      }
    }

    // Move the camera
    if (options.follow) {
      // Smoothly follow the player
      cameraTarget.lerp(player.position, Math.min(1, dt * 6));
      cameraTarget.y = 0;
      camera.position.set(cameraTarget.x, cameraTarget.y + 9, cameraTarget.z + 5.5);
    } else {
      // Look at the middle of the level, from far enough away to see it all
      cameraTarget.set((mapWidth - 1) / 2, 0, (mapHeight - 1) / 2);
      camera.position.set(cameraTarget.x, mapWidth * 0.95, cameraTarget.z + mapWidth * 0.55);
    }
    camera.lookAt(cameraTarget);

    // The sun follows the camera, so shadows are always near us
    sun.position.set(cameraTarget.x - 4, 10, cameraTarget.z + 3);
    sun.target.position.copy(cameraTarget);

    renderer.render(scene, camera);
  }
  animate();

  return { sync: sync, poof: poof };
}
