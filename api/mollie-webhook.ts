/**
 * POST /api/mollie-webhook
 *
 * Vercel serverless function (Node.js runtime). Mollie POSTs here on every
 * payment status change with a form-encoded body containing { id: 'tr_xxx' }.
 *
 * Idempotency: checks customerSubscriptions.list() for duplicates before
 * creating a new subscription. No DB needed.
 *
 * Env vars: MOLLIE_API_KEY, MOLLIE_WEBHOOK_URL
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient, SubscriptionStatus } from '@mollie/api-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL;
  if (!apiKey || !webhookUrl) {
    console.error('[mollie-webhook] missing env vars');
    return res.status(500).send('Server misconfigured');
  }

  // Mollie sends form-encoded: id=tr_xxxxx
  const paymentId = req.body?.id as string | undefined;
  if (!paymentId) {
    return res.status(400).send('Missing payment id');
  }

  const mollie = createMollieClient({ apiKey });

  try {
    const payment = await mollie.payments.get(paymentId);

    console.log(
      `[mollie-webhook] payment=${paymentId} status=${payment.status} seq=${payment.sequenceType}`
    );

    if (payment.status !== 'paid') {
      return res.status(200).send('OK');
    }

    const meta = (payment.metadata ?? {}) as {
      type?: string;
      amount?: string;
      donorEmail?: string;
      source?: string;
    };

    // Only act on recurring-first payments from our Astro flow
    if (meta.type !== 'recurring' || meta.source !== 'astro' || !payment.customerId) {
      return res.status(200).send('OK');
    }

    const amount = meta.amount ?? payment.amount.value;
    const customerId = payment.customerId;

    // Idempotency: skip if subscription already exists
    const existing = await mollie.customerSubscriptions.list({ customerId });
    const duplicate = existing.find(
      (sub) =>
        sub.status === SubscriptionStatus.active &&
        sub.amount.value === amount &&
        sub.amount.currency === 'GBP'
    );
    if (duplicate) {
      console.log(
        `[mollie-webhook] subscription already exists (${duplicate.id}) for customer ${customerId}`
      );
      return res.status(200).send('OK');
    }

    const subscription = await mollie.customerSubscriptions.create({
      customerId,
      amount: { currency: 'GBP', value: amount },
      interval: '1 month',
      description: `Level Up — Monthly donation (£${amount}/month)`,
      webhookUrl,
      metadata: {
        source: 'astro',
        firstPaymentId: paymentId,
      },
    });

    console.log(
      `[mollie-webhook] created subscription ${subscription.id} for customer ${customerId} (£${amount}/month)`
    );

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[mollie-webhook] error', err);
    return res.status(500).send('Error');
  }
}
