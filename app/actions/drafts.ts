'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function saveDraft(profileId: string, prompt: string, content: string, type?: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data, error } = await supabase
    .from('drafts')
    .insert({ profile_id: profileId, prompt, content, type: type ?? 'message', status: 'draft' })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/life");
  return { draft: data };
}

export async function updateDraftStatus(draftId: string, status: 'draft' | 'sent' | 'discarded') {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('drafts').update({ status }).eq('id', draftId);
  if (error) return { error: error.message };
  revalidatePath("/life");
  return { success: true };
}

export async function getRecentDrafts(profileId: string, limit = 10) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('drafts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}
