import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'hybrid',
  adapter: vercel(),
  site: 'https://welevelup.org',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [sitemap()],
});
