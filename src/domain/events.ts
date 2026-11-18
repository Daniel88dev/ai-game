import type { Battle } from './combat/battle';
import type { Attribute } from './hero/hero';
import type { Grade, MinigameEvent, MinigameId, MinigameSession } from './minigames/minigame';
import type { Direction, Position } from './shared/geometry';

/**
 * Domain events: facts that happened. Past tense, immutable.
 * `evolve` folds them into state; Phaser and React subscribe to them for
 * animation and feedback (damage numbers, sounds, toasts).
 *
 * Minigame events live in their own bounded contexts (see minigames/) and are
 * part of this union so the game has one event stream.
 */
export type CoreEvent =
  // World
  | { type: 'HeroMoved'; from: Position; to: Position; facing: Direction }
  | { type: 'HeroTurned'; facing: Direction }
  | { type: 'HeroRested'; hp: number; focus: number; tokens: number }
  | { type: 'QuestBoardOpened' }
  // Dialogue and story
  | { type: 'DialogueStarted'; npcId: string; nodeId: string }
  | { type: 'DialogueAdvanced'; npcId: string; nodeId: string }
  | { type: 'DialogueEnded'; npcId: string }
  | { type: 'StoryFlagSet'; flag: string }
  | { type: 'TokensGifted'; amount: number; from: string }
  | { type: 'ActCompleted'; act: number; title: string }
  // Quests
  | { type: 'QuestAccepted'; questId: string }
  | { type: 'ClarifyingQuestionAsked'; questId: string }
  | { type: 'QuestReadyForReview'; questId: string }
  | { type: 'QuestCompleted'; questId: string; xp: number; tokens: number }
  // Combat
  | { type: 'BattleStarted'; battle: Battle }
  | { type: 'HeroDebugged'; damage: number; missed: boolean; critical: boolean }
  | {
      type: 'StackTraceRead';
      success: boolean;
      focusSpent: number;
      clues: number;
      cluesNeeded: number;
      /** Set when this read revealed the root cause. */
      rootCause: string | null;
    }
  | { type: 'TestWritten'; damage: number; focusSpent: number }
  | { type: 'AiPatchApplied'; damage: number; tokensSpent: number }
  | { type: 'AiHallucinated'; enemyHealed: number; tokensSpent: number }
  | { type: 'CoffeeDrunk'; focusRestored: number; hpRestored: number }
  | { type: 'EnemyAttacked'; damage: number; attackName: string; heavy: boolean }
  | { type: 'AttackDodged'; attackName: string; heavy: boolean }
  | { type: 'EnemyGrew'; attackBonus: number }
  | { type: 'EnemyRevived'; hp: number }
  | { type: 'HeavyAttackTelegraphed'; attackName: string }
  | { type: 'BattleWon'; encounterId: string; xp: number }
  | { type: 'BattleLost'; encounterId: string }
  | { type: 'BattleRetreated'; encounterId: string }
  | { type: 'BattleClosed'; outcome: 'won' | 'lost' | 'retreated'; hpAfter: number }
  // Minigames (lifecycle; the moves are MinigameEvents)
  | { type: 'MinigameStarted'; session: MinigameSession }
  | {
      type: 'MinigameFinished';
      minigame: MinigameId;
      questId: string;
      grade: Grade;
      score: number;
      passed: boolean;
      summary: readonly string[];
      xp: number;
    }
  | { type: 'MinigameClosed'; minigame: MinigameId; passed: boolean }
  // Progression
  | { type: 'XpGained'; amount: number }
  | { type: 'LeveledUp'; level: number; attributePoints: number }
  | { type: 'AttributeIncreased'; attribute: Attribute; value: number }
  | { type: 'PathAffinityShifted'; understanding: number; leverage: number }
  // Bookkeeping
  | { type: 'RngAdvanced'; seed: number };

export type DomainEvent = CoreEvent | MinigameEvent;

export type DomainEventType = DomainEvent['type'];
export type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;
