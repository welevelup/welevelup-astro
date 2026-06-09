import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient } from '@mollie/api-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const paymentId = req.query.paymentId as string;
  if (!paymentId) {
    return res.status(400).json({ error: 'Missing paymentId' });
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Mollie API key not configured' });
  }

  try {
    const mollie = createMollieClient({ apiKey });
    const payment = await mollie.payments.get(paymentId);

    if (payment.status === 'paid') {
      return res.status(200).json({ valid: true, status: 'paid', amount: payment.amount.value });
    }

    if (payment.status === 'open' || payment.status === 'pending') {
      return res.status(202).json({ valid: false, status: payment.status, message: 'Payment not yet completed' });
    }

    if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'expired') {
      return res.status(400).json({ valid: false, status: payment.status, message: 'Payment was not completed' });
    }

    return res.status(400).json({ valid: false, status: payment.status, message: 'Unknown payment status' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Payment validation failed', details: message });
  }
}
