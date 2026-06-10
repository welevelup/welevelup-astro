// Generates the default Open Graph / social-share card (1200x630).
// One-off, reproducible: run `node scripts/generate-og.mjs` to regenerate
// public/images/og-default.jpg. Brand: navy #0C0A3E + lime #CCFF33 + cream #EEEBD3.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'images', 'og-default.jpg');

const NAVY = '#0C0A3E';
const LIME = '#CCFF33';
const CREAM = '#EEEBD3';
const PURPLE = '#A89CED';

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${NAVY}"/>
  <rect x="0" y="0" width="14" height="630" fill="${LIME}"/>
  <text x="80" y="150" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700"
        letter-spacing="6" fill="${PURPLE}">SUPPORT THE WORK · WELEVELUP.ORG</text>
  <text x="76" y="320" font-family="Helvetica, Arial, sans-serif" font-size="150" font-weight="800"
        letter-spacing="-5" fill="${LIME}">Level Up</text>
  <text x="80" y="430" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="700"
        fill="${CREAM}">Feminist campaigning for</text>
  <text x="80" y="488" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="700"
        fill="${CREAM}">gender justice in the UK</text>
  <rect x="80" y="540" width="120" height="6" fill="${LIME}"/>
</svg>`;

await sharp(Buffer.from(svg))
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`OG written: ${OUT} (${meta.width}x${meta.height})`);
