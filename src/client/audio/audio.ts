/**
 * Procedural WebAudio: synthesized SFX and a small step-sequencer for music.
 * No audio files needed; everything is generated at runtime.
 */
type Track = 'title' | 'city' | 'dungeon' | 'battle' | 'boss' | 'victory' | 'none';

interface Song {
  bpm: number;
  root: number; // midi
  scale: number[];
  chords: number[]; // scale degrees per bar
  arp: number[]; // pattern of chord tone indices (-1 rest)
  drums: string; // 16 steps: k=kick s=snare h=hat .=rest
  bassPattern: number[]; // 1 = play on step
  lead?: number;
  wave: OscillatorType;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const SONGS: Record<Exclude<Track, 'none'>, Song> = {
  title: { bpm: 92, root: 50, scale: DORIAN, chords: [0, 5, 3, 4], arp: [0, 2, 4, 2, 1, 2, 4, 2, 0, 2, 4, 6, 4, 2, 1, -1], drums: 'k...h...s...h...', bassPattern: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0], wave: 'triangle' },
  city: { bpm: 100, root: 53, scale: DORIAN, chords: [0, 3, 5, 4], arp: [0, -1, 2, -1, 4, -1, 2, 4, 0, -1, 2, -1, 4, 2, 1, -1], drums: 'k.h.s.h.k.h.s.hh', bassPattern: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], wave: 'triangle' },
  dungeon: { bpm: 84, root: 45, scale: MINOR, chords: [0, 0, 5, 6], arp: [0, -1, -1, 2, -1, -1, 4, -1, -1, 2, -1, -1, 6, -1, 4, -1], drums: 'k.......k..s....', bassPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], wave: 'sine' },
  battle: { bpm: 140, root: 52, scale: MINOR, chords: [0, 5, 6, 4], arp: [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, 2], drums: 'k.hsk.hsk.hsk.ss', bassPattern: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1], wave: 'sawtooth' },
  boss: { bpm: 156, root: 47, scale: MINOR, chords: [0, 1, 5, 4], arp: [0, 4, 7, 4, 0, 4, 7, 9, 0, 4, 7, 4, 1, 5, 8, 5], drums: 'kkhskkhskkhsk.ss', bassPattern: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1], wave: 'square' },
  victory: { bpm: 120, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 3, 4, 0], arp: [0, 2, 4, 7, 4, 2, 4, 7, 9, 7, 4, 2, 0, -1, -1, -1], drums: 'k...s...k.k.s...', bassPattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0], wave: 'triangle' },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noise!: AudioBuffer;
  private track: Track = 'none';
  private song: Song | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  musicVol = 0.5;
  sfxVol = 0.7;
  private pending: Track = 'none';
  private lastSfx: Record<string, number> = {};

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.setVolumes(this.musicVol, this.sfxVol);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.pending !== 'none') this.music(this.pending);
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicGain.gain.setTargetAtTime(music * 0.35, this.ctx.currentTime, 0.1);
    this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
  }

  music(track: Track) {
    this.pending = track;
    if (!this.ctx || this.track === track) return;
    this.track = track;
    this.song = track === 'none' ? null : SONGS[track];
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private schedule() {
    if (!this.ctx || !this.song) return;
    const s = this.song;
    const stepDur = 60 / s.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % (16 * s.chords.length);
    }
  }

  private noteOf(s: Song, degree: number, octave = 0) {
    const n = s.scale.length;
    const oct = Math.floor(degree / n);
    const d = ((degree % n) + n) % n;
    return s.root + s.scale[d] + 12 * (oct + octave);
  }

  private playStep(step: number, t: number, dur: number) {
    const s = this.song!;
    const bar = Math.floor(step / 16);
    const i = step % 16;
    const chord = s.chords[bar % s.chords.length];
    const a = s.arp[i];
    if (a >= 0) this.tone(mtof(this.noteOf(s, chord + a, 1)), t, dur * 0.9, s.wave, 0.07, this.musicGain, 2400);
    if (s.bassPattern[i]) this.tone(mtof(this.noteOf(s, chord, -1)), t, dur * 1.6, 'sawtooth', 0.12, this.musicGain, 600);
    if (i === 0) for (const k of [0, 2, 4]) this.tone(mtof(this.noteOf(s, chord + k)), t, dur * 15, 'sine', 0.035, this.musicGain, 1200, 0.3);
    const dch = s.drums[i];
    if (dch === 'k') this.kick(t);
    if (dch === 's') this.snare(t);
    if (dch === 'h' || (dch === 'k' && this.track === 'boss')) this.hat(t);
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, out: AudioNode, cutoff = 4000, attack = 0.005) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.3);
  }
  private noiseHit(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, out: AudioNode, q = 1) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
    return f;
  }
  private snare(t: number) {
    this.noiseHit(t, 0.16, 0.25, 'bandpass', 1800, this.musicGain, 0.8);
  }
  private hat(t: number) {
    this.noiseHit(t, 0.04, 0.09, 'highpass', 7000, this.musicGain);
  }

  /** sound effects */
  sfx(name: string) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // throttle identical sfx bursts
    if ((this.lastSfx[name] ?? 0) > now - 0.035) return;
    this.lastSfx[name] = now;
    const out = this.sfxGain;
    const t = now;
    switch (name) {
      case 'click':
        this.tone(1200, t, 0.05, 'square', 0.05, out, 3000);
        break;
      case 'confirm':
        this.tone(660, t, 0.08, 'square', 0.06, out, 3000);
        this.tone(990, t + 0.06, 0.1, 'square', 0.06, out, 3000);
        break;
      case 'back':
        this.tone(500, t, 0.08, 'triangle', 0.06, out);
        break;
      case 'error':
        this.tone(180, t, 0.18, 'sawtooth', 0.08, out, 900);
        break;
      case 'slash': {
        const f = this.noiseHit(t, 0.18, 0.4, 'bandpass', 3000, out, 2);
        f.frequency.exponentialRampToValueAtTime(600, t + 0.18);
        break;
      }
      case 'shoot':
        this.tone(900, t, 0.12, 'square', 0.12, out, 2500);
        this.noiseHit(t, 0.1, 0.2, 'highpass', 2000, out);
        break;
      case 'rail': {
        const c = this.ctx;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(200, t);
        o.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.45);
        this.noiseHit(t + 0.22, 0.3, 0.4, 'lowpass', 1500, out);
        break;
      }
      case 'hit':
        this.noiseHit(t, 0.1, 0.45, 'lowpass', 1200, out);
        this.tone(120, t, 0.12, 'sine', 0.3, out);
        break;
      case 'crit':
        this.noiseHit(t, 0.18, 0.5, 'lowpass', 2500, out);
        this.tone(1500, t, 0.15, 'square', 0.07, out);
        this.tone(2250, t + 0.04, 0.15, 'square', 0.05, out);
        break;
      case 'electric':
        for (let i = 0; i < 4; i++) this.noiseHit(t + i * 0.03, 0.05, 0.25, 'bandpass', 4000 + Math.random() * 3000, out, 6);
        this.tone(80, t, 0.2, 'sawtooth', 0.12, out, 800);
        break;
      case 'fire':
        this.noiseHit(t, 0.4, 0.35, 'lowpass', 900, out);
        break;
      case 'ice':
        this.tone(2093, t, 0.3, 'sine', 0.08, out);
        this.tone(2637, t + 0.05, 0.3, 'sine', 0.06, out);
        this.noiseHit(t, 0.08, 0.15, 'highpass', 6000, out);
        break;
      case 'plasma':
        this.tone(440, t, 0.25, 'sawtooth', 0.08, out, 1800);
        this.tone(445, t, 0.25, 'sawtooth', 0.08, out, 1800);
        break;
      case 'gravity': {
        const c = this.ctx;
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.setValueAtTime(220, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.6);
        break;
      }
      case 'quantum':
        for (let i = 0; i < 5; i++) this.tone(600 + i * 220, t + i * 0.03, 0.08, 'sine', 0.05, out);
        break;
      case 'explosion':
        this.noiseHit(t, 0.8, 0.7, 'lowpass', 700, out);
        this.tone(60, t, 0.6, 'sine', 0.4, out);
        break;
      case 'break':
        this.tone(330, t, 0.5, 'square', 0.1, out, 1500);
        this.tone(440, t, 0.5, 'square', 0.08, out, 1500);
        this.noiseHit(t, 0.3, 0.5, 'bandpass', 2500, out, 3);
        break;
      case 'reaction':
        this.tone(880, t, 0.25, 'triangle', 0.1, out);
        this.tone(1320, t + 0.07, 0.25, 'triangle', 0.1, out);
        this.tone(1760, t + 0.14, 0.3, 'triangle', 0.08, out);
        break;
      case 'heal':
        this.tone(523, t, 0.25, 'sine', 0.08, out);
        this.tone(784, t + 0.1, 0.35, 'sine', 0.08, out);
        break;
      case 'shield':
        this.tone(300, t, 0.3, 'triangle', 0.1, out, 1200);
        break;
      case 'ultimate':
        for (let i = 0; i < 6; i++) this.tone(220 * Math.pow(1.26, i), t + i * 0.06, 0.4, 'sawtooth', 0.06, out, 3000);
        break;
      case 'boss':
        this.tone(55, t, 1.2, 'sawtooth', 0.25, out, 400);
        this.tone(58, t, 1.2, 'sawtooth', 0.25, out, 400);
        this.noiseHit(t, 1, 0.3, 'lowpass', 300, out);
        break;
      case 'levelup':
        [0, 4, 7, 12].forEach((n, i) => this.tone(mtof(72 + n), t + i * 0.09, 0.3, 'square', 0.06, out, 4000));
        break;
      case 'coin':
        this.tone(1318, t, 0.06, 'square', 0.05, out);
        this.tone(1760, t + 0.06, 0.12, 'square', 0.05, out);
        break;
      case 'step':
        this.noiseHit(t, 0.04, 0.05, 'lowpass', 500, out);
        break;
      case 'encounter':
        this.tone(330, t, 0.1, 'square', 0.08, out);
        this.tone(440, t + 0.1, 0.1, 'square', 0.08, out);
        this.tone(660, t + 0.2, 0.25, 'square', 0.08, out);
        break;
      case 'death':
        this.noiseHit(t, 0.5, 0.4, 'lowpass', 500, out);
        this.tone(200, t, 0.5, 'sawtooth', 0.08, out, 600);
        break;
      case 'chest':
        [0, 7, 12, 16].forEach((n, i) => this.tone(mtof(76 + n), t + i * 0.07, 0.25, 'triangle', 0.08, out));
        break;
      default:
        this.tone(440, t, 0.06, 'square', 0.04, out);
    }
  }
}

export const audio = new Audio();
