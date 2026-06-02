import type { APIRoute } from 'astro';
import { saveDonationData, type DonationData } from '../../../lib/admin-data';

const MOLLIE_BASE = 'https://api.mollie.com/v2';

async function mollieGet(path: string) {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) throw new Error('MOLLIE_API_KEY not set');
  const res = await fetch(`${MOLLIE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Mollie ${res.status}: ${path}`);
  return res.json();
}

function toGBP(amount: { value: string; currency: string }): number {
  return parseFloat(amount.value);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export const POST: APIRoute = async ({ request }) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();
    const thisMonth = monthKey(now.toISOString());
    const thisYear = now.getFullYear().toString();

    let totalMonth = 0;
    let totalYear = 0;
    let activeSubscribers = 0;
    let newThisMonth = 0;
    let cancelledThisMonth = 0;
    const recentDonations: DonationData['recentDonations'] = [];
    const monthlyMap: Record<string, number> = {};

    // Fetch payments
    let nextUrl: string | null = `${MOLLIE_BASE}/payments?limit=250`;
    let pageCount = 0;
    while (nextUrl && pageCount < 10) {
      const key = process.env.MOLLIE_API_KEY;
      const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${key}` } });
      if (!res.ok) break;
      const data = await res.json() as { _embedded: { payments: any[] }; _links: { next?: { href: string } } };
      const payments = data._embedded?.payments ?? [];

      for (const p of payments) {
        if (p.status !== 'paid') continue;
        const amount = toGBP(p.amount);
        const date = p.paidAt ?? p.createdAt ?? '';
        const month = monthKey(date);
        const year = date.slice(0, 4);

        if (month === thisMonth) totalMonth += amount;
        if (year === thisYear) totalYear += amount;

        monthlyMap[month] = (monthlyMap[month] ?? 0) + amount;

        if (recentDonations.length < 20) {
          recentDonations.push({
            date,
            amount,
            currency: p.amount.currency,
            type: p.sequenceType === 'first' || p.sequenceType === 'recurring' ? 'recurring' : 'one-off',
            gateway: 'mollie',
          });
        }
      }

      nextUrl = data._links?.next?.href ?? null;
      pageCount++;
    }

    // Fetch subscriptions
    const subsData = await mollieGet('/subscriptions?limit=250').catch(() => ({ _embedded: { subscriptions: [] } }));
    const subs = subsData._embedded?.subscriptions ?? [];
    for (const s of subs) {
      if (s.status === 'active') activeSubscribers++;
      const created = monthKey(s.createdAt ?? '');
      const cancelled = s.canceledAt ? monthKey(s.canceledAt) : null;
      if (created === thisMonth) newThisMonth++;
      if (cancelled === thisMonth) cancelledThisMonth++;
    }

    const monthlyTotals = Object.entries(monthlyMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));

    const donationData: DonationData = {
      totalMonth: Math.round(totalMonth * 100) / 100,
      totalYear: Math.round(totalYear * 100) / 100,
      activeSubscribers,
      newThisMonth,
      cancelledThisMonth,
      byGateway: { mollie: Math.round(totalYear * 100) / 100, gocardless: 0, paypal: 0 },
      recentDonations,
      monthlyTotals,
    };

    await saveDonationData(donationData);

    return new Response(JSON.stringify({ ok: true, synced: recentDonations.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
