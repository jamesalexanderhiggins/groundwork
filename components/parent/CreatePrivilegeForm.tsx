'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPrivilege } from '@/app/actions/privileges';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

interface CreatePrivilegeFormProps {
  familyId:  string;
  largeName: string;
  smallName: string;
}

export function CreatePrivilegeForm({ familyId, largeName, smallName }: CreatePrivilegeFormProps) {
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const [pending, start]      = useTransition();
  const router                = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(''); setSuccess(false);
    const fd = new FormData(e.currentTarget);
    fd.append('family_id', familyId);
    start(async () => {
      const result = await createPrivilege(fd);
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
      {success && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">Privilege added!</p>}

      <Input label="Title" name="title" placeholder="e.g. Choose Friday dinner" required />

      <div>
        <label className="text-sm font-medium text-[var(--color-text)] block mb-1">Description (optional)</label>
        <textarea
          name="description"
          rows={2}
          className="w-full px-4 py-3 rounded-[var(--border-radius)] border border-[var(--color-accent)] bg-[var(--color-bg-card)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input label={largeName} name="cost_large" type="number" min={0} defaultValue={0} />
        <Input label={smallName} name="cost_small" type="number" min={0} defaultValue={0} />
      </div>

      <input type="hidden" name="type" value="custom" />
      <Button type="submit" loading={pending} className="w-full">Add privilege</Button>
    </form>
  );
}
