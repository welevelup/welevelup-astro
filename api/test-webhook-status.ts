import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const secret = process.env.MOLLIE_WEBHOOK_SECRET;

  return res.status(200).json({
    webhook_secret_configured: !!secret,
    secret_length: secret ? secret.length : 0,
    secret_prefix: secret ? secret.slice(0, 10) + '***' : 'NOT_SET',
    status: secret ? '✅ READY' : '❌ MISSING',
    message: secret
      ? 'Webhook signature verification is ready'
      : 'MOLLIE_WEBHOOK_SECRET not configured in Vercel env vars'
  });
}
