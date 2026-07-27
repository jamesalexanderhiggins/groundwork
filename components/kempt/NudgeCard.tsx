'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dismissNudge } from '@/app/actions/nudges';

interface Nudge {
  id:           string;
  body:         string;
  action_label?: string | null;
  action_type?:  string | null;
}

export function NudgeCard({ nudge }: { nudge: Nudge }) {
  const [visible, setVisible] = useState(true);

  async function handleDismiss() {
    setVisible(false);
    await dismissNudge(nudge.id);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          className="bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-accent)]/10 border border-[var(--color-primary)]/20 rounded-[var(--border-radius)] p-4"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">💡</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--color-text)] leading-relaxed">{nudge.body}</p>
              {nudge.action_label && (
                <button className="mt-2 text-xs font-semibold text-[var(--color-primary)] hover:underline">
                  {nudge.action_label} →
                </button>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-[var(--color-text)] opacity-30 hover:opacity-60 transition-opacity"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
