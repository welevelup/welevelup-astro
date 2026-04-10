/**
 * POST /api/mollie-webhook
 *
 * Vercel serverless function that receives Mollie payment status updates.
 *
 * Mollie sends `application/x-www-form-urlencoded` with a single field `id`
 * containing the payment id (e.g. `tr_xxxxx`). The webhook may fire multiple
 * times for the same event (Mollie retries on non-2xx, and replays on
 * subsequent state changes), so this handler MUST be idempotent.
 *
 * Idempotency strategy (no DB):
 *   - Look up the payment by id.
 *   - If status !== 'paid', do nothing useful (just 200 so Mollie stops
 *     retrying — for failed/canceled we acknowledge).
 *   - If it's a recurring first payment (sequenceType='first', metadata
 *     type='recurring') AND no active subscription with the same amount
 *     exists for this customer yet, create the subscription.
 *   - If a matching subscription already exists, do nothing.
 *
 * Env vars:
 *   MOLLIE_API_KEY        — same key as create-donation
 *   MOLLIE_WEBHOOK_URL    — same URL, propagated to the new subscription
 */
import { createMollieClient, SubscriptionStatus } from '@mollie/api-client';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL;
  if (!apiKey || !webhookUrl) {
    console.error('[mollie-webhook] missing env vars');
    return new Response('Server misconfigured', { status: 500 });
  }

  // Mollie sends form-encoded body
  let paymentId: string | null = null;
  try {
    const form = await req.formData();
    paymentId = form.get('id') as string | null;
  } catch (err) {
    console.error('[mollie-webhook] could not parse form body', err);
    return new Response('Bad request', { status: 400 });
  }

  if (!paymentId) {
    return new Response('Missing payment id', { status: 400 });
  }

  const mollie = createMollieClient({ apiKey });

  try {
    const payment = await mollie.payments.get(paymentId);

    // Always log for visibility
    console.log(
      `[mollie-webhook] payment=${paymentId} status=${payment.status} sequenceType=${payment.sequenceType}`
    );

    if (payment.status !== 'paid') {
      // For failed / canceled / expired, acknowledge and move on. For pending
      // / open we'll get another webhook later.
      return new Response('OK', { status: 200 });
    }

    const meta = (payment.metadata ?? {}) as {
      type?: string;
      amount?: string;
      donorEmail?: string;
      source?: string;
    };

    // Only process recurring-first payments here. One-time donations are
    // already complete; nothing to do.
    if (meta.type !== 'recurring' || !payment.customerId) {
      return new Response('OK', { status: 200 });
    }

    const amount = meta.amount ?? payment.amount.value;
    const customerId = payment.customerId;

    // Idempotency check: does this customer already have an active
    // subscription with the same amount? If so, this webhook is a replay
    // for an event we've already handled.
    const existing = await mollie.customerSubscriptions.list({ customerId });
    const duplicate = existing.find(
      (sub) =>
        sub.status === SubscriptionStatus.active &&
        sub.amount.value === amount &&
        sub.amount.currency === 'GBP'
    );
    if (duplicate) {
      console.log(
        `[mollie-webhook] subscription already exists (${duplicate.id}) for customer ${customerId} — skipping`
      );
      return new Response('OK', { status: 200 });
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

    // TODO: send confirmation email to donor and/or admin notification.
    // For now we rely on Mollie's built-in donor confirmation email.

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[mollie-webhook] error', err);
    // Return 500 so Mollie retries
    return new Response('Error', { status: 500 });
  }
}
