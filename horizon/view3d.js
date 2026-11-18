// Wild Horizon in 3D. The game (game.js) works out where everything is on a flat map with heights;
// this file builds the 3D island with THREE.js and shows it from a camera just behind you.

const VIEW = (function () {
  const glCanvas = document.getElementById("view3d");
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8ff);
  scene.fog = new THREE.Fog(0x9fd8ff, 420, 1500);
  const camera = new THREE.PerspectiveCamera(58, 1.5, 2, 1700);
  const skyLight = new THREE.HemisphereLight(0xffffff, 0x9a968a, 0.7);
  const sun = new THREE.DirectionalLight(0xfff1d0, 0.75);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 10, far: 900 });
  sun.shadow.bias = -0.0009;
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
  function add(mesh, x, y, z, parent) {
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    (parent || scene).add(mesh);
    return mesh;
  }
  const paintOf = (colour) => (typeof colour === "object" ? colour : paint(colour));
  const box = (w, h, d, colour, x, y, z, parent) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paintOf(colour)), x, y, z, parent);
  const ball = (r, colour, x, y, z, parent) => add(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), paintOf(colour)), x, y, z, parent);
  const tube = (r1, r2, h, colour, x, y, z, parent) => add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 12), paintOf(colour)), x, y, z, parent);
  // Paint a small picture to wrap over shapes. "tiled" pictures repeat, like wallpaper.
  function picture2(w, h, draw, tiled) {
    const board = document.createElement("canvas");
    board.width = w;
    board.height = h;
    draw(board.getContext("2d"));
    const texture = new THREE.CanvasTexture(board);
    if (tiled) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
    }
    return texture;
  }
  const glowPicture = picture2(64, 64, function (g) {
    const fade = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    fade.addColorStop(0, "rgba(255,255,255,1)");
    fade.addColorStop(0.4, "rgba(255,255,255,0.35)");
    fade.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, 64, 64);
  });
  function glow(colour, width, x, y, z, parent) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowPicture, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sprite.scale.set(width, width, 1);
    sprite.position.set(x, y, z);
    (parent || scene).add(sprite);
    return sprite;
  }

  // ----- People -----
  // A person about 30 units tall, with proper proportions: legs with knees, arms with elbows, shoulders, a neck and a face.
  function makeHuman() {
    const group = new THREE.Group();
    const m = {};
    for (const part of ["skin", "hair", "top", "bottom", "shoes", "hat", "trim"]) m[part] = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const dark = paint(0x2a2230), white = paint(0xffffff);
    const limb = (rTop, rBottom, long, mat, parent) => add(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, long, 10), mat), 0, -long / 2, 0, parent);
    const joint = (r, mat, y, parent) => add(new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat), 0, y, 0, parent);
    const legs = [], knees = [], arms = [], elbows = [], thighs = [], shins = [], forearms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();                      // swings from the hip
      leg.position.set(side * 1.75, 15.2, 0);
      thighs.push(limb(1.65, 1.3, 7.2, m.bottom, leg));
      const knee = new THREE.Group();                     // bends at the knee
      knee.position.y = -7.2;
      joint(1.28, m.bottom, 0, knee);
      shins.push(limb(1.25, 0.9, 6.6, m.bottom, knee));
      const shoe = add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), m.shoes), 0, -6.9, 0.9, knee);
      shoe.scale.set(1, 0.72, 1.95);
      box(2, 0.35, 4.2, dark, 0, -7.65, 0.9, knee);       // the sole
      leg.add(knee);
      group.add(leg);
      legs.push(leg);
      knees.push(knee);
      const arm = new THREE.Group();                      // swings from the shoulder
      arm.position.set(side * 4.35, 23.7, 0);
      joint(1.45, m.top, 0, arm);
      limb(1.2, 1, 5.5, m.top, arm);
      const elbow = new THREE.Group();
      elbow.position.y = -5.5;
      joint(0.98, m.top, 0, elbow);
      forearms.push(limb(0.98, 0.74, 5, m.top, elbow));
      const hand = add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 9, 7), m.skin), 0, -5.7, 0.1, elbow);
      hand.scale.set(0.8, 1.2, 0.55);
      arm.add(elbow);
      arm.rotation.z = side * 0.07;
      group.add(arm);
      arms.push(arm);
      elbows.push(elbow);
    }
    const pelvis = add(new THREE.Mesh(new THREE.SphereGeometry(3.1, 12, 9), m.bottom), 0, 15.4, 0, group);
    pelvis.scale.set(1.08, 0.72, 0.72);
    const chest = add(new THREE.Mesh(new THREE.CylinderGeometry(3.75, 2.9, 8.8, 14), m.top), 0, 20.2, 0, group);
    chest.scale.z = 0.6;
    const shoulders = add(new THREE.Mesh(new THREE.SphereGeometry(3.75, 14, 8), m.top), 0, 24.5, 0, group);
    shoulders.scale.set(1.02, 0.34, 0.6);
    const skirt = add(new THREE.Mesh(new THREE.CylinderGeometry(3.1, 4.7, 5.2, 14), m.bottom), 0, 13.3, 0, group);
    skirt.scale.z = 0.8;
    const zip = box(0.7, 8.8, 0.25, m.trim, 0, 20.2, 2.22, group);       // a jacket's zip and collar
    const collar = add(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.6, 1.4, 12), m.trim), 0, 24.9, 0, group);
    const hood = add(new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 8), m.top), 0, 24.9, -1.7, group);
    hood.scale.set(1.25, 0.75, 0.9);
    tube(0.98, 1.1, 1.9, m.skin, 0, 25.5, 0, group);                      // the neck
    const head = new THREE.Group();
    head.position.y = 28.1;
    group.add(head);
    add(new THREE.Mesh(new THREE.SphereGeometry(2.35, 20, 16), m.skin), 0, 0.15, 0, head).scale.set(0.9, 1.06, 0.98);
    add(new THREE.Mesh(new THREE.SphereGeometry(1.75, 14, 10), m.skin), 0, -1.05, 0.28, head).scale.set(0.92, 0.9, 0.95);      // the jaw and chin
    for (const side of [-1, 1]) {
      const eye = add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), white), side * 0.82, 0.2, 1.92, head);
      eye.scale.set(1.15, 0.8, 0.5);
      eye.castShadow = false;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), dark), side * 0.82, 0.2, 2.1, head).castShadow = false;
      box(0.95, 0.17, 0.2, m.hair, side * 0.84, 0.82, 2.08, head).castShadow = false;       // eyebrows
      add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), m.skin), side * 2.08, -0.05, 0, head).scale.set(0.5, 1, 0.8);      // ears
    }
    const nose = add(new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.95, 6), m.skin), 0, -0.3, 2.32, head);
    nose.rotation.x = 1.25;
    nose.castShadow = false;
    box(1, 0.15, 0.15, paint(0xb8504a), 0, -1.12, 2.02, head).castShadow = false;           // mouth
    const cap = function (parent) {
      const top = add(new THREE.Mesh(new THREE.SphereGeometry(2.55, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m.hair), 0, 0.3, -0.22, parent);
      top.scale.set(0.94, 1.06, 1.04);
      box(3.6, 0.9, 0.5, m.hair, 0, 1.75, 1.95, parent).rotation.x = -0.5;                  // a fringe
    };
    const styles = { short: new THREE.Group(), long: new THREE.Group(), ponytail: new THREE.Group(), spiky: new THREE.Group(), bun: new THREE.Group(), bald: new THREE.Group() };
    for (const style of ["short", "long", "ponytail", "spiky", "bun"]) cap(styles[style]);
    const curtain = add(new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.9, 7.4, 12, 1, true, Math.PI * 0.55, Math.PI * 0.9), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })), 0, -3, -0.1, styles.long);
    curtain.material = m.hair;
    m.hair.side = THREE.DoubleSide;
    const tail = add(new THREE.Mesh(new THREE.ConeGeometry(0.95, 6, 8), m.hair), 0, -1.6, -2.9, styles.ponytail);
    tail.rotation.x = Math.PI + 0.25;
    ball(0.75, m.hair, 0, 1.3, -2.5, styles.ponytail);
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7, r = i === 8 ? 0 : 1.5;
      const spike = add(new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.4, 6), m.hair), Math.cos(a) * r, 2.9, Math.sin(a) * r - 0.2, styles.spiky);
      spike.rotation.set(Math.sin(a) * 0.5 * (r ? 1 : 0), 0, -Math.cos(a) * 0.5 * (r ? 1 : 0));
    }
    ball(1.35, m.hair, 0, 2.6, -1.5, styles.bun);
    for (const style in styles) head.add(styles[style]);
    const hats = { none: new THREE.Group(), cap: new THREE.Group(), beanie: new THREE.Group() };
    tube(2.6, 2.7, 1.5, m.hat, 0, 1.9, -0.2, hats.cap);
    box(3.6, 0.3, 2.6, m.hat, 0, 1.35, 2.7, hats.cap);
    add(new THREE.Mesh(new THREE.SphereGeometry(2.72, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), m.hat), 0, 0.75, -0.2, hats.beanie);
    tube(2.78, 2.78, 0.8, m.trim, 0, 0.95, -0.2, hats.beanie);
    ball(0.7, m.trim, 0, 3.7, -0.2, hats.beanie);
    for (const hat in hats) head.add(hats[hat]);
    let wearing = "";
    return {
      group: group,
      // Change the colours and shapes to match an outfit (a list of choices from OUTFIT in game.js)
      dress: function (outfit) {
        const key = JSON.stringify(outfit);
        if (key === wearing) return;
        wearing = key;
        const pick = (part) => OUTFIT[part][outfit[part] % OUTFIT[part].length];
        for (const part of ["skin", "hair", "top", "bottom", "shoes"]) m[part].color.set(pick(part));
        m.hat.color.set(pick("hatColour"));
        m.trim.color.set(pick("top")).multiplyScalar(0.6);
        const top = pick("topStyle"), bottom = pick("bottomStyle"), hat = pick("hat");
        let hair = pick("hairStyle");
        if (hat !== "none" && (hair === "spiky" || hair === "bun")) hair = "short";       // (these don't fit under a hat)
        for (const style in styles) styles[style].visible = style === hair;
        for (const each in hats) hats[each].visible = each === hat;
        zip.visible = collar.visible = top === "jacket";
        hood.visible = top === "hoodie";
        skirt.visible = bottom === "skirt";
        for (const forearm of forearms) forearm.material = top === "T-shirt" ? m.skin : m.top;
        for (const shin of shins) shin.material = bottom === "trousers" ? m.bottom : m.skin;
        for (const thigh of thighs) thigh.material = bottom === "skirt" ? m.skin : m.bottom;
        for (const knee of knees) knee.children[0].material = bottom === "trousers" ? m.bottom : m.skin;
      },
      // Stand at a place, face a way, and walk: hips and shoulders swing, knees and elbows bend
      // ("high" is how far up the ground is here; "sitting" is for riding)
      pose: function (x, z, facing, walk, moving, high, sitting) {
        let turn = facing - group.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        group.rotation.y += turn * 0.3;
        const phase = walk * 10.5;
        [0, 1].forEach(function (n) {
          const swing = moving ? Math.sin(phase + n * Math.PI) : 0;
          legs[n].rotation.x = -swing * 0.62;
          knees[n].rotation.x = moving ? 0.12 + Math.max(0, Math.sin(phase + n * Math.PI - 1.9)) * 1.05 : 0.03;
          arms[n].rotation.x = swing * 0.55;
          elbows[n].rotation.x = moving ? -0.45 - Math.max(0, swing) * 0.35 : -0.12;
        });
        chest.rotation.y = shoulders.rotation.y = moving ? Math.sin(phase) * 0.09 : 0;
        head.rotation.x = moving ? 0 : Math.sin(walk * 2 + x) * 0.03;
        if (sitting) [0, 1].forEach(function (n) {
          legs[n].rotation.set(-1.35, 0, n ? -0.35 : 0.35);
          knees[n].rotation.x = 1.25;
          arms[n].rotation.x = -0.75;
          elbows[n].rotation.x = -0.5;
        });
        else [0, 1].forEach((n) => (legs[n].rotation.z = 0));
        group.position.set(x, (high || 0) + (moving ? Math.abs(Math.cos(phase)) * 0.5 : 0), z);
      },
    };
  }
  const FACING = [0, -Math.PI / 2, Math.PI / 2, Math.PI];        // which way a trainer turns for down, left, right, up

  // ----- Wildlings in 3D: each pixel of the creature's picture becomes a little block, thicker in the middle -----
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
  const GRAIN = 1.3;          // how big each little block is
  function shapeOf(img) {
    if (img.shape3d) return img.shape3d;
    const data = img.getContext("2d").getImageData(0, 0, 56, 56).data;
    const at = (cx, cy) => {
      const i = (cy * 2 * 56 + cx * 2) * 4;
      return data[i + 3] ? [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255] : null;
    };
    const out = { position: [], normal: [], color: [], index: [] };
    let top = 0;
    for (let cy = 0; cy < 28; cy++) {
      let first = 28, last = -1;
      for (let cx = 0; cx < 28; cx++) if (at(cx, cy)) {
        first = Math.min(first, cx);
        last = cx;
      }
      if (last < 0) continue;
      top = Math.max(top, (28 - cy) * GRAIN);
      const middle = (first + last + 1) / 2, half = (last - first + 1) / 2;
      for (let cx = first; cx <= last; cx++) {
        const colour = at(cx, cy);
        if (!colour) continue;
        const across = (cx + 0.5 - middle) / half;
        const deep = Math.max(1.6, Math.min(half, 7) * 1.7 * Math.sqrt(Math.max(0.06, 1 - across * across)));
        blockInto(out, (cx - 13.5) * GRAIN, (27.5 - cy) * GRAIN, 0, GRAIN, GRAIN, deep * GRAIN, colour);
      }
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute("position", new THREE.Float32BufferAttribute(out.position, 3));
    shape.setAttribute("normal", new THREE.Float32BufferAttribute(out.normal, 3));
    shape.setAttribute("color", new THREE.Float32BufferAttribute(out.color, 3));
    shape.setIndex(out.index);
    shape.userData.top = top;
    return (img.shape3d = shape);
  }
  const gold = new THREE.MeshPhongMaterial({ color: 0xffd84a, emissive: 0x8a5a00, shininess: 100 });
  function makeCreature() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(shapeOf(picture(1)), blocksPaint);
    body.castShadow = true;
    group.add(body);
    const crown = new THREE.Group();          // the golden spikes of a Star form
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(1.6, i === 2 ? 9 : 6, 6), gold);
      spike.position.set((i - 2) * 4.4, i === 2 ? 4.5 : 3 - Math.abs(i - 2), 0);
      spike.rotation.z = -(i - 2) * 0.25;
      crown.add(spike);
    }
    group.add(crown);
    const aura = glow(0xffe070, 70, 0, 14, 0, group);
    scene.add(group);
    return { group: group, body: body, crown: crown, aura: aura, img: null };
  }
  function showCreature(model, img, x, z, facing, hop, star, visible, size, high) {
    model.group.visible = visible;
    if (!visible) return;
    if (model.img !== img) {
      model.img = img;
      model.body.geometry = shapeOf(img);
      model.body.rotation.y = img.side ? Math.PI / 2 : 0;        // (pictures drawn from the side are turned to face forwards)
    }
    model.crown.visible = model.aura.visible = star;
    model.crown.position.y = model.body.geometry.userData.top;
    model.group.scale.setScalar(size * (star ? 1.4 : 1));
    model.group.position.set(x, high + Math.abs(Math.sin(hop)) * 3 * size, z);
    let turn = facing - model.group.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    model.group.rotation.y += turn * 0.25;
  }

  // ----- The island -----
  // Everything that never moves is collected into big lumps (one per piece of the map and per paint), so it draws fast.
  const PIECE = 32;            // a lump covers 32 by 32 squares
  const lumps = new Map();
  const walls = {};            // the paints: walls, shopfronts, roofs and ground
  const lampGlowPaint = new THREE.PointsMaterial({ map: glowPicture, color: 0xffd890, size: 70, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const litBulb = new THREE.MeshLambertMaterial({ color: 0xfff6c8 });
  const fences = [];
  let beacon = null;
  function lumpFor(name, x, z) {
    const key = Math.floor(x / (PIECE * TILE)) + "," + Math.floor(z / (PIECE * TILE)) + "|" + name;
    if (!lumps.has(key)) lumps.set(key, { name: name, position: [], normal: [], uv: [], color: [] });
    return lumps.get(key);
  }
  // Add one flat four-cornered piece (corners in order round the edge), wound so that it faces along "n"
  function quad(name, a, b, c, d, n, uvs, tint) {
    const out = lumpFor(name, (a[0] + c[0]) / 2, (a[2] + c[2]) / 2);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const facing = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
    const order = facing >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    const corners = [a, b, c, d];
    for (const i of order) {
      out.position.push(...corners[i]);
      out.normal.push(...n);
      out.uv.push(...uvs[i]);
      out.color.push(...(tint || [1, 1, 1]));
    }
  }
  const STOREY = 13;           // how tall each floor is
  const TINTS = [[1, 1, 1], [0.97, 0.95, 0.91]];
  // The four walls of a box, with a picture repeated along them (once per square wide, "up" times high)
  function wallsOf(name, x0, x1, z0, z1, y0, y1, up, tint, inset, lean) {
    const a = inset || 0;
    const side = function (p, q, n, wide) {
      const top = (corner, other) => [corner[0] + Math.sign(other[0] - corner[0]) * a + n[0] * -a, y1, corner[2] + Math.sign(other[2] - corner[2]) * a + n[2] * -a];
      quad(name, [p[0], y0, p[2]], [q[0], y0, q[2]], top(q, p), top(p, q), lean ? [n[0] * 0.8, 0.6, n[2] * 0.8] : n, [[0, 0], [wide, 0], [wide, up], [0, up]], tint);
    };
    side([x0, 0, z1], [x1, 0, z1], [0, 0, 1], (x1 - x0) / TILE);
    side([x1, 0, z0], [x0, 0, z0], [0, 0, -1], (x1 - x0) / TILE);
    side([x1, 0, z1], [x1, 0, z0], [1, 0, 0], (z1 - z0) / TILE);
    side([x0, 0, z0], [x0, 0, z1], [-1, 0, 0], (z1 - z0) / TILE);
  }
  function build() {
    // Paints for the ground: plain colours with a few speckles
    const groundPaint = (colour, speckles, count) => new THREE.MeshLambertMaterial({ map: picture2(64, 64, function (g) {
      g.fillStyle = colour;
      g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < (count || 0); i++) {
        g.fillStyle = speckles[i % speckles.length];
        g.fillRect(Math.floor(Math.random() * 62), Math.floor(Math.random() * 62), 2, 3);
      }
    }, true), vertexColors: true });
    walls.g0 = groundPaint("#74c45e", ["#68b854", "#82d06c"], 110);      // meadow
    walls.g1 = groundPaint("#559e4c", ["#4b9244", "#63ac58"], 110);      // forest floor
    walls.g2 = groundPaint("#dcc888", ["#ceb876", "#e8d69c"], 80);       // sand
    walls.g3 = groundPaint("#dfe8f2", ["#ccd8e6"], 60);                  // snow
    walls.g4 = groundPaint("#9aaa68", ["#8c9c5c", "#a8ba78"], 110);      // moor
    walls.g5 = groundPaint("#c8a878", ["#ba9a68", "#d4b688"], 80);       // path
    walls.g6 = groundPaint("#b8b0a0", ["#a8a090"], 30);                  // town paving
    walls.cliff = groundPaint("#8c8072", ["#7a6e62", "#9c9082", "#6e6458"], 160);
    walls.bank = groundPaint("#c8b684", ["#b8a674"], 60);
    walls.heal = new THREE.MeshLambertMaterial({ color: 0xfce4ea, vertexColors: true });
    walls.shop = new THREE.MeshLambertMaterial({ color: 0xe0ecfc, vertexColors: true });
    walls.hall = new THREE.MeshLambertMaterial({ color: 0xf8ecc8, vertexColors: true });
    walls.roofheal = new THREE.MeshLambertMaterial({ color: 0xf07898, vertexColors: true });
    walls.roofshop = new THREE.MeshLambertMaterial({ color: 0x5888e8, vertexColors: true });
    walls.roofhall = new THREE.MeshLambertMaterial({ color: 0xf0a830, vertexColors: true });
    walls.door = new THREE.MeshLambertMaterial({ color: 0x6a4428, vertexColors: true });
    const up = [0, 1, 0];
    // The tops of the land, a strip of same-kind squares at a time
    for (let ty = 0; ty < CH; ty++) {
      let from = 0;
      for (let tx = 1; tx <= CW; tx++) {
        if (tx < CW && floor[ty][tx] === floor[ty][from] && level[ty][tx] === level[ty][from] && tx % PIECE !== 0) continue;
        const kind = floor[ty][from], x0 = from * TILE, x1 = tx * TILE, z0 = ty * TILE, z1 = z0 + TILE, y = level[ty][from] * STEP_UP;
        if (kind < WATER) quad("g" + kind, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], up, [[x0 / 32, z1 / 32], [x1 / 32, z1 / 32], [x1 / 32, z0 / 32], [x0 / 32, z0 / 32]]);
        from = tx;
      }
    }
    // Cliffs wherever the land steps down, and a little bank down into the water
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CW; tx++) {
      if (floor[ty][tx] >= WATER) continue;
      const y = level[ty][tx] * STEP_UP, x0 = tx * TILE, x1 = x0 + TILE, z0 = ty * TILE, z1 = z0 + TILE;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + ax, ny = ty + ay, off = nx < 0 || ny < 0 || nx >= CW || ny >= CH;
        const low = off || floor[ny][nx] >= WATER ? -7 : level[ny][nx] * STEP_UP;
        if (low >= y) continue;
        const name = low < 0 && y === 0 ? "bank" : "cliff", uvs = [[0, 0], [1, 0], [1, (y - low) / 16], [0, (y - low) / 16]];
        if (ax) { const x = ax > 0 ? x1 : x0; quad(name, [x, low, z1], [x, low, z0], [x, y, z0], [x, y, z1], [ax, 0, 0], uvs); }
        else { const z = ay > 0 ? z1 : z0; quad(name, [x0, low, z], [x1, low, z], [x1, y, z], [x0, y, z], [0, 0, ay], uvs); }
      }
    }
    // Houses: walls, a sloping roof and a door
    for (const b of buildings) {
      const y = b.town.lv * STEP_UP, x0 = b.x * TILE + 3, x1 = (b.x + b.w) * TILE - 3, z0 = b.y * TILE + 3, z1 = (b.y + b.h) * TILE - 3, high = b.kind === "hall" ? 34 : 24;
      wallsOf(b.kind, x0, x1, z0, z1, y, y + high, 1, null);
      wallsOf("roof" + b.kind, x0 - 3, x1 + 3, z0 - 3, z1 + 3, y + high, y + high + 16, 1, null, Math.min(x1 - x0, z1 - z0) / 2 - 1, true);
      const mx = (x0 + x1) / 2;
      quad("door", [mx - 6, y, z1 + 0.3], [mx + 6, y, z1 + 0.3], [mx + 6, y + 15, z1 + 0.3], [mx - 6, y + 15, z1 + 0.3], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    for (const lump of lumps.values()) {
      const shape = new THREE.BufferGeometry();
      shape.setAttribute("position", new THREE.Float32BufferAttribute(lump.position, 3));
      shape.setAttribute("normal", new THREE.Float32BufferAttribute(lump.normal, 3));
      shape.setAttribute("uv", new THREE.Float32BufferAttribute(lump.uv, 2));
      shape.setAttribute("color", new THREE.Float32BufferAttribute(lump.color, 3));
      const mesh = new THREE.Mesh(shape, walls[lump.name]);
      mesh.castShadow = lump.name[0] !== "g";
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.MeshPhongMaterial({ color: 0x3a8ee0, shininess: 120, specular: 0xffffff, transparent: true, opacity: 0.9 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(MID * TILE, -2.5, MID * TILE);
    scene.add(sea);
    const seabed = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), paint(0x2a6ab8));
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.set(MID * TILE, -7, MID * TILE);
    scene.add(seabed);

    // Trees, cactuses and boulders, glued together a piece of the map at a time
    const piles = new Map();
    const keep = function (mesh) {
      const name = Math.floor(mesh.position.x / (PIECE * TILE)) + "," + Math.floor(mesh.position.z / (PIECE * TILE)) + mesh.material.uuid;
      if (!piles.has(name)) piles.set(name, { material: mesh.material, position: [], normal: [] });
      mesh.updateMatrix();
      let shape = mesh.geometry.clone().applyMatrix4(mesh.matrix);
      if (shape.index) shape = shape.toNonIndexed();
      piles.get(name).position.push(shape.attributes.position.array);
      piles.get(name).normal.push(shape.attributes.normal.array);
    };
    const leaf = new THREE.IcosahedronGeometry(1, 1), trunk = new THREE.CylinderGeometry(0.75, 1, 1, 6), spike = new THREE.ConeGeometry(1, 1, 7), lump = new THREE.DodecahedronGeometry(1);
    const place = function (shape, colour, x, y, z, sx, sy, sz) {
      const mesh = new THREE.Mesh(shape, paintOf(colour));
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      keep(mesh);
    };
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CW; tx++) {
      const kind = tiles[ty][tx];
      if (kind !== TREE && kind !== BOULDER) continue;
      const x = tx * TILE + 8, z = ty * TILE + 8, y = level[ty][tx] * STEP_UP, big = 0.8 + hash(tx, ty, 63) * 0.6, under = floor[ty][tx];
      if (kind === BOULDER) place(lump, under === SNOW ? 0xc8d4e0 : under === SAND ? 0xc8a070 : 0x8a8478, x, y + 4 * big, z, 8 * big, 6 * big, 7 * big);
      else if (under === SAND) {                // a cactus
        place(trunk, 0x4a9a50, x, y + 9 * big, z, 3, 18 * big, 3);
        place(trunk, 0x4a9a50, x + 4, y + 11 * big, z, 1.8, 8 * big, 1.8);
        place(trunk, 0x4a9a50, x - 4, y + 8 * big, z, 1.8, 7 * big, 1.8);
      } else if (under === SNOW) {              // a snowy pine
        place(trunk, 0x6a4a30, x, y + 4, z, 2, 8, 2);
        place(spike, 0x2f7a5a, x, y + 14 * big, z, 9 * big, 16 * big, 9 * big);
        place(spike, 0x3a8a66, x, y + 24 * big, z, 6.5 * big, 13 * big, 6.5 * big);
        place(spike, 0xf2f6fc, x, y + 31 * big, z, 3.6 * big, 7 * big, 3.6 * big);
      } else {
        const tall = under === WOOD ? 1.35 : 1;
        place(trunk, 0x7a5230, x, y + 8 * big * tall, z, 2.2, 16 * big * tall, 2.2);
        place(leaf, under === WOOD ? 0x2f8a3c : 0x3aa858, x, y + 22 * big * tall, z, 10 * big, 9 * big, 10 * big);
        place(leaf, hash(ty, tx, 64) < 0.5 ? 0x4cbc62 : 0x2f9a4c, x + 4 * big, y + 28 * big * tall, z - 2, 7 * big, 6.5 * big, 7 * big);
      }
    }
    for (const pile of piles.values()) {
      const shape = new THREE.BufferGeometry();
      for (const part of ["position", "normal"]) {
        const all = new Float32Array(pile[part].reduce((sum, list) => sum + list.length, 0));
        let at = 0;
        for (const list of pile[part]) {
          all.set(list, at);
          at += list.length;
        }
        shape.setAttribute(part, new THREE.BufferAttribute(all, 3));
      }
      const mesh = new THREE.Mesh(shape, pile.material);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    }
    // A beam of light over each sleeping Elder, so you can find it from far away
    for (const elder of ELDERS) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 10, 500, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.set(elder.x, heightAt(elder.x, elder.y) + 250, elder.y);
      scene.add(beam);
      elder.beam = beam;
    }
  }

  // ----- Things made once and moved about every frame -----
  const mine = makeHuman();
  scene.add(mine.group);
  const others = Array.from({ length: 10 }, function () {
    const human = makeHuman();
    scene.add(human.group);
    return human;
  });
  const palModel = makeCreature();
  const rideModel = makeCreature();         // Zephyrun, the Wildling you ride
  const elderModels = ELDERS.map(() => makeCreature());
  const foeModels = new Map();
  const flat = (mesh) => {
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    return mesh;
  };
  const aimRing = flat(new THREE.Mesh(new THREE.RingGeometry(13, 15, 28), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.9, depthWrite: false })));
  const chargeRing = flat(new THREE.Mesh(new THREE.RingGeometry(46, 50, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })));
  const warnings = Array.from({ length: 8 }, () => ({
    ring: flat(new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 36), new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.95, depthWrite: false }))),
    fill: flat(new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: 0xff3c3c, transparent: true, opacity: 0.4, depthWrite: false }))),
    line: add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 1.6), new THREE.MeshBasicMaterial({ color: 0xff5a5a })), 0, 0, 0),
  }));
  const shotBalls = Array.from({ length: 14 }, function () {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(mesh);
    mesh.userData.glow = glow(0xffffff, 34, 0, 0, 0, mesh);
    return mesh;
  });
  const sparks = Array.from({ length: 160 }, function () {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(mesh);
    return mesh;
  });
  let slow = 0, last = performance.now();
  function render() {
    fit();
    // On a slow computer, switch the shadows off so the game stays smooth
    const now = performance.now();
    if (renderer.shadowMap.enabled && now - last > 45 && ++slow > 90) {
      renderer.shadowMap.enabled = sun.castShadow = false;
      renderer.setPixelRatio(1);
      size = 0;
    }
    last = now;
    const dark = clock < 0.52 ? (clock < 0.04 ? 1 - clock / 0.04 : 0) : Math.min(1, (clock - 0.52) / 0.08);
    const sky = new THREE.Color(0x9fd8ff).lerp(new THREE.Color(0x0e1440), dark);
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    skyLight.intensity = 0.74 - dark * 0.26;
    skyLight.color.set(0xffffff).lerp(new THREE.Color(0x8a9af0), dark);
    sun.intensity = 0.72 * (1 - dark) + 0.16;
    sun.color.set(0xfff1d0).lerp(new THREE.Color(0x8a9af0), dark);
    sun.position.set(me.x + 150, me.h + 260, me.y + 110);
    sun.target.position.set(me.x, me.h, me.y);
    sun.target.updateMatrixWorld();
    // The camera sits behind you and a little above, and never sinks into a hillside
    const dressing = mode === "outfit";
    if (dressing) {
      const side = look + 0.3;
      camera.position.set(me.x + Math.sin(side) * 44, me.h + 21, me.y + Math.cos(side) * 44);
      camera.lookAt(me.x + Math.cos(look) * -9, me.h + 16, me.y + Math.sin(look) * 9);
    } else {
      const back = 62 * zoom * (me.riding ? 1.25 : 1);
      const cx = me.x + Math.sin(look) * back, cz = me.y + Math.cos(look) * back;
      camera.position.set(cx, Math.max(me.h + 16 + back * 0.42 * Math.max(0.9, zoom), heightAt(cx, cz) + 14), cz);
      camera.lookAt(me.x - Math.sin(look) * 14, me.h + (me.riding ? 28 : 17), me.y - Math.cos(look) * 14);
    }
    // You, and your ride
    const swimming = me.riding && tileAt(me.x, me.y) === WATER, rideHigh = me.h - (swimming ? 9 : 0);
    mine.dress(state.outfit);
    mine.pose(me.x, me.y, dressing ? look + Math.sin(time * 0.8) * 0.9 : me.face, me.anim, me.moving && !dressing && !me.riding, me.riding && !dressing ? rideHigh + 24 : me.h, me.riding && !dressing);
    showCreature(rideModel, rideArt(), me.x, me.y, me.face, me.moving ? me.anim * 9 : 0, false, me.riding && !dressing, 1.25, rideHigh);
    // Other people: the ten nearest
    const people = leaders.concat(trainers).filter((who) => Math.hypot(who.x - me.x, who.y - me.y) < 800).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    others.forEach(function (human, n) {
      const who = people[n];
      human.group.visible = !!who && !dressing;
      if (!human.group.visible) return;
      human.dress(who.outfit);
      human.pose(who.x, who.y, Math.atan2(me.x - who.x, me.y - who.y), who.anim, false, heightAt(who.x, who.y), false);
    });
    // Wildlings
    const aim = dressing ? null : target();
    if (state.team.length) {
      const c = lead();
      const facing = aim ? Math.atan2(aim.x - pal.x, aim.y - pal.y) : me.face;
      showCreature(palModel, picture(c.id), pal.x, pal.y, facing, pal.hop, surging > 0, !dressing && !me.riding && c.hp > 0 && !(pal.flash > 0 && Math.floor(time * 20) % 2), 0.62, heightAt(pal.x, pal.y));
    } else palModel.group.visible = false;
    const live = new Set();
    for (const foe of foes) {
      if (foe.gone > 0 || Math.abs(foe.x - me.x) > 800 || Math.abs(foe.y - me.y) > 800) continue;
      live.add(foe);
      if (!foeModels.has(foe)) foeModels.set(foe, makeCreature());
      const facing = foe.angry || !foe.wild ? Math.atan2(pal.x - foe.x, pal.y - foe.y) : foe.legend ? Math.atan2(me.x - foe.x, me.y - foe.y) : Math.atan2(foe.vx || 0, foe.vy || 1);
      showCreature(foeModels.get(foe), picture(foe.c.id), foe.x, foe.y, facing, foe.raid ? time * 2 : time * 5 + foe.x, false, !dressing && !(foe.flash > 0 && Math.floor(time * 20) % 2), foe.raid ? 2.6 : foe.legend ? 1.2 : 0.62, heightAt(foe.x, foe.y));
    }
    for (const [foe, model] of foeModels) if (!live.has(foe)) {
      scene.remove(model.group);
      foeModels.delete(foe);
    }
    // Sleeping Elders: huge, and slowly breathing
    ELDERS.forEach(function (elder, n) {
      const asleep = !state[elder.gives] && !(raid && raid.elder === elder) && !dressing;
      elder.beam.visible = asleep;
      showCreature(elderModels[n], picture(elder.id), elder.x, elder.y, 0, 0, false, asleep, 2.4 + Math.sin(time * 1.2) * 0.05, heightAt(elder.x, elder.y));
    });
    // Rings and warnings on the ground
    aimRing.visible = !!aim;
    if (aim) {
      aimRing.position.set(aim.x, heightAt(aim.x, aim.y) + 0.6, aim.y);
      aimRing.scale.setScalar(1 + Math.sin(time * 8) * 0.08);
    }
    chargeRing.visible = !!pal.charge;
    if (pal.charge) {
      chargeRing.position.set(pal.charge.aim.x, heightAt(pal.charge.aim.x, pal.charge.aim.y) + 0.7, pal.charge.aim.y);
      chargeRing.scale.setScalar(pal.charge.t / 0.5 + 0.15);
      chargeRing.material.color.set(KIND_COLOUR[DEX[lead().id].kind]);
    }
    warnings.forEach(function (warning, n) {
      const mark = dressing ? null : marks[n];
      warning.ring.visible = warning.fill.visible = !!mark;
      warning.line.visible = !!mark && mark.kind === "line";
      if (!mark) return;
      const part = 1 - mark.wind.t / mark.wind.total, y = heightAt(mark.x, mark.y);
      warning.ring.position.set(mark.x, y + 0.5, mark.y);
      warning.ring.scale.setScalar(mark.r);
      warning.fill.position.set(mark.x, y + 0.45, mark.y);
      warning.fill.scale.setScalar(Math.max(0.05, mark.r * part));
      if (mark.kind === "line") {
        const dx = mark.x - mark.foe.x, dz = mark.y - mark.foe.y;
        warning.line.position.set(mark.foe.x + dx / 2, y + 0.6, mark.foe.y + dz / 2);
        warning.line.scale.set(Math.hypot(dx, dz), 1, 1);
        warning.line.rotation.y = -Math.atan2(dz, dx);
      }
    });
    shotBalls.forEach(function (mesh, n) {
      const shot = shots[n];
      mesh.visible = !!shot;
      if (!shot) return;
      const part = shot.orb ? 1 - shot.life / shot.total : 0;
      if (shot.orb) mesh.position.set(shot.fx + (shot.aim.x - shot.fx) * part, me.h + 16 + Math.sin(part * Math.PI) * 26, me.y + (shot.aim.y - me.y) * part);
      else mesh.position.set(shot.x, me.h + 12, shot.y + 12);
      mesh.material.color.set(shot.orb ? 0xe0503a : KIND_COLOUR[shot.kind]);
      mesh.userData.glow.material.color.copy(mesh.material.color);
      mesh.scale.setScalar(shot.orb ? 0.8 : 1);
    });
    sparks.forEach(function (mesh, n) {
      const bit = bits[n];
      mesh.visible = !!bit;
      if (!bit) return;
      mesh.position.set(bit.x, me.h + 8 + bit.life * 26 + (n % 5) * 2, bit.y + 12);
      mesh.material.color.set(bit.colour);
      mesh.scale.setScalar(Math.min(1.4, bit.life * 3));
    });
    renderer.render(scene, camera);
  }
  // Where on the screen (480 by 320) is a place on the island? Used for words that float above things.
  const spot = new THREE.Vector3();
  function project(x, y, high) {
    spot.set(x, high, y).project(camera);
    return spot.z > 1 || Math.abs(spot.x) > 1.2 ? null : { x: Math.round((spot.x + 1) * 240), y: Math.round((1 - spot.y) * 160) };
  }
  return { build: build, render: render, project: project, renderer: renderer };
})();
