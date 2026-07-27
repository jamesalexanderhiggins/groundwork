import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getLifeItems } from '@/app/actions/life-items';
import { getActiveNudge } from '@/app/actions/nudges';
import { getRecentDrafts } from '@/app/actions/drafts';
import { NaturalLanguageInput } from '@/components/kempt/NaturalLanguageInput';
import { LifeItemList } from '@/components/kempt/LifeItemList';
import { DraftEngine } from '@/components/kempt/DraftEngine';
import { NudgeCard } from '@/components/kempt/NudgeCard';
import { SeedTemplatesButton } from '@/components/kempt/SeedTemplatesButton';
import type { UserContext } from '@/lib/ai';
import { PreferenceProvider } from '@/components/shared/PreferenceProvider';

export const metadata = { title: 'Life admin' };

// Mirrors lib/ai.ts — when there is no API key the AI panels are hidden
// rather than shown as buttons that fail.
const AI_ENABLED = !!process.env.ANTHROPIC_API_KEY;

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

  // This is a server component rendered per request, so reading the clock
  // here is intentional — the purity rule targets client re-renders.
  /* eslint-disable react-hooks/purity */
  const renderedAt = new Date();
  /* eslint-enable react-hooks/purity */

  const hour = renderedAt.getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
                'Good evening';

  const now     = renderedAt.getTime();
  const dueSoon = items.filter(i => {
    if (!i.due_at) return false;
    return (new Date(i.due_at).getTime() - now) / 86400000 <= 7;
  }).length;

  return (
    <main className="min-h-screen bg-[var(--color-bg)] pb-16">
      <PreferenceProvider cognitiveMode={profile.cognitive_mode} />
      <a href="#main" className="skip-link">Skip to content</a>

      <header className="bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] px-6 py-5 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm opacity-50 text-[var(--color-text)]">{greeting}</p>
            <h1 className="font-bold text-xl text-[var(--color-text)] truncate">
              {profile.display_name}
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 text-sm text-[var(--color-primary)] hover:underline"
          >
            ← Family
          </Link>
        </div>
      </header>

      <div id="main" className="max-w-2xl mx-auto px-6 pt-6 flex flex-col gap-6">

        {nudge && <NudgeCard nudge={nudge} />}

        <section>
          <div className="flex items-baseline justify-between mb-3 gap-3">
            <h2 className="font-semibold text-[var(--color-text)]">Life admin</h2>
            <span className="text-xs opacity-50 text-[var(--color-text)]">
              {items.length === 0
                ? 'nothing pending'
                : `${items.length} open${dueSoon > 0 ? ` · ${dueSoon} due soon` : ''}`}
            </span>
          </div>

          <div className="mb-4">
            <NaturalLanguageInput
              profileId={profile.id}
              context={context}
              aiEnabled={AI_ENABLED}
            />
          </div>

          {items.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-3xl mb-3" aria-hidden="true">🗒️</p>
              <p className="font-medium text-[var(--color-text)]">Nothing on the list</p>
              <p className="text-sm opacity-55 text-[var(--color-text)] mt-1 mb-4">
                Add anything you have been putting off — or start from a set of
                common household jobs.
              </p>
              <SeedTemplatesButton profileId={profile.id} />
            </div>
          ) : (
            <LifeItemList items={items} profileId={profile.id} />
          )}
        </section>

        {AI_ENABLED && (
          <section className="card p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-1">Draft engine</h2>
            <p className="text-sm opacity-55 text-[var(--color-text)] mb-4">
              Describe what you need to write — an email, a letter, a hard
              message — and get a first draft you can edit.
            </p>
            <DraftEngine profileId={profile.id} context={context} />
          </section>
        )}

        {recentDrafts.length > 0 && (
          <section>
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Saved drafts</h2>
            <ul className="flex flex-col gap-2">
              {recentDrafts.map(d => (
                <li key={d.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {d.type && (
                        <p className="text-xs opacity-45 capitalize mb-0.5 text-[var(--color-text)]">
                          {d.type}
                        </p>
                      )}
                      <p className="text-sm font-medium text-[var(--color-text)] line-clamp-1">
                        {d.prompt}
                      </p>
                      <p className="text-xs opacity-55 mt-1 line-clamp-2 text-[var(--color-text)]">
                        {d.content}
                      </p>
                    </div>
                    <span className="text-xs opacity-35 shrink-0 text-[var(--color-text)]">
                      {new Date(d.created_at).toLocaleDateString(undefined, {
                        day: 'numeric', month: 'short',
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
