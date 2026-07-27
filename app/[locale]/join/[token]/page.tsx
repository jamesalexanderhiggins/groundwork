import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { AcceptInviteForm } from '@/components/trusted/AcceptInviteForm';

export const metadata = { title: 'Join a family' };

interface Props {
  params: Promise<{ token: string; locale: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  const supabase  = await createServerSupabaseClient();

  const { data: invite } = await supabase
    .from('trusted_invitations')
    .select('id, email, family_id, expires_at, used')
    .eq('token', token)
    .maybeSingle();

  const expired = !invite || invite.used || new Date(invite.expires_at) < new Date();

  if (expired) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4" aria-hidden="true">⌛</p>
          <h1 className="font-bold text-xl text-[var(--color-text)] mb-2">
            This invitation has expired
          </h1>
          <p className="opacity-60 text-sm text-[var(--color-text)]">
            The link has already been used or is more than seven days old.
            Ask the family to send you a new one.
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 text-sm text-[var(--color-primary)] font-medium hover:underline"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  // Preserve the invite through sign-in so the link is not lost.
  if (!user) redirect(`/login?next=/join/${token}`);

  // The column is `name` — `family_name` does not exist and silently
  // returned null, so the invite always read "the family".
  const { data: family } = await supabase
    .from('families')
    .select('name')
    .eq('id', invite.family_id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm card overflow-hidden">
        <div className="bg-[var(--color-primary)] px-6 py-8 text-center">
          <p className="text-4xl mb-2" aria-hidden="true">⭐</p>
          <h1 className="font-bold text-white text-xl">You&apos;re invited</h1>
          <p className="text-white/85 text-sm mt-1">
            Join {family?.name ?? 'this family'} as a trusted adult
          </p>
        </div>

        <div className="p-6">
          <p className="text-sm opacity-60 text-[var(--color-text)] mb-4">
            Trusted adults can send golden gifts. They cannot change tasks,
            settings or anyone&apos;s balance.
          </p>
          <AcceptInviteForm token={token} />
        </div>
      </div>
    </main>
  );
}
