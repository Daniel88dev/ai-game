import type { EnemyDefinition } from '../combat/battle';

export const ENEMIES: Record<string, EnemyDefinition> = {
  nullPointerBeetle: {
    id: 'nullPointerBeetle',
    name: 'NullPointer Beetle',
    sprite: 'bug_null_pointer',
    maxHp: 26,
    attack: 4,
    shellMissChance: 0.4,
    xp: 40,
    attackName: 'NullPointerException',
    heavyAttackName: 'Uncaught Stack Overflow',
    heavyEvery: 3,
    rootCause: 'user.avatar is null when onboarding is skipped',
  },
};
