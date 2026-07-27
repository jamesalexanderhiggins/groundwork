/**
 * Sensory preferences — sound and motion.
 *
 * The whitepaper treats these as first-class controls, not accessibility
 * afterthoughts: "Full sensory control: All sounds can be disabled.
 * Animations can be reduced or disabled."
 *
 * Stored per-device in localStorage rather than on the profile, because a
 * child may want sound on a tablet at home and off in the car. The OS-level
 * prefers-reduced-motion setting is honoured as the default.
 */

export const SOUND_KEY  = 'kempt.sound';
export const MOTION_KEY = 'kempt.motion';

export type SensoryPrefs = {
  sound:  boolean;
  motion: boolean;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function readSensoryPrefs(): SensoryPrefs {
  if (typeof window === 'undefined') return { sound: true, motion: true };

  const storedSound  = window.localStorage.getItem(SOUND_KEY);
  const storedMotion = window.localStorage.getItem(MOTION_KEY);

  return {
    sound:  storedSound  === null ? true : storedSound  === 'on',
    // Default to the OS preference the first time, then respect the choice.
    motion: storedMotion === null ? !prefersReducedMotion() : storedMotion === 'on',
  };
}

export function writeSensoryPrefs(prefs: Partial<SensoryPrefs>) {
  if (typeof window === 'undefined') return;
  if (prefs.sound  !== undefined) window.localStorage.setItem(SOUND_KEY,  prefs.sound  ? 'on' : 'off');
  if (prefs.motion !== undefined) window.localStorage.setItem(MOTION_KEY, prefs.motion ? 'on' : 'off');
  applySensoryPrefs();
  listeners.forEach(cb => cb());
}

// ── External store plumbing ────────────────────────────────────────
// localStorage is an external store, so components read it through
// useSyncExternalStore rather than copying it into state inside an effect.

const listeners = new Set<() => void>();

export function subscribeSensory(cb: () => void): () => void {
  listeners.add(cb);
  // Keep other tabs and windows in step
  if (typeof window !== 'undefined') window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') window.removeEventListener('storage', cb);
  };
}

// getSnapshot must return a stable reference or React will loop.
let cachedKey  = '';
let cachedSnap: SensoryPrefs = { sound: true, motion: true };

export function getSensorySnapshot(): SensoryPrefs {
  if (typeof window === 'undefined') return cachedSnap;
  const key = `${window.localStorage.getItem(SOUND_KEY)}|${window.localStorage.getItem(MOTION_KEY)}`;
  if (key !== cachedKey) {
    cachedKey  = key;
    cachedSnap = readSensoryPrefs();
  }
  return cachedSnap;
}

export function getSensoryServerSnapshot(): SensoryPrefs {
  return { sound: true, motion: true };
}

/** Reflect the current preferences onto <html> so CSS can act on them. */
export function applySensoryPrefs() {
  if (typeof document === 'undefined') return;
  const { sound, motion } = readSensoryPrefs();
  const html = document.documentElement;
  html.classList.toggle('sound-off',  !sound);
  html.classList.toggle('motion-off', !motion);
}

/** Cognitive mode drives typography and layout, not just AI tone. */
export function applyCognitiveMode(mode: string) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  ['standard', 'adhd', 'autism', 'dyslexia', 'calm']
    .forEach(m => html.classList.remove(`cog-${m}`));
  html.classList.add(`cog-${mode || 'standard'}`);
}
