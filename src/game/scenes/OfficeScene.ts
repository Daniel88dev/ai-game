import Phaser from 'phaser';
import { getWorld, modeOf, type Direction, type DomainEvent, type GameState, type WorldView } from '../../domain';
import type { Runtime } from '../../runtime';
import { MOVE_MS, tileToWorld } from '../constants';
import { faceSprite, walkSprite } from './characters';

const DIRS: [Direction, string[]][] = [
  ['up', ['UP', 'W']],
  ['down', ['DOWN', 'S']],
  ['left', ['LEFT', 'A']],
  ['right', ['RIGHT', 'D']],
];

/**
 * The hub map. Pure view + input adapter:
 *  - reads positions through the `getWorld` query,
 *  - turns key presses into MoveHero / Interact commands,
 *  - animates the events that come back.
 */
export class OfficeScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Sprite;
  private npcs = new Map<string, { sprite: Phaser.GameObjects.Sprite; marker: Phaser.GameObjects.Image; prefix: string }>();
  private bugs = new Map<string, Phaser.GameObjects.Sprite>();
  private keys = new Map<Direction, Phaser.Input.Keyboard.Key[]>();
  private interactKeys: Phaser.Input.Keyboard.Key[] = [];
  private moving = false;

  constructor(private readonly rt: Runtime) {
    super('office');
  }

  create() {
    this.add.image(0, 0, 'office').setOrigin(0, 0).setDepth(-1000);
    const world = getWorld(this.rt.game.getState());

    const h = tileToWorld(world.hero.x, world.hero.y);
    this.hero = this.add.sprite(h.x, h.y, 'hero_down_0').setOrigin(0.5, 1);

    const kb = this.input.keyboard!;
    for (const [dir, names] of DIRS) this.keys.set(dir, names.map((n) => kb.addKey(n)));
    this.interactKeys = ['E', 'SPACE'].map((n) => kb.addKey(n));

    const off = this.rt.game.onEvents((events, state) => this.onEvents(events, state));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.sync(this.rt.game.getState(), true);
  }

  update() {
    const state = this.rt.game.getState();
    if (this.moving || this.rt.ui.inputBlocked() || modeOf(state) !== 'explore') return;

    for (const [dir, keys] of this.keys) {
      if (keys.some((k) => k.isDown)) {
        this.rt.game.dispatch({ type: 'MoveHero', direction: dir });
        return;
      }
    }
    if (this.interactKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
      this.rt.game.dispatch({ type: 'Interact' });
    } else if (!this.hero.anims.isPlaying) {
      faceSprite(this.hero, 'hero', state.hero.facing);
    }
  }

  private onEvents(events: readonly DomainEvent[], state: GameState) {
    if (events.length === 0) {
      // Full reset (load / import / new game)
      this.scene.stop('battle');
      if (this.scene.isPaused()) this.scene.resume();
      this.sync(state, true);
      return;
    }
    for (const e of events) {
      switch (e.type) {
        case 'HeroMoved': {
          this.moving = true;
          const to = tileToWorld(e.to.x, e.to.y);
          walkSprite(this.hero, 'hero', e.facing);
          this.tweens.add({
            targets: this.hero,
            x: to.x,
            y: to.y,
            duration: MOVE_MS,
            onUpdate: () => this.hero.setDepth(this.hero.y),
            onComplete: () => {
              this.moving = false;
              // keep walking animation if a direction key is still held; update() decides
              const held = [...this.keys.values()].some((ks) => ks.some((k) => k.isDown));
              if (!held) faceSprite(this.hero, 'hero', this.rt.game.getState().hero.facing);
            },
          });
          break;
        }
        case 'HeroTurned':
          faceSprite(this.hero, 'hero', e.facing);
          break;
        case 'DialogueStarted': {
          // NPC turns to face the hero
          const npc = this.npcs.get(e.npcId);
          if (npc) faceSprite(npc.sprite, npc.prefix, opposite(state.hero.facing));
          break;
        }
        case 'BattleStarted':
          this.hero.anims.stop();
          this.cameras.main.flash(250, 229, 72, 77);
          this.time.delayedCall(260, () => {
            this.scene.launch('battle');
            this.scene.pause();
          });
          break;
        case 'BattleClosed':
          this.scene.stop('battle');
          this.scene.resume();
          break;
      }
    }
    this.sync(state, false);
  }

  private addNpc(n: WorldView['npcs'][number]) {
    const pos = tileToWorld(n.x, n.y);
    const sprite = this.add.sprite(pos.x, pos.y, `${n.sprite}_down_0`).setOrigin(0.5, 1);
    faceSprite(sprite, n.sprite, n.facing);
    const marker = this.add.image(pos.x, pos.y - 28, 'marker').setOrigin(0.5, 1).setDepth(10_000);
    this.tweens.add({ targets: marker, y: marker.y - 3, yoyo: true, repeat: -1, duration: 450, ease: 'Sine.inOut' });
    this.npcs.set(n.id, { sprite, marker, prefix: n.sprite });
    return this.npcs.get(n.id)!;
  }

  /** Reconcile sprites with the world read model. */
  private sync(state: GameState, snapHero: boolean) {
    const world = getWorld(state);
    if (snapHero) {
      const h = tileToWorld(world.hero.x, world.hero.y);
      this.tweens.killTweensOf(this.hero);
      this.moving = false;
      this.hero.setPosition(h.x, h.y);
      faceSprite(this.hero, 'hero', world.hero.facing);
    }
    this.hero.setDepth(this.hero.y);

    // NPCs can leave the company (Act II ending), so reconcile like the bugs.
    const present = new Set(world.npcs.map((n) => n.id));
    for (const [id, npc] of this.npcs) {
      if (present.has(id)) continue;
      npc.sprite.destroy();
      npc.marker.destroy();
      this.npcs.delete(id);
    }
    for (const n of world.npcs) {
      const npc = this.npcs.get(n.id) ?? this.addNpc(n);
      npc.sprite.setDepth(npc.sprite.y);
      npc.marker.setVisible(n.hasQuestMarker);
      if (snapHero) faceSprite(npc.sprite, n.sprite, n.facing);
    }

    const alive = new Set(world.bugs.map((b) => b.encounterId));
    for (const [id, sprite] of this.bugs) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.bugs.delete(id);
      }
    }
    for (const b of world.bugs) {
      if (this.bugs.has(b.encounterId)) continue;
      const p = tileToWorld(b.x, b.y);
      const sprite = this.add.sprite(p.x, p.y, b.sprite).setOrigin(0.5, 1).setDepth(p.y);
      sprite.play(`${b.sprite}_idle`);
      sprite.setAlpha(0);
      this.tweens.add({ targets: sprite, alpha: 1, duration: 400 });
      this.bugs.set(b.encounterId, sprite);
    }
  }
}

function opposite(d: Direction): Direction {
  return ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[d];
}
