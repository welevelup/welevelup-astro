import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL || '';
  const webhookSecret = process.env.MOLLIE_WEBHOOK_SECRET || '';

  // Mollie webhook test signature
  const testWebhookId = 'tr_test_12345';
  const testPayload = testWebhookId;
  const signature = webhookSecret ? crypto.createHmac('sha256', webhookSecret).update(testPayload).digest('base64') : 'NOT_CONFIGURED';

  return res.status(200).json({
    webhook_url: webhookUrl || '❌ NOT CONFIGURED',
    webhook_secret: webhookSecret ? '✅ Configured (length: ' + webhookSecret.length + ')' : '❌ NOT CONFIGURED',
    webhook_secret_prefix: webhookSecret ? webhookSecret.slice(0, 10) + '***' : 'NONE',
    test_signature: signature,
    instructions: {
      webhook_url: 'Should be: https://welevelup.org/api/mollie-webhook',
      webhook_secret: 'Get from Mollie Dashboard > Webhooks > [your webhook] > Secret key',
      how_to_test: 'Send POST to webhook URL with X-Mollie-Signature header'
    },
    ready: !!webhookUrl && !!webhookSecret
  });
}
