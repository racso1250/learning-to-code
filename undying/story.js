// The story: who you can talk to, what they say, and the quests.
//
// Each friend's quest goes through stages, stored in the save:
//   "unmet"  = you haven't talked to them yet
//   "asked"  = they've asked you to find something
//   "done"   = you've helped them!

//
// Some people just chat: they have a list of "lines" and say the next one
// each time you talk to them. Animals wander about ("wanders: true").

const people = {
  G: { name: "Gandalf", sprite: gandalfSprite },
  B: { name: "Bilbo", sprite: bilboSprite },
  E: { name: "Elrond", sprite: elrondSprite },
  L: { name: "Galadriel", sprite: galadrielSprite },
  M: { name: "Sam", sprite: samSprite },
  K: { name: "Legolas", sprite: legolasSprite },
  R: { name: "Gimli", sprite: gimliSprite },

  // Elves who live on the island
  1: {
    name: "Elowen",
    sprite: elfSprite("b", "T"),
    lines: [
      "Welcome to the harbour, little traveller! Ships from across the sea are rare now.",
      "The road west leads to the Golden Meadows, and north to the White City.",
    ],
  },
  2: {
    name: "Faelar",
    sprite: elfSprite("d", "G"),
    lines: [
      "This is our village. We grow golden trees here, and they never lose their leaves.",
      "Have you seen the Swan Haven in the north-east? The ships there look like great white birds.",
    ],
  },
  3: {
    name: "Ilyra",
    sprite: elfSprite("S", "V"),
    lines: [
      "Shh! If you are quiet, the deer will let you come close.",
      "I once followed a fox all the way to the mountains. It was very good at hiding.",
    ],
  },
  4: {
    name: "Caelin",
    sprite: elfSprite("S", "B"),
    lines: [
      "Halt! Oh... a hobbit. Welcome! This is the White City. Lord Elrond waits inside.",
      "From the top of the tall tower, you can see the whole island.",
    ],
  },
  5: {
    name: "Mirel",
    sprite: elfSprite("b", "V"),
    lines: [
      "I am making up a song about the Mirror Lake. Nothing rhymes with 'lake' except 'cake'...",
      "The lake is so still that the sky looks like it lives underneath it.",
    ],
  },
  6: {
    name: "Seren",
    sprite: elfSprite("d", "T"),
    lines: [
      "I keep the lanterns lit. They glow even in the day, just because they are pretty.",
      "Gimli the dwarf has gone to look at the mountains. He says the rocks are 'magnificent'.",
    ],
  },

  // Animals
  7: { name: "Swan", sprite: swanSprite, wanders: true, lines: ["The swan honks at you politely."] },
  8: { name: "Deer", sprite: deerSprite, wanders: true, lines: ["The deer looks at you with big, calm eyes."] },
  9: { name: "Fox", sprite: foxSprite, wanders: true, lines: ["The fox sniffs your pocket, hoping for a snack."] },
};

// Have all three friends been helped?
function allFriendsHelped(save) {
  return save.bilbo === "done" && save.elrond === "done" && save.galadriel === "done";
}

// Talk to someone. Gives back what they say (a list of lines), and
// whether to play the "quest complete" jingle or show The End.
function talk(id, save) {
  if (id === "G") {
    return talkToGandalf(save);
  } else if (id === "B") {
    return talkToBilbo(save);
  } else if (id === "E") {
    return talkToElrond(save);
  } else if (id === "L") {
    return talkToGaladriel(save);
  } else if (id === "M") {
    return talkToSam(save);
  } else if (id === "K") {
    return talkToLegolas(save);
  } else if (id === "R") {
    return talkToGimli(save);
  } else {
    return chat(id);
  }
}

// People with a list of lines say the next one each time
const chatCount = {};
function chat(id) {
  const lines = people[id].lines;
  const count = chatCount[id] || 0;
  chatCount[id] = count + 1;
  return { lines: [lines[count % lines.length]] };
}

function talkToGandalf(save) {
  if (!save.metGandalf) {
    save.metGandalf = true;
    return {
      lines: [
        "Welcome, Frodo! You have come at last to the Undying Lands.",
        "Here old hurts can heal, and there is time enough for everything.",
        "Your friends are on this island too. Bilbo is resting in the flower garden to the south-west.",
        "Lord Elrond is in the white city to the north, and the Lady Galadriel walks by the southern shore.",
        "Go and greet them. I suspect each of them has a small task for you.",
        "Oh, and Legolas and Gimli are here too! Look for them at the Swan Haven and the mountains.",
      ],
    };
  }

  if (allFriendsHelped(save) && !save.samArrived) {
    save.samArrived = true;
    return {
      lines: [
        "You have helped them all. Well done, my dear hobbit.",
        "But look out to sea! There is a white sail on the water...",
        "I think someone has come a very long way to find you. Hurry down to the dock!",
      ],
      jingle: true,
    };
  }

  if (save.samArrived && !save.theEnd) {
    return { lines: ["Go on, Frodo. To the dock!"] };
  }

  if (save.theEnd) {
    return { lines: ["All is well, Frodo. All is well."] };
  }

  // Still helping people: say who's left
  const left = [];
  if (save.bilbo !== "done") left.push("Bilbo");
  if (save.elrond !== "done") left.push("Elrond");
  if (save.galadriel !== "done") left.push("Galadriel");
  return {
    lines: ["Have you helped everyone? Still waiting for your help: " + left.join(", ") + "."],
  };
}

function talkToBilbo(save) {
  if (save.bilbo === "unmet") {
    save.bilbo = "asked";
    return {
      lines: [
        "Frodo, my boy! How wonderful to see you!",
        "I was writing more of my book out here, and a gust of wind blew three pages away!",
        "Could you find them for me? They can't have gone far... I hope.",
      ],
    };
  }

  if (save.bilbo === "asked" && save.pages < 3) {
    return {
      lines: [
        "Found my pages yet? You have " + save.pages + " of 3.",
        "One may have blown into the forest, and one towards the city.",
      ],
    };
  }

  if (save.bilbo === "asked") {
    save.bilbo = "done";
    return {
      lines: [
        "My pages! All three of them! Thank you, Frodo.",
        "Now I can finish the chapter about how we both ended up here. What a story it is!",
      ],
      jingle: true,
    };
  }

  return { lines: ["I think I'll have a little nap in the sunshine."] };
}

function talkToElrond(save) {
  if (save.elrond === "unmet") {
    save.elrond = "asked";
    return {
      lines: [
        "Welcome, Frodo. Your old wound still troubles you, I think.",
        "Silverleaf herbs grow in the forest to the west. Bring me four, and I will make you a healing drink.",
      ],
    };
  }

  if (save.elrond === "asked" && save.herbs < 4) {
    return {
      lines: ["You have " + save.herbs + " of 4 silverleaf herbs. Look among the trees to the west."],
    };
  }

  if (save.elrond === "asked") {
    save.elrond = "done";
    return {
      lines: [
        "These will do nicely.",
        "Drink this... There. The old ache is gone at last.",
      ],
      jingle: true,
    };
  }

  return { lines: ["Rest now, Frodo. You have more than earned it."] };
}

function talkToGaladriel(save) {
  if (save.galadriel === "unmet") {
    save.galadriel = "asked";
    return {
      lines: [
        "Frodo. I am glad to see you here, on these quiet shores.",
        "The sea has left a gift on the beach to the south-east: a pearl as bright as a star.",
        "Will you bring it to me?",
      ],
    };
  }

  if (save.galadriel === "asked" && save.pearls < 1) {
    return {
      lines: ["The pearl lies on the sand where the land meets the sea, to the south-east."],
    };
  }

  if (save.galadriel === "asked") {
    save.galadriel = "done";
    return {
      lines: [
        "It shines just as I hoped. But I think it should be yours, Frodo.",
        "Keep it, and let it remind you that small folk can do the greatest deeds of all.",
      ],
      jingle: true,
    };
  }

  return { lines: ["The light of the West is on your face now, Frodo."] };
}

function talkToSam(save) {
  if (!save.theEnd) {
    save.theEnd = true;
    return {
      lines: [
        "Mr. Frodo! I came, just like you said I might one day.",
        "I've brought all the news from the Shire, and a bit of cake as well!",
        "We're together again. I reckon that's the best ending there could be.",
      ],
      jingle: true,
      end: true,
    };
  }

  return { lines: ["Shall we go and find Mr. Bilbo? I reckon he'd like some of this cake."] };
}

function talkToLegolas(save) {
  if (save.legolas === "unmet") {
    save.legolas = "asked";
    return {
      lines: [
        "Frodo! It is good to see you on these shores. Gimli and I sailed here together.",
        "I would like to make new arrows, the Elven way, with swan feathers.",
        "The swans drop them all over the island. Could you find three for me?",
      ],
    };
  }

  if (save.legolas === "asked" && save.feathers < 3) {
    return { lines: ["You have " + save.feathers + " of 3 swan feathers. Look near water: the swans love it."] };
  }

  if (save.legolas === "asked") {
    save.legolas = "done";
    return {
      lines: [
        "Three perfect feathers! Thank you, my friend.",
        "Do not tell Gimli, but I think he misses having adventures with you.",
      ],
      jingle: true,
    };
  }

  return { lines: ["Listen... the sea is singing today."] };
}

function talkToGimli(save) {
  if (save.gimli === "unmet") {
    save.gimli = "asked";
    return {
      lines: [
        "Well, if it isn't the Ring-bearer himself! Hah!",
        "These mountains are full of crystals. Glittering, shining, magnificent crystals!",
        "My old legs don't like the climb. Fetch me three, would you, lad?",
      ],
    };
  }

  if (save.gimli === "asked" && save.crystals < 3) {
    return { lines: ["You have " + save.crystals + " of 3 crystals. Search high up in the mountains!"] };
  }

  if (save.gimli === "asked") {
    save.gimli = "done";
    return {
      lines: [
        "Look at them sparkle! Almost as lovely as the Lady Galadriel's smile. Almost.",
        "Don't tell the elf I said anything nice about Elvish lands, mind you.",
      ],
      jingle: true,
    };
  }

  return { lines: ["Elves and dwarves, friends at last. Who would have thought it?"] };
}

// The quest log: a list of what to do next
function questLog(save) {
  if (!save.metGandalf) {
    return ["Talk to Gandalf by the dock."];
  }

  const log = [];

  if (save.bilbo === "unmet") log.push("Find Bilbo in the flower garden (south-west).");
  if (save.bilbo === "asked") log.push("Find Bilbo's lost pages: " + save.pages + " / 3");
  if (save.bilbo === "done") log.push("✔ Helped Bilbo");

  if (save.elrond === "unmet") log.push("Find Elrond in the white city (north).");
  if (save.elrond === "asked") log.push("Gather silverleaf herbs for Elrond: " + save.herbs + " / 4");
  if (save.elrond === "done") log.push("✔ Helped Elrond");

  if (save.galadriel === "unmet") log.push("Find Galadriel by the southern shore.");
  if (save.galadriel === "asked") log.push("Find the sea pearl for Galadriel: " + save.pearls + " / 1");
  if (save.galadriel === "done") log.push("✔ Helped Galadriel");

  // Side quests appear once you've met Legolas or Gimli
  if (save.legolas === "asked") log.push("Find swan feathers for Legolas: " + save.feathers + " / 3");
  if (save.legolas === "done") log.push("✔ Helped Legolas");
  if (save.gimli === "asked") log.push("Find mountain crystals for Gimli: " + save.crystals + " / 3");
  if (save.gimli === "done") log.push("✔ Helped Gimli");

  if (allFriendsHelped(save) && !save.samArrived) log.push("Go back to Gandalf.");
  if (save.samArrived && !save.theEnd) log.push("Hurry to the dock!");
  if (save.theEnd) log.push("✔ The End! Explore as long as you like.");

  return log;
}
