import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { PendingApprovals } from '@/components/parent/PendingApprovals';

export const metadata = { title: 'Approvals' };

export default async function ApprovalsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id, role, id')
    .eq('user_id', user.id)
    .single();

  if (!profile) redirect('/onboarding');
  if (!['parent', 'admin'].includes(profile.role)) redirect('/dashboard');

  const { data: familyProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('family_id', profile.family_id);

  const familyProfileIds = (familyProfiles ?? []).map(p => p.id);

  // Filter in the query rather than in JS, and select `notes` — the column
  // is not called `note`, and asking for it failed the whole request.
  const { data: completions } = familyProfileIds.length
    ? await supabase
        .from('task_completions')
        .select(`
          id, profile_id, reward_large, reward_small, reward_golden,
          notes, completed_at,
          profiles!inner ( display_name ),
          tasks!inner    ( title, requires_approval )
        `)
        .is('approved_at', null)
        .eq('tasks.requires_approval', true)
        .in('profile_id', familyProfileIds)
        .order('completed_at', { ascending: true })
    : { data: [] };

  type RawCompletion = {
    id: string; profile_id: string;
    reward_large: number; reward_small: number; reward_golden: number;
    notes?: string | null; completed_at: string;
    profiles: { display_name: string }[] | { display_name: string } | null;
    tasks:    { title: string; requires_approval: boolean }[] | { title: string; requires_approval: boolean } | null;
  };

  const pending = (completions ?? []) as unknown as RawCompletion[];

  return (
    <main className="min-h-screen bg-[var(--color-bg)] pb-12">
      <header className="bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] px-6 py-5">
        <div className="max-w-lg mx-auto">
          <Link href="/dashboard" className="text-[var(--color-primary)] text-sm mb-1 inline-block hover:underline">
            ← Dashboard
          </Link>
          <div className="flex justify-between items-center gap-3">
            <h1 className="font-bold text-xl text-[var(--color-text)]">Pending approvals</h1>
            {pending.length > 0 && (
              <span className="bg-[var(--color-danger)] text-white text-xs font-bold rounded-full min-w-[24px] h-6 px-2 flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </div>
          <p className="text-sm opacity-55 text-[var(--color-text)] mt-1">
            Coins are only credited once you approve.
          </p>
        </div>
      </header>

      <div className="px-6 pt-6 max-w-lg mx-auto">
        <PendingApprovals
          completions={pending as Parameters<typeof PendingApprovals>[0]['completions']}
          parentProfileId={profile.id}
        />
      </div>
    </main>
  );
}
