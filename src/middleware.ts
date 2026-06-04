import { defineMiddleware } from 'astro:middleware';
import { isAuthenticated } from './lib/admin-auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Only protect /admin/* routes
  if (!pathname.startsWith('/admin')) {
    return next();
  }

  // Login page is always accessible
  if (pathname === '/admin/login' || pathname === '/admin/login/') {
    return next();
  }

  // Check authentication
  const authenticated = await isAuthenticated(context.request);

  if (!authenticated) {
    return context.redirect('/admin/login');
  }

  return next();
});
