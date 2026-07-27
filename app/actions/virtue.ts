'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { VP_RATES, LEVEL_THRESHOLDS } from '@/lib/virtue';

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
  if (events?.full_day)       vp += 10;
  if (events?.quest_complete) vp += 20;

  const newTotalVp = profile.virtue_points + vp;

  // Determine level from total VP
  let newLevel = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (newTotalVp >= LEVEL_THRESHOLDS[i]) { newLevel = i + 1; break; }
  }

  const levelUp = newLevel > profile.virtue_level;

  await supabase.from('profiles').update({
    virtue_points: newTotalVp,
    virtue_level:  newLevel,
  }).eq('id', profileId);

  // Check and award badges
  const badgesAwarded = await checkBadges(profileId, supabase);

  return { levelUp, newLevel, badgesAwarded };
}

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

async function checkBadges(profileId: string, supabase: SupabaseClient): Promise<string[]> {
  const [
    { data: profile },
    { data: account },
    { data: streak },
    { data: completions },
    { data: questCompletions },
    { data: existingBadges },
    { data: allBadges },
  ] = await Promise.all([
    supabase.from('profiles').select('virtue_level, golden_balance').eq('id', profileId).single(),
    supabase.from('balance_accounts').select('lifetime_large, golden_balance').eq('profile_id', profileId).single(),
    supabase.from('streaks').select('current_streak, longest_streak').eq('profile_id', profileId).single(),
    supabase.from('task_completions').select('id').eq('profile_id', profileId),
    supabase.from('task_completions')
      .select('id, tasks!inner(type)')
      .eq('profile_id', profileId)
      .not('approved_at', 'is', null),
    supabase.from('profile_badges').select('badge_id, badges(key)').eq('profile_id', profileId),
    supabase.from('badges').select('id, key'),
  ]);

  const alreadyEarned = new Set(
    (existingBadges ?? []).map(b => {
      const raw = b.badges as { key: string } | { key: string }[] | null;
      return Array.isArray(raw) ? raw[0]?.key : raw?.key;
    }).filter(Boolean),
  );
  const badgeIdByKey = Object.fromEntries((allBadges ?? []).map(b => [b.key, b.id]));

  const toAward: string[] = [];

  function maybe(key: string, condition: boolean) {
    if (condition && !alreadyEarned.has(key) && badgeIdByKey[key]) {
      toAward.push(key);
    }
  }

  const totalCompletions    = (completions ?? []).length;
  const serviceActCount     = (questCompletions ?? []).length;
  const lifetimeLarge       = account?.lifetime_large ?? 0;
  const goldenBalance       = account?.golden_balance ?? 0;
  const currentStreak       = streak?.current_streak ?? 0;
  const longestStreak       = streak?.longest_streak ?? 0;
  const virtueLevel         = profile?.virtue_level ?? 1;

  maybe('first_steps',     totalCompletions >= 1);
  maybe('keeper_of_order', longestStreak    >= 7);
  maybe('streak_legend',   longestStreak    >= 30);
  maybe('community_hero',  serviceActCount  >= 3);
  maybe('big_saver',       lifetimeLarge    >= 100);
  maybe('virtue_rising',   virtueLevel      >= 5);
  maybe('golden_moment',   goldenBalance    > 0);

  if (toAward.length > 0) {
    await supabase.from('profile_badges').insert(
      toAward.map(key => ({ profile_id: profileId, badge_id: badgeIdByKey[key] })),
    );
  }

  return toAward;
}

// Call after quest completion
export async function awardQuestBadges(profileId: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient();

  const { data: allBadges } = await supabase.from('badges').select('id, key');
  const { data: existing }  = await supabase.from('profile_badges').select('badge_id, badges(key)').eq('profile_id', profileId);
  const { count: questCount } = await supabase.from('task_completions')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .not('tasks', 'is', null);

  const alreadyEarned = new Set(
    (existing ?? []).map(b => {
      const raw = b.badges as { key: string } | { key: string }[] | null;
      return Array.isArray(raw) ? raw[0]?.key : raw?.key;
    }).filter(Boolean),
  );
  const badgeIdByKey = Object.fromEntries((allBadges ?? []).map(b => [b.key, b.id]));
  const count = questCount ?? 0;

  const toAward: string[] = [];
  if (!alreadyEarned.has('quest_champion') && (count as number) >= 1) toAward.push('quest_champion');
  if (!alreadyEarned.has('quest_master')   && (count as number) >= 10) toAward.push('quest_master');

  if (toAward.length > 0) {
    await supabase.from('profile_badges').insert(
      toAward.map(key => ({ profile_id: profileId, badge_id: badgeIdByKey[key] })),
    );
  }

  return toAward;
}

// Call after first cashout
export async function awardCashoutBadge(profileId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data: badge }    = await supabase.from('badges').select('id').eq('key', 'first_cashout').single();
  const { data: existing } = await supabase.from('profile_badges').select('id').eq('profile_id', profileId).eq('badge_id', badge?.id).maybeSingle();
  if (existing || !badge) return false;
  await supabase.from('profile_badges').insert({ profile_id: profileId, badge_id: badge.id });
  return true;
}

// Call after receiving a golden higg
export async function awardGoldenBadge(profileId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data: badge }    = await supabase.from('badges').select('id').eq('key', 'golden_moment').single();
  const { data: existing } = await supabase.from('profile_badges').select('id').eq('profile_id', profileId).eq('badge_id', badge?.id).maybeSingle();
  if (existing || !badge) return false;
  await supabase.from('profile_badges').insert({ profile_id: profileId, badge_id: badge.id });
  return true;
}
