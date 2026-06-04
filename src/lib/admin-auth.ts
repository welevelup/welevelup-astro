import { SignJWT, jwtVerify } from 'jose';

const ADMIN_EMAIL = 'catalina@welevelup.org';
const ADMIN_PASSWORD = 'catalina';
const COOKIE_NAME = 'admin_session';
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSecret(): Uint8Array {
  const secret = import.meta.env.JWT_SECRET ?? import.meta.env.ADMIN_JWT_SECRET ?? '';
  if (!secret) throw new Error('JWT_SECRET env variable is not set');
  return new TextEncoder().encode(secret);
}

export function checkCredentials(email: string, password: string): boolean {
  return email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

export async function createSessionCookie(): Promise<string> {
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());

  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function isAuthenticated(request: Request): Promise<boolean> {
  const cookies = request.headers.get('cookie') ?? '';
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;

  try {
    await jwtVerify(match[1], getSecret());
    return true;
  } catch {
    return false;
  }
}
