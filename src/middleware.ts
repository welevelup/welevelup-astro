import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/api/')) {
    return next();
  }

  if (pathname.startsWith('/admin')) {
    const cookies = context.request.headers.get('cookie') ?? '';
    const match = cookies.match(/admin_session=([^;]+)/);
    if (!match) {
      return context.redirect('/admin/login');
    }
  }

  return next();
});
