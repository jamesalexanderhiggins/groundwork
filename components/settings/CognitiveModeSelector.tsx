'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { updateCognitiveMode, type CognitiveMode } from '@/app/actions/settings';

const MODES: { key: CognitiveMode; label: string; desc: string; emoji: string }[] = [
  { key: 'standard', emoji: '🧠', label: 'Standard',  desc: 'Warm, clear, conversational.' },
  { key: 'adhd',     emoji: '⚡', label: 'ADHD',      desc: 'One task at a time. Fast feedback. Short text.' },
  { key: 'autism',   emoji: '🎯', label: 'Autism',    desc: 'Literal, precise, consistent. No idioms.' },
  { key: 'dyslexia', emoji: '📖', label: 'Dyslexia',  desc: 'Short sentences. Simple words. Generous spacing.' },
  { key: 'calm',     emoji: '🌿', label: 'Calm',      desc: 'Gentle pacing. No pressure. Always permission to do less.' },
];

interface CognitiveModeSelectorProps {
  profileId:   string;
  currentMode: CognitiveMode;
}

export function CognitiveModeSelector({ profileId, currentMode }: CognitiveModeSelectorProps) {
  const [active, setActive] = useState<CognitiveMode>(currentMode);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  async function handleSelect(mode: CognitiveMode) {
    if (mode === active || saving) return;
    setSaving(true);
    setSaved(false);
    setError('');

    // The result was previously ignored, so a rejected change still
    // showed "Saved!" and then reverted on reload.
    const result = await updateCognitiveMode(profileId, mode);
    setSaving(false);

    if (result && 'error' in result && result.error) {
      setError(result.error);
      return;
    }

    setActive(mode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}

      <div role="radiogroup" aria-label="Cognitive mode" className="flex flex-col gap-2">
        {MODES.map(m => {
          const isActive = active === m.key;
          return (
            <motion.button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(m.key)}
              disabled={saving}
              className={`
                flex items-start gap-3 rounded-[var(--border-radius)] p-3 text-left
                border-2 transition-colors disabled:opacity-60
                ${isActive
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)]/50'
                }
              `}
            >
              <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">{m.emoji}</span>
              <div className="min-w-0">
                <p className={`font-semibold text-sm ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                  {m.label}
                  {isActive && (
                    <span className="ml-2 text-xs font-normal opacity-70">Active</span>
                  )}
                </p>
                <p className="text-xs opacity-55 mt-0.5 text-[var(--color-text)]">{m.desc}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <p
        className={`text-xs text-center mt-1 transition-opacity text-[var(--color-success)] ${saved ? 'opacity-100' : 'opacity-0'}`}
        role="status"
      >
        Saved
      </p>
    </div>
  );
}
