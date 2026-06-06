import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function redisCommand(command: string, args: (string | number)[] = []): Promise<any> {
  const url = new URL(UPSTASH_REDIS_REST_URL);
  url.pathname = `/v2/pipeline`;
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([[command, ...args]]),
  });
  if (!res.ok) throw new Error(`Redis error: ${res.statusText}`);
  const data = await res.json() as any[];
  return data[0];
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || record.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (record.count >= 5) return false;
  record.count++;
  return true;
}

async function createSession(email: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const ttl = 7 * 24 * 60 * 60;
  await redisCommand('SET', [`session:${token}`, JSON.stringify({ email }), 'EX', ttl]);
  return token;
}

export async function getSession(token: string): Promise<{ email: string } | null> {
  const data = await redisCommand('GET', [`session:${token}`]);
  if (!data) return null;
  try {
    return JSON.parse(data as string);
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'DELETE') {
    const cookies = req.headers.cookie ?? '';
    const match = cookies.match(/admin_session=([^;]+)/);
    const token = match?.[1];
    if (token) await redisCommand('DEL', [`session:${token}`]);
    res.setHeader('Set-Cookie', 'admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim();
  const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }

  // Parse body — handle both pre-parsed (Vercel) and raw stream
  let email: string | undefined;
  let password: string | undefined;

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    email = req.body.email;
    password = req.body.password;
  } else {
    try {
      let rawBody = '';
      for await (const chunk of req as any) {
        rawBody += chunk;
      }
      const parsed = JSON.parse(rawBody);
      email = parsed.email;
      password = parsed.password;
    } catch {
      return res.status(400).json({ error: 'Invalid request body' });
    }
  }

  const e = (email ?? '').trim();
  const p = (password ?? '').trim();

  if (e === ADMIN_EMAIL && p === ADMIN_PASSWORD) {
    const token = await createSession(e);
    res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({
    error: 'Invalid credentials',
    debug: {
      bodyType: typeof req.body,
      emailReceived: JSON.stringify(e),
      emailExpected: JSON.stringify(ADMIN_EMAIL),
      emailMatch: e === ADMIN_EMAIL,
      passLenReceived: p.length,
      passLenExpected: ADMIN_PASSWORD.length,
      passMatch: p === ADMIN_PASSWORD,
    }
  });
}
