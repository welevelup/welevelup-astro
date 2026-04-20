import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient } from '@mollie/api-client';
import { createHmac, timingSafeEqual } from 'crypto';

function verifyToken<T = Record<string, unknown>>(token: string, secret: string): (T & { exp: number }) | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  try {
    const expected = createHmac('sha256', secret).update(data).digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as T & { exp: number };
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.MOLLIE_API_KEY;
  const secret = process.env.PORTAL_SECRET;

  if (!apiKey || !secret) {
    console.error('[cancel] missing env vars');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const body = req.body as { token?: string; subscriptionId?: string };
  const token = typeof body?.token === 'string' ? body.token : undefined;
  const subscriptionId = typeof body?.subscriptionId === 'string' ? body.subscriptionId : undefined;

  if (!token || !subscriptionId) {
    return res.status(400).json({ error: 'Missing token or subscriptionId' });
  }

  const payload = verifyToken<{ email: string; mollieCustomerId: string }>(token, secret);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired link' });

  try {
    const mollie = createMollieClient({ apiKey });
    await mollie.customerSubscriptions.cancel(subscriptionId, { customerId: payload.mollieCustomerId });
    console.log(`[cancel] cancelled subscription ${subscriptionId} for ${payload.email}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[cancel] Mollie error', err);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}
