import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { Redis } from '@upstash/redis';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const MAX_LETTER_LENGTH = 5000;

// Same shared-counter approach as api/contact.ts. Fails open when Redis is not set.
async function isRateLimited(ip: string): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  try {
    const redis = new Redis({ url, token });
    const key = `letter-moj:rl:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    return count > RATE_LIMIT_MAX;
  } catch (err) {
    console.error('[letter-moj] rate limit check failed:', err);
    return false;
  }
}

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (first ?? 'unknown').trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendKey = process.env.RESEND_API_KEY;
  // Recipient comes from config, never from the request. Without it, nothing is sent.
  const recipient = process.env.MOJ_LETTER_RECIPIENT;
  if (!resendKey || !recipient) return res.status(500).json({ error: 'Server misconfigured' });

  if (await isRateLimited(clientIp(req))) return res.status(429).json({ error: 'Too many requests' });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  const address = String(body.address ?? '').trim();
  const email = String(body.email ?? '').trim();
  const postcode = String(body.postcode ?? '').trim();
  const letter = String(body.letter ?? '').trim();
  const honeypot = String(body.company ?? '').trim();

  // Bot trap: pretend success, send nothing.
  if (honeypot) return res.status(200).json({ ok: true });

  if (!name || !email || !postcode || !letter)
    return res.status(400).json({ error: 'Name, email, postcode and letter are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Valid email required' });
  if (letter.length > MAX_LETTER_LENGTH)
    return res.status(400).json({ error: 'Letter is too long' });

  try {
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: 'Level Up <hello@welevelup.org>',
      to: recipient,
      cc: process.env.MOJ_LETTER_CC || undefined,
      replyTo: email,
      subject: 'Letter to the Ministry of Justice: restraints on pregnant women',
      text: `Name: ${name}\nAddress: ${address}\nEmail: ${email}\nPostcode: ${postcode}\n\n${letter}`,
    });
    if (error) throw new Error(error.message);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[letter-moj] send failed:', err);
    return res.status(500).json({ error: 'Failed to send letter' });
  }
}
