export const TILE = 16;
export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 256;
export const FONT = '"Press Start 2P", monospace';
export const MOVE_MS = 140;

/** Tile -> pixel. Characters stand on the bottom-centre of their tile. */
export const tileToWorld = (x: number, y: number) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE });
