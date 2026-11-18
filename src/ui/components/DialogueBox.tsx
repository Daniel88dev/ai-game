import { useEffect } from 'react';
import { getDialogue } from '../../domain';
import type { Runtime } from '../../runtime';
import { useGameState } from '../hooks';
import { spriteDataUrl } from '../spriteImage';

export function DialogueBox({ rt }: { rt: Runtime }) {
  const view = getDialogue(useGameState(rt));

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if (rt.ui.inputBlocked()) return;
      const n = Number(e.key);
      const pick = Number.isInteger(n) && n >= 1 ? view.options[n - 1] : e.key === 'Enter' && view.options.length === 1 ? view.options[0] : undefined;
      if (pick) {
        e.preventDefault();
        rt.game.dispatch({ type: 'ChooseDialogueOption', optionId: pick.id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rt, view]);

  if (!view) return null;
  return (
    <div className="panel dialogue" role="dialog" aria-label={`Conversation with ${view.speaker}`}>
      <div className="dialogue-head">
        <img className="portrait" src={spriteDataUrl(`npc_${view.npcId}_down_0`)} alt="" />
        <div>
          <div className="speaker">{view.speaker}</div>
          <div className="muted small">{view.role}</div>
        </div>
      </div>
      <p className="dialogue-text">{view.text}</p>
      <ol className="options">
        {view.options.map((o, i) => (
          <li key={o.id}>
            <button className="option" data-sfx="none" onClick={() => rt.game.dispatch({ type: 'ChooseDialogueOption', optionId: o.id })}>
              <kbd>{i + 1}</kbd> {o.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
