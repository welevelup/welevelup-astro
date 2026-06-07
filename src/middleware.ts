import { defineMiddleware } from 'astro:middleware';
import { isAuthenticated } from './lib/admin-auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/levelup/login') || pathname.startsWith('/api/')) {
    return next();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/levelup')) {
    if (!(await isAuthenticated(context.request))) {
      return context.redirect('/levelup/login');
    }
  }

  return next();
});
