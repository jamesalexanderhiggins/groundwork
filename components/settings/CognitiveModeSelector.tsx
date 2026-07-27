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

interface CognitiveModesSelectorProps {
  profileId:    string;
  currentMode:  CognitiveMode;
}

export function CognitiveModeSelector({ profileId, currentMode }: CognitiveModesSelectorProps) {
  const [active,  setActive]  = useState<CognitiveMode>(currentMode);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  async function handleSelect(mode: CognitiveMode) {
    if (mode === active) return;
    setSaving(true);
    setSaved(false);
    await updateCognitiveMode(profileId, mode);
    setActive(mode);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      {MODES.map(m => (
        <motion.button
          key={m.key}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleSelect(m.key)}
          disabled={saving}
          className={`flex items-start gap-3 rounded-xl p-3 text-left border-2 transition-colors ${
            active === m.key
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <span className="text-2xl flex-shrink-0 mt-0.5">{m.emoji}</span>
          <div>
            <p className={`font-semibold text-sm ${active === m.key ? 'text-indigo-700' : 'text-gray-800'}`}>
              {m.label}
              {active === m.key && <span className="ml-2 text-xs font-normal text-indigo-500">Active</span>}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
          </div>
        </motion.button>
      ))}

      {saved && (
        <p className="text-xs text-center text-green-600 mt-1">Saved!</p>
      )}
    </div>
  );
}
