import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { verifyAdminSession } from '../src/lib/verify-admin-session';

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const SIGNUPS_KEY = 'holloway:councillor_tool:signups';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Rate limit via Upstash Redis (shared across Vercel instances). Fails open
// if Redis is unconfigured so the tool never blocks a legitimate signup.
async function isRateLimited(ip: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const key = `councillor-tool:rl:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    return count > RATE_LIMIT_MAX;
  } catch (err) {
    console.error('[councillor-tool] rate limit check failed:', err);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET: export stored signups (admin session required).
  if (req.method === 'GET') {
    const isAdmin = await verifyAdminSession(req.headers.cookie ?? '');
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const redis = getRedis();
    if (!redis) return res.status(500).json({ error: 'Storage not configured' });
    try {
      const raw = await redis.lrange(SIGNUPS_KEY, 0, -1);
      const signups = raw.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
      return res.status(200).json({ count: signups.length, signups });
    } catch (err) {
      console.error('[councillor-tool] export failed:', err);
      return res.status(500).json({ error: 'Export failed' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]
      : Array.isArray(req.headers['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : null) ?? 'unknown';

  if (await isRateLimited(ip.trim())) return res.status(429).json({ error: 'Too many requests' });

  const body = req.body as Record<string, unknown>;
  const firstName = String(body?.first_name ?? '').trim().slice(0, 100);
  const lastName = String(body?.last_name ?? '').trim().slice(0, 100);
  const email = String(body?.email ?? '').trim().slice(0, 200);
  const postcode = String(body?.postcode ?? '').trim().toUpperCase().slice(0, 10);
  const ward = String(body?.ward ?? '').trim().slice(0, 60);
  const keepMeUpdated = body?.keep_me_updated === true || body?.keep_me_updated === 'true';
  // Honeypot: real users never fill this hidden field.
  if (String(body?.website ?? '').trim() !== '') return res.status(200).json({ ok: true });

  if (!firstName || !lastName || !email || !postcode)
    return res.status(400).json({ error: 'First name, last name, email and postcode are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Valid email required' });

  const redis = getRedis();
  if (!redis) {
    // Local dev without Redis: accept so the flow can be tested end-to-end.
    console.warn('[councillor-tool] Redis not configured — signup not stored');
    return res.status(200).json({ ok: true, stored: false });
  }

  try {
    await redis.rpush(
      SIGNUPS_KEY,
      JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        postcode,
        ward,
        keep_me_updated: keepMeUpdated,
        created_at: new Date().toISOString(),
      })
    );
    return res.status(200).json({ ok: true, stored: true });
  } catch (err) {
    console.error('[councillor-tool] store failed:', err);
    // Storage failure must not block the user from emailing their councillors.
    return res.status(200).json({ ok: true, stored: false });
  }
}
