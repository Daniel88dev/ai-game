import type { Rng } from '../shared/rng';
import type { Decision } from '../shared/result';
import { ciPipeline, type CiEvent, type CiMove, type CiSession } from './ciPipeline';
import { codeReview, type ReviewEvent, type ReviewMove, type ReviewSession } from './codeReview';
import { coverage, type CoverageEvent, type CoverageMove, type CoverageSession } from './coverage';
import type { HeroSnapshot, MinigameModule, MinigameResult } from './shared';

export type { Grade, HeroSnapshot, MinigameResult, Cost } from './shared';
export { GRADE_RANK, gradeAtLeast, gradeFor } from './shared';

/**
 * Registry of minigame bounded contexts. The core decider talks to a minigame
 * only through these functions, so adding one means: write the module, add it here.
 */
export type MinigameId = 'ciPipeline' | 'coverage' | 'codeReview';
export type MinigameSession = CiSession | CoverageSession | ReviewSession;
export type MinigameEvent = CiEvent | CoverageEvent | ReviewEvent;

export type MinigameMove =
  | ({ readonly game: 'ciPipeline' } & CiMove)
  | ({ readonly game: 'coverage' } & CoverageMove)
  | ({ readonly game: 'codeReview' } & ReviewMove);

// The registry erases the per-game types; the functions below restore them by `kind`.
type AnyModule = MinigameModule<any, any, any>;

const MODULES: Record<MinigameId, AnyModule> = { ciPipeline, coverage, codeReview };

export const MINIGAME_TITLES: Record<MinigameId, string> = {
  ciPipeline: ciPipeline.title,
  coverage: coverage.title,
  codeReview: codeReview.title,
};

export function startMinigame(id: MinigameId, questId: string, hero: HeroSnapshot, rng: Rng): MinigameSession {
  return MODULES[id].start(questId, hero, rng) as MinigameSession;
}

export function decideMinigame(
  session: MinigameSession,
  move: MinigameMove,
  hero: HeroSnapshot,
  rng: Rng,
): Decision<MinigameEvent> {
  if (move.game !== session.kind) return { ok: false, reason: 'That move belongs to another minigame' };
  return MODULES[session.kind].decide(session, move, hero, rng) as Decision<MinigameEvent>;
}

export function evolveMinigame(session: MinigameSession, event: MinigameEvent): MinigameSession {
  if (event.game !== session.kind) return session;
  return MODULES[session.kind].evolve(session, event) as MinigameSession;
}

export function isMinigameOver(session: MinigameSession): boolean {
  return MODULES[session.kind].isOver(session);
}

export function minigameResult(session: MinigameSession): MinigameResult {
  return MODULES[session.kind].result(session);
}
