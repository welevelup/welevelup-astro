import { Redis } from '@upstash/redis';

export async function verifyAdminSession(cookies: string): Promise<boolean> {
  const sessionMatch = cookies.match(/admin_session=([^;]+)/);
  if (!sessionMatch) return false;

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL || '';
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
    if (!url || !token) return false;

    const redis = new Redis({ url, token });
    const session = await redis.get(`session:${sessionMatch[1]}`);
    return !!session;
  } catch (err) {
    console.error('[verify-admin-session] Error:', err);
    return false;
  }
}
