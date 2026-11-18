import { aiTokenCost } from '../combat/battle';
import { accept, reject } from '../shared/result';
import { gradeFor, hallucinationChance, type Cost, type MinigameModule } from './shared';

/**
 * Coverage Crawl (design/minigames.md §3), turn-based.
 *
 * The function under test is a set of branches in the dark. Playing an input
 * card "lights" the branches it runs through (line coverage). Each branch
 * hides a mutant; only an assertion on a lit branch kills it (mutation score).
 * The lesson: 100% coverage with no assertions is still 0% safety.
 */
export interface CoverageBranch {
  readonly id: string;
  readonly code: string;
  readonly lines: number;
  readonly mutant: string;
}

export interface CoverageCard {
  readonly id: string;
  readonly label: string;
  readonly reaches: readonly string[];
}

export const COVERAGE_FUNCTION = 'monthlyBudget(income, expenses, currency, period)';

export const BRANCHES: readonly CoverageBranch[] = [
  { id: 'nullIncome', code: "if (income == null) throw new Error('no income')", lines: 2, mutant: '== null flipped to != null' },
  { id: 'overspend', code: 'if (expenses > income) flags.push(OVERSPEND)', lines: 3, mutant: '> changed to >=' },
  { id: 'currency', code: "if (currency !== 'EUR') amount = convert(amount)", lines: 4, mutant: 'conversion rate inverted' },
  { id: 'yearly', code: "if (period === 'yearly') amount = amount / 12", lines: 3, mutant: '/ 12 changed to / 10' },
  { id: 'rounding', code: 'return roundHalfEven(amount, 2)', lines: 2, mutant: 'roundHalfEven swapped for Math.round' },
  { id: 'happy', code: 'return { amount, flags }', lines: 4, mutant: 'flags dropped from the result' },
];

export const CARDS: readonly CoverageCard[] = [
  { id: 'null', label: 'income = null', reaches: ['nullIncome'] },
  { id: 'typical', label: 'income 3000, expenses 1200', reaches: ['happy'] },
  { id: 'zero', label: 'income = 0', reaches: ['happy'] },
  { id: 'overspend', label: 'expenses > income', reaches: ['overspend', 'happy'] },
  { id: 'usd', label: "currency = 'USD'", reaches: ['currency', 'happy'] },
  { id: 'yearlyUsd', label: "'yearly' + 'USD'", reaches: ['currency', 'yearly', 'happy'] },
  { id: 'halfCent', label: 'amount = 10.005', reaches: ['rounding', 'happy'] },
  { id: 'yearly', label: "period = 'yearly'", reaches: ['yearly', 'happy'] },
];

export interface CoverageSession {
  readonly kind: 'coverage';
  readonly questId: string;
  readonly lit: readonly string[];
  readonly killed: readonly string[];
  readonly played: readonly string[];
  readonly movesLeft: number;
  readonly movesTotal: number;
  /** Logic + Domain Insight 5+: see which branches a card reaches before playing it. */
  readonly previewReach: boolean;
  readonly generatedUsed: boolean;
  readonly phase: 'playing' | 'submitted';
}

export type CoverageMove =
  | { readonly kind: 'playInput'; readonly cardId: string }
  | { readonly kind: 'assert'; readonly branchId: string }
  | { readonly kind: 'generateTests' }
  | { readonly kind: 'submit' };

type CoverageEventBody =
  | { type: 'CoverageInputPlayed'; cardId: string; lit: readonly string[] }
  | { type: 'CoverageAssertionAdded'; branchId: string }
  | { type: 'CoverageTestsGenerated'; lit: readonly string[]; killed: readonly string[] }
  | { type: 'CoverageSubmitted' };

export type CoverageEvent = CoverageEventBody & { readonly game: 'coverage'; readonly cost?: Cost };

const ev = (body: CoverageEventBody, cost?: Cost): CoverageEvent =>
  cost ? { ...body, game: 'coverage', cost } : { ...body, game: 'coverage' };

const TOTAL_LINES = BRANCHES.reduce((n, b) => n + b.lines, 0);

export function coveragePercent(s: Pick<CoverageSession, 'lit'>): number {
  const lines = BRANCHES.filter((b) => s.lit.includes(b.id)).reduce((n, b) => n + b.lines, 0);
  return Math.round((lines / TOTAL_LINES) * 100);
}

export function mutationPercent(s: Pick<CoverageSession, 'killed'>): number {
  return Math.round((s.killed.length / BRANCHES.length) * 100);
}

const union = (a: readonly string[], b: readonly string[]) => [...a, ...b.filter((x) => !a.includes(x))];

export const coverage: MinigameModule<CoverageSession, CoverageMove, CoverageEvent> = {
  title: 'Coverage Crawl: the budget calculator',

  start(questId, hero) {
    const moves = 7 + hero.attributes.velocity;
    return {
      kind: 'coverage',
      questId,
      lit: [],
      killed: [],
      played: [],
      movesLeft: moves,
      movesTotal: moves,
      previewReach: hero.attributes.logic + hero.attributes.domainInsight >= 5,
      generatedUsed: false,
      phase: 'playing',
    };
  },

  decide(s, move, hero, rng) {
    if (s.phase !== 'playing') return reject('Already submitted');
    const events: CoverageEvent[] = [];
    switch (move.kind) {
      case 'playInput': {
        const card = CARDS.find((c) => c.id === move.cardId);
        if (!card) return reject('Unknown input');
        if (s.played.includes(card.id)) return reject('You already have that test');
        events.push(ev({ type: 'CoverageInputPlayed', cardId: card.id, lit: card.reaches }));
        break;
      }
      case 'assert': {
        if (!s.lit.includes(move.branchId)) return reject('No test reaches that branch yet');
        if (s.killed.includes(move.branchId)) return reject('That mutant is already dead');
        events.push(ev({ type: 'CoverageAssertionAdded', branchId: move.branchId }));
        break;
      }
      case 'generateTests': {
        if (s.generatedUsed) return reject('PILOT already generated tests for this file');
        const cost = aiTokenCost(hero.attributes.orchestration);
        if (hero.tokens < cost) return reject('Not enough tokens');
        // PILOT writes many tests fast. Most only assert that "something" came back.
        const lit = BRANCHES.filter((b) => b.id === 'happy' || !rng.chance(0.25)).map((b) => b.id);
        const assertChance = 1 - hallucinationChance(hero.attributes.promptCraft, 0.35);
        const killed = lit.filter((id) => !s.killed.includes(id) && rng.chance(assertChance));
        events.push(ev({ type: 'CoverageTestsGenerated', lit, killed }, { tokens: cost }));
        break;
      }
      case 'submit':
        events.push(ev({ type: 'CoverageSubmitted' }));
        return accept(...events);
    }
    if (s.movesLeft - 1 <= 0) events.push(ev({ type: 'CoverageSubmitted' }));
    return accept(...events);
  },

  evolve(s, e) {
    switch (e.type) {
      case 'CoverageInputPlayed':
        return { ...s, lit: union(s.lit, e.lit), played: [...s.played, e.cardId], movesLeft: s.movesLeft - 1 };
      case 'CoverageAssertionAdded':
        return { ...s, killed: [...s.killed, e.branchId], movesLeft: s.movesLeft - 1 };
      case 'CoverageTestsGenerated':
        return { ...s, lit: union(s.lit, e.lit), killed: union(s.killed, e.killed), generatedUsed: true, movesLeft: s.movesLeft - 1 };
      case 'CoverageSubmitted':
        return { ...s, phase: 'submitted' };
    }
  },

  isOver: (s) => s.phase === 'submitted',

  result(s) {
    const cov = coveragePercent(s);
    const mut = mutationPercent(s);
    const score = Math.round(cov * 0.4 + mut * 0.6);
    const summary = [`Line coverage ${cov}%. Mutation score ${mut}%.`];
    if (cov >= 90 && mut < 50) summary.push('Lots of light, few assertions. The mutants are still in there.');
    const survivors = BRANCHES.filter((b) => !s.killed.includes(b.id));
    if (survivors.length) summary.push(`Surviving mutants: ${survivors.map((b) => b.mutant).join('; ')}.`);
    else summary.push('Every mutant is dead. Lena is impressed.');
    return { score, grade: gradeFor(score), summary };
  },
};
