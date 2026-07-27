import { NextRequest, NextResponse } from 'next/server';
import { stripe }                    from '@/lib/stripe';
import { createServiceClient }       from '@/lib/supabase-server';
import type Stripe                   from 'stripe';

export async function POST(request: NextRequest) {
  const body      = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Webhook error: ${(err as Error).message}` }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;

      const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const familyId = session.metadata?.family_id;
      const plan     = session.metadata?.plan ?? 'family_monthly';

      if (!familyId) break;

      // current_period_end is a Unix timestamp on the Stripe Subscription object
      const periodEnd = (stripeSubscription as unknown as { current_period_end: number }).current_period_end;

      await supabase.from('subscriptions').upsert({
        family_id:              familyId,
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: stripeSubscription.id,
        plan:                   plan.startsWith('family') ? 'family' : 'individual',
        status:                 stripeSubscription.status,
        current_period_end:     new Date(periodEnd * 1000).toISOString(),
      }, { onConflict: 'family_id' });
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub      = event.data.object as Stripe.Subscription;
      const subRaw   = sub as unknown as { metadata: Record<string, string>; current_period_end: number };
      const familyId = subRaw.metadata?.family_id;
      if (!familyId) break;

      await supabase.from('subscriptions').update({
        status:             sub.status,
        current_period_end: new Date(subRaw.current_period_end * 1000).toISOString(),
      }).eq('family_id', familyId);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as unknown as { subscription: string };
      const subId   = invoice.subscription;
      if (!subId) break;
      await supabase.from('subscriptions').update({ status: 'past_due' })
        .eq('stripe_subscription_id', subId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
