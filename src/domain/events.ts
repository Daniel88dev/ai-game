import type { Battle } from './combat/battle';
import type { Attribute } from './hero/hero';
import type { Direction, Position } from './shared/geometry';

/**
 * Domain events: facts that happened. Past tense, immutable.
 * `evolve` folds them into state; Phaser and React subscribe to them for
 * animation and feedback (damage numbers, sounds, toasts).
 */
export type DomainEvent =
  // World
  | { type: 'HeroMoved'; from: Position; to: Position; facing: Direction }
  | { type: 'HeroTurned'; facing: Direction }
  | { type: 'HeroRested'; hp: number; focus: number }
  | { type: 'QuestBoardOpened' }
  // Dialogue
  | { type: 'DialogueStarted'; npcId: string; nodeId: string }
  | { type: 'DialogueAdvanced'; npcId: string; nodeId: string }
  | { type: 'DialogueEnded'; npcId: string }
  // Quests
  | { type: 'QuestAccepted'; questId: string }
  | { type: 'ClarifyingQuestionAsked'; questId: string }
  | { type: 'QuestReadyForReview'; questId: string }
  | { type: 'QuestCompleted'; questId: string; xp: number; tokens: number }
  // Combat
  | { type: 'BattleStarted'; battle: Battle }
  | { type: 'HeroDebugged'; damage: number; missed: boolean; critical: boolean }
  | { type: 'StackTraceRead'; success: boolean; focusSpent: number; rootCause: string }
  | { type: 'AiPatchApplied'; damage: number; tokensSpent: number }
  | { type: 'AiHallucinated'; enemyHealed: number; tokensSpent: number }
  | { type: 'CoffeeDrunk'; focusRestored: number; hpRestored: number }
  | { type: 'EnemyAttacked'; damage: number; attackName: string; heavy: boolean }
  | { type: 'HeavyAttackTelegraphed'; attackName: string }
  | { type: 'BattleWon'; encounterId: string; xp: number }
  | { type: 'BattleLost'; encounterId: string }
  | { type: 'BattleRetreated'; encounterId: string }
  | { type: 'BattleClosed'; outcome: 'won' | 'lost' | 'retreated'; hpAfter: number }
  // Progression
  | { type: 'XpGained'; amount: number }
  | { type: 'LeveledUp'; level: number; attributePoints: number }
  | { type: 'AttributeIncreased'; attribute: Attribute; value: number }
  | { type: 'PathAffinityShifted'; understanding: number; leverage: number }
  // Bookkeeping
  | { type: 'RngAdvanced'; seed: number };

export type DomainEventType = DomainEvent['type'];
export type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;
