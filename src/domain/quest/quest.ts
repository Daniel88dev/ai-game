/**
 * Quests are tickets. The lifecycle mirrors the real workflow from the story doc:
 * To Do -> In Progress -> Code Review -> Done.
 * (QA is skipped in the slice.)
 */
export type QuestStatus = 'todo' | 'inProgress' | 'codeReview' | 'done';

export type TicketType = 'Bug' | 'Story' | 'Task' | 'Spike';

export interface QuestDefinition {
  readonly id: string; // ticket key, e.g. LUM-7
  readonly title: string;
  readonly type: TicketType;
  readonly storyPoints: number;
  readonly giverNpcId: string;
  readonly description: string;
  readonly acceptanceCriteria: readonly AcceptanceCriterion[];
  /** Encounter that must be won to move the ticket to Code Review. */
  readonly targetEncounterId: string;
  readonly reward: { readonly xp: number; readonly tokens: number; readonly clarifiedBonusXp: number };
}

/** 'fix' criteria are met when the target bug is defeated; 'merge' ones when the ticket is Done. */
export interface AcceptanceCriterion {
  readonly text: string;
  readonly metOn: 'fix' | 'merge';
}

export interface QuestProgress {
  readonly status: QuestStatus;
  /** The hero asked a clarifying question before starting (story doc: underspecified tickets). */
  readonly clarified: boolean;
}

export const STATUS_LABEL: Record<QuestStatus, string> = {
  todo: 'To Do',
  inProgress: 'In Progress',
  codeReview: 'Code Review',
  done: 'Done',
};
