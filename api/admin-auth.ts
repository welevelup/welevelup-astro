import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function cleanEnvVar(value: string): string {
  if (!value) return '';
  let cleaned = value
    .replace(/^["'\\n\\r]+/, '')
    .replace(/["'\\n\\r]+$/, '')
    .trim();
  if (cleaned.includes('UPSTASH_')) {
    const urlMatch = cleaned.match(/https:\/\/[a-z0-9-]+\.upstash\.io/);
    if (urlMatch) return urlMatch[0];
    const tokenMatch = cleaned.match(/[a-zA-Z0-9]+$/);
    if (tokenMatch) return tokenMatch[0];
  }
  return cleaned;
}

function getRedis(): Redis {
  const url = cleanEnvVar(process.env.UPSTASH_REDIS_REST_URL || '');
  const token = cleanEnvVar(process.env.UPSTASH_REDIS_REST_TOKEN || '');
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  return email === adminEmail && password === adminPassword;
}

async function createSession(): Promise<string> {
  const redis = getRedis();
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  await redis.set(`session:${token}`, JSON.stringify({ email: process.env.ADMIN_EMAIL, createdAt: new Date().toISOString() }), { ex: 86400 });
  return token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    // Login
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      if (!(await verifyCredentials(email, password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = await createSession();
      res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);
      return res.status(200).json({ ok: true, token });
    } catch (err) {
      console.error('[admin-auth] Login error:', err);
      return res.status(500).json({ error: 'Login failed' });
    }
  } else if (req.method === 'DELETE') {
    // Logout
    try {
      res.setHeader('Set-Cookie', 'admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[admin-auth] Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
