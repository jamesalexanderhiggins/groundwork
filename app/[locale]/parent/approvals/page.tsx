import { redirect }                   from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { PendingApprovals }           from '@/components/parent/PendingApprovals';

export default async function ApprovalsPage() {
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

  // Fetch completions that require approval: tasks with requires_approval=true that haven't been approved yet
  const { data: completions } = await supabase
    .from('task_completions')
    .select(`
      id, profile_id, reward_large, reward_small, reward_golden, note, created_at,
      profiles ( display_name ),
      tasks    ( title, requires_approval )
    `)
    .is('approved_at', null)
    .order('created_at', { ascending: true });

  // Filter to only those from this family and where task requires approval
  const { data: familyProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('family_id', profile.family_id);

  const familyProfileIds = new Set((familyProfiles ?? []).map(p => p.id));

  type RawCompletion = {
    id: string; profile_id: string;
    reward_large: number; reward_small: number; reward_golden: number;
    note?: string; created_at: string;
    profiles: { display_name: string }[] | { display_name: string } | null;
    tasks:    { title: string; requires_approval: boolean }[] | { title: string; requires_approval: boolean } | null;
  };

  const pending = ((completions ?? []) as unknown as RawCompletion[]).filter(c => {
    if (!familyProfileIds.has(c.profile_id)) return false;
    const tasksVal = c.tasks;
    const t = Array.isArray(tasksVal) ? tasksVal[0] : tasksVal;
    return t?.requires_approval ?? false;
  });

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white shadow-sm px-6 py-5">
        <div className="max-w-lg mx-auto">
          <a href="/dashboard" className="text-indigo-600 text-sm mb-2 inline-block">← Dashboard</a>
          <div className="flex justify-between items-center">
            <h1 className="font-bold text-xl text-gray-900">Pending Approvals</h1>
            {pending.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </div>
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
