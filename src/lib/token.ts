import { createHmac, timingSafeEqual } from 'crypto';

const ALGO = 'sha256';

export function createToken(
  payload: Record<string, unknown>,
  secret: string,
  ttlMs = 3_600_000 // 1 hour
): string {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString('base64url');
  const sig = createHmac(ALGO, secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken<T = Record<string, unknown>>(
  token: string,
  secret: string
): (T & { exp: number }) | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  try {
    const expected = createHmac(ALGO, secret).update(data).digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as T & { exp: number };
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
