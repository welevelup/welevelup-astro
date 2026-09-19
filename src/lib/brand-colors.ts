// Single source of truth for the 2026 brand refresh colour palette and the
// bg -> text pairings allowed by the style guide (Level-up-Web-Style-Guidelines.pdf,
// "Colour" page). Components must resolve pairings through ALLOWED_PAIRINGS rather
// than accepting a free-form text colour, so an invalid combo can't be authored.

export const BRAND_COLORS = {
  navy: '#0c0a3e',
  'off-white': '#fffdf0',
  'gentle-lilac': '#a89ced',
  'loud-lilac': '#4930d9',
  'electric-yellow': '#ccff33',
  'pale-yellow': '#fcf9d8',
  // Secondary boxes on an off-white section only (PDF Components page: "Option
  // to have a pure white box on an off-white background as a secondary set of
  // boxes"; confirmed as a named token in CLAUDE.md).
  white: '#ffffff',
} as const;

export type ColorName = keyof typeof BRAND_COLORS;

export const ALLOWED_PAIRINGS = {
  navy: ['electric-yellow', 'gentle-lilac', 'off-white'],
  'gentle-lilac': ['navy', 'off-white'],
  'off-white': ['navy'],
  'loud-lilac': ['electric-yellow', 'off-white'],
  'electric-yellow': ['navy', 'loud-lilac'],
  'pale-yellow': ['navy'],
  white: ['navy'],
} as const satisfies Record<ColorName, readonly ColorName[]>;

export type BgColor = keyof typeof ALLOWED_PAIRINGS;
export type TextColor<Bg extends BgColor = BgColor> = (typeof ALLOWED_PAIRINGS)[Bg][number];

export function isAllowedPairing(bg: BgColor, text: ColorName): boolean {
  return (ALLOWED_PAIRINGS[bg] as readonly ColorName[]).includes(text);
}

// Pairings the style guide restricts to "large text" only (its Colour page:
// "Off-white | Large text" under Gentle Lilac, vs "Large & Small text" for
// every other swatch). check-contrast.mjs holds these to the WCAG AA
// large-text threshold (3:1) instead of the small-text one (4.5:1); every
// other allowed pairing is assumed usable at both sizes.
export const LARGE_TEXT_ONLY_PAIRINGS: ReadonlyArray<readonly [BgColor, ColorName]> = [
  ['gentle-lilac', 'off-white'],
];

// Colour blocks the style guide says must never sit next to each other
// (too high-contrast / overstimulating) — used by the contrast script and
// available for any layout logic that places two Sections side by side.
export const FORBIDDEN_ADJACENT_PAIRS: ReadonlyArray<readonly [ColorName, ColorName]> = [
  ['gentle-lilac', 'loud-lilac'],
  ['electric-yellow', 'loud-lilac'],
];
