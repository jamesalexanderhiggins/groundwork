'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/shared/Button';
import { saveDraft, updateDraftStatus } from '@/app/actions/drafts';
import type { UserContext } from '@/lib/ai';

const DRAFT_TYPES = [
  { value: 'email',   label: '📧 Email' },
  { value: 'message', label: '💬 Message' },
  { value: 'letter',  label: '📄 Letter' },
  { value: 'review',  label: '⭐ Review' },
  { value: 'request', label: '🙏 Request' },
];

interface DraftEngineProps {
  profileId: string;
  context:   UserContext;
}

type Step = 'prompt' | 'generating' | 'review' | 'done';

export function DraftEngine({ profileId, context }: DraftEngineProps) {
  const [step,      setStep]      = useState<Step>('prompt');
  const [type,      setType]      = useState('email');
  const [prompt,    setPrompt]    = useState('');
  const [content,   setContent]   = useState('');
  const [draftId,   setDraftId]   = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [copied,    setCopied]    = useState(false);
  const [saving,    setSaving]    = useState(false);

  async function generate() {
    if (!prompt.trim()) return;
    setStep('generating');
    setError(null);
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, type, context }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setStep('prompt'); return; }
      setContent(data.content);
      setStep('review');
    } catch {
      setError('Generation failed. Try again.');
      setStep('prompt');
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await saveDraft(profileId, prompt, content, type);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setDraftId(res.draft!.id);
    setStep('done');
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    if (draftId) await updateDraftStatus(draftId, 'sent');
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setStep('prompt');
    setPrompt('');
    setContent('');
    setDraftId(null);
    setCopied(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence mode="wait">
        {step === 'prompt' && (
          <motion.div key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
            {/* Type selector */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DRAFT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                    type === t.value
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-border)]/30 text-[var(--color-text)] opacity-60 hover:opacity-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              placeholder={`Describe the ${type} you need... e.g. "Ask my landlord to fix the leaking tap in the bathroom, be polite but firm"`}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text)] p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button onClick={generate} disabled={!prompt.trim()}>Generate draft</Button>
          </motion.div>
        )}

        {step === 'generating' && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-8 text-center">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text)] opacity-60">Writing your {type}...</p>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={10}
              className="w-full rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-bg-card)] text-[var(--color-text)] p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleCopy} className="flex-1">
                {copied ? '✓ Copied!' : 'Copy to clipboard'}
              </Button>
              <Button onClick={handleSave} loading={saving} className="flex-1">
                Save draft
              </Button>
            </div>
            <button onClick={reset} className="text-xs text-center text-[var(--color-text)] opacity-40 hover:opacity-70">
              Start over
            </button>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-3">
            <div className="text-center py-6">
              <p className="text-4xl mb-2">✓</p>
              <p className="font-semibold text-[var(--color-text)]">Draft saved</p>
              <p className="text-sm text-[var(--color-text)] opacity-50 mt-1">Find it in your drafts list below.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCopy} className="flex-1">
                {copied ? '✓ Copied!' : 'Copy text'}
              </Button>
              <Button onClick={reset} className="flex-1">
                New draft
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
