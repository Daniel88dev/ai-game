/** Side effects an option can trigger. Kept as data so the decider stays pure. */
export type DialogueEffect =
  | { readonly kind: 'acceptQuest'; readonly questId: string }
  | { readonly kind: 'askClarifying'; readonly questId: string }
  | { readonly kind: 'turnInQuest'; readonly questId: string }
  | { readonly kind: 'startMinigame'; readonly questId: string }
  /**
   * A story choice. Happens once per flag: it shifts the hidden path axes
   * (Understanding vs Leverage) and can gift tokens.
   */
  | {
      readonly kind: 'storyChoice';
      readonly flag: string;
      readonly understanding?: number;
      readonly leverage?: number;
      readonly tokens?: number;
    };

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
