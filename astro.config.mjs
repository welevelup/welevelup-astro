// build: 2026-05-27
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: false },
  }),
  site: 'https://welevelup.org',
  trailingSlash: 'never',
  integrations: [sitemap({
    filter: (page) => ![
      // Transactional / auth pages
      'https://welevelup.org/donate/thank-you',
      'https://welevelup.org/donor-portal',
      'https://welevelup.org/donor-portal/manage',
      'https://welevelup.org/donor-portal/cancelled',
      'https://welevelup.org/surveys/abortion-stories-complete',
      // Internal design proposals
      'https://welevelup.org/card-proposals',
      'https://welevelup.org/video-proposals',
      'https://welevelup.org/who-we-are-proposals',
      'https://welevelup.org/resources/proposal-a',
      'https://welevelup.org/resources/proposal-b',
      'https://welevelup.org/resources/proposal-c',
      // Petition pages — all redirect to yourmovement.org
      'https://welevelup.org/petition/abortion-is-healthcare',
      'https://welevelup.org/petition/dignity-for-dead-women',
      'https://welevelup.org/petition/ipso-dignity-for-dead-women',
      'https://welevelup.org/petition/islington-council-fund-holloway-womens-centre',
      'https://welevelup.org/petition/nomorelyes-take-toxic-hair-relaxers-off-the-shelves',
      'https://welevelup.org/petition/petition-premier-league-violence',
      'https://welevelup.org/petition/premier-league-and-fa',
      'https://welevelup.org/petition/stop-sending-pregnant-women-to-prison',
      // Root-level blog duplicates — canonical is /blog/* version
      'https://welevelup.org/beyond-sympathy-feminist-solidarity-without-deservingness',
      'https://welevelup.org/how-we-choose-our-campaigns',
      'https://welevelup.org/the-griefs-left-unattended',
      'https://welevelup.org/why-expanding-criminalisation-is-a-feminist-issue',
      // Old WP pages being redirected to new Astro equivalents
      'https://welevelup.org/all-resources',
      'https://welevelup.org/ddw-resources',
      'https://welevelup.org/pp-resources',
      'https://welevelup.org/abortion-is-healthcare-resources',
      'https://welevelup.org/media-guidelines',
      'https://welevelup.org/our-work',
      'https://welevelup.org/our-team',
      'https://welevelup.org/news-and-events',
    ].includes(page),
  })],
});
