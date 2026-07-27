import { NextResponse }              from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { cookies }                    from 'next/headers';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  // Clear active_profile cookie
  const cookieStore = await cookies();
  cookieStore.delete('active_profile');

  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!));
}
