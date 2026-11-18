import { useRef, useState, type ReactNode } from 'react';
import { getCharacter, getQuestLog, modeOf, type QuestStatus } from '../../domain';
import { canSave, SaveError, type SaveSummary } from '../../application/saveGame';
import { downloadTextFile, readTextFile } from '../../infrastructure/fileTransfer';
import type { Runtime } from '../../runtime';
import { useGameState, useUi } from '../hooks';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span>{title}</span>
          <button className="btn btn-small btn-ghost" onClick={onClose} aria-label="Close">
            Esc
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

export function MenuPanel({ rt, onQuit }: { rt: Runtime; onQuit: () => void }) {
  const state = useGameState(rt);
  const [saves, setSaves] = useState<SaveSummary[]>(() => rt.saves.list());
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const inBattle = modeOf(state) === 'battle';

  const guard = (f: () => void) => {
    try {
      f();
    } catch (err) {
      setMessage({ text: err instanceof SaveError ? err.message : 'Something went wrong.', bad: true });
    }
  };

  const save = () =>
    guard(() => {
      rt.saves.save(state, 'manual');
      setSaves(rt.saves.list());
      setMessage({ text: 'Game saved.' });
    });

  const load = (s: SaveSummary) =>
    guard(() => {
      rt.game.reset(rt.saves.load(s.slot));
      rt.ui.close();
      rt.ui.toast(`Loaded ${s.slot} save`, 'good');
    });

  const exportSave = () =>
    guard(() => {
      const file = rt.saves.exportFile(state);
      downloadTextFile(file.filename, file.content);
      setMessage({ text: `Exported ${file.filename}` });
    });

  const importSave = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = rt.saves.importFile(await readTextFile(file));
      rt.game.reset(imported);
      rt.ui.close();
      rt.ui.toast(`Imported save: ${imported.hero.name}, level ${imported.hero.level}`, 'good');
    } catch (err) {
      setMessage({ text: err instanceof SaveError ? err.message : 'Could not read that file.', bad: true });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <Modal title="Menu" onClose={() => rt.ui.close()}>
      <div className="menu-grid">
        <button className="btn" onClick={() => rt.ui.open('questBoard')}>
          Jira board <kbd>Q</kbd>
        </button>
        <button className="btn" onClick={() => rt.ui.open('character')}>
          Character <kbd>C</kbd>
        </button>
        <button className="btn" onClick={save} disabled={!canSave(state)} title={inBattle ? 'Finish the fight first' : ''}>
          Save game
        </button>
        <button className="btn" onClick={exportSave} disabled={!canSave(state)}>
          Export save file
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          Import save file
        </button>
        <button className="btn" onClick={() => rt.ui.open('help')}>
          How to play
        </button>
      </div>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => importSave(e.target.files?.[0])} />

      <h3 className="section-title">Load</h3>
      {saves.length === 0 ? (
        <p className="muted small">No saves in this browser yet.</p>
      ) : (
        <ul className="save-list">
          {saves.map((s) => (
            <li key={s.slot}>
              <button className="btn btn-row" onClick={() => load(s)}>
                <span>{s.slot === 'auto' ? 'Autosave' : 'Manual save'}</span>
                <span className="muted small">
                  {s.heroName}, LV{s.level} · {fmt(s.savedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className={`small ${message.bad ? 'tone-bad' : 'tone-good'}`}>{message.text}</p>}
      <div className="menu-footer">
        <button className="btn btn-ghost btn-small" onClick={onQuit}>
          Quit to title
        </button>
      </div>
    </Modal>
  );
}

const COLUMNS: { status: QuestStatus; label: string }[] = [
  { status: 'todo', label: 'To Do' },
  { status: 'inProgress', label: 'In Progress' },
  { status: 'codeReview', label: 'Code Review' },
  { status: 'done', label: 'Done' },
];

export function QuestBoardPanel({ rt }: { rt: Runtime }) {
  const log = getQuestLog(useGameState(rt));
  return (
    <Modal title="LUM board · Sprint 1" onClose={() => rt.ui.close()}>
      {log.length === 0 && <p className="muted small">Nothing assigned to you yet. Priya (PM) usually hangs around the meeting table.</p>}
      <div className="kanban">
        {COLUMNS.map((c) => (
          <div key={c.status} className="kanban-col">
            <div className="kanban-head">{c.label}</div>
            {log
              .filter((q) => q.status === c.status)
              .map((q) => (
                <article key={q.id} className="card">
                  <div className="card-top">
                    <span className="ticket-key">{q.id}</span>
                    <span className="chip chip-bug">{q.type}</span>
                    <span className="points">{q.storyPoints} SP</span>
                  </div>
                  <div className="card-title">{q.title}</div>
                  <p className="small muted">{q.description}</p>
                  <ul className="criteria">
                    {q.acceptanceCriteria.map((a) => (
                      <li key={a.text} className={a.met ? 'met' : ''}>
                        {a.text}
                      </li>
                    ))}
                  </ul>
                  <div className="small muted">Reporter: {q.giver}</div>
                </article>
              ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function CharacterPanel({ rt }: { rt: Runtime }) {
  const state = useGameState(rt);
  const view = getCharacter(state);
  const leanPct = 50 + view.leaning * 50;
  return (
    <Modal title={`${state.hero.name} · Level ${state.hero.level}`} onClose={() => rt.ui.close()}>
      <p className="small">
        {view.unspentPoints > 0 ? (
          <span className="tone-good">You have {view.unspentPoints} attribute point(s) to spend.</span>
        ) : (
          <span className="muted">Level up to earn attribute points.</span>
        )}
      </p>
      <table className="attr-table">
        <tbody>
          {view.attributes.map((a) => (
            <tr key={a.id}>
              <td className="attr-name">{a.label}</td>
              <td className="attr-value">{a.value}</td>
              <td className="small muted">{a.effect}</td>
              <td>
                <button
                  className="btn btn-small"
                  disabled={!a.canRaise}
                  onClick={() => rt.game.dispatch({ type: 'SpendAttributePoint', attribute: a.id })}
                  aria-label={`Raise ${a.label}`}
                >
                  +
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="section-title">How you work</h3>
      <div className="leaning">
        <span className="small">Craft</span>
        <div className="leaning-track">
          <div className="leaning-dot" style={{ left: `${leanPct}%` }} />
        </div>
        <span className="small tone-ai">AI</span>
      </div>
      <p className="small muted">Reading stack traces and asking questions lean Craft. Asking PILOT leans AI. Both paths are valid.</p>
    </Modal>
  );
}

export function HelpPanel({ rt }: { rt: Runtime }) {
  return (
    <Modal title="How to play" onClose={() => rt.ui.close()}>
      <ul className="help">
        <li><kbd>WASD</kbd> / <kbd>arrows</kbd> walk, <kbd>E</kbd> / <kbd>Space</kbd> talk or use things.</li>
        <li><kbd>1</kbd>-<kbd>4</kbd> pick dialogue options and battle actions, <kbd>R</kbd> retreats.</li>
        <li><kbd>Q</kbd> Jira board, <kbd>C</kbd> character, <kbd>Esc</kbd> menu (save, load, export, import).</li>
        <li>Talk to <b>Priya</b> (PM) for a ticket. Fix the bug, then come back so she can merge it.</li>
        <li>Bugs with a null shell dodge blind fixes. <b>Read the stack trace</b> first, then <b>Debug</b>.</li>
        <li><b>Ask PILOT</b> hits hard but costs tokens and sometimes hallucinates.</li>
        <li>The <b>coffee machine</b> by the window heals you and autosaves.</li>
      </ul>
    </Modal>
  );
}

export function Panels({ rt, onQuit }: { rt: Runtime; onQuit: () => void }) {
  const { panel } = useUi(rt);
  switch (panel) {
    case 'menu':
      return <MenuPanel rt={rt} onQuit={onQuit} />;
    case 'questBoard':
      return <QuestBoardPanel rt={rt} />;
    case 'character':
      return <CharacterPanel rt={rt} />;
    case 'help':
      return <HelpPanel rt={rt} />;
    case 'none':
      return null;
  }
}

