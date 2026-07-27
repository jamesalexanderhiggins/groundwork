import { redirect }          from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getActiveProfile }  from '@/app/actions/profile';
import { getTodayCompletions } from '@/app/actions/tasks';
import { TaskList }          from '@/components/higgy/TaskList';
import { CurrencyDisplay }   from '@/components/higgy/CurrencyDisplay';
import { SiblingTrade }      from '@/components/higgy/SiblingTrade';
import { BottomNav }         from '@/components/higgy/BottomNav';

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const activeProfileId = await getActiveProfile();
  if (!activeProfileId) redirect('/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, family_id, cognitive_mode, skin, role')
    .eq('id', activeProfileId)
    .single();
  if (!profile) redirect('/dashboard');

  const { data: family } = await supabase
    .from('families')
    .select('*')
    .eq('id', profile.family_id)
    .single();

  const { data: balance } = await supabase
    .from('balance_accounts')
    .select('large_balance, small_balance, golden_balance')
    .eq('profile_id', activeProfileId)
    .single();

  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak')
    .eq('profile_id', activeProfileId)
    .single();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, reward_small, reward_large, is_gateway, time_block, category, sort_order')
    .eq('family_id', profile.family_id)
    .eq('active', true)
    .eq('category', 'routine')
    .order('sort_order', { ascending: true });

  // Siblings for trade
  const { data: siblings } = family?.sibling_trade ? await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('family_id', profile.family_id)
    .eq('role', 'child')
    .neq('id', activeProfileId) : { data: [] };

  // Pending trades to this profile
  const { data: rawTrades } = await supabase
    .from('sibling_trades')
    .select('id, from_profile, large_amount, small_amount')
    .eq('to_profile', activeProfileId)
    .eq('status', 'pending');

  const pendingTrades = await Promise.all(
    (rawTrades ?? []).map(async t => {
      const { data: fromProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', t.from_profile)
        .single();
      return { ...t, from_name: fromProfile?.display_name ?? 'Someone' };
    })
  );

  const completedIds = await getTodayCompletions(activeProfileId);
  const amTasks = (tasks ?? []).filter(t => t.time_block === 'am');
  const pmTasks = (tasks ?? []).filter(t => t.time_block === 'pm');
  const skinClass = `skin-${profile.skin ?? 'cloud_kingdom'}`;

  return (
    <div className={skinClass}>
      <main className="min-h-screen bg-[var(--color-bg)] pb-24">
        <header className="bg-[var(--color-bg-card)] shadow-sm px-6 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div>
              <h1 className="font-bold text-[var(--color-text)] text-lg">{profile.display_name}&apos;s tasks</h1>
              {streak?.current_streak ? (
                <p className="text-xs opacity-60 text-[var(--color-text)]">🔥 {streak.current_streak} day streak</p>
              ) : null}
            </div>
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

        <div className="px-6 pt-4 max-w-lg mx-auto">
          <TaskList
            amTasks={amTasks}
            pmTasks={pmTasks}
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
