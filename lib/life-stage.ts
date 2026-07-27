// Single source of truth for life stages.
// Mirrors the `life_stage` check constraint on the profiles table.

export const LIFE_STAGES = [
  {
    key:   'little',
    label: 'Little',
    hint:  'Roughly 4–7. Big buttons, few words, lots of praise.',
    icon:  '🧒',
  },
  {
    key:   'young',
    label: 'Young',
    hint:  'Roughly 8–12. Coins, quests and streaks land well here.',
    icon:  '👦',
  },
  {
    key:   'teen',
    label: 'Teen',
    hint:  'Roughly 13–17. Real money, autonomy, less gamified.',
    icon:  '🧑',
  },
  {
    key:   'adult',
    label: 'Adult',
    hint:  'Full access to life admin, drafts and household tools.',
    icon:  '🧔',
  },
  {
    key:   'elder',
    label: 'Elder',
    hint:  'Larger text, calmer pacing, simplified navigation.',
    icon:  '🧓',
  },
] as const;

export type LifeStage = typeof LIFE_STAGES[number]['key'];

// Stages a parent can assign when adding a family member
export const ASSIGNABLE_STAGES = LIFE_STAGES.filter(
  s => s.key !== 'elder',
);

// Teens and above get the grown-up experience: real cash framing,
// no coin animations, access to Kempt life admin.
export function isGrownUp(stage: LifeStage): boolean {
  return stage === 'teen' || stage === 'adult' || stage === 'elder';
}

// Little and young get the full game layer
export function isGamified(stage: LifeStage): boolean {
  return stage === 'little' || stage === 'young';
}

export function stageLabel(stage: LifeStage): string {
  return LIFE_STAGES.find(s => s.key === stage)?.label ?? stage;
}

export function stageIcon(stage: LifeStage): string {
  return LIFE_STAGES.find(s => s.key === stage)?.icon ?? '👤';
}
