import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient } from '@mollie/api-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      status: 'error',
      message: 'MOLLIE_API_KEY not set in environment',
    });
  }

  try {
    const mollie = createMollieClient({ apiKey });

    // Create a test payment (works with restricted API keys)
    const testPayment = await mollie.payments.create({
      amount: { currency: 'GBP', value: '0.01' },
      description: 'TEST: Mollie credential verification',
      redirectUrl: 'https://welevelup.org',
      webhookUrl: process.env.MOLLIE_WEBHOOK_URL || 'https://welevelup.org',
      metadata: {
        test: 'true',
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      status: 'success',
      message: '✅ Mollie credentials working',
      details: {
        testPaymentId: testPayment.id,
        testPaymentStatus: testPayment.status,
        testPaymentUrl: testPayment.getCheckoutUrl(),
        amount: testPayment.amount.value,
        currency: testPayment.amount.currency,
        apiKeyFormat: apiKey.substring(0, 20) + '...',
        webhookUrl: process.env.MOLLIE_WEBHOOK_URL || 'not configured',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      status: 'error',
      message: 'Mollie credential test failed',
      error: message,
    });
  }
}
