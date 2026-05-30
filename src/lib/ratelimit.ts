import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _rl: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (_rl) return _rl;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _rl = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    prefix: 'lu:rl',
  });
  return _rl;
}

// Returns true if the request should be blocked.
// Falls back to allow-all when UPSTASH env vars are absent (local dev).
export async function isRateLimited(identifier: string): Promise<boolean> {
  const rl = getRatelimit();
  if (!rl) return false;
  const { success } = await rl.limit(identifier);
  return !success;
}
