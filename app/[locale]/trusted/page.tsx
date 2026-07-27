import { redirect }                   from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { GiftForm }                   from '@/components/trusted/GiftForm';

export default async function TrustedPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Find trusted_adult profile for this user
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, family_id, role')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.role !== 'trusted_adult') {
    redirect('/dashboard');
  }

  const { data: family } = await supabase
    .from('families')
    .select('golden_coin_name, large_coin_name')
    .eq('id', profile.family_id)
    .single();

  // Fetch children in the family
  const { data: children } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('family_id', profile.family_id)
    .in('role', ['child', 'teen']);

  // Recent gifts by this adult
  const { data: recentGifts } = await supabase
    .from('transactions')
    .select('golden_delta, description, created_at')
    .eq('reference_id', profile.id)
    .eq('type', 'gift_golden')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white shadow-sm px-6 py-5">
        <div className="max-w-lg mx-auto">
          <p className="text-sm text-gray-500">Trusted Adult Portal</p>
          <h1 className="font-bold text-xl text-gray-900">{profile.display_name}</h1>
        </div>
      </header>

      <div className="px-6 pt-6 max-w-lg mx-auto flex flex-col gap-8">
        {/* Gift form */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Send a Golden Gift</h2>
          <p className="text-sm text-gray-500 mb-4">
            Gift {family?.golden_coin_name ?? 'Golden Higgs'} to reward hard work or special moments.
          </p>
          {children && children.length > 0 ? (
            <GiftForm
              fromProfileId={profile.id}
              children={children}
              goldenName={family?.golden_coin_name ?? 'Golden Higg'}
            />
          ) : (
            <p className="text-sm text-gray-500">No children in this family yet.</p>
          )}
        </section>

        {/* Recent gifts */}
        {recentGifts && recentGifts.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Recent Gifts</h2>
            <ul className="flex flex-col gap-2">
              {recentGifts.map((g, i) => (
                <li key={i} className="text-sm text-gray-700 flex justify-between">
                  <span className="opacity-70">{new Date(g.created_at).toLocaleDateString()}</span>
                  <span className="font-medium">+{g.golden_delta} {family?.golden_coin_name ?? 'Golden Higg'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
