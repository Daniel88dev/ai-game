import type { HeroAction } from './combat/battle';
import type { Attribute } from './hero/hero';
import type { MinigameMove } from './minigames/minigame';
import type { Direction } from './shared/geometry';

/** Commands: intentions from the player. The decider accepts or rejects them. */
export type Command =
  | { type: 'MoveHero'; direction: Direction }
  | { type: 'Interact' }
  | { type: 'ChooseDialogueOption'; optionId: string }
  | { type: 'TakeBattleAction'; action: HeroAction }
  | { type: 'CloseBattle' }
  | { type: 'PlayMinigame'; move: MinigameMove }
  | { type: 'CloseMinigame' }
  | { type: 'SpendAttributePoint'; attribute: Attribute };

export type CommandType = Command['type'];
