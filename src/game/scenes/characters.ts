import type Phaser from 'phaser';

export function dirKey(facing: string): 'down' | 'up' | 'side' {
  return facing === 'left' || facing === 'right' ? 'side' : (facing as 'down' | 'up');
}

/** Shows the idle frame for a facing direction. Side sprites face right; flip for left. */
export function faceSprite(sprite: Phaser.GameObjects.Sprite, prefix: string, facing: string) {
  sprite.anims.stop();
  sprite.setTexture(`${prefix}_${dirKey(facing)}_0`);
  sprite.setFlipX(facing === 'left');
}

export function walkSprite(sprite: Phaser.GameObjects.Sprite, prefix: string, facing: string) {
  sprite.setFlipX(facing === 'left');
  sprite.anims.play(`${prefix}_walk_${dirKey(facing)}`, true);
}
