import { type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const handleI18n = createIntlMiddleware(routing);

/**
 * Runs on every page request.
 *
 * Two jobs, in this order:
 *  1. Resolve the locale (next-intl) and produce the response we will return.
 *  2. Refresh the Supabase auth session, writing any rotated cookies onto
 *     that same response.
 *
 * Step 2 is not optional. Supabase access tokens are short-lived; without a
 * refresh here the browser keeps a valid-looking session while server
 * components receive an expired token, which surfaces as random
 * "session expired" errors part-way through a flow.
 */
export default async function proxy(request: NextRequest) {
  const response = handleI18n(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without credentials there is no session to refresh — serve the page
  // rather than failing with an opaque 500.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Touching getUser() is what triggers the refresh-and-rotate.
  try {
    await supabase.auth.getUser();
  } catch {
    // Network hiccup talking to Supabase — don't take the page down.
  }

  return response;
}

export const config = {
  // Skip API routes, auth callbacks, Next internals and static files.
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
