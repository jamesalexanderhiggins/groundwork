'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createChildProfile } from '@/app/actions/profile';
import { ASSIGNABLE_STAGES, type LifeStage } from '@/lib/life-stage';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

export function CreateChildForm({ onDone }: { onDone?: () => void }) {
  const [name, setName]   = useState('');
  const [stage, setStage] = useState<LifeStage>('young');
  const [error, setError] = useState('');
  const [pending, start]  = useTransition();
  const router            = useRouter();

  const activeStage = ASSIGNABLE_STAGES.find(s => s.key === stage);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }

    const fd = new FormData();
    fd.append('display_name', name.trim());
    fd.append('life_stage', stage);

    start(async () => {
      const result = await createChildProfile(fd);
      if (result && 'error' in result && result.error) {
        setError(result.error);
        return;
      }
      setName('');
      onDone?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}

      <Input
        label="Their name"
        placeholder="e.g. Ruben"
        value={name}
        onChange={e => setName(e.target.value)}
        maxLength={40}
        required
      />

      <fieldset>
        <legend className="text-sm font-medium text-[var(--color-text)] mb-2">Age group</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ASSIGNABLE_STAGES.map(s => (
            <label
              key={s.key}
              className={`
                flex flex-col items-center justify-center gap-1 p-3 rounded-[var(--border-radius)]
                border-2 cursor-pointer transition-all text-center
                ${stage === s.key
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-[var(--color-accent)]/30 bg-[var(--color-bg-card)] hover:border-[var(--color-primary)]/50'
                }
              `}
            >
              <input
                type="radio"
                name="life_stage"
                value={s.key}
                checked={stage === s.key}
                onChange={() => setStage(s.key)}
                className="sr-only"
              />
              <span className="text-xl leading-none">{s.icon}</span>
              <span className="text-sm font-medium text-[var(--color-text)]">{s.label}</span>
            </label>
          ))}
        </div>
        {activeStage && (
          <p className="text-xs opacity-60 text-[var(--color-text)] mt-2">{activeStage.hint}</p>
        )}
      </fieldset>

      <Button type="submit" loading={pending} className="w-full">
        Add to family
      </Button>
    </form>
  );
}
