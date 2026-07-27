'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestGiftCashout } from '@/app/actions/cashout';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

interface GiftWindowFormProps {
  profileId:      string;
  largeBalance:   number;
  goldenBalance:  number;
  largeName:      string;
  goldenName:     string;
  largeCashValue: number;
  goldenCashValue: number;
  giftMaxPercent: number;
}

/**
 * The Gift Window — a birthday/Christmas mechanic from the whitepaper.
 * A child may spend a capped slice of their own balance on a present for
 * someone else. Using it earns the Gift Giver badge.
 */
export function GiftWindowForm({
  profileId, largeBalance, goldenBalance,
  largeName, goldenName, largeCashValue, goldenCashValue, giftMaxPercent,
}: GiftWindowFormProps) {
  const [large, setLarge]   = useState(0);
  const [golden, setGolden] = useState(0);
  const [who, setWho]       = useState('');
  const [error, setError]   = useState('');
  const [done, setDone]     = useState<{ cash: number; who: string } | null>(null);
  const [pending, start]    = useTransition();
  const router = useRouter();

  const totalCash = largeBalance * largeCashValue + goldenBalance * goldenCashValue;
  const maxCash   = totalCash * (giftMaxPercent / 100);
  const chosen    = large * largeCashValue + golden * goldenCashValue;
  const overCap   = chosen > maxCash;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!who.trim())               { setError('Who is the gift for?'); return; }
    if (large === 0 && golden === 0) { setError('Choose at least one coin.'); return; }

    start(async () => {
      const result = await requestGiftCashout(profileId, large, golden, who.trim());
      if (result && 'error' in result && result.error) {
        setError(result.error);
        return;
      }
      if (result && 'cashValue' in result && typeof result.cashValue === 'number') {
        setDone({ cash: result.cashValue, who: who.trim() });
        setLarge(0); setGolden(0); setWho('');
        router.refresh();
      }
    });
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <p className="text-5xl mb-3" aria-hidden="true">🎁</p>
        <h3 className="font-bold text-lg text-[var(--color-text)]">
          ${done.cash.toFixed(2)} set aside for {done.who}
        </h3>
        <p className="text-sm opacity-60 text-[var(--color-text)] mt-1">
          That was generous. A grown-up will help you get it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm opacity-70 text-[var(--color-text)]">
        You can spend up to <strong>${maxCash.toFixed(2)}</strong> of your own
        coins ({giftMaxPercent}%) on a present for someone else.
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}

      <Input
        label="Who is it for?"
        placeholder="e.g. Mum"
        value={who}
        onChange={e => setWho(e.target.value)}
        maxLength={60}
        required
      />

      <Stepper
        label={largeName}
        value={large}
        max={largeBalance}
        onChange={setLarge}
      />
      <Stepper
        label={goldenName}
        value={golden}
        max={goldenBalance}
        onChange={setGolden}
      />

      <div className="flex items-baseline justify-between border-t border-[var(--color-border)] pt-3">
        <span className="text-sm text-[var(--color-text)]">Gift total</span>
        <span className={`font-bold text-lg ${overCap ? 'text-[var(--color-danger)]' : 'text-[var(--color-reward)]'}`}>
          ${chosen.toFixed(2)}
        </span>
      </div>

      {overCap && (
        <p className="text-xs text-[var(--color-danger)]">
          That is over the ${maxCash.toFixed(2)} gift limit.
        </p>
      )}

      <Button
        type="submit"
        loading={pending}
        disabled={overCap || (large === 0 && golden === 0) || !who.trim()}
      >
        Set aside for a gift
      </Button>
    </form>
  );
}

function Stepper({
  label, value, max, onChange,
}: { label: string; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--color-text)]">
        {label}
        <span className="opacity-50"> (you have {max})</span>
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          aria-label={`One fewer ${label}`}
          className="w-11 h-11 rounded-full border border-[var(--color-border)] text-lg text-[var(--color-text)] disabled:opacity-30"
        >
          −
        </button>
        <span className="w-8 text-center font-semibold text-[var(--color-text)]" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`One more ${label}`}
          className="w-11 h-11 rounded-full border border-[var(--color-border)] text-lg text-[var(--color-text)] disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
