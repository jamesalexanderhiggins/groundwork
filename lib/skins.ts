export const SKINS = [
  { key: 'cloud_kingdom',  name: 'Cloud Kingdom',   desc: 'Pastel, soft, fantasy, floating islands' },
  { key: 'rainbow_studio', name: 'Rainbow Studio',   desc: 'Bright, art-room, creative chaos' },
  { key: 'deep_ocean',     name: 'Deep Ocean',       desc: 'Cool blues, sea creatures, bioluminescent' },
  { key: 'space_command',  name: 'Space Command',    desc: 'Dark sky, stars, mission control' },
  { key: 'cyber_pulse',    name: 'Cyber Pulse',      desc: 'Green text on black, hacker, digital rain' },
  { key: 'jungle_quest',   name: 'Jungle Quest',     desc: 'Warm greens, adventure, explorer' },
  { key: 'first_person',   name: 'First Person',     desc: 'Action-game HUD, tactical, high contrast' },
  { key: 'pixel_world',    name: 'Pixel World',      desc: '8-bit retro, chiptune sound pack' },
  { key: 'zen_garden',     name: 'Zen Garden',       desc: 'Minimalist, Japanese-inspired, calm' },
  { key: 'dark_knight',    name: 'Dark Knight',      desc: 'Gothic, dark fantasy, dramatic' },
] as const;

export type SkinKey = typeof SKINS[number]['key'];

export function applySkin(skin: SkinKey) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  SKINS.forEach(s => html.classList.remove(`skin-${s.key}`));
  html.classList.add(`skin-${skin}`);
}
