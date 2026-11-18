import { BattleLogProjection } from './application/battleLog';
import { GameService } from './application/gameService';
import { SaveGameService } from './application/saveGame';
import { shouldAutosave } from './application/autosave';
import { LocalStorageSaveStore, MemorySaveStore } from './infrastructure/localStorageSaveStore';
import { UiStore } from './ui/uiStore';
import type { SaveStore } from './application/saveGame';

/**
 * Composition root: wires domain, application services and adapters together.
 * Phaser scenes and React components receive this object; nothing else is global.
 */
export interface Runtime {
  readonly game: GameService;
  readonly battleLog: BattleLogProjection;
  readonly saves: SaveGameService;
  readonly ui: UiStore;
}

function pickStore(): SaveStore {
  try {
    const probe = '__merge_conflict_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return new LocalStorageSaveStore();
  } catch {
    return new MemorySaveStore();
  }
}

export function createRuntime(): Runtime {
  const game = new GameService();
  const battleLog = new BattleLogProjection();
  const saves = new SaveGameService(pickStore());
  const ui = new UiStore();

  game.onEvents((events, state) => {
    battleLog.apply(events);
    ui.reactTo(events);
    if (shouldAutosave(events)) {
      try {
        saves.save(state, 'auto');
        ui.toast('Autosaved', 'info');
      } catch {
        /* e.g. storage full; the manual export still works */
      }
    }
  });

  return { game, battleLog, saves, ui };
}
