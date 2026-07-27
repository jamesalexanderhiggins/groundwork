'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { buyScreenTime } from '@/app/actions/arcade';
import { minutesToCost, type FamilyRates } from '@/lib/economy';
import { Button } from '@/components/shared/Button';
import { ScreenTimeTimer } from './ScreenTimeTimer';

const DURATIONS = [15, 30, 45, 60, 90, 120];
const DEVICES   = ['PC', 'Xbox', 'Switch', 'Gameboy', 'Laptop', 'Tablet', 'TV'];

interface ScreenTimeSelectorProps {
  profileId:    string;
  familyRates:  FamilyRates;
  largeName:    string;
  smallName:    string;
  todayCap:     number;
  minutesUsed:  number;
}

export function ScreenTimeSelector({
  profileId, familyRates, largeName, smallName, todayCap, minutesUsed,
}: ScreenTimeSelectorProps) {
  const [minutes,    setMinutes]    = useState(30);
  const [device,     setDevice]     = useState('');
  const [error,      setError]      = useState('');
  const [session,    setSession]    = useState<{ id: string; endsAt: number } | null>(null);
  const [pending,    startTransition] = useTransition();

  const remaining = todayCap - minutesUsed;
  const cost      = minutesToCost(Math.min(minutes, remaining), familyRates);

  async function handleBuy() {
    if (!device) { setError('Pick a device first.'); return; }
    setError('');
    startTransition(async () => {
      const result = await buyScreenTime(profileId, minutes, device);
      if ('error' in result && result.error) { setError(result.error); return; }
      if ('session' in result && result.session) {
        setSession({ id: result.session.id, endsAt: Date.now() + minutes * 60000 });
      }
    });
  }

  if (session) {
    return (
      <ScreenTimeTimer
        sessionId={session.id}
        endsAt={session.endsAt}
        device={device}
        familyRates={familyRates}
        smallName={smallName}
        onDone={() => setSession(null)}
      />
    );
  }

  if (todayCap === 0) {
    return (
      <div className="text-center py-10 text-[var(--color-text)] opacity-60">
        <p className="text-4xl mb-3">🚫</p>
        <p className="font-semibold">No screen time today.</p>
        <p className="text-sm mt-1">Check back tomorrow.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-[var(--color-text)] opacity-60 mb-1">
          Today&apos;s cap: {remaining} min remaining of {todayCap} min
        </p>
        <div className="h-2 rounded-full bg-[var(--color-accent)]/20 overflow-hidden">
          <div
            className="h-full bg-[var(--color-primary)] rounded-full transition-all"
            style={{ width: `${Math.max(0, (1 - minutesUsed / todayCap) * 100)}%` }}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--color-text)] mb-2">Device</p>
        <div className="flex flex-wrap gap-2">
          {DEVICES.map(d => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`px-3 py-2 rounded-[var(--border-radius)] text-sm font-medium border-2 transition-all ${
                device === d
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-[var(--color-accent)]/30 text-[var(--color-text)] hover:border-[var(--color-primary)]/50'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--color-text)] mb-2">Duration</p>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.filter(d => d <= remaining).map(d => (
            <button
              key={d}
              onClick={() => setMinutes(d)}
              className={`py-3 rounded-[var(--border-radius)] text-sm font-semibold border-2 transition-all ${
                minutes === d
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-[var(--color-accent)]/30 text-[var(--color-text)] hover:border-[var(--color-primary)]/50'
              }`}
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={`${minutes}-${device}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-4 border border-[var(--color-accent)]/30"
      >
        <p className="text-sm text-[var(--color-text)] opacity-60 mb-1">Cost</p>
        <p className="font-bold text-[var(--color-text)] text-lg">
          {cost.large > 0 && <span>{cost.large} {largeName} </span>}
          {cost.small > 0 && <span>{cost.small} {smallName}</span>}
          {cost.large === 0 && cost.small === 0 && <span>Free</span>}
        </p>
        <p className="text-xs opacity-40 text-[var(--color-text)] mt-1">
          for {minutes} min on {device || '—'}
        </p>
      </motion.div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

      <Button onClick={handleBuy} loading={pending} className="w-full" disabled={!device}>
        Buy {minutes} min
      </Button>
    </div>
  );
}
