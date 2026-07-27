'use client';

import { useEffect, useRef, useState } from 'react';

interface CurrencyDisplayProps {
  large:      number;
  small:      number;
  golden:     number;
  largeName:  string;
  smallName:  string;
  goldenName: string;
  animate?:   boolean;
}

function AnimatedCount({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    const diff  = value - prev.current;
    const steps = Math.min(Math.abs(diff), 20);
    const step  = diff / steps;
    let current = prev.current;
    let i = 0;

    const interval = setInterval(() => {
      i++;
      current += step;
      setDisplayed(Math.round(i === steps ? value : current));
      if (i >= steps) {
        clearInterval(interval);
        prev.current = value;
      }
    }, 40);

    return () => clearInterval(interval);
  }, [value]);

  return <span>{displayed}</span>;
}

function HiggSymbol({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="8"  y1="8"  x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="8"  x2="8"  y2="16" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="6"  x2="12" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6"  y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CurrencyDisplay({ large, small, golden, largeName, smallName, goldenName }: CurrencyDisplayProps) {
  return (
    <div className="flex gap-4 items-center flex-wrap">
      {large > 0 || true ? (
        <div className="flex items-center gap-1 bg-[var(--color-bg-card)] rounded-[var(--border-radius)] px-3 py-2 shadow-sm">
          <HiggSymbol className="w-5 h-5 text-[var(--color-primary)]" />
          <span className="font-bold text-[var(--color-text)] text-lg"><AnimatedCount value={large} /></span>
          <span className="text-xs opacity-60 text-[var(--color-text)]">{largeName}</span>
        </div>
      ) : null}

      {small > 0 || true ? (
        <div className="flex items-center gap-1 bg-[var(--color-bg-card)] rounded-[var(--border-radius)] px-3 py-2 shadow-sm">
          <HiggSymbol className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="font-bold text-[var(--color-text)] text-lg"><AnimatedCount value={small} /></span>
          <span className="text-xs opacity-60 text-[var(--color-text)]">{smallName}</span>
        </div>
      ) : null}

      {golden > 0 ? (
        <div className="flex items-center gap-1 bg-[var(--color-bg-card)] rounded-[var(--border-radius)] px-3 py-2 shadow-sm">
          <HiggSymbol className="w-5 h-5 text-[var(--color-reward)]" />
          <span className="font-bold text-[var(--color-text)] text-lg"><AnimatedCount value={golden} /></span>
          <span className="text-xs opacity-60 text-[var(--color-text)]">{goldenName}</span>
        </div>
      ) : null}
    </div>
  );
}
