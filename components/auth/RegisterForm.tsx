'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

export function RegisterForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError]         = useState('');
  const [checkInbox, setCheckInbox] = useState(false);
  const [loading, setLoading]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const address = email.trim();

    if (!address)                { setError(t('email_required')); return; }
    if (!password)               { setError(t('password_required')); return; }
    if (password.length < 8)     { setError(t('password_min_length')); return; }
    if (password !== confirmPw)  { setError(t('passwords_must_match')); return; }

    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: address,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('That email already has an account. Try signing in instead.');
      } else {
        setError(authError.message);
      }
      return;
    }

    // When email confirmation is switched on, signUp returns a user but no
    // session — sending them to onboarding would fail on the first write.
    if (data.user && !data.session) {
      setCheckInbox(true);
      return;
    }

    router.push('/onboarding');
    router.refresh();
  }

  if (checkInbox) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">📬</div>
        <h2 className="font-semibold text-[var(--color-text)]">Check your inbox</h2>
        <p className="text-sm opacity-70 mt-2 text-[var(--color-text)]">
          We sent a confirmation link to <strong>{email.trim()}</strong>.
          Open it to finish setting up your account.
        </p>
        <Link
          href="/login"
          className="inline-block mt-5 text-sm text-[var(--color-primary)] font-medium hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      <Input
        label={t('email')}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />

      <Input
        label={t('password')}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <p className="text-xs opacity-55 -mt-2 text-[var(--color-text)]">
        At least 8 characters.
      </p>

      <Input
        label={t('confirm_password')}
        type="password"
        autoComplete="new-password"
        value={confirmPw}
        onChange={e => setConfirmPw(e.target.value)}
        error={confirmPw && password !== confirmPw ? t('passwords_must_match') : undefined}
        required
      />

      <Button type="submit" loading={loading} className="w-full mt-1">
        {loading ? t('creating_account') : t('sign_up')}
      </Button>

      <p className="text-center text-sm mt-1 opacity-70 text-[var(--color-text)]">
        {t('have_account')}{' '}
        <Link href="/login" className="text-[var(--color-primary)] font-medium hover:underline">
          {t('sign_in')}
        </Link>
      </p>
    </form>
  );
}
