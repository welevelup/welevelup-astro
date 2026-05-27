// build: 2026-05-27
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  site: 'https://welevelup.org',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [sitemap()],
});
