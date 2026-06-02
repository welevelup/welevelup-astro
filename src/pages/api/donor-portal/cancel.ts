import type { APIRoute } from 'astro';
import { isRateLimited } from '../../../lib/ratelimit';
import { createMollieClient } from '@mollie/api-client';
import { verifyToken } from '../../../lib/token';

export const prerender = false;

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const apiKey = import.meta.env.MOLLIE_API_KEY;
  const secret = import.meta.env.PORTAL_SECRET;

  if (!apiKey || !secret) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (await isRateLimited(`cancel:${ip}`)) {
    return json({ error: 'Too many requests' }, 429);
  }

  let token: string | undefined;
  let subscriptionId: string | undefined;
  try {
    const body = await request.json();
    token = typeof body.token === 'string' ? body.token : undefined;
    subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId : undefined;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!token || !subscriptionId) {
    return json({ error: 'Missing token or subscriptionId' }, 400);
  }

  const payload = verifyToken<{ email: string; mollieCustomerId: string }>(token, secret);
  if (!payload) {
    return json({ error: 'Invalid or expired link' }, 401);
  }

  const { mollieCustomerId } = payload;

  try {
    const mollie = createMollieClient({ apiKey });
    // Fetch first — Mollie returns 404 if subscriptionId doesn't belong to this
    // customer, so this acts as an ownership check before we cancel anything.
    await mollie.customerSubscriptions.get(subscriptionId, { customerId: mollieCustomerId });
    await mollie.customerSubscriptions.cancel(subscriptionId, { customerId: mollieCustomerId });
    return json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 404 || status === 422) {
      return json({ error: 'Subscription not found' }, 404);
    }
    console.error('[cancel] Mollie error', err);
    return json({ error: 'Failed to cancel subscription' }, 500);
  }
};
