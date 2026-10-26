// GTiA audio: original procedural music (Web Audio API), character leitmotifs, and cute key-moment SFX.
// No audio files, no tokens.
// Browsers only allow sound after a user gesture, so the context starts on the first click/keypress.

type Wave = OscillatorType;
export type TrackName = "hall" | "door1" | "door3";
export type Motif = "cop" | "partner" | "tutor" | "yoshi" | "jujubee" | "kimchi";
export type Sfx =
  | "select" | "tick" | "correct" | "wrong" | "coin" | "badge" | "clang" | "whoosh" | "alarm"
  | "fanfare" | "deal" | "reject" | "step";

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const MUTE_KEY = "gtia_muted";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private track: TrackName | null = null;
  private wanted: TrackName | null = null;
  private step = 0;
  private nextTime = 0;
  muted = typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window === "undefined") return;
    const unlock = () => {
      this.ensure();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.16;
      this.music.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.45;
      this.sfxBus.connect(this.master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (this.wanted) this.playTrack(this.wanted);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  // ---------- mute ----------
  setMuted(m: boolean) {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    this.listeners.forEach((f) => f());
  }
  subscribe(f: () => void) {
    this.listeners.add(f);
    return () => void this.listeners.delete(f);
  }

  // ---------- voices ----------
  private tone(t: number, midi: number, dur: number, wave: Wave, vol: number, bus: GainNode, opts: { glide?: number; cutoff?: number; attack?: number } = {}) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(midiHz(midi), t);
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(midiHz(midi + opts.glide), t + dur * 0.8);
    let node: AudioNode = o;
    if (opts.cutoff) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = opts.cutoff;
      o.connect(f);
      node = f;
    }
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private noiseHit(t: number, dur: number, vol: number, bus: GainNode, type: BiquadFilterType, freq: number) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }
  private kick(t: number, bus: GainNode, vol = 0.9) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.25);
  }
  private clap(t: number, bus: GainNode, vol = 0.5) {
    for (const dt of [0, 0.012, 0.024]) this.noiseHit(t + dt, 0.09, vol, bus, "bandpass", 1500);
  }
  private hat(t: number, bus: GainNode, vol = 0.18) {
    this.noiseHit(t, 0.035, vol, bus, "highpass", 7500);
  }
  private wood(t: number, midi: number, bus: GainNode, vol = 0.6) {
    this.tone(t, midi, 0.09, "sine", vol, bus);
    this.tone(t, midi + 19, 0.03, "square", vol * 0.25, bus);
  }

  // ---------- music ----------
  playTrack(name: TrackName | null) {
    this.wanted = name;
    if (!this.ctx || this.track === name) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = name;
    if (!name) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  private schedule() {
    const c = this.ctx;
    if (!c || !this.track) return;
    const song = SONGS[this.track];
    const sixteenth = 60 / song.bpm / 4;
    while (this.nextTime < c.currentTime + 0.12) {
      song.play(this, this.step, this.nextTime);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  /** internal API used by the songs */
  v = {
    kick: (t: number) => this.kick(t, this.music),
    clap: (t: number) => this.clap(t, this.music),
    hat: (t: number, vol?: number) => this.hat(t, this.music, vol),
    bass: (t: number, m: number, dur: number, wave: Wave = "square") => this.tone(t, m, dur, wave, 0.35, this.music, { cutoff: 900 }),
    lead: (t: number, m: number, dur: number, wave: Wave = "square", vol = 0.16) => this.tone(t, m, dur, wave, vol, this.music, { cutoff: 4200 }),
    pluck: (t: number, m: number, dur: number, vol = 0.2) => this.tone(t, m, dur, "triangle", vol, this.music),
    pad: (t: number, m: number, dur: number) => this.tone(t, m, dur, "sawtooth", 0.035, this.music, { cutoff: 1400, attack: 0.08 }),
  };

  private duck(seconds: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(0.06, t, 0.05);
    this.music.gain.setTargetAtTime(0.16, t + seconds, 0.3);
  }

  // ---------- leitmotifs ----------
  motif(name: Motif) {
    const c = this.ensure();
    if (!c || this.muted) return;
    const t = c.currentTime + 0.03;
    const b = this.sfxBus;
    this.duck(1.4);
    switch (name) {
      case "cop": // Detective Zhou: swaggering noir bass, dun-dun-DUN
        [[40, 0], [43, 0.18], [46, 0.36], [45, 0.62]].forEach(([m, dt]) => this.tone(t + dt, m, 0.32, "sawtooth", 0.3, b, { cutoff: 700 }));
        this.kick(t + 0.62, b, 0.5);
        break;
      case "partner": // Tung Tung Tung Sahur: wood block tung-tung-tung + log drum
        [0, 0.14, 0.28].forEach((dt) => this.wood(t + dt, 79, b));
        this.tone(t + 0.48, 43, 0.35, "sine", 0.5, b, { glide: -5 });
        break;
      case "tutor": // Nash-sensei: koto-like pluck in the Japanese "in" scale, rising
        [64, 65, 69, 71, 72, 76].forEach((m, i) => this.tone(t + i * 0.09, m, 0.5, "triangle", 0.22, b));
        this.tone(t + 0.6, 88, 0.8, "sine", 0.06, b);
        break;
      case "yoshi": // tabby cat: a curious "mew" glide + two confident hops
        this.tone(t, 76, 0.28, "sine", 0.28, b, { glide: 7 });
        this.tone(t + 0.32, 79, 0.12, "square", 0.12, b);
        this.tone(t + 0.46, 84, 0.2, "square", 0.12, b);
        break;
      case "jujubee": // golden dog: bouncy major hop, playful
        [72, 76, 79, 84, 79].forEach((m, i) => this.tone(t + i * 0.08, m, 0.1, "square", 0.13, b));
        this.tone(t + 0.45, 88, 0.15, "triangle", 0.2, b);
        break;
      case "kimchi": // panda: sly chromatic slide down + "munch munch"
        [71, 70, 69, 68].forEach((m, i) => this.tone(t + i * 0.1, m, 0.12, "triangle", 0.2, b));
        this.noiseHit(t + 0.5, 0.06, 0.35, b, "bandpass", 900);
        this.noiseHit(t + 0.64, 0.06, 0.35, b, "bandpass", 1100);
        break;
    }
  }

  // ---------- cute key-moment SFX ----------
  sfx(name: Sfx) {
    const c = this.ensure();
    if (!c || this.muted) return;
    const t = c.currentTime + 0.01;
    const b = this.sfxBus;
    switch (name) {
      case "tick":
        this.tone(t, 84, 0.04, "triangle", 0.12, b);
        break;
      case "select":
        this.tone(t, 72, 0.07, "square", 0.15, b);
        this.tone(t + 0.06, 79, 0.1, "square", 0.15, b);
        break;
      case "step":
        this.tone(t, 79, 0.18, "triangle", 0.22, b);
        this.tone(t + 0.08, 86, 0.25, "sine", 0.12, b);
        break;
      case "correct":
        [76, 79, 84].forEach((m, i) => this.tone(t + i * 0.07, m, 0.18, "square", 0.16, b));
        break;
      case "wrong": // cute "boop-bwoop" (not a buzzer)
        this.tone(t, 72, 0.12, "sine", 0.25, b);
        this.tone(t + 0.13, 67, 0.22, "sine", 0.25, b, { glide: -2 });
        break;
      case "coin":
        this.tone(t, 83, 0.07, "square", 0.13, b);
        this.tone(t + 0.07, 88, 0.22, "square", 0.13, b);
        break;
      case "badge":
        [79, 83, 86, 91].forEach((m, i) => this.tone(t + i * 0.06, m, 0.3, "triangle", 0.2, b));
        this.noiseHit(t + 0.25, 0.4, 0.08, b, "highpass", 9000);
        break;
      case "clang": // jail door, as a cute little "clink-clink"
        this.tone(t, 91, 0.12, "triangle", 0.18, b);
        this.tone(t + 0.1, 96, 0.2, "triangle", 0.14, b);
        break;
      case "whoosh": // sparkly swoosh
        [84, 88, 91, 96].forEach((m, i) => this.tone(t + i * 0.04, m, 0.12, "sine", 0.12, b));
        break;
      case "alarm": // playful "wee-woo"
        [0, 0.3].forEach((dt) => {
          this.tone(t + dt, 79, 0.14, "triangle", 0.18, b);
          this.tone(t + dt + 0.14, 74, 0.14, "triangle", 0.18, b);
        });
        break;
      case "fanfare":
        [[72, 0], [76, 0.1], [79, 0.2], [84, 0.32]].forEach(([m, dt]) => this.tone(t + dt, m, 0.45, "square", 0.15, b));
        this.kick(t + 0.32, b, 0.5);
        break;
      case "deal":
        [79, 84].forEach((m, i) => this.tone(t + i * 0.1, m, 0.35, "triangle", 0.25, b));
        break;
      case "reject": // cartoon "womp womp"
        this.tone(t, 64, 0.22, "triangle", 0.25, b, { glide: -1 });
        this.tone(t + 0.25, 59, 0.4, "triangle", 0.25, b, { glide: -3 });
        break;
    }
  }
}

// ---------- original songs (chord loops + hooks; written for GTiA) ----------
interface Song {
  bpm: number;
  play: (e: AudioEngine, step: number, t: number) => void;
}

/** chord roots per bar (MIDI) and their triads */
const triad = (root: number, minor: boolean) => [root, root + (minor ? 3 : 4), root + 7];

const SONGS: Record<TrackName, Song> = {
  // Equilibrium Hall: bouncy chiptune pop, C major, I–V–vi–IV
  hall: {
    bpm: 118,
    play(e, step, t) {
      const s = step % 64;
      const bar = Math.floor(s / 16);
      const i = s % 16;
      const prog: [number, boolean][] = [[48, false], [43, false], [45, true], [41, false]];
      const [root, minor] = prog[bar];
      if (i % 4 === 0) e.v.kick(t);
      if (i === 4 || i === 12) e.v.clap(t);
      if (i % 2 === 1) e.v.hat(t);
      if ([0, 3, 6, 8, 11, 14].includes(i)) e.v.bass(t, root - 12 + (i === 6 || i === 14 ? 12 : 0), 0.18);
      const tri = triad(root + 24, minor);
      if (i % 2 === 0) e.v.pluck(t, tri[(i / 2) % 3] + (i >= 8 ? 12 : 0), 0.16, 0.09);
      const hook = [79, null, 76, null, 79, 81, null, 79, 76, null, 72, null, 74, null, 76, null];
      const h = hook[i];
      if (bar % 2 === 0 && h) e.v.lead(t, h, 0.16);
    },
  },
  // Door 1: sassy girl-group attitude, A minor, Am–F–C–G, syncopated bass + claps
  door1: {
    bpm: 104,
    play(e, step, t) {
      const s = step % 64;
      const bar = Math.floor(s / 16);
      const i = s % 16;
      const prog: [number, boolean][] = [[45, true], [41, false], [48, false], [43, false]];
      const [root, minor] = prog[bar];
      if (i === 0 || i === 6 || i === 10) e.v.kick(t);
      if (i === 4 || i === 12) e.v.clap(t);
      if (i % 2 === 0) e.v.hat(t, i % 4 === 2 ? 0.22 : 0.12);
      if ([0, 3, 7, 10, 12].includes(i)) e.v.bass(t, root - 12, i === 7 ? 0.12 : 0.22, "sawtooth");
      if (i === 0) triad(root + 12, minor).forEach((m) => e.v.pad(t, m, 1.9));
      const hook = [null, 69, null, 72, 74, null, 72, null, null, 69, null, 67, 69, null, null, null];
      const h = hook[i];
      if (bar % 2 === 1 && h) e.v.lead(t, h + 12, 0.14, "square", 0.12);
    },
  },
  // Door 3 (King's Cross): bright and sparkly, D major, I–vi–IV–V, shimmering arps
  door3: {
    bpm: 124,
    play(e, step, t) {
      const s = step % 64;
      const bar = Math.floor(s / 16);
      const i = s % 16;
      const prog: [number, boolean][] = [[50, false], [47, true], [43, false], [45, false]];
      const [root, minor] = prog[bar];
      if (i % 4 === 0) e.v.kick(t);
      if (i === 4 || i === 12) e.v.clap(t);
      e.v.hat(t, i % 2 ? 0.08 : 0.14);
      if (i % 4 === 0 || i % 4 === 3) e.v.bass(t, root - 12, 0.16, "triangle");
      const tri = triad(root + 24, minor);
      e.v.pluck(t, tri[i % 3] + (i % 6 >= 3 ? 12 : 0), 0.12, 0.07);
      const hook = [78, null, null, 81, null, 83, null, null, 81, null, 78, null, 76, null, 74, null];
      const h = hook[i];
      if (bar >= 2 && h) e.v.lead(t, h, 0.16, "triangle", 0.18);
    },
  },
};

export const audio = new AudioEngine();
