// Wildlings: Wind Isles in 3D. The game (game.js) works out where everything is on a flat map;
// this file builds the islands and the sea with THREE.js and shows them from a camera just behind you.

const VIEW = (function () {
  const glCanvas = document.getElementById("view3d");
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8ff);
  scene.fog = new THREE.Fog(0x9fd8ff, 420, 2100);
  const camera = new THREE.PerspectiveCamera(58, 1.5, 2, 2600);
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
  // Everyone is built from smooth, rounded shapes: a body turned like clay on a wheel, arms and legs that taper,
  // and a head with a proper face (eyes that blink, eyebrows, a nose, rosy cheeks and a smile).
  const PERSON = 0.76;         // how big people are (1 would make them tower over the huts)
  const madeShapes = new Map();          // every shape is made once and shared by all the people
  const shapeFor = (name, make) => madeShapes.get(name) || madeShapes.set(name, make()).get(name);
  const ballShape = (r, wide, high) => shapeFor("ball" + r + "," + (wide || 14) + "," + (high || 10), () => new THREE.SphereGeometry(r, wide || 14, high || 10));
  const tubeShape = (top, bottom, long) => shapeFor("tube" + top + "," + bottom + "," + long, () => new THREE.CylinderGeometry(top, bottom, long, 14));
  const boxShape = (w, h, d) => shapeFor("box" + w + "," + h + "," + d, () => new THREE.BoxGeometry(w, h, d));
  // A shape turned on a wheel: "points" go up the outside (how far out, how high). "flat" squashes it front to back.
  const turned = (name, points, flat) => shapeFor(name, function () {
    const shape = new THREE.LatheGeometry(points.map(([out, high]) => new THREE.Vector2(out, high)), 22);
    shape.scale(1, 1, flat);
    return shape;
  });
  const EYE_COLOURS = [0x5a3a22, 0x3a6ab8, 0x3a8a5a, 0x7a5a32];
  const blackPaint = new THREE.MeshBasicMaterial({ color: 0x1a1418 }), shinePaint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blushPaint = new THREE.MeshBasicMaterial({ color: 0xff7a7a, transparent: true, opacity: 0.3, depthWrite: false });
  function makeHuman() {
    const group = new THREE.Group();          // where the person stands, and which way they face
    group.scale.setScalar(PERSON);
    const body = new THREE.Group();           // the whole body: it bobs up and down and leans as they move
    const hips = new THREE.Group();           // the hips and legs
    const torso = new THREE.Group();          // everything above the waist: it twists the opposite way to the hips
    hips.position.y = 14.4;
    torso.position.y = 16;
    body.add(hips, torso);
    group.add(body);
    const m = {};
    for (const name of ["skin", "hair", "top", "bottom", "shoes", "hat", "trim", "eyes"]) m[name] = new THREE.MeshLambertMaterial({ color: 0xffffff });
    m.hair.side = THREE.DoubleSide;
    const dark = paint(0x2a2230), white = paint(0xffffff), straw = paint(0xe8cc7a), lips = paint(0xa8444a);
    // Put one piece on the body. Big pieces cast shadows; tiny ones (like eyes) don't need to.
    const piece = function (shape, material, x, y, z, parent, shadow) {
      const mesh = new THREE.Mesh(shape, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow !== false;
      mesh.receiveShadow = shadow !== false;
      parent.add(mesh);
      return mesh;
    };
    const limb = (top, bottom, long, material, parent) => piece(tubeShape(top, bottom, long), material, 0, -long / 2, 0, parent);
    const legs = [], knees = [], ankles = [], arms = [], elbows = [];
    const bare = { arms: [], sleeves: [], cuffs: [], shins: [], thighs: [], shortLegs: [], socks: [] };       // pieces that change with your clothes
    for (const side of [-1, 1]) {
      // A leg: thigh, knee, shin (with a calf muscle), ankle and shoe
      const leg = new THREE.Group();
      leg.position.set(side * 1.95, 0, 0);
      bare.thighs.push(limb(2.15, 1.7, 6.8, m.bottom, leg));
      bare.shortLegs.push(piece(tubeShape(2.3, 2.38, 3.9), m.bottom, 0, -2.1, 0, leg));
      const knee = new THREE.Group();
      knee.position.y = -6.8;
      bare.shins.push(piece(ballShape(1.7), m.bottom, 0, 0, 0, knee));
      bare.shins.push(limb(1.7, 1.12, 6.3, m.bottom, knee));
      const calf = piece(ballShape(1.5), m.bottom, 0, -2.4, -0.42, knee);
      calf.scale.set(0.92, 1.7, 1);
      bare.shins.push(calf);
      const ankle = new THREE.Group();
      ankle.position.y = -6.3;
      bare.socks.push(piece(tubeShape(1.3, 1.22, 1.3), white, 0, 0.45, 0, ankle, false));
      piece(ballShape(1.5), m.shoes, 0, -0.42, 1.25, ankle).scale.set(1.08, 0.8, 2.1);       // the front of the shoe
      piece(ballShape(1.35), m.shoes, 0, -0.38, -0.2, ankle).scale.set(1.02, 0.95, 1.05);    // the heel
      piece(boxShape(3, 0.24, 6), white, 0, -0.82, 1.05, ankle, false);                      // a white stripe round the sole
      piece(boxShape(2.9, 0.42, 5.9), dark, 0, -1.09, 1.05, ankle, false);                   // the sole
      knee.add(ankle);
      leg.add(knee);
      hips.add(leg);
      legs.push(leg);
      knees.push(knee);
      ankles.push(ankle);
      // An arm: shoulder, upper arm (with a sleeve), elbow, forearm (with a cuff) and a hand with a thumb
      const arm = new THREE.Group();
      arm.position.set(side * 4.4, 6.45, 0);
      arm.userData.side = side;
      piece(ballShape(1.6), m.top, 0, 0, 0, arm);
      bare.arms.push(limb(1.42, 1.2, 5.4, m.top, arm));
      bare.sleeves.push(piece(tubeShape(1.62, 1.6, 2.9), m.top, 0, -1.5, 0, arm));
      const elbow = new THREE.Group();
      elbow.position.y = -5.4;
      bare.arms.push(piece(ballShape(1.2), m.top, 0, 0, 0, elbow));
      bare.arms.push(limb(1.2, 0.9, 4.9, m.top, elbow));
      bare.cuffs.push(piece(tubeShape(1.04, 1.04, 0.9), m.trim, 0, -4.5, 0, elbow, false));
      piece(ballShape(1.12), m.skin, 0, -5.75, 0.05, elbow).scale.set(0.85, 1.2, 0.62);       // the hand...
      piece(ballShape(0.45, 8, 6), m.skin, -side * 0.72, -5.3, 0.45, elbow, false).scale.set(1, 1.5, 1);      // ...and its thumb
      arm.add(elbow);
      torso.add(arm);
      arms.push(arm);
      elbows.push(elbow);
    }
    piece(turned("pelvis", [[0.01, -1.5], [2.3, -1.35], [3.3, -0.5], [3.45, 0.5], [3.2, 1.9], [0.01, 2.2]], 0.68), m.bottom, 0, 0, 0, hips);
    const skirt = piece(turned("skirt", [[5.6, -5.2], [4.9, -1.4], [4.25, 0.6], [3.5, 1.9]], 0.86), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 0, 0, 0, hips);
    // The body: a shirt that is wide at the shoulders, narrow at the waist and loose at the hem
    const shirt = piece(turned("shirt", [[3.52, -1.9], [3.42, -0.6], [3.2, 1.2], [3.55, 3.6], [3.95, 5.9], [4, 6.9], [3.4, 7.9], [2, 8.5], [0.01, 8.6]], 0.74), m.top, 0, 0, 0, torso);
    piece(tubeShape(1.1, 1.25, 2), m.skin, 0, 9.2, 0, torso);                                 // the neck
    const neckline = piece(shapeFor("neckline", () => new THREE.TorusGeometry(1.5, 0.3, 6, 16)), m.trim, 0, 8.42, 0, torso, false);
    neckline.rotation.x = Math.PI / 2;
    const emblem = piece(shapeFor("emblem", () => new THREE.CircleGeometry(1.05, 5)), white, 0, 4.9, 3.03, torso, false);       // a little badge on a T-shirt
    emblem.rotation.set(0.12, 0, Math.PI / 2);
    const hoodie = new THREE.Group();          // a hood, a pocket on the front and two cords
    piece(ballShape(2.7), m.top, 0, 8.2, -1.95, hoodie).scale.set(1.25, 0.8, 0.9);
    piece(boxShape(4.4, 1.9, 0.36), m.trim, 0, 0.3, 2.34, hoodie, false);
    for (const side of [-1, 1]) piece(tubeShape(0.14, 0.14, 2.6), white, side * 0.75, 6.2, 3.06, hoodie, false).rotation.x = 0.06;
    const jacket = new THREE.Group();          // a zip, a collar and two pockets
    piece(boxShape(0.5, 5.4, 0.3), m.trim, 0, 4, 2.76, jacket, false).rotation.x = 0.145;
    for (const side of [-1, 1]) {
      piece(boxShape(1.9, 0.3, 0.3), m.trim, side * 1.9, 0.3, 2.42, jacket, false);
      const lapel = piece(boxShape(1.5, 0.5, 2.2), m.trim, side * 1.25, 8.25, 1.4, jacket, false);
      lapel.rotation.set(0.5, side * 0.5, 0);
    }
    torso.add(hoodie, jacket);
    // The head, and the face on the front of it
    const head = new THREE.Group();
    head.position.y = 12.3;
    torso.add(head);
    piece(ballShape(3, 24, 18), m.skin, 0, 0, 0, head).scale.set(0.94, 1, 0.96);
    piece(ballShape(2.2, 16, 12), m.skin, 0, -1.35, 0.3, head).scale.set(0.93, 0.9, 0.95);        // the jaw and chin
    const eyes = [];
    for (const side of [-1, 1]) {
      piece(ballShape(0.62, 10, 8), m.skin, side * 2.78, -0.2, -0.1, head, false).scale.set(0.5, 1, 0.8);       // an ear
      const eye = new THREE.Group();
      eye.position.set(side * 1.12, 0.1, 2.52);
      piece(ballShape(0.66, 12, 10), shinePaint, 0, 0, 0, eye, false).scale.set(1, 1.18, 0.45);
      piece(ballShape(0.4, 10, 8), m.eyes, 0, -0.04, 0.2, eye, false).scale.set(1, 1.1, 0.4);
      piece(ballShape(0.21, 8, 6), blackPaint, 0, -0.04, 0.31, eye, false).scale.z = 0.4;
      piece(ballShape(0.1, 6, 4), shinePaint, 0.15, 0.2, 0.39, eye, false);                     // a tiny sparkle
      head.add(eye);
      eyes.push(eye);
      piece(boxShape(1.36, 0.15, 0.3), blackPaint, side * 1.12, 0.9, 2.6, head, false).rotation.z = -side * 0.06;     // eyelashes
      const brow = piece(boxShape(1.3, 0.22, 0.3), m.hair, side * 1.15, 1.42, 2.5, head, false);
      brow.rotation.set(0, side * 0.3, -side * 0.12);
      const cheek = piece(shapeFor("cheek", () => new THREE.CircleGeometry(0.58, 12)), blushPaint, side * 1.86, -0.78, 2.36, head, false);
      cheek.rotation.y = side * 0.62;
    }
    piece(ballShape(0.42, 8, 6), m.skin, 0, -0.55, 2.93, head, false).scale.set(0.9, 0.8, 1);     // the nose
    const smile = piece(shapeFor("smile", () => new THREE.TorusGeometry(0.8, 0.1, 6, 14, Math.PI)), lips, 0, -1.2, 2.44, head, false);
    smile.rotation.set(-0.12, 0, Math.PI);
    // Hair. Most styles start with a cap of hair over the top and back of the head.
    const cap = function (parent) {
      const top = piece(shapeFor("hairTop", () => new THREE.SphereGeometry(3.2, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), m.hair, 0, 0, 0, parent);
      top.scale.set(0.96, 1, 0.98);
      top.rotation.x = -0.3;
      piece(shapeFor("hairBack", () => new THREE.SphereGeometry(3.18, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)), m.hair, 0, 0, 0, parent).rotation.x = -1.25;
    };
    const fringe = function (parent) {          // three soft tufts across the forehead, and a little hair in front of each ear
      for (const [x, y, z, tilt] of [[-1.35, 1.72, 2.4, 0.3], [0.1, 1.98, 2.62, 0.05], [1.45, 1.68, 2.36, -0.3]]) {
        const tuft = piece(ballShape(1.25, 10, 8), m.hair, x, y, z, parent, false);
        tuft.scale.set(1.25, 0.55, 0.8);
        tuft.rotation.z = tilt;
      }
      for (const side of [-1, 1]) piece(ballShape(0.6, 8, 6), m.hair, side * 2.62, 0.5, 0.95, parent, false).scale.set(0.5, 1.3, 0.9);
    };
    const outward = function (shape, parent, polar, round, far) {          // put a shape on the head, pointing straight out from the middle of it
      const way = new THREE.Vector3(Math.sin(polar) * Math.sin(round), Math.cos(polar), Math.sin(polar) * Math.cos(round));
      const mesh = piece(shape, m.hair, way.x * far, way.y * far, way.z * far, parent, false);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), way);
      return mesh;
    };
    const styles = {};
    for (const style of ["short", "long", "ponytail", "spiky", "bun", "curly", "bald"]) head.add((styles[style] = new THREE.Group()));
    for (const style of ["short", "long", "ponytail", "spiky", "bun", "curly"]) cap(styles[style]);
    for (const style of ["short", "long", "ponytail", "bun"]) fringe(styles[style]);
    piece(shapeFor("hairLong", () => new THREE.CylinderGeometry(3.3, 3.7, 8.2, 18, 1, true, Math.PI - 1.75, 3.5)), m.hair, 0, -3.6, 0, styles.long);
    for (const side of [-1, 1]) piece(ballShape(0.8, 8, 8), m.hair, side * 2.75, -2.5, 0.9, styles.long, false).scale.set(0.75, 3.6, 1.3);
    piece(ballShape(0.9), m.hair, 0, 1.6, -3.05, styles.ponytail, false);
    const tail = piece(shapeFor("ponytail", () => new THREE.ConeGeometry(1.2, 7.2, 10)), m.hair, 0, -2, -3.8, styles.ponytail);
    tail.rotation.x = Math.PI + 0.2;
    const spike = shapeFor("spike", () => new THREE.ConeGeometry(1, 3, 7));
    outward(spike, styles.spiky, 0, 0, 3.9);
    for (let k = 0; k < 6; k++) outward(spike, styles.spiky, 0.62, k * 1.047 + 0.5, 3.9);
    for (let k = 0; k < 9; k++) if (Math.abs(Math.atan2(Math.sin(k * 0.698), Math.cos(k * 0.698))) > 0.95) outward(spike, styles.spiky, 1.15, k * 0.698, 3.8);
    piece(ballShape(1.65), m.hair, 0, 3.15, -1.6, styles.bun);
    const curl = ballShape(1.3, 10, 8);
    outward(curl, styles.curly, 0, 0, 3.3);
    for (let k = 0; k < 7; k++) outward(curl, styles.curly, 0.6, k * 0.898, 3.3);
    for (let k = 0; k < 10; k++) if (Math.abs(Math.atan2(Math.sin(k * 0.628), Math.cos(k * 0.628))) > 0.75) outward(curl, styles.curly, 1.15, k * 0.628, 3.25);
    for (let k = 0; k < 8; k++) if (Math.abs(Math.atan2(Math.sin(k * 0.785), Math.cos(k * 0.785))) > 1.5) outward(curl, styles.curly, 1.7, k * 0.785, 3.1);
    // Hats
    const hats = {};
    for (const hat of ["none", "cap", "beanie", "straw hat"]) head.add((hats[hat] = new THREE.Group()));
    const dome = shapeFor("hatDome", () => new THREE.SphereGeometry(3.36, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5));
    piece(dome, m.hat, 0, 0.7, -0.1, hats.cap).scale.set(0.97, 0.84, 1);
    piece(boxShape(4.6, 0.3, 3), m.hat, 0, 1, 3.55, hats.cap).rotation.x = 0.14;                  // the peak
    piece(ballShape(0.36, 8, 6), m.trim, 0, 3.55, -0.1, hats.cap, false);
    hats.cap.rotation.x = -0.12;
    piece(dome, m.hat, 0, 0.55, 0, hats.beanie);
    piece(shapeFor("beanieRim", () => new THREE.TorusGeometry(3.24, 0.52, 8, 20)), m.trim, 0, 0.65, 0, hats.beanie).rotation.x = Math.PI / 2;
    piece(ballShape(0.9), m.trim, 0, 4.1, 0, hats.beanie, false);
    hats.beanie.rotation.x = -0.14;
    piece(tubeShape(5.7, 5.7, 0.35), straw, 0, 1.3, 0, hats["straw hat"]);                         // a wide brim to keep the sun off
    piece(tubeShape(2.9, 3.25, 2.5), straw, 0, 2.6, 0, hats["straw hat"]);
    piece(tubeShape(3.3, 3.32, 0.75), m.hat, 0, 1.85, 0, hats["straw hat"], false);                // a ribbon in your hat colour
    hats["straw hat"].rotation.x = -0.1;
    let wearing = "";
    let go = 0, fast = 0;          // how much they are walking (0 to 1), and how much of that is running (0 to 1)
    const blinkAt = Math.random() * 5;          // (so that everyone blinks at different moments)
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
        m.trim.color.set(pick("top")).multiplyScalar(0.62);
        m.eyes.color.set(EYE_COLOURS[(outfit.hair + outfit.skin) % EYE_COLOURS.length]);
        skirt.material.color.set(pick("bottom"));
        const top = pick("topStyle"), bottom = pick("bottomStyle"), hat = pick("hat");
        let hair = pick("hairStyle");
        if (hat !== "none" && (hair === "spiky" || hair === "bun" || hair === "curly")) hair = "short";       // (these don't fit under a hat)
        for (const style in styles) styles[style].visible = style === hair;
        for (const each in hats) hats[each].visible = each === hat;
        const shortSleeves = top === "T-shirt";
        hoodie.visible = top === "hoodie";
        jacket.visible = top === "jacket";
        emblem.visible = shortSleeves;
        neckline.visible = top !== "hoodie";
        for (const each of bare.arms) each.material = shortSleeves ? m.skin : m.top;
        for (const each of bare.cuffs) each.visible = !shortSleeves;
        skirt.visible = bottom === "skirt";
        for (const each of bare.shins) each.material = bottom === "trousers" ? m.bottom : m.skin;
        for (const each of bare.thighs) each.material = bottom === "skirt" ? m.skin : m.bottom;
        for (const each of bare.shortLegs) each.visible = bottom === "shorts";
        for (const each of bare.socks) each.visible = bottom !== "trousers";
      },
      // Stand at a place, face a way, and walk or run. "step" counts up as they move: one full turn of it (6.28) is two steps.
      // A real walk is copied here: each leg swings forward with its knee bent, lands, and pushes back with the foot flat;
      // the arms swing opposite to the legs; the hips and shoulders twist against each other; and the body bobs with every step.
      // Running is the same idea but bigger: a longer stride, knees lifted high, elbows bent, and the body leaning forwards.
      pose: function (x, z, facing, step, moving, running) {
        let turn = facing - group.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        group.rotation.y += turn * 0.3;
        go += ((moving ? 1 : 0) - go) * 0.2;                   // (these ease in and out, so starting, stopping and speeding up look smooth)
        fast += ((moving && running ? 1 : 0) - fast) * 0.14;
        const mix = (walking, sprinting) => (walking + (sprinting - walking) * fast) * go;
        const now = performance.now() / 1000, still = 1 - go;
        const lean = mix(0.05, 0.2);
        [0, 1].forEach(function (n) {
          const s = Math.sin(step + n * Math.PI), c = Math.cos(step + n * Math.PI);        // s: how far forward this leg is. c: above 0 while it swings forward through the air.
          legs[n].rotation.x = -(mix(0.03, 0.2) + s * mix(0.5, 0.92));
          knees[n].rotation.x = 0.04 + mix(0.07, 0.24) + Math.pow(Math.max(0, c), 1.4) * mix(0.95, 1.75) + Math.max(0, -c) * Math.max(0, s) * mix(0.3, 0.55);
          ankles[n].rotation.x = -(legs[n].rotation.x + knees[n].rotation.x + lean) * (0.72 - 0.28 * c * go);
          arms[n].rotation.x = s * mix(0.5, 0.95) + Math.sin(now * 1.3 + n * 2) * 0.03 * still;
          arms[n].rotation.z = arms[n].userData.side * (0.1 + mix(0, 0.1));
          elbows[n].rotation.x = -(0.14 + mix(0.2, 1.3) + Math.max(0, -s) * mix(0.42, 0.3));
        });
        const twist = Math.sin(step);
        hips.rotation.y = twist * mix(0.1, 0.17);
        hips.rotation.z = twist * mix(0.035, 0.02);
        torso.rotation.y = -twist * mix(0.15, 0.26);
        torso.rotation.x = mix(0.02, 0.1);
        head.rotation.y = twist * mix(0.06, 0.1) + Math.sin(now * 0.5 + blinkAt) * 0.12 * still;        // (standing still, they look about a little)
        head.rotation.x = -mix(0.04, 0.2) + Math.sin(now * 0.9 + x) * 0.03 * still;
        shirt.scale.x = 1 + Math.sin(now * 1.7) * 0.012 * still;                           // breathing, when standing still
        const blink = (now + blinkAt) % 4.4 < 0.13 ? 0.12 : 1;
        for (const eye of eyes) eye.scale.y = blink;
        body.rotation.x = lean;
        // walking: highest when one leg is straight under you. Running: highest in mid-air, between steps.
        body.position.set(twist * mix(0.3, 0.15), go * ((1 - fast) * (Math.cos(step * 2) * 0.35 - 0.3) + fast * (0.5 - Math.cos(step * 2) * 0.9)), 0);
        group.position.set(x, 0, z);
      },
    };
  }
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
  function showCreature(model, id, x, z, facing, hop, star, visible, giant) {
    model.group.visible = visible;
    if (!visible) return;
    const img = picture(id);
    if (model.img !== img) {
      model.img = img;
      model.body.geometry = shapeOf(img);
      model.body.rotation.y = img.side ? Math.PI / 2 : 0;        // (pictures drawn from the side are turned to face forwards)
    }
    const size = giant ? 2.5 : star ? 0.9 : 0.62;
    model.crown.visible = model.aura.visible = star;
    model.crown.position.y = model.body.geometry.userData.top;
    model.group.scale.setScalar(size);
    model.group.position.set(x, Math.abs(Math.sin(hop)) * 3 * size, z);
    let turn = facing - model.group.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    model.group.rotation.y += turn * 0.25;
  }

  const FACING = [0, -Math.PI / 2, Math.PI / 2, Math.PI];        // which way someone turns for down, left, right, up

  // ----- The islands -----
  // Everything flat that never moves (sand, grass, paths) is collected into big lumps, one per piece of the map and per paint, so it draws fast.
  const PIECE = 40;            // a lump covers 40 by 40 squares
  const lumps = new Map();
  const grounds = {};          // the paints for the ground
  ["shallow", "sand", "grass", "tall", "path", "pool"].forEach(function (name, layer) {
    // (each layer is told to draw "in front of" the ones before it, so they never flicker where they overlap)
    grounds[name] = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer * 4 });
  });
  const HIGH = { shallow: -0.7, sand: 0, grass: 0.3, tall: 0.42, path: 0.5, pool: 0.56 };
  const rgb = (hex) => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
  // Add one flat triangle to a layer of the ground (the three corners are places on the map)
  function flatTri(name, a, b, c, tint) {
    const key = Math.floor((a[0] + b[0] + c[0]) / 3 / (PIECE * TILE)) + "," + Math.floor((a[1] + b[1] + c[1]) / 3 / (PIECE * TILE)) + "|" + name;
    if (!lumps.has(key)) lumps.set(key, { name: name, position: [], normal: [], color: [] });
    const out = lumps.get(key), y = HIGH[name];
    const turned = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;      // (corners must go round the right way to face upwards)
    for (const p of turned ? [a, c, b] : [a, b, c]) {
      out.position.push(p[0], y, p[1]);
      out.normal.push(0, 1, 0);
      out.color.push(tint[0], tint[1], tint[2]);
    }
  }
  const flatBox = (name, x0, z0, x1, z1, tint) => (flatTri(name, [x0, z0], [x1, z0], [x1, z1], tint), flatTri(name, [x0, z0], [x1, z1], [x0, z1], tint));
  // A ring (or a filled shape, when "inner" is null) round a middle point. "outer" and "inner" give the distance for each angle.
  function flatRing(name, cx, cz, inner, outer, tint, wedges) {
    for (let n = 0; n < wedges; n++) {
      const a0 = (n / wedges) * Math.PI * 2, a1 = ((n + 1) / wedges) * Math.PI * 2;
      const at = (a, far) => [cx + Math.cos(a) * far, cz + Math.sin(a) * far];
      if (!inner) flatTri(name, [cx, cz], at(a0, outer(a0)), at(a1, outer(a1)), tint);
      else {
        flatTri(name, at(a0, inner(a0)), at(a0, outer(a0)), at(a1, outer(a1)), tint);
        flatTri(name, at(a0, inner(a0)), at(a1, outer(a1)), at(a1, inner(a1)), tint);
      }
    }
  }
  let sea = null, stormWall = null, stormClouds = null, volcanoGlow = null;
  const socks = [];            // windsocks: they point the way the wind is blowing
  function build() {
    // The sea: one huge sheet of blue, with pale streaks that drift along on the wind
    const waves = picture2(256, 256, function (g) {
      g.fillStyle = "#2f7ac8";
      g.fillRect(0, 0, 256, 256);
      for (let n = 0; n < 46; n++) {
        const x = hash(n, 1, 90) * 256, y = hash(n, 2, 90) * 256, wide = 18 + hash(n, 3, 90) * 40;
        g.fillStyle = n % 3 ? "rgba(120,190,240,0.5)" : "rgba(220,240,255,0.55)";
        for (const dx of [-256, 0, 256]) g.fillRect(x + dx, y, wide, 2);
      }
    }, true);
    waves.repeat.set(70, 70);
    sea = new THREE.Mesh(new THREE.PlaneGeometry(MAP * TILE * 3, MAP * TILE * 3), new THREE.MeshPhongMaterial({ map: waves, shininess: 30, specular: 0x1c3a52 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set((MAP * TILE) / 2, -1.6, (MAP * TILE) / 2);
    sea.receiveShadow = true;
    scene.add(sea);

    // Things that stand up (palms, rocks, huts, stones) are glued together a piece of the map at a time
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
    const SHAPE = { tube: new THREE.CylinderGeometry(1, 1, 1, 8), taper: new THREE.CylinderGeometry(0.7, 1, 1, 7), cone: new THREE.ConeGeometry(1, 1, 8), bigCone: new THREE.ConeGeometry(1, 1, 14), ball: new THREE.IcosahedronGeometry(1, 1), lump: new THREE.IcosahedronGeometry(1, 0), box: new THREE.BoxGeometry(1, 1, 1) };
    // Put one shape in the world: where, how big, and (if wanted) how it is turned
    const place = function (shape, colour, x, y, z, sx, sy, sz, turn) {
      const mesh = new THREE.Mesh(SHAPE[shape], paintOf(colour));
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      if (turn) mesh.rotation.set(turn[0], turn[1], turn[2], "YXZ");
      keep(mesh);
    };
    for (const isle of ISLES) {
      const cx = isle.at.x * TILE, cz = isle.at.y * TILE, n = isle.n;
      const shore = (a) => edgeOf(isle, a) * TILE;
      // The island itself: shallow water all round, then a beach, then grass in the middle
      flatRing("shallow", cx, cz, (a) => shore(a) - 10, (a) => shore(a) + WADE * TILE, rgb("#6cc8e8"), 120);
      flatRing("sand", cx, cz, null, shore, rgb(isle.sand), 120);
      flatRing("grass", cx, cz, null, (a) => shore(a) - BEACH * TILE, rgb(isle.grass), 120);
      for (const patch of isle.patches) flatRing("tall", patch.x * TILE, patch.y * TILE, null, () => patch.r * TILE, rgb(blend(isle.grass, "#0a4a1a", 0.3)), 18);
      // The path, the village square and the shrine's clearing
      const dirt = rgb(n === 5 ? "#c4d0d8" : n === 3 || n === 7 ? "#8a7a72" : "#c8a060");
      flatBox("path", cx - TILE, (isle.shrine.y - 3) * TILE, cx + TILE, cz + shore(Math.PI / 2) - BEACH * TILE + 6, dirt);
      flatBox("path", cx - 9 * TILE, (isle.village.y - 1) * TILE, cx + 9 * TILE, (isle.village.y + 4) * TILE, dirt);
      flatRing("path", cx, isle.shrine.y * TILE, null, () => 4.2 * TILE, dirt, 28);
      // Tufts of tall grass sticking up from each patch
      for (const patch of isle.patches) for (let k = 0; k < patch.r * patch.r * 2.4; k++) {
        const a = hash(k, n, 41) * 6.283, far = Math.sqrt(hash(k, n, 42)) * (patch.r - 0.4) * TILE;
        place("cone", blend(isle.grass, "#0a4a1a", 0.18 + hash(k, n, 43) * 0.25), patch.x * TILE + Math.cos(a) * far, 3.2, patch.y * TILE + Math.sin(a) * far, 2.4, 7, 2.4);
      }
      // What stands in the middle of the island
      const f = isle.feature;
      if (f) {
        const fx = f.x * TILE, fz = f.y * TILE, fr = f.r * TILE;
        if (isle.middle === "lagoon") flatRing("pool", fx, fz, null, () => fr, rgb("#6cc8e8"), 30);
        else flatRing("pool", fx, fz, null, () => fr + 6, rgb(isle.middle === "ice" ? "#d8ecf4" : "#6a6470"), 30);
        if (isle.middle === "volcano") {
          place("bigCone", 0x6a4a3c, fx, 60, fz, fr, 120, fr);
          place("bigCone", 0x4a3430, fx, 100, fz, fr * 0.45, 60, fr * 0.45);
          const lava = new THREE.Mesh(new THREE.SphereGeometry(fr * 0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
          lava.position.set(fx, 128, fz);
          scene.add(lava);
          volcanoGlow = glow(0xff8a3a, 260, fx, 140, fz);
        } else if (isle.middle === "ice") {
          const ice = new THREE.MeshPhongMaterial({ color: 0xbfe8ff, shininess: 100, specular: 0xffffff });
          for (let k = 0; k < 7; k++) place("cone", ice, fx + Math.cos(k * 0.9) * fr * 0.55 * (k ? 1 : 0), 30 + (k ? 18 : 60) * (0.6 + hash(k, 5, 44) * 0.6), fz + Math.sin(k * 0.9) * fr * 0.55 * (k ? 1 : 0), 13 + (k ? 0 : 10), 60 + (k ? 36 : 120) * (0.6 + hash(k, 5, 44) * 0.6), 13 + (k ? 0 : 10));
        } else if (isle.middle === "pillars") {
          for (let k = 0; k < 5; k++) {
            const px = fx + Math.cos(k * 1.26) * fr * 0.6, pz = fz + Math.sin(k * 1.26) * fr * 0.6, high = 70 + hash(k, 6, 45) * 80;
            place("tube", 0xb8a890, px, high / 2, pz, 11, high, 11);
            place("tube", 0x5cc09a, px, high + 1.5, pz, 15, 3, 15);
          }
        } else {
          for (let k = 0; k < 8; k++) {
            const far = k ? fr * (0.3 + hash(k, n, 46) * 0.5) : 0, high = (k ? 30 : 70) + hash(k, n, 47) * 40;
            place("cone", n === 7 ? 0x3a3448 : 0x7a7684, fx + Math.cos(k * 0.8) * far, high / 2, fz + Math.sin(k * 0.8) * far, 12 + (k ? 0 : 8), high, 12 + (k ? 0 : 8));
          }
        }
      }
      // Two huts in the village: walls of bamboo and a roof of dried palm leaves
      for (const hut of HUTS) if (hut.isle === isle) {
        const hx = (hut.tx + 0.5) * TILE, hz = (hut.ty + 1.5) * TILE;
        place("tube", 0xc89a5a, hx, 9, hz, 21, 18, 21);
        place("bigCone", hut.shop ? 0x4a7ad0 : 0xd8b860, hx, 28, hz, 29, 22, 29);
        place("box", 0x4a3020, hx, 7, hz + 20.4, 9, 14, 1.4);
        place("box", 0xffffff, hx, 20, hz + 21.4, 10, 8, 1);
        if (hut.shop) place("lump", 0xffb0d0, hx, 20, hz + 22, 3, 3, 1);
        else {
          place("box", 0x3aa858, hx, 20, hz + 22, 7, 2.2, 1);
          place("box", 0x3aa858, hx, 20, hz + 22, 2.2, 6, 1);
        }
      }
      // The Wind Shrine: a ring of standing stones round a tall pole hung with chimes
      if (n > 0) {
        const sx = cx, sz = isle.shrine.y * TILE;
        for (let k = 0; k < 7; k++) {
          const a = k * 0.898 + 0.45;
          place("box", n === 5 ? 0xc8dce8 : 0x8a8694, sx + Math.cos(a) * 58, 11, sz + Math.sin(a) * 58, 9, 22 + (k % 2) * 6, 6, [0, -a, 0]);
        }
        place("tube", 0x7a5230, sx + 26, 26, sz - 14, 1.4, 52, 1.4);
        place("box", 0x7a5230, sx + 26, 50, sz - 14, 16, 1.4, 1.4);
        for (const dx of [-6, 0, 6]) place("tube", 0xffd84a, sx + 26 + dx, 43 - Math.abs(dx) * 0.4, sz - 14, 0.9, 11 - Math.abs(dx) * 0.5, 0.9);
      }
      // The jetty: wooden planks out over the shallows, with a windsock on a pole
      const jetty = isle.jetty;
      place("box", 0xa8743c, jetty.x, 0.4, jetty.y + 12, 14, 1.2, 50);
      for (const dz of [-8, 12, 34]) for (const dx of [-7, 7]) place("tube", 0x6a4a2a, jetty.x + dx, 0, jetty.y + dz, 1.3, 7, 1.3);
      place("tube", 0x6a4a2a, jetty.x - 9, 17, jetty.y - 10, 0.9, 34, 0.9);
      const sock = new THREE.Mesh(new THREE.ConeGeometry(3.4, 17, 8, 1, true), new THREE.MeshLambertMaterial({ color: 0xff8a3a, side: THREE.DoubleSide }));
      sock.geometry.rotateZ(-Math.PI / 2);          // (so the open end is at the pole and the point trails away from it)
      sock.geometry.translate(8.5, 0, 0);
      sock.position.set(jetty.x - 9, 32, jetty.y - 10);
      scene.add(sock);
      socks.push(sock);
    }
    // Palm trees (pines on the frozen island) and boulders
    for (const tree of trees) {
      const n = tree.isle.n, big = 0.8 + hash(tree.x, tree.y, 63) * 0.5, lean = (hash(tree.y, tree.x, 64) - 0.5) * 0.5, spin = hash(tree.x, tree.y, 65) * 6.283;
      if (n === 5) {
        place("taper", 0x6a5038, tree.x, 5 * big, tree.y, 2, 10 * big, 2);
        place("cone", 0xdfeef4, tree.x, 20 * big, tree.y, 9 * big, 22 * big, 9 * big);
        place("cone", 0xc4dce8, tree.x, 31 * big, tree.y, 6 * big, 16 * big, 6 * big);
        continue;
      }
      const high = 30 * big, topX = tree.x + Math.sin(lean) * high * 0.5, leaf = n === 3 ? 0x6a7a3a : n === 7 ? 0x3a6a4a : hash(tree.x, tree.y, 66) < 0.5 ? 0x3aa858 : 0x4cbc62;
      place("taper", n === 3 ? 0x4a3a30 : 0x9a7446, tree.x + Math.sin(lean) * high * 0.25, high / 2, tree.y, 1.9, high, 1.9, [0, 0, -lean]);
      for (let k = 0; k < 6; k++) {
        const a = spin + k * 1.047;
        place("box", leaf, topX + Math.sin(a) * 7.5 * big, high - 2.2 * big, tree.y + Math.cos(a) * 7.5 * big, 4.2 * big, 0.6, 16 * big, [0.42, a, 0]);
      }
      place("ball", 0x6a4a2a, topX, high - 1.5, tree.y, 2.1, 2.1, 2.1);
    }
    for (const rock of rocks) {
      const big = 5 + hash(rock.x, rock.y, 67) * 4;
      place("lump", rock.isle.n === 5 ? 0xc8dce8 : 0x8a8694, rock.x, big * 0.5, rock.y, big, big * 0.8, big, [0, hash(rock.y, rock.x, 68) * 3, 0]);
    }
    for (const lump of lumps.values()) {
      const shape = new THREE.BufferGeometry();
      shape.setAttribute("position", new THREE.Float32BufferAttribute(lump.position, 3));
      shape.setAttribute("normal", new THREE.Float32BufferAttribute(lump.normal, 3));
      shape.setAttribute("color", new THREE.Float32BufferAttribute(lump.color, 3));
      const mesh = new THREE.Mesh(shape, grounds[lump.name]);
      mesh.receiveShadow = true;
      scene.add(mesh);
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
    // The wall of storm wind round Storm's Eye, and the dark clouds that circle above it
    const eye = ISLES[7].at;
    const streaks = picture2(128, 128, function (g) {
      for (let n = 0; n < 40; n++) {
        g.fillStyle = n % 2 ? "rgba(200,180,255,0.5)" : "rgba(90,70,150,0.6)";
        g.fillRect(hash(n, 3, 91) * 128, hash(n, 4, 91) * 128, 30 + hash(n, 5, 91) * 50, 2 + hash(n, 6, 91) * 3);
      }
    }, true);
    streaks.repeat.set(24, 3);
    stormWall = new THREE.Mesh(new THREE.CylinderGeometry(STORM_WALL * TILE, STORM_WALL * TILE, 240, 64, 1, true), new THREE.MeshBasicMaterial({ map: streaks, color: 0xa890f0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    stormWall.position.set(eye.x * TILE, 118, eye.y * TILE);
    scene.add(stormWall);
    stormClouds = new THREE.Group();
    stormClouds.position.set(eye.x * TILE, 0, eye.y * TILE);
    for (let k = 0; k < 14; k++) {
      const puff = new THREE.Mesh(SHAPE.ball, paint(0x4a4660));
      puff.position.set(Math.cos(k * 0.45) * (180 + (k % 3) * 120), 250 + (k % 4) * 16, Math.sin(k * 0.45) * (180 + (k % 3) * 120));
      puff.scale.set(90, 34, 70);
      stormClouds.add(puff);
    }
    scene.add(stormClouds);
  }

  // ----- Things made once and moved about every frame -----
  const mine = makeHuman();
  scene.add(mine.group);
  const others = Array.from({ length: 12 }, function () {
    const human = makeHuman();
    scene.add(human.group);
    return human;
  });
  // Your sailing boat. The front of it points along +z. The sail swings round to catch the wind.
  const boatModel = new THREE.Group();
  const sail = new THREE.Group();
  (function () {
    const wood = paint(0x9a6a3a), darkWood = paint(0x6a4a2a);
    box(13, 5, 26, wood, 0, 1.5, -2, boatModel);
    box(9.2, 5, 9.2, wood, 0, 1.5, 11, boatModel).rotation.y = Math.PI / 4;        // a square turned cornerways makes the pointed bow
    box(9.9, 1.2, 9.9, darkWood, 0, 4.2, 11, boatModel).rotation.y = Math.PI / 4;
    box(14, 1.2, 27, darkWood, 0, 4.2, -2, boatModel);          // the rail round the top
    box(11, 0.8, 22, paint(0xd8b878), 0, 0.2, -2, boatModel);      // the deck
    tube(0.8, 0.9, 40, darkWood, 0, 22, 4, boatModel);            // the mast
    sail.position.set(0, 0, 4);
    const cloth = new THREE.BufferGeometry();
    cloth.setAttribute("position", new THREE.Float32BufferAttribute([0, 8, -0.8, 0, 41, -0.8, 0, 8, -21], 3));
    cloth.computeVertexNormals();
    const sheet = new THREE.Mesh(cloth, new THREE.MeshLambertMaterial({ color: 0xfff6e8, side: THREE.DoubleSide }));
    sheet.castShadow = true;
    sail.add(sheet);
    const stripe = new THREE.BufferGeometry();
    stripe.setAttribute("position", new THREE.Float32BufferAttribute([0.15, 8, -0.8, 0.15, 17, -0.8, 0.15, 8, -21, -0.15, 8, -0.8, -0.15, 17, -0.8, -0.15, 8, -21], 3));
    stripe.computeVertexNormals();
    sail.add(new THREE.Mesh(stripe, new THREE.MeshLambertMaterial({ color: 0xff7a4a, side: THREE.DoubleSide })));
    box(0.8, 0.8, 22, darkWood, 0, 7.6, -11, sail);               // the boom along the bottom of the sail
    boatModel.add(sail);
    const flag = box(0.3, 3, 6, paint(0xff5a5a), 0, 41, 1, boatModel);
    flag.castShadow = false;
    scene.add(boatModel);
  })();
  // Streaks of wind you can see blowing past, and clouds that drift along on it
  const gusts = Array.from({ length: 34 }, function (unused, n) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    mesh.userData = { x: 0, z: 0, y: 6 + (n % 9) * 5, long: 18 + (n % 5) * 9, life: -1 };
    scene.add(mesh);
    return mesh;
  });
  const cloudPaint = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const clouds = Array.from({ length: 12 }, function (unused, n) {
    const cloud = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), cloudPaint);
      puff.position.set((k - 1) * 38, k === 1 ? 10 : 0, (k % 2) * 14);
      puff.scale.set(46 - Math.abs(k - 1) * 10, 22, 34);
      cloud.add(puff);
    }
    cloud.userData = { x: hash(n, 1, 92) * 3000 - 1500, z: hash(n, 2, 92) * 3000 - 1500 };
    cloud.position.y = 300 + (n % 4) * 26;
    scene.add(cloud);
    return cloud;
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
  // The homes you build: a little log cabin with a red roof, a chimney, a flag and a lamp that glows at night
  const homeModels = Array.from({ length: ISLES.length }, function () {
    const home = new THREE.Group();
    box(28, 15, 24, 0xb07a44, 0, 7.5, 0, home);
    for (const y of [4, 8, 12]) box(28.6, 0.6, 24.6, 0x8a5a30, 0, y, 0, home);           // the lines between the logs
    add(new THREE.Mesh(new THREE.ConeGeometry(23, 13, 4), paint(0xd8483a)), 0, 21.5, 0, home).rotation.y = Math.PI / 4;
    box(7, 11, 1, 0x4a3020, 0, 5.5, 12.3, home);                                            // the door, on the south side
    box(6, 5, 0.8, new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), 8.6, 9, 12.3, home).castShadow = false;       // a lit window
    box(4, 9, 4, 0x8a8694, 7, 23, -4, home);
    tube(0.5, 0.5, 18, 0x6a4a2a, -12, 22, 11, home);
    box(0.4, 4, 7, 0x3aa858, -12, 29, 14.6, home).castShadow = false;
    home.userData.lamp = glow(0xffd890, 110, 0, 12, 16, home);
    home.visible = false;
    scene.add(home);
    return home;
  });
  // At dusk a golden ring on the ground shows how close to your home you must stay to be safe
  const safeRing = flat(new THREE.Mesh(new THREE.RingGeometry(HOME_SAFE - 2.5, HOME_SAFE, 64), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.6, depthWrite: false })));
  // The giant sea Wildlings that rise at night
  const giantModels = Array.from({ length: 4 }, function () {
    const model = makeCreature();
    glow(0x7ad8ff, 60, 0, 22, 0, model.group);
    return model;
  });
  // Sea shells: little pink shells that gleam on the beaches
  const shellGems = Array.from({ length: 72 }, function () {
    const gem = new THREE.Mesh(new THREE.SphereGeometry(4, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0xffb8d0, emissive: 0x8a3a58, shininess: 120 }));
    gem.scale.set(1, 0.7, 1.2);
    scene.add(gem);
    glow(0xffd0e0, 26, 0, 3, 0, gem);
    return gem;
  });
  const sparks = Array.from({ length: 160 }, function () {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(mesh);
    return mesh;
  });
  // Storm rifts (raids): a spinning purple ring with a beam of light going up into the sky
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
      portal.group.visible = raidPortal.open && !(raid && raid.portal === raidPortal) && mode !== "outfit" && mode !== "arrive";
      portal.ring.rotation.y = portal.inner.rotation.y = time * 1.5 + n;
    });
  }

  let slow = 0, last = performance.now();
  function render() {
    fit();
    // On a slow computer, switch the shadows off so the game stays smooth
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
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
    const dressing = mode === "outfit" || mode === "arrive";
    // The wind: the sea's streaks slide along with it, windsocks point along it, and gusts and clouds blow past
    const wx = Math.cos(wind.angle), wz = Math.sin(wind.angle);
    sea.material.map.offset.x += (wx * dt * 26) / ((MAP * TILE * 3) / 70);
    sea.material.map.offset.y -= (wz * dt * 26) / ((MAP * TILE * 3) / 70);
    for (const sock of socks) {
      sock.rotation.y = -wind.angle + Math.sin(time * 5 + sock.position.x) * 0.12;
      sock.rotation.z = -0.12 + Math.sin(time * 7 + sock.position.z) * 0.06;
    }
    for (const gust of gusts) {
      const g = gust.userData;
      if ((g.life -= dt) <= 0 || Math.hypot(g.x - me.x, g.z - me.y) > 520) {         // start again, somewhere upwind of you
        const across = (Math.random() - 0.5) * 760;
        g.x = me.x - wx * (260 + Math.random() * 200) - wz * across;
        g.z = me.y - wz * (260 + Math.random() * 200) + wx * across;
        g.life = 2 + Math.random() * 2.5;
      }
      g.x += wx * dt * 250;
      g.z += wz * dt * 250;
      gust.position.set(g.x, g.y, g.z);
      gust.rotation.y = -wind.angle;
      gust.scale.set(g.long, 1, 1);
      gust.material.opacity = Math.min(0.5, g.life * 0.5) * (1 - dark * 0.5);
    }
    for (const cloud of clouds) {
      const c = cloud.userData;
      c.x += wx * dt * 26;
      c.z += wz * dt * 26;
      if (c.x > 1600) c.x -= 3200;
      if (c.x < -1600) c.x += 3200;
      if (c.z > 1600) c.z -= 3200;
      if (c.z < -1600) c.z += 3200;
      cloud.position.x = me.x + c.x;
      cloud.position.z = me.y + c.z;
    }
    stormWall.visible = state.chimes < 6;
    stormWall.rotation.y = time * 0.5;
    stormWall.material.opacity = 0.45 + Math.sin(time * 2) * 0.1;
    stormClouds.rotation.y = -time * 0.12;
    if (volcanoGlow) volcanoGlow.material.opacity = 0.5 + Math.sin(time * 2.2) * 0.2 + dark * 0.3;
    // Your boat bobs on the water, and its sail swings round so the wind fills it
    boatModel.position.set(state.boat.x, -0.6 + Math.sin(boat.rock * 1.3) * 0.5, state.boat.y);
    boatModel.rotation.set(Math.sin(boat.rock) * 0.04, boat.face, Math.sin(boat.rock * 0.8) * 0.06, "YXZ");
    let swing = Math.atan2(-wx, -wz) - boat.face;                   // (the sail trails away downwind of the mast)
    swing = Math.atan2(Math.sin(swing), Math.cos(swing));
    sail.rotation.y += (Math.max(-1.25, Math.min(1.25, swing)) - sail.rotation.y) * 0.08;
    homeModels.forEach(function (home, n) {
      const built = state.homes[n];
      home.visible = !!built && mode !== "arrive";
      if (!built) return;
      home.position.set(built.x, 0, built.y);
      home.userData.lamp.material.opacity = 0.15 + dark * 0.85;
    });
    const nearHome = state.homes.find((home) => Math.hypot(home.x - me.x, home.y - me.y) < 600);
    safeRing.visible = !!nearHome && clock >= 0.5 && !dressing;
    if (nearHome) {
      safeRing.position.set(nearHome.x, 0.9, nearHome.y);
      safeRing.material.opacity = 0.45 + Math.sin(time * 3) * 0.2;
    }
    giantModels.forEach(function (model, n) {
      const giant = giants[n];
      if (!giant || dressing) return (model.group.visible = false);
      showCreature(model, giant.id, giant.x, giant.y, giant.face, 0, false, true, true);
      model.group.scale.setScalar(5.5);
      model.group.position.y = -(1 - giant.rise) * 110 + Math.sin(time * 1.3 + n) * 3;       // (it rises up out of the water)
    });
    shellGems.forEach(function (gem, n) {
      const shell = shells[n];
      gem.visible = !!shell && !dressing && Math.abs(shell.x - me.x) < 700 && Math.abs(shell.y - me.y) < 700;
      if (gem.visible) {
        gem.position.set(shell.x, 0.4, shell.y);
        gem.rotation.y = n;
      }
    });
    // The camera sits behind you and a little above. It comes closer if a hut or a cliff would get in the way.
    if (mode === "arrive") {           // the start of the game: watch your boat sail in to the jetty
      const jetty = JETTIES[0];
      camera.position.set(jetty.x - 120, 58, jetty.y - 30);
      camera.lookAt(state.boat.x, 12, state.boat.y);
    } else if (dressing) {
      const side = look + 0.3;
      camera.position.set(me.x + Math.sin(side) * 35, 17, me.y + Math.cos(side) * 35);
      camera.lookAt(me.x + Math.cos(look) * -7, 12.5, me.y + Math.sin(look) * 7);
    } else {
      let back = 58 * zoom * (state.sailing ? 1.7 : 1);
      const blocked = function (far) {          // would the camera be inside a hut or a cliff?
        const cx = me.x + Math.sin(look) * far, cz = me.y + Math.cos(look) * far;
        return [-5, 0, 5].some((side) => [HUT, ROCK].includes(tileAt(cx + Math.cos(look) * side, cz - Math.sin(look) * side)));
      };
      const wanted = back;
      while (back > 8 && blocked(back)) back -= 4;
      // (when it has to come in close, it also rises, so it looks down on you and never fills the screen with your back)
      camera.position.set(me.x + Math.sin(look) * back, 16 + wanted * 0.42 * Math.max(0.9, zoom) + (wanted - back) * 0.75, me.y + Math.cos(look) * back);
      camera.lookAt(me.x - Math.sin(look) * 14, 14, me.y - Math.cos(look) * 14);
    }
    // People: you (standing in your boat when you sail), and the dozen islanders nearest to you
    mine.dress(state.outfit);
    mine.pose(me.x, me.y, dressing && mode !== "arrive" ? look + Math.sin(time * 0.8) * 0.9 : me.face, me.anim, me.moving && !dressing, me.running);
    if (state.sailing) {
      mine.group.position.set(state.boat.x - Math.sin(boat.face) * 7, 1.2 + Math.sin(boat.rock * 1.3) * 0.5, state.boat.y - Math.cos(boat.face) * 7);
      mine.group.rotation.y = boat.face;
    }
    const nearby = dressing ? [] : people.filter((who) => Math.hypot(who.x - me.x, who.y - me.y) < 760).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    others.forEach(function (human, n) {
      const who = nearby[n];
      human.group.visible = !!who;
      if (!who) return;
      human.dress(who.outfit);
      const chatting = Math.hypot(who.x - me.x, who.y - me.y) < 60 && !who.moving;
      human.pose(who.x, who.y, (fight && fight.trainer === who) || chatting ? Math.atan2(me.x - who.x, me.y - who.y) : FACING[who.dir], who.anim, who.moving, false);
    });
    // Wildlings
    const aim = dressing ? null : target();
    if (state.team.length) {
      const c = lead();
      const facing = aim ? Math.atan2(aim.x - pal.x, aim.y - pal.y) : me.face;
      showCreature(palModel, c.id, pal.x, pal.y, facing, pal.hop, surging > 0, !dressing && !state.sailing && c.hp > 0 && !(pal.flash > 0 && Math.floor(time * 20) % 2));
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
    renderer.render(scene, camera);
  }
  // Where on the screen (480 by 320) is a place in the world? Used for words that float above things.
  const spot = new THREE.Vector3();
  function project(x, y, high) {
    spot.set(x, high, y).project(camera);
    return spot.z > 1 || Math.abs(spot.x) > 1.2 ? null : { x: Math.round((spot.x + 1) * 240), y: Math.round((1 - spot.y) * 160) };
  }
  return { build: build, render: render, project: project, renderer: renderer };
})();
