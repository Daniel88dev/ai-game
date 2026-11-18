import { maxFocus, maxHp, xpToNextLevel, type Hero } from './hero/hero';
import type { DomainEvent } from './events';
import type { GameState } from './state';
import type { Battle } from './combat/battle';
import { evolveMinigame, GRADE_RANK } from './minigames/minigame';

const withHero = (s: GameState, f: (h: Hero) => Hero): GameState => ({ ...s, hero: f(s.hero) });

const withBattle = (s: GameState, f: (b: Battle) => Battle): GameState =>
  s.battle ? { ...s, battle: f(s.battle) } : s;

/**
 * Folds one event into the state. Pure and total: it never validates,
 * because events are facts the decider already accepted.
 */
export function evolve(state: GameState, event: DomainEvent): GameState {
  if ('game' in event) {
    // A move inside a minigame: the minigame's own evolve, plus what it cost the hero.
    const s = state.minigame ? { ...state, minigame: evolveMinigame(state.minigame, event) } : state;
    if (!event.cost) return s;
    const { tokens = 0, focus = 0 } = event.cost;
    return withHero(s, (h) => ({ ...h, tokens: h.tokens - tokens, focusPoints: Math.max(0, h.focusPoints - focus) }));
  }
  switch (event.type) {
    case 'HeroMoved':
      return withHero(state, (h) => ({ ...h, position: event.to, facing: event.facing }));
    case 'HeroTurned':
      return withHero(state, (h) => ({ ...h, facing: event.facing }));
    case 'HeroRested':
      return withHero(state, (h) => ({ ...h, hp: event.hp, focusPoints: event.focus, tokens: event.tokens }));
    case 'QuestBoardOpened':
      return state;

    case 'DialogueStarted':
    case 'DialogueAdvanced':
      return { ...state, dialogue: { npcId: event.npcId, nodeId: event.nodeId } };
    case 'DialogueEnded':
      return { ...state, dialogue: null };
    case 'StoryFlagSet':
      return state.flags.includes(event.flag) ? state : { ...state, flags: [...state.flags, event.flag] };
    case 'TokensGifted':
      return withHero(state, (h) => ({ ...h, tokens: h.tokens + event.amount }));
    case 'ActCompleted':
      return state;

    case 'QuestAccepted':
      return {
        ...state,
        quests: {
          ...state.quests,
          [event.questId]: { clarified: state.quests[event.questId]?.clarified ?? false, status: 'inProgress' },
        },
      };
    case 'ClarifyingQuestionAsked':
      return {
        ...state,
        quests: {
          ...state.quests,
          [event.questId]: { status: state.quests[event.questId]?.status ?? 'todo', clarified: true },
        },
      };
    case 'QuestReadyForReview':
    case 'QuestCompleted': {
      const progress = state.quests[event.questId];
      if (!progress) return state;
      const status = event.type === 'QuestCompleted' ? 'done' : 'codeReview';
      const next = { ...state, quests: { ...state.quests, [event.questId]: { ...progress, status } } } as GameState;
      return event.type === 'QuestCompleted'
        ? withHero(next, (h) => ({ ...h, tokens: h.tokens + event.tokens }))
        : next;
    }

    case 'BattleStarted':
      return { ...state, battle: event.battle };
    case 'HeroDebugged':
      return withBattle(state, (b) => ({ ...b, enemyHp: Math.max(0, b.enemyHp - event.damage) }));
    case 'AiPatchApplied': {
      const s = withHero(state, (h) => ({ ...h, tokens: h.tokens - event.tokensSpent }));
      return withBattle(s, (b) => ({ ...b, enemyHp: Math.max(0, b.enemyHp - event.damage) }));
    }
    case 'StackTraceRead': {
      const s = withHero(state, (h) => ({ ...h, focusPoints: h.focusPoints - event.focusSpent }));
      return withBattle(s, (b) => ({ ...b, clues: event.clues, rootCauseRevealed: event.rootCause !== null }));
    }
    case 'TestWritten': {
      const s = withHero(state, (h) => ({ ...h, focusPoints: h.focusPoints - event.focusSpent }));
      return withBattle(s, (b) => ({ ...b, testWritten: true, enemyHp: Math.max(0, b.enemyHp - event.damage) }));
    }
    case 'AiHallucinated': {
      const s = withHero(state, (h) => ({ ...h, tokens: h.tokens - event.tokensSpent }));
      return withBattle(s, (b) => ({ ...b, enemyHp: b.enemyHp + event.enemyHealed }));
    }
    case 'CoffeeDrunk': {
      const s = withHero(state, (h) => ({
        ...h,
        hp: h.hp + event.hpRestored,
        focusPoints: h.focusPoints + event.focusRestored,
      }));
      return withBattle(s, (b) => ({ ...b, coffeesLeft: b.coffeesLeft - 1 }));
    }
    case 'EnemyAttacked': {
      const s = withHero(state, (h) => ({ ...h, hp: Math.max(0, h.hp - event.damage) }));
      return withBattle(s, (b) => ({ ...b, enemyTurns: b.enemyTurns + 1 }));
    }
    case 'AttackDodged':
      return withBattle(state, (b) => ({ ...b, enemyTurns: b.enemyTurns + 1 }));
    case 'EnemyGrew':
      return withBattle(state, (b) => ({ ...b, attackBonus: event.attackBonus }));
    case 'EnemyRevived':
      return withBattle(state, (b) => ({ ...b, enemyHp: event.hp, revived: true }));
    case 'HeavyAttackTelegraphed':
      return state;
    case 'BattleWon':
      return {
        ...withBattle(state, (b) => ({ ...b, phase: 'won' })),
        defeatedEncounters: [...state.defeatedEncounters, event.encounterId],
      };
    case 'BattleLost':
      return withBattle(state, (b) => ({ ...b, phase: 'lost' }));
    case 'BattleRetreated':
      return withBattle(state, (b) => ({ ...b, phase: 'retreated' }));
    case 'BattleClosed': {
      const s = { ...state, battle: null };
      return event.outcome === 'lost'
        ? withHero(s, (h) => ({ ...h, hp: event.hpAfter, focusPoints: maxFocus(h) }))
        : withHero(s, (h) => ({ ...h, hp: event.hpAfter }));
    }

    case 'MinigameStarted':
      return { ...state, minigame: event.session };
    case 'MinigameFinished': {
      const progress = state.quests[event.questId];
      if (!progress) return state;
      const best = progress.bestGrade && GRADE_RANK[progress.bestGrade] >= GRADE_RANK[event.grade] ? progress.bestGrade : event.grade;
      return { ...state, quests: { ...state.quests, [event.questId]: { ...progress, bestGrade: best } } };
    }
    case 'MinigameClosed':
      return { ...state, minigame: null };

    case 'XpGained':
      return withHero(state, (h) => ({ ...h, xp: h.xp + event.amount }));
    case 'LeveledUp':
      return withHero(state, (h) => {
        const levelled = {
          ...h,
          xp: h.xp - xpToNextLevel(event.level - 1),
          level: event.level,
          unspentPoints: h.unspentPoints + event.attributePoints,
        };
        return { ...levelled, hp: maxHp(levelled), focusPoints: maxFocus(levelled) };
      });
    case 'AttributeIncreased':
      return withHero(state, (h) => {
        const next = { ...h, attributes: { ...h.attributes, [event.attribute]: event.value }, unspentPoints: h.unspentPoints - 1 };
        // Raising Rigor/Focus raises the caps; grant the difference so the bar does not look "emptier".
        return {
          ...next,
          hp: h.hp + (maxHp(next) - maxHp(h)),
          focusPoints: h.focusPoints + (maxFocus(next) - maxFocus(h)),
        };
      });
    case 'PathAffinityShifted':
      return withHero(state, (h) => ({
        ...h,
        affinity: {
          understanding: h.affinity.understanding + event.understanding,
          leverage: h.affinity.leverage + event.leverage,
        },
      }));

    case 'RngAdvanced':
      return { ...state, rngSeed: event.seed };
  }
}

export function evolveAll(state: GameState, events: readonly DomainEvent[]): GameState {
  return events.reduce(evolve, state);
}
