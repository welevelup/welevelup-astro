import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required');
}

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
  const ttl = 7 * 24 * 60 * 60; // 7 days in seconds
  await redisCommand('SET', [
    `session:${token}`,
    JSON.stringify({ email }),
    'EX',
    ttl,
  ]);
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

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }

  const { email, password } = req.body ?? {};

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = await createSession(email);
    res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}
