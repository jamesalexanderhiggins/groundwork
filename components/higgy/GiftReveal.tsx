'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/shared/Button';

interface GiftRevealProps {
  giverName:  string;
  amount:     number;
  coinName:   string;
  note?:      string;
  onDone:     () => void;
}

export function GiftReveal({ giverName, amount, coinName, note, onDone }: GiftRevealProps) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="w-full max-w-sm bg-[var(--color-bg-card)] rounded-[var(--border-radius)] overflow-hidden shadow-2xl text-center"
        >
          {/* Gold header */}
          <div className="bg-gradient-to-br from-yellow-400 to-amber-500 px-6 py-8">
            <motion.div
              animate={{
                y: [0, -12, 0],
                rotate: [0, -8, 8, -8, 0],
              }}
              transition={{ delay: 0.2, duration: 1, repeat: 1, repeatDelay: 0.5 }}
              className="text-6xl mb-2"
            >
              ⭐
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-white/90 text-sm font-medium mb-1"
            >
              {giverName} sent you
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.65, type: 'spring' }}
              className="text-4xl font-bold text-white"
            >
              {amount} {coinName}
            </motion.h2>
          </div>

          {/* Body */}
          <div className="p-6 flex flex-col gap-4">
            {note && (
              <motion.blockquote
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-[var(--color-text)] italic opacity-80 border-l-4 border-yellow-400 pl-3 text-sm text-left"
              >
                &ldquo;{note}&rdquo;
              </motion.blockquote>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
            >
              <Button onClick={onDone} className="w-full">
                Thanks!
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
