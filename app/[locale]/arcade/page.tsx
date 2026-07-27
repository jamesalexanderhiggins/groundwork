import { redirect }             from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getCurrentProfile }   from '@/lib/current-profile';
import { ScreenTimeSelector }  from '@/components/higgy/ScreenTimeSelector';
import { BottomNav }           from '@/components/higgy/BottomNav';
import { CurrencyDisplay }     from '@/components/higgy/CurrencyDisplay';
import { ArcadeTabs }          from '@/components/higgy/ArcadeTabs';
import type { FamilyRates }    from '@/lib/economy';
import { PreferenceProvider } from '@/components/shared/PreferenceProvider';

const DAY_CAP_KEYS = [
  'cap_sunday', 'cap_monday', 'cap_tuesday', 'cap_wednesday',
  'cap_thursday', 'cap_friday', 'cap_saturday',
] as const;

export default async function ArcadePage() {
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
    .select('large_balance, small_balance, golden_balance')
    .eq('profile_id', activeProfileId)
    .single();

  // Today's screen time usage
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todaySessions } = await supabase
    .from('screen_time_sessions')
    .select('planned_minutes')
    .eq('profile_id', activeProfileId)
    .gte('started_at', todayStart.toISOString());

  const minutesUsed = (todaySessions ?? []).reduce((sum, s) => sum + s.planned_minutes, 0);
  const dayCapKey   = DAY_CAP_KEYS[new Date().getDay()];
  const todayCap    = family ? (family[dayCapKey] as number) : 0;

  const { data: privileges } = await supabase
    .from('privileges')
    .select('*')
    .eq('family_id', profile.family_id)
    .eq('active', true);

  const familyRates: FamilyRates = family ? {
    smallPerLarge:   family.small_per_large,
    largeCashValue:  family.large_cash_value,
    goldenCashValue: family.golden_cash_value,
    largeMinutes:    family.large_minutes,
    smallMinutes:    family.small_minutes,
    goldenMinutes:   family.golden_minutes,
  } : { smallPerLarge: 6, largeCashValue: 2, goldenCashValue: 5, largeMinutes: 30, smallMinutes: 5, goldenMinutes: 60 };

  const skinClass = `skin-${profile.skin ?? 'cloud_kingdom'}`;

  return (
    <div className={skinClass}>
      <PreferenceProvider cognitiveMode={profile.cognitive_mode} />
      <main className="min-h-screen bg-[var(--color-bg)] pb-24">
        <header className="bg-[var(--color-bg-card)] shadow-sm px-6 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto">
            <h1 className="font-bold text-[var(--color-text)] text-lg">Higgs Arcade</h1>
            {balance && family && (
              <div className="mt-2">
                <CurrencyDisplay
                  large={balance.large_balance}
                  small={balance.small_balance}
                  golden={balance.golden_balance}
                  largeName={family.large_coin_name}
                  smallName={family.small_coin_name}
                  goldenName={family.golden_coin_name}
                />
              </div>
            )}
          </div>
        </header>

        <div className="px-6 pt-4 max-w-lg mx-auto">
          <ArcadeTabs
            profileId={activeProfileId}
            familyRates={familyRates}
            largeName={family?.large_coin_name ?? 'Higg'}
            smallName={family?.small_coin_name ?? 'Ginsey'}
            todayCap={todayCap}
            minutesUsed={minutesUsed}
            privileges={privileges ?? []}
          />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
