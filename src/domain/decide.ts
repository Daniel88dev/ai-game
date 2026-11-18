import {
  aiTokenCost,
  cluesNeeded,
  dodgeChance,
  INVESTIGATE_FOCUS_COST,
  isHeavyNext,
  startBattle,
  TEST_DAMAGE_REDUCTION,
  WRITE_TEST_FOCUS_COST,
  type HeroAction,
} from './combat/battle';
import type { Command } from './commands';
import { ENCOUNTERS, type EncounterDefinition } from './content/encounters';
import { ENEMIES } from './content/enemies';
import { NPCS, type DialogueContext, type NpcDefinition } from './content/npcs';
import { QUESTS } from './content/quests';
import type { DialogueEffect } from './dialogue/dialogue';
import type { DomainEvent } from './events';
import { evolve } from './evolve';
import {
  ATTRIBUTE_POINTS_PER_LEVEL,
  MAX_ATTRIBUTE,
  levelsGained,
  maxFocus,
  maxHp,
  questXp,
  tokenAllowance,
} from './hero/hero';
import {
  decideMinigame,
  gradeAtLeast,
  isMinigameOver,
  minigameResult,
  startMinigame,
  type HeroSnapshot,
  type MinigameMove,
} from './minigames/minigame';
import { accept, reject, type Decision } from './shared/result';
import { createRng, type Rng } from './shared/rng';
import { samePosition, step, type Position } from './shared/geometry';
import { modeOf, type GameState } from './state';
import { isWalkableTile, tileAt } from './world/officeMap';

type Emit = (e: DomainEvent) => void;

/**
 * Collects events while keeping a running state, so later rules in the same
 * command (e.g. "did that hit kill the bug?") see the effect of earlier events.
 */
function recorder(initial: GameState) {
  const events: DomainEvent[] = [];
  let current = initial;
  const emit: Emit = (e) => {
    events.push(e);
    current = evolve(current, e);
  };
  return { emit, events, get state() { return current; } };
}
type Recorder = ReturnType<typeof recorder>;

// ---------------------------------------------------------------- queries used by rules

/** A ticket is on offer when all of its prerequisites are Done and it is not started. */
export function isQuestAvailable(state: GameState, questId: string): boolean {
  const quest = QUESTS[questId];
  if (!quest) return false;
  const status = state.quests[questId]?.status;
  if (status !== undefined && status !== 'todo') return false;
  return quest.requires.every((r) => state.quests[r]?.status === 'done');
}

export function dialogueContext(state: GameState): DialogueContext {
  return {
    questStatus: (id) => state.quests[id]?.status,
    isAvailable: (id) => isQuestAvailable(state, id),
    hasFlag: (flag) => state.flags.includes(flag),
    bestGrade: (id) => state.quests[id]?.bestGrade,
  };
}

export function activeEncounters(state: GameState): EncounterDefinition[] {
  return Object.values(ENCOUNTERS).filter(
    (e) => state.quests[e.questId]?.status === 'inProgress' && !state.defeatedEncounters.includes(e.id),
  );
}

export function npcAt(p: Position): NpcDefinition | undefined {
  return Object.values(NPCS).find((n) => samePosition(n.position, p));
}

export function encounterAt(state: GameState, p: Position): EncounterDefinition | undefined {
  return activeEncounters(state).find((e) => samePosition(e.position, p));
}

export function isWalkable(state: GameState, p: Position): boolean {
  return isWalkableTile(p) && !npcAt(p) && !encounterAt(state, p);
}

export function heroSnapshot(state: GameState): HeroSnapshot {
  const { attributes, tokens, focusPoints } = state.hero;
  return { attributes, tokens, focusPoints };
}

// ---------------------------------------------------------------- shared rule helpers

function grantXp(state: GameState, amount: number, emit: Emit): void {
  emit({ type: 'XpGained', amount });
  const { levels } = levelsGained(state.hero, amount);
  for (const level of levels) emit({ type: 'LeveledUp', level, attributePoints: ATTRIBUTE_POINTS_PER_LEVEL });
}

function applyDialogueEffect(effect: DialogueEffect, rec: Recorder): void {
  const state = rec.state;
  switch (effect.kind) {
    case 'askClarifying':
      if (!state.quests[effect.questId]?.clarified) {
        rec.emit({ type: 'ClarifyingQuestionAsked', questId: effect.questId });
        rec.emit({ type: 'PathAffinityShifted', understanding: 1, leverage: 0 });
      }
      return;
    case 'acceptQuest':
      if (isQuestAvailable(state, effect.questId)) rec.emit({ type: 'QuestAccepted', questId: effect.questId });
      return;
    case 'turnInQuest': {
      const quest = QUESTS[effect.questId];
      const progress = state.quests[effect.questId];
      if (!quest || progress?.status !== 'codeReview') return;
      const xp = questXp(state.hero, quest.reward.xp + (progress.clarified ? quest.reward.clarifiedBonusXp : 0));
      rec.emit({ type: 'QuestCompleted', questId: quest.id, xp, tokens: quest.reward.tokens });
      grantXp(rec.state, xp, rec.emit);
      if (quest.completesAct) rec.emit({ type: 'ActCompleted', act: quest.completesAct.act, title: quest.completesAct.title });
      return;
    }
    case 'startMinigame': {
      const quest = QUESTS[effect.questId];
      if (!quest || quest.objective.kind !== 'minigame' || state.quests[quest.id]?.status !== 'inProgress') return;
      const rng = createRng(state.rngSeed);
      rec.emit({ type: 'MinigameStarted', session: startMinigame(quest.objective.minigame, quest.id, heroSnapshot(state), rng) });
      rec.emit({ type: 'RngAdvanced', seed: rng.seed });
      return;
    }
    case 'storyChoice':
      if (state.flags.includes(effect.flag)) return;
      rec.emit({ type: 'StoryFlagSet', flag: effect.flag });
      if (effect.understanding || effect.leverage) {
        rec.emit({ type: 'PathAffinityShifted', understanding: effect.understanding ?? 0, leverage: effect.leverage ?? 0 });
      }
      if (effect.tokens) rec.emit({ type: 'TokensGifted', amount: effect.tokens, from: 'a friend' });
      return;
  }
}

// ---------------------------------------------------------------- combat

function heroActs(action: HeroAction, rec: Recorder, rng: Rng): Decision<DomainEvent> | null {
  const { hero, battle } = rec.state;
  if (!battle) return reject('No battle in progress');
  const enemy = ENEMIES[battle.enemyId]!;
  const a = hero.attributes;

  switch (action) {
    case 'debug': {
      const missed = !battle.rootCauseRevealed && rng.chance(enemy.shellMissChance);
      const critical = !missed && rng.chance(0.1);
      let damage = 3 + a.logic * 2 + rng.int(0, 2);
      if (battle.rootCauseRevealed) damage = Math.floor(damage * 1.5);
      if (critical) damage = Math.floor(damage * 1.5);
      rec.emit({ type: 'HeroDebugged', damage: missed ? 0 : damage, missed, critical });
      return null;
    }
    case 'investigate': {
      if (battle.rootCauseRevealed) return reject('Root cause already found');
      if (hero.focusPoints < INVESTIGATE_FOCUS_COST) return reject('Not enough Focus');
      const success = rng.chance(Math.min(0.95, 0.55 + a.rigor * 0.1 + (a.domainInsight - 1) * 0.05));
      const needed = cluesNeeded(enemy);
      const clues = battle.clues + (success ? 1 : 0);
      const revealed = clues >= needed;
      rec.emit({
        type: 'StackTraceRead',
        success,
        focusSpent: INVESTIGATE_FOCUS_COST,
        clues,
        cluesNeeded: needed,
        rootCause: revealed ? enemy.rootCause : null,
      });
      if (revealed) rec.emit({ type: 'PathAffinityShifted', understanding: 1, leverage: 0 });
      return null;
    }
    case 'writeTest': {
      if (battle.testWritten) return reject('You already wrote a test in this fight');
      if (hero.focusPoints < WRITE_TEST_FOCUS_COST) return reject('Not enough Focus');
      rec.emit({ type: 'TestWritten', damage: 2 + a.rigor + rng.int(0, 1), focusSpent: WRITE_TEST_FOCUS_COST });
      rec.emit({ type: 'PathAffinityShifted', understanding: 1, leverage: 0 });
      return null;
    }
    case 'askAi': {
      const cost = aiTokenCost(a.orchestration);
      if (hero.tokens < cost) return reject('Not enough tokens');
      const hallucinationChance = Math.max(0.05, 0.4 - a.promptCraft * 0.05) + (enemy.traits?.aiConfusion ?? 0);
      if (rng.chance(hallucinationChance)) {
        const enemyHealed = Math.min(4, battle.enemyMaxHp - battle.enemyHp);
        rec.emit({ type: 'AiHallucinated', enemyHealed, tokensSpent: cost });
      } else {
        rec.emit({ type: 'AiPatchApplied', damage: 5 + Math.round(a.promptCraft * 2.5) + rng.int(0, 2), tokensSpent: cost });
      }
      rec.emit({ type: 'PathAffinityShifted', understanding: 0, leverage: 1 });
      return null;
    }
    case 'coffee': {
      if (battle.coffeesLeft <= 0) return reject('The coffee pot is empty');
      rec.emit({
        type: 'CoffeeDrunk',
        focusRestored: Math.min(3, maxFocus(hero) - hero.focusPoints),
        hpRestored: Math.min(6, maxHp(hero) - hero.hp),
      });
      return null;
    }
    case 'retreat':
      rec.emit({ type: 'BattleRetreated', encounterId: battle.encounterId });
      return null;
  }
}

function enemyActs(rec: Recorder, rng: Rng): void {
  const { hero, battle } = rec.state;
  if (!battle) return;
  const enemy = ENEMIES[battle.enemyId]!;
  const heavy = isHeavyNext(battle, enemy);
  const attackName = heavy ? enemy.heavyAttackName : enemy.attackName;

  if (rng.chance(dodgeChance(hero.attributes.velocity))) {
    rec.emit({ type: 'AttackDodged', attackName, heavy });
  } else {
    let damage = enemy.attack + battle.attackBonus + rng.int(0, 2) - Math.floor(hero.attributes.rigor / 3);
    if (heavy) damage = Math.floor(damage * 1.8);
    if (battle.testWritten) damage = Math.floor(damage * (1 - TEST_DAMAGE_REDUCTION));
    rec.emit({ type: 'EnemyAttacked', damage: Math.max(1, damage), heavy, attackName });
  }

  const growth = enemy.traits?.growth ?? 0;
  if (growth && !battle.rootCauseRevealed) rec.emit({ type: 'EnemyGrew', attackBonus: battle.attackBonus + growth });

  const after = rec.state;
  if (after.hero.hp <= 0) {
    rec.emit({ type: 'BattleLost', encounterId: battle.encounterId });
  } else if (isHeavyNext(after.battle!, enemy)) {
    rec.emit({ type: 'HeavyAttackTelegraphed', attackName: enemy.heavyAttackName });
  }
}

function decideBattleAction(state: GameState, action: HeroAction): Decision<DomainEvent> {
  const battle = state.battle;
  if (!battle) return reject('No battle in progress');
  if (battle.phase !== 'heroTurn') return reject('The battle is over');

  const rng = createRng(state.rngSeed);
  const rec = recorder(state);
  const rejected = heroActs(action, rec, rng);
  if (rejected) return rejected;

  const afterHero = rec.state.battle!;
  if (afterHero.phase === 'heroTurn') {
    const enemy = ENEMIES[afterHero.enemyId]!;
    if (afterHero.enemyHp <= 0 && enemy.traits?.revives && !afterHero.testWritten && !afterHero.revived) {
      rec.emit({ type: 'EnemyRevived', hp: Math.ceil(afterHero.enemyMaxHp / 2) });
      enemyActs(rec, rng);
    } else if (afterHero.enemyHp <= 0) {
      rec.emit({ type: 'BattleWon', encounterId: afterHero.encounterId, xp: enemy.xp });
      grantXp(rec.state, enemy.xp, rec.emit);
      const encounter = ENCOUNTERS[afterHero.encounterId];
      if (encounter && rec.state.quests[encounter.questId]?.status === 'inProgress') {
        rec.emit({ type: 'QuestReadyForReview', questId: encounter.questId });
      }
    } else {
      enemyActs(rec, rng);
    }
  }
  rec.emit({ type: 'RngAdvanced', seed: rng.seed });
  return accept(...rec.events);
}

// ---------------------------------------------------------------- minigames

const AI_MOVES = new Set<MinigameMove['kind']>(['askPilot', 'generateTests', 'aiPreReview']);

function decideMinigameMove(state: GameState, move: MinigameMove): Decision<DomainEvent> {
  const session = state.minigame;
  if (!session) return reject('No minigame in progress');
  if (isMinigameOver(session)) return reject('This minigame is over');

  const rng = createRng(state.rngSeed);
  const decision = decideMinigame(session, move, heroSnapshot(state), rng);
  if (!decision.ok) return decision;

  const rec = recorder(state);
  for (const e of decision.events) rec.emit(e);
  if (AI_MOVES.has(move.kind)) rec.emit({ type: 'PathAffinityShifted', understanding: 0, leverage: 1 });

  const after = rec.state.minigame!;
  if (isMinigameOver(after)) {
    const quest = QUESTS[after.questId];
    const result = minigameResult(after);
    const passGrade = quest?.objective.kind === 'minigame' ? quest.objective.passGrade : 'C';
    const passed = gradeAtLeast(result.grade, passGrade);
    const xp = passed ? Math.round(result.score / 4) : 0;
    rec.emit({ type: 'MinigameFinished', minigame: after.kind, questId: after.questId, ...result, passed, xp });
    if (xp > 0) grantXp(rec.state, xp, rec.emit);
    if (gradeAtLeast(result.grade, 'B')) rec.emit({ type: 'PathAffinityShifted', understanding: 1, leverage: 0 });
    if (passed && rec.state.quests[after.questId]?.status === 'inProgress') {
      rec.emit({ type: 'QuestReadyForReview', questId: after.questId });
    }
  }
  rec.emit({ type: 'RngAdvanced', seed: rng.seed });
  return accept(...rec.events);
}

// ---------------------------------------------------------------- the decider

/**
 * decide(state, command) -> events | rejection.
 * The single entry point for all game rules. Pure: no I/O, no clock, no Math.random.
 */
export function decide(state: GameState, command: Command): Decision<DomainEvent> {
  const mode = modeOf(state);

  switch (command.type) {
    case 'MoveHero': {
      if (mode !== 'explore') return reject(`Cannot move during ${mode}`);
      const { hero } = state;
      const to = step(hero.position, command.direction);
      if (isWalkable(state, to)) {
        return accept({ type: 'HeroMoved', from: hero.position, to, facing: command.direction });
      }
      if (hero.facing !== command.direction) return accept({ type: 'HeroTurned', facing: command.direction });
      return reject('Blocked');
    }

    case 'Interact': {
      if (mode !== 'explore') return reject(`Cannot interact during ${mode}`);
      const target = step(state.hero.position, state.hero.facing);
      const npc = npcAt(target);
      if (npc) {
        const nodeId = npc.entry(dialogueContext(state));
        return accept({ type: 'DialogueStarted', npcId: npc.id, nodeId });
      }
      const encounter = encounterAt(state, target);
      if (encounter) {
        return accept({ type: 'BattleStarted', battle: startBattle(encounter.id, ENEMIES[encounter.enemyId]!) });
      }
      switch (tileAt(target)) {
        case 'coffee':
          return accept({
            type: 'HeroRested',
            hp: maxHp(state.hero),
            focus: maxFocus(state.hero),
            tokens: Math.max(state.hero.tokens, tokenAllowance(state.hero)),
          });
        case 'kanban':
          return accept({ type: 'QuestBoardOpened' });
        default:
          return reject('Nothing to interact with');
      }
    }

    case 'ChooseDialogueOption': {
      if (!state.dialogue) return reject('Not in a conversation');
      const npc = NPCS[state.dialogue.npcId];
      const node = npc?.nodes[state.dialogue.nodeId];
      const option = node?.options.find((o) => o.id === command.optionId);
      if (!npc || !option) return reject('Unknown dialogue option');
      const rec = recorder(state);
      if (option.effect) applyDialogueEffect(option.effect, rec);
      rec.emit(
        option.next
          ? { type: 'DialogueAdvanced', npcId: npc.id, nodeId: option.next }
          : { type: 'DialogueEnded', npcId: npc.id },
      );
      return accept(...rec.events);
    }

    case 'TakeBattleAction':
      return decideBattleAction(state, command.action);

    case 'CloseBattle': {
      const battle = state.battle;
      if (!battle) return reject('No battle in progress');
      if (battle.phase === 'heroTurn') return reject('The battle is still going');
      const hpAfter = battle.phase === 'lost' ? Math.ceil(maxHp(state.hero) / 2) : Math.max(1, state.hero.hp);
      return accept({ type: 'BattleClosed', outcome: battle.phase, hpAfter });
    }

    case 'PlayMinigame':
      if (mode !== 'minigame') return reject('No minigame in progress');
      return decideMinigameMove(state, command.move);

    case 'CloseMinigame': {
      const session = state.minigame;
      if (!session) return reject('No minigame in progress');
      if (!isMinigameOver(session)) return reject('The minigame is still going');
      const status = state.quests[session.questId]?.status;
      return accept({ type: 'MinigameClosed', minigame: session.kind, passed: status === 'codeReview' || status === 'done' });
    }

    case 'SpendAttributePoint': {
      const { hero } = state;
      if (hero.unspentPoints <= 0) return reject('No attribute points to spend');
      const value = hero.attributes[command.attribute] + 1;
      if (value > MAX_ATTRIBUTE) return reject('Attribute is already maxed');
      return accept({ type: 'AttributeIncreased', attribute: command.attribute, value });
    }
  }
}
