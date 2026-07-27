import { redirect }                   from 'next/navigation';
import Link                            from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { CognitiveModeSelector }      from '@/components/settings/CognitiveModeSelector';
import type { CognitiveMode }         from '@/app/actions/settings';

const LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
];

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  const supabase   = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, cognitive_mode, locale, role, family_id')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  const { data: family } = await supabase
    .from('families')
    .select('family_name')
    .eq('id', profile.family_id)
    .single();

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-white shadow-sm px-6 py-5 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <a href="/dashboard" className="text-indigo-600 text-sm mb-2 inline-block">← Dashboard</a>
          <h1 className="font-bold text-xl text-gray-900">Settings</h1>
          <p className="text-sm text-gray-400">{profile.display_name} · {family?.family_name}</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 pt-6 flex flex-col gap-8">

        {/* Cognitive mode */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Cognitive mode</h2>
          <p className="text-sm text-gray-400 mb-4">
            Adjusts how Kempt and AI features communicate with you.
            You can change this anytime.
          </p>
          <CognitiveModeSelector
            profileId={profile.id}
            currentMode={(profile.cognitive_mode ?? 'standard') as CognitiveMode}
          />
        </section>

        {/* Language */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Language</h2>
          <p className="text-sm text-gray-400 mb-4">
            Kempt automatically detected your language. Switch it here any time.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {LOCALES.map(l => (
              <Link
                key={l.code}
                href={`/${l.code}/settings`}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium border-2 transition-colors ${
                  locale === l.code
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {locale === l.code && <span>✓</span>}
                {l.name}
              </Link>
            ))}
          </div>
        </section>

        {/* Billing */}
        {['parent', 'admin'].includes(profile.role) && (
          <section className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Subscription</h2>
            <Link
              href="/billing"
              className="inline-flex items-center gap-2 text-sm text-indigo-600 font-medium hover:underline"
            >
              Manage billing & subscription →
            </Link>
          </section>
        )}

        {/* Sign out */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Account</h2>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              Sign out
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-4">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            {' · '}
            <span>Kempt v0.1</span>
          </p>
        </section>
      </div>
    </main>
  );
}
