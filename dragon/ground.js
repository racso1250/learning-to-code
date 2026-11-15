// Painting the ground, pixel by pixel, so the edges between grass, sand,
// paths and water come out wobbly and natural instead of square.

// "rank" decides who grows over whom: grass (5) creeps over a path (2), which lies on sand (1)...
const TERRAIN = {
  W: { rank: 0 },
  L: { rank: 0 },
  S: { rank: 1, colours: ["#e8d28c", "#dcc27a", "#f3e3a8", "#c9ae68"] },
  D: { rank: 2, colours: ["#b98f5a", "#a87e4d", "#caa36e", "#8f6a40"] },
  B: { rank: 2.2, colours: ["#a8743c", "#96652f", "#bb8749", "#6e4a26"] },
  C: { rank: 2.5, colours: ["#aaa49b", "#99938a", "#bcb6ad", "#7d766e"] },
  T: { rank: 2.6, colours: ["#322d3c", "#2a2533", "#3b3547", "#1c1824"] },
  M: { rank: 1.6, colours: ["#5c5438", "#4f482f", "#6c6242", "#3d3925"] },   // marsh mud (Dragon Tamers 2 to 4)
  I: { rank: 3.3, colours: ["#bfe3f5", "#a9d6ee", "#dff3fc", "#8fc4e0"] },   // ice
  A: { rank: 3, colours: ["#4b4552", "#403a47", "#57505f", "#2f2a35"] },
  R: { rank: 3.2, colours: ["#8f8c97", "#807d88", "#a19ea9", "#6b6874"] },
  P: { rank: 3.4, colours: ["#6f6c78", "#63606c", "#7c7985", "#55525e"] },
  F: { rank: 4, colours: ["#2d463c", "#263c35", "#365446", "#1d2f2c"] },
  G: { rank: 5, colours: ["#5fae4b", "#52a044", "#72c058", "#3f8a3a"] },
  N: { rank: 6, colours: ["#eef4fa", "#dde8f3", "#ffffff", "#c6d6e8"] },
};

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
for (const letter in TERRAIN) {
  if (TERRAIN[letter].colours) TERRAIN[letter].rgb = TERRAIN[letter].colours.map(hexToRgb);
}

// Which of a terrain's 4 colours (0 main, 1 darker, 2 lighter, 3 darkest) goes on this pixel?
function shadeAt(letter, x, y) {
  if (letter === "C") {
    // Cobblestones: rows of stones with dark gaps between them
    const row = Math.floor(y / 6);
    const sx = x + (row % 2) * 4;
    if (y % 6 === 0 || sx % 8 === 0) return 3;
    return Math.floor(hash(Math.floor(sx / 8), row, 21) * 3);
  }
  if (letter === "T") {
    if (x % 16 === 0 || y % 16 === 0) return 3;
    return hash(Math.floor(x / 16), Math.floor(y / 16), 22) < 0.3 ? 1 : hash(x, y, 23) < 0.04 ? 2 : 0;
  }
  if (letter === "B") {
    if (y % 4 === 0) return 3;
    return Math.floor(hash(0, Math.floor(y / 4), 24) * 3);
  }
  const blob = smoothNoise(x, y, 3.2, 30);
  const speck = hash(x, y, 31);
  if (letter === "G" || letter === "F") {
    // Little blades of grass: a dark pixel with another one under it
    if (speck < 0.045 || hash(x, y - 1, 31) < 0.045) return 3;
    if (speck > 0.975) return 2;
  } else if (speck < 0.02) return 3;
  else if (speck > 0.985) return 2;
  return blob < 0.36 ? 1 : blob > 0.68 ? 2 : 0;
}

// The world is painted in square pieces ("chunks") of 32 x 32 squares, only when you get near them.
// That way even a gigantic world starts quickly and doesn't fill up the computer's memory.
const CHUNK = 32;
const CHUNK_PIXELS = CHUNK * TILE;
const chunkCache = new Map();
let chunkClock = 0;

function groundChunk(cx, cy) {
  const name = cx + "," + cy;
  let chunk = chunkCache.get(name);
  if (!chunk) {
    chunk = paintChunk(cx, cy);
    chunkCache.set(name, chunk);
    if (chunkCache.size > 36) {
      // Too many pieces remembered: forget the one that was looked at longest ago
      let oldest = null;
      for (const [key, value] of chunkCache) if (!oldest || value.used < chunkCache.get(oldest).used) oldest = key;
      chunkCache.delete(oldest);
    }
  }
  chunk.used = ++chunkClock;
  return chunk;
}

function paintChunk(cx, cy) {
  // Paint one extra square all the way round, so the shoreline joins up with the next piece
  const tx0 = cx * CHUNK - 1;
  const ty0 = cy * CHUNK - 1;
  const tiles = CHUNK + 2;
  const W = tiles * TILE;
  const H = tiles * TILE;
  const ground = makeCanvas(CHUNK_PIXELS, CHUNK_PIXELS);
  const g = ground.getContext("2d");
  const image = g.createImageData(W, H);
  const data = image.data;
  const map = WORLD.ground;
  const kindAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? "W" : map[ty][tx]);
  // The 8 neighbours of a square: [dx, dy]
  const around = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

  for (let ty = ty0; ty < ty0 + tiles; ty++) {
    for (let tx = tx0; tx < tx0 + tiles; tx++) {
      const own = kindAt(tx, ty);
      const ownRank = TERRAIN[own].rank;
      const higher = [];
      for (const [dx, dy] of around) {
        const other = kindAt(tx + dx, ty + dy);
        if (TERRAIN[other].rank > ownRank) higher.push([dx, dy, other]);
      }
      if (ownRank === 0 && higher.length === 0) continue;       // open water: nothing to paint
      const patch = 0.93 + 0.14 * smoothNoise(tx, ty, 5, 33);   // big soft light and dark patches
      for (let py = 0; py < TILE; py++) {
        for (let px = 0; px < TILE; px++) {
          const x = tx * TILE + px;         // where this pixel is in the whole world
          const y = ty * TILE + py;
          let kind = own;
          let rank = ownRank;
          let shadow = false;
          for (const [dx, dy, other] of higher) {
            // How far is this pixel from that neighbour's edge?
            const ex = dx === 0 ? 0 : dx > 0 ? TILE - 1 - px : px;
            const ey = dy === 0 ? 0 : dy > 0 ? TILE - 1 - py : py;
            const distance = dx !== 0 && dy !== 0 ? Math.hypot(ex, ey) : ex + ey;
            const along = dx === 0 ? smoothNoise(x, ty + dy, 5, 34) : dy === 0 ? smoothNoise(tx + dx, y, 5, 35) : 0.5;
            const depth = 2 + along * 4 + (ownRank === 0 ? 1.5 : 0);
            if (distance < depth) {
              if (TERRAIN[other].rank > rank) {
                kind = other;
                rank = TERRAIN[other].rank;
              }
            } else if (distance < depth + 1.3) shadow = true;
          }
          if (kind === "W" || kind === "L") continue;     // leave a hole: the moving water shows through
          const i = ((y - ty0 * TILE) * W + (x - tx0 * TILE)) * 4;
          const rgb = TERRAIN[kind].rgb[shadeAt(kind, x, y)];
          const light = patch * (shadow && kind === own ? 0.8 : 1);
          data[i] = Math.min(255, rgb[0] * light);
          data[i + 1] = Math.min(255, rgb[1] * light);
          data[i + 2] = Math.min(255, rgb[2] * light);
          data[i + 3] = 255;
        }
      }
    }
  }
  g.putImageData(image, -TILE, -TILE);

  // ----- Flowers, pebbles and other tiny details -----
  const flowerColours = ["#ffffff", "#ff8ab0", "#ffe14a", "#8ac4ff", "#ff6a4a", "#d8a0ff"];
  g.save();
  g.translate(-cx * CHUNK_PIXELS, -cy * CHUNK_PIXELS);
  for (let ty = Math.max(1, cy * CHUNK); ty < Math.min(MAP_H - 1, (cy + 1) * CHUNK); ty++) {
    for (let tx = Math.max(1, cx * CHUNK); tx < Math.min(MAP_W - 1, (cx + 1) * CHUNK); tx++) {
      const kind = map[ty][tx];
      const roll = hash(tx, ty, 41);
      const x = tx * TILE + 2 + Math.floor(hash(tx, ty, 42) * 10);
      const y = ty * TILE + 2 + Math.floor(hash(tx, ty, 43) * 10);
      if (kind === "G") {
        const region = typeof moodAt === "function" ? moodAt(tx, ty) : regionAt(tx, ty);
        const chance = region === "meadow" ? 0.45 : region === "village" ? 0.25 : 0.12;
        if (roll < chance) {
          const count = region === "meadow" ? 3 : 1;
          for (let n = 0; n < count; n++) {
            const fx = tx * TILE + 2 + Math.floor(hash(tx + n * 7, ty, 44) * 11);
            const fy = ty * TILE + 2 + Math.floor(hash(tx, ty + n * 7, 45) * 11);
            g.fillStyle = "#2f7d3a";
            g.fillRect(fx, fy + 1, 1, 2);
            g.fillStyle = flowerColours[Math.floor(hash(tx + n, ty + n, 46) * flowerColours.length)];
            g.fillRect(fx - 1, fy, 3, 1);
            g.fillRect(fx, fy - 1, 1, 3);
            g.fillStyle = "#ffd84a";
            g.fillRect(fx, fy, 1, 1);
          }
        } else if (roll > 0.8) {
          g.fillStyle = "#3f8a3a";               // a tuft of long grass
          g.fillRect(x, y, 1, 3);
          g.fillRect(x - 2, y + 1, 1, 2);
          g.fillRect(x + 2, y + 1, 1, 2);
          g.fillStyle = "#86cf68";
          g.fillRect(x - 1, y - 1, 1, 2);
          g.fillRect(x + 1, y - 1, 1, 2);
        }
      } else if ((kind === "F" || kind === "M") && roll < 0.2) {
        g.fillStyle = roll < 0.1 ? "#6a4a3a" : "#4a3a5a";   // fallen leaves
        g.fillRect(x, y, 2, 1);
        g.fillRect(x + 4, y + 3, 1, 1);
      } else if ((kind === "S" || kind === "D" || kind === "R") && roll < 0.25) {
        g.fillStyle = kind === "S" ? "#fff6d8" : "#6b6460";  // shells and pebbles
        g.fillRect(x, y, 2, 1);
        g.fillStyle = "rgba(0, 0, 0, 0.25)";
        g.fillRect(x, y + 1, 2, 1);
      } else if (kind === "A" && roll < 0.3) {
        g.fillStyle = "#211c26";                  // cracks, with a glowing ember inside
        g.fillRect(x, y, 5, 1);
        g.fillRect(x + 4, y + 1, 1, 3);
        g.fillStyle = "#ff7a1a";
        g.fillRect(x + 2, y, 1, 1);
      } else if ((kind === "N" || kind === "I") && roll < 0.2) {
        g.fillStyle = kind === "I" ? "#ffffff" : "#b9cce2";  // sparkles on ice, dips in snow
        g.fillRect(x, y, 3, 1);
      }
    }
  }
  g.restore();

  // ----- The shoreline: pale shallow water and white foam around every coast -----
  // First work out, for every water pixel, how far it is from land.
  const far = 12;
  const distance = new Float32Array(W * H);
  let anyWater = false;
  for (let i = 0; i < W * H; i++) {
    distance[i] = data[i * 4 + 3] > 0 ? 0 : far;
    if (distance[i]) anyWater = true;
  }
  const shore = makeCanvas(CHUNK_PIXELS, CHUNK_PIXELS);
  const foam = makeCanvas(CHUNK_PIXELS, CHUNK_PIXELS);
  if (!anyWater) return { ground: ground, shore: shore, foam: foam, dry: true };
  for (let pass = 0; pass < 2; pass++) {
    const step = pass === 0 ? 1 : -1;
    for (let y = pass === 0 ? 1 : H - 2; y > 0 && y < H - 1; y += step) {
      for (let x = pass === 0 ? 1 : W - 2; x > 0 && x < W - 1; x += step) {
        const i = y * W + x;
        const best = Math.min(distance[i - step] + 1, distance[i - step * W] + 1, distance[i - step * W - step] + 1.4, distance[i - step * W + step] + 1.4);
        if (best < distance[i]) distance[i] = best;
      }
    }
  }
  const shoreImage = shore.getContext("2d").createImageData(W, H);
  const foamImage = foam.getContext("2d").createImageData(W, H);
  const sd = shoreImage.data;
  const fd = foamImage.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = distance[y * W + x];
      if (d <= 0 || d >= far) continue;
      const i = (y * W + x) * 4;
      const wx = x + tx0 * TILE;
      const wy = y + ty0 * TILE;
      if (kindAt(wx >> 4, wy >> 4) === "L") {
        if (d < 2.6) { sd[i] = 70; sd[i + 1] = 22; sd[i + 2] = 18; sd[i + 3] = 230; }       // dark crust
        else if (d < 6) { sd[i] = 255; sd[i + 1] = 226; sd[i + 2] = 120; sd[i + 3] = 90; }
      } else {
        if (d < 9) { sd[i] = 150; sd[i + 1] = 226; sd[i + 2] = 255; sd[i + 3] = Math.round((1 - d / 9) * 130); }
        const ripple = d + smoothNoise(wx, wy, 4, 36) * 1.5;
        if (d < 1.8 || (ripple > 4.6 && ripple < 5.6)) { fd[i] = 255; fd[i + 1] = 255; fd[i + 2] = 255; fd[i + 3] = d < 1.8 ? 230 : 120; }
      }
    }
  }
  shore.getContext("2d").putImageData(shoreImage, -TILE, -TILE);
  foam.getContext("2d").putImageData(foamImage, -TILE, -TILE);
  return { ground: ground, shore: shore, foam: foam, dry: false };
}

// A square of moving liquid that repeats perfectly, so it can scroll forever.
// (It is built from waves whose lengths all divide into 64.)
function makeLiquid(colours, streaksOnly) {
  const size = 64;
  const canvas = makeCanvas(size + TILE, size + TILE);
  const g = canvas.getContext("2d");
  const turn = (Math.PI * 2) / size;
  for (let y = 0; y < size + TILE; y++) {
    for (let x = 0; x < size + TILE; x++) {
      const wave = Math.sin((x + y * 2) * turn) + Math.sin((x * 3 - y) * turn * 2) * 0.6 + Math.sin((x * 2 + y * 5) * turn) * 0.5;
      const streak = Math.sin((x * 2 + Math.sin(y * turn * 2) * 6) * turn) + Math.sin(y * turn * 4) * 0.8;
      let colour = null;
      if (streaksOnly) {
        if (streak > 1.55) colour = colours[3];
      } else {
        colour = wave > 0.9 ? colours[2] : wave < -0.9 ? colours[0] : colours[1];
      }
      if (!colour) continue;
      g.fillStyle = colour;
      g.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}
