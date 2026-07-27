'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createQuest } from '@/app/actions/quests';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

interface Child { id: string; display_name: string; }

export function CreateQuestForm({ children }: { children: Child[] }) {
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const [pending, start]      = useTransition();
  const router                = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(''); setSuccess(false);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const result = await createQuest(fd);
      if ('error' in result && result.error) { setError(result.error); return; }
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error   && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">Quest created!</p>}

      <Input label="Quest title" name="title" placeholder="e.g. The Great Bedroom Expedition" required />

      <div>
        <label className="text-sm font-medium text-[var(--color-text)] block mb-1">Description (optional)</label>
        <textarea
          name="description"
          rows={2}
          placeholder="What must be done..."
          className="w-full px-4 py-3 rounded-[var(--border-radius)] border border-[var(--color-accent)] bg-[var(--color-bg-card)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Input label="Higgs"         name="reward_large"  type="number" min={0} defaultValue={0} />
        <Input label="Ginseys"       name="reward_small"  type="number" min={0} defaultValue={0} />
        <Input label="Golden Higgs"  name="reward_golden" type="number" min={0} defaultValue={0} />
      </div>

      {children.length > 0 && (
        <div>
          <label className="text-sm font-medium text-[var(--color-text)] block mb-1">Assign to (optional)</label>
          <select
            name="assigned_to"
            className="w-full px-4 py-3 rounded-[var(--border-radius)] border border-[var(--color-accent)] bg-[var(--color-bg-card)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
          >
            <option value="">Anyone</option>
            {children.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
        </div>
      )}

      <Input label="Expires in (hours, 0 = no expiry)" name="expires_hours" type="number" min={0} defaultValue={0} />

      <Button type="submit" loading={pending} className="w-full">Create quest</Button>
    </form>
  );
}
