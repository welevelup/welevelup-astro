import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export const config = { maxDuration: 60 };

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
    const redis = getRedis();
    const session = await redis.get(`session:${token}`);
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

interface Donor { name: string; email: string; amount: number; gateway: string }

async function mollieDonors(month: string): Promise<Donor[]> {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) return [];
  const payments: any[] = [];
  let url = `https://api.mollie.com/v2/payments?limit=250`;
  while (url) {
    const data = await fetchJson(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    payments.push(...(data._embedded?.payments || []));
    url = data._links?.next?.href || '';
  }
  const relevant = payments.filter(
    (p) => (p.paidAt || '').startsWith(month) && p.status === 'paid' && (p.sequenceType === 'first' || p.sequenceType === 'recurring')
  );
  const custIds = Array.from(new Set(relevant.map((p) => p.customerId).filter(Boolean)));
  const custCache: Record<string, any> = {};
  for (const id of custIds) {
    try { custCache[id] = await fetchJson(`https://api.mollie.com/v2/customers/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } }); }
    catch { custCache[id] = null; }
  }
  return relevant.map((p) => {
    const customer = p.customerId ? custCache[p.customerId] : null;
    return { name: customer?.name || 'unknown', email: (customer?.email || '').toLowerCase(), amount: parseFloat(p.amount?.value || '0'), gateway: 'mollie' };
  });
}

async function gocardlessDonors(month: string): Promise<Donor[]> {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!token) return [];
  const headers = { Authorization: `Bearer ${token}`, 'GoCardless-Version': '2015-07-06' };
  const all: any[] = [];
  let url = `https://api.gocardless.com/payments?limit=500`;
  while (url) {
    const data = await fetchJson(url, { headers });
    all.push(...(data.payments || []));
    url = data.meta?.cursors?.after ? `https://api.gocardless.com/payments?limit=500&after=${data.meta.cursors.after}` : '';
  }
  const gcSuccess = new Set(['confirmed', 'paid_out', 'submitted', 'paid']);
  const relevant = all.filter((p) => gcSuccess.has(p.status) && (p.charge_date || p.created_at || '').startsWith(month));
  const mandateIds = Array.from(new Set(relevant.map((p) => p.links?.mandate).filter(Boolean)));
  const mandateToCustomer: Record<string, any> = {};
  for (const mid of mandateIds) {
    try {
      const md = await fetchJson(`https://api.gocardless.com/mandates/${mid}`, { headers });
      const custId = md.mandates?.links?.customer;
      if (custId) {
        const cd = await fetchJson(`https://api.gocardless.com/customers/${custId}`, { headers });
        mandateToCustomer[mid] = cd.customers;
      }
    } catch { /* keep going without this donor's identity */ }
  }
  return relevant.map((p) => {
    const customer = p.links?.mandate ? mandateToCustomer[p.links.mandate] : null;
    return {
      name: customer ? `${customer.given_name || ''} ${customer.family_name || ''}`.trim() : 'unknown',
      email: (customer?.email || '').toLowerCase(),
      amount: p.amount ? p.amount / 100 : 0,
      gateway: 'gocardless',
    };
  });
}

async function paypalDonors(month: string): Promise<Donor[]> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenData = await fetchJson('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const token = tokenData.access_token;
  const [y, mo] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
  const endRaw = new Date(Date.UTC(y, mo, 0, 23, 59, 59));
  const today = new Date();
  if (start > today) return []; // month hasn't started yet on the real clock
  const end = endRaw > today ? today : endRaw;
  const isoUtc = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z');

  const donors: Donor[] = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams({
      start_date: isoUtc(start), end_date: isoUtc(end), fields: 'all',
      page_size: '500', page: String(page), balance_affecting_records_only: 'Y',
    });
    const data = await fetchJson(`https://api-m.paypal.com/v1/reporting/transactions?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const txs = data.transaction_details || [];
    for (const tx of txs) {
      const info = tx.transaction_info || {};
      const payer = tx.payer_info || {};
      if (info.transaction_status !== 'S') continue;
      const subject = (info.transaction_subject || '').toLowerCase();
      if (!(subject.includes('monthly') || subject.includes('subscription'))) continue;
      const amount = parseFloat(info.transaction_amount?.value || '0');
      if (amount <= 0) continue;
      donors.push({
        name: payer.payer_name?.alternate_full_name || [payer.payer_name?.given_name, payer.payer_name?.surname].filter(Boolean).join(' '),
        email: (payer.email_address || '').toLowerCase(),
        amount,
        gateway: 'paypal',
      });
    }
    if (txs.length < 500) break;
    page++;
  }
  return donors;
}

// Internal test donations from the site's own admin account — never real donors.
const isRealDonor = (d: Donor) => d.email !== 'tech@welevelup.org';

async function regularDonorsForMonth(month: string): Promise<Donor[]> {
  const [mollie, gocardless, paypal] = await Promise.all([
    mollieDonors(month),
    gocardlessDonors(month),
    paypalDonors(month),
  ]);
  const seen = new Set<string>();
  const combined: Donor[] = [];
  for (const d of [...mollie, ...gocardless, ...paypal].filter(isRealDonor)) {
    const key = d.email || d.name;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(d);
  }
  combined.sort((a, b) => a.name.localeCompare(b.name));
  return combined;
}

function toCsv(donors: Donor[]): string {
  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['name', 'email', 'amount_gbp', 'gateway'].join(',')];
  for (const d of donors) rows.push([esc(d.name), esc(d.email), d.amount, d.gateway].join(','));
  return rows.join('\n') + '\n';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await verifySession(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const url = new URL(req.url || '', 'http://localhost');
  const month = url.searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be YYYY-MM' });
  }

  try {
    const combined = await regularDonorsForMonth(month);
    const csv = toCsv(combined);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="regular-donors-${month}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
