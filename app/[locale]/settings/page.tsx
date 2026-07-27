import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { CognitiveModeSelector } from '@/components/settings/CognitiveModeSelector';
import { LocalePicker } from '@/components/settings/LocalePicker';
import type { CognitiveMode } from '@/app/actions/settings';

export const metadata = { title: 'Settings' };

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

  // The column is `name` — selecting `family_name` silently returned null
  // and left the header blank.
  const { data: family } = await supabase
    .from('families')
    .select('name')
    .eq('id', profile.family_id)
    .single();

  const isParent = ['parent', 'admin'].includes(profile.role);

  return (
    <main className="min-h-screen bg-[var(--color-bg)] pb-16">
      <header className="bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] px-6 py-5 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <Link
            href="/dashboard"
            className="text-[var(--color-primary)] text-sm mb-1 inline-block hover:underline"
          >
            ← Dashboard
          </Link>
          <h1 className="font-bold text-xl text-[var(--color-text)]">Settings</h1>
          <p className="text-sm opacity-55 text-[var(--color-text)]">
            {profile.display_name}{family?.name ? ` · ${family.name}` : ''}
          </p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 pt-6 flex flex-col gap-6">

        <section className="card p-5">
          <h2 className="font-semibold text-[var(--color-text)] mb-1">Cognitive mode</h2>
          <p className="text-sm opacity-55 text-[var(--color-text)] mb-4">
            Changes how Kempt words things. Nothing is locked away — pick
            whatever feels easiest to read.
          </p>
          <CognitiveModeSelector
            profileId={profile.id}
            currentMode={(profile.cognitive_mode ?? 'standard') as CognitiveMode}
          />
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-[var(--color-text)] mb-1">Language</h2>
          <p className="text-sm opacity-55 text-[var(--color-text)] mb-4">
            Switching here also saves your choice for AI replies and emails.
          </p>
          <LocalePicker profileId={profile.id} current={locale} />
        </section>

        {isParent && (
          <section className="card p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Family</h2>
            <nav className="flex flex-col gap-1">
              <SettingsLink href="/parent/children"    icon="👨‍👩‍👧" label="Family members" />
              <SettingsLink href="/parent/quests"      icon="⚔️"  label="Quests" />
              <SettingsLink href="/parent/privileges"  icon="🏪"  label="Privilege store" />
              <SettingsLink href="/parent/cashout"     icon="💰"  label="Cashout windows" />
              <SettingsLink href="/trusted"            icon="🤝"  label="Trusted adults" />
              <SettingsLink href="/billing"            icon="💳"  label="Subscription" />
            </nav>
          </section>
        )}

        <section className="card p-5">
          <h2 className="font-semibold text-[var(--color-text)] mb-3">Account</h2>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm text-[var(--color-danger)] hover:underline font-medium min-h-[44px]"
            >
              Sign out
            </button>
          </form>
          <p className="text-xs opacity-45 text-[var(--color-text)] mt-4">
            <Link href="/privacy" className="hover:underline">Privacy policy</Link>
            {' · '}
            <span>Kempt v0.1</span>
          </p>
        </section>
      </div>
    </main>
  );
}

function SettingsLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 transition-colors min-h-[44px]"
    >
      <span aria-hidden="true">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="opacity-40" aria-hidden="true">›</span>
    </Link>
  );
}
