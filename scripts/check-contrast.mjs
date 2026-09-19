#!/usr/bin/env node
// Fails the build if any *allowed* bg/text pairing (as declared in
// src/lib/brand-colors.ts) doesn't actually meet WCAG AA. Guards against a
// future hex edit silently breaking accessibility — the pairing list itself
// is sourced from the Level-up-Web-Style-Guidelines.pdf, not invented here.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(__dirname, '../src/lib/brand-colors.ts'), 'utf8');

function extractObjectLiteral(src, exportName) {
  const start = src.indexOf(`export const ${exportName}`);
  if (start === -1) throw new Error(`Could not find ${exportName} in brand-colors.ts`);
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(braceStart, i + 1);
    }
  }
  throw new Error(`Unbalanced braces reading ${exportName}`);
}

function parseColors(literal) {
  const colors = {};
  for (const m of literal.matchAll(/['"]?([\w-]+)['"]?:\s*['"]#([0-9a-fA-F]{6})['"]/g)) {
    colors[m[1]] = `#${m[2]}`;
  }
  return colors;
}

function parsePairings(literal) {
  const pairings = {};
  for (const m of literal.matchAll(/['"]?([\w-]+)['"]?:\s*\[([^\]]*)\]/g)) {
    const [, bg, list] = m;
    pairings[bg] = [...list.matchAll(/['"]([\w-]+)['"]/g)].map((x) => x[1]);
  }
  return pairings;
}

const colors = parseColors(extractObjectLiteral(source, 'BRAND_COLORS'));
const pairings = parsePairings(extractObjectLiteral(source, 'ALLOWED_PAIRINGS'));

function extractArrayLiteral(src, exportName) {
  const start = src.indexOf(`export const ${exportName}`);
  if (start === -1) throw new Error(`Could not find ${exportName} in brand-colors.ts`);
  const equalsIdx = src.indexOf('=', start);
  const bracketStart = src.indexOf('[', equalsIdx);
  let depth = 0;
  for (let i = bracketStart; i < src.length; i++) {
    if (src[i] === '[') depth++;
    if (src[i] === ']') {
      depth--;
      if (depth === 0) return src.slice(bracketStart, i + 1);
    }
  }
  throw new Error(`Unbalanced brackets reading ${exportName}`);
}

const largeTextOnly = new Set(
  [...extractArrayLiteral(source, 'LARGE_TEXT_ONLY_PAIRINGS').matchAll(
    /\[\s*['"]([\w-]+)['"]\s*,\s*['"]([\w-]+)['"]\s*\]/g
  )].map((m) => `${m[1]}:${m[2]}`)
);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]) {
  const [rl, gl, bl] = [r, g, b].map(srgbToLinear);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

const MIN_AA_SMALL = 4.5;
const MIN_AA_LARGE = 3.0;
const failures = [];

for (const [bg, texts] of Object.entries(pairings)) {
  for (const text of texts) {
    const bgHex = colors[bg];
    const textHex = colors[text];
    if (!bgHex || !textHex) {
      failures.push(`Unknown colour name in pairing: ${bg} / ${text}`);
      continue;
    }
    const isLargeOnly = largeTextOnly.has(`${bg}:${text}`);
    const threshold = isLargeOnly ? MIN_AA_LARGE : MIN_AA_SMALL;
    const ratio = contrastRatio(bgHex, textHex);
    const label = isLargeOnly ? 'large text' : 'small/large text';
    if (ratio < threshold) {
      failures.push(
        `${text} on ${bg} (${textHex} on ${bgHex}) = ${ratio.toFixed(2)}:1, below WCAG AA ${threshold}:1 for ${label}`
      );
    } else {
      console.log(`OK  ${text} on ${bg} (${label}): ${ratio.toFixed(2)}:1`);
    }
  }
}

if (failures.length > 0) {
  console.error('\nContrast check FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nAll allowed pairings pass WCAG AA.');
