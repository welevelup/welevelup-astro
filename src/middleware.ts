import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/session';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  // Allow login page without auth
  if (pathname.startsWith('/admin/login')) {
    return next();
  }

  // Protect /admin/* routes
  if (pathname.startsWith('/admin')) {
    const cookies = context.request.headers.get('cookie') ?? '';
    const match = cookies.match(/admin_session=([^;]+)/);
    const token = match?.[1];

    if (!token || !getSession(token)) {
      return context.redirect('/admin/login');
    }
  }

  return next();
});
