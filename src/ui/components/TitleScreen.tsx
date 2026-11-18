import { useRef, useState } from 'react';
import { newGame, type GameState } from '../../domain';
import { SaveError } from '../../application/saveGame';
import { readTextFile } from '../../infrastructure/fileTransfer';
import type { Runtime } from '../../runtime';
import { AudioControls } from './AudioControls';

export function TitleScreen({ rt, onStart }: { rt: Runtime; onStart: (state: GameState) => void }) {
  const [name, setName] = useState('Sam Rivera');
  const [error, setError] = useState<string | null>(null);
  const latest = rt.saves.latest();
  const fileInput = useRef<HTMLInputElement>(null);

  const start = () => {
    const seed = Math.floor(Math.random() * 2 ** 31);
    onStart(newGame(name.trim().slice(0, 20) || 'Sam Rivera', seed));
  };

  const importSave = async (file: File | undefined) => {
    if (!file) return;
    try {
      onStart(rt.saves.importFile(await readTextFile(file)));
    } catch (err) {
      setError(err instanceof SaveError ? err.message : 'Could not read that file.');
    }
  };

  return (
    <div className="title-screen">
      <div className="title-logo">
        <span className="tone-bad">&lt;&lt;&lt;&lt;</span> MERGE CONFLICT <span className="tone-good">&gt;&gt;&gt;&gt;</span>
      </div>
      <p className="title-tag">An RPG about a junior developer in the AI era.</p>
      <p className="muted small">Day one at Lumen Ledger. Your laptop has not arrived. A bug has.</p>

      <form
        className="panel title-menu"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        <label className="small" htmlFor="hero-name">
          Your name
        </label>
        <input id="hero-name" className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" type="submit">
          New game
        </button>
        {latest && (
          <button type="button" className="btn" onClick={() => onStart(rt.saves.load(latest.slot))}>
            Continue ({latest.heroName}, LV{latest.level})
          </button>
        )}
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          Import save file
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => importSave(e.target.files?.[0])} />
        {error && <p className="small tone-bad">{error}</p>}
        <AudioControls rt={rt} compact />
      </form>
      <p className="muted small footer-note">Saves stay in this browser. Export them from the menu to keep a file.</p>
    </div>
  );
}
