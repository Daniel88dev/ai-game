import { useSyncExternalStore } from 'react';
import type { GameState } from '../domain';
import type { Runtime } from '../runtime';

export const useGameState = (rt: Runtime): GameState => useSyncExternalStore(rt.game.subscribe, rt.game.getState);
export const useUi = (rt: Runtime) => useSyncExternalStore(rt.ui.subscribe, rt.ui.get);
export const useBattleLog = (rt: Runtime) => useSyncExternalStore(rt.battleLog.subscribe, rt.battleLog.getLines);
