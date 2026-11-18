import { describe, expect, it } from 'vitest';
import { dialogueContext, getActProgress, getQuestLog, getWorld, isQuestAvailable, newGame, NPCS, QUESTS, type GameState } from './index';
import { run, types } from './testing';

const facingPriya = (): GameState => {
  const s = newGame();
  return { ...s, hero: { ...s.hero, position: { x: 18, y: 3 }, facing: 'right' } };
};

describe('LUM-7 quest flow', () => {
  it('accepting the ticket puts it In Progress and spawns the bug', () => {
    expect(getWorld(newGame()).bugs).toHaveLength(0);
    const { state, events } = run(
      facingPriya(),
      { type: 'Interact' },
      { type: 'ChooseDialogueOption', optionId: 'accept' },
      { type: 'ChooseDialogueOption', optionId: 'ok' },
    );
    expect(types(events)).toEqual(['DialogueStarted', 'QuestAccepted', 'DialogueAdvanced', 'DialogueEnded']);
    expect(state.quests['LUM-7']).toEqual({ status: 'inProgress', clarified: false });
    expect(state.dialogue).toBeNull();
    expect(getWorld(state).bugs).toEqual([{ encounterId: 'lum7-beetle', sprite: 'bug_null_pointer', x: 13, y: 5 }]);
    expect(getQuestLog(state)[0]?.statusLabel).toBe('In Progress');
  });

  it('asking a clarifying question is remembered and nudges Understanding', () => {
    const { state } = run(
      facingPriya(),
      { type: 'Interact' },
      { type: 'ChooseDialogueOption', optionId: 'ask' },
      { type: 'ChooseDialogueOption', optionId: 'accept' },
    );
    expect(state.quests['LUM-7']).toEqual({ status: 'inProgress', clarified: true });
    expect(state.hero.affinity.understanding).toBe(1);
  });

  it('turning in a reviewed ticket completes it and pays out XP + clarify bonus', () => {
    const s0 = facingPriya();
    const s: GameState = { ...s0, quests: { 'LUM-7': { status: 'codeReview', clarified: true } }, defeatedEncounters: ['lum7-beetle'] };
    const { state, events } = run(s, { type: 'Interact' }, { type: 'ChooseDialogueOption', optionId: 'merge' });
    expect(types(events)).toContain('QuestCompleted');
    expect(events.find((e) => e.type === 'QuestCompleted')).toMatchObject({ xp: 80, tokens: 15 });
    expect(state.quests['LUM-7']?.status).toBe('done');
    expect(state.hero.level).toBe(2);
    expect(state.hero.unspentPoints).toBe(3);
    expect(state.hero.tokens).toBe(45);
  });

  it('NPC dialogue follows quest state', () => {
    const s0 = facingPriya();
    const s: GameState = { ...s0, quests: { 'LUM-7': { status: 'inProgress', clarified: false } } };
    expect(run(s, { type: 'Interact' }).state.dialogue?.nodeId).toBe('LUM-7:waiting');
  });
});

describe('quest board read model', () => {
  it('marks the fix criterion as met once the bug is defeated', () => {
    const s: GameState = { ...newGame(), quests: { 'LUM-7': { status: 'codeReview', clarified: false } }, defeatedEncounters: ['lum7-beetle'] };
    const criteria = getQuestLog(s)[0]!.acceptanceCriteria;
    expect(criteria.filter((c) => c.met).map((c) => c.text)).toEqual(['The NullPointer Beetle near your desk is fixed']);
  });
});

describe('Act I ticket chain', () => {
  const done = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { status: 'done' as const, clarified: false }]));

  it('tickets show up on the board only when their prerequisites are Done', () => {
    expect(getQuestLog(newGame()).map((q) => q.id)).toEqual(['LUM-7']);
    const after7: GameState = { ...newGame(), quests: done('LUM-7') };
    expect(getQuestLog(after7).filter((q) => q.status === 'todo').map((q) => q.id)).toEqual(['LUM-14', 'LUM-22', 'LUM-27']);
  });

  it('a ticket that is not available cannot be accepted through dialogue', () => {
    const s0 = facingPriya();
    const { state } = run({ ...s0, quests: done('LUM-7') }, { type: 'Interact' });
    expect(state.dialogue?.nodeId).toBe('LUM-14:offer');
  });

  it('merging LUM-33 completes Act I', () => {
    const s0 = facingPriya();
    const quests = { ...done('LUM-7', 'LUM-14', 'LUM-22', 'LUM-27', 'LUM-29', 'LUM-31', 'LUM-35'), 'LUM-33': { status: 'codeReview' as const, clarified: false } };
    const { events } = run({ ...s0, quests }, { type: 'Interact' }, { type: 'ChooseDialogueOption', optionId: 'merge' });
    expect(events.find((e) => e.type === 'ActCompleted')).toEqual({ type: 'ActCompleted', act: 1, title: 'Before the Wave' });
  });

  it('a story choice happens once: flag, path nudge and tokens', () => {
    const s0 = newGame();
    const atJace: GameState = { ...s0, hero: { ...s0.hero, position: { x: 11, y: 8 }, facing: 'up' } };
    const { state, events } = run(atJace, { type: 'Interact' }, { type: 'ChooseDialogueOption', optionId: 'show' });
    expect(types(events)).toEqual(['DialogueStarted', 'StoryFlagSet', 'PathAffinityShifted', 'TokensGifted', 'DialogueAdvanced']);
    expect(state.hero.tokens).toBe(s0.hero.tokens + 10);
    expect(state.flags).toEqual(['jace-prompting']);
  });
});

describe('Act II', () => {
  it('opens only after the Act I all-hands, with Gideon handing out LUM-102', () => {
    const done = Object.fromEntries(
      Object.values(QUESTS)
        .filter((q) => q.act === 1)
        .map((q) => [q.id, { status: 'done' as const, clarified: false }]),
    );
    const before: GameState = { ...newGame(), quests: done };
    expect(isQuestAvailable(before, 'LUM-102')).toBe(false);
    expect(getActProgress(before).act).toBe(1);
    const after: GameState = { ...before, flags: ['heard-all-hands'] };
    expect(isQuestAvailable(after, 'LUM-102')).toBe(true);
    expect(getActProgress(after).act).toBe(2);
    expect(NPCS.gideon!.entry(dialogueContext(after))).toBe('LUM-102:offer');
  });
});
