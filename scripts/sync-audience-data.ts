/**
 * Build the aggregated "Audience" dataset for the Level Up admin dashboard and
 * push it to Redis (key `admin:audience`). This replaces an old Streamlit/pydeck
 * app with a privacy-respecting, district-level aggregate.
 *
 * PRIVACY — read before changing:
 *   We NEVER store full postcodes or any personal data. Every postcode is reduced
 *   to its OUTWARD district (the part before the space: "E8 3PA" -> "E8") before
 *   anything is counted. The JSON written to Redis contains only district-level
 *   aggregates: averaged coordinates, counts per source, and a monthly growth
 *   series. No row-level data, no emails, no full postcodes ever leave this script.
 *
 * Inputs (overridable via argv):
 *   1) merged_data.csv        — columns: POSTCODE (or POSTAL_CODE), ADDED_TIME, SOURCE
 *   2) geocoded_postcodes.csv — columns: POSTCODE, latitude, longitude
 *
 * Usage:
 *   npx tsx scripts/sync-audience-data.ts
 *   npx tsx scripts/sync-audience-data.ts ./data/merged_data.csv ./data/geocoded_postcodes.csv
 *
 * Requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in .env.local.
 */
import { readFileSync, existsSync } from 'node:fs';
import { Redis } from '@upstash/redis';

// ── Tiny .env.local loader so we don't need a dotenv dep (mirrors update-legacy-webhooks.ts) ──
function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv('.env.local');

// ── Config ──
const SOURCE_RENAMES: Record<string, string> = { kick: 'No more lyes' };
const SOURCE_FALLBACK = 'other';
const MAX_MONTHS = 36;
const TOP_DISTRICTS_PRINTED = 5;

// ── CSV parsing: simple, dependency-free, handles quoted fields with embedded commas ──
function parseCsv(text: string): Array<Record<string, string>> {
  // Normalise line endings, split rows on newlines that are NOT inside quotes.
  const rows = splitRows(text.replace(/\r\n?/g, '\n'));
  if (rows.length === 0) return [];
  const headers = splitFields(rows[0]).map((h) => h.trim());
  const out: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] === '') continue;
    const fields = splitFields(rows[i]);
    const rec: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      rec[headers[c]] = (fields[c] ?? '').trim();
    }
    out.push(rec);
  }
  return out;
}

// Split a CSV document into row strings, respecting quotes (so a quoted field may
// contain a newline without splitting the row).
function splitRows(text: string): string[] {
  const rows: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      // A doubled quote ("") inside a quoted field is an escaped quote.
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      cur += ch;
    } else if (ch === '\n' && !inQuotes) {
      rows.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur !== '') rows.push(cur);
  return rows;
}

// Split a single row string into field values, handling quotes + escaped quotes.
function splitFields(row: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// Case-insensitive column lookup so POSTCODE / POSTAL_CODE / latitude variants all work.
function pick(rec: Record<string, string>, ...names: string[]): string {
  for (const n of names) {
    if (rec[n] != null && rec[n] !== '') return rec[n];
    // case-insensitive fallback
    const key = Object.keys(rec).find((k) => k.toLowerCase() === n.toLowerCase());
    if (key && rec[key] !== '') return rec[key];
  }
  return '';
}

// Outward district: the part before the space. "E8 3PA" -> "E8", "SW1A 1AA" -> "SW1A".
function toDistrict(postcode: string): string {
  const pc = (postcode || '').trim().toUpperCase();
  if (!pc) return '';
  const space = pc.indexOf(' ');
  if (space > 0) return pc.slice(0, space);
  // No space — fall back to stripping the inward part (last 3 chars) when it looks
  // like a full postcode without a space (e.g. "E83PA").
  if (pc.length > 3) return pc.slice(0, pc.length - 3);
  return pc;
}

function normaliseSource(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return SOURCE_FALLBACK;
  return SOURCE_RENAMES[s.toLowerCase()] || s;
}

// ADDED_TIME -> 'YYYY-MM' bucket, or '' if unparseable.
function toMonth(added: string): string {
  const s = (added || '').trim();
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    // Try 'DD/MM/YYYY' as a fallback (common UK export format).
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}`;
    return '';
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ── Output shape (mirrored by AudienceData in src/lib/admin-data.ts) ──
interface DistrictAgg {
  district: string;
  lat: number | null;
  lng: number | null;
  total: number;
  bySource: Record<string, number>;
  topSource: string;
}

interface AudienceData {
  districts: DistrictAgg[];
  bySource: Array<{ source: string; count: number }>;
  monthly: Array<{ month: string; count: number }>;
  totalPeople: number;
  totalDistricts: number;
  geocodedPct: number;
  lastSync: string;
}

// Two ways to persist the aggregate, tried in order:
//  1. Direct Redis write — needs UPSTASH_REDIS_REST_URL/TOKEN in .env.local.
//  2. Authenticated upload to the live site's /api/admin-audience-sync —
//     needs ADMIN_EMAIL/ADMIN_PASSWORD in .env.local (Vercel marks the
//     Upstash vars as Sensitive, so `vercel env pull` leaves them empty;
//     the admin credentials are the practical local path).
function getRedisOrNull(): Redis | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function uploadViaApi(payload: AudienceData): Promise<void> {
  const baseUrl = (process.env.AUDIENCE_SYNC_BASE_URL || 'https://welevelup.org').replace(/\/$/, '');
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = (process.env.ADMIN_PASSWORD || '').trim();
  if (!email || !password) {
    console.error(
      'No persistence path available. Add either UPSTASH_REDIS_REST_URL/TOKEN ' +
      'or ADMIN_EMAIL/ADMIN_PASSWORD to .env.local'
    );
    process.exit(1);
  }

  const loginRes = await fetch(`${baseUrl}/api/admin-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: HTTP ${loginRes.status}`);
  const { token } = (await loginRes.json()) as { token?: string };
  if (!token) throw new Error('Login response had no token');

  const uploadRes = await fetch(`${baseUrl}/api/admin-audience-sync?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Upload failed: HTTP ${uploadRes.status} — ${text.slice(0, 200)}`);
  }
  console.log(`Uploaded via ${baseUrl}/api/admin-audience-sync`);
}

async function main() {
  const mergedPath = process.argv[2] || './data/merged_data.csv';
  const geoPath = process.argv[3] || './data/geocoded_postcodes.csv';

  for (const [label, p] of [['merged_data', mergedPath], ['geocoded_postcodes', geoPath]] as const) {
    if (!existsSync(p)) {
      console.error(`Missing ${label} CSV at ${p}`);
      console.error('Pass paths as argv: npx tsx scripts/sync-audience-data.ts <merged.csv> <geocoded.csv>');
      process.exit(1);
    }
  }

  // ── Geocode lookup: district -> running mean of postcode coordinates ──
  // We average at the district level: sum lat/lng of every geocoded postcode that
  // maps to the district, then divide by count.
  const geoRows = parseCsv(readFileSync(geoPath, 'utf-8'));
  const districtGeo = new Map<string, { latSum: number; lngSum: number; n: number }>();
  for (const row of geoRows) {
    const pc = pick(row, 'POSTCODE', 'POSTAL_CODE');
    const lat = parseFloat(pick(row, 'latitude', 'LATITUDE', 'lat'));
    const lng = parseFloat(pick(row, 'longitude', 'LONGITUDE', 'lng', 'lon'));
    if (!pc || !isFinite(lat) || !isFinite(lng)) continue;
    const district = toDistrict(pc);
    if (!district) continue;
    const acc = districtGeo.get(district) || { latSum: 0, lngSum: 0, n: 0 };
    acc.latSum += lat;
    acc.lngSum += lng;
    acc.n += 1;
    districtGeo.set(district, acc);
  }

  // ── People rows: aggregate by district + source, build monthly series ──
  const peopleRows = parseCsv(readFileSync(mergedPath, 'utf-8'));
  const districts = new Map<string, { total: number; bySource: Map<string, number> }>();
  const sourceTotals = new Map<string, number>();
  const monthCounts = new Map<string, number>();
  let totalPeople = 0;
  let geocodablePeople = 0;

  for (const row of peopleRows) {
    const pc = pick(row, 'POSTCODE', 'POSTAL_CODE');
    const district = toDistrict(pc);
    if (!district) continue; // no usable area — skip (cannot place on map, no district)
    const source = normaliseSource(pick(row, 'SOURCE', 'source'));

    totalPeople += 1;
    if (districtGeo.has(district)) geocodablePeople += 1;

    const d = districts.get(district) || { total: 0, bySource: new Map<string, number>() };
    d.total += 1;
    d.bySource.set(source, (d.bySource.get(source) || 0) + 1);
    districts.set(district, d);

    sourceTotals.set(source, (sourceTotals.get(source) || 0) + 1);

    const month = toMonth(pick(row, 'ADDED_TIME', 'added_time'));
    if (month) monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
  }

  // ── Build district aggregates (only those we can place on the map) ──
  const districtAggs: DistrictAgg[] = [];
  for (const [district, d] of districts) {
    const geo = districtGeo.get(district);
    if (!geo || geo.n === 0) continue; // no coordinates — can't render a marker
    const bySource: Record<string, number> = {};
    let topSource = SOURCE_FALLBACK;
    let topCount = -1;
    for (const [src, count] of d.bySource) {
      bySource[src] = count;
      if (count > topCount) {
        topCount = count;
        topSource = src;
      }
    }
    districtAggs.push({
      district,
      lat: Math.round((geo.latSum / geo.n) * 1e5) / 1e5,
      lng: Math.round((geo.lngSum / geo.n) * 1e5) / 1e5,
      total: d.total,
      bySource,
      topSource,
    });
  }
  districtAggs.sort((a, b) => b.total - a.total);

  // ── Monthly growth: last MAX_MONTHS months, chronological ──
  const monthly = Array.from(monthCounts.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-MAX_MONTHS)
    .map(([month, count]) => ({ month, count }));

  // ── Source totals, descending ──
  const bySource = Array.from(sourceTotals.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const geocodedPct = totalPeople > 0 ? Math.round((geocodablePeople / totalPeople) * 1000) / 10 : 0;

  const payload: AudienceData = {
    districts: districtAggs,
    bySource,
    monthly,
    totalPeople,
    totalDistricts: districtAggs.length,
    geocodedPct,
    lastSync: new Date().toISOString(),
  };

  const redis = getRedisOrNull();
  if (redis) {
    await redis.set('admin:audience', payload);
    console.log('Saved directly to Redis (admin:audience).');
  } else {
    await uploadViaApi(payload);
  }

  // ── Summary (NO personal data, NO full postcodes) ──
  console.log('Audience data synced (admin:audience).');
  console.log(`  People (district-mapped): ${districtAggs.reduce((s, d) => s + d.total, 0)}`);
  console.log(`  People (total rows seen): ${totalPeople}`);
  console.log(`  Districts on map:         ${districtAggs.length}`);
  console.log(`  Geocoded:                 ${geocodedPct}%`);
  console.log(`  Sources:                  ${bySource.map((s) => `${s.source} (${s.count})`).join(', ')}`);
  console.log(`  Top ${TOP_DISTRICTS_PRINTED} districts:`);
  for (const d of districtAggs.slice(0, TOP_DISTRICTS_PRINTED)) {
    console.log(`    ${d.district.padEnd(6)} ${String(d.total).padStart(5)} people — top source: ${d.topSource}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
