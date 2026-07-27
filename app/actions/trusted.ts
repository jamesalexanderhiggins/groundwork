'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function inviteTrustedAdult(email: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile || !['parent', 'admin'].includes(parentProfile.role)) {
    return { error: 'Only parents can invite trusted adults.' };
  }

  const { data: invite, error } = await supabase
    .from('trusted_invitations')
    .insert({ family_id: parentProfile.family_id, email })
    .select()
    .single();

  if (error) return { error: error.message };

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join/${invite.token}`;

  // Send via Resend if configured
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Kempt <noreply@kempt.life>',
      to:   email,
      subject: 'You\'ve been invited as a Trusted Adult on Kempt',
      html: `<p>You've been invited to join a family on Kempt as a Trusted Adult.</p>
             <p><a href="${inviteUrl}">Accept invitation</a></p>
             <p>This link expires in 7 days.</p>`,
    });
  }

  revalidatePath('/dashboard');
  return { inviteUrl, token: invite.token };
}

export async function acceptInvitation(token: string, displayName: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in first.' };

  const { data: invite } = await supabase
    .from('trusted_invitations')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!invite) return { error: 'Invitation not found or expired.' };

  // Check not already in family
  const { data: existing } = await supabase
    .from('family_members')
    .select('id')
    .eq('family_id', invite.family_id)
    .eq('user_id', user.id)
    .single();

  if (existing) return { error: 'You are already a member of this family.' };

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .insert({
      user_id:      user.id,
      family_id:    invite.family_id,
      display_name: displayName,
      life_stage:   'adult',
      role:         'trusted_adult',
      locale:       'en',
    })
    .select()
    .single();

  if (profileErr || !profile) return { error: profileErr?.message ?? 'Failed to create profile.' };

  await supabase.from('family_members').insert({
    family_id:  invite.family_id,
    user_id:    user.id,
    profile_id: profile.id,
    role:       'trusted_adult',
  });

  await supabase.from('trusted_invitations').update({ used: true }).eq('id', invite.id);

  return { success: true, profileId: profile.id };
}

export async function giftGoldenHigg(
  fromProfileId: string,
  toProfileId:   string,
  amount:        number,
  note:          string,
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  if (amount < 1) return { error: 'Amount must be at least 1.' };

  // Verify caller owns fromProfileId and is an authorised gifter
  const { data: giver } = await supabase
    .from('profiles')
    .select('family_id, role, display_name')
    .eq('id', fromProfileId)
    .eq('user_id', user.id)
    .single();
  if (!giver || !['trusted_adult', 'parent', 'admin'].includes(giver.role)) {
    return { error: 'Not authorized to gift.' };
  }

  // Verify recipient is in the same family
  const { data: recipientProfile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', toProfileId)
    .single();
  if (!recipientProfile || recipientProfile.family_id !== giver.family_id) {
    return { error: 'Recipient is not in your family.' };
  }

  // Credit recipient atomically (gifts are backed by the trusted adult's real money, no coin deduction)
  await supabase.rpc('adjust_balance', {
    p_profile_id:            toProfileId,
    p_golden_delta:          amount,
    p_lifetime_golden_delta: amount,
  });

  await supabase.from('transactions').insert({
    profile_id:  toProfileId,
    type:        'gift_golden',
    golden_delta: amount,
    description: note
      ? `${giver?.display_name ?? 'Someone'} gifted you ${amount} Golden Higg${amount > 1 ? 's' : ''}: "${note}"`
      : `${giver?.display_name ?? 'Someone'} gifted you ${amount} Golden Higg${amount > 1 ? 's' : ''}`,
    reference_id: fromProfileId,
  });

  revalidatePath('/trusted');
  return { success: true };
}
