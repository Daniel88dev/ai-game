import Phaser from 'phaser';
import type { Runtime } from '../runtime';
import { BootScene } from './scenes/BootScene';
import { OfficeScene } from './scenes/OfficeScene';
import { BattleScene } from './scenes/BattleScene';
import { VIEW_HEIGHT, VIEW_WIDTH } from './constants';

export function createPhaserGame(parent: HTMLElement, rt: Runtime): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#14121f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: true },
    scene: [new BootScene(), new OfficeScene(rt), new BattleScene(rt)],
    banner: false,
  });
}
