import type { APIRoute } from 'astro';
import { sendDonationConfirmation } from '../../lib/email';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const to = url.searchParams.get('to');
  if (!to) {
    return new Response(JSON.stringify({ error: 'Pass ?to=your@email.com' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resendKey = import.meta.env.RESEND_API_KEY;
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set in env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await sendDonationConfirmation({
      to,
      name: 'Test User',
      amount: '10.00',
      recurring: true,
      giftAid: false,
    });
    return new Response(JSON.stringify({ ok: true, sentTo: to }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), detail: err instanceof Error ? err.message : err }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
