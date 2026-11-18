import type { TileKind } from '../../domain';
import { PALETTE } from './palette';

/**
 * Procedural 16x16 office tiles in the "Dark Mode 24" palette.
 * Placeholder art until a pixel artist delivers the real tileset (see ART_DIRECTION.md, phase 2).
 */
type Ctx = CanvasRenderingContext2D;

const R = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => {
  c.fillStyle = PALETTE[col]!;
  c.fillRect(x, y, w, h);
};

function floor(c: Ctx, tx: number, ty: number) {
  R(c, 0, 0, 16, 16, 'd');
  // carpet tile seams every 2 tiles + speckle
  if (tx % 2 === 0) R(c, 0, 0, 1, 16, 'm');
  if (ty % 2 === 0) R(c, 0, 0, 16, 1, 'm');
  const n = (tx * 7 + ty * 13) % 5;
  R(c, 3 + n, 5 + (n % 3) * 3, 1, 1, 'm');
  R(c, 11 - n, 12 - (n % 2) * 4, 1, 1, 'm');
}

function wallTop(c: Ctx) {
  R(c, 0, 0, 16, 16, 'k');
  R(c, 0, 0, 16, 2, 'd');
}

function wallFace(c: Ctx) {
  R(c, 0, 0, 16, 16, 'm');
  R(c, 0, 0, 16, 2, 'd');
  for (let x = 0; x < 16; x += 2) R(c, x, 2, 1, 1, 'd');
  R(c, 0, 12, 16, 2, 'g');
  R(c, 0, 14, 16, 2, 'k');
}

function windowTile(c: Ctx, tx: number) {
  wallFace(c);
  R(c, 1, 2, 14, 10, 'k');
  R(c, 2, 3, 12, 8, 'd');
  // night city
  const hs = [5, 3, 6, 4];
  for (let i = 0; i < 4; i++) {
    const h = hs[(i + tx) % 4]!;
    R(c, 2 + i * 3, 11 - h, 3, h, 'k');
    if ((i + tx) % 2 === 0) R(c, 3 + i * 3, 12 - h, 1, 1, 'y');
  }
  if (tx % 3 === 0) R(c, 11, 4, 2, 2, 'w');
  R(c, 0, 12, 16, 1, 'l');
}

function kanban(c: Ctx, tx: number) {
  wallFace(c);
  R(c, 0, 2, 16, 10, 'l');
  R(c, 1, 3, 14, 8, 'w');
  const colours = ['y', 'o', 'G', 'p'];
  const col = colours[tx % 4]!;
  R(c, 2, 4, 4, 3, col);
  R(c, 8, 5, 4, 3, colours[(tx + 1) % 4]!);
  R(c, 3, 8, 4, 2, colours[(tx + 2) % 4]!);
  R(c, 15, 3, 1, 8, 'g');
}

function coffee(c: Ctx) {
  wallFace(c);
  R(c, 3, 1, 10, 14, 'k');
  R(c, 4, 2, 8, 12, 'g');
  R(c, 5, 3, 6, 3, 'k');
  R(c, 6, 4, 2, 1, 'G');
  R(c, 9, 4, 1, 1, 'r');
  R(c, 6, 8, 4, 4, 'd');
  R(c, 7, 10, 2, 2, 'w');
  R(c, 7, 7, 2, 1, 'X');
}

function server(c: Ctx, tx: number) {
  R(c, 0, 0, 16, 16, 'k');
  R(c, 1, 1, 14, 15, 'm');
  for (let i = 0; i < 4; i++) {
    const y = 2 + i * 3;
    R(c, 2, y, 12, 2, 'd');
    R(c, 3, y, 1, 1, 'G');
    R(c, 5, y, 1, 1, (i + tx) % 3 === 0 ? 'r' : 'c');
    R(c, 8, y, 5, 1, 'g');
  }
}

function desk(c: Ctx, tx: number, ty: number, red: boolean) {
  floor(c, tx, ty);
  // monitor
  R(c, 3, 0, 10, 8, 'k');
  R(c, 4, 1, 8, 5, red ? 'R' : 'd');
  if (red) {
    R(c, 5, 2, 6, 1, 'r');
    R(c, 5, 4, 4, 1, 'w');
  } else {
    R(c, 5, 2, 4, 1, 'p');
    R(c, 6, 3, 5, 1, 'c');
    R(c, 5, 4, 3, 1, 'G');
  }
  R(c, 7, 8, 2, 1, 'g');
  // desk top
  R(c, 0, 9, 16, 3, 'x');
  R(c, 0, 12, 16, 1, 'X');
  R(c, 0, 13, 16, 1, 'k');
  R(c, 1, 14, 2, 2, 'X');
  R(c, 13, 14, 2, 2, 'X');
  R(c, 4, 10, 7, 1, 'l');
  if ((tx + ty) % 3 === 0) R(c, 12, 8, 2, 2, 'w');
}

function table(c: Ctx, tx: number, ty: number) {
  floor(c, tx, ty);
  R(c, 0, 2, 16, 12, 'x');
  R(c, 0, 13, 16, 1, 'X');
  R(c, 0, 14, 16, 1, 'k');
  if ((tx + ty) % 2 === 0) R(c, 5, 5, 4, 3, 'w');
}

function plant(c: Ctx, tx: number, ty: number) {
  floor(c, tx, ty);
  R(c, 4, 10, 8, 5, 'O');
  R(c, 4, 10, 8, 1, 'x');
  R(c, 5, 15, 6, 1, 'X');
  const leaves: [number, number, string][] = [[7, 1, 'G'], [4, 3, 'G'], [9, 3, 'n'], [2, 6, 'n'], [11, 6, 'G'], [6, 5, 'G'], [8, 7, 'n']];
  for (const [x, y, col] of leaves) {
    R(c, x, y, 3, 2, col);
    R(c, x + 1, y + 2, 1, 1, 'n');
  }
}

export function drawTile(c: Ctx, kind: TileKind, tx: number, ty: number): void {
  switch (kind) {
    case 'floor':
      return floor(c, tx, ty);
    case 'wall':
      return ty === 1 ? wallFace(c) : wallTop(c);
    case 'window':
      return windowTile(c, tx);
    case 'kanban':
      return kanban(c, tx);
    case 'coffee':
      return coffee(c);
    case 'server':
      return server(c, tx);
    case 'desk':
      return desk(c, tx, ty, false);
    case 'heroDesk':
      return desk(c, tx, ty, true);
    case 'table':
      return table(c, tx, ty);
    case 'plant':
      return plant(c, tx, ty);
  }
}
