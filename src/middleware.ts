import { defineMiddleware } from 'astro:middleware';

async function isValidSession(token: string): Promise<boolean> {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const tok = import.meta.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !tok) return false;
  try {
    const res = await fetch(`${url}/get/session:${token}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const data = await res.json() as { result: string | null };
    return !!data.result;
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/levelup/login') || pathname.startsWith('/api/')) {
    return next();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/levelup')) {
    const cookies = context.request.headers.get('cookie') ?? '';
    const match = cookies.match(/admin_session=([^;]+)/);
    if (!match || !await isValidSession(match[1])) {
      return context.redirect('/levelup/login');
    }
  }

  return next();
});
