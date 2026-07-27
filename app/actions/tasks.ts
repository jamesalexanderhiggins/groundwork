'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { awardVirtuePoints } from '@/app/actions/virtue';
import { startOfWeek } from '@/lib/schedule';

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
    .select('reward_small, reward_large, reward_golden, is_gateway, time_block, family_id, active, requires_approval, category')
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

  // Weekly routine cap. The whitepaper caps routine earnings at 6 Higgs a
  // week; bonus tasks and quests are explicitly uncapped. The column existed
  // from the start but nothing ever read it.
  //
  // Hitting the cap must not block completion — "no shame mechanics, no
  // visible failure state". The task still completes and still counts toward
  // the streak; only the coins stop.
  let cappedOut = false;

  if (task.category === 'routine') {
    const { data: family } = await supabase
      .from('families')
      .select('weekly_routine_cap, small_per_large')
      .eq('id', auth.familyId)
      .single();

    const capHiggs     = family?.weekly_routine_cap ?? 0;
    const smallPerLarge = family?.small_per_large || 6;

    if (capHiggs > 0) {
      const weekStart = startOfWeek();

      const { data: weekRoutine } = await supabase
        .from('task_completions')
        .select('reward_small, reward_large, bonus_small, tasks!inner(category)')
        .eq('profile_id', profileId)
        .eq('tasks.category', 'routine')
        .gte('completed_at', weekStart.toISOString());

      // Express everything in small units for one clean comparison
      const earnedSmall = (weekRoutine ?? []).reduce(
        (sum, c) => sum + c.reward_small + (c.bonus_small ?? 0)
                       + c.reward_large * smallPerLarge,
        0,
      );
      const capSmall = capHiggs * smallPerLarge;

      if (earnedSmall >= capSmall) cappedOut = true;
    }
  }

  // 10% chance of a bonus Ginsey drop — not while capped out
  const bonusApplied = !cappedOut && Math.random() < 0.1;
  const bonusSmall   = bonusApplied ? 1 : 0;

  // Coins earned on this completion. Zero once the weekly cap is reached,
  // but the completion is still recorded.
  const earn = cappedOut
    ? { small: 0, large: 0, golden: 0 }
    : { small: task.reward_small, large: task.reward_large, golden: task.reward_golden };

  const { data: completion, error: completionError } = await supabase
    .from('task_completions')
    .insert({
      task_id:       taskId,
      profile_id:    profileId,
      reward_small:  earn.small,
      reward_large:  earn.large,
      reward_golden: earn.golden,
      bonus_applied: bonusApplied,
      bonus_small:   bonusSmall,
      ...(task.requires_approval ? { notes: 'Pending parent approval' } : {}),
      ...(cappedOut ? { notes: 'Weekly routine cap reached' } : {}),
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

  const totalSmall = earn.small + bonusSmall;

  if (totalSmall > 0 || earn.large > 0 || earn.golden > 0) {
    // Atomically credit earnings — no read-then-write race
    const { data: credited } = await supabase.rpc('adjust_balance', {
      p_profile_id:            profileId,
      p_small_delta:           totalSmall,
      p_large_delta:           earn.large,
      p_golden_delta:          earn.golden,
      p_lifetime_large_delta:  earn.large,
      p_lifetime_golden_delta: earn.golden,
    });

    if (!credited) {
      // Roll back the completion so the task can be retried
      await supabase.from('task_completions').delete().eq('id', completion.id);
      return { error: 'Could not credit your coins. Please try again.' };
    }

    await supabase.from('transactions').insert({
      profile_id:   profileId,
      type:         earn.golden > 0 ? 'earn_golden'
                  : earn.large  > 0 ? 'earn_large'
                  : 'earn_small',
      small_delta:  totalSmall,
      large_delta:  earn.large,
      golden_delta: earn.golden,
      description:  `Task completed${bonusApplied ? ' + bonus drop!' : ''}`,
      reference_id: taskId,
    });
  }

  const gateTriggered = !!task.is_gateway;
  const fullDay       = gateTriggered && task.time_block === 'pm';

  if (fullDay) await updateStreak(profileId, supabase);

  // Virtue points still accrue at the cap — the cap limits spendable
  // currency, not the long-term identity arc.
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
    cappedOut,
    timeBlock: task.time_block,
    reward: {
      small:  totalSmall,
      large:  earn.large,
      golden: earn.golden,
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
