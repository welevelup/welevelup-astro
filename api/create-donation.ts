import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient, SequenceType } from '@mollie/api-client';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[create-donation] === START ===');

  if (req.method !== 'POST') {
    console.log('[create-donation] Method not POST:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  const siteUrl = process.env.PUBLIC_SITE_URL;
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL;

  console.log('[create-donation] Env vars:', {
    apiKey: apiKey ? apiKey.slice(0, 10) + '...' : 'MISSING',
    siteUrl,
    webhookUrl
  });

  if (!apiKey || !siteUrl || !webhookUrl) {
    console.error('[create-donation] ❌ MISSING ENV VARS:', {
      apiKey: !!apiKey,
      siteUrl: !!siteUrl,
      webhookUrl: !!webhookUrl
    });
    return res.status(500).json({ error: 'Mollie env vars not configured' });
  }

  console.log('[create-donation] ✅ Env vars present');

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
  const baseUrl = siteUrl.replace(/\\n/g, '').trim().replace(/\/$/, '');
  const donationType = recurring ? 'monthly' : 'one-time';
  const redirectUrl = `${baseUrl}/donate/thank-you?amount=${formattedAmount}&type=${donationType}`;

  console.log('[create-donation] Creating payment with:', {
    siteUrl: siteUrl,
    baseUrl: baseUrl,
    formattedAmount: formattedAmount,
    donationType: donationType,
    redirectUrl: redirectUrl,
    webhookUrl: webhookUrl,
    donorEmail: donorEmail ? donorEmail.slice(0, 10) + '...' : 'none'
  });

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
        redirectUrl: redirectUrl,
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
      const token = crypto.randomBytes(16).toString('hex');
      res.setHeader('Set-Cookie', `paymentId=${payment.id}; Path=/; Max-Age=3600; HttpOnly`);
      return res.status(200).json({
        checkoutUrl: payment.getCheckoutUrl(),
        paymentToken: payment.id,
        validationToken: token
      });
    }

    const payment = await mollie.payments.create({
      amount: { currency: 'GBP', value: formattedAmount },
      description: `Level Up — Donation (£${formattedAmount})`,
      redirectUrl: redirectUrl,
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
    const token = crypto.randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', `paymentId=${payment.id}; Path=/; Max-Age=3600; HttpOnly`);
    return res.status(200).json({
      checkoutUrl: payment.getCheckoutUrl(),
      paymentToken: payment.id,
      validationToken: token
    });
  } catch (err) {
    console.error('[create-donation] Mollie error', err);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
}
