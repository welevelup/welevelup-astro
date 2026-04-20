import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient, SequenceType } from '@mollie/api-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.MOLLIE_API_KEY;
  const siteUrl = process.env.PUBLIC_SITE_URL;
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL;

  if (!apiKey || !siteUrl || !webhookUrl) {
    console.error('[create-donation] missing env vars');
    return res.status(500).json({ error: 'Mollie env vars not configured' });
  }

  const body = req.body as {
    amount?: string;
    recurring?: boolean;
    donorName?: string;
    donorEmail?: string;
    giftAid?: boolean;
  };

  const { amount, recurring, donorName = '', donorEmail = '', giftAid = false } = body ?? {};

  const amountNum = parseFloat(amount ?? '');
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
  const redirectUrl = `${siteUrl.replace(/\\n/g, '').trim().replace(/\/$/, '')}/donate/thank-you`;

  try {
    if (recurring) {
      const customer = await mollie.customers.create({
        name: donorName,
        email: donorEmail,
        metadata: { source: 'astro' },
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
          giftAid: String(giftAid),
          source: 'astro',
        },
      });
      return res.status(200).json({ checkoutUrl: payment.getCheckoutUrl() });
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
        giftAid: String(giftAid),
        source: 'astro',
      },
    });
    return res.status(200).json({ checkoutUrl: payment.getCheckoutUrl() });
  } catch (err) {
    console.error('[create-donation] Mollie error', err);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
}
