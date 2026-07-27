// End-to-end RLS and data-flow test against the live Supabase project.
//
//   node scripts/test-rls.mjs
//
// Uses the anon key exactly as the browser does, so row-level security
// applies. Creates a throwaway family, exercises the full
// signup -> onboarding -> child -> task -> trade flow, checks
// cross-family isolation, then deletes everything it created using the
// service role.
//
// Reads credentials from .env.local. Safe to run against production.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const URL  = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC  = env.SUPABASE_SERVICE_ROLE_KEY;

const pass = [], fail = [];
const ok  = (n, d = '') => { pass.push(n); console.log(`  PASS  ${n}${d ? ' — ' + d : ''}`); };
const bad = (n, e) => { fail.push(n); console.log(`  FAIL  ${n} — ${e}`); };

const stamp = Date.now();
const email = `kempt-test-${stamp}@example.com`;
const pw    = `Test-${stamp}-Aa1!`;

console.log(`\nProject: ${URL}`);
console.log(`Test user: ${email}\n`);

const anon = createClient(URL, ANON);
const svc  = SVC ? createClient(URL, SVC, { auth: { persistSession: false } }) : null;

let userId, familyId, profileId, childId;

// ── 1. SIGN UP ────────────────────────────────────────────────────
console.log('1. AUTH');
const { data: signUp, error: signUpErr } = await anon.auth.signUp({ email, password: pw });
if (signUpErr) { bad('sign up', signUpErr.message); }
else if (!signUp.session) { bad('sign up', 'no session returned (email confirmation still on?)'); }
else { userId = signUp.user.id; ok('sign up returns an active session'); }

if (!userId) {
  console.log('\nCannot continue without a session.');
  process.exit(1);
}

// ── 2. ONBOARDING ─────────────────────────────────────────────────
console.log('\n2. ONBOARDING');
const { data: fam, error: famErr } = await anon.from('families').insert({
  name: 'Test Family', bank_name: 'Test Bank',
  large_coin_name: 'Higg', small_coin_name: 'Ginsey', golden_coin_name: 'Golden Higg',
}).select().single();
if (famErr) bad('insert family', famErr.message);
else { familyId = fam.id; ok('insert family'); }

if (familyId) {
  const { data: prof, error: profErr } = await anon.from('profiles').insert({
    user_id: userId, family_id: familyId, display_name: 'Test Parent',
    life_stage: 'adult', role: 'parent', locale: 'en',
  }).select().single();
  if (profErr) bad('insert own profile', profErr.message);
  else { profileId = prof.id; ok('insert own profile'); }
}

if (profileId) {
  const { error: memErr } = await anon.from('family_members').insert({
    family_id: familyId, user_id: userId, profile_id: profileId, role: 'parent',
  });
  memErr ? bad('insert family_members', memErr.message) : ok('insert family_members');

  const { error: balErr } = await anon.from('balance_accounts').insert({ profile_id: profileId });
  balErr ? bad('insert balance_accounts', balErr.message) : ok('insert balance_accounts');

  const { error: strErr } = await anon.from('streaks').insert({ profile_id: profileId });
  strErr ? bad('insert streaks', strErr.message) : ok('insert streaks');

  const { error: seedErr } = await anon.rpc('seed_higgins_tasks', {
    p_family_id: familyId, p_created_by: profileId,
  });
  seedErr ? bad('seed_higgins_tasks rpc', seedErr.message) : ok('seed_higgins_tasks rpc');
}

// ── 3. READ-BACK (the recursion / visibility checks) ───────────────
console.log('\n3. READS');
const { data: readFam, error: readFamErr } = await anon.from('families').select('*').eq('id', familyId).maybeSingle();
readFamErr ? bad('read own family', readFamErr.message)
  : readFam ? ok('read own family') : bad('read own family', 'returned null');

const { data: readMem, error: readMemErr } = await anon.from('family_members').select('*');
readMemErr ? bad('read family_members (recursion check)', readMemErr.message)
  : ok('read family_members (recursion check)', `${readMem.length} row(s)`);

const { data: readTasks, error: readTasksErr } = await anon.from('tasks').select('id, title, time_block, category').eq('family_id', familyId);
readTasksErr ? bad('read seeded tasks', readTasksErr.message)
  : ok('read seeded tasks', `${readTasks.length} task(s)`);

const { data: badges, error: badgeErr } = await anon.from('badges').select('key');
badgeErr ? bad('read badges', badgeErr.message) : ok('read badges', `${badges.length}`);

// ── 4. CHILD PROFILE (the reported bug) ───────────────────────────
console.log('\n4. ADD CHILD  (user_id is null — the failing case)');
const { data: child, error: childErr } = await anon.from('profiles').insert({
  family_id: familyId, display_name: 'Test Child',
  life_stage: 'young', role: 'child', skin: 'cloud_kingdom', locale: 'en',
}).select().single();
if (childErr) bad('insert child profile', childErr.message);
else { childId = child.id; ok('insert child profile'); }

if (childId) {
  const { error: cbErr } = await anon.from('balance_accounts').insert({ profile_id: childId });
  cbErr ? bad('insert child balance', cbErr.message) : ok('insert child balance');
  const { error: csErr } = await anon.from('streaks').insert({ profile_id: childId });
  csErr ? bad('insert child streak', csErr.message) : ok('insert child streak');
}

// ── 5. TEEN STAGE ─────────────────────────────────────────────────
console.log('\n5. TEEN LIFE STAGE');
const { data: teen, error: teenErr } = await anon.from('profiles').insert({
  family_id: familyId, display_name: 'Test Teen',
  life_stage: 'teen', role: 'child', skin: 'cloud_kingdom', locale: 'en',
}).select().single();
teenErr ? bad('insert teen profile', teenErr.message) : ok('insert teen profile');

// ── 6. COMPLETE A TASK ────────────────────────────────────────────
console.log('\n6. TASK COMPLETION + BALANCE');
if (childId && readTasks?.length) {
  const task = readTasks.find(t => t.category === 'routine') ?? readTasks[0];

  const { error: tcErr } = await anon.from('task_completions').insert({
    task_id: task.id, profile_id: childId,
    reward_small: 1, reward_large: 0, reward_golden: 0,
  });
  tcErr ? bad('insert task_completion', tcErr.message) : ok('insert task_completion');

  const { data: adjusted, error: adjErr } = await anon.rpc('adjust_balance', {
    p_profile_id: childId, p_small_delta: 1,
    p_large_delta: 0, p_golden_delta: 0,
    p_lifetime_large_delta: 0, p_lifetime_golden_delta: 0,
  });
  adjErr ? bad('adjust_balance rpc', adjErr.message)
    : adjusted ? ok('adjust_balance rpc credits') : bad('adjust_balance rpc', 'returned false');

  const { data: bal } = await anon.from('balance_accounts').select('*').eq('profile_id', childId).maybeSingle();
  bal?.small_balance === 1 ? ok('balance reflects credit', `small=${bal.small_balance}`)
    : bad('balance reflects credit', `expected 1, got ${bal?.small_balance}`);

  // Overdraw must be refused
  const { data: overdrawn } = await anon.rpc('adjust_balance', {
    p_profile_id: childId, p_small_delta: -999,
    p_large_delta: 0, p_golden_delta: 0,
    p_lifetime_large_delta: 0, p_lifetime_golden_delta: 0,
  });
  overdrawn === false ? ok('adjust_balance refuses overdraw')
    : bad('adjust_balance refuses overdraw', `returned ${overdrawn}`);

  const { error: txErr } = await anon.from('transactions').insert({
    profile_id: childId, type: 'earn_small', small_delta: 1,
    description: 'test', reference_id: task.id,
  });
  txErr ? bad('insert transaction', txErr.message) : ok('insert transaction');
}

// ── 7. BADGES / VIRTUE ────────────────────────────────────────────
console.log('\n7. BADGES + VIRTUE');
if (childId) {
  const { data: b } = await anon.from('badges').select('id, key').eq('key', 'first_steps').maybeSingle();
  if (b) {
    const { error: pbErr } = await anon.from('profile_badges').insert({ profile_id: childId, badge_id: b.id });
    pbErr ? bad('insert profile_badge', pbErr.message) : ok('insert profile_badge');
    const { error: pbSelErr } = await anon.from('profile_badges').select('badge_id').eq('profile_id', childId);
    pbSelErr ? bad('read profile_badges', pbSelErr.message) : ok('read profile_badges');
  }
  const { error: vErr } = await anon.from('profiles')
    .update({ virtue_points: 42, virtue_level: 2 }).eq('id', childId);
  if (vErr) bad('child virtue points persist', vErr.message);
  else {
    const { data: vp } = await anon.from('profiles')
      .select('virtue_points').eq('id', childId).maybeSingle();
    vp?.virtue_points === 42
      ? ok('child virtue points persist')
      : bad('child virtue points persist', `expected 42, got ${vp?.virtue_points} (matched 0 rows)`);
  }

  const { error: skErr } = await anon.from('profiles')
    .update({ skin: 'deep_ocean' }).eq('id', childId);
  if (skErr) bad('child skin change persists', skErr.message);
  else {
    const { data: sk } = await anon.from('profiles')
      .select('skin').eq('id', childId).maybeSingle();
    sk?.skin === 'deep_ocean' ? ok('child skin change persists')
      : bad('child skin change persists', `got ${sk?.skin}`);
  }

  // The join used by checkBadges / awardQuestBadges
  const { error: joinErr } = await anon.from('task_completions')
    .select('id, tasks!inner(category)', { count: 'exact', head: true })
    .eq('profile_id', childId).eq('tasks.category', 'quest');
  joinErr ? bad('task_completions -> tasks category join', joinErr.message)
    : ok('task_completions -> tasks category join');
}

// ── 8. LIFE ITEMS / KEMPT CORE ────────────────────────────────────
console.log('\n8. LIFE ITEMS');
if (profileId) {
  const { data: li, error: liErr } = await anon.from('life_items')
    .insert({ profile_id: profileId, title: 'Test item', category: 'admin' })
    .select().single();
  liErr ? bad('insert life_item', liErr.message) : ok('insert life_item');
  if (li) {
    const { error: luErr } = await anon.from('life_items').update({ status: 'done' }).eq('id', li.id);
    luErr ? bad('update life_item', luErr.message) : ok('update life_item');
  }
  const { error: dErr } = await anon.from('drafts')
    .insert({ profile_id: profileId, prompt: 'p', content: 'c', type: 'email', status: 'draft' });
  dErr ? bad('insert draft', dErr.message) : ok('insert draft');
}


// ── 8b. SIBLING TRADE ROUND TRIP ─────────────────────────────────
console.log('\n8b. SIBLING TRADE');
if (childId && teen?.id) {
  const { data: trade, error: trErr } = await anon.from('sibling_trades').insert({
    from_profile: childId, to_profile: teen.id,
    large_amount: 0, small_amount: 1, status: 'pending',
  }).select().single();
  trErr ? bad('insert sibling trade', trErr.message) : ok('insert sibling trade');

  if (trade) {
    // The recipient side is exactly what the old policy could not see.
    const { data: incoming } = await anon.from('sibling_trades')
      .select('id').eq('to_profile', teen.id).eq('status', 'pending');
    (incoming?.length ?? 0) > 0
      ? ok('recipient can see incoming trade')
      : bad('recipient can see incoming trade', 'policy only covers from_profile');

    const { data: upd } = await anon.from('sibling_trades')
      .update({ status: 'accepted' }).eq('id', trade.id).eq('status', 'pending').select('id');
    (upd?.length ?? 0) > 0
      ? ok('recipient can accept trade')
      : bad('recipient can accept trade', 'update matched 0 rows');
  }
} else {
  console.log('  SKIP  (needs two child profiles)');
}

// ── 9. ISOLATION: another family must be invisible ────────────────
console.log('\n9. CROSS-FAMILY ISOLATION');
{
  const other = createClient(URL, ANON);
  const e2 = `kempt-other-${stamp}@example.com`;
  const { data: su2 } = await other.auth.signUp({ email: e2, password: pw });
  if (su2?.session) {
    const { data: seen } = await other.from('families').select('id').eq('id', familyId);
    (seen?.length ?? 0) === 0 ? ok('outsider cannot read our family')
      : bad('outsider cannot read our family', `saw ${seen.length} row(s)`);

    const { data: seenTasks } = await other.from('tasks').select('id').eq('family_id', familyId);
    (seenTasks?.length ?? 0) === 0 ? ok('outsider cannot read our tasks')
      : bad('outsider cannot read our tasks', `saw ${seenTasks.length}`);

    if (!childId) {
      console.log('  SKIP  adjust_balance cross-family check (no child profile)');
    } else {
      const { data: before } = await svc.from('balance_accounts')
        .select('small_balance').eq('profile_id', childId).maybeSingle();
      const { data: stolen } = await other.rpc('adjust_balance', {
        p_profile_id: childId, p_small_delta: 500,
        p_large_delta: 0, p_golden_delta: 0,
        p_lifetime_large_delta: 0, p_lifetime_golden_delta: 0,
      });
      const { data: after } = await svc.from('balance_accounts')
        .select('small_balance').eq('profile_id', childId).maybeSingle();
      const moved = (after?.small_balance ?? 0) !== (before?.small_balance ?? 0);
      (stolen === true || moved)
        ? bad('outsider cannot credit our child', 'adjust_balance is callable cross-family')
        : ok('outsider cannot credit our child');
    }

    if (svc) await svc.auth.admin.deleteUser(su2.user.id).catch(() => {});
  } else {
    console.log('  SKIP  outsider checks (no session)');
  }
}

// ── CLEANUP ───────────────────────────────────────────────────────
if (svc && familyId) {
  const ids = [childId, profileId, teen?.id].filter(Boolean);
  await svc.from('sibling_trades').delete().in('from_profile', ids);
  await svc.from('sibling_trades').delete().in('from_profile', ids);
  await svc.from('profile_badges').delete().in('profile_id', ids);
  await svc.from('transactions').delete().in('profile_id', ids);
  await svc.from('task_completions').delete().in('profile_id', ids);
  await svc.from('balance_accounts').delete().in('profile_id', ids);
  await svc.from('streaks').delete().in('profile_id', ids);
  await svc.from('life_items').delete().in('profile_id', ids);
  await svc.from('drafts').delete().in('profile_id', ids);
  await svc.from('tasks').delete().eq('family_id', familyId);
  await svc.from('family_members').delete().eq('family_id', familyId);
  await svc.from('profiles').delete().eq('family_id', familyId);
  await svc.from('families').delete().eq('id', familyId);
  await svc.auth.admin.deleteUser(userId).catch(() => {});
  console.log('\n(cleaned up test data)');
}

console.log(`\n${'='.repeat(52)}`);
console.log(`RESULT: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.log('\nFailures:'); fail.forEach(f => console.log(`  - ${f}`)); }
console.log('='.repeat(52));
