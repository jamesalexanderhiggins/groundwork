import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { CreateChildForm } from '@/components/parent/CreateChildForm';
import { SKINS } from '@/lib/skins';
import { stageIcon, stageLabel, type LifeStage } from '@/lib/life-stage';

export const metadata = { title: 'Family members' };

const SKIN_EMOJI: Record<string, string> = {
  cloud_kingdom:  '☁️',
  rainbow_studio: '🌈',
  deep_ocean:     '🌊',
  jungle_quest:   '🌴',
  zen_garden:     '🌸',
  space_command:  '🚀',
  pixel_world:    '🎮',
  cyber_pulse:    '⚡',
  first_person:   '🎯',
  dark_knight:    '🌙',
};

const skinName = (key: string) =>
  SKINS.find(s => s.key === key)?.name ?? key.replace(/_/g, ' ');

export default async function ChildrenPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Resolve the parent from the signed-in user. Reading the active_profile
  // cookie meant that once a parent switched to a child this page bounced
  // straight back to the dashboard and could never be opened.
  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('user_id', user.id)
    .single();

  if (!parentProfile) redirect('/onboarding');
  if (!['parent', 'admin'].includes(parentProfile.role)) redirect('/dashboard');

  const { data: family } = await supabase
    .from('families')
    .select('large_coin_name, small_coin_name, golden_coin_name')
    .eq('id', parentProfile.family_id)
    .single();

  const { data: members } = await supabase
    .from('profiles')
    .select('id, display_name, life_stage, skin, role, virtue_level')
    .eq('family_id', parentProfile.family_id)
    .order('created_at', { ascending: true });

  const children = (members ?? []).filter(m => m.role === 'child');
  const adults   = (members ?? []).filter(m => m.role !== 'child');

  const { data: balances } = children.length
    ? await supabase
        .from('balance_accounts')
        .select('profile_id, large_balance, small_balance, golden_balance')
        .in('profile_id', children.map(c => c.id))
    : { data: [] };

  const balanceMap = Object.fromEntries((balances ?? []).map(b => [b.profile_id, b]));

  const largeName  = family?.large_coin_name  ?? 'Higg';
  const smallName  = family?.small_coin_name  ?? 'Ginsey';
  const goldenName = family?.golden_coin_name ?? 'Golden';

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-[var(--color-primary)] hover:underline text-sm"
            aria-label="Back to dashboard"
          >
            ←
          </Link>
          <h1 className="font-bold text-lg text-[var(--color-text)]">Family members</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-6">

        {children.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold opacity-50 text-[var(--color-text)] uppercase tracking-wide mb-3">
              Children &amp; teens ({children.length})
            </h2>
            <ul className="flex flex-col gap-3">
              {children.map(child => {
                const bal = balanceMap[child.id];
                return (
                  <li
                    key={child.id}
                    className="card p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-text)] truncate">
                        {child.display_name}
                      </p>
                      <p className="text-xs opacity-55 text-[var(--color-text)]">
                        {stageIcon(child.life_stage as LifeStage)}{' '}
                        {stageLabel(child.life_stage as LifeStage)}
                        {' · '}Level {child.virtue_level ?? 1}
                        {' · '}{skinName(child.skin)}
                      </p>
                      {bal && (
                        <p className="text-xs opacity-70 text-[var(--color-text)] mt-1">
                          {bal.large_balance} {largeName}
                          {' · '}{bal.small_balance} {smallName}
                          {' · '}{bal.golden_balance} {goldenName}
                        </p>
                      )}
                    </div>
                    <span className="text-2xl shrink-0" aria-hidden="true">
                      {SKIN_EMOJI[child.skin] ?? '☁️'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {adults.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold opacity-50 text-[var(--color-text)] uppercase tracking-wide mb-3">
              Adults ({adults.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {adults.map(a => (
                <li key={a.id} className="card p-4 flex items-center gap-3">
                  <span className="text-xl" aria-hidden="true">
                    {stageIcon(a.life_stage as LifeStage)}
                  </span>
                  <span className="font-medium text-[var(--color-text)]">{a.display_name}</span>
                  <span className="text-xs opacity-50 text-[var(--color-text)] capitalize">
                    {a.role.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold opacity-50 text-[var(--color-text)] uppercase tracking-wide mb-3">
            Add someone
          </h2>
          <div className="card p-5">
            <CreateChildForm />
          </div>
        </section>
      </div>
    </main>
  );
}
