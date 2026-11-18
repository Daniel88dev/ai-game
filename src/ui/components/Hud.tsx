import { getHud, getInteractionHint } from '../../domain';
import type { Runtime } from '../../runtime';
import { useGameState } from '../hooks';
import { Bar } from './Bar';

export function Hud({ rt }: { rt: Runtime }) {
  const state = useGameState(rt);
  const hud = getHud(state);
  const hint = getInteractionHint(state);
  if (hud.mode === 'battle' || hud.mode === 'minigame') return null;

  return (
    <>
      <div className="panel hud">
        <div className="hud-title">
          {hud.name} <span className="muted">LV{hud.level}</span>
        </div>
        <div className="hud-act">
          {hud.act.title.split(':')[0]} · {hud.act.done}/{hud.act.total} tickets
        </div>
        <Bar label="HP" value={hud.hp} max={hud.maxHp} tone="hp" />
        <Bar label="FOC" value={hud.focus} max={hud.maxFocus} tone="focus" />
        <Bar label="XP" value={hud.xp} max={hud.xpToNext} tone="xp" />
        <div className="hud-tokens">
          <span className="token-dot" /> {hud.tokens} tokens <span className="muted small">(budget {hud.tokenAllowance})</span>
        </div>
        {hud.unspentPoints > 0 && (
          <button className="btn btn-small btn-glow" onClick={() => rt.ui.open('character')}>
            +{hud.unspentPoints} points [C]
          </button>
        )}
      </div>

      {hud.activeQuest && (
        <button className="panel ticket" onClick={() => rt.ui.open('questBoard')} title="Open the Jira board [Q]">
          <span className="ticket-key">{hud.activeQuest.id}</span>
          <span className="ticket-title">{hud.activeQuest.title}</span>
          <span className={`chip chip-${hud.activeQuest.status.replace(' ', '').toLowerCase()}`}>{hud.activeQuest.status}</span>
        </button>
      )}

      {hud.mode === 'explore' && (
        <div className="hint">
          {hint ? (
            <span className="panel hint-action">
              <kbd>E</kbd> {hint}
            </span>
          ) : (
            <span className="hint-controls">
              <kbd>WASD</kbd>/<kbd>arrows</kbd> walk · <kbd>E</kbd> interact · <kbd>Q</kbd> board · <kbd>Esc</kbd> menu
            </span>
          )}
        </div>
      )}
    </>
  );
}
