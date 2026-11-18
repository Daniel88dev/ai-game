import { useEffect } from 'react';
import { getBattle, type HeroAction } from '../../domain';
import type { Runtime } from '../../runtime';
import { useBattleLog, useGameState, useUi } from '../hooks';

export function BattlePanel({ rt }: { rt: Runtime }) {
  const view = getBattle(useGameState(rt));
  const log = useBattleLog(rt);
  const { busy } = useUi(rt);

  const act = (action: HeroAction) => {
    if (!rt.ui.get().busy) rt.game.dispatch({ type: 'TakeBattleAction', action });
  };
  const close = () => {
    if (!rt.ui.get().busy) rt.game.dispatch({ type: 'CloseBattle' });
  };

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if (rt.ui.inputBlocked()) return;
      if (view.phase !== 'heroTurn') {
        if (e.key === 'Enter') {
          e.preventDefault();
          close();
        }
        return;
      }
      const n = Number(e.key);
      const a = Number.isInteger(n) && n >= 1 ? view.actions[n - 1] : undefined;
      if (a?.enabled) act(a.id);
      if (e.key.toLowerCase() === 'r') act('retreat');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!view) return null;
  const over = view.phase !== 'heroTurn';

  return (
    <div className="battle-ui">
      <div className="panel battle-log" aria-live="polite">
        {log.map((l, i) => (
          <div key={`${i}-${l.text}`} className={`log-line tone-${l.tone}`}>
            {l.text}
          </div>
        ))}
      </div>
      <div className="panel battle-actions">
        {over && !busy ? (
          <div className="battle-result">
            <div className={`result-title result-${view.phase}`}>
              {view.phase === 'won' ? 'Bug fixed!' : view.phase === 'lost' ? 'Build failed' : 'Changes stashed'}
            </div>
            <p className="small muted">
              {view.phase === 'won'
                ? 'The ticket moved to Code Review. Tell Priya.'
                : view.phase === 'lost'
                  ? 'You wake up at your desk with half HP. Grab a coffee and try again.'
                  : 'The bug is still there. Come back when you are ready.'}
            </p>
            <button className="btn" onClick={close} autoFocus>
              Continue <kbd>Enter</kbd>
            </button>
          </div>
        ) : (
          <>
            <div className="actions-grid">
              {view.actions.map((a, i) => (
                <button
                  key={a.id}
                  className={`btn action action-${a.id}`}
                  disabled={!a.enabled || busy || over}
                  onClick={() => act(a.id)}
                  title={a.reason ?? a.hint}
                >
                  <kbd>{i + 1}</kbd> {a.label}
                  <span className="action-hint">{a.reason ?? a.hint}</span>
                </button>
              ))}
            </div>
            <button className="btn btn-small btn-ghost" disabled={busy || over} onClick={() => act('retreat')}>
              <kbd>R</kbd> Retreat
            </button>
          </>
        )}
      </div>
    </div>
  );
}
