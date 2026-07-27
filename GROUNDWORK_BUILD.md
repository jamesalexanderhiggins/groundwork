# GROUNDWORK — Build Instructions for Claude Code
### with Higgy Bank & Higgs Arcade
**Version 2.0 — Build-Ready Technical Specification**

---

## What You Are Building

Groundwork is a life-stage aware, neuro-inclusive, AI-powered personal operating system for everyday humans. It has two interconnected modules:

- **Groundwork Core** — an AI-powered life operating system for adults and adolescents
- **Higgy Bank (featuring Higgs Arcade)** — a character-building, dopamine-engineered habit and virtue economy for children and neurodivergent users

They share the same auth, database, and infrastructure but are encapsulated so either can be deployed independently.

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | Web-first. Server Components. Responsive. |
| Styling | Tailwind CSS | Skin system via CSS custom properties. |
| i18n | next-intl | All UI strings in JSON files. Zero hardcoded English in components. |
| Backend / DB | Supabase | PostgreSQL. Row Level Security on all tables. Realtime subscriptions. |
| Auth | Supabase Auth | Email/password + Google OAuth. Family account linking. |
| AI | Anthropic API (claude-sonnet-4-6) | Server-side only. Natural language parsing, nudges, drafts, quest descriptions. |
| Hosting | Vercel | Connected to the GitHub repo. |
| Payments | Stripe + Stripe Tax | Subscription billing. Auto VAT/GST for international. |
| Email | Resend | Weekly life reviews, notifications, quest alerts. |
| Animations | Framer Motion | Gate events, quest reveal, cash-out celebration, dopamine feedback. |
| Sound | Howler.js | Sound packs per skin. Respects OS mute. |

---

## Environment Variables Required

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ANTHROPIC_API_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

RESEND_API_KEY=

NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_DEFAULT_LOCALE=en
```

---

## Repository Structure

```
groundwork/
├── app/
│   ├── (auth)/            # login, register, onboarding, family setup
│   ├── (core)/            # Groundwork Core adult module
│   ├── (higgy)/           # Higgy Bank + Higgs Arcade
│   │   ├── dashboard/     # child balance dashboard
│   │   ├── arcade/        # screen time marketplace
│   │   ├── tasks/         # daily task list with AM/PM gates
│   │   ├── quests/        # quest board and reveal
│   │   ├── bulletin/      # bonus task bulletin
│   │   └── cashout/       # cash-out and gift window
│   ├── (parent)/          # parent admin: tasks, rules, economy setup
│   ├── (trusted)/         # trusted adult portal
│   ├── api/
│   │   ├── ai/            # Anthropic API routes (server-side only)
│   │   ├── stripe/        # Stripe webhooks
│   │   └── cron/          # Edge Function triggers
│   └── layout.tsx
├── components/
│   ├── core/              # Groundwork Core UI
│   ├── higgy/
│   │   ├── TaskTapButton.tsx
│   │   ├── GateEvent.tsx
│   │   ├── QuestReveal.tsx
│   │   ├── BalanceDashboard.tsx
│   │   ├── CurrencyDisplay.tsx
│   │   ├── SiblingTrade.tsx
│   │   └── CashOutCelebration.tsx
│   ├── shared/
│   └── skins/
├── lib/
│   ├── ai.ts
│   ├── supabase.ts
│   ├── stripe.ts
│   ├── economy.ts
│   └── skins.ts
├── messages/
│   ├── en.json
│   ├── es.json
│   ├── fr.json
│   ├── de.json
│   ├── pt.json
│   ├── ja.json
│   └── zh.json
├── styles/
│   ├── globals.css
│   └── skins/
├── public/
│   └── sounds/
└── supabase/
    └── migrations/
```

---

## Database Schema

Run all of the following as migrations in Supabase.

```sql
-- ═══════════════════════════════════════════════
-- FAMILIES & PROFILES
-- ═══════════════════════════════════════════════

create table families (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  bank_name         text not null default 'Higgy',
  currency_code     text not null default 'AUD',
  large_coin_name   text not null default 'Higg',
  small_coin_name   text not null default 'Ginsey',
  golden_coin_name  text not null default 'Golden Higg',
  small_per_large   integer not null default 6,
  large_cash_value  numeric not null default 2.00,
  golden_cash_value numeric not null default 5.00,
  large_minutes     integer not null default 30,
  small_minutes     integer not null default 5,
  golden_minutes    integer not null default 60,
  no_borrowing      boolean not null default true,
  sibling_trade     boolean not null default true,
  quit_penalty      boolean not null default false,
  weekly_routine_cap integer not null default 6,
  cap_monday        integer not null default 60,
  cap_tuesday       integer not null default 90,
  cap_wednesday     integer not null default 120,
  cap_thursday      integer not null default 90,
  cap_friday        integer not null default 150,
  cap_saturday      integer not null default 0,
  cap_sunday        integer not null default 0,
  created_at        timestamptz default now()
);

create table profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users,
  family_id        uuid references families not null,
  display_name     text not null,
  avatar_url       text,
  life_stage       text not null
    check (life_stage in ('little','young','adult','elder')),
  cognitive_mode   text not null default 'standard'
    check (cognitive_mode in ('standard','adhd','autism','dyslexia','calm')),
  skin             text not null default 'cloud_kingdom',
  role             text not null
    check (role in ('child','parent','trusted_adult','admin')),
  locale           text not null default 'en',
  virtue_level     integer default 1,
  virtue_points    integer default 0,
  created_at       timestamptz default now()
);

create table family_members (
  family_id  uuid references families not null,
  user_id    uuid references auth.users not null,
  profile_id uuid references profiles not null,
  role       text check (role in ('child','parent','trusted_adult','admin')),
  primary key (family_id, user_id)
);

-- ═══════════════════════════════════════════════
-- HIGGY BANK ECONOMY
-- ═══════════════════════════════════════════════

create table balance_accounts (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references profiles not null unique,
  large_balance    integer not null default 0,
  small_balance    integer not null default 0,
  golden_balance   integer not null default 0,
  lifetime_large   integer not null default 0,
  lifetime_golden  integer not null default 0,
  updated_at       timestamptz default now()
);

create table tasks (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid references families not null,
  assigned_to      uuid references profiles,
  title            text not null,
  description      text,
  category         text check (category in ('routine','bonus','quest','service')),
  time_block       text check (time_block in ('am','pm','any')),
  reward_type      text check (reward_type in ('small','large','golden','custom')),
  reward_small     integer not null default 0,
  reward_large     integer not null default 0,
  reward_golden    integer not null default 0,
  is_recurring     boolean default false,
  recurrence_days  integer[] default '{1,2,3,4,5,6,7}',
  is_gateway       boolean default false,
  requires_approval boolean default false,
  active           boolean default true,
  created_by       uuid references profiles,
  quest_expires_at timestamptz,
  sort_order       integer default 0,
  created_at       timestamptz default now()
);

create table task_completions (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid references tasks not null,
  profile_id       uuid references profiles not null,
  completed_at     timestamptz default now(),
  reward_small     integer not null default 0,
  reward_large     integer not null default 0,
  reward_golden    integer not null default 0,
  bonus_applied    boolean default false,
  bonus_small      integer default 0,
  approved_by      uuid references profiles,
  approved_at      timestamptz,
  notes            text
);

create table transactions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles not null,
  type         text check (type in (
    'earn_small','earn_large','earn_golden',
    'spend_small','spend_large','spend_golden',
    'cashout','gift_golden','trade','penalty','bonus')),
  small_delta  integer default 0,
  large_delta  integer default 0,
  golden_delta integer default 0,
  description  text,
  reference_id uuid,
  created_at   timestamptz default now()
);

create table screen_time_sessions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid references profiles not null,
  started_at      timestamptz default now(),
  planned_minutes integer not null,
  cost_large      integer not null default 0,
  cost_small      integer not null default 0,
  ended_at        timestamptz,
  actual_minutes  integer,
  overtime_small  integer default 0,
  device_type     text
);

create table privileges (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid references families not null,
  title       text not null,
  description text,
  cost_large  integer not null default 0,
  cost_small  integer not null default 0,
  type        text check (type in ('screen_time','experience','custom')),
  active      boolean default true
);

create table cashout_windows (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid references families not null,
  label            text not null,
  opens_at         timestamptz not null,
  closes_at        timestamptz not null,
  max_percent      numeric default 100,
  is_gift_window   boolean default false,
  gift_max_percent numeric default 10
);

create table streaks (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles not null unique,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_full_day  date
);

create table sibling_trades (
  id           uuid primary key default gen_random_uuid(),
  from_profile uuid references profiles not null,
  to_profile   uuid references profiles not null,
  small_amount integer default 0,
  large_amount integer default 0,
  status       text check (status in ('pending','accepted','rejected')),
  created_at   timestamptz default now()
);

create table badges (
  id        uuid primary key default gen_random_uuid(),
  key       text unique not null,
  title_key text not null,
  desc_key  text not null,
  icon      text
);

create table profile_badges (
  profile_id uuid references profiles not null,
  badge_id   uuid references badges not null,
  earned_at  timestamptz default now(),
  primary key (profile_id, badge_id)
);

-- ═══════════════════════════════════════════════
-- GROUNDWORK CORE
-- ═══════════════════════════════════════════════

create table life_items (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid references profiles not null,
  title              text not null,
  body               text,
  category           text,
  status             text default 'pending'
    check (status in ('pending','snoozed','done','dismissed')),
  due_at             timestamptz,
  snoozed_until      timestamptz,
  recurrence_pattern jsonb,
  ai_generated       boolean default false,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table nudges (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles not null,
  body           text not null,
  action_label   text,
  action_type    text,
  action_payload jsonb,
  delivered_at   timestamptz,
  dismissed_at   timestamptz,
  created_at     timestamptz default now()
);

create table drafts (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles not null,
  prompt     text not null,
  content    text not null,
  type       text,
  status     text default 'draft'
    check (status in ('draft','sent','discarded')),
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════
-- SUBSCRIPTIONS
-- ═══════════════════════════════════════════════

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  family_id              uuid references families not null,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text check (plan in ('family','individual')),
  status                 text,
  current_period_end     timestamptz,
  created_at             timestamptz default now()
);

-- ═══════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════

alter table profiles enable row level security;
create policy "Family members can read profiles" on profiles
  for select using (
    family_id in (
      select family_id from family_members where user_id = auth.uid()
    )
  );

alter table balance_accounts enable row level security;
create policy "Own family only" on balance_accounts
  for all using (
    profile_id in (
      select id from profiles where family_id in (
        select family_id from family_members where user_id = auth.uid()
      )
    )
  );

-- Apply similar RLS policies to all other tables.
```

---

## Economy Helper: lib/economy.ts

```typescript
export type Currency = {
  large: number;
  small: number;
  golden: number;
};

export type FamilyRates = {
  smallPerLarge: number;
  largeCashValue: number;
  goldenCashValue: number;
  largeMinutes: number;
  smallMinutes: number;
  goldenMinutes: number;
};

export function toMinutes(bal: Currency, rates: FamilyRates): number {
  return (
    bal.large  * rates.largeMinutes  +
    bal.small  * rates.smallMinutes  +
    bal.golden * rates.goldenMinutes
  );
}

// Ginseys (small) are NOT cashable — intentional
export function toCashValue(bal: Currency, rates: FamilyRates): number {
  return (
    bal.large  * rates.largeCashValue  +
    bal.golden * rates.goldenCashValue
  );
}

export function normalise(bal: Currency, rates: FamilyRates): Currency {
  const extraLarge = Math.floor(bal.small / rates.smallPerLarge);
  return {
    large:  bal.large + extraLarge,
    small:  bal.small % rates.smallPerLarge,
    golden: bal.golden,
  };
}

export function minutesToCost(minutes: number, rates: FamilyRates): Currency {
  let remaining = minutes;
  const golden = Math.floor(remaining / rates.goldenMinutes);
  remaining -= golden * rates.goldenMinutes;
  const large  = Math.floor(remaining / rates.largeMinutes);
  remaining -= large * rates.largeMinutes;
  const small  = Math.ceil(remaining / rates.smallMinutes);
  return { large, small, golden };
}
```

---

## AI System Prompt Template

Use this as the system prompt for all Groundwork Core API calls (`lib/ai.ts`):

```
You are the Groundwork assistant — a calm, capable, non-judgmental personal
life administrator. You help the user stay on top of their life without
pressure or shame.

User context:
- Name: {display_name}
- Cognitive mode: {cognitive_mode}
- Life stage: {life_stage}
- Language: {locale}

ALWAYS respond in the user's locale language.

Tone by cognitive mode:
- standard:  Warm, clear, direct. Conversational.
- adhd:      Ultra-short sentences. One action per message. Lead with
             the action, not the context.
- autism:    Literal and precise. No idioms. No ambiguity. State exactly
             what will happen. Numbered steps where helpful.
- dyslexia:  Short sentences. Simple vocabulary. No dense paragraphs.
- calm:      Very gentle. Low pressure. Always give permission to do less.
             Acknowledge difficulty. Never shame.

Never shame. Never use negative framing. Never overwhelm.
Always offer the next step. Keep the path clear and achievable.
```

### AI API Routes to build at `app/api/ai/`

| Route | Input | Output |
|---|---|---|
| `POST /parse-input` | Raw user text | Structured life item (title, category, due date, recurrence) |
| `POST /generate-nudge` | Pending items + user context | Nudge object with body and optional action |
| `POST /draft` | Draft prompt + context | Complete draft communication |
| `POST /weekly-review` | Week activity summary | Formatted weekly review in user's locale and cognitive mode |
| `POST /quest-description` | Quest title + family context + locale | Dramatic age-appropriate quest description |

---

## Skin System

Each skin overrides CSS custom properties on the root element. Switching skins = changing the skin class on `<html>`. No component changes needed.

```css
/* styles/skins/cyber-pulse.css */
.skin-cyber-pulse {
  --color-primary: #00FF41;
  --color-bg: #0D0D0D;
  --color-bg-card: #111111;
  --color-text: #00FF41;
  --color-accent: #00BFFF;
  --color-reward: #FFD700;
  --font-display: 'Share Tech Mono', monospace;
  --font-body: 'Roboto Mono', monospace;
  --animation-speed: 0.15s;
  --border-radius: 2px;
  --sound-pack: 'cyber';
}
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        bg: 'var(--color-bg)',
        'bg-card': 'var(--color-bg-card)',
        text: 'var(--color-text)',
        accent: 'var(--color-accent)',
        reward: 'var(--color-reward)',
      }
    }
  }
}
```

### Ten Launch Skins

| Skin Key | Name | Aesthetic |
|---|---|---|
| `cloud_kingdom` | Cloud Kingdom | Pastel, soft, fantasy, floating islands |
| `rainbow_studio` | Rainbow Studio | Bright, art-room, creative chaos |
| `deep_ocean` | Deep Ocean | Cool blues, sea creatures, bioluminescent |
| `space_command` | Space Command | Dark sky, stars, mission control |
| `cyber_pulse` | Cyber Pulse | Green text on black, hacker, digital rain |
| `jungle_quest` | Jungle Quest | Warm greens, adventure, explorer |
| `first_person` | First Person | Action-game HUD, tactical, high contrast |
| `pixel_world` | Pixel World | 8-bit retro, chiptune sound pack |
| `zen_garden` | Zen Garden | Minimalist, Japanese-inspired, calm |
| `dark_knight` | Dark Knight | Gothic, dark fantasy, dramatic |

---

## Key Component Specs

### GateEvent (most important UX moment in the app)

Triggered when the last task in an AM or PM block is completed.

- Full-screen takeover with skin-dependent unlock animation
- Text overlay: localised gate message
- Triumphant sound from active skin pack
- Auto-dismiss after ~2.5 seconds
- ADHD mode: briefer animation, immediate transition

### TaskTapButton

- Minimum 60px tap target height on mobile
- On press: haptic feedback, animation, currency drop sound
- Balance counter increments with counting animation
- ~10% random chance of surprise bonus drop with separate overlay and sound
- ADHD mode: only one task visible at a time

### QuestReveal

- Full-screen takeover with dramatic skin-appropriate entry animation
- Quest title revealed character by character (typewriter effect)
- Reward displayed with pulse animation
- Countdown timer if expiry set
- Two actions: Accept Quest (primary) / Ask Parent (secondary)

### CurrencyDisplay

Renders Higg / Ginsey / Golden Higg balances using:
- Family-set custom names (from `families` table)
- The canonical Higg symbol icon: crosshatch grid inside a circle
- Colour variations per skin

### SiblingTrade

- Only visible if family `sibling_trade = true`
- Child selects sibling, enters amount, sends request
- Sibling gets in-app notification and must accept
- Parent notified of all completed trades

### CashOutCelebration

- Full-screen celebration (confetti, fireworks — skin-dependent)
- Displays real-world amount earned
- Links to tasks completed: "That's X tasks and Y quests!"
- Returns to dashboard with updated balance

---

## Higgy Bank Rules (Higgins Family Defaults)

These are seeded as the default ruleset. Parents can modify all of them during setup.

1. **No borrowing** — tasks complete = currency earned. No advances.
2. **No gaming until all daily tasks are complete** — AM and PM gates are enforced
3. **Sibling cross-trade allowed** unless it causes conflict, then parent disables it
4. **All personal screen time requires payment** — PC, Xbox, Switch, Gameboy, laptop, tablet, TV
5. **Family watching (movie nights, shared TV) is free** — by adult permission, not earnable
6. **Outside earned screen time, there is no screen time**
7. **Golden Higgs are gift-only** — from Trusted Adults, for helpfulness or good manners. Worth 2× regular coins.
8. **Family Commitment Mode** (optional toggle) — if enabled, quitting the program forfeits all saved currency. Requires explicit acknowledgement from parent AND child during setup. Off by default for new accounts.

---

## Seed Data — Higgins Canonical Configuration

### AM Routine Tasks (1 Ginsey each)

| Task | Gateway? |
|---|---|
| Make bed | No |
| Brush teeth | No |
| Tidy room | No |
| Half clean dishes away | No |
| Morning workout with trusted adult | No |
| Prepare, eat and clean own breakfast | No |
| Morning dishes washed or in machine | No |
| Shower | No |
| Uniform fully on including shoes and socks | **YES — triggers AM gate event** |

### PM Routine Tasks (1 Ginsey each)

| Task | Gateway? |
|---|---|
| Lunchboxes cleaned, uniform hung, civvies on | No |
| House and room tidy up | No |
| Homework 30 mins with trusted adult | No |
| Clean up after dinner together | No |
| Teeth brushed | **YES — triggers PM gate event** |
| Peace bonus (parent-issued, discretionary) | No |

### Bonus Tasks (seeded to bulletin board)

| Task | Reward |
|---|---|
| Vacuum lounge room fully and empty into red bin | 2 Higgs |
| Play chess together peacefully | 3 Ginseys each (both players) |
| Clean a toilet with liquid and brush, wash hands after | 1 Higg |
| Vacuum a car and wipe interior surfaces | 2 Higgs |
| Set up old tablet as wall-mounted music/audiobook player (supervised) | 4 Higgs |
| Sweep tiles and brush and pan to bin | 2 Higgs |
| De-cobweb a structure | 1 Higg |
| General peace award | 1 Higg (parent-discretionary) |

### Badges (launch set)

| Key | Trigger | Default Title |
|---|---|---|
| `first_steps` | Complete first task | First Steps |
| `keeper_of_order` | 7-day streak | Keeper of Order |
| `streak_legend` | 30-day streak | Streak Legend |
| `quest_champion` | Complete first quest | Quest Champion |
| `quest_master` | Complete 10 quests | Quest Master |
| `gift_giver` | Use Gift Window for a purchase | Gift Giver |
| `community_hero` | 3 Service Acts approved | Community Hero |
| `first_cashout` | First real-world cash out | First Cashout |
| `big_saver` | Balance reaches 100 large units | Big Saver |
| `virtue_rising` | Reach Virtue Level 5 | Virtue Rising |
| `golden_moment` | Receive first Golden Higg | Golden Moment |
| `peaceful_player` | Chess peace bonus earned 5 times | Peaceful Player |

---

## i18n Architecture

All UI strings live in `messages/{locale}.json`. Never hardcode English in any component. Currency names always come from the family's database record, never from translation files.

```json
{
  "higgy": {
    "gate_am": "Morning complete! Leisure time unlocked.",
    "gate_pm": "Evening tasks done! Screen time unlocked.",
    "task_complete": "Nice work!",
    "bonus_drop": "Lucky day! Bonus {currency} dropped!",
    "quest_arrived": "A Quest Has Arrived!",
    "cashout_title": "You earned real money!",
    "gift_received": "{giver} gifted you a {currency}!"
  },
  "badges": {
    "first_steps": { "title": "First Steps", "desc": "The journey begins." },
    "keeper_of_order": { "title": "Keeper of Order", "desc": "Seven days. Unbroken." }
  }
}
```

Launch languages: `en`, `es`, `fr`, `de`, `pt`, `ja`, `zh`

Use the Anthropic API to generate initial translations for non-English locales, then review before each language goes live. Dopamine copy (celebration messages, badge descriptions, quest language) must be culturally adapted, not merely translated.

---

## Subscription Tiers

| Tier | Price | Includes |
|---|---|---|
| Family Plan | $12–15 AUD/month | Up to 6 profiles. All life stages. Full Higgy Bank + Higgs Arcade. Groundwork Core for adults. All cognitive modes. All 10 skins. Trusted Adult invites. |
| Individual Adult | $7–9 AUD/month | Groundwork Core only. Single profile. All cognitive modes. |
| Annual (either) | 2 months free | Same features, 12-month commitment. |

Stripe Tax handles VAT/GST automatically for international customers. Funds settle in AUD to the Australian bank account.

---

## Build Sequence

Build in phases. Each phase must be working and deployable before starting the next.

### Phase 1 — Foundation (Days 1–2)
- [ ] Initialise Next.js 14 with Tailwind, Supabase, next-intl, Framer Motion, Howler.js
- [ ] Run all schema migrations in Supabase
- [ ] Auth flow: register, login, logout
- [ ] Family onboarding: family name, bank name, currency names, first parent profile
- [ ] Deploy to Vercel — confirm live URL
- [ ] All environment variables configured

### Phase 2 — Higgy Bank Core (Days 3–5)
- [ ] Child profile creation and switching
- [ ] Seed Higgins canonical tasks into the task library
- [ ] AM/PM task list UI with completion state
- [ ] TaskTapButton with animation (Cloud Kingdom skin only to start)
- [ ] GateEvent component for AM and PM completion
- [ ] Balance account updates and CurrencyDisplay
- [ ] Streak tracking

### Phase 3 — Higgs Arcade & Economy (Days 6–7)
- [ ] Screen time purchase: select duration, deduct currency, start timer
- [ ] Timer UI with overtime detection and double-rate penalty
- [ ] Daily screen time cap enforcement by day of week
- [ ] Privilege Store: parent setup and child purchase
- [ ] Quest creation, delivery, and QuestReveal component
- [ ] Bonus task bulletin: parent updates, child views and completes
- [ ] Sibling trade flow and SiblingTrade component

### Phase 4 — Trusted Adults & Golden Higg (Days 8–9)
- [ ] Trusted Adult invitation and portal
- [ ] Golden Higg gifting flow and gift reveal animation
- [ ] Cashout window configuration
- [ ] Cashout flow and CashOutCelebration component
- [ ] Gift Window mechanic (birthday percentage unlock)
- [ ] Parent approval flow for Service Acts

### Phase 5 — Dopamine Polish (Days 9–10)
- [ ] All 10 skins with CSS custom property system
- [ ] Sound packs per skin via Howler.js (placeholder sounds acceptable for MVP)
- [ ] Surprise bonus drop mechanic (~10% random on routine completion)
- [ ] Virtue level and virtue points system
- [ ] Badge award triggers and display
- [ ] Skin unlock mechanic via virtue level milestones

### Phase 6 — Groundwork Core (Days 11–13)
- [ ] Adult profile dashboard
- [ ] NaturalLanguageInput with Anthropic parse-input endpoint
- [ ] Life items list, status management, recurrence
- [ ] AI Draft Engine: prompt, generation, review, copy
- [ ] Recurring life admin template library
- [ ] Nudge display on dashboard

### Phase 7 — AI Intelligence & Email (Days 14–15)
- [ ] NudgeEngine: Supabase Edge Function, daily cron `0 9 * * *`
- [ ] WeeklyReview: Edge Function, Sunday cron `0 18 * * 0`
- [ ] Resend email integration for weekly review delivery
- [ ] All AI endpoints i18n-aware (respond in user's locale)
- [ ] Cognitive mode tone calibration tested across all five modes

### Phase 8 — Billing & i18n (Days 15–17)
- [ ] Stripe: create Family and Individual products and prices
- [ ] Stripe checkout and subscription management
- [ ] Stripe webhook handler for subscription lifecycle events
- [ ] Stripe Tax for EU VAT and Australian GST
- [ ] Feature gating behind subscription status
- [ ] Complete `en.json` translation file
- [ ] AI-generate `es.json`, `fr.json`, `de.json`, `pt.json`, `ja.json`, `zh.json`
- [ ] Locale detection on first visit, manual override in settings

### Phase 9 — Launch (Day 18+)
- [ ] Full QA: all cognitive modes, all life stages, all skins
- [ ] Privacy policy: GDPR + COPPA-aware, human-voiced
- [ ] Domain configuration (groundwork.app, higgybank.app)
- [ ] Production deploy and smoke test
- [ ] Substack announcement to warm launch audience

---

## Non-Functional Requirements

- **Performance:** Page load under 2s on 4G. Animations at 60fps. Balance updates optimistic (update UI before server confirms).
- **Security:** All Anthropic API calls server-side only. RLS enforced on all Supabase tables. No child data exposed across families. Stripe keys server-side only.
- **Accessibility:** WCAG 2.1 AA minimum. All interactive elements keyboard-navigable. Minimum tap target 44px. Screen reader tested.
- **Privacy:** No advertising. No third-party analytics on child profiles. No data sold. No marketing to children. COPPA-aware. GDPR-compliant.
- **Mobile-first:** All child-facing interfaces designed for phone first.
- **Offline resilience:** Core task logging queues offline and syncs on reconnect via service worker.
- **i18n discipline:** Zero hardcoded strings in any component. All copy via i18n keys.

---

## Cognitive Modes — Design Rules

| Mode | Rules |
|---|---|
| Standard | Clean, structured, low visual noise |
| ADHD | One task visible at a time. Immediate feedback. Short text. Visual timers. Optional body-doubling prompt. |
| Autism | Identical layout on every screen. Literal language only — no idioms. Full sensory controls (sound off, motion off, low-stimulation palette). |
| Dyslexia | OpenDyslexic font. Generous line spacing. Chunked text. Audio readback available. |
| Calm | Reduced task volume. Gentler AI tone. No shame mechanics. Always gives permission to do less. |

User can change mode at any time. System may suggest a mode shift based on usage patterns but never imposes one.

---

## Trusted Adult Role

A Trusted Adult (grandparent, aunt/uncle, family friend, coach) can:
- Gift Golden Higgs to any child in the family
- Issue Quests (with parent notification)
- View a child's balance and recent activity
- Add Bonus Tasks to the bulletin (with parent approval)

A Trusted Adult cannot: set daily tasks, modify rules, access billing, or see parent-level information.

Invited by parent via email link. Separate login from parent account.

---

*Build Groundwork. Start with Phase 1.*
