import Phaser from 'phaser';
import { ENEMIES, evolve, hasWren, maxFocus, maxHp, type DomainEvent, type GameState } from '../../domain';
import type { Runtime } from '../../runtime';
import { cueFor } from '../../audio/cues';
import { hex } from '../gfx/palette';
import { FONT, VIEW_WIDTH } from '../constants';

const HERO_X = 130;
const ENEMY_X = 350;
const GROUND_Y = 150;
const STEP_MS = 520;

interface Bar {
  fill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  width: number;
  title: string;
}

/**
 * Side-view encounter screen ("The Codebase").
 * Battle rules live in the domain; this scene only animates the events.
 * It replays each event through the domain's own `evolve` so the bars
 * move step by step (hero hit first, then the enemy's answer).
 */
export class BattleScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Sprite;
  private drone!: Phaser.GameObjects.Image;
  private enemy!: Phaser.GameObjects.Sprite;
  private heroHp!: Bar;
  private heroFocus!: Bar;
  private enemyHp!: Bar;
  private rootCauseTag!: Phaser.GameObjects.Text;
  private warning!: Phaser.GameObjects.Text;
  /** Small green "test" shield shown once a test guards the hero. */
  private shield!: Phaser.GameObjects.Text;
  private shown!: GameState;

  constructor(private readonly rt: Runtime) {
    super('battle');
  }

  create() {
    const state = this.rt.game.getState();
    this.shown = state;
    const battle = state.battle!;
    const enemyDef = ENEMIES[battle.enemyId]!;

    this.drawBackground(enemyDef.codePath);

    // shadows
    this.add.ellipse(HERO_X, GROUND_Y + 2, 44, 8, hex('k'));
    this.add.ellipse(ENEMY_X, GROUND_Y + 2, 56, 10, hex('k'));

    this.hero = this.add.sprite(HERO_X, GROUND_Y, 'hero_side_0').setOrigin(0.5, 1).setScale(3);
    // PILOT is a small drone; WREN (Act II on) is the bigger agent build.
    this.drone = this.add.image(HERO_X - 52, GROUND_Y - 78, hasWren(this.rt.game.getState()) ? 'drone_wren' : 'drone').setScale(2);
    this.tweens.add({ targets: this.drone, y: this.drone.y - 5, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    this.enemy = this.add.sprite(ENEMY_X, GROUND_Y, enemyDef.sprite).setOrigin(0.5, 1).setScale(4).setFlipX(true);
    this.enemy.play(`${enemyDef.sprite}_idle`);

    this.add.text(ENEMY_X - 70, 14, enemyDef.name.toUpperCase(), { fontFamily: FONT, fontSize: '8px', color: '#e8e6f0' });
    this.enemyHp = this.bar(ENEMY_X - 70, 26, 110, 'r', 'HP');
    this.add.text(HERO_X - 70, 14, state.hero.name.toUpperCase(), { fontFamily: FONT, fontSize: '8px', color: '#e8e6f0' });
    this.heroHp = this.bar(HERO_X - 70, 26, 110, 'G', 'HP');
    this.heroFocus = this.bar(HERO_X - 70, 40, 110, 'b', 'FOC');

    this.rootCauseTag = this.add
      .text(ENEMY_X, GROUND_Y - 84, 'ROOT CAUSE FOUND', { fontFamily: FONT, fontSize: '8px', color: '#4fd6e0' })
      .setOrigin(0.5)
      .setVisible(battle.rootCauseRevealed);
    this.warning = this.add
      .text(ENEMY_X, GROUND_Y - 96, '! HEAVY ATTACK NEXT !', { fontFamily: FONT, fontSize: '8px', color: '#f5a524' })
      .setOrigin(0.5)
      .setVisible(false);
    this.tweens.add({ targets: this.warning, alpha: 0.3, yoyo: true, repeat: -1, duration: 300 });
    this.shield = this.add
      .text(HERO_X, GROUND_Y - 84, '[TEST]', { fontFamily: FONT, fontSize: '8px', color: '#46c46e' })
      .setOrigin(0.5, 0)
      .setVisible(battle.testWritten);

    this.renderBars(state, true);
    this.cameras.main.fadeIn(200, 20, 18, 31);

    const off = this.rt.game.onEvents((events, s) => this.onEvents(events, s));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.rt.ui.setBusy(false);
    });
  }

  private drawBackground(codePath: string) {
    const g = this.add.graphics();
    g.fillStyle(hex('k')).fillRect(0, 0, VIEW_WIDTH, 256);
    // "code" lines scrolling in the void of the Codebase
    const rnd = new Phaser.Math.RandomDataGenerator(['codebase']);
    const cols = ['m', 'm', 'd', 'g', 'C', 'P'];
    for (let y = 8; y < 180; y += 6) {
      let x = 6 + rnd.between(0, 3) * 8;
      while (x < VIEW_WIDTH - 20) {
        const w = rnd.between(2, 9) * 4;
        g.fillStyle(hex(cols[rnd.between(0, cols.length - 1)]!), 0.35).fillRect(x, y, w, 2);
        x += w + rnd.between(1, 4) * 4;
      }
    }
    g.fillStyle(hex('d')).fillRect(0, GROUND_Y, VIEW_WIDTH, 256 - GROUND_Y);
    g.fillStyle(hex('m')).fillRect(0, GROUND_Y, VIEW_WIDTH, 2);
    for (let x = 0; x < VIEW_WIDTH; x += 24) g.fillStyle(hex('m')).fillRect(x, GROUND_Y + 2, 1, 256);
    this.add.text(VIEW_WIDTH / 2, 4, `THE CODEBASE  ${codePath}`, { fontFamily: FONT, fontSize: '8px', color: '#6e6a8f' }).setOrigin(0.5, 0);
  }

  private bar(x: number, y: number, width: number, colour: string, title: string): Bar {
    this.add.rectangle(x, y, width + 2, 8, hex('k')).setOrigin(0, 0).setStrokeStyle(1, hex('g'));
    const fill = this.add.rectangle(x + 1, y + 1, width, 6, hex(colour)).setOrigin(0, 0);
    const label = this.add.text(x + width + 6, y, '', { fontFamily: FONT, fontSize: '8px', color: '#9d99bd' });
    return { fill, label, width, title };
  }

  private setBar(bar: Bar, value: number, max: number, instant: boolean) {
    const w = Math.max(0, Math.round((bar.width * value) / Math.max(1, max)));
    bar.label.setText(`${bar.title} ${value}/${max}`);
    if (instant) bar.fill.width = w;
    else this.tweens.add({ targets: bar.fill, width: w, duration: 250 });
  }

  private renderBars(s: GameState, instant = false) {
    this.setBar(this.heroHp, s.hero.hp, maxHp(s.hero), instant);
    this.setBar(this.heroFocus, s.hero.focusPoints, maxFocus(s.hero), instant);
    if (s.battle) {
      this.setBar(this.enemyHp, s.battle.enemyHp, s.battle.enemyMaxHp, instant);
      this.rootCauseTag.setVisible(s.battle.rootCauseRevealed && s.battle.phase === 'heroTurn');
    }
  }

  private onEvents(events: readonly DomainEvent[], finalState: GameState) {
    if (!events.length || !this.shown.battle) return;
    let s = this.shown;
    let t = 0;
    this.warning.setVisible(false);
    this.rt.ui.setBusy(true);

    for (const e of events) {
      s = evolve(s, e);
      const snapshot = s;
      if (e.type === 'EnemyAttacked' || e.type === 'BattleWon' || e.type === 'BattleLost') t += STEP_MS;
      this.time.delayedCall(t, () => this.animate(e, snapshot));
    }
    this.time.delayedCall(t + 350, () => {
      this.shown = finalState;
      this.rt.ui.setBusy(false);
    });
  }

  private animate(e: DomainEvent, s: GameState) {
    // The win jingle already says "ticket ready"; a level-up gets its fanfare once the jingle ends.
    if (e.type === 'LeveledUp') this.rt.audio.playCue(cueFor(e), 0.9);
    else if (e.type !== 'QuestReadyForReview') this.rt.audio.playCue(cueFor(e));
    switch (e.type) {
      case 'HeroDebugged':
        this.lunge(this.hero, 1);
        if (e.missed) this.popup(ENEMY_X, 'MISS', '#9d99bd');
        else {
          this.hit(this.enemy);
          this.popup(ENEMY_X, `-${e.damage}${e.critical ? '!' : ''}`, e.critical ? '#f7e26b' : '#e8e6f0');
          if (e.absorbed) this.popup(ENEMY_X, 'ARMOR', '#9d99bd', 34);
        }
        break;
      case 'StackTraceRead':
        if (e.rootCause) this.popup(HERO_X, 'ROOT CAUSE!', '#4fd6e0');
        else if (e.success) this.popup(HERO_X, `CLUE ${e.clues}/${e.cluesNeeded}`, '#4fd6e0');
        else this.popup(HERO_X, '???', '#9d99bd');
        if (e.success) this.scan();
        break;
      case 'TestWritten':
        this.lunge(this.hero, 1);
        this.hit(this.enemy);
        this.popup(ENEMY_X, `-${e.damage}`, '#e8e6f0');
        this.popup(HERO_X, 'TEST ADDED', '#46c46e', 34);
        this.shield.setVisible(true);
        break;
      case 'AttackDodged':
        this.lunge(this.enemy, -1);
        this.tweens.add({ targets: this.hero, x: HERO_X - 26, yoyo: true, duration: 120, ease: 'Quad.out' });
        this.popup(HERO_X, 'DODGE', '#f7e26b');
        break;
      case 'EnemyGrew':
        this.tweens.add({ targets: this.enemy, scale: 4 + Math.min(2, e.attackBonus * 0.2), duration: 300, ease: 'Back.out' });
        this.popup(ENEMY_X, `+${e.attackBonus} ATK`, '#f5a524', 34);
        break;
      case 'EnemyRegenerated':
        this.tweens.add({ targets: this.enemy, scaleX: '+=0.3', yoyo: true, duration: 150 });
        this.popup(ENEMY_X, `+${e.amount}`, '#46c46e', 34);
        break;
      case 'EnemyRevived':
        this.enemy.setAlpha(0.2);
        this.tweens.add({ targets: this.enemy, alpha: 1, duration: 500 });
        this.popup(ENEMY_X, "IT'S BACK", '#e5484d', 34);
        break;
      case 'AiPatchApplied':
        this.beam(false);
        this.time.delayedCall(180, () => {
          this.hit(this.enemy);
          this.popup(ENEMY_X, `-${e.damage}`, '#4fd6e0');
        });
        break;
      case 'AiHallucinated':
        this.beam(true);
        this.glitch(this.drone);
        this.popup(ENEMY_X, `+${e.enemyHealed}`, '#46c46e');
        break;
      case 'CoffeeDrunk':
        this.popup(HERO_X, `+${e.hpRestored} HP`, '#46c46e');
        break;
      case 'EnemyAttacked':
        this.lunge(this.enemy, -1);
        this.time.delayedCall(120, () => {
          this.hit(this.hero);
          this.popup(HERO_X, `-${e.damage}`, e.heavy ? '#e5484d' : '#f5a524');
          if (e.heavy) this.cameras.main.shake(250, 0.012);
        });
        break;
      case 'HeavyAttackTelegraphed':
        this.warning.setVisible(true);
        break;
      case 'BattleWon':
        this.fixed();
        break;
      case 'BattleLost':
        this.hero.setTint(hex('g'));
        this.tweens.add({ targets: this.hero, angle: -90, y: GROUND_Y - 6, duration: 400 });
        this.popup(HERO_X, 'BUILD FAILED', '#e5484d', 20);
        break;
      case 'BattleRetreated':
        this.tweens.add({ targets: [this.hero, this.drone], x: '-=200', duration: 450, ease: 'Quad.in' });
        break;
    }
    this.renderBars(s);
  }

  // ------------------------------------------------------------ small effects

  private lunge(target: Phaser.GameObjects.Sprite, dir: 1 | -1) {
    this.tweens.add({ targets: target, x: target.x + 22 * dir, yoyo: true, duration: 110, ease: 'Quad.out' });
  }

  private hit(target: Phaser.GameObjects.Sprite) {
    target.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(90, () => target.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    this.tweens.add({ targets: target, x: target.x + 3, yoyo: true, repeat: 2, duration: 40 });
  }

  private popup(x: number, text: string, color: string, rise = 24) {
    const t = this.add
      .text(x, GROUND_Y - 60, text, { fontFamily: FONT, fontSize: '8px', color, stroke: '#14121f', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(100);
    this.tweens.add({ targets: t, y: t.y - rise, alpha: 0, duration: 900, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  private beam(broken: boolean) {
    const g = this.add.graphics().setDepth(50);
    const from = { x: this.drone.x + 10, y: this.drone.y + 8 };
    const to = { x: ENEMY_X - 20, y: GROUND_Y - 30 };
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const px = from.x + ((to.x - from.x) * i) / steps;
      const py = from.y + ((to.y - from.y) * i) / steps + (broken ? Phaser.Math.Between(-10, 10) : 0);
      g.fillStyle(hex(i % 2 ? 'c' : 'C')).fillRect(px, py, 4, 4);
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 400, delay: 150, onComplete: () => g.destroy() });
  }

  private glitch(target: Phaser.GameObjects.Image) {
    target.setTint(hex('p'));
    this.tweens.add({ targets: target, x: target.x + 4, yoyo: true, repeat: 4, duration: 30, onComplete: () => target.clearTint() });
  }

  private scan() {
    const line = this.add.rectangle(ENEMY_X - 40, GROUND_Y - 70, 2, 70, hex('c')).setOrigin(0, 0).setAlpha(0.8);
    this.tweens.add({ targets: line, x: ENEMY_X + 40, duration: 350, onComplete: () => line.destroy() });
  }

  private fixed() {
    this.tweens.add({ targets: this.enemy, alpha: 0, scale: 2, duration: 450, ease: 'Quad.in' });
    for (let i = 0; i < 14; i++) {
      const c = this.add.image(ENEMY_X, GROUND_Y - 30, 'check').setScale(2).setDepth(60);
      const a = (Math.PI * 2 * i) / 14;
      this.tweens.add({
        targets: c,
        x: ENEMY_X + Math.cos(a) * 70,
        y: GROUND_Y - 30 + Math.sin(a) * 50,
        alpha: 0,
        duration: 800,
        ease: 'Quad.out',
        onComplete: () => c.destroy(),
      });
    }
    this.popup(ENEMY_X, 'FIXED!', '#46c46e', 40);
    this.hero.anims.play('hero_walk_down');
    this.time.delayedCall(500, () => this.hero.anims.stop());
  }
}
