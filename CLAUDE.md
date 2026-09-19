# Level Up website: brand rules (2026 refresh)

These rules apply to every change in this repo. If a request conflicts with them, stop and ask.

## Branch and deploy
- All redesign work goes on the `redesign-2026` branch and is deployed as a Vercel preview. Never commit to main, never merge, and never change production domains or env vars.
- **Don't touch the donation/payment integration logic, petition submission logic, or form handlers.** Restyle only.
- Keep all existing URLs, content, and functionality unless told otherwise.

## Source of truth
- Guidelines PDF: `docs/brand/Level-up-Web-Style-Guidelines.pdf`
- Mockups: `docs/brand/mockups/` (homepage `-16`, campaign page `-19`, press section `-22`). They are @2x (3840 px wide = 1920 layout).
- The mockups are the reference for the pages they show. The guidelines govern everything else. When the two disagree, follow the mockup and log it in `docs/brand/DEVIATIONS.md`.
- The approved `/styleguide` page is the reference for components. Reuse them and don't create one-off styles.

## Colour tokens
```
--gentle-lilac:       #a89ced
--deep-navy:          #0c0a3e
--off-white:          #fffdf0
--loud-lilac:         #4930d9
--electric-yellow:    #ccff33
--pale-gentle-yellow: #fcf9d8
--white:              #ffffff  (secondary boxes on off-white only)
```
No other UI colours. Pink appears only inside collage artwork and is never used as a background or UI colour.

## Allowed text-on-background pairings (strict, for accessibility)
| Background | Text allowed |
|---|---|
| Gentle Lilac | Deep Navy · Off-white (large text only) |
| Deep Navy | Electric Yellow · Gentle Lilac · Off-white |
| Off-white | Deep Navy |
| Loud Lilac | Electric Yellow · Off-white |
| Electric Yellow | Deep Navy · Loud Lilac |
| Pale Gentle Yellow | Deep Navy |

- Gentle Lilac is used only with Deep Navy or Off-white.
- Don't place high-contrast bright colours next to each other: no Gentle Lilac + Loud Lilac, and no Electric Yellow + Loud Lilac boxes/backgrounds.
- Ratios: put the bright colours (Loud Lilac, Gentle Lilac, Electric Yellow) at the start and end of pages, on headlines and CTA boxes. Most body copy sits on Off-white or Pale Gentle Yellow, and sometimes on Deep Navy.
- Use Pale Gentle Yellow to break up long runs of off-white sections.
- Every pairing must pass WCAG AA. Run `npm run check:contrast` before committing.

## Typography
- **Headline:** Corsia Display, ALL CAPS. Max 3 lines or about 6 words.
- **Sub-headline:** Corsia Display, sentence case.
- **Body:** DM Sans Regular/Bold, sentence case.
- **Label:** DM Sans ALL CAPS, small, with letter-spacing.
- **Highlight box:** Electric Yellow block behind Deep Navy text.
  - Use it on the caps headline when the section has both a caps headline and a sentence-case sub-headline.
  - Use it on a caps label when the section has neither.
- Buttons and card titles use Corsia sentence case.
- Fonts are self-hosted woff2 with `font-display: swap`, and Corsia is preloaded.

## Layout
- Two-column grid at roughly **2:5**: headline (+ collage) on the left, body on the right.
- Three columns when needed, e.g. petition cards.
- Mobile is a single column and left-aligned. Everything is left-aligned; don't centre body copy.
- Paragraphs align to the headline edge.

## Texture and collages
- Apply the bitmap texture over **every block of colour**, using the texture tinted for that colour. It must never reduce contrast.
- Collages go next to Corsia caps headlines in hero-type sections. They are decorative, so use `alt=""`.

## Components
- Buttons are square-cornered solid blocks with Corsia sentence-case text. Pick the colour from the allowed pairings.
- Alternate button: Corsia text with an Electric Yellow underline bar, or a standalone `→`. Use it where there are already many buttons, e.g. under a set of cards.
- Image frames match the image's proportions or are removed. No lime or broken borders.
- Timelines use one colour for the bar, dark text on light backgrounds, and text never overlaps the year markers.

## Quality
- Check responsive layouts at 375 / 768 / 1280 / 1920 px.
- One `h1` per page, semantic headings, visible focus ring in brand colours, keyboard-accessible menu, `prefers-reduced-motion` respected.
- Images through Astro `<Image>` (WebP/AVIF), lazy-load media below the fold, use `youtube-nocookie.com` embeds.
- Before saying a page is done, take Playwright screenshots at 1920 and 375 px and check them.
- Commit in small, logical steps.
