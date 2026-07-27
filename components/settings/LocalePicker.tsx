'use client';

import { useTransition, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { updateLocale } from '@/app/actions/settings';

const LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
] as const;

export function LocalePicker({ profileId, current }: { profileId: string; current: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const router   = useRouter();
  const pathname = usePathname();

  function choose(code: string) {
    if (code === current) return;
    setError('');

    start(async () => {
      // Persist to the profile so AI replies and emails follow suit,
      // then move to the same page under the new locale prefix.
      const result = await updateLocale(profileId, code);
      if (result && 'error' in result && result.error) {
        setError(result.error);
        return;
      }
      const rest = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/settings';
      router.push(`/${code}${rest}`);
      router.refresh();
    });
  }

  return (
    <div>
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {LOCALES.map(l => {
          const active = current === l.code;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => choose(l.code)}
              disabled={pending}
              aria-current={active ? 'true' : undefined}
              className={`
                flex items-center gap-2 rounded-[var(--border-radius)] px-3 py-2.5
                text-sm font-medium border-2 transition-colors min-h-[44px]
                disabled:opacity-60
                ${active
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-[var(--color-accent)]/30 text-[var(--color-text)] hover:border-[var(--color-primary)]/50'
                }
              `}
            >
              {active && <span aria-hidden="true">✓</span>}
              {l.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
