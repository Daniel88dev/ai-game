import type { Position } from '../shared/geometry';

export interface EncounterDefinition {
  readonly id: string;
  readonly enemyId: string;
  readonly position: Position;
  /** The encounter is only on the map while this quest is In Progress. */
  readonly questId: string;
}

const encounters: EncounterDefinition[] = [
  { id: 'lum7-beetle', enemyId: 'nullPointerBeetle', position: { x: 13, y: 5 }, questId: 'LUM-7' },
  { id: 'lum14-imp', enemyId: 'offByOneImp', position: { x: 4, y: 8 }, questId: 'LUM-14' },
  { id: 'lum31-slime', enemyId: 'memoryLeakSlime', position: { x: 20, y: 6 }, questId: 'LUM-31' },
  { id: 'lum35-revenant', enemyId: 'regressionRevenant', position: { x: 13, y: 5 }, questId: 'LUM-35' },
  { id: 'lum33-heisenbug', enemyId: 'heisenbug', position: { x: 27, y: 9 }, questId: 'LUM-33' },
];

export const ENCOUNTERS: Record<string, EncounterDefinition> = Object.fromEntries(encounters.map((e) => [e.id, e]));
