import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient, SequenceType } from '@mollie/api-client';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// Maps an opaque, short-lived reference (safe to put in a URL) to the Mollie
// payment id. The thank-you page reads `?ref=` and resolves it server-side to
// look up the real payment status. This replaces the old paymentId cookie,
// which was lost on Mollie's cross-site redirect (especially in in-app
// browsers) and stranded donors back on /donate.
const REF_TTL_SECONDS = 3600;

async function storePaymentRef(ref: string, paymentId: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('[create-donation] Redis not configured — skipping ref store');
    return;
  }
  const redis = new Redis({ url, token });
  await redis.set(`donation:${ref}`, paymentId, { ex: REF_TTL_SECONDS });
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Reuse ONE Mollie customer per email instead of creating a new one on every
// recurring donation. Without this, a donor ends up with many customer records
// for the same email, scattering their subscriptions so the donor portal can't
// find them. Cached in Redis (email → customerId); falls back to creating a new
// customer if Redis is unavailable, so checkout never breaks.
async function getOrCreateCustomerId(
  mollie: ReturnType<typeof createMollieClient>,
  name: string,
  email: string,
): Promise<string> {
  const redis = getRedis();
  const key = `mollie:customer:${email.toLowerCase()}`;
  if (redis) {
    try {
      const existing = await redis.get<string>(key);
      if (existing) return existing;
    } catch { /* fall through to create */ }
  }
  const customer = await mollie.customers.create({ name, email, metadata: { source: 'astro' } });
  if (redis) { try { await redis.set(key, customer.id); } catch { /* noop */ } }
  return customer.id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  const siteUrl = process.env.PUBLIC_SITE_URL;
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL;

  if (!apiKey || !siteUrl || !webhookUrl) {
    console.error('[create-donation] missing env vars', {
      apiKey: !!apiKey,
      siteUrl: !!siteUrl,
      webhookUrl: !!webhookUrl,
    });
    return res.status(500).json({ error: 'Mollie env vars not configured' });
  }

  const body = req.body as {
    amount?: string;
    recurring?: boolean;
    donorName?: string;
    donorEmail?: string;
  };

  const { amount, recurring, donorName = '', donorEmail = '' } = body ?? {};

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
  // Strip any stray whitespace (incl. real newlines) and a trailing slash.
  const baseUrl = siteUrl.replace(/\s+/g, '').replace(/\/$/, '');
  const donationType = recurring ? 'monthly' : 'one-time';
  const ref = crypto.randomBytes(16).toString('hex');
  const redirectUrl = `${baseUrl}/donate/thank-you?ref=${ref}&amount=${formattedAmount}&type=${donationType}`;

  try {
    let payment;
    if (recurring) {
      const customerId = await getOrCreateCustomerId(mollie, donorName, donorEmail);
      payment = await mollie.payments.create({
        amount: { currency: 'GBP', value: formattedAmount },
        description: `Level Up — Monthly donation (£${formattedAmount}/month)`,
        redirectUrl,
        webhookUrl,
        customerId,
        sequenceType: SequenceType.first,
        metadata: {
          type: 'recurring',
          amount: formattedAmount,
          donorEmail,
          donorName,
          source: 'astro',
        },
      });
    } else {
      payment = await mollie.payments.create({
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
    }

    // Persist ref -> paymentId so the thank-you page can verify real status.
    // Never block the checkout on this: if Redis is down the donor still pays,
    // the webhook still emails them, and the thank-you page degrades to a
    // neutral confirmation instead of stranding them.
    try {
      await storePaymentRef(ref, payment.id);
    } catch (refErr) {
      console.error('[create-donation] failed to store payment ref:', refErr);
    }

    return res.status(200).json({ checkoutUrl: payment.getCheckoutUrl() });
  } catch (err) {
    console.error('[create-donation] Mollie error', err);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
}
