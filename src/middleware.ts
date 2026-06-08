import { defineMiddleware } from 'astro:middleware';
import { isAuthenticated } from './lib/admin-auth';
import { Redis } from '@upstash/redis';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, searchParams } = context.url;

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/levelup/login') || pathname.startsWith('/api/')) {
    return next();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/levelup')) {
    // Check for token in URL (from login redirect)
    const urlToken = searchParams.get('token');

    // Check for session cookie
    const hasCookie = await isAuthenticated(context.request);

    // Check if token is valid in Redis
    let hasValidToken = false;
    if (urlToken) {
      try {
        const url = process.env.UPSTASH_REDIS_REST_URL || '';
        const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
        if (url && token) {
          const redis = new Redis({ url, token });
          const session = await redis.get(`session:${urlToken}`);
          hasValidToken = !!session;
        }
      } catch (err) {
        console.error('[middleware] Redis check failed:', err);
      }
    }

    if (!hasCookie && !hasValidToken) {
      return context.redirect('/levelup/login');
    }
  }

  return next();
});
