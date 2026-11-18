import type { DomainEvent } from '../domain';

export type Panel = 'none' | 'menu' | 'questBoard' | 'character' | 'help';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
}

interface UiSnapshot {
  panel: Panel;
  /** True while Phaser plays a battle animation; the action buttons wait for it. */
  busy: boolean;
  toasts: readonly Toast[];
}

/**
 * UI-only state (open panels, toasts, animation lock). Not part of the domain
 * and never saved. Phaser reads `inputBlocked` to stop walking while a menu is open.
 */
export class UiStore {
  private snap: UiSnapshot = { panel: 'none', busy: false, toasts: [] };
  private readonly listeners = new Set<() => void>();
  private nextId = 1;

  get = (): UiSnapshot => this.snap;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private set(patch: Partial<UiSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  inputBlocked(): boolean {
    return this.snap.panel !== 'none';
  }

  open(panel: Panel) {
    this.set({ panel });
  }

  close() {
    this.set({ panel: 'none' });
  }

  setBusy(busy: boolean) {
    if (busy !== this.snap.busy) this.set({ busy });
  }

  toast(text: string, tone: Toast['tone'] = 'info') {
    const id = this.nextId++;
    this.set({ toasts: [...this.snap.toasts, { id, text, tone }].slice(-4) });
    setTimeout(() => this.set({ toasts: this.snap.toasts.filter((t) => t.id !== id) }), 2600);
  }

  /** Event-driven UI reactions (toasts, opening the quest board). */
  reactTo(events: readonly DomainEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'QuestBoardOpened':
          this.open('questBoard');
          break;
        case 'QuestAccepted':
          this.toast(`${e.questId} moved to In Progress`, 'info');
          break;
        case 'QuestCompleted':
          this.toast(`${e.questId} merged! +${e.xp} XP, +${e.tokens} tokens`, 'good');
          break;
        case 'LeveledUp':
          this.toast(`Level up! Level ${e.level}. +${e.attributePoints} attribute points`, 'good');
          break;
        case 'HeroRested':
          this.toast('Fresh coffee. HP and Focus restored.', 'good');
          break;
      }
    }
  }
}
