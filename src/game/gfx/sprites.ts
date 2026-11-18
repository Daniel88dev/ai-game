/**
 * Pixel-art sprites as text grids (one char = one pixel, '.' = transparent).
 * Hero/bug designs come from art/style-compare/tools/pixel_scene.py and
 * art/tools/gen_sprites.py. Keeping them as code means no binary assets and
 * easy palette swaps for NPCs and bug severity tiers.
 */
export type Grid = string[];

const pad = (rows: Grid, w: number, h: number): Grid => {
  const out = rows.map((r) => r.padEnd(w, '.').slice(0, w));
  while (out.length < h) out.push('.'.repeat(w));
  return out.slice(0, h);
};

export const swap = (grid: Grid, map: Record<string, string>): Grid =>
  grid.map((row) => [...row].map((ch) => map[ch] ?? ch).join(''));

const HERO_FRONT = pad([
  '',
  '....kkkkkkkk',
  '...khhhhhhhhk',
  '..khhhhhhhhhhk',
  '..khhhhhhhhhhk',
  '..khhsshhsshhk',
  '..khssssssssk',
  '..kskwkkkkwksk',
  '..kssssssssssk',
  '...ksssSSsssk',
  '....kSSSSSSk',
  '...kkbbbbbbkk',
  '..kbbbcbbcbbbk',
  '..kbbbbccbbbbk',
  '..kbBbbwwbbBbk',
  '.kbBbbbwwbbbBbk',
  '.kbBbbbbbbbbBbk',
  '.ksBbbbbbbbbBsk',
  '.kkBBBBBBBBBBkk',
  '..kmmmmmmmmmmk',
  '..kmmmmkkmmmmk',
  '..kmmmk..kmmmk',
  '..kwwwk..kwwwk',
  '..kkkkk..kkkkk',
], 16, 24);

const HERO_BACK = pad([
  '',
  '....kkkkkkkk',
  '...khhhhhhhhk',
  '..khhhhhhhhhhk',
  '..khhhhhhhhhhk',
  '..khhhhhhhhhhk',
  '..khhhhhhhhhhk',
  '..kshhhhhhhhsk',
  '..kshhhhhhhhsk',
  '...khhhhhhhhk',
  '....kSSSSSSk',
  '...kkbbbbbbkk',
  '..kbbbbbbbbbbk',
  '..kbbbbbbbbbbk',
  '..kbBbbbbbbBbk',
  '.kbBbbbbbbbbBbk',
  '.kbBbbbbbbbbBbk',
  '.ksBbbbbbbbbBsk',
  '.kkBBBBBBBBBBkk',
  '..kmmmmmmmmmmk',
  '..kmmmmkkmmmmk',
  '..kmmmk..kmmmk',
  '..kwwwk..kwwwk',
  '..kkkkk..kkkkk',
], 16, 24);

const HERO_SIDE = pad([
  '',
  '....kkkkkkk',
  '...khhhhhhhk',
  '..khhhhhhhhhk',
  '..khhhhhhhhhk',
  '..khhhhhhsssk',
  '..khhhhhsssssk',
  '..khhhhssskssk',
  '..khhhssssssk',
  '...khhsssSSk',
  '....kSSSSSk',
  '...kkbbbbbkk',
  '...kbbbbbbcbk',
  '...kbBbbbbbbk',
  '...kbBbbbbbbk',
  '...kbBbbbbbsk',
  '...kbBbbbbbsk',
  '...kbBbbbbbbk',
  '...kkBBBBBBkk',
  '....kmmmmmmk',
  '....kmmmmmmk',
  '....kmmk.kmk',
  '....kwwwk.kwwk',
  '....kkkkk.kkkk',
], 16, 24);

/** Walk frame: lift one foot by a pixel row. */
function step(grid: Grid, side: 'left' | 'right'): Grid {
  const out = [...grid];
  const cols = side === 'left' ? [0, 8] : [8, 16];
  const lift = (row: number) => {
    const src = grid[row + 1]!;
    const dst = out[row]!;
    out[row] = dst.slice(0, cols[0]) + src.slice(cols[0], cols[1]) + dst.slice(cols[1]);
  };
  for (let r = 20; r <= 22; r++) lift(r);
  out[23] = out[23]!.slice(0, cols[0]) + '.'.repeat(cols[1]! - cols[0]!) + out[23]!.slice(cols[1]);
  return out;
}

export const BEETLE = pad([
  '',
  '....k......k',
  '.....k....k',
  '......kkkk',
  '.....krrrrk',
  '....krwkkwrk',
  '....krrrrrrk',
  '..k.kRRRRRRk.k',
  '...krrrRRrrrk',
  '..krrrrRRrrrrk',
  '..krrkkRRkkrrk',
  '..krrkkRRkkrrk',
  '.k.krrrRRrrrk.k',
  '....kRRRRRRk',
  '...k.kkkkkk.k',
], 16, 16);

const BEETLE_STEP = (() => {
  const g = [...BEETLE];
  g[7] = '.k..kRRRRRRk..k';
  g[12] = '..kkrrrRRrrrkk';
  g[14] = '....kkkkkkkk';
  return pad(g, 16, 16);
})();

export const DRONE = pad([
  '',
  '.......kk',
  '......kcck',
  '....kkkkkkkk',
  '...kmmmmmmmmk',
  '..kmddddddddmk',
  '..kmdccddccdmk',
  '..kmddddddddmk',
  '..kmdddccdddmk',
  '...kmmmmmmmmk',
  '....kkkkkkkk',
  '.....kCCCCk',
  '......cccc',
], 16, 16);

export const MARKER = pad(['.kk.', 'kyyk', 'kyyk', 'kyyk', 'kyyk', '.kk.', 'kyyk', '.kk.'], 4, 8);
export const CHECK = pad(['......kk', '.....kGk', 'kk..kGk.', 'kGkkGk..', '.kGGk...', '..kk....'], 8, 6);

const PRIYA_SWAP = { h: 'd', s: 'x', S: 'X', b: 'p', B: 'P', c: 'y', m: 'k', w: 'l' };
const MARTA_SWAP = { h: 'l', b: 'n', B: 'k', c: 'G', w: 'x' };

export interface SpriteDef {
  key: string;
  grid: Grid;
}

function characterSet(prefix: string, swapMap?: Record<string, string>): SpriteDef[] {
  const f = (g: Grid) => (swapMap ? swap(g, swapMap) : g);
  return [
    { key: `${prefix}_down_0`, grid: f(HERO_FRONT) },
    { key: `${prefix}_down_1`, grid: f(step(HERO_FRONT, 'left')) },
    { key: `${prefix}_down_2`, grid: f(step(HERO_FRONT, 'right')) },
    { key: `${prefix}_up_0`, grid: f(HERO_BACK) },
    { key: `${prefix}_up_1`, grid: f(step(HERO_BACK, 'left')) },
    { key: `${prefix}_up_2`, grid: f(step(HERO_BACK, 'right')) },
    { key: `${prefix}_side_0`, grid: f(HERO_SIDE) },
    { key: `${prefix}_side_1`, grid: f(step(HERO_SIDE, 'left')) },
    { key: `${prefix}_side_2`, grid: f(step(HERO_SIDE, 'right')) },
  ];
}

export const SPRITES: SpriteDef[] = [
  ...characterSet('hero'),
  ...characterSet('npc_priya', PRIYA_SWAP),
  ...characterSet('npc_marta', MARTA_SWAP),
  { key: 'bug_null_pointer', grid: BEETLE },
  { key: 'bug_null_pointer_1', grid: BEETLE_STEP },
  { key: 'drone', grid: DRONE },
  { key: 'marker', grid: MARKER },
  { key: 'check', grid: CHECK },
];
