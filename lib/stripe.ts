import Stripe from 'stripe';

// Lazy getter — avoids instantiation at module load time during `next build`
// when STRIPE_SECRET_KEY is not set in the build environment.
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' });
  }
  return _stripe;
}

// Keep named export for backwards compat — evaluated lazily via getter
export const stripe = new Proxy({} as Stripe, {
  get: (_t, prop) => Reflect.get(getStripe(), prop),
});

// Price IDs — set these in .env.local after creating products in Stripe dashboard
// STRIPE_PRICE_FAMILY_MONTHLY, STRIPE_PRICE_FAMILY_ANNUAL
// STRIPE_PRICE_INDIVIDUAL_MONTHLY, STRIPE_PRICE_INDIVIDUAL_ANNUAL

export type PlanKey = 'family_monthly' | 'family_annual' | 'individual_monthly' | 'individual_annual';

export const PLAN_PRICE_IDS: Record<PlanKey, string | undefined> = {
  family_monthly:      process.env.STRIPE_PRICE_FAMILY_MONTHLY,
  family_annual:       process.env.STRIPE_PRICE_FAMILY_ANNUAL,
  individual_monthly:  process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY,
  individual_annual:   process.env.STRIPE_PRICE_INDIVIDUAL_ANNUAL,
};

export const PLAN_DISPLAY: Record<PlanKey, { name: string; price: string; description: string }> = {
  family_monthly:     { name: 'Family',     price: '$14 AUD/mo',  description: 'Up to 6 profiles. Full Higgy Bank + Arcade + Kempt.' },
  family_annual:      { name: 'Family',     price: '$117 AUD/yr', description: 'Same as monthly — 2 months free.' },
  individual_monthly: { name: 'Individual', price: '$9 AUD/mo',   description: 'Kempt Core only. Single adult profile.' },
  individual_annual:  { name: 'Individual', price: '$75 AUD/yr',  description: 'Same as monthly — 2 months free.' },
};
