import { redirect }       from 'next/navigation';
import Link               from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getActiveProfile } from '@/app/actions/profile';
import { CreateChildForm } from '@/components/parent/CreateChildForm';

export default async function ChildrenPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const activeProfileId = await getActiveProfile();
  if (!activeProfileId) redirect('/dashboard');

  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('id', activeProfileId)
    .single();

  if (!parentProfile || !['parent', 'admin'].includes(parentProfile.role)) {
    redirect('/dashboard');
  }

  const { data: children } = await supabase
    .from('profiles')
    .select('id, display_name, life_stage, skin, virtue_level, virtue_points')
    .eq('family_id', parentProfile.family_id)
    .eq('role', 'child')
    .order('display_name');

  const { data: balances } = await supabase
    .from('balance_accounts')
    .select('profile_id, large_balance, small_balance, golden_balance')
    .in('profile_id', (children ?? []).map(c => c.id));

  const balanceMap = Object.fromEntries((balances ?? []).map(b => [b.profile_id, b]));

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">←</Link>
          <h1 className="font-bold text-lg">Manage Children</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {/* Existing children */}
        {(children ?? []).length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Children ({children!.length})
            </h2>
            <div className="space-y-3">
              {children!.map(child => {
                const bal = balanceMap[child.id];
                return (
                  <div key={child.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{child.display_name}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        {child.life_stage} · Level {child.virtue_level} · Skin: {child.skin.replace('_', ' ')}
                      </p>
                      {bal && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {bal.large_balance} Higg · {bal.small_balance} Ginsey · {bal.golden_balance} Golden
                        </p>
                      )}
                    </div>
                    <div className="text-2xl">
                      {child.skin === 'cloud_kingdom' ? '☁️' :
                       child.skin === 'rainbow_studio' ? '🌈' :
                       child.skin === 'deep_ocean' ? '🌊' :
                       child.skin === 'jungle_quest' ? '🌴' :
                       child.skin === 'zen_garden' ? '🌸' :
                       child.skin === 'space_command' ? '🚀' :
                       child.skin === 'pixel_world' ? '🎮' :
                       child.skin === 'cyber_pulse' ? '⚡' :
                       child.skin === 'first_person' ? '🎯' : '🌙'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Add child */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Add a Child
          </h2>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <CreateChildForm />
          </div>
        </section>
      </div>
    </main>
  );
}
