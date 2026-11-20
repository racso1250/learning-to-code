// Deepwild: the game.
// You live in a little floating pod in the middle of the sea. Dive down to explore: watch your air, pick up useful things,
// climb back into the pod to make better gear, scan the creatures you meet, and find the four Tide Tablets
// that open the Great Shell at the very bottom of the Trench. The sea itself is described in world.js.

const el = (id) => document.getElementById(id);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const mix = (a, b, t) => a + (b - a) * t;
const TEST = location.search.includes("test");       // (only for testing the game)
const canvas = el("game");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x2aa8c8, 0.02);
const camera = new THREE.PerspectiveCamera(72, 1.5, 0.15, 700);
camera.rotation.order = "YXZ";
scene.add(camera);
function resize() {
  const w = canvas.clientWidth || 960;
  renderer.setSize(w, Math.round(w / 1.5), false);
}
window.addEventListener("resize", resize);
resize();

// ----- Sounds -----
let soundOn = true;
function sound(make) {
  try { if (soundOn) make(); } catch (error) { soundOn = false; }
}
const sfx = {
  pick: () => sound(() => playTone(0, 0.08, 520, 880, 0.12)),
  make: () => sound(() => { playTone(0, 0.1, 440, 660, 0.12); playTone(0.1, 0.18, 660, 990, 0.12); }),
  scan: () => sound(() => { playTone(0, 0.12, 700, 1400, 0.1); playTone(0.12, 0.2, 1400, 1400, 0.08); }),
  bubble: () => sound(() => playTone(0, 0.06, 300 + Math.random() * 300, 700, 0.04)),
  rumble: () => sound(() => { playTone(0, 0.9, 70, 45, 0.25); playNoise(0, 0.8, 200, 60, 0.12); }),
  whistle: () => sound(() => { playTone(0, 0.5, 180, 120, 0.2); playTone(0.5, 0.7, 120, 90, 0.2); }),
  hurt: () => sound(() => playNoise(0, 0.2, 500, 150, 0.2)),
  warn: () => sound(() => { playTone(0, 0.12, 620, 620, 0.12); playTone(0.18, 0.12, 620, 620, 0.12); }),
  win: () => sound(() => playJingle()),
  splash: () => sound(() => playNoise(0, 0.3, 1800, 500, 0.12)),
};

// ----- Light -----
// The deeper you go, the less sunlight there is. Everything is lit by these lights (and by your torch).
const skyLight = new THREE.AmbientLight(0xbfe8ff, 0.8);
const sunLight = new THREE.DirectionalLight(0xfff6d8, 0.6);
sunLight.position.set(0.4, 1, 0.3);
const torch = new THREE.SpotLight(0xfff2cc, 0, 70, 0.5, 0.45, 1.2);
torch.position.set(0.3, -0.2, 0);
torch.target.position.set(0, 0, -6);
camera.add(torch, torch.target);
scene.add(skyLight, sunLight);
const clock = { value: 0 };             // seconds since the game began (shared with the tiny graphics programs below)
const nightGlow = { value: 0 };         // how strongly the corals and anemones glow: nothing by day, bright at night
// Make a paint glow with its own colour at night
function glowAtNight(material) {
  material.onBeforeCompile = function (shader) {
    shader.uniforms.nightGlow = nightGlow;
    shader.fragmentShader = "uniform float nightGlow;\n" + shader.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor * nightGlow;");
  };
  return material;
}

// ----- The sea bed -----
// One big sheet of points, each pushed down to the depth of the sea at that place and coloured like the ground there.
// A tiny program for the graphics card (a "shader") lights it, and draws the wobbly lines of sunlight you see in shallow water.
const baseLight = new THREE.PointLight(0xfff0c0, 0, 40, 1.4);          // (the light of the sea lamp or base room nearest to you)
scene.add(baseLight);
const seaBed = { uniforms: { lampAt: { value: new THREE.Vector3() }, lampOn: { value: 0 }, time: clock, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.02 }, light: { value: 0.8 }, sun: { value: 0.6 }, night: nightGlow, torchAt: { value: new THREE.Vector3() }, torchWay: { value: new THREE.Vector3(0, 0, -1) }, torchOn: { value: 0 } } };
(function () {
  const cells = 300, size = (WORLD + 20) * 2, places = [], colours = [], shines = [], corners = [];
  for (let iz = 0; iz <= cells; iz++) for (let ix = 0; ix <= cells; ix++) {
    const x = (ix / cells - 0.5) * size, z = (iz / cells - 0.5) * size, zone = zoneAt(x, z), sand = ZONES[zone].sand;
    const shade = 0.78 + noise2(x, z, 9, 41) * 0.3 + noise2(x, z, 40, 42) * 0.12;
    // Glowing cracks of hot rock round the vents, and a faint shine in the crystal fields
    const crack = zone === "vents" && Math.abs(noise2(x, z, 16, 45) - 0.5) < 0.035;
    places.push(x, -depthAt(x, z), z);
    if (crack) colours.push(1, 0.42, 0.1);
    else colours.push(sand[0] * shade, sand[1] * shade, sand[2] * shade);
    shines.push(crack ? 1.5 : zone === "crystal" ? 0.22 : 0);
  }
  for (let iz = 0; iz < cells; iz++) for (let ix = 0; ix < cells; ix++) {
    const a = iz * (cells + 1) + ix, b = a + 1, c = a + cells + 1, d = c + 1;
    corners.push(a, c, b, b, c, d);
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(places, 3));
  shape.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  shape.setAttribute("shine", new THREE.Float32BufferAttribute(shines, 1));
  shape.setIndex(corners);
  shape.computeVertexNormals();
  const material = new THREE.ShaderMaterial({
    uniforms: seaBed.uniforms,
    vertexColors: true,
    vertexShader: `
      attribute float shine;
      varying vec3 vColour;
      varying vec3 vUp;
      varying vec3 vPlace;
      varying float vFar;
      varying float vShine;
      void main() {
        vColour = color;
        vShine = shine;
        vUp = normal;
        vPlace = position;
        vec4 seen = modelViewMatrix * vec4(position, 1.0);
        vFar = -seen.z;
        gl_Position = projectionMatrix * seen;
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 fogColor;
      uniform float fogDensity;
      uniform float light;
      uniform float sun;
      uniform vec3 torchAt;
      uniform vec3 torchWay;
      uniform float torchOn;
      uniform vec3 lampAt;
      uniform float lampOn;
      uniform float night;
      varying vec3 vColour;
      varying vec3 vUp;
      varying vec3 vPlace;
      varying float vFar;
      varying float vShine;
      // (two little helpers that make a blotchy pattern out of nothing but a place)
      float dots(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float blotch(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(dots(i), dots(i + vec2(1.0, 0.0)), f.x), mix(dots(i + vec2(0.0, 1.0)), dots(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float up = max(0.0, normalize(vUp).y);
        float close = 1.0 - smoothstep(25.0, 90.0, vFar);       // (fine detail is only drawn near you)
        // Steep ground is bare grey rock; flatter ground is sand, with little ripples in it
        vec3 ground = mix(vColour * vec3(0.62, 0.64, 0.7), vColour, smoothstep(0.72, 0.9, up));
        ground *= 0.93 + 0.07 * sin(vPlace.x * 2.3 + sin(vPlace.z * 1.9) * 1.6);
        // Grainy sand and pebbles close up, and big soft patches of darker, mossy ground
        ground *= mix(1.0, 0.8 + 0.4 * (blotch(vPlace.xz * 1.6) * 0.6 + blotch(vPlace.xz * 5.5) * 0.4), close);
        ground = mix(ground, ground * vec3(0.62, 0.86, 0.7), smoothstep(0.5, 0.78, blotch(vPlace.xz * 0.09)) * 0.55);
        vec3 colour = ground * (light * 0.62 + sun * (0.2 + 0.4 * up));
        colour += vColour * vShine * (0.8 + 0.2 * sin(time * 2.0 + vPlace.x * 0.7 + vPlace.z * 0.5));
        // Wobbly lines of sunlight on the sand (they fade away as the water gets deeper)
        vec2 p = vPlace.xz * 0.4;
        float lines = sin(p.x + sin(p.y * 1.3 + time * 0.9) * 1.7 + time * 0.5) * sin(p.y * 1.1 + sin(p.x * 1.2 - time * 0.7) * 1.7);
        vec2 q = vPlace.xz * 0.23 + 7.0;
        float wide = sin(q.x + sin(q.y * 1.4 - time * 0.6) * 1.9 - time * 0.35) * sin(q.y * 1.2 + sin(q.x * 1.1 + time * 0.5) * 1.9);
        colour += vColour * (pow(1.0 - abs(lines), 7.0) * 0.8 + pow(1.0 - abs(wide), 5.0) * 0.4) * sun * clamp(1.0 + vPlace.y / 60.0, 0.0, 1.0) * up;
        // At night, tiny living lights twinkle on the sea bed
        vec2 cell = floor(vPlace.xz * 1.3);
        float speck = step(0.985, dots(cell)) * smoothstep(0.42, 0.1, distance(fract(vPlace.xz * 1.3), vec2(0.5)));
        colour += vec3(0.3, 1.0, 0.85) * speck * night * 1.6 * close * (0.55 + 0.45 * sin(time * 2.0 + dots(cell + 3.0) * 40.0));
        // Your torch: a bright circle where you point it
        vec3 toHere = vPlace - torchAt;
        float far = length(toHere);
        colour += vColour * smoothstep(0.84, 0.96, dot(toHere / far, torchWay)) * torchOn * 1.1 / (1.0 + far * far * 0.004);
        vec3 toLamp = vPlace - lampAt;             // the pool of light round the nearest lamp of your base
        colour += vColour * lampOn * 0.6 / (1.0 + dot(toLamp, toLamp) * 0.012);
        float mist = 1.0 - exp(-fogDensity * fogDensity * vFar * vFar);
        gl_FragColor = vec4(mix(colour, fogColor, mist), 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(shape, material));
})();

// ----- The top of the water, and the sky above it -----
// (Seen from below, the surface is a sheet of rippling light. A tiny graphics program draws the ripples.)
const surfacePaint = new THREE.ShaderMaterial({
  uniforms: { time: clock, below: { value: 0 }, bright: { value: new THREE.Color(0xf0ffff) }, dull: { value: new THREE.Color(0x7ad8f0) }, see: { value: 0.6 }, eye: { value: new THREE.Vector3() }, reach: { value: 220 } },
  vertexShader: `
    varying vec2 vPlace;
    void main() {
      vec4 place = modelMatrix * vec4(position, 1.0);
      vPlace = place.xz;
      gl_Position = projectionMatrix * viewMatrix * place;
    }`,
  fragmentShader: `
    uniform float time;
    uniform vec3 bright;
    uniform vec3 dull;
    uniform float see;
    uniform vec3 eye;
    uniform float reach;
    uniform float below;
    varying vec2 vPlace;
    void main() {
      float waves = sin(vPlace.x * 0.5 + time * 1.2 + sin(vPlace.y * 0.37 + time * 0.6) * 2.0) * sin(vPlace.y * 0.45 - time + sin(vPlace.x * 0.31) * 2.0);
      float fine = sin(vPlace.x * 1.9 - time * 1.6 + sin(vPlace.y * 1.3) * 1.5) * sin(vPlace.y * 2.1 + time * 1.3);
      float ripple = smoothstep(0.1, 0.9, waves * 0.75 + fine * 0.25);
      float fade = 1.0 - smoothstep(reach * 0.3, reach, distance(vPlace, eye.xz));
      vec3 colour = mix(dull, bright, ripple);
      float alpha = see * fade;
      if (below > 0.5) {
        // From under the water you only see the sky through a round window straight above you. Further out, the surface is a dark, wobbly mirror.
        vec3 toHere = normalize(vec3(vPlace.x - eye.x, -eye.y, vPlace.y - eye.z));
        float window = smoothstep(0.58, 0.74, toHere.y + waves * 0.06);
        colour = mix(dull * (0.42 + 0.2 * ripple), colour, window) + bright * window * pow(ripple, 3.0) * 0.3;
        alpha *= mix(0.8, 1.0, window);
      } else colour += bright * pow(ripple, 6.0) * 0.5;        // (from above: glints of light on the waves)
      gl_FragColor = vec4(colour, alpha);
    }`,
  transparent: true, side: THREE.DoubleSide, depthWrite: false,
});
const surface = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), surfacePaint);
// All round you is a huge ball painted with the colour of the water: brighter above you, darker below
const waterBall = new THREE.Mesh(new THREE.SphereGeometry(650, 20, 12), new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color() }, middle: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
  vertexShader: `
    varying float vUp;
    void main() {
      vUp = normalize(position).y;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 top;
    uniform vec3 middle;
    uniform vec3 bottom;
    varying float vUp;
    void main() {
      gl_FragColor = vec4(vUp > 0.0 ? mix(middle, top, pow(vUp, 0.7)) : mix(middle, bottom, pow(-vUp, 0.6)), 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
}));
waterBall.renderOrder = -10;
waterBall.frustumCulled = false;
scene.add(waterBall);
surface.rotation.x = -Math.PI / 2;
scene.add(surface);
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(26, 20), new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(17, 20), new THREE.MeshBasicMaterial({ color: 0xe4ecff, fog: false }));
const stars = (function () {
  const spots = [];
  for (let n = 0; n < 600; n++) {
    const round = Math.random() * 6.283, up = 0.04 + Math.random() * 0.96, out = Math.sqrt(1 - up * up);
    spots.push(Math.cos(round) * out * 600, up * 600, Math.sin(round) * out * 600);
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(spots, 3));
  const cloud = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  cloud.frustumCulled = false;
  return cloud;
})();
scene.add(sunDisc, moonDisc, stars);
// Beams of sunlight slanting down through the water near you
const beams = Array.from({ length: 14 }, function (unused, n) {
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8 + (n % 3) * 0.5, 3.5 + (n % 4) * 1.3, 76, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8fff0, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  beam.userData = { x: Math.cos(n * 2.4) * (7 + n * 3.2), z: Math.sin(n * 2.4) * (7 + n * 3.2) };
  beam.rotation.z = 0.22;
  scene.add(beam);
  return beam;
});
// Specks drifting in the water, so you can feel yourself moving
const specks = (function () {
  const spots = [];
  for (let n = 0; n < 500; n++) spots.push((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 60);
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(spots, 3));
  const cloud = new THREE.Points(shape, new THREE.PointsMaterial({ color: 0xdff8ff, size: 0.09, transparent: true, opacity: 0.6, depthWrite: false }));
  cloud.frustumCulled = false;
  scene.add(cloud);
  return cloud;
})();
// In the deep, little lights drift in the dark: tiny glowing creatures
const motes = (function () {
  const spots = [], tints = [], colour = new THREE.Color();
  for (let n = 0; n < 420; n++) {
    spots.push((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 80);
    colour.set([0x7affe0, 0xa08aff, 0xff9ae0, 0x9affa0][n % 4]);
    tints.push(colour.r, colour.g, colour.b);
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(spots, 3));
  shape.setAttribute("color", new THREE.Float32BufferAttribute(tints, 3));
  const cloud = new THREE.Points(shape, new THREE.PointsMaterial({ vertexColors: true, size: 0.16, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  cloud.frustumCulled = false;
  scene.add(cloud);
  return cloud;
})();
// Bubbles that rise from you as you breathe (and from the hot vents)
const bubbles = Array.from({ length: 90 }, function () {
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.45, depthWrite: false }));
  bubble.visible = false;
  bubble.userData = { life: 0, drift: 0 };
  scene.add(bubble);
  return bubble;
});

// ----- Plants, rocks and things to pick up -----
// There are thousands of these, so each kind is drawn in one go: the same shape copied to many places ("instancing").
const paints = new Map();
const paint = (colour) => paints.get(colour) || paints.set(colour, new THREE.MeshPhongMaterial({ color: colour, shininess: 26, specular: 0x243440 })).get(colour);       // (a little shiny, as wet things are)
// Glue several simple shapes into one. Each part is [shape, x, y, z, turn about x, turn about z, stretch x, stretch y, stretch z].
function glue(parts) {
  const places = [], ups = [];
  for (const [shape, x, y, z, tiltX, tiltZ, sx, sy, sz] of parts) {
    const mesh = new THREE.Mesh(shape);
    mesh.position.set(x, y, z);
    mesh.rotation.set(tiltX || 0, 0, tiltZ || 0);
    mesh.scale.set(sx || 1, sy || 1, sz || 1);
    mesh.updateMatrix();
    const moved = (shape.index ? shape.toNonIndexed() : shape.clone()).applyMatrix4(mesh.matrix);
    places.push(...moved.attributes.position.array);
    ups.push(...moved.attributes.normal.array);
  }
  const whole = new THREE.BufferGeometry();
  whole.setAttribute("position", new THREE.Float32BufferAttribute(places, 3));
  whole.setAttribute("normal", new THREE.Float32BufferAttribute(ups, 3));
  return whole;
}
const BALL = new THREE.IcosahedronGeometry(1, 1), LUMP = new THREE.IcosahedronGeometry(1, 0), STICK = new THREE.CylinderGeometry(0.6, 1, 1, 7), CONE = new THREE.ConeGeometry(1, 1, 7), BOX = new THREE.BoxGeometry(1, 1, 1);
// Put one shape at every place in a list. "colourOf" picks each one's colour, "sizeOf" its width and height, and "lift" how far off the ground it sits.
// The sea is split into big squares, and each square's things are drawn together. Only the squares near you are drawn at all, which keeps the game fast.
const SQUARE = 160;
const squares = [];
function scatter(shape, material, list, colourOf, sizeOf, lift) {
  const groups = new Map();
  for (const at of list) {
    const name = Math.floor(at.x / SQUARE) + "," + Math.floor(at.z / SQUARE);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(at);
  }
  const helper = new THREE.Object3D(), colour = new THREE.Color();
  for (const [name, items] of groups) {
    const many = new THREE.InstancedMesh(shape, material, items.length);
    items.forEach(function (at, n) {
      const [wide, high] = sizeOf(at), up = lift ? lift(at) : 0;
      helper.position.set(at.x, at.y + up, at.z);
      helper.rotation.set(0, at.turn, 0);
      helper.scale.set(wide, high, wide);
      helper.updateMatrix();
      many.setMatrixAt(n, helper.matrix);
      many.setColorAt(n, colour.set(colourOf(at)));
      Object.assign(at, { mesh: many, slot: n, lift: up });       // (so a thing you pick up can be found and hidden again)
      (at.drawn = at.drawn || []).push({ mesh: many, slot: n, lift: up, wide: wide, high: high });
    });
    many.frustumCulled = false;
    const [sx, sz] = name.split(",").map(Number);
    many.userData = { x: (sx + 0.5) * SQUARE, z: (sz + 0.5) * SQUARE };
    scene.add(many);
    squares.push(many);
  }
}
const pickFrom = (colours) => (at) => colours[Math.floor(at.tint * colours.length)];
// Kelp: two tall ribbons crossed over. A few lines added to its graphics program make it sway in the current.
const kelpShape = (function () {
  const one = new THREE.PlaneGeometry(1, 1, 1, 7);
  one.translate(0, 0.5, 0);
  const other = one.clone();
  other.rotateY(Math.PI / 2);
  return glue([[one, 0, 0, 0], [other, 0, 0, 0]]);
})();
const kelpPaint = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
kelpPaint.onBeforeCompile = function (shader) {
  shader.uniforms.time = clock;
  shader.vertexShader = "uniform float time;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
    float bend = position.y * position.y;
    transformed.x += sin(time * 1.1 + instanceMatrix[3][0] * 0.31 + position.y * 3.0) * 0.5 * bend;
    transformed.z += cos(time * 0.9 + instanceMatrix[3][2] * 0.27 + position.y * 2.4) * 0.4 * bend;`);
};
scatter(kelpShape, kelpPaint, decor.kelp, pickFrom([0x4a8a3a, 0x5a9a44, 0x6aa040, 0x3e7a34]), (at) => [1.3 * at.size, 9 * at.size]);
scatter(glue([[STICK, 0, 0.7, 0, 0, 0, 0.22, 1.4, 0.22], [STICK, 0.45, 1, 0, 0, -0.7, 0.16, 1.1, 0.16], [STICK, -0.4, 1.1, 0.1, 0, 0.6, 0.16, 1.2, 0.16], [STICK, 0, 1.1, 0.45, 0.6, 0, 0.14, 1, 0.14], [BALL, 0, 1.5, 0, 0, 0, 0.3, 0.3, 0.3], [BALL, 0.85, 1.45, 0, 0, 0, 0.22, 0.22, 0.22], [BALL, -0.8, 1.6, 0.1, 0, 0, 0.22, 0.22, 0.22]]),
  glowAtNight(new THREE.MeshLambertMaterial({ color: 0xffffff })), decor.coral, pickFrom([0xff6a8a, 0xff9a4a, 0xffd84a, 0xc86af0, 0x4ad8c8, 0xff5ab0]), (at) => [1.5 * at.size, 1.5 * at.size]);
scatter(glue([[new THREE.CircleGeometry(1, 14), 0, 1.4, 0], [STICK, 0, 0.3, 0, 0, 0, 0.08, 0.6, 0.08]]), glowAtNight(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })), decor.fan, pickFrom([0xe84a7a, 0xf0a03a, 0x8a5ae0, 0xe0e04a]), (at) => [1.3 * at.size, 1.3 * at.size]);
scatter(glue([[BALL, 0, 0.4, 0, 0, 0, 1.4, 0.9, 1.1], [LUMP, 0.9, 0.2, 0.4, 0, 0, 0.6, 0.5, 0.6]]), new THREE.MeshLambertMaterial({ color: 0xffffff }), decor.rock, pickFrom([0x7a7684, 0x8a8694, 0x6a6672, 0x7c8a7a]), (at) => [1.2 * at.size, 1.2 * at.size]);
scatter(CONE, new THREE.MeshLambertMaterial({ color: 0xffffff }), decor.spire, pickFrom([0x2c2a3c, 0x34324a, 0x242232]), (at) => [2.4 * at.size, 10 * at.size], (at) => 5 * at.size);
// Glow bulbs: plants that shine with their own light in the dark
scatter(glue([[BALL, 0, 1.2, 0, 0, 0, 0.45, 0.55, 0.45], [STICK, 0, 0.45, 0, 0, 0, 0.07, 0.9, 0.07]]), new THREE.MeshBasicMaterial({ color: 0xffffff }), decor.bulb, pickFrom([0x5affd8, 0x8a7aff, 0xff7ae0, 0x7affa0]), (at) => [at.size, at.size]);
// Sea grass (short blades that sway like the kelp), anemones, brain coral and table coral
scatter(kelpShape, kelpPaint, decor.grass, pickFrom([0x7ac84a, 0x5ab040, 0x9ad85a]), (at) => [0.55 * at.size, 1.2 * at.size]);
scatter(glue([[BALL, 0, 0.25, 0, 0, 0, 0.45, 0.3, 0.45]].concat([0, 1, 2, 3, 4, 5, 6, 7].map((k) => [STICK, Math.cos(k * 0.785) * 0.3, 0.75, Math.sin(k * 0.785) * 0.3, Math.sin(k * 0.785) * 0.5, -Math.cos(k * 0.785) * 0.5, 0.07, 0.8, 0.07]))),
  glowAtNight(new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x201018 })), decor.anemone, pickFrom([0xff7ab0, 0xffa04a, 0xc87aff, 0x7ae0d0]), (at) => [at.size, at.size]);
scatter(glue([[BALL, 0, 0.5, 0, 0, 0, 1, 0.75, 1]]), new THREE.MeshLambertMaterial({ color: 0xffffff }), decor.brain, pickFrom([0xe8b06a, 0xd88aa0, 0xa8c86a, 0x8ab0d8]), (at) => [1.1 * at.size, 1.1 * at.size]);
scatter(glue([[new THREE.CylinderGeometry(1.5, 1.1, 0.18, 14), 0, 1.1, 0], [STICK, 0, 0.5, 0, 0, 0, 0.22, 1.1, 0.22]]), glowAtNight(new THREE.MeshLambertMaterial({ color: 0xffffff })), decor.table, pickFrom([0x5ab8c8, 0xd8a05a, 0xb87ad0]), (at) => [1.3 * at.size, 1.1 * at.size]);
// The Crystal Fields: clusters of giant crystals that shine with their own light
scatter(glue([[CONE, 0, 0.5, 0, 0, 0, 0.16, 1, 0.16], [CONE, 0.22, 0.34, 0.06, 0, -0.45, 0.12, 0.7, 0.12], [CONE, -0.2, 0.3, -0.05, 0.2, 0.5, 0.11, 0.62, 0.11], [CONE, 0.04, 0.26, 0.22, 0.55, 0, 0.1, 0.55, 0.1]]),
  new THREE.MeshBasicMaterial({ color: 0xffffff }), decor.crystal, pickFrom([0xb07aff, 0xff8ae8, 0x7ad8ff, 0xd0a0ff]), (at) => [5 * at.size, 7 * at.size]);
// The Whale Graveyard: the ribs of whales that died long ago
scatter(glue([-3, 0, 3].map((z) => [new THREE.TorusGeometry(4, 0.32, 6, 14, Math.PI), 0, 0, z])), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x2a2a26 }), decor.bone, pickFrom([0xe8e4d4, 0xd8d4c0]), (at) => [1.4 * at.size, 1.5 * at.size]);
// The Ember Vents: chimneys of dark rock with a red-hot glow at the top
scatter(glue([[new THREE.CylinderGeometry(0.5, 1.5, 4.4, 8), 0, 2.2, 0]]), new THREE.MeshLambertMaterial({ color: 0xffffff }), decor.vent, pickFrom([0x3a2a28, 0x4a3430]), (at) => [at.size, at.size]);
scatter(glue([[BALL, 0, 4.4, 0, 0, 0, 0.55, 0.3, 0.55]]), new THREE.MeshBasicMaterial({ color: 0xffffff }), decor.vent, pickFrom([0xff7a2a, 0xffa83a]), (at) => [at.size, at.size]);
// Things to pick up. Each kind has its own shape. When you take one it shrinks away to nothing.
const LOOT_SHAPES = {
  shell: [glue([[new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0, 0, 0, 0.5, 0.3, 0.6]]), new THREE.MeshLambertMaterial({ color: 0xffffff }), [0xffd0e0, 0xfff0d8, 0xffb8a0]],
  kelp: [glue([[CONE, 0, 0.5, 0, 0, 0.2, 0.18, 1, 0.18], [CONE, 0.2, 0.4, 0.1, 0, -0.35, 0.16, 0.8, 0.16], [CONE, -0.15, 0.45, -0.1, 0.3, 0.3, 0.16, 0.9, 0.16]]), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x1a3a10 }), [0x8ad84a, 0x7ac83a]],
  copper: [glue([[LUMP, 0, 0.3, 0, 0, 0, 0.45, 0.38, 0.45]]), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 80, emissive: 0x3a1a08 }), [0xe07a3a, 0xf08a4a]],
  quartz: [glue([[CONE, 0, 0.5, 0, 0, 0, 0.2, 1, 0.2], [CONE, 0.22, 0.35, 0.05, 0, -0.5, 0.15, 0.7, 0.15], [CONE, -0.2, 0.35, -0.05, 0, 0.5, 0.15, 0.7, 0.15]]), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 120, emissive: 0x2a4a5a }), [0xc8f0ff, 0xe0d8ff]],
  salvage: [glue([[BOX, 0, 0.35, 0, 0, 0, 0.8, 0.6, 0.6], [BOX, 0, 0.35, 0, 0, 0, 0.84, 0.12, 0.64]]), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x16181c }), [0x9aa0ae, 0xb0946a]],
  pearl: [new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), [0x9affe0, 0xd0fff0]],
  glass: [glue([[LUMP, 0, 0.15, 0, 0, 0, 0.34, 0.14, 0.44]]), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 140, emissive: 0x10302a, transparent: true, opacity: 0.85 }), [0x7ae8c8, 0x8ac8ff, 0xf0d08a]],
  silver: [glue([[LUMP, 0, 0.3, 0, 0, 0, 0.42, 0.34, 0.42], [LUMP, 0.3, 0.18, 0.1, 0, 0, 0.22, 0.2, 0.22]]), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 160, emissive: 0x303844 }), [0xe0e8f4, 0xc8d4e8]],
  amethyst: [glue([[CONE, 0, 0.55, 0, 0, 0, 0.2, 1.1, 0.2], [CONE, 0.24, 0.38, 0, 0, -0.5, 0.15, 0.75, 0.15], [CONE, -0.2, 0.36, 0.08, 0.3, 0.5, 0.14, 0.7, 0.14]]), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 120, emissive: 0x4a1a7a }), [0xb070ff, 0xd090ff]],
  ember: [glue([[LUMP, 0, 0.3, 0, 0, 0, 0.4, 0.34, 0.4]]), new THREE.MeshBasicMaterial({ color: 0xffffff }), [0xff7a2a, 0xffa040]],
  bone: [glue([[STICK, 0, 0.22, 0, Math.PI / 2, 0, 0.12, 1.1, 0.12], [BALL, 0, 0.22, 0.55, 0, 0, 0.2, 0.2, 0.2], [BALL, 0, 0.22, -0.55, 0, 0, 0.2, 0.2, 0.2]]), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x33332e }), [0xf0ecd8, 0xe0dcc8]],
  scale: [glue([[new THREE.CylinderGeometry(0.45, 0.45, 0.08, 6), 0, 0.3, 0, 0.5, 0.2]]), new THREE.MeshBasicMaterial({ color: 0xffffff }), [0x5affe8, 0x8affc0]],
};
for (const kind in LOOT_SHAPES) scatter(LOOT_SHAPES[kind][0], LOOT_SHAPES[kind][1], loot.filter((thing) => thing.kind === kind), pickFrom(LOOT_SHAPES[kind][2]), (at) => [at.size, at.size], kind === "pearl" || kind === "scale" ? () => 0.3 : null);
// Show or hide one thing (hidden means shrunk to nothing)
const lootHelper = new THREE.Object3D();
function showLoot(thing, shown) {
  lootHelper.position.set(thing.x, thing.y + thing.lift, thing.z);
  lootHelper.rotation.set(0, thing.turn, 0);
  lootHelper.scale.setScalar(shown ? thing.size : 0.0001);
  lootHelper.updateMatrix();
  thing.mesh.setMatrixAt(thing.slot, lootHelper.matrix);
  thing.mesh.instanceMatrix.needsUpdate = true;
}

// ----- Special places -----
const box = (w, h, d, colour, x, y, z, parent) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof colour === "object" ? colour : paint(colour));
  mesh.position.set(x, y, z);
  (parent || scene).add(mesh);
  return mesh;
};
const glowPaint = (colour) => new THREE.MeshBasicMaterial({ color: colour });
// Your pod: a round white cabin floating in an orange ring, with a hatch on top, a mast with a lamp, and a ladder down into the water
const raft = new THREE.Group();
const podGlass = new THREE.MeshPhongMaterial({ color: 0x2a6a9a, shininess: 140, specular: 0xffffff, side: THREE.DoubleSide });       // (its windows light up at night)
(function () {
  const white = new THREE.MeshPhongMaterial({ color: 0xf2f2ee, shininess: 70 }), orange = new THREE.MeshPhongMaterial({ color: 0xff7a2a, shininess: 50 });
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(4.4, 28, 18), white);
  cabin.scale.y = 0.82;
  cabin.position.y = 0.9;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.7, 1, 12, 34), orange);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(4.05, 0.16, 8, 34), orange);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 2.6;
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.7, 18), paint(0x8a94a6));
  hatch.position.y = 4.6;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.1, 6, 16), orange);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.y = 5.05;
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1, 2.6, 16), paint(0x8a94a6));
  keel.position.y = -3.2;
  raft.add(cabin, ring, stripe, hatch, wheel, keel);
  for (let k = 0; k < 6; k++) {              // round windows all the way round
    const pane = new THREE.Mesh(new THREE.CircleGeometry(0.7, 14), podGlass);
    pane.position.set(Math.cos(k * 1.047 + 0.52) * 4.28, 1.9, Math.sin(k * 1.047 + 0.52) * 4.28);
    pane.lookAt(pane.position.x * 2, pane.position.y + (pane.position.y - 0.9) * 1.4, pane.position.z * 2);
    raft.add(pane);
  }
  // On one side of the pod is the locker, where your things are kept safe...
  box(2.4, 2.3, 1.3, 0x4a7ab0, 0, 2.2, -4.9, raft);
  box(0.08, 2.1, 0.06, 0x2a4a7a, 0, 2.2, -5.57, raft);
  for (const x of [-0.25, 0.25]) box(0.1, 0.5, 0.1, 0xf2c02a, x, 2.2, -5.6, raft);
  box(2.6, 0.16, 1.5, 0x2a4a7a, 0, 3.4, -4.9, raft);
  // ...and on the other side is the fabricator, which makes your gear: a machine with a glowing screen and a little arm
  box(2.4, 1.7, 1.3, 0x8a94a6, 0, 1.9, 4.9, raft);
  box(1.5, 0.8, 0.06, glowPaint(0x7affe0), -0.2, 2.1, 5.57, raft);
  for (const y of [1.5, 1.75]) box(0.3, 0.14, 0.08, glowPaint(0xff7a2a), 0.85, y, 5.57, raft);
  box(0.2, 0.9, 0.2, 0xff7a2a, 0.8, 3.2, 4.9, raft);
  box(1.2, 0.16, 0.2, 0xff7a2a, 0.3, 3.6, 4.9, raft);
  box(0.12, 0.4, 0.12, glowPaint(0x7affe0), -0.25, 3.35, 4.9, raft);
  box(0.2, 5, 0.2, 0x8a94a6, -1.6, 6.8, -1.6, raft);                    // the mast
  box(2.4, 0.12, 1.6, 0x2a4a8a, 1.4, 4.9, -1.6, raft).rotation.z = 0.25;    // a solar panel
  box(3.2, 0.3, 3, 0x8a94a6, 6.2, 0.45, 0, raft);                       // a little deck by the door...
  box(0.2, 2.4, 1.8, 0x8a94a6, 4.3, 1.7, 0, raft);
  for (let n = 0; n < 6; n++) box(1.2, 0.12, 0.12, 0xd8dce6, 7.9, 0.2 - n * 0.6, 0, raft);      // ...and a ladder down into the sea
  for (const z of [-0.6, 0.6]) box(0.12, 4, 0.12, 0xd8dce6, 7.9, -1.4, z, raft);
})();
const raftLamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), glowPaint(0xff5a5a));
raftLamp.position.set(-1.6, 9.5, -1.6);
raft.add(raftLamp);
scene.add(raft);
// The sunken boat on the Twilight Slope
(function () {
  const wreck = new THREE.Group();
  wreck.position.set(WRECK.x, -depthAt(WRECK.x, WRECK.z) + 1.6, WRECK.z);
  wreck.rotation.set(0.25, 0.8, 0.5);
  box(5, 3.4, 16, 0x6a4a36, 0, 0, 0, wreck);
  box(4.2, 0.4, 14.6, 0x8a6a4a, 0, 1.8, 0, wreck);
  box(3, 2.4, 4, 0xb8b0a0, 0, 3.2, -3, wreck);
  box(0.4, 9, 0.4, 0x5a4030, 0, 5, 3, wreck).rotation.z = 0.5;
  for (const z of [-5, 0, 5]) box(5.2, 0.5, 0.5, 0x4a3426, 0, -0.6, z, wreck);
  scene.add(wreck);
})();
// A coral arch in the Coral Gardens marks the first tablet
(function () {
  const arch = new THREE.Mesh(new THREE.TorusGeometry(6, 1.3, 8, 18, Math.PI), paint(0xff8a6a));
  arch.position.set(TABLETS[0].x, -depthAt(TABLETS[0].x, TABLETS[0].z) - 0.5, TABLETS[0].z);
  arch.rotation.y = 0.6;
  scene.add(arch);
})();
// The Tide Tablets: old stones with a glowing sign carved on them
const tabletModels = TABLETS.map(function (tablet, n) {
  const stone = new THREE.Group();
  stone.position.set(tablet.x, -depthAt(tablet.x, tablet.z), tablet.z);
  box(1.8, 2.6, 0.5, 0x8a8694, 0, 1.3, 0, stone).rotation.z = 0.06;
  const sign = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 4 + n * 2), glowPaint(0x7affe0));
  sign.position.set(0, 1.6, 0.27);
  const back = sign.clone();
  back.position.z = -0.27;
  back.rotation.y = Math.PI;
  stone.add(sign, back);
  stone.rotation.y = n * 1.3;
  scene.add(stone);
  tablet.y = stone.position.y + 1.4;
  return stone;
});
// The Great Shell at the bottom of the Trench. Its lid lifts when you bring all four tablets.
const shellLid = new THREE.Group();
const heartPearl = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
(function () {
  const y = -depthAt(HEART.x, HEART.z);
  HEART.y = y + 3;
  const pale = new THREE.MeshLambertMaterial({ color: 0xe8d8f0, side: THREE.DoubleSide, emissive: 0x2a2440 });
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), pale);
  bowl.position.set(HEART.x, y + 4.5, HEART.z);
  bowl.scale.y = 0.6;
  const lid = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), pale);
  lid.scale.y = 0.6;
  lid.position.z = 7;
  shellLid.add(lid);
  shellLid.position.set(HEART.x, y + 4.6, HEART.z - 7);
  heartPearl.position.set(HEART.x, y + 4, HEART.z);
  for (let k = 0; k < 8; k++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), glowPaint(k % 2 ? 0x7affe0 : 0xc08aff));
    lamp.position.set(HEART.x + Math.cos(k * 0.785) * 11, -depthAt(HEART.x + Math.cos(k * 0.785) * 11, HEART.z + Math.sin(k * 0.785) * 11) + 1.2, HEART.z + Math.sin(k * 0.785) * 11);
    scene.add(lamp);
  }
  // (the Sea Heart shines: a soft halo of light round it)
  const haloBoard = document.createElement("canvas");
  haloBoard.width = haloBoard.height = 64;
  const g2 = haloBoard.getContext("2d"), fade = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(0.4, "rgba(255,255,255,0.35)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  g2.fillStyle = fade;
  g2.fillRect(0, 0, 64, 64);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloBoard), color: 0xfff0b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  halo.scale.set(9, 9, 1);
  heartPearl.add(halo);
  scene.add(bowl, shellLid, heartPearl);
})();
// The Bubble: your mini-sub. A glass ball in a yellow ring, with two lamps and a propeller.
const bubbleSub = new THREE.Group();
(function () {
  bubbleSub.add(new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 12), new THREE.MeshPhongMaterial({ color: 0xbfefff, transparent: true, opacity: 0.35, shininess: 120 })));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.28, 8, 24), paint(0xf2c02a));
  ring.rotation.x = Math.PI / 2;
  bubbleSub.add(ring);
  box(1.2, 0.5, 1.6, 0xf2c02a, 0, -1.5, 0, bubbleSub);
  box(0.3, 0.3, 1.2, 0x5a6070, 0, -0.2, 2, bubbleSub);
  box(0.12, 1.6, 0.3, 0xd8dce6, 0, -0.2, 2.6, bubbleSub);
  for (const x of [-1.2, 1.2]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), glowPaint(0xfff6c8));
    lamp.position.set(x, -0.6, -1.4);
    bubbleSub.add(lamp);
  }
  bubbleSub.visible = false;
  scene.add(bubbleSub);
})();

// ----- Creatures -----
// Every creature is built from a few simple shapes. They all face along +z, so "forwards" is the same for everyone.
const dab = function (shape, material, x, y, z, sx, sy, sz, parent) {
  const mesh = new THREE.Mesh(shape, typeof material === "object" ? material : paint(material));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  parent.add(mesh);
  return mesh;
};
// A fish: a body, a tail that wags, a fin on top and two eyes. "glow" fish shine in the dark.
function fishModel(body, fin, more) {
  const opts = more || {}, group = new THREE.Group(), tail = new THREE.Group();
  const skin = opts.glow ? glowPaint(body) : body, finSkin = opts.glow ? glowPaint(fin) : fin;
  dab(BALL, skin, 0, 0, 0, 0.34 * (opts.wide || 1), 0.5 * (opts.tall || 1), 1, group);
  tail.position.z = -0.85;
  dab(CONE, finSkin, 0, 0, -0.3, 0.07, 0.7, 0.6, tail).rotation.x = Math.PI / 2;
  dab(CONE, finSkin, 0, 0.5 * (opts.tall || 1), -0.1, 0.05, 0.4, 0.4, group);
  for (const side of [-1, 1]) {
    dab(BALL, 0xffffff, side * 0.25 * (opts.wide || 1), 0.12, 0.62, 0.1, 0.1, 0.1, group);
    dab(BALL, 0x101018, side * 0.3 * (opts.wide || 1), 0.12, 0.66, 0.05, 0.05, 0.05, group);
  }
  if (opts.stripes) for (const z of [0.25, -0.2]) dab(BALL, opts.stripes, 0, 0, z, 0.36, 0.52, 0.09, group);
  if (opts.teeth) for (let k = -2; k <= 2; k++) dab(CONE, 0xffffff, k * 0.09, -0.16, 0.9, 0.04, 0.16, 0.04, group).rotation.x = Math.PI;
  group.add(tail);
  return { group: group, tail: tail };
}
function rayModel(top, under, glow) {
  const group = new THREE.Group(), wings = [];
  dab(BALL, glow ? glowPaint(top) : top, 0, 0, 0, 0.7, 0.16, 1, group);
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.x = side * 0.5;
    dab(BALL, glow ? glowPaint(under) : top, side * 0.75, 0, -0.05, 0.85, 0.07, 0.7, wing);
    group.add(wing);
    wings.push(wing);
  }
  dab(STICK, under, 0, 0, -1.6, 0.04, 1.6, 0.04, group).rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) dab(BALL, 0x101018, side * 0.3, 0.12, 0.8, 0.07, 0.07, 0.07, group);
  return { group: group, wings: wings };
}
// What lives in the sea. depth: how deep the sea bed is where it lives. rise: how far up from the sea bed it swims (1 is all the way to the top).
// shy: it darts away from you. school: how many swim together. hunter: it chases you (range to notice you, reach and harm of its bite).
const SPECIES = {
  sunnyfin: { name: "Sunnyfin", count: 30, school: 5, depth: [4, 16], rise: 0.8, speed: 3, size: 0.45, shy: true, make: () => fishModel(0xffd84a, 0xff9a2a),
    text: "A little yellow fish that lives near the top where the water is warm. Sunnyfins always swim in a gang." },
  stripetail: { name: "Stripetail", count: 18, school: 3, depth: [14, 46], side: "coral", rise: 0.5, speed: 2.6, size: 0.6, shy: true, make: () => fishModel(0x4a9af0, 0xf2f2f6, { stripes: 0xf2f2f6, tall: 1.2 }),
    text: "It nibbles the coral clean. The white stripes help it hide among the sea fans." },
  puffball: { name: "Puffball", count: 9, depth: [5, 34], rise: 0.5, speed: 1.2, size: 0.55, puffs: true, make: function () {
    const model = fishModel(0xf0a8d8, 0xc86aa8, { wide: 2.4, tall: 1.4 });
    for (let k = 0; k < 8; k++) dab(CONE, 0xffffff, Math.cos(k * 0.785) * 0.6, Math.sin(k * 0.785) * 0.6, 0, 0.07, 0.3, 0.07, model.group).rotation.z = k * 0.785 - Math.PI / 2;
    return model;
  }, text: "Swim close and it puffs itself up to twice its size to look scary. It is not scary at all." },
  skitter: { name: "Sand Skitter", count: 12, depth: [4, 30], rise: 0, speed: 1.6, size: 0.5, crawl: true, make: function () {
    const group = new THREE.Group();
    dab(BALL, 0xe0603a, 0, 0.2, 0, 0.7, 0.3, 0.55, group);
    for (const side of [-1, 1]) {
      dab(BALL, 0xf07a4a, side * 0.75, 0.25, 0.45, 0.28, 0.2, 0.3, group);
      for (const z of [-0.3, 0, 0.3]) dab(STICK, 0xb8482a, side * 0.75, 0.08, z, 0.05, 0.5, 0.05, group).rotation.z = side * 1.1;
      dab(BALL, 0x101018, side * 0.2, 0.5, 0.4, 0.07, 0.07, 0.07, group);
    }
    return { group: group };
  }, text: "A crab that scuttles sideways over the sand looking for crumbs. Its shell is as orange as a sunset." },
  glider: { name: "Kelp Glider", count: 9, depth: [14, 46], side: "kelp", rise: 0.6, speed: 2.2, size: 1.1, make: () => rayModel(0x5a7a4a, 0xd8e8b0),
    text: "It flies through the kelp like a slow green kite, flapping its wide wings." },
  stingcap: { name: "Stingcap", count: 18, depth: [34, 125], rise: 0.7, speed: 0.5, size: 0.8, jelly: true, make: function () {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8ad8, transparent: true, opacity: 0.8, side: THREE.DoubleSide, fog: false })));      // (no mist on it: it glows, so you can see it from far away)
    for (let k = 0; k < 6; k++) dab(STICK, new THREE.MeshBasicMaterial({ color: 0xffc0f0, fog: false }), Math.cos(k * 1.05) * 0.45, -0.9, Math.sin(k * 1.05) * 0.45, 0.04, 1.8, 0.04, group);
    return { group: group };
  }, text: "A jellyfish that glows pink. Its trailing arms sting, so admire it from a little way off." },
  lampback: { name: "Lampback Turtle", count: 5, depth: [40, 112], rise: 0.5, speed: 1.5, size: 1.6, make: function () {
    const group = new THREE.Group(), wings = [];
    dab(BALL, 0x3a7a5a, 0, 0, 0, 0.8, 0.4, 1, group);
    for (const [x, z] of [[0, 0.3], [0.3, -0.2], [-0.3, -0.2], [0, -0.5]]) dab(BALL, glowPaint(0x9affd0), x, 0.3, z, 0.16, 0.1, 0.16, group);
    dab(BALL, 0x6aa87a, 0, 0, 1.1, 0.26, 0.24, 0.32, group);
    for (const side of [-1, 1]) {
      const flipper = new THREE.Group();
      flipper.position.set(side * 0.7, -0.05, 0.4);
      dab(BALL, 0x6aa87a, side * 0.5, 0, 0, 0.6, 0.06, 0.26, flipper);
      group.add(flipper);
      wings.push(flipper);
      dab(BALL, 0x101018, side * 0.14, 0.08, 1.32, 0.05, 0.05, 0.05, group);
    }
    return { group: group, wings: wings };
  }, text: "An old, gentle turtle. The spots on its shell glow, so its friends can find it in the gloom." },
  snapjaw: { name: "Snapjaw", count: 7, depth: [48, 125], rise: 0.35, speed: 2.4, size: 1.5, hunter: { range: 17, speed: 6.4, reach: 1.9, bite: 18, wait: 2.2, fearsTorch: true }, make: () => fishModel(0x8a2a3a, 0x5a1a26, { wide: 1.2, teeth: true }),
    text: "DANGER. A fierce hunter of the Twilight Slope. It hates bright light: shine your torch at it and it turns tail." },
  moonmanta: { name: "Moon Manta", count: 3, depth: [112, 210], rise: 0.6, speed: 2.4, size: 4, make: () => rayModel(0x8ab8ff, 0xe0f0ff, true),
    text: "A huge, peaceful ray that shines like the moon. It glides over the edge of the Trench." },
  glowfry: { name: "Glowfry", count: 24, school: 6, depth: [125, 310], rise: 0.4, speed: 2.2, size: 0.3, shy: true, make: () => fishModel(0x7affe0, 0xc8fff0, { glow: true }),
    text: "Tiny fish that make their own light. A whole gang of them looks like a drifting cloud of stars." },
  lanternjaw: { name: "Lanternjaw", count: 4, depth: [150, 310], rise: 0.4, speed: 2.6, size: 3.4, hunter: { range: 26, speed: 8.5, reach: 3.6, bite: 34, wait: 2.6 }, make: function () {
    const model = fishModel(0x34344e, 0x4a4a6a, { wide: 1.5, tall: 1.3, teeth: true });
    dab(STICK, 0x34344c, 0, 0.75, 0.7, 0.03, 0.7, 0.03, model.group).rotation.x = 0.7;
    dab(BALL, glowPaint(0xfff27a), 0, 1.02, 1.02, 0.14, 0.14, 0.14, model.group);
    return model;
  }, text: "DANGER. The terror of the Trench. It dangles a little lamp to tempt fish closer. Only the Bubble keeps you safe from it." },
  oldblue: { name: "Old Blue", count: 1, depth: [50, 110], giant: true, speed: 3.2, size: 9, make: function () {
    const group = new THREE.Group(), tail = new THREE.Group();
    dab(BALL, 0x3a6aa8, 0, 0, 0, 0.42, 0.42, 1, group);
    dab(BALL, 0xc8dcf0, 0, -0.12, 0.1, 0.36, 0.32, 0.9, group);
    tail.position.z = -0.9;
    dab(BALL, 0x3a6aa8, 0, 0, -0.2, 0.5, 0.05, 0.22, tail);
    for (const side of [-1, 1]) {
      dab(BALL, 0x3a6aa8, side * 0.45, -0.15, 0.35, 0.28, 0.04, 0.14, group);
      dab(BALL, 0x101018, side * 0.33, 0.06, 0.72, 0.03, 0.03, 0.03, group);
    }
    group.add(tail);
    return { group: group, tail: tail, flatTail: true };
  }, text: "A whale as long as four buses. Old Blue has swum the same slow circle round these waters for a hundred years." },
  drifter: { name: "Plains Drifter", count: 10, depth: [150, 200], side: "plains", rise: 0.3, speed: 1.6, size: 1.8, make: () => fishModel(0x7a8aa8, 0xb8c8e0, { wide: 1.3, tall: 1.4, stripes: 0x4a5a78 }),
    text: "A big, sleepy fish that drifts over the Deep Plains with its mouth open, catching whatever floats in." },
  darter: { name: "Prism Darter", count: 20, school: 5, depth: [110, 165], side: "crystal", rise: 0.5, speed: 3.4, size: 0.4, shy: true, make: () => fishModel(0xc08aff, 0xffb0f0, { glow: true }),
    text: "It flashes pink and violet as it zips between the giant crystals. Nobody knows how it never bumps into one." },
  cinderfin: { name: "Cinderfin", count: 16, school: 4, depth: [195, 240], side: "vents", rise: 0.3, speed: 2.4, size: 0.5, shy: true, make: () => fishModel(0xff7a2a, 0xffd04a, { glow: true, tall: 1.2 }),
    text: "A fish that loves hot water. It glows like a coal from the fire and warms itself over the vents." },
  // A giant jellyfish. tall: how far its arms hang down below it. sting: how much its arms hurt.
  glowbell: { name: "Giant Glowbell", count: 3, levi: true, depth: [95, 240], roam: 70, rise: 0.75, speed: 0.8, size: 6, jelly: true, sting: 24, tall: 3.4, make: function () {
    const group = new THREE.Group(), see = (colour, opacity) => new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: opacity, side: THREE.DoubleSide, fog: false, depthWrite: false });
    group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), see(0x5ac8ff, 0.5)));          // the bell...
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), see(0xd8fbff, 0.7)));        // ...with a brighter bell inside it
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: 0xe8ffff, fog: false }));
    rim.rotation.x = Math.PI / 2;
    group.add(rim);
    for (let k = 0; k < 14; k++) dab(BALL, new THREE.MeshBasicMaterial({ color: k % 2 ? 0xff9af0 : 0x9affe8, fog: false }), Math.cos(k * 0.449) * 1, 0.02, Math.sin(k * 0.449) * 1, 0.07, 0.07, 0.07, group);
    for (let k = 0; k < 10; k++) {              // long thin arms that trail far below
      const long = 2.4 + (k % 3) * 0.5;
      dab(STICK, new THREE.MeshBasicMaterial({ color: 0xa0e8ff, fog: false }), Math.cos(k * 0.628) * 0.82, -long / 2, Math.sin(k * 0.628) * 0.82, 0.025, long, 0.025, group);
    }
    for (let k = 0; k < 4; k++) dab(STICK, see(0xffb0f0, 0.85), Math.cos(k * 1.57) * 0.25, -1.1, Math.sin(k * 1.57) * 0.25, 0.1, 2.2, 0.1, group);        // and four thick, frilly ones in the middle
    return { group: group };
  }, text: "LEVIATHAN. A jellyfish as big as a house, glowing like a lantern. It is not fierce at all, but its long arms sting hard: swim round it, never under it." },
  // The leviathans: the giants of the deep. lair: where each one lives. roam: how far it wanders from there.
  // hull: how much harm it does to the Bubble (a leviathan is the only thing that can hurt it).
  lumen: { name: "Lumen Ray", count: 1, levi: true, lair: "lumen", roam: 170, rise: 0.6, speed: 3.4, size: 13, make: () => rayModel(0x8ad0ff, 0xe8fbff, true),
    text: "LEVIATHAN. As wide as a house and as gentle as a lamb. It glides over the Crystal Fields, glowing like a piece of the sky." },
  emberback: { name: "Emberback", count: 1, levi: true, lair: "emberback", roam: 95, rise: 0, speed: 1.6, size: 8, crawl: true, hunter: { range: 19, speed: 4.6, reach: 8, bite: 30, wait: 2.6, hull: 22 }, make: function () {
    const group = new THREE.Group();
    dab(BALL, 0x3a2a28, 0, 0.5, 0, 1, 0.55, 1.15, group);
    for (let k = 0; k < 9; k++) dab(BALL, glowPaint(k % 2 ? 0xff7a2a : 0xffb03a), Math.cos(k * 2.4) * 0.6 * (0.4 + (k % 3) * 0.3), 0.92 - (k % 3) * 0.12, Math.sin(k * 2.4) * 0.7 * (0.4 + (k % 3) * 0.3), 0.14, 0.08, 0.14, group);
    dab(BALL, 0x4a3430, 0, 0.35, 1.15, 0.36, 0.26, 0.36, group);
    for (const side of [-1, 1]) {
      dab(BALL, glowPaint(0xffe14a), side * 0.16, 0.45, 1.46, 0.06, 0.06, 0.06, group);
      dab(BALL, 0x5a3a34, side * 0.95, 0.3, 0.95, 0.4, 0.22, 0.5, group);
      for (const z of [-0.6, -0.1, 0.4]) dab(STICK, 0x2a1e1c, side * 1.05, 0.18, z, 0.07, 0.75, 0.07, group).rotation.z = side * 1.05;
    }
    return { group: group };
  }, text: "LEVIATHAN. DANGER. A crab as big as a cottage, with a shell of cooled lava. It guards the Ember Vents and stamps on anything that comes too close." },
  gapejaw: { name: "Gapejaw", count: 1, levi: true, lair: "gapejaw", roam: 150, rise: 0.45, speed: 3.6, size: 6.5, hunter: { range: 62, speed: 11, reach: 7.5, bite: 48, wait: 3, hull: 36 }, make: function () {
    const group = new THREE.Group(), tail = new THREE.Group(), jaw = new THREE.Group();
    dab(BALL, 0x39324a, 0, 0.1, -0.2, 0.55, 0.5, 1.1, group);                 // the body
    dab(BALL, 0x4a4060, 0, 0.34, 0.75, 0.62, 0.34, 0.72, group);              // the top of its enormous head
    for (let k = -4; k <= 4; k++) dab(CONE, 0xf4f0e0, k * 0.125, 0.08, 1.28 - Math.abs(k) * 0.045, 0.05, 0.32, 0.05, group).rotation.x = Math.PI;       // top teeth
    // The bottom jaw swings open and shut on a hinge at the back of the head
    jaw.position.set(0, -0.02, 0.2);
    dab(BALL, 0x2e283c, 0, -0.16, 0.62, 0.6, 0.2, 0.74, jaw);
    for (let k = -4; k <= 4; k++) dab(CONE, 0xf4f0e0, k * 0.125, 0.12, 1.14 - Math.abs(k) * 0.045, 0.05, 0.36, 0.05, jaw);
    dab(BALL, glowPaint(0xff5a7a), 0, -0.02, 0.55, 0.34, 0.05, 0.44, jaw);    // (its throat glows red)
    group.add(jaw);
    for (const side of [-1, 1]) {
      dab(BALL, glowPaint(0xffe14a), side * 0.46, 0.5, 1.02, 0.09, 0.09, 0.09, group);
      dab(BALL, 0x101018, side * 0.5, 0.5, 1.08, 0.045, 0.045, 0.045, group);
      for (let k = 0; k < 5; k++) dab(BALL, glowPaint(0x7affd0), side * (0.52 - k * 0.03), 0.12, 0.25 - k * 0.3, 0.035, 0.1, 0.08, group);        // glowing spots down its sides
      dab(BALL, 0x5a5078, side * 0.62, -0.1, 0.1, 0.34, 0.04, 0.2, group);
    }
    for (let k = 0; k < 4; k++) dab(CONE, 0x5a5078, 0, 0.66 - k * 0.04, 0.25 - k * 0.36, 0.04, 0.42 - k * 0.06, 0.2, group);       // spikes along its back
    tail.position.z = -1.15;
    dab(BALL, 0x39324a, 0, 0.05, -0.45, 0.26, 0.3, 0.7, tail);
    dab(CONE, 0x5a5078, 0, 0.05, -1.25, 0.06, 0.95, 0.5, tail).rotation.x = Math.PI / 2;
    group.add(tail);
    return { group: group, tail: tail, jaw: jaw };
  }, text: "LEVIATHAN. DANGER. A fish that is nearly all mouth. It lurks among the ribs of the Whale Graveyard, and its jaws could swallow the Bubble whole. The Bubble can just outrun it." },
  tidewyrm: { name: "Tidewyrm", count: 1, levi: true, lair: "tidewyrm", roam: 200, rise: 0.5, speed: 5, size: 4.6, hunter: { range: 66, speed: 13.5, reach: 6.5, bite: 45, wait: 3, hull: 34 }, chain: 18, make: () => fishModel(0x2a7a6a, 0x7affc8, { wide: 1.4, tall: 1.1, teeth: true }),
    text: "LEVIATHAN. DANGER. A sea serpent longer than a train. It hunts across the Deep Plains and is faster than the Bubble, unless you have a pearl booster or a sea whistle." },
  kraken: { name: "Abyss Kraken", count: 1, levi: true, lair: "kraken", roam: 150, rise: 0.25, speed: 3, size: 9, hunter: { range: 78, speed: 9.5, reach: 10, bite: 50, wait: 3.2, hull: 40 }, arms: 6, make: function () {
    const group = new THREE.Group();
    dab(BALL, 0x3a2050, 0, 0, 0.2, 0.62, 0.62, 1.15, group);
    dab(BALL, 0x54306e, 0, 0.1, 0.9, 0.5, 0.48, 0.5, group);
    for (const side of [-1, 1]) {
      dab(BALL, glowPaint(0xfff27a), side * 0.42, 0.12, 1.12, 0.15, 0.2, 0.12, group);
      dab(BALL, 0x101018, side * 0.47, 0.12, 1.2, 0.07, 0.11, 0.06, group);
    }
    for (let k = 0; k < 6; k++) dab(BALL, glowPaint(0xc87aff), Math.cos(k * 1.05) * 0.45, Math.sin(k * 1.05) * 0.45, -0.2 - (k % 2) * 0.4, 0.07, 0.07, 0.07, group);
    return { group: group };
  }, text: "LEVIATHAN. DANGER. The oldest thing in the sea. It lives at the very edge of the world, where the floor falls away, and its arms could wrap round a ship." },
};
// A long body made of a chain of balls that follow the head (the Tidewyrm), and arms that trail and wave (the Kraken)
function addChain(c) {
  c.links = [];
  for (let n = 0; n < c.spec.chain; n++) {
    const big = c.spec.size * (0.44 - n * 0.017);
    const link = new THREE.Mesh(BALL, n % 3 === 1 ? glowPaint(0x7affc8) : paint(0x2a7a6a));
    link.scale.set(big, big, big * 1.5);
    link.position.set(c.x, c.y, c.z - (n + 1) * c.spec.size * 0.5);
    scene.add(link);
    c.links.push(link);
  }
}
function addArms(c) {
  c.tentacles = [];
  for (let a = 0; a < c.spec.arms; a++) {
    const arm = [];
    for (let n = 0; n < 9; n++) {
      const link = new THREE.Mesh(BALL, n === 8 ? glowPaint(0xff8ae8) : paint(n % 2 ? 0x54306e : 0x3a2050));
      link.scale.setScalar(c.spec.size * (0.17 - n * 0.013));
      scene.add(link);
      arm.push(link);
    }
    c.tentacles.push(arm);
  }
}
const creatures = [];
for (const kind in SPECIES) {
  const spec = SPECIES[kind];
  let leader = null;
  for (let n = 0; n < spec.count; n++) {
    // Find a home: somewhere the sea is the right depth (and on the right side, for kelp and coral creatures)
    let home = spec.lair ? LAIRS[spec.lair] : null;
    for (let tries = 0; tries < 1500 && !home; tries++) {
      const at = spot(hash(n, tries, 51 + kind.length) * 360, 12 + hash(n, tries, 52 + kind.length) * (WORLD - 30)), deep = depthAt(at.x, at.z);
      if (deep >= spec.depth[0] && deep <= spec.depth[1] && (!spec.side || zoneAt(at.x, at.z) === spec.side)) home = at;
    }
    if (!home) continue;
    const follows = spec.school && n % spec.school !== 0 ? leader : null;
    const model = spec.make();
    model.group.scale.setScalar(spec.size);
    model.group.rotation.order = "YXZ";
    scene.add(model.group);
    const c = { kind: kind, spec: spec, model: model, home: follows ? follows.home : home, leader: follows, x: (follows || { x: home.x }).x + (follows ? (hash(n, 1, 53) - 0.5) * 3 : 0), z: (follows || { z: home.z }).z + (follows ? (hash(n, 2, 53) - 0.5) * 3 : 0), y: 0,
      yaw: hash(n, 3, 53) * 6.283, pitch: 0, goal: null, timer: 0, cool: 0, puff: 1, off: [(hash(n, 4, 53) - 0.5) * 3, (hash(n, 5, 53) - 0.5) * 1.6, (hash(n, 6, 53) - 0.5) * 3], phase: hash(n, 7, 53) * 6 };
    c.y = -depthAt(c.x, c.z) * (1 - (spec.rise || 0) * 0.5) - 1;
    if (!follows) leader = c;
    if (spec.chain) addChain(c);
    if (spec.arms) addArms(c);
    creatures.push(c);
  }
}

// ----- Day and night -----
const DAY = 420;             // how long a whole day and night lasts, in seconds (7 minutes)
// state.time counts the seconds since sunrise. The sun comes up, shines for most of the day, sets, and then it is night until the next sunrise.
// sunUp() says how much daylight there is: 1 in the day, 0 at night, and in between while the sun rises or sets.
function sunUp() {
  const t = state.time / DAY;
  return t < 0.05 ? t / 0.05 : t < 0.6 ? 1 : t < 0.68 ? 1 - (t - 0.6) / 0.08 : 0;
}
const timeName = () => { const t = state.time / DAY; return t < 0.05 ? "☀ Sunrise" : t < 0.3 ? "☀ Morning" : t < 0.6 ? "☀ Afternoon" : t < 0.68 ? "☀ Sunset" : "☾ Night"; };
// A new day begins: you have survived one more, and the sea has washed in new things to find
function newDay() {
  state.time = 0;
  state.days += 1;
  state.best = Math.max(state.best, state.days);
  for (const thing of loot) if (thing.taken && !thing.covered) {
    thing.taken = false;
    showLoot(thing, true);
  }
}
function passTime(dt) {
  const before = sunUp();
  state.time += dt;
  if (state.time >= DAY) {
    newDay();
    sfx.make();
    toast("Sunrise! You have survived " + state.days + (state.days === 1 ? " day" : " days") + ". The sea has washed in new things to find.", 6);
  } else if (before > 0.5 && sunUp() <= 0.5) toast("Night is falling. The sea goes dark and the hunters grow bolder. Shelter in your pod or your base" + (state.gear.torch ? ", or light your torch (T)." : "."), 7);
}
// If you black out, your count of days survived starts again
function lostCount() {
  const had = state.days;
  state.days = 0;
  return had > 0 ? " Your count of days survived starts again from 0 (you had " + had + ")." : "";
}

// ----- What the game remembers -----
const SAVE_NAME = "deepwildSave";
const emptyBag = () => Object.keys(LOOT).reduce((bag, kind) => Object.assign(bag, { [kind]: 0 }), {});
// bag: how many of each material you carry. gear: what you have made. base: the pieces of your base. hull: how strong the Bubble is (out of 100).
const freshState = () => ({ bag: emptyBag(), gear: {}, tablets: [false, false, false, false], journal: [], won: false, subAt: null, base: [], time: DAY * 0.08, days: 0, best: 0, food: 100, water: 100, power: 0, kits: {}, locker: Object.assign(emptyBag(), { water: 2, cooked: 2 }), tunnels: [], hull: 100 });
let state = freshState();
const DOCK = { x: 13, y: -1.8, z: 9 };           // where the Bubble waits, a little way from the pod
const player = { x: 7, y: -0.5, z: 0, vx: 0, vy: 0, vz: 0, yaw: -Math.PI / 2, pitch: 0, air: 45, hp: 100, inSub: false };
let mode = "title";          // title, raft, swim
let card = null;             // a message on the screen (press Space to go on)
let torchOn = false, scanTime = 0, shake = 0, shellOpen = 0, warned = 0, hudTimer = 0, saveTimer = 0, airBeep = 0;
let leviWarn = 0, scaredUntil = 0, whistleWait = 0;       // (for the leviathans and your sea whistle)
let homeAt = null;           // where you are resting: null means the raft, otherwise a room of your base
let placing = null;          // the piece of base you are about to put down
const maxAir = () => (state.gear.tank3 ? 240 : state.gear.tank2 ? 150 : state.gear.tank1 ? 90 : 45);
const depthLimit = () => (player.inSub ? (state.gear.hull ? 560 : 335) : state.gear.suit ? 150 : 60);
function save() {
  try { localStorage.setItem(SAVE_NAME, JSON.stringify(state)); } catch (error) { /* keep playing */ }
}
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_NAME)); } catch (error) { return null; }
}
let toastTimer = 0;
function toast(text, seconds) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  toastTimer = seconds || 3.5;
}
function showCard(lines, done) {
  card = { lines: lines, index: 0, done: done };
  el("card-text").textContent = lines[0];
  el("card").hidden = false;
}
function nextCard() {
  if (!card) return;
  card.index++;
  if (card.index < card.lines.length) return (el("card-text").textContent = card.lines[card.index]);
  const done = card.done;
  card = null;
  el("card").hidden = true;
  if (done) done();
}

// ----- Power -----
// Your base runs on power. Every room has a battery that holds 100, and uses a little all the time for its lights and its air.
// Solar panels make power while the sun is up (more in shallow water, where the light is strong). A vent generator makes it day and night.
// With no power left, the lights go out, the fabricators stop, and the air inside is no longer made fresh.
let powered = true;
const powerCap = () => state.base.filter(isRoom).length * 100;
const solarShare = (part) => clamp(1 + part.y / 130, 0.1, 1);            // (part.y is how far below the waves the panel stands, as a minus number)
const powerMade = () => state.base.reduce((sum, part) => sum + (part.kind === "solar" ? sunUp() * solarShare(part) : part.kind === "thermal" ? 1.2 : 0), 0);
const powerUsed = () => state.base.filter(isRoom).length * 0.15;
function runPower(dt) {
  state.power = clamp(state.power + (powerMade() - powerUsed()) * dt, 0, powerCap());
  powered = state.power > 0.01;
}

// ----- Your base -----
// Press B (or use the Builder tool) to build on the sea bed. Rooms are full of air: inside one you can breathe, rest and make gear,
// and nothing can hurt you. Tunnels join rooms together, poles lift them off the sea bed, and each kind of room does something special.
const partOf = (id) => BASE_PARTS.find((part) => part.id === id);
const baseModels = [];
const glowDot = (function () {            // a soft round glow, for lamps
  const board = document.createElement("canvas");
  board.width = board.height = 64;
  const g2 = board.getContext("2d"), fade = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(0.4, "rgba(255,255,255,0.3)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  g2.fillStyle = fade;
  g2.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(board);
})();
function halo(colour, size, x, y, z, parent) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  sprite.scale.set(size, size, 1);
  sprite.position.set(x, y, z);
  parent.add(sprite);
}
const glassPaint = () => new THREE.MeshPhongMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.22, shininess: 160, specular: 0xffffff, side: THREE.DoubleSide, depthWrite: false });
const wallPaint = () => new THREE.MeshPhongMaterial({ color: 0x8fa0b8, side: THREE.DoubleSide, emissive: 0x0c1218, shininess: 40 });
// A round table with stools, to make a room feel lived in
function tableAndStools(group, x, z) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.12, 16), paint(0xc8a878));
  top.position.set(x, 0.85, z);
  group.add(top);
  box(0.25, 0.85, 0.25, 0x5a6070, x, 0.42, z, group);
  for (let k = 0; k < 3; k++) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 10), paint(0xf2c02a));
    stool.position.set(x + Math.cos(k * 2.09) * 1.8, 0.25, z + Math.sin(k * 2.09) * 1.8);
    group.add(stool);
  }
}
// Rooms are square. Their four walls are numbered: 0 faces south (+z), 1 east (+x), 2 north (-z), 3 west (-x).
const WALL_WAYS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const halfOf = (part) => (part.kind === "lookout" ? 3 : ROOM);          // from the middle of a room to its walls
// A spot on a wall: "along" is how far along the wall it is from the wall's middle, "inset" how far in from the wall towards the middle of the room
const wallSpot = (wall, half, along, inset) => (wall % 2 ? [WALL_WAYS[wall][0] * (half - inset), along] : [along, WALL_WAYS[wall][1] * (half - inset)]);
// Where do tunnels leave this room? For each one: which wall, how far along it, and how wide a gap it needs.
function exitsOf(part) {
  const half = halfOf(part), exits = [];
  for (const tunnel of state.tunnels) {
    const mine = tunnel.ax === part.x && tunnel.az === part.z, theirs = tunnel.bx === part.x && tunnel.bz === part.z;
    if (!mine && !theirs) continue;
    const dx = (tunnel.bx - tunnel.ax) * (mine ? 1 : -1), dz = (tunnel.bz - tunnel.az) * (mine ? 1 : -1), flat = Math.hypot(dx, dz) || 1, ux = dx / flat, uz = dz / flat, big = Math.max(Math.abs(ux), Math.abs(uz));
    const wall = Math.abs(uz) >= Math.abs(ux) ? (uz > 0 ? 0 : 2) : ux > 0 ? 1 : 3;
    exits.push({ wall: wall, at: ((wall % 2 ? uz : ux) / big) * half, wide: TUBE / big + 0.1 });
  }
  return exits;
}
// Every room has one hatch: a round door in the first wall that has no tunnel. It is the only way in from the sea.
function hatchOf(part) {
  const used = exitsOf(part).map((exit) => exit.wall), free = [0, 1, 2, 3].find((wall) => !used.includes(wall)), wall = free === undefined ? 0 : free;
  const [nx, nz] = WALL_WAYS[wall], half = halfOf(part);
  return { wall: wall, nx: nx, nz: nz, x: part.x + nx * half, y: part.y + 1.3, z: part.z + nz * half };
}
// Every room has a fabricator built into the wall beside its hatch. It goes right through the wall,
// so you can use it from inside the room and from outside in the sea. ("out" is where its outside face is.)
function fabOf(part) {
  const hatch = hatchOf(part), half = halfOf(part), along = part.kind === "lookout" ? -1.95 : -2.4;
  const [x, z] = wallSpot(hatch.wall, half, along, 0.55), [ox, oz] = wallSpot(hatch.wall, half, along, -0.35);
  return { kind: "fab", fixed: true, x: x, z: z, turn: Math.atan2(-hatch.nx, -hatch.nz), out: { x: part.x + ox, y: part.y + 1.4, z: part.z + oz } };
}
// Draw the fabricator on a room's wall: the machine inside, and its other face on the outside
function addFab(group, part, spin) {
  const fab = fabOf(part), back = new THREE.Group();
  group.add(makeItem(fab, spin));
  back.position.set(fab.out.x - part.x, 0, fab.out.z - part.z);
  back.rotation.y = fab.turn + Math.PI;
  box(1.9, 1.6, 0.5, 0x8a94a6, 0, 1.4, 0, back);
  box(1.2, 0.7, 0.06, screenPaint(0x7affe0), -0.15, 1.5, 0.27, back);
  for (const y of [1.3, 1.6]) box(0.22, 0.12, 0.06, screenPaint(0xff7a2a), 0.68, y, 0.27, back);
  box(2.1, 0.16, 0.7, 0xff7a2a, 0, 2.28, 0, back);
  box(2.1, 0.16, 0.7, 0xff7a2a, 0, 0.52, 0, back);
  group.add(back);
}
// Build four walls out of flat panels, leaving a gap wherever a tunnel comes in. (base: how high up the walls start.)
function addWalls(group, part, half, high, material, base) {
  const exits = part ? exitsOf(part) : [];
  for (let wall = 0; wall < 4; wall++) {
    const gaps = exits.filter((exit) => exit.wall === wall).map((exit) => [clamp(exit.at - exit.wide, -half, half), clamp(exit.at + exit.wide, -half, half)]).sort((a, b) => a[0] - b[0]);
    const panel = function (from, to, low, top) {
      if (to - from < 0.05 || top - low < 0.05) return;
      const [x, z] = wallSpot(wall, half, (from + to) / 2, 0);
      box(wall % 2 ? 0.2 : to - from, top - low, wall % 2 ? to - from : 0.2, material, x, (base || 0) + (low + top) / 2, z, group);
    };
    let from = -half;
    for (const [a, b] of gaps) {
      panel(from, a, 0, high);
      panel(a, b, 4.1, high);            // (the bit of wall above the tunnel)
      from = Math.max(from, b);
    }
    panel(from, half, 0, high);
  }
}
// The round door, with a wheel to turn and two green lights so you can find it in the dark
function addHatch(group, part) {
  const hatch = hatchOf(part), door = new THREE.Group();
  door.position.set(hatch.x - part.x, 1.3, hatch.z - part.z);
  door.rotation.y = Math.atan2(hatch.nx, hatch.nz);
  door.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 8, 22), paint(0xff7a2a)));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.46, 20), paint(0x5a6880));
  lid.rotation.x = Math.PI / 2;
  door.add(lid);
  for (const z of [-0.3, 0.3]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 16), paint(0xf2c02a));
    wheel.position.z = z;
    door.add(wheel);
    for (const turn of [0, Math.PI / 2]) box(0.84, 0.07, 0.07, 0xf2c02a, 0, 0, z, door).rotation.z = turn;
  }
  for (const x of [-1.5, 1.5]) for (const z of [-0.22, 0.22]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7affa0, fog: false }));
    lamp.position.set(x, 0.9, z);
    door.add(lamp);
  }
  group.add(door);
}
// The lights of your base only shine while it has power. (These paints are shared, so they can all be switched at once.)
const windowGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), roomLamp = new THREE.MeshBasicMaterial({ color: 0xfff0a0 });
const screens = [];              // every glowing screen in your base, and the colour it glows
function screenPaint(colour) {
  const material = new THREE.MeshBasicMaterial({ color: colour });
  screens.push([material, colour]);
  return material;
}
// One of the things you can build inside a room. They all face along +z, and "turn" spins them to face the way you were looking.
function makeItem(item, spin) {
  const group = new THREE.Group(), kind = item.kind;
  group.position.set(item.x, 0.06, item.z);
  group.rotation.y = item.turn || 0;
  if (kind === "fab") {
    // A fabricator: a machine with a glowing screen and a little arm on top
    box(1.8, 1.9, 0.8, 0x8a94a6, 0, 0.95, 0, group);
    box(1.2, 0.7, 0.06, screenPaint(0x7affe0), -0.15, 1.3, 0.42, group);
    for (const y of [1.1, 1.4]) box(0.22, 0.12, 0.06, screenPaint(0xff7a2a), 0.68, y, 0.42, group);
    box(0.16, 0.7, 0.16, 0xff7a2a, 0.6, 2.25, 0, group);
    box(0.9, 0.14, 0.16, 0xff7a2a, 0.2, 2.6, 0, group);
  } else if (kind === "locker") {
    box(1.5, 2.5, 0.8, 0x4a7ab0, 0, 1.25, 0, group);
    box(0.06, 2.3, 0.05, 0x2a4a7a, 0, 1.25, 0.42, group);
    for (const x of [-0.2, 0.2]) box(0.08, 0.4, 0.08, 0xf2c02a, x, 1.3, 0.44, group);
  } else if (kind === "bed") {
    box(1.5, 0.5, 2.8, 0x5a6070, 0, 0.3, 0, group);
    box(1.4, 0.25, 2.6, 0xd84a3a, 0, 0.65, 0, group);
    box(1.3, 0.2, 0.6, 0xf2f2ee, 0, 0.8, -1, group);
  } else if (kind === "oven") {
    box(1.8, 1.6, 1.1, 0x4a4e5a, 0, 0.8, 0, group);
    box(1.2, 0.7, 0.08, screenPaint(0xff8a2a), 0, 0.7, 0.58, group);
    box(1.8, 0.12, 1.15, 0x2a2e3a, 0, 1.66, 0, group);
    box(0.5, HIGH - 1.7, 0.5, 0x4a4e5a, 0, (HIGH + 1.7) / 2, -0.25, group);
  } else if (kind === "tank") {
    // A fish tank: the fish you put in swim round and round
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 20), new THREE.MeshPhongMaterial({ color: 0x4ab8ff, transparent: true, opacity: 0.3, shininess: 120, depthWrite: false }));
    glass.position.y = 1.5;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.4, 20), paint(0x5a6070));
    stand.position.y = 0.2;
    const lid = stand.clone();
    lid.position.y = 2.7;
    const swimmers = new THREE.Group();
    swimmers.position.y = 1.5;
    for (let n = 0; n < (item.fish || 0); n++) {
      const fish = fishModel([0xffd84a, 0x4a9af0, 0xff7a2a, 0xc08aff][n % 4], 0xffffff).group;
      fish.scale.setScalar(0.4);
      fish.position.set(Math.cos(n * 1.57) * 0.8, (n % 2) * 0.7 - 0.35, Math.sin(n * 1.57) * 0.8);
      fish.rotation.y = -n * 1.57;
      swimmers.add(fish);
    }
    group.add(glass, stand, lid, swimmers);
    spin.push(swimmers);
  } else if (kind === "planter") {
    box(2.2, 0.6, 2.2, 0x8a5a36, 0, 0.3, 0, group);
    box(1.9, 0.2, 1.9, 0x3a2c22, 0, 0.62, 0, group);
    for (let n = 0; n < 5; n++) {
      const frond = new THREE.Mesh(CONE, paint(n % 2 ? 0x6ac84a : 0x4aa83a));
      frond.scale.set(0.2, 1.5 + (n % 3) * 0.4, 0.2);
      frond.position.set(n === 4 ? 0 : n % 2 ? 0.55 : -0.55, 1.4 + (n % 3) * 0.2, n === 4 ? 0 : n < 2 ? 0.55 : -0.55);
      group.add(frond);
    }
  } else if (kind === "reactor") {
    // A kelp reactor: feed it kelp and it makes power
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 1.9, 16), paint(0x3a5a48));
    drum.position.y = 0.95;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.83, 0.6, 16), new THREE.MeshBasicMaterial({ color: 0x7affa0 }));
    core.position.y = 1.1;
    group.add(drum, core);
    box(0.5, 0.4, 0.5, 0xf2c02a, 0, 2.1, 0, group);
    for (const x of [-1, 1]) box(0.16, 1.4, 0.16, 0x5a6070, x, 0.7, 0, group);
  } else if (kind === "table") tableAndStools(group, 0, 0);
  return group;
}
// The shell that every square room shares. glass: you can see through it. band: the colour of its frame. (A room on poles has no footing.)
function roomShape(group, part, look) {
  const half = ROOM, band = look.band || 0xf2c02a, skin = look.glass ? glassPaint() : wallPaint();
  addWalls(group, part, half, HIGH, skin);
  box(half * 2 + 0.3, 0.25, half * 2 + 0.3, skin, 0, HIGH + 0.1, 0, group);                       // the roof
  box(half * 2, 0.2, half * 2, 0x8e98aa, 0, -0.04, 0, group);                                    // the floor
  if (!part.on) box(half * 2 + 0.5, 9, half * 2 + 0.5, 0x7a8698, 0, -4.64, 0, group);            // (a footing, so it sits level on bumpy ground)
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), paint(band));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.08;
  group.add(rug);
  // A frame: a post at each corner, and beams round the top and the bottom
  for (const x of [-half, half]) for (const z of [-half, half]) box(0.45, HIGH + 0.4, 0.45, band, x, HIGH / 2, z, group);
  for (const y of [0.15, HIGH + 0.1]) for (const side of [-half, half]) {
    box(half * 2, 0.3, 0.3, band, 0, y, side, group);
    box(0.3, 0.3, half * 2, band, side, y, 0, group);
  }
  if (look.glass) {
    for (const at of [-half / 3, half / 3]) {              // thin ribs across the glass roof
      box(half * 2, 0.16, 0.16, band, 0, HIGH + 0.2, at, group);
      box(0.16, 0.16, half * 2, band, at, HIGH + 0.2, 0, group);
    }
  } else {
    // Round windows: from outside they glow with the light of the room, and from inside they show the blue of the sea
    const exits = exitsOf(part), hatch = hatchOf(part);
    for (let wall = 0; wall < 4; wall++) for (const along of [-4.4, 0, 4.4]) {
      if ((along === 0 && wall === hatch.wall) || exits.some((exit) => exit.wall === wall && Math.abs(exit.at - along) < exit.wide + 1.3)) continue;
      const [nx, nz] = WALL_WAYS[wall];
      const out = new THREE.Mesh(new THREE.CircleGeometry(1, 16), windowGlow);
      const [ox, oz] = wallSpot(wall, half, along, -0.13);
      out.position.set(ox, 2.8, oz);
      out.rotation.y = Math.atan2(nx, nz);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshPhongMaterial({ color: 0x1f8fb4, emissive: 0x0c4a66, shininess: 120 }));
      const [ix, iz] = wallSpot(wall, half, along, 0.13);
      inner.position.set(ix, 2.8, iz);
      inner.rotation.y = Math.atan2(-nx, -nz);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.1, 6, 18), paint(0x5a6880));
      rim.position.copy(inner.position);
      rim.rotation.y = inner.rotation.y;
      group.add(out, inner, rim);
    }
  }
  addHatch(group, part);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), roomLamp);
  light.position.y = HIGH - 0.5;
  group.add(light);
}
function makePart(part) {
  const kind = part.kind, group = new THREE.Group();
  if (kind === "dome" || kind === "glassdome") {
    // A room is an empty box. Whatever is inside it, you built there yourself.
    roomShape(group, part, { glass: kind === "glassdome" });
    group.userData.spin = [];
    for (const item of part.items || []) group.add(makeItem(item, group.userData.spin));
    addFab(group, part, group.userData.spin);
  } else if (kind === "lookout") {
    // A lookout: a tall square tower with a glass room on top
    addWalls(group, part, 3, 14, wallPaint());
    addWalls(group, null, 4.5, 5, glassPaint(), 14);
    box(9.3, 0.25, 9.3, glassPaint(), 0, 19.1, 0, group);
    box(9, 0.2, 9, 0x8e98aa, 0, 13.96, 0, group);                     // the floor of the room at the top
    box(6, 0.12, 6, 0x8e98aa, 0, 0.02, 0, group);
    box(6.6, 8, 6.6, 0x7a8698, 0, -4.05, 0, group);
    for (const x of [-4.5, 4.5]) for (const z of [-4.5, 4.5]) box(0.4, 5.4, 0.4, 0xf2c02a, x, 16.5, z, group);
    for (const y of [14.05, 19.1]) for (const side of [-4.5, 4.5]) {
      box(9, 0.3, 0.3, 0xf2c02a, 0, y, side, group);
      box(0.3, 0.3, 9, 0xf2c02a, side, y, 0, group);
    }
    for (const x of [-3, 3]) for (const z of [-3, 3]) box(0.4, 14, 0.4, 0x5a6880, x, 7, z, group);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), glowPaint(0xff5a5a));
    lamp.position.y = 19.7;
    group.add(lamp);
    for (let k = 0; k < 9; k++) box(0.8, 0.14, 0.14, 0xf2c02a, -2.3, 1 + k * 1.5, -2.3, group).rotation.y = Math.PI / 4;       // rungs up one corner
    box(1.6, 0.9, 0.7, 0x5a6070, 3.4, 14.5, -3.4, group);             // a desk with a spyglass, up in the glass room
    box(0.2, 0.2, 1.2, 0xf2c02a, 3.4, 15.2, -3.4, group).rotation.x = -0.4;
    addHatch(group, part);
    addFab(group, part, []);
  } else if (kind === "poles") {
    // Tall poles holding up a wide square platform: build a room on top
    box(ROOM * 2 + 1.2, 0.5, ROOM * 2 + 1.2, 0x7a8698, 0, 5.5, 0, group);
    for (const x of [-ROOM, 0, ROOM]) for (const z of [-ROOM, 0, ROOM]) {
      if (x === 0 && z === 0) continue;
      box(0.6, 12, 0.6, 0x5a6070, x * 0.94, -0.5, z * 0.94, group);
      box(1.2, 0.4, 1.2, 0xf2c02a, x * 0.94, 5.1, z * 0.94, group);
    }
    for (const side of [-ROOM * 0.94, ROOM * 0.94]) {
      box(ROOM * 2, 0.3, 0.3, 0x5a6070, 0, 2.6, side, group);
      box(0.3, 0.3, ROOM * 2, 0x5a6070, side, 2.6, 0, group);
    }
  } else if (kind === "beacon") {
    // A beacon: a flashing ball on a pole, with a tall thin beam of light that you can see from far away
    box(0.2, 4, 0.2, 0x5a6070, 0, 2, 0, group);
    box(1, 0.3, 1, 0xff7a2a, 0, 0.15, 0, group);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff5ad0, fog: false }));
    ball.position.y = 4.3;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 90, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xff7ae0, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    beam.position.y = 49;
    group.add(ball, beam);
    group.userData.flash = [ball, beam];
  } else if (kind === "solar") {
    // A solar panel: a dark blue sheet on a pole, tilted up towards the sun
    box(0.25, 2.6, 0.25, 0x5a6070, 0, 1.3, 0, group);
    box(1, 0.3, 1, 0x5a6070, 0, 0.15, 0, group);
    const sheet = new THREE.Group();
    sheet.position.y = 2.7;
    sheet.rotation.x = -0.35;
    box(3.6, 0.12, 2.4, new THREE.MeshPhongMaterial({ color: 0x1a3a8a, shininess: 140, specular: 0xaaccff }), 0, 0, 0, sheet);
    for (const x of [-1.2, 0, 1.2]) box(0.05, 0.14, 2.4, 0xd8dce6, x, 0, 0, sheet);
    for (const z of [-0.6, 0.6]) box(3.6, 0.14, 0.05, 0xd8dce6, 0, 0, z, sheet);
    group.add(sheet);
  } else if (kind === "thermal") {
    // A vent generator: it turns the heat of a hot vent into power
    box(2.2, 1.4, 2.2, 0x4a4e5a, 0, 0.7, 0, group);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.16, 8, 20), glowPaint(0xff7a2a));
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 1.55;
    group.add(coil);
    box(0.3, 2.6, 0.3, 0x5a6070, 0.8, 1.3, 0.8, group);
    box(0.4, 0.4, 0.4, glowPaint(0xffe14a), 0.8, 2.7, 0.8, group);
  } else if (kind === "lamp") {
    box(0.22, 3.4, 0.22, 0x5a6070, 0, 1.7, 0, group);
    box(0.9, 0.3, 0.9, 0x5a6070, 0, 0.15, 0, group);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), glowPaint(0xfff6c8));
    bulb.position.y = 3.6;
    group.add(bulb);
    halo(0xfff0b0, 6, 0, 3.6, 0, group);
  } else if (kind === "garden") {
    box(3, 0.6, 2, 0x8a5a36, 0, 0.3, 0, group);
    box(2.7, 0.2, 1.7, 0x3a2c22, 0, 0.62, 0, group);
    for (let k = 0; k < 6; k++) {
      const frond = new THREE.Mesh(CONE, paint(k % 2 ? 0x6ac84a : 0x4aa83a));
      frond.scale.set(0.2, 1.6 + (k % 3) * 0.4, 0.2);
      frond.position.set(-1.05 + (k % 3) * 1.05, 1.4 + (k % 3) * 0.2, k < 3 ? -0.45 : 0.45);
      group.add(frond);
    }
  } else if (kind === "dock") {
    const pad = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.3, 8, 24), paint(0xf2c02a));
    pad.rotation.x = Math.PI / 2;
    pad.position.y = 0.4;
    group.add(pad);
    for (const x of [-2.6, 2.6]) {
      box(0.25, 3, 0.25, 0x5a6070, x, 1.5, 0, group);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), glowPaint(0x7affe0));
      lamp.position.set(x, 3.1, 0);
      group.add(lamp);
    }
  }
  return group;
}
// A tunnel: a wide glass tube with yellow hoops, stretched between the walls of two rooms, with a walkway along the bottom
function makeTunnel(tunnel) {
  const span = spanOf(tunnel), from = new THREE.Vector3(span.ax, span.ay, span.az), to = new THREE.Vector3(span.bx, span.by, span.bz);
  const along = to.clone().sub(from).normalize(), long = Math.max(0.5, from.distanceTo(to));
  const group = new THREE.Group();
  group.position.copy(from).add(to).multiplyScalar(0.5);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along);
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(TUBE, TUBE, long, 18, 1, true), glassPaint()));
  for (let at = -long / 2 + 2; at < long / 2; at += 4) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(TUBE + 0.05, 0.14, 6, 22), paint(0xf2c02a));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = at;
    group.add(hoop);
  }
  const whole = new THREE.Group(), path = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, long), paint(0xb8c0cc));
  path.position.copy(group.position);
  path.position.y -= 1.7;
  path.lookAt(to.x, to.y - 1.7, to.z);
  whole.add(group, path);
  return whole;
}
// Plants, rocks and treasures are hidden while a room stands on top of them (and come back if you pack the room up)
function clearGround() {
  const rooms = state.base.filter((part) => isRoom(part) && !part.on);
  const under = (at) => rooms.some((room) => Math.max(Math.abs(room.x - at.x), Math.abs(room.z - at.z)) < halfOf(room) + 1.2);
  for (const list of Object.values(decor).concat([loot])) for (const at of list) {
    const covered = under(at);
    if (covered === Boolean(at.covered)) continue;
    at.covered = covered;
    if (list === loot) at.taken = covered;
    for (const each of at.drawn || []) {
      lootHelper.position.set(at.x, at.y + each.lift, at.z);
      lootHelper.rotation.set(0, at.turn, 0);
      lootHelper.scale.set(each.wide, each.high, each.wide).multiplyScalar(covered ? 0.0001 : 1);
      lootHelper.updateMatrix();
      each.mesh.setMatrixAt(each.slot, lootHelper.matrix);
      each.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
function rebuildBase() {
  clearGround();
  spans.clear();
  screens.length = 0;
  for (const model of baseModels) scene.remove(model);
  baseModels.length = 0;
  for (const part of state.base) {
    const model = makePart(part);
    model.position.set(part.x, part.y, part.z);
    scene.add(model);
    baseModels.push(model);
  }
  for (const tunnel of state.tunnels) {
    const model = makeTunnel(tunnel);
    scene.add(model);
    baseModels.push(model);
  }
}
const isRoom = (part) => Boolean(partOf(part.kind).room);
// A tunnel is remembered by the two rooms it joins (the middle of each). The tube itself only runs from the wall of one room to the wall of the other,
// so at each end its floor is level with that room's floor. spanOf works out where the tube starts and ends.
const spans = new Map();
function spanOf(tunnel) {
  if (spans.has(tunnel)) return spans.get(tunnel);
  const dx = tunnel.bx - tunnel.ax, dz = tunnel.bz - tunnel.az, flat = Math.hypot(dx, dz) || 1, big = Math.max(Math.abs(dx), Math.abs(dz)) / flat;
  const wallOf = function (x, z) {         // how far it is from the middle of that room to its wall, going along the tunnel (the tube starts just inside the wall)
    const room = state.base.find((part) => isRoom(part) && part.x === x && part.z === z);
    return ((room ? halfOf(room) : ROOM) - 0.45) / big;
  };
  const a = wallOf(tunnel.ax, tunnel.az), b = wallOf(tunnel.bx, tunnel.bz);
  const span = { ax: tunnel.ax + (dx / flat) * a, ay: tunnel.ay, az: tunnel.az + (dz / flat) * a, bx: tunnel.bx - (dx / flat) * b, by: tunnel.by, bz: tunnel.bz - (dz / flat) * b };
  spans.set(tunnel, span);
  return span;
}
const doorOf = (part) => ({ x: part.x, y: part.y + 1.7, z: part.z });         // where a tunnel joins a room: the middle of the tube is 1.7 metres above the floor, so its walkway is level with the floor
// Is a place inside one of your rooms? (It gives back the room, or null.) A lookout counts all the way up its tower and in the glass room on top.
function roomAt(x, y, z) {
  for (const part of state.base) {
    if (!isRoom(part)) continue;
    const dx = Math.abs(x - part.x), dz = Math.abs(z - part.z), up = y - part.y;
    if (part.kind === "lookout" ? up > -0.5 && ((dx < 2.75 && dz < 2.75 && up < 14.6) || (dx < 4.25 && dz < 4.25 && up >= 14 && up < 18.9)) : dx < ROOM - 0.25 && dz < ROOM - 0.25 && up > -0.5 && up < HIGH - 0.1) return part;
  }
  return null;
}
let inBase = false;          // true once you have climbed in through a hatch, until you climb out again
const roomHere = () => (inBase && !player.inSub ? roomAt(player.x, player.y, player.z) : null);
// How far is a point from the middle line of a tunnel?
function tunnelGap(tunnel, x, y, z) {
  const span = spanOf(tunnel), dx = span.bx - span.ax, dy = span.by - span.ay, dz = span.bz - span.az;
  const along = clamp(((x - span.ax) * dx + (y - span.ay) * dy + (z - span.az) * dz) / (dx * dx + dy * dy + dz * dz || 1), 0, 1);
  return Math.hypot(x - span.ax - dx * along, y - span.ay - dy * along, z - span.az - dz * along);
}
const tunnelAt = (x, y, z) => state.tunnels.find((tunnel) => tunnelGap(tunnel, x, y, z) < TUBE - 0.3) || null;
const tunnelHere = () => (inBase && !player.inSub ? tunnelAt(player.x, player.y, player.z) : null);
// Go in or out through a room's hatch
function useHatch(part) {
  const hatch = hatchOf(part);
  inBase = !inBase;
  if (inBase) Object.assign(player, { x: hatch.x - hatch.nx * 1.5, y: part.y + 1.6, z: hatch.z - hatch.nz * 1.5 });
  else Object.assign(player, { x: hatch.x + hatch.nx * 1.7, y: hatch.y, z: hatch.z + hatch.nz * 1.7 });
  Object.assign(player, { vx: 0, vy: 0, vz: 0 });
  sfx.make();
  if (inBase) toast("Clunk! The hatch shuts behind you. In here there is air: you stand and walk. E by the hatch: go back out.", 5);
  else sfx.splash();
}
// The walls of your base are solid. From outside you can't swim (or steer the Bubble) through a room, a platform or a tunnel.
let bumped = 0;
function keepOut() {
  const pad = player.inSub ? 2 : 0.45;
  let hit = false;
  const block = function (part, half, low, top, open) {           // (open: you can also be pushed out underneath)
    const dx = player.x - part.x, dz = player.z - part.z;
    if (Math.abs(dx) >= half + pad || Math.abs(dz) >= half + pad || player.y <= low - pad || player.y >= top + pad) return;
    const ways = [[half + pad - Math.abs(dx), "x"], [half + pad - Math.abs(dz), "z"], [top + pad - player.y, "up"]];
    if (open) ways.push([player.y - (low - pad), "down"]);
    const way = ways.sort((a, b) => a[0] - b[0])[0][1];
    if (way === "x") [player.x, player.vx] = [part.x + Math.sign(dx || 1) * (half + pad), 0];
    else if (way === "z") [player.z, player.vz] = [part.z + Math.sign(dz || 1) * (half + pad), 0];
    else if (way === "up") [player.y, player.vy] = [top + pad, Math.max(0, player.vy)];
    else [player.y, player.vy] = [low - pad, Math.min(0, player.vy)];
    hit = hit || isRoom(part);
  };
  for (const part of state.base) {
    if (part.kind === "lookout") {
      block(part, 3, part.y - 8, part.y + 13.8, false);
      block(part, 4.5, part.y + 13.8, part.y + 19.3, true);
    } else if (isRoom(part)) block(part, ROOM, part.y - (part.on ? 0.2 : 9), part.y + HIGH + 0.3, part.on);
    else if (part.kind === "poles") block(part, ROOM + 0.6, part.y + 5.25, part.y + 5.8, true);
  }
  for (const tunnel of state.tunnels) {
    const span = spanOf(tunnel), dx = span.bx - span.ax, dy = span.by - span.ay, dz = span.bz - span.az;
    const along = clamp(((player.x - span.ax) * dx + (player.y - span.ay) * dy + (player.z - span.az) * dz) / (dx * dx + dy * dy + dz * dz || 1), 0, 1);
    const ox = player.x - span.ax - dx * along, oy = player.y - span.ay - dy * along, oz = player.z - span.az - dz * along, gap = Math.hypot(ox, oy, oz) || 0.01;
    if (gap < TUBE + pad) {
      player.x += (ox / gap) * (TUBE + pad - gap);
      player.y += (oy / gap) * (TUBE + pad - gap);
      player.z += (oz / gap) * (TUBE + pad - gap);
    }
  }
  if (hit && clock.value > bumped) {
    bumped = clock.value + 12;
    toast("The walls are solid. Find the round hatch with the green lights, and press E to go in.", 5);
  }
}
const indoors = () => inBase && Boolean(roomHere() || tunnelHere());       // in a room or a tunnel: there is air, and you are safe
// The see-through shape that shows where a new piece will go: green if it fits there, red if not
const GHOST_ROUND = new THREE.CylinderGeometry(1, 1, 1, 20), GHOST_SQUARE = new THREE.BoxGeometry(2, 1, 2);
const ghost = new THREE.Mesh(GHOST_ROUND, new THREE.MeshBasicMaterial({ color: 0x7affa0, transparent: true, opacity: 0.4, depthWrite: false, fog: false }));
ghost.visible = false;
scene.add(ghost);
// Where would the piece go? Just in front of you, on the sea bed (or on top of some poles). "why" says what is wrong, if anything.
function buildSpot() {
  const short = placing.kit ? ((state.kits[placing.id] || 0) < 1 ? "You have none left. Make one at a fabricator." : "") : Object.keys(placing.needs).some((kind) => state.bag[kind] < placing.needs[kind]) ? "You don't have the materials any more." : "";
  if (placing.item) {
    // Something for inside a room goes on the floor just in front of you
    const room = roomHere();
    if (!room || room.kind === "lookout") return { x: player.x, y: player.y - 1.6, z: player.z, why: room ? "There is no space for it in the lookout tower." : "This is built indoors. Go inside a room first." };
    const reach = ROOM - 1.1;
    const x = clamp(Math.round((player.x - Math.sin(player.yaw) * 2.8) * 2) / 2, room.x - reach, room.x + reach), z = clamp(Math.round((player.z - Math.cos(player.yaw) * 2.8) * 2) / 2, room.z - reach, room.z + reach);
    const hatch = hatchOf(room);
    const why = short || (room.items.concat([fabOf(room)]).some((item) => Math.hypot(room.x + item.x - x, room.z + item.z - z) < 1.8) ? "Too close to something else in the room." : Math.hypot(hatch.x - x, hatch.z - z) < 2.6 ? "Not right in front of the hatch." : "");
    return { x: x, y: room.y, z: z, why: why, room: room };
  }
  if (placing.tunnel) {
    // A tunnel joins the room nearest to you to the room nearest to that one
    const rooms = state.base.filter(isRoom), near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const joined = (a, b) => state.tunnels.some((t) => (t.ax === a.x && t.az === a.z && t.bx === b.x && t.bz === b.z) || (t.ax === b.x && t.az === b.z && t.bx === a.x && t.bz === a.z));
    const first = rooms.slice().sort((a, b) => near(a, player) - near(b, player))[0];
    const second = first && rooms.filter((room) => room !== first && !joined(first, room) && near(room, first) < 70).sort((a, b) => near(a, first) - near(b, first))[0];
    if (!second) return { x: player.x, y: player.y, z: player.z, why: rooms.length < 2 ? "Build two rooms first, then join them with a tunnel." : "No other room is close enough to join to this one (70 metres at most), or they are joined already." };
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 + 1.7, z: (first.z + second.z) / 2, why: short, pair: [first, second] };
  }
  const roomy = placing.room || placing.id === "poles", ahead = roomy ? ROOM + 6 : 8;          // (a room is big, so it goes a good way in front of you)
  let x = Math.round((player.x - Math.sin(player.yaw) * ahead) / 2) * 2, z = Math.round((player.z - Math.cos(player.yaw) * ahead) / 2) * 2, y = -depthAt(x, z);
  if (roomy) {
    // A new room lines itself up with a room that is nearly in line with it, so the tunnel between them runs straight
    const mate = state.base.filter((part) => isRoom(part) && Math.hypot(part.x - x, part.z - z) < 44).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    if (mate && Math.abs(mate.x - x) < 7 && Math.abs(mate.z - z) > 7) x = mate.x;
    else if (mate && Math.abs(mate.z - z) < 7 && Math.abs(mate.x - x) > 7) z = mate.z;
    y = -depthAt(x, z);
  }
  const gap = (other) => Math.max(Math.abs(other.x - x), Math.abs(other.z - z));       // (rooms are square, so this is how far apart two of them are, wall to wall)
  // A room can stand on poles, if some are free just there
  const poles = placing.room ? state.base.find((part) => part.kind === "poles" && !part.on && gap(part) < ROOM) : null;
  if (poles) [x, y, z] = [poles.x, poles.y + 6, poles.z];
  else if (placing.room) {
    // The floor of a room is flat, so it sits on the highest bit of ground underneath it (no sand pokes up through the floor)
    const reach = placing.id === "lookout" ? 3.2 : ROOM;
    for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) y = Math.max(y, -depthAt(x + (ix * reach) / 2, z + (iz * reach) / 2));
    y += 0.25;
  }
  const wide = (part) => (isRoom(part) || part.kind === "poles" ? ROOM : 0);         // how much room a piece takes up
  let why = short;
  if (Math.hypot(x, z) < 20 + (roomy ? ROOM : 0)) why = "Too close to your pod.";
  else if (Math.hypot(x, z) > WORLD - 20) why = "Too close to the edge of the sea.";
  else if (state.base.some((part) => part !== poles && gap(part) < wide(part) + (roomy ? ROOM : 0) + 2)) why = "Too close to another piece of your base.";
  else if ([HEART, WRECK].concat(TABLETS).some((place) => gap(place) < 14 + (roomy ? ROOM : 0))) why = "Not here: leave this place as it is.";
  else if (placing.vent && !decor.vent.some((vent) => Math.hypot(vent.x - x, vent.z - z) < 30)) why = "It has to stand within 30 metres of a hot vent (they are in the Ember Vents).";
  return { x: x, y: y, z: z, why: why, poles: poles };
}
function placePart() {
  const at = buildSpot();
  if (at.why) return toast(at.why, 4);
  if (placing.kit) state.kits[placing.id]--;                     // (a piece you made at a fabricator)
  else for (const kind in placing.needs) state.bag[kind] -= placing.needs[kind];
  if (placing.item) {
    at.room.items.push({ kind: placing.id, x: at.x - at.room.x, z: at.z - at.room.z, turn: Math.round(player.yaw / (Math.PI / 2)) * (Math.PI / 2), fish: 0, ripe: 0 });
    toast("You built a " + placing.name.toLowerCase() + ". " + placing.does, 6);
  } else if (at.pair) {
    const from = doorOf(at.pair[0]), to = doorOf(at.pair[1]);
    state.tunnels.push({ ax: from.x, ay: from.y, az: from.z, bx: to.x, by: to.y, bz: to.z });
    toast("You joined your " + partOf(at.pair[0].kind).name.toLowerCase() + " to your " + partOf(at.pair[1].kind).name.toLowerCase() + " with a tunnel. It is full of air: walk through!", 6);
  } else {
    state.base.push({ kind: placing.id, x: at.x, y: at.y, z: at.z, ripe: 0, fish: 0, on: Boolean(at.poles), items: [] });
    if (at.poles) at.poles.on = true;
    if (placing.room) state.power = Math.min(powerCap(), state.power + 100);          // (a new room comes with a full battery)
    toast("You built a " + placing.name.toLowerCase() + (at.poles ? " on top of the poles" : "") + "! " + (placing.id === "lookout" ? "Swim to its hatch (the round door with the green lights) and press E to go in." : placing.room ? "It is empty inside, apart from the fabricator on its wall. Go in by the hatch (the round door with the green lights), then press B to build things in it. Its battery is full, but it needs a solar panel to keep it that way: make one at a fabricator." : placing.id === "solar" ? placing.does + " Here it works at " + Math.round(solarShare(at) * 100) + "% of its full strength." : placing.does), 6);
  }
  rebuildBase();
  sfx.make();
  placing = null;
  ghost.visible = false;
  save();
}
// Which piece of your base would X pack up? The tunnel you are touching, or else the piece you are closest to.
// (Poles with a room on top can't be packed up: the room has to go first, so it is the room that is chosen.)
function packTarget() {
  const tunnel = state.tunnels.find((each) => tunnelGap(each, player.x, player.y, player.z) < TUBE + 1.6);
  if (tunnel) return { tunnel: tunnel, name: "tunnel" };
  const reach = (each) => (isRoom(each) ? halfOf(each) + 5 : each.kind === "poles" ? ROOM + 5 : 7);
  const gap = (each) => Math.max(Math.abs(each.x - player.x), Math.abs(each.z - player.z));
  const part = state.base.filter((each) => !(each.kind === "poles" && each.on) && gap(each) < reach(each) && Math.abs(each.y - player.y) < 26).sort((a, b) => gap(a) - reach(a) - (gap(b) - reach(b)))[0];
  return part ? { part: part, name: partOf(part.kind).name.toLowerCase() } : null;
}
// X: pack up a piece of your base. You get all its materials back (and everything that was inside a room).
function packUp() {
  const refund = (kind) => Object.keys(kind.needs).forEach((material) => (state.bag[material] += kind.needs[material]));
  if (inBase) {
    // Indoors: pack up the thing you are standing next to
    const room = roomHere(), item = room && itemNear(room);
    if (!item) return toast("Stand next to something to pack it up. (To pack up a whole room, go outside first.)", 4);
    if (item.fixed) return toast("The fabricator is built into the wall: it is part of the room.", 4);
    refund(itemOf(item.kind));
    if (item.fish) state.bag.fish += item.fish;
    room.items.splice(room.items.indexOf(item), 1);
    toast("You packed up the " + itemOf(item.kind).name.toLowerCase() + " and got its materials back.", 4);
    rebuildBase();
    sfx.pick();
    return save();
  }
  const target = packTarget(), tunnel = target && target.tunnel, part = target && target.part;
  if (tunnel) {
    state.tunnels.splice(state.tunnels.indexOf(tunnel), 1);
    refund(partOf("tunnel"));
    toast("You packed up the tunnel and got its materials back.", 4);
  } else if (part) {
    const kind = partOf(part.kind);
    for (const item of part.items || []) {                       // (everything inside a room is packed up with it)
      refund(itemOf(item.kind));
      state.bag.fish += item.fish || 0;
    }
    if (kind.kit) state.kits[part.kind] = (state.kits[part.kind] || 0) + 1;         // (a piece made at a fabricator goes back in your bag whole, ready to put down again)
    else refund(kind);
    state.base.splice(state.base.indexOf(part), 1);
    // A room that goes takes its tunnels with it, and leaves its poles free again
    for (const each of state.tunnels.filter((t) => (t.ax === part.x && t.az === part.z) || (t.bx === part.x && t.bz === part.z))) {
      state.tunnels.splice(state.tunnels.indexOf(each), 1);
      refund(partOf("tunnel"));
    }
    if (part.on) for (const each of state.base) if (each.kind === "poles" && each.x === part.x && each.z === part.z) each.on = false;
    toast("You packed up the " + kind.name.toLowerCase() + (kind.kit ? ". It is ready to put down somewhere else (B)." : " and got its materials back."), 4);
  } else return toast("Nothing to pack up here. Swim right up to a piece of your base, then press X.", 4);
  state.power = Math.min(state.power, powerCap());
  rebuildBase();
  sfx.pick();
  save();
}
const itemOf = (id) => ROOM_ITEMS.find((item) => item.id === id);
// The thing in this room that you are standing nearest to (if it is close enough to touch)
function itemNear(room) {
  const gap = (item) => Math.hypot(room.x + item.x - player.x, room.z + item.z - player.z);
  return (room.items || []).concat([fabOf(room)]).filter((item) => gap(item) < 2.7 && player.y < room.y + 4).sort((a, b) => gap(a) - gap(b))[0] || null;
}
function toggleBuild() {
  const page = el("build");
  page.hidden = !page.hidden;
  if (page.hidden) return;
  placing = null;
  if (document.pointerLockElement) document.exitPointerLock();
  const list = el("parts");
  list.innerHTML = "";
  // Indoors you build the things that go inside a room. Out in the sea you build the rooms themselves, and everything else.
  el("build-title").textContent = inBase ? "Build inside this room" : "Build your base";
  el("build-note").textContent = inBase ? "Pick something, then look at the floor where you want it and press E. Press X next to a thing to pack it up again (you get everything back)." : "Pick a piece, then point at the sea bed in front of you and press E. Press X next to a piece to pack it up again (you get everything back). To build things INSIDE a room, go in through its hatch first.";
  for (const part of inBase ? ROOM_ITEMS : BASE_PARTS) {
    const button = document.createElement("button");
    button.className = "recipe";
    const have = state.kits[part.id] || 0;
    button.disabled = part.kit ? have < 1 : !Object.keys(part.needs).every((kind) => state.bag[kind] >= part.needs[kind]);
    button.innerHTML = "<b>" + part.name + "</b>" + (part.kit ? " (you have " + have + ")" : "") + "<br>" + part.does + "<br>" + (part.kit ? (have ? "Made and ready to put down." : '<span class="short">Make one at a fabricator first.</span>') : "Needs: " + Object.keys(part.needs).map((kind) => '<span class="' + (state.bag[kind] >= part.needs[kind] ? "ok" : "short") + '">' + part.needs[kind] + " " + LOOT[kind].name.toLowerCase() + "</span>").join(", "));
    button.addEventListener("click", function () {
      placing = part;
      page.hidden = true;
      toast(part.item ? "Look at the floor where you want it. E or click: build it there. Esc: cancel." : part.tunnel ? "Swim close to one of the two rooms you want to join, then press E (or click). Esc: cancel." : "Point at a flat bit of sea bed in front of you" + (part.room ? " (or at some poles)" : "") + ". E or click: build it there. Esc: cancel.", 7);
      if (!TEST) canvas.requestPointerLock();
    });
    list.appendChild(button);
  }
}

// ----- Fish for supper -----
// The Net catches small fish. An oven (or your pod's fabricator) cooks them. A cooked fish makes you strong: it mends you, and for a while you use less air.
let fedUntil = 0;
for (const [kind, meat] of [["sunnyfin", 1], ["stripetail", 1], ["glowfry", 1], ["darter", 1], ["cinderfin", 1], ["drifter", 3]]) SPECIES[kind].meat = meat;
function swingNet() {
  if (player.inSub) return toast("You can't use the net from inside the Bubble. Climb out first (E).", 3);
  const way = lookWay();
  let best = null, bestFar = 4.4;
  for (const c of creatures) {
    if (!c.spec.meat || c.gone > 0 || c.far > bestFar) continue;
    if (((c.x - player.x) * way[0] + (c.y - player.y) * way[1] + (c.z - player.z) * way[2]) / (c.far || 1) > 0.4) [best, bestFar] = [c, c.far];
  }
  if (!best) return toast("Swish! Nothing in the net. Get right up close to a small fish.", 2);
  best.gone = 50;                         // (another one will take its place in a while)
  state.bag.fish += best.spec.meat;
  sfx.pick();
  toast("You caught a " + best.spec.name + "! +" + best.spec.meat + " raw fish (you have " + state.bag.fish + "). Cook it at your pod's fabricator, or in an oven in your base.", 4);
}
// V: drink a bottle of water. H: use a first aid kit.
function drinkWater() {
  if (state.bag.water < 1) return toast("You have no water in your bag. Make a bottle at a fabricator (it squeezes fresh water out of kelp).", 4);
  state.bag.water--;
  state.water = Math.min(100, state.water + 50);
  sfx.pick();
  toast("Glug, glug. That's better! (You have " + state.bag.water + " more.)", 3);
}
function firstAid() {
  if (state.bag.medkit < 1) return toast("You have no first aid kit in your bag. Make one at a fabricator.", 4);
  if (player.hp >= 100) return toast("You are not hurt. Save it for later!", 3);
  state.bag.medkit--;
  player.hp = Math.min(100, player.hp + 60);
  sfx.make();
  toast("You patch yourself up with the first aid kit. (You have " + state.bag.medkit + " more.)", 3);
}
// You get hungry and thirsty as time goes by. If either runs right out, you slowly lose health.
let hungerWarn = 0;
function getHungry(dt) {
  state.food = Math.max(0, state.food - dt / 7.2);              // (a full tummy lasts 12 minutes)
  state.water = Math.max(0, state.water - dt / 5.4);            // (and a long drink lasts 9)
  if (state.food <= 0 || state.water <= 0) player.hp -= dt * 1.2;
  const low = state.food < 20 ? (state.food <= 0 ? "You are starving! " : "You are getting hungry. ") + "Eat a cooked fish (G)." : state.water < 20 ? (state.water <= 0 ? "You are parched! " : "You are getting thirsty. ") + "Drink some water (V)." : "";
  if (low && clock.value > hungerWarn) {
    hungerWarn = clock.value + (state.food <= 0 || state.water <= 0 ? 8 : 25);
    sfx.warn();
    toast(low, 4);
  }
}
function eatFish() {
  if (state.bag.cooked < 1) return toast(state.bag.fish > 0 ? "Raw fish? Yuck! Cook it first, at the fabricator in your pod or in an oven in your base." : "You have no cooked fish in your bag. Catch some with the Net, then cook it at your pod's fabricator or in an oven in your base.", 4);
  state.bag.cooked--;
  state.food = Math.min(100, state.food + 45);
  player.hp = Math.min(100, player.hp + 20);
  fedUntil = clock.value + 180;
  sfx.make();
  toast("Delicious! You are not so hungry now, and for the next three minutes you will use less air.", 5);
}

// ----- Your hands, and the tools in them -----
// Keys 1 to 4 (or the mouse wheel) choose a tool, and the left mouse button uses it.
const TOOLS = [
  { id: "hands", name: "Hands", tip: "Click: pick up or use what is in front of you." },
  { id: "scanner", name: "Scanner", tip: "Hold the mouse button on a creature to scan it." },
  { id: "net", name: "Net", tip: "Click: catch a small fish that is close in front of you." },
  { id: "builder", name: "Builder", tip: "Click: choose a piece of base, then click again to build it." },
  { id: "knife", name: "Knife", tip: "Click: jab at a creature right in front of you. A hunter that gets jabbed swims away.", gear: "knife" },
];
// Do you have this tool? (You have to make the knife before you can hold it.)
const hasTool = (each) => !each.gear || Boolean(state.gear[each.gear]);
// Jab with the knife: small hunters flee, little fish dart away, and a leviathan doesn't even notice
function jab() {
  if (player.inSub) return toast("You can't use the knife from inside the Bubble.", 3);
  const way = lookWay();
  let best = null, bestFar = 99;
  for (const c of creatures) {
    if (c.gone > 0 || c.far > 3.4 + c.spec.size * 1.2 || c.far > bestFar) continue;
    if (((c.x - player.x) * way[0] + (c.y - player.y) * way[1] + (c.z - player.z) * way[2]) / (c.far || 1) > 0.5) [best, bestFar] = [c, c.far];
  }
  sfx.pick();
  if (!best) return;
  if (best.spec.levi) return toast("Your little knife doesn't bother the " + best.spec.name + " one bit!", 3);
  best.scare = clock.value + 10;
  best.timer = 0;
  shake = 0.15;
  toast(best.spec.hunter ? "Jab! The " + best.spec.name + " flinches and swims away." : "The " + best.spec.name + " darts away.", 3);
}
let tool = 0, swing = 0, stroke = 0;
function drawTools() {
  el("tools").innerHTML = TOOLS.map((each, n) => '<span class="' + (n === tool ? "picked" : hasTool(each) ? "" : "none") + '">' + (n + 1) + " " + each.name + "</span>").join("");
}
function pickTool(n, step) {
  n = (n + TOOLS.length) % TOOLS.length;
  if (!hasTool(TOOLS[n])) {
    if (step) return pickTool(n + step, step);            // (the mouse wheel skips a tool you don't have)
    return toast("You have no dive knife yet. Make one at a fabricator.", 3);
  }
  tool = n;
  scanning = false;
  drawTools();
  toast(TOOLS[tool].name + ". " + TOOLS[tool].tip, 3);
}
function useTool() {
  swing = 1;
  const id = TOOLS[tool].id;
  if (placing) placePart();
  else if (id === "hands") interact();
  else if (id === "scanner") scanning = true;
  else if (id === "net") swingNet();
  else if (id === "knife") jab();
  else toggleBuild();
}
// Your arms are drawn on top of everything else, with their own little camera
const handScene = new THREE.Scene();
const handCamera = new THREE.PerspectiveCamera(60, 1.5, 0.05, 10);
const handLight = new THREE.AmbientLight(0xffffff, 0.8);
const handSun = new THREE.DirectionalLight(0xffffff, 0.4);
handSun.position.set(-0.4, 1, 0.6);
handScene.add(handLight, handSun);
const arms = [-1, 1].map(function (side) {
  const arm = new THREE.Group();
  box(0.1, 0.1, 0.44, new THREE.MeshLambertMaterial({ color: 0x2a4a7a }), 0, 0, 0.16, arm);          // the sleeve of your wetsuit
  box(0.105, 0.105, 0.05, new THREE.MeshLambertMaterial({ color: 0xf2c02a }), 0, 0, -0.06, arm);     // its yellow cuff
  box(0.1, 0.07, 0.15, new THREE.MeshLambertMaterial({ color: 0xe8b890 }), 0, -0.005, -0.15, arm);   // your hand
  box(0.03, 0.05, 0.07, new THREE.MeshLambertMaterial({ color: 0xe8b890 }), -side * 0.06, 0, -0.12, arm);      // and its thumb
  handScene.add(arm);
  return arm;
});
// What each tool looks like in your right hand
const toolModels = (function () {
  const lit = (colour) => new THREE.MeshLambertMaterial({ color: colour });
  const scanner = new THREE.Group();
  box(0.15, 0.08, 0.22, lit(0x5a6070), 0, 0.07, -0.22, scanner);
  box(0.11, 0.01, 0.13, glowPaint(0x7affe0), 0, 0.115, -0.24, scanner);
  box(0.015, 0.12, 0.015, lit(0xd8dce6), 0.05, 0.16, -0.13, scanner);
  const net = new THREE.Group();
  box(0.03, 0.03, 0.6, lit(0x8a5a36), 0, 0.05, -0.38, net);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 18), lit(0xd8dce6));
  hoop.position.set(0, 0.05, -0.82);
  hoop.rotation.x = Math.PI / 2;
  const bag = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, wireframe: true }));
  bag.position.set(0, -0.08, -0.82);
  bag.rotation.x = Math.PI;
  net.add(hoop, bag);
  const builder = new THREE.Group();
  box(0.09, 0.13, 0.24, lit(0xf2c02a), 0, 0.08, -0.22, builder);
  box(0.05, 0.05, 0.14, lit(0x5a6070), 0, 0.1, -0.4, builder);
  box(0.03, 0.03, 0.03, glowPaint(0x7ad8ff), 0, 0.1, -0.48, builder);
  const knife = new THREE.Group();
  box(0.035, 0.035, 0.14, lit(0x2a2e3a), 0, 0.06, -0.2, knife);
  box(0.09, 0.02, 0.02, lit(0xf2c02a), 0, 0.06, -0.28, knife);
  box(0.012, 0.045, 0.26, new THREE.MeshPhongMaterial({ color: 0xe8eef6, shininess: 160 }), 0, 0.06, -0.42, knife);
  for (const model of [scanner, net, builder, knife]) arms[1].add(model);
  return { scanner: scanner, net: net, builder: builder, knife: knife };
})();
function updateHands(dt, light) {
  const shown = mode === "swim" && !player.inSub && !card;
  for (const arm of arms) arm.visible = shown;
  if (!shown) return;
  for (const id in toolModels) toolModels[id].visible = TOOLS[tool].id === id;
  handLight.intensity = 0.4 + light * 0.5;
  const moving = Math.hypot(player.vx, player.vy, player.vz);
  stroke += dt * (1.2 + moving * 0.5);
  if (swing > 0) swing = Math.max(0, swing - dt * 4);
  const reach = Math.sin(swing * Math.PI), holding = TOOLS[tool].id !== "hands";
  arms.forEach(function (arm, n) {
    const side = n ? 1 : -1, busy = n === 1 && holding;
    // Swimming: your arms sweep out and back, like a slow breast-stroke. A hand that holds a tool stays still.
    // (indoors you walk, so your arms just swing a little by your sides)
    const sweep = busy ? 0 : standing ? Math.sin(steps + n * Math.PI) * 0.12 : Math.sin(stroke) * Math.min(1, 0.25 + moving * 0.14), lift = busy ? 0 : standing ? -0.03 : Math.cos(stroke) * 0.02;
    arm.position.set(side * (0.3 + sweep * 0.1), -0.27 + lift + Math.sin(stroke * 0.5 + n) * 0.006 - (n === 1 ? reach * 0.05 : 0), -0.5 - (n === 1 ? reach * 0.16 : 0) + Math.abs(sweep) * 0.05);
    arm.rotation.set(0.12 - (n === 1 ? reach * 0.7 : 0), -side * (0.12 + sweep * 0.5), 0);
  });
}

// R: the sea whistle. A deep note that sends hunting leviathans away for a while.
function blowWhistle() {
  if (!state.gear.whistle) return toast("You have no sea whistle yet. Make one from whalebone and silver.", 3);
  if (clock.value < whistleWait) return toast("You are out of breath! The whistle will be ready in " + Math.ceil(whistleWait - clock.value) + " seconds.", 3);
  scaredUntil = clock.value + 10;
  whistleWait = clock.value + 24;
  sfx.whistle();
  toast("A deep, booming note rolls out through the water. Every leviathan turns away!", 4);
}
// A leviathan has hit the Bubble. Its hull can only take so much...
function hullHit(amount, name) {
  state.hull -= state.gear.hull ? amount * 0.4 : amount;
  shake = 0.7;
  sfx.hurt();
  if (state.hull > 0) return toast("The " + name + " slams into the Bubble! Hull: " + Math.round(state.hull) + "%. Get away" + (state.gear.whistle ? ", or blow your sea whistle (R)!" : "!"), 4);
  for (const kind in state.bag) state.bag[kind] = Math.ceil(state.bag[kind] / 2);
  Object.assign(state, { hull: 40, subAt: null });
  player.inSub = false;
  const lost = lostCount();
  goToRaft();
  showCard(["CRACK! The " + name + " splits the Bubble's hull. Water rushes in...", "You wake up in your pod. The battered Bubble has bobbed up beside you, and the sea kept half of what you were carrying." + lost, "Rest in your pod to mend the hull. A sea whistle, a pearl booster or a Titan hull would help next time!"]);
}

// ----- Keyboard and mouse -----
const keys = {};
let scanning = false;
document.addEventListener("keydown", function (event) {
  if (event.target.tagName === "INPUT") return;
  if (event.code === "Space" || event.code === "Tab" || event.code.startsWith("Arrow")) event.preventDefault();
  if (event.repeat) return;
  keys[event.code] = true;
  if (card) return void ((event.code === "Space" || event.code === "Enter") && nextCard());
  if (mode !== "swim") return;
  if (event.code === "KeyE") placing ? placePart() : interact();
  if (event.code === "KeyB" && el("journal").hidden) toggleBuild();
  if (event.code === "KeyR") blowWhistle();
  if (event.code === "KeyX" && !placing) packUp();
  if (event.code === "Escape" && placing) {
    placing = null;
    ghost.visible = false;
    toast("Not building anything.", 2);
  }
  if (event.code.startsWith("Digit") && Number(event.code.slice(5)) >= 1 && Number(event.code.slice(5)) <= TOOLS.length) pickTool(Number(event.code.slice(5)) - 1);
  if (event.code === "KeyG") eatFish();
  if (event.code === "KeyV") drinkWater();
  if (event.code === "KeyH") firstAid();
  if (event.code === "KeyT") {
    if (!state.gear.torch) toast("You have no torch yet. Make one at your pod.", 3);
    else {
      torchOn = !torchOn;
      sfx.pick();
    }
  }
  if (event.code === "KeyJ") toggleJournal();
});
document.addEventListener("keyup", (event) => (keys[event.code] = false));
canvas.addEventListener("mousedown", function (event) {
  if (mode !== "swim" || card) return;
  if (!TEST && document.pointerLockElement !== canvas) return void canvas.requestPointerLock();
  if (event.button === 0) useTool();
  if (event.button === 2) scanning = true;
});
document.addEventListener("mouseup", () => (scanning = false));
canvas.addEventListener("wheel", function (event) {            // the mouse wheel changes your tool
  if (mode !== "swim" || card) return;
  event.preventDefault();
  pickTool(tool + (event.deltaY > 0 ? 1 : -1), event.deltaY > 0 ? 1 : -1);
}, { passive: false });
document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("mousemove", function (event) {
  if (mode !== "swim" || document.pointerLockElement !== canvas) return;
  player.yaw -= event.movementX * 0.0024;
  player.pitch = clamp(player.pitch - event.movementY * 0.0024, -1.5, 1.5);
});
const lookWay = () => [-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch)];

// ----- Getting hurt -----
function hurt(amount, why) {
  if (mode !== "swim" || card) return;
  player.hp -= state.gear.armour ? amount / 2 : amount;
  shake = 0.35;
  sfx.hurt();
  el("tint").style.boxShadow = "inset 0 0 120px 40px rgba(255, 60, 60, 0.6)";
  setTimeout(() => (el("tint").style.boxShadow = ""), 250);
  if (why) toast(why, 4);
  if (player.hp > 0) return;
  // No strength left: you are pulled back up to your raft, but the sea keeps half of what you were carrying
  for (const kind in state.bag) state.bag[kind] = Math.ceil(state.bag[kind] / 2);
  state.subAt = null;
  player.inSub = false;
  const lost = lostCount();
  [state.food, state.water] = [Math.max(state.food, 50), Math.max(state.water, 50)];
  goToRaft();
  showCard(["Everything goes dark...", "You wake up in your pod, coughing. A friendly current must have carried you home.", "The sea kept half of what you were carrying (but everything in your pod locker is safe)." + lost + " Next time, turn back while you still have plenty of air!"]);
}

// ----- The pod: your home, and your workshop -----
// Stop and rest: in the pod, or (if you say which room) inside your base. (In the code the pod is still called "raft", which is what it used to be.)
let fabOnly = false;          // true when you are using a room's fabricator from outside, in the sea
function goToRaft(room, outside) {
  mode = "raft";
  homeAt = room || null;
  fabOnly = Boolean(room && outside);
  if (!homeAt) inBase = false;
  if (!homeAt) Object.assign(player, { x: 9.5, y: -0.5, z: 0 });
  Object.assign(player, { vx: 0, vy: 0, vz: 0, inSub: false });
  if (!fabOnly) Object.assign(player, { air: maxAir(), hp: Math.max(player.hp, 60) });
  torchOn = false;
  scanning = false;
  placing = null;
  ghost.visible = false;
  if (document.pointerLockElement) document.exitPointerLock();
  el("home-title").textContent = fabOnly ? "Fabricator" : homeAt ? "Your room" : "Your pod";
  el("dive").textContent = fabOnly ? "Back into the sea" : homeAt ? "Back to the room" : "Dive in!";
  el("raft").hidden = false;
  el("fab").hidden = false;
  el("prompt").hidden = true;
  drawRaftMenu();
  save();
}
function drawRaftMenu() {
  // What you can do here: eat, and whatever is special about this room
  const acts = el("room-actions");
  acts.innerHTML = "";
  const offer = function (text, ready, act) {
    const button = document.createElement("button");
    button.textContent = text;
    button.disabled = !ready;
    button.addEventListener("click", function () {
      act();
      drawRaftMenu();
      save();
    });
    acts.appendChild(button);
  };
  offer("Eat a cooked fish (" + state.bag.cooked + " in your bag) · food " + Math.round(state.food) + "%", state.bag.cooked > 0, eatFish);
  offer("Drink a bottle of water (" + state.bag.water + " in your bag) · water " + Math.round(state.water) + "%", state.bag.water > 0, drinkWater);
  // (Your pod has everything. A room has its fabricator, and whatever else you built in it. From outside you can only reach the fabricator.)
  const has = (kind) => !homeAt || kind === "fab" || (!fabOnly && homeAt.items.some((item) => item.kind === kind));
  el("rest").hidden = !has("bed");
  el("rest").textContent = state.time / DAY >= 0.55 ? "Sleep until morning" : "Rest a while";
  // The pod locker: everything you own is listed, with how many are in your bag and how many are in the locker
  el("locker-title").textContent = homeAt ? "Locker" : "Pod locker";
  el("locker-note").textContent = homeAt ? "Every locker in your base is joined to your pod locker by a delivery tube, so they all hold the same things." : "Keep your things here. If you black out, the sea takes half of what is in your bag, but it can never take what is in the locker.";
  el("bag-list").hidden = has("locker");
  el("locker-box").hidden = !has("locker");
  const shelves = el("locker");
  shelves.innerHTML = "";
  for (const kind in LOOT) {
    if (state.bag[kind] + state.locker[kind] === 0) continue;
    const row = document.createElement("div");
    row.className = "shelf";
    row.innerHTML = "<span>" + LOOT[kind].name + "<br>bag " + state.bag[kind] + " · locker " + state.locker[kind] + "</span>";
    for (const [word, from, to] of [["Store", "bag", "locker"], ["Take", "locker", "bag"]]) {
      const button = document.createElement("button");
      button.textContent = word;
      button.disabled = state[from][kind] === 0;
      button.addEventListener("click", function () {
        state[to][kind] += state[from][kind];
        state[from][kind] = 0;
        sfx.pick();
        drawRaftMenu();
        save();
      });
      row.appendChild(button);
    }
    shelves.appendChild(row);
  }
  if (!shelves.children.length) shelves.textContent = "Your locker and your bag are both empty. Dive in and find some shells!";
  // The fabricator makes new gear. In the pod it can use what is in your bag AND what is in the locker.
  const dead = Boolean(homeAt) && state.power < 5;          // (a fabricator in your base needs 5 power for each thing it makes)
  el("fab-body").hidden = !has("fab");
  el("fab-note").textContent = dead ? "NO POWER! This fabricator can't work until your base has power again. (The one in your pod always works.)" : homeAt ? "It uses what is in your bag and in your locker, and 5 power for each thing it makes." : "It uses what is in your bag and in your locker.";
  const stock = (kind) => state.bag[kind] + state.locker[kind];
  const spend = function (needs) {            // (things come out of your bag first, then out of the locker)
    for (const kind in needs) {
      const fromBag = Math.min(state.bag[kind], needs[kind]);
      state.bag[kind] -= fromBag;
      state.locker[kind] -= needs[kind] - fromBag;
    }
  };
  const wants = (needs) => Object.keys(needs).map((kind) => '<span class="' + (stock(kind) >= needs[kind] ? "ok" : "short") + '">' + needs[kind] + " " + LOOT[kind].name.toLowerCase() + "</span>").join(", ");
  // Supplies: things you use up, so you can make them again and again
  const supplies = el("supplies");
  supplies.innerHTML = "";
  for (const supply of SUPPLIES) {
    if (supply.oven && !has("oven")) continue;         // (fish can only be cooked at the pod, or in a room with an oven)
    const button = document.createElement("button");
    button.className = "recipe";
    button.disabled = dead || !Object.keys(supply.needs).every((kind) => stock(kind) >= supply.needs[kind]);
    button.innerHTML = "<b>" + supply.name + "</b> (you have " + stock(supply.id) + ")<br>" + supply.does + "<br>Needs: " + wants(supply.needs);
    button.addEventListener("click", function () {
      spend(supply.needs);
      if (homeAt) state.power -= 5;
      state.bag[supply.id]++;
      sfx.make();
      toast("You made: " + supply.name + ". It is in your bag. " + supply.does, 4);
      drawRaftMenu();
      save();
    });
    supplies.appendChild(button);
  }
  // Base pieces: the fabricator makes them, then you take them out into the sea and put them down with the Builder (B)
  const kits = el("kits");
  kits.innerHTML = "";
  for (const part of BASE_PARTS.filter((each) => each.kit)) {
    const button = document.createElement("button");
    button.className = "recipe";
    button.disabled = dead || !Object.keys(part.needs).every((kind) => stock(kind) >= part.needs[kind]);
    button.innerHTML = "<b>" + part.name + "</b> (you have " + (state.kits[part.id] || 0) + ")<br>" + part.does + "<br>Needs: " + wants(part.needs);
    button.addEventListener("click", function () {
      spend(part.needs);
      if (homeAt) state.power -= 5;
      state.kits[part.id] = (state.kits[part.id] || 0) + 1;
      sfx.make();
      toast("You made a " + part.name.toLowerCase() + ". Take it out into the sea, then press B to put it where you want it.", 6);
      drawRaftMenu();
      save();
    });
    kits.appendChild(button);
  }
  const list = el("recipes");
  list.innerHTML = "";
  for (const recipe of RECIPES) {
    const button = document.createElement("button");
    const made = Boolean(state.gear[recipe.id]), locked = recipe.after && !state.gear[recipe.after];
    const enough = Object.keys(recipe.needs).every((kind) => stock(kind) >= recipe.needs[kind]);
    button.className = "recipe" + (made ? " made" : "");
    button.disabled = made || locked || !enough || dead;
    const needs = wants(recipe.needs);
    button.innerHTML = "<b>" + recipe.name + "</b>" + (made ? " ✓ made" : locked ? " (make the " + RECIPES.find((other) => other.id === recipe.after).name.toLowerCase() + " first)" : "") + "<br>" + recipe.does + (made ? "" : "<br>Needs: " + needs);
    button.addEventListener("click", function () {
      spend(recipe.needs);
      if (homeAt) state.power -= 5;
      state.gear[recipe.id] = true;
      sfx.make();
      toast("You made: " + recipe.name + "! " + recipe.does, 5);
      if (recipe.id === "knife") drawTools();
      if (recipe.id === "bubble") toast("You built the Bubble! It is bobbing beside your pod. Swim up to it and press E to climb in.", 7);
      drawRaftMenu();
      save();
    });
    list.appendChild(button);
  }
  el("bag-list").textContent = "In your bag: " + (Object.keys(LOOT).filter((kind) => state.bag[kind] > 0).map((kind) => LOOT[kind].name + " " + state.bag[kind]).join(", ") || "nothing");
}
el("store-all").addEventListener("click", function () {
  for (const kind in state.bag) [state.locker[kind], state.bag[kind]] = [state.locker[kind] + state.bag[kind], 0];
  sfx.pick();
  drawRaftMenu();
  save();
});
el("rest").addEventListener("click", function () {
  player.hp = 100;
  state.hull = 100;
  sfx.make();
  const where = homeAt ? "You sleep snug in your bunk." : "You sleep in your pod, rocked by the waves.";
  if (state.time / DAY >= 0.55) {
    // In the evening or at night, you sleep right through until sunrise
    newDay();
    toast(where + " Sunrise! You have survived " + state.days + (state.days === 1 ? " day" : " days") + ". You feel strong again, the Bubble is mended, and the sea has washed in new things to find.", 7);
  } else toast("You rest for a while. You feel strong again and the Bubble is mended. (Come back in the evening to sleep until morning.)", 6);
  drawRaftMenu();
  save();
});
el("dive").addEventListener("click", function () {
  el("raft").hidden = true;
  el("fab").hidden = true;
  mode = "swim";
  if (!homeAt) Object.assign(player, { x: 9.8, y: -0.6, z: 0, yaw: -Math.PI / 2, pitch: -0.3 });
  if (!fabOnly) player.air = maxAir();
  sfx.splash();
  if (!TEST) canvas.requestPointerLock();
});
function toggleJournal() {
  const page = el("journal");
  page.hidden = !page.hidden;
  if (page.hidden) return;
  if (document.pointerLockElement) document.exitPointerLock();
  const kinds = Object.keys(SPECIES);
  el("journal-list").innerHTML = "<p>You have scanned " + state.journal.length + " of " + kinds.length + " creatures. Hold the right mouse button (or Q) while you look at one.</p>" +
    kinds.map((kind) => (state.journal.includes(kind) ? "<p><b>" + SPECIES[kind].name + "</b><br>" + SPECIES[kind].text + "</p>" : '<p class="unknown"><b>???</b><br>Not scanned yet. ' + (SPECIES[kind].levi ? "A leviathan: one of the giants of the far sea." : "It lives where the sea is " + SPECIES[kind].depth[0] + " to " + SPECIES[kind].depth[1] + " metres deep.") + "</p>")).join("");
}
el("journal-button").addEventListener("click", toggleJournal);
el("journal-close").addEventListener("click", toggleJournal);
el("build-close").addEventListener("click", toggleBuild);

// ----- Doing things with E -----
// What is close enough to use? (The nearest thing wins.)
function nearby() {
  const near = (place, reach) => Math.hypot(place.x - player.x, (place.y === undefined ? player.y : place.y) - player.y, place.z - player.z) < reach;
  if (!player.inSub && player.y > -4 && Math.hypot(player.x - 8, player.z) < 3.8) return { text: "E: climb into your pod", act: goToRaft };
  const sub = state.subAt || DOCK;
  const room = roomHere();
  if (!player.inSub) for (const part of state.base) {
    if (!isRoom(part)) continue;
    const hatch = hatchOf(part), gapTo = (x, y, z) => Math.hypot(x - player.x, y - player.y, z - player.z);
    if (inBase) {
      // (indoors, the hatch only counts if you are right by it, and nearer to it than to anything you have built)
      const door = { x: hatch.x - hatch.nx * 1.3, y: part.y + 1.6, z: hatch.z - hatch.nz * 1.3 }, thing = room === part ? itemNear(room) : null;
      if (room === part && player.y < part.y + 4 && near(door, 2.1) && !(thing && Math.hypot(room.x + thing.x - player.x, room.z + thing.z - player.z) < Math.hypot(door.x - player.x, door.z - player.z)))
        return { text: "E: go out through the hatch", act: () => useHatch(part) };
    } else {
      // (out in the sea: the fabricator on the wall, or the hatch, whichever you are nearer to)
      const fab = fabOf(part).out, toFab = gapTo(fab.x + hatch.nx * 0.9, fab.y, fab.z + hatch.nz * 0.9), toHatch = gapTo(hatch.x + hatch.nx * 1.2, hatch.y, hatch.z + hatch.nz * 1.2);
      if (toFab < 2.4 && toFab < toHatch) return { text: "E: use the fabricator on the wall", act: () => goToRaft(part, true) };
      if (toHatch < 3.2) return { text: "E: go in through the hatch     X: pack up the whole " + partOf(part.kind).name.toLowerCase(), act: () => useHatch(part) };
    }
  }
  if (room) {
    const item = itemNear(room), pack = item && item.fixed ? "" : "     X: pack it up";
    if (!item) return room.items.length || room.kind === "lookout" ? null : { text: "B: build things inside this room (a locker, a bed, an oven and more)", act: toggleBuild };
    if (item.kind === "fab") return { text: (powered ? "E: use the fabricator" : "The fabricator has no power (E: look anyway)") + pack, act: () => goToRaft(room) };
    if (item.kind === "locker") return { text: "E: open the locker" + pack, act: () => goToRaft(room) };
    if (item.kind === "bed") return { text: "E: rest in your bed" + pack, act: () => goToRaft(room) };
    if (item.kind === "oven") return { text: (state.bag.fish > 0 ? "E: cook " + state.bag.fish + " raw fish in the oven" : "An oven. Bring it raw fish to cook (catch them with the Net)") + pack, act: function () {
      if (state.bag.fish < 1) return toast("You have no raw fish in your bag. Catch some with the Net.", 3);
      if (state.power < 3) return toast("The oven has no power.", 3);
      state.power -= 3;
      toast("Sizzle! " + state.bag.fish + " fish, cooked golden brown. Press G to eat one.", 5);
      state.bag.cooked += state.bag.fish;
      state.bag.fish = 0;
      sfx.make();
    } };
    if (item.kind === "tank") return { text: "E: put a fish in the tank (" + (item.fish || 0) + " of 4 in it)" + pack, act: function () {
      if (state.bag.fish < 1) return toast("You have no raw fish in your bag. Catch one with the Net.", 3);
      if (item.fish >= 4) return toast("The tank is full.", 3);
      item.fish = (item.fish || 0) + 1;
      state.bag.fish--;
      rebuildBase();
      sfx.pick();
      toast("Plop! Your fish swims happily round its new home.", 4);
    } };
    if (item.kind === "planter") return { text: (item.ripe >= 1 ? "E: pick " + Math.floor(item.ripe) + " kelp from the planter" : "The kelp in this planter is still growing") + pack, act: function () {
      if (item.ripe < 1) return;
      state.bag.kelp += Math.floor(item.ripe);
      toast("+" + Math.floor(item.ripe) + " kelp (you have " + state.bag.kelp + ")", 3);
      item.ripe -= Math.floor(item.ripe);
      sfx.pick();
    } };
    if (item.kind === "reactor") return { text: "E: feed the reactor 1 kelp (+15 power)" + pack, act: function () {
      if (state.bag.kelp < 1) return toast("You have no kelp in your bag.", 3);
      if (state.power > powerCap() - 1) return toast("The batteries are full.", 3);
      state.bag.kelp--;
      state.power = Math.min(powerCap(), state.power + 15);
      sfx.make();
      toast("Glub! The reactor hums. Base power: " + Math.round(state.power) + " of " + powerCap() + ".", 3);
    } };
    return { text: "A " + itemOf(item.kind).name.toLowerCase() + pack, act: () => {} };
  }
  if (room) return null;
  for (const part of state.base) {
    if (part.kind === "garden" && part.ripe >= 1 && near({ x: part.x, y: part.y + 1, z: part.z }, 4.5)) return { text: "E: pick " + Math.floor(part.ripe) + " kelp from your garden", act: function () {
      state.bag.kelp += Math.floor(part.ripe);
      toast("+" + Math.floor(part.ripe) + " kelp from your garden (you have " + state.bag.kelp + ")", 3);
      part.ripe -= Math.floor(part.ripe);
      sfx.pick();
    } };
    if (part.kind === "dock" && state.gear.bubble && !player.inSub && near({ x: part.x, y: part.y + 2, z: part.z }, 7) && Math.hypot(sub.x - part.x, sub.z - part.z) > 9) return { text: "E: call the Bubble to this dock", act: function () {
      state.subAt = { x: part.x, y: part.y + 2.6, z: part.z };
      sfx.make();
      toast("The Bubble hums up out of the dark and settles on the dock.", 4);
      save();
    } };
  }
  if (state.gear.bubble && !player.inSub && near(sub, 5)) return { text: "E: climb into the Bubble", act: function () {
    Object.assign(player, { inSub: true, x: sub.x, y: sub.y, z: sub.z });
    sfx.make();
    toast("You are in the Bubble: endless air, and safe from every creature. E: climb out.", 5);
  } };
  for (let n = 0; n < TABLETS.length; n++) {
    if (!state.tablets[n] && near(TABLETS[n], 5)) return { text: "E: read the Tide Tablet", act: function () {
      state.tablets[n] = true;
      sfx.scan();
      const found = state.tablets.filter(Boolean).length;
      showCard([TABLETS[n].text, found === 4 ? "That is all four tablets! Now take them down to the Great Shell, at the very bottom of the Trench." : "You have " + found + " of the 4 Tide Tablets."], save);
    } };
  }
  if (near(HEART, 12)) {
    if (state.won) return null;
    if (state.tablets.includes(false)) return { text: "The Great Shell is shut tight. It needs all four Tide Tablets.", act: () => toast("You need all four Tide Tablets to open the Great Shell.", 4) };
    return { text: "E: hold up the four Tide Tablets", act: function () {
      state.won = true;
      shellOpen = 0.001;
      sfx.win();
      showCard(["The four tablets begin to hum. With a deep, slow groan, the Great Shell opens...", "Inside lies the SEA HEART: a pearl as big as a boat, shining like a second sun. Its light rolls out through the dark water.", "Far above, the creatures of the sea turn towards it. The Trench is not dark any more.", "YOU DID IT! You found the Sea Heart, the greatest secret of the deep. You can keep exploring: can you scan every creature for your journal?"], save);
    } };
  }
  let best = null, bestFar = player.inSub ? 5.5 : 3;
  for (const thing of loot) {
    if (thing.taken || Math.abs(thing.x - player.x) > 6 || Math.abs(thing.z - player.z) > 6) continue;
    const far = Math.hypot(thing.x - player.x, thing.y + 0.3 - player.y, thing.z - player.z);
    if (far < bestFar) [best, bestFar] = [thing, far];
  }
  if (best) return { text: "E: pick up " + LOOT[best.kind].name.toLowerCase(), act: function () {
    best.taken = true;
    showLoot(best, false);
    state.bag[best.kind]++;
    sfx.pick();
    toast("+1 " + LOOT[best.kind].name.toLowerCase() + " (you have " + state.bag[best.kind] + ")", 2);
  } };
  const target = !player.inSub && !inBase && packTarget();
  if (target) return { text: "X: pack up this " + target.name + " (you get everything back)", act: () => {} };
  if (player.inSub) return { text: "E: climb out of the Bubble", act: function () {
    state.subAt = { x: player.x, y: player.y, z: player.z };
    player.inSub = false;
    player.air = maxAir();
    player.y += 1.5;
    sfx.splash();
  } };
  return null;
}
function interact() {
  const thing = nearby();
  if (thing) thing.act();
}

// ----- Walking about indoors -----
let standing = false;        // true while you are on your feet inside a room or a tunnel
let steps = 0;               // (counts up as you walk, to bob the view a little)
// How high is the floor under you? A lookout has a second floor at the top of its tower, and a tunnel's floor slopes from one door to the other.
function floorOf(room, tube) {
  if (room) return room.kind === "lookout" && player.y > room.y + 14.6 ? room.y + 14 : room.y;
  const span = spanOf(tube), dx = span.bx - span.ax, dz = span.bz - span.az;
  const along = clamp(((player.x - span.ax) * dx + (player.z - span.az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return span.ay + (span.by - span.ay) * along - 1.7;
}
function walkIndoors(dt, ahead, across) {
  // W and S walk the way you are facing (level with the floor), A and D step sideways, Shift runs
  const wx = -Math.sin(player.yaw) * ahead + Math.cos(player.yaw) * across, wz = -Math.cos(player.yaw) * ahead - Math.sin(player.yaw) * across;
  const length = Math.hypot(wx, wz) || 1, speed = ahead || across ? (keys.ShiftLeft || keys.ShiftRight ? 7 : 4.5) : 0;
  player.vx += ((wx / length) * speed - player.vx) * Math.min(1, dt * 10);
  player.vz += ((wz / length) * speed - player.vz) * Math.min(1, dt * 10);
  // The walls are solid: a step only counts if it ends up inside a room or a tunnel. (If you walk into a wall at a slant, you slide along it.)
  const inside = (x, y, z) => Boolean(roomAt(x, y, z) || tunnelAt(x, y, z));
  const nx = player.x + player.vx * dt, nz = player.z + player.vz * dt;
  if (inside(nx, player.y, nz)) [player.x, player.z] = [nx, nz];
  else if (inside(nx, player.y, player.z)) [player.x, player.vz] = [nx, 0];
  else if (inside(player.x, player.y, nz)) [player.z, player.vx] = [nz, 0];
  else player.vx = player.vz = 0;
  steps += dt * Math.hypot(player.vx, player.vz) * 1.6;
  // Your eyes are 1.6 metres above the floor. Gravity pulls you down on to it, and it stops you there.
  const room = roomAt(player.x, player.y, player.z), tube = room ? null : tunnelAt(player.x, player.y, player.z);
  if (!room && !tube) return;
  const eye = floorOf(room, tube) + 1.6, tower = room && room.kind === "lookout";
  const climbing = tower && (keys.Space || keys.KeyC || keys.ControlLeft);
  if (climbing) player.vy = keys.Space ? 5 : -5;                 // (in a lookout, Space and C climb the rungs up and down)
  else if (tower && player.y > eye + 0.05 && player.y < room.y + 14.6) player.vy = 0;        // (part way up, you hold on to the ladder)
  else if (player.y <= eye + 0.02) player.vy = keys.Space ? 5.5 : 0;        // on the floor: Space is a little jump
  else player.vy -= 20 * dt;
  let ny = player.y + player.vy * dt;
  const roof = room ? room.y + (tower ? 18.6 : HIGH - 0.4) : eye + 0.9;          // (you can't go up through the ceiling)
  if (ny > roof) [ny, player.vy] = [roof, Math.min(0, player.vy)];
  if (ny < eye && !(tower && (keys.KeyC || keys.ControlLeft))) ny = Math.min(eye, ny + Math.max(dt * 8, (eye - ny) * Math.min(1, dt * 12)));
  if (inside(player.x, ny, player.z)) player.y = ny;
  else player.vy = 0;
}

// ----- Swimming -----
function swim(dt) {
  const ahead = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), across = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const rise = (keys.Space ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0);
  player.yaw -= ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 1.8 * dt;          // (the left and right arrows turn you, if you would rather not use the mouse)
  const boost = state.gear.zipfin && (keys.ShiftLeft || keys.ShiftRight) && !player.inSub;
  // Inside a room or a tunnel there is air, so you stand on the floor and walk about instead of swimming
  if (inBase && !roomHere() && !tunnelHere()) inBase = false;          // (the room you were in has been packed up)
  standing = inBase;
  if (standing) walkIndoors(dt, ahead, across);
  else {
    const way = lookWay(), side = [Math.cos(player.yaw), 0, -Math.sin(player.yaw)];
    const wx = way[0] * ahead + side[0] * across, wy = way[1] * ahead + rise, wz = way[2] * ahead + side[2] * across;
    const length = Math.hypot(wx, wy, wz) || 1;
    const speed = player.inSub ? (state.gear.booster ? 21 : 12) : (state.gear.flippers ? 7 : 5) * (boost ? 1.9 : 1);
    const want = ahead || across || rise ? speed : 0;
    player.vx += ((wx / length) * want - player.vx) * Math.min(1, dt * 3);
    player.vy += ((wy / length) * want - player.vy) * Math.min(1, dt * 3);
    player.vz += ((wz / length) * want - player.vz) * Math.min(1, dt * 3);
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.z += player.vz * dt;
    keepOut();
  }
  // You can't swim through the sea bed, above the waves, or out of this part of the sea
  const floor = -depthAt(player.x, player.z) + (player.inSub ? 2 : 0.9), top = player.inSub ? -1.6 : 0.25;
  if (player.y < floor) [player.y, player.vy] = [floor, Math.max(0, player.vy)];
  if (player.y > top) [player.y, player.vy] = [top, Math.min(0, player.vy)];
  const far = Math.hypot(player.x, player.z);
  if (far > WORLD - 4) {
    player.x *= (WORLD - 4) / far;
    player.z *= (WORLD - 4) / far;
    if (clock.value > warned) {
      warned = clock.value + 5;
      toast("A strong current pushes you back. This is as far as you can go.", 3);
    }
  }
  const raftGap = Math.hypot(player.x, player.z);
  if (player.y > -4.6 && raftGap < 6.6 && raftGap > 0.01) {       // (the pod is in the way)
    player.x *= 6.6 / raftGap;
    player.z *= 6.6 / raftGap;
  }
  // Air: it runs down under water, and fills up again at the top (or inside the Bubble)
  const inside = indoors();                              // (the rooms and tunnels of your base are full of air, and keep the squeeze of the deep out)
  const under = player.y < -0.35 && !player.inSub && !inside;
  const stale = inside && !powered;                      // (a base with no power can't make fresh air)
  if (under) player.air -= dt * (clock.value < fedUntil ? 0.65 : 1);
  else if (stale) {
    player.air -= dt * 0.5;
    if (clock.value > warned) {
      warned = clock.value + 12;
      sfx.warn();
      toast("NO POWER! The lights are out and the air in here is going stale. Make a solar panel at your pod's fabricator and put it outside, or feed a kelp reactor.", 6);
    }
  } else player.air = Math.min(maxAir(), player.air + dt * 30);
  if (under && Math.random() < dt * (boost ? 8 : 2.5)) blowBubble();
  if (player.air <= 0) {
    player.air = 0;
    player.hp -= 11 * dt;
    if (clock.value > airBeep) {
      airBeep = clock.value + 1.2;
      hurt(0.01, stale ? "You are out of air! Get out and swim up, quickly!" : "You are out of air! Swim up, quickly!");
    }
  } else if (player.air < 12 && (under || stale) && clock.value > airBeep) {
    airBeep = clock.value + 2;
    sfx.warn();
    toast(stale ? "Your air is running low, and this base has no power to make more!" : "Your air is running low! Head for the surface.", 2);
  }
  if (!under && player.hp < 100) player.hp = Math.min(100, player.hp + dt * 2);
  // Going deeper than your gear allows squeezes you
  const deep = inside ? 0 : -player.y;
  if (deep > depthLimit()) {
    player.hp -= 7 * dt;
    if (clock.value > warned) {
      warned = clock.value + 2.5;
      hurt(0.01, player.inSub ? "Even the Bubble can't go any deeper!" : state.gear.suit ? "Too deep, even for your deep suit! Only the Bubble can go further down." : "Too deep! The water is squeezing you. Swim up, or make a deep suit.");
    }
  } else if (deep > depthLimit() - 8 && clock.value > warned) {
    warned = clock.value + 6;
    sfx.warn();
    toast("Careful: you are almost as deep as your " + (player.inSub ? "Bubble" : state.gear.suit ? "deep suit" : "body") + " can go (" + depthLimit() + " metres).", 3);
  }
  if (player.hp <= 0) hurt(0.01);
}
function bubbleAt(x, y, z, size, life) {
  const bubble = bubbles.find((each) => each.userData.life <= 0);
  if (!bubble) return;
  bubble.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
  bubble.scale.setScalar(size * (0.5 + Math.random()));
  bubble.userData = { life: life, drift: Math.random() * 6 };
  bubble.visible = true;
}
function blowBubble() {
  const way = lookWay();
  bubbleAt(player.x + way[0] * 1.1, player.y + way[1] * 1.1 - 0.35, player.z + way[2] * 1.1, 0.6, 2.5);       // (a little way in front of your mask, so they don't fill your view)
  if (Math.random() < 0.25) sfx.bubble();
}

// ----- How the creatures behave -----
function updateCreatures(dt) {
  const way = lookWay(), sheltered = indoors(), swimming = mode === "swim" && !card && !sheltered;
  const bolder = 1 + (1 - sunUp()) * 0.35;         // at night, the hunters notice you from further away
  const lamps = state.base.filter((part) => part.kind === "lamp"), rooms = state.base.filter(isRoom);
  for (const c of creatures) {
    const spec = c.spec, model = c.model;
    const dx = player.x - c.x, dy = player.y - c.y, dz = player.z - c.z, far = Math.hypot(dx, dy, dz);
    c.far = far;
    if (c.gone > 0) {                    // (caught in your net: another fish turns up at its home after a while)
      c.gone -= dt;
      model.group.visible = false;
      if (c.gone <= 0) Object.assign(c, { x: c.home.x, z: c.home.z, y: -depthAt(c.home.x, c.home.z) + 2, goal: null });
      continue;
    }
    const seen = far < (spec.levi ? 330 : 190);
    model.group.visible = seen;
    if (!seen && !spec.giant && !spec.levi) continue;          // (too far away to matter)
    c.timer -= dt;
    c.cool -= dt;
    c.hunting = false;
    let speed = spec.speed, turning = spec.giant ? 0.35 : spec.levi ? 0.9 : 2.4;
    // A leviathan that hunts makes the sea feel uneasy long before you see it
    if (spec.levi && spec.hunter && swimming && far < spec.hunter.range * bolder + 35 && clock.value > leviWarn) {
      leviWarn = clock.value + 28;
      shake = 0.3;
      sfx.rumble();
      toast("The water trembles. Something ENORMOUS is moving out there" + (state.journal.includes(c.kind) ? ": the " + spec.name + "!" : "...") + (state.gear.whistle ? " (R: sea whistle)" : ""), 5);
    }
    if (spec.giant) {
      // Old Blue swims a great slow circle round the raft
      const round = Math.atan2(c.z, c.x) + 0.2;
      c.goal = { x: Math.cos(round) * 235, y: -34, z: Math.sin(round) * 235 };
    } else if (spec.levi && spec.hunter && clock.value < scaredUntil && far < 140) {
      c.goal = { x: c.x - dx * 3, y: c.y - dy, z: c.z - dz * 3 };             // your sea whistle sends it away
      speed = spec.hunter.speed;
      c.timer = 1;
    } else if (c.scare > clock.value) {
      c.goal = { x: c.x - dx * 3, y: c.y - dy * 2, z: c.z - dz * 3 };         // (it has just been jabbed with your knife)
      speed = (spec.hunter ? spec.hunter.speed : spec.speed * 2.3) * 1.1;
      c.timer = 1;
    } else if (spec.hunter && swimming && far < spec.hunter.range * bolder) {
      c.hunting = true;
      const lit = spec.hunter.fearsTorch && ((torchOn && far < (state.gear.lens ? 30 : 18) && (-dx * way[0] - dy * way[1] - dz * way[2]) / far > 0.84) || lamps.some((lamp) => Math.hypot(lamp.x - c.x, lamp.y - c.y, lamp.z - c.z) < 16));
      if (lit) {
        c.goal = { x: c.x - dx * 3, y: c.y - dy * 3, z: c.z - dz * 3 };       // dazzled by your torch: it flees
        speed = spec.hunter.speed * 1.2;
      } else {
        c.goal = { x: player.x, y: player.y, z: player.z };
        speed = spec.hunter.speed;
        if (far < spec.hunter.reach && c.cool <= 0) {
          c.cool = spec.hunter.wait;
          if (player.inSub && spec.levi) hullHit(spec.hunter.hull, spec.name);
          else if (player.inSub) {
            shake = 0.4;
            sfx.hurt();
            toast("A " + spec.name + " bumps the Bubble, but it can't get in!", 3);
          } else hurt(spec.hunter.bite, "A " + spec.name + " bit you! " + (spec.hunter.fearsTorch ? "Shine your torch at it, or swim away." : "Get away from it!"));
        }
      }
      c.timer = 1;
    } else if (spec.shy && swimming && far < 5.5) {
      c.goal = { x: c.x - dx * 3, y: c.y - dy * 2, z: c.z - dz * 3 };
      speed = spec.speed * 2.3;
      c.timer = 0.8;
    } else if (c.leader) {
      c.goal = { x: c.leader.x + c.off[0], y: c.leader.y + c.off[1], z: c.leader.z + c.off[2] };
      speed = spec.speed * 1.15;
    } else if (c.timer <= 0 || !c.goal) {
      // Wander: pick somewhere new to swim to, not far from home
      const angle = Math.random() * 6.283, out = Math.random() * (spec.roam || 22);
      const gx = c.home.x + Math.cos(angle) * out, gz = c.home.z + Math.sin(angle) * out, deep = depthAt(gx, gz);
      c.goal = { x: gx, z: gz, y: -deep + 1.2 + Math.random() * deep * (spec.rise || 0) * 0.8 };
      c.timer = 4 + Math.random() * 6;
    }
    // Jellyfish sting if you touch them. A giant one's arms hang a long way down, so never swim underneath it.
    const touching = spec.tall ? Math.hypot(dx, dz) < spec.size * 0.95 && dy < spec.size && dy > -spec.size * spec.tall : far < spec.size * 1.7;
    if (spec.jelly && swimming && !player.inSub && touching && c.cool <= 0) {      // ("swimming" is false inside your base: nothing can sting you there)
      c.cool = 2;
      hurt(spec.sting || 12, "A " + spec.name + " stung you! Swim round them, not through them.");
    }
    if (spec.puffs) c.puff += ((far < 6 ? 1.8 : 1) - c.puff) * Math.min(1, dt * 5);
    // Turn towards the goal, then swim forwards
    const gx = c.goal.x - c.x, gy = c.goal.y - c.y, gz = c.goal.z - c.z, flat = Math.hypot(gx, gz);
    let turn = Math.atan2(gx, gz) - c.yaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    c.yaw += clamp(turn, -turning * dt, turning * dt);
    c.pitch += (clamp(Math.atan2(gy, flat || 1), -0.7, 0.7) - c.pitch) * Math.min(1, dt * 2);
    if (flat + Math.abs(gy) < 1.5 && !spec.hunter) speed *= 0.3;
    if (spec.jelly) speed = spec.speed * (0.4 + Math.max(0, Math.sin(clock.value * 1.6 + c.phase)));      // jellyfish swim in pulses
    c.x += Math.sin(c.yaw) * Math.cos(c.pitch) * speed * dt;
    c.z += Math.cos(c.yaw) * Math.cos(c.pitch) * speed * dt;
    c.y += Math.sin(c.pitch) * speed * dt;
    for (const part of rooms) {              // (nothing swims into your rooms: they are nudged round the outside)
      const gx = c.x - part.x, gz = c.z - part.z, gap = Math.hypot(gx, gz) || 1, need = (part.kind === "lookout" ? 6.5 : ROOM * 1.42 + 0.5) + spec.size * 0.6;
      if (gap < need && c.y > part.y - 3 && c.y < part.y + (part.kind === "lookout" ? 22 : HIGH + 2)) [c.x, c.z, c.timer] = [part.x + (gx / gap) * need, part.z + (gz / gap) * need, 0];
    }
    const floor = -depthAt(c.x, c.z) + (spec.crawl ? 0.05 : spec.size * (spec.tall || 0.7) + 0.4);
    c.y = spec.crawl ? floor : clamp(c.y, floor, -spec.size * 0.8 - 0.6);
    // Show it: tails wag, wings flap, jellyfish pulse
    model.group.position.set(c.x, c.y, c.z);
    model.group.rotation.set(spec.jelly || spec.crawl ? 0 : -c.pitch, c.yaw, 0);
    const beat = clock.value * (2 + speed * 1.6) + c.phase;
    if (model.tail) model.tail.rotation[model.flatTail ? "x" : "y"] = Math.sin(beat) * (model.flatTail ? 0.3 : 0.5);
    if (model.jaw) model.jaw.rotation.x = 0.1 + (c.hunting ? 0.6 : 0.16) * (0.5 + 0.5 * Math.sin(clock.value * (c.hunting ? 5 : 1.1) + c.phase));       // the Gapejaw's mouth yawns open, and snaps when it hunts
    if (model.wings) model.wings.forEach((wing, n) => (wing.rotation.z = Math.sin(beat * 0.5) * 0.45 * (n ? -1 : 1)));
    const pulse = spec.jelly ? 1 + Math.sin(clock.value * 1.6 + c.phase) * 0.12 : 1;
    model.group.scale.set(spec.size * c.puff * pulse, spec.size * c.puff * (2 - pulse), spec.size * c.puff * pulse);
    if (c.links) {
      // Each ball of the Tidewyrm's body is pulled along behind the one in front
      let px = c.x - Math.sin(c.yaw) * spec.size * 0.7, py = c.y, pz = c.z - Math.cos(c.yaw) * spec.size * 0.7;
      for (const link of c.links) {
        const lx = link.position.x - px, ly = link.position.y - py, lz = link.position.z - pz, gap = Math.hypot(lx, ly, lz) || 1, want = spec.size * 0.5;
        link.position.set(px + (lx / gap) * want, py + (ly / gap) * want + Math.sin(clock.value * 2 + px * 0.1) * 0.02, pz + (lz / gap) * want);
        link.lookAt(px, py, pz);
        link.visible = seen;
        [px, py, pz] = [link.position.x, link.position.y, link.position.z];
      }
    }
    if (c.tentacles) c.tentacles.forEach(function (arm, a) {
      // The Kraken's arms trail out behind it in a ring, each one waving
      const round = (a / c.tentacles.length) * 6.283, sideX = Math.cos(c.yaw), sideZ = -Math.sin(c.yaw);
      arm.forEach(function (link, n) {
        const out = spec.size * (0.7 + n * 0.32), spread = spec.size * 0.36 + Math.sin(clock.value * 1.4 + n * 0.55 + a * 1.3) * spec.size * 0.06 * (n + 1);
        link.position.set(c.x - Math.sin(c.yaw) * out + sideX * Math.cos(round) * spread, c.y + Math.sin(round) * spread, c.z - Math.cos(c.yaw) * out + sideZ * Math.cos(round) * spread);
        link.visible = seen;
      });
    });
  }
}

// ----- Scanning: hold the right mouse button (or Q) while you look at a creature -----
function updateScan(dt) {
  const wanting = (scanning || keys.KeyQ) && mode === "swim" && !card;
  let seen = null, best = 0.94;
  if (wanting) {
    const way = lookWay();
    for (const c of creatures) {
      if (c.far > 9 + c.spec.size * 4) continue;
      const lined = ((c.x - player.x) * way[0] + (c.y - player.y) * way[1] + (c.z - player.z) * way[2]) / c.far;
      if (lined > best - Math.min(0.12, c.spec.size * 0.03)) [seen, best] = [c, lined];
    }
  }
  scanTime = seen ? scanTime + dt : 0;
  el("scan").hidden = !wanting;
  el("scan-fill").style.width = Math.min(100, (scanTime / 1.3) * 100) + "%";
  el("scan-text").textContent = !wanting ? "" : seen ? "Scanning..." : "Point at a creature (get close)";
  if (seen && scanTime >= 1.3) {
    scanTime = 0;
    scanning = false;
    keys.KeyQ = false;
    sfx.scan();
    if (state.journal.includes(seen.kind)) toast(seen.spec.name + ": already in your sea journal (J).", 3);
    else {
      state.journal.push(seen.kind);
      toast("NEW in your sea journal: " + seen.spec.name + "! (" + state.journal.length + " of " + Object.keys(SPECIES).length + ". Press J to read it.)", 6);
      save();
    }
  }
}

// ----- The words on the screen -----
function goalText() {
  if (state.won) return "You found the Sea Heart! Keep exploring: can you scan every creature?";
  const found = state.tablets.filter(Boolean).length;
  if (found === 4) return "You have all four Tide Tablets! Take them to the Great Shell at the bottom of the Trench.";
  return "Find the four Tide Tablets (" + found + " of 4). The next one is by " + TABLETS[state.tablets.indexOf(false)].name + ".";
}
// Which way is a place, compared with the way you are facing? (An arrow, and how far.)
function pointer(place, name) {
  const dx = place.x - player.x, dz = place.z - player.z, far = Math.hypot(dx, dz);
  let turn = Math.atan2(-dx, -dz) - player.yaw;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  const arrow = ["↑", "↖", "←", "↙", "↓", "↘", "→", "↗"][((Math.round(turn / (Math.PI / 4)) % 8) + 8) % 8];
  const down = place.y === undefined ? "" : place.y < player.y - 3 ? ", " + Math.round(player.y - place.y) + " m below you" : place.y > player.y + 3 ? ", " + Math.round(place.y - player.y) + " m above you" : "";
  return name + " " + arrow + " " + Math.round(far) + " m" + down;
}
// From inside a lookout, your compass shows the nearest leviathan that hunts
function lookoutSees() {
  const room = mode === "swim" ? roomHere() : null;
  return room && room.kind === "lookout" ? creatures.filter((c) => c.spec.levi && c.spec.hunter).sort((a, b) => a.far - b.far)[0] : null;
}
const nearestRoom = () => state.base.filter(isRoom).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0] || null;
function updateHud() {
  const air = Math.ceil(player.air), deep = Math.max(0, -player.y);
  el("air-fill").style.width = (player.air / maxAir()) * 100 + "%";
  el("air-fill").style.background = player.air < 12 ? "#ff5a5a" : "#7ad8ff";
  el("air-text").textContent = player.inSub ? "Air: endless · Bubble hull " + Math.round(state.hull) + "%" : indoors() && powered ? "Air: endless (in your base)" : "Air: " + air + " s" + (indoors() ? " · NO POWER" : "") + (clock.value < fedUntil ? " · well fed" : "");
  el("hp-fill").style.width = clamp(player.hp, 0, 100) + "%";
  el("food-fill").style.width = state.food + "%";
  el("water-fill").style.width = state.water + "%";
  el("depth").textContent = Math.round(deep) + " m deep · " + ZONES[zoneAt(player.x, player.z)].name + " · you can go to " + depthLimit() + " m";
  el("bag").textContent = Object.keys(LOOT).filter((kind) => state.bag[kind] > 0).map((kind) => LOOT[kind].name + " " + state.bag[kind]).join(" · ") || "Nothing in your bag yet";
  el("goal").textContent = goalText();
  const cap = powerCap();
  el("power").textContent = cap ? "⚡ Base power: " + Math.round(state.power) + " of " + cap + (powerMade() >= powerUsed() ? " ▲" : " ▼") : "";
  el("power").style.color = powered ? "#7affe0" : "#ff9a8a";
  el("days").textContent = "Days survived: " + state.days + (state.best > state.days ? " (best " + state.best + ")" : "") + " · " + timeName();
  const next = state.won ? null : state.tablets.includes(false) ? TABLETS[state.tablets.indexOf(false)] : HEART;
  el("compass").textContent = pointer({ x: 8, z: 0, y: 0 }, "Pod") + (next ? "     " + pointer(next, state.tablets.includes(false) ? "Tablet" : "Great Shell") : "") + (state.gear.bubble && !player.inSub ? "     " + pointer(state.subAt || DOCK, "Bubble") : "") + (nearestRoom() ? "     " + pointer(nearestRoom(), "Base") : "") + (lookoutSees() ? "     " + pointer(lookoutSees(), lookoutSees().spec.name) : "");
  const thing = mode === "swim" && !card ? nearby() : null;
  const spotNow = placing && mode === "swim" ? buildSpot() : null;
  el("prompt").textContent = spotNow ? spotNow.why || "E: build the " + placing.name.toLowerCase() + " here     Esc: cancel" : thing ? thing.text : "";
  el("prompt").hidden = !thing && !spotNow;
  el("cockpit").hidden = !player.inSub || mode !== "swim";
  for (const id of ["meters", "depth", "compass", "bag", "crosshair", "tools", "days", "power"]) el(id).style.visibility = mode === "swim" ? "visible" : "hidden";
  el("tint").style.background = player.air < 10 && !player.inSub && mode === "swim" ? "radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, " + (0.85 - player.air * 0.06) + "))"
    : mode === "swim" && player.y < -0.3 ? "radial-gradient(ellipse at center, transparent 55%, rgba(0, 12, 24, 0.5))" : "";        // (the edges of your mask are a little dark)
}

// ----- Everything that happens, many times a second -----
const DEEP_BLUE = [new THREE.Color(0x27bcd2), new THREE.Color(0x0b3f72), new THREE.Color(0x030716)], SKY = new THREE.Color(0x9fd8ff);
const NIGHT_SKY = new THREE.Color(0x060c22), SUNSET = new THREE.Color(0xff9a5a), sunWay = new THREE.Vector3();
function update(dt) {
  clock.value += dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) el("toast").hidden = true;
  if (mode === "swim" && !card && el("journal").hidden && el("build").hidden) {
    swim(dt);
    if (mode === "swim") passTime(dt);
    if (mode === "swim") getHungry(dt);
    if (mode === "swim") runPower(dt);
  }
  updateCreatures(dt);
  updateScan(dt);
  // The camera: your eyes when you swim, or a slow look round from the raft
  if (mode === "swim") {
    camera.position.set(player.x, player.y + (standing ? Math.sin(steps) * 0.045 : 0), player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  } else {
    const about = homeAt ? { x: homeAt.x, y: homeAt.y + 3, z: homeAt.z } : { x: 0, y: 1.5, z: 0 };       // (a slow look round your pod, or your base)
    const back = homeAt ? 26 : 18;
    camera.position.set(about.x + Math.cos(clock.value * 0.1) * back, about.y + (homeAt ? 7 : 4.5), about.z + Math.sin(clock.value * 0.1) * back);
    camera.lookAt(about.x, about.y, about.z);
  }
  if (shake > 0) {
    shake -= dt;
    camera.position.x += (Math.random() - 0.5) * shake * 0.4;
    camera.position.y += (Math.random() - 0.5) * shake * 0.4;
  }
  // The colour of the water and how much light there is both depend on how deep the camera is
  const eye = camera.position.y, deep = Math.max(0, -eye), part = clamp(deep / 150, 0, 1);
  const water = part < 0.5 ? DEEP_BLUE[0].clone().lerp(DEEP_BLUE[1], part * 2) : DEEP_BLUE[1].clone().lerp(DEEP_BLUE[2], part * 2 - 1);
  if (state.won) water.lerp(new THREE.Color(0x2a6a8a), 0.35 * part);           // (the Sea Heart lights up the deep)
  // Day and night: "day" is 1 in full daylight and 0 at night. At sunrise and sunset the sky turns orange.
  const day = sunUp(), glowing = day * (1 - day) * 4;
  water.multiplyScalar(mix(0.2, 1, day)).lerp(SUNSET, glowing * 0.12 * (1 - part));
  const sky = SKY.clone().lerp(NIGHT_SKY, 1 - day).lerp(SUNSET, glowing * 0.5);
  const colour = eye > 0 ? sky : water;
  nightGlow.value = (1 - day) * 0.5;
  scene.fog.color.copy(colour);
  const here = mode === "swim" ? roomHere() : null;
  scene.fog.density = (eye > 0 ? 0.0022 : mix(0.02, 0.034, part)) * (here && here.kind === "lookout" ? 0.4 : 1);       // (from a lookout you can see much further)
  renderer.setClearColor(colour);
  let light = (eye > 0 ? 0.85 : mix(0.8, state.won ? 0.3 : 0.1, part)) * mix(eye > 0 ? 0.4 : 0.24, 1, day);
  podGlass.emissive.set(0xffd070).multiplyScalar(1 - day);
  if ((mode === "swim" ? standing : homeAt) && powered) light = Math.max(light, 0.62);          // (the lamps inside your base are on, while there is power)
  windowGlow.color.set(powered ? 0xffe9a0 : 0x1c2630);
  roomLamp.color.set(powered ? 0xfff0a0 : 0x3a4048);
  for (const [material, colour] of screens) material.color.set(powered ? colour : 0x1a2028);
  const sun = (eye > 0 ? 0.7 : mix(0.6, 0, Math.min(1, part * 1.6))) * day;
  skyLight.intensity = light;
  sunLight.intensity = sun + (1 - day) * 0.07;          // (at night, a little moonlight)
  // The sun climbs up one side of the sky and goes down the other. At night the moon does the same.
  const across = day > 0 ? clamp(state.time / (DAY * 0.68), 0, 1) : (state.time / DAY - 0.68) / 0.32;
  sunWay.set(Math.cos(across * Math.PI) * 0.9, Math.sin(across * Math.PI) * 0.85 + 0.12, 0.35).normalize();
  sunLight.position.copy(sunWay);
  sunDisc.visible = day > 0;
  moonDisc.visible = day < 1 && eye > 0;
  (day > 0 ? sunDisc : moonDisc).position.copy(camera.position).addScaledVector(sunWay, 560);
  sunDisc.lookAt(camera.position);
  moonDisc.lookAt(camera.position);
  sunDisc.material.color.set(0xfff6c8).lerp(SUNSET, glowing * 0.7);
  stars.visible = eye > 0 && day < 0.9;
  stars.material.opacity = 1 - day;
  stars.position.copy(camera.position);
  const lamps = mode === "swim" && (player.inSub || (torchOn && state.gear.torch));
  torch.intensity = lamps ? (player.inSub ? 1.5 : 1.2) : 0;
  torch.angle = player.inSub ? 0.75 : 0.5;
  torch.distance = state.gear.lens ? 140 : 70;
  const u = seaBed.uniforms, way = lookWay();
  u.fogColor.value.copy(colour);
  u.fogDensity.value = scene.fog.density;
  u.light.value = light;
  u.sun.value = sun;
  u.torchOn.value = (lamps ? (player.inSub ? 1.5 : 1) : 0) * (state.gear.lens ? 1.5 : 1);
  // Your base: the nearest sea lamp lights the ground round it, gardens grow, and the ghost shows where a new piece will go
  const lamp = state.base.filter((part) => part.kind === "lamp" || partOf(part.kind).room).sort((a, b) => Math.hypot(a.x - camera.position.x, a.z - camera.position.z) - Math.hypot(b.x - camera.position.x, b.z - camera.position.z))[0];
  u.lampOn.value = lamp ? 1 : 0;
  if (lamp) u.lampAt.value.set(lamp.x, lamp.y + 3.4, lamp.z);
  baseLight.intensity = lamp ? 0.6 : 0;
  if (lamp) baseLight.position.set(lamp.x, lamp.y + 3.4, lamp.z);
  for (const part of state.base) {
    if (part.kind === "garden") part.ripe = Math.min(5, (part.ripe || 0) + dt / 40);
    for (const item of part.items || []) if (item.kind === "planter") item.ripe = Math.min(5, (item.ripe || 0) + dt / 20);
  }
  for (const model of baseModels) {
    for (const swimmers of model.userData.spin || []) swimmers.rotation.y = clock.value * 0.5;       // the fish in a tank swim round and round
    if (model.userData.flash) model.userData.flash[1].material.opacity = 0.22 + 0.2 * Math.sin(clock.value * 3);       // a beacon's beam pulses
  }
  updateHands(dt, light);
  ghost.visible = Boolean(placing) && mode === "swim";
  if (ghost.visible) {
    const at = buildSpot(), big = placing.room || placing.id === "poles", wide = big ? ROOM : placing.item ? 0.8 : 1.3, tall = big ? HIGH : placing.item ? 1.6 : 3;
    ghost.geometry = big || placing.item ? GHOST_SQUARE : GHOST_ROUND;
    ghost.position.set(at.x, at.y + tall / 2, at.z);
    ghost.scale.set(wide, tall, wide);
    ghost.material.color.set(at.why ? 0xff5a5a : 0x7affa0);
  }
  // Bubbles stream up from the hot vents
  for (const vent of decor.vent) if (Math.abs(vent.x - camera.position.x) < 70 && Math.abs(vent.z - camera.position.z) < 70 && Math.random() < dt * 3) bubbleAt(vent.x, vent.y + 4.6 * vent.size, vent.z, 2.2, 5);
  u.torchAt.value.copy(camera.position);
  u.torchWay.value.set(way[0], way[1], way[2]);
  surface.position.set(camera.position.x, 0, camera.position.z);
  surfacePaint.uniforms.eye.value.copy(camera.position);
  surfacePaint.uniforms.below.value = eye > 0 ? 0 : 1;
  surfacePaint.uniforms.dull.value.set(eye > 0 ? 0x2a8ac0 : 0x5ac8e8).multiplyScalar(mix(0.16, 1, day));
  surfacePaint.uniforms.bright.value.set(eye > 0 ? 0x58b8e0 : 0xf0ffff).multiplyScalar(mix(0.22, 1, day)).lerp(SUNSET, glowing * 0.35);
  surfacePaint.uniforms.see.value = eye > 0 ? 0.88 : 0.7 * (1 - Math.min(1, deep / 70));
  surfacePaint.uniforms.reach.value = eye > 0 ? 1400 : 230;
  waterBall.position.copy(camera.position);
  waterBall.material.uniforms.middle.value.copy(colour);
  waterBall.material.uniforms.top.value.copy(eye > 0 ? new THREE.Color(0x4a9ae8).lerp(new THREE.Color(0x02040e), 1 - day) : colour.clone().lerp(new THREE.Color(0xd0f8ff), 0.6 * (1 - part) * day));
  waterBall.material.uniforms.bottom.value.copy(eye > 0 ? new THREE.Color(0x2f8ac0).multiplyScalar(mix(0.2, 1, day)) : colour.clone().multiplyScalar(0.4));
  // Little drifting lights: in the deep, and everywhere at night
  motes.visible = eye < 0 && (deep > 45 || day < 0.5);
  motes.material.opacity = Math.max(Math.min(0.9, (deep - 45) / 60), (1 - day) * 0.75);
  motes.position.set(Math.round(camera.position.x / 40) * 40, Math.round(camera.position.y / 30) * 30, Math.round(camera.position.z / 40) * 40);
  beams.forEach(function (beam, n) {
    beam.visible = eye < 0 && deep < 65 && day > 0.05;
    beam.position.set(camera.position.x + beam.userData.x + Math.sin(clock.value * 0.3 + n) * 2, -36, camera.position.z + beam.userData.z);
    beam.material.opacity = 0.06 * day * (1 - deep / 65) * (0.65 + Math.sin(clock.value * 0.8 + n * 2) * 0.35);
  });
  specks.visible = eye < 0;
  specks.position.set(Math.round(camera.position.x / 30) * 30, Math.round(camera.position.y / 20) * 20, Math.round(camera.position.z / 30) * 30);
  for (const bubble of bubbles) {
    if (bubble.userData.life <= 0) continue;
    bubble.userData.life -= dt;
    bubble.position.y += dt * 2.2;
    bubble.position.x += Math.sin(clock.value * 4 + bubble.userData.drift) * dt * 0.3;
    if (bubble.userData.life <= 0 || bubble.position.y > -0.05) [bubble.userData.life, bubble.visible] = [0, false];
  }
  // The Bubble, the raft's lamp, the tablets you have read, and the Great Shell opening
  const sub = state.subAt || DOCK;
  bubbleSub.visible = Boolean(state.gear.bubble) && !(player.inSub && mode === "swim");
  bubbleSub.position.set(sub.x, sub.y + Math.sin(clock.value * 1.2) * 0.08, sub.z);
  raft.position.y = Math.sin(clock.value * 0.9) * 0.08;
  raft.rotation.z = Math.sin(clock.value * 0.7) * 0.012;
  tabletModels.forEach((stone, n) => (stone.children[1].material.color.set(state.tablets[n] ? 0x3a6a6a : 0x7affe0)));
  if (state.won) shellOpen = Math.min(1, shellOpen + dt * 0.25);
  shellLid.rotation.x = -shellOpen * 1.15;
  heartPearl.visible = shellOpen > 0.05;
  heartPearl.scale.setScalar(1 + Math.sin(clock.value * 2) * 0.04);
  if ((hudTimer -= dt) <= 0) {
    hudTimer = 0.12;
    updateHud();
    // Only the squares of sea near you are drawn (the mist hides everything further off)
    for (const many of squares) many.visible = Math.hypot(many.userData.x - camera.position.x, many.userData.z - camera.position.z) < 290;
  }
  if (mode === "swim" && (saveTimer += dt) > 15) {
    saveTimer = 0;
    save();
  }
}
// ----- A last touch on the whole picture -----
// The game is first drawn into a hidden picture. Then a tiny graphics program copies that picture to the screen, and on the way it adds
// a soft haze of light round bright things (as real water does), richer colours, and a gentle wobble while you are under water.
// (Add ?plain to the page's address to turn this off.)
const finish = (function () {
  if (!renderer.capabilities.isWebGL2 || location.search.includes("plain")) return null;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const picture = new THREE.WebGLMultisampleRenderTarget(size.x, size.y, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true });
  const paintOver = new THREE.ShaderMaterial({
    uniforms: { map: { value: picture.texture }, time: clock, under: { value: 0 } },
    vertexShader: `
      varying vec2 vAt;
      void main() {
        vAt = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform float time;
      uniform float under;
      varying vec2 vAt;
      void main() {
        // Under water the picture wobbles very slightly, as if you were looking through moving water
        vec2 at = vAt + under * 0.0014 * vec2(sin(vAt.y * 34.0 + time * 1.7), cos(vAt.x * 30.0 + time * 1.3));
        vec3 colour = texture2D(map, at).rgb;
        // Blurry copies of the picture show where the bright things are. Their light spills a little way into the darker water round them.
        vec3 soft = texture2D(map, at, 2.5).rgb * 0.45 + texture2D(map, at, 4.5).rgb * 0.35 + texture2D(map, at, 6.0).rgb * 0.2;
        colour += max(soft - colour, 0.0) * mix(0.3, 0.6, under);
        // Richer colours, and a little more difference between light and dark
        float grey = dot(colour, vec3(0.3, 0.59, 0.11));
        colour = mix(vec3(grey), colour, 1.2);
        colour = mix(colour, colour * colour * (3.0 - 2.0 * colour), 0.3);
        // The edges of your mask are a little darker
        colour *= 1.0 - under * 0.3 * smoothstep(0.38, 0.8, distance(vAt, vec2(0.5)));
        gl_FragColor = vec4(colour, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), paintOver);
  sheet.frustumCulled = false;
  const stage = new THREE.Scene();
  stage.add(sheet);
  return { picture: picture, paint: paintOver, stage: stage, camera: new THREE.Camera(), size: size };
})();
let lastTime = performance.now(), fpsNow = 0;
function frame(now) {
  fpsNow += (1000 / Math.max(1, now - lastTime) - fpsNow) * 0.1;
  const dt = clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;
  update(dt);
  if (finish) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (size.x !== finish.size.x || size.y !== finish.size.y) {           // (the window changed size)
      finish.picture.setSize(size.x, size.y);
      finish.size.copy(size);
    }
    finish.paint.uniforms.under.value = camera.position.y < 0 ? 1 : 0;
    renderer.setRenderTarget(finish.picture);
  }
  renderer.render(scene, camera);
  // Then your arms are drawn on top (so they never poke into anything)
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(handScene, handCamera);
  renderer.autoClear = true;
  if (finish) {
    renderer.setRenderTarget(null);
    renderer.render(finish.stage, finish.camera);
  }
  requestAnimationFrame(frame);
}

// ----- Starting -----
function begin(saved) {
  state = saved ? Object.assign(freshState(), saved) : freshState();
  state.bag = Object.assign(emptyBag(), state.bag);
  state.locker = Object.assign(emptyBag(), state.locker);
  state.kits = state.kits || {};
  state.tunnels = state.tunnels || [];
  // (A game saved before rooms were empty: kitchens, aquariums and greenhouses turn into plain rooms, and every old room keeps what it used to have inside it)
  const olds = state.base.map((part) => part.kind);
  for (const part of state.base) part.kind = part.kind === "kitchen" ? "dome" : part.kind === "aquarium" || part.kind === "greenhouse" ? "glassdome" : part.kind;
  state.base = state.base.filter((part) => partOf(part.kind));
  for (const part of state.base) {
    const old = olds[state.base.indexOf(part)];
    if (part.items || !isRoom(part)) continue;
    part.items = part.kind === "lookout" ? [] : [{ kind: "locker", x: 0, z: -6.1, turn: 0 }, { kind: "bed", x: 5.6, z: -4.6, turn: 0 }];
    if (old === "kitchen") part.items.push({ kind: "oven", x: -6, z: 1, turn: Math.PI / 2 });
    if (old === "aquarium") part.items.push({ kind: "tank", x: 3.4, z: 3.2, turn: 0, fish: Math.min(4, part.fish || 0) });
    if (old === "greenhouse") part.items.push({ kind: "planter", x: -4.6, z: 3.6, turn: 0, ripe: 0 }, { kind: "planter", x: 4.6, z: 3.6, turn: 0, ripe: 0 });
    state.power = Math.max(state.power, powerCap());            // (and its battery starts full)
  }
  for (const part of state.base) if (part.items) part.items = part.items.filter((item) => itemOf(item.kind));       // (the fabricator is part of the wall now)
  powered = state.power > 0.01 || !powerCap();
  for (const tunnel of state.tunnels) {          // (fit each tunnel to the doors of the rooms it joins)
    for (const [x, y, z] of [["ax", "ay", "az"], ["bx", "by", "bz"]]) {
      const room = state.base.find((part) => isRoom(part) && part.x === tunnel[x] && part.z === tunnel[z]);
      if (room) tunnel[y] = doorOf(room).y;
    }
  }
  drawTools();
  rebuildBase();
  shellOpen = state.won ? 1 : 0;
  player.hp = 100;
  el("intro").hidden = true;
  goToRaft();
  if (!saved) showCard(["This is your pod: a little round cabin floating far out on the wide blue sea. Under it lies a whole world that nobody has ever explored.",
    "Dive in and look around. Watch your AIR: when it runs low, swim back up to the top to breathe.",
    "Pick up shells, kelp and anything else useful (E). Then climb back into your pod to make better gear: flippers, bigger air tanks, a torch, even a little submarine.",
    "You carry four tools: your Hands, a Scanner, a Net for catching fish, and a Builder for making a base on the sea bed. Keys 1 to 4 (or the mouse wheel) choose one, and the left mouse button uses it.",
    "You will get HUNGRY and THIRSTY. There are two cooked fish and two bottles of water in your pod locker to start you off: take them with you. G eats a fish, V drinks water, and the fabricator makes more.",
    "The old sailors tell of four Tide Tablets hidden under these waves, and a Great Shell at the bottom of the deepest dark. Find them, and you will find the sea's greatest secret.",
    "Hold the right mouse button (or Q) to scan the creatures you meet for your sea journal. Most are friendly. Some are not. Good luck, diver!"]);
}
el("start").addEventListener("click", () => begin(null));
el("continue").addEventListener("click", () => begin(loadSave()));
el("continue").hidden = !loadSave();
requestAnimationFrame(frame);

// Only for testing the game.
window.DW = {
  player: player, keys: keys, creatures: creatures, loot: loot, SPECIES: SPECIES,
  state: () => state, mode: () => mode, card: () => card, interact: interact, nearby: nearby, goToRaft: goToRaft, hurt: hurt, save: save,
  standing: () => standing, inBase: () => inBase, useHatch: useHatch, hatchOf: hatchOf, roomAt: roomAt, useTool: useTool, pickTool: pickTool, tool: () => TOOLS[tool].id, swingNet: swingNet, eatFish: eatFish, indoors: indoors, fed: () => clock.value < fedUntil,
  power: () => state.power, powered: () => powered, runPower: runPower, powerMade: powerMade, powerUsed: powerUsed, itemNear: itemNear, drinkWater: drinkWater, firstAid: firstAid, jab: jab, getHungry: getHungry, sunUp: sunUp, setTime: (part) => (state.time = part * DAY), passTime: passTime, fps: () => fpsNow,
  setTorch: (on) => (torchOn = on), scan: (on) => (scanning = on), toggleBuild: toggleBuild, placePart: placePart, packUp: packUp, roomHere: roomHere,
  setPlacing: (id) => (placing = partOf(id) || itemOf(id)), blowWhistle: blowWhistle, hullHit: hullHit, scared: () => clock.value < scaredUntil,
};
