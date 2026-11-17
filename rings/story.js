// Rings of Power: the lands and the rings.
// ../dragon/mapkit.js builds the world from this list (the same kit that builds Dragon Tamers 2, 3 and 4).

// The five rings. needs: the gate that only this ring's power can open.
const RINGS = [
  { name: "Ember Ring", colour: "#ff5a2a", power: "Fire bolt: burns thorns and monsters", cost: 2 },
  { name: "Frost Ring", colour: "#6fc0f5", power: "Frost blast: freezes monsters and puts out fire", cost: 2 },
  { name: "Gale Ring", colour: "#a8f0c8", power: "Gale dash: rush forward and blow things away", cost: 2 },
  { name: "Stone Ring", colour: "#c8a468", power: "Quake: shakes the ground and smashes boulders", cost: 3 },
  { name: "Dawn Ring", colour: "#ffe14a", power: "Dawn light: a burst of sunlight all around you", cost: 4 },
];

const SPEC = {
  cols: 3,
  rows: 2,
  order: [[0, 1], [1, 1], [2, 1], [2, 0], [1, 0], [0, 0]],
  regions: [
    { id: "home", name: "Ringhaven", biome: "village", village: true, hall: true, bushes: 2,
      features: [["npc", -2, -2, { id: "elrond", name: "Elrond", look: "elrond" }], ["npc", 3, 2, { id: "smith", name: "Celebrimbor", look: "celebrimbor" }]] },
    { id: "cinder", name: "Cinder Hollow", biome: "ash", bushes: 2 },
    { id: "frost", name: "Frostmere", biome: "ice", gate: { look: "thorns", needs: 1 }, bushes: 2 },
    { id: "gale", name: "Galecrest", biome: "crag", gate: { look: "flame", needs: 2 }, bushes: 2 },
    { id: "stone", name: "Stonedeep", biome: "canyon", gate: { look: "mist", needs: 3 }, bushes: 2, features: [["npc", 8, 3, { id: "durin", name: "Durin", look: "durin" }]] },
    { id: "keep", name: "The Shadow Keep", biome: "shadow", arena: true, gate: { look: "boulder", needs: 4 }, bushes: 1 },
  ],
  story: {
    dragon: ["ember", "gold"],       // (the sprite kit expects these; this game has no dragons)
    steps: [],
    // What the people look like (the names are from the series; the story is this game's own)
    looks: {
      galadriel: { skin: "#f6dcc0", blush: "#f0a8a0", hair: "#f6e08a", style: "long", tunic: "#c8d0dc", trim: "#ffffff", sleeve: "#aab2c0", pants: "#5a6272", boots: "#3a3a46", belt: "#ffd84a", cape: "#2a6a5a" },
      elrond: { skin: "#f2c79a", hair: "#3a2a20", style: "long", robe: true, tunic: "#3d6fa5", trim: "#ffd84a", boots: "#2a3a5a" },
      celebrimbor: { skin: "#eec39a", hair: "#7a5230", style: "long", robe: true, tunic: "#8a3a3a", trim: "#ffd84a", boots: "#4a2020" },
      durin: { size: "teen", skin: "#e8b88a", hair: "#c8502a", style: "short", beard: "#c8502a", tunic: "#5a6272", trim: "#ffd84a", sleeve: "#4a5262", pants: "#4a3020", boots: "#2a2020", belt: "#ffd84a" },
    },
    // Each ring is guarded by a giant in the middle of its land
    bosses: [
      { id: 0, name: "The Cinder Brute", look: "lavaBrute", hp: 18, region: "cinder" },
      { id: 1, name: "The Frost Giant", look: "frostGiant", hp: 26, region: "frost" },
      { id: 2, name: "The Storm Mother", look: "broodmother", hp: 32, region: "gale" },
      { id: 3, name: "The Stone Giant", look: "sandGiant", hp: 40, region: "stone" },
      { id: 4, name: "Sauron", look: "shadowKing", hp: 60, region: "keep" },
    ],
  },
};
startSaga(SPEC);
