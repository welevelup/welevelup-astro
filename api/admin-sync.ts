import { saveDonationData, type DonationData } from '../src/lib/admin-data';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
    return res.status(200).json({ ok: true, message: 'Sync successful' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
