import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
};

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
    console.log('MOLLIE_API_KEY not configured, skipping');
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
    console.error('Mollie error:', err);
  }

  return donations;
}

async function fetchGoCardlessPayments(year: number): Promise<Donation[]> {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!token) {
    console.log('GOCARDLESS_ACCESS_TOKEN not configured, skipping');
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
    console.error('GoCardless error:', err);
  }

  return donations;
}

async function fetchPayPalPayments(year: number): Promise<Donation[]> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.log('PayPal credentials not configured, skipping');
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
    console.error('PayPal error:', err);
  }

  return donations;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const year = new Date().getFullYear();
    const donations: Donation[] = [];

    // Fetch from all 3 gateways
    donations.push(...(await fetchMolliePayments(year)));
    donations.push(...(await fetchGoCardlessPayments(year)));
    donations.push(...(await fetchPayPalPayments(year)));

    // Sort by date descending
    donations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = donations.reduce((sum, d) => sum + d.amount, 0);

    return res.status(200).json({
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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Sync error:', msg);
    return res.status(500).json({ error: msg });
  }
}
