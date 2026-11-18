/**
 * Tiny WebAudio synthesizer in the spirit of an 8-bit sound chip:
 * pulse waves (12.5% / 25% / 50% duty), a triangle, a sawtooth and white noise.
 * Everything is generated at runtime, so there are no audio files to license.
 */

export type Wave = 'square' | 'pulse25' | 'pulse12' | 'triangle' | 'sawtooth' | 'sine';

export interface ToneSpec {
  readonly wave: Wave;
  /** Start frequency in Hz. */
  readonly freq: number;
  /** Optional end frequency for a pitch slide over the whole note. */
  readonly to?: number;
  /** Seconds, including the release. */
  readonly dur: number;
  /** Peak gain. */
  readonly vol: number;
  /** Seconds after the given time. */
  readonly delay?: number;
  readonly attack?: number;
  /** Level the note decays to after the attack, as a fraction of `vol` (1 = organ-like hold). */
  readonly sustain?: number;
  readonly release?: number;
  /** Vibrato depth in cents; adds a little life to long lead notes. */
  readonly vibrato?: number;
}

export interface NoiseSpec {
  readonly dur: number;
  readonly vol: number;
  readonly delay?: number;
  readonly filter?: BiquadFilterType;
  readonly freq?: number;
  /** Optional end cutoff for a filter sweep. */
  readonly to?: number;
  readonly q?: number;
}

export class Synth {
  private readonly waves = new Map<number, PeriodicWave>();
  private noiseBuffer: AudioBuffer | null = null;

  constructor(readonly ctx: BaseAudioContext) {}

  tone(dest: AudioNode, time: number, s: ToneSpec): void {
    const ctx = this.ctx;
    const start = time + (s.delay ?? 0);
    const end = start + s.dur;
    const osc = ctx.createOscillator();
    this.setWave(osc, s.wave);
    osc.frequency.setValueAtTime(s.freq, start);
    if (s.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, s.to), end);
    if (s.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = s.vibrato;
      lfo.connect(depth).connect(osc.detune);
      lfo.start(start + Math.min(0.12, s.dur / 2));
      lfo.stop(end + 0.05);
    }

    const g = ctx.createGain();
    const attack = s.attack ?? 0.004;
    const release = Math.min(s.release ?? 0.05, s.dur * 0.6);
    const sustain = s.sustain ?? 1;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(s.vol, start + attack);
    if (sustain < 1) g.gain.setTargetAtTime(s.vol * sustain, start + attack, 0.06);
    // setTargetAtTime never clicks, even if it starts mid-ramp.
    g.gain.setTargetAtTime(0, Math.max(start + attack, end - release), release / 3);

    osc.connect(g).connect(dest);
    osc.start(start);
    osc.stop(end + 0.05);
    osc.onended = () => g.disconnect();
  }

  noise(dest: AudioNode, time: number, s: NoiseSpec): void {
    const ctx = this.ctx;
    const start = time + (s.delay ?? 0);
    const end = start + s.dur;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise();
    src.loop = true;

    const g = ctx.createGain();
    g.gain.setValueAtTime(s.vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, end);

    let head: AudioNode = src;
    if (s.filter) {
      const f = ctx.createBiquadFilter();
      f.type = s.filter;
      f.frequency.setValueAtTime(s.freq ?? 1000, start);
      if (s.to !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, s.to), end);
      f.Q.value = s.q ?? 1;
      src.connect(f);
      head = f;
    }
    head.connect(g).connect(dest);
    // Start somewhere random in the buffer so repeated hits do not sound identical.
    src.start(start, Math.random() * 0.9);
    src.stop(end + 0.02);
    src.onended = () => g.disconnect();
  }

  private setWave(osc: OscillatorNode, wave: Wave) {
    if (wave === 'pulse25') osc.setPeriodicWave(this.pulse(0.25));
    else if (wave === 'pulse12') osc.setPeriodicWave(this.pulse(0.125));
    else osc.type = wave;
  }

  /** Band-limited pulse wave from its Fourier series: a_n = 2/(n*pi) * sin(n*pi*duty). */
  private pulse(duty: number): PeriodicWave {
    let wave = this.waves.get(duty);
    if (!wave) {
      const n = 48;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let i = 1; i < n; i++) real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
      wave = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(duty, wave);
    }
    return wave;
  }

  private getNoise(): AudioBuffer {
    if (!this.noiseBuffer) {
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A4" -> 69, "C#5" -> 73, "Bb3" -> 58. Returns null for anything else. */
export function noteToMidi(note: string): number | null {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(note);
  if (!m) return null;
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]!]! + accidental;
}

export const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
