'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export type CognitiveMode = 'standard' | 'adhd' | 'autism' | 'dyslexia' | 'calm';

export async function updateCognitiveMode(profileId: string, mode: CognitiveMode) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('profiles')
    .update({ cognitive_mode: mode })
    .eq('id', profileId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { success: true };
}

export async function updateLocale(profileId: string, locale: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('profiles')
    .update({ locale })
    .eq('id', profileId);

  if (error) return { error: error.message };
  return { success: true };
}
