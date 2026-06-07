import type { APIRoute } from 'astro';
import { checkCredentials, createSessionCookie, clearSessionCookie } from '../../lib/admin-auth';
import { isRateLimited } from '../../lib/ratelimit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (await isRateLimited(`admin-login:${ip}`)) {
    return new Response(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email, password } = await request.json();
    if (!checkCredentials(email, password)) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const cookie = await createSessionCookie();
    return new Response(JSON.stringify({ ok: true, token: cookie }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `admin_session=${cookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Login failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Logout failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
