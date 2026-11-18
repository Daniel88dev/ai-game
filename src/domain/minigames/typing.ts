import { aiTokenCost } from '../combat/battle';
import { accept, reject } from '../shared/result';
import { gradeFor, hallucinationChance, type Cost, type MinigameModule } from './shared';

/**
 * Typing Sprint: write the code yourself, one keystroke at a time.
 *
 * Lines of code appear; the player types them on the keyboard. A wrong key
 * counts as a typo and does not advance. Time passes through `tick` moves sent
 * by the UI once per second, so the decider stays pure and replayable.
 * The AI can autocomplete the rest of a line (tokens), but sometimes completes
 * it with something plausible and wrong.
 */
export interface TypingText {
  readonly id: string;
  readonly title: string;
  readonly file: string;
  readonly lines: readonly string[];
  /** Plausible wrong completions the AI may produce, one per line. */
  readonly wrong: readonly string[];
}

export const TYPING_TEXTS: Record<string, TypingText> = {
  wrenConfig: {
    id: 'wrenConfig',
    title: "Typing Sprint: WREN's config",
    file: '.wren/config.yml',
    lines: ['model: wren-2', 'context: ./docs', 'tools: [git, tests, search]', 'autonomy: ask-before-merge', 'max_tokens: 4096'],
    wrong: ['model: wren-2-turbo-ultra', 'context: /', 'tools: [git, rm, curl]', 'autonomy: yolo', 'max_tokens: infinity'],
  },
  agentsDoc: {
    id: 'agentsDoc',
    title: 'Typing Sprint: AGENTS.md',
    file: 'AGENTS.md',
    lines: [
      '# Rules for agents',
      'Run npm test before every commit.',
      'Money is integers in cents.',
      'Never edit monolith/legacy without a test.',
      'When unsure, ask a human.',
    ],
    wrong: [
      '# Rules for agents (optional)',
      'Run tests if you have time.',
      'Money is floats, it is fine.',
      'Refactor monolith/legacy freely.',
      'When unsure, guess confidently.',
    ],
  },
};

export interface TypingLine {
  readonly text: string;
  /** How many characters are typed correctly so far. */
  readonly typed: number;
  readonly by: 'you' | 'ai' | null;
  /** The AI completed this line with something wrong. */
  readonly hallucinated: boolean;
}

export interface TypingSession {
  readonly kind: 'typing';
  readonly questId: string;
  readonly textId: string;
  readonly lines: readonly TypingLine[];
  readonly current: number;
  readonly typos: number;
  readonly keystrokes: number;
  readonly secondsLeft: number;
  readonly secondsTotal: number;
  readonly aiCompletions: number;
  readonly phase: 'playing' | 'done' | 'timeout';
}

export type TypingMove =
  | { readonly kind: 'key'; readonly char: string }
  | { readonly kind: 'tick' }
  | { readonly kind: 'aiComplete' };

type TypingEventBody =
  | { type: 'TypingKeyHit'; correct: boolean }
  | { type: 'TypingTicked' }
  | { type: 'TypingLineCompletedByAi'; line: number; hallucinated: boolean; text: string }
  | { type: 'TypingFinished'; reason: 'done' | 'timeout' };

export type TypingEvent = TypingEventBody & { readonly game: 'typing'; readonly cost?: Cost };

const ev = (body: TypingEventBody, cost?: Cost): TypingEvent => (cost ? { ...body, game: 'typing', cost } : { ...body, game: 'typing' });

const TEXT_FOR_QUEST: Record<string, string> = { 'LUM-102': 'wrenConfig', 'LUM-140': 'agentsDoc' };

/** Autocompleting one line is cheaper than a full AI patch. */
export const typingAiCost = (orchestration: number) => Math.max(3, Math.ceil(aiTokenCost(orchestration) / 2));

export function typingTextFor(questId: string): TypingText {
  return TYPING_TEXTS[TEXT_FOR_QUEST[questId] ?? 'wrenConfig']!;
}

function advanceLine(s: TypingSession): TypingSession {
  const next = s.current + 1;
  return { ...s, current: next, phase: next >= s.lines.length ? 'done' : s.phase };
}

export const typing: MinigameModule<TypingSession, TypingMove, TypingEvent> = {
  title: 'Typing Sprint',

  start(questId, hero) {
    const text = typingTextFor(questId);
    const seconds = 40 + hero.attributes.velocity * 4 + hero.attributes.focus;
    return {
      kind: 'typing',
      questId,
      textId: text.id,
      lines: text.lines.map((t) => ({ text: t, typed: 0, by: null, hallucinated: false })),
      current: 0,
      typos: 0,
      keystrokes: 0,
      secondsLeft: seconds,
      secondsTotal: seconds,
      aiCompletions: 0,
      phase: 'playing',
    };
  },

  decide(s, move, hero, rng) {
    if (s.phase !== 'playing') return reject('The sprint is over');
    const line = s.lines[s.current]!;
    switch (move.kind) {
      case 'key': {
        if (move.char.length !== 1) return reject('One character at a time');
        const correct = line.text[line.typed] === move.char;
        const events = [ev({ type: 'TypingKeyHit', correct })];
        const lastChar = correct && line.typed + 1 === line.text.length;
        if (lastChar && s.current === s.lines.length - 1) events.push(ev({ type: 'TypingFinished', reason: 'done' }));
        return accept(...events);
      }
      case 'tick': {
        const events = [ev({ type: 'TypingTicked' })];
        if (s.secondsLeft - 1 <= 0) events.push(ev({ type: 'TypingFinished', reason: 'timeout' }));
        return accept(...events);
      }
      case 'aiComplete': {
        const cost = typingAiCost(hero.attributes.orchestration);
        if (hero.tokens < cost) return reject('Not enough tokens');
        const hallucinated = rng.chance(hallucinationChance(hero.attributes.promptCraft, -0.05 - (hero.clarity ?? 0)));
        const text = hallucinated ? typingTextFor(s.questId).wrong[s.current] ?? line.text : line.text;
        const events = [ev({ type: 'TypingLineCompletedByAi', line: s.current, hallucinated, text }, { tokens: cost })];
        if (s.current === s.lines.length - 1) events.push(ev({ type: 'TypingFinished', reason: 'done' }));
        return accept(...events);
      }
    }
  },

  evolve(s, e) {
    switch (e.type) {
      case 'TypingKeyHit': {
        if (!e.correct) return { ...s, typos: s.typos + 1, keystrokes: s.keystrokes + 1 };
        const line = s.lines[s.current]!;
        const typed = line.typed + 1;
        const lines = s.lines.map((l, i) => (i === s.current ? { ...l, typed, by: 'you' as const } : l));
        const next = { ...s, lines, keystrokes: s.keystrokes + 1 };
        return typed >= line.text.length ? advanceLine(next) : next;
      }
      case 'TypingTicked':
        return { ...s, secondsLeft: s.secondsLeft - 1 };
      case 'TypingLineCompletedByAi': {
        const lines = s.lines.map((l, i) =>
          i === e.line ? { text: e.text, typed: e.text.length, by: 'ai' as const, hallucinated: e.hallucinated } : l,
        );
        return advanceLine({ ...s, lines, aiCompletions: s.aiCompletions + 1 });
      }
      case 'TypingFinished':
        return { ...s, phase: e.reason };
    }
  },

  isOver: (s) => s.phase !== 'playing',

  result(s) {
    const text = typingTextFor(s.questId);
    const correctChars = s.lines.reduce((n, l, i) => n + (l.hallucinated ? 0 : Math.min(l.typed, text.lines[i]!.length)), 0);
    const original = text.lines.reduce((n, l) => n + l.length, 0);
    const completion = Math.round((correctChars / original) * 100);
    const accuracy = s.keystrokes === 0 ? 100 : Math.round(((s.keystrokes - s.typos) / s.keystrokes) * 100);
    const elapsed = Math.max(1, s.secondsTotal - s.secondsLeft);
    const yourChars = s.lines.filter((l) => l.by === 'you').reduce((n, l) => n + l.typed, 0);
    const wpm = Math.round(yourChars / 5 / (elapsed / 60));
    const bad = s.lines.filter((l) => l.hallucinated);
    let score = Math.round(completion * 0.75 + accuracy * 0.25) - bad.length * 15;
    if (s.phase === 'done' && s.secondsLeft >= 10) score += 5;
    score = Math.max(0, Math.min(100, score));
    const summary = [
      `${completion}% of ${text.file} written correctly. Accuracy ${accuracy}%, ${s.typos} typo(s), about ${wpm} WPM.`,
    ];
    if (s.aiCompletions) summary.push(`The AI autocompleted ${s.aiCompletions} line(s).`);
    for (const l of bad) summary.push(`Autocomplete wrote "${l.text}". Somebody will have to fix that.`);
    if (s.phase === 'timeout') summary.push('Time ran out before the file was finished.');
    return { score, grade: gradeFor(score), summary };
  },
};
