// Fossil Bay: Lights Out. The park, already built.
// This file lays out the whole park (paths, shops, paddocks with smashed fences, the monorail)
// and adds the special places of this story: the resort, the visitor centre, the bridges,
// the fuel store and the helipad.

// How tall and how long each kind of dinosaur is when fully grown (in metres)
const SHAPES = {
  para: { tall: 5.4, long: 7 }, tri: { tall: 4, long: 7 }, steg: { tall: 4.6, long: 8 },
  raptor: { tall: 2.9, long: 3.5 }, brach: { tall: 15, long: 16 }, rex: { tall: 6.8, long: 11 },
  anky: { tall: 2.9, long: 7 }, dilo: { tall: 4.7, long: 6.5 }, carno: { tall: 5.5, long: 9 }, spino: { tall: 9.2, long: 15 },
  proto: { tall: 2, long: 3.5 }, styra: { tall: 3.8, long: 6.5 }, pachyr: { tall: 4, long: 7 },
  igua: { tall: 5.4, long: 8 }, troo: { tall: 2.3, long: 2.8 }, cryo: { tall: 5.9, long: 8 },
  bary: { tall: 5, long: 10.8 }, diplo: { tall: 9, long: 15 }, yuty: { tall: 6.2, long: 10 },
  mosa: { tall: 3.2, long: 14 }, plesio: { tall: 4.6, long: 8 }, ptera: { tall: 2.2, long: 3 },
};

// The park, written down the same way Fossil Bay 2 saves a park you have built
const state = {
  tiles: {}, pads: [], stations: [], labs: {}, tech: {}, dinos: [], nextId: 1,
  staff: { keeper: 0, ranger: 0, scientist: 0, guide: 0 }, jeep: { x: 0, z: 0, yaw: 0 },
};

// Lay a straight line of something from one square to another
function lay(type, i0, k0, i1, k1) {
  for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) {
    for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) state.tiles[i + "," + k] = type;
  }
}

// A paddock whose fence has been smashed. "gap" is the square of fence that is broken.
function pen(i0, k0, i1, k1, kind, gapI, gapK) {
  state.pads.push({
    id: state.nextId++, i0: i0, k0: k0, i1: i1, k1: k1, kind: kind || "land", fence: "electric", hp: 0,
    breach: gapI === undefined ? null : { x: gapI * TILE - HALF, z: gapK * TILE - HALF },
  });
}

(function () {
  // ----- Jungle Valley (bottom left): the gate, the resort and the main street -----
  lay("path", 19, 79, 19, 17);          // the main path, north from the gate, over the river into the desert
  lay("path", 7, 74, 19, 74);           // the resort path
  lay("path", 19, 60, 62, 60);          // east, over the river into the swamp
  lay("path", 19, 50, 22, 50);
  lay("deck", 23, 50, 23, 50);
  lay("deck", 16, 48, 16, 48);
  lay("path", 17, 48, 18, 48);
  lay("snack", 18, 70, 18, 70);
  lay("gift", 20, 70, 20, 70);
  lay("diner", 18, 56, 18, 56);
  lay("fountain", 17, 65, 17, 65);
  lay("statue", 21, 62, 21, 62);
  for (const k of [77, 72, 68, 63, 58, 53, 46]) lay("lamp", 18, k, 18, k);
  for (const k of [76, 67, 54]) lay("flowers", 20, k, 20, k);
  for (const k of [71, 64]) lay("bench", 20, k, 20, k);
  pen(5, 44, 15, 56, "land", 16, 51);        // the Triceratops paddock
  pen(24, 43, 36, 55, "land", 30, 56);       // the T. rex paddock
  lay("plants", 6, 45, 6, 45);
  lay("meat", 25, 44, 25, 44);

  // ----- Red Desert (top left): the raptor paddock, where the rangers left their car -----
  lay("path", 19, 32, 30, 32);
  lay("lab", 21, 34, 21, 34);
  lay("deck", 23, 22, 23, 22);
  pen(24, 20, 34, 30, "land", 24, 26);       // the raptor paddock
  pen(4, 18, 14, 30, "land", 15, 24);
  lay("meat", 25, 21, 25, 21);
  lay("plants", 5, 19, 5, 19);
  lay("path", 19, 17, 48, 17);               // the top path, over the river to the snow
  lay("snack", 20, 22, 20, 22);

  // ----- Misty Swamp (bottom right): the lagoon, the aviary and the fuel store -----
  pen(44, 63, 56, 75, "water");
  pen(60, 44, 70, 56, "air", 65, 57);
  lay("fish", 45, 64, 45, 64);
  lay("deck", 50, 62, 50, 62);
  lay("path", 50, 61, 50, 61);
  lay("path", 58, 60, 58, 17);               // north, over the river to the snow
  lay("gift", 61, 64, 61, 64);
  lay("path", 63, 60, 66, 60);

  // ----- Frost Plateau (top right): the helipad -----
  lay("path", 48, 17, 62, 17);
  lay("path", 62, 17, 62, 14);
  pen(44, 24, 54, 34, "land", 55, 29);
  pen(66, 20, 76, 32, "land", 66, 26);
  lay("plants", 45, 25, 45, 25);
  lay("meat", 67, 21, 67, 21);
  lay("lab", 60, 16, 60, 16);

  // The monorail (the power is off, so the train is stuck)
  for (const stop of [[21, 59], [46, 59], [46, 36], [30, 36]]) {
    state.tiles[stop[0] + "," + stop[1]] = "station";
    state.stations.push(stop[0] + "," + stop[1]);
  }
})();

// ----- The special places -----
const blocks = [];    // solid boxes you can't walk through: { x0, x1, z0, z1 }
const hides = [];     // places you can hide inside: { x, z, name }
const extras = new THREE.Group();
scene.add(extras);

// A solid box that fills a block of squares
function wallOff(i0, k0, i1, k1) {
  blocks.push({ x0: i0 * TILE - HALF + 0.3, x1: (i1 + 1) * TILE - HALF - 0.3, z0: k0 * TILE - HALF + 0.3, z1: (k1 + 1) * TILE - HALF - 0.3 });
}

function makeCabin(i, k, mine) {
  const g = new THREE.Group();
  g.position.set(mid(i), 0, mid(k));
  piece(g, new THREE.BoxGeometry(3.6, 2.6, 3.6), paint(0xc8a878), 0, 1.3, 0);
  piece(g, new THREE.ConeGeometry(3.3, 1.8, 4), paint(mine ? 0xd8442e : 0x3a8a5a), 0, 3.5, 0).rotation.y = Math.PI / 4;
  piece(g, new THREE.BoxGeometry(0.9, 1.8, 0.1), paint(0x5a3a22), 0, 0.9, 1.82);
  piece(g, new THREE.BoxGeometry(0.8, 0.7, 0.1), bright(0xbfe8ff), 1.1, 1.6, 1.82);
  extras.add(shade(g));
  wallOff(i, k, i, k);
  hides.push({ x: mid(i), z: mid(k) + 2.4, out: Math.PI, name: mine ? "your cabin" : "a holiday cabin" });
}

const PLACES = {
  cabin: { i: 9, k: 73 },        // where you wake up
  centre: { i: 22, k: 65 },      // the visitor centre
  car: { i: 21, k: 31 },         // where the rangers left their car
  depot: { i: 67, k: 61 },       // the fuel store
  pad: { i: 65, k: 12 },         // the helipad
};

(function () {
  // The resort: six little cabins. Yours has the red roof.
  for (const i of [7, 10, 13]) {
    makeCabin(i, 73, i === 10);
    makeCabin(i, 75, false);
  }
  // The visitor centre: a big hall with a round roof
  const hall = new THREE.Group();
  hall.position.set(mid(22), 0, mid(65));
  piece(hall, new THREE.BoxGeometry(11, 5, 11), paint(0xe8dcc0), 0, 2.5, 0);
  piece(hall, new THREE.SphereGeometry(6.4, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), paint(0x3a8a5a), 0, 5, 0);
  piece(hall, new THREE.BoxGeometry(0.2, 3, 3), new THREE.MeshPhongMaterial({ color: 0x6ac8e8, shininess: 100 }), -5.6, 1.6, 0);
  for (const z of [-3.6, 3.6]) piece(hall, new THREE.CylinderGeometry(0.4, 0.4, 5, 8), paint(0x9a6a3a), -5.9, 2.5, z);
  extras.add(shade(hall));
  wallOff(21, 64, 23, 66);
  hides.push({ x: mid(21) - 2.6, z: mid(65), out: Math.PI / 2, name: "the visitor centre" });

  // The fuel store: a locked shed with red drums outside
  const shed = new THREE.Group();
  shed.position.set(mid(67), 0, mid(61));
  piece(shed, new THREE.BoxGeometry(7, 3.4, 5), paint(0x8a9aa8), 0, 1.7, 0);
  piece(shed, new THREE.BoxGeometry(7.4, 0.3, 5.4), paint(0xd8442e), 0, 3.5, 0);
  piece(shed, new THREE.BoxGeometry(1.4, 2.2, 0.1), paint(0x2a2a30), -1, 1.1, -2.55);
  for (const x of [1.6, 2.6]) piece(shed, new THREE.CylinderGeometry(0.4, 0.4, 1.1, 8), paint(0xd8442e), x, 0.55, -3.1);
  extras.add(shade(shed));
  wallOff(66, 61, 68, 61);
  hides.push({ x: mid(67) - 1, z: mid(61) - 4, out: 0, name: "the fuel store", locked: true });

  // The helipad: a round pad with a big H, and a little hut beside it
  const padSpot = new THREE.Group();
  padSpot.position.set(mid(65), 0, mid(12));
  piece(padSpot, new THREE.CylinderGeometry(9, 9, 0.3, 24), paint(0x5a6a78), 0, 0.15, 0).receiveShadow = true;
  const ring = piece(padSpot, new THREE.TorusGeometry(7.6, 0.25, 4, 30), bright(0xffe14a), 0, 0.33, 0);
  ring.rotation.x = Math.PI / 2;
  for (const x of [-2, 2]) piece(padSpot, new THREE.BoxGeometry(0.8, 0.06, 6), bright(0xffffff), x, 0.33, 0);
  piece(padSpot, new THREE.BoxGeometry(4, 0.06, 0.8), bright(0xffffff), 0, 0.33, 0);
  extras.add(padSpot);
  const hut = new THREE.Group();
  hut.position.set(mid(61), 0, mid(12));
  piece(hut, new THREE.BoxGeometry(3.6, 2.8, 3.6), paint(0xf4f6f8), 0, 1.4, 0);
  piece(hut, new THREE.BoxGeometry(4, 0.3, 4), paint(0xd8442e), 0, 2.95, 0);
  piece(hut, new THREE.CylinderGeometry(0.06, 0.06, 3, 5), paint(0x2a2a30), 1.2, 4.4, 1.2);
  extras.add(shade(hut));
  wallOff(61, 12, 61, 12);
  hides.push({ x: mid(61), z: mid(12) + 2.5, out: Math.PI, name: "the helipad hut" });
  // The switch box for the landing lights
  piece(extras, new THREE.BoxGeometry(0.8, 1.4, 0.5), paint(0xffb02a), mid(63) - 1, 0.7, mid(14));

  // The four wooden bridges over the rivers
  const plank = paint(0x9a7a4a);
  for (const b of [[19, 39, true], [39, 60, false], [58, 39, true], [39, 17, false]]) {
    const upDown = b[2];
    const x = upDown ? mid(b[0]) : 0;
    const z = upDown ? 0 : mid(b[1]);
    piece(extras, new THREE.BoxGeometry(upDown ? TILE : TILE * 2 + 2, 0.5, upDown ? TILE * 2 + 2 : TILE), plank, x, 0.1, z).receiveShadow = true;
    for (const s of [-1, 1]) {
      piece(extras, new THREE.BoxGeometry(upDown ? 0.2 : TILE * 2 + 2, 0.2, upDown ? TILE * 2 + 2 : 0.2), plank, x + (upDown ? s * 1.9 : 0), 1.2, z + (upDown ? 0 : s * 1.9));
      for (const t of [-4, 0, 4]) piece(extras, new THREE.BoxGeometry(0.2, 1.3, 0.2), plank, x + (upDown ? s * 1.9 : t), 0.65, z + (upDown ? t : s * 1.9));
    }
    // Bridges count as path, so you (and the car) can cross the river on them
    if (upDown) lay("path", b[0], 39, b[0], 40);
    else lay("path", 39, b[1], 40, b[1]);
  }
})();

// Hiding places in ordinary buildings too, and which squares are solid
(function () {
  for (const key in state.tiles) {
    const type = state.tiles[key];
    const n = key.split(",").map(Number);
    if (type === "lab" || type === "gift" || type === "diner") hides.push({ x: mid(n[0]), z: mid(n[1]) + 2.6, out: Math.PI, name: type === "lab" ? "a research lab" : type === "gift" ? "a gift shop" : "the restaurant" });
    if (type !== "path" && type !== "flowers" && type !== "bench" && type !== "lamp") wallOff(n[0], n[1], n[0], n[1]);
  }
})();
