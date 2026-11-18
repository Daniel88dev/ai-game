import { useEffect, useState, type ReactNode } from 'react';
import {
  getMinigame,
  type CiMove,
  type CoverageMove,
  type ReviewMove,
  type CiView,
  type CoverageView,
  type IssueType,
  type MinigameMove,
  type MinigameView,
  type ReviewView,
} from '../../domain';
import type { Runtime } from '../../runtime';
import { useGameState } from '../hooks';

/**
 * Minigame screens. Pure views over the `getMinigame` read model;
 * every click becomes a PlayMinigame command.
 */
export function MinigamePanel({ rt }: { rt: Runtime }) {
  const view = getMinigame(useGameState(rt));

  const play = (move: MinigameMove) => {
    const r = rt.game.dispatch({ type: 'PlayMinigame', move });
    if (!r.ok && r.reason) rt.ui.toast(r.reason, 'bad');
  };
  const close = () => rt.game.dispatch({ type: 'CloseMinigame' });

  useEffect(() => {
    if (!view?.over) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !rt.ui.inputBlocked()) {
        e.preventDefault();
        rt.game.dispatch({ type: 'CloseMinigame' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rt, view?.over]);

  if (!view) return null;
  return (
    <div className={`panel minigame minigame-${view.kind}`} role="dialog" aria-label={view.title}>
      <div className="mg-head">
        <div>
          <div className="mg-title">{view.title}</div>
          <div className="small muted">
            <span className="ticket-key">{view.questId}</span> {view.questTitle}
          </div>
        </div>
        <div className="mg-resources small">
          <span className="tone-focus">FOC {view.focus}</span>
          <span className="tone-token">{view.tokens} tokens</span>
        </div>
      </div>
      <div className="mg-body">
        {view.kind === 'ciPipeline' && <CiGame view={view} play={play} />}
        {view.kind === 'coverage' && <CoverageGame view={view} play={play} />}
        {view.kind === 'codeReview' && <ReviewGame view={view} play={play} />}
      </div>
      {view.result && <ResultBar view={view} onClose={close} />}
    </div>
  );
}

function ResultBar({ view, onClose }: { view: MinigameView; onClose: () => void }) {
  const r = view.result!;
  return (
    <div className="mg-result">
      <div className={`grade grade-${r.grade}`}>{r.grade}</div>
      <div className="mg-summary">
        <div className={r.passed ? 'tone-good' : 'tone-bad'}>
          {r.passed ? `Passed. ${view.questId} moves to Code Review.` : 'Not good enough yet. Talk to the ticket owner to try again.'}
        </div>
        {r.summary.map((line) => (
          <div key={line} className="small muted">
            {line}
          </div>
        ))}
      </div>
      <button className="btn" onClick={onClose} autoFocus>
        Back to the office <kbd>Enter</kbd>
      </button>
    </div>
  );
}

function Meter({ label, value, max, tone, suffix = '' }: { label: string; value: number; max: number; tone: string; suffix?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`mg-meter meter-${tone}`}>
      <span className="small">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="small">
        {value}
        {suffix}
      </span>
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="small muted mg-hint">{children}</p>;
}

// ------------------------------------------------------------------ CI Pipeline

function CiGame({ view, play }: { view: CiView; play: (m: MinigameMove) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const test = view.tests.find((t) => t.id === selected) ?? null;
  const locked = view.over;
  const ci = (m: CiMove) => play({ game: 'ciPipeline', ...m });

  return (
    <div className="ci">
      <div className="ci-left">
        <Meter label="Release in" value={view.minutesLeft} max={view.minutesTotal} tone="time" suffix=" min" />
        <ul className="ci-tests">
          {view.tests.map((t) => (
            <li key={t.id}>
              <button className={`ci-test ${selected === t.id ? 'selected' : ''}`} onClick={() => setSelected(t.id)} disabled={locked}>
                <span className={`light light-${t.handled ?? t.status}`} />
                <span className="ci-name">{t.name}</span>
                <span className="ci-state small">
                  {t.handled === 'fixed' ? 'fixed' : t.handled === 'quarantined' ? 'quarantined' : t.status === 'unknown' ? 'not run' : t.status}
                </span>
                {t.diagnosis && <span className="ci-diag small">{t.diagnosis}</span>}
                {t.looksReal && !t.diagnosis && <span className="ci-diag small tone-warn">Fails every run. Rigor says: this is no flake.</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="ci-right">
        <button className="btn btn-run" disabled={locked} onClick={() => ci({ kind: 'run' })}>
          Run pipeline ({view.runCost} min)
        </button>
        {view.slowdown > 0 && <Hint>PILOT's sleep(5) calls make each run {view.slowdown} min slower.</Hint>}
        {!test ? (
          <Hint>Run the pipeline, then pick a red test. Diagnose it (1 min, 1 Focus) and apply the fix that matches the cause. Re-running until green wastes the clock.</Hint>
        ) : test.handled ? (
          <Hint>{test.name} is {test.handled}.</Hint>
        ) : (
          <div className="ci-actions">
            <div className="small">{test.name}</div>
            <button className="btn btn-small" disabled={locked || !!test.diagnosis} onClick={() => ci({ kind: 'diagnose', testId: test.id })}>
              Diagnose (1 min{view.focus > 0 ? ', 1 FOC' : ', +2 min, no Focus'})
            </button>
            <div className="ci-tools">
              {view.tools.map((tool) => (
                <button
                  key={tool.id}
                  className="btn btn-small"
                  title={tool.hint}
                  disabled={locked}
                  onClick={() => ci({ kind: 'fix', testId: test.id, tool: tool.id })}
                >
                  {tool.label}
                </button>
              ))}
            </div>
            <div className="ci-tools">
              <button className="btn btn-small btn-ghost" disabled={locked} onClick={() => ci({ kind: 'quarantine', testId: test.id })}>
                Quarantine (1 min)
              </button>
              <button
                className="btn btn-small action-askAi"
                disabled={locked || !view.canAffordAi}
                onClick={() => ci({ kind: 'askPilot', testId: test.id })}
              >
                Ask PILOT ({view.aiCost} tokens)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Coverage Crawl

function CoverageGame({ view, play }: { view: CoverageView; play: (m: MinigameMove) => void }) {
  const locked = view.over;
  const cov = (m: CoverageMove) => play({ game: 'coverage', ...m });
  return (
    <div className="cov">
      <div className="cov-left">
        <div className="cov-fn small">function {view.functionName} {'{'}</div>
        {view.branches.map((b) => (
          <div key={b.id} className={`cov-branch ${b.lit ? 'lit' : 'dark'} ${b.killed ? 'killed' : ''}`}>
            <code className="small">{b.lit ? b.code : b.code.replace(/[^ ]/g, '▒')}</code>
            <span className="cov-side small">
              {b.killed ? (
                <span className="tone-good">mutant dead</span>
              ) : b.lit ? (
                <button className="btn btn-small" disabled={locked} onClick={() => cov({ kind: 'assert', branchId: b.id })}>
                  Assert
                </button>
              ) : (
                <span className="muted">{b.lines} lines</span>
              )}
            </span>
            {b.mutant && <span className="cov-mutant small muted">mutant: {b.mutant}</span>}
          </div>
        ))}
        <div className="cov-fn small">{'}'}</div>
      </div>
      <div className="cov-right">
        <Meter label="Coverage" value={view.coverage} max={100} tone="cov" suffix="%" />
        <Meter label="Mutation" value={view.mutation} max={100} tone="mut" suffix="%" />
        <div className="small">
          Moves left: <span className="tone-warn">{view.movesLeft}</span>/{view.movesTotal}
        </div>
        <div className="cov-cards">
          {view.cards.map((c) => (
            <button
              key={c.id}
              className={`btn btn-small cov-card ${c.played ? 'played' : ''}`}
              disabled={locked || c.played}
              onClick={() => cov({ kind: 'playInput', cardId: c.id })}
              title={c.reaches ? `Runs: ${c.reaches.join(', ')}` : 'Raise Logic or Domain Insight to see where this input goes'}
            >
              {c.label}
              <span className="action-hint">{c.reaches ? `-> ${c.reaches.length} branch${c.reaches.length > 1 ? 'es' : ''}` : '-> ?'}</span>
            </button>
          ))}
        </div>
        <div className="ci-tools">
          <button
            className="btn btn-small action-askAi"
            disabled={locked || view.generatedUsed || !view.canAffordAi}
            onClick={() => cov({ kind: 'generateTests' })}
          >
            PILOT: generate tests ({view.aiCost} tokens)
          </button>
          <button className="btn btn-small" disabled={locked} onClick={() => cov({ kind: 'submit' })}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Code Review

const REVIEW_KEYS: IssueType[] = ['bug', 'security', 'hallucination', 'nitpick'];

function ReviewGame({ view, play }: { view: ReviewView; play: (m: MinigameMove) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const locked = view.over;
  const rv = (m: ReviewMove) => play({ game: 'codeReview', ...m });
  const label = (t: IssueType) => view.issueTypes.find((x) => x.id === t)!.label;
  const line = view.lines.find((l) => l.n === selected);

  useEffect(() => {
    if (locked || selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = REVIEW_KEYS[Number(e.key) - 1];
      if (t) {
        rv({ kind: 'comment', line: selected, type: t });
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="review">
      <div className="review-diff">
        <div className="small review-title">{view.prTitle}</div>
        {view.lines.map((l) => (
          <button
            key={l.n}
            className={`diff-line ${l.suspicious ? 'suspicious' : ''} ${selected === l.n ? 'selected' : ''} ${l.comment ? 'commented' : ''}`}
            disabled={locked || !l.code.trim() || !!l.comment}
            onClick={() => setSelected(l.n)}
          >
            <span className="diff-n">{l.n}</span>
            <code>+ {l.code}</code>
            <span className="diff-notes">
              {l.ai && <span className="chip chip-ai">PILOT: {label(l.ai)}?</span>}
              {l.comment && (
                <span className={`chip chip-comment ${l.comment.outcome ? `outcome-${l.comment.outcome}` : ''}`}>you: {label(l.comment.type)}</span>
              )}
            </span>
            {l.reveal && <span className="diff-reveal small">{l.reveal}</span>}
          </button>
        ))}
      </div>
      <div className="review-side">
        <Meter label="Attention" value={view.attentionLeft} max={view.attentionTotal} tone="time" />
        {line ? (
          <div className="ci-actions">
            <div className="small">Line {line.n}: what is wrong?</div>
            {REVIEW_KEYS.map((t, i) => (
              <button
                key={t}
                className="btn btn-small"
                disabled={locked || view.attentionLeft <= 0}
                onClick={() => {
                  rv({ kind: 'comment', line: line.n, type: t });
                  setSelected(null);
                }}
              >
                <kbd>{i + 1}</kbd> {label(t)}
              </button>
            ))}
          </div>
        ) : (
          <Hint>
            Click a line to comment on it. Every comment costs attention. Comments on lines that are fine annoy Jace.
            {view.heatmap ? ' Your Rigor highlights lines that look off. Not all of them are wrong.' : ''}
          </Hint>
        )}
        <button className="btn btn-small action-askAi" disabled={locked || view.aiUsed || !view.canAffordAi} onClick={() => rv({ kind: 'aiPreReview' })}>
          PILOT pre-review ({view.aiCost} tokens)
        </button>
        <div className="ci-tools">
          <button className="btn btn-small" disabled={locked} onClick={() => rv({ kind: 'verdict', verdict: 'requestChanges' })}>
            Request changes
          </button>
          <button className="btn btn-small btn-ghost" disabled={locked} onClick={() => rv({ kind: 'verdict', verdict: 'approve' })}>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
