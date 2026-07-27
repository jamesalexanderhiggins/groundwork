import { cookies } from 'next/headers';
import { createServerSupabaseClient } from './supabase-server';

export interface CurrentProfile {
  id:             string;
  display_name:   string;
  family_id:      string;
  role:           string;
  life_stage:     string;
  skin:           string;
  cognitive_mode: string;
  locale:         string;
  virtue_level:   number;
  virtue_points:  number;
  /** True when this is a child profile the adult has switched into. */
  isSwitched:     boolean;
}

const COLUMNS =
  'id, display_name, family_id, role, life_stage, skin, cognitive_mode, locale, virtue_level, virtue_points';

/**
 * Resolve which profile the current screen should render for.
 *
 * Prefers the `active_profile` cookie (an adult switched into a child),
 * and falls back to the signed-in user's own profile. Pages used to
 * redirect to /dashboard whenever the cookie was absent, which made
 * several screens unreachable until a child had been selected.
 *
 * Returns null when there is no session or no profile yet.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: own } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!own) return null;

  const cookieStore = await cookies();
  const activeId    = cookieStore.get('active_profile')?.value;

  if (!activeId || activeId === own.id) {
    return { ...own, isSwitched: false } as CurrentProfile;
  }

  // Only honour the cookie for a profile in the same family
  const { data: active } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .eq('id', activeId)
    .eq('family_id', own.family_id)
    .maybeSingle();

  if (!active) return { ...own, isSwitched: false } as CurrentProfile;
  return { ...active, isSwitched: true } as CurrentProfile;
}
