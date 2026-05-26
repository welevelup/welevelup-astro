import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

const rateLimit = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) return json({ error: 'Server misconfigured' }, 500);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (isRateLimited(ip)) return json({ error: 'Too many requests' }, 429);

  let name: string, email: string, subject: string, message: string;
  try {
    const body = await request.json();
    name = (body.name ?? '').trim();
    email = (body.email ?? '').trim();
    subject = (body.subject ?? '').trim();
    message = (body.message ?? '').trim();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  if (!name || !email || !message) return json({ error: 'Name, email and message are required' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Valid email required' }, 400);

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from: 'Level Up Website <hello@welevelup.org>',
      to: 'hello@welevelup.org',
      replyTo: email,
      subject: subject ? `[Contact] ${subject}` : `[Contact] Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });
    return json({ ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err);
    return json({ error: 'Failed to send message' }, 500);
  }
};
