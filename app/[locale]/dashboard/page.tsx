import { redirect }         from 'next/navigation';
import Link                  from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getActiveProfile }  from '@/app/actions/profile';
import { ProfileSwitcher }   from '@/components/higgy/ProfileSwitcher';
import { CreateChildForm }   from '@/components/parent/CreateChildForm';
import { CurrencyDisplay }   from '@/components/higgy/CurrencyDisplay';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('id, display_name, family_id, role')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile) redirect('/onboarding');

  const { data: family } = await supabase
    .from('families')
    .select('name, bank_name, large_coin_name, small_coin_name, golden_coin_name')
    .eq('id', parentProfile.family_id)
    .single();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, role, skin')
    .eq('family_id', parentProfile.family_id);

  const activeProfileId = await getActiveProfile();

  const { data: activeBalance } = activeProfileId ? await supabase
    .from('balance_accounts')
    .select('large_balance, small_balance, golden_balance')
    .eq('profile_id', activeProfileId)
    .single() : { data: null };

  const { data: streak } = activeProfileId ? await supabase
    .from('streaks')
    .select('current_streak')
    .eq('profile_id', activeProfileId)
    .single() : { data: null };

  const children = (profiles ?? []).filter(p => p.role === 'child');

  // Pending approvals count
  let pendingApprovalsCount = 0;
  if (['parent', 'admin'].includes(parentProfile.role)) {
    const familyProfileIds = (profiles ?? []).map(p => p.id);
    const { data: completions } = await supabase
      .from('task_completions')
      .select('id, profile_id, tasks!inner(requires_approval)')
      .is('approved_at', null)
      .in('profile_id', familyProfileIds);
    pendingApprovalsCount = (completions ?? []).filter(c => {
      // Supabase inner join returns array; take first item
      const tasksArr = c.tasks as unknown as { requires_approval: boolean }[];
      const t = Array.isArray(tasksArr) ? tasksArr[0] : (tasksArr as unknown as { requires_approval: boolean });
      return t?.requires_approval ?? false;
    }).length;
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-6 max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">
          {family?.bank_name ?? 'Higgy Bank'}
        </h1>
        <p className="text-sm opacity-60 text-[var(--color-text)]">
          {family?.name} · Hi, {parentProfile.display_name}
        </p>
      </header>

      {activeBalance && family && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[var(--color-text)]">
              {profiles?.find(p => p.id === activeProfileId)?.display_name}&apos;s balance
            </h2>
            {streak?.current_streak ? (
              <span className="text-sm font-medium text-[var(--color-accent)]">
                🔥 {streak.current_streak} day streak
              </span>
            ) : null}
          </div>
          <CurrencyDisplay
            large={activeBalance.large_balance}
            small={activeBalance.small_balance}
            golden={activeBalance.golden_balance}
            largeName={family.large_coin_name}
            smallName={family.small_coin_name}
            goldenName={family.golden_coin_name}
          />
          <Link
            href="/tasks"
            className="mt-4 inline-flex items-center gap-2 font-semibold text-[var(--color-primary)] hover:underline"
          >
            Go to today&apos;s tasks →
          </Link>
        </section>
      )}

      <section className="mb-8">
        <ProfileSwitcher
          profiles={profiles ?? []}
          activeProfileId={activeProfileId}
        />
      </section>

      {children.length === 0 && (
        <section className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-6 shadow">
          <h2 className="font-semibold text-[var(--color-text)] mb-4">Add your first child</h2>
          <CreateChildForm />
        </section>
      )}

      {children.length > 0 && (
        <details className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-4 shadow mb-6">
          <summary className="cursor-pointer font-medium text-[var(--color-text)]">
            + Add another child
          </summary>
          <div className="mt-4">
            <CreateChildForm />
          </div>
        </details>
      )}

      <section className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-4 shadow mb-4">
        <h2 className="font-semibold text-[var(--color-text)] mb-3">Kempt</h2>
        <Link
          href="/life"
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 transition-colors"
        >
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-medium text-[var(--color-text)]">Life Admin &amp; Drafts</p>
            <p className="text-xs text-[var(--color-text)] opacity-50">AI-powered personal life OS</p>
          </div>
        </Link>
      </section>

      <section className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-4 shadow">
        <h2 className="font-semibold text-[var(--color-text)] mb-3">Parent tools</h2>
        <div className="flex flex-col gap-2">
          <Link href="/parent/quests" className="text-sm text-[var(--color-primary)] hover:underline">⚔️ Manage quests</Link>
          <Link href="/parent/privileges" className="text-sm text-[var(--color-primary)] hover:underline">🏪 Privilege store</Link>
          <Link href="/parent/cashout" className="text-sm text-[var(--color-primary)] hover:underline">💰 Cashout &amp; trusted adults</Link>
          <Link href="/parent/approvals" className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-2">
            ✅ Service act approvals
            {pendingApprovalsCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {pendingApprovalsCount}
              </span>
            )}
          </Link>
          <Link href="/billing" className="text-sm text-[var(--color-primary)] hover:underline">💳 Billing</Link>
          <Link href="/settings" className="text-sm text-[var(--color-primary)] hover:underline">⚙️ Settings</Link>
        </div>
      </section>
    </main>
  );
}
