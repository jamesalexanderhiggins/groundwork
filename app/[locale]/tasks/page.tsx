import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getActiveProfile } from '@/app/actions/profile';
import { getTodayCompletions } from '@/app/actions/tasks';
import { TaskList } from '@/components/higgy/TaskList';
import { CurrencyDisplay } from '@/components/higgy/CurrencyDisplay';
import { SiblingTrade } from '@/components/higgy/SiblingTrade';
import { BottomNav } from '@/components/higgy/BottomNav';

export const metadata = { title: 'Tasks' };

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fall back to the signed-in adult's own profile instead of bouncing to
  // the dashboard when no child has been selected yet.
  const { data: ownProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const activeProfileId = (await getActiveProfile()) ?? ownProfile?.id;
  if (!activeProfileId) redirect('/onboarding');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, family_id, cognitive_mode, skin, role')
    .eq('id', activeProfileId)
    .single();
  if (!profile) redirect('/dashboard');

  const [{ data: family }, { data: balance }, { data: streak }, { data: tasks }] =
    await Promise.all([
      supabase.from('families').select('*').eq('id', profile.family_id).single(),
      supabase.from('balance_accounts')
        .select('large_balance, small_balance, golden_balance')
        .eq('profile_id', activeProfileId).maybeSingle(),
      supabase.from('streaks')
        .select('current_streak')
        .eq('profile_id', activeProfileId).maybeSingle(),
      supabase.from('tasks')
        .select('id, title, reward_small, reward_large, is_gateway, time_block, category, sort_order, assigned_to')
        .eq('family_id', profile.family_id)
        .eq('active', true)
        .in('category', ['routine', 'bonus'])
        .order('sort_order', { ascending: true }),
    ]);

  const { data: siblings } = family?.sibling_trade
    ? await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('family_id', profile.family_id)
        .eq('role', 'child')
        .neq('id', activeProfileId)
    : { data: [] };

  // Resolve sender names in one query rather than one per trade.
  const { data: rawTrades } = await supabase
    .from('sibling_trades')
    .select('id, from_profile, large_amount, small_amount')
    .eq('to_profile', activeProfileId)
    .eq('status', 'pending');

  const senderIds = [...new Set((rawTrades ?? []).map(t => t.from_profile))];
  const { data: senders } = senderIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', senderIds)
    : { data: [] };

  const senderName = Object.fromEntries(
    (senders ?? []).map(s => [s.id, s.display_name]),
  );
  const pendingTrades = (rawTrades ?? []).map(t => ({
    ...t,
    from_name: senderName[t.from_profile] ?? 'Someone',
  }));

  const completedIds = await getTodayCompletions(activeProfileId);

  // Only show tasks assigned to this profile, or to nobody in particular.
  const mine = (tasks ?? []).filter(
    t => !t.assigned_to || t.assigned_to === activeProfileId,
  );

  const routine  = mine.filter(t => t.category === 'routine');
  const amTasks  = routine.filter(t => t.time_block === 'am');
  const pmTasks  = routine.filter(t => t.time_block === 'pm');
  const anyTasks = [
    ...routine.filter(t => t.time_block === 'any'),
    ...mine.filter(t => t.category === 'bonus'),
  ];

  const skinClass = `skin-${profile.skin ?? 'cloud_kingdom'}`;

  return (
    <div className={skinClass}>
      <main className="min-h-screen bg-[var(--color-bg)] pb-nav">
        <a href="#tasks" className="skip-link">Skip to tasks</a>

        <header className="bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] px-6 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-bold text-[var(--color-text)] text-lg truncate">
                {profile.display_name}&apos;s tasks
              </h1>
              {streak?.current_streak ? (
                <p className="text-xs opacity-60 text-[var(--color-text)]">
                  🔥 {streak.current_streak} day streak
                </p>
              ) : null}
            </div>
            <Link
              href="/dashboard"
              className="shrink-0 text-sm text-[var(--color-primary)] hover:underline"
            >
              Home
            </Link>
          </div>
        </header>

        {balance && family && (
          <div className="px-6 pt-4 max-w-lg mx-auto">
            <CurrencyDisplay
              large={balance.large_balance}
              small={balance.small_balance}
              golden={balance.golden_balance}
              largeName={family.large_coin_name}
              smallName={family.small_coin_name}
              goldenName={family.golden_coin_name}
            />
          </div>
        )}

        <div id="tasks" className="px-6 pt-4 max-w-lg mx-auto">
          <TaskList
            amTasks={amTasks}
            pmTasks={pmTasks}
            anyTasks={anyTasks}
            completedIds={completedIds}
            profileId={activeProfileId}
            smallName={family?.small_coin_name ?? 'Ginsey'}
            largeName={family?.large_coin_name ?? 'Higg'}
            cognitiveMode={profile.cognitive_mode}
            skin={profile.skin ?? 'cloud_kingdom'}
          />

          {family?.sibling_trade && (siblings?.length ?? 0) > 0 && (
            <SiblingTrade
              profileId={activeProfileId}
              siblings={siblings ?? []}
              pendingTrades={pendingTrades}
              largeName={family.large_coin_name}
              smallName={family.small_coin_name}
            />
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
