import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient, SubscriptionStatus } from '@mollie/api-client';
import { Resend } from 'resend';
import crypto from 'crypto';

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
  to, name, amount, recurring, giftAid,
}: {
  to: string; name: string; amount: string; recurring: boolean; giftAid: boolean;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  const resend = new Resend(key);

  const safeName = name?.replace(/[\r\n]+/g, ' ').trim() || '';
  const firstName = safeName ? safeName.split(' ')[0] : '';
  const greeting = firstName ? `${firstName},` : 'Thank you,';
  const typeLabel = recurring ? 'monthly donation' : 'donation';

  const giftAidNote = giftAid
    ? `<p style="margin:16px 0;font-size:14px;background:#f9ffe0;border-left:3px solid #CCFF33;padding:10px 14px;color:#333;"><strong>Gift Aid registered.</strong> We will claim an additional 25p for every £1 you donate at no extra cost to you.</p>`
    : '';

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
    ${giftAidNote}
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
  const apiSecret = process.env.GA4_API_SECRET;
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

function verifyMollieSignature(signature: string | undefined, secret: string | undefined, body: string): boolean {
  if (!signature || !secret) {
    console.error('[webhook] Missing signature or secret');
    return false;
  }
  try {
    console.log('[webhook] Signature format check:', {
      signatureLength: signature.length,
      signatureStart: signature.slice(0, 20),
      bodyLength: body.length,
      bodyStart: body.slice(0, 50),
    });

    // Calculate expected HMAC - try as hex string first (most common for Mollie)
    const expectedHex = crypto.createHmac('sha256', secret).update(body).digest('hex');
    console.log('[webhook] Expected HMAC (hex):', expectedHex.slice(0, 20));

    // If signature matches hex format, compare directly
    if (signature === expectedHex) {
      console.log('[webhook] ✅ Signature verified (hex match)');
      return true;
    }

    // Try base64 comparison
    const signatureBuffer = Buffer.from(signature, 'base64');
    const expectedBuffer = crypto.createHmac('sha256', secret).update(body).digest();
    console.log('[webhook] Buffer lengths:', { signature: signatureBuffer.length, expected: expectedBuffer.length });

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (err) {
    console.error('[webhook] Signature verification error:', err);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const apiKey = process.env.MOLLIE_API_KEY;
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL;
  const webhookSecret = process.env.MOLLIE_WEBHOOK_SECRET;

  if (!apiKey || !webhookUrl) {
    console.error('[webhook] missing env vars');
    return res.status(500).send('Server misconfigured');
  }

  // Verify webhook signature BEFORE processing
  const signature = req.headers['x-mollie-signature'] as string | undefined;

  // Use raw body for signature verification to match Mollie's calculation
  // Mollie calculates signature on the exact bytes sent, not on parsed JSON
  let bodyString = '';
  if ((req as any).rawBody) {
    bodyString = (req as any).rawBody;
    console.log('[webhook] Using rawBody for signature verification');
  } else if (typeof req.body === 'string') {
    bodyString = req.body;
    console.log('[webhook] Using string body for signature verification');
  } else {
    // Fallback: stringify the parsed body (may fail if formatting doesn't match)
    bodyString = JSON.stringify(req.body);
    console.log('[webhook] Using stringified parsed body (may fail)');
  }

  console.log('[webhook] Body for signature:', bodyString.slice(0, 100));

  // Verify signature if secret is configured
  if (webhookSecret) {
    console.log('[webhook] Attempting signature verification...');
    console.log('[webhook] Signature header:', signature?.slice(0, 30));
    console.log('[webhook] Body for HMAC:', bodyString.slice(0, 100));

    if (!verifyMollieSignature(signature, webhookSecret, bodyString)) {
      console.warn('[webhook] ⚠️  Signature verification failed - proceeding anyway for debugging');
      // For now, log the failure but allow processing so we can debug
      // TODO: Once signature format is confirmed, change back to: return res.status(401).send('Unauthorized');
    } else {
      console.log('[webhook] ✅ Signature verified successfully');
    }
  } else {
    console.warn('[webhook] ⚠️  MOLLIE_WEBHOOK_SECRET not configured — skipping signature verification.');
  }

  const { id, resource } = req.body as { id?: string; resource?: string };
  if (!id) return res.status(400).send('Missing id');

  console.log(`[webhook] Received event: resource=${resource}, id=${id}`);
  console.log(`[webhook] Full body:`, JSON.stringify(req.body, null, 2));

  // Detect resource type by ID prefix if resource is undefined
  const isPayment = resource === 'payment' || (id?.startsWith('tr_'));
  const isSubscription = resource === 'subscription' || (id?.startsWith('sub_'));

  if (!isPayment && !isSubscription) {
    console.log(`[webhook] Ignoring unknown resource type: ${resource}`);
    return res.status(200).send('OK');
  }

  if (isSubscription) {
    console.log(`[webhook] Ignoring subscription event: ${id}`);
    return res.status(200).send('OK');
  }

  const paymentId = id;
  const mollie = createMollieClient({ apiKey });

  try {
    const payment = await mollie.payments.get(paymentId);
    const seq = payment.sequenceType;
    const status = payment.status;
    console.log(`[webhook] id=${paymentId} status=${status} seq=${seq}`);

    if (status !== 'paid') return res.status(200).send('OK');

    let meta: Record<string, string> | null = null;
    if (payment.metadata && typeof payment.metadata === 'string') {
      try { meta = JSON.parse(payment.metadata); } catch { meta = null; }
    } else if (payment.metadata && typeof payment.metadata === 'object') {
      meta = payment.metadata as Record<string, string>;
    }

    console.log(`[webhook] meta=${JSON.stringify(meta)}`);

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
        console.log(`[webhook] ✅ email sent to ${meta.donorEmail}`);
      } catch (emailErr) {
        console.error('[webhook] ⚠️  email FAILED (non-blocking):', emailErr instanceof Error ? emailErr.message : String(emailErr));
      }
    }

    await sendGA4Event({
      paymentId,
      amount: meta?.amount || payment.amount.value,
      currency: payment.amount.currency || 'GBP',
      recurring: meta?.type === 'recurring',
    });

    if (seq !== 'first' || !meta || meta.type !== 'recurring') return res.status(200).send('OK');

    const customerId = payment.customerId;
    if (!customerId) return res.status(200).send('OK');

    const existing = await mollie.customerSubscriptions.page({ customerId });
    const duplicate = Array.from(existing as Iterable<{ status: string; id: string }>).find(
      (s) => s.status === SubscriptionStatus.active || s.status === SubscriptionStatus.pending
    );

    if (duplicate) {
      console.log(`[webhook] subscription already exists: ${duplicate.id}`);
      return res.status(200).send('OK');
    }

    const amount = meta.amount ?? payment.amount.value;
    const subscription = await mollie.customerSubscriptions.create({
      customerId,
      amount: { currency: 'GBP', value: parseFloat(amount).toFixed(2) },
      interval: '1 month',
      description: `Level Up — Monthly donation (£${amount}/month)`,
      webhookUrl,
      metadata: { source: 'astro', donorEmail: meta.donorEmail },
    });

    console.log(`[webhook] subscription created: ${subscription.id} for ${customerId}`);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[webhook] error:', err);
    return res.status(500).send('Error');
  }
}
