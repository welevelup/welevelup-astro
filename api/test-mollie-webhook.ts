import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const secret = process.env.MOLLIE_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'MOLLIE_WEBHOOK_SECRET not configured' });
  }

  // Get test payload from query or body
  const { paymentId = 'tr_test_123', type = 'payment.paid' } = req.body || req.query;

  // Create test webhook payload (Snapshot style - full event)
  const payload = {
    resource: 'event',
    id: `event_test_${Date.now()}`,
    type: type,
    createdAt: new Date().toISOString(),
    _embedded: {
      entity: {
        resource: 'payment',
        id: paymentId,
        status: type === 'payment.paid' ? 'paid' : 'pending',
        amount: {
          value: '1.00',
          currency: 'GBP',
        },
        description: 'Test Payment',
      },
    },
  };

  const bodyString = JSON.stringify(payload);

  // Generate valid signature in hex format (matching Mollie's format: sha256=<hex>)
  const signatureHex = crypto
    .createHmac('sha256', secret)
    .update(bodyString)
    .digest('hex');
  const signature = `sha256=${signatureHex}`;

  console.log('[test-webhook] Generated signature:', signature.slice(0, 30) + '...');
  console.log('[test-webhook] Payload:', bodyString.slice(0, 100) + '...');

  // Send the webhook to our handler
  try {
    const webhookRes = await fetch('https://welevelup.org/api/mollie-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mollie-Signature': signature,
      },
      body: bodyString,
    });

    const webhookData = await webhookRes.text();

    return res.status(200).json({
      success: true,
      signature,
      payload,
      webhookStatus: webhookRes.status,
      webhookResponse: webhookData,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to send webhook',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
