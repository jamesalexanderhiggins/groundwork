'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Button } from '@/components/shared/Button';

interface CashOutCelebrationProps {
  cashValue:        number;
  largeAmount:      number;
  goldenAmount:     number;
  largeName:        string;
  goldenName:       string;
  tasksCompleted?:  number;
  onDone:           () => void;
}

export function CashOutCelebration({
  cashValue, largeAmount, goldenAmount, largeName, goldenName, tasksCompleted, onDone,
}: CashOutCelebrationProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const fire = (opts: confetti.Options) =>
      confetti({ origin: { y: 0.7 }, ...opts });

    fire({ particleCount: 80, spread: 60, startVelocity: 55, colors: ['#7C9FF5','#FFD700','#FFC2D1'] });
    setTimeout(() => fire({ particleCount: 60, spread: 80, decay: 0.9,  colors: ['#FFD700','#00FF41','#A855F7'] }), 300);
    setTimeout(() => fire({ particleCount: 40, spread: 120, startVelocity: 25, colors: ['#FF6B6B','#60A5FA','#34D399'] }), 600);
  }, []);

  const coinLine = [
    largeAmount  > 0 && `${largeAmount} ${largeName}`,
    goldenAmount > 0 && `${goldenAmount} ${goldenName}`,
  ].filter(Boolean).join(' + ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="w-full max-w-sm bg-[var(--color-bg-card)] rounded-[var(--border-radius)] overflow-hidden shadow-2xl text-center"
      >
        <div className="bg-[var(--color-reward)] px-6 py-8">
          <motion.div
            animate={{ rotate: [0, -5, 5, -5, 5, 0], scale: [1, 1.1, 1] }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-6xl mb-2"
          >
            💰
          </motion.div>
          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-3xl font-bold text-white"
          >
            ${cashValue.toFixed(2)}
          </motion.h1>
          <p className="text-white/80 text-sm mt-1">Real money, really earned</p>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <p className="text-[var(--color-text)] font-medium">
            You cashed out {coinLine}
          </p>

          {tasksCompleted !== undefined && (
            <p className="text-sm opacity-60 text-[var(--color-text)]">
              That&apos;s the result of {tasksCompleted} tasks completed. Amazing work!
            </p>
          )}

          <Button onClick={onDone} className="w-full mt-2">
            Back to dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
