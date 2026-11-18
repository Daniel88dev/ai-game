import { noteToMidi } from './synth';

/**
 * Chiptune music written in code, as a tiny tracker.
 *
 * Pattern notation, one token per slot, separated by spaces:
 *   C4, F#5, Bb3   a note
 *   .              hold the previous note one more slot
 *   -              rest
 *   k s h o        drums: kick, snare, closed hat, open hat
 * `res` says how many 16th steps one slot lasts (1 = 16th, 2 = 8th, 4 = quarter).
 * Bass and arpeggio lines are generated from a chord list so each song is mostly
 * a progression plus one hand-written melody.
 */

export const TRACK_IDS = ['title', 'office', 'battle', 'boss', 'focus'] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export type Instrument = 'lead' | 'leadHard' | 'bass' | 'arp' | 'pad' | 'drums';
export type Drum = 'k' | 's' | 'h' | 'o';

export interface NoteEvent {
  /** 16th step inside the loop. */
  readonly step: number;
  /** Length in 16th steps. */
  readonly len: number;
  readonly midi?: number;
  readonly drum?: Drum;
}

export interface Channel {
  readonly instrument: Instrument;
  readonly events: readonly NoteEvent[];
}

export interface Track {
  readonly id: TrackId;
  readonly bpm: number;
  /** Loop length in 16th steps. */
  readonly steps: number;
  readonly channels: readonly Channel[];
}

const DRUMS = new Set(['k', 's', 'h', 'o']);

/** Parses a pattern into note events and its length in 16th steps. Throws on an unknown token. */
export function parsePattern(pattern: string, res = 1): { events: NoteEvent[]; steps: number } {
  const events: { step: number; len: number; midi?: number; drum?: Drum }[] = [];
  let open: (typeof events)[number] | null = null;
  let step = 0;
  for (const token of pattern.trim().split(/\s+/)) {
    if (token === '.') {
      if (open) open.len += res;
    } else if (token === '-') {
      open = null;
    } else if (DRUMS.has(token)) {
      open = { step, len: res, drum: token as Drum };
      events.push(open);
    } else {
      const midi = noteToMidi(token);
      if (midi === null) throw new Error(`Unknown token "${token}" in pattern`);
      open = { step, len: res, midi };
      events.push(open);
    }
    step += res;
  }
  return { events, steps: step };
}

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** "Am" -> [9, 12, 16] (semitones from C0 within one octave span), "Bb" -> [10, 14, 17], "E7" -> major triad. */
export function chordTones(chord: string): [number, number, number] {
  const m = /^([A-G])(#|b)?(m|dim)?7?$/.exec(chord);
  if (!m) throw new Error(`Unknown chord "${chord}"`);
  const root = PITCH_CLASS[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const third = m[3] === 'm' || m[3] === 'dim' ? 3 : 4;
  const fifth = m[3] === 'dim' ? 6 : 7;
  return [root, root + third, root + fifth];
}

const midiName = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

/**
 * Expands a one-bar figure over a chord list. Figure tokens:
 *   R 3 5   root, third, fifth   ·   8 root an octave up   ·   r root an octave down   ·   . and - as usual
 */
export function chordFigure(chords: readonly string[], figure: string, octave: number): string {
  const tokens = figure.trim().split(/\s+/);
  return chords
    .map((chord) => {
      const [r, t, f] = chordTones(chord);
      const base = 12 * (octave + 1);
      const pick: Record<string, number> = { R: r, 3: t, 5: f, 8: r + 12, r: r - 12 };
      return tokens.map((tok) => (tok in pick ? midiName(base + pick[tok]!) : tok)).join(' ');
    })
    .join(' ');
}

interface TrackSource {
  id: TrackId;
  bpm: number;
  channels: { instrument: Instrument; pattern: string; res?: number }[];
}

function compile(src: TrackSource): Track {
  const parsed = src.channels.map((c) => ({ instrument: c.instrument, ...parsePattern(c.pattern, c.res ?? 1) }));
  const steps = Math.max(...parsed.map((p) => p.steps));
  // Shorter channels (a 2-bar drum loop) repeat to fill the song.
  const channels = parsed.map((p) => {
    const events: NoteEvent[] = [];
    for (let offset = 0; offset < steps; offset += p.steps) {
      for (const e of p.events) if (offset + e.step < steps) events.push({ ...e, step: offset + e.step });
    }
    return { instrument: p.instrument, events };
  });
  return { id: src.id, bpm: src.bpm, steps, channels };
}

// ------------------------------------------------------------------ songs

/** Title: "git init". Slow, a little wistful. Am F C G | Am F G E */
const title: TrackSource = (() => {
  const chords = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'];
  return {
    id: 'title',
    bpm: 84,
    channels: [
      { instrument: 'arp', pattern: chordFigure(chords, 'R 3 5 8 5 3 R 3 5 8 5 3 R 3 5 3', 4) },
      { instrument: 'bass', pattern: chordFigure(chords, 'R . . . . . . . 5 . . . . . . .', 2) },
      {
        instrument: 'lead',
        res: 2,
        pattern: [
          'E5 . . . . . A4 .',
          'C5 . . . . . A4 .',
          'G4 . . . C5 . E5 .',
          'D5 . . . . . - -',
          'E5 . . . A5 . . .',
          'F5 . E5 . C5 . . .',
          'D5 . . . B4 . G4 .',
          'G#4 . . . . . - -',
        ].join(' '),
      },
      { instrument: 'drums', pattern: '- - h - - - h - - - h - - - h h' },
    ],
  };
})();

/** Office: "Standup at 9:30". Easy-going. C Am F G | C Am Dm G */
const office: TrackSource = (() => {
  const chords = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'];
  return {
    id: 'office',
    bpm: 104,
    channels: [
      { instrument: 'bass', res: 2, pattern: chordFigure(chords, 'R . 5 . 8 . 5 .', 2) },
      { instrument: 'arp', res: 2, pattern: chordFigure(chords, '- 3 5 - - 3 5 -', 4) },
      {
        instrument: 'lead',
        res: 2,
        pattern: [
          'E5 . G5 . C5 . G4 .',
          'A4 . . C5 E5 . . -',
          'F5 . A5 . C5 . A4 G4',
          'G4 . . . D5 . . -',
          'E5 . G5 . C6 . B5 .',
          'A5 . . G5 E5 . . -',
          'F5 . A5 . D5 . C5 A4',
          'B4 . . . G4 . - -',
        ].join(' '),
      },
      { instrument: 'drums', pattern: 'k - h - s - h - k k h - s - h h' },
    ],
  };
})();

/** Battle: "Exception in thread main". Driving, minor. Em C D B | Em C Am B */
const battle: TrackSource = (() => {
  const chords = ['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B'];
  return {
    id: 'battle',
    bpm: 148,
    channels: [
      { instrument: 'bass', pattern: chordFigure(chords, 'R R 8 R R R 8 R R R 8 R 5 . 8 .', 2) },
      { instrument: 'arp', pattern: chordFigure(chords, 'R 5 8 5 R 5 8 5 R 5 8 5 R 5 8 5', 4) },
      {
        instrument: 'leadHard',
        res: 2,
        pattern: [
          'E5 . . B4 E5 . G5 .',
          'G5 . E5 . C5 . E5 .',
          'F#5 . . A5 . . F#5 D5',
          'D#5 . . . F#5 . B4 .',
          'E5 . G5 . B5 . A5 G5',
          'E5 . . . C5 . E5 G5',
          'A5 . G5 . E5 . C5 .',
          'B4 . . . D#5 . F#5 .',
        ].join(' '),
      },
      { instrument: 'drums', pattern: 'k - h k s - h - k - h k s - h s' },
    ],
  };
})();

/** Boss: "Works on my machine". Heavier, Phrygian-ish turn. Dm Bb Gm A | Dm Bb Eb A */
const boss: TrackSource = (() => {
  const chords = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Eb', 'A'];
  return {
    id: 'boss',
    bpm: 160,
    channels: [
      { instrument: 'bass', pattern: chordFigure(chords, 'R R R 8 R R 5 R R R R 8 5 . 3 .', 2) },
      { instrument: 'pad', res: 16, pattern: chordFigure(chords, '3', 4) },
      { instrument: 'arp', pattern: chordFigure(chords, 'R 3 5 8 R 3 5 8 R 3 5 8 8 5 3 R', 4) },
      {
        instrument: 'leadHard',
        res: 2,
        pattern: [
          'D5 . . D5 F5 . A5 .',
          'A#5 . A5 . F5 . D5 .',
          'G5 . . A#5 . . D6 .',
          'C#6 . . A5 . E5 C#5 .',
          'D6 . C6 . A5 . F5 .',
          'D6 . . . A#5 . F5 .',
          'D#6 . . A#5 G5 . D#5 .',
          'E5 . G5 . C#6 . E6 .',
        ].join(' '),
      },
      { instrument: 'drums', pattern: 'k k h k s - h k k - h k s s h s' },
    ],
  };
})();

/** Minigames: "Focus mode". Bouncy, major. F Dm Bb C | F Dm Gm C */
const focus: TrackSource = (() => {
  const chords = ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C'];
  return {
    id: 'focus',
    bpm: 126,
    channels: [
      { instrument: 'bass', res: 2, pattern: chordFigure(chords, 'R - 8 - 5 - 8 -', 2) },
      { instrument: 'arp', pattern: chordFigure(chords, 'R 3 5 3 R 3 5 3 R 3 5 3 8 5 3 5', 4) },
      {
        instrument: 'lead',
        res: 2,
        pattern: [
          'A4 . C5 . F5 . C5 .',
          'D5 . F5 . A5 . F5 .',
          'D5 . F5 . A#5 . A5 G5',
          'E5 . . . C5 . . -',
          'F5 . A5 . C6 . A5 .',
          'A5 . F5 . D5 . F5 .',
          'G5 . A#5 . D6 . A#5 .',
          'C6 . . . G5 . E5 .',
        ].join(' '),
      },
      { instrument: 'drums', pattern: 'k - h - s - h k - k h - s - h -' },
    ],
  };
})();

export const TRACKS: Record<TrackId, Track> = {
  title: compile(title),
  office: compile(office),
  battle: compile(battle),
  boss: compile(boss),
  focus: compile(focus),
};
