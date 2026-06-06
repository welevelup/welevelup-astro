import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';

export const config = { runtime: 'nodejs' };

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function redisSet(key: string, value: string, ttl: number) {
  await fetch(`${REDIS_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', key, value, 'EX', ttl]]),
  });
}

async function redisDel(key: string) {
  await fetch(`${REDIS_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['DEL', key]]),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'DELETE') {
    try {
      const cookies = req.headers.cookie ?? '';
      const match = cookies.match(/admin_session=([^;]+)/);
      if (match?.[1]) await redisDel(`session:${match[1]}`);
    } catch { /* ignore */ }
    res.setHeader('Set-Cookie', 'admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read raw body from stream
    const chunks: Buffer[] = [];
    for await (const chunk of req as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');
    console.log('[login] rawBody:', rawBody.slice(0, 200));

    let email: string;
    let password: string;
    try {
      const parsed = JSON.parse(rawBody);
      email = parsed.email ?? '';
      password = parsed.password ?? '';
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').trim();
    const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? '').trim();

    console.log('[login] email match:', email.trim() === ADMIN_EMAIL, '| pass match:', password.trim() === ADMIN_PASSWORD);

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (email.trim() === ADMIN_EMAIL && password.trim() === ADMIN_PASSWORD) {
      const token = randomBytes(32).toString('hex');
      await redisSet(`session:${token}`, JSON.stringify({ email: ADMIN_EMAIL }), 7 * 24 * 60 * 60);
      res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('[login] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
