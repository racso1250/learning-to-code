// Thunder Ride in 3D. The game (game.js) works out where everything is on a flat map;
// this file builds the 3D world with THREE.js and shows it from a camera just behind you.

const VIEW = (function () {
  const glCanvas = document.getElementById("view3d");
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fdcff);
  scene.fog = new THREE.Fog(0x9fdcff, 500, 1900);
  const camera = new THREE.PerspectiveCamera(60, 1.5, 3, 2200);
  const skyLight = new THREE.HemisphereLight(0xffffff, 0xa0a890, 0.78);
  const sun = new THREE.DirectionalLight(0xfff4dc, 0.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 10, far: 1400 });
  sun.shadow.bias = -0.001;
  scene.add(skyLight, sun, sun.target);
  let size = 0;
  function fit() {
    const w = glCanvas.clientWidth || 960;
    if (w === size) return;
    size = w;
    renderer.setSize(w, Math.round(w / 1.5), false);
  }
  const paints = new Map();
  const paint = (colour) => paints.get(colour) || paints.set(colour, new THREE.MeshLambertMaterial({ color: colour })).get(colour);
  const paintOf = (colour) => (typeof colour === "object" ? colour : paint(colour));
  // Cartoon outlines: every part of a character gets a slightly bigger dark copy of itself, drawn inside-out
  const INK = new THREE.MeshBasicMaterial({ color: 0x2a2238, side: THREE.BackSide });
  function part(shape, colour, x, y, z, parent, outline) {
    const mesh = new THREE.Mesh(shape, paintOf(colour));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    if (outline !== false) {
      const edge = new THREE.Mesh(shape, INK);
      edge.scale.setScalar(1.09);
      mesh.add(edge);
    }
    parent.add(mesh);
    return mesh;
  }
  const ball = (r) => new THREE.SphereGeometry(r, 18, 14);
  const tube = (r1, r2, h) => new THREE.CylinderGeometry(r1, r2, h, 12);
  const cone = (r, h, sides) => new THREE.ConeGeometry(r, h, sides || 10);
  const block = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const glowPicture = (function () {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d"), fade = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    fade.addColorStop(0, "rgba(255,255,255,1)");
    fade.addColorStop(0.4, "rgba(255,255,255,0.35)");
    fade.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  function glow(colour, wide, parent) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowPicture, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sprite.scale.set(wide, wide, 1);
    parent.add(sprite);
    return sprite;
  }
  const turnFor = (angle) => Math.PI / 2 - angle;        // which way to turn a model so it faces a map direction

  // ----- People: little cartoon characters with big round heads -----
  function makeChibi(look) {
    const group = new THREE.Group(), dark = 0x2a2238;
    const legs = [], arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 3, 8, 0);
      part(tube(2.4, 2.2, 7), look.legs, 0, -3.5, 0, leg);
      part(ball(3), dark, 0, -7, 1.2, leg, false).scale.set(1, 0.7, 1.5);
      group.add(leg);
      legs.push(leg);
      const arm = new THREE.Group();
      arm.position.set(side * 6.4, 18, 0);
      part(tube(1.9, 1.7, 7), look.top, 0, -3.5, 0, arm);
      part(ball(2.1), look.skin, 0, -7.6, 0, arm);
      arm.rotation.z = side * 0.3;
      group.add(arm);
      arms.push(arm);
    }
    part(ball(1), look.top, 0, 14, 0, group).scale.set(6.6, 7.6, 5.2);
    part(block(0.9, 9, 0.6), blend(look.top, "#ffffff", 0.6), 0, 14.5, 5.1, group, false);
    const head = new THREE.Group();
    head.position.y = 29;
    group.add(head);
    part(new THREE.SphereGeometry(10, 26, 20), look.skin, 0, 0, 0, head);
    for (const side of [-1, 1]) {
      part(ball(2), look.skin, side * 9.6, -0.6, 0, head);
      if (look.extra !== "shades") {
        part(ball(1), dark, side * 3.6, 0.2, 9.1, head, false).scale.set(1.5, 2.3, 0.8);                                   // big shiny eyes
        part(ball(0.6), new THREE.MeshBasicMaterial({ color: 0xffffff }), side * 3.6 + 0.6, 1.2, 9.8, head, false);
      }
      part(ball(1), new THREE.MeshBasicMaterial({ color: 0xff9aa8 }), side * 6.2, -2.8, 8.0, head, false).scale.set(1.8, 1, 0.4);      // rosy cheeks
    }
    if (look.extra !== "bandana") part(new THREE.TorusGeometry(1.7, 0.32, 6, 10, Math.PI), dark, 0, -3.2, 9.5, head, false).rotation.z = Math.PI;
    const top = () => new THREE.SphereGeometry(10.6, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    if (look.style !== "bald" && look.style !== "mohawk") part(top(), look.hair, 0, 0.6, -0.7, head);
    const covered = ["helmet", "goggles", "cap"].includes(look.extra);        // (hair doesn't poke through a hat)
    if (look.style === "spiky" && !covered) for (let n = 0; n < 8; n++) {
      const a = n * 0.785, spike = part(cone(3.2, 8, 8), look.hair, Math.cos(a) * 6, 9, Math.sin(a) * 6 - 0.5, head);
      spike.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
    }
    if (look.style === "mohawk" && !covered) for (let n = 0; n < 5; n++) part(cone(2.8, 9, 8), look.hair, 0, 11.5 - Math.abs(n - 2) * 1.6, -7 + n * 3.6, head).rotation.x = (n - 2) * 0.35;
    if (look.style === "long") part(ball(1), look.hair, 0, -5, -6.4, head).scale.set(10, 12, 5);
    if (look.style === "tail") {
      part(ball(3.6), look.hair, 0, 2, -10.6, head);
      part(cone(3, 10, 8), look.hair, 0, -4, -12.5, head).rotation.x = Math.PI + 0.3;
    }
    if (look.extra === "helmet" || look.extra === "goggles") {
      part(new THREE.SphereGeometry(11.3, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), look.gear, 0, 1, 0, head);
      part(block(2.6, 1.2, 15), 0xffffff, 0, 11.6, -1, head, false);
    }
    if (look.extra === "goggles") {            // goggles pushed up on the forehead
      part(block(20, 3.4, 3), dark, 0, 3.4, 8.4, head, false);
      for (const side of [-1, 1]) part(ball(3), new THREE.MeshPhongMaterial({ color: 0x8fe8ff, shininess: 120 }), side * 4.2, 3.6, 9.4, head).scale.z = 0.6;
    }
    if (look.extra === "cap") {
      part(top(), look.gear, 0, 1.6, 0, head);
      part(block(12, 1, 7), blend(look.gear, "#000000", 0.3), 0, 2.4, 10.5, head);
    }
    if (look.extra === "shades") {
      for (const side of [-1, 1]) part(block(5.8, 3.6, 1), dark, side * 3.9, 0.4, 9.7, head, false);
      part(block(3, 1, 1), dark, 0, 1, 9.7, head, false);
    }
    if (look.extra === "bandana") part(new THREE.SphereGeometry(10.4, 22, 8, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.26), look.gear, 0, 0, 0.3, head);
    scene.add(group);
    return {
      group: group,
      // Stand at a place facing a way. "walk" swings the arms and legs, and "sitting" is for riding.
      pose: function (x, y, z, angle, walk, moving, sitting) {
        group.position.set(x, y + (moving ? Math.abs(Math.sin(walk * 9)) * 1.2 : 0), z);
        group.rotation.y = turnFor(angle);
        const swing = moving ? Math.sin(walk * 9) : 0;
        legs.forEach(function (leg, n) {
          leg.rotation.x = sitting ? -1.25 : swing * (n ? -0.8 : 0.8);
          leg.rotation.z = sitting ? (n ? 0.3 : -0.3) : 0;
        });
        arms.forEach((arm, n) => (arm.rotation.x = sitting ? -1 : swing * (n ? 0.8 : -0.8)));
        head.rotation.z = moving && !sitting ? Math.sin(walk * 9) * 0.05 : 0;
      },
    };
  }

  // ----- Voltrev, the motorbike Wildling, in 3D (built facing forwards) -----
  function makeBike() {
    const group = new THREE.Group();
    group.rotation.order = "YXZ";
    const body = new THREE.MeshLambertMaterial({ color: 0xf8d028 }), belly = new THREE.MeshLambertMaterial({ color: 0xfff4b0 }), shine = new THREE.MeshBasicMaterial({ color: 0x4ae8ff }), dark = 0x2a2238;
    const wheels = [];
    for (const z of [-22, 22]) {
      const wheel = new THREE.Group();
      wheel.position.set(0, 10, z);
      const tyre = part(new THREE.TorusGeometry(8.5, 3.2, 10, 22), dark, 0, 0, 0, wheel, false);
      tyre.rotation.y = Math.PI / 2;
      part(new THREE.TorusGeometry(8.5, 1.1, 8, 22), shine, 0, 0, 0, wheel, false).rotation.y = Math.PI / 2;
      for (let n = 0; n < 3; n++) part(block(0.9, 14, 1.6), shine, 0, 0, 0, wheel, false).rotation.x = n * 1.047;
      part(ball(2.6), body, 0, 0, 0, wheel);
      group.add(wheel);
      wheels.push(wheel);
      for (const side of [-1, 1]) {            // legs reaching down to the wheel hubs
        const leg = part(tube(1.5, 1.5, 12), dark, side * 4.6, 15, z * 0.82, group, false);
        leg.rotation.x = z > 0 ? -0.45 : 0.45;
      }
    }
    part(ball(1), body, 0, 20, -2, group).scale.set(7.4, 7, 21);
    part(ball(1), belly, 0, 17, 2, group, false).scale.set(6, 5, 15);
    part(ball(1), dark, 0, 26, -5, group, false).scale.set(5, 2, 9);                          // the saddle
    const head = part(ball(1), body, 0, 28, 21, group);
    head.scale.set(6.2, 6.6, 9);
    part(cone(4.4, 9, 10), body, 0, 26.5, 31, group).rotation.x = Math.PI / 2;               // the snout
    part(ball(1), shine, 0, 29.6, 26, group, false).scale.set(6.4, 2.2, 5);                   // a glowing visor for eyes
    for (const side of [-1, 1]) {
      const ear = part(cone(1.8, 15, 8), dark, side * 5.6, 35, 15, group);                    // swept-back ears, like handlebars
      ear.rotation.set(-0.9, 0, -side * 0.6);
      for (let n = 0; n < 3; n++) {                                                            // a lightning stripe down each side
        const stripe = part(block(0.6, 2.2, 9), shine, side * 7.3, 20 + (n % 2) * 2.4 - 1, -12 + n * 9, group, false);
        stripe.rotation.x = n % 2 ? 0.5 : -0.5;
      }
    }
    part(tube(2.6, 3.2, 12), 0x9aa0b0, 0, 20, -27, group).rotation.x = Math.PI / 2;           // the exhaust-pipe tail
    const bolt = part(cone(3, 10, 4), body, 0, 26, -33, group);
    bolt.rotation.x = -0.9;
    // The Overdrive form: spikes down its back, flames from the exhaust and a hot glow
    const extra = new THREE.Group();
    group.add(extra);
    for (let n = 0; n < 5; n++) part(cone(2.6, 9, 6), 0xffe9a8, 0, 28.5 - n * 0.8, 10 - n * 7, extra).rotation.x = -0.5;
    const flames = [0xff4ad8, 0xffb030, 0xffffff].map(function (colour, n) {
      const flame = part(cone(4.5 - n * 1.2, 20 - n * 4, 8), new THREE.MeshBasicMaterial({ color: colour }), 0, 20, -42 + n * 3, extra, false);
      flame.rotation.x = -Math.PI / 2;
      return flame;
    });
    const aura = glow(0xff7a2a, 150, extra);
    aura.position.y = 20;
    scene.add(group);
    return {
      group: group,
      show: function (x, z, angle, spin, mega, lean, visible) {
        group.visible = visible;
        if (!visible) return;
        group.position.set(x, 0, z);
        group.rotation.set(0, turnFor(angle), lean);
        for (const wheel of wheels) wheel.rotation.x = spin;
        extra.visible = mega;
        body.color.set(mega ? 0xff7a2a : 0xf8d028);
        belly.color.set(mega ? 0xffe9a8 : 0xfff4b0);
        shine.color.set(mega ? 0xff4ad8 : 0x4ae8ff);
        flames.forEach((flame, n) => flame.scale.set(1, 0.8 + Math.sin(time * 30 + n * 2) * 0.3, 1));
        group.scale.setScalar(mega ? 1.18 : 1);
      },
    };
  }

  // ----- Wildlings in 3D: each little square of the creature's picture becomes a block, thicker in the middle -----
  function blockInto(out, cx, cy, cz, w, h, d, colour) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const faces = [
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
    ];
    for (const [a, b, c, e, n] of faces) {
      const at = out.position.length / 3;
      for (const corner of [a, b, c, e]) {
        out.position.push(...corner);
        out.normal.push(...n);
        out.color.push(...colour);
      }
      out.index.push(at, at + 1, at + 2, at, at + 2, at + 3);
    }
  }
  const blocksPaint = new THREE.MeshLambertMaterial({ vertexColors: true });
  const GRAIN = 1.3;
  function shapeOf(img) {
    if (img.shape3d) return img.shape3d;
    const data = img.getContext("2d").getImageData(0, 0, 120, 120).data;
    const at = (cx, cy) => {
      const i = ((cy * 4 + 2) * 120 + cx * 4 + 2) * 4;
      return data[i + 3] > 128 ? [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255] : null;
    };
    const out = { position: [], normal: [], color: [], index: [] };
    for (let cy = 0; cy < 30; cy++) {
      let first = 30, last = -1;
      for (let cx = 0; cx < 30; cx++) if (at(cx, cy)) {
        first = Math.min(first, cx);
        last = cx;
      }
      if (last < 0) continue;
      const middle = (first + last + 1) / 2, half = (last - first + 1) / 2;
      for (let cx = first; cx <= last; cx++) {
        const colour = at(cx, cy);
        if (!colour) continue;
        const across = (cx + 0.5 - middle) / half;
        const deep = Math.max(1.6, Math.min(half, 7) * 1.7 * Math.sqrt(Math.max(0.06, 1 - across * across)));
        blockInto(out, (cx - 14.5) * GRAIN, (28.4 - cy) * GRAIN, 0, GRAIN, GRAIN, deep * GRAIN, colour);
      }
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute("position", new THREE.Float32BufferAttribute(out.position, 3));
    shape.setAttribute("normal", new THREE.Float32BufferAttribute(out.normal, 3));
    shape.setAttribute("color", new THREE.Float32BufferAttribute(out.color, 3));
    shape.setIndex(out.index);
    return (img.shape3d = shape);
  }
  function makeCreature() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(shapeOf(picture(1)), blocksPaint);
    body.castShadow = true;
    group.add(body);
    scene.add(group);
    return { group: group, body: body, img: null };
  }
  function showCreature(model, img, x, z, angle, hop, size, visible) {
    model.group.visible = visible;
    if (!visible) return;
    if (model.img !== img) {
      model.img = img;
      model.body.geometry = shapeOf(img);
      model.body.rotation.y = img.side ? Math.PI / 2 : 0;        // (pictures drawn from the side are turned to face forwards)
    }
    model.group.scale.setScalar(size);
    model.group.position.set(x, Math.abs(Math.sin(hop)) * 4 * size, z);
    let turn = turnFor(angle) - model.group.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    model.group.rotation.y += turn * 0.25;
  }

  // ----- The world -----
  const PIECE = 16 * TILE;          // scenery is glued together in pieces this big, so it draws fast
  const piles = new Map();
  function keep(shape, colour, x, y, z, sx, sy, sz, turn) {
    const material = paintOf(colour), name = Math.floor(x / PIECE) + "," + Math.floor(z / PIECE) + material.uuid;
    if (!piles.has(name)) piles.set(name, { material: material, position: [], normal: [] });
    const mesh = new THREE.Mesh(shape);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    if (turn) mesh.rotation.set(turn[0], turn[1], turn[2]);
    mesh.updateMatrix();
    let made = shape.clone().applyMatrix4(mesh.matrix);
    if (made.index) made = made.toNonIndexed();
    piles.get(name).position.push(made.attributes.position.array);
    piles.get(name).normal.push(made.attributes.normal.array);
  }
  const crateModels = [], gateModels = [];
  function build() {
    // The ground: flat colour for each place, and blue for water
    const ground = { position: [], color: [] };
    const flat = function (out, y, colour, corners) {
      const rgb = hexToRgb(colour).map((v) => v / 255);
      for (const n of [0, 1, 2, 0, 2, 3]) {
        out.position.push(corners[n][0], y, corners[n][1]);
        out.color.push(...rgb);
      }
    };
    for (let ty = 0; ty < MH; ty++) {
      let from = 0;
      const kind = (tx) => (land[ty][tx] === WATER ? 9 : place[ty][tx]);
      for (let tx = 1; tx <= MW; tx++) {
        if (tx < MW && kind(tx) === kind(from)) continue;
        flat(ground, 0, kind(from) === 9 ? "#4a9af0" : PLACES[kind(from)].ground, [[from * TILE, (ty + 1) * TILE], [tx * TILE, (ty + 1) * TILE], [tx * TILE, ty * TILE], [from * TILE, ty * TILE]]);
        from = tx;
      }
    }
    // The roads: a dark edge, grey tarmac and a dashed yellow line, each laid on top of the last
    const layers = [{ position: [], color: [] }, { position: [], color: [] }, { position: [], color: [] }];
    for (const road of ROADS) {
      for (let n = 0; n < road.length - 1; n++) {
        const ax = road[n][0] * TILE, az = road[n][1] * TILE, bx = road[n + 1][0] * TILE, bz = road[n + 1][1] * TILE, long = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / long, uz = (bz - az) / long;
        const strip = (out, colour, wide, t0, t1) => flat(out, 0, colour, [[ax + ux * t0 - uz * wide, az + uz * t0 + ux * wide], [ax + ux * t1 - uz * wide, az + uz * t1 + ux * wide], [ax + ux * t1 + uz * wide, az + uz * t1 - ux * wide], [ax + ux * t0 + uz * wide, az + uz * t0 - ux * wide]]);
        strip(layers[0], "#3a3d4c", 52, 0, long);
        strip(layers[1], "#6a6e7e", 46, 0, long);
        for (let t = 10; t < long - 26; t += 52) strip(layers[2], "#f8d028", 2.2, t, t + 26);
      }
      for (const [x, z] of road) for (let n = 0; n < 16; n++) {            // round off the corners
        const a0 = n * 0.3927, a1 = (n + 1) * 0.3927, cx = x * TILE, cz = z * TILE;
        for (const [out, colour, r] of [[layers[0], "#3a3d4c", 52], [layers[1], "#6a6e7e", 46]]) flat(out, 0, colour, [[cx, cz], [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r], [cx, cz]]);
      }
    }
    [ground].concat(layers).forEach(function (out, layer) {
      const shape = new THREE.BufferGeometry();
      shape.setAttribute("position", new THREE.Float32BufferAttribute(out.position, 3));
      shape.setAttribute("color", new THREE.Float32BufferAttribute(out.color, 3));
      shape.computeVertexNormals();
      const mesh = new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer * 4 }));
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
    });
    const beyond = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), paint(0x5a5648));          // (dark rock, far beyond the mountains)
    beyond.rotation.x = -Math.PI / 2;
    beyond.position.set((MW * TILE) / 2, -1, (MH * TILE) / 2);
    scene.add(beyond);
    // Mountains, trees, cactuses and rocks
    const peak = cone(1, 1, 5), leaf = new THREE.IcosahedronGeometry(1, 1), trunk = tube(0.8, 1, 1), lump = new THREE.DodecahedronGeometry(1), spike = cone(1, 1, 7);
    const RIDGE_COLOUR = ["#7a8a6a", "#b0a080", "#a8583a", "#9ab0c8", "#4a4e62"], ROCK_COLOUR = ["#9a968c", "#c8b890", "#b8643c", "#c4d4e4", "#80849a"];
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const kind = land[ty][tx], where = place[ty][tx], x = tx * TILE + 16, z = ty * TILE + 16, roll = hash(tx, ty, 63), big = 0.8 + roll * 0.6;
      if (kind === RIDGE) {
        const high = 70 + roll * 70;
        keep(peak, roll < 0.5 ? RIDGE_COLOUR[where] : blend(RIDGE_COLOUR[where], "#000000", 0.14), x + (roll - 0.5) * 10, high / 2, z + (hash(ty, tx, 64) - 0.5) * 10, 27, high, 27, [0, roll * 3, 0]);
        if ((where === 3 || where === 0) && roll > 0.35) keep(peak, "#ffffff", x + (roll - 0.5) * 10, high * 0.86, z + (hash(ty, tx, 64) - 0.5) * 10, 8.6, high * 0.3, 8.6, [0, roll * 3, 0]);
      } else if (kind === ROCK) keep(lump, ROCK_COLOUR[where], x, 6 * big, z, 12 * big, 9 * big, 11 * big, [roll, roll * 5, 0]);
      else if (kind === TREE && where === 1) {            // a palm tree
        keep(trunk, "#a8743c", x, 20, z, 2.6, 40, 2.6, [0.1, 0, 0.08]);
        for (let n = 0; n < 6; n++) keep(spike, n % 2 ? "#3aa858" : "#58c070", x + Math.cos(n * 1.05) * 11, 40, z + Math.sin(n * 1.05) * 11, 5, 26, 2, [Math.sin(n * 1.05) * 1.25, 0, -Math.cos(n * 1.05) * 1.25]);
      } else if (kind === TREE && where === 2) {            // a cactus
        keep(trunk, "#4a9a50", x, 16 * big, z, 5.5, 32 * big, 5.5);
        keep(trunk, "#4a9a50", x + 8, 18 * big, z, 3, 14 * big, 3);
        keep(trunk, "#4a9a50", x - 8, 14 * big, z, 3, 12 * big, 3);
      } else if (kind === TREE && where === 3) {            // a snowy pine
        keep(trunk, "#6a4a30", x, 6, z, 3.4, 12, 3.4);
        keep(spike, "#2f7a5a", x, 22 * big, z, 15 * big, 26 * big, 15 * big);
        keep(spike, "#3a8a66", x, 38 * big, z, 11 * big, 22 * big, 11 * big);
        keep(spike, "#f4f8ff", x, 50 * big, z, 6 * big, 12 * big, 6 * big);
      } else if (kind === TREE) {                           // a round leafy tree
        keep(trunk, "#7a5230", x, 13 * big, z, 4, 26 * big, 4);
        keep(leaf, where === 4 ? "#3aa878" : "#3aa858", x, 36 * big, z, 17 * big, 15 * big, 17 * big);
        keep(leaf, where === 4 ? "#58c898" : "#5cc86c", x + 6 * big, 46 * big, z - 3, 11 * big, 10 * big, 11 * big);
      }
    }
    for (const pile of piles.values()) {
      const shape = new THREE.BufferGeometry();
      for (const which of ["position", "normal"]) {
        const all = new Float32Array(pile[which].reduce((sum, list) => sum + list.length, 0));
        let at = 0;
        for (const list of pile[which]) {
          all.set(list, at);
          at += list.length;
        }
        shape.setAttribute(which, new THREE.BufferAttribute(all, 3));
      }
      const mesh = new THREE.Mesh(shape, pile.material);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    }
    // Buildings: pit stops, houses, and the neon towers of the city
    const sign = function (text, colour) {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 64;
      const g = c.getContext("2d");
      g.fillStyle = "#2a2238";
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = colour;
      g.font = "700 40px Fredoka, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, 128, 34);
      return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) });
    };
    const neonWalls = ["#ff4ad8", "#4ae8ff", "#f8d028", "#6aff8a"].map(function (neon) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      g.fillStyle = "#2a2e42";
      g.fillRect(0, 0, 128, 128);
      for (let y = 8; y < 120; y += 16) for (let x = 8; x < 120; x += 16) {
        g.fillStyle = Math.random() < 0.62 ? neon : "#161826";
        g.fillRect(x, y, 9, 9);
      }
      const picture2 = new THREE.CanvasTexture(c);
      return new THREE.MeshLambertMaterial({ map: picture2, emissiveMap: picture2, emissive: 0xffffff, emissiveIntensity: 0.75 });
    });
    for (const b of buildings) {
      const w = b.w * TILE - 8, d = b.h * TILE - 8, cx = (b.tx + b.w / 2) * TILE, cz = (b.ty + b.h / 2) * TILE, home = new THREE.Group();
      home.position.set(cx, 0, cz);
      scene.add(home);
      if (b.pit) {
        part(block(w, 34, d), 0xf4f0e4, 0, 17, 0, home, false);
        part(block(w + 8, 6, d + 8), 0xe84040, 0, 37, 0, home, false);
        for (let n = 0; n < 6; n++) part(block((w + 8) / 6, 6.2, 12), n % 2 ? 0xffffff : 0xe84040, -(w + 8) / 2 + (n + 0.5) * ((w + 8) / 6), 30, d / 2 + 6, home, false).rotation.x = 0.35;
        part(block(w - 16, 24, 2), 0x3a3f4c, 0, 12, d / 2 + 0.6, home, false);
        const board = new THREE.Mesh(block(w, 14, 3), sign("PIT STOP", "#f8d028"));
        board.position.set(0, 48, d / 2 - 4);
        home.add(board);
        glow(0xffd070, 60, home).position.set(0, 48, d / 2 + 4);
      } else if (b.house != null) {
        part(block(w, 30, d), 0xf8ecd0, 0, 15, 0, home, false);
        const roof = part(cone(w * 0.78, 22, 4), [0xe05858, 0x5888e8, 0x58a868][b.house], 0, 41, 0, home, false);
        roof.rotation.y = Math.PI / 4;
        part(block(12, 20, 2), 0x8a5a30, 0, 10, d / 2 + 0.6, home, false);
      } else {
        const high = 110 + hash(b.tx, b.ty, 7) * 110;
        const tower = new THREE.Mesh(block(w, high, d), neonWalls[b.neon]);
        tower.position.y = high / 2;
        tower.castShadow = true;
        home.add(tower);
        part(block(w + 2, 3, d + 2), new THREE.MeshBasicMaterial({ color: ["#ff4ad8", "#4ae8ff", "#f8d028", "#6aff8a"][b.neon] }), 0, high + 1.5, 0, home, false);
      }
    }
    // Crates of orbs, and the Rust Riders' roadblocks
    for (const crate of crates) {
      const model = new THREE.Group();
      part(block(12, 10, 12), 0xc88a48, 0, 5, 0, model);
      part(block(13, 2.4, 13), 0xa06a30, 0, 10, 0, model, false);
      part(ball(3), 0xffffff, 0, 6, 6, model, false).scale.z = 0.4;
      model.position.set(crate.x, 0, crate.y);
      scene.add(model);
      crateModels.push(model);
    }
    for (const gate of gates) {
      const model = new THREE.Group();
      for (let n = 0; n < 9; n++) part(block(13, 9, 5), n % 2 ? 0xf8d028 : 0x2a2238, -52 + n * 13, 20, 0, model, false);
      for (const side of [-1, 1]) part(tube(3, 3, 30), 0x6a6e7c, side * 62, 15, 0, model);
      part(cone(9, 22, 3), 0xf07020, -62, 40, 6, model).rotation.z = -Math.PI / 2;
      model.position.set(gate.x, 0, gate.y);
      model.rotation.y = -(gate.turn + Math.PI / 2);
      scene.add(model);
      gateModels.push(model);
    }
  }

  // ----- Things made once and moved about every frame -----
  const mine = makeChibi(LOOKS.you);
  const bike = makeBike();
  const palModel = makeCreature();
  const foeModels = new Map(), peopleModels = new Map();
  // Your cape: a strip of cloth whose corners are moved every frame, so it hangs, flaps and streams
  const capeShape = new THREE.PlaneGeometry(1, 1, 2, 7);
  const cape = new THREE.Mesh(capeShape, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  (function () {
    const colours = [];
    for (let row = 0; row <= 7; row++) for (let col = 0; col <= 2; col++) colours.push(...(row === 7 ? [0.97, 0.82, 0.16] : [0.22, 0.28, 0.85]));
    capeShape.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    cape.castShadow = true;
    cape.frustumCulled = false;
    scene.add(cape);
  })();
  function showCape(x, y, z, angle, flap) {
    const at = capeShape.attributes.position, bx = -Math.cos(angle), bz = -Math.sin(angle), sx = -bz, sz = bx, long = 20 + flap * 12;
    for (let row = 0; row <= 7; row++) for (let col = 0; col <= 2; col++) {
      const t = row / 7, wide = (col - 1) * (5 + t * 4), wave = Math.sin(time * (5 + flap * 12) - t * 5 + col) * (0.6 + flap * 3.4) * t;
      const out = long * t * (0.25 + flap * 0.75), drop = long * t * (1 - flap * 0.78);
      at.setXYZ(row * 3 + col, x + bx * (out + 2) + sx * (wide + wave), y - drop + Math.abs(wave) * 0.5 * flap + flap * t * 3, z + bz * (out + 2) + sz * (wide + wave));
    }
    at.needsUpdate = true;
    capeShape.computeVertexNormals();
  }
  const flatRing = function (inner, outer, colour) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 36), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    return mesh;
  };
  const aimRing = flatRing(30, 34, 0xfff27a), chargeRing = flatRing(84, 90, 0xffffff);
  const warnings = Array.from({ length: 8 }, function () {
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: 0xff3c3c, transparent: true, opacity: 0.4, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2;
    const line = new THREE.Mesh(block(1, 0.6, 3), new THREE.MeshBasicMaterial({ color: 0xff5a5a }));
    scene.add(fill, line);
    return { ring: flatRing(0.93, 1, 0xff5a5a), fill: fill, line: line };
  });
  const shotBalls = Array.from({ length: 14 }, function () {
    const mesh = new THREE.Mesh(ball(6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(mesh);
    mesh.userData.glow = glow(0xffffff, 60, mesh);
    return mesh;
  });
  const sparks = Array.from({ length: 180 }, function () {
    const mesh = new THREE.Mesh(block(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(mesh);
    return mesh;
  });
  const SKIES = [0x9fdcff, 0x8fe2ff, 0xffd2a0, 0xdceaff, 0x34365c];

  let slow = 0, last = performance.now(), lean = 0, back = 130;
  function render() {
    fit();
    const now = performance.now();
    if (renderer.shadowMap.enabled && now - last > 45 && ++slow > 90) {        // on a slow computer, switch the shadows off
      renderer.shadowMap.enabled = sun.castShadow = false;
      renderer.setPixelRatio(1);
      size = 0;
    }
    last = now;
    // The sky and the light change from place to place: bright by the sea, orange in the canyon, dusk in the city
    const here = placeAt(me.x, me.y);
    scene.background.lerp(new THREE.Color(SKIES[here]), 0.03);
    scene.fog.color.copy(scene.background);
    skyLight.intensity += ((here === 4 ? 0.52 : 0.78) - skyLight.intensity) * 0.03;
    sun.intensity += ((here === 4 ? 0.35 : 0.7) - sun.intensity) * 0.03;
    sun.position.set(me.x + 240, 420, me.y + 160);
    sun.target.position.set(me.x, 0, me.y);
    sun.target.updateMatrixWorld();
    // The camera sits behind you. It comes closer and rises if a mountain or a building would get in the way.
    const fx = Math.cos(camTurn), fz = Math.sin(camTurn), wanted = me.riding ? 132 : 125;
    let room = wanted;
    for (let step = 24; step <= wanted; step += 12) {
      const kind = landAt(me.x - fx * step, me.y - fz * step);
      if (kind === RIDGE || kind === BUILDING) {
        room = Math.max(26, step - 14);
        break;
      }
    }
    back += (room - back) * 0.2;
    camera.fov += (60 + (me.riding ? clamp(me.v / 340, 0, 1.4) * 12 : 0) - camera.fov) * 0.1;       // the view widens as you speed up
    camera.updateProjectionMatrix();
    camera.position.set(me.x - fx * back, (me.riding ? 62 : 78) + (wanted - back) * 0.8, me.y - fz * back);
    camera.lookAt(me.x + fx * (me.riding ? 46 : 50), me.riding ? 26 : 18, me.y + fz * (me.riding ? 46 : 50));
    // You, Voltrev and the cape
    const c = lead(), flap = clamp(me.v / 260, 0, 1), mega = over > 0;
    lean += ((me.riding ? -steerNow * clamp(me.v / 200, 0, 1) * 0.32 : 0) - lean) * 0.15;
    bike.show(me.riding ? me.x : pal.x, me.riding ? me.y : pal.y, me.riding ? me.a : pal.a || 0, me.spin, mega && (me.riding || c.id === VOLTREV), lean, me.riding || (c.id === VOLTREV && c.hp > 0 && !(pal.flash > 0 && Math.floor(time * 20) % 2)));
    if (me.riding) {
      mine.pose(me.x - Math.cos(me.a) * 5, 17, me.y - Math.sin(me.a) * 5, me.a, 0, false, true);
      mine.group.rotation.z = lean;
      showCape(me.x - Math.cos(me.a) * 9, 37, me.y - Math.sin(me.a) * 9, me.a, Math.max(0.15, flap));
    } else {
      mine.pose(me.x, 0, me.y, me.a, me.step * 0.5, me.moving, false);
      mine.group.rotation.z = 0;
      showCape(me.x - Math.cos(me.a) * 4, 21, me.y - Math.sin(me.a) * 4, me.a, me.moving ? clamp(me.v / 215, 0.35, 1) : 0);
    }
    showCreature(palModel, picture(c.id === VOLTREV ? 1 : c.id), pal.x, pal.y, pal.a || 0, pal.hop, 0.95, !me.riding && c.id !== VOLTREV && c.hp > 0 && !(pal.flash > 0 && Math.floor(time * 20) % 2));
    // Other people: Gran, and any Rust Riders nearby that you haven't beaten
    const people = [{ id: "gran", look: "gran", x: GRAN.x, y: GRAN.y }].concat(GANG.filter((who) => !state.beaten[who.id]));
    for (const who of people) {
      const near = Math.hypot(who.x - me.x, who.y - me.y) < 900;
      if (near && !peopleModels.has(who.id)) peopleModels.set(who.id, makeChibi(LOOKS[who.look]));
      const model = peopleModels.get(who.id);
      if (!model) continue;
      model.group.visible = near;
      if (near) model.pose(who.x, 0, who.y, Math.atan2(me.y - who.y, me.x - who.x), time * 0.2, false, false);
    }
    for (const who of GANG) if (state.beaten[who.id] && peopleModels.has(who.id)) peopleModels.get(who.id).group.visible = false;
    // Wild Wildlings and the ones the Rust Riders send out
    const live = new Set();
    for (const foe of foes) {
      if (foe.gone <= 0 && Math.hypot(foe.x - me.x, foe.y - me.y) < 1000) {
        live.add(foe);
        if (!foeModels.has(foe)) foeModels.set(foe, makeCreature());
        const angle = foe.mood === "fight" ? Math.atan2(pal.y - foe.y, pal.x - foe.x) : Math.abs(foe.vx) + Math.abs(foe.vy) > 2 ? Math.atan2(foe.vy, foe.vx) : foe.a || 0;
        foe.a = angle;
        showCreature(foeModels.get(foe), picture(foe.c.id), foe.x, foe.y, angle, time * 5 + foe.x, foe.c.big ? 1.8 : foe.legend ? 1.6 : 0.95, !(foe.flash > 0 && Math.floor(time * 20) % 2));
      }
    }
    for (const [foe, model] of foeModels) if (!live.has(foe)) {
      scene.remove(model.group);
      foeModels.delete(foe);
    }
    crateModels.forEach(function (model, n) {
      model.visible = !state.crates[crates[n].id];
      model.position.y = 2 + Math.sin(time * 3 + n) * 1.5;
      model.rotation.y = time * 0.8 + n;
    });
    gateModels.forEach((model, n) => (model.visible = state.story < gates[n].need));
    // Rings and warnings on the ground
    const aim = me.riding ? null : target();
    aimRing.visible = !!aim;
    if (aim) {
      aimRing.position.set(aim.x, 0.8, aim.y);
      aimRing.scale.setScalar(1 + Math.sin(time * 8) * 0.08);
    }
    chargeRing.visible = !!pal.charge;
    if (pal.charge) {
      chargeRing.position.set(pal.charge.aim.x, 0.9, pal.charge.aim.y);
      chargeRing.scale.setScalar(pal.charge.t / 0.5 + 0.15);
      chargeRing.material.color.set(KIND_COLOUR[DEX[c.id].kind]);
    }
    warnings.forEach(function (warning, n) {
      const mark = marks[n];
      warning.ring.visible = warning.fill.visible = !!mark;
      warning.line.visible = !!mark && !!mark.line;
      if (!mark) return;
      const filled = 1 - mark.wind.t / mark.wind.total;
      warning.ring.position.set(mark.x, 0.7, mark.y);
      warning.ring.scale.setScalar(mark.r);
      warning.fill.position.set(mark.x, 0.6, mark.y);
      warning.fill.scale.setScalar(Math.max(0.05, mark.r * filled));
      if (mark.line) {
        const dx = mark.x - mark.foe.x, dz = mark.y - mark.foe.y;
        warning.line.position.set(mark.foe.x + dx / 2, 0.9, mark.foe.y + dz / 2);
        warning.line.scale.set(Math.hypot(dx, dz), 1, 1);
        warning.line.rotation.y = -Math.atan2(dz, dx);
      }
    });
    shotBalls.forEach(function (mesh, n) {
      const shot = shots[n];
      mesh.visible = !!shot;
      if (!shot) return;
      const gone = shot.orb ? 1 - shot.life / shot.total : 0;
      if (shot.orb) mesh.position.set(shot.fx + (shot.aim.x - shot.fx) * gone, 30 + Math.sin(gone * Math.PI) * 50, me.y + (shot.aim.y - me.y) * gone);
      else mesh.position.set(shot.x, 22, shot.y + 24);
      mesh.material.color.set(shot.orb ? 0xe0503a : KIND_COLOUR[shot.kind]);
      mesh.userData.glow.material.color.copy(mesh.material.color);
      mesh.scale.setScalar(shot.orb ? 0.8 : 1);
    });
    sparks.forEach(function (mesh, n) {
      const bit = bits[n];
      mesh.visible = !!bit;
      if (!bit) return;
      mesh.position.set(bit.x, 10 + bit.life * 40 + (n % 5) * 3, bit.y + 20);
      mesh.material.color.set(bit.colour.startsWith("#") ? bit.colour : "#ffffff");
      mesh.scale.setScalar(bit.size * Math.min(1, bit.life * 3));
    });
    renderer.render(scene, camera);
  }
  // Where on the screen (960 by 640) is a place in the world? Used for words that float above things.
  const spot = new THREE.Vector3();
  function project(x, y, high) {
    spot.set(x, high, y).project(camera);
    return spot.z > 1 || Math.abs(spot.x) > 1.1 ? null : { x: Math.round((spot.x + 1) * 480), y: Math.round((1 - spot.y) * 320) };
  }
  return { build: build, render: render, project: project, renderer: renderer };
})();
