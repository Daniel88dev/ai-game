import type { Battle } from './combat/battle';
import type { Dialogue } from './dialogue/dialogue';
import { createHero, type Hero } from './hero/hero';
import type { QuestProgress } from './quest/quest';
import { HERO_SPAWN } from './world/officeMap';

export type Mode = 'explore' | 'dialogue' | 'battle';

/**
 * The whole single-player game state. It groups the aggregates
 * (Hero, quest log, current battle, current dialogue) under one root
 * because a save file is one consistent snapshot.
 */
export interface GameState {
  readonly hero: Hero;
  readonly quests: Readonly<Record<string, QuestProgress>>;
  readonly defeatedEncounters: readonly string[];
  readonly dialogue: Dialogue | null;
  readonly battle: Battle | null;
  readonly rngSeed: number;
  /** Count of commands accepted. Handy for save metadata and debugging. */
  readonly turn: number;
}

export function modeOf(state: GameState): Mode {
  if (state.battle) return 'battle';
  if (state.dialogue) return 'dialogue';
  return 'explore';
}

export function newGame(heroName = 'Sam Rivera', seed = 20261118): GameState {
  return {
    hero: createHero(heroName, HERO_SPAWN),
    quests: {},
    defeatedEncounters: [],
    dialogue: null,
    battle: null,
    rngSeed: seed,
    turn: 0,
  };
}
