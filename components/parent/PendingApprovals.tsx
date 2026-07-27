'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/Button';
import { approveServiceAct, rejectServiceAct } from '@/app/actions/cashout';

interface Completion {
  id:            string;
  profile_id:    string;
  reward_large:  number;
  reward_small:  number;
  reward_golden: number;
  notes?:        string | null;
  completed_at:  string;
  profiles?: { display_name: string } | { display_name: string }[] | null;
  tasks?:    { title: string }        | { title: string }[]        | null;
}

interface PendingApprovalsProps {
  completions:     Completion[];
  parentProfileId: string;
  largeName?:      string;
  smallName?:      string;
  goldenName?:     string;
}

const first = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : v ?? undefined;

export function PendingApprovals({
  completions: initial,
  parentProfileId,
  largeName  = 'Higg',
  smallName  = 'Ginsey',
  goldenName = 'Golden',
}: PendingApprovalsProps) {
  const [items, setItems]     = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState('');
  const router = useRouter();

  async function act(
    id: string,
    key: string,
    fn: () => Promise<{ error?: string } | { success: boolean }>,
  ) {
    setLoading(key);
    setError('');
    const result = await fn();
    setLoading(null);

    // Errors were previously discarded, so a failed approval looked
    // identical to a successful one.
    if (result && 'error' in result && result.error) {
      setError(result.error);
      return;
    }
    setItems(prev => prev.filter(i => i.id !== id));
    router.refresh();
  }

  if (!items.length) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3" aria-hidden="true">✅</p>
        <p className="text-[var(--color-text)] opacity-60">Nothing waiting for approval.</p>
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

      {items.map(item => {
        const coins = [
          item.reward_large  > 0 && `${item.reward_large} ${largeName}`,
          item.reward_small  > 0 && `${item.reward_small} ${smallName}`,
          item.reward_golden > 0 && `${item.reward_golden} ${goldenName}`,
        ].filter(Boolean).join(' · ');

        const who  = first(item.profiles)?.display_name ?? 'Someone';
        const what = first(item.tasks)?.title ?? 'Service act';
        const when = new Date(item.completed_at).toLocaleDateString(undefined, {
          weekday: 'short', day: 'numeric', month: 'short',
        });

        return (
          <div key={item.id} className="card p-4 animate-fade-up">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-[var(--color-text)]">{who}</p>
              <span className="text-xs opacity-45 text-[var(--color-text)] shrink-0">{when}</span>
            </div>
            <p className="text-sm text-[var(--color-text)] mt-0.5">{what}</p>

            {item.notes && item.notes !== 'Pending parent approval' && (
              <p className="text-sm opacity-60 text-[var(--color-text)] mt-1">
                &ldquo;{item.notes}&rdquo;
              </p>
            )}

            {coins && (
              <p className="text-sm font-medium text-[var(--color-reward)] mt-2">{coins}</p>
            )}

            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => act(item.id, item.id, () => approveServiceAct(item.id, parentProfileId))}
                loading={loading === item.id}
                disabled={!!loading}
                className="flex-1 text-sm"
              >
                Approve
              </Button>
              <button
                type="button"
                onClick={() => act(item.id, `${item.id}-reject`, () => rejectServiceAct(item.id))}
                disabled={!!loading}
                className="flex-1 text-sm rounded-[var(--border-radius)] border border-[var(--color-accent)] text-[var(--color-text)] opacity-70 hover:opacity-100 transition-opacity px-4 min-h-[44px] disabled:opacity-40"
              >
                {loading === `${item.id}-reject` ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
