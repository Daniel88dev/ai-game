import type { Synth } from './synth';

/**
 * Sound effects, each a few lines of synthesis (jsfxr-style: a blip, a slide, a noise burst).
 * Volumes are relative; the engine's SFX gain sets the overall level.
 */
export const SFX_IDS = [
  // UI
  'click',
  'select',
  'talk',
  'open',
  // Combat: hero side
  'hitEnemy',
  'critEnemy',
  'armor',
  'miss',
  'aiPatch',
  'aiAssist',
  'hallucinate',
  'clue',
  'rootCause',
  'test',
  'heal',
  // Combat: enemy side
  'heroHurt',
  'heroHurtHeavy',
  'dodge',
  'warning',
  'enemyGrow',
  'enemyRevive',
  'battleStart',
  'victory',
  'defeat',
  'retreat',
  // Progress
  'questAccepted',
  'questReady',
  'questComplete',
  'levelUp',
  'coin',
  'success',
  'error',
  'keyType',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

type Play = (s: Synth, out: AudioNode, t: number) => void;

/** Plays a short melody: [note frequency, length in seconds] pairs, back to back. */
const melody = (s: Synth, out: AudioNode, t: number, notes: readonly [number, number][], wave: 'pulse25' | 'square' | 'triangle', vol: number) => {
  let at = 0;
  for (const [freq, dur] of notes) {
    if (freq > 0) s.tone(out, t, { wave, freq, dur: dur * 0.95, vol, delay: at, sustain: 0.7 });
    at += dur;
  }
};

// Note frequencies used by the jingles.
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, B5 = 987.77;
const C6 = 1046.5, E6 = 1318.5, G6 = 1568;
const G4 = 392, A4 = 440, C4 = 261.63, Eb4 = 311.13, D4 = 293.66;

export const SFX: Record<SfxId, Play> = {
  click: (s, o, t) => s.tone(o, t, { wave: 'pulse25', freq: 1200, to: 1500, dur: 0.035, vol: 0.25 }),
  select: (s, o, t) => {
    s.tone(o, t, { wave: 'pulse25', freq: 660, dur: 0.05, vol: 0.25 });
    s.tone(o, t, { wave: 'pulse25', freq: 990, dur: 0.07, vol: 0.25, delay: 0.05 });
  },
  talk: (s, o, t) => {
    s.tone(o, t, { wave: 'triangle', freq: 520, dur: 0.06, vol: 0.4 });
    s.tone(o, t, { wave: 'triangle', freq: 780, dur: 0.08, vol: 0.4, delay: 0.06 });
  },
  open: (s, o, t) => s.tone(o, t, { wave: 'pulse25', freq: 400, to: 800, dur: 0.09, vol: 0.2 }),

  hitEnemy: (s, o, t) => {
    s.noise(o, t, { dur: 0.12, vol: 0.5, filter: 'lowpass', freq: 3000, to: 400 });
    s.tone(o, t, { wave: 'square', freq: 420, to: 110, dur: 0.12, vol: 0.28 });
  },
  critEnemy: (s, o, t) => {
    s.noise(o, t, { dur: 0.2, vol: 0.6, filter: 'lowpass', freq: 5000, to: 300 });
    s.tone(o, t, { wave: 'square', freq: 900, to: 140, dur: 0.18, vol: 0.3 });
    s.tone(o, t, { wave: 'pulse25', freq: 1760, dur: 0.06, vol: 0.18, delay: 0.02 });
  },
  armor: (s, o, t) => {
    s.tone(o, t, { wave: 'square', freq: 1400, to: 1300, dur: 0.12, vol: 0.12 });
    s.tone(o, t, { wave: 'square', freq: 1870, dur: 0.1, vol: 0.08 });
  },
  miss: (s, o, t) => s.noise(o, t, { dur: 0.18, vol: 0.25, filter: 'bandpass', freq: 600, to: 2400, q: 2 }),
  aiPatch: (s, o, t) => {
    s.tone(o, t, { wave: 'sawtooth', freq: 300, to: 1600, dur: 0.18, vol: 0.18 });
    s.tone(o, t, { wave: 'pulse12', freq: 600, to: 3200, dur: 0.18, vol: 0.12 });
    s.noise(o, t, { dur: 0.12, vol: 0.4, delay: 0.18, filter: 'lowpass', freq: 3000, to: 400 });
  },
  aiAssist: (s, o, t) => {
    for (let i = 0; i < 4; i++) s.tone(o, t, { wave: 'pulse12', freq: 1200 + i * 300, dur: 0.05, vol: 0.12, delay: i * 0.04 });
  },
  hallucinate: (s, o, t) => {
    for (let i = 0; i < 5; i++) {
      s.tone(o, t, { wave: 'square', freq: 300 + ((i * 337) % 700), dur: 0.05, vol: 0.14, delay: i * 0.045 });
    }
    s.tone(o, t, { wave: 'triangle', freq: 500, to: 150, dur: 0.3, vol: 0.25, vibrato: 80 });
  },
  clue: (s, o, t) => {
    s.tone(o, t, { wave: 'triangle', freq: B5, dur: 0.08, vol: 0.35 });
    s.tone(o, t, { wave: 'triangle', freq: E6, dur: 0.16, vol: 0.35, delay: 0.08 });
  },
  rootCause: (s, o, t) => melody(s, o, t, [[E5, 0.07], [G5, 0.07], [B5, 0.07], [E6, 0.22]], 'triangle', 0.35),
  test: (s, o, t) => {
    SFX.hitEnemy(s, o, t);
    s.tone(o, t, { wave: 'pulse25', freq: C6, dur: 0.08, vol: 0.18, delay: 0.12 });
    s.tone(o, t, { wave: 'pulse25', freq: G6, dur: 0.14, vol: 0.18, delay: 0.2 });
  },
  heal: (s, o, t) => melody(s, o, t, [[C5, 0.06], [E5, 0.06], [G5, 0.06], [C6, 0.16]], 'triangle', 0.35),

  heroHurt: (s, o, t) => {
    s.tone(o, t, { wave: 'square', freq: 260, to: 70, dur: 0.18, vol: 0.3 });
    s.noise(o, t, { dur: 0.1, vol: 0.35, filter: 'lowpass', freq: 1500 });
  },
  heroHurtHeavy: (s, o, t) => {
    s.tone(o, t, { wave: 'sine', freq: 150, to: 35, dur: 0.35, vol: 0.7 });
    s.tone(o, t, { wave: 'square', freq: 200, to: 50, dur: 0.3, vol: 0.3 });
    s.noise(o, t, { dur: 0.35, vol: 0.55, filter: 'lowpass', freq: 2500, to: 150 });
  },
  dodge: (s, o, t) => s.noise(o, t, { dur: 0.16, vol: 0.3, filter: 'bandpass', freq: 3000, to: 700, q: 3 }),
  warning: (s, o, t) => {
    for (let i = 0; i < 2; i++) {
      s.tone(o, t, { wave: 'square', freq: 880, dur: 0.09, vol: 0.14, delay: i * 0.2 });
      s.tone(o, t, { wave: 'square', freq: 660, dur: 0.09, vol: 0.14, delay: i * 0.2 + 0.1 });
    }
  },
  enemyGrow: (s, o, t) => s.tone(o, t, { wave: 'triangle', freq: 120, to: 360, dur: 0.35, vol: 0.4, vibrato: 60 }),
  enemyRevive: (s, o, t) => {
    s.tone(o, t, { wave: 'sawtooth', freq: 90, to: 220, dur: 0.5, vol: 0.18, vibrato: 40 });
    s.noise(o, t, { dur: 0.5, vol: 0.2, filter: 'bandpass', freq: 400, to: 1200, q: 4 });
  },
  battleStart: (s, o, t) => {
    s.noise(o, t, { dur: 0.3, vol: 0.3, filter: 'bandpass', freq: 400, to: 4000, q: 2 });
    melody(s, o, t + 0.1, [[A4, 0.07], [C5, 0.07], [E5, 0.07], [A5, 0.2]], 'square', 0.14);
  },
  victory: (s, o, t) =>
    melody(s, o, t, [[C5, 0.1], [E5, 0.1], [G5, 0.1], [C6, 0.1], [0, 0.05], [G5, 0.08], [C6, 0.35]], 'pulse25', 0.22),
  defeat: (s, o, t) => melody(s, o, t, [[G4, 0.18], [Eb4, 0.18], [D4, 0.18], [C4, 0.5]], 'triangle', 0.4),
  retreat: (s, o, t) => s.tone(o, t, { wave: 'pulse25', freq: 700, to: 150, dur: 0.25, vol: 0.18 }),

  questAccepted: (s, o, t) => melody(s, o, t, [[G5, 0.07], [C6, 0.14]], 'pulse25', 0.2),
  questReady: (s, o, t) => melody(s, o, t, [[E5, 0.07], [A5, 0.07], [C6, 0.14]], 'pulse25', 0.2),
  questComplete: (s, o, t) =>
    melody(s, o, t, [[C5, 0.08], [D5, 0.08], [E5, 0.08], [G5, 0.08], [E5, 0.08], [G5, 0.08], [C6, 0.3]], 'pulse25', 0.22),
  levelUp: (s, o, t) => {
    melody(s, o, t, [[C5, 0.06], [E5, 0.06], [G5, 0.06], [C6, 0.06], [E6, 0.06], [G6, 0.3]], 'square', 0.14);
    melody(s, o, t, [[C4, 0.24], [G4, 0.36]], 'triangle', 0.35);
  },
  coin: (s, o, t) => {
    s.tone(o, t, { wave: 'square', freq: B5, dur: 0.06, vol: 0.14 });
    s.tone(o, t, { wave: 'square', freq: E6, dur: 0.2, vol: 0.14, delay: 0.06 });
  },
  success: (s, o, t) => melody(s, o, t, [[A5, 0.07], [E6, 0.18]], 'pulse25', 0.2),
  error: (s, o, t) => {
    s.tone(o, t, { wave: 'square', freq: 140, dur: 0.12, vol: 0.18 });
    s.tone(o, t, { wave: 'square', freq: 147, dur: 0.12, vol: 0.18 });
  },
  keyType: (s, o, t) => s.noise(o, t, { dur: 0.025, vol: 0.18, filter: 'highpass', freq: 2500 }),
};
