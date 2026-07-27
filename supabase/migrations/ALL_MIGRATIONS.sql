-- ═══════════════════════════════════════════════════════════════════
-- GROUNDWORK — COMPLETE DATABASE SETUP
-- Paste this entire file into Supabase SQL Editor and run it once.
-- If you have already run individual migration files, run 004 only.
-- ═══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 001 — INITIAL SCHEMA
-- ──────────────────────────────────────────────

-- FAMILIES & PROFILES

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
    check (life_stage in ('little','young','teen','adult','elder')),
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

-- HIGGY BANK ECONOMY

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

-- GROUNDWORK CORE

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

-- SUBSCRIPTIONS

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

-- ROW LEVEL SECURITY

-- Helper: SECURITY DEFINER breaks recursion — all policies use this instead of
-- querying family_members directly (which would re-trigger its own RLS policy).
create or replace function get_my_family_id()
returns uuid language sql security definer stable as $$
  select family_id from family_members where user_id = auth.uid() limit 1;
$$;

-- FAMILIES
-- created_by lets the creator SELECT their new family before joining family_members
alter table families add column if not exists
  created_by uuid references auth.users(id) default auth.uid();

alter table families enable row level security;
create policy "Family members can read own family" on families
  for select using (created_by = auth.uid() or id = get_my_family_id());
create policy "Authenticated users can create family" on families
  for insert with check (auth.uid() is not null);
create policy "Parents can update own family" on families
  for update using (
    id in (
      select family_id from family_members
      where user_id = auth.uid() and role in ('parent','admin')
    )
  );

-- PROFILES
alter table profiles enable row level security;
create policy "Family members can read profiles" on profiles
  for select using (user_id = auth.uid() or family_id = get_my_family_id());
create policy "Users can create their own profile" on profiles
  for insert with check (user_id = auth.uid());
create policy "Own profile update" on profiles
  for update using (user_id = auth.uid());

-- FAMILY_MEMBERS
alter table family_members enable row level security;
create policy "Own family members visible" on family_members
  for select using (user_id = auth.uid() or family_id = get_my_family_id());
create policy "Users can join a family" on family_members
  for insert with check (user_id = auth.uid());

-- BALANCE ACCOUNTS
alter table balance_accounts enable row level security;
create policy "Own family balances" on balance_accounts
  for all using (
    profile_id in (select id from profiles where family_id = get_my_family_id())
  );

-- TASKS
alter table tasks enable row level security;
create policy "Own family tasks" on tasks
  for select using (family_id = get_my_family_id());
create policy "Parents manage tasks" on tasks
  for all using (
    family_id in (
      select family_id from family_members
      where user_id = auth.uid() and role in ('parent','admin')
    )
  );

-- TASK COMPLETIONS
alter table task_completions enable row level security;
create policy "Own family completions" on task_completions
  for all using (
    profile_id in (select id from profiles where family_id = get_my_family_id())
  );

-- TRANSACTIONS (all operations — inserts happen client-side on earn/spend)
alter table transactions enable row level security;
create policy "Own family transactions" on transactions
  for all using (
    profile_id in (select id from profiles where family_id = get_my_family_id())
  );

-- STREAKS
alter table streaks enable row level security;
create policy "Own family streaks" on streaks
  for all using (
    profile_id in (select id from profiles where family_id = get_my_family_id())
  );

-- SIBLING TRADES
alter table sibling_trades enable row level security;
create policy "Own family trades" on sibling_trades
  for all using (
    from_profile in (select id from profiles where family_id = get_my_family_id())
  );

-- BADGES
alter table badges enable row level security;
create policy "Badges readable by all authenticated" on badges
  for select using (auth.uid() is not null);

-- PROFILE BADGES
alter table profile_badges enable row level security;
create policy "Own family profile badges" on profile_badges
  for all using (
    profile_id in (select id from profiles where family_id = get_my_family_id())
  );

-- LIFE ITEMS
alter table life_items enable row level security;
create policy "Own profile life items" on life_items
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

-- NUDGES
alter table nudges enable row level security;
create policy "Own profile nudges" on nudges
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

-- DRAFTS
alter table drafts enable row level security;
create policy "Own profile drafts" on drafts
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  );

-- SUBSCRIPTIONS
alter table subscriptions enable row level security;
create policy "Own family subscriptions" on subscriptions
  for select using (
    family_id in (
      select family_id from family_members
      where user_id = auth.uid() and role in ('parent','admin')
    )
  );

-- PRIVILEGES
alter table privileges enable row level security;
create policy "Own family privileges" on privileges
  for all using (family_id = get_my_family_id());

-- CASHOUT WINDOWS
alter table cashout_windows enable row level security;
create policy "Own family cashout windows" on cashout_windows
  for all using (family_id = get_my_family_id());

-- SCREEN TIME SESSIONS
alter table screen_time_sessions enable row level security;
create policy "Own family screen time" on screen_time_sessions
  for all using (
    profile_id in (select id from profiles where family_id = get_my_family_id())
  );

-- SEED DATA — BADGES

insert into badges (key, title_key, desc_key, icon) values
  ('first_steps',      'badges.first_steps.title',      'badges.first_steps.desc',      '👟'),
  ('keeper_of_order',  'badges.keeper_of_order.title',  'badges.keeper_of_order.desc',  '🏅'),
  ('streak_legend',    'badges.streak_legend.title',    'badges.streak_legend.desc',    '🔥'),
  ('quest_champion',   'badges.quest_champion.title',   'badges.quest_champion.desc',   '⚔️'),
  ('quest_master',     'badges.quest_master.title',     'badges.quest_master.desc',     '👑'),
  ('gift_giver',       'badges.gift_giver.title',       'badges.gift_giver.desc',       '🎁'),
  ('community_hero',   'badges.community_hero.title',   'badges.community_hero.desc',   '🦸'),
  ('first_cashout',    'badges.first_cashout.title',    'badges.first_cashout.desc',    '💰'),
  ('big_saver',        'badges.big_saver.title',        'badges.big_saver.desc',        '🏦'),
  ('virtue_rising',    'badges.virtue_rising.title',    'badges.virtue_rising.desc',    '⭐'),
  ('golden_moment',    'badges.golden_moment.title',    'badges.golden_moment.desc',    '✨'),
  ('peaceful_player',  'badges.peaceful_player.title',  'badges.peaceful_player.desc',  '♟️');

-- ──────────────────────────────────────────────
-- 002 — SEED FUNCTION
-- ──────────────────────────────────────────────

create or replace function seed_higgins_tasks(
  p_family_id uuid,
  p_created_by uuid
) returns void language plpgsql security definer as $$
begin
  -- AM Routine Tasks
  insert into tasks (family_id, created_by, title, category, time_block, reward_type, reward_small, is_recurring, recurrence_days, is_gateway, sort_order) values
    (p_family_id, p_created_by, 'Make bed',                                           'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 10),
    (p_family_id, p_created_by, 'Brush teeth',                                        'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 20),
    (p_family_id, p_created_by, 'Tidy room',                                          'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 30),
    (p_family_id, p_created_by, 'Half clean dishes away',                             'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 40),
    (p_family_id, p_created_by, 'Morning workout with trusted adult',                 'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 50),
    (p_family_id, p_created_by, 'Prepare, eat and clean own breakfast',               'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 60),
    (p_family_id, p_created_by, 'Morning dishes washed or in machine',                'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 70),
    (p_family_id, p_created_by, 'Shower',                                             'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 80),
    (p_family_id, p_created_by, 'Uniform fully on including shoes and socks',         'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', true,  90);

  -- PM Routine Tasks
  insert into tasks (family_id, created_by, title, category, time_block, reward_type, reward_small, is_recurring, recurrence_days, is_gateway, sort_order) values
    (p_family_id, p_created_by, 'Lunchboxes cleaned, uniform hung, civvies on',       'routine', 'pm', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 10),
    (p_family_id, p_created_by, 'House and room tidy up',                             'routine', 'pm', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 20),
    (p_family_id, p_created_by, 'Homework 30 mins with trusted adult',                'routine', 'pm', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 30),
    (p_family_id, p_created_by, 'Clean up after dinner together',                     'routine', 'pm', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 40),
    (p_family_id, p_created_by, 'Teeth brushed',                                      'routine', 'pm', 'small', 1, true, '{1,2,3,4,5,6,7}', true,  50),
    (p_family_id, p_created_by, 'Peace bonus',                                        'routine', 'pm', 'small', 1, false, '{1,2,3,4,5,6,7}', false, 60);

  -- Bonus Tasks
  insert into tasks (family_id, created_by, title, category, time_block, reward_type, reward_small, reward_large, is_recurring, recurrence_days, sort_order) values
    (p_family_id, p_created_by, 'Vacuum lounge room fully and empty into red bin',                      'bonus', 'any', 'large', 0, 2, false, '{1,2,3,4,5,6,7}', 10),
    (p_family_id, p_created_by, 'Play chess together peacefully',                                       'bonus', 'any', 'small', 3, 0, false, '{1,2,3,4,5,6,7}', 20),
    (p_family_id, p_created_by, 'Clean a toilet with liquid and brush, wash hands after',               'bonus', 'any', 'large', 0, 1, false, '{1,2,3,4,5,6,7}', 30),
    (p_family_id, p_created_by, 'Vacuum a car and wipe interior surfaces',                              'bonus', 'any', 'large', 0, 2, false, '{1,2,3,4,5,6,7}', 40),
    (p_family_id, p_created_by, 'Set up old tablet as wall-mounted music/audiobook player (supervised)','bonus', 'any', 'large', 0, 4, false, '{1,2,3,4,5,6,7}', 50),
    (p_family_id, p_created_by, 'Sweep tiles and brush and pan to bin',                                 'bonus', 'any', 'large', 0, 2, false, '{1,2,3,4,5,6,7}', 60),
    (p_family_id, p_created_by, 'De-cobweb a structure',                                                'bonus', 'any', 'large', 0, 1, false, '{1,2,3,4,5,6,7}', 70),
    (p_family_id, p_created_by, 'General peace award',                                                  'bonus', 'any', 'large', 0, 1, false, '{1,2,3,4,5,6,7}', 80);
end;
$$;

-- ──────────────────────────────────────────────
-- 003 — TRUSTED INVITATIONS & CASHOUT REQUESTS
-- ──────────────────────────────────────────────

create table trusted_invitations (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid references families not null,
  email      text not null,
  token      text unique not null default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '7 days',
  used       boolean default false
);

alter table trusted_invitations enable row level security;
create policy "Parents can manage invitations" on trusted_invitations
  for all using (
    family_id in (
      select family_id from family_members
      where user_id = auth.uid() and role in ('parent','admin')
    )
  );

create table cashout_requests (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references profiles not null,
  large_amount  integer not null default 0,
  golden_amount integer not null default 0,
  cash_value    numeric not null,
  status        text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  window_id     uuid references cashout_windows,
  approved_by   uuid references profiles,
  approved_at   timestamptz,
  created_at    timestamptz default now()
);

alter table cashout_requests enable row level security;
create policy "Own family cashout requests" on cashout_requests
  for all using (
    profile_id in (select id from profiles where family_id = get_my_family_id())
  );

-- 005 — ATOMIC BALANCE ADJUSTMENTS
create or replace function adjust_balance(
  p_profile_id            uuid,
  p_small_delta           integer default 0,
  p_large_delta           integer default 0,
  p_golden_delta          integer default 0,
  p_lifetime_large_delta  integer default 0,
  p_lifetime_golden_delta integer default 0
) returns boolean
language plpgsql
security definer
as $$
declare
  v_rows integer;
begin
  update balance_accounts set
    small_balance   = small_balance   + p_small_delta,
    large_balance   = large_balance   + p_large_delta,
    golden_balance  = golden_balance  + p_golden_delta,
    lifetime_large  = lifetime_large  + greatest(0, p_lifetime_large_delta),
    lifetime_golden = lifetime_golden + greatest(0, p_lifetime_golden_delta),
    updated_at      = now()
  where profile_id = p_profile_id
    and (small_balance  + p_small_delta)  >= 0
    and (large_balance  + p_large_delta)  >= 0
    and (golden_balance + p_golden_delta) >= 0;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
