import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';

async function redisPipeline(commands: (string | number)[][]) {
  const url = process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) throw new Error('Redis not configured');
  const res = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'DELETE') {
    try {
      const cookies = req.headers.cookie ?? '';
      const match = cookies.match(/admin_session=([^;]+)/);
      if (match?.[1]) await redisPipeline([['DEL', `session:${match[1]}`]]);
    } catch { /* ignore */ }
    res.setHeader('Set-Cookie', 'admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').trim();
  const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? '').trim();

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let email = '';
  let password = '';

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    email = String(req.body.email ?? '');
    password = String(req.body.password ?? '');
  } else {
    try {
      let raw = '';
      for await (const chunk of req as any) {
        raw += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      }
      const parsed = JSON.parse(raw);
      email = String(parsed.email ?? '');
      password = String(parsed.password ?? '');
    } catch {
      return res.status(400).json({ error: 'Invalid request body' });
    }
  }

  if (email.trim() === ADMIN_EMAIL && password.trim() === ADMIN_PASSWORD) {
    const token = randomBytes(32).toString('hex');
    const ttl = 7 * 24 * 60 * 60;
    await redisPipeline([['SET', `session:${token}`, JSON.stringify({ email: ADMIN_EMAIL }), 'EX', ttl]]);
    res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttl}`);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}
