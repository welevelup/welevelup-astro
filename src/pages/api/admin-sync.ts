import type { APIRoute } from 'astro';
import { saveDonationData, type DonationData } from '../../lib/admin-data';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const year = new Date().getFullYear();
    const now = new Date();

    // TODO: sync all 3 gateways (Mollie, GoCardless, PayPal)
    const donationData: DonationData = {
      totalMonth: 1250.50,
      totalYear: 8750.00,
      activeSubscribers: 12,
      newThisMonth: 3,
      cancelledThisMonth: 0,
      byGateway: { mollie: 5000, gocardless: 2500, paypal: 1250 },
      recentDonations: [
        {
          date: new Date().toISOString(),
          amount: 50,
          currency: 'GBP',
          type: 'recurring',
          gateway: 'mollie',
        },
      ],
      monthlyTotals: [
        { month: new Date().toISOString().slice(0, 7), total: 1250.50 },
      ],
    };

    await saveDonationData(donationData);

    return new Response(JSON.stringify({ ok: true, synced: 0 }), {
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
