import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient } from '@mollie/api-client';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const mollieApiKey = process.env.MOLLIE_API_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const ga4MeasurementId = process.env.GA4_MEASUREMENT_ID;
  const ga4ApiSecret = process.env.GA4_API_SECRET;

  if (!mollieApiKey) {
    return res.status(500).json({
      status: 'error',
      message: 'MOLLIE_API_KEY not set',
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

    const mollie = createMollieClient({ apiKey: mollieApiKey });

    // Fetch payment from Mollie
    const payment = await mollie.payments.get(paymentId);

    console.log('[test-webhook] Payment:', paymentId, 'Status:', payment.status);

    const result: any = {
      status: 'success',
      message: '✅ Webhook test completed',
      paymentId,
      paymentStatus: payment.status,
      amount: payment.amount.value,
      currency: payment.amount.currency,
    };

    // Test GA4 if configured
    if (ga4MeasurementId && ga4ApiSecret && payment.status === 'paid') {
      try {
        const ga4Payload = {
          api_secret: ga4ApiSecret,
          measurement_id: ga4MeasurementId,
          client_id: 'test_webhook_' + Date.now(),
          events: [{
            name: 'purchase',
            params: {
              currency: payment.amount.currency,
              value: parseFloat(payment.amount.value),
              transaction_id: paymentId,
              items: [{
                item_id: 'test-webhook-donation',
                item_name: 'Test Webhook Donation',
                price: parseFloat(payment.amount.value),
                quantity: 1,
              }],
            },
          }],
        };

        const ga4Res = await fetch('https://www.google-analytics.com/mp/collect', {
          method: 'POST',
          body: JSON.stringify(ga4Payload),
          headers: { 'Content-Type': 'application/json' },
        });

        result.ga4 = {
          status: ga4Res.ok ? 'success' : 'failed',
          httpStatus: ga4Res.status,
          message: ga4Res.ok ? 'Event sent to GA4' : 'Failed to send GA4 event',
        };
      } catch (ga4Err) {
        result.ga4 = {
          status: 'error',
          error: ga4Err instanceof Error ? ga4Err.message : String(ga4Err),
        };
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      status: 'error',
      message: 'Webhook test failed',
      error: message,
    });
  }
}
