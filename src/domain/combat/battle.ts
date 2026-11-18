/**
 * Turn-based combat model.
 *
 * Design (mechanics doc): investigate first (reveal the Root Cause), then fix.
 * Bugs with a "shell" dodge blind Debug attempts until their root cause is known.
 * AI patches ignore the shell but can hallucinate.
 * Tests protect you: they soften the bug's attacks and stop regressions from coming back.
 */
export type HeroAction = 'debug' | 'investigate' | 'writeTest' | 'askAi' | 'coffee' | 'retreat';

export const ACTION_INFO: Record<Exclude<HeroAction, 'retreat'>, { label: string; hint: string }> = {
  debug: { label: 'Debug', hint: 'Manual fix. Scales with Logic. Often misses until the root cause is found.' },
  investigate: { label: 'Read stack trace', hint: 'Costs 2 Focus. Finds clues to the root cause (bonus Debug damage).' },
  writeTest: { label: 'Write test', hint: 'Costs 2 Focus. Small hit, and the bug hits you softer. Stops regressions.' },
  askAi: { label: 'Ask PILOT', hint: 'Costs tokens. Strong AI patch, but may hallucinate.' },
  coffee: { label: 'Coffee', hint: 'Restores Focus and some HP. Limited cups per fight.' },
};

export const INVESTIGATE_FOCUS_COST = 2;
export const WRITE_TEST_FOCUS_COST = 2;
export const BASE_AI_TOKEN_COST = 10;
export const COFFEES_PER_BATTLE = 2;
/** A written test takes this share off every later enemy hit. */
export const TEST_DAMAGE_REDUCTION = 0.25;

/** Optional behaviours that make a bug family play differently. */
export interface EnemyTraits {
  /** Successful investigations needed before the root cause is revealed (default 1). */
  readonly cluesNeeded?: number;
  /** Label for Investigate against this bug, e.g. "Add logging" for the Heisenbug. */
  readonly investigateLabel?: string;
  /** Attack grows by this much every enemy turn until the root cause is revealed (Memory Leak). */
  readonly growth?: number;
  /** Comes back once at half HP unless a test was written in the fight (Regression Revenant). */
  readonly revives?: boolean;
  /** Extra hallucination chance for AI patches against this bug. */
  readonly aiConfusion?: number;
}

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
  /** Where in the Codebase the fight happens (battle background caption). */
  readonly codePath: string;
  /** Battle log line when the fight starts. */
  readonly intro: string;
  /** Battle log line when PILOT hallucinates against this bug. */
  readonly hallucination: string;
  /** Battle log line when a blind Debug misses. */
  readonly missLine: string;
  readonly traits?: EnemyTraits;
}

export type BattlePhase = 'heroTurn' | 'won' | 'lost' | 'retreated';

export interface Battle {
  readonly encounterId: string;
  readonly enemyId: string;
  readonly enemyHp: number;
  readonly enemyMaxHp: number;
  readonly rootCauseRevealed: boolean;
  /** Clues found so far towards the root cause. */
  readonly clues: number;
  readonly coffeesLeft: number;
  /** Number of enemy turns taken so far. */
  readonly enemyTurns: number;
  /** Extra attack from growth traits (Memory Leak). */
  readonly attackBonus: number;
  readonly testWritten: boolean;
  readonly revived: boolean;
  readonly phase: BattlePhase;
}

export function startBattle(encounterId: string, enemy: EnemyDefinition): Battle {
  return {
    encounterId,
    enemyId: enemy.id,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    rootCauseRevealed: false,
    clues: 0,
    coffeesLeft: COFFEES_PER_BATTLE,
    enemyTurns: 0,
    attackBonus: 0,
    testWritten: false,
    revived: false,
    phase: 'heroTurn',
  };
}

export const cluesNeeded = (enemy: EnemyDefinition): number => enemy.traits?.cluesNeeded ?? 1;

/** Is the enemy's next turn a heavy attack? Used to telegraph it in the UI. */
export function isHeavyNext(battle: Pick<Battle, 'enemyTurns'>, enemy: EnemyDefinition): boolean {
  return (battle.enemyTurns + 1) % enemy.heavyEvery === 0;
}

/** Orchestration makes each AI call cheaper (batching, better routing). */
export function aiTokenCost(orchestration: number): number {
  return Math.max(5, BASE_AI_TOKEN_COST - (orchestration - 1));
}

/** Velocity: chance to ship the fix before the bug's attack lands. */
export function dodgeChance(velocity: number): number {
  return Math.min(0.3, velocity * 0.04);
}
