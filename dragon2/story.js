// Dragon Tamers 2: The Frozen Crown.
// This file is the whole game's map and story, written as two lists.
// ../dragon/mapkit.js builds the world from "regions", and ../dragon/game.js runs the "steps".

const SPEC = {
  cols: 3,
  rows: 3,
  // Where each land goes on a 3 x 3 grid, in the order you travel through them: [across, down]
  order: [[0, 2], [1, 2], [2, 2], [2, 1], [1, 1], [0, 1], [0, 0], [1, 0], [2, 0]],
  regions: [
    { id: "home", name: "Emberwick Village", biome: "village", village: true, hall: true, bushes: 1,
      features: [["npc", -2, -2, { id: "elder", name: "The Old Tamer", look: "elder", line: "The north wind grows colder every day. Hurry, young Tamer." }],
                 ["npc", 3, 2, { id: "lily", name: "Lily", look: "lily", line: "Brrr! Is it meant to snow in summer?" }]] },
    { id: "fields", name: "The Harvest Fields", biome: "meadow", bushes: 2, dig: true, pickups: { item: "seed", name: "Sun Seed", colour: "#ffd84a", count: 4 } },
    { id: "marsh", name: "Mistmarsh", biome: "marsh", bushes: 1, features: [["beacon", -9, -6, { name: "the Marsh Beacon" }]] },
    { id: "pinewood", name: "The Pinewood", biome: "pines", gate: { look: "thorns", needs: 1 }, bushes: 1, dig: true, features: [["beacon", 10, 6, { name: "the Pinewood Beacon" }]] },
    { id: "foothills", name: "The Frostfang Foothills", biome: "crag", camp: true, bushes: 1, pickups: { item: "ember", name: "Ember Stone", colour: "#ff5a3a", count: 4 },
      features: [["npc", -2, -2, { id: "hermit", name: "Hermit Bryn", look: "finn", line: "Mind the golems. They don't care for visitors." }]] },
    { id: "frozenlake", name: "The Frozen Lake", biome: "ice", gate: { look: "ice", needs: 2 }, features: [["beacon", -10, 6, { name: "the Lake Beacon" }]] },
    { id: "snowdrift", name: "Snowdrift Village", biome: "snow", village: true, monsters: null, rocky: 0, bushes: 2,
      features: [["npc", -2, -2, { id: "chief", name: "Chief Asta", look: "grandma", line: "Keep warm, my dears. And keep that dragon away from my roof." }]] },
    { id: "glacier", name: "Glacier Pass", biome: "snow", gate: { look: "ice", needs: 2 }, dig: true, pickups: { item: "crystal", name: "Frost Crystal", colour: "#6fc0f5", count: 5 },
      features: [["beacon", 9, -6, { name: "the Glacier Beacon" }]] },
    { id: "palace", name: "The Ice Palace", biome: "ice", fly: true, arena: true, monsters: ["wraith"], density: 0.03 },
  ],
  story: {
    save: "dragonTamers2Save",
    hero: ["newTeen", "newGrown"],            // what you look like as a teen, and grown up
    dragon: ["frost", "frostGreat"],          // your dragon's colours, young and as a Great Dragon
    looks: { newGrown: { skin: "#d9a273", blush: "#c9806a", hair: "#2b2b3a", style: "long", tunic: "#e07a3a", trim: "#fff1c9", sleeve: "#c0622a", pants: "#4a5a7a", boots: "#5a3a22", cape: "#3d6fa5" } },
    start: { stage: 1, name: "Frost", hp: 6, maxHp: 6 },
    bosses: [
      { id: "bogKing", name: "The Bog King", kind: "brute", look: "bogKing", hp: 16, speed: 24, region: "marsh" },
      { id: "frostGiant", name: "The Frost Giant", kind: "brute", look: "frostGiant", hp: 36, speed: 22, region: "frozenlake" },
      { id: "iceWyrm", name: "The Ice Wyrm", kind: "wyrm", look: "ice", hp: 70, region: "palace" },
    ],
    steps: [
      { type: "talk", in: "home", npc: "elder", askName: true, text: "Talk to the Old Tamer in the village square.",
        lines: [["The Old Tamer", "So it is true. The egg I gave you has hatched!"], ["The Old Tamer", "Long ago I tamed a dragon in the Forest of Doom. Now it is your turn to carry the legacy."], ["The Old Tamer", "But first, every dragon needs a name."]],
        done: [["{name}", "Chirp! Chirrup!"], ["The Old Tamer", "A fine name. Now listen: a winter that will not end is creeping down from the north."], ["Gandalf", "The Ice Wyrm has stolen the Sun Crown and broken it in three. I have walked this world a long time, and I will walk it with you."], ["Biscuit", "Woof!"], ["The Old Tamer", "Dragons grow strong on Sun Seeds. Find 4 in the Harvest Fields, along the east road. And take my old pocket knife!"]] },
      { type: "collect", in: "fields", item: "seed", count: 4, text: "Find 4 Sun Seeds in the Harvest Fields, east of the village.", hint: "Sun Seeds are the golden gems. Follow the little side paths off the road. Press M for the map!",
        done: [["Gandalf", "Well found! Look at {name} gobble them up. Onward, east, into Mistmarsh."]] },
      { type: "reach", in: "marsh", region: "marsh", text: "Follow the road east into Mistmarsh.", hint: "Keep going east along the road." },
      { type: "kill", in: "marsh", monster: "bogSlime", count: 5, text: "Bog slimes are smothering the marsh. Defeat 5 of them.", hint: "The muddy green slimes are bog slimes. Your knife, my magic or {name}'s fire will do it." },
      { type: "light", in: "marsh", regions: ["marsh"], text: "Light the Marsh Beacon with dragon fire. Press C to become {name}!", hint: "The beacon is north-west of the middle of the marsh. Only dragon fire lights it." },
      { type: "boss", in: "marsh", boss: "bogKing", text: "The Bog King has risen in the middle of Mistmarsh. Defeat it!", hint: "Keep moving so its rings of dark fire miss you, and keep breathing fire.",
        done: [["Gandalf", "The first piece of the Sun Crown! It was inside that great lump of slime all along."], ["Gandalf", "North now. The road to the Pinewood is choked with thorns, but thorns burn."]] },
      { type: "burn", in: "marsh", gate: "pinewood", text: "Burn the thorns on the north road to enter the Pinewood.", hint: "Become {name}, face the thorns and press Space." },
      { type: "kill", in: "pinewood", monster: "spider", count: 6, text: "The Pinewood is crawling with spiders. Defeat 6.", hint: "Spiders dash at you, then rest. Hit them while they rest." },
      { type: "light", in: "pinewood", regions: ["pinewood"], text: "Light the Pinewood Beacon.", hint: "It is south-east of the middle of the wood." },
      { type: "talk", in: "foothills", npc: "hermit", text: "Take the west road to the Frostfang Foothills and find Hermit Bryn.",
        lines: [["Hermit Bryn", "A Tamer! And a dragon! I have not seen one since I was a boy."], ["Hermit Bryn", "The wall of ice ahead is far too thick for a hatchling's fire. But I know the old way to make a dragon grow."], ["Hermit Bryn", "Bring me 4 Ember Stones from these hills. Mind the golems."]] },
      { type: "collect", in: "foothills", item: "ember", count: 4, text: "Find 4 Ember Stones in the Frostfang Foothills.", hint: "Ember Stones are the red gems.", reward: { stage: 2, grown: true, maxHp: 1 },
        card: ["You and {name} train with the hermit all winter.", "Each Ember Stone makes {name}'s fire burn hotter.", "By the first thaw, you have both grown."],
        done: [["Hermit Bryn", "Look at that: a Drake! That fire will melt anything now."], ["Gandalf", "And you have earned a proper sword. We could fly, but these mountains are too high even for {name}. The road is still our way."]] },
      { type: "burn", in: "foothills", gate: "frozenlake", text: "Melt the wall of ice on the west road.", hint: "Become {name}, face the ice and press Space." },
      { type: "boss", in: "frozenlake", boss: "frostGiant", text: "Defeat the Frost Giant on the Frozen Lake!", hint: "It is slow. Fly rings around it!",
        done: [["Gandalf", "The second piece of the crown. One more, and it lies with the Wyrm itself."]] },
      { type: "light", in: "frozenlake", regions: ["frozenlake"], text: "Light the Lake Beacon.", hint: "It is south-west of the middle of the lake." },
      { type: "talk", in: "snowdrift", npc: "chief", text: "Take the north road to Snowdrift Village and talk to Chief Asta.",
        lines: [["Chief Asta", "The last piece of the crown is in the Ice Palace, across the water."], ["Chief Asta", "But the Wyrm's cold would freeze {name}'s wings solid. Frost Crystals can protect a dragon."], ["Chief Asta", "Bring 5 from Glacier Pass, east of here. You will have to melt your way in."]] },
      { type: "collect", in: "glacier", item: "crystal", count: 5, text: "Melt the ice on the east road and find 5 Frost Crystals in Glacier Pass.", hint: "Frost Crystals are the blue gems." },
      { type: "light", in: "glacier", regions: ["glacier"], text: "Light the Glacier Beacon, the last of the four.", hint: "It is north-east of the middle of the pass.", reward: { stage: 3, maxHp: 1 },
        card: ["The four beacons blaze across the snow.", "Their light pours into {name}...", "{name} is a Great Dragon!"] },
      { type: "reach", in: "glacier", region: "palace", text: "Fly east across the sea to the Ice Palace! (Press C to fly.)", hint: "Follow the road east to the jetty, then fly over the water." },
      { type: "boss", in: "palace", boss: "iceWyrm", text: "Defeat the Ice Wyrm!", hint: "Dodge the orbs and keep breathing fire!",
        card: ["The Ice Wyrm shatters like glass.", "The Sun Crown is whole again, and summer returns to Emberwick."] },
      { type: "end", in: "palace", text: "You ended the long winter! Keep exploring, or try Free Play in the Middle Lands." },
    ],
    ending: ["The snow melts. Flowers push up through the frost.", "The Old Tamer smiles: \"The legacy is in good hands.\"", "THE END of Dragon Tamers 2. (You can keep exploring!)"],
  },
};

startSaga(typeof location !== "undefined" && location.search.includes("free") ? middleLands(SPEC) : SPEC);
if (typeof module !== "undefined") module.exports = SPEC;
