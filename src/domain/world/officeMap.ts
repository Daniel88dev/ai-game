import type { Position } from '../shared/geometry';

/**
 * The Lumen Ledger open-plan office, one character per 16x16 tile.
 * Rendering (Phaser) and rules (walkability) both read this grid, so the
 * domain decides where the hero may walk and the view only draws it.
 *
 *   #  wall            W  window          K  kanban board (quest log)
 *   C  coffee machine  S  server rack     D  desk
 *   H  hero's desk     T  meeting table   P  plant
 *   .  floor
 */
export const OFFICE_MAP: readonly string[] = [
  '##############################',
  '#WWW###WWW##KKKK###WWW#C#SSSS#',
  '#P..........................P#',
  '#............................#',
  '#..DDDD...DDDH.......TTTT....#',
  '#....................TTTT....#',
  '#..DDDD...DDDD...............#',
  '#............................#',
  '#............................#',
  '#..DDDD...DDDD..........P....#',
  '#............................#',
  '#............................#',
  '#.......................DDD..#',
  '#............................#',
  '#P..........................P#',
  '##############################',
];

export type TileKind = 'wall' | 'window' | 'kanban' | 'coffee' | 'server' | 'desk' | 'heroDesk' | 'table' | 'plant' | 'floor';

const TILE_KIND: Record<string, TileKind> = {
  '#': 'wall',
  W: 'window',
  K: 'kanban',
  C: 'coffee',
  S: 'server',
  D: 'desk',
  H: 'heroDesk',
  T: 'table',
  P: 'plant',
  '.': 'floor',
};

export const MAP_WIDTH = OFFICE_MAP[0]!.length;
export const MAP_HEIGHT = OFFICE_MAP.length;

export function tileAt(p: Position): TileKind {
  if (p.y < 0 || p.y >= MAP_HEIGHT || p.x < 0 || p.x >= MAP_WIDTH) return 'wall';
  const ch = OFFICE_MAP[p.y]![p.x]!;
  return TILE_KIND[ch] ?? 'wall';
}

export function isWalkableTile(p: Position): boolean {
  return tileAt(p) === 'floor';
}

export const HERO_SPAWN: Position = { x: 14, y: 11 };
