import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('https://github.com/welevelup/welevelup-astro/tree/staging', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/crojasu/Desktop/levelup/levelup-astro/staging-tree.png' });
  await browser.close();
  console.log('✅ Screenshot saved to staging-tree.png');
})();
