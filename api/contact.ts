import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { Redis } from '@upstash/redis';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

// Rate limit via Upstash Redis. An in-memory Map does NOT work on Vercel:
// each invocation can hit a different (or cold) instance, so the counter never
// accumulates. Redis is shared across instances. Fails open if Redis is
// unconfigured (local dev) — never blocks a legitimate message.
async function isRateLimited(ip: string): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  try {
    const redis = new Redis({ url, token });
    const key = `contact:rl:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    return count > RATE_LIMIT_MAX;
  } catch (err) {
    console.error('[contact] rate limit check failed:', err);
    return false;
  }
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

  if (await isRateLimited(ip.trim())) return res.status(429).json({ error: 'Too many requests' });

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
    const { error } = await resend.emails.send({
      from: 'Level Up <hello@welevelup.org>',
      to: 'hello@welevelup.org',
      cc: 'tech@welevelup.org',
      replyTo: email,
      subject: subject ? `[Contact] ${subject}` : `[Contact] Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });
    if (error) throw new Error(error.message);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}
