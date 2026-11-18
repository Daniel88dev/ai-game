import type { QuestDefinition } from '../quest/quest';

/**
 * Tickets by act.
 *
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

  /*
   * Act II, "The Wave" (Epic: AI-First Transformation). See story/game-story.md §4.
   *
   *   LUM-102 ─┬─ LUM-109 ─┬─ LUM-118 ─┐
   *   (WREN)   │           └─ LUM-124 ─┼─ LUM-150 (Act II boss: the Phantom Package)
   *            ├─ LUM-131 ─────────────┘
   *            └─ LUM-140 (optional: onboarding doc for agents, WREN hallucinates less)
   */
  {
    id: 'LUM-102',
    title: 'Enable AI assistant for all engineers',
    type: 'Task',
    storyPoints: 2,
    act: 2,
    giverNpcId: 'gideon',
    requires: ['LUM-33'],
    requiresFlag: 'heard-all-hands',
    description: "Gideon wants WREN running on every laptop by Friday. Someone has to write its config by hand first. WREN can't configure itself. Yet.",
    acceptanceCriteria: [
      { text: "Type out WREN's config before the setup window closes (grade C or better)", metOn: 'fix' },
      { text: 'WREN is online for the whole team', metOn: 'merge' },
    ],
    objective: { kind: 'minigame', minigame: 'typing', passGrade: 'C' },
    reward: { xp: 90, tokens: 20, clarifiedBonusXp: 20 },
  },
  {
    id: 'LUM-109',
    title: 'Insights page calls an API that does not exist',
    type: 'Bug',
    storyPoints: 3,
    act: 2,
    giverNpcId: 'priya',
    requires: ['LUM-102'],
    description: 'Jace and WREN shipped the new insights page in an afternoon. It looks perfect. It also throws "getInsights is not a function" for every user.',
    acceptanceCriteria: [
      { text: 'Fix the Hallucination Mimic in the insights code', metOn: 'fix' },
      { text: 'The page shows real numbers from a real API', metOn: 'merge' },
    ],
    objective: { kind: 'defeat', encounterId: 'lum109-mimic' },
    reward: { xp: 110, tokens: 18, clarifiedBonusXp: 25 },
  },
  {
    id: 'LUM-118',
    title: 'Build budgeting insights with AI',
    type: 'Story',
    storyPoints: 5,
    act: 2,
    giverNpcId: 'priya',
    requires: ['LUM-109'],
    description: 'The first big AI-driven feature: "You spent 30% more on coffee this month." The generated forecasting module passes every test it wrote for itself.',
    acceptanceCriteria: [
      { text: 'Break the Confident Golem in the forecasting module', metOn: 'fix' },
      { text: 'Forecasts are checked against real data', metOn: 'merge' },
    ],
    objective: { kind: 'defeat', encounterId: 'lum118-golem' },
    reward: { xp: 130, tokens: 20, clarifiedBonusXp: 25 },
  },
  {
    id: 'LUM-124',
    title: 'Same date bug in twelve places',
    type: 'Bug',
    storyPoints: 3,
    act: 2,
    giverNpcId: 'lena',
    requires: ['LUM-109'],
    description: 'Monthly reports skip the 31st. Lena fixed it in one file. It is still broken in eleven others, because the code was generated, copied and pasted.',
    acceptanceCriteria: [
      { text: 'Clear the Copy-Paste Swarm', metOn: 'fix' },
      { text: 'One shared date helper, one test', metOn: 'merge' },
    ],
    objective: { kind: 'defeat', encounterId: 'lum124-swarm' },
    reward: { xp: 120, tokens: 18, clarifiedBonusXp: 25 },
  },
  {
    id: 'LUM-131',
    title: 'Remove unused package lodash-utils-pro',
    type: 'Task',
    storyPoints: 2,
    act: 2,
    giverNpcId: 'kofi',
    requires: ['LUM-102'],
    description: 'Kofi noticed a package nobody remembers adding. While you are in package.json, audit the rest. WREN added a few things lately.',
    acceptanceCriteria: [
      { text: 'Audit every dependency (grade C or better)', metOn: 'fix' },
      { text: 'Nothing malicious left in the lockfile', metOn: 'merge' },
    ],
    objective: { kind: 'minigame', minigame: 'packageAudit', passGrade: 'C' },
    reward: { xp: 110, tokens: 18, clarifiedBonusXp: 20 },
  },
  {
    id: 'LUM-140',
    title: 'Write onboarding doc for agents',
    type: 'Task',
    storyPoints: 1,
    act: 2,
    giverNpcId: 'marta',
    requires: ['LUM-102'],
    description: 'Agents read AGENTS.md before they touch the code. Lumen does not have one. Marta has opinions about what goes in it.',
    acceptanceCriteria: [
      { text: 'Type out AGENTS.md (grade C or better)', metOn: 'fix' },
      { text: 'WREN reads it before every task (it hallucinates less)', metOn: 'merge' },
    ],
    objective: { kind: 'minigame', minigame: 'typing', passGrade: 'C' },
    reward: { xp: 80, tokens: 15, clarifiedBonusXp: 0 },
  },
  {
    id: 'LUM-150',
    title: 'Production is installing something called lodash-utils-pro',
    type: 'Bug',
    storyPoints: 8,
    act: 2,
    giverNpcId: 'kofi',
    requires: ['LUM-118', 'LUM-124', 'LUM-131'],
    description: "The package is gone from package.json, but the production servers still pull it. It hides in an old lockfile, pretends to be lodash, and copies itself into every service.",
    acceptanceCriteria: [
      { text: 'Hunt down the Phantom Package by the server racks', metOn: 'fix' },
      { text: 'Every lockfile verified, every service clean', metOn: 'merge' },
      { text: 'Rotate every secret it could read', metOn: 'merge' },
    ],
    objective: { kind: 'defeat', encounterId: 'lum150-phantom' },
    reward: { xp: 200, tokens: 30, clarifiedBonusXp: 40 },
    completesAct: { act: 2, title: 'The Wave' },
  },
];

export const QUESTS: Record<string, QuestDefinition> = Object.fromEntries(quests.map((q) => [q.id, q]));
export const QUEST_ORDER: readonly string[] = quests.map((q) => q.id);
