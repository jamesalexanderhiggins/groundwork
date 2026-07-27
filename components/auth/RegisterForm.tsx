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

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email)             { setError(t('email_required')); return; }
    if (!password)          { setError(t('password_required')); return; }
    if (password.length < 8){ setError(t('password_min_length')); return; }
    if (password !== confirmPw) { setError(t('passwords_must_match')); return; }

    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push('/onboarding');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
          {error}
        </div>
      )}

      <Input
        label={t('email')}
        type="email"
        autoComplete="email"
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

      <Input
        label={t('confirm_password')}
        type="password"
        autoComplete="new-password"
        value={confirmPw}
        onChange={e => setConfirmPw(e.target.value)}
        required
      />

      <Button type="submit" loading={loading} className="w-full mt-2">
        {loading ? t('creating_account') : t('sign_up')}
      </Button>

      <p className="text-center text-sm mt-2 opacity-70 text-[var(--color-text)]">
        {t('have_account')}{' '}
        <Link href="/login" className="text-[var(--color-primary)] font-medium hover:underline">
          {t('sign_in')}
        </Link>
      </p>
    </form>
  );
}
