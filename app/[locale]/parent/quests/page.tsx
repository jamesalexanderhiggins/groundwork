import { redirect }       from 'next/navigation';
import Link               from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { CreateQuestForm } from '@/components/parent/CreateQuestForm';

export default async function ParentQuestsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile || !['parent', 'admin'].includes(parentProfile.role)) redirect('/dashboard');

  const { data: children } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('family_id', parentProfile.family_id)
    .eq('role', 'child');

  const { data: quests } = await supabase
    .from('tasks')
    .select('id, title, reward_large, reward_small, reward_golden, quest_expires_at, active')
    .eq('family_id', parentProfile.family_id)
    .eq('category', 'quest')
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-[var(--color-primary)] hover:underline text-sm">← Back</Link>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Manage Quests</h1>
      </div>

      <section className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-6 shadow mb-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-4">Create a quest</h2>
        <CreateQuestForm children={children ?? []} />
      </section>

      <section>
        <h2 className="font-semibold text-[var(--color-text)] mb-3">Active quests</h2>
        <div className="flex flex-col gap-2">
          {(quests ?? []).filter(q => q.active).map(q => (
            <div key={q.id} className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-4 shadow-sm">
              <p className="font-medium text-[var(--color-text)]">{q.title}</p>
              <p className="text-sm opacity-60 text-[var(--color-text)]">
                {q.reward_large > 0 && `${q.reward_large} Higgs `}
                {q.reward_small > 0 && `${q.reward_small} Ginseys `}
                {q.reward_golden > 0 && `${q.reward_golden} Golden `}
                {q.quest_expires_at && `· expires ${new Date(q.quest_expires_at).toLocaleDateString()}`}
              </p>
            </div>
          ))}
          {(quests ?? []).filter(q => q.active).length === 0 && (
            <p className="text-sm opacity-50 text-[var(--color-text)]">No active quests.</p>
          )}
        </div>
      </section>
    </main>
  );
}
