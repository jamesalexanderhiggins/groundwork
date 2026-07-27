'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setCommitmentMode } from '@/app/actions/settings';
import { Button } from '@/components/shared/Button';

/**
 * Family Commitment Mode (schema: families.quit_penalty).
 *
 * The whitepaper is unusually specific here: this is the "non-optional
 * program" rule, where leaving forfeits saved currency. It requires an
 * explicit acknowledgement during setup and is "never a default-on setting
 * for new accounts". The column existed; nothing ever set it.
 */
export function CommitmentModeToggle({
  familyId, enabled,
}: { familyId: string; enabled: boolean }) {
  const [on, setOn]           = useState(enabled);
  const [confirming, setConf] = useState(false);
  const [error, setError]     = useState('');
  const [pending, start]      = useTransition();
  const router = useRouter();

  function apply(next: boolean) {
    setError('');
    start(async () => {
      const result = await setCommitmentMode(familyId, next);
      if (result && 'error' in result && result.error) {
        setError(result.error);
        return;
      }
      setOn(next);
      setConf(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="rounded-[var(--border-radius)] border-2 border-[var(--color-reward)] p-4 flex flex-col gap-3">
        <p className="font-semibold text-[var(--color-text)]">
          Before you turn this on
        </p>
        <p className="text-sm text-[var(--color-text)] opacity-80 leading-relaxed">
          With Commitment Mode on, a child who leaves the programme forfeits
          the coins they have saved. It is meant to make the commitment real —
          stay, work, delay pleasure, and you win.
        </p>
        <p className="text-sm text-[var(--color-text)] opacity-80 leading-relaxed">
          It is a strong rule. Talk it through with your children first and
          make sure they understand it before you switch it on.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={() => apply(true)} loading={pending} className="flex-1">
            We&apos;ve talked about it — turn it on
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConf(false)}
            disabled={pending}
            className="flex-1"
          >
            Not now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={() => (on ? apply(false) : setConf(true))}
        className="flex items-center gap-3 rounded-[var(--border-radius)] p-3 text-left border-2 border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)]/50 transition-colors min-h-[44px] disabled:opacity-50"
      >
        <span className="text-xl" aria-hidden="true">{on ? '🤝' : '🕊️'}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm text-[var(--color-text)]">
            Family Commitment Mode
          </span>
          <span className="block text-xs opacity-55 text-[var(--color-text)]">
            {on
              ? 'On — leaving the programme forfeits saved coins.'
              : 'Off — children keep their coins whatever they decide.'}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
            on ? 'bg-[var(--color-reward)]' : 'bg-[var(--color-border)]'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
              on ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </span>
      </button>
    </div>
  );
}
