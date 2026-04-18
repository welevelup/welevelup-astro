/**
 * POST /api/create-donation
 *
 * Vercel serverless function (Node.js runtime). Receives a donation form
 * submission, creates a Mollie payment, and returns the checkout URL for the
 * frontend to redirect to. Supports one-time and recurring (monthly).
 *
 * Env vars: MOLLIE_API_KEY, PUBLIC_SITE_URL, MOLLIE_WEBHOOK_URL
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient, SequenceType } from '@mollie/api-client';

interface DonationBody {
  amount: string;
  recurring: boolean;
  donorName: string;
  donorEmail: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  const siteUrl = process.env.PUBLIC_SITE_URL;
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL;
  if (!apiKey || !siteUrl || !webhookUrl) {
    return res.status(500).json({ error: 'Mollie env vars not configured' });
  }

  const body = req.body as DonationBody;
  const { amount, recurring, donorName, donorEmail } = body;

  const amountNum = parseFloat(amount);
  if (!Number.isFinite(amountNum) || amountNum < 1) {
    return res.status(400).json({ error: 'Amount must be at least £1' });
  }
  if (recurring && (!donorName || !donorEmail)) {
    return res.status(400).json({ error: 'Name and email are required for recurring donations' });
  }
  if (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const mollie = createMollieClient({ apiKey });
  const formattedAmount = amountNum.toFixed(2);
  const redirectUrl = `${siteUrl.replace(/\/$/, '')}/donate/thank-you`;

  try {
    if (recurring) {
      const customer = await mollie.customers.create({
        name: donorName,
        email: donorEmail,
      });

      const payment = await mollie.payments.create({
        amount: { currency: 'GBP', value: formattedAmount },
        description: `Level Up — Monthly donation (£${formattedAmount}/month)`,
        redirectUrl,
        webhookUrl,
        customerId: customer.id,
        sequenceType: SequenceType.first,
        metadata: {
          type: 'recurring',
          amount: formattedAmount,
          donorEmail,
          donorName,
          source: 'astro',
        },
      });

      return res.json({ checkoutUrl: payment.getCheckoutUrl() });
    }

    const payment = await mollie.payments.create({
      amount: { currency: 'GBP', value: formattedAmount },
      description: `Level Up — Donation (£${formattedAmount})`,
      redirectUrl,
      webhookUrl,
      metadata: {
        type: 'one-time',
        amount: formattedAmount,
        donorEmail: donorEmail || null,
        donorName: donorName || null,
        source: 'astro',
      },
    });

    return res.json({ checkoutUrl: payment.getCheckoutUrl() });
  } catch (err) {
    console.error('[create-donation] Mollie error', err);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
}
