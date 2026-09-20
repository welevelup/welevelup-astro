// Minimal real-content data source for campaign summaries shown on the
// homepage (featured block + ticker + petitions grid). No live petition API
// exists anywhere in this repo — every existing campaign page hardcodes its
// own signature count as static text (e.g. nomorelyes-2.astro's
// "6,400+ signatures"). This file follows that same manually-maintained
// convention, but centralises it so templates read from data instead of
// hardcoding which campaign is featured.

export interface CampaignSummary {
  slug: string;
  name: string;
  tag: string;
  /** Internal campaign page — used by "Learn more" / "Read more" links. */
  href: string;
  /** External petition platform URL — used by "Sign the petition" buttons.
      Every campaign page links its real "Sign the petition" CTA out to
      yourmovement.org or movement-action.org, never to itself. */
  petitionHref: string;
  /** Shown in the homepage's "latest campaign" block. Exactly one should be true. */
  featured?: boolean;
  signatures: number;
  /** When set, this campaign can be shown in the live-goal Ticker. */
  goal?: number;
  intro: string;
  imageSrc: string;
  imageAlt: string;
}

export const CAMPAIGNS: CampaignSummary[] = [
  {
    slug: 'nomorelyes-2',
    name: '#NoMoreLyes',
    tag: '#NoMoreLyes',
    href: '/active-campaigns/nomorelyes-2',
    petitionHref: 'https://levelup.yourmovement.org/p/no-more-lyes',
    featured: true,
    signatures: 6400,
    intro:
      "Big beauty brands like L'Oréal must remove toxic ingredients from hair relaxers.",
    imageSrc: '/wp-content/uploads/2025/08/NML11-2.webp',
    imageAlt:
      "Black woman's hands during a hair treatment, highlighting research showing that most Black British women do not trust lye-based hair relaxer products.",
  },
  {
    slug: 'abortion-is-healthcare',
    name: 'Abortion is Healthcare',
    tag: 'Abortion is Healthcare',
    href: '/active-campaigns/abortion-is-healthcare',
    petitionHref: 'https://levelup.yourmovement.org/p/abortion-is-healthcare',
    signatures: 6100,
    // Exact quote from abortion-is-healthcare.astro's own aim paragraph — not the
    // generic mockup placeholder text, which repeats the same line on every card.
    intro: 'Free, safe, legal and local access to abortion for all people in Britain.',
    imageSrc: 'https://welevelup.org/wp-content/uploads/2025/08/Screenshot-2024-06-14-at-12-1.webp',
    imageAlt: 'Abortion is Healthcare campaign supporters',
  },
  {
    slug: 'pregnancy-in-prison',
    name: 'Pregnancy in Prison',
    tag: 'Pregnancy in Prison',
    href: '/active-campaigns/pregnancy-in-prison',
    petitionHref: 'https://levelup.yourmovement.org/p/pregnancy-in-prison',
    signatures: 13100,
    // Exact quote from pregnancy-in-prison.astro.
    intro: "Let's end the imprisonment of pregnant women.",
    imageSrc: '/wp-content/uploads/2025/08/story-4-thumb-1-1920x1080-1.png',
    imageAlt: 'Pregnancy in Prison campaign',
  },
  {
    slug: 'sexual-violence-in-football',
    name: 'Sexual Violence in Football',
    tag: 'Sexual Violence in Football',
    href: '/active-campaigns/sexual-violence-in-football',
    petitionHref: 'https://levelup.movement-action.org/p/sexual-violence-in-football',
    signatures: 4300,
    // Exact quote from sexual-violence-in-football.astro.
    intro: 'End the culture of gender-based violence in football.',
    imageSrc: '/wp-content/uploads/2025/08/5184.jpg',
    imageAlt: 'Sexual Violence in Football campaign',
  },
  {
    // Matches the homepage ticker in the mockup exactly: "2,062 of 5,000 signatures".
    slug: 'islington-council-finish-holloway-womens-centre',
    name: "Islington Council: Finish Holloway Women's Centre",
    tag: 'Holloway Women’s Centre',
    href: '/active-campaigns/islington-council-finish-holloway-womens-centre',
    petitionHref: 'https://levelup.yourmovement.org/p/islington-council-finish-holloway-womens-centre',
    signatures: 2062,
    goal: 5000,
    // Exact quote from islington-council-finish-holloway-womens-centre.astro's aim paragraph.
    intro:
      "Force Islington Council to keep their promise and deliver the Holloway Women's Centre — a safe space and vital services for women in London who need them most.",
    imageSrc: '/wp-content/uploads/2026/02/screenshot_2026-03-13_at_11.37.42_720.png',
    imageAlt: "Holloway Women's Centre campaign",
  },
];

export const FEATURED_CAMPAIGN = CAMPAIGNS.find((c) => c.featured) ?? CAMPAIGNS[0];
export const TICKER_CAMPAIGN = CAMPAIGNS.find((c) => c.goal !== undefined);
