import type { Direction, Position } from '../shared/geometry';

/**
 * The seven attributes from the mechanics doc:
 *   Craft:  Logic, Rigor, Velocity
 *   AI:     Prompt Craft, Orchestration
 *   Shared: Focus, Domain Insight
 */
export const ATTRIBUTES = ['logic', 'rigor', 'velocity', 'promptCraft', 'orchestration', 'focus', 'domainInsight'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export type Attributes = Readonly<Record<Attribute, number>>;
export type AttributeGroup = 'craft' | 'ai' | 'shared';

export const ATTRIBUTE_INFO: Record<Attribute, { label: string; group: AttributeGroup; effect: string }> = {
  logic: { label: 'Logic', group: 'craft', effect: 'Debug damage. Shows where test inputs lead.' },
  rigor: { label: 'Rigor', group: 'craft', effect: 'Max HP, less damage, Investigate and Write test. Spots suspicious diff lines.' },
  velocity: { label: 'Velocity', group: 'craft', effect: 'Dodge chance. More time and moves in minigames.' },
  promptCraft: { label: 'Prompt Craft', group: 'ai', effect: 'AI patch damage, fewer hallucinations.' },
  orchestration: { label: 'Orchestration', group: 'ai', effect: 'Cheaper AI calls. Bigger token budget at the coffee machine.' },
  focus: { label: 'Focus', group: 'shared', effect: 'Max Focus (spent on Investigate, Write test, Diagnose).' },
  domainInsight: { label: 'Domain Insight', group: 'shared', effect: 'Investigate success, bonus quest XP, clearer minigame hints.' },
};

/** Attributes a hero created before v2 saves did not have. */
export const ATTRIBUTES_ADDED_IN_V2: readonly Attribute[] = ['velocity', 'orchestration', 'domainInsight'];

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

/** 50, 125, 200, 275... XP per level: Act I ends around level 5. */
export function xpToNextLevel(level: number): number {
  return 50 + 75 * (level - 1);
}

export function maxHp(hero: Pick<Hero, 'level' | 'attributes'>): number {
  return 20 + hero.level * 4 + hero.attributes.rigor * 2;
}

export function maxFocus(hero: Pick<Hero, 'attributes'>): number {
  return 4 + hero.attributes.focus * 2;
}

/** Tokens the coffee machine tops you up to: the AI path's equivalent of resting. */
export function tokenAllowance(hero: Pick<Hero, 'attributes'>): number {
  return 20 + hero.attributes.orchestration * 10;
}

/** Quest XP multiplier from Domain Insight (+5% per point above 1). */
export function questXp(hero: Pick<Hero, 'attributes'>, base: number): number {
  return Math.round(base * (1 + Math.max(0, hero.attributes.domainInsight - 1) * 0.05));
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
  const attributes: Attributes = { logic: 2, rigor: 2, velocity: 1, promptCraft: 2, orchestration: 1, focus: 2, domainInsight: 1 };
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
