import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const mollieKey = process.env.MOLLIE_API_KEY || '';
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL || '';
  const webhookSecret = process.env.MOLLIE_WEBHOOK_SECRET || '';

  return res.status(200).json({
    mollie: {
      apiKey: mollieKey ? `${mollieKey.slice(0, 10)}...` : 'NOT SET',
      isLive: mollieKey.startsWith('live_'),
      isTest: mollieKey.startsWith('test_'),
      keyType: mollieKey.startsWith('live_') ? '🔴 LIVE' : mollieKey.startsWith('test_') ? '🟡 TEST' : '❌ UNKNOWN',
    },
    webhook: {
      url: webhookUrl,
      secret: webhookSecret ? `${webhookSecret.slice(0, 10)}... (${webhookSecret.length} chars)` : 'NOT SET',
      configured: !!webhookUrl && !!webhookSecret,
    },
    env: {
      PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL || 'NOT SET',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? '✅ SET' : '❌ NOT SET',
      GA4_MEASUREMENT_ID: process.env.GA4_MEASUREMENT_ID ? '✅ SET' : '❌ NOT SET',
    },
  });
}
