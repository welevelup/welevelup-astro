# Mockup vs. style-guide deviations

Per `02-mockup-pages.md`: "The mockups are the reference for the pages they show. The guidelines govern everything else. When the two disagree, follow the mockup." Logged here as instructed.

## 1. Featured petition card button colour

**Where:** Homepage "Sign our petitions" section, featured (Electric Yellow) petition cards.

**What the mockup shows:** An Electric Yellow card body with a Loud Lilac "Sign the petition" button.

**What the guide says:** The Colour page explicitly lists "no Electric Yellow and Loud Lilac" as a forbidden adjacent pairing, to avoid overstimulating combinations.

**Resolution:** Followed the mockup — Loud Lilac button on the Electric Yellow card. The button's own text colour (off-white) is a guide-allowed pairing for Loud Lilac backgrounds, so there's no WCAG contrast failure; this is purely the "don't place these two colour blocks next to each other" adjacency rule being broken, not an accessibility failure.

## 2. Header "Join us" button colour on Loud Lilac

**Where:** Homepage hero header and the campaign-page header (both use a Loud Lilac bar).

**What the mockup shows:** A Gentle Lilac "Join us" button/text sitting on the Loud Lilac header bar.

**What the guide says:** "Gentle Lilac to only be used with Deep Navy or off-white" — Loud Lilac isn't one of the two colours Gentle Lilac is allowed next to.

**Resolution:** Followed the mockup — `Header.astro` renders the "Join us" pill as Gentle Lilac background with Navy text directly on the Loud Lilac header bar (on Navy hero backgrounds too). Navy text on Gentle Lilac is itself a guide-allowed pairing, so again this is the adjacency rule being broken (two colour blocks touching that the guide says shouldn't), not a text-contrast failure. The homepage's separate "Join the Level Up community" CTA section (on a Navy `Section`, not the header) is unaffected by this and uses the same Gentle Lilac/Navy button without any adjacency issue at all, since Navy+Gentle-Lilac is fully compliant.
