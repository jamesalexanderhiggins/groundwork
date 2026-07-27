import { redirect }                   from 'next/navigation';
import Link                            from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSubscriptionStatus, isSubscribed } from '@/lib/subscription';
import { PLAN_DISPLAY, type PlanKey } from '@/lib/stripe';
import { createCheckoutSession, createPortalSession } from '@/app/actions/billing';

async function portalAction() {
  'use server';
  await createPortalSession();
}

function checkoutAction(key: PlanKey) {
  async function action() {
    'use server';
    await createCheckoutSession(key);
  }
  return action;
}

export default async function BillingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('user_id', user.id)
    .single();

  if (!profile || !['parent', 'admin'].includes(profile.role)) redirect('/dashboard');

  const { data: family } = await supabase
    .from('families')
    .select('family_name')
    .eq('id', profile.family_id)
    .single();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('family_id', profile.family_id)
    .maybeSingle();

  const status = await getSubscriptionStatus(profile.family_id);
  const active = isSubscribed(status);

  const plans = Object.entries(PLAN_DISPLAY) as [PlanKey, typeof PLAN_DISPLAY[PlanKey]][];

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-white shadow-sm px-6 py-5">
        <div className="max-w-2xl mx-auto">
          <Link href="/dashboard" className="text-indigo-600 text-sm mb-2 inline-block">← Dashboard</Link>
          <h1 className="font-bold text-xl text-gray-900">Billing</h1>
          <p className="text-sm text-gray-400">{family?.family_name}</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 pt-6 flex flex-col gap-6">
        {/* Active subscription */}
        {active && sub && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="font-semibold text-green-800">
              {sub.plan === 'family' ? 'Family Plan' : 'Individual Plan'} · Active
            </p>
            <p className="text-sm text-green-700 mt-1">
              Renews {new Date(sub.current_period_end).toLocaleDateString()}
            </p>
            <form action={portalAction} className="mt-3">
              <button type="submit" className="text-sm text-green-700 underline hover:text-green-900">
                Manage subscription →
              </button>
            </form>
          </div>
        )}

        {/* Past due */}
        {status === 'past_due' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="font-semibold text-yellow-800">Payment overdue</p>
            <p className="text-sm text-yellow-700 mt-1">Update your payment method to restore access.</p>
            <form action={portalAction} className="mt-3">
              <button type="submit" className="text-sm text-yellow-700 underline">Update payment →</button>
            </form>
          </div>
        )}

        {/* Plan picker */}
        {!active && (
          <>
            <p className="text-gray-500 text-sm">
              Choose a plan to unlock Higgy Bank, Higgs Arcade, Kempt Life, and all AI features.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map(([key, plan]) => (
                <div key={key} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{plan.name}</p>
                      <p className="text-2xl font-bold text-indigo-600 mt-0.5">{plan.price}</p>
                    </div>
                    {key.includes('annual') && (
                      <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">
                        2 months free
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                  <form action={checkoutAction(key)}>
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-indigo-700 transition-colors"
                    >
                      Get started
                    </button>
                  </form>
                </div>
              ))}
            </div>

            <p className="text-xs text-center text-gray-400">
              Prices in AUD. Stripe Tax applies VAT/GST automatically for your region. Cancel anytime.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
