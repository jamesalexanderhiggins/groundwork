'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/shared/Button';
import { createLifeItem, type LifeItemInput } from '@/app/actions/life-items';
import type { UserContext } from '@/lib/ai';

interface NaturalLanguageInputProps {
  profileId: string;
  context:   UserContext;
  /** When false the AI parse step is skipped entirely. */
  aiEnabled?: boolean;
  onAdded?:  (item: LifeItemInput & { id: string }) => void;
}

const CATEGORY_STYLES: Record<string, string> = {
  health:   'bg-emerald-100 text-emerald-800',
  finance:  'bg-amber-100 text-amber-800',
  admin:    'bg-sky-100 text-sky-800',
  home:     'bg-orange-100 text-orange-800',
  security: 'bg-rose-100 text-rose-800',
  other:    'bg-slate-100 text-slate-700',
};

export function NaturalLanguageInput({
  profileId, context, aiEnabled = true, onAdded,
}: NaturalLanguageInputProps) {
  const [text,    setText]    = useState('');
  const [parsed,  setParsed]  = useState<LifeItemInput | null>(null);
  const [step,    setStep]    = useState<'input' | 'preview' | 'done'>('input');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Save the raw text as a plain item, no AI involved. */
  async function saveDirect(raw: string) {
    const res = await createLifeItem(profileId, {
      title: raw.trim().slice(0, 200),
      ai_generated: false,
    });
    if (res.error) { setError(res.error); return false; }
    if (res.item) onAdded?.(res.item);
    return true;
  }

  async function handleAdd() {
    const raw = text.trim();
    if (!raw) return;

    setLoading(true);
    setError(null);

    // Without an API key the parse endpoint returns 503. Falling through to
    // a direct save keeps the list usable instead of blocking every add.
    if (!aiEnabled) {
      const ok = await saveDirect(raw);
      setLoading(false);
      if (!ok) return;
      finish();
      return;
    }

    try {
      const res = await fetch('/api/ai/parse-input', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: raw, context }),
      });

      if (res.status === 503) {
        const ok = await saveDirect(raw);
        setLoading(false);
        if (ok) finish();
        return;
      }

      const data = await res.json();
      if (!res.ok || data.error || !data.title) {
        const ok = await saveDirect(raw);
        setLoading(false);
        if (ok) finish();
        return;
      }

      setParsed(data);
      setStep('preview');
    } catch {
      const ok = await saveDirect(raw);
      if (ok) finish();
    }
    setLoading(false);
  }

  function finish() {
    setText('');
    setParsed(null);
    setStep('done');
    setTimeout(() => setStep('input'), 1200);
  }

  async function handleSave() {
    if (!parsed) return;
    setLoading(true);
    const res = await createLifeItem(profileId, { ...parsed, ai_generated: true });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    if (res.item) onAdded?.(res.item);
    finish();
  }

  function handleEdit() {
    setStep('input');
    setParsed(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const catStyle = parsed?.category
    ? (CATEGORY_STYLES[parsed.category] ?? CATEGORY_STYLES.other)
    : CATEGORY_STYLES.other;

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="wait">
        {step === 'input' && (
          <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex gap-2">
              <label htmlFor="life-item-input" className="sr-only">
                Add something to your list
              </label>
              <textarea
                id="life-item-input"
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); }
                }}
                rows={2}
                maxLength={500}
                placeholder={aiEnabled
                  ? 'e.g. Book dentist for next month, service the car every 6 months…'
                  : 'e.g. Book the dentist'}
                className="flex-1 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text)] p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <Button
                onClick={handleAdd}
                loading={loading}
                disabled={!text.trim()}
                className="self-end"
              >
                Add
              </Button>
            </div>
            {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
          </motion.div>
        )}

        {step === 'preview' && parsed && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[var(--border-radius)] p-4 flex flex-col gap-3"
          >
            <div>
              <p className="font-semibold text-[var(--color-text)]">{parsed.title}</p>
              {parsed.body && (
                <p className="text-sm text-[var(--color-text)] opacity-60 mt-0.5">{parsed.body}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {parsed.category && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catStyle}`}>
                    {parsed.category}
                  </span>
                )}
                {parsed.due_at && (
                  <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                    Due {new Date(parsed.due_at).toLocaleDateString()}
                  </span>
                )}
                {parsed.recurrence_pattern && (
                  <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                    Recurring
                  </span>
                )}
              </div>
            </div>

            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button onClick={handleSave} loading={loading} className="flex-1">
                Save item
              </Button>
              <button
                type="button"
                onClick={handleEdit}
                className="text-sm px-4 rounded-[var(--border-radius)] border border-[var(--color-border)] text-[var(--color-text)] opacity-60 hover:opacity-100 transition-opacity min-h-[44px]"
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
