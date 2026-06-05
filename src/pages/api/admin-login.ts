import type { APIRoute } from 'astro';
import { createSession } from '../../lib/session';

const ADMIN_EMAIL = 'catalina@welevelup.org';
const ADMIN_PASSWORD = 'catalina';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string };

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = createSession(email);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Request error' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
