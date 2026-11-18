import { aiTokenCost } from '../combat/battle';
import { QUESTS } from '../content/quests';
import type { GameState } from '../state';
import { CI_CAUSE_LABEL, CI_TOOLS, RUN_MINUTES, type CiCause, type CiTestStatus, type CiTool } from './ciPipeline';
import { DIFF, ISSUE_INFO, isSuspicious, PR_TITLE, type CommentOutcome, type IssueType } from './codeReview';
import { BRANCHES, CARDS, COVERAGE_FUNCTION, coveragePercent, mutationPercent } from './coverage';
import { PACKAGES, REGISTRY_COST, SOURCE_COST, verdictOf, type PackageTruth, type PackageVerdict } from './packageAudit';
import { typingAiCost, typingTextFor } from './typing';
import { aiName } from '../wren';
import { gradeAtLeast, isMinigameOver, MINIGAME_TITLES, minigameResult, type MinigameResult } from './minigame';

/**
 * Read models for the minigame screens. Hidden information (a test's real
 * cause, which lines have issues, where a card leads) only appears here when
 * the hero has earned it, so the UI cannot leak it by accident.
 */
interface Common {
  title: string;
  questId: string;
  questTitle: string;
  over: boolean;
  result: (MinigameResult & { passed: boolean }) | null;
  tokens: number;
  focus: number;
  aiCost: number;
  canAffordAi: boolean;
  /** PILOT in Act I, WREN once LUM-102 is merged. */
  aiName: string;
}

export interface CiView extends Common {
  kind: 'ciPipeline';
  minutesLeft: number;
  minutesTotal: number;
  runCost: number;
  slowdown: number;
  runs: number;
  tests: {
    id: string;
    name: string;
    status: CiTestStatus;
    handled: 'fixed' | 'quarantined' | null;
    diagnosis: string | null;
    cause: CiCause | null;
    /** Rigor 4+ "this one fails every time" hint. */
    looksReal: boolean;
  }[];
  tools: { id: CiTool; label: string; hint: string }[];
}

export interface CoverageView extends Common {
  kind: 'coverage';
  functionName: string;
  movesLeft: number;
  movesTotal: number;
  coverage: number;
  mutation: number;
  generatedUsed: boolean;
  branches: { id: string; code: string; lines: number; lit: boolean; killed: boolean; mutant: string | null }[];
  cards: { id: string; label: string; played: boolean; reaches: string[] | null }[];
}

export interface ReviewView extends Common {
  kind: 'codeReview';
  prTitle: string;
  attentionLeft: number;
  attentionTotal: number;
  heatmap: boolean;
  aiUsed: boolean;
  lines: {
    n: number;
    code: string;
    suspicious: boolean;
    comment: { type: IssueType; outcome: CommentOutcome | null } | null;
    ai: IssueType | null;
    /** After the review: what was really there. */
    reveal: string | null;
  }[];
  issueTypes: { id: IssueType; label: string; critical: boolean }[];
}

export interface TypingView extends Common {
  kind: 'typing';
  file: string;
  lines: { text: string; typed: number; by: 'you' | 'ai' | null; hallucinated: boolean }[];
  current: number;
  secondsLeft: number;
  secondsTotal: number;
  typos: number;
  keystrokes: number;
}

export interface AuditView extends Common {
  kind: 'packageAudit';
  checksLeft: number;
  checksTotal: number;
  registryCost: number;
  sourceCost: number;
  wrenUsed: boolean;
  packages: {
    id: string;
    name: string;
    version: string;
    registry: string | null;
    source: string | null;
    typoHint: string | null;
    verdict: PackageVerdict;
    wren: { says: PackageVerdict; why: string } | null;
    /** After submitting: what it really was. */
    truth: PackageTruth | null;
  }[];
}

export type MinigameView = CiView | CoverageView | ReviewView | TypingView | AuditView;

export function getMinigame(state: GameState): MinigameView | null {
  const s = state.minigame;
  if (!s) return null;
  const quest = QUESTS[s.questId];
  const over = isMinigameOver(s);
  const result = over ? minigameResult(s) : null;
  const passGrade = quest?.objective.kind === 'minigame' ? quest.objective.passGrade : 'C';
  const aiCost = aiTokenCost(state.hero.attributes.orchestration);
  const common: Common = {
    title: MINIGAME_TITLES[s.kind],
    questId: s.questId,
    questTitle: quest?.title ?? s.questId,
    over,
    result: result ? { ...result, passed: gradeAtLeast(result.grade, passGrade) } : null,
    tokens: state.hero.tokens,
    focus: state.hero.focusPoints,
    aiCost,
    canAffordAi: state.hero.tokens >= aiCost,
    aiName: aiName(state),
  };

  switch (s.kind) {
    case 'ciPipeline':
      return {
        ...common,
        kind: 'ciPipeline',
        minutesLeft: s.minutesLeft,
        minutesTotal: s.minutesTotal,
        runCost: RUN_MINUTES + s.slowdown,
        slowdown: s.slowdown,
        runs: s.runs,
        tests: s.tests.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          handled: t.fixed ? 'fixed' : t.quarantined ? 'quarantined' : null,
          diagnosis: t.diagnosed || over ? CI_CAUSE_LABEL[t.cause] : null,
          cause: t.diagnosed || over ? t.cause : null,
          looksReal: s.spotsRealBugs && t.cause === 'realBug' && t.status === 'failed',
        })),
        tools: (Object.keys(CI_TOOLS) as CiTool[]).map((id) => ({ id, label: CI_TOOLS[id].label, hint: CI_TOOLS[id].hint })),
      };
    case 'coverage':
      return {
        ...common,
        kind: 'coverage',
        functionName: COVERAGE_FUNCTION,
        movesLeft: s.movesLeft,
        movesTotal: s.movesTotal,
        coverage: coveragePercent(s),
        mutation: mutationPercent(s),
        generatedUsed: s.generatedUsed,
        branches: BRANCHES.map((b) => ({
          id: b.id,
          code: b.code,
          lines: b.lines,
          lit: s.lit.includes(b.id),
          killed: s.killed.includes(b.id),
          mutant: over || s.killed.includes(b.id) ? b.mutant : null,
        })),
        cards: CARDS.map((c) => ({
          id: c.id,
          label: c.label,
          played: s.played.includes(c.id),
          reaches: s.previewReach || s.played.includes(c.id) ? [...c.reaches] : null,
        })),
      };
    case 'codeReview':
      return {
        ...common,
        kind: 'codeReview',
        prTitle: PR_TITLE,
        attentionLeft: s.attentionLeft,
        attentionTotal: s.attentionTotal,
        heatmap: s.heatmap,
        aiUsed: s.aiSuggestions !== null,
        lines: DIFF.map((l) => {
          const c = s.comments.find((x) => x.line === l.n);
          return {
            n: l.n,
            code: l.code,
            suspicious: s.heatmap && isSuspicious(l),
            // The outcome of a comment is only revealed when the review is submitted.
            comment: c ? { type: c.type, outcome: over ? c.outcome : null } : null,
            ai: s.aiSuggestions?.find((x) => x.line === l.n)?.type ?? null,
            reveal: over && l.issue ? `${ISSUE_INFO[l.issue.type].label}: ${l.issue.why}` : null,
          };
        }),
        issueTypes: (Object.keys(ISSUE_INFO) as IssueType[]).map((id) => ({ id, ...ISSUE_INFO[id] })),
      };
    case 'typing': {
      const cost = typingAiCost(state.hero.attributes.orchestration);
      return {
        ...common,
        aiCost: cost,
        canAffordAi: state.hero.tokens >= cost,
        kind: 'typing',
        file: typingTextFor(s.questId).file,
        lines: s.lines.map((l) => ({ ...l })),
        current: s.current,
        secondsLeft: s.secondsLeft,
        secondsTotal: s.secondsTotal,
        typos: s.typos,
        keystrokes: s.keystrokes,
      };
    }
    case 'packageAudit':
      return {
        ...common,
        kind: 'packageAudit',
        checksLeft: s.checksLeft,
        checksTotal: s.checksTotal,
        registryCost: REGISTRY_COST,
        sourceCost: SOURCE_COST,
        wrenUsed: s.wren !== null,
        packages: PACKAGES.map((p) => {
          const w = s.wren?.find((x) => x.id === p.id);
          return {
            id: p.id,
            name: p.name,
            version: p.version,
            registry: s.registryChecked.includes(p.id) || over ? p.registry : null,
            source: s.sourceRead.includes(p.id) || over ? p.source : null,
            typoHint: s.spotsTyposquats && p.looksLike ? `One letter away from "${p.looksLike}"` : null,
            verdict: verdictOf(s, p.id),
            wren: w ? { says: w.says, why: w.why } : null,
            truth: over ? p.truth : null,
          };
        }),
      };
  }
}
