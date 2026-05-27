import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: 'Server misconfigured' });

  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]
      : Array.isArray(req.headers['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : null) ?? 'unknown';

  if (isRateLimited(ip.trim())) return res.status(429).json({ error: 'Too many requests' });

  const body = req.body as Record<string, unknown>;
  const name = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim();
  const subject = String(body?.subject ?? '').trim();
  const message = String(body?.message ?? '').trim();
  const turnstileToken = String(body?.['cf-turnstile-response'] ?? '').trim();

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    if (!turnstileToken) return res.status(400).json({ error: 'Please complete the captcha' });
    const fd = new FormData();
    fd.append('secret', turnstileSecret);
    fd.append('response', turnstileToken);
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: fd,
    });
    const verifyData = (await verifyRes.json()) as { success: boolean };
    if (!verifyData.success)
      return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
  }

  if (!name || !email || !message)
    return res.status(400).json({ error: 'Name, email and message are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Valid email required' });

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: 'Level Up <hello@welevelup.org>',
      to: 'hello@welevelup.org',
      replyTo: email,
      subject: subject ? `[Contact] ${subject}` : `[Contact] Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}
