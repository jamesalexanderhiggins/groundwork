'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function createQuest(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('id, family_id')
    .eq('user_id', user.id)
    .single();
  if (!parentProfile) return { error: 'Not found' };

  const title         = formData.get('title') as string;
  const description   = formData.get('description') as string;
  const rewardLarge   = parseInt(formData.get('reward_large') as string) || 0;
  const rewardSmall   = parseInt(formData.get('reward_small') as string) || 0;
  const rewardGolden  = parseInt(formData.get('reward_golden') as string) || 0;
  const assignedTo    = (formData.get('assigned_to') as string) || null;
  const expiresHours  = parseInt(formData.get('expires_hours') as string) || 0;

  const expiresAt = expiresHours > 0
    ? new Date(Date.now() + expiresHours * 3600000).toISOString()
    : null;

  const { error } = await supabase.from('tasks').insert({
    family_id:       parentProfile.family_id,
    created_by:      parentProfile.id,
    title,
    description,
    category:        'quest',
    time_block:      'any',
    reward_large:    rewardLarge,
    reward_small:    rewardSmall,
    reward_golden:   rewardGolden,
    reward_type:     rewardGolden > 0 ? 'golden' : rewardLarge > 0 ? 'large' : 'small',
    assigned_to:     assignedTo || null,
    quest_expires_at: expiresAt,
    requires_approval: true,
    is_recurring:    false,
  });

  if (error) return { error: error.message };
  revalidatePath('/quests');
  return { success: true };
}

export async function acceptQuest(taskId: string, profileId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  await supabase.from('tasks').update({
    assigned_to: profileId,
  }).eq('id', taskId);

  revalidatePath('/quests');
  return { success: true };
}

export async function completeQuest(taskId: string, profileId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: task } = await supabase
    .from('tasks')
    .select('reward_small, reward_large, reward_golden, requires_approval')
    .eq('id', taskId)
    .single();
  if (!task) return { error: 'Quest not found' };

  if (task.requires_approval) {
    await supabase.from('task_completions').insert({
      task_id:    taskId,
      profile_id: profileId,
      reward_small:  task.reward_small,
      reward_large:  task.reward_large,
      reward_golden: task.reward_golden,
      notes: 'Pending parent approval',
    });
    return { pendingApproval: true };
  }

  await supabase.from('task_completions').insert({
    task_id:    taskId,
    profile_id: profileId,
    reward_small:  task.reward_small,
    reward_large:  task.reward_large,
    reward_golden: task.reward_golden,
  });

  await supabase.rpc('adjust_balance', {
    p_profile_id:            profileId,
    p_small_delta:           task.reward_small,
    p_large_delta:           task.reward_large,
    p_golden_delta:          task.reward_golden,
    p_lifetime_large_delta:  task.reward_large,
    p_lifetime_golden_delta: task.reward_golden,
  });

  revalidatePath('/quests');
  return { success: true };
}
