/**
 * POST /api/create-donation
 *
 * Vercel serverless function. Receives a donation form submission, creates a
 * Mollie payment, and returns the checkout URL for the frontend to redirect
 * to. Supports both one-time and recurring (monthly) donations.
 *
 * For recurring: creates a Customer first, then a payment with
 * sequenceType='first'. The actual Subscription is created LATER, by the
 * webhook handler, only after the first payment is confirmed paid.
 *
 * Env vars required:
 *   MOLLIE_API_KEY        — test_xxx or live_xxx from the NEW Mollie org
 *   PUBLIC_SITE_URL       — used to build the redirect URL
 *   MOLLIE_WEBHOOK_URL    — full URL Mollie will POST to on status changes
 */
import { createMollieClient, SequenceType } from '@mollie/api-client';

interface DonationRequest {
  amount: string; // GBP, e.g. "10.00"
  recurring: boolean;
  donorName: string;
  donorEmail: string;
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

function serverError(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  const siteUrl = process.env.PUBLIC_SITE_URL;
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL;
  if (!apiKey || !siteUrl || !webhookUrl) {
    return serverError('Mollie env vars not configured');
  }

  let body: DonationRequest;
  try {
    body = (await req.json()) as DonationRequest;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { amount, recurring, donorName, donorEmail } = body;

  // Basic validation
  const amountNum = parseFloat(amount);
  if (!Number.isFinite(amountNum) || amountNum < 1) {
    return badRequest('Amount must be at least £1');
  }
  if (recurring && (!donorName || !donorEmail)) {
    return badRequest('Name and email are required for recurring donations');
  }
  if (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
    return badRequest('Invalid email');
  }

  const mollie = createMollieClient({ apiKey });
  const formattedAmount = amountNum.toFixed(2);
  const redirectUrl = `${siteUrl.replace(/\/$/, '')}/donate/thank-you`;

  try {
    if (recurring) {
      // Step 1: create the customer (so we can attach a mandate)
      const customer = await mollie.customers.create({
        name: donorName,
        email: donorEmail,
      });

      // Step 2: first payment authorises the mandate. Subscription is NOT
      // created here — that happens in the webhook once status === 'paid'.
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

      return Response.json({ checkoutUrl: payment.getCheckoutUrl() });
    }

    // One-time donation: simpler, no customer needed
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

    return Response.json({ checkoutUrl: payment.getCheckoutUrl() });
  } catch (err) {
    console.error('[create-donation] Mollie error', err);
    return serverError('Failed to create payment');
  }
}
