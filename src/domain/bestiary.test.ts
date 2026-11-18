import { describe, expect, it } from 'vitest';
import { ENCOUNTERS, ENEMIES, getBattle, newGame, startBattle, type DomainEvent, type GameState, type HeroAction } from './index';
import { run, types } from './testing';

function fighting(encounterId: string, seed = 1, battle: Partial<NonNullable<GameState['battle']>> = {}, hero: Partial<GameState['hero']> = {}): GameState {
  const enc = ENCOUNTERS[encounterId]!;
  const s = newGame('Sam', seed);
  return {
    ...s,
    quests: { [enc.questId]: { status: 'inProgress', clarified: false } },
    hero: { ...s.hero, ...hero },
    battle: { ...startBattle(enc.id, ENEMIES[enc.enemyId]!), ...battle },
  };
}

const act = (s: GameState, action: HeroAction) => run(s, { type: 'TakeBattleAction', action });

describe('Write test', () => {
  it('costs Focus, hits a little, and softens later hits', () => {
    const s = fighting('lum7-beetle');
    const { state, events } = act(s, 'writeTest');
    expect(types(events)).toContain('TestWritten');
    expect(state.hero.focusPoints).toBe(s.hero.focusPoints - 2);
    expect(state.battle!.testWritten).toBe(true);
    expect(() => act(state, 'writeTest')).toThrow('already wrote a test');
  });
});

describe('Regression Revenant', () => {
  it('comes back once at half HP when killed without a test', () => {
    const { state, events } = act(fighting('lum35-revenant', 1, { enemyHp: 1, rootCauseRevealed: true }), 'debug');
    expect(types(events)).toContain('EnemyRevived');
    expect(state.battle!.enemyHp).toBe(23);
    expect(state.battle!.phase).toBe('heroTurn');
    const again = act({ ...state, battle: { ...state.battle!, enemyHp: 1 } }, 'debug');
    expect(types(again.events)).toContain('BattleWon');
  });

  it('stays dead when a test was written', () => {
    const { events } = act(fighting('lum35-revenant', 1, { enemyHp: 1, rootCauseRevealed: true, testWritten: true }), 'debug');
    expect(types(events)).not.toContain('EnemyRevived');
    expect(types(events)).toContain('BattleWon');
  });
});

describe('Memory Leak Slime', () => {
  it('grows every enemy turn until the root cause is found', () => {
    const s = fighting('lum31-slime', 2, {}, { attributes: { ...newGame().hero.attributes, velocity: 0 } });
    const one = act(s, 'debug').state;
    expect(one.battle!.attackBonus).toBe(1);
    const revealed = act({ ...one, battle: { ...one.battle!, rootCauseRevealed: true } }, 'debug').state;
    expect(revealed.battle!.attackBonus).toBe(1);
  });
});

describe('The Heisenbug', () => {
  it('needs three clues before the root cause shows, and the action is "Add logging"', () => {
    let s = fighting('lum33-heisenbug', 4, {}, { focusPoints: 20, attributes: { ...newGame().hero.attributes, rigor: 10 } });
    expect(getBattle(s)!.actions.find((a) => a.id === 'investigate')!.label).toBe('Add logging');
    const reads: DomainEvent[] = [];
    for (let i = 0; i < 3; i++) {
      const r = act({ ...s, hero: { ...s.hero, hp: 99 } }, 'investigate');
      reads.push(...r.events.filter((e) => e.type === 'StackTraceRead'));
      s = r.state;
    }
    expect(reads.map((e) => (e.type === 'StackTraceRead' ? e.clues : -1))).toEqual([1, 2, 3]);
    expect(s.battle!.rootCauseRevealed).toBe(true);
  });
});

describe('Velocity', () => {
  it('sometimes dodges an attack entirely', () => {
    const dodges = Array.from({ length: 200 }, (_, i) =>
      act(fighting('lum7-beetle', i + 1, {}, { attributes: { ...newGame().hero.attributes, velocity: 5 } }), 'coffee').events,
    )
      .flat()
      .filter((e) => e.type === 'AttackDodged').length;
    expect(dodges).toBeGreaterThan(20);
    expect(dodges).toBeLessThan(70);
  });
});
