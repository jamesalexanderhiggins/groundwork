# Groundwork — Deployment Setup Guide

Complete step-by-step guide to getting Groundwork running from scratch.

---

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key
- A [Stripe](https://stripe.com) account
- A [Resend](https://resend.com) account (for weekly email digests)
- Vercel (recommended) or any Node.js host

---

## Step 1 — Clone and install

```bash
git clone <your-repo>
cd groundwork
npm install
```

---

## Step 2 — Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in each value. See `.env.local.example` for where to find each one.

**Required for any feature to work:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

**Required for billing:**
- All `STRIPE_*` variables

**Required for weekly email digest:**
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

---

## Step 3 — Set up the database

1. Open your Supabase project → **SQL Editor**
2. Paste the entire contents of `supabase/migrations/ALL_MIGRATIONS.sql`
3. Click **Run**

That's it — all tables, RLS policies, and badge seed data are created in one shot.

> **If you already ran individual migration files:** Only run `supabase/migrations/004_groundwork_core.sql` (it uses `create table if not exists`).

---

## Step 4 — Set up Stripe products

Run the setup script to create products and prices in Stripe:

```bash
STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/stripe-setup.ts
```

Copy the printed price IDs into `.env.local`.

---

## Step 5 — Configure Stripe webhook

### Local development

```bash
npm install -g stripe
stripe listen --forward-to localhost:3000/api/stripe
```

Copy the `whsec_...` signing secret to `STRIPE_WEBHOOK_SECRET` in `.env.local`.

### Production (Vercel)

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://your-domain.com/api/stripe`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the signing secret to your Vercel environment variables.

---

## Step 6 — Deploy Supabase Edge Functions

Install the Supabase CLI, then:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy nudge-engine
supabase functions deploy weekly-review
```

Set the Edge Function secrets:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM_EMAIL=groundwork@yourdomain.com
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Schedule the functions via Supabase Dashboard → Edge Functions → Schedules:
- `nudge-engine`: `0 9 * * *` (9am daily)
- `weekly-review`: `0 18 * * 0` (6pm every Sunday)

---

## Step 7 — Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

---

## Step 8 — First-time app setup

1. Sign up at `/login` → creates your user account
2. You'll be prompted to create a family
3. As a parent, go to **Settings** to configure your family bank name, coin names, and exchange rates
4. Invite children by creating child profiles from the parent dashboard
5. Invite trusted adults via **Parent → Cashout** → Trusted Adults section
6. Go to **Billing** to activate a subscription (or skip for testing in dev mode)

---

## Step 9 — Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add all environment variables from `.env.local` to your Vercel project settings.

Make sure to set `NEXT_PUBLIC_APP_URL` to your production domain.

---

## Security checklist

- [ ] Rotate the Supabase service role key if it was ever exposed in chat or logs
- [ ] Ensure `.env.local` is in `.gitignore` (it is by default)
- [ ] All Stripe webhook calls are verified via `stripe.webhooks.constructEvent`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only used in server-side code (`lib/supabase-server.ts`)
- [ ] RLS is enabled on all tables (verified in `ALL_MIGRATIONS.sql`)

---

## Architecture overview

```
app/
  [locale]/           # All routes under locale prefix (en/es/fr/de/pt/ja/zh)
    dashboard/        # Parent home — family overview
    tasks/            # Child task view — Higgy Bank tap interface
    groundwork/       # Adult life OS — AI nudges, life items, drafts
    profile/          # Virtue bar, skin picker, badge shelf
    billing/          # Stripe subscription management
    settings/         # Cognitive mode, locale, sign out
    cashout/          # Child cash-out request form
    parent/           # Parent-only routes (approvals, cashout windows)
    trusted/          # Trusted adult portal
    join/[token]/     # Invitation acceptance

lib/
  supabase.ts         # Browser Supabase client (client components only)
  supabase-server.ts  # Server Supabase client (server components, actions)
  stripe.ts           # Lazy Stripe proxy (safe at build time)
  virtue.ts           # VP thresholds, level calc, skin unlock logic
  sounds.ts           # Web Audio API skin sound profiles
  subscription.ts     # Subscription status helpers

app/actions/          # All database mutations (server actions)
supabase/functions/   # Deno Edge Functions (nudge-engine, weekly-review)
```

---

## Key design decisions

**Coin names are family-configurable.** The defaults ("Higg", "Ginsey", "Golden Higg") are from the Higgins family spec. Each family sets their own names.

**No audio files.** All sounds are synthesised via Web Audio API using per-skin tone profiles in `lib/sounds.ts`.

**Supabase joins return arrays.** Any joined relation in Supabase TypeScript types may be `T | T[] | null`. All join results use `Array.isArray()` guards throughout the codebase.

**Stripe is lazily instantiated.** `new Stripe()` throws at build time if the env var is missing. The proxy in `lib/stripe.ts` defers instantiation to the first request.

**Edge Functions are excluded from tsconfig.** They use Deno globals and esm.sh imports. Added to `exclude` in `tsconfig.json`.
