import { redirect }                    from 'next/navigation';
import { createServerSupabaseClient }  from '@/lib/supabase-server';
import { getCurrentProfile }           from '@/lib/current-profile';
import { getActiveCashoutWindow }      from '@/app/actions/cashout';
import { BottomNav }                   from '@/components/higgy/BottomNav';
import { CurrencyDisplay }             from '@/components/higgy/CurrencyDisplay';
import { CashoutRequestForm }          from '@/components/higgy/CashoutRequestForm';
import { GiftWindowForm }              from '@/components/higgy/GiftWindowForm';
import { PreferenceProvider }          from '@/components/shared/PreferenceProvider';

export default async function CashoutPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await getCurrentProfile();
  if (!profile) redirect('/onboarding');
  const activeProfileId = profile.id;

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
      <PreferenceProvider cognitiveMode={profile.cognitive_mode} />
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
            <div className="flex flex-col gap-8">
              <section>
                {window.label && (
                  <p className="text-sm opacity-60 text-[var(--color-text)] mb-3">
                    {window.label} · closes{' '}
                    {new Date(window.closes_at).toLocaleDateString(undefined, {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  </p>
                )}
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
              </section>

              {/* Gift Window — only appears when the parent has opened one.
                  Stored in the schema since day one but never surfaced. */}
              {window.is_gift_window && (
                <section className="card p-5 border-2 border-[var(--color-reward)]/40">
                  <h2 className="font-semibold text-[var(--color-text)] mb-1">
                    🎁 Gift window is open
                  </h2>
                  <p className="text-sm opacity-55 text-[var(--color-text)] mb-4">
                    Want to buy something for someone else? You can put a bit of
                    your own money towards it.
                  </p>
                  <GiftWindowForm
                    profileId={activeProfileId}
                    largeBalance={balance?.large_balance ?? 0}
                    goldenBalance={balance?.golden_balance ?? 0}
                    largeName={family?.large_coin_name ?? 'Higg'}
                    goldenName={family?.golden_coin_name ?? 'Golden Higg'}
                    largeCashValue={family?.large_cash_value ?? 2}
                    goldenCashValue={family?.golden_cash_value ?? 5}
                    giftMaxPercent={window.gift_max_percent ?? 10}
                  />
                </section>
              )}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
