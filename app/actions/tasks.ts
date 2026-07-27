'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { awardVirtuePoints } from '@/app/actions/virtue';

export async function completeTask(taskId: string, profileId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: task } = await supabase
    .from('tasks')
    .select('reward_small, reward_large, reward_golden, is_gateway, time_block, family_id')
    .eq('id', taskId)
    .single();

  if (!task) return { error: 'Task not found' };

  // 10% chance of bonus Ginsey drop
  const bonusApplied = Math.random() < 0.1;
  const bonusSmall   = bonusApplied ? 1 : 0;

  const { error: completionError } = await supabase.from('task_completions').insert({
    task_id:      taskId,
    profile_id:   profileId,
    reward_small:  task.reward_small,
    reward_large:  task.reward_large,
    reward_golden: task.reward_golden,
    bonus_applied: bonusApplied,
    bonus_small:   bonusSmall,
  });

  if (completionError) return { error: completionError.message };

  // Atomically credit earnings — no read-then-write race
  const { data: credited } = await supabase.rpc('adjust_balance', {
    p_profile_id:            profileId,
    p_small_delta:           task.reward_small + bonusSmall,
    p_large_delta:           task.reward_large,
    p_golden_delta:          task.reward_golden,
    p_lifetime_large_delta:  task.reward_large,
    p_lifetime_golden_delta: task.reward_golden,
  });

  if (credited) {
    await supabase.from('transactions').insert({
      profile_id:  profileId,
      type:        task.reward_small > 0 ? 'earn_small' : task.reward_large > 0 ? 'earn_large' : 'earn_golden',
      small_delta:  task.reward_small + bonusSmall,
      large_delta:  task.reward_large,
      golden_delta: task.reward_golden,
      description: `Task completed${bonusApplied ? ' + bonus drop!' : ''}`,
      reference_id: taskId,
    });
  }

  // Check if this was the gateway task → triggers GateEvent
  const gateTriggered = task.is_gateway;

  // Update streak if gateway triggered
  if (gateTriggered && task.time_block === 'pm') {
    await updateStreak(profileId, supabase);
  }

  // Award virtue points
  const virtue = await awardVirtuePoints(profileId, {
    small:  task.reward_small  + bonusSmall,
    large:  task.reward_large,
    golden: task.reward_golden,
  }, {
    full_day: gateTriggered && task.time_block === 'pm',
  });

  revalidatePath('/tasks');

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

async function updateStreak(profileId: string, supabase: Awaited<ReturnType<typeof import('@/lib/supabase-server').createServerSupabaseClient>>) {
  const today = new Date().toISOString().split('T')[0];
  const { data: streak } = await supabase
    .from('streaks')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  if (!streak) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastDay   = streak.last_full_day;
  const isStreak  = lastDay === yesterday;

  const newCurrent = isStreak ? streak.current_streak + 1 : 1;
  await supabase.from('streaks').update({
    current_streak: newCurrent,
    longest_streak: Math.max(streak.longest_streak, newCurrent),
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
