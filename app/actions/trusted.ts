'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { awardGoldenBadge, awardGiftGiverBadge } from '@/app/actions/virtue';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteTrustedAdult(email: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const address = email.trim().toLowerCase();
  if (!EMAIL_RE.test(address)) return { error: 'That does not look like a valid email address.' };

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
    .insert({ family_id: parentProfile.family_id, email: address })
    .select()
    .single();

  if (error) return { error: error.message };

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const inviteUrl = `${appUrl}/join/${invite.token}`;

  // Email delivery is optional — the parent can always copy the link.
  let emailed = false;
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:    'Kempt <noreply@kempt.life>',
        to:      address,
        subject: 'You have been invited as a Trusted Adult on Kempt',
        html: `<p>You have been invited to join a family on Kempt as a Trusted Adult.</p>
               <p><a href="${inviteUrl}">Accept invitation</a></p>
               <p>This link expires in 7 days.</p>`,
      });
      emailed = true;
    } catch {
      // Fall back to the copyable link — never fail the invite on email
      emailed = false;
    }
  }

  revalidatePath('/parent/cashout');
  return { inviteUrl, token: invite.token, emailed };
}

export async function acceptInvitation(token: string, displayName: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in first.' };

  const name = displayName.trim();
  if (!name) return { error: 'Please enter your name.' };

  const { data: invite } = await supabase
    .from('trusted_invitations')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!invite) return { error: 'This invitation is invalid or has expired.' };

  // family_members has a composite primary key (family_id, user_id) —
  // there is no id column to select.
  const { data: existing } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('family_id', invite.family_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return { error: 'You are already a member of this family.' };

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .insert({
      user_id:      user.id,
      family_id:    invite.family_id,
      display_name: name,
      life_stage:   'adult',
      role:         'trusted_adult',
      locale:       'en',
    })
    .select()
    .single();

  if (profileErr || !profile) return { error: profileErr?.message ?? 'Failed to create profile.' };

  const { error: memberErr } = await supabase.from('family_members').insert({
    family_id:  invite.family_id,
    user_id:    user.id,
    profile_id: profile.id,
    role:       'trusted_adult',
  });
  if (memberErr) return { error: memberErr.message };

  await Promise.all([
    supabase.from('balance_accounts').insert({ profile_id: profile.id }),
    supabase.from('streaks').insert({ profile_id: profile.id }),
    // Burn the token so the link cannot be reused
    supabase.from('trusted_invitations').update({ used: true }).eq('id', invite.id),
  ]);

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

  const qty = Math.floor(amount);
  if (!Number.isFinite(qty) || qty < 1) return { error: 'Amount must be at least 1.' };
  if (qty > 20) return { error: 'You can gift at most 20 at a time.' };
  if (note && note.length > 200) return { error: 'Message is too long.' };

  const { data: giver } = await supabase
    .from('profiles')
    .select('family_id, role, display_name')
    .eq('id', fromProfileId)
    .eq('user_id', user.id)
    .single();

  if (!giver || !['trusted_adult', 'parent', 'admin'].includes(giver.role)) {
    return { error: 'Not authorized to gift.' };
  }

  const { data: recipient } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', toProfileId)
    .single();

  if (!recipient || recipient.family_id !== giver.family_id) {
    return { error: 'Recipient is not in your family.' };
  }
  if (fromProfileId === toProfileId) return { error: 'You cannot gift to yourself.' };

  // Gifts are backed by the trusted adult's own money, so nothing is deducted.
  const { data: credited } = await supabase.rpc('adjust_balance', {
    p_profile_id:            toProfileId,
    p_golden_delta:          qty,
    p_lifetime_golden_delta: qty,
  });
  if (!credited) return { error: 'Could not deliver the gift. Please try again.' };

  const giverName = giver.display_name ?? 'Someone';
  const plural    = qty > 1 ? 's' : '';

  await supabase.from('transactions').insert({
    profile_id:   toProfileId,
    type:         'gift_golden',
    golden_delta: qty,
    description:  note
      ? `${giverName} gifted you ${qty} Golden Higg${plural}: "${note}"`
      : `${giverName} gifted you ${qty} Golden Higg${plural}`,
    reference_id: fromProfileId,
  });

  await Promise.all([
    awardGoldenBadge(toProfileId),
    awardGiftGiverBadge(fromProfileId),
  ]);

  revalidatePath('/trusted');
  revalidatePath('/dashboard');
  return { success: true };
}
