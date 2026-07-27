'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { awardVirtuePoints } from '@/app/actions/virtue';

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/** Verify the signed-in user may act on behalf of this profile. */
async function assertSameFamily(supabase: SupabaseClient, profileId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' as const };

  const { data: caller } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('user_id', user.id)
    .single();
  if (!caller) return { error: 'No profile found' as const };

  const { data: target } = await supabase
    .from('profiles')
    .select('id, family_id')
    .eq('id', profileId)
    .single();
  if (!target || target.family_id !== caller.family_id) {
    return { error: 'Profile not in your family' as const };
  }

  return { familyId: caller.family_id };
}

export async function completeTask(taskId: string, profileId: string) {
  const supabase = await createServerSupabaseClient();

  const auth = await assertSameFamily(supabase, profileId);
  if ('error' in auth) return { error: auth.error };

  const { data: task } = await supabase
    .from('tasks')
    .select('reward_small, reward_large, reward_golden, is_gateway, time_block, family_id, active, requires_approval')
    .eq('id', taskId)
    .single();

  if (!task)                            return { error: 'Task not found' };
  if (!task.active)                     return { error: 'This task is no longer active.' };
  if (task.family_id !== auth.familyId) return { error: 'Task not in your family' };

  // A recurring task may only be completed once per calendar day —
  // without this the same task can be tapped repeatedly for unlimited coins.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: alreadyDone } = await supabase
    .from('task_completions')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId)
    .eq('profile_id', profileId)
    .gte('completed_at', todayStart.toISOString());

  if ((alreadyDone ?? 0) > 0) {
    return { error: 'Already completed today.', alreadyCompleted: true };
  }

  // 10% chance of a bonus Ginsey drop
  const bonusApplied = Math.random() < 0.1;
  const bonusSmall   = bonusApplied ? 1 : 0;

  const { data: completion, error: completionError } = await supabase
    .from('task_completions')
    .insert({
      task_id:       taskId,
      profile_id:    profileId,
      reward_small:  task.reward_small,
      reward_large:  task.reward_large,
      reward_golden: task.reward_golden,
      bonus_applied: bonusApplied,
      bonus_small:   bonusSmall,
      // Tasks needing approval are credited later by the parent
      ...(task.requires_approval ? { notes: 'Pending parent approval' } : {}),
    })
    .select('id')
    .single();

  if (completionError) return { error: completionError.message };

  if (task.requires_approval) {
    revalidatePath('/tasks');
    return {
      pendingApproval: true,
      bonusApplied:    false,
      bonusSmall:      0,
      gateTriggered:   false,
      timeBlock:       task.time_block,
      reward:          { small: 0, large: 0, golden: 0 },
      virtue:          null,
    };
  }

  // Atomically credit earnings — no read-then-write race
  const { data: credited } = await supabase.rpc('adjust_balance', {
    p_profile_id:            profileId,
    p_small_delta:           task.reward_small + bonusSmall,
    p_large_delta:           task.reward_large,
    p_golden_delta:          task.reward_golden,
    p_lifetime_large_delta:  task.reward_large,
    p_lifetime_golden_delta: task.reward_golden,
  });

  if (!credited) {
    // Roll back the completion so the task can be retried
    await supabase.from('task_completions').delete().eq('id', completion.id);
    return { error: 'Could not credit your coins. Please try again.' };
  }

  await supabase.from('transactions').insert({
    profile_id:   profileId,
    type:         task.reward_golden > 0 ? 'earn_golden'
                : task.reward_large  > 0 ? 'earn_large'
                : 'earn_small',
    small_delta:  task.reward_small + bonusSmall,
    large_delta:  task.reward_large,
    golden_delta: task.reward_golden,
    description:  `Task completed${bonusApplied ? ' + bonus drop!' : ''}`,
    reference_id: taskId,
  });

  const gateTriggered = !!task.is_gateway;
  const fullDay       = gateTriggered && task.time_block === 'pm';

  if (fullDay) await updateStreak(profileId, supabase);

  const virtue = await awardVirtuePoints(profileId, {
    small:  task.reward_small + bonusSmall,
    large:  task.reward_large,
    golden: task.reward_golden,
  }, { full_day: fullDay });

  revalidatePath('/tasks');
  revalidatePath('/dashboard');

  return {
    bonusApplied,
    bonusSmall,
    gateTriggered,
    timeBlock: task.time_block,
    reward: {
      small:  task.reward_small + bonusSmall,
      large:  task.reward_large,
      golden: task.reward_golden,
    },
    virtue,
  };
}

/** Undo a completion made today (mis-taps are common with young children). */
export async function undoTaskCompletion(taskId: string, profileId: string) {
  const supabase = await createServerSupabaseClient();

  const auth = await assertSameFamily(supabase, profileId);
  if ('error' in auth) return { error: auth.error };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: completion } = await supabase
    .from('task_completions')
    .select('id, reward_small, reward_large, reward_golden, bonus_small, approved_at')
    .eq('task_id', taskId)
    .eq('profile_id', profileId)
    .gte('completed_at', todayStart.toISOString())
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!completion) return { error: 'Nothing to undo.' };

  // Reverse the credit. adjust_balance floors at zero, so if the coins have
  // already been spent this returns false and we leave the record in place.
  const { data: reversed } = await supabase.rpc('adjust_balance', {
    p_profile_id:   profileId,
    p_small_delta:  -(completion.reward_small + (completion.bonus_small ?? 0)),
    p_large_delta:  -completion.reward_large,
    p_golden_delta: -completion.reward_golden,
  });

  if (!reversed) return { error: 'Those coins have already been spent.' };

  await supabase.from('task_completions').delete().eq('id', completion.id);

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  return { success: true };
}

async function updateStreak(profileId: string, supabase: SupabaseClient) {
  const today = new Date().toISOString().split('T')[0];

  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_full_day')
    .eq('profile_id', profileId)
    .maybeSingle();

  // Seed the row if the profile predates balance seeding
  if (!streak) {
    await supabase.from('streaks').insert({
      profile_id:     profileId,
      current_streak: 1,
      longest_streak: 1,
      last_full_day:  today,
    });
    return;
  }

  // Already counted today — don't double-increment
  if (streak.last_full_day === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const newCurrent = streak.last_full_day === yesterday ? streak.current_streak + 1 : 1;

  await supabase.from('streaks').update({
    current_streak: newCurrent,
    longest_streak: Math.max(streak.longest_streak ?? 0, newCurrent),
    last_full_day:  today,
  }).eq('profile_id', profileId);
}

export async function getTodayCompletions(profileId: string) {
  const supabase = await createServerSupabaseClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('task_completions')
    .select('task_id')
    .eq('profile_id', profileId)
    .gte('completed_at', todayStart.toISOString());

  return (data ?? []).map(c => c.task_id as string);
}
