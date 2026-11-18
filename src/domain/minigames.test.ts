import { describe, expect, it } from 'vitest';
import { createRng } from './shared/rng';
import { ciPipeline, type CiMove, type CiSession, type CiTool } from './minigames/ciPipeline';
import { coverage, coveragePercent, mutationPercent } from './minigames/coverage';
import { codeReview } from './minigames/codeReview';
import { typing, TYPING_TEXTS } from './minigames/typing';
import { packageAudit, PACKAGES } from './minigames/packageAudit';
import type { HeroSnapshot, MinigameModule } from './minigames/shared';
import { getMinigame, newGame, type GameState } from './index';
import { run, types } from './testing';

const hero = (patch: Partial<HeroSnapshot['attributes']> = {}, tokens = 50): HeroSnapshot => ({
  attributes: { logic: 2, rigor: 2, velocity: 1, promptCraft: 2, orchestration: 1, focus: 2, domainInsight: 1, ...patch },
  tokens,
  focusPoints: 8,
});

/** Runs moves through a module's own decide/evolve. */
function play<S, M, E>(mod: MinigameModule<S, M, E>, s0: S, moves: NoInfer<M>[], h = hero(), seed = 1) {
  const rng = createRng(seed);
  let s = s0;
  const events: E[] = [];
  for (const m of moves) {
    const d = mod.decide(s, m, h, rng);
    if (!d.ok) throw new Error(d.reason);
    for (const e of d.events) {
      events.push(e);
      s = mod.evolve(s, e);
    }
  }
  return { s, events };
}

describe('CI Pipeline minigame', () => {
  const start = () => ciPipeline.start('LUM-27', hero(), createRng(1));

  it('Velocity buys release minutes', () => {
    expect(start().minutesTotal).toBe(22);
    expect(ciPipeline.start('LUM-27', hero({ velocity: 4 }), createRng(1)).minutesTotal).toBe(28);
  });

  it('the real bug fails every run until the code is fixed', () => {
    const { s } = play(ciPipeline, start(), [{ kind: 'run' }, { kind: 'run' }]);
    expect(s.tests.find((t) => t.id === 'rounding')!.status).toBe('failed');
    expect(s.phase).toBe('playing');
  });

  it('diagnose reveals the cause, the matching tool fixes it, a wrong tool does not', () => {
    const { s, events } = play(ciPipeline, start(), [
      { kind: 'diagnose', testId: 'budget' },
      { kind: 'fix', testId: 'budget', tool: 'awaitEvent' },
      { kind: 'fix', testId: 'budget', tool: 'isolateState' },
    ]);
    expect(events.map((e) => e.type)).toEqual(['CiTestDiagnosed', 'CiFixApplied', 'CiFixApplied']);
    expect(events[0]).toMatchObject({ cause: 'sharedState', cost: { focus: 1 } });
    expect(s.tests.find((t) => t.id === 'budget')!.fixed).toBe(true);
    expect(s.minutesLeft).toBe(22 - 3);
  });

  it('fixing every flaky test and the bug ships a clean release', () => {
    const fixes: [string, CiMove][] = [
      ['export', { kind: 'fix', testId: 'export', tool: 'awaitEvent' }],
      ['budget', { kind: 'fix', testId: 'budget', tool: 'isolateState' }],
      ['currency', { kind: 'fix', testId: 'currency', tool: 'freezeClock' }],
      ['dashboard', { kind: 'fix', testId: 'dashboard', tool: 'resetOrder' }],
      ['rounding', { kind: 'fix', testId: 'rounding', tool: 'fixCode' }],
      ['api', { kind: 'fix', testId: 'api', tool: 'awaitEvent' }],
    ];
    const { s } = play(ciPipeline, start(), [...fixes.map(([, m]) => m), { kind: 'run' }]);
    expect(s.phase).toBe('shipped');
    expect(ciPipeline.result(s).grade).toBe('S');
  });

  it('quarantining the real bug ships it and caps the grade', () => {
    const s: CiSession = { ...start(), tests: start().tests.map((t) => (t.cause === 'realBug' ? { ...t, quarantined: true } : { ...t, fixed: true })) };
    const done = play(ciPipeline, s, [{ kind: 'run' }]).s;
    const result = ciPipeline.result(done);
    expect(result.score).toBeLessThanOrEqual(50);
    expect(result.summary.join(' ')).toContain('it shipped');
  });

  it('running out of time ends the release with an F', () => {
    const { s, events } = play(ciPipeline, { ...start(), minutesLeft: 2 }, [{ kind: 'run' }]);
    expect(events.at(-1)!.type).toBe('CiReleaseMissed');
    expect(ciPipeline.result(s).grade).toBe('F');
  });

  it('PILOT costs tokens and is rejected without them', () => {
    const { events } = play(ciPipeline, start(), [{ kind: 'askPilot', testId: 'export' }]);
    expect(events[0]).toMatchObject({ type: 'CiPilotPatched', cost: { tokens: 10 } });
    expect(ciPipeline.decide(start(), { kind: 'askPilot', testId: 'export' }, hero({}, 5), createRng(1)).ok).toBe(false);
  });
});

describe('Coverage Crawl minigame', () => {
  const start = (h = hero()) => coverage.start('LUM-29', h, createRng(1));

  it('inputs light branches, assertions kill mutants on lit branches only', () => {
    expect(coverage.decide(start(), { kind: 'assert', branchId: 'nullIncome' }, hero(), createRng(1)).ok).toBe(false);
    const { s } = play(coverage, start(), [
      { kind: 'playInput', cardId: 'null' },
      { kind: 'assert', branchId: 'nullIncome' },
    ]);
    expect(s.lit).toEqual(['nullIncome']);
    expect(s.killed).toEqual(['nullIncome']);
    expect(coveragePercent(s)).toBe(11);
    expect(mutationPercent(s)).toBe(17);
  });

  it('coverage without assertions is graded as weak', () => {
    const { s } = play(coverage, start(hero({ velocity: 3 })), [
      { kind: 'playInput', cardId: 'null' },
      { kind: 'playInput', cardId: 'overspend' },
      { kind: 'playInput', cardId: 'yearlyUsd' },
      { kind: 'playInput', cardId: 'halfCent' },
      { kind: 'submit' },
    ]);
    expect(coveragePercent(s)).toBe(100);
    const r = coverage.result(s);
    expect(r.grade).toBe('F');
    expect(r.summary.join(' ')).toContain('few assertions');
  });

  it('ends on its own when the moves run out', () => {
    const { s } = play(coverage, { ...start(), movesLeft: 1 }, [{ kind: 'playInput', cardId: 'typical' }]);
    expect(coverage.isOver(s)).toBe(true);
  });

  it('Logic + Domain Insight 5+ previews where a card leads', () => {
    expect(start().previewReach).toBe(false);
    expect(start(hero({ logic: 3, domainInsight: 2 })).previewReach).toBe(true);
  });
});

describe('Code Review minigame', () => {
  const start = (h = hero()) => codeReview.start('LUM-22', h, createRng(1));

  it('scores right line + right label as a hit, wrong label as partial, clean line as false positive', () => {
    const { events } = play(codeReview, start(), [
      { kind: 'comment', line: 2, type: 'security' },
      { kind: 'comment', line: 1, type: 'bug' },
      { kind: 'comment', line: 5, type: 'nitpick' },
    ]);
    expect(events.map((e) => (e.type === 'ReviewCommented' ? e.outcome : null))).toEqual(['hit', 'partial', 'falsePositive']);
  });

  it('a perfect review gets an S, approving a broken PR gets an F', () => {
    const perfect = play(codeReview, start(), [
      { kind: 'comment', line: 1, type: 'hallucination' },
      { kind: 'comment', line: 2, type: 'security' },
      { kind: 'comment', line: 6, type: 'bug' },
      { kind: 'comment', line: 8, type: 'security' },
      { kind: 'comment', line: 12, type: 'nitpick' },
      { kind: 'verdict', verdict: 'requestChanges' },
    ]).s;
    expect(codeReview.result(perfect).grade).toBe('S');
    const rubberStamp = play(codeReview, start(), [{ kind: 'verdict', verdict: 'approve' }]).s;
    expect(codeReview.result(rubberStamp)).toMatchObject({ grade: 'F', score: 0 });
  });

  it('Rigor 3+ gives the suspicious-line heat map; attention runs out', () => {
    expect(start().heatmap).toBe(false);
    expect(start(hero({ rigor: 3 })).heatmap).toBe(true);
    const tired = { ...start(), attentionLeft: 0 };
    expect(codeReview.decide(tired, { kind: 'comment', line: 1, type: 'bug' }, hero(), createRng(1)).ok).toBe(false);
  });
});

describe('minigames inside the game', () => {
  const atLena = (): GameState => {
    const s = newGame('Sam', 3);
    return {
      ...s,
      quests: { 'LUM-7': { status: 'done', clarified: false }, 'LUM-27': { status: 'inProgress', clarified: false } },
      hero: { ...s.hero, position: { x: 25, y: 9 }, facing: 'up' },
    };
  };

  it('the quest giver starts the minigame, moves spend hero resources, closing returns to the office', () => {
    const { state, events } = run(atLena(), { type: 'Interact' }, { type: 'ChooseDialogueOption', optionId: 'start' });
    expect(types(events)).toEqual(['DialogueStarted', 'MinigameStarted', 'RngAdvanced', 'DialogueEnded']);
    expect(getMinigame(state)?.kind).toBe('ciPipeline');
    expect(() => run(state, { type: 'MoveHero', direction: 'down' })).toThrow('Cannot move during minigame');

    const diag = run(state, { type: 'PlayMinigame', move: { game: 'ciPipeline', kind: 'diagnose', testId: 'export' } }).state;
    expect(diag.hero.focusPoints).toBe(state.hero.focusPoints - 1);
  });

  it('a passing grade moves the ticket to Code Review and pays XP; the grade is kept', () => {
    let s = run(atLena(), { type: 'Interact' }, { type: 'ChooseDialogueOption', optionId: 'start' }).state;
    const fix = (testId: string, tool: CiTool) => ({ type: 'PlayMinigame', move: { game: 'ciPipeline', kind: 'fix', testId, tool } }) as const;
    const r = run(
      s,
      fix('export', 'awaitEvent'),
      fix('budget', 'isolateState'),
      fix('currency', 'freezeClock'),
      fix('dashboard', 'resetOrder'),
      fix('rounding', 'fixCode'),
      fix('api', 'awaitEvent'),
      { type: 'PlayMinigame', move: { game: 'ciPipeline', kind: 'run' } },
    );
    expect(types(r.events)).toEqual(expect.arrayContaining(['MinigameFinished', 'XpGained', 'QuestReadyForReview']));
    s = run(r.state, { type: 'CloseMinigame' }).state;
    expect(s.minigame).toBeNull();
    expect(s.quests['LUM-27']).toMatchObject({ status: 'codeReview', bestGrade: 'S' });
  });

  it('cannot close a minigame that is still going, and moves for another game are rejected', () => {
    const s = run(atLena(), { type: 'Interact' }, { type: 'ChooseDialogueOption', optionId: 'start' }).state;
    expect(run.bind(null, s, { type: 'CloseMinigame' })).toThrow('still going');
    expect(run.bind(null, s, { type: 'PlayMinigame', move: { game: 'coverage', kind: 'submit' } })).toThrow('another minigame');
  });
});

describe('Typing Sprint minigame', () => {
  const start = (h = hero()) => typing.start('LUM-102', h, createRng(1));
  const keys = (text: string) => [...text].map((char) => ({ kind: 'key', char }) as const);

  it('Velocity and Focus buy seconds', () => {
    expect(start().secondsTotal).toBe(40 + 4 + 2);
    expect(start(hero({ velocity: 5, focus: 4 })).secondsTotal).toBe(40 + 20 + 4);
  });

  it('a correct key moves the caret, a typo does not, and finishing the file ends the sprint', () => {
    const text = TYPING_TEXTS.wrenConfig!;
    const first = play(typing, start(), [{ kind: 'key', char: 'x' }, { kind: 'key', char: 'm' }]);
    expect(first.s.lines[0]!.typed).toBe(1);
    expect(first.s.typos).toBe(1);

    const done = play(typing, start(), text.lines.flatMap(keys));
    expect(done.s.phase).toBe('done');
    const r = typing.result(done.s);
    expect(r.grade).toBe('S');
  });

  it('time runs out on ticks, and an unfinished file grades badly', () => {
    const s = start();
    const r = play(typing, s, Array.from({ length: s.secondsTotal }, () => ({ kind: 'tick' }) as const));
    expect(r.s.phase).toBe('timeout');
    expect(typing.result(r.s).grade).toBe('F');
    expect(() => play(typing, r.s, [{ kind: 'tick' }])).toThrow('over');
  });

  it('AI autocomplete costs tokens and finishes a line, sometimes with something wrong', () => {
    const outcomes = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => play(typing, start(), [{ kind: 'aiComplete' }], hero(), seed));
    for (const o of outcomes) {
      expect(o.s.current).toBe(1);
      expect(o.events[0]!.cost?.tokens).toBeGreaterThan(0);
    }
    const wrong = outcomes.find((o) => o.s.lines[0]!.hallucinated);
    expect(wrong?.s.lines[0]!.text).toBe(TYPING_TEXTS.wrenConfig!.wrong[0]);
    expect(() => play(typing, start(), [{ kind: 'aiComplete' }], hero({}, 0))).toThrow('tokens');
  });
});

describe('Package Audit minigame', () => {
  const start = (h = hero()) => packageAudit.start('LUM-131', h, createRng(1));
  const correct = PACKAGES.map((p) => ({ kind: 'setVerdict', packageId: p.id, verdict: p.truth === 'used' ? 'keep' : 'remove' }) as const);

  it('checks spend the budget and reveal information', () => {
    const r = play(packageAudit, start(), [
      { kind: 'checkRegistry', packageId: 'lodash-utils-pro' },
      { kind: 'readSource', packageId: 'expresss' },
    ]);
    expect(r.s.checksLeft).toBe(r.s.checksTotal - 3);
    expect(() => play(packageAudit, r.s, [{ kind: 'checkRegistry', packageId: 'lodash-utils-pro' }])).toThrow('Already');
  });

  it('a clean audit gets an S, keeping everything ships malware', () => {
    expect(packageAudit.result(play(packageAudit, start(), [...correct, { kind: 'submitAudit' }]).s).grade).toBe('S');
    const lazy = packageAudit.result(play(packageAudit, start(), [{ kind: 'submitAudit' }]).s);
    expect(lazy.grade).toBe('F');
    expect(lazy.summary.join(' ')).toContain('install script ran');
  });

  it('removing a package the app uses breaks the build', () => {
    const r = play(packageAudit, start(), [...correct, { kind: 'setVerdict', packageId: 'lumen-money', verdict: 'remove' }, { kind: 'submitAudit' }]);
    expect(packageAudit.result(r.s).score).toBe(85);
  });

  it('WREN audits everything for tokens, and its advice is not always right', () => {
    const runs = [1, 2, 3, 4, 5, 6].map((seed) => play(packageAudit, start(), [{ kind: 'askWren' }], hero(), seed).s);
    for (const s of runs) expect(s.wren).toHaveLength(PACKAGES.length);
    const wrongCalls = runs.flatMap((s) => s.wren!.filter((w) => w.says !== (PACKAGES.find((p) => p.id === w.id)!.truth === 'used' ? 'keep' : 'remove')));
    expect(wrongCalls.length).toBeGreaterThan(0);
  });

  it('Rigor 4+ notices typosquats', () => {
    expect(start().spotsTyposquats).toBe(false);
    expect(start(hero({ rigor: 4 })).spotsTyposquats).toBe(true);
  });
});
