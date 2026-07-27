'use server';

import { redirect }                   from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { stripe, PLAN_PRICE_IDS, type PlanKey } from '@/lib/stripe';

export async function createCheckoutSession(planKey: PlanKey) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const priceId = PLAN_PRICE_IDS[planKey];
  if (!priceId) return { error: `Price not configured for plan: ${planKey}` };

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('user_id', user.id)
    .single();

  if (!profile) return { error: 'No profile found' };

  // Reuse existing customer if we have one
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('family_id', profile.family_id)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode:                'subscription',
    customer:            sub?.stripe_customer_id ?? undefined,
    customer_email:      sub?.stripe_customer_id ? undefined : user.email,
    line_items:          [{ price: priceId, quantity: 1 }],
    automatic_tax:       { enabled: true },       // Stripe Tax handles VAT/GST
    tax_id_collection:   { enabled: true },
    success_url:         `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:          `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    metadata:            { family_id: profile.family_id, plan: planKey },
    subscription_data:   { metadata: { family_id: profile.family_id, plan: planKey } },
  });

  redirect(session.url!);
}

export async function createPortalSession() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('user_id', user.id)
    .single();

  if (!profile) return { error: 'No profile' };

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('family_id', profile.family_id)
    .single();

  if (!sub?.stripe_customer_id) return { error: 'No subscription found' };

  const session = await stripe.billingPortal.sessions.create({
    customer:   sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  redirect(session.url);
}

export async function getSubscription(familyId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('family_id', familyId)
    .maybeSingle();
  return data;
}
