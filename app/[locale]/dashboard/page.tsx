import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getActiveProfile } from '@/app/actions/profile';
import { ProfileSwitcher } from '@/components/higgy/ProfileSwitcher';
import { CreateChildForm } from '@/components/parent/CreateChildForm';
import { CurrencyDisplay } from '@/components/higgy/CurrencyDisplay';
import { stageIcon, type LifeStage } from '@/lib/life-stage';

export const metadata = { title: 'Home' };

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, family_id, role, life_stage')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  const isParent = ['parent', 'admin'].includes(profile.role);

  const [{ data: family }, { data: profiles }] = await Promise.all([
    supabase.from('families')
      .select('name, bank_name, large_coin_name, small_coin_name, golden_coin_name')
      .eq('id', profile.family_id).single(),
    supabase.from('profiles')
      .select('id, display_name, role, skin, life_stage')
      .eq('family_id', profile.family_id)
      .order('created_at', { ascending: true }),
  ]);

  const activeProfileId = await getActiveProfile();
  // Fall back to the signed-in adult's own profile so the balance card
  // is never blank on first load.
  const shownProfileId  = activeProfileId ?? profile.id;
  const shownProfile    = (profiles ?? []).find(p => p.id === shownProfileId);

  const [{ data: balance }, { data: streak }] = await Promise.all([
    supabase.from('balance_accounts')
      .select('large_balance, small_balance, golden_balance')
      .eq('profile_id', shownProfileId).maybeSingle(),
    supabase.from('streaks')
      .select('current_streak')
      .eq('profile_id', shownProfileId).maybeSingle(),
  ]);

  const children = (profiles ?? []).filter(p => p.role === 'child');

  // Count completions still awaiting a parent's approval
  let pendingApprovals = 0;
  if (isParent) {
    const { count } = await supabase
      .from('task_completions')
      .select('id, tasks!inner(requires_approval)', { count: 'exact', head: true })
      .is('approved_at', null)
      .eq('tasks.requires_approval', true)
      .in('profile_id', (profiles ?? []).map(p => p.id));
    pendingApprovals = count ?? 0;
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <a href="#main" className="skip-link">Skip to content</a>

      <header className="bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)]">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--color-primary)] truncate">
              {family?.bank_name || 'Higgy Bank'}
            </h1>
            <p className="text-sm opacity-60 text-[var(--color-text)] truncate">
              {family?.name} · Hi, {profile.display_name}
            </p>
          </div>
          <Link
            href="/auth/signout"
            prefetch={false}
            className="shrink-0 text-xs opacity-50 hover:opacity-100 text-[var(--color-text)] underline underline-offset-2"
          >
            Sign out
          </Link>
        </div>
      </header>

      <div id="main" className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-6">

        {/* Balance for whoever is currently selected */}
        {balance && family && (
          <section className="card p-5 animate-fade-up">
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="font-semibold text-[var(--color-text)] truncate">
                {shownProfile?.display_name ?? profile.display_name}
                <span className="opacity-60 font-normal">&apos;s balance</span>
              </h2>
              {streak?.current_streak ? (
                <span className="shrink-0 text-sm font-medium text-[var(--color-reward)]">
                  🔥 {streak.current_streak} day{streak.current_streak === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>

            <CurrencyDisplay
              large={balance.large_balance}
              small={balance.small_balance}
              golden={balance.golden_balance}
              largeName={family.large_coin_name}
              smallName={family.small_coin_name}
              goldenName={family.golden_coin_name}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/tasks"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity min-h-[44px]"
              >
                Today&apos;s tasks →
              </Link>
              <Link
                href="/arcade"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius)] border border-[var(--color-accent)] text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/10 transition-colors min-h-[44px]"
              >
                🕹️ Arcade
              </Link>
              <Link
                href="/quests"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius)] border border-[var(--color-accent)] text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-accent)]/10 transition-colors min-h-[44px]"
              >
                ⚔️ Quests
              </Link>
            </div>
          </section>
        )}

        {/* Who is using the app right now */}
        {children.length > 0 && (
          <section className="card p-5">
            <ProfileSwitcher
              profiles={profiles ?? []}
              activeProfileId={activeProfileId}
            />
          </section>
        )}

        {/* First-run: add someone to the family */}
        {isParent && children.length === 0 && (
          <section className="card p-6 animate-fade-up">
            <h2 className="font-semibold text-[var(--color-text)] text-lg">
              Add your first family member
            </h2>
            <p className="text-sm opacity-60 text-[var(--color-text)] mt-1 mb-5">
              Give them a name and an age group. You can add more later, and
              change anything from Settings.
            </p>
            <CreateChildForm />
          </section>
        )}

        {isParent && children.length > 0 && (
          <details className="card p-4 group">
            <summary className="cursor-pointer font-medium text-[var(--color-text)] list-none flex items-center gap-2 min-h-[44px]">
              <span className="text-[var(--color-primary)] transition-transform group-open:rotate-45">＋</span>
              Add another family member
            </summary>
            <div className="mt-4 pt-4 border-t border-[var(--color-accent)]/20">
              <CreateChildForm />
            </div>
          </details>
        )}

        {/* Kempt — the grown-up side */}
        <section className="card p-5">
          <h2 className="font-semibold text-[var(--color-text)] mb-3">Kempt</h2>
          <Link
            href="/life"
            className="flex items-center gap-3 px-4 py-3 rounded-[var(--border-radius)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 transition-colors min-h-[44px]"
          >
            <span className="text-2xl" aria-hidden="true">📋</span>
            <div className="min-w-0">
              <p className="font-medium text-[var(--color-text)]">Life admin &amp; drafts</p>
              <p className="text-xs text-[var(--color-text)] opacity-55">
                Everything you keep meaning to get to
              </p>
            </div>
          </Link>
        </section>

        {/* Parent tools */}
        {isParent && (
          <section className="card p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Parent tools</h2>
            <nav className="grid sm:grid-cols-2 gap-1">
              <ToolLink href="/parent/quests"     icon="⚔️" label="Manage quests" />
              <ToolLink href="/parent/privileges" icon="🏪" label="Privilege store" />
              <ToolLink href="/parent/cashout"    icon="💰" label="Cashout windows" />
              <ToolLink
                href="/parent/approvals"
                icon="✅"
                label="Approvals"
                badge={pendingApprovals}
              />
              <ToolLink href="/trusted"  icon="🤝" label="Trusted adults" />
              <ToolLink href="/settings" icon="⚙️" label="Settings" />
            </nav>
          </section>
        )}

        {/* Family roster */}
        {(profiles?.length ?? 0) > 1 && (
          <section className="card p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Your family</h2>
            <ul className="flex flex-col gap-2">
              {(profiles ?? []).map(p => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="text-lg" aria-hidden="true">
                    {stageIcon(p.life_stage as LifeStage)}
                  </span>
                  <span className="font-medium text-[var(--color-text)]">{p.display_name}</span>
                  <span className="opacity-50 text-[var(--color-text)] capitalize text-xs">
                    {p.role.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function ToolLink({
  href, icon, label, badge = 0,
}: { href: string; icon: string; label: string; badge?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 transition-colors min-h-[44px]"
    >
      <span aria-hidden="true">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="bg-[var(--color-danger)] text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
          {badge}
        </span>
      )}
    </Link>
  );
}
