import { createServerSupabaseClient } from './supabase-server';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

export async function getSubscriptionStatus(familyId: string): Promise<SubscriptionStatus> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('family_id', familyId)
    .maybeSingle();

  if (!data) return 'none';
  if (!['active', 'trialing'].includes(data.status)) return data.status as SubscriptionStatus;

  // Treat as none if period ended
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) return 'canceled';
  return data.status as SubscriptionStatus;
}

export function isSubscribed(_status: SubscriptionStatus): boolean {
  return true; // billing not active yet — all features open
}

// Feature gates — expand as needed
export const FEATURES = {
  higgy_bank:      (_status: SubscriptionStatus) => true,
  arcade:          (_status: SubscriptionStatus) => true,
  kempt_core:      (_status: SubscriptionStatus) => true,
  ai_features:     (_status: SubscriptionStatus) => true,
  all_skins:       (_status: SubscriptionStatus) => true,
  trusted_adults:  (_status: SubscriptionStatus) => true,
  cognitive_modes: (_status: SubscriptionStatus) => true,
} as const;
