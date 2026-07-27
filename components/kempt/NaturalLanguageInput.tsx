'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/shared/Button';
import { createLifeItem, type LifeItemInput } from '@/app/actions/life-items';
import type { UserContext } from '@/lib/ai';

interface NaturalLanguageInputProps {
  profileId: string;
  context:   UserContext;
  onAdded?:  (item: LifeItemInput & { id: string }) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  health:   'bg-green-100 text-green-700',
  finance:  'bg-yellow-100 text-yellow-700',
  admin:    'bg-blue-100 text-blue-700',
  home:     'bg-orange-100 text-orange-700',
  security: 'bg-red-100 text-red-700',
  other:    'bg-gray-100 text-gray-600',
};

export function NaturalLanguageInput({ profileId, context, onAdded }: NaturalLanguageInputProps) {
  const [text,    setText]    = useState('');
  const [parsed,  setParsed]  = useState<LifeItemInput | null>(null);
  const [step,    setStep]    = useState<'input' | 'preview' | 'done'>('input');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleParse() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/parse-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setParsed(data);
      setStep('preview');
    } catch {
      setError('Something went wrong. Try again.');
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!parsed) return;
    setLoading(true);
    const res = await createLifeItem(profileId, { ...parsed, ai_generated: true });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onAdded?.(res.item!);
    setText('');
    setParsed(null);
    setStep('done');
    setTimeout(() => setStep('input'), 1200);
  }

  function handleEdit() {
    setStep('input');
    setParsed(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const catColor = parsed?.category
    ? (CATEGORY_COLORS[parsed.category] ?? CATEGORY_COLORS.other)
    : CATEGORY_COLORS.other;

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="wait">
        {step === 'input' && (
          <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleParse(); } }}
                rows={2}
                placeholder="e.g. Book dentist for next month, schedule car service every 6 months..."
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text)] p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <Button onClick={handleParse} loading={loading} className="self-end">
                Add
              </Button>
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </motion.div>
        )}

        {step === 'preview' && parsed && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-semibold text-[var(--color-text)]">{parsed.title}</p>
                {parsed.body && (
                  <p className="text-sm text-[var(--color-text)] opacity-60 mt-0.5">{parsed.body}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {parsed.category && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColor}`}>
                      {parsed.category}
                    </span>
                  )}
                  {parsed.due_at && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                      Due {new Date(parsed.due_at).toLocaleDateString()}
                    </span>
                  )}
                  {parsed.recurrence_pattern && (
                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                      Recurring
                    </span>
                  )}
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-2">
              <Button onClick={handleSave} loading={loading} className="flex-1">
                Save item
              </Button>
              <button
                onClick={handleEdit}
                className="text-sm px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] opacity-60 hover:opacity-100 transition-opacity"
              >
                Edit
              </button>
            </div>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-3 text-[var(--color-primary)] font-medium text-sm"
          >
            ✓ Added to your list
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
