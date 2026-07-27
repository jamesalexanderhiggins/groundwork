'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { minutesToCost, type FamilyRates } from '@/lib/economy';

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const DAY_CAP_KEYS = [
  'cap_sunday', 'cap_monday', 'cap_tuesday', 'cap_wednesday',
  'cap_thursday', 'cap_friday', 'cap_saturday',
] as const;

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Confirm the signed-in user shares a family with this profile. */
async function assertSameFamily(supabase: SupabaseClient, profileId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' as const };

  const { data: caller } = await supabase
    .from('profiles').select('family_id').eq('user_id', user.id).single();
  if (!caller) return { error: 'No profile found' as const };

  const { data: target } = await supabase
    .from('profiles').select('family_id').eq('id', profileId).single();
  if (!target || target.family_id !== caller.family_id) {
    return { error: 'Profile not in your family' as const };
  }
  return { familyId: caller.family_id };
}

export async function buyScreenTime(profileId: string, minutes: number, deviceType: string) {
  const supabase = await createServerSupabaseClient();

  const auth = await assertSameFamily(supabase, profileId);
  if ('error' in auth) return { error: auth.error };

  const mins = Math.floor(minutes);
  if (!Number.isFinite(mins) || mins <= 0) return { error: 'Choose how long you want.' };
  if (mins > 480) return { error: 'That is too long for one session.' };

  const { data: family } = await supabase
    .from('families').select('*').eq('id', auth.familyId).single();
  if (!family) return { error: 'Family not found' };

  const today     = new Date().getDay();
  const dayCap: number = family[DAY_CAP_KEYS[today]] ?? 0;

  if (dayCap === 0) {
    return { error: `No screen time is allowed on ${WEEKDAYS[today]}.` };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todaySessions } = await supabase
    .from('screen_time_sessions')
    .select('planned_minutes')
    .eq('profile_id', profileId)
    .gte('started_at', todayStart.toISOString());

  const usedMinutes = (todaySessions ?? []).reduce((sum, s) => sum + s.planned_minutes, 0);
  const remaining   = dayCap - usedMinutes;

  if (remaining <= 0)   return { error: 'You have used all your screen time today.' };
  if (mins > remaining) return { error: `Only ${remaining} minutes remaining today.` };

  const rates: FamilyRates = {
    smallPerLarge:   family.small_per_large,
    largeCashValue:  family.large_cash_value,
    goldenCashValue: family.golden_cash_value,
    largeMinutes:    family.large_minutes,
    smallMinutes:    family.small_minutes,
    goldenMinutes:   family.golden_minutes,
  };

  const cost = minutesToCost(mins, rates);

  const { data: balance } = await supabase
    .from('balance_accounts').select('*').eq('profile_id', profileId).maybeSingle();
  if (!balance) return { error: 'Balance not found' };

  // minutesToCost can return a golden component — it was never checked here.
  if (
    balance.large_balance  < cost.large  ||
    balance.small_balance  < cost.small  ||
    balance.golden_balance < cost.golden
  ) {
    return { error: 'Not enough coins.' };
  }

  const { data: deducted } = await supabase.rpc('adjust_balance', {
    p_profile_id:   profileId,
    p_small_delta:  -cost.small,
    p_large_delta:  -cost.large,
    p_golden_delta: -cost.golden,
  });
  if (!deducted) return { error: 'Not enough coins.' };

  const { data: session, error: sessionErr } = await supabase
    .from('screen_time_sessions').insert({
      profile_id:      profileId,
      planned_minutes: mins,
      cost_large:      cost.large,
      cost_small:      cost.small,
      device_type:     deviceType,
    }).select().single();

  if (sessionErr || !session) {
    // Refund rather than silently swallowing the coins
    await supabase.rpc('adjust_balance', {
      p_profile_id:   profileId,
      p_small_delta:  cost.small,
      p_large_delta:  cost.large,
      p_golden_delta: cost.golden,
    });
    return { error: 'Could not start your session. Your coins were not spent.' };
  }

  await supabase.from('transactions').insert({
    profile_id:   profileId,
    type:         'spend_large',
    small_delta:  -cost.small,
    large_delta:  -cost.large,
    golden_delta: -cost.golden,
    description:  `Screen time: ${mins} min on ${deviceType}`,
    reference_id: session.id,
  });

  revalidatePath('/arcade');
  return { session, cost, rates };
}

export async function endScreenTimeSession(sessionId: string, actualMinutes: number) {
  const supabase = await createServerSupabaseClient();

  const { data: session } = await supabase
    .from('screen_time_sessions')
    .select('id, profile_id, planned_minutes, ended_at')
    .eq('id', sessionId)
    .single();
  if (!session)          return { error: 'Session not found' };
  if (session.ended_at)  return { error: 'This session has already ended.' };

  const auth = await assertSameFamily(supabase, session.profile_id);
  if ('error' in auth) return { error: auth.error };

  const actual   = Math.max(0, Math.floor(actualMinutes));
  const overtime = Math.max(0, actual - session.planned_minutes);
  let overtimeSmall = 0;

  if (overtime > 0) {
    const { data: family } = await supabase
      .from('families').select('small_minutes').eq('id', auth.familyId).single();

    const smallMinutes = family?.small_minutes ?? 5;
    // Overtime is charged at double rate
    overtimeSmall = Math.ceil(overtime / smallMinutes) * 2;

    await supabase.rpc('adjust_balance', {
      p_profile_id:  session.profile_id,
      p_small_delta: -overtimeSmall,
    });

    await supabase.from('transactions').insert({
      profile_id:   session.profile_id,
      type:         'penalty',
      small_delta:  -overtimeSmall,
      description:  `Overtime: ${overtime} min over`,
      reference_id: sessionId,
    });
  }

  await supabase.from('screen_time_sessions').update({
    ended_at:       new Date().toISOString(),
    actual_minutes: actual,
    overtime_small: overtimeSmall,
  }).eq('id', sessionId).is('ended_at', null);

  revalidatePath('/arcade');
  return { overtimeSmall };
}

export async function buyPrivilege(privilegeId: string, profileId: string) {
  const supabase = await createServerSupabaseClient();

  const auth = await assertSameFamily(supabase, profileId);
  if ('error' in auth) return { error: auth.error };

  const { data: priv } = await supabase
    .from('privileges').select('*').eq('id', privilegeId).single();

  if (!priv || !priv.active)            return { error: 'Privilege not available' };
  if (priv.family_id !== auth.familyId) return { error: 'Not available to your family.' };

  const { data: balance } = await supabase
    .from('balance_accounts').select('*').eq('profile_id', profileId).maybeSingle();
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
    profile_id:   profileId,
    type:         priv.cost_large > 0 ? 'spend_large' : 'spend_small',
    large_delta:  -priv.cost_large,
    small_delta:  -priv.cost_small,
    description:  `Privilege: ${priv.title}`,
    reference_id: privilegeId,
  });

  revalidatePath('/arcade');
  return { success: true, title: priv.title };
}
