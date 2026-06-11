/**
 * Build a Meta (Facebook/Instagram) Custom Audience file from the contact list.
 *
 * Reads data/merged_data.csv (PERSONAL DATA — stays in gitignored data/) and
 * writes data/meta-custom-audience.csv in the format Meta Ads Manager accepts
 * for a "customer list" Custom Audience. Meta hashes the values on upload; we
 * normalise them (lowercase/trim) for the best match rate, and de-duplicate by
 * email so each person is uploaded once.
 *
 * Columns produced (Meta's recognised identifiers):
 *   email, fn (first name), ln (last name), zip, country
 *
 * Usage:  npx tsx scripts/export-meta-audience.ts
 *         (optional input/output overrides as argv[2]/argv[3])
 *
 * Then in Meta Ads Manager → Audiences → Create Custom Audience → Customer list
 * → upload this file → then build a Lookalike (1%) from it.
 *
 * GDPR note: confirm your privacy policy covers advertising use of the campaign
 * contact list before uploading. Meta hashes identifiers client-side.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const inputPath = process.argv[2] ?? 'data/merged_data.csv';
const outputPath = process.argv[3] ?? 'data/meta-custom-audience.csv';

if (!existsSync(inputPath)) {
  console.error(`Input not found: ${inputPath}`);
  process.exit(1);
}

// Minimal CSV line splitter that respects double-quoted fields.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const raw = readFileSync(inputPath, 'utf8');
const lines = raw.split(/\r?\n/);
const header = splitCsvLine(lines[0]).map((h) => h.trim());

// Resolve columns, tolerating the export's duplicate/variant names.
const col = (...names: string[]): number => {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
};
const iEmail = col('EMAIL', 'email');
const iFirst = col('FIRSTNAME', 'NOMBRE', 'NAME', 'first_name');
const iLast = col('LAST_NAME', 'APELLIDOS', 'last_name');
const iZip = col('POSTCODE', 'POSTAL_CODE', 'zip');
const iCountry = col('COUNTRY', 'country');

if (iEmail === -1) {
  console.error('No EMAIL column found in ' + inputPath);
  process.exit(1);
}

const norm = (s: string | undefined) => (s ?? '').trim();
const lower = (s: string | undefined) => norm(s).toLowerCase();

const seen = new Set<string>();
const rows: string[] = ['email,fn,ln,zip,country'];
let total = 0;

for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const c = splitCsvLine(lines[i]);
  const email = lower(c[iEmail]);
  if (!email || !email.includes('@') || seen.has(email)) continue;
  seen.add(email);
  total++;

  const fn = iFirst !== -1 ? lower(c[iFirst]) : '';
  const ln = iLast !== -1 ? lower(c[iLast]) : '';
  const zip = iZip !== -1 ? lower(c[iZip]).replace(/\s+/g, '') : '';
  let country = iCountry !== -1 ? lower(c[iCountry]) : '';
  // Meta wants 2-letter country codes; default UK list to "gb".
  if (country === 'united kingdom' || country === 'uk' || country === '') country = 'gb';

  const esc = (v: string) => (v.includes(',') || v.includes('"') ? '"' + v.replace(/"/g, '""') + '"' : v);
  rows.push([email, fn, ln, zip, country].map(esc).join(','));
}

writeFileSync(outputPath, rows.join('\n') + '\n', 'utf8');
console.log(`Wrote ${total} unique contacts to ${outputPath}`);
console.log('Upload it in Meta Ads Manager → Audiences → Custom Audience → Customer list,');
console.log('then create a Lookalike (1%, United Kingdom) from it.');
