'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/Button';
import { approveServiceAct, rejectServiceAct } from '@/app/actions/cashout';

interface Completion {
  id:            string;
  profile_id:    string;
  reward_large:  number;
  reward_small:  number;
  reward_golden: number;
  note?:         string;
  created_at:    string;
  profiles?: { display_name: string } | { display_name: string }[] | null;
  tasks?:    { title: string }        | { title: string }[]        | null;
}

interface PendingApprovalsProps {
  completions:   Completion[];
  parentProfileId: string;
}

export function PendingApprovals({ completions: initial, parentProfileId }: PendingApprovalsProps) {
  const [items,   setItems]   = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);

  async function approve(id: string) {
    setLoading(id);
    await approveServiceAct(id, parentProfileId);
    setItems(p => p.filter(i => i.id !== id));
    setLoading(null);
  }

  async function reject(id: string) {
    setLoading(id + '-reject');
    await rejectServiceAct(id);
    setItems(p => p.filter(i => i.id !== id));
    setLoading(null);
  }

  if (!items.length) {
    return (
      <p className="text-center text-[var(--color-text)] opacity-50 py-8">
        No pending approvals right now.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(item => {
        const coins = [
          item.reward_large  > 0 && `${item.reward_large} large`,
          item.reward_small  > 0 && `${item.reward_small} small`,
          item.reward_golden > 0 && `${item.reward_golden} golden`,
        ].filter(Boolean).join(' + ');

        return (
          <div
            key={item.id}
            className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[var(--border-radius)] p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                {(() => {
                  const profilesVal = item.profiles;
                  const tasksVal    = item.tasks;
                  const profileName = Array.isArray(profilesVal) ? profilesVal[0]?.display_name : profilesVal?.display_name;
                  const taskTitle   = Array.isArray(tasksVal)    ? tasksVal[0]?.title            : tasksVal?.title;
                  return (
                    <p className="font-semibold text-[var(--color-text)]">
                      {profileName ?? 'Child'} — {taskTitle ?? 'Service act'}
                    </p>
                  );
                })()}
                {item.note && (
                  <p className="text-sm opacity-60 text-[var(--color-text)]">&ldquo;{item.note}&rdquo;</p>
                )}
                <p className="text-sm text-[var(--color-text)] opacity-50 mt-1">{coins}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                onClick={() => approve(item.id)}
                loading={loading === item.id}
                className="flex-1 text-sm"
              >
                Approve
              </Button>
              <button
                onClick={() => reject(item.id)}
                disabled={!!loading}
                className="flex-1 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text)] opacity-70 hover:opacity-100 transition-opacity px-4 py-2"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
