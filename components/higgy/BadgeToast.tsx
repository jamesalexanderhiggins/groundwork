'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BadgeToastProps {
  badge: { icon: string; title: string; desc: string } | null;
  onDone: () => void;
}

export function BadgeToast({ badge, onDone }: BadgeToastProps) {
  useEffect(() => {
    if (!badge) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [badge, onDone]);

  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          key={badge.title}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-xs w-full px-4"
        >
          <div className="flex items-center gap-3 bg-[var(--color-bg-card)] shadow-xl rounded-2xl px-4 py-3 border border-[var(--color-accent)]/30">
            <motion.span
              animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.3, 1] }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-3xl flex-shrink-0"
            >
              {badge.icon}
            </motion.span>
            <div>
              <p className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider">
                Badge Unlocked!
              </p>
              <p className="font-semibold text-[var(--color-text)] text-sm">{badge.title}</p>
              <p className="text-xs text-[var(--color-text)] opacity-60">{badge.desc}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
