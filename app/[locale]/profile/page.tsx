import { redirect }                   from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getCurrentProfile }          from '@/lib/current-profile';
import { BottomNav }                  from '@/components/higgy/BottomNav';
import { VirtueBar }                  from '@/components/higgy/VirtueBar';
import { SkinPicker }                 from '@/components/higgy/SkinPicker';
import { BadgeShelf }                 from '@/components/higgy/BadgeShelf';
import type { SkinKey }               from '@/lib/skins';
import { PreferenceProvider } from '@/components/shared/PreferenceProvider';

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await getCurrentProfile();
  if (!profile) redirect('/onboarding');
  const activeProfileId = profile.id;

  const { data: earnedBadges } = await supabase
    .from('profile_badges')
    .select('earned_at, badges(key, icon, title_key, desc_key)')
    .eq('profile_id', activeProfileId);

  const { data: allBadges } = await supabase
    .from('badges')
    .select('id, key, icon, title_key, desc_key')
    .order('key');

  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak')
    .eq('profile_id', activeProfileId)
    .single();

  const { data: account } = await supabase
    .from('balance_accounts')
    .select('lifetime_large')
    .eq('profile_id', activeProfileId)
    .single();

  const skinClass = `skin-${profile.skin ?? 'cloud_kingdom'}`;

  // Map badge keys to readable titles from the seeded data
  const BADGE_TITLES: Record<string, { title: string; desc: string }> = {
    first_steps:     { title: 'First Steps',      desc: 'The journey begins.' },
    keeper_of_order: { title: 'Keeper of Order',  desc: 'Seven days. Unbroken.' },
    streak_legend:   { title: 'Streak Legend',    desc: 'Thirty days of excellence.' },
    quest_champion:  { title: 'Quest Champion',   desc: 'Your first quest completed.' },
    quest_master:    { title: 'Quest Master',     desc: 'Ten quests conquered.' },
    gift_giver:      { title: 'Gift Giver',       desc: 'You used the gift window.' },
    community_hero:  { title: 'Community Hero',   desc: 'Three acts of service.' },
    first_cashout:   { title: 'First Cashout',    desc: 'Real money, really earned.' },
    big_saver:       { title: 'Big Saver',        desc: 'One hundred coins saved.' },
    virtue_rising:   { title: 'Virtue Rising',    desc: 'Virtue Level 5 reached.' },
    golden_moment:   { title: 'Golden Moment',    desc: 'Your first Golden coin.' },
    peaceful_player: { title: 'Peaceful Player',  desc: 'Chess peace earned five times.' },
  };

  const allBadgesFormatted = (allBadges ?? []).map(b => ({
    key:   b.key,
    icon:  b.icon,
    title: BADGE_TITLES[b.key]?.title ?? b.key,
    desc:  BADGE_TITLES[b.key]?.desc  ?? '',
  }));

  type RawBadge = { key: string; icon: string } | { key: string; icon: string }[] | null;
  const earnedFormatted = (earnedBadges ?? []).map(e => {
    const raw = e.badges as RawBadge;
    const b   = Array.isArray(raw) ? raw[0] : raw;
    return {
      earned_at: (e as { earned_at?: string }).earned_at ?? '',
      badges: b ? {
        key:   b.key,
        icon:  b.icon,
        title: BADGE_TITLES[b.key]?.title ?? '',
        desc:  BADGE_TITLES[b.key]?.desc  ?? '',
      } : null,
    };
  });

  return (
    <div className={skinClass}>
      <PreferenceProvider cognitiveMode={profile.cognitive_mode} />
      <main className="min-h-screen bg-[var(--color-bg)] pb-24">
        <header className="bg-[var(--color-bg-card)] shadow-sm px-6 py-4 sticky top-0 z-10">
          <div className="max-w-lg mx-auto">
            <h1 className="font-bold text-lg text-[var(--color-text)]">{profile.display_name}</h1>
            <p className="text-sm text-[var(--color-text)] opacity-50">
              {streak?.current_streak ? `🔥 ${streak.current_streak} day streak · ` : ''}
              {account?.lifetime_large ?? 0} lifetime coins
            </p>
          </div>
        </header>

        <div className="px-6 pt-6 pb-4 max-w-lg mx-auto flex flex-col gap-8">
          {/* Virtue progress */}
          <section className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Virtue Progress</h2>
            <VirtueBar
              totalVp={profile.virtue_points}
              virtueLevel={profile.virtue_level}
            />
          </section>

          {/* Skin picker */}
          <section className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--color-text)] mb-1">Choose Your Skin</h2>
            <p className="text-xs text-[var(--color-text)] opacity-50 mb-4">
              Earn virtue points to unlock new skins. Locked skins show their required level.
            </p>
            <SkinPicker
              profileId={profile.id}
              currentSkin={(profile.skin ?? 'cloud_kingdom') as SkinKey}
              virtueLevel={profile.virtue_level}
            />
          </section>

          {/* Badges */}
          <section className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--color-text)] mb-4">
              Badges
              <span className="ml-2 text-sm font-normal opacity-50">
                {earnedFormatted.length} / {allBadgesFormatted.length}
              </span>
            </h2>
            <BadgeShelf earned={earnedFormatted} all={allBadgesFormatted} />
          </section>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
