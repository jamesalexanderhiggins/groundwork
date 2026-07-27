'use client';

import { motion } from 'framer-motion';
import { calcLevel } from '@/lib/virtue';

interface VirtueBarProps {
  totalVp:     number;
  virtueLevel: number;
}

export function VirtueBar({ totalVp, virtueLevel }: VirtueBarProps) {
  const { vpInLevel, vpToNext } = calcLevel(totalVp);
  const pct = Math.min(100, Math.round((vpInLevel / vpToNext) * 100));
  const isMax = virtueLevel >= 10;

  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-semibold text-[var(--color-text)]">
          Virtue Level {virtueLevel}
        </span>
        {!isMax && (
          <span className="text-xs text-[var(--color-text)] opacity-50">
            {vpInLevel} / {vpToNext} VP
          </span>
        )}
        {isMax && (
          <span className="text-xs font-bold text-[var(--color-reward)]">MAX</span>
        )}
      </div>

      <div className="h-3 rounded-full bg-[var(--color-border)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]"
        />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-xs text-[var(--color-text)] opacity-40">L{virtueLevel}</span>
        {!isMax && (
          <span className="text-xs text-[var(--color-text)] opacity-40">L{virtueLevel + 1}</span>
        )}
      </div>
    </div>
  );
}
