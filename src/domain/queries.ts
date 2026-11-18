import {
  ACTION_INFO,
  aiTokenCost,
  cluesNeeded,
  dodgeChance,
  INVESTIGATE_FOCUS_COST,
  isHeavyNext,
  WRITE_TEST_FOCUS_COST,
  type HeroAction,
} from './combat/battle';
import { ENCOUNTERS } from './content/encounters';
import { ENEMIES } from './content/enemies';
import { NPCS } from './content/npcs';
import { QUEST_ORDER, QUESTS } from './content/quests';
import { activeEncounters, dialogueContext, encounterAt, isQuestAvailable, npcAt } from './decide';
import {
  ATTRIBUTES,
  ATTRIBUTE_INFO,
  MAX_ATTRIBUTE,
  maxFocus,
  maxHp,
  tokenAllowance,
  xpToNextLevel,
  type Attribute,
  type AttributeGroup,
} from './hero/hero';
import type { Grade } from './minigames/minigame';
import { ACTS, STATUS_LABEL, type QuestStatus } from './quest/quest';
import { step } from './shared/geometry';
import { modeOf, type GameState, type Mode } from './state';
import { tileAt } from './world/officeMap';

/**
 * Read side. Pure projections of GameState shaped for the UI.
 * React and Phaser only read through these, never by poking at the aggregates.
 */

export interface HudView {
  mode: Mode;
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  focus: number;
  maxFocus: number;
  tokens: number;
  tokenAllowance: number;
  unspentPoints: number;
  activeQuest: { id: string; title: string; status: string } | null;
  act: ActProgressView;
}

export function getHud(state: GameState): HudView {
  const { hero } = state;
  const entries = QUEST_ORDER.flatMap((id) => (state.quests[id] ? [[id, state.quests[id]!] as const] : []));
  const active = entries.find(([, p]) => p.status === 'inProgress') ?? entries.find(([, p]) => p.status === 'codeReview');
  const quest = active ? QUESTS[active[0]] : undefined;
  return {
    mode: modeOf(state),
    name: hero.name,
    level: hero.level,
    xp: hero.xp,
    xpToNext: xpToNextLevel(hero.level),
    hp: hero.hp,
    maxHp: maxHp(hero),
    focus: hero.focusPoints,
    maxFocus: maxFocus(hero),
    tokens: hero.tokens,
    tokenAllowance: tokenAllowance(hero),
    unspentPoints: hero.unspentPoints,
    activeQuest: quest && active ? { id: quest.id, title: quest.title, status: STATUS_LABEL[active[1].status] } : null,
    act: getActProgress(state),
  };
}

export interface CharacterView {
  attributes: { id: Attribute; label: string; group: AttributeGroup; effect: string; value: number; canRaise: boolean }[];
  unspentPoints: number;
  /** -1 (all craft) .. +1 (all AI). Shown as a vague "leaning", the real axes stay hidden. */
  leaning: number;
}

export function getCharacter(state: GameState): CharacterView {
  const { hero } = state;
  const { understanding, leverage } = hero.affinity;
  const total = understanding + leverage;
  return {
    attributes: ATTRIBUTES.map((id) => ({
      id,
      ...ATTRIBUTE_INFO[id],
      value: hero.attributes[id],
      canRaise: hero.unspentPoints > 0 && hero.attributes[id] < MAX_ATTRIBUTE,
    })),
    unspentPoints: hero.unspentPoints,
    leaning: total === 0 ? 0 : (leverage - understanding) / total,
  };
}

export interface QuestLogEntry {
  id: string;
  title: string;
  type: string;
  storyPoints: number;
  status: QuestStatus;
  statusLabel: string;
  description: string;
  acceptanceCriteria: { text: string; met: boolean }[];
  giver: string;
  /** For minigame tickets: the best grade so far. */
  bestGrade: Grade | null;
}

/** The board: tickets you can pick up (To Do) and everything you have touched. */
export function getQuestLog(state: GameState): QuestLogEntry[] {
  return QUEST_ORDER.flatMap((id) => {
    const q = QUESTS[id]!;
    const progress = state.quests[id];
    const status: QuestStatus = progress?.status ?? 'todo';
    if (!progress && !isQuestAvailable(state, id)) return [];
    const fixed = status === 'codeReview' || status === 'done';
    return [{
      id,
      title: q.title,
      type: q.type,
      storyPoints: q.storyPoints,
      status,
      statusLabel: STATUS_LABEL[status],
      description: q.description,
      acceptanceCriteria: q.acceptanceCriteria.map((c) => ({ text: c.text, met: status === 'done' || (c.metOn === 'fix' && fixed) })),
      giver: NPCS[q.giverNpcId]?.name ?? q.giverNpcId,
      bestGrade: progress?.bestGrade ?? null,
    }];
  });
}

export interface ActProgressView {
  act: number;
  title: string;
  epic: string;
  done: number;
  total: number;
  complete: boolean;
}

export function getActProgress(state: GameState, act = 1): ActProgressView {
  const ids = QUEST_ORDER.filter((id) => QUESTS[id]!.act === act);
  const done = ids.filter((id) => state.quests[id]?.status === 'done').length;
  const info = ACTS[act]!;
  return { act, title: info.title, epic: info.epic, done, total: ids.length, complete: done === ids.length };
}

export interface DialogueView {
  npcId: string;
  speaker: string;
  role: string;
  text: string;
  options: { id: string; label: string }[];
}

export function getDialogue(state: GameState): DialogueView | null {
  if (!state.dialogue) return null;
  const npc = NPCS[state.dialogue.npcId];
  const node = npc?.nodes[state.dialogue.nodeId];
  if (!npc || !node) return null;
  return {
    npcId: npc.id,
    speaker: npc.name,
    role: npc.role,
    text: node.text,
    options: node.options.map((o) => ({ id: o.id, label: o.label })),
  };
}

export interface BattleActionView {
  id: HeroAction;
  label: string;
  hint: string;
  enabled: boolean;
  reason?: string;
}

export interface BattleView {
  phase: 'heroTurn' | 'won' | 'lost' | 'retreated';
  enemy: { name: string; sprite: string; hp: number; maxHp: number; codePath: string };
  rootCauseRevealed: boolean;
  rootCause: string | null;
  clues: number;
  cluesNeeded: number;
  heavyNext: string | null;
  coffeesLeft: number;
  testWritten: boolean;
  /** Extra attack from a growing bug (Memory Leak). */
  attackBonus: number;
  dodgeChance: number;
  /** Short notes about how this bug plays, shown under the bar. */
  traits: string[];
  /** Who to tell once the bug is fixed. */
  reportTo: string;
  actions: BattleActionView[];
}

export function getBattle(state: GameState): BattleView | null {
  const b = state.battle;
  if (!b) return null;
  const enemy = ENEMIES[b.enemyId]!;
  const hero = state.hero;
  const turn = b.phase === 'heroTurn';
  const aiCost = aiTokenCost(hero.attributes.orchestration);
  const needed = cluesNeeded(enemy);
  const traits: string[] = [];
  if (enemy.traits?.growth) traits.push(b.rootCauseRevealed ? 'Leak plugged: it stopped growing' : `Grows every turn (+${b.attackBonus} attack)`);
  if (enemy.traits?.revives) traits.push(b.revived ? 'Came back once already' : b.testWritten ? 'A test keeps it from coming back' : 'Comes back unless a test exists');
  if (needed > 1 && !b.rootCauseRevealed) traits.push(`Clues ${b.clues}/${needed}`);
  if (enemy.traits?.aiConfusion) traits.push('Confuses PILOT');

  const actions: BattleActionView[] = [
    { id: 'debug', ...ACTION_INFO.debug, enabled: turn },
    {
      id: 'investigate',
      ...ACTION_INFO.investigate,
      label: enemy.traits?.investigateLabel ?? ACTION_INFO.investigate.label,
      enabled: turn && !b.rootCauseRevealed && hero.focusPoints >= INVESTIGATE_FOCUS_COST,
      reason: b.rootCauseRevealed ? 'Root cause found' : hero.focusPoints < INVESTIGATE_FOCUS_COST ? 'Not enough Focus' : undefined,
    },
    {
      id: 'writeTest',
      ...ACTION_INFO.writeTest,
      enabled: turn && !b.testWritten && hero.focusPoints >= WRITE_TEST_FOCUS_COST,
      reason: b.testWritten ? 'Test already written' : hero.focusPoints < WRITE_TEST_FOCUS_COST ? 'Not enough Focus' : undefined,
    },
    {
      id: 'askAi',
      ...ACTION_INFO.askAi,
      hint: `Costs ${aiCost} tokens. Strong AI patch, but may hallucinate.`,
      enabled: turn && hero.tokens >= aiCost,
      reason: hero.tokens < aiCost ? 'Not enough tokens' : undefined,
    },
    {
      id: 'coffee',
      ...ACTION_INFO.coffee,
      label: `${ACTION_INFO.coffee.label} (${b.coffeesLeft})`,
      enabled: turn && b.coffeesLeft > 0,
      reason: b.coffeesLeft <= 0 ? 'Pot is empty' : undefined,
    },
  ];
  return {
    phase: b.phase,
    enemy: { name: enemy.name, sprite: enemy.sprite, hp: b.enemyHp, maxHp: b.enemyMaxHp, codePath: enemy.codePath },
    rootCauseRevealed: b.rootCauseRevealed,
    rootCause: b.rootCauseRevealed ? enemy.rootCause : null,
    clues: b.clues,
    cluesNeeded: needed,
    heavyNext: turn && isHeavyNext(b, enemy) ? enemy.heavyAttackName : null,
    coffeesLeft: b.coffeesLeft,
    testWritten: b.testWritten,
    attackBonus: b.attackBonus,
    dodgeChance: dodgeChance(hero.attributes.velocity),
    traits,
    reportTo: NPCS[QUESTS[ENCOUNTERS[b.encounterId]?.questId ?? '']?.giverNpcId ?? '']?.name.split(' ')[0] ?? 'the team',
    actions,
  };
}

/** What pressing the interact key would do right now. Drives the "[E] Talk" prompt. */
export function getInteractionHint(state: GameState): string | null {
  if (modeOf(state) !== 'explore') return null;
  const target = step(state.hero.position, state.hero.facing);
  const npc = npcAt(target);
  if (npc) return `Talk to ${npc.name.split(' ')[0]}`;
  const enc = encounterAt(state, target);
  if (enc) return `Fight ${ENEMIES[enc.enemyId]!.name}`;
  switch (tileAt(target)) {
    case 'coffee':
      return 'Drink coffee (heal + save)';
    case 'kanban':
      return 'Check the Jira board';
    default:
      return null;
  }
}

/** "!" over an NPC: a new ticket, something to merge, or a minigame they run for you. */
function hasSomethingForYou(state: GameState, npcId: string): boolean {
  const npc = NPCS[npcId]!;
  const ticketWaiting = npc.gives.some((id) => {
    const status = state.quests[id]?.status;
    if (status === 'codeReview' || isQuestAvailable(state, id)) return true;
    return status === 'inProgress' && QUESTS[id]!.objective.kind === 'minigame';
  });
  if (ticketWaiting) return true;
  // The end-of-act all-hands.
  const ctx = dialogueContext(state);
  return npcId === 'gideon' && ctx.questStatus('LUM-33') === 'done' && !ctx.hasFlag('heard-all-hands');
}

/** Everything Phaser needs to place sprites on the office map. */
export interface WorldView {
  hero: { x: number; y: number; facing: string };
  npcs: { id: string; sprite: string; x: number; y: number; facing: string; hasQuestMarker: boolean }[];
  bugs: { encounterId: string; sprite: string; x: number; y: number }[];
}

export function getWorld(state: GameState): WorldView {
  const { hero } = state;
  return {
    hero: { x: hero.position.x, y: hero.position.y, facing: hero.facing },
    npcs: Object.values(NPCS).map((n) => ({
      id: n.id,
      sprite: n.sprite,
      x: n.position.x,
      y: n.position.y,
      facing: n.facing,
      hasQuestMarker: hasSomethingForYou(state, n.id),
    })),
    bugs: activeEncounters(state).map((e) => ({
      encounterId: e.id,
      sprite: ENEMIES[e.enemyId]!.sprite,
      x: e.position.x,
      y: e.position.y,
    })),
  };
}
