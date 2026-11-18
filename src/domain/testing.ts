import { decide } from './decide';
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
