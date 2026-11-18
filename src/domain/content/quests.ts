import type { QuestDefinition } from '../quest/quest';

export const QUESTS: Record<string, QuestDefinition> = {
  'LUM-7': {
    id: 'LUM-7',
    title: 'Login crashes for users without an avatar',
    type: 'Bug',
    storyPoints: 2,
    giverNpcId: 'priya',
    description:
      'Some users get a white screen right after login. Priya thinks it is "something with avatars".',
    acceptanceCriteria: [
      { text: 'The NullPointer Beetle near your desk is fixed', metOn: 'fix' },
      { text: 'Users without an avatar can log in', metOn: 'merge' },
      { text: 'They see the default avatar', metOn: 'merge' },
    ],
    targetEncounterId: 'lum7-beetle',
    reward: { xp: 60, tokens: 20, clarifiedBonusXp: 20 },
  },
};
