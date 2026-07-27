'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { toCashValue, type FamilyRates } from '@/lib/economy';
import { awardCashoutBadge, awardGiftGiverBadge } from '@/app/actions/virtue';

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

async function caller(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, family_id, role')
    .eq('user_id', user.id)
    .single();
  return data;
}

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
  const me = await caller(supabase);
  if (!me) return { error: 'Unauthorized' };

  // Negative amounts previously passed straight through to adjust_balance,
  // which would ADD coins and mint free cash.
  const large  = Math.floor(largeAmount);
  const golden = Math.floor(goldenAmount);

  if (!Number.isFinite(large) || !Number.isFinite(golden)) return { error: 'Invalid amount.' };
  if (large < 0 || golden < 0)     return { error: 'Amounts cannot be negative.' };
  if (large === 0 && golden === 0) return { error: 'Choose at least one coin to cash out.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', profileId)
    .single();
  if (!profile)                             return { error: 'Profile not found' };
  if (profile.family_id !== me.family_id)   return { error: 'Profile not in your family.' };

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
    .maybeSingle();
  if (!balance) return { error: 'Balance not found' };

  if (balance.large_balance < large || balance.golden_balance < golden) {
    return { error: 'Not enough coins.' };
  }

  const rates: FamilyRates = {
    smallPerLarge:   family.small_per_large,
    largeCashValue:  family.large_cash_value,
    goldenCashValue: family.golden_cash_value,
    largeMinutes:    family.large_minutes,
    smallMinutes:    family.small_minutes,
    goldenMinutes:   family.golden_minutes,
  };

  const totalCashable = toCashValue(
    { large: balance.large_balance, small: 0, golden: balance.golden_balance }, rates,
  );
  const maxCash       = totalCashable * (window.max_percent / 100);
  const requestedCash = toCashValue({ large, small: 0, golden }, rates);

  if (requestedCash > maxCash) {
    return { error: `Maximum cashout right now is $${maxCash.toFixed(2)} (${window.max_percent}% of your balance).` };
  }

  const { data: deducted } = await supabase.rpc('adjust_balance', {
    p_profile_id:   profileId,
    p_large_delta:  -large,
    p_golden_delta: -golden,
  });
  if (!deducted) return { error: 'Insufficient balance.' };

  await supabase.from('transactions').insert({
    profile_id:   profileId,
    type:         'cashout',
    large_delta:  -large,
    golden_delta: -golden,
    description:  `Cashout: $${requestedCash.toFixed(2)}`,
  });

  const { data: request } = await supabase.from('cashout_requests').insert({
    profile_id:    profileId,
    large_amount:  large,
    golden_amount: golden,
    cash_value:    requestedCash,
    window_id:     window.id,
    status:        'approved', // auto-approved within an open window
    approved_at:   new Date().toISOString(),
  }).select().single();

  await awardCashoutBadge(profileId);

  revalidatePath('/cashout');
  revalidatePath('/dashboard');
  return { success: true, cashValue: requestedCash, request };
}

/**
 * Gift Window cash-out.
 *
 * A gift window is opened by a parent around a birthday or Christmas. Inside
 * it a child may cash out a capped slice of their balance specifically to buy
 * a present for someone else. `is_gift_window` and `gift_max_percent` were in
 * the schema and settable from the parent form, but no code ever read them —
 * the mechanic did not exist.
 *
 * Using it is what earns the Gift Giver badge.
 */
export async function requestGiftCashout(
  profileId:    string,
  largeAmount:  number,
  goldenAmount: number,
  recipient:    string,
) {
  const supabase = await createServerSupabaseClient();
  const me = await caller(supabase);
  if (!me) return { error: 'Unauthorized' };

  const large  = Math.floor(largeAmount);
  const golden = Math.floor(goldenAmount);
  const forWhom = recipient.trim();

  if (!Number.isFinite(large) || !Number.isFinite(golden)) return { error: 'Invalid amount.' };
  if (large < 0 || golden < 0)     return { error: 'Amounts cannot be negative.' };
  if (large === 0 && golden === 0) return { error: 'Choose at least one coin.' };
  if (!forWhom)                    return { error: 'Who is the gift for?' };
  if (forWhom.length > 60)         return { error: 'That name is too long.' };

  const { data: profile } = await supabase
    .from('profiles').select('family_id, display_name').eq('id', profileId).single();
  if (!profile)                           return { error: 'Profile not found' };
  if (profile.family_id !== me.family_id) return { error: 'Profile not in your family.' };

  const { data: family } = await supabase
    .from('families').select('*').eq('id', profile.family_id).single();
  if (!family) return { error: 'Family not found' };

  const window = await getActiveCashoutWindow(family.id);
  if (!window)                 return { error: 'No window is open right now.' };
  if (!window.is_gift_window)  return { error: 'This window is not a gift window.' };

  const { data: balance } = await supabase
    .from('balance_accounts').select('*').eq('profile_id', profileId).maybeSingle();
  if (!balance) return { error: 'Balance not found' };

  if (balance.large_balance < large || balance.golden_balance < golden) {
    return { error: 'Not enough coins.' };
  }

  const rates: FamilyRates = {
    smallPerLarge:   family.small_per_large,
    largeCashValue:  family.large_cash_value,
    goldenCashValue: family.golden_cash_value,
    largeMinutes:    family.large_minutes,
    smallMinutes:    family.small_minutes,
    goldenMinutes:   family.golden_minutes,
  };

  const totalCashable = toCashValue(
    { large: balance.large_balance, small: 0, golden: balance.golden_balance }, rates,
  );
  // Gift windows use their own, usually smaller, percentage cap.
  const maxCash       = totalCashable * ((window.gift_max_percent ?? 10) / 100);
  const requestedCash = toCashValue({ large, small: 0, golden }, rates);

  if (requestedCash > maxCash) {
    return {
      error: `For gifts you can use up to $${maxCash.toFixed(2)} right now (${window.gift_max_percent}% of your balance).`,
    };
  }

  const { data: deducted } = await supabase.rpc('adjust_balance', {
    p_profile_id:   profileId,
    p_large_delta:  -large,
    p_golden_delta: -golden,
  });
  if (!deducted) return { error: 'Insufficient balance.' };

  await supabase.from('transactions').insert({
    profile_id:   profileId,
    type:         'cashout',
    large_delta:  -large,
    golden_delta: -golden,
    description:  `Gift for ${forWhom}: $${requestedCash.toFixed(2)}`,
  });

  const { data: request } = await supabase.from('cashout_requests').insert({
    profile_id:    profileId,
    large_amount:  large,
    golden_amount: golden,
    cash_value:    requestedCash,
    window_id:     window.id,
    status:        'approved',
    approved_at:   new Date().toISOString(),
  }).select().single();

  // This — not gifting a Golden Higg — is what the whitepaper ties the
  // Gift Giver badge to.
  const badgeAwarded = await awardGiftGiverBadge(profileId);

  revalidatePath('/cashout');
  revalidatePath('/dashboard');
  return { success: true, cashValue: requestedCash, recipient: forWhom, request, badgeAwarded };
}

export async function createCashoutWindow(formData: FormData, familyId: string) {
  const supabase = await createServerSupabaseClient();
  const me = await caller(supabase);
  if (!me) return { error: 'Unauthorized' };
  if (!['parent', 'admin'].includes(me.role)) {
    return { error: 'Only parents can open a cashout window.' };
  }
  if (me.family_id !== familyId) return { error: 'Not your family.' };

  const label    = ((formData.get('label') as string) ?? '').trim();
  const opensAt  = formData.get('opens_at')  as string;
  const closesAt = formData.get('closes_at') as string;

  if (!label)               return { error: 'Give the window a name.' };
  if (!opensAt || !closesAt) return { error: 'Both open and close times are required.' };
  if (new Date(closesAt) <= new Date(opensAt)) {
    return { error: 'The window must close after it opens.' };
  }

  const maxPercent = Math.min(100, Math.max(0,
    parseFloat(formData.get('max_percent') as string) || 100));
  const giftMaxPercent = Math.min(100, Math.max(0,
    parseFloat(formData.get('gift_max_percent') as string) || 10));

  const { error } = await supabase.from('cashout_windows').insert({
    family_id:        familyId,
    label,
    opens_at:         opensAt,
    closes_at:        closesAt,
    max_percent:      maxPercent,
    is_gift_window:   formData.get('is_gift_window') === 'true',
    gift_max_percent: giftMaxPercent,
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

  // Claim the approval first so two parents tapping at once can't double-credit
  const { data: claimed } = await supabase
    .from('task_completions')
    .update({
      approved_by: parentProfileId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', completionId)
    .is('approved_at', null)
    .select('id');

  if (!claimed?.length) return { error: 'Already approved.' };

  await supabase.rpc('adjust_balance', {
    p_profile_id:            completion.profile_id,
    p_small_delta:           completion.reward_small,
    p_large_delta:           completion.reward_large,
    p_golden_delta:          completion.reward_golden,
    p_lifetime_large_delta:  completion.reward_large,
    p_lifetime_golden_delta: completion.reward_golden,
  });

  await supabase.from('transactions').insert({
    profile_id:   completion.profile_id,
    type:         completion.reward_golden > 0 ? 'earn_golden'
                : completion.reward_large  > 0 ? 'earn_large'
                : 'earn_small',
    small_delta:  completion.reward_small,
    large_delta:  completion.reward_large,
    golden_delta: completion.reward_golden,
    description:  'Approved by parent',
    reference_id: completionId,
  });

  revalidatePath('/parent/approvals');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function rejectServiceAct(completionId: string) {
  const supabase = await createServerSupabaseClient();
  const me = await caller(supabase);
  if (!me) return { error: 'Unauthorized' };
  if (!['parent', 'admin'].includes(me.role)) {
    return { error: 'Not authorized to reject.' };
  }

  // Confirm the completion belongs to this family before deleting
  const { data: completion } = await supabase
    .from('task_completions')
    .select('id, profiles!inner(family_id)')
    .eq('id', completionId)
    .is('approved_at', null)
    .single();

  if (!completion) return { error: 'Not found or already approved.' };

  const famId = Array.isArray(completion.profiles)
    ? completion.profiles[0]?.family_id
    : (completion.profiles as { family_id: string } | null)?.family_id;
  if (famId !== me.family_id) return { error: 'Not in your family.' };

  await supabase.from('task_completions').delete().eq('id', completionId);
  revalidatePath('/parent/approvals');
  return { success: true };
}
