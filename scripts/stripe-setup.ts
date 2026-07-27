/**
 * Run once to create Stripe products and prices, then copy the price IDs to .env.local.
 * Usage: npx tsx scripts/stripe-setup.ts
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' as never });

async function main() {
  console.log('Creating Kempt Stripe products and prices...\n');

  // Family plan
  const familyProduct = await stripe.products.create({
    name: 'Kempt Family',
    description: 'Full access for the whole family — Higgy Bank, AI life OS, and more.',
    metadata: { plan: 'family' },
  });

  const familyMonthly = await stripe.prices.create({
    product: familyProduct.id,
    unit_amount: 1499,
    currency: 'aud',
    recurring: { interval: 'month' },
    nickname: 'Family Monthly',
  });

  const familyAnnual = await stripe.prices.create({
    product: familyProduct.id,
    unit_amount: 14900,
    currency: 'aud',
    recurring: { interval: 'year' },
    nickname: 'Family Annual',
  });

  // Individual plan
  const individualProduct = await stripe.products.create({
    name: 'Kempt Individual',
    description: 'Kempt AI life OS for one adult user.',
    metadata: { plan: 'individual' },
  });

  const individualMonthly = await stripe.prices.create({
    product: individualProduct.id,
    unit_amount: 799,
    currency: 'aud',
    recurring: { interval: 'month' },
    nickname: 'Individual Monthly',
  });

  const individualAnnual = await stripe.prices.create({
    product: individualProduct.id,
    unit_amount: 7900,
    currency: 'aud',
    recurring: { interval: 'year' },
    nickname: 'Individual Annual',
  });

  console.log('Done! Add these to your .env.local:\n');
  console.log(`STRIPE_PRICE_FAMILY_MONTHLY=${familyMonthly.id}`);
  console.log(`STRIPE_PRICE_FAMILY_ANNUAL=${familyAnnual.id}`);
  console.log(`STRIPE_PRICE_INDIVIDUAL_MONTHLY=${individualMonthly.id}`);
  console.log(`STRIPE_PRICE_INDIVIDUAL_ANNUAL=${individualAnnual.id}`);
  console.log('\nAlso set up your Stripe webhook (stripe listen --forward-to localhost:3000/api/stripe)');
  console.log('and copy the webhook signing secret to STRIPE_WEBHOOK_SECRET.');
}

main().catch(console.error);
