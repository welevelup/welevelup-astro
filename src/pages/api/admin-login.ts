import type { APIRoute } from 'astro';
import { createSession } from '../../lib/session';

const ADMIN_EMAIL = 'catalina@welevelup.org';
const ADMIN_PASSWORD = 'catalina';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const { email, password } = body;

    console.log('[admin-login] Attempting with:', email, '/', password);
    console.log('[admin-login] Expected:', ADMIN_EMAIL, '/', ADMIN_PASSWORD);

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = createSession(email);
      console.log('[admin-login] SUCCESS - token created');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
        },
      });
    }

    console.log('[admin-login] FAILED - invalid credentials');
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-login] ERROR:', err);
    return new Response(JSON.stringify({ error: 'Request error', details: err instanceof Error ? err.message : 'Unknown' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
