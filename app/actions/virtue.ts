'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { VP_RATES, VP_EVENTS, LEVEL_THRESHOLDS } from '@/lib/virtue';

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function awardVirtuePoints(
  profileId: string,
  coins: { small?: number; large?: number; golden?: number },
  events?: { full_day?: boolean; quest_complete?: boolean },
): Promise<{ levelUp: boolean; newLevel: number; badgesAwarded: string[] }> {
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('virtue_points, virtue_level')
    .eq('id', profileId)
    .single();

  if (!profile) return { levelUp: false, newLevel: 1, badgesAwarded: [] };

  let vp = 0;
  vp += (coins.small  ?? 0) * VP_RATES.small;
  vp += (coins.large  ?? 0) * VP_RATES.large;
  vp += (coins.golden ?? 0) * VP_RATES.golden;
  if (events?.full_day)       vp += VP_EVENTS.full_day;
  if (events?.quest_complete) vp += VP_EVENTS.quest_complete;

  const newTotalVp = (profile.virtue_points ?? 0) + vp;

  let newLevel = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (newTotalVp >= LEVEL_THRESHOLDS[i]) { newLevel = i + 1; break; }
  }

  const levelUp = newLevel > (profile.virtue_level ?? 1);

  await supabase.from('profiles').update({
    virtue_points: newTotalVp,
    virtue_level:  newLevel,
  }).eq('id', profileId);

  const badgesAwarded = await checkBadges(profileId, supabase, newLevel);

  return { levelUp, newLevel, badgesAwarded };
}

/**
 * Award any badges the profile has newly qualified for.
 * Returns only the keys awarded on this call.
 */
async function checkBadges(
  profileId: string,
  supabase: SupabaseClient,
  virtueLevel: number,
): Promise<string[]> {
  const [
    { data: account },
    { data: streak },
    { count: completionCount },
    { count: serviceActCount },
    { data: existingBadges },
    { data: allBadges },
  ] = await Promise.all([
    // golden_balance lives on balance_accounts, not profiles
    supabase.from('balance_accounts')
      .select('lifetime_large, lifetime_golden, golden_balance')
      .eq('profile_id', profileId).maybeSingle(),
    supabase.from('streaks')
      .select('current_streak, longest_streak')
      .eq('profile_id', profileId).maybeSingle(),
    supabase.from('task_completions')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId),
    // Service acts = approved completions of tasks in the 'service' category
    supabase.from('task_completions')
      .select('id, tasks!inner(category)', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('tasks.category', 'service')
      .not('approved_at', 'is', null),
    // profile_badges has a composite PK — select the FK, not a non-existent id
    supabase.from('profile_badges')
      .select('badge_id')
      .eq('profile_id', profileId),
    supabase.from('badges').select('id, key'),
  ]);

  const badgeIdByKey  = Object.fromEntries((allBadges ?? []).map(b => [b.key, b.id]));
  const keyByBadgeId  = Object.fromEntries((allBadges ?? []).map(b => [b.id, b.key]));
  const alreadyEarned = new Set(
    (existingBadges ?? []).map(b => keyByBadgeId[b.badge_id]).filter(Boolean),
  );

  const toAward: string[] = [];
  function maybe(key: string, condition: boolean) {
    if (condition && !alreadyEarned.has(key) && badgeIdByKey[key]) toAward.push(key);
  }

  maybe('first_steps',     (completionCount ?? 0) >= 1);
  maybe('keeper_of_order', (streak?.longest_streak ?? 0) >= 7);
  maybe('streak_legend',   (streak?.longest_streak ?? 0) >= 30);
  maybe('community_hero',  (serviceActCount ?? 0) >= 3);
  maybe('big_saver',       (account?.lifetime_large ?? 0) >= 100);
  maybe('virtue_rising',   virtueLevel >= 5);
  maybe('golden_moment',   (account?.lifetime_golden ?? 0) > 0);

  if (toAward.length > 0) {
    // Ignore duplicates if two completions race
    await supabase.from('profile_badges').upsert(
      toAward.map(key => ({ profile_id: profileId, badge_id: badgeIdByKey[key] })),
      { onConflict: 'profile_id,badge_id', ignoreDuplicates: true },
    );
  }

  return toAward;
}

/** Award quest badges. Call after a quest completion is credited. */
export async function awardQuestBadges(profileId: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient();

  const [{ data: allBadges }, { data: existing }, { count: questCount }] = await Promise.all([
    supabase.from('badges').select('id, key'),
    supabase.from('profile_badges').select('badge_id').eq('profile_id', profileId),
    // Count completions of tasks in the 'quest' category
    supabase.from('task_completions')
      .select('id, tasks!inner(category)', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('tasks.category', 'quest'),
  ]);

  const badgeIdByKey = Object.fromEntries((allBadges ?? []).map(b => [b.key, b.id]));
  const keyByBadgeId = Object.fromEntries((allBadges ?? []).map(b => [b.id, b.key]));
  const alreadyEarned = new Set(
    (existing ?? []).map(b => keyByBadgeId[b.badge_id]).filter(Boolean),
  );

  const count = questCount ?? 0;
  const toAward: string[] = [];
  if (!alreadyEarned.has('quest_champion') && count >= 1)  toAward.push('quest_champion');
  if (!alreadyEarned.has('quest_master')   && count >= 10) toAward.push('quest_master');

  if (toAward.length > 0) {
    await supabase.from('profile_badges').upsert(
      toAward.map(key => ({ profile_id: profileId, badge_id: badgeIdByKey[key] })),
      { onConflict: 'profile_id,badge_id', ignoreDuplicates: true },
    );
  }

  return toAward;
}

/** Award a single badge by key if not already held. */
async function awardBadgeByKey(profileId: string, key: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  const { data: badge } = await supabase
    .from('badges').select('id').eq('key', key).maybeSingle();
  if (!badge) return false;

  const { data: existing } = await supabase
    .from('profile_badges')
    .select('badge_id')
    .eq('profile_id', profileId)
    .eq('badge_id', badge.id)
    .maybeSingle();
  if (existing) return false;

  const { error } = await supabase
    .from('profile_badges')
    .insert({ profile_id: profileId, badge_id: badge.id });

  return !error;
}

export async function awardCashoutBadge(profileId: string): Promise<boolean> {
  return awardBadgeByKey(profileId, 'first_cashout');
}

export async function awardGoldenBadge(profileId: string): Promise<boolean> {
  return awardBadgeByKey(profileId, 'golden_moment');
}

export async function awardGiftGiverBadge(profileId: string): Promise<boolean> {
  return awardBadgeByKey(profileId, 'gift_giver');
}
