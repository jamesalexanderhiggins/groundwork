'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { awardVirtuePoints, awardQuestBadges } from '@/app/actions/virtue';

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

export async function createQuest(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const caller = await callerFamily(supabase);
  if (!caller) return { error: 'Unauthorized' };
  if (!['parent', 'admin'].includes(caller.role)) {
    return { error: 'Only parents can create quests.' };
  }

  const title = ((formData.get('title') as string) ?? '').trim();
  if (!title) return { error: 'Quest title is required.' };

  const description  = ((formData.get('description') as string) ?? '').trim();
  const rewardLarge  = Math.max(0, parseInt(formData.get('reward_large')  as string) || 0);
  const rewardSmall  = Math.max(0, parseInt(formData.get('reward_small')  as string) || 0);
  const rewardGolden = Math.max(0, parseInt(formData.get('reward_golden') as string) || 0);
  const assignedTo   = (formData.get('assigned_to') as string) || null;
  const expiresHours = Math.max(0, parseInt(formData.get('expires_hours') as string) || 0);

  if (rewardLarge + rewardSmall + rewardGolden === 0) {
    return { error: 'A quest needs at least one coin as a reward.' };
  }

  // An assigned quest must belong to someone in this family
  if (assignedTo) {
    const { data: target } = await supabase
      .from('profiles').select('family_id').eq('id', assignedTo).single();
    if (!target || target.family_id !== caller.family_id) {
      return { error: 'That person is not in your family.' };
    }
  }

  const expiresAt = expiresHours > 0
    ? new Date(Date.now() + expiresHours * 3600000).toISOString()
    : null;

  const { error } = await supabase.from('tasks').insert({
    family_id:         caller.family_id,
    created_by:        caller.id,
    title,
    description:       description || null,
    category:          'quest',
    time_block:        'any',
    reward_large:      rewardLarge,
    reward_small:      rewardSmall,
    reward_golden:     rewardGolden,
    reward_type:       rewardGolden > 0 ? 'golden' : rewardLarge > 0 ? 'large' : 'small',
    assigned_to:       assignedTo,
    quest_expires_at:  expiresAt,
    requires_approval: true,
    is_recurring:      false,
    active:            true,
  });

  if (error) return { error: error.message };
  revalidatePath('/quests');
  revalidatePath('/parent/quests');
  return { success: true };
}

export async function acceptQuest(taskId: string, profileId: string) {
  const supabase = await createServerSupabaseClient();
  const caller = await callerFamily(supabase);
  if (!caller) return { error: 'Unauthorized' };

  // The accepting profile must be in the caller's family
  const { data: target } = await supabase
    .from('profiles').select('family_id').eq('id', profileId).single();
  if (!target || target.family_id !== caller.family_id) {
    return { error: 'Profile not in your family.' };
  }

  const { data: quest } = await supabase
    .from('tasks')
    .select('family_id, assigned_to, category, active, quest_expires_at')
    .eq('id', taskId)
    .single();

  if (!quest || quest.category !== 'quest') return { error: 'Quest not found.' };
  if (quest.family_id !== caller.family_id) return { error: 'Quest not in your family.' };
  if (!quest.active)                        return { error: 'This quest is closed.' };
  if (quest.assigned_to && quest.assigned_to !== profileId) {
    return { error: 'This quest is already taken.' };
  }
  if (quest.quest_expires_at && new Date(quest.quest_expires_at) < new Date()) {
    return { error: 'This quest has expired.' };
  }

  // Only claim if still unclaimed — guards against two children racing
  const { data: updated } = await supabase
    .from('tasks')
    .update({ assigned_to: profileId })
    .eq('id', taskId)
    .is('assigned_to', null)
    .select('id');

  if (!updated?.length && quest.assigned_to !== profileId) {
    return { error: 'Someone else just took this quest.' };
  }

  revalidatePath('/quests');
  return { success: true };
}

export async function completeQuest(taskId: string, profileId: string) {
  const supabase = await createServerSupabaseClient();
  const caller = await callerFamily(supabase);
  if (!caller) return { error: 'Unauthorized' };

  const { data: target } = await supabase
    .from('profiles').select('family_id').eq('id', profileId).single();
  if (!target || target.family_id !== caller.family_id) {
    return { error: 'Profile not in your family.' };
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('family_id, category, active, assigned_to, quest_expires_at, reward_small, reward_large, reward_golden, requires_approval')
    .eq('id', taskId)
    .single();

  if (!task || task.category !== 'quest')  return { error: 'Quest not found' };
  if (task.family_id !== caller.family_id) return { error: 'Quest not in your family.' };
  if (!task.active)                        return { error: 'This quest is closed.' };
  if (task.assigned_to && task.assigned_to !== profileId) {
    return { error: 'This quest belongs to someone else.' };
  }
  if (task.quest_expires_at && new Date(task.quest_expires_at) < new Date()) {
    return { error: 'This quest has expired.' };
  }

  // A quest is one-and-done, not daily
  const { count: existing } = await supabase
    .from('task_completions')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId)
    .eq('profile_id', profileId);

  if ((existing ?? 0) > 0) return { error: 'You have already completed this quest.' };

  const { error: insertErr } = await supabase.from('task_completions').insert({
    task_id:       taskId,
    profile_id:    profileId,
    reward_small:  task.reward_small,
    reward_large:  task.reward_large,
    reward_golden: task.reward_golden,
    ...(task.requires_approval ? { notes: 'Pending parent approval' } : {}),
  });
  if (insertErr) return { error: insertErr.message };

  if (task.requires_approval) {
    revalidatePath('/quests');
    return { pendingApproval: true };
  }

  await supabase.rpc('adjust_balance', {
    p_profile_id:            profileId,
    p_small_delta:           task.reward_small,
    p_large_delta:           task.reward_large,
    p_golden_delta:          task.reward_golden,
    p_lifetime_large_delta:  task.reward_large,
    p_lifetime_golden_delta: task.reward_golden,
  });

  await supabase.from('transactions').insert({
    profile_id:   profileId,
    type:         task.reward_golden > 0 ? 'earn_golden'
                : task.reward_large  > 0 ? 'earn_large'
                : 'earn_small',
    small_delta:  task.reward_small,
    large_delta:  task.reward_large,
    golden_delta: task.reward_golden,
    description:  'Quest completed',
    reference_id: taskId,
  });

  const virtue = await awardVirtuePoints(profileId, {
    small:  task.reward_small,
    large:  task.reward_large,
    golden: task.reward_golden,
  }, { quest_complete: true });

  const questBadges = await awardQuestBadges(profileId);

  revalidatePath('/quests');
  revalidatePath('/dashboard');
  return {
    success: true,
    virtue: { ...virtue, badgesAwarded: [...virtue.badgesAwarded, ...questBadges] },
  };
}
