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

    // Test 1: Get profiles (works with restricted keys)
    const profiles = await mollie.profiles.page();
    const profileList = Array.from(profiles);
    if (!profileList.length) {
      return res.status(500).json({
        status: 'error',
        message: 'No profiles found in Mollie account',
      });
    }

    const profile = profileList[0];

    // Test 2: Try to create a test payment
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
        profileId: profile.id,
        profileName: profile.name,
        testPaymentId: testPayment.id,
        testPaymentStatus: testPayment.status,
        apiKeyFormat: apiKey.substring(0, 20) + '...',
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
