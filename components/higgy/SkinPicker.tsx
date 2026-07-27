'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SKINS, type SkinKey } from '@/lib/skins';
import { SKIN_UNLOCK_LEVELS, isSkinUnlocked } from '@/lib/virtue';
import { setSkin } from '@/app/actions/profile';

interface SkinPickerProps {
  profileId:    string;
  currentSkin:  SkinKey;
  virtueLevel:  number;
}

export function SkinPicker({ profileId, currentSkin, virtueLevel }: SkinPickerProps) {
  const [active, setActive] = useState<SkinKey>(currentSkin);
  const [saving, setSaving] = useState(false);

  async function handlePick(key: SkinKey) {
    if (!isSkinUnlocked(key, virtueLevel) || key === active) return;
    setSaving(true);
    await setSkin(profileId, key);
    setActive(key);
    setSaving(false);
    // Apply immediately on client
    document.documentElement.className = document.documentElement.className
      .replace(/skin-\S+/g, '').trim() + ` skin-${key}`;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {SKINS.map(skin => {
        const unlocked = isSkinUnlocked(skin.key, virtueLevel);
        const isActive = skin.key === active;
        const level    = SKIN_UNLOCK_LEVELS[skin.key];

        return (
          <motion.button
            key={skin.key}
            whileTap={unlocked ? { scale: 0.95 } : {}}
            onClick={() => handlePick(skin.key)}
            disabled={!unlocked || saving}
            className={`relative rounded-xl p-3 text-left transition-all border-2 ${
              isActive
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                : unlocked
                  ? 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                  : 'border-[var(--color-border)] opacity-40'
            }`}
          >
            <div className={`skin-${skin.key} rounded-lg p-2 mb-2 bg-[var(--color-bg)]`}>
              <div className="w-full h-8 rounded bg-[var(--color-primary)]/40" />
            </div>

            <p className="font-semibold text-[var(--color-text)] text-sm leading-tight">
              {skin.name}
            </p>
            <p className="text-xs text-[var(--color-text)] opacity-50 mt-0.5 line-clamp-1">
              {skin.desc}
            </p>

            {!unlocked && (
              <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/20">
                <span className="text-xs font-bold text-white bg-black/50 rounded-full px-2 py-1">
                  L{level}
                </span>
              </div>
            )}
            {isActive && (
              <span className="absolute top-2 right-2 text-[var(--color-primary)] text-lg leading-none">✓</span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
