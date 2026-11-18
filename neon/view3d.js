// Neon City in 3D. The game (game.js) works out where everything is on a flat map;
// this file builds the 3D city with THREE.js and shows it from a camera just behind you.

const VIEW = (function () {
  const glCanvas = document.getElementById("view3d");
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8ff);
  scene.fog = new THREE.Fog(0x9fd8ff, 260, 1150);
  const camera = new THREE.PerspectiveCamera(58, 1.5, 2, 1300);
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
      pose: function (x, z, facing, walk, moving) {
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
        group.position.set(x, moving ? Math.abs(Math.cos(phase)) * 0.5 : 0, z);
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
  const shapes = [];
  const blocksPaint = new THREE.MeshLambertMaterial({ vertexColors: true });
  function creatureShape(id) {
    if (shapes[id]) return shapes[id];
    const data = picture(id).getContext("2d").getImageData(0, 0, 32, 32).data;
    const at = (px, py) => {
      const i = (py * 32 + px) * 4;
      return data[i + 3] ? [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255] : null;
    };
    const out = { position: [], normal: [], color: [], index: [] };
    let top = 0;
    for (let cy = 0; cy < 16; cy++) {
      let first = 16, last = -1;
      for (let cx = 0; cx < 16; cx++) if (at(cx * 2, cy * 2)) {
        first = Math.min(first, cx);
        last = cx;
      }
      if (last < 0) continue;
      top = Math.max(top, (16 - cy) * 2);
      const middle = (first + last + 1) / 2, half = (last - first + 1) / 2;
      for (let cx = first; cx <= last; cx++) {
        const colour = at(cx * 2, cy * 2);
        if (!colour) continue;
        const across = (cx + 0.5 - middle) / half;
        const deep = Math.max(2, half * 2.6 * Math.sqrt(Math.max(0.05, 1 - across * across)));
        blockInto(out, (cx - 7.5) * 2, (15.5 - cy) * 2, 0, 2, 2, deep, colour);
        for (const px of [cx * 2, cx * 2 + 1]) {          // the dark middle of an eye
          const pupil = at(px, cy * 2 + 1);
          if (colour[0] > 0.95 && colour[1] > 0.95 && pupil && pupil[0] < 0.3) blockInto(out, px - 15.5, (15.5 - cy) * 2 - 0.5, deep / 2 + 0.2, 1, 1, 0.5, pupil);
        }
      }
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute("position", new THREE.Float32BufferAttribute(out.position, 3));
    shape.setAttribute("normal", new THREE.Float32BufferAttribute(out.normal, 3));
    shape.setAttribute("color", new THREE.Float32BufferAttribute(out.color, 3));
    shape.setIndex(out.index);
    shape.userData.top = top;
    return (shapes[id] = shape);
  }
  const gold = new THREE.MeshPhongMaterial({ color: 0xffd84a, emissive: 0x8a5a00, shininess: 100 });
  function makeCreature() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(creatureShape(1), blocksPaint);
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
    return { group: group, body: body, crown: crown, aura: aura, id: 1 };
  }
  function showCreature(model, id, x, z, facing, hop, star, visible, giant) {
    model.group.visible = visible;
    if (!visible) return;
    if (model.id !== id) {
      model.id = id;
      model.body.geometry = creatureShape(id);
    }
    model.crown.visible = model.aura.visible = star;
    model.crown.position.y = model.body.geometry.userData.top;
    model.group.scale.setScalar(giant ? 2.6 : star ? 0.95 : 0.6);
    model.group.position.set(x, Math.abs(Math.sin(hop)) * 3, z);
    let turn = facing - model.group.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    model.group.rotation.y += turn * 0.25;
  }

  // ----- The city -----
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
  const TINTS = [[1, 1, 1], [0.96, 0.92, 0.86], [1, 0.95, 0.92], [0.93, 0.95, 0.99]];
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
    // Pictures for the ground
    const speckle = (g, colours, count, w, h) => {
      for (let i = 0; i < count; i++) {
        g.fillStyle = colours[i % colours.length];
        g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 64), w, h);
      }
    };
    const groundPaint = (draw) => new THREE.MeshLambertMaterial({ map: picture2(64, 64, draw, true), vertexColors: true });
    walls.street = groundPaint(function (g) {              // grey cobbles
      g.fillStyle = "#8f8f96";
      g.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        g.fillStyle = ["#9a9aa2", "#a4a4aa", "#94949c", "#aaa8a8"][(row * 3 + col * 5 + (row % 2)) % 4];
        g.fillRect(col * 8 + (row % 2 ? 4 : 0) - 4, row * 8, 7, 7);
        g.fillRect(col * 8 + (row % 2 ? 4 : 0) + 60, row * 8, 7, 7);
      }
    });
    walls.plaza = groundPaint(function (g) {               // pale stone slabs
      g.fillStyle = "#a89c84";
      g.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
        g.fillStyle = (row + col) % 2 ? "#c4b89e" : "#b8ac92";
        g.fillRect(col * 32 + 1, row * 32 + 1, 30, 30);
      }
    });
    walls.grass = groundPaint(function (g) {
      g.fillStyle = "#62b852";
      g.fillRect(0, 0, 64, 64);
      speckle(g, ["#56ac48", "#70c85e", "#4ea242"], 260, 2, 3);
    });
    walls.tall = groundPaint(function (g) {
      g.fillStyle = "#4a9e42";
      g.fillRect(0, 0, 64, 64);
      speckle(g, ["#2f8236", "#3c9440", "#63b854", "#2a7430"], 420, 2, 7);
    });
    walls.yard = groundPaint(function (g) {
      g.fillStyle = "#c8b898";
      g.fillRect(0, 0, 64, 64);
      speckle(g, ["#bcaa88", "#d4c6a8", "#b4a280"], 300, 2, 2);
    });
    walls.out = groundPaint(function (g) {
      g.fillStyle = "#4f9a48";
      g.fillRect(0, 0, 64, 64);
      speckle(g, ["#458c40", "#5aa650"], 200, 3, 3);
    });
    walls.water = new THREE.MeshPhongMaterial({ color: 0x3a8ad8, shininess: 120, specular: 0xffffff, vertexColors: true });
    // Pictures for the buildings: cream stone with tall windows, shutters and little iron balconies
    const wallPaint = function (lit) {
      const draw = (night) => function (g) {
        g.fillStyle = night ? "#000000" : "#efe6d0";
        g.fillRect(0, 0, 64, 64);
        if (!night) {
          g.fillStyle = "#e2d6bc";
          g.fillRect(0, 58, 64, 6);            // a stone band between floors
          g.fillStyle = "#d8cab0";
          g.fillRect(0, 57, 64, 1);
          g.fillStyle = "#fbf6ea";
          g.fillRect(17, 8, 30, 46);           // the window frame
          g.fillStyle = "#8f9cab";
          g.fillRect(10, 11, 7, 40);           // shutters
          g.fillRect(47, 11, 7, 40);
          g.fillStyle = "#3d5a78";
          g.fillRect(20, 11, 24, 40);          // glass
          g.fillStyle = "#6f94b8";
          g.fillRect(20, 11, 24, 12);
          g.fillStyle = "#fbf6ea";
          g.fillRect(31, 11, 2, 40);
          g.fillRect(20, 30, 24, 2);
          g.fillStyle = "#2a2c36";
          g.fillRect(14, 44, 36, 2);           // the balcony rail
          for (let x = 15; x < 50; x += 4) g.fillRect(x, 44, 1, 10);
          g.fillRect(14, 53, 36, 2);
        } else if (lit) {
          g.fillStyle = "#ffd27a";
          g.fillRect(20, 11, 24, 33);
        }
      };
      return new THREE.MeshLambertMaterial({ map: picture2(64, 64, draw(false), true), emissiveMap: picture2(64, 64, draw(true), true), emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true });
    };
    walls.lit = wallPaint(true);
    walls.unlit = wallPaint(false);
    const shopPaint = function (awning, cafe) {
      const draw = (night) => function (g) {
        g.fillStyle = night ? "#000000" : "#3a3c48";
        g.fillRect(0, 0, 64, 64);
        g.fillStyle = night ? (cafe ? "#b8ffcc" : "#ffe2a0") : "#a8cce4";
        g.fillRect(6, 20, 52, 34);               // the shop window
        if (!night) {
          g.fillStyle = "#d8ecf8";
          g.fillRect(6, 20, 52, 8);
          g.fillStyle = "#3a3c48";
          g.fillRect(31, 20, 2, 34);
          g.fillStyle = "#5a5c68";
          g.fillRect(0, 56, 64, 8);
          for (let x = 0; x < 64; x += 8) {
            g.fillStyle = (x / 8) % 2 ? "#ffffff" : awning;
            g.fillRect(x, 4, 8, 13);             // a striped awning
          }
          g.fillStyle = "rgba(0,0,0,0.25)";
          g.fillRect(0, 15, 64, 3);
          if (cafe) {
            g.fillStyle = "#ffffff";
            g.fillRect(24, 26, 16, 16);
            g.fillStyle = "#3aa858";
            g.fillRect(30, 28, 4, 12);
            g.fillRect(26, 32, 12, 4);
          }
        }
      };
      return new THREE.MeshLambertMaterial({ map: picture2(64, 64, draw(false), true), emissiveMap: picture2(64, 64, draw(true), true), emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true });
    };
    walls.shop0 = shopPaint("#c8483a", false);
    walls.shop1 = shopPaint("#3a6ab8", false);
    walls.shop2 = shopPaint("#d8a02a", false);
    walls.cafe = shopPaint("#3aa858", true);
    walls.slate = new THREE.MeshLambertMaterial({ vertexColors: true, map: picture2(64, 64, function (g) {       // a grey-blue slate roof with a little window in it
      g.fillStyle = "#5f7186";
      g.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 8; row++) {
        g.fillStyle = row % 2 ? "#566679" : "#687b91";
        g.fillRect(0, row * 8, 64, 7);
        g.fillStyle = "#4a596b";
        for (let x = row % 2 ? 4 : 0; x < 64; x += 8) g.fillRect(x, row * 8, 1, 7);
      }
      g.fillStyle = "#efe6d0";
      g.fillRect(20, 14, 24, 38);
      g.fillStyle = "#3d5a78";
      g.fillRect(24, 20, 16, 28);
      g.fillStyle = "#efe6d0";
      g.fillRect(31, 20, 2, 28);
    }, true) });
    walls.zinc = new THREE.MeshLambertMaterial({ color: 0x8a96a4, vertexColors: true });
    walls.stone = new THREE.MeshLambertMaterial({ color: 0xcfc6b2, vertexColors: true });

    // The ground, one strip of same-kind squares at a time
    const groundName = ["street", "plaza", "grass", "tall", "yard", "water", "street", "grass", "out"];
    for (let ty = 0; ty < CH; ty++) {
      let from = 0;
      for (let tx = 1; tx <= CW; tx++) {
        if (tx < CW && tiles[ty][tx] === tiles[ty][from] && tx % PIECE !== 0) continue;
        const kind = tiles[ty][from], x0 = from * TILE, x1 = tx * TILE, z0 = ty * TILE, z1 = z0 + TILE, y = kind === POND ? -1.4 : 0;
        if (kind !== OUT || fromMid(from, ty) < CITY_R + 14) quad(groundName[kind], [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [[x0 / 32, z1 / 32], [x1 / 32, z1 / 32], [x1 / 32, z0 / 32], [x0 / 32, z0 / 32]]);
        from = tx;
      }
    }
    // The buildings: a row of shops, floors of windows, then a sloping slate roof
    for (const b of buildings) {
      const x0 = b.x * TILE, x1 = (b.x + b.w) * TILE, z0 = b.y * TILE, z1 = (b.y + b.h) * TILE, high = 15 + b.floors * STOREY;
      wallsOf(b.cafe ? "cafe" : "shop" + b.shop, x0, x1, z0, z1, 0, 15, 1, null);
      wallsOf(b.lit ? "lit" : "unlit", x0, x1, z0, z1, 15, high, b.floors, TINTS[b.tint]);
      wallsOf("stone", x0 - 0.8, x1 + 0.8, z0 - 0.8, z1 + 0.8, high, high + 1.6, 1, null);          // a ledge under the roof
      quad("stone", [x0 - 0.8, high + 1.6, z1 + 0.8], [x1 + 0.8, high + 1.6, z1 + 0.8], [x1 + 0.8, high + 1.6, z0 - 0.8], [x0 - 0.8, high + 1.6, z0 - 0.8], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      wallsOf("slate", x0, x1, z0, z1, high + 1.6, high + 14, 1, null, 5, true);
      quad("zinc", [x0 + 5, high + 14, z1 - 5], [x1 - 5, high + 14, z1 - 5], [x1 - 5, high + 14, z0 + 5], [x0 + 5, high + 14, z0 + 5], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      for (let n = 0; n < 2; n++) {             // chimneys
        const cx = x0 + 10 + hash(b.x, b.y, 70 + n) * (x1 - x0 - 20), cz = z0 + 10 + hash(b.x, b.y, 80 + n) * (z1 - z0 - 20);
        wallsOf("stone", cx - 2.5, cx + 2.5, cz - 2, cz + 2, high + 14, high + 21, 1, [0.82, 0.6, 0.5]);
      }
    }
    // The city wall round the outside
    for (let n = 0; n < 96; n++) {
      const a0 = (n / 96) * Math.PI * 2, a1 = ((n + 1) / 96) * Math.PI * 2, r = (CITY_R + 0.6) * TILE, mid = MID * TILE;
      const p = [mid + Math.cos(a0) * r, 0, mid + Math.sin(a0) * r], q = [mid + Math.cos(a1) * r, 0, mid + Math.sin(a1) * r];
      quad("stone", p, q, [q[0], 26, q[2]], [p[0], 26, p[2]], [-Math.cos(a0), 0, -Math.sin(a0)], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.8, 0.78, 0.72]);
    }
    for (const lump of lumps.values()) {
      const shape = new THREE.BufferGeometry();
      shape.setAttribute("position", new THREE.Float32BufferAttribute(lump.position, 3));
      shape.setAttribute("normal", new THREE.Float32BufferAttribute(lump.normal, 3));
      shape.setAttribute("uv", new THREE.Float32BufferAttribute(lump.uv, 2));
      shape.setAttribute("color", new THREE.Float32BufferAttribute(lump.color, 3));
      const mesh = new THREE.Mesh(shape, walls[lump.name]);
      const flatGround = ["street", "plaza", "grass", "tall", "yard", "water", "out"].includes(lump.name);
      mesh.castShadow = !flatGround;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    const far = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), paint(0x4f9a48));       // the countryside beyond the wall
    far.rotation.x = -Math.PI / 2;
    far.position.set(MID * TILE, -2, MID * TILE);
    scene.add(far);

    // Trees and lamp posts, glued together a piece of the map at a time
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
    const leaf = new THREE.IcosahedronGeometry(1, 1), trunk = new THREE.CylinderGeometry(0.75, 1, 1, 6), post = new THREE.CylinderGeometry(0.55, 0.8, 1, 6), bulbShape = new THREE.SphereGeometry(1.7, 8, 6);
    const place = function (shape, colour, x, y, z, sx, sy, sz) {
      const mesh = new THREE.Mesh(shape, paintOf(colour));
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      keep(mesh);
    };
    for (const tree of trees) {
      const big = 0.8 + hash(tree.x, tree.y, 63) * 0.6;
      place(trunk, 0x7a5230, tree.x, 8 * big, tree.y, 2.2, 16 * big, 2.2);
      place(leaf, 0x3aa858, tree.x, 22 * big, tree.y, 10 * big, 9 * big, 10 * big);
      place(leaf, hash(tree.y, tree.x, 64) < 0.5 ? 0x4cbc62 : 0x2f9a4c, tree.x + 4 * big, 28 * big, tree.y - 2, 7 * big, 6.5 * big, 7 * big);
    }
    const lampSpots = [];
    for (const lamp of lamps) {
      place(post, 0x2a2e3a, lamp.x, 14, lamp.y, 1, 28, 1);
      place(bulbShape, litBulb, lamp.x, 29, lamp.y, 1, 1.2, 1);
      lampSpots.push(lamp.x, 29, lamp.y);
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
      mesh.castShadow = pile.material !== litBulb;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    const lampGlows = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(lampSpots, 3)), lampGlowPaint);
    lampGlows.frustumCulled = false;
    scene.add(lampGlows);
    // Cafe signs: a glowing green cross above the door
    for (const cafe of cafes) {
      const signPaint = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x3aa858, emissiveIntensity: 0.5 });
      box(12, 12, 1.5, signPaint, cafe.x, 24, cafe.y - 8.4);
      box(8, 2.8, 2.2, 0x3aa858, cafe.x, 24, cafe.y - 8.4);
      box(2.8, 8, 2.2, 0x3aa858, cafe.x, 24, cafe.y - 8.4);
      glow(0x7af0a0, 60, cafe.x, 22, cafe.y - 4);
    }
    // Wild zones have a shimmering green fence of light round them
    for (const park of PARKS) {
      const fence = new THREE.Mesh(new THREE.CylinderGeometry(park.r * TILE, park.r * TILE, 20, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x5aff9a, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      fence.position.set(park.at.x * TILE, 10, park.at.y * TILE);
      scene.add(fence);
      fences.push(fence);
    }
    // The tower in the middle of the city: three slim tiers, glowing rings and a bright beacon
    const tower = new THREE.Group();
    tower.position.set(MID * TILE, 0, MID * TILE);
    scene.add(tower);
    const tier = (r1, r2, h, y, colour) => add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 8), paintOf(colour)), 0, y + h / 2, 0, tower);
    const ringPaint = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
    const ring = (r, y) => add(new THREE.Mesh(new THREE.TorusGeometry(r, 1.6, 6, 24), ringPaint), 0, y, 0, tower).rotation.set(Math.PI / 2, 0, 0);
    tier(24, 31, 70, 0, 0xe4dcc8);
    tier(27, 27, 5, 70, 0x5f7186);
    tier(17, 22, 130, 75, 0xdcd4c0);
    tier(21, 21, 5, 205, 0x5f7186);
    tier(9, 15, 100, 210, 0xd4ccb8);
    add(new THREE.Mesh(new THREE.ConeGeometry(9, 60, 8), paint(0x5f7186)), 0, 340, 0, tower);
    ring(29, 74);
    ring(23, 209);
    ring(12, 312);
    ball(7, new THREE.MeshBasicMaterial({ color: 0xe8fbff }), 0, 374, 0, tower).castShadow = false;
    beacon = glow(0x9fe8ff, 300, 0, 374, 0, tower);
  }

  // ----- Things made once and moved about every frame -----
  const mine = makeHuman();
  scene.add(mine.group);
  const official = makeHuman();
  scene.add(official.group);
  const others = Array.from({ length: 10 }, function () {
    const human = makeHuman();
    scene.add(human.group);
    return human;
  });
  const palModel = makeCreature();
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
  // Tonight's Battle Zone is marked by glowing red walls of light
  const zonePaint = new THREE.MeshBasicMaterial({ color: 0xff3c5a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const zoneWalls = new THREE.Group();
  scene.add(zoneWalls);
  let zoneShown = null;
  function showZone(zone) {
    zoneShown = zone;
    while (zoneWalls.children.length) zoneWalls.remove(zoneWalls.children[0]);
    const mid = MID * TILE, from = (zone.from * Math.PI) / 180, to = (zone.to * Math.PI) / 180;
    for (const r of [23.5, 89.5]) {
      const arc = new THREE.Mesh(new THREE.CylinderGeometry(r * TILE, r * TILE, 30, 40, 1, true, Math.PI / 2 - to, to - from), zonePaint);
      arc.position.set(mid, 15, mid);
      zoneWalls.add(arc);
    }
    for (const a of [from, to]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(66 * TILE, 30), zonePaint);
      side.position.set(mid + Math.cos(a) * 56.5 * TILE, 15, mid + Math.sin(a) * 56.5 * TILE);
      side.rotation.y = -a;
      zoneWalls.add(side);
    }
  }

  // Raid portals: a spinning purple ring with a beam of light going up into the sky
  const portals = [];
  function showPortals() {
    RAIDS.forEach(function (raidPortal, n) {
      if (!portals[n]) {
        const group = new THREE.Group();
        group.position.set(raidPortal.x, 0, raidPortal.y);
        const ringPaint = new THREE.MeshBasicMaterial({ color: 0xc87aff });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(16, 2, 8, 28), ringPaint);
        ring.position.y = 22;
        const inner = new THREE.Mesh(new THREE.CircleGeometry(15, 28), new THREE.MeshBasicMaterial({ color: 0x7a2ad8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
        inner.position.y = 22;
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 420, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xc87aff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        beam.position.y = 210;
        group.add(ring, inner, beam);
        glow(0xc87aff, 110, 0, 22, 0, group);
        scene.add(group);
        portals[n] = { group: group, ring: ring, inner: inner };
      }
      const portal = portals[n];
      portal.group.visible = raidPortal.open && !(raid && raid.portal === raidPortal) && mode !== "outfit";
      portal.ring.rotation.y = portal.inner.rotation.y = time * 1.5 + n;
    });
  }

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
    skyLight.intensity = 0.74 - dark * 0.3;
    skyLight.color.set(0xffffff).lerp(new THREE.Color(0x8a9af0), dark);
    sun.intensity = 0.72 * (1 - dark) + 0.14;
    sun.color.set(0xfff1d0).lerp(new THREE.Color(0x8a9af0), dark);
    sun.position.set(me.x + 150, 260, me.y + 110);
    sun.target.position.set(me.x, 0, me.y);
    sun.target.updateMatrixWorld();
    lampGlowPaint.opacity = dark * 0.9;
    litBulb.emissive.setScalar(dark);
    for (const name of ["lit", "shop0", "shop1", "shop2", "cafe"]) walls[name].emissiveIntensity = dark;
    if (beacon) beacon.material.opacity = 0.4 + dark * 0.6;
    for (const fence of fences) fence.material.opacity = 0.14 + Math.sin(time * 3) * 0.05 + dark * 0.12;
    // The camera sits behind you and a little above. It comes closer if a building would get in the way.
    const dressing = mode === "outfit";
    if (dressing) {
      const side = look + 0.3;
      camera.position.set(me.x + Math.sin(side) * 44, 21, me.y + Math.cos(side) * 44);
      camera.lookAt(me.x + Math.cos(look) * -9, 16, me.y + Math.sin(look) * 9);
    } else {
      let back = 58 * zoom;
      const blocked = function (far) {          // would the camera be inside a building, or right up against one?
        const cx = me.x + Math.sin(look) * far, cz = me.y + Math.cos(look) * far;
        return [-5, 0, 5].some((side) => tileAt(cx + Math.cos(look) * side, cz - Math.sin(look) * side) === WALL);
      };
      const wanted = back;
      while (back > 8 && blocked(back)) back -= 4;
      // (when it has to come in close, it also rises, so it looks down on you and never fills the screen with your back)
      camera.position.set(me.x + Math.sin(look) * back, 16 + wanted * 0.42 * Math.max(0.9, zoom) + (wanted - back) * 0.75, me.y + Math.cos(look) * back);
      camera.lookAt(me.x - Math.sin(look) * 14, 17, me.y - Math.cos(look) * 14);
    }
    // People
    mine.dress(state.outfit);
    mine.pose(me.x, me.y, dressing ? look + Math.sin(time * 0.8) * 0.9 : me.face, me.anim, me.moving && !dressing);
    official.dress(OFFICIAL.outfit);
    official.pose(OFFICIAL.x, OFFICIAL.y, 0, time * 0.2, false);
    const people = trainers.concat(fight && !trainers.includes(fight.trainer) ? [fight.trainer] : []);
    others.forEach(function (human, n) {
      const who = people[n];
      human.group.visible = !!who && !dressing && Math.hypot(who.x - me.x, who.y - me.y) < 700;
      if (!human.group.visible) return;
      human.dress(who.outfit);
      human.pose(who.x, who.y, fight && fight.trainer === who ? Math.atan2(me.x - who.x, me.y - who.y) : FACING[who.dir], who.anim, who.moving);
    });
    // Wildlings
    const aim = dressing ? null : target();
    if (state.team.length) {
      const c = lead();
      const facing = aim ? Math.atan2(aim.x - pal.x, aim.y - pal.y) : me.face;
      showCreature(palModel, c.id, pal.x, pal.y, facing, pal.hop, surging > 0, !dressing && c.hp > 0 && !(pal.flash > 0 && Math.floor(time * 20) % 2));
    } else palModel.group.visible = false;
    const live = new Set();
    for (const foe of foes) {
      if (foe.gone > 0 || Math.abs(foe.x - me.x) > 600 || Math.abs(foe.y - me.y) > 600) continue;
      live.add(foe);
      if (!foeModels.has(foe)) foeModels.set(foe, makeCreature());
      const facing = foe.angry || !foe.wild ? Math.atan2(pal.x - foe.x, pal.y - foe.y) : Math.atan2(foe.vx || 0, foe.vy || 1);
      showCreature(foeModels.get(foe), foe.c.id, foe.x, foe.y, facing, foe.raid ? time * 2 : time * 5 + foe.x, false, !dressing && !(foe.flash > 0 && Math.floor(time * 20) % 2), foe.raid);
    }
    for (const [foe, model] of foeModels) if (!live.has(foe)) {
      scene.remove(model.group);
      foeModels.delete(foe);
    }
    // Rings and warnings on the ground
    aimRing.visible = !!aim;
    if (aim) {
      aimRing.position.set(aim.x, 0.6, aim.y);
      aimRing.scale.setScalar(1 + Math.sin(time * 8) * 0.08);
    }
    chargeRing.visible = !!pal.charge;
    if (pal.charge) {
      chargeRing.position.set(pal.charge.aim.x, 0.7, pal.charge.aim.y);
      chargeRing.scale.setScalar(pal.charge.t / 0.5 + 0.15);
      chargeRing.material.color.set(KIND_COLOUR[DEX[lead().id].kind]);
    }
    warnings.forEach(function (warning, n) {
      const mark = dressing ? null : marks[n];
      warning.ring.visible = warning.fill.visible = !!mark;
      warning.line.visible = !!mark && mark.kind === "line";
      if (!mark) return;
      const part = 1 - mark.wind.t / mark.wind.total;
      warning.ring.position.set(mark.x, 0.5, mark.y);
      warning.ring.scale.setScalar(mark.r);
      warning.fill.position.set(mark.x, 0.45, mark.y);
      warning.fill.scale.setScalar(Math.max(0.05, mark.r * part));
      if (mark.kind === "line") {
        const dx = mark.x - mark.foe.x, dz = mark.y - mark.foe.y;
        warning.line.position.set(mark.foe.x + dx / 2, 0.6, mark.foe.y + dz / 2);
        warning.line.scale.set(Math.hypot(dx, dz), 1, 1);
        warning.line.rotation.y = -Math.atan2(dz, dx);
      }
    });
    shotBalls.forEach(function (mesh, n) {
      const shot = shots[n];
      mesh.visible = !!shot;
      if (!shot) return;
      const part = shot.orb ? 1 - shot.life / shot.total : 0;
      if (shot.orb) mesh.position.set(shot.fx + (shot.aim.x - shot.fx) * part, 16 + Math.sin(part * Math.PI) * 26, me.y + (shot.aim.y - me.y) * part);
      else mesh.position.set(shot.x, 12, shot.y + 12);
      mesh.material.color.set(shot.orb ? 0xe0503a : KIND_COLOUR[shot.kind]);
      mesh.userData.glow.material.color.copy(mesh.material.color);
      mesh.scale.setScalar(shot.orb ? 0.8 : 1);
    });
    sparks.forEach(function (mesh, n) {
      const bit = bits[n];
      mesh.visible = !!bit;
      if (!bit) return;
      mesh.position.set(bit.x, 8 + bit.life * 26 + (n % 5) * 2, bit.y + 12);
      mesh.material.color.set(bit.colour);
      mesh.scale.setScalar(Math.min(1.4, bit.life * 3));
    });
    showPortals();
    if (zoneShown !== zoneNow()) showZone(zoneNow());
    zoneWalls.visible = isNight() && !dressing;
    zonePaint.opacity = 0.22 + Math.sin(time * 4) * 0.1;
    renderer.render(scene, camera);
  }
  // Where on the screen (480 by 320) is a place in the city? Used for words that float above things.
  const spot = new THREE.Vector3();
  function project(x, y, high) {
    spot.set(x, high, y).project(camera);
    return spot.z > 1 || Math.abs(spot.x) > 1.2 ? null : { x: Math.round((spot.x + 1) * 240), y: Math.round((1 - spot.y) * 160) };
  }
  return { build: build, render: render, project: project, renderer: renderer };
})();
