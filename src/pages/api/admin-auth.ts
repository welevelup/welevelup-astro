import type { APIRoute } from 'astro';
import { checkCredentials, createSessionCookie, clearSessionCookie } from '../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let email = '';
  let password = '';

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = await request.json() as { email?: string; password?: string };
    email = body.email?.trim() ?? '';
    password = body.password ?? '';
  } else {
    const form = await request.formData();
    email = form.get('email')?.toString().trim() ?? '';
    password = form.get('password')?.toString() ?? '';
  }

  if (!checkCredentials(email, password)) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookie = await createSessionCookie();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
};

export const DELETE: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  });
};
