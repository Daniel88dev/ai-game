import type { Attributes } from '../hero/hero';
import type { Decision } from '../shared/result';
import type { Rng } from '../shared/rng';

/**
 * Shared contract for minigames (design/minigames.md §18).
 * Each minigame is its own small bounded context with a pure decider:
 *   start(...) -> session, decide(session, move) -> events, evolve(session, event) -> session.
 * The RPG core only knows this contract and the final grade.
 */
export type Grade = 'S' | 'A' | 'B' | 'C' | 'F';

/** What a minigame may read about the hero. A snapshot, so minigames never touch the Hero aggregate. */
export interface HeroSnapshot {
  readonly attributes: Attributes;
  readonly tokens: number;
  readonly focusPoints: number;
}

/** Resources a minigame event spends from the hero. The root evolve applies them. */
export interface Cost {
  readonly tokens?: number;
  readonly focus?: number;
}

export interface MinigameResult {
  readonly score: number;
  readonly grade: Grade;
  readonly summary: readonly string[];
}

export interface MinigameModule<S, M, E> {
  readonly title: string;
  start(questId: string, hero: HeroSnapshot, rng: Rng): S;
  decide(session: S, move: M, hero: HeroSnapshot, rng: Rng): Decision<E>;
  evolve(session: S, event: E): S;
  isOver(session: S): boolean;
  result(session: S): MinigameResult;
}

export function gradeFor(score: number): Grade {
  if (score >= 95) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 45) return 'C';
  return 'F';
}

export const GRADE_RANK: Record<Grade, number> = { F: 0, C: 1, B: 2, A: 3, S: 4 };
export const gradeAtLeast = (g: Grade, min: Grade) => GRADE_RANK[g] >= GRADE_RANK[min];

/** AI hallucination chance in minigames, same curve as in combat. */
export const hallucinationChance = (promptCraft: number, extra = 0) => Math.max(0.05, 0.4 - promptCraft * 0.05 + extra);
