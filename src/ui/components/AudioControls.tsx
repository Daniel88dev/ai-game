import type { Runtime } from '../../runtime';
import { useAudioSettings } from '../hooks';

/** Music and sound effect switches with volume sliders. Saved per browser, not in the save file. */
export function AudioControls({ rt, compact = false }: { rt: Runtime; compact?: boolean }) {
  const s = useAudioSettings(rt);
  return (
    <div className={`audio-controls${compact ? ' audio-compact' : ''}`}>
      <div className="audio-row">
        <button
          type="button"
          className={`btn btn-small audio-toggle${s.musicOn ? ' is-on' : ''}`}
          aria-pressed={s.musicOn}
          onClick={() => rt.audio.toggleMusic()}
          title="Toggle music [M]"
        >
          Music {s.musicOn ? 'ON' : 'OFF'}
        </button>
        <input
          className="audio-slider"
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(s.musicVolume * 100)}
          disabled={!s.musicOn}
          aria-label="Music volume"
          onChange={(e) => rt.audio.update({ musicVolume: Number(e.target.value) / 100 })}
        />
      </div>
      <div className="audio-row">
        <button
          type="button"
          className={`btn btn-small audio-toggle${s.sfxOn ? ' is-on' : ''}`}
          aria-pressed={s.sfxOn}
          onClick={() => rt.audio.toggleSfx()}
          title="Toggle sound effects"
        >
          Sound FX {s.sfxOn ? 'ON' : 'OFF'}
        </button>
        <input
          className="audio-slider"
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(s.sfxVolume * 100)}
          disabled={!s.sfxOn}
          aria-label="Sound effects volume"
          onChange={(e) => rt.audio.update({ sfxVolume: Number(e.target.value) / 100 })}
          // Let the player hear the new level.
          onPointerUp={() => rt.audio.play('select')}
          onKeyUp={() => rt.audio.play('select')}
        />
      </div>
    </div>
  );
}
