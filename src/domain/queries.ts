import { ACTION_INFO, AI_TOKEN_COST, INVESTIGATE_FOCUS_COST, isHeavyNext, type HeroAction } from './combat/battle';
import { ENEMIES } from './content/enemies';
import { NPCS } from './content/npcs';
import { QUESTS } from './content/quests';
import { activeEncounters, encounterAt, npcAt } from './decide';
import { ATTRIBUTES, ATTRIBUTE_INFO, MAX_ATTRIBUTE, maxFocus, maxHp, xpToNextLevel, type Attribute } from './hero/hero';
import { STATUS_LABEL, type QuestStatus } from './quest/quest';
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
  unspentPoints: number;
  activeQuest: { id: string; title: string; status: string } | null;
}

export function getHud(state: GameState): HudView {
  const { hero } = state;
  const active = Object.entries(state.quests).find(([, p]) => p.status !== 'done' && p.status !== 'todo');
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
    unspentPoints: hero.unspentPoints,
    activeQuest: quest && active ? { id: quest.id, title: quest.title, status: STATUS_LABEL[active[1].status] } : null,
  };
}

export interface CharacterView {
  attributes: { id: Attribute; label: string; effect: string; value: number; canRaise: boolean }[];
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
}

export function getQuestLog(state: GameState): QuestLogEntry[] {
  return Object.entries(state.quests).flatMap(([id, progress]) => {
    const q = QUESTS[id];
    if (!q) return [];
    return [{
      id,
      title: q.title,
      type: q.type,
      storyPoints: q.storyPoints,
      status: progress.status,
      statusLabel: STATUS_LABEL[progress.status],
      description: q.description,
      acceptanceCriteria: q.acceptanceCriteria.map((c) => ({
        text: c.text,
        met: progress.status === 'done' || (c.metOn === 'fix' && state.defeatedEncounters.includes(q.targetEncounterId)),
      })),
      giver: NPCS[q.giverNpcId]?.name ?? q.giverNpcId,
    }];
  });
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
  enemy: { name: string; sprite: string; hp: number; maxHp: number };
  rootCauseRevealed: boolean;
  rootCause: string | null;
  heavyNext: string | null;
  coffeesLeft: number;
  actions: BattleActionView[];
}

export function getBattle(state: GameState): BattleView | null {
  const b = state.battle;
  if (!b) return null;
  const enemy = ENEMIES[b.enemyId]!;
  const hero = state.hero;
  const turn = b.phase === 'heroTurn';
  const actions: BattleActionView[] = [
    { id: 'debug', ...ACTION_INFO.debug, enabled: turn },
    {
      id: 'investigate',
      ...ACTION_INFO.investigate,
      enabled: turn && !b.rootCauseRevealed && hero.focusPoints >= INVESTIGATE_FOCUS_COST,
      reason: b.rootCauseRevealed ? 'Root cause found' : hero.focusPoints < INVESTIGATE_FOCUS_COST ? 'Not enough Focus' : undefined,
    },
    {
      id: 'askAi',
      ...ACTION_INFO.askAi,
      enabled: turn && hero.tokens >= AI_TOKEN_COST,
      reason: hero.tokens < AI_TOKEN_COST ? 'Not enough tokens' : undefined,
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
    enemy: { name: enemy.name, sprite: enemy.sprite, hp: b.enemyHp, maxHp: enemy.maxHp },
    rootCauseRevealed: b.rootCauseRevealed,
    rootCause: b.rootCauseRevealed ? enemy.rootCause : null,
    heavyNext: turn && isHeavyNext(b, enemy) ? enemy.heavyAttackName : null,
    coffeesLeft: b.coffeesLeft,
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
    npcs: Object.values(NPCS).map((n) => {
      const quest = Object.values(QUESTS).find((q) => q.giverNpcId === n.id);
      const status = quest ? state.quests[quest.id]?.status : undefined;
      return {
        id: n.id,
        sprite: n.sprite,
        x: n.position.x,
        y: n.position.y,
        facing: n.facing,
        hasQuestMarker: !!quest && (status === undefined || status === 'todo' || status === 'codeReview'),
      };
    }),
    bugs: activeEncounters(state).map((e) => ({
      encounterId: e.id,
      sprite: ENEMIES[e.enemyId]!.sprite,
      x: e.position.x,
      y: e.position.y,
    })),
  };
}
