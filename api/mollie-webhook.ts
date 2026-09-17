import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient, SubscriptionStatus } from '@mollie/api-client';
import { Resend } from 'resend';
import { Redis } from '@upstash/redis';
import { waitUntil } from '@vercel/functions';

// Give the background work (Mollie API calls + email + GA4) room to finish
// after we've already ACKed Mollie with a 200.
export const config = { maxDuration: 30 };

const FROM = 'Level Up <no-reply@welevelup.org>';
const LOGO_URL = 'https://levelup.yourmovement.org/rails/active_storage/blobs/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBc01XIiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--899d9333f326b8d370f2acf06f7fe589aef9efd5/image.png';
const SITE_URL = 'https://welevelup.org';

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Level Up</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap');
body, p, a, li, td, h1, h2, h3, h4, h5, h6 {
  font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
}
body { margin: 0; padding: 0; background: #f4f4f4; }
table { border-collapse: collapse; }
img { border: 0; height: auto; outline: none; text-decoration: none; }
p { margin: 0; padding: 0; }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">
        <tr><td style="padding:24px 40px;text-align:center;">
          <center>
            <a href="${SITE_URL}" target="_blank" rel="noopener">
              <img src="${LOGO_URL}" alt="Level Up Logo" width="120" style="display:inline-block;max-width:120px;margin:20px 0;" />
            </a>
          </center>
        </td></tr>
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid #e0e0e0;"></div></td></tr>
        <tr><td style="padding:32px 40px 24px;font-size:16px;line-height:1.6;color:#000000;">${content}</td></tr>
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid #e0e0e0;"></div></td></tr>
        <tr><td style="padding:24px 40px 32px;text-align:center;">
          <center>
            <a href="${SITE_URL}" target="_blank" rel="noopener">
              <img src="${LOGO_URL}" alt="Level Up Logo" width="80" style="display:inline-block;max-width:80px;margin:20px 0;" />
            </a>
          </center>
          <p style="font-size:12px;color:#666;margin:0 0 8px;">You are receiving this email because you subscribed to Level Up's mailing list.</p>
          <p style="font-size:12px;color:#666;margin:0 0 8px;"><strong>Our mailing address is:</strong><br>New Derwent House<br>69–73 Theobalds Road<br>London WC1X 8TA</p>
          <p style="font-size:12px;color:#666;margin:0;"><strong>Contact us at:</strong> <a href="mailto:hello@welevelup.org" style="color:#5b4fcf;text-decoration:none;">hello@welevelup.org</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background:#7b68ee;border-radius:6px;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;">${label}</a>
    </td></tr>
  </table>`;
}

async function sendDonationConfirmation({
  to, name, amount, recurring,
}: {
  to: string; name: string; amount: string; recurring: boolean;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  const resend = new Resend(key);

  const safeName = name?.replace(/[\r\n]+/g, ' ').trim() || '';
  const firstName = safeName ? safeName.split(' ')[0] : '';
  const greeting = firstName ? `${firstName},` : 'Thank you,';
  const typeLabel = recurring ? 'monthly donation' : 'donation';

  const portalNote = recurring
    ? `<p style="margin:24px 0 0;font-size:14px;color:#555;">To manage or cancel your monthly donation, visit your <a href="${SITE_URL}/donor-portal" style="color:#5b4fcf;">donor portal</a> or email <a href="mailto:hello@welevelup.org" style="color:#5b4fcf;">hello@welevelup.org</a>.</p>`
    : '';

  const html = baseTemplate(`
    <p style="margin:0 0 20px;">${greeting} with your support we're fighting for gender justice in the UK — and your ${typeLabel} of <strong>£${amount}${recurring ? ' every month' : ''}</strong> makes that possible.</p>
    <p style="margin:0 0 20px;"><strong>Here's what your donation powers:</strong></p>
    <ul style="margin:0 0 20px;padding-left:20px;color:#1a1a1a;">
      <li style="margin-bottom:8px;">Campaigns for abortion decriminalisation in England and Wales</li>
      <li style="margin-bottom:8px;">Ending the imprisonment of pregnant women</li>
      <li style="margin-bottom:8px;">Dignified media coverage of domestic abuse deaths</li>
      <li style="margin-bottom:8px;">Community bystander training — We Protect Us</li>
    </ul>
    ${ctaButton(SITE_URL, 'Visit our website')}
    <p style="margin:24px 0 8px;">In solidarity,</p>
    <p style="margin:0;">Level Up</p>
    ${portalNote}
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Thank you for your ${typeLabel} to Level Up`,
    html,
  });
}

async function sendGA4Event({
  paymentId, amount, currency, recurring,
}: {
  paymentId: string; amount: string; currency: string; recurring: boolean;
}) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  // The .env example documents GA4_MEASUREMENT_PROTOCOL_SECRET; accept either name.
  const apiSecret = process.env.GA4_API_SECRET || process.env.GA4_MEASUREMENT_PROTOCOL_SECRET;
  if (!measurementId || !apiSecret) {
    console.log('[webhook] GA4 env vars missing, skipping');
    return;
  }

  try {
    await fetch('https://www.google-analytics.com/mp/collect', {
      method: 'POST',
      body: JSON.stringify({
        api_secret: apiSecret,
        measurement_id: measurementId,
        events: [{
          name: 'purchase',
          params: {
            currency: currency,
            value: parseFloat(amount),
            transaction_id: paymentId,
            items: [{
              item_id: recurring ? 'monthly_donation' : 'one_time_donation',
              item_name: recurring ? 'Monthly Donation' : 'One-time Donation',
              price: parseFloat(amount),
              quantity: 1,
            }]
          }
        }]
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('[webhook] ✅ GA4 event sent');
  } catch (err) {
    console.error('[webhook] GA4 fetch failed:', err);
  }
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Idempotency guard. Returns true if this caller won the claim (first to act).
// If Redis is unavailable we return true (best-effort: never block a real email).
// 90-day TTL: a payment's webhook can re-fire long after the charge (e.g. on
// refund or chargeback), and we must never re-send the thank-you for it.
async function claimOnce(redis: Redis | null, key: string, ttlSeconds = 90 * 86400): Promise<boolean> {
  if (!redis) return true;
  const result = await redis.set(key, '1', { nx: true, ex: ttlSeconds });
  return result === 'OK';
}

// All the heavy work, run AFTER we've already returned 200 to Mollie.
async function processPayment(paymentId: string, apiKey: string, webhookUrl: string) {
  const mollie = createMollieClient({ apiKey });
  const redis = getRedis();

  // Authoritative status comes from the Mollie API, not the (untrusted) body.
  const payment = await mollie.payments.get(paymentId);
  const seq = payment.sequenceType;
  const status = payment.status;
  console.log(`[webhook] id=${paymentId} status=${status} seq=${seq}`);

  if (status !== 'paid') return;

  let meta: Record<string, string> | null = null;
  if (payment.metadata && typeof payment.metadata === 'string') {
    try { meta = JSON.parse(payment.metadata); } catch { meta = null; }
  } else if (payment.metadata && typeof payment.metadata === 'object') {
    meta = payment.metadata as Record<string, string>;
  }

  // A webhook can re-fire for an old payment when it gets refunded or charged
  // back — its status stays "paid", so never thank a refunded payment.
  const refunded = parseFloat((payment as { amountRefunded?: { value?: string } }).amountRefunded?.value ?? '0') > 0;

  const shouldEmail = !refunded && (seq === 'oneoff' || seq === 'first') && !!meta?.donorEmail;

  if (shouldEmail && meta) {
    // Claim before sending so concurrent/duplicate webhooks can't double-send.
    const emailKey = `webhook:emailed:${paymentId}`;
    const won = await claimOnce(redis, emailKey);
    if (!won) {
      console.log(`[webhook] email already sent for ${paymentId}, skipping`);
    } else {
      try {
        await sendDonationConfirmation({
          to: meta.donorEmail,
          name: meta.donorName || '',
          amount: meta.amount || payment.amount.value,
          recurring: meta.type === 'recurring',
        });
        console.log(`[webhook] ✅ email sent to ${meta.donorEmail}`);
      } catch (emailErr) {
        // Release the claim so a later legitimate redelivery can retry.
        if (redis) { try { await redis.del(emailKey); } catch { /* noop */ } }
        console.error('[webhook] ⚠️ email FAILED:', emailErr instanceof Error ? emailErr.message : String(emailErr));
      }
    }
  }

  // GA4: transaction_id dedupes downstream — fire once per processed webhook.
  await sendGA4Event({
    paymentId,
    amount: meta?.amount || payment.amount.value,
    currency: payment.amount.currency || 'GBP',
    recurring: meta?.type === 'recurring',
  });

  // Create the recurring subscription only on the first payment of a recurring flow.
  if (seq !== 'first' || !meta || meta.type !== 'recurring') return;

  const customerId = payment.customerId;
  if (!customerId) return;

  const existing = await mollie.customerSubscriptions.page({ customerId });
  const duplicate = Array.from(existing as Iterable<{ status: string; id: string }>).find(
    (s) => s.status === SubscriptionStatus.active || s.status === SubscriptionStatus.pending
  );
  if (duplicate) {
    console.log(`[webhook] subscription already exists: ${duplicate.id}`);
    return;
  }

  const amount = meta.amount ?? payment.amount.value;

  // CRITICAL: set startDate one interval in the FUTURE. The donor already paid
  // the first month via this initial payment; without startDate Mollie charges
  // the subscription's first cycle TODAY too, double-charging them on signup.
  // Anchor the first recurring charge one month out (clamp day to 28 so months
  // with fewer days never skip a cycle).
  const next = new Date(payment.paidAt ?? payment.createdAt ?? new Date().toISOString());
  next.setUTCMonth(next.getUTCMonth() + 1);
  if (next.getUTCDate() > 28) next.setUTCDate(28);
  const startDate = next.toISOString().slice(0, 10);

  const subscription = await mollie.customerSubscriptions.create({
    customerId,
    amount: { currency: 'GBP', value: parseFloat(amount).toFixed(2) },
    interval: '1 month',
    startDate,
    description: `Level Up — Monthly donation (£${amount}/month)`,
    webhookUrl,
    metadata: { source: 'astro', donorEmail: meta.donorEmail },
  });
  console.log(`[webhook] subscription created: ${subscription.id} for ${customerId}, first recurring charge ${startDate}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const apiKey = process.env.MOLLIE_API_KEY;
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL;
  if (!apiKey || !webhookUrl) {
    console.error('[webhook] missing env vars');
    return res.status(500).send('Server misconfigured');
  }

  const { id, resource } = req.body as { id?: string; resource?: string };
  if (!id) return res.status(400).send('Missing id');

  const isPayment = resource === 'payment' || id.startsWith('tr_');

  // ACK Mollie IMMEDIATELY. This is the core fix: responding 200 fast keeps
  // Mollie from entering its multi-hour retry backoff, which was the cause of
  // confirmations and emails arriving hours late.
  res.status(200).send('OK');

  // Subscription/renewal events and unknown resources need no work here.
  if (!isPayment) {
    console.log(`[webhook] no-op for resource=${resource} id=${id}`);
    return;
  }

  // Do the real work in the background; waitUntil keeps the function alive.
  waitUntil(
    processPayment(id, apiKey, webhookUrl).catch((err) => {
      console.error('[webhook] background processing failed:', err);
    })
  );
}
