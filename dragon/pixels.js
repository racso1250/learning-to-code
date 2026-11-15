// A tiny pixel-art toolkit, and every picture in the game.
// There are no image files! Each sprite is drawn here with code:
// boxes, ovals and shapes made of single pixels, like 16-bit artists used.

const INK = "#1d1730"; // the dark outline colour around every sprite

function makeCanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

// A small drawing board. Everything snaps to whole pixels so it stays crisp.
class Art {
  constructor(w, h) {
    this.canvas = makeCanvas(w, h);
    this.g = this.canvas.getContext("2d");
  }
  box(x, y, w, h, colour) {
    this.g.fillStyle = colour;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }
  dot(x, y, colour) {
    return this.box(x, y, 1, 1, colour);
  }
  oval(cx, cy, rx, ry, colour) {
    this.g.fillStyle = colour;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const t = (y + 0.5 - cy) / ry;
      if (Math.abs(t) >= 1) continue;
      const half = rx * Math.sqrt(1 - t * t);
      const x0 = Math.round(cx - half);
      this.g.fillRect(x0, y, Math.max(1, Math.round(cx + half) - x0), 1);
    }
    return this;
  }
  // A filled shape from a list of corner points
  shape(points, colour) {
    this.g.fillStyle = colour;
    let top = Infinity;
    let bottom = -Infinity;
    for (const p of points) {
      top = Math.min(top, p[1]);
      bottom = Math.max(bottom, p[1]);
    }
    for (let y = Math.floor(top); y <= Math.ceil(bottom); y++) {
      const crossings = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const yy = y + 0.5;
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) {
          crossings.push(a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      crossings.sort((p, q) => p - q);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const x0 = Math.round(crossings[i]);
        this.g.fillRect(x0, y, Math.max(1, Math.round(crossings[i + 1]) - x0), 1);
      }
    }
    return this;
  }
  line(x0, y0, x1, y1, colour) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      this.dot(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, colour);
    }
    return this;
  }
  // Sprinkle random dots inside the parts that are already painted
  speckle(colour, amount, seed, rows) {
    const w = this.canvas.width;
    const h = rows || this.canvas.height;   // "rows" = only speckle this many rows from the top
    const data = this.g.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 0 && hash(x, y, seed) < amount) this.dot(x, y, colour);
      }
    }
    return this;
  }
}

// Finish a sprite: shade its edges (light on top, dark underneath) and draw the dark outline
function finish(art, options) {
  const settings = Object.assign({ outline: INK, shade: true }, options || {});
  const canvas = art.canvas;
  const w = canvas.width;
  const h = canvas.height;
  const g = canvas.getContext("2d");
  const image = g.getImageData(0, 0, w, h);
  const d = image.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : solid[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (at(x, y)) {
        if (!settings.shade) continue;
        let change = 1;
        if (!at(x, y + 1) || !at(x + 1, y)) change = 0.74;       // bottom and right edges are in shadow
        else if (!at(x, y - 1) || !at(x - 1, y)) change = 1.16;  // top and left edges catch the light
        d[i] = Math.min(255, d[i] * change);
        d[i + 1] = Math.min(255, d[i + 1] * change);
        d[i + 2] = Math.min(255, d[i + 2] * change);
      } else if (settings.outline && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) {
        d[i] = parseInt(settings.outline.slice(1, 3), 16);
        d[i + 1] = parseInt(settings.outline.slice(3, 5), 16);
        d[i + 2] = parseInt(settings.outline.slice(5, 7), 16);
        d[i + 3] = 255;
      }
    }
  }
  g.putImageData(image, 0, 0);
  return canvas;
}

// A mirror image (so a sprite that faces right can also face left)
function flipped(canvas) {
  const copy = makeCanvas(canvas.width, canvas.height);
  const g = copy.getContext("2d");
  g.translate(canvas.width, 0);
  g.scale(-1, 1);
  g.drawImage(canvas, 0, 0);
  return copy;
}

// The same sprite painted all in one colour (for the white "ouch!" flash)
function tinted(canvas, colour) {
  const copy = makeCanvas(canvas.width, canvas.height);
  const g = copy.getContext("2d");
  g.drawImage(canvas, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = colour;
  g.fillRect(0, 0, copy.width, copy.height);
  return copy;
}

// A lighter or darker version of a colour (amount 1.2 = lighter, 0.8 = darker)
function tone(hex, amount) {
  const parts = [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * amount))));
  return "#" + parts.map((value) => value.toString(16).padStart(2, "0")).join("");
}

// A sprite turned by quarter turns (so one knife picture can point 4 ways)
function turned(canvas, quarterTurns) {
  const sideways = quarterTurns % 2 === 1;
  const copy = makeCanvas(sideways ? canvas.height : canvas.width, sideways ? canvas.width : canvas.height);
  const g = copy.getContext("2d");
  g.translate(copy.width / 2, copy.height / 2);
  g.rotate((quarterTurns * Math.PI) / 2);
  g.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return copy;
}

// The teen's little pocket knife, and the sword you get when you grow up (pointing right)
function drawBlade(long) {
  const length = long ? 9 : 5;
  const a = new Art(length + 7, 5);
  a.box(1, 2, 3, 1, "#7a4a2a");
  if (long) a.box(4, 1, 1, 3, "#ffd84a");
  a.box(long ? 5 : 4, 2, length, 1, "#eef4fa");
  return finish(a, { shade: false });
}

function drawBird(frame) {
  const a = new Art(7, 4);
  const dots = frame ? [[0, 3], [1, 2], [2, 1], [3, 1], [4, 1], [5, 2], [6, 3]] : [[0, 0], [1, 1], [2, 2], [3, 2], [4, 2], [5, 1], [6, 0]];
  for (const [x, y] of dots) a.dot(x, y, "#2a2438");
  return a.canvas;
}

// ---------------------------------------------------------------------------
// People. One function draws every person in the game from a list of choices.
// dir: 0 = facing you, 1 = left, 2 = right, 3 = facing away. step: 0 to 3 (walking)
// ---------------------------------------------------------------------------

function drawPerson(look, dir, step) {
  if (dir === 1) return flipped(drawPerson(look, 2, step));
  const a = new Art(20, 32);
  const teen = look.size === "teen";
  const legH = teen ? 3 : 4;
  const bodyH = teen ? 6 : 7;
  const footY = 30;
  const legTop = footY - legH;
  const bodyTop = legTop - bodyH;
  const headTop = bodyTop - 8;
  const side = dir === 2;
  const back = dir === 3;
  const sleeve = look.sleeve || look.tunic;
  const swing = step === 1 ? 1 : step === 3 ? -1 : 0;

  // Cape (behind the body)
  if (look.cape && side) a.box(5, bodyTop, 3, bodyH + 2, look.cape);
  if (look.cape && !side && !back) a.box(5, bodyTop, 10, 2, look.cape);

  // Legs, or a long robe
  if (look.robe) {
    if (side) {
      a.box(7, bodyTop, 6, bodyH + legH - 1, look.tunic);
      a.box(6 + swing, footY - 3, 8, 2, look.tunic);
    } else {
      a.box(6, bodyTop, 8, bodyH + legH - 1, look.tunic);
      a.box(5, footY - 3, 10, 2, look.tunic);
      a.box(9 + swing, bodyTop + 2, 2, bodyH + legH - 4, look.trim);
    }
    a.box(side ? 8 + swing : 7, footY - 1, 2, 1, look.boots);
    a.box(side ? 11 - swing : 11, footY - 1, 2, 1, look.boots);
  } else if (side) {
    const front = step === 1 ? 0 : step === 3 ? 1 : 0;
    if (swing === 0) {
      a.box(8, legTop, 4, legH, look.pants);
      a.box(8, footY - 1, 5, 1, look.boots);
    } else {
      a.box(7, legTop, 2, legH - front, look.pants);
      a.box(11, legTop, 2, legH - (1 - front), look.pants);
      a.box(7, footY - 1 - front, 3, 1, look.boots);
      a.box(11, footY - 1 - (1 - front), 3, 1, look.boots);
    }
  } else {
    const liftL = step === 1 ? 1 : 0;
    const liftR = step === 3 ? 1 : 0;
    a.box(7, legTop, 2, legH - liftL, look.pants);
    a.box(11, legTop, 2, legH - liftR, look.pants);
    a.box(7, footY - 1 - liftL, 2, 1, look.boots);
    a.box(11, footY - 1 - liftR, 2, 1, look.boots);
  }

  // Body and arms
  if (!look.robe) {
    if (side) a.box(7, bodyTop, 6, bodyH, look.tunic);
    else a.box(6, bodyTop, 8, bodyH, look.tunic);
    a.box(side ? 7 : 6, bodyTop + bodyH - 2, side ? 6 : 8, 1, look.belt || look.boots);
    if (!side && !back) a.box(9, bodyTop, 2, 2, look.trim);
  }
  if (side) {
    a.box(9 + swing, bodyTop + 1, 2, 4, sleeve);
    a.box(9 + swing, bodyTop + 5, 2, 1, look.skin);
  } else {
    a.box(5, bodyTop + 1 + swing, 1, 4, sleeve);
    a.box(14, bodyTop + 1 - swing, 1, 4, sleeve);
    a.dot(5, bodyTop + 5 + swing, look.skin);
    a.dot(14, bodyTop + 5 - swing, look.skin);
  }
  if (look.cape && back) a.box(5, bodyTop, 10, bodyH + 2, look.cape);

  // Head
  a.box(5, headTop + 1, 10, 6, look.skin);
  a.box(6, headTop, 8, 8, look.skin);
  const hair = look.hair;
  if (look.style !== "bald") {
    a.box(5, headTop + 1, 10, 2, hair);
    a.box(6, headTop, 8, 1, hair);
    if (back) a.box(5, headTop + 1, 10, 6, hair);
    else if (side) a.box(5, headTop + 1, 3, 6, hair);
    else {
      a.box(5, headTop + 3, 1, 2, hair);
      a.box(14, headTop + 3, 1, 2, hair);
    }
    if (look.style === "long") {
      if (back) a.box(5, headTop + 1, 10, 10, hair);
      else if (side) a.box(5, headTop + 1, 3, 10, hair);
      else {
        a.box(5, headTop + 3, 1, 8, hair);
        a.box(14, headTop + 3, 1, 8, hair);
      }
    }
    if (look.style === "spiky") {
      a.box(7, headTop - 1, 2, 1, hair);
      a.box(11, headTop - 1, 2, 1, hair);
      a.dot(9, headTop - 2, hair);
      if (!back) a.box(side ? 10 : 7, headTop + 3, side ? 3 : 2, 1, hair);
    }
    if (look.style === "bun") a.box(8, headTop - 2, 4, 2, hair);
  }
  // Face
  if (!back) {
    if (side) {
      a.box(12, headTop + 4, 1, 2, INK);
    } else {
      a.box(7, headTop + 4, 1, 2, INK);
      a.box(12, headTop + 4, 1, 2, INK);
      a.dot(6, headTop + 6, look.blush || look.skin);
      a.dot(13, headTop + 6, look.blush || look.skin);
    }
    if (look.beard) {
      if (side) {
        a.box(11, headTop + 6, 4, 3, look.beard);
        a.box(12, headTop + 9, 3, 2, look.beard);
        a.box(13, headTop + 11, 2, 2, look.beard);
      } else {
        a.box(6, headTop + 6, 8, 3, look.beard);
        a.box(7, headTop + 9, 6, 2, look.beard);
        a.box(8, headTop + 11, 4, 2, look.beard);
      }
    }
  }
  // Extra detail: shading on clothes, shiny hair, a scarf
  const shade = tone(look.tunic, 0.76);
  if (look.robe) {
    if (!side) {
      a.box(7, bodyTop + 5, 1, bodyH + legH - 8, shade);     // folds in the robe
      a.box(12, bodyTop + 5, 1, bodyH + legH - 8, shade);
    }
    a.box(side ? 6 + swing : 5, footY - 2, side ? 8 : 10, 1, shade);
  } else {
    a.box(side ? 7 : 6, bodyTop + bodyH - 1, side ? 6 : 8, 1, shade);
    if (!side) a.box(13, bodyTop + 2, 1, bodyH - 4, shade);
    if (!side && !back) a.box(9, bodyTop + bodyH - 2, 2, 1, "#fff0b0");   // belt buckle
  }
  if (look.style !== "bald" && !look.hat) a.box(side ? 8 : 7, headTop + 1, 3, 1, tone(hair, 1.35));
  if (look.scarf) {
    a.box(side ? 7 : 6, bodyTop, side ? 6 : 8, 2, look.scarf);
    if (!back) a.box(side ? 7 : 11, bodyTop + 2, 2, 3, look.scarf);          // the end of the scarf hangs down
  }

  // A tall pointy wizard's hat
  if (look.hat) {
    a.box(3, headTop + 1, 14, 1, look.hat);
    a.box(4, headTop, 12, 1, look.hat);
    a.box(6, headTop - 2, 8, 2, look.hat);
    a.box(7, headTop - 4, 6, 2, look.hat);
    a.box(8, headTop - 6, 4, 2, look.hat);
    a.box(9, headTop - 8, 3, 2, look.hat);
    a.box(10, headTop - 9, 3, 1, look.hat);
    a.box(6, headTop - 1, 8, 1, look.hatBand || look.hat);
    a.box(8, headTop - 5, 1, 4, tone(look.hat, 1.25));     // a line of light down the hat
  }
  // A wizard's staff with a glowing tip
  if (look.staff) {
    const sx = side ? 15 : back ? 3 : 16;
    a.box(sx, headTop + 1, 1, footY - headTop - 1, "#7a5230");
    a.box(sx - 1, headTop - 1, 3, 2, "#bfe8ff");
    a.dot(sx, headTop - 2, "#ffffff");
  }
  return finish(a);
}

// All 4 directions and 4 walking steps of one person
function personSet(look) {
  const set = [];
  for (let dir = 0; dir < 4; dir++) {
    set.push([]);
    for (let step = 0; step < 4; step++) set[dir].push(drawPerson(look, dir, step));
  }
  return set;
}

const LOOKS = {
  teen: { size: "teen", skin: "#f2c79a", blush: "#e89a84", hair: "#8a4a22", style: "spiky", tunic: "#2a9d8f", trim: "#f4d06f", sleeve: "#218074", pants: "#3d405b", boots: "#5a3a22", belt: "#f4d06f", scarf: "#e0402a" },
  adult: { skin: "#f2c79a", blush: "#e89a84", hair: "#8a4a22", style: "spiky", tunic: "#2a9d8f", trim: "#f4d06f", sleeve: "#218074", pants: "#3d405b", boots: "#5a3a22", belt: "#f4d06f", cape: "#b8323f" },
  elder: { skin: "#f2c79a", hair: "#dcdce6", style: "spiky", beard: "#dcdce6", tunic: "#2a9d8f", trim: "#f4d06f", sleeve: "#218074", pants: "#3d405b", boots: "#5a3a22", belt: "#f4d06f", cape: "#b8323f" },
  newTeen: { size: "teen", skin: "#d9a273", blush: "#c9806a", hair: "#2b2b3a", style: "long", tunic: "#e07a3a", trim: "#fff1c9", sleeve: "#c0622a", pants: "#4a5a7a", boots: "#5a3a22" },
  grandma: { skin: "#eec39a", blush: "#e89a84", hair: "#e6e6ee", style: "bun", robe: true, tunic: "#7b4fa3", trim: "#f4d06f", boots: "#4a3060" },
  wizard: { skin: "#f0c8a0", hair: "#e9e9ef", style: "long", beard: "#f4f4f8", robe: true, tunic: "#9aa0ad", trim: "#858b99", sleeve: "#858b99", boots: "#4a4a55", hat: "#7c8290", hatBand: "#5b606c", staff: true },
  baker: { skin: "#e8b88a", hair: "#5a3a22", style: "short", tunic: "#f2ead8", trim: "#d8c8a8", sleeve: "#e0d6c0", pants: "#7a5a3a", boots: "#4a3020", belt: "#b05a3a" },
  lily: { size: "teen", skin: "#f6d2a8", blush: "#f0a090", hair: "#e8823a", style: "long", robe: true, tunic: "#f4c842", trim: "#ffffff", boots: "#8a4a3a" },
  finn: { skin: "#d9a273", hair: "#b8b8c4", style: "short", beard: "#b8b8c4", tunic: "#3d6fa5", trim: "#e8e8f0", sleeve: "#2f5a8a", pants: "#5a4a3a", boots: "#3a2a20", belt: "#c8a050" },
};

// A close-up of a face, for the talking box
function portrait(sprite, teen) {
  const canvas = makeCanvas(16, 16);
  const g = canvas.getContext("2d");
  g.drawImage(sprite, 2, teen ? 9 : 7, 16, 16, 0, 0, 16, 16);
  return canvas;
}

// ---------------------------------------------------------------------------
// The border terrier
// ---------------------------------------------------------------------------

function drawDog(step) {
  const a = new Art(18, 14);
  const tan = "#c98f52";
  const grizzle = "#86684c";
  const dark = "#4a3728";
  a.box(3, 6, 9, 4, tan);          // body
  a.box(4, 6, 6, 2, grizzle);      // the darker "saddle" on a border terrier's back
  a.box(11, 8, 2, 2, "#e3b983");   // pale chest
  a.box(2, 3, 1, 4, tan);          // tail, held up
  a.dot(3, 5, tan);
  a.box(10, 3, 5, 4, tan);         // head
  a.box(10, 2, 2, 3, dark);        // folded ear
  a.box(14, 5, 2, 2, dark);        // dark muzzle
  a.dot(13, 4, INK);               // eye
  const legs = step ? [4, 7, 9, 11] : [3, 6, 10, 12];
  a.box(legs[0], 10, 1, 2, tan);
  a.box(legs[1], 10, 1, 2, grizzle);
  a.box(legs[2], 10, 1, 2, grizzle);
  a.box(legs[3], 10, 1, 2, tan);
  return finish(a);
}

// ---------------------------------------------------------------------------
// Dragons
// ---------------------------------------------------------------------------

const DRAGON_COLOURS = {
  ember: { main: "#d8402f", dark: "#9c2433", light: "#f2703a", belly: "#f7c96b", wing: "#f58b3a", wingDark: "#b8322f", bone: "#f6ead0", eye: "#ffffff", pupil: INK },
  gold: { main: "#e8a020", dark: "#b06a18", light: "#ffd040", belly: "#fff0b0", wing: "#ff7a2a", wingDark: "#c84a20", bone: "#ffffff", eye: "#ffffff", pupil: INK },
  shadow: { main: "#3d2c62", dark: "#231a3c", light: "#5c4896", belly: "#6f52a8", wing: "#8a2f6a", wingDark: "#4a1f4a", bone: "#cfc6e6", eye: "#ff3b6b", pupil: "#ffd0dc" },
  frost: { main: "#3a8fd8", dark: "#245a9c", light: "#6fc0f5", belly: "#e6f6ff", wing: "#8ad8ff", wingDark: "#2f6fb8", bone: "#ffffff", eye: "#ffffff", pupil: INK },
  frostGreat: { main: "#8fd8ff", dark: "#4a9ad8", light: "#e0f8ff", belly: "#ffffff", wing: "#c8f0ff", wingDark: "#5aa8e0", bone: "#ffffff", eye: "#ffffff", pupil: INK },
  leaf: { main: "#3aa858", dark: "#1f6f3f", light: "#74d07a", belly: "#f2e9a0", wing: "#a8e060", wingDark: "#2a8048", bone: "#f6ead0", eye: "#ffffff", pupil: INK },
  leafGreat: { main: "#8ad848", dark: "#4a9a2a", light: "#d0f58a", belly: "#fff6c0", wing: "#ffd84a", wingDark: "#c89a20", bone: "#ffffff", eye: "#ffffff", pupil: INK },
  star: { main: "#9a6ad8", dark: "#5e3a9c", light: "#c8a0f5", belly: "#ffe9f6", wing: "#ff9ad8", wingDark: "#a84a9a", bone: "#ffffff", eye: "#ffffff", pupil: INK },
  starGreat: { main: "#f2f0ff", dark: "#b0a8e0", light: "#ffffff", belly: "#fff6c0", wing: "#ffc8f0", wingDark: "#c88ad8", bone: "#ffd84a", eye: "#ffffff", pupil: INK },
  iceWyrm: { main: "#4a7ab8", dark: "#2a4a80", light: "#8ab8e8", belly: "#c8e4f8", wing: "#bfe8ff", wingDark: "#5a8ac8", bone: "#ffffff", eye: "#3affff", pupil: "#ffffff" },
  sandWyrm: { main: "#c89a4a", dark: "#8a6428", light: "#ecc878", belly: "#f6e4b0", wing: "#e07a3a", wingDark: "#a04a22", bone: "#fff6e0", eye: "#ff3b3b", pupil: "#ffe0c0" },
  stone: { main: "#9a98a4", dark: "#77757f", light: "#b4b2bc", belly: "#a8a6b0", wing: "#8c8a96", wingDark: "#77757f", bone: "#c2c0ca", eye: "#77757f", pupil: "#77757f" },
};

// One wing: four "fingers" fanning out from the shoulder, with skin stretched between them
function drawWing(a, sx, sy, k, frame, membrane, bones) {
  const start = [62, 128, 196][frame];
  const lengths = [13, 15, 14, 10];
  const tips = [];
  for (let i = 0; i < 4; i++) {
    const angle = ((start + i * 22) * Math.PI) / 180;
    tips.push([sx + Math.cos(angle) * lengths[i] * k, sy - Math.sin(angle) * lengths[i] * k]);
  }
  const outline = [[sx + 2 * k, sy]];
  for (let i = 0; i < 4; i++) {
    outline.push(tips[i]);
    if (i < 3) outline.push([sx + ((tips[i][0] + tips[i + 1][0]) / 2 - sx) * 0.72, sy + ((tips[i][1] + tips[i + 1][1]) / 2 - sy) * 0.72]);
  }
  outline.push([sx - 4 * k, sy + 1 * k]);
  a.shape(outline, membrane);
  for (const tip of tips) a.line(sx, sy, tip[0], tip[1], bones);
}

// A grown dragon facing right. k is its size. frame is the wing position (0 up, 1 out, 2 down).
function drawDragon(k, colours, frame, flying) {
  const c = colours;
  const a = new Art(Math.ceil(46 * k), Math.ceil(36 * k));
  const o = (x, y, rx, ry, colour) => a.oval(x * k, y * k, rx * k, ry * k, colour);
  const s = (points, colour) => a.shape(points.map((p) => [p[0] * k, p[1] * k]), colour);
  drawWing(a, 17 * k, 17 * k, k, frame, c.wingDark, c.dark);       // far wing
  // Tail, with a spade on the end
  o(12, 21, 3.4, 2.8, c.main);
  o(8.5, 22, 2.8, 2.1, c.main);
  o(5.5, 21.5, 2.2, 1.6, c.main);
  o(3.5, 20, 1.6, 1.3, c.main);
  s([[0.5, 15.5], [5, 19], [1.5, 21]], c.dark);
  // Back leg
  if (flying) o(14, 26, 3, 2, c.dark);
  else {
    o(14, 25, 3.2, 3, c.dark);
    a.box(13 * k, 27 * k, 3 * k, 3.5 * k, c.dark);
    a.box(13 * k, 30 * k, 4.5 * k, 1.2 * k, c.bone);
  }
  // Body and belly
  o(19, 21, 8.5, 5.6, c.main);
  o(18, 18, 5.5, 1.6, c.light);
  o(19.5, 23.8, 6.5, 2.4, c.belly);
  for (let i = 0; i < 4; i++) a.box((15 + i * 3) * k, 23.2 * k, 1, 2.4 * k, c.wing);
  // Front leg
  if (flying) o(24, 26.5, 2.6, 1.8, c.main);
  else {
    a.box(22.5 * k, 24 * k, 3 * k, 6 * k, c.main);
    a.box(22.5 * k, 30 * k, 4.5 * k, 1.2 * k, c.bone);
  }
  // Neck
  o(25.5, 18, 3.8, 3.6, c.main);
  o(28, 14.5, 3.2, 3.4, c.main);
  o(30, 11.5, 3, 3, c.main);
  o(29, 15.5, 1.6, 2.6, c.belly);
  // Spikes down the back
  for (const p of [[28, 9.5], [25.5, 12], [23, 14.5], [19.5, 14.6], [15.5, 15.2], [11.5, 17.5], [8, 19.4]]) {
    s([[p[0] - 1.2, p[1] + 1.4], [p[0] - 0.6, p[1] - 1.4], [p[0] + 1.2, p[1] + 1.4]], c.bone);
  }
  // Horns
  s([[29.5, 7], [25, 2.5], [31, 5.5]], c.bone);
  s([[31.5, 6.5], [28.5, 1.5], [33.5, 5.5]], c.bone);
  // Head and snout
  o(32.5, 9, 4.2, 3.4, c.main);
  o(37, 10.2, 3.6, 2.4, c.main);
  o(33, 7.4, 2.6, 1, c.light);
  a.box(34 * k, 11.6 * k, 6 * k, 1, c.dark);            // mouth
  a.dot(39.2 * k, 9.2 * k, c.dark);                     // nostril
  a.box(32 * k, 8 * k, Math.max(2, 2 * k), Math.max(2, 1.6 * k), c.eye);
  a.box(33 * k, 8 * k, Math.max(1, k), Math.max(2, 1.6 * k), c.pupil);
  a.box(31.4 * k, 7 * k, 3.4 * k, 1, c.dark);           // a fierce eyebrow
  drawWing(a, 20 * k, 17.5 * k, k, frame, c.wing, c.main);         // near wing
  return finish(a);
}

// The baby dragon: a big head, big eyes and tiny wings
function drawHatchling(colours, frame, step) {
  const c = colours;
  const a = new Art(24, 22);
  a.shape(frame === 0 ? [[9, 11], [4, 3], [8, 6], [11, 3], [12, 11]] : [[9, 11], [3, 10], [6, 13], [11, 13]], c.wingDark);
  a.oval(5, 15.5, 3, 1.6, c.main);            // tail
  a.shape([[0.5, 12], [3.5, 14], [1.5, 16]], c.dark);
  a.oval(10, 14.5, 5, 4, c.main);             // body
  a.oval(10.5, 16, 3.6, 2.3, c.belly);
  a.box(step ? 6 : 7, 18, 2, 2, c.dark);      // little legs
  a.box(step ? 12 : 11, 18, 2, 2, c.main);
  a.oval(15.5, 9, 5.2, 4.6, c.main);          // big head
  a.oval(15, 6.5, 3, 1.2, c.light);
  a.oval(19.5, 10.5, 2.8, 2.2, c.main);       // snout
  a.dot(21, 10, c.dark);
  a.box(13, 3, 1, 2, c.bone);                 // horn nubs
  a.box(16, 3, 1, 2, c.bone);
  a.box(16, 7, 3, 4, c.eye);                  // a big shiny eye
  a.box(17, 8, 2, 3, c.pupil);
  a.dot(17, 8, "#ffffff");
  a.dot(14, 11, "#ff9a8a");                   // rosy cheek
  a.box(18, 12, 4, 1, c.dark);                // smile
  a.shape(frame === 0 ? [[10, 11], [6, 4], [9, 7], [12, 4], [13, 11]] : [[10, 11], [5, 11], [7, 14], [12, 13]], c.wing);
  return finish(a);
}

function drawEgg() {
  const a = new Art(12, 14);
  a.oval(6, 7.5, 4, 5, "#d8402f");
  a.oval(5, 5.5, 1.6, 2, "#f2703a");
  a.dot(7, 8, "#f7c96b");
  a.dot(4, 10, "#f7c96b");
  a.dot(8, 5, "#f7c96b");
  return finish(a);
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------

function drawSlime(frame, body, shine) {
  body = body || "#57c95a";
  shine = shine || "#b6f5a0";
  const a = new Art(18, 16);
  if (frame) a.oval(9, 10.5, 7, 3.6, body);
  else a.oval(9, 9, 5.8, 5, body);
  a.oval(7, frame ? 9.2 : 6.8, 2.4, 1.2, shine);
  a.box(6, frame ? 10 : 9, 1, 2, INK);
  a.box(11, frame ? 10 : 9, 1, 2, INK);
  return finish(a);
}

function drawBat(frame, wing, body, eye) {
  wing = wing || "#4a2f7a";
  body = body || "#6a45a8";
  eye = eye || "#ff4a5a";
  const a = new Art(22, 14);
  if (frame) {
    a.shape([[9, 7], [1, 10], [4, 6], [8, 5]], wing);
    a.shape([[13, 7], [21, 10], [18, 6], [14, 5]], wing);
  } else {
    a.shape([[9, 7], [1, 2], [3, 7], [6, 6]], wing);
    a.shape([[13, 7], [21, 2], [19, 7], [16, 6]], wing);
  }
  a.oval(11, 7.5, 2.8, 3.4, body);
  a.dot(9, 3, body);
  a.dot(12, 3, body);
  a.dot(10, 6, eye);
  a.dot(12, 6, eye);
  return finish(a);
}

function drawSpider(frame, body, leg, mark) {
  body = body || "#3a2f52";
  leg = leg || "#2a2238";
  mark = mark || "#d83a8a";
  const a = new Art(20, 14);
  for (let i = 0; i < 4; i++) {
    const y = 4 + i * 2 + (i % 2 === frame ? 1 : 0);
    a.line(8, 7, 2 + (i % 2), y, leg);
    a.line(12, 7, 17 - (i % 2), y, leg);
  }
  a.oval(10, 8.5, 4.2, 3.4, body);
  a.oval(10, 5, 2.6, 2.2, leg);
  a.box(9, 8, 2, 2, mark);
  a.dot(9, 4, "#ff4a5a");
  a.dot(11, 4, "#ff4a5a");
  return finish(a);
}

function drawGolem(frame, rock, dark, eye, moss, light) {
  rock = rock || "#8d8a94";
  dark = dark || "#6b6874";
  eye = eye || "#7af0ff";
  moss = moss || "#5a9a4a";
  light = light || "#a8a5b0";
  const a = new Art(26, 28);
  a.box(7, 21, 4, 5, dark);
  a.box(15, 21, 4, 5, dark);
  a.oval(4, 15 + frame, 2.8, 5.5, rock);
  a.oval(22, 15 - frame, 2.8, 5.5, rock);
  a.oval(13, 14, 7.5, 8, rock);
  a.oval(11, 10, 4, 2.4, light);
  a.box(9, 3, 8, 6, rock);
  a.box(10, 5, 2, 2, eye);
  a.box(14, 5, 2, 2, eye);
  a.line(9, 14, 13, 18, dark);
  a.line(13, 18, 16, 15, dark);
  a.box(16, 11, 2, 2, moss);
  a.dot(8, 17, moss);
  return finish(a);
}

function drawImp(frame, red, dark, eye) {
  red = red || "#e0503a";
  dark = dark || "#a02a2a";
  eye = eye || "#ffe14a";
  const a = new Art(18, 20);
  a.line(4, 14, 1, 11 + frame, dark);       // tail
  a.box(6, 15, 2, 3 - frame, dark);
  a.box(10, 15, 2, 2 + frame, dark);
  a.oval(9, 12.5, 3.2, 3.6, red);
  a.box(4, 11, 2, 1, red);
  a.box(12, 11, 2, 1, red);
  a.oval(9, 6.5, 4.2, 3.6, red);
  a.shape([[5, 5], [4, 1], [7, 4]], "#f6ead0");
  a.shape([[13, 5], [14, 1], [11, 4]], "#f6ead0");
  a.box(7, 6, 1, 2, eye);
  a.box(11, 6, 1, 2, eye);
  a.box(8, 9, 3, 1, INK);
  return finish(a);
}

// ---------------------------------------------------------------------------
// Trees, rocks, buildings and everything else that stands on the ground
// ---------------------------------------------------------------------------

function drawOak(look) {
  const a = new Art(38, 48);
  const greens = [["#2c7a3c", "#44a04a", "#6fc65c"], ["#2f7436", "#4f9a3e", "#86c456"], ["#256f4a", "#3a9a5a", "#62c47a"]][look];
  a.box(16, 30, 6, 15, "#7a5230");
  a.box(20, 30, 2, 15, "#5c3c22");
  a.box(14, 44, 10, 2, "#7a5230");
  a.oval(19, 18, 15, 13, greens[0]);
  a.oval(12, 15, 8, 7, greens[1]);
  a.oval(24, 12, 9, 7, greens[1]);
  a.oval(19, 23, 10, 6, greens[1]);
  a.oval(10, 12, 4, 2.6, greens[2]);
  a.oval(23, 8.5, 5, 2.6, greens[2]);
  a.oval(17, 19, 4, 2, greens[2]);
  a.speckle(greens[0], 0.07, 20 + look, 29);
  return finish(a);
}

function drawPine(snowy) {
  const a = new Art(30, 48);
  a.box(13, 38, 4, 8, "#6a4628");
  const tiers = [[15, 3, 7, 16], [15, 12, 10, 27], [15, 22, 13, 40]];
  for (const [cx, top, half, bottom] of tiers) {
    a.shape([[cx, top], [cx + half, bottom], [cx - half, bottom]], "#1f5f43");
    a.shape([[cx, top], [cx - half, bottom], [cx - half * 0.3, bottom]], "#2e7d52");
    if (snowy) a.shape([[cx, top], [cx + half * 0.45, top + (bottom - top) * 0.45], [cx, top + (bottom - top) * 0.35], [cx - half * 0.45, top + (bottom - top) * 0.45]], "#f4f8fc");
  }
  return finish(a);
}

function drawDoomTree(look) {
  const a = new Art(38, 50);
  const bark = "#3b2c3c";
  a.shape([[14, 47], [16, 26], [22, 26], [25, 47]], bark);
  a.box(20, 28, 3, 19, "#2a1f2e");
  a.line(17, 28, 8, 17, bark);
  a.line(21, 28, 30, 15, bark);
  a.line(19, 26, 19, 12, bark);
  a.line(8, 17, 4, 15, bark);
  a.line(30, 15, 34, 16, bark);
  const leaves = [["#243a38", "#2f4d48"], ["#30284a", "#43386a"], ["#1f3540", "#2c4a58"]][look];
  a.oval(10, 14, 8, 6, leaves[0]);
  a.oval(27, 12, 9, 6.5, leaves[0]);
  a.oval(19, 9, 9, 6, leaves[0]);
  a.oval(9, 12, 4, 2.6, leaves[1]);
  a.oval(25, 9, 5, 2.6, leaves[1]);
  a.oval(18, 6, 4, 2, leaves[1]);
  a.speckle("#16202a", 0.08, 31 + look, 19);
  if (look === 0) {
    a.box(17, 34, 4, 3, "#120c18");   // a hollow in the trunk... with eyes in it
    a.dot(17, 35, "#d8ff5a");
    a.dot(20, 35, "#d8ff5a");
  }
  return finish(a);
}

function drawAshTree() {
  const a = new Art(26, 40);
  const burnt = "#2a2428";
  a.shape([[10, 38], [11, 18], [15, 18], [17, 38]], burnt);
  a.line(12, 20, 5, 9, burnt);
  a.line(14, 20, 21, 7, burnt);
  a.line(13, 18, 13, 4, burnt);
  a.line(5, 9, 2, 8, burnt);
  a.line(21, 7, 24, 9, burnt);
  a.dot(12, 26, "#ff7a1a");
  a.dot(14, 31, "#ffb52e");
  a.dot(6, 10, "#ff7a1a");
  return finish(a);
}

function drawBush(berries) {
  const a = new Art(20, 18);
  a.oval(10, 11, 8, 5.5, "#2f7d3a");
  a.oval(7, 9, 4.5, 3.4, "#48a34c");
  a.oval(13, 8, 4.5, 3.2, "#48a34c");
  a.oval(8, 7.5, 2.4, 1.2, "#74c860");
  if (berries) {
    for (const [x, y] of [[5, 11], [9, 12], [13, 11], [11, 8], [7, 8], [15, 9]]) {
      a.box(x, y, 2, 2, "#ff5a3a");
      a.dot(x, y, "#ffc0a0");
    }
  }
  return finish(a);
}

function drawRock(look) {
  const a = new Art(18, 15);
  const w = [6.5, 5, 7][look];
  a.oval(9, 9, w, 4.6, "#85828e");
  a.oval(8, 7.5, w * 0.6, 2.2, "#a9a6b2");
  a.box(7, 12, 6, 1, "#66636f");
  return finish(a);
}

function drawMushroom() {
  const a = new Art(12, 13);
  a.box(5, 6, 2, 5, "#d8f4f0");
  a.oval(6, 5, 4.4, 3, "#35d6c8");
  a.dot(4, 4, "#c8fff8");
  a.dot(7, 3, "#c8fff8");
  return finish(a, { outline: "#0f3a44" });
}

function drawSkull() {
  const a = new Art(16, 13);
  a.oval(8, 6, 5.5, 4.4, "#e6e0d0");
  a.box(5, 9, 6, 2, "#e6e0d0");
  a.box(5, 5, 2, 2, INK);
  a.box(9, 5, 2, 2, INK);
  a.dot(8, 8, INK);
  return finish(a);
}

function drawSpike() {
  const a = new Art(16, 26);
  a.shape([[3, 24], [7, 2], [13, 24]], "#2a2236");
  a.shape([[3, 24], [7, 2], [7, 24]], "#4a3a66");
  a.shape([[9, 24], [12, 12], [15, 24]], "#2a2236");
  a.line(7, 4, 6, 20, "#c04a9a");
  return finish(a);
}

function drawPeak(snowy, look) {
  const a = new Art(30, 44);
  const tip = [15 + (look - 1) * 3, 3 + look * 3];
  a.shape([[1, 42], [tip[0] - 4, tip[1] + 8], tip, [tip[0] + 5, tip[1] + 9], [29, 42]], "#7e7b88");
  a.shape([tip, [tip[0] + 5, tip[1] + 9], [29, 42], [tip[0] + 2, 42], [tip[0] + 1, tip[1] + 14]], "#5c5966");
  a.shape([[1, 42], [tip[0] - 4, tip[1] + 8], [tip[0] - 3, tip[1] + 14], [6, 42]], "#9a97a4");
  if (snowy) a.shape([[tip[0] - 4, tip[1] + 8], tip, [tip[0] + 5, tip[1] + 9], [tip[0] + 2, tip[1] + 13], [tip[0], tip[1] + 9], [tip[0] - 2, tip[1] + 13]], "#f4f8fc");
  a.speckle("#6a6774", 0.05, 40 + look);
  return finish(a, { shade: false });
}

function drawLantern() {
  const a = new Art(12, 24);
  a.box(5, 9, 2, 13, "#3a3644");
  a.box(3, 21, 6, 1, "#3a3644");
  a.box(2, 3, 8, 7, "#3a3644");
  a.box(3, 4, 6, 5, "#ffe9a0");
  a.box(5, 5, 2, 3, "#ffffff");
  a.box(3, 1, 6, 2, "#55506a");
  return finish(a, { shade: false });
}

function drawSign() {
  const a = new Art(16, 18);
  a.box(7, 9, 2, 7, "#6a4628");
  a.box(2, 2, 12, 8, "#b8864e");
  a.box(4, 4, 8, 1, "#6a4628");
  a.box(4, 6, 6, 1, "#6a4628");
  return finish(a);
}

function drawWell() {
  const a = new Art(28, 30);
  a.box(4, 6, 2, 16, "#6a4628");
  a.box(22, 6, 2, 16, "#6a4628");
  a.shape([[1, 8], [14, 1], [27, 8]], "#b84a3a");
  a.shape([[14, 1], [27, 8], [14, 8]], "#8f3530");
  a.oval(14, 22, 11, 6, "#8d8a94");
  a.oval(14, 20, 8, 3.4, "#1d3a5c");
  a.oval(12, 19.5, 3, 1, "#4a8ad0");
  a.box(13, 8, 1, 8, "#d8c8a8");
  a.box(11, 15, 5, 4, "#8a5a30");
  a.speckle("#6f6c78", 0.1, 51);
  return finish(a);
}

function drawHouse(look, big) {
  const w = big ? 72 : 54;
  const h = big ? 66 : 54;
  const a = new Art(w, h);
  const roofs = [["#c2523f", "#93382f", "#e07a5a"], ["#4d74ad", "#34527f", "#7aa0d8"], ["#5f8f4e", "#426a38", "#8aba6c"], ["#7a3f8f", "#532a66", "#a865c0"]];
  const roof = roofs[big ? 3 : look];
  const wallTop = big ? 34 : 28;
  const wallH = h - wallTop - 2;
  a.box(4, wallTop, w - 8, wallH, "#efe0b8");
  a.box(4, wallTop + wallH - 4, w - 8, 4, "#8d8a94");                 // stone at the bottom
  for (const x of [4, w / 2 - 1, w - 6]) a.box(x, wallTop, 2, wallH - 4, "#7a5230");   // timber beams
  a.box(4, wallTop + 8, w - 8, 2, "#7a5230");
  // Door and windows
  const doorW = big ? 14 : 9;
  a.box(w / 2 - doorW / 2, h - 2 - 17, doorW, 17, "#6a4628");
  a.box(w / 2 - doorW / 2 + 1, h - 2 - 16, doorW - 2, 15, "#8f6238");
  if (big) a.box(w / 2 - 1, h - 19, 1, 17, "#6a4628");
  a.dot(w / 2 + doorW / 2 - 3, h - 10, "#ffd84a");
  for (const x of [big ? 11 : 9, w - (big ? 21 : 18)]) {
    a.box(x, wallTop + 12, 10, 9, "#5c3c22");
    a.box(x + 1, wallTop + 13, 8, 7, "#9fd0e8");
    a.box(x + 5, wallTop + 13, 1, 7, "#5c3c22");
    a.box(x + 1, wallTop + 16, 8, 1, "#5c3c22");
    a.box(x - 1, wallTop + 21, 12, 1, "#b84a6a");                     // flower box
    a.dot(x + 1, wallTop + 20, "#ff8ab0");
    a.dot(x + 5, wallTop + 20, "#ffe14a");
    a.dot(x + 8, wallTop + 20, "#ff8ab0");
  }
  // Roof with rows of tiles
  a.box(w - 16, 2, 7, 12, "#8d8a94");
  a.box(w - 17, 1, 9, 2, "#6f6c78");
  a.shape([[0, wallTop + 3], [8, 6], [w - 8, 6], [w, wallTop + 3]], roof[0]);
  for (let y = 10; y < wallTop + 3; y += 5) {
    const inset = 8 - ((y - 6) / (wallTop - 3)) * 8;
    a.box(inset, y, w - inset * 2, 1, roof[1]);
    for (let x = inset + 2 + ((y / 5) % 2) * 3; x < w - inset - 1; x += 6) a.box(x, y - 2, 1, 2, roof[1]);
  }
  a.box(8, 6, w - 16, 2, roof[2]);
  a.box(0, wallTop + 2, w, 2, roof[1]);
  if (big) {
    // The Dragon Tamers' banner
    a.box(w / 2 - 6, wallTop - 2, 12, 16, "#b8323f");
    a.shape([[w / 2 - 6, wallTop + 14], [w / 2, wallTop + 10], [w / 2 + 6, wallTop + 14], [w / 2 + 6, wallTop + 13], [w / 2 - 6, wallTop + 13]], "#b8323f");
    a.oval(w / 2, wallTop + 5, 3.4, 3.4, "#ffd84a");
    a.oval(w / 2 + 1, wallTop + 4.4, 2, 2, "#b8323f");
    a.box(w / 2 - 7, wallTop - 3, 14, 2, "#ffd84a");
  }
  return finish(a);
}

function drawBeacon() {
  const a = new Art(22, 30);
  a.box(6, 14, 10, 13, "#8d8a94");
  a.box(4, 26, 14, 3, "#6f6c78");
  a.shape([[1, 8], [21, 8], [17, 15], [5, 15]], "#a9a6b2");
  a.box(3, 8, 16, 2, "#3a3440");
  a.box(9, 18, 4, 1, "#ff7a1a");
  a.box(10, 20, 2, 4, "#ff7a1a");
  a.speckle("#77747f", 0.08, 61);
  return finish(a);
}

function drawFlame(frame) {
  const a = new Art(12, 16);
  const lean = [0, 1, -1][frame];
  a.shape([[2, 14], [6 + lean, 1], [10, 14]], "#ff7a1a");
  a.oval(6, 11, 4, 3.4, "#ff7a1a");
  a.shape([[4, 14], [6 + lean, 6], [8, 14]], "#ffd84a");
  a.oval(6, 12, 2, 2, "#fff6c0");
  return finish(a, { outline: null, shade: false });
}

function drawThorns() {
  const a = new Art(20, 22);
  const vine = "#3d5a34";
  for (let i = 0; i < 5; i++) {
    a.line(1 + i * 4, 20, 5 + ((i * 7) % 12), 3 + ((i * 5) % 6), vine);
    a.line(18 - i * 4, 20, 3 + ((i * 5) % 13), 5 + ((i * 3) % 7), "#2c4428");
  }
  a.oval(10, 14, 8, 6, "#34502e");
  a.speckle("#22381f", 0.25, 71);
  for (const [x, y] of [[3, 6], [8, 3], [14, 5], [17, 9], [5, 12], [12, 10], [9, 16], [15, 15], [2, 16]]) {
    a.dot(x, y, "#e8e0c0");
    a.dot(x + 1, y + 1, "#b03a5a");
  }
  return finish(a);
}

function drawNest() {
  const a = new Art(28, 18);
  a.oval(14, 10, 12, 6, "#7a5230");
  a.oval(14, 9, 8.5, 3.6, "#4a3020");
  for (let i = 0; i < 9; i++) a.line(3 + i * 2.6, 12 + (i % 2), 5 + i * 2.6, 8 + ((i * 3) % 4), "#c8a060");
  return finish(a);
}

function drawCampfire() {
  const a = new Art(16, 10);
  a.line(2, 7, 13, 4, "#6a4628");
  a.line(2, 4, 13, 7, "#5c3c22");
  a.oval(8, 6, 3, 1.6, "#3a2a20");
  return finish(a);
}

function drawPillar(darkOne) {
  const a = new Art(16, darkOne ? 32 : 26);
  const h = darkOne ? 32 : 26;
  const stone = darkOne ? "#2e2838" : "#b4b0a8";
  const edge = darkOne ? "#463c5a" : "#d2cec4";
  a.box(4, darkOne ? 2 : 5, 8, h - (darkOne ? 6 : 9), stone);
  a.box(4, darkOne ? 2 : 5, 2, h - (darkOne ? 6 : 9), edge);
  a.box(2, h - 5, 12, 4, stone);
  if (darkOne) {
    a.box(2, 1, 12, 3, stone);
    a.box(7, 9, 2, 2, "#ff3b4a");
    a.box(7, 14, 2, 5, "#ff3b4a");
  } else {
    a.shape([[4, 5], [7, 2], [9, 6], [12, 4], [12, 6]], stone);
    a.box(5, 12, 3, 2, "#6aa04a");
    a.dot(10, 18, "#6aa04a");
  }
  return finish(a);
}

function drawStatue() {
  const a = new Art(30, 40);
  a.box(5, 30, 20, 8, "#8d8a94");
  a.box(3, 36, 24, 3, "#6f6c78");
  a.box(7, 28, 16, 3, "#a9a6b2");
  a.g.drawImage(drawDragon(0.62, DRAGON_COLOURS.stone, 0, false), 0, 7);
  return finish(a, { shade: false });
}

function drawTemple() {
  const a = new Art(150, 112);
  const stone = ["#2b2634", "#3a3346", "#1c1824"];
  const tiers = [[3, 72, 144, 38], [17, 48, 116, 26], [33, 26, 84, 24], [53, 8, 44, 20]];
  for (const [x, y, w, h] of tiers) {
    a.box(x, y, w, h, stone[0]);
    a.box(x, y, w, 3, stone[1]);
    for (let by = y + 8; by < y + h; by += 6) {
      a.box(x, by, w, 1, stone[2]);
      for (let bx = x + 4 + ((by / 6) % 2) * 6; bx < x + w; bx += 12) a.box(bx, by - 5, 1, 5, stone[2]);
    }
    for (let rx = x + 10; rx < x + w - 6; rx += 22) a.box(rx, y + 5, 2, 2, "#b0203a");   // glowing red runes
  }
  // The stairs up the middle, and the dark doorway
  a.shape([[58, 110], [66, 50], [84, 50], [92, 110]], stone[1]);
  for (let y = 54; y < 110; y += 4) a.box(58 + (66 - 58) * (1 - (y - 50) / 60), y, 34 - 16 * (1 - (y - 50) / 60) + 0, 1, stone[2]);
  a.box(64, 78, 22, 32, "#0a0810");
  a.box(67, 84, 16, 26, "#5a0f24");
  a.box(70, 90, 10, 20, "#c02038");
  a.box(73, 96, 4, 14, "#ff5a3a");
  a.shape([[64, 78], [75, 68], [86, 78]], stone[2]);
  // A burning red gem at the very top
  a.shape([[75, 0], [82, 7], [75, 14], [68, 7]], "#ff3b4a");
  a.shape([[75, 3], [79, 7], [75, 11], [71, 7]], "#ffb0a0");
  return finish(a, { shade: false });
}

function drawCactus() {
  const a = new Art(18, 26);
  a.box(7, 4, 4, 20, "#3f9a4a");
  a.box(2, 9, 3, 7, "#3f9a4a");
  a.box(2, 14, 6, 3, "#3f9a4a");
  a.box(13, 6, 3, 8, "#3f9a4a");
  a.box(10, 12, 6, 3, "#3f9a4a");
  a.box(8, 5, 1, 18, "#6cc86a");
  a.dot(8, 3, "#ff8ab0");
  a.dot(14, 5, "#ff8ab0");
  return finish(a);
}

function drawPalm() {
  const a = new Art(38, 46);
  a.shape([[17, 44], [19, 16], [22, 16], [22, 44]], "#a8743c");
  for (let y = 20; y < 44; y += 4) a.box(18, y, 4, 1, "#7a5230");
  const leaf = "#3a9a4a";
  for (const [x, y] of [[3, 12], [6, 22], [34, 11], [32, 22], [10, 4], [28, 3]]) {
    a.shape([[20, 14], [(20 + x) / 2, y - 5], [x, y], [(20 + x) / 2 + 1, y + 2]], leaf);
    a.line(20, 14, x, y, "#6cc86a");
  }
  a.oval(20, 15, 3, 2.4, "#7a5230");
  return finish(a);
}

function drawIceSpire() {
  const a = new Art(16, 26);
  a.shape([[3, 24], [7, 2], [13, 24]], "#8fd0f0");
  a.shape([[3, 24], [7, 2], [7, 24]], "#d8f4ff");
  a.shape([[9, 24], [12, 12], [15, 24]], "#6ab4e0");
  a.line(8, 6, 9, 20, "#ffffff");
  return finish(a, { outline: "#2a5a8a" });
}

function drawIceWall() {
  const a = new Art(20, 26);
  a.box(1, 3, 18, 21, "#9ad8f5");
  a.shape([[1, 3], [6, 0], [10, 3], [15, 1], [19, 3]], "#d8f4ff");
  a.box(2, 4, 3, 18, "#d8f4ff");
  a.line(8, 6, 12, 14, "#ffffff");
  a.line(12, 14, 9, 21, "#ffffff");
  a.box(14, 8, 3, 13, "#6ab4e0");
  return finish(a, { outline: "#2a5a8a" });
}

// A gem to collect, in any colour
function drawGem(colour) {
  const a = new Art(12, 14);
  a.shape([[6, 1], [10, 6], [6, 12], [2, 6]], colour);
  a.shape([[6, 1], [6, 12], [2, 6]], tone(colour, 1.3));
  a.box(5, 4, 1, 3, "#ffffff");
  return finish(a);
}

// The same sprite, but bigger (for bosses)
function scaled(canvas, times) {
  const copy = makeCanvas(Math.round(canvas.width * times), Math.round(canvas.height * times));
  const g = copy.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(canvas, 0, 0, copy.width, copy.height);
  return copy;
}

function drawDig(dug) {
  const a = new Art(14, 10);
  if (dug) {
    a.oval(7, 5, 5, 3, "#4a3020");
    a.oval(7, 5.5, 3, 1.6, "#2a1a10");
  } else {
    a.line(3, 2, 10, 7, "#7a4a2a");
    a.line(10, 2, 3, 7, "#7a4a2a");
  }
  return finish(a, { outline: null, shade: false });
}

function drawHeart() {
  const a = new Art(11, 10);
  a.box(2, 2, 3, 3, "#ff4a5a");
  a.box(6, 2, 3, 3, "#ff4a5a");
  a.box(2, 4, 7, 2, "#ff4a5a");
  a.box(3, 6, 5, 1, "#ff4a5a");
  a.box(4, 7, 3, 1, "#ff4a5a");
  a.dot(5, 8, "#ff4a5a");
  a.dot(3, 3, "#ffc0c8");
  return finish(a);
}

// A soft round glow, used for lights
function drawGlow(size, colour) {
  const canvas = makeCanvas(size, size);
  const g = canvas.getContext("2d");
  const fade = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fade.addColorStop(0, colour);
  fade.addColorStop(1, "rgba(0, 0, 0, 0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, size, size);
  return canvas;
}

// ---------------------------------------------------------------------------
// Build every sprite once, when the game starts
// ---------------------------------------------------------------------------

function buildSprites() {
  const s = {};
  const saga = typeof STORY !== "undefined" && STORY ? STORY : null;     // Dragon Tamers 2, 3 and 4 bring their own heroes and dragons
  if (saga && saga.looks) Object.assign(LOOKS, saga.looks);
  const young = DRAGON_COLOURS[saga ? saga.dragon[0] : "ember"];
  const grownUp = DRAGON_COLOURS[saga ? saga.dragon[1] : "gold"];
  for (const name in LOOKS) s[name] = personSet(LOOKS[name]);
  s.dog = [[drawDog(0), drawDog(1)]];
  s.dog.push(s.dog[0].map(flipped));              // s.dog[0] faces right, s.dog[1] faces left

  // Dragons: [facing][wing frame], for standing and for flying
  function dragonSet(k, colours) {
    const set = { stand: [[], []], fly: [[], []] };
    for (let frame = 0; frame < 3; frame++) {
      const stand = drawDragon(k, colours, frame, false);
      const fly = drawDragon(k, colours, frame, true);
      set.stand[0].push(stand);
      set.stand[1].push(flipped(stand));
      set.fly[0].push(fly);
      set.fly[1].push(flipped(fly));
    }
    return set;
  }
  s.hatchling = [[], []];
  for (let frame = 0; frame < 2; frame++) {
    for (let step = 0; step < 2; step++) {
      const baby = drawHatchling(young, frame, step);
      s.hatchling[0].push(baby);
      s.hatchling[1].push(flipped(baby));
    }
  }
  s.drake = dragonSet(1, young);
  s.great = dragonSet(1.35, grownUp);
  s.wyrm = dragonSet(1.7, DRAGON_COLOURS.shadow);
  s.wyrmHurt = s.wyrm.fly.map((list) => list.map((sprite) => tinted(sprite, "#ffffff")));
  s.egg = drawEgg();

  s.monsters = {
    slime: [drawSlime(0), drawSlime(1)],
    bat: [drawBat(0), drawBat(1)],
    spider: [drawSpider(0), drawSpider(1)],
    golem: [drawGolem(0), drawGolem(1)],
    imp: [drawImp(0), drawImp(1)],
  };
  // The same monsters in other colours, for other lands
  const variants = {
    bogSlime: (f) => drawSlime(f, "#6a7a3a", "#aab86a"),
    iceSlime: (f) => drawSlime(f, "#7ac8f0", "#e0f6ff"),
    magmaSlime: (f) => drawSlime(f, "#ff7a1a", "#ffe14a"),
    scorpion: (f) => drawSpider(f, "#c87a3a", "#8a4a22", "#ffe14a"),
    wraith: (f) => drawBat(f, "#9ab0c8", "#e0ecf8", "#3ad8ff"),
    iceGolem: (f) => drawGolem(f, "#9ad0ec", "#6aa8cc", "#ffffff", "#e8f8ff", "#c8ecfa"),
    sandGolem: (f) => drawGolem(f, "#d8b878", "#b08e50", "#ff7a1a", "#8a6a3a", "#ecd49a"),
    shade: (f) => drawImp(f, "#5a3a8a", "#2a1a4a", "#ff5ad8"),
  };
  for (const name in variants) s.monsters[name] = [variants[name](0), variants[name](1)];
  // Bosses: giant versions of monsters, and wyrms in other colours
  function brute(frames, times, crown) {
    const big = frames.map((frame) => scaled(frame, times));
    if (crown) {
      for (const frame of big) {
        const g = frame.getContext("2d");
        g.fillStyle = "#ffd84a";
        g.fillRect(frame.width / 2 - 7, 4, 14, 4);
        for (const x of [-7, -1, 5]) g.fillRect(frame.width / 2 + x, 0, 2, 4);
      }
    }
    return { frames: big, hurt: big.map((frame) => tinted(frame, "#ffffff")), w: big[0].width, feet: big[0].height - Math.round(2 * times) };
  }
  s.brutes = {
    bogKing: brute(s.monsters.bogSlime, 2.6, true),
    broodmother: brute([0, 1].map((f) => drawSpider(f, "#5a1f2a", "#2a1016", "#ffd84a")), 2.8),
    frostGiant: brute(s.monsters.iceGolem, 2),
    sandGiant: brute(s.monsters.sandGolem, 2),
    lavaBrute: brute([0, 1].map((f) => drawGolem(f, "#7a2a22", "#4a1a16", "#ffd84a", "#ff7a1a", "#a84a32")), 2.1),
    shadowKing: brute([0, 1].map((f) => drawPerson({ skin: "#b8a8d8", hair: "#1a1428", style: "long", robe: true, tunic: "#2a2238", trim: "#a03ad8", sleeve: "#1a1428", boots: "#120c18", hat: "#1a1428", hatBand: "#a03ad8", staff: true }, 0, f)), 2),
  };
  s.wyrms = { wyrm: s.wyrm, ice: dragonSet(1.7, DRAGON_COLOURS.iceWyrm), sand: dragonSet(1.7, DRAGON_COLOURS.sandWyrm) };
  for (const name in s.wyrms) s.wyrms[name].hurt = s.wyrms[name].fly.map((list) => list.map((sprite) => tinted(sprite, "#ffffff")));
  s.monstersHurt = {};
  for (const name in s.monsters) s.monstersHurt[name] = s.monsters[name].map((sprite) => tinted(sprite, "#ffffff"));

  s.oak = [drawOak(0), drawOak(1), drawOak(2)];
  s.pine = [drawPine(false)];
  s.snowpine = [drawPine(true)];
  s.doomtree = [drawDoomTree(0), drawDoomTree(1), drawDoomTree(2)];
  s.ashtree = [drawAshTree()];
  s.bush = [drawBush(false)];
  s.berrybush = [drawBush(true)];
  s.rock = [drawRock(0), drawRock(1), drawRock(2)];
  s.mushroom = [drawMushroom()];
  s.skull = [drawSkull()];
  s.spike = [drawSpike()];
  s.peak = [drawPeak(false, 0), drawPeak(false, 1), drawPeak(false, 2)];
  s.snowpeak = [drawPeak(true, 0), drawPeak(true, 1), drawPeak(true, 2)];
  s.lantern = [drawLantern()];
  s.sign = [drawSign()];
  s.well = [drawWell()];
  s.house = [drawHouse(0, false), drawHouse(1, false), drawHouse(2, false)];
  s.hall = [drawHouse(0, true)];
  s.beacon = [drawBeacon()];
  s.flame = [drawFlame(0), drawFlame(1), drawFlame(2)];
  s.thorns = [drawThorns()];
  s.nest = [drawNest()];
  s.campfire = [drawCampfire()];
  s.pillar = [drawPillar(false)];
  s.darkpillar = [drawPillar(true)];
  s.statue = [drawStatue()];
  s.temple = [drawTemple()];
  s.dig = [drawDig(false), drawDig(true)];
  s.cactus = [drawCactus()];
  s.palm = [drawPalm()];
  s.icespire = [drawIceSpire()];
  s.gates = { thorns: s.thorns[0], ice: drawIceWall() };
  s.gems = {};       // filled in as each colour of gem is needed
  s.heart = drawHeart();
  s.heartEmpty = tinted(s.heart, "#3a2a4a");
  const knife = drawBlade(false);
  const sword = drawBlade(true);
  s.knife = [0, 1, 2, 3].map((turns) => turned(knife, turns));     // pointing right, down, left, up
  s.sword = [0, 1, 2, 3].map((turns) => turned(sword, turns));
  s.bird = [drawBird(0), drawBird(1)];

  s.glow = {
    warm: drawGlow(128, "rgba(255, 214, 140, 1)"),
    fire: drawGlow(128, "rgba(255, 150, 60, 1)"),
    cyan: drawGlow(128, "rgba(120, 240, 255, 1)"),
    magic: drawGlow(128, "rgba(190, 220, 255, 1)"),
    red: drawGlow(128, "rgba(255, 70, 80, 1)"),
    white: drawGlow(128, "rgba(255, 255, 255, 1)"),
  };
  return s;
}
