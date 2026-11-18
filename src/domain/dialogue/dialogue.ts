/** Side effects an option can trigger. Kept as data so the decider stays pure. */
export type DialogueEffect =
  | { readonly kind: 'acceptQuest'; readonly questId: string }
  | { readonly kind: 'askClarifying'; readonly questId: string }
  | { readonly kind: 'turnInQuest'; readonly questId: string };

export interface DialogueOption {
  readonly id: string;
  readonly label: string;
  /** Next node; undefined ends the conversation. */
  readonly next?: string;
  readonly effect?: DialogueEffect;
}

export interface DialogueNode {
  readonly id: string;
  readonly text: string;
  readonly options: readonly DialogueOption[];
}

export interface Dialogue {
  readonly npcId: string;
  readonly nodeId: string;
}
