import { BattleLogProjection } from './application/battleLog';
import { GameService } from './application/gameService';
import { SaveGameService } from './application/saveGame';
import { shouldAutosave } from './application/autosave';
import { LocalStorageSaveStore, MemorySaveStore } from './infrastructure/localStorageSaveStore';
import { UiStore } from './ui/uiStore';
import { AudioEngine } from './audio/audioEngine';
import { AudioSettingsStore } from './audio/audioSettings';
import { isAnimatedByBattleScene, pickCue } from './audio/cues';

/**
 * Composition root: wires domain, application services and adapters together.
 * Phaser scenes and React components receive this object; nothing else is global.
 */
export interface Runtime {
  readonly game: GameService;
  readonly battleLog: BattleLogProjection;
  readonly saves: SaveGameService;
  readonly ui: UiStore;
  readonly audio: AudioEngine;
}

function usableLocalStorage(): Storage | null {
  try {
    const probe = '__merge_conflict_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createRuntime(): Runtime {
  const game = new GameService();
  const battleLog = new BattleLogProjection();
  const storage = usableLocalStorage();
  const saves = new SaveGameService(storage ? new LocalStorageSaveStore(storage) : new MemorySaveStore());
  const ui = new UiStore();
  // Audio settings sit next to the save slots in localStorage, never inside a save file.
  const audio = new AudioEngine(new AudioSettingsStore(storage));

  game.onEvents((events, state) => {
    battleLog.apply(events);
    ui.reactTo(events);
    // During a fight the battle scene plays each sound in step with its animation.
    if (!isAnimatedByBattleScene(events, state)) audio.playCue(pickCue(events));
    if (shouldAutosave(events)) {
      try {
        saves.save(state, 'auto');
        ui.toast('Autosaved', 'info');
      } catch {
        /* e.g. storage full; the manual export still works */
      }
    }
  });

  return { game, battleLog, saves, ui, audio };
}
