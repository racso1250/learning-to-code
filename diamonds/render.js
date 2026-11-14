// Drawing Diamond Isles: a 3D island with flat 2D pixel-art sprites standing in it.
// This "in between 2D and 3D" style is sometimes called HD-2D.
//
// The island is made of 3D blocks, but the explorer, trees, rocks and diamonds
// are flat pictures ("sprites") that always turn to face the camera, like
// paper cut-outs on a model island.

const RENDER_WIDTH = 400;   // draw small, then stretch: chunky 16-bit pixels
const LEVEL = 0.5;          // how tall one step of hill is

// How high the top of a square is, for each hill height
function topOf(height) {
  return 0.15 + height * LEVEL;
}

// ----- Pixel textures -----

// A 16x16 texture. "pick" chooses one of the 3 colours for each pixel.
function pixelTexture(colourList, seed, pick) {
  const random = seededRandom(seed);
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

// Speckled pattern for the tops of squares
function topPattern(x, y, r) {
  return r < 0.6 ? 0 : r < 0.85 ? 1 : 2;
}

// Stripy rock layers for cliff sides
function sidePattern(x, y, r) {
  if (y % 8 === 7) return 1;
  return r < 0.7 ? 0 : r < 0.9 ? 1 : 2;
}

// Sparkly water
function waterPattern(x, y, r) {
  if ((x * 3 + y * 5) % 13 === 0 && r > 0.3) return 2;
  return r < 0.65 ? 0 : 1;
}

// Turn a sprite (rows of letters) into a texture, swapping some colours if asked
const spriteCache = new Map();
function spriteTexture(sprite, swaps) {
  const cacheKey = sprite.join("") + JSON.stringify(swaps || {});
  if (spriteCache.has(cacheKey)) {
    return spriteCache.get(cacheKey);
  }
  const canvas = document.createElement("canvas");
  canvas.width = sprite[0].length;
  canvas.height = sprite.length;
  const pen = canvas.getContext("2d");
  for (let y = 0; y < sprite.length; y++) {
    for (let x = 0; x < sprite[y].length; x++) {
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
  spriteCache.set(cacheKey, texture);
  return texture;
}

// Flip a sprite left-to-right, so the explorer can face both ways
function mirror(sprite) {
  return sprite.map(function (row) {
    return row.split("").reverse().join("");
  });
}

// Make a flat sprite that stands on the ground and always faces the camera
function makeSprite(sprite, size, swaps) {
  const material = new THREE.SpriteMaterial({ map: spriteTexture(sprite, swaps), alphaTest: 0.5 });
  const flat = new THREE.Sprite(material);
  flat.center.set(0.5, 0); // stand on its feet, not float in the middle
  flat.scale.set(size, size, 1);
  return flat;
}

// ----- The view -----

function createIslandView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1.5, 0.1, 200); // narrow view = flatter, more "2D"

  const skyLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.9);
  scene.add(skyLight);
  const sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  scene.add(sun);
  scene.add(sun.target);

  const shadowShape = new THREE.CircleGeometry(0.32, 10);
  const shadowLook = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

  let island = null;
  let islandGroup = null;   // everything belonging to the current island
  let waterTexture = null;
  let lavaTexture = null;
  let player = null;
  let playerGhost = null;   // a see-through copy, so you can see the explorer behind cliffs
  let playerShadow = null;
  let playerFacing = "down";
  let portal = null;
  const diamondSprites = new Map();
  const particles = [];
  const risers = [];        // things slowly rising out of the sea
  const rocks = new Map();  // rock sprites, so the pickaxe can smash them
  const people = new Map(); // people standing on the island (like Bobby)
  let playerSwaps = null;   // colour changes for the explorer (like the fire cloak)
  const cameraTarget = new THREE.Vector3();
  let snapCamera = true;

  function heightAt(x, y) {
    if (!island || y < 0 || x < 0 || y >= island.size || x >= island.size) {
      return 0;
    }
    return Math.max(0, island.tiles[y][x].height);
  }

  // A shadow blob under something
  function addShadow(x, y, z, size) {
    const blob = new THREE.Mesh(shadowShape, shadowLook);
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(x, y + 0.03, z);
    blob.scale.setScalar(size);
    islandGroup.add(blob);
    return blob;
  }

  // Lots of the same block in one go (fast!)
  function addBlocks(blocks, material, castShadows) {
    if (blocks.length === 0) return;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, blocks.length);
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
    islandGroup.add(mesh);
  }

  // Build a whole island
  function load(newIsland) {
    // Throw away the old island
    if (islandGroup) {
      scene.remove(islandGroup);
      islandGroup.traverse(function (thing) {
        if (thing.geometry && thing.geometry !== shadowShape) thing.geometry.dispose();
      });
    }
    islandGroup = new THREE.Group();
    scene.add(islandGroup);
    diamondSprites.clear();
    risers.length = 0;
    rocks.clear();
    people.clear();
    island = newIsland;
    const theme = island.theme;
    snapCamera = true;

    // Sky, fog and light colours for this island
    scene.background = new THREE.Color(theme.sky);
    scene.fog = new THREE.Fog(theme.fog, 18, 42);
    skyLight.color.set(theme.light);
    sun.color.set(theme.light);

    // Textures for this island
    const tops = {
      beach: new THREE.MeshLambertMaterial({ map: pixelTexture(theme.beachTop, 1, topPattern) }),
      ground: new THREE.MeshLambertMaterial({ map: pixelTexture(theme.groundTop, 2, topPattern) }),
      peak: new THREE.MeshLambertMaterial({ map: pixelTexture(theme.peakTop, 3, topPattern) }),
    };
    if (theme.lavaTop) {
      lavaTexture = pixelTexture(theme.lavaTop, 4, topPattern);
      lavaTexture.wrapS = THREE.RepeatWrapping;
      lavaTexture.wrapT = THREE.RepeatWrapping;
      tops.lava = new THREE.MeshBasicMaterial({ map: lavaTexture }); // "Basic" = glows, ignores light
    } else {
      lavaTexture = null;
    }
    const sideLook = new THREE.MeshLambertMaterial({ map: pixelTexture(theme.side, 5, sidePattern) });

    // The sea
    waterTexture = pixelTexture(theme.water, 6, waterPattern);
    waterTexture.wrapS = THREE.RepeatWrapping;
    waterTexture.wrapT = THREE.RepeatWrapping;
    waterTexture.repeat.set(300, 300);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ map: waterTexture }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(island.size / 2, -0.05, island.size / 2);
    sea.receiveShadow = true;
    islandGroup.add(sea);

    // The land: a stack of side blocks for each square, with a top on it
    const sides = [];
    const topBlocks = { beach: [], ground: [], peak: [], lava: [] };
    const shadowSpots = [];

    for (let y = 0; y < island.size; y++) {
      for (let x = 0; x < island.size; x++) {
        const tile = island.tiles[y][x];
        if (tile.kind === "water") continue;

        for (let level = -1; level <= tile.height; level++) {
          sides.push({ x: x, y: topOf(level) - LEVEL / 2, z: y, w: 1, h: LEVEL, d: 1 });
        }
        topBlocks[tile.kind].push({ x: x, y: topOf(tile.height), z: y, w: 1, h: 0.04, d: 1 });

        // Trees, rocks and flowers are flat sprites standing on top
        const top = topOf(tile.height);
        if (tile.thing === "tree") {
          const tree = makeSprite(tile.treeSprite, 1.5, theme.treeSwaps);
          tree.position.set(x, top, y);
          islandGroup.add(tree);
          shadowSpots.push({ x: x, y: top, z: y, size: 1.3 });
        } else if (tile.thing === "rock") {
          const rock = makeSprite(rockSprite, 1);
          rock.position.set(x, top, y);
          islandGroup.add(rock);
          rocks.set(x + "," + y, { sprite: rock, shadow: addShadow(x, top, y, 1) });
        } else if (tile.thing === "flower" && theme.flower) {
          const flower = makeSprite(theme.flower, 0.8, theme.flowerSwaps);
          flower.position.set(x + 0.1, top, y);
          islandGroup.add(flower);
        }
      }
    }

    addBlocks(sides, sideLook, true);
    for (const kind of Object.keys(topBlocks)) {
      if (tops[kind]) addBlocks(topBlocks[kind], tops[kind], false);
    }
    for (const spot of shadowSpots) {
      addShadow(spot.x, spot.y, spot.z, spot.size);
    }

    // The explorer
    player = makeSprite(playerFront, 1);
    islandGroup.add(player);
    playerGhost = makeSprite(playerFront, 1);
    playerGhost.material = playerGhost.material.clone();
    playerGhost.material.depthTest = false;  // draw even when behind a cliff...
    playerGhost.material.transparent = true;
    playerGhost.material.opacity = 0.35;     // ...but faint
    playerGhost.renderOrder = 10;
    islandGroup.add(playerGhost);
    playerShadow = addShadow(0, 0, 0, 1);
    player.userData.target = null;

    // The portal (hidden until all diamonds are found)
    portal = makeSprite(portalSprite, 1.4);
    portal.position.set(island.start.x, topOf(heightAt(island.start.x, island.start.y)) + 0.05, island.start.y);
    portal.visible = false;
    islandGroup.add(portal);
  }

  // Pick the right picture for the way the explorer is facing
  function setFacing(facing, swaps) {
    if (facing === playerFacing && swaps === playerSwaps) return;
    playerFacing = facing;
    playerSwaps = swaps;
    let sprite = playerFront;
    if (facing === "up") sprite = playerBack;
    if (facing === "left") sprite = mirror(playerFront);
    player.material.map = spriteTexture(sprite, swaps);
    playerGhost.material.map = player.material.map;
  }

  // Smash a rock to bits (with the pickaxe!)
  function smashRock(x, y) {
    const rock = rocks.get(x + "," + y);
    if (!rock) return;
    burst(x, y, "#a4a2ad");
    burst(x, y, "#6e6b78");
    islandGroup.remove(rock.sprite);
    islandGroup.remove(rock.shadow);
    rocks.delete(x + "," + y);
  }

  // The MASSIVE portal rises out of the sea, with stepping stones leading to it.
  //   path = the squares of the stone path, portalSpot = where the portal stands
  //   instant = true means it's already there (no rising animation)
  function openBigPortal(path, portalSpot, instant) {
    const stoneLook = new THREE.MeshLambertMaterial({ map: pixelTexture(["#b8b0c8", "#9a92aa", "#d0c8e0"], 9, sidePattern) });
    const startTime = clock.elapsedTime;
    path.forEach(function (spot, i) {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), stoneLook);
      stone.castShadow = true;
      stone.receiveShadow = true;
      const finalY = topOf(0) - 0.4;
      stone.position.set(spot.x, instant ? finalY : finalY - 1.5, spot.y);
      islandGroup.add(stone);
      if (!instant) {
        risers.push({ thing: stone, from: finalY - 1.5, to: finalY, start: startTime + 0.4 + i * 0.35, duration: 1 });
      }
    });

    const bigPortal = makeSprite(portalSprite, 4.5);
    bigPortal.material = bigPortal.material.clone();
    bigPortal.material.transparent = true;
    bigPortal.material.opacity = 0.8; // a little see-through, so it doesn't hide the beach
    const finalY = topOf(0) + 0.1;
    bigPortal.position.set(portalSpot.x, instant ? finalY : finalY - 5.5, portalSpot.y - 0.5);
    islandGroup.add(bigPortal);
    portal.userData.big = bigPortal;
    if (!instant) {
      risers.push({ thing: bigPortal, from: finalY - 5.5, to: finalY, start: startTime, duration: 3.5 });
      // Splashes all around it as it rises
      for (let i = 0; i < 6; i++) {
        setTimeout(function () {
          burst(portalSpot.x + (Math.random() - 0.5) * 3, portalSpot.y, "#9fd0ff");
        }, i * 500);
      }
    }
  }

  function burst(x, y, hex) {
    for (let i = 0; i < 16; i++) {
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: hex }));
      bit.position.set(x, topOf(heightAt(x, y)) + 0.4, y);
      bit.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
      bit.userData.life = 0.8;
      scene.add(bit);
      particles.push(bit);
    }
  }

  // Make the picture match the game
  //   state.player = { x, y, facing }
  //   state.diamonds = [{ key, x, y }]
  //   state.portalOpen = true or false
  function sync(state) {
    if (!player.userData.target) {
      player.userData.target = new THREE.Vector3();
      player.position.set(state.player.x, topOf(heightAt(state.player.x, state.player.y)), state.player.y);
    }
    player.userData.target.set(state.player.x, 0, state.player.y);
    setFacing(state.player.facing, state.player.swaps);

    // People standing on the island
    for (const person of state.people) {
      if (!people.has(person.id)) {
        const flat = makeSprite(person.sprite, 1);
        const top = topOf(heightAt(person.x, person.y));
        flat.position.set(person.x, top, person.y);
        flat.userData = { x: person.x, y: person.y };
        addShadow(person.x, top, person.y, 1);
        islandGroup.add(flat);
        people.set(person.id, flat);
      }
    }

    // Add new diamonds, burst the collected ones
    const swaps = { c: island.theme.diamond[0], d: island.theme.diamond[1] };
    const stillHere = new Set();
    for (const d of state.diamonds) {
      stillHere.add(d.key);
      if (!diamondSprites.has(d.key)) {
        const gem = makeSprite(diamondSprite, 0.9, swaps);
        gem.userData = { x: d.x, y: d.y, shadow: addShadow(d.x, topOf(heightAt(d.x, d.y)), d.y, 0.7) };
        islandGroup.add(gem);
        diamondSprites.set(d.key, gem);
      }
    }
    for (const [key, gem] of diamondSprites) {
      if (!stillHere.has(key)) {
        burst(gem.userData.x, gem.userData.y, island.theme.diamond[0]);
        islandGroup.remove(gem);
        islandGroup.remove(gem.userData.shadow);
        diamondSprites.delete(key);
      }
    }

    portal.visible = state.portalOpen;
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

    if (!island || !player.userData.target) {
      return;
    }

    // Moving water and bubbling lava
    waterTexture.offset.x = time * 0.03;
    if (lavaTexture) {
      lavaTexture.offset.set(Math.sin(time * 0.5) * 0.1, time * 0.05);
    }

    // Glide the explorer to their square with a little hop
    const target = player.userData.target;
    const position = player.position;
    const distance = Math.hypot(target.x - position.x, target.z - position.z);
    const amount = 1 - Math.exp(-dt * 14);
    position.x += (target.x - position.x) * amount;
    position.z += (target.z - position.z) * amount;
    const ground = topOf(heightAt(Math.round(position.x), Math.round(position.z)));
    position.y = ground + Math.sin(Math.min(distance, 1) * Math.PI) * 0.3;
    playerGhost.position.copy(position);
    playerShadow.position.set(position.x, ground + 0.03, position.z);

    // Diamonds bob up and down and twinkle
    for (const gem of diamondSprites.values()) {
      const base = topOf(heightAt(gem.userData.x, gem.userData.y));
      gem.position.set(gem.userData.x, base + 0.15 + Math.sin(time * 3 + gem.userData.x) * 0.08, gem.userData.y);
      const twinkle = 0.9 + Math.max(0, Math.sin(time * 4 + gem.userData.y * 2)) * 0.15;
      gem.scale.set(0.9 * twinkle, 0.9 * twinkle, 1);
    }

    // People bounce gently on the spot, as if they're humming a tune
    for (const flat of people.values()) {
      const top = topOf(heightAt(flat.userData.x, flat.userData.y));
      flat.position.y = top + Math.abs(Math.sin(time * 2.5)) * 0.06;
    }

    // The portal spins (and so does the massive one, more slowly)
    if (portal.visible) {
      portal.material.rotation = time * 2;
    }
    if (portal.userData.big) {
      portal.userData.big.material.rotation = time * 0.8;
    }

    // Things rising out of the sea, smoothly
    for (let i = risers.length - 1; i >= 0; i--) {
      const r = risers[i];
      const progress = Math.min(1, Math.max(0, (time - r.start) / r.duration));
      const eased = 1 - Math.pow(1 - progress, 3); // fast at first, then gently
      r.thing.position.y = r.from + (r.to - r.from) * eased;
      if (progress >= 1) {
        risers.splice(i, 1);
      }
    }

    // Flying bits
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

    // The camera follows from a distance, looking down at an angle
    if (snapCamera) {
      cameraTarget.copy(position);
      snapCamera = false;
    }
    cameraTarget.lerp(position, Math.min(1, dt * 5));
    camera.position.set(cameraTarget.x, cameraTarget.y + 9.5, cameraTarget.z + 12);
    camera.lookAt(cameraTarget.x, cameraTarget.y + 0.3, cameraTarget.z);
    sun.position.set(cameraTarget.x - 6, cameraTarget.y + 12, cameraTarget.z + 5);
    sun.target.position.copy(cameraTarget);

    renderer.render(scene, camera);
  }
  animate();

  return { load: load, sync: sync, openBigPortal: openBigPortal, smashRock: smashRock };
}
