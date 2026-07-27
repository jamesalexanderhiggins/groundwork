'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function createChildProfile(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile) return { error: 'No family found' };

  const displayName = formData.get('display_name') as string;
  const lifeStage   = formData.get('life_stage') as string;
  const skin        = (formData.get('skin') as string) || 'cloud_kingdom';

  const { data: profile, error } = await supabase
    .from('profiles')
    .insert({
      family_id:    parentProfile.family_id,
      display_name: displayName,
      life_stage:   lifeStage,
      role:         'child',
      skin,
      locale:       'en',
    })
    .select()
    .single();

  if (error || !profile) return { error: error?.message ?? 'Failed to create profile' };

  await supabase.from('balance_accounts').insert({ profile_id: profile.id });
  await supabase.from('streaks').insert({ profile_id: profile.id });

  revalidatePath('/dashboard');
  return { profile };
}

export async function setActiveProfile(profileId: string) {
  const cookieStore = await cookies();
  cookieStore.set('active_profile', profileId, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath('/');
}

export async function getActiveProfile() {
  const cookieStore = await cookies();
  return cookieStore.get('active_profile')?.value ?? null;
}

export async function setSkin(profileId: string, skin: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Verify profile belongs to this user's family
  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('user_id', user.id)
    .single();

  const { data: target } = await supabase
    .from('profiles')
    .select('family_id, virtue_level')
    .eq('id', profileId)
    .single();

  if (!target || target.family_id !== parentProfile?.family_id) {
    return { error: 'Unauthorized' };
  }

  await supabase.from('profiles').update({ skin }).eq('id', profileId);
  revalidatePath('/profile');
  return { success: true };
}
