import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.MOLLIE_WEBHOOK_SECRET;

  if (!secret) {
    return res.status(500).json({ error: 'MOLLIE_WEBHOOK_SECRET not configured' });
  }

  // Test payload
  const testPaymentId = 'tr_test_' + Date.now();
  const testPayload = JSON.stringify({ id: testPaymentId });

  // Generate signature using hex format (like Mollie does)
  const signatureHex = crypto
    .createHmac('sha256', secret)
    .update(testPayload)
    .digest('hex');
  const signature = `sha256=${signatureHex}`;

  console.log('[test-signature]', { testPaymentId, secret: secret.slice(0, 10) + '...', payload: testPayload, signature: signature.slice(0, 30) + '...' });

  // Send test webhook to our handler
  try {
    const webhookRes = await fetch('https://welevelup.org/api/mollie-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mollie-Signature': signature,
      },
      body: testPayload,
    });

    const webhookText = await webhookRes.text();

    return res.status(200).json({
      success: true,
      test: {
        paymentId: testPaymentId,
        payload: testPayload,
        signature: signature.slice(0, 50) + '...',
        secret: secret.slice(0, 10) + '... (' + secret.length + ' chars)',
      },
      webhook: {
        status: webhookRes.status,
        response: webhookText,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to send webhook',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
