import Phaser from 'phaser';
import { MAP_HEIGHT, MAP_WIDTH, NPCS, tileAt } from '../../domain';
import { PALETTE } from '../gfx/palette';
import { SPRITES, type Grid } from '../gfx/sprites';
import { drawTile } from '../gfx/tiles';
import { TILE } from '../constants';

/** Builds every texture from code (sprite grids + procedural tiles), then starts the office. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    for (const s of SPRITES) this.gridTexture(s.key, s.grid);
    this.officeTexture();
    this.characterAnims('hero');
    for (const npc of Object.values(NPCS)) this.characterAnims(npc.sprite);
    // Two-frame idle loop for every bug: `bug_x` + `bug_x_1`.
    const keys = new Set(SPRITES.map((s) => s.key));
    for (const key of keys) {
      if (!key.startsWith('bug_') || !keys.has(`${key}_1`)) continue;
      this.anims.create({
        key: `${key}_idle`,
        frames: [{ key }, { key: `${key}_1` }],
        frameRate: key === 'bug_heisenbug' ? 6 : 3,
        repeat: -1,
      });
    }
    this.scene.start('office');
  }

  private gridTexture(key: string, grid: Grid) {
    const h = grid.length;
    const w = grid[0]!.length;
    const tex = this.textures.createCanvas(key, w, h)!;
    const ctx = tex.context;
    grid.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        ctx.fillStyle = PALETTE[ch] ?? '#ff00ff';
        ctx.fillRect(x, y, 1, 1);
      }),
    );
    tex.refresh();
  }

  private officeTexture() {
    const tex = this.textures.createCanvas('office', MAP_WIDTH * TILE, MAP_HEIGHT * TILE)!;
    const ctx = tex.context;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        ctx.save();
        ctx.translate(x * TILE, y * TILE);
        drawTile(ctx, tileAt({ x, y }), x, y);
        ctx.restore();
      }
    }
    tex.refresh();
  }

  private characterAnims(prefix: string) {
    for (const dir of ['down', 'up', 'side']) {
      this.anims.create({
        key: `${prefix}_walk_${dir}`,
        frames: [1, 0, 2, 0].map((i) => ({ key: `${prefix}_${dir}_${i}` })),
        frameRate: 10,
        repeat: -1,
      });
    }
  }
}
