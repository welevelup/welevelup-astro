import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';

const ADMIN_EMAIL = 'catalina@welevelup.org';
const ADMIN_PASSWORD = 'catalina';

const sessions = new Map<string, { email: string; expiresAt: number }>();

function createSession(email: string): string {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { email, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return token;
}

export function getSession(token: string): { email: string } | null {
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { email: session.email };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'DELETE') {
    const cookies = req.headers.cookie ?? '';
    const match = cookies.match(/admin_session=([^;]+)/);
    const token = match?.[1];
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', 'admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body ?? {};

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = createSession(email);
    res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}
