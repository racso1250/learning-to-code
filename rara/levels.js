// Ra Ra Escape: the levels.
// Your garden, then the four places the stick bug chases you through:
// the City, the Swamp, the Mountains, and the Alaskan Redwood Forest.
// Every level runs "north": you start at z = 0 and run towards minus z.

// A new, empty level. Each "build" function below fills one in.
function newLevel(options) {
  const L = {
    id: "", name: "", length: 400, half: 12, bugSpeed: 8, gap: 42,
    sky: 0x9fd0f0, fog: [60, 400], amb: 0.7, sun: 0.6,
    group: new THREE.Group(),
    solids: [],     // things you bump into: round { x, z, r } or square { x0, x1, z0, z1 }
    doors: [],      // places to hide inside: { x, z, name, clue, safe, building, rubble }
    hides: [],      // patches of reeds to hide in: { x, z, r }
    boulders: [],   // rocks you can push: { x, z, mesh }
    levers: [],
    marks: [0],     // where you start again if you are caught
    ground: function () { return 0; },
    pace: function () { return 1; },
  };
  for (const key in options) L[key] = options[key];
  return L;
}

const dice = seeded(7);

// A place to hide: a glowing doorway, and a sign that says what it is
function addDoor(L, x, y, z, side, name, clue, safe, building, rubble) {
  const frame = new THREE.Group();
  frame.position.set(x, y, z);
  frame.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  const lit = bright(0x7dff8a);
  box(frame, lit, 0.18, 2.6, 0.18, -0.8, 1.3, 0);
  box(frame, lit, 0.18, 2.6, 0.18, 0.8, 1.3, 0);
  box(frame, lit, 1.8, 0.18, 0.18, 0, 2.6, 0);
  box(frame, paint(0x1a1410), 1.5, 2.5, 0.1, 0, 1.25, -0.05);
  L.group.add(frame);
  if (rubble) rubble.visible = false;
  const door = { x: x, y: y, z: z, side: side, name: name, clue: clue, safe: safe, building: building, rubble: rubble, frame: frame, used: false, cracking: false };
  L.doors.push(door);
  return door;
}

// A heap of broken bits, for when the stick bug smashes a building
function makeRubble(colour) {
  const g = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const bit = box(g, paint(i % 3 ? colour : 0x8a8a8a), 1 + dice() * 2.5, 0.5 + dice() * 1.5, 1 + dice() * 2.5, (dice() - 0.5) * 9, 0.4 + dice() * 1.2, (dice() - 0.5) * 9);
    bit.rotation.set(dice(), dice() * 3, dice());
  }
  return g;
}

// ===== 0. Home =====
function buildHome() {
  const L = newLevel({ id: "home", name: "Your garden", length: 60, half: 16, sky: 0x0a1226, fog: [20, 120], amb: 0.5, sun: 0.2, quiet: true });
  const g = L.group;
  box(g, paint(0x2f6a3a), 60, 0.2, 90, 0, -0.1, -20);
  // Your house, with a warm light in the window
  box(g, paint(0xc8a878), 12, 6, 9, -8, 3, 6);
  piece(g, new THREE.ConeGeometry(9.5, 4, 4), paint(0x8a3a2a), -8, 8, 6).rotation.y = Math.PI / 4;
  box(g, bright(0xffe9a0), 2.4, 1.8, 0.1, -10, 3.2, 1.45);
  box(g, paint(0x5a3a22), 1.4, 2.6, 0.1, -5, 1.3, 1.45);
  L.solids.push({ x0: -14, x1: -2, z0: 1.5, z1: 10.5 });
  // A fence, and the bush where the noise is coming from
  for (let x = -16; x <= 16; x += 2) box(g, paint(0xe8e0d0), 0.25, 1.4, 0.12, x, 0.7, -32);
  box(g, paint(0xe8e0d0), 32, 0.14, 0.1, 0, 1, -32);
  ball(g, paint(0x2a7a3a), 2.4, 1.8, 2.4, 6, 1.4, -22);
  ball(g, paint(0x3a8a4a), 1.6, 1.4, 1.6, 8, 1.1, -20.6);
  L.bush = { x: 6, z: -19.5 };
  const lamp = glow(0xffe9a0, 14);
  lamp.position.set(-10, 3.2, 0.5);
  g.add(lamp);
  // Stars
  const stars = new Float32Array(600);
  for (let i = 0; i < 200; i++) {
    const a = dice() * 6.3;
    const up = 0.15 + dice() * 1.2;
    stars[i * 3] = Math.cos(a) * Math.cos(up) * 500;
    stars[i * 3 + 1] = Math.sin(up) * 500;
    stars[i * 3 + 2] = Math.sin(a) * Math.cos(up) * 500;
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.BufferAttribute(stars, 3));
  g.add(new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, fog: false })));
  return L;
}

// ===== 1. The City =====
const windowPicture = (function () {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const pen = c.getContext("2d");
  pen.fillStyle = "#3a3a44";
  pen.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 4; k++) {
      pen.fillStyle = dice() < 0.45 ? "#ffe9a0" : "#16202e";
      pen.fillRect(4 + i * 16, 4 + k * 16, 9, 10);
    }
  }
  const picture = new THREE.CanvasTexture(c);
  picture.wrapS = picture.wrapT = THREE.RepeatWrapping;
  return picture;
})();

// A plain city building: a block covered in windows
function makeBlock(wide, high, deep, colour) {
  const shape = new THREE.BoxGeometry(wide, high, deep);
  const uv = shape.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(wide, deep) / 8, uv.getY(i) * high / 8);
  return new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ color: colour, map: windowPicture, emissive: 0x554422, emissiveMap: windowPicture }));
}

// The special buildings you can hide in. Each is built with its front facing "plus z".
const SHOPS = {
  glass: { name: "Flo's Glass Shop", clue: "its walls are all glass", safe: false, rubble: 0x9fe8ff },
  bank: { name: "the City Bank", clue: "thick stone walls and a steel door", safe: true },
  cafe: { name: "the Corner Cafe", clue: "big glass windows", safe: false, rubble: 0xd8443a },
  shed: { name: "an old garden shed", clue: "thin wooden planks", safe: false, rubble: 0x9a6a3a },
  fire: { name: "the Fire Station", clue: "solid brick, built to last", safe: true },
  toys: { name: "the Toy Shop", clue: "one huge shop window", safe: false, rubble: 0xffd23a },
  library: { name: "the Stone Library", clue: "heavy stone, and no big windows", safe: true },
};

function makeShop(kind) {
  const g = new THREE.Group();
  const sign = function (text, back, ink, y) {
    const board = makeSign(text, back, ink, 9);
    board.position.set(0, y, 7.1);
    g.add(board);
  };
  if (kind === "glass") {
    box(g, paint(0x8a9aa8), 16, 7, 14, 0, 3.5, 0);
    box(g, new THREE.MeshPhongMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, emissive: 0x1a4a5a }), 14, 4.6, 0.3, 0, 2.6, 7);
    sign("FLO'S GLASS", "#0a3a4a", "#9fe8ff", 6);
  } else if (kind === "bank") {
    box(g, paint(0xa8a8a0), 18, 13, 14, 0, 6.5, 0);
    for (const x of [-6, -2, 2, 6]) piece(g, new THREE.CylinderGeometry(0.7, 0.7, 9, 8), paint(0xd8d8cc), x, 4.5, 7.6);
    box(g, paint(0xd8d8cc), 18, 1.4, 2.4, 0, 9.7, 7.4);
    sign("CITY BANK", "#3a3a30", "#ffd76a", 11.6);
  } else if (kind === "cafe") {
    box(g, paint(0xf0e0c0), 16, 8, 14, 0, 4, 0);
    box(g, new THREE.MeshPhongMaterial({ color: 0xbfefff, transparent: true, opacity: 0.5, emissive: 0x3a3a1a }), 13, 3.6, 0.3, 0, 2.4, 7);
    for (let n = 0; n < 8; n++) box(g, paint(n % 2 ? 0xffffff : 0xd8443a), 2, 0.25, 3, -7 + n * 2, 5, 8);
    sign("CORNER CAFE", "#d8443a", "#ffffff", 7);
  } else if (kind === "shed") {
    box(g, paint(0x9a6a3a), 9, 5, 9, 0, 2.5, 2);
    piece(g, new THREE.ConeGeometry(7.4, 2.6, 4), paint(0x6a4a2a), 0, 6.3, 2).rotation.y = Math.PI / 4;
    for (let n = 0; n < 5; n++) box(g, paint(0x7a5230), 0.12, 5, 0.1, -3.6 + n * 1.8, 2.5, 6.55);
    sign("GARDEN SHED", "#5a3a1a", "#f0e0c0", 4.4);
  } else if (kind === "fire") {
    box(g, paint(0xa83a2a), 18, 12, 14, 0, 6, 0);
    box(g, paint(0xf4f4f4), 6, 6, 0.3, -4, 3, 7);
    box(g, paint(0xf4f4f4), 18.2, 0.8, 14.2, 0, 12, 0);
    sign("FIRE STATION", "#f4f4f4", "#a81a0a", 9.6);
  } else if (kind === "toys") {
    box(g, paint(0xffd23a), 16, 9, 14, 0, 4.5, 0);
    box(g, new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, emissive: 0x4a3a1a }), 12, 5, 0.3, 0, 3, 7);
    for (let n = 0; n < 5; n++) ball(g, paint([0xff5a5a, 0x4a9aff, 0x7ad86a, 0xc87aff, 0xff9a3a][n]), 0.8, 0.8, 0.8, -4 + n * 2, 1.2, 6.2);
    sign("TOY SHOP", "#4a7ad8", "#ffffff", 8);
  } else {
    box(g, paint(0x9a9488), 18, 12, 14, 0, 6, 0);
    for (const x of [-7, 7]) piece(g, new THREE.CylinderGeometry(0.8, 0.8, 10, 8), paint(0xc8c0b0), x, 5, 7.7);
    for (let n = 0; n < 3; n++) box(g, paint(0xc8c0b0), 16 - n * 1.5, 0.4, 2 - n * 0.5, 0, 0.2 + n * 0.4, 8 - n * 0.3);
    piece(g, new THREE.ConeGeometry(12, 3, 4), paint(0x7a746a), 0, 13.5, 0).rotation.y = Math.PI / 4;
    sign("LIBRARY", "#5a5448", "#f0e8d0", 9.4);
  }
  return g;
}

function buildCity() {
  const L = newLevel({ id: "city", name: "The City", length: 460, half: 11.3, bugSpeed: 9.2, gap: 42, sky: 0x0c1428, fog: [30, 240], amb: 0.6, sun: 0.25, marks: [0, -230] });
  const g = L.group;
  box(g, paint(0x2a2c34), 15, 0.2, 560, 0, -0.1, -230);
  for (const side of [-1, 1]) box(g, paint(0x8a8a90), 5.5, 0.34, 560, side * 10.2, -0.02, -230);
  box(g, paint(0x22242a), 120, 0.1, 560, 0, -0.2, -230);
  sprinkle(g, new THREE.BoxGeometry(0.3, 0.05, 3), bright(0xe8e8d0), Array.from({ length: 62 }, function (v, n) { return { x: 0, y: 0.03, z: 30 - n * 8 }; }));

  // Which special building goes in which slot along the street (each slot is 20 metres)
  const special = { "1,2": "glass", "-1,5": "bank", "1,8": "cafe", "-1,11": "shed", "1,14": "fire", "-1,17": "toys", "1,20": "library" };
  const colours = [0x6a7088, 0x8a7a6a, 0x5a6a7a, 0x7a6a80, 0x9a8a7a, 0x60707a];
  for (const side of [-1, 1]) {
    for (let k = -2; k < 25; k++) {
      const z = -10 - k * 20;
      const kind = special[side + "," + k];
      if (kind) {
        const shop = makeShop(kind);
        shop.position.set(side * 20, 0, z);
        shop.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(shop);
        const info = SHOPS[kind];
        const rubble = info.safe ? null : makeRubble(info.rubble);
        if (rubble) {
          rubble.position.set(side * 18, 0, z);
          g.add(rubble);
        }
        addDoor(L, side * 12.8, 0.15, z, side, info.name, info.clue, info.safe, shop, rubble);
      } else {
        const high = 12 + dice() * 30;
        const block = makeBlock(14, high, 18.6, colours[Math.floor(dice() * colours.length)]);
        block.position.set(side * 20, high / 2, z);
        g.add(block);
      }
    }
    // Street lamps
    for (let z = 20; z > -470; z -= 40) {
      piece(g, new THREE.CylinderGeometry(0.12, 0.16, 7, 6), paint(0x2a2a30), side * 8, 3.5, z);
      const lamp = glow(0xffe0a0, 9);
      lamp.position.set(side * 7.4, 7, z);
      g.add(lamp);
      L.solids.push({ x: side * 8, z: z, r: 0.3 });
    }
  }
  // Cars left in the road. You have to dodge round them.
  const paints = [0xd8443a, 0xffd23a, 0x4a7ad8, 0xf4f4f4, 0x3a8a5a, 0x8a4ad8];
  for (let z = -26; z > -440; z -= 19 + dice() * 9) {
    const x = [-4.4, 0, 4.4][Math.floor(dice() * 3)];
    const car = new THREE.Group();
    car.position.set(x, 0, z);
    car.rotation.y = (dice() - 0.5) * 0.5;
    box(car, paint(paints[Math.floor(dice() * paints.length)]), 2, 0.8, 4.3, 0, 0.75, 0);
    box(car, paint(0x2a3440), 1.8, 0.7, 2.2, 0, 1.45, 0.2);
    for (const wx of [-1, 1]) for (const wz of [-1.4, 1.4]) piece(car, new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8), paint(0x16161a), wx, 0.4, wz).rotation.z = Math.PI / 2;
    g.add(car);
    L.solids.push({ x0: x - 1.2, x1: x + 1.2, z0: z - 2.3, z1: z + 2.3 });
  }
  // The old bridge out of town
  for (const side of [-1, 1]) box(g, paint(0x6a5a4a), 3, 14, 3, side * 9, 7, -462);
  box(g, paint(0x6a5a4a), 22, 3, 3, 0, 13, -462);
  const way = makeSign("SWAMP ROAD", "#2a4a2a", "#e8f0c0", 12);
  way.position.set(0, 13, -460.4);
  g.add(way);
  return L;
}

// ===== 2. The Swamp =====
const BOARDS = [[0, 10], [0, -20], [-14, -70], [10, -125], [-18, -190], [16, -255], [-8, -325], [12, -395], [0, -440], [0, -480]];

// How far a spot is from the wooden walkway
function boardGap(x, z) {
  let best = 999;
  for (let n = 0; n < BOARDS.length - 1; n++) {
    const a = BOARDS[n];
    const b = BOARDS[n + 1];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  return best;
}

// Where the walkway is (its x) at a given z
function boardX(z) {
  for (let n = 0; n < BOARDS.length - 1; n++) {
    const a = BOARDS[n];
    const b = BOARDS[n + 1];
    if (z <= a[1] && z >= b[1]) return a[0] + (b[0] - a[0]) * (a[1] - z) / (a[1] - b[1]);
  }
  return 0;
}

function buildSwamp() {
  const L = newLevel({ id: "swamp", name: "The Swamp", length: 460, half: 32, bugSpeed: 8.6, gap: 46, sky: 0x8aa890, fog: [15, 170], amb: 0.7, sun: 0.35, marks: [0, -190, -325] });
  const g = L.group;
  const isles = [];
  // Four patches of tall reeds beside the walkway. Each grows on its own little island.
  for (const spot of [[-95, 8], [-165, -9], [-290, 9], [-370, -9]]) {
    const hide = { x: boardX(spot[0]) + spot[1], z: spot[0], r: 4.6, used: false };
    L.hides.push(hide);
    isles.push({ x: hide.x, z: hide.z, r: 9, h: 1.6 });
  }
  for (let n = 0; n < 16; n++) isles.push({ x: (dice() - 0.5) * 60, z: -20 - dice() * 430, r: 6 + dice() * 9, h: dice() < 0.4 ? -1.8 : 1.5 });
  // The mud under the water. Islands stick up; pools go deep.
  const mud = function (x, z) {
    let y = -0.85 + (bumps(x * 0.06, z * 0.06) - 0.5) * 1.2;
    for (const isle of isles) {
      const far = Math.hypot(x - isle.x, z - isle.z);
      if (far < isle.r) y += isle.h * smooth(1 - far / isle.r);
    }
    return y;
  };
  L.mud = mud;
  L.ground = function (x, z, forBug) {
    if (!forBug && boardGap(x, z) < 1.7) return 0.45;
    return Math.max(mud(x, z), forBug ? -0.5 : -1.05);
  };
  // You are quick on the boards, slow in the water, and very slow in the deep pools
  L.pace = function (x, z) {
    if (boardGap(x, z) < 1.7) return 1;
    const y = mud(x, z);
    return y > 0.1 ? 0.85 : y > -1.3 ? 0.55 : 0.36;
  };
  const shape = new THREE.PlaneGeometry(100, 560, 50, 220);
  shape.rotateX(-Math.PI / 2);
  shape.translate(0, 0, -220);
  const spots = shape.attributes.position;
  const colours = new Float32Array(spots.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < spots.count; i++) {
    const y = mud(spots.getX(i), spots.getZ(i));
    spots.setY(i, y);
    colour.setHex(y > 0.1 ? 0x4a7a3a : y > -1.3 ? 0x4a4a2a : 0x1a2a1a);
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  shape.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  shape.computeVertexNormals();
  g.add(new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ vertexColors: true })));
  const water = piece(g, new THREE.PlaneGeometry(400, 700), new THREE.MeshPhongMaterial({ color: 0x3f6f6a, transparent: true, opacity: 0.72, shininess: 120 }), 0, 0, -220);
  water.rotation.x = -Math.PI / 2;

  // The wooden walkway: planks laid along a zig-zag line
  const planks = [];
  for (let n = 0; n < BOARDS.length - 1; n++) {
    const a = BOARDS[n];
    const b = BOARDS[n + 1];
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d < long; d += 0.9) {
      planks.push({ x: a[0] + (b[0] - a[0]) * d / long, y: 0.36, z: a[1] + (b[1] - a[1]) * d / long, turn: Math.atan2(b[0] - a[0], b[1] - a[1]) + (dice() - 0.5) * 0.1, sx: 3.2, sy: 0.14, sz: 0.75 });
    }
  }
  sprinkle(g, new THREE.BoxGeometry(1, 1, 1), paint(0x9a7a4a), planks);
  // Swamp trees with hanging moss, reeds, and lily pads
  const trunks = [];
  const tops = [];
  while (trunks.length < 80) {
    const x = (dice() - 0.5) * 84;
    const z = 20 - dice() * 500;
    if (boardGap(x, z) < 4.5 || L.hides.some(function (h) { return Math.hypot(x - h.x, z - h.z) < 7; })) continue;
    const high = 9 + dice() * 9;
    trunks.push({ x: x, y: -1.5, z: z, sx: 0.7 + dice() * 0.6, sy: high + 1.5, turn: dice() * 6 });
    tops.push({ x: x, y: high, z: z, sx: 4 + dice() * 3, sy: 2.6, turn: dice() * 6, tint: dice() < 0.5 ? 0x3a5a2a : 0x4a6a3a });
    if (Math.abs(x) < 34) L.solids.push({ x: x, z: z, r: 1 });
  }
  const trunk = new THREE.CylinderGeometry(0.6, 1.3, 1, 7);
  trunk.translate(0, 0.5, 0);
  sprinkle(g, trunk, paint(0x4a3a2a), trunks);
  sprinkle(g, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), tops);
  const reed = new THREE.ConeGeometry(0.18, 1, 4);
  reed.translate(0, 0.5, 0);
  const reeds = [];
  for (const hide of L.hides) {
    for (let n = 0; n < 70; n++) {
      const a = dice() * 6.3;
      const far = Math.sqrt(dice()) * hide.r;
      reeds.push({ x: hide.x + Math.cos(a) * far, y: mud(hide.x, hide.z) - 0.3, z: hide.z + Math.sin(a) * far, sx: 1, sy: 3 + dice() * 1.6, tint: dice() < 0.5 ? 0xb8c85a : 0x8aa84a });
    }
  }
  sprinkle(g, reed, new THREE.MeshLambertMaterial({ color: 0xffffff }), reeds);
  const pad = new THREE.CircleGeometry(1, 9);
  pad.rotateX(-Math.PI / 2);
  sprinkle(g, pad, paint(0x5a9a4a), Array.from({ length: 90 }, function () { return { x: (dice() - 0.5) * 70, y: 0.03, z: 10 - dice() * 470, sx: 0.5 + dice() * 0.8, turn: dice() * 6 }; }));
  // Stone steps at the far end, up to the mountain path
  for (let n = 0; n < 5; n++) box(g, paint(0x8a8a90), 14 - n, 0.6, 3, 0, 0.3 + n * 0.5, -462 - n * 2.6);
  const way = makeSign("MOUNTAIN PATH", "#4a4a50", "#f0f0f0", 10);
  way.position.set(0, 6, -470);
  g.add(way);
  return L;
}

// ===== 3. The Mountains =====
// The path winds from side to side as it climbs
function trailX(z) {
  return Math.sin(z * 0.021) * 7;
}

function trailY(z) {
  const far = Math.max(0, -z);
  return 0.27 * far + 4 * Math.sin(far * 0.045);
}

// Cracks across the path that you must jump. (They are on the flattest bits of the climb.)
const CHASMS = [-208, -348];
const BRIDGE = { from: -412, to: -452 };

function buildMountains() {
  const L = newLevel({ id: "mountains", name: "The Mountains", length: 458, half: 17, bugSpeed: 8.6, gap: 46, sky: 0x9fd0f0, fog: [60, 420], amb: 0.75, sun: 0.7, marks: [0, -130, -216, -356], noExit: true });
  const g = L.group;
  const bridgeY = trailY(BRIDGE.from);
  L.ground = function (x, z, forBug) {
    if (z < BRIDGE.from && z > BRIDGE.to) return L.bridgeDown ? -60 : bridgeY;
    if (z <= BRIDGE.to) return bridgeY;
    // The stick bug's legs are so long that it just steps over the cracks
    if (!forBug) {
      for (const crack of CHASMS) {
        if (z < crack && z > crack - 3.4) return -60;
      }
    }
    return trailY(z);
  };
  // The path has a cliff wall on one side and a drop on the other: you can't leave it
  L.keepIn = function (who) {
    const mid = who.z < BRIDGE.from ? trailX(BRIDGE.from) : trailX(who.z);
    const wide = who.z < BRIDGE.from && who.z > BRIDGE.to ? 1.6 : 8.5;
    who.x = clamp(who.x, mid - wide, mid + wide);
  };
  const shape = new THREE.PlaneGeometry(120, 600, 60, 300);
  shape.rotateX(-Math.PI / 2);
  shape.translate(0, 0, -250);
  const spots = shape.attributes.position;
  const colours = new Float32Array(spots.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < spots.count; i++) {
    const x = spots.getX(i);
    const z = spots.getZ(i);
    const off = x - (z < BRIDGE.from ? trailX(BRIDGE.from) : trailX(z));
    let y = z < BRIDGE.to ? bridgeY : trailY(z);
    let rock = false;
    if (off < -9) {
      y += smooth((-off - 9) / 8) * (30 + bumps(x * 0.1, z * 0.1) * 20);   // the cliff wall
      rock = true;
    } else if (off > 9) {
      y -= smooth((off - 9) / 6) * 45;                                       // the drop
      rock = true;
    }
    for (const crack of CHASMS) {
      if (z < crack + 0.5 && z > crack - 3.9) y -= 45;
    }
    if (z < BRIDGE.from - 1 && z > BRIDGE.to + 1) y = bridgeY - 70;           // the canyon under the bridge
    spots.setY(i, y);
    colour.setHex(y > 95 ? 0xf4f8ff : rock ? 0x6a6a72 : y > 70 ? 0xd8e0e8 : 0x8a8a6a);
    const shade = 0.85 + bumps(x * 0.3, z * 0.3) * 0.3;
    colours[i * 3] = colour.r * shade;
    colours[i * 3 + 1] = colour.g * shade;
    colours[i * 3 + 2] = colour.b * shade;
  }
  shape.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  shape.computeVertexNormals();
  g.add(new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Rocks to dodge, and little pine trees
  const rocks = [];
  for (let z = -20; z > -400; z -= 13 + dice() * 10) {
    if (CHASMS.some(function (c) { return Math.abs(z - c) < 9; })) continue;
    const x = trailX(z) + (dice() - 0.5) * 13;
    const wide = 1 + dice() * 1.2;
    rocks.push({ x: x, y: trailY(z) + wide * 0.4, z: z, sx: wide, sy: wide * 0.9, turn: dice() * 6, tilt: dice() });
    L.solids.push({ x: x, z: z, r: wide * 0.85 });
  }
  sprinkle(g, new THREE.DodecahedronGeometry(1, 0), paint(0x7a7a84), rocks);
  // Warning posts on each side of the cracks
  for (const crack of CHASMS) {
    for (const side of [-1, 1]) box(g, paint(0xffb02a), 0.3, 2, 0.3, trailX(crack) + side * 8, trailY(crack + 1.5) + 1, crack + 1.5);
  }

  // Big round boulders you can shove down the hill
  for (const z of [-95, -235, -365]) {
    const mesh = piece(g, new THREE.IcosahedronGeometry(1.9, 1), paint(0x8a8078), trailX(z), trailY(z) + 1.8, z);
    L.boulders.push({ x: trailX(z), z: z, mesh: mesh, state: "ready", spin: 0 });
    L.solids.push({ x: trailX(z), z: z, r: 2, boulder: L.boulders.length - 1 });
  }
  // Two caves in the cliff (safe), and one rickety old hut (not safe)
  for (const spot of [[-120, true], [-178, false], [-330, true]]) {
    const z = spot[0];
    const x = trailX(z) - 8.6;
    const y = trailY(z);
    let home;
    let rubble = null;
    if (spot[1]) {
      home = ball(g, paint(0x16161a), 3, 3.4, 3, x - 1.6, y + 1, z);
    } else {
      home = new THREE.Group();
      home.position.set(x - 2, y, z);
      box(home, paint(0x8a6238), 5, 3.4, 5, 0, 1.7, 0);
      piece(home, new THREE.ConeGeometry(4.2, 1.8, 4), paint(0x5a3a22), 0, 4.3, 0).rotation.y = Math.PI / 4;
      g.add(home);
      rubble = makeRubble(0x8a6238);
      rubble.scale.setScalar(0.6);
      rubble.position.set(x - 2, y, z);
      g.add(rubble);
    }
    addDoor(L, x + 0.6, y, z, -1, spot[1] ? "a cave" : "a rickety old hut", spot[1] ? "solid rock all round" : "rotten old planks", spot[1], home, rubble);
  }

  // The rope bridge over the canyon at the top
  const bx = trailX(BRIDGE.from);
  L.bridge = new THREE.Group();
  for (let z = BRIDGE.from; z >= BRIDGE.to; z -= 1) box(L.bridge, paint(0x9a7a4a), 3.4, 0.16, 0.8, bx, bridgeY - 0.05, z);
  for (const side of [-1, 1]) {
    box(L.bridge, paint(0xc8b890), 0.1, 0.1, 40, bx + side * 1.7, bridgeY + 1.1, (BRIDGE.from + BRIDGE.to) / 2);
    for (const z of [BRIDGE.from + 1, BRIDGE.to - 1]) box(g, paint(0x5a3a22), 0.4, 2.6, 0.4, bx + side * 1.9, bridgeY + 1.3, z);
  }
  g.add(L.bridge);
  L.rope = { x: bx + 1.9, z: BRIDGE.to - 1 };
  const way = makeSign("REDWOOD FOREST", "#2a4a2a", "#e8f0c0", 8);
  way.position.set(bx, bridgeY + 5, BRIDGE.to - 14);
  g.add(way);
  return L;
}

// ===== 4. The Alaskan Redwood Forest =====
const LAB = { x: 0, z: -356, r: 46 };

function buildForest() {
  const L = newLevel({ id: "forest", name: "The Alaskan Redwood Forest", length: 300, half: 38, bugSpeed: 8.8, gap: 46, sky: 0x0e1e30, fog: [40, 260], amb: 0.62, sun: 0.3, marks: [0, -150, -296], noExit: true });
  const g = L.group;
  L.ground = function (x, z) {
    return (bumps(x * 0.04 + 5, z * 0.04) - 0.5) * 2.4;
  };
  // The trodden trail is quick. Deep snow off the trail is slow going.
  L.pace = function (x, z) {
    return Math.abs(x) < 5 || Math.hypot(x - LAB.x, z - LAB.z) < LAB.r + 6 ? 1 : 0.72;
  };
  L.keepIn = function (who) {
    // Once the fight has started, nobody leaves the clearing
    if (!L.boss.on) return;
    const dx = who.x - LAB.x;
    const dz = who.z - LAB.z;
    const far = Math.hypot(dx, dz);
    if (far > LAB.r - 1) {
      who.x = LAB.x + dx / far * (LAB.r - 1);
      who.z = LAB.z + dz / far * (LAB.r - 1);
    }
  };
  const shape = new THREE.PlaneGeometry(260, 560, 60, 130);
  shape.rotateX(-Math.PI / 2);
  shape.translate(0, 0, -210);
  const spots = shape.attributes.position;
  const colours = new Float32Array(spots.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < spots.count; i++) {
    const x = spots.getX(i);
    const z = spots.getZ(i);
    spots.setY(i, L.ground(x, z));
    const trail = Math.abs(x) < 5 && z > LAB.z + LAB.r;
    const yard = Math.hypot(x - LAB.x, z - LAB.z) < LAB.r;
    colour.setHex(trail ? 0x7a6a5a : yard ? 0x8a9aa8 : 0xe0ecf4);
    const shade = 0.85 + bumps(x * 0.2, z * 0.2) * 0.3;
    colours[i * 3] = colour.r * shade;
    colours[i * 3 + 1] = colour.g * shade;
    colours[i * 3 + 2] = colour.b * shade;
  }
  shape.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  shape.computeVertexNormals();
  g.add(new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Giant redwoods: trunks as wide as a room, far too tall to see the top
  const trunks = [];
  const tops = [];
  let tries = 0;
  while (trunks.length < 120 && tries++ < 3000) {
    const x = (dice() - 0.5) * 220;
    const z = 40 - dice() * 500;
    const wide = 2 + dice() * 1.6;
    if (Math.abs(x) < 7 + wide && z > LAB.z + LAB.r) continue;
    if (Math.hypot(x - LAB.x, z - LAB.z) < LAB.r + wide + 2) continue;
    if (L.solids.some(function (s) { return Math.hypot(x - s.x, z - s.z) < s.r + wide + 5; })) continue;
    const high = 55 + dice() * 35;
    trunks.push({ x: x, y: -2, z: z, sx: wide, sy: high, sz: wide, turn: dice() * 6 });
    tops.push({ x: x, y: high * 0.72, z: z, sx: wide * 5, sy: high * 0.5, turn: dice() * 6 });
    L.solids.push({ x: x, z: z, r: wide, big: true });
  }
  const trunk = new THREE.CylinderGeometry(0.75, 1.1, 1, 9);
  trunk.translate(0, 0.5, 0);
  sprinkle(g, trunk, paint(0x8a4a32), trunks);
  sprinkle(g, new THREE.ConeGeometry(1, 1, 8), paint(0x1f4a3a), tops);

  // The northern lights, rippling across the sky
  L.lights = [];
  for (let n = 0; n < 4; n++) {
    const sheet = piece(g, new THREE.PlaneGeometry(700, 120, 1, 1), new THREE.MeshBasicMaterial({ color: [0x4aff9a, 0x7a6aff, 0x4affd8, 0xb86aff][n], transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), -100 + n * 70, 230 + n * 20, -600 - n * 40);
    sheet.rotation.set(0.5, (n - 1.5) * 0.25, 0);
    L.lights.push(sheet);
  }

  // Two hollow fallen logs (safe) and a ranger's cabin (not safe)
  for (const spot of [[-90, 1, true], [-170, -1, false], [-245, 1, true]]) {
    const z = spot[0];
    const side = spot[1];
    const x = side * 12;
    const y = L.ground(x, z);
    let home;
    let rubble = null;
    if (spot[2]) {
      home = piece(g, new THREE.CylinderGeometry(2.6, 2.6, 14, 10, 1, true), new THREE.MeshPhongMaterial({ color: 0x7a4228, side: THREE.DoubleSide, flatShading: true }), x + side * 7, y + 2.2, z);
      home.rotation.z = Math.PI / 2;
      L.solids.push({ x0: x + side * 7 - 7, x1: x + side * 7 + 7, z0: z - 2.4, z1: z + 2.4 });
    } else {
      home = new THREE.Group();
      home.position.set(x + side * 4, y, z);
      box(home, paint(0x9a6a3a), 7, 4, 7, 0, 2, 0);
      piece(home, new THREE.ConeGeometry(6, 2.4, 4), paint(0xe8f0f8), 0, 5.2, 0).rotation.y = Math.PI / 4;
      box(home, bright(0xffe9a0), 1.4, 1.2, 0.1, 1.5, 2.4, 3.55);
      g.add(home);
      rubble = makeRubble(0x9a6a3a);
      rubble.scale.setScalar(0.75);
      rubble.position.set(x + side * 4, y, z);
      g.add(rubble);
      L.solids.push({ x0: x + side * 4 - 3.5, x1: x + side * 4 + 3.5, z0: z - 3.5, z1: z + 3.5, hut: true });
    }
    addDoor(L, x + side * 0.2, y, z, side, spot[2] ? "a hollow redwood log" : "the ranger's cabin", spot[2] ? "wood as thick as a wall" : "a thin wooden cabin", spot[2], home, rubble);
  }
  const warn = makeSign("KEEP OUT! DR TWIGG", "#f4e23a", "#1a1a1a", 9);
  warn.position.set(7, 3.2, -292);
  warn.rotation.y = -0.3;
  g.add(warn);
  box(g, paint(0x5a3a22), 0.3, 3.6, 0.3, 7, 1.6, -292);

  // ----- Doctor Twigg's secret lab, in a clearing -----
  const ly = L.ground(LAB.x, LAB.z);
  // The Ra-Ra Ray machine
  const machine = new THREE.Group();
  machine.position.set(LAB.x, ly, LAB.z);
  piece(machine, new THREE.CylinderGeometry(4, 5, 3, 12), paint(0x5a6a78), 0, 1.5, 0);
  piece(machine, new THREE.CylinderGeometry(1.2, 2, 9, 10), paint(0x8a9aa8), 0, 7.5, 0);
  const dish = piece(machine, new THREE.SphereGeometry(4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshPhongMaterial({ color: 0xd8e0e8, side: THREE.DoubleSide, flatShading: true }), 0, 16, 0);
  dish.rotation.x = Math.PI;
  L.orb = piece(machine, ballShape, bright(0x7dff3a), 0, 13.5, 0);
  L.orb.scale.setScalar(1.5);
  L.orbGlow = glow(0x7dff3a, 26);
  L.orbGlow.position.y = 13.5;
  machine.add(L.orbGlow);
  for (let n = 0; n < 6; n++) piece(machine, new THREE.CylinderGeometry(0.25, 0.25, 6, 5), paint(0xffb02a), Math.cos(n) * 3.4, 4.5, Math.sin(n) * 3.4).rotation.z = 0.3;
  g.add(machine);
  L.solids.push({ x: LAB.x, z: LAB.z, r: 5.4, big: true });
  // The beam that fires at the end
  L.beam = piece(g, new THREE.CylinderGeometry(0.7, 0.7, 1, 8), new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.8, fog: false }), 0, 0, 0);
  L.beam.visible = false;
  // Doctor Twigg, on a platform beside the machine
  L.twigg = makePerson(0xf4f4f4, 0x3a3a44, 0x7dff3a);
  box(L.twigg.group, paint(0x2a2a30), 0.6, 0.16, 0.2, 0, 2, -0.24);            // goggles
  for (const s of [-1, 1]) ball(L.twigg.group, paint(0x7dff3a), 0.2, 0.3, 0.2, s * 0.3, 2.3, 0);   // wild hair
  L.twiggAt = { x: LAB.x + 10, y: ly + 3, z: LAB.z + 2 };
  L.twigg.group.position.set(L.twiggAt.x, L.twiggAt.y, L.twiggAt.z);
  L.twigg.group.scale.setScalar(1.25);
  g.add(L.twigg.group);
  piece(g, new THREE.CylinderGeometry(2.4, 2.8, 3, 10), paint(0x5a6a78), L.twiggAt.x, ly + 1.5, L.twiggAt.z);
  L.solids.push({ x: L.twiggAt.x, z: L.twiggAt.z, r: 3 });
  // Three power levers round the edge of the clearing
  for (const a of [Math.PI * 1.5, Math.PI * 0.17, Math.PI * 0.83]) {
    const x = LAB.x + Math.cos(a) * 37;
    const z = LAB.z + Math.sin(a) * 37;
    const post = new THREE.Group();
    post.position.set(x, L.ground(x, z), z);
    box(post, paint(0x5a6a78), 1.4, 2.4, 1.4, 0, 1.2, 0);
    const handle = new THREE.Group();
    handle.position.set(0, 2.2, 0);
    box(handle, paint(0xd8442e), 0.2, 1.6, 0.2, 0, 0.8, 0);
    ball(handle, paint(0xd8442e), 0.3, 0.3, 0.3, 0, 1.7, 0);
    handle.rotation.x = -0.7;
    post.add(handle);
    const lamp = piece(post, ballShape, bright(0xff3a2a), 0, 3, 0.9);
    lamp.scale.setScalar(0.3);
    const shine = glow(0xff3a2a, 7);
    shine.position.set(0, 3, 0.9);
    post.add(shine);
    g.add(post);
    L.levers.push({ x: x, z: z, handle: handle, lamp: lamp, shine: shine, pulled: false });
    L.solids.push({ x: x, z: z, r: 1.1 });
  }
  L.boss = { on: false, pulled: 0, nextShot: 0, blobs: [], done: false };
  return L;
}

const BUILDERS = { home: buildHome, city: buildCity, swamp: buildSwamp, mountains: buildMountains, forest: buildForest };
const ORDER = ["home", "city", "swamp", "mountains", "forest"];
