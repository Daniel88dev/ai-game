import { describe, expect, it } from 'vitest';
import { decide, ENEMIES, getBattle, newGame, startBattle, type DomainEvent, type GameState } from './index';
import { run, types } from './testing';

const beetle = ENEMIES.nullPointerBeetle!;

function inBattle(seed = 1, patch: Partial<NonNullable<GameState['battle']>> = {}): GameState {
  const s = newGame('Sam', seed);
  return {
    ...s,
    quests: { 'LUM-7': { status: 'inProgress', clarified: false } },
    hero: { ...s.hero, position: { x: 13, y: 6 }, facing: 'up' },
    battle: { ...startBattle('lum7-beetle', beetle), ...patch },
  };
}

describe('starting a fight', () => {
  it('walking up to the bug and interacting starts the battle', () => {
    const s = { ...inBattle(), battle: null };
    const { state, events } = run(s, { type: 'Interact' });
    expect(types(events)).toEqual(['BattleStarted']);
    expect(getBattle(state)?.enemy).toMatchObject({ name: 'NullPointer Beetle', hp: 26, maxHp: 26 });
  });

  it('cannot move during a battle', () => {
    expect(decide(inBattle(), { type: 'MoveHero', direction: 'down' }).ok).toBe(false);
  });
});

describe('hero actions', () => {
  it('each accepted action ends with the enemy acting and the RNG advancing', () => {
    const { events } = run(inBattle(), { type: 'TakeBattleAction', action: 'debug' });
    expect(types(events)).toContain('EnemyAttacked');
    expect(types(events).at(-1)).toBe('RngAdvanced');
  });

  it('is deterministic for the same seed', () => {
    const a = run(inBattle(42), { type: 'TakeBattleAction', action: 'debug' }).events;
    const b = run(inBattle(42), { type: 'TakeBattleAction', action: 'debug' }).events;
    expect(a).toEqual(b);
  });

  it('Debug never misses once the root cause is revealed', () => {
    for (let seed = 1; seed < 200; seed++) {
      const { events } = run(inBattle(seed, { rootCauseRevealed: true }), { type: 'TakeBattleAction', action: 'debug' });
      const hit = events.find((e): e is Extract<DomainEvent, { type: 'HeroDebugged' }> => e.type === 'HeroDebugged')!;
      expect(hit.missed).toBe(false);
      expect(hit.damage).toBeGreaterThanOrEqual(10);
    }
  });

  it('blind Debug misses sometimes (null shell)', () => {
    const misses = Array.from({ length: 200 }, (_, i) => run(inBattle(i + 1), { type: 'TakeBattleAction', action: 'debug' }).events)
      .flat()
      .filter((e) => e.type === 'HeroDebugged' && e.missed).length;
    expect(misses).toBeGreaterThan(40);
    expect(misses).toBeLessThan(120);
  });

  it('Investigate spends Focus and is rejected without enough Focus', () => {
    const { state } = run(inBattle(), { type: 'TakeBattleAction', action: 'investigate' });
    expect(state.hero.focusPoints).toBe(6);
    const tired = inBattle();
    const s = { ...tired, hero: { ...tired.hero, focusPoints: 1 } };
    expect(decide(s, { type: 'TakeBattleAction', action: 'investigate' })).toEqual({ ok: false, reason: 'Not enough Focus' });
  });

  it('Ask PILOT costs tokens on success or hallucination, and shifts toward Leverage', () => {
    let hallucinated = 0;
    for (let seed = 1; seed < 100; seed++) {
      const s0 = inBattle(seed, { enemyHp: 20 });
      const { state, events } = run(s0, { type: 'TakeBattleAction', action: 'askAi' });
      if (types(events).includes('AiHallucinated')) {
        hallucinated++;
        expect(state.battle!.enemyHp).toBe(24);
      }
      expect(state.hero.tokens).toBe(20);
      expect(state.hero.affinity.leverage).toBe(1);
    }
    expect(hallucinated).toBeGreaterThan(10);
  });

  it('coffee is limited per battle', () => {
    const s = inBattle(1, { coffeesLeft: 0 });
    expect(decide(s, { type: 'TakeBattleAction', action: 'coffee' }).ok).toBe(false);
  });

  it('telegraphs the heavy attack one turn ahead', () => {
    const { events, state } = run(inBattle(3, { enemyTurns: 1 }), { type: 'TakeBattleAction', action: 'coffee' });
    expect(types(events)).toContain('HeavyAttackTelegraphed');
    expect(getBattle(state)?.heavyNext).toBe(beetle.heavyAttackName);
    const next = run(state, { type: 'TakeBattleAction', action: 'coffee' }).events;
    expect(next.find((e) => e.type === 'EnemyAttacked')).toMatchObject({ heavy: true });
  });
});

describe('ending a fight', () => {
  it('winning grants XP, removes the bug, and moves the ticket to Code Review', () => {
    const { state, events } = run(inBattle(5, { enemyHp: 1, rootCauseRevealed: true }), { type: 'TakeBattleAction', action: 'debug' });
    expect(types(events)).toEqual(['HeroDebugged', 'BattleWon', 'XpGained', 'QuestReadyForReview', 'RngAdvanced']);
    expect(state.battle?.phase).toBe('won');
    expect(state.quests['LUM-7']?.status).toBe('codeReview');
    expect(decide(state, { type: 'TakeBattleAction', action: 'debug' }).ok).toBe(false);

    const closed = run(state, { type: 'CloseBattle' }).state;
    expect(closed.battle).toBeNull();
    expect(closed.defeatedEncounters).toEqual(['lum7-beetle']);
    expect(closed.hero.xp).toBe(40);
  });

  it('losing ends the fight and sends the hero back with half HP', () => {
    const s0 = inBattle(7);
    const lost = run({ ...s0, hero: { ...s0.hero, hp: 1 } }, { type: 'TakeBattleAction', action: 'debug' });
    expect(types(lost.events)).toContain('BattleLost');
    const closed = run(lost.state, { type: 'CloseBattle' }).state;
    expect(closed.battle).toBeNull();
    expect(closed.hero.hp).toBe(14);
    expect(closed.defeatedEncounters).toEqual([]);
  });

  it('retreat ends the fight without an enemy turn', () => {
    const { events } = run(inBattle(), { type: 'TakeBattleAction', action: 'retreat' });
    expect(types(events)).toEqual(['BattleRetreated', 'RngAdvanced']);
  });
});

describe('a full fight with a simple strategy', () => {
  it('is winnable from a fresh level 1 hero for most seeds', () => {
    let wins = 0;
    for (let seed = 1; seed <= 100; seed++) {
      let s = { ...inBattle(seed), battle: null } as GameState;
      s = run(s, { type: 'Interact' }).state;
      for (let i = 0; i < 40 && s.battle?.phase === 'heroTurn'; i++) {
        const b = s.battle;
        const action = !b.rootCauseRevealed && s.hero.focusPoints >= 2 ? 'investigate' : s.hero.hp < 9 && b.coffeesLeft > 0 ? 'coffee' : 'debug';
        s = run(s, { type: 'TakeBattleAction', action }).state;
      }
      if (s.battle?.phase === 'won') wins++;
    }
    expect(wins).toBeGreaterThan(90);
  });
});
