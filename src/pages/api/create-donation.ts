import type { APIRoute } from 'astro';
import { createMollieClient, SequenceType } from '@mollie/api-client';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.MOLLIE_API_KEY;
  const siteUrl = import.meta.env.PUBLIC_SITE_URL;
  const webhookUrl = import.meta.env.MOLLIE_WEBHOOK_URL;

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (!apiKey || !siteUrl || !webhookUrl) {
    return json({ error: 'Mollie env vars not configured' }, 500);
  }

  let body: { amount?: string; recurring?: boolean; donorName?: string; donorEmail?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { amount, recurring, donorName = '', donorEmail = '' } = body;

  const amountNum = parseFloat(amount ?? '');
  if (!Number.isFinite(amountNum) || amountNum < 1) {
    return json({ error: 'Amount must be at least £1' }, 400);
  }
  if (recurring && (!donorName || !donorEmail)) {
    return json({ error: 'Name and email are required for recurring donations' }, 400);
  }
  if (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
    return json({ error: 'Invalid email' }, 400);
  }

  const mollie = createMollieClient({ apiKey });
  const formattedAmount = amountNum.toFixed(2);
  const redirectUrl = `${siteUrl.replace(/\/$/, '')}/donate/thank-you`;

  try {
    if (recurring) {
      const customer = await mollie.customers.create({ name: donorName, email: donorEmail });
      const payment = await mollie.payments.create({
        amount: { currency: 'GBP', value: formattedAmount },
        description: `Level Up — Monthly donation (£${formattedAmount}/month)`,
        redirectUrl,
        webhookUrl,
        customerId: customer.id,
        sequenceType: SequenceType.first,
        metadata: { type: 'recurring', amount: formattedAmount, donorEmail, donorName, source: 'astro' },
      });
      return json({ checkoutUrl: payment.getCheckoutUrl() });
    }

    const payment = await mollie.payments.create({
      amount: { currency: 'GBP', value: formattedAmount },
      description: `Level Up — Donation (£${formattedAmount})`,
      redirectUrl,
      webhookUrl,
      metadata: { type: 'one-time', amount: formattedAmount, donorEmail: donorEmail || null, donorName: donorName || null, source: 'astro' },
    });
    return json({ checkoutUrl: payment.getCheckoutUrl() });
  } catch (err) {
    console.error('[create-donation] Mollie error', err);
    return json({ error: 'Failed to create payment' }, 500);
  }
};
