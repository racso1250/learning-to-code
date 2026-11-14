// Sound effects, made with code! No sound files needed.
// Old 16-bit consoles made their sounds this way too: by building them
// out of simple waves and fuzzy "noise".

let audio = null;

// Get the browser's sound system, starting it up the first time
function getAudio() {
  if (audio === null) {
    audio = new AudioContext();
  }
  if (audio.state === "suspended") {
    audio.resume();
  }
  return audio;
}

// Play a burst of fuzzy noise, like "shhh".
//   delay     = how many seconds to wait before playing
//   duration  = how many seconds it lasts
//   startPitch, endPitch = how bright the noise is at the start and end
//                          (big numbers sound hissy, small numbers sound deep)
//   volume    = how loud (0 is silent, 1 is very loud)
function playNoise(delay, duration, startPitch, endPitch, volume) {
  const ac = getAudio();
  const start = ac.currentTime + delay;
  const end = start + duration;

  // Fill a sound with random numbers. Random = noise!
  const length = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.random() * 2 - 1;
  }
  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  // A filter changes how bright the noise sounds
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(startPitch, start);
  filter.frequency.exponentialRampToValueAtTime(endPitch, end);

  // Fade the volume out so it doesn't stop with a click
  const loudness = ac.createGain();
  loudness.gain.setValueAtTime(volume, start);
  loudness.gain.exponentialRampToValueAtTime(0.001, end);

  // Plug them together: noise -> filter -> volume -> speakers
  noise.connect(filter);
  filter.connect(loudness);
  loudness.connect(ac.destination);
  noise.start(start);
}

// Play a beepy retro tone that slides from one pitch to another
function playTone(delay, duration, startPitch, endPitch, volume) {
  const ac = getAudio();
  const start = ac.currentTime + delay;
  const end = start + duration;

  const tone = ac.createOscillator();
  tone.type = "square"; // the classic video game sound!
  tone.frequency.setValueAtTime(startPitch, start);
  tone.frequency.exponentialRampToValueAtTime(endPitch, end);

  const loudness = ac.createGain();
  loudness.gain.setValueAtTime(volume, start);
  loudness.gain.exponentialRampToValueAtTime(0.001, end);

  tone.connect(loudness);
  loudness.connect(ac.destination);
  tone.start(start);
  tone.stop(end);
}

// ----- The actual sound effects -----

// Crunch! Three tiny bursts of crackly noise, one after another
function playCrunch() {
  playNoise(0, 0.05, 4000, 1000, 0.5);
  playNoise(0.06, 0.04, 3000, 800, 0.4);
  playNoise(0.11, 0.05, 2500, 600, 0.3);
}

// Poof! A big soft whoosh that fades away, with a sad falling beep
function playPoof() {
  playNoise(0, 0.6, 2000, 80, 0.6);
  playTone(0, 0.4, 500, 60, 0.08);
}

// Ta-da! Three rising beeps for completing a quest
function playJingle() {
  playTone(0, 0.12, 523, 523, 0.1);
  playTone(0.12, 0.12, 659, 659, 0.1);
  playTone(0.24, 0.3, 784, 784, 0.1);
}

// Bonk! A short low thud when Glurk bonks an enemy away
function playBonk() {
  playTone(0, 0.15, 220, 90, 0.15);
  playNoise(0, 0.08, 1500, 300, 0.4);
}
