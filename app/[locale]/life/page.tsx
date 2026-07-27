import { redirect }                   from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getLifeItems }               from '@/app/actions/life-items';
import { getActiveNudge }             from '@/app/actions/nudges';
import { getRecentDrafts }            from '@/app/actions/drafts';
import { NaturalLanguageInput }       from '@/components/kempt/NaturalLanguageInput';
import { LifeItemList }               from '@/components/kempt/LifeItemList';
import { DraftEngine }                from '@/components/kempt/DraftEngine';
import { NudgeCard }                  from '@/components/kempt/NudgeCard';
import type { UserContext }           from '@/lib/ai';

export default async function KemptLifePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, cognitive_mode, life_stage, locale, role')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  const [items, nudge, recentDrafts] = await Promise.all([
    getLifeItems(profile.id),
    getActiveNudge(profile.id),
    getRecentDrafts(profile.id, 5),
  ]);

  const context: UserContext = {
    display_name:   profile.display_name,
    cognitive_mode: profile.cognitive_mode as UserContext['cognitive_mode'],
    life_stage:     profile.life_stage as UserContext['life_stage'],
    locale:         profile.locale,
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-5 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">{greeting}</p>
            <h1 className="font-bold text-xl text-gray-900">{profile.display_name}</h1>
          </div>
          <a href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Family</a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 pt-6 flex flex-col gap-8">
        {/* Nudge */}
        {nudge && <NudgeCard nudge={nudge} />}

        {/* Life Items */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Life Admin</h2>
            <span className="text-xs text-gray-400">{items.length} pending</span>
          </div>

          {/* Natural language add */}
          <div className="mb-4">
            <NaturalLanguageInput
              profileId={profile.id}
              context={context}
            />
          </div>

          <LifeItemList items={items} profileId={profile.id} />
        </section>

        {/* Draft Engine */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Draft Engine</h2>
          <p className="text-sm text-gray-400 mb-4">
            Describe what you need to write — email, letter, message, review — and AI will draft it.
          </p>
          <DraftEngine profileId={profile.id} context={context} />
        </section>

        {/* Recent drafts */}
        {recentDrafts.length > 0 && (
          <section>
            <h2 className="font-semibold text-gray-900 mb-3">Saved Drafts</h2>
            <div className="flex flex-col gap-2">
              {recentDrafts.map(d => (
                <div
                  key={d.id}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 capitalize mb-0.5">{d.type}</p>
                      <p className="text-sm text-gray-700 font-medium line-clamp-1">{d.prompt}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{d.content}</p>
                    </div>
                    <span className="text-xs text-gray-300 flex-shrink-0">
                      {new Date(d.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
