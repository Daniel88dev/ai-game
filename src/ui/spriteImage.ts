import { PALETTE } from '../game/gfx/palette';
import { SPRITES } from '../game/gfx/sprites';

const cache = new Map<string, string>();

/** Renders a sprite grid to a data URL so React can show the same pixel art (dialogue portraits). */
export function spriteDataUrl(key: string): string | undefined {
  if (cache.has(key)) return cache.get(key);
  const def = SPRITES.find((s) => s.key === key);
  if (!def) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = def.grid[0]!.length;
  canvas.height = def.grid.length;
  const ctx = canvas.getContext('2d')!;
  def.grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = PALETTE[ch]!;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
