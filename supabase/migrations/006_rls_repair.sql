-- ═══════════════════════════════════════════════════════════════════
-- KEMPT — MIGRATION 006
-- Adds the `teen` life stage and repairs the row-level security
-- policies that silently blocked writes.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1. HELPERS
--    SECURITY DEFINER so policies can look up family membership
--    without re-triggering the policy on family_members itself.
-- ──────────────────────────────────────────────────────────────────

create or replace function get_my_family_id()
returns uuid language sql security definer stable
set search_path = public
as $$
  select family_id from family_members where user_id = auth.uid() limit 1;
$$;

-- True when the caller is a parent/admin of the given family.
create or replace function is_family_parent(p_family_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from family_members
    where user_id = auth.uid()
      and family_id = p_family_id
      and role in ('parent', 'admin')
  );
$$;

-- The profile row belonging to the signed-in user.
create or replace function my_profile_id()
returns uuid language sql security definer stable
set search_path = public
as $$
  select id from profiles where user_id = auth.uid() limit 1;
$$;

-- ──────────────────────────────────────────────────────────────────
-- 2. TEEN LIFE STAGE
--    The original CHECK constraint had no 'teen', so inserting one
--    failed even once RLS allowed it.
-- ──────────────────────────────────────────────────────────────────

alter table profiles drop constraint if exists profiles_life_stage_check;
alter table profiles add constraint profiles_life_stage_check
  check (life_stage in ('little', 'young', 'teen', 'adult', 'elder'));

-- ──────────────────────────────────────────────────────────────────
-- 3. FAMILIES
-- ──────────────────────────────────────────────────────────────────

alter table families add column if not exists
  created_by uuid references auth.users(id) default auth.uid();

drop policy if exists "Family members can read own family" on families;
create policy "Family members can read own family" on families
  for select using (created_by = auth.uid() or id = get_my_family_id());

drop policy if exists "Authenticated users can create family" on families;
create policy "Authenticated users can create family" on families
  for insert with check (auth.uid() is not null);

drop policy if exists "Parents can update own family" on families;
create policy "Parents can update own family" on families
  for update using (is_family_parent(id)) with check (is_family_parent(id));

-- ──────────────────────────────────────────────────────────────────
-- 4. PROFILES
--    Two bugs fixed here:
--
--    a) Child profiles have user_id = NULL, but the insert policy
--       required user_id = auth.uid(). Adding a child always failed
--       with "new row violates row-level security policy".
--
--    b) The update policy was also user_id = auth.uid(), so awarding
--       virtue points or changing a child's theme matched zero rows
--       and failed silently — children never levelled up.
-- ──────────────────────────────────────────────────────────────────

drop policy if exists "Family members can read profiles" on profiles;
create policy "Family members can read profiles" on profiles
  for select using (
    user_id = auth.uid()
    or family_id = get_my_family_id()
  );

drop policy if exists "Users can create their own profile" on profiles;
create policy "Users can create their own profile" on profiles
  for insert with check (
    -- your own profile, during onboarding or when accepting an invite
    user_id = auth.uid()
    -- or a child/teen profile inside a family you parent
    or (user_id is null and is_family_parent(family_id))
  );

drop policy if exists "Own profile update" on profiles;
create policy "Own profile update" on profiles
  for update using (
    user_id = auth.uid()
    or (family_id = get_my_family_id() and user_id is null)
  ) with check (
    user_id = auth.uid()
    or (family_id = get_my_family_id() and user_id is null)
  );

drop policy if exists "Parents can remove child profiles" on profiles;
create policy "Parents can remove child profiles" on profiles
  for delete using (user_id is null and is_family_parent(family_id));

-- ──────────────────────────────────────────────────────────────────
-- 5. FAMILY MEMBERS
--    The original select policy queried family_members from inside
--    its own policy, which Postgres rejects as infinite recursion.
-- ──────────────────────────────────────────────────────────────────

drop policy if exists "Own family members visible" on family_members;
create policy "Own family members visible" on family_members
  for select using (user_id = auth.uid() or family_id = get_my_family_id());

drop policy if exists "Users can join a family" on family_members;
create policy "Users can join a family" on family_members
  for insert with check (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────
-- 6. FAMILY-SCOPED TABLES
--    `for all` needs an explicit WITH CHECK, otherwise inserts are
--    validated against USING and the intent is easy to misread.
-- ──────────────────────────────────────────────────────────────────

drop policy if exists "Own family balances" on balance_accounts;
create policy "Own family balances" on balance_accounts
  for all
  using      (profile_id in (select id from profiles where family_id = get_my_family_id()))
  with check (profile_id in (select id from profiles where family_id = get_my_family_id()));

drop policy if exists "Own family completions" on task_completions;
create policy "Own family completions" on task_completions
  for all
  using      (profile_id in (select id from profiles where family_id = get_my_family_id()))
  with check (profile_id in (select id from profiles where family_id = get_my_family_id()));

drop policy if exists "Own family transactions" on transactions;
create policy "Own family transactions" on transactions
  for all
  using      (profile_id in (select id from profiles where family_id = get_my_family_id()))
  with check (profile_id in (select id from profiles where family_id = get_my_family_id()));

drop policy if exists "Own family streaks" on streaks;
create policy "Own family streaks" on streaks
  for all
  using      (profile_id in (select id from profiles where family_id = get_my_family_id()))
  with check (profile_id in (select id from profiles where family_id = get_my_family_id()));

drop policy if exists "Own family profile badges" on profile_badges;
create policy "Own family profile badges" on profile_badges
  for all
  using      (profile_id in (select id from profiles where family_id = get_my_family_id()))
  with check (profile_id in (select id from profiles where family_id = get_my_family_id()));

drop policy if exists "Own family screen time" on screen_time_sessions;
create policy "Own family screen time" on screen_time_sessions
  for all
  using      (profile_id in (select id from profiles where family_id = get_my_family_id()))
  with check (profile_id in (select id from profiles where family_id = get_my_family_id()));

drop policy if exists "Own family cashout requests" on cashout_requests;
create policy "Own family cashout requests" on cashout_requests
  for all
  using      (profile_id in (select id from profiles where family_id = get_my_family_id()))
  with check (profile_id in (select id from profiles where family_id = get_my_family_id()));

-- ──────────────────────────────────────────────────────────────────
-- 7. SIBLING TRADES
--    The old policy only matched from_profile, so the person a trade
--    was sent TO could not see it and "accept" always reported
--    "trade not found".
-- ──────────────────────────────────────────────────────────────────

drop policy if exists "Own family trades" on sibling_trades;
create policy "Own family trades" on sibling_trades
  for all
  using (
    from_profile in (select id from profiles where family_id = get_my_family_id())
    or to_profile in (select id from profiles where family_id = get_my_family_id())
  )
  with check (
    from_profile in (select id from profiles where family_id = get_my_family_id())
    and to_profile in (select id from profiles where family_id = get_my_family_id())
  );

-- ──────────────────────────────────────────────────────────────────
-- 8. TASKS
-- ──────────────────────────────────────────────────────────────────

drop policy if exists "Own family tasks" on tasks;
create policy "Own family tasks" on tasks
  for select using (family_id = get_my_family_id());

drop policy if exists "Parents manage tasks" on tasks;
create policy "Parents manage tasks" on tasks
  for all
  using      (is_family_parent(family_id))
  with check (is_family_parent(family_id));

-- Children need to claim an unassigned quest, which is an UPDATE.
drop policy if exists "Family can claim quests" on tasks;
create policy "Family can claim quests" on tasks
  for update
  using      (family_id = get_my_family_id() and category = 'quest')
  with check (family_id = get_my_family_id() and category = 'quest');

-- ──────────────────────────────────────────────────────────────────
-- 9. PERSONAL TABLES
--    Scoped to the signed-in user's own profile, plus any child
--    profile in the family so parents can manage on their behalf.
-- ──────────────────────────────────────────────────────────────────

drop policy if exists "Own profile life items" on life_items;
create policy "Own profile life items" on life_items
  for all
  using      (profile_id in (select id from profiles where user_id = auth.uid() or (family_id = get_my_family_id() and user_id is null)))
  with check (profile_id in (select id from profiles where user_id = auth.uid() or (family_id = get_my_family_id() and user_id is null)));

drop policy if exists "Own profile nudges" on nudges;
create policy "Own profile nudges" on nudges
  for all
  using      (profile_id in (select id from profiles where user_id = auth.uid() or (family_id = get_my_family_id() and user_id is null)))
  with check (profile_id in (select id from profiles where user_id = auth.uid() or (family_id = get_my_family_id() and user_id is null)));

drop policy if exists "Own profile drafts" on drafts;
create policy "Own profile drafts" on drafts
  for all
  using      (profile_id in (select id from profiles where user_id = auth.uid()))
  with check (profile_id in (select id from profiles where user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────
-- 10. PARENT-MANAGED TABLES
-- ──────────────────────────────────────────────────────────────────

drop policy if exists "Own family privileges" on privileges;
create policy "Own family privileges" on privileges
  for select using (family_id = get_my_family_id());

drop policy if exists "Parents manage privileges" on privileges;
create policy "Parents manage privileges" on privileges
  for all
  using      (is_family_parent(family_id))
  with check (is_family_parent(family_id));

drop policy if exists "Own family cashout windows" on cashout_windows;
create policy "Own family cashout windows" on cashout_windows
  for select using (family_id = get_my_family_id());

drop policy if exists "Parents manage cashout windows" on cashout_windows;
create policy "Parents manage cashout windows" on cashout_windows
  for all
  using      (is_family_parent(family_id))
  with check (is_family_parent(family_id));

drop policy if exists "Parents can manage invitations" on trusted_invitations;
create policy "Parents can manage invitations" on trusted_invitations
  for all
  using      (is_family_parent(family_id))
  with check (is_family_parent(family_id));

drop policy if exists "Own family subscriptions" on subscriptions;
create policy "Own family subscriptions" on subscriptions
  for select using (is_family_parent(family_id));

-- ──────────────────────────────────────────────────────────────────
-- 11. HARDEN adjust_balance
--     It is SECURITY DEFINER, so without an explicit membership check
--     any signed-in user could credit any profile by id.
-- ──────────────────────────────────────────────────────────────────

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
set search_path = public
as $$
declare
  v_rows integer;
  v_allowed boolean;
begin
  -- Caller must share a family with the target profile.
  select exists (
    select 1
    from profiles p
    join family_members fm on fm.family_id = p.family_id
    where p.id = p_profile_id
      and fm.user_id = auth.uid()
  ) into v_allowed;

  if not v_allowed then
    return false;
  end if;

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

-- ──────────────────────────────────────────────────────────────────
-- 12. BACKFILL
--     Existing profiles created before balance seeding have no
--     balance_accounts / streaks row, so the bank reads as empty and
--     adjust_balance silently updates nothing.
-- ──────────────────────────────────────────────────────────────────

insert into balance_accounts (profile_id)
select p.id from profiles p
left join balance_accounts b on b.profile_id = p.id
where b.profile_id is null;

insert into streaks (profile_id)
select p.id from profiles p
left join streaks s on s.profile_id = p.id
where s.profile_id is null;

-- ──────────────────────────────────────────────────────────────────
-- 13. INDEXES
--     These columns are filtered on every page load.
-- ──────────────────────────────────────────────────────────────────

create index if not exists idx_profiles_family        on profiles(family_id);
create index if not exists idx_profiles_user          on profiles(user_id);
create index if not exists idx_family_members_user    on family_members(user_id);
create index if not exists idx_tasks_family_active    on tasks(family_id, active);
create index if not exists idx_completions_profile    on task_completions(profile_id, completed_at desc);
create index if not exists idx_completions_task       on task_completions(task_id);
create index if not exists idx_transactions_profile   on transactions(profile_id, created_at desc);
create index if not exists idx_life_items_profile     on life_items(profile_id, status);
create index if not exists idx_trades_to_profile      on sibling_trades(to_profile, status);
create index if not exists idx_screen_time_profile    on screen_time_sessions(profile_id, started_at desc);
create index if not exists idx_nudges_profile         on nudges(profile_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════
-- Done.
-- ═══════════════════════════════════════════════════════════════════
