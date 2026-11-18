import { aiTokenCost } from '../combat/battle';
import { accept, reject } from '../shared/result';
import { gradeFor, hallucinationChance, type Cost, type MinigameModule } from './shared';

/**
 * Code Review Duel (design/minigames.md §4), turn-based.
 *
 * Jace's AI-written PR hides a few issues. Each comment costs attention.
 * The right line with the right label scores; the right line with the wrong
 * label scores half; a wrong line is a false positive. Finish by approving
 * or requesting changes. Approving with critical issues ships them.
 */
export type IssueType = 'bug' | 'security' | 'hallucination' | 'nitpick';

export const ISSUE_INFO: Record<IssueType, { label: string; critical: boolean }> = {
  bug: { label: 'Bug', critical: true },
  security: { label: 'Security', critical: true },
  hallucination: { label: 'Made-up API', critical: true },
  nitpick: { label: 'Nitpick', critical: false },
};

export interface DiffLine {
  readonly n: number;
  readonly code: string;
  readonly issue?: { readonly type: IssueType; readonly why: string };
  /** Looks odd but is fine. Shown as suspicious to high-Rigor reviewers too. */
  readonly decoy?: boolean;
}

export const PR_TITLE = 'PR #42 · Show balances in the user\'s currency (jace/currency-format)';

export const DIFF: readonly DiffLine[] = [
  { n: 1, code: "import { formatMoney } from '@lumen/intl-pro';", issue: { type: 'hallucination', why: 'There is no @lumen/intl-pro package. PILOT invented it.' } },
  { n: 2, code: "const RATES_KEY = 'sk_live_51HfQ2b9xLumen';", issue: { type: 'security', why: 'A live API key committed to the repo.' } },
  { n: 3, code: '' },
  { n: 4, code: 'export function renderBalances(accounts, db) {' },
  { n: 5, code: '  const rows = [];' },
  { n: 6, code: '  for (let i = 0; i <= accounts.length; i++) {', issue: { type: 'bug', why: '<= reads one past the end: accounts[length] is undefined.' } },
  { n: 7, code: '    const a = accounts[i];' },
  { n: 8, code: "    const rate = db.query(\"SELECT rate FROM fx WHERE code = '\" + a.currency + \"'\");", issue: { type: 'security', why: 'String-built SQL: injection through the currency code.' } },
  { n: 9, code: '    rows.push(formatMoney(a.balance * rate, a.currency));', decoy: true },
  { n: 10, code: '  }' },
  { n: 11, code: '  // eslint-disable-next-line no-console', decoy: true },
  { n: 12, code: '  let Total_Formatted = rows.length;', issue: { type: 'nitpick', why: 'Naming: totalFormatted, and it is a count, not a total.' } },
  { n: 13, code: '  return { rows, Total_Formatted };' },
  { n: 14, code: '}' },
];

const ISSUES = DIFF.filter((l) => l.issue);
const CRITICAL = ISSUES.filter((l) => ISSUE_INFO[l.issue!.type].critical);

export type CommentOutcome = 'hit' | 'partial' | 'falsePositive';
export type Verdict = 'approve' | 'requestChanges';

export interface ReviewComment {
  readonly line: number;
  readonly type: IssueType;
  readonly outcome: CommentOutcome;
}

export interface ReviewSession {
  readonly kind: 'codeReview';
  readonly questId: string;
  readonly comments: readonly ReviewComment[];
  readonly attentionLeft: number;
  readonly attentionTotal: number;
  /** Rigor 3+: suspicious lines are highlighted (real issues and decoys). */
  readonly heatmap: boolean;
  readonly aiSuggestions: readonly { line: number; type: IssueType }[] | null;
  readonly verdict: Verdict | null;
}

export type ReviewMove =
  | { readonly kind: 'comment'; readonly line: number; readonly type: IssueType }
  | { readonly kind: 'aiPreReview' }
  | { readonly kind: 'verdict'; readonly verdict: Verdict };

type ReviewEventBody =
  | { type: 'ReviewCommented'; line: number; issueType: IssueType; outcome: CommentOutcome }
  | { type: 'ReviewAiSuggested'; suggestions: readonly { line: number; type: IssueType }[] }
  | { type: 'ReviewVerdictGiven'; verdict: Verdict };

export type ReviewEvent = ReviewEventBody & { readonly game: 'codeReview'; readonly cost?: Cost };

const ev = (body: ReviewEventBody, cost?: Cost): ReviewEvent =>
  cost ? { ...body, game: 'codeReview', cost } : { ...body, game: 'codeReview' };

export function isSuspicious(line: DiffLine): boolean {
  return !!line.issue || !!line.decoy;
}

export const codeReview: MinigameModule<ReviewSession, ReviewMove, ReviewEvent> = {
  title: 'Code review: Jace\'s PR',

  start(questId, hero) {
    const attention = 4 + hero.attributes.focus;
    return {
      kind: 'codeReview',
      questId,
      comments: [],
      attentionLeft: attention,
      attentionTotal: attention,
      heatmap: hero.attributes.rigor >= 3,
      aiSuggestions: null,
      verdict: null,
    };
  },

  decide(s, move, hero, rng) {
    if (s.verdict) return reject('The review is submitted');
    switch (move.kind) {
      case 'comment': {
        const line = DIFF.find((l) => l.n === move.line);
        if (!line || !line.code.trim()) return reject('Pick a line with code on it');
        if (s.comments.some((c) => c.line === move.line)) return reject('You already commented on that line');
        if (s.attentionLeft <= 0) return reject('Out of attention. Time to decide.');
        const outcome: CommentOutcome = !line.issue ? 'falsePositive' : line.issue.type === move.type ? 'hit' : 'partial';
        return accept(ev({ type: 'ReviewCommented', line: move.line, issueType: move.type, outcome }));
      }
      case 'aiPreReview': {
        if (s.aiSuggestions) return reject('PILOT already reviewed this PR');
        const cost = aiTokenCost(hero.attributes.orchestration);
        if (hero.tokens < cost) return reject('Not enough tokens');
        const pc = hero.attributes.promptCraft;
        const suggestions: { line: number; type: IssueType }[] = [];
        for (const l of ISSUES) {
          // PILOT is worst at spotting its own kind of mistake.
          const find = l.issue!.type === 'hallucination' ? 0.25 + pc * 0.05 : 0.5 + pc * 0.06;
          if (rng.chance(Math.min(0.95, find))) suggestions.push({ line: l.n, type: l.issue!.type });
        }
        if (rng.chance(hallucinationChance(pc))) suggestions.push({ line: 9, type: 'bug' });
        if (rng.chance(hallucinationChance(pc))) suggestions.push({ line: 5, type: 'nitpick' });
        return accept(ev({ type: 'ReviewAiSuggested', suggestions: suggestions.sort((a, b) => a.line - b.line) }, { tokens: cost }));
      }
      case 'verdict':
        return accept(ev({ type: 'ReviewVerdictGiven', verdict: move.verdict }));
    }
  },

  evolve(s, e) {
    switch (e.type) {
      case 'ReviewCommented':
        return {
          ...s,
          comments: [...s.comments, { line: e.line, type: e.issueType, outcome: e.outcome }],
          attentionLeft: s.attentionLeft - 1,
        };
      case 'ReviewAiSuggested':
        return { ...s, aiSuggestions: e.suggestions };
      case 'ReviewVerdictGiven':
        return { ...s, verdict: e.verdict };
    }
  },

  isOver: (s) => s.verdict !== null,

  result(s) {
    const found = (l: DiffLine) => s.comments.find((c) => c.line === l.n && c.outcome !== 'falsePositive');
    let points = 0;
    for (const l of ISSUES) {
      const c = found(l);
      if (!c) continue;
      const full = ISSUE_INFO[l.issue!.type].critical ? 20 : 5;
      points += c.outcome === 'hit' ? full : full / 2;
    }
    const falsePositives = s.comments.filter((c) => c.outcome === 'falsePositive').length;
    points -= falsePositives * 8;
    const missed = CRITICAL.filter((l) => !found(l));
    const summary: string[] = [];
    if (s.verdict === 'approve') {
      points -= missed.length * 15;
      summary.push(missed.length ? `You approved it. ${missed.length} critical issue(s) went to main.` : 'You approved it, after every critical issue was fixed.');
    } else {
      if (CRITICAL.some((l) => found(l))) points += 10;
      summary.push('You requested changes. Jace grumbles, then fixes them.');
    }
    if (falsePositives) summary.push(`${falsePositives} comment(s) on lines that were fine. Jace noticed.`);
    for (const l of missed) summary.push(`Missed line ${l.n}: ${l.issue!.why}`);
    const max = CRITICAL.length * 20 + (ISSUES.length - CRITICAL.length) * 5 + 10;
    const score = Math.max(0, Math.min(100, Math.round((points / max) * 100)));
    return { score, grade: gradeFor(score), summary };
  },
};
