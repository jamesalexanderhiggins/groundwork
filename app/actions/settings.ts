'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { routing } from '@/i18n/routing';

export type CognitiveMode = 'standard' | 'adhd' | 'autism' | 'dyslexia' | 'calm';

const VALID_MODES = new Set<CognitiveMode>([
  'standard', 'adhd', 'autism', 'dyslexia', 'calm',
]);

/** Any profile update must be scoped to the caller's own family. */
async function assertSameFamily(profileId: string) {
  const supabase = await createServerSupabaseClient();
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
  return { supabase };
}

export async function updateCognitiveMode(profileId: string, mode: CognitiveMode) {
  if (!VALID_MODES.has(mode)) return { error: 'Unknown mode.' };

  const auth = await assertSameFamily(profileId);
  if ('error' in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from('profiles')
    .update({ cognitive_mode: mode })
    .eq('id', profileId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  revalidatePath('/life');
  return { success: true };
}

export async function updateLocale(profileId: string, locale: string) {
  if (!routing.locales.includes(locale as never)) return { error: 'Unsupported language.' };

  const auth = await assertSameFamily(profileId);
  if ('error' in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from('profiles')
    .update({ locale })
    .eq('id', profileId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { success: true };
}

/** Update the family's economy settings. Parents only. */
export async function updateFamilySettings(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: caller } = await supabase
    .from('profiles').select('family_id, role').eq('user_id', user.id).single();
  if (!caller) return { error: 'No profile found' };
  if (!['parent', 'admin'].includes(caller.role)) {
    return { error: 'Only parents can change family settings.' };
  }

  const num = (key: string, fallback: number, min: number, max: number) => {
    const raw = formData.get(key);
    if (raw === null || raw === '') return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  const text = (key: string, fallback: string) =>
    ((formData.get(key) as string) ?? '').trim() || fallback;

  const { error } = await supabase.from('families').update({
    name:              text('name', 'Our family'),
    bank_name:         text('bank_name', 'Higgy Bank'),
    large_coin_name:   text('large_coin_name', 'Higg'),
    small_coin_name:   text('small_coin_name', 'Ginsey'),
    golden_coin_name:  text('golden_coin_name', 'Golden Higg'),
    small_per_large:   num('small_per_large',   6,  1, 100),
    large_cash_value:  num('large_cash_value',  2,  0, 1000),
    golden_cash_value: num('golden_cash_value', 5,  0, 1000),
    large_minutes:     num('large_minutes',     30, 1, 600),
    small_minutes:     num('small_minutes',     5,  1, 600),
    golden_minutes:    num('golden_minutes',    60, 1, 600),
    cap_sunday:        num('cap_sunday',    0,   0, 1440),
    cap_monday:        num('cap_monday',    60,  0, 1440),
    cap_tuesday:       num('cap_tuesday',   90,  0, 1440),
    cap_wednesday:     num('cap_wednesday', 120, 0, 1440),
    cap_thursday:      num('cap_thursday',  90,  0, 1440),
    cap_friday:        num('cap_friday',    150, 0, 1440),
    cap_saturday:      num('cap_saturday',  0,   0, 1440),
    sibling_trade:     formData.get('sibling_trade')  === 'on',
    no_borrowing:      formData.get('no_borrowing')   === 'on',
  }).eq('id', caller.family_id);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}
