import type { QuestDefinition } from '../quest/quest';

/**
 * Act I, "Before the Wave" (Epic: Lumen 2.0). See story/game-story.md §4-5.
 *
 *   LUM-7  ─┬─ LUM-14 ─┬─ LUM-31 ─┐
 *           │          └─ LUM-35 ─┤
 *           ├─ LUM-22 ────────────┼─ LUM-33 (Act I boss: the Heisenbug)
 *           └─ LUM-27 ── LUM-29 ──┘
 */
const quests: QuestDefinition[] = [
  {
    id: 'LUM-7',
    title: 'Login crashes for users without an avatar',
    type: 'Bug',
    storyPoints: 2,
    act: 1,
    giverNpcId: 'priya',
    requires: [],
    description: 'Some users get a white screen right after login. Priya thinks it is "something with avatars".',
    acceptanceCriteria: [
      { text: 'The NullPointer Beetle near your desk is fixed', metOn: 'fix' },
      { text: 'Users without an avatar can log in', metOn: 'merge' },
      { text: 'They see the default avatar', metOn: 'merge' },
    ],
    objective: { kind: 'defeat', encounterId: 'lum7-beetle' },
    reward: { xp: 60, tokens: 15, clarifiedBonusXp: 20 },
  },
  {
    id: 'LUM-14',
    title: 'Add "Export to CSV" button',
    type: 'Story',
    storyPoints: 3,
    act: 1,
    giverNpcId: 'priya',
    requires: ['LUM-7'],
    description: 'Users want their transactions in a spreadsheet. The export exists, but every file is missing a row.',
    acceptanceCriteria: [
      { text: 'Fix the Off-by-One Imp in the export code', metOn: 'fix' },
      { text: 'The CSV has every transaction, including the last one', metOn: 'merge' },
      { text: 'Button on the transactions page', metOn: 'merge' },
    ],
    objective: { kind: 'defeat', encounterId: 'lum14-imp' },
    reward: { xp: 70, tokens: 15, clarifiedBonusXp: 20 },
  },
  {
    id: 'LUM-22',
    title: "Review Jace's PR #42",
    type: 'Task',
    storyPoints: 2,
    act: 1,
    giverNpcId: 'marta',
    requires: ['LUM-7'],
    description: 'Jace wrote currency formatting for the dashboard with PILOT in twenty minutes. Marta wants a second pair of eyes before it merges.',
    acceptanceCriteria: [
      { text: 'Review the diff and leave comments (grade C or better)', metOn: 'fix' },
      { text: 'Nothing critical reaches main', metOn: 'merge' },
    ],
    objective: { kind: 'minigame', minigame: 'codeReview', passGrade: 'C' },
    reward: { xp: 60, tokens: 12, clarifiedBonusXp: 0 },
  },
  {
    id: 'LUM-27',
    title: 'Investigate why the test suite takes 9 minutes',
    type: 'Spike',
    storyPoints: 3,
    act: 1,
    giverNpcId: 'lena',
    requires: ['LUM-7'],
    description: 'The release build keeps going red and everyone just presses "re-run". Lena wants to know why, before Friday\'s release.',
    acceptanceCriteria: [
      { text: 'Get main green before the release window closes', metOn: 'fix' },
      { text: 'Write down what made the tests flaky', metOn: 'merge' },
    ],
    objective: { kind: 'minigame', minigame: 'ciPipeline', passGrade: 'C' },
    reward: { xp: 80, tokens: 17, clarifiedBonusXp: 20 },
  },
  {
    id: 'LUM-29',
    title: 'Cover the budget calculator with tests',
    type: 'Task',
    storyPoints: 3,
    act: 1,
    giverNpcId: 'lena',
    requires: ['LUM-27'],
    description: 'monthlyBudget() decides what users can spend. It has zero tests. Lena wants coverage, and she wants the tests to actually check something.',
    acceptanceCriteria: [
      { text: 'Reach a passing grade on coverage and mutation score', metOn: 'fix' },
      { text: 'Tests run in CI', metOn: 'merge' },
    ],
    objective: { kind: 'minigame', minigame: 'coverage', passGrade: 'C' },
    reward: { xp: 80, tokens: 15, clarifiedBonusXp: 0 },
  },
  {
    id: 'LUM-31',
    title: 'Dashboard gets slower every hour',
    type: 'Bug',
    storyPoints: 3,
    act: 1,
    giverNpcId: 'kofi',
    requires: ['LUM-14'],
    description: 'Kofi\'s graphs show the dashboard tab eating memory until the browser gives up. Something subscribes and never unsubscribes.',
    acceptanceCriteria: [
      { text: 'Fix the Memory Leak Slime by the meeting table', metOn: 'fix' },
      { text: 'Memory stays flat after an hour', metOn: 'merge' },
    ],
    objective: { kind: 'defeat', encounterId: 'lum31-slime' },
    reward: { xp: 90, tokens: 17, clarifiedBonusXp: 20 },
  },
  {
    id: 'LUM-35',
    title: 'The avatar crash is back',
    type: 'Bug',
    storyPoints: 2,
    act: 1,
    giverNpcId: 'priya',
    requires: ['LUM-14'],
    description: 'Users without an avatar see a white screen again. Someone refactored the login page. There was no test to catch it.',
    acceptanceCriteria: [
      { text: 'Fix the Regression Revenant at your desk', metOn: 'fix' },
      { text: 'Add a test so it stays dead', metOn: 'merge' },
    ],
    objective: { kind: 'defeat', encounterId: 'lum35-revenant' },
    reward: { xp: 80, tokens: 15, clarifiedBonusXp: 20 },
  },
  {
    id: 'LUM-33',
    title: 'Balance shows -0.00 for some users',
    type: 'Bug',
    storyPoints: 8,
    act: 1,
    giverNpcId: 'priya',
    requires: ['LUM-22', 'LUM-29', 'LUM-31', 'LUM-35'],
    description: 'A few users see a balance of -0.00, sometimes. Nobody can reproduce it. Every time someone attaches a debugger, it goes away.',
    acceptanceCriteria: [
      { text: 'Corner the Heisenbug by the server racks', metOn: 'fix' },
      { text: 'Balances never show -0.00', metOn: 'merge' },
      { text: 'Write down where the bug really lives', metOn: 'merge' },
    ],
    objective: { kind: 'defeat', encounterId: 'lum33-heisenbug' },
    reward: { xp: 150, tokens: 25, clarifiedBonusXp: 30 },
    completesAct: { act: 1, title: 'Before the Wave' },
  },
];

export const QUESTS: Record<string, QuestDefinition> = Object.fromEntries(quests.map((q) => [q.id, q]));
export const QUEST_ORDER: readonly string[] = quests.map((q) => q.id);
