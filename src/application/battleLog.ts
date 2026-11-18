import { ENEMIES, NPCS, QUESTS, type DomainEvent } from '../domain';

const giverName = (questId: string) => NPCS[QUESTS[questId]?.giverNpcId ?? '']?.name.split(' ')[0] ?? 'the team';

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
  private enemyId = '';
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
      case 'BattleStarted': {
        const enemy = ENEMIES[e.battle.enemyId];
        this.enemyName = enemy?.name ?? 'the bug';
        this.enemyId = e.battle.enemyId;
        return { text: enemy?.intro ?? `A wild ${this.enemyName} appears!`, tone: 'info' };
      }
      case 'HeroDebugged':
        if (e.missed) return { text: ENEMIES[this.enemyId]?.missLine ?? 'Your blind fix misses.', tone: 'bad' };
        return { text: `${e.critical ? 'Clean hit! ' : ''}Your fix lands for ${e.damage} damage.`, tone: 'good' };
      case 'StackTraceRead':
        if (e.rootCause) return { text: `Root cause found: ${e.rootCause}.`, tone: 'good' };
        if (e.success) return { text: `A clue! ${e.clues}/${e.cluesNeeded}. The pattern is starting to show.`, tone: 'info' };
        return e.cluesNeeded > 1
          ? { text: 'The logs show nothing useful this time. Keep watching.', tone: 'warn' }
          : { text: 'The stack trace is 400 lines of framework code. Nothing yet.', tone: 'warn' };
      case 'TestWritten':
        return { text: `You write a failing test, then make it pass. ${e.damage} damage, and the bug hits softer now.`, tone: 'good' };
      case 'AiPatchApplied':
        return { text: `PILOT autocompletes a patch: ${e.damage} damage. (-${e.tokensSpent} tokens)`, tone: 'ai' };
      case 'AiHallucinated':
        return {
          text: `${ENEMIES[this.enemyId]?.hallucination ?? 'PILOT hallucinates.'} The bug heals ${e.enemyHealed}. (-${e.tokensSpent} tokens)`,
          tone: 'bad',
        };
      case 'AttackDodged':
        return { text: `${this.enemyName} throws ${e.attackName}, but you already shipped past it. Dodged!`, tone: 'good' };
      case 'EnemyGrew':
        return { text: `${this.enemyName} leaks more memory. It hits harder now (+${e.attackBonus}).`, tone: 'warn' };
      case 'EnemyRevived':
        return { text: `${this.enemyName} rises again with ${e.hp} HP. No test was guarding the fix.`, tone: 'bad' };
      case 'CoffeeDrunk':
        return { text: `Coffee. +${e.focusRestored} Focus, +${e.hpRestored} HP.`, tone: 'good' };
      case 'EnemyAttacked':
        return { text: `${this.enemyName} throws ${e.attackName}! You take ${e.damage} damage.`, tone: e.heavy ? 'bad' : 'warn' };
      case 'HeavyAttackTelegraphed':
        return { text: `${this.enemyName} is winding up: ${e.attackName}...`, tone: 'warn' };
      case 'BattleWon':
        return { text: `Fixed! Tests are green. +${e.xp} XP`, tone: 'good' };
      case 'LeveledUp':
        return { text: `Level up! You are now level ${e.level}.`, tone: 'good' };
      case 'QuestReadyForReview':
        return { text: `${e.questId} moved to Code Review. Tell ${giverName(e.questId)}.`, tone: 'info' };
      case 'BattleLost':
        return { text: 'Build failed. You need a break...', tone: 'bad' };
      case 'BattleRetreated':
        return { text: 'You stash your changes and step away from the keyboard.', tone: 'info' };
      default:
        return null;
    }
  }
}
