import type { Direction, Position } from '../shared/geometry';

/**
 * Attributes from the mechanics doc. The slice uses four of the seven:
 * Logic, Rigor (craft), Prompt Craft (AI) and Focus (shared).
 */
export const ATTRIBUTES = ['logic', 'rigor', 'promptCraft', 'focus'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export type Attributes = Readonly<Record<Attribute, number>>;

export const ATTRIBUTE_INFO: Record<Attribute, { label: string; effect: string }> = {
  logic: { label: 'Logic', effect: 'Damage of manual Debug' },
  rigor: { label: 'Rigor', effect: 'Max HP, damage taken, Investigate success' },
  promptCraft: { label: 'Prompt Craft', effect: 'AI patch damage, fewer hallucinations' },
  focus: { label: 'Focus', effect: 'Max Focus (spent on Investigate)' },
};

/** Hidden path axes from the story doc (Understanding vs Leverage). */
export interface PathAffinity {
  readonly understanding: number;
  readonly leverage: number;
}

export interface Hero {
  readonly name: string;
  readonly level: number;
  /** XP collected towards the next level. */
  readonly xp: number;
  readonly attributes: Attributes;
  readonly unspentPoints: number;
  readonly hp: number;
  readonly focusPoints: number;
  /** AI tokens: currency spent to run models. */
  readonly tokens: number;
  readonly position: Position;
  readonly facing: Direction;
  readonly affinity: PathAffinity;
}

export const ATTRIBUTE_POINTS_PER_LEVEL = 3;
export const MAX_ATTRIBUTE = 10;

export function xpToNextLevel(level: number): number {
  return 50 * level;
}

export function maxHp(hero: Pick<Hero, 'level' | 'attributes'>): number {
  return 20 + hero.level * 4 + hero.attributes.rigor * 2;
}

export function maxFocus(hero: Pick<Hero, 'attributes'>): number {
  return 4 + hero.attributes.focus * 2;
}

/**
 * Applies XP and returns how many levels were gained.
 * Pure helper used by the decider to compute LeveledUp events.
 */
export function levelsGained(hero: Pick<Hero, 'level' | 'xp'>, gained: number): { levels: number[]; xpLeft: number } {
  let level = hero.level;
  let xp = hero.xp + gained;
  const levels: number[] = [];
  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level += 1;
    levels.push(level);
  }
  return { levels, xpLeft: xp };
}

export function createHero(name: string, position: Position): Hero {
  const attributes: Attributes = { logic: 2, rigor: 2, promptCraft: 2, focus: 2 };
  const base = { level: 1, attributes };
  return {
    name,
    level: 1,
    xp: 0,
    attributes,
    unspentPoints: 0,
    hp: maxHp(base),
    focusPoints: maxFocus(base),
    tokens: 30,
    position,
    facing: 'down',
    affinity: { understanding: 0, leverage: 0 },
  };
}
