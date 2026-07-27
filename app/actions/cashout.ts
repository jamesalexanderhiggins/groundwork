'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { toCashValue, type FamilyRates } from '@/lib/economy';

export async function getActiveCashoutWindow(familyId: string) {
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('cashout_windows')
    .select('*')
    .eq('family_id', familyId)
    .lte('opens_at', now)
    .gte('closes_at', now)
    .order('opens_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function requestCashout(
  profileId:    string,
  largeAmount:  number,
  goldenAmount: number,
) {
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

  const window = await getActiveCashoutWindow(family.id);
  if (!window) return { error: 'No cashout window is currently open.' };

  const { data: balance } = await supabase
    .from('balance_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .single();
  if (!balance) return { error: 'Balance not found' };

  // Enforce max_percent cap
  const rates: FamilyRates = {
    smallPerLarge: family.small_per_large, largeCashValue: family.large_cash_value,
    goldenCashValue: family.golden_cash_value, largeMinutes: family.large_minutes,
    smallMinutes: family.small_minutes, goldenMinutes: family.golden_minutes,
  };

  const totalCashable = toCashValue(
    { large: balance.large_balance, small: 0, golden: balance.golden_balance }, rates
  );
  const maxCash = totalCashable * (window.max_percent / 100);
  const requestedCash = toCashValue({ large: largeAmount, small: 0, golden: goldenAmount }, rates);

  if (requestedCash > maxCash) {
    return { error: `Maximum cashout is $${maxCash.toFixed(2)} (${window.max_percent}% of balance).` };
  }

  // Atomically deduct — prevent overdraw if two cashout requests race
  const { data: deducted } = await supabase.rpc('adjust_balance', {
    p_profile_id:  profileId,
    p_large_delta: -largeAmount,
    p_golden_delta: -goldenAmount,
  });
  if (!deducted) return { error: 'Insufficient balance.' };

  await supabase.from('transactions').insert({
    profile_id:  profileId,
    type:        'cashout',
    large_delta:  -largeAmount,
    golden_delta: -goldenAmount,
    description: `Cashout: $${requestedCash.toFixed(2)}`,
  });

  const { data: request } = await supabase.from('cashout_requests').insert({
    profile_id:   profileId,
    large_amount: largeAmount,
    golden_amount: goldenAmount,
    cash_value:   requestedCash,
    window_id:    window.id,
    status:       'approved', // auto-approved within a window
  }).select().single();

  revalidatePath('/cashout');
  return { success: true, cashValue: requestedCash, request };
}

export async function createCashoutWindow(formData: FormData, familyId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase.from('cashout_windows').insert({
    family_id:       familyId,
    label:           formData.get('label') as string,
    opens_at:        formData.get('opens_at') as string,
    closes_at:       formData.get('closes_at') as string,
    max_percent:     parseFloat(formData.get('max_percent') as string) || 100,
    is_gift_window:  formData.get('is_gift_window') === 'true',
    gift_max_percent: parseFloat(formData.get('gift_max_percent') as string) || 10,
  });

  if (error) return { error: error.message };
  revalidatePath('/parent/cashout');
  return { success: true };
}

export async function approveServiceAct(completionId: string, parentProfileId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: approver } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('id', parentProfileId)
    .eq('user_id', user.id)
    .single();
  if (!approver || !['parent', 'admin'].includes(approver.role)) {
    return { error: 'Not authorized to approve.' };
  }

  const { data: completion } = await supabase
    .from('task_completions')
    .select('*, profiles!inner(family_id)')
    .eq('id', completionId)
    .is('approved_at', null)
    .single();

  if (!completion) return { error: 'Not found or already approved.' };

  const completionFamilyId = Array.isArray(completion.profiles)
    ? completion.profiles[0]?.family_id
    : (completion.profiles as { family_id: string } | null)?.family_id;
  if (completionFamilyId !== approver.family_id) return { error: 'Not in your family.' };

  await supabase.from('task_completions').update({
    approved_by: parentProfileId,
    approved_at: new Date().toISOString(),
  }).eq('id', completionId);

  await supabase.rpc('adjust_balance', {
    p_profile_id:            completion.profile_id,
    p_small_delta:           completion.reward_small,
    p_large_delta:           completion.reward_large,
    p_golden_delta:          completion.reward_golden,
    p_lifetime_large_delta:  completion.reward_large,
    p_lifetime_golden_delta: completion.reward_golden,
  });

  await supabase.from('transactions').insert({
    profile_id:  completion.profile_id,
    type:        completion.reward_golden > 0 ? 'earn_golden' : completion.reward_large > 0 ? 'earn_large' : 'earn_small',
    small_delta:  completion.reward_small,
    large_delta:  completion.reward_large,
    golden_delta: completion.reward_golden,
    description: 'Service act approved',
    reference_id: completionId,
  });

  revalidatePath('/parent/approvals');
  return { success: true };
}

export async function rejectServiceAct(completionId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: rejector } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('user_id', user.id)
    .single();
  if (!rejector || !['parent', 'admin'].includes(rejector.role)) {
    return { error: 'Not authorized to reject.' };
  }

  await supabase.from('task_completions').delete().eq('id', completionId);
  revalidatePath('/parent/approvals');
  return { success: true };
}
