# Groundwork — Launch Guide
### ADHD-friendly. One coffee. One step at a time.

**Where you're at:** SQL is done. Code is built. You just need to connect the services and deploy.
**Time needed:** About an hour, probably less.
**What you'll have at the end:** A live app at a real URL your family can use.

---

## Before you start — open these tabs

Open all of these now so you're not hunting later:

- [ ] **Supabase** → [supabase.com](https://supabase.com) → your project → **Project Settings → API**
- [ ] **Anthropic** → [console.anthropic.com](https://console.anthropic.com) → **API Keys**
- [ ] **Stripe** → [dashboard.stripe.com](https://dashboard.stripe.com) → **Developers → API Keys**
- [ ] **Resend** → [resend.com](https://resend.com) → **API Keys**
- [ ] **Vercel** → [vercel.com](https://vercel.com) → log in or sign up free
- [ ] **GitHub** → [github.com](https://github.com) → log in

---

## Step 1 — Push your code to GitHub
*(5 minutes)*

You need your code in GitHub so Vercel can deploy it.

1. On GitHub, click **New repository**. Name it `groundwork`. Make it **Private**. Do NOT tick "Add a README". Click **Create repository**.

2. GitHub will show you some commands. Copy the ones under **"…or push an existing repository"**. They'll look like this (your username will be different):
   ```
   git remote add origin https://github.com/YOUR-USERNAME/groundwork.git
   git branch -M main
   git push -u origin main
   ```

3. Back in this terminal, run:
   ```bash
   git add -A
   git commit -m "Initial commit"
   ```
   Then paste and run the three commands from GitHub.

4. Refresh your GitHub page — you should see all your files there.

**Done when:** You can see your files on GitHub. ✓

---

## Step 2 — Create your .env.local file
*(10 minutes)*

This file holds all your secret keys. It never gets uploaded anywhere public.

1. In this terminal, run:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` in a text editor and fill in each value. Here's exactly where to find each one:

---

### Supabase keys
Go to: **Supabase → your project → Project Settings → API**

```
NEXT_PUBLIC_SUPABASE_URL=        ← "Project URL" — copy it exactly
NEXT_PUBLIC_SUPABASE_ANON_KEY=   ← "anon public" key
SUPABASE_SERVICE_ROLE_KEY=       ← "service_role" key (keep this one secret)
```

---

### Anthropic key
Go to: **console.anthropic.com → API Keys → Create Key**

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

### Stripe keys
Go to: **Stripe Dashboard → Developers → API Keys**

Use **test mode** keys for now (toggle in top-left of Stripe). Switch to live later.

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

Leave `STRIPE_WEBHOOK_SECRET` and the `STRIPE_PRICE_*` lines blank for now — you'll fill them in Steps 3 and 5.

---

### Resend key
Go to: **resend.com → API Keys → Create API Key**

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=groundwork@yourdomain.com   ← any email you own
```

> Resend is only used for weekly digest emails. If you don't have it yet, just leave these blank — the app works fine without them.

---

### App URL (leave as-is for now)
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
You'll update this to your real URL after deploying in Step 5.

---

**Done when:** `.env.local` is saved with at least the Supabase and Anthropic keys filled in. ✓

---

## Step 3 — Create your Stripe products
*(5 minutes)*

This script creates the subscription plans in Stripe and prints back the price IDs you need.

Run this in your terminal (paste your actual Stripe secret key):

```bash
STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-setup.ts
```

It will print something like:
```
family_monthly:    price_1ABC...
family_annual:     price_1DEF...
individual_monthly: price_1GHI...
individual_annual:  price_1JKL...
```

Copy each `price_...` value into your `.env.local`:
```
STRIPE_PRICE_FAMILY_MONTHLY=price_1ABC...
STRIPE_PRICE_FAMILY_ANNUAL=price_1DEF...
STRIPE_PRICE_INDIVIDUAL_MONTHLY=price_1GHI...
STRIPE_PRICE_INDIVIDUAL_ANNUAL=price_1JKL...
```

**Done when:** Four `price_...` values are in your `.env.local`. ✓

---

## Step 4 — Deploy to Vercel
*(10 minutes)*

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Click **Import Git Repository** → connect your GitHub account if needed → select `groundwork`
3. Vercel will detect it's a Next.js app automatically. Don't change the build settings.
4. **Before clicking Deploy**, click **Environment Variables** and add every line from your `.env.local` — one by one. (Name = the left side, Value = the right side.)
5. Click **Deploy**.

Vercel will build for about 2 minutes. When it finishes, it gives you a URL like `groundwork-abc123.vercel.app`.

**Copy that URL** — you need it for the next two steps.

**Done when:** Vercel says "Congratulations" and shows your URL. ✓

---

## Step 5 — Update your app URL
*(2 minutes)*

Now that you have a real URL, update it in two places:

**In Vercel:**
Go to your project → **Settings → Environment Variables** → find `NEXT_PUBLIC_APP_URL` → edit it to your real URL:
```
NEXT_PUBLIC_APP_URL=https://groundwork-abc123.vercel.app
```
Then go to **Deployments → Redeploy** (top-right menu on your latest deployment) to apply it.

**Done when:** Redeploy finishes. ✓

---

## Step 6 — Set up your Stripe webhook
*(5 minutes)*

This tells Stripe to notify your app when someone pays.

1. Go to **Stripe Dashboard → Developers → Webhooks → Add endpoint**
2. **Endpoint URL:** `https://your-vercel-url.vercel.app/api/stripe`
3. Click **Select events** and tick these four:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Click **Add endpoint**
5. On the next screen, click **Reveal** next to "Signing secret" — copy the `whsec_...` value
6. Go to **Vercel → your project → Settings → Environment Variables** and add:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
7. Redeploy again (Deployments → Redeploy).

**Done when:** Stripe shows your webhook as "Enabled" with a green dot. ✓

---

## Step 7 — Open the app and sign up
*(5 minutes)*

1. Go to your Vercel URL in a browser
2. Click **Sign up** — use your real email
3. You'll be prompted to create your family — fill in your family name and coin names (or keep the Higgins defaults)
4. Once you're in, go to **Settings** to customise your family's coin names, rates, and time caps
5. Go to **Parent → Children** to add your kids as profiles
6. Go to **Billing** to activate a subscription (use Stripe test card `4242 4242 4242 4242`, any future date, any CVC)

**Done when:** You're logged in and can see the dashboard. ✓

---

## Optional — Scheduled nudges and weekly emails
*(20 minutes, do this when you're ready)*

This sets up the AI that sends daily nudges and Sunday review emails. Not needed for day-one use.

Install the Supabase CLI first:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
```
*(Your project ref is in Supabase → Project Settings → General — it's the string after `https://` in your project URL)*

Deploy the functions:
```bash
supabase functions deploy nudge-engine
supabase functions deploy weekly-review
```

Set their secrets:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM_EMAIL=groundwork@yourdomain.com
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set NEXT_PUBLIC_APP_URL=https://your-vercel-url.vercel.app
```

Schedule them in **Supabase Dashboard → Edge Functions → your function → Schedules**:
- `nudge-engine` → `0 9 * * *` (runs 9am every day)
- `weekly-review` → `0 18 * * 0` (runs 6pm every Sunday)

---

## Security — do this before you share the app with anyone

- [ ] Go to **Supabase → Project Settings → API** and rotate your service role key (it was briefly visible in a chat session — takes 30 seconds, just click "Regenerate")
- [ ] Update the new `SUPABASE_SERVICE_ROLE_KEY` value in Vercel environment variables and redeploy
- [ ] Update the same value in your `supabase secrets set` command if you deployed Edge Functions

---

## Quick reference — where everything lives

| Thing | Where |
|---|---|
| Supabase keys | supabase.com → Project Settings → API |
| Anthropic key | console.anthropic.com → API Keys |
| Stripe keys | dashboard.stripe.com → Developers → API Keys |
| Stripe webhook secret | dashboard.stripe.com → Developers → Webhooks → your endpoint |
| Stripe price IDs | dashboard.stripe.com → Products |
| Resend key | resend.com → API Keys |
| Vercel env vars | vercel.com → your project → Settings → Environment Variables |
| Your app URL | vercel.com → your project → Deployments (top of list) |

---

**You've got this. One checkbox at a time.**
