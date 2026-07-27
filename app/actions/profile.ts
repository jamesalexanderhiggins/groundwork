'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { LIFE_STAGES, type LifeStage } from '@/lib/life-stage';
import { SKINS, type SkinKey } from '@/lib/skins';
import { isSkinUnlocked } from '@/lib/virtue';

const VALID_STAGES = new Set(LIFE_STAGES.map(s => s.key));
const VALID_SKINS  = new Set(SKINS.map(s => s.key));

/**
 * Create a child (or teen) profile inside the caller's family.
 * Child profiles have no user_id — they are switched into by the parent
 * rather than logged into directly.
 */
export async function createChildProfile(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile) return { error: 'No family found. Please finish setup first.' };
  if (!['parent', 'admin'].includes(parentProfile.role)) {
    return { error: 'Only parents can add family members.' };
  }

  const displayName = ((formData.get('display_name') as string) ?? '').trim();
  const lifeStage   = (formData.get('life_stage') as string) ?? 'young';
  const skin        = (formData.get('skin') as string) || 'cloud_kingdom';

  if (!displayName)                return { error: 'Name is required.' };
  if (displayName.length > 40)     return { error: 'Name is too long.' };
  if (!VALID_STAGES.has(lifeStage as LifeStage)) return { error: 'Invalid age group.' };
  if (!VALID_SKINS.has(skin as SkinKey))         return { error: 'Invalid theme.' };

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

  // Every profile needs a balance account and a streak row, or the
  // bank and task screens render empty and adjust_balance silently no-ops.
  await Promise.all([
    supabase.from('balance_accounts').insert({ profile_id: profile.id }),
    supabase.from('streaks').insert({ profile_id: profile.id }),
  ]);

  revalidatePath('/dashboard');
  return { profile };
}

export async function setActiveProfile(profileId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Only allow switching to a profile inside the caller's own family
  const { data: caller } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('user_id', user.id)
    .single();
  if (!caller) return { error: 'No profile found' };

  const { data: target } = await supabase
    .from('profiles')
    .select('id, family_id')
    .eq('id', profileId)
    .single();

  if (!target || target.family_id !== caller.family_id) {
    return { error: 'Profile not in your family' };
  }

  const cookieStore = await cookies();
  cookieStore.set('active_profile', profileId, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   60 * 60 * 24 * 30,
  });
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function getActiveProfile() {
  const cookieStore = await cookies();
  return cookieStore.get('active_profile')?.value ?? null;
}

export async function clearActiveProfile() {
  const cookieStore = await cookies();
  cookieStore.delete('active_profile');
  revalidatePath('/', 'layout');
}

export async function setSkin(profileId: string, skin: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  if (!VALID_SKINS.has(skin as SkinKey)) return { error: 'Unknown theme.' };

  const { data: caller } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('user_id', user.id)
    .single();

  const { data: target } = await supabase
    .from('profiles')
    .select('family_id, virtue_level')
    .eq('id', profileId)
    .single();

  if (!target || !caller || target.family_id !== caller.family_id) {
    return { error: 'Unauthorized' };
  }

  // Enforce the unlock ladder — the picker hides locked skins, but the
  // action is callable directly.
  if (!isSkinUnlocked(skin as SkinKey, target.virtue_level ?? 1)) {
    return { error: 'That theme is not unlocked yet.' };
  }

  const { error } = await supabase.from('profiles').update({ skin }).eq('id', profileId);
  if (error) return { error: error.message };

  revalidatePath('/profile');
  revalidatePath('/tasks');
  return { success: true };
}

/** Rename a profile. Parents only, own family only. */
export async function renameProfile(profileId: string, displayName: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const name = displayName.trim();
  if (!name)            return { error: 'Name is required.' };
  if (name.length > 40) return { error: 'Name is too long.' };

  const { data: caller } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('user_id', user.id)
    .single();
  if (!caller || !['parent', 'admin'].includes(caller.role)) {
    return { error: 'Only parents can rename profiles.' };
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', profileId)
    .single();
  if (!target || target.family_id !== caller.family_id) {
    return { error: 'Profile not in your family.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', profileId);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { success: true };
}
