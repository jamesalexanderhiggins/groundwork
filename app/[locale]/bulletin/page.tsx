import { redirect }       from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getActiveProfile } from '@/app/actions/profile';
import { getTodayCompletions } from '@/app/actions/tasks';
import { TaskTapButton }  from '@/components/higgy/TaskTapButton';
import { BottomNav }      from '@/components/higgy/BottomNav';
import { CurrencyDisplay } from '@/components/higgy/CurrencyDisplay';

export default async function BulletinPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const activeProfileId = await getActiveProfile();
  if (!activeProfileId) redirect('/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, family_id, skin, cognitive_mode')
    .eq('id', activeProfileId)
    .single();
  if (!profile) redirect('/dashboard');

  const { data: family } = await supabase
    .from('families')
    .select('large_coin_name, small_coin_name, golden_coin_name')
    .eq('id', profile.family_id)
    .single();

  const { data: balance } = await supabase
    .from('balance_accounts')
    .select('large_balance, small_balance, golden_balance')
    .eq('profile_id', activeProfileId)
    .single();

  const { data: bonusTasks } = await supabase
    .from('tasks')
    .select('id, title, description, reward_small, reward_large, reward_golden, is_gateway, time_block')
    .eq('family_id', profile.family_id)
    .eq('category', 'bonus')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  const completedIds = await getTodayCompletions(activeProfileId);
  const skinClass = `skin-${profile.skin ?? 'cloud_kingdom'}`;

  return (
    <div className={skinClass}>
      <main className="min-h-screen bg-[var(--color-bg)] pb-24">
        <header className="bg-[var(--color-bg-card)] shadow-sm px-6 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto">
            <h1 className="font-bold text-[var(--color-text)] text-lg">📋 Bonus Tasks</h1>
            {balance && family && (
              <div className="mt-2">
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
          </div>
        </header>

        <div className="px-6 pt-4 max-w-lg mx-auto">
          {(!bonusTasks || bonusTasks.length === 0) ? (
            <div className="text-center py-16 opacity-50 text-[var(--color-text)]">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-semibold">Nothing on the board yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm opacity-60 text-[var(--color-text)] mb-2">
                Earn extra coins by completing these bonus tasks. Available any time.
              </p>
              {bonusTasks.map(task => (
                <div key={task.id}>
                  {task.description && (
                    <p className="text-xs opacity-50 text-[var(--color-text)] px-1 mb-1">{task.description}</p>
                  )}
                  <TaskTapButton
                    task={task}
                    profileId={activeProfileId}
                    smallName={family?.small_coin_name ?? 'Ginsey'}
                    largeName={family?.large_coin_name ?? 'Higg'}
                    adhdMode={profile.cognitive_mode === 'adhd'}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
