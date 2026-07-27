'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createChildProfile } from '@/app/actions/profile';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

export function CreateChildForm({ onDone }: { onDone?: () => void }) {
  const [name, setName]     = useState('');
  const [stage, setStage]   = useState<'little' | 'young'>('young');
  const [error, setError]   = useState('');
  const [pending, start]    = useTransition();
  const router              = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }

    const fd = new FormData();
    fd.append('display_name', name);
    fd.append('life_stage', stage);

    start(async () => {
      const result = await createChildProfile(fd);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

      <Input
        label="Child's name"
        placeholder="e.g. Harry"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />

      <fieldset>
        <legend className="text-sm font-medium text-[var(--color-text)] mb-2">Age group</legend>
        <div className="flex gap-3">
          {(['little', 'young'] as const).map(s => (
            <label key={s} className={`
              flex-1 flex items-center justify-center gap-2 p-3 rounded-[var(--border-radius)]
              border-2 cursor-pointer transition-all
              ${stage === s
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                : 'border-[var(--color-accent)]/30 bg-[var(--color-bg-card)]'
              }
            `}>
              <input
                type="radio"
                name="life_stage"
                value={s}
                checked={stage === s}
                onChange={() => setStage(s)}
                className="sr-only"
              />
              <span className="text-lg">{s === 'little' ? '🧒' : '👦'}</span>
              <span className="text-sm font-medium text-[var(--color-text)] capitalize">{s}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" loading={pending} className="w-full">
        Add child
      </Button>
    </form>
  );
}
