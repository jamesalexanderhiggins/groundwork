'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { proposeTrade, respondToTrade } from '@/app/actions/trades';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

interface Profile {
  id:           string;
  display_name: string;
}

interface PendingTrade {
  id:           string;
  from_profile: string;
  large_amount: number;
  small_amount: number;
  from_name:    string;
}

interface SiblingTradeProps {
  profileId:     string;
  siblings:      Profile[];
  pendingTrades: PendingTrade[];
  largeName:     string;
  smallName:     string;
}

export function SiblingTrade({ profileId, siblings, pendingTrades, largeName, smallName }: SiblingTradeProps) {
  const [toProfile,    setToProfile]    = useState('');
  const [largeAmount,  setLargeAmount]  = useState(0);
  const [smallAmount,  setSmallAmount]  = useState(0);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [pending,      startTransition] = useTransition();
  const router = useRouter();

  async function handleSend() {
    if (!toProfile) { setError('Pick a sibling.'); return; }
    if (largeAmount === 0 && smallAmount === 0) { setError('Enter an amount.'); return; }
    setError(''); setSuccess('');
    startTransition(async () => {
      const result = await proposeTrade(profileId, toProfile, largeAmount, smallAmount);
      if ('error' in result && result.error) { setError(result.error); return; }
      setSuccess('Trade request sent!');
      setLargeAmount(0); setSmallAmount(0); setToProfile('');
      setTimeout(() => setSuccess(''), 3000);
    });
  }

  async function handleRespond(tradeId: string, accept: boolean) {
    setError(''); setSuccess('');
    startTransition(async () => {
      // Accepting can legitimately fail — the sender may have spent the
      // coins since offering. Swallowing that left the row on screen with
      // no explanation.
      const result = await respondToTrade(tradeId, accept, profileId);
      if (result && 'error' in result && result.error) {
        setError(result.error);
        return;
      }
      setSuccess(accept ? 'Trade accepted!' : 'Trade declined.');
      setTimeout(() => setSuccess(''), 3000);
      router.refresh();
    });
  }

  if (siblings.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="font-bold text-[var(--color-text)] mb-3">Sibling trade</h2>

      {pendingTrades.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {pendingTrades.map(trade => (
            <div
              key={trade.id}
              className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-3 flex items-center justify-between gap-3 shadow-sm"
            >
              <p className="text-sm text-[var(--color-text)]">
                <strong>{trade.from_name}</strong> sent you{' '}
                {trade.large_amount > 0 && `${trade.large_amount} ${largeName} `}
                {trade.small_amount > 0 && `${trade.small_amount} ${smallName}`}
              </p>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="secondary" onClick={() => handleRespond(trade.id, false)} className="!px-3 !py-1 text-sm">✗</Button>
                <Button onClick={() => handleRespond(trade.id, true)} className="!px-3 !py-1 text-sm">✓</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-4 shadow-sm flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--color-text)] mb-2">Send to</p>
          <div className="flex gap-2 flex-wrap">
            {siblings.map(s => (
              <button
                key={s.id}
                onClick={() => setToProfile(s.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                  toProfile === s.id
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-accent)]/30 text-[var(--color-text)]'
                }`}
              >
                {s.display_name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            label={largeName}
            type="number"
            min={0}
            value={largeAmount || ''}
            onChange={e => setLargeAmount(parseInt(e.target.value) || 0)}
            className="flex-1"
          />
          <Input
            label={smallName}
            type="number"
            min={0}
            value={smallAmount || ''}
            onChange={e => setSmallAmount(parseInt(e.target.value) || 0)}
            className="flex-1"
          />
        </div>

        {error   && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <Button onClick={handleSend} loading={pending} variant="secondary" className="w-full">
          Send coins
        </Button>
      </div>
    </section>
  );
}
