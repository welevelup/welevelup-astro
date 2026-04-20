import type { APIRoute } from 'astro';
import { createMollieClient, SubscriptionStatus } from '@mollie/api-client';
import { sendDonationConfirmation } from '../../lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.MOLLIE_API_KEY;

  if (!apiKey) {
    console.error('[mollie-webhook] MOLLIE_API_KEY missing');
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
    const seq = payment.sequenceType;
    const status = payment.status;
    console.log(`[webhook] id=${paymentId} status=${status} seq=${seq}`);

    if (status !== 'paid') {
      console.log(`[webhook] skipping: not paid`);
      return new Response('OK', { status: 200 });
    }

    // Mollie metadata can be object or stringified JSON
    let meta: Record<string, string> | null = null;
    if (payment.metadata && typeof payment.metadata === 'string') {
      try { meta = JSON.parse(payment.metadata); } catch { meta = null; }
    } else if (payment.metadata && typeof payment.metadata === 'object') {
      meta = payment.metadata as Record<string, string>;
    }

    console.log(`[webhook] meta=${JSON.stringify(meta)}`);
    console.log(`[webhook] RESEND_KEY=${!!import.meta.env.RESEND_API_KEY}`);

    const shouldEmail = (seq === 'oneoff' || seq === 'first') && !!meta?.donorEmail;
    console.log(`[webhook] shouldEmail=${shouldEmail} email=${meta?.donorEmail ?? 'none'}`);

    if (shouldEmail && meta) {
      try {
        await sendDonationConfirmation({
          to: meta.donorEmail,
          name: meta.donorName || '',
          amount: meta.amount || payment.amount.value,
          recurring: meta.type === 'recurring',
          giftAid: meta.giftAid === 'true',
        });
        console.log(`[webhook] email sent to ${meta.donorEmail}`);
      } catch (emailErr) {
        console.error(`[webhook] email FAILED:`, emailErr);
      }
    }

    // Create subscription for first recurring payment
    if (seq !== 'first' || !meta || meta.type !== 'recurring') {
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
      console.error('[webhook] failed to fetch subscriptions', subsErr);
      return new Response('Internal error', { status: 500 });
    }

    const duplicate = Array.from(subs as Iterable<{ status: string; id: string }>).find(
      (s) => s.status === SubscriptionStatus.active || s.status === SubscriptionStatus.pending
    );

    if (duplicate) {
      console.log(`[webhook] subscription already exists: ${duplicate.id}`);
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

    console.log(`[webhook] subscription created: ${subscription.id} for ${customerId}`);
    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[webhook] error:', err);
    return new Response('Internal error', { status: 500 });
  }
};
