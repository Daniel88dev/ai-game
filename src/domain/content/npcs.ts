import type { DialogueNode, DialogueOption } from '../dialogue/dialogue';
import type { Grade } from '../minigames/minigame';
import type { QuestStatus } from '../quest/quest';
import type { Direction, Position } from '../shared/geometry';

/** Read-only view of the game a dialogue tree may branch on. */
export interface DialogueContext {
  questStatus(questId: string): QuestStatus | undefined;
  /** All required tickets are Done and this one is not started yet. */
  isAvailable(questId: string): boolean;
  hasFlag(flag: string): boolean;
  bestGrade(questId: string): Grade | undefined;
}

export interface NpcDefinition {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly sprite: string;
  readonly position: Position;
  readonly facing: Direction;
  /** Tickets this NPC hands out (drives the "!" marker over their head). */
  readonly gives: readonly string[];
  /** Picks the entry node based on the current game state. */
  entry(ctx: DialogueContext): string;
  readonly nodes: Readonly<Record<string, DialogueNode>>;
}

// ------------------------------------------------------------------ helpers

const node = (id: string, text: string, options: DialogueOption[] = [{ id: 'ok', label: 'OK.' }]): DialogueNode => ({ id, text, options });

interface TicketScript {
  offer: string;
  accept?: string;
  clarifyQuestion?: string;
  clarify?: string;
  accepted: string;
  waiting: string;
  review: string;
  merged: string;
  /** Minigame tickets: the giver starts the minigame. */
  start?: string;
}

/**
 * The standard ticket conversation: offer (+ optional clarifying question),
 * accepted, waiting (or "start" for minigame tickets), review + merge.
 * Node ids are `<ticket>:<step>` so the entry picker can find them.
 */
function ticket(q: string, t: TicketScript): Record<string, DialogueNode> {
  const accept: DialogueOption = { id: 'accept', label: t.accept ?? `I'll take ${q}.`, next: `${q}:accepted`, effect: { kind: 'acceptQuest', questId: q } };
  const later: DialogueOption = { id: 'later', label: 'Not right now.' };
  const start: DialogueOption[] = t.start
    ? [{ id: 'start', label: t.start, effect: { kind: 'startMinigame', questId: q } }, { id: 'later', label: 'Give me a minute.' }]
    : [{ id: 'ok', label: 'On it.' }];
  const nodes: DialogueNode[] = [
    node(`${q}:offer`, t.offer, [
      ...(t.clarify
        ? [{ id: 'ask', label: t.clarifyQuestion ?? 'Can you tell me more? (ask a clarifying question)', next: `${q}:clarify`, effect: { kind: 'askClarifying', questId: q } } as DialogueOption]
        : []),
      accept,
      later,
    ]),
    node(`${q}:accepted`, t.accepted, start),
    node(`${q}:waiting`, t.waiting, start),
    node(`${q}:review`, t.review, [{ id: 'merge', label: 'Merge the PR', next: `${q}:merged`, effect: { kind: 'turnInQuest', questId: q } }]),
    node(`${q}:merged`, t.merged, [{ id: 'ok', label: 'Thanks!' }]),
  ];
  if (t.clarify) nodes.push(node(`${q}:clarify`, t.clarify, [accept, later]));
  return Object.fromEntries(nodes.map((n) => [n.id, n]));
}

/** Review first (something to merge), then new tickets, then the one in progress. */
function giverEntry(ctx: DialogueContext, quests: readonly string[]): string | null {
  for (const q of quests) if (ctx.questStatus(q) === 'codeReview') return `${q}:review`;
  for (const q of quests) if (ctx.isAvailable(q)) return `${q}:offer`;
  for (const q of quests) if (ctx.questStatus(q) === 'inProgress') return `${q}:waiting`;
  return null;
}

const actOneDone = (ctx: DialogueContext) => ctx.questStatus('LUM-33') === 'done';

// ------------------------------------------------------------------ Priya, PM

const priya: NpcDefinition = {
  id: 'priya',
  name: 'Priya Nandakumar',
  role: 'Product Manager',
  sprite: 'npc_priya',
  position: { x: 19, y: 3 },
  facing: 'down',
  gives: ['LUM-7', 'LUM-14', 'LUM-35', 'LUM-33'],
  entry(ctx) {
    if (actOneDone(ctx)) return 'actDone';
    if (ctx.questStatus('LUM-7') === undefined) return 'intro';
    return giverEntry(ctx, this.gives) ?? 'idle';
  },
  nodes: {
    intro: node(
      'intro',
      "Oh hey, you must be the new junior! I'm Priya, product. Welcome to Lumen Ledger. I have a ticket for you: LUM-7, \"Login crashes for users without an avatar\". Should be quick, right?",
      [
        { id: 'ask', label: 'What exactly happens? (ask a clarifying question)', next: 'LUM-7:clarify', effect: { kind: 'askClarifying', questId: 'LUM-7' } },
        { id: 'accept', label: "Sure, I'll take it.", next: 'LUM-7:accepted', effect: { kind: 'acceptQuest', questId: 'LUM-7' } },
        { id: 'later', label: 'Let me get my laptop set up first.' },
      ],
    ),
    ...ticket('LUM-7', {
      offer: 'Ready for LUM-7 now? Login crashes for users without an avatar.',
      accept: "Sure, I'll take it.",
      clarify:
        'Good question! Repro: sign up, skip the avatar step, log in. White screen. Support says it smells like a null something. Acceptance criteria: those users log in and see the default avatar.',
      accepted: 'Moved it to In Progress! Something nasty is crawling around your desk, by the way. Marta knows the login code if you get stuck.',
      waiting: 'How is LUM-7 going? Support pinged me again. That beetle is still by your desk.',
      review: "You fixed it? Let me try... no avatar, log in... it works! And there's a test? Marta approved the PR. Want to merge?",
      merged: 'Merged! LUM-7 is Done. Your first ticket on day one. More tickets on the board, come back when you have a minute.',
    }),
    ...ticket('LUM-14', {
      offer: 'Users keep asking for "Export to CSV". Good news: Jace already built the button! Bad news: every file is missing a row. LUM-14 is yours if you want it.',
      clarifyQuestion: 'Which row is missing? (ask a clarifying question)',
      clarify: 'Always the last one. Accounting noticed because the totals never match. Acceptance criteria: every transaction is in the file, and the button lives on the transactions page.',
      accepted: 'Thank you! The export code is over by the left desks. Watch your step, something in there keeps hopping around.',
      waiting: 'Still missing a row? Accounting sent me a spreadsheet about the spreadsheet.',
      review: 'I exported 500 transactions and got... 500 rows! Lena signed off. Merge?',
      merged: 'LUM-14 is Done. Accounting sent a thank-you GIF. That is the highest honor they give.',
    }),
    ...ticket('LUM-35', {
      offer: "Um. Remember LUM-7? Users without an avatar get a white screen again. Someone refactored the login page last week. I'm opening LUM-35. Sorry.",
      clarifyQuestion: 'Did anything else change in that refactor? (ask a clarifying question)',
      clarify: "Jace moved the avatar code into a shared helper. He says PILOT checked it. There was no test for the default avatar, so CI stayed green.",
      accepted: "It's back at your desk. Marta says this time it won't stay dead unless someone writes a test.",
      waiting: 'Is the zombie avatar bug dead yet? Support has started calling it "the sequel".',
      review: 'Fixed, and with a test that fails if anyone removes the fallback again. Merge?',
      merged: 'LUM-35 is Done. And it should stay done this time. That is what the test is for, right?',
    }),
    ...ticket('LUM-33', {
      offer:
        'This one is serious. A few users see a balance of -0.00. Sometimes. Nobody can reproduce it, and every time Kofi attaches a debugger, it goes away. This is LUM-33. Gideon is asking about it every hour.',
      clarifyQuestion: 'Which users, and when? (ask a clarifying question)',
      clarify:
        "Users with tiny refunds, like 0.004 EUR. Mostly at peak hours. Kofi thinks it happens under load. Acceptance criteria: never show -0.00, and write down where the bug really lives.",
      accept: "I'll find it.",
      accepted: 'Kofi saw it flickering by the server racks. Be patient with this one. Logs, not luck.',
      waiting: 'Any news on the -0.00 bug? I told Gideon "the junior is on it". No pressure.',
      review: "Root cause in the legacy money helper in the Monolith? That code is older than our logo. Marta reviewed it and she looked... worried. But it's fixed. Merge?",
      merged:
        'LUM-33 is Done. That closes the Lumen 2.0 epic! Gideon wants everyone at the meeting table. He has slides. He always has slides.',
    }),
    idle: node('idle', 'Nothing new from me right now. Check the board, Lena and Kofi always have something burning.'),
    actDone: node('actDone', 'Did you hear Gideon? AI agents for everyone. I am already rewriting the roadmap. Again.'),
  },
};

// ------------------------------------------------------------------ Marta, Staff Engineer (mentor)

const MARTA_HINTS: Record<string, string> = {
  'LUM-7':
    "A NullPointer Beetle? Classic. Blind fixes slide right off its shell. Read the stack trace first, then debug. And PILOT... it's autocomplete. It sounds sure of itself. It isn't.",
  'LUM-14':
    'The Off-by-One Imp hits fast, twice as often as the beetle. Find the loop boundary first. Every off-by-one is a question you did not ask: does the end include the last element?',
  'LUM-31':
    'A memory leak grows every turn you let it live. Find the root cause early, that stops the growth. Hitting it blindly while it grows is how you lose a whole afternoon.',
  'LUM-35':
    'A regression. If you kill it without writing a test, it comes back. Write the test in the fight. It also takes the edge off its hits.',
  'LUM-33':
    'The Heisenbug hides from debuggers. Reading the stack trace will not work. Add logging, three times, until the pattern shows. PILOT will guess. Do not let it guess.',
};

const marta: NpcDefinition = {
  id: 'marta',
  name: 'Marta Kowalczyk',
  role: 'Staff Engineer',
  sprite: 'npc_marta',
  position: { x: 7, y: 5 },
  facing: 'right',
  gives: ['LUM-22'],
  entry(ctx) {
    if (actOneDone(ctx)) return 'actDone';
    if (ctx.questStatus('LUM-7') === undefined || ctx.questStatus('LUM-7') === 'todo') return 'hello';
    if (ctx.questStatus('LUM-22') === 'codeReview') return 'LUM-22:review';
    const fighting = Object.keys(MARTA_HINTS).find((q) => ctx.questStatus(q) === 'inProgress');
    if (fighting) return `hint:${fighting}`;
    return giverEntry(ctx, this.gives) ?? 'proud';
  },
  nodes: {
    hello: node(
      'hello',
      "Marta. Staff engineer. I wrote half of the Monolith, so if something breaks, it's probably mine. Priya is looking for you. Rule one: show me the stack trace.",
      [{ id: 'ok', label: 'Nice to meet you.' }],
    ),
    ...Object.fromEntries(
      Object.entries(MARTA_HINTS).map(([q, text]) => [
        `hint:${q}`,
        node(`hint:${q}`, text, [
          { id: 'more', label: 'What if I run low on Focus?', next: 'focus' },
          { id: 'ok', label: 'Thanks, Marta.' },
        ]),
      ]),
    ),
    focus: node(
      'focus',
      'Coffee machine by the window. Fills you up, tops up your token budget, and the game saves there. Also, watch for the warning before a heavy attack.',
      [{ id: 'ok', label: 'Got it.' }],
    ),
    ...ticket('LUM-22', {
      offer:
        "Jace opened PR #42. Currency formatting for the dashboard, done with PILOT in twenty minutes. It looks fine. That is what worries me. Review it before it merges? Read every line. Then decide.",
      accept: 'I will review it.',
      accepted: 'Take your time. Comment on what is wrong and say what kind of problem it is. Nitpicks are cheap. Missing a security hole is not.',
      start: 'Open the PR',
      waiting: 'PR #42 is still waiting for your review.',
      review: 'Good review. You read it instead of skimming it. I will merge it once Jace pushes the fixes. Agreed?',
      merged: 'Merged. Jace is annoyed, which means the review was useful.',
    }),
    proud: node(
      'proud',
      'Clean fixes so far. You find the root cause instead of wrapping it in a try/catch. Keep doing that and you will be fine, AI or no AI.',
      [{ id: 'ok', label: 'Thanks!' }],
    ),
    actDone: node(
      'actDone',
      'An AI agent for every engineer. Well. I said the same about IDEs in 2004. I was wrong then, maybe I am wrong now. Just promise me you will keep reading the code.',
      [
        { id: 'promise', label: 'I promise.', effect: { kind: 'storyChoice', flag: 'promised-marta', understanding: 1 } },
        { id: 'ok', label: 'We will see.' },
      ],
    ),
  },
};

// ------------------------------------------------------------------ Lena, QA Lead

const lena: NpcDefinition = {
  id: 'lena',
  name: 'Lena Ortiz',
  role: 'QA Lead',
  sprite: 'npc_lena',
  position: { x: 26, y: 2 },
  facing: 'down',
  gives: ['LUM-27', 'LUM-29'],
  entry(ctx) {
    if (actOneDone(ctx)) return 'actDone';
    const picked = giverEntry(ctx, this.gives);
    if (picked) return picked;
    return ctx.questStatus('LUM-27') === 'done' ? 'idle' : 'hello';
  },
  nodes: {
    hello: node('hello', "Lena, QA. I know every bug in this building by name. Fix one of Priya's tickets first, then come talk to me about the CI Foundry."),
    ...ticket('LUM-27', {
      offer:
        "The release build goes red twice a day and everyone just presses re-run. The suite takes 9 minutes because half of it runs twice. Release is Friday. LUM-27: get main green, and tell me why it was red.",
      clarifyQuestion: 'Are all the red tests flaky? (ask a clarifying question)',
      clarify:
        'Most are. Not all. If something fails every single time, it is not flaky, it is broken. Quarantine a real bug and it ships. Acceptance criteria: green main, and a list of causes.',
      accepted: 'Run the pipeline, look at what goes red, diagnose it, fix the cause. Re-running until it is green is not a fix. Ready?',
      start: 'Start the release run',
      waiting: 'The release window is still open. Want to try the run again?',
      review: 'Green, and you wrote down the causes. Timing, shared state, timezones... I am framing this. Merge your notes?',
      merged: 'LUM-27 is Done. The suite runs in 6 minutes now. Kofi bought a cake.',
    }),
    ...ticket('LUM-29', {
      offer:
        'Next: monthlyBudget(). It decides how much users can spend. It has zero tests. LUM-29: cover it. And I mean tests that check something. A test with no assertion is a light with no bulb.',
      accepted: 'Each test input lights up the branches it runs. Then add assertions to kill the mutants hiding there. Coverage alone is a vanity metric.',
      start: 'Open the budget calculator',
      waiting: 'monthlyBudget() is still waiting for its tests. Want another go?',
      review: 'Coverage and mutation score, both. This is a real test suite. Merge it?',
      merged: 'LUM-29 is Done. Next time someone breaks the budget math, CI will yell before users do.',
    }),
    idle: node('idle', 'CI has been green for three days. I do not trust it. Something is coming.'),
    actDone: node('actDone', 'More code, faster, from agents? Then I need more tests, faster. I am going to need a bigger Foundry.'),
  },
};

// ------------------------------------------------------------------ Kofi, SRE

const kofi: NpcDefinition = {
  id: 'kofi',
  name: 'Kofi Mensah',
  role: 'SRE, on call',
  sprite: 'npc_kofi',
  position: { x: 28, y: 5 },
  facing: 'left',
  gives: ['LUM-31'],
  entry(ctx) {
    if (actOneDone(ctx)) return 'actDone';
    if (ctx.questStatus('LUM-33') === 'inProgress') return 'heisenbug';
    const picked = giverEntry(ctx, this.gives);
    if (picked) return picked;
    return ctx.questStatus('LUM-31') === 'done' ? 'idle' : 'hello';
  },
  nodes: {
    hello: node('hello', "Kofi. SRE. I'm on call. I'm always on call. If my pager goes off, pretend you didn't see me cry."),
    ...ticket('LUM-31', {
      offer:
        "My memory graphs for the dashboard look like a ski jump. Open the tab, wait an hour, the browser dies. Something subscribes and never lets go. LUM-31, want it?",
      clarifyQuestion: 'Which part of the dashboard? (ask a clarifying question)',
      clarify:
        'Only with the live price chart on. Memory goes up every time the chart re-renders. Acceptance criteria: memory stays flat for an hour.',
      accepted: 'It is oozing around the meeting table. Careful: the longer it lives, the harder it hits.',
      waiting: 'The memory graph is still a ski jump. I am getting attached to it, honestly.',
      review: 'Flat line! Beautiful. I could cry. I will not, I am on call. Merge?',
      merged: 'LUM-31 is Done. First flat graph since March.',
    }),
    heisenbug: node(
      'heisenbug',
      'The -0.00 thing? It only shows up under load, and my traces lose it the moment I look closely. Logs. Add logs and watch it over time. That is how you catch something that hides from you.',
    ),
    idle: node('idle', 'Quiet night on the pager. Which means something is planning a loud one.'),
    actDone: node('actDone', 'Agents writing code at 3 AM. Agents deploying at 3 AM. Guess who gets paged at 3 AM.'),
  },
};

// ------------------------------------------------------------------ Jace, the rival junior

const jace: NpcDefinition = {
  id: 'jace',
  name: 'Jace Holloway',
  role: 'Junior Developer',
  sprite: 'npc_jace',
  position: { x: 11, y: 7 },
  facing: 'up',
  gives: [],
  entry(ctx) {
    if (actOneDone(ctx)) return 'actDone';
    if (!ctx.hasFlag('jace-prompting') && !ctx.hasFlag('jace-reading')) return 'intro';
    const review = ctx.questStatus('LUM-22');
    if (review === 'done' || review === 'codeReview') {
      const g = ctx.bestGrade('LUM-22');
      return g === 'S' || g === 'A' ? 'reviewedWell' : 'reviewed';
    }
    return 'busy';
  },
  nodes: {
    intro: node(
      'intro',
      "Hey, you're the other new hire! Jace. I closed five tickets today. Five! I just tell PILOT what I want and hit Tab. Want me to show you?",
      [
        {
          id: 'show',
          label: 'Show me how you prompt it.',
          next: 'prompting',
          effect: { kind: 'storyChoice', flag: 'jace-prompting', leverage: 1, tokens: 10 },
        },
        { id: 'read', label: 'Do you read what it writes?', next: 'reading', effect: { kind: 'storyChoice', flag: 'jace-reading', understanding: 1 } },
        { id: 'later', label: 'Maybe later.' },
      ],
    ),
    prompting: node(
      'prompting',
      'Easy: say what you want, add "make it production ready", accept. Here, I sent you some of my tokens. Pay me back in merged PRs.',
    ),
    reading: node(
      'reading',
      "Read it? Like... all of it? It compiles. The tests pass. Mostly. Okay, sometimes. Look, it's faster than reading.",
    ),
    busy: node('busy', 'Can not talk, shipping. Priya said my velocity chart is "inspiring".'),
    reviewed: node('reviewed', 'You reviewed my PR. Fine. PILOT said that package existed. It sounded really sure.'),
    reviewedWell: node(
      'reviewedWell',
      'You caught the API key AND the made-up package? Okay. Maybe I should read the diff before I push it. Maybe. Do not tell Priya.',
      [{ id: 'ok', label: 'Your secret is safe.', effect: { kind: 'storyChoice', flag: 'jace-respects-you', understanding: 1 } }],
    ),
    actDone: node('actDone', 'A real agent! Not autocomplete, an AGENT. I am going to be so fast. You are going to be so fast. Everybody is going to be so fast.'),
  },
};

// ------------------------------------------------------------------ Gideon, CTO

const gideon: NpcDefinition = {
  id: 'gideon',
  name: 'Gideon Vance',
  role: 'CTO',
  sprite: 'npc_gideon',
  position: { x: 25, y: 5 },
  facing: 'left',
  gives: [],
  entry(ctx) {
    if (actOneDone(ctx)) return ctx.hasFlag('heard-all-hands') ? 'afterAllHands' : 'allHands';
    return 'hello';
  },
  nodes: {
    hello: node(
      'hello',
      "Gideon, CTO. Love the energy. Quick question: what's your velocity? Never mind, the dashboard will tell me. Big things are coming. Huge.",
      [
        { id: 'what', label: 'What kind of big things?', next: 'teaser' },
        { id: 'ok', label: 'Looking forward to it.' },
      ],
    ),
    teaser: node('teaser', 'I can not say yet. But I will say this: by next quarter, nobody here writes boilerplate by hand. Nobody.'),
    allHands: node(
      'allHands',
      "Everyone, gather round. Lumen 2.0 shipped. The -0.00 bug is dead, thanks to our junior here. And starting today, we are an AI-first company. Every engineer gets a real AI agent. Not autocomplete. An agent. Its name is WREN.",
      [
        { id: 'excited', label: 'That sounds amazing.', next: 'allHandsEnd', effect: { kind: 'storyChoice', flag: 'heard-all-hands', leverage: 1 } },
        { id: 'careful', label: 'Who reviews what it writes?', next: 'allHandsEnd', effect: { kind: 'storyChoice', flag: 'heard-all-hands', understanding: 1 } },
      ],
    ),
    allHandsEnd: node(
      'allHandsEnd',
      'Great question, great energy. Details next sprint. Somewhere behind you, Jace is cheering. Marta drinks her coffee in silence. (End of Act I. Act II, "The Wave", is coming in a future update.)',
      [{ id: 'ok', label: '...' }],
    ),
    afterAllHands: node('afterAllHands', 'WREN onboarding starts next sprint. I have already ordered the hoodies.'),
  },
};

export const NPCS: Record<string, NpcDefinition> = { priya, marta, lena, kofi, jace, gideon };
