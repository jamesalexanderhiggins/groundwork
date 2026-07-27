import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { GiftForm } from '@/components/trusted/GiftForm';
import { InviteTrustedForm } from '@/components/parent/InviteTrustedForm';

export const metadata = { title: 'Trusted adults' };

export default async function TrustedPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, family_id, role')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  // Parents were previously bounced back to the dashboard even though the
  // dashboard links them here — and giftGoldenHigg already allows them.
  const canGift   = ['trusted_adult', 'parent', 'admin'].includes(profile.role);
  const canInvite = ['parent', 'admin'].includes(profile.role);
  if (!canGift) redirect('/dashboard');

  const { data: family } = await supabase
    .from('families')
    .select('name, golden_coin_name, large_coin_name')
    .eq('id', profile.family_id)
    .single();

  // 'teen' is a life_stage, not a role — filtering roles by it matched nothing.
  const { data: children } = await supabase
    .from('profiles')
    .select('id, display_name, life_stage, virtue_level')
    .eq('family_id', profile.family_id)
    .eq('role', 'child')
    .order('display_name');

  // The whitepaper grants Trusted Adults visibility of balances and recent
  // activity. The page previously showed neither.
  const childIds = (children ?? []).map(c => c.id);

  const { data: balances } = childIds.length
    ? await supabase
        .from('balance_accounts')
        .select('profile_id, large_balance, small_balance, golden_balance')
        .in('profile_id', childIds)
    : { data: [] };

  const { data: streaks } = childIds.length
    ? await supabase
        .from('streaks')
        .select('profile_id, current_streak')
        .in('profile_id', childIds)
    : { data: [] };

  const balanceBy = Object.fromEntries((balances ?? []).map(b => [b.profile_id, b]));
  const streakBy  = Object.fromEntries((streaks  ?? []).map(s => [s.profile_id, s.current_streak]));

  const { data: recentGifts } = await supabase
    .from('transactions')
    .select('golden_delta, description, created_at')
    .eq('reference_id', profile.id)
    .eq('type', 'gift_golden')
    .order('created_at', { ascending: false })
    .limit(10);

  const goldenName = family?.golden_coin_name ?? 'Golden Higg';

  return (
    <main className="min-h-screen bg-[var(--color-bg)] pb-12">
      <header className="bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] px-6 py-5">
        <div className="max-w-lg mx-auto">
          <Link href="/dashboard" className="text-[var(--color-primary)] text-sm mb-1 inline-block hover:underline">
            ← Dashboard
          </Link>
          <h1 className="font-bold text-xl text-[var(--color-text)]">Trusted adults</h1>
          <p className="text-sm opacity-55 text-[var(--color-text)]">
            {profile.display_name}{family?.name ? ` · ${family.name}` : ''}
          </p>
        </div>
      </header>

      <div className="px-6 pt-6 max-w-lg mx-auto flex flex-col gap-6">

        {children && children.length > 0 && (
          <section className="card p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">How they&apos;re doing</h2>
            <ul className="flex flex-col gap-3">
              {children.map(c => {
                const bal = balanceBy[c.id];
                const streak = streakBy[c.id] ?? 0;
                return (
                  <li key={c.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--color-text)] truncate">
                        {c.display_name}
                      </p>
                      <p className="text-xs opacity-55 text-[var(--color-text)]">
                        Level {c.virtue_level ?? 1}
                        {streak > 0 && ` · 🔥 ${streak} day streak`}
                      </p>
                    </div>
                    {bal && (
                      <p className="text-xs text-right shrink-0 text-[var(--color-text)] opacity-70">
                        {bal.large_balance} {family?.large_coin_name ?? 'Higg'}
                        <br />
                        {bal.golden_balance} {goldenName}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="card p-5">
          <h2 className="font-semibold text-[var(--color-text)] mb-1">Send a golden gift</h2>
          <p className="text-sm opacity-55 text-[var(--color-text)] mb-4">
            A {goldenName} is backed by your own money, not the family pot.
            Use it to mark something that deserves noticing.
          </p>

          {children && children.length > 0 ? (
            <GiftForm
              fromProfileId={profile.id}
              recipients={children}
              goldenName={goldenName}
            />
          ) : (
            <p className="text-sm opacity-55 text-[var(--color-text)]">
              No children in this family yet.
            </p>
          )}
        </section>

        {canInvite && (
          <section className="card p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-1">Invite a trusted adult</h2>
            <p className="text-sm opacity-55 text-[var(--color-text)] mb-4">
              Grandparents, godparents or close friends. They can send gifts
              but cannot change tasks or settings.
            </p>
            <InviteTrustedForm />
          </section>
        )}

        {recentGifts && recentGifts.length > 0 && (
          <section className="card p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Your recent gifts</h2>
            <ul className="flex flex-col gap-2">
              {recentGifts.map((g, i) => (
                <li
                  key={i}
                  className="text-sm text-[var(--color-text)] flex justify-between gap-3 py-1"
                >
                  <span className="opacity-55 shrink-0">
                    {new Date(g.created_at).toLocaleDateString(undefined, {
                      day: 'numeric', month: 'short',
                    })}
                  </span>
                  <span className="font-medium text-[var(--color-reward)]">
                    +{g.golden_delta} {goldenName}
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
