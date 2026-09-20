// Step 2 visual verification: run `astro dev --port 4400` first, then
// `node scripts/screenshot-step2.mjs`. Requires `npx playwright install
// chromium` once (playwright is a devDependency added for this).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT_DIR = process.env.SCREENSHOT_DIR || '/tmp/screenshots';
const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:4400';

const pages = [
  { path: '/', name: 'homepage' },
  { path: '/active-campaigns/nomorelyes-2', name: 'nomorelyes' },
  { path: '/press', name: 'press' },
];
const widths = [1920, 375];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
for (const p of pages) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT_DIR}/${p.name}-${width}.png`, fullPage: true });
    await page.close();
    console.log(`Saved ${p.name}-${width}.png`);
  }
}
await browser.close();
