'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { minutesToCost, type FamilyRates } from '@/lib/economy';

const DAY_CAP_KEYS = [
  'cap_sunday', 'cap_monday', 'cap_tuesday', 'cap_wednesday',
  'cap_thursday', 'cap_friday', 'cap_saturday',
] as const;

export async function buyScreenTime(profileId: string, minutes: number, deviceType: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', profileId)
    .single();
  if (!profile) return { error: 'Profile not found' };

  const { data: family } = await supabase
    .from('families')
    .select('*')
    .eq('id', profile.family_id)
    .single();
  if (!family) return { error: 'Family not found' };

  // Check daily cap
  const dayCapKey = DAY_CAP_KEYS[new Date().getDay()];
  const dayCap: number = family[dayCapKey] ?? 0;

  if (dayCap === 0) {
    return { error: `No screen time allowed today (${new Date().toLocaleDateString('en', { weekday: 'long' })}).` };
  }

  // Sum today's screen time already purchased
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todaySessions } = await supabase
    .from('screen_time_sessions')
    .select('planned_minutes')
    .eq('profile_id', profileId)
    .gte('started_at', todayStart.toISOString());

  const usedMinutes = (todaySessions ?? []).reduce((sum, s) => sum + s.planned_minutes, 0);
  if (usedMinutes + minutes > dayCap) {
    return { error: `Only ${dayCap - usedMinutes} minutes remaining today.` };
  }

  const rates: FamilyRates = {
    smallPerLarge:   family.small_per_large,
    largeCashValue:  family.large_cash_value,
    goldenCashValue: family.golden_cash_value,
    largeMinutes:    family.large_minutes,
    smallMinutes:    family.small_minutes,
    goldenMinutes:   family.golden_minutes,
  };

  const cost = minutesToCost(minutes, rates);

  // Check balance
  const { data: balance } = await supabase
    .from('balance_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .single();
  if (!balance) return { error: 'Balance not found' };

  if (balance.large_balance < cost.large || balance.small_balance < cost.small) {
    return { error: 'Not enough coins.' };
  }

  // Atomically deduct — prevent overdraw if two purchase requests race
  const { data: deducted } = await supabase.rpc('adjust_balance', {
    p_profile_id:  profileId,
    p_small_delta:  -cost.small,
    p_large_delta:  -cost.large,
    p_golden_delta: -cost.golden,
  });
  if (!deducted) return { error: 'Not enough coins.' };

  await supabase.from('transactions').insert({
    profile_id:  profileId,
    type:        'spend_large',
    small_delta:  -cost.small,
    large_delta:  -cost.large,
    golden_delta: -cost.golden,
    description: `Screen time: ${minutes} min on ${deviceType}`,
  });

  const { data: session } = await supabase.from('screen_time_sessions').insert({
    profile_id:      profileId,
    planned_minutes: minutes,
    cost_large:      cost.large,
    cost_small:      cost.small,
    device_type:     deviceType,
  }).select().single();

  revalidatePath('/arcade');
  return { session, cost, rates };
}

export async function endScreenTimeSession(sessionId: string, actualMinutes: number) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: session } = await supabase
    .from('screen_time_sessions')
    .select('*, profile_id, planned_minutes')
    .eq('id', sessionId)
    .single();
  if (!session) return { error: 'Session not found' };

  const overtime = Math.max(0, actualMinutes - session.planned_minutes);
  let overtimeSmall = 0;

  if (overtime > 0) {
    // Double rate: 1 Ginsey per small_minutes interval, x2
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', session.profile_id)
      .single();

    const { data: family } = profile ? await supabase
      .from('families')
      .select('small_minutes')
      .eq('id', profile.family_id)
      .single() : { data: null };

    const smallMinutes = family?.small_minutes ?? 5;
    overtimeSmall = Math.ceil(overtime / smallMinutes) * 2;

    // Deduct overtime from balance (best-effort, floored at 0 by the RPC)
    await supabase.rpc('adjust_balance', {
      p_profile_id: session.profile_id,
      p_small_delta: -overtimeSmall,
    });

    await supabase.from('transactions').insert({
      profile_id:  session.profile_id,
      type:        'penalty',
      small_delta:  -overtimeSmall,
      description: `Overtime penalty: ${overtime} min over`,
    });
  }

  await supabase.from('screen_time_sessions').update({
    ended_at:       new Date().toISOString(),
    actual_minutes: actualMinutes,
    overtime_small: overtimeSmall,
  }).eq('id', sessionId);

  revalidatePath('/arcade');
  return { overtimeSmall };
}

export async function buyPrivilege(privilegeId: string, profileId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: priv } = await supabase
    .from('privileges')
    .select('*')
    .eq('id', privilegeId)
    .single();
  if (!priv || !priv.active) return { error: 'Privilege not available' };

  const { data: balance } = await supabase
    .from('balance_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .single();
  if (!balance) return { error: 'Balance not found' };

  if (balance.large_balance < priv.cost_large || balance.small_balance < priv.cost_small) {
    return { error: 'Not enough coins.' };
  }

  const { data: deducted } = await supabase.rpc('adjust_balance', {
    p_profile_id:  profileId,
    p_large_delta: -priv.cost_large,
    p_small_delta: -priv.cost_small,
  });
  if (!deducted) return { error: 'Not enough coins.' };

  await supabase.from('transactions').insert({
    profile_id:  profileId,
    type:        'spend_large',
    large_delta:  -priv.cost_large,
    small_delta:  -priv.cost_small,
    description: `Privilege: ${priv.title}`,
    reference_id: privilegeId,
  });

  revalidatePath('/arcade');
  return { success: true };
}
