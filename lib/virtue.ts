import type { SkinKey } from './skins';

// VP per coin type earned
export const VP_RATES = {
  small:  2,
  large:  5,
  golden: 15,
} as const;

// VP bonus events
export const VP_EVENTS = {
  full_day:       10,
  quest_complete: 20,
  streak_7:       25,
  streak_30:      100,
} as const;

// Total VP needed to REACH each level (index = level)
export const LEVEL_THRESHOLDS = [
  0,    // L1 — start here
  30,   // L2
  80,   // L3
  160,  // L4
  280,  // L5
  450,  // L6
  680,  // L7
  980,  // L8
  1360, // L9
  1850, // L10
] as const;

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export function calcLevel(totalVp: number): { level: number; vpInLevel: number; vpToNext: number } {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalVp >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }
  const thisFloor = LEVEL_THRESHOLDS[level - 1];
  const nextFloor = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 1000;
  return {
    level,
    vpInLevel:  totalVp - thisFloor,
    vpToNext:   nextFloor - thisFloor,
  };
}

// Which skins unlock at which level (1-indexed)
export const SKIN_UNLOCK_LEVELS: Record<SkinKey, number> = {
  cloud_kingdom:  1,
  rainbow_studio: 2,
  deep_ocean:     3,
  jungle_quest:   4,
  zen_garden:     5,
  space_command:  6,
  pixel_world:    7,
  cyber_pulse:    8,
  first_person:   9,
  dark_knight:    10,
};

export function isSkinUnlocked(skin: SkinKey, virtueLevel: number): boolean {
  return virtueLevel >= SKIN_UNLOCK_LEVELS[skin];
}
