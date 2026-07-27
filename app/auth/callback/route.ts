import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * OAuth / magic-link callback.
 *
 * `next` arrives from the query string, so it is only ever used when it is a
 * same-site absolute path. Accepting it verbatim would let a crafted link
 * bounce a freshly authenticated user to another origin.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/dashboard';
  // Must start with a single slash — rejects "//evil.com" and "https://evil.com"
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code        = searchParams.get('code');
  const next        = safeNext(searchParams.get('next'));
  const oauthError  = searchParams.get('error');
  const errorDesc   = searchParams.get('error_description');

  // The provider itself rejected the sign-in (cancelled, misconfigured, etc.)
  if (oauthError) {
    const to = new URL('/login', origin);
    to.searchParams.set('error', errorDesc ?? oauthError);
    return NextResponse.redirect(to);
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));

    const to = new URL('/login', origin);
    to.searchParams.set('error', error.message);
    return NextResponse.redirect(to);
  }

  const to = new URL('/login', origin);
  to.searchParams.set('error', 'Sign-in link was invalid or has expired.');
  return NextResponse.redirect(to);
}
