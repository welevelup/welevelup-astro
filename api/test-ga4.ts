import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;

  if (!measurementId || !apiSecret) {
    return res.status(500).json({
      status: 'error',
      message: 'GA4_MEASUREMENT_ID or GA4_API_SECRET not set',
      details: {
        hasMeasurementId: !!measurementId,
        hasApiSecret: !!apiSecret,
      },
    });
  }

  try {
    // Send test purchase event to GA4 Measurement Protocol
    const testEvent = {
      api_secret: apiSecret,
      measurement_id: measurementId,
      client_id: 'test_client_' + Date.now(),
      events: [
        {
          name: 'purchase',
          params: {
            currency: 'GBP',
            value: 10.5,
            transaction_id: 'test_txn_' + Date.now(),
            items: [
              {
                item_id: 'test-donation',
                item_name: 'Test Donation',
                price: 10.5,
                quantity: 1,
              },
            ],
          },
        },
      ],
    };

    const response = await fetch('https://www.google-analytics.com/mp/collect', {
      method: 'POST',
      body: JSON.stringify(testEvent),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({
        status: 'error',
        message: 'GA4 API rejected the request',
        httpStatus: response.status,
        responseText: text,
      });
    }

    return res.status(200).json({
      status: 'success',
      message: '✅ GA4 event sent successfully',
      details: {
        measurementId,
        apiSecretFormat: apiSecret.substring(0, 10) + '...',
        clientId: testEvent.client_id,
        eventName: 'purchase',
        eventValue: 10.5,
        checkRealtime: 'https://analytics.google.com/analytics/web/#/p/YOUR_PROPERTY_ID/reports/realtime',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      status: 'error',
      message: 'GA4 test failed',
      error: message,
    });
  }
}
