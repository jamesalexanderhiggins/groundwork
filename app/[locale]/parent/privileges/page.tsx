import { redirect }      from 'next/navigation';
import Link              from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { CreatePrivilegeForm } from '@/components/parent/CreatePrivilegeForm';

export default async function ParentPrivilegesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: parentProfile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('user_id', user.id)
    .single();
  if (!parentProfile || !['parent', 'admin'].includes(parentProfile.role)) redirect('/dashboard');

  const { data: family } = await supabase
    .from('families')
    .select('large_coin_name, small_coin_name')
    .eq('id', parentProfile.family_id)
    .single();

  const { data: privileges } = await supabase
    .from('privileges')
    .select('*')
    .eq('family_id', parentProfile.family_id)
    .order('cost_large', { ascending: false });

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-[var(--color-primary)] hover:underline text-sm">← Back</Link>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Privilege Store</h1>
      </div>

      <section className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-6 shadow mb-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-4">Add a privilege</h2>
        <CreatePrivilegeForm
          familyId={parentProfile.family_id}
          largeName={family?.large_coin_name ?? 'Higg'}
          smallName={family?.small_coin_name ?? 'Ginsey'}
        />
      </section>

      <section>
        <h2 className="font-semibold text-[var(--color-text)] mb-3">Current privileges</h2>
        <div className="flex flex-col gap-2">
          {(privileges ?? []).map(p => (
            <div key={p.id} className={`bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-4 shadow-sm ${!p.active ? 'opacity-50' : ''}`}>
              <p className="font-medium text-[var(--color-text)]">{p.title}</p>
              <p className="text-sm opacity-60 text-[var(--color-text)]">
                {p.cost_large > 0 && `${p.cost_large} ${family?.large_coin_name} `}
                {p.cost_small > 0 && `${p.cost_small} ${family?.small_coin_name}`}
                {!p.active && ' · inactive'}
              </p>
            </div>
          ))}
          {(privileges ?? []).length === 0 && (
            <p className="text-sm opacity-50 text-[var(--color-text)]">No privileges yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
