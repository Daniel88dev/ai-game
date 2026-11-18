export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Position {
  readonly x: number;
  readonly y: number;
}

export const DIRECTION_DELTA: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function step(from: Position, dir: Direction): Position {
  const d = DIRECTION_DELTA[dir];
  return { x: from.x + d.x, y: from.y + d.y };
}

export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
