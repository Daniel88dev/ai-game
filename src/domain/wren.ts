import type { GameState } from './state';

/**
 * The AI companion. Act I: PILOT, an autocomplete. Merging LUM-102 ("Enable AI
 * assistant for all engineers") replaces it with WREN, a real agent: its patches
 * hit harder, and the onboarding doc for agents (LUM-140) makes it hallucinate less.
 */
export const WREN_QUEST = 'LUM-102';
export const AGENTS_DOC_QUEST = 'LUM-140';

export const hasWren = (state: GameState): boolean => state.quests[WREN_QUEST]?.status === 'done';
export const aiName = (state: GameState): 'PILOT' | 'WREN' => (hasWren(state) ? 'WREN' : 'PILOT');

/** Extra damage on a successful AI patch once WREN is online. */
export const WREN_DAMAGE_BONUS = 6;
/** Hallucination chance taken off once agents have a proper onboarding doc. */
export const AGENTS_DOC_CLARITY = 0.08;
export const aiClarity = (state: GameState): number => (state.quests[AGENTS_DOC_QUEST]?.status === 'done' ? AGENTS_DOC_CLARITY : 0);
