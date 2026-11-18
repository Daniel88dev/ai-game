import type { DomainEvent } from '../domain';

/** Policy: which events trigger an autosave. The coffee machine is the save point. */
const AUTOSAVE_ON = new Set<DomainEvent['type']>(['HeroRested', 'QuestAccepted', 'BattleClosed', 'QuestCompleted']);

export function shouldAutosave(events: readonly DomainEvent[]): boolean {
  return events.some((e) => AUTOSAVE_ON.has(e.type));
}
