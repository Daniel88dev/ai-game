import { useCallback, useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { modeOf, type GameState } from '../domain';
import type { Runtime } from '../runtime';
import { createPhaserGame } from '../game/createGame';
import { Hud } from './components/Hud';
import { DialogueBox } from './components/DialogueBox';
import { BattlePanel } from './components/BattlePanel';
import { Panels } from './components/Panels';
import { Toasts } from './components/Toasts';
import { TitleScreen } from './components/TitleScreen';
import { useGameState } from './hooks';

export function App({ rt }: { rt: Runtime }) {
  const [playing, setPlaying] = useState(false);

  const start = useCallback(
    (state: GameState) => {
      rt.ui.close();
      rt.game.reset(state);
      setPlaying(true);
    },
    [rt],
  );

  return (
    <div className="screen">
      <div className="stage">
        {playing ? <GameStage rt={rt} onQuit={() => setPlaying(false)} /> : <TitleScreen rt={rt} onStart={start} />}
      </div>
    </div>
  );
}

function GameStage({ rt, onQuit }: { rt: Runtime; onQuit: () => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;
    // Phaser draws text with canvas fonts, so wait for the pixel font first.
    document.fonts.load('8px "Press Start 2P"').finally(() => {
      if (!cancelled && host.current) game = createPhaserGame(host.current, rt);
    });
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [rt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const panel = rt.ui.get().panel;
      if (key === 'escape') {
        e.preventDefault();
        if (panel === 'none') rt.ui.open('menu');
        else rt.ui.close();
      } else if (key === 'q' && (panel === 'none' || panel === 'questBoard')) {
        if (panel === 'none') rt.ui.open('questBoard');
        else rt.ui.close();
      } else if (key === 'c' && (panel === 'none' || panel === 'character')) {
        if (panel === 'none') rt.ui.open('character');
        else rt.ui.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rt]);

  return (
    <>
      <div className="phaser-host" ref={host} />
      <div className="overlay">
        <Hud rt={rt} />
        <DialogueBox rt={rt} />
        <BattlePanel rt={rt} />
        <Toasts rt={rt} />
        <MenuButton rt={rt} />
        <Panels
          rt={rt}
          onQuit={() => {
            rt.ui.close();
            onQuit();
          }}
        />
      </div>
    </>
  );
}

function MenuButton({ rt }: { rt: Runtime }) {
  const state = useGameState(rt);
  if (modeOf(state) === 'battle') return null; // Esc still opens the menu
  return (
    <button className="btn btn-small menu-button" onClick={() => rt.ui.open('menu')}>
      Menu <kbd>Esc</kbd>
    </button>
  );
}
