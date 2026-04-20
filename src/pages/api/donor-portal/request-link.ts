import type { APIRoute } from 'astro';
import { createMollieClient } from '@mollie/api-client';
import { createToken } from '../../../lib/token';
import { sendMagicLink } from '../../../lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const apiKey = import.meta.env.MOLLIE_API_KEY;
  const secret = import.meta.env.PORTAL_SECRET;
  const siteUrl = import.meta.env.PUBLIC_SITE_URL;

  if (!apiKey || !secret || !siteUrl) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  let email: string | undefined;
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Valid email required' }, 400);
  }

  // Always return 200 to avoid email enumeration
  const ok = json({ ok: true });

  try {
    const mollie = createMollieClient({ apiKey });
    let cursor: string | undefined;
    let customerId: string | undefined;

    do {
      const page = await mollie.customers.page({ from: cursor, limit: 250 });
      const match = Array.from(page as Iterable<{ id: string; email: string; metadata?: Record<string, string> | null }>).find(
        (c) => c.email?.toLowerCase() === email && (c.metadata as Record<string, string> | null)?.source === 'astro'
      );
      if (match) {
        customerId = match.id;
        break;
      }
      cursor = (page as unknown as { nextPageCursor?: string }).nextPageCursor ?? undefined;
    } while (cursor);

    if (!customerId) {
      return ok;
    }

    const token = createToken({ email, mollieCustomerId: customerId }, secret);
    const url = `${siteUrl.replace(/\/$/, '')}/donor-portal/manage?token=${token}`;
    await sendMagicLink({ to: email, url });
  } catch (err) {
    console.error('[request-link] error', err);
  }

  return ok;
};
