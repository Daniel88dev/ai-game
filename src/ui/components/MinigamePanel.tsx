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
  type TypingView,
  type AuditView,
  type TypingMove,
  type AuditMove,
  type PackageVerdict,
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
        {view.kind === 'typing' && <TypingGame view={view} play={play} rt={rt} />}
        {view.kind === 'packageAudit' && <AuditGame view={view} play={play} />}
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
        {view.slowdown > 0 && <Hint>{view.aiName}'s sleep(5) calls make each run {view.slowdown} min slower.</Hint>}
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
                Ask {view.aiName} ({view.aiCost} tokens)
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
            {view.aiName}: generate tests ({view.aiCost} tokens)
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
              {l.ai && <span className="chip chip-ai">{view.aiName}: {label(l.ai)}?</span>}
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
          {view.aiName} pre-review ({view.aiCost} tokens)
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

// ------------------------------------------------------------------ Typing Sprint

function TypingGame({ view, play, rt }: { view: TypingView; play: (m: MinigameMove) => void; rt: Runtime }) {
  const locked = view.over;
  const [flash, setFlash] = useState(false);

  // The clock lives in the UI; the domain only counts `tick` moves, so it stays pure and replayable.
  useEffect(() => {
    if (locked) return;
    const id = window.setInterval(() => {
      if (rt.ui.inputBlocked()) return; // paused while a menu is open
      rt.game.dispatch({ type: 'PlayMinigame', move: { game: 'typing', kind: 'tick' } });
    }, 1000);
    return () => window.clearInterval(id);
  }, [rt, locked]);

  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || rt.ui.inputBlocked()) return;
      e.preventDefault();
      const r = rt.game.dispatch({ type: 'PlayMinigame', move: { game: 'typing', kind: 'key', char: e.key } });
      const typo = r.ok && r.events.some((ev) => ev.type === 'TypingKeyHit' && !ev.correct);
      if (typo) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 120);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rt, locked]);

  const ty = (m: TypingMove) => play({ game: 'typing', ...m });
  const accuracy = view.keystrokes === 0 ? 100 : Math.round(((view.keystrokes - view.typos) / view.keystrokes) * 100);

  return (
    <div className="typing">
      <div className="typing-editor">
        <div className="typing-file small">{view.file}</div>
        {view.lines.map((l, i) => {
          const active = i === view.current && !locked;
          return (
            <div key={i} className={`typing-line ${active ? 'active' : ''} ${i > view.current ? 'later' : ''} ${active && flash ? 'typo' : ''}`}>
              <span className="diff-n">{i + 1}</span>
              <code>
                {l.by === 'ai' ? (
                  <span className={l.hallucinated ? 'typed-bad' : 'typed-ai'}>{l.text}</span>
                ) : (
                  <>
                    <span className="typed-ok">{l.text.slice(0, l.typed)}</span>
                    {active && <span className="caret">{l.text[l.typed] === ' ' ? '\u00a0' : l.text[l.typed]}</span>}
                    <span className="untyped">{l.text.slice(l.typed + (active ? 1 : 0))}</span>
                  </>
                )}
              </code>
              {l.by === 'ai' && <span className={`chip ${l.hallucinated && locked ? 'chip-bad' : 'chip-ai'}`}>{view.aiName}</span>}
            </div>
          );
        })}
      </div>
      <div className="review-side">
        <Meter label="Time" value={view.secondsLeft} max={view.secondsTotal} tone="time" suffix="s" />
        <div className="small">
          Accuracy {accuracy}% · {view.typos} typo(s)
        </div>
        <Hint>
          Type the highlighted line on your keyboard. A wrong key is a typo and does not move you forward. Spaces and punctuation count.
        </Hint>
        <button className="btn btn-small action-askAi" disabled={locked || !view.canAffordAi} onClick={() => ty({ kind: 'aiComplete' })}>
          {view.aiName}: autocomplete this line ({view.aiCost} tokens)
        </button>
        <Hint>Autocomplete is instant, but sometimes it writes something plausible and wrong. Read what it wrote: a wrong line costs you at the end.</Hint>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Package Audit

const TRUTH_LABEL: Record<string, string> = {
  used: 'real and used',
  unused: 'real but unused',
  typosquat: 'typosquat',
  hallucinated: 'does not exist',
  malicious: 'malware',
};

function AuditGame({ view, play }: { view: AuditView; play: (m: MinigameMove) => void }) {
  const [selected, setSelected] = useState<string>(view.packages[0]!.id);
  const locked = view.over;
  const au = (m: AuditMove) => play({ game: 'packageAudit', ...m });
  const pkg = view.packages.find((p) => p.id === selected)!;
  const setVerdict = (verdict: PackageVerdict) => au({ kind: 'setVerdict', packageId: pkg.id, verdict });

  return (
    <div className="review">
      <div className="review-diff">
        <div className="small review-title">package.json · dependencies</div>
        {view.packages.map((p) => (
          <button
            key={p.id}
            className={`diff-line audit-line ${selected === p.id ? 'selected' : ''} ${p.typoHint ? 'suspicious' : ''} verdict-${p.verdict}`}
            onClick={() => setSelected(p.id)}
          >
            <span className={`light ${p.verdict === 'remove' ? 'light-failed' : 'light-passed'}`} />
            <code>
              "{p.name}": "^{p.version}"
            </code>
            <span className="diff-notes">
              {p.wren && <span className="chip chip-ai">{view.aiName}: {p.wren.says}</span>}
              <span className={`chip ${p.verdict === 'remove' ? 'chip-bad' : 'chip-comment'}`}>{p.verdict}</span>
            </span>
            {p.truth && (
              <span className={`diff-reveal small ${(p.truth === 'used') === (p.verdict === 'keep') ? 'reveal-ok' : 'reveal-bad'}`}>
                Really: {TRUTH_LABEL[p.truth]}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="review-side">
        <Meter label="Checks" value={view.checksLeft} max={view.checksTotal} tone="time" />
        <div className="ci-actions">
          <div className="small">
            <span className="ticket-key">{pkg.name}</span> {pkg.version}
          </div>
          {pkg.typoHint && <div className="small tone-warn">{pkg.typoHint}</div>}
          <div className="small audit-info">
            <b>Registry:</b> {pkg.registry ?? <span className="muted">not checked</span>}
          </div>
          <div className="small audit-info">
            <b>Source:</b> {pkg.source ?? <span className="muted">not read</span>}
          </div>
          {pkg.wren && (
            <div className="small audit-info tone-ai">
              {view.aiName}: "{pkg.wren.why}"
            </div>
          )}
          <div className="ci-tools">
            <button
              className="btn btn-small"
              disabled={locked || pkg.registry !== null || view.checksLeft < view.registryCost}
              onClick={() => au({ kind: 'checkRegistry', packageId: pkg.id })}
            >
              Check registry ({view.registryCost})
            </button>
            <button
              className="btn btn-small"
              disabled={locked || pkg.source !== null || view.checksLeft < view.sourceCost}
              onClick={() => au({ kind: 'readSource', packageId: pkg.id })}
            >
              Read source ({view.sourceCost})
            </button>
          </div>
          <div className="ci-tools">
            <button className={`btn btn-small ${pkg.verdict === 'keep' ? 'btn-primary' : 'btn-ghost'}`} disabled={locked} onClick={() => setVerdict('keep')}>
              Keep
            </button>
            <button className={`btn btn-small ${pkg.verdict === 'remove' ? 'btn-primary' : 'btn-ghost'}`} disabled={locked} onClick={() => setVerdict('remove')}>
              Remove
            </button>
          </div>
        </div>
        <button className="btn btn-small action-askAi" disabled={locked || view.wrenUsed || !view.canAffordAi} onClick={() => au({ kind: 'askWren' })}>
          {view.aiName}: audit everything ({view.aiCost} tokens)
        </button>
        <Hint>Everything starts as "keep". Removing a package the app uses breaks the build. Keeping malware ships it.</Hint>
        <button className="btn btn-small btn-glow" disabled={locked} onClick={() => au({ kind: 'submitAudit' })}>
          Submit the audit
        </button>
      </div>
    </div>
  );
}
