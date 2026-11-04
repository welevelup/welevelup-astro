import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// Reads every monthly donor for the last 12 complete months (plus one earlier
// month for comparison) in ONE pass over the three gateways, instead of one slow
// pass per month. The browser turns the result into the "lost donors" timeline.
export const config = { maxDuration: 60 };

// Helpers are inlined on purpose: importing across directories breaks Vercel's
// function bundling for this project.
function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

async function verifySession(req: VercelRequest): Promise<boolean> {
  const cookies = req.headers.cookie ?? '';
  const match = cookies.match(/admin_session=([^;]+)/);
  const url = new URL(req.url || '', 'http://localhost');
  const token = match?.[1] || url.searchParams.get('token');
  if (!token) return false;
  try {
    const session = await getRedis().get(`session:${token}`);
    return !!session;
  } catch {
    return false;
  }
}

async function fetchJson(url: string, opts: any = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const LOOKUP_CONCURRENCY = 8;
const PAYPAL_CONCURRENCY = 3;
const MONTHS_SHOWN = 12;
const CACHE_TTL_SECONDS = 60 * 60;

interface Gift { month: string; name: string; email: string; amount: number; gateway: string }
interface Failure { month: string; email: string }

const INTERNAL_TEST_EMAIL = 'tech@welevelup.org';

// ── months ──────────────────────────────────────────────────────────────

/** The 13 months ending at the last COMPLETE month (UTC), oldest first. */
function monthWindow(now = new Date()): string[] {
  const months: string[] = [];
  for (let back = MONTHS_SHOWN + 1; back >= 1; back--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

// ── Mollie ──────────────────────────────────────────────────────────────

async function mollieData(months: string[]): Promise<{ gifts: Gift[]; failures: Failure[] }> {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) return { gifts: [], failures: [] };
  const headers = { Authorization: `Bearer ${apiKey}` };
  const windowStart = `${months[0]}-01`;
  const inWindow = new Set(months);

  const payments: any[] = [];
  let url = 'https://api.mollie.com/v2/payments?limit=250';
  while (url) {
    const data = await fetchJson(url, { headers });
    const page: any[] = data._embedded?.payments || [];
    payments.push(...page);
    const oldest = page[page.length - 1]?.createdAt || '';
    // Mollie lists newest first, so stop once a page is entirely before the window.
    if (!page.length || oldest.slice(0, 10) < windowStart) break;
    url = data._links?.next?.href || '';
  }

  const paid = payments.filter(
    (p) => p.status === 'paid' && (p.sequenceType === 'first' || p.sequenceType === 'recurring') && inWindow.has((p.paidAt || '').slice(0, 7))
  );
  const failed = payments.filter((p) => (p.status === 'failed' || p.status === 'expired') && inWindow.has((p.createdAt || '').slice(0, 7)));

  const customerIds = Array.from(new Set([...paid, ...failed].map((p) => p.customerId).filter(Boolean))) as string[];
  const entries = await pool(customerIds, LOOKUP_CONCURRENCY, async (id) => {
    try {
      return [id, await fetchJson(`https://api.mollie.com/v2/customers/${id}`, { headers })] as const;
    } catch {
      return [id, null] as const;
    }
  });
  const customers: Record<string, any> = Object.fromEntries(entries);
  const emailOf = (p: any) => ((p.customerId && customers[p.customerId]?.email) || '').toLowerCase();

  return {
    gifts: paid.map((p) => ({
      month: (p.paidAt || '').slice(0, 7),
      name: (p.customerId && customers[p.customerId]?.name) || '',
      email: emailOf(p),
      amount: parseFloat(p.amount?.value || '0'),
      gateway: 'mollie',
    })),
    failures: failed.map((p) => ({ month: (p.createdAt || '').slice(0, 7), email: emailOf(p) })).filter((f) => f.email),
  };
}

// ── GoCardless ──────────────────────────────────────────────────────────

async function gocardlessData(months: string[]): Promise<{ gifts: Gift[]; failures: Failure[] }> {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!token) return { gifts: [], failures: [] };
  const headers = { Authorization: `Bearer ${token}`, 'GoCardless-Version': '2015-07-06' };
  const inWindow = new Set(months);
  const since = encodeURIComponent(`${months[0]}-01T00:00:00.000Z`);

  const all: any[] = [];
  let url = `https://api.gocardless.com/payments?limit=500&created_at[gte]=${since}`;
  while (url) {
    const data = await fetchJson(url, { headers });
    all.push(...(data.payments || []));
    const after = data.meta?.cursors?.after;
    url = after ? `https://api.gocardless.com/payments?limit=500&created_at[gte]=${since}&after=${after}` : '';
  }

  const monthOf = (p: any) => (p.charge_date || p.created_at || '').slice(0, 7);
  const success = new Set(['confirmed', 'paid_out', 'submitted', 'paid']);
  const failedStatuses = new Set(['failed', 'bounced']);
  const paid = all.filter((p) => success.has(p.status) && inWindow.has(monthOf(p)));
  const failed = all.filter((p) => failedStatuses.has(p.status) && inWindow.has(monthOf(p)));

  const mandateIds = Array.from(new Set([...paid, ...failed].map((p) => p.links?.mandate).filter(Boolean))) as string[];
  const entries = await pool(mandateIds, LOOKUP_CONCURRENCY, async (mandateId) => {
    try {
      const md = await fetchJson(`https://api.gocardless.com/mandates/${mandateId}`, { headers });
      const customerId = md.mandates?.links?.customer;
      if (!customerId) return [mandateId, null] as const;
      const cd = await fetchJson(`https://api.gocardless.com/customers/${customerId}`, { headers });
      return [mandateId, cd.customers] as const;
    } catch {
      return [mandateId, null] as const;
    }
  });
  const customers: Record<string, any> = Object.fromEntries(entries);
  const customerOf = (p: any) => (p.links?.mandate ? customers[p.links.mandate] : null);

  return {
    gifts: paid.map((p) => {
      const c = customerOf(p);
      return {
        month: monthOf(p),
        name: c ? `${c.given_name || ''} ${c.family_name || ''}`.trim() : '',
        email: (c?.email || '').toLowerCase(),
        amount: p.amount ? p.amount / 100 : 0,
        gateway: 'gocardless',
      };
    }),
    failures: failed.map((p) => ({ month: monthOf(p), email: (customerOf(p)?.email || '').toLowerCase() })).filter((f) => f.email),
  };
}

// ── PayPal ──────────────────────────────────────────────────────────────

async function paypalData(months: string[]): Promise<{ gifts: Gift[]; failures: Failure[] }> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { gifts: [], failures: [] };
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenData = await fetchJson('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const headers = { Authorization: `Bearer ${tokenData.access_token}` };
  const today = new Date();
  const isoUtc = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z');

  const perMonth = await pool(months, PAYPAL_CONCURRENCY, async (month): Promise<Gift[]> => {
    const [y, mo] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
    const endRaw = new Date(Date.UTC(y, mo, 0, 23, 59, 59));
    if (start > today) return [];
    const end = endRaw > today ? today : endRaw;
    const gifts: Gift[] = [];
    let page = 1;
    while (true) {
      const params = new URLSearchParams({
        start_date: isoUtc(start), end_date: isoUtc(end), fields: 'all',
        page_size: '500', page: String(page), balance_affecting_records_only: 'Y',
      });
      const data = await fetchJson(`https://api-m.paypal.com/v1/reporting/transactions?${params}`, { headers });
      const txs: any[] = data.transaction_details || [];
      for (const tx of txs) {
        const info = tx.transaction_info || {};
        const payer = tx.payer_info || {};
        if (info.transaction_status !== 'S') continue;
        const subject = (info.transaction_subject || '').toLowerCase();
        if (!(subject.includes('monthly') || subject.includes('subscription'))) continue;
        const amount = parseFloat(info.transaction_amount?.value || '0');
        if (amount <= 0) continue;
        gifts.push({
          month,
          name: payer.payer_name?.alternate_full_name || [payer.payer_name?.given_name, payer.payer_name?.surname].filter(Boolean).join(' '),
          email: (payer.email_address || '').toLowerCase(),
          amount,
          gateway: 'paypal',
        });
      }
      if (txs.length < 500) break;
      page++;
    }
    return gifts;
  });
  return { gifts: perMonth.flat(), failures: [] };
}

// ── assemble ────────────────────────────────────────────────────────────

interface DonorAccumulator { key: string; label: string; email: string; gateway: string; amount: number; lastMonth: string; present: Set<string> }

function assemble(months: string[], gifts: Gift[], failures: Failure[]) {
  const donors = new Map<string, DonorAccumulator>();
  let unidentified = 0;

  for (const gift of gifts) {
    if (gift.email === INTERNAL_TEST_EMAIL) continue;
    const realName = gift.name && gift.name.toLowerCase() !== 'unknown' ? gift.name : '';
    const key = gift.email || realName;
    if (!key) { unidentified++; continue; } // can't tell who this was — don't merge strangers
    const existing = donors.get(key) ?? {
      key, label: realName || gift.email, email: gift.email, gateway: gift.gateway, amount: gift.amount, lastMonth: gift.month, present: new Set<string>(),
    };
    existing.present.add(gift.month);
    if (gift.month >= existing.lastMonth) {
      existing.lastMonth = gift.month;
      existing.gateway = gift.gateway;
      existing.amount = gift.amount;
    }
    if (realName && !existing.label.includes(' ') && realName.includes(' ')) existing.label = realName;
    donors.set(key, existing);
  }

  const failedEmails: Record<string, string[]> = Object.fromEntries(months.map((m) => [m, [] as string[]]));
  for (const f of failures) {
    if (failedEmails[f.month] && !failedEmails[f.month].includes(f.email)) failedEmails[f.month].push(f.email);
  }

  return {
    months,
    donors: Array.from(donors.values()).map((d) => ({
      key: d.key, label: d.label, email: d.email || undefined, gateway: d.gateway, amount: d.amount, present: Array.from(d.present).sort(),
    })),
    failedEmails,
    unidentified,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await verifySession(req))) return res.status(401).json({ error: 'Unauthorized' });
  res.setHeader('Cache-Control', 'private, no-store');

  const months = monthWindow();
  const cacheKey = `lost-donors:v1:${months[months.length - 1]}`;
  try {
    const cached = await getRedis().get(cacheKey);
    if (cached) return res.status(200).json(cached);
  } catch { /* cache unavailable — fall through to a live read */ }

  try {
    const [mollie, gocardless, paypal] = await Promise.all([mollieData(months), gocardlessData(months), paypalData(months)]);
    const result = assemble(
      months,
      [...mollie.gifts, ...gocardless.gifts, ...paypal.gifts],
      [...mollie.failures, ...gocardless.failures, ...paypal.failures]
    );

    // A lookup that failed leaves gifts with no identity; don't cache that partial picture.
    if (result.unidentified === 0) {
      try {
        await getRedis().set(cacheKey, result, { ex: CACHE_TTL_SECONDS });
      } catch { /* not cached this time */ }
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
