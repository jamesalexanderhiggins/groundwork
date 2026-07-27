'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setActiveProfile } from '@/app/actions/profile';

interface Profile {
  id:           string;
  display_name: string;
  role:         string;
  skin:         string;
}

interface ProfileSwitcherProps {
  profiles:      Profile[];
  activeProfileId: string | null;
}

export function ProfileSwitcher({ profiles, activeProfileId }: ProfileSwitcherProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function select(profileId: string) {
    startTransition(async () => {
      await setActiveProfile(profileId);
      router.push('/tasks');
    });
  }

  const children = profiles.filter(p => p.role === 'child');

  if (children.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-[var(--color-text)]">Switch to a child</h2>
      <div className="flex flex-wrap gap-3">
        {children.map(profile => (
          <button
            key={profile.id}
            onClick={() => select(profile.id)}
            disabled={pending}
            className={`
              flex flex-col items-center gap-2 p-4 rounded-[var(--border-radius)] min-w-[100px]
              border-2 transition-all
              ${activeProfileId === profile.id
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                : 'border-[var(--color-accent)]/30 bg-[var(--color-bg-card)] hover:border-[var(--color-primary)]/50'
              }
            `}
          >
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-2xl">
              {profile.display_name[0].toUpperCase()}
            </div>
            <span className="text-sm font-medium text-[var(--color-text)]">{profile.display_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
