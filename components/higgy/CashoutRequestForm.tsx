'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button }   from '@/components/shared/Button';
import { requestCashout } from '@/app/actions/cashout';
import { CashOutCelebration } from './CashOutCelebration';

interface CashoutRequestFormProps {
  profileId:       string;
  largeBalance:    number;
  goldenBalance:   number;
  largeName:       string;
  goldenName:      string;
  largeCashValue:  number;
  goldenCashValue: number;
  maxPercent:      number;
}

export function CashoutRequestForm({
  profileId, largeBalance, goldenBalance,
  largeName, goldenName, largeCashValue, goldenCashValue, maxPercent,
}: CashoutRequestFormProps) {
  const router = useRouter();
  const [largeAmt,  setLargeAmt]  = useState(0);
  const [goldenAmt, setGoldenAmt] = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ cash: number; large: number; golden: number } | null>(null);

  const previewCash = largeAmt * largeCashValue + goldenAmt * goldenCashValue;
  const maxCash     = (largeBalance * largeCashValue + goldenBalance * goldenCashValue) * (maxPercent / 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (largeAmt === 0 && goldenAmt === 0) { setError('Select at least some coins to cash out.'); return; }
    setLoading(true);
    setError(null);
    const res = await requestCashout(profileId, largeAmt, goldenAmt);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setCelebration({ cash: res.cashValue!, large: largeAmt, golden: goldenAmt });
  }

  if (celebration) {
    return (
      <CashOutCelebration
        cashValue={celebration.cash}
        largeAmount={celebration.large}
        goldenAmount={celebration.golden}
        largeName={largeName}
        goldenName={goldenName}
        onDone={() => router.push('/dashboard')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[var(--border-radius)] p-4">
        <p className="text-sm text-[var(--color-text)] opacity-60 mb-1">Max cashout this window</p>
        <p className="text-2xl font-bold text-[var(--color-text)]">${maxCash.toFixed(2)}</p>
        <p className="text-xs text-[var(--color-text)] opacity-40 mt-1">({maxPercent}% of your balance)</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
            {largeName} to cash out
            <span className="opacity-50 ml-2">({largeBalance} available)</span>
          </label>
          <input
            type="range"
            min={0}
            max={largeBalance}
            value={largeAmt}
            onChange={e => setLargeAmt(Number(e.target.value))}
            className="w-full accent-[var(--color-primary)]"
          />
          <div className="flex justify-between text-sm text-[var(--color-text)] mt-1">
            <span>0</span>
            <span className="font-bold">{largeAmt}</span>
            <span>{largeBalance}</span>
          </div>
        </div>

        {goldenBalance > 0 && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
              {goldenName} to cash out
              <span className="opacity-50 ml-2">({goldenBalance} available)</span>
            </label>
            <input
              type="range"
              min={0}
              max={goldenBalance}
              value={goldenAmt}
              onChange={e => setGoldenAmt(Number(e.target.value))}
              className="w-full accent-[var(--color-reward)]"
            />
            <div className="flex justify-between text-sm text-[var(--color-text)] mt-1">
              <span>0</span>
              <span className="font-bold">{goldenAmt}</span>
              <span>{goldenBalance}</span>
            </div>
          </div>
        )}

        <div className="bg-[var(--color-reward)]/10 border border-[var(--color-reward)]/30 rounded-lg p-4 text-center">
          <p className="text-sm text-[var(--color-text)] opacity-60">You&apos;ll receive</p>
          <p className="text-3xl font-bold text-[var(--color-text)]">${previewCash.toFixed(2)}</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" loading={loading} className="w-full" disabled={previewCash === 0}>
          Cash out ${previewCash.toFixed(2)}
        </Button>
      </form>
    </div>
  );
}
