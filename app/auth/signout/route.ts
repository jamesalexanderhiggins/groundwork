import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase-server';

async function signOut(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete('active_profile');

  // Derive the origin from the request. Reading NEXT_PUBLIC_APP_URL with a
  // non-null assertion threw a 500 on any deployment where it was unset.
  return NextResponse.redirect(new URL('/login', request.nextUrl.origin), {
    status: 303,
  });
}

export async function POST(request: NextRequest) {
  return signOut(request);
}

// Allow a plain link to sign out as well as a form POST
export async function GET(request: NextRequest) {
  return signOut(request);
}
