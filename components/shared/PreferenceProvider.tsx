'use client';

import { useEffect } from 'react';
import { applySensoryPrefs, applyCognitiveMode } from '@/lib/sensory';

/**
 * Applies the reader's sensory and cognitive preferences to <html> on load.
 *
 * Cognitive mode comes from the profile (it follows the person across
 * devices); sound and motion come from localStorage (they belong to the
 * device). Renders nothing.
 */
export function PreferenceProvider({ cognitiveMode }: { cognitiveMode?: string }) {
  useEffect(() => {
    applySensoryPrefs();
  }, []);

  useEffect(() => {
    if (cognitiveMode) applyCognitiveMode(cognitiveMode);
  }, [cognitiveMode]);

  return null;
}
