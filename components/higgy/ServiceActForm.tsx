'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitServiceAct } from '@/app/actions/service-acts';
import { Button } from '@/components/shared/Button';

interface ServiceAct {
  id:           string;
  title:        string;
  completed_at: string;
  approved:     boolean;
  reward_small: number;
}

export function ServiceActForm({
  profileId, smallName = 'Ginsey', recent = [],
}: {
  profileId: string;
  smallName?: string;
  recent?: ServiceAct[];
}) {
  const [text, setText]     = useState('');
  const [error, setError]   = useState('');
  const [sent, setSent]     = useState(false);
  const [pending, start]    = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!text.trim()) { setError('Tell us what you did.'); return; }

    start(async () => {
      const result = await submitServiceAct(profileId, text.trim());
      if (result && 'error' in result && result.error) {
        setError(result.error);
        return;
      }
      setText('');
      setSent(true);
      setTimeout(() => setSent(false), 3500);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="service-act" className="sr-only">
          What did you do for someone?
        </label>
        <textarea
          id="service-act"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="e.g. Helped Nana carry her shopping in"
          className="w-full rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text)] p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </p>
        )}

        {sent && (
          <p role="status" className="text-sm text-[var(--color-success)] bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            Sent to a grown-up to look at. Nicely done.
          </p>
        )}

        <Button type="submit" loading={pending} disabled={!text.trim()}>
          Send for approval
        </Button>
      </form>

      {recent.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold opacity-50 text-[var(--color-text)] uppercase tracking-wide mb-2">
            Your acts of service
          </h3>
          <ul className="flex flex-col gap-1.5">
            {recent.map(act => (
              <li
                key={act.id}
                className="flex items-center justify-between gap-3 text-sm text-[var(--color-text)] py-1"
              >
                <span className="min-w-0 truncate">{act.title}</span>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    act.approved ? 'text-[var(--color-success)]' : 'opacity-50'
                  }`}
                >
                  {act.approved ? `+${act.reward_small} ${smallName}` : 'waiting'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
