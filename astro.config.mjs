// build: 2026-05-27
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  adapter: vercel(),
  site: 'https://welevelup.org',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [sitemap({
    filter: (page) => ![
      'https://welevelup.org/donate/thank-you',
      'https://welevelup.org/donor-portal/manage',
      'https://welevelup.org/donor-portal/cancelled',
    ].includes(page),
  })],
});
