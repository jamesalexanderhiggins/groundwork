'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  writeSensoryPrefs, applySensoryPrefs,
  subscribeSensory, getSensorySnapshot, getSensoryServerSnapshot,
} from '@/lib/sensory';
import { SoundManager } from '@/lib/sounds';

/**
 * Sound and motion toggles.
 *
 * The whitepaper lists these as first-class controls under neurodivergent
 * design — "All sounds can be disabled. Animations can be reduced or
 * disabled." SoundManager had a toggle() from the start but nothing in the
 * UI ever called it, and the flag reset on every page load.
 *
 * Stored per device, so a child can have sound on at home and off at school.
 */
export function SensoryControls({ skin = 'cloud_kingdom' }: { skin?: string }) {
  // localStorage is an external store. Reading it through
  // useSyncExternalStore avoids copying it into state inside an effect,
  // which caused a cascading render.
  const { sound, motion } = useSyncExternalStore(
    subscribeSensory,
    getSensorySnapshot,
    getSensoryServerSnapshot,
  );

  useEffect(() => { applySensoryPrefs(); }, [sound, motion]);

  function toggleSound(next: boolean) {
    writeSensoryPrefs({ sound: next });
    // Play a confirmation so the effect is immediately obvious.
    if (next) SoundManager.play('complete', skin as never);
  }

  function toggleMotion(next: boolean) {
    writeSensoryPrefs({ motion: next });
  }

  return (
    <div className="flex flex-col gap-2">
      <Toggle
        label="Sounds"
        hint="Coin drops, gate fanfares and badge chimes."
        icon={sound ? '🔊' : '🔇'}
        checked={sound}
        onChange={toggleSound}
      />
      <Toggle
        label="Animations"
        hint="Turn off if movement is distracting or uncomfortable."
        icon={motion ? '✨' : '⏸️'}
        checked={motion}
        onChange={toggleMotion}
      />
      <p className="text-xs opacity-45 text-[var(--color-text)] mt-1">
        Saved on this device only. Other devices keep their own settings.
      </p>
    </div>
  );
}

function Toggle({
  label, hint, icon, checked, onChange,
}: {
  label: string; hint: string; icon: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 rounded-[var(--border-radius)] p-3 text-left border-2 border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)]/50 transition-colors min-h-[44px] disabled:opacity-50"
    >
      <span className="text-xl" aria-hidden="true">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-sm text-[var(--color-text)]">{label}</span>
        <span className="block text-xs opacity-55 text-[var(--color-text)]">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
          checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}
