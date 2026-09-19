import type { BgColor } from './brand-colors';

// Only 3 texture source files exist for 6 background colours (style guide
// only shipped Deep Navy+Loud Lilac, Gentle Lilac, and Off-white tints).
// Mapping below is an interpretation, not spec — flagged for designer
// confirmation: dark tint doubles up for navy+loud-lilac (both saturated,
// dark-ish), the lilac tint doubles up for electric-yellow (both the
// brighter accent colours), and the off-white tint doubles up for
// pale-yellow (both near-white).
export const TEXTURE_FOR_BG: Record<BgColor, string> = {
  navy: '/textures/texture-navy-loud-lilac.webp',
  'loud-lilac': '/textures/texture-navy-loud-lilac.webp',
  'gentle-lilac': '/textures/texture-gentle-lilac.webp',
  'electric-yellow': '/textures/texture-gentle-lilac.webp',
  'off-white': '/textures/texture-off-white.webp',
  'pale-yellow': '/textures/texture-off-white.webp',
  white: '/textures/texture-off-white.webp',
};
