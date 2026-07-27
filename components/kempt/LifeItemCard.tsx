'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { updateLifeItemStatus } from '@/app/actions/life-items';

interface LifeItem {
  id:       string;
  title:    string;
  body?:    string | null;
  category?: string | null;
  due_at?:  string | null;
  recurrence_pattern?: object | null;
  status:   string;
}

interface LifeItemCardProps {
  item:     LifeItem;
  onRemove: (id: string) => void;
}

const CATEGORY_DOT: Record<string, string> = {
  health:   'bg-green-400',
  finance:  'bg-yellow-400',
  admin:    'bg-blue-400',
  home:     'bg-orange-400',
  security: 'bg-red-400',
};

export function LifeItemCard({ item, onRemove }: LifeItemCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function act(status: 'done' | 'dismissed' | 'snoozed', snoozedUntil?: string) {
    setLoading(status);
    await updateLifeItemStatus(item.id, status, snoozedUntil);
    onRemove(item.id);
    setLoading(null);
  }

  function snoozeWeek() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    act('snoozed', d.toISOString());
  }

  const dot = item.category ? (CATEGORY_DOT[item.category] ?? 'bg-gray-300') : 'bg-gray-300';
  const isOverdue = item.due_at && new Date(item.due_at) < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[var(--border-radius)] p-4"
    >
      <div className="flex items-start gap-3">
        {/* Category dot */}
        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[var(--color-text)] leading-snug">{item.title}</p>
          {item.body && (
            <p className="text-sm text-[var(--color-text)] opacity-60 mt-0.5 line-clamp-2">{item.body}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {item.due_at && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isOverdue ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {isOverdue ? 'Overdue · ' : ''}
                {new Date(item.due_at).toLocaleDateString()}
              </span>
            )}
            {item.recurrence_pattern && (
              <span className="text-xs bg-purple-50 text-purple-500 px-2 py-0.5 rounded-full">↻</span>
            )}
          </div>
        </div>

        {/* Done button */}
        <button
          onClick={() => act('done')}
          disabled={!!loading}
          className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-[var(--color-primary)] flex items-center justify-center hover:bg-[var(--color-primary)] hover:text-white transition-colors group"
          aria-label="Mark done"
        >
          {loading === 'done' ? (
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 text-[var(--color-primary)] group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {/* Action row */}
      <div className="flex gap-3 mt-3 pt-3 border-t border-[var(--color-border)]">
        <button
          onClick={snoozeWeek}
          disabled={!!loading}
          className="text-xs text-[var(--color-text)] opacity-40 hover:opacity-70 transition-opacity"
        >
          Snooze 1 week
        </button>
        <button
          onClick={() => act('dismissed')}
          disabled={!!loading}
          className="text-xs text-[var(--color-text)] opacity-40 hover:opacity-70 transition-opacity"
        >
          Dismiss
        </button>
      </div>
    </motion.div>
  );
}
