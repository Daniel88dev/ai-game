import { describe, expect, it } from 'vitest';
import { decide, getInteractionHint, MAP_WIDTH, newGame, OFFICE_MAP, type GameState } from './index';
import { run, types } from './testing';

const at = (x: number, y: number, facing: GameState['hero']['facing'] = 'down'): GameState => {
  const s = newGame();
  return { ...s, hero: { ...s.hero, position: { x, y }, facing } };
};

describe('office map', () => {
  it('has rectangular rows', () => {
    for (const row of OFFICE_MAP) expect(row).toHaveLength(MAP_WIDTH);
  });
});

describe('MoveHero', () => {
  it('moves onto free floor', () => {
    const { state, events } = run(newGame(), { type: 'MoveHero', direction: 'left' });
    expect(types(events)).toEqual(['HeroMoved']);
    expect(state.hero.position).toEqual({ x: 13, y: 11 });
    expect(state.hero.facing).toBe('left');
  });

  it('turns to face a wall, then rejects walking into it', () => {
    const s = at(1, 3, 'down');
    const turned = run(s, { type: 'MoveHero', direction: 'left' });
    expect(types(turned.events)).toEqual(['HeroTurned']);
    expect(decide(turned.state, { type: 'MoveHero', direction: 'left' })).toEqual({ ok: false, reason: 'Blocked' });
  });

  it('cannot walk through NPCs', () => {
    // Priya stands at (19,3)
    const s = at(18, 3, 'right');
    expect(decide(s, { type: 'MoveHero', direction: 'right' }).ok).toBe(false);
  });
});

describe('Interact', () => {
  it('starts a dialogue with the NPC in front of the hero', () => {
    const s = at(18, 3, 'right');
    expect(getInteractionHint(s)).toBe('Talk to Priya');
    const { state, events } = run(s, { type: 'Interact' });
    expect(events).toEqual([{ type: 'DialogueStarted', npcId: 'priya', nodeId: 'intro' }]);
    expect(state.dialogue).toEqual({ npcId: 'priya', nodeId: 'intro' });
    expect(decide(state, { type: 'MoveHero', direction: 'left' }).ok).toBe(false);
  });

  it('coffee machine fully restores the hero', () => {
    const s0 = at(23, 2, 'up');
    const s = { ...s0, hero: { ...s0.hero, hp: 1, focusPoints: 0 } };
    const { state } = run(s, { type: 'Interact' });
    expect(state.hero.hp).toBe(28);
    expect(state.hero.focusPoints).toBe(8);
  });

  it('rejects interacting with empty floor', () => {
    expect(decide(newGame(), { type: 'Interact' }).ok).toBe(false);
  });
});
