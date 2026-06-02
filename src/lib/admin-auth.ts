import { createHmac, timingSafeEqual } from 'crypto';

function getAdminPassword(): string {
  return (process.env.ADMIN_PASSWORD ?? import.meta.env.ADMIN_PASSWORD ?? '').trim();
}
function getJwtSecret(): string {
  return (process.env.ADMIN_JWT_SECRET ?? import.meta.env.ADMIN_JWT_SECRET ?? process.env.PORTAL_SECRET ?? '').trim();
}
const COOKIE = 'admin_session';
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function sign(payload: object): string {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + TTL_MS })).toString('base64url');
  const sig = createHmac('sha256', getJwtSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verify(token: string): Record<string, unknown> | null {
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  try {
    const expected = createHmac('sha256', getJwtSecret()).update(data).digest('base64url');
    const a = Buffer.from(sig, 'base64url');
    const b = Buffer.from(expected, 'base64url');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as Record<string, unknown>;
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function checkPassword(password: string): boolean {
  const stored = getAdminPassword();
  const input = (password ?? '').trim();
  if (!stored || !input) return false;
  return input === stored;
}

export function createSessionCookie(): string {
  const token = sign({ role: 'admin' });
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=${TTL_MS / 1000}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=0`;
}

export function isAuthenticated(request: Request): boolean {
  const cookies = request.headers.get('cookie') ?? '';
  const match = cookies.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match) return false;
  return verify(match[1]) !== null;
}
