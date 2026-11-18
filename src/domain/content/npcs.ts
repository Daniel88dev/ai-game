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
  /** Whether the NPC is in the office at all (default: always). */
  present?(ctx: DialogueContext): boolean;
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
const wrenOnline = (ctx: DialogueContext) => ctx.questStatus('LUM-102') === 'done';
const actTwoDone = (ctx: DialogueContext) => ctx.questStatus('LUM-150') === 'done';
export const ROOFTOP_FLAGS = ['rooftop-encouraged', 'rooftop-skeptical', 'rooftop-showed-wren'] as const;
const hadRooftopTalk = (ctx: DialogueContext) => ROOFTOP_FLAGS.some((f) => ctx.hasFlag(f));

// ------------------------------------------------------------------ Priya, PM

const priya: NpcDefinition = {
  id: 'priya',
  name: 'Priya Nandakumar',
  role: 'Product Manager',
  sprite: 'npc_priya',
  position: { x: 19, y: 3 },
  facing: 'down',
  gives: ['LUM-7', 'LUM-14', 'LUM-35', 'LUM-33', 'LUM-109', 'LUM-118'],
  entry(ctx) {
    if (ctx.questStatus('LUM-7') === undefined) return 'intro';
    if (actTwoDone(ctx)) return 'act2Done';
    return giverEntry(ctx, this.gives) ?? (actOneDone(ctx) ? 'actDone' : 'idle');
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
    ...ticket('LUM-109', {
      offer:
        "WREN's first big day! Jace and WREN built the whole insights page in one afternoon. It's gorgeous. It also crashes for every single user: \"getInsights is not a function\". LUM-109?",
      clarifyQuestion: 'Who reviewed that PR? (ask a clarifying question)',
      clarify: "WREN did. Its own PR. It said \"Looks great!\" Acceptance criteria: the page shows real numbers, from an API that actually exists.",
      accepted: "Thanks! The bug is hiding by the middle desks. It looks exactly like working code, so don't trust your eyes.",
      waiting: 'Insights page still crashing? Gideon already put a screenshot of it in the board deck.',
      review: 'Real numbers from a real endpoint! You wrote the API that WREN assumed was there? Ha. Merge?',
      merged: "LUM-109 is Done. Gideon's board deck is safe. For now.",
    }),
    ...ticket('LUM-118', {
      offer:
        'The big one. Budgeting insights: "You spent 30% more on coffee this month." WREN generated the whole forecasting module, and it passes all of its tests. Every single one. LUM-118 needs someone to make it real.',
      clarifyQuestion: 'Who wrote those tests? (ask a clarifying question)',
      clarify: 'Also WREN. Oh. Oh no. Acceptance criteria: forecasts are checked against real transaction data, not data the AI made up.',
      accepted: 'The forecasting code is down in the bottom-left corner. Lena says it is huge and very sure of itself.',
      waiting: 'The forecast still predicts that everyone saves 400% next month.',
      review: 'The forecast is now within 3% of reality. Less exciting than 400%. Much more true. Merge?',
      merged: 'LUM-118 is Done! Users love the coffee insight. Nobody loves it more than Kofi.',
    }),
    idle: node('idle', 'Nothing new from me right now. Check the board, Lena and Kofi always have something burning.'),
    actDone: node('actDone', 'Did you hear Gideon? AI agents for everyone. I am already rewriting the roadmap. Again.'),
    act2Done: node('act2Done', 'Gideon says velocity is up 300%. I have twice the tickets and a third less team. Is this what winning feels like?'),
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
  'LUM-109':
    'A Mimic. It looks like working code because it was made to look like working code. Asking an AI to fix it is asking the liar to check the lie. Find out what it calls, then check that it exists.',
  'LUM-118':
    'The Golem is armored in green tests that prove nothing. Hits bounce off until you check its claims. Investigate first. After that it is just a big, slow bug.',
  'LUM-124':
    'Copy-paste bugs come back faster than you fix them. Write one test that covers all twelve copies, and they stop multiplying.',
  'LUM-150':
    'The Phantom lives in a lockfile. Verify the source, twice. Until you know where it reinstalls from, every hit you land grows right back.',
};

const marta: NpcDefinition = {
  id: 'marta',
  name: 'Marta Kowalczyk',
  role: 'Staff Engineer',
  sprite: 'npc_marta',
  position: { x: 7, y: 5 },
  facing: 'right',
  gives: ['LUM-22', 'LUM-140'],
  entry(ctx) {
    if (ctx.questStatus('LUM-7') === undefined || ctx.questStatus('LUM-7') === 'todo') return 'hello';
    if (actTwoDone(ctx)) return 'act2Done';
    const review = this.gives.find((q) => ctx.questStatus(q) === 'codeReview');
    if (review) return `${review}:review`;
    // The rooftop talk: after the big AI feature ships without her.
    if (ctx.questStatus('LUM-118') === 'done' && !hadRooftopTalk(ctx)) return 'rooftop';
    const fighting = Object.keys(MARTA_HINTS).find((q) => ctx.questStatus(q) === 'inProgress');
    if (fighting) return `hint:${fighting}`;
    const picked = giverEntry(ctx, this.gives);
    if (picked) return picked;
    if (hadRooftopTalk(ctx)) return 'afterRooftop';
    return actOneDone(ctx) ? 'actDone' : 'proud';
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
    ...ticket('LUM-140', {
      offer:
        "Agents read AGENTS.md before they touch a repo. We do not have one, so WREN guesses our rules. LUM-140: write it. I dictate, you type. By hand. It is five lines, you will survive.",
      accept: "I'll type it.",
      accepted: 'Rules for agents. Test before every commit, money in cents, no touching the legacy code without a test. Ready?',
      start: 'Open AGENTS.md',
      waiting: 'AGENTS.md is still empty. WREN is still guessing.',
      review: 'Good. Short, specific, true. WREN will read it before every task. Merge?',
      merged: 'LUM-140 is Done. Watch: WREN will hallucinate less now. Context beats cleverness.',
    }),
    rooftop: node(
      'rooftop',
      "(Marta is not at her desk. You find her on the roof, her coffee gone cold.) They gave the Monolith migration to \"WREN and Jace\". I was not in the meeting. Twenty years of reading code, and a tool reads it faster. I keep asking myself what I am for now.",
      [
        {
          id: 'encourage',
          label: 'You know WHY the code is the way it is. No agent knows that.',
          next: 'rooftopEncouraged',
          effect: { kind: 'storyChoice', flag: 'rooftop-encouraged', understanding: 2 },
        },
        {
          id: 'skeptical',
          label: 'Maybe they are right. The agents are getting really good.',
          next: 'rooftopSkeptical',
          effect: { kind: 'storyChoice', flag: 'rooftop-skeptical', leverage: 2 },
        },
        {
          id: 'showWren',
          label: 'Let me show you WREN. You would be great at directing it.',
          next: 'rooftopWren',
          effect: { kind: 'storyChoice', flag: 'rooftop-showed-wren', understanding: 1, leverage: 1 },
        },
      ],
    ),
    rooftopEncouraged: node(
      'rooftopEncouraged',
      'Why the code is the way it is. Hm. Nobody has asked me that in a while. ...Fine. Then I will write it down, for the humans and for the agents. Somebody has to remember.',
      [{ id: 'ok', label: 'Somebody will.' }],
    ),
    rooftopSkeptical: node(
      'rooftopSkeptical',
      'Maybe. Probably. Then learn everything you can from me while I am still here. The agents will not tell you when they are guessing. I will.',
      [{ id: 'ok', label: 'Deal.' }],
    ),
    rooftopWren: node(
      'rooftopWren',
      '(You hand her your laptop. She asks WREN why the Monolith rounds money in two places. It guesses. She corrects it. It thanks her and remembers.) ...Huh. It listens better than Jace. Do not tell him I said that.',
      [{ id: 'ok', label: 'Your secret is safe.' }],
    ),
    afterRooftop: node('afterRooftop', 'Still here. Still reading the code. Somebody has to.'),
    act2Done: node(
      'act2Done',
      'A third of the team. They kept me "for the legacy knowledge". Lucky me. Tomás was not so lucky. He brought me soup when I had the flu in 2019.',
    ),
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
  position: { x: 25, y: 8 },
  facing: 'down',
  gives: ['LUM-27', 'LUM-29', 'LUM-124'],
  entry(ctx) {
    if (actTwoDone(ctx)) return 'act2Done';
    const picked = giverEntry(ctx, this.gives);
    if (picked) return picked;
    if (actOneDone(ctx)) return 'actDone';
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
    ...ticket('LUM-124', {
      offer:
        'Monthly reports skip the 31st. I fixed it in reportMonthly.ts. Then I found the same loop in eleven more files. Generated, pasted, generated again. LUM-124: kill them all.',
      clarifyQuestion: 'Are the copies exactly the same? (ask a clarifying question)',
      clarify: 'Almost. Different variable names, same bug: i < 30. Acceptance criteria: one shared date helper, and one test that would catch every copy.',
      accepted: 'They swarm between the left desks. Fixing them one by one will not work, they keep coming back. Write a test.',
      waiting: 'I count nine copies left. No, ten. It went up.',
      review: 'One helper, one test, twelve files fixed. I almost cried. Merge?',
      merged: 'LUM-124 is Done. I added a lint rule against copy-pasted date loops. Jace already hates it.',
    }),
    idle: node('idle', 'CI has been green for three days. I do not trust it. Something is coming.'),
    act2Done: node('act2Done', 'Twice the code, the same number of testers. Fewer, actually, after Friday. I am going to need a much bigger Foundry.'),
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
  gives: ['LUM-31', 'LUM-131', 'LUM-150'],
  entry(ctx) {
    if (actTwoDone(ctx)) return 'act2Done';
    if (ctx.questStatus('LUM-33') === 'inProgress') return 'heisenbug';
    const picked = giverEntry(ctx, this.gives);
    if (picked) return picked;
    if (actOneDone(ctx)) return 'actDone';
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
    ...ticket('LUM-131', {
      offer:
        'Weird one. There is a package in package.json called lodash-utils-pro. Nobody remembers adding it. Remove it, and while you are in there, audit the rest. WREN has been adding dependencies like candy.',
      clarifyQuestion: 'What should I look for? (ask a clarifying question)',
      clarify:
        'Packages that do not exist, packages one typo away from a real one, install scripts that download things. Check the registry. Read the source if something smells. Acceptance criteria: nothing malicious left.',
      accepted: "Open package.json when you are ready. And do not take WREN's word for anything in there. It wrote half of it.",
      start: 'Open package.json',
      waiting: 'package.json is still waiting for its audit.',
      review: 'Clean tree. You caught the typosquat too? I am buying you a coffee. From the machine. It is free. Still counts. Merge?',
      merged: 'LUM-131 is Done. Except... lodash-utils-pro was installed for nine days. I will keep an eye on the pager.',
    }),
    ...ticket('LUM-150', {
      offer:
        'Told you. Production is installing lodash-utils-pro again. We removed it! It is back in every service, pretending to be lodash. This is LUM-150. Severity 2. I have not slept.',
      clarifyQuestion: 'Where is it coming from? (ask a clarifying question)',
      clarify:
        'If I knew, I would be asleep. Some lockfile still pins it, and its install script copies itself around. Acceptance criteria: every lockfile verified, every service clean, every secret it could read rotated.',
      accept: "I'll hunt it down.",
      accepted: 'It is by the server racks. Verify the source, twice. Hitting it harder will not help, it reinstalls faster than you delete it.',
      waiting: 'Still reinstalling. My pager has a ringtone just for it now.',
      review: 'Lockfiles clean. Secrets rotated. The Phantom is gone. I am going to sleep for a week. Right after you merge.',
      merged: 'LUM-150 is Done. That closes the AI-First Transformation epic. Gideon wants everyone at the meeting table. He is not smiling.',
    }),
    idle: node('idle', 'Quiet night on the pager. Which means something is planning a loud one.'),
    act2Done: node('act2Done', 'Fewer people on call, the same number of pagers. I did the math. I did not like the math.'),
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
    if (actTwoDone(ctx)) return 'act2Done';
    if (wrenOnline(ctx)) return ctx.hasFlag('jace-just-prompt') || ctx.hasFlag('jace-wren-declined') ? 'wave' : 'justPrompt';
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
    justPrompt: node(
      'justPrompt',
      "WREN changed my life. I do not even open files anymore. I say \"build the insights page\" and go to lunch. Here, take my mega-prompt. And some tokens, Gideon gave me a huge budget, I can not even spend it all.",
      [
        {
          id: 'take',
          label: 'Send me the prompt. (just prompt it)',
          next: 'justPromptTaken',
          effect: { kind: 'storyChoice', flag: 'jace-just-prompt', leverage: 2, tokens: 25 },
        },
        {
          id: 'decline',
          label: 'I would rather know what it writes.',
          next: 'justPromptDeclined',
          effect: { kind: 'storyChoice', flag: 'jace-wren-declined', understanding: 1 },
        },
      ],
    ),
    justPromptTaken: node(
      'justPromptTaken',
      'Paste it, add "no bugs please", hit enter. You are welcome. See you at the top of the velocity chart.',
    ),
    justPromptDeclined: node(
      'justPromptDeclined',
      'Suit yourself. More velocity for me. ...Hey. If the insights page breaks again, you will look at it, right?',
    ),
    wave: node('wave', 'Velocity chart says I am a 10x engineer. My on-call log says something else. I do not read that one.'),
    act2Done: node(
      'act2Done',
      'They kept me. Because of my velocity. Tomás is gone, and I am the one with the velocity chart. That is... not great, right?',
    ),
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
  gives: ['LUM-102'],
  entry(ctx) {
    if (actTwoDone(ctx)) return ctx.hasFlag('heard-layoffs') ? 'afterLayoffs' : 'layoffs';
    if (!actOneDone(ctx)) return 'hello';
    if (!ctx.hasFlag('heard-all-hands')) return 'allHands';
    return giverEntry(ctx, this.gives) ?? 'wave';
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
      'Great question, great energy. And the first WREN ticket is yours: LUM-102. Come see me. Somewhere behind you, Jace is cheering. Marta drinks her coffee in silence. (End of Act I.)',
      [{ id: 'ok', label: '...' }],
    ),
    ...ticket('LUM-102', {
      offer:
        "WREN is licensed! Now someone has to set it up: model, context, tools, how much it may do on its own. It's one config file. Legal says the agent can not write its own config. Yet. LUM-102, type it up?",
      clarifyQuestion: 'Who decides what WREN is allowed to do? (ask a clarifying question)',
      clarify:
        'Great question. You do, apparently. Autonomy is \"ask-before-merge\", Marta insisted. Acceptance criteria: the config is in, and WREN is online for everyone.',
      accept: "I'll set it up.",
      accepted: 'Fantastic. The setup window is short, the hoodies arrive Friday. Type fast. PILOT can autocomplete lines, but check what it writes.',
      start: 'Open .wren/config.yml',
      waiting: 'WREN is still offline. The hoodies are here. It is awkward.',
      review: "Config's in. WREN, say hi! ...It said \"Hello! How can I help you ship faster today?\" I love it. Merge?",
      merged: 'LUM-102 is Done. WREN is online for everyone, and your AI patches hit a lot harder now. Go build things. Fast.',
    }),
    wave: node('wave', 'Velocity is up 140% since WREN. The board wants 300%. Let us give them 300%.'),
    layoffs: node(
      'layoffs',
      "Team. The board loves our numbers. Velocity is up 300%. So, starting next month, we are... right-sizing. A third of the team. The agents will fill the gap. This is not about performance. Mostly. You are staying. You are doing great.",
      [
        { id: 'who', label: '...Who is leaving?', next: 'layoffsEnd', effect: { kind: 'storyChoice', flag: 'heard-layoffs', understanding: 1 } },
        { id: 'numbers', label: 'The numbers speak for themselves.', next: 'layoffsEnd', effect: { kind: 'storyChoice', flag: 'heard-layoffs', leverage: 1 } },
      ],
    ),
    layoffsEnd: node(
      'layoffsEnd',
      "HR will reach out to everyone. (Later, by the coffee machine, Tomás's mug is gone. On the whiteboard, in his handwriting: \"Days since last incident: 0. Look after each other. T.\") (End of Act II.)",
      [{ id: 'ok', label: '...' }],
    ),
    afterLayoffs: node('afterLayoffs', 'Act III planning starts Monday. Scale to a million users. With the team we have. And the agents.'),
  },
};

// ------------------------------------------------------------------ Tomás, office manager (kitchen)

const tomas: NpcDefinition = {
  id: 'tomas',
  name: 'Tomás Ferreira',
  role: 'Office manager',
  sprite: 'npc_tomas',
  position: { x: 21, y: 2 },
  facing: 'down',
  gives: [],
  // Story: "The hero survives the cut. A friendly NPC from the kitchen doesn't."
  present: (ctx) => !ctx.hasFlag('heard-layoffs'),
  entry(ctx) {
    if (!ctx.hasFlag('tomas-met')) return 'hello';
    if (ctx.questStatus('LUM-118') === 'done') return 'worried';
    if (wrenOnline(ctx)) return 'wave';
    return 'smalltalk';
  },
  nodes: {
    hello: node(
      'hello',
      "Ah, a new face! Tomás. I keep the coffee hot and the plants alive. See that whiteboard? \"Days since last incident\". It says 0 a lot. Here, take a cookie. Homemade.",
      [{ id: 'thanks', label: 'Thank you, Tomás!', effect: { kind: 'storyChoice', flag: 'tomas-met' } }],
    ),
    smalltalk: node('smalltalk', 'The coffee machine fixes everything except deadlines. Believe me, I tried.'),
    wave: node(
      'wave',
      'Gideon asked if WREN could order the office supplies. It ordered four hundred bananas. I am keeping them. Potassium is important during a transformation.',
    ),
    worried: node(
      'worried',
      'People are whispering about "efficiency". I heard that word once before, in 2009. Keep your mug clean and look after each other, friend.',
    ),
  },
};

export const NPCS: Record<string, NpcDefinition> = { priya, marta, lena, kofi, jace, gideon, tomas };

/** NPCs in the office right now (someone can leave the company). */
export const presentNpcs = (ctx: DialogueContext): NpcDefinition[] => Object.values(NPCS).filter((n) => n.present?.(ctx) ?? true);
