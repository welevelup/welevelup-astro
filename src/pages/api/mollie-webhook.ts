import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'crypto';
import { createMollieClient, SubscriptionStatus } from '@mollie/api-client';
import { sendDonationConfirmation, sendFailedPaymentNotice, sendSubscriptionSuspended } from '../../lib/email';

export const prerender = false;

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.MOLLIE_API_KEY;
  const webhookSecret = import.meta.env.MOLLIE_WEBHOOK_SECRET;

  // Verify the shared secret passed as a query param in MOLLIE_WEBHOOK_URL.
  // Rejects any request that doesn't know the secret — guards against arbitrary
  // payment IDs being submitted by third parties.
  // MOLLIE_WEBHOOK_SECRET is required — fail hard if unset so misconfiguration
  // is immediately visible rather than silently accepting unauthenticated requests.
  if (!webhookSecret) {
    console.error('[mollie-webhook] MOLLIE_WEBHOOK_SECRET not set — rejecting all requests');
    return new Response('Forbidden', { status: 403 });
  }
  const incoming = new URL(request.url).searchParams.get('secret');
  const incomingBuf = Buffer.from(incoming ?? '');
  const secretBuf = Buffer.from(webhookSecret);
  if (!incoming || incomingBuf.length !== secretBuf.length || !timingSafeEqual(incomingBuf, secretBuf)) {
    console.warn('[mollie-webhook] rejected: invalid or missing secret');
    return new Response('Forbidden', { status: 403 });
  }

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

  // Subscription status webhook — id starts with sub_
  if (paymentId.startsWith('sub_')) {
    try {
      type SubRecord = { id: string; status: string; customerId?: string; amount: { value: string }; metadata?: unknown };
      let foundSub: SubRecord | undefined;
      let foundCustomerId: string | undefined;
      let customerCursor: string | undefined;
      outer: do {
        const customers = await mollie.customers.page({ from: customerCursor, limit: 250 });
        for (const customer of customers as Iterable<{ id: string }>) {
          const subs = await mollie.customerSubscriptions.page({ customerId: customer.id, limit: 250 });
          const match = Array.from(subs as Iterable<SubRecord>).find(s => s.id === paymentId);
          if (match) { foundSub = match; foundCustomerId = customer.id; break outer; }
        }
        customerCursor = (customers as unknown as { nextPageCursor?: string }).nextPageCursor ?? undefined;
      } while (customerCursor);

      if (foundSub?.status === 'suspended' && foundCustomerId) {
        const customer = await mollie.customers.get(foundCustomerId);
        const meta = foundSub.metadata as Record<string, string> | null;
        const donorEmail = meta?.donorEmail || customer.email;
        if (donorEmail) {
          await sendSubscriptionSuspended({
            to: donorEmail,
            name: customer.name || '',
            amount: foundSub.amount.value,
          });
          console.log('[webhook] subscription suspended email sent');
        }
      }
    } catch (err) {
      console.error('[webhook] subscription webhook error:', err);
    }
    return new Response('OK', { status: 200 });
  }

  try {
    const payment = await mollie.payments.get(paymentId);
    const seq = payment.sequenceType;
    const status = payment.status;
    console.log(`[webhook] id=${paymentId} status=${status} seq=${seq}`);

    // Parse metadata early — needed by both the failure path and the success path
    let meta: Record<string, string> | null = null;
    if (payment.metadata && typeof payment.metadata === 'string') {
      try { meta = JSON.parse(payment.metadata); } catch { meta = null; }
    } else if (payment.metadata && typeof payment.metadata === 'object') {
      meta = payment.metadata as Record<string, string>;
    }

    if (status !== 'paid') {
      console.log(`[webhook] skipping: not paid (status=${status})`);
      if ((status === 'failed' || status === 'expired') && seq === 'recurring') {
        let donorEmail = meta?.donorEmail;
        let donorName = meta?.donorName || '';
        if (!donorEmail && payment.customerId) {
          try {
            const customer = await mollie.customers.get(payment.customerId);
            donorEmail = customer.email ?? undefined;
            donorName = donorName || customer.name || '';
          } catch { /* best-effort */ }
        }
        if (donorEmail) {
          try {
            await sendFailedPaymentNotice({
              to: donorEmail,
              name: donorName,
              amount: meta?.amount || payment.amount.value,
            });
            console.log('[webhook] failed payment notice sent');
          } catch (emailErr) {
            console.error('[webhook] failed payment notice error:', emailErr);
          }
        }
      }
      return new Response('OK', { status: 200 });
    }

    console.log(`[webhook] meta keys=${meta ? Object.keys(meta).join(',') : 'null'}`);
    console.log(`[webhook] RESEND_KEY=${!!import.meta.env.RESEND_API_KEY}`);

    // For old GiveWP subscriptions metadata is missing — fall back to the
    // Mollie customer object to get the donor's email address.
    let donorEmail = meta?.donorEmail;
    let donorName = meta?.donorName || '';
    if (!donorEmail && payment.customerId) {
      try {
        const customer = await mollie.customers.get(payment.customerId);
        donorEmail = customer.email ?? undefined;
        donorName = donorName || customer.name || '';
        console.log('[webhook] resolved customer from Mollie');
      } catch (customerErr) {
        console.warn('[webhook] could not fetch customer:', customerErr);
      }
    }

    // Fire GA4 Measurement Protocol purchase event (server-side backup —
    // catches conversions where the donor closed the tab before reaching /thank-you).
    const ga4MeasurementId = import.meta.env.GA4_MEASUREMENT_ID;
    const ga4ApiSecret = import.meta.env.GA4_MEASUREMENT_PROTOCOL_SECRET;
    if (ga4MeasurementId && ga4ApiSecret) {
      const amountValue = parseFloat(meta?.amount || payment.amount.value);
      fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${ga4MeasurementId}&api_secret=${ga4ApiSecret}`,
        {
          method: 'POST',
          body: JSON.stringify({
            client_id: 'mollie-webhook',
            events: [{
              name: 'purchase',
              params: {
                currency: 'GBP',
                value: amountValue,
                transaction_id: paymentId,
                items: [{
                  item_id: meta?.type === 'recurring' ? 'monthly-donation' : 'one-time-donation',
                  item_name: meta?.type === 'recurring' ? 'Level Up Monthly Donation' : 'Level Up Donation',
                  price: amountValue,
                  quantity: 1,
                }],
              },
            }],
          }),
        }
      ).catch((err) => console.warn('[webhook] GA4 MP event failed:', err));
    }

    const shouldEmail = (seq === 'oneoff' || seq === 'first') && !!donorEmail;
    console.log(`[webhook] shouldEmail=${shouldEmail} seq=${seq}`);

    if (shouldEmail && donorEmail) {
      try {
        await sendDonationConfirmation({
          to: donorEmail,
          name: donorName,
          amount: meta?.amount || payment.amount.value,
          recurring: seq === 'first' || meta?.type === 'recurring',
          giftAid: meta?.giftAid === 'true',
        });
        console.log('[webhook] confirmation email sent');
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
