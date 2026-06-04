import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

export const prerender = false;

function cleanEnvVar(value: string): string {
  if (!value) return '';
  let cleaned = value
    .replace(/^["\\'\\n\\r]+/, '')
    .replace(/["\\'\\n\\r]+$/, '')
    .trim();
  if (cleaned.includes('UPSTASH_')) {
    const urlMatch = cleaned.match(/https:\/\/[a-z0-9-]+\.upstash\.io/);
    if (urlMatch) return urlMatch[0];
    const tokenMatch = cleaned.match(/[a-zA-Z0-9]+$/);
    if (tokenMatch) return tokenMatch[0];
  }
  return cleaned;
}

function getRedis(): Redis {
  const url = cleanEnvVar(process.env.UPSTASH_REDIS_REST_URL || '');
  const token = cleanEnvVar(process.env.UPSTASH_REDIS_REST_TOKEN || '');
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

async function saveDonationData(data: any): Promise<void> {
  const redis = getRedis();
  await redis.set('admin:donations', data);
  await redis.set('admin:lastSync', new Date().toISOString());
}

interface Donation {
  id: string;
  date: string;
  amount: number;
  currency: string;
  gateway: 'mollie' | 'gocardless' | 'paypal';
  type: 'recurring' | 'oneoff';
  payer?: { name?: string; email?: string };
}

async function fetchJson(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<any> {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'LevelUp-Sync/1.0',
      ...options.headers,
    },
    body: options.body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function fetchMolliePayments(year: number): Promise<Donation[]> {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) {
    console.log('[Mollie] API key not configured');
    return [];
  }

  const donations: Donation[] = [];
  let url = `https://api.mollie.com/v2/payments?limit=250&embed=customer`;

  try {
    while (url) {
      const data = await fetchJson(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const payments = data._embedded?.payments || [];
      for (const p of payments) {
        const paidAt = p.paidAt || p.createdAt || '';
        if (!paidAt.startsWith(`${year}-`)) continue;

        const amount = p.amount;
        if (!amount || !amount.value) continue;

        const customer = p._embedded?.customer || {};
        donations.push({
          id: p.id,
          date: paidAt,
          amount: parseFloat(amount.value),
          currency: amount.currency || 'EUR',
          gateway: 'mollie',
          type: p.method === 'directdebit' || p.method === 'creditcard' ? 'recurring' : 'oneoff',
          payer: {
            name: customer.name,
            email: customer.email,
          },
        });
      }

      url = data._links?.next?.href || '';
    }
  } catch (err) {
    console.error('[Mollie] Error:', err);
  }

  return donations;
}

async function fetchGoCardlessPayments(year: number): Promise<Donation[]> {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!token) {
    console.log('[GoCardless] Token not configured');
    return [];
  }

  const donations: Donation[] = [];
  let url = `https://api.gocardless.com/payments?limit=500`;

  try {
    while (url) {
      const data = await fetchJson(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'GoCardless-Version': '2015-07-06',
        },
      });

      const payments = data.payments || [];
      for (const p of payments) {
        const chargeDate = p.charge_date || p.created_at || '';
        if (!chargeDate.startsWith(`${year}-`)) continue;

        const amount = p.amount ? p.amount / 100 : 0;
        donations.push({
          id: p.id,
          date: chargeDate,
          amount,
          currency: p.currency || 'GBP',
          gateway: 'gocardless',
          type: 'recurring',
          payer: {
            name: p.description || '',
            email: '',
          },
        });
      }

      url = data.meta?.cursors?.after
        ? `https://api.gocardless.com/payments?limit=500&after=${data.meta.cursors.after}`
        : '';
    }
  } catch (err) {
    console.error('[GoCardless] Error:', err);
  }

  return donations;
}

async function fetchPayPalPayments(year: number): Promise<Donation[]> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.log('[PayPal] Credentials not configured');
    return [];
  }

  const donations: Donation[] = [];

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenData = await fetchJson('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const token = tokenData.access_token;

    for (let month = 1; month <= 12; month++) {
      const start = new Date(year, month - 1, 1, 0, 0, 0);
      const end = new Date(year, month, 0, 23, 59, 59);

      const startStr = start.toISOString().replace('Z', '');
      const endStr = end.toISOString().replace('Z', '');

      const data = await fetchJson(`https://api-m.paypal.com/v1/reporting/transactions?start_date=${startStr}&end_date=${endStr}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const txs = data.transaction_details || [];
      for (const tx of txs) {
        const info = tx.transaction_info || {};
        const payer = tx.payer_info || {};
        const amount = info.transaction_amount || {};

        donations.push({
          id: info.transaction_id,
          date: info.transaction_initiation_date || '',
          amount: parseFloat(amount.value || '0'),
          currency: amount.currency_code || 'USD',
          gateway: 'paypal',
          type: 'oneoff',
          payer: {
            name: payer.payer_name?.alternate_full_name,
            email: payer.email_address,
          },
        });
      }
    }
  } catch (err) {
    console.error('[PayPal] Error:', err);
  }

  return donations;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('[admin-sync] === SYNC START ===');
    const year = new Date().getFullYear();
    const donations: Donation[] = [];

    console.log('[admin-sync] Fetching from Mollie...');
    donations.push(...(await fetchMolliePayments(year)));
    console.log('[admin-sync] Mollie donations:', donations.filter(d => d.gateway === 'mollie').length);

    console.log('[admin-sync] Fetching from GoCardless...');
    donations.push(...(await fetchGoCardlessPayments(year)));
    console.log('[admin-sync] GoCardless donations:', donations.filter(d => d.gateway === 'gocardless').length);

    console.log('[admin-sync] Fetching from PayPal...');
    donations.push(...(await fetchPayPalPayments(year)));
    console.log('[admin-sync] PayPal donations:', donations.filter(d => d.gateway === 'paypal').length);

    donations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = donations.reduce((sum, d) => sum + d.amount, 0);

    const donationData = {
      totalMonth: donations.filter(d => {
        const dDate = new Date(d.date);
        const now = new Date();
        return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
      }).reduce((s, d) => s + d.amount, 0),
      totalYear: total,
      activeSubscribers: donations.filter(d => d.type === 'recurring').filter((d, i, a) => a.findIndex(x => x.payer?.email === d.payer?.email && x.payer?.email) === i).length,
      newThisMonth: donations.filter(d => {
        const dDate = new Date(d.date);
        const now = new Date();
        return d.type === 'recurring' && dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
      }).length,
      cancelledThisMonth: 0,
      byGateway: {
        mollie: donations.filter(d => d.gateway === 'mollie').reduce((s, d) => s + d.amount, 0),
        gocardless: donations.filter(d => d.gateway === 'gocardless').reduce((s, d) => s + d.amount, 0),
        paypal: donations.filter(d => d.gateway === 'paypal').reduce((s, d) => s + d.amount, 0),
      },
      recentDonations: donations.slice(0, 10).map(d => ({
        date: d.date,
        amount: d.amount,
        currency: d.currency,
        type: d.type,
        gateway: d.gateway,
      })),
      monthlyTotals: Array.from(
        donations.reduce((m, d) => {
          const month = d.date.slice(0, 7);
          const existing = m.get(month) || {
            month,
            total: 0,
            monthly_donations: 0,
            one_off_donations: 0,
            active_subscribers: new Set<string>(),
            mollie_count: 0,
            gocardless_count: 0,
            paypal_count: 0,
          };
          existing.total += d.amount;
          if (d.type === 'recurring') {
            existing.monthly_donations += d.amount;
            existing.active_subscribers.add(d.payer?.email || d.id);
          } else {
            existing.one_off_donations += d.amount;
          }
          if (d.gateway === 'mollie') existing.mollie_count++;
          else if (d.gateway === 'gocardless') existing.gocardless_count++;
          else if (d.gateway === 'paypal') existing.paypal_count++;
          m.set(month, existing);
          return m;
        }, new Map()).entries()
      ).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).reverse().map(([month, data]: any) => ({
        month,
        total: Math.round(data.total * 100) / 100,
        monthly_donations: Math.round(data.monthly_donations * 100) / 100,
        one_off_donations: Math.round(data.one_off_donations * 100) / 100,
        active_subscribers: data.active_subscribers.size,
        mollie_count: data.mollie_count,
        gocardless_count: data.gocardless_count,
        paypal_count: data.paypal_count,
      })),
    };

    console.log('[admin-sync] Saving to Redis...');
    try {
      await saveDonationData(donationData);
      console.log('[admin-sync] ✅ Saved to Redis');
    } catch (redisErr) {
      console.error('[admin-sync] ⚠️ Redis save failed:', redisErr);
    }

    console.log('[admin-sync] === SYNC COMPLETE ===');
    return new Response(JSON.stringify({
      ok: true,
      synced: donations.length,
      total: Math.round(total * 100) / 100,
      year,
      timestamp: new Date().toISOString(),
      byGateway: {
        mollie: donations.filter(d => d.gateway === 'mollie').length,
        gocardless: donations.filter(d => d.gateway === 'gocardless').length,
        paypal: donations.filter(d => d.gateway === 'paypal').length,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin-sync] ❌ ERROR:', msg);
    return new Response(JSON.stringify({ error: msg, ok: false }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
