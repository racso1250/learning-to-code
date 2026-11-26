// Ra Ra Escape: the stick bug.
// What it looks like, how its six long legs walk, and how it hunts you.

const bug = {
  x: 0, y: 0, z: 0, yaw: 0,
  size: 1,           // 1 = giant. It starts tiny, and (with luck) ends tiny too.
  mood: "chase",     // chase, bang (on a door), smash, lost, retreat, stun or still
  until: 0,          // when its mood changes next
  backTo: 0,         // where it walks back to when it gives up
  stride: 0,         // how far along its walking pattern it is
  moving: 0,
  group: new THREE.Group(),
  legs: [],
  shout: makeShout("RA RA!", "#b8ff5a"),
};

const BUG_HIGH = 4.6;   // how high it holds its body off the ground
const BUG_LONG = 6;     // from its middle to the tip of its head

(function () {
  const g = bug.group;
  g.rotation.order = "YXZ";
  const bark = paint(0x7a6a3a, 0x0a0a02);
  const dark = paint(0x4a3f22, 0x050502);
  // A long thin body, like a walking twig, made of segments
  const along = function (from, to, thick, material) {
    const rod = piece(g, new THREE.CylinderGeometry(thick, thick * 1.1, to - from, 7), material, 0, BUG_HIGH, (from + to) / 2);
    rod.rotation.x = Math.PI / 2;
  };
  along(-5, -2.6, 0.3, bark);
  along(-2.6, 1, 0.42, dark);
  along(1, 4.4, 0.36, bark);
  along(4.4, 7.4, 0.24, dark);
  for (const z of [-2.6, 1, 4.4]) ball(g, dark, 0.5, 0.5, 0.4, 0, BUG_HIGH, z);
  // The head, with glowing eyes and two long feelers
  ball(g, bark, 0.5, 0.45, 0.75, 0, BUG_HIGH + 0.1, -5.6);
  bug.feelers = [];
  for (const side of [-1, 1]) {
    piece(g, ballShape, bright(0xff3a2a), side * 0.38, BUG_HIGH + 0.3, -6).scale.setScalar(0.17);
    const feeler = new THREE.Group();
    feeler.position.set(side * 0.2, BUG_HIGH + 0.4, -6.1);
    const rod = piece(feeler, new THREE.CylinderGeometry(0.03, 0.07, 4.5, 4), dark, 0, 0, -2.2);
    rod.rotation.x = Math.PI / 2;
    feeler.rotation.set(0.35, side * -0.25, 0);
    g.add(feeler);
    bug.feelers.push(feeler);
    // Little jaws
    piece(g, new THREE.ConeGeometry(0.1, 0.6, 4), dark, side * 0.2, BUG_HIGH - 0.2, -6.4).rotation.x = -Math.PI / 2;
  }
  // Six legs. Each one is two thin rods: body to knee, and knee to foot.
  const rodShape = new THREE.CylinderGeometry(0.11, 0.11, 1, 5);
  let n = 0;
  for (const z of [-3.6, -0.6, 2.6]) {
    for (const side of [-1, 1]) {
      const leg = { side: side, z: z, upper: new THREE.Mesh(rodShape, bark), lower: new THREE.Mesh(rodShape, dark), turn: (n % 2 === 0) === (side > 0) ? 0 : Math.PI };
      g.add(leg.upper, leg.lower);
      bug.legs.push(leg);
    }
    n++;
  }
  scene.add(g);
  scene.add(bug.shout);
})();

const hipSpot = new THREE.Vector3();
const kneeSpot = new THREE.Vector3();
const footSpot = new THREE.Vector3();

// Put the model where the bug is, and move its legs
function poseBug(t) {
  const g = bug.group;
  g.scale.setScalar(bug.size);
  const shiver = bug.mood === "stun" ? Math.sin(t * 40) * 0.05 : 0;
  const bash = bug.mood === "bang" || bug.mood === "smash" ? Math.max(0, Math.sin(t * 9)) * 0.9 : 0;
  g.position.set(bug.x - Math.sin(bug.yaw) * bash, bug.y, bug.z - Math.cos(bug.yaw) * bash);
  g.rotation.set(bug.mood === "stun" ? 0.12 : 0, bug.yaw, shiver);
  for (const leg of bug.legs) {
    // Each foot swings forward through the air, then pushes back along the ground
    const step = bug.stride * 0.55 + leg.turn;
    const reach = bug.moving ? Math.sin(step) * 2.1 : 0;
    const lift = bug.moving ? Math.max(0, Math.cos(step)) * 1.5 : 0;
    hipSpot.set(leg.side * 0.3, BUG_HIGH, leg.z);
    kneeSpot.set(leg.side * 3.3, BUG_HIGH + 2.3, leg.z - reach * 0.4);
    footSpot.set(leg.side * 4.8, lift, leg.z - reach);
    stretch(leg.upper, hipSpot, kneeSpot);
    stretch(leg.lower, kneeSpot, footSpot);
  }
  bug.feelers.forEach(function (feeler, n) {
    feeler.rotation.x = 0.35 + Math.sin(t * (bug.mood === "lost" ? 9 : 3) + n) * 0.2;
  });
  // "RA RA!" floats over its head while it hunts
  const loud = bug.size > 0.5 && (bug.mood === "chase" || bug.mood === "bang" || bug.mood === "smash");
  bug.shout.visible = loud && Math.sin(t * 5) > -0.3;
  bug.shout.position.set(bug.x, bug.y + (BUG_HIGH + 4.5) * bug.size, bug.z);
  bug.shout.scale.set(9 + Math.sin(t * 10), 3.4, 1);
}

// Walk towards a spot. Gives back how far away it still is.
function bugWalk(x, z, speed, dt) {
  const dx = x - bug.x;
  const dz = z - bug.z;
  const far = Math.hypot(dx, dz);
  if (far < 0.05) return far;
  let turn = Math.atan2(-dx, -dz) - bug.yaw;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  bug.yaw += clamp(turn, -3.5 * dt, 3.5 * dt);
  const step = Math.min(far, speed * dt);
  bug.x += dx / far * step;
  bug.z += dz / far * step;
  bug.stride += step;
  bug.moving = speed;
  // It has to go round the really big things, like giant trees
  for (const s of level.solids) {
    if (!s.big) continue;
    const ox = bug.x - s.x;
    const oz = bug.z - s.z;
    const gap = Math.hypot(ox, oz);
    if (gap < s.r + 2 && gap > 0.01) {
      bug.x = s.x + ox / gap * (s.r + 2);
      bug.z = s.z + oz / gap * (s.r + 2);
    }
  }
  return far - step;
}

// How far behind you is it? (Measured from its head.)
function bugGap() {
  return Math.max(0, Math.hypot(bug.x - me.x, bug.z - me.z) - BUG_LONG * bug.size);
}

// One step of the bug's thinking
function updateBug(dt) {
  bug.moving = 0;
  if (!bug.dropping) bug.y = level.ground(bug.x, bug.z, true);
  if (bug.size < 0.5 || bug.mood === "still") return;
  const gap = bugGap();
  // It hurries when you get a long way ahead, so it is never far behind for long
  // (In the lab at the end it is a little slower, so you have time to pull the levers.)
  const speed = level.boss && level.boss.on ? 7.4 : level.bugSpeed * (gap > 90 ? 1.8 : gap > 65 ? 1.2 : 1);

  if (bug.mood === "stun") {
    if (clock > bug.until) bug.mood = "chase";
  } else if (bug.mood === "retreat") {
    // It has given up (for now) and stalks away
    if (bugWalk(bug.x * 0.9, bug.backTo, 9, dt) < 2 || clock > bug.until) bug.mood = "chase";
  } else if (bug.mood === "lost") {
    // It can't see you: it stands and waves its feelers about, then wanders off
    if (clock > bug.until) {
      bug.mood = "retreat";
      bug.backTo = bug.z + 45;
      bug.until = clock + 7;
      hidWell();
    }
  } else if (bug.mood === "bang" || bug.mood === "smash") {
    shake = Math.max(shake, 0.25);
    if (clock > bug.until) doorHeld();
  } else if (me.inside) {
    // You are in a building: it comes to the door and starts bashing
    if (bugWalk(me.inside.x * 0.75, me.inside.z, speed, dt) < 3) {
      bug.mood = "bang";
      bug.until = clock + (me.inside.safe ? 4.5 : 2.6);
      soundRoar();
    }
  } else if (me.hidden) {
    bug.mood = "lost";
    bug.until = clock + 3;
  } else {
    bugWalk(me.x, me.z, speed, dt);
    if (gap < 1.2 && Math.abs(me.y - bug.y) < 9) caught("The stick bug got you!");
  }
  bug.x = clamp(bug.x, -level.half - 4, level.half + 4);
}
