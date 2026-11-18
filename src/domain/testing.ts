import { decide, isWalkable } from './decide';
import { DIRECTION_DELTA, samePosition, type Direction, type Position } from './shared/geometry';
import { evolveAll } from './evolve';
import type { Command } from './commands';
import type { DomainEvent } from './events';
import type { GameState } from './state';

/** Test helper: run commands, fail loudly on rejection. */
export function run(state: GameState, ...commands: Command[]): { state: GameState; events: DomainEvent[] } {
  let s = state;
  const events: DomainEvent[] = [];
  for (const c of commands) {
    const d = decide(s, c);
    if (!d.ok) throw new Error(`Command ${c.type} rejected: ${d.reason}`);
    events.push(...d.events);
    s = evolveAll(s, d.events);
  }
  return { state: s, events };
}

export const types = (events: readonly DomainEvent[]) => events.map((e) => e.type);

// ------------------------------------------------------------------ scripted play (used by playthrough tests)


const DIRS = Object.keys(DIRECTION_DELTA) as Direction[];

/** Shortest walk (BFS) to a tile next to `target`, then turn to face it. */
export function walkTo(state: GameState, target: Position): GameState {
  const key = (p: Position) => `${p.x},${p.y}`;
  const start = state.hero.position;
  const prev = new Map<string, { from: Position; dir: Direction } | null>([[key(start), null]]);
  const queue: Position[] = [start];
  let goal: { at: Position; face: Direction } | null = null;
  while (queue.length && !goal) {
    const p = queue.shift()!;
    for (const d of DIRS) {
      const n = { x: p.x + DIRECTION_DELTA[d].x, y: p.y + DIRECTION_DELTA[d].y };
      if (samePosition(n, target)) {
        goal = { at: p, face: d };
        break;
      }
      if (prev.has(key(n)) || !isWalkable(state, n)) continue;
      prev.set(key(n), { from: p, dir: d });
      queue.push(n);
    }
  }
  if (!goal) throw new Error(`No path to ${key(target)}`);
  const path: Direction[] = [];
  for (let at = goal.at; prev.get(key(at)); at = prev.get(key(at))!.from) path.unshift(prev.get(key(at))!.dir);
  let s = run(state, ...path.map((direction) => ({ type: 'MoveHero', direction }) as Command)).state;
  if (s.hero.facing !== goal.face) s = run(s, { type: 'MoveHero', direction: goal.face }).state;
  return s;
}
