/**
 * Turn-based combat model.
 *
 * Design (mechanics doc): investigate first (reveal the Root Cause), then fix.
 * Bugs with a "null shell" dodge blind Debug attempts until their root cause is known.
 * AI patches ignore the shell but can hallucinate.
 */
export type HeroAction = 'debug' | 'investigate' | 'askAi' | 'coffee' | 'retreat';

export const ACTION_INFO: Record<Exclude<HeroAction, 'retreat'>, { label: string; hint: string }> = {
  debug: { label: 'Debug', hint: 'Manual fix. Scales with Logic. Often misses until the root cause is found.' },
  investigate: { label: 'Read stack trace', hint: 'Costs 2 Focus. Reveals the root cause (bonus Debug damage).' },
  askAi: { label: 'Ask PILOT', hint: 'Costs 10 tokens. Strong AI patch, but may hallucinate.' },
  coffee: { label: 'Coffee', hint: 'Restores Focus and some HP. Limited cups per fight.' },
};

export const INVESTIGATE_FOCUS_COST = 2;
export const AI_TOKEN_COST = 10;
export const COFFEES_PER_BATTLE = 2;

export interface EnemyDefinition {
  readonly id: string;
  readonly name: string;
  readonly sprite: string;
  readonly maxHp: number;
  readonly attack: number;
  /** Chance that a Debug misses while the root cause is unknown. */
  readonly shellMissChance: number;
  readonly xp: number;
  readonly attackName: string;
  readonly heavyAttackName: string;
  /** Every N-th enemy turn is a telegraphed heavy attack. */
  readonly heavyEvery: number;
  readonly rootCause: string;
}

export type BattlePhase = 'heroTurn' | 'won' | 'lost' | 'retreated';

export interface Battle {
  readonly encounterId: string;
  readonly enemyId: string;
  readonly enemyHp: number;
  readonly rootCauseRevealed: boolean;
  readonly coffeesLeft: number;
  /** Number of enemy turns taken so far. */
  readonly enemyTurns: number;
  readonly phase: BattlePhase;
}

export function startBattle(encounterId: string, enemy: EnemyDefinition): Battle {
  return {
    encounterId,
    enemyId: enemy.id,
    enemyHp: enemy.maxHp,
    rootCauseRevealed: false,
    coffeesLeft: COFFEES_PER_BATTLE,
    enemyTurns: 0,
    phase: 'heroTurn',
  };
}

/** Is the enemy's next turn a heavy attack? Used to telegraph it in the UI. */
export function isHeavyNext(battle: Pick<Battle, 'enemyTurns'>, enemy: EnemyDefinition): boolean {
  return (battle.enemyTurns + 1) % enemy.heavyEvery === 0;
}
