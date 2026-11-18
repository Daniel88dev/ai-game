import { modeOf, type DomainEvent, type GameState } from '../domain';
import type { SfxId } from './sfx';
import type { TrackId } from './tracks';

/**
 * Read-side mapping from domain events to sounds. Audio is a projection of the
 * event stream like the battle log: the domain never knows it exists.
 */
export interface Cue {
  readonly sfx: SfxId;
  /** Seconds; lines the sound up with the matching animation. */
  readonly delay?: number;
  /** When one command yields several events, only the most important cue plays. */
  readonly priority: number;
}

const cue = (sfx: SfxId, priority = 1, delay?: number): Cue => ({ sfx, priority, delay });

/** Bosses get their own music. */
export const BOSS_ENEMIES: ReadonlySet<string> = new Set(['heisenbug', 'phantomPackage']);

export function cueFor(e: DomainEvent): Cue | null {
  switch (e.type) {
    // ---- dialogue, world, quests
    case 'DialogueStarted':
      return cue('talk');
    case 'DialogueAdvanced':
    case 'DialogueEnded':
      return cue('select');
    case 'QuestBoardOpened':
      return cue('open');
    case 'TokensGifted':
      return cue('coin', 3);
    case 'HeroRested':
      return cue('heal', 4);
    case 'QuestAccepted':
      return cue('questAccepted', 5);
    case 'QuestReadyForReview':
      return cue('questReady', 5);
    case 'QuestCompleted':
    case 'ActCompleted':
      return cue('questComplete', 6);
    case 'LeveledUp':
      return cue('levelUp', 7);

    // ---- combat (played by the battle scene, in step with its animation)
    case 'BattleStarted':
      return cue('battleStart', 6);
    case 'HeroDebugged':
      return cue(e.missed ? 'miss' : e.critical ? 'critEnemy' : e.absorbed ? 'armor' : 'hitEnemy', 2);
    case 'StackTraceRead':
      return cue(e.rootCause ? 'rootCause' : e.success ? 'clue' : 'error', 2);
    case 'TestWritten':
      return cue('test', 2);
    case 'AiPatchApplied':
      return cue('aiPatch', 2);
    case 'AiHallucinated':
      return cue('hallucinate', 2);
    case 'CoffeeDrunk':
      return cue('heal', 2);
    case 'EnemyAttacked':
      // The hit lands 120 ms into the enemy's lunge.
      return cue(e.heavy ? 'heroHurtHeavy' : 'heroHurt', 3, 0.12);
    case 'AttackDodged':
      return cue('dodge', 3);
    case 'EnemyGrew':
    case 'EnemyRegenerated':
      return cue('enemyGrow', 2);
    case 'EnemyRevived':
      return cue('enemyRevive', 4);
    case 'HeavyAttackTelegraphed':
      return cue('warning', 2, 0.25);
    case 'BattleWon':
      return cue('victory', 6, 0.15);
    case 'BattleLost':
      return cue('defeat', 6);
    case 'BattleRetreated':
      return cue('retreat', 6);

    // ---- minigames
    case 'MinigameStarted':
      return cue('open', 2);
    case 'MinigameFinished':
      return cue(e.passed ? 'victory' : 'defeat', 6);
    case 'TypingKeyHit':
      return cue(e.correct ? 'keyType' : 'error');
    case 'TypingLineCompletedByAi':
      return cue(e.hallucinated ? 'hallucinate' : 'aiAssist', 2);
    case 'CiPipelineRan':
      return cue(e.green ? 'success' : 'error', 2);
    case 'ReviewCommented':
      return cue(e.outcome === 'hit' ? 'success' : e.outcome === 'partial' ? 'select' : 'error', 2);
    case 'ReviewAiSuggested':
    case 'CoverageTestsGenerated':
    case 'WrenAudited':
      return cue('aiAssist', 2);
    case 'CoverageInputPlayed':
    case 'PackageVerdictSet':
      return cue('select');
    case 'CoverageAssertionAdded':
      return cue('success', 2);
    case 'RegistryChecked':
    case 'PackageSourceRead':
      return cue('clue', 2);
    default:
      return null;
  }
}

/** The one cue to play for a whole command's worth of events (highest priority, first wins ties). */
export function pickCue(events: readonly DomainEvent[]): Cue | null {
  let best: Cue | null = null;
  for (const e of events) {
    const c = cueFor(e);
    if (c && (!best || c.priority > best.priority)) best = c;
  }
  return best;
}

/**
 * Battle events are voiced by the battle scene as it animates them, so the
 * global listener skips any batch that lands while a fight is on screen.
 */
export function isAnimatedByBattleScene(events: readonly DomainEvent[], after: GameState): boolean {
  return after.battle !== null && !events.some((e) => e.type === 'BattleStarted');
}

export function musicFor(state: GameState): TrackId {
  switch (modeOf(state)) {
    case 'battle':
      return BOSS_ENEMIES.has(state.battle!.enemyId) ? 'boss' : 'battle';
    case 'minigame':
      return 'focus';
    default:
      return 'office';
  }
}
