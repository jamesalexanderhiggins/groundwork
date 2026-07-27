'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

interface GateEventProps {
  open:      boolean;
  timeBlock: 'am' | 'pm';
  onDone:    () => void;
  adhdMode?: boolean;
}

export function GateEvent({ open, timeBlock, onDone, adhdMode = false }: GateEventProps) {
  const t = useTranslations('higgy');
  const duration = adhdMode ? 1200 : 2500;

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [open, duration, onDone]);

  const message = timeBlock === 'am' ? t('gate_am') : t('gate_pm');
  const emoji   = timeBlock === 'am' ? '🌅' : '🌙';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-primary)]"
          onClick={onDone}
          role="dialog"
          aria-modal="true"
          aria-label={message}
        >
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
            className="text-center px-8"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-8xl mb-6"
            >
              {emoji}
            </motion.div>

            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-3xl font-bold text-white text-center leading-tight"
            >
              {message}
            </motion.h1>

            {!adhdMode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="mt-6 flex gap-2 justify-center"
              >
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 }}
                    className="w-3 h-3 rounded-full bg-white/60"
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
