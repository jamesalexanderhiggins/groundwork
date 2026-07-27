'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

// Google sign-in only appears once the provider is actually configured in
// Supabase. Showing it before then sent people to a Supabase 404.
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

export function LoginForm() {
  const t        = useTranslations('auth');
  const router   = useRouter();
  const params   = useSearchParams();
  const supabase = createClient();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [formError, setError]   = useState('');
  const [notice, setNotice]     = useState('');
  const [loading, setLoading]   = useState(false);

  // Errors handed back by the auth callback are read straight from the URL.
  // Copying them into state inside an effect caused a cascading render.
  const error = formError || (params.get('error') ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!email)    { setError(t('email_required')); return; }
    if (!password) { setError(t('password_required')); return; }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (authError) {
      // Distinguish the common cases instead of always saying "wrong password"
      const msg = authError.message.toLowerCase();
      if (msg.includes('not confirmed')) {
        setError('Please confirm your email address first, then sign in.');
      } else if (msg.includes('invalid login')) {
        setError(t('invalid_credentials'));
      } else {
        setError(authError.message);
      }
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  async function handleGoogleLogin() {
    setError('');
    setLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setLoading(false);
      setError('Google sign-in is not available right now. Please use your email and password.');
    }
  }

  async function handleForgotPassword() {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email address first, then tap "Forgot password".');
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/callback?next=/settings` },
    );
    setLoading(false);
    if (resetError) { setError(resetError.message); return; }
    setNotice('If that address has an account, a reset link is on its way.');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="text-sm text-[var(--color-success)] bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          {notice}
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
        autoComplete="current-password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />

      <button
        type="button"
        onClick={handleForgotPassword}
        className="self-end text-xs text-[var(--color-primary)] hover:underline"
      >
        Forgot password?
      </button>

      <Button type="submit" loading={loading} className="w-full">
        {loading ? t('signing_in') : t('sign_in')}
      </Button>

      {GOOGLE_ENABLED && (
        <>
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-[var(--color-accent)]/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--color-bg-card)] px-2 opacity-60">
                {t('or_continue_with')}
              </span>
            </div>
          </div>

          <Button type="button" variant="secondary" onClick={handleGoogleLogin} className="w-full">
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('google')}
          </Button>
        </>
      )}

      <p className="text-center text-sm mt-1 opacity-70 text-[var(--color-text)]">
        {t('no_account')}{' '}
        <Link href="/register" className="text-[var(--color-primary)] font-medium hover:underline">
          {t('sign_up')}
        </Link>
      </p>
    </form>
  );
}
