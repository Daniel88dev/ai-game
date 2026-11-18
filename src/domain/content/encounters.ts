import type { Position } from '../shared/geometry';

export interface EncounterDefinition {
  readonly id: string;
  readonly enemyId: string;
  readonly position: Position;
  /** The encounter is only on the map while this quest is In Progress. */
  readonly questId: string;
}

export const ENCOUNTERS: Record<string, EncounterDefinition> = {
  'lum7-beetle': {
    id: 'lum7-beetle',
    enemyId: 'nullPointerBeetle',
    position: { x: 13, y: 5 },
    questId: 'LUM-7',
  },
};
