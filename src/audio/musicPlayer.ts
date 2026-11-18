import { midiToFreq, type Synth } from './synth';
import type { Drum, Instrument, Track, TrackId } from './tracks';

const LOOKAHEAD_S = 0.15;
const TICK_MS = 25;
const FADE_S = 0.6;

interface StepEvent {
  readonly instrument: Instrument;
  readonly len: number;
  readonly midi?: number;
  readonly drum?: Drum;
}

interface Playing {
  readonly track: Track;
  readonly gain: GainNode;
  /** Events grouped by step, so each tick is a lookup instead of a scan. */
  readonly byStep: readonly (readonly StepEvent[])[];
  step: number;
  nextTime: number;
}

/**
 * Lookahead step sequencer (the "two clocks" pattern): a JS timer wakes up often
 * and schedules the notes of the next ~150 ms on the AudioContext clock, which is
 * sample-accurate. Switching songs crossfades.
 */
export class MusicPlayer {
  private current: Playing | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly synth: Synth,
    private readonly out: AudioNode,
  ) {}

  get trackId(): TrackId | null {
    return this.current?.track.id ?? null;
  }

  play(track: Track | null): void {
    if ((track?.id ?? null) === this.trackId) return;
    const ctx = this.synth.ctx;
    const now = ctx.currentTime;
    if (this.current) {
      const old = this.current.gain;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + FADE_S);
      setTimeout(() => old.disconnect(), (FADE_S + LOOKAHEAD_S) * 1000 + 100);
      this.current = null;
    }
    if (!track) {
      this.stopTimer();
      return;
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE_S);
    gain.connect(this.out);

    const byStep: StepEvent[][] = Array.from({ length: track.steps }, () => []);
    for (const { instrument, events } of track.channels) {
      for (const e of events) byStep[e.step]!.push({ instrument, len: e.len, midi: e.midi, drum: e.drum });
    }
    this.current = { track, gain, byStep, step: 0, nextTime: now + 0.05 };
    if (!this.timer) this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop(): void {
    this.play(null);
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const p = this.current;
    if (!p) return;
    const now = this.synth.ctx.currentTime;
    const stepDur = 60 / p.track.bpm / 4;
    // Background tabs throttle timers; skip ahead instead of firing a burst of late notes.
    if (p.nextTime < now - 0.05) p.nextTime = now + 0.02;
    while (p.nextTime < now + LOOKAHEAD_S) {
      for (const e of p.byStep[p.step]!) this.note(p.gain, p.nextTime, e.instrument, e.len * stepDur, e.midi, e.drum);
      p.nextTime += stepDur;
      p.step = (p.step + 1) % p.track.steps;
    }
  }

  private note(out: AudioNode, t: number, instrument: Instrument, len: number, midi?: number, drum?: Drum) {
    const s = this.synth;
    if (drum) {
      this.drum(out, t, drum);
      return;
    }
    if (midi === undefined) return;
    const freq = midiToFreq(midi);
    switch (instrument) {
      case 'lead':
        s.tone(out, t, { wave: 'pulse25', freq, dur: len * 0.95, vol: 0.2, sustain: 0.6, release: 0.06, vibrato: len > 0.3 ? 12 : 0 });
        break;
      case 'leadHard':
        s.tone(out, t, { wave: 'square', freq, dur: len * 0.9, vol: 0.14, sustain: 0.7, release: 0.04, vibrato: len > 0.3 ? 15 : 0 });
        break;
      case 'bass':
        s.tone(out, t, { wave: 'triangle', freq, dur: len * 0.9, vol: 0.45, sustain: 0.85, release: 0.03 });
        break;
      case 'arp':
        s.tone(out, t, { wave: 'pulse12', freq, dur: Math.min(len, 0.12) * 0.9, vol: 0.07, release: 0.03 });
        break;
      case 'pad':
        s.tone(out, t, { wave: 'triangle', freq, dur: len, vol: 0.12, attack: 0.2, release: 0.3 });
        break;
    }
  }

  private drum(out: AudioNode, t: number, d: Drum) {
    const s = this.synth;
    if (d === 'k') s.tone(out, t, { wave: 'sine', freq: 150, to: 40, dur: 0.14, vol: 0.6 });
    else if (d === 's') {
      s.noise(out, t, { dur: 0.13, vol: 0.22, filter: 'bandpass', freq: 1800, q: 0.8 });
      s.tone(out, t, { wave: 'triangle', freq: 200, to: 120, dur: 0.06, vol: 0.2 });
    } else if (d === 'h') s.noise(out, t, { dur: 0.03, vol: 0.08, filter: 'highpass', freq: 7000 });
    else s.noise(out, t, { dur: 0.14, vol: 0.07, filter: 'highpass', freq: 6000 });
  }
}
