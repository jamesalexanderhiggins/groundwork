'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * Service Acts.
 *
 * The whitepaper defines a 'service' task category and the approvals queue
 * counts them toward the Community Hero badge, but nothing in the app could
 * ever create one — the category was unreachable.
 *
 * A Service Act is something a child did for someone else, unprompted. They
 * describe it, a parent approves it, and the coins land on approval. The
 * approval step is deliberate: the whitepaper calls it "a moment of genuine
 * connection and recognition", not an anti-fraud measure.
 */

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

async function callerFamily(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, family_id, role')
    .eq('user_id', user.id)
    .single();
  return data;
}

/** A child (or the adult on their behalf) logs an act of service. */
export async function submitServiceAct(
  profileId: string,
  description: string,
  rewardSmall = 1,
) {
  const supabase = await createServerSupabaseClient();
  const caller = await callerFamily(supabase);
  if (!caller) return { error: 'Unauthorized' };

  const text = description.trim();
  if (!text)             return { error: 'Tell us what you did.' };
  if (text.length > 300) return { error: 'That is a bit long — keep it short.' };

  const { data: target } = await supabase
    .from('profiles')
    .select('family_id, display_name')
    .eq('id', profileId)
    .single();
  if (!target || target.family_id !== caller.family_id) {
    return { error: 'Profile not in your family.' };
  }

  const small = Math.min(6, Math.max(1, Math.floor(rewardSmall)));

  // Each act is its own task row so the approvals queue and the
  // Community Hero count both work off the normal task join.
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .insert({
      family_id:         caller.family_id,
      created_by:        caller.id,
      assigned_to:       profileId,
      title:             text,
      description:       'Act of service',
      category:          'service',
      time_block:        'any',
      reward_type:       'small',
      reward_small:      small,
      requires_approval: true,
      is_recurring:      false,
      active:            true,
    })
    .select('id')
    .single();

  if (taskErr || !task) return { error: taskErr?.message ?? 'Could not log that.' };

  const { error: compErr } = await supabase.from('task_completions').insert({
    task_id:      task.id,
    profile_id:   profileId,
    reward_small: small,
    reward_large: 0,
    reward_golden: 0,
    notes:        'Pending parent approval',
  });

  if (compErr) {
    // Don't leave an orphan task behind if the completion failed
    await supabase.from('tasks').delete().eq('id', task.id);
    return { error: compErr.message };
  }

  revalidatePath('/bulletin');
  revalidatePath('/parent/approvals');
  return { success: true };
}

/** Acts this profile has logged, newest first. */
export async function getServiceActs(profileId: string, limit = 10) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('task_completions')
    .select('id, completed_at, approved_at, reward_small, tasks!inner(title, category)')
    .eq('profile_id', profileId)
    .eq('tasks.category', 'service')
    .order('completed_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map(row => {
    const t = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
    return {
      id:           row.id,
      title:        (t as { title: string })?.title ?? 'Act of service',
      completed_at: row.completed_at as string,
      approved:     !!row.approved_at,
      reward_small: row.reward_small as number,
    };
  });
}
