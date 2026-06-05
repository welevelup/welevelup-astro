import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/session';

export const onRequest = defineMiddleware((context, next) => {
  // TEMPORARILY DISABLED FOR DEBUGGING
  // Vercel is not serving /api/* routes, so we're allowing public access to /admin/* for now
  // Once we fix the Vercel API route configuration, we'll re-enable authentication

  // const { pathname } = context.url;
  // if (pathname.startsWith('/admin/login')) {
  //   return next();
  // }
  // if (pathname.startsWith('/admin')) {
  //   const cookies = context.request.headers.get('cookie') ?? '';
  //   const match = cookies.match(/admin_session=([^;]+)/);
  //   const token = match?.[1];
  //   if (!token || !getSession(token)) {
  //     return context.redirect('/admin/login');
  //   }
  // }

  return next();
});
