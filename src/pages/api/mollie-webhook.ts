import type { APIRoute } from 'astro';
import { createMollieClient, SubscriptionStatus } from '@mollie/api-client';
import { sendDonationConfirmation } from '../../lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.MOLLIE_API_KEY;

  if (!apiKey) {
    console.error('[mollie-webhook] missing env vars');
    return new Response('Internal error', { status: 500 });
  }

  let paymentId: string | undefined;
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);
    paymentId = params.get('id') ?? undefined;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  if (!paymentId) {
    return new Response('Missing id', { status: 400 });
  }

  const mollie = createMollieClient({ apiKey });

  try {
    const payment = await mollie.payments.get(paymentId);
    console.log(
      `[mollie-webhook] payment=${paymentId} status=${payment.status} seq=${payment.sequenceType}`
    );

    if (payment.status !== 'paid') {
      return new Response('OK', { status: 200 });
    }

    const meta = payment.metadata as Record<string, string> | null;
    console.log(`[mollie-webhook] meta=${JSON.stringify(meta)}`);
    console.log(`[mollie-webhook] RESEND_API_KEY set=${!!import.meta.env.RESEND_API_KEY}`);

    // Send confirmation email for new one-time or first recurring payments
    if (
      (payment.sequenceType === 'oneoff' || payment.sequenceType === 'first') &&
      meta?.donorEmail
    ) {
      console.log(`[mollie-webhook] sending email to ${meta.donorEmail}`);
      try {
        await sendDonationConfirmation({
          to: meta.donorEmail,
          name: meta.donorName || '',
          amount: meta.amount || payment.amount.value,
          recurring: meta.type === 'recurring',
          giftAid: meta.giftAid === 'true',
        });
      } catch (emailErr) {
        console.error('[mollie-webhook] email send failed', emailErr);
      }
    }

    // Create subscription for first recurring payment
    if (payment.sequenceType !== 'first' || !meta || meta.type !== 'recurring') {
      return new Response('OK', { status: 200 });
    }

    const customerId = payment.customerId;
    if (!customerId) {
      return new Response('OK', { status: 200 });
    }

    let subs;
    try {
      subs = await mollie.customerSubscriptions.page({ customerId });
    } catch (subsErr) {
      console.error('[mollie-webhook] failed to fetch subscriptions, aborting to avoid duplicate', subsErr);
      return new Response('Internal error', { status: 500 });
    }

    const duplicate = Array.from(subs as Iterable<{ status: string; id: string }>).find(
      (s) => s.status === SubscriptionStatus.active || s.status === SubscriptionStatus.pending
    );

    if (duplicate) {
      console.log(
        `[mollie-webhook] subscription already exists (${duplicate.id}) for customer ${customerId}`
      );
      return new Response('OK', { status: 200 });
    }

    const amount = meta.amount ?? payment.amount.value;
    const subscription = await mollie.customerSubscriptions.create({
      customerId,
      amount: { currency: 'GBP', value: parseFloat(amount).toFixed(2) },
      interval: '1 month',
      description: `Level Up — Monthly donation (£${amount}/month)`,
      webhookUrl: import.meta.env.MOLLIE_WEBHOOK_URL,
      metadata: { source: 'astro', donorEmail: meta.donorEmail },
    });

    console.log(
      `[mollie-webhook] created subscription ${subscription.id} for customer ${customerId} (£${amount}/month)`
    );

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[mollie-webhook] error', err);
    return new Response('Internal error', { status: 500 });
  }
};
