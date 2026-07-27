'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { endScreenTimeSession } from '@/app/actions/arcade';
import { type FamilyRates } from '@/lib/economy';
import { Button } from '@/components/shared/Button';

interface ScreenTimeTimerProps {
  sessionId:   string;
  endsAt:      number;
  device:      string;
  familyRates: FamilyRates;
  smallName:   string;
  onDone:      () => void;
}

export function ScreenTimeTimer({ sessionId, endsAt, device, familyRates, smallName, onDone }: ScreenTimeTimerProps) {
  const [remaining, setRemaining]   = useState(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  const [overtime,  setOvertime]    = useState(0);
  const [ending,    setEnding]      = useState(false);
  const [startedAt] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      const rem = Math.ceil((endsAt - now) / 1000);
      if (rem > 0) {
        setRemaining(rem);
      } else {
        setRemaining(0);
        setOvertime(Math.floor((now - endsAt) / 1000));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [endsAt]);

  const handleEnd = useCallback(async () => {
    setEnding(true);
    const actualMinutes = Math.ceil((Date.now() - startedAt) / 60000);
    await endScreenTimeSession(sessionId, actualMinutes);
    onDone();
  }, [sessionId, startedAt, onDone]);

  const isOvertime = remaining === 0;
  const overtimePenalty = Math.ceil(overtime / (familyRates.smallMinutes * 60)) * 2;

  function fmt(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <p className="text-sm font-medium text-[var(--color-text)] opacity-60">
        Screen time · {device}
      </p>

      <motion.div
        animate={isOvertime ? { scale: [1, 1.03, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1 }}
        className={`
          w-48 h-48 rounded-full flex flex-col items-center justify-center border-4
          ${isOvertime
            ? 'border-red-400 bg-red-50'
            : 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
          }
        `}
      >
        <span className={`text-4xl font-bold tabular-nums ${isOvertime ? 'text-red-600' : 'text-[var(--color-primary)]'}`}>
          {isOvertime ? `+${fmt(overtime)}` : fmt(remaining)}
        </span>
        <span className="text-xs mt-1 opacity-60 text-[var(--color-text)]">
          {isOvertime ? 'OVERTIME' : 'remaining'}
        </span>
      </motion.div>

      {isOvertime && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-[var(--border-radius)] p-4 text-center w-full"
        >
          <p className="font-semibold text-red-700">Time&apos;s up!</p>
          <p className="text-sm text-red-600 mt-1">
            Overtime penalty: {overtimePenalty} {smallName} (double rate)
          </p>
        </motion.div>
      )}

      <Button
        onClick={handleEnd}
        loading={ending}
        variant={isOvertime ? 'primary' : 'secondary'}
        className="w-full"
      >
        {isOvertime ? `End session (−${overtimePenalty} ${smallName})` : 'End early'}
      </Button>
    </div>
  );
}
