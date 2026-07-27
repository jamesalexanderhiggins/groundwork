'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/Button';
import { Input }  from '@/components/shared/Input';
import { createCashoutWindow } from '@/app/actions/cashout';

export function CashoutWindowForm({ familyId }: { familyId: string }) {
  const [status,  setStatus]  = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const data = new FormData(e.currentTarget);
    const res = await createCashoutWindow(data, familyId);
    setLoading(false);
    if (res.error) { setStatus(res.error); return; }
    setStatus('Window created!');
    (e.target as HTMLFormElement).reset();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Label (e.g. Weekend cashout)" name="label" required />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Opens at</label>
          <input
            type="datetime-local"
            name="opens_at"
            required
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text)] p-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Closes at</label>
          <input
            type="datetime-local"
            name="closes_at"
            required
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text)] p-3 text-sm"
          />
        </div>
      </div>

      <Input
        label="Max cashout % of balance"
        name="max_percent"
        type="number"
        min="1"
        max="100"
        defaultValue="100"
      />

      <div className="flex items-center gap-3">
        <input type="checkbox" id="is_gift_window" name="is_gift_window" value="true" />
        <label htmlFor="is_gift_window" className="text-sm text-[var(--color-text)]">
          Allow trusted-adult gifts during this window
        </label>
      </div>

      {status && (
        <p className={`text-sm ${status.includes('created') ? 'text-green-600' : 'text-red-500'}`}>
          {status}
        </p>
      )}

      <Button type="submit" loading={loading}>Create window</Button>
    </form>
  );
}
