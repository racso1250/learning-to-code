// Champion of the Wildlings in 3D. The game (game.js) works out where everything is on a flat map;
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
  // Everyone is built from smooth, rounded shapes: a body turned like clay on a wheel, arms and legs that taper,
  // and a head with a proper face (eyes that blink, eyebrows, a nose, rosy cheeks and a smile).
  const PERSON = 0.76;         // how big people are (1 would make them tower over the cars)
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
  // A little city car. The front of it points along +z.
  const CAR_COLOURS = [0xd83848, 0x3a6ad8, 0xf2c02a, 0x3aa858, 0xf4ecd8, 0x8a5ad8, 0xf07a2c, 0x2a2e3a, 0x4ac8c8, 0xe870b0];
  function makeCar(n) {
    const car = new THREE.Group(), colour = CAR_COLOURS[n % CAR_COLOURS.length], taxi = n % 5 === 2;
    box(15, 6, 38, colour, 0, 6, 0, car);                           // the body
    box(13.6, 6, 19, colour, 0, 11.6, -2, car);                     // the cabin
    box(13.9, 4, 16, 0x9fd8ff, 0, 11.8, -2, car);                   // side windows
    box(12, 4, 19.4, 0x9fd8ff, 0, 11.8, -2, car);                   // front and back windows
    box(15.4, 1.6, 38.6, 0x2a2e3a, 0, 3.4, 0, car);                 // bumpers
    if (taxi) box(5, 2, 3, 0xfff6c8, 0, 15.4, -2, car);             // a taxi's roof sign
    const wheels = [];
    for (const x of [-7, 7]) for (const z of [-11.5, 11.5]) {
      const wheel = tube(3.4, 3.4, 2.4, 0x1c1c22, x, 3.4, z, car);
      wheel.rotation.z = Math.PI / 2;
      tube(1.6, 1.6, 2.6, 0xc8ccd4, 0, 0, 0, wheel);
      wheels.push(wheel);
    }
    for (const x of [-5, 5]) {
      box(3, 2, 0.6, new THREE.MeshBasicMaterial({ color: 0xfff6c8 }), x, 6.6, 19.1, car).castShadow = false;       // headlights
      box(3, 1.6, 0.6, new THREE.MeshBasicMaterial({ color: 0xff3030 }), x, 6.6, -19.1, car).castShadow = false;    // tail lights
    }
    const beams = glow(0xfff0c0, 46, 0, 7, 24, car);                // a glow in front, for the night
    car.userData = { wheels: wheels, beams: beams };
    scene.add(car);
    return car;
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

  // ----- The city -----
  // Everything that never moves is collected into big lumps (one per piece of the map and per paint), so it draws fast.
  const PIECE = 32;            // a lump covers 32 by 32 squares
  const lumps = new Map();
  const walls = {};            // the paints: walls, shopfronts, roofs and ground
  const lampGlowPaint = new THREE.PointsMaterial({ map: glowPicture, color: 0xffd890, size: 70, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const litBulb = new THREE.MeshLambertMaterial({ color: 0xfff6c8 });
  const fences = [];
  let beacon = null, train = null;
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
    // Paints for the ground: smooth and plain, so the city looks neat
    const groundPaint = (colour, draw) => new THREE.MeshLambertMaterial({ map: picture2(64, 64, function (g) {
      g.fillStyle = colour;
      g.fillRect(0, 0, 64, 64);
      if (draw) draw(g);
    }, true), vertexColors: true });
    walls.road = groundPaint("#6e727c");
    walls.kerb = groundPaint("#d2cdbf");
    walls.pave = groundPaint("#b4ac9c", function (g) {      // big clean paving slabs
      g.fillStyle = "#a8a090";
      g.fillRect(0, 31, 64, 1);
      g.fillRect(0, 63, 64, 1);
      g.fillRect(31, 0, 1, 32);
      g.fillRect(63, 32, 1, 32);
    });
    walls.plaza = groundPaint("#e2d4b4", function (g) {
      g.fillStyle = "#d4c4a0";
      g.fillRect(0, 0, 32, 32);
      g.fillRect(32, 32, 32, 32);
    });
    walls.grass = groundPaint("#66bc56");
    walls.tall = groundPaint("#4fa648");
    walls.water = new THREE.MeshPhongMaterial({ color: 0x3a8ad8, shininess: 120, specular: 0xffffff, vertexColors: true });
    walls.pond = walls.water.clone();
    // All the ground lies flat at one height. Each layer is told to draw "in front of" the ones before it,
    // so roads sit on pavement, parks sit on roads, and ponds sit on parks, with no flickering.
    ["pave", "water", "kerb", "road", "plaza", "grass", "tall", "pond"].forEach(function (name, layer) {
      Object.assign(walls[name], { polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer * 4 });
    });
    // Pictures for the buildings: cream stone with tall windows, shutters and little iron balconies
    const wallPaint = function (lit) {
      const draw = (night) => function (g) {
        g.fillStyle = night ? "#000000" : "#ecd2bc";
        g.fillRect(0, 0, 64, 64);
        if (!night) {
          g.fillStyle = "#dcbea6";
          g.fillRect(0, 58, 64, 6);            // a stone band between floors
          g.fillStyle = "#cfae96";
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
          if (cafe === "mart") {                 // a star shard in the window of a shop
            g.fillStyle = "#3a6ad8";
            g.fillRect(24, 26, 16, 16);
            g.fillStyle = "#ffd84a";
            g.beginPath();
            g.moveTo(32, 27);
            g.lineTo(38, 34);
            g.lineTo(32, 41);
            g.lineTo(26, 34);
            g.fill();
          } else if (cafe) {                     // a green cross in the window of a cafe
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
    walls.mart = shopPaint("#3a6ad8", "mart");
    walls.slate = new THREE.MeshLambertMaterial({ vertexColors: true, map: picture2(64, 64, function (g) {       // a grey-blue slate roof with a little window in it
      g.fillStyle = "#3f7a6c";
      g.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 8; row++) {
        g.fillStyle = row % 2 ? "#366c60" : "#4a8a7a";
        g.fillRect(0, row * 8, 64, 7);
        g.fillStyle = "#2f5c52";
        for (let x = row % 2 ? 4 : 0; x < 64; x += 8) g.fillRect(x, row * 8, 1, 7);
      }
      g.fillStyle = "#ecd2bc";
      g.fillRect(20, 14, 24, 38);
      g.fillStyle = "#3d5a78";
      g.fillRect(24, 20, 16, 28);
      g.fillStyle = "#ecd2bc";
      g.fillRect(31, 20, 2, 28);
    }, true) });
    walls.zinc = new THREE.MeshLambertMaterial({ color: 0x8a96a4, vertexColors: true });
    walls.stone = new THREE.MeshLambertMaterial({ color: 0xcfc6b2, vertexColors: true });

    // The ground is laid in smooth layers, each a little higher than the last:
    // pavement, the river, roads with pale kerbs, the plaza, then the parks and their ponds.
    const mid = MID * TILE, up = [0, 1, 0];
    const flat = (name, y, a, b, c, d) => quad(name, [a[0], 0.05, a[1]], [b[0], 0.05, b[1]], [c[0], 0.05, c[1]], [d[0], 0.05, d[1]], up, [a, b, c, d].map(([x, z]) => [x / 32, z / 32]));
    const around = (r, turn) => [mid + Math.cos(turn) * r, mid + Math.sin(turn) * r];
    // A ring (or a filled circle, when "inner" is 0) made of thin wedges
    const ring = function (name, y, inner, outer, cx, cz) {
      for (let n = 0; n < 144; n++) {
        const a0 = (n / 144) * Math.PI * 2, a1 = ((n + 1) / 144) * Math.PI * 2;
        const at = (r, turn) => [(cx == null ? mid : cx) + Math.cos(turn) * r, (cz == null ? mid : cz) + Math.sin(turn) * r];
        flat(name, y, at(inner, a0), at(outer, a0), at(outer, a1), at(inner, a1));
      }
    };
    for (let r = 0; r < CITY_R * TILE + 12; r += 256) ring("pave", -1.6, r, Math.min(r + 256, CITY_R * TILE + 12));
    for (let tx = 0; tx < CW; tx++) {          // the river: a smooth winding ribbon
      const z0 = (MID - 36 + Math.sin(tx / 14) * 5) * TILE, z1 = (MID - 36 + Math.sin((tx + 1) / 14) * 5) * TILE, x0 = tx * TILE, x1 = x0 + TILE;
      if (Math.hypot(x0 - mid, z0 - mid) > CITY_R * TILE) continue;
      flat("water", -1.3, [x0, z0 + 40], [x1, z1 + 40], [x1, z1 - 40], [x0, z0 - 40]);
    }
    const HALF = 26;                            // half the width of the tarmac (the pavements are outside it)
    for (const r of RINGS) {
      ring("kerb", -1.0, r * TILE - HALF - 3, r * TILE + HALF + 3);
      ring("road", -0.8, r * TILE - HALF, r * TILE + HALF);
    }
    for (const avenue of AVENUES) {            // the avenues, cut into short lengths so they light and fog properly
      const turn = (avenue.deg * Math.PI) / 180, sx = -Math.sin(turn), sz = Math.cos(turn);
      for (let r = avenue.from * TILE; r < CITY_R * TILE; r += 128) {
        const [ax, az] = around(r, turn), [bx, bz] = around(Math.min(r + 128, CITY_R * TILE), turn);
        const strip = (name, y, wide) => flat(name, y, [ax + sx * wide, az + sz * wide], [bx + sx * wide, bz + sz * wide], [bx - sx * wide, bz - sz * wide], [ax - sx * wide, az - sz * wide]);
        strip("kerb", -0.9, HALF + 3);
        strip("road", -0.7, HALF);
      }
    }
    ring("kerb", -0.6, 0, 16 * TILE + 3);
    ring("plaza", -0.5, 0, 16 * TILE);
    for (const park of PARKS) {
      const px = park.at.x * TILE, pz = park.at.y * TILE;
      ring("kerb", -0.4, 0, park.r * TILE + 3, px, pz);
      ring("grass", -0.3, 0, park.r * TILE, px, pz);
      for (let n = 0; n < 7; n++) {             // patches of longer grass
        const turn = n * 0.9 + park.r, far = park.r * TILE * (0.3 + hash(n, park.r, 66) * 0.42);
        ring("tall", -0.2, 0, 26 + hash(park.r, n, 67) * 22, px + Math.cos(turn) * far, pz + Math.sin(turn) * far);
      }
      if (park.pond) {
        ring("pond", -0.1, 0, park.r * TILE * 0.36, px, pz);
      }
    }
    // The buildings: a row of shops, floors of windows, then a sloping slate roof
    for (const b of buildings) {
      // (drawn a little smaller than the ground it stands on, which leaves a clean strip of pavement all round)
      const x0 = b.x * TILE + 5, x1 = (b.x + b.w) * TILE - 5, z0 = b.y * TILE + 5, z1 = (b.y + b.h) * TILE - 5, high = 15 + b.floors * STOREY;
      wallsOf(b.mart ? "mart" : b.cafe ? "cafe" : "shop" + b.shop, x0, x1, z0, z1, 0, 15, 1, null);
      wallsOf(b.lit ? "lit" : "unlit", x0, x1, z0, z1, 15, high, b.floors, TINTS[b.tint]);
      wallsOf("stone", x0 - 0.8, x1 + 0.8, z0 - 0.8, z1 + 0.8, high, high + 1.6, 1, null);          // a ledge under the roof
      quad("stone", [x0 - 0.8, high + 1.6, z1 + 0.8], [x1 + 0.8, high + 1.6, z1 + 0.8], [x1 + 0.8, high + 1.6, z0 - 0.8], [x0 - 0.8, high + 1.6, z0 - 0.8], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      wallsOf("slate", x0, x1, z0, z1, high + 1.6, high + 14, 1, null, 5, true);
      quad("zinc", [x0 + 5, high + 14, z1 - 5], [x1 - 5, high + 14, z1 - 5], [x1 - 5, high + 14, z0 + 5], [x0 + 5, high + 14, z0 + 5], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
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
      const flatGround = ["road", "kerb", "pave", "plaza", "grass", "tall", "water", "pond"].includes(lump.name);
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
      // (a cafe has a green cross; a shop has a blue sign with a gold star shard on it)
      const signPaint = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: cafe.shop ? 0x3a6ad8 : 0x3aa858, emissiveIntensity: 0.5 });
      box(12, 12, 1.5, signPaint, cafe.x, 24, cafe.y - 13.4);
      if (cafe.shop) {
        box(9.5, 9.5, 2.2, 0x3a6ad8, cafe.x, 24, cafe.y - 13.4);
        const gem = box(5, 5, 2.8, 0xffd84a, cafe.x, 24, cafe.y - 13.4);
        gem.rotation.z = Math.PI / 4;
      } else {
        box(8, 2.8, 2.2, 0x3aa858, cafe.x, 24, cafe.y - 13.4);
        box(2.8, 8, 2.2, 0x3aa858, cafe.x, 24, cafe.y - 13.4);
      }
      glow(cafe.shop ? 0x8ab8ff : 0x7af0a0, 60, cafe.x, 22, cafe.y - 4);
    }
    // The railway: rails outside the south wall, a platform with a roof, and the train you arrive on
    const sx = STATION.x, sz = STATION.y;
    for (const side of [-7, 7]) box(2600, 1.2, 1.6, 0x4a4e5c, sx, 0.6, sz + side);
    for (let n = -40; n <= 40; n++) box(4, 0.8, 24, 0x6a5038, sx + n * 32, 0.3, sz);
    box(300, 3, 34, 0xcfc8b8, sx, 1.5, sz - 32);
    box(300, 2, 46, 0x3f7a6c, sx, 38, sz - 34);
    for (const x of [-130, -45, 45, 130]) box(3, 36, 3, 0x2a2e3a, sx + x, 20, sz - 20);
    const board = picture2(256, 64, function (g) {
      g.fillStyle = "#2a2e3a";
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = "#fff27a";
      g.font = "bold 30px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("CROWNHAVEN", 128, 34);
    });
    add(new THREE.Mesh(new THREE.BoxGeometry(110, 26, 2), new THREE.MeshBasicMaterial({ map: board })), sx, 53, sz - 34);
    train = new THREE.Group();
    for (let n = 0; n < 4; n++) {
      const x = n * 104;
      box(98, 22, 22, n === 0 ? 0xd83848 : 0xf4ecd8, x, 19, 0, train);
      box(98, 5, 22.4, 0xd83848, x, 12, 0, train);
      box(98, 3, 20, 0x8a94a0, x, 31.5, 0, train);
      for (let w = -3; w <= 3; w++) if (n || w > -2) box(9, 9, 22.6, 0x9fd8ff, x + w * 13, 22, 0, train);
      for (const w of [-34, 34]) for (const side of [-9, 9]) tube(5, 5, 3, 0x2a2e3a, x + w, 5, side, train).rotation.x = Math.PI / 2;
    }
    const nose = add(new THREE.Mesh(new THREE.ConeGeometry(15.5, 30, 4), paint(0xd83848)), -64, 17, 0, train);
    nose.rotation.set(0, Math.PI / 4, Math.PI / 2);
    ball(3, new THREE.MeshBasicMaterial({ color: 0xfff6c8 }), -74, 14, 0, train).castShadow = false;
    train.position.set(sx - 20, 0, sz);
    scene.add(train);
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
    const hoop = (r, y) => add(new THREE.Mesh(new THREE.TorusGeometry(r, 1.6, 6, 24), ringPaint), 0, y, 0, tower).rotation.set(Math.PI / 2, 0, 0);
    tier(24, 31, 70, 0, 0xe4dcc8);
    tier(27, 27, 5, 70, 0x3f7a6c);
    tier(17, 22, 130, 75, 0xdcd4c0);
    tier(21, 21, 5, 205, 0x3f7a6c);
    tier(9, 15, 100, 210, 0xd4ccb8);
    add(new THREE.Mesh(new THREE.ConeGeometry(9, 60, 8), paint(0x3f7a6c)), 0, 340, 0, tower);
    hoop(29, 74);
    hoop(23, 209);
    hoop(12, 312);
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
  // The people who stroll about the city, and the cars that drive round it (game.js moves them; here they are drawn)
  const walkerModels = Array.from({ length: 14 }, function () {
    const human = makeHuman();
    scene.add(human.group);
    return human;
  });
  const carModels = Array.from({ length: 12 }, (unused, n) => makeCar(n));
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
  // Star shards: little spinning gold gems that glitter on the streets
  const shardGems = Array.from({ length: 80 }, function () {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(4), new THREE.MeshPhongMaterial({ color: 0xffd84a, emissive: 0xa87000, shininess: 120 }));
    gem.scale.y = 1.5;
    scene.add(gem);
    glow(0xfff0a0, 34, 0, 0, 0, gem);
    return gem;
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
    for (const r of [23.5, 133.5]) {
      const arc = new THREE.Mesh(new THREE.CylinderGeometry(r * TILE, r * TILE, 30, 40, 1, true, Math.PI / 2 - to, to - from), zonePaint);
      arc.position.set(mid, 15, mid);
      zoneWalls.add(arc);
    }
    for (const a of [from, to]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(110 * TILE, 30), zonePaint);
      side.position.set(mid + Math.cos(a) * 78.5 * TILE, 15, mid + Math.sin(a) * 78.5 * TILE);
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
    for (const name of ["lit", "shop0", "shop1", "shop2", "cafe", "mart"]) walls[name].emissiveIntensity = dark;
    if (beacon) beacon.material.opacity = 0.4 + dark * 0.6;
    for (const fence of fences) fence.material.opacity = 0.14 + Math.sin(time * 3) * 0.05 + dark * 0.12;
    // The camera sits behind you and a little above. It comes closer if a building would get in the way.
    const dressing = mode === "outfit" || mode === "train";
    shardGems.forEach(function (gem, n) {
      const shard = shards[n];
      gem.visible = !!shard && !dressing && Math.abs(shard.x - me.x) < 700 && Math.abs(shard.y - me.y) < 700;
      if (gem.visible) {
        gem.position.set(shard.x, 9 + Math.sin(time * 3 + n) * 2, shard.y);
        gem.rotation.y = time * 2 + n;
      }
    });
    if (mode === "train") {            // the start of the game: watch your train roll into the station
      const part = Math.min(1, trainTime / 3.6), eased = 1 - (1 - part) * (1 - part);
      train.position.x = STATION.x - 20 + (1 - eased) * 1500;
      camera.position.set(STATION.x - 150, 74, STATION.y + 210);
      camera.lookAt(STATION.x + 30 + (1 - eased) * 260, 22, STATION.y - 20);
    } else if (dressing) {
      const side = look + 0.3;
      camera.position.set(me.x + Math.sin(side) * 35, 17, me.y + Math.cos(side) * 35);
      camera.lookAt(me.x + Math.cos(look) * -7, 12.5, me.y + Math.sin(look) * 7);
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
      camera.lookAt(me.x - Math.sin(look) * 14, 14, me.y - Math.cos(look) * 14);
    }
    // People
    mine.group.visible = mode !== "train" || trainTime > 4;        // (you step off the train once it has stopped)
    mine.dress(state.outfit);
    mine.pose(me.x, me.y, mode === "train" ? 0 : dressing ? look + Math.sin(time * 0.8) * 0.9 : me.face, me.anim, me.moving && !dressing, me.running);
    if (mode === "train") mine.group.position.y = 3;        // (standing up on the platform)
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
    walkerModels.forEach(function (human, n) {
      const who = walkers[n];
      human.group.visible = !!who && who.live && !dressing && Math.hypot(who.x - me.x, who.y - me.y) < 640;
      if (!human.group.visible) return;
      human.dress(who.outfit);
      human.pose(who.x, who.y, who.face, who.anim, who.moving, who.jog);
    });
    carModels.forEach(function (model, n) {
      const car = cars[n];
      model.visible = !!car && car.live && !dressing && Math.hypot(car.x - me.x, car.y - me.y) < 950;
      if (!model.visible) return;
      model.position.set(car.x, 0, car.y);
      let swing = car.face - model.rotation.y;
      swing = Math.atan2(Math.sin(swing), Math.cos(swing));
      model.rotation.y += swing * 0.25;                       // (turns smoothly round corners)
      for (const wheel of model.userData.wheels) wheel.rotation.x = car.rolled / 3.4;
      model.userData.beams.visible = dark > 0.3;
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
