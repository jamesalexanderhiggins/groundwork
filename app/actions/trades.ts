'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function proposeTrade(
  fromProfileId: string,
  toProfileId:   string,
  largeAmount:   number,
  smallAmount:   number,
) {
  const supabase = await createServerSupabaseClient();

  if (largeAmount < 0 || smallAmount < 0 || (largeAmount === 0 && smallAmount === 0)) {
    return { error: 'Invalid amount.' };
  }

  const { data: balance } = await supabase
    .from('balance_accounts')
    .select('large_balance, small_balance')
    .eq('profile_id', fromProfileId)
    .single();

  if (!balance || balance.large_balance < largeAmount || balance.small_balance < smallAmount) {
    return { error: 'Not enough coins.' };
  }

  const { error } = await supabase.from('sibling_trades').insert({
    from_profile: fromProfileId,
    to_profile:   toProfileId,
    large_amount: largeAmount,
    small_amount: smallAmount,
    status:       'pending',
  });

  if (error) return { error: error.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function respondToTrade(tradeId: string, accept: boolean, profileId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: trade } = await supabase
    .from('sibling_trades')
    .select('*')
    .eq('id', tradeId)
    .eq('to_profile', profileId)
    .single();

  if (!trade || trade.status !== 'pending') return { error: 'Trade not found or already resolved.' };

  if (!accept) {
    await supabase.from('sibling_trades').update({ status: 'rejected' }).eq('id', tradeId);
    return { success: true };
  }

  // Atomically deduct from sender — if they spent coins since the trade was proposed this will fail
  const { data: deducted } = await supabase.rpc('adjust_balance', {
    p_profile_id:  trade.from_profile,
    p_large_delta: -trade.large_amount,
    p_small_delta: -trade.small_amount,
  });
  if (!deducted) {
    await supabase.from('sibling_trades').update({ status: 'rejected' }).eq('id', tradeId);
    return { error: 'Sender no longer has enough coins.' };
  }

  // Credit recipient
  await supabase.rpc('adjust_balance', {
    p_profile_id:  profileId,
    p_large_delta: trade.large_amount,
    p_small_delta: trade.small_amount,
  });

  await supabase.from('sibling_trades').update({ status: 'accepted' }).eq('id', tradeId);

  await supabase.from('transactions').insert([
    { profile_id: trade.from_profile, type: 'trade', large_delta: -trade.large_amount, small_delta: -trade.small_amount, description: 'Trade sent', reference_id: tradeId },
    { profile_id: profileId,          type: 'trade', large_delta:  trade.large_amount, small_delta:  trade.small_amount, description: 'Trade received', reference_id: tradeId },
  ]);

  revalidatePath('/tasks');
  return { success: true };
}
