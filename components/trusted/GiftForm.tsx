'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/Button';
import { Input }  from '@/components/shared/Input';
import { giftGoldenHigg } from '@/app/actions/trusted';

interface Child {
  id:           string;
  display_name: string;
}

interface GiftFormProps {
  fromProfileId: string;
  recipients:    Child[];
  goldenName:    string;
  onGifted?:     (toProfileId: string, amount: number) => void;
}

export function GiftForm({ fromProfileId, recipients, goldenName, onGifted }: GiftFormProps) {
  const [toId,   setToId]   = useState(recipients[0]?.id ?? '');
  const [amount, setAmount] = useState('1');
  const [note,   setNote]   = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const n = parseInt(amount, 10);
    if (!n || n < 1) { setStatus('Enter a valid amount.'); setLoading(false); return; }

    const res = await giftGoldenHigg(fromProfileId, toId, n, note);
    setLoading(false);

    if (res.error) { setStatus(res.error); return; }
    setStatus(`Gifted ${n} ${goldenName}!`);
    onGifted?.(toId, n);
    setAmount('1');
    setNote('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
          Who to gift?
        </label>
        <select
          value={toId}
          onChange={e => setToId(e.target.value)}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text)] p-3"
        >
          {recipients.map(c => (
            <option key={c.id} value={c.id}>{c.display_name}</option>
          ))}
        </select>
      </div>

      <Input
        label={`Amount (${goldenName})`}
        type="number"
        min="1"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />

      <Input
        label="Personal note (optional)"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="You've been amazing this week!"
      />

      {status && (
        <p className={`text-sm ${status.includes('Gifted') ? 'text-green-600' : 'text-red-500'}`}>
          {status}
        </p>
      )}

      <Button type="submit" loading={loading} className="w-full">
        Send {goldenName}
      </Button>
    </form>
  );
}
