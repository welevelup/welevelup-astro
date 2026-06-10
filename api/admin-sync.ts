import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function cleanEnvVar(value: string): string {
  if (!value) return '';
  let cleaned = value
    .replace(/^["'\\n\\r]+/, '')
    .replace(/["'\\n\\r]+$/, '')
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

interface Donation {
  id: string;
  date: string;
  amount: number;
  currency: string;
  gateway: 'mollie' | 'gocardless' | 'paypal';
  type: 'recurring' | 'oneoff';
  status: 'paid' | 'cancelled' | 'failed';
  subscription_id?: string;
  payer?: { name?: string; email?: string };
}

async function fetchJson(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<any> {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'Accept': 'application/json', 'User-Agent': 'LevelUp-Sync/1.0', ...options.headers },
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
  if (!apiKey) { console.log('[Mollie] Not configured'); return []; }
  const donations: Donation[] = [];
  let url = `https://api.mollie.com/v2/payments?limit=250&embed=customer`;
  try {
    while (url) {
      const data = await fetchJson(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      const payments = data._embedded?.payments || [];
      for (const p of payments) {
        const paidAt = p.paidAt || p.createdAt || '';
        if (!paidAt.startsWith(`${year}-`)) continue;
        const amount = p.amount;
        if (!amount?.value) continue;
        const customer = p._embedded?.customer || {};
        // Skip Mollie-PayPal duplicates (matches Python script)
        if (p.method === 'paypal') continue;
        if (p.status !== 'paid') continue;
        // Detect subscription from description (matches detect_subscription_from_text)
        const desc = (p.description || '').toLowerCase();
        const isSub = desc.includes('monthly') || desc.includes('subscription') || !!p.subscriptionId;
        // Extract subscription ID from description e.g. "Subscription #123"
        const subMatch = (p.description || '').match(/[Ss]ubscription\s*#(\d+)/);
        const subId = p.subscriptionId || (subMatch ? subMatch[1] : undefined);
        donations.push({
          id: p.id, date: paidAt, amount: parseFloat(amount.value), currency: amount.currency || 'EUR',
          gateway: 'mollie', type: isSub ? 'recurring' : 'oneoff',
          status: 'paid', subscription_id: subId,
          payer: { name: customer.name, email: customer.email },
        });
      }
      url = data._links?.next?.href || '';
    }
  } catch (err) { console.error('[Mollie] Error:', err); }
  return donations;
}

async function fetchGoCardlessPayments(year: number): Promise<Donation[]> {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!token) { console.log('[GoCardless] Not configured'); return []; }
  const donations: Donation[] = [];
  let url = `https://api.gocardless.com/payments?limit=500`;
  try {
    while (url) {
      const data = await fetchJson(url, { headers: { Authorization: `Bearer ${token}`, 'GoCardless-Version': '2015-07-06' } });
      const payments = data.payments || [];
      for (const p of payments) {
        const chargeDate = p.charge_date || p.created_at || '';
        if (!chargeDate.startsWith(`${year}-`)) continue;
        // Match Python script: confirmed, paid_out, submitted, paid, pending_submission
        const gcSuccessStatuses = new Set(['confirmed', 'paid_out', 'submitted', 'paid', 'pending_submission', 'pending_customer_approval']);
        const gcFailedStatuses = new Set(['failed', 'bounced']);
        const status = gcSuccessStatuses.has(p.status) ? 'paid' : gcFailedStatuses.has(p.status) ? 'failed' : p.status === 'cancelled' ? 'cancelled' : 'paid';
        // Use links.subscription (not mandate) - matches welevelup/tracking gocardless_to_sheets.py
        const subId = p.links?.subscription || p.links?.mandate || undefined;
        donations.push({
          id: p.id, date: chargeDate, amount: p.amount ? p.amount / 100 : 0,
          currency: p.currency || 'GBP', gateway: 'gocardless', type: subId ? 'recurring' : 'oneoff',
          status, subscription_id: subId,
          payer: { name: p.description || '', email: '' },
        });
      }
      url = data.meta?.cursors?.after
        ? `https://api.gocardless.com/payments?limit=500&after=${data.meta.cursors.after}` : '';
    }
  } catch (err) { console.error('[GoCardless] Error:', err); }
  return donations;
}

async function fetchPayPalPayments(year: number): Promise<Donation[]> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) { console.log('[PayPal] Not configured'); return []; }
  const donations: Donation[] = [];
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenData = await fetchJson('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const token = tokenData.access_token;
    const today = new Date();
    const isoUtc = (d: Date) => d.toISOString().replace('.000Z', 'Z').replace(/\.\d+Z$/, 'Z');

    for (let month = 1; month <= 12; month++) {
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      if (start > today) break;
      const endRaw = new Date(Date.UTC(year, month, 0, 23, 59, 59));
      const end = endRaw > today ? today : endRaw;

      console.log(`[PayPal] Fetching ${start.toISOString().slice(0,10)} → ${end.toISOString().slice(0,10)}`);

      let page = 1;
      while (true) {
        try {
          const params = new URLSearchParams({
            start_date: isoUtc(start),
            end_date: isoUtc(end),
            fields: 'all',
            page_size: '500',
            page: String(page),
            balance_affecting_records_only: 'Y',
          });
          const data = await fetchJson(
            `https://api-m.paypal.com/v1/reporting/transactions?${params}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const txs = data.transaction_details || [];
          console.log(`[PayPal] Month ${month} page ${page}: ${txs.length} transactions`);
          const seenIds = new Set<string>();
          for (const tx of txs) {
            const info = tx.transaction_info || {};
            const payer = tx.payer_info || {};
            const amount = info.transaction_amount || {};
            // Only status S (success) - matches Python script
            if (info.transaction_status !== 'S') continue;
            const txId = info.transaction_id || '';
            if (!txId || seenIds.has(txId)) continue;
            seenIds.add(txId);
            const val = parseFloat(amount.value || '0');
            if (val <= 0) continue;
            // Use transaction_subject for subscription detection (matches Python detect_subscription_from_text)
            const subject = (info.transaction_subject || '').toLowerCase();
            const isSub = subject.includes('monthly') || subject.includes('subscription');
            const payerName = payer.payer_name?.alternate_full_name ||
              [payer.payer_name?.given_name, payer.payer_name?.surname].filter(Boolean).join(' ');
            donations.push({
              id: txId, date: info.transaction_initiation_date || '',
              amount: val, currency: amount.currency_code || 'GBP',
              gateway: 'paypal', type: isSub ? 'recurring' : 'oneoff', status: 'paid',
              subscription_id: undefined, // PayPal has no subscription_id - dedup by payer email
              payer: { name: payerName, email: payer.email_address },
            });
          }
          if (txs.length < 500) break;
          page++;
        } catch (pageErr) {
          console.error(`[PayPal] Month ${month} page ${page} error:`, pageErr);
          break;
        }
      }
    }
  } catch (err) { console.error('[PayPal] Error:', err); }
  return donations;
}

async function verifySession(req: VercelRequest): Promise<boolean> {
  const cookies = req.headers.cookie ?? '';
  const match = cookies.match(/admin_session=([^;]+)/);
  if (!match) return false;
  try {
    const redis = getRedis();
    const session = await redis.get(`session:${match[1]}`);
    return !!session;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for Vercel Cron header (can be 'true', '1', or just present)
  const isVercelCron = !!req.headers['x-vercel-cron'];

  // Check for token in URL query param
  const url = new URL(req.url || '', 'http://localhost');
  const urlToken = url.searchParams.get('token');

  let isAuthenticated = isVercelCron || await verifySession(req);

  // If no session cookie, check if token is valid in Redis
  if (!isAuthenticated && urlToken) {
    try {
      const redis = getRedis();
      const session = await redis.get(`session:${urlToken}`);
      isAuthenticated = !!session;
    } catch (err) {
      console.error('[admin-sync] Redis check failed:', err);
    }
  }

  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[admin-sync] === SYNC START ===');
    const year = new Date().getFullYear();
    const donations: Donation[] = [];

    donations.push(...(await fetchMolliePayments(year)));
    console.log('[admin-sync] Mollie:', donations.filter(d => d.gateway === 'mollie').length);

    donations.push(...(await fetchGoCardlessPayments(year)));
    console.log('[admin-sync] GoCardless:', donations.filter(d => d.gateway === 'gocardless').length);

    donations.push(...(await fetchPayPalPayments(year)));
    console.log('[admin-sync] PayPal:', donations.filter(d => d.gateway === 'paypal').length);

    donations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const total = donations.reduce((sum, d) => sum + d.amount, 0);
    const now = new Date();

    // Calculate month keys for current and previous month
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    // ── DONOR INSIGHTS (derived from `donations`, no extra API calls) ──
    // Only paid GBP donations count toward giving figures (mirrors monthlyTotals).
    const paidGbp = donations.filter(d => d.status === 'paid' && d.currency === 'GBP');
    const monthKey = (d: Donation) => (d.date && d.date.length >= 7 ? d.date.slice(0, 7) : '');
    const subKeyOf = (d: Donation) => d.subscription_id || d.payer?.email || d.id;

    // Sorted list of distinct months present (chronological), last 12.
    const allMonths = Array.from(new Set(paidGbp.map(monthKey).filter(Boolean))).sort();
    const last12Months = allMonths.slice(-12);

    // The last COMPLETE month is the most recent month that is not the current month.
    const lastCompleteMonth = allMonths.filter(m => m !== currentMonth).slice(-1)[0] || '';

    // Recurring donations of the last complete month: sum the most recent gift of each
    // active subscriber → expected monthly recurring revenue (MRR).
    const lastMonthRecurring = paidGbp.filter(d => d.type === 'recurring' && monthKey(d) === lastCompleteMonth);
    const mrrBySub = new Map<string, { date: string; amount: number }>();
    for (const d of lastMonthRecurring) {
      const key = subKeyOf(d);
      const prev = mrrBySub.get(key);
      if (!prev || new Date(d.date).getTime() > new Date(prev.date).getTime()) {
        mrrBySub.set(key, { date: d.date, amount: d.amount });
      }
    }
    const mrr = Math.round(Array.from(mrrBySub.values()).reduce((s, v) => s + v.amount, 0) * 100) / 100;

    const lastMonthMonthlyDonations = lastMonthRecurring.reduce((s, d) => s + d.amount, 0);
    const lastMonthActiveSubs = mrrBySub.size;
    const avgMonthlyGift = lastMonthActiveSubs > 0
      ? Math.round((lastMonthMonthlyDonations / lastMonthActiveSubs) * 100) / 100
      : 0;

    const oneOffYear = paidGbp.filter(d => d.type === 'oneoff');
    const avgOneOffGift = oneOffYear.length > 0
      ? Math.round((oneOffYear.reduce((s, d) => s + d.amount, 0) / oneOffYear.length) * 100) / 100
      : 0;

    // Recurring vs one-off split (year, by amount).
    const recurringYearAmount = paidGbp.filter(d => d.type === 'recurring').reduce((s, d) => s + d.amount, 0);
    const oneOffYearAmount = oneOffYear.reduce((s, d) => s + d.amount, 0);
    const splitTotal = recurringYearAmount + oneOffYearAmount || 1;
    const splitPct = {
      recurring: Math.round((recurringYearAmount / splitTotal) * 100),
      oneOff: Math.round((oneOffYearAmount / splitTotal) * 100),
    };

    // Gift-size buckets across ALL paid donations of the year.
    const bucketDefs: Array<{ bucket: string; test: (a: number) => boolean }> = [
      { bucket: '<£5', test: a => a < 5 },
      { bucket: '£5–10', test: a => a >= 5 && a < 10 },
      { bucket: '£10–25', test: a => a >= 10 && a < 25 },
      { bucket: '£25–50', test: a => a >= 25 && a < 50 },
      { bucket: '£50+', test: a => a >= 50 },
    ];
    const giftSizeBuckets = bucketDefs.map(({ bucket, test }) => {
      const hits = paidGbp.filter(d => test(d.amount));
      return {
        bucket,
        count: hits.length,
        amount: Math.round(hits.reduce((s, d) => s + d.amount, 0) * 100) / 100,
      };
    });

    // Subscriber flows per month: compare Sets of recurring subscriber keys between
    // consecutive months → joined / churned / net.
    const subSetByMonth = new Map<string, Set<string>>();
    for (const d of paidGbp) {
      if (d.type !== 'recurring') continue;
      const m = monthKey(d);
      if (!m) continue;
      if (!subSetByMonth.has(m)) subSetByMonth.set(m, new Set<string>());
      subSetByMonth.get(m)!.add(subKeyOf(d));
    }
    const subscriberFlows = last12Months.map((m, idx) => {
      const cur = subSetByMonth.get(m) || new Set<string>();
      const prevMonthKey = idx > 0 ? last12Months[idx - 1] : '';
      const prevSet = (prevMonthKey && subSetByMonth.get(prevMonthKey)) || new Set<string>();
      let joined = 0, churned = 0;
      if (idx === 0) {
        // No comparison month available; treat all current as the baseline (no churn).
        return { month: m, joined: 0, churned: 0, net: 0 };
      }
      for (const k of cur) if (!prevSet.has(k)) joined++;
      for (const k of prevSet) if (!cur.has(k)) churned++;
      return { month: m, joined, churned, net: joined - churned };
    });

    // Repeat one-off donors: payers (email, else name) with 2+ one-off gifts this year.
    const oneOffByPayer = new Map<string, number>();
    for (const d of oneOffYear) {
      const payerKey = (d.payer?.email || d.payer?.name || '').trim().toLowerCase();
      if (!payerKey) continue;
      oneOffByPayer.set(payerKey, (oneOffByPayer.get(payerKey) || 0) + 1);
    }
    const repeatOneOffDonors = Array.from(oneOffByPayer.values()).filter(c => c >= 2).length;

    const donorInsights = {
      mrr,
      avgMonthlyGift,
      avgOneOffGift,
      splitPct,
      giftSizeBuckets,
      subscriberFlows,
      repeatOneOffDonors,
    };

    const donationData = {
      donorInsights,
      totalMonth: donations.filter(d => {
        const dDate = new Date(d.date);
        return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
      }).reduce((s, d) => s + d.amount, 0),
      totalYear: total,
      activeSubscribers: 0, // Will be set from monthlyTotals below
      newThisMonth: 0, // Will be calculated below
      cancelledThisMonth: donations.filter(d => d.status === 'cancelled').length,
      byGateway: {
        mollie: donations.filter(d => d.gateway === 'mollie').reduce((s, d) => s + d.amount, 0),
        gocardless: donations.filter(d => d.gateway === 'gocardless').reduce((s, d) => s + d.amount, 0),
        paypal: donations.filter(d => d.gateway === 'paypal').reduce((s, d) => s + d.amount, 0),
      },
      recentDonations: donations.slice(0, 10).map(d => ({
        date: d.date, amount: d.amount, currency: d.currency,
        type: d.type, gateway: d.gateway, status: d.status,
      })),
      cancelledSubscriptions: donations.filter(d => d.status === 'cancelled').slice(0, 10).map(d => ({
        date: d.date, amount: d.amount, currency: d.currency,
        gateway: d.gateway, payer: d.payer?.email || d.payer?.name || 'Unknown',
      })),
      failedTransactions: donations.filter(d => d.status === 'failed').slice(0, 10).map(d => ({
        date: d.date, amount: d.amount, currency: d.currency,
        gateway: d.gateway, payer: d.payer?.email || d.payer?.name || 'Unknown',
      })),
      monthlyTotals: Array.from(
        donations.reduce((m, d) => {
          if (!d.date || d.date.length < 7) return m;
          const month = d.date.slice(0, 7);
          const existing = m.get(month) || {
            month, total: 0, monthly_donations: 0, one_off_donations: 0,
            active_subscribers: new Set<string>(),
            mollie_subs: new Set<string>(), gocardless_subs: new Set<string>(), paypal_subs: new Set<string>(),
            failed_payments: 0, failed_amount: 0,
            failed_mollie: 0, failed_gocardless: 0, failed_paypal: 0,
            cancelled: 0, cancelled_amount: 0,
            cancelled_mollie: 0, cancelled_gocardless: 0, cancelled_paypal: 0,
          };
          if (d.status === 'failed' && d.currency === 'GBP') {
            existing.failed_payments++;
            existing.failed_amount += d.amount;
            if (d.gateway === 'mollie') existing.failed_mollie++;
            else if (d.gateway === 'gocardless') existing.failed_gocardless++;
            else if (d.gateway === 'paypal') existing.failed_paypal++;
          } else if (d.status === 'cancelled' && d.currency === 'GBP') {
            existing.cancelled++;
            existing.cancelled_amount += d.amount;
            if (d.gateway === 'mollie') existing.cancelled_mollie++;
            else if (d.gateway === 'gocardless') existing.cancelled_gocardless++;
            else if (d.gateway === 'paypal') existing.cancelled_paypal++;
          } else if (d.currency === 'GBP') {
            existing.total += d.amount;
            if (d.type === 'recurring') {
              existing.monthly_donations += d.amount;
              const subKey = d.subscription_id || d.payer?.email || d.id;
              existing.active_subscribers.add(subKey);
              if (d.gateway === 'mollie') existing.mollie_subs.add(subKey);
              else if (d.gateway === 'gocardless') existing.gocardless_subs.add(subKey);
              else if (d.gateway === 'paypal') existing.paypal_subs.add(subKey);
            } else {
              existing.one_off_donations += d.amount;
            }
          }
          m.set(month, existing);
          return m;
        }, new Map<string, any>()).entries()
      ).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).reverse().map(([month, data]) => ({
        month,
        total: Math.round(data.total * 100) / 100,
        monthly_donations: Math.round(data.monthly_donations * 100) / 100,
        one_off_donations: Math.round(data.one_off_donations * 100) / 100,
        active_subscribers: data.active_subscribers.size,
        mollie_count: data.mollie_subs.size,
        gocardless_count: data.gocardless_subs.size,
        paypal_count: data.paypal_subs.size,
        failed_payments: data.failed_payments,
        failed_amount: Math.round(data.failed_amount * 100) / 100,
        failed_mollie: data.failed_mollie,
        failed_gocardless: data.failed_gocardless,
        failed_paypal: data.failed_paypal,
        cancelled: data.cancelled,
        cancelled_amount: Math.round(data.cancelled_amount * 100) / 100,
        cancelled_mollie: data.cancelled_mollie,
        cancelled_gocardless: data.cancelled_gocardless,
        cancelled_paypal: data.cancelled_paypal,
        total_lost: Math.round((data.failed_amount + data.cancelled_amount) * 100) / 100,
      })),
    };

    // Calculate activeSubscribers and newThisMonth from monthlyTotals
    const currentMonthData = donationData.monthlyTotals.find(m => m.month === currentMonth);
    const prevMonthData = donationData.monthlyTotals.find(m => m.month === prevMonth);
    const monthBeforePrev = prevMonth.substring(0, 7); // Get month before prevMonth
    const twoMonthsAgoStr = prevMonth.substring(0, 4) === '2026' && prevMonth.substring(5) === '01'
      ? '2025-12'
      : `${prevMonth.substring(0, 4)}-${String(parseInt(prevMonth.substring(5)) - 1).padStart(2, '0')}`;
    const twoMonthsAgoData = donationData.monthlyTotals.find(m => m.month === twoMonthsAgoStr);

    // Show previous month's data: active subscribers and how many were new that month
    if (prevMonthData) {
      donationData.activeSubscribers = prevMonthData.active_subscribers;
      donationData.newThisMonth = prevMonthData.active_subscribers - (twoMonthsAgoData?.active_subscribers || 0);
    } else if (currentMonthData) {
      donationData.activeSubscribers = currentMonthData.active_subscribers;
      donationData.newThisMonth = 0;
    }

    const redis = getRedis();
    await redis.set('admin:donations', donationData);
    await redis.set('admin:lastSync', new Date().toISOString());
    console.log('[admin-sync] ✅ Saved to Redis');

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
    console.error('[admin-sync] ❌ ERROR:', msg);
    return res.status(500).json({ error: msg, ok: false });
  }
}
