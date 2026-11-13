import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// Read-only facts for "Reconcile months" on the Payments guide: gifts, failed
// charges and subscriptions for a range of months across Mollie, GoCardless and
// PayPal (GET requests only). The browser explains each lost donor-month with
// src/lib/reconcile-months.ts. Gifts and failures are collected exactly like
// api/admin-lost-donors.ts does; subscriptions are added on top.
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

const MAX_RETRY_WAIT_MS = 5_000;

/** GET JSON; on HTTP 429 waits (Retry-After, capped) and retries once. */
export async function fetchJson(url: string, opts: any = {}, retried = false): Promise<any> {
  const res = await fetch(url, opts);
  if (res.status === 429 && !retried) {
    const seconds = Number(res.headers.get('Retry-After'));
    const wait = Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, MAX_RETRY_WAIT_MS) : 1_000;
    await new Promise((resolve) => setTimeout(resolve, wait));
    return fetchJson(url, opts, true);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Resolves with the fallback if the job is not done in time. The job itself cannot be cancelled. */
export async function withDeadline<T>(job: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  try {
    return await Promise.race([job, late]);
  } finally {
    clearTimeout(timer);
  }
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
const MAX_MONTHS = 12;
const MAX_PAGES = 12;
const FIRST_MONTH = '2026-01';
const INTERNAL_TEST_EMAIL = 'tech@welevelup.org';
/** Stop starting new lookups after this long, so the response still fits in maxDuration. */
const LOOKUP_BUDGET_MS = 40_000;
/** Payment paging stops earlier, so lookups still have time to run. */
const PAGING_BUDGET_MS = 25_000;
/** Each gateway job is given up on after this long, so the response always fits maxDuration. */
const GATEWAY_BUDGET_MS = 50_000;

type Interval = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'other' | 'unknown';
interface Gift { month: string; name: string; email: string; amount: number; gateway: string }
interface Failure { month: string; email: string; gateway: string }
interface Subscription { email: string; gateway: string; interval: Interval; status: string }
interface GatewayData { gifts: Gift[]; failures: Failure[]; subscriptions: Subscription[]; truncated: boolean; lookupErrors: number }

const emptyData = (): GatewayData => ({ gifts: [], failures: [], subscriptions: [], truncated: false, lookupErrors: 0 });

// ── months ──────────────────────────────────────────────────────────────

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const lastCompleteMonth = (now = new Date()) => monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
const monthIndex = (m: string) => { const [y, mo] = m.split('-').map(Number); return y * 12 + mo - 1; };
const fromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

/** The requested months plus one earlier month of context, oldest first; or an error text. */
export function resolveMonths(from: string, to: string): { months: string[] } | { error: string } {
  const pattern = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!pattern.test(from) || !pattern.test(to)) return { error: 'from and to must look like 2026-01.' };
  if (from > to) return { error: 'from must not be after to.' };
  if (to > lastCompleteMonth()) return { error: 'to must be a complete month.' };
  const count = monthIndex(to) - monthIndex(from) + 1;
  if (count > MAX_MONTHS) return { error: `Choose at most ${MAX_MONTHS} months.` };
  return { months: Array.from({ length: count + 1 }, (_, i) => fromIndex(monthIndex(from) - 1 + i)) };
}

// ── intervals ───────────────────────────────────────────────────────────

function monthsToInterval(n: number): Interval {
  if (n === 1) return 'monthly';
  if (n === 3) return 'quarterly';
  if (n === 6) return 'half-yearly';
  if (n === 12) return 'yearly';
  return 'other';
}

/** Mollie writes intervals like "1 month", "3 months", "12 months", "2 weeks". */
export function mollieInterval(text: string): Interval {
  const match = /^(\d+)\s*(day|week|month|year)s?$/.exec((text || '').trim());
  if (!match) return 'unknown';
  const n = Number(match[1]);
  if (match[2] === 'month') return monthsToInterval(n);
  if (match[2] === 'year') return n === 1 ? 'yearly' : 'other';
  return 'other';
}

export function gocardlessInterval(unit: string, count: number): Interval {
  if (unit === 'monthly') return monthsToInterval(count || 1);
  if (unit === 'yearly') return (count || 1) === 1 ? 'yearly' : 'other';
  return unit ? 'other' : 'unknown';
}

// ── Mollie ──────────────────────────────────────────────────────────────

async function mollieData(months: string[], deadline: number, pagingDeadline: number): Promise<GatewayData> {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) throw new Error('not configured');
  const headers = { Authorization: `Bearer ${apiKey}` };
  const windowStart = `${months[0]}-01`;
  const inWindow = new Set(months);
  const data = emptyData();

  const payments: any[] = [];
  let url = 'https://api.mollie.com/v2/payments?limit=250';
  for (let page = 0; page < MAX_PAGES && url; page++) {
    const body = await fetchJson(url, { headers });
    const batch: any[] = body._embedded?.payments || [];
    payments.push(...batch);
    const oldest = batch[batch.length - 1]?.createdAt || '';
    if (!batch.length || oldest.slice(0, 10) < windowStart) break;
    url = body._links?.next?.href || '';
    if (url && (page === MAX_PAGES - 1 || Date.now() > pagingDeadline)) {
      data.truncated = true;
      break;
    }
  }

  const paid = payments.filter(
    (p) => p.status === 'paid' && (p.sequenceType === 'first' || p.sequenceType === 'recurring') && inWindow.has((p.paidAt || '').slice(0, 7))
  );
  const failed = payments.filter((p) => (p.status === 'failed' || p.status === 'expired') && inWindow.has((p.createdAt || '').slice(0, 7)));

  const customerIds = Array.from(new Set([...paid, ...failed].map((p) => p.customerId).filter(Boolean))) as string[];
  const lookups = await pool(customerIds, LOOKUP_CONCURRENCY, async (id) => {
    if (Date.now() > deadline) return { id, customer: null, subs: [] as any[], errors: 1 };
    let errors = 0;
    const customer = await fetchJson(`https://api.mollie.com/v2/customers/${id}`, { headers }).catch(() => { errors++; return null; });
    const subsBody = await fetchJson(`https://api.mollie.com/v2/customers/${id}/subscriptions`, { headers }).catch(() => { errors++; return null; });
    return { id, customer, subs: (subsBody?._embedded?.subscriptions || []) as any[], errors };
  });
  data.lookupErrors += lookups.reduce((sum, l) => sum + l.errors, 0);
  const customers = new Map(lookups.map((l) => [l.id, l.customer] as const));
  const emailOf = (p: any) => ((p.customerId && customers.get(p.customerId)?.email) || '').toLowerCase();

  data.gifts = paid.map((p) => ({
    month: (p.paidAt || '').slice(0, 7),
    name: (p.customerId && customers.get(p.customerId)?.name) || '',
    email: emailOf(p),
    amount: parseFloat(p.amount?.value || '0'),
    gateway: 'mollie',
  }));
  data.failures = failed.map((p) => ({ month: (p.createdAt || '').slice(0, 7), email: emailOf(p), gateway: 'mollie' })).filter((f) => f.email);
  data.subscriptions = lookups.flatMap((l) =>
    l.subs.map((s) => ({
      email: ((l.customer?.email as string) || '').toLowerCase(),
      gateway: 'mollie',
      interval: mollieInterval(s.interval),
      status: String(s.status || ''),
    }))
  ).filter((s) => s.email);
  return data;
}

// ── GoCardless ──────────────────────────────────────────────────────────

async function gocardlessAll(base: string, key: string, headers: Record<string, string>, pagingDeadline: number, truncate: () => void): Promise<any[]> {
  const all: any[] = [];
  let after = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await fetchJson(`${base}${after ? `&after=${after}` : ''}`, { headers });
    all.push(...(body[key] || []));
    after = body.meta?.cursors?.after || '';
    if (!after) return all;
    if (Date.now() > pagingDeadline) break;
  }
  truncate();
  return all;
}

async function gocardlessData(months: string[], deadline: number, pagingDeadline: number): Promise<GatewayData> {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!token) throw new Error('not configured');
  const headers = { Authorization: `Bearer ${token}`, 'GoCardless-Version': '2015-07-06' };
  const inWindow = new Set(months);
  const since = encodeURIComponent(`${months[0]}-01T00:00:00.000Z`);
  const data = emptyData();
  const markTruncated = () => { data.truncated = true; };

  const all = await gocardlessAll(`https://api.gocardless.com/payments?limit=500&created_at[gte]=${since}`, 'payments', headers, pagingDeadline, markTruncated);
  const subscriptions = await gocardlessAll('https://api.gocardless.com/subscriptions?limit=500', 'subscriptions', headers, pagingDeadline, markTruncated);

  const monthOf = (p: any) => (p.charge_date || p.created_at || '').slice(0, 7);
  const success = new Set(['confirmed', 'paid_out', 'submitted', 'paid']);
  const failedStatuses = new Set(['failed', 'bounced']);
  const paid = all.filter((p) => success.has(p.status) && inWindow.has(monthOf(p)));
  const failed = all.filter((p) => failedStatuses.has(p.status) && inWindow.has(monthOf(p)));

  // Only donors who gave or failed in the window matter, so subscriptions are looked up for them alone.
  const mandateIds = Array.from(new Set([...paid, ...failed].map((p) => p.links?.mandate).filter(Boolean))) as string[];
  const entries = await pool(mandateIds, LOOKUP_CONCURRENCY, async (mandateId) => {
    if (Date.now() > deadline) return { mandateId, customer: null, errors: 1 };
    try {
      const md = await fetchJson(`https://api.gocardless.com/mandates/${mandateId}`, { headers });
      const customerId = md.mandates?.links?.customer;
      if (!customerId) return { mandateId, customer: null, errors: 0 };
      const cd = await fetchJson(`https://api.gocardless.com/customers/${customerId}`, { headers });
      return { mandateId, customer: cd.customers, errors: 0 };
    } catch {
      return { mandateId, customer: null, errors: 1 };
    }
  });
  data.lookupErrors += entries.reduce((sum, e) => sum + e.errors, 0);
  const customers = new Map(entries.map((e) => [e.mandateId, e.customer] as const));
  const customerOf = (p: any) => (p.links?.mandate ? customers.get(p.links.mandate) : null);

  data.gifts = paid.map((p) => {
    const c = customerOf(p);
    return {
      month: monthOf(p),
      name: c ? `${c.given_name || ''} ${c.family_name || ''}`.trim() : '',
      email: (c?.email || '').toLowerCase(),
      amount: p.amount ? p.amount / 100 : 0,
      gateway: 'gocardless',
    };
  });
  data.failures = failed.map((p) => ({ month: monthOf(p), email: (customerOf(p)?.email || '').toLowerCase(), gateway: 'gocardless' })).filter((f) => f.email);
  data.subscriptions = subscriptions
    .map((s) => ({
      email: (customerOf(s)?.email || '').toLowerCase(),
      gateway: 'gocardless',
      interval: gocardlessInterval(String(s.interval_unit || ''), Number(s.interval || 1)),
      // pending_customer_approval and pending_submission both mean "set up, not live yet".
      status: String(s.status || '').startsWith('pending') ? 'pending' : String(s.status || ''),
    }))
    .filter((s) => s.email);
  return data;
}

// ── PayPal ──────────────────────────────────────────────────────────────

async function paypalData(months: string[], pagingDeadline: number): Promise<GatewayData> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('not configured');
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenData = await fetchJson('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const headers = { Authorization: `Bearer ${tokenData.access_token}` };
  const today = new Date();
  const isoUtc = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z');
  const data = emptyData();

  const perMonth = await pool(months, PAYPAL_CONCURRENCY, async (month): Promise<Gift[]> => {
    const [y, mo] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
    const endRaw = new Date(Date.UTC(y, mo, 0, 23, 59, 59));
    if (start > today) return [];
    if (Date.now() > pagingDeadline) { data.truncated = true; return []; }
    const end = endRaw > today ? today : endRaw;
    const gifts: Gift[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        start_date: isoUtc(start), end_date: isoUtc(end), fields: 'all',
        page_size: '500', page: String(page), balance_affecting_records_only: 'Y',
      });
      const body = await fetchJson(`https://api-m.paypal.com/v1/reporting/transactions?${params}`, { headers });
      const txs: any[] = body.transaction_details || [];
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
      if (page === MAX_PAGES) data.truncated = true;
    }
    return gifts;
  });
  data.gifts = perMonth.flat();
  // PayPal gives no failure data and no usable subscription interval here.
  return data;
}

// ── handler ─────────────────────────────────────────────────────────────

type GatewayName = 'mollie' | 'gocardless' | 'paypal';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await verifySession(req))) return res.status(401).json({ error: 'Unauthorized' });
  res.setHeader('Cache-Control', 'private, no-store');

  const url = new URL(req.url || '', 'http://localhost');
  const to = url.searchParams.get('to') || lastCompleteMonth();
  const from = url.searchParams.get('from') || (FIRST_MONTH <= to && monthIndex(to) - monthIndex(FIRST_MONTH) < MAX_MONTHS ? FIRST_MONTH : fromIndex(monthIndex(to) - MAX_MONTHS + 1));
  const resolved = resolveMonths(from, to);
  if ('error' in resolved) return res.status(400).json({ error: resolved.error });
  const { months } = resolved;

  const startedAt = Date.now();
  const deadline = startedAt + LOOKUP_BUDGET_MS;
  const pagingDeadline = startedAt + PAGING_BUDGET_MS;
  type Outcome = { kind: 'ok'; data: GatewayData } | { kind: 'error'; notConfigured: boolean } | { kind: 'timeout' };
  const attempt = (run: () => Promise<GatewayData>): Promise<Outcome> =>
    withDeadline<Outcome>(
      run().then(
        (data): Outcome => ({ kind: 'ok', data }),
        (err): Outcome => ({ kind: 'error', notConfigured: err instanceof Error && err.message === 'not configured' })
      ),
      GATEWAY_BUDGET_MS,
      { kind: 'timeout' }
    );
  const jobs: Array<[GatewayName, () => Promise<GatewayData>]> = [
    ['mollie', () => mollieData(months, deadline, pagingDeadline)],
    ['gocardless', () => gocardlessData(months, deadline, pagingDeadline)],
    ['paypal', () => paypalData(months, pagingDeadline)],
  ];
  const outcomes = await Promise.all(jobs.map(([, run]) => attempt(run)));

  const gatewayErrors: Array<{ gateway: GatewayName; problem: 'not configured' | 'failed' | 'timed out' }> = [];
  const parts: GatewayData[] = [];
  let timedOut = false;
  outcomes.forEach((outcome, i) => {
    if (outcome.kind === 'ok') return void parts.push(outcome.data);
    // Log the gateway and the kind of failure only: error text can echo URLs or donor details.
    if (outcome.kind === 'timeout') {
      timedOut = true;
      console.error(`admin-reconcile-months: ${jobs[i][0]} timed out`);
      gatewayErrors.push({ gateway: jobs[i][0], problem: 'timed out' });
      return;
    }
    if (!outcome.notConfigured) console.error(`admin-reconcile-months: ${jobs[i][0]} failed`);
    gatewayErrors.push({ gateway: jobs[i][0], problem: outcome.notConfigured ? 'not configured' : 'failed' });
  });

  return res.status(200).json({
    months,
    gifts: parts.flatMap((p) => p.gifts).filter((g) => g.email !== INTERNAL_TEST_EMAIL),
    failures: parts.flatMap((p) => p.failures),
    subscriptions: parts.flatMap((p) => p.subscriptions),
    truncated: timedOut || parts.some((p) => p.truncated),
    lookupErrors: parts.reduce((sum, p) => sum + p.lookupErrors, 0),
    gatewayErrors,
  });
}
