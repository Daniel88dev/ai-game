import { ATTRIBUTES, ATTRIBUTES_ADDED_IN_V2, GRADE_RANK, HERO_SPAWN, isWalkable, newGame, type GameState } from '../domain';

/**
 * Save file format. Versioned so later releases can migrate old saves.
 * A save is a snapshot of GameState (not an event log): smaller, and safe
 * when game rules change between versions.
 *
 *   v1  first slice: 4 attributes
 *   v2  Act I: 7 attributes, story flags, minigame grades on tickets
 */
export const SAVE_FORMAT = 'merge-conflict-save';
export const SAVE_VERSION = 2;

export interface SaveFile {
  readonly format: typeof SAVE_FORMAT;
  readonly version: number;
  readonly savedAt: string; // ISO date
  readonly state: GameState;
}

export interface SaveSummary {
  readonly slot: SaveSlot;
  readonly savedAt: string;
  readonly heroName: string;
  readonly level: number;
}

export type SaveSlot = 'manual' | 'auto';

/** Port: where saves are kept. Implemented by localStorage in the browser and in-memory in tests. */
export interface SaveStore {
  read(slot: SaveSlot): string | null;
  write(slot: SaveSlot, data: string): void;
  remove(slot: SaveSlot): void;
}

export class SaveError extends Error {}

export function canSave(state: GameState): boolean {
  return state.battle === null && state.minigame === null;
}

export function toSaveFile(state: GameState, now: Date): SaveFile {
  // Dialogue is UI-transient; saving mid-conversation would restore an odd screen.
  return { format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: now.toISOString(), state: { ...state, dialogue: null } };
}

export function serialize(state: GameState, now: Date = new Date()): string {
  if (!canSave(state)) throw new SaveError(state.battle ? 'You cannot save during a fight.' : 'Finish the minigame first.');
  return JSON.stringify(toSaveFile(state, now), null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/** Parses and validates a save. Throws SaveError with a player-readable message. */
export function deserialize(raw: string): SaveFile {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new SaveError('This file is not valid JSON.');
  }
  if (!isObj(data) || data.format !== SAVE_FORMAT) throw new SaveError('This is not a Merge Conflict save file.');
  if (!isNum(data.version) || data.version > SAVE_VERSION) {
    throw new SaveError('This save comes from a newer version of the game.');
  }
  const migrated = migrate(data.version, data.state);
  const state = validateState(migrated);
  return { format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: isStr(data.savedAt) ? data.savedAt : new Date(0).toISOString(), state };
}

/** Upgrades an older save step by step: v1 -> v2 -> ... */
export function migrate(version: number, state: unknown): unknown {
  let s = state;
  if (version < 2) s = v1ToV2(s);
  return s;
}

/** v2 added Velocity, Orchestration and Domain Insight (start at 1) and story flags. */
function v1ToV2(state: unknown): unknown {
  if (!isObj(state) || !isObj(state.hero) || !isObj(state.hero.attributes)) return state;
  const attributes = { ...state.hero.attributes };
  for (const a of ATTRIBUTES_ADDED_IN_V2) if (!isNum(attributes[a])) attributes[a] = 1;
  return { ...state, hero: { ...state.hero, attributes }, flags: Array.isArray(state.flags) ? state.flags : [] };
}

function validateState(s: unknown): GameState {
  const fail = (what: string): never => {
    throw new SaveError(`The save file is damaged (${what}).`);
  };
  if (!isObj(s)) return fail('state');
  const h = s.hero;
  if (!isObj(h)) return fail('hero');
  if (!isStr(h.name) || !isNum(h.level) || !isNum(h.xp) || !isNum(h.hp) || !isNum(h.focusPoints) || !isNum(h.tokens) || !isNum(h.unspentPoints)) {
    return fail('hero stats');
  }
  if (!isObj(h.attributes) || !ATTRIBUTES.every((a) => isNum((h.attributes as Record<string, unknown>)[a]))) return fail('attributes');
  if (!isObj(h.position) || !isNum(h.position.x) || !isNum(h.position.y)) return fail('position');
  if (!isStr(h.facing) || !['up', 'down', 'left', 'right'].includes(h.facing)) return fail('facing');
  if (!isObj(h.affinity) || !isNum(h.affinity.understanding) || !isNum(h.affinity.leverage)) return fail('affinity');
  if (!isObj(s.quests)) return fail('quests');
  for (const q of Object.values(s.quests)) {
    if (!isObj(q) || !isStr(q.status) || !['todo', 'inProgress', 'codeReview', 'done'].includes(q.status) || typeof q.clarified !== 'boolean') {
      return fail('quest');
    }
    if (q.bestGrade !== undefined && !(isStr(q.bestGrade) && q.bestGrade in GRADE_RANK)) return fail('quest grade');
  }
  if (!Array.isArray(s.defeatedEncounters) || !s.defeatedEncounters.every(isStr)) return fail('encounters');
  if (!Array.isArray(s.flags) || !s.flags.every(isStr)) return fail('flags');
  if (!isNum(s.rngSeed)) return fail('seed');
  const base = newGame();
  const hero = h as unknown as GameState['hero'];
  const loaded: GameState = {
    ...base,
    hero,
    flags: s.flags as string[],
    quests: s.quests as GameState['quests'],
    defeatedEncounters: s.defeatedEncounters as string[],
    rngSeed: s.rngSeed,
    turn: isNum(s.turn) ? s.turn : 0,
    dialogue: null,
    battle: null,
  };
  // The office changes between versions; never load the hero inside a desk, an NPC or a bug.
  return isWalkable(loaded, hero.position) ? loaded : { ...loaded, hero: { ...hero, position: HERO_SPAWN } };
}

/** Use case: save / load / list slots, on top of the SaveStore port. */
export class SaveGameService {
  constructor(
    private readonly store: SaveStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  save(state: GameState, slot: SaveSlot = 'manual'): SaveSummary {
    const raw = serialize(state, this.clock());
    this.store.write(slot, raw);
    return summarize(slot, deserialize(raw));
  }

  load(slot: SaveSlot): GameState {
    const raw = this.store.read(slot);
    if (!raw) throw new SaveError('There is no save in this slot.');
    return deserialize(raw).state;
  }

  list(): SaveSummary[] {
    return (['manual', 'auto'] as const).flatMap((slot) => {
      const raw = this.store.read(slot);
      if (!raw) return [];
      try {
        return [summarize(slot, deserialize(raw))];
      } catch {
        return [];
      }
    });
  }

  latest(): SaveSummary | null {
    return this.list().sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null;
  }

  exportFile(state: GameState): { filename: string; content: string } {
    const now = this.clock();
    const content = serialize(state, now);
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return { filename: `merge-conflict-${stamp}.json`, content };
  }

  importFile(content: string): GameState {
    return deserialize(content).state;
  }
}

function summarize(slot: SaveSlot, file: SaveFile): SaveSummary {
  return { slot, savedAt: file.savedAt, heroName: file.state.hero.name, level: file.state.hero.level };
}
