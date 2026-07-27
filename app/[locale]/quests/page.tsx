import { redirect }          from 'next/navigation';
import { AnimatePresence }   from 'framer-motion';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getActiveProfile }  from '@/app/actions/profile';
import { QuestBoard }        from '@/components/higgy/QuestBoard';
import { BottomNav }         from '@/components/higgy/BottomNav';

export default async function QuestsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const activeProfileId = await getActiveProfile();
  if (!activeProfileId) redirect('/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, family_id, skin')
    .eq('id', activeProfileId)
    .single();
  if (!profile) redirect('/dashboard');

  const { data: family } = await supabase
    .from('families')
    .select('large_coin_name, small_coin_name, golden_coin_name')
    .eq('id', profile.family_id)
    .single();

  const { data: quests } = await supabase
    .from('tasks')
    .select('id, title, description, reward_large, reward_small, reward_golden, quest_expires_at, assigned_to')
    .eq('family_id', profile.family_id)
    .eq('category', 'quest')
    .eq('active', true)
    .or(`assigned_to.is.null,assigned_to.eq.${activeProfileId}`);

  const skinClass = `skin-${profile.skin ?? 'cloud_kingdom'}`;

  return (
    <div className={skinClass}>
      <main className="min-h-screen bg-[var(--color-bg)] pb-24">
        <header className="bg-[var(--color-bg-card)] shadow-sm px-6 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto">
            <h1 className="font-bold text-[var(--color-text)] text-lg">⚔️ Quest Board</h1>
          </div>
        </header>
        <div className="px-6 pt-4 max-w-lg mx-auto">
          <QuestBoard
            quests={quests ?? []}
            profileId={activeProfileId}
            largeName={family?.large_coin_name ?? 'Higg'}
            smallName={family?.small_coin_name ?? 'Ginsey'}
            goldenName={family?.golden_coin_name ?? 'Golden Higg'}
          />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
