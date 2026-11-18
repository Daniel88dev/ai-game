import { ENEMIES, type DomainEvent } from '../domain';

export type LogTone = 'info' | 'good' | 'bad' | 'ai' | 'warn';
export interface LogLine {
  readonly text: string;
  readonly tone: LogTone;
}

const MAX_LINES = 7;

/**
 * Read-model projection: turns combat events into battle-log lines.
 * It is not part of the save, it lives only while a fight is on screen.
 */
export class BattleLogProjection {
  private lines: LogLine[] = [];
  private enemyName = 'the bug';
  private readonly listeners = new Set<() => void>();

  getLines = (): readonly LogLine[] => this.lines;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  apply(events: readonly DomainEvent[]): void {
    let changed = false;
    for (const e of events) {
      const line = this.describe(e);
      if (e.type === 'BattleStarted') {
        this.lines = [];
        changed = true;
      }
      if (line) {
        this.lines = [...this.lines, line].slice(-MAX_LINES);
        changed = true;
      }
    }
    if (changed) for (const l of this.listeners) l();
  }

  private describe(e: DomainEvent): LogLine | null {
    switch (e.type) {
      case 'BattleStarted':
        this.enemyName = ENEMIES[e.battle.enemyId]?.name ?? 'A bug';
        return { text: `A wild ${this.enemyName} crawls out of the login code!`, tone: 'info' };
      case 'HeroDebugged':
        if (e.missed) return { text: 'You poke at the code blindly. The null slides right off its shell.', tone: 'bad' };
        return { text: `${e.critical ? 'Clean hit! ' : ''}Your fix lands for ${e.damage} damage.`, tone: 'good' };
      case 'StackTraceRead':
        return e.success
          ? { text: `Root cause found: ${e.rootCause}.`, tone: 'good' }
          : { text: 'The stack trace is 400 lines of framework code. Nothing yet.', tone: 'warn' };
      case 'AiPatchApplied':
        return { text: `PILOT autocompletes a patch: ${e.damage} damage. (-${e.tokensSpent} tokens)`, tone: 'ai' };
      case 'AiHallucinated':
        return {
          text: `PILOT confidently calls user.avatar.url()... which does not exist. The bug heals ${e.enemyHealed}.`,
          tone: 'bad',
        };
      case 'CoffeeDrunk':
        return { text: `Coffee. +${e.focusRestored} Focus, +${e.hpRestored} HP.`, tone: 'good' };
      case 'EnemyAttacked':
        return { text: `${this.enemyName} throws ${e.attackName}! You take ${e.damage} damage.`, tone: e.heavy ? 'bad' : 'warn' };
      case 'HeavyAttackTelegraphed':
        return { text: `The beetle is winding up an ${e.attackName}...`, tone: 'warn' };
      case 'BattleWon':
        return { text: `Fixed! Tests are green. +${e.xp} XP`, tone: 'good' };
      case 'LeveledUp':
        return { text: `Level up! You are now level ${e.level}.`, tone: 'good' };
      case 'QuestReadyForReview':
        return { text: `${e.questId} moved to Code Review. Tell Priya.`, tone: 'info' };
      case 'BattleLost':
        return { text: 'Build failed. You need a break...', tone: 'bad' };
      case 'BattleRetreated':
        return { text: 'You stash your changes and step away from the keyboard.', tone: 'info' };
      default:
        return null;
    }
  }
}
