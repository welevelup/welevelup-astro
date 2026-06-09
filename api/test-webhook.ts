import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const mode = req.query.mode as string || 'simulate';

  if (mode === 'info') {
    // Show test instructions
    return res.status(200).json({
      status: 'info',
      message: 'Webhook Test Endpoint',
      instructions: {
        simulate: 'POST to /api/test-webhook with body: { "paymentId": "tr_XXXX" }',
        realWebhook: 'Use Mollie dashboard → Webhooks → Test to send real webhook',
      },
      testPayload: {
        paymentId: 'tr_WDqYK6vllg',
        description: 'Send your actual Mollie payment ID to test',
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL;
  const mollieApiKey = process.env.MOLLIE_API_KEY;

  if (!webhookUrl || !mollieApiKey) {
    return res.status(500).json({
      status: 'error',
      message: 'MOLLIE_WEBHOOK_URL or MOLLIE_API_KEY not set',
    });
  }

  try {
    const body = req.body as { paymentId?: string };
    const paymentId = body?.paymentId;

    if (!paymentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing paymentId in request body',
        example: { paymentId: 'tr_WDqYK6vllg' },
      });
    }

    // Fetch payment details from Mollie
    const paymentRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mollieApiKey}` },
    });

    if (!paymentRes.ok) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment not found in Mollie',
        paymentId,
        httpStatus: paymentRes.status,
      });
    }

    const payment = await paymentRes.json();

    // Simulate webhook call to /api/mollie-webhook
    console.log('[test-webhook] Simulating webhook for payment:', paymentId);
    console.log('[test-webhook] Payment status:', payment.status);
    console.log('[test-webhook] Payment amount:', payment.amount.value);

    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: paymentId }),
    });

    const webhookText = await webhookRes.text();

    return res.status(200).json({
      status: 'success',
      message: '✅ Webhook simulation completed',
      details: {
        paymentId,
        paymentStatus: payment.status,
        amount: payment.amount.value,
        currency: payment.amount.currency,
        webhook: {
          url: webhookUrl,
          httpStatus: webhookRes.status,
          response: webhookText,
        },
        checkGA4: 'Look in GA4 Realtime for the purchase event',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      status: 'error',
      message: 'Webhook test failed',
      error: message,
    });
  }
}
