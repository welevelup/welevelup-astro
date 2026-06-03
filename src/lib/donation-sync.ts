import * as https from 'https';

interface Donation {
  id: string;
  date: string;
  amount: number;
  currency: string;
  gateway: 'mollie' | 'gocardless' | 'paypal';
  type: 'recurring' | 'oneoff';
  payer?: { name?: string; email?: string };
}

interface SyncResult {
  year: number;
  donations: Donation[];
  total: number;
  count: number;
  lastSync: string;
}

function fetchJson(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const protocol = isHttps ? https : require('http');

    const urlObj = new URL(url);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LevelUp-Sync/1.0',
        ...options.headers,
      },
    };

    const req = protocol.request(urlObj, reqOptions, (res: any) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ============================================================================
// MOLLIE
// ============================================================================

async function fetchMolliePayments(year: number): Promise<Donation[]> {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) throw new Error('MOLLIE_API_KEY not configured');

  const baseUrl = 'https://api.mollie.com/v2';
  const donations: Donation[] = [];
  let url = `${baseUrl}/payments?limit=250&embed=customer`;

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

  return donations;
}

// ============================================================================
// GOCARDLESS
// ============================================================================

async function fetchGoCardlessPayments(year: number): Promise<Donation[]> {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!token) throw new Error('GOCARDLESS_ACCESS_TOKEN not configured');

  const baseUrl = 'https://api.gocardless.com';
  const donations: Donation[] = [];
  let url = `${baseUrl}/payments?limit=500`;
  const mandateCustomers: Record<string, any> = {};

  // Phase 1: fetch all payments
  const allPayments = [];
  while (url) {
    const data = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'GoCardless-Version': '2015-07-06',
      },
    });

    allPayments.push(...(data.payments || []));
    url = data.meta?.cursors?.after
      ? `${baseUrl}/payments?limit=500&after=${data.meta.cursors.after}`
      : '';
  }

  // Phase 2: resolve mandates to customers
  const mandateIds = new Set<string>();
  for (const p of allPayments) {
    const mid = p.links?.mandate;
    if (mid) mandateIds.add(mid);
  }

  for (const mid of mandateIds) {
    const mandate = await fetchJson(`${baseUrl}/mandates/${mid}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'GoCardless-Version': '2015-07-06',
      },
    });
    const customerId = mandate.mandates?.[0]?.links?.customer;
    if (customerId) {
      const customer = await fetchJson(`${baseUrl}/customers/${customerId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'GoCardless-Version': '2015-07-06',
        },
      });
      mandateCustomers[mid] = customer.customers?.[0] || {};
    }
  }

  // Phase 3: filter by year and transform
  for (const p of allPayments) {
    const chargeDate = p.charge_date || p.created_at || '';
    if (!chargeDate.startsWith(`${year}-`)) continue;

    const amount = p.amount ? p.amount / 100 : 0; // minor units → decimal
    const mid = p.links?.mandate;
    const customer = mandateCustomers[mid] || {};

    donations.push({
      id: p.id,
      date: chargeDate,
      amount,
      currency: p.currency || 'GBP',
      gateway: 'gocardless',
      type: 'recurring',
      payer: {
        name: `${customer.given_name || ''} ${customer.family_name || ''}`.trim(),
        email: customer.email,
      },
    });
  }

  return donations;
}

// ============================================================================
// PAYPAL
// ============================================================================

async function getPayPalToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured');

  const env = (process.env.PAYPAL_ENV || 'live').toLowerCase();
  const baseUrl = env === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const data = await fetchJson(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  return data.access_token;
}

async function fetchPayPalPayments(year: number): Promise<Donation[]> {
  const token = await getPayPalToken();
  const env = (process.env.PAYPAL_ENV || 'live').toLowerCase();
  const baseUrl = env === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

  const donations: Donation[] = [];
  const today = new Date();

  for (let month = 1; month <= 12; month++) {
    const start = new Date(year, month - 1, 1, 0, 0, 0);
    if (start > today) break;

    const end = new Date(year, month, 0, 23, 59, 59);
    if (end > today) end.setTime(today.getTime());

    const startStr = start.toISOString().replace('Z', '');
    const endStr = end.toISOString().replace('Z', '');

    let page = 1;
    while (true) {
      const data = await fetchJson(`${baseUrl}/v1/reporting/transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const txs = data.transaction_details || [];
      if (!txs.length) break;

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

      if (txs.length < 500) break;
      page++;
    }
  }

  return donations;
}

// ============================================================================
// MAIN SYNC
// ============================================================================

export async function syncDonations(year: number): Promise<SyncResult> {
  const donations: Donation[] = [];

  // Fetch from all 3 gateways
  try {
    donations.push(...(await fetchMolliePayments(year)));
  } catch (err) {
    console.error('Mollie sync failed:', err);
  }

  try {
    donations.push(...(await fetchGoCardlessPayments(year)));
  } catch (err) {
    console.error('GoCardless sync failed:', err);
  }

  try {
    donations.push(...(await fetchPayPalPayments(year)));
  } catch (err) {
    console.error('PayPal sync failed:', err);
  }

  // Sort by date descending
  donations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = donations.reduce((sum, d) => sum + d.amount, 0);

  return {
    year,
    donations,
    total,
    count: donations.length,
    lastSync: new Date().toISOString(),
  };
}
