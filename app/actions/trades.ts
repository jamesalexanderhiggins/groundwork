'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

async function callerFamilyId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('user_id', user.id)
    .single();
  return data?.family_id ?? null;
}

export async function proposeTrade(
  fromProfileId: string,
  toProfileId:   string,
  largeAmount:   number,
  smallAmount:   number,
) {
  const supabase = await createServerSupabaseClient();

  // This action was previously unauthenticated — anyone could move
  // coins between arbitrary profiles.
  const familyId = await callerFamilyId(supabase);
  if (!familyId) return { error: 'Unauthorized' };

  const large = Math.floor(largeAmount);
  const small = Math.floor(smallAmount);

  if (!Number.isFinite(large) || !Number.isFinite(small)) return { error: 'Invalid amount.' };
  if (large < 0 || small < 0)        return { error: 'Amounts cannot be negative.' };
  if (large === 0 && small === 0)    return { error: 'Choose at least one coin to send.' };
  if (fromProfileId === toProfileId) return { error: 'You cannot trade with yourself.' };

  // Both sides must be in the caller's family
  const { data: parties } = await supabase
    .from('profiles')
    .select('id, family_id')
    .in('id', [fromProfileId, toProfileId]);

  if (
    !parties || parties.length !== 2 ||
    parties.some(p => p.family_id !== familyId)
  ) {
    return { error: 'Both people must be in your family.' };
  }

  const { data: balance } = await supabase
    .from('balance_accounts')
    .select('large_balance, small_balance')
    .eq('profile_id', fromProfileId)
    .maybeSingle();

  if (!balance || balance.large_balance < large || balance.small_balance < small) {
    return { error: 'Not enough coins.' };
  }

  // Don't let a child stack up many pending offers that together exceed
  // their balance.
  const { data: pending } = await supabase
    .from('sibling_trades')
    .select('large_amount, small_amount')
    .eq('from_profile', fromProfileId)
    .eq('status', 'pending');

  const pendingLarge = (pending ?? []).reduce((s, t) => s + t.large_amount, 0);
  const pendingSmall = (pending ?? []).reduce((s, t) => s + t.small_amount, 0);

  if (
    balance.large_balance < pendingLarge + large ||
    balance.small_balance < pendingSmall + small
  ) {
    return { error: 'You have other offers pending that use those coins.' };
  }

  const { error } = await supabase.from('sibling_trades').insert({
    from_profile: fromProfileId,
    to_profile:   toProfileId,
    large_amount: large,
    small_amount: small,
    status:       'pending',
  });

  if (error) return { error: error.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function respondToTrade(tradeId: string, accept: boolean, profileId: string) {
  const supabase = await createServerSupabaseClient();

  const familyId = await callerFamilyId(supabase);
  if (!familyId) return { error: 'Unauthorized' };

  const { data: responder } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', profileId)
    .single();
  if (!responder || responder.family_id !== familyId) {
    return { error: 'Profile not in your family.' };
  }

  const { data: trade } = await supabase
    .from('sibling_trades')
    .select('*')
    .eq('id', tradeId)
    .eq('to_profile', profileId)
    .single();

  if (!trade || trade.status !== 'pending') {
    return { error: 'Trade not found or already resolved.' };
  }

  if (!accept) {
    await supabase.from('sibling_trades')
      .update({ status: 'rejected' })
      .eq('id', tradeId)
      .eq('status', 'pending');
    revalidatePath('/tasks');
    return { success: true, accepted: false };
  }

  // Claim the trade first so a double-tap can't credit twice
  const { data: claimed } = await supabase
    .from('sibling_trades')
    .update({ status: 'accepted' })
    .eq('id', tradeId)
    .eq('status', 'pending')
    .select('id');

  if (!claimed?.length) return { error: 'This trade was already resolved.' };

  const { data: deducted } = await supabase.rpc('adjust_balance', {
    p_profile_id:  trade.from_profile,
    p_large_delta: -trade.large_amount,
    p_small_delta: -trade.small_amount,
  });

  if (!deducted) {
    await supabase.from('sibling_trades').update({ status: 'rejected' }).eq('id', tradeId);
    return { error: 'Sender no longer has enough coins.' };
  }

  await supabase.rpc('adjust_balance', {
    p_profile_id:  profileId,
    p_large_delta: trade.large_amount,
    p_small_delta: trade.small_amount,
  });

  await supabase.from('transactions').insert([
    {
      profile_id: trade.from_profile, type: 'trade',
      large_delta: -trade.large_amount, small_delta: -trade.small_amount,
      description: 'Trade sent', reference_id: tradeId,
    },
    {
      profile_id: profileId, type: 'trade',
      large_delta: trade.large_amount, small_delta: trade.small_amount,
      description: 'Trade received', reference_id: tradeId,
    },
  ]);

  revalidatePath('/tasks');
  return { success: true, accepted: true };
}
