'use client';

import type { SkinKey } from './skins';

// Skin-specific sound tuning (frequency, reverb, waveform) for Web Audio synthesis
const SKIN_SOUND_PROFILE: Record<SkinKey, { freq: number; wave: OscillatorType; decay: number }> = {
  cloud_kingdom:  { freq: 523,  wave: 'sine',     decay: 0.4 },
  rainbow_studio: { freq: 659,  wave: 'sine',     decay: 0.3 },
  deep_ocean:     { freq: 392,  wave: 'sine',     decay: 0.7 },
  space_command:  { freq: 294,  wave: 'sawtooth', decay: 0.5 },
  cyber_pulse:    { freq: 880,  wave: 'square',   decay: 0.25 },
  jungle_quest:   { freq: 440,  wave: 'triangle', decay: 0.5 },
  first_person:   { freq: 349,  wave: 'sawtooth', decay: 0.3 },
  pixel_world:    { freq: 784,  wave: 'square',   decay: 0.2 },
  zen_garden:     { freq: 432,  wave: 'sine',     decay: 0.9 },
  dark_knight:    { freq: 220,  wave: 'sawtooth', decay: 0.6 },
};

type SoundEvent = 'complete' | 'bonus' | 'gate' | 'badge' | 'level_up';

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch { return null; }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  wave: OscillatorType,
  decay: number,
  gain: number,
  offset = 0,
) {
  const osc  = ctx.createOscillator();
  const env  = ctx.createGain();
  osc.connect(env);
  env.connect(ctx.destination);
  osc.type      = wave;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(gain, ctx.currentTime + offset);
  env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + decay);
  osc.start(ctx.currentTime + offset);
  osc.stop(ctx.currentTime  + offset + decay + 0.05);
}

export const SoundManager = {
  muted: false,

  play(event: SoundEvent, skin: SkinKey = 'cloud_kingdom') {
    if (this.muted) return;
    const ctx = getCtx();
    if (!ctx) return;

    const p = SKIN_SOUND_PROFILE[skin];

    switch (event) {
      case 'complete':
        playTone(ctx, p.freq,        p.wave, p.decay,       0.18);
        playTone(ctx, p.freq * 1.5,  p.wave, p.decay * 0.6, 0.10, p.decay * 0.5);
        break;
      case 'bonus':
        [0, 0.08, 0.16].forEach((t, i) =>
          playTone(ctx, p.freq * [1, 1.25, 1.5][i], p.wave, 0.2, 0.14, t),
        );
        break;
      case 'gate':
        playTone(ctx, p.freq,       p.wave, 0.5,  0.15);
        playTone(ctx, p.freq * 1.2, p.wave, 0.5,  0.12, 0.15);
        playTone(ctx, p.freq * 1.5, p.wave, 0.7,  0.18, 0.30);
        break;
      case 'badge':
        [0, 0.1, 0.2, 0.35].forEach((t, i) =>
          playTone(ctx, p.freq * [1, 1.2, 1.5, 2][i], 'sine', 0.35, 0.15, t),
        );
        break;
      case 'level_up':
        [0, 0.12, 0.24, 0.38, 0.55].forEach((t, i) =>
          playTone(ctx, p.freq * [1, 1.12, 1.26, 1.5, 2][i], 'sine', 0.5, 0.18, t),
        );
        break;
    }

    // Close context after sounds finish to free resources
    setTimeout(() => ctx.close(), 2000);
  },

  toggle() { this.muted = !this.muted; },
};
