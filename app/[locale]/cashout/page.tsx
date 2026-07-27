import { redirect }                    from 'next/navigation';
import { createServerSupabaseClient }  from '@/lib/supabase-server';
import { getActiveProfile }            from '@/app/actions/profile';
import { getActiveCashoutWindow }      from '@/app/actions/cashout';
import { BottomNav }                   from '@/components/higgy/BottomNav';
import { CurrencyDisplay }             from '@/components/higgy/CurrencyDisplay';
import { CashoutRequestForm }          from '@/components/higgy/CashoutRequestForm';

export default async function CashoutPage() {
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
    .select('*')
    .eq('id', profile.family_id)
    .single();

  const { data: balance } = await supabase
    .from('balance_accounts')
    .select('large_balance, golden_balance')
    .eq('profile_id', activeProfileId)
    .single();

  const window = await getActiveCashoutWindow(profile.family_id);

  const skinClass = `skin-${profile.skin ?? 'cloud_kingdom'}`;

  return (
    <div className={skinClass}>
      <main className="min-h-screen bg-[var(--color-bg)] pb-24">
        <header className="bg-[var(--color-bg-card)] shadow-sm px-6 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto">
            <h1 className="font-bold text-[var(--color-text)] text-lg">Cash Out</h1>
            {balance && family && (
              <div className="mt-2">
                <CurrencyDisplay
                  large={balance.large_balance}
                  small={0}
                  golden={balance.golden_balance}
                  largeName={family.large_coin_name}
                  smallName={family.small_coin_name}
                  goldenName={family.golden_coin_name}
                />
              </div>
            )}
          </div>
        </header>

        <div className="px-6 pt-6 max-w-lg mx-auto">
          {!window ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">🔒</p>
              <h2 className="font-bold text-xl text-[var(--color-text)] mb-2">No cashout window open</h2>
              <p className="text-[var(--color-text)] opacity-60 text-sm">
                Ask your parent to open a cashout window when it&apos;s time to redeem your coins.
              </p>
            </div>
          ) : (
            <CashoutRequestForm
              profileId={activeProfileId}
              largeBalance={balance?.large_balance ?? 0}
              goldenBalance={balance?.golden_balance ?? 0}
              largeName={family?.large_coin_name ?? 'Higg'}
              goldenName={family?.golden_coin_name ?? 'Golden Higg'}
              largeCashValue={family?.large_cash_value ?? 2}
              goldenCashValue={family?.golden_cash_value ?? 5}
              maxPercent={window.max_percent}
            />
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
