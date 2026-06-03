import type { APIRoute } from 'astro';
import { syncDonations } from '../../lib/donation-sync';
import { saveDonationData, type DonationData } from '../../lib/admin-data';

export const prerender = false;

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export const POST: APIRoute = async ({ request }) => {
  const cronSecret = request.headers.get('x-vercel-cron-secret');
  const envSecret = process.env.CRON_SECRET;

  if (envSecret && cronSecret !== envSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const year = new Date().getFullYear();
    const now = new Date();
    const thisMonth = monthKey(now.toISOString());

    const result = await syncDonations(year);

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthDonations = result.donations.filter((d) => {
      const dDate = new Date(d.date);
      return dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear;
    });
    const totalMonth = thisMonthDonations.reduce((sum, d) => sum + d.amount, 0);
    const totalYear = result.donations
      .filter((d) => new Date(d.date).getFullYear() === currentYear)
      .reduce((sum, d) => sum + d.amount, 0);

    const uniqueRecurringDonors = new Set(
      result.donations
        .filter((d) => d.type === 'recurring')
        .map((d) => d.payer?.email || d.id)
    );
    const activeSubscribers = uniqueRecurringDonors.size;
    const newThisMonth = thisMonthDonations.filter((d) => d.type === 'recurring').length;

    const byGateway = {
      mollie: result.donations.filter((d) => d.gateway === 'mollie').reduce((s, d) => s + d.amount, 0),
      gocardless: result.donations.filter((d) => d.gateway === 'gocardless').reduce((s, d) => s + d.amount, 0),
      paypal: result.donations.filter((d) => d.gateway === 'paypal').reduce((s, d) => s + d.amount, 0),
    };

    const recentDonations = result.donations.slice(0, 10).map((d) => ({
      date: d.date,
      amount: d.amount,
      currency: d.currency,
      type: d.type,
      gateway: d.gateway,
    }));

    const monthlyMap: Record<string, number> = {};
    for (const d of result.donations) {
      const month = monthKey(d.date);
      monthlyMap[month] = (monthlyMap[month] ?? 0) + d.amount;
    }

    const monthlyTotals = Object.entries(monthlyMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .reverse()
      .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));

    const donationData: DonationData = {
      totalMonth: Math.round(totalMonth * 100) / 100,
      totalYear: Math.round(totalYear * 100) / 100,
      activeSubscribers,
      newThisMonth,
      cancelledThisMonth: 0,
      byGateway: {
        mollie: Math.round(byGateway.mollie * 100) / 100,
        gocardless: Math.round(byGateway.gocardless * 100) / 100,
        paypal: Math.round(byGateway.paypal * 100) / 100,
      },
      recentDonations,
      monthlyTotals,
    };

    await saveDonationData(donationData);

    return new Response(JSON.stringify({ ok: true, synced: result.count, total: result.total }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Sync error:', msg, err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
