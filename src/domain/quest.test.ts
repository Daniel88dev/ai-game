import { describe, expect, it } from 'vitest';
import { getQuestLog, getWorld, newGame, type GameState } from './index';
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
    expect(events.find((e) => e.type === 'QuestCompleted')).toMatchObject({ xp: 80, tokens: 20 });
    expect(state.quests['LUM-7']?.status).toBe('done');
    expect(state.hero.level).toBe(2);
    expect(state.hero.unspentPoints).toBe(3);
    expect(state.hero.tokens).toBe(50);
  });

  it('NPC dialogue follows quest state', () => {
    const s0 = facingPriya();
    const s: GameState = { ...s0, quests: { 'LUM-7': { status: 'inProgress', clarified: false } } };
    expect(run(s, { type: 'Interact' }).state.dialogue?.nodeId).toBe('waiting');
  });
});

describe('quest board read model', () => {
  it('marks the fix criterion as met once the bug is defeated', () => {
    const s: GameState = { ...newGame(), quests: { 'LUM-7': { status: 'codeReview', clarified: false } }, defeatedEncounters: ['lum7-beetle'] };
    const criteria = getQuestLog(s)[0]!.acceptanceCriteria;
    expect(criteria.filter((c) => c.met).map((c) => c.text)).toEqual(['The NullPointer Beetle near your desk is fixed']);
  });
});
