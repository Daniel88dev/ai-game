import type { DialogueNode } from '../dialogue/dialogue';
import type { QuestStatus } from '../quest/quest';
import type { Direction, Position } from '../shared/geometry';

export interface DialogueContext {
  questStatus(questId: string): QuestStatus | undefined;
}

export interface NpcDefinition {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly sprite: string;
  readonly position: Position;
  readonly facing: Direction;
  /** Picks the entry node based on the current game state. */
  entry(ctx: DialogueContext): string;
  readonly nodes: Readonly<Record<string, DialogueNode>>;
}

const priya: NpcDefinition = {
  id: 'priya',
  name: 'Priya Nandakumar',
  role: 'Product Manager',
  sprite: 'npc_priya',
  position: { x: 19, y: 3 },
  facing: 'down',
  entry: (ctx) => {
    switch (ctx.questStatus('LUM-7')) {
      case undefined:
      case 'todo':
        return 'intro';
      case 'inProgress':
        return 'waiting';
      case 'codeReview':
        return 'review';
      case 'done':
        return 'thanks';
    }
  },
  nodes: {
    intro: {
      id: 'intro',
      text: "Oh hey, you must be the new junior! I'm Priya, product. Welcome to Lumen Ledger. I have a ticket for you: LUM-7, \"Login crashes for users without an avatar\". Should be quick, right?",
      options: [
        { id: 'ask', label: 'What exactly happens? (ask a clarifying question)', next: 'clarify', effect: { kind: 'askClarifying', questId: 'LUM-7' } },
        { id: 'accept', label: "Sure, I'll take it.", next: 'accepted', effect: { kind: 'acceptQuest', questId: 'LUM-7' } },
        { id: 'later', label: 'Let me get my laptop set up first.' },
      ],
    },
    clarify: {
      id: 'clarify',
      text: 'Good question! Repro: sign up, skip the avatar step, log in. White screen. Support says it smells like a null something. Acceptance criteria: those users log in and see the default avatar.',
      options: [
        { id: 'accept', label: "Got it. I'll take LUM-7.", next: 'accepted', effect: { kind: 'acceptQuest', questId: 'LUM-7' } },
        { id: 'later', label: 'Let me look around first.' },
      ],
    },
    accepted: {
      id: 'accepted',
      text: "Moved it to In Progress! Something nasty is crawling around your desk, by the way. Marta knows the login code if you get stuck.",
      options: [{ id: 'ok', label: 'On it.' }],
    },
    waiting: {
      id: 'waiting',
      text: 'How is LUM-7 going? Support pinged me again. That beetle is still by your desk.',
      options: [{ id: 'ok', label: 'Working on it!' }],
    },
    review: {
      id: 'review',
      text: "You fixed it? Let me try... no avatar, log in... it works! And there's a test? Marta approved the PR. Want to merge?",
      options: [{ id: 'merge', label: 'Merge the PR', next: 'merged', effect: { kind: 'turnInQuest', questId: 'LUM-7' } }],
    },
    merged: {
      id: 'merged',
      text: 'Merged! LUM-7 is Done. Your first ticket on day one. Coffee is on me. More tickets next sprint!',
      options: [{ id: 'ok', label: 'Thanks!' }],
    },
    thanks: {
      id: 'thanks',
      text: 'Users love the default avatar, apparently. Who knew. Rest up, sprint planning is tomorrow.',
      options: [{ id: 'ok', label: 'See you there.' }],
    },
  },
};

const marta: NpcDefinition = {
  id: 'marta',
  name: 'Marta Kowalczyk',
  role: 'Staff Engineer',
  sprite: 'npc_marta',
  position: { x: 7, y: 5 },
  facing: 'right',
  entry: (ctx) => {
    switch (ctx.questStatus('LUM-7')) {
      case undefined:
      case 'todo':
        return 'hello';
      case 'inProgress':
        return 'hint';
      case 'codeReview':
      case 'done':
        return 'proud';
    }
  },
  nodes: {
    hello: {
      id: 'hello',
      text: "Marta. Staff engineer. I wrote half of the Monolith, so if something breaks, it's probably mine. Priya is looking for you. Rule one: show me the stack trace.",
      options: [{ id: 'ok', label: 'Nice to meet you.' }],
    },
    hint: {
      id: 'hint',
      text: "A NullPointer Beetle? Classic. Blind fixes slide right off its shell. Read the stack trace first, then debug. And PILOT... it's autocomplete. It sounds sure of itself. It isn't.",
      options: [
        { id: 'more', label: 'What if I run low on Focus?', next: 'hint2' },
        { id: 'ok', label: 'Thanks, Marta.' },
      ],
    },
    hint2: {
      id: 'hint2',
      text: 'Coffee machine by the window. Fills you up, and the game saves there. Also, every third turn that beetle throws something big. Watch for the warning.',
      options: [{ id: 'ok', label: 'Got it.' }],
    },
    proud: {
      id: 'proud',
      text: 'Clean fix. You found the root cause instead of wrapping it in a try/catch. Keep doing that and you will be fine, AI or no AI.',
      options: [{ id: 'ok', label: 'Thanks!' }],
    },
  },
};

export const NPCS: Record<string, NpcDefinition> = { priya, marta };
