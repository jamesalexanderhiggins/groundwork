import { redirect }                   from 'next/navigation';
import Link                            from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { CashoutWindowForm }          from '@/components/parent/CashoutWindowForm';
import { InviteTrustedForm }          from '@/components/parent/InviteTrustedForm';

export default async function ParentCashoutPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id, role, id')
    .eq('user_id', user.id)
    .single();

  if (!profile || !['parent', 'admin'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const { data: windows } = await supabase
    .from('cashout_windows')
    .select('*')
    .eq('family_id', profile.family_id)
    .order('opens_at', { ascending: false })
    .limit(10);

  const now = new Date().toISOString();
  const activeWindow = (windows ?? []).find(w => w.opens_at <= now && w.closes_at >= now);

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white shadow-sm px-6 py-5">
        <div className="max-w-lg mx-auto">
          <Link href="/dashboard" className="text-indigo-600 text-sm mb-2 inline-block">← Dashboard</Link>
          <h1 className="font-bold text-xl text-gray-900">Cashout Settings</h1>
        </div>
      </header>

      <div className="px-6 pt-6 max-w-lg mx-auto flex flex-col gap-8">
        {/* Active window indicator */}
        <div className={`rounded-xl p-4 border ${activeWindow
          ? 'bg-green-50 border-green-200'
          : 'bg-gray-100 border-gray-200'
        }`}>
          {activeWindow ? (
            <>
              <p className="font-semibold text-green-800">Window open: {activeWindow.label}</p>
              <p className="text-sm text-green-700 mt-1">
                Closes {new Date(activeWindow.closes_at).toLocaleString()}
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-sm">No cashout window is currently open.</p>
          )}
        </div>

        {/* Create window form */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Create Cashout Window</h2>
          <CashoutWindowForm familyId={profile.family_id} />
        </section>

        {/* Invite trusted adult */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Invite a Trusted Adult</h2>
          <p className="text-sm text-gray-500 mb-4">
            Grandparents, aunts, uncles — they can gift Golden Higgs as recognition.
          </p>
          <InviteTrustedForm />
        </section>

        {/* Window history */}
        {windows && windows.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Window History</h2>
            <ul className="flex flex-col gap-2 text-sm text-gray-700">
              {windows.map(w => (
                <li key={w.id} className="flex justify-between">
                  <span>{w.label}</span>
                  <span className="text-gray-400">{new Date(w.opens_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
