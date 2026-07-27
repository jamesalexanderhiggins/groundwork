import { redirect }                   from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { AcceptInviteForm }            from '@/components/trusted/AcceptInviteForm';

interface Props {
  params: Promise<{ token: string; locale: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  const supabase  = await createServerSupabaseClient();

  // Check invitation validity before showing the form
  const { data: invite } = await supabase
    .from('trusted_invitations')
    .select('id, email, family_id, expires_at, used')
    .eq('token', token)
    .single();

  const now = new Date().toISOString();

  if (!invite || invite.used || invite.expires_at < now) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">❌</p>
          <h1 className="font-bold text-xl text-gray-900 mb-2">Invalid invitation</h1>
          <p className="text-gray-500 text-sm">
            This link has expired or already been used. Ask your family to send a new one.
          </p>
        </div>
      </main>
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/join/${token}`);

  const { data: family } = await supabase
    .from('families')
    .select('family_name')
    .eq('id', invite.family_id)
    .single();

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-6 py-8 text-center">
          <p className="text-4xl mb-2">⭐</p>
          <h1 className="font-bold text-white text-xl">You&apos;re invited!</h1>
          <p className="text-white/80 text-sm mt-1">
            Join the {family?.family_name ?? 'family'} as a Trusted Adult
          </p>
        </div>

        <div className="p-6">
          <AcceptInviteForm token={token} />
        </div>
      </div>
    </main>
  );
}
