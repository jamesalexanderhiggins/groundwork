'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function getActiveNudge(profileId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('nudges')
    .select('*')
    .eq('profile_id', profileId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function dismissNudge(nudgeId: string) {
  const supabase = await createServerSupabaseClient();
  await supabase.from('nudges').update({ dismissed_at: new Date().toISOString() }).eq('id', nudgeId);
  revalidatePath("/life");
  return { success: true };
}

export async function generateAndSaveNudge(profileId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, cognitive_mode, life_stage, locale')
    .eq('id', profileId)
    .single();

  if (!profile) return { error: 'Profile not found' };

  const { data: pendingItems } = await supabase
    .from('life_items')
    .select('title, due_at')
    .eq('profile_id', profileId)
    .eq('status', 'pending')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(5);

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/generate-nudge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pendingItems: pendingItems ?? [],
      context: {
        display_name:   profile.display_name,
        cognitive_mode: profile.cognitive_mode,
        life_stage:     profile.life_stage,
        locale:         profile.locale,
      },
    }),
  });

  if (!res.ok) return { error: 'AI request failed' };
  const nudgeData = await res.json();

  const { data: nudge, error } = await supabase
    .from('nudges')
    .insert({
      profile_id:     profileId,
      body:           nudgeData.body,
      action_label:   nudgeData.action_label ?? null,
      action_type:    nudgeData.action_type  ?? null,
      delivered_at:   new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { nudge };
}
