import { describe, expect, it } from 'vitest';
import {
  aiTokenCost,
  ATTRIBUTES,
  CI_TOOLS,
  decide,
  ENCOUNTERS,
  getActProgress,
  getBattle,
  getDialogue,
  getMinigame,
  getWorld,
  isQuestAvailable,
  NPCS,
  QUEST_ORDER,
  QUESTS,
  newGame,
  type Attribute,
  type Command,
  type DomainEvent,
  type GameState,
  type HeroAction,
  type MinigameMove,
} from './index';
import { BRANCHES, CARDS } from './minigames/coverage';
import { PACKAGES } from './minigames/packageAudit';
import { DIFF } from './minigames/codeReview';
import type { CiTool } from './minigames/ciPipeline';
import { run, walkTo } from './testing';
import { maxHp as maxHpOf } from './hero/hero';

/**
 * Bots that play Acts I and II through commands only, the same way the UI does.
 * They prove the content is reachable and finishable, and keep an eye on balance:
 * the no-AI path must be about as viable as the AI path.
 */
type Style = 'craft' | 'ai';

interface Stats {
  fights: Record<string, { won: number; lost: number }>;
  grades: Record<string, string[]>;
  commands: number;
  detail?: string[];
}

const BUILDS: Record<Style, Attribute[]> = {
  craft: ['logic', 'rigor', 'focus', 'logic', 'rigor', 'velocity', 'domainInsight'],
  ai: ['promptCraft', 'orchestration', 'rigor', 'promptCraft', 'promptCraft', 'orchestration', 'focus'],
};

class Bot {
  state: GameState;
  stats: Stats = { fights: {}, grades: {}, commands: 0 };
  private spent = 0;

  constructor(
    readonly style: Style,
    seed: number,
  ) {
    this.state = newGame('Bot', seed);
  }

  do(...commands: Command[]): DomainEvent[] {
    const r = run(this.state, ...commands);
    this.state = r.state;
    this.stats.commands += commands.length;
    return r.events;
  }

  tryDo(command: Command): boolean {
    const d = decide(this.state, command);
    if (!d.ok) return false;
    this.do(command);
    return true;
  }

  spendPoints() {
    const build = BUILDS[this.style];
    while (this.state.hero.unspentPoints > 0) {
      const attr = build[this.spent++ % build.length]!;
      if (!this.tryDo({ type: 'SpendAttributePoint', attribute: attr })) {
        const fallback = ATTRIBUTES.find((a) => this.state.hero.attributes[a] < 10)!;
        this.do({ type: 'SpendAttributePoint', attribute: fallback });
      }
    }
  }

  rest() {
    this.state = walkTo(this.state, { x: 23, y: 1 });
    this.do({ type: 'Interact' });
  }

  /** Talk to an NPC and pick options in order (first matching id wins at each step). */
  talk(npcId: string, prefer: string[]) {
    this.state = walkTo(this.state, NPCS[npcId]!.position);
    this.do({ type: 'Interact' });
    let guard = 0;
    while (this.state.dialogue && !this.state.minigame && guard++ < 10) {
      const options = getDialogue(this.state)!.options.map((o) => o.id);
      const pick = prefer.find((p) => options.includes(p)) ?? options[options.length - 1]!;
      this.do({ type: 'ChooseDialogueOption', optionId: pick });
    }
  }

  fight(encounterId: string) {
    const enc = ENCOUNTERS[encounterId]!;
    const stats = (this.stats.fights[enc.enemyId] ??= { won: 0, lost: 0 });
    for (let attempt = 0; attempt < 6; attempt++) {
      this.rest();
      this.state = walkTo(this.state, enc.position);
      this.do({ type: 'Interact' });
      let guard = 0;
      let minHp = this.state.hero.hp;
      while (this.state.battle?.phase === 'heroTurn' && guard++ < 200) {
        this.do({ type: 'TakeBattleAction', action: this.battleAction() });
        minHp = Math.min(minHp, this.state.hero.hp);
      }
      const phase = this.state.battle!.phase;
      (this.stats.detail ??= []).push(`${enc.enemyId.slice(0,6)} L${this.state.hero.level} t${guard} min${minHp}/${maxHpOf(this.state.hero)}`);
      this.do({ type: 'CloseBattle' });
      this.spendPoints();
      if (phase === 'won') {
        stats.won++;
        return;
      }
      stats.lost++;
    }
    throw new Error(`${this.style} bot could not beat ${enc.enemyId}: ${this.stats.detail?.join(' | ')} ${JSON.stringify(this.state.hero.attributes)}`);
  }

  private battleAction(): HeroAction {
    const view = getBattle(this.state)!;
    const can = (id: HeroAction) => view.actions.find((a) => a.id === id)?.enabled ?? false;
    const hero = this.state.hero;
    const lowHp = hero.hp <= Math.max(8, view.enemy.hp > 10 ? 12 : 6);
    if (lowHp && can('coffee')) return 'coffee';
    if (this.style === 'ai') {
      // An AI-leaning engineer still reads the warning chips: some bugs only stop regrowing once you know their source.
      if (view.traits.some((t) => t.includes('find its source')) && can('investigate')) return 'investigate';
      // Then writes one test, and lets the AI do the heavy lifting.
      if (can('writeTest') && view.enemy.hp > 20) return 'writeTest';
      if (can('askAi')) return 'askAi';
      if (can('investigate')) return 'investigate';
      if (hero.focusPoints < 2 && can('coffee')) return 'coffee';
      return 'debug';
    }
    const revives = view.traits.some((t) => t.includes('unless a test'));
    if (revives && can('writeTest')) return 'writeTest';
    if (can('investigate')) return 'investigate';
    if (!view.rootCauseRevealed && can('coffee')) return 'coffee';
    if (can('writeTest') && view.enemy.hp > 20) return 'writeTest';
    return 'debug';
  }

  minigame(questId: string) {
    const quest = QUESTS[questId]!;
    for (let attempt = 0; attempt < 4 && this.state.quests[questId]?.status === 'inProgress'; attempt++) {
      this.rest();
      this.talk(quest.giverNpcId, ['start']);
      expect(this.state.minigame).not.toBeNull();
      let guard = 0;
      while (!getMinigame(this.state)!.over && guard++ < 400) this.do({ type: 'PlayMinigame', move: this.minigameMove() });
      (this.stats.grades[questId] ??= []).push(getMinigame(this.state)!.result!.grade);
      this.do({ type: 'CloseMinigame' });
      this.spendPoints();
    }
    expect(this.state.quests[questId]?.status).toBe('codeReview');
  }

  private minigameMove(): MinigameMove {
    const v = getMinigame(this.state)!;
    const ai = this.style === 'ai' && v.canAffordAi;
    switch (v.kind) {
      case 'ciPipeline': {
        const red = v.tests.find((t) => t.status === 'failed' && !t.handled);
        if (!red) return { game: 'ciPipeline', kind: 'run' };
        if (ai) return { game: 'ciPipeline', kind: 'askPilot', testId: red.id };
        if (!red.cause) return { game: 'ciPipeline', kind: 'diagnose', testId: red.id };
        const tool = (Object.keys(CI_TOOLS) as CiTool[]).find((t) => CI_TOOLS[t].fixes === red.cause)!;
        return { game: 'ciPipeline', kind: 'fix', testId: red.id, tool };
      }
      case 'coverage': {
        if (ai && !v.generatedUsed) return { game: 'coverage', kind: 'generateTests' };
        const lit = new Set(v.branches.filter((b) => b.lit).map((b) => b.id));
        const best = CARDS.filter((c) => !v.cards.find((x) => x.id === c.id)!.played)
          .map((c) => ({ c, gain: c.reaches.filter((r) => !lit.has(r)).reduce((n, r) => n + BRANCHES.find((b) => b.id === r)!.lines, 0) }))
          .sort((a, b) => b.gain - a.gain)[0];
        if (best && best.gain > 0) return { game: 'coverage', kind: 'playInput', cardId: best.c.id };
        const open = v.branches.find((b) => b.lit && !b.killed);
        if (open) return { game: 'coverage', kind: 'assert', branchId: open.id };
        return { game: 'coverage', kind: 'submit' };
      }
      case 'codeReview': {
        if (ai && !v.aiUsed) return { game: 'codeReview', kind: 'aiPreReview' };
        if (v.attentionLeft > 0) {
          const next =
            this.style === 'ai'
              ? v.lines.find((l) => l.ai && !l.comment)
              : DIFF.find((l) => l.issue && !v.lines.find((x) => x.n === l.n)!.comment);
          if (next) {
            const type = 'ai' in next && next.ai ? next.ai : (next as (typeof DIFF)[number]).issue!.type;
            return { game: 'codeReview', kind: 'comment', line: next.n, type };
          }
        }
        return { game: 'codeReview', kind: 'verdict', verdict: 'requestChanges' };
      }
      case 'typing': {
        // A tick now and then, so the clock matters a little: the bot types about 4 keys a second.
        if (v.keystrokes % 4 === 3 && v.secondsLeft > 1) return { game: 'typing', kind: 'tick' };
        if (ai) return { game: 'typing', kind: 'aiComplete' };
        const line = v.lines[v.current]!;
        return { game: 'typing', kind: 'key', char: line.text[line.typed]! };
      }
      case 'packageAudit': {
        if (ai && !v.wrenUsed) return { game: 'packageAudit', kind: 'askWren' };
        const truth = (id: string) => PACKAGES.find((p) => p.id === id)!.truth;
        if (this.style === 'craft') {
          // A careful reader checks the unfamiliar names first.
          const unchecked = v.packages.find((p) => p.registry === null && (truth(p.id) !== 'used' || p.name.startsWith('@')));
          if (unchecked && v.checksLeft >= v.registryCost) return { game: 'packageAudit', kind: 'checkRegistry', packageId: unchecked.id };
        }
        for (const p of v.packages) {
          const want = p.wren && this.style === 'ai' ? p.wren.says : p.registry !== null ? (truth(p.id) === 'used' ? 'keep' : 'remove') : 'keep';
          if (p.verdict !== want) return { game: 'packageAudit', kind: 'setVerdict', packageId: p.id, verdict: want };
        }
        return { game: 'packageAudit', kind: 'submitAudit' };
      }
    }
  }

  /** Story choices this bot makes when an NPC asks. */
  private get choices(): string[] {
    return this.style === 'ai' ? ['skeptical', 'take'] : ['encourage', 'decline'];
  }

  /** Play an act: take every ticket as it becomes available, finish it, get it merged. */
  playAct(act: number) {
    for (let guard = 0; guard < 30 && !getActProgress(this.state, act).complete; guard++) {
      const id = QUEST_ORDER.find((q) => QUESTS[q]!.act === act && isQuestAvailable(this.state, q));
      if (!id) throw new Error(`Stuck: nothing available. ${JSON.stringify(this.state.quests)}`);
      const quest = QUESTS[id]!;
      // Someone may want a word first (Marta's rooftop talk), so ask up to twice.
      for (let i = 0; i < 2 && this.state.quests[id]?.status !== 'inProgress'; i++) this.talk(quest.giverNpcId, ['ask', 'accept', 'ok', ...this.choices]);
      expect(this.state.quests[id]?.status).toBe('inProgress');
      if (quest.objective.kind === 'defeat') this.fight(quest.objective.encounterId);
      else this.minigame(id);
      this.talk(quest.giverNpcId, ['merge', 'ok']);
      expect(this.state.quests[id]?.status).toBe('done');
      this.spendPoints();
      // Between tickets, hear people out (Jace's "just prompt it", Marta on the roof).
      if (act === 2) for (const npc of ['jace', 'marta']) this.talk(npc, [...this.choices, 'ok']);
    }
    const finale = act === 1 ? (this.style === 'ai' ? 'excited' : 'careful') : this.style === 'ai' ? 'numbers' : 'who';
    this.talk('gideon', [finale, 'ok']);
  }

  playActOne() {
    this.playAct(1);
  }
}

function playMany(style: Style, seeds: number, acts = 1) {
  const bots = Array.from({ length: seeds }, (_, i) => {
    const bot = new Bot(style, 1000 + i * 7919);
    for (let act = 1; act <= acts; act++) bot.playAct(act);
    return bot;
  });
  const fights: Record<string, { won: number; lost: number }> = {};
  for (const b of bots)
    for (const [k, v] of Object.entries(b.stats.fights)) {
      fights[k] ??= { won: 0, lost: 0 };
      fights[k].won += v.won;
      fights[k].lost += v.lost;
    }
  return { bots, fights };
}

describe('Act I playthrough', () => {
  it.each<Style>(['craft', 'ai'])('a %s-focused player can finish Act I', (style) => {
    const { bots, fights } = playMany(style, 12);
    for (const bot of bots) {
      expect(getActProgress(bot.state, 1).complete).toBe(true);
      expect(bot.state.flags).toContain('heard-all-hands');
    }
    const winRate = (id: string) => fights[id]!.won / (fights[id]!.won + fights[id]!.lost);
    // Every fight is won most of the time on the first try, on both paths.
    for (const id of Object.keys(fights)) expect(winRate(id), `${style} vs ${id}`).toBeGreaterThanOrEqual(0.6);

    const levels = bots.map((b) => b.state.hero.level);
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(5);
  });

  it('the path leaning follows how you play', () => {
    const craft = new Bot('craft', 5);
    craft.playActOne();
    const ai = new Bot('ai', 5);
    ai.playActOne();
    const lean = (s: GameState) => s.hero.affinity.leverage - s.hero.affinity.understanding;
    expect(lean(craft.state)).toBeLessThan(0);
    expect(lean(ai.state)).toBeGreaterThan(0);
  });

  // VITE_BALANCE_REPORT=1 npx vitest run playthrough --silent=false
  it.skipIf(!import.meta.env.VITE_BALANCE_REPORT)('prints a balance report', () => {
    for (const style of ['craft', 'ai'] as const) {
      const { bots, fights } = playMany(style, 12, 2);
      const grades = bots.flatMap((b) => Object.entries(b.stats.grades).map(([q, g]) => `${q}:${g.join('')}`));
      const levels = bots.map((b) => b.state.hero.level);
      console.log(bots[0]!.stats.detail!.join(' | '), bots[1]!.stats.detail!.join(' | '));
      console.log(style, JSON.stringify(fights), 'levels', levels.join(','), 'tokens', bots.map((b) => b.state.hero.tokens).join(','), '\n', grades.sort().join(' '), aiTokenCost(1));
    }
  });
});

describe('Act II playthrough', () => {
  it.each<Style>(['craft', 'ai'])('a %s-focused player can finish Act II', (style) => {
    const { bots, fights } = playMany(style, 8, 2);
    for (const bot of bots) {
      expect(getActProgress(bot.state, 2).complete).toBe(true);
      expect(bot.state.flags).toContain('heard-layoffs');
      expect(bot.state.flags.some((f) => f.startsWith('rooftop-'))).toBe(true);
    }
    const winRate = (id: string) => fights[id]!.won / (fights[id]!.won + fights[id]!.lost);
    for (const id of ['hallucinationMimic', 'confidentGolem', 'copyPasteSwarm', 'phantomPackage']) {
      expect(winRate(id), `${style} vs ${id}`).toBeGreaterThanOrEqual(0.6);
    }
    expect(Math.min(...bots.map((b) => b.state.hero.level))).toBeGreaterThanOrEqual(8);
  });

  it('Tomás leaves the office after the Act II all-hands', () => {
    const bot = new Bot('craft', 11);
    bot.playAct(1);
    bot.playAct(2);
    expect(getWorld(bot.state).npcs.map((n) => n.id)).not.toContain('tomas');
    expect(getActProgress(bot.state).act).toBe(2);
  });
});
