import { describe, expect, it } from 'vitest';
import { decide, getCharacter, levelsGained, maxHp, newGame } from './index';
import { run } from './testing';

describe('progression', () => {
  it('computes level-ups across thresholds', () => {
    expect(levelsGained({ level: 1, xp: 0 }, 49)).toEqual({ levels: [], xpLeft: 49 });
    expect(levelsGained({ level: 1, xp: 40 }, 145)).toEqual({ levels: [2, 3], xpLeft: 10 });
  });

  it('spending a point raises the attribute and its derived stat', () => {
    const s0 = newGame();
    const s = { ...s0, hero: { ...s0.hero, unspentPoints: 1 } };
    const { state } = run(s, { type: 'SpendAttributePoint', attribute: 'rigor' });
    expect(state.hero.attributes.rigor).toBe(3);
    expect(state.hero.unspentPoints).toBe(0);
    expect(maxHp(state.hero)).toBe(30);
    expect(state.hero.hp).toBe(30);
    expect(getCharacter(state).attributes.every((a) => !a.canRaise)).toBe(true);
    expect(decide(state, { type: 'SpendAttributePoint', attribute: 'logic' }).ok).toBe(false);
  });
});
