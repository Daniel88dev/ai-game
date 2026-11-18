import { aiTokenCost } from '../combat/battle';
import { accept, reject } from '../shared/result';
import { gradeFor, hallucinationChance, type Cost, type MinigameModule } from './shared';

/**
 * CI Pipeline: Flaky Test Wrangler (design/minigames.md §2), turn-based.
 *
 * Release is in N minutes. Every action costs minutes. Run the pipeline;
 * flaky tests fail at random, a real bug always fails. Diagnose a red test
 * to learn its cause, then apply the matching fix. Quarantine is fast but
 * a quarantined real bug ships to production. PILOT patches without
 * diagnosing, but sometimes "fixes" a test with sleep(5), which slows
 * every later run, or quietly quarantines it.
 */
export type CiCause = 'stable' | 'timing' | 'sharedState' | 'orderDependent' | 'timezone' | 'realBug';
export type CiTool = 'awaitEvent' | 'isolateState' | 'resetOrder' | 'freezeClock' | 'fixCode';

export const CI_TOOLS: Record<CiTool, { label: string; fixes: CiCause; hint: string }> = {
  awaitEvent: { label: 'Await, not sleep', fixes: 'timing', hint: 'Wait for the real event instead of a fixed delay.' },
  isolateState: { label: 'Isolate state', fixes: 'sharedState', hint: 'Fresh fixtures per test, no leaking globals.' },
  resetOrder: { label: 'Remove order dependency', fixes: 'orderDependent', hint: 'The test must pass alone and in any order.' },
  freezeClock: { label: 'Freeze the clock', fixes: 'timezone', hint: 'Pin time and timezone in the test.' },
  fixCode: { label: 'Fix the code', fixes: 'realBug', hint: 'Not a flake. The product is broken.' },
};

export const CI_CAUSE_LABEL: Record<CiCause, string> = {
  stable: 'Stable. Nothing wrong here.',
  timing: 'Timing / race: it sleeps 100ms and hopes.',
  sharedState: 'Shared state: another test leaves data behind.',
  orderDependent: 'Order dependent: only passes after login.spec.',
  timezone: 'Timezone: fails between 00:00 and 01:00 UTC.',
  realBug: 'Real bug: rounding is wrong. It fails every time.',
};

export type CiTestStatus = 'unknown' | 'passed' | 'failed';

export interface CiTest {
  readonly id: string;
  readonly name: string;
  readonly cause: CiCause;
  /** Fail chance per run for flaky causes. */
  readonly flakiness: number;
  readonly status: CiTestStatus;
  readonly diagnosed: boolean;
  readonly fixed: boolean;
  readonly quarantined: boolean;
}

export interface CiSession {
  readonly kind: 'ciPipeline';
  readonly questId: string;
  readonly tests: readonly CiTest[];
  readonly minutesLeft: number;
  readonly minutesTotal: number;
  /** Extra minutes per run, from PILOT's sleep(5) "fixes". */
  readonly slowdown: number;
  readonly runs: number;
  readonly sleepHacks: number;
  readonly pilotQuarantines: number;
  /** Rigor 4+ flags the real bug before diagnosing. */
  readonly spotsRealBugs: boolean;
  readonly phase: 'playing' | 'shipped' | 'timeout';
}

export type CiMove =
  | { readonly kind: 'run' }
  | { readonly kind: 'diagnose'; readonly testId: string }
  | { readonly kind: 'fix'; readonly testId: string; readonly tool: CiTool }
  | { readonly kind: 'quarantine'; readonly testId: string }
  | { readonly kind: 'askPilot'; readonly testId: string };

type CiEventBody =
  | { type: 'CiPipelineRan'; results: Readonly<Record<string, 'passed' | 'failed'>>; minutes: number; green: boolean }
  | { type: 'CiTestDiagnosed'; testId: string; cause: CiCause; minutes: number }
  | { type: 'CiFixApplied'; testId: string; tool: CiTool; success: boolean; minutes: number }
  | { type: 'CiTestQuarantined'; testId: string; minutes: number }
  | { type: 'CiPilotPatched'; testId: string; outcome: 'fixed' | 'sleepHack' | 'quarantined'; minutes: number }
  | { type: 'CiReleaseMissed' };

export type CiEvent = CiEventBody & { readonly game: 'ciPipeline'; readonly cost?: Cost };

const TESTS: readonly Omit<CiTest, 'status' | 'diagnosed' | 'fixed' | 'quarantined'>[] = [
  { id: 'login', name: 'login.spec.ts', cause: 'stable', flakiness: 0 },
  { id: 'export', name: 'export-csv.spec.ts', cause: 'timing', flakiness: 0.5 },
  { id: 'budget', name: 'budget.spec.ts', cause: 'sharedState', flakiness: 0.45 },
  { id: 'signup', name: 'signup.spec.ts', cause: 'stable', flakiness: 0 },
  { id: 'currency', name: 'currency.spec.ts', cause: 'timezone', flakiness: 0.4 },
  { id: 'dashboard', name: 'dashboard.e2e.ts', cause: 'orderDependent', flakiness: 0.5 },
  { id: 'rounding', name: 'rounding.spec.ts', cause: 'realBug', flakiness: 1 },
  { id: 'api', name: 'api-client.spec.ts', cause: 'timing', flakiness: 0.35 },
];

export const RUN_MINUTES = 2;
export const DIAGNOSE_MINUTES = 1;
export const FIX_MINUTES = 1;

const ev = (body: CiEventBody, cost?: Cost): CiEvent => (cost ? { ...body, game: 'ciPipeline', cost } : { ...body, game: 'ciPipeline' });

const isActive = (t: CiTest) => !t.fixed && !t.quarantined;

function failChance(t: CiTest): number {
  if (t.fixed) return 0;
  return t.cause === 'realBug' ? 1 : t.flakiness;
}

const mapTest = (s: CiSession, id: string, f: (t: CiTest) => CiTest): CiSession => ({
  ...s,
  tests: s.tests.map((t) => (t.id === id ? f(t) : t)),
});

const spend = (s: CiSession, minutes: number): CiSession => ({ ...s, minutesLeft: s.minutesLeft - minutes });

export const ciPipeline: MinigameModule<CiSession, CiMove, CiEvent> = {
  title: 'CI Foundry: release in progress',

  start(questId, hero) {
    const minutes = 20 + hero.attributes.velocity * 2;
    return {
      kind: 'ciPipeline',
      questId,
      tests: TESTS.map((t) => ({ ...t, status: 'unknown', diagnosed: false, fixed: false, quarantined: false })),
      minutesLeft: minutes,
      minutesTotal: minutes,
      slowdown: 0,
      runs: 0,
      sleepHacks: 0,
      pilotQuarantines: 0,
      spotsRealBugs: hero.attributes.rigor >= 4,
      phase: 'playing',
    };
  },

  decide(s, move, hero, rng) {
    if (s.phase !== 'playing') return reject('The release is over');
    const test = 'testId' in move ? s.tests.find((t) => t.id === move.testId) : undefined;
    if ('testId' in move && !test) return reject('Unknown test');

    const events: CiEvent[] = [];
    let minutes = 0;
    switch (move.kind) {
      case 'run': {
        minutes = RUN_MINUTES + s.slowdown;
        const results: Record<string, 'passed' | 'failed'> = {};
        for (const t of s.tests) {
          if (t.quarantined) continue;
          results[t.id] = rng.chance(failChance(t)) ? 'failed' : 'passed';
        }
        const green = Object.values(results).every((r) => r === 'passed');
        events.push(ev({ type: 'CiPipelineRan', results, minutes, green }));
        break;
      }
      case 'diagnose': {
        if (test!.diagnosed) return reject('Already diagnosed');
        // Out of Focus: you can still dig in, it just takes longer.
        const hasFocus = hero.focusPoints >= 1;
        minutes = DIAGNOSE_MINUTES + (hasFocus ? 0 : 2);
        events.push(ev({ type: 'CiTestDiagnosed', testId: test!.id, cause: test!.cause, minutes }, hasFocus ? { focus: 1 } : undefined));
        break;
      }
      case 'fix': {
        if (!isActive(test!)) return reject('That test is already handled');
        minutes = FIX_MINUTES;
        const success = CI_TOOLS[move.tool].fixes === test!.cause;
        events.push(ev({ type: 'CiFixApplied', testId: test!.id, tool: move.tool, success, minutes }));
        break;
      }
      case 'quarantine': {
        if (!isActive(test!)) return reject('That test is already handled');
        minutes = 1;
        events.push(ev({ type: 'CiTestQuarantined', testId: test!.id, minutes }));
        break;
      }
      case 'askPilot': {
        if (!isActive(test!)) return reject('That test is already handled');
        const cost = aiTokenCost(hero.attributes.orchestration);
        if (hero.tokens < cost) return reject('Not enough tokens');
        minutes = 1;
        let outcome: 'fixed' | 'sleepHack' | 'quarantined' = 'fixed';
        if (test!.cause !== 'stable' && rng.chance(hallucinationChance(hero.attributes.promptCraft))) {
          // Act I PILOT: when a flake confuses it, it either adds a sleep or skips the test.
          outcome = test!.cause === 'timing' || rng.chance(0.5) ? 'sleepHack' : 'quarantined';
          if (test!.cause === 'realBug') outcome = 'quarantined';
        }
        events.push(ev({ type: 'CiPilotPatched', testId: test!.id, outcome, minutes }, { tokens: cost }));
        break;
      }
    }

    const green = events.some((e) => e.type === 'CiPipelineRan' && e.green);
    if (!green && s.minutesLeft - minutes <= 0) events.push(ev({ type: 'CiReleaseMissed' }));
    return accept(...events);
  },

  evolve(s, e) {
    switch (e.type) {
      case 'CiPipelineRan': {
        const next = spend({ ...s, runs: s.runs + 1 }, e.minutes);
        return {
          ...next,
          tests: next.tests.map((t) => (e.results[t.id] ? { ...t, status: e.results[t.id]! } : t)),
          phase: e.green ? 'shipped' : next.phase,
        };
      }
      case 'CiTestDiagnosed':
        return spend(mapTest(s, e.testId, (t) => ({ ...t, diagnosed: true })), e.minutes);
      case 'CiFixApplied':
        return spend(e.success ? mapTest(s, e.testId, (t) => ({ ...t, fixed: true, diagnosed: true })) : s, e.minutes);
      case 'CiTestQuarantined':
        return spend(mapTest(s, e.testId, (t) => ({ ...t, quarantined: true })), e.minutes);
      case 'CiPilotPatched': {
        const patched = mapTest(s, e.testId, (t) =>
          e.outcome === 'quarantined' ? { ...t, quarantined: true } : { ...t, fixed: true },
        );
        return spend(
          {
            ...patched,
            slowdown: patched.slowdown + (e.outcome === 'sleepHack' ? 1 : 0),
            sleepHacks: patched.sleepHacks + (e.outcome === 'sleepHack' ? 1 : 0),
            pilotQuarantines: patched.pilotQuarantines + (e.outcome === 'quarantined' ? 1 : 0),
          },
          e.minutes,
        );
      }
      case 'CiReleaseMissed':
        return { ...s, phase: 'timeout' };
    }
  },

  isOver: (s) => s.phase !== 'playing',

  result(s) {
    if (s.phase !== 'shipped') {
      return { score: 0, grade: 'F', summary: ['The release window closed with main still red.', 'Lena reschedules the release. Try again.'] };
    }
    const bugShipped = s.tests.some((t) => t.cause === 'realBug' && t.quarantined);
    const quarantinedFlakes = s.tests.filter((t) => t.quarantined && t.cause !== 'realBug').length;
    const summary: string[] = [`Main is green after ${s.runs} run(s). Released with ${s.minutesLeft} min to spare.`];
    let score = 100 + Math.min(10, s.minutesLeft);
    if (quarantinedFlakes) {
      score -= quarantinedFlakes * 12;
      summary.push(`${quarantinedFlakes} flaky test(s) quarantined. The holes are still there.`);
    }
    if (s.sleepHacks) {
      score -= s.sleepHacks * 8;
      summary.push(`PILOT added sleep(5) ${s.sleepHacks} time(s). The suite is slower now.`);
    }
    if (bugShipped) {
      score = Math.min(score - 40, 50);
      summary.push('rounding.spec.ts was a real bug, and it shipped. Users will see it.');
    } else {
      summary.push('The rounding bug was caught before release.');
    }
    score = Math.max(0, Math.min(100, score));
    return { score, grade: gradeFor(score), summary };
  },
};
