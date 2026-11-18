import type { Grade, MinigameId } from '../minigames/minigame';

/**
 * Quests are tickets. The lifecycle mirrors the real workflow from the story doc:
 * To Do -> In Progress -> Code Review -> Done.
 * (QA is folded into Code Review for now.)
 */
export type QuestStatus = 'todo' | 'inProgress' | 'codeReview' | 'done';

export type TicketType = 'Bug' | 'Story' | 'Task' | 'Spike';

/** What has to happen before a ticket can go to Code Review. */
export type QuestObjective =
  | { readonly kind: 'defeat'; readonly encounterId: string }
  | { readonly kind: 'minigame'; readonly minigame: MinigameId; readonly passGrade: Grade };

export interface QuestDefinition {
  readonly id: string; // ticket key, e.g. LUM-7
  readonly title: string;
  readonly type: TicketType;
  readonly storyPoints: number;
  readonly act: number;
  readonly giverNpcId: string;
  /** Tickets that must be Done before this one shows up on the board. */
  readonly requires: readonly string[];
  /** A story beat that has to happen first (e.g. the all-hands that opens an act). */
  readonly requiresFlag?: string;
  readonly description: string;
  readonly acceptanceCriteria: readonly AcceptanceCriterion[];
  readonly objective: QuestObjective;
  readonly reward: { readonly xp: number; readonly tokens: number; readonly clarifiedBonusXp: number };
  /** Merging this ticket closes the act's epic. */
  readonly completesAct?: { readonly act: number; readonly title: string };
}

/** 'fix' criteria are met when the objective is done; 'merge' ones when the ticket is Done. */
export interface AcceptanceCriterion {
  readonly text: string;
  readonly metOn: 'fix' | 'merge';
}

export interface QuestProgress {
  readonly status: QuestStatus;
  /** The hero asked a clarifying question before starting (story doc: underspecified tickets). */
  readonly clarified: boolean;
  /** Best minigame grade for minigame tickets. */
  readonly bestGrade?: Grade;
}

export const STATUS_LABEL: Record<QuestStatus, string> = {
  todo: 'To Do',
  inProgress: 'In Progress',
  codeReview: 'Code Review',
  done: 'Done',
};

export interface ActDefinition {
  readonly title: string;
  readonly epic: string;
  /** Set when the end-of-act all-hands is over. Until then the act is still "current". */
  readonly finaleFlag: string;
  /** Shown on the end-of-act screen. */
  readonly next: string;
}

export const ACTS: Record<number, ActDefinition> = {
  1: {
    title: 'Act I: Before the Wave',
    epic: 'Lumen 2.0',
    finaleFlag: 'heard-all-hands',
    next: 'Act II, "The Wave", starts now. Gideon has a ticket for you: LUM-102, set up WREN.',
  },
  2: {
    title: 'Act II: The Wave',
    epic: 'AI-First Transformation',
    finaleFlag: 'heard-layoffs',
    next: 'Act III, "Agents Everywhere", is coming in a future update.',
  },
};
export const ACT_NUMBERS: readonly number[] = Object.keys(ACTS).map(Number);
